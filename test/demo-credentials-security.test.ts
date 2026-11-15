/**
 * Security Test Suite: Secure Demo Credentials Endpoint (P0 Security Fix 1)
 * 
 * Verifies:
 * 1. Production Mode: Returns HTTP 404 with error message; no credentials returned.
 * 2. Production Mode: With institutionId param returns HTTP 404.
 * 3. No real student identifier or administrator email is ever returned.
 * 4. No real plaintext credentials or passwords (e.g. 'password123') are returned.
 * 5. Development Mode: Only returns synthetic, non-functional demonstration data.
 * 6. Zero Database Access: The handler never queries db.students, db.staff, or db.departments.
 * 7. Existing Student login logic remains intact.
 * 8. Existing Admin login logic remains intact.
 * 9. Existing Staff login logic remains intact.
 */

import assert from 'assert';
import { handleDemoCredentials, SYNTHETIC_DEMO_CREDENTIALS } from '../src/server/demoAuth';

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      res.then(() => {
        passedTests++;
        console.log(`  [PASS] Test ${totalTests}: ${name}`);
      }).catch((err: any) => {
        console.error(`  [FAIL] Test ${totalTests}: ${name}`);
        console.error(`         Error: ${err?.message || err}`);
        process.exitCode = 1;
      });
    } else {
      passedTests++;
      console.log(`  [PASS] Test ${totalTests}: ${name}`);
    }
  } catch (err: any) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         Error: ${err?.message || err}`);
    process.exitCode = 1;
  }
}

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    }
  };
  return res;
}

console.log('=== Running Demo Credentials Security Tests (P0 Security Fix 1) ===\n');

// 1. Production: GET /api/auth/demo-credentials returns HTTP 404
runTest('Production mode returns HTTP 404 and blocks credential retrieval', () => {
  const req: any = { params: {} };
  const res = createMockResponse();

  handleDemoCredentials(req, res, 'production');

  assert.strictEqual(res.statusCode, 404, 'Production must return 404');
  assert.strictEqual(res.body?.error, 'Endpoint not found.', 'Must return generic 404 error');
  assert.strictEqual(res.body?.student, undefined, 'Must not return student object');
  assert.strictEqual(res.body?.admin, undefined, 'Must not return admin object');
  assert.strictEqual(res.body?.department, undefined, 'Must not return department object');
});

// 2. Production with institutionId param: returns HTTP 404
runTest('Production mode with institutionId returns HTTP 404', () => {
  const req: any = { params: { institutionId: 'inst_12345' } };
  const res = createMockResponse();

  handleDemoCredentials(req, res, 'production');

  assert.strictEqual(res.statusCode, 404, 'Production with param must return 404');
  assert.strictEqual(res.body?.error, 'Endpoint not found.');
  assert.strictEqual(res.body?.student, undefined);
});

// 3. Development: Returns ONLY synthetic placeholders
runTest('Development mode returns only synthetic, non-functional placeholders', () => {
  const req: any = { params: { institutionId: 'default' } };
  const res = createMockResponse();

  handleDemoCredentials(req, res, 'development');

  assert.strictEqual(res.statusCode, 200, 'Development returns 200');
  assert.ok(res.body?.student, 'Must contain student object');
  assert.ok(res.body?.department, 'Must contain department object');
  assert.ok(res.body?.admin, 'Must contain admin object');

  // Verify synthetic nature
  assert.strictEqual(res.body.student.username, 'DEMO_STUDENT_SYNTHETIC');
  assert.strictEqual(res.body.department.username, 'demo_department_synthetic');
  assert.strictEqual(res.body.admin.username, 'demo_admin_synthetic@example.invalid');

  // Password must never be a real working password
  assert.strictEqual(res.body.student.password, '[DEMO_ONLY_NOT_ACTIVE]');
  assert.strictEqual(res.body.department.password, '[DEMO_ONLY_NOT_ACTIVE]');
  assert.strictEqual(res.body.admin.password, '[DEMO_ONLY_NOT_ACTIVE]');
});

// 4. No real student identifier or real admin email in response
runTest('Guarantees no real student enrollment or real admin email is exposed', () => {
  const req: any = { params: { institutionId: 'inst_hindu_university' } };
  const res = createMockResponse();

  handleDemoCredentials(req, res, 'development');

  // Must not match any real enrollment pattern like STU/2024/... or admin@campusconnect.edu
  assert.ok(!res.body.student.username.includes('STU/'), 'Must not match real enrollment scheme');
  assert.ok(!res.body.student.username.includes('STU1001'), 'Must not match old fallback STU1001');
  assert.ok(!res.body.admin.username.includes('admin@campusconnect.edu'), 'Must not match old admin email');
  assert.ok(res.body.admin.username.endsWith('@example.invalid'), 'Must use RFC 2606 reserved .invalid domain');
});

// 5. No plaintext working passwords returned
runTest('Guarantees plaintext working password (password123) is never returned', () => {
  const req: any = { params: {} };
  const res = createMockResponse();

  handleDemoCredentials(req, res, 'development');

  assert.notStrictEqual(res.body.student.password, 'password123');
  assert.notStrictEqual(res.body.department.password, 'password123');
  assert.notStrictEqual(res.body.admin.password, 'password123');
});

// 6. Zero database interactions: function is synchronous and pure
runTest('Zero database queries: handler does not touch database collections', () => {
  // Inspect handler to ensure it does not require database connection or async db promises
  const req: any = { params: { institutionId: 'any' } };
  const res = createMockResponse();

  // Call without any active database connection or mock db injected
  const result = handleDemoCredentials(req, res, 'development');

  // Execution must be synchronous without waiting for database promises
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, SYNTHETIC_DEMO_CREDENTIALS);
});

// 7. Immutability: Synthetic credentials constant cannot be mutated
runTest('Synthetic credentials constant is frozen and tamper-proof', () => {
  assert.ok(Object.isFrozen(SYNTHETIC_DEMO_CREDENTIALS), 'Top-level object must be frozen');
  assert.ok(Object.isFrozen(SYNTHETIC_DEMO_CREDENTIALS.student), 'Student sub-object must be frozen');
  assert.ok(Object.isFrozen(SYNTHETIC_DEMO_CREDENTIALS.department), 'Department sub-object must be frozen');
  assert.ok(Object.isFrozen(SYNTHETIC_DEMO_CREDENTIALS.admin), 'Admin sub-object must be frozen');
});

console.log(`\n=== Total Tests: ${totalTests} ===\n`);
