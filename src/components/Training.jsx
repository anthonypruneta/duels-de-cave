import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter, updateCharacterLevel } from '../services/characterService';
import { getPlayerDungeonSummary } from '../services/dungeonService';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import {
  applyPassiveWeaponStats,
  initWeaponCombatState,
} from '../utils/weaponEffects';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { getRaceBonusText } from '../utils/descriptionBuilders';
import {
  classConstants,
  raceConstants,
  getRaceBonus,
  getClassBonus
} from '../data/combatMechanics';
import {
  RARITY_COLORS,
} from '../data/weapons';
import { applyAwakeningToBase, buildAwakeningState, getAwakeningEffect } from '../utils/awakening';
import Header from './Header';
import { simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';

import mannequinImg from '../assets/training/mannequin.png';

// Chargement dynamique des images d'armes
const weaponImageModules = import.meta.glob('../assets/weapons/*.png', { eager: true, import: 'default' });

const getWeaponImage = (imageFile) => {
  if (!imageFile) return null;
  return weaponImageModules[`../assets/weapons/${imageFile}`] || null;
};

const getForestBoosts = (character) => ({ ...getEmptyStatBoosts(), ...(character?.forestBoosts || {}) });
const getBaseWithBoosts = (character) => applyStatBoosts(character.base, getForestBoosts(character));

// Tooltip
const Tooltip = ({ children, content }) => (
  <span className="relative group cursor-help">
    {children}
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-stone-900 border border-amber-500 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
      {content}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-500"></span>
    </span>
  </span>
);

const STAT_LABELS = {
  hp: 'HP', auto: 'Auto', def: 'Déf', cap: 'Cap', rescap: 'ResC', spd: 'VIT'
};

const formatWeaponStats = (weapon) => {
  if (!weapon?.stats) return null;
  const entries = Object.entries(weapon.stats);
  if (entries.length === 0) return null;
  return entries.map(([stat, value]) => {
    const color = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-yellow-300';
    return <span key={stat} className={`font-semibold ${color}`}>{STAT_LABELS[stat] || stat} {value > 0 ? `+${value}` : value}</span>;
  }).reduce((acc, node, index) => {
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
      {weapon.effet && (
        <span className="block text-amber-200">Effet: {weapon.effet.nom} — {weapon.effet.description}</span>
      )}
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

// PV du mannequin — assez haut pour survivre 30 tours (max tours)
const DUMMY_HP = 999999;

// Créer le mannequin d'entraînement
const createTrainingDummy = () => ({
  name: 'Mannequin',
  race: 'Humain',
  class: 'Guerrier',
  level: 1,
  userId: 'training-dummy',
  characterImage: null,
  equippedWeaponId: null,
  equippedWeaponData: null,
  mageTowerPassive: null,
  forestBoosts: {},
  base: {
    hp: DUMMY_HP,
    auto: 0,
    def: 20,
    cap: 0,
    rescap: 20,
    spd: 0
  },
  bonuses: {
    race: { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 },
    class: { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 }
  }
});

// Extraire les stats DPS depuis les steps du combat
const computeDpsStats = (steps, dummyMaxHP) => {
  const turnDamages = [];
  let prevHP = dummyMaxHP;

  for (const step of steps) {
    if (step.phase === 'turn_start') {
      // Début d'un nouveau tour : enregistrer les HP du mannequin
      prevHP = step.p2HP;
    }
    if (step.phase === 'action') {
      // Calculer les dégâts infligés au mannequin (p2) durant cette action
      const dmg = prevHP - step.p2HP;
      if (step.player === 1 && dmg > 0) {
        // Action du joueur (P1) qui touche le mannequin (P2)
        if (turnDamages.length === 0) turnDamages.push(0);
        turnDamages[turnDamages.length - 1] += dmg;
      }
      prevHP = step.p2HP;
    }
    if (step.phase === 'turn_start' && turnDamages.length > 0) {
      // Préparer le slot pour le prochain tour
    }
  }

  // Recalculer proprement tour par tour
  const perTurn = [];
  let currentTurnDmg = 0;
  let lastP2HP = dummyMaxHP;

  for (const step of steps) {
    if (step.phase === 'turn_start') {
      if (perTurn.length > 0 || currentTurnDmg > 0) {
        perTurn.push(currentTurnDmg);
      }
      currentTurnDmg = 0;
      lastP2HP = step.p2HP;
    }
    if (step.phase === 'action' || step.phase === 'victory') {
      const dmgThisStep = lastP2HP - step.p2HP;
      if (dmgThisStep > 0) currentTurnDmg += dmgThisStep;
      lastP2HP = step.p2HP;
    }
  }
  // Dernier tour
  if (currentTurnDmg > 0) perTurn.push(currentTurnDmg);

  const totalDamage = perTurn.reduce((a, b) => a + b, 0);
  const nbTurns = perTurn.length || 1;
  const avgDps = Math.round(totalDamage / nbTurns);
  const maxTurnDmg = perTurn.length > 0 ? Math.max(...perTurn) : 0;

  return { perTurn, totalDamage, nbTurns, avgDps, maxTurnDmg };
};

const Training = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [error, setError] = useState(null);

  const [gameState, setGameState] = useState('lobby'); // lobby, fighting
  const [player, setPlayer] = useState(null);
  const [dummy, setDummy] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [dpsStats, setDpsStats] = useState(null);
  const logEndRef = useRef(null);

  // Charger le personnage
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        const charResult = await getUserCharacter(currentUser.uid);
        if (!charResult.success || !charResult.data) {
          navigate('/');
          return;
        }
        const level = charResult.data.level ?? 1;
        if (charResult.data.level == null) {
          updateCharacterLevel(currentUser.uid, level);
        }
        let charData = { ...charResult.data, level };

        const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
        if (summaryResult.success) {
          charData = {
            ...charData,
            equippedWeaponData: summaryResult.data.equippedWeaponData,
            equippedWeaponId: summaryResult.data.equippedWeaponData?.id || null
          };
        }
        setCharacter(charData);
      } catch (err) {
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentUser, navigate]);

  // Scroll auto du log (desktop uniquement)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (!window.matchMedia('(min-width: 768px)').matches) return;
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

  // Préparer le joueur pour le combat (même pattern que Dungeon.jsx)
  const prepareForCombat = (char) => {
    const weaponId = char?.equippedWeaponId || char?.equippedWeaponData?.id || null;
    const baseWithBoosts = applyStatBoosts(char.base, char.forestBoosts);
    const baseWithWeapon = applyPassiveWeaponStats(baseWithBoosts, weaponId, char.class);
    const awakeningEffect = getAwakeningEffect(char.race, char.level ?? 1);
    const baseWithAwakening = applyAwakeningToBase(baseWithWeapon, awakeningEffect);
    const baseWithoutWeapon = applyAwakeningToBase(baseWithBoosts, awakeningEffect);
    const weaponState = initWeaponCombatState(char, weaponId);
    return {
      ...char,
      base: baseWithAwakening,
      baseWithoutWeapon,
      currentHP: baseWithAwakening.hp,
      maxHP: baseWithAwakening.hp,
      cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0, succ: 0, bast: 0 },
      undead: false,
      dodge: false,
      reflect: false,
      bleed_stacks: 0,
      bleedPercentPerStack: 0,
      maso_taken: 0,
      familiarStacks: 0,
      shield: 0,
      sireneStacks: 0,
      succubeWeakenNextAttack: false,
      spectralMarked: false,
      spectralMarkBonus: 0,
      firstSpellCapBoostUsed: false,
      stunned: false,
      stunnedTurns: 0,
      weaponState,
      awakening: buildAwakeningState(awakeningEffect)
    };
  };

  // Démarrer l'entraînement
  const handleStart = () => {
    setGameState('fighting');
    setCombatResult(null);
    setDpsStats(null);

    const playerReady = prepareForCombat(character);
    const dummyReady = createTrainingDummy();

    setPlayer(playerReady);
    setDummy(dummyReady);
    setCombatLog([`🎯 ${playerReady.name} commence l'entraînement sur le mannequin !`]);
  };

  // Lancer la simulation
  const simulateCombat = async () => {
    if (!player || !dummy || isSimulating) return;
    setIsSimulating(true);
    setCombatResult(null);
    setDpsStats(null);

    const p = { ...player };
    const d = { ...dummy };
    const logs = [...combatLog, `--- Combat d'entraînement ---`];

    const matchResult = simulerMatch(p, d);

    // Calculer le DPS
    const stats = computeDpsStats(matchResult.steps, DUMMY_HP);
    setDpsStats(stats);

    // Replay animé
    const finalLogs = await replayCombatSteps(matchResult.steps, {
      setCombatLog,
      onStepHP: (step) => {
        p.currentHP = step.p1HP;
        d.currentHP = step.p2HP;
        setPlayer({ ...p });
        setDummy({ ...d });
      },
      existingLogs: logs,
      speed: 'fast'
    });

    logs.length = 0;
    logs.push(...finalLogs);
    logs.push(``, `📊 Entraînement terminé — ${stats.nbTurns} tours`);
    setCombatLog([...logs]);
    setCombatResult('done');
    setIsSimulating(false);
  };

  // Retour
  const handleBack = () => {
    setGameState('lobby');
    setPlayer(null);
    setDummy(null);
    setCombatLog([]);
    setCombatResult(null);
    setDpsStats(null);
  };

  // Format log messages avec couleurs
  const formatLogMessage = (text) => {
    if (!player || !dummy) return text;
    const pName = player.name;
    const dName = dummy.name;
    const parts = [];
    let key = 0;

    const nameRegex = new RegExp(`(${pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${dName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
    const nameParts = text.split(nameRegex);

    nameParts.forEach((part) => {
      if (part === pName) {
        parts.push(<span key={`name-${key++}`} className="font-bold text-blue-400">{part}</span>);
      } else if (part === dName) {
        parts.push(<span key={`name-${key++}`} className="font-bold text-orange-400">{part}</span>);
      } else if (part) {
        const numRegex = /(\d+)\s*(points?\s*de\s*(?:vie|dégâts?|dommages?))/gi;
        let lastIndex = 0;
        let match;
        const subParts = [];
        while ((match = numRegex.exec(part)) !== null) {
          if (match.index > lastIndex) subParts.push(part.slice(lastIndex, match.index));
          const isHeal = match[2].toLowerCase().includes('vie');
          subParts.push(<span key={`num-${key++}`} className={`font-bold ${isHeal ? 'text-green-400' : 'text-red-400'}`}>{match[1]}</span>);
          subParts.push(` ${match[2]}`);
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < part.length) subParts.push(part.slice(lastIndex));
        if (subParts.length > 0) parts.push(...subParts);
      }
    });

    return parts.length > 0 ? parts : text;
  };

  // Descriptions calculées des classes
  const getCalculatedDescription = (className, cap, auto) => {
    switch(className) {
      case 'Guerrier': {
        const { ignoreBase, ignorePerCap, autoBonus } = classConstants.guerrier;
        const ignoreTotalPct = Math.round(ignoreBase * 100) + Math.round(ignorePerCap * cap * 100);
        return `+${autoBonus} Auto | Ignore ${ignoreTotalPct}% déf`;
      }
      case 'Voleur': {
        const { spdBonus, critPerCap } = classConstants.voleur;
        return `+${spdBonus} VIT | Esquive 1 coup | +${Math.round(critPerCap * cap * 100)}% crit`;
      }
      case 'Paladin': {
        const { reflectBase, reflectPerCap } = classConstants.paladin;
        return `Riposte ${Math.round((reflectBase + reflectPerCap * cap) * 100)}%`;
      }
      case 'Healer': {
        const { healBase, healPerCap } = classConstants.healer;
        return `Soin ${Math.round(healBase + healPerCap * cap)} PV`;
      }
      case 'Archer': {
        const { hitCount } = classConstants.archer;
        return `${hitCount} attaques`;
      }
      case 'Mage': {
        const { capBase, capPerCap } = classConstants.mage;
        return `Sort: ${Math.round((capBase + capPerCap * cap) * cap)} dégâts`;
      }
      default: return classes[className]?.description || '';
    }
  };

  // ============================================================================
  // CARTE JOUEUR
  // ============================================================================
  const PlayerCard = ({ char }) => {
    if (!char) return null;
    const hpPercent = (char.currentHP / char.maxHP) * 100;
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const shieldPercent = char.maxHP > 0 ? Math.min(100, ((char.shield || 0) / char.maxHP) * 100) : 0;
    const raceB = getRaceBonus(char.race);
    const classB = getClassBonus(char.class);
    const forestBoosts = getForestBoosts(char);
    const weapon = char.equippedWeaponData;
    const passiveDetails = getPassiveDetails(char.mageTowerPassive);
    const awakeningInfo = races[char.race]?.awakening || null;
    const isAwakeningActive = awakeningInfo && (char.level ?? 1) >= awakeningInfo.levelRequired;
    const baseStats = char.baseWithoutWeapon || getBaseWithBoosts(char);
    const baseWithPassive = weapon ? applyPassiveWeaponStats(baseStats, weapon.id, char.class) : baseStats;
    const totalBonus = (k) => (raceB[k] || 0) + (classB[k] || 0);
    const tooltipContent = (k) => {
      const parts = [`Base: ${baseStats[k] - totalBonus(k) - (forestBoosts[k] || 0)}`];
      if (raceB[k] > 0) parts.push(`Race: +${raceB[k]}`);
      if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
      if (forestBoosts[k] > 0) parts.push(`Forêt: +${forestBoosts[k]}`);
      const weaponDelta = weapon?.stats?.[k] ?? 0;
      if (weaponDelta !== 0) parts.push(`Arme: ${weaponDelta > 0 ? `+${weaponDelta}` : weaponDelta}`);
      if (k === 'auto') {
        const passiveAutoBonus = (baseWithPassive.auto ?? baseStats.auto) - (baseStats.auto + (weapon?.stats?.auto ?? 0));
        if (passiveAutoBonus !== 0) parts.push(`Passif: ${passiveAutoBonus > 0 ? `+${passiveAutoBonus}` : passiveAutoBonus}`);
      }
      return parts.join(' | ');
    };

    const StatWithTooltip = ({ statKey, label }) => {
      const weaponDelta = weapon?.stats?.[statKey] ?? 0;
      const passiveAutoBonus = statKey === 'auto'
        ? (baseWithPassive.auto ?? baseStats.auto) - (baseStats.auto + (weapon?.stats?.auto ?? 0))
        : 0;
      const displayValue = baseStats[statKey] + weaponDelta + passiveAutoBonus;
      const totalDelta = totalBonus(statKey) + forestBoosts[statKey] + weaponDelta + passiveAutoBonus;
      const hasBonus = totalDelta !== 0;
      const labelClass = totalDelta > 0 ? 'text-green-400' : totalDelta < 0 ? 'text-red-400' : 'text-yellow-300';
      return hasBonus ? (
        <Tooltip content={tooltipContent(statKey)}>
          <span className={labelClass}>{label}: {displayValue}</span>
        </Tooltip>
      ) : (
        <span>{label}: {displayValue}</span>
      );
    };

    const characterImage = char.characterImage || null;

    return (
      <div className="relative shadow-2xl overflow-visible">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-stone-200 px-5 py-1.5 text-sm font-bold shadow-lg border border-stone-500 z-10">
          {char.race} • {char.class} • Niveau {char.level ?? 1}
        </div>
        <div className="overflow-visible">
          <div className="h-auto relative bg-stone-900 flex items-center justify-center">
            {characterImage ? (
              <img src={characterImage} alt={char.name} className="w-full h-auto object-contain" />
            ) : (
              <div className="w-full h-48 flex items-center justify-center">
                <span className="text-7xl">{races[char.race]?.icon || '❓'}</span>
              </div>
            )}
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-3">
              <div className="text-white font-bold text-xl text-center">{char.name}</div>
            </div>
          </div>
          <div className="bg-stone-800 p-4 border-t border-stone-600">
            <div className="mb-3">
              <div className="flex justify-between text-sm text-white mb-2">
                <StatWithTooltip statKey="hp" label="HP" />
                <StatWithTooltip statKey="spd" label="VIT" />
              </div>
              <div className="text-xs text-stone-400 mb-2">{char.name} — PV {Math.max(0, char.currentHP)}/{char.maxHP}</div>
              <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600">
                <div className={`h-full transition-all duration-500 ${hpClass}`} style={{width: `${hpPercent}%`}} />
              </div>
              {(char.shield || 0) > 0 && (
                <div className="mt-1 bg-stone-900 h-2 overflow-hidden border border-blue-700">
                  <div className="h-full transition-all duration-500 bg-blue-500" style={{width: `${shieldPercent}%`}} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-stone-400"><StatWithTooltip statKey="auto" label="Auto" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="def" label="Déf" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="cap" label="Cap" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="rescap" label="ResC" /></div>
            </div>
            <div className="space-y-2">
              {weapon && (
                <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                  <Tooltip content={getWeaponTooltipContent(weapon)}>
                    <span className="flex items-center gap-2">
                      {getWeaponImage(weapon.imageFile) ? (
                        <img src={getWeaponImage(weapon.imageFile)} alt={weapon.nom} className="w-8 h-auto" />
                      ) : (
                        <span className="text-xl">{weapon.icon}</span>
                      )}
                      <span className={`font-semibold ${RARITY_COLORS[weapon.rarete]}`}>{weapon.nom}</span>
                    </span>
                  </Tooltip>
                </div>
              )}
              {passiveDetails && (
                <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                  <span className="text-lg">{passiveDetails.icon}</span>
                  <div className="flex-1">
                    <div className="text-amber-300 font-semibold mb-1">{passiveDetails.name} — Niveau {passiveDetails.level}</div>
                    <div className="text-stone-400 text-[10px]">{passiveDetails.levelData.description}</div>
                  </div>
                </div>
              )}
              {isAwakeningActive && (
                <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                  <span className="text-lg">✨</span>
                  <div className="flex-1">
                    <div className="text-amber-300 font-semibold mb-1">Éveil racial actif (Niv {awakeningInfo.levelRequired}+)</div>
                    <div className="text-stone-400 text-[10px]">{awakeningInfo.description}</div>
                  </div>
                </div>
              )}
              {!isAwakeningActive && races[char.race] && (
                <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                  <span className="text-lg">{races[char.race].icon}</span>
                  <span className="text-stone-300">{getRaceBonusText(char.race)}</span>
                </div>
              )}
              {classes[char.class] && (
                <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                  <span className="text-lg">{classes[char.class].icon}</span>
                  <div className="flex-1">
                    <div className="text-stone-200 font-semibold mb-1">{classes[char.class].ability}</div>
                    <div className="text-stone-400 text-[10px]">{getCalculatedDescription(char.class, getBaseWithBoosts(char).cap, getBaseWithBoosts(char).auto)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // CARTE MANNEQUIN
  // ============================================================================
  const DummyCard = () => {
    if (!dummy) return null;
    const totalDmgTaken = DUMMY_HP - dummy.currentHP;

    return (
      <div className="relative shadow-2xl overflow-visible">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-orange-400 px-5 py-1.5 text-sm font-bold shadow-lg border border-stone-500 z-10">
          Cible d'entraînement
        </div>
        <div className="overflow-visible">
          <div className="h-auto relative bg-stone-900 flex items-center justify-center">
            <img src={mannequinImg} alt="Mannequin" className="w-full h-auto object-contain" />
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-3">
              <div className="text-white font-bold text-xl text-center">Mannequin</div>
            </div>
          </div>
          <div className="bg-stone-800 p-4 border-t border-stone-600">
            <div className="mb-3">
              <div className="flex justify-between text-sm text-white mb-2">
                <span className="text-orange-400">PV infinis</span>
                <span className="text-stone-400">VIT: {dummy.base.spd}</span>
              </div>
              <div className="text-xs text-stone-400 mb-2">Mannequin — Incassable</div>
              <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600">
                <div className="h-full bg-orange-500" style={{width: '100%'}} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-stone-400">Auto: {dummy.base.auto}</div>
              <div className="text-stone-400">Déf: {dummy.base.def}</div>
              <div className="text-stone-400">Cap: {dummy.base.cap}</div>
              <div className="text-stone-400">ResC: {dummy.base.rescap}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">🎯</span>
                <div className="flex-1">
                  <div className="text-orange-300 font-semibold mb-1">Mannequin d'entraînement</div>
                  <div className="text-stone-400 text-[10px]">Cible passive avec des PV infinis. Ne riposte jamais.</div>
                </div>
              </div>
              {totalDmgTaken > 0 && (
                <div className="flex items-start gap-2 bg-red-900/30 p-2 text-xs border border-red-700/50">
                  <span className="text-lg">💥</span>
                  <div className="flex-1">
                    <div className="text-red-300 font-semibold">Dégâts encaissés: {totalDmgTaken.toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // PANNEAU DPS
  // ============================================================================
  const DpsPanel = () => {
    if (!dpsStats) return null;
    return (
      <div className="bg-stone-800 border-2 border-amber-600 p-4 mb-4">
        <h3 className="text-lg font-bold text-amber-400 text-center mb-3">📊 Résultats DPS</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-stone-900 p-3 border border-stone-600 text-center">
            <div className="text-stone-400 text-xs mb-1">DPS moyen</div>
            <div className="text-amber-300 font-bold text-2xl">{dpsStats.avgDps}</div>
            <div className="text-stone-500 text-xs">par tour</div>
          </div>
          <div className="bg-stone-900 p-3 border border-stone-600 text-center">
            <div className="text-stone-400 text-xs mb-1">Dégâts totaux</div>
            <div className="text-red-400 font-bold text-2xl">{dpsStats.totalDamage.toLocaleString()}</div>
            <div className="text-stone-500 text-xs">{dpsStats.nbTurns} tours</div>
          </div>
          <div className="bg-stone-900 p-3 border border-stone-600 text-center">
            <div className="text-stone-400 text-xs mb-1">Meilleur tour</div>
            <div className="text-orange-400 font-bold text-2xl">{dpsStats.maxTurnDmg.toLocaleString()}</div>
            <div className="text-stone-500 text-xs">pic de dégâts</div>
          </div>
        </div>

        {/* DPS par tour */}
        <div className="bg-stone-900 p-3 border border-stone-600">
          <div className="text-stone-300 text-xs font-bold mb-2">Dégâts par tour:</div>
          <div className="flex flex-wrap gap-1">
            {dpsStats.perTurn.map((dmg, idx) => {
              const maxDmg = dpsStats.maxTurnDmg || 1;
              const intensity = Math.round((dmg / maxDmg) * 100);
              const bgClass = intensity > 75 ? 'bg-red-700' : intensity > 50 ? 'bg-orange-700' : intensity > 25 ? 'bg-amber-700' : 'bg-stone-700';
              return (
                <Tooltip key={idx} content={`Tour ${idx + 1}: ${dmg} dégâts`}>
                  <div className={`${bgClass} px-2 py-1 text-xs text-white border border-stone-600 min-w-[40px] text-center`}>
                    <div className="text-[10px] text-stone-400">T{idx + 1}</div>
                    <div className="font-bold">{dmg}</div>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDUS
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <p className="text-gray-300 text-xl">Vous devez créer un personnage</p>
          <button onClick={() => navigate('/')} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 font-bold">
            Créer un personnage
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ÉCRAN DE COMBAT
  // ============================================================================
  if (gameState === 'fighting' && player && dummy) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-[1800px] mx-auto pt-16">
          <div className="flex justify-center mb-4">
            <div className="bg-stone-800 border border-stone-600 px-8 py-3">
              <h1 className="text-3xl font-bold text-stone-200">🎯 Entraînement 🎯</h1>
            </div>
          </div>

          {/* Layout: Joueur | Centre | Mannequin */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
            {/* Carte joueur */}
            <div className="order-1 md:order-1 w-full md:w-[340px] md:flex-shrink-0">
              <PlayerCard char={player} />
            </div>

            {/* Zone centrale */}
            <div className="order-2 md:order-2 w-full md:w-[600px] md:flex-shrink-0 flex flex-col">
              {/* Boutons */}
              <div className="flex justify-center gap-3 md:gap-4 mb-4">
                {combatResult === null && (
                  <button
                    onClick={simulateCombat}
                    disabled={isSimulating}
                    className="bg-stone-100 hover:bg-white disabled:bg-stone-600 disabled:text-stone-400 text-stone-900 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border-2 border-stone-400"
                  >
                    ▶️ Lancer l'entraînement
                  </button>
                )}
                {combatResult === 'done' && (
                  <button
                    onClick={handleStart}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border-2 border-amber-500"
                  >
                    🔄 Recommencer
                  </button>
                )}
                <button
                  onClick={handleBack}
                  className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border border-stone-500"
                >
                  ← Retour
                </button>
              </div>

              {/* DPS Panel */}
              <DpsPanel />

              {/* Zone de chat */}
              <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[480px] md:h-[600px]">
                <div className="bg-stone-900 p-3 border-b border-stone-600">
                  <h2 className="text-lg md:text-2xl font-bold text-stone-200 text-center">🎯 Entraînement en direct</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
                  {combatLog.length === 0 ? (
                    <p className="text-stone-500 italic text-center py-6 md:py-8 text-xs md:text-sm">Cliquez sur "Lancer l'entraînement" pour commencer...</p>
                  ) : (
                    <>
                      {combatLog.map((log, idx) => {
                        const isP1 = log.startsWith('[P1]');
                        const isP2 = log.startsWith('[P2]');
                        const cleanLog = log.replace(/^\[P[12]\]\s*/, '');

                        if (!isP1 && !isP2) {
                          if (log.includes('📊')) {
                            return (
                              <div key={idx} className="flex justify-center my-4">
                                <div className="bg-amber-900/50 text-amber-200 px-6 py-3 font-bold text-lg shadow-lg border border-amber-600">
                                  {cleanLog}
                                </div>
                              </div>
                            );
                          }
                          if (log.includes('🏆') || log.includes('💀')) {
                            return (
                              <div key={idx} className="flex justify-center my-4">
                                <div className="bg-stone-100 text-stone-900 px-6 py-3 font-bold text-lg shadow-lg border border-stone-400">
                                  {cleanLog}
                                </div>
                              </div>
                            );
                          }
                          if (log.includes('---') || log.includes('🎯') || log.includes('⚔️')) {
                            return (
                              <div key={idx} className="flex justify-center my-3">
                                <div className="bg-stone-700 text-stone-200 px-4 py-1 text-sm font-bold border border-stone-500">
                                  {cleanLog}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={idx} className="flex justify-center">
                              <div className="text-stone-400 text-sm italic">{cleanLog}</div>
                            </div>
                          );
                        }

                        if (isP1) {
                          return (
                            <div key={idx} className="flex justify-start">
                              <div className="max-w-[80%]">
                                <div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-l-4 border-blue-500">
                                  <div className="text-xs md:text-sm">{formatLogMessage(cleanLog)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (isP2) {
                          return (
                            <div key={idx} className="flex justify-end">
                              <div className="max-w-[80%]">
                                <div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-r-4 border-orange-500">
                                  <div className="text-xs md:text-sm">{formatLogMessage(cleanLog)}</div>
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

            {/* Carte mannequin */}
            <div className="order-3 md:order-3 w-full md:w-[340px] md:flex-shrink-0">
              <DummyCard />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LOBBY
  // ============================================================================
  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-2xl mx-auto pt-20">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-stone-800 border border-stone-600 px-8 py-3">
            <h2 className="text-4xl font-bold text-stone-200">🎯 Entraînement</h2>
          </div>
        </div>

        <div className="bg-stone-800 border border-stone-600 p-6 mb-8 text-center">
          <div className="mb-4">
            <img src={mannequinImg} alt="Mannequin" className="w-48 h-auto mx-auto" />
          </div>
          <h3 className="text-xl font-bold text-orange-400 mb-2">Mannequin d'entraînement</h3>
          <p className="text-stone-300 mb-2">
            Testez votre personnage contre un mannequin incassable.
          </p>
          <p className="text-stone-400 text-sm mb-6">
            Le mannequin a des PV infinis et ne riposte pas. Un rapport DPS détaillé sera affiché à la fin du combat.
          </p>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            className="bg-orange-600 hover:bg-orange-700 text-white px-12 py-4 font-bold text-xl shadow-2xl border-2 border-orange-500 hover:border-orange-400 transition-all"
          >
            Commencer l'entraînement
          </button>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => navigate('/')}
            className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 font-bold border border-stone-500"
          >
            Retour
          </button>
        </div>
      </div>
    </div>
  );
};

export default Training;
