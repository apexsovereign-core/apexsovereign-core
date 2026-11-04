# SYSTEM ARCHITECTURE SPECIFICATION — ApexSovereign.ai

## 1. Built
- Vercel Edge (serverless functions, global edge routing)
- Supabase atomic ledger (credit_user_account RPC, ledger_accounts, ledger_transactions)
- Token-gated webhook endpoint (api/webhook.js)
- Institutional frontend gateway (index.html)

## 2. In Progress
- PayPal Webhook Gateway (capture event processing, idempotency, settlement integration)

## 3. Target
- Sub-18ms GPU Arbitrage Mesh (H100/B200/A100 spot pricing aggregation)
- Compute-backed asset settlement at scale
- Multi-region edge mesh with <18ms p99 latency