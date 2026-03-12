import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter, updateCharacterLevel } from '../services/characterService';
import { getPlayerDungeonSummary } from '../services/dungeonService';
import { getMageTowerPassiveById, getMageTowerPassiveLevel, getAvailablePassives } from '../data/mageTowerPassives';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import {
  applyPassiveWeaponStats,
  initWeaponCombatState,
} from '../utils/weaponEffects';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { getRaceBonusText } from '../utils/descriptionBuilders';
import { getCalculatedClassDescription } from '../utils/calculatedClassDescription';
import {
  classConstants,
  raceConstants,
  getRaceBonus,
  getClassBonus
} from '../data/combatMechanics';
import {
  RARITY_COLORS,
  getWeaponById,
  getWeaponsByFamily,
  getWeaponFamilyInfo,
} from '../data/weapons';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import { isForgeActive } from '../data/featureFlags';
import { extractForgeUpgrade, computeForgeStatDelta, hasAnyForgeUpgrade, generateForgeUpgradeRoll } from '../data/forgeDungeon';
import { applyAwakeningToBase, buildAwakeningState, getAwakeningEffect, removeBaseRaceFlatBonusesIfAwakened } from '../utils/awakening';
import { getExtensionPassiveOptions } from '../data/extensionDungeon';
import { getSubclassesForClass, getSubclassById } from '../data/subclasses';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { simulerMatch, preparerCombattant } from '../utils/tournamentCombat';
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
  const entries = Object.entries(weapon.stats).filter(([, v]) => v !== 0);
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
      {weapon.effet && typeof weapon.effet === 'object' ? (
        <span className="block text-amber-200">Effet: {weapon.effet.nom} — {weapon.effet.description}</span>
      ) : null}
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

const DUMMY_HP = 999999;

const SectionTitle = ({ children }) => (
  <div className="px-4 py-2.5 border-b border-stone-700/60 bg-stone-900">
    <h3 className="text-xs font-bold text-amber-400/90 uppercase tracking-widest">{children}</h3>
  </div>
);

const SelectField = ({ label, value, onChange, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-stone-400 font-medium">{label}</label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-stone-800 border border-stone-600 text-stone-200 text-sm rounded px-2 py-1.5 focus:border-amber-500 focus:outline-none"
    >
      {children}
    </select>
  </div>
);

const NumberField = ({ label, value, onChange, min, max }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-stone-400 font-medium">{label}</label>
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      min={min}
      max={max}
      className="bg-stone-800 border border-stone-600 text-stone-200 text-sm rounded px-2 py-1.5 w-full focus:border-amber-500 focus:outline-none"
    />
  </div>
);

const DEFAULT_DUMMY_CONFIG = {
  race: 'Humain',
  class: 'Guerrier',
  level: 1,
  subclassId: '',
  weaponId: '',
  forgeEnabled: false,
  passiveId: '',
  passiveLevel: 1,
  extensionId: '',
  extensionLevel: 1,
  hp: DUMMY_HP,
  auto: 0,
  def: 20,
  cap: 0,
  rescap: 20,
  spd: 0,
};

const buildConfiguredDummy = (config) => {
  const weaponData = config.weaponId ? getWeaponById(config.weaponId) : null;
  const isLegendary = weaponData?.rarete === 'legendaire';
  const forgeUpgrade = (config.forgeEnabled && isLegendary && config.weaponId)
    ? generateForgeUpgradeRoll(config.weaponId)
    : null;
  const subclass = config.subclassId ? getSubclassById(config.subclassId) : null;

  return {
    name: 'Mannequin',
    race: config.race,
    class: config.class,
    level: config.level,
    userId: 'training-dummy',
    characterImage: null,
    equippedWeaponId: config.weaponId || null,
    equippedWeaponData: weaponData,
    mageTowerPassive: config.passiveId ? { id: config.passiveId, level: config.passiveLevel } : null,
    mageTowerExtensionPassive: config.extensionId ? { id: config.extensionId, level: config.extensionLevel } : null,
    subclass: subclass ? { id: subclass.id, name: subclass.name } : null,
    forestBoosts: {},
    forgeUpgrade,
    base: {
      hp: config.hp,
      auto: config.auto,
      def: config.def,
      cap: config.cap,
      rescap: config.rescap,
      spd: config.spd,
    },
    bonuses: {
      race: getRaceBonus(config.race),
      class: getClassBonus(config.class),
    },
  };
};

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

  const [dummyConfig, setDummyConfig] = useState({ ...DEFAULT_DUMMY_CONFIG });

  const [gameState, setGameState] = useState('lobby'); // lobby, fighting
  const [player, setPlayer] = useState(null);
  const [dummy, setDummy] = useState(null);
  const [playerCombatBase, setPlayerCombatBase] = useState(null);
  const [dummyCombatBase, setDummyCombatBase] = useState(null);
  const [playerCombatModifiers, setPlayerCombatModifiers] = useState(null);
  const [playerCombatStatus, setPlayerCombatStatus] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [dpsStats, setDpsStats] = useState(null);
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (gameState === 'fighting') {
      const audio = document.getElementById('training-music');
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Autoplay bloqué:', e));
      }
    }
  }, [gameState]);

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

  // Scroll auto du journal : uniquement le conteneur du log, pas la page
  useEffect(() => {
    if (typeof window === 'undefined' || !logContainerRef.current) return;
    const el = logContainerRef.current;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [combatLog]);

  // Préparer le joueur pour le combat (même pattern que Dungeon.jsx)
  const prepareForCombat = (char) => {
    const weaponId = char?.equippedWeaponId || char?.equippedWeaponData?.id || null;
    const effectiveLevel = char.level ?? 1;
    const baseWithBoostsRaw = applyStatBoosts(char.base, char.forestBoosts);
    const baseWithBoosts = removeBaseRaceFlatBonusesIfAwakened(baseWithBoostsRaw, char.race, effectiveLevel);
    const skipWeaponFlat = isForgeActive() && char.forgeUpgrade && hasAnyForgeUpgrade(char.forgeUpgrade);
    const baseWithWeapon = applyPassiveWeaponStats(baseWithBoosts, weaponId, char.class, char.race, char.mageTowerPassive, skipWeaponFlat);
    const awakeningEffect = getAwakeningEffect(char.race, effectiveLevel);
    const baseWithAwakening = applyAwakeningToBase(baseWithWeapon, awakeningEffect);
    const baseWithoutWeapon = applyAwakeningToBase(baseWithBoosts, awakeningEffect);
    const weaponState = initWeaponCombatState(char, weaponId);
    return {
      ...char,
      _storedBase: char.base,
      base: baseWithAwakening,
      baseWithoutWeapon,
    baseWithBoosts,
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
      firstCapacityCapBoostUsed: false,
      stunned: false,
      stunnedTurns: 0,
      weaponState,
      awakening: buildAwakeningState(awakeningEffect)
    };
  };

  const currentDummyRaw = buildConfiguredDummy(dummyConfig);

  const handleStart = () => {
    setGameState('fighting');
    setCombatResult(null);
    setDpsStats(null);

    const playerReady = prepareForCombat(character);
    const dummyReady = preparerCombattant(currentDummyRaw);

    setPlayer(playerReady);
    setDummy(dummyReady);
    setPlayerCombatBase(null);
    setDummyCombatBase(null);
    setPlayerCombatModifiers(null);
    setPlayerCombatStatus(null);
    setCombatLog([`🎯 ${playerReady.name} commence l'entraînement sur le mannequin !`]);
  };

  const simulateCombat = async () => {
    if (!player || !dummy || !character || isSimulating) return;
    setIsSimulating(true);
    setCombatResult(null);
    setPlayerCombatBase(null);
    setDummyCombatBase(null);
    setPlayerCombatModifiers(null);
    setPlayerCombatStatus(null);
    setDpsStats(null);

    const logs = [...combatLog, `--- Combat d'entraînement ---`];

    const matchResult = simulerMatch(character, currentDummyRaw, { maxTurns: 30 });

    const stats = computeDpsStats(matchResult.steps, DUMMY_HP);
    setDpsStats(stats);

    const finalLogs = await replayCombatSteps(matchResult.steps, {
      setCombatLog,
      onStepHP: (step) => {
        setPlayerCombatBase(step.p1Base ?? undefined);
        setDummyCombatBase(step.p2Base ?? undefined);
        setPlayerCombatModifiers(step.p1Modifiers ?? null);
        setPlayerCombatStatus(step.p1Status ?? null);
        setPlayer((prev) => prev ? { ...prev, currentHP: step.p1HP, shield: step.p1Shield ?? prev.shield ?? 0 } : null);
        setDummy((prev) => prev ? { ...prev, currentHP: step.p2HP, shield: step.p2Shield ?? prev.shield ?? 0 } : null);
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
    // Arrêter la musique
    const audio = document.getElementById('training-music');
    if (audio) audio.pause();

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

  const getCalculatedDescription = getCalculatedClassDescription;

  // ============================================================================
  // CARTE MANNEQUIN
  // ============================================================================
  const DummyCard = ({ combatBaseOverride: dummyCombatBaseOverride }) => {
    if (!dummy) return null;
    const base = dummyCombatBaseOverride ?? dummy.base;
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
                <span className="text-stone-400">VIT: {base.spd}</span>
              </div>
              <div className="text-xs text-stone-400 mb-2">Mannequin — Incassable</div>
              <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600">
                <div className="h-full bg-orange-500" style={{width: '100%'}} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-stone-400">Auto: {base.auto}</div>
              <div className="text-stone-400">Déf: {base.def}</div>
              <div className="text-stone-400">Cap: {base.cap}</div>
              <div className="text-stone-400">ResC: {base.rescap}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">🎯</span>
                <div className="flex-1">
                  <div className="text-orange-300 font-semibold mb-1">Mannequin d'entraînement</div>
                  <div className="text-stone-400 text-[10px]">Cible d'entraînement configurable. Attaque normalement si ses stats le permettent.</div>
                </div>
              </div>
              {totalDmgTaken > 0 && (
                <div className="flex items-start gap-2 bg-red-950 p-2 text-xs border border-red-700">
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
        <audio id="training-music" loop>
          <source src="/assets/music/training.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-[1800px] mx-auto pt-16">
          <div className="flex justify-center mb-4">
            <div className="bg-stone-800 border border-stone-600 px-8 py-3">
              <h1 className="text-3xl font-bold text-stone-200">🎯 Entraînement 🎯</h1>
            </div>
          </div>

          {/* Layout: Joueur | Centre | Mannequin */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
            {/* Carte joueur */}
            <div className="order-1 md:order-1 w-full md:w-[340px] lg:w-auto md:flex-shrink-0">
              <CharacterCardContent character={player} showHpBar combatBaseOverride={playerCombatBase} combatModifiers={playerCombatModifiers} opponent={dummy} combatStatus={playerCombatStatus} detailsPlacement="left" />
            </div>

            {/* Zone centrale */}
            <div className="order-2 md:order-2 w-full md:w-[600px] lg:w-[500px] lg:flex-1 lg:min-w-[400px] md:flex-shrink-0 lg:flex-shrink flex flex-col">
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
                <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
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
                                <div className="bg-amber-950 text-amber-200 px-6 py-3 font-bold text-lg shadow-lg border border-amber-600">
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
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Carte mannequin */}
            <div className="order-3 md:order-3 w-full md:w-[340px] md:flex-shrink-0">
              <DummyCard combatBaseOverride={dummyCombatBase} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // HELPERS CONFIGURATEUR
  // ============================================================================
  const updateConfig = (key, value) => setDummyConfig(prev => ({ ...prev, [key]: value }));

  const raceNames = Object.keys(races);
  const classNames = Object.keys(classes);

  const weaponFamilyMap = getWeaponFamilyInfo();
  const weaponFamilies = Object.entries(weaponFamilyMap).map(([key, val]) => ({ family: key, nom: val.nom, icon: val.icon }));
  const allPassives = getAvailablePassives();

  const selectedWeaponData = dummyConfig.weaponId ? getWeaponById(dummyConfig.weaponId) : null;
  const isLegendaryWeapon = selectedWeaponData?.rarete === 'legendaire';

  const availableSubclasses = dummyConfig.class ? getSubclassesForClass(dummyConfig.class) : [];
  const showSubclass = dummyConfig.level >= 400 && availableSubclasses.length > 0;

  const showExtension = dummyConfig.passiveId && dummyConfig.passiveLevel >= 3;
  const extensionOptions = dummyConfig.passiveId ? getExtensionPassiveOptions(dummyConfig.passiveId) : [];

  const isAwakened = dummyConfig.level >= 100;

  const previewDummy = preparerCombattant(currentDummyRaw);

  const handleConfigRaceChange = (val) => {
    updateConfig('race', val);
  };
  const handleConfigClassChange = (val) => {
    setDummyConfig(prev => ({ ...prev, class: val, subclassId: '' }));
  };
  const handleConfigWeaponChange = (val) => {
    setDummyConfig(prev => ({ ...prev, weaponId: val, forgeEnabled: false }));
  };
  const handleConfigPassiveChange = (val) => {
    setDummyConfig(prev => ({ ...prev, passiveId: val, passiveLevel: 1, extensionId: '', extensionLevel: 1 }));
  };
  const resetStats = () => {
    setDummyConfig(prev => ({
      ...prev,
      hp: DEFAULT_DUMMY_CONFIG.hp,
      auto: DEFAULT_DUMMY_CONFIG.auto,
      def: DEFAULT_DUMMY_CONFIG.def,
      cap: DEFAULT_DUMMY_CONFIG.cap,
      rescap: DEFAULT_DUMMY_CONFIG.rescap,
      spd: DEFAULT_DUMMY_CONFIG.spd,
    }));
  };

  // ============================================================================
  // LOBBY
  // ============================================================================
  return (
    <div className="min-h-screen p-4 md:p-6">
      <Header />
      <div className="max-w-[1200px] mx-auto pt-20">
        <div className="flex justify-center mb-6">
          <div className="bg-stone-950/85 border border-stone-700/80 rounded-lg px-6 py-2 shadow">
            <h2 className="text-2xl font-bold text-stone-200">🎯 Entraînement</h2>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 mb-4 rounded-lg text-center">
            {error}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
          {/* PANNEAU CONFIGURATEUR */}
          <div className="w-full lg:w-[420px] lg:flex-shrink-0">
            <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl overflow-hidden shadow-lg">

              {/* Identité */}
              <SectionTitle>Identité</SectionTitle>
              <div className="p-4 space-y-3 border-b border-stone-700/40">
                <SelectField label="Race" value={dummyConfig.race} onChange={handleConfigRaceChange}>
                  {raceNames.map(r => <option key={r} value={r}>{races[r]?.icon || ''} {r}</option>)}
                </SelectField>
                <SelectField label="Classe" value={dummyConfig.class} onChange={handleConfigClassChange}>
                  {classNames.map(c => <option key={c} value={c}>{classes[c]?.icon || ''} {c}</option>)}
                </SelectField>
                <NumberField label="Niveau" value={dummyConfig.level} onChange={v => updateConfig('level', Math.max(1, Math.min(999, v)))} min={1} max={999} />
              </div>

              {/* Spécialisation */}
              <SectionTitle>Spécialisation</SectionTitle>
              <div className="p-4 space-y-3 border-b border-stone-700/40">
                {showSubclass ? (
                  <SelectField label="Sous-classe" value={dummyConfig.subclassId} onChange={v => updateConfig('subclassId', v)}>
                    <option value="">Aucune</option>
                    {availableSubclasses.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                  </SelectField>
                ) : (
                  <div className="text-xs text-stone-500 italic">Niveau 400+ requis pour les sous-classes</div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 font-medium">Awakening</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isAwakened ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-stone-700/50 text-stone-500 border border-stone-600/40'}`}>
                    {isAwakened ? 'Actif' : 'Inactif (niv. 100+)'}
                  </span>
                </div>
              </div>

              {/* Équipement */}
              <SectionTitle>Équipement</SectionTitle>
              <div className="p-4 space-y-3 border-b border-stone-700/40">
                <SelectField label="Arme" value={dummyConfig.weaponId} onChange={handleConfigWeaponChange}>
                  <option value="">Aucune</option>
                  {weaponFamilies.map(fam => (
                    <optgroup key={fam.family} label={`${fam.icon} ${fam.nom}`}>
                      {getWeaponsByFamily(fam.family).map(w => (
                        <option key={w.id} value={w.id}>{w.nom} ({w.rarete})</option>
                      ))}
                    </optgroup>
                  ))}
                </SelectField>
                {isLegendaryWeapon && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-stone-400 font-medium">Forge</label>
                    <button
                      type="button"
                      onClick={() => updateConfig('forgeEnabled', !dummyConfig.forgeEnabled)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${dummyConfig.forgeEnabled ? 'bg-amber-500' : 'bg-stone-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${dummyConfig.forgeEnabled ? 'translate-x-5' : ''}`} />
                    </button>
                    <span className="text-xs text-stone-500">{dummyConfig.forgeEnabled ? 'Active' : 'Inactive'}</span>
                  </div>
                )}
              </div>

              {/* Magie */}
              <SectionTitle>Magie</SectionTitle>
              <div className="p-4 space-y-3 border-b border-stone-700/40">
                <SelectField label="Passif" value={dummyConfig.passiveId} onChange={handleConfigPassiveChange}>
                  <option value="">Aucun</option>
                  {allPassives.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
                </SelectField>
                {dummyConfig.passiveId && (
                  <SelectField label="Niveau passif" value={dummyConfig.passiveLevel} onChange={v => updateConfig('passiveLevel', Number(v))}>
                    <option value={1}>Niveau 1</option>
                    <option value={2}>Niveau 2</option>
                    <option value={3}>Niveau 3</option>
                  </SelectField>
                )}
                {showExtension && (
                  <>
                    <SelectField label="Extension (Fusion)" value={dummyConfig.extensionId} onChange={v => updateConfig('extensionId', v)}>
                      <option value="">Aucune</option>
                      {extensionOptions.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
                    </SelectField>
                    {dummyConfig.extensionId && (
                      <SelectField label="Niveau extension" value={dummyConfig.extensionLevel} onChange={v => updateConfig('extensionLevel', Number(v))}>
                        <option value={1}>Niveau 1</option>
                        <option value={2}>Niveau 2</option>
                        <option value={3}>Niveau 3</option>
                      </SelectField>
                    )}
                  </>
                )}
              </div>

              {/* Stats de base */}
              <SectionTitle>Stats de base</SectionTitle>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="HP" value={dummyConfig.hp} onChange={v => updateConfig('hp', Math.max(1, v))} min={1} />
                  <NumberField label="Auto" value={dummyConfig.auto} onChange={v => updateConfig('auto', Math.max(0, v))} min={0} />
                  <NumberField label="Déf" value={dummyConfig.def} onChange={v => updateConfig('def', Math.max(0, v))} min={0} />
                  <NumberField label="Cap" value={dummyConfig.cap} onChange={v => updateConfig('cap', Math.max(0, v))} min={0} />
                  <NumberField label="ResC" value={dummyConfig.rescap} onChange={v => updateConfig('rescap', Math.max(0, v))} min={0} />
                  <NumberField label="VIT" value={dummyConfig.spd} onChange={v => updateConfig('spd', Math.max(0, v))} min={0} />
                </div>
                <button
                  type="button"
                  onClick={resetStats}
                  className="w-full text-xs text-stone-400 hover:text-amber-400 border border-stone-700 hover:border-amber-500/50 rounded px-3 py-1.5 transition-colors"
                >
                  Réinitialiser les stats
                </button>
              </div>
            </div>
          </div>

          {/* APERÇU MANNEQUIN */}
          <div className="w-full lg:w-[420px] lg:flex-shrink-0">
            <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl overflow-hidden shadow-lg">
              {/* Header résumé */}
              <div className="px-4 py-3 border-b border-stone-700/60 bg-stone-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{races[dummyConfig.race]?.icon || '👤'}</span>
                  <span className="text-sm font-bold text-stone-200">{dummyConfig.race}</span>
                  <span className="text-stone-600">•</span>
                  <span className="text-lg">{classes[dummyConfig.class]?.icon || '⚔️'}</span>
                  <span className="text-sm font-bold text-stone-200">{dummyConfig.class}</span>
                </div>
                <span className="text-xs text-amber-400 font-semibold">Niv. {dummyConfig.level}</span>
              </div>

              {/* Image mannequin */}
              <div className="relative bg-stone-900 flex items-center justify-center">
                <img src={mannequinImg} alt="Mannequin" className="w-full h-auto object-contain max-h-[300px]" />
              </div>

              {/* Stats finales */}
              <div className="p-4 border-t border-stone-700/60">
                <div className="text-xs text-stone-500 uppercase tracking-wider mb-2 font-bold">Stats finales (après bonus)</div>
                <div className="grid grid-cols-3 gap-2 text-sm mb-4">
                  <div className="bg-stone-800 rounded px-2 py-1.5 text-center">
                    <div className="text-[10px] text-stone-500">HP</div>
                    <div className="text-red-400 font-bold">{dummyConfig.hp >= DUMMY_HP ? '∞' : previewDummy.base?.hp ?? '—'}</div>
                  </div>
                  <div className="bg-stone-800 rounded px-2 py-1.5 text-center">
                    <div className="text-[10px] text-stone-500">Auto</div>
                    <div className="text-orange-400 font-bold">{previewDummy.base?.auto ?? '—'}</div>
                  </div>
                  <div className="bg-stone-800 rounded px-2 py-1.5 text-center">
                    <div className="text-[10px] text-stone-500">Déf</div>
                    <div className="text-blue-400 font-bold">{previewDummy.base?.def ?? '—'}</div>
                  </div>
                  <div className="bg-stone-800 rounded px-2 py-1.5 text-center">
                    <div className="text-[10px] text-stone-500">Cap</div>
                    <div className="text-purple-400 font-bold">{previewDummy.base?.cap ?? '—'}</div>
                  </div>
                  <div className="bg-stone-800 rounded px-2 py-1.5 text-center">
                    <div className="text-[10px] text-stone-500">ResC</div>
                    <div className="text-teal-400 font-bold">{previewDummy.base?.rescap ?? '—'}</div>
                  </div>
                  <div className="bg-stone-800 rounded px-2 py-1.5 text-center">
                    <div className="text-[10px] text-stone-500">VIT</div>
                    <div className="text-yellow-400 font-bold">{previewDummy.base?.spd ?? '—'}</div>
                  </div>
                </div>

                {/* Résumé équipement */}
                <div className="space-y-1.5 text-xs">
                  {selectedWeaponData && (
                    <div className="flex items-center gap-2 bg-stone-800 rounded px-2 py-1.5">
                      <span className="text-amber-400">⚔️</span>
                      <span className="text-stone-300">{selectedWeaponData.nom}</span>
                      {dummyConfig.forgeEnabled && isLegendaryWeapon && <span className="text-amber-500 text-[10px] font-bold">FORGÉ</span>}
                    </div>
                  )}
                  {dummyConfig.passiveId && (() => {
                    const p = getMageTowerPassiveById(dummyConfig.passiveId);
                    return p ? (
                      <div className="flex items-center gap-2 bg-stone-800 rounded px-2 py-1.5">
                        <span>{p.icon}</span>
                        <span className="text-stone-300">{p.name} niv.{dummyConfig.passiveLevel}</span>
                      </div>
                    ) : null;
                  })()}
                  {dummyConfig.extensionId && (() => {
                    const p = getMageTowerPassiveById(dummyConfig.extensionId);
                    return p ? (
                      <div className="flex items-center gap-2 bg-stone-800 rounded px-2 py-1.5">
                        <span>{p.icon}</span>
                        <span className="text-stone-300">Ext. {p.name} niv.{dummyConfig.extensionLevel}</span>
                      </div>
                    ) : null;
                  })()}
                  {dummyConfig.subclassId && (() => {
                    const sc = getSubclassById(dummyConfig.subclassId);
                    return sc ? (
                      <div className="flex items-center gap-2 bg-stone-800 rounded px-2 py-1.5">
                        <span className="text-amber-400">🔱</span>
                        <span className="text-stone-300">{sc.name}</span>
                      </div>
                    ) : null;
                  })()}
                  {isAwakened && (
                    <div className="flex items-center gap-2 bg-amber-950 rounded px-2 py-1.5 border border-amber-500">
                      <span className="text-amber-400">✨</span>
                      <span className="text-amber-300">Awakening actif</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bouton lancer */}
              <div className="p-4 pt-0">
                <button
                  onClick={handleStart}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 font-bold text-lg rounded-lg shadow-lg border border-orange-500/60 transition-all"
                >
                  Commencer l'entraînement
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Training;
