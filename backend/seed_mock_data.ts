import { db } from './src/services/db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import fs from 'fs';

function generateDoctorKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'P-256',
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    
    // Hash the public key to create a unique fingerprint
    const fingerprint = crypto.createHash('sha256').update(publicKey).digest('hex');
    
    return { publicKey, privateKey, fingerprint };
}

async function seedData() {
    const patientsData = JSON.parse(fs.readFileSync('./mock_patients.json', 'utf-8')).patients;
    const hospDocData = JSON.parse(fs.readFileSync('./mock_hospitals_doctors.json', 'utf-8'));
    const hospitalsData = hospDocData.hospitals;
    const doctorsMap = hospDocData.doctors;

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('password123', saltRounds);

    console.log('Truncating database before seeding...');
    await db.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable');
    await db.$executeRawUnsafe('TRUNCATE TABLE users CASCADE');
    await db.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable');

    console.log('Seeding hospitals...');
    const hospitalIdMap: Record<string, string> = {}; // registration_number -> hospital_id
    
    for (const h of hospitalsData) {
        const user = await db.users.create({
            data: {
                email: h.email,
                phone_number: h.phone_number,
                password_hash: passwordHash,
                user_role: 'HOSPITAL_ADMIN'
            }
        });

        const hospital = await db.hospitals.create({
            data: {
                user_id: user.user_id,
                hospital_name: h.hospital_name,
                registration_number: h.registration_number,
                hospital_type: h.hospital_type,
                contact_email: h.contact_email,
                contact_phone: h.contact_phone,
                address: h.address_line || "Main Address",
                city: h.city,
                state: h.state,
                pincode: h.pincode
            }
        });
        hospitalIdMap[h.registration_number] = hospital.hospital_id;
    }

    console.log('Seeding doctors...');
    for (const [registration_number, doctorsList] of Object.entries(doctorsMap)) {
        const hospitalId = hospitalIdMap[registration_number];
        if (!hospitalId) {
            console.error(`Hospital not found for registration_number: ${registration_number}`);
            continue;
        }

        for (const d of doctorsList as any[]) {
            const user = await db.users.create({
                data: {
                    email: d.email,
                    phone_number: d.phone_number,
                    password_hash: passwordHash,
                    user_role: 'DOCTOR'
                }
            });

            const keys = generateDoctorKeyPair();

            await db.doctors.create({
                data: {
                    user_id: user.user_id,
                    primary_hospital_id: hospitalId,
                    mrn: d.mrn,
                    state_medical_council: d.state_medical_council,
                    first_name: d.first_name,
                    last_name: d.last_name,
                    specialization: d.specialization,
                    qualification: d.qualification,
                    public_key_pem: keys.publicKey,
                    key_fingerprint: keys.fingerprint,
                    verification_status: 'VERIFIED', // Auto verify mock doctors
                    govt_id_document_url: 'dummy-url'
                }
            });
        }
    }

    console.log('Seeding patients...');
    for (const p of patientsData) {
        const user = await db.users.create({
            data: {
                email: p.email,
                phone_number: p.phone_number,
                password_hash: passwordHash,
                user_role: 'PATIENT'
            }
        });

        const patient = await db.patients.create({
            data: {
                user_id: user.user_id,
                aadhaar_hash: p.aadhaar_hash,
                first_name: p.first_name,
                last_name: p.last_name,
                date_of_birth: new Date(p.date_of_birth),
                gender: p.gender,
                blood_group: p.blood_group,
                address_line: p.address_line,
                city: p.city,
                state: p.state,
                pincode: p.pincode,
                emergency_contact_name: p.emergency_contact_name,
                emergency_contact_phone: p.emergency_contact_phone,
                emergency_contact_relation: p.emergency_contact_relation,
                is_emergency_sharing_allowed: p.is_emergency_sharing_allowed
            }
        });

        await db.patient_vaults.create({
            data: {
                patient_id: patient.patient_id,
                vault_number: `VAULT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
                encryption_salt: crypto.randomBytes(32).toString('hex'),
                vault_status: 'ACTIVE'
            }
        });
    }

    console.log('Mock data seeded successfully!');
    await db.$disconnect();
}

seedData().catch((error) => {
    console.error(error);
    process.exit(1);
});
