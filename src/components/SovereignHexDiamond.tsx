import React from 'react';

interface SovereignHexDiamondProps {
  size?: number | string;
  className?: string;
  glow?: boolean;
  showText?: boolean;
  textSubtitle?: string;
  animated?: boolean;
}

export const SovereignHexDiamond: React.FC<SovereignHexDiamondProps> = ({
  size = 36,
  className = '',
  glow = true,
  showText = false,
  textSubtitle = 'The Sovereign Global Work OS',
  animated = false,
}) => {
  const numericSize = typeof size === 'number' ? size : parseInt(String(size), 10) || 36;

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <div 
        className={`relative flex items-center justify-center flex-shrink-0 ${animated ? 'hover:scale-105 transition-transform duration-300' : ''}`}
        style={{ width: numericSize, height: numericSize }}
      >
        <svg
          viewBox="0 0 120 120"
          width="100%"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={glow ? 'filter drop-shadow-[0_0_12px_rgba(6,182,212,0.45)]' : ''}
        >
          <defs>
            {/* Obsidian Metallic Gradients */}
            <linearGradient id="obsidian-dark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0B0F19" />
              <stop offset="50%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            <linearGradient id="obsidian-surface" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="40%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#090D16" />
            </linearGradient>

            {/* Radiant Cyan & Blue Crystalline Facets */}
            <linearGradient id="cyan-primary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="50%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#0891B2" />
            </linearGradient>

            <linearGradient id="cyan-radiant" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#67E8F9" />
              <stop offset="35%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>

            <linearGradient id="cyan-accent" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#A5F3FC" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>

            <linearGradient id="crystal-highlight" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0.1" />
            </linearGradient>

            <radialGradient id="central-core-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#06B6D4" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#0891B2" stopOpacity="0" />
            </radialGradient>

            <filter id="hex-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Core Glow */}
          <circle cx="60" cy="60" r="46" fill="url(#central-core-glow)" />

          {/* Outer Precision Hexagonal Diamond Boundary */}
          {/* Top vertex: (60, 6), Top Right: (108, 33), Bottom Right: (108, 87), Bottom: (60, 114), Bottom Left: (12, 87), Top Left: (12, 33) */}
          <polygon
            points="60,6 108,33 108,87 60,114 12,87 12,33"
            fill="url(#obsidian-dark)"
            stroke="#1E293B"
            strokeWidth="1.5"
          />

          {/* Faceted Crystalline Geometric Plates (Upper & Lower Bevel Cuts) */}
          {/* Top-Left Facet */}
          <polygon
            points="60,6 12,33 36,46 60,33"
            fill="url(#obsidian-surface)"
            stroke="#0891B2"
            strokeWidth="0.75"
            strokeOpacity="0.4"
          />
          {/* Top-Right Facet (High Reflection) */}
          <polygon
            points="60,6 108,33 84,46 60,33"
            fill="url(#crystal-highlight)"
            stroke="#38BDF8"
            strokeWidth="0.75"
            strokeOpacity="0.6"
          />
          {/* Right Upper Facet */}
          <polygon
            points="108,33 108,87 84,74 84,46"
            fill="url(#obsidian-surface)"
            stroke="#06B6D4"
            strokeWidth="0.75"
            strokeOpacity="0.5"
          />
          {/* Bottom-Right Facet */}
          <polygon
            points="108,87 60,114 60,87 84,74"
            fill="url(#obsidian-dark)"
            stroke="#0E7490"
            strokeWidth="0.75"
            strokeOpacity="0.4"
          />
          {/* Bottom-Left Facet */}
          <polygon
            points="60,114 12,87 36,74 60,87"
            fill="url(#obsidian-surface)"
            stroke="#06B6D4"
            strokeWidth="0.75"
            strokeOpacity="0.5"
          />
          {/* Left Upper Facet */}
          <polygon
            points="12,87 12,33 36,46 36,74"
            fill="url(#obsidian-dark)"
            stroke="#0891B2"
            strokeWidth="0.75"
            strokeOpacity="0.4"
          />

          {/* Inner Radiant Cyan Hexagonal Frame */}
          <polygon
            points="60,20 96,40 96,80 60,100 24,80 24,40"
            fill="url(#obsidian-dark)"
            stroke="url(#cyan-primary)"
            strokeWidth="1.8"
          />

          {/* Central Interlocking 'AS' Sovereign Monogram */}
          {/* Letter 'A' (Apex) - Left & Top Diamond Arch */}
          <path
            d="M 60 25 L 76 60 L 68 60 L 60 42 L 52 60 L 44 60 Z"
            fill="url(#cyan-radiant)"
          />
          {/* 'A' Crossbar & Atomic Keystone Link */}
          <polygon
            points="48,53 72,53 69,57 51,57"
            fill="#E0F2FE"
          />

          {/* Letter 'S' (Sovereign) - Interlocking Cybernetic Ribbon */}
          <path
            d="M 72 65 C 72 61 68 59 60 59 C 52 59 47 62 47 67 C 47 73 54 75 62 77 C 71 79 75 82 75 88 C 75 94 69 98 60 98 C 50 98 45 93 44 87 L 51 86 C 52 90 55 93 60 93 C 65 93 68 91 68 87 C 68 82 62 80 54 78 C 46 76 40 73 40 67 C 40 60 46 54 60 54 C 68 54 74 58 75 64 Z"
            fill="url(#cyan-primary)"
          />

          {/* Cryptographic Node Points & Light Prisms */}
          <circle cx="60" cy="20" r="2.5" fill="#E0F2FE" />
          <circle cx="96" cy="40" r="2" fill="#38BDF8" />
          <circle cx="96" cy="80" r="2" fill="#38BDF8" />
          <circle cx="60" cy="100" r="2.5" fill="#22D3EE" />
          <circle cx="24" cy="80" r="2" fill="#38BDF8" />
          <circle cx="24" cy="40" r="2" fill="#38BDF8" />

          {/* Central Diamond Spark */}
          <polygon
            points="60,56 63,60 60,64 57,60"
            fill="#FFFFFF"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-tight text-base sm:text-lg leading-tight flex items-center gap-1.5">
              <span>ApexSovereign</span>
              <span className="text-cyan-400">.ai</span>
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider font-semibold rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
              Sovereign Core
            </span>
          </div>
          {textSubtitle && (
            <span className="text-[11px] text-slate-400 font-medium tracking-normal truncate max-w-[280px]">
              {textSubtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
