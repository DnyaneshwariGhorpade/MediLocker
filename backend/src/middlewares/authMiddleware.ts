import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { isSessionActive, touchSession } from '../services/sessions';
import { HttpError } from '../utils/http';

export interface AuthUser {
    userId: string;
    role: string;
    /** Session identifier claim, present on tokens issued after MFA. */
    jti?: string;
}

export interface AuthRequest extends Request {
    user?: AuthUser;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }

    jwt.verify(token, env.jwtSecret, (err, decoded) => {
        void (async () => {
            if (err) {
                res.status(403).json({ message: 'Invalid token' });
                return;
            }

            const payload = decoded as jwt.JwtPayload | undefined;

            // Tokens issued between password entry and MFA are not session
            // tokens and must never authenticate an API call.
            if (!payload || payload['pendingMfa'] === true) {
                res.status(403).json({ message: 'Invalid token' });
                return;
            }

            const jti = payload['jti'] as string | undefined;

            // A session-bound token is only valid while its row is live, so a
            // remote logout takes effect immediately rather than at expiry.
            if (jti) {
                if (!(await isSessionActive(jti))) {
                    res.status(401).json({ message: 'Session has been revoked. Sign in again.' });
                    return;
                }
                touchSession(jti);
            }

            req.user = {
                userId: String(payload['userId']),
                role: String(payload['role']),
                ...(jti ? { jti } : {}),
            };
            next();
        })();
    });
};

export const authorizeRoles = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ message: 'Access denied: insufficient permissions' });
            return;
        }
        next();
    };
};

/**
 * Returns the authenticated principal. Unreachable behind `authenticateToken`,
 * but gives controllers a non-optional `userId` instead of `string | undefined`.
 */
export const requireUser = (req: AuthRequest): AuthUser => {
    if (!req.user) {
        throw HttpError.unauthorized();
    }
    return req.user;
};

/**
 * Reads a route parameter as a string. Express 5 types parameters as
 * `string | string[] | undefined` to accommodate wildcards; named parameters
 * are always a single string when the route matched.
 */
export const routeParam = (req: Request, name: string): string => {
    const value = req.params[name];
    if (typeof value !== 'string' || value === '') {
        throw HttpError.badRequest(`Missing route parameter: ${name}`);
    }
    return value;
};

/** Reads a query-string value as a string, or undefined when absent. */
export const queryParam = (req: Request, name: string): string | undefined => {
    const value = req.query[name];
    if (typeof value === 'string' && value !== '') return value;
    return undefined;
};
