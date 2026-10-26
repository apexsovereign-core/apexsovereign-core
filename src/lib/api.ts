/**
 * Minimal API client for the ApexSovereign FastAPI backend.
 *
 * - Uses VITE_API_BASE_URL when the frontend and backend are deployed on
 *   different origins; otherwise requests are same-origin.
 * - Never invents a balance, receipt, or ledger row on failure.
 */

const env = (import.meta as any).env || {};

export const API_BASE_URL: string = String(
  env.VITE_API_BASE_URL || '',
).replace(/\/+$/, '');

export const ACCESS_TOKEN_STORAGE_KEY = 'apex_access_token';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

export function getStoredAccessToken(): string {
  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function storeAccessToken(token: string): void {
  try {
    if (token) {
      window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable in hardened/private browser modes. The
    // in-memory token still works for the current page session.
  }
}

function requestId(): string {
  const cryptoApi = window.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      credentials: 'same-origin',
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(
      0,
      'network_error',
      'The billing API is unreachable. Check the backend URL and try again.',
    );
  }

  const raw = await response.text();
  let payload: any = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const detail = payload?.detail;
    const error =
      (detail && typeof detail === 'object' && detail.error) ||
      (payload && typeof payload === 'object' && payload.error) ||
      {};
    throw new ApiError(
      response.status,
      String(error.code || `http_${response.status}`),
      String(
        error.message ||
          (typeof detail === 'string' ? detail : '') ||
          `Request failed with HTTP ${response.status}.`,
      ),
      error.correlation_id ? String(error.correlation_id) : undefined,
    );
  }

  return payload as T;
}

export function createIdempotencyKey(): string {
  return requestId();
}
