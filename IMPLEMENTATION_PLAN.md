# MediLocker — Implementation Plan (Remaining Work)

**Project:** MediLocker — Secure Cloud-Based Digital Medical Record Management Platform
**Document:** Implementation Plan — Completion of Outstanding Scope
**Version:** 3.0
**Date:** 13 September 2026
**Status:** All six phases delivered
**Companion documents:** `DATABASE_SCHEMA_AND_ARCHITECTURE.md`, `ROLE_AND_PAGE_WISE_FEATURE_MAP.md`

---

## 0. Delivery Status

| Phase | Status | Evidence |
| :--- | :--- | :--- |
| 1 — Foundation and defect repair | **Complete** | Backend and frontend typecheck clean; `npm run build` succeeds in both |
| 2 — Hardening and audit integrity | **Complete** | Audit chain verifies intact through `GET /api/v1/admin/audit-logs/verify-chain` |
| 3 — Encrypted file pipeline | **Complete** | Files are AES-256-GCM encrypted before storage; stored objects are not the original bytes; a tampered object fails to decrypt |
| 4 — Cryptographic identity | **Complete** | Real TOTP with backup codes, session-bound tokens with immediate revocation, ECDSA P-256 prescription signing verified server-side |
| 5 — Platform services | **Complete** | Consent cache with instant revocation, five scheduled jobs, notification outbox, append-only hash-chained ledger with a database immutability trigger |
| 6 — Frontend and delivery | **Complete** | Shared layout with navigation and sign-out, single API client, TanStack Query, error boundary, Docker compose, GitHub Actions |

**77 integration tests pass; `npm run smoke` reports 78/78 routes below 500.**

Migrations: `V1` initial schema, `V2` file pipeline and crypto identity (`user_sessions`, `mfa_backup_codes`, storage provenance), `V3` ledger and delivery (`ledger_entries`, delivery bookkeeping, integrity-sweep columns). The database holds 20 tables.

### 0.1 Measured, not asserted

The system-health endpoint reports real values. Against the current development database (a remote Supabase instance) the numbers are:

| Metric | Measured | Target | Note |
| :--- | :--- | :--- | :--- |
| Database round trip | ~1300 ms | — | Remote region; dominates every uncached path |
| Consent evaluation, cache hit | <1 ms | <10 ms (NFR06) | Meets the target |
| Consent evaluation, mixed | ~90 ms | <10 ms (NFR06) | **Does not meet the target** on a cold cache against a remote database |
| Ledger | INTACT | — | Verified over all entries |
| Cache | MEMORY | REDIS | In-process; not shared between instances until `REDIS_URL` is set |

The mixed figure is the honest one to quote: NFR06 is met on the cached path and missed on the uncached path with this database placement. A co-located database and a Redis instance would both be needed to meet it generally.

Commands to reproduce the evidence:

```bash
cd backend && npm run typecheck && npm test
```

```bash
cd frontend && npm run build
```

```bash
cd backend && npm run dev
```

```bash
cd backend && npm run smoke
```

Defects found during execution that were not in the original register are recorded as D13–D22 in Appendix A.

---

## 1. Scope of This Plan

This plan covers **only the work that remains** — approximately 40% of the specified system. The database schema, the API surface, all 31 screens, consent evaluation, the break-glass state machine, admin verification workflows and HMS key management are already built and are not restated here.

What remains falls into six deliverables:

| # | Outstanding deliverable | Why it is required |
| :--- | :--- | :--- |
| 1 | Defect repair and a compiling build | Seven schema mismatches throw at runtime; the frontend production build fails; the JWT secret falls back to a committed literal |
| 2 | Backend hardening and audit integrity | No validation, no error handling, no rate limiting, no account lockout; the audit hash chain is never written |
| 3 | Encrypted file pipeline | No file is ever transmitted or stored. This is the platform's core function and the largest single gap |
| 4 | Cryptographic identity | MFA codes and prescription signatures are placeholder strings; public verification ignores its input |
| 5 | Platform services and automation | No consent cache, no scheduled expiry, no notification delivery, no integrity sweep, no real ledger |
| 6 | Frontend completion and delivery | No navigation, no logout, no shared layout, no API client, no containers, no CI |

Each becomes a phase below. All six are required to complete the project as specified; none can be dropped without reducing scope.

### 1.1 Deferred beyond this plan

| Item | Rationale | Revisit when |
| :--- | :--- | :--- |
| Hyperledger Fabric network | Weeks of infrastructure work. Task P5-08 delivers the same tamper-evidence property with an append-only PostgreSQL ledger | A partner institution requires a shared permissioned ledger |
| Apache Kafka event bus | The scheduler plus the `notifications` table functions as an adequate outbox at current scale | Multi-service fan-out becomes a genuine requirement |
| Microservice decomposition | The monolith is not yet a bottleneck | Independent scaling or separate team ownership is needed |
| UIDAI / ABDM production integration | Requires external accreditation and a sandbox agreement | Accreditation is obtained |
| PostgreSQL Row-Level Security | Valuable defence in depth, but the application-layer checks in Phase 2 must be correct first | Phase 2 closes |

### 1.2 Basis of assessment
Defects in Appendix A were identified by reading application code against `backend/prisma/schema.prisma`. Dependencies were not installed at review time, so nothing was compiled or executed. Each defect should be confirmed once Phase 1 makes the project runnable; Phase 1 includes a smoke script specifically to expose any that were missed.

---

## 2. Guiding Principles

1. **Correctness before capability.** No new feature work begins until the project compiles and every existing endpoint returns a non-5xx response.
2. **Interfaces before vendors.** Encryption, object storage and ledger anchoring are each introduced behind an interface with a local implementation first. Cloud providers are substituted later without changing call sites.
3. **Never trust the client for security-critical values.** Document hashes, digital signatures and consent decisions are computed or verified on the server.
4. **Honest user interface.** No screen may assert a security property the system does not implement. Until the relevant phase lands, such claims are removed or explicitly labelled as prototype behaviour.
5. **Every change is provable.** Each phase carries acceptance criteria that can be demonstrated, not merely asserted.

---

## 3. Phase 1 — Foundation and Defect Repair

**Effort:** 2 days **Depends on:** — **Blocks:** every other phase

### 3.1 Environment

| ID | Task | Deliverable |
| :--- | :--- | :--- |
| P1-01 | Run `npm run install:all`; commit both lockfiles | Reproducible dependency tree |
| P1-02 | Generate a 32-byte `JWT_SECRET` into `backend/.env`; abort startup if absent rather than falling back to the committed development string | `backend/src/config/env.ts` with fail-fast validation |
| P1-03 | Apply `V1__init_medilocker_schema.sql`; run `npx prisma generate`; confirm with `prisma db pull` that no drift exists | Migrated database, generated client, drift report |
| P1-04 | Add `seed`, `typecheck`, `build` and `start` scripts to `backend/package.json`; execute the seed | Populated development dataset |
| P1-05 | Move `get_patient.js`, `get_users.js`, `test-db.js`, `test_registration.js` and `scratch_*.js` out of the backend root into `backend/scripts/`, or delete them | Clean package root |
| P1-06 | Add `backend/.env.example`, maintained from here onward | Documented configuration surface |

### 3.2 Defect repair

| ID | Task | Detail |
| :--- | :--- | :--- |
| P1-07 | Fix defect D1 | Generate `consent_token_hash` on consent creation — `sha256(patient_id + doctor_id + valid_until + random nonce)`. Without it, every consent grant fails on a not-null unique column |
| P1-08 | Fix defects D2 and D6 | Remove the non-existent `consent_audit_logs` include; read `vault_number` through the `patient_vaults` relation rather than `patients` |
| P1-09 | Fix defects D3, D4 and D5 | Correct `file_type` to `file_mime_type`; remove the `description` search filter or add the column; add `include: { patients: true }` to the vault lookup so the notification receives a valid `user_id` |
| P1-10 | Fix defect D7 | Skip the `break_glass_record_accesses` insert when the patient has no records, instead of writing a dummy UUID that violates the foreign key |
| P1-11 | Fix defect D8 | Add `"types": ["node"]` to `backend/tsconfig.json`; resolve errors until `tsc --noEmit` is clean |
| P1-12 | Fix defect D9 | Add `"jsx": "react-jsx"` to `frontend/tsconfig.json`; replace the bare `JSX.Element` in `App.tsx:37` with `React.JSX.Element`; clear the unused-import errors `noUnusedLocals` will surface across the page components |
| P1-13 | Fix defect D10 | Remove the duplicated legacy `/api/*` route mounts; the frontend uses `/api/v1` exclusively |
| P1-14 | Author an endpoint smoke script exercising all ~60 routes against seeded data | `backend/scripts/smoke.ts` |

**Acceptance criteria**
- `npm run dev` at the repository root starts both servers.
- A seeded patient completes login and multi-factor entry and reaches a dashboard rendering seeded records.
- `tsc --noEmit` is clean in both packages; `npm run build` succeeds in `frontend/`.
- The smoke script reports zero 5xx responses across all routes.

---

## 4. Phase 2 — Backend Hardening and Audit Integrity

**Effort:** 3–5 days **Depends on:** Phase 1 **Blocks:** Phases 3 and 4

| ID | Task | Detail |
| :--- | :--- | :--- |
| P2-01 | Introduce `zod` schemas and a single `validate(schema)` middleware for every body, query and parameter; reject unknown fields | |
| P2-02 | Add an `asyncHandler` wrapper and a central error handler; stop returning raw `error.message` to clients in production | |
| P2-03 | Add `helmet`; restrict CORS to the configured frontend origin, replacing the unrestricted `app.use(cors())` | |
| P2-04 | Add `express-rate-limit`, applied strictly to `/auth/login`, `/auth/verify-mfa` and all `/public/*` routes | |
| P2-05 | Implement account lockout in `login` using the existing but unused `failed_login_attempts` and `lockout_until` columns | |
| P2-06 | Implement audit middleware recording every state-changing request and every record read or decrypt, with genuine `previous_log_hash` chaining. Serialise writes through a transaction or advisory lock so the chain stays linear under concurrency | |
| P2-07 | Add `GET /admin/audit-logs/verify-chain`, walking the chain and reporting the first break | |
| P2-08 | Audit every handler for resource ownership. `vault/records/:id/blockchain-proof` and `emergency/terminate` currently act without confirming the caller owns or is party to the resource | |
| P2-09 | Add integration tests (Vitest with supertest against a test database) covering authentication, the consent grant → use → revoke cycle, and break-glass approve → read → expire | |

**Acceptance criteria**
- Malformed payloads return 400 with field-level messages, never 500.
- Eleven consecutive failed logins lock an account for the configured interval.
- The chain-verification endpoint reports an intact chain after a seeded run, and correctly identifies the position of a deliberately tampered row.
- The integration suite passes.

---

## 5. Phase 3 — Encrypted File Pipeline

**Effort:** 4–6 days **Depends on:** Phase 2 **May run parallel to:** Phases 4 and 6

The highest-value remaining deliverable. It converts a demonstration into a working product.

| ID | Task | Detail |
| :--- | :--- | :--- |
| P3-01 | Add `multer` with memory storage, a MIME allowlist (PDF, PNG, JPEG, DICOM) and a size ceiling | |
| P3-02 | Implement `backend/src/services/crypto.ts`: generate a per-file data encryption key, encrypt with AES-256-GCM, persist `encrypted_dek`, `iv_bytes` and the authentication tag | |
| P3-03 | Define a `KeyProvider` interface. Ship `LocalKeyProvider` (master key from environment) first; `KmsKeyProvider` follows in Phase 5 without altering call sites | |
| P3-04 | Define an `ObjectStorage` interface. Ship `LocalDiskStorage` first; `S3Storage` targeting `ap-south-1` follows | |
| P3-05 | Compute SHA-256 server-side over the received buffer. The client-supplied hash is discarded, not stored | |
| P3-06 | Implement `GET /vault/records/:id/download` returning a short-lived presigned URL or a streamed decryption, gated on consent and recorded in the audit log | |
| P3-07 | Replace frontend simulations: real `crypto.subtle.digest` in `DoctorUpload`, real retrieval and rendering in `PatientVault` (currently a two-second timer), real file hashing in `VerifyDocument` | |
| P3-08 | Backfill or clearly quarantine the mock-keyed records created by the seed and by earlier testing | |

**Acceptance criteria**
- A doctor uploads a PDF; the stored object is unreadable without the key.
- The owning patient retrieves and views it.
- A doctor without consent is refused; a doctor whose consent blocks that category is refused.
- All four events appear in the audit log with correct actor and resource identifiers.

---

## 6. Phase 4 — Cryptographic Identity

**Effort:** 4–6 days **Depends on:** Phase 2 **May run parallel to:** Phases 3 and 6

| ID | Task | Detail |
| :--- | :--- | :--- |
| P4-01 | Implement TOTP with `otplib`. On registration generate a secret, store it encrypted in `users.mfa_secret`, and return an `otpauth://` URI rendered as a QR code client-side | |
| P4-02 | Replace the hardcoded `123456` comparison in `verify-mfa` with real time-window verification; add single-use backup codes | |
| P4-03 | Replace the hardcoded emergency approval code in `emergencyController.approveRequest` with a generated, hashed, time-limited code delivered to the approving administrator | |
| P4-04 | Generate the doctor keypair in the browser using `crypto.subtle` (ECDSA P-256), retaining the non-extractable private key in IndexedDB; transmit only the public key PEM and its true fingerprint | |
| P4-05 | Sign the canonical prescription JSON client-side; **verify server-side** against `doctors.public_key_pem` before insertion, setting `is_signature_valid` from the actual result rather than the current unconditional `true` | |
| P4-06 | Rewrite `public/verify-prescription` to accept a prescription identifier or QR payload, re-canonicalise the document and verify the stored signature — removing the behaviour that returns the first table row irrespective of input | |
| P4-07 | Generate the signed prescription PDF with an embedded QR code addressing `/verify` | |
| P4-08 | Implement password change and active device session listing with remote logout (Screen 3.7), for which no endpoint or interface currently exists | |

**Acceptance criteria**
- An authenticator application produces codes the server accepts, and rejects codes outside the valid window.
- A prescription with a single altered dosage field fails public verification; the original passes.
- The public verifier page reflects both outcomes accurately.
- A patient can change their password and terminate other sessions.

---

## 7. Phase 5 — Platform Services and Automation

**Effort:** 5–7 days **Depends on:** Phases 3 and 4

| ID | Task | Detail |
| :--- | :--- | :--- |
| P5-01 | Add Redis. Cache consent decisions at `consent:{patient_id}:{doctor_id}` with a TTL matching `valid_until`; delete the key on revocation | |
| P5-02 | Instrument consent evaluation with cache-hit ratio and latency metrics, so the sub-10ms requirement is measured rather than asserted | |
| P5-03 | Introduce a job scheduler (BullMQ on the same Redis instance; `node-cron` is acceptable as a simpler start) | |
| P5-04 | Scheduled job: expire break-glass sessions at `session_expires_at`. Expiry is currently evaluated only when a session is read | |
| P5-05 | Scheduled job: expire consents at `valid_until` and emit reminder notifications 24 hours beforehand | |
| P5-06 | Scheduled job: integrity sweep re-hashing stored objects, comparing against `blockchain_anchors`, raising an alert on mismatch | |
| P5-07 | Notification delivery worker draining `notifications` rows with `delivery_status = 'PENDING'` via email and SMS providers, updating `delivered_at` | |
| P5-08 | Implement `services/ledger.ts` behind an interface, backed by an append-only PostgreSQL table with hash chaining, replacing the `mock_tx_${Date.now()}` placeholder | |
| P5-09 | Derive the emergency clinical snapshot from `ALLERGY_RECORD` and `CHRONIC_DISEASE_HISTORY` records plus current prescriptions, replacing the hardcoded allergy and condition arrays | |
| P5-10 | Replace `Math.random()` in the administrator system-health endpoint with real process, database and Redis metrics; remove the fabricated Kafka panel or label it as not yet deployed | |
| P5-11 | Substitute `KmsKeyProvider` and `S3Storage` for the local implementations from Phase 3 | |

**Acceptance criteria**
- A revoked consent is refused within one second, demonstrated by a timed test.
- A break-glass session becomes unusable at expiry without any read having occurred.
- Modifying a stored file causes the integrity sweep to raise an alert.
- A notification row transitions to delivered with a provider receipt.
- No figure on the system-health screen is fabricated.

---

## 8. Phase 6 — Frontend Completion and Delivery

**Effort:** 4–6 days **Depends on:** Phase 1 **May run parallel to:** Phases 2 through 5

| ID | Task | Detail |
| :--- | :--- | :--- |
| P6-01 | Build a shared `AppLayout` with a role-aware sidebar, header, logout control and session-expiry handling. No navigation or logout affordance exists anywhere in the application today | |
| P6-02 | Create `src/lib/api.ts`: base URL from `VITE_API_URL`, authorisation header injected once, 401 triggering logout and redirect, typed responses. This replaces roughly sixty hand-written `fetch` calls each re-pasting the bearer token | |
| P6-03 | Adopt TanStack Query for caching, loading and error states, as already claimed in `README.md` | |
| P6-04 | Add error boundaries, loading skeletons, empty states and toast notifications | |
| P6-05 | Accessibility pass: form labels, focus management on modals, keyboard navigation, colour contrast | |
| P6-06 | Add a `Dockerfile` per package and a `docker-compose.yml` covering PostgreSQL, Redis, backend and frontend | |
| P6-07 | Reconcile documentation with the implementation: record the Express monolith as the current architecture, retaining the eight-microservice topology as a target state; repair the `file:///d:/MediLocker/...` absolute links in `README.md`, which resolve for no one | |
| P6-08 | GitHub Actions pipeline: typecheck → lint → test → build on every pull request | |

**Acceptance criteria**
- Every authenticated page renders within the shared layout with a working logout control.
- No component constructs an authorisation header directly.
- `docker compose up` brings the full stack to a healthy state from a clean checkout.
- The pipeline passes on a pull request.

---

## 9. Schedule and Sequencing

| Phase | Effort | Depends on | May run parallel with |
| :--- | :--- | :--- | :--- |
| 1 — Foundation and defect repair | 2 days | — | — |
| 2 — Hardening and audit integrity | 3–5 days | 1 | 6 |
| 3 — Encrypted file pipeline | 4–6 days | 2 | 4, 6 |
| 4 — Cryptographic identity | 4–6 days | 2 | 3, 6 |
| 5 — Platform services | 5–7 days | 3, 4 | 6 |
| 6 — Frontend and delivery | 4–6 days | 1 | 2, 3, 4, 5 |

**Critical path:** 1 → 2 → 3 → 5. Phase 4 runs alongside Phase 3; Phase 6 runs alongside everything from the close of Phase 1.

| Resourcing | Duration |
| :--- | :--- |
| One developer | 4–6 weeks |
| Two developers | 3–4 weeks — the second takes Phase 6 from the close of Phase 1, then Phase 4 from the close of Phase 2 |

**Recommended first commit:** Phase 1 in full. It is two days of work, it converts a codebase that currently cannot build into one that runs end to end, and all five remaining phases are blocked behind it.

---

## 10. Quality Gates

A task is complete only when all of the following hold.

1. `tsc --noEmit` is clean in both packages.
2. `npm run build` succeeds in both packages.
3. New or changed behaviour is covered by a test.
4. Security-relevant changes are accompanied by a negative test proving the denial path.
5. No endpoint returns a raw exception message to a client.
6. No user-facing string asserts a security property the code does not implement.

---

## 11. Configuration to Be Added

| Variable | Package | Purpose | Phase |
| :--- | :--- | :--- | :--- |
| `JWT_SECRET` | backend | Token signing — currently missing, falls back to a committed literal | 1 |
| `PORT`, `NODE_ENV`, `CORS_ORIGIN` | backend | Server and origin configuration | 2 |
| `KMS_MASTER_KEY` | backend | Local key provider master key | 3 |
| `STORAGE_DRIVER`, `STORAGE_PATH` | backend | Object storage selection | 3 |
| `REDIS_URL` | backend | Consent cache and job queue | 5 |
| `AWS_REGION`, `AWS_KMS_KEY_ID`, `S3_BUCKET` | backend | Cloud providers | 5 |
| `SMTP_*`, `SMS_*` | backend | Notification delivery | 5 |
| `VITE_API_URL` | frontend | API base URL | 6 |

`DATABASE_URL` and `DIRECT_URL` are already present. No secret is committed.

---

## 12. Testing Strategy

| Level | Tooling | Introduced | Coverage target |
| :--- | :--- | :--- | :--- |
| Endpoint smoke | Custom script | Phase 1 | All ~60 routes return non-5xx |
| Integration | Vitest, supertest, test database | Phase 2 | Authentication, consent lifecycle, break-glass lifecycle |
| Unit | Vitest | Phase 3 | Encryption, hashing, signature verification |
| Security regression | Vitest | Phases 2–4 | Every denial path: absent consent, blocked category, expired session, invalid signature, forged token |
| Frontend component | Vitest, Testing Library | Phase 6 | Layout, API client, protected routing |
| End to end | Playwright (optional) | Phase 6 | Patient and doctor primary journeys |

Security regression tests are mandatory, not optional. For a health-records platform the denial paths matter more than the success paths.

---

## 13. Risks and Mitigations

| ID | Risk | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| R1 | The interface presents "AES-256 Encrypted · Zero-Trust Access · Blockchain Anchored" over a timer and `Math.random()`. Demonstrating this to a clinical or regulatory audience as working would be a material misrepresentation | Severe | Deliver Phases 3 to 5, or label the build a prototype in the interface until they land. Principle 4 in §2 |
| R2 | Real patient data entering the system before encryption, audit chaining and Row-Level Security are genuine | Severe — DPDP Act 2023 exposure | Synthetic data only until Phase 5 completes. Gate production access on a security review |
| R3 | Unrestricted CORS combined with the fallback JWT secret means anyone holding the repository can forge a platform-administrator token | Severe | Tasks P1-02 and P2-03. Not deferrable |
| R4 | Defects in Appendix A were found by reading, not by running; more may surface once the project executes | Moderate | Task P1-14 exists to expose the remainder before Phase 2 begins |
| R5 | The Phase 3 client-side decryption model requires the browser to hold key material; a naive implementation leaks keys to the page | Significant | Use non-extractable `crypto.subtle` keys; prefer server-side decryption with short-lived presigned URLs where the threat model permits |
| R6 | Phases 3 and 4 both touch prescription creation and may conflict if run in parallel | Moderate | Phase 3 owns the record and storage layer; Phase 4 owns signing. Agree the `prescriptions` contract before both start |

---

## Appendix A — Defect Register

| ID | Location | Defect | Severity | Task |
| :--- | :--- | :--- | :--- | :--- |
| D1 | `consentController.ts:38` | `consents.create` omits the required unique `consent_token_hash`; every consent grant fails | Blocker | P1-07 |
| D2 | `consentController.ts:110` | Includes a `consent_audit_logs` relation absent from the schema; consent history always returns 500 | Blocker | P1-08 |
| D3 | `vaultController.ts:78` | Reads `record.file_type`; the schema field is `file_mime_type` | High | P1-09 |
| D4 | `vaultController.ts:26` | Filters on a `description` column that `medical_records` does not have | High | P1-09 |
| D5 | `vaultController.ts:141` | `vault.patients?.user_id` resolves to an empty string because the query has no `include`; the notification insert violates its foreign key | High | P1-09 |
| D6 | `adminController.ts:227` | Selects `vault_number` from `patients`; it belongs to `patient_vaults`. `/admin/disputes` always returns 500 | Blocker | P1-08 |
| D7 | `emergencyController.ts:175` | Inserts a dummy zero UUID into `break_glass_record_accesses` when the patient has no records, violating the foreign key | High | P1-10 |
| D8 | `backend/tsconfig.json` | `"types": []` with no `@types/node`, while the code uses `process.env` and imports `crypto`. Runs under `tsx`, which does not typecheck, but will not compile | High | P1-11 |
| D9 | `frontend/tsconfig.json`, `App.tsx:37` | No `"jsx"` compiler option, so `npm run build` fails on every `.tsx`; the bare `JSX.Element` namespace is no longer global in React 19 types | Blocker | P1-12 |
| D10 | `backend/src/index.ts` | Every route is mounted twice, at `/api/v1/*` and legacy `/api/*`; only `/api/v1` is used | Low | P1-13 |
| D11 | `backend/.env` | `JWT_SECRET` absent; the application falls back to the committed literal `'fallback-secret-key-for-dev'` | Critical | P1-02 |
| D12 | `backend/` root | Scratch scripts committed at the package root | Low | P1-05 |
| D13 | `frontend/package.json` | `react` and `react-dom` were never declared as dependencies, and `@types/react` / `@types/react-dom` were absent entirely. Accounted for roughly 4,000 of the 4,045 initial frontend type errors | Blocker | Fixed in Phase 1 |
| D14 | Any endpoint returning `medical_records`, `patient_vaults` or `blockchain_anchors` | `BigInt` columns are not valid JSON, so `res.json` threw *Do not know how to serialize a BigInt*. Latent until a row actually existed — six endpoints returned 500 once data was present | Blocker | Fixed in Phase 1 (global JSON replacer) |
| D15 | `backend/src/middlewares/authMiddleware.ts` | The short-lived token issued between password entry and MFA was accepted as a session token. Any route without a role guard — notably `/api/v1/notifications` — was reachable with only a password, bypassing the second factor | Critical | Fixed in Phase 1 |
| D16 | `backend/src/seed.ts` | Cleanup deleted parents before children and could only ever run once; the audit-immutability trigger then blocked the `SetNull` cascade from `users`, so re-seeding failed outright | High | Fixed in Phase 1 |
| D17 | `backend/src/controllers/emergencyController.ts` | `getSessionData` and `terminateSession` performed no ownership check: any doctor could read another physician's break-glass payload, and any hospital admin could terminate any session | Critical | Fixed in Phase 2 (P2-08) |
| D18 | `backend/src/services/auditLog.ts` | Hashing `JSON.stringify(details)` is unstable across a `jsonb` round trip because Postgres does not preserve key order, so chain verification failed on entries whose keys were reordered | High | Fixed in Phase 2 (canonical digest) |
| D19 | `backend/src/controllers/doctorController.ts` (`searchRecords`) | A `category` query parameter was assigned straight onto the Prisma filter, replacing the consent-derived restriction. A doctor could read a blocked category — including `HIV_REPORT` — simply by naming it in the query | Critical | Fixed in Phase 3 (query narrows the permitted set instead of replacing it) |
| D20 | `backend/src/services/access.ts` | Consent was resolved with `findFirst`, so with several active grants for one doctor the decision depended on row order. A block in one grant could be bypassed by a later broader grant, contradicting what the consent screen promises | High | Fixed in Phase 3 (`resolveConsent` combines all active grants; a block always wins) |
| D21 | `backend/src/controllers/doctorController.ts` (`flagRecord`) | Flagging performed no access check and no existence check, so a doctor could flag any record id and learn whether it existed | Moderate | Fixed in Phase 4 |
| D22 | `backend/src/controllers/publicController.ts` (`verifyHash`) | `findFirst` with no ordering returned an arbitrary anchor when several records share a digest, so an identical document could resolve to a stale unconfirmed anchor and be reported as unverified | Moderate | Fixed in Phase 5: prefers the most recent confirmed anchor and cross-checks it against the ledger entry |

## Appendix B — Outstanding Specification Requirements

Only unmet requirements are listed. Requirements already satisfied — the 17-table schema, audit immutability trigger, consent category enforcement, break-glass dual approval, HMS API key lifecycle and all 31 routed screens — are omitted.

| Requirement | Source | Phase |
| :--- | :--- | :--- |
| TOTP MFA with authenticator enrolment (delivered) | Screens 2.1, 2.2 | 4 |
| Account lockout after repeated failures (delivered) | Screen 2.1 | 2 |
| File upload with AES-256-GCM envelope encryption and KMS (delivered) | §4.2 | 3, 5 |
| Client-side vault decryption (delivered) | Screen 3.2 | 3 |
| Doctor PKI and server-side signature verification (delivered) | §4.5 | 4 |
| Public prescription verification (delivered) | Screen 2.5 | 4 |
| Password change and active device sessions (delivered) | Screen 3.7 | 4 |
| Audit log hash chaining (delivered) | Module 12 | 2 |
| Audit logging on record read and download (delivered) | Module 12 | 2, 3 |
| Sub-10ms consent evaluation (partially delivered — met on the cached path, missed on a cold cache against a remote database; see §0.1) | §4.3 | 5 |
| Break-glass automatic expiry (delivered) | §4.4 | 5 |
| Emergency snapshot derived from real records (delivered) | Screen 6.2 | 5 |
| SMS and email notification delivery (delivered) | Module 11 | 5 |
| Consent expiry reminders (delivered) | Screen 3.6 | 5 |
| Tamper-evident hash anchoring (delivered) | §4.6 | 5 |
| Aadhaar OTP via UIDAI | Screen 2.2 | Deferred — §1.1 |
| PostgreSQL Row-Level Security | §3.4 | Deferred — §1.1 |
| Kafka event bus | §1 | Deferred — §1.1 |
