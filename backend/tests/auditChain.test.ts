import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agent, db, login, seedFixtures } from './helpers';
import { verifyChain } from '../src/services/auditLog';

let adminToken: string;

beforeAll(async () => {
    const fixtures = await seedFixtures();

    // Rows left over from earlier runs (including any written before chaining
    // existed) would make verification fail for reasons unrelated to the code
    // under test. Start from a clean chain.
    await db.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable');
    try {
        await db.$executeRawUnsafe('DELETE FROM audit_logs');
    } finally {
        await db.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable');
    }

    adminToken = await login(fixtures.admin.email);

    // Give the post-response audit writes from login a moment to land.
    await new Promise((resolve) => setTimeout(resolve, 1000));
});

afterAll(async () => {
    await db.$disconnect();
});

describe('audit hash chain', () => {
    it('links each entry to its predecessor', async () => {
        // Generate a few entries.
        for (let i = 0; i < 3; i += 1) {
            await agent().get('/api/v1/admin/audit-logs?limit=1').set('Authorization', `Bearer ${adminToken}`);
        }

        const logs = await db.audit_logs.findMany({ orderBy: { log_id: 'desc' }, take: 3 });
        expect(logs.length).toBeGreaterThan(0);

        for (const log of logs) {
            expect(log.event_sha256_hash).toMatch(/^[a-f0-9]{64}$/);
        }

        // Every entry after the first carries its predecessor's hash.
        const ordered = await db.audit_logs.findMany({ orderBy: { log_id: 'asc' }, take: 50 });
        for (let i = 1; i < ordered.length; i += 1) {
            expect(ordered[i]!.previous_log_hash).toBe(ordered[i - 1]!.event_sha256_hash);
        }
    });

    it('reports an intact chain', async () => {
        const result = await verifyChain();
        expect(result.intact).toBe(true);
        expect(result.checked).toBeGreaterThan(0);
    });

    it('exposes chain verification to platform admins only', async () => {
        const ok = await agent()
            .get('/api/v1/admin/audit-logs/verify-chain')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(ok.status).toBe(200);
        expect(ok.body.intact).toBe(true);

        const anonymous = await agent().get('/api/v1/admin/audit-logs/verify-chain');
        expect(anonymous.status).toBe(401);
    });

    it('detects a tampered entry', async () => {
        const target = await db.audit_logs.findFirst({ orderBy: { log_id: 'desc' } });
        expect(target).not.toBeNull();

        const original = target!.action;

        // The immutability trigger blocks UPDATE, which is the first line of
        // defence. Suspend it to prove the hash chain independently catches a
        // change made directly in the database.
        await db.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable');
        try {
            await db.$executeRawUnsafe(
                'UPDATE audit_logs SET action = $1 WHERE log_id = $2',
                'TAMPERED_ACTION',
                target!.log_id
            );

            const result = await verifyChain();
            expect(result.intact).toBe(false);
            expect(result.firstBreak?.reason).toBe('ENTRY_HASH_MISMATCH');
            expect(result.firstBreak?.logId).toBe(target!.log_id.toString());
        } finally {
            await db.$executeRawUnsafe(
                'UPDATE audit_logs SET action = $1 WHERE log_id = $2',
                original,
                target!.log_id
            );
            await db.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable');
        }

        // Restoring the original value restores the chain.
        const restored = await verifyChain();
        expect(restored.intact).toBe(true);
    });

    it('is protected by the database immutability trigger', async () => {
        const target = await db.audit_logs.findFirst({ orderBy: { log_id: 'desc' } });
        await expect(
            db.$executeRawUnsafe('UPDATE audit_logs SET action = $1 WHERE log_id = $2', 'X', target!.log_id)
        ).rejects.toThrow();
    });

    it('stays intact across a real consent grant and revoke', async () => {
        // Regression guard: any handler that writes audit_logs directly instead
        // of going through recordAudit inserts an unlinked row and breaks the
        // chain here. Consent revoke did exactly that before Phase 2.
        const fixtures = await seedFixtures();
        const patientToken = await login(fixtures.patient.users.email);

        const granted = await agent()
            .post('/api/v1/consent/grant')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                doctor_id: fixtures.doctor.doctor_id,
                allowed_categories: ['PRESCRIPTION'],
                blocked_categories: [],
                valid_until: new Date(Date.now() + 86_400_000).toISOString(),
            });
        expect(granted.status).toBe(201);

        const revoked = await agent()
            .post(`/api/v1/consent/${granted.body.consent_id}/revoke`)
            .set('Authorization', `Bearer ${patientToken}`);
        expect(revoked.status).toBe(200);

        // Let the deferred middleware writes settle.
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const result = await verifyChain();
        expect(result.firstBreak).toBeUndefined();
        expect(result.intact).toBe(true);

        await db.consents.delete({ where: { consent_id: granted.body.consent_id } }).catch(() => undefined);
    });

    it('records denied requests, not only successful ones', async () => {
        const before = await db.audit_logs.count();

        const denied = await agent().post('/api/v1/consent/grant').send({ doctor_id: 'nope' });
        expect(denied.status).toBe(401);

        // The audit write is deliberately deferred until after the response is
        // flushed, so poll rather than assume a fixed delay.
        let after = before;
        for (let attempt = 0; attempt < 20 && after === before; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            after = await db.audit_logs.count();
        }

        expect(after).toBeGreaterThan(before);

        const latest = await db.audit_logs.findFirst({ orderBy: { log_id: 'desc' } });
        expect(latest?.status_code).toBe(401);
        expect(latest?.details).toMatchObject({ outcome: 'DENIED_OR_FAILED' });
    });
});
