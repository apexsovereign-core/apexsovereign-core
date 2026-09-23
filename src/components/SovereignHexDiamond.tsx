import React from 'react';

interface SovereignHexDiamondProps {
  size?: number | string;
  className?: string;
  glow?: boolean;
  showText?: boolean;
  textSubtitle?: string;
  animated?: boolean;
}

/**
 * Permanent Logo Mark & Visual Symbol for ApexSovereign Empire:
 * - Shape: A precise 45-degree rotated diamond frame (39px x 39px base) with a 2px solid cyan border (#43e4ff)
 *   emitting a 28px outer glow (#1a9ebd55).
 * - Core Element: Centered solid cyan square core (15px x 15px) suspended within the diamond matrix.
 * - Color Palette: Deep Space (#050912), Edge (#12314a), Panel (#0b1422), Border (#1e3852),
 *   Vivid Cyan (#43e4ff), Sovereign Green (#55e39b), Warning Amber (#ffc857).
 * - Moniker: ApexSovereign.ai — Autonomous Enterprise Work OS & Sovereign Compute Broker Platform.
 */
export const SovereignHexDiamond: React.FC<SovereignHexDiamondProps> = ({
  size = 39,
  className = '',
  glow = true,
  showText = false,
  textSubtitle = 'Autonomous Enterprise Work OS & Sovereign Compute Broker Platform',
  animated = false,
}) => {
  const numericSize = typeof size === 'number' ? size : parseInt(String(size), 10) || 39;
  const scale = numericSize / 39;

  return (
    <div className={`inline-flex items-center gap-3.5 select-none ${className}`}>
      {/* Permanent Empire Diamond Mark */}
      <div
        className={`relative flex items-center justify-center flex-shrink-0 ${
          animated ? 'hover:scale-105 transition-transform duration-300' : ''
        }`}
        style={{
          width: numericSize,
          height: numericSize,
          minWidth: numericSize,
          minHeight: numericSize,
        }}
      >
        {/* Outer 45-degree Diamond Frame */}
        <div
          className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none"
          style={{
            width: `${39 * scale}px`,
            height: `${39 * scale}px`,
            border: `${Math.max(1.5, 2 * scale)}px solid #43e4ff`,
            backgroundColor: '#050912',
            transform: 'rotate(45deg)',
            boxShadow: glow
              ? '0 0 28px #1a9ebd55, inset 0 0 12px rgba(67, 228, 255, 0.25)'
              : 'none',
          }}
        >
          {/* Inner 15px x 15px Centered Solid Cyan Core Element */}
          <div
            style={{
              width: `${15 * scale}px`,
              height: `${15 * scale}px`,
              backgroundColor: '#43e4ff',
              boxShadow: glow ? '0 0 12px #43e4ff' : 'none',
            }}
          />
        </div>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white tracking-tight text-base sm:text-lg leading-tight flex items-center gap-1">
              <span>ApexSovereign</span>
              <span className="text-[#43e4ff]">.ai</span>
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider font-semibold rounded bg-[#0b1422] text-[#43e4ff] border border-[#1e3852]">
              EMPIRE CORE
            </span>
          </div>
          {textSubtitle && (
            <span className="text-[11px] text-slate-400 font-medium tracking-normal truncate max-w-[320px]">
              {textSubtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
