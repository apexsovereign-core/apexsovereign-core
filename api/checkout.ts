import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  checkoutPayloadSchema,
  checkoutQuoteSchema,
  usdToComputeUnits,
  validationIssues,
} from '../src/lib/validation';
import { withRateLimit } from './middleware/rateLimit';

const MAX_BODY_BYTES = 4_096;

function requestId(res: VercelResponse): string {
  const header = res.getHeader('X-Request-Id');
  return typeof header === 'string' && header ? header : randomUUID();
}

function readJsonBody(req: VercelRequest): unknown {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return undefined;
    }
  }
  return req.body;
}

function bodyTooLarge(req: VercelRequest): boolean {
  const raw = req.headers['content-length'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const length = Number(value);
  return Number.isFinite(length) && length > MAX_BODY_BYTES;
}

/**
 * Checkout initialization / quote endpoint.
 *
 * SECURITY: This endpoint does not mint or credit compute units. It returns a
 * deterministic quote only. CU is minted exclusively by the PayPal-verified
 * webhook after a completed capture has been confirmed by PayPal and persisted
 * by the atomic ledger RPC.
 */
async function checkoutHandler(req: VercelRequest, res: VercelResponse) {
  const correlationId = requestId(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method Not Allowed',
      code: 'method_not_allowed',
      request_id: correlationId,
    });
  }

  if (bodyTooLarge(req)) {
    return res.status(413).json({
      error: 'Request body too large',
      code: 'payload_too_large',
      request_id: correlationId,
    });
  }

  const parsed = checkoutPayloadSchema.safeParse(readJsonBody(req));
  if (!parsed.success) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        code: 'checkout_invalid_request',
        request_id: correlationId,
      }),
    );
    return res.status(400).json({
      error: 'Invalid settlement parameters.',
      code: 'invalid_request',
      request_id: correlationId,
      issues: validationIssues(parsed.error),
    });
  }

  const { customer_id, usd_amount } = parsed.data;
  const usdCents = Math.round(usd_amount * 100);
  const compute_units_quoted = usdToComputeUnits(usd_amount);
  const checkout_reference = `apex_chk_${Date.now()}_${randomBytes(8).toString(
    'hex',
  )}`;

  const quote = {
    status: 'initialized' as const,
    checkout_reference,
    customer_id,
    // Normalize to the exact two-decimal value that was validated.
    usd_amount: usdCents / 100,
    compute_units_quoted,
    compute_units_credited: 0 as const,
    credited: false as const,
    gateway_status: 'awaiting_payment_approval' as const,
    minted_by: 'paypal_webhook_only' as const,
    requires_webhook_confirmation: true as const,
    timestamp: new Date().toISOString(),
  };

  const contract = checkoutQuoteSchema.safeParse(quote);
  if (!contract.success) {
    console.error(
      JSON.stringify({
        level: 'error',
        code: 'checkout_quote_contract_violation',
        request_id: correlationId,
        issues: validationIssues(contract.error),
      }),
    );
    return res.status(500).json({
      error: 'Quote could not be produced safely.',
      code: 'quote_contract_violation',
      request_id: correlationId,
    });
  }

  return res.status(200).json(contract.data);
}

export default withRateLimit('checkout', checkoutHandler);
