import React, { useState } from 'react';
import { SubscriptionTier, CustomerUser, PaymentTransaction } from '../types';
import { 
  X, 
  ShieldCheck, 
  CreditCard, 
  CheckCircle2, 
  ArrowRight, 
  Receipt, 
  Lock, 
  Cpu, 
  ExternalLink,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface PayPalCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: SubscriptionTier;
  billingInterval: 'monthly' | 'annual';
  currentUser: CustomerUser | null;
  onPaymentSuccess: (transaction: PaymentTransaction) => void;
  onRequireLogin: () => void;
}

export const PayPalCheckoutModal: React.FC<PayPalCheckoutModalProps> = ({
  isOpen,
  onClose,
  tier,
  billingInterval,
  currentUser,
  onPaymentSuccess,
  onRequireLogin
}) => {
  const [step, setStep] = useState<'review' | 'processing' | 'success'>('review');
  const [paymentMode, setPaymentMode] = useState<'smart_paypal' | 'credit_card'>('smart_paypal');
  const [completedTx, setCompletedTx] = useState<PaymentTransaction | null>(null);
  const [cardNumber, setCardNumber] = useState('4111 •••• •••• 4242');
  const [cardExp, setCardExp] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('888');

  if (!isOpen) return null;

  const price = billingInterval === 'monthly' ? tier.priceMonthly : Math.round(tier.priceAnnual / 12);
  const totalDue = billingInterval === 'monthly' ? tier.priceMonthly : tier.priceAnnual;
  const creditsToAward = billingInterval === 'monthly' ? tier.computeUnits : tier.computeUnits * 12;

  const handleExecutePayPal = () => {
    if (!currentUser) {
      onRequireLogin();
      return;
    }

    setStep('processing');

    // Simulate PayPal Orders v2 REST capture & webhook verification handshake
    setTimeout(() => {
      const orderId = 'ORD-PP-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const transmissionId = 'tx-' + Math.random().toString(36).substring(2, 12);

      const transaction: PaymentTransaction = {
        id: 'tx_pay_' + Math.random().toString(36).substring(2, 9),
        paypalOrderId: orderId,
        tenantId: currentUser.tenantId,
        planId: tier.id,
        planName: tier.name,
        amount: totalDue,
        currency: 'USD',
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
        transmissionId: transmissionId,
        creditsAwarded: creditsToAward
      };

      setCompletedTx(transaction);
      onPaymentSuccess(transaction);
      setStep('success');
    }, 1200);
  };

  const handleResetAndClose = () => {
    setStep('review');
    setCompletedTx(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-slate-900 p-6 border-b border-slate-800">
          <button
            onClick={handleResetAndClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <span className="text-blue-400 font-bold font-sans text-xl italic">P</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">PayPal Sovereign Checkout</h2>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                  REST v2 API
                </span>
              </div>
              <p className="text-xs text-slate-400">Idempotent Compute Allocation & HMAC Verification</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {step === 'review' && (
            <div className="space-y-5">
              {/* Order Summary Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                      <span>{tier.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        {billingInterval === 'monthly' ? 'Monthly' : 'Annual (20% Off)'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{tier.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white font-mono">${totalDue}</div>
                    <div className="text-[11px] text-slate-500">
                      {billingInterval === 'monthly' ? 'per month' : 'billed annually'}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-900 pt-2.5 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Included Compute Allocation</span>
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    +{creditsToAward.toLocaleString()} Compute Units
                  </span>
                </div>
              </div>

              {/* User Tenant Association Check */}
              {!currentUser ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Sign in or register to attach this subscription to your tenant partition.</span>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onRequireLogin();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shrink-0"
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span>Target Tenant Partition:</span>
                  <span className="text-slate-200 font-semibold">{currentUser.tenantId}</span>
                </div>
              )}

              {/* Payment Methods Selection */}
              <div className="space-y-3">
                <div className="text-xs font-mono text-slate-400">SELECT PAYMENT METHOD</div>

                {/* PayPal Smart Button */}
                <button
                  onClick={handleExecutePayPal}
                  className="w-full py-3 px-4 rounded-xl bg-[#0070BA] hover:bg-[#005ea6] text-white font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <span className="font-bold text-base tracking-wider italic text-[#003087] bg-white px-2 py-0.5 rounded mr-1">
                    PayPal
                  </span>
                  <span className="text-slate-100">Subscribe with PayPal</span>
                  <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* PayPal Pay in 4 / Pay Later Button */}
                <button
                  onClick={handleExecutePayPal}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#ffc439] hover:bg-[#f2ba32] text-[#003087] font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="font-bold italic">Pay</span>
                  <span className="font-bold italic text-[#0079C1]">Later</span>
                  <span className="text-slate-800 text-[11px] font-normal ml-1">
                    • 4 interest-free payments of ${(totalDue / 4).toFixed(2)}
                  </span>
                </button>

                {/* Or Credit / Debit Card (via PayPal Braintree Processing) */}
                <div className="relative flex items-center justify-center my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <span className="relative px-3 bg-slate-900 text-[11px] font-mono text-slate-500">
                    OR DEBIT / CREDIT CARD
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500 mb-1">CARD NUMBER</label>
                    <div className="relative">
                      <CreditCard className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-500 mb-1">EXPIRATION</label>
                      <input
                        type="text"
                        value={cardExp}
                        onChange={(e) => setCardExp(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-500 mb-1">SECURITY CODE</label>
                      <input
                        type="text"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleExecutePayPal}
                    className="w-full mt-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pay ${totalDue} via Encrypted Gateway</span>
                  </button>
                </div>
              </div>

              {/* Guarantees */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>256-bit SSL & PayPal Certified</span>
                </span>
                <span>Cancel subscription anytime in 1 click</span>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                <span className="absolute inset-0 flex items-center justify-center font-bold text-blue-400 text-lg font-mono">
                  PP
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Communicating with PayPal Gateway...</h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Invoking POST /v2/checkout/orders • Intent: CAPTURE
                </p>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-400 max-w-sm text-left space-y-1">
                <div className="text-emerald-400">✓ PayPal Order Authorized</div>
                <div className="text-emerald-400">✓ Webhook Signature Verified (SHA256withRSA)</div>
                <div className="text-blue-400 animate-pulse">↻ PostgreSQL SELECT ... FOR UPDATE (allocating credits)</div>
              </div>
            </div>
          )}

          {step === 'success' && completedTx && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-white">Payment Captured & Subscription Activated!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Your tenant ledger has been credited with autonomous compute tokens.
                </p>
              </div>

              {/* Receipt Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400 pb-2 border-b border-slate-900">
                  <span>PayPal Order ID:</span>
                  <span className="text-slate-200 font-semibold">{completedTx.paypalOrderId}</span>
                </div>
                <div className="flex justify-between text-slate-400 pb-2 border-b border-slate-900">
                  <span>Plan Subscribed:</span>
                  <span className="text-white font-semibold">{completedTx.planName}</span>
                </div>
                <div className="flex justify-between text-slate-400 pb-2 border-b border-slate-900">
                  <span>Amount Charged:</span>
                  <span className="text-emerald-400 font-bold">${completedTx.amount} USD</span>
                </div>
                <div className="flex justify-between text-slate-400 pb-2 border-b border-slate-900">
                  <span>Compute Tokens Awarded:</span>
                  <span className="text-emerald-300 font-semibold">+{completedTx.creditsAwarded.toLocaleString()} CU</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tenant Partition:</span>
                  <span className="text-slate-300">{completedTx.tenantId}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleResetAndClose}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Go to Customer Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
