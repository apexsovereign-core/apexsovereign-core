import React from 'react';

export const EnterprisePortal: React.FC<{ onNavigate?: (page: 'landing' | 'terminal' | 'futures' | 'billing' | 'enterprise') => void }> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#020305] text-slate-100 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-white font-mono tracking-tight mb-4">
          <span className="text-[#00F0FF]">ENTERPRISE</span> SLA & ONBOARDING PORTAL
        </h1>
        <p className="text-slate-400 text-lg mb-12 max-w-3xl">
          Institutional-grade sovereign compute infrastructure with 99.99% uptime guarantees,
          zero-log privacy contracts, and direct wire/PayPal settlement protocols.
        </p>

        {/* SLA Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-6">
            <div className="text-3xl font-bold text-emerald-400 font-mono mb-2">99.99%</div>
            <div className="text-sm text-slate-300 font-mono uppercase tracking-wider">Uptime SLA</div>
            <p className="text-xs text-slate-400 mt-3">Guaranteed availability across all sovereign compute nodes with automatic failover.</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-6">
            <div className="text-3xl font-bold text-[#00F0FF] font-mono mb-2">Zero-Log</div>
            <div className="text-sm text-slate-300 font-mono uppercase tracking-wider">Privacy Contract</div>
            <p className="text-xs text-slate-400 mt-3">No request payloads, inputs, or outputs are persisted. HMAC-verified compute deductions only.</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-6">
            <div className="text-3xl font-bold text-amber-400 font-mono mb-2">&lt;18ms</div>
            <div className="text-sm text-slate-300 font-mono uppercase tracking-wider">Routing Latency</div>
            <p className="text-xs text-slate-400 mt-3">Non-autoregressive node scoring from Vercel Edge to Supabase RPC.</p>
          </div>
        </div>

        {/* Settlement Protocols */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white font-mono mb-4">Settlement Protocols</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white font-mono mb-2">Wire Transfer</h3>
              <p className="text-sm text-slate-400">Direct institutional wire settlement with same-day CU credit minting via PayPal-verified capture.</p>
            </div>
            <div className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white font-mono mb-2">PayPal Settlement</h3>
              <p className="text-sm text-slate-400">Sandbox-locked by default. Live settlement requires founder override and supplier-mode acknowledgment.</p>
            </div>
          </div>
        </div>

        {/* API Sandbox */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white font-mono mb-4">Interactive API Sandbox</h2>
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-6">
            <p className="text-sm text-slate-400 mb-4">
              Execute real-time quote benchmarks against the non-autoregressive routing engine.
              POST to <code className="text-[#00F0FF]">/api/compute/allocate</code> with your tenant ID and resource tier.
            </p>
            <pre className="bg-black/40 rounded p-4 text-xs text-emerald-400 font-mono overflow-x-auto">
{`curl -X POST https://www.apexsovereign.ai/api/compute/allocate \\
  -H "Content-Type: application/json" \\
  -d '{"tenant_id":"demo-tenant","resource_tier":"GPU_H100","duration_hours":1}'`}
            </pre>
          </div>
        </div>

        <button
          onClick={() => onNavigate?.('landing')}
          className="text-sm text-[#00F0FF] font-mono hover:underline"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
};
