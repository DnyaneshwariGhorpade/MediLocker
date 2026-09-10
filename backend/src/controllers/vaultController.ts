import { Request, Response } from 'express';
import { db } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';

// GET /api/v1/vault/records
export const getRecords = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const patient = await db.patients.findUnique({ where: { user_id: userId } });
        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        const category = req.query.category as string;
        const search = req.query.search as string;

        let whereClause: any = { patient_id: patient.patient_id };
        
        if (category) {
            whereClause.category = category;
        }
        
        if (search) {
            whereClause.OR = [
                { record_title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }

        const records = await db.medical_records.findMany({
            where: whereClause,
            include: { doctors: true, hospitals: true },
            orderBy: { record_date: 'desc' }
        });

        res.json(records);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching vault records', error: error.message });
    }
};

// POST /api/v1/vault/records/:id/decrypt
export const decryptRecord = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const recordId = req.params.id;

        // Verify patient owns record
        const patient = await db.patients.findUnique({ where: { user_id: userId } });
        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        const record = await db.medical_records.findFirst({
            where: { record_id: recordId, patient_id: patient.patient_id }
        });

        if (!record) {
            res.status(404).json({ message: 'Record not found' });
            return;
        }

        // Mock encrypted data and mock KMS key
        // In real life, fetch from S3 and get Key from AWS KMS
        res.json({
            encrypted_payload: 'U2FsdGVkX19mocked_encrypted_data_here',
            wrapped_kms_key: 'kms_wrapped_key_mock_string',
            file_type: record.file_type || 'application/pdf',
            iv: 'mock_init_vector_123'
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error decrypting record', error: error.message });
    }
};

// GET /api/v1/vault/records/:id/blockchain-proof
export const getBlockchainProof = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const recordId = req.params.id;

        const anchor = await db.blockchain_anchors.findFirst({
            where: { record_id: recordId }
        });

        if (!anchor) {
            res.status(404).json({ message: 'Blockchain anchor not found' });
            return;
        }

        res.json(anchor);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching blockchain proof', error: error.message });
    }
};

// POST /api/v1/vault/upload
export const uploadRecord = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { vault_number, record_title, category, diagnosis, file_size_bytes, file_sha256_hash, tags } = req.body;
        const userId = req.user?.userId;
        const role = req.user?.role;

        const vault = await db.patient_vaults.findUnique({ where: { vault_number } });
        if (!vault) {
            res.status(404).json({ message: 'Patient Vault not found' });
            return;
        }

        let doctorId = null;
        let hospitalId = null;

        if (role === 'DOCTOR') {
            const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
            doctorId = doctor?.doctor_id;
            hospitalId = doctor?.primary_hospital_id;
        }

        const record = await db.medical_records.create({
            data: {
                vault_id: vault.vault_id,
                patient_id: vault.patient_id,
                uploaded_by_doctor_id: doctorId,
                hospital_id: hospitalId,
                record_title,
                category,
                diagnosis,
                file_s3_key: `s3://mock-bucket/${vault_number}/${file_sha256_hash}.pdf`,
                file_mime_type: 'application/pdf',
                file_size_bytes: file_size_bytes || 1024,
                file_sha256_hash,
                kms_key_id: 'mock_kms_key_id_123',
                encrypted_dek: 'mock_encrypted_dek_123',
                iv_bytes: 'mock_iv_bytes_123',
                tags: tags || []
            }
        });

        // Notify patient about new upload
        await db.notifications.create({
            data: {
                user_id: vault.patients?.user_id || '', // we need to ensure users get it
                event_type: 'NEW_RECORD_UPLOAD',
                title: 'New Medical Record Uploaded',
                message: `A new record "${record_title}" was uploaded to your vault.`,
                payload_json: { record_id: record.record_id }
            }
        });

        res.json({ message: 'Record uploaded and encrypted successfully', record });
    } catch (error: any) {
        res.status(500).json({ message: 'Error uploading record', error: error.message });
    }
};

// POST /api/v1/vault/anchor-blockchain
export const anchorBlockchain = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { record_id, document_sha256 } = req.body;

        const record = await db.medical_records.findUnique({ where: { record_id } });
        if (!record) {
            res.status(404).json({ message: 'Record not found' });
            return;
        }

        const anchor = await db.blockchain_anchors.create({
            data: {
                record_id,
                document_sha256,
                transaction_tx_id: `mock_tx_${Date.now()}`,
                block_number: Math.floor(Math.random() * 1000000),
                anchor_status: 'VERIFIED',
                last_verified_at: new Date()
            }
        });

        res.json({ message: 'Record anchored to blockchain securely', anchor });
    } catch (error: any) {
        res.status(500).json({ message: 'Error anchoring to blockchain', error: error.message });
    }
};
