import React from 'react';
import Link from 'next/link';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-slate-900 bg-[#020305] py-10 text-xs font-mono text-slate-500 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Permanent Cyan Faceted Jewel Emblem (public/ asset) */}
        <div className="flex items-center gap-3">
          <img
            src="/assets/logo-apex.svg"
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            decoding="async"
            className="w-8 h-8 shrink-0 filter drop-shadow-[0_0_12px_rgba(0,240,255,0.8)]"
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white tracking-wider">
              APEXSOVEREIGN<span className="text-[#00F0FF]">.AI</span>
            </span>
            <span className="text-[10px] text-slate-500">
              CRYPTOGRAPHIC CONTROL PLANE · V3.6.0-GOLD
            </span>
          </div>
        </div>

        {/* Footer Navigation Links */}
        <div className="flex flex-wrap items-center gap-6 text-[11px]">
          <Link href="/" className="hover:text-white transition">
            EXCHANGES
          </Link>
          <Link href="/terminal" className="hover:text-white transition">
            TERMINAL
          </Link>
          <Link href="/futures" className="hover:text-white transition">
            FUTURES
          </Link>
          <Link href="/billing" className="hover:text-white transition">
            BILLING & LEDGER
          </Link>
          <Link href="/legal/terms.html" className="hover:text-white transition">
            TERMS
          </Link>
          <Link href="/legal/privacy.html" className="hover:text-white transition">
            PRIVACY
          </Link>
          <Link href="/legal/acceptable-use.html" className="hover:text-white transition">
            ACCEPTABLE USE
          </Link>
          <a
            href="/api/health"
            className="hover:text-[#10B981] transition flex items-center gap-1"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            HEALTH PROBE
          </a>
        </div>

        <div className="text-[10px] text-slate-600 text-center md:text-right">
          TARGET 10.4ms P99 · $1.00 = 100 CU · SEV-SNP / CC TARGET · Status is not asserted here
        </div>
      </div>
    </footer>
  );
};

export default Footer;
