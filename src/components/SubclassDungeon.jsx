/**
 * Donjon Collège Kunugigaoka — Débloquer une sous-classe.
 * Niveau 400 requis. Consomme les mêmes runs que les autres donjons (bloqué jusqu'au lundi après le tournoi).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter, updateCharacterSubclass } from '../services/characterService';
import { getPlayerDungeonSummary, startDungeonRun } from '../services/dungeonService';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import {
  SUBCLASS_DUNGEON_NAME,
  SUBCLASS_DUNGEON_LEVEL_REQUIRED,
  SUBCLASS_BOSS,
  createSubclassBossCombatant,
} from '../data/subclassDungeon';
import { getSubclassesForClass } from '../data/subclasses';
import { buildSubclassDescription } from '../utils/descriptionBuilders';
import { preparerCombattant, simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { isSubclassDungeonVisible } from '../data/featureFlags';
import { checkAndAwardTitles } from '../services/titleService';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { MiniCard } from './CombatLayout';
import UnifiedCharacterCard from './UnifiedCharacterCard';

const subclassImageModules = import.meta.glob('../assets/subclass/*.png', { eager: true, import: 'default' });
const getSubclassImage = (imageFile) => {
  if (!imageFile) return null;
  return subclassImageModules[`../assets/subclass/${imageFile}`] || null;
};

const STAT_LABELS = { hp: 'HP', auto: 'Auto', def: 'DEF', cap: 'CAP', rescap: 'RESC', spd: 'VIT' };

const SubclassDungeon = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [gameState, setGameState] = useState('lobby');
  const [player, setPlayer] = useState(null);
  const [boss, setBoss] = useState(null);
  const [playerCombatBase, setPlayerCombatBase] = useState(null);
  const [bossCombatBase, setBossCombatBase] = useState(null);
  const [playerCombatModifiers, setPlayerCombatModifiers] = useState(null);
  const [playerCombatStatus, setPlayerCombatStatus] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [error, setError] = useState(null);
  const [dungeonSummary, setDungeonSummary] = useState(null);
  const [selectedSubclass, setSelectedSubclass] = useState(null);
  const [savingSubclass, setSavingSubclass] = useState(false);
  const logEndRef = useRef(null);
  const logContainerRef = useRef(null);
  const hasAutoStartedRef = useRef(false);
  const ensureSubclassMusic = () => {
    const el = document.getElementById('subclass-dungeon-music');
    if (el) {
      if (el.paused) el.play().catch(() => {});
    }
  };

  const stopSubclassMusic = () => {
    const el = document.getElementById('subclass-dungeon-music');
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  };

  useEffect(() => {
    if (gameState === 'lobby' || gameState === 'fighting' || gameState === 'reward' || gameState === 'defeat') {
      ensureSubclassMusic();
      return () => stopSubclassMusic();
    }
    stopSubclassMusic();
  }, [gameState, loading]);

  // Mobile: certains layouts masquent le bouton, on lance le combat automatiquement.
  useEffect(() => {
    if (gameState !== 'fighting') {
      hasAutoStartedRef.current = false;
      return;
    }

    if (typeof window === 'undefined' || !window.matchMedia) return;
    const isPhone = window.matchMedia('(max-width: 767px)').matches;
    if (!isPhone) return;

    if (!player || !boss || !character) return;
    if (isSimulating) return;
    if (combatResult !== null) return;
    if (hasAutoStartedRef.current) return;

    hasAutoStartedRef.current = true;
    void simulateCombat();
  }, [gameState, player, boss, character, combatResult, isSimulating]);

  useEffect(() => {
    if (!currentUser) return;
    if (!isSubclassDungeonVisible()) {
      navigate('/dungeons', { replace: true });
      return;
    }
    const loadData = async () => {
      setLoading(true);
      const charResult = await getUserCharacter(currentUser.uid);
      if (!charResult.success || !charResult.data) {
        navigate('/');
        setLoading(false);
        return;
      }
      const characterData = charResult.data;
      const level = characterData.level ?? 1;
      const forestBoosts = { ...getEmptyStatBoosts(), ...(characterData.forestBoosts || {}) };
      setCharacter(normalizeCharacterBonuses({
        ...characterData,
        forestBoosts,
        level,
        equippedWeaponData: characterData.equippedWeaponData ?? null,
        equippedWeaponId: characterData.equippedWeaponId ?? null,
      }));
      const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
      if (summaryResult.success) setDungeonSummary(summaryResult.data);
      setLoading(false);
    };
    loadData();
  }, [currentUser, navigate]);

  // Auto-scroll du journal : scroll le conteneur uniquement (pas la page)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia || !window.matchMedia('(min-width: 768px)').matches || !logContainerRef.current) return;
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [combatLog]);

  const characterLevel = character?.level ?? 1;
  const canAccess = character && characterLevel >= SUBCLASS_DUNGEON_LEVEL_REQUIRED && (dungeonSummary?.runsRemaining ?? 0) > 0;

  const handleStartRun = async () => {
    setError(null);
    setSelectedSubclass(null);
    const result = await startDungeonRun(currentUser.uid);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setGameState('fighting');
    setCombatResult(null);
    setIsSimulating(false);
    ensureSubclassMusic();
    const playerReady = preparerCombattant(character);
    const bossReady = preparerCombattant(createSubclassBossCombatant());
    setPlayer(playerReady);
    setBoss(bossReady);
    setPlayerCombatBase(null);
    setBossCombatBase(null);
    setCombatLog([`⚔️ ${SUBCLASS_DUNGEON_NAME} — ${playerReady.name} vs ${SUBCLASS_BOSS.nom} !`]);
  };

  const simulateCombat = async () => {
    if (!player || !boss || !character || isSimulating) return;
    setIsSimulating(true);
    setCombatResult(null);
    setPlayerCombatBase(null);
    setBossCombatBase(null);
    setPlayerCombatModifiers(null);
    setPlayerCombatStatus(null);
    const logs = [...combatLog, `--- Combat contre ${boss.name} ---`];
    const matchResult = simulerMatch(character, createSubclassBossCombatant());
    checkAndAwardTitles(currentUser.uid, matchResult.steps, matchResult, character, { mode: 'sous-classe', bossId: 'koro_sensei' });
    const finalLogs = await replayCombatSteps(matchResult.steps, {
      setCombatLog,
      onStepHP: (step) => {
        setPlayerCombatBase(step.p1Base ?? undefined);
        setBossCombatBase(step.p2Base ?? undefined);
        setPlayerCombatModifiers(step.p1Modifiers ?? null);
        setPlayerCombatStatus(step.p1Status ?? null);
        setPlayer((prev) => prev ? { ...prev, currentHP: step.p1HP, shield: step.p1Shield ?? 0 } : null);
        setBoss((prev) => prev ? { ...prev, currentHP: step.p2HP, shield: step.p2Shield ?? 0 } : null);
      },
      existingLogs: logs,
      speed: 'normal',
    });
    logs.length = 0;
    logs.push(...finalLogs);
    const lastStep = matchResult.steps[matchResult.steps.length - 1];
    const playerWon = lastStep && lastStep.p1HP > 0;
    if (playerWon) {
      logs.push(`🏆 ${player?.name} terrasse ${boss?.name} !`);
      setCombatLog([...logs]);
      setCombatResult('victory');
      setGameState('reward');
    } else {
      logs.push(`💀 ${player?.name} a été vaincu par ${boss?.name}...`);
      setCombatLog([...logs]);
      setCombatResult('defeat');
      setGameState('defeat');
    }
    setIsSimulating(false);
  };

  const handleChooseSubclass = async (sub) => {
    if (!sub) return;
    setSavingSubclass(true);
    const result = await updateCharacterSubclass(currentUser.uid, { id: sub.id, name: sub.name });
    if (result.success) {
      setCharacter((prev) => (prev ? { ...prev, subclass: { id: sub.id, name: sub.name } } : prev));
      setSelectedSubclass(sub.id);
    } else {
      setError(result.error || 'Erreur lors de la sauvegarde de la sous-classe.');
    }
    setSavingSubclass(false);
  };

  const handleBackToLobby = () => {
    setGameState('lobby');
    setPlayer(null);
    setBoss(null);
    setCombatLog([]);
    setCombatResult(null);
    setSelectedSubclass(null);
  };

  const formatLogMessage = (text) => {
    if (!player || !boss) return text;
    const pName = player.name;
    const bName = boss.name;
    const nameRegex = new RegExp(`(${pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
    return text.split(nameRegex).map((part, i) => {
      if (part === pName) return <span key={i} className="font-bold text-blue-400">{part}</span>;
      if (part === bName) return <span key={i} className="font-bold text-amber-400">{part}</span>;
      return part;
    });
  };

  const BossCard = ({ bossChar, combatBaseOverride: bossCombatBaseOverride }) => {
    if (!bossChar) return null;
    const base = bossCombatBaseOverride ?? bossChar.base;
    const hpPercent = Math.max(0, Math.min(100, (bossChar.currentHP / bossChar.maxHP) * 100));
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const shieldPercent = bossChar.maxHP > 0 ? Math.min(100, ((bossChar.shield ?? 0) / bossChar.maxHP) * 100) : 0;
    const bossImg = getSubclassImage(bossChar.imageFile);
    return (
      <UnifiedCharacterCard
        header={`Boss • ${SUBCLASS_DUNGEON_NAME}`}
        name={bossChar.name}
        image={bossImg}
        fallback={<span className="text-7xl">{SUBCLASS_BOSS.icon}</span>}
        topStats={<><span>HP: {base.hp}</span><span>VIT: {base.spd}</span></>}
        hpText={`${bossChar.name} — PV ${Math.max(0, bossChar.currentHP)}/${bossChar.maxHP}`}
        hpPercent={hpPercent}
        hpClass={hpClass}
        shieldPercent={shieldPercent}
        mainStats={
          <>
            <div>Auto: {base.auto}</div>
            <div>DEF: {base.def}</div>
            <div>CAP: {base.cap}</div>
            <div>RESC: {base.rescap}</div>
          </>
        }
        details={bossChar.ability ? (
          <div className="flex items-start gap-2 bg-stone-700/50 p-2 rounded-lg text-xs border border-stone-600">
            <span className="text-lg">🎓</span>
            <div className="flex-1">
              <div className="text-yellow-300 font-semibold mb-1">{bossChar.ability.name}</div>
              <div className="text-stone-400 text-[10px]">{bossChar.ability.description}</div>
            </div>
          </div>
        ) : null}
        cardClassName=""
        borderId="gold"
      />
    );
  };

  const subclassesOptions = character?.class ? getSubclassesForClass(character.class) : [];

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-4xl mx-auto pt-20 text-center text-amber-400 text-2xl">Chargement du Collège...</div>
      </div>
    );
  }

  if (!character) {
    return null;
  }

  // Écran de combat
  if (gameState === 'fighting' && player && boss) {
    const playerHP = player?.currentHP ?? player?.maxHP ?? playerCombatBase?.hp ?? player?.base?.hp ?? 1;
    const playerMaxHP = player?.maxHP ?? playerCombatBase?.hp ?? player?.base?.hp ?? 1;
    const playerShield = player?.shield ?? 0;
    const bossHP = boss?.currentHP ?? boss?.maxHP ?? bossCombatBase?.hp ?? boss?.base?.hp ?? 1;
    const bossMaxHP = boss?.maxHP ?? bossCombatBase?.hp ?? boss?.base?.hp ?? 1;
    const bossShield = boss?.shield ?? 0;

    return (
      <div className="min-h-screen p-6">
        <Header />
        <audio id="subclass-dungeon-music" loop>
          <source src="/assets/music/koro.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-[1800px] mx-auto pt-20 sm:pt-16">
          <div className="flex justify-center gap-3 md:gap-4 mb-6">
            {combatResult === null && (
              <button
                onClick={simulateCombat}
                disabled={isSimulating || !player || !boss}
                className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-stone-700 disabled:text-stone-400 text-stone-900 px-6 py-3 rounded-lg font-bold text-sm md:text-base flex items-center justify-center gap-2 transition shadow-lg border border-yellow-400"
              >
                ▶️ Lancer le combat
              </button>
            )}
            <button
              onClick={handleBackToLobby}
              className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-6 py-3 rounded-lg font-bold text-sm md:text-base flex items-center justify-center gap-2 transition shadow-lg border border-stone-500"
            >
              ← Abandonner
            </button>
          </div>

          {combatResult === 'victory' && (
            <div className="flex justify-center mb-4">
              <div className="bg-yellow-500/90 text-stone-900 px-8 py-3 rounded-xl font-bold text-xl animate-pulse shadow-2xl border border-yellow-400">
                🏆 {player.name} remporte le combat ! 🏆
              </div>
            </div>
          )}
          {combatResult === 'defeat' && (
            <div className="flex justify-center mb-4">
              <div className="bg-red-900/80 text-red-200 px-8 py-3 rounded-xl font-bold text-xl shadow-2xl border border-red-600">
                💀 {player.name} a été vaincu... 💀
              </div>
            </div>
          )}

          {/* ═══ MOBILE (< 1024px) : Mini-cartes + journal compact ═══ */}
          <div className="lg:hidden flex flex-col gap-2">
            <div className="flex gap-2">
              <MiniCard entity={{ name: player?.name, currentHP: playerHP, maxHP: playerMaxHP, shield: playerShield ?? 0, base: playerCombatBase ?? player?.base ?? {}, image: player?.characterImage }} side="left" />
              <MiniCard entity={{ name: boss?.name, currentHP: bossHP, maxHP: bossMaxHP, shield: bossShield ?? 0, base: bossCombatBase ?? boss?.base ?? {}, ability: boss?.ability, image: boss?.characterImage }} side="right" />
            </div>
            <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col" style={{ height: 'calc(100dvh - 280px)', minHeight: '260px', maxHeight: '420px' }}>
              <div className="bg-stone-900/90 px-3 py-2 border-b border-yellow-500/50 rounded-t-xl">
                <h2 className="text-sm font-bold text-yellow-300 text-center">🎓 {SUBCLASS_DUNGEON_NAME}</h2>
              </div>
              <div ref={logContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
                {combatLog.length === 0 ? (
                  <p className="text-stone-500 italic text-center py-4">Cliquez sur "Lancer le combat"...</p>
                ) : (
                  <>
                    {combatLog.map((log, idx) => {
                      const isP1 = log.startsWith('[P1]');
                      const isP2 = log.startsWith('[P2]');
                      const cleanLog = log.replace(/^\[P[12]\]\s*/, '');
                      if (!isP1 && !isP2) {
                        if (log.includes('🏆')) return <div key={idx} className="flex justify-center my-2"><div className="bg-yellow-500/90 text-stone-900 px-3 py-1.5 font-bold text-xs rounded-lg">{formatLogMessage(cleanLog)}</div></div>;
                        if (log.includes('💀')) return <div key={idx} className="flex justify-center my-2"><div className="bg-red-900 text-red-200 px-3 py-1.5 font-bold text-xs rounded-lg">{formatLogMessage(cleanLog)}</div></div>;
                        if (log.includes('---')) return <div key={idx} className="flex justify-center my-1"><div className="bg-stone-700 text-stone-200 px-2 py-0.5 text-[10px] font-bold rounded">{formatLogMessage(cleanLog)}</div></div>;
                        return <div key={idx} className="text-center text-stone-400 text-[10px] italic">{formatLogMessage(cleanLog)}</div>;
                      }
                      if (isP1) return <div key={idx} className="flex justify-start"><div className="max-w-[85%] bg-stone-700 text-stone-200 px-2 py-1 rounded border-l-2 border-blue-500 text-[11px]">{formatLogMessage(cleanLog)}</div></div>;
                      return <div key={idx} className="flex justify-end"><div className="max-w-[85%] bg-stone-700 text-stone-200 px-2 py-1 rounded border-r-2 border-yellow-500 text-[11px]">{formatLogMessage(cleanLog)}</div></div>;
                    })}
                    <div ref={logEndRef} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ═══ DESKTOP (1024px+) : Layout original avec detailsPlacement ═══ */}
          <div className="hidden lg:flex flex-row gap-4 items-start justify-center text-sm">
            <div className="w-auto flex-shrink-0">
              <CharacterCardContent character={player} showHpBar combatBaseOverride={playerCombatBase} combatModifiers={playerCombatModifiers} opponent={boss} combatStatus={playerCombatStatus} detailsPlacement="left" />
            </div>

            <div className="flex-1 min-w-[400px] flex flex-col">
              <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col h-[600px]">
                <div className="bg-stone-900/90 p-3 border-b border-yellow-500/50 rounded-t-xl">
                  <h2 className="text-xl font-bold text-yellow-300 text-center">🎓 {SUBCLASS_DUNGEON_NAME}</h2>
                </div>
                <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
                  {combatLog.length === 0 ? (
                    <p className="text-stone-500 italic text-center py-8 text-sm">Cliquez sur "Lancer le combat" pour commencer...</p>
                  ) : (
                    <>
                      {combatLog.map((log, idx) => {
                        const isP1 = log.startsWith('[P1]');
                        const isP2 = log.startsWith('[P2]');
                        const cleanLog = log.replace(/^\[P[12]\]\s*/, '');
                        if (!isP1 && !isP2) {
                          if (log.includes('🏆')) {
                            return (
                              <div key={idx} className="flex justify-center my-4">
                                <div className="bg-yellow-500/90 text-stone-900 px-6 py-3 rounded-lg font-bold text-lg shadow-lg border border-yellow-400">{formatLogMessage(cleanLog)}</div>
                              </div>
                            );
                          }
                          if (log.includes('💀')) {
                            return (
                              <div key={idx} className="flex justify-center my-4">
                                <div className="bg-red-900/80 text-red-200 px-6 py-3 rounded-lg font-bold text-lg shadow-lg border border-red-600">{formatLogMessage(cleanLog)}</div>
                              </div>
                            );
                          }
                          if (log.includes('---') || log.includes('⚔️')) {
                            return (
                              <div key={idx} className="flex justify-center my-3">
                                <div className="bg-stone-700/80 text-stone-200 px-4 py-1 rounded-lg text-sm font-bold border border-stone-500">{formatLogMessage(cleanLog)}</div>
                              </div>
                            );
                          }
                          return (
                            <div key={idx} className="flex justify-center">
                              <div className="text-stone-400 text-sm italic">{formatLogMessage(cleanLog)}</div>
                            </div>
                          );
                        }
                        if (isP1) {
                          return (
                            <div key={idx} className="flex justify-start">
                              <div className="max-w-[80%]">
                                <div className="bg-stone-700/80 text-stone-200 px-4 py-2 rounded-lg shadow-lg border-l-4 border-blue-500">
                                  <div className="text-sm">{formatLogMessage(cleanLog)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        if (isP2) {
                          return (
                            <div key={idx} className="flex justify-end">
                              <div className="max-w-[80%]">
                                <div className="bg-stone-700/80 text-stone-200 px-4 py-2 rounded-lg shadow-lg border-r-4 border-yellow-500">
                                  <div className="text-sm">{formatLogMessage(cleanLog)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      })}
                      <div ref={logEndRef} />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="w-auto flex-shrink-0">
              <BossCard bossChar={boss} combatBaseOverride={bossCombatBase} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Écran défaite
  if (gameState === 'defeat') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <audio id="subclass-dungeon-music" loop>
          <source src="/assets/music/koro.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-2xl mx-auto pt-16 text-center">
          <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl p-10 shadow-lg">
            <div className="text-7xl mb-6">💀</div>
            <h2 className="text-3xl font-bold text-red-400 mb-4">Défaite...</h2>
            <p className="text-stone-300 mb-8">{SUBCLASS_BOSS.nom} vous a vaincu. Réessayez plus tard.</p>
            <button onClick={handleBackToLobby} className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 rounded-lg font-bold border border-stone-500 transition">
              ← Retour au collège
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Écran récompense : choix de la sous-classe
  if (gameState === 'reward' && subclassesOptions.length > 0) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <audio id="subclass-dungeon-music" loop>
          <source src="/assets/music/koro.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-5xl mx-auto pt-16 text-center">
          <div className="flex justify-center mb-8">
            <CharacterCardContent character={character} detailsPlacement="left" />
          </div>

          <div className="inline-block bg-stone-950/85 border border-yellow-500/80 rounded-lg px-6 py-3 shadow-lg mb-6">
            <h2 className="text-2xl font-bold text-yellow-400">🏆 Victoire !</h2>
            <p className="text-stone-300 text-sm mt-1">Choisissez votre sous-classe pour la classe {character.class}.</p>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-600 rounded-xl p-4 mb-6 text-center shadow-lg">
              <p className="text-red-300">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-3xl mx-auto">
            {subclassesOptions.map((sub) => (
              <button
                key={sub.id}
                onClick={() => handleChooseSubclass(sub)}
                disabled={savingSubclass || selectedSubclass != null}
                className={`bg-stone-950/90 border-2 p-6 text-left rounded-xl shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl ${
                  selectedSubclass === sub.id
                    ? 'border-yellow-400 ring-2 ring-yellow-400/50'
                    : 'border-yellow-500/60 hover:border-yellow-400'
                } disabled:opacity-70`}
              >
                <div className="font-bold text-yellow-300 text-xl mb-2">{sub.name}</div>
                {sub.bonus && <div className="text-green-400 text-sm mb-2 font-semibold">{sub.bonus}</div>}
                <div className="text-stone-300 text-sm">{sub.abilityLabel}</div>
                <div className="text-stone-400 text-xs mt-2">{buildSubclassDescription(character.class, sub.id) || sub.description}</div>
                {selectedSubclass === sub.id && <div className="text-yellow-400 font-bold mt-3">✓ Choisi</div>}
              </button>
            ))}
          </div>

          {selectedSubclass != null && (
            <div className="text-center">
              <button
                onClick={() => navigate('/dungeons')}
                className="bg-yellow-500 hover:bg-yellow-600 text-stone-900 px-8 py-4 rounded-lg font-bold border border-yellow-400 transition shadow-lg"
              >
                ← Retour aux donjons
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Lobby
  const bossImg = getSubclassImage(SUBCLASS_BOSS.imageFile);

  const LobbyBossCard = () => (
    <UnifiedCharacterCard
      header={`Boss • ${SUBCLASS_DUNGEON_NAME}`}
      name={SUBCLASS_BOSS.nom}
      image={bossImg}
      fallback={<span className="text-7xl">{SUBCLASS_BOSS.icon}</span>}
      topStats={<><span>HP: {SUBCLASS_BOSS.stats.hp}</span><span>VIT: {SUBCLASS_BOSS.stats.spd}</span></>}
      mainStats={
        <>
          <div>Auto: {SUBCLASS_BOSS.stats.auto}</div>
          <div>DEF: {SUBCLASS_BOSS.stats.def}</div>
          <div>CAP: {SUBCLASS_BOSS.stats.cap}</div>
          <div>RESC: {SUBCLASS_BOSS.stats.rescap}</div>
        </>
      }
      details={
        <div className="flex items-start gap-2 bg-stone-700/50 p-2 rounded-lg text-xs border border-stone-600">
          <span className="text-lg">🎓</span>
          <div className="flex-1">
            <div className="text-yellow-300 font-semibold mb-1">{SUBCLASS_BOSS.ability.name} (CD {SUBCLASS_BOSS.ability.cooldown})</div>
            <div className="text-stone-400 text-[10px]">{SUBCLASS_BOSS.ability.description}</div>
          </div>
        </div>
      }
      cardClassName=""
      borderId="gold"
    />
  );

  return (
    <div className="min-h-screen p-6">
      <Header />
      <audio id="subclass-dungeon-music" loop>
        <source src="/assets/music/koro.mp3" type="audio/mpeg" />
      </audio>
      <div className="max-w-5xl mx-auto pt-16">
        {/* Titre */}
        <div className="flex justify-center mb-6">
          <div className="bg-stone-950/85 border border-yellow-500/80 rounded-lg px-8 py-3 shadow-lg">
            <h2 className="text-3xl md:text-4xl font-bold text-yellow-400">🎓 {SUBCLASS_DUNGEON_NAME}</h2>
          </div>
        </div>

        {/* Essais disponibles */}
        <div className="bg-stone-950/85 border border-yellow-500/60 rounded-xl p-5 mb-6 shadow-lg">
          <p className="text-yellow-300 font-bold text-sm uppercase tracking-wider">Essais disponibles</p>
          <p className="text-white text-3xl font-bold mt-1">{dungeonSummary?.runsRemaining ?? 0}</p>
          <p className="text-stone-400 text-xs mt-1">1 run = 1 combat</p>
        </div>

        {/* Erreurs */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-xl p-4 mb-6 text-center shadow-lg">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {characterLevel < SUBCLASS_DUNGEON_LEVEL_REQUIRED && (
          <div className="bg-red-950 border border-red-600 rounded-xl p-4 mb-6 text-center shadow-lg">
            <p className="text-red-300 font-bold">Le Collège Kunugigaoka est accessible à partir du niveau {SUBCLASS_DUNGEON_LEVEL_REQUIRED}.</p>
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-4 justify-center mb-6">
          <button
            onClick={handleStartRun}
            disabled={!canAccess}
            className={`px-10 py-4 rounded-lg font-bold text-lg transition shadow-lg ${
              canAccess ? 'bg-yellow-500 hover:bg-yellow-600 text-stone-900 border border-yellow-400' : 'bg-stone-700 text-stone-500 cursor-not-allowed border border-stone-600'
            }`}
          >
            {canAccess ? `⚔️ Défier ${SUBCLASS_BOSS.nom}` : 'Accès impossible'}
          </button>
          <button
            onClick={() => navigate('/dungeons')}
            className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-3 rounded-lg font-bold border border-stone-500 transition"
          >
            ← Retour aux donjons
          </button>
        </div>

        {/* Personnage gauche - Boss droite */}
        <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center">
          <div className="w-full md:w-auto md:flex-shrink-0">
            <CharacterCardContent character={character} detailsPlacement="left" />
          </div>
          <div className="w-full md:w-[340px] md:flex-shrink-0">
            <LobbyBossCard />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubclassDungeon;
