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
          viewBox="0 0 200 200"
          width="100%"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={glow ? 'filter drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]' : ''}
        >
          <defs>
            {/* Cyan & Electric Blue Neon Seam Gradients */}
            <linearGradient id="apexNavCyanLine" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A5F3FC" />
              <stop offset="25%" stopColor="#38BDF8" />
              <stop offset="60%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>

            <linearGradient id="apexNavSpineBeam" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#E0F2FE" />
              <stop offset="30%" stopColor="#67E8F9" />
              <stop offset="70%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#0891B2" />
            </linearGradient>

            {/* Metallic Obsidian Dark Shaded Facets (Left Side) */}
            <linearGradient id="facetNavObsidianDark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="50%" stopColor="#090E17" />
              <stop offset="100%" stopColor="#03060A" />
            </linearGradient>

            <linearGradient id="facetNavObsidianMid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="60%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#060A12" />
            </linearGradient>

            {/* Specular Highlight & Sheen Facets (Right Side) */}
            <linearGradient id="facetNavSpecularUpper" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0A1424" />
              <stop offset="45%" stopColor="#1E3A5F" />
              <stop offset="75%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#7DD3FC" />
            </linearGradient>

            <linearGradient id="facetNavSpecularLower" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
              <stop offset="35%" stopColor="#0F243E" />
              <stop offset="80%" stopColor="#0B1320" />
              <stop offset="100%" stopColor="#05080E" />
            </linearGradient>

            {/* Lower Keel Diamond Facets */}
            <linearGradient id="facetNavKeelLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0C1524" />
              <stop offset="70%" stopColor="#050912" />
              <stop offset="100%" stopColor="#020408" />
            </linearGradient>

            <linearGradient id="facetNavKeelRight" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1E3A5F" />
              <stop offset="50%" stopColor="#0D1E36" />
              <stop offset="100%" stopColor="#060C17" />
            </linearGradient>
          </defs>

          {/* Background Base Silhouette with Outer Cyan Bevel Edge */}
          <polygon
            points="100,10 184,170 128,138 100,180 72,138 16,170"
            fill="url(#facetNavObsidianDark)"
            stroke="url(#apexNavCyanLine)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* 1. Outer Left Wing Upper Facet */}
          <polygon
            points="100,10 16,170 78,114"
            fill="url(#facetNavObsidianDark)"
            stroke="#0284C7"
            strokeWidth="1"
            strokeOpacity="0.8"
            strokeLinejoin="round"
          />

          {/* 2. Outer Left Wing Lower Facet */}
          <polygon
            points="78,114 16,170 72,138"
            fill="url(#facetNavObsidianMid)"
            stroke="#06B6D4"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* 3. Central-Left Dorsal Facet */}
          <polygon
            points="100,10 78,114 100,114"
            fill="url(#facetNavObsidianMid)"
            stroke="#00E5FF"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* 4. Central-Right Dorsal Facet (Bright Specular) */}
          <polygon
            points="100,10 100,114 122,114"
            fill="url(#facetNavSpecularUpper)"
            stroke="#67E8F9"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* 5. Outer Right Wing Upper Facet (Metallic Sheen) */}
          <polygon
            points="100,10 122,114 184,170"
            fill="url(#facetNavSpecularLower)"
            stroke="#38BDF8"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* 6. Outer Right Wing Lower Facet */}
          <polygon
            points="122,114 128,138 184,170"
            fill="url(#facetNavObsidianMid)"
            stroke="#06B6D4"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* 7. Bottom Keel Left Facet */}
          <polygon
            points="100,114 72,138 100,180"
            fill="url(#facetNavKeelLeft)"
            stroke="#0891B2"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* 8. Bottom Keel Right Facet (Specular) */}
          <polygon
            points="100,114 100,180 128,138"
            fill="url(#facetNavKeelRight)"
            stroke="#38BDF8"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* 9. Central Vertical Illuminated Spine Beam (Ridge from Apex to Keel) */}
          <line
            x1="100"
            y1="10"
            x2="100"
            y2="180"
            stroke="url(#apexNavSpineBeam)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* 10. Horizontal Ridge Line at Mid-Apex (78,114 to 122,114) */}
          <line
            x1="78"
            y1="114"
            x2="122"
            y2="114"
            stroke="#67E8F9"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* 11. Center Diamond Spark Core at (100,114) */}
          <polygon
            points="100,108 104,114 100,120 96,114"
            fill="#FFFFFF"
            stroke="#67E8F9"
            strokeWidth="0.8"
          />

          {/* 12. Outer Perimeter Crisp Highlight Stroke */}
          <polyline
            points="16,170 100,10 184,170"
            fill="none"
            stroke="#67E8F9"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
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
