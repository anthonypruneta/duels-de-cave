import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../contexts/AuthContext';
import {
  ensureWeeklyInfiniteLabyrinth,
  getCurrentWeekId,
  getUserLabyrinthProgress,
  launchLabyrinthCombat,
  resolveLabyrinthFloorImagePath
} from '../services/infiniteLabyrinthService';
import { getUserCharacter } from '../services/characterService';
import { getEquippedWeapon } from '../services/dungeonService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { classConstants, getRaceBonus, getClassBonus } from '../data/combatMechanics';
import { getRaceBonusText } from '../utils/descriptionBuilders';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import { applyPassiveWeaponStats } from '../utils/weaponEffects';

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
  const entries = Object.entries(weapon.stats);
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
      {weapon.effet && <span className="block text-amber-200">Effet: {weapon.effet.nom} — {weapon.effet.description}</span>}
      {stats && <span className="block text-stone-200">Stats: {stats}</span>}
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

const getCalculatedDescription = (className, cap, auto) => {
  switch (className) {
    case 'Guerrier': {
      const { ignoreBase, ignorePerCap, autoBonus } = classConstants.guerrier;
      const ignoreBasePct = Math.round(ignoreBase * 100);
      const ignoreBonusPct = Math.round(ignorePerCap * cap * 100);
      const ignoreTotalPct = ignoreBasePct + ignoreBonusPct;
      return (
        <>
          +{autoBonus} Auto | Frappe résistance faible & ignore{' '}
          <Tooltip content={`Base: ${ignoreBasePct}% | Bonus (Cap ${cap}): +${ignoreBonusPct}%`}>
            <span className="text-green-400">{ignoreTotalPct}%</span>
          </Tooltip>
        </>
      );
    }
    case 'Voleur': {
      const { spdBonus, critPerCap } = classConstants.voleur;
      const critBonusPct = Math.round(critPerCap * cap * 100);
      return (
        <>
          +{spdBonus} VIT | Esquive 1 coup
          <Tooltip content={`Bonus (Cap ${cap}): +${critBonusPct}%`}>
            <span className="text-green-400"> | +{critBonusPct}% crit</span>
          </Tooltip>
        </>
      );
    }
    case 'Paladin': {
      const { reflectBase, reflectPerCap } = classConstants.paladin;
      const reflectBasePct = Math.round(reflectBase * 100);
      const reflectBonusPct = Math.round(reflectPerCap * cap * 100);
      const reflectTotalPct = reflectBasePct + reflectBonusPct;
      return (
        <>
          Renvoie{' '}
          <Tooltip content={`Base: ${reflectBasePct}% | Bonus (Cap ${cap}): +${reflectBonusPct}%`}>
            <span className="text-green-400">{reflectTotalPct}%</span>
          </Tooltip>
          {' '}des dégâts reçus
        </>
      );
    }
    case 'Healer': {
      const { missingHpPercent, capScale } = classConstants.healer;
      const missingPct = Math.round(missingHpPercent * 100);
      const healValue = Math.round(capScale * cap);
      return (
        <>
          Heal {missingPct}% PV manquants +{' '}
          <Tooltip content={`0.35 × Cap (${cap}) = ${healValue}`}>
            <span className="text-green-400">{healValue}</span>
          </Tooltip>
        </>
      );
    }
    case 'Archer': {
      const { hit2AutoMultiplier, hit2CapMultiplier } = classConstants.archer;
      const hit2Auto = Math.round(hit2AutoMultiplier * auto);
      const hit2Cap = Math.round(hit2CapMultiplier * cap);
      return (
        <>
          2 attaques: 1 tir normal +{' '}
          <Tooltip content={`Hit2 = 1.30×Auto (${auto}) + 0.25×Cap (${cap}) vs ResC`}>
            <span className="text-green-400">{hit2Auto}+{hit2Cap}</span>
          </Tooltip>
        </>
      );
    }
    case 'Mage': {
      const { capBase, capPerCap } = classConstants.mage;
      const magicPct = capBase + capPerCap * cap;
      const magicDmg = Math.round(magicPct * cap);
      return (
        <>
          Dégâts = Auto +{' '}
          <Tooltip content={`Auto (${auto}) + ${(magicPct * 100).toFixed(1)}% × Cap (${cap})`}>
            <span className="text-green-400">{auto + magicDmg}</span>
          </Tooltip>
          {' '}(vs ResC)
        </>
      );
    }
    case 'Demoniste': {
      const { capBase, capPerCap, ignoreResist, stackPerAuto } = classConstants.demoniste;
      const familierPct = capBase + capPerCap * cap;
      const familierDmgTotal = Math.round(familierPct * cap);
      const ignoreResistPct = Math.round(ignoreResist * 100);
      const stackBonusPct = Math.round(stackPerAuto * 100);
      return (
        <>
          Familier:{' '}
          <Tooltip content={`${(familierPct * 100).toFixed(1)}% de la Cap (${cap}) | +${stackBonusPct}% Cap par auto (cumulable)`}>
            <span className="text-green-400">{familierDmgTotal}</span>
          </Tooltip>
          {' '}dégâts / tour (ignore {ignoreResistPct}% ResC)
        </>
      );
    }
    case 'Masochiste': {
      const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
      const returnBasePct = Math.round(returnBase * 100);
      const returnBonusPct = Math.round(returnPerCap * cap * 100);
      const returnTotalPct = returnBasePct + returnBonusPct;
      const healPct = Math.round(healPercent * 100);
      return (
        <>
          Renvoie{' '}
          <Tooltip content={`Base: ${returnBasePct}% | Bonus (Cap ${cap}): +${returnBonusPct}%`}>
            <span className="text-green-400">{returnTotalPct}%</span>
          </Tooltip>
          {' '}des dégâts accumulés & heal {healPct}%
        </>
      );
    }
    default:
      return classes[className]?.description || '';
  }
};

const CharacterCard = ({ character, currentHPOverride, maxHPOverride, shieldOverride = 0, showRaceDetails = true, showClassDetails = true, headerLabel = null }) => {
  if (!character) return null;

  const raceB = getRaceBonus(character.race);
  const classB = getClassBonus(character.class);
  const forestBoosts = getForestBoosts(character);
  const weapon = character.equippedWeaponData;
  const passiveDetails = getPassiveDetails(character.mageTowerPassive);
  const awakeningRaces = [character.race, ...(character.additionalAwakeningRaces || [])].filter(Boolean);
  const effectiveLevel = character.awakeningForced ? 999 : (character.level ?? 1);
  const activeAwakenings = awakeningRaces
    .map((raceName) => ({ raceName, info: races[raceName]?.awakening }))
    .filter(({ info }) => info && effectiveLevel >= info.levelRequired);
  const raceAwakeningInfo = races[character.race]?.awakening || null;
  const hasAwakeningState = Boolean(character.awakening)
    || (Array.isArray(character.additionalAwakeningRaces) && character.additionalAwakeningRaces.length > 0)
    || Boolean(raceAwakeningInfo && effectiveLevel >= raceAwakeningInfo.levelRequired);
  const displayedAwakenings = activeAwakenings.length > 0
    ? activeAwakenings
    : (hasAwakeningState && raceAwakeningInfo ? [{ raceName: character.race, info: raceAwakeningInfo }] : []);

  const computedBase = getBaseWithBoosts(character);
  const baseStats = character.baseWithoutWeapon || computedBase;
  const baseWithPassive = weapon ? applyPassiveWeaponStats(baseStats, weapon.id, character.class, character.race, character.mageTowerPassive) : baseStats;

  const currentHP = currentHPOverride ?? character.currentHP ?? baseStats.hp;
  const maxHP = maxHPOverride ?? character.maxHP ?? baseStats.hp;
  const hpPercent = maxHP > 0 ? (currentHP / maxHP) * 100 : 0;
  const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
  const shieldPercent = maxHP > 0 ? Math.min(100, (shieldOverride / maxHP) * 100) : 0;

  const totalBonus = (k) => (raceB[k] || 0) + (classB[k] || 0);
  const flatBaseStats = character.baseWithBoosts || computedBase;
  const baseWithoutBonus = (k) => (flatBaseStats[k] || 0) - totalBonus(k) - (forestBoosts[k] || 0);
  const isAwakeningActive = raceAwakeningInfo && effectiveLevel >= raceAwakeningInfo.levelRequired;
  const getRaceDisplayBonus = (k) => {
    if (!isAwakeningActive) return raceB[k] || 0;
    const classBonus = classB[k] || 0;
    const forestBonus = forestBoosts[k] || 0;
    const weaponBonus = weapon?.stats?.[k] ?? 0;
    const passiveBonus = k === 'auto'
      ? (baseWithPassive.auto ?? baseStats.auto) - (baseStats.auto + (weapon?.stats?.auto ?? 0))
      : 0;
    const displayValue = (baseStats[k] || 0) + weaponBonus + passiveBonus;
    return displayValue - (baseWithoutBonus(k) + classBonus + forestBonus + weaponBonus + passiveBonus);
  };
  const tooltipContent = (k) => {
    const parts = [`Base: ${baseWithoutBonus(k)}`];
    if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
    if (forestBoosts[k] > 0) parts.push(`Forêt: +${forestBoosts[k]}`);
    const weaponDelta = weapon?.stats?.[k] ?? 0;
    if (weaponDelta !== 0) parts.push(`Arme: ${weaponDelta > 0 ? `+${weaponDelta}` : weaponDelta}`);
    if (k === 'auto') {
      const passiveAutoBonus = (baseWithPassive.auto ?? baseStats.auto) - (baseStats.auto + (weapon?.stats?.auto ?? 0));
      if (passiveAutoBonus !== 0) parts.push(`Passif: ${passiveAutoBonus > 0 ? `+${passiveAutoBonus}` : passiveAutoBonus}`);
    }
    const raceDisplayBonus = getRaceDisplayBonus(k);
    if (raceDisplayBonus !== 0) parts.push(`Race: ${raceDisplayBonus > 0 ? `+${raceDisplayBonus}` : raceDisplayBonus}`);
    return parts.join(' | ');
  };

  const StatWithTooltip = ({ statKey, label }) => {
    const weaponDelta = weapon?.stats?.[statKey] ?? 0;
    const passiveAutoBonus = statKey === 'auto'
      ? (baseWithPassive.auto ?? baseStats.auto) - (baseStats.auto + (weapon?.stats?.auto ?? 0))
      : 0;
    const displayValue = (baseStats[statKey] || 0) + weaponDelta + passiveAutoBonus;
    const raceDisplayBonus = getRaceDisplayBonus(statKey);
    const totalDelta = raceDisplayBonus + (classB[statKey] || 0) + (forestBoosts[statKey] || 0) + weaponDelta + passiveAutoBonus;
    const labelClass = totalDelta > 0 ? 'text-green-400' : totalDelta < 0 ? 'text-red-400' : 'text-yellow-300';
    return (
      <Tooltip content={tooltipContent(statKey)}>
        <span className={`${labelClass} font-bold`}>{label}: {displayValue}</span>
      </Tooltip>
    );
  };

  const characterImage = character.characterImage || character.imagePath || null;

  return (
    <div className="w-full max-w-[340px] mx-auto">
      <div className="relative shadow-2xl">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-amber-200 px-5 py-1 text-xs font-bold shadow-lg z-10 border border-stone-600 text-center whitespace-nowrap">
          {headerLabel || ((showRaceDetails || showClassDetails) ? `${character.race || '—'} • ${character.class || '—'}` : 'Créature du labyrinthe')} • Niveau {character.level ?? 1}
        </div>

        <div className="overflow-visible border border-stone-600 bg-stone-900">
          <div className="relative bg-stone-900 flex items-center justify-center">
            {characterImage ? (
              <img src={characterImage} alt={character.name} className="w-full h-auto object-contain" />
            ) : (
              <div className="w-full h-[420px] flex items-center justify-center text-stone-500">Image manquante</div>
            )}
            <div className="absolute bottom-3 left-3 right-3 bg-black/80 p-3">
              <div className="text-white font-bold text-3xl leading-tight text-center">{character.name}</div>
            </div>
          </div>

          <div className="bg-stone-800 p-3 border-t border-stone-600">
            <div className="flex justify-between text-xs text-white mb-2 font-bold">
              <StatWithTooltip statKey="hp" label="HP" />
              <StatWithTooltip statKey="spd" label="VIT" />
            </div>
            <div className="text-xs text-stone-400 mb-2">{character.name} — PV {Math.max(0, currentHP)}/{maxHP}</div>
            <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600 mb-3">
              <div className={`h-full transition-all duration-500 ${hpClass}`} style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }} />
            </div>
            {shieldOverride > 0 && (
              <div className="mt-1 mb-3 bg-stone-900 h-2 overflow-hidden border border-blue-700">
                <div className="h-full transition-all duration-500 bg-blue-500" style={{ width: `${shieldPercent}%` }} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-1 mb-3 text-xs text-gray-300">
              <StatWithTooltip statKey="auto" label="Auto" />
              <StatWithTooltip statKey="def" label="Déf" />
              <StatWithTooltip statKey="cap" label="Cap" />
              <StatWithTooltip statKey="rescap" label="ResC" />
            </div>

            <div className="space-y-2">
              {weapon && (
                <div className="mt-2 space-y-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
                  <Tooltip content={getWeaponTooltipContent(weapon)}>
                    <span className="flex items-center gap-2">
                      {getWeaponImage(weapon.imageFile) ? <img src={getWeaponImage(weapon.imageFile)} alt={weapon.nom} className="w-8 h-auto" /> : <span className="text-xl">{weapon.icon}</span>}
                      <span className={`font-semibold ${RARITY_COLORS[weapon.rarete]}`}>{weapon.nom}</span>
                    </span>
                  </Tooltip>
                </div>
              )}

              {passiveDetails && (
                <div className="mt-2 flex items-start gap-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
                  <span className="text-lg">{passiveDetails.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-amber-200">{passiveDetails.name} — Niveau {passiveDetails.level}</div>
                    <div className="text-stone-400 text-[11px]">{passiveDetails.levelData.description}</div>
                  </div>
                </div>
              )}

              {showRaceDetails && displayedAwakenings.map(({ raceName, info }) => (
                <div key={`awakening-${raceName}`} className="mt-2 flex items-start gap-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
                  <span className="text-lg">✨</span>
                  <div className="flex-1">
                    <div className="font-semibold text-amber-200">Éveil racial actif ({raceName}) (Niv {info.levelRequired}+)</div>
                    <div className="text-stone-400 text-[11px]">{info.description}</div>
                  </div>
                </div>
              ))}

              {showRaceDetails && !hasAwakeningState && races[character.race] && (
                <div className="mt-2 flex items-start gap-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
                  <span className="text-lg">{races[character.race].icon}</span>
                  <span className="text-stone-300">{getRaceBonusText(character.race)}</span>
                </div>
              )}

              {showClassDetails && classes[character.class] && (
                <div className="mt-2 flex items-start gap-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
                  <span className="text-lg">{classes[character.class].icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-amber-200">{classes[character.class].ability}</div>
                    <div className="text-stone-400 text-[11px]">{getCalculatedDescription(character.class, baseStats.cap + (weapon?.stats?.cap ?? 0), baseStats.auto + (weapon?.stats?.auto ?? 0))}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  const replayTimeoutRef = useRef(null);
  const replayTokenRef = useRef(null);
  const autoRunTokenRef = useRef(null);
  const logContainerRef = useRef(null);
  const [isSoundOpen, setIsSoundOpen] = useState(false);
  const [volume, setVolume] = useState(0.05);
  const [isMuted, setIsMuted] = useState(false);

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
    const weapon = shownEnemyFloor?.bossKit?.weaponId ? getWeaponById(shownEnemyFloor.bossKit.weaponId) : null;
    return {
      id: `enemy-${shownEnemyFloor.floorNumber}`,
      name: shownEnemyFloor.enemyName,
      race: shownEnemyFloor?.bossKit?.awakeningRaces?.[0] || null,
      additionalAwakeningRaces: shownEnemyFloor?.bossKit?.awakeningRaces?.slice(1) || [],
      class: shownEnemyFloor?.bossKit?.spellClass || null,
      level: shownEnemyFloor.floorNumber,
      base: shownEnemyFloor.stats,
      bonuses: { race: {}, class: {} },
      mageTowerPassive: shownEnemyFloor?.bossKit?.passiveId
        ? { id: shownEnemyFloor.bossKit.passiveId, level: shownEnemyFloor.bossKit.passiveLevel || 1 }
        : null,
      equippedWeaponData: weapon,
      characterImage: resolveLabyrinthFloorImagePath(shownEnemyFloor),
      currentHP: replayP2HP || shownEnemyFloor.stats.hp,
      maxHP: replayP2MaxHP || shownEnemyFloor.stats.hp,
      awakeningForced: (shownEnemyFloor?.bossKit?.awakeningRaces || []).length > 0
    };
  }, [shownEnemyFloor, replayP2HP, replayP2MaxHP]);

  useEffect(() => {
    if (!logContainerRef.current) return;
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [replayLogs]);

  const applyCombatVolume = () => {
    const labyrinthMusic = document.getElementById('labyrinth-music');
    [labyrinthMusic].forEach((audio) => {
      if (audio) {
        audio.volume = volume;
        audio.muted = isMuted;
      }
    });
  };

  useEffect(() => {
    applyCombatVolume();
  }, [volume, isMuted]);

  const handleVolumeChange = (event) => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    if (isMuted && volume === 0) setVolume(0.05);
  };

  const SoundControl = () => (
    <div className="fixed top-20 right-4 z-50 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setIsSoundOpen((prev) => !prev)}
        className="bg-amber-600 text-white border border-amber-400 px-3 py-2 text-sm font-bold shadow-lg hover:bg-amber-500"
      >
        {isMuted || volume === 0 ? '🔇' : '🔊'} Son
      </button>
      {isSoundOpen && (
        <div className="bg-stone-900 border border-stone-600 p-3 w-56 shadow-xl">
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleMute} className="text-lg" aria-label={isMuted ? 'Réactiver le son' : 'Couper le son'}>
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="w-full accent-amber-500" />
            <span className="text-xs text-stone-200 w-10 text-right">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );

  const startFightMusic = () => {
    const labyrinthMusic = document.getElementById('labyrinth-music');
    if (labyrinthMusic) {
      labyrinthMusic.volume = volume;
      labyrinthMusic.muted = isMuted;
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
        if ((result.progress?.currentFloor || 1) > 100) break;
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
      <SoundControl />
      <div className="max-w-[1800px] mx-auto pt-16">
        <div className="flex justify-center mb-8">
          <div className="bg-stone-800 border border-stone-600 px-8 py-3">
            <h1 className="text-3xl font-bold text-stone-200">⚔️ Combat ⚔️</h1>
          </div>
        </div>

        {error && <p className="text-red-300 text-center mb-4">⚠️ {error}</p>}

        <div className="flex justify-center gap-3 md:gap-4 mb-4">
          <button
            onClick={handleStartCurrentFloorFight}
            disabled={loading}
            className="bg-stone-100 hover:bg-white disabled:bg-stone-600 disabled:text-stone-400 text-stone-900 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border-2 border-stone-400"
          >
            ▶️ {loading ? 'Combats en cours...' : 'Lancer le combat'}
          </button>
          <button
            onClick={stopAutoRun}
            disabled={!isAutoRunActive}
            className="bg-red-700 hover:bg-red-600 disabled:bg-stone-600 disabled:text-stone-400 text-white px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border border-red-500"
          >
            ⏹️ Stop
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border border-stone-500"
          >
            ← Changer
          </button>
        </div>

        <div className="text-center mb-4 text-stone-300 text-sm">
          Week {weekId} • Étage {currentFloor} • Boss vaincus {progress?.bossesDefeated || 0}
          {isAutoRunActive && ' • Auto-run actif'}
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
          <div className="order-1 md:order-1 w-full md:w-[340px] md:flex-shrink-0">
            <CharacterCard character={playerCharacter} currentHPOverride={replayP1HP || playerCharacter?.base?.hp} maxHPOverride={replayP1MaxHP || playerCharacter?.base?.hp} shieldOverride={replayP1Shield} />
          </div>

          <div className="order-2 md:order-2 w-full md:w-[600px] md:flex-shrink-0 flex flex-col">
            {replayWinner && (
              <div className="flex justify-center mb-4">
                <div className="bg-stone-100 text-stone-900 px-8 py-3 font-bold text-xl animate-pulse shadow-2xl border-2 border-stone-400">
                  🏆 {replayWinner} remporte le combat! 🏆
                </div>
              </div>
            )}

            <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[480px] md:h-[600px]">
              <div className="bg-stone-900 p-3 border-b border-stone-600">
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

          <div className="order-3 md:order-3 w-full md:w-[340px] md:flex-shrink-0">
            <CharacterCard
              character={enemyCharacter}
              currentHPOverride={replayP2HP || enemyCharacter?.base?.hp}
              maxHPOverride={replayP2MaxHP || enemyCharacter?.base?.hp}
              shieldOverride={replayP2Shield}
              headerLabel={shownEnemyFloor?.type === 'boss' ? 'Boss du labyrinthe' : 'Créature du labyrinthe'}
              showRaceDetails={shownEnemyFloor?.type === 'boss'}
              showClassDetails={Boolean(shownEnemyFloor?.bossKit?.spellClass)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfiniteLabyrinth;
