import { Response } from 'express';
import crypto from 'crypto';
import { db } from '../services/db';
import { AuthRequest, routeParam } from '../middlewares/authMiddleware';
import { recordAudit } from '../services/auditLog';
import { invalidateConsentCache } from '../services/access';

// GET /api/v1/consent/active
export const getActiveConsents = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const patient = await db.patients.findUnique({ where: { user_id: userId } });
        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        const consents = await db.consents.findMany({
            where: { 
                patient_id: patient.patient_id,
                consent_status: 'ACTIVE',
                valid_until: { gt: new Date() }
            },
            include: { doctors: true }
        });

        res.json(consents);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching active consents', error: error.message });
    }
};

// POST /api/v1/consent/grant
export const grantConsent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const { doctor_id, allowed_categories, blocked_categories, valid_until, access_level } = req.body;

        const patient = await db.patients.findUnique({ where: { user_id: userId } });
        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        const validUntil = new Date(valid_until);

        // The consent token is the value a doctor's session presents to prove a
        // grant exists. Only its hash is stored, so a database read cannot be
        // replayed as authorisation.
        const consentToken = crypto.randomBytes(32).toString('base64url');
        const consentTokenHash = crypto
            .createHash('sha256')
            .update(`${patient.patient_id}:${doctor_id}:${validUntil.toISOString()}:${consentToken}`)
            .digest('hex');

        const newConsent = await db.consents.create({
            data: {
                patient_id: patient.patient_id,
                doctor_id,
                allowed_categories,
                blocked_categories,
                consent_status: 'ACTIVE',
                valid_until: validUntil,
                access_level: access_level || 'READ_ONLY',
                consent_token_hash: consentTokenHash
            }
        });

        await invalidateConsentCache(patient.patient_id, doctor_id);

        res.status(201).json(newConsent);
    } catch (error: any) {
        res.status(500).json({ message: 'Error granting consent', error: error.message });
    }
};

// POST /api/v1/consent/:id/revoke
export const revokeConsent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const consentId = routeParam(req, 'id');

        const patient = await db.patients.findUnique({ where: { user_id: userId } });
        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        const consent = await db.consents.findUnique({ where: { consent_id: consentId } });
        if (!consent || consent.patient_id !== patient.patient_id) {
            res.status(404).json({ message: 'Consent not found or unauthorized' });
            return;
        }

        await db.consents.update({
            where: { consent_id: consentId },
            data: { consent_status: 'REVOKED', revoked_at: new Date() }
        });

        // Written through the chained audit service. A direct audit_logs.create
        // would insert an unlinked row and break chain verification.
        await recordAudit({
            userId: patient.user_id,
            userRole: 'PATIENT',
            action: 'REVOKE_CONSENT',
            resourceType: 'CONSENT',
            resourceId: consentId,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            details: { status: 'REVOKED' }
        });

        // FR11: revocation must take effect on the next request, so the
        // cached decision is dropped rather than left to expire.
        await invalidateConsentCache(patient.patient_id, consent.doctor_id);

        res.json({ message: 'Consent revoked successfully' });
    } catch (error: any) {
        res.status(500).json({ message: 'Error revoking consent', error: error.message });
    }
};

// GET /api/v1/consent/history
export const getConsentHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const patient = await db.patients.findUnique({ where: { user_id: userId } });
        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        const history = await db.consents.findMany({
            where: { patient_id: patient.patient_id },
            include: { doctors: true },
            orderBy: { created_at: 'desc' }
        });

        // There is no per-consent audit table; the trail lives in audit_logs
        // keyed by resource type and id.
        const auditLogs = await db.audit_logs.findMany({
            where: {
                resource_type: 'CONSENT',
                resource_id: { in: history.map((consent) => consent.consent_id) }
            },
            orderBy: { created_at: 'desc' }
        });

        const logsByConsent = new Map<string, typeof auditLogs>();
        for (const log of auditLogs) {
            if (!log.resource_id) continue;
            const bucket = logsByConsent.get(log.resource_id) ?? [];
            bucket.push(log);
            logsByConsent.set(log.resource_id, bucket);
        }

        res.json(
            history.map((consent) => ({
                ...consent,
                audit_trail: (logsByConsent.get(consent.consent_id) ?? []).map((log) => ({
                    ...log,
                    log_id: log.log_id.toString()
                }))
            }))
        );
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching consent history', error: error.message });
    }
};
