import crypto from 'crypto';
import { db } from './db';

/**
 * Append-only, hash-chained integrity ledger.
 *
 * This provides the tamper-evidence property the architecture document assigns
 * to Hyperledger Fabric, without the operational cost of a permissioned
 * network. Each entry commits to the previous entry's hash, so altering or
 * removing any entry is detectable. A database trigger blocks UPDATE and
 * DELETE, so append-only is enforced below the application.
 *
 * It is deliberately *not* described as a blockchain: there is no distributed
 * consensus and no independent party attesting to the chain. What it does give
 * is: if a stored document changes, the mismatch is provable against a record
 * that cannot be quietly rewritten.
 */

const CHAIN_LOCK_KEY = 4_915_022;

export interface LedgerEntryInput {
    subjectType: 'MEDICAL_RECORD' | 'CONSENT_REVOCATION';
    subjectId: string;
    payloadSha256: string;
    metadata?: Record<string, unknown>;
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
        .join(',')}}`;
}

function hashEntry(
    input: LedgerEntryInput,
    previousHash: string | null,
    createdAt: Date
): string {
    return crypto
        .createHash('sha256')
        .update(
            stableStringify([
                previousHash ?? '',
                input.subjectType,
                input.subjectId,
                input.payloadSha256,
                stableStringify(input.metadata ?? {}),
                createdAt.toISOString(),
            ])
        )
        .digest('hex');
}

export interface LedgerEntry {
    entryId: string;
    entryHash: string;
    previousHash: string | null;
    createdAt: Date;
}

/** Appends one entry, serialised so concurrent writes cannot fork the chain. */
export async function appendEntry(input: LedgerEntryInput): Promise<LedgerEntry> {
    return db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', CHAIN_LOCK_KEY);

        const previous = await tx.ledger_entries.findFirst({
            orderBy: { entry_id: 'desc' },
            select: { entry_hash: true },
        });

        const previousHash = previous?.entry_hash ?? null;
        const createdAt = new Date();
        const entryHash = hashEntry(input, previousHash, createdAt);

        const entry = await tx.ledger_entries.create({
            data: {
                subject_type: input.subjectType,
                subject_id: input.subjectId,
                payload_sha256: input.payloadSha256,
                previous_hash: previousHash,
                entry_hash: entryHash,
                metadata: (input.metadata ?? {}) as object,
                created_at: createdAt,
            },
        });

        return {
            entryId: entry.entry_id.toString(),
            entryHash,
            previousHash,
            createdAt,
        };
    });
}

/** Looks up the most recent entry committing to a given digest. */
export async function findByPayload(payloadSha256: string) {
    return db.ledger_entries.findFirst({
        where: { payload_sha256: payloadSha256.toLowerCase() },
        orderBy: { entry_id: 'desc' },
    });
}

export interface LedgerVerification {
    intact: boolean;
    checked: number;
    firstBreak?: {
        entryId: string;
        reason: 'PREVIOUS_HASH_MISMATCH' | 'ENTRY_HASH_MISMATCH';
        expected: string;
        found: string;
        createdAt: Date;
    };
}

/** Walks the whole chain and reports the first inconsistency. */
export async function verifyLedger(limit = 100_000): Promise<LedgerVerification> {
    const entries = await db.ledger_entries.findMany({ orderBy: { entry_id: 'asc' }, take: limit });

    let previousHash: string | null = null;
    let checked = 0;

    for (const entry of entries) {
        checked += 1;

        if ((entry.previous_hash ?? null) !== previousHash) {
            return {
                intact: false,
                checked,
                firstBreak: {
                    entryId: entry.entry_id.toString(),
                    reason: 'PREVIOUS_HASH_MISMATCH',
                    expected: previousHash ?? '(none)',
                    found: entry.previous_hash ?? '(none)',
                    createdAt: entry.created_at,
                },
            };
        }

        const recomputed = hashEntry(
            {
                subjectType: entry.subject_type as LedgerEntryInput['subjectType'],
                subjectId: entry.subject_id,
                payloadSha256: entry.payload_sha256,
                metadata: entry.metadata as Record<string, unknown>,
            },
            entry.previous_hash ?? null,
            entry.created_at
        );

        if (recomputed !== entry.entry_hash) {
            return {
                intact: false,
                checked,
                firstBreak: {
                    entryId: entry.entry_id.toString(),
                    reason: 'ENTRY_HASH_MISMATCH',
                    expected: recomputed,
                    found: entry.entry_hash,
                    createdAt: entry.created_at,
                },
            };
        }

        previousHash = entry.entry_hash;
    }

    return { intact: true, checked };
}
