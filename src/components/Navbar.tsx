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
  ShieldAlert,
  Briefcase,
  Lock,
  Workflow,
  Bot,
  BarChart2
} from 'lucide-react';

export type ActiveNavTab = 
  | 'solutions' 
  | 'pricing' 
  | 'crm'
  | 'swarm'
  | 'portal' 
  | 'requirements' 
  | 'signer' 
  | 'architecture' 
  | 'sandbox' 
  | 'code' 
  | 'schema' 
  | 'deploy';

interface NavbarProps {
  activeTab: ActiveNavTab;
  setActiveTab: (tab: ActiveNavTab) => void;
  currentUser: CustomerUser | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  isAdminUnlocked?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  activeTab, 
  setActiveTab, 
  currentUser, 
  onOpenAuth, 
  onLogout,
  isAdminUnlocked = false
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  const isStaffAdmin = currentUser?.role === 'admin' || isAdminUnlocked;

  return (
    <header id="apex-header" className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab(currentUser ? 'portal' : 'solutions')}
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
                <p className="text-[11px] text-slate-400 hidden sm:block">Work OS & Autonomous Agency Mesh</p>
              </div>
            </button>
          </div>

          {/* Navigation Controls */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1">
            {/* 1. Solutions & Autonomous Agency Overview (Public) */}
            <button
              id="tab-solutions"
              onClick={() => setActiveTab('solutions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'solutions'
                  ? 'bg-slate-800 text-emerald-300 shadow-sm border border-emerald-500/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Workflow className="w-3.5 h-3.5 text-emerald-400" />
              <span>Platform & Solutions</span>
            </button>

            {/* 2. Pricing & Plans (Public Customer Storefront) */}
            <button
              id="tab-pricing"
              onClick={() => setActiveTab('pricing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'pricing'
                  ? 'bg-emerald-950/80 text-emerald-300 shadow-sm border border-emerald-500/50 ring-1 ring-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dynamic Pricing</span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping"></span>
                <span>-15% Live</span>
              </span>
            </button>

            {/* 3. Enterprise CRM & Work OS (Salesforce + M365 Synthesis) */}
            <button
              id="tab-crm"
              onClick={() => setActiveTab('crm')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'crm'
                  ? 'bg-slate-800 text-emerald-300 shadow-sm border border-emerald-500/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>CRM & Docs</span>
            </button>

            {/* 4. 24/7 Autonomous Agent Swarm */}
            <button
              id="tab-swarm"
              onClick={() => setActiveTab('swarm')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'swarm'
                  ? 'bg-slate-800 text-emerald-300 shadow-sm border border-emerald-500/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span>Agent Swarm</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            {/* 5. Customer Workspace (Customer-Facing when authenticated) */}
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

            {/* 4. Staff Administrative Console (ONLY visible to verified staff/admin) */}
            {isStaffAdmin && (
              <div className="relative">
                <button
                  id="tab-admin-console"
                  onClick={() => setShowAdminMenu(!showAdminMenu)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    ['requirements', 'signer', 'architecture', 'sandbox', 'code', 'schema', 'deploy'].includes(activeTab)
                      ? 'bg-rose-950/80 text-rose-300 shadow-sm border border-rose-500/50 ring-1 ring-rose-500/30'
                      : 'text-rose-400/90 hover:text-rose-200 hover:bg-rose-950/30 border border-rose-900/40'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Admin Console</span>
                  <span className="px-1.5 py-0.2 text-[9px] font-mono bg-rose-500/20 text-rose-300 rounded border border-rose-500/30">
                    STAFF
                  </span>
                  <ChevronDown className="w-3 h-3 text-rose-400 ml-0.5" />
                </button>

                {/* Staff Admin Tool Dropdown */}
                {showAdminMenu && (
                  <div 
                    className="absolute left-0 mt-2 w-64 bg-slate-900 border border-rose-900/50 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in duration-150"
                    onClick={() => setShowAdminMenu(false)}
                  >
                    <div className="px-2 py-1 text-[10px] font-mono text-rose-400 uppercase tracking-wider border-b border-slate-800 mb-1 flex items-center justify-between">
                      <span>INTERNAL DEVELOPER CONTROLS</span>
                      <span className="text-[9px] text-slate-500">ADMIN GATE ACTIVE</span>
                    </div>

                    <button
                      onClick={() => setActiveTab('signer')}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                        activeTab === 'signer' ? 'bg-rose-500/10 text-rose-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Key className="w-3.5 h-3.5 text-emerald-400" />
                      <div>
                        <div className="font-semibold">6 Variables Signer</div>
                        <div className="text-[10px] text-slate-400">Manage runtime secrets & leases</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('requirements')}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                        activeTab === 'requirements' ? 'bg-rose-500/10 text-rose-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      <div>
                        <div className="font-semibold">Master Requirements</div>
                        <div className="text-[10px] text-slate-400">Global configuration engine</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('sandbox')}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                        activeTab === 'sandbox' ? 'bg-rose-500/10 text-rose-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Terminal className="w-3.5 h-3.5 text-blue-400" />
                      <div>
                        <div className="font-semibold">Test Simulators</div>
                        <div className="text-[10px] text-slate-400">Webhook replay & ledger balance</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('architecture')}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                        activeTab === 'architecture' ? 'bg-rose-500/10 text-rose-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      <div>
                        <div className="font-semibold">Architecture & Schema</div>
                        <div className="text-[10px] text-slate-400">Async backend & Supabase DDL</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('code')}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                        activeTab === 'code' ? 'bg-rose-500/10 text-rose-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5 text-rose-400" />
                      <div>
                        <div className="font-semibold text-rose-300">Proprietary Codebase</div>
                        <div className="text-[10px] text-rose-400/80">Protected IP source files</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('deploy')}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                        activeTab === 'deploy' ? 'bg-rose-500/10 text-rose-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <CloudLightning className="w-3.5 h-3.5 text-amber-400" />
                      <div>
                        <div className="font-semibold">Deployment Guides</div>
                        <div className="text-[10px] text-slate-400">Render, Docker & CI/CD</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* User Profile / Auth Area */}
          <div className="flex items-center gap-2.5">
            {/* Staff Administrative Gate Access Trigger for non-logged-in staff */}
            {!isStaffAdmin && (
              <button
                onClick={() => setActiveTab('signer')}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 text-xs transition-colors border border-slate-800/80 cursor-pointer"
                title="Staff Administrative Access Gate (Restricted)"
              >
                <Lock className="w-3 h-3 text-slate-500" />
                <span className="text-[11px] font-mono">Staff Gate</span>
              </button>
            )}

            {!currentUser ? (
              <button
                id="btn-nav-signin"
                onClick={onOpenAuth}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center gap-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
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

                    <button
                      onClick={() => setActiveTab('pricing')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2 transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Upgrade / Top-up Plan</span>
                    </button>

                    {currentUser.role === 'admin' && (
                      <>
                        <div className="my-1 border-t border-slate-800" />
                        <button
                          onClick={() => setActiveTab('signer')}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-rose-300 hover:bg-rose-950/40 flex items-center gap-2 transition-colors border border-rose-900/30 my-0.5"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                          <span>Staff Admin Console</span>
                        </button>
                      </>
                    )}

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
