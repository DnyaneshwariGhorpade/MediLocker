import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../services/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-dev';

// Mock OTP logic
const MOCK_OTP = '123456';

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

        const password_hash = await bcrypt.hash(password, 10);

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

        const password_hash = await bcrypt.hash(password, 10);

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

            // Mock generation for PEM/Fingerprint if not provided by client
            const finalPubKey = public_key_pem || 'mock-rsa-public-key-pem';
            const finalFingerprint = key_fingerprint || 'mock-fingerprint';

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

        const password_hash = await bcrypt.hash(password, 10);

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
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        // Generate temporary MFA token
        const tempToken = jwt.sign({ userId: user.user_id, pendingMfa: true }, JWT_SECRET, { expiresIn: '5m' });

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

// POST /api/v1/auth/verify-mfa
export const verifyMfa = async (req: Request, res: Response): Promise<void> => {
    try {
        const { tempToken, otp } = req.body;

        if (!tempToken || !otp) {
            res.status(400).json({ message: 'Token and OTP are required' });
            return;
        }

        // Verify temp token
        let decoded: any;
        try {
            decoded = jwt.verify(tempToken, JWT_SECRET);
        } catch (e) {
            res.status(401).json({ message: 'Invalid or expired temporary token' });
            return;
        }

        if (!decoded.pendingMfa || !decoded.userId) {
            res.status(401).json({ message: 'Invalid token payload' });
            return;
        }

        // Verify OTP
        if (otp !== MOCK_OTP) {
            res.status(401).json({ message: 'Invalid OTP' });
            return;
        }

        const user = await db.users.findUnique({
            where: { user_id: decoded.userId }
        });

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Issue final token
        const finalToken = jwt.sign({ userId: user.user_id, role: user.user_role }, JWT_SECRET, { expiresIn: '2h' });

        res.json({ 
            message: 'Login successful', 
            token: finalToken, 
            role: user.user_role 
        });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'MFA verification failed', error: error.message });
    }
};
