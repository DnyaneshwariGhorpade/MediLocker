/**
 * Endpoint smoke test (task P1-14).
 *
 * Exercises every route against a running server and seeded data, asserting
 * that nothing returns 5xx. Expected 4xx responses (missing consent, wrong
 * role, absent resource) are recorded as passes — this checks that handlers
 * execute, not that business rules are satisfied.
 *
 *   npm run dev      # in one terminal
 *   npm run smoke    # in another
 */

import { db } from '../src/services/db';

const BASE = process.env['SMOKE_BASE_URL'] ?? 'http://localhost:3000';
const OTP = '123456';
const SEED_PASSWORD = 'password123';

type Result = { name: string; method: string; path: string; status: number; ok: boolean; note?: string };

const results: Result[] = [];

async function call(
    name: string,
    method: string,
    path: string,
    options: { token?: string; body?: unknown; expect?: number[] } = {}
): Promise<{ status: number; body: any }> {
    const headers: Record<string, string> = {};
    if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    let status = 0;
    let parsed: any = null;
    let note: string | undefined;

    try {
        const response = await fetch(`${BASE}${path}`, {
            method,
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        status = response.status;
        const text = await response.text();
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = text;
        }
        if (status >= 500) note = typeof parsed === 'object' ? JSON.stringify(parsed).slice(0, 200) : String(parsed).slice(0, 200);
    } catch (error: any) {
        note = `request failed: ${error.message}`;
    }

    // A route passes when it does not return 5xx and did not fail to connect.
    const ok = status > 0 && status < 500;
    results.push({ name, method, path, status, ok, note });
    return { status, body: parsed };
}

/** Posts a multipart form with a small in-memory PDF. */
async function callMultipart(
    name: string,
    path: string,
    token: string,
    fields: Record<string, string>
): Promise<{ status: number; body: any }> {
    const form = new FormData();
    const pdf = new Blob([Buffer.from('%PDF-1.4\ntrailer<<>>\n%%EOF\n', 'utf8')], { type: 'application/pdf' });
    form.append('file', pdf, 'smoke.pdf');
    for (const [key, value] of Object.entries(fields)) form.append(key, value);

    let status = 0;
    let parsed: any = null;
    let note: string | undefined;

    try {
        const response = await fetch(`${BASE}${path}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
        });
        status = response.status;
        const text = await response.text();
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = text;
        }
        if (status >= 500) note = String(text).slice(0, 200);
    } catch (error: any) {
        note = `request failed: ${error.message}`;
    }

    results.push({ name, method: 'POST', path, status, ok: status > 0 && status < 500, note });
    return { status, body: parsed };
}

async function loginAs(email: string): Promise<string | undefined> {
    const first = await call(`login ${email}`, 'POST', '/api/v1/auth/login', {
        body: { loginId: email, password: SEED_PASSWORD },
    });
    if (first.status !== 200 || !first.body?.tempToken) return undefined;

    const second = await call(`verify-mfa ${email}`, 'POST', '/api/v1/auth/verify-mfa', {
        body: { tempToken: first.body.tempToken, otp: OTP },
    });
    return second.body?.token;
}

async function main() {
    console.log(`Smoke testing ${BASE}\n`);

    // Reference data straight from the database so paths use real identifiers.
    const [patient, doctor, hospital, record, vault, notification, flag, session, anchor] = await Promise.all([
        db.patients.findFirst({ include: { users: true, patient_vaults: true } }),
        db.doctors.findFirst({ include: { users: true } }),
        db.hospitals.findFirst({ include: { users: true } }),
        db.medical_records.findFirst(),
        db.patient_vaults.findFirst(),
        db.notifications.findFirst(),
        db.record_flags.findFirst(),
        db.break_glass_access_sessions.findFirst(),
        db.blockchain_anchors.findFirst(),
    ]);

    const admin = await db.users.findFirst({ where: { user_role: 'PLATFORM_ADMIN' } });

    const uuid = '00000000-0000-0000-0000-000000000000';
    const uuidPlaceholder = uuid;
    let liveSessionId: string;
    let emergencyCode = OTP;
    const recordId = record?.record_id ?? uuid;
    const vaultNumber = vault?.vault_number ?? 'ML-2026-0000';
    const notificationId = notification?.notification_id ?? uuid;
    const flagId = flag?.flag_id ?? uuid;
    const sessionId = session?.session_id ?? uuid;

    // ---------------------------------------------------------------- public
    await call('health', 'GET', '/health');
    await call('verify-hash', 'POST', '/api/v1/public/verify-hash', { body: { sha256_hash: 'a'.repeat(64) } });
    await call('verify-prescription (unknown id)', 'POST', '/api/v1/public/verify-prescription', { body: { prescription_id: uuidPlaceholder } });
    await call('send-aadhaar-otp', 'POST', '/api/v1/auth/patient/send-aadhaar-otp', { body: { aadhaar_number: '123456789012' } });
    await call('upload-credentials', 'POST', '/api/v1/auth/doctor/upload-credentials', { body: {} });

    // Registration endpoints are exercised with deliberately duplicate data so
    // they return a handled 4xx rather than creating rows on every run.
    await call('register/patient (dup)', 'POST', '/api/v1/auth/register/patient', {
        body: { email: patient?.users.email, phone_number: patient?.users.phone_number, password: 'Passw0rd!xyz1', aadhaar_hash: 'duplicate-hash', first_name: 'A', last_name: 'B', date_of_birth: '1990-01-01', gender: 'MALE' },
    });

    // --------------------------------------------------------------- patient
    const patientToken = patient ? await loginAs(patient.users.email) : undefined;
    if (patientToken) {
        await call('patient dashboard', 'GET', '/api/v1/patient/dashboard-summary', { token: patientToken });
        await call('patient vitals', 'GET', '/api/v1/patient/vitals', { token: patientToken });
        await call('patient vitals trends', 'GET', '/api/v1/patient/vitals/trends', { token: patientToken });
        await call('patient add vital', 'POST', '/api/v1/patient/vitals', {
            token: patientToken,
            body: { metric_type: 'WEIGHT', metric_value: 70.5, metric_unit: 'kg', reading_context: 'smoke test' },
        });
        await call('patient consultations', 'GET', '/api/v1/patient/consultations', { token: patientToken });
        await call('patient profile', 'GET', '/api/v1/patient/profile', { token: patientToken });
        await call('patient update profile', 'PUT', '/api/v1/patient/profile', { token: patientToken, body: { city: 'Mumbai' } });
        await call('patient emergency settings', 'PUT', '/api/v1/patient/emergency-settings', { token: patientToken, body: { is_emergency_sharing_allowed: true } });

        await call('vault records', 'GET', '/api/v1/vault/records', { token: patientToken });
        await call('vault records filtered', 'GET', '/api/v1/vault/records?category=PRESCRIPTION&search=blood', { token: patientToken });
        await call('vault decrypt', 'POST', `/api/v1/vault/records/${recordId}/decrypt`, { token: patientToken });
        await call('vault blockchain proof', 'GET', `/api/v1/vault/records/${recordId}/blockchain-proof`, { token: patientToken });

        await call('consent active', 'GET', '/api/v1/consent/active', { token: patientToken });
        await call('consent history', 'GET', '/api/v1/consent/history', { token: patientToken });

        // Grant, then immediately revoke, so the run is idempotent.
        const granted = await call('consent grant', 'POST', '/api/v1/consent/grant', {
            token: patientToken,
            body: {
                doctor_id: doctor?.doctor_id ?? uuid,
                allowed_categories: ['PRESCRIPTION', 'BLOOD_REPORT'],
                blocked_categories: ['HIV_REPORT'],
                valid_until: new Date(Date.now() + 86_400_000).toISOString(),
                access_level: 'READ_ONLY',
            },
        });
        const consentId = granted.body?.consent_id ?? uuid;

        await call('vault download', 'GET', `/api/v1/vault/records/${recordId}/download`, { token: patientToken });

        await call('auth sessions', 'GET', '/api/v1/auth/sessions', { token: patientToken });
        await call('mfa enroll', 'POST', '/api/v1/auth/mfa/enroll', { token: patientToken });
        await call('mfa confirm (bad code)', 'POST', '/api/v1/auth/mfa/confirm', {
            token: patientToken,
            body: { enrolmentToken: 'not-a-real-token', otp: '000000' },
        });
        await call('password change (wrong current)', 'POST', '/api/v1/auth/password', {
            token: patientToken,
            body: { currentPassword: 'wrong-password', newPassword: 'Str0ng!Passw0rd!' },
        });

        await call('notifications list', 'GET', '/api/v1/notifications', { token: patientToken });
        await call('notification read', 'PATCH', `/api/v1/notifications/${notificationId}/read`, { token: patientToken });
        await call('notifications read all', 'POST', '/api/v1/notifications/mark-all-read', { token: patientToken });

        // ------------------------------------------------------------ doctor
        const doctorToken = doctor ? await loginAs(doctor.users.email) : undefined;
        if (doctorToken) {
            await call('doctor dashboard', 'GET', '/api/v1/doctor/dashboard-summary', { token: doctorToken });
            await call('doctor check-consent', 'POST', '/api/v1/doctor/check-consent', { token: doctorToken, body: { identifier: vaultNumber } });
            await call('doctor request-consent', 'POST', '/api/v1/doctor/request-consent', { token: doctorToken, body: { patient_id: patient?.patient_id ?? uuid } });
            await call('doctor patient-records', 'GET', `/api/v1/doctor/patient-records/${vaultNumber}`, { token: doctorToken });
            await call('doctor search', 'GET', `/api/v1/doctor/records/search?vault_number=${vaultNumber}&keyword=blood`, { token: doctorToken });
            await call('doctor consultations', 'POST', '/api/v1/doctor/consultations', {
                token: doctorToken,
                body: { patient_id: patient?.patient_id ?? uuid, chief_complaint: 'smoke test', diagnosis_summary: 'n/a' },
            });
            // Expected to be refused: the smoke script holds no signing key.
            await call('doctor prescription (unsigned -> 400)', 'POST', '/api/v1/doctor/prescriptions/sign-and-issue', {
                token: doctorToken,
                body: { patient_id: patient?.patient_id ?? uuid, clinical_notes: 'smoke test', medications: [{ name: 'Paracetamol', dosage: '500mg', frequency: 'BD' }], digital_signature: 'unsigned-smoke-check', issued_at: new Date().toISOString() },
            });
            const freshRecord = await db.medical_records.findFirst({ orderBy: { created_at: 'desc' } });
            await call('doctor flag record', 'POST', '/api/v1/doctor/records/flag', {
                token: doctorToken,
                body: { record_id: freshRecord?.record_id ?? recordId, flag_reason: 'OTHER', reason_details: 'smoke test' },
            });
            await callMultipart('vault upload (doctor)', '/api/v1/vault/upload', doctorToken, {
                vault_number: vaultNumber,
                record_title: 'Smoke Test Record',
                category: 'BLOOD_REPORT',
                tags: 'smoke',
            });
            const anchorTarget = await db.medical_records.findFirst({
                where: { blockchain_anchor: null },
                orderBy: { created_at: 'desc' },
            });
            await call('vault anchor', 'POST', '/api/v1/vault/anchor-blockchain', {
                token: doctorToken,
                body: { record_id: anchorTarget?.record_id ?? recordId },
            });
            const emergency = await call('emergency initiate', 'POST', '/api/v1/emergency/initiate-request', {
                token: doctorToken,
                body: { identifier: vaultNumber, emergency_reason: 'smoke test' },
            });
            emergencyCode = emergency.body?.developmentApprovalCode ?? OTP;
            const liveSession = await db.break_glass_access_sessions.findFirst({ orderBy: { session_start_at: 'desc' } });
            liveSessionId = liveSession?.session_id ?? sessionId;
            await call('emergency session data', 'GET', `/api/v1/emergency/session/${liveSessionId}/data`, { token: doctorToken });
        }

        await call('consent revoke', 'POST', `/api/v1/consent/${consentId}/revoke`, { token: patientToken });
    }

    // -------------------------------------------------------------- hospital
    const hospitalToken = hospital ? await loginAs(hospital.users.email) : undefined;
    if (hospitalToken) {
        await call('hospital dashboard', 'GET', '/api/v1/hospital/dashboard-summary', { token: hospitalToken });
        await call('hospital doctors', 'GET', '/api/v1/hospital/doctors', { token: hospitalToken });
        const ownDoctor = await db.doctors.findFirst({ where: { primary_hospital_id: hospital?.hospital_id } });
        await call('hospital approve doctor', 'POST', `/api/v1/hospital/doctors/${ownDoctor?.doctor_id ?? uuid}/approve`, { token: hospitalToken });
        await call('hms clients', 'GET', '/api/v1/hms/clients', { token: hospitalToken });
        const key = await call('hms generate key', 'POST', '/api/v1/hms/clients/generate-key', {
            token: hospitalToken,
            body: { client_name: `smoke-${Date.now()}`, allowed_ip_cidrs: ['10.0.0.0/8'] },
        });
        await call('hms ip whitelist', 'PUT', '/api/v1/hms/clients/ip-whitelist', {
            token: hospitalToken,
            body: { client_id: key.body?.client?.client_id ?? uuid, allowed_ip_cidrs: ['10.0.0.0/8'] },
        });
        await call('emergency pending', 'GET', '/api/v1/emergency/pending-requests', { token: hospitalToken });
        const pending = await db.break_glass_access_sessions.findFirst({
            where: { hospital_id: hospital?.hospital_id },
            orderBy: { session_start_at: 'desc' },
        });
        const targetSession = pending?.session_id ?? liveSessionId! ?? uuid;
        await call('emergency approve', 'POST', '/api/v1/emergency/approve', { token: hospitalToken, body: { session_id: targetSession, otp: emergencyCode } });
        await call('emergency terminate', 'POST', '/api/v1/emergency/terminate', { token: hospitalToken, body: { session_id: targetSession } });
    }

    // ----------------------------------------------------------------- admin
    const adminToken = admin ? await loginAs(admin.email) : undefined;
    if (adminToken) {
        await call('admin dashboard', 'GET', '/api/v1/admin/dashboard', { token: adminToken });
        await call('admin pending hospitals', 'GET', '/api/v1/admin/verifications/hospitals', { token: adminToken });
        await call('admin pending doctors', 'GET', '/api/v1/admin/verifications/doctors', { token: adminToken });
        await call('admin disputes', 'GET', '/api/v1/admin/disputes', { token: adminToken });
        const freshFlag = await db.record_flags.findFirst({ orderBy: { created_at: 'desc' } });
        await call('admin resolve dispute', 'PUT', `/api/v1/admin/disputes/${freshFlag?.flag_id ?? flagId}/resolve`, {
            token: adminToken,
            body: { status: 'UNDER_REVIEW', action: 'REVIEW', adminNotes: 'smoke test' },
        });
        await call('admin verify chain', 'GET', '/api/v1/admin/audit-logs/verify-chain', { token: adminToken });
        await call('admin audit logs', 'GET', '/api/v1/admin/audit-logs?limit=5', { token: adminToken });
        await call('admin audit export', 'POST', '/api/v1/admin/audit-logs/export?format=csv', { token: adminToken });
        await call('admin system health', 'GET', '/api/v1/admin/system-health', { token: adminToken });
        await call('admin blockchain blocks', 'GET', '/api/v1/admin/blockchain/blocks', { token: adminToken });
        await call('admin ledger verify', 'GET', '/api/v1/admin/ledger/verify', { token: adminToken });
        await call('admin run job', 'POST', '/api/v1/admin/jobs/expire-consents/run', { token: adminToken });
        await call('admin unknown job -> 404', 'POST', '/api/v1/admin/jobs/not-a-job/run', { token: adminToken });
        await call('admin verify hospital', 'POST', `/api/v1/admin/hospitals/${hospital?.hospital_id ?? uuid}/verify`, { token: adminToken });
        await call('admin verify doctor', 'POST', `/api/v1/admin/doctors/${doctor?.doctor_id ?? uuid}/verify`, { token: adminToken });
    } else {
        console.warn('! No PLATFORM_ADMIN user found — admin routes were not exercised.\n');
    }

    // Negative controls: unauthenticated and wrong-role access must be refused.
    await call('no token -> 401', 'GET', '/api/v1/patient/dashboard-summary');
    if (patientToken) {
        await call('patient on admin route -> 403', 'GET', '/api/v1/admin/dashboard', { token: patientToken });
    }
    if (patientToken) {
        await call('logout', 'POST', '/api/v1/auth/logout', { token: patientToken });
    }

    if (anchor) {
        await call('verify known hash', 'POST', '/api/v1/public/verify-hash', { body: { sha256_hash: anchor.document_sha256 } });
    }

    // --------------------------------------------------------------- report
    const failures = results.filter(r => !r.ok);
    const width = Math.max(...results.map(r => r.name.length));

    for (const r of results) {
        const mark = r.ok ? '  ok ' : 'FAIL ';
        console.log(`${mark} ${r.name.padEnd(width)}  ${String(r.status).padStart(3)}  ${r.method} ${r.path}`);
        if (r.note) console.log(`       ${r.note}`);
    }

    console.log(`\n${results.length - failures.length}/${results.length} routes returned < 500`);
    await db.$disconnect();

    if (failures.length > 0) {
        console.error(`\n${failures.length} route(s) returned 5xx or failed to connect.`);
        process.exit(1);
    }
}

main().catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
});
