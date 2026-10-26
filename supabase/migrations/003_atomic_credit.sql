-- =============================================================================
-- APEXSOVEREIGN.AI - MIGRATION 003: ATOMIC WEBHOOK CREDIT & TELEMETRY
-- Builds on the existing apex schema from 001_apex_core.sql.
-- Idempotent: safe to re-run. No existing rows are deleted or rewritten.
-- Currency invariant: $1.00 USD = 100 CU (integer CU only).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. COMPUTE NODES & TELEMETRY (read-only to authenticated, writes service-side)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS apex.compute_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model TEXT NOT NULL,
    region TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'allocated', 'maintenance', 'offline')),
    rate_cu_hr INTEGER NOT NULL CHECK (rate_cu_hr > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apex.telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES apex.compute_nodes(id) ON DELETE CASCADE,
    rtt_ms NUMERIC(10, 3) NOT NULL CHECK (rtt_ms >= 0),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_logs_node_recorded
    ON apex.telemetry_logs (node_id, recorded_at DESC);

ALTER TABLE apex.compute_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE apex.compute_nodes FORCE ROW LEVEL SECURITY;
ALTER TABLE apex.telemetry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE apex.telemetry_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compute_nodes_authenticated_read ON apex.compute_nodes;
CREATE POLICY compute_nodes_authenticated_read
    ON apex.compute_nodes
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS telemetry_logs_authenticated_read ON apex.telemetry_logs;
CREATE POLICY telemetry_logs_authenticated_read
    ON apex.telemetry_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- 001 revoked schema usage from authenticated. Grant only what the read-only
-- telemetry surface needs; table RLS policies still gate every other table.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT USAGE ON SCHEMA apex TO authenticated;
        GRANT SELECT ON apex.compute_nodes, apex.telemetry_logs TO authenticated;
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. SIGNED TIMESTAMP + IDEMPOTENCY INDEX
-- New transactions persist the exact timestamp covered by the HMAC. Legacy
-- rows remain NULL rather than being backfilled with an unverified timestamp.
-- -----------------------------------------------------------------------------
ALTER TABLE apex.transactions
    ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey)
        WHERE n.nspname = 'apex'
          AND c.relname = 'transactions'
          AND a.attname = 'idempotency_key'
          AND i.indisunique
    ) THEN
        EXECUTE 'CREATE UNIQUE INDEX idx_transactions_idempotency_key
                 ON apex.transactions (idempotency_key)
                 WHERE idempotency_key IS NOT NULL';
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. ATOMIC PAYPAL CREDIT RPC
-- The four required arguments remain callable. The optional audit arguments
-- let the backend sign the canonical ledger lines and supply the exact
-- transaction id/timestamp that were signed, so verification is possible.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apex.increment_user_credits(
    user_uuid UUID,
    amount_usd NUMERIC,
    cu_amount INTEGER,
    txn_hash TEXT,
    p_tx_id UUID DEFAULT NULL,
    p_hmac TEXT DEFAULT NULL,
    p_hmac_kid TEXT DEFAULT NULL,
    p_signed_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = apex, pg_temp
AS $$
DECLARE
    v_wallet_id UUID;
    v_wallet_code TEXT;
    v_clearing_id UUID;
    v_tx_id UUID;
    v_inserted INTEGER;
    v_signed_at TIMESTAMPTZ;
    v_expected_cu BIGINT;
    v_idempotency_key TEXT;
BEGIN
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'USER_REQUIRED: user_uuid must not be null';
    END IF;
    IF txn_hash IS NULL OR btrim(txn_hash) = '' THEN
        RAISE EXCEPTION 'TXN_HASH_REQUIRED: txn_hash must not be empty';
    END IF;
    IF amount_usd IS NULL OR amount_usd <= 0 THEN
        RAISE EXCEPTION 'AMOUNT_INVALID: amount_usd must be greater than zero';
    END IF;
    IF amount_usd <> round(amount_usd, 2) THEN
        RAISE EXCEPTION 'AMOUNT_PRECISION: amount_usd must have at most two decimal places';
    END IF;
    IF cu_amount IS NULL OR cu_amount <= 0 THEN
        RAISE EXCEPTION 'CU_INVALID: cu_amount must be greater than zero';
    END IF;

    v_expected_cu := round(amount_usd * 100);
    IF cu_amount::BIGINT <> v_expected_cu THEN
        RAISE EXCEPTION 'CU_MISMATCH: cu_amount % does not equal round(amount_usd * 100) %',
            cu_amount, v_expected_cu;
    END IF;

    -- Resolve and lock the tenant wallet. Missing accounts are a hard failure.
    SELECT id, code
      INTO v_wallet_id, v_wallet_code
      FROM apex.accounts
     WHERE owner_id = user_uuid
       AND kind = 'user_wallet'
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'WALLET_NOT_FOUND: no user_wallet account for user %', user_uuid;
    END IF;

    SELECT id
      INTO v_clearing_id
      FROM apex.accounts
     WHERE code = 'paypal_clearing';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CLEARING_NOT_FOUND: paypal_clearing account is missing';
    END IF;

    v_signed_at := COALESCE(p_signed_at, clock_timestamp());
    v_tx_id := COALESCE(p_tx_id, gen_random_uuid());
    v_idempotency_key := 'paypal:capture:' || txn_hash;

    INSERT INTO apex.transactions (
        id, type, reference, idempotency_key, hmac, hmac_kid, created_at, signed_at
    )
    VALUES (
        v_tx_id,
        'TOPUP',
        'paypal:capture:' || txn_hash,
        v_idempotency_key,
        COALESCE(p_hmac, 'unverifiable:' || txn_hash),
        COALESCE(p_hmac_kid, 'external'),
        v_signed_at,
        v_signed_at
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
        RETURN 'DUPLICATE';
    END IF;

    -- Balanced double entry: debit clearing, credit tenant wallet.
    INSERT INTO apex.ledger_entries (
        transaction_id, account_id, direction, amount_cu, created_at
    )
    VALUES
        (v_tx_id, v_clearing_id, 'debit', cu_amount, v_signed_at),
        (v_tx_id, v_wallet_id, 'credit', cu_amount, v_signed_at);

    RETURN 'CREDITED';
END;
$$;

-- Replace the 7-argument posting RPC so every new transaction persists the
-- exact HMAC-covered timestamp. The function body matches 001 plus signed_at.
DROP FUNCTION IF EXISTS apex.post_transaction(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION apex.post_transaction(
    p_id UUID,
    p_type TEXT,
    p_reference TEXT,
    p_idempotency_key TEXT,
    p_hmac TEXT,
    p_hmac_kid TEXT,
    p_lines JSONB,
    p_signed_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = apex, pg_temp
AS $$
DECLARE
    v_tx_id UUID;
    v_line RECORD;
    v_total_debit BIGINT := 0;
    v_total_credit BIGINT := 0;
    v_account_id UUID;
    v_direction TEXT;
    v_amount_cu BIGINT;
    v_current_bal BIGINT;
    v_account_kind TEXT;
    v_signed_at TIMESTAMPTZ;
BEGIN
    v_signed_at := COALESCE(p_signed_at, clock_timestamp());

    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_tx_id
          FROM apex.transactions
         WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN v_tx_id;
        END IF;
    END IF;

    FOR v_line IN
        SELECT * FROM jsonb_to_recordset(p_lines)
            AS (account_id UUID, direction TEXT, amount_cu BIGINT)
    LOOP
        IF v_line.amount_cu <= 0 THEN
            RAISE EXCEPTION 'Invalid line amount %: must be strictly positive', v_line.amount_cu;
        END IF;
        IF v_line.direction = 'debit' THEN
            v_total_debit := v_total_debit + v_line.amount_cu;
        ELSIF v_line.direction = 'credit' THEN
            v_total_credit := v_total_credit + v_line.amount_cu;
        ELSE
            RAISE EXCEPTION 'Invalid direction %: must be debit or credit', v_line.direction;
        END IF;
    END LOOP;

    IF v_total_debit <> v_total_credit THEN
        RAISE EXCEPTION 'Mathematical Imbalance: Debits (%) do not equal Credits (%)',
            v_total_debit, v_total_credit;
    END IF;

    FOR v_line IN
        SELECT * FROM jsonb_to_recordset(p_lines)
            AS (account_id UUID, direction TEXT, amount_cu BIGINT)
    LOOP
        SELECT kind INTO v_account_kind
          FROM apex.accounts
         WHERE id = v_line.account_id
         FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Account % not found', v_line.account_id;
        END IF;

        IF v_account_kind = 'user_wallet' AND v_line.direction = 'debit' THEN
            v_current_bal := apex.account_balance(v_line.account_id);
            IF v_current_bal < v_line.amount_cu THEN
                RAISE EXCEPTION 'Insufficient Funds: Wallet balance % CU is less than required % CU',
                    v_current_bal, v_line.amount_cu;
            END IF;
        END IF;
    END LOOP;

    v_tx_id := COALESCE(p_id, gen_random_uuid());
    INSERT INTO apex.transactions (
        id, type, reference, idempotency_key, hmac, hmac_kid, created_at, signed_at
    )
    VALUES (
        v_tx_id, p_type, p_reference, p_idempotency_key,
        p_hmac, p_hmac_kid, v_signed_at, v_signed_at
    );

    FOR v_line IN
        SELECT * FROM jsonb_to_recordset(p_lines)
            AS (account_id UUID, direction TEXT, amount_cu BIGINT)
    LOOP
        INSERT INTO apex.ledger_entries (
            transaction_id, account_id, direction, amount_cu, created_at
        )
        VALUES (v_tx_id, v_line.account_id, v_line.direction, v_line.amount_cu, v_signed_at);
    END LOOP;

    RETURN v_tx_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. FUNCTION PRIVILEGES
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION apex.increment_user_credits(
    UUID, NUMERIC, INTEGER, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON FUNCTION apex.increment_user_credits(
            UUID, NUMERIC, INTEGER, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ) FROM anon';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON FUNCTION apex.increment_user_credits(
            UUID, NUMERIC, INTEGER, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ) FROM authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION apex.increment_user_credits(
            UUID, NUMERIC, INTEGER, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION apex.post_transaction(
    UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ
) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION apex.post_transaction(
            UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO service_role';
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. RLS ON EVERY APEX TABLE
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name
          FROM information_schema.tables
         WHERE table_schema = 'apex'
           AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE apex.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('ALTER TABLE apex.%I FORCE ROW LEVEL SECURITY;', t);
    END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. TENANT ISOLATION FOR LEDGER LINES
-- Clearing/platform accounts have owner_id IS NULL and must never be exposed to
-- authenticated tenants. Only lines belonging to an owned account are visible.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS ledger_entries_tenant_read ON apex.ledger_entries;
CREATE POLICY ledger_entries_tenant_read
    ON apex.ledger_entries
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM apex.accounts a
             WHERE a.id = ledger_entries.account_id
               AND a.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS transactions_tenant_read ON apex.transactions;
CREATE POLICY transactions_tenant_read
    ON apex.transactions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM apex.ledger_entries le
              JOIN apex.accounts a ON a.id = le.account_id
             WHERE le.transaction_id = transactions.id
               AND a.owner_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 7. LEGACY PUBLIC LEDGER EXPOSURE
-- Skip missing tables instead of failing the migration.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
    role_name TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['ledger_entries', 'token_ledger']
    LOOP
        IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
            EXECUTE format(
                'REVOKE SELECT, INSERT, UPDATE, DELETE ON public.%I FROM PUBLIC', tbl
            );
            FOR role_name IN
                SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
            LOOP
                EXECUTE format(
                    'REVOKE SELECT, INSERT, UPDATE, DELETE ON public.%I FROM %I',
                    tbl, role_name
                );
            END LOOP;
        END IF;
    END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- VERIFICATION QUERIES (run manually after applying):
--
-- -- Every apex table must have RLS enabled and forced:
-- SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'apex' AND c.relkind = 'r'
--  ORDER BY c.relname;
--
-- -- The atomic RPC must only be executable by service_role:
-- SELECT p.proname, r.rolname
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   LEFT JOIN pg_roles r ON r.oid = ANY (p.proacl::regrole[])
--  WHERE n.nspname = 'apex' AND p.proname = 'increment_user_credits';
--
-- -- No authenticated-visible clearing lines (expect 0):
-- SET ROLE authenticated;
-- SELECT count(*) FROM apex.ledger_entries le
--   JOIN apex.accounts a ON a.id = le.account_id
--  WHERE a.owner_id IS NULL;
-- RESET ROLE;
--
-- -- Duplicate replay must return DUPLICATE and never create a second row:
-- SELECT apex.increment_user_credits(
--   '<user_uuid>'::uuid, 50.00, 5000, 'CAPTURE-ID',
--   '<tx_uuid>'::uuid, '<hmac>', 'k1', NOW()
-- );
-- SELECT count(*) FROM apex.transactions WHERE idempotency_key = 'paypal:capture:CAPTURE-ID';
-- =============================================================================
