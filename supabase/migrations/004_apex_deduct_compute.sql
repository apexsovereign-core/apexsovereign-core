-- =============================================================================
-- APEXSOVEREIGN.AI - MIGRATION 004: APEX-SCHEMA COMPUTE UNIT DEDUCTION
-- Adds apex.deduct_compute_units for real-time CU deduction with row-level
-- locking, matching the apex schema security model (SECURITY DEFINER,
-- search_path pinned, revoked from PUBLIC/anon/authenticated).
-- =============================================================================

CREATE OR REPLACE FUNCTION apex.deduct_compute_units(
    p_user_id UUID,
    p_cu_amount NUMERIC(18, 6),
    p_reservation_id UUID DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = apex, pg_temp
AS $$
DECLARE
    v_current_cu NUMERIC(18, 6);
    v_new_cu NUMERIC(18, 6);
    v_is_frozen BOOLEAN;
    v_transaction_id UUID;
BEGIN
    IF p_cu_amount <= 0.000000 THEN
        RAISE EXCEPTION 'INVALID_DEDUCTION: Amount must be strictly positive.';
    END IF;

    -- Acquire write lock on the tenant wallet (apex.ledger_accounts).
    SELECT cu_balance, is_frozen INTO v_current_cu, v_is_frozen
    FROM apex.ledger_accounts
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_cu IS NULL THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: User % has no registered ledger.', p_user_id;
    END IF;

    IF v_is_frozen THEN
        RAISE EXCEPTION 'ACCOUNT_FROZEN: Account % is frozen for compliance verification.', p_user_id;
    END IF;

    IF v_current_cu < p_cu_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_FUNDS: Available balance (% CU) less than requested (% CU).',
            v_current_cu, p_cu_amount;
    END IF;

    v_new_cu := v_current_cu - p_cu_amount;

    UPDATE apex.ledger_accounts
    SET cu_balance = v_new_cu,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    INSERT INTO apex.transactions (
        user_id,
        tx_type,
        amount_cu,
        previous_cu_balance,
        new_cu_balance,
        reference_id,
        metadata
    ) VALUES (
        p_user_id,
        'COMPUTE_DEDUCTION',
        p_cu_amount,
        v_current_cu,
        v_new_cu,
        COALESCE(p_reference_id, p_reservation_id::TEXT),
        jsonb_build_object('reservation_id', p_reservation_id, 'source', 'compute_allocation')
    ) RETURNING transaction_id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'status', 'SUCCESS',
        'transaction_id', v_transaction_id,
        'user_id', p_user_id,
        'cu_deducted', p_cu_amount,
        'balance_cu', v_new_cu
    );
END;
$$;

-- Lock down: revoke from PUBLIC, anon, authenticated; grant only service_role.
REVOKE ALL ON FUNCTION apex.deduct_compute_units(UUID, NUMERIC, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apex.deduct_compute_units(UUID, NUMERIC, UUID, TEXT) TO postgres, service_role;

-- Ensure apex schema usage for service_role.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT USAGE ON SCHEMA apex TO service_role;
    END IF;
END $$;
