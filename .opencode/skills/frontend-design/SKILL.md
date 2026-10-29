---
name: frontend-design
description: Frontend design and performance guidelines for ApexSovereign.ai. Enforces Vercel Edge + Supabase RPC performance benchmarks with <18ms latency target for compute allocation, PAYPAL_MODE='sandbox' enforcement, and raw-body HMAC webhook validation. Use when building or reviewing Vercel serverless functions, SPA routing, or compute allocation UI.
---

# Frontend Design — ApexSovereign.ai

## Vercel Edge + Supabase RPC Performance

### Latency Target
- Compute allocation endpoints (`/v1/compute/allocate`, `/api/v1/compute/allocate`) must complete in **< 18ms** from Vercel edge to Supabase RPC response.
- Health check (`/api/health`) must respond in **< 5ms** (no upstream probes).
- Checkout quote (`/api/checkout`) must respond in **< 10ms** (deterministic, no external calls).

### Performance Rules
1. **No blocking I/O on the request path** — all Supabase RPC calls must use connection pooling with max 20 connections.
2. **Edge-first routing** — Vercel serverless functions under `api/*.ts` are the primary backend. No proxy to Render for any user-facing path.
3. **Cache-control** — API responses must set `Cache-Control: no-store` for authenticated/tenant-scoped data. Static assets use Vite content-hashed filenames for long-term caching.
4. **Payload size** — Request bodies are bounded: 4 KiB for checkout, 1 MiB for webhooks. Reject oversized payloads with 413 before parsing.
5. **Cold start mitigation** — Keep serverless function bundles minimal. No heavy SDK imports at module top-level unless lazy-loaded.

### Routing Invariants
- `vercel.json` is V2 config. Never reintroduce legacy `routes`.
- Effective rewrite order: filesystem → `/health` → decommissioned 410 routes → `/api/(.*)` → SPA fallback.
- `/api/health` and `/api/checkout` are local functions. They must never be proxied.
- Decommissioned Render paths (`/v1/*`, `/api/v1/*`, telemetry) return 410 via `api/gone.ts`.

### PayPal Sandbox Enforcement
- `PAYPAL_ENV` defaults to `sandbox`. Non-sandbox requires `FOUNDER_PAYPAL_LIVE_OVERRIDE` with the exact founder confirmation token.
- All frontend code referencing PayPal must read `paypal_env` from the server config endpoint, never hardcode `live`.
- Checkout flow must display the PayPal environment (sandbox/live) to the user.

### Raw-Body Webhook Validation
- Webhook handlers must read the raw request body as bytes/string before any JSON parsing.
- Signature verification (PayPal REST `verify-webhook-signature`) must occur before business logic.
- Reject unverified events with 401; return 503 when verification is not configured.
- Never log the full webhook body, payer email, or signature headers.