import React, { useState } from 'react';
import { 
  Cpu, 
  Zap, 
  ShieldCheck, 
  Bot, 
  ArrowRight, 
  Sparkles, 
  BarChart3, 
  Database, 
  CheckCircle2, 
  CreditCard, 
  Building2, 
  Workflow,
  MessageSquare
} from 'lucide-react';
import { SUBSCRIPTION_TIERS } from './PricingPlans';
import { SubscriptionTier } from '../types';

interface SolutionsViewProps {
  onSelectPlan: (tier: SubscriptionTier) => void;
  onOpenConcierge: () => void;
  onNavigatePricing: () => void;
}

export const SolutionsView: React.FC<SolutionsViewProps> = ({
  onSelectPlan,
  onOpenConcierge,
  onNavigatePricing
}) => {
  const [teamSize, setTeamSize] = useState<number>(25);
  const [manualHoursPerWeek, setManualHoursPerWeek] = useState<number>(40);

  // Financial ROI calculations
  const avgHourlyCost = 65; // USD/hour blended rate
  const annualManualCost = teamSize * manualHoursPerWeek * 52 * avgHourlyCost;
  const autonomousEfficiency = 0.82; // 82% automation rate
  const annualSavings = Math.round(annualManualCost * autonomousEfficiency);
  const monthlySavings = Math.round(annualSavings / 12);

  const recommendedTier = 
    teamSize > 50 ? SUBSCRIPTION_TIERS[2] : (teamSize > 10 ? SUBSCRIPTION_TIERS[1] : SUBSCRIPTION_TIERS[0]);

  return (
    <div className="space-y-16 py-6 animate-in fade-in duration-300">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto space-y-5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>INSTITUTIONAL B2B SAAS & AI AUTOMATION AGENCY (AAA)</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Autonomous Enterprise Execution.<br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
            Zero Human Bottlenecks.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          ApexSovereign.ai combines bare-metal GPU clusters, multi-tenant PostgreSQL data isolation, and event-driven AI agents to automate global enterprise operations on pure autopilot.
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onNavigatePricing}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-[0_0_25px_rgba(16,185,129,0.3)] flex items-center gap-2 cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span>View Pricing & PayPal Plans</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenConcierge}
            className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-xs border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>Consult 24/7 AI Concierge</span>
          </button>
        </div>
      </div>

      {/* 3 Core Value Proposition Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
        <div className="p-7 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 hover:border-emerald-500/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Workflow className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Autonomous Agency Work OS</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Eliminate operational drag with autonomous customer onboarding, real-time qualification scoring, CRM data synchronization, and automated transactional receipts via Resend.
          </p>
          <ul className="space-y-2 pt-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>100% Autopilot customer lifecycle</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Real-time webhook events & callbacks</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Instant lead scoring & routing</span>
            </li>
          </ul>
        </div>

        <div className="p-7 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 hover:border-indigo-500/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Sovereign GPU Compute Mesh</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Run intensive AI inference and algorithmic pipelines on dedicated A100 & H100 GPU nodes with cryptographically signed HMAC execution leases.
          </p>
          <ul className="space-y-2 pt-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Isolated compute quotas per tenant</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Sub-millisecond worker dispatch</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Rollover credits with zero expiration waste</span>
            </li>
          </ul>
        </div>

        <div className="p-7 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 hover:border-blue-500/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Institutional Data Isolation</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Multi-tenant PostgreSQL architecture backed by active Supabase Row-Level Security (RLS), ensuring absolute privacy and zero unauthorized cross-tenant data leakage.
          </p>
          <ul className="space-y-2 pt-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>PostgreSQL RLS on all tables</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>SHA256withRSA PayPal signature audits</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Double-entry idempotency guarantees</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Interactive Autonomous ROI Calculator */}
      <div className="max-w-4xl mx-auto p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-semibold">
              <BarChart3 className="w-4 h-4" />
              <span>ENTERPRISE AUTONOMOUS ROI MODEL</span>
            </div>
            <h3 className="text-2xl font-bold text-white mt-1">Estimate Your Operational Velocity Gain</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">DYNAMIC PROJECTION</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Enterprise Team Size:</span>
                <span className="font-mono text-emerald-400 font-bold">{teamSize} Specialists</span>
              </div>
              <input
                type="range"
                min="5"
                max="250"
                step="5"
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>5 (Seed Startup)</span>
                <span>250+ (Global Enterprise)</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Weekly Repetitive Operational Hours / Person:</span>
                <span className="font-mono text-indigo-400 font-bold">{manualHoursPerWeek} hrs/week</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={manualHoursPerWeek}
                onChange={(e) => setManualHoursPerWeek(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>10 hrs</span>
                <span>60 hrs</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-400 space-y-1">
              <div className="text-slate-200 font-semibold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Recommended Deployment Architecture:</span>
              </div>
              <div className="text-emerald-300 font-mono font-bold text-sm pt-1">
                {recommendedTier.name} ({recommendedTier.computeUnits.toLocaleString()} CU/mo)
              </div>
              <p className="text-[11px] text-slate-500 pt-0.5">
                Includes automated PayPal subscription, tenant isolation, and priority worker dispatch.
              </p>
            </div>
          </div>

          {/* Metric Projections */}
          <div className="p-6 rounded-xl bg-slate-950/90 border border-slate-800/90 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                PROJECTED VELOCITY & CAPITAL SAVINGS
              </span>

              <div className="space-y-1">
                <div className="text-xs text-slate-400">Projected Annual Capital Saved</div>
                <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono">
                  ${annualSavings.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  ~${monthlySavings.toLocaleString()} recovered / month
                </div>
              </div>

              <div className="pt-3 border-t border-slate-900 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-500">Operational Velocity</div>
                  <div className="text-white font-mono font-bold text-sm">+82% Autopilot</div>
                </div>
                <div>
                  <div className="text-slate-500">Billing Provider</div>
                  <div className="text-blue-400 font-mono font-bold text-sm">PayPal REST v2</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectPlan(recommendedTier)}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950"
            >
              <span>Subscribe to {recommendedTier.name}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
