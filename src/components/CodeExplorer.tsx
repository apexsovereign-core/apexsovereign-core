import React, { useState } from 'react';
import { 
  FileCode, 
  Folder, 
  Copy, 
  Check, 
  Search, 
  ExternalLink, 
  Layers, 
  FileText,
  Lock,
  Database,
  CreditCard,
  Cpu,
  CloudLightning,
  Globe,
  Server
} from 'lucide-react';
import { CODEBASE_FILES } from '../data/codebase';

interface CodeExplorerProps {
  initialFileId?: string;
}

export const CodeExplorer: React.FC<CodeExplorerProps> = ({ initialFileId = 'config_py' }) => {
  const [selectedFileId, setSelectedFileId] = useState<string>(initialFileId);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const selectedFile = CODEBASE_FILES.find((f) => f.id === selectedFileId) || CODEBASE_FILES[0];

  const filteredFiles = CODEBASE_FILES.filter(
    (file) =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'core':
        return <Lock className="w-3.5 h-3.5 text-emerald-400" />;
      case 'db':
        return <Database className="w-3.5 h-3.5 text-amber-400" />;
      case 'services':
        return <Cpu className="w-3.5 h-3.5 text-purple-400" />;
      case 'api':
        return <CreditCard className="w-3.5 h-3.5 text-blue-400" />;
      case 'infra':
        return <CloudLightning className="w-3.5 h-3.5 text-indigo-400" />;
      case 'frontend':
        return <Globe className="w-3.5 h-3.5 text-cyan-400" />;
      case 'backend':
        return <Server className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <FileCode className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div id="code-explorer" className="space-y-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <FileCode className="w-4 h-4 text-indigo-400" />
            <span>ApexSovereign.ai Production Codebase Browser</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Explore the complete, fully-typed Python modules, database schemas, and deployment configurations.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search files or modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl min-h-[580px]">
        {/* Left Sidebar: File Tree Navigation */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950/60 p-4 space-y-2">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider px-2 py-1">
            Engineered Files ({filteredFiles.length})
          </div>

          <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
            {filteredFiles.map((file) => {
              const isSelected = file.id === selectedFile.id;
              return (
                <button
                  key={file.id}
                  onClick={() => setSelectedFileId(file.id)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-start gap-2.5 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 text-white font-medium shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{getCategoryIcon(file.category)}</div>
                  <div className="overflow-hidden">
                    <div className="truncate font-mono text-slate-200">{file.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{file.path}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Area: Code Viewer */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-slate-950 p-4 sm:p-6 overflow-hidden">
          {/* File Meta Header */}
          <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {selectedFile.language.toUpperCase()}
                </span>
                <span className="text-xs font-mono text-slate-400">{selectedFile.path}</span>
              </div>
              <h3 className="text-sm font-semibold text-white mt-1.5">{selectedFile.description}</h3>
            </div>

            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer self-start sm:self-auto shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Key Features Callout */}
          <div className="py-3 px-3.5 my-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block mb-1">
              Architectural & Security Highlights:
            </span>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-300">
              {selectedFile.keyFeatures.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold shrink-0">•</span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Code Viewer */}
          <div className="relative flex-1 rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden">
            <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-slate-200 h-[360px] overflow-y-auto">
              <code>{selectedFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
