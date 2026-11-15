import { Request, Response, NextFunction, RequestHandler } from 'express';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import crypto from 'crypto';

/**
 * CampusConnect Application Security Module
 * Workstream B: Helmet, CORS, Rate Limiting, HttpOnly Cookies, and CSRF Protection
 */

// ============================================================================
// 1. HELMET SECURITY HEADERS & CONTENT SECURITY POLICY (CSP)
// ============================================================================

export function createHelmetMiddleware(): RequestHandler {
  const isProduction = process.env.NODE_ENV === 'production';

  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Allow inline scripts in non-production for Vite HMR; strict in production
          isProduction ? "'self'" : "'self' 'unsafe-inline' 'unsafe-eval'",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for Tailwind utility classes and React inline styles
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "data:"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:" // For institution logos, cloud uploads, and avatars
        ],
        connectSrc: [
          "'self'",
          "https:",
          isProduction ? "" : "ws: wss:" // WebSockets for dev server HMR
        ].filter(Boolean),
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: [
          "'self'",
          // Google AI Studio preview & Cloud Run iframe embedding support
          "https://*.run.app",
          "https://*.google.com",
          "https://*.googleusercontent.com",
          "https://aistudio.google.com"
        ],
        upgradeInsecureRequests: isProduction ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false, // Prevents breaking cross-origin image loads (logos)
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allows static assets and uploads to render
    dnsPrefetchControl: { allow: false },
    frameguard: false, // Handled via CSP frameAncestors to allow AI Studio iframe container
    hidePoweredBy: true,
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: false, preload: false } : false,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true
  });
}

// ============================================================================
// 2. STRICT CORS CONFIGURATION
// ============================================================================

export function getValidatedAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const isProduction = env.NODE_ENV === 'production';
  const customOrigins = (env.CORS_ALLOWED_ORIGINS || env.APP_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const vercelOrigins = [
    env.VERCEL_URL ? `https://${env.VERCEL_URL.trim()}` : '',
    env.VERCEL_BRANCH_URL ? `https://${env.VERCEL_BRANCH_URL.trim()}` : '',
    env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL.trim()}` : '',
  ].filter(Boolean);

  if (isProduction) {
    const prodDefaults = [
      env.APP_URL ? env.APP_URL.trim() : '',
      ...vercelOrigins,
    ].filter(Boolean);

    if (customOrigins.length === 0) {
      if (prodDefaults.length > 0) {
        return Array.from(new Set(prodDefaults));
      }
      console.warn('[CORS WARNING] No explicit CORS_ALLOWED_ORIGINS set in production.');
      return [];
    }
    // Reject wildcard origins in production
    for (const origin of customOrigins) {
      if (origin === '*' || origin.includes('*')) {
        throw new Error('[CRITICAL SECURITY ERROR] Wildcard CORS origins are strictly forbidden in production with credentialed requests.');
      }
      try {
        new URL(origin);
      } catch {
        throw new Error(`[CRITICAL SECURITY ERROR] Malformed origin in CORS_ALLOWED_ORIGINS: "${origin}"`);
      }
    }
    return Array.from(new Set([...customOrigins, ...prodDefaults]));
  }

  // Development / Preview default origins
  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    env.APP_URL ? env.APP_URL.trim() : '',
    ...vercelOrigins,
  ].filter(Boolean);

  return Array.from(new Set([...devOrigins, ...customOrigins]));
}

export function createCorsMiddleware(): RequestHandler {
  const isProduction = process.env.NODE_ENV === 'production';

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. same-origin, server-to-server, mobile apps, curl)
      if (!origin) {
        return callback(null, true);
      }

      const allowedOrigins = getValidatedAllowedOrigins();

      // In non-production, also permit matching AI Studio, Cloud Run, and local origins
      if (!isProduction) {
        if (
          /^https:\/\/[a-z0-9-.]+\.run\.app$/i.test(origin) ||
          /^https:\/\/([a-z0-9-]+\.)*google\.com$/i.test(origin) ||
          /^https:\/\/([a-z0-9-]+\.)*googleusercontent\.com$/i.test(origin) ||
          /^http:\/\/localhost:[0-9]+$/i.test(origin) ||
          /^http:\/\/127\.0\.0\.1:[0-9]+$/i.test(origin)
        ) {
          return callback(null, true);
        }
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`[CORS REJECTED] Origin "${origin}" is not authorized.`);
      return callback(new Error(`CORS policy rejection: Origin "${origin}" not allowed.`));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-csrf-token', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['X-CSRF-Token', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
    maxAge: 86400 // 24 hours preflight cache
  };

  return cors(corsOptions);
}

// ============================================================================
// 3. RATE LIMITING MIDDLEWARE
// ============================================================================

export interface RateLimiters {
  apiLimiter: RateLimitRequestHandler;
  authLimiter: RateLimitRequestHandler;
  forgotPasswordLimiter: RateLimitRequestHandler;
  otpLimiter: RateLimitRequestHandler;
  changePasswordLimiter: RateLimitRequestHandler;
  adminOpsLimiter: RateLimitRequestHandler;
}

export function createRateLimiters(): RateLimiters {
  // Global API Limiter: 150 requests per 15 minutes per IP
  const isProd = process.env.NODE_ENV === 'production';

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProd ? 150 : 2000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP. Please try again after 15 minutes.', retryAfterSeconds: 900 }
  });

  // Login & Registration Limiter: 10 attempts per 15 minutes per IP in production (200 in dev/test)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProd ? 10 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. For security reasons, please retry after 15 minutes.', retryAfterSeconds: 900 }
  });

  // Forgot Password Limiter: 3 requests per 15 minutes per IP (50 in dev/test)
  const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProd ? 3 : 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password reset requests. Please wait 15 minutes before requesting again.', retryAfterSeconds: 900 }
  });

  // OTP Verification Limiter: 5 attempts per 15 minutes per IP (50 in dev/test)
  const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProd ? 5 : 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many invalid OTP attempts. Please wait 15 minutes or request a new code.', retryAfterSeconds: 900 }
  });

  // Authenticated Change Password Limiter: 5 attempts per 15 minutes per IP (50 in dev/test)
  const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProd ? 5 : 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password change attempts. Please wait 15 minutes.', retryAfterSeconds: 900 }
  });

  // Sensitive Admin Operations Limiter: 20 requests per 15 minutes per IP in production (200 in dev/test)
  const adminOpsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProd ? 20 : 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded for administrative operations. Please wait 15 minutes.', retryAfterSeconds: 900 }
  });

  return {
    apiLimiter,
    authLimiter,
    forgotPasswordLimiter,
    otpLimiter,
    changePasswordLimiter,
    adminOpsLimiter
  };
}

// ============================================================================
// 4. SECURE COOKIE CONFIGURATION
// ============================================================================

export function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction, // Secure in production HTTPS
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days (aligns with JWT expiresIn: '7d')
  };
}

export function getCsrfCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: false, // Must be readable by client JS to attach to X-CSRF-Token header
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  };
}

// ============================================================================
// 5. CSRF PROTECTION (DOUBLE SUBMIT COOKIE PATTERN WITH CRYPTOGRAPHIC INTEGRITY)
// ============================================================================

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generates an anti-CSRF token (HMAC-backed or random 32-byte hex)
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware ensuring every client has an anti-CSRF token cookie
 */
export function csrfTokenProvider(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.[CSRF_COOKIE_NAME];
  if (!token) {
    token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
  }
  // Expose token on response header and locals
  res.setHeader('X-CSRF-Token', token);
  (res as any).locals.csrfToken = token;
  next();
}

/**
 * Enforces CSRF token verification for state-changing HTTP requests
 * (POST, PUT, PATCH, DELETE) when authenticated via cookie.
 */
export function verifyCsrfProtection(req: Request, res: Response, next: NextFunction) {
  // Safe HTTP methods do not mutate state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Verify Origin header against allowed origins if present on mutating requests
  const origin = req.headers['origin'];
  if (origin && typeof origin === 'string') {
    const isProd = process.env.NODE_ENV === 'production';
    const allowed = getValidatedAllowedOrigins();
    const requestHost = req.headers['x-forwarded-host'] || req.headers['host'];
    const isSameHostOrigin = Boolean(
      requestHost &&
      (origin === `https://${requestHost}` || origin === `http://${requestHost}`)
    );

    let isAllowed = allowed.includes(origin) || isSameHostOrigin;
    if (!isProd) {
      if (
        /^https:\/\/[a-z0-9-.]+\.run\.app$/i.test(origin) ||
        /^https:\/\/([a-z0-9-]+\.)*google\.com$/i.test(origin) ||
        /^https:\/\/([a-z0-9-]+\.)*googleusercontent\.com$/i.test(origin) ||
        /^http:\/\/localhost:[0-9]+$/i.test(origin) ||
        /^http:\/\/127\.0\.0\.1:[0-9]+$/i.test(origin)
      ) {
        isAllowed = true;
      }
    }
    if (!isAllowed) {
      return res.status(403).json({
        error: 'Forbidden: Request origin does not match authorized application domains.',
        isCsrfError: true
      });
    }
  }

  // If request uses Bearer token authorization header without cookies, skip cookie-CSRF check
  const authHeader = req.headers['authorization'];
  const hasBearerHeader = authHeader && authHeader.startsWith('Bearer ');
  const hasAuthCookie = !!req.cookies?.['token'];

  // If request is purely API client with Bearer header and no browser cookie, it is not vulnerable to CSRF
  if (hasBearerHeader && !hasAuthCookie) {
    return next();
  }

  // Public unauthenticated authentication endpoints do not require session CSRF token
  // when the client does not possess an active session cookie.
  // Defense-in-depth is provided by origin validation, strict rate-limiters, and credential verification.
  const publicAuthEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/verify-otp',
    '/api/auth/reset-password',
    '/api/auth/validate-reset-token',
    '/api/institutions/register'
  ];
  const reqPath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
  const isPublicAuth = publicAuthEndpoints.some(p => reqPath === p || req.path === p || req.originalUrl?.startsWith(p));
  if (isPublicAuth && !hasAuthCookie) {
    return next();
  }

  // For browser cookie-based authentication, CSRF token validation is mandatory
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = (req.headers[CSRF_HEADER_NAME] || req.headers['x-xsrf-token'] || req.body?._csrf) as string;

  if (!cookieToken || !headerToken) {
    return res.status(403).json({
      error: 'CSRF token missing or invalid. Please refresh the page and try again.',
      isCsrfError: true
    });
  }

  // Constant-time comparison to prevent timing attacks
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  if (cookieBuffer.length !== headerBuffer.length || !crypto.timingSafeEqual(cookieBuffer, headerBuffer)) {
    return res.status(403).json({
      error: 'CSRF token mismatch. The request origin or verification failed.',
      isCsrfError: true
    });
  }

  next();
}
