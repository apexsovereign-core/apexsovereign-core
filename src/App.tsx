/**
 * ApexSovereign.ai - Principal Systems Architecture Console & Operations Control
 * Multi-Tenant Enterprise Work OS & Autonomous Compute Broker
 */

import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { ArchitectureView } from './components/ArchitectureView';
import { InteractiveSandbox } from './components/InteractiveSandbox';
import { CodeExplorer } from './components/CodeExplorer';
import { SchemaViewer } from './components/SchemaViewer';
import { DeploymentGuide } from './components/DeploymentGuide';
import { VariableSigner } from './components/VariableSigner';
import { ShieldCheck, Server, Database, Lock, Cpu, Key } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'architecture' | 'sandbox' | 'code' | 'schema' | 'deploy' | 'signer'>('signer');
  const [selectedFileForCodeExplorer, setSelectedFileForCodeExplorer] = useState<string>('config_py');

  const handleExploreCode = (fileId: string) => {
    setSelectedFileForCodeExplorer(fileId);
    setActiveTab('code');
  };

  const handleOpenSandbox = (mode: string) => {
    setActiveTab('sandbox');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {activeTab === 'architecture' && (
          <ArchitectureView
            onExploreCode={handleExploreCode}
            onOpenSandbox={handleOpenSandbox}
          />
        )}

        {activeTab === 'sandbox' && <InteractiveSandbox />}

        {activeTab === 'signer' && <VariableSigner />}

        {activeTab === 'code' && (
          <CodeExplorer initialFileId={selectedFileForCodeExplorer} />
        )}

        {activeTab === 'schema' && <SchemaViewer />}

        {activeTab === 'deploy' && <DeploymentGuide />}
      </main>

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
            <span>PayPal v2 REST</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
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
              onClick={() => setActiveTab('signer')}
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
            >
              6 Variables Signer
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className="hover:text-slate-300 transition-colors"
            >
              Python Codebase
            </button>
            <button
              onClick={() => setActiveTab('deploy')}
              className="hover:text-slate-300 transition-colors"
            >
              Render Blueprint
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
