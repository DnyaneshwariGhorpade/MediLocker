# MediLocker — List of Features by User Role and Page
## Complete Details: Every Screen, Feature, and Action

**Project Name:** MediLocker — Secure Cloud-Based Digital Medical Record Management Platform  
**Document Version:** 1.0 (Simplified Feature List)  
**Standard Alignment:** IEEE 830 / ABDM / India DPDP Act 2023  
**Target Users:** Patient, Doctor, Hospital Administrator, Platform Administrator, Emergency Doctor, Public Verifier

---

## 1. Overall System Layout & User Navigation

MediLocker keeps everyone's data safe by using a strict security system based on user roles. Each part of the system requires a secure login, a secondary verification step (like a code on your phone), and checks if the user has permission to see the data.

```text
+-------------------------------------------------------------------------------------------------------------------------+
|                                           MEDILOCKER PAGES BY USER ROLE                                                 |
+-------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                         |
|  [ PUBLIC ACCESS (No Login Required) ]                                                                                  |
|  ├── Home Page (`/`)                                                                                                    |
|  ├── Main Login & Security Code Page (`/login`)                                                                         |
|  ├── Registration Pages (`/register/patient`, `/register/doctor`, `/register/hospital`)                                 |
|  └── Public Tool to Verify Prescriptions and Documents (`/verify`)                                                      |
|                                                                                                                         |
|  [ PATIENT PAGES (`/patient/*`) ]                                                                                       |
|  ├── 1. Patient Home Dashboard (`/patient/dashboard`)                                                                   |
|  ├── 2. Personal Medical File Storage (`/patient/vault`)                                                                |
|  ├── 3. Data Sharing and Permissions Controls (`/patient/consent`)                                                      |
|  ├── 4. Health Metrics Tracker (`/patient/vitals`)                                                                      |
|  ├── 5. Doctor Visits and Medical History (`/patient/consultations`)                                                    |
|  ├── 6. Notifications and Alerts (`/patient/notifications`)                                                             |
|  └── 7. Profile & Emergency Settings (`/patient/settings`)                                                              |
|                                                                                                                         |
|  [ DOCTOR PAGES (`/doctor/*`) ]                                                                                         |
|  ├── 1. Doctor Home Dashboard (`/doctor/dashboard`)                                                                     |
|  ├── 2. Search Patients & View Allowed Records (`/doctor/patients`)                                                     |
|  ├── 3. Upload and Sort Medical Records (`/doctor/upload`)                                                              |
|  ├── 4. Create and Digitally Sign Prescriptions (`/doctor/prescriptions/new`)                                           |
|  ├── 5. Log Patient Visit Details (`/doctor/consultation/log`)                                                          |
|  ├── 6. Search Through Patient Records (`/doctor/search`)                                                               |
|  └── 7. Report Incorrect or Bad Quality Records (`/doctor/flag`)                                                        |
|                                                                                                                         |
|  [ HOSPITAL ADMIN PAGES (`/hospital/*`) ]                                                                               |
|  ├── 1. Hospital Admin Dashboard (`/hospital/dashboard`)                                                                |
|  ├── 2. Manage and Verify Hospital Doctors (`/hospital/doctors`)                                                        |
|  ├── 3. System Connection Settings for Hospital Software (`/hospital/api-console`)                                      |
|  └── 4. Approve Emergency Access Requests (`/hospital/emergency-verify`)                                                |
|                                                                                                                         |
|  [ EMERGENCY DOCTOR PAGES (`/emergency/*`) ]                                                                            |
|  ├── 1. Request Emergency Access to Patient Data (`/emergency/request`)                                                 |
|  └── 2. Temporary Screen to View Emergency Records (`/emergency/session/:sessionId`)                                    |
|                                                                                                                         |
|  [ PLATFORM ADMINISTRATOR PAGES (`/admin/*`) ]                                                                          |
|  ├── 1. Main System Dashboard (`/admin/dashboard`)                                                                      |
|  ├── 2. Review and Approve New Hospitals (`/admin/verifications/hospitals`)                                             |
|  ├── 3. Review and Approve New Doctors (`/admin/verifications/doctors`)                                                 |
|  ├── 4. Resolve Reported Record Issues (`/admin/disputes`)                                                              |
|  ├── 5. View Permanent System Activity Logs (`/admin/audit-logs`)                                                       |
|  └── 6. Monitor System Health and Technology Status (`/admin/system-health`)                                            |
+-------------------------------------------------------------------------------------------------------------------------+
```

---

## 2. Public & Login Pages

### Screen 2.1: Home Page & Login
* **Link:** `/`, `/login`
* **Who can access:** Anyone
* **Main Goal:** Give users information about the platform, let them choose their role, and securely log in.

#### What's on the screen
1. **Top Menu:**
   * MediLocker logo.
   * Links: *Features*, *Security*, *Doctor Verification*, *Public Verifier*.
   * Buttons: *Sign In*, *Create Patient Account*, *Doctor Sign Up*, *Hospital Sign Up*.
2. **Login Box:**
   * **Login ID:** Email, Phone Number, or Vault Number (like `ML-2026-XXXX`).
   * **Password:** Box to type the password, with a button to show/hide it.
   * **Security Protection:** Locks the account for a while if someone types the wrong password too many times.
3. **Extra Security Step (MFA):**
   * After password, asks for a 6-digit code sent to a phone or an authenticator app.
   * A timer shows how long until a new code can be sent.
4. **Behind the scenes:**
   * Checks if login details are correct and then asks for the extra security code.

---

### Screen 2.2: Patient Sign Up
* **Link:** `/register/patient`
* **Who can access:** Anyone
* **Main Goal:** Let patients create an account safely and securely verify their identity.

#### What's on the screen
1. **Step 1 — Identity Check:**
   * Enter Aadhaar Number. The system checks if it looks right.
   * Click a button to get a code (OTP) on the phone linked to the Aadhaar.
   * Enter the code to prove identity. (Note: The raw Aadhaar number is never stored, just a safe scrambled version).
2. **Step 2 — Personal & Emergency Details:**
   * Full Name, Date of Birth, Gender, Blood Group.
   * Address (City, State, PIN Code).
   * Emergency Contact Details (Name, Phone, Relationship).
   * A checkbox to allow emergency doctors to see records to save a life (checked by default).
3. **Step 3 — Security Setup:**
   * Verify Email and Mobile Number with a code.
   * Create a strong password (needs uppercase, lowercase, numbers, and symbols).
   * Set up the extra security step (MFA) using a QR code.

---

### Screen 2.3: Doctor Sign Up
* **Link:** `/register/doctor`
* **Who can access:** Anyone
* **Main Goal:** Let doctors create an account, provide their medical license details, and set up their digital signature.

#### What's on the screen
1. **Professional Details Form:**
   * Name, Email, Phone Number.
   * **Medical Registration Number (MRN):** Their license number.
   * **Medical Council:** The state where they are registered.
   * **Specialty:** E.g., Cardiology, General Medicine.
   * **Qualifications & Experience.**
   * **Hospital:** Search and select the hospital they work at.
2. **Upload Documents:**
   * Area to upload their Medical Certificate and Photo ID (PDF or Image).
3. **Digital Signature Setup:**
   * The system creates a special digital "key" for the doctor.
   * A "private key" is saved securely on their device, and a "public key" is sent to the server.
4. **Waiting Screen:**
   * Shows a message that their application is waiting to be approved by the hospital and platform administrators.

---

### Screen 2.4: Hospital Sign Up
* **Link:** `/register/hospital`
* **Who can access:** Anyone
* **Main Goal:** Allow hospitals and clinics to join the platform.

#### What's on the screen
1. **Hospital Details Form:**
   * Name of Hospital or Clinic.
   * **Registration Number:** Government ID for the hospital.
   * **Type of Hospital:** E.g., Clinic, Diagnostic Center.
   * Contact Email, Phone, and Address.
2. **Admin Details:**
   * Details of the person who will manage the hospital's account on the platform.
3. **Waiting Status:**
   * Application is sent to the platform administrator for review.

---

### Screen 2.5: Public Document Verifier
* **Link:** `/verify`
* **Who can access:** Anyone (No login needed)
* **Main Goal:** Let anyone check if a digital prescription is real and signed by a valid doctor, or if a medical report has been altered.

#### What's on the screen
1. **Two Ways to Verify:**
   * **Check a Prescription:** Upload a prescription file. The system checks the digital signature and says if it's real (e.g., "Valid Signature by Dr. Sharma") or fake/changed.
   * **Check a Document's Authenticity:** Upload any medical report. The system calculates a secure code and checks it against a public, unchangeable ledger (blockchain) to see if the file has been tampered with.

---

## 3. Patient Pages (`/patient/*`)

### Screen 3.1: Patient Home Dashboard
* **Link:** `/patient/dashboard`
* **Who can access:** Logged-in Patient
* **Main Goal:** The main hub showing recent activity, health trends, and quick actions.

#### What's on the screen
1. **Welcome Area:**
   * Patient name, age, and blood group.
   * **Vault Number:** A unique ID (e.g., `ML-2026-XXXX`) to share with doctors. It has a copy button and a QR code.
   * Quick Buttons: *Upload Record*, *Give Doctor Access*, *Log Vitals*.
2. **Health Trend Charts:**
   * Graphs showing things like Blood Pressure and Blood Sugar over time.
   * Buttons to view past week, month, or year.
3. **Recent Activity Feed:**
   * A list showing recent doctor visits, new reports, and prescriptions.
   * Buttons to view or download files safely.
4. **Upcoming Visits:**
   * Reminders for upcoming doctor appointments.
5. **Security Summary:**
   * Shows how many doctors currently have access to your data and any recent emergency accesses.

---

### Screen 3.2: Personal Medical File Storage
* **Link:** `/patient/vault`
* **Who can access:** Logged-in Patient
* **Main Goal:** A secure place to see all medical records, sort them, and view them safely.

#### What's on the screen
1. **Categories Menu:**
   * Buttons to filter records by type: Prescriptions, Blood Reports, X-Rays, Surgery History, Sensitive Records, etc.
2. **Search Bar:**
   * Type to search by name, doctor, or date.
3. **List of Records:**
   * Shows the title, doctor name, date, file type, and a badge if it is a "Sensitive" record.
   * Shows a badge if the record's authenticity is verified on the blockchain.
4. **Actions for Each Record:**
   * **View Securely:** Opens the document safely without downloading it permanently.
   * **Download:** Saves the file to your device.
   * **Report Issue:** If the record has a mistake, you can flag it.
   * **Manage Sharing:** Quick way to let a doctor see this specific file type.

---

### Screen 3.3: Data Sharing and Permissions Controls
* **Link:** `/patient/consent`
* **Who can access:** Logged-in Patient
* **Main Goal:** Give patients full control over who sees what. They can give access, block sensitive data, and remove access at any time.

#### What's on the screen
1. **Active Access List:**
   * Shows which doctors can see the records.
   * Shows what they are allowed to see (e.g., Blood Reports) and what is blocked (e.g., Sensitive Records).
   * Shows when their access expires.
   * **Remove Access Button:** A big red button to instantly stop a doctor from seeing any records.
2. **Give Access Screen:**
   * Search for a doctor.
   * Choose exactly which categories of records they can see and which are strictly blocked.
   * Set a time limit (e.g., 24 hours, 7 days).
   * Choose if they can only *View* the records or if they can also *Download* them.
3. **Access History:**
   * A log showing past permissions that have expired or been removed.

---

### Screen 3.4: Health Metrics Tracker
* **Link:** `/patient/vitals`
* **Who can access:** Logged-in Patient
* **Main Goal:** Keep track of things like blood pressure, weight, and blood sugar over time.

#### What's on the screen
1. **Add New Reading:**
   * Choose what to log (Blood Pressure, Sugar, Weight, etc.).
   * Enter the number.
   * Note the condition (e.g., "After Breakfast").
   * Pick the date and time.
2. **Charts & Graphs:**
   * Visual graphs showing how health metrics change over time. Uses colors (Green = Good, Red = Warning) to help understand the numbers.
3. **History Table:**
   * A simple list of all past readings that can be downloaded to show a doctor.

---

### Screen 3.5: Doctor Visits and Medical History
* **Link:** `/patient/consultations`
* **Who can access:** Logged-in Patient
* **Main Goal:** A timeline of all past doctor visits and what happened during them.

#### What's on the screen
1. **Timeline of Visits:**
   * Details of each visit: Doctor's name, hospital, reasons for visiting, and what the doctor diagnosed.
   * Quick links to any prescriptions or lab tests from that visit.
2. **Search:** Search by doctor name or condition.

---

### Screen 3.6: Notifications and Alerts
* **Link:** `/patient/notifications`
* **Who can access:** Logged-in Patient
* **Main Goal:** A central place to see all important alerts.

#### What's on the screen
1. **Notification List:** Shows messages like:
   * "New report uploaded by your doctor."
   * "Dr. Smith is asking for permission to see your records."
   * "Your permission for Dr. Lee ends tomorrow."
   * 🚨 "CRITICAL: Emergency access was used by a doctor in the ER."

---

### Screen 3.7: Profile & Emergency Settings
* **Link:** `/patient/settings`
* **Who can access:** Logged-in Patient
* **Main Goal:** Update personal details, emergency contacts, and security settings.

#### What's on the screen
1. **Personal Details:**
   * Name, address, blood group.
2. **Emergency Access Settings:**
   * Add emergency contacts (Name, phone number).
   * **Master Switch:** A button to turn on or off the ability for emergency doctors to see records to save a life when the patient cannot respond.
3. **Security:**
   * Change password.
   * See a list of devices currently logged in and a button to "Logout of all other devices".

---

## 4. Doctor Pages (`/doctor/*`)

### Screen 4.1: Doctor Home Dashboard
* **Link:** `/doctor/dashboard`
* **Who can access:** Logged-in Doctor (Approved)
* **Main Goal:** The doctor's main workspace to see daily tasks and look up patients quickly.

#### What's on the screen
1. **Summary Numbers:**
   * Patients seen, records uploaded, active permissions granted by patients.
2. **Quick Patient Search:**
   * A search bar to find a patient by their Vault Number or Phone Number.
3. **Today's Schedule:**
   * A list of patients scheduled for the day with a button to start writing their visit notes.
4. **Recent Work:**
   * Shows recently written prescriptions.

---

### Screen 4.2: Search Patients & View Allowed Records
* **Link:** `/doctor/patients`
* **Who can access:** Logged-in Doctor
* **Main Goal:** Let doctors view patient records, but only the ones the patient has given them permission to see.

#### What's on the screen
1. **Search:** Enter Patient Vault Number or Phone Number.
2. **Permission Check:**
   * **If allowed:** Shows what types of records they can see (e.g., "Allowed: Blood Reports. Blocked: Sensitive Records").
   * **If not allowed:** Shows "No permission." Provides a button to "Ask Patient for Permission."
3. **Record Viewer:**
   * A secure screen to open and read patient reports, scans, and test results.

---

### Screen 4.3: Upload Medical Records
* **Link:** `/doctor/upload`
* **Who can access:** Logged-in Doctor
* **Main Goal:** Upload test results and reports securely and organize them correctly.

#### What's on the screen
1. **Upload Area:** Drag and drop files (PDFs or images).
2. **Details Form:**
   * Give the document a title (e.g., "Knee X-Ray").
   * Choose a category (X-Ray, Blood Report, etc.).
   * Add tags or notes so it’s easy to search for later.
3. **Behind the scenes:** The system scrambles the file (encrypts it) so only authorized people can read it, and logs the upload securely.

---

### Screen 4.4: Create Digital Prescriptions
* **Link:** `/doctor/prescriptions/new`
* **Who can access:** Logged-in Doctor
* **Main Goal:** Write prescriptions clearly and sign them digitally so they cannot be faked.

#### What's on the screen
1. **Patient Info:** Shows the patient's name and any known allergies.
2. **Medication List:**
   * Search for the medicine name.
   * Set the dose (e.g., 500mg) and how often to take it (e.g., Morning and Night).
   * Set how many days to take it and instructions like "After food".
3. **Advice & Next Visit:** Add notes and set a date for the next checkup.
4. **Digital Signature:**
   * The doctor uses their secure digital key to "sign" the prescription. This creates a secure PDF with a QR code that pharmacies can scan to prove it’s real.

---

### Screen 4.5: Log Patient Visit Notes
* **Link:** `/doctor/consultation/log`
* **Who can access:** Logged-in Doctor
* **Main Goal:** Record the details of a patient's visit.

#### What's on the screen
1. **Visit Details:**
   * What the patient is complaining about.
   * Results of physical checks (like checking blood pressure).
   * The final diagnosis.
2. **Save & Notify:** Saves the notes to the patient's record and sends them a notification.

---

### Screen 4.6: Search Patient Records
* **Link:** `/doctor/search`
* **Who can access:** Logged-in Doctor
* **Main Goal:** Easily search through a patient's history to find specific past tests or diagnoses.

#### What's on the screen
1. **Search Tools:** Search by date, document type, hospital, or keywords.
2. **Results List:** Shows snippets of documents that match the search.

---

### Screen 4.7: Report Incorrect Records
* **Link:** `/doctor/flag`
* **Who can access:** Logged-in Doctor
* **Main Goal:** Allow doctors to report if a medical document has a mistake, is blurry, or belongs to the wrong patient.

#### What's on the screen
1. **Select File:** Pick the document with the issue.
2. **Reason:** Choose why it’s wrong (e.g., "Wrong info", "Duplicate", "Hard to read").
3. **Submit:** Notifies the platform administrators so they can fix the issue.

---

## 5. Hospital Admin Pages (`/hospital/*`)

### Screen 5.1: Hospital Admin Dashboard
* **Link:** `/hospital/dashboard`
* **Who can access:** Logged-in Hospital Admin
* **Main Goal:** View overall hospital activity on the platform.

#### What's on the screen
1. **Key Numbers:** Active doctors, total records uploaded, pending issues.
2. **Activity Feed:** Live list of records being uploaded and doctors logging in.

---

### Screen 5.2: Manage Hospital Doctors
* **Link:** `/hospital/doctors`
* **Who can access:** Logged-in Hospital Admin
* **Main Goal:** Review and approve doctors who say they work at the hospital.

#### What's on the screen
1. **Doctor List:** Shows all doctors linked to the hospital and if they are approved.
2. **Approval Tool:** Lets the admin view a doctor’s credentials and either approve them or reject their application.

---

### Screen 5.3: System Connection Settings
* **Link:** `/hospital/api-console`
* **Who can access:** Logged-in Hospital Admin
* **Main Goal:** Manage technical settings so the hospital's own software can talk to MediLocker automatically.

#### What's on the screen
1. **Keys & Security:** Generate special passwords (API Keys) and set which computer IP addresses are allowed to connect to the platform.

---

### Screen 5.4: Approve Emergency Access
* **Link:** `/hospital/emergency-verify`
* **Who can access:** Hospital Admin or ER Supervisor
* **Main Goal:** Act as the required second person to approve a doctor's request to access a patient's data during a life-or-death emergency.

#### What's on the screen
1. **Emergency Requests:** Shows requests from doctors needing emergency access, including their reason.
2. **Approve or Reject:** The admin reviews the reason and enters a code to unlock the patient’s data for a short time (usually 4 hours).
3. **Active Emergencies:** A list of currently open emergency access sessions, with a button to stop them early if the emergency is over.

---

## 6. Emergency Doctor Pages (`/emergency/*`)

### Screen 6.1: Request Emergency Access
* **Link:** `/emergency/request`
* **Who can access:** Approved Emergency Doctor
* **Main Goal:** Ask for access to a patient’s medical history when the patient is unconscious and cannot give permission.

#### What's on the screen
1. **Patient Search:** Enter the patient's ID or Phone Number.
2. **Reason Box:** The doctor must type a detailed reason for needing emergency access.
3. **Submit:** Sends a high-priority alert to the Hospital Admin to approve the request.

---

### Screen 6.2: Temporary Emergency Record Viewer
* **Link:** `/emergency/session/:sessionId`
* **Who can access:** Approved Emergency Doctor (Only during an active emergency)
* **Main Goal:** Quickly view life-saving information before the time runs out.

#### What's on the screen
1. **Warning Banner & Timer:** A big red banner showing a countdown timer (e.g., 4 hours). When it hits zero, access is removed automatically.
2. **Critical Info Section:** Highlights allergies, blood group, and serious conditions right away.
3. **Record Viewer:** Allows the doctor to open past scans and lab reports. Every single click is heavily monitored and recorded.

---

## 7. Platform Administrator Pages (`/admin/*`)

### Screen 7.1: Main System Dashboard
* **Link:** `/admin/dashboard`
* **Who can access:** Platform Administrator
* **Main Goal:** Keep an eye on the entire platform, checking how many people are using it and if there are any security alerts.

#### What's on the screen
1. **Overview:** Total users, hospitals, doctors, and storage space used.
2. **Security Alerts:** Highlights any suspicious activity or tampered documents.

---

### Screen 7.2 & 7.3: Review New Hospitals & Doctors
* **Link:** `/admin/verifications/hospitals` and `/admin/verifications/doctors`
* **Who can access:** Platform Administrator
* **Main Goal:** Make sure only real, legally recognized hospitals and doctors join the platform.

#### What's on the screen
1. **Waiting Lists:** Lists of hospitals and doctors waiting for approval.
2. **Review Tools:** Admins can look at uploaded licenses and IDs, check government databases, and approve or reject the applications.

---

### Screen 7.4: Resolve Reported Record Issues
* **Link:** `/admin/disputes`
* **Who can access:** Platform Administrator
* **Main Goal:** Fix issues when a doctor or patient reports that a document has a mistake.

#### What's on the screen
1. **Issue List:** A list of flagged documents.
2. **Resolution Screen:** The admin can view the document, read the complaint, and decide to remove the document, replace it, or mark it as correct.

---

### Screen 7.5: Permanent History Log Viewer
* **Link:** `/admin/audit-logs`
* **Who can access:** Platform Administrator
* **Main Goal:** A secure, unchangeable record of every single action taken on the platform for legal and security checks.

#### What's on the screen
1. **Searchable Logs:** Find out exactly who viewed or downloaded a file, and when.
2. **Export:** Download these logs for official legal or security reviews.

---

### Screen 7.6: System Health Monitor
* **Link:** `/admin/system-health`
* **Who can access:** Platform Administrator
* **Main Goal:** Make sure the servers, databases, and technology are running smoothly without crashing.

#### What's on the screen
1. **Server Status:** Shows if all the different parts of the system are online and healthy.
2. **Traffic Speed:** Shows how fast the system is responding to users.

---

## 8. Summary: Connecting Pages to Requirements

| User Role | Page Name | Link | Main Purpose |
| :--- | :--- | :--- | :--- |
| **Public** | Main Login | `/login` | Secure login |
| **Public** | Patient Sign Up | `/register/patient` | Identity check and account creation |
| **Public** | Doctor Sign Up | `/register/doctor` | License check and digital signature setup |
| **Public** | Hospital Sign Up | `/register/hospital` | Hospital onboarding |
| **Public** | Document Verifier | `/verify` | Check if documents are real |
| **Patient** | Home Dashboard | `/patient/dashboard` | Main overview |
| **Patient** | Medical File Storage | `/patient/vault` | Store and view files securely |
| **Patient** | Permissions Controls | `/patient/consent` | Control who sees data |
| **Patient** | Health Metrics Tracker | `/patient/vitals` | Track weight, blood pressure, etc. |
| **Patient** | Doctor Visits History | `/patient/consultations`| Timeline of past visits |
| **Patient** | Notifications | `/patient/notifications` | Alerts and messages |
| **Patient** | Profile Settings | `/patient/settings` | Emergency and security setup |
| **Doctor** | Home Dashboard | `/doctor/dashboard` | Main doctor workspace |
| **Doctor** | View Allowed Records | `/doctor/patients` | See approved patient data |
| **Doctor** | Upload Records | `/doctor/upload` | Add new files securely |
| **Doctor** | Create Digital Prescriptions | `/doctor/prescriptions/new` | Write secure prescriptions |
| **Doctor** | Log Visit Notes | `/doctor/consultation/log` | Add consultation notes |
| **Doctor** | Search Records | `/doctor/search` | Find specific reports |
| **Doctor** | Report Incorrect Records | `/doctor/flag` | Report mistakes in files |
| **Hospital** | Admin Dashboard | `/hospital/dashboard` | View hospital stats |
| **Hospital** | Manage Doctors | `/hospital/doctors` | Approve staff doctors |
| **Hospital** | Connection Settings | `/hospital/api-console` | Tech setup for automatic uploads |
| **Hospital** | Approve Emergencies | `/hospital/emergency-verify` | Approve emergency access |
| **Emergency**| Request Access | `/emergency/request` | Ask for emergency records |
| **Emergency**| Emergency Viewer | `/emergency/session/:id` | View life-saving records (timed) |
| **Admin** | System Dashboard | `/admin/dashboard` | Platform-wide stats |
| **Admin** | Review Hospitals | `/admin/verifications/hospitals` | Approve hospitals |
| **Admin** | Review Doctors | `/admin/verifications/doctors` | Approve doctors |
| **Admin** | Resolve Issues | `/admin/disputes` | Fix flagged records |
| **Admin** | History Log Viewer | `/admin/audit-logs` | View permanent system logs |
| **Admin** | System Health Monitor | `/admin/system-health` | Check server health |
