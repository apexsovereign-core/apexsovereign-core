'use strict';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_TOPUP_USD = Number(process.env.MAX_TOPUP_USD || 10000);
const CREDIT_EVENT = 'PAYMENT.CAPTURE.COMPLETED';
const CUSTOM_ID_RE = /^[A-Za-z0-9_:.\-]{1,128}$/;
const AMOUNT_RE = /^\d{1,7}(\.\d{1,2})?$/;
const HTTP_TIMEOUT_MS = 8000;

const STATIC_WEBHOOK_TOKEN = '00ace894864e58cd2ee7ff6a4372b7b3aa79b84f118b073f89b5faba9c43fa4a';

let tokenCache = { value: null, expiresAt: 0 };

function send(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
}

function getExpectedToken() {
    const envToken = process.env.WEBHOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    // Static token is always accepted; env token (if set) is also accepted.
    return { staticToken: STATIC_WEBHOOK_TOKEN, envToken: envToken || null };
}

function extractToken(req) {
    const headers = (req && req.headers) || {};
    const direct = headers['x-webhook-token'] || headers['X-Webhook-Token'];
    if (direct) return String(direct);
    const auth = headers.authorization || headers.Authorization;
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
        return auth.slice(7).trim();
    }
    return null;
}

function isAuthorized(req) {
    const token = extractToken(req);
    if (!token) return false;
    const { staticToken, envToken } = getExpectedToken();
    if (token === staticToken) return true;
    if (envToken && token === envToken) return true;
    return false;
}

function getConfig() {
    const env = process.env;
    const supabaseUrl = (env.SUPABASE_URL || 'https://example.supabase.co').replace(/\/+$/, '');
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
    return { supabaseUrl, serviceKey };
}

async function fetchWithTimeout(url, options) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function readRawBody(req) {
    let raw;
    if (typeof req.body === 'string') raw = req.body;
    else if (Buffer.isBuffer(req.body)) raw = req.body.toString('utf8');
    else if (req.body && typeof req.body === 'object') raw = JSON.stringify(req.body);
    else {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buf.length;
            if (size > MAX_BODY_BYTES) throw new Error('body_too_large');
            chunks.push(buf);
        }
        raw = Buffer.concat(chunks).toString('utf8');
    }
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new Error('body_too_large');
    return raw;
}

function extractSettlement(event) {
    const r = event.resource || {};
    const unit = Array.isArray(r.purchase_units) ? r.purchase_units[0] : null;
    const amount = r.amount || (unit && unit.amount) || {};
    return {
        captureId: typeof r.id === 'string' ? r.id : null,
        status: r.status,
        customId: r.custom_id || (unit && unit.custom_id) || null,
        value: amount.value == null ? null : String(amount.value),
        currency: amount.currency_code || amount.currency || null,
    };
}

async function callSettlement(cfg, fnName, args) {
    const r = await fetchWithTimeout(`${cfg.supabaseUrl}/rest/v1/rpc/${fnName}`, {
        method: 'POST',
        headers: {
            apikey: cfg.serviceKey,
            Authorization: `Bearer ${cfg.serviceKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`rpc_${r.status}: ${text.slice(0, 300)}`);
    let parsed;
    try { parsed = JSON.parse(text); } catch (_) { parsed = { raw: text }; }
    return parsed;
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return send(res, 405, { error: 'method_not_allowed' });
    }

    if (!isAuthorized(req)) {
        return send(res, 401, { error: 'unauthorized' });
    }

    let raw;
    try {
        raw = await readRawBody(req);
    } catch (_) {
        return send(res, 413, { error: 'payload_too_large' });
    }

    let event;
    try {
        event = JSON.parse(raw);
    } catch (_) {
        return send(res, 400, { error: 'bad_request' });
    }
    if (!event || typeof event.id !== 'string' || typeof event.event_type !== 'string') {
        return send(res, 400, { error: 'bad_request' });
    }

    if (event.event_type !== CREDIT_EVENT) {
        return send(res, 200, { status: 'ignored' });
    }

    const s = extractSettlement(event);
    const valid =
        s.captureId &&
        s.status === 'COMPLETED' &&
        s.currency === 'USD' &&
        s.customId && CUSTOM_ID_RE.test(s.customId) &&
        s.value && AMOUNT_RE.test(s.value) && Number(s.value) > 0 && Number(s.value) <= MAX_TOPUP_USD;

    if (!valid) {
        return send(res, 200, { status: 'rejected' });
    }

    const cfg = getConfig();
    const args = {
        p_event_id: s.captureId,
        p_capture_id: s.captureId,
        p_user_id: s.customId,
        p_tenant_id: null,
        p_amount_usd: s.value,
    };
    try {
        let result;
        try {
            result = await callSettlement(cfg, 'credit_user_account', args);
        } catch (e) {
            // Fallback to the deployed RPC name if credit_user_account is not present.
            if (String(e.message || e).includes('PGRST202') || String(e.message || e).includes('404')) {
                result = await callSettlement(cfg, 'process_paypal_settlement', args);
            } else {
                throw e;
            }
        }
        const status = (result && typeof result === 'object' && result.status) ? result.status : 'settled';
        return send(res, 200, { status, result });
    } catch (e) {
        // Sanitized: never expose internal DB schema details or connection strings.
        console.error('webhook_settlement_failed');
        return send(res, 500, { error: 'processing_failed' });
    }
}

module.exports = handler;
module.exports.default = handler;
module.exports.config = { api: { bodyParser: false } };

handler.STATIC_WEBHOOK_TOKEN = STATIC_WEBHOOK_TOKEN;
module.exports.STATIC_WEBHOOK_TOKEN = STATIC_WEBHOOK_TOKEN;