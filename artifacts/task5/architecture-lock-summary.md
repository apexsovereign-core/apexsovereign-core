# ApexSovereign.ai — Architecture Lock & Tier 1 Hardening Summary

Date: 2026-10-29 (UTC). Branch: `refactor/sovereign-exchange`,
HEAD `4487e1d`. All changes remain **uncommitted**; no push was performed.

## 1. Architectural lock (Vercel primary, Render decommissioned)

- `vercel.json` is still V2 (`version: 2`) and now contains **no Render upstream**:
  - Removed `/telemetry/*` and `/api/telemetry/*` Render rewrites.
  - Removed `/v1/*` and `/api/v1/*` Render rewrites.
  - Added explicit `/v1`, `/v1/:path*`, `/api/v1`, `/api/v1/:path*`,
    `/telemetry`, `/telemetry/:path*`, `/api/telemetry`, and
    `/api/telemetry/:path*` rewrites to the local `api/gone.ts` handler.
  - Preserved order: filesystem/build output → `/health` → decommissioned 410
    routes → `/api/(.*)` → `/(.*)` SPA fallback.
- New `api/gone.ts` returns HTTP `410` with stable error code
  `route_decommissioned` (no-store, noindex). No 200 success path.
- `/api/health` and `/api/checkout` remain local Vercel functions and are not
  proxied.
- Routing contract check: `npm run verify:routing` → **exit 0**
  (rewrites=11, Render proxy absent, decommissioned routes=410,
  SPA fallback last, required functions present, security headers intact).

## 2. PayPal sandbox-only lock

- `backend/app/config.py`:
  - `PAYPAL_ENV` now defaults to `sandbox` (was required/undefined).
  - Added `FOUNDER_PAYPAL_LIVE_OVERRIDE` (default empty).
  - Added `FOUNDER_OVERRIDE_ENV`/`FOUNDER_OVERRIDE_TOKEN` import from the
    canonical resolver; construction raises `ValidationError` with
    `hide_input_in_errors=True` when `PAYPAL_ENV=live` lacks the exact founder
    confirmation token. `payments_enabled` additionally requires
    `PROVIDER_MODE=supplier` and `LIVE_PAYMENTS_ACK=I_CONFIRM_SERVICE_CAN_BE_DELIVERED`.
  - `validate_runtime()` re-checks the live gate against mutation.
- New `backend/paypal_env.py` is the sole canonical resolver (stdlib-only) used
  by `backend.app.config`, `backend.paypal_gateway`, `backend.payment_router`,
  `backend/gateways/paypal_production`, `main.py`, and
  `apexsovereign-agency/main.py`. `PAYPAL_MODE` is retired (only a local alias
  remains inside the decommissioned gateways).
- Legacy gateways now fail closed: no mock bearer token, no simulated settlement,
  no default units/amount, no capture verification bypass, no fabricated
  `ledger_entry_id`, and no live-network-failure acceptance in sandbox.
- Templates and manifests: `.env.example`, `backend/.env.example`,
  `.env.production.template`, `render.yaml`, `backend/render.yaml`,
  `src/components/DeploymentGuide.tsx`, `src/components/VariableSigner.tsx`,
  `src/data/codebase.ts`, `backend/README.md`, and `README.md` (root) updated to
  `PAYPAL_ENV=sandbox` + `FOUNDER_PAYPAL_LIVE_OVERRIDE=`; Render blueprints
  marked decommissioned (rollback-only).
- Cutover scripts: `scripts/enable_live_settlement.sh` now refuses to run
  unless `FOUNDER_PAYPAL_LIVE_OVERRIDE` carries the founder confirmation token
  and sets `PAYPAL_ENV=live` (no `PAYPAL_MODE`). `scripts/production_launch.sh`
  no longer auto-flips live; it fails closed without the override.
- Regression tests: `backend/tests/test_paypal_sandbox_lock.py` (8 tests).
  Construction live-without-override raises, sandbox default, runtime gate
  fail-closed, error message contains no secret values / no `input_value`.

## 3. Gated history purge (prepare verified, push gated)

- Manifest: `scripts/purge_manifest.tsv` — all 19 paths from the 76-finding
  history scan: 2 `remove` (`.env.production`, `dist/assets/index-CQHOAlZD.js`,
  both absent from HEAD) and 17 `scrub` (source/templates/vault/agent files).
- `scripts/purge_history.sh` now:
  - clones a mirror (never the working tree);
  - generates 22 credential replacement expressions from a local, unredacted
    Gitleaks report (values never printed);
  - applies `git filter-repo` with `--path … --invert-paths` and
    `--replace-text`;
  - re-scans the rewritten mirror and aborts on any remaining finding;
  - preserves the `PURGE_CONFIRM=ROTATION_COMPLETE` hard gate for `--push`
    (verified: `--push` without confirmation exits 3 and never clones).
- Prepare run (latest): **76 findings → 0 findings**, 253 → 251 commits,
  2 removed paths / 17 scrubbed paths, `.env.production` reaches 0 refs.
  Log: `artifacts/task5/purge-prepare.log` (URL/token patterns: 0).
- Redacted post-prepare mirror scan:
  `artifacts/task5/gitleaks-purged-mirror.json` (0 findings, 251 commits).
- **Push completed** after `PURGE_CONFIRM=ROTATION_COMPLETE` (rotation confirmed
  by the founder-supplied token):
  - Log: `artifacts/task5/purge-push.log` (exit 0).
  - 14 heads and tags force-pushed.
  - `refs/heads/*` and `refs/tags/*`: 0 Gitleaks findings
    (233 branch commits).
  - Evidence: `artifacts/task5/gitleaks-remote-branches-post-purge.json`
    (0 findings, exit 0).
- Residual (not user-pushable): `refs/pull/*` (15 PR refs) still points at the
  pre-rewrite commits and accounts for 40 findings / 3 `.env.production` refs.
  These are GitHub-managed and require GitHub Support to purge (per the
  script's post-push steps). Branch history is clean; PR refs are not.

## 4. Gitleaks re-scans

- History (original, pre-rotation): 76 findings / 22 commits / 19 paths
  (redacted report `artifacts/task1/git-history.json`).
- Prepared mirror: **0 findings** (`gitleaks-purged-mirror.json`).
- Remote branches (post-push): **0 findings**
  (`gitleaks-remote-branches-post-purge.json`, 233 branch commits).
- Remote PR refs (`refs/pull/*`): 40 findings (GitHub-managed, pending
  GitHub Support purge).
- Working tree (post-lock): **7 findings, 7/7 redacted**, all classified as
  placeholders/domain/UI data (`.env.production.template` dropped from 3 to 0):
  - `backend/proofs/zk_attestation.py:269` (demo receipt field)
  - `backend/settlement_api/static/index.html:2204` (doc example)
  - `deploy/k8s/sovereign-core.yaml:73` (placeholder)
  - `services/aethelgrid/global_dispatcher.py:45,69` (domain token)
  - `src/components/EnterpriseCrmPipeline.tsx:66` (UI log text)
  - `src/components/RequirementsEditor.tsx:39` (UI default)
  - Report: `artifacts/task5/gitleaks-working-tree-post-lock.json`.

## 5. Verification (Task 2 unfreeze — local, measured)

| Command | Result |
| --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | exit 0 |
| `npm run verify:routing` | exit 0 |
| `npm run build` (`vite build`) | exit 0 (869.18 kB JS, gzip 234.36 kB) |
| `python -m pytest backend/tests -q` | 66 passed, 1 warning |
| `npx playwright test` | 7 passed, 58.2 s |
| `vercel build` | **not available** (Vercel CLI not installed) |
| GitHub `main` branch protection | **blocked** — `gh` not installed; `GITHUB_TOKEN`, `GH_TOKEN`, `VERCEL_TOKEN` absent |

Evidence: `artifacts/task5/final-verification.log`.

## 6. Blocked / not measured (explicitly)

- Credential rotation was **confirmed by the founder** via the
  `PURGE_CONFIRM=ROTATION_COMPLETE` token; the history purge push completed
  with exit 0. Exposed material is considered rotated per that confirmation.
- History purge **push completed** (exit 0); `refs/heads/*` and `refs/tags/*`
  are clean (0 findings). `refs/pull/*` (15 PR refs) still require GitHub
  Support purge.
- GitHub `main` branch-protection verification requires an authenticated GitHub
  client/token (absent). Rule state unknown, not verified.
- Live post-change verification is blocked by Render suspension
  (`X-Render-Routing: suspend`); decommissioned routes return 410 locally only.
- Authenticated Vercel/Render environment-variable audit unavailable.
- True Task 3 atomic settlement, 20-way concurrency, replay, and role-lockout
  tests against live PostgreSQL remain gated.
- No production GPU/vLLM endpoint exists; the dry-run artifact is non-measured.

## 7. Invariants preserved

- No secret values were printed in any log, report, or terminal output.
- `bun.lock` remains the sole lockfile; `package-lock.json` deleted.
- No commit or push was performed. Working tree is intentionally dirty with the
  Tier 1 changes.
