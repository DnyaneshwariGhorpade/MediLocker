import { z } from 'zod';
import {
    categoryList,
    email,
    FLAG_REASONS,
    FLAG_STATUSES,
    futureDate,
    HOSPITAL_TYPES,
    idParam,
    isoDate,
    longText,
    pagination,
    password,
    phone,
    RECORD_CATEGORIES,
    sha256Hex,
    shortText,
    uuid,
} from './common';

export { idParam };

// ------------------------------------------------------------------- auth

export const loginSchema = z.object({
    loginId: z.string().trim().min(3).max(255),
    password: z.string().min(1).max(128),
});

export const verifyMfaSchema = z.object({
    tempToken: z.string().min(10),
    // Either a six-digit TOTP code or a backup code such as A1B2C-3D4E5.
    otp: z
        .string()
        .trim()
        .regex(/^([0-9]{6}|[A-Za-z0-9]{5}-?[A-Za-z0-9]{5})$/, 'Enter a six-digit code or a backup code'),
});

export const aadhaarOtpSchema = z.object({
    aadhaar_number: z.string().regex(/^[0-9]{12}$/, 'Aadhaar must be twelve digits'),
});

export const registerPatientSchema = z.object({
    email,
    phone_number: phone,
    password,
    aadhaar_hash: z.string().trim().min(8).max(64),
    first_name: shortText(100),
    last_name: shortText(100),
    date_of_birth: isoDate,
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    blood_group: z.string().trim().max(10).optional(),
    address_line: z.string().trim().max(500).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    pincode: z.string().trim().regex(/^[0-9]{6}$/, 'PIN code must be six digits').optional(),
    emergency_contact_name: z.string().trim().max(100).optional(),
    emergency_contact_phone: phone.optional(),
    emergency_contact_relation: z.string().trim().max(50).optional(),
    is_emergency_sharing_allowed: z.boolean().optional(),
});

export const registerDoctorSchema = z.object({
    email,
    phone_number: phone,
    password,
    mrn: shortText(100),
    state_medical_council: shortText(150),
    first_name: shortText(100),
    last_name: shortText(100),
    specialization: shortText(100),
    qualification: shortText(150),
    // Generated in the browser and non-optional: without it the account
    // cannot issue verifiable prescriptions.
    public_key_pem: z.string().min(80).max(4096),
    govt_id_document_url: z.string().max(500).optional(),
});

export const registerHospitalSchema = z.object({
    email,
    phone_number: phone,
    password,
    hospital_name: shortText(255),
    registration_number: shortText(100),
    hospital_type: z.enum(HOSPITAL_TYPES),
    contact_email: email,
    contact_phone: phone,
    address: z.string().trim().max(500).optional(),
    city: shortText(100),
    state: shortText(100),
    pincode: z.string().trim().regex(/^[0-9]{6}$/, 'PIN code must be six digits'),
});

// ---------------------------------------------------------------- patient

export const addVitalSchema = z.object({
    metric_type: shortText(50),
    metric_value: z.coerce.number().finite().min(-9999).max(999999),
    metric_unit: shortText(20),
    reading_context: z.string().trim().max(100).optional(),
    recorded_at: isoDate.optional(),
});

export const updateProfileSchema = z.object({
    address_line: z.string().trim().max(500).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    pincode: z.string().trim().regex(/^[0-9]{6}$/).optional(),
});

export const emergencySettingsSchema = z.object({
    emergency_contact_name: z.string().trim().max(100).optional(),
    emergency_contact_phone: phone.optional(),
    emergency_contact_relation: z.string().trim().max(50).optional(),
    is_emergency_sharing_allowed: z.boolean().optional(),
});

// ---------------------------------------------------------------- consent

export const grantConsentSchema = z
    .object({
        doctor_id: uuid,
        allowed_categories: categoryList.min(1, 'Select at least one allowed category'),
        blocked_categories: categoryList.default([]),
        valid_until: futureDate,
        access_level: z.enum(['READ_ONLY', 'DOWNLOAD']).default('READ_ONLY'),
    })
    .refine(
        (value) => !value.allowed_categories.some((category) => value.blocked_categories.includes(category)),
        { message: 'A category cannot be both allowed and blocked', path: ['blocked_categories'] }
    );

// ------------------------------------------------------------------ vault

export const vaultRecordsQuerySchema = z.object({
    category: z.union([z.enum(RECORD_CATEGORIES), z.literal('ALL')]).optional(),
    search: z.string().trim().max(200).optional(),
});

/**
 * Multipart upload metadata. The file itself is handled by multer; the digest
 * and size are computed server-side from the received bytes, so neither is
 * accepted from the client.
 */
export const uploadRecordSchema = z.object({
    vault_number: shortText(32),
    record_title: shortText(255),
    category: z.enum(RECORD_CATEGORIES),
    diagnosis: z.string().trim().max(255).optional(),
    record_date: isoDate.optional(),
    // Form fields arrive as strings, so a comma-separated list is accepted too.
    tags: z
        .union([z.array(z.string().trim().max(50)).max(20), z.string().max(500)])
        .optional()
        .default([]),
});

export const anchorBlockchainSchema = z.object({
    record_id: uuid,
});

// ----------------------------------------------------------------- doctor

export const checkConsentSchema = z.object({
    identifier: shortText(64),
});

export const requestConsentSchema = z.object({
    patient_id: uuid,
});

export const medicationSchema = z.object({
    name: shortText(150),
    dosage: shortText(50),
    frequency: shortText(50),
    duration_days: z.coerce.number().int().min(1).max(365).optional(),
    instructions: z.string().trim().max(255).optional(),
});

export const prescriptionSchema = z.object({
    patient_id: uuid,
    clinical_notes: z.string().trim().max(5000).optional(),
    medications: z.array(medicationSchema).min(1, 'A prescription needs at least one medication'),
    digital_signature: z.string().min(1).max(4096),
    // Part of the signed payload, so it must come from the signer.
    issued_at: z.string().datetime(),
    valid_until: isoDate.optional(),
});

export const consultationSchema = z.object({
    patient_id: uuid,
    chief_complaint: longText(2000),
    diagnosis_summary: z.string().trim().max(2000).optional(),
    follow_up_date: isoDate.optional(),
});

export const doctorSearchQuerySchema = z.object({
    vault_number: shortText(32),
    category: z.union([z.enum(RECORD_CATEGORIES), z.literal('ALL')]).optional(),
    keyword: z.string().trim().max(200).optional(),
    hospital_id: uuid.optional(),
    from_date: isoDate.optional(),
    to_date: isoDate.optional(),
});

export const flagRecordSchema = z.object({
    record_id: uuid,
    flag_reason: z.enum(FLAG_REASONS),
    reason_details: z.string().trim().max(2000).optional(),
});

// -------------------------------------------------------------- emergency

export const initiateEmergencySchema = z.object({
    identifier: shortText(64),
    emergency_reason: longText(2000),
});

export const approveEmergencySchema = z.object({
    session_id: uuid,
    otp: z.string().regex(/^[0-9]{6}$/, 'OTP must be six digits'),
});

export const terminateEmergencySchema = z.object({
    session_id: uuid,
});

// --------------------------------------------------------------------- hms

export const generateApiKeySchema = z.object({
    client_name: shortText(150),
    allowed_ip_cidrs: z
        .array(z.string().regex(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/, 'Must be an IPv4 address or CIDR block'))
        .max(50)
        .default([]),
});

export const ipWhitelistSchema = z.object({
    client_id: uuid,
    allowed_ip_cidrs: z
        .array(z.string().regex(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/, 'Must be an IPv4 address or CIDR block'))
        .max(50),
});

// ------------------------------------------------------------------ admin

export const rejectSchema = z.object({
    reason: z.string().trim().max(1000).optional(),
});

export const resolveDisputeSchema = z.object({
    status: z.enum(FLAG_STATUSES),
    action: z.string().trim().max(50).optional(),
    adminNotes: z.string().trim().max(2000).optional(),
});

export const auditLogQuerySchema = pagination.extend({
    user_id: uuid.optional(),
    user_role: z.string().trim().max(30).optional(),
    action: z.string().trim().max(60).optional(),
    resource_type: z.string().trim().max(50).optional(),
    resource_id: z.string().trim().max(100).optional(),
    ip_address: z.string().trim().max(45).optional(),
    start_date: isoDate.optional(),
    end_date: isoDate.optional(),
});

export const auditExportQuerySchema = z.object({
    start_date: isoDate.optional(),
    end_date: isoDate.optional(),
    format: z.enum(['json', 'csv']).default('json'),
});

// ----------------------------------------------------------------- public

export const verifyHashSchema = z.object({
    sha256_hash: sha256Hex,
});

export const verifyPrescriptionSchema = z.object({
    prescription_id: uuid,
});

export const mfaConfirmSchema = z.object({
    enrolmentToken: z.string().min(10),
    otp: z.string().regex(/^[0-9]{6}$/, 'Code must be six digits'),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
});
