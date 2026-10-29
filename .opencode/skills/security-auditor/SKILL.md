---
name: security-auditor
description: Security audit standards for ApexSovereign.ai. Covers PayPal webhook integrity, tenant isolation and RLS, secrets handling, ledger signing, Vercel routing security, and Gitleaks scan compliance. Enforces PAYPAL_MODE='sandbox' and raw-body HMAC validation. Use when auditing security posture, running penetration tests, or validating compliance controls.
---

# Security Auditor — ApexSovereign.ai

## Audit Scope

### 1. PayPal Webhook Integrity (Highest Severity)
- Verify transmission signature against `PAYPAL_WEBHOOK_ID` before parsing.
- Return 401 for unverified events; 503 when verification is not configured.
- Trust PayPal as authority for captured amount; recompute CU at `$1.00 = 100 CU`.
- Require `PAYMENT.CAPTURE.COMPLETED` before minting.
- Deduplicate by event ID and capture/order ID (unique constraints, not in-memory sets).
- Persist event atomically with credit RPC; never mint twice.
- Never log full webhook body, payer email, or signature headers.
- `PAYPAL_ENV` must default to `sandbox`; live requires founder override token.

### 2. Tenant Isolation & RLS
- RLS `ENABLE`d and `FORCE`d on all tenant tables.
- No `USING (true)` for `authenticated` on tenant-scoped tables.
- Identity from `auth.uid()` or verified server-side claim only.
- `SECURITY DEFINER` functions: `SET search_path = apex, pg_temp`, revoked from `PUBLIC`/`anon`/`authenticated`.
- Service-role key never in browser, `VITE_*` variable, log, or committed file.
- BOLA/IDOR and mass assignment tested with explicit allowlists.

### 3. Secrets Handling
- No secrets in committed files, logs, or terminal output.
- `.env.example` contains names only; `.env.production` is gitignored.
- Gitleaks scan must report 0 unredacted credential findings on working tree.
- History purge must be gated on `PURGE_CONFIRM=ROTATION_COMPLETE`.
- All exposed credentials treated as compromised until rotation confirmed.

### 4. Ledger Signing
- HMAC-SHA256 with active `LEDGER_HMAC_KID`; constant-time comparison.
- No fallback key, no default secret, no unsigned write.
- Persist exact `signed_at` timestamp covered by HMAC.
- Unique idempotency index on `apex.transactions.idempotency_key`.
- Immutability enforced at database level (triggers).

### 5. Vercel Routing Security
- No open proxy; rewrites target fixed, allowlisted upstream paths.
- `/api/(.*)` is local, not a Render proxy.
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  `Referrer-Policy: strict-origin-when-cross-origin`, API cache `no-cache`.
- Decommissioned paths return 410, not 200 or SPA fallback.

### 6. Performance & Latency
- Compute allocation: < 18ms (edge to Supabase RPC).
- Health check: < 5ms (no upstream probes).
- Checkout quote: < 10ms (deterministic, no external calls).
- Request body limits: 4 KiB checkout, 1 MiB webhooks.

### 7. Gitleaks Compliance
- Working tree scan: 0 unredacted findings.
- History scan (post-purge): 0 findings on branches.
- PR refs (`refs/pull/*`) require GitHub Support purge.
- Scan config: `artifacts/task5/gitleaks-working-tree.toml`.

### Audit Output Format
For each finding, report:
1. **Severity**: Critical / High / Medium / Low
2. **Location**: file:line
3. **Exploit path**: concrete steps to exploit
4. **Impact**: what an attacker gains
5. **Fix**: specific code change with file and line reference
6. **Verification**: command to confirm the fix

### Red Flags (immediate escalation)
- Any `return True` on webhook verification failure.
- Any `simulated: true` settlement success.
- Any secret in `VITE_*` variable or committed file.
- Any RLS policy with `USING (true)` on tenant tables.
- Any `INSERT`/`UPDATE`/`DELETE` on ledger tables outside `apex.post_transaction`.
- Any `PAYPAL_MODE=live` without founder override.