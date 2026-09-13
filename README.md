# MediLocker — Digital Healthcare Record Platform

> **A patient-owned digital healthcare record vault with granular consent, envelope encryption, digitally signed prescriptions and a tamper-evident integrity ledger.**

---

## Quick start

```bash
npm run install:all
```

Copy `backend/.env.example` to `backend/.env` and fill in `DATABASE_URL`, then generate the two required secrets:

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
```

```bash
node -e "console.log('KMS_MASTER_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
```

Apply the migrations in `database/migrations/` in filename order, then:

```bash
cd backend && npx prisma generate && npm run seed
```

```bash
npm run dev
```

The API listens on `:3000`, the frontend on `:5173`. Seeded accounts use the password `password123`; accounts that have not yet enrolled in TOTP accept the development code `123456` (this fallback is disabled when `NODE_ENV=production`).

### With Docker

```bash
JWT_SECRET=... KMS_MASTER_KEY=... docker compose up --build
```

Brings up PostgreSQL, Redis, the API and an nginx-served frontend on `:8080`.

---

## Verifying the security properties

Rather than taking the claims below on trust, they can be checked:

```bash
cd backend && npm test
```

```bash
cd backend && npm run smoke
```

| Endpoint | What it proves |
| :--- | :--- |
| `GET /api/v1/admin/audit-logs/verify-chain` | The audit log has not been altered, inserted into, or truncated |
| `GET /api/v1/admin/ledger/verify` | The document integrity ledger is intact |
| `GET /api/v1/admin/system-health` | Measured latency, cache mode, job outcomes, and which components are **not** deployed |
| `POST /api/v1/public/verify-prescription` | A prescription signature verifies against the issuing doctor's registered public key |

---

## Documentation

- **[Implementation Plan](IMPLEMENTATION_PLAN.md)** — delivery status, defect register, and remaining work.
- **[Role-Wise & Page-Wise Feature Map](ROLE_AND_PAGE_WISE_FEATURE_MAP.md)** — all 31 screens across 6 roles. Also as [.docx](docs/MediLocker_Role_and_Page_Wise_Feature_Map.docx).
- **[Database Schema & Architecture](DATABASE_SCHEMA_AND_ARCHITECTURE.md)** — table specifications and target architecture. Also as [.docx](docs/MediLocker_Database_Schema_and_System_Architecture.docx).
- **[SQL migrations](database/migrations/)** — `V1` initial schema, `V2` file pipeline and crypto identity, `V3` ledger and delivery.

---

## Architecture: current vs target

The architecture document describes a target state of eight independently deployable microservices behind an Envoy gateway, with Apache Kafka and Hyperledger Fabric.

**What is actually deployed is a single Express process.** That is a deliberate choice for the current scale, not an oversight. The table below is the honest mapping; `GET /api/v1/admin/system-health` reports the same thing at runtime.

| Concern | Target (architecture doc) | Current implementation |
| :--- | :--- | :--- |
| Service topology | 8 microservices, Envoy gateway | One Express monolith |
| Database | PostgreSQL 16 | PostgreSQL 16 ✅ |
| Consent cache | Redis 7.2 cluster | Redis when `REDIS_URL` is set, otherwise an in-process map. Which one is in use is reported, not assumed |
| Object storage | AWS S3 (`ap-south-1`) | Local disk by default; an S3 driver exists behind the same interface but has not been exercised against a real bucket |
| Key management | AWS KMS (HSM) | Local master key by default; a KMS provider exists behind the same interface but has not been exercised against a real key |
| Event bus | Apache Kafka | Not deployed. Scheduled jobs plus a `notifications` outbox cover current needs |
| Integrity ledger | Hyperledger Fabric | Append-only, hash-chained PostgreSQL table with a database-enforced immutability trigger |
| MFA | TOTP | TOTP with single-use backup codes ✅ |
| Prescription signing | RSA-2048 PKI | ECDSA P-256, generated in-browser and non-extractable; verified server-side ✅ |
| Aadhaar / ABDM | UIDAI DigiLocker | Not integrated — requires accreditation |
| Row-Level Security | PostgreSQL RLS | Not enabled; access control is enforced in the application layer |

### What this build does *not* do

Stated plainly, because a health-records platform should not overstate itself:

- **The local key provider does not deliver the property the architecture document claims.** §4.2 says a database administrator cannot decrypt records. With `KEY_PROVIDER=LOCAL` the master key sits in the same environment as the database URL, so that separation does not exist yet. The envelope encryption is real; the trust boundary is not.
- **Notification delivery is simulated** unless SMTP or an SMS provider is configured. Rows are marked `SIMULATED`, never `DELIVERED`, so the history stays truthful.
- **Aadhaar verification is not real.** The client hashes the number locally and the server logs an OTP to the console.
- **There is no distributed consensus behind the integrity ledger.** It is tamper-evident, not decentralised.

---

## Technology stack

- **Frontend:** React 19, TypeScript, Vite, TailwindCSS 4, TanStack Query, react-router 7
- **Backend:** Node.js 22, Express 5, TypeScript, Prisma 7
- **Database:** PostgreSQL 16 (20 tables)
- **Cache / jobs:** Redis (optional), node-cron
- **Crypto:** AES-256-GCM envelope encryption, ECDSA P-256 signatures, TOTP, SHA-256 hash chains
- **Testing:** Vitest, supertest
- **Delivery:** Docker, docker compose, GitHub Actions
- **Regulatory intent:** India DPDP Act 2023, ABDM alignment
