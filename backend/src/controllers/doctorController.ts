import crypto from 'crypto';
import { Response } from 'express';
import { db } from '../services/db';
import { env } from '../config/env';
import { AuthRequest, requireUser, routeParam } from '../middlewares/authMiddleware';
import { validatedQuery } from '../middlewares/validate';
import { recordAudit } from '../services/auditLog';
import { canAccessRecord, resolveConsent } from '../services/access';
import { getObjectStorage } from '../services/objectStorage';
import { renderPrescriptionPdf } from '../services/prescriptionPdf';
import {
    fingerprintPublicKey,
    isUsablePublicKey,
    SIGNATURE_ALGORITHM,
    verifyPrescriptionSignature,
} from '../services/prescriptionSignature';
import {
    buildStorageKey,
    encryptAndStore,
    ENCRYPTION_ALGORITHM,
    serialiseWrappedKey,
} from '../services/recordCrypto';

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const doctor = await db.doctors.findUnique({
            where: { user_id: userId },
            include: { hospitals: true }
        });

        if (!doctor) {
            res.status(404).json({ message: 'Doctor not found' });
            return;
        }

        const recentConsultations = await db.consultations.findMany({
            where: { doctor_id: doctor.doctor_id },
            orderBy: { consultation_date: 'desc' },
            take: 5,
            include: { patients: true }
        });

        const activeConsentsCount = await db.consents.count({
            where: { 
                doctor_id: doctor.doctor_id,
                consent_status: 'ACTIVE',
                valid_until: { gte: new Date() }
            }
        });

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0,0,0,0);
        
        const uploadsThisMonth = await db.medical_records.count({
            where: {
                uploaded_by_doctor_id: doctor.doctor_id,
                created_at: { gte: startOfMonth }
            }
        });

        const totalPatients = await db.consultations.groupBy({
            by: ['patient_id'],
            where: { doctor_id: doctor.doctor_id }
        });

        const recentPrescriptions = await db.prescriptions.findMany({
            where: { doctor_id: doctor.doctor_id },
            orderBy: { issued_at: 'desc' },
            take: 5,
            include: { patients: true }
        });

        const flaggedDisputes = await db.record_flags.count({
             where: {
                 medical_records: { uploaded_by_doctor_id: doctor.doctor_id },
                 flag_lifecycle_status: 'FLAGGED'
             }
        });

        res.json({
            doctor: {
                id: doctor.doctor_id,
                name: `Dr. ${doctor.first_name} ${doctor.last_name}`,
                specialization: doctor.specialization,
                hospital: doctor.hospitals?.hospital_name || 'Independent Practice'
            },
            metrics: {
                totalPatients: totalPatients.length,
                uploadsThisMonth,
                activeConsentsCount,
                flaggedDisputes
            },
            recentConsultations,
            recentPrescriptions
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching doctor dashboard', error: error.message });
    }
};

export const checkConsent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { identifier } = req.body; // Vault number or phone
        const userId = req.user?.userId;
        const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
        
        if (!doctor) { res.status(404).json({ message: 'Doctor not found' }); return; }

        let patient = await db.patients.findFirst({
            where: {
                OR: [
                    { patient_vaults: { vault_number: identifier } },
                    { users: { phone_number: identifier } }
                ]
            },
            include: { patient_vaults: true }
        });

        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        const consent = await db.consents.findFirst({
            where: {
                patient_id: patient.patient_id,
                doctor_id: doctor.doctor_id,
                consent_status: 'ACTIVE',
                valid_until: { gte: new Date() }
            }
        });

        res.json({
            patient: {
                id: patient.patient_id,
                name: `${patient.first_name} ${patient.last_name}`,
                vault_number: patient.patient_vaults?.vault_number,
                gender: patient.gender,
                age: new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
            },
            hasConsent: !!consent,
            consentDetails: consent || null
        });

    } catch (error: any) {
        res.status(500).json({ message: 'Error checking consent', error: error.message });
    }
};

export const requestConsent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { patient_id } = req.body;
        const userId = req.user?.userId;
        const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
        if (!doctor) { res.status(404).json({ message: 'Doctor not found' }); return; }

        const patient = await db.patients.findUnique({ where: { patient_id } });
        if (!patient) { res.status(404).json({ message: 'Patient not found' }); return; }

        // Create a notification for the patient
        await db.notifications.create({
            data: {
                user_id: patient.user_id,
                event_type: 'ACCESS_REQUEST',
                title: 'Data Access Request',
                message: `Dr. ${doctor.last_name} is requesting access to your medical vault.`,
                payload_json: { doctor_id: doctor.doctor_id }
            }
        });

        res.json({ message: 'Consent request sent via notification' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error requesting consent', error: error.message });
    }
};

export const getPatientRecords = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const vaultNumber = routeParam(req, 'vaultNumber');
        const userId = req.user?.userId;
        const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
        if (!doctor) { res.status(404).json({ message: 'Doctor not found' }); return; }

        const vault = await db.patient_vaults.findUnique({ where: { vault_number: vaultNumber } });
        if (!vault) { res.status(404).json({ message: 'Vault not found' }); return; }

        // Combines every active grant; a block in any of them wins.
        const consent = await resolveConsent(vault.patient_id, doctor.doctor_id);

        if (!consent.hasConsent) {
            res.status(403).json({ message: 'No active consent found' });
            return;
        }

        if (consent.allowed.size === 0) {
            res.json([]);
            return;
        }

        const records = await db.medical_records.findMany({
            where: {
                vault_id: vault.vault_id,
                is_deleted: false,
                category: { in: [...consent.allowed] as any }
            },
            include: { doctors: true, hospitals: true, blockchain_anchor: true }
        });

        res.json(
            records.map((record) => ({
                ...record,
                is_retrievable: record.storage_driver !== 'MOCK'
            }))
        );
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching patient records', error: error.message });
    }
};

/**
 * POST /api/v1/doctor/prescriptions/sign-and-issue
 *
 * The doctor signs the canonical payload in the browser with a non-extractable
 * private key. The server verifies that signature against the public key
 * registered at sign-up before storing anything — `is_signature_valid` records
 * the real verification result, not an assumption.
 */
export const signAndIssuePrescription = async (req: AuthRequest, res: Response): Promise<void> => {
    const { patient_id, clinical_notes, medications, digital_signature, issued_at, valid_until } = req.body;
    const { userId } = requireUser(req);

    const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
    if (!doctor) { res.status(404).json({ message: 'Doctor not found' }); return; }

    if (doctor.verification_status !== 'VERIFIED') {
        res.status(403).json({ message: 'Only verified doctors may issue prescriptions' });
        return;
    }

    if (!isUsablePublicKey(doctor.public_key_pem)) {
        res.status(409).json({
            message:
                'No usable signing key is registered for this account. Re-register your signing key before issuing prescriptions.',
        });
        return;
    }

    const vault = await db.patient_vaults.findUnique({
        where: { patient_id },
        include: { patients: true },
    });
    if (!vault) { res.status(404).json({ message: 'Patient Vault not found' }); return; }

    // The timestamp is part of the signed payload, so it must come from the
    // client that produced the signature.
    const issuedAt = issued_at ? new Date(issued_at) : new Date();
    const drift = Math.abs(Date.now() - issuedAt.getTime());
    if (drift > 10 * 60 * 1000) {
        res.status(400).json({ message: 'issued_at is too far from the current time' });
        return;
    }

    const payload = {
        patient_id,
        doctor_id: doctor.doctor_id,
        medications,
        clinical_notes: clinical_notes ?? '',
        issued_at: issuedAt.toISOString(),
    };

    const signatureValid = verifyPrescriptionSignature(payload, digital_signature, doctor.public_key_pem);
    if (!signatureValid) {
        await recordAudit({
            userId,
            userRole: 'DOCTOR',
            action: 'PRESCRIPTION_SIGNATURE_REJECTED',
            resourceType: 'PRESCRIPTION',
            resourceId: patient_id,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
        });

        res.status(400).json({
            message:
                'Signature verification failed. The prescription was not stored. Check that the signing key matches the one registered for this account.',
        });
        return;
    }

    const recordId = crypto.randomUUID();
    const prescriptionId = crypto.randomUUID();
    const hospital = doctor.primary_hospital_id
        ? await db.hospitals.findUnique({ where: { hospital_id: doctor.primary_hospital_id } })
        : null;

    const pdf = await renderPrescriptionPdf({
        prescriptionId,
        issuedAt,
        validUntil: valid_until ? new Date(valid_until) : null,
        doctorName: `Dr. ${doctor.first_name} ${doctor.last_name}`,
        doctorMrn: doctor.mrn,
        doctorSpecialisation: doctor.specialization,
        hospitalName: hospital?.hospital_name ?? 'Independent Practice',
        patientName: `${vault.patients.first_name} ${vault.patients.last_name}`,
        patientVaultNumber: vault.vault_number,
        medications,
        clinicalNotes: clinical_notes,
        verifyUrl: `${env.publicVerifyUrl}?prescription=${prescriptionId}`,
    });

    // The generated PDF goes through the same encrypted pipeline as any upload.
    const storageKey = buildStorageKey(vault.vault_number, recordId);
    const encrypted = await encryptAndStore(pdf, storageKey);

    try {
        const prescription = await db.$transaction(async (tx) => {
            await tx.medical_records.create({
                data: {
                    record_id: recordId,
                    vault_id: vault.vault_id,
                    patient_id,
                    uploaded_by_doctor_id: doctor.doctor_id,
                    hospital_id: doctor.primary_hospital_id,
                    record_title: `Prescription from Dr. ${doctor.last_name}`,
                    category: 'PRESCRIPTION',
                    original_filename: `prescription-${prescriptionId}.pdf`,
                    file_s3_key: encrypted.storageKey,
                    file_mime_type: 'application/pdf',
                    file_size_bytes: BigInt(encrypted.plaintextBytes),
                    file_sha256_hash: encrypted.sha256,
                    kms_key_id: encrypted.wrappedKey.keyId,
                    encrypted_dek: serialiseWrappedKey(encrypted.wrappedKey),
                    dek_auth_tag: encrypted.wrappedKey.authTag,
                    iv_bytes: encrypted.iv,
                    storage_driver: encrypted.storageDriver,
                    encryption_algorithm: ENCRYPTION_ALGORITHM,
                    record_date: issuedAt,
                },
            });

            return tx.prescriptions.create({
                data: {
                    prescription_id: prescriptionId,
                    record_id: recordId,
                    doctor_id: doctor.doctor_id,
                    patient_id,
                    clinical_notes,
                    medications,
                    digital_signature,
                    signature_algorithm: SIGNATURE_ALGORITHM,
                    doctor_public_key_hash: fingerprintPublicKey(doctor.public_key_pem),
                    is_signature_valid: true,
                    issued_at: issuedAt,
                    valid_until: valid_until ? new Date(valid_until) : null,
                },
            });
        });

        await db.notifications.create({
            data: {
                user_id: vault.patients.user_id,
                event_type: 'NEW_RECORD_UPLOAD',
                title: 'New Prescription Issued',
                message: `Dr. ${doctor.last_name} issued a prescription to your vault.`,
                payload_json: { record_id: recordId, prescription_id: prescriptionId },
            },
        });

        res.status(201).json({
            message: 'Prescription signed, verified and stored',
            prescription,
            record_id: recordId,
            verify_url: `${env.publicVerifyUrl}?prescription=${prescriptionId}`,
        });
    } catch (error) {
        await getObjectStorage().delete(storageKey).catch(() => undefined);
        throw error;
    }
};

export const createConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { patient_id, chief_complaint, diagnosis_summary, follow_up_date } = req.body;
        const userId = req.user?.userId;
        const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
        if (!doctor) { res.status(404).json({ message: 'Doctor not found' }); return; }

        const consultation = await db.consultations.create({
            data: {
                patient_id,
                doctor_id: doctor.doctor_id,
                hospital_id: doctor.primary_hospital_id,
                chief_complaint,
                diagnosis_summary,
                follow_up_date: follow_up_date ? new Date(follow_up_date) : null
            }
        });

        res.json({ message: 'Consultation logged', consultation });
    } catch (error: any) {
        res.status(500).json({ message: 'Error logging consultation', error: error.message });
    }
};

export const searchRecords = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { vault_number, category, keyword, hospital_id, from_date, to_date } = validatedQuery<{
            vault_number: string;
            category?: string;
            keyword?: string;
            hospital_id?: string;
            from_date?: Date;
            to_date?: Date;
        }>(res);
        const userId = req.user?.userId;
        const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
        if (!doctor) { res.status(404).json({ message: 'Doctor not found' }); return; }

        const vault = await db.patient_vaults.findUnique({ where: { vault_number } });
        if (!vault) { res.status(404).json({ message: 'Vault not found' }); return; }

        const consent = await resolveConsent(vault.patient_id, doctor.doctor_id);

        if (!consent.hasConsent) {
            res.status(403).json({ message: 'No active consent found' });
            return;
        }

        // Narrow the permitted set by the requested category rather than
        // replacing it. Assigning `filters.category` directly would have let a
        // doctor read a blocked category simply by naming it in the query.
        const permitted =
            category && category !== 'ALL'
                ? [...consent.allowed].filter((allowed) => allowed === category)
                : [...consent.allowed];

        if (permitted.length === 0) {
            res.json([]);
            return;
        }

        const filters: any = {
            vault_id: vault.vault_id,
            is_deleted: false,
            category: { in: permitted as any }
        };

        if (hospital_id) filters.hospital_id = hospital_id;
        if (from_date || to_date) {
            filters.record_date = {};
            if (from_date) filters.record_date.gte = from_date;
            if (to_date) filters.record_date.lte = to_date;
        }
        if (keyword) {
            filters.OR = [
                { record_title: { contains: keyword, mode: 'insensitive' } },
                { diagnosis: { contains: keyword, mode: 'insensitive' } },
            ];
        }

        const records = await db.medical_records.findMany({
            where: filters,
            include: { doctors: true, hospitals: true }
        });

        res.json(records);
    } catch (error: any) {
        res.status(500).json({ message: 'Error searching records', error: error.message });
    }
};

export const flagRecord = async (req: AuthRequest, res: Response): Promise<void> => {
    const { record_id, flag_reason, reason_details } = req.body;
    const { userId, role } = requireUser(req);

    const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
    if (!doctor) { res.status(404).json({ message: 'Doctor not found' }); return; }

    const record = await db.medical_records.findUnique({
        where: { record_id },
        select: { record_id: true }
    });
    if (!record) {
        res.status(404).json({ message: 'Record not found' });
        return;
    }

    // A doctor may only flag a record they are entitled to see; otherwise the
    // endpoint would confirm the existence of records they cannot access.
    if (!(await canAccessRecord(userId, role, record_id))) {
        res.status(403).json({ message: 'You do not have access to this record' });
        return;
    }

    const flag = await db.record_flags.create({
        data: {
            record_id,
            flagged_by_user_id: userId,
            user_role: 'DOCTOR',
            flag_reason,
            reason_details
        }
    });

    await db.medical_records.update({
        where: { record_id },
        data: { flag_status: 'FLAGGED' }
    });

    res.status(201).json({ message: 'Record flagged successfully', flag });
};
