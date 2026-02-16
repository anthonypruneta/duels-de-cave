import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import { getUserCharacter } from '../services/characterService';
import { getWorldBossEvent } from '../services/worldBossService';
import { simulerWorldBossCombat } from '../utils/worldBossCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { WORLD_BOSS, EVENT_STATUS } from '../data/worldBoss';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getWeaponById } from '../data/weapons';
import { getEquippedWeapon } from '../services/dungeonService';

const WorldBoss = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Données
  const [character, setCharacter] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Combat
  const [combatLogs, setCombatLogs] = useState([]);
  const [combatResult, setCombatResult] = useState(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [playerHP, setPlayerHP] = useState(0);
  const [playerMaxHP, setPlayerMaxHP] = useState(0);
  const [bossHP, setBossHP] = useState(0);
  const [bossMaxHP, setBossMaxHP] = useState(0);
  const replayTokenRef = useRef(0);
  const logContainerRef = useRef(null);

  // Musique
  const bossAudioRef = useRef(null);
  const [volume, setVolume] = useState(0.05);
  const [isMuted, setIsMuted] = useState(false);
  const [isSoundOpen, setIsSoundOpen] = useState(false);

  // Chargement initial
  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      const [charResult, eventResult] = await Promise.all([
        getUserCharacter(currentUser.uid),
        getWorldBossEvent()
      ]);

      if (charResult.success && charResult.data) {
        const char = charResult.data;
        let weaponId = char.equippedWeaponId || null;
        let weaponData = weaponId ? getWeaponById(weaponId) : null;
        if (!weaponData) {
          const weaponResult = await getEquippedWeapon(char.userId || currentUser.uid);
          weaponData = weaponResult.success ? weaponResult.weapon : null;
          weaponId = weaponResult.success ? weaponResult.weapon?.id || null : null;
        }
        setCharacter(normalizeCharacterBonuses({
          ...char,
          level: char.level ?? 1,
          equippedWeaponData: weaponData,
          equippedWeaponId: weaponId
        }));
      }

      if (eventResult.success) setEventData(eventResult.data);
      setLoading(false);
    };
    load();
  }, [currentUser]);

  // Lancer la musique dès l'ouverture
  useEffect(() => {
    if (!loading && bossAudioRef.current) {
      bossAudioRef.current.volume = volume;
      bossAudioRef.current.muted = isMuted;
      bossAudioRef.current.play().catch(() => {});
    }
    return () => {
      if (bossAudioRef.current) bossAudioRef.current.pause();
    };
  }, [loading]);

  // Sync volume
  useEffect(() => {
    if (bossAudioRef.current) {
      bossAudioRef.current.volume = volume;
      bossAudioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [combatLogs]);

  const handleFight = async () => {
    if (!character || !eventData || eventData.status !== EVENT_STATUS.ACTIVE || isReplaying) return;

    setCombatResult(null);
    setCombatLogs([`🔥 ${character.name} se prépare à affronter ${WORLD_BOSS.nom}...`]);

    replayTokenRef.current++;
    const currentToken = replayTokenRef.current;

    const result = simulerWorldBossCombat(character, eventData.hpRemaining);

    setPlayerHP(result.p1MaxHP);
    setPlayerMaxHP(result.p1MaxHP);
    setBossHP(result.bossMaxHP);
    setBossMaxHP(result.bossMaxHP);
    setIsReplaying(true);

    await replayCombatSteps(result.steps, {
      setCombatLog: (logs) => {
        if (replayTokenRef.current !== currentToken) return;
        setCombatLogs(typeof logs === 'function' ? logs : Array.isArray(logs) ? logs : []);
      },
      onStepHP: (step) => {
        if (replayTokenRef.current !== currentToken) return;
        setPlayerHP(Math.max(0, step.p1HP));
        setBossHP(Math.max(0, step.p2HP));
      },
      speed: 'normal'
    });

    if (replayTokenRef.current !== currentToken) return;

    setIsReplaying(false);
    setCombatResult(result);
    // Combat non enregistré (mode test)
  };

  const isActive = eventData?.status === EVENT_STATUS.ACTIVE;
  const hpPercent = eventData ? Math.max(0, (eventData.hpRemaining / eventData.hpMax) * 100) : 0;
  const hpBarColor = hpPercent > 50 ? 'bg-red-600' : hpPercent > 25 ? 'bg-orange-500' : 'bg-yellow-500';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-red-400 text-2xl animate-pulse">Chargement...</div>
        <audio ref={bossAudioRef} loop>
          <source src="/assets/music/cataclysm.mp3" type="audio/mpeg" />
        </audio>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <Header />

      {/* Contrôle son */}
      <div className="fixed top-20 right-4 z-50 flex flex-col items-end gap-2">
        <button
          onClick={() => setIsSoundOpen(prev => !prev)}
          className="bg-red-700 text-white border border-red-500 px-3 py-2 text-sm font-bold shadow-lg hover:bg-red-600"
        >
          {isMuted || volume === 0 ? '🔇' : '🔊'} Son
        </button>
        {isSoundOpen && (
          <div className="bg-stone-900 border border-stone-600 p-3 w-56 shadow-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsMuted(prev => !prev);
                  if (isMuted && volume === 0) setVolume(0.05);
                }}
                className="text-lg"
              >
                {isMuted ? '🔇' : '🔊'}
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
                }}
                className="w-full accent-red-500"
              />
              <span className="text-xs text-stone-200 w-10 text-right">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto pt-20">
        {/* Titre */}
        <div className="text-center mb-8">
          <div className="bg-stone-900/80 border-2 border-red-600 rounded-xl px-6 py-4 shadow-2xl inline-block">
            <h1 className="text-4xl font-bold text-red-400">☄️ {WORLD_BOSS.nom}</h1>
            <p className="text-stone-400 mt-1">{WORLD_BOSS.description}</p>
          </div>
        </div>

        {/* Event inactif */}
        {!isActive && (
          <div className="bg-stone-800/90 border-2 border-stone-600 rounded-xl p-8 text-center">
            <p className="text-stone-400 text-xl">L'event n'est pas actif pour le moment</p>
            <p className="text-stone-500 mt-2">Revenez plus tard !</p>
          </div>
        )}

        {/* Event actif */}
        {isActive && (
          <>
            {/* Barre de vie du boss */}
            <div className="bg-stone-800/90 border-2 border-red-700 rounded-xl p-5 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-red-300 font-bold text-lg">{WORLD_BOSS.nom}</span>
                <span className="text-stone-300 font-mono">
                  {eventData.hpRemaining.toLocaleString('fr-FR')} / {eventData.hpMax.toLocaleString('fr-FR')} PV
                </span>
              </div>
              <div className="w-full bg-stone-700 rounded-full h-7 overflow-hidden">
                <div
                  className={`h-full ${hpBarColor} rounded-full transition-all duration-500`}
                  style={{ width: `${hpPercent}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-stone-500">
                <span>{hpPercent.toFixed(1)}% restant</span>
                <span>{eventData.totalAttempts || 0} tentatives au total</span>
              </div>
            </div>

            {/* Personnage du joueur */}
            {!character ? (
              <div className="bg-stone-800/90 border-2 border-stone-600 rounded-xl p-6 text-center mb-6">
                <p className="text-stone-400">Tu n'as pas de personnage actif.</p>
                <button
                  onClick={() => navigate('/')}
                  className="mt-3 bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg transition"
                >
                  Creer un personnage
                </button>
              </div>
            ) : (
              <div className="bg-stone-800/90 border-2 border-stone-600 rounded-xl p-5 mb-6">
                <div className="flex items-center gap-4 mb-4">
                  {character.characterImage && (
                    <img
                      src={character.characterImage}
                      alt={character.name}
                      className="w-16 h-auto object-contain rounded"
                    />
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-white">{character.name}</h3>
                    <p className="text-amber-300 text-sm">{character.race} - {character.class} (Niv. {character.level || 1})</p>
                  </div>
                </div>

                {/* Bouton combat */}
                <button
                  onClick={handleFight}
                  disabled={isReplaying}
                  className="w-full bg-red-700 hover:bg-red-600 disabled:bg-stone-700 disabled:text-stone-500 text-white py-3 rounded-xl font-bold text-lg transition shadow-lg"
                >
                  {isReplaying ? '⚔️ Combat en cours...' : `☄️ Affronter ${WORLD_BOSS.nom}`}
                </button>
                <p className="text-stone-500 text-xs text-center mt-2">Mode test — le combat ne sera pas enregistre</p>
              </div>
            )}

            {/* Barres de vie replay */}
            {(isReplaying || combatResult) && (
              <div className="bg-stone-800/90 border-2 border-stone-600 rounded-xl p-4 mb-6">
                {/* Joueur */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-blue-300 font-bold">{character?.name || 'Joueur'}</span>
                    <span className="text-stone-300 font-mono">{Math.max(0, playerHP)} / {playerMaxHP}</span>
                  </div>
                  <div className="w-full bg-stone-700 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${playerMaxHP > 0 ? Math.max(0, (playerHP / playerMaxHP) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
                {/* Boss */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-red-300 font-bold">{WORLD_BOSS.nom}</span>
                    <span className="text-stone-300 font-mono">{Math.max(0, bossHP)} / {bossMaxHP}</span>
                  </div>
                  <div className="w-full bg-stone-700 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all duration-300"
                      style={{ width: `${bossMaxHP > 0 ? Math.max(0, (bossHP / bossMaxHP) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {/* Resultat */}
            {combatResult && !isReplaying && (
              <div className={`rounded-xl p-5 mb-6 border-2 ${
                combatResult.reachedExtinction ? 'bg-red-900/50 border-red-700' :
                combatResult.damageDealt > 0 ? 'bg-amber-900/50 border-amber-600' :
                'bg-stone-800/90 border-stone-600'
              }`}>
                <div className="text-2xl font-bold text-center mb-2">
                  {combatResult.reachedExtinction && <span className="text-red-400">☠️ EXTINCTION</span>}
                  {!combatResult.reachedExtinction && combatResult.playerDied && <span className="text-orange-400">💀 Defaite</span>}
                  {!combatResult.reachedExtinction && !combatResult.playerDied && <span className="text-green-400">🎉 Victoire !</span>}
                </div>
                <div className="text-center text-lg">
                  Degats infliges : <span className="text-amber-400 font-bold">{combatResult.damageDealt.toLocaleString('fr-FR')}</span>
                </div>
              </div>
            )}

            {/* Logs de combat */}
            {combatLogs.length > 0 && (
              <div
                ref={logContainerRef}
                className="bg-stone-900/90 border-2 border-stone-700 rounded-xl p-4 max-h-96 overflow-y-auto font-mono text-xs text-stone-300 space-y-1"
              >
                {combatLogs.map((log, i) => (
                  <div
                    key={i}
                    className={
                      log.includes('EXTINCTION') ? 'text-red-400 font-bold text-sm' :
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
          </>
        )}

        {/* Retour */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg transition"
          >
            ← Retour
          </button>
        </div>
      </div>

      <audio ref={bossAudioRef} loop>
        <source src="/assets/music/cataclysm.mp3" type="audio/mpeg" />
      </audio>
    </div>
  );
};

export default WorldBoss;
