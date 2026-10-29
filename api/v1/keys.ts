import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const MAX_BODY_BYTES = 2_048;

const ALLOWED_TIERS = ['starter', 'enterprise', 'institutional'] as const;
type Tier = (typeof ALLOWED_TIERS)[number];

const TIER_QUOTA: Record<Tier, { dailyCuLimit: number; rateLimitPerMin: number }> = {
  starter: { dailyCuLimit: 100_000, rateLimitPerMin: 60 },
  enterprise: { dailyCuLimit: 1_000_000, rateLimitPerMin: 300 },
  institutional: { dailyCuLimit: 10_000_000, rateLimitPerMin: 1_200 },
};

function readBody(req: VercelRequest): unknown {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return undefined;
    }
  }
  return req.body;
}

function issueKey(tier: Tier, tenantId: string): { key: string; keyId: string; tier: Tier; issuedAt: string } {
  const secret = process.env.LEDGER_HMAC_KEYS_JSON
    ? (() => {
        try {
          const keys = JSON.parse(process.env.LEDGER_HMAC_KEYS_JSON) as Record<string, string>;
          const kid = process.env.LEDGER_HMAC_KID ?? 'k1';
          return keys[kid] ?? '';
        } catch {
          return '';
        }
      })()
    : '';

  const keyId = `ak_${randomBytes(8).toString('hex')}`;
  const issuedAt = new Date().toISOString();
  const payload = `${keyId}:${tenantId}:${tier}:${issuedAt}`;
  const hmac = secret
    ? createHmac('sha256', secret).update(payload).digest('hex')
    : createHmac('sha256', randomBytes(32)).update(payload).digest('hex');

  return {
    key: `apex_${keyId}_${hmac.slice(0, 32)}`,
    keyId,
    tier,
    issuedAt,
  };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed', code: 'method_not_allowed' });
  }

  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Payload Too Large', code: 'payload_too_large' });
  }

  const body = readBody(req) as Record<string, unknown> | undefined;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body', code: 'invalid_request' });
  }

  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : '';
  if (!tenantId || tenantId.length > 128) {
    return res.status(400).json({ error: 'tenant_id is required (1-128 chars)', code: 'invalid_tenant_id' });
  }

  const tierRaw = typeof body.tier === 'string' ? body.tier.trim().toLowerCase() : 'starter';
  if (!ALLOWED_TIERS.includes(tierRaw as Tier)) {
    return res.status(400).json({
      error: `tier must be one of: ${ALLOWED_TIERS.join(', ')}`,
      code: 'invalid_tier',
    });
  }
  const tier = tierRaw as Tier;

  const issued = issueKey(tier, tenantId);
  const quota = TIER_QUOTA[tier];

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(201).json({
    key: issued.key,
    key_id: issued.keyId,
    tier: issued.tier,
    tenant_id: tenantId,
    issued_at: issued.issuedAt,
    quota: {
      daily_cu_limit: quota.dailyCuLimit,
      rate_limit_per_min: quota.rateLimitPerMin,
      cu_per_usd: 100,
    },
    // CU deduction happens via Supabase apex.deduct_compute_units RPC.
    ledger_sync: 'supabase_apex_rpc',
    paypal_env: process.env.PAYPAL_ENV ?? 'sandbox',
  });
}
