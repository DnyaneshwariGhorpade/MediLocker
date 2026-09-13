-- ============================================================================
-- MediLocker — Initial PostgreSQL Schema Migration
-- Database Engine: PostgreSQL 16
-- Compliance: India DPDP Act 2023 / ABDM Standards
-- ============================================================================

-- Enable UUID Generation Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Custom Enum Types
-- ============================================================================

CREATE TYPE user_role_enum AS ENUM (
    'PATIENT', 
    'DOCTOR', 
    'HOSPITAL_ADMIN', 
    'PLATFORM_ADMIN', 
    'EMERGENCY_PHYSICIAN'
);

CREATE TYPE account_status_enum AS ENUM (
    'PENDING_VERIFICATION', 
    'ACTIVE', 
    'SUSPENDED', 
    'LOCKED', 
    'DEACTIVATED'
);

CREATE TYPE verification_status_enum AS ENUM (
    'PENDING', 
    'VERIFIED', 
    'REJECTED', 
    'SUSPENDED', 
    'REVOKED'
);

CREATE TYPE hospital_type_enum AS ENUM (
    'GOVERNMENT', 
    'PRIVATE_HOSPITAL', 
    'CLINIC', 
    'DIAGNOSTIC_LAB', 
    'MULTI_SPECIALTY'
);

CREATE TYPE record_category_enum AS ENUM (
    'PRESCRIPTION', 
    'BLOOD_REPORT', 
    'X_RAY', 
    'MRI', 
    'CT_SCAN', 
    'VACCINATION_RECORD', 
    'ALLERGY_RECORD', 
    'SURGERY_HISTORY', 
    'DISCHARGE_SUMMARY', 
    'CHRONIC_DISEASE_HISTORY', 
    'PSYCHIATRIC_REPORT', 
    'HIV_REPORT'
);

CREATE TYPE flag_lifecycle_enum AS ENUM (
    'NORMAL', 
    'FLAGGED', 
    'UNDER_REVIEW', 
    'RESOLVED'
);

CREATE TYPE flag_reason_enum AS ENUM (
    'INCORRECT_INFO', 
    'DUPLICATE', 
    'WRONG_PRESCRIPTION', 
    'ILLEGIBLE', 
    'EXPIRED', 
    'MISSING_PAGES', 
    'OTHER'
);

CREATE TYPE consent_status_enum AS ENUM (
    'ACTIVE', 
    'EXPIRED', 
    'REVOKED', 
    'REJECTED'
);

CREATE TYPE notification_event_enum AS ENUM (
    'NEW_RECORD_UPLOAD', 
    'ACCESS_REQUEST', 
    'CONSENT_REQUIRED', 
    'EMERGENCY_ACCESS', 
    'FLAGGED_REPORT', 
    'FOLLOW_UP_REMINDER'
);

CREATE TYPE notification_channel_enum AS ENUM (
    'EMAIL', 
    'SMS', 
    'PUSH', 
    'IN_APP'
);

-- ============================================================================
-- 2. Tables & Schema Definition
-- ============================================================================

-- Table 1: users
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_role user_role_enum NOT NULL DEFAULT 'PATIENT',
    is_mfa_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    mfa_secret VARCHAR(128),
    account_status account_status_enum NOT NULL DEFAULT 'PENDING_VERIFICATION',
    failed_login_attempts INT NOT NULL DEFAULT 0,
    lockout_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: patients
CREATE TABLE patients (
    patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    aadhaar_hash VARCHAR(64) UNIQUE NOT NULL,
    aadhaar_vault_token VARCHAR(128),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    blood_group VARCHAR(10),
    address_line TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(50),
    is_emergency_sharing_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: hospitals
CREATE TABLE hospitals (
    hospital_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    hospital_name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100) UNIQUE NOT NULL,
    hospital_type hospital_type_enum NOT NULL DEFAULT 'MULTI_SPECIALTY',
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    address TEXT,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    verification_status verification_status_enum NOT NULL DEFAULT 'PENDING',
    verified_by_admin_id UUID REFERENCES users(user_id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 4: doctors
CREATE TABLE doctors (
    doctor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    primary_hospital_id UUID REFERENCES hospitals(hospital_id) ON DELETE SET NULL,
    mrn VARCHAR(100) UNIQUE NOT NULL,
    state_medical_council VARCHAR(150) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    qualification VARCHAR(150) NOT NULL,
    experience_years INT DEFAULT 0,
    public_key_pem TEXT NOT NULL,
    key_fingerprint VARCHAR(64) NOT NULL,
    verification_status verification_status_enum NOT NULL DEFAULT 'PENDING',
    govt_id_document_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 5: patient_vaults
CREATE TABLE patient_vaults (
    vault_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID UNIQUE NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    vault_number VARCHAR(32) UNIQUE NOT NULL,
    encryption_salt VARCHAR(64) NOT NULL,
    total_records_count INT NOT NULL DEFAULT 0,
    total_storage_bytes BIGINT NOT NULL DEFAULT 0,
    vault_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 6: medical_records
CREATE TABLE medical_records (
    record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES patient_vaults(vault_id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    uploaded_by_doctor_id UUID NOT NULL REFERENCES doctors(doctor_id) ON DELETE SET NULL,
    hospital_id UUID NOT NULL REFERENCES hospitals(hospital_id) ON DELETE SET NULL,
    record_title VARCHAR(255) NOT NULL,
    category record_category_enum NOT NULL,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    diagnosis VARCHAR(255),
    file_s3_key VARCHAR(500) NOT NULL,
    file_mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_sha256_hash VARCHAR(64) NOT NULL,
    kms_key_id VARCHAR(255) NOT NULL,
    encrypted_dek TEXT NOT NULL,
    iv_bytes VARCHAR(64) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    parent_record_id UUID REFERENCES medical_records(record_id) ON DELETE SET NULL,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tags TEXT[] DEFAULT '{}',
    flag_status flag_lifecycle_enum NOT NULL DEFAULT 'NORMAL',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 7: prescriptions
CREATE TABLE prescriptions (
    prescription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID UNIQUE NOT NULL REFERENCES medical_records(record_id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(doctor_id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
    clinical_notes TEXT,
    medications JSONB NOT NULL DEFAULT '[]',
    digital_signature TEXT NOT NULL,
    signature_algorithm VARCHAR(50) DEFAULT 'SHA256withRSA',
    doctor_public_key_hash VARCHAR(64) NOT NULL,
    is_signature_valid BOOLEAN DEFAULT TRUE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until DATE
);

-- Table 8: consents
CREATE TABLE consents (
    consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES hospitals(hospital_id) ON DELETE SET NULL,
    allowed_categories VARCHAR(50)[] NOT NULL DEFAULT '{}',
    blocked_categories VARCHAR(50)[] NOT NULL DEFAULT '{}',
    access_level VARCHAR(30) NOT NULL DEFAULT 'READ_ONLY',
    consent_status consent_status_enum NOT NULL DEFAULT 'ACTIVE',
    valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    consent_token_hash VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 9: break_glass_access_sessions
CREATE TABLE break_glass_access_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
    doctor_id UUID NOT NULL REFERENCES doctors(doctor_id) ON DELETE RESTRICT,
    hospital_id UUID NOT NULL REFERENCES hospitals(hospital_id) ON DELETE RESTRICT,
    emergency_reason TEXT NOT NULL,
    hospital_admin_verifier_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    verification_otp_hash VARCHAR(64) NOT NULL,
    session_start_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    session_expires_at TIMESTAMPTZ NOT NULL,
    session_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    patient_notified BOOLEAN NOT NULL DEFAULT FALSE,
    patient_notified_at TIMESTAMPTZ,
    ip_address INET NOT NULL,
    user_agent TEXT
);

-- Table 10: break_glass_record_accesses
CREATE TABLE break_glass_record_accesses (
    access_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES break_glass_access_sessions(session_id) ON DELETE CASCADE,
    record_id UUID NOT NULL REFERENCES medical_records(record_id) ON DELETE RESTRICT,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decryption_status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS'
);

-- Table 11: blockchain_anchors
CREATE TABLE blockchain_anchors (
    anchor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID UNIQUE NOT NULL REFERENCES medical_records(record_id) ON DELETE RESTRICT,
    document_sha256 VARCHAR(64) NOT NULL,
    blockchain_network VARCHAR(50) DEFAULT 'HYPERLEDGER_FABRIC',
    channel_name VARCHAR(100) DEFAULT 'medilocker-vault',
    chaincode_name VARCHAR(100) DEFAULT 'RecordIntegrityCC',
    transaction_tx_id VARCHAR(128) UNIQUE,
    block_number BIGINT,
    anchor_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 12: record_flags
CREATE TABLE record_flags (
    flag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES medical_records(record_id) ON DELETE RESTRICT,
    flagged_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    user_role user_role_enum NOT NULL,
    flag_reason flag_reason_enum NOT NULL,
    reason_details TEXT,
    flag_lifecycle_status flag_lifecycle_enum NOT NULL DEFAULT 'FLAGGED',
    reviewed_by_admin_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    admin_notes TEXT,
    resolution_action VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

-- Table 13: patient_vitals
CREATE TABLE patient_vitals (
    vital_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    recorded_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    metric_type VARCHAR(50) NOT NULL,
    metric_value NUMERIC(8,2) NOT NULL,
    metric_unit VARCHAR(20) NOT NULL,
    reading_context VARCHAR(100),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 14: consultations
CREATE TABLE consultations (
    consultation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
    doctor_id UUID NOT NULL REFERENCES doctors(doctor_id) ON DELETE RESTRICT,
    hospital_id UUID NOT NULL REFERENCES hospitals(hospital_id) ON DELETE SET NULL,
    consultation_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    chief_complaint TEXT NOT NULL,
    diagnosis_summary TEXT,
    follow_up_date DATE,
    consultation_status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 15: hms_api_clients
CREATE TABLE hms_api_clients (
    client_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(hospital_id) ON DELETE CASCADE,
    client_name VARCHAR(150) NOT NULL,
    api_key_hash VARCHAR(64) UNIQUE NOT NULL,
    api_secret_hash VARCHAR(255) NOT NULL,
    allowed_ip_cidrs TEXT[] DEFAULT '{}',
    rate_limit_per_minute INT NOT NULL DEFAULT 1000,
    client_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 16: notifications
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    event_type notification_event_enum NOT NULL,
    channel notification_channel_enum NOT NULL DEFAULT 'PUSH',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    payload_json JSONB DEFAULT '{}',
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 17: audit_logs (7-Year Immutable Storage)
CREATE TABLE audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    event_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    user_role VARCHAR(30),
    action VARCHAR(60) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    ip_address INET NOT NULL,
    user_agent TEXT,
    status_code INT NOT NULL DEFAULT 200,
    details JSONB DEFAULT '{}',
    event_sha256_hash VARCHAR(64) NOT NULL,
    previous_log_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. High-Performance Indexes
-- ============================================================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_patients_aadhaar_hash ON patients(aadhaar_hash);
CREATE INDEX idx_records_vault_cat ON medical_records(vault_id, category, is_deleted);
CREATE INDEX idx_records_tags_gin ON medical_records USING GIN(tags);
CREATE INDEX idx_records_sha256 ON medical_records(file_sha256_hash);
CREATE INDEX idx_consents_active_lookup ON consents(patient_id, doctor_id, consent_status, valid_until);
CREATE INDEX idx_break_glass_active ON break_glass_access_sessions(patient_id, session_status, session_expires_at);
CREATE INDEX idx_vitals_patient_trend ON patient_vitals(patient_id, metric_type, recorded_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, delivery_status, created_at DESC);

-- ============================================================================
-- 4. Triggers for Integrity & Compliance
-- ============================================================================

-- Immutability Trigger for Audit Logs
CREATE OR REPLACE FUNCTION trg_enforce_audit_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are forbidden by DPDP Act compliance rules.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION trg_enforce_audit_immutability();

-- Automatic updated_at timestamp function
CREATE OR REPLACE FUNCTION trg_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
CREATE TRIGGER trg_doctors_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
CREATE TRIGGER trg_hospitals_updated_at BEFORE UPDATE ON hospitals FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
CREATE TRIGGER trg_medical_records_updated_at BEFORE UPDATE ON medical_records FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();
CREATE TRIGGER trg_consents_updated_at BEFORE UPDATE ON consents FOR EACH ROW EXECUTE FUNCTION trg_update_timestamp();

-- Sync Flag Status to Parent Medical Record
CREATE OR REPLACE FUNCTION trg_sync_record_flag_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE medical_records 
    SET flag_status = NEW.flag_lifecycle_status, updated_at = CURRENT_TIMESTAMP 
    WHERE record_id = NEW.record_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_flag_status_sync
AFTER INSERT OR UPDATE OF flag_lifecycle_status ON record_flags
FOR EACH ROW
EXECUTE FUNCTION trg_sync_record_flag_status();
