/**
 * Public-route rate limiting for the local Vercel functions.
 *
 * Primary path: Upstash Redis sliding window (@upstash/ratelimit), keyed by a
 * salted hash of the client IP. The raw IP is never stored in Redis or logs.
 *
 * Failure path: in production, a missing limiter configuration, timeout, or
 * Upstash error fails closed with HTTP 503. There is no per-instance memory
 * fallback in production. Outside production the bounded in-process fixed
 * window keeps local and test runs usable and is labelled in the
 * `X-RateLimit-Mode` response header. The fallback never calls the handler
 * twice.
 *
 * Production startup: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
 * and `RATE_LIMIT_IP_SALT` are mandatory. This module throws at load time
 * when any is missing, so a misconfigured deployment fails instead of serving
 * unlimited traffic.
 *
 * Test path: `APEX_E2E=1` bypasses limiting only when NODE_ENV and VERCEL_ENV
 * are both non-production. Any other environment gets the real limiter.
 */
import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export type RateLimitRoute = 'checkout' | 'health';

type VercelHandler = (
  req: VercelRequest,
  res: VercelResponse,
) => unknown | Promise<unknown>;

interface RoutePolicy {
  limit: number;
  windowSeconds: number;
  upstashWindow: `${number} ${'s' | 'm' | 'h'}`;
}

const POLICIES: Record<RateLimitRoute, RoutePolicy> = {
  checkout: { limit: 10, windowSeconds: 60, upstashWindow: '1 m' },
  health: { limit: 120, windowSeconds: 60, upstashWindow: '1 m' },
};

const DEV_ONLY_IP_SALT = 'apex-rate-limit-dev-only-not-for-production';

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

/**
 * Fail at module load, not on the first request. A production function that
 * cannot enforce a distributed limit must not start serving traffic.
 */
function assertProductionConfig(): void {
  if (!isProductionRuntime()) return;
  const missing: string[] = [];
  if (!process.env.UPSTASH_REDIS_REST_URL?.trim()) {
    missing.push('UPSTASH_REDIS_REST_URL');
  }
  if (!process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    missing.push('UPSTASH_REDIS_REST_TOKEN');
  }
  if (!process.env.RATE_LIMIT_IP_SALT?.trim()) {
    missing.push('RATE_LIMIT_IP_SALT');
  }
  if (missing.length > 0) {
    throw new Error(
      `rate_limit_misconfigured: production requires ${missing.join(', ')}`,
    );
  }
}

assertProductionConfig();

const UPSTASH_TIMEOUT_MS = 1_000;
const MEMORY_BUCKET_LIMIT = 2_000;

interface MemoryBucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, MemoryBucket>();
const upstashLimiters = new Map<RateLimitRoute, Ratelimit>();

interface LimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  mode: 'upstash' | 'memory' | 'memory-fallback' | 'unavailable';
  requestId: string;
}

function isTrustedTestBypass(): boolean {
  return (
    process.env.APEX_E2E === '1' &&
    process.env.NODE_ENV !== 'production' &&
    process.env.VERCEL_ENV !== 'production'
  );
}

function headerValue(
  req: VercelRequest,
  name: string,
): string | undefined {
  const raw = req.headers?.[name];
  if (Array.isArray(raw)) return raw[0];
  if (typeof raw === 'string') return raw;
  return undefined;
}

function requestIdFor(req: VercelRequest): string {
  const incoming = headerValue(req, 'x-request-id')?.trim();
  if (incoming && /^[A-Za-z0-9._:-]{1,64}$/.test(incoming)) {
    return incoming;
  }
  return randomUUID();
}

function clientKey(req: VercelRequest): string {
  // Prefer the edge-injected address. `x-forwarded-for` is a chain; the last
  // entry is the one added by the trusted proxy, while the first entry can be
  // client-supplied on some deployments.
  const realIp = headerValue(req, 'x-real-ip')?.trim();
  const forwardedChain = headerValue(req, 'x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const forwarded = forwardedChain?.length
    ? forwardedChain[forwardedChain.length - 1]
    : undefined;
  const remote =
    (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress;
  const candidate = realIp || forwarded || remote || 'unidentified';

  // Keep only a verified IP representation before hashing. Unknown or
  // malformed values collapse to a shared bucket rather than becoming free
  // rate-limit identities.
  const normalized = isIP(candidate) ? candidate.toLowerCase() : 'unidentified';
  const salt = process.env.RATE_LIMIT_IP_SALT?.trim() ?? '';
  if (!salt && isProductionRuntime()) {
    throw new Error(
      'rate_limit_misconfigured: RATE_LIMIT_IP_SALT is required in production',
    );
  }
  // The dev-only salt never reaches production because the module-level
  // assertion above refuses to load without RATE_LIMIT_IP_SALT.
  return createHmac('sha256', salt || DEV_ONLY_IP_SALT)
    .update(normalized)
    .digest('hex')
    .slice(0, 32);
}

function getUpstashLimiter(
  route: RateLimitRoute,
): Ratelimit | null {
  const existing = upstashLimiters.get(route);
  if (existing) return existing;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  try {
    const policy = POLICIES[route];
    const limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(policy.limit, policy.upstashWindow),
      prefix: `apex:ratelimit:${route}`,
      timeout: UPSTASH_TIMEOUT_MS,
      analytics: false,
    });
    upstashLimiters.set(route, limiter);
    return limiter;
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        code: 'rate_limit_upstash_init_failed',
        route,
        message: error instanceof Error ? error.message : 'unknown error',
      }),
    );
    return null;
  }
}

function memoryLimit(
  route: RateLimitRoute,
  identifier: string,
  now: number,
): { allowed: boolean; limit: number; remaining: number; resetAt: number } {
  const policy = POLICIES[route];
  const windowMs = policy.windowSeconds * 1_000;
  const key = `${route}:${identifier}`;
  const existing = memoryBuckets.get(key);

  let bucket: MemoryBucket;
  if (!existing || existing.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    memoryBuckets.set(key, bucket);
  } else {
    bucket = existing;
  }

  bucket.count += 1;
  const allowed = bucket.count <= policy.limit;

  if (memoryBuckets.size > MEMORY_BUCKET_LIMIT) {
    for (const [bucketKey, value] of memoryBuckets) {
      if (value.resetAt <= now) memoryBuckets.delete(bucketKey);
    }
    // Still bounded if every bucket is live: drop the oldest insertion.
    while (memoryBuckets.size > MEMORY_BUCKET_LIMIT) {
      const oldest = memoryBuckets.keys().next().value;
      if (oldest === undefined) break;
      memoryBuckets.delete(oldest);
    }
  }

  return {
    allowed,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

function unavailableDecision(
  route: RateLimitRoute,
  requestId: string,
): LimitDecision {
  const policy = POLICIES[route];
  return {
    allowed: false,
    limit: policy.limit,
    remaining: 0,
    resetAt: Date.now() + policy.windowSeconds * 1_000,
    mode: 'unavailable',
    requestId,
  };
}

async function decideLimit(
  route: RateLimitRoute,
  req: VercelRequest,
  requestId: string,
): Promise<LimitDecision> {
  const identifier = clientKey(req);
  const now = Date.now();
  const limiter = getUpstashLimiter(route);

  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      if (result.reason !== 'timeout') {
        return {
          allowed: result.success,
          limit: result.limit,
          remaining: Math.max(0, result.remaining),
          resetAt: result.reset,
          mode: 'upstash',
          requestId,
        };
      }
      console.warn(
        JSON.stringify({
          level: 'warn',
          code: 'rate_limit_upstash_timeout',
          route,
          request_id: requestId,
        }),
      );
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          code: 'rate_limit_upstash_unavailable',
          route,
          request_id: requestId,
          message: error instanceof Error ? error.message : 'unknown error',
        }),
      );
    }
    // Production has no memory fallback: an unavailable distributed limiter
    // must reject the request rather than silently degrade to per-instance
    // counting that an attacker can bypass by hitting another instance.
    if (isProductionRuntime()) {
      return unavailableDecision(route, requestId);
    }
    const fallback = memoryLimit(route, identifier, now);
    return {
      ...fallback,
      mode: 'memory-fallback',
      requestId,
    };
  }

  if (isProductionRuntime()) {
    return unavailableDecision(route, requestId);
  }

  const fallback = memoryLimit(route, identifier, now);
  return {
    ...fallback,
    mode: 'memory',
    requestId,
  };
}

function setRateHeaders(
  res: VercelResponse,
  route: RateLimitRoute,
  decision: LimitDecision,
): void {
  const resetSeconds = Math.max(0, Math.ceil(decision.resetAt / 1_000));
  res.setHeader('X-RateLimit-Limit', String(decision.limit));
  res.setHeader('X-RateLimit-Remaining', String(decision.remaining));
  res.setHeader('X-RateLimit-Reset', String(resetSeconds));
  res.setHeader(
    'X-RateLimit-Policy',
    `${decision.limit};w=${POLICIES[route].windowSeconds}`,
  );
  res.setHeader('X-RateLimit-Mode', decision.mode);
  res.setHeader('X-Request-Id', decision.requestId);
  res.setHeader('Cache-Control', 'no-store');
}

/**
 * Wrap a handler with the route policy. The wrapper is the only place that
 * produces 429 responses, so error shape and headers stay consistent.
 */
export function withRateLimit(
  route: RateLimitRoute,
  handler: VercelHandler,
): VercelHandler {
  return async (req, res) => {
    const requestId = requestIdFor(req);

    if (isTrustedTestBypass()) {
      res.setHeader('X-Request-Id', requestId);
      res.setHeader('X-RateLimit-Mode', 'test-bypass');
      res.setHeader('Cache-Control', 'no-store');
      return handler(req, res);
    }

    let decision: LimitDecision;
    try {
      decision = await decideLimit(route, req, requestId);
    } catch (error) {
      // The limiter path is designed not to throw. If it somehow does, fail
      // closed in production and keep local/test runs usable.
      console.error(
        JSON.stringify({
          level: 'error',
          code: 'rate_limit_internal_error',
          route,
          request_id: requestId,
          message: error instanceof Error ? error.message : 'unknown error',
        }),
      );
      decision = isProductionRuntime()
        ? unavailableDecision(route, requestId)
        : {
            allowed: true,
            limit: POLICIES[route].limit,
            remaining: 0,
            resetAt: Date.now() + POLICIES[route].windowSeconds * 1_000,
            mode: 'unavailable',
            requestId,
          };
    }

    setRateHeaders(res, route, decision);

    if (decision.mode === 'unavailable' && !decision.allowed) {
      res.setHeader('Retry-After', '1');
      return res.status(503).json({
        error: 'Service Unavailable',
        code: 'rate_limiter_unavailable',
        retry_after_seconds: 1,
      });
    }

    if (!decision.allowed) {
      const retryAfter = Math.max(
        1,
        Math.ceil((decision.resetAt - Date.now()) / 1_000),
      );
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too Many Requests',
        code: 'rate_limited',
        retry_after_seconds: retryAfter,
      });
    }

    return handler(req, res);
  };
}

/** Exposed for contract tests and diagnostics; never returns raw IPs. */
export const __rateLimitInternals = {
  clientKey,
  memoryLimit,
  policies: POLICIES,
};

/**
 * Vercel treats every file under `api/` as a serverless function. This guard
 * keeps the shared middleware module from becoming an unhandled public route;
 * the supported surface is the named `withRateLimit` export used by the
 * checkout and health handlers.
 */
export default function rateLimitModuleGuard(
  _req: VercelRequest,
  res: VercelResponse,
) {
  return res.status(404).json({
    error: 'Not Found',
    code: 'not_found',
  });
}
