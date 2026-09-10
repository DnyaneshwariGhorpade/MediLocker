import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
import os

def set_cell_background(cell, fill_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}>'
                      f'<w:top w:w="{top}" w:type="dxa"/>'
                      f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
                      f'<w:left w:w="{left}" w:type="dxa"/>'
                      f'<w:right w:w="{right}" w:type="dxa"/>'
                      f'</w:tcMar>')
    tcPr.append(tcMar)

def set_table_borders(table, color="CBD5E1"):
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
    table = doc.add_table(rows=len(data) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table)
    
    header_tr = table.rows[0]._tr.get_or_add_trPr()
    header_tr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

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
            
            run = p.add_run(str(cell_value))
            run.font.name = 'Segoe UI'
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(30, 41, 59)
            
            if col_idx in (0, 1):
                if col_idx == 0:
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(15, 23, 42)
                elif col_idx == 1 and cell_value.startswith("/"):
                    run.font.name = 'Consolas'
                    run.font.size = Pt(8.5)
                    run.font.color.rgb = RGBColor(37, 99, 235)
                
    if col_widths:
        for row in table.rows:
            for col_idx, width in enumerate(col_widths):
                row.cells[col_idx].width = Inches(width)
                
    doc.add_paragraph()
    return table

def add_screen_card(doc, screen_name, route, role, objective, features_list, apis_list):
    """Creates a high-visibility card for a specific screen with features and API endpoints"""
    h3 = doc.add_heading(level=3)
    r3 = h3.add_run(screen_name)
    r3.font.name = 'Segoe UI'
    r3.font.size = Pt(12)
    r3.font.bold = True
    r3.font.color.rgb = RGBColor(30, 58, 138)
    
    # Metadata badge table
    meta_table = doc.add_table(rows=1, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    c1, c2 = meta_table.cell(0, 0), meta_table.cell(0, 1)
    c1.width, c2.width = Inches(3.2), Inches(3.3)
    set_cell_background(c1, "F1F5F9")
    set_cell_background(c2, "F1F5F9")
    set_cell_margins(c1, 80, 80, 120, 120)
    set_cell_margins(c2, 80, 80, 120, 120)
    
    p1 = c1.paragraphs[0]
    r_r1 = p1.add_run("Route: ")
    r_r1.font.bold = True
    r_r1.font.size = Pt(8.5)
    r_r2 = p1.add_run(route)
    r_r2.font.name = 'Consolas'
    r_r2.font.size = Pt(8.5)
    r_r2.font.color.rgb = RGBColor(37, 99, 235)
    
    p2 = c2.paragraphs[0]
    r_a1 = p2.add_run("Target Role: ")
    r_a1.font.bold = True
    r_a1.font.size = Pt(8.5)
    r_a2 = p2.add_run(role)
    r_a2.font.size = Pt(8.5)
    r_a2.font.color.rgb = RGBColor(13, 148, 136) # Teal
    
    # Objective
    p_obj = doc.add_paragraph()
    p_obj.paragraph_format.space_before = Pt(4)
    p_obj.paragraph_format.space_after = Pt(4)
    r_o1 = p_obj.add_run("Objective: ")
    r_o1.font.bold = True
    r_o1.font.size = Pt(9.5)
    r_o2 = p_obj.add_run(objective)
    r_o2.font.size = Pt(9.5)
    r_o2.font.italic = True
    
    # Features List
    p_f_header = doc.add_paragraph()
    p_f_header.paragraph_format.space_before = Pt(2)
    p_f_header.paragraph_format.space_after = Pt(2)
    rf = p_f_header.add_run("Key Features & Interactive Elements:")
    rf.font.bold = True
    rf.font.size = Pt(9.5)
    rf.font.color.rgb = RGBColor(15, 23, 42)
    
    for feat in features_list:
        p_item = doc.add_paragraph()
        p_item.paragraph_format.left_indent = Inches(0.25)
        p_item.paragraph_format.space_before = Pt(1)
        p_item.paragraph_format.space_after = Pt(1)
        r_bullet = p_item.add_run("• ")
        r_bullet.font.bold = True
        r_bullet.font.color.rgb = RGBColor(37, 99, 235)
        r_text = p_item.add_run(feat)
        r_text.font.size = Pt(9)
        r_text.font.color.rgb = RGBColor(30, 41, 59)
        
    # APIs Triggered
    if apis_list:
        p_api = doc.add_paragraph()
        p_api.paragraph_format.space_before = Pt(3)
        p_api.paragraph_format.space_after = Pt(8)
        p_api.paragraph_format.left_indent = Inches(0.1)
        ra_title = p_api.add_run("Triggered Backend APIs: ")
        ra_title.font.bold = True
        ra_title.font.size = Pt(8.5)
        ra_title.font.color.rgb = RGBColor(100, 116, 139)
        for i, api in enumerate(apis_list):
            ra = p_api.add_run(f"[{api}]" + (", " if i < len(apis_list)-1 else ""))
            ra.font.name = 'Consolas'
            ra.font.size = Pt(8)
            ra.font.color.rgb = RGBColor(15, 23, 42)
            
    doc.add_paragraph() # Spacing

def build_feature_map_doc():
    doc = docx.Document()
    
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)
        
    # Title
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    title_run = title_p.add_run("MediLocker")
    title_run.font.name = 'Segoe UI'
    title_run.font.size = Pt(26)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(30, 58, 138)
    
    subtitle_p = doc.add_paragraph()
    subtitle_p.paragraph_format.space_before = Pt(0)
    subtitle_p.paragraph_format.space_after = Pt(14)
    sub_run = subtitle_p.add_run("Role-Wise & Page-Wise Feature Map — Every Screen, Every Feature\n")
    sub_run.font.name = 'Segoe UI'
    sub_run.font.size = Pt(13)
    sub_run.font.bold = True
    sub_run.font.color.rgb = RGBColor(37, 99, 235)
    
    desc_run = subtitle_p.add_run("Comprehensive UI/UX Functional Map, Role Taxonomy, Interactive Elements & Backend API Triggers")
    desc_run.font.name = 'Segoe UI'
    desc_run.font.size = Pt(10)
    desc_run.font.italic = True
    desc_run.font.color.rgb = RGBColor(100, 116, 139)
    
    # -------------------------------------------------------------
    # SECTION 1: PUBLIC & AUTHENTICATION SCREENS
    # -------------------------------------------------------------
    h1 = doc.add_heading(level=1)
    r = h1.add_run("1. Public & Authentication Screens")
    r.font.name = 'Segoe UI'
    r.font.size = Pt(16)
    r.font.bold = True
    r.font.color.rgb = RGBColor(30, 58, 138)
    
    add_screen_card(
        doc,
        "Screen 1.1: Landing & Universal Authentication Portal",
        "/login",
        "Public / All User Roles",
        "Provide universal zero-trust authentication, identifier resolution, and multi-factor authentication (MFA).",
        [
            "Hero Navigation Bar: Features, DPDP Act & ABDM compliance overview, and role onboarding CTA buttons.",
            "Unified Login Form: Accepts Email, Phone Number, or Masked Vault Number (ML-2026-XXXX) with real-time field validation.",
            "Anti-Brute Force Protection: Progressive delays, captcha after 3 invalid attempts, and lockout at 5 failed attempts.",
            "Multi-Factor Authentication (MFA) Dialog: Mandatory 6-digit TOTP / SMS OTP prompt with auto-advancing inputs and 60-second resend timer.",
            "Role Routing Engine: Reads authenticated JWT role claim and routes automatically to designated role portal."
        ],
        ["POST /api/v1/auth/login", "POST /api/v1/auth/verify-mfa"]
    )
    
    add_screen_card(
        doc,
        "Screen 1.2: Patient Registration & Aadhaar KYC",
        "/register/patient",
        "Public / Prospective Patients",
        "Register new patients, execute privacy-preserving Aadhaar KYC, and provision lifelong digital vaults (FR01, FR06).",
        [
            "Aadhaar Number Input: 12-digit input with client-side Verhoeff checksum. Raw Aadhaar is never stored; only salted SHA-256 hash is saved.",
            "UIDAI DigiLocker OTP Trigger: Initiates OTP verification flow via ABDM sandbox gateway.",
            "Demographics Form: First Name, Last Name, Date of Birth (calendar picker), Gender, Blood Group, and encrypted Address fields.",
            "Emergency Contact Setup: Name, phone, and relationship dropdown with default Break-Glass emergency sharing preference checkbox.",
            "Security & MFA Setup: Email/Phone verification and mandatory TOTP authenticator QR code generation.",
            "Automated Vault Provisioning: Creates lifelong digital vault account with unique masked number (ML-2026-XXXX)."
        ],
        ["POST /api/v1/auth/patient/send-aadhaar-otp", "POST /api/v1/auth/patient/register"]
    )

    add_screen_card(
        doc,
        "Screen 1.3: Doctor Registration & Asymmetric Keypair Generator",
        "/register/doctor",
        "Public / Medical Practitioners",
        "Collect Medical Registration Numbers (MRN), state medical councils, hospital affiliations, and generate RSA-2048 signing keys (FR02, FR16).",
        [
            "Clinical Credentials Intake: First Name, Last Name, MRN, State Medical Council dropdown, Specialization, and Qualifications.",
            "Hospital Affiliation Selector: Searchable dropdown linked to verified clinical establishments.",
            "Identity Proof Document Upload: Secure dropzone for Council Registration Certificate and Government Photo ID.",
            "Browser PKI Keypair Generation: Generates RSA-2048 / ECDSA keypair in-browser. Private key is downloaded to local secure keystore; public key PEM and SHA-256 fingerprint are registered on server.",
            "Pending Verification Status Screen: Shows waiting room banner pending verification by hospital and platform administrators."
        ],
        ["POST /api/v1/auth/doctor/register", "POST /api/v1/auth/doctor/upload-credentials"]
    )

    add_screen_card(
        doc,
        "Screen 1.4: Hospital Registration & Clinical Establishment Onboarding",
        "/register/hospital",
        "Public / Hospital Management",
        "Register healthcare institutions under the Clinical Establishment Act (FR03).",
        [
            "Institution Profile: Hospital Name, CEA Registration ID, Hospital Type (Multi-specialty, Clinic, Lab), Email, Phone, and Address.",
            "Hospital Administrator Profile: Designation, official email, and credentials of appointed administrator.",
            "License Document Dropzone: Upload official establishment licenses for administrative validation."
        ],
        ["POST /api/v1/auth/hospital/register"]
    )

    add_screen_card(
        doc,
        "Screen 1.5: Public Prescription & Document Authenticity Verifier",
        "/verify",
        "Public / Pharmacies & Third Parties (No Login Required)",
        "Verify cryptographic RSA-2048 doctor signatures on prescriptions and SHA-256 blockchain tamper status (FR14, FR16).",
        [
            "Tab 1 - Verify Digital Prescription: Upload signed PDF prescription or paste canonical JSON + Base64 signature. Checks against doctor's public key; displays doctor name, MRN, hospital, and timestamp.",
            "Tab 2 - Verify Blockchain Tamper-Proof Hash: Upload any medical report file. Calculates client-side SHA-256 digest and compares with Hyperledger Fabric ledger; reports Block Number, Transaction ID, and match status."
        ],
        ["POST /api/v1/public/verify-prescription", "POST /api/v1/public/verify-hash"]
    )

    # -------------------------------------------------------------
    # SECTION 2: PATIENT PORTAL SCREENS
    # -------------------------------------------------------------
    h1 = doc.add_heading(level=1)
    r = h1.add_run("2. Patient Portal Screens (/patient/*)")
    r.font.name = 'Segoe UI'
    r.font.size = Pt(16)
    r.font.bold = True
    r.font.color.rgb = RGBColor(30, 58, 138)

    add_screen_card(
        doc,
        "Screen 2.1: Patient Dashboard",
        "/patient/dashboard",
        "Patient",
        "Unified health overview with medical timeline, biometric trends, quick actions, and follow-up reminders (FR21).",
        [
            "Patient Profile Header: Displays name, blood group, age, and masked Vault ID (ML-2026-XXXX) with QR code generator.",
            "Interactive Health Trend Charts: Dual-line Blood Pressure chart (Systolic/Diastolic) and Blood Sugar chart (Fasting/PP) with time range filters (1W, 1M, 3M, 1Y).",
            "Medical Timeline Stream: Chronological feed of recent doctor consultations, blood tests, X-rays, and prescriptions.",
            "Follow-up Reminders Widget: Highlights upcoming physician appointments with countdown badges.",
            "Active Consents Summary: Real-time count of active doctors with access and expiring consent alerts."
        ],
        ["GET /api/v1/patient/dashboard-summary", "GET /api/v1/patient/vitals/trends"]
    )

    add_screen_card(
        doc,
        "Screen 2.2: Lifelong Medical Vault",
        "/patient/vault",
        "Patient",
        "Comprehensive repository of all patient medical records with category filtering, AES-256 decryption, and preview (FR06, FR07, FR15).",
        [
            "Category Filter Chips: Filter by 12 categories (Prescriptions, Blood Reports, X-Rays, MRI, CT Scans, Vaccinations, Allergies, Surgeries, Discharge Summaries, Chronic History, Sensitive Reports).",
            "Multi-Attribute Search Bar: Search by title, diagnosis, doctor, hospital, date range, and tags.",
            "Record Grid & Cards: Displays document metadata, version tags, file format/size, and blockchain verification badge.",
            "In-Browser AES-256 Decryption Viewer: Fetches encrypted file and KMS wrapped key; decrypts in memory for secure viewing without saving unencrypted files to disk.",
            "Record Action Menu: Download decrypted copy, view blockchain transaction details, flag disputed record, or manage category sharing."
        ],
        ["GET /api/v1/vault/records", "POST /api/v1/vault/records/:id/decrypt", "GET /api/v1/vault/records/:id/blockchain-proof"]
    )

    add_screen_card(
        doc,
        "Screen 2.3: Granular Consent Management Hub",
        "/patient/consent",
        "Patient",
        "Grant, customize, block, and instantly revoke doctor access at category granularity (FR09, FR10, FR11).",
        [
            "Active Consents List: Cards showing doctor name, specialty, hospital, allowed categories, blocked categories, and expiration date.",
            "Instant Revocation Button (Red CTA): 1-click cancellation that updates PostgreSQL and evicts Redis token cache in <1ms.",
            "Grant New Consent Drawer: Search doctor by MRN/Name, select allowed categories, select blocked categories (e.g. Psychiatric/HIV), set expiration (24h, 7d, 30d, Custom), and choose access level (Read Only vs Download).",
            "Consent History & Revocation Audit Table: Immutable log of expired, revoked, and rejected access requests."
        ],
        ["GET /api/v1/consent/active", "POST /api/v1/consent/grant", "POST /api/v1/consent/:id/revoke", "GET /api/v1/consent/history"]
    )

    add_screen_card(
        doc,
        "Screen 2.4: Health Telemetry & Vitals Tracker",
        "/patient/vitals",
        "Patient",
        "Log biometric vitals and visualize long-term trends (FR21).",
        [
            "Vitals Logging Form: Metric selector (BP, Fasting/PP Sugar, Pulse, SpO2, Weight, Temp), numerical inputs, reading context dropdown, and date picker.",
            "Interactive Trend Visualizers: Chart.js graphs with color-coded normal, borderline, and critical clinical threshold zones.",
            "Historical Telemetry Log: Table of past readings with CSV/PDF export capability for consultations."
        ],
        ["POST /api/v1/patient/vitals", "GET /api/v1/patient/vitals"]
    )

    add_screen_card(
        doc,
        "Screen 2.5: Consultation History & Timeline",
        "/patient/consultations",
        "Patient",
        "Chronological clinical encounter history with linked prescriptions and follow-ups (FR21).",
        [
            "Consultation Stream: Grouped by year and month with doctor name, hospital, chief complaints, and diagnosis summary.",
            "Linked Prescriptions & Tests: Quick action buttons to view signed prescriptions or open ordered lab tests.",
            "Follow-up Date Badge: Highlights future checkups."
        ],
        ["GET /api/v1/patient/consultations"]
    )

    add_screen_card(
        doc,
        "Screen 2.6: Real-Time Notification Center",
        "/patient/notifications",
        "Patient",
        "Real-time alerts for record uploads, access requests, break-glass events, and flags (FR19).",
        [
            "Channel Filters: All, Unread, Access Requests, New Uploads, Emergency Alerts, Flags.",
            "Notification Cards: Rich interactive alerts for all 6 core events with action buttons (e.g. [Grant Access], [View Emergency Audit]).",
            "Bulk Actions: Mark as read, mark all as read, and clear notifications."
        ],
        ["GET /api/v1/notifications", "PATCH /api/v1/notifications/:id/read", "POST /api/v1/notifications/mark-all-read"]
    )

    add_screen_card(
        doc,
        "Screen 2.7: Profile & Emergency Settings",
        "/patient/settings",
        "Patient",
        "Manage demographics, emergency contacts, Break-Glass sharing preferences, and sessions.",
        [
            "Demographics & Address: Update address, view verified Aadhaar KYC badge.",
            "Break-Glass Emergency Configuration: Emergency contact details and master emergency sharing toggle.",
            "Security & Active Sessions: Password change, TOTP MFA manager, and list of active devices with 1-click remote logout."
        ],
        ["GET /api/v1/patient/profile", "PUT /api/v1/patient/profile", "PUT /api/v1/patient/emergency-settings"]
    )

    # -------------------------------------------------------------
    # SECTION 3: DOCTOR PORTAL SCREENS
    # -------------------------------------------------------------
    h1 = doc.add_heading(level=1)
    r = h1.add_run("3. Doctor Portal Screens (/doctor/*)")
    r.font.name = 'Segoe UI'
    r.font.size = Pt(16)
    r.font.bold = True
    r.font.color.rgb = RGBColor(30, 58, 138)

    add_screen_card(
        doc,
        "Screen 3.1: Doctor Dashboard",
        "/doctor/dashboard",
        "Doctor",
        "Doctor clinical workspace for appointments, uploads, active consents, and quick search (FR22).",
        [
            "Doctor Metrics: Total patients treated, uploads this month, active patient consents, and open flagged disputes.",
            "Quick Patient Search: Search by Patient Vault Number (ML-2026-XXXX) or registered phone number.",
            "Today's Appointment Schedule: List of scheduled consultations with quick action to open clinical encounter logger.",
            "Recent Digital Prescriptions: List of recently signed prescriptions with signature verification badges."
        ],
        ["GET /api/v1/doctor/dashboard-summary"]
    )

    add_screen_card(
        doc,
        "Screen 3.2: Patient Search & Consent-Gated Record Browser",
        "/doctor/patients",
        "Doctor",
        "Look up patients and browse medical records strictly filtered by active consent categories (FR09, FR10).",
        [
            "Patient Identifier Search: Lookup by Vault Number or mobile number.",
            "Consent Evaluation Banner: Displays active granted categories, expiration timer, or 'Request Consent' trigger if no consent exists.",
            "Consented Record Browser: Displays only authorized document categories with in-memory AES-256 decryption viewer for PDFs, lab reports, and DICOM radiology scans."
        ],
        ["POST /api/v1/doctor/check-consent", "POST /api/v1/doctor/request-consent", "GET /api/v1/doctor/patient-records/:vaultNumber"]
    )

    add_screen_card(
        doc,
        "Screen 3.3: Medical Record Uploader & Categorizer",
        "/doctor/upload",
        "Doctor",
        "Upload records, auto-categorize, generate SHA-256 hashes, and encrypt via AES-256 envelope encryption (FR07, FR08, FR13, FR15).",
        [
            "Patient Selector: Select active patient from consultation queue or enter Vault Number.",
            "Drag & Drop Dropzone: PDF, JPEG, PNG, DICOM (max 50MB) with pre-upload SHA-256 hash calculation.",
            "Metadata Form: Document Title, Category dropdown (12 types), Clinical Diagnosis, Record Date, and multi-tag chip selector.",
            "Version Control: Select 'New Record (v1)' or 'Addendum / Revision (v2+)' linking to previous document ID.",
            "Encryption & Blockchain Pipeline: Encrypts file with AES-256-GCM DEK, wraps DEK via AWS KMS, uploads to S3, and commits SHA-256 hash to Hyperledger Fabric."
        ],
        ["POST /api/v1/vault/upload", "POST /api/v1/vault/anchor-blockchain"]
    )

    add_screen_card(
        doc,
        "Screen 3.4: Digital Prescription Studio & PKI Signer",
        "/doctor/prescriptions/new",
        "Doctor",
        "Draft structured clinical prescriptions and apply asymmetric RSA-2048 digital signatures (FR16).",
        [
            "Patient Header: Patient name, age, gender, and red known allergies alert banner.",
            "Medication Repeater Table: Dynamic rows with Drug Name, Strength, Frequency (1-0-1, SOS), Duration, and Instructions (After food).",
            "Clinical Advice & Precautions: Dietary instructions, test recommendations, and precautions rich text field.",
            "Follow-up Date Picker: Schedules automated reminder alerts.",
            "PKI Digital Signature Dialog: Prompts doctor to confirm with private key; calculates RSA-2048 signature over SHA-256 payload hash, stores in prescriptions table, and generates PDF with verification QR code."
        ],
        ["POST /api/v1/doctor/prescriptions/sign-and-issue"]
    )

    add_screen_card(
        doc,
        "Screen 3.5: Consultation Encounter Logger",
        "/doctor/consultation/log",
        "Doctor",
        "Record clinical consultation notes, chief complaints, physical findings, and link prescriptions (FR22).",
        [
            "Chief Complaints Intake: Form for presenting symptoms and duration.",
            "Physical Examination: Vitals recording and systemic findings.",
            "Diagnosis Summary: Provisional or confirmed clinical diagnosis.",
            "Linked Actions: Shortcut to create Digital Prescription and schedule follow-up."
        ],
        ["POST /api/v1/doctor/consultations"]
    )

    add_screen_card(
        doc,
        "Screen 3.6: Smart Search & Medical Filter Engine",
        "/doctor/search",
        "Doctor",
        "Filter consented records across document type, diagnosis, hospital, date, and tags (FR18).",
        [
            "Multi-Filter Panel: Document type checkboxes, diagnosis keyword search, hospital dropdown, date range picker, and tags.",
            "Highlighted Results Grid: Instant filtered view with keyword match snippets."
        ],
        ["GET /api/v1/doctor/records/search"]
    )

    add_screen_card(
        doc,
        "Screen 3.7: Record Flagging & Quality Dispute Form",
        "/doctor/flag",
        "Doctor",
        "Flag incorrect, illegible, or duplicate documents for administrative resolution (FR20).",
        [
            "Document Selector: Pick from patient's consented records.",
            "Flag Reason Dropdown: Incorrect info, duplicate, wrong prescription, illegible, expired, missing pages.",
            "Dispute Notes: Detailed description of defect; submits to record_flags and sets status to FLAGGED."
        ],
        ["POST /api/v1/doctor/records/flag"]
    )

    # -------------------------------------------------------------
    # SECTION 4: HOSPITAL HMS & EMERGENCY SCREENS
    # -------------------------------------------------------------
    h1 = doc.add_heading(level=1)
    r = h1.add_run("4. Hospital HMS & Emergency Physician Screens")
    r.font.name = 'Segoe UI'
    r.font.size = Pt(16)
    r.font.bold = True
    r.font.color.rgb = RGBColor(30, 58, 138)

    add_screen_card(
        doc,
        "Screen 4.1: Hospital Admin Dashboard",
        "/hospital/dashboard",
        "Hospital Admin",
        "Hospital operations, active doctor roster, HMS ingress statistics, and storage monitoring (FR23).",
        [
            "KPI Tiles: Verified Staff Doctors, Today's Bulk HMS Uploads, Admitted Patients Consulted, Open Flagged Disputes.",
            "HMS Ingress Graph: Real-time traffic monitor of automated API uploads.",
            "Recent Staff Verifications & Break-Glass Approvals Feed."
        ],
        ["GET /api/v1/hospital/dashboard-summary"]
    )

    add_screen_card(
        doc,
        "Screen 4.2: Doctor Staff Directory & Verification",
        "/hospital/doctors",
        "Hospital Admin",
        "Manage affiliated doctors and approve medical staff registrations (FR02).",
        [
            "Doctor Staff Table: Name, MRN, Council, Specialization, Status (Verified, Pending, Suspended), and Public Key Fingerprint.",
            "Doctor Approval Modal: Inspect doctor credentials and approve/reject hospital affiliation."
        ],
        ["GET /api/v1/hospital/doctors", "POST /api/v1/hospital/doctors/:id/approve", "POST /api/v1/hospital/doctors/:id/revoke"]
    )

    add_screen_card(
        doc,
        "Screen 4.3: HMS REST API Console & Key Management",
        "/hospital/api-console",
        "Hospital Admin",
        "Manage HMS integration keys, IP CIDR whitelisting, rate limits, and view API documentation (FR17).",
        [
            "API Key Manager: Generate, rotate, and revoke REST API keys. Displays secret once and stores salted SHA-256 hash in hms_api_clients.",
            "IP CIDR Whitelist: Enforce static IP ranges for hospital server ingress.",
            "Interactive Swagger / OpenAPI Documentation for 5 standard endpoints: POST /uploadRecord, GET /patientHistory, POST /grantAccess, POST /revokeAccess, GET /medicalTimeline."
        ],
        ["GET /api/v1/hms/clients", "POST /api/v1/hms/clients/generate-key", "PUT /api/v1/hms/clients/ip-whitelist"]
    )

    add_screen_card(
        doc,
        "Screen 4.4: Emergency Break-Glass 2-Factor Approver",
        "/hospital/emergency-verify",
        "Hospital Admin / ER Shift Supervisor",
        "Mandatory 2nd-factor approval authority for emergency physician Break-Glass requests (FR12).",
        [
            "Pending Requests Queue: Requesting doctor name, patient identifier, clinical justification, timestamp, and terminal IP.",
            "2-Factor Authorization Modal: Supervisor verifies emergency validity and submits administrative OTP to issue 4-hour temporary token.",
            "Active Emergency Sessions Monitor: Real-time countdown timer with 1-click 'Terminate Session Early' button."
        ],
        ["GET /api/v1/emergency/pending-requests", "POST /api/v1/emergency/approve", "POST /api/v1/emergency/terminate"]
    )

    add_screen_card(
        doc,
        "Screen 4.5: Emergency Break-Glass Request Form",
        "/emergency/request",
        "Emergency Physician",
        "Initiate emergency override for unresponsive/unconscious patients (FR12).",
        [
            "Patient Identification: Search by Vault Number (ML-2026-XXXX), Aadhaar Hash, or Mobile Number.",
            "Mandatory Clinical Justification: Detailed clinical intake (minimum 50 characters).",
            "Dual-Factor OTP Trigger: Dispatches real-time approval request to on-duty Hospital Administrator."
        ],
        ["POST /api/v1/emergency/initiate-request"]
    )

    add_screen_card(
        doc,
        "Screen 4.6: Time-Limited Emergency Patient Record Viewer",
        "/emergency/session/:sessionId",
        "Emergency Physician",
        "Access life-saving clinical history with 4-hour countdown timer and full forensic audit logging (FR12, NFR10).",
        [
            "Persistent Top Emergency Banner: Red alert bar with live countdown timer (e.g. 03:45:12) and confirmation that patient/kin was alerted.",
            "Critical Medical Snapshot: Immediate visibility into Allergies, Blood Group, Chronic Conditions, and Active Medications.",
            "Emergency Document Browser: Access to past scans and discharge summaries with individual access logging in break_glass_record_accesses.",
            "Manual Session Termination: Ends session immediately upon clinical stabilization."
        ],
        ["GET /api/v1/emergency/session/:id/data", "POST /api/v1/emergency/session/:id/terminate"]
    )

    # -------------------------------------------------------------
    # SECTION 5: PLATFORM ADMINISTRATOR SCREENS
    # -------------------------------------------------------------
    h1 = doc.add_heading(level=1)
    r = h1.add_run("5. Platform Administrator Screens (/admin/*)")
    r.font.name = 'Segoe UI'
    r.font.size = Pt(16)
    r.font.bold = True
    r.font.color.rgb = RGBColor(30, 58, 138)

    add_screen_card(
        doc,
        "Screen 5.1: Admin Central Command Dashboard",
        "/admin/dashboard",
        "Platform Administrator",
        "Platform-wide monitoring of registered users, storage, blockchain commits, and system metrics (FR23).",
        [
            "Platform Metrics: Registered Patients, Verified Hospitals, Verified Doctors, AWS S3 Storage (ap-south-1), Total Blockchain Anchors, and Pending Verifications Queue count.",
            "Platform Usage & Ingress Trends: Interactive charts of daily uploads, active logins, and consent events.",
            "Security Incident Alert Box: Highlights blockchain hash mismatches or failed emergency attempts."
        ],
        ["GET /api/v1/admin/platform-stats"]
    )

    add_screen_card(
        doc,
        "Screen 5.2: Hospital Verification Queue",
        "/admin/verifications/hospitals",
        "Platform Administrator",
        "Audit and approve registered hospitals and clinical establishments (FR03).",
        [
            "Pending Hospitals Table: Name, CEA Registration ID, Hospital Type, Email, City, State, and Application Date.",
            "Inspection Drawer: View submitted Clinical Establishment Act license documents.",
            "Action Buttons: Approve & Activate Hospital, Request More Info, Reject Application."
        ],
        ["GET /api/v1/admin/hospitals/pending", "POST /api/v1/admin/hospitals/:id/verify", "POST /api/v1/admin/hospitals/:id/reject"]
    )

    add_screen_card(
        doc,
        "Screen 5.3: Doctor License Verification Queue",
        "/admin/verifications/doctors",
        "Platform Administrator",
        "Verify doctor Medical Registration Numbers (MRN) with State Medical Councils (FR02).",
        [
            "Pending Doctors Table: Doctor Name, MRN, State Medical Council, Specialization, Affiliated Hospital, Public Key Fingerprint.",
            "License Inspection Drawer: View uploaded Medical Council certificate and Government Photo ID.",
            "Action Buttons: Verify & Activate Doctor, Reject Application."
        ],
        ["GET /api/v1/admin/doctors/pending", "POST /api/v1/admin/doctors/:id/verify", "POST /api/v1/admin/doctors/:id/reject"]
    )

    add_screen_card(
        doc,
        "Screen 5.4: Record Flagging & Dispute Resolution Center",
        "/admin/disputes",
        "Platform Administrator",
        "Adjudicate disputed, duplicate, or defective medical records with 4-state lifecycle tracking (FR20).",
        [
            "Dispute Queue Tabs: Filter by Flagged, Under Review, and Resolved.",
            "Dispute Adjudication Studio: Side-by-side document inspector, metadata viewer, and submitter notes.",
            "Status & Action Selector: Status transitions (Normal -> Flagged -> Under Review -> Resolved) and actions (Validate Correct, Replace Version, Reject Flag, Archive Record).",
            "Auto-Notification: Updates record_flags and notifies patient and doctor via SMS/Email."
        ],
        ["GET /api/v1/admin/disputes", "PUT /api/v1/admin/disputes/:id/resolve"]
    )

    add_screen_card(
        doc,
        "Screen 5.5: 7-Year Immutable Audit Log Explorer",
        "/admin/audit-logs",
        "Platform Administrator",
        "Forensic query tool for immutable compliance logs (NFR10, OR-04, DPDP Act 2023).",
        [
            "Search & Filter Panel: Actor User ID, Role, Action (Login, Upload, View, Download, Consent Grant/Revoke, Break Glass), Resource Type/ID, IP Address, Date Range.",
            "Immutable Audit Journal Table: Monotonic Log ID, Event UUID, Timestamp, Actor Name/Role, Action, Resource Type, Client IP, Status Code.",
            "Chained Hash Verification: Confirms event_sha256_hash matches cryptographic chain against previous_log_hash.",
            "Compliance Report Export: Export digitally signed audit ledger as CSV/JSON for Data Protection Board compliance."
        ],
        ["GET /api/v1/admin/audit-logs", "POST /api/v1/admin/audit-logs/export"]
    )

    add_screen_card(
        doc,
        "Screen 5.6: System Health, Kafka & Blockchain Ledger Explorer",
        "/admin/system-health",
        "Platform Administrator",
        "Real-time infrastructure health, microservices status, Redis cache hit rates, Kafka lag, and Hyperledger Fabric blocks (NFR07, NFR08, NFR09).",
        [
            "8 Microservices Status Grid: Auth, Vault, Consent, Prescription, HMS, Notification, Analytics, Audit Services with CPU, RAM, and Pod Replicas.",
            "Redis Telemetry: Cache Hit Ratio (>98%) and sub-10ms latency tracker (NFR06).",
            "Kafka Topic Stream: Message throughput and consumer lag across audit and notification topics.",
            "Hyperledger Fabric Block Explorer: Latest Block Number, Block Hash, Transaction Count, and Peer Node health."
        ],
        ["GET /api/v1/admin/system-health", "GET /api/v1/admin/blockchain/blocks"]
    )

    # -------------------------------------------------------------
    # SECTION 6: SUMMARY TRACEABILITY MATRIX
    # -------------------------------------------------------------
    h1 = doc.add_heading(level=1)
    r = h1.add_run("6. Summary Traceability Matrix: Screens to Requirements")
    r.font.name = 'Segoe UI'
    r.font.size = Pt(16)
    r.font.bold = True
    r.font.color.rgb = RGBColor(30, 58, 138)
    
    matrix_headers = ["Role", "Screen Name", "Route", "Requirements Traced"]
    matrix_data = [
        ["Public", "Universal Authentication & MFA", "/login", "FR04, NFR03, NFR04"],
        ["Public", "Patient Registration & Aadhaar KYC", "/register/patient", "FR01, FR06, NFR11, NFR13"],
        ["Public", "Doctor Registration & Keypair Generation", "/register/doctor", "FR02, FR16"],
        ["Public", "Hospital CEA Registration", "/register/hospital", "FR03"],
        ["Public", "Public Prescription & Hash Verifier", "/verify", "FR14, FR16"],
        ["Patient", "Patient Dashboard & Vitals Trends", "/patient/dashboard", "FR21, NFR05"],
        ["Patient", "Lifelong Medical Vault & Decryption Viewer", "/patient/vault", "FR06, FR07, FR08, FR15, FR18"],
        ["Patient", "Granular Consent & Instant Revocation Hub", "/patient/consent", "FR09, FR10, FR11, NFR06"],
        ["Patient", "Health Telemetry & Vitals Logger", "/patient/vitals", "FR21"],
        ["Patient", "Consultation History & Clinical Timeline", "/patient/consultations", "FR21"],
        ["Patient", "Real-Time Notification Center", "/patient/notifications", "FR19"],
        ["Patient", "Profile & Emergency Settings", "/patient/settings", "FR01, FR12"],
        ["Doctor", "Doctor Dashboard", "/doctor/dashboard", "FR22"],
        ["Doctor", "Patient Search & Consent-Gated Browser", "/doctor/patients", "FR09, FR10, FR15"],
        ["Doctor", "Medical Record Uploader & Categorizer", "/doctor/upload", "FR07, FR08, FR13, FR15"],
        ["Doctor", "Digital Prescription Studio & PKI Signer", "/doctor/prescriptions/new", "FR16"],
        ["Doctor", "Consultation Encounter Logger", "/doctor/consultation/log", "FR22"],
        ["Doctor", "Smart Search & Medical Filter Engine", "/doctor/search", "FR18"],
        ["Doctor", "Record Flagging & Quality Dispute Form", "/doctor/flag", "FR20"],
        ["Hospital", "Hospital Admin Dashboard", "/hospital/dashboard", "FR23"],
        ["Hospital", "Doctor Staff Directory & Verification", "/hospital/doctors", "FR02, FR03"],
        ["Hospital", "HMS REST API Console & Key Ingress", "/hospital/api-console", "FR17"],
        ["Hospital", "Emergency Break-Glass 2-Factor Approver", "/hospital/emergency-verify", "FR12"],
        ["Emergency", "Break-Glass Request & Justification Form", "/emergency/request", "FR12"],
        ["Emergency", "Time-Limited Emergency Record Viewer", "/emergency/session/:id", "FR12, NFR10"],
        ["Admin", "Admin Central Command Dashboard", "/admin/dashboard", "FR23"],
        ["Admin", "Hospital Verification Queue", "/admin/verifications/hospitals", "FR03"],
        ["Admin", "Doctor License Verification Queue", "/admin/verifications/doctors", "FR02"],
        ["Admin", "Record Flagging & Dispute Adjudication", "/admin/disputes", "FR20, C4"],
        ["Admin", "7-Year Immutable Audit Log Explorer", "/admin/audit-logs", "NFR10, OR-04"],
        ["Admin", "System Health, Kafka & Blockchain Explorer", "/admin/system-health", "NFR07, NFR08, NFR09"]
    ]
    add_styled_table(doc, matrix_headers, matrix_data, col_widths=[1.1, 2.3, 1.8, 1.3], primary_header_color="2563EB")
    
    os.makedirs("d:/MediLocker/docs", exist_ok=True)
    out_path = "d:/MediLocker/MediLocker_Role_and_Page_Wise_Feature_Map.docx"
    copy_path = "d:/MediLocker/docs/MediLocker_Role_and_Page_Wise_Feature_Map.docx"
    doc.save(out_path)
    doc.save(copy_path)
    print(f"Successfully generated Feature Map DOCX at {out_path} and {copy_path}")

if __name__ == "__main__":
    build_feature_map_doc()
