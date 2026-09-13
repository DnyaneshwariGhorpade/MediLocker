import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { env } from '../config/env';

export interface SessionContext {
    ipAddress?: string | null;
    userAgent?: string | null;
}

/**
 * Issues a session token bound to a database row.
 *
 * The token carries a `jti` that maps to a `user_sessions` record. Because the
 * row is consulted on every request, a session can be revoked immediately —
 * a stateless JWT alone would stay valid until it expired.
 */
export async function createSession(
    userId: string,
    role: string,
    context: SessionContext
): Promise<{ token: string; sessionId: string }> {
    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + parseTtlMs(env.sessionTokenTtl));

    const session = await db.user_sessions.create({
        data: {
            user_id: userId,
            jti,
            ip_address: context.ipAddress ?? null,
            user_agent: context.userAgent ?? null,
            expires_at: expiresAt,
        },
    });

    const token = jwt.sign({ userId, role, jti }, env.jwtSecret, {
        expiresIn: env.sessionTokenTtl,
    } as jwt.SignOptions);

    return { token, sessionId: session.session_id };
}

/** Returns true when the session behind this jti is still usable. */
export async function isSessionActive(jti: string): Promise<boolean> {
    const session = await db.user_sessions.findUnique({
        where: { jti },
        select: { revoked_at: true, expires_at: true },
    });

    if (!session) return false;
    if (session.revoked_at) return false;
    return session.expires_at > new Date();
}

/** Best-effort activity timestamp; never blocks or fails a request. */
export function touchSession(jti: string): void {
    void db.user_sessions
        .updateMany({ where: { jti, revoked_at: null }, data: { last_seen_at: new Date() } })
        .catch(() => undefined);
}

export async function revokeSession(sessionId: string, userId: string, reason: string): Promise<boolean> {
    const result = await db.user_sessions.updateMany({
        where: { session_id: sessionId, user_id: userId, revoked_at: null },
        data: { revoked_at: new Date(), revoked_reason: reason },
    });
    return result.count > 0;
}

/** Revokes every session for a user except, optionally, the current one. */
export async function revokeAllSessions(
    userId: string,
    reason: string,
    exceptJti?: string
): Promise<number> {
    const result = await db.user_sessions.updateMany({
        where: {
            user_id: userId,
            revoked_at: null,
            ...(exceptJti ? { jti: { not: exceptJti } } : {}),
        },
        data: { revoked_at: new Date(), revoked_reason: reason },
    });
    return result.count;
}

export async function listSessions(userId: string, currentJti?: string) {
    const sessions = await db.user_sessions.findMany({
        where: { user_id: userId, revoked_at: null, expires_at: { gt: new Date() } },
        orderBy: { last_seen_at: 'desc' },
    });

    return sessions.map((session) => ({
        session_id: session.session_id,
        ip_address: session.ip_address,
        user_agent: session.user_agent,
        created_at: session.created_at,
        last_seen_at: session.last_seen_at,
        expires_at: session.expires_at,
        is_current: currentJti !== undefined && session.jti === currentJti,
    }));
}

/** Converts a zeit/ms style TTL ("2h", "45m") to milliseconds. */
function parseTtlMs(ttl: string): number {
    const match = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
    if (!match) return 2 * 60 * 60 * 1000;

    const value = Number(match[1]);
    switch (match[2]) {
        case 's':
            return value * 1000;
        case 'm':
            return value * 60 * 1000;
        case 'h':
            return value * 60 * 60 * 1000;
        case 'd':
            return value * 24 * 60 * 60 * 1000;
        default:
            return 2 * 60 * 60 * 1000;
    }
}
