-- =============================================================================
-- APEXSOVEREIGN.AI - MIGRATION 004: APEX-SCHEMA COMPUTE UNIT DEDUCTION
-- Adds apex.deduct_compute_units for real-time CU deduction with row-level
-- locking, matching the apex schema security model (SECURITY DEFINER,
-- search_path pinned, revoked from PUBLIC/anon/authenticated).
-- Balance is derived from apex.ledger_entries (credits - debits).
-- =============================================================================

CREATE OR REPLACE FUNCTION apex.deduct_compute_units(
    p_user_id UUID,
    p_cu_amount BIGINT,
    p_reservation_id UUID DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = apex, pg_temp
AS $$
DECLARE
    v_wallet_id UUID;
    v_revenue_id UUID;
    v_current_bal BIGINT;
    v_tx_id UUID;
    v_ref TEXT;
BEGIN
    IF p_cu_amount IS NULL OR p_cu_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_DEDUCTION: Amount must be strictly positive.';
    END IF;

    -- Find and lock the user's wallet account.
    SELECT id INTO v_wallet_id
      FROM apex.accounts
     WHERE owner_id = p_user_id AND kind = 'user_wallet'
     FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: User % has no registered wallet.', p_user_id;
    END IF;

    -- Find the platform revenue account (system account).
    SELECT id INTO v_revenue_id
      FROM apex.accounts
     WHERE kind = 'platform_revenue'
     LIMIT 1;

    IF v_revenue_id IS NULL THEN
        RAISE EXCEPTION 'SYSTEM_ACCOUNT_MISSING: platform_revenue account not found.';
    END IF;

    -- Check balance (credits - debits).
    v_current_bal := apex.account_balance(v_wallet_id);
    IF v_current_bal < p_cu_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_FUNDS: Available balance (% CU) less than requested (% CU).',
            v_current_bal, p_cu_amount;
    END IF;

    v_tx_id := gen_random_uuid();
    v_ref := COALESCE(p_reference_id, p_reservation_id::TEXT, 'compute_deduction');

    -- Create the transaction.
    INSERT INTO apex.transactions (id, type, reference, created_at)
    VALUES (v_tx_id, 'COMPUTE_DEDUCTION', v_ref, NOW());

    -- Debit user wallet, credit platform revenue.
    INSERT INTO apex.ledger_entries (transaction_id, account_id, direction, amount_cu)
    VALUES (v_tx_id, v_wallet_id, 'debit', p_cu_amount);

    INSERT INTO apex.ledger_entries (transaction_id, account_id, direction, amount_cu)
    VALUES (v_tx_id, v_revenue_id, 'credit', p_cu_amount);

    RETURN jsonb_build_object(
        'status', 'SUCCESS',
        'transaction_id', v_tx_id,
        'user_id', p_user_id,
        'cu_deducted', p_cu_amount,
        'balance_cu', v_current_bal - p_cu_amount
    );
END;
$$;

-- Lock down: revoke from PUBLIC, anon, authenticated; grant only service_role.
REVOKE ALL ON FUNCTION apex.deduct_compute_units(UUID, BIGINT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apex.deduct_compute_units(UUID, BIGINT, UUID, TEXT) TO postgres, service_role;

-- Ensure apex schema usage for service_role.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT USAGE ON SCHEMA apex TO service_role;
    END IF;
END $$;
