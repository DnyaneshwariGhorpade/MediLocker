import crypto from 'crypto';
import cron, { ScheduledTask } from 'node-cron';
import { db } from '../services/db';
import { env } from '../config/env';
import { recordAudit } from '../services/auditLog';
import { invalidateConsentCache } from '../services/access';
import { deliverPending } from '../services/notificationDelivery';
import { getObjectStorage } from '../services/objectStorage';
import { deserialiseWrappedKey, retrieveAndDecrypt } from '../services/recordCrypto';

/**
 * Scheduled background work.
 *
 * `node-cron` runs these in-process. That is adequate for a single instance;
 * with several replicas each would run the same sweep, so a Postgres advisory
 * lock guards every job — only one instance does the work per tick.
 */

export interface JobResult {
    name: string;
    ranAt: Date;
    durationMs: number;
    summary: Record<string, unknown>;
}

const lastResults = new Map<string, JobResult>();

/** Distinct advisory lock per job, so different jobs do not block each other. */
const LOCK_KEYS: Record<string, number> = {
    expireBreakGlass: 5_100_001,
    expireConsents: 5_100_002,
    consentReminders: 5_100_003,
    integritySweep: 5_100_004,
    deliverNotifications: 5_100_005,
};

/**
 * Runs `work` only if this instance wins the advisory lock. Returns null when
 * another instance is already running the same job.
 */
async function withLock<T>(job: string, work: () => Promise<T>): Promise<T | null> {
    const key = LOCK_KEYS[job];
    if (key === undefined) throw new Error(`No lock key registered for job "${job}"`);

    const [row] = await db.$queryRawUnsafe<{ locked: boolean }[]>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        key
    );

    if (!row?.locked) return null;

    try {
        return await work();
    } finally {
        await db.$executeRawUnsafe('SELECT pg_advisory_unlock($1)', key);
    }
}

async function run(name: string, work: () => Promise<Record<string, unknown>>): Promise<JobResult | null> {
    const startedAt = Date.now();
    try {
        const summary = await withLock(name, work);
        if (summary === null) return null;

        const result: JobResult = {
            name,
            ranAt: new Date(),
            durationMs: Date.now() - startedAt,
            summary,
        };
        lastResults.set(name, result);
        return result;
    } catch (error: any) {
        const result: JobResult = {
            name,
            ranAt: new Date(),
            durationMs: Date.now() - startedAt,
            summary: { error: error.message ?? 'unknown error' },
        };
        lastResults.set(name, result);
        console.error(`[jobs] ${name} failed:`, error);
        return result;
    }
}

// ------------------------------------------------------------------- jobs

/**
 * P5-04. Expiry was previously evaluated only when a session was read, so an
 * abandoned session stayed nominally ACTIVE indefinitely.
 */
export async function expireBreakGlassSessions() {
    return run('expireBreakGlass', async () => {
        const now = new Date();

        const expiring = await db.break_glass_access_sessions.findMany({
            where: {
                session_status: { in: ['ACTIVE', 'PENDING_APPROVAL'] },
                session_expires_at: { lt: now },
            },
            select: { session_id: true, patient_id: true, doctor_id: true, session_status: true },
        });

        if (expiring.length === 0) return { expired: 0 };

        await db.break_glass_access_sessions.updateMany({
            where: { session_id: { in: expiring.map((session) => session.session_id) } },
            data: { session_status: 'EXPIRED', verification_otp_hash: null },
        });

        for (const session of expiring) {
            await recordAudit({
                action: 'BREAK_GLASS_EXPIRED',
                resourceType: 'BREAK_GLASS_SESSION',
                resourceId: session.session_id,
                userRole: 'SYSTEM',
                details: { previousStatus: session.session_status },
            });
        }

        return { expired: expiring.length };
    });
}

/** P5-05a. Marks lapsed consents EXPIRED and drops their cached decisions. */
export async function expireConsents() {
    return run('expireConsents', async () => {
        const now = new Date();

        const lapsed = await db.consents.findMany({
            where: { consent_status: 'ACTIVE', valid_until: { lt: now } },
            select: { consent_id: true, patient_id: true, doctor_id: true },
        });

        if (lapsed.length === 0) return { expired: 0 };

        await db.consents.updateMany({
            where: { consent_id: { in: lapsed.map((consent) => consent.consent_id) } },
            data: { consent_status: 'EXPIRED' },
        });

        for (const consent of lapsed) {
            await invalidateConsentCache(consent.patient_id, consent.doctor_id);
            await recordAudit({
                action: 'CONSENT_EXPIRED',
                resourceType: 'CONSENT',
                resourceId: consent.consent_id,
                userRole: 'SYSTEM',
            });
        }

        return { expired: lapsed.length };
    });
}

/** P5-05b. Warns patients 24 hours before a grant lapses (Screen 3.6). */
export async function sendConsentExpiryReminders() {
    return run('consentReminders', async () => {
        const now = new Date();
        const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const expiringSoon = await db.consents.findMany({
            where: {
                consent_status: 'ACTIVE',
                valid_until: { gt: now, lte: cutoff },
                expiry_reminder_sent_at: null,
            },
            include: {
                patients: { select: { user_id: true } },
                doctors: { select: { last_name: true } },
            },
        });

        for (const consent of expiringSoon) {
            await db.notifications.create({
                data: {
                    user_id: consent.patients.user_id,
                    event_type: 'CONSENT_REQUIRED',
                    channel: 'IN_APP',
                    title: 'Doctor access expires soon',
                    message:
                        `Your data-sharing permission for Dr. ${consent.doctors.last_name} expires on ` +
                        `${consent.valid_until.toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
                    payload_json: { consent_id: consent.consent_id },
                },
            });

            await db.consents.update({
                where: { consent_id: consent.consent_id },
                data: { expiry_reminder_sent_at: now },
            });
        }

        return { reminded: expiringSoon.length };
    });
}

/**
 * P5-06. Re-reads stored objects, decrypts them and compares the digest with
 * what the record claims. A mismatch means the object and the record have
 * diverged — exactly what the integrity story is supposed to detect.
 */
export async function runIntegritySweep(batchSize = 25) {
    return run('integritySweep', async () => {
        const records = await db.medical_records.findMany({
            where: { is_deleted: false, storage_driver: { not: 'MOCK' } },
            orderBy: [{ integrity_checked_at: { sort: 'asc', nulls: 'first' } }],
            take: batchSize,
        });

        let verified = 0;
        let mismatched = 0;
        let missing = 0;

        for (const record of records) {
            let status: 'VERIFIED' | 'MISMATCH' | 'MISSING' = 'VERIFIED';

            try {
                const plaintext = await retrieveAndDecrypt({
                    storageKey: record.file_s3_key,
                    iv: record.iv_bytes,
                    wrappedKey: deserialiseWrappedKey(
                        record.encrypted_dek,
                        record.dek_auth_tag ?? '',
                        record.kms_key_id
                    ),
                });

                const digest = crypto.createHash('sha256').update(plaintext).digest('hex');
                if (digest !== record.file_sha256_hash) status = 'MISMATCH';
            } catch (error: any) {
                // A decryption failure is itself an integrity signal: either the
                // object is gone, or its authentication tag no longer verifies.
                const absent = !(await getObjectStorage().exists(record.file_s3_key));
                status = absent ? 'MISSING' : 'MISMATCH';
                void error;
            }

            await db.medical_records.update({
                where: { record_id: record.record_id },
                data: { integrity_status: status, integrity_checked_at: new Date() },
            });

            if (status === 'VERIFIED') verified += 1;
            else if (status === 'MISMATCH') mismatched += 1;
            else missing += 1;

            if (status !== 'VERIFIED') {
                await recordAudit({
                    action: 'INTEGRITY_ALERT',
                    resourceType: 'MEDICAL_RECORD',
                    resourceId: record.record_id,
                    userRole: 'SYSTEM',
                    statusCode: 409,
                    details: { status, expected: record.file_sha256_hash },
                });
                console.error(`[integrity] ${status} for record ${record.record_id}`);
            }
        }

        return { checked: records.length, verified, mismatched, missing };
    });
}

/** P5-07. Drains the notification outbox. */
export async function deliverNotifications() {
    return run('deliverNotifications', async () => {
        const result = await deliverPending();
        return { ...result };
    });
}

// -------------------------------------------------------------- scheduling

let tasks: ScheduledTask[] = [];

/** Starts every schedule. Called from the server entry point. */
export function startScheduler(): void {
    if (!env.schedulerEnabled) {
        console.log('Scheduler disabled (SCHEDULER_ENABLED=false).');
        return;
    }

    const schedules: Array<[string, string, () => Promise<unknown>]> = [
        ['expire break-glass sessions', '* * * * *', expireBreakGlassSessions],
        ['expire consents', '*/5 * * * *', expireConsents],
        ['consent expiry reminders', '0 * * * *', sendConsentExpiryReminders],
        ['deliver notifications', '*/1 * * * *', deliverNotifications],
        ['integrity sweep', '*/30 * * * *', () => runIntegritySweep()],
    ];

    tasks = schedules.map(([label, expression, work]) =>
        cron.schedule(expression, () => {
            void work().catch((error) => console.error(`[jobs] ${label} threw:`, error));
        })
    );

    console.log(`Scheduler started with ${tasks.length} jobs.`);
}

export function stopScheduler(): void {
    for (const task of tasks) void task.stop();
    tasks = [];
}

/** Most recent outcome per job, surfaced on the system-health screen. */
export function getJobStatus(): JobResult[] {
    return [...lastResults.values()].sort((a, b) => b.ranAt.getTime() - a.ranAt.getTime());
}
