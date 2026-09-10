# MediLocker — Database Schema, Core Stack & System Architecture Specification

**Project Title:** MediLocker — Secure Cloud-Based Digital Medical Record Management Platform  
**Document Version:** 1.0 (Architecture & Implementation Baseline)  
**Standard Alignment:** IEEE 830 / ABDM (Ayushman Bharat Digital Mission) / DPDP Act 2023  
**Database Engine:** PostgreSQL 16 (Relational & JSONB Storage) with Redis 7.2 (High-Speed In-Memory Caching)  
**Deployment Region:** AWS `ap-south-1` (Mumbai, India Data Residency Compliance)

---

## 1. System Overview & Core Technical Stack

MediLocker is a centralized, cloud-native, patient-owned digital healthcare records management platform. It provides lifelong encrypted vault storage for medical records, granular category-level consent access for doctors, break-glass emergency overrides, digital signature verification for prescriptions, and tamper-evident blockchain hash anchoring.

```
+----------------------------------------------------------------------------------------------------+
|                                      MEDILOCKER SYSTEM TOPOLOGY                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ Web Portals: React + TS ] (Patient | Doctor | Hospital HMS | System Admin)                      |
|                                     │ (HTTPS / TLS 1.3)                                            |
|                                     ▼                                                              |
|  [ API Gateway / Envoy Proxy ] ── Rate Limiting & Zero Trust JWT / RBAC Validator                  |
|                                     │                                                              |
|         ┌───────────────────────────┼───────────────────────────┐                                  |
|         ▼                           ▼                           ▼                                  |
|  [ Auth & Identity Service ]  [ Consent Engine ]       [ Medical Vault Service ]                   |
|         │                           │                           │                                  |
|         │                     (Redis Cache)                     │                                  |
|         │                     <10ms Latency                     ▼                                  |
|         │                           │                [ AWS S3 Storage (ap-south-1) ]               |
|         │                           │                (AES-256 Envelope Encryption)                 |
|         │                           │                                                              |
|         └───────────────────────────┼───────────────────────────┘                                  |
|                                     ▼                                                              |
|  [ PostgreSQL 16 (Primary DB) ] ◄── Apache Kafka Event Bus ──► [ Notification & Flagging Service ] |
|                                                                 │                                  |
|                                                                 ▼                                  |
|                                                    [ Hyperledger Fabric Blockchain ]              |
|                                                    (SHA-256 Document Fingerprints)                 |
+----------------------------------------------------------------------------------------------------+
```

### Core Stack Breakdown

| Layer | Technology Selected | Rationale & Purpose |
| :--- | :--- | :--- |
| **Frontend Portals** | React 18+, TypeScript, Vite, TailwindCSS, Lucide-React, TanStack Query | Type-safe, modular UI for 4 role portals (Patient, Doctor, Hospital, Admin) with sub-second responsive views. |
| **Backend Microservices** | Spring Boot 3.x (Java 17) & Node.js / Express (Microservices) | Enterprise-grade security, transaction handling, REST API performance, and seamless ABDM/FHIR alignment. |
| **Primary Database** | PostgreSQL 16 Enterprise | ACID compliance, native JSONB support for clinical documents, robust Row-Level Security (RLS), and indexing capabilities. |
| **Cache & Session Store** | Redis 7.2 Cluster | In-memory consent token evaluation (<10ms target SLA), session revocation, and rate limiting counters. |
| **Event Broker & Queue** | Apache Kafka | Asynchronous event streaming for audit logs, real-time multi-channel alerts (SMS, Email, Push), and background blockchain hash anchoring. |
| **Document Storage** | AWS S3 (`ap-south-1` Mumbai) | Highly durable object storage with AWS KMS Envelope Encryption (AES-256 SSE-KMS) and S3 Object Lock for immutability. |
| **Blockchain / Ledger** | Hyperledger Fabric (Private / Permissioned) | Immutably anchors SHA-256 document fingerprints and consent revocation logs without exposing Personal Health Information (PHI). |
| **Security & Auth** | Spring Security, OAuth2 / JWT (RSA-256), TOTP MFA | Zero Trust token validation, role-based authorization, and instant session invalidation. |
| **Orchestration & DevOps** | Docker, Kubernetes (AWS EKS), Helm, GitHub Actions | Containerized deployment with Horizontal Pod Autoscaling (HPA) and automated CI/CD pipelines. |

---

## 2. Complete Database Schemas and Tables

The MediLocker database schema is organized into logical domain modules:
1. **Identity, Authentication & RBAC Module**
2. **Medical Vault & Record Management Module**
3. **Clinical Details & Digital Prescriptions Module**
4. **Consent Management & Privacy Control Module**
5. **Emergency Break-Glass Access Module**
6. **Data Integrity & Blockchain Anchoring Module**
7. **Record Quality Flagging & Dispute Lifecycle Module**
8. **Patient Health Trends & Vital Metrics Module**
9. **Appointments & Consultation History Module**
10. **Hospital Integration & HMS API Management Module**
11. **Multi-Channel Notification Module**
12. **Immutable Audit & Compliance Logging Module**

---

### Module 1: Identity, Authentication & RBAC

#### 1. `users`
Central authentication table holding identity credentials, multi-factor settings, and account state across all actors.

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `user_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique user identifier. |
| `email` | `VARCHAR(255)` | `NULL` | **UNIQUE, NOT NULL**. Normalized lowercase email address. |
| `phone_number` | `VARCHAR(20)` | `NULL` | **UNIQUE, NOT NULL**. E.164 standard international phone format. |
| `password_hash` | `VARCHAR(255)` | `NULL` | **NOT NULL**. Argon2id or BCrypt password hash. |
| `user_role` | `VARCHAR(30)` | `'PATIENT'` | **NOT NULL**. Enum check: `PATIENT`, `DOCTOR`, `HOSPITAL_ADMIN`, `PLATFORM_ADMIN`, `EMERGENCY_PHYSICIAN`. |
| `is_mfa_enabled` | `BOOLEAN` | `TRUE` | **NOT NULL**. Mandatory MFA flag for Zero Trust compliance (FR04). |
| `mfa_secret` | `VARCHAR(128)` | `NULL` | Encrypted TOTP secret key for authenticator apps / SMS OTP backup. |
| `account_status` | `VARCHAR(30)` | `'PENDING_VERIFICATION'` | Enum check: `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`, `LOCKED`, `DEACTIVATED`. |
| `failed_login_attempts`| `INT` | `0` | **NOT NULL**. Count of continuous invalid login attempts (locks at 5). |
| `lockout_until` | `TIMESTAMPTZ` | `NULL` | Timestamp until which account authentication is locked. |
| `last_login_at` | `TIMESTAMPTZ` | `NULL` | Timestamp of the most recent successful login session. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Record generation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Timestamp updated on any record change. |

#### 2. `patients`
Stores patient-specific demographic details, national identity references, and emergency contacts.

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `patient_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Distinct ID for the patient profile. |
| `user_id` | `UUID` | `NULL` | **FOREIGN KEY (`users.user_id`) ON DELETE CASCADE, UNIQUE, NOT NULL**. |
| `aadhaar_hash` | `VARCHAR(64)` | `NULL` | **UNIQUE, NOT NULL**. Salted SHA-256 hash of Aadhaar number (DPDP Act compliance). |
| `aadhaar_vault_token` | `VARCHAR(128)` | `NULL` | Encrypted reference token from UIDAI / DigiLocker verification. |
| `first_name` | `VARCHAR(100)` | `NULL` | **NOT NULL**. Patient's legal given name. |
| `last_name` | `VARCHAR(100)` | `NULL` | **NOT NULL**. Patient's legal family name. |
| `date_of_birth` | `DATE` | `NULL` | **NOT NULL**. Date of birth for age calculation and verification. |
| `gender` | `VARCHAR(20)` | `NULL` | **NOT NULL**. Enum check: `MALE`, `FEMALE`, `OTHER`, `UNDISCLOSED`. |
| `blood_group` | `VARCHAR(10)` | `NULL` | Enum check: `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`, `UNKNOWN`. |
| `address_line` | `TEXT` | `NULL` | Residential address encrypted with AES-256. |
| `city` | `VARCHAR(100)` | `NULL` | City of residence. |
| `state` | `VARCHAR(100)` | `NULL` | State/Union Territory in India. |
| `pincode` | `VARCHAR(10)` | `NULL` | Postal code. |
| `emergency_contact_name`| `VARCHAR(100)` | `NULL` | Primary emergency contact person's name. |
| `emergency_contact_phone`| `VARCHAR(20)` | `NULL` | Primary emergency contact phone number. |
| `emergency_contact_relation`| `VARCHAR(50)` | `NULL` | Relationship (e.g., `SPOUSE`, `PARENT`, `SIBLING`, `GUARDIAN`). |
| `is_emergency_sharing_allowed`| `BOOLEAN` | `TRUE` | Patient preference flag for Break-Glass access visibility. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Last update timestamp. |

#### 3. `hospitals`
Stores verified healthcare institutions, clinical establishments, and API gateway credentials.

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `hospital_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique hospital identifier. |
| `user_id` | `UUID` | `NULL` | **FOREIGN KEY (`users.user_id`) ON DELETE RESTRICT, UNIQUE, NOT NULL**. Hospital administrator user. |
| `hospital_name` | `VARCHAR(255)` | `NULL` | **NOT NULL**. Registered hospital/clinic name. |
| `registration_number` | `VARCHAR(100)` | `NULL` | **UNIQUE, NOT NULL**. State/National Health Authority Clinical Establishment ID. |
| `hospital_type` | `VARCHAR(50)` | `'MULTI_SPECIALTY'` | Enum check: `GOVERNMENT`, `PRIVATE_HOSPITAL`, `CLINIC`, `DIAGNOSTIC_LAB`, `MULTI_SPECIALTY`. |
| `contact_email` | `VARCHAR(255)` | `NULL` | **NOT NULL**. Official administrative communication email. |
| `contact_phone` | `VARCHAR(20)` | `NULL` | **NOT NULL**. Official contact switchboard phone. |
| `address` | `TEXT` | `NULL` | Physical premises address. |
| `city` | `VARCHAR(100)` | `NULL` | **NOT NULL**. City location. |
| `state` | `VARCHAR(100)` | `NULL` | **NOT NULL**. State location. |
| `pincode` | `VARCHAR(10)` | `NULL` | **NOT NULL**. Postal code. |
| `verification_status` | `VARCHAR(30)` | `'PENDING'` | **NOT NULL**. Enum check: `PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`. |
| `verified_by_admin_id`| `UUID` | `NULL` | **FOREIGN KEY (`users.user_id`)**. Platform admin who approved registration. |
| `verified_at` | `TIMESTAMPTZ` | `NULL` | Timestamp of verification. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Record generation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Modification timestamp. |

#### 4. `doctors`
Stores certified medical professionals, license registrations, affiliations, and asymmetric cryptographic signing keys.

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `doctor_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique doctor identifier. |
| `user_id` | `UUID` | `NULL` | **FOREIGN KEY (`users.user_id`) ON DELETE CASCADE, UNIQUE, NOT NULL**. |
| `primary_hospital_id`| `UUID` | `NULL` | **FOREIGN KEY (`hospitals.hospital_id`) ON DELETE SET NULL**. Primary affiliated hospital. |
| `mrn` | `VARCHAR(100)` | `NULL` | **UNIQUE, NOT NULL**. Medical Registration Number (NMC / State Council ID). |
| `state_medical_council`| `VARCHAR(150)`| `NULL` | **NOT NULL**. Issuing council (e.g., Maharashtra Medical Council). |
| `first_name` | `VARCHAR(100)` | `NULL` | **NOT NULL**. Doctor given name. |
| `last_name` | `VARCHAR(100)` | `NULL` | **NOT NULL**. Doctor family name. |
| `specialization` | `VARCHAR(100)` | `NULL` | **NOT NULL**. Medical specialty (e.g., Cardiology, General Medicine, Neurology). |
| `qualification` | `VARCHAR(150)` | `NULL` | **NOT NULL**. Degrees (e.g., MBBS, MD, MS, DM). |
| `experience_years` | `INT` | `0` | Years of clinical practice. |
| `public_key_pem` | `TEXT` | `NULL` | **NOT NULL**. RSA-2048 / ECDSA Public Key for verifying digital prescription signatures (FR16). |
| `key_fingerprint` | `VARCHAR(64)` | `NULL` | **NOT NULL**. SHA-256 hash fingerprint of doctor's public key. |
| `verification_status` | `VARCHAR(30)` | `'PENDING'` | **NOT NULL**. Enum check: `PENDING`, `VERIFIED`, `REJECTED`, `REVOKED`. |
| `govt_id_document_url`| `VARCHAR(500)`| `NULL` | S3 encrypted path to verification credentials. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Registration timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Last profile modification. |

---

### Module 2: Medical Vault & Record Management

#### 5. `patient_vaults`
Represents the lifelong digital medical vault assigned to every registered patient (FR06).

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `vault_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Lifelong vault identifier. |
| `patient_id` | `UUID` | `NULL` | **FOREIGN KEY (`patients.patient_id`) ON DELETE CASCADE, UNIQUE, NOT NULL**. |
| `vault_number` | `VARCHAR(32)` | `NULL` | **UNIQUE, NOT NULL**. Publicly shareable masked vault account number (e.g. `ML-2026-XXXX`). |
| `encryption_salt` | `VARCHAR(64)` | `NULL` | **NOT NULL**. Cryptographic salt used for client-assisted envelope key derivation. |
| `total_records_count` | `INT` | `0` | **NOT NULL**. Count of active records stored in vault. |
| `total_storage_bytes` | `BIGINT` | `0` | **NOT NULL**. Total physical bytes consumed in AWS S3 storage. |
| `vault_status` | `VARCHAR(30)` | `'ACTIVE'` | Enum check: `ACTIVE`, `FROZEN`, `ARCHIVED`. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Timestamp of vault creation. |
| `updated_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Timestamp of last vault update. |

#### 6. `medical_records`
Master metadata catalog for every medical document, diagnostic scan, and lab report stored in the system (FR07, FR08, FR15).

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `record_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique record identifier. |
| `vault_id` | `UUID` | `NULL` | **FOREIGN KEY (`patient_vaults.vault_id`) ON DELETE CASCADE, NOT NULL**. |
| `patient_id` | `UUID` | `NULL` | **FOREIGN KEY (`patients.patient_id`) ON DELETE CASCADE, NOT NULL**. |
| `uploaded_by_doctor_id`| `UUID` | `NULL` | **FOREIGN KEY (`doctors.doctor_id`) ON DELETE SET NULL, NOT NULL**. Doctor who uploaded the record. |
| `hospital_id` | `UUID` | `NULL` | **FOREIGN KEY (`hospitals.hospital_id`) ON DELETE SET NULL, NOT NULL**. Hospital origin. |
| `record_title` | `VARCHAR(255)` | `NULL` | **NOT NULL**. Human-readable record title (e.g. "Complete Blood Count Test"). |
| `category` | `VARCHAR(50)` | `NULL` | **NOT NULL**. Enum check: `PRESCRIPTION`, `BLOOD_REPORT`, `X_RAY`, `MRI`, `CT_SCAN`, `VACCINATION_RECORD`, `ALLERGY_RECORD`, `SURGERY_HISTORY`, `DISCHARGE_SUMMARY`, `CHRONIC_DISEASE_HISTORY`, `PSYCHIATRIC_REPORT`, `HIV_REPORT`. |
| `is_sensitive` | `BOOLEAN` | `FALSE` | **NOT NULL**. System flag for high-privacy records (e.g. HIV/psychiatric) subject to strict blocking (FR10). |
| `diagnosis` | `VARCHAR(255)` | `NULL` | Primary clinical diagnosis / provisional indication. |
| `file_s3_key` | `VARCHAR(500)` | `NULL` | **NOT NULL**. Encrypted AWS S3 object key (`ap-south-1`). |
| `file_mime_type` | `VARCHAR(100)` | `NULL` | **NOT NULL**. e.g., `application/pdf`, `image/jpeg`, `image/dicom`. |
| `file_size_bytes` | `BIGINT` | `NULL` | **NOT NULL**. Size of uploaded file in bytes. |
| `file_sha256_hash` | `VARCHAR(64)` | `NULL` | **NOT NULL**. SHA-256 cryptographic digest of plaintext content before encryption (FR13). |
| `kms_key_id` | `VARCHAR(255)` | `NULL` | **NOT NULL**. Reference ID of AWS KMS Key used for AES-256 envelope encryption. |
| `encrypted_dek` | `TEXT` | `NULL` | **NOT NULL**. AES-256 Data Encryption Key (DEK) encrypted via AWS KMS master key. |
| `iv_bytes` | `VARCHAR(64)` | `NULL` | **NOT NULL**. Initialization Vector (IV/Nonce) for AES-GCM cipher mode. |
| `version` | `INT` | `1` | **NOT NULL**. Document version number (supports addendums and updates). |
| `parent_record_id` | `UUID` | `NULL` | **FOREIGN KEY (`medical_records.record_id`) ON DELETE SET NULL**. Previous version link if updated. |
| `record_date` | `DATE` | `CURRENT_DATE` | **NOT NULL**. Date test/consultation took place. |
| `tags` | `TEXT[]` | `'{}'` | Searchable indexed array of keywords (e.g., `['cardio', 'cholesterol', 'annual-checkup']`). |
| `flag_status` | `VARCHAR(30)` | `'NORMAL'` | **NOT NULL**. Enum check: `NORMAL`, `FLAGGED`, `UNDER_REVIEW`, `RESOLVED` (FR20). |
| `is_deleted` | `BOOLEAN` | `FALSE` | **NOT NULL**. Soft delete flag (DPDP Act right-to-forget compliance). |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Upload timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Last update timestamp. |

---

### Module 3: Clinical Details & Digital Prescriptions

#### 7. `prescriptions`
Structured clinical prescription data linked to medical records, featuring cryptographic signatures (FR16).

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `prescription_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique prescription identifier. |
| `record_id` | `UUID` | `NULL` | **FOREIGN KEY (`medical_records.record_id`) ON DELETE CASCADE, UNIQUE, NOT NULL**. |
| `doctor_id` | `UUID` | `NULL` | **FOREIGN KEY (`doctors.doctor_id`) ON DELETE RESTRICT, NOT NULL**. Prescribing doctor. |
| `patient_id` | `UUID` | `NULL` | **FOREIGN KEY (`patients.patient_id`) ON DELETE RESTRICT, NOT NULL**. Patient receiving treatment. |
| `clinical_notes` | `TEXT` | `NULL` | General doctor comments, advice, dietary guidelines. |
| `medications` | `JSONB` | `'[]'` | **NOT NULL**. Array of items: `[{"drug_name": "Amoxicillin", "dosage": "500mg", "frequency": "1-0-1", "duration_days": 5, "instructions": "After food"}]`. |
| `digital_signature` | `TEXT` | `NULL` | **NOT NULL**. Base64-encoded RSA/ECDSA digital signature over canonical prescription payload (FR16). |
| `signature_algorithm` | `VARCHAR(50)` | `'SHA256withRSA'` | Cryptographic algorithm used for signing. |
| `doctor_public_key_hash`| `VARCHAR(64)` | `NULL` | **NOT NULL**. SHA-256 hash of the signing key for validation. |
| `is_signature_valid` | `BOOLEAN` | `TRUE` | Verification status evaluated upon receipt. |
| `issued_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Exact issuance timestamp. |
| `valid_until` | `DATE` | `NULL` | Prescription expiration date (e.g. for antibiotic / schedule H drugs). |

---

### Module 4: Consent Management & Privacy Control

#### 8. `consents`
Granular, category-level access permissions granted or blocked by patients to doctors and hospitals (FR09, FR10, FR11).

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `consent_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique consent record ID. |
| `patient_id` | `UUID` | `NULL` | **FOREIGN KEY (`patients.patient_id`) ON DELETE CASCADE, NOT NULL**. Consent granter. |
| `doctor_id` | `UUID` | `NULL` | **FOREIGN KEY (`doctors.doctor_id`) ON DELETE CASCADE, NOT NULL**. Beneficiary doctor. |
| `hospital_id` | `UUID` | `NULL` | **FOREIGN KEY (`hospitals.hospital_id`) ON DELETE SET NULL**. Contextual hospital if applicable. |
| `allowed_categories` | `VARCHAR(50)[]` | `'{}'` | **NOT NULL**. Array of allowed categories: e.g. `['PRESCRIPTION', 'BLOOD_REPORT', 'X_RAY']`. |
| `blocked_categories` | `VARCHAR(50)[]` | `'{}'` | **NOT NULL**. Specifically excluded categories (e.g. `['PSYCHIATRIC_REPORT', 'HIV_REPORT']`). |
| `access_level` | `VARCHAR(30)` | `'READ_ONLY'` | Enum check: `READ_ONLY`, `DOWNLOAD_ALLOWED`. |
| `consent_status` | `VARCHAR(30)` | `'ACTIVE'` | **NOT NULL**. Enum check: `ACTIVE`, `EXPIRED`, `REVOKED`, `REJECTED`. |
| `valid_from` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Time from which access is permitted. |
| `valid_until` | `TIMESTAMPTZ` | `NULL` | **NOT NULL**. Mandatory expiration timestamp (auto-expiring consent). |
| `revoked_at` | `TIMESTAMPTZ` | `NULL` | Timestamp of early revocation if initiated by patient. |
| `revocation_reason` | `TEXT` | `NULL` | Optional patient-provided justification for revoking access. |
| `consent_token_hash` | `VARCHAR(64)` | `NULL` | **UNIQUE, NOT NULL**. SHA-256 hash of cryptographically issued JWT consent token cached in Redis. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Last state change timestamp. |

---

### Module 5: Emergency Break-Glass Access

#### 9. `break_glass_access_sessions`
Stores emergency overrides initiated by certified emergency physicians for unconscious/unresponsive patients (FR12).

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `session_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique emergency session ID. |
| `patient_id` | `UUID` | `NULL` | **FOREIGN KEY (`patients.patient_id`) ON DELETE RESTRICT, NOT NULL**. Patient under emergency care. |
| `doctor_id` | `UUID` | `NULL` | **FOREIGN KEY (`doctors.doctor_id`) ON DELETE RESTRICT, NOT NULL**. Requesting emergency physician. |
| `hospital_id` | `UUID` | `NULL` | **FOREIGN KEY (`hospitals.hospital_id`) ON DELETE RESTRICT, NOT NULL**. Emergency ward / institution. |
| `emergency_reason` | `TEXT` | `NULL` | **NOT NULL**. Mandatory clinical justification (e.g. "Unconscious trauma patient in ER"). |
| `hospital_admin_verifier_id`| `UUID` | `NULL` | **FOREIGN KEY (`users.user_id`) ON DELETE RESTRICT, NOT NULL**. Second-factor hospital verifier. |
| `verification_otp_hash`| `VARCHAR(64)` | `NULL` | **NOT NULL**. SHA-256 hash of emergency authorization OTP. |
| `session_start_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Time emergency access commenced. |
| `session_expires_at` | `TIMESTAMPTZ` | `NULL` | **NOT NULL**. Hard limit expiration (e.g. strictly 4 hours from start). |
| `session_status` | `VARCHAR(30)` | `'ACTIVE'` | Enum check: `ACTIVE`, `EXPIRED`, `TERMINATED`, `REVOKED`. |
| `patient_notified` | `BOOLEAN` | `FALSE` | **NOT NULL**. Confirmation that patient / emergency contact was alerted via SMS/Email. |
| `patient_notified_at`| `TIMESTAMPTZ`| `NULL` | Timestamp notification was delivered. |
| `ip_address` | `INET` | `NULL` | **NOT NULL**. Client IP address of requesting terminal. |
| `user_agent` | `TEXT` | `NULL` | Browser / device user-agent string. |

#### 10. `break_glass_record_accesses`
Audit list of every individual medical record opened or viewed during a Break-Glass emergency session.

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `access_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique audit item ID. |
| `session_id` | `UUID` | `NULL` | **FOREIGN KEY (`break_glass_access_sessions.session_id`) ON DELETE CASCADE, NOT NULL**. |
| `record_id` | `UUID` | `NULL` | **FOREIGN KEY (`medical_records.record_id`) ON DELETE RESTRICT, NOT NULL**. Viewed document. |
| `accessed_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Exact timestamp record was read. |
| `decryption_status` | `VARCHAR(30)` | `'SUCCESS'` | Enum check: `SUCCESS`, `FAILED_KEY`, `UNAUTHORIZED`. |

---

### Module 6: Data Integrity & Blockchain Anchoring

#### 11. `blockchain_anchors`
Immutable record of SHA-256 document fingerprints anchored to Hyperledger Fabric for tamper detection (FR13, FR14).

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `anchor_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique anchor tracking identifier. |
| `record_id` | `UUID` | `NULL` | **FOREIGN KEY (`medical_records.record_id`) ON DELETE RESTRICT, UNIQUE, NOT NULL**. |
| `document_sha256` | `VARCHAR(64)` | `NULL` | **NOT NULL**. Document SHA-256 hash anchored to the ledger. |
| `blockchain_network` | `VARCHAR(50)` | `'HYPERLEDGER_FABRIC'`| Name of permissioned ledger network. |
| `channel_name` | `VARCHAR(100)` | `'medilocker-vault'` | Hyperledger Fabric channel identifier. |
| `chaincode_name` | `VARCHAR(100)` | `'RecordIntegrityCC'` | Chaincode/Smart Contract name. |
| `transaction_tx_id` | `VARCHAR(128)` | `NULL` | **UNIQUE**. Blockchain transaction ID returned by Fabric peer. |
| `block_number` | `BIGINT` | `NULL` | Fabric block sequence number containing the transaction. |
| `anchor_status` | `VARCHAR(30)` | `'PENDING'` | **NOT NULL**. Enum check: `PENDING`, `COMMITTED`, `VERIFIED_MATCH`, `TAMPER_DETECTED`. |
| `last_verified_at` | `TIMESTAMPTZ` | `NULL` | Timestamp of latest automated integrity audit check. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Anchor creation timestamp. |

---

### Module 7: Record Quality Flagging & Dispute Lifecycle

#### 12. `record_flags`
Lifecycle management for disputed, incorrect, or duplicate medical records with strict transition states (FR20).

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `flag_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique flag incident ID. |
| `record_id` | `UUID` | `NULL` | **FOREIGN KEY (`medical_records.record_id`) ON DELETE RESTRICT, NOT NULL**. |
| `flagged_by_user_id` | `UUID` | `NULL` | **FOREIGN KEY (`users.user_id`) ON DELETE SET NULL, NOT NULL**. User initiating flag. |
| `user_role` | `VARCHAR(30)` | `NULL` | **NOT NULL**. Role of reporting user (`PATIENT`, `DOCTOR`, `HOSPITAL_ADMIN`). |
| `flag_reason` | `VARCHAR(50)` | `NULL` | **NOT NULL**. Enum check: `INCORRECT_INFO`, `DUPLICATE`, `WRONG_PRESCRIPTION`, `ILLEGIBLE`, `EXPIRED`, `MISSING_PAGES`, `OTHER`. |
| `reason_details` | `TEXT` | `NULL` | Detailed description of the detected anomaly. |
| `flag_lifecycle_status`| `VARCHAR(30)` | `'FLAGGED'` | **NOT NULL**. 4-state lifecycle: `NORMAL`, `FLAGGED`, `UNDER_REVIEW`, `RESOLVED`. |
| `reviewed_by_admin_id`| `UUID` | `NULL` | **FOREIGN KEY (`users.user_id`) ON DELETE SET NULL**. Administrator assigned to resolve dispute. |
| `admin_notes` | `TEXT` | `NULL` | Internal investigation notes. |
| `resolution_action` | `VARCHAR(50)` | `NULL` | Enum check: `REPLACED_BY_NEW_VERSION`, `VALIDATED_CORRECT`, `FLAG_REJECTED`, `RECORD_ARCHIVED`. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Timestamp flag was logged. |
| `resolved_at` | `TIMESTAMPTZ` | `NULL` | Timestamp resolution was finalized. |

---

### Module 8: Patient Health Trends & Vital Metrics

#### 13. `patient_vitals`
Quantitative health telemetry (Blood Pressure, Blood Sugar, Heart Rate) powering Patient Dashboard trends (FR21).

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `vital_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique metric record ID. |
| `patient_id` | `UUID` | `NULL` | **FOREIGN KEY (`patients.patient_id`) ON DELETE CASCADE, NOT NULL**. |
| `recorded_by_user_id`| `UUID` | `NULL` | **FOREIGN KEY (`users.user_id`) ON DELETE SET NULL**. Doctor or self-recorded by patient. |
| `metric_type` | `VARCHAR(50)` | `NULL` | **NOT NULL**. Enum check: `BP_SYSTOLIC`, `BP_DIASTOLIC`, `BLOOD_SUGAR_FASTING`, `BLOOD_SUGAR_PP`, `PULSE_RATE`, `SPO2`, `BODY_WEIGHT_KG`, `BODY_TEMP_F`. |
| `metric_value` | `NUMERIC(8,2)`| `NULL` | **NOT NULL**. Numerical value (e.g. `120.00`, `98.60`). |
| `metric_unit` | `VARCHAR(20)` | `NULL` | **NOT NULL**. Unit of measure (e.g., `mmHg`, `mg/dL`, `bpm`, `%`, `kg`, `F`). |
| `reading_context` | `VARCHAR(100)` | `NULL` | e.g., "Post lunch", "Resting state", "Pre-dialysis". |
| `recorded_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Timestamp when measurement was taken. |

---

### Module 9: Appointments & Consultation History

#### 14. `consultations`
Tracks clinical consultation events, diagnoses, follow-up dates, and doctor-patient interaction timeline (FR21, FR22).

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `consultation_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique consultation session ID. |
| `patient_id` | `UUID` | `NULL` | **FOREIGN KEY (`patients.patient_id`) ON DELETE RESTRICT, NOT NULL**. |
| `doctor_id` | `UUID` | `NULL` | **FOREIGN KEY (`doctors.doctor_id`) ON DELETE RESTRICT, NOT NULL**. |
| `hospital_id` | `UUID` | `NULL` | **FOREIGN KEY (`hospitals.hospital_id`) ON DELETE SET NULL, NOT NULL**. |
| `consultation_date` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Appointment/consultation timestamp. |
| `chief_complaint` | `TEXT` | `NULL` | **NOT NULL**. Patient's presented symptoms and issues. |
| `diagnosis_summary` | `TEXT` | `NULL` | Doctor's clinical summary and findings. |
| `follow_up_date` | `DATE` | `NULL` | Scheduled follow-up visit date for dashboard reminder alerts (FR21). |
| `consultation_status`| `VARCHAR(30)` | `'COMPLETED'` | Enum check: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Record generation timestamp. |

---

### Module 10: Hospital Integration & HMS API Management

#### 15. `hms_api_clients`
Authentication, API key lifecycle, and rate limits for hospital management systems (FR17).

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `client_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique API client profile ID. |
| `hospital_id` | `UUID` | `NULL` | **FOREIGN KEY (`hospitals.hospital_id`) ON DELETE CASCADE, NOT NULL**. |
| `client_name` | `VARCHAR(150)` | `NULL` | **NOT NULL**. Integration profile (e.g. "Apollo Main HMS Integration"). |
| `api_key_hash` | `VARCHAR(64)` | `NULL` | **UNIQUE, NOT NULL**. SHA-256 hash of the issued REST API key. |
| `api_secret_hash` | `VARCHAR(255)` | `NULL` | **NOT NULL**. Salted hash of the client secret. |
| `allowed_ip_cidrs` | `TEXT[]` | `'{}'` | IP whitelist for secure hospital ingress (Zero Trust). |
| `rate_limit_per_minute`| `INT` | `1000` | **NOT NULL**. Allowed requests per minute before HTTP 429. |
| `client_status` | `VARCHAR(30)` | `'ACTIVE'` | Enum check: `ACTIVE`, `REVOKED`, `EXPIRED`. |
| `last_used_at` | `TIMESTAMPTZ` | `NULL` | Timestamp of latest HMS API transaction. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. API credential issue timestamp. |

---

### Module 11: Multi-Channel Notifications

#### 16. `notifications`
Real-time dispatch log for Email, SMS, and Push notifications across all 6 core events (FR19).

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `notification_id` | `UUID` | `gen_random_uuid()` | **PRIMARY KEY**. Unique notification ID. |
| `user_id` | `UUID` | `NULL` | **FOREIGN KEY (`users.user_id`) ON DELETE CASCADE, NOT NULL**. Recipient user. |
| `event_type` | `VARCHAR(50)` | `NULL` | **NOT NULL**. Enum check: `NEW_RECORD_UPLOAD`, `ACCESS_REQUEST`, `CONSENT_REQUIRED`, `EMERGENCY_ACCESS`, `FLAGGED_REPORT`, `FOLLOW_UP_REMINDER`. |
| `channel` | `VARCHAR(20)` | `'PUSH'` | Enum check: `EMAIL`, `SMS`, `PUSH`, `IN_APP`. |
| `title` | `VARCHAR(255)` | `NULL` | **NOT NULL**. Notification header. |
| `message` | `TEXT` | `NULL` | **NOT NULL**. Message body text. |
| `payload_json` | `JSONB` | `'{}'` | Structured data containing deep links (e.g. `record_id`, `doctor_id`). |
| `delivery_status` | `VARCHAR(30)` | `'PENDING'` | Enum check: `PENDING`, `DELIVERED`, `FAILED`, `READ`. |
| `delivered_at` | `TIMESTAMPTZ` | `NULL` | Dispatch confirmation timestamp from SMS/Email gateway. |
| `read_at` | `TIMESTAMPTZ` | `NULL` | Timestamp user opened notification in portal. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Generation timestamp. |

---

### Module 12: Immutable Audit & Compliance Logging

#### 17. `audit_logs`
Immutable compliance journal tracking all data interactions, consent grants, file decryptions, and administrative changes (NFR10, OR-04). Retained for a minimum of 7 years.

| Attribute | Data Type | Default | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `log_id` | `BIGSERIAL` | *Sequential* | **PRIMARY KEY**. Monotonically increasing sequential audit identifier. |
| `event_id` | `UUID` | `gen_random_uuid()` | **UNIQUE, NOT NULL**. Global UUID for event tracing. |
| `user_id` | `UUID` | `NULL` | **FOREIGN KEY (`users.user_id`) ON DELETE SET NULL**. Actor initiating event. |
| `user_role` | `VARCHAR(30)` | `NULL` | Role of actor at execution time. |
| `action` | `VARCHAR(60)` | `NULL` | **NOT NULL**. e.g., `USER_LOGIN`, `RECORD_UPLOAD`, `RECORD_VIEW`, `RECORD_DOWNLOAD`, `CONSENT_GRANT`, `CONSENT_REVOKE`, `BREAK_GLASS_REQUEST`, `FLAG_RECORD_SUBMIT`, `HMS_API_CALL`. |
| `resource_type` | `VARCHAR(50)` | `NULL` | **NOT NULL**. Target entity: `MEDICAL_RECORD`, `CONSENT`, `PRESCRIPTION`, `PATIENT_VAULT`. |
| `resource_id` | `VARCHAR(100)` | `NULL` | Target resource UUID. |
| `ip_address` | `INET` | `NULL` | **NOT NULL**. Client IP address. |
| `user_agent` | `TEXT` | `NULL` | Client browser / device signature. |
| `status_code` | `INT` | `200` | HTTP response code / execution status. |
| `details` | `JSONB` | `'{}'` | Contextual audit details (no PHI, purely metadata). |
| `event_sha256_hash` | `VARCHAR(64)` | `NULL` | **NOT NULL**. SHA-256 hash of this audit log entry. |
| `previous_log_hash` | `VARCHAR(64)` | `NULL` | Cryptographic chained hash of the immediate prior row for tamper-evidence. |
| `created_at` | `TIMESTAMPTZ` | `CURRENT_TIMESTAMP` | **NOT NULL**. Immutable creation timestamp. |

---

## 3. Database Rules, Constraints & Policies

### 3.1 Custom Enums & Domains
To enforce consistency across microservices, custom domain checks and constraints are maintained:

```sql
-- Role-Based Access Control Enums
CREATE TYPE user_role_enum AS ENUM (
    'PATIENT', 
    'DOCTOR', 
    'HOSPITAL_ADMIN', 
    'PLATFORM_ADMIN', 
    'EMERGENCY_PHYSICIAN'
);

-- Record Types supported by Lifelong Vault (FR07)
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

-- Flag Status Lifecycle (FR20)
CREATE TYPE flag_lifecycle_enum AS ENUM (
    'NORMAL', 
    'FLAGGED', 
    'UNDER_REVIEW', 
    'RESOLVED'
);
```

### 3.2 Automated Database Triggers

#### 1. Immutability Trigger for `audit_logs` (NFR10 Compliance)
Audit logs must never be altered or deleted. Any `UPDATE` or `DELETE` statement executed against `audit_logs` raises an exception and aborts the transaction:

```sql
CREATE OR REPLACE FUNCTION trg_enforce_audit_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are strictly forbidden by DPDP Act compliance rules.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION trg_enforce_audit_immutability();
```

#### 2. Automatic `updated_at` Refresh Trigger
Ensures every mutable table updates its modification timestamp accurately:

```sql
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
```

#### 3. Flag Status Synchronization Trigger
When a new flag is inserted into `record_flags`, the parent `medical_records.flag_status` column is automatically set to `'FLAGGED'`:

```sql
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
```

### 3.3 Indexing Strategy for High-Performance Queries

| Index Name | Table | Columns | Index Type | Purpose / SLA |
| :--- | :--- | :--- | :--- | :--- |
| `idx_users_email` | `users` | `email` | B-Tree | Sub-millisecond user authentication lookup. |
| `idx_patients_aadhaar_hash`| `patients` | `aadhaar_hash` | B-Tree | Aadhaar duplicate registration prevention. |
| `idx_records_vault_cat` | `medical_records` | `vault_id, category, is_deleted` | Composite B-Tree | Quick category filtering inside Patient Vault. |
| `idx_records_tags_gin` | `medical_records` | `tags` | GIN | High-speed array keyword search (FR18). |
| `idx_records_sha256` | `medical_records` | `file_sha256_hash` | B-Tree | Instant tamper-verification hash matching. |
| `idx_consents_active_lookup`| `consents` | `patient_id, doctor_id, consent_status, valid_until` | Composite B-Tree | Accelerated consent resolution (<10ms target). |
| `idx_break_glass_active`| `break_glass_access_sessions`| `patient_id, session_status, session_expires_at` | Composite B-Tree | Active emergency session verification. |
| `idx_vitals_patient_trend`| `patient_vitals` | `patient_id, metric_type, recorded_at DESC`| Composite B-Tree | Graph time-series data for Patient Dashboard. |
| `idx_audit_resource` | `audit_logs` | `resource_type, resource_id, created_at DESC`| Composite B-Tree | Quick compliance auditing on records. |

### 3.4 Row-Level Security (RLS) & Zero Trust Principles
PostgreSQL Row-Level Security is enabled on sensitive medical data tables. Database access by application connection pools sets the session context (`app.current_user_id`, `app.current_user_role`):

```sql
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

-- Patients can only select their own medical records
CREATE POLICY patient_own_records_policy ON medical_records
    FOR SELECT
    USING (
        patient_id IN (
            SELECT patient_id FROM patients WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
        )
        AND is_deleted = FALSE
    );
```

---

## 4. Architect's Design Notes

### 4.1 Data Privacy & DPDP Act 2023 Compliance
1. **No Raw Aadhaar Storage:** Aadhaar numbers are never stored in plaintext. They are salted and hashed with SHA-256 for duplicate checks (`aadhaar_hash`), while KYC is completed using short-lived UIDAI DigiLocker tokens.
2. **Right to Erasure / Soft Deletes:** Medical records support `is_deleted = TRUE` flags, removing them from active portal indexing while preserving cryptographic hashes in audit logs for legal liability defensibility.
3. **Data Localization:** All AWS infrastructure (S3, RDS PostgreSQL, EKS clusters) is provisioned strictly within `ap-south-1` (Mumbai) to adhere to national data sovereignty regulations.

### 4.2 Security Architecture: Zero Trust & AES-256 Envelope Encryption
1. **Envelope Encryption Workflow:**
   - Every file uploaded to MediLocker generates a unique symmetric **Data Encryption Key (DEK)** via AES-256-GCM.
   - The document is encrypted in memory using the DEK.
   - The DEK is encrypted using a Master Key stored securely in **AWS KMS** (Hardware Security Module).
   - The encrypted DEK and IV are stored in PostgreSQL (`medical_records.encrypted_dek`), and the encrypted ciphertext file is saved to private AWS S3 buckets.
   - Database administrators have zero access to KMS decrypt permissions, preventing internal unauthorized data access (NFR02).

```
+-----------------------------------------------------------------------------------------+
|                              AES-256 ENVELOPE ENCRYPTION FLOW                           |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|   1. Client Upload ──► [ Medical Vault Service ]                                        |
|                                │                                                        |
|                                ├──► Request DEK ──► [ AWS KMS Master Key ]              |
|                                │                        │                               |
|                                │◄── Encrypted DEK + Plain DEK ◄┘                        |
|                                │                                                        |
|                                ├──► Encrypt File using Plain DEK (AES-256-GCM)          |
|                                │    (Wipe Plain DEK from memory immediately)            |
|                                │                                                        |
|                                ├──► Save Encrypted File ──► [ AWS S3 Private Bucket ]   |
|                                └──► Save Metadata + Encrypted DEK ──► [ PostgreSQL ]    |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```

### 4.3 Sub-10ms Consent Token Validation (Redis Distributed Cache)
To achieve NFR06 (<10ms consent check per API call), consent states are cached in Redis under key `consent:{patient_id}:{doctor_id}`:
- **Cache Payload:**
  ```json
  {
    "status": "ACTIVE",
    "allowed_categories": ["PRESCRIPTION", "BLOOD_REPORT"],
    "blocked_categories": ["PSYCHIATRIC_REPORT", "HIV_REPORT"],
    "valid_until": "2026-09-30T23:59:59Z"
  }
  ```
- **Instant Revocation (FR11):** When a patient clicks "Revoke Consent", the PostgreSQL record updates to `REVOKED`, an event is emitted over Kafka, and Redis immediately deletes the cache key. The next doctor API call is blocked within <1 millisecond.

### 4.4 Break-Glass Emergency Protocol
- **Dual Verification:** An emergency physician cannot unlock records alone. A hospital admin or emergency shift in-charge must approve the Break-Glass OTP.
- **Time Limitation:** Break-Glass tokens are valid for a maximum of 4 hours, strictly auto-expiring via scheduled worker sweeps and Redis TTL.
- **Automatic Notification:** An urgent SMS and email alert are automatically sent to the patient and their emergency contact immediately upon session initiation.

### 4.5 Digital Signatures for Prescriptions (PKI Architecture)
1. When a verified doctor issues a prescription, their local private key signs the canonical JSON payload (containing drug names, dosage, frequency, and patient ID).
2. The resulting base64 signature is saved with the prescription.
3. Any hospital, pharmacy, or patient can verify authenticity in real-time by checking the signature against the doctor's registered public key stored in `doctors.public_key_pem`.

### 4.6 Blockchain Hash Anchoring (Hyperledger Fabric)
1. For every uploaded record, the SHA-256 hash of the original document is calculated.
2. The hash, document metadata (Doc ID, Doctor ID, Hospital ID, Timestamp), and zero PHI are transmitted via Kafka to a Hyperledger Fabric peer node.
3. The chaincode stores the immutable tuple `(RecordID, DocumentHash, Timestamp)`.
4. If a file in S3 or database record is ever manipulated, recomputing the SHA-256 hash produces an immediate mismatch against the blockchain record, setting off high-priority alerts (FR14).

---

## 5. Complete Project Folder Structure

The MediLocker project is structured as a scalable microservices monorepo:

```
d:/MediLocker/
├── .github/
│   └── workflows/
│       ├── ci-backend.yml              # Automated build, unit tests, linting
│       ├── ci-frontend.yml             # React build & test workflow
│       └── cd-deploy-eks.yml           # AWS EKS Kubernetes deployment
├── docker/
│   ├── docker-compose.yml              # Local multi-container dev environment
│   ├── Dockerfile.auth-service
│   ├── Dockerfile.vault-service
│   ├── Dockerfile.consent-service
│   ├── Dockerfile.notification-service
│   └── Dockerfile.frontend
├── k8s/                                # Kubernetes Manifests for AWS EKS (NFR09)
│   ├── base/
│   │   ├── configmap.yaml
│   │   ├── secrets.yaml
│   │   ├── ingress.yaml                # TLS 1.3 Ingress Routing
│   │   └── hpa.yaml                    # Horizontal Pod Autoscalers (500+ users)
│   └── services/
│       ├── auth-deployment.yaml
│       ├── vault-deployment.yaml
│       ├── consent-deployment.yaml
│       └── notification-deployment.yaml
├── database/
│   ├── migrations/                     # Flyway / Liquibase SQL migrations
│   │   ├── V1__init_auth_schema.sql
│   │   ├── V2__init_vault_schema.sql
│   │   ├── V3__init_consent_schema.sql
│   │   ├── V4__init_breakglass_schema.sql
│   │   ├── V5__init_blockchain_anchors.sql
│   │   ├── V6__init_vitals_consultations.sql
│   │   ├── V7__init_triggers_and_indexes.sql
│   │   └── V8__init_audit_immutability.sql
│   └── seeds/
│       └── dev_seed_data.sql           # Initial roles, specialties & test data
├── blockchain/                         # Hyperledger Fabric Chaincode
│   ├── chaincode/
│   │   ├── go.mod
│   │   └── record_integrity.go         # Tamper detection smart contract
│   └── network/
│       ├── connection-profile.json
│       └── docker-compose-fabric.yml
├── backend/
│   ├── common-lib/                     # Shared DTOs, Security filters, Encryption utils
│   │   ├── src/main/java/com/medilocker/common/
│   │   │   ├── crypto/                 # AES-256 Envelope KMS & RSA Signatures
│   │   │   ├── exceptions/             # Global Error Handlers
│   │   │   └── security/               # JWT Token Parser & Zero Trust Interceptor
│   ├── auth-service/                   # Service 1: Identity, Registration & MFA
│   │   ├── src/main/java/com/medilocker/auth/
│   │   │   ├── controllers/            # /api/v1/auth, /api/v1/users
│   │   │   ├── models/
│   │   │   ├── services/               # Aadhaar verification, JWT, MFA
│   │   │   └── repositories/
│   │   └── pom.xml
│   ├── vault-service/                  # Service 2: Medical Vault & S3 Encryption
│   │   ├── src/main/java/com/medilocker/vault/
│   │   │   ├── controllers/            # /api/v1/vault, /api/v1/records
│   │   │   ├── services/               # AES-256 S3 storage, SHA-256 hashing
│   │   │   └── repositories/
│   │   └── pom.xml
│   ├── consent-service/                # Service 3: Category Consent & Redis Cache
│   │   ├── src/main/java/com/medilocker/consent/
│   │   │   ├── controllers/            # /api/v1/consent, /api/v1/break-glass
│   │   │   ├── services/               # Redis <10ms validation, Revocation
│   │   │   └── repositories/
│   │   └── pom.xml
│   ├── prescription-service/           # Service 4: Prescriptions & Digital Signs
│   ├── hms-integration-service/        # Service 5: Hospital REST APIs (FR17)
│   ├── notification-service/           # Service 6: Kafka Consumer, SMS & Email
│   ├── analytics-service/              # Service 7: Dashboards & Trends (FR21, FR22)
│   └── audit-service/                  # Service 8: 7-Year Immutable Event Logger
├── frontend/                           # React + TypeScript Web Application
│   ├── public/
│   │   ├── favicon.ico
│   │   └── logo.svg
│   ├── src/
│   │   ├── assets/
│   │   ├── components/                 # Reusable UI components
│   │   │   ├── common/                 # Buttons, Modals, Tables, Toast alerts
│   │   │   ├── layout/                 # Navbar, Sidebar, Portal Headers
│   │   │   ├── charts/                 # Blood Pressure & Sugar trend charts
│   │   │   └── security/               # MFA Dialogs, Signature Badges
│   │   ├── context/                    # AuthContext, ConsentContext
│   │   ├── hooks/                      # useAuth, useVaultRecords, useConsent
│   │   ├── portals/                    # 4 Role-Based Isolated Portals
│   │   │   ├── patient/                # Dashboard, Vault, Consent Manager, Vitals
│   │   │   ├── doctor/                 # Patient Search, Upload, Digital Signer
│   │   │   ├── hospital/               # HMS API Console, Staff Verifications
│   │   │   └── admin/                  # Verification Queue, Flagged Reports
│   │   ├── services/                   # Axios API Clients
│   │   │   ├── api.ts
│   │   │   ├── authApi.ts
│   │   │   ├── vaultApi.ts
│   │   │   └── consentApi.ts
│   │   ├── types/                      # TypeScript definitions for all DB models
│   │   ├── App.tsx                     # React Router with Role-Based Route Guards
│   │   ├── main.tsx
│   │   └── index.css                   # Modern CSS design system
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docs/                               # System Documentation & SRS
│   ├── SRS_MediLocker_v1.0.md
│   ├── DATABASE_SCHEMA_AND_ARCHITECTURE.md
│   └── API_SPECIFICATION_OPENAPI.yaml
└── README.md
```

---

## 6. Verification and Implementation Checklist

- [x] **Relational Schema Design:** All 17 tables mapped with strict data types, defaults, primary keys, foreign keys, and integrity constraints.
- [x] **Regulatory Alignment:** DPDP Act 2023 consent withdrawal, data localization (`ap-south-1`), and salted Aadhaar hashing.
- [x] **Security & Integrity:** Immutability triggers for audit logs (7-year retention), AES-256 envelope encryption with AWS KMS, RSA-256 prescription digital signatures, and Hyperledger Fabric SHA-256 blockchain verification.
- [x] **Performance Optimization:** Redis caching architecture designed for sub-10ms consent token resolution (NFR06).
- [x] **Microservices Monorepo Layout:** Clean directory structure separating frontend role portals, 8 independently scalable microservices, Kubernetes manifests, and database migrations.
