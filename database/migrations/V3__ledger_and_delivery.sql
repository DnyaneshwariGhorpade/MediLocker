-- =============================================================================
-- MediLocker — Migration V3
-- Tamper-evident ledger and notification delivery (Phase 5)
--
-- Adds:
--   * an append-only, hash-chained ledger for document integrity anchoring,
--     replacing the placeholder blockchain fields
--   * delivery bookkeeping on notifications so a worker can retry safely
--   * an integrity-sweep result column on medical_records
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Append-only integrity ledger
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ledger_entries (
    entry_id          BIGSERIAL PRIMARY KEY,
    -- What is being attested. Kept generic so consent revocations can be
    -- anchored later without another table.
    subject_type      VARCHAR(50)  NOT NULL,
    subject_id        VARCHAR(100) NOT NULL,
    -- The value being committed to, e.g. a document SHA-256.
    payload_sha256    VARCHAR(64)  NOT NULL,
    -- Chain linkage. entry_hash covers previous_hash, so rewriting or removing
    -- any entry breaks verification from that point onward.
    previous_hash     VARCHAR(64),
    entry_hash        VARCHAR(64)  NOT NULL,
    metadata          JSONB        NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_subject
    ON ledger_entries(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_ledger_payload
    ON ledger_entries(payload_sha256);

-- The ledger is append-only by construction, enforced in the database rather
-- than trusted to application code.
CREATE OR REPLACE FUNCTION trg_enforce_ledger_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Ledger entries are immutable. UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_entries_immutable ON ledger_entries;
CREATE TRIGGER trg_ledger_entries_immutable
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION trg_enforce_ledger_immutability();

-- -----------------------------------------------------------------------------
-- 2. Link anchors to their ledger entry
-- -----------------------------------------------------------------------------

ALTER TABLE blockchain_anchors
    ADD COLUMN IF NOT EXISTS ledger_entry_id BIGINT REFERENCES ledger_entries(entry_id);

-- -----------------------------------------------------------------------------
-- 3. Notification delivery bookkeeping
-- -----------------------------------------------------------------------------

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS delivery_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS delivery_error TEXT;
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS provider_receipt VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_notifications_pending
    ON notifications(delivery_status, delivery_attempts, created_at);

-- -----------------------------------------------------------------------------
-- 4. Integrity sweep results
-- -----------------------------------------------------------------------------

ALTER TABLE medical_records
    ADD COLUMN IF NOT EXISTS integrity_checked_at TIMESTAMPTZ;
ALTER TABLE medical_records
    ADD COLUMN IF NOT EXISTS integrity_status VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED';

COMMENT ON COLUMN medical_records.integrity_status IS
    'UNVERIFIED | VERIFIED | MISMATCH | MISSING. Set by the scheduled integrity sweep.';

CREATE INDEX IF NOT EXISTS idx_records_integrity
    ON medical_records(integrity_status, integrity_checked_at);

-- -----------------------------------------------------------------------------
-- 5. Consent expiry reminder bookkeeping
-- -----------------------------------------------------------------------------

ALTER TABLE consents
    ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at TIMESTAMPTZ;
