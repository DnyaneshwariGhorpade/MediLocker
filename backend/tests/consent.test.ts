import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agent, db, login, seedFixtures } from './helpers';

let fixtures: Awaited<ReturnType<typeof seedFixtures>>;
let patientToken: string;
let doctorToken: string;

const createdConsents: string[] = [];

beforeAll(async () => {
    fixtures = await seedFixtures();
    patientToken = await login(fixtures.patient.users.email);
    doctorToken = await login(fixtures.doctor.users.email);
});

afterAll(async () => {
    if (createdConsents.length > 0) {
        await db.consents.deleteMany({ where: { consent_id: { in: createdConsents } } });
    }
    await db.$disconnect();
});

async function grant(body: Record<string, unknown>) {
    const response = await agent()
        .post('/api/v1/consent/grant')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(body);
    if (response.status === 201 && response.body.consent_id) {
        createdConsents.push(response.body.consent_id);
    }
    return response;
}

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString();

describe('consent lifecycle', () => {
    it('grants consent and stores a token hash', async () => {
        const response = await grant({
            doctor_id: fixtures.doctor.doctor_id,
            allowed_categories: ['PRESCRIPTION', 'BLOOD_REPORT'],
            blocked_categories: ['HIV_REPORT'],
            valid_until: tomorrow(),
            access_level: 'READ_ONLY',
        });

        expect(response.status).toBe(201);
        expect(response.body.consent_token_hash).toMatch(/^[a-f0-9]{64}$/);
        expect(response.body.consent_status).toBe('ACTIVE');
    });

    it('lets the doctor read allowed categories once consent exists', async () => {
        const response = await agent()
            .get(`/api/v1/doctor/patient-records/${fixtures.vault.vault_number}`)
            .set('Authorization', `Bearer ${doctorToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it('refuses a doctor with no consent', async () => {
        if (!fixtures.otherDoctor || fixtures.otherDoctor.doctor_id === fixtures.doctor.doctor_id) return;

        const otherToken = await login(fixtures.otherDoctor.users.email);
        const response = await agent()
            .get(`/api/v1/doctor/patient-records/${fixtures.vault.vault_number}`)
            .set('Authorization', `Bearer ${otherToken}`);

        expect(response.status).toBe(403);
    });

    it('rejects a grant where a category is both allowed and blocked', async () => {
        const response = await grant({
            doctor_id: fixtures.doctor.doctor_id,
            allowed_categories: ['PRESCRIPTION'],
            blocked_categories: ['PRESCRIPTION'],
            valid_until: tomorrow(),
        });

        expect(response.status).toBe(400);
    });

    it('rejects a grant with no allowed categories', async () => {
        const response = await grant({
            doctor_id: fixtures.doctor.doctor_id,
            allowed_categories: [],
            blocked_categories: [],
            valid_until: tomorrow(),
        });

        expect(response.status).toBe(400);
    });

    it('rejects a grant whose expiry is in the past', async () => {
        const response = await grant({
            doctor_id: fixtures.doctor.doctor_id,
            allowed_categories: ['PRESCRIPTION'],
            valid_until: new Date(Date.now() - 86_400_000).toISOString(),
        });

        expect(response.status).toBe(400);
    });

    it('revokes consent and immediately blocks the doctor', async () => {
        const created = await grant({
            doctor_id: fixtures.doctor.doctor_id,
            allowed_categories: ['PRESCRIPTION', 'BLOOD_REPORT'],
            blocked_categories: [],
            valid_until: tomorrow(),
        });
        expect(created.status).toBe(201);

        // Revoke every active consent for this pairing so no earlier grant
        // keeps the doctor authorised.
        const active = await agent().get('/api/v1/consent/active').set('Authorization', `Bearer ${patientToken}`);
        for (const consent of active.body) {
            if (consent.doctor_id !== fixtures.doctor.doctor_id) continue;
            const revoked = await agent()
                .post(`/api/v1/consent/${consent.consent_id}/revoke`)
                .set('Authorization', `Bearer ${patientToken}`);
            expect(revoked.status).toBe(200);
        }

        const afterRevoke = await agent()
            .get(`/api/v1/doctor/patient-records/${fixtures.vault.vault_number}`)
            .set('Authorization', `Bearer ${doctorToken}`);

        expect(afterRevoke.status).toBe(403);
    });

    it('returns consent history with an attached audit trail', async () => {
        const response = await agent().get('/api/v1/consent/history').set('Authorization', `Bearer ${patientToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
            expect(response.body[0]).toHaveProperty('audit_trail');
        }
    });

    it('refuses to revoke another patient/s consent', async () => {
        const otherPatient = await db.patients.findFirst({
            where: { patient_id: { not: fixtures.patient.patient_id } },
            include: { users: true },
        });
        if (!otherPatient) return;

        const otherToken = await login(otherPatient.users.email);
        const mine = await db.consents.findFirst({ where: { patient_id: fixtures.patient.patient_id } });
        if (!mine) return;

        const response = await agent()
            .post(`/api/v1/consent/${mine.consent_id}/revoke`)
            .set('Authorization', `Bearer ${otherToken}`);

        expect(response.status).toBe(404);
    });
});
