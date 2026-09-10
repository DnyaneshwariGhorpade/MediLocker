# MediLocker — Digital Healthcare Record Platform

> **A Secure, Patient-Owned Cloud-Native Healthcare Record Vault with Granular Consent, Cryptographic Integrity & Blockchain Anchoring.**

---

## 📌 Technical & Architecture Documentation Quick Links

- 🗺️ **[Role-Wise & Page-Wise Feature Map (Markdown)](file:///d:/MediLocker/ROLE_AND_PAGE_WISE_FEATURE_MAP.md)**: Complete UI/UX functional map covering all 31 screens across 6 roles, interactive elements, validation rules, and backend API triggers.
- 📄 **[Role-Wise & Page-Wise Feature Map (Word .docx)](file:///d:/MediLocker/MediLocker_Role_and_Page_Wise_Feature_Map.docx)**: Formatted Microsoft Word document of the complete feature map.
- 📖 **[Comprehensive Database Schema & Architecture Guide (Markdown)](file:///d:/MediLocker/DATABASE_SCHEMA_AND_ARCHITECTURE.md)**: Full breakdown of all 17 database tables, column specifications, constraints, Redis caching strategy, Zero Trust envelope encryption, and Hyperledger Fabric integration.
- 📄 **[Database Schema & Architecture (Word .docx)](file:///d:/MediLocker/MediLocker_Database_Schema_and_System_Architecture.docx)**: Formatted Microsoft Word document of the database schema and system architecture.
- 🗄️ **[PostgreSQL DDL Migration Script](file:///d:/MediLocker/database/migrations/V1__init_medilocker_schema.sql)**: Ready-to-run PostgreSQL 16 DDL script with custom enums, primary/foreign keys, GIN/B-Tree indexes, and immutability triggers.

---

## 🏗️ Core Technology Stack

- **Frontend:** React 18+ (TypeScript), Vite, TailwindCSS, Lucide-React, TanStack Query
- **Backend Microservices:** Spring Boot 3.x / Node.js Microservices (8 Services)
- **Primary Database:** PostgreSQL 16
- **Distributed Cache:** Redis 7.2 (Sub-10ms consent evaluation)
- **Event Bus:** Apache Kafka
- **Encrypted Document Storage:** AWS S3 (`ap-south-1` Mumbai) + AWS KMS (AES-256 Envelope Encryption)
- **Data Integrity & Ledger:** Hyperledger Fabric (SHA-256 Hash Anchoring)
- **Infrastructure:** Docker, Kubernetes (AWS EKS), Envoy API Gateway
- **Regulatory Compliance:** India DPDP Act 2023 & ABDM (Ayushman Bharat Digital Mission)
