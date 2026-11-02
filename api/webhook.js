'use strict';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_TOPUP_USD = Number(process.env.MAX_TOPUP_USD || 10000);
const CREDIT_EVENT = 'PAYMENT.CAPTURE.COMPLETED';
const CUSTOM_ID_RE = /^[A-Za-z0-9_:.\-]{1,128}$/;
const AMOUNT_RE = /^\d{1,7}(\.\d{1,2})?$/;
const HTTP_TIMEOUT_MS = 8000;

let tokenCache = { value: null, expiresAt: 0 };

function send(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
}

function getConfig() {
    const env = process.env;
    const missing = ['PAYPAL_ENV', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID',
        'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !env[k]);
    if (env.PAYPAL_ENV && !['live', 'sandbox'].includes(env.PAYPAL_ENV)) missing.push('PAYPAL_ENV(valid)');
    if (missing.length) return { ok: false, missing };
    return {
        ok: true,
        paypalBase: env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
        clientId: env.PAYPAL_CLIENT_ID,
        clientSecret: env.PAYPAL_CLIENT_SECRET,
        webhookId: env.PAYPAL_WEBHOOK_ID,
        supabaseUrl: env.SUPABASE_URL.replace(/\/+$/, ''),
        serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    };
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
            size += chunk.length;
            if (size > MAX_BODY_BYTES) throw new Error('body_too_large');
            chunks.push(chunk);
        }
        raw = Buffer.concat(chunks).toString('utf8');
    }
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new Error('body_too_large');
    return raw;
}

async function getPayPalToken(cfg) {
    if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60000) return tokenCache.value;
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
    const r = await fetchWithTimeout(`${cfg.paypalBase}/v1/oauth2/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
    });
    if (!r.ok) throw new Error(`paypal_token_${r.status}`);
    const j = await r.json();
    tokenCache = { value: j.access_token, expiresAt: Date.now() + (Number(j.expires_in) || 300) * 1000 };
    return tokenCache.value;
}

function h(headers, name) {
    const v = headers[name];
    return Array.isArray(v) ? v[0] : v;
}

function hasSignatureHeaders(headers) {
    return ['paypal-transmission-id', 'paypal-transmission-time', 'paypal-transmission-sig',
        'paypal-cert-url', 'paypal-auth-algo'].every((n) => typeof h(headers, n) === 'string' && h(headers, n));
}

function certUrlIsPayPal(url) {
    try {
        const u = new URL(url);
        return u.protocol === 'https:' && (u.hostname === 'paypal.com' || u.hostname.endsWith('.paypal.com'));
    } catch (_) {
        return false;
    }
}

async function verifySignature(cfg, headers, event) {
    const certUrl = h(headers, 'paypal-cert-url');
    if (!certUrlIsPayPal(certUrl)) return false;
    const token = await getPayPalToken(cfg);
    const r = await fetchWithTimeout(`${cfg.paypalBase}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auth_algo: h(headers, 'paypal-auth-algo'),
            cert_url: certUrl,
            transmission_id: h(headers, 'paypal-transmission-id'),
            transmission_sig: h(headers, 'paypal-transmission-sig'),
            transmission_time: h(headers, 'paypal-transmission-time'),
            webhook_id: cfg.webhookId,
            webhook_event: event,
        }),
    });
    if (!r.ok) throw new Error(`paypal_verify_${r.status}`);
    const j = await r.json();
    return j.verification_status === 'SUCCESS';
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

async function callSettlement(cfg, args) {
    const r = await fetchWithTimeout(`${cfg.supabaseUrl}/rest/v1/rpc/process_paypal_settlement`, {
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
    return JSON.parse(text);
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return send(res, 405, { error: 'method_not_allowed' });
    }

    if (!hasSignatureHeaders(req.headers)) return send(res, 401, { error: 'unauthorized' });

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

    const cfg = getConfig();
    if (!cfg.ok) {
        console.error('webhook_config_missing', cfg.missing);
        return send(res, 500, { error: 'server_error' });
    }

    try {
        const ok = await verifySignature(cfg, req.headers, event);
        if (!ok) {
            console.warn('webhook_signature_rejected', { event_id: event.id });
            return send(res, 401, { error: 'unauthorized' });
        }
    } catch (e) {
        console.error('webhook_verify_unavailable', String(e.message || e));
        return send(res, 503, { error: 'unavailable' });
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
        console.error('webhook_unprocessable_verified_event', {
            event_id: event.id, capture_id: s.captureId, status: s.status,
            currency: s.currency, has_custom_id: Boolean(s.customId), value: s.value,
        });
        return send(res, 200, { status: 'rejected' });
    }

    try {
        const result = await callSettlement(cfg, {
            p_event_id: event.id,
            p_capture_id: s.captureId,
            p_user_id: s.customId,
            p_tenant_id: null,
            p_amount_usd: s.value,
        });
        console.info('webhook_settled', { event_id: event.id, status: result.status });
        return send(res, 200, { status: result.status });
    } catch (e) {
        console.error('webhook_settlement_failed', { event_id: event.id, error: String(e.message || e) });
        return send(res, 500, { error: 'processing_failed' });
    }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
