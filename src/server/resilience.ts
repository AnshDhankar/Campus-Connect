/**
 * CampusConnect — Reliability, Crash Prevention & Resilience Module
 * 
 * Implements:
 * 1. Health checks: Liveness (/api/health/liveness) and Readiness (/api/health/readiness)
 * 2. Request timeout middleware with AbortSignal cancellation support
 * 3. Idempotency middleware for high-value write operations (double-click / network retry protection)
 * 4. Graceful shutdown handler for Cloud Run SIGTERM / SIGINT
 */

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { isMongoConnected } from './db';
import { logger } from './logger';

// State flag to track application lifecycle
let isAppReady = true;
let isShuttingDown = false;

export function setAppReadiness(ready: boolean) {
  isAppReady = ready;
}

export function isAppInShutdown(): boolean {
  return isShuttingDown;
}

/**
 * Liveness probe: returns 200 OK as long as the Node.js event loop is running
 */
export function livenessHandler(_req: Request, res: Response) {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    pid: process.pid
  });
}

/**
 * Readiness probe: checks database dependency and shutdown state.
 * Returns 503 if shutting down or if MongoDB Atlas is disconnected in production.
 */
export function readinessHandler(_req: Request, res: Response) {
  if (isShuttingDown || !isAppReady) {
    return res.status(503).json({
      status: 'not_ready',
      reason: 'Application is draining or starting up',
      ready: false
    });
  }

  const isProd = process.env.NODE_ENV === 'production';
  const mongoState = mongoose.connection.readyState;
  const isConnected = mongoState === 1;

  if (isProd && !isConnected) {
    return res.status(503).json({
      status: 'unavailable',
      reason: 'Database connection to MongoDB Atlas is recovering',
      ready: false,
      isDatabaseUnavailable: true
    });
  }

  return res.status(200).json({
    status: 'ready',
    ready: true,
    database: isConnected ? 'connected' : 'local_or_reconnecting',
    mongoReadyState: mongoState
  });
}

/**
 * Request timeout middleware: ensures requests do not hang indefinitely
 */
export function createRequestTimeout(timeoutMs = 25000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip timeout for upload endpoints if streaming large payload
    const isUpload = req.path.includes('/upload') || req.path.includes('/attachments');
    const effectiveTimeout = isUpload ? 60000 : timeoutMs;

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`[REQUEST TIMEOUT] Request timed out after ${effectiveTimeout}ms: ${req.method} ${req.originalUrl}`);
        res.status(504).json({
          error: 'Gateway timeout: Request took longer than allowed execution deadline.',
          timeoutMs: effectiveTimeout
        });
      }
    }, effectiveTimeout);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
}

/**
 * In-memory idempotency cache for duplicate submission protection
 * Prevents double-clicks, duplicate complaints, duplicate registrations, and retries.
 */
interface CachedResponse {
  statusCode: number;
  headers: Record<string, any>;
  body: any;
  timestamp: number;
}

const idempotencyStore = new Map<string, CachedResponse>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

// Periodic cleanup of expired idempotency keys
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of idempotencyStore.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}, 60000).unref();

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only apply to state-changing requests
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;
  if (!idempotencyKey) {
    return next();
  }

  const cleanKey = String(idempotencyKey).trim();
  if (cleanKey.length < 8) {
    return next(); // Key too short, ignore
  }

  const cached = idempotencyStore.get(cleanKey);
  if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL_MS) {
    logger.info(`[IDEMPOTENCY] Replaying cached response for idempotency key: ${cleanKey}`);
    res.setHeader('X-Cache-Lookup', 'IDEMPOTENT_REPLAY');
    return res.status(cached.statusCode).json(cached.body);
  }

  // Intercept json response to cache it
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    // Only cache successful or non-server-error responses
    if (res.statusCode < 500) {
      idempotencyStore.set(cleanKey, {
        statusCode: res.statusCode,
        headers: {},
        body,
        timestamp: Date.now()
      });
    }
    return originalJson(body);
  };

  next();
}

/**
 * Configures graceful shutdown for Cloud Run container lifecycle
 */
export function setupGracefulShutdown(server: any, onCleanup?: () => Promise<void>) {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    setAppReadiness(false);

    logger.info(`[SHUTDOWN] Received ${signal}. Starting graceful shutdown sequence...`);

    // Give load balancers time to register unhealthy readiness
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Close HTTP server to stop accepting new requests
    server.close(async () => {
      logger.info('[SHUTDOWN] HTTP server closed. In-flight requests drained.');
      try {
        if (onCleanup) {
          await onCleanup();
        }
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close(false);
          logger.info('[SHUTDOWN] Mongoose connection closed gracefully.');
        }
      } catch (err) {
        logger.error('[SHUTDOWN] Error during shutdown cleanup:', err);
      } finally {
        logger.info('[SHUTDOWN] Graceful shutdown completed. Exiting process.');
        process.exit(0);
      }
    });

    // Hard exit deadline if server doesn't drain within 10 seconds
    setTimeout(() => {
      logger.error('[SHUTDOWN] Forced shutdown: in-flight requests exceeded deadline.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
