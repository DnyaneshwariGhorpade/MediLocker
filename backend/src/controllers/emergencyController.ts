import crypto from 'crypto';
import { Response } from 'express';
import { db } from '../services/db';
import { env } from '../config/env';
import { recordAudit } from '../services/auditLog';
import { buildEmergencySnapshot } from '../services/emergencySnapshot';
import { AuthRequest, requireUser, routeParam } from '../middlewares/authMiddleware';

// POST /api/v1/emergency/initiate-request
export const initiateRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { identifier, emergency_reason } = req.body;
        const doctorId = req.user?.userId;

        const doctor = await db.doctors.findUnique({ where: { user_id: doctorId } });
        if (!doctor || !doctor.primary_hospital_id) {
            res.status(403).json({ message: 'Must be associated with a hospital' });
            return;
        }

        let patient = await db.patients.findFirst({
            where: {
                OR: [
                    { patient_vaults: { vault_number: identifier } },
                    { aadhaar_hash: identifier },
                    { users: { phone_number: identifier } }
                ]
            }
        });

        if (!patient) {
            res.status(404).json({ message: 'Patient not found' });
            return;
        }

        if (!patient.is_emergency_sharing_allowed) {
            res.status(403).json({ message: 'Patient has explicitly disabled emergency break-glass' });
            return;
        }

        // A single-use approval code is generated for the supervising admin.
        // Only its hash is stored, so a database read cannot authorise the
        // break-glass. The plaintext is delivered out of band.
        const approvalCode = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
        const codeHash = crypto.createHash('sha256').update(approvalCode).digest('hex');
        const codeExpiresAt = new Date(Date.now() + env.emergencyCodeMinutes * 60 * 1000);

        const session = await db.break_glass_access_sessions.create({
            data: {
                patient_id: patient.patient_id,
                doctor_id: doctor.doctor_id,
                hospital_id: doctor.primary_hospital_id,
                emergency_reason,
                session_status: 'PENDING_APPROVAL',
                verification_otp_hash: codeHash,
                verification_otp_expires_at: codeExpiresAt,
                ip_address: req.ip ?? null,
                user_agent: req.get('user-agent') ?? null,
                // Replaced with a fresh four-hour window at approval.
                session_expires_at: codeExpiresAt
            }
        });

        // Notify the hospital administrator who must approve.
        const hospital = await db.hospitals.findUnique({
            where: { hospital_id: doctor.primary_hospital_id },
            select: { user_id: true }
        });

        if (hospital) {
            await db.notifications.create({
                data: {
                    user_id: hospital.user_id,
                    event_type: 'EMERGENCY_ACCESS',
                    channel: 'SMS',
                    title: 'URGENT: Break-glass approval required',
                    message:
                        `Dr. ${doctor.last_name} has requested emergency access. ` +
                        `Approval code: ${approvalCode} (valid ${env.emergencyCodeMinutes} minutes).`,
                    payload_json: { session_id: session.session_id }
                }
            });
        }

        res.status(201).json({
            message: 'Emergency request sent for approval. The supervising administrator has been issued a code.',
            session: { ...session, verification_otp_hash: undefined },
            // PLACEHOLDER: without an SMS/email transport (task P5-07) the code
            // would be unreachable, so outside production it is echoed here to
            // keep the flow usable. Never returned in production.
            ...(env.isProduction ? {} : { developmentApprovalCode: approvalCode })
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Error initiating request', error: error.message });
    }
};

// GET /api/v1/emergency/pending-requests (For Hospital Admin)
export const getPendingRequests = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId;
        const hospital = await db.hospitals.findUnique({ where: { user_id: userId } });
        if (!hospital) { res.status(404).json({ message: 'Hospital not found' }); return; }

        const pending = await db.break_glass_access_sessions.findMany({
            where: { 
                hospital_id: hospital.hospital_id,
                session_status: 'PENDING_APPROVAL' 
            },
            include: { patients: { include: { patient_vaults: true } }, doctors: true },
            orderBy: { session_start_at: 'desc' }
        });

        res.json(pending);
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching pending requests', error: error.message });
    }
};

// POST /api/v1/emergency/approve (For Hospital Admin)
export const approveRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { session_id, otp } = req.body;
        const { userId } = requireUser(req);

        const pending = await db.break_glass_access_sessions.findUnique({
            where: { session_id },
            select: {
                session_status: true,
                hospital_id: true,
                verification_otp_hash: true,
                verification_otp_expires_at: true
            }
        });

        if (!pending) {
            res.status(404).json({ message: 'Emergency request not found' });
            return;
        }

        // The approving admin must belong to the hospital that owns the request.
        const hospital = await db.hospitals.findUnique({
            where: { user_id: userId },
            select: { hospital_id: true }
        });
        if (!hospital || hospital.hospital_id !== pending.hospital_id) {
            res.status(403).json({ message: 'This request belongs to another hospital' });
            return;
        }

        if (pending.session_status !== 'PENDING_APPROVAL') {
            res.status(409).json({ message: `Request is already ${pending.session_status}` });
            return;
        }

        if (!pending.verification_otp_hash) {
            res.status(409).json({ message: 'This request has no approval code and cannot be approved' });
            return;
        }

        if (pending.verification_otp_expires_at && pending.verification_otp_expires_at < new Date()) {
            res.status(410).json({ message: 'The approval code has expired. The physician must request again.' });
            return;
        }

        // Constant-time comparison so a wrong code cannot be narrowed by timing.
        const submitted = crypto.createHash('sha256').update(String(otp)).digest();
        const expected = Buffer.from(pending.verification_otp_hash, 'hex');
        const codeMatches =
            submitted.length === expected.length && crypto.timingSafeEqual(submitted, expected);

        if (!codeMatches) {
            await recordAudit({
                userId,
                userRole: 'HOSPITAL_ADMIN',
                action: 'EMERGENCY_APPROVAL_REJECTED',
                resourceType: 'BREAK_GLASS_SESSION',
                resourceId: session_id,
                ipAddress: req.ip ?? null,
                userAgent: req.get('user-agent') ?? null,
                statusCode: 400
            });
            res.status(400).json({ message: 'Invalid approval code' });
            return;
        }

        const session = await db.break_glass_access_sessions.update({
            where: { session_id },
            data: {
                session_status: 'ACTIVE',
                hospital_admin_verifier_id: userId,
                session_start_at: new Date(),
                // The code is single-use: clearing the hash prevents replay.
                verification_otp_hash: null,
                verification_otp_expires_at: null,
                session_expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000) // Exactly 4 hours from now
            },
            include: { patients: true }
        });

        // Notify patient
        await db.notifications.create({
            data: {
                user_id: session.patients.user_id,
                event_type: 'EMERGENCY_ACCESS',
                title: 'EMERGENCY ACCESS TRIGGERED',
                message: 'A hospital administrator has authorized emergency break-glass access to your vault.',
                payload_json: { session_id }
            }
        });

        await db.break_glass_access_sessions.update({
            where: { session_id },
            data: { patient_notified: true, patient_notified_at: new Date() }
        });

        res.json({ message: 'Session approved and patient alerted', session });
    } catch (error: any) {
        res.status(500).json({ message: 'Error approving request', error: error.message });
    }
};

// POST /api/v1/emergency/terminate
export const terminateSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { session_id } = req.body;
        const { userId, role } = requireUser(req);

        const existing = await db.break_glass_access_sessions.findUnique({
            where: { session_id },
            select: { session_id: true, hospital_id: true, doctor_id: true, session_status: true }
        });

        if (!existing) {
            res.status(404).json({ message: 'Session not found' });
            return;
        }

        // Only the supervising hospital or the physician who opened the session
        // may close it. Previously any admin or doctor could terminate any
        // session by guessing or replaying its id.
        let permitted = false;
        if (role === 'HOSPITAL_ADMIN') {
            const hospital = await db.hospitals.findUnique({
                where: { user_id: userId },
                select: { hospital_id: true }
            });
            permitted = hospital?.hospital_id === existing.hospital_id;
        } else {
            const doctor = await db.doctors.findUnique({
                where: { user_id: userId },
                select: { doctor_id: true }
            });
            permitted = doctor?.doctor_id === existing.doctor_id;
        }

        if (!permitted) {
            res.status(403).json({ message: 'You are not a party to this emergency session' });
            return;
        }

        if (existing.session_status === 'TERMINATED') {
            res.json({ message: 'Session was already terminated', session: existing });
            return;
        }

        const session = await db.break_glass_access_sessions.update({
            where: { session_id },
            data: { session_status: 'TERMINATED', session_expires_at: new Date() }
        });

        res.json({ message: 'Session terminated immediately', session });
    } catch (error: any) {
        res.status(500).json({ message: 'Error terminating session', error: error.message });
    }
};

// GET /api/v1/emergency/session/:id/data
export const getSessionData = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = routeParam(req, 'id');
        const session = await db.break_glass_access_sessions.findUnique({
            where: { session_id: id },
            include: { patients: { include: { patient_vaults: true } } }
        });

        if (!session) { res.status(404).json({ message: 'Session not found' }); return; }

        // Only the physician the session was granted to may read it. Without
        // this, any doctor holding a session id could read another physician's
        // break-glass payload.
        const { userId } = requireUser(req);
        const doctor = await db.doctors.findUnique({
            where: { user_id: userId },
            select: { doctor_id: true }
        });

        if (!doctor || doctor.doctor_id !== session.doctor_id) {
            res.status(403).json({ message: 'This emergency session was not granted to you' });
            return;
        }

        if (session.session_status !== 'ACTIVE' || session.session_expires_at < new Date()) {
            res.status(403).json({ message: 'Session has expired or is inactive' });
            return;
        }

        const patientId = session.patient_id;

        const records = await db.medical_records.findMany({
            where: { patient_id: patientId, is_deleted: false },
            orderBy: { record_date: 'desc' }
        });

        const vitals = await db.patient_vitals.findMany({
            where: { patient_id: patientId },
            orderBy: { recorded_at: 'desc' },
            take: 10
        });

        // Derived from the patient's own records. Nothing here is invented: an
        // empty list means no such record exists, which is materially different
        // from "no known allergies" and is labelled as such for the clinician.
        const snapshot = await buildEmergencySnapshot(patientId, session.patients.blood_group, records);

        // Log every record surfaced by this session. Nothing is written when
        // the patient has no records, rather than inserting a placeholder id
        // that violates the foreign key.
        if (records.length > 0) {
            await db.break_glass_record_accesses.createMany({
                data: records.map((record) => ({
                    session_id: session.session_id,
                    record_id: record.record_id
                }))
            });
        }

        res.json({ session, snapshot, records, vitals });
    } catch (error: any) {
        res.status(500).json({ message: 'Error fetching session data', error: error.message });
    }
};
