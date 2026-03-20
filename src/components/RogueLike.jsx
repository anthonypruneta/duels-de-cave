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
import { replayCombatSteps } from '../utils/combatReplay';
import CombatLayout from './CombatLayout';

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
  const [characterName, setCharacterName] = useState('');

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

  const [combatPlayerShield, setCombatPlayerShield] = useState(0);
  const [combatEnemyShield, setCombatEnemyShield] = useState(0);
  const [combatPlayerBase, setCombatPlayerBase] = useState(null);
  const [combatEnemyBase, setCombatEnemyBase] = useState(null);
  const [combatPlayerModifiers, setCombatPlayerModifiers] = useState(null);
  const [combatEnemyModifiers, setCombatEnemyModifiers] = useState(null);
  const [combatPlayerStatus, setCombatPlayerStatus] = useState(null);
  const [combatEnemyStatus, setCombatEnemyStatus] = useState(null);

  const logContainerRef = useRef(null);

  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const pendingAction = run?.pendingAction || null;

  const playerPseudoName = run?.character?.name || '';
  const enemyName = combatEnemy?.name || '';

  const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const renderLogLineWithColoredNames = (text) => {
    const t = String(text ?? '');
    if (!playerPseudoName && !enemyName) return t;
    const names = [];
    if (playerPseudoName) names.push({ name: playerPseudoName, cls: 'font-bold text-blue-400' });
    if (enemyName && enemyName !== playerPseudoName) names.push({ name: enemyName, cls: 'font-bold text-purple-400' });
    if (names.length === 0) return t;

    const joined = names.map((n) => escapeRegExp(n.name)).join('|');
    if (!joined) return t;

    const nameRegex = new RegExp(`(${joined})`, 'g');
    const parts = t.split(nameRegex);
    return parts.map((part, idx) => {
      const hit = names.find((n) => n.name === part);
      if (hit) return <span key={`${idx}-${part}`} className={hit.cls}>{part}</span>;
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const formatLogMessage = (text) => {
    const pName = playerPseudoName;
    const eName = enemyName;
    if (!pName || !eName) return text;

    const escapedPName = pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedEName = eName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = new RegExp(`(${escapedPName}|${escapedEName})`, 'g');

    const parts = [];
    let key = 0;
    text.split(nameRegex).forEach((part) => {
      if (!part) return;
      if (part === pName) {
        parts.push(<span key={`name-${key++}`} className="font-bold text-blue-400">{part}</span>);
        return;
      }
      if (part === eName) {
        parts.push(<span key={`name-${key++}`} className="font-bold text-purple-400">{part}</span>);
        return;
      }

      // Colorize numbers: heals (vie) = green, damage = red
      const numRegex = /(\d+)\s*(points?\s*de\s*(?:vie|dégâts?|dommages?))/gi;
      let lastIndex = 0;
      let match;
      while ((match = numRegex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          parts.push(part.slice(lastIndex, match.index));
        }
        const isHeal = String(match[2] || '').toLowerCase().includes('vie');
        const colorClass = isHeal ? 'font-bold text-green-400' : 'font-bold text-red-400';
        parts.push(<span key={`num-${key++}`} className={colorClass}>{match[1]}</span>);
        parts.push(` ${match[2]}`);
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < part.length) {
        parts.push(part.slice(lastIndex));
      }
    });
    return parts;
  };

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
    setCharacterName('');
    setCombatLogs([]);
    setCombatEnemy(null);
    autoRunWasActiveRef.current = false;
  };

  const handleStartCurrentFloorFight = async () => {
    if (!currentUser?.uid) return;
    if (!runId || !run) return;
    if (run?.status !== 'active') return;
    if (pendingAction) return;
    if (loading) return;

    setError(null);
    setLoading(true);
    try {
      const res = await advanceRogueLikeRun({ userId: currentUser.uid, runId });
      if (!res?.success) throw new Error(res?.error || 'Avance run impossible.');

      if (res?.result) {
        await playCombat(res);
      }
      setRun(res.run);
    } catch (e) {
      setError(e?.message || 'Erreur lancement combat.');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!currentUser?.uid) return;
    if (!selectedRace) return;
    setError(null);
    setLoading(true);
    try {
      const res = await startRogueLikeRun({ userId: currentUser.uid, race: selectedRace, characterName });
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

    setCombatLogs([]);
    setCombatEnemy(advanceRes?.enemy || null);

    const p1Max = advanceRes?.result?.p1MaxHP ?? steps?.[0]?.p1Base?.hp ?? 0;
    const p2Max = advanceRes?.result?.p2MaxHP ?? steps?.[0]?.p2Base?.hp ?? 0;
    setCombatPlayerMaxHp(p1Max);
    setCombatEnemyMaxHp(p2Max);
    setCombatPlayerShield(0);
    setCombatEnemyShield(0);
    setCombatPlayerBase(steps?.[0]?.p1Base || null);
    setCombatEnemyBase(steps?.[0]?.p2Base || null);
    setCombatPlayerModifiers(steps?.[0]?.p1Modifiers ?? null);
    setCombatEnemyModifiers(steps?.[0]?.p2Modifiers ?? null);
    setCombatPlayerStatus(steps?.[0]?.p1Status ?? null);
    setCombatEnemyStatus(steps?.[0]?.p2Status ?? null);

    // Anime les steps (intro / début tour / actions) pour ralentir l’auto-run
    await replayCombatSteps(steps, {
      setCombatLog: setCombatLogs,
      onStepHP: (step) => {
        setCombatPlayerHp(step?.p1HP ?? 0);
        setCombatEnemyHp(step?.p2HP ?? 0);
        setCombatPlayerShield(step?.p1Shield ?? 0);
        setCombatEnemyShield(step?.p2Shield ?? 0);
        if (step?.p1Base) setCombatPlayerBase(step.p1Base);
        if (step?.p2Base) setCombatEnemyBase(step.p2Base);
        if (step?.p1Modifiers) setCombatPlayerModifiers(step.p1Modifiers);
        if (step?.p2Modifiers) setCombatEnemyModifiers(step.p2Modifiers);
        if (step?.p1Status) setCombatPlayerStatus(step.p1Status);
        if (step?.p2Status) setCombatEnemyStatus(step.p2Status);

        if (typeof step?.p1Base?.hp === 'number') setCombatPlayerMaxHp(step.p1Base.hp);
        if (typeof step?.p2Base?.hp === 'number') setCombatEnemyMaxHp(step.p2Base.hp);
      },
      speed: 'fast',
    });
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

        // Small delay to avoid UI lock (MVP : on accélère)
        await new Promise((r) => setTimeout(r, 10));
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
                onClick={handleStartCurrentFloorFight}
                disabled={loading || autoRunActive || !!pendingAction || !run || run?.status !== 'active'}
                className="bg-stone-100 hover:bg-white disabled:bg-stone-600 disabled:text-stone-400 text-stone-900 px-4 py-2.5 rounded-lg font-bold border border-stone-400"
              >
                ▶️ Lancer le combat
              </button>
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

            <div className="mb-4">
              <CombatLayout
                p1Entity={run?.character ? {
                  name: run.character.name,
                  currentHP: combatPlayerHp,
                  maxHP: combatPlayerMaxHp,
                  shield: combatPlayerShield,
                  base: combatPlayerBase || run.character.base || {},
                } : null}
                p2Entity={combatEnemy ? {
                  name: combatEnemy.name,
                  currentHP: combatEnemyHp,
                  maxHP: combatEnemyMaxHp,
                  shield: combatEnemyShield,
                  base: combatEnemyBase || combatEnemy.base || {},
                  ability: combatEnemy.ability,
                } : null}
                p1CombatBase={combatPlayerBase}
                p2CombatBase={combatEnemyBase}
                logRef={logContainerRef}
                logTitle="⚔️ Combat en direct"
                logHeaderBg="bg-stone-900"
                renderLog={() => {
                  if (!combatLogs || combatLogs.length === 0) {
                    return (
                      <p className="text-stone-500 italic text-center py-6">Cliquez sur “Lancer le combat”...</p>
                    );
                  }

                  return combatLogs.map((log, idx) => {
                    const isP1 = log.startsWith('[P1]');
                    const isP2 = log.startsWith('[P2]');
                    const cleanLog = log.replace(/^\[P[12]\]\s*/, '');

                    if (!isP1 && !isP2) {
                      if (log.includes('🏆')) {
                        return (
                          <div key={idx} className="flex justify-center my-2">
                            <div className="bg-stone-100 text-stone-900 px-3 py-1.5 font-bold text-xs shadow-lg border border-stone-400">
                              {formatLogMessage(cleanLog)}
                            </div>
                          </div>
                        );
                      }
                      if (log.includes('💀')) {
                        return (
                          <div key={idx} className="flex justify-center my-2">
                            <div className="bg-red-900 text-red-200 px-3 py-1.5 font-bold text-xs shadow-lg border border-red-600">
                              {formatLogMessage(cleanLog)}
                            </div>
                          </div>
                        );
                      }
                      if (log.includes('💚')) {
                        return (
                          <div key={idx} className="flex justify-center my-1">
                            <div className="bg-green-900/50 text-green-300 px-2 py-0.5 text-[10px] font-bold border border-green-600">
                              {formatLogMessage(cleanLog)}
                            </div>
                          </div>
                        );
                      }
                      if (log.includes('---') || log.includes('⚔️')) {
                        return (
                          <div key={idx} className="flex justify-center my-1">
                            <div className="bg-stone-700 text-stone-200 px-2 py-0.5 text-[10px] font-bold border border-stone-500 rounded">
                              {formatLogMessage(cleanLog)}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={idx} className="flex justify-center">
                          <div className="text-stone-400 text-[10px] italic">{formatLogMessage(cleanLog)}</div>
                        </div>
                      );
                    }

                    if (isP1) {
                      return (
                        <div key={idx} className="flex justify-start">
                          <div className="max-w-[85%]">
                            <div className="bg-stone-700 text-stone-200 px-2 py-1 rounded border-l-2 border-blue-500 text-[11px]">
                              {formatLogMessage(cleanLog)}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="flex justify-end">
                        <div className="max-w-[85%]">
                          <div className="bg-stone-700 text-stone-200 px-2 py-1 rounded border-r-2 border-purple-500 text-[11px]">
                            {formatLogMessage(cleanLog)}
                          </div>
                        </div>
                      </div>
                    );
                  });
                }}
                p1Card={
                  <CharacterCardContent
                    character={run.character}
                    showHpBar
                    detailsPlacement="left"
                    currentHP={combatPlayerMaxHp > 0 ? combatPlayerHp : run.character.base?.hp}
                    maxHP={combatPlayerMaxHp > 0 ? combatPlayerMaxHp : run.character.base?.hp}
                    shield={combatPlayerShield}
                    combatBaseOverride={combatPlayerBase}
                    combatModifiers={combatPlayerModifiers}
                    opponent={combatEnemy}
                    combatStatus={combatPlayerStatus}
                    borderIdOverride={null}
                  />
                }
                p2Card={
                  <CharacterCardContent
                    character={combatEnemy}
                    showHpBar
                    detailsPlacement="right"
                    currentHP={combatEnemyMaxHp > 0 ? combatEnemyHp : combatEnemy?.base?.hp}
                    maxHP={combatEnemyMaxHp > 0 ? combatEnemyMaxHp : combatEnemy?.base?.hp}
                    shield={combatEnemyShield}
                    combatBaseOverride={combatEnemyBase}
                    combatModifiers={combatEnemyModifiers}
                    opponent={run.character}
                    combatStatus={combatEnemyStatus}
                    borderIdOverride={null}
                  />
                }
              />
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

            <div className="mb-4">
              <label className="block text-stone-200 text-sm font-bold mb-2">
                Nom du personnage
              </label>
              <input
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Ex: Serpent Géant"
                className="w-full bg-stone-950/70 border border-stone-700/80 text-stone-100 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-violet-500/60"
              />
              <div className="text-xs text-stone-400 mt-2">
                Ce nom apparaîtra dans le log de combat.
              </div>
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
                disabled={!selectedRace || loading || characterName.trim().length < 2}
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

