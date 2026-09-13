import crypto from 'crypto';
import { db } from './db';
import { env } from '../config/env';

export interface AuditEntry {
    userId?: string | null;
    userRole?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    statusCode?: number;
    details?: Record<string, unknown>;
}

/**
 * Postgres advisory lock key. Chain writes are serialised so two concurrent
 * requests cannot both read the same tail and produce a fork.
 */
const CHAIN_LOCK_KEY = 4_915_021;

/**
 * Deterministic JSON with recursively sorted object keys.
 *
 * `details` is stored in a jsonb column, and Postgres does not preserve key
 * insertion order. Hashing plain `JSON.stringify` output would therefore
 * produce a different digest on read than on write, breaking verification for
 * entries that happen to have their keys reordered.
 */
function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);

    return `{${entries.join(',')}}`;
}

/** Fields that are hashed, in a fixed order, to produce the entry digest. */
function canonicalise(entry: AuditEntry, previousHash: string | null, createdAt: Date): string {
    return stableStringify([
        previousHash ?? '',
        entry.userId ?? '',
        entry.userRole ?? '',
        entry.action,
        entry.resourceType,
        entry.resourceId ?? '',
        entry.ipAddress ?? '',
        entry.statusCode ?? 200,
        stableStringify(entry.details ?? {}),
        createdAt.toISOString(),
    ]);
}

export function hashEntry(entry: AuditEntry, previousHash: string | null, createdAt: Date): string {
    return crypto.createHash('sha256').update(canonicalise(entry, previousHash, createdAt)).digest('hex');
}

/**
 * Appends one tamper-evident entry. Each row's hash covers the previous row's
 * hash, so altering or removing any entry breaks verification from that point
 * onward.
 *
 * Never throws: a failure to record an audit entry must not fail the user's
 * request, but it is logged loudly because it is a compliance gap.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
    try {
        await db.$transaction(async (tx) => {
            // Serialise chain appends across all application instances.
            await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', CHAIN_LOCK_KEY);

            const previous = await tx.audit_logs.findFirst({
                orderBy: { log_id: 'desc' },
                select: { event_sha256_hash: true },
            });

            const previousHash = previous?.event_sha256_hash ?? null;
            const createdAt = new Date();

            await tx.audit_logs.create({
                data: {
                    user_id: entry.userId ?? null,
                    user_role: entry.userRole ?? null,
                    action: entry.action,
                    resource_type: entry.resourceType,
                    resource_id: entry.resourceId ?? null,
                    ip_address: entry.ipAddress ?? null,
                    user_agent: entry.userAgent ?? null,
                    status_code: entry.statusCode ?? 200,
                    details: (entry.details ?? {}) as object,
                    event_sha256_hash: hashEntry(entry, previousHash, createdAt),
                    previous_log_hash: previousHash,
                    created_at: createdAt,
                },
            });
        });
    } catch (error) {
        console.error('AUDIT WRITE FAILED — compliance gap:', entry.action, entry.resourceType, error);
    }
}

export interface ChainVerification {
    intact: boolean;
    checked: number;
    firstBreak?: {
        logId: string;
        eventId: string;
        createdAt: Date;
        reason: 'PREVIOUS_HASH_MISMATCH' | 'ENTRY_HASH_MISMATCH';
        expected: string;
        found: string;
    };
}

/**
 * Walks the chain from the beginning and reports the first inconsistency.
 * Detects both a rewritten link (`previous_log_hash` no longer matching the
 * prior row) and a mutated payload (`event_sha256_hash` no longer matching the
 * row's own contents).
 */
export async function verifyChain(limit = 100_000): Promise<ChainVerification> {
    // Rows written before chaining was introduced have no usable predecessor
    // hash. AUDIT_CHAIN_GENESIS_LOG_ID marks where the chain begins so those
    // legacy rows are excluded rather than reported as a permanent break.
    // Unset means the chain starts at the first row.
    const genesis = env.auditChainGenesisLogId;

    const logs = await db.audit_logs.findMany({
        where: genesis === null ? undefined : { log_id: { gte: genesis } },
        orderBy: { log_id: 'asc' },
        take: limit,
    });

    // When verifying a window that starts mid-table, anchor on that first row's
    // recorded predecessor instead of null, which only applies to a true genesis.
    let previousHash: string | null = genesis === null ? null : logs[0]?.previous_log_hash ?? null;
    let checked = 0;

    for (const log of logs) {
        checked += 1;

        if ((log.previous_log_hash ?? null) !== previousHash) {
            return {
                intact: false,
                checked,
                firstBreak: {
                    logId: log.log_id.toString(),
                    eventId: log.event_id,
                    createdAt: log.created_at,
                    reason: 'PREVIOUS_HASH_MISMATCH',
                    expected: previousHash ?? '(none)',
                    found: log.previous_log_hash ?? '(none)',
                },
            };
        }

        const recomputed = hashEntry(
            {
                userId: log.user_id,
                userRole: log.user_role,
                action: log.action,
                resourceType: log.resource_type,
                resourceId: log.resource_id,
                ipAddress: log.ip_address,
                statusCode: log.status_code,
                details: log.details as Record<string, unknown>,
            },
            log.previous_log_hash ?? null,
            log.created_at
        );

        if (recomputed !== log.event_sha256_hash) {
            return {
                intact: false,
                checked,
                firstBreak: {
                    logId: log.log_id.toString(),
                    eventId: log.event_id,
                    createdAt: log.created_at,
                    reason: 'ENTRY_HASH_MISMATCH',
                    expected: recomputed,
                    found: log.event_sha256_hash,
                },
            };
        }

        previousHash = log.event_sha256_hash;
    }

    return { intact: true, checked };
}
