import React from 'react';

export interface NavbarLogoProps {
  /** Size of the emblem in pixels (default: 38) */
  size?: number;
  /** Custom CSS classes for the root container */
  className?: string;
  /** Whether to show the subtitle underneath brand name */
  showSubtitle?: boolean;
  /** Custom subtitle text */
  subtitle?: string;
  /** Whether to display the live operational status badge */
  showBadge?: boolean;
  /** Status badge text (default: 'Live') */
  badgeText?: string;
  /** Status badge styling variant */
  badgeVariant?: 'live' | 'operational' | 'master';
  /** Optional click handler for navigation */
  onClick?: () => void;
}

/**
 * ApexSovereign.ai - Brand Emblem & Header Navigation Logo
 * Renders the precision metallic arrowhead SVG emblem, brand typography,
 * and live system operational telemetry badges.
 */
export const NavbarLogo: React.FC<NavbarLogoProps> = ({
  size = 38,
  className = '',
  showSubtitle = true,
  subtitle = 'The Sovereign Global Work OS',
  showBadge = true,
  badgeText = 'Live',
  badgeVariant = 'live',
  onClick,
}) => {
  const getBadgeStyles = () => {
    switch (badgeVariant) {
      case 'master':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      case 'operational':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'live':
      default:
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
    }
  };

  const getIndicatorStyles = () => {
    switch (badgeVariant) {
      case 'master':
        return 'bg-purple-400';
      case 'operational':
        return 'bg-emerald-400';
      case 'live':
      default:
        return 'bg-cyan-400';
    }
  };

  const Content = (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Precision Metallic Arrowhead Emblem */}
      <div 
        className="relative flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105"
        style={{ width: size, height: size }}
      >
        <img
          src="/assets/logo-apex.svg"
          alt="ApexSovereign Metallic Arrowhead Logo"
          width={size}
          height={size}
          className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(0,240,255,0.4)]"
          onError={(e) => {
            // Fallback to inline SVG representation if asset loading fails
            const target = e.currentTarget;
            target.style.display = 'none';
            if (target.nextElementSibling) {
              (target.nextElementSibling as HTMLElement).style.display = 'block';
            }
          }}
        />

        {/* Inline Vector Fallback for Zero-Latency Rendering */}
        <svg
          viewBox="0 0 200 200"
          width={size}
          height={size}
          className="w-full h-full hidden filter drop-shadow-[0_0_12px_rgba(0,240,255,0.4)]"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="navApexCyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#CFFAFE" />
              <stop offset="35%" stopColor="#38BDF8" />
              <stop offset="70%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="navApexDark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="50%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#020408" />
            </linearGradient>
            <linearGradient id="navApexSpine" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#0891B2" />
            </linearGradient>
          </defs>
          <polygon points="100,10 178,162 100,128 22,162" fill="#030712" stroke="url(#navApexCyan)" strokeWidth="3" />
          <polygon points="100,10 100,128 22,162" fill="url(#navApexDark)" />
          <polygon points="100,10 178,162 100,128" fill="url(#navApexCyan)" opacity="0.85" />
          <line x1="100" y1="10" x2="100" y2="128" stroke="url(#navApexSpine)" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>

      {/* Brand Typography & Status Indicators */}
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-white tracking-tight text-base sm:text-lg group-hover:text-cyan-300 transition-colors flex items-center leading-none">
            <span>ApexSovereign</span>
            <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]">.ai</span>
          </span>

          {showBadge && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full border tracking-wide uppercase ${getBadgeStyles()}`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-ping ${getIndicatorStyles()}`} />
              <span>{badgeText}</span>
            </span>
          )}
        </div>

        {showSubtitle && (
          <p className="text-[11px] font-mono text-slate-400 hidden sm:block tracking-tight mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center text-left focus:outline-none group cursor-pointer"
        aria-label="ApexSovereign.ai Home"
      >
        {Content}
      </button>
    );
  }

  return Content;
};
