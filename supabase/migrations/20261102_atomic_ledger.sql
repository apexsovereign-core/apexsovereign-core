-- ApexSovereign.ai Atomic CU Ledger Migration
-- Supabase Project Reference: eeclrffbjbnapsajmtqn

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.ledger_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE NOT NULL,
    cu_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    normal_balance TEXT NOT NULL DEFAULT 'debit',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ledger_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES public.ledger_accounts(id),
    amount_usd NUMERIC(10, 2) NOT NULL,
    cu_credited NUMERIC(18, 4) NOT NULL,
    paypal_webhook_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'SETTLED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic RPC for Credit Unit Deposit ($1.00 = 100 CU)
CREATE OR REPLACE FUNCTION public.process_paypal_settlement(
    p_user_id TEXT,
    p_amount_usd NUMERIC,
    p_webhook_id TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account_id UUID;
    v_cu_to_add NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- Calculate CU at 1.00 USD = 100 CU
    v_cu_to_add := p_amount_usd * 100.00;

    -- Upsert account
    INSERT INTO public.ledger_accounts (user_id, cu_balance)
    VALUES (p_user_id, v_cu_to_add)
    ON CONFLICT (user_id)
    DO UPDATE SET 
        cu_balance = ledger_accounts.cu_balance + v_cu_to_add,
        updated_at = NOW()
    RETURNING id, cu_balance INTO v_account_id, v_new_balance;

    -- Log transaction atomically
    INSERT INTO public.ledger_transactions (account_id, amount_usd, cu_credited, paypal_webhook_id, status)
    VALUES (v_account_id, p_amount_usd, v_cu_to_add, p_webhook_id, 'SETTLED');

    RETURN v_new_balance;
END;
$$;