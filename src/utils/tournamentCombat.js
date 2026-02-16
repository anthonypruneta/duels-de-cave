/**
 * Simulation de combat PvP pour le tournoi
 * Réplique fidèle du moteur de Combat.jsx en version synchrone
 * Retourne des "steps" avec snapshots HP pour l'animation client
 */

import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives.js';
import { applyStatBoosts } from './statPoints.js';
import {
  applyGungnirDebuff, applyMjollnirStun, applyPassiveWeaponStats,
  initWeaponCombatState, modifyCritDamage, onAttack, onHeal, onSpellCast, onTurnStart, rollHealCrit
} from './weaponEffects.js';
import {
  cooldowns, classConstants, raceConstants, generalConstants, weaponConstants,
  dmgPhys, dmgCap, calcCritChance, getCritMultiplier, getSpeedDuelBonuses
} from '../data/combatMechanics.js';
import { applyAwakeningToBase, buildAwakeningState, getAwakeningEffect } from './awakening.js';
import { WORLD_BOSS_CONSTANTS } from '../data/worldBoss.js';

// ============================================================================
// HELPERS
// ============================================================================

function getAntiHealFactor(opponent) {
  if (opponent?.class === 'Briseur de Sort') return 1 - classConstants.briseurSort.antiHealReduction;
  return 1;
}

function getBriseurAutoBonus(att) {
  if (att.class !== 'Briseur de Sort') return 0;
  return Math.round(att.base.cap * classConstants.briseurSort.autoCapBonus);
}

function getPassiveDetails(passive) {
  if (!passive) return null;
  const base = getMageTowerPassiveById(passive.id);
  const levelData = getMageTowerPassiveLevel(passive.id, passive.level);
  if (!base || !levelData) return null;
  return { ...base, level: passive.level, levelData };
}

function getUnicornPactTurnData(passiveDetails, turn) {
  if (!passiveDetails || passiveDetails.id !== 'unicorn_pact') return null;
  const isTurnA = turn % 2 === 1;
  return isTurnA ? { label: 'Tour A', ...passiveDetails.levelData.turnA } : { label: 'Tour B', ...passiveDetails.levelData.turnB };
}

function getAuraBonus(passiveDetails, turn) {
  if (!passiveDetails || passiveDetails.id !== 'aura_overload') return 0;
  return turn <= passiveDetails.levelData.turns ? passiveDetails.levelData.damageBonus : 0;
}

function mergeAwakeningEffects(effects = []) {
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

    const additiveKeys = ['critChanceBonus', 'critDamageBonus', 'damageStackBonus', 'explosionPercent', 'regenPercent', 'bleedPercentPerStack',
      'mindflayerStealSpellCapDamageScale', 'mindflayerOwnCooldownReductionTurns', 'mindflayerNoCooldownSpellBonus',
      'sireneStackBonus', 'sireneMaxStacks'];
    additiveKeys.forEach((key) => {
      if (typeof effect[key] === 'number') acc[key] = (acc[key] ?? 0) + effect[key];
    });

    const multiplicativeKeys = ['damageTakenMultiplier', 'incomingHitMultiplier'];
    multiplicativeKeys.forEach((key) => {
      if (typeof effect[key] === 'number') acc[key] = (acc[key] ?? 1) * effect[key];
    });

    if (typeof effect.highHpThreshold === 'number') {
      acc.highHpThreshold = typeof acc.highHpThreshold === 'number'
        ? Math.min(acc.highHpThreshold, effect.highHpThreshold)
        : effect.highHpThreshold;
    }
    if (typeof effect.highHpDamageBonus === 'number') {
      acc.highHpDamageBonus = (acc.highHpDamageBonus ?? 0) + effect.highHpDamageBonus;
    }

    if (typeof effect.incomingHitCount === 'number') acc.incomingHitCount = (acc.incomingHitCount ?? 0) + effect.incomingHitCount;
    if (typeof effect.revivePercent === 'number') acc.revivePercent = Math.max(acc.revivePercent ?? 0, effect.revivePercent);
    if (typeof effect.bleedStacksPerHit === 'number') acc.bleedStacksPerHit = (acc.bleedStacksPerHit ?? 0) + effect.bleedStacksPerHit;

    if (effect.reviveOnce) acc.reviveOnce = true;

    return acc;
  }, {});
}

function applyStartOfCombatPassives(attacker, defender, log, label) {
  const passiveDetails = getPassiveDetails(attacker.mageTowerPassive);
  if (passiveDetails?.id === 'arcane_barrier') {
    const shieldValue = Math.max(1, Math.round(attacker.maxHP * passiveDetails.levelData.shieldPercent));
    attacker.shield = shieldValue;
    log.push(`${label} 🛡️ Barrière arcanique: ${attacker.name} gagne un bouclier de ${shieldValue} PV.`);
  }
  if (passiveDetails?.id === 'mind_breach') {
    const reduction = passiveDetails.levelData.defReduction;
    defender.base.def = Math.max(0, Math.round(defender.base.def * (1 - reduction)));
    log.push(`${label} 🧠 Brèche mentale: ${defender.name} perd ${Math.round(reduction * 100)}% de DEF.`);
  }

  if (attacker?.ability?.type === 'lich_shield') {
    attacker.shield = Math.max(1, Math.round(attacker.maxHP * 0.2));
    attacker.shieldExploded = false;
    log.push(`${label} 🧟 Barrière macabre: ${attacker.name} se protège avec ${attacker.shield} points de bouclier.`);
  }

  if (attacker?.ability?.type === 'bone_guard') {
    attacker.boneGuardActive = false;
  }

  defender.spectralMarked = false;
  defender.spectralMarkBonus = 0;
}

// ============================================================================
// PRÉPARATION COMBATTANT
// ============================================================================

export function preparerCombattant(char) {
  const weaponId = char?.equippedWeaponId || char?.equippedWeaponData?.id || null;
  const baseWithBoosts = applyStatBoosts(char.base, char.forestBoosts);
  const baseWithWeapon = applyPassiveWeaponStats(baseWithBoosts, weaponId, char.class);
  const additionalAwakeningEffects = (char.additionalAwakeningRaces || [])
    .map((race) => getAwakeningEffect(race, char.level ?? 1));
  const awakeningEffect = mergeAwakeningEffects([
    getAwakeningEffect(char.race, char.level ?? 1),
    ...additionalAwakeningEffects
  ]);
  const baseWithAwakening = applyAwakeningToBase(baseWithWeapon, awakeningEffect);
  const baseWithClassPassive = char.class === 'Bastion'
    ? { ...baseWithAwakening, def: Math.max(1, Math.round(baseWithAwakening.def * (1 + classConstants.bastion.defPercentBonus))) }
    : baseWithAwakening;
  const weaponState = initWeaponCombatState(char, weaponId);
  return {
    ...char,
    base: baseWithClassPassive,
    currentHP: baseWithClassPassive.hp,
    maxHP: baseWithClassPassive.hp,
    cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0, succ: 0, bast: 0, boss_ability: 0 },
    undead: false,
    dodge: false,
    reflect: false,
    bleed_stacks: 0,
    bleedPercentPerStack: 0,
    maso_taken: 0,
    familiarStacks: 0,
    shield: 0,
    shieldExploded: false,
    sireneStacks: 0,
    succubeWeakenNextAttack: false,
    spectralMarked: false,
    spectralMarkBonus: 0,
    firstSpellCapBoostUsed: false,
    mindflayerSpellTheftUsed: false,
    stunned: false,
    stunnedTurns: 0,
    boneGuardActive: false,
    weaponState,
    awakening: buildAwakeningState(awakeningEffect)
  };
}

// ============================================================================
// LOGIQUE DE COMBAT
// ============================================================================

function reviveUndead(target, attacker, log, playerColor) {
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
}

function applyIncomingAwakeningModifiers(defender, damage) {
  let adjusted = damage;
  if (defender.awakening?.incomingHitMultiplier && defender.awakening.incomingHitCountRemaining > 0) {
    adjusted = Math.round(adjusted * defender.awakening.incomingHitMultiplier);
    defender.awakening.incomingHitCountRemaining -= 1;
  }
  if (defender.awakening?.damageTakenMultiplier) {
    adjusted = Math.round(adjusted * defender.awakening.damageTakenMultiplier);
  }
  return adjusted;
}

function applyOutgoingAwakeningBonus(attacker, damage) {
  let adjusted = damage;
  if (attacker.awakening?.highHpDamageBonus && attacker.currentHP > attacker.maxHP * (attacker.awakening.highHpThreshold ?? 1)) {
    adjusted = Math.round(adjusted * (1 + attacker.awakening.highHpDamageBonus));
  }
  if (attacker.awakening?.damageStackBonus && attacker.awakening.damageTakenStacks > 0) {
    adjusted = Math.round(adjusted * (1 + attacker.awakening.damageStackBonus * attacker.awakening.damageTakenStacks));
  }
  return adjusted;
}


function getMindflayerSpellCooldown(caster, _target, spellId) {
  const baseCooldown = cooldowns[spellId] ?? 1;
  let adjustedCooldown = baseCooldown;

  if (caster.race === 'Mindflayer' && adjustedCooldown > 1 && !caster.mindflayerFirstCDUsed) {
    const casterAwakening = caster.awakening || {};
    const reducedTurns = casterAwakening.mindflayerOwnCooldownReductionTurns ?? raceConstants.mindflayer.ownCooldownReductionTurns;
    if (reducedTurns > 0) adjustedCooldown = Math.max(1, adjustedCooldown - reducedTurns);
  }

  return adjustedCooldown;
}

function applyMindflayerSpellMod(caster, _target, baseDamage, spellId, log, playerColor) {
  if (caster.race !== 'Mindflayer') return baseDamage;

  const effectiveCooldown = getMindflayerSpellCooldown(caster, _target, spellId);
  if (effectiveCooldown > 1) return baseDamage;

  const casterAwakening = caster.awakening || {};
  const bonus = casterAwakening.mindflayerNoCooldownSpellBonus ?? raceConstants.mindflayer.noCooldownSpellBonus;
  if (!bonus || bonus <= 0) return baseDamage;

  const boosted = Math.round(baseDamage * (1 + bonus));
  log.push(`${playerColor} 🦑 Sort sans CD — ${caster.name} inflige +${Math.round(bonus * 100)}% de dégâts !`);
  return boosted;
}

function triggerMindflayerSpellTheft(caster, target, log, playerColor, atkPassive, defPassive, atkUnicorn, defUnicorn, auraBonus) {
  if (target?.race !== 'Mindflayer') return;
  if (target.mindflayerSpellTheftUsed) return;
  if (target.currentHP <= 0 || caster.currentHP <= 0) return;

  target.mindflayerSpellTheftUsed = true;
  const targetAwakening = target.awakening || {};
  const capScale = targetAwakening.mindflayerStealSpellCapDamageScale ?? raceConstants.mindflayer.stealSpellCapDamageScale;
  const capBonus = Math.max(0, Math.round(target.base.cap * capScale));

  // Le Mindflayer (target) relance le sort volé contre l'ennemi (caster)
  const stolenClass = caster.class;

  switch (stolenClass) {
    case 'Demoniste': {
      const { capBase, capPerCap, ignoreResist } = classConstants.demoniste;
      const hit = Math.max(1, Math.round((capBase + capPerCap * target.base.cap) * target.base.cap));
      const raw = dmgCap(hit, caster.base.rescap * (1 - ignoreResist)) + capBonus;
      const inflicted = applyDamage(target, caster, raw, false, log, playerColor, defPassive, atkPassive, defUnicorn, atkUnicorn, auraBonus, true, true);
      log.push(`${playerColor} 🦑 ${target.name} vole le familier de ${caster.name} et inflige ${inflicted} dégâts !`);
      break;
    }
    case 'Masochiste': {
      const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
      const masoTaken = caster.maso_taken || 0;
      const dmg = Math.max(1, Math.round(masoTaken * (returnBase + returnPerCap * target.base.cap))) + capBonus;
      const healAmount = Math.max(1, Math.round(masoTaken * healPercent * getAntiHealFactor(caster)));
      target.currentHP = Math.min(target.maxHP, target.currentHP + healAmount);
      const inflicted = applyDamage(target, caster, dmg, false, log, playerColor, defPassive, atkPassive, defUnicorn, atkUnicorn, auraBonus, true, true);
      log.push(`${playerColor} 🦑 ${target.name} vole le renvoi de dégâts de ${caster.name}, inflige ${inflicted} dégâts et récupère ${healAmount} PV !`);
      break;
    }
    case 'Paladin': {
      const { reflectBase, reflectPerCap } = classConstants.paladin;
      target.reflect = reflectBase + reflectPerCap * target.base.cap;
      log.push(`${playerColor} 🦑 ${target.name} vole la riposte de ${caster.name} et renverra ${Math.round(target.reflect * 100)}% des dégâts !`);
      break;
    }
    case 'Healer': {
      const miss = target.maxHP - target.currentHP;
      const { missingHpPercent, capScale: healCapScale } = classConstants.healer;
      const heal = Math.max(1, Math.round((missingHpPercent * miss + healCapScale * target.base.cap) * getAntiHealFactor(caster)));
      target.currentHP = Math.min(target.maxHP, target.currentHP + heal);
      log.push(`${playerColor} 🦑 ${target.name} vole le soin de ${caster.name} et récupère ${heal} PV !`);
      break;
    }
    case 'Succube': {
      const raw = dmgCap(Math.round(target.base.auto + target.base.cap * classConstants.succube.capScale), caster.base.rescap) + capBonus;
      const inflicted = applyDamage(target, caster, raw, false, log, playerColor, defPassive, atkPassive, defUnicorn, atkUnicorn, auraBonus, true, true);
      caster.succubeWeakenNextAttack = true;
      log.push(`${playerColor} 🦑 ${target.name} vole le fouet de ${caster.name}, inflige ${inflicted} dégâts et affaiblit sa prochaine attaque !`);
      break;
    }
    case 'Bastion': {
      const raw = dmgCap(Math.round(target.base.auto + target.base.cap * classConstants.bastion.capScale + target.base.def * classConstants.bastion.defScale), caster.base.rescap) + capBonus;
      const inflicted = applyDamage(target, caster, raw, false, log, playerColor, defPassive, atkPassive, defUnicorn, atkUnicorn, auraBonus, true, true);
      log.push(`${playerColor} 🦑 ${target.name} vole la Charge du Rempart de ${caster.name} et inflige ${inflicted} dégâts !`);
      break;
    }
    case 'Voleur': {
      target.dodge = true;
      log.push(`${playerColor} 🦑 ${target.name} vole l'esquive de ${caster.name} et évitera la prochaine attaque !`);
      break;
    }
    case 'Mage': {
      const { capBase, capPerCap } = classConstants.mage;
      const atkSpell = Math.round(target.base.auto + (capBase + capPerCap * target.base.cap) * target.base.cap);
      const raw = dmgCap(atkSpell, caster.base.rescap) + capBonus;
      const inflicted = applyDamage(target, caster, raw, false, log, playerColor, defPassive, atkPassive, defUnicorn, atkUnicorn, auraBonus, true, true);
      log.push(`${playerColor} 🦑 ${target.name} vole le sort magique de ${caster.name} et inflige ${inflicted} dégâts !`);
      break;
    }
    case 'Guerrier': {
      const { ignoreBase, ignorePerCap } = classConstants.guerrier;
      const ignore = ignoreBase + ignorePerCap * target.base.cap;
      let raw;
      if (caster.base.def <= caster.base.rescap) {
        const effDef = Math.max(0, Math.round(caster.base.def * (1 - ignore)));
        raw = dmgPhys(Math.round(target.base.auto), effDef);
      } else {
        const effRes = Math.max(0, Math.round(caster.base.rescap * (1 - ignore)));
        raw = dmgCap(Math.round(target.base.cap), effRes);
      }
      raw += capBonus;
      const inflicted = applyDamage(target, caster, raw, false, log, playerColor, defPassive, atkPassive, defUnicorn, atkUnicorn, auraBonus, true, true);
      log.push(`${playerColor} 🦑 ${target.name} vole la frappe pénétrante de ${caster.name} et inflige ${inflicted} dégâts !`);
      break;
    }
    case 'Archer': {
      const { hitCount, hit2AutoMultiplier, hit2CapMultiplier } = classConstants.archer;
      let totalDmg = 0;
      for (let i = 0; i < hitCount; i++) {
        let raw;
        if (i === 0) {
          raw = dmgPhys(Math.round(target.base.auto), caster.base.def) + capBonus;
        } else {
          const physPart = dmgPhys(Math.round(target.base.auto * hit2AutoMultiplier), caster.base.def);
          const capPart = dmgCap(Math.round(target.base.cap * hit2CapMultiplier), caster.base.rescap);
          raw = physPart + capPart + capBonus;
        }
        const inflicted = applyDamage(target, caster, raw, false, log, playerColor, defPassive, atkPassive, defUnicorn, atkUnicorn, auraBonus, true, true);
        totalDmg += inflicted;
        if (caster.currentHP <= 0) break;
      }
      log.push(`${playerColor} 🦑 ${target.name} vole le tir multiple de ${caster.name} et inflige ${totalDmg} dégâts !`);
      break;
    }
    default: {
      const stolenDamage = Math.max(1, Math.round(target.base.cap * capScale));
      const inflicted = applyDamage(target, caster, stolenDamage, false, log, playerColor, defPassive, atkPassive, defUnicorn, atkUnicorn, auraBonus, true, true);
      log.push(`${playerColor} 🦑 ${target.name} vole le sort de ${caster.name} et inflige ${inflicted} dégâts !`);
      break;
    }
  }

  if (caster.currentHP <= 0 && caster.race === 'Mort-vivant' && !caster.undead) {
    reviveUndead(caster, target, log, playerColor);
  }
}

function grantOnSpellHitDefenderEffects(def, adjusted, log, playerColor) {
  if (adjusted <= 0) return;
  if (def.race === 'Sirène') {
    const maxStacks = def.awakening?.sireneMaxStacks ?? raceConstants.sirene.maxStacks;
    def.sireneStacks = Math.min(maxStacks, (def.sireneStacks || 0) + 1);
    log.push(`${playerColor} 🧜 ${def.name} gagne un stack Sirène (${def.sireneStacks}/${maxStacks}).`);
  }
  if (def.class === 'Briseur de Sort') {
    const shield = Math.max(1, Math.round(adjusted * classConstants.briseurSort.shieldFromSpellDamage + def.base.cap * classConstants.briseurSort.shieldFromCap));
    def.shield = (def.shield || 0) + shield;
    log.push(`${playerColor} 🧱 ${def.name} convertit le spell en bouclier (+${shield}).`);
  }
}

function applyDamage(att, def, raw, isCrit, log, playerColor, atkPassive, defPassive, atkUnicorn, defUnicorn, auraBoost, applyOnHitPassives = true, isSpellDamage = false) {
  let adjusted = raw;
  if (atkUnicorn) adjusted = Math.round(adjusted * (1 + atkUnicorn.outgoing));
  if (auraBoost) adjusted = Math.round(adjusted * (1 + auraBoost));
  if (def.spectralMarked && def.spectralMarkBonus) adjusted = Math.round(adjusted * (1 + def.spectralMarkBonus));
  if (defUnicorn) adjusted = Math.round(adjusted * (1 + defUnicorn.incoming));
  if (defPassive?.id === 'obsidian_skin' && isCrit) adjusted = Math.round(adjusted * (1 - defPassive.levelData.critReduction));
  if (def?.ability?.type === 'bone_guard' && def.boneGuardActive) {
    adjusted = Math.round(adjusted * 0.7);
  }
  adjusted = applyOutgoingAwakeningBonus(att, adjusted);
  adjusted = applyIncomingAwakeningModifiers(def, adjusted);

  if (def.dodge) {
    def.dodge = false;
    log.push(`${playerColor} 💨 ${def.name} esquive habilement l'attaque !`);
    return 0;
  }
  const speedDuel = getSpeedDuelBonuses(def, att);
  if (speedDuel.dodge > 0 && Math.random() < speedDuel.dodge) {
    log.push(`${playerColor} 💨 ${def.name} esquive grâce au duel de vitesse (${Math.round(speedDuel.dodge * 100)}%).`);
    return 0;
  }
  if (def.shield > 0 && adjusted > 0) {
    const absorbed = Math.min(def.shield, adjusted);
    def.shield -= absorbed;
    adjusted -= absorbed;
    log.push(`${playerColor} 🛡️ ${def.name} absorbe ${absorbed} points de dégâts grâce à un bouclier`);

    if (def?.ability?.type === 'lich_shield' && def.shield <= 0 && !def.shieldExploded) {
      def.shieldExploded = true;
      let explosionDamage = Math.max(1, Math.round(def.maxHP * 0.2));
      if (att.shield > 0 && explosionDamage > 0) {
        const absorbedExplosion = Math.min(att.shield, explosionDamage);
        att.shield -= absorbedExplosion;
        explosionDamage -= absorbedExplosion;
        log.push(`${playerColor} 🛡️ ${att.name} absorbe ${absorbedExplosion} dégâts de l'explosion grâce au bouclier`);
      }
      if (explosionDamage > 0) {
        explosionDamage = applyIncomingAwakeningModifiers(att, explosionDamage);
        att.currentHP -= explosionDamage;
        if (att.awakening?.damageStackBonus) att.awakening.damageTakenStacks += 1;
        log.push(`${playerColor} 💥 Le bouclier de ${def.name} explose et inflige ${explosionDamage} points de dégâts à ${att.name}`);
        if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
          reviveUndead(att, def, log, playerColor);
        }
      }
    }
  }
  if (adjusted > 0) {
    def.currentHP -= adjusted;
    def.maso_taken = (def.maso_taken || 0) + adjusted;
    if (def.awakening?.damageStackBonus) def.awakening.damageTakenStacks += 1;

    if (isSpellDamage) {
      grantOnSpellHitDefenderEffects(def, adjusted, log, playerColor);
    }

    if (def.reflect && def.currentHP > 0) {
      const back = Math.round(def.reflect * adjusted);
      att.currentHP -= back;
      def.reflect = false;
      log.push(`${playerColor} 🔁 ${def.name} riposte et renvoie ${back} points de dégâts à ${att.name}`);
    }
  }
  if (applyOnHitPassives && atkPassive?.id === 'spectral_mark' && adjusted > 0 && !def.spectralMarked) {
    def.spectralMarked = true;
    def.spectralMarkBonus = atkPassive.levelData.damageTakenBonus;
    log.push(`${playerColor} 🟣 ${def.name} est marqué et subira +${Math.round(def.spectralMarkBonus * 100)}% dégâts.`);
  }
  if (applyOnHitPassives && atkPassive?.id === 'essence_drain' && adjusted > 0) {
    const heal = Math.max(1, Math.round(adjusted * atkPassive.levelData.healPercent * getAntiHealFactor(def)));
    att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
    log.push(`${playerColor} 🩸 ${att.name} siphonne ${heal} points de vie grâce au Vol d'essence`);
  }

  if (def?.ability?.type === 'bone_guard' && !def.boneGuardActive && def.currentHP > 0 && def.currentHP <= def.maxHP * 0.4) {
    def.boneGuardActive = true;
    log.push(`${playerColor} 💀 ${def.name} renforce sa carapace et réduit les dégâts reçus !`);
  }

  return adjusted;
}

function processPlayerAction(att, def, log, isP1, turn) {
  if (att.currentHP <= 0 || def.currentHP <= 0) return;
  // Le mannequin d'entraînement ne fait rien
  if (att.userId === 'training-dummy') return;

  const playerColor = isP1 ? '[P1]' : '[P2]';
  const attackerPassive = getPassiveDetails(att.mageTowerPassive);
  const defenderPassive = getPassiveDetails(def.mageTowerPassive);
  const attackerUnicorn = getUnicornPactTurnData(attackerPassive, turn);
  const defenderUnicorn = getUnicornPactTurnData(defenderPassive, turn);
  const auraBonus = getAuraBonus(attackerPassive, turn);
  const consumeAuraSpellCapMultiplier = () => {
    if (attackerPassive?.id !== 'aura_overload') return 1;
    if (att.firstSpellCapBoostUsed) return 1;
    att.firstSpellCapBoostUsed = true;
    return 1 + (attackerPassive?.levelData?.spellCapBonus ?? 0);
  };
  let skillUsed = false;

  if (att.stunnedTurns > 0) {
    att.stunnedTurns -= 1;
    if (att.stunnedTurns <= 0) att.stunned = false;
    log.push(`${playerColor} 😵 ${att.name} est étourdi et ne peut pas agir ce tour`);
    return;
  }

  att.reflect = false;
  for (const k of Object.keys(cooldowns)) {
    const effectiveCd = getMindflayerSpellCooldown(att, def, k);
    att.cd[k] = (att.cd[k] % effectiveCd) + 1;
  }

  // Mindflayer : vole le sort AVANT qu'il ne se lance
  let spellStolen = false;
  const wouldCastSpell =
    (att.class === 'Demoniste') ||
    (att.class === 'Masochiste' && att.cd.maso === getMindflayerSpellCooldown(att, def, 'maso') && att.maso_taken > 0) ||
    (att.class === 'Paladin' && att.cd.pal === getMindflayerSpellCooldown(att, def, 'pal')) ||
    (att.class === 'Healer' && att.cd.heal === getMindflayerSpellCooldown(att, def, 'heal')) ||
    (att.class === 'Succube' && att.cd.succ === getMindflayerSpellCooldown(att, def, 'succ')) ||
    (att.class === 'Bastion' && att.cd.bast === getMindflayerSpellCooldown(att, def, 'bast')) ||
    (att.class === 'Voleur' && att.cd.rog === getMindflayerSpellCooldown(att, def, 'rog')) ||
    (att.class === 'Mage' && att.cd.mag === getMindflayerSpellCooldown(att, def, 'mag')) ||
    (att.class === 'Guerrier' && att.cd.war === getMindflayerSpellCooldown(att, def, 'war')) ||
    (att.class === 'Archer' && att.cd.arc === getMindflayerSpellCooldown(att, def, 'arc'));

  if (wouldCastSpell && def?.race === 'Mindflayer' && !def.mindflayerSpellTheftUsed && def.currentHP > 0 && att.currentHP > 0) {
    spellStolen = true;
    const defColor = isP1 ? '[P2]' : '[P1]';
    triggerMindflayerSpellTheft(att, def, log, defColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
  }

  const turnEffects = onTurnStart(att.weaponState, att, turn);
  if (turnEffects.log.length > 0) log.push(...turnEffects.log.map(e => `${playerColor} ${e}`));
  if (turnEffects.regen > 0) {
    const weaponRegen = Math.max(1, Math.round(turnEffects.regen * getAntiHealFactor(def)));
    att.currentHP = Math.min(att.maxHP, att.currentHP + weaponRegen);
  }

  if (att.race === 'Sylvari') {
    const regenPercent = att.awakening ? (att.awakening.regenPercent ?? 0) : raceConstants.sylvari.regenPercent;
    const heal = Math.max(1, Math.round(att.maxHP * regenPercent * getAntiHealFactor(def)));
    att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
    log.push(`${playerColor} 🌿 ${att.name} régénère naturellement et récupère ${heal} points de vie`);
  }

  if (att.class === 'Demoniste' && !spellStolen) {
    const { capBase, capPerCap, ignoreResist, stackPerAuto } = classConstants.demoniste;
    const stackBonus = stackPerAuto * (att.familiarStacks || 0);
    const hit = Math.max(1, Math.round((capBase + capPerCap * att.base.cap + stackBonus) * att.base.cap));
    const raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
    const inflicted = applyDamage(att, def, raw, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus, true, true);
    log.push(`${playerColor} 💠 Le familier de ${att.name} attaque ${def.name} et inflige ${inflicted} points de dégâts`);
    if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) reviveUndead(def, att, log, playerColor);
  }

  if (att.class === 'Masochiste' && !spellStolen) {
    if (att.cd.maso === getMindflayerSpellCooldown(att, def, 'maso') && att.maso_taken > 0) {
      skillUsed = true;
      const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
      const dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerCap * att.base.cap)));
      const healAmount = Math.max(1, Math.round(att.maso_taken * healPercent * getAntiHealFactor(def)));
      att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
      att.maso_taken = 0;
      let spellDmg = applyMindflayerSpellMod(att, def, dmg, 'maso', log, playerColor);
      const inflicted = applyDamage(att, def, spellDmg, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus, true, true);
      const masoSpellEffects = onSpellCast(att.weaponState, att, def, dmg, 'maso');
      if (masoSpellEffects.doubleCast && masoSpellEffects.secondCastDamage > 0) {
        applyDamage(att, def, masoSpellEffects.secondCastDamage, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus, false);
        log.push(`${playerColor} ${masoSpellEffects.log.join(' ')}`);
      }
      log.push(`${playerColor} 🩸 ${att.name} renvoie les dégâts accumulés: inflige ${inflicted} points de dégâts et récupère ${healAmount} points de vie`);
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) reviveUndead(def, att, log, playerColor);
    }
  }

  if (att.bleed_stacks > 0) {
    let bleedDmg = att.bleedPercentPerStack
      ? Math.max(1, Math.round(att.maxHP * att.bleedPercentPerStack * att.bleed_stacks))
      : Math.ceil(att.bleed_stacks / raceConstants.lycan.bleedDivisor);
    if (att.awakening?.damageTakenMultiplier) bleedDmg = Math.max(1, Math.round(bleedDmg * att.awakening.damageTakenMultiplier));
    // Réduction des dégâts %PV max contre le World Boss
    if (att.isWorldBoss && att.bleedPercentPerStack) {
      bleedDmg = Math.max(1, Math.round(bleedDmg * (1 - WORLD_BOSS_CONSTANTS.PERCENT_HP_DAMAGE_REDUCTION)));
    }
    att.currentHP -= bleedDmg;
    log.push(`${playerColor} 🩸 ${att.name} saigne abondamment et perd ${bleedDmg} points de vie`);
    if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) reviveUndead(att, def, log, playerColor);
  }

  if (att.class === 'Paladin' && att.cd.pal === getMindflayerSpellCooldown(att, def, 'pal') && !spellStolen) {
    skillUsed = true;
    const { reflectBase, reflectPerCap } = classConstants.paladin;
    let reflectValue = reflectBase + reflectPerCap * att.base.cap;
    if (att.race === 'Mindflayer' && getMindflayerSpellCooldown(att, def, 'pal') <= 1) {
      const casterAwakening = att.awakening || {};
      const bonus = casterAwakening.mindflayerNoCooldownSpellBonus ?? raceConstants.mindflayer.noCooldownSpellBonus;
      if (bonus > 0) {
        reflectValue *= (1 + bonus);
        log.push(`${playerColor} 🦑 Sort sans CD — ${att.name} riposte renforcée +${Math.round(bonus * 100)}% !`);
      }
    }
    att.reflect = reflectValue;
    log.push(`${playerColor} 🛡️ ${att.name} se prépare à riposter et renverra ${Math.round(att.reflect * 100)}% des dégâts`);
  }

  if (att.class === 'Healer' && att.cd.heal === getMindflayerSpellCooldown(att, def, 'heal') && !spellStolen) {
    skillUsed = true;
    const miss = att.maxHP - att.currentHP;
    const { missingHpPercent, capScale } = classConstants.healer;
    const spellCapMultiplier = consumeAuraSpellCapMultiplier();
    const sireneBoost = att.race === 'Sirène' ? ((att.awakening?.sireneStackBonus ?? raceConstants.sirene.stackBonus) * (att.sireneStacks || 0)) : 0;
    let baseHeal = Math.max(1, Math.round((missingHpPercent * miss + capScale * att.base.cap * spellCapMultiplier) * (1 + sireneBoost)));
    if (att.race === 'Mindflayer' && getMindflayerSpellCooldown(att, def, 'heal') <= 1) {
      const casterAwakening = att.awakening || {};
      const bonus = casterAwakening.mindflayerNoCooldownSpellBonus ?? raceConstants.mindflayer.noCooldownSpellBonus;
      if (bonus > 0) {
        baseHeal = Math.round(baseHeal * (1 + bonus));
        log.push(`${playerColor} 🦑 Sort sans CD — ${att.name} soin renforcé +${Math.round(bonus * 100)}% !`);
      }
    }
    baseHeal = Math.max(1, Math.round(baseHeal * getAntiHealFactor(def)));
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
      applyDamage(att, def, bonusDmg, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
      log.push(`${playerColor} ${healEffects.log.join(' ')}`);
    }
  }


  if (att.class === 'Succube' && att.cd.succ === getMindflayerSpellCooldown(att, def, 'succ') && !spellStolen) {
    skillUsed = true;
    let raw = dmgCap(Math.round(att.base.auto + att.base.cap * classConstants.succube.capScale), def.base.rescap);
    raw = applyMindflayerSpellMod(att, def, raw, 'succ', log, playerColor);
    const inflicted = applyDamage(att, def, raw, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus, true, true);
    def.succubeWeakenNextAttack = true;
    log.push(`${playerColor} 💋 ${att.name} fouette ${def.name} et inflige ${inflicted} dégâts. La prochaine attaque de ${def.name} est affaiblie.`);
  }

  const isBastion = !spellStolen && att.class === 'Bastion' && att.cd.bast === getMindflayerSpellCooldown(att, def, 'bast');
  if (isBastion) {
    skillUsed = true;
    let raw = dmgCap(Math.round(att.base.auto + att.base.cap * classConstants.bastion.capScale + att.base.def * classConstants.bastion.defScale), def.base.rescap);
    raw = applyMindflayerSpellMod(att, def, raw, 'bast', log, playerColor);
    const inflicted = applyDamage(att, def, raw, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus, true, true);
    log.push(`${playerColor} 🏰 ${att.name} percute ${def.name} et inflige ${inflicted} dégâts avec la Charge du Rempart.`);
  }

  if (att.class === 'Voleur' && att.cd.rog === getMindflayerSpellCooldown(att, def, 'rog') && !spellStolen) {
    skillUsed = true;
    att.dodge = true;
    log.push(`${playerColor} 🌀 ${att.name} entre dans une posture d'esquive et évitera la prochaine attaque`);
  }

  // ===== CAPACITÉS SPÉCIALES DES BOSS =====
  if (att.isBoss && att.ability) {
    att.cd.boss_ability = (att.cd.boss_ability || 0) + 1;

    // Bandit: Saignement tous les N tours
    if (att.bossId === 'bandit' && att.cd.boss_ability >= att.ability.cooldown) {
      def.bleed_stacks = (def.bleed_stacks || 0) + (att.ability.effect?.stacksPerHit || 1);
      log.push(`${playerColor} 🗡️ ${att.name} empoisonne sa lame et applique un saignement !`);
      att.cd.boss_ability = 0;
    }

    // Dragon: Sort dévastateur tous les N tours
    if (att.bossId === 'dragon' && att.cd.boss_ability >= att.ability.cooldown) {
      const spellDmg = Math.round(att.base.cap * (1 + (att.ability.effect?.damageBonus || 0.5)));
      const raw = dmgCap(spellDmg, def.base.rescap);
      const inflicted = applyDamage(att, def, raw, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus, true, true);
      log.push(`${playerColor} 🔥 ${att.name} lance un Souffle de Flammes dévastateur et inflige ${inflicted} points de dégâts`);
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def, att, log, playerColor);
      }
      att.cd.boss_ability = 0;
    }
  }

  const isMage = !spellStolen && att.class === 'Mage' && att.cd.mag === getMindflayerSpellCooldown(att, def, 'mag');
  const isWar = !spellStolen && att.class === 'Guerrier' && att.cd.war === getMindflayerSpellCooldown(att, def, 'war');
  const isArcher = !spellStolen && att.class === 'Archer' && att.cd.arc === getMindflayerSpellCooldown(att, def, 'arc');
  skillUsed = skillUsed || isMage || isWar || isArcher;

  // Mindflayer éveillé: marquer le flag après le premier sort lancé (le -1 CD ne s'applique qu'une fois)
  if (skillUsed && att.race === 'Mindflayer' && !att.mindflayerFirstCDUsed) {
    const aw = att.awakening || {};
    const reduction = aw.mindflayerOwnCooldownReductionTurns ?? raceConstants.mindflayer.ownCooldownReductionTurns;
    if (reduction > 0) att.mindflayerFirstCDUsed = true;
  }

  let mult = 1.0;
  if (att.succubeWeakenNextAttack) {
    mult *= (1 - classConstants.succube.nextAttackReduction);
    att.succubeWeakenNextAttack = false;
    log.push(`${playerColor} 💋 ${att.name} est affaibli et inflige -${Math.round(classConstants.succube.nextAttackReduction * 100)}% dégâts sur cette attaque.`);
  }
  if (att.race === 'Orc' && att.currentHP < raceConstants.orc.lowHpThreshold * att.maxHP) mult = raceConstants.orc.damageBonus;
  if (turnEffects.damageMultiplier !== 1) mult *= turnEffects.damageMultiplier;

  const baseHits = isBastion ? 0 : isArcher ? classConstants.archer.hitCount : 1;
  const totalHits = baseHits + (turnEffects.bonusAttacks || 0);
  let total = 0;
  let wasCrit = false;

  const forceCrit = attackerPassive?.id === 'obsidian_skin' && att.currentHP <= att.maxHP * attackerPassive.levelData.critThreshold;

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
      raw = applyMindflayerSpellMod(att, def, raw, 'mag', log, playerColor);
      const spellEffects = onSpellCast(att.weaponState, att, def, raw, 'mage');
      if (spellEffects.doubleCast) {
        applyDamage(att, def, spellEffects.secondCastDamage, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus, false);
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
      raw = applyMindflayerSpellMod(att, def, raw, 'war', log, playerColor);
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
      raw = applyMindflayerSpellMod(att, def, raw, 'arc', log, playerColor);
    } else {
      const autoCapBonus = getBriseurAutoBonus(att);
      raw = dmgPhys(Math.round((att.base.auto + autoCapBonus) * attackMultiplier), def.base.def);
      if (att.race === 'Lycan') {
        const bleedStacks = att.awakening ? (att.awakening.bleedStacksPerHit ?? 0) : raceConstants.lycan.bleedPerHit;
        if (bleedStacks > 0) {
          def.bleed_stacks = (def.bleed_stacks || 0) + bleedStacks;
        }
        if (att.awakening?.bleedPercentPerStack) def.bleedPercentPerStack = att.awakening.bleedPercentPerStack;
      }
    }

    if ((isMage || isWar || (isArcher && !isBonusAttack)) && att.race === 'Sirène' && (att.sireneStacks || 0) > 0) {
      const stackBonus = att.awakening?.sireneStackBonus ?? raceConstants.sirene.stackBonus;
      raw = Math.max(1, Math.round(raw * (1 + stackBonus * att.sireneStacks)));
    }

    if (isCrit) {
      const critDamage = Math.round(raw * getCritMultiplier(att, def));
      raw = modifyCritDamage(att.weaponState, critDamage);
    }

    const inflicted = applyDamage(att, def, raw, isCrit, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus, true, (isMage || isWar || (isArcher && !isBonusAttack)));
    if (att.class === 'Demoniste' && !isMage && !isWar && !isArcher && !isBonusAttack) {
      att.familiarStacks = (att.familiarStacks || 0) + 1;
    }

    if (!isMage) {
      const attackEffects = onAttack(att.weaponState, att, def, inflicted);
      if (attackEffects.stunTarget) Object.assign(def, applyMjollnirStun(def));
      if (attackEffects.atkDebuff && !def.base._gungnirDebuffed) def.base = applyGungnirDebuff(def.base);
      if (attackEffects.log.length > 0) log.push(`${playerColor} ${attackEffects.log.join(' ')}`);
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

  if (attackerPassive?.id === 'elemental_fury' && skillUsed) {
    const baseLightning = Math.max(1, Math.round(att.base.auto * attackerPassive.levelData.lightningPercent));
    const lightningRaw = dmgPhys(baseLightning, def.base.def);
    const lightningDamage = applyDamage(att, def, lightningRaw, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
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

}

// ============================================================================
// SIMULATION COMPLÈTE (synchrone) — avec steps pour animation
// ============================================================================

function applyGnomeCapBonus(fighter, opponent) {
  if (fighter.race !== 'Gnome') return;
  const speedDuel = getSpeedDuelBonuses(fighter, opponent);
  if (speedDuel.capBonus > 0) {
    fighter.base = { ...fighter.base, cap: Math.round(fighter.base.cap * (1 + speedDuel.capBonus)) };
  }
}

export function simulerMatch(char1, char2) {
  const p1 = preparerCombattant(char1);
  const p2 = preparerCombattant(char2);

  // Appliquer le bonus de CAP conditionnel du Gnome
  applyGnomeCapBonus(p1, p2);
  applyGnomeCapBonus(p2, p1);

  const allLogs = [];
  const steps = [];

  // Phase intro
  const introLogs = [`⚔️ Le combat épique commence entre ${p1.name} et ${p2.name} !`];
  applyStartOfCombatPassives(p1, p2, introLogs, '[P1]');
  applyStartOfCombatPassives(p2, p1, introLogs, '[P2]');
  allLogs.push(...introLogs);
  steps.push({ phase: 'intro', logs: introLogs.slice(), p1HP: p1.currentHP, p2HP: p2.currentHP, p1Shield: p1.shield, p2Shield: p2.shield });

  let turn = 1;
  while (p1.currentHP > 0 && p2.currentHP > 0 && turn <= generalConstants.maxTurns) {
    // Turn start
    const turnStartLogs = [`--- Début du tour ${turn} ---`];
    const p1Unicorn = getUnicornPactTurnData(getPassiveDetails(p1.mageTowerPassive), turn);
    const p2Unicorn = getUnicornPactTurnData(getPassiveDetails(p2.mageTowerPassive), turn);
    if (p1Unicorn) turnStartLogs.push(`🦄 Pacte de la Licorne — ${p1.name}: ${p1Unicorn.label}`);
    if (p2Unicorn) turnStartLogs.push(`🦄 Pacte de la Licorne — ${p2.name}: ${p2Unicorn.label}`);

    allLogs.push(...turnStartLogs);
    steps.push({ phase: 'turn_start', turn, logs: turnStartLogs.slice(), p1HP: p1.currentHP, p2HP: p2.currentHP, p1Shield: p1.shield, p2Shield: p2.shield });

    // Determine order
    const p1HasPriority = p1.weaponState?.isLegendary
      && p1.weaponState.weaponId === 'epee_legendaire'
      && ((p1.weaponState.counters?.turnCount ?? 0) + 1) % weaponConstants.zweihander.triggerEveryNTurns === 0;
    const p2HasPriority = p2.weaponState?.isLegendary
      && p2.weaponState.weaponId === 'epee_legendaire'
      && ((p2.weaponState.counters?.turnCount ?? 0) + 1) % weaponConstants.zweihander.triggerEveryNTurns === 0;

    let first;
    if (p1Unicorn && !p2Unicorn) {
      first = p1Unicorn.label === 'Tour A' ? p1 : p2;
    } else if (p2Unicorn && !p1Unicorn) {
      first = p2Unicorn.label === 'Tour A' ? p2 : p1;
    } else if (p1HasPriority && !p2HasPriority) {
      first = p1;
    } else if (p2HasPriority && !p1HasPriority) {
      first = p2;
    } else {
      first = p1.base.spd >= p2.base.spd ? p1 : p2;
    }
    const second = first === p1 ? p2 : p1;
    const firstIsP1 = first === p1;

    // First player action
    const firstActionLogs = [];
    processPlayerAction(first, second, firstActionLogs, firstIsP1, turn);
    allLogs.push(...firstActionLogs);
    p1.currentHP = Math.min(p1.maxHP, p1.currentHP);
    p2.currentHP = Math.min(p2.maxHP, p2.currentHP);
    steps.push({ phase: 'action', player: firstIsP1 ? 1 : 2, logs: firstActionLogs.slice(), p1HP: p1.currentHP, p2HP: p2.currentHP, p1Shield: p1.shield, p2Shield: p2.shield });

    // Second player action
    if (p1.currentHP > 0 && p2.currentHP > 0) {
      const secondActionLogs = [];
      processPlayerAction(second, first, secondActionLogs, !firstIsP1, turn);
      allLogs.push(...secondActionLogs);
      p1.currentHP = Math.min(p1.maxHP, p1.currentHP);
      p2.currentHP = Math.min(p2.maxHP, p2.currentHP);
      steps.push({ phase: 'action', player: !firstIsP1 ? 1 : 2, logs: secondActionLogs.slice(), p1HP: p1.currentHP, p2HP: p2.currentHP, p1Shield: p1.shield, p2Shield: p2.shield });
    }

    turn++;
  }

  const winnerIsP1 = p1.currentHP > 0;
  const winner = winnerIsP1 ? p1 : p2;
  const loser = winnerIsP1 ? p2 : p1;
  const victoryLog = `🏆 ${winner.name} remporte glorieusement le combat contre ${loser.name} !`;
  allLogs.push(victoryLog);
  steps.push({ phase: 'victory', logs: [victoryLog], p1HP: p1.currentHP, p2HP: p2.currentHP, p1Shield: p1.shield, p2Shield: p2.shield });

  return {
    combatLog: allLogs,
    steps,
    p1MaxHP: p1.maxHP,
    p2MaxHP: p2.maxHP,
    winnerId: winner.userId || winner.id,
    winnerNom: winner.name,
    loserId: loser.userId || loser.id,
    loserNom: loser.name
  };
}
