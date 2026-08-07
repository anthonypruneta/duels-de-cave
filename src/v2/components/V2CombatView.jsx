import React, { useEffect, useMemo, useRef, useState } from 'react';
import { V2_DEFAULT_SPELL_ORDER, getSpellBorderClass, getSpellById } from '../data/v2Kit';
import {
  hasAntiHeal,
  hasEsquive,
  hasFamiliar,
  hasFureurSang,
  hasStigmate,
} from '../combat/v2Status';

/**
 * Replay combat style Pokémon :
 * barre ennemi en haut à droite, portrait joueur, PV joueur + grille de sorts, floating dmg.
 */
export default function V2CombatView({
  result,
  playerName,
  playerImage,
  enemyName,
  enemyIcon,
  onClose,
  winActions,
}) {
  const steps = result?.steps || [];
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const [floaters, setFloaters] = useState([]);
  const floaterId = useRef(0);
  const prevIndex = useRef(-1);

  useEffect(() => {
    setIndex(0);
    setAuto(true);
    setFloaters([]);
    prevIndex.current = -1;
  }, [result]);

  useEffect(() => {
    if (!auto || !steps.length) return undefined;
    if (index >= steps.length - 1) {
      setAuto(false);
      return undefined;
    }
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), 900);
    return () => clearTimeout(t);
  }, [auto, index, steps.length]);

  const step = steps[index] || steps[0];

  useEffect(() => {
    if (!step || index === prevIndex.current) return;
    prevIndex.current = index;
    const next = [];
    if (step.damageToEnemy > 0) {
      next.push({
        id: ++floaterId.current,
        side: 'enemy',
        text: `-${step.damageToEnemy} hp`,
        kind: 'dmg',
      });
    }
    if (step.damageToPlayer > 0) {
      next.push({
        id: ++floaterId.current,
        side: 'player',
        text: `-${step.damageToPlayer} hp`,
        kind: 'dmg',
      });
    }
    if (step.healToPlayer > 0) {
      next.push({
        id: ++floaterId.current,
        side: 'player',
        text: `+${step.healToPlayer}`,
        kind: 'heal',
      });
    }
    if (!next.length) return undefined;
    setFloaters((prev) => [...prev, ...next]);
    const t = setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => !next.some((n) => n.id === f.id)));
    }, 1400);
    return () => clearTimeout(t);
  }, [step, index]);

  const finished = index >= steps.length - 1;
  const winner = result?.winner;

  const playerPct = useMemo(() => {
    if (!step?.playerMaxHP) return 0;
    return Math.max(0, Math.min(100, (step.playerHP / step.playerMaxHP) * 100));
  }, [step]);

  const enemyPct = useMemo(() => {
    if (!step?.enemyMaxHP) return 0;
    return Math.max(0, Math.min(100, (step.enemyHP / step.enemyMaxHP) * 100));
  }, [step]);

  const spellSlots = useMemo(() => {
    const order = step?.spellOrder?.length
      ? step.spellOrder
      : result?.spellOrder?.length
        ? result.spellOrder
        : V2_DEFAULT_SPELL_ORDER;
    // Affiche jusqu’à 4 sorts uniques (kit), ordre d’apparition dans la rotation
    const unique = [];
    for (const id of order) {
      if (!unique.includes(id)) unique.push(id);
      if (unique.length >= 4) break;
    }
    while (unique.length < 4) {
      const fallback = V2_DEFAULT_SPELL_ORDER.find((id) => !unique.includes(id));
      if (!fallback) break;
      unique.push(fallback);
    }
    return unique;
  }, [step, result]);

  const nextSpellId = step?.nextSpellId || null;
  const justCastId = step?.spellId || null;

  if (!result || !step) {
    return (
      <div className="rounded-lg border border-stone-700 bg-stone-900/80 p-4 text-stone-300">
        Aucun combat.
        <button type="button" onClick={onClose} className="ml-3 text-amber-400 underline">
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-700/80 bg-gradient-to-b from-stone-900 via-stone-950 to-black overflow-hidden shadow-2xl">
      {/* Contrôles */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-stone-800 bg-stone-950/90">
        <h3 className="text-amber-400 font-bold text-sm tracking-wide">Combat</h3>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setAuto((v) => !v)}
            className="px-2 py-1 rounded border border-stone-600 text-stone-300 hover:bg-stone-800"
          >
            {auto ? 'Pause' : 'Auto'}
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(i + 1, steps.length - 1))}
            disabled={finished}
            className="px-2 py-1 rounded border border-stone-600 text-stone-300 hover:bg-stone-800 disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      </div>

      {/* Arène */}
      <div className="relative min-h-[22rem] sm:min-h-[26rem] px-3 pt-3 pb-2">
        {/* Ennemi — haut droite */}
        <div className="absolute top-3 right-3 z-20 w-[min(100%,15rem)]">
          <div className="relative rounded-md border border-stone-600/80 bg-stone-950/90 px-2.5 py-1.5 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-stone-100 truncate">{enemyName}</div>
                <div className="text-xs text-stone-300 tabular-nums">
                  {step.enemyHP}/{step.enemyMaxHP} PV
                </div>
              </div>
              <span className="text-2xl leading-none shrink-0">{enemyIcon || '🐗'}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-sm bg-stone-800 overflow-hidden border border-stone-700">
              <div
                className={`h-full transition-all duration-500 ${
                  enemyPct > 50 ? 'bg-emerald-500' : enemyPct > 25 ? 'bg-amber-400' : 'bg-red-500'
                }`}
                style={{ width: `${enemyPct}%` }}
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-1 justify-end text-[9px]">
              {hasStigmate(step.enemyStatus) && (
                <span className="px-1 rounded bg-violet-900/60 text-violet-200">Stigmate</span>
              )}
              {hasAntiHeal(step.enemyStatus) && (
                <span className="px-1 rounded bg-rose-900/60 text-rose-200">Anti-soin</span>
              )}
              {(step.enemyShield || 0) > 0 && (
                <span className="px-1 rounded bg-sky-900/60 text-sky-200">
                  Bouclier {step.enemyShield}
                </span>
              )}
              {(step.enemyStatus?.nextAttackPenalty || 0) > 0 && (
                <span className="px-1 rounded bg-pink-900/60 text-pink-200">Affaibli</span>
              )}
            </div>
          </div>
          {/* Floating dmg ennemi */}
          {floaters
            .filter((f) => f.side === 'enemy')
            .map((f) => (
              <span
                key={f.id}
                className={`v2-dmg-floater pointer-events-none absolute left-1/2 top-full mt-1 font-black text-lg ${
                  f.kind === 'heal' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {f.text}
              </span>
            ))}
        </div>

        {/* Portrait joueur — bas gauche / centre */}
        <div className="absolute left-2 bottom-[9.5rem] sm:bottom-[10.5rem] z-10 w-[42%] max-w-[14rem]">
          <div className="relative">
            {playerImage ? (
              <img
                src={playerImage}
                alt={playerName || ''}
                className="w-full h-auto object-contain drop-shadow-2xl"
                style={{ imageRendering: 'auto' }}
              />
            ) : (
              <div className="aspect-[3/4] flex items-center justify-center text-6xl opacity-40">🗡️</div>
            )}
            {floaters
              .filter((f) => f.side === 'player')
              .map((f) => (
                <span
                  key={f.id}
                  className={`v2-dmg-floater pointer-events-none absolute left-1/2 top-[35%] font-black text-lg ${
                    f.kind === 'heal' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {f.text}
                </span>
              ))}
          </div>
        </div>

        {/* Journal */}
        <div className="absolute left-[48%] right-3 top-[42%] sm:top-[38%] z-10">
          <p className="text-xs sm:text-sm text-stone-300/90 leading-snug">
            <span className="text-stone-500">Journal de combat :</span>{' '}
            <span className="text-stone-200">{step.line || '—'}</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-1 text-[9px]">
            {hasFureurSang(step.playerStatus) && (
              <span className="px-1 rounded bg-red-900/50 text-red-200">Fureur</span>
            )}
            {hasFamiliar(step.playerStatus) && (
              <span className="px-1 rounded bg-violet-900/50 text-violet-200">Familier</span>
            )}
            {hasEsquive(step.playerStatus) && (
              <span className="px-1 rounded bg-cyan-900/50 text-cyan-200">Esquive</span>
            )}
            {step.playerStatus?.riposteArmed && (
              <span className="px-1 rounded bg-amber-900/50 text-amber-200">Riposte</span>
            )}
            {step.playerStatus?.aegisArmed && (
              <span className="px-1 rounded bg-stone-700 text-stone-200">Égide</span>
            )}
            {(step.playerShield || 0) > 0 && (
              <span className="px-1 rounded bg-sky-900/50 text-sky-200">
                Bouclier {step.playerShield}
              </span>
            )}
            {hasAntiHeal(step.playerStatus) && (
              <span className="px-1 rounded bg-rose-900/50 text-rose-200">Anti-soin</span>
            )}
          </div>
        </div>

        {/* Bas : PV joueur + sorts */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-stone-950/95 to-transparent pt-8 px-3 pb-3">
          <div className="mb-2">
            <div className="flex items-end justify-between gap-2 mb-1">
              <div className="min-w-0">
                <div className="text-sm font-bold text-amber-100 truncate">{playerName}</div>
                <div className="text-xs text-stone-300 tabular-nums">
                  {step.playerHP}/{step.playerMaxHP} PV
                  {(step.playerShield || 0) > 0 ? ` · 🛡️ ${step.playerShield}` : ''}
                </div>
              </div>
            </div>
            <div className="h-2.5 rounded-sm bg-stone-800 overflow-hidden border border-stone-600">
              <div
                className={`h-full transition-all duration-500 ${
                  playerPct > 50 ? 'bg-emerald-500' : playerPct > 25 ? 'bg-amber-400' : 'bg-red-500'
                }`}
                style={{ width: `${playerPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {spellSlots.map((id, i) => {
              const spell = getSpellById(id);
              const isNext = nextSpellId === id;
              const isCasting = justCastId === id && !finished;
              const onCd = !isNext && !isCasting;
              return (
                <div
                  key={`${id}-${i}`}
                  className={`rounded-md border px-2 py-1.5 flex items-center gap-2 min-h-[2.75rem] transition ${
                    onCd
                      ? 'border-red-900/60 bg-red-950/55 text-red-100/80 opacity-70'
                      : isCasting
                        ? 'border-amber-400/70 bg-amber-950/50 text-amber-50 ring-1 ring-amber-400/40'
                        : `${getSpellBorderClass(spell)} text-stone-100`
                  }`}
                >
                  <span className="text-[10px] text-stone-500 w-3 shrink-0">{i + 1}</span>
                  <span className="text-lg leading-none shrink-0">{spell?.icon || '✨'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{spell?.name || id}</div>
                    <div className="text-[9px] opacity-70 truncate">{spell?.sourceLabel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {finished && (
        <div className="space-y-3 border-t border-stone-800 px-4 py-3 bg-stone-950">
          <p className="text-center font-semibold text-amber-300">
            {winner === 'player' && 'Victoire !'}
            {winner === 'enemy' && 'Défaite…'}
            {winner === 'draw' && 'Match nul'}
          </p>
          {winner === 'player' && winActions}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded bg-stone-800 text-stone-200 border border-stone-600 hover:bg-stone-700"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}
