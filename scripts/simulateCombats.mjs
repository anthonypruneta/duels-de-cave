#!/usr/bin/env node

// Script de simulation pour tester l'équilibrage
// Usage: node scripts/simulateCombats.mjs [nombre] [niveau]

import { races } from '../src/data/races.js';
import { classes } from '../src/data/classes.js';
import { weapons, getWeaponById } from '../src/data/weapons.js';
import { getMageTowerPassiveById, getMageTowerPassiveLevel, rollMageTowerPassive } from '../src/data/mageTowerPassives.js';
import { simulerMatch } from '../src/utils/tournamentCombat.js';
import {
  cooldowns,
  classConstants,
  raceConstants,
  generalConstants,
  dmgPhys,
  dmgCap,
  calcCritChance,
  getRaceBonus,
  getClassBonus,
  weaponConstants,
  healingClasses
} from '../src/data/combatMechanics.js';

const LEVEL_STAT_MULTIPLIER = 0.01;

const tiers15 = (cap) => Math.floor(cap / 15);

const clone = (obj) => JSON.parse(JSON.stringify(obj));

const genStats = () => {
  const s = { hp: 120, auto: 15, def: 15, cap: 15, rescap: 15, spd: 15 };
  let rem = 120 - (120 * 0.20 + 75);
  const pool = ['auto', 'def', 'cap', 'rescap', 'spd'];
  const spikeCount = Math.random() < 0.5 ? 2 : 1;
  for (let i = 0; i < spikeCount && rem > 0; i++) {
    const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const target = Math.min(35, s[k] + 8 + Math.floor(Math.random() * 10));
    while (s[k] < target && rem > 0) { s[k]++; rem--; }
  }
  let guard = 10000;
  while (rem > 0 && guard--) {
    const entries = [['hp',1],['auto',3],['def',3],['cap',3],['rescap',3],['spd',3]];
    let tot = entries.reduce((a,[,w])=>a+w,0), r = Math.random()*tot, k='hp';
    for (const [key,w] of entries) { r-=w; if(r<=0){k=key;break;}}
    if (k==='hp' && s.hp+4<=200) {s.hp+=4;rem--;}
    else if (k!=='hp' && s[k]+1<=35) {s[k]++;rem--;}
    else break;
  }
  return s;
};

const applyStatMultipliers = (stats, multipliers = {}) => {
  const updated = { ...stats };
  Object.entries(multipliers).forEach(([key, value]) => {
    if (updated[key] != null) {
      updated[key] = Math.round(updated[key] * value);
    }
  });
  return updated;
};

const applyStatBonuses = (stats, bonuses = {}) => {
  const updated = { ...stats };
  Object.entries(bonuses).forEach(([key, value]) => {
    if (updated[key] != null) {
      updated[key] += value;
    }
  });
  return updated;
};

const getAwakeningEffect = (raceName, level) => {
  const awakening = races[raceName]?.awakening;
  if (!awakening || level < awakening.levelRequired) return null;
  return awakening.effect || null;
};

const applyLevelScaling = (stats, level) => {
  const multiplier = 1 + Math.max(0, level - 1) * LEVEL_STAT_MULTIPLIER;
  return applyStatMultipliers(stats, {
    hp: multiplier,
    auto: multiplier,
    def: multiplier,
    cap: multiplier,
    rescap: multiplier,
    spd: multiplier
  });
};

const applyWeaponStats = (stats, weapon) => {
  if (!weapon?.stats) return stats;
  return applyStatBonuses(stats, weapon.stats);
};

const applyEgideBonus = (stats, weapon) => {
  if (weapon?.id !== 'bouclier_legendaire') return stats;
  const bonus = Math.round(stats.def * weaponConstants.egide.defToAtkPercent + stats.rescap * weaponConstants.egide.rescapToAtkPercent);
  return { ...stats, auto: stats.auto + bonus };
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

const getRandomWeapon = () => {
  const pool = Object.values(weapons);
  return pool[Math.floor(Math.random() * pool.length)] || null;
};

const generateCharacter = (name, level = 1) => {
  const raceKeys = Object.keys(races);
  const classKeys = Object.keys(classes);
  const race = raceKeys[Math.floor(Math.random() * raceKeys.length)];
  const charClass = classKeys[Math.floor(Math.random() * classKeys.length)];
  const raw = genStats();
  const rB = getRaceBonus(race);
  const cB = getClassBonus(charClass);
  const base = {
    hp: raw.hp + rB.hp + cB.hp,
    auto: raw.auto + rB.auto + cB.auto,
    def: raw.def + rB.def + cB.def,
    cap: raw.cap + rB.cap + cB.cap,
    rescap: raw.rescap + rB.rescap + cB.rescap,
    spd: raw.spd + rB.spd + cB.spd
  };
  const weapon = Math.random() < 0.6 ? getRandomWeapon() : null;
  const passive = Math.random() < 0.5 ? rollMageTowerPassive(Math.ceil(Math.random() * 3)) : null;
  return {
    name,
    race,
    class: charClass,
    base,
    level,
    equippedWeaponId: weapon?.id || null,
    mageTowerPassive: passive
  };
};

const buildCombatant = (character) => {
  const level = character.level ?? 1;
  const weapon = character.equippedWeaponId ? getWeaponById(character.equippedWeaponId) : null;
  const awakening = getAwakeningEffect(character.race, level);
  const passiveDetails = getPassiveDetails(character.mageTowerPassive);

  let stats = character.base || character.stats;
  if (!stats) {
    stats = genStats();
  }

  if (character.applyBonuses) {
    stats = applyStatBonuses(stats, getRaceBonus(character.race));
    stats = applyStatBonuses(stats, getClassBonus(character.class));
  }

  stats = applyLevelScaling(stats, level);
  stats = applyWeaponStats(stats, weapon);

  if (awakening?.statMultipliers) {
    stats = applyStatMultipliers(stats, awakening.statMultipliers);
  }
  if (awakening?.statBonuses) {
    stats = applyStatBonuses(stats, awakening.statBonuses);
  }

  stats = applyEgideBonus(stats, weapon);

  return {
    name: character.name,
    race: character.race,
    class: character.class,
    level,
    stats,
    maxHP: stats.hp,
    currentHP: stats.hp,
    passiveDetails,
    awakening,
    weapon,
    weaponState: {
      attackCount: 0,
      spellCount: 0,
      gungnirApplied: false
    },
    cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 },
    dodge: false,
    reflect: 0,
    shield: 0,
    spectralMarked: false,
    spectralMarkBonus: 0,
    bleedStacks: 0,
    dragonkinStacks: 0,
    masoTaken: 0,
    undeadRevived: false,
    awakeningRevived: false,
    orcAwakeningHitsRemaining: awakening?.incomingHitCount || 0,
    stunnedTurns: 0
  };
};

const applyStartOfCombatPassives = (p1, p2) => {
  [p1, p2].forEach((attacker) => {
    if (attacker.passiveDetails?.id === 'arcane_barrier') {
      attacker.shield = Math.max(1, Math.round(attacker.maxHP * attacker.passiveDetails.levelData.shieldPercent));
    }
  });

  if (p1.passiveDetails?.id === 'mind_breach') {
    p2.stats.def = Math.max(0, Math.round(p2.stats.def * (1 - p1.passiveDetails.levelData.defReduction)));
  }
  if (p2.passiveDetails?.id === 'mind_breach') {
    p1.stats.def = Math.max(0, Math.round(p1.stats.def * (1 - p2.passiveDetails.levelData.defReduction)));
  }
};

const applyDirectDamage = (attacker, defender, amount) => {
  let damage = amount;
  if (defender.shield > 0) {
    const absorbed = Math.min(defender.shield, damage);
    defender.shield -= absorbed;
    damage -= absorbed;
  }
  defender.currentHP -= damage;
  if (damage > 0) {
    defender.masoTaken += damage;
    if (defender.awakening?.damageStackBonus) {
      defender.dragonkinStacks += 1;
    }
  }
  if (defender.currentHP < 0) defender.currentHP = 0;
};

const handleDeath = (defender, attacker) => {
  if (defender.race !== 'Mort-vivant') return false;

  if (defender.awakening?.reviveOnce && !defender.awakeningRevived) {
    const explosion = Math.max(1, Math.round(defender.maxHP * defender.awakening.explosionPercent));
    applyDirectDamage(defender, attacker, explosion);
    defender.currentHP = Math.max(1, Math.round(defender.maxHP * defender.awakening.revivePercent));
    defender.awakeningRevived = true;
    return true;
  }

  if (!defender.undeadRevived) {
    defender.currentHP = Math.max(1, Math.round(defender.maxHP * raceConstants.mortVivant.revivePercent));
    defender.undeadRevived = true;
    return true;
  }

  return false;
};

const getCritChance = (attacker) => {
  let critChance = calcCritChance({ class: attacker.class, race: attacker.race, base: attacker.stats });
  if (attacker.awakening?.critChanceBonus) {
    critChance += attacker.awakening.critChanceBonus;
  }
  return critChance;
};

const getCritMultiplier = (attacker) => {
  let multiplier = generalConstants.critMultiplier;
  if (attacker.awakening?.critDamageBonus) {
    multiplier += attacker.awakening.critDamageBonus;
  }
  if (attacker.weapon?.id === 'dague_legendaire') {
    multiplier += weaponConstants.laevateinn.critDamageBonus;
  }
  return multiplier;
};

const applyDamage = (attacker, defender, rawDamage, isCrit, context) => {
  let damage = rawDamage;

  if (isCrit) {
    damage = Math.round(damage * getCritMultiplier(attacker));
    if (defender.passiveDetails?.id === 'obsidian_skin') {
      damage = Math.round(damage * (1 - defender.passiveDetails.levelData.critReduction));
    }
  }

  if (attacker.passiveDetails?.id === 'spectral_mark' && !defender.spectralMarked) {
    defender.spectralMarked = true;
    defender.spectralMarkBonus = attacker.passiveDetails.levelData.damageTakenBonus;
  }

  let outgoingMultiplier = 1;
  let incomingMultiplier = 1;

  if (attacker.race === 'Orc' && attacker.currentHP < attacker.maxHP * raceConstants.orc.lowHpThreshold) {
    outgoingMultiplier *= raceConstants.orc.damageBonus;
  }

  if (attacker.awakening?.highHpDamageBonus && attacker.currentHP > attacker.maxHP * attacker.awakening.highHpThreshold) {
    outgoingMultiplier *= 1 + attacker.awakening.highHpDamageBonus;
  }

  if (attacker.passiveDetails?.id === 'aura_overload' && context.auraBonus) {
    outgoingMultiplier *= 1 + context.auraBonus;
  }

  if (context.attackerUnicorn?.outgoing) {
    outgoingMultiplier *= 1 + context.attackerUnicorn.outgoing;
  }

  if (attacker.awakening?.damageStackBonus && attacker.dragonkinStacks > 0) {
    outgoingMultiplier *= 1 + attacker.dragonkinStacks * attacker.awakening.damageStackBonus;
  }

  if (context.turnEffects?.damageBonus) {
    outgoingMultiplier *= 1 + context.turnEffects.damageBonus;
  }

  if (defender.spectralMarked && defender.spectralMarkBonus) {
    incomingMultiplier *= 1 + defender.spectralMarkBonus;
  }

  if (context.defenderUnicorn?.incoming) {
    incomingMultiplier *= 1 + context.defenderUnicorn.incoming;
  }

  if (defender.awakening?.damageTakenMultiplier) {
    incomingMultiplier *= defender.awakening.damageTakenMultiplier;
  }

  if (defender.orcAwakeningHitsRemaining > 0) {
    incomingMultiplier *= defender.awakening?.incomingHitMultiplier || 1;
    defender.orcAwakeningHitsRemaining -= 1;
  }

  damage = Math.max(0, Math.round(damage * outgoingMultiplier * incomingMultiplier));

  if (defender.shield > 0 && damage > 0) {
    const absorbed = Math.min(defender.shield, damage);
    defender.shield -= absorbed;
    damage -= absorbed;
  }

  defender.currentHP -= damage;
  if (damage > 0) {
    defender.masoTaken += damage;
    if (defender.awakening?.damageStackBonus) {
      defender.dragonkinStacks += 1;
    }
  }

  if (attacker.passiveDetails?.id === 'essence_drain' && damage > 0) {
    const heal = Math.max(1, Math.round(damage * attacker.passiveDetails.levelData.healPercent));
    attacker.currentHP = Math.min(attacker.maxHP, attacker.currentHP + heal);
  }

  return damage;
};

const applyRegenAndDots = (combatant, opponent) => {
  let regenPercent = 0;
  if (combatant.race === 'Sylvari') {
    regenPercent = Math.max(regenPercent, raceConstants.sylvari.regenPercent);
  }
  if (combatant.awakening?.regenPercent) {
    regenPercent = Math.max(regenPercent, combatant.awakening.regenPercent);
  }
  if (combatant.weapon?.id === 'baton_legendaire' && !healingClasses.includes(combatant.class)) {
    regenPercent = Math.max(regenPercent, weaponConstants.yggdrasil.regenPercent);
  }
  if (regenPercent > 0) {
    const heal = Math.max(1, Math.round(combatant.maxHP * regenPercent));
    combatant.currentHP = Math.min(combatant.maxHP, combatant.currentHP + heal);
  }

  if (combatant.bleedStacks > 0) {
    let bleedDamage = Math.ceil(combatant.bleedStacks / raceConstants.lycan.bleedDivisor);
    if (combatant.awakening?.bleedPercentPerStack) {
      bleedDamage += Math.max(1, Math.round(combatant.maxHP * combatant.bleedStacks * combatant.awakening.bleedPercentPerStack));
    }
    applyDirectDamage(opponent, combatant, bleedDamage);
  }
};

const getTurnEffects = (combatant, turn) => {
  const effects = {
    damageBonus: 0,
    priorityOverride: false,
    bonusAttacks: 0,
    bonusAttackDamage: 1,
    guaranteedCrit: false
  };

  if (!combatant.weapon) return effects;

  if (combatant.weapon.id === 'epee_legendaire' && turn % weaponConstants.zweihander.triggerEveryNTurns === 0) {
    effects.damageBonus = weaponConstants.zweihander.damageBonus;
    effects.priorityOverride = weaponConstants.zweihander.priorityOverride;
  }

  if (combatant.weapon.id === 'arc_legendaire' && turn % weaponConstants.arcCieux.triggerEveryNTurns === 0) {
    effects.bonusAttacks = weaponConstants.arcCieux.bonusAttacks;
    effects.bonusAttackDamage = weaponConstants.arcCieux.bonusAttackDamage;
  }

  if (combatant.weapon.id === 'dague_legendaire' && turn % weaponConstants.laevateinn.triggerEveryNTurns === 0) {
    effects.guaranteedCrit = true;
  }

  return effects;
};

const onAttack = (attacker, defender) => {
  attacker.weaponState.attackCount += 1;

  if (attacker.weapon?.id === 'marteau_legendaire' && attacker.weaponState.attackCount % weaponConstants.mjollnir.triggerEveryNAttacks === 0) {
    defender.stunnedTurns = Math.max(defender.stunnedTurns, weaponConstants.mjollnir.stunDuration);
  }

  if (attacker.weapon?.id === 'lance_legendaire' && !attacker.weaponState.gungnirApplied) {
    defender.stats.auto = Math.max(1, Math.round(defender.stats.auto * (1 - weaponConstants.gungnir.atkReductionPercent)));
    attacker.weaponState.gungnirApplied = true;
  }
};

const onSpellCast = (attacker) => {
  attacker.weaponState.spellCount += 1;
  if (attacker.weapon?.id === 'tome_legendaire') {
    if (weaponConstants.codexArchon.doubleCastTriggers.includes(attacker.weaponState.spellCount)) {
      return weaponConstants.codexArchon.secondCastDamage;
    }
  }
  return null;
};


const getMindflayerSpellCooldown = (attacker, defender, spellId) => {
  const baseCooldown = cooldowns[spellId] ?? 1;
  if (defender.race !== 'Mindflayer' || baseCooldown <= 1) return baseCooldown;
  const aw = defender.awakening || {};
  const addedTurns = aw.mindflayerAddCooldownTurns ?? raceConstants.mindflayer.addCooldownTurns;
  return baseCooldown + addedTurns;
};

const applyMindflayerSpellReduction = (attacker, defender, rawDamage, spellId) => {
  if (defender.race !== 'Mindflayer') return rawDamage;
  const aw = defender.awakening || {};
  const hasCooldown = (cooldowns[spellId] ?? 0) > 1;
  const reduction = hasCooldown
    ? (aw.mindflayerCooldownSpellReduction ?? raceConstants.mindflayer.cooldownSpellReduction)
    : (aw.mindflayerNoCooldownSpellReduction ?? raceConstants.mindflayer.noCooldownSpellReduction);
  return Math.max(1, Math.round(rawDamage * (1 - reduction)));
};

const applyClassEffects = (attacker, defender) => {
  let skillUsed = false;
  let damageInstances = [];
  let healAmount = 0;

  const isMage = attacker.class === 'Mage' && attacker.cd.mag === getMindflayerSpellCooldown(attacker, defender, 'mag');
  const isWar = attacker.class === 'Guerrier' && attacker.cd.war === getMindflayerSpellCooldown(attacker, defender, 'war');
  const isArcher = attacker.class === 'Archer' && attacker.cd.arc === getMindflayerSpellCooldown(attacker, defender, 'arc');
  const isDemon = attacker.class === 'Demoniste';
  const isMaso = attacker.class === 'Masochiste' && attacker.cd.maso === getMindflayerSpellCooldown(attacker, defender, 'maso') && attacker.masoTaken > 0;
  const isHeal = attacker.class === 'Healer' && attacker.cd.heal === cooldowns.heal;

  if (attacker.class === 'Paladin' && attacker.cd.pal === cooldowns.pal) {
    const { reflectBase, reflectPerCap } = classConstants.paladin;
    attacker.reflect = reflectBase + reflectPerCap * tiers15(attacker.stats.cap);
  }

  if (attacker.class === 'Voleur' && attacker.cd.rog === cooldowns.rog) {
    attacker.dodge = true;
  }

  if (isHeal) {
    skillUsed = true;
    const miss = attacker.maxHP - attacker.currentHP;
    const { missingHpPercent, capScale } = classConstants.healer;
    healAmount = Math.max(1, Math.round(missingHpPercent * miss + capScale * attacker.stats.cap));
    attacker.currentHP = Math.min(attacker.maxHP, attacker.currentHP + healAmount);
    if (attacker.weapon?.id === 'baton_legendaire') {
      const damage = Math.max(1, Math.round(healAmount * weaponConstants.yggdrasil.healDamagePercent));
      damageInstances.push({ raw: damage, isSpell: false, isBonusAttack: false });
    }
  }

  if (isMaso) {
    skillUsed = true;
    const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
    const dmg = Math.max(1, Math.round(attacker.masoTaken * (returnBase + returnPerCap * tiers15(attacker.stats.cap))));
    const heal = Math.max(1, Math.round(attacker.masoTaken * healPercent));
    attacker.currentHP = Math.min(attacker.maxHP, attacker.currentHP + heal);
    attacker.masoTaken = 0;
    damageInstances.push({ raw: applyMindflayerSpellReduction(attacker, defender, dmg, 'maso'), isSpell: true, isBonusAttack: false });
  }

  if (isDemon) {
    skillUsed = true;
    const { capBase, ignoreResist } = classConstants.demoniste;
    const hit = Math.max(1, Math.round(capBase * attacker.stats.cap));
    const raw = dmgCap(hit, defender.stats.rescap * (1 - ignoreResist));
    damageInstances.push({ raw, isSpell: true, isBonusAttack: false });
  }

  if (isMage) {
    skillUsed = true;
    const { capBase, capPerCap } = classConstants.mage;
    const atkSpell = Math.round(attacker.stats.auto + (capBase + capPerCap * attacker.stats.cap) * attacker.stats.cap);
    const raw = applyMindflayerSpellReduction(attacker, defender, dmgCap(atkSpell, defender.stats.rescap), 'mag');
    damageInstances.push({ raw, isSpell: true, isBonusAttack: false });

    const doubleCast = onSpellCast(attacker);
    if (doubleCast) {
      damageInstances.push({ raw: Math.max(1, Math.round(raw * doubleCast)), isSpell: true, isBonusAttack: true });
    }
  }

  if (isWar) {
    skillUsed = true;
    const { ignoreBase, ignorePerCap } = classConstants.guerrier;
    const ignore = ignoreBase + ignorePerCap * attacker.stats.cap;
    if (defender.stats.def <= defender.stats.rescap) {
      const effDef = Math.max(0, Math.round(defender.stats.def * (1 - ignore)));
      damageInstances.push({ raw: applyMindflayerSpellReduction(attacker, defender, dmgPhys(Math.round(attacker.stats.auto), effDef), 'war'), isSpell: true, isBonusAttack: false });
    } else {
      const effRes = Math.max(0, Math.round(defender.stats.rescap * (1 - ignore)));
      damageInstances.push({ raw: applyMindflayerSpellReduction(attacker, defender, dmgCap(Math.round(attacker.stats.cap), effRes), 'war'), isSpell: true, isBonusAttack: false });
    }
  }

  if (isArcher) {
    skillUsed = true;
    const { hitCount, hit2AutoMultiplier, hit2CapMultiplier } = classConstants.archer;
    for (let i = 0; i < hitCount; i++) {
      if (i === 0) {
        damageInstances.push({ raw: applyMindflayerSpellReduction(attacker, defender, dmgPhys(Math.round(attacker.stats.auto), defender.stats.def), 'arc'), isSpell: true, isBonusAttack: false });
      } else {
        const phys = dmgPhys(Math.round(attacker.stats.auto * hit2AutoMultiplier), defender.stats.def);
        const cap = dmgCap(Math.round(attacker.stats.cap * hit2CapMultiplier), defender.stats.rescap);
        damageInstances.push({ raw: applyMindflayerSpellReduction(attacker, defender, phys + cap, 'arc'), isSpell: true, isBonusAttack: false });
      }
    }
  }

  if (!skillUsed && damageInstances.length === 0) {
    damageInstances.push({ raw: applyMindflayerSpellReduction(attacker, defender, dmgPhys(Math.round(attacker.stats.auto), defender.stats.def), 'arc'), isSpell: true, isBonusAttack: false });
  }

  return { damageInstances, skillUsed };
};

const resolveAttackerTurn = (attacker, defender, turn) => {
  if (attacker.currentHP <= 0 || defender.currentHP <= 0) return;

  applyRegenAndDots(attacker, defender);
  if (attacker.currentHP <= 0) {
    if (!handleDeath(attacker, defender)) {
      return;
    }
  }

  if (attacker.stunnedTurns > 0) {
    attacker.stunnedTurns -= 1;
    return;
  }

  Object.keys(cooldowns).forEach((key) => {
    attacker.cd[key] = (attacker.cd[key] % cooldowns[key]) + 1;
  });

  const turnEffects = getTurnEffects(attacker, turn);
  const attackerUnicorn = getUnicornPactTurnData(attacker.passiveDetails, turn);
  const defenderUnicorn = getUnicornPactTurnData(defender.passiveDetails, turn);
  const auraBonus = getAuraBonus(attacker.passiveDetails, turn);

  const { damageInstances, skillUsed } = applyClassEffects(attacker, defender);

  const hasGuaranteedCrit = turnEffects.guaranteedCrit || (attacker.passiveDetails?.id === 'obsidian_skin'
    && attacker.currentHP <= attacker.maxHP * attacker.passiveDetails.levelData.critThreshold);

  for (const instance of damageInstances) {
    if (attacker.currentHP <= 0 || defender.currentHP <= 0) break;

    if (defender.dodge) {
      defender.dodge = false;
      continue;
    }

    const isCrit = hasGuaranteedCrit ? true : Math.random() < getCritChance(attacker);
    let raw = instance.raw;

    const inflicted = applyDamage(attacker, defender, raw, isCrit, {
      turn,
      turnEffects,
      attackerUnicorn,
      defenderUnicorn,
      auraBonus
    });

    if (inflicted > 0 && defender.reflect) {
      const reflected = Math.round(defender.reflect * inflicted);
      applyDirectDamage(defender, attacker, reflected);
    }

    if (!instance.isSpell) {
      onAttack(attacker, defender);
      if (attacker.race === 'Lycan') {
        defender.bleedStacks += raceConstants.lycan.bleedPerHit;
      }
      if (attacker.awakening?.bleedStacksPerHit) {
        defender.bleedStacks += attacker.awakening.bleedStacksPerHit;
      }
    }

    if (defender.currentHP <= 0) {
      if (!handleDeath(defender, attacker)) {
        break;
      }
    }
  }

  if (attacker.passiveDetails?.id === 'elemental_fury' && skillUsed) {
    const lightning = Math.max(1, Math.round(attacker.stats.auto * attacker.passiveDetails.levelData.lightningPercent));
    defender.currentHP -= lightning;
  }

  if (turnEffects.bonusAttacks > 0) {
    for (let i = 0; i < turnEffects.bonusAttacks; i++) {
      if (defender.currentHP <= 0) break;
      const raw = Math.max(1, Math.round(dmgPhys(attacker.stats.auto, defender.stats.def) * turnEffects.bonusAttackDamage));
      applyDamage(attacker, defender, raw, false, {
        turn,
        turnEffects,
        attackerUnicorn,
        defenderUnicorn,
        auraBonus
      });
    }
  }
};

const getTurnOrder = (p1, p2, turn) => {
  const p1TurnEffects = getTurnEffects(p1, turn);
  const p2TurnEffects = getTurnEffects(p2, turn);
  const p1Unicorn = getUnicornPactTurnData(p1.passiveDetails, turn);
  const p2Unicorn = getUnicornPactTurnData(p2.passiveDetails, turn);

  const p1Priority = p1.stats.spd + (p1TurnEffects.priorityOverride ? 10000 : 0) + (p1Unicorn?.label === 'Tour A' ? 5000 : 0);
  const p2Priority = p2.stats.spd + (p2TurnEffects.priorityOverride ? 10000 : 0) + (p2Unicorn?.label === 'Tour A' ? 5000 : 0);

  if (p1Priority === p2Priority) {
    return Math.random() < 0.5 ? [p1, p2] : [p2, p1];
  }
  return p1Priority >= p2Priority ? [p1, p2] : [p2, p1];
};

const simulateCombat = (attackerInput, defenderInput) => {
  const p1 = { ...attackerInput, id: 'P1', userId: 'P1', name: attackerInput.name ?? 'P1' };
  const p2 = { ...defenderInput, id: 'P2', userId: 'P2', name: defenderInput.name ?? 'P2' };
  const { steps, winnerId } = simulerMatch(p1, p2);
  const turns = steps.filter((step) => step.phase === 'turn_start').length;
  return {
    winner: winnerId === 'P1' ? 'P1' : 'P2',
    turns,
    p1Race: p1.race,
    p1Class: p1.class,
    p2Race: p2.race,
    p2Class: p2.class
  };
};

export const simulateMany = (attacker, defender, simulationsCount = 1000) => {
  let p1Wins = 0;
  let p2Wins = 0;
  let totalTurns = 0;

  for (let i = 0; i < simulationsCount; i++) {
    const result = simulateCombat(clone(attacker), clone(defender));
    totalTurns += result.turns;
    if (result.winner === 'P1') {
      p1Wins += 1;
    } else {
      p2Wins += 1;
    }
  }

  return {
    simulations: simulationsCount,
    p1Wins,
    p2Wins,
    p1WinRate: p1Wins / simulationsCount,
    p2WinRate: p2Wins / simulationsCount,
    averageTurns: totalTurns / simulationsCount
  };
};

const runSimulation = (numCombats = 1000, level = 1) => {
  console.log(`\n🎮 Simulation de ${numCombats} combats (niveau ${level})...\n`);

  const results = [];
  const raceWins = {};
  const classWins = {};
  const raceCombats = {};
  const classCombats = {};
  let totalTurns = 0;

  Object.keys(races).forEach(race => {
    raceWins[race] = 0;
    raceCombats[race] = 0;
  });
  Object.keys(classes).forEach(cls => {
    classWins[cls] = 0;
    classCombats[cls] = 0;
  });

  for (let i = 0; i < numCombats; i++) {
    const p1 = generateCharacter('P1', level);
    const p2 = generateCharacter('P2', level);
    const result = simulateCombat(p1, p2);
    results.push(result);
    totalTurns += result.turns;

    raceCombats[result.p1Race]++;
    raceCombats[result.p2Race]++;
    if (result.winner === 'P1') raceWins[result.p1Race]++;
    else raceWins[result.p2Race]++;

    classCombats[result.p1Class]++;
    classCombats[result.p2Class]++;
    if (result.winner === 'P1') classWins[result.p1Class]++;
    else classWins[result.p2Class]++;
  }

  const avgTurns = (totalTurns / numCombats).toFixed(1);

  console.log('📊 RÉSULTATS DE LA SIMULATION\n');
  console.log(`Nombre de combats: ${numCombats}`);
  console.log(`Durée moyenne: ${avgTurns} tours\n`);

  console.log('🏆 TAUX DE VICTOIRE PAR RACE:');
  const sortedRaces = Object.entries(raceWins)
    .map(([race, wins]) => ({
      race,
      wins,
      combats: raceCombats[race],
      winRate: ((wins / raceCombats[race]) * 100).toFixed(1)
    }))
    .sort((a, b) => b.winRate - a.winRate);

  sortedRaces.forEach(({ race, wins, combats, winRate }) => {
    const bar = '█'.repeat(Math.round(winRate / 2));
    console.log(`  ${races[race].icon} ${race.padEnd(13)} ${winRate.padStart(5)}% ${bar.padEnd(50)} (${wins}/${combats})`);
  });

  console.log('\n⚔️ TAUX DE VICTOIRE PAR CLASSE:');
  const sortedClasses = Object.entries(classWins)
    .map(([cls, wins]) => ({
      cls,
      wins,
      combats: classCombats[cls],
      winRate: ((wins / classCombats[cls]) * 100).toFixed(1)
    }))
    .sort((a, b) => b.winRate - a.winRate);

  sortedClasses.forEach(({ cls, wins, combats, winRate }) => {
    const bar = '█'.repeat(Math.round(winRate / 2));
    console.log(`  ${classes[cls].icon} ${cls.padEnd(13)} ${winRate.padStart(5)}% ${bar.padEnd(50)} (${wins}/${combats})`);
  });

  const raceWinRates = sortedRaces.map(r => parseFloat(r.winRate));
  const classWinRates = sortedClasses.map(c => parseFloat(c.winRate));

  const raceSpread = Math.max(...raceWinRates) - Math.min(...raceWinRates);
  const classSpread = Math.max(...classWinRates) - Math.min(...classWinRates);

  console.log('\n📈 ANALYSE D\'ÉQUILIBRAGE:');
  console.log(`  Écart races: ${raceSpread.toFixed(1)}% (idéal < 10%)`);
  console.log(`  Écart classes: ${classSpread.toFixed(1)}% (idéal < 10%)`);

  if (raceSpread < 10 && classSpread < 10) {
    console.log('  ✅ Excellent équilibrage!');
  } else if (raceSpread < 15 && classSpread < 15) {
    console.log('  ⚠️ Équilibrage acceptable');
  } else {
    console.log('  ❌ Déséquilibrage détecté - ajustements recommandés');
  }

  console.log('\n');
};

// Lancer la simulation
const numCombats = parseInt(process.argv[2], 10) || 1000;
const level = parseInt(process.argv[3], 10) || 1;
runSimulation(numCombats, level);
