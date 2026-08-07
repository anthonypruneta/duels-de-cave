import React, { useMemo, useRef, useState } from 'react';
import SharedTooltip from '../../components/SharedTooltip';
import {
  V2_DEFAULT_SPELL_ORDER,
  getSpellBorderClass,
  getSpellById,
  isOnceInRotationSpell,
  normalizeSpellCycles,
  sanitizeSpellCycles,
} from '../data/v2Kit';

const CYCLE_LABELS = ['Cycle 1', 'Cycle 2', 'Cycle 3'];

function KitSpellTooltip({ spell, fallbackId }) {
  const typeLabel =
    spell?.source === 'basic'
      ? 'Sort de base'
      : spell?.damageType === 'phys'
        ? 'Physique (vs DEF)'
        : spell?.damageType === 'mag'
          ? 'Magique (vs ResC)'
          : spell?.damageType === 'heal'
            ? 'Soin'
            : spell?.damageType === 'util'
              ? 'Utilitaire'
              : null;
  return (
    <span className="whitespace-normal block text-left max-w-[260px] leading-relaxed">
      <span className="text-amber-300 font-semibold">
        {spell?.icon} {spell?.name || fallbackId}
      </span>
      {typeLabel && (
        <>
          <br />
          <span className="text-sky-300/90">{typeLabel}</span>
        </>
      )}
      <br />
      <span className="text-stone-400">Provenance : {spell?.sourceLabel || '—'}</span>
      <br />
      <span className="text-stone-200">{spell?.description || ''}</span>
    </span>
  );
}

/**
 * Déplace / réordonne un sort. Unicité par cycle uniquement.
 */
export function moveSpellInCycles(cycles, fromCycle, fromIndex, toCycle, toIndex) {
  const next = sanitizeSpellCycles(cycles).map((c) => [...c]);
  if (fromCycle < 0 || fromCycle > 2 || toCycle < 0 || toCycle > 2) return next;
  if (fromIndex < 0 || fromIndex >= next[fromCycle].length) return next;

  const [spellId] = next[fromCycle].splice(fromIndex, 1);
  if (!spellId) return next;

  if (next[toCycle].includes(spellId)) {
    return next;
  }

  let insertAt = typeof toIndex === 'number' ? toIndex : next[toCycle].length;
  if (fromCycle === toCycle && insertAt > fromIndex) insertAt -= 1;
  insertAt = Math.max(0, Math.min(insertAt, next[toCycle].length));
  next[toCycle].splice(insertAt, 0, spellId);
  return next;
}

export function addSpellToCycle(cycles, spellId, toCycle, toIndex) {
  const next = sanitizeSpellCycles(cycles).map((c) => [...c]);
  if (!getSpellById(spellId) || toCycle < 0 || toCycle > 2) return next;
  if (next[toCycle].includes(spellId)) return next;
  if (isOnceInRotationSpell(spellId) && next.flat().includes(spellId)) return next;
  let insertAt = typeof toIndex === 'number' ? toIndex : next[toCycle].length;
  insertAt = Math.max(0, Math.min(insertAt, next[toCycle].length));
  next[toCycle].splice(insertAt, 0, spellId);
  return next;
}

export function removeSpellFromCycle(cycles, cycleIndex, spellIndex) {
  const next = sanitizeSpellCycles(cycles).map((c) => [...c]);
  if (cycleIndex < 0 || cycleIndex > 2) return next;
  if (spellIndex < 0 || spellIndex >= next[cycleIndex].length) return next;
  next[cycleIndex].splice(spellIndex, 1);
  return next;
}

/**
 * 3 colonnes = 3 cycles + kit source. Glisser-déposer.
 * Un sort peut figurer dans plusieurs cycles, une seule fois par cycle.
 */
export default function V2RotationEditor({
  spellCycles,
  spellOrder,
  kitSpellIds,
  onChange,
  onSave,
  dirty = false,
  saving = false,
  saveFeedback = null,
  disabled,
}) {
  const cycles = useMemo(
    () => normalizeSpellCycles(spellCycles ?? { spellOrder }),
    [spellCycles, spellOrder]
  );

  const kitIds = useMemo(
    () => (Array.isArray(kitSpellIds) && kitSpellIds.length ? kitSpellIds : V2_DEFAULT_SPELL_ORDER),
    [kitSpellIds]
  );

  const [dragOver, setDragOver] = useState(null);
  const dragRef = useRef(null);

  const emit = (nextCycles) => {
    if (disabled) return;
    onChange?.(sanitizeSpellCycles(nextCycles));
  };

  const onDragStartKit = (e, spellId) => {
    if (disabled) return;
    dragRef.current = { type: 'kit', spellId };
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', spellId);
  };

  const onDragStartCycle = (e, cycleIndex, spellIndex, spellId) => {
    if (disabled) return;
    dragRef.current = { type: 'cycle', cycle: cycleIndex, index: spellIndex, spellId };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', spellId);
    requestAnimationFrame(() => e.currentTarget?.classList?.add('opacity-40'));
  };

  const onDragEnd = (e) => {
    e.currentTarget?.classList?.remove('opacity-40');
    dragRef.current = null;
    setDragOver(null);
  };

  const onDragOverSlot = (e, cycleIndex, insertIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragRef.current?.type === 'kit' ? 'copy' : 'move';
    setDragOver({ cycle: cycleIndex, index: insertIndex });
  };

  const onDrop = (e, toCycle, toIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const from = dragRef.current;
    setDragOver(null);
    if (!from || disabled) return;

    if (from.type === 'kit') {
      emit(addSpellToCycle(cycles, from.spellId, toCycle, toIndex));
    } else {
      emit(moveSpellInCycles(cycles, from.cycle, from.index, toCycle, toIndex));
    }
    dragRef.current = null;
  };

  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/70 p-3 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide">
          Cycles de sorts
        </h3>
        <p className="text-xs text-stone-400 mt-1">
          3 cycles enchaînés en combat. Glisse depuis le kit ou entre colonnes. Un sort ne peut
          apparaître qu’une fois dans un même cycle (flasques d’Alchimiste : une seule fois dans
          toute la rotation). Pense à enregistrer pour garder tes choix.
        </p>
      </div>

      <div className="rounded-lg border border-stone-600/70 bg-stone-950/40 p-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500 mb-1.5">
          Kit — glisser vers un cycle
        </div>
        <div className="flex flex-wrap gap-1.5">
          {kitIds.map((id) => {
            const spell = getSpellById(id);
            const usedOnce =
              isOnceInRotationSpell(id) && cycles.flat().includes(id);
            return (
              <SharedTooltip
                key={`kit-${id}`}
                content={<KitSpellTooltip spell={spell} fallbackId={id} />}
                tooltipClassName="whitespace-normal px-3 py-2 max-w-[280px] leading-relaxed"
              >
                <div
                  draggable={!disabled && !usedOnce}
                  onDragStart={(e) => onDragStartKit(e, id)}
                  onDragEnd={onDragEnd}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs select-none ${getSpellBorderClass(spell)} ${
                    disabled || usedOnce
                      ? 'opacity-40 cursor-not-allowed'
                      : 'cursor-grab active:cursor-grabbing hover:brightness-110'
                  }`}
                >
                  <span>{spell?.icon}</span>
                  <span className="text-stone-200 font-medium">{spell?.name}</span>
                </div>
              </SharedTooltip>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cycles.map((column, cycleIndex) => (
          <div
            key={`cycle-${cycleIndex}`}
            className={`rounded-lg border bg-stone-950/50 min-h-[11rem] flex flex-col ${
              dragOver?.cycle === cycleIndex
                ? 'border-amber-500/70 bg-amber-950/20'
                : 'border-stone-600/80'
            }`}
            onDragOver={(e) => onDragOverSlot(e, cycleIndex, column.length)}
            onDrop={(e) => onDrop(e, cycleIndex, column.length)}
          >
            <div className="px-2 py-1.5 border-b border-stone-700/80 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300/90 tracking-wide">
                {CYCLE_LABELS[cycleIndex]}
              </span>
              <span className="text-[10px] text-stone-500">
                {column.length} sort{column.length > 1 ? 's' : ''}
              </span>
            </div>

            <ul className="flex-1 p-2 space-y-1.5">
              {column.length === 0 && (
                <li className="text-[11px] text-stone-600 text-center py-6 border border-dashed border-stone-700 rounded pointer-events-none">
                  Dépose un sort ici
                </li>
              )}
              {column.map((id, spellIndex) => {
                const spell = getSpellById(id);
                const isOver =
                  dragOver?.cycle === cycleIndex && dragOver?.index === spellIndex;
                return (
                  <li key={`${cycleIndex}-${id}`}>
                    {isOver && <div className="h-1 mb-1 rounded bg-amber-500/80" />}
                    <div
                      draggable={!disabled}
                      onDragStart={(e) => onDragStartCycle(e, cycleIndex, spellIndex, id)}
                      onDragEnd={onDragEnd}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDragOverSlot(e, cycleIndex, spellIndex);
                      }}
                      onDrop={(e) => onDrop(e, cycleIndex, spellIndex)}
                      className={`flex items-start gap-1.5 rounded border px-2 py-1.5 cursor-grab active:cursor-grabbing select-none ${getSpellBorderClass(spell)} ${
                        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110'
                      }`}
                    >
                      <span className="text-stone-500 text-[10px] w-3 pt-0.5">{spellIndex + 1}</span>
                      <span className="text-base leading-none">{spell?.icon || '✨'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-stone-100 font-medium truncate">
                          {spell?.name || id}
                        </div>
                        <div className="text-[9px] text-stone-500 truncate">{spell?.sourceLabel}</div>
                      </div>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => emit(removeSpellFromCycle(cycles, cycleIndex, spellIndex))}
                        className="text-stone-500 hover:text-red-400 text-xs px-1"
                        aria-label="Retirer du cycle"
                        title="Retirer"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
              {dragOver?.cycle === cycleIndex &&
                dragOver?.index === column.length &&
                column.length > 0 && <div className="h-1 rounded bg-amber-500/80" />}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-700/60">
        <p className={`text-[11px] ${saveFeedback?.includes('Échec') || saveFeedback?.includes('Erreur') ? 'text-red-400' : 'text-stone-500'}`}>
          {dirty
            ? 'Modifications non enregistrées'
            : saveFeedback || 'Aucun changement en attente'}
        </p>
        <button
          type="button"
          onClick={() => onSave?.()}
          disabled={disabled || saving}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
