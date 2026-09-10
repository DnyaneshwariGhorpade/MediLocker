import { Request, Response } from 'express';
import { db } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';

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

        const newConsent = await db.consents.create({
            data: {
                patient_id: patient.patient_id,
                doctor_id,
                allowed_categories,
                blocked_categories,
                consent_status: 'ACTIVE',
                valid_until: new Date(valid_until),
                access_level: access_level || 'READ_ONLY'
            }
        });

        res.status(201).json(newConsent);
    } catch (error: any) {
        res.status(500).json({ message: 'Error granting consent', error: error.message });
    }
};

// POST /api/v1/consent/:id/revoke
export const revokeConsent = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const consentId = req.params.id;

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
            data: { consent_status: 'REVOKED' }
        });

        // Add to audit logs
        await db.audit_logs.create({
            data: {
                user_id: patient.user_id,
                user_role: 'PATIENT',
                action: 'REVOKE_CONSENT',
                resource_type: 'CONSENT',
                resource_id: consentId,
                ip_address: req.ip || '127.0.0.1',
                user_agent: req.headers['user-agent'] || 'Unknown',
                event_sha256_hash: 'mock_hash', // For real, calculate it
                details: { status: 'REVOKED' }
            }
        });

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
            include: { 
                doctors: true,
                consent_audit_logs: {
                    orderBy: { timestamp: 'desc' }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        res.json(history);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching consent history', error: error.message });
    }
};
