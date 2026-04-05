import React from 'react';

/**
 * Tableau d’affichage taverne (paris tournoi) — SVG : cadre bois, liège, papiers épinglés.
 * Le parent gère clic / focus / aria.
 */
export default function TavernBettingBoardVisual({ hovered = false, className = '' }) {
  return (
    <div
      className={`relative w-full h-full select-none pointer-events-none transition-[filter,transform] duration-200 ${
        hovered
          ? 'drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)] drop-shadow-[0_0_16px_rgba(251,191,36,0.42)]'
          : 'drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]'
      } ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 260 210"
        className="w-full h-full block"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="tb-wood-edge" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6b4423" />
            <stop offset="35%" stopColor="#3d2614" />
            <stop offset="100%" stopColor="#1f140c" />
          </linearGradient>
          <linearGradient id="tb-wood-face" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4a3020" />
            <stop offset="50%" stopColor="#352218" />
            <stop offset="100%" stopColor="#2a1a12" />
          </linearGradient>
          <linearGradient id="tb-cork" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c49a6c" />
            <stop offset="45%" stopColor="#9a734a" />
            <stop offset="100%" stopColor="#7a5a38" />
          </linearGradient>
          <radialGradient id="tb-pin" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#e8c547" />
            <stop offset="55%" stopColor="#a67c1a" />
            <stop offset="100%" stopColor="#5c4010" />
          </radialGradient>
          <linearGradient id="tb-paper" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#faf3e8" />
            <stop offset="100%" stopColor="#e8dcc8" />
          </linearGradient>
          <linearGradient id="tb-paper2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f2e8c8" />
            <stop offset="100%" stopColor="#dcc9a0" />
          </linearGradient>
          <filter id="tb-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.45" />
          </filter>
          <pattern id="tb-cork-dots" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="transparent" />
            <circle cx="2" cy="3" r="1.1" fill="#4a3220" opacity="0.22" />
            <circle cx="7" cy="6" r="0.9" fill="#3d2818" opacity="0.18" />
            <circle cx="5" cy="1.5" r="0.7" fill="#5c4030" opacity="0.15" />
            <circle cx="8.5" cy="8.5" r="1" fill="#2a1a10" opacity="0.12" />
          </pattern>
        </defs>

        <g>
          {/* Ombre au sol */}
          <ellipse cx="130" cy="198" rx="108" ry="8" fill="#000" opacity="0.35" />

          {/* Cadre bois extérieur */}
          <rect
            x="8"
            y="10"
            width="244"
            height="188"
            rx="10"
            ry="10"
            fill="url(#tb-wood-face)"
            stroke="url(#tb-wood-edge)"
            strokeWidth="5"
            filter="url(#tb-soft-shadow)"
          />
          <rect
            x="18"
            y="22"
            width="224"
            height="164"
            rx="5"
            ry="5"
            fill="#1a1008"
            opacity="0.55"
          />

          {/* Panneau liège */}
          <rect
            x="22"
            y="26"
            width="216"
            height="156"
            rx="4"
            ry="4"
            fill="url(#tb-cork)"
          />
          <rect
            x="22"
            y="26"
            width="216"
            height="156"
            rx="4"
            ry="4"
            fill="url(#tb-cork-dots)"
          />
          {/* Légère usure bords liège */}
          <rect
            x="22"
            y="26"
            width="216"
            height="156"
            rx="4"
            ry="4"
            fill="none"
            stroke="#000"
            strokeOpacity="0.12"
            strokeWidth="2"
          />

          {/* Petit papier coin — règles */}
          <g transform="translate(28 32) rotate(-6 40 28)" filter="url(#tb-soft-shadow)">
            <rect x="0" y="0" width="78" height="52" rx="1.5" fill="url(#tb-paper2)" />
            <line x1="10" y1="14" x2="62" y2="14" stroke="#8b7355" strokeWidth="0.6" opacity="0.5" />
            <line x1="10" y1="22" x2="58" y2="22" stroke="#8b7355" strokeWidth="0.6" opacity="0.35" />
            <line x1="10" y1="30" x2="55" y2="30" stroke="#8b7355" strokeWidth="0.6" opacity="0.35" />
            <line x1="10" y1="38" x2="50" y2="38" stroke="#8b7355" strokeWidth="0.6" opacity="0.35" />
            <circle cx="39" cy="4" r="3.2" fill="url(#tb-pin)" stroke="#3d2808" strokeWidth="0.4" />
          </g>

          {/* Papier principal — annonce */}
          <g transform="translate(72 38) rotate(-1.5 58 55)" filter="url(#tb-soft-shadow)">
            <rect x="0" y="0" width="116" height="118" rx="2" fill="url(#tb-paper)" />
            <rect x="0" y="0" width="116" height="118" rx="2" fill="none" stroke="#c4b59a" strokeWidth="0.8" />
            {/* Déchirure bas */}
            <path
              d="M0 112 L8 116 L18 111 L28 117 L40 113 L52 118 L64 114 L76 117 L88 112 L100 116 L116 110 L116 118 L0 118 Z"
              fill="#e8dcc8"
              opacity="0.95"
            />
            <circle cx="58" cy="8" r="3.5" fill="url(#tb-pin)" stroke="#3d2808" strokeWidth="0.45" />
            <circle cx="12" cy="96" r="2.8" fill="url(#tb-pin)" stroke="#3d2808" strokeWidth="0.35" opacity="0.9" />
          </g>

          {/* Bordereau droit — cotes */}
          <g transform="translate(188 44) rotate(4 22 40)" filter="url(#tb-soft-shadow)">
            <rect x="0" y="0" width="44" height="88" rx="1.5" fill="#f0e4d4" />
            <line x1="8" y1="18" x2="36" y2="18" stroke="#7a6550" strokeWidth="0.5" opacity="0.4" />
            <line x1="8" y1="28" x2="32" y2="28" stroke="#7a6550" strokeWidth="0.5" opacity="0.35" />
            <line x1="8" y1="38" x2="34" y2="38" stroke="#7a6550" strokeWidth="0.5" opacity="0.35" />
            <line x1="8" y1="48" x2="30" y2="48" stroke="#7a6550" strokeWidth="0.5" opacity="0.3" />
            <line x1="8" y1="58" x2="33" y2="58" stroke="#7a6550" strokeWidth="0.5" opacity="0.3" />
            <circle cx="22" cy="6" r="3" fill="url(#tb-pin)" stroke="#3d2808" strokeWidth="0.4" />
          </g>

          {/* Bandeau bas — affiche */}
          <g transform="translate(48 152) rotate(1.2 82 12)" filter="url(#tb-soft-shadow)">
            <rect x="0" y="0" width="164" height="28" rx="1.5" fill="#ebe1cc" />
            <rect x="0" y="0" width="164" height="28" rx="1.5" fill="none" stroke="#b8a88c" strokeWidth="0.6" />
            <circle cx="82" cy="4" r="2.8" fill="url(#tb-pin)" stroke="#3d2808" strokeWidth="0.35" />
          </g>
        </g>
      </svg>

      {/* Texte lisible par-dessus (police Cinzel déjà chargée) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-[8%] px-[6%] pb-[18%]">
        <div
          className="text-center leading-tight"
          style={{
            fontFamily: "'Cinzel', serif",
            textShadow: '0 1px 0 rgba(255,255,255,0.35), 0 2px 4px rgba(0,0,0,0.25)',
          }}
        >
          <div
            className={`font-bold tracking-wide text-[clamp(7px,2.1vw,13px)] transition-colors duration-200 ${
              hovered ? 'text-amber-950' : 'text-stone-900'
            }`}
          >
            PARIS
          </div>
          <div
            className={`font-bold tracking-wider text-[clamp(6px,1.7vw,11px)] mt-0.5 transition-colors duration-200 ${
              hovered ? 'text-amber-900' : 'text-stone-800'
            }`}
          >
            TOURNOI
          </div>
        </div>
        <div
          className="mt-[6%] text-[clamp(5px,1.25vw,9px)] text-stone-700/90 font-medium text-center max-w-[85%] leading-snug"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          Pool de runs
        </div>
      </div>

      <div
        className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[72%] text-center text-[clamp(4.5px,1.1vw,8px)] text-stone-800/85 font-semibold tracking-wide"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        Toucher pour miser
      </div>

      {/* Mini labels sur les zones latérales (lisibles au survol) */}
      <div
        className="absolute top-[18%] left-[4%] w-[26%] text-[clamp(3.5px,0.95vw,7px)] text-stone-800/70 text-center leading-tight px-0.5"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        1 combattant
        <br />
        <span className="opacity-80">Cumul OK</span>
      </div>
      <div
        className="absolute top-[22%] right-[3%] w-[14%] text-[clamp(3px,0.85vw,6px)] text-stone-800/65 text-center leading-tight"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        Cotes
        <br />
        {'& pool'}
      </div>
    </div>
  );
}
