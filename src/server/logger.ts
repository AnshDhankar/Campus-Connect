/**
 * CampusConnect — Structured JSON Logger with Sensitive Data Redaction
 * 
 * Provides:
 * 1. Consistent JSON log emission suitable for Google Cloud Logging
 * 2. Automatic redaction of sensitive credentials, JWT tokens, passwords, OTPs, and connection strings
 * 3. Log severity levels: DEBUG, INFO, WARN, ERROR
 * 4. Request correlation ID support
 */

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /otp/i,
  /authorization/i,
  /cookie/i,
  /key/i,
  /hash/i,
  /mongo.*uri/i
];

/**
 * Recursively redacts sensitive fields from objects or arrays
 */
export function sanitizeLogData(data: any, depth = 0): any {
  if (depth > 5) return '[Truncated: Max Depth]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Redact connection strings with passwords: mongodb+srv://user:pass@...
    return data.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@)/gi, '$1***$2');
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item, depth + 1));
  }

  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
    if (isSensitive) {
      cleanObj[key] = '[REDACTED]';
    } else {
      cleanObj[key] = sanitizeLogData(value, depth + 1);
    }
  }
  return cleanObj;
}

export type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  severity: LogSeverity;
  message: string;
  correlationId?: string;
  meta?: any;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

export const logger = {
  info: (message: string, meta?: any, correlationId?: string) => {
    emitLog('INFO', message, meta, undefined, correlationId);
  },
  warn: (message: string, meta?: any, correlationId?: string) => {
    emitLog('WARN', message, meta, undefined, correlationId);
  },
  error: (message: string, err?: any, meta?: any, correlationId?: string) => {
    let errorObj: any;
    if (err instanceof Error) {
      errorObj = {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
      };
    } else if (err) {
      errorObj = { message: String(err) };
    }
    emitLog('ERROR', message, meta, errorObj, correlationId);
  },
  debug: (message: string, meta?: any, correlationId?: string) => {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      emitLog('DEBUG', message, meta, undefined, correlationId);
    }
  }
};

function emitLog(
  severity: LogSeverity,
  message: string,
  meta?: any,
  error?: any,
  correlationId?: string
) {
  const isProduction = process.env.NODE_ENV === 'production';
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    severity,
    message,
    correlationId: correlationId || (meta && meta.correlationId),
  };

  if (meta) {
    entry.meta = sanitizeLogData(meta);
  }
  if (error) {
    entry.error = error;
  }

  if (isProduction) {
    // Cloud Logging JSON format
    console.log(JSON.stringify(entry));
  } else {
    // Human-readable dev console format
    const prefix = `[${entry.timestamp}] [${severity}]`;
    if (severity === 'ERROR') {
      console.error(`${prefix} ${message}`, entry.meta ? entry.meta : '', entry.error ? entry.error : '');
    } else if (severity === 'WARN') {
      console.warn(`${prefix} ${message}`, entry.meta ? entry.meta : '');
    } else {
      console.log(`${prefix} ${message}`, entry.meta ? entry.meta : '');
    }
  }
}
