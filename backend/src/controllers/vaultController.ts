import crypto from 'crypto';
import { Response } from 'express';
import { $Enums, Prisma } from '@prisma/client';
import { db } from '../services/db';
import { canAccessRecord, resolveConsent } from '../services/access';
import { recordAudit } from '../services/auditLog';
import { appendEntry } from '../services/ledger';
import { AuthRequest, queryParam, requireUser, routeParam } from '../middlewares/authMiddleware';
import {
    buildStorageKey,
    deserialiseWrappedKey,
    encryptAndStore,
    ENCRYPTION_ALGORITHM,
    retrieveAndDecrypt,
    serialiseWrappedKey,
} from '../services/recordCrypto';
import { getObjectStorage } from '../services/objectStorage';
import { HttpError } from '../utils/http';

/**
 * Records created before the encrypted pipeline existed carry no retrievable
 * object. They are listed, but reading them returns a clear 409 rather than
 * pretending a payload exists.
 */
const MOCK_DRIVER = 'MOCK';

// GET /api/v1/vault/records
export const getRecords = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = requireUser(req);
    const patient = await db.patients.findUnique({ where: { user_id: userId } });
    if (!patient) {
        res.status(404).json({ message: 'Patient not found' });
        return;
    }

    const category = queryParam(req, 'category');
    const search = queryParam(req, 'search');

    const whereClause: Prisma.medical_recordsWhereInput = {
        patient_id: patient.patient_id,
        is_deleted: false,
    };

    if (category && category !== 'ALL') {
        whereClause.category = category as $Enums.record_category_enum;
    }

    if (search) {
        // `medical_records` has no description column; diagnosis and tags are
        // the searchable free-text fields.
        whereClause.OR = [
            { record_title: { contains: search, mode: 'insensitive' } },
            { diagnosis: { contains: search, mode: 'insensitive' } },
            { tags: { has: search } },
        ];
    }

    const records = await db.medical_records.findMany({
        where: whereClause,
        include: { doctors: true, hospitals: true, blockchain_anchor: true },
        orderBy: { record_date: 'desc' },
    });

    res.json(
        records.map((record) => ({
            ...record,
            // Lets the client disable view/download for pre-pipeline rows.
            is_retrievable: record.storage_driver !== MOCK_DRIVER,
        }))
    );
};

/**
 * POST /api/v1/vault/records/:id/decrypt
 *
 * Returns the decrypted payload as base64 for in-browser rendering. Decryption
 * happens server-side: the browser never holds key material, which is the
 * safer arrangement for the current threat model.
 */
export const decryptRecord = async (req: AuthRequest, res: Response): Promise<void> => {
    const recordId = routeParam(req, 'id');
    const { userId, role } = requireUser(req);

    const allowed = await canAccessRecord(userId, role, recordId);
    if (!allowed) {
        res.status(403).json({ message: 'You do not have access to this record' });
        return;
    }

    const record = await db.medical_records.findUnique({ where: { record_id: recordId } });
    if (!record) {
        res.status(404).json({ message: 'Record not found' });
        return;
    }

    if (record.storage_driver === MOCK_DRIVER) {
        res.status(409).json({
            message:
                'This record predates the encrypted storage pipeline and has no retrievable file. Ask the uploader to re-upload it.',
            record_id: record.record_id,
            storage_driver: record.storage_driver,
        });
        return;
    }

    const plaintext = await retrieveAndDecrypt({
        storageKey: record.file_s3_key,
        iv: record.iv_bytes,
        wrappedKey: deserialiseWrappedKey(record.encrypted_dek, record.dek_auth_tag ?? '', record.kms_key_id),
        expectedSha256: record.file_sha256_hash,
    });

    res.json({
        record_id: record.record_id,
        record_title: record.record_title,
        file_mime_type: record.file_mime_type,
        file_size_bytes: record.file_size_bytes,
        file_sha256_hash: record.file_sha256_hash,
        original_filename: record.original_filename,
        encryption_algorithm: record.encryption_algorithm,
        content_base64: plaintext.toString('base64'),
    });
};

/**
 * GET /api/v1/vault/records/:id/download
 *
 * Streams the decrypted file as an attachment. Gated by the same access rule
 * as viewing, and recorded in the audit trail with the record id.
 */
export const downloadRecord = async (req: AuthRequest, res: Response): Promise<void> => {
    const recordId = routeParam(req, 'id');
    const { userId, role } = requireUser(req);

    const allowed = await canAccessRecord(userId, role, recordId);
    if (!allowed) {
        res.status(403).json({ message: 'You do not have access to this record' });
        return;
    }

    const record = await db.medical_records.findUnique({ where: { record_id: recordId } });
    if (!record) {
        res.status(404).json({ message: 'Record not found' });
        return;
    }

    if (record.storage_driver === MOCK_DRIVER) {
        res.status(409).json({
            message: 'This record predates the encrypted storage pipeline and has no retrievable file.',
        });
        return;
    }

    // A doctor holding READ_ONLY consent may view but not take a copy.
    if (role === 'DOCTOR') {
        const doctor = await db.doctors.findUnique({
            where: { user_id: userId },
            select: { doctor_id: true },
        });
        const consent = doctor
            ? await resolveConsent(record.patient_id, doctor.doctor_id)
            : null;

        // Break-glass grants viewing only; downloads require explicit consent.
        if (!consent || !consent.hasConsent || consent.accessLevel !== 'DOWNLOAD') {
            res.status(403).json({
                message: 'This patient has granted view-only access; downloading is not permitted.',
            });
            return;
        }
    }

    const plaintext = await retrieveAndDecrypt({
        storageKey: record.file_s3_key,
        iv: record.iv_bytes,
        wrappedKey: deserialiseWrappedKey(record.encrypted_dek, record.dek_auth_tag ?? '', record.kms_key_id),
        expectedSha256: record.file_sha256_hash,
    });

    await recordAudit({
        userId,
        userRole: role,
        action: 'RECORD_DOWNLOAD',
        resourceType: 'MEDICAL_RECORD',
        resourceId: record.record_id,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        details: { bytes: plaintext.length, filename: record.original_filename },
    });

    const filename = (record.original_filename ?? `${record.record_title}.pdf`).replace(/["\r\n]/g, '');
    res.setHeader('Content-Type', record.file_mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(plaintext.length));
    res.send(plaintext);
};

// GET /api/v1/vault/records/:id/blockchain-proof
export const getBlockchainProof = async (req: AuthRequest, res: Response): Promise<void> => {
    const recordId = routeParam(req, 'id');
    const { userId, role } = requireUser(req);

    // The proof reveals which record exists and when, so the caller must be
    // entitled to that record.
    const allowed = await canAccessRecord(userId, role, recordId);
    if (!allowed) {
        res.status(403).json({ message: 'You do not have access to this record' });
        return;
    }

    const anchor = await db.blockchain_anchors.findFirst({ where: { record_id: recordId } });
    if (!anchor) {
        res.status(404).json({ message: 'Blockchain anchor not found' });
        return;
    }

    res.json(anchor);
};

/**
 * POST /api/v1/vault/upload  (multipart/form-data)
 *
 * Accepts the file itself, encrypts it, writes the ciphertext to object
 * storage and records only metadata plus the wrapped key in the database.
 */
export const uploadRecord = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId, role } = requireUser(req);
    const file = req.file;

    if (!file) {
        throw HttpError.badRequest('No file was provided. Send the file under the "file" field.');
    }

    const { vault_number, record_title, category, diagnosis, tags, record_date } = req.body;

    const vault = await db.patient_vaults.findUnique({
        where: { vault_number },
        include: { patients: { select: { user_id: true, patient_id: true } } },
    });
    if (!vault) {
        res.status(404).json({ message: 'Patient Vault not found' });
        return;
    }

    // A patient may only upload into their own vault.
    if (role === 'PATIENT' && vault.patients.user_id !== userId) {
        res.status(403).json({ message: 'You may only upload to your own vault' });
        return;
    }

    let doctorId: string | null = null;
    let hospitalId: string | null = null;

    if (role === 'DOCTOR') {
        const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
        if (!doctor) {
            res.status(404).json({ message: 'Doctor profile not found' });
            return;
        }
        if (doctor.verification_status !== 'VERIFIED') {
            res.status(403).json({ message: 'Only verified doctors may upload records' });
            return;
        }
        doctorId = doctor.doctor_id;
        hospitalId = doctor.primary_hospital_id;
    }

    const recordId = crypto.randomUUID();
    const storageKey = buildStorageKey(vault.vault_number, recordId);

    // The digest is computed here, over the bytes actually received. A
    // client-supplied hash is not trusted and is not stored.
    const encrypted = await encryptAndStore(file.buffer, storageKey);

    const parsedTags = Array.isArray(tags)
        ? tags
        : typeof tags === 'string' && tags.length > 0
          ? tags.split(',').map((tag: string) => tag.trim()).filter(Boolean)
          : [];

    try {
        const record = await db.medical_records.create({
            data: {
                record_id: recordId,
                vault_id: vault.vault_id,
                patient_id: vault.patient_id,
                uploaded_by_doctor_id: doctorId,
                hospital_id: hospitalId,
                record_title,
                category,
                diagnosis: diagnosis || null,
                original_filename: file.originalname,
                file_s3_key: encrypted.storageKey,
                file_mime_type: file.mimetype,
                file_size_bytes: BigInt(encrypted.plaintextBytes),
                file_sha256_hash: encrypted.sha256,
                kms_key_id: encrypted.wrappedKey.keyId,
                encrypted_dek: serialiseWrappedKey(encrypted.wrappedKey),
                dek_auth_tag: encrypted.wrappedKey.authTag,
                iv_bytes: encrypted.iv,
                storage_driver: encrypted.storageDriver,
                encryption_algorithm: ENCRYPTION_ALGORITHM,
                tags: parsedTags,
                ...(record_date ? { record_date: new Date(record_date) } : {}),
            },
        });

        await db.patient_vaults.update({
            where: { vault_id: vault.vault_id },
            data: {
                total_records_count: { increment: 1 },
                total_storage_bytes: { increment: BigInt(encrypted.plaintextBytes) },
            },
        });

        await db.notifications.create({
            data: {
                user_id: vault.patients.user_id,
                event_type: 'NEW_RECORD_UPLOAD',
                title: 'New Medical Record Uploaded',
                message: `A new record "${record_title}" was uploaded to your vault.`,
                payload_json: { record_id: record.record_id },
            },
        });

        res.status(201).json({
            message: 'Record encrypted and stored successfully',
            record: { ...record, is_retrievable: true },
            sha256: encrypted.sha256,
        });
    } catch (error) {
        // Do not leave an orphaned ciphertext behind if the metadata write fails.
        await getObjectStorage().delete(storageKey).catch(() => undefined);
        throw error;
    }
};

/**
 * POST /api/v1/vault/anchor-blockchain
 *
 * Anchors the record's digest in the tamper-evident ledger. The digest is read
 * from the record rather than accepted from the caller, so a client cannot
 * anchor a value that does not correspond to the stored file.
 */
export const anchorBlockchain = async (req: AuthRequest, res: Response): Promise<void> => {
    const { record_id } = req.body;
    const { userId, role } = requireUser(req);

    const allowed = await canAccessRecord(userId, role, record_id);
    if (!allowed) {
        res.status(403).json({ message: 'You do not have access to this record' });
        return;
    }

    const record = await db.medical_records.findUnique({ where: { record_id } });
    if (!record) {
        res.status(404).json({ message: 'Record not found' });
        return;
    }

    const existing = await db.blockchain_anchors.findUnique({ where: { record_id } });
    if (existing) {
        res.status(409).json({ message: 'Record is already anchored', anchor: existing });
        return;
    }

    // Committed to the append-only ledger. The entry hash chains to the
    // previous entry, so the anchor cannot later be rewritten unnoticed.
    const entry = await appendEntry({
        subjectType: 'MEDICAL_RECORD',
        subjectId: record.record_id,
        payloadSha256: record.file_sha256_hash,
        metadata: {
            category: record.category,
            uploaded_by_doctor_id: record.uploaded_by_doctor_id,
            hospital_id: record.hospital_id,
            record_date: record.record_date.toISOString(),
        },
    });

    const anchor = await db.blockchain_anchors.create({
        data: {
            record_id,
            document_sha256: record.file_sha256_hash,
            blockchain_network: 'MEDILOCKER_LEDGER',
            channel_name: 'integrity',
            chaincode_name: 'append-only-v1',
            transaction_tx_id: entry.entryHash,
            block_number: BigInt(entry.entryId),
            ledger_entry_id: BigInt(entry.entryId),
            anchor_status: 'CONFIRMED',
            last_verified_at: entry.createdAt,
        },
    });

    res.status(201).json({
        message: 'Record digest committed to the integrity ledger',
        anchor,
        ledger: {
            entry_id: entry.entryId,
            entry_hash: entry.entryHash,
            previous_hash: entry.previousHash,
        },
    });
};
