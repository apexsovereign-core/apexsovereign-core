#!/usr/bin/env python3
"""ApexSovereign.ai sovereign agent reconnaissance + Supabase ledger sync loop."""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEBHOOK = ROOT / "api" / "webhook.js"
MIGRATION = ROOT / "supabase" / "migrations" / "20261103_credit_user_account.sql"


def log(msg):
    ts = datetime.now(timezone.utc).isoformat()
    print(f"[{ts}] {msg}", flush=True)


def load_env():
    for name in (".env.local", ".env.production"):
        p = ROOT / name
        if not p.exists():
            continue
        for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ and val and val not in ("[SENSITIVE]",):
                os.environ[key] = val


def main():
    load_env()
    log("SOVEREIGN AGENT BOOT")
    log(f"workspace={ROOT}")
    if not WEBHOOK.exists():
        log("ERROR: api/webhook.js missing")
        return 1
    log("reconnaissance: api/webhook.js present")
    if MIGRATION.exists():
        log("reconnaissance: credit_user_account migration present")
    else:
        log("WARN: credit_user_account migration missing")

    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key or "[SENSITIVE]" in (supabase_url + service_key):
        log("ledger sync: skipped (Supabase secrets not resolved in local env)")
    else:
        log(f"ledger sync: target={supabase_url}")
        # Lightweight health probe; no mutation.
        try:
            import urllib.request
            req = urllib.request.Request(
                f"{supabase_url.rstrip('/')}/rest/v1/",
                headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                log(f"ledger sync: supabase reachable (HTTP {resp.status})")
        except Exception as exc:  # noqa: BLE001
            log(f"ledger sync: probe failed ({exc})")

    log("SOVEREIGN AGENT COMPLETE")
    return 0


if __name__ == "__main__":
    sys.exit(main())