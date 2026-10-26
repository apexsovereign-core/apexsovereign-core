'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  Cpu,
  Lock,
  TrendingDown,
} from 'lucide-react';
import { CU_PER_USD } from '../config/pricing';

export interface AcceleratorSpec {
  id: string;
  name: string;
  model: string;
  vram: string;
  interconnect: string;
  /** Reference planning rate. Not a live quote. */
  spotPriceHr: number;
  /** Reference hyperscaler comparison rate. Not a measured invoice. */
  baselinePriceHr: number;
  /** Reference-only percentage derived from the two rates above. */
  savingsPct: number;
  badge?: string;
  architecture: string;
  enclaveType: 'AMD SEV-SNP' | 'NVIDIA CC' | 'DUAL_HARDWARE_ENCLAVE';
  memoryEncryption: string;
}

export const ACCELERATORS: AcceleratorSpec[] = [
  {
    id: 'rubin',
    name: 'NVIDIA Rubin',
    model: 'Rubin HBM4 Enterprise Node',
    vram: '288GB HBM4 (22 TB/s)',
    interconnect: '3.6 TB/s NVLink 6 Optical',
    spotPriceHr: 2.4,
    baselinePriceHr: 5.1,
    savingsPct: 52.9,
    badge: 'TIER-6 REFERENCE',
    architecture: 'Vera Rubin Next-Gen Architecture',
    enclaveType: 'DUAL_HARDWARE_ENCLAVE',
    memoryEncryption: 'Hardware-Enforced AES-256-XTS & Full SEV-SNP',
  },
  {
    id: 'b200',
    name: 'NVIDIA B200',
    model: 'Blackwell B200 NVL72 Rack',
    vram: '192GB HBM3e (8 TB/s)',
    interconnect: '1.8 TB/s NVLink 5 Fabric',
    spotPriceHr: 2.85,
    baselinePriceHr: 4.6,
    savingsPct: 38.0,
    badge: 'NVL72 REFERENCE',
    architecture: 'Blackwell Dual-Die Fabric',
    enclaveType: 'NVIDIA CC',
    memoryEncryption: 'NVIDIA Confidential Computing On-Die RoT',
  },
  {
    id: 'h100',
    name: 'NVIDIA H100',
    model: 'Hopper H100 SXM5 80GB',
    vram: '80GB HBM3 (3.35 TB/s)',
    interconnect: '900 GB/s NVLink 4',
    spotPriceHr: 1.94,
    baselinePriceHr: 3.29,
    savingsPct: 41.0,
    badge: 'CONFIDENTIAL READY',
    architecture: 'Hopper 4nm Tensor Core',
    enclaveType: 'AMD SEV-SNP',
    memoryEncryption: 'AMD SEV-SNP Encrypted State & Remote Attestation',
  },
  {
    id: 'a100',
    name: 'NVIDIA A100',
    model: 'Ampere A100 SXM4 80GB (MIG-Slicing)',
    vram: '80GB HBM2e (2 TB/s)',
    interconnect: '600 GB/s NVLink 3',
    spotPriceHr: 1.42,
    baselinePriceHr: 2.2,
    savingsPct: 35.5,
    badge: 'MIG REFERENCE',
    architecture: 'Ampere Multi-Instance GPU',
    enclaveType: 'AMD SEV-SNP',
    memoryEncryption: 'Hardware MIG Memory Partitioning & SEV Attested',
  },
  {
    id: 'l40s',
    name: 'NVIDIA L40S',
    model: 'Ada Lovelace L40S PCIe 48GB',
    vram: '48GB GDDR6 (864 GB/s)',
    interconnect: '64 GB/s PCIe Gen4',
    spotPriceHr: 0.89,
    baselinePriceHr: 1.37,
    savingsPct: 35.0,
    badge: 'DECODE REFERENCE',
    architecture: 'Ada Lovelace Enterprise',
    enclaveType: 'AMD SEV-SNP',
    memoryEncryption: 'Secure Encrypted Virtualization (SEV-ES)',
  },
];

export const MultiAcceleratorCalculator: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>('rubin');
  const [gpuCount, setGpuCount] = useState<number>(32);
  const [durationHours, setDurationHours] = useState<number>(720);

  const current = useMemo(
    () => ACCELERATORS.find((a) => a.id === selectedId) || ACCELERATORS[0],
    [selectedId],
  );

  const referenceApexCost = current.spotPriceHr * gpuCount * durationHours;
  const referenceBaselineCost =
    current.baselinePriceHr * gpuCount * durationHours;
  const referenceRetained = referenceBaselineCost - referenceApexCost;
  const referenceComputeUnits = Math.round(referenceApexCost * CU_PER_USD);

  const adjustGpus = (delta: number) => {
    setGpuCount((prev) => Math.max(1, Math.min(512, prev + delta)));
  };

  const presetChips = [
    { label: '[8 GPUs]', count: 8 },
    { label: '[32 GPUs]', count: 32 },
    { label: '[128 GPUs]', count: 128 },
    { label: '[NVL72 Rack]', count: 72 },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Reference-data disclosure */}
      <div className="p-3.5 rounded-xl bg-[#080D16]/90 border border-amber-500/30 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Activity
            className="w-4 h-4 text-amber-400"
            aria-hidden="true"
          />
          <span className="text-white font-bold">REFERENCE CALCULATOR:</span>
          <span className="text-slate-400">
            PLANNING RATES ONLY · NOT LIVE QUOTES OR MEASURED SAVINGS
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
          REFERENCE
        </span>
      </div>

      {/* Accelerator switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {ACCELERATORS.map((acc) => {
          const isSelected = acc.id === selectedId;
          return (
            <button
              key={acc.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedId(acc.id)}
              className={`text-left p-3.5 rounded-xl border transition relative overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] ${
                isSelected
                  ? 'bg-[#080D16] border-[#00F0FF] shadow-[0_0_24px_rgba(0,240,255,0.2)]'
                  : 'bg-[#050811]/90 border-slate-800 hover:border-slate-700 hover:bg-[#070B14]'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-[#00F0FF]/30 to-transparent pointer-events-none" />
              )}
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-bold text-white font-mono tracking-tight">
                  {acc.name}
                </span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  −{acc.savingsPct}% REF
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate mb-2">
                {acc.vram.split(' ')[0]}
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm font-bold text-[#00F0FF] font-mono">
                    ${acc.spotPriceHr.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    /hr REF
                  </span>
                </div>
                <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/25">
                  {acc.enclaveType === 'DUAL_HARDWARE_ENCLAVE'
                    ? 'SEV+CC'
                    : acc.enclaveType}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Reference calculator card */}
      <div className="p-6 md:p-8 rounded-2xl bg-[#080D16]/90 border border-[#00F0FF]/25 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,240,255,0.05)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#00F0FF]">
                  REFERENCE FLEET CALCULATOR
                </span>
                <h4 className="text-xl font-bold text-white tracking-tight mt-0.5">
                  {current.model}
                </h4>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-400 block">
                  REFERENCE HYPERSCALER RATE
                </span>
                <span className="text-xs font-mono text-slate-400 line-through">
                  ${current.baselinePriceHr.toFixed(2)} /hr
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#050811] border border-[#00F0FF]/25 flex items-start gap-2.5 text-xs font-mono">
              <Lock
                className="w-4 h-4 text-[#00F0FF] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-white font-bold">
                    ENCLAVE REFERENCE:
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/40 text-[#10B981] text-[10px] font-bold">
                    {current.enclaveType}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  {current.memoryEncryption}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">GPU FLEET ALLOCATION:</span>
                <span className="text-[#00F0FF] font-bold">
                  {gpuCount} ACCELERATORS
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustGpus(-8)}
                  className="w-11 h-11 rounded-lg bg-[#050811] border border-slate-700 text-[#00F0FF] hover:border-[#00F0FF] flex items-center justify-center font-mono font-bold text-lg active:scale-95 transition"
                  aria-label="Decrease GPU count by 8"
                >
                  −
                </button>
                <div className="flex-1 px-4 py-2.5 rounded-lg bg-[#030508] border border-[#00F0FF]/30 font-mono text-center text-lg font-bold text-white">
                  {gpuCount} GPUs
                </div>
                <button
                  type="button"
                  onClick={() => adjustGpus(8)}
                  className="w-11 h-11 rounded-lg bg-[#050811] border border-slate-700 text-[#00F0FF] hover:border-[#00F0FF] flex items-center justify-center font-mono font-bold text-lg active:scale-95 transition"
                  aria-label="Increase GPU count by 8"
                >
                  +
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {presetChips.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    aria-pressed={gpuCount === chip.count}
                    onClick={() => setGpuCount(chip.count)}
                    className={`px-3 py-1 rounded-md text-xs font-mono transition font-bold ${
                      gpuCount === chip.count
                        ? 'bg-[#00F0FF] text-[#020305] shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                        : 'bg-[#050811] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <label htmlFor="fleet-duration" className="text-slate-300">
                  DURATION HOURS:
                </label>
                <span className="text-white font-bold">
                  {durationHours} HOURS ({Math.round(durationHours / 24)} DAYS)
                </span>
              </div>
              <input
                id="fleet-duration"
                type="range"
                min="24"
                max="2160"
                step="24"
                value={durationHours}
                onChange={(event) =>
                  setDurationHours(parseInt(event.target.value, 10))
                }
                className="w-full accent-[#00F0FF] cursor-pointer"
                aria-valuetext={`${durationHours} hours`}
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>24 Hrs</span>
                <span>720 Hrs (30D)</span>
                <span>2160 Hrs (90D)</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 p-6 rounded-xl bg-gradient-to-b from-[#050914] to-[#020409] border border-[#00F0FF]/30 shadow-inner space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <span className="text-xs font-mono text-slate-400">
                REFERENCE SAVINGS ESTIMATE
              </span>
              <span className="text-base font-mono font-bold text-[#10B981] flex items-center gap-1">
                <TrendingDown className="w-4 h-4" aria-hidden="true" />
                {current.savingsPct}% REF
              </span>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                REFERENCE DIFFERENCE
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-[#00F0FF] font-mono tracking-tight mt-1 drop-shadow-[0_0_20px_rgba(0,240,255,0.35)]">
                $
                {referenceRetained.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Calculated from reference rates. Not a quote, invoice, or
                verified saving.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-[#080D16] border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400">
                  APEX SPOT (REF)
                </div>
                <div className="text-sm font-mono font-bold text-white mt-0.5">
                  $
                  {referenceApexCost.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#080D16] border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400">
                  HYPERSCALER (REF)
                </div>
                <div className="text-sm font-mono font-bold text-slate-500 line-through mt-0.5">
                  $
                  {referenceBaselineCost.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/25 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">REFERENCE CU ESTIMATE:</span>
              <span className="text-[#00F0FF] font-bold">
                {referenceComputeUnits.toLocaleString()} CU
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
              <Cpu className="w-3 h-3" aria-hidden="true" />
              $1.00 = 100 CU parity · reference arithmetic only
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiAcceleratorCalculator;
