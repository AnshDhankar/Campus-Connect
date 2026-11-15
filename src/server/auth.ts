import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface JwtValidationResult {
  isValid: boolean;
  isProduction: boolean;
  error?: string;
  isDevRandomFallback?: boolean;
}

export const KNOWN_INSECURE_SECRETS: ReadonlyArray<string> = Object.freeze([
  'campusconnect-secret-key-2026',
  'secret',
  'jwt_secret',
  'jwt-secret',
  'changeme',
  'your-jwt-secret',
  'default-secret',
  'placeholder'
]);

/**
 * Validates the JWT_SECRET configuration without leaking secrets.
 */
export function validateJwtConfiguration(env: NodeJS.ProcessEnv = process.env): JwtValidationResult {
  const isProduction = env.NODE_ENV === 'production';
  const rawSecret = env.JWT_SECRET;
  const trimmedSecret = rawSecret ? rawSecret.trim() : '';

  if (isProduction) {
    if (!rawSecret || !trimmedSecret) {
      return {
        isValid: false,
        isProduction: true,
        error: '[CRITICAL CONFIGURATION ERROR] JWT_SECRET is required and cannot be empty in production. Process-local or hardcoded fallbacks are strictly forbidden.'
      };
    }

    if (KNOWN_INSECURE_SECRETS.includes(trimmedSecret.toLowerCase())) {
      return {
        isValid: false,
        isProduction: true,
        error: '[CRITICAL CONFIGURATION ERROR] JWT_SECRET uses a known, insecure, or hardcoded default value. A unique, high-entropy secret of at least 32 bytes is required.'
      };
    }

    // Require at least 32 bytes/characters of secret material
    if (Buffer.byteLength(trimmedSecret, 'utf8') < 32) {
      return {
        isValid: false,
        isProduction: true,
        error: '[CRITICAL CONFIGURATION ERROR] JWT_SECRET is too short. Production requires at least 32 bytes (>= 32 characters) of cryptographically secure secret material.'
      };
    }

    return {
      isValid: true,
      isProduction: true
    };
  }

  // Development / Test environment validation
  if (rawSecret !== undefined) {
    if (!trimmedSecret) {
      return {
        isValid: false,
        isProduction: false,
        error: '[CONFIGURATION ERROR] Configured JWT_SECRET is empty or whitespace-only.'
      };
    }

    if (KNOWN_INSECURE_SECRETS.includes(trimmedSecret.toLowerCase())) {
      return {
        isValid: false,
        isProduction: false,
        error: '[CONFIGURATION ERROR] Configured JWT_SECRET matches a known insecure default secret.'
      };
    }

    return {
      isValid: true,
      isProduction: false
    };
  }

  // Development mode without explicit JWT_SECRET: allowed via process-local random secret
  return {
    isValid: true,
    isProduction: false,
    isDevRandomFallback: true
  };
}

let cachedDevSecret: string | null = null;

/**
 * Returns the validated JWT secret. Never uses the hardcoded fallback.
 */
export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const isProduction = env.NODE_ENV === 'production';
  const rawSecret = env.JWT_SECRET;
  const trimmed = rawSecret ? rawSecret.trim() : '';

  if (isProduction) {
    const validation = validateJwtConfiguration(env);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    return trimmed;
  }

  // Non-production with configured secret
  if (trimmed) {
    const validation = validateJwtConfiguration(env);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    return trimmed;
  }

  // Development process-local random secret
  if (!cachedDevSecret) {
    cachedDevSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[AUTH NOTICE] JWT_SECRET is not configured. Generated a process-local random secret for development. Active sessions will invalidate on process restart.');
  }
  return cachedDevSecret;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'student' | 'staff' | 'superadmin';
    name: string;
    email: string;
    enrollmentNumber?: string;
    departmentKey?: string;
    institutionId?: string;
  };
}

export function generateToken(payload: any) {
  const secret = getJwtSecret();
  if (payload && typeof payload === 'object') {
    const cleanPayload = { ...payload };
    delete cleanPayload.iat;
    delete cleanPayload.exp;
    return jwt.sign(cleanPayload, secret, { expiresIn: '7d' });
  }
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  if (!token && (req as any).cookies?.token) {
    token = (req as any).cookies.token;
  }

  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(new RegExp('(^| )token=([^;]+)'));
    if (match) {
      token = match[2];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token left out - authentication required.' });
  }

  try {
    const secret = getJwtSecret();
    jwt.verify(token, secret, (err, user: any) => {
      if (err) {
        return res.status(403).json({ error: 'Session expired or invalid token structure. Please login again.' });
      }
      req.user = user;
      next();
    });
  } catch (error: any) {
    console.error('[AUTH ERROR] JWT verification halted due to secret misconfiguration:', error?.message);
    return res.status(500).json({ error: 'Authentication service configuration error.' });
  }
}

export function requireRole(roles: ('student' | 'staff' | 'superadmin')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden. You do not have permissions to perform this action.' });
    }

    next();
  };
}
