import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agent, db, login, MFA_CODE, passwordOnly, seedFixtures, SEED_PASSWORD } from './helpers';

let fixtures: Awaited<ReturnType<typeof seedFixtures>>;

beforeAll(async () => {
    fixtures = await seedFixtures();
});

afterAll(async () => {
    await db.$disconnect();
});

describe('authentication', () => {
    it('issues a session token after password and MFA', async () => {
        const token = await login(fixtures.patient.users.email);
        expect(token).toBeTypeOf('string');

        const profile = await agent().get('/api/v1/patient/profile').set('Authorization', `Bearer ${token}`);
        expect(profile.status).toBe(200);
        expect(profile.body.email).toBe(fixtures.patient.users.email);
    });

    it('rejects a wrong password without revealing whether the account exists', async () => {
        const known = await passwordOnly(fixtures.patient.users.email, 'definitely-not-the-password');
        const unknown = await passwordOnly('nobody-here@example.com', 'definitely-not-the-password');

        expect(known.status).toBe(401);
        expect(unknown.status).toBe(401);
        expect(unknown.body.message).toBe('Invalid credentials');
    });

    it('rejects an incorrect MFA code', async () => {
        const first = await passwordOnly(fixtures.patient.users.email);
        expect(first.status).toBe(200);

        const second = await agent()
            .post('/api/v1/auth/verify-mfa')
            .send({ tempToken: first.body.tempToken, otp: '000000' });

        expect(second.status).toBe(401);
    });

    it('refuses a pre-MFA temp token on an API route', async () => {
        const first = await passwordOnly(fixtures.patient.users.email);
        const response = await agent()
            .get('/api/v1/notifications')
            .set('Authorization', `Bearer ${first.body.tempToken}`);

        // The temp token is a valid JWT but is not a session token.
        expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated request', async () => {
        const response = await agent().get('/api/v1/patient/dashboard-summary');
        expect(response.status).toBe(401);
    });

    it('refuses a valid token on another role/s routes', async () => {
        const token = await login(fixtures.patient.users.email);
        const response = await agent().get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(403);
    });

    it('refuses a forged token signed with the wrong secret', async () => {
        const jwt = await import('jsonwebtoken');
        const forged = jwt.default.sign(
            { userId: fixtures.admin.user_id, role: 'PLATFORM_ADMIN' },
            'fallback-secret-key-for-dev',
            { expiresIn: '1h' }
        );

        const response = await agent().get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${forged}`);
        expect(response.status).toBe(403);
    });

    it('locks the account after the configured number of failures, then clears on success', async () => {
        // A dedicated account so the lockout does not affect other tests.
        const bcrypt = await import('bcrypt');
        const email = `lockout-${Date.now()}@medilocker.test`;
        const user = await db.users.create({
            data: {
                email,
                phone_number: `9${Date.now().toString().slice(-9)}`,
                password_hash: await bcrypt.default.hash(SEED_PASSWORD, 10),
                user_role: 'PATIENT',
                account_status: 'ACTIVE',
            },
        });

        try {
            const max = 10; // env default MAX_FAILED_LOGINS
            let locked = false;

            for (let attempt = 1; attempt <= max; attempt += 1) {
                const response = await passwordOnly(email, 'wrong-password');
                if (response.status === 423) {
                    locked = true;
                    break;
                }
                expect(response.status).toBe(401);
            }

            expect(locked).toBe(true);

            // The correct password is refused while the lock stands.
            const duringLock = await passwordOnly(email);
            expect(duringLock.status).toBe(423);

            // Clearing the lock lets the correct password through again.
            await db.users.update({
                where: { user_id: user.user_id },
                data: { lockout_until: null, failed_login_attempts: 0, account_status: 'ACTIVE' },
            });

            const afterUnlock = await passwordOnly(email);
            expect(afterUnlock.status).toBe(200);
            expect(afterUnlock.body.tempToken).toBeTypeOf('string');

            const verified = await agent()
                .post('/api/v1/auth/verify-mfa')
                .send({ tempToken: afterUnlock.body.tempToken, otp: MFA_CODE });
            expect(verified.status).toBe(200);
        } finally {
            await db.users.delete({ where: { user_id: user.user_id } }).catch(() => undefined);
        }
    });
});

describe('request validation', () => {
    it('rejects a malformed body with 400 and field detail, not 500', async () => {
        const response = await agent().post('/api/v1/auth/login').send({ loginId: 'x' });
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Request validation failed');
        expect(Array.isArray(response.body.details)).toBe(true);
    });

    it('rejects a non-UUID route parameter with 400', async () => {
        const token = await login(fixtures.patient.users.email);
        const response = await agent()
            .post('/api/v1/vault/records/not-a-uuid/decrypt')
            .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(400);
    });

    it('rejects an unknown route with 404 rather than hanging', async () => {
        const response = await agent().get('/api/v1/does-not-exist');
        expect(response.status).toBe(404);
    });

    it('never returns a raw stack trace to the client', async () => {
        const response = await agent().post('/api/v1/auth/login').send({});
        expect(JSON.stringify(response.body)).not.toContain('at ');
    });
});
