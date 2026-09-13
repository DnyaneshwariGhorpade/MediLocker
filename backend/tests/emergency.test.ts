import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agent, db, login, MFA_CODE, seedFixtures } from './helpers';

let fixtures: Awaited<ReturnType<typeof seedFixtures>>;
let doctorToken: string;
let hospitalToken: string;
let sessionId: string | undefined;
// Phase 4 replaced the fixed approval code with a per-request generated one.
let approvalCode = MFA_CODE;

beforeAll(async () => {
    fixtures = await seedFixtures();

    // The initiating doctor must belong to the approving hospital.
    await db.doctors.update({
        where: { doctor_id: fixtures.doctor.doctor_id },
        data: { primary_hospital_id: fixtures.hospital.hospital_id },
    });
    await db.patients.update({
        where: { patient_id: fixtures.patient.patient_id },
        data: { is_emergency_sharing_allowed: true },
    });

    doctorToken = await login(fixtures.doctor.users.email);
    hospitalToken = await login(fixtures.hospital.users.email);
});

afterAll(async () => {
    if (sessionId) {
        await db.break_glass_record_accesses.deleteMany({ where: { session_id: sessionId } });
        await db.break_glass_access_sessions.delete({ where: { session_id: sessionId } }).catch(() => undefined);
    }
    await db.$disconnect();
});

describe('break-glass lifecycle', () => {
    it('creates a pending session that is not yet readable', async () => {
        const initiated = await agent()
            .post('/api/v1/emergency/initiate-request')
            .set('Authorization', `Bearer ${doctorToken}`)
            .send({ identifier: fixtures.vault.vault_number, emergency_reason: 'Unconscious patient, integration test' });

        expect(initiated.status).toBe(201);
        sessionId = initiated.body.session.session_id;
        approvalCode = initiated.body.developmentApprovalCode;
        expect(approvalCode).toMatch(/^[0-9]{6}$/);
        expect(initiated.body.session.session_status).toBe('PENDING_APPROVAL');

        // Dual approval means a pending session grants nothing.
        const premature = await agent()
            .get(`/api/v1/emergency/session/${sessionId}/data`)
            .set('Authorization', `Bearer ${doctorToken}`);
        expect(premature.status).toBe(403);
    });

    it('rejects approval with a wrong verification code', async () => {
        const response = await agent()
            .post('/api/v1/emergency/approve')
            .set('Authorization', `Bearer ${hospitalToken}`)
            .send({ session_id: sessionId, otp: approvalCode === '999999' ? '111111' : '999999' });

        expect(response.status).toBe(400);
    });

    it('activates the session on approval and notifies the patient', async () => {
        const response = await agent()
            .post('/api/v1/emergency/approve')
            .set('Authorization', `Bearer ${hospitalToken}`)
            .send({ session_id: sessionId, otp: approvalCode });

        expect(response.status).toBe(200);
        expect(response.body.session.session_status).toBe('ACTIVE');

        const notification = await db.notifications.findFirst({
            where: { user_id: fixtures.patient.user_id, event_type: 'EMERGENCY_ACCESS' },
            orderBy: { created_at: 'desc' },
        });
        expect(notification).not.toBeNull();
    });

    it('lets the granted physician read the session', async () => {
        const response = await agent()
            .get(`/api/v1/emergency/session/${sessionId}/data`)
            .set('Authorization', `Bearer ${doctorToken}`);

        expect(response.status).toBe(200);
        expect(response.body.session.session_id).toBe(sessionId);
        // The clinical summary is derived from the patient records themselves.
        // An empty list means no such record exists, which the payload states
        // explicitly rather than implying the patient has none.
        expect(response.body.snapshot.derived).toBe(true);
        expect(Array.isArray(response.body.snapshot.allergies)).toBe(true);
        expect(response.body.snapshot.caveat).toContain('not that the patient has none');
    });

    it('refuses a different physician holding the same session id', async () => {
        if (!fixtures.otherDoctor || fixtures.otherDoctor.doctor_id === fixtures.doctor.doctor_id) return;

        const otherToken = await login(fixtures.otherDoctor.users.email);
        const response = await agent()
            .get(`/api/v1/emergency/session/${sessionId}/data`)
            .set('Authorization', `Bearer ${otherToken}`);

        expect(response.status).toBe(403);
    });

    it('refuses termination by an unrelated hospital admin', async () => {
        const otherHospital = await db.hospitals.findFirst({
            where: { hospital_id: { not: fixtures.hospital.hospital_id } },
            include: { users: true },
        });
        if (!otherHospital) return;

        const otherToken = await login(otherHospital.users.email);
        const response = await agent()
            .post('/api/v1/emergency/terminate')
            .set('Authorization', `Bearer ${otherToken}`)
            .send({ session_id: sessionId });

        expect(response.status).toBe(403);
    });

    it('terminates the session and revokes access immediately', async () => {
        const terminated = await agent()
            .post('/api/v1/emergency/terminate')
            .set('Authorization', `Bearer ${hospitalToken}`)
            .send({ session_id: sessionId });

        expect(terminated.status).toBe(200);

        const afterTerminate = await agent()
            .get(`/api/v1/emergency/session/${sessionId}/data`)
            .set('Authorization', `Bearer ${doctorToken}`);

        expect(afterTerminate.status).toBe(403);
    });

    it('refuses break-glass when the patient has opted out', async () => {
        await db.patients.update({
            where: { patient_id: fixtures.patient.patient_id },
            data: { is_emergency_sharing_allowed: false },
        });

        try {
            const response = await agent()
                .post('/api/v1/emergency/initiate-request')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({ identifier: fixtures.vault.vault_number, emergency_reason: 'Opt-out check' });

            expect(response.status).toBe(403);
        } finally {
            await db.patients.update({
                where: { patient_id: fixtures.patient.patient_id },
                data: { is_emergency_sharing_allowed: true },
            });
        }
    });
});
