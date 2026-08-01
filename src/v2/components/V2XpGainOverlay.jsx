import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  V2_MAX_LEVEL,
  V2_STAT_KEYS,
  V2_STAT_LABELS,
  computeFinalStats,
} from '../data/v2Kit';
import { getXpToNextLevel } from '../data/v2XpCurve';

/**
 * Écran level-up style Fire Emblem Heroes :
 * grand portrait à gauche, panneau stats à droite avec pastilles +X.
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
  /** Gains affichés en pastilles (restent visibles jusqu’au prochain level-up / fin). */
  const [statGains, setStatGains] = useState({});
  const [barPct, setBarPct] = useState(() => {
    const need = getXpToNextLevel(beforeProto?.level || 1);
    if (!need) return 100;
    return Math.min(100, ((beforeProto?.xp || 0) / need) * 100);
  });
  const [showLevelPanel, setShowLevelPanel] = useState(false);
  const [levelFlash, setLevelFlash] = useState(false);
  const [finished, setFinished] = useState(false);
  const [phase, setPhase] = useState('xp'); // xp | levelup | done
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
      setStatGains({});
      setShowLevelPanel(false);
      setPhase('xp');
      await wait(350);

      while (remaining > 0 && !cancelled) {
        if (level >= V2_MAX_LEVEL) {
          remaining = 0;
          break;
        }

        const need = getXpToNextLevel(level);
        setDisplayNeed(need);
        setPhase('xp');
        const startPct = need ? (xp / need) * 100 : 100;
        const room = need - xp;

        if (remaining < room) {
          const targetXp = xp + remaining;
          const targetPct = need ? (targetXp / need) * 100 : 100;
          await animateBar(startPct, targetPct, 1000 + remaining * 10);
          xp = targetXp;
          remaining = 0;
          setDisplayXp(xp);
          setBarPct(targetPct);
          break;
        }

        await animateBar(startPct, 100, 800 + room * 8);
        remaining -= room;
        xp = 0;
        level += 1;
        setBarPct(100);
        setDisplayLevel(level);
        setDisplayXp(0);
        setStatGains({});
        setShowLevelPanel(true);
        setPhase('levelup');
        setLevelFlash(true);
        await wait(500);
        setLevelFlash(false);

        const gains = ups[upIndex]?.gains || {};
        upIndex += 1;
        const shown = {};
        for (const key of V2_STAT_KEYS) {
          const delta = Number(gains[key]) || 0;
          if (delta <= 0) continue;
          stats = { ...stats, [key]: (stats[key] || 0) + delta };
          shown[key] = delta;
          setDisplayStats({ ...stats });
          setStatGains({ ...shown });
          await wait(420);
        }

        await wait(700);

        const nextNeed = getXpToNextLevel(level);
        setDisplayNeed(nextNeed);
        setBarPct(0);
        if (remaining > 0) {
          setShowLevelPanel(false);
          setStatGains({});
          setPhase('xp');
          await wait(200);
        }
      }

      setDisplayLevel(afterProto?.level ?? level);
      setDisplayXp(afterProto?.xp ?? xp);
      setDisplayNeed(getXpToNextLevel(afterProto?.level ?? level));
      setDisplayStats({ ...afterStats });

      // Pastilles finales = delta total avant → après
      const totalGains = {};
      for (const key of V2_STAT_KEYS) {
        const d = (afterStats[key] || 0) - (beforeStats[key] || 0);
        if (d > 0) totalGains[key] = d;
      }
      setStatGains(totalGains);
      if (Object.keys(totalGains).length > 0 || (afterProto?.level || 0) > (beforeProto?.level || 0)) {
        setShowLevelPanel(true);
      }

      const finalNeed = getXpToNextLevel(afterProto?.level ?? level);
      const finalXp = afterProto?.xp ?? xp;
      setBarPct(finalNeed ? Math.min(100, (finalXp / finalNeed) * 100) : 100);
      setPhase('done');
      setFinished(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = beforeProto?.name || 'Héros';
  const image = beforeProto?.characterImage;
  const raceClass = [beforeProto?.race, beforeProto?.class].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-stone-950/95 text-stone-100 p-3 sm:p-6 overflow-auto">
      <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-950 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md sm:max-w-xl sm:pr-24">
        {/* Nom */}
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1">
          <h2 className="text-lg font-bold text-white">{name}</h2>
          <span className="text-amber-300 text-sm font-semibold">Lv. {displayLevel}</span>
          {raceClass && <span className="text-stone-500 text-xs">{raceClass}</span>}
          {phase === 'xp' && (
            <span className="text-amber-400/90 text-xs font-medium ml-auto">+{xpGained} EXP</span>
          )}
        </div>

        {/* Zone portrait + panneau stats */}
        <div className="relative mx-auto w-fit max-w-full">
          <div
            className={`w-[min(100%,13rem)] sm:w-52 transition duration-300 ${
              levelFlash ? 'brightness-110' : ''
            }`}
          >
            {image ? (
              <img
                src={image}
                alt={name}
                className="w-full h-auto max-h-[38vh] object-contain drop-shadow-xl"
              />
            ) : (
              <div className="h-40 flex items-center justify-center text-stone-600 text-4xl">?</div>
            )}
          </div>

          {/* Panneau stats compact — coin bas-droit du portrait */}
          <div
            className={`absolute -right-1 sm:-right-28 bottom-2 w-[10.5rem] transition-all duration-300 ${
              showLevelPanel
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
          >
            <div
              className={`rounded-xl border overflow-hidden shadow-xl backdrop-blur-md ${
                levelFlash
                  ? 'border-amber-300 bg-amber-900/55'
                  : 'border-sky-300/60 bg-sky-950/80'
              }`}
            >
              <div className="text-center py-1.5 bg-sky-900/80 border-b border-sky-400/30">
                <span
                  className={`text-base font-black tracking-wide text-white ${
                    levelFlash ? 'animate-pulse text-amber-200' : ''
                  }`}
                >
                  Lv. {displayLevel}
                </span>
              </div>
              <ul className="py-1 px-1.5 space-y-0.5">
                {V2_STAT_KEYS.map((key) => {
                  const gain = Number(statGains[key]) || 0;
                  const hasGain = gain > 0;
                  return (
                    <li
                      key={key}
                      className={`flex items-center gap-1 rounded-md px-1.5 py-1 ${
                        hasGain ? 'bg-sky-800/45' : 'bg-transparent'
                      }`}
                    >
                      <span className="w-9 shrink-0 text-[10px] font-bold uppercase text-sky-200/90">
                        {V2_STAT_LABELS[key]}
                      </span>
                      <span
                        className={`flex-1 text-center text-sm font-bold tabular-nums ${
                          hasGain ? 'text-white' : 'text-sky-50/90'
                        }`}
                      >
                        {displayStats[key]}
                      </span>
                      <span className="w-9 shrink-0 flex justify-end">
                        {hasGain ? (
                          <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1 py-0.5 rounded-full bg-sky-300 text-sky-950 text-[11px] font-black shadow-[0_0_8px_rgba(125,211,252,0.7)] animate-[v2PopIn_0.35s_ease-out]">
                            +{gain}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* Barre EXP — largeur du bloc, pas tout l’écran */}
        <div className="mt-3 rounded-lg border border-amber-700/35 bg-black/50 px-2.5 py-1.5">
          <div className="flex justify-between text-[10px] text-amber-200/75 mb-0.5">
            <span className="font-semibold tracking-wide">EXP</span>
            <span>
              {displayLevel >= V2_MAX_LEVEL
                ? 'MAX'
                : `${Math.floor(displayXp)} / ${displayNeed || '—'}`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-stone-900 border border-stone-600 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-700 via-yellow-400 to-amber-200"
              style={{ width: `${Math.max(0, Math.min(100, barPct))}%` }}
            />
          </div>
        </div>

        <div className="mt-3 flex justify-center gap-2">
          {!finished && (
            <button
              type="button"
              onClick={() => {
                skipRef.current = true;
              }}
              className="px-3 py-1.5 rounded-md border border-stone-600 bg-stone-900/80 text-stone-300 text-xs hover:bg-stone-800"
            >
              Accélérer
            </button>
          )}
          <button
            type="button"
            onClick={onDone}
            disabled={!finished}
            className="px-5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs disabled:opacity-35"
          >
            Continuer
          </button>
        </div>
      </div>

      <style>{`
        @keyframes v2PopIn {
          0% { transform: scale(0.4); opacity: 0; }
          70% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
