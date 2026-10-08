import crypto from 'crypto';
import { generateSecret as otpGenerateSecret, generateURI, verify as otpVerify } from 'otplib';
import { db } from './db';
import { env } from '../config/env';
import { getKeyProvider } from './keyProvider';
import { deserialiseWrappedKey, serialiseWrappedKey } from './recordCrypto';

const BACKUP_CODE_COUNT = 10;

/** TOTP period in seconds; tolerance is expressed in seconds in otplib v13. */
const TOTP_PERIOD_SECONDS = 30;

/**
 * The TOTP secret is stored encrypted rather than in plaintext: a database
 * read alone must not yield a working second factor. It reuses the same key
 * provider as the file pipeline.
 *
 * `users.mfa_secret` is VARCHAR(128), so the envelope is packed as
 * `iv:ciphertext:authTag` in base64, which fits comfortably for a 20-byte
 * base32 secret.
 */
export async function encryptSecret(secret: string): Promise<string> {
    const provider = getKeyProvider();
    const wrapped = await provider.wrap(Buffer.from(secret, 'utf8'));
    return `${serialiseWrappedKey(wrapped)}:${wrapped.authTag}`;
}

export async function decryptSecret(stored: string): Promise<string> {
    const provider = getKeyProvider();
    const lastColon = stored.lastIndexOf(':');
    if (lastColon === -1) {
        throw new Error('Stored MFA secret is malformed.');
    }
    const envelope = stored.slice(0, lastColon);
    const authTag = stored.slice(lastColon + 1);
    const wrapped = deserialiseWrappedKey(envelope, authTag, provider.keyId);
    const plaintext = await provider.unwrap(wrapped);
    return plaintext.toString('utf8');
}

export function generateSecret(): string {
    return otpGenerateSecret();
}

/** Builds the otpauth:// URI an authenticator app scans. */
export function buildOtpAuthUri(secret: string, accountName: string): string {
    return generateURI({ secret, label: accountName, issuer: env.totpIssuer });
}

/**
 * Verifies a TOTP code, allowing `TOTP_WINDOW` periods of clock drift either
 * side of now. otplib v13 expresses tolerance in seconds, so the configured
 * window is multiplied by the period.
 */
export async function verifyTotp(secret: string, token: string): Promise<boolean> {
    try {
        const result = await otpVerify({
            secret,
            token,
            epochTolerance: env.totpWindow * TOTP_PERIOD_SECONDS,
        });
        return result.valid === true;
    } catch {
        return false;
    }
}

const hashCode = (code: string): string =>
    crypto.createHash('sha256').update(code.replace(/[\s-]/g, '').toUpperCase()).digest('hex');

/**
 * Replaces any existing backup codes with a fresh set and returns the
 * plaintext, which is shown to the user exactly once.
 */
export async function issueBackupCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => {
        const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 chars
        return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });

    await db.$transaction([
        db.mfa_backup_codes.deleteMany({ where: { user_id: userId } }),
        db.mfa_backup_codes.createMany({
            data: codes.map((code) => ({ user_id: userId, code_hash: hashCode(code) })),
        }),
    ], { timeout: 30000 });

    return codes;
}

/**
 * Consumes a backup code. Each code works once; a used code is marked rather
 * than deleted so the audit trail can show it was spent.
 */
export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
    const match = await db.mfa_backup_codes.findFirst({
        where: { user_id: userId, code_hash: hashCode(code), used_at: null },
    });

    if (!match) return false;

    const claimed = await db.mfa_backup_codes.updateMany({
        where: { code_id: match.code_id, used_at: null },
        data: { used_at: new Date() },
    });

    // updateMany returns 0 if another request consumed it first.
    return claimed.count === 1;
}

export async function countUnusedBackupCodes(userId: string): Promise<number> {
    return db.mfa_backup_codes.count({ where: { user_id: userId, used_at: null } });
}
