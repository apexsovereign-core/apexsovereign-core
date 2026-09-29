# tests/test_futures_escrow_concurrency.py
"""
ApexSovereign.ai - Tier 2: Institutional Futures Escrow Concurrency Suite
Validates ACID row-level locking (SELECT ... FOR UPDATE) and collateral exhaustion
under simultaneous multi-threaded calls to execute_capacity_futures_lock.
Enforces zero hardcoded database strings or local secrets.
"""

import os
import sys
import threading
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [FUTURES_CONCURRENCY] %(message)s")
logger = logging.getLogger("futures_concurrency")

# Strict Dynamic Environment Retrieval
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
if not SUPABASE_DB_URL:
    logger.critical("FATAL: Environment variable 'SUPABASE_DB_URL' is missing. Terminating harness.")
    sys.exit(1)

TEST_TENANT = os.getenv("TEST_TENANT_ID", "tenant-futures-stress-01")
INITIAL_CREDIT = 100000.00      # $100,000 facility
COLLATERAL_PER_CALL = 25000.00  # Exactly 4 locks allowed before credit depletion
THREAD_COUNT = 10


def setup_test_tenant():
    with psycopg2.connect(SUPABASE_DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO public.tenants (id, name, available_credit, bonded_escrow, compute_units_balance)
                VALUES (%s, 'Futures Stress Tenant', %s, 0.00, 500000.00)
                ON CONFLICT (id) DO UPDATE 
                SET available_credit = EXCLUDED.available_credit, bonded_escrow = 0.00, execution_lock = false;
            """, (TEST_TENANT, INITIAL_CREDIT))


def attempt_futures_lock(thread_id: int, results: list):
    try:
        with psycopg2.connect(SUPABASE_DB_URL, cursor_factory=RealDictCursor) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT public.execute_capacity_futures_lock(
                        %s, 'H100_SXM5', 8, 30, 240.0000, %s
                    ) AS outcome;
                """, (TEST_TENANT, COLLATERAL_PER_CALL))
                row = cur.fetchone()
                results.append({"thread_id": thread_id, "success": True, "contract": row["outcome"] if row else None})
    except Exception as exc:
        results.append({"thread_id": thread_id, "success": False, "error": str(exc)})


def verify_concurrency():
    logger.info("================================================================================")
    logger.info("TIER 2: INSTITUTIONAL CAPACITY FUTURES ESCROW CONCURRENCY SUITE")
    logger.info(f"Target: {TEST_TENANT} | Initial Credit: ${INITIAL_CREDIT:,.2f}")
    logger.info(f"Threads Competing: {THREAD_COUNT} | Collateral Needed: ${COLLATERAL_PER_CALL:,.2f} each")
    logger.info("================================================================================")

    setup_test_tenant()

    results = []
    threads = [threading.Thread(target=attempt_futures_lock, args=(i, results)) for i in range(THREAD_COUNT)]
    for t in threads: t.start()
    for t in threads: t.join()

    successes = [r for r in results if r["success"]]
    rejections = [r for r in results if not r["success"]]

    logger.info(f"Successful Escrow Commitments : {len(successes)}")
    logger.info(f"Rejected Escrow Calls        : {len(rejections)}")

    # Invariant Verification: Exactly 4 calls commit ($25k * 4 = $100k). Remaining 6 must reject.
    if len(successes) != 4:
        logger.error(f"[FAIL] Expected exactly 4 successful locks, got {len(successes)}")
        sys.exit(1)

    if len(rejections) != 6:
        logger.error(f"[FAIL] Expected exactly 6 rejected locks, got {len(rejections)}")
        sys.exit(1)

    with psycopg2.connect(SUPABASE_DB_URL, cursor_factory=RealDictCursor) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT available_credit, bonded_escrow FROM public.tenants WHERE id = %s;", (TEST_TENANT,))
            tenant = cur.fetchone()
            logger.info(f"Final Available Credit : ${float(tenant['available_credit']):,.2f}")
            logger.info(f"Final Bonded Escrow    : ${float(tenant['bonded_escrow']):,.2f}")

            assert float(tenant["available_credit"]) == 0.00, "Leaked credit headroom detected"
            assert float(tenant["bonded_escrow"]) == 100000.00, "Escrow balance does not match total allocated collateral"

    logger.info("[PASS] Row-level lock contention verified. Conservation law respected.")


if __name__ == "__main__":
    verify_concurrency()
