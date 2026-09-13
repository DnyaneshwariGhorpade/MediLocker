import { NextFunction, Response } from 'express';
import { recordAudit } from '../services/auditLog';
import { AuthRequest } from './authMiddleware';

/** Requests that only read, but read protected health information. */
const AUDITED_READS: RegExp[] = [
    /^\/api\/v1\/vault\/records\/[^/]+\/decrypt$/,
    /^\/api\/v1\/vault\/records\/[^/]+\/blockchain-proof$/,
    /^\/api\/v1\/doctor\/patient-records\//,
    /^\/api\/v1\/doctor\/records\/search/,
    /^\/api\/v1\/emergency\/session\/[^/]+\/data$/,
    /^\/api\/v1\/admin\/audit-logs/,
];

/** Body fields that must never reach the audit trail. */
const REDACTED_FIELDS = new Set([
    'password',
    'otp',
    'tempToken',
    'token',
    'aadhaar_number',
    'aadhaar_hash',
    'digital_signature',
    'api_secret',
    'apiSecret',
]);

function redact(body: unknown): Record<string, unknown> | undefined {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        if (REDACTED_FIELDS.has(key)) {
            output[key] = '[redacted]';
        } else if (typeof value === 'string' && value.length > 200) {
            output[key] = `${value.slice(0, 200)}…`;
        } else if (value !== null && typeof value === 'object') {
            output[key] = Array.isArray(value) ? `[${value.length} items]` : '[object]';
        } else {
            output[key] = value;
        }
    }
    return output;
}

/** Derives a stable action name, e.g. POST /api/v1/consent/grant -> CONSENT_GRANT. */
function deriveAction(method: string, path: string): { action: string; resourceType: string; resourceId?: string } {
    const segments = path.replace(/^\/api\/v1\//, '').split('/').filter(Boolean);
    const resourceType = (segments[0] ?? 'ROOT').toUpperCase();

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const resourceId = segments.find((segment) => uuidPattern.test(segment));

    const nameParts = segments
        .filter((segment) => !uuidPattern.test(segment))
        .join('_')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .toUpperCase();

    return {
        action: `${method}_${nameParts}`.slice(0, 60),
        resourceType: resourceType.slice(0, 50),
        ...(resourceId ? { resourceId } : {}),
    };
}

/**
 * Records every state-changing request and every read of protected health data
 * (task P2-06). Runs after the response is sent so the request is never delayed
 * or failed by audit writing.
 */
export const auditMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const isAuditedRead = req.method === 'GET' && AUDITED_READS.some((pattern) => pattern.test(req.path));

    if (!isMutation && !isAuditedRead) {
        next();
        return;
    }

    const body = redact(req.body);

    res.on('finish', () => {
        const { action, resourceType, resourceId } = deriveAction(req.method, req.path);
        const details: Record<string, unknown> = {};
        if (body && Object.keys(body).length > 0) details['request'] = body;
        if (res.statusCode >= 400) details['outcome'] = 'DENIED_OR_FAILED';

        void recordAudit({
            userId: req.user?.userId ?? null,
            userRole: req.user?.role ?? null,
            action,
            resourceType,
            resourceId: resourceId ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            statusCode: res.statusCode,
            details,
        });
    });

    next();
};
