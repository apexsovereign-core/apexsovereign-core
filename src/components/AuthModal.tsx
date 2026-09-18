import React, { useState } from 'react';
import { CustomerUser } from '../types';
import { 
  X, 
  Lock, 
  Mail, 
  Building2, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  CheckCircle2,
  KeyRound
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: CustomerUser) => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialMode = 'signin'
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('enterprise@apexsovereign.ai');
  const [password, setPassword] = useState('••••••••••••');
  const [fullName, setFullName] = useState('Sovereign Client');
  const [company, setCompany] = useState('Apex Autonomous Fund');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Simulate cryptographic tenant provisioning
    setTimeout(() => {
      setLoading(false);
      const generatedTenantId = 'tenant-' + Math.random().toString(36).substring(2, 10);
      const generatedApiKey = 'sk_live_' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

      const user: CustomerUser = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        email: email || 'client@apexsovereign.ai',
        fullName: mode === 'signup' ? fullName : (email.includes('enterprise') ? 'Enterprise Executive' : 'Autonomous Client'),
        company: mode === 'signup' ? company : 'Apex Sovereign Enterprise LLC',
        tenantId: generatedTenantId,
        role: 'customer',
        plan: 'pro',
        computeCredits: 25000,
        maxQuota: 50000,
        apiKey: generatedApiKey,
        createdAt: new Date().toISOString(),
        subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      onLoginSuccess(user);
      onClose();
    }, 600);
  };

  const handleQuickDemoLogin = (tier: 'starter' | 'pro' | 'enterprise') => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const creditsMap = { starter: 2500, pro: 25000, enterprise: 150000 };
      const quotaMap = { starter: 5000, pro: 50000, enterprise: 300000 };

      const user: CustomerUser = {
        id: 'usr_demo_' + tier,
        email: `client.${tier}@apexsovereign.ai`,
        fullName: tier === 'enterprise' ? 'Elena Vance (Chief Architect)' : 'Marcus Chen (Lead Quant)',
        company: tier === 'enterprise' ? 'Blackstone Quantum Corp' : 'Autonomous Research Labs',
        tenantId: `tenant-${tier}-node01`,
        role: 'customer',
        plan: tier,
        computeCredits: creditsMap[tier],
        maxQuota: quotaMap[tier],
        apiKey: `sk_live_apex_${tier}_` + Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        createdAt: new Date().toISOString(),
        subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      onLoginSuccess(user);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow effect */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-lg">
            AS
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {mode === 'signin' ? 'Sign In to Sovereign Work OS' : 'Create Sovereign Tenant'}
            </h2>
            <p className="text-xs text-slate-400">
              {mode === 'signin' 
                ? 'Access your compute broker quota & workloads' 
                : 'Instant isolated partition on asyncpg pooler'}
            </p>
          </div>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/70 border border-slate-800 rounded-xl mb-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`py-2 rounded-lg transition-all ${
              mode === 'signin'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Client Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`py-2 rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            New Tenant Registration
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <X className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">FULL NAME</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/50 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">ORGANIZATION / COMPANY</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Autonomous Hedge Corp"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/50 font-sans"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">WORK EMAIL</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/50 font-sans"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-mono text-slate-400">PASSWORD</label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => alert('Password reset link sent to your registered enterprise email.')}
                  className="text-[11px] text-emerald-400 hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/50 font-sans"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2 mt-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{mode === 'signin' ? 'Authenticate & Enter' : 'Initialize Isolated Tenant'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* One-Click Demo Logins for Instant Testing */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>INSTANT ONE-CLICK TEST LOGINS</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('pro')}
              className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group"
            >
              <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300">
                Autonomous Pro
              </div>
              <div className="text-[10px] text-slate-500">
                25,000 Compute Credits
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemoLogin('enterprise')}
              className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-purple-500/40 text-left transition-all group"
            >
              <div className="text-xs font-semibold text-slate-200 group-hover:text-purple-300">
                Enterprise Sovereign
              </div>
              <div className="text-[10px] text-slate-500">
                150,000 Compute Credits
              </div>
            </button>
          </div>
        </div>

        {/* Security Stamp */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>PostgreSQL RLS & HMAC-SHA256 Token Protection</span>
        </div>
      </div>
    </div>
  );
};
