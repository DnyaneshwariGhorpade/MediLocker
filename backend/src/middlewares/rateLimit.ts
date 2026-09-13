import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const windowMs = env.rateLimitWindowMinutes * 60 * 1000;

const message = (retryAfterMinutes: number) => ({
    message: `Too many requests. Try again in about ${retryAfterMinutes} minute(s).`,
});

/** Baseline limit applied to the whole API. */
export const globalLimiter = rateLimit({
    windowMs,
    limit: env.rateLimitMaxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: message(env.rateLimitWindowMinutes),
    // Tests and local scripts would otherwise trip the limiter.
    skip: () => env.isTest,
});

/**
 * Strict limit for credential and verification endpoints. Applies per IP; the
 * per-account lockout in the login handler covers distributed attempts against
 * a single account.
 */
export const authLimiter = rateLimit({
    windowMs,
    limit: env.authRateLimitMaxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: message(env.rateLimitWindowMinutes),
    skip: () => env.isTest,
});

/** Limit for unauthenticated public verification endpoints. */
export const publicLimiter = rateLimit({
    windowMs,
    limit: Math.max(env.authRateLimitMaxRequests * 3, 30),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: message(env.rateLimitWindowMinutes),
    skip: () => env.isTest,
});
