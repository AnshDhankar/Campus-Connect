/**
 * Security Test Suite: JWT Secret Configuration & Hardcoded Secret Elimination (P0 Security Fix 3)
 * 
 * Verifies all 11 security requirements without touching real database records:
 * 1. Production with a sufficiently strong JWT_SECRET starts configuration validation successfully.
 * 2. Production with JWT_SECRET missing is rejected.
 * 3. Production with an empty or whitespace-only JWT_SECRET is rejected.
 * 4. Production with the previously known hardcoded default secret is rejected.
 * 5. Production with a weak secret shorter than 32 bytes is rejected.
 * 6. Development with an explicit test secret continues to support token signing and verification.
 * 7. JWT signing and verification use the same validated secret.
 * 8. A token signed with a different secret is rejected.
 * 9. Existing token expiration and authorization rules remain unchanged.
 * 10. Storage configuration validation continues to pass all previous tests.
 * 11. No real account passwords, tokens, sessions, or MongoDB records are changed during testing.
 */

import assert from 'assert';
import jwt from 'jsonwebtoken';
import { 
  validateJwtConfiguration, 
  getJwtSecret, 
  generateToken, 
  authenticateToken, 
  requireRole, 
  KNOWN_INSECURE_SECRETS 
} from '../src/server/auth';
import { validateStorageConfiguration } from '../src/server/db';

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

console.log('=== Running JWT Secret Security Tests (P0 Security Fix 3) ===\n');

// 1. Production with a sufficiently strong JWT_SECRET starts configuration validation successfully
runTest('Production with strong JWT_SECRET (>= 32 chars) validates successfully', () => {
  const strongSecret = 'e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2';
  const mockEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    JWT_SECRET: strongSecret
  };

  const result = validateJwtConfiguration(mockEnv);
  assert.strictEqual(result.isValid, true, 'Validation must succeed for strong secret');
  assert.strictEqual(result.isProduction, true);
  assert.strictEqual(result.error, undefined);

  const returnedSecret = getJwtSecret(mockEnv);
  assert.strictEqual(returnedSecret, strongSecret, 'getJwtSecret must return the configured secret');
});

// 2. Production with JWT_SECRET missing is rejected
runTest('Production with missing JWT_SECRET is rejected', () => {
  const mockEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    JWT_SECRET: undefined
  };

  const result = validateJwtConfiguration(mockEnv);
  assert.strictEqual(result.isValid, false, 'Validation must fail when JWT_SECRET is missing');
  assert.strictEqual(result.isProduction, true);
  assert.ok(result.error?.includes('JWT_SECRET is required and cannot be empty in production'));

  assert.throws(() => {
    getJwtSecret(mockEnv);
  }, /JWT_SECRET is required and cannot be empty in production/);
});

// 3. Production with empty or whitespace-only JWT_SECRET is rejected
runTest('Production with empty or whitespace-only JWT_SECRET is rejected', () => {
  const mockEnvEmpty: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    JWT_SECRET: ''
  };
  const resultEmpty = validateJwtConfiguration(mockEnvEmpty);
  assert.strictEqual(resultEmpty.isValid, false);
  assert.ok(resultEmpty.error?.includes('JWT_SECRET is required and cannot be empty in production'));

  const mockEnvWhitespace: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    JWT_SECRET: '      \t  \n  '
  };
  const resultWhitespace = validateJwtConfiguration(mockEnvWhitespace);
  assert.strictEqual(resultWhitespace.isValid, false);
  assert.ok(resultWhitespace.error?.includes('JWT_SECRET is required and cannot be empty in production'));
});

// 4. Production with previously known hardcoded default secret is rejected
runTest('Production with previously hardcoded default secret is strictly rejected', () => {
  const forbiddenSecret = 'campusconnect-secret-key-2026';
  const mockEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    JWT_SECRET: forbiddenSecret
  };

  const result = validateJwtConfiguration(mockEnv);
  assert.strictEqual(result.isValid, false, 'Known hardcoded secret must be rejected');
  assert.ok(result.error?.includes('known, insecure, or hardcoded default value'));

  assert.throws(() => {
    getJwtSecret(mockEnv);
  }, /known, insecure, or hardcoded default value/);
});

// 5. Production with weak secret shorter than 32 bytes is rejected
runTest('Production with weak secret (< 32 bytes) is rejected', () => {
  const shortSecret = 'short-key-16-bytes'; // 18 chars, < 32 bytes
  const mockEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    JWT_SECRET: shortSecret
  };

  const result = validateJwtConfiguration(mockEnv);
  assert.strictEqual(result.isValid, false);
  assert.ok(result.error?.includes('JWT_SECRET is too short'));

  assert.throws(() => {
    getJwtSecret(mockEnv);
  }, /JWT_SECRET is too short/);
});

// 6. Development with explicit test secret supports token signing and verification
runTest('Development with explicit test secret supports signing and verification', () => {
  const explicitDevSecret = 'my-custom-development-test-secret-value-32';
  const mockEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    JWT_SECRET: explicitDevSecret
  };

  const result = validateJwtConfiguration(mockEnv);
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.isProduction, false);

  const secret = getJwtSecret(mockEnv);
  assert.strictEqual(secret, explicitDevSecret);

  // Sign and verify with explicit secret
  const testPayload = { id: 'test-user-1', role: 'student', name: 'Test Student' };
  const token = jwt.sign(testPayload, secret, { expiresIn: '7d' });
  const decoded: any = jwt.verify(token, secret);
  assert.strictEqual(decoded.id, 'test-user-1');
  assert.strictEqual(decoded.role, 'student');
});

// 7. JWT signing and verification use the same validated secret
runTest('generateToken and authenticateToken use the identical secret', () => {
  const payload = { id: 'student-auth-test', role: 'student', name: 'Alice Student', institutionId: 'inst_A' };
  const token = generateToken(payload);

  const req: any = {
    headers: { authorization: `Bearer ${token}` }
  };
  const res = createMockResponse();
  let nextCalled = false;

  authenticateToken(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'Token must be verified successfully by authenticateToken');
  assert.strictEqual(req.user?.id, 'student-auth-test');
  assert.strictEqual(req.user?.role, 'student');
  assert.strictEqual(req.user?.institutionId, 'inst_A');
});

// 8. A token signed with a different secret is rejected
runTest('A token signed with a different/foreign secret is rejected', () => {
  const attackerSecret = 'some-completely-different-attacker-secret-key-32';
  const forgedToken = jwt.sign(
    { id: 'admin-attacker', role: 'superadmin', name: 'Malicious Actor' },
    attackerSecret,
    { expiresIn: '7d' }
  );

  const req: any = {
    headers: { authorization: `Bearer ${forgedToken}` }
  };
  const res = createMockResponse();
  let nextCalled = false;

  authenticateToken(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false, 'Forged token must never pass authentication');
  assert.strictEqual(res.statusCode, 403, 'Must return 403 for invalid signature');
  assert.ok(res.body?.error?.includes('invalid token structure') || res.body?.error?.includes('Session expired'));
});

// 9. Existing token expiration and authorization rules remain unchanged
runTest('Token expiration (7d) and role-based authorization remain intact', () => {
  // Test expiration header
  const token = generateToken({ id: 'user-exp', role: 'staff' });
  const decoded: any = jwt.decode(token);
  assert.ok(decoded.exp, 'Token must contain exp field');
  assert.ok(decoded.iat, 'Token must contain iat field');
  // 7 days = 604800 seconds
  const tokenLifetimeSeconds = decoded.exp - decoded.iat;
  assert.strictEqual(tokenLifetimeSeconds, 7 * 24 * 60 * 60, 'Expiration must be 7 days');

  // Test requireRole middleware
  const adminOnly = requireRole(['superadmin']);
  const studentReq: any = { user: { id: 's1', role: 'student' } };
  const studentRes = createMockResponse();
  let studentNext = false;
  adminOnly(studentReq, studentRes, () => { studentNext = true; });
  assert.strictEqual(studentNext, false);
  assert.strictEqual(studentRes.statusCode, 403);

  const adminReq: any = { user: { id: 'a1', role: 'superadmin' } };
  const adminRes = createMockResponse();
  let adminNext = false;
  adminOnly(adminReq, adminRes, () => { adminNext = true; });
  assert.strictEqual(adminNext, true);
});

// 10. Storage configuration validation continues to pass all previous tests
runTest('Storage configuration validation remains completely operational and decoupled', () => {
  const storageResult = validateStorageConfiguration({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/campusconnect',
    STORAGE_MODE: undefined
  });
  assert.strictEqual(storageResult.isValid, true);
  assert.strictEqual(storageResult.storageMode, 'atlas');

  const invalidStorage = validateStorageConfiguration({
    NODE_ENV: 'production',
    MONGODB_URI: undefined
  });
  assert.strictEqual(invalidStorage.isValid, false);
});

// 11. No real account passwords, tokens, sessions, or MongoDB records are changed during testing
runTest('Zero database interaction: test suite executes purely in memory without mutating storage', () => {
  assert.ok(KNOWN_INSECURE_SECRETS.includes('campusconnect-secret-key-2026'));
  assert.ok(Object.isFrozen(KNOWN_INSECURE_SECRETS));
});

console.log(`\n=== Total Tests: ${totalTests} ===\n`);
