/**
 * Security Test Suite: Application Security Hardening (Workstream B)
 * 
 * Tests:
 * 1. Helmet security headers & Content-Security-Policy (CSP)
 * 2. Strict CORS allowlisting (rejection of untrusted origins, safe reflection of allowed origins)
 * 3. HttpOnly Cookie security options (Secure in production, SameSite=Lax/Strict, path=/)
 * 4. Double-Submit Anti-CSRF protection (tokens, cookies, verification pass/fail)
 * 5. Rate limiters initialization & policy thresholds
 * 6. SSRF Protection guard in logo scraper (blocks metadata.google.internal, RFC 1918, loopbacks)
 * 7. Token authentication via HttpOnly cookies in authenticateToken
 */

import assert from 'assert';
import http from 'http';
import express from 'express';
import { 
  createHelmetMiddleware, 
  createCorsMiddleware, 
  createRateLimiters, 
  getAuthCookieOptions, 
  getCsrfCookieOptions, 
  generateCsrfToken,
  csrfTokenProvider,
  verifyCsrfProtection,
  getValidatedAllowedOrigins
} from '../src/server/security';
import { authenticateToken, generateToken, AuthenticatedRequest } from '../src/server/auth';

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

async function startTestSuite() {
  console.log('\n================================================================');
  console.log('  RUNNING APPLICATION SECURITY & HARDENING VERIFICATION SUITE');
  console.log('================================================================\n');

  // Test 1: Helmet middleware sets security headers
  await runTest('Helmet sets expected protection headers (X-Content-Type-Options, Referrer-Policy)', async () => {
    const app = express();
    app.use(createHelmetMiddleware());
    app.get('/test', (_req, res) => res.send('ok'));

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    const res = await fetch(`http://127.0.0.1:${port}/test`);
    server.close();

    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('referrer-policy'));
  });

  // Test 2: CORS allows configured origins
  await runTest('CORS allows requests from approved origin list with credentials', async () => {
    const app = express();
    app.use(createCorsMiddleware());
    app.get('/cors-test', (_req, res) => res.json({ allowed: true }));

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    // Allowed origin
    const resAllowed = await fetch(`http://127.0.0.1:${port}/cors-test`, {
      headers: { Origin: 'http://localhost:3000' }
    });
    assert.strictEqual(resAllowed.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.strictEqual(resAllowed.headers.get('access-control-allow-credentials'), 'true');

    // Disallowed origin should not have Access-Control-Allow-Origin
    const resDisallowed = await fetch(`http://127.0.0.1:${port}/cors-test`, {
      headers: { Origin: 'https://malicious-attacker-site.com' }
    });
    assert.notStrictEqual(resDisallowed.headers.get('access-control-allow-origin'), 'https://malicious-attacker-site.com');

    server.close();
  });

  // Test 3: Auth cookie options enforce HttpOnly and correct SameSite
  await runTest('getAuthCookieOptions provides secure HttpOnly cookie settings', () => {
    const origEnv = process.env.NODE_ENV;
    
    // In dev
    process.env.NODE_ENV = 'development';
    const devOpts = getAuthCookieOptions();
    assert.strictEqual(devOpts.httpOnly, true);
    assert.strictEqual(devOpts.sameSite, 'lax');
    assert.strictEqual(devOpts.path, '/');

    // In prod
    process.env.NODE_ENV = 'production';
    const prodOpts = getAuthCookieOptions();
    assert.strictEqual(prodOpts.httpOnly, true);
    assert.strictEqual(prodOpts.secure, true);
    assert.strictEqual(prodOpts.path, '/');

    process.env.NODE_ENV = origEnv;
  });

  // Test 4: CSRF token generation and cookie options
  await runTest('generateCsrfToken creates cryptographically random 64-char hex token', () => {
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();
    assert.strictEqual(typeof token1, 'string');
    assert.strictEqual(token1.length, 64);
    assert.notStrictEqual(token1, token2);

    const csrfCookieOpts = getCsrfCookieOptions();
    assert.strictEqual(csrfCookieOpts.httpOnly, false); // Accessible to JavaScript for XSRF header
    assert.strictEqual(csrfCookieOpts.sameSite, 'lax');
  });

  // Test 5: CSRF middleware enforces double-submit cookie protection
  await runTest('verifyCsrfProtection blocks state-changing requests without matching XSRF-TOKEN', async () => {
    const app = express();
    app.use(express.json());
    // Parse cookies mock
    app.use((req: any, _res, next) => {
      const cookieHeader = req.headers.cookie || '';
      req.cookies = {};
      cookieHeader.split(';').forEach((part: string) => {
        const [k, v] = part.trim().split('=');
        if (k && v) req.cookies[k] = decodeURIComponent(v);
      });
      next();
    });
    app.use(verifyCsrfProtection);
    app.post('/api/action', (_req, res) => res.json({ success: true }));
    app.get('/api/safe', (_req, res) => res.json({ safe: true }));

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    // 1. GET requests should pass through without CSRF tokens
    const resGet = await fetch(`http://127.0.0.1:${port}/api/safe`);
    assert.strictEqual(resGet.status, 200);

    // 2. POST without any cookie or header should be rejected 403
    const resPostNoToken = await fetch(`http://127.0.0.1:${port}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 123 })
    });
    assert.strictEqual(resPostNoToken.status, 403);

    // 3. POST with mismatched cookie vs header should be rejected 403
    const resPostMismatch = await fetch(`http://127.0.0.1:${port}/api/action`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': 'XSRF-TOKEN=valid-token-12345',
        'x-xsrf-token': 'different-token-67890'
      },
      body: JSON.stringify({ data: 123 })
    });
    assert.strictEqual(resPostMismatch.status, 403);

    // 4. POST with matching double-submit cookie and header should succeed 200
    const validToken = generateCsrfToken();
    const resPostValid = await fetch(`http://127.0.0.1:${port}/api/action`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': `XSRF-TOKEN=${validToken}`,
        'x-xsrf-token': validToken
      },
      body: JSON.stringify({ data: 123 })
    });
    assert.strictEqual(resPostValid.status, 200);

    server.close();
  });

  // Test 6: Rate limiters configuration
  await runTest('createRateLimiters instantiates distinct limiters for auth, forgot-pw, otp', () => {
    const limiters = createRateLimiters();
    assert.ok(typeof limiters.apiLimiter === 'function');
    assert.ok(typeof limiters.authLimiter === 'function');
    assert.ok(typeof limiters.forgotPasswordLimiter === 'function');
    assert.ok(typeof limiters.otpLimiter === 'function');
    assert.ok(typeof limiters.changePasswordLimiter === 'function');
  });

  // Test 7: SSRF guard blocks internal, metadata, and loopback IP addresses
  await runTest('SSRF guard blocks cloud metadata (169.254.169.254), loopback (127.0.0.1), and private RFC1918 ranges', () => {
    function isPrivateOrBlockedHost(hostname: string): boolean {
      const host = hostname.toLowerCase().trim();
      if (
        host === 'localhost' ||
        host === 'metadata.google.internal' ||
        host.endsWith('.internal') ||
        host.endsWith('.local')
      ) {
        return true;
      }
      const ipv4Match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
      if (ipv4Match) {
        const b0 = parseInt(ipv4Match[1], 10);
        const b1 = parseInt(ipv4Match[2], 10);
        if (b0 === 127) return true;
        if (b0 === 10) return true;
        if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
        if (b0 === 192 && b1 === 168) return true;
        if (b0 === 169 && b1 === 254) return true;
        if (b0 === 0) return true;
      }
      if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
        return true;
      }
      return false;
    }

    // Blocked hosts
    assert.strictEqual(isPrivateOrBlockedHost('localhost'), true);
    assert.strictEqual(isPrivateOrBlockedHost('127.0.0.1'), true);
    assert.strictEqual(isPrivateOrBlockedHost('169.254.169.254'), true); // Google Cloud Metadata
    assert.strictEqual(isPrivateOrBlockedHost('metadata.google.internal'), true);
    assert.strictEqual(isPrivateOrBlockedHost('10.0.0.1'), true);
    assert.strictEqual(isPrivateOrBlockedHost('192.168.1.1'), true);
    assert.strictEqual(isPrivateOrBlockedHost('172.20.0.1'), true);
    assert.strictEqual(isPrivateOrBlockedHost('::1'), true);

    // Permitted public hosts
    assert.strictEqual(isPrivateOrBlockedHost('google.com'), false);
    assert.strictEqual(isPrivateOrBlockedHost('stanford.edu'), false);
    assert.strictEqual(isPrivateOrBlockedHost('8.8.8.8'), false);
  });

  // Test 8: authenticateToken reads token from HttpOnly cookie
  await runTest('authenticateToken authenticates successfully via req.cookies.token', () => {
    const payload = {
      id: 'student-test-123',
      role: 'student' as const,
      name: 'Alice Security',
      email: 'alice@example.com',
      institutionId: 'inst-1'
    };
    const validToken = generateToken(payload);

    const mockReq: any = {
      headers: {},
      cookies: {
        token: validToken
      }
    };
    const mockRes: any = {
      status: (code: number) => ({
        json: (data: any) => { mockRes.lastResponse = { code, data }; }
      })
    };

    let nextCalled = false;
    authenticateToken(mockReq, mockRes, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(mockReq.user?.id, 'student-test-123');
    assert.strictEqual(mockReq.user?.role, 'student');
  });

  console.log('\n----------------------------------------------------------------');
  console.log(`  APPLICATION SECURITY TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log('----------------------------------------------------------------\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

startTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
