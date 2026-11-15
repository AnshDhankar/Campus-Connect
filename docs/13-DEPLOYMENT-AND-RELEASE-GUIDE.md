# 13 — Deployment and Release Guide

- **Document Version**: 1.0.0
- **Status**: IMPLEMENTED AND VERIFIED
- **Last Reviewed**: 2026-11-11
- **Target Audience**: DevOps Engineers, Release Managers, Cloud Architects, System Administrators

---

## 1. Current Verified Development Environment

CampusConnect currently operates in a containerized Linux development runtime on Google Cloud infrastructure:

- **Service Identifier**: `K_SERVICE=ais-dev-rffd2gzlzdkawbcvq3km73`
- **Execution Port**: Local Node server listening on `3000` (mapped to external HTTP proxy `8080`).
- **Development URLs**:
  - Development Workspace: `https://ais-dev-rffd2gzlzdkawbcvq3km73-973452593273.asia-southeast1.run.app`
  - Preview URL: `https://ais-pre-rffd2gzlzdkawbcvq3km73-973452593273.asia-southeast1.run.app`
- **Active Database**: MongoDB Atlas cluster connected over TLS in `atlas` mode.
- **Egress IP**: Dynamic egress IP (`34.96.48.154`).

---

## 2. Staging Deployment Architecture

*(Status: PLANNED — Requires Staging Cloud Run & Database Namespace Provisioning)*

The proposed staging topology replicates production with complete data isolation:
- **Cloud Run Service**: `campusconnect-staging`
- **Database Namespace**: `campusconnect_staging` (isolated Atlas database)
- **Deployment Gate**: Code branches pass `npm run lint` and `npm test` prior to promoting to staging.

---

## 3. Intended Production Cloud Architecture

```mermaid
graph TB
    subgraph Users["End Users"]
        Browser["Web Browser (HTTPS)"]
    end

    subgraph GoogleCloud["Google Cloud Platform (asia-southeast1)"]
        CloudDNS["Cloud DNS (Custom Domain)"]
        LoadBalancer["Global External HTTPS Load Balancer"]
        CloudRun["Cloud Run Service (campusconnect-prod)"]
        SecretManager["Secret Manager (MONGODB_URI, JWT_SECRET, RESEND_KEY)"]
        VpcConnector["Serverless VPC Access Connector"]
        CloudNat["Cloud NAT Gateway + Reserved Static Egress IP"]
        GcsBucket["Google Cloud Storage Bucket (Attachments)"]
    end

    subgraph DatabaseCloud["MongoDB Atlas (Cloud Cluster)"]
        AtlasCluster[("MongoDB Atlas Production Cluster")]
        AtlasFirewall["Atlas Network Access (Restricted to Cloud NAT Static IP)"]
    end

    Browser -->|TLS 1.3 / Custom Domain| CloudDNS
    CloudDNS --> LoadBalancer
    LoadBalancer --> CloudRun
    SecretManager -.->|Injected as Env Vars| CloudRun
    CloudRun -->|Attachment Writes| GcsBucket
    CloudRun -->|VPC Egress (All Traffic)| VpcConnector
    VpcConnector --> CloudNat
    CloudNat -->|Deterministic Static IP 34.x.x.x| AtlasFirewall
    AtlasFirewall --> AtlasCluster
```

---

## 4. Production Deployment Runbook

> ⚠️ **NOTE**: Where infrastructure is not yet provisioned, steps are marked:  
> **`[NOT YET CONFIGURED — REQUIRES INFRASTRUCTURE APPROVAL]`**

### Step 1: Pre-Deployment Build & Verification Checklist
Before initiating any deployment, execute the following locally or in CI:

```bash
# 1. Clean previous build artifacts
npm run clean

# 2. Run TypeScript static type inspection
npm run lint

# 3. Execute safe unit test regression suite
npm test

# 4. Compile production client SPA and standalone server bundle
npm run build
```

Verify that the output directory contains:
- `dist/index.html` (Client SPA entry point).
- `dist/assets/` (Hashed JavaScript and CSS bundles).
- `dist/server.cjs` (Compiled Node.js CommonJS server bundle).

---

### Step 2: Container Image Build & Push
*(Status: Standard Docker Container Pipeline)*

```bash
# Set deployment variables (Replace placeholders)
export PROJECT_ID="YOUR_GCP_PROJECT_ID"
export REGION="asia-southeast1"
export IMAGE_TAG="asia-southeast1-docker.pkg.dev/${PROJECT_ID}/campusconnect/server:v1.0.0"

# Build container image via Google Cloud Build
gcloud builds submit --tag ${IMAGE_TAG} .
```

---

### Step 3: Google Cloud Secret Manager Provisioning
*(Status: NOT YET CONFIGURED — REQUIRES INFRASTRUCTURE APPROVAL)*

Create and store production credentials in Secret Manager:

```bash
# 1. Production MongoDB Atlas URI
echo -n "mongodb+srv://prod_user:password@cluster.mongodb.net/campusconnect?retryWrites=true&w=majority" | \
gcloud secrets create campusconnect-mongo-uri --data-file=-

# 2. Production JWT Secret (Minimum 32 bytes high entropy)
openssl rand -base64 48 | tr -d '\n' | \
gcloud secrets create campusconnect-jwt-secret --data-file=-

# 3. Production Resend API Key
echo -n "re_live_production_key" | \
gcloud secrets create campusconnect-resend-key --data-file=-
```

---

### Step 4: Cloud Run Production Service Deployment
*(Status: NOT YET CONFIGURED — REQUIRES INFRASTRUCTURE APPROVAL)*

Deploy the verified image to Cloud Run mounting Secret Manager keys:

```bash
gcloud run deploy campusconnect-prod \
  --image ${IMAGE_TAG} \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 1 \
  --max-instances 10 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars "NODE_ENV=production,STORAGE_MODE=atlas,APP_URL=https://campusconnect.yourcollege.edu" \
  --set-secrets "MONGODB_URI=campusconnect-mongo-uri:latest,JWT_SECRET=campusconnect-jwt-secret:latest,RESEND_API_KEY=campusconnect-resend-key:latest"
```

---

### Step 5: Post-Deployment Smoke Verification & Health Probes

Immediately verify the deployed revision using the standardized health probes:

```bash
# 1. Verify Event Loop Liveness (Expects HTTP 200 { "status": "alive" })
curl -fsS https://campusconnect.yourcollege.edu/api/health/liveness

# 2. Verify Database Readiness (Expects HTTP 200 { "status": "ready", "database": "connected" })
curl -fsS https://campusconnect.yourcollege.edu/api/health/readiness

# 3. Verify Institution Directory (Expects HTTP 200 with college profile)
curl -fsS https://campusconnect.yourcollege.edu/api/institutions
```

---

### Step 6: Rollback Procedure
If readiness probes return `503` or unexpected errors occur during deployment:

```bash
# Identify previous healthy revision
gcloud run revisions list --service campusconnect-prod --region ${REGION}

# Roll back 100% of traffic immediately to previous revision
gcloud run services update-traffic campusconnect-prod \
  --region ${REGION} \
  --to-revisions PREVIOUS_HEALTHY_REVISION_NAME=100
```
