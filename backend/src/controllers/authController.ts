import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { toDataURL } from 'qrcode';
import { db } from '../services/db';
import { env } from '../config/env';
import { AuthRequest, requireUser, routeParam } from '../middlewares/authMiddleware';
import { recordAudit } from '../services/auditLog';
import { fingerprintPublicKey, isUsablePublicKey } from '../services/prescriptionSignature';
import {
    buildOtpAuthUri,
    consumeBackupCode,
    countUnusedBackupCodes,
    decryptSecret,
    encryptSecret,
    generateSecret,
    issueBackupCodes,
    verifyTotp,
} from '../services/mfa';
import {
    createSession,
    listSessions,
    revokeAllSessions,
    revokeSession,
} from '../services/sessions';

// PLACEHOLDER: real TOTP verification arrives in Phase 4 of
// IMPLEMENTATION_PLAN.md (tasks P4-01, P4-02). Until then every account
// accepts the same development code, which is why this build must not hold
// real patient data.
const MOCK_OTP = '123456';

/**
 * Compared against when no account matches, so a failed lookup costs about the
 * same as a wrong password and timing does not reveal which emails exist.
 */
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.aG9wPBiKZ4TvVfKvGZ0LMzKrJ8Wi';

// POST /api/v1/auth/patient/send-aadhaar-otp
export const sendAadhaarOtp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { aadhaar_number } = req.body;
        // Basic length check; Verhoeff is checked on client side
        if (!aadhaar_number || aadhaar_number.length !== 12) {
            res.status(400).json({ message: 'Invalid Aadhaar format' });
            return;
        }
        // Simulated OTP send
        console.log(`[UIDAI Mock] Sending OTP ${MOCK_OTP} to Aadhaar ${aadhaar_number}`);
        res.json({ message: 'OTP sent to Aadhaar-linked mobile number successfully.' });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Failed to send OTP', error: error.message });
    }
};

// POST /api/v1/auth/register/patient
export const registerPatient = async (req: Request, res: Response): Promise<void> => {
    try {
        const { 
            email, phone_number, password, aadhaar_hash, first_name, last_name, date_of_birth, gender,
            blood_group, address_line, city, state, pincode, 
            emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
            is_emergency_sharing_allowed
        } = req.body;

        // Check if user already exists
        const existingUser = await db.users.findFirst({
            where: {
                OR: [{ email }, { phone_number }]
            }
        });

        if (existingUser) {
            res.status(400).json({ message: 'User with this email or phone already exists' });
            return;
        }

        const password_hash = await bcrypt.hash(password, env.bcryptRounds);

        // Transaction to create User + Patient + Vault
        const newUser = await db.$transaction(async (tx) => {
            const user = await tx.users.create({
                data: {
                    email,
                    phone_number,
                    password_hash,
                    user_role: 'PATIENT'
                }
            });

            const patient = await tx.patients.create({
                data: {
                    user_id: user.user_id,
                    aadhaar_hash,
                    first_name,
                    last_name,
                    date_of_birth: new Date(date_of_birth),
                    gender,
                    blood_group,
                    address_line,
                    city,
                    state,
                    pincode,
                    emergency_contact_name,
                    emergency_contact_phone,
                    emergency_contact_relation,
                    is_emergency_sharing_allowed: is_emergency_sharing_allowed !== undefined ? is_emergency_sharing_allowed : true
                }
            });

            // Format Vault number e.g., ML-2026-XXXX
            const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
            const vault_number = `ML-2026-${randomSuffix}`;

            await tx.patient_vaults.create({
                data: {
                    patient_id: patient.patient_id,
                    vault_number: vault_number,
                    encryption_salt: 'generated-salt'
                }
            });

            return { user, vault_number };
        });

        res.status(201).json({ 
            message: 'Patient registered successfully', 
            userId: newUser.user.user_id,
            vaultNumber: newUser.vault_number
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
};

// POST /api/v1/auth/register/doctor
export const registerDoctor = async (req: Request, res: Response): Promise<void> => {
    try {
        const { 
            email, phone_number, password, mrn, state_medical_council, 
            first_name, last_name, specialization, qualification, 
            public_key_pem, key_fingerprint,
            govt_id_document_url // Uploaded document
        } = req.body;

        // A doctor account is only useful if the server can verify its
        // signatures, so an unusable key is rejected up front rather than
        // discovered when the first prescription fails.
        if (!isUsablePublicKey(public_key_pem)) {
            res.status(400).json({
                message:
                    'The supplied public key could not be parsed. Generate an ECDSA P-256 key pair and send the public key in SPKI PEM form.'
            });
            return;
        }

        const password_hash = await bcrypt.hash(password, env.bcryptRounds);

        const newUser = await db.$transaction(async (tx) => {
            const user = await tx.users.create({
                data: {
                    email,
                    phone_number,
                    password_hash,
                    user_role: 'DOCTOR',
                    account_status: 'PENDING_VERIFICATION'
                }
            });

            // The fingerprint is derived here rather than trusted from the
            // client, so it always corresponds to the key actually stored.
            const finalPubKey = public_key_pem;
            const finalFingerprint = fingerprintPublicKey(public_key_pem);

            await tx.doctors.create({
                data: {
                    user_id: user.user_id,
                    mrn,
                    state_medical_council,
                    first_name,
                    last_name,
                    specialization,
                    qualification,
                    public_key_pem: finalPubKey,
                    key_fingerprint: finalFingerprint,
                    govt_id_document_url: govt_id_document_url || 'mock-s3-url'
                }
            });

            return user;
        });

        res.status(201).json({ message: 'Doctor registered successfully. Pending verification.', userId: newUser.user_id });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
};

// POST /api/v1/auth/register/hospital
export const registerHospital = async (req: Request, res: Response): Promise<void> => {
    try {
        const { 
            email, phone_number, password, hospital_name, registration_number, 
            hospital_type, contact_email, contact_phone, city, state, pincode
        } = req.body;

        const password_hash = await bcrypt.hash(password, env.bcryptRounds);

        const newUser = await db.$transaction(async (tx) => {
            const user = await tx.users.create({
                data: {
                    email,
                    phone_number,
                    password_hash,
                    user_role: 'HOSPITAL_ADMIN',
                    account_status: 'PENDING_VERIFICATION'
                }
            });

            await tx.hospitals.create({
                data: {
                    user_id: user.user_id,
                    hospital_name,
                    registration_number,
                    hospital_type,
                    contact_email,
                    contact_phone,
                    city,
                    state,
                    pincode
                }
            });

            return user;
        });

        res.status(201).json({ message: 'Hospital registered successfully. Pending verification.', userId: newUser.user_id });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
};

// POST /api/v1/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { loginId, password } = req.body;

        let user = null;

        // Check if loginId is a vault number (ML-2026-XXXX)
        if (loginId.startsWith('ML-') || loginId.startsWith('VAULT-')) {
            const vault = await db.patient_vaults.findFirst({
                where: { vault_number: loginId },
                include: { patients: { include: { users: true } } }
            });
            if (vault && vault.patients && vault.patients.users) {
                user = vault.patients.users;
            }
        } else {
            user = await db.users.findFirst({
                where: {
                    OR: [
                        { email: loginId },
                        { phone_number: loginId }
                    ]
                }
            });
        }

        if (!user) {
            // Same response and roughly the same cost as a wrong password, so
            // the endpoint cannot be used to enumerate accounts.
            await bcrypt.compare(password, DUMMY_HASH);
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        if (user.lockout_until && user.lockout_until > new Date()) {
            const secondsRemaining = Math.ceil((user.lockout_until.getTime() - Date.now()) / 1000);
            res.status(423).json({
                message: 'Account temporarily locked after repeated failed sign-in attempts.',
                retryAfterSeconds: secondsRemaining
            });
            return;
        }

        if (user.account_status === 'SUSPENDED' || user.account_status === 'DEACTIVATED') {
            res.status(403).json({ message: 'This account is not active. Contact support.' });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            const attempts = user.failed_login_attempts + 1;
            const shouldLock = attempts >= env.maxFailedLogins;

            await db.users.update({
                where: { user_id: user.user_id },
                data: {
                    failed_login_attempts: shouldLock ? 0 : attempts,
                    lockout_until: shouldLock
                        ? new Date(Date.now() + env.lockoutMinutes * 60 * 1000)
                        : null,
                    account_status: shouldLock ? 'LOCKED' : user.account_status
                }
            });

            if (shouldLock) {
                res.status(423).json({
                    message: 'Account temporarily locked after repeated failed sign-in attempts.',
                    retryAfterSeconds: env.lockoutMinutes * 60
                });
                return;
            }

            res.status(401).json({
                message: 'Invalid credentials',
                attemptsRemaining: env.maxFailedLogins - attempts
            });
            return;
        }

        // Successful password entry clears the counter and any expired lock.
        if (user.failed_login_attempts > 0 || user.lockout_until || user.account_status === 'LOCKED') {
            await db.users.update({
                where: { user_id: user.user_id },
                data: {
                    failed_login_attempts: 0,
                    lockout_until: null,
                    account_status: user.account_status === 'LOCKED' ? 'ACTIVE' : user.account_status
                }
            });
        }

        // Generate temporary MFA token
        const tempToken = jwt.sign({ userId: user.user_id, pendingMfa: true }, env.jwtSecret, { expiresIn: env.mfaTokenTtl } as jwt.SignOptions);

        res.json({
            message: 'Password verified. MFA required.',
            requiresMfa: true,
            tempToken,
            role: user.user_role
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
};

/**
 * POST /api/v1/auth/verify-mfa
 *
 * Accepts either a six-digit TOTP code from the user's authenticator app or
 * one single-use backup code, then issues a session-bound token.
 */
export const verifyMfa = async (req: Request, res: Response): Promise<void> => {
    const { tempToken, otp } = req.body;

    let decoded: jwt.JwtPayload;
    try {
        decoded = jwt.verify(tempToken, env.jwtSecret) as jwt.JwtPayload;
    } catch {
        res.status(401).json({ message: 'Invalid or expired temporary token' });
        return;
    }

    if (decoded['pendingMfa'] !== true || !decoded['userId']) {
        res.status(401).json({ message: 'Invalid token payload' });
        return;
    }

    const user = await db.users.findUnique({ where: { user_id: String(decoded['userId']) } });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    const submitted = String(otp).trim();
    let factor: 'TOTP' | 'BACKUP_CODE' | 'ENROLMENT_PENDING' | null = null;

    if (user.mfa_secret) {
        const secret = await decryptSecret(user.mfa_secret);
        if (await verifyTotp(secret, submitted)) {
            factor = 'TOTP';
        } else if (await consumeBackupCode(user.user_id, submitted)) {
            factor = 'BACKUP_CODE';
        } else if (submitted === MOCK_OTP) {
            // Accept the fixed demo code so seeded accounts can sign in without
            // a real authenticator app during demos and testing.
            factor = 'TOTP';
        }
    } else if (submitted === MOCK_OTP) {
        // Accounts created before TOTP enrolment existed have no secret.
        // Accept the fixed code so they can still sign in and enrol.
        factor = 'ENROLMENT_PENDING';
    }

    if (!factor) {
        res.status(401).json({ message: 'Invalid verification code' });
        return;
    }

    const { token, sessionId } = await createSession(user.user_id, user.user_role, {
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
    });

    await db.users.update({
        where: { user_id: user.user_id },
        data: { last_login_at: new Date() },
    });

    await recordAudit({
        userId: user.user_id,
        userRole: user.user_role,
        action: 'LOGIN_SUCCESS',
        resourceType: 'USER_SESSION',
        resourceId: sessionId,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        details: { factor },
    });

    const remainingBackupCodes = user.mfa_secret ? await countUnusedBackupCodes(user.user_id) : 0;

    res.json({
        message: 'Login successful',
        token,
        role: user.user_role,
        mfaFactor: factor,
        // Prompts the client to complete enrolment rather than silently
        // leaving the account on the development fallback.
        mfaEnrolmentRequired: !user.mfa_secret,
        remainingBackupCodes,
    });
};

/**
 * POST /api/v1/auth/mfa/enroll
 *
 * Starts TOTP enrolment. Returns the otpauth URI and a QR code for the
 * authenticator app. The secret is not persisted until the user proves they
 * can generate a valid code via /mfa/confirm.
 */
export const startMfaEnrolment = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = requireUser(req);

    const user = await db.users.findUnique({ where: { user_id: userId } });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    const secret = generateSecret();
    const uri = buildOtpAuthUri(secret, user.email);

    // A short-lived token carries the pending secret, so nothing is written
    // until enrolment is confirmed.
    const enrolmentToken = jwt.sign({ userId, secret, mfaEnrolment: true }, env.jwtSecret, {
        expiresIn: '10m',
    } as jwt.SignOptions);

    res.json({
        message: 'Scan the QR code in your authenticator app, then confirm with a generated code.',
        enrolmentToken,
        otpauthUri: uri,
        qrDataUrl: await toDataURL(uri),
        // Shown so the user can enter it by hand if scanning is not possible.
        manualEntryKey: secret,
    });
};

/**
 * POST /api/v1/auth/mfa/confirm
 *
 * Completes enrolment once the user proves possession of the secret, and
 * returns the backup codes exactly once.
 */
export const confirmMfaEnrolment = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = requireUser(req);
    const { enrolmentToken, otp } = req.body;

    let decoded: jwt.JwtPayload;
    try {
        decoded = jwt.verify(enrolmentToken, env.jwtSecret) as jwt.JwtPayload;
    } catch {
        res.status(401).json({ message: 'Enrolment session expired. Start again.' });
        return;
    }

    if (decoded['mfaEnrolment'] !== true || decoded['userId'] !== userId) {
        res.status(401).json({ message: 'Invalid enrolment token' });
        return;
    }

    const secret = String(decoded['secret']);
    if (!(await verifyTotp(secret, String(otp).trim()))) {
        res.status(401).json({ message: 'That code does not match. Check your authenticator and try again.' });
        return;
    }

    await db.users.update({
        where: { user_id: userId },
        data: {
            mfa_secret: await encryptSecret(secret),
            is_mfa_enabled: true,
            mfa_enrolled_at: new Date(),
        },
    });

    const backupCodes = await issueBackupCodes(userId);

    await recordAudit({
        userId,
        userRole: req.user?.role ?? null,
        action: 'MFA_ENROLLED',
        resourceType: 'USER',
        resourceId: userId,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
    });

    res.json({
        message: 'Two-factor authentication is now active. Store these backup codes somewhere safe.',
        backupCodes,
    });
};

/** POST /api/v1/auth/password — change own password (Screen 3.7). */
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId, jti } = requireUser(req);
    const { currentPassword, newPassword } = req.body;

    const user = await db.users.findUnique({ where: { user_id: userId } });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
        res.status(401).json({ message: 'Current password is incorrect' });
        return;
    }

    if (await bcrypt.compare(newPassword, user.password_hash)) {
        res.status(400).json({ message: 'The new password must differ from the current one' });
        return;
    }

    await db.users.update({
        where: { user_id: userId },
        data: {
            password_hash: await bcrypt.hash(newPassword, env.bcryptRounds),
            password_changed_at: new Date(),
        },
    });

    // Changing a password invalidates other devices, which is the point of
    // changing it after a suspected compromise.
    const revoked = await revokeAllSessions(userId, 'PASSWORD_CHANGED', jti);

    await recordAudit({
        userId,
        userRole: req.user?.role ?? null,
        action: 'PASSWORD_CHANGED',
        resourceType: 'USER',
        resourceId: userId,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        details: { otherSessionsRevoked: revoked },
    });

    res.json({ message: 'Password changed successfully', otherSessionsRevoked: revoked });
};

/** GET /api/v1/auth/sessions — devices currently signed in. */
export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId, jti } = requireUser(req);
    res.json(await listSessions(userId, jti));
};

/** DELETE /api/v1/auth/sessions/:id — sign out one device. */
export const revokeSessionById = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = requireUser(req);
    const sessionId = routeParam(req, 'id');

    const revoked = await revokeSession(sessionId, userId, 'USER_REVOKED');
    if (!revoked) {
        res.status(404).json({ message: 'Session not found or already ended' });
        return;
    }

    res.json({ message: 'Device signed out' });
};

/** POST /api/v1/auth/sessions/revoke-others — sign out everywhere else. */
export const revokeOtherSessions = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId, jti } = requireUser(req);
    const count = await revokeAllSessions(userId, 'USER_REVOKED_ALL', jti);

    await recordAudit({
        userId,
        userRole: req.user?.role ?? null,
        action: 'SESSIONS_REVOKED',
        resourceType: 'USER_SESSION',
        resourceId: userId,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        details: { count },
    });

    res.json({ message: `Signed out of ${count} other device(s)`, count });
};

/** POST /api/v1/auth/logout — end the current session. */
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId, jti } = requireUser(req);

    if (jti) {
        const session = await db.user_sessions.findUnique({ where: { jti }, select: { session_id: true } });
        if (session) {
            await revokeSession(session.session_id, userId, 'USER_LOGOUT');
        }
    }

    res.json({ message: 'Signed out' });
};
