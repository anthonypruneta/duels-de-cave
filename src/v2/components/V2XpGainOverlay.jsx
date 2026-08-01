import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  V2_MAX_LEVEL,
  V2_STAT_KEYS,
  V2_STAT_LABELS,
  computeFinalStats,
} from '../data/v2Kit';
import { getXpToNextLevel } from '../data/v2XpCurve';

/**
 * Overlay d’XP style Fire Emblem :
 * portrait + stats, barre qui monte, level-up avec +X sur les stats.
 */
export default function V2XpGainOverlay({
  beforeProto,
  xpGained,
  levelUps = [],
  afterProto,
  onDone,
}) {
  const beforeStats = useMemo(() => computeFinalStats(beforeProto), [beforeProto]);
  const afterStats = useMemo(
    () => computeFinalStats(afterProto || beforeProto),
    [afterProto, beforeProto]
  );

  const [displayLevel, setDisplayLevel] = useState(beforeProto?.level || 1);
  const [displayXp, setDisplayXp] = useState(beforeProto?.xp || 0);
  const [displayNeed, setDisplayNeed] = useState(
    getXpToNextLevel(beforeProto?.level || 1)
  );
  const [displayStats, setDisplayStats] = useState(() => ({ ...beforeStats }));
  const [statPops, setStatPops] = useState({});
  const [barPct, setBarPct] = useState(() => {
    const need = getXpToNextLevel(beforeProto?.level || 1);
    if (!need) return 100;
    return Math.min(100, ((beforeProto?.xp || 0) / need) * 100);
  });
  const [phaseLabel, setPhaseLabel] = useState(`+${xpGained} XP`);
  const [levelFlash, setLevelFlash] = useState(false);
  const [finished, setFinished] = useState(false);
  const runningRef = useRef(false);
  const skipRef = useRef(false);

  useEffect(() => {
    if (runningRef.current) return undefined;
    runningRef.current = true;
    let cancelled = false;

    const wait = (ms) =>
      new Promise((resolve) => {
        const start = performance.now();
        const step = (now) => {
          if (cancelled || skipRef.current) {
            skipRef.current = false;
            resolve();
            return;
          }
          if (now - start >= ms) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

    const animateBar = (fromPct, toPct, duration) =>
      new Promise((resolve) => {
        const t0 = performance.now();
        const tick = (now) => {
          if (cancelled) {
            resolve();
            return;
          }
          if (skipRef.current) {
            skipRef.current = false;
            setBarPct(toPct);
            resolve();
            return;
          }
          const t = Math.min(1, (now - t0) / duration);
          const eased = 1 - (1 - t) * (1 - t);
          setBarPct(fromPct + (toPct - fromPct) * eased);
          if (t < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });

    (async () => {
      let level = Number(beforeProto?.level) || 1;
      let xp = Number(beforeProto?.xp) || 0;
      let remaining = Math.max(0, Math.floor(Number(xpGained) || 0));
      let stats = { ...beforeStats };
      const ups = [...(levelUps || [])];
      let upIndex = 0;

      setDisplayLevel(level);
      setDisplayXp(xp);
      setDisplayStats(stats);
      setPhaseLabel(`+${xpGained} XP`);
      await wait(400);

      while (remaining > 0 && !cancelled) {
        if (level >= V2_MAX_LEVEL) {
          remaining = 0;
          break;
        }

        const need = getXpToNextLevel(level);
        setDisplayNeed(need);
        const startPct = need ? (xp / need) * 100 : 100;
        const room = need - xp;

        if (remaining < room) {
          const targetXp = xp + remaining;
          const targetPct = need ? (targetXp / need) * 100 : 100;
          await animateBar(startPct, targetPct, 900 + remaining * 8);
          xp = targetXp;
          remaining = 0;
          setDisplayXp(xp);
          setBarPct(targetPct);
          break;
        }

        // Remplit jusqu’au level-up
        await animateBar(startPct, 100, 700 + room * 6);
        remaining -= room;
        xp = 0;
        level += 1;
        setBarPct(100);
        setDisplayLevel(level);
        setDisplayXp(0);
        setLevelFlash(true);
        setPhaseLabel(`NIVEAU ${level} !`);
        await wait(550);
        setLevelFlash(false);

        const gains = ups[upIndex]?.gains || {};
        upIndex += 1;
        for (const key of V2_STAT_KEYS) {
          const delta = Number(gains[key]) || 0;
          if (delta <= 0) continue;
          stats = { ...stats, [key]: (stats[key] || 0) + delta };
          setDisplayStats({ ...stats });
          setStatPops((prev) => ({ ...prev, [key]: delta }));
          await wait(380);
          setStatPops((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          await wait(120);
        }

        const nextNeed = getXpToNextLevel(level);
        setDisplayNeed(nextNeed);
        setBarPct(0);
        setPhaseLabel(remaining > 0 ? `+${remaining} XP restants` : 'Niveau supérieur !');
        await wait(250);
      }

      // Aligne l’affichage final (sécurité)
      setDisplayLevel(afterProto?.level ?? level);
      setDisplayXp(afterProto?.xp ?? xp);
      setDisplayNeed(getXpToNextLevel(afterProto?.level ?? level));
      setDisplayStats({ ...afterStats });
      const finalNeed = getXpToNextLevel(afterProto?.level ?? level);
      const finalXp = afterProto?.xp ?? xp;
      setBarPct(finalNeed ? Math.min(100, (finalXp / finalNeed) * 100) : 100);
      setPhaseLabel('Terminé');
      setFinished(true);
    })();

    return () => {
      cancelled = true;
    };
    // Animation one-shot à l’ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = beforeProto?.name || 'Héros';
  const image = beforeProto?.characterImage;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 px-4">
      <div
        className={`w-full max-w-md rounded-xl border border-amber-700/50 bg-gradient-to-b from-stone-900 to-stone-950 p-5 shadow-2xl transition ${
          levelFlash ? 'ring-2 ring-amber-400 scale-[1.02]' : ''
        }`}
      >
        <div className="flex gap-4">
          <div className="w-28 h-28 shrink-0 rounded-lg border border-stone-600 bg-stone-950 overflow-hidden flex items-center justify-center">
            {image ? (
              <img src={image} alt={name} className="w-full h-full object-contain" />
            ) : (
              <span className="text-stone-500 text-xs">?</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-amber-300 truncate">{name}</div>
            <div className="text-sm text-stone-300 mt-1">
              Niveau{' '}
              <span className={`font-bold ${levelFlash ? 'text-amber-200 animate-pulse' : 'text-amber-400'}`}>
                {displayLevel}
              </span>
            </div>
            <div className="text-xs text-amber-500/90 mt-2 font-semibold tracking-wide uppercase">
              {phaseLabel}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-stone-400 mb-1">
            <span>EXP</span>
            <span>
              {displayLevel >= V2_MAX_LEVEL
                ? 'MAX'
                : `${Math.floor(displayXp)} / ${displayNeed || '—'}`}
            </span>
          </div>
          <div className="h-3 rounded-full bg-stone-800 border border-stone-600 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-300 transition-[width] duration-75"
              style={{ width: `${Math.max(0, Math.min(100, barPct))}%` }}
            />
          </div>
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-2">
          {V2_STAT_KEYS.map((key) => {
            const pop = statPops[key];
            const grew = (afterStats[key] || 0) > (beforeStats[key] || 0);
            return (
              <li
                key={key}
                className={`relative rounded border px-2 py-1.5 ${
                  pop ? 'border-emerald-400 bg-emerald-950/40' : 'border-stone-700 bg-stone-900/70'
                }`}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-stone-500">
                    {V2_STAT_LABELS[key]}
                  </span>
                  <span
                    className={`font-bold tabular-nums ${
                      pop || (finished && grew) ? 'text-emerald-300' : 'text-stone-100'
                    }`}
                  >
                    {displayStats[key]}
                  </span>
                </div>
                {pop != null && (
                  <span className="absolute -right-1 -top-2 text-sm font-bold text-emerald-300 drop-shadow animate-bounce">
                    +{pop}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex gap-2">
          {!finished && (
            <button
              type="button"
              onClick={() => {
                skipRef.current = true;
              }}
              className="flex-1 py-2 rounded border border-stone-600 text-stone-300 text-sm hover:bg-stone-800"
            >
              Accélérer
            </button>
          )}
          <button
            type="button"
            onClick={onDone}
            disabled={!finished}
            className="flex-1 py-2 rounded bg-amber-700/90 hover:bg-amber-600 text-stone-950 font-bold text-sm disabled:opacity-40"
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
