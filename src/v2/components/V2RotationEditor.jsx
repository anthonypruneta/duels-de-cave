import React from 'react';
import { V2_SPELLS, getSpellById } from '../data/v2Kit';

/**
 * Réordonne les 4 sorts de la rotation (boutons ↑↓).
 */
export default function V2RotationEditor({ spellOrder, onChange, disabled }) {
  const order = Array.isArray(spellOrder) ? spellOrder : Object.keys(V2_SPELLS);

  const move = (index, dir) => {
    const next = [...order];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/70 p-3 space-y-2">
      <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide">Rotation de sorts</h3>
      <p className="text-xs text-stone-400">
        Ordre de lancement en combat (boucle). Place tes buffs / débuffs avant le burst.
      </p>
      <ul className="space-y-2">
        {order.map((id, index) => {
          const spell = getSpellById(id);
          return (
            <li
              key={`${id}-${index}`}
              className="flex items-center gap-2 rounded border border-stone-600/80 bg-stone-950/60 px-2 py-2"
            >
              <span className="text-stone-500 text-xs w-5">{index + 1}.</span>
              <span className="text-lg">{spell?.icon || '✨'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-stone-100 font-medium truncate">{spell?.name || id}</div>
                <div className="text-[10px] text-stone-500 truncate">
                  {spell?.sourceLabel} — {spell?.description}
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  className="px-1.5 text-xs rounded border border-stone-600 text-stone-300 disabled:opacity-30 hover:bg-stone-800"
                  aria-label="Monter"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={disabled || index === order.length - 1}
                  onClick={() => move(index, 1)}
                  className="px-1.5 text-xs rounded border border-stone-600 text-stone-300 disabled:opacity-30 hover:bg-stone-800"
                  aria-label="Descendre"
                >
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
