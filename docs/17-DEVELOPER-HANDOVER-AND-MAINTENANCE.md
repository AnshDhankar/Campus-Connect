# 17 — Developer Handover and Maintenance

- **Document Version**: 1.0.0
- **Status**: IMPLEMENTED AND VERIFIED
- **Last Reviewed**: 2026-11-11
- **Target Audience**: Incoming Developers, Software Engineers, Engineering Leads

---

## 1. Project Directory Tour

```
campusconnect/
├── index.html                     # HTML SPA entry point with meta tags
├── package.json                   # Dependencies, scripts, overrides
├── server.ts                      # Express server entry point & route definitions
├── tsconfig.json                  # TypeScript compiler settings
├── vite.config.ts                 # Vite bundler configuration
│
├── src/
│   ├── main.tsx                   # React root DOM rendering
│   ├── App.tsx                    # Top-level state, auth hydration, routing
│   ├── types.ts                   # Core TypeScript domain interfaces
│   ├── index.css                  # Tailwind CSS global styles
│   │
│   ├── components/                # React UI Presentation Layer
│   │   ├── LandingPage.tsx        # Public landing, college selection, footer
│   │   ├── AuthModal.tsx          # Login, Registration, OTP, Forgot Password
│   │   ├── StudentDashboard.tsx   # Student ticket view, submission, rating
│   │   ├── AdminDashboard.tsx     # Superadmin master dashboard & management
│   │   ├── StaffDashboard.tsx     # Department queue triage & notes
│   │   ├── AppSidebar.tsx         # Role-based navigation sidebar
│   │   ├── UserProfileModal.tsx   # Student profile view and contact editor
│   │   ├── ChangePassword.tsx     # Authenticated password rotation form
│   │   ├── ResetPassword.tsx      # Reset password token verification view
│   │   ├── DatabaseStatus.tsx     # System status and storage mode badge
│   │   └── ImageViewer.tsx        # Attachment modal lightbox previewer
│   │
│   ├── server/                    # Backend Infrastructure & Modules
│   │   ├── db.ts                  # Mongoose models, schemas, and repositories
│   │   ├── auth.ts                # JWT generation, token verification, RBAC
│   │   ├── security.ts            # Helmet, CORS, CSRF, rate limiters
│   │   ├── ssrf.ts                # SSRF IP defense & socket pinning engine
│   │   ├── storage.ts             # StorageProvider adapters & magic-byte check
│   │   ├── resilience.ts          # Liveness, readiness, request timeouts
│   │   ├── logger.ts              # Structured JSON logging
│   │   ├── email.ts               # Resend notification dispatch handlers
│   │   └── demoAuth.ts            # Sanitized demo credentials provider
│   │
│   └── utils/
│       └── csrf.ts                # Client-side CSRF cookie helper
│
├── test/                          # Test Automation Matrix
│   ├── storage-config.test.ts     # Storage mode validation unit test
│   ├── demo-credentials-...ts     # Demo sanitizer unit test
│   ├── tenant-student-...ts       # Multi-tenant IDOR mock unit test
│   ├── jwt-config-security.test.ts# JWT secret validation unit test
│   ├── application-security....ts # Security middleware unit test
│   ├── ssrf-protection.test.ts    # SSRF IP blocking unit test
│   ├── resilience-and-...ts       # Probes and timeouts unit test
│   ├── phase-a-unit.test.ts       # Binary magic bytes & storage unit test
│   ├── run-uat-guard.ts           # UAT isolation runner and safety guard
│   ├── uat-level7-verification.ts # Integration UAT workflow suite
│   ├── level7-gap-verification.ts # UAT gap closure workflow suite
│   ├── phase-a-remediation.test.ts# HTTP Phase A verification suite
│   └── load-benchmark.ts          # Liveness probe benchmark
│
└── docs/                          # Complete Technical Handover Package
```

---

## 2. Safe Feature Extension Workflow

When implementing a new feature or modifying existing functionality, developers must follow this strict 8-step safety workflow:

```mermaid
graph TD
    Step1[1. Inspect Existing Code & Dependencies] --> Step2[2. Define Typed Interfaces in types.ts]
    Step2 --> Step3[3. Implement Logic & Enforce institutionId Scoping]
    Step3 --> Step4[4. Add In-Memory Unit Tests]
    Step4 --> Step5[5. Execute npm run lint (0 errors required)]
    Step5 --> Step6[6. Execute npm test (All safe unit tests green)]
    Step6 --> Step7[7. Verify compile_applet (Build succeeds)]
    Step7 --> Step8[8. Document Changes in docs/]
```

### Critical Development Rules:
1. **Never Assume Tenant Context**: Always extract `institutionId` from `(req as AuthenticatedRequest).user.institutionId`, never trust request body or URL params for tenant scoping.
2. **Never Query Without `institutionId`**: Every Mongoose query on students, staff, tickets, departments, announcements, and audit logs must include `{ institutionId }`.
3. **Never Fall Back to Local Storage in Production**: In production mode, writes must strictly go to MongoDB Atlas.

---

## 3. Developer Onboarding Checklist

Complete the following steps on your first day:

- [ ] Install Node.js `v22.x` and verify with `node -v`.
- [ ] Run `npm install` and verify zero npm dependency vulnerabilities (`npm audit`).
- [ ] Create `.env` from `.env.example` with `STORAGE_MODE=local` for offline development.
- [ ] Run `npm run lint` and verify zero TypeScript diagnostic errors.
- [ ] Run `npm test` and verify that all 63 safe in-memory tests pass cleanly.
- [ ] Start the development server using `npm run dev` and navigate to `http://localhost:3000`.
- [ ] Read [08-AUTHENTICATION-AND-SECURITY.md](./08-AUTHENTICATION-AND-SECURITY.md) to understand the CSRF and JWT security controls.
- [ ] Read [06-DATABASE-AND-DATA-MODEL.md](./06-DATABASE-AND-DATA-MODEL.md) to understand Mongoose schema compound indexes.

---

## 4. Ownership & Responsibilities

| Domain | Responsible Role / Team | Assigned Contact |
|---|---|---|
| **System Owner** | Project Owner / Institutional Lead | *To be assigned by project owner* |
| **Technical Lead** | Senior Full-Stack Engineer | *To be assigned by project owner* |
| **Database Administrator** | MongoDB Operations Lead | *To be assigned by project owner* |
| **Security & Compliance** | Security Officer | *To be assigned by project owner* |
| **DevOps / Cloud SRE** | Cloud Infrastructure Lead | *To be assigned by project owner* |
