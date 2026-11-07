-- ApexSovereign.ai inbound agent support tables/RPCs

CREATE TABLE IF NOT EXISTS public.supplier_pipeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_email TEXT NOT NULL,
    subject TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    attachments_meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.provision_design_partner(
    partner_email TEXT,
    initial_cu NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account_id UUID;
    v_new_balance NUMERIC;
BEGIN
    INSERT INTO public.ledger_accounts (user_id, cu_balance, normal_balance)
    VALUES (partner_email, initial_cu, 'debit')
    ON CONFLICT (user_id)
    DO UPDATE SET cu_balance = ledger_accounts.cu_balance + initial_cu, updated_at = NOW()
    RETURNING id, cu_balance INTO v_account_id, v_new_balance;

    RETURN jsonb_build_object('status', 'provisioned', 'cu_credited', initial_cu, 'new_balance', v_new_balance);
END;
$$;