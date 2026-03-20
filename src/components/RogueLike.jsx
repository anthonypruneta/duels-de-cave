import React, { useEffect, useMemo, useRef, useState } from 'react';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { useAuth } from '../contexts/AuthContext';
import { races } from '../data/races';
import { getClassBonus } from '../data/combatMechanics';
import { getStatPointValue } from '../utils/statPoints';
import {
  startRogueLikeRun,
  getLatestActiveRogueLikeRun,
  advanceRogueLikeRun,
  applyRogueLikeChoice,
  getRogueLikeLeaderboard,
} from '../services/rogueLikeService';

function pickRandomThree(list) {
  const cloned = [...list];
  const picked = [];
  while (picked.length < 3 && cloned.length > 0) {
    const idx = Math.floor(Math.random() * cloned.length);
    picked.push(cloned.splice(idx, 1)[0]);
  }
  return picked;
}

export default function RogueLike() {
  const { currentUser } = useAuth();
  const allRaceNames = useMemo(() => Object.keys(races), []);

  const [availableRaces, setAvailableRaces] = useState(() => pickRandomThree(allRaceNames));
  const [selectedRace, setSelectedRace] = useState(null);

  const [runId, setRunId] = useState(null);
  const [run, setRun] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [autoRunActive, setAutoRunActive] = useState(false);
  const autoRunTokenRef = useRef(null);
  const autoRunWasActiveRef = useRef(false);

  const [combatLogs, setCombatLogs] = useState([]);
  const [combatEnemy, setCombatEnemy] = useState(null);
  const [combatPlayerHp, setCombatPlayerHp] = useState(0);
  const [combatPlayerMaxHp, setCombatPlayerMaxHp] = useState(0);
  const [combatEnemyHp, setCombatEnemyHp] = useState(0);
  const [combatEnemyMaxHp, setCombatEnemyMaxHp] = useState(0);

  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const pendingAction = run?.pendingAction || null;

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!currentUser?.uid) return;
      const res = await getLatestActiveRogueLikeRun(currentUser.uid);
      if (!mounted) return;
      if (res?.success && res?.run) {
        setRunId(res.runId);
        setRun(res.run);
      }
    };
    init();
    return () => { mounted = false; };
  }, [currentUser?.uid]);

  useEffect(() => {
    let mounted = true;
    const loadLeaderboard = async () => {
      if (!currentUser?.uid) return;
      if (!run?.status || run.status !== 'dead') return;
      setLeaderboardLoading(true);
      try {
        const res = await getRogueLikeLeaderboard({ limit: 10 });
        if (!mounted) return;
        setLeaderboard(res?.data || []);
      } finally {
        if (mounted) setLeaderboardLoading(false);
      }
    };
    loadLeaderboard();
    return () => { mounted = false; };
  }, [run?.status, currentUser?.uid]);

  useEffect(() => () => {
    if (autoRunTokenRef.current) autoRunTokenRef.current.cancelled = true;
  }, []);

  const stopAutoRun = () => {
    if (autoRunTokenRef.current) autoRunTokenRef.current.cancelled = true;
    autoRunTokenRef.current = null;
    setAutoRunActive(false);
  };

  const resetToRaceSelect = () => {
    stopAutoRun();
    setRunId(null);
    setRun(null);
    setAvailableRaces(pickRandomThree(allRaceNames));
    setSelectedRace(null);
    setCombatLogs([]);
    setCombatEnemy(null);
    autoRunWasActiveRef.current = false;
  };

  const handleStart = async () => {
    if (!currentUser?.uid) return;
    if (!selectedRace) return;
    setError(null);
    setLoading(true);
    try {
      const res = await startRogueLikeRun({ userId: currentUser.uid, race: selectedRace });
      if (!res?.success) throw new Error(res?.error || 'Erreur démarrage run.');
      setRunId(res.runId);
      setRun(res.run);
      setCombatLogs([]);
      setCombatEnemy(null);
    } catch (e) {
      setError(e?.message || 'Erreur.');
    } finally {
      setLoading(false);
    }
  };

  const playCombat = async (advanceRes) => {
    const steps = advanceRes?.result?.steps || [];
    const lastStep = steps.at(-1);
    setCombatLogs(advanceRes?.result?.combatLog || []);
    setCombatEnemy(advanceRes?.enemy || null);
    setCombatPlayerHp(lastStep?.p1HP ?? 0);
    setCombatPlayerMaxHp(lastStep?.p1Base?.hp ?? lastStep?.p1HP ?? 0);
    setCombatEnemyHp(lastStep?.p2HP ?? 0);
    setCombatEnemyMaxHp(lastStep?.p2Base?.hp ?? lastStep?.p2HP ?? 0);
  };

  const handleAutoRun = async () => {
    if (!currentUser?.uid) return;
    if (!runId || !run) return;
    if (autoRunActive) return;
    setError(null);

    const token = { cancelled: false };
    autoRunTokenRef.current = token;
    setAutoRunActive(true);
    autoRunWasActiveRef.current = true;
    setLoading(true);

    try {
      while (!token.cancelled) {
        // Si on est en plein choix, on stop.
        if (run?.pendingAction) break;

        const res = await advanceRogueLikeRun({ userId: currentUser.uid, runId });
        if (!res?.success) {
          throw new Error(res?.error || 'Avance run impossible.');
        }
        if (res?.result) {
          await playCombat(res);
        }
        setRun(res.run);

        if (res?.pendingAction) {
          stopAutoRun();
          break;
        }
        if (res?.isDead || res?.run?.status === 'dead') {
          stopAutoRun();
          break;
        }

        // Small delay to avoid UI lock
        await new Promise((r) => setTimeout(r, 50));
      }
    } catch (e) {
      setError(e?.message || 'Erreur auto-run.');
    } finally {
      setLoading(false);
      autoRunTokenRef.current = null;
      setAutoRunActive(false);
    }
  };

  const handleApplyChoice = async (choice) => {
    if (!currentUser?.uid || !runId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await applyRogueLikeChoice({ userId: currentUser.uid, runId, choice });
      if (!res?.success) throw new Error(res?.error || 'Choix invalide.');
      setRun(res.run || res);
      // On relance automatiquement si l’auto-run était active juste avant.
      if (autoRunWasActiveRef.current && !autoRunActive) {
        // Attendre la fermeture du modal (state) avant de relancer.
        setTimeout(() => {
          handleAutoRun();
        }, 150);
      }
    } catch (e) {
      setError(e?.message || 'Erreur application choix.');
    } finally {
      setLoading(false);
    }
  };

  const pendingModal = pendingAction ? (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-stone-900 border border-violet-600/70 rounded-xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-violet-200">Choix d’amélioration</h2>
          <div className="text-xs text-stone-300 font-bold uppercase tracking-wider">
            {pendingAction.type}
          </div>
        </div>

        {pendingAction.type === 'chooseClass' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingAction.options?.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleApplyChoice({ classId: opt.id })}
                className="p-4 rounded-lg bg-stone-950/60 hover:bg-violet-900/20 border border-stone-700/70 hover:border-violet-400/60 text-left"
              >
                <div className="text-3xl mb-2">{opt.icon}</div>
                <div className="font-bold text-stone-100">{opt.id}</div>
                <div className="text-xs text-stone-300 mt-1">{opt.ability}</div>
              </button>
            ))}
          </div>
        )}

        {pendingAction.type === 'forestChoice' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingAction.options?.map((opt, idx) => (
              <button
                key={`forest-${idx}`}
                onClick={() => handleApplyChoice({ optionIndex: idx })}
                className="p-4 rounded-lg bg-stone-950/60 hover:bg-violet-900/20 border border-stone-700/70 hover:border-violet-400/60 text-left"
              >
                <div className="text-amber-300 font-bold mb-2">Option {idx + 1}</div>
                <div className="text-xs text-stone-200 whitespace-pre-line">
                  {Object.entries(opt.gainsByStat || {})
                    .filter(([, v]) => v)
                    .map(([k, v]) => `${k}: +${v}`)
                    .join('\n')}
                </div>
              </button>
            ))}
          </div>
        )}

        {pendingAction.type === 'mageTowerPassiveChoice' && (
          <div className="space-y-4">
            {pendingAction.keepOption && (
              <button
                onClick={() => handleApplyChoice({ optionIndex: -1 })}
                className="w-full bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-600 px-4 py-3 rounded-lg font-bold"
              >
                Garder mon passif actuel
              </button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {pendingAction.options?.map((opt, idx) => (
                <button
                  key={`magt-${opt.id}-${idx}`}
                  onClick={() => handleApplyChoice({ optionIndex: idx })}
                  className="p-4 rounded-lg bg-stone-950/60 hover:bg-violet-900/20 border border-stone-700/70 hover:border-violet-400/60 text-left"
                >
                  <div className="text-3xl mb-2">✨</div>
                  <div className="font-bold text-stone-100 text-sm">{opt.id}</div>
                  <div className="text-xs text-stone-300 mt-1">Niveau {opt.level}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {pendingAction.type === 'genericMageTowerPassiveChoice' && (
          <div className="space-y-4">
            {pendingAction.keepOption && (
              <button
                onClick={() => handleApplyChoice({ optionIndex: -1 })}
                className="w-full bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-600 px-4 py-3 rounded-lg font-bold"
              >
                Garder mon passif actuel
              </button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {pendingAction.options?.map((opt, idx) => (
                <button
                  key={`gpass-${opt.id}-${idx}`}
                  onClick={() => handleApplyChoice({ optionIndex: idx })}
                  className="p-4 rounded-lg bg-stone-950/60 hover:bg-violet-900/20 border border-stone-700/70 hover:border-violet-400/60 text-left"
                >
                  <div className="text-3xl mb-2">{opt.icon || '✨'}</div>
                  <div className="font-bold text-stone-100 text-sm">{opt.name || opt.id}</div>
                  <div className="text-xs text-stone-300 mt-1">Niveau {opt.level}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {pendingAction.type === 'extensionChoice' && (
          <div className="space-y-4">
            {pendingAction.keepOption && (
              <button
                onClick={() => handleApplyChoice({ keep: true })}
                className="w-full bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-600 px-4 py-3 rounded-lg font-bold"
              >
                Garder mon extension actuelle
              </button>
            )}
            <button
              onClick={() => handleApplyChoice({ keep: false })}
              className="w-full bg-violet-700 hover:bg-violet-600 text-white border border-violet-500 px-4 py-3 rounded-lg font-bold"
            >
              Prendre la nouvelle extension
            </button>
          </div>
        )}

        {pendingAction.type === 'legendaryWeaponChoice' && (
          <div className="space-y-4">
            {pendingAction.keepOption && (
              <button
                onClick={() => handleApplyChoice({ optionIndex: -1 })}
                className="w-full bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-600 px-4 py-3 rounded-lg font-bold"
              >
                Garder mon arme actuelle
              </button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {pendingAction.options?.map((opt, idx) => (
                <button
                  key={`weap-${opt.id}-${idx}`}
                  onClick={() => handleApplyChoice({ optionIndex: idx })}
                  className="p-4 rounded-lg bg-stone-950/60 hover:bg-violet-900/20 border border-stone-700/70 hover:border-violet-400/60 text-left"
                >
                  <div className="text-3xl mb-2">{opt.icon}</div>
                  <div className="font-bold text-stone-100 text-sm">{opt.name}</div>
                  <div className="text-xs text-stone-300 mt-1">
                    {Object.entries(opt.stats || {}).filter(([, v]) => v !== 0).slice(0, 3)
                      .map(([k, v]) => `${k}${v > 0 ? `+${v}` : v}`)
                      .join(' • ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {pendingAction.type === 'genericWeaponChoice' && (
          <div className="space-y-4">
            {pendingAction.keepOption && (
              <button
                onClick={() => handleApplyChoice({ optionIndex: -1 })}
                className="w-full bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-600 px-4 py-3 rounded-lg font-bold"
              >
                Garder mon arme actuelle
              </button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {pendingAction.options?.map((opt, idx) => (
                <button
                  key={`gweap-${opt.id}-${idx}`}
                  onClick={() => handleApplyChoice({ optionIndex: idx })}
                  className="p-4 rounded-lg bg-stone-950/60 hover:bg-violet-900/20 border border-stone-700/70 hover:border-violet-400/60 text-left"
                >
                  <div className="text-3xl mb-2">{opt.icon}</div>
                  <div className="font-bold text-stone-100 text-sm">{opt.name}</div>
                  <div className="text-xs text-stone-300 mt-1">
                    {Object.entries(opt.stats || {}).filter(([, v]) => v !== 0).slice(0, 3).map(([k, v]) => `${k}${v > 0 ? `+${v}` : v}`).join(' • ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {pendingAction.type === 'forgeChoice' && (
          <div className="space-y-4">
            <button
              onClick={() => handleApplyChoice({ keep: true })}
              className="w-full bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-600 px-4 py-3 rounded-lg font-bold"
            >
              Garder l’ancien forge
            </button>
            <button
              onClick={() => handleApplyChoice({ keep: false })}
              className="w-full bg-violet-700 hover:bg-violet-600 text-white border border-violet-500 px-4 py-3 rounded-lg font-bold"
            >
              Accepter la nouvelle forge
            </button>
          </div>
        )}

        {pendingAction.type === 'subclassChoice' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingAction.options?.map((opt, idx) => (
              <button
                key={`sub-${opt.id}`}
                onClick={() => handleApplyChoice({ optionIndex: idx })}
                className="p-4 rounded-lg bg-stone-950/60 hover:bg-violet-900/20 border border-stone-700/70 hover:border-violet-400/60 text-left"
              >
                <div className="text-amber-300 font-bold mb-2">{opt.name}</div>
                <div className="text-xs text-stone-300">{opt.id}</div>
              </button>
            ))}
          </div>
        )}

        {pendingAction.type === 'special150' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingAction.options?.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  if (opt.id === 'changeWeapon') handleApplyChoice({ specialId: 'changeWeapon', weaponIndex: 0 });
                  else handleApplyChoice({ specialId: opt.id });
                }}
                className="p-4 rounded-lg bg-stone-950/60 hover:bg-violet-900/20 border border-stone-700/70 hover:border-violet-400/60 text-left"
              >
                <div className="text-amber-300 font-bold mb-2">{opt.label}</div>
                <div className="text-xs text-stone-300">
                  {opt.id === 'changeWeapon' && `1ère arme légendaire rollée (MVP)`}
                  {opt.id === 'changeSubclass' && opt.subclass ? `=> ${opt.subclass.name}` : ''}
                  {opt.id === 'levelUp' && `+5 niveaux de stats (roll)`}
                </div>
              </button>
            ))}
          </div>
        )}

        {error && <div className="text-red-300 text-sm mt-4">⚠️ {error}</div>}
      </div>
    </div>
  ) : null;

  // UI: sélection / run
  return (
    <div className="min-h-screen p-6">
      <Header />

      <div className="max-w-5xl mx-auto pt-24">
        <div className="flex justify-center mb-6">
          <div className="bg-stone-950/85 border border-violet-700/80 rounded-lg px-6 py-2 shadow">
            <h1 className="text-2xl font-bold text-violet-300">🟣 Rogue-like (MVP admin)</h1>
          </div>
        </div>

        {runId && run?.character ? (
          <>
            <div className="flex flex-wrap justify-center gap-3 mb-5">
              <div className="bg-stone-950/85 border border-stone-700/80 rounded-lg px-5 py-2 shadow">
                <div className="text-stone-300 text-sm font-bold">
                  Étage <span className="text-violet-300">{run.currentFloor || 1}</span> • Meilleur <span className="text-violet-300">{run.highestClearedFloor || 0}</span>
                </div>
              </div>
              <div className="bg-stone-950/85 border border-stone-700/80 rounded-lg px-5 py-2 shadow">
                <div className="text-stone-300 text-sm font-bold">
                  Auto-run: <span className={autoRunActive ? 'text-green-400' : 'text-stone-400'}>{autoRunActive ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-3 mb-4">
              <button
                onClick={handleAutoRun}
                disabled={loading || autoRunActive || !!pendingAction || !run || run?.status !== 'active'}
                className="bg-violet-700 hover:bg-violet-600 disabled:bg-stone-700 disabled:text-stone-400 text-white border border-violet-500 px-5 py-2.5 rounded-lg font-bold"
              >
                ▶️ Auto-run
              </button>
              <button
                onClick={stopAutoRun}
                disabled={!autoRunActive}
                className="bg-red-700 hover:bg-red-600 disabled:bg-stone-700 disabled:text-stone-400 text-white border border-red-500 px-5 py-2.5 rounded-lg font-bold"
              >
                ⏹️ Stop
              </button>
              <button
                onClick={resetToRaceSelect}
                className="bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-600 px-5 py-2.5 rounded-lg font-bold"
              >
                Quit
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start mb-4">
              <div className="lg:col-span-1">
                <CharacterCardContent
                  character={run.character}
                  showHpBar
                  detailsPlacement="right"
                  currentHP={combatPlayerMaxHp > 0 ? combatPlayerHp : run.character.base?.hp}
                  maxHP={combatPlayerMaxHp > 0 ? combatPlayerMaxHp : run.character.base?.hp}
                  shield={0}
                  borderIdOverride={null}
                />
              </div>
              <div className="lg:col-span-1 flex justify-center">
                <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl w-full h-[420px] overflow-hidden">
                  <div className="bg-stone-900 p-3 border-b border-stone-700">
                    <h2 className="text-sm font-bold text-stone-200">Log de combat</h2>
                  </div>
                  <div className="p-3 overflow-y-auto space-y-1 text-xs text-stone-200">
                    {combatLogs.length === 0 ? (
                      <div className="text-stone-400 italic py-6 text-center">Lance l’auto-run pour commencer.</div>
                    ) : (
                      combatLogs.map((line, idx) => (
                        <div key={idx} className={line.includes('💀') ? 'text-red-200' : line.includes('🏆') ? 'text-green-200' : ''}>
                          {line}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-1">
                <CharacterCardContent
                  character={combatEnemy}
                  showHpBar
                  detailsPlacement="left"
                  currentHP={combatEnemyMaxHp > 0 ? combatEnemyHp : combatEnemy?.base?.hp}
                  maxHP={combatEnemyMaxHp > 0 ? combatEnemyMaxHp : combatEnemy?.base?.hp}
                  shield={0}
                  borderIdOverride={null}
                />
              </div>
            </div>

            {run?.status === 'dead' && (
              <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl p-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-200 mb-1">💀 Run terminée</div>
                  <div className="text-stone-200 text-sm">
                    Meilleur étage : <span className="text-violet-300 font-bold">{run.highestClearedFloor || 0}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-stone-300 font-bold text-sm mb-2 text-center">Top Rogue-like</div>
                  {leaderboardLoading ? (
                    <div className="text-stone-400 text-center text-sm">Chargement...</div>
                  ) : (
                    <div className="space-y-1">
                      {(leaderboard || []).map((e, idx) => (
                        <div key={e.id} className="flex justify-between gap-3 bg-stone-900/40 border border-stone-800 rounded-lg px-3 py-2">
                          <div className="text-stone-100 text-sm font-bold truncate">{idx + 1}. {e.userPseudo || e.userId || 'Anonyme'}</div>
                          <div className="text-violet-300 text-sm font-bold whitespace-nowrap">+{e.maxFloor || 0}</div>
                        </div>
                      ))}
                      {(leaderboard || []).length === 0 && (
                        <div className="text-stone-400 text-center text-sm py-2">Aucune entrée pour l’instant.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {pendingModal}
            {error && <div className="text-red-300 text-center text-sm mt-4">⚠️ {error}</div>}
          </>
        ) : (
          <>
            <div className="text-stone-200 text-center mb-6">
              Pour le test: tu ne peux choisir qu&apos;entre <span className="text-violet-300 font-bold">3</span> races au début.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {availableRaces.map((raceName) => (
                <button
                  key={raceName}
                  onClick={() => setSelectedRace(raceName)}
                  className={`p-5 rounded-xl border transition cursor-pointer ${
                    selectedRace === raceName
                      ? 'bg-violet-900/40 border-violet-400/80 text-white shadow-lg'
                      : 'bg-stone-950/70 border-stone-700/80 text-stone-200 hover:bg-violet-900/20 hover:border-violet-400/40'
                  }`}
                >
                  <div className="text-4xl mb-2">{races[raceName]?.icon ?? '❓'}</div>
                  <div className="text-lg font-bold">{raceName}</div>
                  <div className="text-xs mt-2 text-stone-300 leading-relaxed whitespace-pre-line">
                    {races[raceName]?.bonus ?? ''}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => setAvailableRaces(pickRandomThree(allRaceNames))}
                className="bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-600 px-6 py-2.5 rounded-lg font-bold"
              >
                Re-tirer les 3 races
              </button>
              <button
                onClick={handleStart}
                disabled={!selectedRace || loading}
                className="bg-violet-700 hover:bg-violet-600 disabled:bg-stone-700 disabled:text-stone-400 text-white border border-violet-500 px-6 py-2.5 rounded-lg font-bold"
              >
                {loading ? '⏳...' : 'Choisir cette race'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

