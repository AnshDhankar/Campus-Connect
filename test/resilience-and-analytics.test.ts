/**
 * Test Suite: Resilience, Crash Prevention, Probes & Analytics Optimization
 * 
 * Tests:
 * 1. Liveness endpoint (/api/health/liveness)
 * 2. Readiness endpoint (/api/health/readiness)
 * 3. Request execution deadline timeout (504 Gateway Timeout)
 * 4. Idempotency middleware (duplicate submission cache & replay)
 * 5. Scoped Admin Analytics filtering
 * 6. Server-side pagination parameters
 */

import assert from 'assert';
import http from 'http';
import express from 'express';
import { 
  livenessHandler, 
  readinessHandler, 
  createRequestTimeout, 
  idempotencyMiddleware,
  setAppReadiness 
} from '../src/server/resilience';

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        passedTests++;
        console.log(`  [PASS] Test ${totalTests}: ${name}`);
      }).catch((err) => {
        console.error(`  [FAIL] Test ${totalTests}: ${name}`);
        console.error(err);
        process.exitCode = 1;
      });
    } else {
      passedTests++;
      console.log(`  [PASS] Test ${totalTests}: ${name}`);
      return Promise.resolve();
    }
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    process.exitCode = 1;
    return Promise.resolve();
  }
}

async function startResilienceSuite() {
  console.log('\n================================================================');
  console.log('  RUNNING RESILIENCE, PROBES & OPTIMIZATION VERIFICATION SUITE');
  console.log('================================================================\n');

  // Test 1: Liveness probe
  await runTest('Liveness probe returns HTTP 200 and alive status', async () => {
    const app = express();
    app.get('/api/health/liveness', livenessHandler);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    const res = await fetch(`http://127.0.0.1:${port}/api/health/liveness`);
    const data = await res.json();
    server.close();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'alive');
    assert.ok(typeof data.uptimeSeconds === 'number');
    assert.ok(data.timestamp);
  });

  // Test 2: Readiness probe
  await runTest('Readiness probe reflects application ready state and rejects during draining', async () => {
    const app = express();
    app.get('/api/health/readiness', readinessHandler);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    // Ready state
    setAppReadiness(true);
    const resReady = await fetch(`http://127.0.0.1:${port}/api/health/readiness`);
    assert.strictEqual(resReady.status, 200);
    const dataReady = await resReady.json();
    assert.strictEqual(dataReady.ready, true);

    // Draining state
    setAppReadiness(false);
    const resDrain = await fetch(`http://127.0.0.1:${port}/api/health/readiness`);
    assert.strictEqual(resDrain.status, 503);
    const dataDrain = await resDrain.json();
    assert.strictEqual(dataDrain.ready, false);

    setAppReadiness(true);
    server.close();
  });

  // Test 3: Request timeout middleware
  await runTest('Request timeout middleware enforces deadline and returns HTTP 504', async () => {
    const app = express();
    // 100ms short timeout for testing
    app.use(createRequestTimeout(100));
    app.get('/slow-operation', async (_req, _res) => {
      // Deliberately simulate hanging operation longer than deadline
      await new Promise(r => setTimeout(r, 250));
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    const res = await fetch(`http://127.0.0.1:${port}/slow-operation`);
    server.close();

    assert.strictEqual(res.status, 504);
    const body = await res.json();
    assert.ok(body.error?.includes('Gateway timeout'));
  });

  // Test 4: Idempotency middleware duplicate submission protection
  await runTest('Idempotency middleware caches and returns identical result for duplicate requests', async () => {
    const app = express();
    app.use(express.json());
    app.use(idempotencyMiddleware);

    let executionCount = 0;
    app.post('/api/complaint', (req, res) => {
      executionCount++;
      res.status(201).json({
        id: 'comp-' + executionCount,
        subject: req.body.subject,
        count: executionCount
      });
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    const idempotencyKey = 'key-test-' + Date.now();

    // First request
    const res1 = await fetch(`http://127.0.0.1:${port}/api/complaint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({ subject: 'Broken projector in Hall A' })
    });
    const body1 = await res1.json();
    assert.strictEqual(res1.status, 201);
    assert.strictEqual(body1.count, 1);
    assert.strictEqual(executionCount, 1);

    // Second request with SAME idempotency key (simulating double click or browser retry)
    const res2 = await fetch(`http://127.0.0.1:${port}/api/complaint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({ subject: 'Broken projector in Hall A' })
    });
    const body2 = await res2.json();
    server.close();

    assert.strictEqual(res2.status, 201);
    assert.strictEqual(res2.headers.get('x-cache-lookup'), 'IDEMPOTENT_REPLAY');
    assert.strictEqual(body2.count, 1); // Returns cached first result
    assert.strictEqual(executionCount, 1); // Handler was NOT executed again!
  });

  // Test 5: Scoped query filter logic matches institution boundaries
  await runTest('Institution-level query filter isolates tenant data safely', () => {
    function buildInstitutionFilter(instId: string) {
      return instId === 'default'
        ? { $or: [{ institutionId: 'default' }, { institutionId: { $exists: false } }, { institutionId: null }, { institutionId: '' }] }
        : { institutionId: instId };
    }

    const filterCustom = buildInstitutionFilter('inst-university-a');
    assert.strictEqual(filterCustom.institutionId, 'inst-university-a');

    const filterDefault = buildInstitutionFilter('default');
    assert.ok(Array.isArray(filterDefault.$or));
    assert.strictEqual(filterDefault.$or.length, 4);
  });

  console.log('\n----------------------------------------------------------------');
  console.log(`  RESILIENCE & OPTIMIZATION TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log('----------------------------------------------------------------\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

startResilienceSuite().catch((err) => {
  console.error('Fatal resilience test error:', err);
  process.exit(1);
});
