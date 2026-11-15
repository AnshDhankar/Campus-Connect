# 16 — Troubleshooting Guide

- **Document Version**: 1.0.0
- **Status**: IMPLEMENTED AND VERIFIED
- **Last Reviewed**: 2026-11-11
- **Target Audience**: Support Engineers, Developers, System Administrators

---

## 1. Troubleshooting Methodology & Safety Invariants

When diagnosing system issues:
1. **Never Disable Security Defenses**: Do not bypass CORS, remove CSRF guards, or disable JWT validation to troubleshoot issues.
2. **Never Run Destructive Database Commands**: Do not drop collections or delete documents to resolve data validation errors.
3. **Inspect Application Logs First**: Search container stdout for structured error logs.

---

## 2. Practical Diagnostic Scenarios

---

### Scenario 1: Application Startup Fails with `[FATAL CONFIGURATION ERROR]`
- **Symptoms**: Node.js exits immediately with code `1` during boot.
- **Possible Cause**:
  - In production mode (`NODE_ENV=production`), `JWT_SECRET` is missing, empty, shorter than 32 characters, or set to an insecure default.
  - Or `STORAGE_MODE=local` was specified while `NODE_ENV=production`.
- **Diagnostic Steps**:
  1. Inspect the terminal error output:
     ```bash
     [FATAL CONFIGURATION ERROR] JWT_SECRET must be configured in production (minimum 32 characters)
     ```
- **Relevant File**: `src/server/auth.ts` / `src/server/db.ts`.
- **Corrective Action**:
  - Set a high-entropy string (>= 32 chars) for `JWT_SECRET` in `.env` or Secret Manager.
  - Set `STORAGE_MODE=atlas` and configure a valid `MONGODB_URI`.
- **Escalate**: If secrets are properly set in Secret Manager but fail to inject into Cloud Run.

---

### Scenario 2: MongoDB Atlas Connection Failure (`MongooseServerSelectionError`)
- **Symptoms**: API requests return `HTTP 503 Service Unavailable`:
  `{ "error": "Database service is temporarily unavailable. Connection to MongoDB Atlas is recovering." }`
- **Possible Cause**:
  - Current container or developer egress IP address is not whitelisted in MongoDB Atlas Network Access.
  - Atlas cluster paused, restarting, or credentials expired.
- **Diagnostic Steps**:
  1. Check readiness probe:
     ```bash
     curl -s http://localhost:3000/api/health/readiness
     ```
  2. Inspect connection state in server log: `Mongoose readyState: 0 (disconnected)`.
- **Relevant File**: `src/server/db.ts` (`connectToDatabase`).
- **Corrective Action**:
  - Open MongoDB Atlas Dashboard -> **Security** -> **Network Access**.
  - Add your current IP address (or `0.0.0.0/0` temporarily in dev) to the whitelist.
- **Escalate**: If Atlas cluster status reports healthy but TLS handshake times out continuously.

---

### Scenario 3: CSRF Verification Rejection (`HTTP 403 Forbidden`)
- **Symptoms**: State-changing requests (`POST /api/requests`, `PATCH`, `DELETE`) fail with:
  `{ "error": "Invalid or missing CSRF token" }`
- **Possible Cause**:
  - Frontend client did not include `x-csrf-token` header, or the header does not match the `XSRF-TOKEN` cookie.
- **Diagnostic Steps**:
  1. In browser Developer Tools -> Network tab, inspect request headers on the failing request.
  2. Check if cookie `XSRF-TOKEN` exists.
  3. Verify if `x-csrf-token` header was included in the request headers.
- **Relevant File**: `src/server/security.ts` (`verifyCsrfProtection`), `src/utils/csrf.ts`.
- **Corrective Action**:
  - Ensure frontend requests invoke `GET /api/csrf-token` prior to submitting mutating forms.
  - Ensure `credentials: 'include'` is set on `fetch()` calls so cookies are dispatched.

---

### Scenario 4: CORS Policy Rejection (`CORS policy rejection`)
- **Symptoms**: Browser console reports:
  `Access to fetch at 'https://api.yourcollege.edu' from origin 'https://client.yourcollege.edu' has been blocked by CORS policy.`
- **Possible Cause**:
  - Frontend origin is not included in the server's approved origin list.
- **Diagnostic Steps**:
  1. Check server log for:
     ```bash
     [CORS REJECTED] Origin "https://unauthorized-domain.com" is not authorized.
     ```
- **Relevant File**: `src/server/security.ts` (`createCorsMiddleware`).
- **Corrective Action**:
  - Add the client domain to `CORS_ALLOWED_ORIGINS` in `.env` (comma-separated).

---

### Scenario 5: Rate Limit Throttling (`HTTP 429 Too Many Requests`)
- **Symptoms**: API returns HTTP 429 with `{ "error": "Too many requests from this IP" }`.
- **Possible Cause**:
  - Automated testing or rapid UI clicking exceeded the configured IP threshold.
  - In production: Auth limit is 10/15m; General API limit is 150/15m.
- **Diagnostic Steps**:
  1. Inspect response headers: `retry-after: 900` or `ratelimit-remaining: 0`.
- **Relevant File**: `src/server/security.ts` (`createRateLimiters`).
- **Corrective Action**:
  - Wait for the 15-minute window to elapse.
  - In development/testing, ensure `NODE_ENV=development` is set (allows up to 2,000 requests/15m).

---

### Scenario 6: Attachment Upload Rejection (`Corrupted or invalid image header`)
- **Symptoms**: Submitting a ticket with an attachment fails with `HTTP 400 Bad Request`:
  `{ "error": "Uploaded image header does not match declared MIME-type specification" }`
- **Possible Cause**:
  - A file disguised with a `.png` or `.jpg` extension contains text, script, or non-image binary data.
  - File exceeds the 5MB size limit.
- **Diagnostic Steps**:
  1. Check uploaded file magic bytes using `hexdump` or `file`:
     ```bash
     file path/to/uploaded/file.png
     ```
- **Relevant File**: `src/server/storage.ts` (`validateMagicBytes`), `server.ts` (`saveBase64Image`).
- **Corrective Action**:
  - Ensure the file is an authentic PNG, JPEG, WebP, or PDF document. Re-save the file in standard image software if headers were corrupted.

---

### Scenario 7: Student Profile Reassignment Blocked (`HTTP 400 Bad Request`)
- **Symptoms**: Calling `PATCH /api/students/me` fails with:
  `{ "error": "Enrollment number is immutable once registered" }`
- **Possible Cause**:
  - Client attempted to pass `institutionId`, `enrollmentNumber`, or `role` in the profile update payload.
- **Diagnostic Steps**:
  1. Inspect request payload in browser network tab.
- **Relevant File**: `server.ts` (`PATCH /api/students/me`).
- **Corrective Action**:
  - Profile updates for students only support modifying `name` and `contactNumber`. Remove immutable fields from payload.

---

### Scenario 8: Password Reset OTP Not Arriving
- **Symptoms**: Student does not receive the 6-digit recovery code after requesting password reset.
- **Possible Cause**:
  - `RESEND_API_KEY` is not set; server logged the OTP to stdout console instead of sending email.
  - Email entered does not match any registered student account.
- **Diagnostic Steps**:
  1. Inspect server logs for:
     ```bash
     [DEV EMAIL LOG] To: student@campus.edu | Subject: Password Reset Code | OTP: 123456
     ```
- **Relevant File**: `src/server/email.ts` (`sendPasswordResetOtpEmail`).
- **Corrective Action**:
  - If developing locally, copy the OTP directly from the server terminal output.
  - In production, ensure `RESEND_API_KEY` is configured with a verified domain.
