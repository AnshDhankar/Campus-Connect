# 12 — Testing and Quality Assurance

- **Document Version**: 1.0.0
- **Status**: IMPLEMENTED AND VERIFIED
- **Last Reviewed**: 2026-11-11
- **Target Audience**: Quality Assurance Engineers, Test Automation Developers, Security Reviewers

---

## 1. Testing Philosophy & Decoupled Architecture

CampusConnect enforces an architectural separation between **safe in-memory unit tests** and **database-backed integration / UAT tests**. This structure ensures developers can run regression suites continuously without risking data pollution on shared development or production databases.

```mermaid
graph TD
    subgraph SafeSuite["1. Default Safe Test Command (npm test)"]
        UnitStorage["storage-config.test.ts (7 tests)"]
        UnitDemo["demo-credentials-security.test.ts (7 tests)"]
        UnitIDOR["tenant-student-deletion-security.test.ts (11 tests)"]
        UnitJWT["jwt-config-security.test.ts (11 tests)"]
        UnitSec["application-security.test.ts (8 tests)"]
        UnitSSRF["ssrf-protection.test.ts (9 tests)"]
        UnitResilience["resilience-and-analytics.test.ts (5 tests)"]
        UnitPhaseA["phase-a-unit.test.ts (5 tests)"]
    end

    subgraph GuardedUAT["2. Isolated UAT Suite (npm run test:uat)"]
        UatGuard["test/run-uat-guard.ts (Safety Pre-Flight)"]
        UatL7["uat-level7-verification.test.ts"]
        UatGap["level7-gap-verification.test.ts"]
        UatPhaseA["phase-a-remediation.test.ts"]
    end

    SafeSuite -->|Runs in Memory| ZeroDB["Zero DB Writes / Zero Network Pollution"]
    UatGuard -->|Requires TEST_MONGODB_URI != campusconnect| IsolatedDB[("Isolated Test Database Only")]
    IsolatedDB --> UatL7
    IsolatedDB --> UatGap
    IsolatedDB --> UatPhaseA
```

---

## 2. Default Test Command: Safe Unit Tests (`npm test`)

The default test script (`npm test`) executes **8 in-memory test suites** containing **63 total tests**. It completes in ~15 seconds with **zero network requests to localhost:3000 and zero writes to MongoDB**:

```bash
npm test
```

### Verified Suite Breakdown (63 / 63 Tests Passing):

| # | Test Suite File | Tested Functional Area | Test Count | DB Interaction | Status |
|---|---|---|:---:|:---:|:---:|
| 1 | `test/storage-config.test.ts` | Storage configuration decoupling & Atlas mode validation | 7 / 7 | None (In-Memory) | **PASS** |
| 2 | `test/demo-credentials-security.test.ts` | Demo credentials stripping in production (P0 Fix 1) | 7 / 7 | None (In-Memory) | **PASS** |
| 3 | `test/tenant-student-deletion-security.test.ts` | Multi-tenant IDOR defense & anti-enumeration 404 (P0 Fix 2) | 11 / 11 | Mock Requests | **PASS** |
| 4 | `test/jwt-config-security.test.ts` | Strict JWT secret validation & token signing (P0 Fix 3) | 11 / 11 | None (In-Memory) | **PASS** |
| 5 | `test/application-security.test.ts` | Helmet headers, CORS policies, CSRF tokens, rate limiters | 8 / 8 | Ephemeral Mock App | **PASS** |
| 6 | `test/ssrf-protection.test.ts` | RFC 1918, link-local, cloud metadata, scheme & port guards | 9 / 9 | Local Sockets | **PASS** |
| 7 | `test/resilience-and-analytics.test.ts` | Probes, timeouts, and idempotency cache replays | 5 / 5 | Mock App | **PASS** |
| 8 | `test/phase-a-unit.test.ts` | Binary magic bytes (PNG, JPEG), spoofing rejection, SSRF URLs | 5 / 5 | Pure Functions | **PASS** |
| **Total** | **All In-Memory Suites** | **Safe Regression Test Suite** | **63 / 63** | **Zero DB Writes** | **100% PASS** |

---

## 3. Explicit UAT Command & Safety Guard (`npm run test:uat`)

### The Isolation Runner (`test/run-uat-guard.ts`):
Integration workflows that create institutions, students, and complaints are grouped under `npm run test:uat`. To guarantee zero pollution on active shared databases, the runner enforces strict pre-flight assertions:
1. **Requires `TEST_MONGODB_URI`**: Aborts immediately if this variable is unset or empty.
2. **Never Falls Back to `MONGODB_URI`**: Does not inherit the active application database connection string.
3. **Rejects Protected Database Names**: Extracts the database name from the connection string. If the target is named `campusconnect`, `admin`, or `local`, execution halts with an error.
4. **Rejects Active URI Match**: If `TEST_MONGODB_URI === process.env.MONGODB_URI`, execution is aborted.

```bash
# Correct Isolated UAT Execution Command:
TEST_MONGODB_URI="mongodb+srv://test_user:pass@cluster.mongodb.net/campusconnect_isolated_uat" npm run test:uat
```

### Pre-Flight Safety Failure Examples:
```bash
$ npm run test:uat
❌ [FATAL SAFETY ABORT] Missing TEST_MONGODB_URI environment variable.
   UAT test suites create synthetic institutions, students, tickets and departments.
   Executing UAT tests against shared development or production databases is strictly forbidden.

$ TEST_MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/campusconnect" npm run test:uat
❌ [FATAL SAFETY ABORT] TEST_MONGODB_URI specifies protected database "campusconnect".
   UAT execution against "campusconnect", "admin", or "local" is strictly prohibited.
```

---

## 4. Build & Type Verification

Prior to pushing changes or cutting releases, two verification checks must be co-executed:

```bash
# 1. Type-Checking (TypeScript Compiler in no-emit mode)
npm run lint

# 2. Production Compilation (Vite client build + Esbuild server bundle)
npm run build
```

- **Pass Criteria**: `tsc --noEmit` must return exit code `0` with zero diagnostic errors. Both `dist/index.html` and `dist/server.cjs` must generate cleanly.

---

## 5. Performance & Load Benchmarking

```bash
npm run benchmark
```

- **Implementation**: `test/load-benchmark.ts`.
- **Target**: Benchmarks `/api/health/liveness` event loop throughput.
- **Measured Throughput**: **1,506 requests/second** at sub-10ms response latency on Node.js container runtime.
- **Limitation Note**: This benchmark evaluates the HTTP event loop; it does not measure MongoDB Atlas query latency or database connection pool contention.
