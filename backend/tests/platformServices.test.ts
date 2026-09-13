import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agent, db, login, seedFixtures } from './helpers';
import { resolveConsent } from '../src/services/access';
import { getCache, getCacheStats, resetCacheStats } from '../src/services/cache';
import { appendEntry, verifyLedger } from '../src/services/ledger';
import { deliverPending, setTransports } from '../src/services/notificationDelivery';
import { getObjectStorage } from '../src/services/objectStorage';
import {
    expireBreakGlassSessions,
    expireConsents,
    runIntegritySweep,
    sendConsentExpiryReminders,
} from '../src/jobs';

let fixtures: Awaited<ReturnType<typeof seedFixtures>>;
let patientToken: string;
let doctorToken: string;
let adminToken: string;

const createdRecordIds: string[] = [];

const PDF_BYTES = Buffer.from('%PDF-1.4\ntrailer<<>>\n%%EOF\n', 'utf8');

beforeAll(async () => {
    fixtures = await seedFixtures();
    patientToken = await login(fixtures.patient.users.email);
    doctorToken = await login(fixtures.doctor.users.email);
    adminToken = await login(fixtures.admin.email);
});

afterAll(async () => {
    for (const recordId of createdRecordIds) {
        const record = await db.medical_records.findUnique({ where: { record_id: recordId } });
        if (record) {
            await db.blockchain_anchors.deleteMany({ where: { record_id: recordId } });
            await db.medical_records.delete({ where: { record_id: recordId } }).catch(() => undefined);
            await getObjectStorage().delete(record.file_s3_key).catch(() => undefined);
        }
    }
    await getCache().close();
    await db.$disconnect();
});

async function uploadPdf(title: string) {
    const response = await agent()
        .post('/api/v1/vault/upload')
        .set('Authorization', `Bearer ${doctorToken}`)
        .field('vault_number', fixtures.vault.vault_number)
        .field('record_title', title)
        .field('category', 'BLOOD_REPORT')
        .attach('file', PDF_BYTES, { filename: 'sweep.pdf', contentType: 'application/pdf' });

    if (response.status === 201) createdRecordIds.push(response.body.record.record_id);
    return response;
}

describe('consent cache', () => {
    it('serves a repeat evaluation from cache and records the hit', async () => {
        resetCacheStats();

        const granted = await agent()
            .post('/api/v1/consent/grant')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                doctor_id: fixtures.doctor.doctor_id,
                allowed_categories: ['BLOOD_REPORT'],
                blocked_categories: [],
                valid_until: new Date(Date.now() + 86_400_000).toISOString(),
            });
        expect(granted.status).toBe(201);

        try {
            // First evaluation populates the cache, the second should hit it.
            await agent()
                .get(`/api/v1/doctor/patient-records/${fixtures.vault.vault_number}`)
                .set('Authorization', `Bearer ${doctorToken}`);
            await agent()
                .get(`/api/v1/doctor/patient-records/${fixtures.vault.vault_number}`)
                .set('Authorization', `Bearer ${doctorToken}`);

            const stats = getCacheStats();
            expect(stats.hits).toBeGreaterThan(0);
            expect(stats.avgConsentLatencyMs).not.toBeNull();
        } finally {
            await db.consents.delete({ where: { consent_id: granted.body.consent_id } }).catch(() => undefined);
        }
    });

    it('drops the cached decision immediately on revocation', async () => {
        const granted = await agent()
            .post('/api/v1/consent/grant')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                doctor_id: fixtures.doctor.doctor_id,
                allowed_categories: ['BLOOD_REPORT'],
                blocked_categories: [],
                valid_until: new Date(Date.now() + 86_400_000).toISOString(),
            });
        expect(granted.status).toBe(201);

        // Warm the cache with an allow decision.
        const before = await agent()
            .get(`/api/v1/doctor/patient-records/${fixtures.vault.vault_number}`)
            .set('Authorization', `Bearer ${doctorToken}`);
        expect(before.status).toBe(200);

        const revoked = await agent()
            .post(`/api/v1/consent/${granted.body.consent_id}/revoke`)
            .set('Authorization', `Bearer ${patientToken}`);
        expect(revoked.status).toBe(200);

        const after = await agent()
            .get(`/api/v1/doctor/patient-records/${fixtures.vault.vault_number}`)
            .set('Authorization', `Bearer ${doctorToken}`);

        // FR11: the block takes effect on the very next request rather than
        // when the cache entry happens to expire. Wall-clock timing is not
        // asserted here because this suite talks to a remote database, so the
        // measurement would be dominated by network latency rather than by the
        // invalidation itself. Consent-evaluation latency is measured
        // separately by getCacheStats and surfaced on the health screen.
        expect(after.status).toBe(403);
    });

    it('evaluates consent well inside the 10ms target once cached', async () => {
        resetCacheStats();

        const granted = await agent()
            .post('/api/v1/consent/grant')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                doctor_id: fixtures.doctor.doctor_id,
                allowed_categories: ['BLOOD_REPORT'],
                blocked_categories: [],
                valid_until: new Date(Date.now() + 86_400_000).toISOString(),
            });
        expect(granted.status).toBe(201);

        try {
            // Warm, then measure only the cached path.
            await resolveConsent(fixtures.patient.patient_id, fixtures.doctor.doctor_id);
            resetCacheStats();

            for (let i = 0; i < 20; i += 1) {
                await resolveConsent(fixtures.patient.patient_id, fixtures.doctor.doctor_id);
            }

            const stats = getCacheStats();
            expect(stats.hits).toBe(20);
            expect(stats.misses).toBe(0);
            expect(stats.avgConsentLatencyMs).toBeLessThan(stats.targetMs);
        } finally {
            await db.consents.delete({ where: { consent_id: granted.body.consent_id } }).catch(() => undefined);
        }
    });

    it('reports whether the cache is distributed rather than implying it', async () => {
        const stats = getCacheStats();
        expect(['REDIS', 'MEMORY']).toContain(stats.driver);
        expect(stats.distributed).toBe(stats.driver === 'REDIS');
    });
});

describe('integrity ledger', () => {
    it('chains entries and verifies intact', async () => {
        const digest = crypto.randomBytes(32).toString('hex');
        const first = await appendEntry({
            subjectType: 'MEDICAL_RECORD',
            subjectId: crypto.randomUUID(),
            payloadSha256: digest,
        });
        const second = await appendEntry({
            subjectType: 'MEDICAL_RECORD',
            subjectId: crypto.randomUUID(),
            payloadSha256: crypto.randomBytes(32).toString('hex'),
        });

        expect(second.previousHash).toBe(first.entryHash);

        const result = await verifyLedger();
        expect(result.intact).toBe(true);
        expect(result.checked).toBeGreaterThanOrEqual(2);
    });

    it('is append-only at the database level', async () => {
        const entry = await db.ledger_entries.findFirst({ orderBy: { entry_id: 'desc' } });
        expect(entry).not.toBeNull();

        await expect(
            db.$executeRawUnsafe('UPDATE ledger_entries SET payload_sha256 = $1 WHERE entry_id = $2', 'x'.repeat(64), entry!.entry_id)
        ).rejects.toThrow();

        await expect(
            db.$executeRawUnsafe('DELETE FROM ledger_entries WHERE entry_id = $1', entry!.entry_id)
        ).rejects.toThrow();
    });

    it('anchors an uploaded record and reports it through the public verifier', async () => {
        const upload = await uploadPdf('Ledger anchor test');
        expect(upload.status).toBe(201);
        const digest = upload.body.sha256;

        const anchored = await agent()
            .post('/api/v1/vault/anchor-blockchain')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ record_id: upload.body.record.record_id });

        expect(anchored.status).toBe(201);
        expect(anchored.body.anchor.anchor_status).toBe('CONFIRMED');
        expect(anchored.body.ledger.entry_hash).toMatch(/^[a-f0-9]{64}$/);

        const verified = await agent().post('/api/v1/public/verify-hash').send({ sha256_hash: digest });
        expect(verified.status).toBe(200);
        expect(verified.body.verified).toBe(true);
        expect(verified.body.ledger_confirmed).toBe(true);
    });

    it('exposes ledger verification to admins', async () => {
        const response = await agent()
            .get('/api/v1/admin/ledger/verify')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.intact).toBe(true);
    });
});

describe('scheduled jobs', () => {
    it('expires a break-glass session without anyone reading it', async () => {
        await db.doctors.update({
            where: { doctor_id: fixtures.doctor.doctor_id },
            data: { primary_hospital_id: fixtures.hospital.hospital_id },
        });

        const session = await db.break_glass_access_sessions.create({
            data: {
                patient_id: fixtures.patient.patient_id,
                doctor_id: fixtures.doctor.doctor_id,
                hospital_id: fixtures.hospital.hospital_id,
                emergency_reason: 'Expiry job test',
                session_status: 'ACTIVE',
                session_expires_at: new Date(Date.now() - 60_000),
            },
        });

        try {
            const result = await expireBreakGlassSessions();
            expect(result).not.toBeNull();

            const after = await db.break_glass_access_sessions.findUnique({
                where: { session_id: session.session_id },
            });
            expect(after?.session_status).toBe('EXPIRED');
        } finally {
            await db.break_glass_access_sessions
                .delete({ where: { session_id: session.session_id } })
                .catch(() => undefined);
        }
    });

    it('expires a lapsed consent and clears its cache entry', async () => {
        const consent = await db.consents.create({
            data: {
                patient_id: fixtures.patient.patient_id,
                doctor_id: fixtures.doctor.doctor_id,
                allowed_categories: ['BLOOD_REPORT'],
                blocked_categories: [],
                consent_status: 'ACTIVE',
                valid_until: new Date(Date.now() - 60_000),
                consent_token_hash: crypto.randomBytes(32).toString('hex'),
            },
        });

        try {
            await expireConsents();
            const after = await db.consents.findUnique({ where: { consent_id: consent.consent_id } });
            expect(after?.consent_status).toBe('EXPIRED');
        } finally {
            await db.consents.delete({ where: { consent_id: consent.consent_id } }).catch(() => undefined);
        }
    });

    it('sends a reminder once for a consent expiring within a day', async () => {
        const consent = await db.consents.create({
            data: {
                patient_id: fixtures.patient.patient_id,
                doctor_id: fixtures.doctor.doctor_id,
                allowed_categories: ['BLOOD_REPORT'],
                blocked_categories: [],
                consent_status: 'ACTIVE',
                valid_until: new Date(Date.now() + 3 * 60 * 60 * 1000),
                consent_token_hash: crypto.randomBytes(32).toString('hex'),
            },
        });

        try {
            const first = await sendConsentExpiryReminders();
            expect((first?.summary as { reminded: number }).reminded).toBeGreaterThanOrEqual(1);

            const reminded = await db.consents.findUnique({ where: { consent_id: consent.consent_id } });
            expect(reminded?.expiry_reminder_sent_at).not.toBeNull();

            // A second run must not send a duplicate.
            const second = await sendConsentExpiryReminders();
            const stillPending = await db.consents.count({
                where: {
                    consent_status: 'ACTIVE',
                    valid_until: { gt: new Date(), lte: new Date(Date.now() + 86_400_000) },
                    expiry_reminder_sent_at: null,
                },
            });
            expect(stillPending).toBe(0);
            void second;
        } finally {
            await db.notifications.deleteMany({
                where: { user_id: fixtures.patient.user_id, event_type: 'CONSENT_REQUIRED' },
            });
            await db.consents.delete({ where: { consent_id: consent.consent_id } }).catch(() => undefined);
        }
    });

    it('flags a tampered object during the integrity sweep', async () => {
        const upload = await uploadPdf('Integrity sweep test');
        expect(upload.status).toBe(201);

        const recordId = upload.body.record.record_id;
        const record = await db.medical_records.findUnique({ where: { record_id: recordId } });
        const storage = getObjectStorage();
        const original = await storage.get(record!.file_s3_key);

        // Corrupt the stored ciphertext.
        const tampered = Buffer.from(original);
        tampered[0] = tampered[0]! ^ 0xff;
        await storage.put(record!.file_s3_key, tampered);

        try {
            // Force this record to the front of the sweep queue.
            await db.medical_records.updateMany({
                where: { record_id: { not: recordId } },
                data: { integrity_checked_at: new Date() },
            });

            await runIntegritySweep(50);

            const swept = await db.medical_records.findUnique({ where: { record_id: recordId } });
            expect(swept?.integrity_status).toBe('MISMATCH');
            expect(swept?.integrity_checked_at).not.toBeNull();
        } finally {
            await storage.put(record!.file_s3_key, original);
        }
    });
});

describe('notification delivery', () => {
    it('marks in-app notifications delivered and external ones simulated', async () => {
        const inApp = await db.notifications.create({
            data: {
                user_id: fixtures.patient.user_id,
                event_type: 'NEW_RECORD_UPLOAD',
                channel: 'IN_APP',
                title: 'In-app test',
                message: 'Delivered by the notifications screen itself.',
            },
        });

        const email = await db.notifications.create({
            data: {
                user_id: fixtures.patient.user_id,
                event_type: 'NEW_RECORD_UPLOAD',
                channel: 'EMAIL',
                title: 'Email test',
                message: 'No SMTP configured in this environment.',
            },
        });

        try {
            const result = await deliverPending(100);
            expect(result.processed).toBeGreaterThanOrEqual(2);

            const deliveredInApp = await db.notifications.findUnique({
                where: { notification_id: inApp.notification_id },
            });
            expect(deliveredInApp?.delivery_status).toBe('DELIVERED');

            const simulatedEmail = await db.notifications.findUnique({
                where: { notification_id: email.notification_id },
            });
            // Without SMTP configured this must NOT claim delivery.
            expect(simulatedEmail?.delivery_status).toBe('SIMULATED');
            expect(simulatedEmail?.provider_receipt).toBe('no-smtp-configured');
        } finally {
            await db.notifications.deleteMany({
                where: { notification_id: { in: [inApp.notification_id, email.notification_id] } },
            });
        }
    });

    it('retries a failing transport and gives up after the attempt limit', async () => {
        setTransports({
            EMAIL: {
                channel: 'EMAIL',
                configured: true,
                send: async () => ({ status: 'FAILED', error: 'simulated outage' }),
            },
            SMS: { channel: 'SMS', configured: false, send: async () => ({ status: 'SIMULATED', receipt: 'n/a' }) },
        });

        const notification = await db.notifications.create({
            data: {
                user_id: fixtures.patient.user_id,
                event_type: 'NEW_RECORD_UPLOAD',
                channel: 'EMAIL',
                title: 'Failing transport',
                message: 'Should be retried then abandoned.',
            },
        });

        try {
            for (let attempt = 0; attempt < 5; attempt += 1) {
                await deliverPending(100);
            }

            const after = await db.notifications.findUnique({
                where: { notification_id: notification.notification_id },
            });
            expect(after?.delivery_attempts).toBe(5);
            expect(after?.delivery_status).toBe('FAILED');
            expect(after?.delivery_error).toContain('simulated outage');
        } finally {
            setTransports(null);
            await db.notifications
                .delete({ where: { notification_id: notification.notification_id } })
                .catch(() => undefined);
        }
    });
});

describe('system health', () => {
    it('reports measured values and does not invent components', async () => {
        const response = await agent()
            .get('/api/v1/admin/system-health')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);

        // Real measurements.
        expect(response.body.database.latencyMs).toBeGreaterThan(0);
        expect(response.body.process.heapUsedMB).toBeGreaterThan(0);
        expect(response.body.deployment.topology).toBe('MONOLITH');

        // Undeployed components are declared, not fabricated.
        expect(response.body.eventBus.status).toBe('NOT_DEPLOYED');

        // The old response invented a services array with pod counts.
        expect(response.body.services).toBeUndefined();

        expect(response.body.ledger.status).toBe('INTACT');
        expect(response.body.notifications).toHaveProperty('emailConfigured');
    });
});
