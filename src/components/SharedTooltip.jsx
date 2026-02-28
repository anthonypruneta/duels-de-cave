import React from 'react';

/** Tooltip partagé (z-[100]) pour afficher au-dessus des autres éléments (cartes personnage, etc.) */
/** tooltipClassName : optionnel, ex. "whitespace-normal px-4 py-3 leading-relaxed max-w-[320px]" pour les buffs/debuffs (moins écrasé) */
export default function SharedTooltip({ children, content, tooltipClassName = '' }) {
  const baseClasses = 'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-stone-900 border border-amber-500 rounded-lg text-sm text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[100] shadow-lg';
  const defaultClasses = 'px-3 py-2 whitespace-nowrap';
  const classes = tooltipClassName ? `${baseClasses} ${tooltipClassName}` : `${baseClasses} ${defaultClasses}`;
  return (
    <span className="relative group cursor-help">
      {children}
      <span className={classes}>
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-500" />
      </span>
    </span>
  );
}
