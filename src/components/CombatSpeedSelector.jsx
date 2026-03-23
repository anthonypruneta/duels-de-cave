import React from 'react';

const speedOptions = [
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Rapide' },
  { id: 'turbo', label: 'Turbo' }
];

export default function CombatSpeedSelector({ value, onChange, label = 'Vitesse' }) {
  return (
    <div className="bg-stone-950/85 border border-stone-700/80 rounded-lg px-3 py-2">
      <div className="text-stone-200 text-[11px] md:text-xs font-bold uppercase tracking-wide text-center mb-2">
        {label}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {speedOptions.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange?.(opt.id)}
              className={[
                'px-3 py-1.5 rounded-lg font-bold text-sm transition-all border',
                active
                  ? 'bg-amber-600 border-amber-400 text-white shadow-lg'
                  : 'bg-stone-900/60 border-stone-600 text-stone-200 hover:bg-stone-800/70 hover:border-stone-400'
              ].join(' ')}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

