import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../contexts/AuthContext';
import {
  ensureWeeklyInfiniteLabyrinth,
  getCurrentWeekId,
  getUserLabyrinthProgress,
  launchLabyrinthCombat,
  resolveLabyrinthFloorImagePath,
  BOSS_TOP_FLOORS_EXTRA_HP,
  BOSS_TOP_FLOORS,
  LABYRINTH_FLOOR_COUNT
} from '../services/infiniteLabyrinthService';
import { getUserCharacter } from '../services/characterService';
import { getEquippedWeapon } from '../services/dungeonService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { classConstants, getRaceBonus, getClassBonus } from '../data/combatMechanics';
import { getRaceBonusText } from '../utils/descriptionBuilders';
import { getCalculatedClassDescription } from '../utils/calculatedClassDescription';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import CharacterCardContent from './CharacterCardContent';
import { isForgeActive } from '../data/featureFlags';
import { extractForgeUpgrade, computeForgeStatDelta, hasAnyForgeUpgrade } from '../data/forgeDungeon';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import { applyPassiveWeaponStats } from '../utils/weaponEffects';
import { applyAwakeningToBase, getAwakeningEffect, removeBaseRaceFlatBonusesIfAwakened } from '../utils/awakening';
import { checkAndAwardTitles } from '../services/titleService';

const weaponImageModules = import.meta.glob('../assets/weapons/*.png', { eager: true, import: 'default' });

const getWeaponImage = (imageFile) => {
  if (!imageFile) return null;
  return weaponImageModules[`../assets/weapons/${imageFile}`] || null;
};

const Tooltip = ({ children, content }) => (
  <span className="relative group cursor-help">
    {children}
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-stone-900 border border-amber-500 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
      {content}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-500" />
    </span>
  </span>
);

const STAT_LABELS = { hp: 'HP', auto: 'Auto', def: 'Déf', cap: 'Cap', rescap: 'ResC', spd: 'VIT' };
const getWeaponStatColor = (value) => {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-yellow-300';
};

const formatWeaponStats = (weapon) => {
  if (!weapon?.stats) return null;
  const entries = Object.entries(weapon.stats).filter(([, v]) => v !== 0);
  if (entries.length === 0) return null;
  return entries.map(([stat, value]) => (
    <span key={stat} className={`font-semibold ${getWeaponStatColor(value)}`}>
      {STAT_LABELS[stat] || stat} {value > 0 ? `+${value}` : value}
    </span>
  )).reduce((acc, node, index) => {
    if (index === 0) return [node];
    return acc.concat([<span key={`sep-${index}`} className="text-stone-400"> • </span>, node]);
  }, []);
};

const getWeaponTooltipContent = (weapon) => {
  if (!weapon) return null;
  const stats = formatWeaponStats(weapon);
  return (
    <span className="block whitespace-normal text-xs">
      <span className="block font-semibold text-white">{weapon.nom}</span>
      <span className="block text-stone-300">{weapon.description}</span>
      {weapon.effet && typeof weapon.effet === 'object' ? <span className="block text-amber-200">Effet: {weapon.effet.nom} — {weapon.effet.description}</span> : null}
      {stats ? <span className="block text-stone-200">Stats: {stats}</span> : null}
    </span>
  );
};

const getPassiveDetails = (passive) => {
  if (!passive) return null;
  const base = getMageTowerPassiveById(passive.id);
  const levelData = getMageTowerPassiveLevel(passive.id, passive.level);
  if (!base || !levelData) return null;
  return { ...base, level: passive.level, levelData };
};

const getForestBoosts = (character) => ({ ...getEmptyStatBoosts(), ...(character?.forestBoosts || {}) });
const getBaseWithBoosts = (character) => applyStatBoosts(character.base, getForestBoosts(character));

const mergeAwakeningEffects = (effects = []) => {
  const validEffects = effects.filter(Boolean);
  if (validEffects.length === 0) return null;

  return validEffects.reduce((acc, effect) => {
    if (effect.statMultipliers) {
      acc.statMultipliers = acc.statMultipliers || {};
      Object.entries(effect.statMultipliers).forEach(([stat, value]) => {
        acc.statMultipliers[stat] = (acc.statMultipliers[stat] ?? 1) * value;
      });
    }

    if (effect.statBonuses) {
      acc.statBonuses = acc.statBonuses || {};
      Object.entries(effect.statBonuses).forEach(([stat, value]) => {
        acc.statBonuses[stat] = (acc.statBonuses[stat] ?? 0) + value;
      });
    }

    return acc;
  }, {});
};

const getCalculatedDescription = getCalculatedClassDescription;

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
  const [replayP1Shield, setReplayP1Shield] = useState(0);
  const [replayP2Shield, setReplayP2Shield] = useState(0);
  const [replayP1Base, setReplayP1Base] = useState(null);
  const [replayP2Base, setReplayP2Base] = useState(null);
  const [replayP1Modifiers, setReplayP1Modifiers] = useState(null);
  const [replayP2Modifiers, setReplayP2Modifiers] = useState(null);
  const [replayP1Status, setReplayP1Status] = useState(null);
  const [replayP2Status, setReplayP2Status] = useState(null);

  const replayTimeoutRef = useRef(null);
  const replayTokenRef = useRef(null);
  const autoRunTokenRef = useRef(null);
  const logContainerRef = useRef(null);

  const currentFloor = progress?.currentFloor || 1;
  const defaultEnemyFloor = labyrinthData?.floors?.find((f) => f.floorNumber === currentFloor) || null;
  const shownEnemyFloor = displayEnemyFloor || defaultEnemyFloor;

  const formatLogMessage = (text) => {
    const pName = playerCharacter?.name;
    const eName = enemyCharacter?.name;
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

      const numRegex = /(\d+)\s*(points?\s*de\s*(?:vie|dégâts?|dommages?))/gi;
      let lastIndex = 0;
      let match;
      while ((match = numRegex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          parts.push(part.slice(lastIndex, match.index));
        }
        const isHeal = match[2].toLowerCase().includes('vie');
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

  const enemyCharacter = useMemo(() => {
    if (!shownEnemyFloor) return null;
    let awakeningRaces = shownEnemyFloor?.bossKit?.awakeningRaces || [];
    const floorNum = Number(shownEnemyFloor.floorNumber);
    if (floorNum === 90 && shownEnemyFloor?.type === 'boss' && awakeningRaces.length < 1) {
      const pool = Object.keys(races).filter((name) => races[name]?.awakening);
      awakeningRaces = pool.length ? [pool[0]] : [];
    }
    if (BOSS_TOP_FLOORS.includes(floorNum) && shownEnemyFloor?.type === 'boss' && awakeningRaces.length < 2) {
      const pool = Object.keys(races).filter((name) => races[name]?.awakening);
      const first = awakeningRaces[0];
      const other = pool.find((r) => r !== first) || first;
      awakeningRaces = first ? [first, other] : [pool[0], pool[1] || pool[0]].slice(0, 2);
    }
    const weapon = shownEnemyFloor?.bossKit?.weaponId ? getWeaponById(shownEnemyFloor.bossKit.weaponId) : null;
    const isTopBoss = BOSS_TOP_FLOORS.includes(floorNum) && shownEnemyFloor?.type === 'boss';
    const baseStats = isTopBoss ? { ...shownEnemyFloor.stats, hp: shownEnemyFloor.stats.hp + BOSS_TOP_FLOORS_EXTRA_HP } : shownEnemyFloor.stats;
    const maxHP = baseStats.hp;
    return {
      id: `enemy-${shownEnemyFloor.floorNumber}`,
      name: shownEnemyFloor.enemyName,
      race: awakeningRaces[0] || null,
      additionalAwakeningRaces: awakeningRaces.slice(1),
      class: shownEnemyFloor?.bossKit?.spellClass || null,
      level: shownEnemyFloor.floorNumber,
      base: baseStats,
      bonuses: { race: {}, class: {} },
      mageTowerPassive: shownEnemyFloor?.bossKit?.passiveId
        ? { id: shownEnemyFloor.bossKit.passiveId, level: shownEnemyFloor.bossKit.passiveLevel || 1 }
        : null,
      mageTowerExtensionPassive: shownEnemyFloor?.bossKit?.extensionPassiveId
        ? { id: shownEnemyFloor.bossKit.extensionPassiveId, level: shownEnemyFloor.bossKit.extensionPassiveLevel ?? 1 }
        : null,
      equippedWeaponData: weapon,
      forgeUpgrade: shownEnemyFloor?.bossKit?.forgeUpgrade || null,
      characterImage: resolveLabyrinthFloorImagePath(shownEnemyFloor),
      currentHP: replayP2HP || maxHP,
      maxHP: replayP2MaxHP || maxHP,
      awakeningForced: awakeningRaces.length > 0
    };
  }, [shownEnemyFloor, replayP2HP, replayP2MaxHP]);

  useEffect(() => {
    if (!logContainerRef.current) return;
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [replayLogs]);

  const startFightMusic = () => {
    const labyrinthMusic = document.getElementById('labyrinth-music');
    if (labyrinthMusic) {
      labyrinthMusic.play().catch(() => {});
    }
  };

  const stopFightMusic = () => {
    const labyrinthMusic = document.getElementById('labyrinth-music');
    if (labyrinthMusic) labyrinthMusic.pause();
  };

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
    setReplayP1Base(null);
    setReplayP2Base(null);
    setReplayP1Modifiers(null);
    setReplayP2Modifiers(null);
    setReplayP1Status(null);
    setReplayP2Status(null);

    const steps = data.steps || [];
    if (steps.length > 0) {
      for (const step of steps) {
        if (token.cancelled) return;

        for (const line of (step.logs || [])) {
          if (token.cancelled) return;
          setReplayLogs((prev) => [...prev, line]);
          await delayReplay(300);
        }

        setReplayP1HP(step.p1HP ?? 0);
        setReplayP2HP(step.p2HP ?? 0);
        setReplayP1Shield(step.p1Shield ?? 0);
        setReplayP2Shield(step.p2Shield ?? 0);
        setReplayP1Base(step.p1Base ?? null);
        setReplayP2Base(step.p2Base ?? null);
        setReplayP1Modifiers(step.p1Modifiers ?? null);
        setReplayP2Modifiers(step.p2Modifiers ?? null);
        setReplayP1Status(step.p1Status ?? null);
        setReplayP2Status(step.p2Status ?? null);

        if (step.phase === 'turnStart') await delayReplay(800);
        else if (step.phase === 'action') await delayReplay(2000);
        else if (step.phase === 'victory') await delayReplay(300);
        else await delayReplay(300);
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

    if (!result.didWin) {
      stopFightMusic();
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

      const [labyrinthResult, progressResult, playerResult, weaponResult] = await Promise.all([
        ensureWeeklyInfiniteLabyrinth(resolvedWeekId),
        getUserLabyrinthProgress(currentUser.uid, resolvedWeekId),
        getUserCharacter(currentUser.uid),
        getEquippedWeapon(currentUser.uid)
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

      if (playerResult.success && playerResult.data) {
        const character = normalizeCharacterBonuses({
          ...playerResult.data,
          id: currentUser.uid,
          userId: currentUser.uid,
          level: playerResult.data.level ?? 1,
          equippedWeaponData: weaponResult.success ? weaponResult.weapon : null,
          equippedWeaponId: weaponResult.success ? weaponResult.weapon?.id || null : (playerResult.data.equippedWeaponId || null)
        });
        setPlayerCharacter(character);
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
    stopFightMusic();
  }, []);

  const handleStartCurrentFloorFight = async () => {
    if (!currentUser?.uid || isAutoRunActive) return;

    setLoading(true);
    setError('');
    setIsAutoRunActive(true);

    const token = { cancelled: false };
    autoRunTokenRef.current = token;

    try {
      startFightMusic();
      while (!token.cancelled) {
        const result = await launchLabyrinthCombat({ userId: currentUser.uid, weekId });
        if (result.success && result.result?.steps) {
          checkAndAwardTitles(
            currentUser.uid,
            result.result.steps,
            result.result,
            playerCharacter,
            { mode: 'labyrinthe', floor: result.floor?.floorNumber ?? (result.progress?.currentFloor || 1) }
          );
        }
        if (!result.success) {
          setError(result.error || 'Combat impossible.');
          break;
        }

        setProgress(result.progress);
        setDisplayEnemyFloor(result.floor || null);
        await playReplay(result);
        setDisplayEnemyFloor(null);
        if (token.cancelled) break;

        if (!result.didWin) break;
        // Stop après avoir clear le dernier étage (120).
        if ((result.floor?.floorNumber || 1) >= LABYRINTH_FLOOR_COUNT) break;
      }
    } finally {
      autoRunTokenRef.current = null;
      setIsAutoRunActive(false);
      setLoading(false);
      stopFightMusic();
    }
  };

  return (
    <div className="min-h-screen p-6">
      <audio id="labyrinth-music" loop>
        <source src="/assets/music/Labyrinthe.mp3" type="audio/mpeg" />
        <source src="/assets/music/labyrinthe.mp3" type="audio/mpeg" />
      </audio>
      <Header />
      <div className="max-w-[1800px] mx-auto pt-16">
        <div className="flex justify-center mb-4">
          <div className="bg-stone-950/85 border border-stone-700/80 rounded-lg px-6 py-2 shadow">
            <h1 className="text-2xl font-bold text-stone-200">🌀 Labyrinthe Infini</h1>
          </div>
        </div>

        <div className="flex justify-center mb-4">
          <div className="bg-stone-950/85 border border-stone-700/80 rounded-lg px-5 py-1.5 shadow flex items-center gap-3 text-sm">
            <span className="text-stone-400">Semaine <span className="text-amber-400 font-semibold">{weekId}</span></span>
            <span className="text-stone-600">•</span>
            <span className="text-stone-400">Étage <span className="text-amber-400 font-semibold">{currentFloor}</span></span>
            <span className="text-stone-600">•</span>
            <span className="text-stone-400">Boss vaincus <span className="text-amber-400 font-semibold">{progress?.bossesDefeated || 0}</span></span>
            {isAutoRunActive && <><span className="text-stone-600">•</span><span className="text-green-400 font-semibold animate-pulse">Auto-run actif</span></>}
          </div>
        </div>

        {error && <p className="text-red-300 text-center mb-4">⚠️ {error}</p>}

        <div className="flex justify-center gap-3 md:gap-4 mb-4">
          <button
            onClick={handleStartCurrentFloorFight}
            disabled={loading}
            className="bg-stone-100 hover:bg-white disabled:bg-stone-600 disabled:text-stone-400 text-stone-900 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg border-2 border-stone-400"
          >
            ▶️ {loading ? 'Combats en cours...' : 'Lancer le combat'}
          </button>
          <button
            onClick={stopAutoRun}
            disabled={!isAutoRunActive}
            className="bg-red-700 hover:bg-red-600 disabled:bg-stone-600 disabled:text-stone-400 text-white px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg border border-red-500"
          >
            ⏹️ Stop
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
          <div className="order-1 md:order-1 w-full md:w-[340px] lg:w-auto md:flex-shrink-0">
            <CharacterCardContent
              character={playerCharacter}
              showHpBar
              currentHP={replayP1HP || (playerCharacter?.currentHP ?? playerCharacter?.base?.hp)}
              maxHP={replayP1MaxHP || (playerCharacter?.maxHP ?? playerCharacter?.base?.hp)}
              shield={replayP1Shield}
              combatBaseOverride={replayP1Base}
              combatModifiers={replayP1Modifiers}
              opponent={enemyCharacter}
              combatStatus={replayP1Status}
              detailsPlacement="left"
            />
          </div>

          <div className="order-2 md:order-2 w-full md:w-[600px] lg:w-[500px] lg:flex-1 lg:min-w-[400px] md:flex-shrink-0 lg:flex-shrink flex flex-col">
            {replayWinner && (
              <div className="flex justify-center mb-4">
                <div className="bg-stone-100 text-stone-900 px-8 py-3 font-bold text-xl animate-pulse shadow-2xl rounded-lg border-2 border-stone-400">
                  🏆 {replayWinner} remporte le combat! 🏆
                </div>
              </div>
            )}

            <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col h-[480px] md:h-[600px] overflow-hidden">
              <div className="bg-stone-900 p-3 border-b border-stone-700">
                <h2 className="text-lg md:text-2xl font-bold text-stone-200 text-center">⚔️ Combat en direct</h2>
              </div>
              <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
                {replayLogs.length === 0 ? (
                  <p className="text-stone-500 italic text-center py-6 md:py-8 text-xs md:text-sm">Cliquez sur "Lancer le combat" pour commencer...</p>
                ) : (
                  replayLogs.map((log, idx) => {
                    const isP1 = log.startsWith('[P1]');
                    const isP2 = log.startsWith('[P2]');
                    const cleanLog = log.replace(/^\[P[12]\]\s*/, '');

                    if (!isP1 && !isP2) {
                      if (log.includes('🏆')) {
                        return <div key={idx} className="flex justify-center my-4"><div className="bg-stone-100 text-stone-900 px-6 py-3 font-bold text-lg shadow-lg border border-stone-400">{cleanLog}</div></div>;
                      }
                      if (log.includes('💀')) {
                        return <div key={idx} className="flex justify-center my-4"><div className="bg-red-900 text-red-200 px-6 py-3 font-bold text-lg shadow-lg border border-red-600">{cleanLog}</div></div>;
                      }
                      if (log.includes('💚')) {
                        return <div key={idx} className="flex justify-center my-3"><div className="bg-green-900/50 text-green-300 px-4 py-2 text-sm font-bold border border-green-600">{cleanLog}</div></div>;
                      }
                      if (log.includes('---') || log.includes('⚔️')) {
                        return <div key={idx} className="flex justify-center my-3"><div className="bg-stone-700 text-stone-200 px-4 py-1 text-sm font-bold border border-stone-500">{cleanLog}</div></div>;
                      }
                      return <div key={idx} className="flex justify-center"><div className="text-stone-400 text-sm italic">{cleanLog}</div></div>;
                    }
                    if (isP1) {
                      return <div key={idx} className="flex justify-start"><div className="max-w-[80%]"><div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-l-4 border-blue-500"><div className="text-xs md:text-sm">{formatLogMessage(cleanLog)}</div></div></div></div>;
                    }
                    return <div key={idx} className="flex justify-end"><div className="max-w-[80%]"><div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-r-4 border-purple-500"><div className="text-xs md:text-sm">{formatLogMessage(cleanLog)}</div></div></div></div>;
                  })
                )}
              </div>
            </div>

            {isAnimatingFight && <p className="text-amber-300 text-sm mt-3 text-center">Combat en cours...</p>}
          </div>

          <div className="order-3 md:order-3 w-full md:w-[340px] lg:w-auto md:flex-shrink-0">
            <CharacterCardContent
              character={enemyCharacter}
              showHpBar
              currentHP={replayP2HP || (enemyCharacter?.currentHP ?? enemyCharacter?.base?.hp)}
              maxHP={replayP2MaxHP || (enemyCharacter?.maxHP ?? enemyCharacter?.base?.hp)}
              shield={replayP2Shield}
              nameOverride={null}
              combatBaseOverride={replayP2Base}
              combatModifiers={replayP2Modifiers}
              opponent={playerCharacter}
              combatStatus={replayP2Status}
              detailsPlacement="right"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfiniteLabyrinth;
