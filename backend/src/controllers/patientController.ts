import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { db } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';

// GET /api/v1/patient/dashboard-summary
export const getDashboardSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const patient = await db.patients.findUnique({
            where: { user_id: userId },
            include: { patient_vaults: true }
        });

        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        // Active consents summary
        const activeConsentsCount = await db.consents.count({
            where: {
                patient_id: patient.patient_id,
                consent_status: 'ACTIVE',
                valid_until: { gt: new Date() }
            }
        });

        // Recent Timeline (Records + Consultations merged locally or just records)
        const recentRecords = await db.medical_records.findMany({
            where: { patient_id: patient.patient_id },
            orderBy: { created_at: 'desc' },
            take: 10,
            include: { doctors: true, hospitals: true }
        });

        // Follow-up reminders
        const upcomingConsultations = await db.consultations.findMany({
            where: {
                patient_id: patient.patient_id,
                follow_up_date: { gt: new Date() }
            },
            include: { doctors: true },
            orderBy: { follow_up_date: 'asc' },
            take: 5
        });

        res.json({
            profile: {
                name: `${patient.first_name} ${patient.last_name}`,
                blood_group: patient.blood_group,
                vault_id: patient.patient_vaults?.vault_number || 'PENDING',
                age: new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
            },
            timeline: recentRecords.map(r => ({
                id: r.record_id,
                title: r.record_title,
                category: r.category,
                date: r.record_date,
                doctor: r.doctors ? `Dr. ${r.doctors.first_name} ${r.doctors.last_name}` : null,
                hospital: r.hospitals?.hospital_name
            })),
            reminders: upcomingConsultations.map(c => ({
                id: c.consultation_id,
                date: c.follow_up_date,
                doctor: `Dr. ${c.doctors?.first_name} ${c.doctors?.last_name}`,
                reason: c.diagnosis_summary
            })),
            activeConsentsCount
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching dashboard summary', error: error.message });
    }
};

// GET /api/v1/patient/vitals/trends
export const getVitalsTrends = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const patient = await db.patients.findUnique({ where: { user_id: userId } });
        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        // Fetching last 30 days of vitals for trends
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let vitals = await db.patient_vitals.findMany({
            where: { 
                patient_id: patient.patient_id,
                recorded_at: { gte: thirtyDaysAgo }
            },
            orderBy: { recorded_at: 'asc' }
        });

        if (vitals.length === 0) {
            await autoSeedInitialVitals(patient.patient_id, patient.user_id);
            vitals = await db.patient_vitals.findMany({
                where: { 
                    patient_id: patient.patient_id,
                    recorded_at: { gte: thirtyDaysAgo }
                },
                orderBy: { recorded_at: 'asc' }
            });
        }

        res.json(vitals.map(v => ({
            ...v,
            metric_value: Number(v.metric_value)
        })));
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching vitals trends', error: error.message });
    }
};

// GET /api/v1/patient/vitals
export const getVitals = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const patient = await db.patients.findUnique({ where: { user_id: userId } });
        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        let vitals = await db.patient_vitals.findMany({
            where: { patient_id: patient.patient_id },
            orderBy: { recorded_at: 'desc' }
        });

        if (vitals.length === 0) {
            await autoSeedInitialVitals(patient.patient_id, patient.user_id);
            vitals = await db.patient_vitals.findMany({
                where: { patient_id: patient.patient_id },
                orderBy: { recorded_at: 'desc' }
            });
        }

        res.json(vitals.map(v => ({
            ...v,
            metric_value: Number(v.metric_value)
        })));
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching vitals', error: error.message });
    }
};

// POST /api/v1/patient/vitals
export const addVital = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const patient = await db.patients.findUnique({ where: { user_id: userId } });
        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        const { metric_type, metric_value, metric_unit, reading_context } = req.body;

        const newVital = await db.patient_vitals.create({
            data: {
                patient_id: patient.patient_id,
                recorded_by_user_id: patient.user_id,
                metric_type,
                metric_value: new Prisma.Decimal(metric_value),
                metric_unit,
                reading_context: reading_context || 'Routine'
            }
        });

        res.status(201).json({
            ...newVital,
            metric_value: Number(newVital.metric_value)
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error adding vital', error: error.message });
    }
};

// GET /api/v1/patient/consultations
export const getConsultations = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const patient = await db.patients.findUnique({ where: { user_id: userId } });
        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        const consultations = await db.consultations.findMany({
            where: { patient_id: patient.patient_id },
            include: { 
                doctors: true,
                hospitals: true
            },
            orderBy: { consultation_date: 'desc' }
        });

        res.json(consultations);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching consultations', error: error.message });
    }
};

// GET /api/v1/patient/profile
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const patient = await db.patients.findUnique({ 
            where: { user_id: userId },
            include: { users: true, patient_vaults: true }
        });
        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        res.json({
            first_name: patient.first_name,
            last_name: patient.last_name,
            email: patient.users.email,
            phone: patient.users.phone_number,
            address: patient.address_line,
            city: patient.city,
            state: patient.state,
            pincode: patient.pincode,
            blood_group: patient.blood_group,
            gender: patient.gender,
            date_of_birth: patient.date_of_birth,
            vault_number: patient.patient_vaults?.vault_number || 'PENDING',
            emergency_contact_name: patient.emergency_contact_name,
            emergency_contact_phone: patient.emergency_contact_phone,
            emergency_contact_relation: patient.emergency_contact_relation,
            is_emergency_sharing_allowed: patient.is_emergency_sharing_allowed
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching profile', error: error.message });
    }
};

// PUT /api/v1/patient/profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const { address_line, city, state, pincode } = req.body;
        
        await db.patients.update({
            where: { user_id: userId },
            data: { address_line, city, state, pincode }
        });

        res.json({ message: 'Profile updated successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
};

// PUT /api/v1/patient/emergency-settings
export const updateEmergencySettings = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const { emergency_contact_name, emergency_contact_phone, emergency_contact_relation, is_emergency_sharing_allowed } = req.body;
        
        await db.patients.update({
            where: { user_id: userId },
            data: { 
                emergency_contact_name, 
                emergency_contact_phone, 
                emergency_contact_relation, 
                is_emergency_sharing_allowed 
            }
        });

        res.json({ message: 'Emergency settings updated successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating emergency settings', error: error.message });
    }
};

// GET /api/v1/patient/doctors
export const getVerifiedDoctors = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const doctors = await db.doctors.findMany({
            where: { verification_status: 'VERIFIED' },
            include: { hospitals: { select: { hospital_name: true } } },
            orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }]
        });

        res.json(
            doctors.map((d) => ({
                doctor_id: d.doctor_id,
                first_name: d.first_name,
                last_name: d.last_name,
                specialization: d.specialization,
                qualification: d.qualification,
                mrn: d.mrn,
                hospital_name: d.hospitals?.hospital_name || 'Independent Practice'
            }))
        );
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching verified doctors', error: error.message });
    }
};

export const autoSeedInitialVitals = async (patientId: string, userId: string): Promise<void> => {
    const sampleReadings = [
        { metric_type: 'BP_SYSTOLIC', metric_value: 124, metric_unit: 'mmHg', reading_context: 'Morning Baseline', daysAgo: 6 },
        { metric_type: 'BP_DIASTOLIC', metric_value: 82, metric_unit: 'mmHg', reading_context: 'Morning Baseline', daysAgo: 6 },
        { metric_type: 'FASTING_SUGAR', metric_value: 95, metric_unit: 'mg/dL', reading_context: 'Fasting', daysAgo: 6 },
        { metric_type: 'PULSE', metric_value: 74, metric_unit: 'bpm', reading_context: 'Resting', daysAgo: 6 },
        { metric_type: 'SPO2', metric_value: 98, metric_unit: '%', reading_context: 'Resting', daysAgo: 6 },
        { metric_type: 'TEMPERATURE', metric_value: 98.4, metric_unit: '°F', reading_context: 'Resting', daysAgo: 6 },

        { metric_type: 'BP_SYSTOLIC', metric_value: 121, metric_unit: 'mmHg', reading_context: 'Routine Check', daysAgo: 4 },
        { metric_type: 'BP_DIASTOLIC', metric_value: 80, metric_unit: 'mmHg', reading_context: 'Routine Check', daysAgo: 4 },
        { metric_type: 'FASTING_SUGAR', metric_value: 92, metric_unit: 'mg/dL', reading_context: 'Fasting', daysAgo: 4 },
        { metric_type: 'PULSE', metric_value: 71, metric_unit: 'bpm', reading_context: 'Resting', daysAgo: 4 },
        { metric_type: 'SPO2', metric_value: 99, metric_unit: '%', reading_context: 'Resting', daysAgo: 4 },

        { metric_type: 'BP_SYSTOLIC', metric_value: 119, metric_unit: 'mmHg', reading_context: 'Routine Check', daysAgo: 2 },
        { metric_type: 'BP_DIASTOLIC', metric_value: 78, metric_unit: 'mmHg', reading_context: 'Routine Check', daysAgo: 2 },
        { metric_type: 'FASTING_SUGAR', metric_value: 89, metric_unit: 'mg/dL', reading_context: 'Fasting', daysAgo: 2 },
        { metric_type: 'PULSE', metric_value: 73, metric_unit: 'bpm', reading_context: 'Post-walk', daysAgo: 2 },
        { metric_type: 'SPO2', metric_value: 99, metric_unit: '%', reading_context: 'Resting', daysAgo: 2 },
        { metric_type: 'TEMPERATURE', metric_value: 98.6, metric_unit: '°F', reading_context: 'Routine', daysAgo: 2 },

        { metric_type: 'BP_SYSTOLIC', metric_value: 118, metric_unit: 'mmHg', reading_context: 'Resting Baseline', daysAgo: 1 },
        { metric_type: 'BP_DIASTOLIC', metric_value: 77, metric_unit: 'mmHg', reading_context: 'Resting Baseline', daysAgo: 1 },
        { metric_type: 'FASTING_SUGAR', metric_value: 91, metric_unit: 'mg/dL', reading_context: 'Fasting', daysAgo: 1 },
        { metric_type: 'PULSE', metric_value: 69, metric_unit: 'bpm', reading_context: 'Resting', daysAgo: 1 },
        { metric_type: 'SPO2', metric_value: 99, metric_unit: '%', reading_context: 'Resting', daysAgo: 1 },
        { metric_type: 'WEIGHT', metric_value: 68.5, metric_unit: 'kg', reading_context: 'Morning Weigh-in', daysAgo: 1 },

        { metric_type: 'BP_SYSTOLIC', metric_value: 120, metric_unit: 'mmHg', reading_context: 'Resting Baseline', daysAgo: 0 },
        { metric_type: 'BP_DIASTOLIC', metric_value: 80, metric_unit: 'mmHg', reading_context: 'Resting Baseline', daysAgo: 0 },
        { metric_type: 'FASTING_SUGAR', metric_value: 90, metric_unit: 'mg/dL', reading_context: 'Fasting', daysAgo: 0 },
        { metric_type: 'PULSE', metric_value: 71, metric_unit: 'bpm', reading_context: 'Resting', daysAgo: 0 },
        { metric_type: 'SPO2', metric_value: 99, metric_unit: '%', reading_context: 'Resting', daysAgo: 0 },
        { metric_type: 'TEMPERATURE', metric_value: 98.5, metric_unit: '°F', reading_context: 'Resting', daysAgo: 0 },
    ];

    for (const item of sampleReadings) {
        const recordedAt = new Date();
        recordedAt.setDate(recordedAt.getDate() - item.daysAgo);

        await db.patient_vitals.create({
            data: {
                patient_id: patientId,
                recorded_by_user_id: userId,
                metric_type: item.metric_type,
                metric_value: new Prisma.Decimal(item.metric_value),
                metric_unit: item.metric_unit,
                reading_context: item.reading_context,
                recorded_at: recordedAt
            }
        });
    }
};

// POST /api/v1/patient/vitals/sample
export const seedSampleVitals = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const patient = await db.patients.findUnique({ where: { user_id: userId } });
        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        await autoSeedInitialVitals(patient.patient_id, patient.user_id);
        res.json({ message: 'Sample telemetry data populated successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error populating sample vitals', error: error.message });
    }
};
