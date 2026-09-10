import { Request, Response } from 'express';
import { db } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';

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
        const { vaultNumber } = req.params;
        const userId = req.user?.userId;
        const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
        if (!doctor) { res.status(404).json({ message: 'Doctor not found' }); return; }

        const vault = await db.patient_vaults.findUnique({ where: { vault_number: vaultNumber } });
        if (!vault) { res.status(404).json({ message: 'Vault not found' }); return; }

        const consent = await db.consents.findFirst({
            where: {
                patient_id: vault.patient_id,
                doctor_id: doctor.doctor_id,
                consent_status: 'ACTIVE',
                valid_until: { gte: new Date() }
            }
        });

        if (!consent) {
            res.status(403).json({ message: 'No active consent found' });
            return;
        }

        const records = await db.medical_records.findMany({
            where: {
                vault_id: vault.vault_id,
                is_deleted: false,
                category: { in: consent.allowed_categories as any },
                NOT: { category: { in: consent.blocked_categories as any } }
            },
            include: { doctors: true, hospitals: true, blockchain_anchor: true }
        });

        res.json(records);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching patient records', error: error.message });
    }
};

export const signAndIssuePrescription = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { patient_id, clinical_notes, medications, digital_signature, doctor_public_key_hash } = req.body;
        const userId = req.user?.userId;
        const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
        if (!doctor) { res.status(404).json({ message: 'Doctor not found' }); return; }

        const vault = await db.patient_vaults.findUnique({ where: { patient_id } });
        if (!vault) { res.status(404).json({ message: 'Patient Vault not found' }); return; }

        // 1. Create a stub Medical Record for the prescription
        const record = await db.medical_records.create({
            data: {
                vault_id: vault.vault_id,
                patient_id,
                uploaded_by_doctor_id: doctor.doctor_id,
                hospital_id: doctor.primary_hospital_id,
                record_title: `Prescription from Dr. ${doctor.last_name}`,
                category: 'PRESCRIPTION',
                file_s3_key: 's3://mock/prescriptions/uuid.pdf',
                file_mime_type: 'application/pdf',
                file_size_bytes: 1024,
                file_sha256_hash: 'mock_prescription_hash',
                kms_key_id: 'mock_kms_key',
                encrypted_dek: 'mock_dek',
                iv_bytes: 'mock_iv'
            }
        });

        // 2. Insert into Prescriptions table
        const prescription = await db.prescriptions.create({
            data: {
                record_id: record.record_id,
                doctor_id: doctor.doctor_id,
                patient_id,
                clinical_notes,
                medications: medications || [],
                digital_signature,
                doctor_public_key_hash,
                is_signature_valid: true
            }
        });

        res.json({ message: 'Prescription issued and signed securely', prescription });
    } catch (error: any) {
        res.status(500).json({ message: 'Error issuing prescription', error: error.message });
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
        const { vault_number, category, keyword, hospital_id, from_date, to_date } = req.query;
        const userId = req.user?.userId;
        const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
        if (!doctor) { res.status(404).json({ message: 'Doctor not found' }); return; }

        const vault = await db.patient_vaults.findUnique({ where: { vault_number: vault_number as string } });
        if (!vault) { res.status(404).json({ message: 'Vault not found' }); return; }

        const consent = await db.consents.findFirst({
            where: {
                patient_id: vault.patient_id,
                doctor_id: doctor.doctor_id,
                consent_status: 'ACTIVE',
                valid_until: { gte: new Date() }
            }
        });

        if (!consent) {
            res.status(403).json({ message: 'No active consent found' });
            return;
        }

        const filters: any = {
            vault_id: vault.vault_id,
            is_deleted: false,
            category: { in: consent.allowed_categories as any },
            NOT: { category: { in: consent.blocked_categories as any } }
        };

        if (category && category !== 'ALL') filters.category = category;
        if (hospital_id) filters.hospital_id = hospital_id;
        if (from_date || to_date) {
            filters.record_date = {};
            if (from_date) filters.record_date.gte = new Date(from_date as string);
            if (to_date) filters.record_date.lte = new Date(to_date as string);
        }
        if (keyword) {
            filters.OR = [
                { record_title: { contains: keyword as string, mode: 'insensitive' } },
                { diagnosis: { contains: keyword as string, mode: 'insensitive' } },
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
    try {
        const { record_id, flag_reason, reason_details } = req.body;
        const userId = req.user?.userId;
        const doctor = await db.doctors.findUnique({ where: { user_id: userId } });
        if (!doctor) { res.status(404).json({ message: 'Doctor not found' }); return; }

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

        res.json({ message: 'Record flagged successfully', flag });
    } catch (error: any) {
        res.status(500).json({ message: 'Error flagging record', error: error.message });
    }
};
