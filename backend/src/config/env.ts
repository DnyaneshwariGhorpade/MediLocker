import dotenv from 'dotenv';

dotenv.config();

/**
 * Values that were previously hardcoded as insecure fallbacks. If any of these
 * ever appears in the environment the process must refuse to start rather than
 * silently run with a secret that is public in the repository history.
 */
const BANNED_SECRETS = new Set([
    'fallback-secret-key-for-dev',
    'secret',
    'changeme',
]);

const MIN_SECRET_LENGTH = 32;

const errors: string[] = [];

function required(name: string): string {
    const value = process.env[name];
    if (!value || value.trim() === '') {
        errors.push(`${name} is required but was not set.`);
        return '';
    }
    return value.trim();
}

function optional(name: string, fallback: string): string {
    const value = process.env[name];
    return value && value.trim() !== '' ? value.trim() : fallback;
}

function integer(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw || raw.trim() === '') return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
        errors.push(`${name} must be an integer, received "${raw}".`);
        return fallback;
    }
    return parsed;
}

function bigintOrNull(name: string): bigint | null {
    const raw = process.env[name];
    if (!raw || raw.trim() === '') return null;
    try {
        return BigInt(raw.trim());
    } catch {
        errors.push(`${name} must be an integer, received "${raw}".`);
        return null;
    }
}

function secret(name: string): string {
    const value = required(name);
    if (!value) return '';
    if (BANNED_SECRETS.has(value)) {
        errors.push(`${name} is set to a known insecure placeholder. Generate a new value.`);
    }
    if (value.length < MIN_SECRET_LENGTH) {
        errors.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters, received ${value.length}.`);
    }
    return value;
}

const nodeEnv = optional('NODE_ENV', 'development');
const databaseUrl = required('DATABASE_URL');

export const env = {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    port: integer('PORT', 3000),

    databaseUrl,
    directUrl: optional('DIRECT_URL', databaseUrl),

    jwtSecret: secret('JWT_SECRET'),
    /** Lifetime of the short-lived token issued between password and MFA. */
    mfaTokenTtl: optional('MFA_TOKEN_TTL', '5m'),
    /** Lifetime of the session token issued after successful MFA. */
    sessionTokenTtl: optional('SESSION_TOKEN_TTL', '2h'),

    bcryptRounds: integer('BCRYPT_ROUNDS', 10),

    /** Comma-separated list of browser origins permitted to call the API. */
    corsOrigins: optional('CORS_ORIGIN', 'http://localhost:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),

    /** Failed password attempts tolerated before the account is locked. */
    maxFailedLogins: integer('MAX_FAILED_LOGINS', 10),
    lockoutMinutes: integer('LOCKOUT_MINUTES', 15),

    // ------------------------------------------------- file pipeline
    /** Base64 32-byte master key used to wrap per-file data keys. */
    kmsMasterKey: optional('KMS_MASTER_KEY', ''),
    storageDriver: optional('STORAGE_DRIVER', 'LOCAL').toUpperCase() as 'LOCAL' | 'S3',
    storagePath: optional('STORAGE_PATH', './storage'),
    maxUploadBytes: integer('MAX_UPLOAD_BYTES', 25 * 1024 * 1024),

    /** Minutes a signed download link stays valid. */
    downloadTokenMinutes: integer('DOWNLOAD_TOKEN_MINUTES', 5),

    /** AWS region used by KMS and S3 when those drivers are selected. */
    awsRegion: optional('AWS_REGION', 'ap-south-1'),
    awsKmsKeyId: optional('AWS_KMS_KEY_ID', ''),
    s3Bucket: optional('S3_BUCKET', ''),
    keyProviderDriver: optional('KEY_PROVIDER', 'LOCAL').toUpperCase() as 'LOCAL' | 'KMS',

    // -------------------------------------------------- platform services
    /** Optional. Without it, consent caching falls back to an in-process map. */
    redisUrl: optional('REDIS_URL', ''),
    schedulerEnabled: optional('SCHEDULER_ENABLED', 'true').toLowerCase() !== 'false',

    smtpHost: optional('SMTP_HOST', ''),
    smtpPort: integer('SMTP_PORT', 587),
    smtpUser: optional('SMTP_USER', ''),
    smtpPassword: optional('SMTP_PASSWORD', ''),
    smtpFrom: optional('SMTP_FROM', ''),

    smsApiUrl: optional('SMS_API_URL', ''),
    smsApiKey: optional('SMS_API_KEY', ''),

    // ------------------------------------------------ crypto identity
    /** Issuer shown in the authenticator app. */
    totpIssuer: optional('TOTP_ISSUER', 'MediLocker'),
    /** Periods either side of now accepted, to tolerate clock drift. */
    totpWindow: integer('TOTP_WINDOW', 1),
    /** Absolute URL of the public verifier, embedded in prescription QR codes. */
    publicVerifyUrl: optional('PUBLIC_VERIFY_URL', 'http://localhost:5173/verify'),

    /** Minutes a break-glass approval code stays valid. */
    emergencyCodeMinutes: integer('EMERGENCY_CODE_MINUTES', 10),

    /**
     * First log_id that belongs to the hash chain. Rows written before
     * chaining was introduced have no valid predecessor hash and would
     * otherwise be reported as a permanent break. Unset means the chain
     * starts at the first row.
     */
    auditChainGenesisLogId: bigintOrNull('AUDIT_CHAIN_GENESIS_LOG_ID'),

    rateLimitWindowMinutes: integer('RATE_LIMIT_WINDOW_MINUTES', 15),
    rateLimitMaxRequests: integer('RATE_LIMIT_MAX_REQUESTS', 300),
    authRateLimitMaxRequests: integer('AUTH_RATE_LIMIT_MAX_REQUESTS', 10),
};

if (errors.length > 0) {
    const message = [
        'Invalid environment configuration:',
        ...errors.map((line) => `  - ${line}`),
        '',
        'See backend/.env.example. Generate a secret with:',
        '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    ].join('\n');

    throw new Error(message);
}
