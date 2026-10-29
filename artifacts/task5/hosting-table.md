# Task 0 — Hosting & Configuration Inventory

Observed: 2026-10-28T13:52Z. Read-only HTTP probes; no authenticated Vercel,
Render, Supabase, or PayPal API calls were made.

`dig` is unavailable on this host. DNS evidence is inferred from
`Resolve-DnsName` / `nslookup` and is not an HTTP-layer observation.

## Live mapping

| Path | Responding host | Observed result | Code source | Payment mode |
| --- | --- | --- | --- | --- |
| `https://apexsovereign.ai/` | Vercel edge | `308` redirect to `https://www.apexsovereign.ai/` | Vercel redirect configuration; app code not invoked | Not exposed |
| `https://www.apexsovereign.ai/` | Vercel edge | `200`, `X-Vercel-Cache: HIT`, `Content-Length: 5974` | Vercel static deployment of the Vite SPA HTML (inferred from body/cache; artifact not hash-verified) | Not exposed in the response |
| `https://apexsovereign.ai/api/health` | Vercel edge | `308` redirect to the `www` path | Redirect only; no application code | n/a |
| `https://www.apexsovereign.ai/api/health` | Vercel edge fronting Render | `503`, `X-Render-Routing: suspend` | Render suspension page; local `api/health.ts` was not executed | Unknown — cannot observe |
| `https://www.apexsovereign.ai/v1/config/public` | Vercel edge fronting Render | `503`, `X-Render-Routing: suspend` | Render suspended | Unknown — cannot observe |
| `https://www.apexsovereign.ai/api/v1/config/public` | Vercel edge fronting Render | `503`, `X-Render-Routing: suspend` | Render suspended | Unknown — cannot observe |

Raw headers: `live-headers.txt`.

## Routing observation

The live `/api/health` request is proxied to Render, not served by the local
`api/health.ts`. This contradicts the local `vercel.json` precedence, which
routes `/health` to `/api/health` locally. `/v1/*` and `/api/v1/*` also proxy
to Render. The local functions are exercised by the repository build and E2E
suite, but live behavior is not proven by them.

## Configuration audit

| Item | Status |
| --- | --- |
| `.vercel/repo.json` | Present (project/team identifiers not reproduced) |
| `.vercel/project.json` | Absent |
| Vercel CLI / authenticated project pull | Unavailable — no CLI, no project link |
| Vercel environment variable names/values | Not audited — requires authenticated API/CLI access |
| Render dashboard environment values | Not audited — no Render API token/session |
| `render.yaml` payment declaration | `PAYPAL_ENV: sandbox` |
| `backend/render.yaml` payment declaration | `PAYPAL_MODE: sandbox` (corrected in this pass) |
| `scripts/enable_live_settlement.sh` | Still contains a live cutover that writes `PAYPAL_MODE=live`; not executed |
| `scripts/production_launch.sh` | Still checks for live mode and can invoke the live cutover; not executed |

## Payment mode

No live PayPal client ID, webhook ID, or live-mode flag was observed in any
HTTP response. The only live-mode evidence in this workspace was the committed
`.env.production` recorded during Task 1, which remains in git history until
the gated purge is executed and pushed.

Source defaults were changed to sandbox in this pass. That is a source-level
change, not a live-environment audit.

## Deployment status

- Render is suspended (`X-Render-Routing: suspend`).
- No deployment was performed during this pass.
- Live post-change verification is blocked until Render is restored.
- Local evidence: typecheck, build, Playwright, and pytest all pass. See
  `README.md` in this directory for the exact logs.
