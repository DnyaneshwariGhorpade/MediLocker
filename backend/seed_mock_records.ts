import { db } from './src/services/db';
import crypto from 'crypto';

async function seedRecords() {
    console.log('Fetching patients, doctors, and hospitals...');
    const patients = await db.patients.findMany({ include: { patient_vaults: true }, take: 100 });
    const doctors = await db.doctors.findMany({ take: 50 });
    const hospitals = await db.hospitals.findMany();

    if (patients.length === 0 || doctors.length === 0 || hospitals.length === 0) {
        console.error('Please run seed_mock_data.ts first');
        return;
    }

    console.log(`Found ${patients.length} patients, ${doctors.length} doctors, ${hospitals.length} hospitals`);

    const categories = ['PRESCRIPTION', 'BLOOD_REPORT', 'X_RAY', 'MRI', 'CT_SCAN', 'VACCINATION_RECORD'];
    
    // Clear old records first
    console.log('Clearing old mock records, consultations, vitals...');
    await db.medical_records.deleteMany({});
    await db.consultations.deleteMany({});
    await db.patient_vitals.deleteMany({});
    await db.consents.deleteMany({});
    await db.notifications.deleteMany({});
    
    console.log('Seeding mock records...');

    for (let i = 0; i < patients.length; i++) {
        const patient = patients[i];
        const doctor = doctors[i % doctors.length];
        const hospital = hospitals[i % hospitals.length];

        if (!patient.patient_vaults) continue;

        // Vitals - Multi-metric timeline
        const vitalsToSeed = [
            { metric_type: 'BP_SYSTOLIC', metric_value: 120 + (i % 6) * 2, metric_unit: 'mmHg', reading_context: 'Morning Baseline', daysAgo: 5 },
            { metric_type: 'BP_DIASTOLIC', metric_value: 80 + (i % 4), metric_unit: 'mmHg', reading_context: 'Morning Baseline', daysAgo: 5 },
            { metric_type: 'FASTING_SUGAR', metric_value: 92 + (i % 8), metric_unit: 'mg/dL', reading_context: 'Fasting', daysAgo: 5 },
            { metric_type: 'PULSE', metric_value: 70 + (i % 10), metric_unit: 'bpm', reading_context: 'Resting', daysAgo: 5 },
            { metric_type: 'SPO2', metric_value: 98 + (i % 2), metric_unit: '%', reading_context: 'Resting', daysAgo: 5 },
            { metric_type: 'TEMPERATURE', metric_value: 98.4, metric_unit: '°F', reading_context: 'Routine', daysAgo: 5 },

            { metric_type: 'BP_SYSTOLIC', metric_value: 118 + (i % 5) * 2, metric_unit: 'mmHg', reading_context: 'Routine Checkup', daysAgo: 2 },
            { metric_type: 'BP_DIASTOLIC', metric_value: 78 + (i % 3), metric_unit: 'mmHg', reading_context: 'Routine Checkup', daysAgo: 2 },
            { metric_type: 'FASTING_SUGAR', metric_value: 90 + (i % 5), metric_unit: 'mg/dL', reading_context: 'Fasting', daysAgo: 2 },
            { metric_type: 'PULSE', metric_value: 72 + (i % 6), metric_unit: 'bpm', reading_context: 'Resting', daysAgo: 2 },
            { metric_type: 'SPO2', metric_value: 99, metric_unit: '%', reading_context: 'Resting', daysAgo: 2 },

            { metric_type: 'BP_SYSTOLIC', metric_value: 122 + (i % 4), metric_unit: 'mmHg', reading_context: 'Routine Checkup', daysAgo: 0 },
            { metric_type: 'BP_DIASTOLIC', metric_value: 80 + (i % 2), metric_unit: 'mmHg', reading_context: 'Routine Checkup', daysAgo: 0 },
            { metric_type: 'FASTING_SUGAR', metric_value: 89 + (i % 4), metric_unit: 'mg/dL', reading_context: 'Fasting', daysAgo: 0 },
            { metric_type: 'PULSE', metric_value: 71 + (i % 5), metric_unit: 'bpm', reading_context: 'Resting', daysAgo: 0 },
            { metric_type: 'SPO2', metric_value: 99, metric_unit: '%', reading_context: 'Resting', daysAgo: 0 },
            { metric_type: 'WEIGHT', metric_value: 68.0 + (i % 5), metric_unit: 'kg', reading_context: 'Routine', daysAgo: 0 },
            { metric_type: 'TEMPERATURE', metric_value: 98.6, metric_unit: '°F', reading_context: 'Resting', daysAgo: 0 },
        ];

        for (const v of vitalsToSeed) {
            const recordedAt = new Date();
            recordedAt.setDate(recordedAt.getDate() - v.daysAgo);
            await db.patient_vitals.create({
                data: {
                    patient_id: patient.patient_id,
                    recorded_by_user_id: doctor.user_id,
                    metric_type: v.metric_type,
                    metric_value: v.metric_value,
                    metric_unit: v.metric_unit,
                    reading_context: v.reading_context,
                    recorded_at: recordedAt
                }
            });
        }

        // Consultation
        await db.consultations.create({
            data: {
                patient_id: patient.patient_id,
                doctor_id: doctor.doctor_id,
                hospital_id: hospital.hospital_id,
                chief_complaint: 'Routine follow up',
                diagnosis_summary: 'Healthy',
                consultation_status: 'COMPLETED'
            }
        });

        // Consents
        await db.consents.create({
            data: {
                patient_id: patient.patient_id,
                doctor_id: doctor.doctor_id,
                hospital_id: hospital.hospital_id,
                allowed_categories: ['PRESCRIPTION', 'BLOOD_REPORT'],
                blocked_categories: ['PSYCHIATRIC_REPORT'],
                access_level: 'READ_WRITE',
                consent_status: 'ACTIVE',
                valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                consent_token_hash: crypto.randomBytes(32).toString('hex')
            }
        });

        // Medical Records
        const numRecords = (i % 3) + 1; // 1 to 3 records
        for (let j = 0; j < numRecords; j++) {
            const category = categories[(i + j) % categories.length];
            
            const record = await db.medical_records.create({
                data: {
                    vault_id: patient.patient_vaults.vault_id,
                    patient_id: patient.patient_id,
                    uploaded_by_doctor_id: doctor.doctor_id,
                    hospital_id: hospital.hospital_id,
                    record_title: `Mock ${category} - ${j + 1}`,
                    category: category as any,
                    is_sensitive: false,
                    diagnosis: 'Routine check',
                    file_s3_key: `mock/path/to/${crypto.randomUUID()}.pdf`,
                    file_mime_type: 'application/pdf',
                    file_size_bytes: BigInt(Math.floor(Math.random() * 5000000) + 100000), // 100kb to 5mb
                    file_sha256_hash: crypto.randomBytes(32).toString('hex'),
                    kms_key_id: 'mock-kms-key-id',
                    encrypted_dek: crypto.randomBytes(64).toString('base64'),
                    iv_bytes: crypto.randomBytes(16).toString('hex'),
                    storage_driver: 'MOCK',
                    encryption_algorithm: 'AES_256_GCM'
                }
            });

            if (category === 'PRESCRIPTION') {
                await db.prescriptions.create({
                    data: {
                        record_id: record.record_id,
                        doctor_id: doctor.doctor_id,
                        patient_id: patient.patient_id,
                        clinical_notes: 'Take 2 pills daily',
                        medications: JSON.parse('[{"name": "Paracetamol", "dosage": "500mg"}]'),
                        digital_signature: crypto.randomBytes(64).toString('base64'),
                        doctor_public_key_hash: crypto.randomBytes(32).toString('hex')
                    }
                });
            }
        }

        // Notification
        await db.notifications.create({
            data: {
                user_id: patient.user_id,
                event_type: 'NEW_RECORD_UPLOAD',
                channel: 'IN_APP',
                title: 'New Medical Record Uploaded',
                message: `Dr. ${doctor.first_name} uploaded a new record.`
            }
        });
    }

    console.log('Mock records seeded successfully!');
    await db.$disconnect();
}

seedRecords().catch((e) => {
    console.error(e);
    process.exit(1);
});
