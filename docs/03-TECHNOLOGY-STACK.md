# 03 — Technology Stack

- **Document Version**: 1.0.0
- **Status**: IMPLEMENTED AND VERIFIED
- **Last Reviewed**: 2026-11-11
- **Target Audience**: Developers, DevOps Engineers, Technical Evaluators

---

## 1. Overview

CampusConnect is constructed on a modern TypeScript stack, utilizing React 19 for the presentation tier, Express 4 on Node.js for backend API routing, and MongoDB Atlas (via Mongoose 9) for high-availability document storage. Production packaging utilizes `esbuild` for the backend bundle and `vite` for client asset tree-shaking.

---

## 2. Frontend Technology Stack

| Technology / Library | Version | Category | Purpose in Project |
|---|:---:|---|---|
| **React** | `^19.0.1` | Presentation Library | Declarative UI component tree, hooks, and virtual DOM reconciliation. |
| **React DOM** | `^19.0.1` | Renderer | Browser DOM mounting and portal rendering for modals. |
| **TypeScript** | `~5.8.2` | Language | Strict static typing across components, models, and API interfaces. |
| **Vite** | `^6.2.3` | Build & Dev Server | Fast hot-reloading development server and production static asset bundler. |
| **Tailwind CSS** | `^4.1.14` | Styling Engine | Utility-first styling with unified Dark/Light theme token variables. |
| **@tailwindcss/vite** | `^4.1.14` | Vite Plugin | Tailwind v4 compilation pipeline integration. |
| **Lucide React** | `^0.546.0` | Iconography | Accessible, lightweight SVG icons for navigation, status tags, and actions. |
| **Motion** | `^12.23.24` | Animation | Fluid page transitions, toast animations, and modal expansion effects. |
| **React Router DOM** | `^7.18.0` | Client Routing | History state management and location synchronization. |

---

## 3. Backend Technology Stack

| Technology / Library | Version | Category | Purpose in Project |
|---|:---:|---|---|
| **Node.js** | `v22.23.2` | Runtime Engine | Server runtime running on Linux x64 container environment. |
| **Express** | `^4.21.2` | HTTP Framework | REST API route registration, middleware execution, and request parsing. |
| **tsx** | `^4.21.0` | Development Runner | Native TypeScript execution engine for `server.ts` during development. |
| **esbuild** | `^0.25.0` | Production Bundler | Ultra-fast Node.js bundle compilation into standalone `dist/server.cjs`. |
| **bcryptjs** | `^3.0.3` | Cryptography | Secure one-way salt hashing (10 rounds) for student and staff passwords. |
| **jsonwebtoken** | `^9.0.3` | Authentication | Stateless HMAC-SHA256 JWT generation, signing, and verification. |
| **cookie-parser** | `^1.4.7` | Middleware | Parsing signed and standard HTTP cookies (`req.cookies.token`). |
| **cors** | `^2.8.6` | Ingress Security | Whitelist-based Cross-Origin Resource Sharing filter with credential support. |
| **helmet** | `^8.3.0` | HTTP Hardening | Automated generation of defensive HTTP headers (CSP, HSTS, X-Content-Type). |
| **express-rate-limit**| `^8.7.3` | Traffic Control | IP-based request throttling across login, registration, OTP, and API routes. |
| **multer** | `^2.2.0` | Multipart Form | File upload processing and multipart buffer management. |
| **dotenv** | `^17.2.3` | Configuration | Environment variable loading from `.env` files into `process.env`. |

---

## 4. Database & Persistence Layer

| Technology | Version / Tier | Implementation Mode | Purpose in Project |
|---|:---:|:---:|---|
| **MongoDB Atlas** | M0 / Dedicated | `atlas` (Primary) | High-availability cloud document store hosting genuine student, ticket, and department collections. |
| **Mongoose** | `^9.7.1` | ODM | Schema validation, type casting, middleware hooks, and compound indexing. |
| **Local File DB** | Custom (`.data/*.json`) | `local` (Fallback) | Automated file-based fallback system active strictly when `STORAGE_MODE=local`. |

### Database Compound Indexes (Verified Active on Atlas):
1. **`requests`**:
   - `{ institutionId: 1, studentId: 1, createdAt: -1 }` (Student ticket history)
   - `{ institutionId: 1, departmentKey: 1, status: 1 }` (Staff queue filtering)
   - `{ institutionId: 1, status: 1, createdAt: -1 }` (Admin analytics)
2. **`students`**:
   - `{ institutionId: 1, enrollmentNumber: 1 }` (Unique student registration constraint)
3. **`staffs`**:
   - `{ email: 1, institutionId: 1 }` (Unique staff login constraint)
4. **`departments`**:
   - `{ key: 1, institutionId: 1 }` (Unique department identifier)
   - `{ username: 1, institutionId: 1 }` (Unique staff login username)
5. **`auditlogs`**:
   - `{ institutionId: 1, timestamp: -1 }` (Chronological administrative audit trail)

---

## 5. External Services & Cloud Status

| Service | Client Library | Verification Status | Operational Notes |
|---|---|:---:|---|
| **Resend** | `resend (^6.16.0)` | **PARTIALLY IMPLEMENTED** | Integrated in `src/server/email.ts`. If `RESEND_API_KEY` is missing, gracefully falls back to console logging without crashing. |
| **Google Cloud Run** | Native Container | **VERIFIED (Dev)** | Currently running development container on Google Cloud infrastructure. |
| **Google Cloud Storage** | `@google-cloud/storage` | **PLANNED** | Adapter interface implemented in `src/server/storage.ts`. Cloud bucket provisioning pending user approval. |
| **Google Cloud NAT** | Infrastructure | **PLANNED** | Designed to provide a static egress IP for Atlas IP restriction. |
| **Google Gemini API** | `@google/genai (^2.4.0)`| **DECLARED** | Present in `package.json` and `metadata.json` for server-side capabilities. Not active in core complaint workflows. |
