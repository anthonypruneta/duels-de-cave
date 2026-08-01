import React, { useEffect, useMemo, useState } from 'react';
import { hasFureurSang, hasStigmate } from '../combat/v2Status';

/**
 * Replay pas-à-pas d’un résultat simulerMatchV2.
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

  useEffect(() => {
    setIndex(0);
    setAuto(true);
  }, [result]);

  useEffect(() => {
    if (!auto || !steps.length) return undefined;
    if (index >= steps.length - 1) {
      setAuto(false);
      return undefined;
    }
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), 650);
    return () => clearTimeout(t);
  }, [auto, index, steps.length]);

  const step = steps[index] || steps[0];
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
    <div className="rounded-lg border border-amber-700/40 bg-stone-950/95 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-amber-400 font-bold text-lg">Combat V2</h3>
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

      <div className="grid grid-cols-2 gap-3">
        <FighterCard
          name={playerName}
          image={playerImage}
          hp={step.playerHP}
          maxHp={step.playerMaxHP}
          pct={playerPct}
          status={step.playerStatus}
          side="left"
        />
        <FighterCard
          name={enemyName}
          icon={enemyIcon}
          hp={step.enemyHP}
          maxHp={step.enemyMaxHP}
          pct={enemyPct}
          status={step.enemyStatus}
          side="right"
        />
      </div>

      <div className="min-h-[3rem] rounded bg-stone-900/80 border border-stone-700 px-3 py-2 text-sm text-stone-200">
        {step.line}
      </div>

      {finished && (
        <div className="space-y-3 border-t border-stone-700 pt-3">
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

      <details className="text-xs text-stone-500">
        <summary className="cursor-pointer text-stone-400">Journal complet</summary>
        <ul className="mt-2 max-h-40 overflow-y-auto space-y-0.5 font-mono">
          {(result.log || []).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function FighterCard({ name, image, icon, hp, maxHp, pct, status, side }) {
  return (
    <div className={`rounded border border-stone-700 bg-stone-900/60 p-3 ${side === 'right' ? 'text-right' : ''}`}>
      <div className={`flex items-center gap-2 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
        {image ? (
          <img src={image} alt="" className="w-12 h-12 object-contain pixelated" style={{ imageRendering: 'pixelated' }} />
        ) : (
          <span className="text-3xl">{icon || '❓'}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-stone-100 truncate">{name}</div>
          <div className="text-xs text-stone-400">
            {hp}/{maxHp} PV
          </div>
        </div>
      </div>
      <div className="mt-2 h-2 rounded bg-stone-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-amber-300/90">
        {hasFureurSang(status) && <span className="px-1 rounded bg-red-900/50">Fureur {status.fureurSang}</span>}
        {hasStigmate(status) && <span className="px-1 rounded bg-violet-900/50">Stigmate {status.stigmate}</span>}
      </div>
    </div>
  );
}
