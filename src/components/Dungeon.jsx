import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter } from '../services/characterService';
import {
  getPlayerDungeonSummary,
  startDungeonRun,
  endDungeonRun,
  handleLootChoice
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
  RARITY_BG_COLORS,
  applyWeaponStats
} from '../data/weapons';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import { createBossCombatant, getBossById } from '../data/bosses';
import { races } from '../data/races';
import { classes } from '../data/classes';
import {
  cooldowns,
  classConstants,
  raceConstants,
  generalConstants,
  tiers15,
  dmgPhys,
  dmgCap,
  calcCritChance
} from '../data/combatMechanics';
import Header from './Header';

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

  // États de combat (même pattern que Combat.jsx)
  const [player, setPlayer] = useState(null);
  const [boss, setBoss] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [currentAction, setCurrentAction] = useState(null);
  const logEndRef = useRef(null);

  const ensureDungeonMusic = () => {
    const dungeonMusic = document.getElementById('dungeon-music');
    if (dungeonMusic && dungeonMusic.paused) {
      dungeonMusic.volume = 0.35;
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
        setCharacter(charResult.data);

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

  // Scroll auto du log
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [combatLog]);

  // Descriptions calculées des classes (même que Combat.jsx)
  const getCalculatedDescription = (className, cap, auto) => {
    const paliers = tiers15(cap);

    switch(className) {
      case 'Guerrier': {
        const { ignoreBase, ignorePerTier, autoBonus } = classConstants.guerrier;
        const ignoreBasePct = Math.round(ignoreBase * 100);
        const ignoreBonusPct = Math.round(ignorePerTier * 100) * paliers;
        const ignoreTotalPct = ignoreBasePct + ignoreBonusPct;
        return (
          <>
            +{autoBonus} Auto | Frappe résistance faible & ignore{' '}
            {ignoreBonusPct > 0 ? (
              <Tooltip content={`Base: ${ignoreBasePct}% | Bonus (${paliers} paliers): +${ignoreBonusPct}%`}>
                <span className="text-green-400">{ignoreTotalPct}%</span>
              </Tooltip>
            ) : (
              <span>{ignoreBasePct}%</span>
            )}
          </>
        );
      }
      case 'Voleur': {
        const { spdBonus, critPerTier } = classConstants.voleur;
        const critBonusPct = Math.round(critPerTier * 100) * paliers;
        return (
          <>
            +{spdBonus} VIT | Esquive 1 coup
            {critBonusPct > 0 && (
              <Tooltip content={`Bonus (${paliers} paliers): +${critBonusPct}%`}>
                <span className="text-green-400"> | +{critBonusPct}% crit</span>
              </Tooltip>
            )}
          </>
        );
      }
      case 'Paladin': {
        const { reflectBase, reflectPerTier } = classConstants.paladin;
        const reflectBasePct = Math.round(reflectBase * 100);
        const reflectBonusPct = Math.round(reflectPerTier * 100) * paliers;
        const reflectTotalPct = reflectBasePct + reflectBonusPct;
        return (
          <>
            Renvoie{' '}
            {reflectBonusPct > 0 ? (
              <Tooltip content={`Base: ${reflectBasePct}% | Bonus (${paliers} paliers): +${reflectBonusPct}%`}>
                <span className="text-green-400">{reflectTotalPct}%</span>
              </Tooltip>
            ) : (
              <span>{reflectBasePct}%</span>
            )}
            {' '}des dégâts reçus
          </>
        );
      }
      case 'Healer': {
        const { missingHpPercent, capBase, capPerTier } = classConstants.healer;
        const missingPct = Math.round(missingHpPercent * 100);
        const healBasePct = Math.round(capBase * 100);
        const healBonusPct = Math.round(capPerTier * 100) * paliers;
        const healTotalPct = healBasePct + healBonusPct;
        const healValue = Math.round(cap * (healTotalPct / 100));
        return (
          <>
            Heal {missingPct}% PV manquants +{' '}
            {healBonusPct > 0 ? (
              <Tooltip content={`${healTotalPct}% de la Cap (${cap}) | Base: ${healBasePct}% | Bonus (${paliers} paliers): +${healBonusPct}%`}>
                <span className="text-green-400">{healValue}</span>
              </Tooltip>
            ) : (
              <span>{healValue}</span>
            )}
          </>
        );
      }
      case 'Archer': {
        const { arrowsBase, arrowsPerTier } = classConstants.archer;
        const arrowsBonus = arrowsPerTier * paliers;
        const arrowsTotal = arrowsBase + arrowsBonus;
        return (
          <>
            {arrowsBonus > 0 ? (
              <Tooltip content={`Base: ${arrowsBase} | Bonus (${paliers} paliers): +${arrowsBonus}`}>
                <span className="text-green-400">{arrowsTotal}</span>
              </Tooltip>
            ) : (
              <span>{arrowsBase}</span>
            )}
            {' '}tirs simultanés
          </>
        );
      }
      case 'Mage': {
        const { capBase, capPerTier } = classConstants.mage;
        const magicBasePct = Math.round(capBase * 100);
        const magicBonusPct = Math.round(capPerTier * 100) * paliers;
        const magicTotalPct = magicBasePct + magicBonusPct;
        const magicDmgTotal = Math.round(cap * (magicTotalPct / 100));
        return (
          <>
            Dégâts = Auto +{' '}
            {magicBonusPct > 0 ? (
              <Tooltip content={`${magicTotalPct}% de la Cap (${cap}) | Base: ${magicBasePct}% | Bonus (${paliers} paliers): +${magicBonusPct}%`}>
                <span className="text-green-400">{magicDmgTotal}</span>
              </Tooltip>
            ) : (
              <span>{magicDmgTotal}</span>
            )}
            {' '}(vs ResC)
          </>
        );
      }
      case 'Demoniste': {
        const { capBase, capPerTier, ignoreResist } = classConstants.demoniste;
        const familierBasePct = Math.round(capBase * 100);
        const familierBonusPct = Math.round(capPerTier * 100) * paliers;
        const familierTotalPct = familierBasePct + familierBonusPct;
        const familierDmgTotal = Math.round(cap * (familierTotalPct / 100));
        const ignoreResistPct = Math.round(ignoreResist * 100);
        return (
          <>
            Familier:{' '}
            {familierBonusPct > 0 ? (
              <Tooltip content={`${familierTotalPct}% de la Cap (${cap}) | Base: ${familierBasePct}% | Bonus (${paliers} paliers): +${familierBonusPct}%`}>
                <span className="text-green-400">{familierDmgTotal}</span>
              </Tooltip>
            ) : (
              <span>{familierDmgTotal}</span>
            )}
            {' '}dégâts / tour (ignore {ignoreResistPct}% ResC)
          </>
        );
      }
      case 'Masochiste': {
        const { returnBase, returnPerTier, healPercent } = classConstants.masochiste;
        const returnBasePct = Math.round(returnBase * 100);
        const returnBonusPct = Math.round(returnPerTier * 100) * paliers;
        const returnTotalPct = returnBasePct + returnBonusPct;
        const healPct = Math.round(healPercent * 100);
        return (
          <>
            Renvoie{' '}
            {returnBonusPct > 0 ? (
              <Tooltip content={`Base: ${returnBasePct}% | Bonus (${paliers} paliers): +${returnBonusPct}%`}>
                <span className="text-green-400">{returnTotalPct}%</span>
              </Tooltip>
            ) : (
              <span>{returnBasePct}%</span>
            )}
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
    const baseWithWeapon = weaponId ? applyWeaponStats(baseWithBoosts, weaponId) : { ...baseWithBoosts };
    return {
      ...char,
      base: baseWithWeapon,
      baseWithoutWeapon: baseWithBoosts,
      currentHP: baseWithWeapon.hp,
      maxHP: baseWithWeapon.hp,
      cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 },
      undead: false,
      dodge: false,
      reflect: false,
      bleed_stacks: 0,
      maso_taken: 0
    };
  };

  // Full heal du joueur (entre les boss)
  const fullHealPlayer = (p) => {
    p.currentHP = p.maxHP;
    p.undead = false;
    p.dodge = false;
    p.reflect = false;
    p.bleed_stacks = 0;
    p.maso_taken = 0;
    p.cd = { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 };
  };

  // Fonction de résurrection mort-vivant
  const reviveUndead = (target, log, playerColor) => {
    const revive = Math.max(1, Math.round(raceConstants.mortVivant.revivePercent * target.maxHP));
    target.undead = true;
    target.currentHP = revive;
    log.push(`${playerColor} ☠️ ${target.name} ressuscite d'entre les morts et revient avec ${revive} points de vie !`);
  };

  // Traiter l'action d'un combattant (joueur ou boss)
  // Utilise [P1]/[P2] comme Combat.jsx (P1 = joueur, P2 = boss)
  const processPlayerAction = (att, def, log, isPlayer, bossAbilityCooldown) => {
    if (att.currentHP <= 0 || def.currentHP <= 0) return bossAbilityCooldown;

    att.reflect = false;
    for (const k of Object.keys(cooldowns)) {
      att.cd[k] = (att.cd[k] % cooldowns[k]) + 1;
    }

    const playerColor = isPlayer ? '[P1]' : '[P2]';

    // Passif Sylvari (regen)
    if (att.race === 'Sylvari') {
      const heal = Math.max(1, Math.round(att.maxHP * raceConstants.sylvari.regenPercent));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} 🌿 ${att.name} régénère naturellement et récupère ${heal} points de vie`);
    }

    // Passif Demoniste (familier)
    if (att.class === 'Demoniste') {
      const t = tiers15(att.base.cap);
      const { capBase, capPerTier, ignoreResist } = classConstants.demoniste;
      const hit = Math.max(1, Math.round((capBase + capPerTier * t) * att.base.cap));
      const raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
      def.currentHP -= raw;
      log.push(`${playerColor} 💠 Le familier de ${att.name} attaque ${def.name} et inflige ${raw} points de dégâts`);
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def, log, playerColor);
      }
    }

    // Capacité Masochiste
    if (att.class === 'Masochiste') {
      if (att.cd.maso === cooldowns.maso && att.maso_taken > 0) {
        const t = tiers15(att.base.cap);
        const { returnBase, returnPerTier, healPercent } = classConstants.masochiste;
        const dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerTier * t)));
        const healAmount = Math.max(1, Math.round(att.maso_taken * healPercent));
        att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
        att.maso_taken = 0;
        def.currentHP -= dmg;
        log.push(`${playerColor} 🩸 ${att.name} renvoie les dégâts accumulés: inflige ${dmg} points de dégâts et récupère ${healAmount} points de vie`);
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log, playerColor);
        }
      }
    }

    // Saignement
    if (att.bleed_stacks > 0) {
      const bleedDmg = Math.ceil(att.bleed_stacks / raceConstants.lycan.bleedDivisor);
      att.currentHP -= bleedDmg;
      log.push(`${playerColor} 🩸 ${att.name} saigne abondamment et perd ${bleedDmg} points de vie`);
      if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
        reviveUndead(att, log, playerColor);
      }
    }

    // Capacité Paladin (riposte)
    if (att.class === 'Paladin' && att.cd.pal === cooldowns.pal) {
      const { reflectBase, reflectPerTier } = classConstants.paladin;
      att.reflect = reflectBase + reflectPerTier * tiers15(att.base.cap);
      log.push(`${playerColor} 🛡️ ${att.name} se prépare à riposter et renverra ${Math.round(att.reflect * 100)}% des dégâts`);
    }

    // Capacité Healer
    if (att.class === 'Healer' && att.cd.heal === cooldowns.heal) {
      const miss = att.maxHP - att.currentHP;
      const { missingHpPercent, capBase, capPerTier } = classConstants.healer;
      const heal = Math.max(1, Math.round(missingHpPercent * miss + (capBase + capPerTier * tiers15(att.base.cap)) * att.base.cap));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} ✚ ${att.name} lance un sort de soin puissant et récupère ${heal} points de vie`);
    }

    // Capacité Voleur (esquive)
    if (att.class === 'Voleur' && att.cd.rog === cooldowns.rog) {
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
        def.currentHP -= raw;
        log.push(`${playerColor} 🔥 ${att.name} lance un Souffle de Flammes dévastateur et inflige ${raw} points de dégâts`);
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log, playerColor);
        }
        newBossCooldown = 0;
      }
    }

    // Déterminer le type d'attaque
    const isMage = att.class === 'Mage' && att.cd.mag === cooldowns.mag;
    const isWar = att.class === 'Guerrier' && att.cd.war === cooldowns.war;
    const isArcher = att.class === 'Archer' && att.cd.arc === cooldowns.arc;

    let mult = 1.0;
    if (att.race === 'Orc' && att.currentHP < raceConstants.orc.lowHpThreshold * att.maxHP) {
      mult = raceConstants.orc.damageBonus;
    }

    let hits = isArcher ? classConstants.archer.arrowsBase + classConstants.archer.arrowsPerTier * tiers15(att.base.cap) : 1;
    let total = 0;
    let wasCrit = false;

    for (let i = 0; i < hits; i++) {
      const isCrit = Math.random() < calcCritChance(att);
      if (isCrit) wasCrit = true;
      let raw = 0;

      if (isMage) {
        const { capBase, capPerTier } = classConstants.mage;
        const atkSpell = Math.round(att.base.auto * mult + (capBase + capPerTier * tiers15(att.base.cap)) * att.base.cap * mult);
        raw = dmgCap(atkSpell, def.base.rescap);
        if (i === 0) log.push(`${playerColor} 🔮 ${att.name} invoque un puissant sort magique`);
      } else if (isWar) {
        const { ignoreBase, ignorePerTier } = classConstants.guerrier;
        const ignore = ignoreBase + ignorePerTier * tiers15(att.base.cap);
        if (def.base.def <= def.base.rescap) {
          const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
          raw = dmgPhys(Math.round(att.base.auto * mult), effDef);
        } else {
          const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
          raw = dmgCap(Math.round(att.base.cap * mult), effRes);
        }
        if (i === 0) log.push(`${playerColor} 🗡️ ${att.name} exécute une frappe pénétrante`);
      } else {
        raw = dmgPhys(Math.round(att.base.auto * mult), def.base.def);
        if (att.race === 'Lycan') {
          def.bleed_stacks = (def.bleed_stacks || 0) + raceConstants.lycan.bleedPerHit;
        }
      }

      if (isCrit) raw = Math.round(raw * generalConstants.critMultiplier);

      if (def.dodge) {
        def.dodge = false;
        log.push(`${playerColor} 💨 ${def.name} esquive habilement l'attaque !`);
        raw = 0;
      }

      if (def.reflect && raw > 0) {
        const back = Math.round(def.reflect * raw);
        att.currentHP -= back;
        log.push(`${playerColor} 🔁 ${def.name} riposte et renvoie ${back} points de dégâts à ${att.name}`);
      }

      def.currentHP -= raw;
      if (raw > 0) def.maso_taken = (def.maso_taken || 0) + raw;

      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def, log, playerColor);
      } else if (def.currentHP <= 0) {
        total += raw;
        break;
      }

      total += raw;
      if (isArcher) {
        const critText = isCrit ? ' CRITIQUE !' : '';
        log.push(`${playerColor} 🏹 ${att.name} tire sa flèche n°${i + 1} et inflige ${raw} points de dégâts${critText}`);
      }
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

    setPlayer(playerReady);
    setBoss(bossReady);
    setCombatLog([`⚔️ Niveau 1: ${levelData.nom} — ${playerReady.name} vs ${bossReady.name} !`]);
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
    setCombatLog(logs);

    let turn = 1;
    let bossAbilityCooldown = 0;

    while (p.currentHP > 0 && b.currentHP > 0 && turn <= generalConstants.maxTurns) {
      logs.push(`--- Début du tour ${turn} ---`);
      setCombatLog([...logs]);
      await new Promise(r => setTimeout(r, 800));

      // Déterminer qui attaque en premier selon la vitesse
      const playerFirst = p.base.spd >= b.base.spd;
      const first = playerFirst ? p : b;
      const second = playerFirst ? b : p;
      const firstIsPlayer = playerFirst;

      // Action du premier combattant
      const log1 = [];
      setCurrentAction({ player: firstIsPlayer ? 1 : 2, logs: [] });
      await new Promise(r => setTimeout(r, 300));
      bossAbilityCooldown = processPlayerAction(first, second, log1, firstIsPlayer, bossAbilityCooldown);
      setCurrentAction({ player: firstIsPlayer ? 1 : 2, logs: log1 });
      logs.push(...log1);
      setCombatLog([...logs]);
      setPlayer({...p});
      setBoss({...b});
      await new Promise(r => setTimeout(r, 2000));
      setCurrentAction(null);

      // Si le combat n'est pas fini, action du deuxième combattant
      if (p.currentHP > 0 && b.currentHP > 0) {
        const log2 = [];
        setCurrentAction({ player: !firstIsPlayer ? 1 : 2, logs: [] });
        await new Promise(r => setTimeout(r, 300));
        bossAbilityCooldown = processPlayerAction(second, first, log2, !firstIsPlayer, bossAbilityCooldown);
        setCurrentAction({ player: !firstIsPlayer ? 1 : 2, logs: log2 });
        logs.push(...log2);
        setCombatLog([...logs]);
        setPlayer({...p});
        setBoss({...b});
        await new Promise(r => setTimeout(r, 2000));
        setCurrentAction(null);
      }

      turn++;
    }

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

        setPlayer({...p});
        setBoss(nextBoss);
        setCombatLog([...logs, ``, `⚔️ Niveau ${nextLevel}: ${nextLevelData.nom} — ${p.name} vs ${nextBoss.name} !`]);
        setCombatResult(null);
      } else {
        // Full clear!
        stopDungeonMusic();
        await new Promise(r => setTimeout(r, 1500));
        const result = await endDungeonRun(currentUser.uid, newHighest);
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

  // Gérer le choix du loot
  const handleLootDecision = async (equipNew) => {
    if (lootWeapon) {
      await handleLootChoice(currentUser.uid, lootWeapon.id, equipNew);
    }

    const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
    if (summaryResult.success) {
      setDungeonSummary(summaryResult.data);
    }

    setLootWeapon(null);
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
  // COMPOSANT CARTE JOUEUR (même style que Combat.jsx CharacterCard)
  // ============================================================================
  const PlayerCard = ({ char }) => {
    if (!char) return null;
    const hpPercent = (char.currentHP / char.maxHP) * 100;
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const raceB = char.bonuses?.race || {};
    const classB = char.bonuses?.class || {};
    const forestBoosts = getForestBoosts(char);
    const weapon = char.equippedWeaponData;
    const baseStats = char.baseWithoutWeapon || getBaseWithBoosts(char);
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
      return parts.join(' | ');
    };

    const characterImage = char.characterImage || null;

    const StatWithTooltip = ({ statKey, label }) => {
      const weaponDelta = weapon?.stats?.[statKey] ?? 0;
      const displayValue = baseStats[statKey] + weaponDelta;
      const hasBonus = totalBonus(statKey) > 0 || forestBoosts[statKey] > 0 || weaponDelta !== 0;
      const totalDelta = totalBonus(statKey) + forestBoosts[statKey] + weaponDelta;
      const labelClass = totalDelta > 0 ? 'text-green-400' : totalDelta < 0 ? 'text-red-400' : 'text-yellow-300';
      return hasBonus ? (
        <Tooltip content={tooltipContent(statKey)}>
          <span className={labelClass}>
            {label}: {displayValue}
            {weaponDelta !== 0 && (
              <span className={`ml-1 ${getWeaponStatColor(weaponDelta)}`}>
                ({weaponDelta > 0 ? `+${weaponDelta}` : weaponDelta})
              </span>
            )}
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
              {races[char.race] && (
                <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                  <span className="text-lg">{races[char.race].icon}</span>
                  <span className="text-stone-300">{races[char.race].bonus}</span>
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
  // ÉCRAN DE LOOT
  // ============================================================================
  if (gameState === 'loot' && lootWeapon) {
    const hasCurrentWeapon = dungeonSummary?.equippedWeaponData;

    return (
      <div className="min-h-screen p-6">
        <Header />
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
          <div className={`p-6 border-2 ${RARITY_BORDER_COLORS[lootWeapon.rarete]} ${RARITY_BG_COLORS[lootWeapon.rarete]} mb-6`}>
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
                    <span className="text-gray-400 text-sm">{stat.toUpperCase()}</span>
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
              <div className={`p-4 border ${RARITY_BORDER_COLORS[hasCurrentWeapon.rarete]} ${RARITY_BG_COLORS[hasCurrentWeapon.rarete]}`}>
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
                          {stat.toUpperCase()}: {value > 0 ? '+' : ''}{value}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            {hasCurrentWeapon ? (
              <>
                <button onClick={() => handleLootDecision(false)} className="flex-1 bg-stone-700 hover:bg-stone-600 text-white px-6 py-4 font-bold border border-stone-500">
                  Garder mon arme
                </button>
                <button onClick={() => handleLootDecision(true)} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-6 py-4 font-bold border border-amber-500">
                  Équiper la nouvelle
                </button>
              </>
            ) : (
              <button onClick={() => handleLootDecision(true)} className="w-full bg-amber-600 hover:bg-amber-700 text-white px-6 py-4 font-bold border border-amber-500">
                Équiper l'arme
              </button>
            )}
          </div>
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
          <div className="flex gap-4 items-start justify-center">
            {/* Carte joueur - Gauche */}
            <div className="flex-shrink-0" style={{width: '340px'}}>
              <PlayerCard char={player} />
            </div>

            {/* Zone centrale - Boutons + Chat */}
            <div className="flex-shrink-0 flex flex-col" style={{width: '600px'}}>
              {/* Boutons de contrôle */}
              <div className="flex justify-center gap-4 mb-4">
                {combatResult === null && (
                  <button
                    onClick={simulateCombat}
                    disabled={isSimulating}
                    className="bg-stone-100 hover:bg-white disabled:bg-stone-600 disabled:text-stone-400 text-stone-900 px-8 py-3 font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg border-2 border-stone-400"
                  >
                    ▶️ Lancer le combat
                  </button>
                )}
                <button
                  onClick={handleBackToLobby}
                  className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-8 py-3 font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg border border-stone-500"
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
              <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[600px]">
                <div className="bg-stone-900 p-3 border-b border-stone-600">
                  <h2 className="text-2xl font-bold text-stone-200 text-center">⚔️ Combat en direct</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
                  {combatLog.length === 0 ? (
                    <p className="text-stone-500 italic text-center py-8">Cliquez sur "Lancer le combat" pour commencer...</p>
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
            <div className="flex-shrink-0" style={{width: '340px'}}>
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
            <p className="text-amber-300 font-bold">Runs aujourd'hui</p>
            <p className="text-white text-2xl">
              {dungeonSummary?.runsRemaining || 0} / {DUNGEON_CONSTANTS.MAX_RUNS_PER_DAY} restantes
            </p>
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
