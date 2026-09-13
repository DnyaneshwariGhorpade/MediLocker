process.env['NODE_ENV'] = 'test';

import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/services/db';

export const app = createApp();
export const agent = () => request(app);

export const SEED_PASSWORD = 'password123';
export const MFA_CODE = '123456';

/** Completes password + MFA and returns a session token. */
export async function login(loginId: string, password = SEED_PASSWORD): Promise<string> {
    const first = await agent().post('/api/v1/auth/login').send({ loginId, password });
    if (first.status !== 200) {
        throw new Error(`Login failed for ${loginId}: ${first.status} ${JSON.stringify(first.body)}`);
    }
    const second = await agent()
        .post('/api/v1/auth/verify-mfa')
        .send({ tempToken: first.body.tempToken, otp: MFA_CODE });
    if (second.status !== 200) {
        throw new Error(`MFA failed for ${loginId}: ${second.status} ${JSON.stringify(second.body)}`);
    }
    return second.body.token as string;
}

/** Returns the temp token issued between password entry and MFA. */
export async function passwordOnly(loginId: string, password = SEED_PASSWORD) {
    return agent().post('/api/v1/auth/login').send({ loginId, password });
}

export async function seedFixtures() {
    const patient = await db.patients.findFirst({
        include: { users: true, patient_vaults: true },
        orderBy: { created_at: 'asc' },
    });
    const doctor = await db.doctors.findFirst({ include: { users: true }, orderBy: { created_at: 'asc' } });
    const otherDoctor = await db.doctors.findFirst({
        include: { users: true },
        orderBy: { created_at: 'desc' },
    });
    const hospital = await db.hospitals.findFirst({ include: { users: true } });
    const admin = await db.users.findFirst({ where: { user_role: 'PLATFORM_ADMIN' } });

    if (!patient || !doctor || !hospital || !admin || !patient.patient_vaults) {
        throw new Error('Database is not seeded. Run `npm run seed` first.');
    }

    return { patient, doctor, otherDoctor, hospital, admin, vault: patient.patient_vaults };
}

export { db };
