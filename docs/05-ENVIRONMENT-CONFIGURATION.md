# 05 — Environment Configuration

- **Document Version**: 1.0.0
- **Status**: IMPLEMENTED AND VERIFIED
- **Last Reviewed**: 2026-11-11
- **Target Audience**: DevOps Engineers, System Administrators, Developers

---

## 1. Environment Variable Reference Table

The following table documents all environment variables referenced across the codebase (`server.ts`, `src/server/auth.ts`, `src/server/db.ts`, `src/server/security.ts`, and `src/server/email.ts`):

| Variable Name | Purpose | Required? | Sensitive? | Consumed By | Default / Fallback Behavior |
|---|---|:---:|:---:|---|---|
| `NODE_ENV` | Sets execution tier (`development`, `test`, or `production`). | Optional | No | Entire backend & build pipeline | Defaults to `development`. In production, activates strict security policies. |
| `PORT` | Listening TCP port for the Express HTTP server. | Optional | No | `server.ts` | Defaults to `3000`. In Cloud Run, automatically set to `8080`. |
| `MONGODB_URI` | Full connection URI for the MongoDB Atlas database. | Required in Prod | **YES** | `src/server/db.ts` | If missing, falls back to local `.data/*.json` mode if `STORAGE_MODE=local`. |
| `STORAGE_MODE` | Explicitly overrides storage selection (`atlas` or `local`). | Optional | No | `src/server/db.ts` | Auto-detects `atlas` when `MONGODB_URI` is present; else `local`. |
| `JWT_SECRET` | Cryptographic secret key for HMAC-SHA256 token signing. | Required in Prod | **YES** | `src/server/auth.ts` | In dev, auto-generates ephemeral secret. In prod, strictly halts startup if invalid. |
| `APP_URL` | Public base URL of the application. | Optional | No | `src/server/email.ts`, `server.ts` | In AI Studio / Cloud Run, auto-injected. Defaults to `http://localhost:3000`. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of approved external origins. | Optional | No | `src/server/security.ts` | In dev, permits `localhost` and container preview URLs automatically. |
| `RESEND_API_KEY` | API token for Resend transactional email delivery. | Optional | **YES** | `src/server/email.ts` | If missing, email notifications fall back to stdout console logging. |
| `TEST_MONGODB_URI` | Dedicated connection string for isolated UAT testing. | Required for UAT | **YES** | `test/run-uat-guard.ts` | Must specify a test DB. Refuses to run if set to `campusconnect`. |
| `ALLOW_DATABASE_UAT` | Runtime flag unlocking execution of database UAT suites. | Required for UAT | No | UAT test suites | Set exclusively by `test/run-uat-guard.ts`. |

---

## 2. Environment Profiles

### A. Local Development Profile (`.env.local`)
Optimized for rapid iteration, offline testing, and high developer throughput:
```ini
NODE_ENV=development
PORT=3000
STORAGE_MODE=local
JWT_SECRET=local-dev-secret-key-32-chars-minimum-length
APP_URL=http://localhost:3000
```
- **Rate Limiters**: Relaxed thresholds (2,000 API requests / 15m; 200 auth requests / 15m).
- **Cookies**: `Secure` flag disabled for HTTP local execution.

### B. Staging Environment Profile
Mirrors production topology using isolated staging resources:
```ini
NODE_ENV=production
PORT=8080
STORAGE_MODE=atlas
MONGODB_URI=mongodb+srv://staging_user:secure_pass@cluster.mongodb.net/campusconnect_staging?retryWrites=true&w=majority
JWT_SECRET=staging-cryptographically-random-secret-key-64-bytes
APP_URL=https://staging.yourdomain.edu
```

### C. Production Profile (Google Cloud Run / Render)
Hardened zero-trust configuration:
```ini
NODE_ENV=production
PORT=8080
STORAGE_MODE=atlas
MONGODB_URI=mongodb+srv://prod_user:strong_password@cluster.mongodb.net/campusconnect?retryWrites=true&w=majority
JWT_SECRET=production-high-entropy-random-secret-key-minimum-32-bytes
APP_URL=https://campusconnect.yourdomain.edu
RESEND_API_KEY=re_live_production_key_here
```
- **Rate Limiters**: Strictly enforced (150 API requests / 15m; 10 auth attempts / 15m).
- **Cookies**: `HttpOnly; SameSite=Lax; Secure` enforced on all authentication tokens.
- **Fail-Fast Boot**: Server immediately crashes with a descriptive error if `JWT_SECRET` is missing, weak, or matches known insecure defaults.

---

## 3. Configuration Validation & Fail-Fast Mechanics

Before Express begins accepting network traffic, `server.ts` executes two centralized validation routines:

### 1. `validateStorageConfiguration()` (`src/server/db.ts`)
- Asserts that if `NODE_ENV === 'production'`, `STORAGE_MODE` is never set to `local`.
- Confirms `MONGODB_URI` is present and well-formed.
- Throws fatal startup exception if local JSON file mode is attempted in production.

### 2. `validateJwtConfiguration()` (`src/server/auth.ts`)
- Rejects missing, empty, or whitespace-only `JWT_SECRET` in production.
- Rejects legacy insecure fallback keys (e.g. `campusconnect-secret-key-2026`).
- Enforces a minimum entropy length of 32 characters (256-bit).
- Halts process with exit code 1 if validation fails.

---

## 4. Secret Management Best Practices

1. **Never Commit Secrets**: Ensure `.env` is listed in `.gitignore`.
2. **Cloud Run Secret Mounting**:
   - In production, map `MONGODB_URI`, `JWT_SECRET`, and `RESEND_API_KEY` from Google Cloud Secret Manager as environment variables.
3. **No Secret Printing**: Application startup banners, diagnostics, and test logs strictly mask secret values and print only boolean status indicators (e.g. `JWT Secret: [CONFIGURED]`).
