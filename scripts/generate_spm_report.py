import docx
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os

def main():
    doc = docx.Document()
    
    # Page setup A4
    for section in doc.sections:
        section.page_width = Inches(8.27)
        section.page_height = Inches(11.69)
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)
        
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(12)
    style.paragraph_format.line_spacing = 1.5
    style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    # --- Cover Page ---
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("Pimpri Chinchwad Education Trust’s\nTools & Pimpri Chinchwad College of Engineering\nSector No. 26, Pradhikaran, Nigdi, Pune 411044\nAn Autonomous Institute Approved By AICTE and Affiliated To SPPU, Pune\n\n")
    run.font.name = 'Times New Roman'
    run.font.size = Pt(14)
    run.font.bold = True
    
    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run2 = p2.add_run("DEPARTMENT OF INFORMATION TECHNOLOGY\n\n\n")
    run2.font.name = 'Times New Roman'
    run2.font.size = Pt(16)
    run2.font.bold = True
    
    p3 = doc.add_paragraph()
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run3 = p3.add_run("Software Project Management Laboratory Mini Project Report\nof\nT. Y. B. Tech\nAcademic Year: 2026-27\nSemester - I\non\nMediLocker — Secure Cloud-Based Digital Medical Record Management Platform\n\nBy\n")
    run3.font.name = 'Times New Roman'
    run3.font.size = Pt(14)
    run3.font.bold = True

    p4 = doc.add_paragraph()
    p4.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run4 = p4.add_run("PRN: 124B1F041                         Name of the Student: Prachi Gorle")
    run4.font.name = 'Times New Roman'
    run4.font.size = Pt(14)
    run4.font.bold = True

    doc.add_page_break()

    # --- Certificate ---
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("CERTIFICATE\n\n")
    run.font.name = 'Times New Roman'
    run.font.size = Pt(16)
    run.font.bold = True
    
    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    run2 = p2.add_run("This is to certify that the project report entitled MediLocker — Secure Cloud-Based Digital Medical Record Management Platform, submitted by Prachi Gorle, in partial fulfillment of the requirements for the award of the degree Bachelor of Technology in Information Technology, is a record of original work carried out under the supervision of Mrs. Sandhya Sandeep Waghere. This project report has not been previously submitted to any other institute or university for the award of any degree or diploma.\n\n\n\n")
    run2.font.name = 'Times New Roman'
    run2.font.size = Pt(12)
    p2.paragraph_format.line_spacing = 1.5
    
    p3 = doc.add_paragraph()
    p3.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run3 = p3.add_run("Dr. Sandhya Sandeep Waghere                                Prof. Dr. Jayashree Katti\nProject Guide                                                                   HOD IT")
    run3.font.name = 'Times New Roman'
    run3.font.size = Pt(12)
    run3.font.bold = True
    
    doc.add_page_break()
    
    def add_chapter(num, title):
        doc.add_page_break() if num > 1 else None
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(f"Chapter {num}\n{title}")
        r.font.name = 'Times New Roman'
        r.font.size = Pt(14)
        r.font.bold = True
        doc.add_paragraph()
        
    def add_heading(text):
        p = doc.add_paragraph()
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(12)
        r.font.bold = True
        
    def add_para(text):
        p = doc.add_paragraph(text)
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        
    # --- Chapter 1: Introduction ---
    add_chapter(1, "Introduction")
    add_heading("1.1 Project Background and Motivation")
    add_para("The rapid digitalization of healthcare demands secure, unified, and interoperable platforms for managing medical records. Traditional healthcare systems rely heavily on fragmented, paper-based records or siloed hospital management systems (HMS), making it difficult for patients and doctors to access complete medical histories. The motivation for MediLocker is to provide a centralized, cloud-native, and patient-owned digital healthcare records management platform that ensures high security, privacy, and ease of access while adhering to national compliances such as the DPDP Act 2023 and the Ayushman Bharat Digital Mission (ABDM).")
    
    add_heading("1.2 Application Domain and SDG")
    add_para("Application Domain: Healthcare Technology / Digital Health Vaults.\nSustainable Development Goal (SDG): The project aligns with SDG 3 (Good Health and Well-being) by ensuring better healthcare management, providing immediate access to critical medical data, and facilitating timely medical decisions.")
    
    add_heading("1.3 Aim and Objectives")
    add_para("1. To build a highly secure, patient-centric digital medical vault using AES-256 envelope encryption and blockchain technology (Hyperledger Fabric) to prevent unauthorized access and data tampering.\n2. To implement granular consent management, allowing patients to control and instantly revoke access to specific categories of their medical records.\n3. To introduce an emergency 'Break-Glass' access protocol for life-saving interventions with strict 2-factor authorization and audit logging.")
    
    # --- Chapter 2: System Study ---
    add_chapter(2, "System Study")
    add_heading("2.1 Existing System")
    add_para("Currently, most patient medical records are physically maintained by the patients or digitally isolated within specific hospital systems. When a patient switches doctors or visits an emergency room in a different network, their past history, allergies, and diagnostic reports are rarely available in real-time.")
    
    add_heading("2.2 Limitation of Existing System")
    add_para("- Fragmentation of Data: Medical history is scattered across different institutions.\n- Lack of Emergency Access: Doctors cannot quickly access life-saving information (e.g., allergies, chronic conditions) if the patient is unresponsive.\n- Data Privacy Risks: Existing systems often lack granular consent, meaning once records are shared, patients lose control over who views them.\n- Forgeries and Tampering: Physical prescriptions and records can be easily forged or tampered with.")
    
    add_heading("2.3 Proposed System")
    add_para("MediLocker proposes a centralized digital vault where patients hold the keys. Advantages include:\n- Patient Empowerment: Patients have complete ownership with category-level consent control over who can view specific documents.\n- High Security: Data is secured using AES-256 envelope encryption, and authenticity is guaranteed via Hyperledger Fabric blockchain anchoring and digital signatures.\n- Emergency Availability: Break-Glass protocols ensure doctors get critical data during emergencies while maintaining a strict audit trail.")
    
    add_heading("2.4 Problem Definition / Title")
    add_para("Problem Statement: To design and develop a secure, interoperable, and patient-controlled digital health records system that prevents unauthorized access, ensures data integrity, and provides life-saving emergency data availability.\nProject Title: MediLocker — Secure Cloud-Based Digital Medical Record Management Platform")
    
    add_heading("2.5 Key Tasks, User Intervention, and Performance Parameters")
    add_para("Key Tasks: Registration and KYC, AES-256 record uploading, Consent Management, Digital Prescription generation, and Break-Glass authorization.\nUser Intervention: Patients manage consents, Doctors upload/view records, Hospital Admins verify emergency requests.\nPerformance Parameters:\n- Accuracy: 100% cryptographic validation for prescriptions and blockchain hashes.\n- Speed: Sub-10ms latency for consent validation via Redis cache.\n- Data Accessibility: 99.9% uptime with immediate synchronization across patient and doctor portals.")

    # --- Chapter 3: System Requirement Specification (SRS) ---
    add_chapter(3, "System Requirement Specification (SRS)")
    add_heading("3.1 Functional and Non-functional Requirement Traceability Matrix (RTM)")
    
    table = doc.add_table(rows=1, cols=3)
    table.style = 'Table Grid'
    hdr = table.rows[0].cells
    hdr[0].text = 'Req ID'
    hdr[1].text = 'Requirement Description'
    hdr[2].text = 'Module / Screen Traced'
    
    reqs = [
        ("FR01", "Aadhaar KYC Registration", "Patient Registration Screen"),
        ("FR06", "Lifelong Medical Vault Provisioning", "Patient Vault Viewer"),
        ("FR09", "Granular Category-Level Consent", "Consent Management Hub"),
        ("FR12", "Emergency Break-Glass Protocol", "Emergency Verification & Viewer"),
        ("FR13", "Blockchain Hash Anchoring", "Record Uploader / Verifier"),
        ("FR16", "Digital Prescriptions with RSA-2048", "Digital Prescription Studio"),
        ("NFR06", "Consent resolution < 10ms (Redis)", "Patient & Doctor Portal Auth"),
        ("NFR10", "Immutable Audit Logging for 7 years", "Admin Audit Log Explorer")
    ]
    for rid, rdesc, rmod in reqs:
        row = table.add_row().cells
        row[0].text = rid
        row[1].text = rdesc
        row[2].text = rmod

    doc.add_paragraph()
    add_heading("3.2 Project Planning")
    add_para("The project was planned using Agile methodology with 2-week sprint cycles. \nSprint 1-2: Requirements gathering, DB Schema Design (PostgreSQL), and UI wireframing.\nSprint 3-4: Core Authentication, Aadhaar KYC, and Vault APIs implementation.\nSprint 5-6: AES-256 Encryption, Blockchain (Hyperledger Fabric) integration, and Digital Signatures.\nSprint 7-8: Break-Glass Emergency module, Audit Logging, Testing, and Deployment on AWS (ap-south-1).")

    # --- Chapter 4: System Design ---
    add_chapter(4, "System Design")
    add_heading("4.1 Selection of Appropriate SDLC Model and its Justification")
    add_para("Model Selected: Agile (Scrum) Software Development Life Cycle.\nJustification: MediLocker involves complex security, cryptographic implementations, and evolving healthcare compliance laws (DPDP Act). Agile allows iterative development, frequent testing of security modules (like AES encryption and Blockchain), and adaptability to changing compliance requirements without derailing the entire project. Incremental releases ensure that core features (like Vault and Authentication) are robust before building advanced features (like Break-Glass access).")
    
    add_heading("4.2 E-R Diagram")
    add_para("The database architecture is built on PostgreSQL 16. Key entities include Users, Patients, Doctors, Hospitals, Medical_Records, Consents, Patient_Vitals, and Audit_Logs.\n- A User has a one-to-one relationship with a Patient, Doctor, or Hospital Admin.\n- A Patient has one Lifelong Vault.\n- A Vault contains multiple Medical Records.\n- Patients grant multiple Consents to specific Doctors.\n- All critical interactions (Upload, View, Consent) generate an immutable entry in Audit_Logs.")
    
    add_heading("4.3 Cost Estimation")
    add_para("Cost estimation was done using the COCOMO II model. \nEstimated Cloud Infrastructure Costs (AWS ap-south-1, Monthly):\n- Compute (EKS / EC2): $200\n- Database (RDS PostgreSQL): $150\n- Cache (Redis): $50\n- Storage (S3 KMS Encrypted): $100\n- Total estimated operational cost per month: ~$500 for the initial scale phase.")
    
    add_heading("4.4 Risk Management")
    add_para("- Risk 1: Cryptographic Key Compromise. Mitigation: Master keys strictly stored in AWS KMS; doctor keys generated client-side and never transmitted over the network.\n- Risk 2: High Latency in Consent Checking. Mitigation: Distributed Redis Cache achieving <10ms validation.\n- Risk 3: Regulatory Non-Compliance. Mitigation: Complete adherence to ABDM standards and DPDP Act via soft-deletes and immutable audit trails.")
    
    add_heading("4.5 Software Configuration Management")
    add_para("Version Control: Git with GitHub.\nBranching Strategy: GitFlow (main, develop, feature/, hotfix/ branches).\nCI/CD Pipeline: GitHub Actions triggering automated testing, Docker image builds, and Helm chart deployments to AWS EKS. Any code push requires a minimum of 1 manual code review and passing automated security scans (SonarQube).")
    
    add_heading("4.6 Team Coordination")
    add_para("Tools Used: Jira for sprint tracking and Kanban boards, Slack for real-time messaging, and Confluence for API documentation and architectural decision records (ADRs). Daily standups ensured alignment between the frontend, backend, and security engineers.")

    # --- Chapter 5: System Implementation ---
    add_chapter(5, "System Implementation")
    add_heading("5.1 Module Description")
    add_para("1. Identity & RBAC Module: Handles universal login, TOTP MFA, and role-based routing.\n2. Vault & Record Management: Facilitates secure file upload, AES-256-GCM envelope encryption, and document categorisation.\n3. Consent Management: Allows patients to grant or revoke read/download permissions for doctors via a Redis-backed high-speed engine.\n4. Break-Glass Emergency: Permits life-saving emergency data access with dual-factor approval and automatic patient notification.\n5. Blockchain & Integrity: Anchors SHA-256 document hashes to Hyperledger Fabric for tamper detection.")
    
    add_heading("5.2 Data Set Collection")
    add_para("Mock datasets containing synthetic patient demographics, standard medical terminology (ICD-10 codes), dummy prescriptions, and sample radiology images (DICOM) were generated for testing purposes. No real Personal Health Information (PHI) was used during development.")
    
    add_heading("5.3 Algorithms / Pseudocode")
    add_para("Algorithm for Secure Document Upload (Envelope Encryption):\n1. Generate random AES-256 Data Encryption Key (DEK).\n2. Encrypt document payload in memory using DEK.\n3. Send DEK to AWS KMS to obtain Encrypted_DEK.\n4. Calculate SHA-256 of original document for blockchain.\n5. Store Encrypted_DEK and Metadata in PostgreSQL.\n6. Store Encrypted document in AWS S3.\n7. Send SHA-256 hash to Hyperledger Fabric node via Kafka.")

    # --- Chapter 6: Testing and Deployment ---
    add_chapter(6, "Testing and Deployment")
    add_heading("6.1 Manual Test Cases")
    
    table2 = doc.add_table(rows=1, cols=7)
    table2.style = 'Table Grid'
    hdr2 = table2.rows[0].cells
    for i, t in enumerate(["Test Case ID", "Test Condition", "Data Input", "User Action", "Expected Output", "Actual Output", "Result"]):
        hdr2[i].text = t
        
    tcs = [
        ("TC01", "Login with valid MFA", "Valid Credentials & OTP", "Click Login", "Route to dashboard", "Routed successfully", "Pass"),
        ("TC02", "Login with 5 failed attempts", "Wrong password x5", "Click Login", "Account locked", "Locked as expected", "Pass"),
        ("TC03", "View record without consent", "Record ID URL", "Open URL", "403 Forbidden Error", "Access Denied", "Pass"),
        ("TC04", "Revoke consent", "Revoke Button Click", "Click Revoke", "Redis token evicted", "Token cleared", "Pass"),
        ("TC05", "Blockchain Hash Tamper", "Modify S3 file", "Verify", "Hash mismatch", "Mismatch alerted", "Pass")
    ]
    for tc in tcs:
        row = table2.add_row().cells
        for i, val in enumerate(tc):
            row[i].text = val

    doc.add_paragraph()
    add_heading("6.2 Deployment Strategies")
    add_para("The application is deployed using a containerized microservices architecture on AWS Elastic Kubernetes Service (EKS). Horizontal Pod Autoscaling (HPA) is configured for dynamic load balancing. Blue-Green deployment strategy is used to ensure zero-downtime updates, where traffic is safely routed to the new version only after passing automated health checks.")

    add_heading("6.3 System Connections and Hosting Architecture")
    add_para("The MediLocker ecosystem utilizes a decoupled architecture with specialized hosting platforms to ensure scalability and compliance:\n"
             "- Frontend Hosting: The patient, doctor, and admin web portals (React/Vite) are hosted on Vercel or AWS Amplify, leveraging Global Edge Networks (CDN) for fast, responsive UI delivery.\n"
             "- Backend Hosting: The core API microservices (Node.js/Spring Boot) are hosted on AWS EKS (Elastic Kubernetes Service) or Render. They sit behind an API Gateway/Envoy Proxy that strictly validates JWT tokens and handles rate-limiting.\n"
             "- Database and Cache Hosting: The primary relational database (PostgreSQL 16) is hosted on AWS RDS (Relational Database Service) within the ap-south-1 (Mumbai) region to ensure data sovereignty under the DPDP Act. A managed Redis cluster handles high-speed consent validation caching.\n"
             "- Secure Connections: The frontend communicates with the backend strictly via HTTPS/TLS 1.3 encrypted REST API endpoints. The backend microservices connect to PostgreSQL and Redis over secure, private Virtual Private Cloud (VPC) peering. All external document storage interactions utilize AES-256 envelope encryption connected securely to AWS S3 and KMS.")

    # --- Chapter 7: Result and Discussion ---
    add_chapter(7, "Result and Discussion")
    add_para("The MediLocker project successfully demonstrated a highly secure, patient-centric digital medical records vault. The integration of AES-256 envelope encryption ensured data confidentiality, while Hyperledger Fabric anchoring provided an immutable guarantee of data integrity. The implementation of the granular consent management system successfully achieved sub-10ms response times by leveraging a distributed Redis cache, meeting the strict SLA requirements.\n\nFurthermore, the emergency Break-Glass protocol successfully balanced strict privacy requirements with the critical need for data availability in life-threatening scenarios, proving that secure systems can also be highly accessible when necessary.\n\nFuture Extensions: The system can be extended to include native mobile applications (iOS/Android) with offline caching capabilities, integration with wearable IoT devices for continuous vitals telemetry, and advanced AI-driven analytics to predict chronic diseases based on long-term medical data trends.")

    # --- Chapter 8: References ---
    add_chapter(8, "References")
    add_para("[1] IEEE Standard 830-1998, 'IEEE Recommended Practice for Software Requirements Specifications'.\n[2] Ayushman Bharat Digital Mission (ABDM) Architecture Framework, National Health Authority, Government of India.\n[3] The Digital Personal Data Protection (DPDP) Act, 2023, Ministry of Law and Justice, India.\n[4] Hyperledger Fabric Documentation, Linux Foundation.\n[5] AWS Key Management Service (KMS) Cryptographic Details Whitepaper.\n[6] COCOMO II Software Cost Estimation Model.")
    
    os.makedirs("d:/MediLocker/docs", exist_ok=True)
    out_path = "d:/MediLocker/docs/MediLocker_SPM_Mini_Project_Report.docx"
    doc.save(out_path)
    print(f"Successfully generated SPM Mini-Project Report DOCX at {out_path}")

if __name__ == "__main__":
    main()
