import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn
import os

def set_cell_background(cell, fill_color):
    """Sets background color of a table cell (e.g. '1E3A8A')"""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    """Sets internal padding for a cell in dxa (1 pt = 20 dxa)"""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}>'
                      f'<w:top w:w="{top}" w:type="dxa"/>'
                      f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
                      f'<w:left w:w="{left}" w:type="dxa"/>'
                      f'<w:right w:w="{right}" w:type="dxa"/>'
                      f'</w:tcMar>')
    tcPr.append(tcMar)

def set_table_borders(table, color="CBD5E1"):
    """Sets thin subtle border for table"""
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'<w:tblBorders {nsdecls("w")}>'
                        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
                        f'<w:left w:val="none"/>'
                        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="{color}"/>'
                        f'<w:right w:val="none"/>'
                        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{color}"/>'
                        f'<w:insideV w:val="none"/>'
                        f'</w:tblBorders>')
    tblPr.append(borders)

def add_styled_table(doc, headers, data, col_widths=None, primary_header_color="1E3A8A"):
    """Creates a beautifully styled table with colored header and alternating row colors"""
    table = doc.add_table(rows=len(data) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table)
    
    # Repeat header on every page
    header_tr = table.rows[0]._tr.get_or_add_trPr()
    header_tr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

    # Header Row
    for col_idx, text in enumerate(headers):
        cell = table.cell(0, col_idx)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        set_cell_background(cell, primary_header_color)
        set_cell_margins(cell, top=140, bottom=140, left=160, right=160)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        run = p.add_run(text)
        run.font.name = 'Segoe UI'
        run.font.size = Pt(9.5)
        run.font.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)
        
    # Data Rows
    for row_idx, row_data in enumerate(data):
        row = table.rows[row_idx + 1]
        bg_color = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for col_idx, cell_value in enumerate(row_data):
            cell = row.cells[col_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_background(cell, bg_color)
            set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            
            # Format inline bold if starts with ** or contains bold tags
            # Clean display
            run = p.add_run(str(cell_value))
            run.font.name = 'Segoe UI'
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(30, 41, 59) # Slate 800
            
            # Code style for attributes and data types
            if col_idx in (0, 1):
                run.font.name = 'Consolas'
                run.font.size = Pt(8.5)
                if col_idx == 0:
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(15, 23, 42)
                else:
                    run.font.color.rgb = RGBColor(37, 99, 235) # Blue
            elif col_idx == 2:
                run.font.name = 'Consolas'
                run.font.size = Pt(8.5)
                run.font.color.rgb = RGBColor(100, 116, 139) # Muted slate
                
    # Column widths
    if col_widths:
        for row in table.rows:
            for col_idx, width in enumerate(col_widths):
                row.cells[col_idx].width = Inches(width)
                
    doc.add_paragraph() # Spacing
    return table

def add_callout(doc, title, text, box_type="info"):
    """Adds a modern callout box with a colored left accent border"""
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.2)
    p.paragraph_format.right_indent = Inches(0.2)
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(8)
    
    # Table approach for callout
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    cell.width = Inches(6.5)
    
    bg_color = "EFF6FF" if box_type == "info" else "FEF3C7"
    border_color = "2563EB" if box_type == "info" else "D97706"
    
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'<w:tcBorders {nsdecls("w")}>'
                        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>'
                        f'<w:top w:val="none"/>'
                        f'<w:right w:val="none"/>'
                        f'<w:bottom w:val="none"/>'
                        f'</w:tcBorders>')
    tcPr.append(borders)
    
    cp = cell.paragraphs[0]
    title_run = cp.add_run(f"📌 {title}\n")
    title_run.font.name = 'Segoe UI'
    title_run.font.size = Pt(10)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(30, 58, 138) if box_type == "info" else RGBColor(146, 64, 14)
    
    text_run = cp.add_run(text)
    text_run.font.name = 'Segoe UI'
    text_run.font.size = Pt(9.5)
    text_run.font.color.rgb = RGBColor(30, 41, 59)
    doc.add_paragraph()

def build_document():
    doc = docx.Document()
    
    # Set Margins
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)
        
    # Document Title Block
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    title_run = title_p.add_run("MediLocker")
    title_run.font.name = 'Segoe UI'
    title_run.font.size = Pt(26)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(30, 58, 138) # Navy Blue
    
    subtitle_p = doc.add_paragraph()
    subtitle_p.paragraph_format.space_before = Pt(0)
    subtitle_p.paragraph_format.space_after = Pt(14)
    sub_run = subtitle_p.add_run("Database Schema, Core Stack & System Architecture Specification\n")
    sub_run.font.name = 'Segoe UI'
    sub_run.font.size = Pt(13)
    sub_run.font.bold = True
    sub_run.font.color.rgb = RGBColor(37, 99, 235)
    
    desc_run = subtitle_p.add_run("Secure Cloud-Based Digital Medical Record Management Platform with Granular Consent, PKI Signatures & Blockchain Anchoring")
    desc_run.font.name = 'Segoe UI'
    desc_run.font.size = Pt(10)
    desc_run.font.italic = True
    desc_run.font.color.rgb = RGBColor(100, 116, 139)
    
    # Metadata Box
    meta_headers = ["Project Property", "Specification Details"]
    meta_data = [
        ["Project Title", "MediLocker — Digital Healthcare Record Platform"],
        ["Target Architecture", "Microservices Monorepo on AWS (ap-south-1 Mumbai)"],
        ["Database Engine", "PostgreSQL 16 Enterprise (Relational + JSONB) with Redis 7.2 Cache"],
        ["Compliance Standards", "India DPDP Act 2023, ABDM Health Data Policy, IEEE Std 830"],
        ["Security Framework", "Zero Trust Architecture, AES-256 Envelope KMS Encryption, TOTP MFA, RSA-2048 PKI"],
        ["Version & Status", "Version 1.0 — Architecture & Implementation Baseline"]
    ]
    add_styled_table(doc, meta_headers, meta_data, col_widths=[2.2, 4.3], primary_header_color="1E3A8A")
    
    # -------------------------------------------------------------
    # SECTION 1: SYSTEM OVERVIEW & CORE TECH STACK
    # -------------------------------------------------------------
    h1 = doc.add_heading(level=1)
    r = h1.add_run("1. System Overview & Core Technical Stack")
    r.font.name = 'Segoe UI'
    r.font.size = Pt(16)
    r.font.bold = True
    r.font.color.rgb = RGBColor(30, 58, 138)
    
    p = doc.add_paragraph()
    p.add_run("MediLocker is an enterprise-grade, cloud-native healthcare platform providing lifelong encrypted digital vaults for patient health records. Built with granular category-level consent access, instant emergency break-glass overrides, cryptographic prescription signing, and tamper-evident blockchain anchoring, it guarantees patient privacy and eliminates healthcare record fragmentation.")
    
    tech_headers = ["Layer / Component", "Technology Stack", "Architectural Purpose & SLA"]
    tech_data = [
        ["Frontend Web Portals", "React 18+, TypeScript, Vite, TailwindCSS, Lucide-React, TanStack Query", "Type-safe, responsive web portals for 4 distinct actor roles (Patient, Doctor, Hospital HMS, Administrator) with sub-second page loads."],
        ["Backend Microservices", "Spring Boot 3.x (Java 17) & Node.js / Express Microservices", "Domain-driven microservices handling authentication, vault storage, consent verification, notifications, and analytics."],
        ["Primary Database", "PostgreSQL 16 Enterprise", "ACID transactional guarantees, native JSONB support for clinical prescriptions, Row-Level Security (RLS), and GIN indexing."],
        ["Distributed In-Memory Cache", "Redis 7.2 Cluster", "High-speed consent token validation (<10ms SLA target), instant token revocation cache, and API Gateway rate-limiting counters."],
        ["Event Streaming & Queue", "Apache Kafka", "Asynchronous real-time event pipeline for multi-channel notifications (Email, SMS, Push), immutable audit logs, and blockchain hash dispatch."],
        ["Encrypted Cloud Storage", "AWS S3 (ap-south-1 Mumbai)", "Encrypted object storage with AWS KMS (AES-256 Envelope SSE-KMS) ensuring database administrators cannot access raw health records."],
        ["Blockchain Tamper Ledger", "Hyperledger Fabric (Permissioned)", "Immutably records SHA-256 document digests and timestamps; detects unauthorized tampering without exposing Personal Health Information (PHI)."],
        ["Security & Identity", "Spring Security, JWT (RSA-256), TOTP MFA, Argond2id", "Zero Trust model enforcing authentication, session revocation, and cryptographic signature validation on all API endpoints."],
        ["Orchestration & DevOps", "Docker, Kubernetes (AWS EKS), Helm, GitHub Actions", "Containerized microservices deployment with Kubernetes Horizontal Pod Autoscaler (HPA) supporting 500+ concurrent users (NFR08, NFR09)."]
    ]
    add_styled_table(doc, tech_headers, tech_data, col_widths=[1.5, 2.2, 2.8], primary_header_color="2563EB")
    
    # -------------------------------------------------------------
    # SECTION 2: COMPLETE DATABASE SCHEMAS AND TABLES
    # -------------------------------------------------------------
    h1 = doc.add_heading(level=1)
    r = h1.add_run("2. Complete Database Schemas & Data Dictionaries")
    r.font.name = 'Segoe UI'
    r.font.size = Pt(16)
    r.font.bold = True
    r.font.color.rgb = RGBColor(30, 58, 138)
    
    p = doc.add_paragraph()
    p.add_run("The database is partitioned into 12 core functional domains. Every table includes complete attribute names, PostgreSQL data types, default values, primary/foreign key relationships, and integrity constraints.")
    
    schema_modules = [
        ("Module 1: Identity, Authentication & RBAC", [
            ("users", "Central credentials, multi-factor authentication settings, and account state across all platform actors.",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["user_id", "UUID", "gen_random_uuid()", "PRIMARY KEY. Global unique user identifier."],
                 ["email", "VARCHAR(255)", "NULL", "UNIQUE, NOT NULL. Normalized lowercase login email."],
                 ["phone_number", "VARCHAR(20)", "NULL", "UNIQUE, NOT NULL. E.164 international format."],
                 ["password_hash", "VARCHAR(255)", "NULL", "NOT NULL. Argon2id / BCrypt password hash."],
                 ["user_role", "VARCHAR(30)", "'PATIENT'", "NOT NULL. Enum: PATIENT, DOCTOR, HOSPITAL_ADMIN, PLATFORM_ADMIN, EMERGENCY_PHYSICIAN."],
                 ["is_mfa_enabled", "BOOLEAN", "TRUE", "NOT NULL. Mandatory MFA flag for Zero Trust (FR04)."],
                 ["mfa_secret", "VARCHAR(128)", "NULL", "Encrypted TOTP secret key."],
                 ["account_status", "VARCHAR(30)", "'PENDING_VERIFICATION'", "Enum: PENDING_VERIFICATION, ACTIVE, SUSPENDED, LOCKED, DEACTIVATED."],
                 ["failed_login_attempts", "INT", "0", "NOT NULL. Consecutive failed logins (locks at 5)."],
                 ["lockout_until", "TIMESTAMPTZ", "NULL", "Account lockout expiration timestamp."],
                 ["last_login_at", "TIMESTAMPTZ", "NULL", "Timestamp of latest successful login."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL. Account generation timestamp."],
                 ["updated_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL. Last modification timestamp."]
             ]),
            ("patients", "Stores patient demographic profiles, salted identity hashes, and emergency contacts.",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["patient_id", "UUID", "gen_random_uuid()", "PRIMARY KEY. Distinct patient profile identifier."],
                 ["user_id", "UUID", "NULL", "FOREIGN KEY (users.user_id) ON DELETE CASCADE, UNIQUE, NOT NULL."],
                 ["aadhaar_hash", "VARCHAR(64)", "NULL", "UNIQUE, NOT NULL. Salted SHA-256 hash (DPDP Act compliance)."],
                 ["aadhaar_vault_token", "VARCHAR(128)", "NULL", "Encrypted reference from UIDAI / DigiLocker verification."],
                 ["first_name", "VARCHAR(100)", "NULL", "NOT NULL. Legal given name."],
                 ["last_name", "VARCHAR(100)", "NULL", "NOT NULL. Legal family name."],
                 ["date_of_birth", "DATE", "NULL", "NOT NULL. Date of birth."],
                 ["gender", "VARCHAR(20)", "NULL", "NOT NULL. Enum: MALE, FEMALE, OTHER, UNDISCLOSED."],
                 ["blood_group", "VARCHAR(10)", "NULL", "Enum: A+, A-, B+, B-, AB+, AB-, O+, O-, UNKNOWN."],
                 ["address_line", "TEXT", "NULL", "Encrypted residential address."],
                 ["city", "VARCHAR(100)", "NULL", "City of residence."],
                 ["state", "VARCHAR(100)", "NULL", "State/UT of residence."],
                 ["pincode", "VARCHAR(10)", "NULL", "Postal code."],
                 ["emergency_contact_name", "VARCHAR(100)", "NULL", "Primary emergency contact person name."],
                 ["emergency_contact_phone", "VARCHAR(20)", "NULL", "Primary emergency contact phone number."],
                 ["emergency_contact_relation", "VARCHAR(50)", "NULL", "e.g. SPOUSE, PARENT, SIBLING, GUARDIAN."],
                 ["is_emergency_sharing_allowed", "BOOLEAN", "TRUE", "Patient preference flag for Break-Glass access visibility."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."],
                 ["updated_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."]
             ]),
            ("hospitals", "Stores registered clinical establishments, hospitals, and verification records.",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["hospital_id", "UUID", "gen_random_uuid()", "PRIMARY KEY. Unique hospital identifier."],
                 ["user_id", "UUID", "NULL", "FOREIGN KEY (users.user_id) ON DELETE RESTRICT, UNIQUE, NOT NULL."],
                 ["hospital_name", "VARCHAR(255)", "NULL", "NOT NULL. Registered clinical establishment name."],
                 ["registration_number", "VARCHAR(100)", "NULL", "UNIQUE, NOT NULL. State / National CEA registration ID."],
                 ["hospital_type", "VARCHAR(50)", "'MULTI_SPECIALTY'", "Enum: GOVERNMENT, PRIVATE_HOSPITAL, CLINIC, DIAGNOSTIC_LAB, MULTI_SPECIALTY."],
                 ["contact_email", "VARCHAR(255)", "NULL", "NOT NULL. Official hospital administration email."],
                 ["contact_phone", "VARCHAR(20)", "NULL", "NOT NULL. Official contact telephone."],
                 ["address", "TEXT", "NULL", "Premises street address."],
                 ["city", "VARCHAR(100)", "NULL", "NOT NULL. City location."],
                 ["state", "VARCHAR(100)", "NULL", "NOT NULL. State location."],
                 ["pincode", "VARCHAR(10)", "NULL", "NOT NULL. Postal code."],
                 ["verification_status", "VARCHAR(30)", "'PENDING'", "NOT NULL. Enum: PENDING, VERIFIED, REJECTED, SUSPENDED."],
                 ["verified_by_admin_id", "UUID", "NULL", "FOREIGN KEY (users.user_id). Approving platform admin."],
                 ["verified_at", "TIMESTAMPTZ", "NULL", "Approval timestamp."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."],
                 ["updated_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."]
             ]),
            ("doctors", "Stores certified medical practitioners, licensing councils, and asymmetric signing public keys.",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["doctor_id", "UUID", "gen_random_uuid()", "PRIMARY KEY. Unique doctor identifier."],
                 ["user_id", "UUID", "NULL", "FOREIGN KEY (users.user_id) ON DELETE CASCADE, UNIQUE, NOT NULL."],
                 ["primary_hospital_id", "UUID", "NULL", "FOREIGN KEY (hospitals.hospital_id) ON DELETE SET NULL."],
                 ["mrn", "VARCHAR(100)", "NULL", "UNIQUE, NOT NULL. Medical Registration Number (NMC / State ID)."],
                 ["state_medical_council", "VARCHAR(150)", "NULL", "NOT NULL. State medical council."],
                 ["first_name", "VARCHAR(100)", "NULL", "NOT NULL. Practitioner first name."],
                 ["last_name", "VARCHAR(100)", "NULL", "NOT NULL. Practitioner last name."],
                 ["specialization", "VARCHAR(100)", "NULL", "NOT NULL. Clinical specialty (e.g. Cardiology, Neurology)."],
                 ["qualification", "VARCHAR(150)", "NULL", "NOT NULL. Medical degrees (e.g. MBBS, MD, MS)."],
                 ["experience_years", "INT", "0", "Years of clinical practice."],
                 ["public_key_pem", "TEXT", "NULL", "NOT NULL. RSA-2048 / ECDSA Public Key for prescription signing verification (FR16)."],
                 ["key_fingerprint", "VARCHAR(64)", "NULL", "NOT NULL. SHA-256 fingerprint of public key."],
                 ["verification_status", "VARCHAR(30)", "'PENDING'", "NOT NULL. Enum: PENDING, VERIFIED, REJECTED, REVOKED."],
                 ["govt_id_document_url", "VARCHAR(500)", "NULL", "Encrypted S3 path to credentials."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."],
                 ["updated_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."]
             ])
        ]),
        ("Module 2: Medical Vault & Record Management", [
            ("patient_vaults", "Lifelong digital medical vaults allocated to every registered patient (FR06).",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["vault_id", "UUID", "gen_random_uuid()", "PRIMARY KEY. Lifelong vault identifier."],
                 ["patient_id", "UUID", "NULL", "FOREIGN KEY (patients.patient_id) ON DELETE CASCADE, UNIQUE, NOT NULL."],
                 ["vault_number", "VARCHAR(32)", "NULL", "UNIQUE, NOT NULL. Masked account number (e.g. ML-2026-XXXX)."],
                 ["encryption_salt", "VARCHAR(64)", "NULL", "NOT NULL. Cryptographic salt for key derivation."],
                 ["total_records_count", "INT", "0", "NOT NULL. Active records count."],
                 ["total_storage_bytes", "BIGINT", "0", "NOT NULL. Total bytes in AWS S3 storage."],
                 ["vault_status", "VARCHAR(30)", "'ACTIVE'", "Enum: ACTIVE, FROZEN, ARCHIVED."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."],
                 ["updated_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."]
             ]),
            ("medical_records", "Master metadata catalog and cryptographic envelope keys for all clinical documents (FR07, FR08, FR15).",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["record_id", "UUID", "gen_random_uuid()", "PRIMARY KEY. Unique record ID."],
                 ["vault_id", "UUID", "NULL", "FOREIGN KEY (patient_vaults.vault_id) ON DELETE CASCADE, NOT NULL."],
                 ["patient_id", "UUID", "NULL", "FOREIGN KEY (patients.patient_id) ON DELETE CASCADE, NOT NULL."],
                 ["uploaded_by_doctor_id", "UUID", "NULL", "FOREIGN KEY (doctors.doctor_id) ON DELETE SET NULL, NOT NULL."],
                 ["hospital_id", "UUID", "NULL", "FOREIGN KEY (hospitals.hospital_id) ON DELETE SET NULL, NOT NULL."],
                 ["record_title", "VARCHAR(255)", "NULL", "NOT NULL. Document title (e.g. 'Abdominal Ultrasound Scan')."],
                 ["category", "VARCHAR(50)", "NULL", "NOT NULL. Enum: PRESCRIPTION, BLOOD_REPORT, X_RAY, MRI, CT_SCAN, VACCINATION_RECORD, ALLERGY_RECORD, SURGERY_HISTORY, DISCHARGE_SUMMARY, CHRONIC_DISEASE_HISTORY, PSYCHIATRIC_REPORT, HIV_REPORT."],
                 ["is_sensitive", "BOOLEAN", "FALSE", "NOT NULL. High privacy indicator for sensitive health data (FR10)."],
                 ["diagnosis", "VARCHAR(255)", "NULL", "Provisional or confirmed clinical diagnosis."],
                 ["file_s3_key", "VARCHAR(500)", "NULL", "NOT NULL. S3 object key in AWS ap-south-1."],
                 ["file_mime_type", "VARCHAR(100)", "NULL", "NOT NULL. e.g. application/pdf, image/dicom."],
                 ["file_size_bytes", "BIGINT", "NULL", "NOT NULL. File size in bytes."],
                 ["file_sha256_hash", "VARCHAR(64)", "NULL", "NOT NULL. SHA-256 fingerprint for blockchain anchoring (FR13)."],
                 ["kms_key_id", "VARCHAR(255)", "NULL", "NOT NULL. AWS KMS Master Key ID."],
                 ["encrypted_dek", "TEXT", "NULL", "NOT NULL. AES-256 Data Encryption Key (DEK) wrapped with KMS."],
                 ["iv_bytes", "VARCHAR(64)", "NULL", "NOT NULL. Initialization vector for AES-GCM."],
                 ["version", "INT", "1", "NOT NULL. Document version number."],
                 ["parent_record_id", "UUID", "NULL", "FOREIGN KEY (medical_records.record_id) ON DELETE SET NULL. Previous version link."],
                 ["record_date", "DATE", "CURRENT_DATE", "NOT NULL. Clinical consultation/test date."],
                 ["tags", "TEXT[]", "'{}'", "GIN-indexed array of tags for search (FR18)."],
                 ["flag_status", "VARCHAR(30)", "'NORMAL'", "NOT NULL. Enum: NORMAL, FLAGGED, UNDER_REVIEW, RESOLVED (FR20)."],
                 ["is_deleted", "BOOLEAN", "FALSE", "NOT NULL. Soft delete flag (DPDP Act compliance)."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."],
                 ["updated_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."]
             ])
        ]),
        ("Module 3: Clinical Prescriptions & Digital Signatures", [
            ("prescriptions", "Structured prescription data secured with doctor's asymmetric cryptographic signature (FR16).",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["prescription_id", "UUID", "gen_random_uuid()", "PRIMARY KEY. Unique prescription identifier."],
                 ["record_id", "UUID", "NULL", "FOREIGN KEY (medical_records.record_id) ON DELETE CASCADE, UNIQUE, NOT NULL."],
                 ["doctor_id", "UUID", "NULL", "FOREIGN KEY (doctors.doctor_id) ON DELETE RESTRICT, NOT NULL."],
                 ["patient_id", "UUID", "NULL", "FOREIGN KEY (patients.patient_id) ON DELETE RESTRICT, NOT NULL."],
                 ["clinical_notes", "TEXT", "NULL", "Clinical remarks, lifestyle and dietary guidelines."],
                 ["medications", "JSONB", "'[]'", "NOT NULL. JSON array: [{drug_name, dosage, frequency, duration_days, instructions}]."],
                 ["digital_signature", "TEXT", "NULL", "NOT NULL. Base64 RSA/ECDSA signature over canonical payload (FR16)."],
                 ["signature_algorithm", "VARCHAR(50)", "'SHA256withRSA'", "Cryptographic signing algorithm."],
                 ["doctor_public_key_hash", "VARCHAR(64)", "NULL", "NOT NULL. SHA-256 fingerprint of doctor's signing key."],
                 ["is_signature_valid", "BOOLEAN", "TRUE", "Verification status evaluated at receipt."],
                 ["issued_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL. Timestamp issued."],
                 ["valid_until", "DATE", "NULL", "Prescription expiration date (Schedule H/X control)."]
             ])
        ]),
        ("Module 4: Granular Consent Management", [
            ("consents", "Patient-granted fine-grained category access permissions and blocking policies (FR09, FR10, FR11).",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["consent_id", "UUID", "gen_random_uuid()", "PRIMARY KEY. Unique consent authorization ID."],
                 ["patient_id", "UUID", "NULL", "FOREIGN KEY (patients.patient_id) ON DELETE CASCADE, NOT NULL."],
                 ["doctor_id", "UUID", "NULL", "FOREIGN KEY (doctors.doctor_id) ON DELETE CASCADE, NOT NULL."],
                 ["hospital_id", "UUID", "NULL", "FOREIGN KEY (hospitals.hospital_id) ON DELETE SET NULL."],
                 ["allowed_categories", "VARCHAR(50)[]", "'{}'", "NOT NULL. Array: e.g. ['PRESCRIPTION', 'BLOOD_REPORT']."],
                 ["blocked_categories", "VARCHAR(50)[]", "'{}'", "NOT NULL. Array: e.g. ['PSYCHIATRIC_REPORT', 'HIV_REPORT']."],
                 ["access_level", "VARCHAR(30)", "'READ_ONLY'", "Enum: READ_ONLY, DOWNLOAD_ALLOWED."],
                 ["consent_status", "VARCHAR(30)", "'ACTIVE'", "NOT NULL. Enum: ACTIVE, EXPIRED, REVOKED, REJECTED."],
                 ["valid_from", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL. Start timestamp."],
                 ["valid_until", "TIMESTAMPTZ", "NULL", "NOT NULL. Mandatory auto-expiration timestamp."],
                 ["revoked_at", "TIMESTAMPTZ", "NULL", "Early revocation timestamp (FR11)."],
                 ["revocation_reason", "TEXT", "NULL", "Optional patient justification for revocation."],
                 ["consent_token_hash", "VARCHAR(64)", "NULL", "UNIQUE, NOT NULL. SHA-256 token cached in Redis (<10ms check)."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."],
                 ["updated_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."]
             ])
        ]),
        ("Module 5: Emergency Break-Glass Access", [
            ("break_glass_access_sessions", "Tracks emergency override sessions for unconscious patients with 2-factor hospital verification (FR12).",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["session_id", "UUID", "gen_random_uuid()", "PRIMARY KEY. Unique emergency session ID."],
                 ["patient_id", "UUID", "NULL", "FOREIGN KEY (patients.patient_id) ON DELETE RESTRICT, NOT NULL."],
                 ["doctor_id", "UUID", "NULL", "FOREIGN KEY (doctors.doctor_id) ON DELETE RESTRICT, NOT NULL. Requesting emergency physician."],
                 ["hospital_id", "UUID", "NULL", "FOREIGN KEY (hospitals.hospital_id) ON DELETE RESTRICT, NOT NULL."],
                 ["emergency_reason", "TEXT", "NULL", "NOT NULL. Mandatory emergency justification."],
                 ["hospital_admin_verifier_id", "UUID", "NULL", "FOREIGN KEY (users.user_id) ON DELETE RESTRICT, NOT NULL. Second-factor hospital verifier."],
                 ["verification_otp_hash", "VARCHAR(64)", "NULL", "NOT NULL. SHA-256 hash of approval OTP."],
                 ["session_start_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL. Session commencement timestamp."],
                 ["session_expires_at", "TIMESTAMPTZ", "NULL", "NOT NULL. Hard maximum limit (strictly 4 hours)."],
                 ["session_status", "VARCHAR(30)", "'ACTIVE'", "Enum: ACTIVE, EXPIRED, TERMINATED, REVOKED."],
                 ["patient_notified", "BOOLEAN", "FALSE", "NOT NULL. Flag confirming immediate alert sent to patient/kin."],
                 ["patient_notified_at", "TIMESTAMPTZ", "NULL", "Notification dispatch timestamp."],
                 ["ip_address", "INET", "NULL", "NOT NULL. Requesting terminal IP address."],
                 ["user_agent", "TEXT", "NULL", "Terminal device/browser user agent."]
             ]),
            ("break_glass_record_accesses", "Granular audit log of every record read during an active emergency session.",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["access_id", "UUID", "gen_random_uuid()", "PRIMARY KEY."],
                 ["session_id", "UUID", "NULL", "FOREIGN KEY (break_glass_access_sessions.session_id) ON DELETE CASCADE, NOT NULL."],
                 ["record_id", "UUID", "NULL", "FOREIGN KEY (medical_records.record_id) ON DELETE RESTRICT, NOT NULL."],
                 ["accessed_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL. Read timestamp."],
                 ["decryption_status", "VARCHAR(30)", "'SUCCESS'", "Enum: SUCCESS, FAILED_KEY, UNAUTHORIZED."]
             ])
        ]),
        ("Module 6: Blockchain Tamper Evidence & Ledger", [
            ("blockchain_anchors", "Anchors SHA-256 document digests into Hyperledger Fabric for instantaneous tamper detection (FR13, FR14).",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["anchor_id", "UUID", "gen_random_uuid()", "PRIMARY KEY."],
                 ["record_id", "UUID", "NULL", "FOREIGN KEY (medical_records.record_id) ON DELETE RESTRICT, UNIQUE, NOT NULL."],
                 ["document_sha256", "VARCHAR(64)", "NULL", "NOT NULL. Plaintext document SHA-256 fingerprint."],
                 ["blockchain_network", "VARCHAR(50)", "'HYPERLEDGER_FABRIC'", "Permissioned ledger network name."],
                 ["channel_name", "VARCHAR(100)", "'medilocker-vault'", "Hyperledger Fabric channel."],
                 ["chaincode_name", "VARCHAR(100)", "'RecordIntegrityCC'", "Chaincode contract ID."],
                 ["transaction_tx_id", "VARCHAR(128)", "NULL", "UNIQUE. Fabric transaction hash."],
                 ["block_number", "BIGINT", "NULL", "Fabric block sequence number."],
                 ["anchor_status", "VARCHAR(30)", "'PENDING'", "NOT NULL. Enum: PENDING, COMMITTED, VERIFIED_MATCH, TAMPER_DETECTED."],
                 ["last_verified_at", "TIMESTAMPTZ", "NULL", "Latest automated verification audit timestamp."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."]
             ])
        ]),
        ("Module 7: Record Quality Flagging Lifecycle", [
            ("record_flags", "4-state lifecycle (Normal -> Flagged -> Under Review -> Resolved) for disputed or defective records (FR20).",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["flag_id", "UUID", "gen_random_uuid()", "PRIMARY KEY."],
                 ["record_id", "UUID", "NULL", "FOREIGN KEY (medical_records.record_id) ON DELETE RESTRICT, NOT NULL."],
                 ["flagged_by_user_id", "UUID", "NULL", "FOREIGN KEY (users.user_id) ON DELETE SET NULL, NOT NULL."],
                 ["user_role", "VARCHAR(30)", "NULL", "NOT NULL. Role of flagger: PATIENT, DOCTOR, HOSPITAL_ADMIN."],
                 ["flag_reason", "VARCHAR(50)", "NULL", "NOT NULL. Enum: INCORRECT_INFO, DUPLICATE, WRONG_PRESCRIPTION, ILLEGIBLE, EXPIRED, MISSING_PAGES, OTHER."],
                 ["reason_details", "TEXT", "NULL", "Detailed explanation of reported defect."],
                 ["flag_lifecycle_status", "VARCHAR(30)", "'FLAGGED'", "NOT NULL. 4-state lifecycle: NORMAL, FLAGGED, UNDER_REVIEW, RESOLVED."],
                 ["reviewed_by_admin_id", "UUID", "NULL", "FOREIGN KEY (users.user_id) ON DELETE SET NULL. Assigned admin."],
                 ["admin_notes", "TEXT", "NULL", "Internal investigation log notes."],
                 ["resolution_action", "VARCHAR(50)", "NULL", "Enum: REPLACED_BY_NEW_VERSION, VALIDATED_CORRECT, FLAG_REJECTED, RECORD_ARCHIVED."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."],
                 ["resolved_at", "TIMESTAMPTZ", "NULL", "Timestamp resolution completed."]
             ])
        ]),
        ("Module 8: Patient Health Trends & Telemetry", [
            ("patient_vitals", "Quantitative health metrics powering Patient Dashboard longitudinal trend charts (FR21).",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["vital_id", "UUID", "gen_random_uuid()", "PRIMARY KEY."],
                 ["patient_id", "UUID", "NULL", "FOREIGN KEY (patients.patient_id) ON DELETE CASCADE, NOT NULL."],
                 ["recorded_by_user_id", "UUID", "NULL", "FOREIGN KEY (users.user_id) ON DELETE SET NULL."],
                 ["metric_type", "VARCHAR(50)", "NULL", "NOT NULL. Enum: BP_SYSTOLIC, BP_DIASTOLIC, BLOOD_SUGAR_FASTING, BLOOD_SUGAR_PP, PULSE_RATE, SPO2, BODY_WEIGHT_KG, BODY_TEMP_F."],
                 ["metric_value", "NUMERIC(8,2)", "NULL", "NOT NULL. Numeric value (e.g. 120.00, 98.60)."],
                 ["metric_unit", "VARCHAR(20)", "NULL", "NOT NULL. Unit (e.g. mmHg, mg/dL, bpm, %, kg, F)."],
                 ["reading_context", "VARCHAR(100)", "NULL", "Context (e.g. 'Fasting 12 hrs', 'Post-workout')."],
                 ["recorded_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL. Telemetry timestamp."]
             ])
        ]),
        ("Module 9: Consultations & Follow-up Timeline", [
            ("consultations", "Encounter logs, chief complaints, and scheduled follow-ups for patient and doctor dashboards (FR21, FR22).",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["consultation_id", "UUID", "gen_random_uuid()", "PRIMARY KEY."],
                 ["patient_id", "UUID", "NULL", "FOREIGN KEY (patients.patient_id) ON DELETE RESTRICT, NOT NULL."],
                 ["doctor_id", "UUID", "NULL", "FOREIGN KEY (doctors.doctor_id) ON DELETE RESTRICT, NOT NULL."],
                 ["hospital_id", "UUID", "NULL", "FOREIGN KEY (hospitals.hospital_id) ON DELETE SET NULL, NOT NULL."],
                 ["consultation_date", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."],
                 ["chief_complaint", "TEXT", "NULL", "NOT NULL. Symptoms presented by patient."],
                 ["diagnosis_summary", "TEXT", "NULL", "Doctor's clinical diagnosis and findings summary."],
                 ["follow_up_date", "DATE", "NULL", "Scheduled return date for automated reminder alerts (FR21)."],
                 ["consultation_status", "VARCHAR(30)", "'COMPLETED'", "Enum: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."]
             ])
        ]),
        ("Module 10: Hospital REST API Integration", [
            ("hms_api_clients", "Credentials, IP whitelists, and rate limits for hospital management system integration (FR17).",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["client_id", "UUID", "gen_random_uuid()", "PRIMARY KEY."],
                 ["hospital_id", "UUID", "NULL", "FOREIGN KEY (hospitals.hospital_id) ON DELETE CASCADE, NOT NULL."],
                 ["client_name", "VARCHAR(150)", "NULL", "NOT NULL. Integration name (e.g. 'Apollo Main HMS Ingress')."],
                 ["api_key_hash", "VARCHAR(64)", "NULL", "UNIQUE, NOT NULL. Salted SHA-256 hash of API key."],
                 ["api_secret_hash", "VARCHAR(255)", "NULL", "NOT NULL. Salted hash of client secret."],
                 ["allowed_ip_cidrs", "TEXT[]", "'{}'", "IP CIDR whitelist array for Zero Trust ingress."],
                 ["rate_limit_per_minute", "INT", "1000", "NOT NULL. Max requests allowed/min before HTTP 429."],
                 ["client_status", "VARCHAR(30)", "'ACTIVE'", "Enum: ACTIVE, REVOKED, EXPIRED."],
                 ["last_used_at", "TIMESTAMPTZ", "NULL", "Latest transaction timestamp."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."]
             ])
        ]),
        ("Module 11: Real-Time Multi-Channel Notifications", [
            ("notifications", "Event dispatch logs across Email, SMS, Push, and In-App channels for all 6 core platform alerts (FR19).",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["notification_id", "UUID", "gen_random_uuid()", "PRIMARY KEY."],
                 ["user_id", "UUID", "NULL", "FOREIGN KEY (users.user_id) ON DELETE CASCADE, NOT NULL."],
                 ["event_type", "VARCHAR(50)", "NULL", "NOT NULL. Enum: NEW_RECORD_UPLOAD, ACCESS_REQUEST, CONSENT_REQUIRED, EMERGENCY_ACCESS, FLAGGED_REPORT, FOLLOW_UP_REMINDER."],
                 ["channel", "VARCHAR(20)", "'PUSH'", "Enum: EMAIL, SMS, PUSH, IN_APP."],
                 ["title", "VARCHAR(255)", "NULL", "NOT NULL. Alert title."],
                 ["message", "TEXT", "NULL", "NOT NULL. Full alert body text."],
                 ["payload_json", "JSONB", "'{}'", "Deep link and resource metadata (e.g. record_id)."],
                 ["delivery_status", "VARCHAR(30)", "'PENDING'", "Enum: PENDING, DELIVERED, FAILED, READ."],
                 ["delivered_at", "TIMESTAMPTZ", "NULL", "Carrier delivery confirmation timestamp."],
                 ["read_at", "TIMESTAMPTZ", "NULL", "User portal read timestamp."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL."]
             ])
        ]),
        ("Module 12: Immutable Audit & Compliance Logging", [
            ("audit_logs", "7-year immutable ledger tracking all logins, decryptions, consent changes, and API calls (NFR10, OR-04).",
             ["Attribute", "Data Type", "Default", "Constraints / Notes"],
             [
                 ["log_id", "BIGSERIAL", "Sequential", "PRIMARY KEY. Monotonically increasing sequence number."],
                 ["event_id", "UUID", "gen_random_uuid()", "UNIQUE, NOT NULL. Global event trace UUID."],
                 ["user_id", "UUID", "NULL", "FOREIGN KEY (users.user_id) ON DELETE SET NULL."],
                 ["user_role", "VARCHAR(30)", "NULL", "Actor role at moment of action."],
                 ["action", "VARCHAR(60)", "NULL", "NOT NULL. Action: USER_LOGIN, RECORD_UPLOAD, RECORD_VIEW, RECORD_DOWNLOAD, CONSENT_GRANT, CONSENT_REVOKE, BREAK_GLASS_REQUEST, FLAG_RECORD_SUBMIT, HMS_API_CALL."],
                 ["resource_type", "VARCHAR(50)", "NULL", "NOT NULL. Entity: MEDICAL_RECORD, CONSENT, PRESCRIPTION."],
                 ["resource_id", "VARCHAR(100)", "NULL", "Target resource UUID."],
                 ["ip_address", "INET", "NULL", "NOT NULL. Client IP address."],
                 ["user_agent", "TEXT", "NULL", "Client device/browser string."],
                 ["status_code", "INT", "200", "Execution response HTTP status."],
                 ["details", "JSONB", "'{}'", "Context metadata (strictly excludes PHI)."],
                 ["event_sha256_hash", "VARCHAR(64)", "NULL", "NOT NULL. SHA-256 digest of this log entry."],
                 ["previous_log_hash", "VARCHAR(64)", "NULL", "Chained hash of prior row for tamper-evidence."],
                 ["created_at", "TIMESTAMPTZ", "CURRENT_TIMESTAMP", "NOT NULL. Immutable (7-year retention rule)."]
             ])
        ])
    ]
    
    for mod_title, tables in schema_modules:
        h2 = doc.add_heading(level=2)
        r2 = h2.add_run(mod_title)
        r2.font.name = 'Segoe UI'
        r2.font.size = Pt(13)
        r2.font.bold = True
        r2.font.color.rgb = RGBColor(37, 99, 235)
        
        for table_name, table_desc, t_headers, t_data in tables:
            h3 = doc.add_heading(level=3)
            r3 = h3.add_run(f"Table: {table_name}")
            r3.font.name = 'Consolas'
            r3.font.size = Pt(11)
            r3.font.bold = True
            r3.font.color.rgb = RGBColor(15, 23, 42)
            
            p_desc = doc.add_paragraph()
            p_desc.add_run(table_desc).font.italic = True
            
            add_styled_table(doc, t_headers, t_data, col_widths=[1.5, 1.2, 1.2, 2.6], primary_header_color="1E3A8A")

    # -------------------------------------------------------------
    # SECTION 3: DATABASE RULES, CONSTRAINTS & POLICIES
    # -------------------------------------------------------------
    h1 = doc.add_heading(level=1)
    r = h1.add_run("3. Database Rules, Constraints & Policies")
    r.font.name = 'Segoe UI'
    r.font.size = Pt(16)
    r.font.bold = True
    r.font.color.rgb = RGBColor(30, 58, 138)
    
    add_callout(doc, "Rule 1: 7-Year Immutable Audit Logging (NFR10 & DPDP Act)",
                "Audit logs are subject to a PostgreSQL BEFORE UPDATE OR DELETE trigger. Any attempt to modify or purge an existing audit record throws a database exception, ensuring regulatory tamper-evidence and a non-negotiable 7-year minimum retention period.",
                box_type="info")
                
    add_callout(doc, "Rule 2: Sub-10 Millisecond Consent Verification (NFR06 & Redis Cache)",
                "Active patient consents are cached in a distributed Redis Cluster under key 'consent:{patient_id}:{doctor_id}'. Upon consent revocation by a patient, an event is emitted over Kafka to invalidate the Redis key in under 1ms, instantly terminating doctor access across all microservices.",
                box_type="warning")

    # Indexing Strategy Table
    h2 = doc.add_heading(level=2)
    r2 = h2.add_run("High-Performance Indexing Strategy")
    r2.font.name = 'Segoe UI'
    r2.font.size = Pt(13)
    r2.font.bold = True
    r2.font.color.rgb = RGBColor(37, 99, 235)
    
    idx_headers = ["Index Identifier", "Target Table", "Indexed Columns", "Index Type", "SLA & Purpose"]
    idx_data = [
        ["idx_users_email", "users", "email", "B-Tree", "Sub-millisecond login credential resolution."],
        ["idx_patients_aadhaar_hash", "patients", "aadhaar_hash", "B-Tree", "Instant duplicate registration check on Aadhaar hash."],
        ["idx_records_vault_cat", "medical_records", "vault_id, category, is_deleted", "Composite B-Tree", "Accelerated category filtering in Patient Vault views."],
        ["idx_records_tags_gin", "medical_records", "tags", "GIN (Generalized Inverted)", "Multi-keyword tag search and filtering (FR18)."],
        ["idx_records_sha256", "medical_records", "file_sha256_hash", "B-Tree", "Instant cryptographic hash matching against blockchain ledger."],
        ["idx_consents_active_lookup", "consents", "patient_id, doctor_id, consent_status, valid_until", "Composite B-Tree", "Fast fallback query path for consent verification."],
        ["idx_break_glass_active", "break_glass_access_sessions", "patient_id, session_status, session_expires_at", "Composite B-Tree", "Verification of active emergency sessions."],
        ["idx_vitals_patient_trend", "patient_vitals", "patient_id, metric_type, recorded_at DESC", "Composite B-Tree", "Rapid time-series querying for patient trend graphs (FR21)."],
        ["idx_audit_resource", "audit_logs", "resource_type, resource_id, created_at DESC", "Composite B-Tree", "Forensic and regulatory compliance audit searches."]
    ]
    add_styled_table(doc, idx_headers, idx_data, col_widths=[1.5, 1.1, 1.5, 0.9, 1.5], primary_header_color="2563EB")
    
    # -------------------------------------------------------------
    # SECTION 4: ARCHITECT'S DESIGN NOTES
    # -------------------------------------------------------------
    h1 = doc.add_heading(level=1)
    r = h1.add_run("4. Architect's Design Notes")
    r.font.name = 'Segoe UI'
    r.font.size = Pt(16)
    r.font.bold = True
    r.font.color.rgb = RGBColor(30, 58, 138)
    
    notes = [
        ("4.1 India DPDP Act 2023 & Data Residency Compliance",
         "• No Raw Aadhaar Storage: Plaintext Aadhaar numbers are never stored on disk. Only a salted SHA-256 digest is maintained for uniqueness checks, paired with short-lived tokens from official UIDAI DigiLocker OTP workflows.\n"
         "• Right to Erasure / Soft Deletions: Records support an is_deleted flag. Soft deletion hides documents from active search and portal browsing while retaining cryptographic proof in audit logs for clinical liability.\n"
         "• Data Localization: All AWS infrastructure (S3, RDS PostgreSQL, EKS, KMS) is strictly provisioned inside AWS ap-south-1 (Mumbai)."),
        
        ("4.2 Zero Trust Security & AES-256 Envelope Encryption",
         "• Envelope Encryption Pattern: Every medical file is encrypted in memory using a distinct AES-256-GCM Data Encryption Key (DEK). The DEK is encrypted using a Master Key managed by AWS KMS (Key Management Service).\n"
         "• Role Segregation: PostgreSQL and S3 administrators have zero decrypt permissions on AWS KMS master keys, preventing unauthorized internal data extraction (NFR02).\n"
         "• Zero Trust API Pipeline: Every incoming HTTP request must pass through Envoy Gateway where JWT validity, actor role, granular resource permissions, and active session status are validated prior to routing."),
        
        ("4.3 Digital Signatures for Prescriptions (PKI Architecture)",
         "• Asymmetric Cryptography: Registered doctors maintain an RSA-2048 / ECDSA keypair. When writing a prescription, the doctor's client signs the canonical JSON medication payload with their private key.\n"
         "• Public Verification: The signature is stored alongside the prescription. Any hospital, pharmacy, or patient can instantly verify authenticity using the doctor's public key registered in doctors.public_key_pem."),
        
        ("4.4 Emergency Break-Glass Access Protocol",
         "• Dual Verification: Emergency access requires an authorization OTP signed off by an authorized hospital administrative officer or ER shift supervisor.\n"
         "• Time Limits & Scope: Break-Glass tokens have a hard auto-expiry limit of 4 hours and are restricted to life-saving clinical history.\n"
         "• Immediate Patient Alert: An automated high-priority SMS and email alert is immediately delivered to the patient and their designated emergency contacts upon session activation."),
        
        ("4.5 Blockchain Hash Anchoring & Tamper Detection",
         "• Permissioned Hyperledger Fabric: SHA-256 document digests are committed to a private Hyperledger Fabric channel (medilocker-vault). No Personal Health Information (PHI) is ever exposed on the ledger.\n"
         "• Automated Tamper Scans: Periodic background workers compute the SHA-256 digest of files stored in AWS S3 and verify them against the blockchain transaction. Any mismatch triggers an immediate TAMPER_DETECTED alert.")
    ]
    
    for n_title, n_body in notes:
        h2 = doc.add_heading(level=2)
        r2 = h2.add_run(n_title)
        r2.font.name = 'Segoe UI'
        r2.font.size = Pt(12)
        r2.font.bold = True
        r2.font.color.rgb = RGBColor(30, 58, 138)
        
        p = doc.add_paragraph()
        for line in n_body.split("\n"):
            p_line = doc.add_paragraph()
            p_line.paragraph_format.left_indent = Inches(0.2)
            p_line.paragraph_format.space_before = Pt(2)
            p_line.paragraph_format.space_after = Pt(2)
            run = p_line.add_run(line)
            run.font.name = 'Segoe UI'
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(30, 41, 59)
            
    # -------------------------------------------------------------
    # SECTION 5: COMPLETE PROJECT MONOREPO FOLDER STRUCTURE
    # -------------------------------------------------------------
    h1 = doc.add_heading(level=1)
    r = h1.add_run("5. Complete Project Monorepo Folder Structure")
    r.font.name = 'Segoe UI'
    r.font.size = Pt(16)
    r.font.bold = True
    r.font.color.rgb = RGBColor(30, 58, 138)
    
    fs_text = """d:/MediLocker/
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
│   │   └── V1__init_medilocker_schema.sql # 17 tables, custom enums & triggers
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
│   ├── vault-service/                  # Service 2: Medical Vault & S3 Encryption
│   ├── consent-service/                # Service 3: Category Consent & Redis Cache
│   ├── prescription-service/           # Service 4: Prescriptions & Digital Signs
│   ├── hms-integration-service/        # Service 5: Hospital REST APIs (FR17)
│   ├── notification-service/           # Service 6: Kafka Consumer, SMS & Email
│   ├── analytics-service/              # Service 7: Dashboards & Trends (FR21, FR22)
│   └── audit-service/                  # Service 8: 7-Year Immutable Event Logger
├── frontend/                           # React + TypeScript Web Application
│   ├── src/
│   │   ├── components/                 # Reusable UI components & charts
│   │   ├── context/                    # AuthContext, ConsentContext
│   │   ├── hooks/                      # Custom hooks (useVault, useConsent)
│   │   ├── portals/                    # 4 Role-Based Isolated Portals
│   │   │   ├── patient/                # Dashboard, Vault, Consent Manager, Vitals
│   │   │   ├── doctor/                 # Patient Search, Upload, Digital Signer
│   │   │   ├── hospital/               # HMS API Console, Staff Verifications
│   │   │   └── admin/                  # Verification Queue, Flagged Reports
│   │   ├── services/                   # Axios API Clients
│   │   ├── types/                      # TypeScript definitions for all DB models
│   │   ├── App.tsx                     # React Router with Role-Based Route Guards
│   │   └── index.css                   # Modern CSS design system
│   └── vite.config.ts
├── docs/                               # System Documentation & SRS
│   ├── MediLocker_Database_Schema_and_System_Architecture.docx
│   └── DATABASE_SCHEMA_AND_ARCHITECTURE.md
└── README.md"""

    p_fs = doc.add_paragraph()
    p_fs.paragraph_format.left_indent = Inches(0.2)
    p_fs.paragraph_format.space_before = Pt(6)
    p_fs.paragraph_format.space_after = Pt(6)
    
    # Table container for code block styling
    fs_table = doc.add_table(rows=1, cols=1)
    fs_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    fs_cell = fs_table.cell(0, 0)
    fs_cell.width = Inches(6.5)
    set_cell_background(fs_cell, "0F172A") # Slate 900 dark background
    set_cell_margins(fs_cell, top=140, bottom=140, left=180, right=180)
    
    p_code = fs_cell.paragraphs[0]
    run_code = p_code.add_run(fs_text)
    run_code.font.name = 'Consolas'
    run_code.font.size = Pt(8)
    run_code.font.color.rgb = RGBColor(241, 245, 249) # Light slate
    
    # Output file paths
    os.makedirs("d:/MediLocker/docs", exist_ok=True)
    output_path = "d:/MediLocker/MediLocker_Database_Schema_and_System_Architecture.docx"
    doc_copy_path = "d:/MediLocker/docs/MediLocker_Database_Schema_and_System_Architecture.docx"
    
    doc.save(output_path)
    doc.save(doc_copy_path)
    print(f"Successfully generated DOCX at {output_path} and {doc_copy_path}")

if __name__ == "__main__":
    build_document()
