/**
 * ApexSovereign.ai - Enterprise GPU Arbitrage Core
 * Component: Live GPU Telemetry Stream
 * Engine: Real-Time WebSocket Hook with Sub-Second Metrics
 */

import React, { useState } from 'react';
import { 
  Cpu, 
  Activity, 
  Zap, 
  Thermometer, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Play, 
  Pause, 
  ShieldCheck, 
  Server, 
  HardDrive, 
  Network,
  Clock,
  TrendingDown,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useGpuMetricsWebSocket } from '../hooks/useGpuMetricsWebSocket';
import { GpuNodeMetric } from '../types';
import { GpuUtilizationLiveChart } from './GpuUtilizationLiveChart';

interface LiveGpuTelemetryStreamProps {
  compact?: boolean;
  onSelectNode?: (node: GpuNodeMetric) => void;
}

export const LiveGpuTelemetryStream: React.FC<LiveGpuTelemetryStreamProps> = ({
  compact = false,
  onSelectNode
}) => {
  const {
    nodes,
    clusterSummary,
    isConnected,
    isConnecting,
    isPaused,
    connectionState,
    latencyMs,
    lastUpdated,
    reconnectCount,
    telemetryHistory,
    reconnect,
    pauseStream,
    resumeStream,
    setTickRate,
  } = useGpuMetricsWebSocket({
    heartbeatIntervalMs: 4000,
  });

  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [activeTickRate, setActiveTickRate] = useState<number>(1000);

  const filteredNodes = nodes.filter(node => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'H100') return node.gpuModel.includes('H100');
    if (selectedFilter === 'B200') return node.gpuModel.includes('B200');
    if (selectedFilter === 'L40S') return node.gpuModel.includes('L40S');
    if (selectedFilter === 'A100') return node.gpuModel.includes('A100');
    return true;
  });

  const handleRateChange = (ms: number) => {
    setActiveTickRate(ms);
    setTickRate(ms);
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl p-5 space-y-6">
      {/* Header & Connection Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Cpu className="w-5 h-5" />
            {isConnected && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping opacity-75" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Bare-Metal GPU Telemetry Stream
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 text-slate-300">
                WSS PROTOCOL
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Direct sub-second telemetry socket connecting bare-metal cluster orchestrators.
            </p>
          </div>
        </div>

        {/* Live Status Controls */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Socket State Indicator */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono border text-[11px] ${
            connectionState === 'CONNECTED' 
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
              : connectionState === 'RECONNECTING' || connectionState === 'CONNECTING'
              ? 'bg-amber-950/40 text-amber-400 border-amber-500/30 animate-pulse'
              : connectionState === 'FALLBACK_POLLING'
              ? 'bg-blue-950/40 text-blue-400 border-blue-500/30'
              : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>LIVE ({latencyMs ? `${latencyMs}ms` : 'sub-10ms'})</span>
              </>
            ) : connectionState === 'FALLBACK_POLLING' ? (
              <>
                <Activity className="w-3.5 h-3.5" />
                <span>HTTP SNAPSHOT</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>{connectionState} {reconnectCount > 0 ? `(#${reconnectCount})` : ''}</span>
              </>
            )}
          </div>

          {/* Pause / Resume Button */}
          <button
            onClick={isPaused ? resumeStream : pauseStream}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors cursor-pointer ${
              isPaused 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
            title={isPaused ? 'Resume stream' : 'Pause stream'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          {/* Tick Rate Presets */}
          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 font-mono text-[11px]">
            {[
              { label: '500ms', ms: 500 },
              { label: '1s', ms: 1000 },
              { label: '2s', ms: 2000 },
            ].map(rate => (
              <button
                key={rate.ms}
                onClick={() => handleRateChange(rate.ms)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  activeTickRate === rate.ms 
                    ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {rate.label}
              </button>
            ))}
          </div>

          {/* Reconnect Manual Button */}
          <button
            onClick={reconnect}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Force reconnect WebSocket"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cluster Aggregate Cards */}
      {clusterSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Average Utilization */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>CLUSTER UTILIZATION</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white font-mono flex items-baseline gap-1.5">
              <span>{clusterSummary.averageUtilizationPct}%</span>
              <span className="text-[10px] text-emerald-400 font-normal">Active</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${clusterSummary.averageUtilizationPct}%` }}
              />
            </div>
          </div>

          {/* Total GPUs Online */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>ONLINE ACCELERATORS</span>
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white font-mono flex items-baseline gap-1.5">
              <span>{clusterSummary.totalGpusOnline} GPUs</span>
              <span className="text-[10px] text-slate-400 font-normal">
                ({clusterSummary.totalGpusActive} leased)
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              5 global availability regions
            </div>
          </div>

          {/* Total VRAM Committed */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>VRAM COMMITTED</span>
              <HardDrive className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-white font-mono flex items-baseline gap-1.5">
              <span>{Math.round(clusterSummary.totalMemoryUsedGb)} GB</span>
              <span className="text-[10px] text-slate-400 font-normal">
                / {Math.round(clusterSummary.totalMemoryCapacityGb)} GB
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-300"
                style={{ width: `${(clusterSummary.totalMemoryUsedGb / clusterSummary.totalMemoryCapacityGb) * 100}%` }}
              />
            </div>
          </div>

          {/* Cluster Power Draw */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>AGGREGATE POWER</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white font-mono flex items-baseline gap-1.5">
              <span>{(clusterSummary.totalPowerWatts / 1000).toFixed(1)} kW</span>
              <span className="text-[10px] text-amber-400 font-normal">Hydro / Solar</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Thermal envelope: Nominal
            </div>
          </div>

          {/* Arbitrage Savings */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>ARBITRAGE SPREAD</span>
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400 font-mono flex items-baseline gap-1.5">
              <span>-46.8%</span>
              <span className="text-[10px] text-slate-300 font-normal">vs Hyperscalers</span>
            </div>
            <div className="text-[10px] font-mono text-emerald-500/90">
              ${(1.94).toFixed(2)}/hr spot ceiling
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Responsive Recharts Line Chart: 60-Second Rolling Window */}
      <GpuUtilizationLiveChart
        data={telemetryHistory}
        isConnected={isConnected}
        isPaused={isPaused}
        latencyMs={latencyMs}
        compact={compact}
      />

      {/* Cluster Hardware Filter & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/60 font-mono text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Server className="w-3.5 h-3.5 text-emerald-400" />
          <span>FILTER BARE-METAL HARDWARE PARTITIONS</span>
        </div>

        {/* Model Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-500 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            Partition:
          </span>
          {['ALL', 'H100', 'B200', 'L40S', 'A100'].map(filterKey => (
            <button
              key={filterKey}
              onClick={() => setSelectedFilter(filterKey)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                selectedFilter === filterKey
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {filterKey}
            </button>
          ))}
        </div>
      </div>

      {/* Individual Node Telemetry Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
          <span>BARE-METAL CLUSTERS ({filteredNodes.length} NODES)</span>
          {lastUpdated && <span>Last heartbeat: {lastUpdated}</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredNodes.map(node => (
            <div
              key={node.nodeId}
              onClick={() => onSelectNode && onSelectNode(node)}
              className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3.5 group cursor-pointer hover:shadow-lg hover:shadow-emerald-950/20"
            >
              {/* Card Top: Node ID & Health Badge */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {node.nodeId}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Server className="w-3 h-3 text-slate-500" />
                    <span>{node.datacenterRegion}</span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border uppercase ${
                  node.healthStatus === 'OPTIMAL'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : node.healthStatus === 'DEGRADED'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {node.healthStatus}
                </span>
              </div>

              {/* Hardware Spec Strip */}
              <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs space-y-1 font-mono">
                <div className="text-slate-200 font-medium truncate">
                  {node.gpuModel}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Network className="w-3 h-3 text-blue-400" />
                    {node.interconnectBandwidthGbps} Gbps Fabric
                  </span>
                  <span className="text-emerald-400 font-bold">
                    ${node.arbitrageSpotRatePerHour.toFixed(2)} / hr
                  </span>
                </div>
              </div>

              {/* Dynamic Utilization Gauge */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-slate-400">GPU Compute Load</span>
                  <span className="text-white font-bold">{node.utilizationPct}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      node.utilizationPct > 90 
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500' 
                        : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                    style={{ width: `${node.utilizationPct}%` }}
                  />
                </div>
              </div>

              {/* Memory & Power & Thermals Footer */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                <div>
                  <span className="text-slate-500 block text-[9px]">VRAM</span>
                  <span className="text-slate-200 font-semibold">{Math.round(node.memoryUsedGb)}G</span>
                  <span className="text-slate-500 text-[9px]">/{Math.round(node.memoryTotalGb)}G</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[9px]">THERMAL</span>
                  <span className={`font-semibold flex items-center gap-0.5 ${
                    node.temperatureC > 75 ? 'text-rose-400' : 'text-slate-200'
                  }`}>
                    <Thermometer className="w-2.5 h-2.5" />
                    {node.temperatureC}°C
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[9px]">POWER</span>
                  <span className="text-slate-200 font-semibold">{Math.round(node.powerDrawWatts)}W</span>
                  <span className="text-slate-500 text-[9px]">/{Math.round(node.powerLimitWatts)}W</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
