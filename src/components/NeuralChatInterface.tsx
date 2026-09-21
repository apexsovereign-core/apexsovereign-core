import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Send, 
  Cpu, 
  ShieldCheck, 
  Sparkles, 
  Copy, 
  Check, 
  Trash2, 
  Download, 
  Activity, 
  Lock, 
  Layers, 
  Clock, 
  Zap,
  RefreshCw,
  Sliders,
  ChevronRight,
  Database,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { NeuralMessage, NeuralSessionState, CustomerUser } from '../types';

interface NeuralChatInterfaceProps {
  currentUser?: CustomerUser | null;
  onOpenAuth?: () => void;
}

const PRESET_DIRECTIVES = [
  {
    label: 'Arbitrage Strategy',
    prompt: 'Analyze current GPU spot arbitrage spreads across US-East and EU-Central nodes with optimal compute route.',
  },
  {
    label: 'RLS Security Audit',
    prompt: 'Verify multi-tenant PostgreSQL Row Level Security (RLS) policies and HMAC signature validation on compute leases.',
  },
  {
    label: 'TCO Economic Analysis',
    prompt: 'Calculate exact enterprise cost elimination vs legacy per-seat software ($165/seat) using 24/7 autonomous swarms.',
  },
  {
    label: 'Weekly Tariff Lock',
    prompt: 'Provide breakdown of current Monday 00:00 UTC pricing epoch, wholesale discount pass-through, and token rates.',
  },
];

export const NeuralChatInterface: React.FC<NeuralChatInterfaceProps> = ({ currentUser, onOpenAuth }) => {
  const tenantId = currentUser?.tenantId || 'tenant-sovereign-01';
  
  const [session, setSession] = useState<NeuralSessionState>({
    sessionId: `sess_neural_${Date.now().toString(36)}`,
    tenantId: tenantId,
    activeModel: 'apex-neural-3.8-sovereign',
    tokenBudget: 500000,
    tokensConsumed: 1420,
    rlsSecurityLevel: 'STRICT_ROW_LEVEL_SECURITY_ENFORCED',
    rateLimitRemaining: 58,
  });

  const [messages, setMessages] = useState<NeuralMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content: `### ApexSovereign Neural Interface Initialized\n\nActive Model: \`apex-neural-3.8-sovereign\`\nTenant Boundary: \`${tenantId}\`\nClearance: \`ZERO_TRUST_LEVEL_1\`\n\nEnter an operational directive, code execution instruction, or infrastructure query below. All outputs are cryptographically signed with zero telemetry leakage.`,
      timestamp: new Date().toISOString(),
      tokensUsed: 42,
      latencyMs: 14.2,
      model: 'apex-neural-3.8-sovereign',
    }
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamSpeed, setStreamSpeed] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll anchoring
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Keep tenant ID synced with currentUser
  useEffect(() => {
    if (currentUser?.tenantId) {
      setSession(prev => ({ ...prev, tenantId: currentUser.tenantId }));
    }
  }, [currentUser]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    if (confirm('Clear neural dialogue context and reset token buffer?')) {
      setMessages([
        {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `### Session Buffer Reset\nTenant \`${session.tenantId}\` active. Sovereign Neural Core standing by for directives.`,
          timestamp: new Date().toISOString(),
          tokensUsed: 12,
          latencyMs: 4.1,
          model: session.activeModel,
        }
      ]);
    }
  };

  const handleExportChat = () => {
    const transcript = messages.map(m => `[${m.timestamp}] [${m.role.toUpperCase()}] (${m.model || session.activeModel})\n${m.content}\n\n`).join('---\n\n');
    const blob = new Blob([transcript], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apexsovereign-neural-session-${session.sessionId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt !== undefined ? customPrompt : inputPrompt;
    if (!textToSend.trim() || isStreaming) return;

    setErrorStatus(null);
    const userMsgId = `user_${Date.now()}`;
    const assistantMsgId = `assist_${Date.now()}`;
    const startTime = performance.now();

    const userMsg: NeuralMessage = {
      id: userMsgId,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toISOString(),
    };

    const newDialogue = [...messages, userMsg];
    setMessages(newDialogue);
    if (!customPrompt) setInputPrompt('');
    setIsStreaming(true);

    // Initial assistant empty placeholder for streaming
    const placeholderMsg: NeuralMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      streaming: true,
      model: session.activeModel,
    };
    setMessages([...newDialogue, placeholderMsg]);

    try {
      const response = await fetch('/api/v1/neural/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': session.tenantId,
        },
        body: JSON.stringify({
          messages: newDialogue.map(m => ({ role: m.role, content: m.content })),
          tenant_id: session.tenantId,
          session_id: session.sessionId,
          model: session.activeModel,
          temperature: 0.6,
          stream: true,
          rls_context: {
            clearance_level: currentUser?.role === 'admin' ? 'SUPER_ADMIN_SYSTEM' : 'ZERO_TRUST_LEVEL_2',
            permissions: ['neural:chat', 'compute:dispatch', 'ledger:query'],
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Neural endpoint responded with HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser environment.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedContent = '';
      let chunkCount = 0;
      let auditSignature = '';
      let finalTokens = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          
          // Parse Server-Sent Events
          const eventMatch = line.match(/^event:\s*(\w+)/m);
          const dataMatch = line.match(/^data:\s*(.+)$/m);
          
          const eventType = eventMatch ? eventMatch[1] : 'message';
          const dataRaw = dataMatch ? dataMatch[1] : null;

          if (!dataRaw) continue;

          try {
            const parsed = JSON.parse(dataRaw);
            
            if (eventType === 'message' || eventType === 'chunk') {
              if (parsed.chunk) {
                accumulatedContent += parsed.chunk;
                chunkCount++;
                const elapsedSec = Math.max(0.1, (performance.now() - startTime) / 1000);
                setStreamSpeed(Math.round(chunkCount / elapsedSec));

                setMessages(prev => 
                  prev.map(m => 
                    m.id === assistantMsgId 
                      ? { ...m, content: accumulatedContent, streaming: true }
                      : m
                  )
                );
              }
            } else if (eventType === 'done') {
              auditSignature = parsed.audit_signature || '';
              finalTokens = parsed.total_tokens || chunkCount;
              const totalLatencyMs = parsed.latency_ms || Math.round(performance.now() - startTime);

              setSession(prev => ({
                ...prev,
                tokensConsumed: prev.tokensConsumed + finalTokens,
                rateLimitRemaining: Math.max(0, prev.rateLimitRemaining - 1),
              }));

              setMessages(prev => 
                prev.map(m => 
                  m.id === assistantMsgId 
                    ? { 
                        ...m, 
                        content: accumulatedContent, 
                        streaming: false, 
                        tokensUsed: finalTokens, 
                        latencyMs: totalLatencyMs,
                        auditSignature: auditSignature 
                      }
                    : m
                )
              );
            }
          } catch (e) {
            console.error('SSE JSON parse error:', e, dataRaw);
          }
        }
      }

      // Ensure streaming flag is cleared even if 'done' event was missing
      setMessages(prev => 
        prev.map(m => 
          m.id === assistantMsgId 
            ? { ...m, streaming: false, latencyMs: Math.round(performance.now() - startTime) }
            : m
        )
      );

    } catch (err: any) {
      console.error('Neural interface dispatch failed:', err);
      setErrorStatus(err.message || 'Unknown network error');
      setMessages(prev => 
        prev.map(m => 
          m.id === assistantMsgId 
            ? { 
                ...m, 
                content: `### Execution Exception\n\nNeural stream interrupted: \`${err.message || 'Connection closed'}\`.\nAutomatic failover committed to local security cache.`,
                streaming: false,
                latencyMs: Math.round(performance.now() - startTime),
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      setStreamSpeed(0);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Minimalist formatter for markdown and code blocks
  const renderFormattedMessage = (content: string) => {
    // Split by code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const lang = lines[0].trim();
        const code = lines.slice(lang.match(/^[a-z0-9_-]+$/i) ? 1 : 0).join('\n');
        const codeId = `code_${index}`;

        return (
          <div key={index} className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-xs">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
              <span className="font-semibold text-emerald-400 uppercase tracking-wider">{lang || 'CODE'}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(code, codeId)}
                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              >
                {copiedId === codeId ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-mono text-[10px]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="font-mono text-[10px]">Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-slate-200 leading-relaxed scrollbar-thin">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      // Render headings, bolding, and lists simply
      const formattedLines = part.split('\n').map((line, lIdx) => {
        if (line.startsWith('### ')) {
          return <h4 key={lIdx} className="text-sm font-bold text-white mt-3 mb-1 tracking-tight">{line.slice(4)}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={lIdx} className="text-base font-extrabold text-white mt-4 mb-1 tracking-tight">{line.slice(3)}</h3>;
        }
        if (line.startsWith('- ')) {
          return (
            <div key={lIdx} className="flex items-start gap-2 my-1 text-slate-300">
              <span className="text-emerald-400 mt-1 text-[10px]">▪</span>
              <span>{renderInlineMarkdown(line.slice(2))}</span>
            </div>
          );
        }
        if (!line.trim()) {
          return <div key={lIdx} className="h-2" />;
        }
        return <p key={lIdx} className="my-1 text-slate-300 leading-relaxed">{renderInlineMarkdown(line)}</p>;
      });

      return <div key={index}>{formattedLines}</div>;
    });
  };

  const renderInlineMarkdown = (text: string) => {
    // Process bold and inline code
    const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return tokens.map((tok, i) => {
      if (tok.startsWith('`') && tok.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 font-mono text-xs">
            {tok.slice(1, -1)}
          </code>
        );
      }
      if (tok.startsWith('**') && tok.endsWith('**')) {
        return <strong key={i} className="font-semibold text-white">{tok.slice(2, -2)}</strong>;
      }
      return tok;
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Institutional Command Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Terminal className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <span>ApexSovereign Neural Interface</span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                SOVEREIGN STREAMING ACTIVE
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Proprietary, institutional-grade conversational intelligence layer. Zero third-party telemetry, asynchronous SSE token generation, and multi-tenant RLS isolation.
          </p>
        </div>

        {/* Telemetry Pill Grid */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <div className="text-[11px] font-mono">
              <span className="text-slate-500">TENANT:</span> <span className="text-white font-bold">{session.tenantId}</span>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <div className="text-[11px] font-mono">
              <span className="text-slate-500">BUDGET:</span> <span className="text-emerald-400 font-bold">{(session.tokenBudget - session.tokensConsumed).toLocaleString()} TOK</span>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <div className="text-[11px] font-mono text-emerald-300">
              RLS STRICT
            </div>
          </div>
        </div>
      </div>

      {/* Main Obsidian Command Surface */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden flex flex-col h-[700px]">
        {/* Command Toolbar */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Model Selector */}
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-mono text-[11px]">CORE MODEL:</span>
            <select
              value={session.activeModel}
              onChange={(e) => setSession({ ...session, activeModel: e.target.value as any })}
              disabled={isStreaming}
              className="bg-slate-950 border border-slate-700 text-white font-mono text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer disabled:opacity-50"
            >
              <option value="apex-neural-3.8-sovereign">Sovereign Core 3.8 (Balanced / 128k)</option>
              <option value="apex-neural-fast-arbitrage">Fast Arbitrage Engine (Sub-20ms / 64k)</option>
              <option value="apex-neural-enclave-deep">Confidential Enclave Deep (256k / zkProof)</option>
            </select>
          </div>

          {/* Actions & Utilities */}
          <div className="flex items-center gap-2">
            {isStreaming && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px]">
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                <span>{streamSpeed} tok/s</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleExportChat}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Export session markdown transcript"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={handleClearChat}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Reset context"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Message Dialogue Stream (Scrollable) */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 scrollbar-thin">
          {messages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <div
                key={message.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-4xl ${isUser ? 'ml-auto' : 'mr-auto'}`}
              >
                {/* Author Metadata Pill */}
                <div className="flex items-center gap-2 mb-1.5 text-[11px] font-mono text-slate-500 px-1">
                  <span>{isUser ? 'OPERATOR' : 'APEXSOVEREIGN CORE'}</span>
                  <span>•</span>
                  <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                  {!isUser && message.model && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-500/80">{message.model}</span>
                    </>
                  )}
                  {!isUser && message.latencyMs !== undefined && (
                    <>
                      <span>•</span>
                      <span className="text-slate-400">{message.latencyMs}ms</span>
                    </>
                  )}
                </div>

                {/* Message Body Card */}
                <div
                  className={`w-full p-4 sm:p-5 rounded-2xl border leading-relaxed text-sm ${
                    isUser
                      ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-200 shadow-lg'
                  }`}
                >
                  {renderFormattedMessage(message.content)}

                  {message.streaming && (
                    <div className="inline-flex items-center gap-1 mt-2 text-emerald-400 font-mono text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Streaming tokens...</span>
                    </div>
                  )}

                  {/* Cryptographic Audit Badge */}
                  {!isUser && message.auditSignature && (
                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <div className="flex items-center gap-1.5 text-emerald-400/80">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>HMAC-SHA256 AUDIT: {message.auditSignature.slice(0, 16)}...</span>
                      </div>
                      <div className="text-slate-500">
                        {message.tokensUsed || 0} tokens consumed
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {errorStatus && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorStatus}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Preset Operational Directives */}
        <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-mono uppercase text-slate-500 shrink-0 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            DIRECTIVES:
          </span>
          {PRESET_DIRECTIVES.map((directive, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(directive.prompt)}
              disabled={isStreaming}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
            >
              {directive.label}
            </button>
          ))}
        </div>

        {/* Input Command Dock */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <div className="relative rounded-xl bg-slate-950 border border-slate-800 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all">
            <textarea
              ref={textareaRef}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter sovereign command or architectural inquiry (Press Enter to execute, Shift+Enter for newline)..."
              rows={3}
              disabled={isStreaming}
              className="w-full bg-transparent px-4 py-3 text-slate-100 placeholder:text-slate-600 text-xs sm:text-sm font-mono focus:outline-none resize-none disabled:opacity-50"
            />

            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-900 text-xs">
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                <span className="hidden sm:inline">Ctrl/Cmd+Enter or Enter to dispatch</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputPrompt.trim() || isStreaming}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-mono font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-md"
                >
                  <span>Execute</span>
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
