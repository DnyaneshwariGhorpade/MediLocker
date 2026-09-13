/**
 * Resets the audit hash chain (development only).
 *
 * Entries written before chaining existed have no valid predecessor hash, so
 * `GET /api/v1/admin/audit-logs/verify-chain` reports a permanent break at the
 * first of them. There are two ways to resolve that:
 *
 *   1. Development: delete the legacy rows and start a clean chain — this script.
 *   2. Production: keep the rows for retention and set AUDIT_CHAIN_GENESIS_LOG_ID
 *      to the first log_id written by the chained code, so verification starts
 *      there. Run with `--genesis` to print that value instead of deleting.
 *
 *   npx tsx scripts/resetAuditChain.ts [--genesis]
 */

import { db } from '../src/services/db';
import { env } from '../src/config/env';
import { verifyChain } from '../src/services/auditLog';

async function main() {
    if (env.isProduction) {
        throw new Error('Refusing to run: NODE_ENV is production.');
    }

    const genesisOnly = process.argv.includes('--genesis');

    const before = await verifyChain();
    console.log(`Chain before: intact=${before.intact} checked=${before.checked}`);
    if (before.firstBreak) {
        console.log(`  first break at log_id ${before.firstBreak.logId} (${before.firstBreak.reason})`);
    }

    if (genesisOnly) {
        // The first row that verifies cleanly onward is the practical genesis.
        const candidate = before.firstBreak ? BigInt(before.firstBreak.logId) + 1n : null;
        console.log(
            candidate === null
                ? 'Chain is already intact; no genesis override needed.'
                : `Set AUDIT_CHAIN_GENESIS_LOG_ID=${candidate} and re-run verification.`
        );
        await db.$disconnect();
        return;
    }

    const count = await db.audit_logs.count();
    console.log(`Deleting ${count} audit log entries...`);

    // The immutability trigger blocks DELETE by design; suspend it only here.
    await db.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable');
    try {
        await db.$executeRawUnsafe('DELETE FROM audit_logs');
    } finally {
        await db.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable');
    }

    const after = await verifyChain();
    console.log(`Chain after: intact=${after.intact} checked=${after.checked}`);
    await db.$disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
});
