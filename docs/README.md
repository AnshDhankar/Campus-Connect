# CampusConnect — Technical Documentation & Project Handover Index

**CampusConnect** is a centralized, full-stack college help and complaint routing system designed to eliminate physical administrative queues by enabling students to submit grievances, track resolution milestones in real time, and route caseloads directly to isolated academic and administrative departments under unified multi-tenant institutional boundaries.

---

## 1. Documentation Purpose & Intended Readers

This documentation repository provides a comprehensive, ground-truth technical reference for:
- **Future Developers & Maintainers**: For onboarding, architectural understanding, testing workflows, and codebase conventions.
- **University & College Administrators**: For institutional setup, role management, department configuration, and audit oversight.
- **Department Staff**: For complaint intake, resolution tracking, response publishing, and assignment operations.
- **Students**: For account registration, grievance submission, lifecycle tracking, and feedback.
- **Technical Reviewers & Evaluators**: For inspecting security controls, multi-tenant isolation guarantees, test matrices, and production readiness.

---

## 2. Documentation Status Legend

Throughout this documentation package, all capabilities, endpoints, and architectural components are explicitly classified:

| Classification | Meaning & Scope |
|:---|:---|
| **IMPLEMENTED AND VERIFIED** | Code exists, is wired into runtime, and has automated test or live runtime verification. |
| **IMPLEMENTED BUT NOT VERIFIED** | Code exists in runtime, but lacks an automated verification test suite. |
| **PARTIALLY IMPLEMENTED** | Partial code or scaffold exists; requires completion or external integration. |
| **PLANNED** | Designed in roadmap/architecture; no runtime code currently written. |
| **NOT IMPLEMENTED** | Intentionally omitted or not built into the current software version. |
| **BLOCKED** | Implementation obstructed by an external or environmental dependency. |

> **Accuracy Notice**: In compliance with Level 10 handover standards, this documentation describes the **actual current source code, configuration, database schemas, and verified runtime behavior**. No planned or proposed cloud infrastructure is depicted as already operational unless verified in the live container.

---

## 3. Documentation Structure & Directory Map

The documentation package is organized into 18 topical guides:

```
docs/
├── README.md                                # Master Navigation Index & Status Overview (This File)
├── 01-PROJECT-OVERVIEW.md                   # Problem Statement, Scope, Users, Core Modules & Benefits
├── 02-SYSTEM-ARCHITECTURE.md                # System Topology, Data Flows, and 6 Verified Mermaid Diagrams
├── 03-TECHNOLOGY-STACK.md                   # Complete Dependencies, Runtimes, Frameworks, and Tools
├── 04-INSTALLATION-AND-LOCAL-SETUP.md       # Prerequisites, Setup Commands, and Execution Runbook
├── 05-ENVIRONMENT-CONFIGURATION.md          # Environment Variable Matrix, Defaults, and Secret Handling
├── 06-DATABASE-AND-DATA-MODEL.md            # MongoDB Atlas Schemas, Indexes, ERD, and Isolation Models
├── 07-API-REFERENCE.md                     # Comprehensive 59-Endpoint API Reference & Payloads
├── 08-AUTHENTICATION-AND-SECURITY.md        # JWT, CSRF, SSRF Socket Pinning, Rate Limits, and RBAC
├── 09-STUDENT-USER-GUIDE.md                 # Student Portal Workflows, Screenshots, and Error Handling
├── 10-ADMIN-USER-GUIDE.md                   # Superadmin Institutional Setup, Staff, and Audit Manual
├── 11-DEPARTMENT-STAFF-USER-GUIDE.md        # Staff Caseload Triage, Status Transitions, and Responses
├── 12-TESTING-AND-QUALITY-ASSURANCE.md      # Decoupled Unit Test Matrix (63 tests) and UAT Isolation
├── 13-DEPLOYMENT-AND-RELEASE-GUIDE.md       # Verified Dev Setup vs. Intended Cloud Run Production
├── 14-BACKUP-AND-DISASTER-RECOVERY.md       # Backup Strategy, RPO/RTO Targets, and Isolated Drills
├── 15-MONITORING-AND-INCIDENT-MANAGEMENT.md # Liveness, Readiness, Severity Matrix, and Incident Runbooks
├── 16-TROUBLESHOOTING-GUIDE.md              # 18 Practical Failure Scenarios and Safe Diagnostic Steps
├── 17-DEVELOPER-HANDOVER-AND-MAINTENANCE.md # Codebase Tour, Extension Guide, and Safe Change Workflow
└── 18-KNOWN-LIMITATIONS-AND-FUTURE-ROADMAP.md # Honest Audit of Outstanding Work and Architecture Roadmap
```

---

## 4. Quick Reference Links

| Document | Primary Focus | Target Audience |
|:---|:---|:---|
| [01. Project Overview](./01-PROJECT-OVERVIEW.md) | Objectives, features, users, benefits | All stakeholders |
| [02. System Architecture](./02-SYSTEM-ARCHITECTURE.md) | Architectural diagrams and data flows | Developers, Architects |
| [03. Technology Stack](./03-TECHNOLOGY-STACK.md) | Dependencies, libraries, tools | Developers |
| [04. Installation & Local Setup](./04-INSTALLATION-AND-LOCAL-SETUP.md) | Step-by-step local development setup | Developers |
| [05. Environment Configuration](./05-ENVIRONMENT-CONFIGURATION.md) | Environment variables & secrets table | DevOps, Developers |
| [06. Database & Data Model](./06-DATABASE-AND-DATA-MODEL.md) | Collections, Mongoose schemas, ERD | Database Admins, Developers |
| [07. API Reference](./07-API-REFERENCE.md) | 59 endpoints, params, response codes | Backend & Frontend Engineers |
| [08. Authentication & Security](./08-AUTHENTICATION-AND-SECURITY.md) | JWT, CSRF, SSRF pinning, rate limits | Security Auditors, DevOps |
| [09. Student User Guide](./09-STUDENT-USER-GUIDE.md) | Step-by-step guide for student portal | Students, Support Staff |
| [10. Administrator User Guide](./10-ADMIN-USER-GUIDE.md) | Admin portal manual & configurations | College Administrators |
| [11. Department Staff User Guide](./11-DEPARTMENT-STAFF-USER-GUIDE.md) | Complaint queue triage & notes | Department Heads & Staff |
| [12. Testing & Quality Assurance](./12-TESTING-AND-QUALITY-ASSURANCE.md) | Unit test matrix & safe UAT runners | QA Engineers, Developers |
| [13. Deployment & Release Guide](./13-DEPLOYMENT-AND-RELEASE-GUIDE.md) | Build steps & Cloud Run release plan | DevOps, SRE |
| [14. Backup & Disaster Recovery](./14-BACKUP-AND-DISASTER-RECOVERY.md) | Backup procedures, RPO/RTO, drills | Database Admins, SRE |
| [15. Monitoring & Incidents](./15-MONITORING-AND-INCIDENT-MANAGEMENT.md) | Probes, logging, SEV1–4 response | DevOps, On-Call Engineers |
| [16. Troubleshooting Guide](./16-TROUBLESHOOTING-GUIDE.md) | Common errors & safe diagnostic steps | Developers, Support Staff |
| [17. Developer Handover](./17-DEVELOPER-HANDOVER-AND-MAINTENANCE.md) | Extension guide, onboarding checklist | New Engineers |
| [18. Known Limitations & Roadmap](./18-KNOWN-LIMITATIONS-AND-FUTURE-ROADMAP.md) | Unverified features & future plans | Product Managers, Leads |

---

## 5. High-Level Technology & Runtime Profile

- **Runtime**: Node.js `v22.23.2` on Linux (`x64`).
- **Frontend**: React 19 SPA, TypeScript 5.8, Tailwind CSS 4, Vite 6.
- **Backend**: Express 4.21, TypeScript via `tsx` (dev) and `esbuild` (production bundle).
- **Primary Database**: MongoDB Atlas (Connected via Mongoose 9.7 in `atlas` mode).
- **Fallback Database**: Local JSON repository in `.data/` (active only when `STORAGE_MODE=local`).
- **Security Controls**: Helmet 8, strict CORS allowlist, double-submit CSRF cookie tokens, anti-TOCTOU SSRF TCP socket pinning, process-level JWT validation (zero hardcoded fallback in production), and tiered rate limiters.
