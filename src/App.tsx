/**
 * ApexSovereign.ai - Enterprise Work OS & Autonomous Compute Broker
 * Multi-Tenant Workload Broker, Cryptographic Leases, and PayPal Invoicing
 */

import React, { useState, useEffect } from 'react';
import { Navbar, ActiveNavTab } from './components/Navbar';
import { ArchitectureView } from './components/ArchitectureView';
import { InteractiveSandbox } from './components/InteractiveSandbox';
import { CodeExplorer } from './components/CodeExplorer';
import { SchemaViewer } from './components/SchemaViewer';
import { DeploymentGuide } from './components/DeploymentGuide';
import { VariableSigner } from './components/VariableSigner';
import { PricingPlans, SUBSCRIPTION_TIERS } from './components/PricingPlans';
import { CustomerPortal } from './components/CustomerPortal';
import { AuthModal } from './components/AuthModal';
import { PayPalCheckoutModal } from './components/PayPalCheckoutModal';
import { CustomerUser, SubscriptionTier, PaymentTransaction } from './types';
import { ShieldCheck, Server, Database, Lock, Cpu, Key } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('pricing');
  const [selectedFileForCodeExplorer, setSelectedFileForCodeExplorer] = useState<string>('config_py');

  // Customer User Authentication & Session State
  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(() => {
    try {
      const saved = localStorage.getItem('apex_customer_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Recorded Transactions
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('apex_transactions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedTierForCheckout, setSelectedTierForCheckout] = useState<SubscriptionTier>(SUBSCRIPTION_TIERS[1]);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  // Sync session changes to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('apex_customer_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('apex_customer_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('apex_transactions', JSON.stringify(transactions));
  }, [transactions]);

  const handleLoginSuccess = (user: CustomerUser) => {
    setCurrentUser(user);
    setActiveTab('portal');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('pricing');
  };

  const handleSelectTierForPurchase = (tier: SubscriptionTier, interval: 'monthly' | 'annual') => {
    setSelectedTierForCheckout(tier);
    setBillingInterval(interval);
    setIsCheckoutModalOpen(true);
  };

  const handlePaymentSuccess = (tx: PaymentTransaction) => {
    setTransactions(prev => [tx, ...prev]);

    if (currentUser) {
      const updatedUser: CustomerUser = {
        ...currentUser,
        plan: tx.planId as any,
        computeCredits: currentUser.computeCredits + tx.creditsAwarded,
        maxQuota: currentUser.maxQuota + tx.creditsAwarded,
        subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      setCurrentUser(updatedUser);
    }
  };

  const handleExploreCode = (fileId: string) => {
    setSelectedFileForCodeExplorer(fileId);
    setActiveTab('code');
  };

  const handleOpenSandbox = (mode: string) => {
    setActiveTab('sandbox');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Customer Facing Views */}
        {activeTab === 'pricing' && (
          <PricingPlans
            onSelectTier={handleSelectTierForPurchase}
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {activeTab === 'portal' && (
          currentUser ? (
            <CustomerPortal
              user={currentUser}
              transactions={transactions}
              onOpenPricing={() => setActiveTab('pricing')}
              onUpdateUser={(u) => setCurrentUser(u)}
            />
          ) : (
            <div className="py-16 text-center space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Client Authentication Required</h2>
              <p className="text-xs text-slate-400">
                Sign in to your isolated sovereign tenant partition to view compute quotas, manage API keys, and launch autonomous workloads.
              </p>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md cursor-pointer"
              >
                Sign In to Tenant Workspace
              </button>
            </div>
          )
        )}

        {/* Developer & Operations Console Views */}
        {activeTab === 'signer' && <VariableSigner />}

        {activeTab === 'architecture' && (
          <ArchitectureView
            onExploreCode={handleExploreCode}
            onOpenSandbox={handleOpenSandbox}
          />
        )}

        {activeTab === 'sandbox' && <InteractiveSandbox />}

        {activeTab === 'code' && (
          <CodeExplorer initialFileId={selectedFileForCodeExplorer} />
        )}

        {activeTab === 'schema' && <SchemaViewer />}

        {activeTab === 'deploy' && <DeploymentGuide />}
      </main>

      {/* Global Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <PayPalCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        tier={selectedTierForCheckout}
        billingInterval={billingInterval}
        currentUser={currentUser}
        onPaymentSuccess={handlePaymentSuccess}
        onRequireLogin={() => setIsAuthModalOpen(true)}
      />

      {/* Enterprise Status Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>All Systems Operational</span>
            </span>
            <span className="text-slate-700">•</span>
            <span>FastAPI 0.115</span>
            <span className="text-slate-700">•</span>
            <span>asyncpg 0.29 (Supabase SSL)</span>
            <span className="text-slate-700">•</span>
            <span>PayPal REST v2 Orders & Webhooks</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <button
              onClick={() => setActiveTab('pricing')}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Pricing & Subscriptions
            </button>
            <button
              onClick={() => setActiveTab('signer')}
              className="hover:text-slate-300 transition-colors"
            >
              6 Variables Signer
            </button>
            <button
              onClick={() => setActiveTab('architecture')}
              className="hover:text-slate-300 transition-colors"
            >
              Architecture
            </button>
            <button
              onClick={() => setActiveTab('sandbox')}
              className="hover:text-slate-300 transition-colors"
            >
              Simulators
            </button>
            <button
              onClick={() => setActiveTab('deploy')}
              className="hover:text-slate-300 transition-colors"
            >
              Deploy Guide
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
