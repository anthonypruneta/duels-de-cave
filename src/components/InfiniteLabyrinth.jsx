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
import { getUserCharacter } from '../services/characterService';

const InfiniteLabyrinth = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [weekId, setWeekId] = useState(getCurrentWeekId());
  const [labyrinthData, setLabyrinthData] = useState(null);
  const [progress, setProgress] = useState(null);
  const [playerCharacter, setPlayerCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isAutoRunActive, setIsAutoRunActive] = useState(false);
  const [isAnimatingFight, setIsAnimatingFight] = useState(false);
  const [replayLogs, setReplayLogs] = useState([]);
  const [replayWinner, setReplayWinner] = useState('');
  const [displayEnemyFloor, setDisplayEnemyFloor] = useState(null);
  const [replayP1HP, setReplayP1HP] = useState(0);
  const [replayP2HP, setReplayP2HP] = useState(0);
  const [replayP1MaxHP, setReplayP1MaxHP] = useState(0);
  const [replayP2MaxHP, setReplayP2MaxHP] = useState(0);

  const replayTimeoutRef = useRef(null);
  const replayTokenRef = useRef(null);
  const autoRunTokenRef = useRef(null);
  const logContainerRef = useRef(null);

  const currentFloor = progress?.currentFloor || 1;
  const defaultEnemyFloor = labyrinthData?.floors?.find((f) => f.floorNumber === currentFloor) || null;
  const shownEnemyFloor = displayEnemyFloor || defaultEnemyFloor;

  useEffect(() => {
    if (!logContainerRef.current) return;
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [replayLogs]);

  const delayReplay = (ms) => new Promise((resolve) => {
    replayTimeoutRef.current = setTimeout(resolve, ms);
  });

  const stopAutoRun = () => {
    if (autoRunTokenRef.current) {
      autoRunTokenRef.current.cancelled = true;
      autoRunTokenRef.current = null;
    }
    setIsAutoRunActive(false);
  };

  const playReplay = async (result) => {
    const data = result?.result;
    if (!data) return;

    if (replayTokenRef.current) replayTokenRef.current.cancelled = true;
    if (replayTimeoutRef.current) {
      clearTimeout(replayTimeoutRef.current);
      replayTimeoutRef.current = null;
    }

    const token = { cancelled: false };
    replayTokenRef.current = token;

    setIsAnimatingFight(true);
    setReplayLogs([]);
    setReplayWinner('');
    setReplayP1MaxHP(data.p1MaxHP || 0);
    setReplayP2MaxHP(data.p2MaxHP || 0);
    setReplayP1HP(data.p1MaxHP || 0);
    setReplayP2HP(data.p2MaxHP || 0);

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
        await delayReplay(step.phase === 'action' ? 560 : 300);
      }
    } else {
      for (const line of (data.combatLog || [])) {
        if (token.cancelled) return;
        setReplayLogs((prev) => [...prev, line]);
        await delayReplay(line.includes('---') ? 450 : 250);
      }
    }

    if (token.cancelled) return;

    setReplayWinner(data.winnerNom || (result.didWin ? playerCharacter?.name : result.floor?.enemyName));
    if (result.rewardGranted) {
      setReplayLogs((prev) => [...prev, '🎁 Boss vaincu: +5 essais de donjon ajoutés.']);
    }
    setIsAnimatingFight(false);
  };

  const loadLabyrinthData = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    setError('');
    try {
      const resolvedWeekId = getCurrentWeekId();
      setWeekId(resolvedWeekId);

      const [labyrinthResult, progressResult, playerResult] = await Promise.all([
        ensureWeeklyInfiniteLabyrinth(resolvedWeekId),
        getUserLabyrinthProgress(currentUser.uid, resolvedWeekId),
        getUserCharacter(currentUser.uid)
      ]);

      if (!labyrinthResult.success) {
        setError(labyrinthResult.error || 'Impossible de charger le labyrinthe.');
        return;
      }
      setLabyrinthData(labyrinthResult.data);

      if (!progressResult.success) {
        setError(progressResult.error || 'Impossible de charger la progression.');
        return;
      }
      setProgress(progressResult.data);

      if (playerResult.success) {
        setPlayerCharacter(playerResult.data);
      }

      const initialFloor = labyrinthResult.data?.floors?.find((f) => f.floorNumber === (progressResult.data?.currentFloor || 1));
      setDisplayEnemyFloor(initialFloor || null);
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
    if (!currentUser?.uid || isAutoRunActive) return;

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

        setProgress(result.progress);
        setDisplayEnemyFloor(result.floor || null);
        await playReplay(result);
        if (token.cancelled) break;

        if (!result.didWin) break;
        if ((result.progress?.currentFloor || 1) > 100) break;
      }
    } finally {
      autoRunTokenRef.current = null;
      setIsAutoRunActive(false);
      setLoading(false);
    }
  };

  const playerBase = playerCharacter?.base || { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 };
  const enemyStats = shownEnemyFloor?.stats || { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 };

  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-[1800px] mx-auto pt-16">
        <div className="flex justify-center mb-6">
          <div className="bg-stone-800 border border-stone-600 px-8 py-3">
            <h1 className="text-4xl font-bold text-stone-200">🌀 Labyrinthe Infini 🌀</h1>
          </div>
        </div>

        {error && <p className="text-red-300 text-center mb-4">⚠️ {error}</p>}

        <div className="flex justify-center gap-3 md:gap-4 mb-4">
          <button
            onClick={handleStartCurrentFloorFight}
            disabled={loading}
            className="bg-stone-100 hover:bg-white disabled:bg-stone-600 disabled:text-stone-400 text-stone-900 px-6 py-3 font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg border-2 border-stone-400"
          >
            ▶️ {loading ? 'Combats en cours...' : `Lancer le combat (étage ${currentFloor})`}
          </button>
          <button
            onClick={stopAutoRun}
            disabled={!isAutoRunActive}
            className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-6 py-3 font-bold text-base border border-red-500"
          >
            ⏹️ Stop
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-6 py-3 font-bold text-base border border-stone-500"
          >
            ← Changer
          </button>
        </div>

        <div className="text-center mb-4 text-stone-300 text-sm">
          Week {weekId} • Étage actuel {currentFloor} • Boss vaincus {progress?.bossesDefeated || 0}
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
          <div className="order-1 w-full md:w-[340px] md:flex-shrink-0 bg-stone-800/90 border-2 border-stone-600 p-4">
            <div className="bg-stone-900/90 text-stone-200 p-3 mb-3 border border-stone-700">
              <div className="font-bold">{playerCharacter?.race || 'Race'} • {playerCharacter?.class || 'Classe'}</div>
              <div className="text-stone-300">• Niveau {playerCharacter?.level || 1}</div>
            </div>
            <div className="border border-stone-700 bg-black/40 p-2 mb-3">
              {playerCharacter?.characterImage ? (
                <img src={playerCharacter.characterImage} alt={playerCharacter?.name} className="w-full h-[420px] object-contain" />
              ) : (
                <div className="w-full h-[420px] flex items-center justify-center text-stone-500">Image manquante</div>
              )}
            </div>
            <h3 className="text-3xl font-bold text-stone-100 text-center mb-3">{playerCharacter?.name || 'Votre personnage'}</h3>
            <div className="bg-stone-900 p-3 border border-stone-700 text-green-400 grid grid-cols-2 gap-2">
              <div>HP: {playerBase.hp}</div><div>VIT: {playerBase.spd}</div>
              <div>Auto: {playerBase.auto}</div><div>Déf: {playerBase.def}</div>
              <div>Cap: {playerBase.cap}</div><div>ResC: {playerBase.rescap}</div>
            </div>
          </div>

          <div className="order-2 w-full md:w-[600px] md:flex-shrink-0 flex flex-col">
            {replayWinner && (
              <div className="flex justify-center mb-4">
                <div className="bg-stone-100 text-stone-900 px-8 py-3 font-bold text-xl shadow-2xl border-2 border-stone-400">
                  🏆 {replayWinner} remporte le combat! 🏆
                </div>
              </div>
            )}

            <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[480px] md:h-[600px]">
              <div className="bg-stone-900 p-3 border-b border-stone-600">
                <h2 className="text-lg md:text-2xl font-bold text-stone-200 text-center">⚔️ Combat en direct</h2>
              </div>
              <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {replayLogs.length === 0 ? (
                  <p className="text-stone-500 italic text-center py-8">Cliquez sur "Lancer le combat" pour commencer...</p>
                ) : (
                  replayLogs.map((log, idx) => {
                    const isP1 = log.startsWith('[P1]');
                    const isP2 = log.startsWith('[P2]');
                    const cleanLog = log.replace(/^\[P[12]\]\s*/, '');
                    if (!isP1 && !isP2) {
                      return <div key={idx} className="text-stone-400 text-sm italic text-center">{cleanLog}</div>;
                    }
                    if (isP1) {
                      return <div key={idx} className="flex justify-start"><div className="bg-stone-700 text-stone-200 px-3 py-2 border-l-4 border-blue-500 max-w-[80%]">{cleanLog}</div></div>;
                    }
                    return <div key={idx} className="flex justify-end"><div className="bg-stone-700 text-stone-200 px-3 py-2 border-r-4 border-purple-500 max-w-[80%]">{cleanLog}</div></div>;
                  })
                )}
              </div>
            </div>

            {isAutoRunActive && <p className="text-amber-300 text-sm mt-3 text-center">Enchaînement auto actif (défaite / étage 100 / stop).</p>}
          </div>

          <div className="order-3 w-full md:w-[340px] md:flex-shrink-0 bg-stone-800/90 border-2 border-stone-600 p-4">
            <div className="bg-stone-900/90 text-stone-200 p-3 mb-3 border border-stone-700">
              <div className="font-bold">{shownEnemyFloor?.type === 'boss' ? 'Boss' : 'Monstre'} • {shownEnemyFloor?.phase ? `Phase ${shownEnemyFloor.phase}` : 'Phase ?'}</div>
              <div className="text-stone-300">• Étage {shownEnemyFloor?.floorNumber || currentFloor}</div>
            </div>
            <div className="border border-stone-700 bg-black/40 p-2 mb-3">
              {shownEnemyFloor?.imagePath ? (
                <img src={shownEnemyFloor.imagePath} alt={shownEnemyFloor.enemyName} className="w-full h-[420px] object-contain" />
              ) : (
                <div className="w-full h-[420px] flex items-center justify-center text-stone-500">Image manquante</div>
              )}
            </div>
            <h3 className="text-3xl font-bold text-stone-100 text-center mb-3">{shownEnemyFloor?.enemyName || 'Ennemi'}</h3>
            <div className="bg-stone-900 p-3 border border-stone-700 text-green-400 grid grid-cols-2 gap-2">
              <div>HP: {enemyStats.hp}</div><div>VIT: {enemyStats.spd}</div>
              <div>Auto: {enemyStats.auto}</div><div>Déf: {enemyStats.def}</div>
              <div>Cap: {enemyStats.cap}</div><div>ResC: {enemyStats.rescap}</div>
            </div>

            <div className="mt-3 bg-stone-900 p-3 border border-stone-700 text-xs text-stone-300">
              <div className="text-green-300 mb-1">HP joueur: {Math.max(0, replayP1HP)} / {replayP1MaxHP}</div>
              <div className="text-red-300">HP ennemi: {Math.max(0, replayP2HP)} / {replayP2MaxHP}</div>
              {isAnimatingFight && <div className="text-amber-300 mt-2">Combat en cours...</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfiniteLabyrinth;
