import React from 'react';
import Link from 'next/link';

export const Navbar: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#00F0FF]/20 bg-[#080D16]/85 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Permanent Cyan Faceted Jewel Emblem (public/ asset) */}
        <Link href="/" className="flex items-center gap-3 group">
          <img
            src="/assets/logo-apex.svg"
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            decoding="async"
            className="w-8 h-8 shrink-0 filter drop-shadow-[0_0_12px_rgba(0,240,255,0.8)] transition-transform duration-300 group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-extrabold tracking-wider font-mono text-white group-hover:text-[#00F0FF] transition">
              APEXSOVEREIGN<span className="text-[#00F0FF]">.AI</span>
            </span>
            <span className="text-[9px] font-mono text-slate-400 tracking-widest uppercase">
              TIER-6 SOVEREIGN INSTITUTIONAL NETWORK
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-2">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider text-slate-400 hover:text-white hover:bg-slate-900/60 transition"
          >
            EXCHANGES
          </Link>
          <Link
            href="/terminal"
            className="px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider text-slate-400 hover:text-white hover:bg-slate-900/60 transition"
          >
            TERMINAL
          </Link>
          <Link
            href="/futures"
            className="px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider text-slate-400 hover:text-white hover:bg-slate-900/60 transition"
          >
            FUTURES
          </Link>
          <Link
            href="/billing"
            className="px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider text-slate-400 hover:text-white hover:bg-slate-900/60 transition"
          >
            BILLING & LEDGER
          </Link>
        </nav>

        {/* Right SLA & CTA Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-[#030508] border border-slate-800 text-[10px] font-mono">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-300">TARGET 10.4ms P99</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-bold">SEV-SNP / CC TARGET</span>
            <span className="text-slate-600">|</span>
            <span className="text-[#00F0FF]">$1.00 = 100 CU</span>
          </div>

          <Link
            href="/terminal"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00F0FF] hover:bg-[#38BDF8] text-[#020305] font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.4)] transition"
          >
            LAUNCH TERMINAL
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
