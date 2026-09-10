import { Request, Response } from 'express';
import { db } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getDashboardSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const hospital = await db.hospitals.findUnique({ where: { user_id: userId } });
        
        if (!hospital) {
            res.status(404).json({ message: 'Hospital not found' });
            return;
        }

        const verifiedDoctorsCount = await db.doctors.count({
            where: { 
                primary_hospital_id: hospital.hospital_id,
                verification_status: 'VERIFIED'
            }
        });

        // Mock today's bulk HMS uploads (since we don't have a direct field, we'll query records by hospital)
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const uploadsToday = await db.medical_records.count({
            where: {
                hospital_id: hospital.hospital_id,
                created_at: { gte: today }
            }
        });

        const activeAdmittedPatients = await db.consultations.groupBy({
            by: ['patient_id'],
            where: {
                hospital_id: hospital.hospital_id,
                consultation_status: 'COMPLETED'
            }
        });

        const openDisputes = await db.record_flags.count({
            where: {
                medical_records: { hospital_id: hospital.hospital_id },
                flag_lifecycle_status: 'FLAGGED'
            }
        });

        // Recent Break-Glass approvals
        const recentBreakGlass = await db.break_glass_access_sessions.findMany({
            where: { hospital_id: hospital.hospital_id },
            orderBy: { session_start_at: 'desc' },
            take: 5,
            include: { patients: true, doctors: true }
        });

        // Recent staff verifications
        const recentDoctors = await db.doctors.findMany({
            where: { primary_hospital_id: hospital.hospital_id },
            orderBy: { updated_at: 'desc' },
            take: 5
        });

        res.json({
            hospital: {
                name: hospital.hospital_name,
                type: hospital.hospital_type,
                id: hospital.hospital_id
            },
            metrics: {
                verifiedDoctors: verifiedDoctorsCount,
                hmsUploadsToday: uploadsToday,
                admittedPatients: activeAdmittedPatients.length,
                openDisputes
            },
            recentBreakGlass,
            recentDoctors
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching hospital dashboard', error: error.message });
    }
};

export const getDoctors = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const hospital = await db.hospitals.findUnique({ where: { user_id: userId } });
        if (!hospital) { res.status(404).json({ message: 'Hospital not found' }); return; }

        const doctors = await db.doctors.findMany({
            where: { primary_hospital_id: hospital.hospital_id },
            orderBy: { created_at: 'desc' }
        });

        res.json(doctors);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching doctors', error: error.message });
    }
};

export const approveDoctor = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const doctorId = req.params.id;
        const hospital = await db.hospitals.findUnique({ where: { user_id: userId } });
        if (!hospital) { res.status(404).json({ message: 'Hospital not found' }); return; }

        const doctor = await db.doctors.update({
            where: { doctor_id: doctorId, primary_hospital_id: hospital.hospital_id },
            data: { verification_status: 'VERIFIED' }
        });

        res.json({ message: 'Doctor verified successfully', doctor });
    } catch (error: any) {
        res.status(500).json({ message: 'Error approving doctor', error: error.message });
    }
};

export const revokeDoctor = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const doctorId = req.params.id;
        const hospital = await db.hospitals.findUnique({ where: { user_id: userId } });
        if (!hospital) { res.status(404).json({ message: 'Hospital not found' }); return; }

        const doctor = await db.doctors.update({
            where: { doctor_id: doctorId, primary_hospital_id: hospital.hospital_id },
            data: { verification_status: 'REVOKED' }
        });

        res.json({ message: 'Doctor revoked successfully', doctor });
    } catch (error: any) {
        res.status(500).json({ message: 'Error revoking doctor', error: error.message });
    }
};
