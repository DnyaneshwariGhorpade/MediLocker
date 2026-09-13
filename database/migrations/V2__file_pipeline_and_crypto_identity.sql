-- =============================================================================
-- MediLocker — Migration V2
-- Encrypted file pipeline (Phase 3) and cryptographic identity (Phase 4)
--
-- Adds:
--   * storage/encryption provenance on medical_records, so records created by
--     the pre-pipeline mock code can be identified and refused
--   * per-session tracking for device listing and remote logout
--   * single-use MFA backup codes
--   * expiry for the break-glass verification code
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Medical record storage provenance
-- -----------------------------------------------------------------------------

-- Which storage backend holds the ciphertext. MOCK marks rows created before
-- the file pipeline existed; they have no retrievable object and must not be
-- served as if they did.
ALTER TABLE medical_records
    ADD COLUMN IF NOT EXISTS storage_driver VARCHAR(20) NOT NULL DEFAULT 'MOCK';

ALTER TABLE medical_records
    ADD COLUMN IF NOT EXISTS encryption_algorithm VARCHAR(50) NOT NULL DEFAULT 'NONE';

-- GCM authentication tag for the wrapped data encryption key.
ALTER TABLE medical_records
    ADD COLUMN IF NOT EXISTS dek_auth_tag VARCHAR(64);

ALTER TABLE medical_records
    ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255);

COMMENT ON COLUMN medical_records.storage_driver IS
    'MOCK | LOCAL | S3. MOCK rows predate the encrypted pipeline and have no object.';

CREATE INDEX IF NOT EXISTS idx_records_storage_driver
    ON medical_records(storage_driver);

-- -----------------------------------------------------------------------------
-- 2. Account security columns
-- -----------------------------------------------------------------------------

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 3. Session tracking (device list and remote logout)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_sessions (
    session_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    -- JWT id claim. Revoking a session invalidates the token carrying this jti.
    jti              UUID NOT NULL UNIQUE,
    ip_address       VARCHAR(45),
    user_agent       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at       TIMESTAMPTZ NOT NULL,
    revoked_at       TIMESTAMPTZ,
    revoked_reason   VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active
    ON user_sessions(user_id, revoked_at, expires_at);

-- -----------------------------------------------------------------------------
-- 4. MFA backup codes
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mfa_backup_codes (
    code_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    -- SHA-256 of the code. The plaintext is shown once at enrolment.
    code_hash   VARCHAR(64) NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mfa_backup_code_hash
    ON mfa_backup_codes(user_id, code_hash);

-- -----------------------------------------------------------------------------
-- 5. Break-glass verification code expiry
-- -----------------------------------------------------------------------------

ALTER TABLE break_glass_access_sessions
    ADD COLUMN IF NOT EXISTS verification_otp_expires_at TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 6. Timestamp triggers for the new tables
-- -----------------------------------------------------------------------------

-- user_sessions tracks last_seen_at explicitly rather than via trigger, so no
-- updated_at trigger is required here.
