# MediLocker — Developer & User Operations Manual

> **A Complete Onboarding, Architectural, and Operational Guide for Working with the MediLocker Healthcare Platform**

---

## 1. Executive Summary & System Overview

**MediLocker** is a patient-centric, zero-trust digital healthcare record vault and Electronic Health Record (EHR) platform. It provides patients with complete cryptographic ownership and granular control over their medical history while enabling verified doctors, hospitals, and emergency personnel to collaborate seamlessly and securely.

### Core Value Propositions
* **Patient Data Sovereignty:** Patients explicitly control who views their records, which categories are accessible, for what duration, and can revoke consent at any moment.
* **Envelope Encryption (Zero-Knowledge Storage):** Files are encrypted using AES-256-GCM with unique, per-record Data Encryption Keys (DEKs) wrapped by master Key Management Service (KMS) keys.
* **Non-Repudiation with In-Browser Digital Signatures:** Doctors cryptographically sign prescriptions in their browser using non-extractable Web Crypto ECDSA P-256 private keys. Any pharmacy or patient can verify the signature and clinical authenticity using a public verifier.
* **Tamper-Evident Hash Chain Audit Log:** All operations (authentication, view, upload, export, consent change, emergency break-glass) are recorded in an append-only forward-hash chain secured by PostgreSQL database-level immutability triggers.
* **Time-Boxed Emergency Break-Glass Access:** In life-threatening emergencies, authorized emergency doctors can initiate audited break-glass sessions with mandatory hospital administration verification, real-time patient notifications, and automatic expiration.
* **Regulatory Alignment:** Designed from the ground up in alignment with the **India Digital Personal Data Protection (DPDP) Act 2023** and **Ayushman Bharat Digital Mission (ABDM)** standards.

---

## 2. Architecture: Reality vs. Target

MediLocker is architecturally designed for scalable microservices, but is currently implemented as a modular monolith. This is a deliberate design choice that simplifies local development and testing while preserving strict modular boundaries.

| Architectural Concern | Target Microservice Vision | Current Modular Implementation | Status / Notes |
| :--- | :--- | :--- | :--- |
| **Service Topology** | 8 microservices behind Envoy API Gateway | Single modular Express 5 process with domain-based route routing | Fully functional modular monolith |
| **Database** | Distributed PostgreSQL Cluster | PostgreSQL 16 with relational integrity & database triggers | Production-ready schema with 20 tables |
| **Object Storage** | AWS S3 (`ap-south-1`) with bucket encryption | Local filesystem storage (`./storage`) by default; S3 driver included | Switch via `STORAGE_DRIVER=LOCAL` or `S3` |
| **Key Management** | AWS KMS Hardware Security Module (HSM) | Local master key provider by default; AWS KMS driver included | Switch via `KEY_PROVIDER=LOCAL` or `KMS` |
| **Consent Cache** | Redis 7.2 Cluster | Redis when `REDIS_URL` is set; automatic fallback to in-memory cache | Monitored live via `/admin/system-health` |
| **Integrity Ledger** | Hyperledger Fabric Permissioned Blockchain | Append-only hash-chained table with immutability database triggers | Cryptographically verifiable via API |
| **Prescription Signing**| RSA-2048 PKI / HSM | Client-side ECDSA P-256 (Web Crypto API) with public key registry | Live verified via `/verify` tool |
| **MFA Authentication** | TOTP / Hardware Security Keys | RFC 6238 TOTP with single-use SHA-256 hashed backup codes | Active on all accounts |
| **Notifications** | Distributed Apache Kafka + Multi-channel SMS/Email | In-database transactional outbox with simulated delivery / SMTP | Real SMTP supported via `.env` |

---

## 3. Technology Stack

### Frontend Application (`/frontend`)
* **Framework:** React 19 (TypeScript)
* **Build System & Dev Server:** Vite 8
* **Styling & Design System:** TailwindCSS 4, Lucide React Icons
* **Routing:** React Router v7 (Layout nesting, protected role-gated routes)
* **Server State & Data Fetching:** TanStack React Query v5
* **HTTP Client:** Axios (Custom interceptors with JWT token lifecycle management)
* **Client Cryptography:** Web Crypto API (`SubtleCrypto` for ECDSA P-256 key pair generation, CSR, and digital signatures)
* **Data Visualization:** Chart.js & React-Chartjs-2 (Longitudinal patient vitals)

### Backend Application (`/backend`)
* **Runtime:** Node.js 22 LTS
* **Server Framework:** Express 5 (TypeScript)
* **ORM & Database Client:** Prisma 7 with native PostgreSQL adapter (`@prisma/adapter-pg`)
* **Relational Database:** PostgreSQL 16 (with UUID extension, custom ENUMs, triggers, and indices)
* **Caching & Session Layer:** Redis 7.2 (optional, via `ioredis`) / in-process fallback
* **Cryptography & Hashing:**
  * File encryption: AES-256-GCM (Envelope encryption with random IV and auth tags)
  * Passwords: `bcrypt` with configurable rounds
  * Multi-Factor Authentication: `otplib` (RFC 6238 TOTP) + QR code generation (`qrcode`)
  * Audit Integrity: SHA-256 iterative chained hashes
* **PDF & Documents:** `pdf-lib` (Cryptographic prescription PDF synthesis with verification QR codes)
* **Job Scheduler:** `node-cron` (Automated ledger verification, consent pruning, break-glass expiration, notification dispatch)
* **Validation & Security:** Zod schemas, Helmet, CORS, Express Rate Limit

---

## 4. Repository File Structure

```
MediLocker/
├── package.json                   # Root workspace scripts (concurrent dev runner)
├── docker-compose.yml             # Full-stack Docker orchestration (Postgres, Redis, API, Web)
├── README.md                      # High-level overview & quick verification instructions
├── USER_MANUAL.md                 # This comprehensive operations & onboarding manual
├── DATABASE_SCHEMA_AND_ARCHITECTURE.md # Full table schemas, triggers, and ERDs
├── ROLE_AND_PAGE_WISE_FEATURE_MAP.md   # Functional specification of all screens
│
├── database/                      # Database migrations
│   └── migrations/
│       ├── V1__init_medilocker_schema.sql             # Base tables, ENUMs, relations
│       ├── V2__file_pipeline_and_crypto_identity.sql # Encryption metadata, doctor keys
│       └── V3__ledger_and_delivery.sql               # Hash chain triggers, notification logs
│
├── backend/                       # Node.js + Express + Prisma backend
│   ├── .env.example               # Template environment configuration
│   ├── package.json               # Backend dependencies and scripts
│   ├── tsconfig.json              # TypeScript compilation settings
│   ├── prisma/
│   │   └── schema.prisma          # Prisma schema reflecting PostgreSQL tables
│   ├── scripts/
│   │   ├── resetAuditChain.ts     # Utility to recalculate or reset audit hash chain
│   │   └── smoke.ts               # End-to-end integration smoke testing script
│   ├── src/
│   │   ├── index.ts               # Server bootstrap and port listener
│   │   ├── app.ts                 # Express application middleware pipeline & routes
│   │   ├── config/
│   │   │   └── env.ts             # Strongly-typed environment variables validation
│   │   ├── controllers/           # HTTP route handlers
│   │   │   ├── authController.ts         # Login, MFA, registration, session management
│   │   │   ├── patientController.ts      # Vitals, consultations, patient profile
│   │   │   ├── doctorController.ts       # Consultations, prescriptions, flags
│   │   │   ├── hospitalController.ts     # Hospital doctors, HMS API keys
│   │   │   ├── adminController.ts        # Verifications, audit verify, health
│   │   │   ├── vaultController.ts        # Medical records upload, download, envelope crypto
│   │   │   ├── consentController.ts      # Consent grants, revocations, category gates
│   │   │   ├── emergencyController.ts    # Break-glass sessions, emergency snapshots
│   │   │   └── publicController.ts       # Public prescription & document verification
│   │   ├── middlewares/           # Authentication, RBAC, audit logging, rate limiting
│   │   │   ├── authMiddleware.ts         # JWT verification & role authorization
│   │   │   ├── auditMiddleware.ts        # Automated audit logging
│   │   │   ├── errorHandler.ts           # Centralized exception formatter
│   │   │   └── upload.ts                 # Multer disk/memory upload configuration
│   │   ├── services/              # Business logic & cryptographic primitives
│   │   │   ├── db.ts                     # Prisma client instance
│   │   │   ├── recordCrypto.ts           # AES-256-GCM envelope encryption/decryption
│   │   │   ├── keyProvider.ts            # Local / AWS KMS master key wrapping
│   │   │   ├── objectStorage.ts          # Local filesystem / AWS S3 abstraction
│   │   │   ├── prescriptionSignature.ts  # ECDSA P-256 public key verification
│   │   │   ├── prescriptionPdf.ts        # PDF prescription builder with embedded QR
│   │   │   ├── auditLog.ts               # Hash-chained immutable audit logger
│   │   │   ├── ledger.ts                 # Document integrity anchor ledger
│   │   │   ├── mfa.ts                    # TOTP generation, verification & backup codes
│   │   │   ├── cache.ts                  # Redis / memory caching engine
│   │   │   └── sessions.ts               # Database-backed session invalidation
│   │   ├── jobs/                  # Background cron jobs (ledger check, consent expiry)
│   │   └── seed.ts                # Comprehensive test database seeder
│   └── tests/                     # Vitest test suites (auth, crypto, audit, consent, etc.)
│
└── frontend/                      # React 19 + Vite + Tailwind CSS frontend
    ├── package.json               # Frontend dependencies & scripts
    ├── vite.config.ts             # Vite configuration
    ├── index.html                 # HTML shell
    ├── nginx.conf                 # Production Nginx reverse proxy configuration
    └── src/
        ├── main.tsx               # React root renderer
        ├── App.tsx                # Route definitions & authentication guards
        ├── index.css              # Global styles & Tailwind CSS imports
        ├── context/
        │   └── AuthContext.tsx    # Global auth state, user profile, login/logout
        ├── lib/
        │   ├── api.ts             # Axios API client with bearer token injection
        │   └── crypto.ts          # Client-side Web Crypto key generation & signing
        ├── components/
        │   ├── AppLayout.tsx      # Sidebar, desktop header, status pills, navigation
        │   ├── ui.tsx             # Shared toasts, skeletons, badges, empty states
        │   └── SecuritySettings.tsx # Patient MFA enrollment & security credentials
        └── pages/                 # 31+ Role-specific view components
            ├── Home.tsx                  # Landing page with security architecture overview
            ├── Login.tsx                 # Universal portal with 1-click demo logins
            ├── VerifyDocument.tsx        # Public prescription & document verifier
            ├── Patient*.tsx              # Patient Vault, Consent, Vitals, Consultations
            ├── Doctor*.tsx               # Doctor Dashboard, Upload, Prescribe, Patients
            ├── Hospital*.tsx             # Hospital Admin Portal, HMS API, Doctors
            ├── Admin*.tsx                # Audit Logs, System Health, Verifications
            └── Emergency*.tsx            # Break-glass access request & session viewer
```

---

## 5. Prerequisites & Environment Setup

### System Prerequisites
* **Node.js:** v20.x or v22.x LTS
* **npm:** v10.x or later
* **PostgreSQL:** v16.x (running locally or in Docker)
* **Redis (Optional):** v7.x (defaults to in-memory cache if omitted)
* **Docker & Docker Compose (Optional):** For containerized execution

### Backend Environment Configuration (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Fill in the required configuration parameters:

```env
# ---------------------------------------------------------------- database
# Database connection string for PostgreSQL 16
DATABASE_URL="postgresql://medilocker:password123@localhost:5432/medilocker?schema=public"
DIRECT_URL="postgresql://medilocker:password123@localhost:5432/medilocker?schema=public"

# ------------------------------------------------------------------ server
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

# --------------------------------------------------------------- security
# REQUIRED: Must be at least 32 characters.
# Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET=YOUR_GENERATED_JWT_SECRET_STRING_MIN_32_CHARS

# REQUIRED: 32-byte Base64 key for local envelope encryption master key.
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
KMS_MASTER_KEY=YOUR_GENERATED_BASE64_32_BYTE_KEY

# Token Lifetimes
MFA_TOKEN_TTL=5m
SESSION_TOKEN_TTL=7d
BCRYPT_ROUNDS=10

# Security Rules
MAX_FAILED_LOGINS=10
LOCKOUT_MINUTES=15
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_MAX_REQUESTS=300
AUTH_RATE_LIMIT_MAX_REQUESTS=10

# ------------------------------------------------------- storage & crypto
STORAGE_DRIVER=LOCAL
STORAGE_PATH=./storage
KEY_PROVIDER=LOCAL
SCHEDULER_ENABLED=true
PUBLIC_VERIFY_URL=http://localhost:5173/verify

# ------------------------------------------------------- platform services (optional)
# Optional: Set Redis connection string to enable shared cluster cache
REDIS_URL=

# Optional: Real SMTP configuration (if omitted, notifications are logged as SIMULATED)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

---

## 6. Step-by-Step Developer Quickstart

### Method A: Local Native Development (Recommended for Coding)

#### 1. Install All Dependencies
Run from the root directory:
```bash
npm run install:all
```
*This installs dependencies in both `/backend` and `/frontend`.*

#### 2. Start PostgreSQL
Ensure PostgreSQL 16 is running on port `5432` with a database named `medilocker`.
*(Tip: You can start just the database and Redis using Docker: `docker compose up -d postgres redis`)*

#### 3. Run Database Migrations
Apply the SQL migrations from `database/migrations/` sequentially using `psql` or your preferred SQL tool:
```bash
psql -U medilocker -d medilocker -f database/migrations/V1__init_medilocker_schema.sql
psql -U medilocker -d medilocker -f database/migrations/V2__file_pipeline_and_crypto_identity.sql
psql -U medilocker -d medilocker -f database/migrations/V3__ledger_and_delivery.sql
```

#### 4. Generate Prisma Client & Seed Data
Navigate to `/backend`, generate the Prisma client, and seed test accounts:
```bash
cd backend
npx prisma generate
npm run seed
cd ..
```

#### 5. Launch Both Servers Concurrently
From the root directory:
```bash
npm run dev
```

* **Frontend:** Accessible at `http://localhost:5173`
* **Backend API:** Accessible at `http://localhost:3000`
* **Swagger/Health API:** `http://localhost:3000/api/v1/admin/system-health`

---

### Method B: Containerized Development with Docker Compose

To spin up the entire stack (PostgreSQL, Redis, Backend, and Nginx-served Frontend):

```bash
# Set required secrets and launch
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))") \
KMS_MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") \
docker compose up --build
```

* **Full Application (Nginx proxy):** Accessible at `http://localhost:8080`
* Database migrations run automatically via Docker entrypoint on first boot.

---

## 7. Pre-Seeded Test Accounts & Credentials

The seed script creates canonical demo accounts covering all primary system roles. All seeded accounts share the same password:

> **Universal Password:** `password123`  
> **Development MFA Fallback Code:** `123456` *(Accepted during development for accounts not yet enrolled in TOTP)*

| Role | Email / Login ID | Purpose & Access Scope |
| :--- | :--- | :--- |
| **Patient** | `patient@medilocker.com` *(or `1111111111`)* | Access Medical Vault, Grant/Revoke Consent, Log Vitals, View Consultations |
| **Doctor** | `doctor@medilocker.com` *(or `2222222222`)* | View Consented Patients, Upload Records, Issue & Sign Prescriptions, Log Consultations |
| **Hospital Admin** | `hospital@medilocker.com` *(or `3333333333`)* | Manage Hospital Doctors, Approve Emergency Break-Glass Sessions, Generate HMS API Keys |
| **Platform Admin** | `admin@medilocker.com` *(or `4444444444`)* | Verify Hospitals & Doctors, Review Audit Logs, Verify Hash Chains, Monitor System Health |
| **Emergency Doctor** | *(Use Doctor account)* | Request Break-Glass Emergency Access via `/emergency/request` |

> [!TIP]
> **1-Click Sign In:** On the login page (`/login`), click any role button under **"Quick Demo Logins"** to automatically populate credentials.

---

## 8. Role-Based Feature & Screen Matrix

The application routes and security permissions are enforced both at the client router level (`App.tsx`) and at the backend API gateway (`authMiddleware.ts`).

### Screen Navigation & Route Matrix

```mermaid
graph TD
    Public[Public Visitors] --> Home["/ (Landing Page)"]
    Public --> Login["/login (Universal Portal)"]
    Public --> Verify["/verify (Public Document Verifier)"]
    Public --> RegPatient["/register/patient"]
    Public --> RegDoctor["/register/doctor"]
    Public --> RegHospital["/register/hospital"]

    Login --> AuthCheck{Role Check}
    AuthCheck -->|PATIENT| PatientArea["/patient/*"]
    AuthCheck -->|DOCTOR| DoctorArea["/doctor/*"]
    AuthCheck -->|HOSPITAL_ADMIN| HospitalArea["/hospital/*"]
    AuthCheck -->|PLATFORM_ADMIN| AdminArea["/admin/*"]
    AuthCheck -->|EMERGENCY| EmergencyArea["/emergency/*"]
```

#### 1. Patient Portal (`/patient/*`)
* `/patient/dashboard`: Summary of total records, active consents, recent consultations, and vital trends.
* `/patient/vault`: Secure health records locker. Download decrypted records, view AES-256-GCM encryption parameters, and manage record tags.
* `/patient/consent`: Granular consent manager. Grant doctor access by category (`PRESCRIPTION`, `LAB_REPORT`, `IMAGING`), set expiration windows, and revoke access.
* `/patient/vitals`: Interactive longitudinal tracking for blood pressure, glucose, heart rate, oxygen, and temperature with Chart.js visualization.
* `/patient/consultations`: Chronological list of doctor visits, clinical diagnoses, and follow-up reminders.
* `/patient/notifications`: Real-time notification center (security alerts, emergency access notifications, consent expirations).
* `/patient/settings`: Security configuration, password management, and TOTP MFA setup with authenticator QR codes.

#### 2. Doctor Workspace (`/doctor/*`)
* `/doctor/dashboard`: Doctor metrics, patient volume, upcoming appointments, and quick actions.
* `/doctor/patients`: Directory of consented patients with active token verification.
* `/doctor/upload`: Upload medical records with client-side file encryption pipeline.
* `/doctor/prescriptions/new`: Digital prescription builder. Generates cryptographic ECDSA P-256 digital signature, registers public key fingerprint, and creates tamper-proof PDF with QR code.
* `/doctor/consultation/log`: Record patient symptoms, diagnoses, and treatment plans.
* `/doctor/search`: Search diagnostic records across consented patients.
* `/doctor/flag`: Flag inaccurate or fraudulent medical documents for administrative dispute review.

#### 3. Hospital Administration (`/hospital/*`)
* `/hospital/dashboard`: Hospital profile, affiliated doctors overview, and emergency activity stats.
* `/hospital/doctors`: Manage staff credentials, medical registration numbers, and doctor verification.
* `/hospital/api-console`: Manage Hospital Management System (HMS) API client keys, IP allowlists, and rate limits.
* `/hospital/emergency-verify`: Emergency break-glass verification queue. Authenticate emergency requests with OTP verification.

#### 4. Platform Administration (`/admin/*`)
* `/admin/dashboard`: Platform-wide telemetry, user growth, storage metrics, and integrity alerts.
* `/admin/verifications/hospitals`: Review government registration documents and verify hospitals.
* `/admin/verifications/doctors`: Verify Medical Council registration numbers and doctor credentials.
* `/admin/disputes`: Review patient/doctor flagged records, view details, and arbitrate resolutions.
* `/admin/audit-logs`: Audit trail viewer with live SHA-256 forward-hash chain integrity verifier.
* `/admin/system-health`: Live diagnostics of cache mode (Redis vs Memory), key provider, storage driver, and scheduler health.

#### 5. Emergency Break-Glass (`/emergency/*`)
* `/emergency/request`: Initiated by an ER physician with patient ID, clinical emergency reason, and hospital verification.
* `/emergency/session/:sessionId`: Standalone, time-boxed emergency viewer displaying emergency medical snapshots (allergies, blood group, vital summaries) with persistent countdown timer.

---

## 9. Core Cryptographic Workflows & Data Flows

### A. Envelope Encryption (Medical Records)

Every medical file uploaded to MediLocker is protected using two-tier envelope encryption:

```
[ Uploaded Raw File ]
        │
        ▼
Generate Random 32-byte DEK (Data Encryption Key) + 12-byte IV
        │
        ├─────────────────────────────┐
        ▼                             ▼
Encrypt File via AES-256-GCM     Wrap DEK with Master KMS Key
        │                             │
        ▼                             ▼
[ Encrypted File Payload ]       [ Encrypted DEK + Auth Tag ]
        │                             │
        └──────────────┬──────────────┘
                       ▼
   Stored in Object Storage / Database
```

1. **Client / Server Upload:** The backend generates a cryptographically secure random 256-bit DEK (`crypto.randomBytes(32)`) and a unique 96-bit Initialization Vector (`IV`).
2. **Payload Encryption:** The file contents are encrypted via `AES-256-GCM`, yielding ciphertext and a 16-byte GCM authentication tag.
3. **Key Wrapping:** The DEK is wrapped using the master key (via `KMS_MASTER_KEY` locally or AWS KMS in cloud).
4. **Zero-Knowledge Storage:** Only the ciphertext and encrypted DEK are stored. Even database administrators cannot decrypt patient files without access to the master key.

### B. Prescription Signing & Verification (ECDSA P-256)

Prescriptions require non-repudiation and must be verifiable by offline pharmacies:

1. **Doctor Key Generation:** On first login or doctor setup, the browser generates an ECDSA P-256 key pair via `window.crypto.subtle.generateKey` (`extractable: false` for the private key).
2. **Key Registration:** The doctor's public key (in SPKI PEM format) is uploaded to the backend and its SHA-256 fingerprint is recorded in the `doctors` table.
3. **Prescription Signing:** When prescribing, the client normalizes the prescription data (medications, diagnosis, patient ID, date), hashes it with SHA-256, and signs the digest using the doctor's private key.
4. **PDF Generation:** The backend synthesizes a prescription PDF containing the digital signature, doctor's registration number, and an embedded QR code pointing to `/verify`.
5. **Public Verification:** Any third party can upload the prescription or enter the signature token at `/verify` (`POST /api/v1/public/verify-prescription`) to cryptographically confirm:
   * The signature matches the doctor's registered public key.
   * The prescription content has not been altered by even one byte.

### C. Tamper-Evident Hash Chain Audit Log

Every row in `audit_logs` is cryptographically chained to its predecessor:

$$\text{event\_sha256\_hash} = \text{SHA256}(\text{previous\_log\_hash} \mathbin{\Vert} \text{event\_id} \mathbin{\Vert} \text{user\_id} \mathbin{\Vert} \text{action} \mathbin{\Vert} \text{resource\_id} \mathbin{\Vert} \text{details} \mathbin{\Vert} \text{created\_at})$$

* **PostgreSQL Trigger:** A database trigger (`trg_audit_logs_immutable`) aborts any `UPDATE` or `DELETE` statement executed against the `audit_logs` table.
* **Tamper Verification:** The endpoint `GET /api/v1/admin/audit-logs/verify-chain` reads rows in sequence, recomputes the SHA-256 hash at each step, and immediately flags any inserted, deleted, or modified entries.

---

## 10. Verification, Testing & Quality Assurance

### Running Backend Test Suites
MediLocker includes comprehensive automated tests covering all critical security modules:

```bash
cd backend
npm test
```

This runs Vitest suites including:
* `auditChain.test.ts`: Proves hash chain integrity and tamper detection.
* `auth.test.ts`: Validates password security, account lockout after failed logins, and MFA verification.
* `cryptoIdentity.test.ts`: Verifies doctor key pair generation, fingerprinting, and ECDSA signature validation.
* `filePipeline.test.ts`: Tests AES-256-GCM envelope encryption, key wrapping, and decryption integrity.
* `consent.test.ts`: Tests category access control, expiration, and revocation.
* `emergency.test.ts`: Tests break-glass sessions, emergency OTP validation, and emergency snapshot generation.

### Running the End-to-End Smoke Test
Run the automated smoke script to simulate end-to-end user journeys:
```bash
cd backend
npm run smoke
```

### Verifying Security Properties Live via API

| Endpoint | Method | Expected Output / Verification Proof |
| :--- | :--- | :--- |
| `/api/v1/admin/audit-logs/verify-chain` | `GET` | Validates that all audit log records match the unbroken SHA-256 chain. Returns `{ verified: true, count: N }`. |
| `/api/v1/admin/ledger/verify` | `GET` | Validates that all medical record hashes in the database match the integrity ledger entries. |
| `/api/v1/admin/system-health` | `GET` | Returns runtime health: cache mode (Redis/Memory), key provider, storage driver, and scheduler status. |
| `/api/v1/public/verify-prescription` | `POST` | Validates a prescription signature against the issuing doctor's public key. |

---

## 11. Developer Extension Guide: How to Add Features

### How to Add a New Backend API Route
1. **Define Validation Schema:** In `backend/src/schemas/`, define request payload constraints using `zod`.
2. **Implement Business Logic:** Create or extend a service in `backend/src/services/`.
3. **Create Controller Method:** In `backend/src/controllers/`, handle HTTP request validation, call the service, and log an audit event via `auditLog()`.
4. **Register Route:** In `backend/src/routes/`, bind the controller method with appropriate middleware (`authenticate`, `requireRole(['DOCTOR'])`, `validate(schema)`).

### How to Add a New Frontend Screen
1. **Create Page Component:** In `frontend/src/pages/`, create `NewFeature.tsx`.
2. **Add Navigation Item:** Open `frontend/src/components/AppLayout.tsx` and add an entry to `NAV_BY_ROLE` under the appropriate user role.
3. **Register Route Guard:** In `frontend/src/App.tsx`, import your component and register the route inside `<Route element={<ProtectedArea allowedRoles={['ROLE']} />}>`.

---

## 12. Troubleshooting & Frequently Asked Questions (FAQ)

### Q1: `tsc is not recognized` or Frontend Build Fails
* **Cause:** Frontend dependencies have not been installed.
* **Fix:** Run `npm install` inside the `/frontend` directory or run `npm run install:all` from the root.

### Q2: `JWT_SECRET is set to a known insecure placeholder`
* **Cause:** The backend refuses to start with default or short placeholder keys.
* **Fix:** Generate a secure secret with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` and place it in `backend/.env`.

### Q3: `Cannot find module '@prisma/client'`
* **Cause:** The Prisma client has not been generated for the current database schema.
* **Fix:** Run `cd backend && npx prisma generate`.

### Q4: Database connection error or migrations failing
* **Cause:** PostgreSQL is not running or credentials in `DATABASE_URL` do not match.
* **Fix:** Verify PostgreSQL is running on port 5432. If using Docker, run `docker compose up -d postgres`. Check credentials in `backend/.env`.

### Q5: What is the development MFA code?
* **Answer:** For seeded accounts that haven't enrolled an authenticator app, enter `123456`. When logging in with a freshly registered user, complete the TOTP QR scan using Google Authenticator or Microsoft Authenticator.

### Q6: How do I reset or repair the audit hash chain in development?
* **Answer:** Run `cd backend && npm run reset:audit`. This recalculates the SHA-256 hash chain from the genesis log ID.

---

## 13. Regulatory & Production Deployment Checklist

Before deploying MediLocker to a public cloud environment:

- [ ] **Switch Key Provider to KMS:** Set `KEY_PROVIDER=KMS` and configure `AWS_KMS_KEY_ID` to enforce a genuine cryptographic boundary between DB admins and records.
- [ ] **Switch Storage Driver to S3:** Set `STORAGE_DRIVER=S3` with a private, server-side encrypted AWS S3 bucket.
- [ ] **Enable Redis Cluster:** Provide a high-availability `REDIS_URL` for distributed consent cache invalidation.
- [ ] **Configure Real SMTP / SMS:** Provide valid SMTP credentials and SMS gateway API keys so notifications are marked `DELIVERED` rather than `SIMULATED`.
- [ ] **Enable SSL / TLS:** Enforce HTTPS on both the frontend domain and backend API gateway.
- [ ] **Database Backup & Replication:** Configure automated PostgreSQL point-in-time recovery (PITR) and read replicas.
- [ ] **ABDM & DPDP Compliance Review:** Ensure patient consent records and audit logs adhere to national data retention and privacy policies.

---
*MediLocker Platform — Secure, Verifiable, Sovereign Healthcare Records.*
