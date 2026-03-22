import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter, updateCharacterLevel } from '../services/characterService';
import {
  getPlayerDungeonSummary,
  startDungeonRun,
  endDungeonRun,
  handleLootChoice,
  markDungeonCompleted,
  generateLootPair
} from '../services/dungeonService';
import {
  getAllDungeonLevels,
  getDungeonLevelByNumber,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  DUNGEON_CONSTANTS
} from '../data/dungeons';
import {
  RARITY_COLORS,
  RARITY_BORDER_COLORS,
  RARITY_BG_COLORS
} from '../data/weapons';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import { isForgeActive } from '../data/featureFlags';
import { extractForgeUpgrade, computeForgeStatDelta, hasAnyForgeUpgrade } from '../data/forgeDungeon';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
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
  onTurnStart,
  getVerdictCapacityBonus,
  shouldSkipVerdictDemonFamiliar
} from '../utils/weaponEffects';
import { createBossCombatant, getBossById } from '../data/bosses';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { getRaceBonusText } from '../utils/descriptionBuilders';
import { getCalculatedClassDescription } from '../utils/calculatedClassDescription';
import {
  cooldowns,
  classConstants,
  getSubclassCapacityConstants,
  raceConstants,
  generalConstants,
  weaponConstants,
  dmgPhys,
  dmgCap,
  calcCritChance,
  getCritMultiplier,
  getSpeedDuelBonuses,
  getRaceBonus,
  getClassBonus
} from '../data/combatMechanics';
import { applyAwakeningToBase, buildAwakeningState, getAwakeningEffect, removeBaseRaceFlatBonusesIfAwakened } from '../utils/awakening';
import Header from './Header';
import UnifiedCharacterCard from './UnifiedCharacterCard';
import CharacterCardContent from './CharacterCardContent';
import { MiniCard } from './CombatLayout';
import { simulerMatch, tryTriggerOnctionLastStand } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { checkAndAwardTitles } from '../services/titleService';

// Chargement dynamique des images (ne crash pas si les fichiers n'existent pas)
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

const getForestBoosts = (character) => ({ ...getEmptyStatBoosts(), ...(character?.forestBoosts || {}) });
const getBaseWithBoosts = (character) => applyStatBoosts(character.base, getForestBoosts(character));

// Composant Tooltip (même que Combat.jsx)
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

const STAT_LABELS = {
  hp: 'HP',
  auto: 'Auto',
  def: 'Déf',
  cap: 'Cap',
  rescap: 'ResC',
  spd: 'VIT'
};

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
      {weapon.effet && typeof weapon.effet === 'object' ? (
        <span className="block text-amber-200">
          Effet: {weapon.effet.nom} — {weapon.effet.description}
        </span>
      ) : null}
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
    const bastionC = getSubclassCapacityConstants(playerChar.class, playerChar.subclass?.id);
    const startPct = bastionC.startShieldFromDef ?? classConstants.bastion.startShieldFromDef;
    const shieldValue = Math.max(1, Math.round(playerChar.base.def * startPct));
    playerChar.shield = (playerChar.shield || 0) + shieldValue;
    log.push(`${label} 🏰 Rempart initial: ${playerChar.name} gagne un bouclier de ${shieldValue} PV (${Math.round(startPct * 100)}% DEF).`);
  }

  bossChar.spectralMarked = false;
  bossChar.spectralMarkBonus = 0;
};

const Dungeon = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // États
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [dungeonSummary, setDungeonSummary] = useState(null);
  const [gameState, setGameState] = useState('lobby'); // lobby, fighting, victory, defeat, loot
  const [currentLevel, setCurrentLevel] = useState(1);
  const [highestLevelBeaten, setHighestLevelBeaten] = useState(0);
  const [lootWeapons, setLootWeapons] = useState([null, null, null]);
  const [error, setError] = useState(null);
  const [instantMessage, setInstantMessage] = useState(null);

  // États de combat (même pattern que Combat.jsx)
  const [player, setPlayer] = useState(null);
  const [boss, setBoss] = useState(null);
  const [playerCombatBase, setPlayerCombatBase] = useState(null);
  const [bossCombatBase, setBossCombatBase] = useState(null);
  const [playerCombatModifiers, setPlayerCombatModifiers] = useState(null);
  const [playerCombatStatus, setPlayerCombatStatus] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [currentAction, setCurrentAction] = useState(null);
  const logEndRef = useRef(null);
  const logContainerRef = useRef(null);
  const lastAutoStartLevelRef = useRef(null);
  const combatStartLockRef = useRef(false);
  const ensureDungeonMusic = () => {
    const dungeonMusic = document.getElementById('dungeon-music');
    if (dungeonMusic && dungeonMusic.paused) {
      dungeonMusic.play().catch(error => console.log('Autoplay bloqué:', error));
    }
  };

  const stopDungeonMusic = () => {
    const dungeonMusic = document.getElementById('dungeon-music');
    if (dungeonMusic) {
      dungeonMusic.pause();
      dungeonMusic.currentTime = 0;
    }
  };

  useEffect(() => {
    if (gameState === 'fighting') {
      ensureDungeonMusic();
    }
  }, [gameState]);

  // Mobile: certains layouts masquent le bouton, on lance le combat automatiquement.
  useEffect(() => {
    if (gameState !== 'fighting') {
      lastAutoStartLevelRef.current = null;
      return;
    }

    if (typeof window === 'undefined' || !window.matchMedia) return;
    const isPhone = window.matchMedia('(max-width: 767px)').matches;
    if (!isPhone) return;
    if (!player || !boss) return;
    if (isSimulating) return;
    if (combatResult !== null) return;
    if (lastAutoStartLevelRef.current === currentLevel) return;

    lastAutoStartLevelRef.current = currentLevel;
    void simulateCombat();
  }, [gameState, player, boss, combatResult, isSimulating, currentLevel]);

  const shouldAutoScrollLog = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(min-width: 768px)').matches;
  };

  useEffect(() => {
    if (!shouldAutoScrollLog()) return;
    logContainerRef.current?.scrollTo({ top: logContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [combatLog]);

  // Charger les données au montage
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
        setCharacter({
          ...charResult.data,
          level
        });

        const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
        if (summaryResult.success) {
          setDungeonSummary(summaryResult.data);
          setCharacter(prev => prev ? {
            ...prev,
            equippedWeaponData: summaryResult.data.equippedWeaponData,
            equippedWeaponId: summaryResult.data.equippedWeaponData?.id || null
          } : prev);
        }
      } catch (err) {
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, navigate]);


  const getCalculatedDescription = getCalculatedClassDescription;

  // Préparer un personnage pour le combat
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
      _storedBase: { ...char.base },
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
      onctionLastStandUsed: false,
      weaponState,
      awakening: buildAwakeningState(awakeningEffect)
    };
  };

  // Full heal du joueur (entre les boss)
  const fullHealPlayer = (p) => {
    p.currentHP = p.maxHP;
    p.undead = false;
    p.dodge = false;
    p.reflect = false;
    p.bleed_stacks = 0;
    p.bleedPercentPerStack = 0;
    p.maso_taken = 0;
    p.familiarStacks = 0;
    p.shield = 0;
    p.spectralMarked = false;
    p.spectralMarkBonus = 0;
    p.firstCapacityCapBoostUsed = false;
    p.stunned = false;
    p.stunnedTurns = 0;
    if (p.awakening) {
      p.awakening.incomingHitCountRemaining = p.awakening.incomingHitCount ?? 0;
      p.awakening.damageTakenStacks = 0;
    }
    p.cd = { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 };
    if (p.weaponState?.counters) {
      p.weaponState.counters.turnCount = 0;
      p.weaponState.counters.attackCount = 0;
      p.weaponState.counters.capacityCount = 0;
      p.weaponState.counters.firstHitDone = false;
      p.weaponState.counters.gungnirApplied = false;
    }
  };

  // Fonction de résurrection mort-vivant
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
      tryTriggerOnctionLastStand(attacker, log, playerColor);
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

  // Traiter l'action d'un combattant (joueur ou boss)
  // Utilise [P1]/[P2] comme Combat.jsx (P1 = joueur, P2 = boss)
  const processPlayerAction = (att, def, log, isPlayer, bossAbilityCooldown, turn) => {
    if (att.currentHP <= 0 || def.currentHP <= 0) return bossAbilityCooldown;

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

    const applyMageTowerDamage = (raw, isCrit, applyOnHitPassives = true, isCapacityDamage = false) => {
      let adjusted = applyOutgoingAwakeningBonus(att, raw);

      if (isPlayer && playerPassive?.id === 'onction_eternite' && playerPassive?.levelData?.outgoingDamageMultiplier != null && att.onctionLastStandUsed) {
        adjusted = Math.max(1, Math.round(adjusted * playerPassive.levelData.outgoingDamageMultiplier));
      }

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
        tryTriggerOnctionLastStand(def, log, playerColor);
        def.maso_taken = (def.maso_taken || 0) + adjusted;
        if (def.awakening?.damageStackBonus) {
          def.awakening.damageTakenStacks += 1;
        }

        if (isCapacityDamage && def.class === 'Briseur de Sort') {
          const shield = Math.max(1, Math.round(adjusted * classConstants.briseurSort.shieldFromSpellDamage + def.base.cap * classConstants.briseurSort.shieldFromCap));
          def.shield = (def.shield || 0) + shield;
          log.push(`${playerColor} 🧱 ${def.name} convertit la capacité en bouclier (+${shield}).`);
        }

        if (def.reflect && def.currentHP > 0) {
          let back = Math.round(def.reflect * adjusted);
          if (def.riposteVerdictMultiplier) {
            back = Math.round(back * def.riposteVerdictMultiplier);
          }
          att.currentHP -= back;
          tryTriggerOnctionLastStand(att, log, playerColor);
          log.push(`${playerColor} 🔁 ${def.name} riposte et renvoie ${back} points de dégâts à ${att.name}`);
          if (back > 0 && att.class === 'Briseur de Sort') {
            const shield = Math.max(1, Math.round(back * classConstants.briseurSort.shieldFromSpellDamage + att.base.cap * classConstants.briseurSort.shieldFromCap));
            att.shield = (att.shield || 0) + shield;
            log.push(`${playerColor} 🧱 ${att.name} convertit la capacité en bouclier (+${shield}).`);
          }
          if (def.riposteTwice && back > 0) {
            att.currentHP -= back;
            tryTriggerOnctionLastStand(att, log, playerColor);
            log.push(`${playerColor} 📜 Codex Archon : ${def.name} riposte et renvoie ${back} points de dégâts à ${att.name}`);
            if (att.class === 'Briseur de Sort') {
              const shield2 = Math.max(1, Math.round(back * classConstants.briseurSort.shieldFromSpellDamage + att.base.cap * classConstants.briseurSort.shieldFromCap));
              att.shield = (att.shield || 0) + shield2;
              log.push(`${playerColor} 🧱 ${att.name} convertit la capacité en bouclier (+${shield2}).`);
            }
          }
          def.reflect = false;
          def.riposteTwice = false;
          def.riposteVerdictMultiplier = undefined;
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
      return bossAbilityCooldown;
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

    // Passif Sylvari (regen)
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

    // Passif Demoniste (familier) — Arbalète du Verdict : 1ère attaque tour 2, 2e tour 4 (+100% dégâts)
    if (att.class === 'Demoniste' && !shouldSkipVerdictDemonFamiliar(att.weaponState, turn)) {
      if (isPlayer) skillUsed = true; // Familier = capacité → Furie élémentaire
      const demonC = getSubclassCapacityConstants(att.class, att.subclass?.id);
      const capBase = demonC.capBase ?? classConstants.demoniste.capBase;
      const capPerCap = demonC.capPerCap ?? classConstants.demoniste.capPerCap;
      const ignoreResist = demonC.ignoreResist ?? classConstants.demoniste.ignoreResist;
      const stackPerAuto = demonC.stackPerAuto ?? classConstants.demoniste.stackPerAuto;
      const stackBonus = stackPerAuto * (att.familiarStacks || 0);
      const hit = Math.max(1, Math.round((capBase + capPerCap * att.base.cap + stackBonus) * att.base.cap));
      let raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
      raw = Math.round(raw * consumeWeaponDamageBonus());
      const verdictBonusDem = getVerdictCapacityBonus(att.weaponState);
      if (verdictBonusDem.damageMultiplier !== 1) {
        raw = Math.round(raw * verdictBonusDem.damageMultiplier);
        verdictBonusDem.log.forEach((l) => log.push(`${playerColor} ${l}`));
      }
      const inflicted = applyMageTowerDamage(raw, false, true, true);
      log.push(`${playerColor} 💠 Le familier de ${att.name} attaque ${def.name} et inflige ${inflicted} points de dégâts`);
      const demonSpellEffects = onCapacityCast(att.weaponState, att, def, raw, 'demoniste');
      if (demonSpellEffects.doubleCast && demonSpellEffects.secondCastDamage > 0) {
        const inflictedCodex = applyMageTowerDamage(demonSpellEffects.secondCastDamage, false, false);
        log.push(`${playerColor} 📜 Codex Archon : Le familier de ${att.name} attaque ${def.name} et inflige ${inflictedCodex} points de dégâts`);
      }
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def, att, log, playerColor);
      }
    }

    // Capacité Masochiste
    if (att.class === 'Masochiste') {
      if (att.cd.maso === cooldowns.maso && att.maso_taken > 0) {
        if (isPlayer) skillUsed = true;
        const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
        let dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerCap * att.base.cap)));
        let healAmount = Math.max(1, Math.round(att.maso_taken * healPercent * getAntiHealFactor(def)));
        const verdictBonusMaso = getVerdictCapacityBonus(att.weaponState);
        if (verdictBonusMaso.damageMultiplier !== 1 || verdictBonusMaso.healMultiplier !== 1) {
          healAmount = Math.max(1, Math.round(healAmount * verdictBonusMaso.healMultiplier));
          dmg = Math.round(dmg * (verdictBonusMaso.damageMultiplier !== 1 ? verdictBonusMaso.damageMultiplier : 1));
          verdictBonusMaso.log.forEach((l) => log.push(`${playerColor} ${l}`));
        }
        att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
        const masoHealEffects = onHeal(att.weaponState, att, healAmount, def);
        if (masoHealEffects.bonusDamage > 0) {
          const bonusDmg = dmgCap(masoHealEffects.bonusDamage, def.base.rescap);
          applyMageTowerDamage(bonusDmg, false, true, true);
          log.push(`${playerColor} ${masoHealEffects.log.join(' ')}`);
        }
        att.maso_taken = 0;
        dmg = Math.round(dmg * consumeWeaponDamageBonus());
        const inflicted = applyMageTowerDamage(dmg, false);
        const masoSpellEffects = onCapacityCast(att.weaponState, att, def, dmg, 'maso', { healAmount });
        log.push(`${playerColor} 🩸 ${att.name} renvoie les dégâts accumulés: inflige ${inflicted} points de dégâts et récupère ${healAmount} points de vie`);
        if (masoSpellEffects.doubleCast && (masoSpellEffects.secondCastDamage > 0 || masoSpellEffects.secondCastHeal > 0)) {
          const inflicted2 = masoSpellEffects.secondCastDamage > 0
            ? applyMageTowerDamage(masoSpellEffects.secondCastDamage, false, false)
            : 0;
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

    // Saignement
    if (att.bleed_stacks > 0) {
      let bleedDmg = att.bleedPercentPerStack
        ? Math.max(1, Math.round(att.maxHP * att.bleedPercentPerStack * att.bleed_stacks))
        : Math.ceil(att.bleed_stacks / raceConstants.lycan.bleedDivisor);
      if (att.awakening?.damageTakenMultiplier) {
        bleedDmg = Math.max(1, Math.round(bleedDmg * att.awakening.damageTakenMultiplier));
      }
      att.currentHP -= bleedDmg;
      tryTriggerOnctionLastStand(att, log, playerColor);
      log.push(`${playerColor} 🩸 ${att.name} saigne abondamment et perd ${bleedDmg} points de vie`);
      if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
        reviveUndead(att, def, log, playerColor);
      }
    }

    // Capacité Paladin (riposte)
    if (att.class === 'Paladin' && att.cd.pal === cooldowns.pal) {
      if (isPlayer) skillUsed = true;
      const { reflectBase, reflectPerCap } = classConstants.paladin;
      const spellCapMult = consumeAuraCapacityCapMultiplier();
      const reflectValue = reflectBase + reflectPerCap * att.base.cap * spellCapMult;
      att.reflect = reflectValue;
      const verdictBonusPal = getVerdictCapacityBonus(att.weaponState);
      if (verdictBonusPal.damageMultiplier !== 1) {
        att.riposteVerdictMultiplier = verdictBonusPal.damageMultiplier;
        verdictBonusPal.log.forEach((l) => log.push(`${playerColor} ${l}`));
      }
      const paladinSpellEffects = onCapacityCast(att.weaponState, att, def, reflectValue, 'paladin');
      if (paladinSpellEffects.doubleCast && paladinSpellEffects.riposteTwice) {
        att.riposteTwice = true;
        log.push(`${playerColor} 📜 Codex Archon : ${att.name} se prépare à riposter et renverra deux fois les dégâts`);
      }
      log.push(`${playerColor} 🛡️ ${att.name} se prépare à riposter et renverra ${Math.round(att.reflect * 100)}% des dégâts`);
    }

    // Capacité Healer
    if (att.class === 'Healer' && att.cd.heal === cooldowns.heal) {
      if (isPlayer) skillUsed = true;
      const miss = att.maxHP - att.currentHP;
      const { missingHpPercent, capScale } = classConstants.healer;
      const spellCapMultiplier = consumeAuraCapacityCapMultiplier();
      let baseHeal = Math.max(1, Math.round(missingHpPercent * miss + capScale * att.base.cap * spellCapMultiplier * getAntiHealFactor(def)));
      const verdictBonusHeal = getVerdictCapacityBonus(att.weaponState);
      if (verdictBonusHeal.healMultiplier !== 1) {
        baseHeal = Math.max(1, Math.round(baseHeal * verdictBonusHeal.healMultiplier));
        verdictBonusHeal.log.forEach((l) => log.push(`${playerColor} ${l}`));
      }
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
        const bonusDmg = dmgCap(healEffects.bonusDamage, def.base.rescap);
        applyMageTowerDamage(bonusDmg, false);
        log.push(`${playerColor} ${healEffects.log.join(' ')}`);
      }
    }

    // Capacité Voleur (esquive)
    if (att.class === 'Voleur' && att.cd.rog === cooldowns.rog) {
      if (isPlayer) skillUsed = true;
      consumeAuraCapacityCapMultiplier(); // Première capacité du combat
      att.dodge = true;
      log.push(`${playerColor} 🌀 ${att.name} entre dans une posture d'esquive et évitera la prochaine attaque`);
    }

    // ===== CAPACITÉS SPÉCIALES DES BOSS =====
    let newBossCooldown = bossAbilityCooldown;
    if (!isPlayer && att.ability) {
      newBossCooldown++;

      // Bandit: Saignement tous les 2 tours
      if (att.bossId === 'bandit' && newBossCooldown >= att.ability.cooldown) {
        def.bleed_stacks = (def.bleed_stacks || 0) + 1;
        log.push(`${playerColor} 🗡️ ${att.name} empoisonne sa lame et applique un saignement !`);
        newBossCooldown = 0;
      }

      // Dragon: Sort +50% dégâts tous les 5 tours
      if (att.bossId === 'dragon' && newBossCooldown >= att.ability.cooldown) {
        const spellDmg = Math.round(att.base.cap * 1.5);
        const raw = dmgCap(spellDmg, def.base.rescap);
        const inflicted = applyMageTowerDamage(raw, false, true, true);
        log.push(`${playerColor} 🔥 ${att.name} lance un Souffle de Flammes dévastateur et inflige ${inflicted} points de dégâts`);
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, att, log, playerColor);
        }
        newBossCooldown = 0;
      }
    }

    // Déterminer le type d'attaque
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

    const baseHits = isArcher ? classConstants.archer.hitCount : 1;
    const totalHits = baseHits + (turnEffects.bonusAttacks || 0);
    let total = 0;
    let wasCrit = false;

    const forceCrit = isPlayer
      && playerPassive?.id === 'obsidian_skin'
      && att.currentHP <= att.maxHP * playerPassive.levelData.critThreshold;

    for (let i = 0; i < totalHits; i++) {
      const isBonusAttack = i >= baseHits;
      const isCrit = turnEffects.guaranteedCrit ? true : forceCrit ? true : Math.random() < calcCritChance(att, def);
      if (isCrit) wasCrit = true;
      let raw = 0;
      const weaponBonus = i === 0 ? consumeWeaponDamageBonus() : 1;
      const attackMultiplier = mult * weaponBonus * (isBonusAttack ? (turnEffects.bonusAttackDamage || 1) : 1);

      if (isMage) {
        const { capBase, capPerCap } = classConstants.mage;
        const spellCapMultiplier = consumeAuraCapacityCapMultiplier();
        const scaledCap = att.base.cap * spellCapMultiplier;
        const atkSpell = Math.round(att.base.auto * attackMultiplier + (capBase + capPerCap * scaledCap) * scaledCap * attackMultiplier);
        raw = dmgCap(atkSpell, def.base.rescap);
        const verdictMage = getVerdictCapacityBonus(att.weaponState);
        if (verdictMage.damageMultiplier !== 1) {
          raw = Math.round(raw * verdictMage.damageMultiplier);
          verdictMage.log.forEach((l) => log.push(`${playerColor} ${l}`));
        }
        if (i === 0) log.push(`${playerColor} 🔮 ${att.name} utilise sa capacité magique`);
        const spellEffects = onCapacityCast(att.weaponState, att, def, raw, 'mage');
        if (spellEffects.doubleCast && spellEffects.secondCastDamage > 0) {
          const inflictedCodex = applyMageTowerDamage(spellEffects.secondCastDamage, false, false);
          log.push(`${playerColor} 📜 Codex Archon : ${att.name} utilise sa capacité magique et inflige ${inflictedCodex} points de dégâts`);
        }
      } else if (isWar) {
        const { ignoreBase, ignorePerCap } = classConstants.guerrier;
        const spellCapMultWar = consumeAuraCapacityCapMultiplier();
        const ignore = ignoreBase + ignorePerCap * att.base.cap * spellCapMultWar;
        if (def.base.def <= def.base.rescap) {
          const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
          raw = dmgPhys(Math.round(att.base.auto * attackMultiplier), effDef);
        } else {
          const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
          raw = dmgCap(Math.round(att.base.cap * attackMultiplier), effRes);
        }
        if (i === 0) {
          const verdictWar = getVerdictCapacityBonus(att.weaponState);
          if (verdictWar.damageMultiplier !== 1) {
            raw = Math.round(raw * verdictWar.damageMultiplier);
            verdictWar.log.forEach((l) => log.push(`${playerColor} ${l}`));
          }
          log.push(`${playerColor} 🗡️ ${att.name} exécute une frappe pénétrante`);
          const warSpellEffects = onCapacityCast(att.weaponState, att, def, raw, 'war');
          if (warSpellEffects.doubleCast && warSpellEffects.secondCastDamage > 0) {
            const inflictedCodex = applyMageTowerDamage(warSpellEffects.secondCastDamage, false, false);
            log.push(`${playerColor} 📜 Codex Archon : ${att.name} exécute une frappe pénétrante et inflige ${inflictedCodex} points de dégâts`);
          }
        }
      } else if (isArcher && !isBonusAttack) {
        if (i === 0) {
          raw = dmgPhys(Math.round(att.base.auto * attackMultiplier), def.base.def);
          const verdictArc = getVerdictCapacityBonus(att.weaponState);
          if (verdictArc.damageMultiplier !== 1) {
            raw = Math.round(raw * verdictArc.damageMultiplier);
            verdictArc.log.forEach((l) => log.push(`${playerColor} ${l}`));
          }
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
            const inflictedCodex = applyMageTowerDamage(arcSpellEffects.secondCastDamage, false, false);
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
          } else {
            def.bleedPercentPerStack = raceConstants.lycan.bleedPercentPerStack;
          }
        }
      }

      if (isCrit) {
        const critDamage = Math.round(raw * getCritMultiplier(att));
        raw = modifyCritDamage(att.weaponState, critDamage);
      }

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

    return newBossCooldown;
  };

  // Démarrer une run
  const handleStartRun = async () => {
    setError(null);
    setInstantMessage(null);
    const result = await startDungeonRun(currentUser.uid);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setGameState('fighting');
    setCurrentLevel(1);
    setHighestLevelBeaten(0);
    setCombatResult(null);
    setCurrentAction(null);
    ensureDungeonMusic();

    // Préparer le premier combat
    const levelData = getDungeonLevelByNumber(1);
    const playerReady = prepareForCombat(character);
    const bossReady = createBossCombatant(levelData.bossId);
    if (bossReady) {
      bossReady.weaponState = initWeaponCombatState(bossReady, null);
      bossReady.stunned = false;
      bossReady.stunnedTurns = 0;
    }

    setPlayer(playerReady);
    setBoss(bossReady);
    setPlayerCombatBase(null);
    setBossCombatBase(null);
    setPlayerCombatModifiers(null);
    setPlayerCombatStatus(null);
    setCombatLog([`⚔️ Niveau 1: ${levelData.nom} — ${playerReady.name} vs ${bossReady.name} !`]);
  };

  const handleInstantFinishRun = async () => {
    setError(null);
    setInstantMessage(null);

    const startResult = await startDungeonRun(currentUser.uid);
    if (!startResult.success) {
      setError(startResult.error);
      return;
    }

    const endResult = await endDungeonRun(currentUser.uid, DUNGEON_CONSTANTS.TOTAL_LEVELS);
    if (!endResult.success || !endResult.lootWeapons?.[0]) {
      setError(endResult.error || 'Impossible de terminer instantanément cette run.');
      return;
    }

    await markDungeonCompleted(currentUser.uid, 'cave');

    setLootWeapons(endResult.lootWeapons);

    setGameState('loot');
  };

  // Lancer le combat (timing identique à Combat.jsx)
  // On passe le personnage BRUT (character) à simulerMatch pour éviter double préparation (forêt/arme appliquées 2x)
  const simulateCombat = async () => {
    if (!player || !boss || !character) return;
    if (combatStartLockRef.current) return;
    combatStartLockRef.current = true;
    setIsSimulating(true);
    setCombatResult(null);
    setPlayerCombatBase(null);
    setBossCombatBase(null);
    setPlayerCombatModifiers(null);
    setPlayerCombatStatus(null);
    ensureDungeonMusic();

    const b = { ...boss };
    const logs = [...combatLog, `--- Combat contre ${b.name} ---`];

    const matchResult = simulerMatch(character, b);
    checkAndAwardTitles(currentUser.uid, matchResult.steps, matchResult, character, { mode: 'donjon', bossId: getDungeonLevelByNumber(currentLevel).bossId });

    // Replay animé des steps : mettre à jour l'état affiché depuis les steps (pas de mutation du perso)
    const finalLogs = await replayCombatSteps(matchResult.steps, {
      setCombatLog,
      onStepHP: (step) => {
        setPlayerCombatBase(step.p1Base ?? undefined);
        setBossCombatBase(step.p2Base ?? undefined);
        setPlayerCombatModifiers(step.p1Modifiers ?? null);
        setPlayerCombatStatus(step.p1Status ?? null);
        setPlayer((prev) => prev ? { ...prev, currentHP: step.p1HP, shield: step.p1Shield || 0 } : null);
        setBoss((prev) => prev ? { ...prev, currentHP: step.p2HP, shield: step.p2Shield || 0 } : null);
      },
      existingLogs: logs,
      speed: 'fast'
    });
    logs.length = 0;
    logs.push(...finalLogs);
    const lastStep = matchResult.steps[matchResult.steps.length - 1];
    const playerWon = lastStep && lastStep.p1HP > 0;
    // Résultat du combat
    if (playerWon) {
      logs.push(`🏆 ${player.name} remporte glorieusement le combat contre ${b.name} !`);
      setCombatLog([...logs]);
      setCombatResult('victory');

      const newHighest = currentLevel;
      setHighestLevelBeaten(newHighest);

      if (currentLevel < DUNGEON_CONSTANTS.TOTAL_LEVELS) {
        // Full heal avant le prochain boss
        await new Promise(r => setTimeout(r, 1500));
        setPlayer((prev) => prev ? { ...prev, currentHP: prev.maxHP, undead: false } : null);
        logs.push(``, `💚 ${player.name} récupère tous ses points de vie !`);

        const nextLevel = currentLevel + 1;
        setCurrentLevel(nextLevel);

        const nextLevelData = getDungeonLevelByNumber(nextLevel);
      const nextBoss = createBossCombatant(nextLevelData.bossId);
      if (nextBoss) {
        nextBoss.weaponState = initWeaponCombatState(nextBoss, null);
        nextBoss.stunned = false;
        nextBoss.stunnedTurns = 0;
      }

        setBoss(nextBoss);
        setCombatLog([...logs, ``, `⚔️ Niveau ${nextLevel}: ${nextLevelData.nom} — ${player.name} vs ${nextBoss.name} !`]);
        setCombatResult(null);
      } else {
        // Full clear!
        stopDungeonMusic();
        await new Promise(r => setTimeout(r, 1500));
        const result = await endDungeonRun(currentUser.uid, newHighest);
        if (result.success) {
          await markDungeonCompleted(currentUser.uid, 'cave');
        }
        if (result.success && result.lootWeapons?.[0]) {
          setLootWeapons(result.lootWeapons);
          setGameState('loot');
        } else {
          setGameState('victory');
        }
      }
    } else {
      logs.push(`💀 ${player.name} a été vaincu par ${b.name}...`);
      setCombatLog([...logs]);
      setCombatResult('defeat');

      stopDungeonMusic();
      await new Promise(r => setTimeout(r, 1500));
      const result = await endDungeonRun(currentUser.uid, highestLevelBeaten, currentLevel);
      if (result.success && result.lootWeapons?.[0]) {
        setLootWeapons(result.lootWeapons);
        setGameState('loot');
      } else {
        setGameState('defeat');
      }
    }

    setIsSimulating(false);
    combatStartLockRef.current = false;
  };

  // Gérer le choix du loot (le joueur choisit une des 2 armes)
  const handleLootDecision = async (chosenWeapon) => {
    if (chosenWeapon) {
      await handleLootChoice(currentUser.uid, chosenWeapon.id, true);
    }

    const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
    if (summaryResult.success) {
      setDungeonSummary(summaryResult.data);
    }

    setLootWeapons([null, null, null]);

    setGameState('lobby');
  };

  // Retour au lobby
  const handleBackToLobby = async () => {
    const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
    if (summaryResult.success) {
      setDungeonSummary(summaryResult.data);
    }
    stopDungeonMusic();
    setGameState('lobby');
    setCurrentLevel(1);
    setHighestLevelBeaten(0);
    setPlayer(null);
    setBoss(null);
    setCombatLog([]);
    setCombatResult(null);
    setCurrentAction(null);

  };

  // Formater les messages du log avec les couleurs (même style que Combat.jsx)
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

  // ============================================================================
  // COMPOSANT CARTE BOSS (même carte que les personnages)
  // ============================================================================
  const BossCard = ({ bossChar, combatBaseOverride: bossCombatBaseOverride }) => {
    if (!bossChar) return null;

    const base = bossCombatBaseOverride ?? bossChar.base;
    const safeMaxHP = bossChar.maxHP || base.hp || 1;
    const safeCurrentHP = Math.max(0, Math.min(safeMaxHP, bossChar.currentHP));
    const hpPercent = (safeCurrentHP / safeMaxHP) * 100;
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const shieldPercent = safeMaxHP > 0 ? Math.min(100, ((bossChar.shield || 0) / safeMaxHP) * 100) : 0;

    const bossData = getBossById(bossChar.bossId);
    const bossImg = getBossImage(bossChar.imageFile);
    const currentLvlData = getDungeonLevelByNumber(currentLevel);
    const difficultyLabel = DIFFICULTY_LABELS[currentLvlData?.difficulte] || 'Donjon';
    const difficultyColor = DIFFICULTY_COLORS[currentLvlData?.difficulte] || '';

    return (
      <UnifiedCharacterCard
        header={`Boss • ${difficultyLabel}`}
        name={bossChar.name}
        image={bossImg}
        fallback={<span className="text-7xl">{bossData?.icon || '👹'}</span>}
        topStats={(
          <>
            <span>HP: {base.hp}</span>
            <span>VIT: {base.spd}</span>
          </>
        )}
        hpText={`${bossChar.name} — PV ${safeCurrentHP}/${safeMaxHP}`}
        hpPercent={hpPercent}
        hpClass={hpClass}
        shieldPercent={shieldPercent}
        mainStats={(
          <>
            <div>Auto: {base.auto}</div>
            <div>Déf: {base.def}</div>
            <div>Cap: {base.cap}</div>
            <div>ResC: {base.rescap}</div>
          </>
        )}
        details={bossChar.ability ? (
          <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
            <span className="text-lg">⚡</span>
            <div className="flex-1">
              <div className="text-amber-300 font-semibold mb-1">{bossChar.ability.nom}</div>
              <div className="text-stone-400 text-[10px]">{bossChar.ability.description}</div>
            </div>
          </div>
        ) : null}
        cardClassName={`border-2 border-stone-600 ${difficultyColor}`.trim()}
      />
    );
  };

  // ============================================================================
  // RENDUS
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />

        <div className="text-amber-400 text-2xl">Chargement du donjon...</div>
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

  const levels = getAllDungeonLevels();
  const currentLevelData = getDungeonLevelByNumber(currentLevel);

  // ============================================================================
  // ÉCRAN DE LOOT (choix entre 2 armes)
  // ============================================================================
  if (gameState === 'loot' && lootWeapons[0]) {
    const hasCurrentWeapon = dungeonSummary?.equippedWeaponData;
    const getOpaqueRarityBg = (rarity) => (RARITY_BG_COLORS[rarity] || '').replace('/50', '');

    const WeaponCard = ({ weapon, onSelect }) => (
      <button
        onClick={() => onSelect(weapon)}
        className={`flex-1 p-6 border-2 ${RARITY_BORDER_COLORS[weapon.rarete]} bg-stone-950/85 hover:bg-stone-800/90 rounded-xl transition-all cursor-pointer text-center shadow-lg hover:shadow-xl hover:scale-[1.02]`}
      >
        {getWeaponImage(weapon.imageFile) ? (
          <img src={getWeaponImage(weapon.imageFile)} alt={weapon.nom} className="w-24 h-auto mx-auto mb-4" />
        ) : (
          <div className="text-5xl mb-4">{weapon.icon}</div>
        )}
        <h3 className={`text-xl font-bold ${RARITY_COLORS[weapon.rarete]}`}>{weapon.nom}</h3>
        <p className={`text-xs uppercase font-bold tracking-wider ${RARITY_COLORS[weapon.rarete]}`}>{weapon.rarete}</p>
        <p className="text-stone-400 text-xs mt-3 leading-relaxed">{weapon.description}</p>

        <div className="mt-4 flex justify-center gap-2 flex-wrap">
          {Object.entries(weapon.stats).filter(([, value]) => value !== 0).map(([stat, value]) => (
            <div key={stat} className="bg-stone-800/80 px-2.5 py-1 rounded border border-stone-600">
              <span className="text-stone-400 text-xs">{STAT_LABELS[stat] || stat.toUpperCase()}</span>
              <span className={`ml-1 font-bold text-sm ${value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {value > 0 ? '+' : ''}{value}
              </span>
            </div>
          ))}
        </div>

        {weapon.effet && typeof weapon.effet === 'object' ? (
          <div className="mt-4 bg-amber-950 border border-amber-700 rounded-lg p-3">
            <p className="text-amber-300 font-bold text-sm">{weapon.effet.nom}</p>
            <p className="text-amber-200/80 text-xs mt-1">{weapon.effet.description}</p>
          </div>
        ) : null}
      </button>
    );

    return (
      <div className="min-h-screen p-6">
        <Header />

        <audio id="dungeon-music" loop>
          <source src="/assets/music/grotte.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-5xl mx-auto pt-20 sm:pt-16">
          {/* Carte du personnage */}
          <div className="flex justify-center mb-8">
            <CharacterCardContent character={character} detailsPlacement="right" />
          </div>

          <div className="text-center mb-6">
            <div className="inline-block bg-stone-950/85 border border-stone-700/80 rounded-lg px-5 py-2 shadow-lg">
              <p className="text-amber-300 font-bold text-sm tracking-wide">Choisissez une arme</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-5 mb-8 max-w-6xl mx-auto">
            {lootWeapons.filter(Boolean).map((weapon, idx) => (
              <WeaponCard key={weapon.id || idx} weapon={weapon} onSelect={handleLootDecision} />
            ))}
          </div>

          <div className="text-center mb-8">
            <button
              onClick={() => handleLootDecision(null)}
              className="bg-stone-700 hover:bg-stone-600 text-stone-100 border border-stone-500 rounded-lg px-6 py-3 font-semibold transition"
            >
              Garder mon arme actuelle
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ÉCRAN DE COMBAT (même UI que Combat.jsx)
  // ============================================================================
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

        <audio id="dungeon-music" loop>
          <source src="/assets/music/grotte.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-[1800px] mx-auto pt-20 sm:pt-14">
          {/* Indicateur de progression */}
          <div className="flex justify-center items-center gap-4 mb-4">
            {levels.map((level, idx) => (
              <div key={level.id} className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 text-sm font-bold ${
                  idx + 1 < currentLevel ? 'bg-green-600 border-green-400 text-white' :
                  idx + 1 === currentLevel ? 'bg-amber-600 border-amber-400 text-white' :
                  'bg-stone-800 border-stone-600 text-stone-500'
                }`}>
                  {idx + 1 < currentLevel ? '✓' : level.niveau}
                </div>
                {idx < levels.length - 1 && (
                  <div className={`w-8 h-0.5 ${idx + 1 < currentLevel ? 'bg-green-500' : 'bg-stone-600'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Boutons de contrôle (centrés par rapport à l'ensemble) */}
          <div className="flex justify-center gap-3 md:gap-4 mb-3">
            {combatResult === null && (
              <button
                onClick={simulateCombat}
                disabled={isSimulating}
                className="bg-stone-100 hover:bg-white disabled:bg-stone-600 disabled:text-stone-400 text-stone-900 px-4 py-2 md:px-8 md:py-3 rounded-lg font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border-2 border-stone-400"
              >
                ▶️ Lancer le combat
              </button>
            )}
            {combatResult === 'victory' && (
              <div className="bg-stone-100 text-stone-900 px-8 py-3 rounded-lg font-bold text-xl animate-pulse shadow-2xl border-2 border-stone-400">
                🏆 {player.name} remporte le combat! 🏆
              </div>
            )}
            {combatResult === 'defeat' && (
              <div className="bg-red-900 text-red-200 px-8 py-3 rounded-lg font-bold text-xl shadow-2xl border-2 border-red-600">
                💀 {player.name} a été vaincu... 💀
              </div>
            )}
            <button
              onClick={handleBackToLobby}
              className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-4 py-2 md:px-8 md:py-3 rounded-lg font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border border-stone-500"
            >
              ← Abandonner
            </button>
          </div>

          {/* ═══ MOBILE (< 1024px) : Mini-cartes + journal compact ═══ */}
          <div className="lg:hidden flex flex-col gap-2">
            <div className="flex gap-2">
              <MiniCard entity={{ name: player?.name, currentHP: playerHP, maxHP: playerMaxHP, shield: playerShield ?? 0, base: playerCombatBase ?? player?.base ?? {}, image: player?.characterImage }} side="left" />
              <MiniCard entity={{ name: boss?.name, currentHP: bossHP, maxHP: bossMaxHP, shield: bossShield ?? 0, base: bossCombatBase ?? boss?.base ?? {}, ability: boss?.ability, image: boss?.characterImage }} side="right" />
            </div>
            <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col" style={{ height: 'calc(100dvh - 280px)', minHeight: '260px', maxHeight: '420px' }}>
              <div className="bg-stone-900 px-3 py-2 border-b border-stone-700 rounded-t-xl">
                <h2 className="text-sm font-bold text-stone-200 text-center">⚔️ Combat en direct</h2>
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
                        if (log.includes('🏆')) return <div key={idx} className="flex justify-center my-2"><div className="bg-stone-100 text-stone-900 px-3 py-1.5 font-bold text-xs rounded-lg">{cleanLog}</div></div>;
                        if (log.includes('💀')) return <div key={idx} className="flex justify-center my-2"><div className="bg-red-900 text-red-200 px-3 py-1.5 font-bold text-xs rounded-lg">{cleanLog}</div></div>;
                        if (log.includes('💚')) return <div key={idx} className="flex justify-center my-1"><div className="bg-green-900/50 text-green-300 px-2 py-0.5 text-[10px] font-bold">{cleanLog}</div></div>;
                        if (log.includes('---')) return <div key={idx} className="flex justify-center my-1"><div className="bg-stone-700 text-stone-200 px-2 py-0.5 text-[10px] font-bold rounded">{cleanLog}</div></div>;
                        return <div key={idx} className="text-center text-stone-400 text-[10px] italic">{cleanLog}</div>;
                      }
                      if (isP1) return <div key={idx} className="flex justify-start"><div className="max-w-[85%] bg-stone-700 text-stone-200 px-2 py-1 rounded border-l-2 border-blue-500 text-[11px]">{formatLogMessage(cleanLog)}</div></div>;
                      return <div key={idx} className="flex justify-end"><div className="max-w-[85%] bg-stone-700 text-stone-200 px-2 py-1 rounded border-r-2 border-purple-500 text-[11px]">{formatLogMessage(cleanLog)}</div></div>;
                    })}
                    <div ref={logEndRef} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ═══ DESKTOP (1024px+) : Layout original avec detailsPlacement ═══ */}
          <div className="hidden lg:flex flex-row gap-4 items-start justify-center text-sm">
            {/* Carte joueur - Gauche */}
            <div className="w-auto flex-shrink-0">
              <CharacterCardContent character={player} showHpBar combatBaseOverride={playerCombatBase} combatModifiers={playerCombatModifiers} opponent={boss} combatStatus={playerCombatStatus} detailsPlacement="left" />
            </div>

            {/* Zone centrale - Chat */}
            <div className="flex-1 min-w-[400px] flex flex-col">
              {/* Zone de chat */}
              <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col h-[600px]">
                <div className="bg-stone-900 p-3 border-b border-stone-700 rounded-t-xl">
                  <h2 className="text-2xl font-bold text-stone-200 text-center">⚔️ Combat en direct</h2>
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

                        // Messages système
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

                        // Messages du Joueur (gauche, bordure bleue)
                        if (isP1) {
                          return (
                            <div key={idx} className="flex justify-start">
                              <div className="max-w-[80%]">
                                <div className="bg-stone-700 text-stone-200 px-4 py-2 shadow-lg border-l-4 border-blue-500">
                                  <div className="text-sm">{formatLogMessage(cleanLog)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Messages du Boss (droite, bordure violette)
                        if (isP2) {
                          return (
                            <div key={idx} className="flex justify-end">
                              <div className="max-w-[80%]">
                                <div className="bg-stone-700 text-stone-200 px-4 py-2 shadow-lg border-r-4 border-purple-500">
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

            {/* Carte boss - Droite */}
            <div className="w-auto flex-shrink-0">
              <BossCard bossChar={boss} combatBaseOverride={bossCombatBase} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ÉCRAN VICTOIRE/DÉFAITE SANS LOOT
  // ============================================================================
  if (gameState === 'victory' || gameState === 'defeat') {
    return (
      <div className="min-h-screen p-6">
        <Header />

        <audio id="dungeon-music" loop>
          <source src="/assets/music/grotte.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-2xl mx-auto pt-20 sm:pt-16 text-center">
          <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl p-10 shadow-lg">
            <div className="text-8xl mb-6">{gameState === 'victory' ? '🏆' : '💀'}</div>
            <h2 className={`text-4xl font-bold mb-4 ${gameState === 'victory' ? 'text-amber-400' : 'text-red-400'}`}>
              {gameState === 'victory' ? 'Victoire totale !' : 'Défaite...'}
            </h2>
            <p className="text-stone-300 mb-8">
              {gameState === 'victory' ? 'Vous avez vaincu tous les boss !' : 'Aucun loot obtenu.'}
            </p>
            <button onClick={handleBackToLobby} className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-lg font-bold transition">
              ← Retour aux donjons
            </button>
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
      <audio id="dungeon-music" loop>
        <source src="/assets/music/grotte.mp3" type="audio/mpeg" />
      </audio>
      <div className="max-w-4xl mx-auto pt-20 sm:pt-16">
        {/* Titre */}
        <div className="flex justify-center mb-6">
          <div className="bg-stone-950/85 border border-stone-700/80 rounded-lg px-8 py-3 shadow-lg">
            <h2 className="text-3xl md:text-4xl font-bold text-stone-200">🏰 La Grotte</h2>
          </div>
        </div>

        {/* Info runs */}
        <div className="bg-stone-950/85 border border-amber-700/60 rounded-xl p-5 mb-6 flex justify-between items-center shadow-lg">
          <div>
            <p className="text-amber-300 font-bold text-sm uppercase tracking-wider">Essais disponibles (cumulables)</p>
            <p className="text-white text-3xl font-bold mt-1">
              {dungeonSummary?.runsRemaining || 0}
            </p>
            <p className="text-stone-400 text-xs mt-1">+{DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET} à minuit, +{DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET} à midi et +{DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET} à 18h</p>
          </div>
          <div className="text-right">
            <p className="text-stone-400 text-xs uppercase tracking-wider">Meilleur run</p>
            <p className="text-amber-400 font-bold text-xl mt-1">
              {dungeonSummary?.bestRun ? `Niveau ${dungeonSummary.bestRun}` : 'Aucune'}
            </p>
          </div>
        </div>

        {/* Aperçu des niveaux (compact, 1 ligne) */}
        <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl px-4 py-2.5 mb-6 shadow-lg flex items-center justify-center gap-6">
          {levels.map((level, idx) => (
            <div key={level.id} className="flex items-center gap-2">
              <span className="text-xl">{getBossById(level.bossId)?.icon}</span>
              <span className="text-white font-bold text-sm">Niv. {level.niveau}</span>
              <span className={`text-xs ${DIFFICULTY_COLORS[level.difficulte]}`}>{DIFFICULTY_LABELS[level.difficulte]}</span>
              <span className={`text-xs ${RARITY_COLORS[level.dropRarity]}`}>({level.dropRarity})</span>
              {idx < levels.length - 1 && <span className="text-stone-600 ml-2">|</span>}
            </div>
          ))}
        </div>

        {/* Carte du personnage */}
        <div className="flex justify-center mb-6">
          <CharacterCardContent character={character} detailsPlacement="right" />
        </div>

        {instantMessage && (
          <div className="bg-emerald-900/40 border border-emerald-600 rounded-lg p-4 mb-6 text-center">
            <p className="text-emerald-300">{instantMessage}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-6 text-center">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="flex gap-4 justify-center flex-wrap">
          <button onClick={() => navigate('/dungeons')} className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-3 rounded-lg font-bold border border-stone-500 transition">
            ← Retour aux donjons
          </button>
          <button
            onClick={handleStartRun}
            disabled={!dungeonSummary?.runsRemaining}
            className={`px-10 py-3 rounded-lg font-bold text-lg transition ${
              dungeonSummary?.runsRemaining > 0
                ? 'bg-red-700 hover:bg-red-600 text-white border border-red-500'
                : 'bg-stone-700 text-stone-500 cursor-not-allowed border border-stone-600'
            }`}
          >
            {dungeonSummary?.runsRemaining > 0 ? '🏰 Entrer dans la grotte' : 'Plus de runs'}
          </button>
          {(dungeonSummary?.bestRun || 0) >= DUNGEON_CONSTANTS.TOTAL_LEVELS && (
            <button
              onClick={handleInstantFinishRun}
              disabled={!dungeonSummary?.runsRemaining}
              className={`px-6 py-3 rounded-lg font-bold border transition ${
                dungeonSummary?.runsRemaining > 0
                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-500'
                  : 'bg-stone-700 text-stone-500 cursor-not-allowed border-stone-600'
              }`}
            >
              ⚡ Terminer instantanément
            </button>
          )}
        </div>

        <div className="mt-6 bg-stone-950/85 border border-stone-700/80 rounded-xl p-4 text-center">
          <p className="text-stone-400 text-sm">
            Vous êtes soigné entre chaque boss. Si vous êtes vaincu, vous obtenez le loot du dernier niveau réussi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dungeon;
