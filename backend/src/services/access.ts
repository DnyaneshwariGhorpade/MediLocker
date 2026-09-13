import { db } from './db';
import { getCache, recordCacheHit, recordCacheMiss, recordConsentLatency } from './cache';

/** Cache key for one patient/doctor pairing. */
const consentKey = (patientId: string, doctorId: string) => `consent:${patientId}:${doctorId}`;

/**
 * Drops every cached decision for a patient.
 *
 * Called whenever consent changes so a revocation takes effect on the next
 * request rather than when the entry happens to expire.
 */
export async function invalidateConsentCache(patientId: string, doctorId?: string): Promise<void> {
    const cache = getCache();
    await cache.del(doctorId ? consentKey(patientId, doctorId) : `consent:${patientId}:*`);
}

interface CachedConsent {
    allowed: string[];
    blocked: string[];
    accessLevel: 'READ_ONLY' | 'DOWNLOAD';
    hasConsent: boolean;
    /** Earliest expiry among the contributing grants, as an epoch millisecond. */
    validUntil: number | null;
}

export interface ResolvedConsent {
    /** Categories permitted by at least one active consent and blocked by none. */
    allowed: Set<string>;
    /** Categories blocked by any active consent. Blocking always wins. */
    blocked: Set<string>;
    /** DOWNLOAD only when some active consent granting access permits it. */
    accessLevel: 'READ_ONLY' | 'DOWNLOAD';
    /** True when at least one active consent exists for this pairing. */
    hasConsent: boolean;
}

/**
 * Combines every active consent between a patient and a doctor into one
 * decision.
 *
 * A patient may hold several overlapping grants. Blocking a category is a
 * deliberate privacy act, so a block in any active consent overrides an allow
 * in another — matching what the consent screen tells the patient it will do.
 */
export async function resolveConsent(patientId: string, doctorId: string): Promise<ResolvedConsent> {
    const startedAt = performance.now();
    const cache = getCache();
    const key = consentKey(patientId, doctorId);

    const cached = await cache.get(key);
    if (cached) {
        try {
            const parsed = JSON.parse(cached) as CachedConsent;
            // A cached decision is only usable while the grant behind it lives.
            if (parsed.validUntil === null || parsed.validUntil > Date.now()) {
                recordCacheHit();
                recordConsentLatency(performance.now() - startedAt);
                return {
                    allowed: new Set(parsed.allowed),
                    blocked: new Set(parsed.blocked),
                    accessLevel: parsed.accessLevel,
                    hasConsent: parsed.hasConsent,
                };
            }
        } catch {
            // A malformed entry is treated as a miss.
        }
    }

    recordCacheMiss();

    const consents = await db.consents.findMany({
        where: {
            patient_id: patientId,
            doctor_id: doctorId,
            consent_status: 'ACTIVE',
            valid_until: { gte: new Date() },
        },
        select: {
            allowed_categories: true,
            blocked_categories: true,
            access_level: true,
            valid_until: true,
        },
    });

    const allowed = new Set<string>();
    const blocked = new Set<string>();
    let accessLevel: 'READ_ONLY' | 'DOWNLOAD' = 'READ_ONLY';
    let earliestExpiry: number | null = null;

    for (const consent of consents) {
        for (const category of consent.allowed_categories) allowed.add(category);
        for (const category of consent.blocked_categories) blocked.add(category);
        if (consent.access_level === 'DOWNLOAD') accessLevel = 'DOWNLOAD';

        const expiry = consent.valid_until.getTime();
        if (earliestExpiry === null || expiry < earliestExpiry) earliestExpiry = expiry;
    }

    for (const category of blocked) allowed.delete(category);

    const resolved: ResolvedConsent = { allowed, blocked, accessLevel, hasConsent: consents.length > 0 };

    // TTL never outlives the earliest contributing grant, and is capped so a
    // long-lived grant still gets re-read periodically.
    const secondsUntilExpiry =
        earliestExpiry === null ? 60 : Math.floor((earliestExpiry - Date.now()) / 1000);
    const ttl = Math.max(0, Math.min(secondsUntilExpiry, 300));

    if (ttl > 0) {
        const payload: CachedConsent = {
            allowed: [...allowed],
            blocked: [...blocked],
            accessLevel,
            hasConsent: resolved.hasConsent,
            validUntil: earliestExpiry,
        };
        await cache.set(key, JSON.stringify(payload), ttl);
    }

    recordConsentLatency(performance.now() - startedAt);
    return resolved;
}

/** True when an active break-glass session covers this doctor and patient. */
export async function hasActiveBreakGlass(patientId: string, doctorId: string): Promise<boolean> {
    const session = await db.break_glass_access_sessions.findFirst({
        where: {
            patient_id: patientId,
            doctor_id: doctorId,
            session_status: 'ACTIVE',
            session_expires_at: { gt: new Date() },
        },
        select: { session_id: true },
    });
    return session !== null;
}

/**
 * Decides whether a caller may see a specific medical record.
 *
 * - A patient may see their own records.
 * - A doctor may see a record when the combined consent allows its category.
 * - An active break-glass session grants a doctor temporary access.
 *
 * Centralised so every read path applies the same rule. Phase 5 replaces the
 * consent lookup with a Redis-backed cache behind this same signature.
 */
export async function canAccessRecord(userId: string, role: string, recordId: string): Promise<boolean> {
    const record = await db.medical_records.findUnique({
        where: { record_id: recordId },
        select: { patient_id: true, category: true, is_deleted: true },
    });

    if (!record || record.is_deleted) return false;

    if (role === 'PATIENT') {
        const patient = await db.patients.findUnique({
            where: { user_id: userId },
            select: { patient_id: true },
        });
        return patient?.patient_id === record.patient_id;
    }

    if (role === 'DOCTOR' || role === 'EMERGENCY_PHYSICIAN') {
        const doctor = await db.doctors.findUnique({
            where: { user_id: userId },
            select: { doctor_id: true },
        });
        if (!doctor) return false;

        const consent = await resolveConsent(record.patient_id, doctor.doctor_id);
        if (consent.allowed.has(record.category)) return true;

        // Break-glass does not override an explicit block: the patient blocked
        // that category deliberately, and the emergency snapshot is built from
        // categories they did not.
        if (consent.blocked.has(record.category)) return false;

        return hasActiveBreakGlass(record.patient_id, doctor.doctor_id);
    }

    return false;
}
