import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter } from '../services/characterService';
import {
  canAttemptBoss,
  recordAttemptDamage,
  subscribeWorldBossEvent,
  subscribeLeaderboard,
  ensureWorldBossAutoStart
} from '../services/worldBossService';
import { simulerWorldBossCombat } from '../utils/worldBossCombat';
import { EVENT_STATUS, WORLD_BOSS } from '../data/worldBoss';
import { replayCombatSteps } from '../utils/combatReplay';

const STATUS_LABELS = {
  [EVENT_STATUS.INACTIVE]: { text: 'Inactif', color: 'text-stone-400', dot: 'bg-stone-500' },
  [EVENT_STATUS.ACTIVE]: { text: 'Actif', color: 'text-green-400', dot: 'bg-green-500' },
  [EVENT_STATUS.FINISHED]: { text: 'Terminé', color: 'text-red-400', dot: 'bg-red-500' }
};

const WorldBoss = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [attemptInfo, setAttemptInfo] = useState(null);

  const [combatLoading, setCombatLoading] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [combatLogs, setCombatLogs] = useState([]);

  const [isReplaying, setIsReplaying] = useState(false);
  const [replayPlayerHP, setReplayPlayerHP] = useState(0);
  const [replayPlayerMaxHP, setReplayPlayerMaxHP] = useState(0);
  const [replayBossHP, setReplayBossHP] = useState(0);
  const [replayBossMaxHP, setReplayBossMaxHP] = useState(0);
  const replayTokenRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    const loadCharacter = async () => {
      if (!currentUser) return;
      const result = await getUserCharacter(currentUser.uid);
      if (!mounted) return;
      if (result.success) setCharacter(result.data);
      setLoading(false);
    };

    ensureWorldBossAutoStart();
    loadCharacter();

    const unsubEvent = subscribeWorldBossEvent((data) => {
      if (!mounted) return;
      setEventData(data);
    });

    const unsubLeaderboard = subscribeLeaderboard((entries) => {
      if (!mounted) return;
      setLeaderboard(entries);
    });

    return () => {
      mounted = false;
      unsubEvent();
      unsubLeaderboard();
    };
  }, [currentUser]);

  useEffect(() => {
    const refreshAttempt = async () => {
      if (!character?.id || eventData?.status !== EVENT_STATUS.ACTIVE) {
        setAttemptInfo(null);
        return;
      }
      const info = await canAttemptBoss(character.id);
      setAttemptInfo(info);
    };
    refreshAttempt();
  }, [character, eventData]);

  const handleFight = async () => {
    if (!character || !eventData || eventData.status !== EVENT_STATUS.ACTIVE) return;

    const check = await canAttemptBoss(character.id);
    if (!check.canAttempt) {
      setAttemptInfo(check);
      return;
    }

    setCombatLoading(true);
    setCombatResult(null);
    setCombatLogs([`🔥 ${character.name} se prépare à affronter ${WORLD_BOSS.nom}...`]);

    replayTokenRef.current++;
    const currentToken = replayTokenRef.current;

    try {
      const result = simulerWorldBossCombat(character, eventData.hpRemaining);

      setReplayPlayerHP(result.p1MaxHP);
      setReplayPlayerMaxHP(result.p1MaxHP);
      setReplayBossHP(result.bossMaxHP);
      setReplayBossMaxHP(result.bossMaxHP);
      setIsReplaying(true);

      await replayCombatSteps(result.steps, {
        setCombatLog: (logs) => {
          if (replayTokenRef.current !== currentToken) return;
          setCombatLogs(typeof logs === 'function' ? logs : Array.isArray(logs) ? logs : []);
        },
        onStepHP: (step) => {
          if (replayTokenRef.current !== currentToken) return;
          setReplayPlayerHP(Math.max(0, step.p1HP));
          setReplayBossHP(Math.max(0, step.p2HP));
        },
        speed: 'fast'
      });

      if (replayTokenRef.current !== currentToken) return;

      setIsReplaying(false);
      setCombatResult(result);
      await recordAttemptDamage(character.id, character.name, result.damageDealt || 0);
      setAttemptInfo(await canAttemptBoss(character.id));
    } catch (error) {
      console.error('Erreur combat world boss:', error);
      setCombatLogs(prev => [...prev, `❌ Erreur: ${error.message}`]);
    }

    setCombatLoading(false);
  };

  const hpPercent = eventData ? Math.max(0, (eventData.hpRemaining / eventData.hpMax) * 100) : 0;
  const status = eventData?.status || EVENT_STATUS.INACTIVE;
  const statusLabel = STATUS_LABELS[status] || STATUS_LABELS[EVENT_STATUS.INACTIVE];
  const hpBarColor = hpPercent > 50 ? 'bg-red-600' : hpPercent > 25 ? 'bg-orange-500' : 'bg-yellow-500';

  if (loading) {
    return <div className="min-h-screen bg-stone-950 text-white p-8"><Header /><div className="pt-20">Chargement...</div></div>;
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-stone-950 text-white p-8">
        <Header />
        <div className="max-w-2xl mx-auto pt-24 text-center">
          <p className="text-stone-300 mb-4">Aucun personnage trouvé.</p>
          <button onClick={() => navigate('/')} className="bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded font-bold">← Retour</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white p-4 md:p-8">
      <Header />
      <div className="max-w-5xl mx-auto pt-20">
        <div className="mb-6 flex gap-3">
          <button onClick={() => navigate('/')} className="bg-stone-700 hover:bg-stone-600 px-4 py-2 rounded">← Retour</button>
        </div>

        <div className="bg-stone-900/70 border-2 border-red-700 rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-red-400 mb-2">☄️ Cataclysme — Boss Mondial</h2>
          <p className="text-stone-400 text-sm mb-6">Ouvert à tous : 2 tentatives par jour (matin + après-midi).</p>

          <div className="bg-stone-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${statusLabel.dot} animate-pulse`}></div>
                <span className={`font-bold ${statusLabel.color}`}>{statusLabel.text}</span>
              </div>
            </div>

            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-red-300 font-bold">{WORLD_BOSS.nom}</span>
                <span className="text-stone-300">
                  {eventData ? eventData.hpRemaining.toLocaleString('fr-FR') : 0} / {WORLD_BOSS.baseStats.hp.toLocaleString('fr-FR')} PV
                </span>
              </div>
              <div className="w-full bg-stone-700 rounded-full h-6 overflow-hidden">
                <div className={`h-full ${hpBarColor} rounded-full transition-all duration-500`} style={{ width: `${hpPercent}%` }}></div>
              </div>
              <div className="text-right text-stone-400 text-xs mt-1">{hpPercent.toFixed(1)}%</div>
            </div>

            <div className="text-sm text-stone-400">
              <strong>{character.name}</strong> — {attemptInfo?.canAttempt === false ? attemptInfo.reason : 'Tentative disponible'}
            </div>
          </div>

          <button
            onClick={handleFight}
            disabled={combatLoading || isReplaying || status !== EVENT_STATUS.ACTIVE || attemptInfo?.canAttempt === false}
            className="bg-red-700 hover:bg-red-600 disabled:bg-stone-700 disabled:text-stone-500 text-white px-4 py-2 rounded-lg font-bold transition"
          >
            {combatLoading || isReplaying ? 'Combat en cours...' : '⚔️ Tenter ma chance'}
          </button>

          {combatResult && (
            <div className="mt-4 text-sm text-stone-300">
              Dégâts infligés: <span className="text-amber-300 font-bold">{combatResult.damageDealt?.toLocaleString('fr-FR') || 0}</span>
            </div>
          )}

          {(isReplaying || combatLogs.length > 0) && (
            <div className="mt-4 bg-stone-900 rounded p-3 text-xs">
              <div className="mb-2 text-stone-400">
                PV Joueur: {replayPlayerHP}/{replayPlayerMaxHP} | PV Boss: {replayBossHP}/{replayBossMaxHP}
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {combatLogs.map((log, i) => <div key={i}>{log}</div>)}
              </div>
            </div>
          )}
        </div>

        <div className="bg-stone-800 rounded-lg p-4">
          <h3 className="text-lg font-bold text-amber-300 mb-3">🏆 Leaderboard — Dégâts cumulés</h3>
          {leaderboard.length === 0 ? (
            <p className="text-stone-500 text-sm">Aucune tentative enregistrée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-stone-400 text-left border-b border-stone-700">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Personnage</th>
                    <th className="py-2 px-2 text-right">Dégâts totaux</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => (
                    <tr key={entry.id} className="border-b border-stone-700/50 text-stone-300">
                      <td className="py-2 px-2 font-bold">{i + 1}</td>
                      <td className="py-2 px-2">{entry.characterName}</td>
                      <td className="py-2 px-2 text-right font-bold">{(entry.totalDamage || 0).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorldBoss;
