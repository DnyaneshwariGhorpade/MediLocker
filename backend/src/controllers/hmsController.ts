import { Request, Response } from 'express';
import { db } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import crypto from 'crypto';

export const getClients = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const hospital = await db.hospitals.findUnique({ where: { user_id: userId } });
        if (!hospital) { res.status(404).json({ message: 'Hospital not found' }); return; }

        const clients = await db.hms_api_clients.findMany({
            where: { hospital_id: hospital.hospital_id },
            orderBy: { created_at: 'desc' }
        });

        res.json(clients);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching HMS clients', error: error.message });
    }
};

export const generateKey = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { client_name, allowed_ip_cidrs } = req.body;
        const userId = req.user?.userId;
        const hospital = await db.hospitals.findUnique({ where: { user_id: userId } });
        if (!hospital) { res.status(404).json({ message: 'Hospital not found' }); return; }

        // Generate a random API key and secret
        const apiKey = `ak_${crypto.randomBytes(16).toString('hex')}`;
        const apiSecret = `sk_${crypto.randomBytes(32).toString('hex')}`;

        const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        const apiSecretHash = crypto.createHash('sha256').update(apiSecret).digest('hex');

        const client = await db.hms_api_clients.create({
            data: {
                hospital_id: hospital.hospital_id,
                client_name,
                api_key_hash: apiKeyHash,
                api_secret_hash: apiSecretHash,
                allowed_ip_cidrs: allowed_ip_cidrs || ['0.0.0.0/0']
            }
        });

        res.json({
            message: 'API Key generated successfully',
            client,
            raw_credentials: {
                apiKey,
                apiSecret,
                warning: 'Please copy these credentials now. They will not be shown again.'
            }
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error generating API key', error: error.message });
    }
};

export const updateIpWhitelist = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { client_id, allowed_ip_cidrs } = req.body;
        const userId = req.user?.userId;
        const hospital = await db.hospitals.findUnique({ where: { user_id: userId } });
        if (!hospital) { res.status(404).json({ message: 'Hospital not found' }); return; }

        const client = await db.hms_api_clients.update({
            where: { client_id, hospital_id: hospital.hospital_id },
            data: { allowed_ip_cidrs }
        });

        res.json({ message: 'IP whitelist updated successfully', client });
    } catch (error: any) {
        res.status(500).json({ message: 'Error updating IP whitelist', error: error.message });
    }
};
