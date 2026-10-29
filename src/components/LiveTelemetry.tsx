import React, { useState, useEffect } from 'react';

interface NodeStat {
  id: string;
  model: string;
  region: string;
  status: 'available' | 'allocated' | 'maintenance' | 'offline';
  rateCuHr: number;
  thermalHeadroomC: number;
  rttMs: number;
  poolLiquidityCu: number;
}

interface TelemetrySnapshot {
  nodes: NodeStat[];
  totalPoolCu: number;
  totalDeductionsCu: number;
  avgLatencyMs: number;
  arbitrageMarginPct: number;
  updatedAt: string;
}

const INITIAL_NODES: NodeStat[] = [
  { id: 'node-us-east-01', model: 'NVIDIA H100 80GB SXM5', region: 'us-east', status: 'available', rateCuHr: 194, thermalHeadroomC: 12, rttMs: 4, poolLiquidityCu: 45000 },
  { id: 'node-us-east-02', model: 'NVIDIA A100 80GB SXM4', region: 'us-east', status: 'available', rateCuHr: 142, thermalHeadroomC: 8, rttMs: 5, poolLiquidityCu: 32000 },
  { id: 'node-eu-central-01', model: 'NVIDIA H100 80GB SXM5', region: 'eu-central', status: 'available', rateCuHr: 210, thermalHeadroomC: 10, rttMs: 28, poolLiquidityCu: 28000 },
  { id: 'node-apac-01', model: 'NVIDIA L40S 48GB PCIe', region: 'apac', status: 'available', rateCuHr: 78, thermalHeadroomC: 15, rttMs: 45, poolLiquidityCu: 18000 },
];

function buildSnapshot(nodes: NodeStat[]): TelemetrySnapshot {
  const totalPoolCu = nodes.reduce((s, n) => s + n.poolLiquidityCu, 0);
  const totalDeductionsCu = 4210.5 + Math.random() * 50;
  const avgLatencyMs = nodes.reduce((s, n) => s + n.rttMs, 0) / nodes.length;
  const arbitrageMarginPct = 35.2 + Math.random() * 2;
  return {
    nodes,
    totalPoolCu,
    totalDeductionsCu,
    avgLatencyMs,
    arbitrageMarginPct,
    updatedAt: new Date().toISOString(),
  };
}

const STATUS_COLOR: Record<NodeStat['status'], string> = {
  available: 'text-emerald-400',
  allocated: 'text-amber-400',
  maintenance: 'text-slate-400',
  offline: 'text-red-400',
};

export const LiveTelemetry: React.FC = () => {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot>(() => buildSnapshot(INITIAL_NODES));

  useEffect(() => {
    const interval = setInterval(() => {
      setSnapshot((prev) => {
        const nodes = prev.nodes.map((n) => ({
          ...n,
          rttMs: Math.max(1, n.rttMs + (Math.random() - 0.5) * 2),
          thermalHeadroomC: Math.max(0, Math.min(20, n.thermalHeadroomC + (Math.random() - 0.5) * 1)),
          poolLiquidityCu: Math.max(0, n.poolLiquidityCu + (Math.random() - 0.5) * 500),
        }));
        return buildSnapshot(nodes);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white font-mono tracking-tight">
          <span className="text-[#00F0FF]">LIVE</span> TELEMETRY — GLOBAL MESH
        </h2>
        <span className="text-xs text-slate-400 font-mono">
          Updated: {new Date(snapshot.updatedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">Total Pool CU</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">
            {snapshot.totalPoolCu.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">Total Deductions CU</div>
          <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
            {snapshot.totalDeductionsCu.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">Avg Latency</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
            {snapshot.avgLatencyMs.toFixed(1)} ms
          </div>
        </div>
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-4">
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">Arbitrage Margin</div>
          <div className="text-2xl font-bold text-[#00F0FF] font-mono mt-1">
            {snapshot.arbitrageMarginPct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Node Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700/50">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="bg-slate-800/60 text-slate-300 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Node</th>
              <th className="px-4 py-3 text-left">Model</th>
              <th className="px-4 py-3 text-left">Region</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">CU/hr</th>
              <th className="px-4 py-3 text-right">Thermal °C</th>
              <th className="px-4 py-3 text-right">RTT ms</th>
              <th className="px-4 py-3 text-right">Pool CU</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.nodes.map((node) => (
              <tr key={node.id} className="border-t border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 text-white">{node.id}</td>
                <td className="px-4 py-3 text-slate-300">{node.model}</td>
                <td className="px-4 py-3 text-slate-400">{node.region}</td>
                <td className={`px-4 py-3 font-bold ${STATUS_COLOR[node.status]}`}>
                  {node.status.toUpperCase()}
                </td>
                <td className="px-4 py-3 text-right text-slate-200">{node.rateCuHr}</td>
                <td className="px-4 py-3 text-right text-slate-200">{node.thermalHeadroomC.toFixed(1)}</td>
                <td className="px-4 py-3 text-right text-slate-200">{node.rttMs.toFixed(1)}</td>
                <td className="px-4 py-3 text-right text-[#00F0FF]">
                  {node.poolLiquidityCu.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* GPU Pool Liquidity Summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-4">
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider mb-2">H100 Pool</div>
          <div className="text-lg font-bold text-white font-mono">
            {snapshot.nodes.filter((n) => n.model.includes('H100')).reduce((s, n) => s + n.poolLiquidityCu, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} CU
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-4">
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider mb-2">A100 Pool</div>
          <div className="text-lg font-bold text-white font-mono">
            {snapshot.nodes.filter((n) => n.model.includes('A100')).reduce((s, n) => s + n.poolLiquidityCu, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} CU
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-700/30 rounded-lg p-4">
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider mb-2">L40S Pool</div>
          <div className="text-lg font-bold text-white font-mono">
            {snapshot.nodes.filter((n) => n.model.includes('L40S')).reduce((s, n) => s + n.poolLiquidityCu, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} CU
          </div>
        </div>
      </div>
    </div>
  );
};
