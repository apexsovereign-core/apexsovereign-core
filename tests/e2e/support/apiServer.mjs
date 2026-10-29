/**
 * Local API server for the Playwright contract suite.
 *
 * This process exists only in E2E mode. It loads the real Vercel handlers
 * (`api/checkout.ts`, `api/health.ts`) through Vite SSR and exposes an
 * additional `/__e2e__/*` surface that is NOT part of `api/` and is never
 * deployed:
 *
 *   POST /__e2e__/webhooks/paypal/replay
 *     Validates a PayPal capture payload with the shared Zod schema and
 *     simulates idempotent replay handling in memory. The response is marked
 *     `simulated: true` and `minted_by: "e2e_simulator_not_production"`.
 *     It does not verify PayPal signatures and must never be treated as a
 *     production settlement path.
 *
 *   POST /__e2e__/reset
 *     Clears simulator state.
 *
 * Start with APEX_E2E=1 outside production. The server refuses to start if the
 * mode guard is not satisfied.
 */
import http from 'node:http';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.E2E_API_PORT || 3100);
const MAX_BODY_BYTES = 64 * 1024;

if (
  process.env.APEX_E2E !== '1' ||
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production'
) {
  console.error(
    '[e2e-api] Refusing to start: APEX_E2E=1 and a non-production environment are required.',
  );
  process.exit(1);
}

const vite = await createViteServer({
  configFile: false,
  root: process.cwd(),
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true },
});

const [{ default: checkoutHandler }, { default: healthHandler }, validation] =
  await Promise.all([
    vite.ssrLoadModule('/api/checkout.ts'),
    vite.ssrLoadModule('/api/health.ts'),
    vite.ssrLoadModule('/src/lib/validation.ts'),
  ]);

const {
  paypalWebhookPayloadSchema,
  validationIssues,
  PAYPAL_CAPTURE_COMPLETED,
} = validation;

/** event id -> simulated settlement record */
const processedEvents = new Map();
/** capture id -> simulated settlement record */
const processedCaptures = new Map();
/** tenant id -> integer CU balance */
const balances = new Map();

function jsonResponse(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    ...extraHeaders,
  });
  res.end(body);
}

function createResponseAdapter(rawRes) {
  const headers = new Map();
  let statusCode = 200;

  const setHeader = (name, value) => {
    headers.set(String(name).toLowerCase(), value);
  };

  return {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader,
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    json(payload) {
      const body = JSON.stringify(payload);
      setHeader('content-type', 'application/json; charset=utf-8');
      setHeader('content-length', Buffer.byteLength(body));
      rawRes.writeHead(statusCode, Object.fromEntries(headers));
      rawRes.end(body);
      return this;
    },
    send(payload) {
      const body =
        typeof payload === 'string' ? payload : JSON.stringify(payload ?? '');
      setHeader('content-length', Buffer.byteLength(body));
      rawRes.writeHead(statusCode, Object.fromEntries(headers));
      rawRes.end(body);
      return this;
    },
    end(payload = '') {
      rawRes.writeHead(statusCode, Object.fromEntries(headers));
      rawRes.end(payload);
      return this;
    },
  };
}

async function readBody(req) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    const error = new Error('Request body too large');
    error.statusCode = 413;
    throw error;
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (total === 0) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function replayResponse(record, overrides = {}) {
  return {
    status: 'REPLAY',
    replay: true,
    simulated: true,
    minted_by: 'e2e_simulator_not_production',
    settlement: 'SIMULATED_IN_MEMORY',
    event_id: record.eventId,
    capture_id: record.captureId,
    tenant_id: record.tenantId,
    compute_units_credited: 0,
    balance_cu: balances.get(record.tenantId) ?? 0,
    ...overrides,
  };
}

function simulatePaypalWebhook(body) {
  const parsed = paypalWebhookPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return {
      statusCode: 400,
      payload: {
        error: 'Invalid PayPal webhook payload.',
        code: 'invalid_webhook_payload',
        issues: validationIssues(parsed.error),
      },
    };
  }

  const event = parsed.data;
  if (event.event_type !== PAYPAL_CAPTURE_COMPLETED) {
    return {
      statusCode: 422,
      payload: {
        error: 'Only PAYMENT.CAPTURE.COMPLETED is simulated.',
        code: 'unsupported_simulation_event',
        event_type: event.event_type,
      },
    };
  }

  const eventId = event.id;
  const captureId = event.resource.id;
  const existing = processedEvents.get(eventId) || processedCaptures.get(captureId);
  if (existing) {
    return {
      statusCode: 200,
      payload: replayResponse(existing, {
        reason: processedEvents.has(eventId)
          ? 'duplicate_event_id'
          : 'duplicate_capture_id',
      }),
    };
  }

  const customId = event.resource.custom_id;
  const tenantId = customId?.split(':')[0]?.trim();
  if (!tenantId) {
    return {
      statusCode: 422,
      payload: {
        error:
          'A capture simulation requires resource.custom_id with a tenant prefix.',
        code: 'missing_tenant_custom_id',
      },
    };
  }

  const amount = Number(event.resource.amount.value);
  const credits = Math.round(amount * 100);
  if (!Number.isSafeInteger(credits) || credits <= 0) {
    return {
      statusCode: 400,
      payload: {
        error: 'Capture amount did not convert to a positive integer CU value.',
        code: 'invalid_capture_amount',
      },
    };
  }

  const record = {
    eventId,
    captureId,
    tenantId,
    orderId:
      event.resource.supplementary_data?.related_ids?.order_id || captureId,
    credits,
  };
  processedEvents.set(eventId, record);
  processedCaptures.set(captureId, record);

  const balanceBefore = balances.get(tenantId) ?? 0;
  const balanceAfter = balanceBefore + credits;
  balances.set(tenantId, balanceAfter);

  return {
    statusCode: 200,
    payload: {
      status: 'PROCESSED',
      replay: false,
      simulated: true,
      minted_by: 'e2e_simulator_not_production',
      settlement: 'SIMULATED_IN_MEMORY',
      signature_verified: false,
      event_id: eventId,
      capture_id: captureId,
      order_id: record.orderId,
      tenant_id: tenantId,
      amount_usd: amount,
      compute_units_credited: credits,
      balance_before_cu: balanceBefore,
      balance_cu: balanceAfter,
    },
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Apex-E2E-Simulator', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-max-age': '600',
    });
    return res.end();
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  try {
    if (pathname === '/__e2e__/health' && req.method === 'GET') {
      return jsonResponse(res, 200, {
        status: 'ok',
        mode: 'e2e',
        simulator: true,
      });
    }

    if (pathname === '/__e2e__/reset' && req.method === 'POST') {
      processedEvents.clear();
      processedCaptures.clear();
      balances.clear();
      return jsonResponse(res, 200, { status: 'reset', simulator: true });
    }

    if (pathname === '/__e2e__/webhooks/paypal/replay') {
      if (req.method !== 'POST') {
        return jsonResponse(res, 405, {
          error: 'Method Not Allowed',
          code: 'method_not_allowed',
        });
      }
      const body = await readBody(req);
      const result = simulatePaypalWebhook(body);
      return jsonResponse(res, result.statusCode, result.payload, {
        'x-apex-e2e-simulator': 'true',
      });
    }

    const isCheckout = pathname === '/api/checkout';
    const isHealth = pathname === '/api/health';
    if (isCheckout || isHealth) {
      const body = await readBody(req);
      const adaptedReq = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
        query: Object.fromEntries(url.searchParams),
        socket: req.socket,
      };
      const handler = isCheckout ? checkoutHandler : healthHandler;
      await handler(adaptedReq, createResponseAdapter(res));
      return;
    }

    return jsonResponse(res, 404, {
      error: 'Not Found',
      code: 'not_found',
      path: pathname,
    });
  } catch (error) {
    const statusCode =
      Number.isInteger(error?.statusCode) && error.statusCode >= 400
        ? error.statusCode
        : 500;
    if (!res.headersSent) {
      return jsonResponse(res, statusCode, {
        error:
          statusCode >= 500
            ? 'E2E API server error.'
            : 'E2E request could not be processed.',
        code: statusCode === 413 ? 'payload_too_large' : 'e2e_request_failed',
      });
    }
    res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[e2e-api] listening on http://127.0.0.1:${PORT}`);
});

async function shutdown() {
  await new Promise((resolve) => server.close(resolve));
  await vite.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
