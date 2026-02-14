import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter, updateCharacterLevel } from '../services/characterService';
import {
  getPlayerDungeonSummary,
  startDungeonRun,
  endDungeonRun,
  handleLootChoice,
  markDungeonCompleted
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
  onSpellCast,
  rollHealCrit,
  onTurnStart
} from '../utils/weaponEffects';
import { createBossCombatant, getBossById } from '../data/bosses';
import { races } from '../data/races';
import { classes } from '../data/classes';
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
  getSpeedDuelBonuses,
  getRaceBonus,
  getClassBonus
} from '../data/combatMechanics';
import { applyAwakeningToBase, buildAwakeningState, getAwakeningEffect } from '../utils/awakening';
import Header from './Header';
import { simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';

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
  if (!passiveDetails) return;

  if (passiveDetails.id === 'arcane_barrier') {
    const shieldValue = Math.max(1, Math.round(playerChar.maxHP * passiveDetails.levelData.shieldPercent));
    playerChar.shield = shieldValue;
    log.push(`${label} 🛡️ Barrière arcanique: ${playerChar.name} gagne un bouclier de ${shieldValue} PV.`);
  }

  if (passiveDetails.id === 'mind_breach') {
    const reduction = passiveDetails.levelData.defReduction;
    bossChar.base.def = Math.max(0, Math.round(bossChar.base.def * (1 - reduction)));
    log.push(`${label} 🧠 Brèche mentale: ${bossChar.name} perd ${Math.round(reduction * 100)}% de DEF.`);
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
  const [lootWeapon, setLootWeapon] = useState(null);
  const [error, setError] = useState(null);
  const [autoEquipDone, setAutoEquipDone] = useState(false);
  const [instantMessage, setInstantMessage] = useState(null);

  // États de combat (même pattern que Combat.jsx)
  const [player, setPlayer] = useState(null);
  const [boss, setBoss] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [currentAction, setCurrentAction] = useState(null);
  const logEndRef = useRef(null);
  const [isSoundOpen, setIsSoundOpen] = useState(false);
  const [volume, setVolume] = useState(0.05);
  const [isMuted, setIsMuted] = useState(false);

  const ensureDungeonMusic = () => {
    const dungeonMusic = document.getElementById('dungeon-music');
    if (dungeonMusic) {
      dungeonMusic.volume = volume;
      dungeonMusic.muted = isMuted;
      if (dungeonMusic.paused) {
        dungeonMusic.play().catch(error => console.log('Autoplay bloqué:', error));
      }
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

  const shouldAutoScrollLog = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(min-width: 768px)').matches;
  };

  const applyDungeonVolume = () => {
    const dungeonMusic = document.getElementById('dungeon-music');
    if (dungeonMusic) {
      dungeonMusic.volume = volume;
      dungeonMusic.muted = isMuted;
    }
  };

  // Scroll auto du log (desktop uniquement)
  useEffect(() => {
    if (!shouldAutoScrollLog()) return;
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

  useEffect(() => {
    applyDungeonVolume();
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
        const magicDmgTotal = Math.round(magicPct * cap);
        return (
          <>
            Dégâts = Auto +{' '}
            <Tooltip content={`Auto (${auto}) + ${(magicPct * 100).toFixed(1)}% × Cap (${cap})`}>
              <span className="text-green-400">{auto + magicDmgTotal}</span>
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

  // Préparer un personnage pour le combat
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
    p.firstSpellCapBoostUsed = false;
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
      p.weaponState.counters.spellCount = 0;
      p.weaponState.counters.firstHitDone = false;
      p.weaponState.counters.gungnirApplied = false;
    }
  };

  // Fonction de résurrection mort-vivant
  const getAntiHealFactor = (opponent) => {
    if (opponent?.class === 'Briseur de Sort') return 1 - classConstants.briseurSort.antiHealReduction;
    return 1;
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

  // Traiter l'action d'un combattant (joueur ou boss)
  // Utilise [P1]/[P2] comme Combat.jsx (P1 = joueur, P2 = boss)
  const processPlayerAction = (att, def, log, isPlayer, bossAbilityCooldown, turn) => {
    if (att.currentHP <= 0 || def.currentHP <= 0) return bossAbilityCooldown;

    const playerColor = isPlayer ? '[P1]' : '[P2]';
    const playerChar = isPlayer ? att : def;
    const playerPassive = getPassiveDetails(playerChar.mageTowerPassive);
    const unicornData = getUnicornPactTurnData(playerPassive, turn);
    const auraBonus = getAuraBonus(playerPassive, turn);
    const consumeAuraSpellCapMultiplier = () => {
      if (!isPlayer || playerPassive?.id !== 'aura_overload') return 1;
      if (att.firstSpellCapBoostUsed) return 1;
      att.firstSpellCapBoostUsed = true;
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
    }

    // Passif Demoniste (familier)
    if (att.class === 'Demoniste') {
      const { capBase, capPerCap, ignoreResist, stackPerAuto } = classConstants.demoniste;
      const stackBonus = stackPerAuto * (att.familiarStacks || 0);
      const hit = Math.max(1, Math.round((capBase + capPerCap * att.base.cap + stackBonus) * att.base.cap));
      const raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
      const inflicted = applyMageTowerDamage(raw, false);
      log.push(`${playerColor} 💠 Le familier de ${att.name} attaque ${def.name} et inflige ${inflicted} points de dégâts`);
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def, att, log, playerColor);
      }
    }

    // Capacité Masochiste
    if (att.class === 'Masochiste') {
      if (att.cd.maso === cooldowns.maso && att.maso_taken > 0) {
        if (isPlayer) skillUsed = true;
        const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
        const dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerCap * att.base.cap)));
        const healAmount = Math.max(1, Math.round(att.maso_taken * healPercent * getAntiHealFactor(def)));
        att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
        att.maso_taken = 0;
        const inflicted = applyMageTowerDamage(dmg, false);
        const masoSpellEffects = onSpellCast(att.weaponState, att, def, dmg, 'maso');
        if (masoSpellEffects.doubleCast && masoSpellEffects.secondCastDamage > 0) {
          applyMageTowerDamage(masoSpellEffects.secondCastDamage, false, false);
          log.push(`${playerColor} ${masoSpellEffects.log.join(' ')}`);
        }
        log.push(`${playerColor} 🩸 ${att.name} renvoie les dégâts accumulés: inflige ${inflicted} points de dégâts et récupère ${healAmount} points de vie`);
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
      log.push(`${playerColor} 🩸 ${att.name} saigne abondamment et perd ${bleedDmg} points de vie`);
      if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
        reviveUndead(att, def, log, playerColor);
      }
    }

    // Capacité Paladin (riposte)
    if (att.class === 'Paladin' && att.cd.pal === cooldowns.pal) {
      if (isPlayer) skillUsed = true;
      const { reflectBase, reflectPerCap } = classConstants.paladin;
      att.reflect = reflectBase + reflectPerCap * att.base.cap;
      log.push(`${playerColor} 🛡️ ${att.name} se prépare à riposter et renverra ${Math.round(att.reflect * 100)}% des dégâts`);
    }

    // Capacité Healer
    if (att.class === 'Healer' && att.cd.heal === cooldowns.heal) {
      if (isPlayer) skillUsed = true;
      const miss = att.maxHP - att.currentHP;
      const { missingHpPercent, capScale } = classConstants.healer;
      const spellCapMultiplier = consumeAuraSpellCapMultiplier();
      const baseHeal = Math.max(1, Math.round(missingHpPercent * miss + capScale * att.base.cap * spellCapMultiplier * getAntiHealFactor(def)));
      const healCritResult = rollHealCrit(att.weaponState, att, baseHeal);
      const heal = healCritResult.amount;
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} ✚ ${att.name} lance un sort de soin puissant et récupère ${heal} points de vie${healCritResult.isCrit ? ' CRITIQUE !' : ''}`);
      const healSpellEffects = onSpellCast(att.weaponState, att, def, heal, 'heal');
      if (healSpellEffects.doubleCast && healSpellEffects.secondCastHeal > 0) {
        att.currentHP = Math.min(att.maxHP, att.currentHP + healSpellEffects.secondCastHeal);
        log.push(`${playerColor} ✚ Double-cast: ${att.name} récupère ${healSpellEffects.secondCastHeal} points de vie supplémentaires`);
        log.push(`${playerColor} ${healSpellEffects.log.join(' ')}`);
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
        const inflicted = applyMageTowerDamage(raw, false);
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

    if (turnEffects.damageMultiplier !== 1) {
      mult *= turnEffects.damageMultiplier;
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
      const attackMultiplier = mult * (isBonusAttack ? (turnEffects.bonusAttackDamage || 1) : 1);

      if (isMage) {
        const { capBase, capPerCap } = classConstants.mage;
        const spellCapMultiplier = consumeAuraSpellCapMultiplier();
        const scaledCap = att.base.cap * spellCapMultiplier;
        const atkSpell = Math.round(att.base.auto * attackMultiplier + (capBase + capPerCap * scaledCap) * scaledCap * attackMultiplier);
        raw = dmgCap(atkSpell, def.base.rescap);
        if (i === 0) log.push(`${playerColor} 🔮 ${att.name} invoque un puissant sort magique`);
        const spellEffects = onSpellCast(att.weaponState, att, def, raw, 'mage');
          if (spellEffects.doubleCast) {
            applyMageTowerDamage(spellEffects.secondCastDamage, false, false);
            log.push(`${playerColor} ${spellEffects.log.join(' ')}`);
          }
        } else if (isWar) {
        const { ignoreBase, ignorePerCap } = classConstants.guerrier;
        const ignore = ignoreBase + ignorePerCap * att.base.cap;
        if (def.base.def <= def.base.rescap) {
          const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
          raw = dmgPhys(Math.round(att.base.auto * attackMultiplier), effDef);
        } else {
          const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
          raw = dmgCap(Math.round(att.base.cap * attackMultiplier), effRes);
        }
        if (i === 0) log.push(`${playerColor} 🗡️ ${att.name} exécute une frappe pénétrante`);
      } else if (isArcher && !isBonusAttack) {
        if (i === 0) {
          raw = dmgPhys(Math.round(att.base.auto * attackMultiplier), def.base.def);
        } else {
          const { hit2AutoMultiplier, hit2CapMultiplier } = classConstants.archer;
          const physPart = dmgPhys(Math.round(att.base.auto * hit2AutoMultiplier * attackMultiplier), def.base.def);
          const capPart = dmgCap(Math.round(att.base.cap * hit2CapMultiplier * attackMultiplier), def.base.rescap);
          raw = physPart + capPart;
        }
      } else {
        raw = dmgPhys(Math.round(att.base.auto * attackMultiplier), def.base.def);
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
      const baseLightning = Math.max(1, Math.round(att.base.auto * playerPassive.levelData.lightningPercent));
      const lightningRaw = dmgPhys(baseLightning, def.base.def);
      const lightningDamage = applyMageTowerDamage(lightningRaw, false);
      log.push(`${playerColor} ⚡ Furie élémentaire déclenche un éclair et inflige ${lightningDamage} points de dégâts`);
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
    if (!endResult.success || !endResult.lootWeapon) {
      setError(endResult.error || 'Impossible de terminer instantanément cette run.');
      return;
    }

    await markDungeonCompleted(currentUser.uid, 'cave');

    setLootWeapon(endResult.lootWeapon);
    setAutoEquipDone(false);
    setGameState('loot');
  };

  // Lancer le combat (timing identique à Combat.jsx)
  const simulateCombat = async () => {
    if (!player || !boss || isSimulating) return;
    setIsSimulating(true);
    setCombatResult(null);
    ensureDungeonMusic();

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
    // Résultat du combat
    if (p.currentHP > 0) {
      logs.push(`🏆 ${p.name} remporte glorieusement le combat contre ${b.name} !`);
      setCombatLog([...logs]);
      setCombatResult('victory');

      const newHighest = currentLevel;
      setHighestLevelBeaten(newHighest);

      if (currentLevel < DUNGEON_CONSTANTS.TOTAL_LEVELS) {
        // Full heal avant le prochain boss
        await new Promise(r => setTimeout(r, 1500));
        fullHealPlayer(p);
        logs.push(``, `💚 ${p.name} récupère tous ses points de vie !`);

        const nextLevel = currentLevel + 1;
        setCurrentLevel(nextLevel);

        const nextLevelData = getDungeonLevelByNumber(nextLevel);
      const nextBoss = createBossCombatant(nextLevelData.bossId);
      if (nextBoss) {
        nextBoss.weaponState = initWeaponCombatState(nextBoss, null);
        nextBoss.stunned = false;
        nextBoss.stunnedTurns = 0;
      }

        setPlayer({...p});
        setBoss(nextBoss);
        setCombatLog([...logs, ``, `⚔️ Niveau ${nextLevel}: ${nextLevelData.nom} — ${p.name} vs ${nextBoss.name} !`]);
        setCombatResult(null);
      } else {
        // Full clear!
        stopDungeonMusic();
        await new Promise(r => setTimeout(r, 1500));
        const result = await endDungeonRun(currentUser.uid, newHighest);
        if (result.success) {
          await markDungeonCompleted(currentUser.uid, 'cave');
        }
        if (result.success && result.lootWeapon) {
          setLootWeapon(result.lootWeapon);
          setGameState('loot');
        } else {
          setGameState('victory');
        }
      }
    } else {
      logs.push(`💀 ${p.name} a été vaincu par ${b.name}...`);
      setCombatLog([...logs]);
      setCombatResult('defeat');

      stopDungeonMusic();
      await new Promise(r => setTimeout(r, 1500));
      const result = await endDungeonRun(currentUser.uid, highestLevelBeaten, currentLevel);
      if (result.success && result.lootWeapon) {
        setLootWeapon(result.lootWeapon);
        setGameState('loot');
      } else {
        setGameState('defeat');
      }
    }

    setIsSimulating(false);
  };

  useEffect(() => {
    if (!lootWeapon || autoEquipDone || !currentUser) return;
    if (dungeonSummary?.equippedWeaponData) return;

    const autoEquip = async () => {
      await handleLootChoice(currentUser.uid, lootWeapon.id, true);
      const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
      if (summaryResult.success) {
        setDungeonSummary(summaryResult.data);
      }
      setAutoEquipDone(true);
    };

    autoEquip();
  }, [lootWeapon, autoEquipDone, currentUser, dungeonSummary]);

  // Gérer le choix du loot
  const handleLootDecision = async (equipNew) => {
    if (lootWeapon && !autoEquipDone) {
      await handleLootChoice(currentUser.uid, lootWeapon.id, equipNew);
    }

    const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
    if (summaryResult.success) {
      setDungeonSummary(summaryResult.data);
    }

    setLootWeapon(null);
    setAutoEquipDone(false);
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
    setAutoEquipDone(false);
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
  // COMPOSANT CARTE JOUEUR (même style que Combat.jsx CharacterCard)
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
    const baseWithoutBonus = (k) => baseStats[k] - totalBonus(k) - (forestBoosts[k] || 0);
    const tooltipContent = (k) => {
      const parts = [`Base: ${baseWithoutBonus(k)}`];
      if (raceB[k] > 0) parts.push(`Race: +${raceB[k]}`);
      if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
      if (forestBoosts[k] > 0) parts.push(`Forêt: +${forestBoosts[k]}`);
      const weaponDelta = weapon?.stats?.[k] ?? 0;
      if (weaponDelta !== 0) {
        parts.push(`Arme: ${weaponDelta > 0 ? `+${weaponDelta}` : weaponDelta}`);
      }
      if (k === 'auto') {
        const passiveAutoBonus = (baseWithPassive.auto ?? baseStats.auto) - (baseStats.auto + (weapon?.stats?.auto ?? 0));
        if (passiveAutoBonus !== 0) {
          parts.push(`Passif: ${passiveAutoBonus > 0 ? `+${passiveAutoBonus}` : passiveAutoBonus}`);
        }
      }
      return parts.join(' | ');
    };

    const characterImage = char.characterImage || null;

    const StatWithTooltip = ({ statKey, label }) => {
      const weaponDelta = weapon?.stats?.[statKey] ?? 0;
      const passiveAutoBonus = statKey === 'auto'
        ? (baseWithPassive.auto ?? baseStats.auto) - (baseStats.auto + (weapon?.stats?.auto ?? 0))
        : 0;
      const displayValue = baseStats[statKey] + weaponDelta + passiveAutoBonus;
      const hasBonus = totalBonus(statKey) > 0 || forestBoosts[statKey] > 0 || weaponDelta !== 0 || passiveAutoBonus !== 0;
      const totalDelta = totalBonus(statKey) + forestBoosts[statKey] + weaponDelta + passiveAutoBonus;
      const labelClass = totalDelta > 0 ? 'text-green-400' : totalDelta < 0 ? 'text-red-400' : 'text-yellow-300';
      return hasBonus ? (
        <Tooltip content={tooltipContent(statKey)}>
          <span className={labelClass}>
            {label}: {displayValue}
          </span>
        </Tooltip>
      ) : (
        <span>{label}: {displayValue}</span>
      );
    };

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
                    <div className="text-amber-300 font-semibold mb-1">
                      {passiveDetails.name} — Niveau {passiveDetails.level}
                    </div>
                    <div className="text-stone-400 text-[10px]">
                      {passiveDetails.levelData.description}
                    </div>
                  </div>
                </div>
              )}
              {isAwakeningActive && (
                <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                  <span className="text-lg">✨</span>
                  <div className="flex-1">
                    <div className="text-amber-300 font-semibold mb-1">
                      Éveil racial actif (Niv {awakeningInfo.levelRequired}+)
                    </div>
                    <div className="text-stone-400 text-[10px]">
                      {awakeningInfo.description}
                    </div>
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
  // COMPOSANT CARTE BOSS
  // ============================================================================
  const BossCard = ({ bossChar }) => {
    if (!bossChar) return null;
    const hpPercent = (bossChar.currentHP / bossChar.maxHP) * 100;
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const shieldPercent = bossChar.maxHP > 0 ? Math.min(100, ((bossChar.shield || 0) / bossChar.maxHP) * 100) : 0;
    const bossData = getBossById(bossChar.bossId);
    const bossImg = getBossImage(bossChar.imageFile);
    const currentLvlData = getDungeonLevelByNumber(currentLevel);

    return (
      <div className="relative shadow-2xl overflow-visible">
        <div className={`absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 px-5 py-1.5 text-sm font-bold shadow-lg border border-stone-500 z-10 ${DIFFICULTY_COLORS[currentLvlData?.difficulte] || 'text-stone-200'}`}>
          Boss • {DIFFICULTY_LABELS[currentLvlData?.difficulte] || 'Donjon'}
        </div>
        <div className="overflow-visible">
          <div className="h-auto relative bg-stone-900 flex items-center justify-center">
            {bossImg ? (
              <img src={bossImg} alt={bossChar.name} className="w-full h-auto object-contain" />
            ) : (
              <div className="w-full h-48 flex items-center justify-center">
                <span className="text-7xl">{bossData?.icon || '👹'}</span>
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
                <div className={`h-full transition-all duration-500 ${hpClass}`} style={{width: `${hpPercent}%`}} />
              </div>
              {(bossChar.shield || 0) > 0 && (
                <div className="mt-1 bg-stone-900 h-2 overflow-hidden border border-blue-700">
                  <div className="h-full transition-all duration-500 bg-blue-500" style={{width: `${shieldPercent}%`}} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-stone-400">Auto: {bossChar.base.auto}</div>
              <div className="text-stone-400">Déf: {bossChar.base.def}</div>
              <div className="text-stone-400">Cap: {bossChar.base.cap}</div>
              <div className="text-stone-400">ResC: {bossChar.base.rescap}</div>
            </div>
            {bossChar.ability && (
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">⚡</span>
                <div className="flex-1">
                  <div className="text-amber-300 font-semibold mb-1">{bossChar.ability.nom}</div>
                  <div className="text-stone-400 text-[10px]">{bossChar.ability.description}</div>
                </div>
              </div>
            )}
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
        <SoundControl />
        <div className="text-amber-400 text-2xl">Chargement du donjon...</div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <SoundControl />
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
  // ÉCRAN DE LOOT
  // ============================================================================
  if (gameState === 'loot' && lootWeapon) {
    const hasCurrentWeapon = dungeonSummary?.equippedWeaponData;
    const getOpaqueRarityBg = (rarity) => (RARITY_BG_COLORS[rarity] || '').replace('/50', '');

    return (
      <div className="min-h-screen p-6">
        <Header />
        <SoundControl />
        <audio id="dungeon-music" loop>
          <source src="/assets/music/grotte.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-2xl mx-auto pt-20">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎁</div>
            <h2 className="text-4xl font-bold text-amber-400 mb-2">Butin obtenu !</h2>
            <p className="text-gray-300">
              {highestLevelBeaten === DUNGEON_CONSTANTS.TOTAL_LEVELS
                ? 'Vous avez vaincu tous les boss !'
                : highestLevelBeaten > 0
                  ? `Vous avez atteint le niveau ${highestLevelBeaten}`
                  : 'Défaite au premier niveau'}
            </p>
          </div>

          {/* Arme droppée */}
          <div className={`p-6 border-2 ${RARITY_BORDER_COLORS[lootWeapon.rarete]} ${getOpaqueRarityBg(lootWeapon.rarete)} mb-6`}>
            <div className="text-center">
              {getWeaponImage(lootWeapon.imageFile) ? (
                <img src={getWeaponImage(lootWeapon.imageFile)} alt={lootWeapon.nom} className="w-32 h-auto mx-auto mb-3" />
              ) : (
                <div className="text-6xl mb-3">{lootWeapon.icon}</div>
              )}
              <h3 className={`text-2xl font-bold ${RARITY_COLORS[lootWeapon.rarete]}`}>{lootWeapon.nom}</h3>
              <p className={`text-sm uppercase ${RARITY_COLORS[lootWeapon.rarete]}`}>{lootWeapon.rarete}</p>
              <p className="text-gray-400 text-sm mt-2">{lootWeapon.description}</p>

              <div className="mt-4 flex justify-center gap-4 flex-wrap">
                {Object.entries(lootWeapon.stats).map(([stat, value]) => (
                  <div key={stat} className="bg-stone-800 px-3 py-1 border border-stone-600">
                    <span className="text-gray-400 text-sm">{STAT_LABELS[stat] || stat.toUpperCase()}</span>
                    <span className={`ml-2 font-bold ${value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {value > 0 ? '+' : ''}{value}
                    </span>
                  </div>
                ))}
              </div>

              {lootWeapon.effet && (
                <div className="mt-4 bg-amber-900/30 border border-amber-600 p-3">
                  <p className="text-amber-300 font-bold">{lootWeapon.effet.nom}</p>
                  <p className="text-amber-200 text-sm">{lootWeapon.effet.description}</p>
                </div>
              )}
            </div>
          </div>

          {hasCurrentWeapon && (
            <div className="mb-6">
              <p className="text-center text-gray-400 mb-2">Arme actuellement équipée :</p>
              <div className={`p-4 border ${RARITY_BORDER_COLORS[hasCurrentWeapon.rarete]} ${getOpaqueRarityBg(hasCurrentWeapon.rarete)}`}>
                <div className="flex items-center gap-3">
                  {getWeaponImage(hasCurrentWeapon.imageFile) ? (
                    <img src={getWeaponImage(hasCurrentWeapon.imageFile)} alt={hasCurrentWeapon.nom} className="w-16 h-auto" />
                  ) : (
                    <span className="text-3xl">{hasCurrentWeapon.icon}</span>
                  )}
                  <div>
                    <p className={`font-bold ${RARITY_COLORS[hasCurrentWeapon.rarete]}`}>{hasCurrentWeapon.nom}</p>
                    <div className="flex gap-2">
                      {Object.entries(hasCurrentWeapon.stats).map(([stat, value]) => (
                        <span key={stat} className="text-xs text-gray-400">
                          {STAT_LABELS[stat] || stat.toUpperCase()}: {value > 0 ? '+' : ''}{value}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasCurrentWeapon ? (
            <div className="flex gap-4">
              <button onClick={() => handleLootDecision(false)} className="flex-1 bg-stone-700 hover:bg-stone-600 text-white px-6 py-4 font-bold border border-stone-500">
                Garder mon arme
              </button>
              <button onClick={() => handleLootDecision(true)} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-6 py-4 font-bold border border-amber-500">
                Équiper la nouvelle
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-stone-300">
                Aucune arme équipée : la nouvelle arme est équipée automatiquement.
              </p>
              <button
                onClick={() => handleLootDecision(true)}
                disabled={!autoEquipDone}
                className={`w-full px-6 py-4 font-bold border ${
                  autoEquipDone
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-500'
                    : 'bg-stone-700 text-stone-500 border-stone-600 cursor-not-allowed'
                }`}
              >
                {autoEquipDone ? 'Continuer' : 'Équipement en cours...'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // ÉCRAN DE COMBAT (même UI que Combat.jsx)
  // ============================================================================
  if (gameState === 'fighting' && player && boss) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <SoundControl />
        <audio id="dungeon-music" loop>
          <source src="/assets/music/grotte.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-[1800px] mx-auto pt-16">
          {/* Header avec progression */}
          <div className="flex justify-center mb-4">
            <div className="bg-stone-800 border border-stone-600 px-8 py-3">
              <h1 className="text-3xl font-bold text-stone-200">🏰 Donjon — Niveau {currentLevel} 🏰</h1>
            </div>
          </div>

          {/* Indicateur de progression */}
          <div className="flex justify-center items-center gap-4 mb-6">
            {levels.map((level, idx) => (
              <div key={level.id} className="flex items-center gap-2">
                <div className={`w-10 h-10 flex items-center justify-center border-2 text-sm font-bold ${
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

          {/* Layout principal: Joueur | Chat | Boss (même que Combat.jsx) */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
            {/* Carte joueur - Gauche */}
            <div className="order-1 md:order-1 w-full md:w-[340px] md:flex-shrink-0">
              <PlayerCard char={player} />
            </div>

            {/* Zone centrale - Boutons + Chat */}
            <div className="order-2 md:order-2 w-full md:w-[600px] md:flex-shrink-0 flex flex-col">
              {/* Boutons de contrôle */}
              <div className="flex justify-center gap-3 md:gap-4 mb-4">
                {combatResult === null && (
                  <button
                    onClick={simulateCombat}
                    disabled={isSimulating}
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

              {/* Message de victoire */}
              {combatResult === 'victory' && (
                <div className="flex justify-center mb-4">
                  <div className="bg-stone-100 text-stone-900 px-8 py-3 font-bold text-xl animate-pulse shadow-2xl border-2 border-stone-400">
                    🏆 {player.name} remporte le combat! 🏆
                  </div>
                </div>
              )}

              {/* Message de défaite */}
              {combatResult === 'defeat' && (
                <div className="flex justify-center mb-4">
                  <div className="bg-red-900 text-red-200 px-8 py-3 font-bold text-xl shadow-2xl border-2 border-red-600">
                    💀 {player.name} a été vaincu... 💀
                  </div>
                </div>
              )}

              {/* Zone de chat messenger (même que Combat.jsx) */}
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
                                <div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-l-4 border-blue-500">
                                  <div className="text-xs md:text-sm">{formatLogMessage(cleanLog)}</div>
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

            {/* Carte boss - Droite */}
            <div className="order-3 md:order-3 w-full md:w-[340px] md:flex-shrink-0">
              <BossCard bossChar={boss} />
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
        <SoundControl />
        <audio id="dungeon-music" loop>
          <source src="/assets/music/grotte.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <div className="text-8xl mb-6">{gameState === 'victory' ? '🏆' : '💀'}</div>
          <h2 className={`text-4xl font-bold mb-4 ${gameState === 'victory' ? 'text-amber-400' : 'text-red-400'}`}>
            {gameState === 'victory' ? 'Victoire totale !' : 'Défaite...'}
          </h2>
          <p className="text-gray-300 mb-8">
            {gameState === 'victory' ? 'Vous avez vaincu tous les boss !' : 'Aucun loot obtenu.'}
          </p>
          <button onClick={handleBackToLobby} className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 font-bold">
            Retour
          </button>
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
      <SoundControl />
      <audio id="dungeon-music" loop>
        <source src="/assets/music/grotte.mp3" type="audio/mpeg" />
      </audio>
      <div className="max-w-4xl mx-auto pt-20">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-stone-800 border border-stone-600 px-8 py-3">
            <h2 className="text-4xl font-bold text-stone-200">La Grotte</h2>
          </div>
        </div>

        {/* Info runs */}
        <div className="bg-stone-800 border border-amber-600 p-4 mb-8 flex justify-between items-center">
          <div>
            <p className="text-amber-300 font-bold">Essais disponibles (cumulables)</p>
            <p className="text-white text-2xl">
              {dungeonSummary?.runsRemaining || 0}
            </p>
            <p className="text-stone-400 text-sm">+{DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET} à minuit et +{DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET} à midi</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Meilleur run</p>
            <p className="text-amber-400 font-bold">
              {dungeonSummary?.bestRun ? `Niveau ${dungeonSummary.bestRun}` : 'Aucune'}
            </p>
          </div>
        </div>

        {/* Arme équipée */}
        {dungeonSummary?.equippedWeaponData && (
          <div className={`mb-8 p-4 border-2 border-stone-600 bg-stone-800`}>
            <div className="flex items-center gap-4">
              <Tooltip content={getWeaponTooltipContent(dungeonSummary.equippedWeaponData)}>
                <div className="flex items-center gap-4">
                  {getWeaponImage(dungeonSummary.equippedWeaponData.imageFile) ? (
                    <img src={getWeaponImage(dungeonSummary.equippedWeaponData.imageFile)} alt={dungeonSummary.equippedWeaponData.nom} className="w-16 h-auto" />
                  ) : (
                    <span className="text-4xl">{dungeonSummary.equippedWeaponData.icon}</span>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-gray-400">Arme équipée</p>
                    <p className={`text-xl font-bold ${RARITY_COLORS[dungeonSummary.equippedWeaponData.rarete]}`}>
                      {dungeonSummary.equippedWeaponData.nom}
                    </p>
                  </div>
                </div>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Aperçu des niveaux */}
        <div className="bg-stone-800 border border-stone-600 p-4 mb-8">
          <h3 className="text-xl font-bold text-amber-400 mb-4 text-center">3 Niveaux progressifs</h3>
          <div className="grid grid-cols-3 gap-4">
            {levels.map((level) => (
              <div key={level.id} className="bg-stone-900/50 p-3 border border-stone-700 text-center">
                <div className="text-3xl mb-2">{getBossById(level.bossId)?.icon}</div>
                <p className="text-white font-bold">Niveau {level.niveau}</p>
                <p className={`text-sm ${DIFFICULTY_COLORS[level.difficulte]}`}>
                  {DIFFICULTY_LABELS[level.difficulte]}
                </p>
                <p className={`text-xs mt-1 ${RARITY_COLORS[level.dropRarity]}`}>
                  Loot: {level.dropRarity}
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

        <div className="flex gap-4 justify-center">
          <button onClick={() => navigate('/dungeons')} className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 font-bold border border-stone-500">
            Retour
          </button>
          <button
            onClick={handleStartRun}
            disabled={!dungeonSummary?.runsRemaining}
            className={`px-12 py-4 font-bold text-xl ${
              dungeonSummary?.runsRemaining > 0
                ? 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-500'
                : 'bg-stone-700 text-stone-500 cursor-not-allowed border border-stone-600'
            }`}
          >
            {dungeonSummary?.runsRemaining > 0 ? 'Entrer dans la grotte' : 'Plus de runs'}
          </button>
          {(dungeonSummary?.bestRun || 0) >= DUNGEON_CONSTANTS.TOTAL_LEVELS && (
            <button
              onClick={handleInstantFinishRun}
              disabled={!dungeonSummary?.runsRemaining}
              className={`px-8 py-4 font-bold border ${
                dungeonSummary?.runsRemaining > 0
                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-500'
                  : 'bg-stone-700 text-stone-500 cursor-not-allowed border-stone-600'
              }`}
            >
              ⚡ Terminer instantanément
            </button>
          )}
        </div>

        <div className="mt-8 bg-stone-800 border border-stone-600 p-4 text-center">
          <p className="text-gray-400 text-sm">
            Vous êtes soigné entre chaque boss. Si vous êtes vaincu, vous obtenez le loot du dernier niveau réussi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dungeon;
