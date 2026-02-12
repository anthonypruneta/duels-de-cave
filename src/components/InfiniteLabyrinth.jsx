import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../contexts/AuthContext';
import {
  ensureWeeklyInfiniteLabyrinth,
  getCurrentWeekId,
  getUserLabyrinthProgress,
  launchLabyrinthCombat
} from '../services/infiniteLabyrinthService';

const InfiniteLabyrinth = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [weekId, setWeekId] = useState(getCurrentWeekId());
  const [labyrinthData, setLabyrinthData] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [combatResult, setCombatResult] = useState(null);

  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [isReplayAnimating, setIsReplayAnimating] = useState(false);
  const [replayLogs, setReplayLogs] = useState([]);
  const [replayP1HP, setReplayP1HP] = useState(0);
  const [replayP2HP, setReplayP2HP] = useState(0);
  const [replayP1MaxHP, setReplayP1MaxHP] = useState(0);
  const [replayP2MaxHP, setReplayP2MaxHP] = useState(0);
  const [replayWinner, setReplayWinner] = useState('');
  const [replayP1Name, setReplayP1Name] = useState('Vous');
  const [replayP2Name, setReplayP2Name] = useState('Ennemi');
  const [isAutoRunActive, setIsAutoRunActive] = useState(false);

  const replayTokenRef = useRef(null);
  const replayTimeoutRef = useRef(null);
  const autoRunTokenRef = useRef(null);

  const currentFloor = progress?.currentFloor || 1;
  const currentFloorData = labyrinthData?.floors?.find((f) => f.floorNumber === currentFloor) || null;

  const delayReplay = (ms) => new Promise((resolve) => {
    replayTimeoutRef.current = setTimeout(resolve, ms);
  });

  const closeReplay = () => {
    if (replayTokenRef.current) replayTokenRef.current.cancelled = true;
    if (replayTimeoutRef.current) {
      clearTimeout(replayTimeoutRef.current);
      replayTimeoutRef.current = null;
    }
    setIsReplayAnimating(false);
    setIsReplayOpen(false);
  };

  const stopAutoRun = () => {
    if (autoRunTokenRef.current) {
      autoRunTokenRef.current.cancelled = true;
      autoRunTokenRef.current = null;
    }
    setIsAutoRunActive(false);
  };

  const playReplay = async (result) => {
    if (!result?.result) return;

    if (replayTokenRef.current) replayTokenRef.current.cancelled = true;
    if (replayTimeoutRef.current) {
      clearTimeout(replayTimeoutRef.current);
      replayTimeoutRef.current = null;
    }

    const token = { cancelled: false };
    replayTokenRef.current = token;

    const data = result.result;
    setReplayP1Name('Vous');
    setReplayP2Name(result.floor?.enemyName || 'Ennemi');
    setReplayP1MaxHP(data.p1MaxHP || 0);
    setReplayP2MaxHP(data.p2MaxHP || 0);
    setReplayP1HP(data.p1MaxHP || 0);
    setReplayP2HP(data.p2MaxHP || 0);
    setReplayLogs([]);
    setReplayWinner('');
    setIsReplayOpen(true);
    setIsReplayAnimating(true);

    const steps = data.steps || [];
    if (steps.length > 0) {
      for (const step of steps) {
        if (token.cancelled) return;
        for (const line of (step.logs || [])) {
          if (token.cancelled) return;
          setReplayLogs((prev) => [...prev, line]);
          await delayReplay(step.phase === 'victory' ? 170 : 240);
        }
        setReplayP1HP(step.p1HP ?? 0);
        setReplayP2HP(step.p2HP ?? 0);
        await delayReplay(step.phase === 'action' ? 560 : 320);
      }
    } else {
      for (const line of (data.combatLog || [])) {
        if (token.cancelled) return;
        setReplayLogs((prev) => [...prev, line]);
        await delayReplay(line.includes('---') ? 450 : 250);
      }
    }

    if (token.cancelled) return;
    setReplayWinner(data.winnerNom || (result.didWin ? 'Vous' : (result.floor?.enemyName || 'Ennemi')));
    setIsReplayAnimating(false);
  };

  const loadLabyrinthData = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    setError('');
    try {
      const resolvedWeekId = getCurrentWeekId();
      setWeekId(resolvedWeekId);
      const labyrinthResult = await ensureWeeklyInfiniteLabyrinth(resolvedWeekId);
      if (!labyrinthResult.success) {
        setError(labyrinthResult.error || 'Impossible de charger le labyrinthe.');
        return;
      }
      setLabyrinthData(labyrinthResult.data);

      const progressResult = await getUserLabyrinthProgress(currentUser.uid, resolvedWeekId);
      if (!progressResult.success) {
        setError(progressResult.error || 'Impossible de charger la progression.');
        return;
      }
      setProgress(progressResult.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabyrinthData();
  }, [currentUser?.uid]);

  useEffect(() => () => {
    if (replayTokenRef.current) replayTokenRef.current.cancelled = true;
    if (replayTimeoutRef.current) clearTimeout(replayTimeoutRef.current);
    if (autoRunTokenRef.current) autoRunTokenRef.current.cancelled = true;
  }, []);

  const handleStartCurrentFloorFight = async () => {
    if (!currentUser?.uid) return;
    if (isAutoRunActive) return;
    setLoading(true);
    setError('');
    setIsAutoRunActive(true);

    const token = { cancelled: false };
    autoRunTokenRef.current = token;

    try {
      while (!token.cancelled) {
        const result = await launchLabyrinthCombat({ userId: currentUser.uid, weekId });
        if (!result.success) {
          setError(result.error || 'Combat impossible.');
          break;
        }

        setCombatResult(result);
        setProgress(result.progress);

        if (result.rewardGranted) {
          setReplayLogs((prev) => [...prev, '🎁 Boss vaincu: +5 essais de donjon.']);
        }

        await playReplay(result);
        if (token.cancelled) break;

        if (!result.didWin) {
          break;
        }

        if ((result.progress?.currentFloor || 1) > 100) {
          break;
        }
      }
    } finally {
      autoRunTokenRef.current = null;
      setIsAutoRunActive(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-6xl mx-auto pt-20">
        <div className="bg-stone-900/70 border-2 border-fuchsia-500 rounded-xl p-6 mb-6">
          <h1 className="text-4xl font-bold text-fuchsia-300 mb-2">🌀 Labyrinthe Infini</h1>
          <p className="text-stone-300">Labyrinthe hebdomadaire global • reset après le tournoi du samedi.</p>

          {error && <p className="text-red-300 mt-3">⚠️ {error}</p>}

          <div className="grid md:grid-cols-4 gap-3 mt-4 text-sm">
            <div className="bg-stone-800/70 rounded p-3"><p className="text-stone-400">WeekId</p><p className="text-white font-bold">{weekId}</p></div>
            <div className="bg-stone-800/70 rounded p-3"><p className="text-stone-400">Étage actuel</p><p className="text-white font-bold">{currentFloor}</p></div>
            <div className="bg-stone-800/70 rounded p-3"><p className="text-stone-400">Max clear</p><p className="text-white font-bold">{progress?.highestClearedFloor ?? 0}</p></div>
            <div className="bg-stone-800/70 rounded p-3"><p className="text-stone-400">Boss vaincus</p><p className="text-white font-bold">{progress?.bossesDefeated ?? 0}</p></div>
          </div>

          {currentFloorData && (
            <div className="mt-4 bg-stone-800/50 rounded p-3 border border-stone-700 flex items-center gap-3">
              <img src={currentFloorData.imagePath} alt={currentFloorData.enemyName} className="w-14 h-14 object-contain" />
              <div>
                <p className="text-white font-bold">Étage {currentFloorData.floorNumber} • {currentFloorData.type === 'boss' ? '👑 Boss' : '👾 Monstre'}</p>
                <p className="text-stone-300 text-sm">{currentFloorData.enemyName}</p>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button onClick={handleStartCurrentFloorFight} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-3 rounded-lg font-bold">
              {loading ? '⏳ Combats enchaînés...' : `⚔️ Lancer les combats (depuis étage ${currentFloor})`}
            </button>
            <button onClick={stopAutoRun} disabled={!isAutoRunActive} className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-5 py-3 rounded-lg font-bold">
              ⏹️ Stop enchaînement
            </button>
            <button onClick={() => navigate('/')} className="bg-stone-700 hover:bg-stone-600 text-white px-5 py-3 rounded-lg font-bold">← Retour</button>
          </div>

          {isAutoRunActive && (
            <p className="mt-3 text-amber-300 text-sm">Les combats s'enchaînent automatiquement jusqu'à défaite, stop manuel, ou étage 100.</p>
          )}

          {combatResult && (
            <div className="mt-4 bg-stone-800/50 rounded p-3 border border-stone-700 text-sm">
              Résultat dernier combat: <span className="font-bold text-white">{combatResult.didWin ? '🏆 Victoire' : '💀 Défaite'}</span>
            </div>
          )}
        </div>
      </div>

      {isReplayOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => { if (!isReplayAnimating) closeReplay(); }}>
          <div className="bg-stone-900 border-2 border-fuchsia-500 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700">
              <h3 className="text-fuchsia-300 font-bold text-lg">⚔️ Combat Labyrinthe</h3>
              <button onClick={closeReplay} className="text-stone-300 hover:text-white">✖</button>
            </div>
            <div className="grid md:grid-cols-2 gap-4 p-4 border-b border-stone-800">
              <div className="bg-stone-800/60 rounded p-3">
                <p className="text-stone-300 text-sm">{replayP1Name}</p>
                <div className="w-full h-3 bg-stone-700 rounded mt-2"><div className="h-3 bg-green-500 rounded" style={{ width: `${replayP1MaxHP ? Math.max(0, Math.min(100, (replayP1HP / replayP1MaxHP) * 100)) : 0}%` }} /></div>
                <p className="text-xs text-stone-400 mt-1">HP: {Math.max(0, replayP1HP)} / {replayP1MaxHP}</p>
              </div>
              <div className="bg-stone-800/60 rounded p-3">
                <p className="text-stone-300 text-sm">{replayP2Name}</p>
                <div className="w-full h-3 bg-stone-700 rounded mt-2"><div className="h-3 bg-red-500 rounded" style={{ width: `${replayP2MaxHP ? Math.max(0, Math.min(100, (replayP2HP / replayP2MaxHP) * 100)) : 0}%` }} /></div>
                <p className="text-xs text-stone-400 mt-1">HP: {Math.max(0, replayP2HP)} / {replayP2MaxHP}</p>
              </div>
            </div>
            <div className="p-4 max-h-[45vh] overflow-y-auto bg-black/40 text-sm font-mono text-stone-200">
              {replayLogs.length === 0 ? <p className="text-stone-500 italic">Préparation du combat...</p> : replayLogs.map((line, idx) => <div key={`player-lab-log-${idx}`}>{line}</div>)}
            </div>
            <div className="px-4 py-3 border-t border-stone-700 flex items-center justify-between">
              <p className="text-amber-300 font-bold">{replayWinner ? `🏆 Vainqueur: ${replayWinner}` : (isReplayAnimating ? '⏳ Combat en cours...' : 'Combat terminé')}</p>
              <button onClick={closeReplay} className="bg-fuchsia-700 hover:bg-fuchsia-600 text-white px-3 py-1 rounded">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfiniteLabyrinth;
