import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db } from './services/db';
import bcrypt from 'bcrypt';
import { env } from './config/env';
import { fingerprintPublicKey } from './services/prescriptionSignature';
import {
    buildOtpAuthUri,
    encryptSecret,
    generateSecret,
    issueBackupCodes,
} from './services/mfa';

/** Password shared by every seeded account, returned in the credential list. */
const DEMO_PASSWORD = 'password123';

/** MFA material for one canonical login, so testers can complete the 2nd factor. */
export interface DemoCredential {
    role: string;
    email: string;
    phone: string;
    password: string;
    totpSecret: string;
    otpauthUri: string;
    backupCodes: string[];
}

/**
 * Seeded doctors need a real ECDSA P-256 key pair, because prescription
 * signatures are now verified against the registered public key.
 *
 * In production the private key is generated in the browser and never
 * leaves the device. The seed has no browser, so the private keys are
 * written to a local, git-ignored file for tests and manual checks.
 */
const DEV_KEY_FILE = path.resolve(__dirname, '../.dev-doctor-keys.json');
const devKeys: Record<string, { publicKeyPem: string; privateKeyPem: string }> = {};

function generateDoctorKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    return {
        publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    };
}

/**
 * Removes every seeded row. Order matters: several relations are
 * onDelete: Restrict, so children must be deleted before their parents or a
 * re-run fails on a foreign key violation.
 */
async function clearAll() {
    await db.break_glass_record_accesses.deleteMany();
    await db.break_glass_access_sessions.deleteMany();
    await db.blockchain_anchors.deleteMany();
    await db.record_flags.deleteMany();
    await db.prescriptions.deleteMany();
    await db.medical_records.deleteMany();
    await db.consents.deleteMany();
    await db.consultations.deleteMany();
    await db.patient_vitals.deleteMany();
    await db.notifications.deleteMany();
    await db.hms_api_clients.deleteMany();
    await db.patient_vaults.deleteMany();
    await db.patients.deleteMany();
    await db.doctors.deleteMany();
    await db.hospitals.deleteMany();
    await db.users.deleteMany();
}

export async function main() {
    if (env.isProduction) {
        throw new Error('Refusing to seed: NODE_ENV is production. This script deletes all data.');
    }

    await seedDatabase();
}

/**
 * Performs the destructive wipe and reseed without the NODE_ENV guard.
 *
 * Callers must supply their own authorisation: the CLI path goes through
 * main(), and the temporary seeder route is guarded by SEED_TOKEN.
 */
export async function seedDatabase(): Promise<DemoCredential[]> {
    console.log('Seeding database...');

    // Canonical logins are collected as they are created so MFA can be enrolled
    // on them once every row exists.
    const demoAccounts: { user: { user_id: string }; role: string; email: string; phone: string }[] = [];

    // Clear existing data for a clean slate. Order matters: several relations
    // are onDelete: Restrict, so children must go before parents or a re-run
    // fails on a foreign key violation.
    //
    // audit_logs carries an immutability trigger that blocks UPDATE and DELETE.
    // Deleting a user cascades an UPDATE (user_id -> NULL) onto audit_logs, so
    // the trigger has to be suspended for the wipe and restored immediately
    // afterwards. This is a development-only operation.
    console.log('Clearing old data...');
    await db.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable');
    try {
        await db.$executeRawUnsafe('DELETE FROM audit_logs');
        await clearAll();
    } finally {
        await db.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable');
    }

    const password_hash = await bcrypt.hash('password123', env.bcryptRounds);

    // Canonical demo logins. These four accounts are the documented entry
    // points for manual testing, so their credentials are fixed rather than
    // generated from a loop index.
    const CANONICAL = {
        hospital: { email: 'hospital@medilocker.com', phone: '3333333333' },
        doctor: { email: 'doctor@medilocker.com', phone: '2222222222' },
        patient: { email: 'patient@medilocker.com', phone: '1111111111' },
        admin: { email: 'admin@medilocker.com', phone: '4444444444' },
    };

    // 1. Create 2 Hospitals
    console.log('Creating Hospitals...');
    const hospitals = [];
    for (let i = 1; i <= 2; i++) {
        const canonical = i === 1;
        const user = await db.users.create({
            data: {
                email: canonical ? CANONICAL.hospital.email : `hospital${i}@medilocker.com`,
                phone_number: canonical ? CANONICAL.hospital.phone : `900000000${i}`,
                password_hash,
                user_role: 'HOSPITAL_ADMIN',
                account_status: 'ACTIVE'
            }
        });
        if (canonical) {
            demoAccounts.push({
                user,
                role: 'HOSPITAL_ADMIN',
                email: CANONICAL.hospital.email,
                phone: CANONICAL.hospital.phone,
            });
        }

        const hospital = await db.hospitals.create({
            data: {
                user_id: user.user_id,
                hospital_name: canonical ? 'City General Hospital' : `City General Hospital ${i}`,
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
        const canonical = i === 1;
        const user = await db.users.create({
            data: {
                email: canonical ? CANONICAL.doctor.email : `doctor${i}@medilocker.com`,
                phone_number: canonical ? CANONICAL.doctor.phone : `800000000${i}`,
                password_hash,
                user_role: 'DOCTOR',
                account_status: 'ACTIVE'
            }
        });
        if (canonical) {
            demoAccounts.push({
                user,
                role: 'DOCTOR',
                email: CANONICAL.doctor.email,
                phone: CANONICAL.doctor.phone,
            });
        }

        const hospital = hospitals[i % hospitals.length];
        if (!hospital) throw new Error('Seed failed: no hospitals were created.');

        const keyPair = generateDoctorKeyPair();
        devKeys[canonical ? CANONICAL.doctor.email : `doctor${i}@medilocker.com`] = keyPair;

        const doctor = await db.doctors.create({
            data: {
                user_id: user.user_id,
                primary_hospital_id: hospital.hospital_id,
                mrn: `MRN-${2000 + i}`,
                state_medical_council: 'Maharashtra Medical Council',
                first_name: `Doc${i}`,
                last_name: 'Smith',
                specialization: i % 2 === 0 ? 'Cardiologist' : 'General Physician',
                qualification: 'MBBS, MD',
                public_key_pem: keyPair.publicKeyPem,
                key_fingerprint: fingerprintPublicKey(keyPair.publicKeyPem),
                verification_status: 'VERIFIED'
            }
        });
        doctors.push(doctor);
    }

    // 3. Create 10 Patients
    console.log('Creating Patients...');
    for (let i = 1; i <= 10; i++) {
        const canonical = i === 1;
        const user = await db.users.create({
            data: {
                email: canonical ? CANONICAL.patient.email : `patient${i}@medilocker.com`,
                phone_number: canonical ? CANONICAL.patient.phone : `70000000${i.toString().padStart(2, '0')}`,
                password_hash,
                user_role: 'PATIENT',
                account_status: 'ACTIVE'
            }
        });

        if (canonical) {
            demoAccounts.push({
                user,
                role: 'PATIENT',
                email: CANONICAL.patient.email,
                phone: CANONICAL.patient.phone,
            });
        }

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
    const adminUser = await db.users.create({
        data: {
            email: CANONICAL.admin.email,
            phone_number: CANONICAL.admin.phone,
            password_hash,
            user_role: 'PLATFORM_ADMIN',
            account_status: 'ACTIVE'
        }
    });
    demoAccounts.push({
        user: adminUser,
        role: 'PLATFORM_ADMIN',
        email: CANONICAL.admin.email,
        phone: CANONICAL.admin.phone,
    });

    // 5. Enrol MFA on the canonical logins.
    // Render runs with NODE_ENV=production, which disables the development
    // 123456 fallback, so an account with no TOTP secret could never finish
    // signing in. Each canonical login therefore gets a real secret, stored
    // encrypted exactly as the self-service enrolment flow does.
    console.log('Enrolling MFA for canonical demo accounts...');
    const credentials: DemoCredential[] = [];
    for (const account of demoAccounts) {
        const secret = generateSecret();
        await db.users.update({
            where: { user_id: account.user.user_id },
            data: {
                mfa_secret: await encryptSecret(secret),
                is_mfa_enabled: true,
                mfa_enrolled_at: new Date(),
            },
        });

        credentials.push({
            role: account.role,
            email: account.email,
            phone: account.phone,
            password: DEMO_PASSWORD,
            totpSecret: secret,
            otpauthUri: buildOtpAuthUri(secret, account.email),
            backupCodes: await issueBackupCodes(account.user.user_id),
        });
    }

    fs.writeFileSync(DEV_KEY_FILE, JSON.stringify(devKeys, null, 2));
    console.log(`Doctor signing keys written to ${DEV_KEY_FILE} (development only).`);
    console.log(`Seeding complete! ${demoAccounts.length} canonical logins can sign in with password: ${DEMO_PASSWORD}`);

    return credentials;
}

// Only wipe and reseed when this file is the process entry point. Importing it
// (for example from the temporary seeder route) must not trigger a wipe.
if (require.main === module) {
    main()
        .catch((e) => {
            console.error(e);
            process.exit(1);
        })
        .finally(async () => {
            await db.$disconnect();
        });
}
