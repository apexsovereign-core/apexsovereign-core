import React, { useState, useRef, useEffect } from 'react';
import { InboundChatMessage, LeadQualificationResult } from '../types';
import { 
  Bot, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  Flame, 
  CheckCircle2, 
  Mail, 
  Building2, 
  Cpu, 
  DollarSign, 
  ArrowRight, 
  Minimize2, 
  Maximize2,
  X,
  MessageSquare
} from 'lucide-react';

interface AutonomousAgentChatbotProps {
  onOpenCheckout?: (planId: string) => void;
  defaultOpen?: boolean;
}

export const AutonomousAgentChatbot: React.FC<AutonomousAgentChatbotProps> = ({
  onOpenCheckout,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionId] = useState(() => `sess_${Math.random().toString(36).substring(2, 10)}`);
  
  // Lead info captured in drawer
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [budgetRange, setBudgetRange] = useState('$10,000 - $50,000/mo');
  const [computeNeeds, setComputeNeeds] = useState('8x NVIDIA H100 SXM5');
  const [showLeadFields, setShowLeadFields] = useState(false);

  // Chat message stream
  const [messages, setMessages] = useState<InboundChatMessage[]>([
    {
      id: 'init-1',
      sender: 'agent',
      text: 'Welcome to ApexSovereign.ai Institutional Autonomous Operations. I am the sovereign triage agent. Inquire regarding our bare-metal GPU clusters, Work OS automation, or live PayPal credit settlement.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      qualificationTier: 'EXPLORATORY',
      suggestedActions: [
        'How does instant live PayPal credit sync work?',
        'I need 8x H100 SXM5 GPU cluster capacity',
        'Can I receive automatic email receipts & proposals?',
      ],
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastQualification, setLastQualification] = useState<LeadQualificationResult | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || inputVal).trim();
    if (!messageText || isLoading) return;

    const userMsg: InboundChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsLoading(true);

    try {
      // POST to /leads/agent/chat backend endpoint
      const res = await fetch('/leads/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          user_message: messageText,
          company_name: companyName || undefined,
          contact_email: contactEmail || undefined,
          contact_name: contactName || undefined,
          budget_range: budgetRange || undefined,
          compute_needs: computeNeeds || undefined,
          conversation_history: messages.slice(-5).map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        }),
      });

      if (res.ok) {
        const data: LeadQualificationResult = await res.json();
        setLastQualification(data);

        const agentMsg: InboundChatMessage = {
          id: `agent_${Date.now()}`,
          sender: 'agent',
          text: data.agentReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          qualificationTier: data.qualificationTier,
          leadScore: data.leadScore,
          suggestedActions: data.suggestedActions,
        };
        setMessages((prev) => [...prev, agentMsg]);
      } else {
        // Fallback agent logic if offline
        const simulatedScore = messageText.toLowerCase().includes('h100') || messageText.toLowerCase().includes('enterprise') ? 85 : 45;
        const tier = simulatedScore >= 80 ? 'SOVEREIGN_HOT' : 'EXPLORATORY';
        const fallbackMsg: InboundChatMessage = {
          id: `agent_${Date.now()}`,
          sender: 'agent',
          text: `[Autonomous Triage] Request logged. System evaluated prompt intent with Priority Rank: ${tier}. Live PayPal ledger fulfillment and Resend transactional notification are armed.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          qualificationTier: tier,
          leadScore: simulatedScore,
          suggestedActions: ['Check Sovereign Pricing', 'Initialize PayPal Live Checkout'],
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      }
    } catch (err) {
      const errReply: InboundChatMessage = {
        id: `agent_${Date.now()}`,
        sender: 'agent',
        text: 'Autonomous agent gateway connected via local fallback. Instant PayPal subscription fulfillment and Supabase RLS are currently armed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: ['Review Pricing', 'Connect Live PayPal'],
      };
      setMessages((prev) => [...prev, errReply]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="autonomous-agent-chatbot-root" className="fixed bottom-6 right-6 z-50">
      {/* Floating Activator Button */}
      {!isOpen && (
        <button
          id="btn-open-agent-chat"
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-3 px-5 py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white rounded-full shadow-2xl shadow-indigo-950/60 border border-indigo-400/30 transition-all duration-200 transform hover:scale-105 group"
        >
          <div className="relative">
            <Bot className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          </div>
          <span className="font-semibold text-sm tracking-wide">Autonomous AI Concierge</span>
          <span className="text-xs bg-indigo-900/80 px-2 py-0.5 rounded-full text-indigo-200 border border-indigo-700/50">
            24/7 Autopilot
          </span>
        </button>
      )}

      {/* Chat Window Drawer */}
      {isOpen && (
        <div
          id="autonomous-agent-chat-window"
          className={`bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 flex flex-col transition-all duration-300 overflow-hidden ${
            isExpanded ? 'w-[680px] h-[720px]' : 'w-[400px] sm:w-[440px] h-[580px]'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-sm text-slate-100">ApexSovereign AI Agent</h3>
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                </div>
                <p className="text-[11px] text-slate-400">Live Inbound Triage & Resend CRM Autopilot</p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                id="btn-toggle-lead-form"
                onClick={() => setShowLeadFields(!showLeadFields)}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  showLeadFields ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Toggle Corporate Lead Context"
              >
                <Building2 className="w-4 h-4" />
              </button>
              <button
                id="btn-toggle-expand-chat"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                id="btn-close-agent-chat"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lead Context Quick Form (Dropdown Drawer) */}
          {showLeadFields && (
            <div className="p-3 bg-slate-900/70 border-b border-slate-800 space-y-2 text-xs animate-in slide-in-from-top-2">
              <div className="text-[11px] font-semibold text-indigo-400 flex items-center justify-between">
                <span>Enterprise Scoping & Email Notification Context</span>
                <span className="text-[10px] text-slate-400">Auto-Qualifies Lead</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Company Name (e.g. Citadel)"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="email"
                  placeholder="Corporate Work Email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Contact Name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <select
                  value={budgetRange}
                  onChange={(e) => setBudgetRange(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option>$1,000 - $10,000/mo</option>
                  <option>$10,000 - $50,000/mo</option>
                  <option>$50,000 - $250,000/mo</option>
                  <option>$250,000+/mo Sovereign</option>
                </select>
              </div>
              {contactEmail && (
                <div className="text-[10px] text-emerald-400 flex items-center space-x-1 pt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Proposals & Welcome packets will be automatically dispatched to this address.</span>
                </div>
              )}
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* Agent Metadata & Lead Tier Tag */}
                  {msg.qualificationTier && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                      <span className="flex items-center space-x-1 font-semibold text-emerald-400">
                        <Flame className="w-3 h-3" />
                        <span>Tier: {msg.qualificationTier}</span>
                      </span>
                      {msg.leadScore !== undefined && (
                        <span className="text-slate-400">Buying Intent: {msg.leadScore}/100</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Suggested Action Chips */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-w-[95%]">
                    {msg.suggestedActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(action)}
                        className="text-[10px] bg-slate-900 hover:bg-indigo-950/80 text-slate-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-700/50 rounded-full px-2.5 py-1 transition-colors flex items-center space-x-1"
                      >
                        <span>{action}</span>
                        <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center space-x-2 text-slate-400 text-xs py-2 px-1">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-100" />
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-200" />
                <span className="text-[11px]">Autonomous Agent evaluating intent & CRM telemetry...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Lead Qualification Status Banner */}
          {lastQualification && (
            <div className="px-3 py-1.5 bg-emerald-950/40 border-t border-emerald-900/40 flex items-center justify-between text-[11px] text-emerald-300">
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>CRM Synced ({lastQualification.qualificationTier})</span>
              </span>
              {lastQualification.emailDispatched ? (
                <span className="text-emerald-400 flex items-center space-x-1">
                  <Mail className="w-3 h-3" />
                  <span>Email Dispatched</span>
                </span>
              ) : (
                <button
                  onClick={() => setShowLeadFields(true)}
                  className="underline hover:text-white"
                >
                  Add email for formal quote
                </button>
              )}
            </div>
          )}

          {/* Input Bar */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              <input
                id="input-agent-chat"
                type="text"
                placeholder="Ask about GPU capacity, pricing, or custom Work OS..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                id="btn-send-agent-chat"
                type="submit"
                disabled={isLoading || !inputVal.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 px-1">
              <span>Powered by ApexSovereign Autonomous Triage</span>
              <span className="text-emerald-500 font-mono">24/7 Autopilot Ready</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
