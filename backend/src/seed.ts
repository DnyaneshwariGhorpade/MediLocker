import { db } from './services/db';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('Seeding database...');
    
    // Clear existing data for a clean slate
    console.log('Clearing old data...');
    await db.medical_records.deleteMany();
    await db.patient_vaults.deleteMany();
    await db.patients.deleteMany();
    await db.doctors.deleteMany();
    await db.hospitals.deleteMany();
    await db.users.deleteMany();

    const password_hash = await bcrypt.hash('password123', 10);

    // 1. Create 2 Hospitals
    console.log('Creating Hospitals...');
    const hospitals = [];
    for (let i = 1; i <= 2; i++) {
        const user = await db.users.create({
            data: {
                email: `hospital${i}@medilocker.com`,
                phone_number: `900000000${i}`,
                password_hash,
                user_role: 'HOSPITAL_ADMIN',
                account_status: 'ACTIVE'
            }
        });

        const hospital = await db.hospitals.create({
            data: {
                user_id: user.user_id,
                hospital_name: `City General Hospital ${i}`,
                registration_number: `HOSP-REG-${1000 + i}`,
                hospital_type: 'MULTI_SPECIALTY',
                contact_email: `contact@hospital${i}.com`,
                contact_phone: `900000000${i}`,
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001',
                verification_status: 'VERIFIED'
            }
        });
        hospitals.push(hospital);
    }

    // 2. Create 4 Doctors
    console.log('Creating Doctors...');
    const doctors = [];
    for (let i = 1; i <= 4; i++) {
        const user = await db.users.create({
            data: {
                email: `doctor${i}@medilocker.com`,
                phone_number: `800000000${i}`,
                password_hash,
                user_role: 'DOCTOR',
                account_status: 'ACTIVE'
            }
        });

        const doctor = await db.doctors.create({
            data: {
                user_id: user.user_id,
                primary_hospital_id: hospitals[i % 2].hospital_id,
                mrn: `MRN-${2000 + i}`,
                state_medical_council: 'Maharashtra Medical Council',
                first_name: `Doc${i}`,
                last_name: 'Smith',
                specialization: i % 2 === 0 ? 'Cardiologist' : 'General Physician',
                qualification: 'MBBS, MD',
                public_key_pem: 'DUMMY_PUB_KEY',
                key_fingerprint: `FINGERPRINT-${i}`,
                verification_status: 'VERIFIED'
            }
        });
        doctors.push(doctor);
    }

    // 3. Create 10 Patients
    console.log('Creating Patients...');
    for (let i = 1; i <= 10; i++) {
        const user = await db.users.create({
            data: {
                email: `patient${i}@medilocker.com`,
                phone_number: `70000000${i.toString().padStart(2, '0')}`,
                password_hash,
                user_role: 'PATIENT',
                account_status: 'ACTIVE'
            }
        });

        const patient = await db.patients.create({
            data: {
                user_id: user.user_id,
                aadhaar_hash: `AADHAAR-HASH-${i}`,
                first_name: `Patient${i}`,
                last_name: 'Doe',
                date_of_birth: new Date('1990-01-01'),
                gender: i % 2 === 0 ? 'FEMALE' : 'MALE',
                blood_group: 'O+'
            }
        });

        // Create vault for each patient
        await db.patient_vaults.create({
            data: {
                patient_id: patient.patient_id,
                vault_number: `VAULT-${patient.patient_id.substring(0, 8).toUpperCase()}`,
                encryption_salt: `SALT-${i}`
            }
        });
    }

    // 4. Create Platform Admin
    console.log('Creating Platform Admin...');
    await db.users.create({
        data: {
            email: 'admin@medilocker.com',
            phone_number: '9999999999',
            password_hash,
            user_role: 'PLATFORM_ADMIN',
            account_status: 'ACTIVE'
        }
    });

    console.log('Seeding complete! You can login with password: password123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
