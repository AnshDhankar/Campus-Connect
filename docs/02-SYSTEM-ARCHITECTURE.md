# 02 — System Architecture

- **Document Version**: 1.0.0
- **Status**: IMPLEMENTED AND VERIFIED
- **Last Reviewed**: 2026-11-11
- **Target Audience**: Software Engineers, System Architects, DevOps, Technical Auditors

---

## 1. High-Level Architecture

CampusConnect is structured as a full-stack, decoupled Web application where a React Single Page Application (SPA) communicates over HTTPS with a stateless Express REST API backend. The backend persists data to MongoDB Atlas with an automatic fallback to local JSON repository storage during development.

```mermaid
graph TB
    subgraph ClientLayer["Client Layer (Browser)"]
        SPA["React 19 SPA (Vite)"]
        CookieStore["Secure HttpOnly Cookie / LocalStorage"]
    end

    subgraph IngressSecurity["Ingress & Security Middleware"]
        Helmet["Helmet Security Headers & CSP"]
        Cors["Strict CORS Allowlist"]
        RateLimiter["Tiered Rate Limiters"]
        CsrfGuard["Double-Submit CSRF Guard"]
        AuthMiddleware["authenticateToken & requireRole()"]
    end

    subgraph ApplicationServer["Application Runtime (Node.js / Express)"]
        API["Express 4 REST API Router"]
        SSRF["SSRF Defense & Socket Pinning Engine"]
        StorageAdapter["Pluggable Storage Provider (Local / GCS)"]
        AuditLogger["Audit Logging Subsystem"]
    end

    subgraph DataStorage["Data Persistence Layer"]
        Mongoose["Mongoose ODM (Atlas Mode)"]
        AtlasCluster[("MongoDB Atlas Database Cluster")]
        LocalFallback[(".data/*.json Local Fallback")]
    end

    SPA -->|HTTPS / REST API| IngressSecurity
    IngressSecurity --> API
    API --> SSRF
    API --> StorageAdapter
    API --> AuditLogger
    API --> Mongoose
    Mongoose -->|TLS Connection Pool| AtlasCluster
    Mongoose -.->|Fallback if STORAGE_MODE=local| LocalFallback
```

---

## 2. Component Interaction & Communication

Communication between the client and server occurs via JSON payloads over RESTful HTTP endpoints, complemented by multipart form data for file uploads.

```mermaid
sequenceDiagram
    autonumber
    actor User as Student / Staff / Admin
    participant Frontend as React SPA (Client)
    participant Server as Express Server (API)
    participant DB as MongoDB Atlas Cluster

    User->>Frontend: Submit Action (e.g. Login / Complaint)
    Frontend->>Server: GET /api/csrf-token
    Server-->>Frontend: Return XSRF-TOKEN (Cookie + Body)
    Frontend->>Server: POST /api/... (Headers: x-csrf-token, Cookie: token, x-idempotency-key)
    Note over Server: 1. Helmet & CORS check<br/>2. Rate limiter check<br/>3. CSRF token verification<br/>4. JWT authentication & RBAC<br/>5. Idempotency cache check
    Server->>DB: Execute Scoped Query ({ institutionId, ... })
    DB-->>Server: Return Records
    Server->>DB: Write Audit Log (if mutating operation)
    Server-->>Frontend: HTTP 200/201 JSON (or standard error response)
    Frontend-->>User: Render Dashboard Update
```

---

## 3. Authentication & Session Architecture

CampusConnect uses stateless JSON Web Tokens (JWT) signed with HMAC-SHA256. Tokens are delivered to the client via `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookies, while also accepting standard `Authorization: Bearer <token>` headers for programmatic or mobile clients.

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Student / Admin / Staff)
    participant Client as React SPA
    participant Auth as Auth Service (/api/auth)
    participant DB as Database

    User->>Client: Enters credentials (Email/Enrollment & Password)
    Client->>Auth: POST /api/auth/login { identifier, password, institutionId }
    Auth->>DB: Find user by email/enrollment + institutionId
    DB-->>Auth: Return user record with bcrypt password hash
    Auth->>Auth: bcrypt.compare(password, hashedPassword)
    alt Password Invalid
        Auth-->>Client: HTTP 401 Unauthorized (Invalid credentials)
    else Password Valid
        Auth->>Auth: generateToken(payload, JWT_SECRET, "7d")
        Auth-->>Client: HTTP 200 OK (Set-Cookie: token=...; HttpOnly; SameSite=Lax)
        Client->>Client: Store user session profile in state
        Client-->>User: Navigate to Role Dashboard
    end
```

---

## 4. Student Complaint Lifecycle State Machine

The complaint resolution engine operates on an audited, deterministic state machine. State changes automatically append timeline milestones and issue targeted notifications to the student.

```mermaid
stateDiagram-v2
    [*] --> Pending: Student Submits Ticket (/api/requests)
    Pending --> Assigned: Staff Assigns Department Officer
    Pending --> InProgress: Staff Initiates Investigation
    Assigned --> InProgress: Officer Begins Resolution
    InProgress --> Resolved: Staff Submits Resolution Remarks
    InProgress --> Rejected: Staff Rejects with Written Justification
    Resolved --> Closed: Student Submits Satisfaction Feedback
    Resolved --> Pending: Student Reopens Ticket (Requires >5 Char Reason)
    Rejected --> [*]
    Closed --> [*]
```

---

## 5. Multi-Tenant Data Isolation Model

Every administrative and student operation is hard-scoped to the user's `institutionId`. The application strictly prevents tenant data leakage:

```mermaid
graph TD
    subgraph InstitutionA["Institution A Boundary (e.g. Hindu University)"]
        AdminA[Admin A] --> DeptsA[Departments A]
        DeptsA --> StaffA[Staff A]
        StudentsA[Students A] --> TicketsA[Tickets & Caseload A]
        TicketsA --> AuditA[Audit Logs A]
    end

    subgraph InstitutionB["Institution B Boundary (e.g. Sister Campus)"]
        AdminB[Admin B] --> DeptsB[Departments B]
        DeptsB --> StaffB[Staff B]
        StudentsB[Students B] --> TicketsB[Tickets & Caseload B]
        TicketsB --> AuditB[Audit Logs B]
    end

    AdminA -.->|Cross-Tenant Access BLOCKED (HTTP 404 / 403)| TicketsB
    AdminB -.->|Cross-Tenant Access BLOCKED (HTTP 404 / 403)| TicketsA
    StaffA -.->|Cross-Tenant Access BLOCKED| DeptsB
```

### Isolation Enforcement Rules:
1. **Creation**: Student registration enforces that the requested `institutionId` matches an active institution.
2. **Querying**: Queries on `requests`, `departments`, `announcements`, `auditlogs`, and `students` include `{ institutionId: req.user.institutionId }`.
3. **Deletion & Mutation**: Deletion queries (e.g. student deletion) execute atomic filters: `StudentModel.findOneAndDelete({ id: targetId, institutionId: req.user.institutionId })`. If the target belongs to another institution, it returns `404 Not Found` (Anti-Enumeration defense).

---

## 6. Attachment & File Storage Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student
    participant SPA as Frontend
    participant Server as Server Endpoint (/api/requests)
    participant Validator as Magic-Byte Validator
    participant Adapter as Storage Provider Adapter
    participant Storage as File Storage (Local Disk / GCS)

    Student->>SPA: Selects file (PNG, JPEG, WebP, PDF)
    SPA->>SPA: Converts to Base64 payload (Max 5MB)
    SPA->>Server: POST /api/requests { attachments: [dataUri] }
    Server->>Validator: validateMagicBytes(buffer, declaredMime)
    alt Magic Byte Mismatch (e.g. PHP payload disguised as PNG)
        Validator-->>Server: Invalid (Header mismatch)
        Server-->>SPA: HTTP 400 Bad Request
    else Valid Binary Header
        Validator-->>Server: Valid
        Server->>Adapter: saveAttachment(filename, buffer, mimeType, instId)
        Adapter->>Storage: Write to filesystem /uploads/... (or GCS bucket if configured)
        Storage-->>Adapter: Return stored reference URI
        Adapter-->>Server: Return URL /uploads/inst-logo-...
        Server-->>SPA: HTTP 201 Created with ticket record
    end
```

---

## 7. External Integrations & Cloud Infrastructure Status

| Subsystem | Implemented Component | Operational Status | Notes / Prerequisites |
|---|---|:---:|---|
| **Database** | MongoDB Atlas Cluster | **VERIFIED** | Connected via Mongoose over TLS (`readyState: 1`). |
| **Email Service** | Resend SDK (`resend` package) | **PARTIALLY IMPLEMENTED** | Integrated in `src/server/email.ts`; requires active `RESEND_API_KEY` for live delivery. |
| **File Storage** | `LocalDiskStorageProvider` | **VERIFIED** | Files stored locally in `.data/uploads/`. |
| **Cloud Storage** | `GoogleCloudStorageProvider` | **PLANNED** | Code exists in `src/server/storage.ts`; bucket provisioning pending approval. |
| **Cloud Egress** | Cloud NAT + Static IP | **PLANNED** | Architecture designed; requires VPC Connector provisioning to restrict Atlas IP whitelist. |
