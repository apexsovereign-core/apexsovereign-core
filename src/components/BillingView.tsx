import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  History,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Terminal,
  XCircle,
} from 'lucide-react';
import { PRICING, formatCu, formatUsd } from '../config/pricing';
import {
  ApiError,
  apiRequest,
  createIdempotencyKey,
  getStoredAccessToken,
  storeAccessToken,
} from '../lib/api';

interface BillingBalance {
  available_cu: number;
  available_usd: number;
  reserved_cu: number;
  reserved_usd: number;
  total_cu: number;
  active_clusters: number;
  source: string;
}

interface LedgerRow {
  entry_id: string;
  tx_id: string;
  type: string;
  reference: string;
  account_code: string;
  account_kind: string;
  direction: 'debit' | 'credit';
  amount_cu: number;
  amount_usd: number;
  created_at: string;
  signed_at?: string | null;
  hmac_verified: boolean;
  hmac_algo?: string;
  hmac_kid?: string;
  hmac_sig_prefix?: string;
  reason?: string;
}

interface PublicConfig {
  paypal_env: 'sandbox' | 'live';
  payments_enabled: boolean;
  demo_mode: boolean;
}

interface SecurityStatus {
  row_level_security?: string;
  audit_immutability?: string;
  active_signing_kid?: string;
  source?: string;
}

interface CreateOrderResponse {
  order_id: string;
  pack: string;
  cu_amount: number;
  amount_usd: string;
  status: string;
}

interface CaptureResponse {
  status: string;
  order_id: string;
  capture_id?: string | null;
  already_captured?: boolean;
}

interface Receipt {
  receipt_id: string;
  date: string;
  amount_usd: string;
  amount_cu: string;
  pack_name: string;
  payment_method: string;
  capture_id?: string | null;
  hmac_signature_prefix: string;
  hmac_verified: boolean;
  status: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const correlation = error.correlationId
      ? ` (correlation ${error.correlationId})`
      : '';
    return `${error.message} [${error.code}]${correlation}`;
  }
  return error instanceof Error ? error.message : 'Unexpected error.';
}

function formatTimestamp(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function paypalCheckoutUrl(env: 'sandbox' | 'live', orderId: string): string {
  const host =
    env === 'live'
      ? 'https://www.paypal.com'
      : 'https://www.sandbox.paypal.com';
  return `${host}/checkoutnow?token=${encodeURIComponent(orderId)}`;
}

export const BillingView: React.FC = () => {
  const [token, setToken] = useState<string>(() => getStoredAccessToken());
  const [tokenDraft, setTokenDraft] = useState<string>('');
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState<BillingBalance | null>(null);
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedPackId, setSelectedPackId] =
    useState<(typeof PRICING.packs)[number]['id']>('developer');
  const [phase, setPhase] = useState<
    'idle' | 'creating' | 'awaiting_approval' | 'capturing'
  >('idle');
  const [pendingOrder, setPendingOrder] =
    useState<CreateOrderResponse | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const selectedPack = useMemo(
    () =>
      PRICING.packs.find((pack) => pack.id === selectedPackId) ||
      PRICING.packs[0],
    [selectedPackId],
  );

  const refresh = useCallback(async () => {
    if (!token) {
      setBalance(null);
      setSecurity(null);
      setLedger([]);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [balanceResult, ledgerResult, securityResult] = await Promise.all([
        apiRequest<BillingBalance>('/v1/billing/balance', { token }),
        apiRequest<LedgerRow[]>('/v1/billing/ledger', { token }),
        apiRequest<SecurityStatus>('/v1/billing/security', { token }).catch(
          () => null,
        ),
      ]);
      setBalance(balanceResult);
      setLedger(ledgerResult);
      setSecurity(securityResult);
    } catch (error) {
      setBalance(null);
      setSecurity(null);
      setLedger([]);
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    apiRequest<PublicConfig>('/v1/config/public')
      .then((result) => {
        if (!cancelled) {
          setConfig(result);
          setConfigError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setConfig(null);
          setConfigError(errorMessage(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveToken = () => {
    const next = tokenDraft.trim();
    storeAccessToken(next);
    setToken(next);
    setTokenDraft('');
    setNotice(
      next
        ? 'Access token stored for this browser session. Loading measured billing state.'
        : 'Access token cleared.',
    );
  };

  const handleCreateOrder = async () => {
    if (!token) {
      setNotice('Add an access token before creating a PayPal order.');
      return;
    }
    if (!config?.payments_enabled) {
      setNotice('Payments are disabled by the backend configuration.');
      return;
    }

    setPhase('creating');
    setNotice(null);
    try {
      const order = await apiRequest<CreateOrderResponse>(
        '/v1/billing/paypal/create-order',
        {
          method: 'POST',
          token,
          body: { pack: selectedPack.id },
          idempotencyKey: createIdempotencyKey(),
        },
      );
      setPendingOrder(order);
      setPhase('awaiting_approval');
      const checkoutUrl = paypalCheckoutUrl(config.paypal_env, order.order_id);
      const popup = window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      setNotice(
        popup
          ? 'PayPal order created. Approve the payment in the new tab, then return here and capture the order.'
          : 'PayPal order created. Pop-up was blocked; use the approval link below.',
      );
    } catch (error) {
      setPhase('idle');
      setNotice(errorMessage(error));
    }
  };

  const handleCapture = async () => {
    if (!token || !pendingOrder) return;

    setPhase('capturing');
    setNotice(null);
    try {
      const captured = await apiRequest<CaptureResponse>(
        '/v1/billing/paypal/capture',
        {
          method: 'POST',
          token,
          body: { order_id: pendingOrder.order_id },
        },
      );
      setNotice(
        captured.already_captured
          ? `Order ${captured.order_id} was already captured.`
          : `PayPal capture ${captured.capture_id || ''} recorded for order ${captured.order_id}. CU is minted only after the signed webhook is verified.`,
      );
      setPendingOrder(null);
      setPhase('idle');
      await refresh();
    } catch (error) {
      setPhase('awaiting_approval');
      setNotice(errorMessage(error));
    }
  };

  const openReceipt = async (entryId: string) => {
    if (!token) return;
    setReceiptError(null);
    try {
      const result = await apiRequest<Receipt>(
        `/v1/billing/receipts/${encodeURIComponent(entryId)}`,
        { token },
      );
      setReceipt(result);
    } catch (error) {
      setReceipt(null);
      setReceiptError(errorMessage(error));
    }
  };

  const paymentsReady = Boolean(config?.payments_enabled);
  const busy = phase === 'creating' || phase === 'capturing';

  return (
    <div className="w-full space-y-8">
      {/* Access token & measured-state banner */}
      <section
        aria-labelledby="billing-access-heading"
        className="p-5 rounded-2xl bg-[#080D16]/90 border border-slate-800"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3
              id="billing-access-heading"
              className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2"
            >
              <KeyRound className="w-4 h-4 text-[#00F0FF]" aria-hidden="true" />
              Account access
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Billing data is loaded from the backend with your Supabase access
              token. The token is kept in sessionStorage for this tab only and is
              never bundled into the application.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-1 rounded border border-slate-700 text-slate-400">
            {token ? 'TOKEN PRESENT' : 'NO TOKEN'}
          </span>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <label htmlFor="apex-access-token" className="sr-only">
            Supabase access token
          </label>
          <input
            id="apex-access-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={tokenDraft}
            onChange={(event) => setTokenDraft(event.target.value)}
            placeholder="Paste a Supabase access token"
            className="flex-1 px-3 py-2 rounded-lg bg-[#030508] border border-slate-700 focus:border-[#00F0FF] focus:outline-none text-xs font-mono text-white"
          />
          <button
            type="button"
            onClick={saveToken}
            className="px-4 py-2 rounded-lg bg-[#00F0FF] text-[#020305] text-xs font-mono font-bold hover:bg-[#38BDF8] transition"
          >
            {token ? 'REPLACE TOKEN' : 'USE TOKEN'}
          </button>
          {token && (
            <button
              type="button"
              onClick={() => {
                storeAccessToken('');
                setToken('');
                setNotice('Access token cleared.');
              }}
              className="px-4 py-2 rounded-lg bg-transparent border border-slate-700 text-xs font-mono text-slate-300 hover:border-slate-500 transition"
            >
              CLEAR
            </button>
          )}
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-[#050811] border border-[#00F0FF]/40 text-slate-200 font-mono text-xs flex items-start gap-2"
        >
          <Activity
            className="w-4 h-4 text-[#00F0FF] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{notice}</span>
        </div>
      )}

      {/* Balance cards */}
      <section
        aria-labelledby="billing-balance-heading"
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        <div className="p-6 rounded-2xl bg-[#080D16]/90 border border-[#00F0FF]/30 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3
              id="billing-balance-heading"
              className="text-[10px] font-mono text-[#00F0FF] uppercase tracking-wider font-bold"
            >
              Measured compute balance
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
              $1.00 USD = 100 CU
            </span>
          </div>

          {!token ? (
            <p className="text-sm text-slate-400">
              Add an access token above to load your measured balance.
            </p>
          ) : loading ? (
            <p className="text-sm text-slate-400" aria-live="polite">
              Loading measured balance…
            </p>
          ) : loadError ? (
            <div className="text-sm text-rose-300 flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{loadError}</span>
            </div>
          ) : balance ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">
                  {balance.available_cu.toLocaleString()}{' '}
                  <span className="text-[#00F0FF]">CU</span>
                </div>
                <div className="text-sm font-mono text-slate-400">
                  {formatUsd(balance.available_usd)} available
                </div>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-[#030508] border border-slate-800">
                  <dt className="text-slate-500">RESERVED (ESCROW)</dt>
                  <dd className="text-white font-bold mt-1">
                    {formatCu(balance.reserved_cu)}
                  </dd>
                </div>
                <div className="p-3 rounded-lg bg-[#030508] border border-slate-800">
                  <dt className="text-slate-500">TOTAL</dt>
                  <dd className="text-white font-bold mt-1">
                    {formatCu(balance.total_cu)}
                  </dd>
                </div>
                <div className="p-3 rounded-lg bg-[#030508] border border-slate-800">
                  <dt className="text-slate-500">RUNNING CLUSTERS</dt>
                  <dd className="text-white font-bold mt-1">
                    {balance.active_clusters}
                  </dd>
                </div>
              </dl>
              <p className="text-[10px] text-slate-500 font-mono">
                Source: {balance.source}. No client-side balance is displayed.
              </p>
            </div>
          ) : null}
        </div>

        <div className="p-6 rounded-2xl bg-[#080D16]/90 border border-slate-800 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <ShieldCheck
                className="w-3.5 h-3.5 text-[#00F0FF]"
                aria-hidden="true"
              />
              Ledger controls
            </h3>
            {security ? (
              <dl className="mt-3 space-y-2 text-[11px] font-mono">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">ROW-LEVEL SECURITY</dt>
                  <dd className="text-slate-200 text-right">
                    {security.row_level_security || 'NOT_REPORTED'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">IMMUTABILITY</dt>
                  <dd className="text-slate-200 text-right">
                    {security.audit_immutability || 'NOT_REPORTED'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">SIGNING KEY</dt>
                  <dd className="text-slate-200 text-right">
                    {security.active_signing_kid || 'NOT_REPORTED'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-slate-500 mt-3">
                Security status is shown only when the database measurement is
                available.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={!token || loading}
            className="w-full py-2 px-3 rounded-lg bg-[#050811] border border-slate-700 hover:border-[#00F0FF] text-xs font-mono text-slate-300 hover:text-[#00F0FF] disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            REFRESH MEASURED STATE
          </button>
        </div>
      </section>

      {/* PayPal top-up */}
      <section
        aria-labelledby="paypal-topup-heading"
        className="p-6 md:p-8 rounded-2xl bg-[#080D16]/90 border border-[#00F0FF]/25 space-y-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#00F0FF]">
              PayPal Orders v2 &amp; verified webhook settlement
            </span>
            <h3
              id="paypal-topup-heading"
              className="text-xl font-bold text-white tracking-tight mt-0.5"
            >
              Buy compute units
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-1 max-w-3xl">
              The capture route never credits CU. CU is minted only when PayPal
              delivers a verified <code>PAYMENT.CAPTURE.COMPLETED</code> webhook,
              which atomically calls <code>apex.increment_user_credits</code>.
            </p>
          </div>
          <div className="text-[10px] font-mono text-right space-y-1">
            <div className="text-slate-500">
              ENVIRONMENT:{' '}
              <span className="text-slate-200">
                {config?.paypal_env?.toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
            <div
              className={
                paymentsReady ? 'text-emerald-400' : 'text-amber-400'
              }
            >
              PAYMENTS: {paymentsReady ? 'ENABLED' : 'DISABLED / UNKNOWN'}
            </div>
            {configError && (
              <div className="text-rose-300 max-w-xs">{configError}</div>
            )}
          </div>
        </div>

        <div
          role="group"
          aria-label="Compute credit packs"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {PRICING.packs.map((pack) => {
            const isSelected = selectedPackId === pack.id;
            return (
              <button
                key={pack.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedPackId(pack.id)}
                className={`text-left p-5 rounded-xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] ${
                  isSelected
                    ? 'bg-[#050811] border-[#00F0FF] shadow-[0_0_24px_rgba(0,240,255,0.25)]'
                    : 'bg-[#030508] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-bold font-mono text-white">
                    {formatUsd(pack.amountUsd)}
                  </span>
                  <CreditCard
                    className={`w-4 h-4 ${
                      isSelected ? 'text-[#00F0FF]' : 'text-slate-500'
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <div className="text-sm font-mono text-[#00F0FF] font-bold mt-2">
                  {formatCu(pack.cu)}
                </div>
                <div className="text-xs text-slate-300 mt-1">{pack.name}</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {pack.note}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="text-xs font-mono text-slate-400">
            Selected: <span className="text-white font-bold">{selectedPack.name}</span>{' '}
            · {formatUsd(selectedPack.amountUsd)} ·{' '}
            <span className="text-[#00F0FF] font-bold">
              {formatCu(selectedPack.cu)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void handleCreateOrder()}
            disabled={!token || !paymentsReady || busy}
            className="py-3 px-6 rounded-xl bg-[#00F0FF] hover:bg-[#38BDF8] disabled:opacity-50 disabled:cursor-not-allowed text-[#020305] font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.4)] transition"
          >
            <CreditCard className="w-4 h-4" aria-hidden="true" />
            {phase === 'creating'
              ? 'CREATING PAYPAL ORDER…'
              : `CREATE PAYPAL ORDER · ${formatUsd(selectedPack.amountUsd)}`}
          </button>
        </div>

        {pendingOrder && (
          <div
            aria-live="polite"
            className="p-4 rounded-xl bg-[#030508] border border-[#00F0FF]/30 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="text-slate-400">
                ORDER:{' '}
                <span className="text-white">{pendingOrder.order_id}</span>
              </span>
              <span className="text-slate-400">
                STATUS:{' '}
                <span className="text-[#00F0FF]">{pendingOrder.status}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {config && (
                <a
                  href={paypalCheckoutUrl(
                    config.paypal_env,
                    pendingOrder.order_id,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-[#00F0FF] hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  OPEN PAYPAL APPROVAL
                </a>
              )}
              <button
                type="button"
                onClick={() => void handleCapture()}
                disabled={phase === 'capturing'}
                className="px-3 py-1.5 rounded-lg bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] text-xs font-mono font-bold hover:bg-[#10B981]/30 disabled:opacity-50 transition"
              >
                {phase === 'capturing'
                  ? 'CAPTURING…'
                  : 'CAPTURE AFTER APPROVAL'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingOrder(null);
                  setPhase('idle');
                }}
                className="text-xs font-mono text-slate-500 hover:text-slate-300"
              >
                DISCARD
              </button>
            </div>
            <p className="text-[10px] font-mono text-slate-500">
              After capture, CU appears only when PayPal&apos;s signed webhook is
              verified. Use refresh if the webhook has not arrived yet.
            </p>
          </div>
        )}
      </section>

      {/* Ledger */}
      <section
        aria-labelledby="ledger-heading"
        className="p-6 rounded-2xl bg-[#080D16]/90 border border-slate-800 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History
              className="w-4 h-4 text-[#00F0FF]"
              aria-hidden="true"
            />
            <h4
              id="ledger-heading"
              className="text-sm font-bold text-white font-mono uppercase tracking-wider"
            >
              Measured ledger &amp; HMAC verification
            </h4>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            TENANT-SCOPED · CLEARING LINES EXCLUDED
          </span>
        </div>

        {receipt && (
          <div className="p-4 rounded-xl bg-[#030508] border border-[#10B981]/40 text-xs font-mono space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#10B981] font-bold">
                {receipt.receipt_id} · {receipt.status}
              </span>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="text-slate-500 hover:text-white"
                aria-label="Close receipt"
              >
                ✕
              </button>
            </div>
            <div className="text-slate-300">
              {receipt.date} · {receipt.amount_usd} · {receipt.amount_cu}
            </div>
            <div className="text-slate-500">
              {receipt.payment_method} · capture {receipt.capture_id || '—'}
            </div>
            <div className="text-slate-500">
              HMAC {receipt.hmac_verified ? 'VERIFIED' : 'UNVERIFIED'} ·{' '}
              {receipt.hmac_signature_prefix}
            </div>
          </div>
        )}
        {receiptError && (
          <div role="alert" className="text-xs font-mono text-rose-300">
            {receiptError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <caption className="sr-only">
              Ledger entries belonging to the authenticated account
            </caption>
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase">
                <th scope="col" className="py-2.5 px-3">
                  TIMESTAMP
                </th>
                <th scope="col" className="py-2.5 px-3">
                  TYPE
                </th>
                <th scope="col" className="py-2.5 px-3">
                  ACCOUNT
                </th>
                <th scope="col" className="py-2.5 px-3">
                  DIRECTION
                </th>
                <th scope="col" className="py-2.5 px-3 text-right">
                  COMPUTE UNITS
                </th>
                <th scope="col" className="py-2.5 px-3">
                  HMAC
                </th>
                <th scope="col" className="py-2.5 px-3 text-right">
                  RECEIPT
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 px-3 text-center text-slate-500">
                    {token
                      ? 'No ledger entries were returned for this account.'
                      : 'Connect an account to load ledger entries.'}
                  </td>
                </tr>
              ) : (
                ledger.map((entry) => (
                  <tr
                    key={entry.entry_id}
                    className="hover:bg-[#050811]/60 transition"
                  >
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {formatTimestamp(entry.signed_at || entry.created_at)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700 text-slate-300">
                        {entry.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-400">
                      {entry.account_code}
                    </td>
                    <td className="py-3 px-3 text-[11px] uppercase text-slate-400">
                      {entry.direction}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-bold ${
                        entry.direction === 'credit'
                          ? 'text-[#00F0FF]'
                          : 'text-slate-300'
                      }`}
                    >
                      {entry.direction === 'credit' ? '+' : '−'}
                      {entry.amount_cu.toLocaleString()} CU
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                          entry.hmac_verified
                            ? 'text-[#10B981]'
                            : 'text-amber-400'
                        }`}
                        title={entry.reason || entry.hmac_algo || ''}
                      >
                        {entry.hmac_verified ? (
                          <ShieldCheck
                            className="w-3 h-3"
                            aria-hidden="true"
                          />
                        ) : (
                          <XCircle className="w-3 h-3" aria-hidden="true" />
                        )}
                        {entry.hmac_verified ? 'VERIFIED' : 'UNVERIFIED'}
                      </span>
                      <div className="text-[9px] text-slate-600 mt-0.5">
                        {entry.hmac_sig_prefix || '—'} ·{' '}
                        {entry.hmac_kid || 'NO_KID'}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => void openReceipt(entry.entry_id)}
                        className="text-[10px] text-[#00F0FF] hover:underline"
                      >
                        VIEW
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Integration notes */}
      <section className="p-5 rounded-2xl bg-[#030508] border border-slate-800 text-xs font-mono text-slate-400 space-y-2">
        <div className="flex items-center gap-2 text-slate-200 font-bold">
          <Terminal className="w-4 h-4 text-[#00F0FF]" aria-hidden="true" />
          BILLING INTEGRATION CONTRACT
        </div>
        <p>
          <code>POST /v1/billing/paypal/create-order</code> accepts a{' '}
          <code>pack</code> id only. Amounts are resolved on the server from{' '}
          <code>PAYPAL_PACKS</code>.
        </p>
        <p>
          <code>POST /v1/billing/paypal/capture</code> verifies order ownership
          and the captured amount. It never writes to the ledger.
        </p>
        <p>
          <code>POST /v1/webhooks/paypal</code> verifies the PayPal transmission
          signature before calling the atomic credit RPC. Duplicate capture ids
          return <code>DUPLICATE</code> without a second mint.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <span className="inline-flex items-center gap-1 text-[#10B981]">
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            $1.00 = 100 CU
          </span>
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Lock className="w-3 h-3" aria-hidden="true" />
            HMAC-SHA256
          </span>
          <span className="inline-flex items-center gap-1 text-slate-500">
            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
            webhook-only minting
          </span>
        </div>
      </section>
    </div>
  );
};

export default BillingView;
