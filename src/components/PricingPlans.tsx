import React, { useState } from 'react';
import { SubscriptionTier, CustomerUser } from '../types';
import { 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Cpu, 
  Zap, 
  Layers, 
  Server, 
  HelpCircle,
  Lock,
  ArrowRight
} from 'lucide-react';

interface PricingPlansProps {
  onSelectTier: (tier: SubscriptionTier, interval: 'monthly' | 'annual') => void;
  currentUser: CustomerUser | null;
  onOpenAuth: () => void;
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'starter',
    name: 'Developer Sandbox',
    priceMonthly: 29,
    priceAnnual: 279,
    computeUnits: 2500,
    description: 'Perfect for engineers, quants, and AI agents building and testing isolated workloads.',
    paypalPlanId: 'P-PLAN-DEV-SANDBOX-29',
    features: [
      '2,500 Monthly Compute Units (CU)',
      '1 Isolated Tenant Partition on PostgreSQL',
      'Shared Standard CPU Worker Clusters',
      'REST & WebSocket Broker Access',
      'Community Support & Standard SLA',
      'PayPal v2 Automated Invoicing'
    ]
  },
  {
    id: 'pro',
    name: 'Autonomous Pro',
    priceMonthly: 99,
    priceAnnual: 950,
    computeUnits: 25000,
    popular: true,
    badge: 'MOST POPULAR',
    description: 'Engineered for high-frequency algorithmic agents and production autonomous pipelines.',
    paypalPlanId: 'P-PLAN-AUTONOMOUS-PRO-99',
    features: [
      '25,000 Monthly Compute Units (CU)',
      'A100 Tensor Core GPU Burst Allocation',
      'HMAC-SHA256 Signed Execution Leases',
      'Real-time Autonomous Worker Dispatch',
      'Priority asyncpg Connection Pooler',
      'Unused Compute Unit Rollover (90 Days)',
      '99.9% High Availability SLA'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise Sovereign',
    priceMonthly: 499,
    priceAnnual: 4790,
    computeUnits: 150000,
    badge: 'MAXIMUM COMPUTE',
    description: 'Dedicated GPU clusters, air-gapped sovereign partitions, and bespoke algorithmic brokers.',
    paypalPlanId: 'P-PLAN-SOVEREIGN-ENT-499',
    features: [
      '150,000 Monthly Compute Units (CU)',
      'Dedicated H100 80GB GPU Node Clusters',
      'Custom PostgreSQL Schema & RLS Hardening',
      'Zero-Latency Webhook Certificate Dispatch',
      'Dedicated Solutions Architect Support',
      '99.99% Uptime Financial Guarantee',
      'Custom Wire & PayPal Enterprise Billing'
    ]
  }
];

export const PricingPlans: React.FC<PricingPlansProps> = ({
  onSelectTier,
  currentUser,
  onOpenAuth
}) => {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div className="space-y-12 py-6 animate-in fade-in duration-300">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AUTONOMOUS WORK OS PRICING & SUBSCRIPTIONS</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Sovereign Compute Power, Transparently Billed
        </h1>
        <p className="text-sm sm:text-base text-slate-400">
          Subscribe to dedicated worker leases, GPU bursts, and multi-tenant PostgreSQL partitions. 
          Instant checkout via encrypted PayPal REST v2 with cryptographic ledger guarantees.
        </p>

        {/* Monthly / Annual Toggle */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <span className={`text-xs font-medium ${billingInterval === 'monthly' ? 'text-white' : 'text-slate-400'}`}>
            Monthly Billing
          </span>
          <button
            type="button"
            onClick={() => setBillingInterval(prev => prev === 'monthly' ? 'annual' : 'monthly')}
            className="w-12 h-6 rounded-full bg-slate-800 p-1 relative transition-colors focus:outline-none border border-slate-700 cursor-pointer"
          >
            <div 
              className={`w-4 h-4 rounded-full bg-emerald-400 shadow-md transition-transform ${
                billingInterval === 'annual' ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-xs font-medium flex items-center gap-1.5 ${billingInterval === 'annual' ? 'text-white' : 'text-slate-400'}`}>
            <span>Annual Billing</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-semibold border border-emerald-500/30">
              Save 20%
            </span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {SUBSCRIPTION_TIERS.map((tier) => {
          const isCurrentPlan = currentUser?.plan === tier.id;
          const displayPrice = billingInterval === 'monthly' ? tier.priceMonthly : Math.round(tier.priceAnnual / 12);

          return (
            <div
              key={tier.id}
              className={`relative rounded-2xl p-7 flex flex-col justify-between transition-all duration-200 ${
                tier.popular
                  ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/60 shadow-[0_0_35px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/70 border border-slate-800 hover:border-slate-700 shadow-xl'
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-mono font-bold tracking-wider uppercase shadow-md">
                  {tier.badge}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                  {isCurrentPlan && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      CURRENT PLAN
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 min-h-[36px] mb-6">
                  {tier.description}
                </p>

                {/* Price Display */}
                <div className="mb-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white font-mono">${displayPrice}</span>
                    <span className="text-xs text-slate-400">/ month</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    {billingInterval === 'annual' ? `$${tier.priceAnnual} billed once annually` : 'Billed monthly, cancel anytime'}
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-900 flex items-center justify-between text-xs font-mono text-emerald-400">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Compute Quota:</span>
                    </span>
                    <span className="font-bold">{tier.computeUnits.toLocaleString()} CU/mo</span>
                  </div>
                </div>

                {/* Feature List */}
                <div className="space-y-3 mb-8">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    INCLUDED CAPABILITIES
                  </div>
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div>
                <button
                  type="button"
                  onClick={() => onSelectTier(tier, billingInterval)}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                    tier.popular
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  }`}
                >
                  <span className="font-bold text-blue-400 italic">P</span>
                  <span>{isCurrentPlan ? 'Extend with PayPal' : `Subscribe with PayPal`}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <div className="text-center text-[10px] text-slate-500 mt-2 font-mono">
                  Instant token lease & webhook activation
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enterprise SLA & Security Banner */}
      <div className="max-w-7xl mx-auto p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Cryptographic Idempotency & PayPal Webhook Security</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Every subscription renewal runs through SHA256withRSA certificate verification, prevent replay attacks, and immediately credits your Supabase PostgreSQL ledger with row-level locks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTier(SUBSCRIPTION_TIERS[1], 'monthly')}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            Start with Autonomous Pro
          </button>
        </div>
      </div>

      {/* FAQs */}
      <div className="max-w-4xl mx-auto pt-6 border-t border-slate-800 space-y-6">
        <h3 className="text-xl font-bold text-white text-center">Frequently Asked Questions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/70 space-y-1.5">
            <div className="font-semibold text-slate-200">How do Compute Units (CU) work?</div>
            <p className="text-slate-400 leading-relaxed">
              One Compute Unit covers 1 standard CPU worker minute. GPU bursts (A100/H100) consume units at specialized weighted rates defined in your worker lease.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/70 space-y-1.5">
            <div className="font-semibold text-slate-200">Can I cancel my PayPal subscription anytime?</div>
            <p className="text-slate-400 leading-relaxed">
              Yes, you can cancel directly from your PayPal account or via the Customer Workspace. Your compute credits remain valid until the end of the billing cycle.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/70 space-y-1.5">
            <div className="font-semibold text-slate-200">What happens when I exhaust my monthly credits?</div>
            <p className="text-slate-400 leading-relaxed">
              Your broker gracefully throttles or transitions workloads to your on-demand backup pool without dropping jobs. You can top up units in 1 click anytime.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/70 space-y-1.5">
            <div className="font-semibold text-slate-200">Is my data isolated from other tenants?</div>
            <p className="text-slate-400 leading-relaxed">
              Every customer gets an isolated `tenant_id` enforced with PostgreSQL Row-Level Security (RLS) policies and cryptographically signed HMAC leases.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
