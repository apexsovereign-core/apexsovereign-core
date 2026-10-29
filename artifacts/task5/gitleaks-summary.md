# Gitleaks summary — post-sanitization working tree

Tool: gitleaks 8.30.1 (Windows x64), checksum-verified from the official
release. All scans used full redaction (`--redact`).

## 1. Git history (Task 1, unchanged)

| Metric | Result |
| --- | ---: |
| Findings | 76 |
| Unique commits | 22 |
| `generic-api-key` | 56 |
| `curl-auth-header` | 15 |
| `private-key` | 5 |
| `Secret` fields verified `REDACTED` | 76 / 76 |

The exposed `.env.production` is recorded at commit
`a75a3e7ecf8f27b4dd6c562e9db885d152462cbc` and remains reachable from four
remote Dependabot branches. It is not present at `HEAD`.

Redacted report: `../task1/git-history.json`.

## 2. Working tree (this pass)

Scope: source and configuration. The scan excludes `node_modules/`, `dist/`,
`artifacts/`, `playwright-report/`, `test-results/`, `__pycache__/`, and `.git/`
so vendored code and prior redacted reports do not dominate the result.

| Metric | Result |
| --- | ---: |
| Findings | 10 |
| `generic-api-key` | 8 |
| `private-key` | 1 |
| `curl-auth-header` | 1 |
| `Secret` fields verified `REDACTED` | 10 / 10 |
| Values matching the exposed `.env.production` | 0 / 10 |

Reports: `gitleaks-working-tree.json`, `gitleaks-working-tree.txt`.
Config: `gitleaks-working-tree.toml`.

The scan was re-run after the configuration accessor repair and the new
raw-body webhook tests. The result was unchanged: 10 findings, 10/10 redacted,
0 values matching the exposed `.env.production`.

## 3. Residual findings and classification

| Location | Rule | Classification |
| --- | --- | --- |
| `.env.production.template:36` | `generic-api-key` | Template placeholder (non-JWT, 39 chars) |
| `.env.production.template:37` | `generic-api-key` | Template placeholder (non-JWT, 39 chars) |
| `.env.production.template:56` | `private-key` | Base64 placeholder; decodes to 27 bytes, not a valid Ed25519 key |
| `backend/proofs/zk_attestation.py:269` | `generic-api-key` | Demo/test receipt field `secret_enclave_key`; only referenced in this file |
| `backend/settlement_api/static/index.html:2204` | `curl-auth-header` | Documentation example; short placeholder bearer value |
| `services/aethelgrid/global_dispatcher.py:45` | `generic-api-key` | `green_certificate_token` domain data, not an auth credential |
| `services/aethelgrid/global_dispatcher.py:69` | `generic-api-key` | `green_certificate_token` domain data, not an auth credential |
| `deploy/k8s/sovereign-core.yaml:73` | `generic-api-key` | 64-hex value is a repeating 16-character placeholder pattern |
| `src/components/EnterpriseCrmPipeline.tsx:66` | `generic-api-key` | UI log text |
| `src/components/RequirementsEditor.tsx:39` | `generic-api-key` | UI default form value |

No residual finding matched any value from the exposed `.env.production`
(compared by SHA-256 without printing either value).

## 4. Remediated in this pass

| Location | Change |
| --- | --- |
| `backend/agents/lead_hunter_daemon.py` | Removed the hardcoded `APEX_SETTLEMENT_HMAC_SECRET` fallback; the daemon now raises when the key is absent or shorter than 32 characters |
| `services/aethelpay/onboarding_router.js` | Removed `mock-service-role-key`, `sovereign-paypal-webhook-secret`, and `n8n-default-secret` fallbacks; required env values now fail closed |
| `workflows/n8n_onboarding_flow.json` | Removed the `n8n-default-secret` fallback from the HMAC verification code node |
| `server.ts` | Removed the two hardcoded seeded vault bearer tokens; the in-memory vault now starts empty and issues only random tokens |
| `backend/vault_perimeter.py` | Removed the two hardcoded seeded vault bearer tokens; the in-memory vault now starts empty |

These removals reduced the working-tree finding count from 16 to 10.

## 5. Residual risk

- The history purge is prepared but not pushed. `.env.production` remains in
  git history until `scripts/purge_history.sh --push` is run with
  `PURGE_CONFIRM=ROTATION_COMPLETE` after rotation is confirmed.
- Credential rotation is not confirmed. Do not treat the exposed Supabase,
  Upstash, PayPal, or settlement-HMAC material as revoked.
- A post-purge history re-scan is still required. A clean working-tree scan is
  not evidence that history is clean.
