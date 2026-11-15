# 04 — Installation and Local Setup

- **Document Version**: 1.0.0
- **Status**: IMPLEMENTED AND VERIFIED
- **Last Reviewed**: 2026-11-11
- **Target Audience**: Developers, DevOps Engineers, Quality Assurance

---

## 1. System Prerequisites

Before running CampusConnect locally or on a virtual server, ensure the following software is installed:

| Requirement | Supported Version | Verification Command | Notes |
|---|---|---|---|
| **Node.js** | `>= 20.0.0` (Recommended `v22.x`) | `node -v` | Core runtime engine. |
| **npm** | `>= 10.0.0` | `npm -v` | Default package manager. |
| **Git** | `>= 2.30.0` | `git --version` | Version control. |
| **MongoDB** | `>= 6.0` (or Atlas Free Tier) | `mongod --version` | Optional for local file-fallback mode. |

---

## 2. Cloning & Initial Setup

```bash
# 1. Clone the project repository
git clone https://github.com/your-org/campusconnect.git
cd campusconnect

# 2. Install all dependencies from package.json
npm install
```

---

## 3. Environment File Configuration

Copy the example environment configuration to create your local `.env`:

```bash
cp .env.example .env
```

Open `.env` and configure local development variables:

```ini
# =============================================================================
# ENVIRONMENT IDENTIFIERS
# =============================================================================
NODE_ENV=development
PORT=3000

# =============================================================================
# PERSISTENCE & STORAGE CONFIGURATION
# Set to 'local' for zero-dependency file mode (.data/*.json)
# Set to 'atlas' when connecting to MongoDB Atlas or local MongoDB daemon
# =============================================================================
STORAGE_MODE=local
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/campusconnect?retryWrites=true&w=majority

# =============================================================================
# AUTHENTICATION & SECURITY SECRETS
# In development, an ephemeral secret will generate automatically if omitted.
# In production, this must be a cryptographically secure string (>= 32 chars).
# =============================================================================
JWT_SECRET=local-development-test-secret-minimum-32-chars-long

# =============================================================================
# APPLICATION BASE URLS
# =============================================================================
APP_URL=http://localhost:3000

# =============================================================================
# EMAIL NOTIFICATIONS (Optional for Local Development)
# If omitted, notifications log to the terminal console gracefully.
# =============================================================================
# RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

---

## 4. Execution Commands (from `package.json`)

The following commands are registered in `package.json`:

```bash
# Start the full-stack development server (Express API + Vite Dev Server on port 3000)
npm run dev

# Compile TypeScript type check (Zero errors allowed)
npm run lint

# Execute safe, in-memory automated test suite (Zero DB writes)
npm test

# Execute isolated UAT tests (Requires dedicated TEST_MONGODB_URI)
TEST_MONGODB_URI="mongodb+srv://.../campusconnect_isolated_uat" npm run test:uat

# Build client SPA and compile standalone server bundle
npm run build

# Start the compiled production server
npm run start

# Clean build artifacts
npm run clean

# Run diagnostic liveness benchmark
npm run benchmark
```

---

## 5. Local Application Access

1. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
2. The initial landing page presents:
   - Institutional banner and registered college directory.
   - Student grievance submission portal.
   - Superadmin and Department Staff authentication modals.

---

## 6. Critical Database Safety Guidelines

> ⚠️ **STRICT SAFETY RULE: NEVER RUN DATABASE-WRITING TESTS AGAINST SHARED ATLAS**
> 
> The default `npm test` command executes **only safe in-memory unit tests**. It touches zero database collections and performs zero HTTP writes.
> 
> The `npm run test:uat` command executes integration workflows that write synthetic data. It enforces a strict pre-flight check:
> 1. It **requires** `TEST_MONGODB_URI`.
> 2. It **strictly refuses** to execute if the target database is named `campusconnect`, `admin`, or `local`.
> 3. Never run UAT tests without an isolated test database!

---

## 7. Common Setup Errors & Solutions

### 1. `Error: [FATAL CONFIGURATION ERROR] JWT_SECRET must be configured in production`
- **Cause**: `NODE_ENV` is set to `production`, but `JWT_SECRET` is unset, empty, or shorter than 32 characters.
- **Fix**: Set a strong random secret of at least 32 characters in your `.env` file, or set `NODE_ENV=development`.

### 2. `DatabaseUnavailableError: MongooseServerSelectionError`
- **Cause**: `STORAGE_MODE` is set to `atlas`, but MongoDB Atlas IP whitelist does not include your local IP address.
- **Fix**: Add your current IP to MongoDB Atlas Network Access, or switch `STORAGE_MODE=local` in `.env` for offline file-backed development.

### 3. `Port 3000 is already in use`
- **Cause**: Another process or background development server is bound to port 3000.
- **Fix**: Identify and stop the occupying process:
  ```bash
  lsof -i :3000
  kill -9 <PID>
  ```
