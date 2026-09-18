import React from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  Cpu, 
  Database, 
  Layers, 
  FileCode, 
  CloudLightning,
  Sparkles,
  Key
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'architecture' | 'sandbox' | 'code' | 'schema' | 'deploy' | 'signer';
  setActiveTab: (tab: 'architecture' | 'sandbox' | 'code' | 'schema' | 'deploy' | 'signer') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header id="apex-header" className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-lg shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              AS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white tracking-tight text-base">ApexSovereign.ai</span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v2.4 Production
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Work OS & Autonomous Compute Broker</p>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              id="tab-architecture"
              onClick={() => setActiveTab('architecture')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'architecture'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Architecture</span>
            </button>

            <button
              id="tab-sandbox"
              onClick={() => setActiveTab('sandbox')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'sandbox'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Sandbox</span>
            </button>

            <button
              id="tab-signer"
              onClick={() => setActiveTab('signer')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'signer'
                  ? 'bg-emerald-950/80 text-emerald-300 shadow-sm border border-emerald-500/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold">6 Variables Signer</span>
            </button>

            <button
              id="tab-code"
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'code'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              <span>Codebase</span>
            </button>

            <button
              id="tab-schema"
              onClick={() => setActiveTab('schema')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'schema'
                  ? 'bg-amber-950/80 text-amber-300 shadow-sm border border-amber-500/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Supabase & Security</span>
              <span className="hidden lg:inline px-1 py-0.2 text-[9px] font-mono bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                Fix Ready
              </span>
            </button>

            <button
              id="tab-deploy"
              onClick={() => setActiveTab('deploy')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'deploy'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <CloudLightning className="w-3.5 h-3.5 text-purple-400" />
              <span>Render Blueprint</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
