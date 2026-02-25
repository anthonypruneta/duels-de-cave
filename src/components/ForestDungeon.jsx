import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserCharacter,
  updateCharacterEquippedWeapon,
  updateCharacterForestBoosts,
  updateCharacterLevel
} from '../services/characterService';
import { getEquippedWeapon, getDungeonProgress, getPlayerDungeonSummary, markDungeonCompleted, startDungeonRun } from '../services/dungeonService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getRaceBonusText } from '../utils/descriptionBuilders';
import {
  cooldowns,
  classConstants,
  raceConstants,
  generalConstants,
  weaponConstants,
  dmgPhys,
  dmgCap,
  calcCritChance,
  getCritMultiplier,
  getRaceBonus,
  getClassBonus
} from '../data/combatMechanics';
import { applyAwakeningToBase, buildAwakeningState, getAwakeningEffect, removeBaseRaceFlatBonusesIfAwakened } from '../utils/awakening';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import {
  FOREST_DIFFICULTY_COLORS,
  getAllForestLevels,
  getForestLevelByNumber,
  createForestBossCombatant
} from '../data/forestDungeons';
import { applyStatBoosts, applyStatPoints, getEmptyStatBoosts, getStatLabels } from '../utils/statPoints';
import { clampLevel, MAX_LEVEL } from '../data/featureFlags';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import { isForgeActive } from '../data/featureFlags';
import { extractForgeUpgrade, computeForgeStatDelta, hasAnyForgeUpgrade } from '../data/forgeDungeon';
import {
  applyGungnirDebuff,
  applyMjollnirStun,
  applyPassiveWeaponStats,
  initWeaponCombatState,
  modifyCritDamage,
  onAttack,
  onHeal,
  onCapacityCast,
  rollHealCrit,
  onTurnStart
} from '../utils/weaponEffects';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';

const bossImageModules = import.meta.glob('../assets/bosses/*.png', { eager: true, import: 'default' });
const weaponImageModules = import.meta.glob('../assets/weapons/*.png', { eager: true, import: 'default' });

const getBossImage = (imageFile) => {
  if (!imageFile) return null;
  return bossImageModules[`../assets/bosses/${imageFile}`] || null;
};

const getWeaponImage = (imageFile) => {
  if (!imageFile) return null;
  return weaponImageModules[`../assets/weapons/${imageFile}`] || null;
};

const STAT_LABELS = {
  hp: 'HP',
  auto: 'Auto',
  def: 'DEF',
  cap: 'CAP',
  rescap: 'RESC',
  spd: 'VIT'
};

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
      {weapon.effet && (
        <span className="block text-amber-200">
          Effet: {weapon.effet.nom} — {weapon.effet.description}
        </span>
      )}
      {stats && (
        <span className="block text-stone-200">
          Stats: {stats}
        </span>
      )}
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

const getUnicornPactTurnData = (passiveDetails, turn) => {
  if (!passiveDetails || passiveDetails.id !== 'unicorn_pact') return null;
  const isTurnA = turn % 2 === 1;
  return isTurnA ? { label: 'Tour A', ...passiveDetails.levelData.turnA } : { label: 'Tour B', ...passiveDetails.levelData.turnB };
};

const getAuraBonus = (passiveDetails, turn) => {
  if (!passiveDetails || passiveDetails.id !== 'aura_overload') return 0;
  return turn <= passiveDetails.levelData.turns ? passiveDetails.levelData.damageBonus : 0;
};

const applyStartOfCombatPassives = (playerChar, bossChar, log, label) => {
  const passiveDetails = getPassiveDetails(playerChar.mageTowerPassive);

  if (passiveDetails?.id === 'arcane_barrier') {
    const shieldValue = Math.max(1, Math.round(playerChar.maxHP * passiveDetails.levelData.shieldPercent));
    playerChar.shield = shieldValue;
    log.push(`${label} 🛡️ Barrière arcanique: ${playerChar.name} gagne un bouclier de ${shieldValue} PV.`);
  }

  if (passiveDetails?.id === 'mind_breach') {
    const reduction = passiveDetails.levelData.defReduction;
    bossChar.base.def = Math.max(0, Math.round(bossChar.base.def * (1 - reduction)));
    log.push(`${label} 🧠 Brèche mentale: ${bossChar.name} perd ${Math.round(reduction * 100)}% de DEF.`);
  }

  if (playerChar.class === 'Bastion') {
    const shieldValue = Math.max(1, Math.round(playerChar.base.def * classConstants.bastion.startShieldFromDef));
    playerChar.shield = (playerChar.shield || 0) + shieldValue;
    log.push(`${label} 🏰 Rempart initial: ${playerChar.name} gagne un bouclier de ${shieldValue} PV (${Math.round(classConstants.bastion.startShieldFromDef * 100)}% DEF).`);
  }

  bossChar.spectralMarked = false;
  bossChar.spectralMarkBonus = 0;
};

// Composant Tooltip réutilisable
const Tooltip = ({ children, content }) => {
  return (
    <span className="relative group cursor-help">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-stone-900 border border-amber-500 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-500"></span>
      </span>
    </span>
  );
};

const ForestDungeon = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [equippedWeapon, setEquippedWeapon] = useState(null);
  const [gameState, setGameState] = useState('lobby'); // lobby, fighting, reward, victory, defeat
  const [currentLevel, setCurrentLevel] = useState(1);
  const [player, setPlayer] = useState(null);
  const [boss, setBoss] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [currentAction, setCurrentAction] = useState(null);
  const [rewardSummary, setRewardSummary] = useState(null);
  const [error, setError] = useState(null);
  const [dungeonSummary, setDungeonSummary] = useState(null);
  const [canInstantFinish, setCanInstantFinish] = useState(false);
  const [instantMessage, setInstantMessage] = useState(null);
  const logEndRef = useRef(null);
  const [isSoundOpen, setIsSoundOpen] = useState(false);
  const [volume, setVolume] = useState(0.05);
  const [isMuted, setIsMuted] = useState(false);

  const ensureForestMusic = () => {
    const forestMusic = document.getElementById('forest-music');
    if (forestMusic) {
      forestMusic.volume = volume;
      forestMusic.muted = isMuted;
      if (forestMusic.paused) {
        forestMusic.play().catch(error => console.log('Autoplay bloqué:', error));
      }
    }
  };

  const stopForestMusic = () => {
    const forestMusic = document.getElementById('forest-music');
    if (forestMusic) {
      forestMusic.pause();
      forestMusic.currentTime = 0;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;
      setLoading(true);

      const charResult = await getUserCharacter(currentUser.uid);
      if (!charResult.success || !charResult.data) {
        navigate('/');
        return;
      }

      const characterData = charResult.data;
      const level = characterData.level ?? 1;
      if (characterData.level == null) {
        updateCharacterLevel(currentUser.uid, level);
      }
      const forestBoosts = { ...getEmptyStatBoosts(), ...(characterData.forestBoosts || {}) };
      let weaponId = characterData.equippedWeaponId || null;
      let weaponData = weaponId ? getWeaponById(weaponId) : null;

      if (!weaponData) {
        const weaponResult = await getEquippedWeapon(currentUser.uid);
        weaponData = weaponResult.success ? weaponResult.weapon : null;
        weaponId = weaponResult.success ? weaponResult.weapon?.id || null : null;
        if (weaponId && weaponId !== characterData.equippedWeaponId) {
          updateCharacterEquippedWeapon(currentUser.uid, weaponId);
        }
      }

      const progressResult = await getDungeonProgress(currentUser.uid);
      const completionFlag = progressResult.success && progressResult.data?.dungeonCompletions?.forest;

      const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
      if (summaryResult.success) {
        setDungeonSummary(summaryResult.data);
      }

      setCanInstantFinish(Boolean(completionFlag));
      setEquippedWeapon(weaponData);
      setCharacter(normalizeCharacterBonuses({
        ...characterData,
        forestBoosts,
        level,
        equippedWeaponData: weaponData,
        equippedWeaponId: weaponId
      }));

      setLoading(false);
    };

    loadData();
  }, [currentUser, navigate]);


  const shouldAutoScrollLog = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(min-width: 768px)').matches;
  };

  useEffect(() => {
    if (!shouldAutoScrollLog()) return;
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

  const applyForestVolume = () => {
    const forestMusic = document.getElementById('forest-music');
    if (forestMusic) {
      forestMusic.volume = volume;
      forestMusic.muted = isMuted;
    }
  };

  useEffect(() => {
    applyForestVolume();
  }, [volume, isMuted, gameState]);

  const handleVolumeChange = (event) => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    if (isMuted && volume === 0) {
      setVolume(0.05);
    }
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
            <button
              type="button"
              onClick={toggleMute}
              className="text-lg"
              aria-label={isMuted ? 'Réactiver le son' : 'Couper le son'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full accent-amber-500"
            />
            <span className="text-xs text-stone-200 w-10 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    if (gameState === 'fighting' || gameState === 'reward') {
      ensureForestMusic();
    }
    if (gameState === 'victory' || gameState === 'defeat') {
      stopForestMusic();
    }
  }, [gameState]);

  // Descriptions calculées des classes (même que Combat.jsx)
  const getCalculatedDescription = (className, cap, auto) => {
    switch(className) {
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
            <Tooltip content={`${capScale.toFixed(2)} × Cap (${cap}) = ${healValue}`}>
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
            <Tooltip content={`Hit2 = ${hit2AutoMultiplier.toFixed(2)}×Auto (${auto}) + ${hit2CapMultiplier.toFixed(2)}×Cap (${cap}) vs ResC`}>
              <span className="text-green-400">{hit2Auto}+{hit2Cap}</span>
            </Tooltip>
          </>
        );
      }

      case 'Mage': {
        const { capBase, capPerCap } = classConstants.mage;
        const magicPct = capBase + capPerCap * cap;
        const magicDmgTotal = Math.round(magicPct * cap);
        return (
          <>
            Dégâts = Auto +{' '}
            <Tooltip content={`Auto (${auto}) + ${(magicPct * 100).toFixed(1)}% × Cap (${cap})`}>
              <span className="text-green-400">{auto + magicDmgTotal}</span>
            </Tooltip>
            {' '}dégâts magiques (vs ResC)
          </>
        );
      }

      case 'Demoniste': {
        const { capBase, capPerCap, ignoreResist, stackPerAuto } = classConstants.demoniste;
        const familierPct = capBase + capPerCap * cap;
        const familierDmgTotal = Math.round(familierPct * cap);
        const ignoreResPct = Math.round(ignoreResist * 100);
        const stackBonusPct = Math.round(stackPerAuto * 100);
        return (
          <>
            Chaque tour:{' '}
            <Tooltip content={`${(familierPct * 100).toFixed(1)}% de Cap (${cap}) | +${stackBonusPct}% Cap par auto (cumulable) | Ignore ${ignoreResPct}% ResC`}>
              <span className="text-green-400">{familierDmgTotal}</span>
            </Tooltip>
            {' '}dégâts (ignore {ignoreResPct}% ResC)
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

      case 'Bastion': {
        const { defPercentBonus, startShieldFromDef, capScale, defScale } = classConstants.bastion;
        const shieldPct = Math.round(startShieldFromDef * 100);
        const defBonusPct = Math.round(defPercentBonus * 100);
        const capDmg = Math.round(capScale * cap);
        return (
          <>
            Bouclier initial {shieldPct}% DEF | +{defBonusPct}% DEF | Auto +{' '}
            <Tooltip content={`${capScale * 100}% × Cap (${cap}) + ${defScale * 100}% DEF`}>
              <span className="text-green-400">{capDmg}</span>
            </Tooltip>
          </>
        );
      }
      default:
        return classes[className]?.description || '';
    }
  };

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
      spectralMarked: false,
      spectralMarkBonus: 0,
      firstCapacityCapBoostUsed: false,
      stunned: false,
      stunnedTurns: 0,
      weaponState,
      awakening: buildAwakeningState(awakeningEffect)
    };
  };

  const fullHealPlayer = (p) => {
    p.currentHP = p.maxHP;
    p.undead = false;
    p.dodge = false;
    p.reflect = false;
    p.bleed_stacks = 0;
    p.bleedPercentPerStack = 0;
    p.maso_taken = 0;
    p.familiarStacks = 0;
    p.firstCapacityCapBoostUsed = false;
    p.stunned = false;
    p.stunnedTurns = 0;
    if (p.awakening) {
      p.awakening.incomingHitCountRemaining = p.awakening.incomingHitCount ?? 0;
      p.awakening.damageTakenStacks = 0;
    }
    p.cd = { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 };
  };

  const reviveUndead = (target, attacker, log, playerColor) => {
    const revivePercent = target.awakening ? (target.awakening.revivePercent ?? 0) : raceConstants.mortVivant.revivePercent;
    const revive = Math.max(1, Math.round(revivePercent * target.maxHP));
    const explosionPercent = target.awakening?.explosionPercent ?? 0;
    if (attacker && explosionPercent > 0) {
      let explosion = Math.max(1, Math.round(explosionPercent * target.maxHP));
      if (attacker.awakening?.damageTakenMultiplier) {
        explosion = Math.max(1, Math.round(explosion * attacker.awakening.damageTakenMultiplier));
      }
      attacker.currentHP -= explosion;
      if (attacker.awakening?.damageStackBonus) {
        attacker.awakening.damageTakenStacks += 1;
      }
      log.push(`${playerColor} 💥 L'éveil de ${target.name} explose et inflige ${explosion} dégâts à ${attacker.name}`);
    }
    target.undead = true;
    target.currentHP = revive;
    log.push(`${playerColor} ☠️ ${target.name} ressuscite d'entre les morts et revient avec ${revive} points de vie !`);
  };

  const applyIncomingAwakeningModifiers = (defender, damage) => {
    let adjusted = damage;
    if (defender.awakening?.incomingHitMultiplier && defender.awakening.incomingHitCountRemaining > 0) {
      adjusted = Math.round(adjusted * defender.awakening.incomingHitMultiplier);
      defender.awakening.incomingHitCountRemaining -= 1;
    }
    if (defender.awakening?.damageTakenMultiplier) {
      adjusted = Math.round(adjusted * defender.awakening.damageTakenMultiplier);
    }
    return adjusted;
  };

  const applyOutgoingAwakeningBonus = (attacker, damage) => {
    let adjusted = damage;
    if (attacker.awakening?.highHpDamageBonus && attacker.currentHP > attacker.maxHP * (attacker.awakening.highHpThreshold ?? 1)) {
      adjusted = Math.round(adjusted * (1 + attacker.awakening.highHpDamageBonus));
    }
    if (attacker.awakening?.damageStackBonus && attacker.awakening.damageTakenStacks > 0) {
      adjusted = Math.round(adjusted * (1 + attacker.awakening.damageStackBonus * attacker.awakening.damageTakenStacks));
    }
    return adjusted;
  };

  const getUnicornMultiplier = (turn) => (turn % 2 === 1 ? 1.15 : 0.85);

  const getAntiHealFactor = (opponent) => {
    let factor = 1;
    if (opponent?.class === 'Briseur de Sort') factor *= (1 - classConstants.briseurSort.antiHealReduction);
    const passive = getPassiveDetails(opponent?.mageTowerPassive);
    if (passive?.id === 'rituel_fracture') factor *= (1 - (passive.levelData.healReduction || 0));
    return factor;
  };

  const getBriseurAutoBonus = (att) => {
    if (att.class !== 'Briseur de Sort') return 0;
    return Math.round(att.base.cap * classConstants.briseurSort.autoCapBonus);
  };

  const applyBossIncomingModifier = (defender, damage, turn) => {
    if (defender?.ability?.type !== 'unicorn_cycle') return damage;
    return Math.round(damage * getUnicornMultiplier(turn));
  };

  const applyBossOutgoingModifier = (attacker, damage, turn) => {
    if (attacker?.ability?.type !== 'unicorn_cycle') return damage;
    return Math.round(damage * getUnicornMultiplier(turn));
  };

  const processPlayerAction = (att, def, log, isPlayer, turn) => {
    if (att.currentHP <= 0 || def.currentHP <= 0) return;

    const playerColor = isPlayer ? '[P1]' : '[P2]';
    const playerChar = isPlayer ? att : def;
    const playerPassive = getPassiveDetails(playerChar.mageTowerPassive);
    const unicornData = getUnicornPactTurnData(playerPassive, turn);
    const auraBonus = getAuraBonus(playerPassive, turn);
    const consumeAuraCapacityCapMultiplier = () => {
      if (!isPlayer || playerPassive?.id !== 'aura_overload') return 1;
      if (att.firstCapacityCapBoostUsed) return 1;
      att.firstCapacityCapBoostUsed = true;
      return 1 + (playerPassive?.levelData?.spellCapBonus ?? 0);
    };
    let skillUsed = false;

    const applyMageTowerDamage = (raw, isCrit, applyOnHitPassives = true) => {
      let adjusted = applyOutgoingAwakeningBonus(att, raw);

      if (isPlayer) {
        if (unicornData) {
          adjusted = Math.round(adjusted * (1 + unicornData.outgoing));
        }
        if (auraBonus) {
          adjusted = Math.round(adjusted * (1 + auraBonus));
        }
        if (def.spectralMarked && def.spectralMarkBonus) {
          adjusted = Math.round(adjusted * (1 + def.spectralMarkBonus));
        }
      } else if (unicornData) {
        adjusted = Math.round(adjusted * (1 + unicornData.incoming));
      }

      if (!isPlayer && isCrit && playerPassive?.id === 'obsidian_skin') {
        adjusted = Math.round(adjusted * (1 - playerPassive.levelData.critReduction));
      }
      adjusted = applyIncomingAwakeningModifiers(def, adjusted);

      if (def.dodge) {
        def.dodge = false;
        log.push(`${playerColor} 💨 ${def.name} esquive habilement l'attaque !`);
        return 0;
      }

      if (def.shield > 0 && adjusted > 0) {
        const absorbed = Math.min(def.shield, adjusted);
        def.shield -= absorbed;
        adjusted -= absorbed;
        log.push(`${playerColor} 🛡️ ${def.name} absorbe ${absorbed} points de dégâts grâce à un bouclier`);
      }

      if (adjusted > 0) {
        def.currentHP -= adjusted;
        def.maso_taken = (def.maso_taken || 0) + adjusted;
        if (def.awakening?.damageStackBonus) {
          def.awakening.damageTakenStacks += 1;
        }

        if (def.reflect && def.currentHP > 0) {
          const back = Math.round(def.reflect * adjusted);
          att.currentHP -= back;
          log.push(`${playerColor} 🔁 ${def.name} riposte et renvoie ${back} points de dégâts à ${att.name}`);
          if (back > 0 && att.class === 'Briseur de Sort') {
            const shield = Math.max(1, Math.round(back * classConstants.briseurSort.shieldFromSpellDamage + att.base.cap * classConstants.briseurSort.shieldFromCap));
            att.shield = (att.shield || 0) + shield;
            log.push(`${playerColor} 🧱 ${att.name} convertit la capacité en bouclier (+${shield}).`);
          }
          if (def.riposteTwice && back > 0) {
            att.currentHP -= back;
            log.push(`${playerColor} 📜 Codex Archon : ${def.name} riposte et renvoie ${back} points de dégâts à ${att.name}`);
            if (att.class === 'Briseur de Sort') {
              const shield2 = Math.max(1, Math.round(back * classConstants.briseurSort.shieldFromSpellDamage + att.base.cap * classConstants.briseurSort.shieldFromCap));
              att.shield = (att.shield || 0) + shield2;
              log.push(`${playerColor} 🧱 ${att.name} convertit la capacité en bouclier (+${shield2}).`);
            }
          }
          def.reflect = false;
          def.riposteTwice = false;
        }
      }

      if (applyOnHitPassives && isPlayer && playerPassive?.id === 'spectral_mark' && adjusted > 0 && !def.spectralMarked) {
        def.spectralMarked = true;
        def.spectralMarkBonus = playerPassive.levelData.damageTakenBonus;
        log.push(`${playerColor} 🟣 ${def.name} est marqué et subira +${Math.round(def.spectralMarkBonus * 100)}% dégâts.`);
      }

      if (applyOnHitPassives && isPlayer && playerPassive?.id === 'essence_drain' && adjusted > 0) {
        const heal = Math.max(1, Math.round(adjusted * playerPassive.levelData.healPercent * getAntiHealFactor(def)));
        att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
        log.push(`${playerColor} 🩸 ${att.name} siphonne ${heal} points de vie grâce au Vol d'essence`);
        const healEffects = onHeal(att.weaponState, att, heal, def);
        if (healEffects.bonusDamage > 0) {
          const bonusDmg = dmgCap(healEffects.bonusDamage, def.base.rescap);
          applyMageTowerDamage(bonusDmg, false, true, true);
          log.push(`${playerColor} ${healEffects.log.join(' ')}`);
        }
      }

      return adjusted;
    };
    if (att.stunnedTurns > 0) {
      att.stunnedTurns -= 1;
      if (att.stunnedTurns <= 0) {
        att.stunned = false;
      }
      log.push(`${playerColor} 😵 ${att.name} est étourdi et ne peut pas agir ce tour`);
      return;
    }

    att.reflect = false;
    for (const k of Object.keys(cooldowns)) {
      att.cd[k] = (att.cd[k] % cooldowns[k]) + 1;
    }

    const turnEffects = onTurnStart(att.weaponState || { isLegendary: false, counters: {} }, att, turn);
    let weaponDamageBonusAvailable = turnEffects.damageMultiplier !== undefined && turnEffects.damageMultiplier !== 1;
    const consumeWeaponDamageBonus = () => {
      if (weaponDamageBonusAvailable) {
        weaponDamageBonusAvailable = false;
        return turnEffects.damageMultiplier;
      }
      return 1;
    };
    if (turnEffects.log.length > 0) {
      log.push(...turnEffects.log.map(entry => `${playerColor} ${entry}`));
    }
    if (turnEffects.regen > 0) {
      const weaponRegen = Math.max(1, Math.round(turnEffects.regen * getAntiHealFactor(def)));
      att.currentHP = Math.min(att.maxHP, att.currentHP + weaponRegen);
    }

    if (att.race === 'Sylvari') {
      const regenPercent = att.awakening ? (att.awakening.regenPercent ?? 0) : raceConstants.sylvari.regenPercent;
      const heal = Math.max(1, Math.round(att.maxHP * regenPercent * getAntiHealFactor(def)));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} 🌿 ${att.name} régénère naturellement et récupère ${heal} points de vie`);
      const healEffects = onHeal(att.weaponState, att, heal, def);
      if (healEffects.bonusDamage > 0) {
        const bonusDmg = dmgCap(healEffects.bonusDamage, def.base.rescap);
        applyMageTowerDamage(bonusDmg, false, true, true);
        log.push(`${playerColor} ${healEffects.log.join(' ')}`);
      }
    }

    if (att.class === 'Demoniste') {
      const { capBase, capPerCap, ignoreResist, stackPerAuto } = classConstants.demoniste;
      const stackBonus = stackPerAuto * (att.familiarStacks || 0);
      const hit = Math.max(1, Math.round((capBase + capPerCap * att.base.cap + stackBonus) * att.base.cap));
      let raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
      raw = Math.round(raw * consumeWeaponDamageBonus());
      raw = applyBossOutgoingModifier(att, raw, turn);
      raw = applyBossIncomingModifier(def, raw, turn);
      const inflicted = applyMageTowerDamage(raw, false);
      log.push(`${playerColor} 💠 Le familier de ${att.name} attaque ${def.name} et inflige ${inflicted} points de dégâts`);
      const demonSpellEffects = onCapacityCast(att.weaponState, att, def, raw, 'demoniste');
      if (demonSpellEffects.doubleCast && demonSpellEffects.secondCastDamage > 0) {
        let extra = demonSpellEffects.secondCastDamage;
        extra = applyBossOutgoingModifier(att, extra, turn);
        extra = applyBossIncomingModifier(def, extra, turn);
        const inflictedCodex = applyMageTowerDamage(extra, false, false);
        log.push(`${playerColor} 📜 Codex Archon : Le familier de ${att.name} attaque ${def.name} et inflige ${inflictedCodex} points de dégâts`);
      }
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def, att, log, playerColor);
      }
    }

    if (att.class === 'Masochiste') {
      if (att.cd.maso === cooldowns.maso && att.maso_taken > 0) {
        if (isPlayer) skillUsed = true;
        const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
        let dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerCap * att.base.cap)));
        const healAmount = Math.max(1, Math.round(att.maso_taken * healPercent * getAntiHealFactor(def)));
        att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
        const masoHealEffects = onHeal(att.weaponState, att, healAmount, def);
        if (masoHealEffects.bonusDamage > 0) {
          const bonusDmg = dmgCap(masoHealEffects.bonusDamage, def.base.rescap);
          applyMageTowerDamage(bonusDmg, false, true, true);
          log.push(`${playerColor} ${masoHealEffects.log.join(' ')}`);
        }
        att.maso_taken = 0;
        dmg = Math.round(dmg * consumeWeaponDamageBonus());
        let raw = dmg;
        raw = applyBossOutgoingModifier(att, raw, turn);
        raw = applyBossIncomingModifier(def, raw, turn);
        const inflicted = applyMageTowerDamage(raw, false);
        const masoSpellEffects = onCapacityCast(att.weaponState, att, def, raw, 'maso', { healAmount });
        log.push(`${playerColor} 🩸 ${att.name} renvoie les dégâts accumulés: inflige ${inflicted} points de dégâts et récupère ${healAmount} points de vie`);
        if (masoSpellEffects.doubleCast && (masoSpellEffects.secondCastDamage > 0 || masoSpellEffects.secondCastHeal > 0)) {
          let extraRaw = masoSpellEffects.secondCastDamage;
          if (extraRaw > 0) {
            extraRaw = applyBossOutgoingModifier(att, extraRaw, turn);
            extraRaw = applyBossIncomingModifier(def, extraRaw, turn);
          }
          const inflicted2 = extraRaw > 0 ? applyMageTowerDamage(extraRaw, false, false) : 0;
          if (masoSpellEffects.secondCastHeal > 0) {
            att.currentHP = Math.min(att.maxHP, att.currentHP + masoSpellEffects.secondCastHeal);
          }
          log.push(`${playerColor} 📜 Codex Archon : ${att.name} renvoie les dégâts accumulés: inflige ${inflicted2} points de dégâts et récupère ${masoSpellEffects.secondCastHeal} points de vie`);
        }
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, att, log, playerColor);
        }
      }
    }

    if (att.bleed_stacks > 0) {
      let bleedDmg = att.bleedPercentPerStack
        ? Math.max(1, Math.round(att.maxHP * att.bleedPercentPerStack * att.bleed_stacks))
        : Math.ceil(att.bleed_stacks / raceConstants.lycan.bleedDivisor);
      if (att.awakening?.damageTakenMultiplier) {
        bleedDmg = Math.max(1, Math.round(bleedDmg * att.awakening.damageTakenMultiplier));
      }
      att.currentHP -= bleedDmg;
      log.push(`${playerColor} 🩸 ${att.name} saigne abondamment et perd ${bleedDmg} points de vie`);
      if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
        reviveUndead(att, def, log, playerColor);
      }
    }

    if (att.class === 'Paladin' && att.cd.pal === cooldowns.pal) {
      if (isPlayer) skillUsed = true;
      const { reflectBase, reflectPerCap } = classConstants.paladin;
      const spellCapMult = consumeAuraCapacityCapMultiplier();
      const reflectValue = reflectBase + reflectPerCap * att.base.cap * spellCapMult;
      att.reflect = reflectValue;
      const paladinSpellEffects = onCapacityCast(att.weaponState, att, def, reflectValue, 'paladin');
      if (paladinSpellEffects.doubleCast && paladinSpellEffects.riposteTwice) {
        att.riposteTwice = true;
        log.push(`${playerColor} 📜 Codex Archon : ${att.name} se prépare à riposter et renverra deux fois les dégâts`);
      }
      log.push(`${playerColor} 🛡️ ${att.name} se prépare à riposter et renverra ${Math.round(att.reflect * 100)}% des dégâts`);
    }

    if (att.class === 'Healer' && att.cd.heal === cooldowns.heal) {
      if (isPlayer) skillUsed = true;
      const miss = att.maxHP - att.currentHP;
      const { missingHpPercent, capScale } = classConstants.healer;
      const spellCapMultiplier = consumeAuraCapacityCapMultiplier();
      const baseHeal = Math.max(1, Math.round(missingHpPercent * miss + capScale * att.base.cap * spellCapMultiplier * getAntiHealFactor(def)));
      const healCritResult = rollHealCrit(att.weaponState, att, baseHeal);
      const heal = healCritResult.amount;
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} ✚ ${att.name} lance sa capacité de soin puissante et récupère ${heal} points de vie${healCritResult.isCrit ? ' CRITIQUE !' : ''}`);
      const healSpellEffects = onCapacityCast(att.weaponState, att, def, heal, 'heal');
      if (healSpellEffects.doubleCast && healSpellEffects.secondCastHeal > 0) {
        att.currentHP = Math.min(att.maxHP, att.currentHP + healSpellEffects.secondCastHeal);
        log.push(`${playerColor} 📜 Codex Archon : ${att.name} lance sa capacité de soin puissante et récupère ${healSpellEffects.secondCastHeal} points de vie`);
      }
      const healEffects = onHeal(att.weaponState, att, heal, def);
      if (healEffects.bonusDamage > 0) {
        let bonusDmg = dmgCap(healEffects.bonusDamage, def.base.rescap);
        bonusDmg = applyBossOutgoingModifier(att, bonusDmg, turn);
        bonusDmg = applyBossIncomingModifier(def, bonusDmg, turn);
        applyMageTowerDamage(bonusDmg, false);
        log.push(`${playerColor} ${healEffects.log.join(' ')}`);
      }
    }

    if (att.class === 'Voleur' && att.cd.rog === cooldowns.rog) {
      if (isPlayer) skillUsed = true;
      consumeAuraCapacityCapMultiplier(); // Première capacité du combat
      att.dodge = true;
      log.push(`${playerColor} 🌀 ${att.name} entre dans une posture d'esquive et évitera la prochaine attaque`);
    }

    const isMage = att.class === 'Mage' && att.cd.mag === cooldowns.mag;
    const isWar = att.class === 'Guerrier' && att.cd.war === cooldowns.war;
    const isArcher = att.class === 'Archer' && att.cd.arc === cooldowns.arc;
    if (isPlayer && (isMage || isWar || isArcher)) {
      skillUsed = true;
    }

    let mult = 1.0;
    if (att.race === 'Orc' && att.currentHP < raceConstants.orc.lowHpThreshold * att.maxHP) {
      mult = raceConstants.orc.damageBonus;
    }

    let total = 0;
    const baseHits = isArcher ? classConstants.archer.hitCount : 1;
    const totalHits = baseHits + (turnEffects.bonusAttacks || 0);
    let wasCrit = false;
    const forceCrit = isPlayer
      && playerPassive?.id === 'obsidian_skin'
      && att.currentHP <= att.maxHP * playerPassive.levelData.critThreshold;

    for (let i = 0; i < totalHits; i++) {
      const isBonusAttack = i >= baseHits;
      const isCrit = turnEffects.guaranteedCrit ? true : forceCrit ? true : Math.random() < calcCritChance(att);
      const weaponBonus = i === 0 ? consumeWeaponDamageBonus() : 1;
      const attackMultiplier = mult * weaponBonus * (isBonusAttack ? (turnEffects.bonusAttackDamage || 1) : 1);
      let raw = 0;
      wasCrit = wasCrit || isCrit;

      if (isMage) {
        const { capBase, capPerCap } = classConstants.mage;
        const spellCapMultiplier = consumeAuraCapacityCapMultiplier();
        const scaledCap = att.base.cap * spellCapMultiplier;
        const atkSpell = Math.round(att.base.auto * attackMultiplier + (capBase + capPerCap * scaledCap) * scaledCap * attackMultiplier);
        raw = dmgCap(atkSpell, def.base.rescap);
        const spellEffects = onCapacityCast(att.weaponState, att, def, raw, 'mage');
        if (spellEffects.doubleCast && spellEffects.secondCastDamage > 0) {
          let extra = spellEffects.secondCastDamage;
          extra = applyBossOutgoingModifier(att, extra, turn);
          extra = applyBossIncomingModifier(def, extra, turn);
          const inflictedCodex = applyMageTowerDamage(extra, false, false);
          log.push(`${playerColor} 📜 Codex Archon : ${att.name} utilise sa capacité magique et inflige ${inflictedCodex} points de dégâts`);
        }
      } else if (isWar) {
        const spellCapMultWar = consumeAuraCapacityCapMultiplier();
        const ignore = classConstants.guerrier.ignoreBase + classConstants.guerrier.ignorePerCap * att.base.cap * spellCapMultWar;
        if (def.base.def <= def.base.rescap) {
          const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
          raw = dmgPhys(Math.round(att.base.auto * attackMultiplier), effDef);
        } else {
          const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
          raw = dmgCap(Math.round(att.base.cap * attackMultiplier), effRes);
        }
        if (i === 0) {
          const warSpellEffects = onCapacityCast(att.weaponState, att, def, raw, 'war');
          if (warSpellEffects.doubleCast && warSpellEffects.secondCastDamage > 0) {
            let extra = warSpellEffects.secondCastDamage;
            extra = applyBossOutgoingModifier(att, extra, turn);
            extra = applyBossIncomingModifier(def, extra, turn);
            const inflictedCodex = applyMageTowerDamage(extra, false, false);
            log.push(`${playerColor} 📜 Codex Archon : ${att.name} exécute une frappe pénétrante et inflige ${inflictedCodex} points de dégâts`);
          }
        }
      } else if (isArcher && !isBonusAttack) {
        if (i === 0) {
          raw = dmgPhys(Math.round(att.base.auto * attackMultiplier), def.base.def);
        } else {
          const { hit2AutoMultiplier, hit2CapMultiplier } = classConstants.archer;
          const spellCapMultArc = consumeAuraCapacityCapMultiplier();
          const physPart = dmgPhys(Math.round(att.base.auto * hit2AutoMultiplier * attackMultiplier), def.base.def);
          const capPart = dmgCap(Math.round(att.base.cap * spellCapMultArc * hit2CapMultiplier * attackMultiplier), def.base.rescap);
          raw = physPart + capPart;
        }
        if (i === 1) {
          const arcSpellEffects = onCapacityCast(att.weaponState, att, def, raw, 'arc');
          if (arcSpellEffects.doubleCast && arcSpellEffects.secondCastDamage > 0) {
            let extra = arcSpellEffects.secondCastDamage;
            extra = applyBossOutgoingModifier(att, extra, turn);
            extra = applyBossIncomingModifier(def, extra, turn);
            const inflictedCodex = applyMageTowerDamage(extra, false, false);
            log.push(`${playerColor} 📜 Codex Archon : ${att.name} lance un tir renforcé et inflige ${inflictedCodex} points de dégâts`);
          }
        }
      } else {
        const autoCapBonus = getBriseurAutoBonus(att);
        raw = dmgPhys(Math.round((att.base.auto + autoCapBonus) * attackMultiplier), def.base.def);
        if (att.race === 'Lycan') {
          const bleedStacks = att.awakening ? (att.awakening.bleedStacksPerHit ?? 0) : raceConstants.lycan.bleedPerHit;
          if (bleedStacks > 0) {
            def.bleed_stacks = (def.bleed_stacks || 0) + bleedStacks;
          }
          if (att.awakening?.bleedPercentPerStack) {
            def.bleedPercentPerStack = att.awakening.bleedPercentPerStack;
          }
        }
      }

      if (isCrit) {
        const critDamage = Math.round(raw * getCritMultiplier(att));
        raw = modifyCritDamage(att.weaponState, critDamage);
      }

      if (att.rageReady) {
        raw = Math.round(raw * 2);
        att.rageReady = false;
        att.rageUsed = true;
        log.push(`${playerColor} 💢 ${att.name} libère sa rage et double ses dégâts !`);
      }

      raw = applyBossOutgoingModifier(att, raw, turn);
      raw = applyBossIncomingModifier(def, raw, turn);
      const inflicted = applyMageTowerDamage(raw, isCrit);
      if (att.class === 'Demoniste' && !isMage && !isWar && !isArcher && !isBonusAttack) {
        att.familiarStacks = (att.familiarStacks || 0) + 1;
      }

      if (!isMage) {
        const attackEffects = onAttack(att.weaponState, att, def, inflicted);
        if (attackEffects.stunTarget) {
          Object.assign(def, applyMjollnirStun(def));
        }
        if (attackEffects.atkDebuff && !def.base._gungnirDebuffed) {
          def.base = applyGungnirDebuff(def.base);
        }
        if (attackEffects.log.length > 0) {
          log.push(`${playerColor} ${attackEffects.log.join(' ')}`);
        }
      }

      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def, att, log, playerColor);
      } else if (def.currentHP <= 0) {
        total += inflicted;
        break;
      }

      total += inflicted;
      if (isArcher && !isBonusAttack) {
        const critText = isCrit ? ' CRITIQUE !' : '';
        const shotLabel = i === 0 ? 'tir' : 'tir renforcé';
        log.push(`${playerColor} 🏹 ${att.name} lance un ${shotLabel} et inflige ${inflicted} points de dégâts${critText}`);
      } else if (isBonusAttack) {
        log.push(`${playerColor} 🌟 Attaque bonus: ${att.name} inflige ${inflicted} points de dégâts`);
      }
    }

    if (isPlayer && playerPassive?.id === 'elemental_fury' && skillUsed) {
      const lightningDamage = Math.max(1, Math.round(att.base.auto * playerPassive.levelData.lightningPercent));
      def.currentHP -= lightningDamage;
      log.push(`${playerColor} ⚡ Furie élémentaire déclenche un éclair et inflige ${lightningDamage} dégâts bruts`);
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) reviveUndead(def, att, log, playerColor);
    }

    if (!isArcher && total > 0) {
      const critText = wasCrit ? ' CRITIQUE !' : '';
      if (isMage) {
        log.push(`${playerColor} ${att.name} inflige ${total} points de dégâts magiques à ${def.name}${critText}`);
      } else if (isWar) {
        log.push(`${playerColor} ${att.name} transperce les défenses de ${def.name} et inflige ${total} points de dégâts${critText}`);
      } else {
        log.push(`${playerColor} ${att.name} attaque ${def.name} et inflige ${total} points de dégâts${critText}`);
      }
    }

    if (def?.ability?.type === 'bear_rage' && !def.rageReady && !def.rageUsed && def.currentHP > 0 && def.currentHP <= def.maxHP * 0.25) {
      def.rageReady = true;
      log.push(`${playerColor} 🐻 ${def.name} entre en rage et prépare un coup dévastateur !`);
    }
  };

  const rollForestRewards = (levelData, baseBoosts = character.forestBoosts) => {
    const statsPool = ['hp', 'auto', 'def', 'rescap', 'spd', 'cap'];
    const pointsByStat = {};

    for (let i = 0; i < levelData.rewardRolls; i++) {
      const stat = statsPool[Math.floor(Math.random() * statsPool.length)];
      pointsByStat[stat] = (pointsByStat[stat] || 0) + 1;
    }

    const gainsByStat = {};
    let updatedBoosts = { ...getEmptyStatBoosts(), ...(baseBoosts || {}) };
    Object.entries(pointsByStat).forEach(([stat, points]) => {
      const { updatedStats, delta } = applyStatPoints(updatedBoosts, stat, points);
      updatedBoosts = updatedStats;
      gainsByStat[stat] = (gainsByStat[stat] || 0) + delta;
    });

    return { updatedBoosts, gainsByStat };
  };

  /** Un seul point de stats (un roll). */
  const rollOneStatPoint = (baseBoosts = character.forestBoosts) => {
    const statsPool = ['hp', 'auto', 'def', 'rescap', 'spd', 'cap'];
    const stat = statsPool[Math.floor(Math.random() * statsPool.length)];
    const updatedBoosts = { ...getEmptyStatBoosts(), ...(baseBoosts || {}) };
    const { updatedStats, delta } = applyStatPoints(updatedBoosts, stat, 1);
    return { updatedBoosts: updatedStats, gainsByStat: { [stat]: delta } };
  };

  /** N rolls de stats (un par niveau accordé) — quand le gain est plafonné sous le full run. */
  const rollNStatPoints = (baseBoosts, n) => {
    let boosts = { ...getEmptyStatBoosts(), ...(baseBoosts || {}) };
    const totalGains = {};
    for (let i = 0; i < n; i++) {
      const result = rollOneStatPoint(boosts);
      boosts = result.updatedBoosts;
      Object.entries(result.gainsByStat || {}).forEach(([stat, value]) => {
        totalGains[stat] = (totalGains[stat] || 0) + value;
      });
    }
    return { updatedBoosts: boosts, gainsByStat: totalGains };
  };

  const handleStartRun = async () => {
    setError(null);
    setInstantMessage(null);
    const currentLevelChar = character?.level ?? 1;
    if (currentLevelChar >= MAX_LEVEL) {
      setError('Le donjon de la forêt est bloqué au niveau maximum (400).');
      return;
    }
    const result = await startDungeonRun(currentUser.uid);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setGameState('fighting');
    setCurrentLevel(1);
    setCombatResult(null);
    setCurrentAction(null);
    setRewardSummary(null);
    setIsSimulating(false);
    ensureForestMusic();

    const levelData = getForestLevelByNumber(1);
    const playerReady = prepareForCombat(character);
    const bossReady = createForestBossCombatant(levelData.boss);
    if (bossReady) {
      bossReady.weaponState = initWeaponCombatState(bossReady, null);
      bossReady.stunned = false;
      bossReady.stunnedTurns = 0;
    }

    setPlayer(playerReady);
    setBoss(bossReady);
    setCombatLog([`⚔️ Niveau 1: ${levelData.nom} — ${playerReady.name} vs ${bossReady.name} !`]);
  };

  const handleInstantFinishRun = async () => {
    setError(null);
    setInstantMessage(null);
    const currentLevelChar = character?.level ?? 1;
    if (currentLevelChar >= MAX_LEVEL) {
      setError('Le donjon de la forêt est bloqué au niveau maximum (400).');
      return;
    }

    const startResult = await startDungeonRun(currentUser.uid);
    if (!startResult.success) {
      setError(startResult.error);
      return;
    }

    await markDungeonCompleted(currentUser.uid, 'forest');
    setCanInstantFinish(true);

    const fullLevelGain = getAllForestLevels().reduce((acc, l) => acc + l.rewardRolls, 0);
    const allowedLevelGain = Math.min(fullLevelGain, MAX_LEVEL - currentLevelChar);

    let option1, option2;
    if (allowedLevelGain <= 0) {
      const noGain = { updatedBoosts: { ...getEmptyStatBoosts(), ...(character?.forestBoosts || {}) }, gainsByStat: {} };
      option1 = option2 = noGain;
    } else if (allowedLevelGain < fullLevelGain) {
      option1 = rollNStatPoints(character?.forestBoosts, allowedLevelGain);
      option2 = rollNStatPoints(character?.forestBoosts, allowedLevelGain);
    } else {
      const generateFullRunReward = () => {
        let boosts = { ...getEmptyStatBoosts(), ...(character?.forestBoosts || {}) };
        const totalGains = {};
        for (const levelData of getAllForestLevels()) {
          const result = rollForestRewards(levelData, boosts);
          boosts = result.updatedBoosts;
          Object.entries(result.gainsByStat).forEach(([stat, value]) => {
            totalGains[stat] = (totalGains[stat] || 0) + value;
          });
        }
        return { updatedBoosts: boosts, gainsByStat: totalGains };
      };
      option1 = generateFullRunReward();
      option2 = generateFullRunReward();
    }

    setRewardSummary({
      options: [
        { updatedBoosts: option1.updatedBoosts, gainsByStat: option1.gainsByStat },
        { updatedBoosts: option2.updatedBoosts, gainsByStat: option2.gainsByStat }
      ],
      levelGain: allowedLevelGain <= 0 ? 0 : Math.min(allowedLevelGain, fullLevelGain),
      allowedLevelGain,
      hasNextLevel: false,
      nextLevel: getAllForestLevels().length + 1
    });
    setGameState('reward');
  };

  const simulateCombat = async () => {
    if (!player || !boss || isSimulating) return;
    setIsSimulating(true);
    setCombatResult(null);
    ensureForestMusic();

    const p = { ...player };
    const b = { ...boss };
    const logs = [...combatLog, `--- Combat contre ${b.name} ---`];

    const matchResult = simulerMatch(p, b);

    // Replay animé des steps
    const finalLogs = await replayCombatSteps(matchResult.steps, {
      setCombatLog,
      onStepHP: (step) => {
        p.currentHP = step.p1HP;
        b.currentHP = step.p2HP;
        setPlayer({ ...p });
        setBoss({ ...b });
      },
      existingLogs: logs,
      speed: 'fast'
    });
    logs.length = 0;
    logs.push(...finalLogs);

    if (p.currentHP > 0) {
      logs.push(`🏆 ${p.name} remporte glorieusement le combat contre ${b.name} !`);
      setCombatLog([...logs]);
      setCombatResult('victory');

      const levelData = getForestLevelByNumber(currentLevel);
      const currentLevelChar = character?.level ?? 1;
      const rawLevelGain = levelData.rewardRolls;
      const allowedLevelGain = Math.min(rawLevelGain, MAX_LEVEL - currentLevelChar);

      let rewardOption1, rewardOption2;
      if (allowedLevelGain <= 0) {
        const noGain = { updatedBoosts: { ...getEmptyStatBoosts(), ...(character?.forestBoosts || {}) }, gainsByStat: {} };
        rewardOption1 = rewardOption2 = noGain;
      } else if (allowedLevelGain < rawLevelGain) {
        rewardOption1 = rollNStatPoints(character?.forestBoosts, allowedLevelGain);
        rewardOption2 = rollNStatPoints(character?.forestBoosts, allowedLevelGain);
      } else {
        rewardOption1 = rollForestRewards(levelData);
        rewardOption2 = rollForestRewards(levelData);
      }

      const nextLevel = currentLevel + 1;
      if (nextLevel > getAllForestLevels().length) {
        await markDungeonCompleted(currentUser.uid, 'forest');
        setCanInstantFinish(true);
      }
      setRewardSummary({
        options: [
          { updatedBoosts: rewardOption1.updatedBoosts, gainsByStat: rewardOption1.gainsByStat },
          { updatedBoosts: rewardOption2.updatedBoosts, gainsByStat: rewardOption2.gainsByStat }
        ],
        levelGain: allowedLevelGain,
        hasNextLevel: nextLevel <= getAllForestLevels().length,
        nextLevel
      });
      setGameState('reward');
    } else {
      logs.push(`💀 ${p.name} a été vaincu par ${b.name}...`);
      setCombatLog([...logs]);
      setCombatResult('defeat');
      setGameState('defeat');
    }

    setIsSimulating(false);
  };

  const handleForestChoice = (optionIndex) => {
    if (!rewardSummary || !rewardSummary.options?.[optionIndex]) return;
    const chosen = rewardSummary.options[optionIndex];
    const levelGain = rewardSummary.levelGain ?? 0;

    const updatedCharacter = {
      ...character,
      level: clampLevel((character.level ?? 1) + levelGain),
      forestBoosts: chosen.updatedBoosts
    };
    setCharacter(updatedCharacter);
    updateCharacterForestBoosts(currentUser.uid, chosen.updatedBoosts, updatedCharacter.level);

    if (rewardSummary.hasNextLevel) {
      const nextLevelData = getForestLevelByNumber(rewardSummary.nextLevel);
      const refreshedPlayer = prepareForCombat({
        ...updatedCharacter,
        equippedWeaponData: equippedWeapon,
        equippedWeaponId: equippedWeapon?.id || null
      });
      fullHealPlayer(refreshedPlayer);
      const nextBoss = createForestBossCombatant(nextLevelData.boss);
      if (nextBoss) {
        nextBoss.weaponState = initWeaponCombatState(nextBoss, null);
        nextBoss.stunned = false;
        nextBoss.stunnedTurns = 0;
      }
      setCurrentLevel(rewardSummary.nextLevel);
      setPlayer(refreshedPlayer);
      setBoss(nextBoss);
      setCombatLog([
        `⚔️ Niveau ${rewardSummary.nextLevel}: ${nextLevelData.nom} — ${refreshedPlayer.name} vs ${nextBoss.name} !`
      ]);
      setRewardSummary(null);
      setCombatResult(null);
      setGameState('fighting');
    } else {
      setRewardSummary(null);
      setGameState('victory');
    }
  };

  const handleBackToLobby = () => {
    stopForestMusic();
    setGameState('lobby');
    setCurrentLevel(1);
    setPlayer(null);
    setBoss(null);
    setCombatLog([]);
    setCombatResult(null);
    setCurrentAction(null);
    setRewardSummary(null);
  };

  const formatLogMessage = (text) => {
    if (!player || !boss) return text;

    const pName = player.name;
    const bName = boss.name;
    const parts = [];
    let key = 0;

    const processText = (str) => {
      const result = [];
      const nameRegex = new RegExp(`(${pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
      const nameParts = str.split(nameRegex);

      nameParts.forEach((part) => {
        if (part === pName) {
          result.push(<span key={`name-${key++}`} className="font-bold text-blue-400">{part}</span>);
        } else if (part === bName) {
          result.push(<span key={`name-${key++}`} className="font-bold text-purple-400">{part}</span>);
        } else if (part) {
          const numRegex = /(\d+)\s*(points?\s*de\s*(?:vie|dégâts?|dommages?))/gi;
          let lastIndex = 0;
          let match;
          const subParts = [];

          while ((match = numRegex.exec(part)) !== null) {
            if (match.index > lastIndex) {
              subParts.push(part.slice(lastIndex, match.index));
            }
            const isHeal = match[2].toLowerCase().includes('vie');
            const colorClass = isHeal ? 'font-bold text-green-400' : 'font-bold text-red-400';
            subParts.push(<span key={`num-${key++}`} className={colorClass}>{match[1]}</span>);
            subParts.push(` ${match[2]}`);
            lastIndex = match.index + match[0].length;
          }

          if (lastIndex < part.length) {
            subParts.push(part.slice(lastIndex));
          }

          if (subParts.length > 0) {
            result.push(...subParts);
          }
        }
      });

      return result;
    };

    return processText(text);
  };

  const BossCard = ({ bossChar }) => {
    if (!bossChar) return null;
    const hpPercent = (bossChar.currentHP / bossChar.maxHP) * 100;
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const levelData = getForestLevelByNumber(currentLevel);
    const bossImg = getBossImage(bossChar.imageFile);

    return (
      <div className="relative shadow-2xl overflow-visible">
        <div className={`absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 px-5 py-1.5 text-sm font-bold shadow-lg border border-stone-500 z-10 ${FOREST_DIFFICULTY_COLORS[levelData?.difficulte] || 'text-stone-200'}`}>
          Boss • {levelData?.difficulte || 'Forêt'}
        </div>
        <div className="overflow-visible">
          <div className="h-auto relative bg-stone-900 flex items-center justify-center">
            {bossImg ? (
              <img src={bossImg} alt={bossChar.name} className="w-full h-auto object-contain" />
            ) : (
              <div className="w-full h-48 flex items-center justify-center">
                <span className="text-7xl">{levelData?.boss?.icon || '🌲'}</span>
              </div>
            )}
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-3">
              <div className="text-white font-bold text-xl text-center">{bossChar.name}</div>
            </div>
          </div>
          <div className="bg-stone-800 p-4 border-t border-stone-600">
            <div className="mb-3">
              <div className="flex justify-between text-sm text-white mb-2">
                <span>HP: {bossChar.base.hp}</span>
                <span>VIT: {bossChar.base.spd}</span>
              </div>
              <div className="text-xs text-stone-400 mb-2">{bossChar.name} — PV {Math.max(0, bossChar.currentHP)}/{bossChar.maxHP}</div>
              <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600">
                <div className={`h-full transition-all duration-500 ${hpClass}`} style={{ width: `${hpPercent}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-stone-400">Auto: {bossChar.base.auto}</div>
              <div className="text-stone-400">DEF: {bossChar.base.def}</div>
              <div className="text-stone-400">CAP: {bossChar.base.cap}</div>
              <div className="text-stone-400">RESC: {bossChar.base.rescap}</div>
            </div>
            {bossChar.ability && (
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">⚡</span>
                <div className="flex-1">
                  <div className="text-amber-300 font-semibold mb-1">{bossChar.ability.name}</div>
                  <div className="text-stone-400 text-[10px]">{bossChar.ability.description}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <SoundControl />
        <audio id="forest-music" loop>
          <source src="/assets/music/forest.mp3" type="audio/mpeg" />
        </audio>
        <div className="text-amber-400 text-2xl">Chargement de la forêt...</div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <SoundControl />
        <audio id="forest-music" loop>
          <source src="/assets/music/forest.mp3" type="audio/mpeg" />
        </audio>
        <div className="text-red-400 text-2xl">Aucun personnage trouvé.</div>
      </div>
    );
  }

  const levels = getAllForestLevels();

  if (gameState === 'reward' && rewardSummary) {
    const labels = getStatLabels();
    const options = rewardSummary.options || [];

    const StatOptionCard = ({ option, index, onSelect }) => (
      <button
        onClick={() => onSelect(index)}
        className="flex-1 bg-stone-800 border border-stone-600 p-4 hover:border-amber-500 hover:bg-stone-700 transition-all cursor-pointer text-center"
      >
        <div className="text-2xl mb-2">🎲</div>
        <div className="text-amber-200 text-sm font-semibold mb-1">Option {index + 1}</div>
        <div className="flex flex-col gap-1">
          {Object.entries(option.gainsByStat).map(([stat, value]) => (
            <span key={stat} className="text-green-400 font-semibold text-sm">
              {labels[stat] || stat} +{value}
            </span>
          ))}
        </div>
      </button>
    );

    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Header />
        <SoundControl />
        <audio id="forest-music" loop>
          <source src="/assets/music/forest.mp3" type="audio/mpeg" />
        </audio>
        <div className="bg-stone-800 border border-amber-600 p-8 max-w-xl w-full text-center">
          <div className="text-6xl mb-4">🌲</div>
          <h2 className="text-3xl font-bold text-amber-400 mb-4">Victoire !</h2>
          <p className="text-stone-300 mb-2">Choisissez votre distribution de stats :</p>

          <div className="flex flex-col sm:flex-row gap-4 mb-6 mt-4">
            {options.map((option, i) => (
              <StatOptionCard key={i} option={option} index={i} onSelect={handleForestChoice} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'victory' || gameState === 'defeat') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <SoundControl />
        <audio id="forest-music" loop>
          <source src="/assets/music/forest.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <div className="text-8xl mb-6">{gameState === 'victory' ? '🏆' : '💀'}</div>
          <h2 className={`text-4xl font-bold mb-4 ${gameState === 'victory' ? 'text-amber-400' : 'text-red-400'}`}>
            {gameState === 'victory' ? 'Victoire totale !' : 'Défaite...'}
          </h2>
          <p className="text-gray-300 mb-8">
            {gameState === 'victory' ? 'La forêt vous renforce.' : 'Aucun gain cette fois-ci.'}
          </p>
          <button onClick={handleBackToLobby} className="bg-stone-100 hover:bg-white text-stone-900 px-8 py-4 font-bold border-2 border-stone-400">
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'fighting') {
    const currentLevelData = getForestLevelByNumber(currentLevel);
    return (
      <div className="min-h-screen p-6">
        <Header />
        <SoundControl />
        <audio id="forest-music" loop>
          <source src="/assets/music/forest.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-6xl mx-auto pt-20">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-stone-800 border border-stone-600 px-8 py-3">
              <h2 className="text-4xl font-bold text-stone-200">Forêt — Niveau {currentLevelData?.niveau}</h2>
            </div>
          </div>

          {/* Layout principal: Joueur | Chat | Boss (même que Donjon) */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
            <div className="order-1 md:order-1 w-full md:w-[340px] md:flex-shrink-0">
              <CharacterCardContent character={player} showHpBar />
            </div>

            <div className="order-2 md:order-2 w-full md:w-[600px] md:flex-shrink-0 flex flex-col">
              <div className="flex justify-center gap-3 md:gap-4 mb-4">
                {combatResult === null && (
                  <button
                    onClick={simulateCombat}
                    disabled={isSimulating || !player || !boss}
                    className="bg-stone-100 hover:bg-white disabled:bg-stone-600 disabled:text-stone-400 text-stone-900 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border-2 border-stone-400"
                  >
                    ▶️ Lancer le combat
                  </button>
                )}
                <button
                  onClick={handleBackToLobby}
                  className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border border-stone-500"
                >
                  ← Abandonner
                </button>
              </div>

              {combatResult === 'victory' && (
                <div className="flex justify-center mb-4">
                  <div className="bg-stone-100 text-stone-900 px-8 py-3 font-bold text-xl animate-pulse shadow-2xl border-2 border-stone-400">
                    🏆 {player.name} remporte le combat! 🏆
                  </div>
                </div>
              )}

              {combatResult === 'defeat' && (
                <div className="flex justify-center mb-4">
                  <div className="bg-red-900 text-red-200 px-8 py-3 font-bold text-xl shadow-2xl border-2 border-red-600">
                    💀 {player.name} a été vaincu... 💀
                  </div>
                </div>
              )}

              <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[480px] md:h-[600px]">
                <div className="bg-stone-900 p-3 border-b border-stone-600">
                  <h2 className="text-lg md:text-2xl font-bold text-stone-200 text-center">⚔️ Combat en direct</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
                  {combatLog.length === 0 ? (
                    <p className="text-stone-500 italic text-center py-6 md:py-8 text-xs md:text-sm">Cliquez sur "Lancer le combat" pour commencer...</p>
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
                                <div className="bg-stone-100 text-stone-900 px-6 py-3 font-bold text-lg shadow-lg border border-stone-400">
                                  {cleanLog}
                                </div>
                              </div>
                            );
                          }
                          if (log.includes('💀')) {
                            return (
                              <div key={idx} className="flex justify-center my-4">
                                <div className="bg-red-900 text-red-200 px-6 py-3 font-bold text-lg shadow-lg border border-red-600">
                                  {cleanLog}
                                </div>
                              </div>
                            );
                          }
                          if (log.includes('💚')) {
                            return (
                              <div key={idx} className="flex justify-center my-3">
                                <div className="bg-green-900/50 text-green-300 px-4 py-2 text-sm font-bold border border-green-600">
                                  {cleanLog}
                                </div>
                              </div>
                            );
                          }
                          if (log.includes('---') || log.includes('⚔️')) {
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
                              <div className="text-stone-400 text-sm italic">
                                {cleanLog}
                              </div>
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
                                <div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-r-4 border-purple-500">
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

            <div className="order-3 md:order-3 w-full md:w-[340px] md:flex-shrink-0">
              <BossCard bossChar={boss} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <Header />
      <SoundControl />
      <audio id="forest-music" loop>
        <source src="/assets/music/forest.mp3" type="audio/mpeg" />
      </audio>
      <div className="max-w-4xl mx-auto pt-20">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-stone-800 border border-stone-600 px-8 py-3">
              <h2 className="text-4xl font-bold text-stone-200">La Forêt</h2>
            </div>
          </div>

        <div className="bg-stone-800 border border-amber-600 p-4 mb-8 flex justify-between items-center">
          <div>
            <p className="text-amber-300 font-bold">Essais disponibles (cumulables)</p>
            <p className="text-white text-2xl">
              {dungeonSummary?.runsRemaining || 0}
            </p>
            <p className="text-stone-400 text-sm">+5 à minuit et +5 à midi</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Fin instantanée</p>
            <p className="text-amber-400 font-bold">
              {canInstantFinish ? 'Débloquée' : 'À débloquer'}
            </p>
          </div>
        </div>

        <div className="bg-stone-800 border border-stone-600 p-4 mb-8">
          <h3 className="text-xl font-bold text-amber-400 mb-4 text-center">3 niveaux progressifs</h3>
          <div className="grid grid-cols-3 gap-4">
            {levels.map((level) => (
              <div key={level.id} className="bg-stone-900/50 p-3 border border-stone-700 text-center">
                <div className="text-3xl mb-2">{level.boss.icon}</div>
                <p className="text-white font-bold">Niveau {level.niveau}</p>
                <p className={`text-sm ${FOREST_DIFFICULTY_COLORS[level.difficulte]}`}>
                  {level.difficulte}
                </p>
                <p className="text-xs mt-1 text-amber-200">
                  Gains: {level.rewardRolls} stats tirées
                </p>
              </div>
            ))}
          </div>
        </div>

        {instantMessage && (
          <div className="bg-emerald-900/40 border border-emerald-600 p-4 mb-6 text-center">
            <p className="text-emerald-300">{instantMessage}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-600 p-4 mb-6 text-center">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {(character?.level ?? 0) >= MAX_LEVEL && (
          <div className="bg-amber-900/40 border border-amber-600 p-4 mb-6 text-center">
            <p className="text-amber-200 font-semibold">Donjon bloqué : niveau maximum (400) atteint.</p>
            <p className="text-stone-400 text-sm mt-1">Aucun gain possible au-delà du niveau 400.</p>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button onClick={() => navigate('/dungeons')} className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 font-bold border border-stone-500">
            Retour
          </button>
          <button
            onClick={handleStartRun}
            disabled={!dungeonSummary?.runsRemaining || (character?.level ?? 0) >= MAX_LEVEL}
            className={`px-12 py-4 font-bold text-xl ${
              dungeonSummary?.runsRemaining > 0 && (character?.level ?? 0) < MAX_LEVEL
                ? 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-500'
                : 'bg-stone-700 text-stone-500 cursor-not-allowed border border-stone-600'
            }`}
          >
            {dungeonSummary?.runsRemaining > 0 && (character?.level ?? 0) < MAX_LEVEL ? 'Entrer dans la forêt' : (character?.level ?? 0) >= MAX_LEVEL ? 'Bloqué (niveau max)' : 'Plus de runs'}
          </button>
          {canInstantFinish && (
            <button
              onClick={handleInstantFinishRun}
              disabled={!dungeonSummary?.runsRemaining || (character?.level ?? 0) >= MAX_LEVEL}
              className={`px-8 py-4 font-bold border ${
                dungeonSummary?.runsRemaining > 0 && (character?.level ?? 0) < MAX_LEVEL
                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-500'
                  : 'bg-stone-700 text-stone-500 cursor-not-allowed border-stone-600'
              }`}
            >
              ⚡ Terminer instantanément
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForestDungeon;
