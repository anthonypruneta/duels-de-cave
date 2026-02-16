/**
 * WorldBossAdmin - Section admin pour le Boss Mondial "Cataclysme"
 *
 * Fonctionnalités :
 * - État de l'event (HP, barre de vie, statut)
 * - Boutons admin (démarrer, terminer, reset, forcer nouvelle journée)
 * - Simulation de combat (choix perso, lancement, log, dégâts)
 * - Leaderboard (dégâts par personnage)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  getWorldBossEvent,
  startWorldBossEvent,
  endWorldBossEvent,
  resetWorldBossEvent,
  forceNewDay,
  canAttemptBoss,
  recordAttemptDamage,
  getLeaderboard,
  subscribeWorldBossEvent,
  subscribeLeaderboard
} from '../services/worldBossService';
import { simulerWorldBossCombat } from '../utils/worldBossCombat';
import { WORLD_BOSS, EVENT_STATUS } from '../data/worldBoss';
import { replayCombatSteps } from '../utils/combatReplay';
import cataclysmeBossImage from '../assets/bosses/dragon.png';

const STATUS_LABELS = {
  [EVENT_STATUS.INACTIVE]: { text: 'Inactif', color: 'text-stone-400', dot: 'bg-stone-500' },
  [EVENT_STATUS.ACTIVE]: { text: 'Actif', color: 'text-green-400', dot: 'bg-green-500' },
  [EVENT_STATUS.FINISHED]: { text: 'Terminé', color: 'text-red-400', dot: 'bg-red-500' }
};

const WorldBossAdmin = ({ characters, isAdmin = true }) => {
  // État event
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);

  // Combat
  const [selectedCharId, setSelectedCharId] = useState('');
  const [combatLoading, setCombatLoading] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [combatLogs, setCombatLogs] = useState([]);
  const [attemptInfo, setAttemptInfo] = useState(null);

  // Replay
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayPlayerHP, setReplayPlayerHP] = useState(0);
  const [replayPlayerMaxHP, setReplayPlayerMaxHP] = useState(0);
  const [replayBossHP, setReplayBossHP] = useState(0);
  const [replayBossMaxHP, setReplayBossMaxHP] = useState(0);
  const replayTokenRef = useRef(0);
  const replayTimeoutRef = useRef(null);
  const logContainerRef = useRef(null);

  // Mass simulation
  const [massSimLoading, setMassSimLoading] = useState(false);
  const [massSimResults, setMassSimResults] = useState(null);

  // Musique
  const bossAudioRef = useRef(null);
  const [volume, setVolume] = useState(0.05);
  const [isMuted, setIsMuted] = useState(false);

  // Chargement initial + mises à jour temps réel
  useEffect(() => {
    let gotEventSnapshot = false;
    let gotLeaderboardSnapshot = false;

    const maybeStopLoading = () => {
      if (gotEventSnapshot && gotLeaderboardSnapshot) {
        setLoading(false);
      }
    };

    setLoading(true);

    const unsubscribeEvent = subscribeWorldBossEvent(
      (data) => {
        setEventData(data);
        gotEventSnapshot = true;
        maybeStopLoading();
      },
      (error) => {
        console.error('Erreur live event world boss:', error);
        gotEventSnapshot = true;
        maybeStopLoading();
      }
    );

    const unsubscribeLeaderboard = subscribeLeaderboard(
      (entries) => {
        setLeaderboard(entries);
        gotLeaderboardSnapshot = true;
        maybeStopLoading();
      },
      (error) => {
        console.error('Erreur live leaderboard world boss:', error);
        gotLeaderboardSnapshot = true;
        maybeStopLoading();
      }
    );

    return () => {
      unsubscribeEvent();
      unsubscribeLeaderboard();
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [combatLogs]);

  // Arrêter la musique uniquement en quittant la page (unmount)
  useEffect(() => {
    return () => {
      if (bossAudioRef.current) {
        bossAudioRef.current.pause();
        bossAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [eventResult, lbResult] = await Promise.all([
      getWorldBossEvent(),
      getLeaderboard()
    ]);
    if (eventResult.success) setEventData(eventResult.data);
    if (lbResult.success) setLeaderboard(lbResult.data);
    setLoading(false);
  };

  // Vérifier les tentatives quand on change de perso
  useEffect(() => {
    if (!selectedCharId || !eventData || eventData.status !== EVENT_STATUS.ACTIVE) {
      setAttemptInfo(null);
      return;
    }
    canAttemptBoss(selectedCharId).then(result => setAttemptInfo(result));
  }, [selectedCharId, eventData]);

  // Vue joueur: présélectionner automatiquement son unique personnage
  useEffect(() => {
    if (!isAdmin && !selectedCharId && Array.isArray(characters) && characters.length === 1) {
      setSelectedCharId(characters[0].id);
    }
  }, [isAdmin, selectedCharId, characters]);

  // ============================================================================
  // ACTIONS ADMIN
  // ============================================================================
  const handleStart = async () => {
    setActionLoading(true);
    const result = await startWorldBossEvent();
    if (result.success) {
      await loadData();
    } else {
      console.error('Échec démarrage event:', result.error);
      setCombatLogs([`❌ Échec démarrage event : ${result.error}`]);
    }
    setActionLoading(false);
  };

  const handleEnd = async () => {
    setActionLoading(true);
    const result = await endWorldBossEvent();
    if (result.success) {
      await loadData();
    } else {
      console.error('Échec fin event:', result.error);
      setCombatLogs([`❌ Échec fin event : ${result.error}`]);
    }
    setActionLoading(false);
  };

  const handleReset = async () => {
    setActionLoading(true);
    setCombatResult(null);
    setCombatLogs([]);
    setAttemptInfo(null);
    const result = await resetWorldBossEvent();
    if (result.success) {
      await loadData();
    } else {
      console.error('Échec reset event:', result.error);
      setCombatLogs([`❌ Échec reset event : ${result.error}`]);
    }
    setActionLoading(false);
  };

  const handleForceNewDay = async () => {
    setActionLoading(true);
    const result = await forceNewDay();
    if (result.success) {
      setAttemptInfo(null);
      if (selectedCharId) {
        const info = await canAttemptBoss(selectedCharId);
        setAttemptInfo(info);
      }
      await loadData();
    }
    setActionLoading(false);
  };

  // ============================================================================
  // COMBAT
  // ============================================================================
  const handleFight = async () => {
    if (!selectedCharId || !eventData || eventData.status !== EVENT_STATUS.ACTIVE) return;

    const character = characters.find(c => c.id === selectedCharId);
    if (!character) return;

    // Vérifier tentative
    const check = await canAttemptBoss(selectedCharId);
    if (!check.canAttempt) {
      setAttemptInfo(check);
      return;
    }

    setCombatLoading(true);
    setCombatResult(null);
    setCombatLogs([`🔥 ${character.name} se prépare à affronter ${WORLD_BOSS.nom}...`]);

    // Lancer la musique du boss
    if (bossAudioRef.current) {
      bossAudioRef.current.currentTime = 0;
      bossAudioRef.current.volume = volume;
      bossAudioRef.current.muted = isMuted;
      bossAudioRef.current.play().catch(e => console.log('Autoplay bloqué:', e));
    }

    // Annuler tout replay en cours
    replayTokenRef.current++;
    if (replayTimeoutRef.current) clearTimeout(replayTimeoutRef.current);

    try {
      // Simuler le combat
      const result = simulerWorldBossCombat(character, eventData.hpRemaining);

      // Initialiser HP pour replay
      setReplayPlayerHP(result.p1MaxHP);
      setReplayPlayerMaxHP(result.p1MaxHP);
      setReplayBossHP(result.bossMaxHP);
      setReplayBossMaxHP(result.bossMaxHP);

      // Replay animé
      setIsReplaying(true);
      const currentToken = replayTokenRef.current;

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

      // Enregistrer les dégâts en base
      if (result.damageDealt > 0) {
        await recordAttemptDamage(selectedCharId, character.name, result.damageDealt);
      } else {
        // Même sans dégâts, on enregistre la tentative (0 dégâts)
        await recordAttemptDamage(selectedCharId, character.name, 0);
      }

      // Recharger les données
      await loadData();
      // Refresh tentatives
      const newInfo = await canAttemptBoss(selectedCharId);
      setAttemptInfo(newInfo);
    } catch (error) {
      console.error('Erreur combat world boss:', error);
      setCombatLogs(prev => [...prev, `❌ Erreur: ${error.message}`]);
    }

    setCombatLoading(false);
  };

  // ============================================================================
  // MASS SIMULATION (12 combats par personnage)
  // ============================================================================
  const MASS_SIM_FIGHTS = 6;

  const handleMassSimulation = async () => {
    if (!eventData || eventData.status !== EVENT_STATUS.ACTIVE) return;

    const activeChars = characters.filter(c => !c.disabled);
    if (activeChars.length === 0) return;

    setMassSimLoading(true);
    setMassSimResults(null);

    const results = [];
    let bossHP = eventData.hpRemaining;

    for (const char of activeChars) {
      const charResult = {
        id: char.id,
        name: char.name,
        race: char.race,
        class: char.class,
        level: char.level || 1,
        fights: [],
        totalDamage: 0,
        totalDeaths: 0,
        totalExtinctions: 0,
        bestDamage: 0,
        worstDamage: Infinity,
      };

      for (let i = 0; i < MASS_SIM_FIGHTS; i++) {
        const fight = simulerWorldBossCombat(char, bossHP);
        charResult.fights.push({
          damage: fight.damageDealt,
          died: fight.playerDied,
          extinction: fight.reachedExtinction,
        });
        charResult.totalDamage += fight.damageDealt;
        if (fight.playerDied) charResult.totalDeaths++;
        if (fight.reachedExtinction) charResult.totalExtinctions++;
        if (fight.damageDealt > charResult.bestDamage) charResult.bestDamage = fight.damageDealt;
        if (fight.damageDealt < charResult.worstDamage) charResult.worstDamage = fight.damageDealt;

        // Réduire les HP du boss globalement
        bossHP = Math.max(0, bossHP - fight.damageDealt);
      }

      charResult.avgDamage = Math.round(charResult.totalDamage / MASS_SIM_FIGHTS);
      results.push(charResult);
    }

    // Trier par dégâts totaux décroissants
    results.sort((a, b) => b.totalDamage - a.totalDamage);

    const grandTotal = results.reduce((sum, r) => sum + r.totalDamage, 0);

    setMassSimResults({
      results,
      grandTotal,
      bossHPBefore: eventData.hpRemaining,
      bossHPAfter: bossHP,
      totalFights: activeChars.length * MASS_SIM_FIGHTS,
    });

    setMassSimLoading(false);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  const hpPercent = eventData ? Math.max(0, (eventData.hpRemaining / eventData.hpMax) * 100) : 0;
  const status = eventData?.status || EVENT_STATUS.INACTIVE;
  const statusLabel = STATUS_LABELS[status] || STATUS_LABELS[EVENT_STATUS.INACTIVE];

  const hpBarColor = hpPercent > 50 ? 'bg-red-600' : hpPercent > 25 ? 'bg-orange-500' : 'bg-yellow-500';

  if (loading) {
    return (
      <div className="bg-gradient-to-b from-stone-900/90 via-stone-900/80 to-black/80 border-2 border-red-700 rounded-xl p-6 mb-8 shadow-[0_0_40px_rgba(220,38,38,0.15)]">
        <h2 className="text-2xl font-bold text-red-400 mb-4">☄️ Cataclysme (Test)</h2>
        <p className="text-stone-400">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-stone-900/90 via-stone-900/80 to-black/80 border-2 border-red-700 rounded-xl p-6 mb-8 shadow-[0_0_40px_rgba(220,38,38,0.15)]">
      <h2 className="text-2xl font-bold text-red-400 mb-2">☄️ Cataclysme — Boss Mondial{isAdmin ? ' (Test)' : ''}</h2>
      <p className="text-stone-400 text-sm mb-6">
        {isAdmin
          ? 'Mode en test : aucune reward active et aucune exposition côté joueurs.'
          : 'Mode joueur : 2 tentatives par jour (matin + après-midi).'}
      </p>

      {/* ================================================================ */}
      {/* ÉTAT DE L'EVENT */}
      {/* ================================================================ */}
      <div className="bg-stone-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${statusLabel.dot} animate-pulse`}></div>
            <span className={`font-bold ${statusLabel.color}`}>{statusLabel.text}</span>
          </div>
          <div className="text-stone-400 text-sm">
            {eventData?.startedAt && (
              <span>Démarré: {eventData.startedAt.toDate().toLocaleString('fr-FR')}</span>
            )}
            {eventData?.endedAt && (
              <span className="ml-4">Terminé: {eventData.endedAt.toDate().toLocaleString('fr-FR')}</span>
            )}
          </div>
        </div>

        {/* Visuel boss */}
        <div className="mb-4 bg-stone-900/70 border border-red-800 rounded-lg p-3">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-lg overflow-hidden border-2 border-red-700 bg-stone-950">
              <img src={cataclysmeBossImage} alt={WORLD_BOSS.nom} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="text-red-300 text-sm uppercase tracking-wide">Boss mondial</div>
              <div className="text-2xl font-extrabold text-red-400">{WORLD_BOSS.nom}</div>
              <div className="text-stone-400 text-sm mt-1">{WORLD_BOSS.description}</div>
            </div>
          </div>
        </div>

        {/* Barre de vie du boss */}
        <div className="mb-2">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-red-300 font-bold">{WORLD_BOSS.nom}</span>
            <span className="text-stone-300">
              {eventData ? eventData.hpRemaining.toLocaleString('fr-FR') : 0} / {WORLD_BOSS.baseStats.hp.toLocaleString('fr-FR')} PV
            </span>
          </div>
          <div className="w-full bg-stone-700 rounded-full h-6 overflow-hidden">
            <div
              className={`h-full ${hpBarColor} rounded-full transition-all duration-500`}
              style={{ width: `${hpPercent}%` }}
            ></div>
          </div>
          <div className="text-right text-stone-400 text-xs mt-1">{hpPercent.toFixed(1)}%</div>
        </div>

        {/* Stats globales */}
        <div className="flex gap-6 text-sm text-stone-400 mt-3">
          <span>Dégâts totaux : <strong className="text-amber-400">{eventData?.totalDamageDealt?.toLocaleString('fr-FR') || 0}</strong></span>
          <span>Tentatives : <strong className="text-amber-400">{eventData?.totalAttempts || 0}</strong></span>
        </div>
      </div>

      {isAdmin && (
        <>
      {/* ================================================================ */}
      {/* BOUTONS ADMIN */}
      {/* ================================================================ */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleStart}
          disabled={actionLoading || status === EVENT_STATUS.ACTIVE}
          className="bg-green-700 hover:bg-green-600 disabled:bg-stone-700 disabled:text-stone-500 text-white px-4 py-2 rounded-lg font-bold transition"
        >
          ▶️ Démarrer l'event
        </button>
        <button
          onClick={handleEnd}
          disabled={actionLoading || status !== EVENT_STATUS.ACTIVE}
          className="bg-red-700 hover:bg-red-600 disabled:bg-stone-700 disabled:text-stone-500 text-white px-4 py-2 rounded-lg font-bold transition"
        >
          ⏹️ Terminer l'event
        </button>
        <button
          onClick={handleReset}
          disabled={actionLoading}
          className="bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-white px-4 py-2 rounded-lg font-bold transition"
        >
          🔄 Reset complet
        </button>
        <button
          onClick={handleForceNewDay}
          disabled={actionLoading || status !== EVENT_STATUS.ACTIVE}
          className="bg-violet-700 hover:bg-violet-600 disabled:bg-stone-700 disabled:text-stone-500 text-white px-4 py-2 rounded-lg font-bold transition"
        >
          🌅 Forcer nouvelle journée
        </button>
      </div>
      </>
      )}

      {/* ================================================================ */}
      {/* SIMULATION DE COMBAT */}
      {/* ================================================================ */}
      {status === EVENT_STATUS.ACTIVE && (
        <div className="bg-stone-800 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-bold text-red-300 mb-3">⚔️ Simulation de combat</h3>

          <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
            <div className="flex-1">
              <label className="text-stone-400 text-sm block mb-1">Personnage</label>
              <select
                value={selectedCharId}
                onChange={(e) => {
                  setSelectedCharId(e.target.value);
                  setCombatResult(null);
                  setCombatLogs([]);
                }}
                className="w-full bg-stone-700 border border-stone-600 rounded px-3 py-2 text-white"
              >
                <option value="">Sélectionner un personnage</option>
                {characters.filter(c => !c.disabled).map((char) => (
                  <option key={char.id} value={char.id}>
                    {char.name} — {char.race} {char.class} (Niv.{char.level || 1})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleFight}
              disabled={!selectedCharId || combatLoading || isReplaying || (attemptInfo && !attemptInfo.canAttempt)}
              className="bg-red-600 hover:bg-red-500 disabled:bg-stone-700 disabled:text-stone-500 text-white px-6 py-2 rounded-lg font-bold transition whitespace-nowrap"
            >
              {combatLoading || isReplaying ? '⚔️ Combat en cours...' : '☄️ Lancer la tentative'}
            </button>
          </div>

          {/* Info tentative */}
          {attemptInfo && selectedCharId && (
            <div className={`text-sm mb-3 ${attemptInfo.canAttempt ? 'text-green-400' : 'text-red-400'}`}>
              {attemptInfo.canAttempt
                ? `✅ Tentative disponible (${attemptInfo.period === 'morning' ? 'matin' : 'après-midi'})`
                : `❌ ${attemptInfo.reason}`
              }
            </div>
          )}

          {/* Barres de vie replay */}
          {(isReplaying || combatResult) && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Joueur */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-blue-300 font-bold">{characters.find(c => c.id === selectedCharId)?.name || 'Joueur'}</span>
                  <span className="text-stone-300">{Math.max(0, replayPlayerHP)} / {replayPlayerMaxHP}</span>
                </div>
                <div className="w-full bg-stone-700 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${replayPlayerMaxHP > 0 ? Math.max(0, (replayPlayerHP / replayPlayerMaxHP) * 100) : 0}%` }}
                  ></div>
                </div>
              </div>
              {/* Boss */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-300 font-bold">{WORLD_BOSS.nom}</span>
                  <span className="text-stone-300">{Math.max(0, replayBossHP)} / {replayBossMaxHP}</span>
                </div>
                <div className="w-full bg-stone-700 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${replayBossMaxHP > 0 ? Math.max(0, (replayBossHP / replayBossMaxHP) * 100) : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* Résultat */}
          {combatResult && !isReplaying && (
            <div className={`p-3 rounded-lg mb-3 ${combatResult.reachedExtinction ? 'bg-red-900/50 border border-red-700' : combatResult.damageDealt > 0 ? 'bg-amber-900/50 border border-amber-700' : 'bg-stone-700/50 border border-stone-600'}`}>
              <div className="text-lg font-bold mb-1">
                {combatResult.reachedExtinction && '☠️ EXTINCTION — '}
                Dégâts infligés : <span className="text-amber-400">{combatResult.damageDealt.toLocaleString('fr-FR')}</span>
              </div>
              <div className="text-sm text-stone-400">
                {combatResult.reachedExtinction
                  ? 'Le boss a déclenché EXTINCTION au tour 10.'
                  : combatResult.playerDied
                    ? 'Le joueur a été vaincu avant le tour 10.'
                    : 'Le boss a été vaincu !'
                }
              </div>
            </div>
          )}

          {/* Logs de combat */}
          {combatLogs.length > 0 && (
            <div
              ref={logContainerRef}
              className="bg-stone-900 rounded-lg p-3 max-h-80 overflow-y-auto font-mono text-xs text-stone-300 space-y-1"
            >
              {combatLogs.map((log, i) => (
                <div
                  key={i}
                  className={
                    log.includes('EXTINCTION') ? 'text-red-400 font-bold' :
                    log.includes('☠️') ? 'text-red-400' :
                    log.includes('🏆') || log.includes('🎉') ? 'text-amber-400 font-bold' :
                    log.includes('[P1]') ? 'text-blue-300' :
                    log.includes('[P2]') ? 'text-red-300' :
                    log.includes('---') ? 'text-stone-500' :
                    ''
                  }
                >
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
      <>
      {/* ================================================================ */}
      {/* SIMULATION DE MASSE */}
      {/* ================================================================ */}
      {status === EVENT_STATUS.ACTIVE && (
        <div className="bg-stone-800 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-bold text-orange-300 mb-3">🔥 Simulation de masse — {MASS_SIM_FIGHTS} combats par personnage</h3>
          <p className="text-stone-400 text-sm mb-3">
            Lance {MASS_SIM_FIGHTS} combats pour chaque personnage actif contre le boss.
            Les dégâts s'accumulent sur les HP du boss (simulation locale, rien n'est sauvegardé).
          </p>

          <button
            onClick={handleMassSimulation}
            disabled={massSimLoading}
            className="bg-orange-600 hover:bg-orange-500 disabled:bg-stone-700 disabled:text-stone-500 text-white px-6 py-2 rounded-lg font-bold transition mb-4"
          >
            {massSimLoading ? '⏳ Simulation en cours...' : `☄️ Lancer la simulation (${characters.filter(c => !c.disabled).length} persos × ${MASS_SIM_FIGHTS} combats)`}
          </button>

          {massSimResults && (
            <div>
              {/* Résumé global */}
              <div className="bg-stone-900 rounded-lg p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-stone-400 text-xs">Dégâts totaux</div>
                  <div className="text-amber-400 font-bold text-xl">{massSimResults.grandTotal.toLocaleString('fr-FR')}</div>
                </div>
                <div>
                  <div className="text-stone-400 text-xs">Combats joués</div>
                  <div className="text-white font-bold text-xl">{massSimResults.totalFights}</div>
                </div>
                <div>
                  <div className="text-stone-400 text-xs">HP boss avant</div>
                  <div className="text-red-400 font-bold text-xl">{massSimResults.bossHPBefore.toLocaleString('fr-FR')}</div>
                </div>
                <div>
                  <div className="text-stone-400 text-xs">HP boss après</div>
                  <div className={`font-bold text-xl ${massSimResults.bossHPAfter <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {massSimResults.bossHPAfter <= 0 ? 'VAINCU !' : massSimResults.bossHPAfter.toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>

              {/* Barre de vie résiduelle */}
              <div className="mb-4">
                <div className="w-full bg-stone-700 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full ${massSimResults.bossHPAfter <= 0 ? 'bg-green-500' : 'bg-red-600'} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(0, (massSimResults.bossHPAfter / massSimResults.bossHPBefore) * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Tableau des résultats par personnage */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-stone-400 text-left border-b border-stone-700">
                      <th className="py-2 px-2">#</th>
                      <th className="py-2 px-2">Personnage</th>
                      <th className="py-2 px-2">Race / Classe</th>
                      <th className="py-2 px-2 text-right">Dégâts totaux</th>
                      <th className="py-2 px-2 text-right">Moyenne</th>
                      <th className="py-2 px-2 text-right">Meilleur</th>
                      <th className="py-2 px-2 text-right">Pire</th>
                      <th className="py-2 px-2 text-center">Morts</th>
                      <th className="py-2 px-2 text-center">Extinctions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {massSimResults.results.map((r, i) => (
                      <tr key={r.id} className={`border-b border-stone-700/50 ${i === 0 ? 'text-amber-300' : i === 1 ? 'text-stone-300' : i === 2 ? 'text-orange-300' : 'text-stone-400'}`}>
                        <td className="py-2 px-2 font-bold">{i + 1}</td>
                        <td className="py-2 px-2 font-semibold">{r.name}</td>
                        <td className="py-2 px-2 text-xs">{r.race} {r.class} (Niv.{r.level})</td>
                        <td className="py-2 px-2 text-right font-bold">{r.totalDamage.toLocaleString('fr-FR')}</td>
                        <td className="py-2 px-2 text-right">{r.avgDamage.toLocaleString('fr-FR')}</td>
                        <td className="py-2 px-2 text-right text-green-400">{r.bestDamage.toLocaleString('fr-FR')}</td>
                        <td className="py-2 px-2 text-right text-red-400">{r.worstDamage === Infinity ? '—' : r.worstDamage.toLocaleString('fr-FR')}</td>
                        <td className="py-2 px-2 text-center">{r.totalDeaths}/{MASS_SIM_FIGHTS}</td>
                        <td className="py-2 px-2 text-center">{r.totalExtinctions}/{MASS_SIM_FIGHTS}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Détails par combat (accordéon) */}
              <details className="mt-4">
                <summary className="text-stone-400 text-sm cursor-pointer hover:text-stone-300">
                  Détails combat par combat
                </summary>
                <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
                  {massSimResults.results.map((r) => (
                    <div key={r.id} className="bg-stone-900 rounded p-3">
                      <div className="text-sm font-bold text-stone-300 mb-1">{r.name}</div>
                      <div className="flex flex-wrap gap-2">
                        {r.fights.map((f, fi) => (
                          <div
                            key={fi}
                            className={`text-xs px-2 py-1 rounded ${
                              f.extinction ? 'bg-red-900/50 text-red-300' :
                              f.died ? 'bg-orange-900/50 text-orange-300' :
                              'bg-green-900/50 text-green-300'
                            }`}
                          >
                            #{fi + 1}: {f.damage.toLocaleString('fr-FR')} dmg
                            {f.extinction ? ' ☠️' : f.died ? ' 💀' : ' ✓'}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* ================================================================ */}
      {/* LEADERBOARD */}
      {/* ================================================================ */}
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
                  <th className="py-2 px-2 text-right">Dernière tentative</th>
                  <th className="py-2 px-2 text-right">Tentatives</th>
                  <th className="py-2 px-2 text-center">Matin</th>
                  <th className="py-2 px-2 text-center">Aprem</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => (
                  <tr key={entry.id} className={`border-b border-stone-700/50 ${i === 0 ? 'text-amber-300' : i === 1 ? 'text-stone-300' : i === 2 ? 'text-orange-300' : 'text-stone-400'}`}>
                    <td className="py-2 px-2 font-bold">{i + 1}</td>
                    <td className="py-2 px-2">{entry.characterName}</td>
                    <td className="py-2 px-2 text-right font-bold">{(entry.totalDamage || 0).toLocaleString('fr-FR')}</td>
                    <td className="py-2 px-2 text-right">{(entry.lastAttemptDamage || 0).toLocaleString('fr-FR')}</td>
                    <td className="py-2 px-2 text-right">{entry.totalAttempts || 0}</td>
                    <td className="py-2 px-2 text-center">{entry.morningUsed ? '✅' : '—'}</td>
                    <td className="py-2 px-2 text-center">{entry.afternoonUsed ? '✅' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats du boss (référence) */}
      <div className="mt-4 p-3 bg-stone-800/50 rounded-lg">
        <h4 className="text-sm font-bold text-stone-400 mb-2">📊 Stats du boss (référence)</h4>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs text-stone-500">
          <span>❤️ PV: {WORLD_BOSS.baseStats.hp.toLocaleString('fr-FR')}</span>
          <span>⚔️ Auto: {WORLD_BOSS.baseStats.auto}</span>
          <span>🔮 Cap: {WORLD_BOSS.baseStats.cap}</span>
          <span>🛡️ Déf: {WORLD_BOSS.baseStats.def}</span>
          <span>✨ ResC: {WORLD_BOSS.baseStats.rescap}</span>
          <span>💨 Vit: {WORLD_BOSS.baseStats.spd}</span>
        </div>
        <p className="text-xs text-stone-500 mt-1">EXTINCTION au tour 10 — Max 2 tentatives/jour (matin + après-midi)</p>
      </div>

      {/* Contrôle son */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => {
            setIsMuted(prev => !prev);
            if (isMuted && volume === 0) setVolume(0.05);
          }}
          className="text-stone-400 hover:text-white transition text-lg"
        >
          {isMuted || volume === 0 ? '🔇' : '🔊'}
        </button>
        <input
          type="range"
          min="0"
          max="0.3"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            setIsMuted(v === 0);
            if (bossAudioRef.current) {
              bossAudioRef.current.volume = v;
              bossAudioRef.current.muted = v === 0;
            }
          }}
          className="w-32 accent-red-500"
        />
        <span className="text-stone-500 text-xs">Volume musique boss</span>
      </div>

      <audio ref={bossAudioRef} loop>
        <source src="/assets/music/cataclysm.mp3" type="audio/mpeg" />
      </audio>
    </div>
  );
};

export default WorldBossAdmin;
