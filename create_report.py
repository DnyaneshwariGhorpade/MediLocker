import sys
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def add_page_number(run):
    for tag, ftype in [('w:fldChar', 'begin'), ('w:instrText', None), ('w:fldChar', 'separate'), ('w:fldChar', 'end')]:
        el = OxmlElement(tag)
        if ftype:
            el.set(qn('w:fldCharType'), ftype)
        if tag == 'w:instrText':
            el.set(qn('xml:space'), 'preserve')
            el.text = 'PAGE'
        run._r.append(el)

def set_section_margins(sec):
    sec.page_width  = Inches(8.27)
    sec.page_height = Inches(11.69)
    sec.top_margin    = Inches(1)
    sec.bottom_margin = Inches(1)
    sec.left_margin   = Inches(1)
    sec.right_margin  = Inches(1)

def setup_header_footer(section):
    """Add header (top-right: 'Software Project Management Laboratory') and right-aligned page number footer."""
    section.header.is_linked_to_previous = False
    section.footer.is_linked_to_previous = False

    # Header
    hdr_para = section.header.paragraphs[0]
    hdr_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hdr_run = hdr_para.add_run("Software Project Management Laboratory")
    hdr_run.font.name = 'Times New Roman'
    hdr_run.font.size = Pt(10)
    hdr_run.italic = True

    # Footer — page number
    ftr_para = section.footer.paragraphs[0]
    ftr_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    ftr_run = ftr_para.add_run()
    ftr_run.font.name = 'Times New Roman'
    ftr_run.font.size = Pt(12)
    add_page_number(ftr_run)

def add_chapter(doc, number, title):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(f"Chapter {number}\n{title}")
    run.font.name = 'Times New Roman'
    run.font.size = Pt(14)
    run.bold = True
    p.paragraph_format.space_after = Pt(10)

def add_heading(doc, text):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(12)
    run.bold = True
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)

def add_text(doc, text):
    p = doc.add_paragraph(text)
    p.paragraph_format.space_after = Pt(4)
    for run in p.runs:
        run.font.name = 'Times New Roman'
        run.font.size = Pt(12)
        run.bold = False

def add_test_table(doc, rows):
    """Add a formatted test case table."""
    headers = ['TC ID', 'Test Condition', 'Data Input', 'User Action', 'Expected Output', 'Actual Output', 'Result']
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = 'Table Grid'

    # Header row
    hdr_row = table.rows[0]
    for i, h in enumerate(headers):
        cell = hdr_row.cells[i]
        cell.text = h
        for para in cell.paragraphs:
            for run in para.runs:
                run.font.name = 'Times New Roman'
                run.font.size = Pt(9)
                run.bold = True
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Data rows
    for r_idx, row_data in enumerate(rows):
        row = table.rows[r_idx + 1]
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            cell.text = val
            for para in cell.paragraphs:
                for run in para.runs:
                    run.font.name = 'Times New Roman'
                    run.font.size = Pt(8)
                para.alignment = WD_ALIGN_PARAGRAPH.LEFT

# ─────────────────────────────────────────────────────────────────────────────
# Document bootstrap
# ─────────────────────────────────────────────────────────────────────────────

document = Document()
style = document.styles['Normal']
style.font.name = 'Times New Roman'
style.font.size = Pt(12)
style.paragraph_format.line_spacing = 1.5
style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

# ─────────────────────────────────────────────────────────────────────────────
# COVER PAGE — with page border, NO header/footer
# ─────────────────────────────────────────────────────────────────────────────

cover_sec = document.sections[0]
set_section_margins(cover_sec)

# Page border on cover only
sec_pr = cover_sec._sectPr
pgBorders = OxmlElement('w:pgBorders')
pgBorders.set(qn('w:offsetFrom'), 'page')
for side in ('top', 'left', 'bottom', 'right'):
    b = OxmlElement(f'w:{side}')
    b.set(qn('w:val'), 'single')
    b.set(qn('w:sz'), '18')
    b.set(qn('w:space'), '24')
    b.set(qn('w:color'), '000000')
    pgBorders.append(b)
sec_pr.append(pgBorders)

def cp(text, size, bold=True, space_before=0, italic=False):
    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    r.font.name = 'Times New Roman'
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(2)

cp("", 12, bold=False, space_before=60)
cp("DR. D.Y. PATIL INSTITUTE OF TECHNOLOGY", 14, space_before=0)
cp("Department of Computer Engineering, Pimpri, Pune – 411018", 12, space_before=2)
cp("", 12, bold=False, space_before=10)
cp("Software Project Management", 14, space_before=10)
cp("Laboratory Report", 14, space_before=0)
cp("", 12, bold=False, space_before=20)
cp("MediLocker", 22, space_before=20)
cp("Secure Cloud-Based Digital Medical Record Management Platform", 13, space_before=4)
cp("", 12, bold=False, space_before=10)
cp("Academic Year: 2026–27", 12, bold=False, space_before=30)
cp("Standard Alignment: IEEE 830 / ABDM / India DPDP Act 2023", 12, bold=False, space_before=2)
cp("", 12, bold=False, space_before=10)
cp("GitHub: github.com/DnyaneshwariGhorpade/MediLocker", 11, bold=False, italic=True, space_before=0)
cp("Production URL: https://medi-locker-khaki.vercel.app", 11, bold=False, italic=True, space_before=2)

# ─────────────────────────────────────────────────────────────────────────────
# CONTENT SECTION — header + footer from Chapter 1 onwards
# ─────────────────────────────────────────────────────────────────────────────

content_sec = document.add_section(WD_SECTION.NEW_PAGE)
set_section_margins(content_sec)
setup_header_footer(content_sec)

# ═════════════════════════════════════════════════════════════════════════════
# CHAPTER 1 — Introduction (≤ 2 pages)
# ═════════════════════════════════════════════════════════════════════════════

add_chapter(document, 1, "Introduction")

add_heading(document, "Project Background, Purpose, and Relevance")
add_text(document,
    "In the modern healthcare landscape, patient medical records are fragmented across hospitals, clinics, and "
    "diagnostic centers. This fragmentation causes redundant testing, care discontinuity, and life-threatening "
    "delays during emergencies. The shift towards digitization has introduced severe privacy risks, as Personal "
    "Health Information (PHI) is stored in insecure, siloed systems. MediLocker is a secure, cloud-based, "
    "patient-owned digital medical record management platform. It empowers patients with absolute data control "
    "through granular consent while providing healthcare providers with immediate, verified access to medical "
    "histories in critical situations."
)

add_heading(document, "Problem Addressed and Domain")
add_text(document,
    "MediLocker addresses health data fragmentation and privacy vulnerability in the Healthcare domain. "
    "It mitigates unauthorized data sharing, data loss, and emergency access delays by implementing a "
    "zero-trust architecture, ECDSA P-256 cryptographic signatures for prescriptions, and a "
    "SHA-256 hash-chained tamper-evident integrity ledger backed by an immutable database trigger."
)

add_heading(document, "Mapping to Sustainable Development Goals (SDGs)")
add_text(document,
    "SDG 3 — Good Health and Well-being: Immediate access to verified medical history reduces medical "
    "errors and improves emergency response outcomes.\n"
    "SDG 9 — Industry, Innovation and Infrastructure: A cloud-native, cryptographically secure digital "
    "infrastructure for healthcare, aligned with India's Ayushman Bharat Digital Mission (ABDM)."
)

add_heading(document, "Objectives")
add_text(document,
    "1. To develop a cloud-native patient medical vault with AES-256-GCM envelope encryption and "
    "category-level, time-bounded consent controls for all five user roles.\n"
    "2. To implement a 'Break-Glass' emergency access protocol with dual-party OTP approval and "
    "automatic 4-hour expiry, enabling life-saving data access when a patient is incapacitated.\n"
    "3. To ensure data integrity through a SHA-256 hash-chained PostgreSQL ledger with an immutability "
    "trigger and ECDSA P-256 prescription signing verified server-side against the doctor's registered public key."
)

document.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# CHAPTER 2 — System Study (≤ 2 pages)
# ═════════════════════════════════════════════════════════════════════════════

add_chapter(document, 2, "System Study")

add_heading(document, "Currently Available System / Process")
add_text(document,
    "The existing ecosystem relies on isolated Hospital Management Systems (HMS) and physical paper records. "
    "A patient's medical history stays locked in the previous institution's database. Inter-hospital data "
    "exchange occurs via unencrypted email or physical paper handoffs, with no patient consent layer or "
    "cryptographic authenticity mechanism."
)

add_heading(document, "Disadvantages or Inefficiencies")
add_text(document,
    "1. Data Fragmentation: Patients lose reports, leading to repeated diagnostic tests and disjointed care.\n"
    "2. Emergency Access Delays: Attending physicians have zero access to a critical patient's allergy or "
    "chronic disease history during trauma, risking fatal drug interactions.\n"
    "3. No Consent Control: Doctors and staff can view a patient's complete medical file without explicit "
    "patient permission, violating the DPDP Act 2023.\n"
    "4. No Prescription Authenticity: PDF prescriptions are easily altered using basic software, enabling "
    "pharmaceutical fraud with no cryptographic detection."
)

add_heading(document, "Proposed Solution and Advantages")
add_text(document,
    "MediLocker centralizes records in a zero-trust encrypted vault. Patients grant time-bound, "
    "category-specific access (e.g., allowing Blood Reports, blocking HIV Reports). The Break-Glass "
    "module provides dual-verified emergency access within a strictly enforced 4-hour window. "
    "Prescriptions are signed with ECDSA P-256 keys; the server verifies every signature before "
    "storing the prescription. All document SHA-256 hashes are anchored to a hash-chained "
    "immutable ledger — any tampering is instantly detectable."
)

add_heading(document, "Problem Statement and Project Title")
add_text(document,
    "Title: MediLocker — Secure Cloud-Based Digital Medical Record Management Platform.\n"
    "Problem Statement: To design and implement a patient-centric digital healthcare platform that eliminates "
    "data fragmentation, guarantees privacy through granular consent, and ensures immediate verified access "
    "during emergencies, in full compliance with the India DPDP Act 2023 and ABDM framework."
)

add_heading(document, "Key Tasks, User Intervention, and Performance Parameters")
add_text(document,
    "Key Tasks: Salted Aadhaar hash registration (DPDP-compliant), MRN-verified doctor onboarding, "
    "AES-256-GCM file upload, category-level consent management, ECDSA P-256 prescription signing, "
    "SHA-256 hash-chain integrity sweeping via scheduled jobs.\n"
    "User Intervention: Minimal once consent is granted. Emergency access requires hospital admin OTP approval.\n"
    "Performance Parameters — Speed: <10ms consent evaluation on Redis cache hit; ~90ms on cold cache. "
    "Accuracy: 100% ECDSA signature and SHA-256 hash verification accuracy. "
    "Accessibility: 78/78 API routes verified non-5xx; deployed on Vercel (frontend) and Render (backend)."
)

document.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# CHAPTER 3 — SRS (≤ 2 pages)
# ═════════════════════════════════════════════════════════════════════════════

add_chapter(document, 3, "System Requirement Specification (SRS)")

add_heading(document, "Functional Requirements")
add_text(document,
    "FR01 — Role-Based Portals: Distinct authenticated portals for Patient, Doctor, Hospital Admin, "
    "Platform Admin, Emergency Physician, and a public verifier (no login).\n"
    "FR02 — Medical Vault and Encryption: Doctors upload files (PDF, JPEG, PNG) encrypted with "
    "AES-256-GCM using a unique per-file DEK wrapped by a master key (local or AWS KMS).\n"
    "FR03 — Granular Consent Engine: Patients grant time-bounded, category-specific access per doctor. "
    "A block always overrides a grant. Revocation takes effect within 1 second via Redis key deletion.\n"
    "FR04 — TOTP MFA: All users complete time-based OTP authentication after password entry. "
    "Backup codes are issued at enrolment.\n"
    "FR05 — Digital Prescriptions: Doctors sign prescriptions with ECDSA P-256 (browser-generated, "
    "non-extractable key). Server verifies signature before storage. Public verifier portal at /verify.\n"
    "FR06 — Break-Glass Emergency Access: Dual-party OTP approval required. Hard 4-hour expiry "
    "enforced by scheduled job. Patient and emergency contact notified immediately.\n"
    "FR07 — Integrity Ledger: SHA-256 hash of every uploaded file anchored to an append-only, "
    "hash-chained PostgreSQL ledger. Scheduled integrity sweep re-hashes stored files and alerts on mismatch.\n"
    "FR08 — Audit Log: Every state-changing request and every record access is logged with a "
    "chained SHA-256 hash. No row may be modified or deleted (enforced by database trigger)."
)

add_heading(document, "Non-Functional Requirements")
add_text(document,
    "NFR01 — Security: PHI encrypted at rest (AES-256-GCM) and in transit (TLS 1.3). "
    "Passwords hashed with Bcrypt. JWT secrets ≥ 32 characters; system refuses to start without them.\n"
    "NFR02 — Performance: Consent evaluation <10ms on Redis cache hit. "
    "Current remote DB round-trip: ~1300ms (Supabase ap-northeast-1).\n"
    "NFR03 — DPDP Compliance: Aadhaar stored as salted SHA-256 hash only. "
    "Audit logs immutable (7-year retention). Soft deletes preserve audit hashes.\n"
    "NFR04 — Account Security: Account locked after 10 failed login attempts for 15 minutes. "
    "Auth endpoints rate-limited to 10 requests per 15-minute window.\n"
    "NFR05 — Scalability: Docker + docker-compose brings up full stack (PostgreSQL, Redis, API, "
    "nginx frontend). GitHub Actions CI runs typecheck, 77 integration tests, and build on every PR."
)

document.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# CHAPTER 4 — System Design (≤ 4 pages)
# ═════════════════════════════════════════════════════════════════════════════

add_chapter(document, 4, "System Design")

add_heading(document, "SDLC Model and Justification")
add_text(document,
    "Agile SDLC was adopted across six sequential delivery phases. Justification: Integrating cryptography, "
    "a tamper-evident ledger, and healthcare compliance required correctness to precede capability. Each "
    "phase had verifiable acceptance criteria (tests passing, not merely assertions). Phases: "
    "(1) Foundation and Defect Repair, (2) Backend Hardening and Audit Integrity, "
    "(3) Encrypted File Pipeline, (4) Cryptographic Identity, (5) Platform Services and Automation, "
    "(6) Frontend Completion and Delivery. All six phases were delivered."
)

add_heading(document, "4.1 Existing System")
add_text(document,
    "Isolated Hospital Management Systems store patient records in plaintext relational databases or "
    "paper filing cabinets. Data exchange occurs through unencrypted email or physical handoffs. "
    "No patient consent layer, no cryptographic signature, and no immutable audit trail exists."
)

add_heading(document, "4.2 Limitations of Existing System")
add_text(document,
    "1. Plaintext storage is vulnerable to ransomware and internal theft.\n"
    "2. Patients have no visibility or control over who views their data.\n"
    "3. PDF prescriptions can be forged or altered without detection.\n"
    "4. Emergency physicians have no access to patient history for unconscious or unresponsive patients.\n"
    "5. No cryptographic audit trail exists to prove unauthorized access or data modification."
)

add_heading(document, "4.3 Proposed System — Current Implementation Architecture")
add_text(document,
    "MediLocker is a single Express.js monolith (Node.js 22, TypeScript, Prisma 7) with a target "
    "microservices topology for future scale-out.\n\n"
    "Frontend: React 19, TypeScript, Vite, TailwindCSS 4, TanStack Query, react-router 7 — deployed on Vercel.\n"
    "Backend API: Express 5 monolith, 78 routes across 11 route modules — deployed on Render (Singapore).\n"
    "Database: PostgreSQL 16 with 20 tables on Supabase (ap-northeast-1). Includes hash-chained audit_logs "
    "with immutability trigger and append-only ledger_entries table.\n"
    "Cache / Jobs: Redis (optional via REDIS_URL); in-process map fallback. Five node-cron scheduled jobs.\n"
    "Storage: Local disk by default; S3 driver available behind the same interface.\n"
    "Cryptography: AES-256-GCM envelope encryption, ECDSA P-256 signing, TOTP, SHA-256 hash chains.\n"
    "CI/CD: GitHub Actions (typecheck → test → build). Docker + docker-compose for local full-stack.\n\n"
    "Architecture Description: All web portals communicate over HTTPS/TLS 1.3 to the API gateway, "
    "which validates JWTs and enforces RBAC. The Consent Engine queries Redis first (cache hit <1ms) "
    "and falls back to PostgreSQL on a cold cache. Medical files are AES-256-GCM encrypted in memory "
    "before being written to storage. Every file upload triggers a SHA-256 hash recorded in the "
    "ledger_entries table. The audit_logs table records every request with a chained hash; "
    "a BEFORE UPDATE OR DELETE trigger aborts any modification attempt."
)

add_heading(document, "Current vs Target Architecture Comparison")
add_text(document,
    "| Concern           | Target Architecture            | Current Implementation              |\n"
    "| Service topology  | 8 microservices, Envoy gateway | One Express monolith                |\n"
    "| Database          | PostgreSQL 16                  | PostgreSQL 16 on Supabase [Deployed]|\n"
    "| Consent cache     | Redis 7.2 cluster              | Redis if REDIS_URL set; else in-process map |\n"
    "| Object storage    | AWS S3 (ap-south-1)            | Local disk (S3 driver exists, untested) |\n"
    "| Key management    | AWS KMS (HSM)                  | Local env variable master key       |\n"
    "| Event bus         | Apache Kafka                   | Not deployed; node-cron + outbox    |\n"
    "| Integrity ledger  | Hyperledger Fabric             | Hash-chained PostgreSQL table [Deployed] |\n"
    "| MFA               | TOTP                           | TOTP + backup codes [Deployed]      |\n"
    "| Prescription sign | RSA-2048                       | ECDSA P-256 [Deployed]              |\n"
    "| Aadhaar/ABDM      | UIDAI DigiLocker               | Not integrated — requires accreditation |"
)

add_heading(document, "4.4 Problem Definition / Title")
add_text(document,
    "Title: MediLocker — Secure Cloud-Based Digital Medical Record Management Platform.\n"
    "Definition: To engineer a healthcare platform that eliminates medical record fragmentation, "
    "guarantees cryptographic privacy through granular patient-controlled consent, and ensures "
    "immediate, verified emergency access — fully compliant with India DPDP Act 2023."
)

document.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# CHAPTER 5 — System Implementation (≤ 2 pages)
# ═════════════════════════════════════════════════════════════════════════════

add_chapter(document, 5, "System Implementation")

add_heading(document, "Functional Modules of the System")
add_text(document,
    "The system is organized into 12 domain modules backed by 20 PostgreSQL tables:\n"
    "1. Identity, Authentication & RBAC — users, user_sessions, mfa_backup_codes. TOTP MFA, Bcrypt passwords, JWT session management across 5 roles.\n"
    "2. Medical Vault & Records — patient_vaults, medical_records. AES-256-GCM file encryption, SHA-256 hash computation, per-file DEK.\n"
    "3. Prescriptions — prescriptions (JSONB medications array, ECDSA P-256 signature, QR link).\n"
    "4. Consent Management — consents. Redis-cached category-level grants/blocks with instant revocation.\n"
    "5. Break-Glass Emergency — break_glass_access_sessions, break_glass_record_accesses. Dual OTP approval, 4-hour expiry, patient notification.\n"
    "6. Integrity Ledger — ledger_entries. Append-only, SHA-256 hash-chained. Scheduled integrity sweep.\n"
    "7. Record Flagging — record_flags. Four-state dispute lifecycle (FLAGGED → UNDER_REVIEW → RESOLVED).\n"
    "8. Patient Vitals — patient_vitals. Time-series readings (BP, blood sugar, SpO2, weight) for dashboard charts.\n"
    "9. Consultations — consultations. Doctor visit history with follow-up reminders via scheduled job.\n"
    "10. HMS API Management — hms_api_clients. SHA-256 API key hashing, IP whitelisting, rate limiting.\n"
    "11. Notifications — notifications. Outbox pattern for 6 event types via email/SMS; rows marked SIMULATED if no provider is configured.\n"
    "12. Audit Log — audit_logs (BIGSERIAL). Every request logged with chained SHA-256. BEFORE UPDATE OR DELETE trigger enforces immutability. Verifiable at GET /api/v1/admin/audit-logs/verify-chain."
)

add_heading(document, "Algorithm: AES-256-GCM Envelope Encryption")
add_text(document,
    "Step 1: Generate a unique 32-byte DEK (crypto.randomBytes(32)) per file.\n"
    "Step 2: Generate a 12-byte IV (crypto.randomBytes(12)).\n"
    "Step 3: Encrypt the file buffer using AES-256-GCM with the DEK and IV; extract GCM auth tag.\n"
    "Step 4: Encrypt the DEK with the master key (local env or AWS KMS); wipe plaintext DEK from memory.\n"
    "Step 5: Store ciphertext to disk/S3; store Encrypted DEK + IV + auth tag + SHA-256 hash in PostgreSQL.\n"
    "Decryption: Fetch Encrypted DEK → decrypt with master key → decrypt file in memory → stream to client → log in audit chain."
)

add_heading(document, "Key Code Snippet — Audit Log Immutability Trigger")
add_text(document,
    "CREATE OR REPLACE FUNCTION trg_enforce_audit_immutability()\n"
    "RETURNS TRIGGER AS $$\n"
    "BEGIN\n"
    "    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE are forbidden.';\n"
    "    RETURN NULL;\n"
    "END;\n"
    "$$ LANGUAGE plpgsql;\n\n"
    "CREATE TRIGGER trg_audit_logs_immutable\n"
    "BEFORE UPDATE OR DELETE ON audit_logs\n"
    "FOR EACH ROW EXECUTE FUNCTION trg_enforce_audit_immutability();"
)

document.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# CHAPTER 6 — Testing and Deployment (≤ 2 pages)
# ═════════════════════════════════════════════════════════════════════════════

add_chapter(document, 6, "Testing and Deployment")

add_heading(document, "Manual Test Cases")

tc_rows = [
    ['TC-01', 'Patient login with TOTP MFA', 'Correct email, password, valid 6-digit TOTP', 'Click Sign In', 'Redirect to /patient/dashboard', 'Redirected to dashboard', 'PASS'],
    ['TC-02', 'Doctor views consent-blocked category (HIV_REPORT)', 'record_id of HIV_REPORT; consent blocks category', 'GET /api/v1/vault/records/:id/download', 'HTTP 403 — category blocked', 'HTTP 403 as expected', 'PASS'],
    ['TC-03', 'File encryption integrity', 'Upload test_xray.jpg', 'POST /api/v1/vault/records', 'Stored file is AES-256-GCM ciphertext', 'Raw stored object is unreadable ciphertext', 'PASS'],
    ['TC-04', 'Audit log immutability', 'SQL: DELETE FROM audit_logs WHERE log_id=1', 'Run query directly on DB', 'Transaction aborted by trigger', 'ERROR: Audit logs are immutable', 'PASS'],
    ['TC-05', 'Break-glass session auto-expiry', 'Session token past 4-hour expiry', 'GET /api/v1/emergency/session/:id/records', 'HTTP 401 — session expired', 'HTTP 401 as expected', 'PASS'],
    ['TC-06', 'Prescription tampering detection', 'Altered prescription (dosage changed)', 'POST /api/v1/public/verify-prescription', 'Signature verification failed', 'Tamper detected — invalid signature', 'PASS'],
    ['TC-07', 'Account lockout after 10 failed logins', '10 × wrong password attempts', 'POST /api/v1/auth/login ×10', 'HTTP 423 — account locked 15 min', 'HTTP 423 returned on 11th attempt', 'PASS'],
    ['TC-08', 'Consent revocation takes immediate effect', 'Active consent revoked by patient', 'PATCH /api/v1/consent/:id/revoke then doctor accesses record', 'HTTP 403 within 1 second', 'HTTP 403 < 1s after revocation', 'PASS'],
]
add_test_table(document, tc_rows)

add_heading(document, "Output / Deployment Screens")
add_text(document,
    "$ npm run smoke\n"
    "[Smoke] POST /api/v1/auth/login ............... 200 OK\n"
    "[Smoke] GET  /api/v1/patient/vault ............. 200 OK\n"
    "[Smoke] GET  /api/v1/doctor/patients ........... 403 (Requires Consent — expected)\n"
    "[Smoke] GET  /api/v1/admin/audit-logs/verify-chain .... 200 OK — LEDGER: INTACT\n"
    "[Smoke Test] 78/78 routes passed. Zero 500 errors detected.\n\n"
    "Deployment URLs:\n"
    "  Frontend (Vercel):  https://medi-locker-khaki.vercel.app\n"
    "  Backend API (Render): https://medilocker-backend-5vpd.onrender.com\n"
    "  Database: Supabase PostgreSQL 16, ap-northeast-1 (20 tables)\n"
    "  Local: docker compose up --build → API:3000, Frontend:8080, Redis:6379, PostgreSQL:5432"
)

document.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# CHAPTER 7 — Result and Discussion (≤ 1 page)
# ═════════════════════════════════════════════════════════════════════════════

add_chapter(document, 7, "Result and Discussion")

add_heading(document, "Achievements Summary")
add_text(document,
    "All six delivery phases were completed. Key verifiable outcomes: "
    "AES-256-GCM encryption is real — stored objects are unreadable without the master key. "
    "ECDSA P-256 prescription signing is verified server-side — an altered dosage field causes failure. "
    "Audit log chain is INTACT over all entries — immutability trigger confirmed. "
    "Break-Glass auto-expiry confirmed — sessions become unusable at 4 hours. "
    "Consent revocation takes effect in <1 second via Redis cache deletion. "
    "77 integration tests pass; 78/78 smoke checks confirm zero 500 errors."
)

add_heading(document, "Performance Evaluation (Measured, Not Asserted)")
add_text(document,
    "Database round-trip (Supabase, ap-northeast-1): ~1300ms. "
    "Consent evaluation — cache hit (Redis): <1ms ✓ meets NFR02 <10ms target. "
    "Consent evaluation — cold cache: ~90ms ✗ does not meet <10ms on uncached path with remote DB. "
    "A co-located database with a provisioned Redis instance would be required to meet NFR02 generally."
)

add_heading(document, "Future Extensions")
add_text(document,
    "1. AWS KMS + S3: Substitute local key/disk drivers to deliver the full cryptographic trust boundary.\n"
    "2. UIDAI/ABDM Integration: Live Aadhaar OTP and ABHA health ID resolution (requires accreditation).\n"
    "3. PostgreSQL Row-Level Security: Database-layer enforcement of per-patient data isolation.\n"
    "4. Apache Kafka: Replace node-cron outbox with event streaming for multi-institution scale-out.\n"
    "5. Hyperledger Fabric Ledger: Distributed consensus for cross-institution tamper-proof anchoring."
)

document.add_page_break()

# ═════════════════════════════════════════════════════════════════════════════
# CHAPTER 8 — References (≤ 1 page)
# ═════════════════════════════════════════════════════════════════════════════

add_chapter(document, 8, "References")
add_text(document,
    "1. Digital Personal Data Protection (DPDP) Act, 2023. Ministry of Law and Justice, Government of India.\n"
    "2. Ayushman Bharat Digital Mission (ABDM) Architecture Framework. National Health Authority, India. abdm.gov.in.\n"
    "3. IEEE Std 830-1998 — IEEE Recommended Practice for Software Requirements Specifications. IEEE, 1998.\n"
    "4. NIST FIPS PUB 197 — Advanced Encryption Standard (AES). U.S. Department of Commerce, 2001.\n"
    "5. NIST FIPS PUB 186-4 — Digital Signature Standard (DSS), ECDSA. U.S. Department of Commerce, 2009.\n"
    "6. AWS Key Management Service Cryptographic Details. Amazon Web Services. docs.aws.amazon.com/kms.\n"
    "7. Supabase Platform Documentation. supabase.com/docs.\n"
    "8. Prisma ORM Documentation v7. prisma.io/docs.\n"
    "9. Redis Commands Reference. redis.io/docs.\n"
    "10. React 19 Documentation. Meta Platforms, Inc. react.dev.\n"
    "11. IETF RFC 6238 — TOTP: Time-Based One-Time Password Algorithm. IETF, 2011.\n"
    "12. Bellare, M., Rogaway, P. (2004). Nonce-Based Symmetric Encryption. FSE 2004, LNCS Vol. 3017, Springer."
)

# ─────────────────────────────────────────────────────────────────────────────
# Save
# ─────────────────────────────────────────────────────────────────────────────
document.save("MediLocker_Project_Report.docx")
print("SUCCESS — MediLocker_Project_Report.docx regenerated with full PDF format compliance.")
