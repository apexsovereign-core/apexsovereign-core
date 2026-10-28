# ApexSovereign.ai — Production Enforcement Rules

These rules apply to every agent and every change in this workspace. They are invariants, not suggestions. If a request conflicts with one, stop and state the conflict instead of weakening the invariant.

## 1. Routing precedence (Vercel)

- `vercel.json` is a V2 config: `"version": 2`. Do not introduce legacy `routes`; they run before filesystem resolution and shadow `/assets/*`, `/legal/*`, and built files.
- Preserve this effective order in `rewrites`:
  1. filesystem/build output
  2. `/health` -> `/api/health`
  3. telemetry paths -> Render
  4. `/v1/:path*` -> Render `/v1/:path*`
  5. `/api/v1/:path*` -> Render `/v1/:path*`
  6. `/api/(.*)` -> local `/api/$1`
  7. `/(.*)` -> `/index.html` (SPA fallback, last)
- `/api/health` and `/api/checkout` are local Vercel functions in `api/`. They must not be redirected to Render.
- A new public backend path needs an explicit rewrite **before** the SPA fallback. Never place a catch-all above `/api/*`, `/assets/*`, or `/legal/*`.
- `/api/(.*)` is not a Render proxy. Only `/v1/*`, `/api/v1/*`, and the explicit telemetry paths proxy to Render. If a backend route such as `/api/webhooks/paypal` must reach Render, add an explicit rewrite before `/api/(.*)` and verify the built route order.
- Do not expose an open proxy. Rewrites must target fixed, allowlisted upstream paths; never interpolate arbitrary hosts.
- Keep the security headers in `vercel.json`. Do not weaken `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, or the API cache policy.

## 2. Backend reliability

- Every external call (PayPal, Render, Supabase, email, webhooks) needs an explicit timeout, bounded retries with exponential backoff and jitter, and a defined failure response. Never retry a non-idempotent write without an idempotency key.
- Fail closed on payment, auth, ledger, and tenant-isolation failures. Return a stable error code; never return success or a fabricated fallback balance.
- Health endpoints report measured state only. `api/health.ts` returns `status`, `system`, `exchange`, `ledger_rate`, and a current UTC `timestamp`; do not add invented uptime, revenue, or security claims.
- Preserve HTTP semantics: 400 validation, 401 unauthenticated, 402 insufficient funds, 403 forbidden, 404 missing, 409 conflict/replay, 429 rate limit, 502/503 upstream unavailable, 500 internal. Do not collapse failures into 200.
- Make writes idempotent at the database boundary. Use unique constraints/indexes, not in-memory checks. Handle duplicate and concurrent requests deterministically.
- Emit structured logs with request/correlation IDs, tenant context where authorized, and stable error codes. Never log secrets, tokens, full PayPal payloads, HMAC keys, or PII.
- Prefer the smallest change that is production-ready. Do not add speculative services, mocks, or placeholder success paths.

## 3. Atomic ledger execution

- Currency invariant: `$1.00 USD = 100 CU`. CU is an integer. Convert with exact decimal arithmetic; reject sub-cent precision and floating-point money.
- CU is minted **only** by `apex.increment_user_credits(...)` after a PayPal-verified `PAYMENT.CAPTURE.COMPLETED` event. The checkout quote endpoint must return `compute_units_credited: 0`, `credited: false`, `minted_by: 'paypal_webhook_only'`, and `requires_webhook_confirmation: true`.
- All non-mint postings go through `apex.post_transaction(...)`. Application code must never `INSERT`, `UPDATE`, or `DELETE` `apex.transactions` or `apex.ledger_entries` directly.
- Every transaction must be balanced: `sum(debits) = sum(credits)`, all amounts `> 0`. Top-ups debit `paypal_clearing` and credit the tenant wallet; consumption does the reverse.
- Sign the canonical representation with HMAC-SHA256 using the active `LEDGER_HMAC_KID`. Verify with a constant-time comparison. No fallback key, no default secret, no unsigned write.
- Persist the exact `signed_at` timestamp covered by the HMAC. Preserve the unique idempotency index on `apex.transactions.idempotency_key`.
- Enforce immutability at the database level (triggers). Never bypass it with service-role writes.
- Lock the wallet row before checking balance. Never compute a balance from client input.
- Any ledger RPC must be `SECURITY DEFINER` with `SET search_path = apex, pg_temp`, and execution revoked from `PUBLIC`, `anon`, and `authenticated`; grant only `service_role` (and `postgres` for migrations).

## 4. Tenant isolation, auth, and secrets

- Supabase RLS must be enabled and forced on tenant tables. Policies must derive identity from `auth.uid()` or a verified server-side claim, never from a request body or header.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_CLIENT_SECRET`, `LEDGER_HMAC_*`, or any server secret to the browser, a Vite `VITE_*` variable, or a committed file. `.env.example` contains names only.
- Validate every request at the trust boundary: type, length, range, enum, and unknown-field rejection. Bound body size and array lengths.
- Apply authorization on every tenant-scoped read and write. Prevent BOLA/IDOR and mass assignment with explicit allowlists.
- Verify PayPal webhook signatures against `PAYPAL_WEBHOOK_ID` **before** parsing business data or touching the database. Reject unverified events with 401; return 503 when verification is not configured.
- Deduplicate webhook events by event ID and capture/order ID. A replay must return the recorded result, never mint again.
- Do not claim a security control is active unless it is measured or tested. Report unknown or unmeasured state as unknown.

## 5. Verification and reporting

- Inspect the existing implementation before editing. Preserve working behavior unless the task explicitly changes it.
- Run the relevant checks and report the exact commands and results: `npx --no-install tsc --noEmit`, `npm run build` / `vite build`, `vercel build`, backend `pytest`, and any handler contract tests.
- Distinguish "implemented", "tested locally", "built", and "deployed". Never claim a deployment, balance, receipt, or security status that was not observed.
- Do not push `main`. Do not commit or push unless the user asks.
