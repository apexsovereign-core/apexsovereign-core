# tests/test_futures_escrow_concurrency.py
"""
ApexSovereign.ai - Tier 2: Institutional Futures Escrow Concurrency Suite
Validates ACID row-level locking (SELECT ... FOR UPDATE) and collateral exhaustion
under simultaneous multi-threaded calls to execute_capacity_futures_lock.
"""

import threading
import time
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
TEST_TENANT = "tenant-futures-stress-01"
INITIAL_CREDIT = 100000.00  # $100k facility
COLLATERAL_PER_CALL = 25000.00  # $25k per contract (Exactly 4 allowed before depletion)
THREAD_COUNT = 10


def setup_test_tenant():
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO public.tenants (id, name, available_credit, bonded_escrow, compute_units_balance)
                VALUES (%s, 'Futures Stress Tenant', %s, 0.00, 500000.00)
                ON CONFLICT (id) DO UPDATE 
                SET available_credit = EXCLUDED.available_credit, bonded_escrow = 0.00, execution_lock = false;
            """, (TEST_TENANT, INITIAL_CREDIT))


def attempt_futures_lock(thread_id: int, results: list):
    try:
        with psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT public.execute_capacity_futures_lock(
                        %s, 'H100_SXM5', 8, 30, 240.0000, %s
                    ) AS outcome;
                """, (TEST_TENANT, COLLATERAL_PER_CALL))
                row = cur.fetchone()
                results.append({
                    "thread_id": thread_id,
                    "success": True,
                    "contract": row["outcome"] if row else None,
                    "error": None
                })
    except Exception as exc:
        results.append({
            "thread_id": thread_id,
            "success": False,
            "contract": None,
            "error": str(exc)
        })


def verify_concurrency():
    print("================================================================================")
    print("TIER 2: INSTITUTIONAL CAPACITY FUTURES ESCROW CONCURRENCY SUITE")
    print(f"Target: {TEST_TENANT} | Initial Credit: ${INITIAL_CREDIT:,.2f}")
    print(f"Threads Competing: {THREAD_COUNT} | Collateral Needed: ${COLLATERAL_PER_CALL:,.2f} each")
    print("================================================================================")

    setup_test_tenant()

    results = []
    threads = [
        threading.Thread(target=attempt_futures_lock, args=(i, results))
        for i in range(THREAD_COUNT)
    ]

    for t in threads:
        t.start()
    for t in threads:
        t.join()

    successes = [r for r in results if r["success"]]
    rejections = [r for r in results if not r["success"]]

    print(f"Successful Escrow Commitments : {len(successes)}")
    print(f"Rejected Escrow Calls        : {len(rejections)}")

    # Verification: Exactly 4 calls must succeed ($25k * 4 = $100k). Remaining 6 must be rejected.
    assert len(successes) == 4, f"Integrity Failure: Expected exactly 4 successful locks, got {len(successes)}"
    assert len(rejections) == 6, f"Integrity Failure: Expected exactly 6 rejected locks, got {len(rejections)}"

    with psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT available_credit, bonded_escrow FROM public.tenants WHERE id = %s;", (TEST_TENANT,))
            tenant = cur.fetchone()
            print(f"Final Available Credit : ${float(tenant['available_credit']):,.2f}")
            print(f"Final Bonded Escrow    : ${float(tenant['bonded_escrow']):,.2f}")

            assert float(tenant["available_credit"]) == 0.00, "Balance leakage detected in available_credit!"
            assert float(tenant["bonded_escrow"]) == 100000.00, "Escrow balance does not match total allocated collateral!"

    print("[PASS] Row-level lock contention verified. Conservation law respected.")


if __name__ == "__main__":
    verify_concurrency()
