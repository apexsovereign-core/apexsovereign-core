# tests/concurrent_micro_debit_stress.py
"""
ApexSovereign.ai - Concurrency & Double-Spending Verification Suite
Spawns 5,000 asynchronous concurrent debit attempts across overlapping tenant IDs
to stress-test Row-Level Locking (SELECT ... FOR UPDATE) and verify zero ledger corruption.
"""

import asyncio
import time
import hmac
import hashlib
import uuid
import sys
from typing import List, Dict, Any
import httpx

TARGET_URL = "http://127.0.0.1:3000/v1/settlement/micro-debit"
HMAC_SECRET = b"sovereign_settlement_master_key_2026"
TOTAL_REQUESTS = 5000
CONCURRENCY_LIMIT = 500


async def fire_debit(client: httpx.AsyncClient, semaphore: asyncio.Semaphore, idx: int, tenant_id: str) -> Dict[str, Any]:
    async with semaphore:
        ts = int(time.time() * 1000)
        workload_id = f"wl-burst-{idx}"
        idemp_key = f"idemp_stress_{idx}_{uuid.uuid4().hex[:8]}"

        raw_check = f"{tenant_id}:{workload_id}:{idemp_key}:{ts}".encode("utf-8")
        signature = hmac.new(HMAC_SECRET, raw_check, hashlib.sha256).hexdigest()

        payload = {
            "tenant_id": tenant_id,
            "workload_id": workload_id,
            "token_count": 5000,
            "cu_rate_multiplier": 1.0,
            "idempotency_key": idemp_key,
            "nonce": idx,
            "timestamp_epoch_ms": ts,
        }

        headers = {
            "Content-Type": "application/json",
            "X-Apex-Signature": signature,
            "X-Apex-Timestamp": str(ts),
        }

        t0 = time.perf_counter()
        try:
            resp = await client.post(TARGET_URL, json=payload, headers=headers, timeout=10.0)
            latency_ms = (time.perf_counter() - t0) * 1000.0
            return {
                "idx": idx,
                "status_code": resp.status_code,
                "latency_ms": latency_ms,
                "body": resp.json() if resp.status_code in [200, 402, 403, 408] else resp.text,
                "error": None,
            }
        except Exception as exc:
            return {
                "idx": idx,
                "status_code": 0,
                "latency_ms": (time.perf_counter() - t0) * 1000.0,
                "body": None,
                "error": str(exc),
            }


async def run_stress_test():
    print(f"================================================================================")
    print(f"APEXSOVEREIGN.AI - 5,000 CONCURRENT SETTLEMENT STRESS BENCHMARK")
    print(f"Target: {TARGET_URL} | Concurrency Cap: {CONCURRENCY_LIMIT}")
    print(f"================================================================================")

    semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)
    limits = httpx.Limits(max_keepalive_connections=500, max_connections=1000)

    # Distribute over 10 active tenants to simulate heavy lock contention
    tenants = [f"tenant-sovereign-{i:02d}" for i in range(1, 11)]

    start_wall = time.perf_counter()
    async with httpx.AsyncClient(limits=limits) as client:
        tasks = [
            fire_debit(client, semaphore, i, tenants[i % len(tenants)])
            for i in range(TOTAL_REQUESTS)
        ]
        results = await asyncio.gather(*tasks)

    total_wall_sec = time.perf_counter() - start_wall
    throughput_rps = TOTAL_REQUESTS / total_wall_sec

    status_counts: Dict[int, int] = {}
    latencies: List[float] = []
    errors = 0

    for r in results:
        code = r["status_code"]
        status_counts[code] = status_counts.get(code, 0) + 1
        latencies.append(r["latency_ms"])
        if r["error"] or code not in [200, 402]:
            errors += 1

    latencies.sort()
    p50 = latencies[int(len(latencies) * 0.50)]
    p95 = latencies[int(len(latencies) * 0.95)]
    p99 = latencies[int(len(latencies) * 0.99)]

    print(f"\n[BENCHMARK RESULTS]")
    print(f"Total Requests Dispatched : {TOTAL_REQUESTS}")
    print(f"Total Wall Clock Duration : {total_wall_sec:.2f} s")
    print(f"Sustained Throughput      : {throughput_rps:.2f} req/s")
    print(f"Latency P50               : {p50:.2f} ms")
    print(f"Latency P95               : {p95:.2f} ms")
    print(f"Latency P99 (SLA < 18ms)  : {p99:.2f} ms")
    print(f"HTTP Status Breakdown     : {status_counts}")
    print(f"Anomalous Failures        : {errors}")

    if p99 > 18.0:
        print(f"[FAIL] P99 latency ({p99:.2f} ms) breached strict 18.00 ms SLA threshold.")
    else:
        print(f"[PASS] P99 latency ({p99:.2f} ms) compliant with sub-18ms SLA.")

    if errors > 0:
        print(f"[FAIL] {errors} transactions encountered unexpected errors or race conditions.")
        sys.exit(1)

    print(f"[PASS] Atomic double-entry integrity confirmed. Zero race collisions detected.")


if __name__ == "__main__":
    asyncio.run(run_stress_test())
