import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agent, db, login, seedFixtures } from './helpers';
import { canonicalisePrescription } from '../src/services/prescriptionSignature';
import { generate as otpGenerate } from 'otplib';
import { generateSecret, verifyTotp } from '../src/services/mfa';
import { getObjectStorage } from '../src/services/objectStorage';

let fixtures: Awaited<ReturnType<typeof seedFixtures>>;
let doctorToken: string;
let patientToken: string;
let doctorPrivateKeyPem: string;

const createdPrescriptionIds: string[] = [];
const createdRecordIds: string[] = [];

/** Generates a TOTP code the same way an authenticator app would. */
async function totpNow(secret: string): Promise<string> {
    return otpGenerate({ secret });
}

/** Signs with the seeded doctor private key, standing in for the browser. */
function signAsDoctor(canonical: string): string {
    const key = crypto.createPrivateKey(doctorPrivateKeyPem);
    // WebCrypto emits raw r||s; Node must be told to match.
    return crypto
        .sign('sha256', Buffer.from(canonical, 'utf8'), { key, dsaEncoding: 'ieee-p1363' })
        .toString('base64');
}

beforeAll(async () => {
    fixtures = await seedFixtures();

    const keyFile = path.resolve(__dirname, '../.dev-doctor-keys.json');
    if (!fs.existsSync(keyFile)) {
        throw new Error('Run `npm run seed` first: doctor signing keys are missing.');
    }
    const keys = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
    doctorPrivateKeyPem = keys[fixtures.doctor.users.email]?.privateKeyPem;
    if (!doctorPrivateKeyPem) {
        throw new Error(`No seeded signing key for ${fixtures.doctor.users.email}`);
    }

    doctorToken = await login(fixtures.doctor.users.email);
    patientToken = await login(fixtures.patient.users.email);
});

afterAll(async () => {
    if (createdPrescriptionIds.length > 0) {
        await db.prescriptions.deleteMany({ where: { prescription_id: { in: createdPrescriptionIds } } });
    }
    for (const recordId of createdRecordIds) {
        const record = await db.medical_records.findUnique({ where: { record_id: recordId } });
        if (record) {
            await db.medical_records.delete({ where: { record_id: recordId } }).catch(() => undefined);
            await getObjectStorage().delete(record.file_s3_key).catch(() => undefined);
        }
    }
    await db.$disconnect();
});

describe('TOTP', () => {
    it('accepts a current code and rejects a wrong one', async () => {
        const secret = generateSecret();
        expect(await verifyTotp(secret, await totpNow(secret))).toBe(true);
        expect(await verifyTotp(secret, '000000')).toBe(false);
    });

    it('rejects a code generated from a different secret', async () => {
        const secret = generateSecret();
        const other = generateSecret();
        expect(await verifyTotp(secret, await totpNow(other))).toBe(false);
    });

    it('enrols an account and then requires real codes', async () => {
        const bcrypt = await import('bcrypt');
        const email = `totp-${Date.now()}@medilocker.test`;
        const user = await db.users.create({
            data: {
                email,
                phone_number: `8${Date.now().toString().slice(-9)}`,
                password_hash: await bcrypt.default.hash('password123', 10),
                user_role: 'PATIENT',
                account_status: 'ACTIVE',
            },
        });

        try {
            const token = await login(email);

            const start = await agent().post('/api/v1/auth/mfa/enroll').set('Authorization', `Bearer ${token}`);
            expect(start.status).toBe(200);
            expect(start.body.otpauthUri).toContain('otpauth://totp/');
            expect(start.body.qrDataUrl).toContain('data:image/png;base64,');

            const secret = start.body.manualEntryKey;

            // A wrong code must not complete enrolment.
            const badConfirm = await agent()
                .post('/api/v1/auth/mfa/confirm')
                .set('Authorization', `Bearer ${token}`)
                .send({ enrolmentToken: start.body.enrolmentToken, otp: '000000' });
            expect(badConfirm.status).toBe(401);

            const confirm = await agent()
                .post('/api/v1/auth/mfa/confirm')
                .set('Authorization', `Bearer ${token}`)
                .send({ enrolmentToken: start.body.enrolmentToken, otp: await totpNow(secret) });
            expect(confirm.status).toBe(200);
            expect(confirm.body.backupCodes).toHaveLength(10);

            // The secret is stored encrypted, never in plaintext.
            const stored = await db.users.findUnique({ where: { user_id: user.user_id } });
            expect(stored?.mfa_secret).toBeTruthy();
            expect(stored?.mfa_secret).not.toContain(secret);

            // Once enrolled, the development fallback no longer works.
            const first = await agent().post('/api/v1/auth/login').send({ loginId: email, password: 'password123' });
            const withFallback = await agent()
                .post('/api/v1/auth/verify-mfa')
                .send({ tempToken: first.body.tempToken, otp: '123456' });
            expect(withFallback.status).toBe(401);

            // A real code does.
            const second = await agent().post('/api/v1/auth/login').send({ loginId: email, password: 'password123' });
            const withTotp = await agent()
                .post('/api/v1/auth/verify-mfa')
                .send({ tempToken: second.body.tempToken, otp: await totpNow(secret) });
            expect(withTotp.status).toBe(200);
            expect(withTotp.body.mfaFactor).toBe('TOTP');

            // A backup code works exactly once.
            const backup = confirm.body.backupCodes[0];
            const third = await agent().post('/api/v1/auth/login').send({ loginId: email, password: 'password123' });
            const withBackup = await agent()
                .post('/api/v1/auth/verify-mfa')
                .send({ tempToken: third.body.tempToken, otp: backup });
            expect(withBackup.status).toBe(200);
            expect(withBackup.body.mfaFactor).toBe('BACKUP_CODE');

            const fourth = await agent().post('/api/v1/auth/login').send({ loginId: email, password: 'password123' });
            const reused = await agent()
                .post('/api/v1/auth/verify-mfa')
                .send({ tempToken: fourth.body.tempToken, otp: backup });
            expect(reused.status).toBe(401);
        } finally {
            await db.mfa_backup_codes.deleteMany({ where: { user_id: user.user_id } });
            await db.user_sessions.deleteMany({ where: { user_id: user.user_id } });
            await db.users.delete({ where: { user_id: user.user_id } }).catch(() => undefined);
        }
    });
});

describe('session management', () => {
    it('lists the current device and revokes another immediately', async () => {
        const first = await login(fixtures.patient.users.email);
        const second = await login(fixtures.patient.users.email);

        const list = await agent().get('/api/v1/auth/sessions').set('Authorization', `Bearer ${second}`);
        expect(list.status).toBe(200);
        expect(list.body.length).toBeGreaterThanOrEqual(2);
        expect(list.body.filter((s: { is_current: boolean }) => s.is_current)).toHaveLength(1);

        const firstSession = list.body.find((s: { is_current: boolean }) => !s.is_current);

        const revoked = await agent()
            .delete(`/api/v1/auth/sessions/${firstSession.session_id}`)
            .set('Authorization', `Bearer ${second}`);
        expect(revoked.status).toBe(200);

        // The revoked token stops working straight away, not at expiry.
        const afterRevoke = await agent()
            .get('/api/v1/patient/profile')
            .set('Authorization', `Bearer ${first}`);
        expect(afterRevoke.status).toBe(401);

        // The surviving session is unaffected.
        const stillValid = await agent()
            .get('/api/v1/patient/profile')
            .set('Authorization', `Bearer ${second}`);
        expect(stillValid.status).toBe(200);
    });

    it('ends the current session on logout', async () => {
        const token = await login(fixtures.patient.users.email);
        const out = await agent().post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`);
        expect(out.status).toBe(200);

        const after = await agent().get('/api/v1/patient/profile').set('Authorization', `Bearer ${token}`);
        expect(after.status).toBe(401);
    });
});

describe('prescription signing', () => {
    const medications = [
        { name: 'Amoxicillin', dosage: '500mg', frequency: 'TDS', duration_days: 5, instructions: 'After food' },
    ];

    it('accepts a correctly signed prescription and stores a signed PDF', async () => {
        const issuedAt = new Date().toISOString();
        const canonical = canonicalisePrescription({
            patient_id: fixtures.patient.patient_id,
            doctor_id: fixtures.doctor.doctor_id,
            medications,
            clinical_notes: 'Integration test',
            issued_at: issuedAt,
        });

        const response = await agent()
            .post('/api/v1/doctor/prescriptions/sign-and-issue')
            .set('Authorization', `Bearer ${doctorToken}`)
            .send({
                patient_id: fixtures.patient.patient_id,
                clinical_notes: 'Integration test',
                medications,
                digital_signature: signAsDoctor(canonical),
                issued_at: issuedAt,
            });

        expect(response.status).toBe(201);
        expect(response.body.prescription.is_signature_valid).toBe(true);
        expect(response.body.verify_url).toContain(response.body.prescription.prescription_id);

        createdPrescriptionIds.push(response.body.prescription.prescription_id);
        createdRecordIds.push(response.body.record_id);

        // The generated PDF went through the encrypted pipeline like any upload.
        const record = await db.medical_records.findUnique({ where: { record_id: response.body.record_id } });
        expect(record?.storage_driver).toBe('LOCAL');
        expect(record?.file_mime_type).toBe('application/pdf');

        const decrypted = await agent()
            .post(`/api/v1/vault/records/${response.body.record_id}/decrypt`)
            .set('Authorization', `Bearer ${patientToken}`);
        expect(decrypted.status).toBe(200);
        expect(Buffer.from(decrypted.body.content_base64, 'base64').subarray(0, 4).toString()).toBe('%PDF');
    });

    it('rejects a forged signature and stores nothing', async () => {
        const before = await db.prescriptions.count();
        const issuedAt = new Date().toISOString();

        const response = await agent()
            .post('/api/v1/doctor/prescriptions/sign-and-issue')
            .set('Authorization', `Bearer ${doctorToken}`)
            .send({
                patient_id: fixtures.patient.patient_id,
                clinical_notes: 'Forged',
                medications,
                digital_signature: Buffer.from('not a real signature').toString('base64'),
                issued_at: issuedAt,
            });

        expect(response.status).toBe(400);
        expect(await db.prescriptions.count()).toBe(before);
    });

    it('rejects a signature over different content than what is submitted', async () => {
        const issuedAt = new Date().toISOString();

        // Sign one dosage, then submit another.
        const canonical = canonicalisePrescription({
            patient_id: fixtures.patient.patient_id,
            doctor_id: fixtures.doctor.doctor_id,
            medications: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TDS' }],
            clinical_notes: '',
            issued_at: issuedAt,
        });

        const response = await agent()
            .post('/api/v1/doctor/prescriptions/sign-and-issue')
            .set('Authorization', `Bearer ${doctorToken}`)
            .send({
                patient_id: fixtures.patient.patient_id,
                medications: [{ name: 'Amoxicillin', dosage: '5000mg', frequency: 'TDS' }],
                digital_signature: signAsDoctor(canonical),
                issued_at: issuedAt,
            });

        expect(response.status).toBe(400);
    });
});

describe('public prescription verification', () => {
    it('verifies a genuine prescription by id', async () => {
        const prescriptionId = createdPrescriptionIds[0];
        expect(prescriptionId).toBeTruthy();

        const response = await agent()
            .post('/api/v1/public/verify-prescription')
            .send({ prescription_id: prescriptionId });

        expect(response.status).toBe(200);
        expect(response.body.verified).toBe(true);
        expect(response.body.details.mrn).toBe(fixtures.doctor.mrn);
        // Patient identity is minimised on a public endpoint.
        expect(response.body.details.patient_initials).toHaveLength(2);
    });

    it('fails verification when the stored record is altered after signing', async () => {
        const prescriptionId = createdPrescriptionIds[0]!;
        const original = await db.prescriptions.findUnique({ where: { prescription_id: prescriptionId } });

        await db.prescriptions.update({
            where: { prescription_id: prescriptionId },
            data: { clinical_notes: 'Altered after signing' },
        });

        try {
            const response = await agent()
                .post('/api/v1/public/verify-prescription')
                .send({ prescription_id: prescriptionId });

            expect(response.status).toBe(409);
            expect(response.body.verified).toBe(false);
            expect(response.body.message).toContain('FAILED');
        } finally {
            await db.prescriptions.update({
                where: { prescription_id: prescriptionId },
                data: { clinical_notes: original!.clinical_notes, is_signature_valid: true },
            });
        }
    });

    it('does not return an arbitrary prescription for an unknown id', async () => {
        const response = await agent()
            .post('/api/v1/public/verify-prescription')
            .send({ prescription_id: '00000000-0000-0000-0000-000000000000' });

        expect(response.status).toBe(404);
        expect(response.body.verified).toBe(false);
    });

    it('rejects a request with no prescription id', async () => {
        const response = await agent().post('/api/v1/public/verify-prescription').send({});
        expect(response.status).toBe(400);
    });
});

describe('break-glass approval code', () => {
    it('issues a single-use code and refuses a wrong one', async () => {
        await db.doctors.update({
            where: { doctor_id: fixtures.doctor.doctor_id },
            data: { primary_hospital_id: fixtures.hospital.hospital_id },
        });
        await db.patients.update({
            where: { patient_id: fixtures.patient.patient_id },
            data: { is_emergency_sharing_allowed: true },
        });

        const hospitalToken = await login(fixtures.hospital.users.email);

        const initiated = await agent()
            .post('/api/v1/emergency/initiate-request')
            .set('Authorization', `Bearer ${doctorToken}`)
            .send({ identifier: fixtures.vault.vault_number, emergency_reason: 'Code test' });

        expect(initiated.status).toBe(201);
        const sessionId = initiated.body.session.session_id;
        const code = initiated.body.developmentApprovalCode;

        // The code is six digits and is not the old hardcoded value by design.
        expect(code).toMatch(/^[0-9]{6}$/);
        // Only its hash is persisted.
        expect(initiated.body.session.verification_otp_hash).toBeUndefined();

        try {
            const wrong = await agent()
                .post('/api/v1/emergency/approve')
                .set('Authorization', `Bearer ${hospitalToken}`)
                .send({ session_id: sessionId, otp: code === '000000' ? '111111' : '000000' });
            expect(wrong.status).toBe(400);

            const right = await agent()
                .post('/api/v1/emergency/approve')
                .set('Authorization', `Bearer ${hospitalToken}`)
                .send({ session_id: sessionId, otp: code });
            expect(right.status).toBe(200);

            // The code cannot be replayed.
            const replay = await agent()
                .post('/api/v1/emergency/approve')
                .set('Authorization', `Bearer ${hospitalToken}`)
                .send({ session_id: sessionId, otp: code });
            expect(replay.status).toBe(409);
        } finally {
            await db.break_glass_record_accesses.deleteMany({ where: { session_id: sessionId } });
            await db.break_glass_access_sessions.delete({ where: { session_id: sessionId } }).catch(() => undefined);
        }
    });
});
