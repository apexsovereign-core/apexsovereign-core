-- ApexSovereign.ai credit_user_account RPC ($1.00 = 100 CU)
-- Double-entry atomic settlement invoked by api/webhook.js

CREATE OR REPLACE FUNCTION public.credit_user_account(
    p_event_id TEXT,
    p_capture_id TEXT,
    p_user_id TEXT,
    p_tenant_id TEXT,
    p_amount_usd NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account_id UUID;
    v_cu_to_add NUMERIC;
    v_new_balance NUMERIC;
    v_existing_balance NUMERIC;
BEGIN
    -- Idempotency: a repeated webhook event must not double-credit.
    IF EXISTS (SELECT 1 FROM public.ledger_transactions WHERE paypal_webhook_id = p_event_id) THEN
        SELECT la.cu_balance INTO v_existing_balance
        FROM public.ledger_transactions lt
        JOIN public.ledger_accounts la ON la.id = lt.account_id
        WHERE lt.paypal_webhook_id = p_event_id
        LIMIT 1;
        RETURN jsonb_build_object('status', 'already_settled', 'new_balance', v_existing_balance);
    END IF;

    -- $1.00 USD = 100 Compute Units
    v_cu_to_add := p_amount_usd * 100.00;

    -- Upsert account balance (credit side of the ledger).
    INSERT INTO public.ledger_accounts (user_id, cu_balance)
    VALUES (p_user_id, v_cu_to_add)
    ON CONFLICT (user_id)
    DO UPDATE SET
        cu_balance = ledger_accounts.cu_balance + v_cu_to_add,
        updated_at = NOW()
    RETURNING id, cu_balance INTO v_account_id, v_new_balance;

    -- Log the transaction (double-entry: corresponding debit recorded as SETTLED).
    INSERT INTO public.ledger_transactions (account_id, amount_usd, cu_credited, paypal_webhook_id, status)
    VALUES (v_account_id, p_amount_usd, v_cu_to_add, p_event_id, 'SETTLED');

    RETURN jsonb_build_object(
        'status', 'settled',
        'cu_credited', v_cu_to_add,
        'new_balance', v_new_balance
    );
END;
$$;