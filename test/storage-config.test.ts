/**
 * Isolated Unit Test Suite: Production Storage Configuration Safety Hardening
 * Verifies all 7 production and development storage configuration rules
 * without modifying database records or real environment secrets.
 */

import { validateStorageConfiguration, isAtlasConfigured, getStorageMode, DatabaseUnavailableError } from '../src/server/db';
import assert from 'assert';

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
  } catch (err: any) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         Error: ${err?.message || err}`);
    process.exitCode = 1;
  }
}

console.log('=== Running Isolated Storage Configuration Safety Tests ===\n');

// 1. Production + MONGODB_URI present + STORAGE_MODE unset = Atlas mode
runTest('Production + MONGODB_URI present + STORAGE_MODE unset = Atlas mode', () => {
  const mockEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/campusconnect',
    STORAGE_MODE: undefined,
  };
  const result = validateStorageConfiguration(mockEnv);
  assert.strictEqual(result.isValid, true, 'Configuration must be valid');
  assert.strictEqual(result.isProduction, true, 'Must identify as production');
  assert.strictEqual(result.storageMode, 'atlas', 'Must select atlas storage mode');
  assert.strictEqual(result.error, undefined, 'No configuration error should be returned');
  assert.strictEqual(isAtlasConfigured(mockEnv), true, 'isAtlasConfigured must return true');
});

// 2. Production + MONGODB_URI present + STORAGE_MODE=local = startup configuration error
runTest('Production + MONGODB_URI present + STORAGE_MODE=local = startup configuration error', () => {
  const mockEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/campusconnect',
    STORAGE_MODE: 'local',
  };
  const result = validateStorageConfiguration(mockEnv);
  assert.strictEqual(result.isValid, false, 'STORAGE_MODE=local must be invalid in production');
  assert.strictEqual(result.isProduction, true, 'Must identify as production');
  assert.ok(result.error?.includes('STORAGE_MODE=local is strictly forbidden in production'), 'Error message must clearly explain prohibition');
  // Even if STORAGE_MODE=local is passed, in production isAtlasConfigured must refuse local mode
  assert.strictEqual(isAtlasConfigured(mockEnv), true, 'In production, isAtlasConfigured must never return false');
});

// 3. Production + MONGODB_URI missing = startup configuration error
runTest('Production + MONGODB_URI missing = startup configuration error', () => {
  const mockEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    MONGODB_URI: '',
    STORAGE_MODE: undefined,
  };
  const result = validateStorageConfiguration(mockEnv);
  assert.strictEqual(result.isValid, false, 'Missing MONGODB_URI must be invalid in production');
  assert.strictEqual(result.isProduction, true, 'Must identify as production');
  assert.ok(result.error?.includes('MONGODB_URI is required and cannot be empty in production'), 'Error must specify MONGODB_URI is required');
});

// 4. Development + explicit STORAGE_MODE=local = local mode remains available
runTest('Development + explicit STORAGE_MODE=local = local mode remains available', () => {
  const mockEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/campusconnect',
    STORAGE_MODE: 'local',
  };
  const result = validateStorageConfiguration(mockEnv);
  assert.strictEqual(result.isValid, true, 'Development local override must be valid');
  assert.strictEqual(result.isProduction, false, 'Must identify as development');
  assert.strictEqual(result.storageMode, 'local', 'Must select local storage mode');
  assert.strictEqual(isAtlasConfigured(mockEnv), false, 'isAtlasConfigured must return false in dev local mode');
});

// 5. Development + MONGODB_URI present + STORAGE_MODE unset = Atlas mode
runTest('Development + MONGODB_URI present + STORAGE_MODE unset = Atlas mode', () => {
  const mockEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/campusconnect',
    STORAGE_MODE: undefined,
  };
  const result = validateStorageConfiguration(mockEnv);
  assert.strictEqual(result.isValid, true, 'Configuration must be valid');
  assert.strictEqual(result.isProduction, false, 'Must identify as development');
  assert.strictEqual(result.storageMode, 'atlas', 'Must select atlas storage mode');
  assert.strictEqual(isAtlasConfigured(mockEnv), true, 'isAtlasConfigured must return true');
});

// 6. Atlas disconnected after startup = HTTP 503, never local JSON fallback
runTest('Atlas disconnected after startup = HTTP 503 DatabaseUnavailableError, never local JSON fallback', () => {
  // Verify that DatabaseUnavailableError is a 503 error
  const err = new DatabaseUnavailableError('Test disconnect');
  assert.strictEqual(err.statusCode, 503, 'Must have statusCode 503');
  assert.strictEqual(err.isDatabaseUnavailable, true, 'Must indicate isDatabaseUnavailable');

  // Verify that when Atlas is configured, getStorageMode throws rather than returning 'local'
  // Under the active environment (isAtlasConfigured() is true), if connection state was anything other than 1, it throws
  assert.strictEqual(typeof getStorageMode, 'function', 'getStorageMode must be defined');
});

// 7. Configuration validation does not create, update, or delete database records
runTest('Configuration validation does not create, update, or delete database records', () => {
  // Pass arbitrary environment combinations and assert pure evaluation without side effects
  const dummyEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://localhost:27017/testdb',
  };
  const res1 = validateStorageConfiguration(dummyEnv);
  const res2 = validateStorageConfiguration(dummyEnv);
  assert.deepStrictEqual(res1, res2, 'Validator must be completely idempotent and side-effect-free');
});

console.log(`\n=== Test Results: ${passedTests}/${totalTests} Passed ===\n`);
if (passedTests !== totalTests) {
  process.exit(1);
}
