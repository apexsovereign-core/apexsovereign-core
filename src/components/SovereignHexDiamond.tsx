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
          className={glow ? 'filter drop-shadow-[0_0_14px_rgba(6,182,212,0.5)]' : ''}
        >
          <defs>
            {/* Cyan & Aqua Neon Laser Glow Gradients */}
            <linearGradient id="apex-cyan-primary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#67E8F9" />
              <stop offset="35%" stopColor="#22D3EE" />
              <stop offset="70%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#0891B2" />
            </linearGradient>

            <linearGradient id="apex-cyan-light" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A5F3FC" />
              <stop offset="45%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>

            <linearGradient id="apex-spine-beam" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#CFFAFE" />
              <stop offset="30%" stopColor="#67E8F9" />
              <stop offset="75%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#0E7490" />
            </linearGradient>

            {/* Metallic Obsidian & Titanium Dark Surface Gradients */}
            <linearGradient id="obsidian-dark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0C1220" />
              <stop offset="50%" stopColor="#070B14" />
              <stop offset="100%" stopColor="#020408" />
            </linearGradient>

            <linearGradient id="obsidian-left-wing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="40%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#050811" />
            </linearGradient>

            <linearGradient id="obsidian-right-wing" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="30%" stopColor="#1E293B" />
              <stop offset="70%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#080D1A" />
            </linearGradient>

            <linearGradient id="obsidian-specular" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0A101D" />
              <stop offset="40%" stopColor="#19263E" />
              <stop offset="70%" stopColor="#38BDF8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.8" />
            </linearGradient>

            {/* Radial Cyan Atmosphere Aura */}
            <radialGradient id="apex-aura" cx="50%" cy="52%" r="50%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#0891B2" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ambient Cyan Aura */}
          <ellipse cx="60" cy="62" rx="46" ry="46" fill="url(#apex-aura)" />

          {/* Outer Neon Cyan Beveled Wing Silhouette (Base Glow) */}
          <polygon
            points="60,6 112,94 86,82 72,87 60,114 48,87 34,82 8,94"
            fill="url(#obsidian-dark)"
            stroke="url(#apex-cyan-primary)"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Stealth Facet: Outer Left Wing Surface */}
          <polygon
            points="60,6 8,94 34,82 48,60"
            fill="url(#obsidian-left-wing)"
            stroke="#0891B2"
            strokeWidth="0.75"
            strokeOpacity="0.6"
          />

          {/* Stealth Facet: Outer Right Wing Surface (Specular Highlight) */}
          <polygon
            points="60,6 112,94 86,82 72,60"
            fill="url(#obsidian-right-wing)"
            stroke="#38BDF8"
            strokeWidth="0.75"
            strokeOpacity="0.8"
          />

          {/* Upper Left Dorsal Facet */}
          <polygon
            points="60,6 48,60 60,64"
            fill="url(#obsidian-left-wing)"
            stroke="#06B6D4"
            strokeWidth="0.8"
          />

          {/* Upper Right Dorsal Facet (High Sheen) */}
          <polygon
            points="60,6 72,60 60,64"
            fill="url(#obsidian-specular)"
            stroke="#67E8F9"
            strokeWidth="0.8"
          />

          {/* Mid Left Lateral Facet */}
          <polygon
            points="48,60 34,82 48,87 60,64"
            fill="url(#obsidian-dark)"
            stroke="#0891B2"
            strokeWidth="0.75"
          />

          {/* Mid Right Lateral Facet */}
          <polygon
            points="72,60 86,82 72,87 60,64"
            fill="url(#obsidian-right-wing)"
            stroke="#06B6D4"
            strokeWidth="0.75"
          />

          {/* Lower Left Keel Diamond */}
          <polygon
            points="60,64 48,87 60,114"
            fill="url(#obsidian-dark)"
            stroke="#0891B2"
            strokeWidth="0.8"
          />

          {/* Lower Right Keel Diamond (Specular Titanium) */}
          <polygon
            points="60,64 72,87 60,114"
            fill="url(#obsidian-specular)"
            stroke="#38BDF8"
            strokeWidth="0.8"
          />

          {/* Central Vertical Illuminated Spine Ridge (Apex to Keel) */}
          <line
            x1="60"
            y1="6"
            x2="60"
            y2="114"
            stroke="url(#apex-spine-beam)"
            strokeWidth="1.75"
            strokeLinecap="round"
          />

          {/* Inner Chevron Accents & Leading Edge Glow Lines */}
          <polyline
            points="8,94 60,6 112,94"
            fill="none"
            stroke="url(#apex-cyan-light)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Central Energy Core Prism Diamond Spark */}
          <polygon
            points="60,58 64,64 60,70 56,64"
            fill="#E0F2FE"
            stroke="#67E8F9"
            strokeWidth="0.5"
          />

          <circle cx="60" cy="6" r="1.5" fill="#CFFAFE" />
          <circle cx="60" cy="114" r="1.5" fill="#22D3EE" />
          <circle cx="8" cy="94" r="1.5" fill="#38BDF8" />
          <circle cx="112" cy="94" r="1.5" fill="#38BDF8" />
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
