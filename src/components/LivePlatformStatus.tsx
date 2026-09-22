import { useEffect, useState } from 'react';

interface PlatformStatus {
  backend: string;
  ingestion: string;
  telemetry: string;
  lastAction: string;
}

const initialStatus: PlatformStatus = { backend: 'CONNECTING', ingestion: 'READY', telemetry: 'CONNECTING', lastAction: 'Awaiting operator action' };

export function LivePlatformStatus() {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const [health, telemetry] = await Promise.allSettled([
        fetch('/health', { headers: { Accept: 'application/json' } }),
        fetch('/telemetry/summary', { headers: { Accept: 'application/json' } }),
      ]);
      if (!active) return;
      setStatus((current) => ({
        ...current,
        backend: health.status === 'fulfilled' && health.value.ok ? 'ONLINE' : 'DEGRADED',
        telemetry: telemetry.status === 'fulfilled' && telemetry.value.ok ? 'LIVE' : 'UNAVAILABLE',
      }));
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const dispatchAllocation = async () => {
    setBusy(true);
    try {
      const response = await fetch('/v1/compute/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ tenant_id: 'web-enterprise', resource_tier: 'GPU_A100', duration_hours: 1, idempotency_key: `web-${Date.now()}` }),
      });
      setStatus((current) => ({ ...current, lastAction: response.ok ? 'Compute allocation lease issued' : `Allocation rejected (${response.status})` }));
    } catch {
      setStatus((current) => ({ ...current, lastAction: 'Allocation unavailable; recovery path preserved' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid gap-3 rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-4 text-xs font-mono text-slate-300 sm:grid-cols-4">
        <div><span className="text-slate-500">BACKEND</span><div className="mt-1 text-emerald-300">● {status.backend}</div></div>
        <div><span className="text-slate-500">INGESTION</span><div className="mt-1 text-cyan-300">● {status.ingestion}</div></div>
        <div><span className="text-slate-500">TELEMETRY</span><div className="mt-1 text-cyan-300">● {status.telemetry}</div></div>
        <button type="button" onClick={dispatchAllocation} disabled={busy} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-left text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-50">{busy ? 'ALLOCATING…' : 'ALLOCATE COMPUTE'}<div className="mt-1 truncate text-[10px] text-slate-500">{status.lastAction}</div></button>
      </div>
    </section>
  );
}
