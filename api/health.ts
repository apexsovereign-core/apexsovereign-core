import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import {
  healthResponseSchema,
  validationIssues,
} from '../src/lib/validation';
import { withRateLimit } from './middleware/rateLimit';

/**
 * Liveness/contract endpoint for the Vercel routing layer.
 *
 * The payload is validated against the shared contract before it is sent. It
 * reports the service contract state only; it does not probe PayPal, Supabase,
 * or the Render backend, and it must not be read as an upstream health claim.
 */
function healthHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({
      error: 'Method Not Allowed',
      code: 'method_not_allowed',
    });
  }

  const header = res.getHeader('X-Request-Id');
  const correlationId =
    typeof header === 'string' && header ? header : randomUUID();

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const payload = {
    status: 'operational' as const,
    system: 'ApexSovereign.ai' as const,
    exchange: 'live' as const,
    ledger_rate: '$1.00 = 100 CU' as const,
    timestamp: new Date().toISOString(),
  };

  const contract = healthResponseSchema.safeParse(payload);
  if (!contract.success) {
    console.error(
      JSON.stringify({
        level: 'error',
        code: 'health_response_contract_violation',
        request_id: correlationId,
        issues: validationIssues(contract.error),
      }),
    );
    return res.status(500).json({
      error: 'Health contract could not be produced safely.',
      code: 'health_contract_violation',
      request_id: correlationId,
    });
  }

  return res.status(200).json(contract.data);
}

export default withRateLimit('health', healthHandler);
