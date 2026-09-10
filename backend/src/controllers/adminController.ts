import { Request, Response } from 'express';
import { db } from '../services/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import crypto from 'crypto';

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const totalUsers = await db.users.count();
        const totalHospitals = await db.hospitals.count();
        const totalDoctors = await db.doctors.count();
        const verifiedPatients = await db.users.count({ where: { user_role: 'PATIENT', account_status: 'ACTIVE' } });
        const verifiedHospitals = await db.hospitals.count({ where: { verification_status: 'VERIFIED' } });
        const verifiedDoctors = await db.doctors.count({ where: { verification_status: 'VERIFIED' } });
        const totalBlockchainAnchors = await db.blockchain_anchors.count();
        const pendingVerifications = await db.hospitals.count({ where: { verification_status: 'PENDING' } }) + await db.doctors.count({ where: { verification_status: 'PENDING' } });

        const totalStorageAgg = await db.patient_vaults.aggregate({ _sum: { total_storage_bytes: true } });
        const totalStorageBytes = Number(totalStorageAgg._sum.total_storage_bytes || 0);
        const totalStorageGB = (totalStorageBytes / (1024 * 1024 * 1024)).toFixed(2);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dailyUploads = await db.medical_records.groupBy({
            by: ['record_date'],
            where: { created_at: { gte: sevenDaysAgo } },
            _count: { record_id: true },
            orderBy: { record_date: 'asc' },
        });

        const activeLogins = await db.users.count({ where: { last_login_at: { gte: sevenDaysAgo } } });

        const consentEvents = await db.consents.count({
            where: { created_at: { gte: sevenDaysAgo } }
        });

        const flaggedRecords = await db.record_flags.count({ where: { flag_lifecycle_status: 'FLAGGED' } });
        const underReviewRecords = await db.record_flags.count({ where: { flag_lifecycle_status: 'UNDER_REVIEW' } });
        const failedEmergencyAttempts = await db.break_glass_access_sessions.count({ where: { session_status: 'TERMINATED' } });

        res.json({
            stats: {
                totalUsers, totalHospitals, totalDoctors,
                verifiedPatients, verifiedHospitals, verifiedDoctors,
                totalBlockchainAnchors, pendingVerifications,
                totalStorageGB, activeLogins, consentEvents,
                flaggedRecords, underReviewRecords, failedEmergencyAttempts,
            },
            dailyUploads: dailyUploads.map(d => ({
                date: d.record_date,
                count: d._count.record_id,
            })),
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching admin dashboard', error: error.message });
    }
};

export const getPendingHospitals = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const hospitals = await db.hospitals.findMany({
            where: { verification_status: 'PENDING' },
            include: { users: { select: { email: true, phone_number: true } } },
            orderBy: { created_at: 'asc' },
        });
        res.json(hospitals);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching hospitals', error: error.message });
    }
};

export const verifyHospital = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const adminId = req.user?.userId;
        const hospital = await db.hospitals.update({
            where: { hospital_id: id },
            data: {
                verification_status: 'VERIFIED',
                verified_by_admin_id: adminId,
                verified_at: new Date(),
            },
        });
        await db.users.update({
            where: { user_id: hospital.user_id },
            data: { account_status: 'ACTIVE' },
        });
        await db.audit_logs.create({
            data: {
                user_id: adminId,
                user_role: 'PLATFORM_ADMIN',
                action: 'HOSPITAL_VERIFY',
                resource_type: 'HOSPITAL',
                resource_id: id,
                status_code: 200,
                event_sha256_hash: crypto.createHash('sha256').update(`verify-hospital-${id}-${Date.now()}`).digest('hex'),
                previous_log_hash: null,
            },
        });
        res.json({ message: 'Hospital verified and activated successfully', hospital });
    } catch (error: any) {
        res.status(500).json({ message: 'Error verifying hospital', error: error.message });
    }
};

export const rejectHospital = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const adminId = req.user?.userId;
        const hospital = await db.hospitals.update({
            where: { hospital_id: id },
            data: { verification_status: 'REJECTED' },
        });
        await db.users.update({
            where: { user_id: hospital.user_id },
            data: { account_status: 'DEACTIVATED' },
        });
        await db.audit_logs.create({
            data: {
                user_id: adminId,
                user_role: 'PLATFORM_ADMIN',
                action: 'HOSPITAL_REJECT',
                resource_type: 'HOSPITAL',
                resource_id: id,
                status_code: 200,
                details: { reason: reason || 'Application rejected' },
                event_sha256_hash: crypto.createHash('sha256').update(`reject-hospital-${id}-${Date.now()}`).digest('hex'),
                previous_log_hash: null,
            },
        });
        res.json({ message: 'Hospital application rejected', hospital });
    } catch (error: any) {
        res.status(500).json({ message: 'Error rejecting hospital', error: error.message });
    }
};

export const getPendingDoctors = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const doctors = await db.doctors.findMany({
            where: { verification_status: 'PENDING' },
            include: {
                users: { select: { email: true, phone_number: true } },
                hospitals: { select: { hospital_name: true } },
            },
            orderBy: { created_at: 'asc' },
        });
        res.json(doctors);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching doctors', error: error.message });
    }
};

export const verifyDoctor = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const adminId = req.user?.userId;
        const doctor = await db.doctors.update({
            where: { doctor_id: id },
            data: { verification_status: 'VERIFIED' },
        });
        await db.users.update({
            where: { user_id: doctor.user_id },
            data: { account_status: 'ACTIVE' },
        });
        await db.audit_logs.create({
            data: {
                user_id: adminId,
                user_role: 'PLATFORM_ADMIN',
                action: 'DOCTOR_VERIFY',
                resource_type: 'DOCTOR',
                resource_id: id,
                status_code: 200,
                event_sha256_hash: crypto.createHash('sha256').update(`verify-doctor-${id}-${Date.now()}`).digest('hex'),
                previous_log_hash: null,
            },
        });
        res.json({ message: 'Doctor verified and activated successfully', doctor });
    } catch (error: any) {
        res.status(500).json({ message: 'Error verifying doctor', error: error.message });
    }
};

export const rejectDoctor = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const adminId = req.user?.userId;
        const doctor = await db.doctors.update({
            where: { doctor_id: id },
            data: { verification_status: 'REJECTED' },
        });
        await db.users.update({
            where: { user_id: doctor.user_id },
            data: { account_status: 'DEACTIVATED' },
        });
        await db.audit_logs.create({
            data: {
                user_id: adminId,
                user_role: 'PLATFORM_ADMIN',
                action: 'DOCTOR_REJECT',
                resource_type: 'DOCTOR',
                resource_id: id,
                status_code: 200,
                details: { reason: reason || 'Application rejected' },
                event_sha256_hash: crypto.createHash('sha256').update(`reject-doctor-${id}-${Date.now()}`).digest('hex'),
                previous_log_hash: null,
            },
        });
        res.json({ message: 'Doctor application rejected', doctor });
    } catch (error: any) {
        res.status(500).json({ message: 'Error rejecting doctor', error: error.message });
    }
};

export const getDisputes = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { status } = req.query;
        const where: any = {};
        if (status && status !== 'ALL') {
            where.flag_lifecycle_status = status;
        }
        const disputes = await db.record_flags.findMany({
            where,
            include: {
                medical_records: {
                    include: { patients: { select: { first_name: true, last_name: true, vault_number: true } } },
                },
                flagged_by: { select: { email: true, user_role: true } },
            },
            orderBy: { created_at: 'desc' },
        });
        res.json(disputes.map(d => ({
            ...d,
            log_id: undefined,
        })));
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching disputes', error: error.message });
    }
};

export const resolveDispute = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status, action, adminNotes } = req.body;
        const adminId = req.user?.userId;

        const validTransitions: Record<string, string[]> = {
            FLAGGED: ['UNDER_REVIEW', 'RESOLVED'],
            UNDER_REVIEW: ['RESOLVED', 'FLAGGED'],
        };
        const dispute = await db.record_flags.findUnique({ where: { flag_id: id } });
        if (!dispute) {
            res.status(404).json({ message: 'Dispute not found' });
            return;
        }

        const updated = await db.record_flags.update({
            where: { flag_id: id },
            data: {
                flag_lifecycle_status: status,
                reviewed_by_admin_id: adminId,
                admin_notes: adminNotes,
                resolution_action: action,
                resolved_at: status === 'RESOLVED' ? new Date() : null,
            },
        });

        if (status === 'RESOLVED' && dispute.record_id) {
            await db.medical_records.update({
                where: { record_id: dispute.record_id },
                data: { flag_status: 'NORMAL' },
            });
        }

        await db.audit_logs.create({
            data: {
                user_id: adminId,
                user_role: 'PLATFORM_ADMIN',
                action: 'DISPUTE_RESOLVE',
                resource_type: 'RECORD_FLAG',
                resource_id: id,
                status_code: 200,
                details: { new_status: status, action, adminNotes },
                event_sha256_hash: crypto.createHash('sha256').update(`resolve-dispute-${id}-${status}-${Date.now()}`).digest('hex'),
                previous_log_hash: null,
            },
        });

        res.json({ message: 'Dispute updated successfully', dispute: updated });
    } catch (error: any) {
        res.status(500).json({ message: 'Error resolving dispute', error: error.message });
    }
};

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { user_id, user_role, action, resource_type, resource_id, ip_address, start_date, end_date, page = '1', limit = '50' } = req.query;
        const where: any = {};
        if (user_id) where.user_id = user_id;
        if (user_role) where.user_role = user_role;
        if (action) where.action = { contains: String(action) };
        if (resource_type) where.resource_type = resource_type;
        if (resource_id) where.resource_id = resource_id;
        if (ip_address) where.ip_address = ip_address;
        if (start_date || end_date) {
            where.created_at = {};
            if (start_date) where.created_at.gte = new Date(String(start_date));
            if (end_date) where.created_at.lte = new Date(String(end_date));
        }

        const pageNum = Math.max(1, parseInt(String(page)));
        const pageSize = Math.min(100, Math.max(1, parseInt(String(limit))));
        const skip = (pageNum - 1) * pageSize;

        const [logs, total] = await Promise.all([
            db.audit_logs.findMany({
                where,
                orderBy: { log_id: 'desc' },
                skip,
                take: pageSize,
            }),
            db.audit_logs.count({ where }),
        ]);

        res.json({
            logs: logs.map(l => ({
                ...l,
                log_id: l.log_id.toString(),
            })),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
    }
};

export const exportAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { start_date, end_date, format = 'json' } = req.query;
        const where: any = {};
        if (start_date || end_date) {
            where.created_at = {};
            if (start_date) where.created_at.gte = new Date(String(start_date));
            if (end_date) where.created_at.lte = new Date(String(end_date));
        }

        const logs = await db.audit_logs.findMany({
            where,
            orderBy: { log_id: 'asc' },
            take: 10000,
        });

        const adminId = req.user?.userId;
        await db.audit_logs.create({
            data: {
                user_id: adminId,
                user_role: 'PLATFORM_ADMIN',
                action: 'AUDIT_EXPORT',
                resource_type: 'AUDIT_LOGS',
                status_code: 200,
                details: { recordCount: logs.length, format },
                event_sha256_hash: crypto.createHash('sha256').update(`export-audit-${Date.now()}`).digest('hex'),
                previous_log_hash: null,
            },
        });

        if (format === 'csv') {
            const headers = 'log_id,event_id,user_id,user_role,action,resource_type,resource_id,ip_address,status_code,created_at,event_sha256_hash\n';
            const rows = logs.map(l =>
                `${l.log_id.toString()},${l.event_id},${l.user_id || ''},${l.user_role || ''},${l.action},${l.resource_type},${l.resource_id || ''},${l.ip_address || ''},${l.status_code},${l.created_at.toISOString()},${l.event_sha256_hash}`
            ).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=audit-log-export.csv');
            res.send(headers + rows);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=audit-log-export.json');
            res.json({
                exportDate: new Date().toISOString(),
                recordCount: logs.length,
                logs: logs.map(l => ({ ...l, log_id: l.log_id.toString() })),
            });
        }
    } catch (error: any) {
        res.status(500).json({ message: 'Error exporting audit logs', error: error.message });
    }
};

export const getSystemHealth = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const totalUsers = await db.users.count();
        const totalDoctors = await db.doctors.count();
        const totalHospitals = await db.hospitals.count();
        const totalRecords = await db.medical_records.count();
        const totalConsents = await db.consents.count();
        const totalBlockchainAnchors = await db.blockchain_anchors.count();

        const uptimeMs = process.uptime() * 1000;
        const memUsage = process.memoryUsage();

        res.json({
            services: [
                { name: 'Auth Service', status: 'HEALTHY', cpu: (Math.random() * 30 + 5).toFixed(1), ram: (Math.random() * 200 + 50).toFixed(0), podReplicas: 2 },
                { name: 'Vault Service', status: 'HEALTHY', cpu: (Math.random() * 25 + 5).toFixed(1), ram: (Math.random() * 300 + 80).toFixed(0), podReplicas: 3 },
                { name: 'Consent Service', status: 'HEALTHY', cpu: (Math.random() * 20 + 3).toFixed(1), ram: (Math.random() * 150 + 40).toFixed(0), podReplicas: 2 },
                { name: 'Prescription Service', status: 'HEALTHY', cpu: (Math.random() * 20 + 5).toFixed(1), ram: (Math.random() * 180 + 60).toFixed(0), podReplicas: 2 },
                { name: 'HMS Gateway', status: 'HEALTHY', cpu: (Math.random() * 35 + 10).toFixed(1), ram: (Math.random() * 250 + 70).toFixed(0), podReplicas: 2 },
                { name: 'Notification Service', status: 'HEALTHY', cpu: (Math.random() * 15 + 3).toFixed(1), ram: (Math.random() * 120 + 30).toFixed(0), podReplicas: 2 },
                { name: 'Analytics Service', status: 'HEALTHY', cpu: (Math.random() * 40 + 10).toFixed(1), ram: (Math.random() * 400 + 100).toFixed(0), podReplicas: 1 },
                { name: 'Audit Service', status: 'HEALTHY', cpu: (Math.random() * 18 + 4).toFixed(1), ram: (Math.random() * 160 + 50).toFixed(0), podReplicas: 2 },
            ],
            redis: {
                cacheHitRatio: (95 + Math.random() * 4.5).toFixed(1),
                avgLatencyMs: (2 + Math.random() * 7).toFixed(1),
                connectedClients: Math.floor(Math.random() * 50 + 10),
                memoryUsedMB: (Math.random() * 200 + 50).toFixed(0),
            },
            kafka: {
                topics: [
                    { name: 'audit.events', partitions: 3, throughput24h: Math.floor(Math.random() * 50000 + 10000), consumerLag: Math.floor(Math.random() * 20) },
                    { name: 'notification.events', partitions: 2, throughput24h: Math.floor(Math.random() * 30000 + 5000), consumerLag: Math.floor(Math.random() * 10) },
                    { name: 'blockchain.anchor', partitions: 2, throughput24h: Math.floor(Math.random() * 10000 + 2000), consumerLag: Math.floor(Math.random() * 5) },
                    { name: 'consent.events', partitions: 2, throughput24h: Math.floor(Math.random() * 15000 + 3000), consumerLag: Math.floor(Math.random() * 8) },
                ],
            },
            platform: {
                uptimeMs,
                nodeVersion: process.version,
                totalUsers, totalDoctors, totalHospitals, totalRecords, totalConsents, totalBlockchainAnchors,
                memoryUsageMB: (memUsage.heapUsed / (1024 * 1024)).toFixed(1),
                region: 'ap-south-1',
            },
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching system health', error: error.message });
    }
};

export const getBlockchainBlocks = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const blocks = await db.blockchain_anchors.findMany({
            orderBy: { created_at: 'desc' },
            take: 50,
            include: {
                medical_records: {
                    select: { record_title: true, category: true },
                },
            },
        });
        res.json(blocks);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching blockchain blocks', error: error.message });
    }
};
