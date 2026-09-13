import { Request, Response } from 'express';
import { db } from '../services/db';
import { AuthRequest, routeParam } from '../middlewares/authMiddleware';
import { recordAudit, verifyChain } from '../services/auditLog';
import { getCache, getCacheStats } from '../services/cache';
import { verifyLedger } from '../services/ledger';
import { getTransportStatus } from '../services/notificationDelivery';
import { env } from '../config/env';
import {
    deliverNotifications,
    expireBreakGlassSessions,
    expireConsents,
    getJobStatus,
    runIntegritySweep,
    sendConsentExpiryReminders,
} from '../jobs';
import { validatedQuery } from '../middlewares/validate';

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
        const id = routeParam(req, 'id');
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
        await recordAudit({
            action: 'HOSPITAL_VERIFY',
            resourceType: 'HOSPITAL',
            resourceId: id,
            userId: adminId ?? null,
            userRole: 'PLATFORM_ADMIN',
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
        });
        res.json({ message: 'Hospital verified and activated successfully', hospital });
    } catch (error: any) {
        res.status(500).json({ message: 'Error verifying hospital', error: error.message });
    }
};

export const rejectHospital = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = routeParam(req, 'id');
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
        await recordAudit({
            action: 'HOSPITAL_REJECT',
            resourceType: 'HOSPITAL',
            resourceId: id,
            userId: adminId ?? null,
            userRole: 'PLATFORM_ADMIN',
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            details: { reason: reason || 'Application rejected' },
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
        const id = routeParam(req, 'id');
        const adminId = req.user?.userId;
        const doctor = await db.doctors.update({
            where: { doctor_id: id },
            data: { verification_status: 'VERIFIED' },
        });
        await db.users.update({
            where: { user_id: doctor.user_id },
            data: { account_status: 'ACTIVE' },
        });
        await recordAudit({
            action: 'DOCTOR_VERIFY',
            resourceType: 'DOCTOR',
            resourceId: id,
            userId: adminId ?? null,
            userRole: 'PLATFORM_ADMIN',
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
        });
        res.json({ message: 'Doctor verified and activated successfully', doctor });
    } catch (error: any) {
        res.status(500).json({ message: 'Error verifying doctor', error: error.message });
    }
};

export const rejectDoctor = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = routeParam(req, 'id');
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
        await recordAudit({
            action: 'DOCTOR_REJECT',
            resourceType: 'DOCTOR',
            resourceId: id,
            userId: adminId ?? null,
            userRole: 'PLATFORM_ADMIN',
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            details: { reason: reason || 'Application rejected' },
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
                    include: {
                        patients: {
                            select: {
                                first_name: true,
                                last_name: true,
                                // vault_number lives on patient_vaults, not patients.
                                patient_vaults: { select: { vault_number: true } },
                            },
                        },
                    },
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
        const id = routeParam(req, 'id');
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

        await recordAudit({
            action: 'DISPUTE_RESOLVE',
            resourceType: 'RECORD_FLAG',
            resourceId: id,
            userId: adminId ?? null,
            userRole: 'PLATFORM_ADMIN',
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            details: { new_status: status, action, adminNotes },
        });

        res.json({ message: 'Dispute updated successfully', dispute: updated });
    } catch (error: any) {
        res.status(500).json({ message: 'Error resolving dispute', error: error.message });
    }
};

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { user_id, user_role, action, resource_type, resource_id, ip_address, start_date, end_date, page, limit } =
            validatedQuery<{
                user_id?: string; user_role?: string; action?: string; resource_type?: string;
                resource_id?: string; ip_address?: string; start_date?: Date; end_date?: Date;
                page: number; limit: number;
            }>(res);
        const where: any = {};
        if (user_id) where.user_id = user_id;
        if (user_role) where.user_role = user_role;
        if (action) where.action = { contains: String(action) };
        if (resource_type) where.resource_type = resource_type;
        if (resource_id) where.resource_id = resource_id;
        if (ip_address) where.ip_address = ip_address;
        if (start_date || end_date) {
            where.created_at = {};
            if (start_date) where.created_at.gte = start_date;
            if (end_date) where.created_at.lte = end_date;
        }

        const pageNum = page;
        const pageSize = limit;
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

/**
 * GET /api/v1/admin/audit-logs/verify-chain
 *
 * Walks the audit hash chain and reports the first inconsistency. An intact
 * chain is evidence that no entry has been altered, inserted or removed.
 */
export const verifyAuditChain = async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await verifyChain();

    await recordAudit({
        action: 'AUDIT_CHAIN_VERIFY',
        resourceType: 'AUDIT_LOGS',
        userId: req.user?.userId ?? null,
        userRole: 'PLATFORM_ADMIN',
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        details: { intact: result.intact, checked: result.checked },
    });

    res.status(result.intact ? 200 : 409).json(result);
};

export const exportAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { start_date, end_date, format } = validatedQuery<{
            start_date?: Date;
            end_date?: Date;
            format: 'json' | 'csv';
        }>(res);
        const where: any = {};
        if (start_date || end_date) {
            where.created_at = {};
            if (start_date) where.created_at.gte = start_date;
            if (end_date) where.created_at.lte = end_date;
        }

        const logs = await db.audit_logs.findMany({
            where,
            orderBy: { log_id: 'asc' },
            take: 10000,
        });

        const adminId = req.user?.userId;
        await recordAudit({
            action: 'AUDIT_EXPORT',
            resourceType: 'AUDIT_LOGS',
            userId: adminId ?? null,
            userRole: 'PLATFORM_ADMIN',
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            details: { recordCount: logs.length, format },
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

/**
 * GET /api/v1/admin/system-health
 *
 * Reports measured values only. The previous implementation generated CPU,
 * RAM, Redis and Kafka figures with Math.random(), which made the screen worse
 * than useless for an operator. Components that are not deployed are reported
 * as NOT_DEPLOYED rather than invented.
 */
export const getSystemHealth = async (req: AuthRequest, res: Response): Promise<void> => {
    const startedAt = performance.now();

    // A real query, so database latency is measured rather than guessed.
    await db.$queryRawUnsafe('SELECT 1');
    const databaseLatencyMs = Number((performance.now() - startedAt).toFixed(2));

    const [
        totalUsers,
        totalDoctors,
        totalHospitals,
        totalRecords,
        totalConsents,
        totalAnchors,
        pendingNotifications,
        failedNotifications,
        integrityMismatches,
        activeSessions,
    ] = await Promise.all([
        db.users.count(),
        db.doctors.count(),
        db.hospitals.count(),
        db.medical_records.count(),
        db.consents.count(),
        db.blockchain_anchors.count(),
        db.notifications.count({ where: { delivery_status: 'PENDING' } }),
        db.notifications.count({ where: { delivery_status: 'FAILED' } }),
        db.medical_records.count({ where: { integrity_status: { in: ['MISMATCH', 'MISSING'] } } }),
        db.user_sessions.count({ where: { revoked_at: null, expires_at: { gt: new Date() } } }),
    ]);

    const cache = getCache();
    const cacheReachable = await cache.ping();
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();

    const [ledgerState, transports] = await Promise.all([
        verifyLedger(5000),
        Promise.resolve(getTransportStatus()),
    ]);

    res.json({
        // One process serves every route today. Listing eight microservices
        // with invented pod counts would misrepresent the deployment.
        deployment: {
            topology: 'MONOLITH',
            note: 'All routes are served by a single Express process. The microservice topology in the architecture document is a target state.',
            nodeVersion: process.version,
            uptimeSeconds: Math.floor(process.uptime()),
            region: env.awsRegion,
            environment: env.nodeEnv,
        },
        process: {
            heapUsedMB: Number((memory.heapUsed / (1024 * 1024)).toFixed(1)),
            heapTotalMB: Number((memory.heapTotal / (1024 * 1024)).toFixed(1)),
            rssMB: Number((memory.rss / (1024 * 1024)).toFixed(1)),
            cpuUserMs: Math.round(cpu.user / 1000),
            cpuSystemMs: Math.round(cpu.system / 1000),
        },
        database: {
            status: 'HEALTHY',
            latencyMs: databaseLatencyMs,
        },
        cache: {
            ...getCacheStats(),
            reachable: cacheReachable,
            status: cacheReachable ? 'HEALTHY' : 'DEGRADED',
        },
        storage: {
            driver: env.storageDriver,
            keyProvider: env.keyProviderDriver,
        },
        ledger: {
            status: ledgerState.intact ? 'INTACT' : 'BROKEN',
            entriesChecked: ledgerState.checked,
            ...(ledgerState.firstBreak ? { firstBreak: ledgerState.firstBreak } : {}),
        },
        notifications: {
            pending: pendingNotifications,
            failed: failedNotifications,
            emailConfigured: transports.email.configured,
            smsConfigured: transports.sms.configured,
        },
        jobs: {
            enabled: env.schedulerEnabled,
            recent: getJobStatus(),
        },
        eventBus: {
            // Kafka appears in the architecture document but is not deployed.
            status: 'NOT_DEPLOYED',
            note: 'Scheduled jobs and the notifications outbox cover current needs.',
        },
        alerts: {
            integrityMismatches,
            failedNotifications,
            ledgerBroken: !ledgerState.intact,
        },
        counts: {
            totalUsers,
            totalDoctors,
            totalHospitals,
            totalRecords,
            totalConsents,
            totalAnchors,
            activeSessions,
        },
    });
};

/** GET /api/v1/admin/ledger/verify — walks the integrity ledger. */
export const verifyIntegrityLedger = async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await verifyLedger();

    await recordAudit({
        action: 'LEDGER_VERIFY',
        resourceType: 'LEDGER',
        userId: req.user?.userId ?? null,
        userRole: 'PLATFORM_ADMIN',
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        details: { intact: result.intact, checked: result.checked },
    });

    res.status(result.intact ? 200 : 409).json(result);
};

/** POST /api/v1/admin/jobs/:name/run — triggers a scheduled job on demand. */
export const runJobNow = async (req: AuthRequest, res: Response): Promise<void> => {
    const name = routeParam(req, 'name');

    const runners: Record<string, () => Promise<unknown>> = {
        'expire-break-glass': expireBreakGlassSessions,
        'expire-consents': expireConsents,
        'consent-reminders': sendConsentExpiryReminders,
        'integrity-sweep': () => runIntegritySweep(),
        'deliver-notifications': deliverNotifications,
    };

    const runner = runners[name];
    if (!runner) {
        res.status(404).json({
            message: `Unknown job "${name}"`,
            available: Object.keys(runners),
        });
        return;
    }

    const result = await runner();

    await recordAudit({
        action: 'JOB_RUN',
        resourceType: 'JOB',
        resourceId: name,
        userId: req.user?.userId ?? null,
        userRole: 'PLATFORM_ADMIN',
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
    });

    res.json(
        result ?? { message: 'Another instance is already running this job; nothing to do.', skipped: true }
    );
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
