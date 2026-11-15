/**
 * Client-side CSRF utilities for double-submit cookie protection
 */

export function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function ensureCsrfToken(): Promise<string> {
  const existing = getCsrfToken();
  if (existing) return existing;

  try {
    const res = await fetch('/api/csrf-token', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      return data.csrfToken || getCsrfToken();
    }
  } catch (err) {
    console.warn('[CSRF] Token retrieval warning:', err);
  }
  return getCsrfToken();
}

function isLocalApiUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/api/')) return true;
  if (typeof window !== 'undefined' && url.startsWith(`${window.location.origin}/api/`)) {
    return true;
  }
  return false;
}

/**
 * Safe fetch wrapper for /api/* requests that automatically attaches
 * X-CSRF-Token and credentials: 'include' for state-changing requests
 * without mutating window.fetch.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const isMutating = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

  if (isMutating && isLocalApiUrl(url)) {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );

    if (!headers.has('X-CSRF-Token') && !headers.has('x-csrf-token') && !headers.has('x-xsrf-token')) {
      const csrfToken = await ensureCsrfToken();
      if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
      }
    }

    const credentials =
      init?.credentials ?? (input instanceof Request ? input.credentials : undefined) ?? 'include';

    if (input instanceof Request) {
      return fetch(new Request(input, { ...init, headers, credentials }));
    }
    return fetch(input, { ...init, headers, credentials });
  }

  return fetch(input, init);
}

/**
 * Helper to construct fetch headers with CSRF and Auth tokens
 */
export function getSecureHeaders(token?: string, extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };

  const csrf = getCsrfToken();
  if (csrf) {
    headers['X-CSRF-Token'] = csrf;
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Safely parses JSON responses and throws descriptive errors on HTML/text gateway responses (e.g. 413/502/504)
 */
export async function parseJsonSafe<T = any>(res: Response, fallbackErrorPrefix = 'Server request failed'): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  const text = await res.text().catch(() => '');
  const trimmed = text.trim();
  if (res.status === 413) {
    throw new Error('Uploaded file or request payload is too large for the server limit (max ~3 MB). Please choose a smaller file.');
  }
  throw new Error(
    trimmed && !trimmed.startsWith('<')
      ? trimmed.slice(0, 200)
      : `${fallbackErrorPrefix} (HTTP ${res.status}). Please refresh and retry.`
  );
}
