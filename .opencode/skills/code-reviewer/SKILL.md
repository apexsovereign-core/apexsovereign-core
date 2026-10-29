---
name: code-reviewer
description: Code review standards for ApexSovereign.ai. Enforces PAYPAL_MODE='sandbox' as the absolute default, raw-body HMAC webhook signature validation, Vercel Edge routing invariants, atomic ledger integrity, and tenant isolation. Use when reviewing pull requests, auditing code changes, or validating security boundaries.
---

# Code Reviewer — ApexSovereign.ai

## Review Checklist

### 1. PayPal Sandbox Enforcement
- [ ] `PAYPAL_ENV` defaults to `sandbox` in all config and gateway modules.
- [ ] Non-sandbox mode requires `FOUNDER_PAYPAL_LIVE_OVERRIDE` with the exact founder confirmation token.
- [ ] No hardcoded `PAYPAL_MODE=live` or `PAYPAL_ENV=live` in source, templates, or scripts.
- [ ] Cutover scripts (`enable_live_settlement.sh`, `production_launch.sh`) refuse to run without the founder override.
- [ ] Frontend code reads `paypal_env` from server config, never hardcodes `live`.

### 2. Raw-Body Webhook Validation
- [ ] Webhook handlers read the raw request body before JSON parsing.
- [ ] Signature verification occurs before business logic.
- [ ] Unverified events return 401; unconfigured verification returns 503.
- [ ] No mock/placeholder bearer tokens in verification paths.
- [ ] No fail-open logic (sandbox must also fail closed on network errors).
- [ ] No fabricated settlement responses (no simulated success when DB is unavailable).
- [ ] Webhook body, payer email, and signature headers are never logged.

### 3. Vercel Edge Routing
- [ ] `vercel.json` is V2 config (no legacy `routes`).
- [ ] Rewrite order: filesystem → `/health` → telemetry → `/v1/*` → `/api/v1/*` → `/api/(.*)` → SPA fallback.
- [ ] `/api/health` and `/api/checkout` are local functions, not proxied.
- [ ] `/api/(.*)` is not a Render proxy.
- [ ] No open proxy or user-controlled host interpolation.
- [ ] Security headers preserved: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, API cache policy.

### 4. Atomic Ledger Integrity
- [ ] `$1.00 USD = 100 CU`; CU is an integer; exact decimal arithmetic only.
- [ ] CU minted only by `apex.increment_user_credits(...)` after PayPal-verified capture.
- [ ] Checkout quote returns `compute_units_credited: 0`, `credited: false`.
- [ ] All non-mint postings go through `apex.post_transaction(...)`.
- [ ] Every transaction balanced: `sum(debits) = sum(credits)`, all amounts > 0.
- [ ] HMAC-SHA256 signed with active `LEDGER_HMAC_KID`; constant-time verification.
- [ ] Wallet row locked before balance check; balance never from client input.
- [ ] Ledger RPCs are `SECURITY DEFINER` with `SET search_path = apex, pg_temp`; revoked from `PUBLIC`, `anon`, `authenticated`.

### 5. Tenant Isolation
- [ ] RLS enabled and forced on tenant tables.
- [ ] Identity derived from `auth.uid()` or verified server-side claim, never request body/header.
- [ ] No `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_CLIENT_SECRET`, or `LEDGER_HMAC_*` in browser or `VITE_*` variables.
- [ ] BOLA/IDOR and mass assignment tested with explicit allowlists.

### 6. Performance
- [ ] Compute allocation endpoints complete in < 18ms (edge to Supabase RPC).
- [ ] Health check responds in < 5ms (no upstream probes).
- [ ] Request bodies bounded (4 KiB checkout, 1 MiB webhooks).
- [ ] No heavy SDK imports at module top-level in serverless functions.

### Red Flags (immediate reject)
- Any `PAYPAL_MODE=live` without founder override.
- Any `return True` on webhook verification failure.
- Any `simulated: true` settlement success path.
- Any `INSERT`/`UPDATE`/`DELETE` on `apex.transactions` or `apex.ledger_entries` outside `apex.post_transaction`.
- Any secret in a `VITE_*` variable or committed file.
- Any RLS policy with `USING (true)` for `authenticated` on tenant tables.