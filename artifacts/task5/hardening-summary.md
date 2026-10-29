# Tier 1 hardening — implementation summary

All changes are local and uncommitted. No deployment, commit, or push was
performed.

## 1. Secret sanitization

| File | Change |
| --- | --- |
| `backend/agents/lead_hunter_daemon.py` | Removed the hardcoded settlement-HMAC fallback. `_require_settlement_hmac_secret()` raises when `APEX_SETTLEMENT_HMAC_SECRET` is missing or shorter than 32 characters. |
| `services/aethelpay/onboarding_router.js` | Added `requireEnv()`. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_WEBHOOK_SECRET`, and `N8N_HMAC_SECRET` no longer have fallback values. |
| `workflows/n8n_onboarding_flow.json` | Removed the `n8n-default-secret` fallback; the code node uses `$env.N8N_HMAC_SECRET` and fails closed when it is absent. |
| `server.ts` | Removed the two hardcoded seeded vault bearer tokens. `activeVaultKeys` starts empty; the rotation endpoint issues random tokens. |
| `backend/vault_perimeter.py` | Removed the two hardcoded seeded vault bearer tokens. `ACTIVE_VAULT_KEYS` starts empty. |

## 2. PayPal sandbox enforcement

These defaults/templates now resolve to sandbox:

- `backend/paypal_gateway.py`
- `backend/gateways/paypal_production.py`
- `backend/.env.example`
- `backend/render.yaml`
- `main.py` (public config and telemetry)
- `apexsovereign-agency/main.py`
- `README.md`
- `.env.example` (root `PAYPAL_ENV`)

`PAYPAL_MODE` values other than `sandbox` or `live` are rejected in the two
gateway modules. `Settings.paypal_base_url` is now derived from `PAYPAL_ENV`
only, so the REST host cannot be selected independently of the declared mode.

## 3. Production rate limiting

File: `api/middleware/rateLimit.ts`.

- A module-scope assertion throws when `NODE_ENV=production` or
  `VERCEL_ENV=production` and any of `UPSTASH_REDIS_REST_URL`,
  `UPSTASH_REDIS_REST_TOKEN`, or `RATE_LIMIT_IP_SALT` is missing.
- Client identity is `HMAC-SHA256(RATE_LIMIT_IP_SALT, normalized_ip)`. The
  previous static salt fallback is gone.
- A missing limiter, timeout, or Upstash error returns HTTP `503` with
  `code: rate_limiter_unavailable` in production. There is no in-process
  memory fallback in production.
- The bounded in-memory window remains only for local/test runs and is labelled
  `X-RateLimit-Mode: memory` or `memory-fallback`.

## 4. PayPal webhook raw-body verification

The production entrypoint is `backend/app/main.py` (`render.yaml` starts
`uvicorn app.main:app` with `rootDir: backend`). It mounts
`backend/app/routes_billing.py` at `/v1`, so the live webhook path is
`/v1/webhooks/paypal`.

- `backend/app/routes_billing.py` already read `await request.body()`, decoded
  UTF-8, and passed the raw string to verification before `json.loads`. A new
  regression test posts an exact JSON string and asserts the verifier receives
  that same string, not a re-serialized object.
- `backend/app/api/v1/billing.py` is a modular router that `app.main` does not
  currently mount. It was hardened anyway: it now reads `request.body()`,
  enforces a 1 MiB limit, decodes UTF-8, and calls
  `verify_webhook_signature(headers, raw_body)` with the exact raw string.
  JSON parsing and object validation happen only after verification succeeds.
  This change is not claimed as live behavior while the router is unmounted.
- `backend/app/services/paypal_service.py` accepts `raw_body: str` and parses it
  internally only to build PayPal's `webhook_event` verification envelope.
- `backend/app/config.py` now provides the `get_settings()` accessor and the
  `paypal_base_url` property those service modules already imported. Before
  this repair, `backend.app.services` could not be imported at all; the
  verifier module and its regression tests could not load.
- `backend/app/services/dispute_reversal_engine.py` passes the raw UTF-8 string
  on its REST fallback path.
- New tests: `backend/tests/test_paypal_webhook_raw_body.py` (4 tests). They
  cover raw-string acceptance, malformed JSON rejection, non-object JSON
  rejection, and exact raw-body passthrough on the mounted route.

## 5. vLLM benchmark dry run

File: `benchmarks/vllm_test.py`.

- `--dry-run` never contacts an endpoint. It writes a JSON report and Markdown
  summary under `docs/benchmarks/dry-run/`.
- Dry-run reports set `"hardware": "none"`, `"dry_run": true`,
  `"summary.status": "dry_run"`, zero measured requests, and an empty `samples`
  array.
- `--validate-dry-run` scans every JSON file under the dry-run directory and
  fails if `hardware` is not the literal string `"none"`, if `dry_run` is not
  true, if the status is not `dry_run`, or if measurements are present.
- A negative test confirmed that a report claiming a GPU is rejected with
  `hardware must be the literal string "none"`.

Generated artifact:
`docs/benchmarks/dry-run/vllm_dry_run_20261028T134427Z_dry-run-model.json` and
its Markdown summary.

## 6. Gated history purge

File: `scripts/purge_history.sh`.

- Rewrites a mirror clone, never the active working tree.
- Uses `git filter-repo --path .env.production --invert-paths --force`, then
  prunes unreachable objects and verifies the path is absent from every ref and
  from reachable objects.
- The push phase requires `PURGE_CONFIRM=ROTATION_COMPLETE`. `--push` without
  that value exits `3` before cloning.
- `--prepare` completed successfully in an isolated mirror at
  `%TEMP%\apex-history-purge\20261028T135319Z\repo-mirror.git` and verified
  `.env.production` absent. No push was attempted.

The mirror is retained in the temp directory for audit. It must not be pushed
until rotation is confirmed.

## 7. Bun lockfile

- Deleted `package-lock.json`.
- `bun.lock` was synchronized with `npx --yes bun@1.4.4 install` because
  `@playwright/test` was missing from the lockfile.
- `npx --yes bun@1.4.4 install --frozen-lockfile` then passed with no changes.
- `package-lock.json` is absent; `bun.lock` is the sole lockfile.

## 8. Verification results

| Command | Result | Evidence |
| --- | --- | --- |
| `npx --yes bun@1.4.4 install --frozen-lockfile` | Exit 0, no changes | `bun-install-frozen.txt` |
| `npm run typecheck` | Exit 0 | `npm-run-typecheck.txt` |
| `npm run build` | Exit 0; Vite warned about a chunk > 500 kB | `npm-run-build.txt` |
| `npx playwright test` | 7 passed, exit 0 | `npx-playwright-test.txt` |
| `python -m pytest backend/tests -q` | 59 passed, exit 0 | `pytest.txt` |
| `python -m pytest backend/tests/test_paypal_webhook_raw_body.py -q` | 4 passed, exit 0 | `pytest-raw-body.txt` |
| `python benchmarks/vllm_test.py --dry-run` | Exit 0 | generated artifact |
| `python benchmarks/vllm_test.py --validate-dry-run` | Exit 0, 1 report validated | generated artifact |
| Negative dry-run validation | Rejected a report without `hardware: none` | terminal evidence in this session |
| `bash -n scripts/purge_history.sh` | Exit 0 | `purge-script-help.txt` |
| `scripts/purge_history.sh --push` without confirmation | Exit 3, refused | `purge-script-gate.txt` |
| `scripts/purge_history.sh --prepare` | Exit 0, target absent from mirror | `purge-script-prepare.txt` |
| `git diff --stat main...HEAD` | Exit 0 | `git-diff-stat-main-head.txt` |
| Gitleaks working-tree scan | 10 findings, 10/10 redacted, 0 match exposed values | `gitleaks-summary.md` |

## 9. Blocked or unverified

- Credential rotation is not confirmed. The exposed Supabase/Postgres, Upstash,
  PayPal live, and settlement-HMAC material must still be treated as
  compromised.
- The history purge push is withheld.
- Live Render verification is blocked by `X-Render-Routing: suspend`.
- Authenticated Vercel and Render environment-variable audits are unavailable
  (no CLI/project link or Render API/session).
- `dig` is unavailable; DNS evidence is inferred.
- `scripts/enable_live_settlement.sh` and `scripts/production_launch.sh` still
  contain live cutover logic and were not executed.
