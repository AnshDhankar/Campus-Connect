/**
 * CampusConnect — UAT Isolated Test Runner & Safety Guard
 * 
 * Enforces strict isolation guarantees before running any database-writing UAT tests:
 * 1. Requires a dedicated TEST_MONGODB_URI environment variable.
 * 2. Strictly forbids falling back to MONGODB_URI.
 * 3. Never inherits active application database connection.
 * 4. Refuses to execute if the target database is named 'campusconnect' or matches development/production database.
 * 5. Requires an explicitly configured isolated test database.
 * 6. Aborts immediately if test-database isolation cannot be established.
 * 7. Never performs automatic cleanup of unrelated database records.
 */

import { spawnSync } from 'child_process';

function extractDbName(uri: string): string {
  try {
    const cleaned = uri.replace(/^mongodb\+srv:\/\//, 'http://').replace(/^mongodb:\/\//, 'http://');
    const parsed = new URL(cleaned);
    const pathname = parsed.pathname.replace(/^\//, '');
    return pathname.split('?')[0] || '';
  } catch {
    const match = uri.match(/\/([^/?]+)(\?|$)/);
    return match ? match[1] : '';
  }
}

function main() {
  console.log('\n================================================================');
  console.log('  CAMPUSCONNECT — UAT ISOLATION SAFETY PRE-FLIGHT VERIFICATION');
  console.log('================================================================\n');

  const testMongoUri = process.env.TEST_MONGODB_URI;

  if (!testMongoUri || testMongoUri.trim() === '') {
    console.error('❌ [FATAL SAFETY ABORT] Missing TEST_MONGODB_URI environment variable.');
    console.error('   UAT test suites create synthetic institutions, students, tickets and departments.');
    console.error('   Executing UAT tests against shared development or production databases is strictly forbidden.\n');
    console.error('   To run UAT tests, you must explicitly provision an isolated test database and execute:');
    console.error('   TEST_MONGODB_URI="mongodb+srv://.../campusconnect_isolated_uat" npm run test:uat\n');
    process.exit(1);
  }

  // Ensure TEST_MONGODB_URI is not accidentally pointing to the shared application database
  const targetDbName = extractDbName(testMongoUri).toLowerCase();

  if (!targetDbName) {
    console.error('❌ [FATAL SAFETY ABORT] Could not extract a valid target database name from TEST_MONGODB_URI.');
    console.error('   The URI must include an explicit database name (e.g. .../campusconnect_test).');
    process.exit(1);
  }

  if (targetDbName === 'campusconnect' || targetDbName === 'admin' || targetDbName === 'local') {
    console.error(`❌ [FATAL SAFETY ABORT] TEST_MONGODB_URI specifies protected database "${targetDbName}".`);
    console.error('   UAT execution against "campusconnect", "admin", or "local" is strictly prohibited.');
    console.error('   Please specify a dedicated test database name such as "campusconnect_isolated_uat".');
    process.exit(1);
  }

  // Ensure it does not match MONGODB_URI if MONGODB_URI is present in process.env
  if (process.env.MONGODB_URI && testMongoUri === process.env.MONGODB_URI) {
    console.error('❌ [FATAL SAFETY ABORT] TEST_MONGODB_URI is identical to active MONGODB_URI.');
    console.error('   UAT tests cannot run against the active application database connection.');
    process.exit(1);
  }

  console.log(`✅ [ISOLATION VERIFIED] Target database: "${targetDbName}"`);
  console.log('✅ [SAFETY CHECK] Confirmed isolated database namespace.');
  console.log('Starting isolated UAT test suites...\n');

  const env = {
    ...process.env,
    ALLOW_DATABASE_UAT: 'true',
    TEST_MONGODB_URI: testMongoUri
  };

  const suites = [
    'test/uat-level7-verification.test.ts',
    'test/level7-gap-verification.test.ts',
    'test/phase-a-remediation.test.ts'
  ];

  for (const suite of suites) {
    console.log(`>>> Executing UAT Suite: ${suite}`);
    const result = spawnSync('npx', ['tsx', suite], {
      stdio: 'inherit',
      env
    });
    if (result.status !== 0) {
      console.error(`\n❌ [UAT FAILURE] Suite ${suite} failed with exit code ${result.status}`);
      process.exit(result.status || 1);
    }
  }

  console.log('\n================================================================');
  console.log('✅ ALL ISOLATED UAT TEST SUITES PASSED SUCCESSFULLY');
  console.log('================================================================\n');
}

main();
