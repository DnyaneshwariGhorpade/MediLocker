import { Request, Response } from 'express';
import { db } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';

// POST /api/v1/emergency/initiate-request
export const initiateRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { identifier, emergency_reason } = req.body;
        const doctorId = req.user?.userId;

        const doctor = await db.doctors.findUnique({ where: { user_id: doctorId } });
        if (!doctor || !doctor.primary_hospital_id) {
            res.status(403).json({ message: 'Must be associated with a hospital' });
            return;
        }

        let patient = await db.patients.findFirst({
            where: {
                OR: [
                    { patient_vaults: { vault_number: identifier } },
                    { aadhaar_hash: identifier },
                    { users: { phone_number: identifier } }
                ]
            }
        });

        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        if (!patient.is_emergency_sharing_allowed) {
            res.status(403).json({ message: 'Patient has explicitly disabled emergency break-glass' });
            return;
        }

        const session = await db.break_glass_access_sessions.create({
            data: {
                patient_id: patient.patient_id,
                doctor_id: doctor.doctor_id,
                hospital_id: doctor.primary_hospital_id,
                emergency_reason,
                session_status: 'PENDING_APPROVAL',
                session_expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000) // Dummy default, overridden on approve
            }
        });

        res.status(201).json({ message: 'Emergency request sent to admin', session });
    } catch (error: any) {
        res.status(500).json({ message: 'Error initiating request', error: error.message });
    }
};

// GET /api/v1/emergency/pending-requests (For Hospital Admin)
export const getPendingRequests = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const hospital = await db.hospitals.findUnique({ where: { user_id: userId } });
        if (!hospital) { res.status(404).json({ message: 'Hospital not found' }); return; }

        const pending = await db.break_glass_access_sessions.findMany({
            where: { 
                hospital_id: hospital.hospital_id,
                session_status: 'PENDING_APPROVAL' 
            },
            include: { patients: { include: { patient_vaults: true } }, doctors: true },
            orderBy: { session_start_at: 'desc' }
        });

        res.json(pending);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching pending requests', error: error.message });
    }
};

// POST /api/v1/emergency/approve (For Hospital Admin)
export const approveRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { session_id, otp } = req.body;
        const userId = req.user?.userId;
        
        // Mock OTP validation
        if (otp !== '123456') {
            res.status(400).json({ message: 'Invalid Admin OTP' });
            return;
        }

        const session = await db.break_glass_access_sessions.update({
            where: { session_id },
            data: { 
                session_status: 'ACTIVE',
                hospital_admin_verifier_id: userId,
                session_start_at: new Date(),
                session_expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000) // Exactly 4 hours from now
            },
            include: { patients: true }
        });

        // Notify patient
        await db.notifications.create({
            data: {
                user_id: session.patients.user_id,
                event_type: 'EMERGENCY_ACCESS',
                title: 'EMERGENCY ACCESS TRIGGERED',
                message: 'A hospital administrator has authorized emergency break-glass access to your vault.',
                payload_json: { session_id }
            }
        });

        await db.break_glass_access_sessions.update({
            where: { session_id },
            data: { patient_notified: true, patient_notified_at: new Date() }
        });

        res.json({ message: 'Session approved and patient alerted', session });
    } catch (error: any) {
        res.status(500).json({ message: 'Error approving request', error: error.message });
    }
};

// POST /api/v1/emergency/terminate
export const terminateSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { session_id } = req.body;
        
        const session = await db.break_glass_access_sessions.update({
            where: { session_id },
            data: { session_status: 'TERMINATED', session_expires_at: new Date() }
        });

        res.json({ message: 'Session terminated immediately', session });
    } catch (error: any) {
        res.status(500).json({ message: 'Error terminating session', error: error.message });
    }
};

// GET /api/v1/emergency/session/:id/data
export const getSessionData = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const session = await db.break_glass_access_sessions.findUnique({
            where: { session_id: id },
            include: { patients: { include: { patient_vaults: true } } }
        });

        if (!session) { res.status(404).json({ message: 'Session not found' }); return; }

        if (session.session_status !== 'ACTIVE' || session.session_expires_at < new Date()) {
            res.status(403).json({ message: 'Session has expired or is inactive' });
            return;
        }

        const patientId = session.patient_id;

        const records = await db.medical_records.findMany({
            where: { patient_id: patientId, is_deleted: false },
            orderBy: { record_date: 'desc' }
        });

        const vitals = await db.patient_vitals.findMany({
            where: { patient_id: patientId },
            orderBy: { recorded_at: 'desc' },
            take: 10
        });

        // Simulating the snapshot metadata
        const snapshot = {
            allergies: ['Penicillin', 'Peanuts'],
            bloodGroup: session.patients.blood_group,
            chronicConditions: ['Type 2 Diabetes', 'Hypertension'],
            activeMedications: ['Metformin 500mg', 'Lisinopril 10mg']
        };

        // Log the access
        await db.break_glass_record_accesses.create({
            data: {
                session_id: session.session_id,
                record_id: records.length > 0 ? records[0].record_id : '00000000-0000-0000-0000-000000000000', // dummy if no records
            }
        });

        res.json({ session, snapshot, records, vitals });
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching session data', error: error.message });
    }
};
