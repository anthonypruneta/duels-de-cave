import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter, updateCharacterEquippedWeapon, updateCharacterForestBoosts } from '../services/characterService';
import { getEquippedWeapon, startDungeonRun } from '../services/dungeonService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
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
import { applyWeaponStats, getWeaponById, RARITY_COLORS } from '../data/weapons';
import {
  FOREST_DIFFICULTY_COLORS,
  getAllForestLevels,
  getForestLevelByNumber,
  createForestBossCombatant
} from '../data/forestDungeons';
import { applyStatBoosts, applyStatPoints, getEmptyStatBoosts, getStatLabels } from '../utils/statPoints';
import Header from './Header';

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
  auto: 'ATK',
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
  const logEndRef = useRef(null);

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

  const ensureForestMusic = () => {
    const forestMusic = document.getElementById('forest-music');
    if (forestMusic && forestMusic.paused) {
      forestMusic.volume = 0.35;
      forestMusic.play().catch(error => console.log('Autoplay bloqué:', error));
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

      setEquippedWeapon(weaponData);
      setCharacter(normalizeCharacterBonuses({
        ...characterData,
        forestBoosts,
        level: characterData.level ?? 1,
        equippedWeaponData: weaponData,
        equippedWeaponId: weaponId
      }));

      setLoading(false);
    };

    loadData();
  }, [currentUser, navigate]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

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
            {' '}dégâts magiques (vs ResC)
          </>
        );
      }

      case 'Demoniste': {
        const { capBase, capPerTier, ignoreResist } = classConstants.demoniste;
        const familierBasePct = Math.round(capBase * 100);
        const familierBonusPct = Math.round(capPerTier * 100) * paliers;
        const familierTotalPct = familierBasePct + familierBonusPct;
        const familierDmgTotal = Math.round(cap * (familierTotalPct / 100));
        const ignoreResPct = Math.round(ignoreResist * 100);
        return (
          <>
            Chaque tour:{' '}
            {familierBonusPct > 0 ? (
              <Tooltip content={`${familierTotalPct}% de Cap (${cap}) | Base: ${familierBasePct}% | Bonus (${paliers} paliers): +${familierBonusPct}% | Ignore ${ignoreResPct}% ResC`}>
                <span className="text-green-400">{familierDmgTotal}</span>
              </Tooltip>
            ) : (
              <span>{familierDmgTotal}</span>
            )}
            {' '}dégâts (ignore {ignoreResPct}% ResC)
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

  const fullHealPlayer = (p) => {
    p.currentHP = p.maxHP;
    p.undead = false;
    p.dodge = false;
    p.reflect = false;
    p.bleed_stacks = 0;
    p.maso_taken = 0;
    p.cd = { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 };
  };

  const reviveUndead = (target, log, playerColor) => {
    const revive = Math.max(1, Math.round(raceConstants.mortVivant.revivePercent * target.maxHP));
    target.undead = true;
    target.currentHP = revive;
    log.push(`${playerColor} ☠️ ${target.name} ressuscite d'entre les morts et revient avec ${revive} points de vie !`);
  };

  const getUnicornMultiplier = (turn) => (turn % 2 === 1 ? 1.15 : 0.85);

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

    att.reflect = false;
    for (const k of Object.keys(cooldowns)) {
      att.cd[k] = (att.cd[k] % cooldowns[k]) + 1;
    }

    const playerColor = isPlayer ? '[P1]' : '[P2]';

    if (att.race === 'Sylvari') {
      const heal = Math.max(1, Math.round(att.maxHP * raceConstants.sylvari.regenPercent));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} 🌿 ${att.name} régénère naturellement et récupère ${heal} points de vie`);
    }

    if (att.class === 'Demoniste') {
      const t = tiers15(att.base.cap);
      const { capBase, capPerTier, ignoreResist } = classConstants.demoniste;
      const hit = Math.max(1, Math.round((capBase + capPerTier * t) * att.base.cap));
      let raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
      raw = applyBossOutgoingModifier(att, raw, turn);
      raw = applyBossIncomingModifier(def, raw, turn);
      def.currentHP -= raw;
      log.push(`${playerColor} 💠 Le familier de ${att.name} attaque ${def.name} et inflige ${raw} points de dégâts`);
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def, log, playerColor);
      }
    }

    if (att.class === 'Masochiste') {
      if (att.cd.maso === cooldowns.maso && att.maso_taken > 0) {
        const t = tiers15(att.base.cap);
        const { returnBase, returnPerTier, healPercent } = classConstants.masochiste;
        const dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerTier * t)));
        const healAmount = Math.max(1, Math.round(att.maso_taken * healPercent));
        att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
        att.maso_taken = 0;
        let raw = dmg;
        raw = applyBossOutgoingModifier(att, raw, turn);
        raw = applyBossIncomingModifier(def, raw, turn);
        def.currentHP -= raw;
        log.push(`${playerColor} 🩸 ${att.name} renvoie les dégâts accumulés: inflige ${raw} points de dégâts et récupère ${healAmount} points de vie`);
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log, playerColor);
        }
      }
    }

    if (att.bleed_stacks > 0) {
      const bleedDmg = Math.ceil(att.bleed_stacks / raceConstants.lycan.bleedDivisor);
      att.currentHP -= bleedDmg;
      log.push(`${playerColor} 🩸 ${att.name} saigne abondamment et perd ${bleedDmg} points de vie`);
      if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
        reviveUndead(att, log, playerColor);
      }
    }

    if (att.class === 'Paladin' && att.cd.pal === cooldowns.pal) {
      const { reflectBase, reflectPerTier } = classConstants.paladin;
      att.reflect = reflectBase + reflectPerTier * tiers15(att.base.cap);
      log.push(`${playerColor} 🛡️ ${att.name} se prépare à riposter et renverra ${Math.round(att.reflect * 100)}% des dégâts`);
    }

    if (att.class === 'Healer' && att.cd.heal === cooldowns.heal) {
      const miss = att.maxHP - att.currentHP;
      const { missingHpPercent, capBase, capPerTier } = classConstants.healer;
      const heal = Math.max(1, Math.round(missingHpPercent * miss + (capBase + capPerTier * tiers15(att.base.cap)) * att.base.cap));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} ✚ ${att.name} lance un sort de soin puissant et récupère ${heal} points de vie`);
    }

    if (att.class === 'Voleur' && att.cd.rog === cooldowns.rog) {
      att.dodge = true;
      log.push(`${playerColor} 🌀 ${att.name} entre dans une posture d'esquive et évitera la prochaine attaque`);
    }

    const isMage = att.class === 'Mage' && att.cd.mag === cooldowns.mag;
    const isWar = att.class === 'Guerrier' && att.cd.war === cooldowns.war;
    const isArcher = att.class === 'Archer' && att.cd.arc === cooldowns.arc;

    let mult = 1.0;
    if (att.race === 'Orc' && att.currentHP < raceConstants.orc.lowHpThreshold * att.maxHP) {
      mult = raceConstants.orc.damageBonus;
    }

    let total = 0;
    const attacks = isArcher ? classConstants.archer.arrowsBase + classConstants.archer.arrowsPerTier * tiers15(att.base.cap) : 1;
    let wasCrit = false;

    for (let i = 0; i < attacks; i++) {
      let raw = 0;
      const ignore = isWar ? classConstants.guerrier.ignoreBase + classConstants.guerrier.ignorePerTier * tiers15(att.base.cap) : 0;
      const isCrit = Math.random() < calcCritChance(att);
      wasCrit = wasCrit || isCrit;

      if (isMage) {
        const t = tiers15(att.base.cap);
        const { capBase, capPerTier } = classConstants.mage;
        const atkSpell = Math.round(att.base.auto * mult + (capBase + capPerTier * t) * att.base.cap * mult);
        raw = dmgCap(atkSpell, def.base.rescap);
      } else if (isWar) {
        if (def.base.def <= def.base.rescap) {
          const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
          raw = dmgPhys(Math.round(att.base.auto * mult), effDef);
        } else {
          const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
          raw = dmgCap(Math.round(att.base.cap * mult), effRes);
        }
      } else {
        raw = dmgPhys(Math.round(att.base.auto * mult), def.base.def);
        if (att.race === 'Lycan') {
          def.bleed_stacks = (def.bleed_stacks || 0) + raceConstants.lycan.bleedPerHit;
        }
      }

      if (isCrit) raw = Math.round(raw * generalConstants.critMultiplier);

      if (att.rageReady) {
        raw = Math.round(raw * 2);
        att.rageReady = false;
        att.rageUsed = true;
        log.push(`${playerColor} 💢 ${att.name} libère sa rage et double ses dégâts !`);
      }

      raw = applyBossOutgoingModifier(att, raw, turn);
      raw = applyBossIncomingModifier(def, raw, turn);

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

    if (def?.ability?.type === 'bear_rage' && !def.rageReady && !def.rageUsed && def.currentHP > 0 && def.currentHP <= def.maxHP * 0.25) {
      def.rageReady = true;
      log.push(`${playerColor} 🐻 ${def.name} entre en rage et prépare un coup dévastateur !`);
    }
  };

  const rollForestRewards = (levelData) => {
    const statsPool = ['hp', 'auto', 'def', 'rescap', 'spd', 'cap'];
    const pointsByStat = {};

    for (let i = 0; i < levelData.rewardRolls; i++) {
      const stat = statsPool[Math.floor(Math.random() * statsPool.length)];
      pointsByStat[stat] = (pointsByStat[stat] || 0) + 2;
    }

    const gainsByStat = {};
    let updatedBoosts = { ...getEmptyStatBoosts(), ...(character.forestBoosts || {}) };
    Object.entries(pointsByStat).forEach(([stat, points]) => {
      const { updatedStats, delta } = applyStatPoints(updatedBoosts, stat, points);
      updatedBoosts = updatedStats;
      gainsByStat[stat] = (gainsByStat[stat] || 0) + delta;
    });

    return { updatedBoosts, gainsByStat };
  };

  const handleStartRun = async () => {
    setError(null);
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

    setPlayer(playerReady);
    setBoss(bossReady);
    setCombatLog([`⚔️ Niveau 1: ${levelData.nom} — ${playerReady.name} vs ${bossReady.name} !`]);
  };

  const simulateCombat = async () => {
    if (!player || !boss || isSimulating) return;
    setIsSimulating(true);
    setCombatResult(null);
    ensureForestMusic();

    const p = { ...player };
    const b = { ...boss };
    const logs = [...combatLog, `--- Combat contre ${b.name} ---`];
    setCombatLog(logs);

    let turn = 1;

    while (p.currentHP > 0 && b.currentHP > 0 && turn <= generalConstants.maxTurns) {
      logs.push(`--- Début du tour ${turn} ---`);
      if (b?.ability?.type === 'unicorn_cycle') {
        const mult = turn % 2 === 1 ? '+15%' : '-15%';
        logs.push(`✨ ${b.name} alterne sa magie (${mult} dégâts infligés et reçus)`);
      }
      setCombatLog([...logs]);
      await new Promise(r => setTimeout(r, 800));

      const playerFirst = p.base.spd >= b.base.spd;
      const first = playerFirst ? p : b;
      const second = playerFirst ? b : p;
      const firstIsPlayer = playerFirst;

      const log1 = [];
      setCurrentAction({ player: firstIsPlayer ? 1 : 2, logs: [] });
      await new Promise(r => setTimeout(r, 300));
      processPlayerAction(first, second, log1, firstIsPlayer, turn);
      setCurrentAction({ player: firstIsPlayer ? 1 : 2, logs: log1 });
      logs.push(...log1);
      setCombatLog([...logs]);
      setPlayer({ ...p });
      setBoss({ ...b });
      await new Promise(r => setTimeout(r, 2000));
      setCurrentAction(null);

      if (p.currentHP > 0 && b.currentHP > 0) {
        const log2 = [];
        setCurrentAction({ player: !firstIsPlayer ? 1 : 2, logs: [] });
        await new Promise(r => setTimeout(r, 300));
        processPlayerAction(second, first, log2, !firstIsPlayer, turn);
        setCurrentAction({ player: !firstIsPlayer ? 1 : 2, logs: log2 });
        logs.push(...log2);
        setCombatLog([...logs]);
        setPlayer({ ...p });
        setBoss({ ...b });
        await new Promise(r => setTimeout(r, 2000));
        setCurrentAction(null);
      }

      turn++;
    }

    if (p.currentHP > 0) {
      logs.push(`🏆 ${p.name} remporte glorieusement le combat contre ${b.name} !`);
      setCombatLog([...logs]);
      setCombatResult('victory');

      const levelData = getForestLevelByNumber(currentLevel);
      const rewardResult = rollForestRewards(levelData);
      const levelGain = levelData.rewardRolls;
      const updatedCharacter = {
        ...character,
        level: (character.level ?? 1) + levelGain,
        forestBoosts: rewardResult.updatedBoosts
      };
      setCharacter(updatedCharacter);
      updateCharacterForestBoosts(currentUser.uid, rewardResult.updatedBoosts, updatedCharacter.level);

      const nextLevel = currentLevel + 1;
      setRewardSummary({
        gainsByStat: rewardResult.gainsByStat,
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

  const handleRewardContinue = () => {
    if (!rewardSummary) return;
    if (rewardSummary.hasNextLevel) {
      const nextLevelData = getForestLevelByNumber(rewardSummary.nextLevel);
      const refreshedPlayer = prepareForCombat({
        ...character,
        equippedWeaponData: equippedWeapon,
        equippedWeaponId: equippedWeapon?.id || null
      });
      fullHealPlayer(refreshedPlayer);
      const nextBoss = createForestBossCombatant(nextLevelData.boss);
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

  const PlayerCard = ({ char }) => {
    if (!char) return null;
    const hpPercent = (char.currentHP / char.maxHP) * 100;
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const raceB = char.bonuses?.race || {};
    const classB = char.bonuses?.class || {};
    const weapon = char.equippedWeaponData;
    const totalBonus = (k) => (raceB[k] || 0) + (classB[k] || 0);
    const baseStats = char.baseWithoutWeapon || char.base;
    const forestBoosts = { ...getEmptyStatBoosts(), ...(char.forestBoosts || {}) };
    const baseWithoutBonus = (k) => baseStats[k] - totalBonus(k) - (forestBoosts[k] || 0);
    const tooltipContent = (k) => {
      const parts = [`Base: ${baseWithoutBonus(k)}`];
      if (raceB[k] > 0) parts.push(`Race: +${raceB[k]}`);
      if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
      if (forestBoosts[k] > 0) parts.push(`Forêt: +${forestBoosts[k]}`);
      const weaponDelta = weapon?.stats?.[k] ?? 0;
      if (weaponDelta !== 0) parts.push(`Arme: ${weaponDelta > 0 ? `+${weaponDelta}` : weaponDelta}`);
      return parts.join(' | ');
    };

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
          </span>
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
                <div className={`h-full transition-all duration-500 ${hpClass}`} style={{ width: `${hpPercent}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-stone-400"><StatWithTooltip statKey="auto" label="ATK" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="def" label="DEF" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="cap" label="CAP" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="rescap" label="RESC" /></div>
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
                      <span className={`font-semibold ${RARITY_COLORS[weapon.rarete]}`}>
                        {weapon.nom}
                      </span>
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
                    <div className="text-stone-400 text-[10px]">
                      {getCalculatedDescription(char.class, baseStats.cap, baseStats.auto)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
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
              <div className="text-stone-400">ATK: {bossChar.base.auto}</div>
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
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Header />
        <audio id="forest-music" loop>
          <source src="/assets/music/forest.mp3" type="audio/mpeg" />
        </audio>
        <div className="bg-stone-800 border border-amber-600 p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🌲</div>
          <h2 className="text-3xl font-bold text-amber-400 mb-4">Victoire !</h2>
          <p className="text-stone-300 mb-6">
            Gains :{' '}
            {Object.entries(rewardSummary.gainsByStat).map(([stat, value], index) => (
              <span key={stat} className="text-amber-200 font-semibold">
                {labels[stat] || stat} +{value}{index < Object.keys(rewardSummary.gainsByStat).length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
          <button
            onClick={handleRewardContinue}
            className="bg-stone-100 hover:bg-white text-stone-900 px-8 py-3 font-bold border-2 border-stone-400"
          >
            {rewardSummary.hasNextLevel ? 'Continuer' : 'Terminer'}
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'victory' || gameState === 'defeat') {
    return (
      <div className="min-h-screen p-6">
        <Header />
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
          <div className="flex gap-4 items-start justify-center">
            <div className="flex-shrink-0" style={{width: '340px'}}>
              <PlayerCard char={player} />
            </div>

            <div className="flex-shrink-0 flex flex-col" style={{width: '600px'}}>
              <div className="flex justify-center gap-4 mb-4">
                {combatResult === null && (
                  <button
                    onClick={simulateCombat}
                    disabled={isSimulating || !player || !boss}
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
                                <div className="bg-stone-700 text-stone-200 px-4 py-2 shadow-lg border-l-4 border-blue-500">
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

            <div className="flex-shrink-0" style={{width: '340px'}}>
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
      <audio id="forest-music" loop>
        <source src="/assets/music/forest.mp3" type="audio/mpeg" />
      </audio>
      <div className="max-w-4xl mx-auto pt-20">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-stone-800 border border-stone-600 px-8 py-3">
              <h2 className="text-4xl font-bold text-stone-200">La Forêt</h2>
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
            className="bg-amber-600 hover:bg-amber-700 text-white px-12 py-4 font-bold text-xl border border-amber-500"
          >
            Entrer dans la forêt
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForestDungeon;
