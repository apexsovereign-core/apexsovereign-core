import React, { useState } from 'react';
import { CustomerUser } from '../types';
import { 
  ShieldCheck, 
  Terminal, 
  Cpu, 
  Database, 
  Layers, 
  FileCode, 
  CloudLightning,
  Sparkles,
  Key,
  CreditCard,
  User,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  Coins,
  Sliders,
  ShieldAlert
} from 'lucide-react';

export type ActiveNavTab = 'pricing' | 'portal' | 'requirements' | 'signer' | 'architecture' | 'sandbox' | 'code' | 'schema' | 'deploy';

interface NavbarProps {
  activeTab: ActiveNavTab;
  setActiveTab: (tab: ActiveNavTab) => void;
  currentUser: CustomerUser | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  activeTab, 
  setActiveTab, 
  currentUser, 
  onOpenAuth, 
  onLogout 
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <header id="apex-header" className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab(currentUser ? 'portal' : 'pricing')}
              className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-lg shadow-[0_0_15px_rgba(16,185,129,0.15)] group-hover:border-emerald-400/60 transition-colors">
                AS
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white tracking-tight text-base group-hover:text-emerald-300 transition-colors">
                    ApexSovereign.ai
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">Work OS & Autonomous Compute Broker</p>
              </div>
            </button>
          </div>

          {/* Navigation Controls */}
          <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1">
            {/* Customer Facing Tabs */}
            <button
              id="tab-pricing"
              onClick={() => setActiveTab('pricing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'pricing'
                  ? 'bg-emerald-950/80 text-emerald-300 shadow-sm border border-emerald-500/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pricing & Plans</span>
              <span className="px-1.5 py-0.2 text-[9px] font-mono bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                PayPal
              </span>
            </button>

            {currentUser && (
              <button
                id="tab-portal"
                onClick={() => setActiveTab('portal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'portal'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
                <span>My Workspace</span>
              </button>
            )}

            <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

            {/* Quick Master Requirements Editor */}
            <button
              id="tab-requirements"
              onClick={() => setActiveTab('requirements')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'requirements'
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] font-bold'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Edit All Requirements</span>
            </button>

            {/* Developer & Operations Console Tabs */}
            <button
              id="tab-signer"
              onClick={() => setActiveTab('signer')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'signer'
                  ? 'bg-slate-800 text-emerald-300 shadow-sm border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>6 Variables Signer</span>
            </button>

            <button
              id="tab-architecture"
              onClick={() => setActiveTab('architecture')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer hidden md:flex ${
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
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'sandbox'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulators</span>
            </button>

            {/* Codebase tab restricted to verified administrators to protect proprietary IP */}
            {currentUser?.role === 'admin' && (
              <button
                id="tab-code"
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'code'
                    ? 'bg-rose-950/80 text-rose-300 shadow-sm border border-rose-500/50 ring-1 ring-rose-500/30'
                    : 'text-rose-400/90 hover:text-rose-200 hover:bg-rose-950/30 border border-rose-900/40'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Admin Codebase</span>
                <span className="px-1.5 py-0.2 text-[9px] font-mono bg-rose-500/20 text-rose-300 rounded border border-rose-500/30">
                  STAFF
                </span>
              </button>
            )}

            <button
              id="tab-deploy"
              onClick={() => setActiveTab('deploy')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer hidden sm:flex ${
                activeTab === 'deploy'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <CloudLightning className="w-3.5 h-3.5 text-purple-400" />
              <span>Deploy</span>
            </button>
          </nav>

          {/* User Profile / Auth Area */}
          <div className="flex items-center gap-2">
            {!currentUser ? (
              <button
                id="btn-nav-signin"
                onClick={onOpenAuth}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center gap-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Log In / Sign Up</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono text-[11px] font-bold flex items-center justify-center">
                    {currentUser.fullName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-semibold text-white leading-tight">
                      {currentUser.fullName.split(' ')[0]}
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <Coins className="w-2.5 h-2.5" />
                      <span>{currentUser.computeCredits.toLocaleString()} CU</span>
                    </div>
                  </div>
                  <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                </button>

                {/* User Dropdown */}
                {showUserDropdown && (
                  <div 
                    className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in duration-150"
                    onClick={() => setShowUserDropdown(false)}
                  >
                    <div className="p-2 border-b border-slate-800 mb-1">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-white">{currentUser.fullName}</div>
                        {currentUser.role === 'admin' && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">{currentUser.email}</div>
                      <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-500">Tenant:</span>
                        <span className="text-slate-300">{currentUser.tenantId}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('portal')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2 transition-colors"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
                      <span>My Workspace & Quota</span>
                    </button>

                    {currentUser.role === 'admin' && (
                      <button
                        onClick={() => setActiveTab('code')}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-rose-300 hover:bg-rose-950/40 flex items-center gap-2 transition-colors border border-rose-900/30 my-0.5"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        <span>Admin IP Codebase Audit</span>
                      </button>
                    )}

                    <button
                      onClick={() => setActiveTab('pricing')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2 transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Upgrade / Top-up Plan</span>
                    </button>

                    <div className="my-1 border-t border-slate-800" />

                    <button
                      onClick={onLogout}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
