# Global Dominance Architecture — ApexSovereign.ai

Date: 2026-10-29 (UTC). Branch: `refactor/sovereign-exchange`.

## 1. Non-Autoregressive Compute Routing Model

Implemented `src/lib/computeRouter.ts` — a pure, side-effect-free routing model that
scores every candidate GPU node independently (parallel, no sequential dependency).

### Scoring Factors (all normalised to [0,1])
| Factor | Weight | Direction | Description |
|--------|--------|-----------|-------------|
| Price | 0.35 | Lower is better | `1 - rateCuHr / maxRate` |
| Availability | 0.25 | Available best | Status score: available=1.0, allocated=0.3, maintenance=0.1, offline=0.0 |
| Thermal | 0.20 | Higher headroom | `thermalHeadroomC / 20` (clamped [0,1]) |
| Latency | 0.20 | Lower RTT | `1 - rttMs / maxRtt` |

### Performance Target
- Allocation decision: **< 18ms** (edge to Supabase RPC).
- Health check: **< 5ms** (no upstream probes).
- Checkout quote: **< 10ms** (deterministic, no external calls).

### Vercel Serverless Endpoint
- `api/compute/allocate.ts` — POST handler, Zod-validated, body bounded to 4 KiB.
- Uses non-autoregressive `routeCompute()` to score all nodes in a single pass.
- Returns allocation quote with `cu_deducted: false` (CU deduction is a separate
  Supabase RPC step, not performed at the edge).

## 2. Supabase RPC: `apex.deduct_compute_units`

Migration: `supabase/migrations/004_apex_deduct_compute.sql`

- `SECURITY DEFINER` with `SET search_path = apex, pg_temp`.
- Row-level lock (`FOR UPDATE`) on `apex.ledger_accounts`.
- Validates: positive amount, account exists, not frozen, sufficient balance.
- Atomic: balance update + transaction insert in single transaction.
- Revoked from `PUBLIC`, `anon`, `authenticated`; granted to `postgres`, `service_role`.
- Transaction type: `COMPUTE_DEDUCTION` with reservation reference.

## 3. Dark-Mode Terminal Aesthetics

The existing Vite/Tailwind build uses dark-mode-first styling. Key design tokens:
- Background: slate-900/950 (deep dark)
- Accent: emerald-400/500 (sovereign green)
- Monospace: terminal-style code blocks in `backend/settlement_api/static/index.html`
- Glass-morphism cards with backdrop-blur
- Sub-second live migration banners (eBPF sockmap/XDP)

## 4. Verification Results

| Command | Result |
|---------|--------|
| `npm run typecheck` | exit 0 |
| `npm run verify:routing` | exit 0 |
| `npm run build` | exit 0 |
| `python -m pytest backend/tests -q` | 66 passed |
| `gitleaks detect --redact` | 0 findings, exit 0 |

## 5. Files Changed

| File | Change |
|------|--------|
| `src/lib/computeRouter.ts` | New: non-autoregressive routing model |
| `api/compute/allocate.ts` | New: Vercel serverless compute allocation endpoint |
| `supabase/migrations/004_apex_deduct_compute.sql` | New: apex-schema CU deduction RPC |

## 6. Architecture Invariants Preserved

- PAYPAL_ENV defaults to sandbox; non-sandbox requires founder override.
- Raw-body HMAC webhook validation enforced.
- No open proxy; Vercel Edge is primary backend.
- $1.00 USD = 100 CU; integer CU only.
- RLS enabled and forced on tenant tables.
- No secrets in browser, VITE_* variables, or committed files.