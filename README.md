# CampusConnect (College Help & Complaint Management System)

A full-stack, multi-tenant college helpdesk and complaint management system built with React, TypeScript, Tailwind CSS, Express, and MongoDB Atlas. It isolates institutions, routes student requests to academic/administrative departments, provides real-time status tracking, and equips institution administrators with analytics and audit logs.

---

## Key Capabilities

- **Multi-Tenant Institution Isolation**: Supports completely isolated institution workspaces (`HINDU UNIVERSITY`, etc.) with role-scoped access for **Students**, **Department Staff**, and **Institution Super Admins**.
- **Automated Ticket Routing**: Dispatches student help requests and complaints to the matching department (`academic`, `hostel`, `accounts`, `itsupport`, `examination`, `library`, `transport`, `placement`, `administration`).
- **Security Hardening**: Bcrypt password hashing, HttpOnly JWT session cookies, double-submit CSRF verification, Helmet CSP headers, SSRF-safe website logo scraping, rate limiting, and audit trails.
- **Persistent MongoDB Atlas + Local Dev Support**: Uses MongoDB Atlas in production/Vercel and optionally supports local `.data/` JSON storage in offline development.
- **Light & Dark Themes**: Responsive UI across desktop and mobile viewports.

---

## 1. Running Locally (VS Code / Any Editor)

### Prerequisites
- **Node.js 20+** and **npm**
- A **MongoDB Atlas** connection string (recommended so your local environment uses the exact same live HINDU UNIVERSITY data)

### Setup Steps
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your local `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Fill in `.env` with your local configuration:
   ```env
   PORT=3000
   NODE_ENV=development
   MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/campusconnect?retryWrites=true&w=majority"
   JWT_SECRET="replace-with-a-random-32-plus-character-secret"
   APP_URL="http://localhost:3000"
   RESEND_API_KEY="re_..."
   ```
4. Start the full-stack dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

5. Verify TypeScript, build, and non-mutating security tests:
   ```bash
   npm run lint
   npm test
   ```

---

## 2. Pushing Safely to GitHub

`.gitignore` excludes `.env*`, `.data/`, `node_modules/`, `dist/`, and `.vercel/` so secrets and local files are never committed.

```bash
git init
git add .
git status   # Confirm .env and .data/ are NOT listed
git commit -m "Configure CampusConnect for local dev and Vercel deployment"
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

---

## 3. Deploying Globally for Free on Vercel

CampusConnect includes `vercel.json` and `api/index.ts`, allowing both the **React frontend** and **Express `/api/*` backend** to deploy together in a single free Vercel project.

### Step A: Configure MongoDB Atlas Network Access
1. In **MongoDB Atlas** -> **Network Access**, add `0.0.0.0/0` (Allow Access from Anywhere), since Vercel Serverless Functions use dynamic outbound IPs.

### Step B: Import & Configure in Vercel
1. Go to [Vercel](https://vercel.com) -> **Add New -> Project** and import your GitHub repository.
2. Vercel auto-detects `vercel.json` (`npm run vercel-build` -> `dist/` + `api/index.ts` serverless backend).
3. Add the following **Environment Variables** in **Vercel Project Settings -> Environment Variables**:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = `mongodb+srv://...` (your Atlas connection string)
   - `JWT_SECRET` = `<your 32+ character cryptographically random secret>`
   - `APP_URL` = `https://<your-project>.vercel.app` (update after first deploy or attach custom domain)
   - `RESEND_API_KEY` = `re_...` *(optional, required for sending OTP/notification emails)*
4. Click **Deploy**.
