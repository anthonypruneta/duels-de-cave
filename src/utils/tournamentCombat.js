/**
 * Simulation de combat PvP pour le tournoi
 * Réplique fidèle du moteur de Combat.jsx en version synchrone
 * Retourne des "steps" avec snapshots HP pour l'animation client
 */

import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives.js';
import { applyStatBoosts, getEmptyStatBoosts } from './statPoints.js';
import {
  applyGungnirDebuff, applyMjollnirStun, applyPassiveWeaponStats,
  initWeaponCombatState, modifyCritDamage, onAttack, onHeal, onCapacityCast, onTurnStart, rollHealCrit,
  applyAnathemeDebuff, applyLabrysBleed, processLabrysBleed, getVerdictCapacityBonus, getVerdictCooldownPenalty, shouldSkipVerdictDemonFamiliar,
  applyForgeUpgrade, getPenduleCooldownReduction, consumePenduleCdCharge, getPenduleSpellBonus
} from './weaponEffects.js';
import {
  cooldowns, classConstants, raceConstants, generalConstants, weaponConstants,
  dmgPhys, dmgCap, calcCritChance, getCritMultiplier, getSpeedDuelBonuses,
  getSubclassCapacityConstants
} from '../data/combatMechanics.js';
import { applyAwakeningToBase, buildAwakeningState, getAwakeningEffect, removeBaseRaceFlatBonusesIfAwakened } from './awakening.js';
import { WORLD_BOSS_CONSTANTS } from '../data/worldBoss.js';
import { isForgeActive } from '../data/featureFlags.js';
import { hasAnyForgeUpgrade } from '../data/forgeDungeon.js';
import { getSubclassStatBonuses } from '../data/subclasses.js';

// ============================================================================
// HELPERS
// ============================================================================

function getAntiHealFactor(opponent) {
  let factor = 1;
  if (opponent?.class === 'Briseur de Sort') factor *= (1 - classConstants.briseurSort.antiHealReduction);
  const list = getPassiveDetailsList(opponent);
  const passive = getPassiveById(list, 'rituel_fracture');
  if (passive) factor *= (1 - (passive.levelData.healReduction || 0));
  if (opponent?.suddenDeath) factor *= (1 - generalConstants.suddenDeathHealReduction);
  return factor;
}

function getBriseurAutoBonus(att) {
  if (att.class !== 'Briseur de Sort') return 0;
  return Math.round(att.base.cap * classConstants.briseurSort.autoCapBonus);
}

/**
 * CAP effective pour les capacités (dégâts/soins) si le combattant a le Sceptre du Roi-Sorcier.
 * Bonus additif: +8% par stack (max 7 = +56%). La base est figée au premier usage de capacité.
 * Le sort EN COURS bénéficie du stack qu'on va gagner en le lançant (premier sort = +8%, 2e = +16%, etc.).
 */
function getEffectiveCapForSceptre(att) {
  const ws = att?.weaponState;
  if (!ws?.isLegendary || ws?.weaponId !== 'sceptre_legendaire') return att?.base?.cap ?? 0;
  if (att._sceptreBaseCap == null) att._sceptreBaseCap = att.base.cap;
  const maxStacks = weaponConstants.sceptreRoiSorcier?.maxCapStacks ?? 7;
  const currentStacks = ws?.counters?.sceptreCapStacks ?? 0;
  // Le sort actuel compte comme "déjà stacké" : premier sort +8%, 2e +16%, ... (cap à maxStacks)
  const effectiveStacks = Math.min(maxStacks, currentStacks + 1);
  // Accepter 0.08 (code) ou 10 (page équilibrage en %) : si > 1 on considère que c'est en %
  const pctRaw = weaponConstants.sceptreRoiSorcier?.capStackPercent ?? 0.08;
  const pct = pctRaw > 1 ? pctRaw / 100 : pctRaw;
  return Math.max(1, Math.round(att._sceptreBaseCap * (1 + pct * effectiveStacks)));
}

function applySceptreCapBuff(att, spellEffects, log, playerColor) {
  if (spellEffects.sceptreCapBuff > 0) {
    const n = att.weaponState?.counters?.sceptreCapStacks ?? 0;
    const maxStacks = weaponConstants.sceptreRoiSorcier?.maxCapStacks ?? 7;
    const pctRaw = spellEffects.sceptreCapBuff;
    const pctDisplay = pctRaw > 1 ? pctRaw : Math.round(pctRaw * 100);
    log.push(`${playerColor} 🏆 Sceptre du Roi-Sorcier: +${pctDisplay}% CAP (stack ${n}/${maxStacks})`);
  }
}

function getPassiveDetails(passive) {
  if (!passive) return null;
  const base = getMageTowerPassiveById(passive.id);
  const levelData = getMageTowerPassiveLevel(passive.id, passive.level);
  if (!base || !levelData) return null;
  return { ...base, level: passive.level, levelData };
}

/** Liste des passifs d'un combattant (principal + extension) pour appliquer les deux en combat. */
function getPassiveDetailsList(fighter) {
  const primary = getPassiveDetails(fighter?.mageTowerPassive);
  const extension = getPassiveDetails(fighter?.mageTowerExtensionPassive);
  return [primary, extension].filter(Boolean);
}

/** Premier passif de la liste ayant cet id (principal ou extension). */
function getPassiveById(list, id) {
  return list?.find((p) => p?.id === id) ?? null;
}

function getUnicornPactTurnData(passiveDetails, turn) {
  if (!passiveDetails || passiveDetails.id !== 'unicorn_pact') return null;
  const isTurnA = turn % 2 === 1;
  return isTurnA ? { label: 'Tour A', ...passiveDetails.levelData.turnA } : { label: 'Tour B', ...passiveDetails.levelData.turnB };
}

/** Pacte Licorne : pris sur le premier passif (principal ou extension) qui l'a. */
function getUnicornPactTurnDataFromList(passiveList, turn) {
  if (!passiveList?.length) return null;
  for (const p of passiveList) {
    const data = getUnicornPactTurnData(p, turn);
    if (data) return data;
  }
  return null;
}

function getAuraBonus(passiveDetails, turn) {
  if (!passiveDetails || passiveDetails.id !== 'aura_overload') return 0;
  return turn <= passiveDetails.levelData.turns ? passiveDetails.levelData.damageBonus : 0;
}

/** Bonus Aura : somme des bonus de tous les passifs aura_overload (principal + extension). */
function getAuraBonusFromList(passiveList, turn) {
  if (!passiveList?.length) return 0;
  return passiveList.reduce((sum, p) => sum + getAuraBonus(p, turn), 0);
}

/** Boss Licorne (forêt) : Alternance mystique — tour impair +15%, tour pair -15% dégâts infligés/reçus */
function getUnicornCycleMultiplier(turn) {
  return turn % 2 === 1 ? 1.15 : 0.85;
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
    if (effect.turtlekinResetAt50) acc.turtlekinResetAt50 = true;
    if (typeof effect.damageBonus === 'number') acc.damageBonus = effect.damageBonus;

    return acc;
  }, {});
}

function hasMortVivantRevive(fighter) {
  return (fighter.race === 'Mort-vivant' || (fighter.awakening?.revivePercent ?? 0) > 0) && !fighter.undead;
}

function applyStartOfCombatPassives(attacker, defender, log, label) {
  const passives = [attacker.mageTowerPassive, attacker.mageTowerExtensionPassive].filter(Boolean);
  for (const p of passives) {
    const passiveDetails = getPassiveDetails(p);
    if (passiveDetails?.id === 'arcane_barrier') {
      const shieldValue = Math.max(1, Math.round(attacker.maxHP * passiveDetails.levelData.shieldPercent));
      attacker.shield = (attacker.shield || 0) + shieldValue;
      log.push(`${label} 🛡️ Barrière arcanique: ${attacker.name} gagne un bouclier de ${shieldValue} PV.`);
    }
    if (passiveDetails?.id === 'mind_breach' && !defender.isWorldBoss) {
      const reduction = passiveDetails.levelData.defReduction;
      defender.base.def = Math.max(0, Math.round(defender.base.def * (1 - reduction)));
      log.push(`${label} 🧠 Brèche mentale: ${defender.name} perd ${Math.round(reduction * 100)}% de DEF.`);
    }
  }

  if (attacker?.ability?.type === 'lich_shield') {
    attacker.shield = Math.max(1, Math.round(attacker.maxHP * 0.2));
    attacker.shieldExploded = false;
    log.push(`${label} 🧟 Barrière macabre: ${attacker.name} se protège avec ${attacker.shield} points de bouclier.`);
  }

  if (attacker?.ability?.type === 'bone_guard') {
    attacker.boneGuardActive = false;
  }

  if (attacker.class === 'Bastion') {
    const bastionC = getSubclassCapacityConstants(attacker.class, attacker.subclass?.id);
    const startPct = bastionC.startShieldFromDef ?? classConstants.bastion.startShieldFromDef;
    const shieldValue = Math.max(1, Math.round(attacker.base.def * startPct));
    attacker.shield = (attacker.shield || 0) + shieldValue;
    log.push(`${label} 🏰 Rempart initial: ${attacker.name} gagne un bouclier de ${shieldValue} PV (${Math.round(startPct * 100)}% DEF).`);
  }

  // Entrave Arcanique : retarde la première capacité de l'adversaire de 1 tour
  const attackerPassivesForEntrave = [attacker.mageTowerPassive, attacker.mageTowerExtensionPassive].filter(Boolean);
  for (const p of attackerPassivesForEntrave) {
    const passiveDetails = getPassiveDetails(p);
    if (passiveDetails?.id === 'entrave_arcanique') {
      defender._entraveCdDelay = passiveDetails.levelData.enemyCdDelay || 1;
      defender._entraveFirstCapUsed = false;
      const entraveBonus = passiveDetails.levelData.damageBonus || 0;
      if (entraveBonus > 0) attacker._entraveDamageBonus = entraveBonus;
      log.push(`${label} ⛓️ Entrave Arcanique: la première capacité de ${defender.name} est retardée de ${defender._entraveCdDelay} tour(s) !`);
    }
  }

  defender.spectralMarked = false;
  defender.spectralMarkBonus = 0;
}

// ============================================================================
// PRÉPARATION COMBATTANT
// ============================================================================

export function preparerCombattant(char) {
  const weaponId = char?.equippedWeaponId || char?.equippedWeaponData?.id || null;
  const effectiveLevel = char.awakeningForced ? 999 : (char.level ?? 1);
  const forestBoosts = { ...getEmptyStatBoosts(), ...(char.forestBoosts || {}) };
  const baseWithBoostsRaw = applyStatBoosts(char.base, forestBoosts);
  const baseWithBoosts = removeBaseRaceFlatBonusesIfAwakened(baseWithBoostsRaw, char.race, effectiveLevel);
  // Boss / NPC avec forge (ex. labyrinthe 100) : même logique que joueur avec forge (skip flat, appliquer %)
  const hasForgeData = char.forgeUpgrade && hasAnyForgeUpgrade(char.forgeUpgrade);
  const skipWeaponFlat = hasForgeData && (isForgeActive() || char.awakeningForced);
  const passiveList = getPassiveDetailsList(char);
  const baseWithWeapon = applyPassiveWeaponStats(baseWithBoosts, weaponId, char.class, char.race, passiveList, skipWeaponFlat);
  const additionalAwakeningEffects = (char.additionalAwakeningRaces || [])
    .map((race) => getAwakeningEffect(race, effectiveLevel));
  const awakeningEffect = mergeAwakeningEffects([
    getAwakeningEffect(char.race, effectiveLevel),
    ...additionalAwakeningEffects
  ]);
  const baseWithAwakening = applyAwakeningToBase(baseWithWeapon, awakeningEffect);
  const baseWithoutWeapon = applyAwakeningToBase(baseWithBoosts, awakeningEffect);
  // Forge des Légendes: appliquer les % d'upgrade sur les stats totales
  const baseWithForge = applyForgeUpgrade(baseWithAwakening, char.forgeUpgrade);
  const baseWithClassPassive = char.class === 'Bastion'
    ? { ...baseWithForge, def: Math.max(1, Math.round(baseWithForge.def * (1 + classConstants.bastion.defPercentBonus))) }
    : baseWithForge;
  // Bonus de stats des sous-classes (Collège Kunugigaoka)
  let baseFinal = baseWithClassPassive;
  const subclassBonuses = getSubclassStatBonuses(char.subclass?.id);
  if (subclassBonuses && typeof char.subclass?.id === 'string') {
    baseFinal = { ...baseWithClassPassive };
    for (const [stat, pct] of Object.entries(subclassBonuses)) {
      if (baseFinal[stat] != null && pct) {
        baseFinal[stat] = Math.max(1, Math.round(baseFinal[stat] * (1 + pct)));
      }
    }
  }
  const weaponState = initWeaponCombatState(char, weaponId);
  const startHP = (typeof char._bossRushStartHP === 'number' && char._bossRushStartHP > 0)
    ? Math.min(char._bossRushStartHP, baseFinal.hp)
    : baseFinal.hp;
  return {
    ...char,
    _storedBase: char.base,
    base: baseFinal,
    baseWithoutWeapon,
    baseWithBoosts,
    currentHP: startHP,
    maxHP: baseFinal.hp,
    cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0, succ: 0, bast: 0, alch: 0, boss_ability: 0 },
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
    mindflayerCapacityCopyUsed: false,
    mindflayerNoCooldownBonusUsed: false,
    firstCapacityCapBoostUsed: false,
    stunned: false,
    stunnedTurns: 0,
    boneGuardActive: false,
    _labrysBleedPercent: 0,
    onctionLastStandUsed: false,
    turtlekinFirstHitUsed: false,
    turtlekinResetAt50Used: false,
    alchPhase: 0,
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
    tryTriggerOnctionLastStand(attacker, log, playerColor);
    if (attacker.awakening?.damageStackBonus) {
      attacker.awakening.damageTakenStacks += 1;
    }
    log.push(`${playerColor} 💥 L'éveil de ${target.name} explose et inflige ${explosion} dégâts à ${attacker.name}`);
  }
  target.undead = true;
  target.currentHP = revive;
  log.push(`${playerColor} ☠️ ${target.name} ressuscite d'entre les morts et revient avec ${revive} points de vie !`);
}

export function tryTriggerOnctionLastStand(target, log, playerColor) {
  if (!target || target.currentHP > 0 || target.onctionLastStandUsed) return false;
  const passiveList = getPassiveDetailsList(target);
  const passive = getPassiveById(passiveList, 'onction_eternite');
  if (!passive) return false;

  target.onctionLastStandUsed = true;
  target.currentHP = 1;
  log.push(`${playerColor} 🌿 Onction d'Éternité: ${target.name} survit à 1 PV (1 fois par combat).`);
  return true;
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


function getMindflayerCapacityCooldown(caster, _target, capacityId) {
  const baseCooldown = cooldowns[capacityId] ?? 1;
  let adjustedCooldown = baseCooldown;

  // Arbalète du Verdict: +1 CD sur toutes les capacités
  const verdictPenalty = getVerdictCooldownPenalty(caster.weaponState);
  if (verdictPenalty > 0) {
    adjustedCooldown += verdictPenalty;
  }

  // Pendule de Chronos et Mindflayer éveillé : -1 CD, non cumulables
  let cdReduction = 0;
  const penduleReduction = getPenduleCooldownReduction(caster.weaponState);
  if (penduleReduction < 0) cdReduction = Math.max(cdReduction, Math.abs(penduleReduction));
  if ((caster.race === 'Mindflayer' || caster.awakening?.mindflayerOwnCooldownReductionTurns != null) && !caster.mindflayerFirstCDUsed) {
    const casterAwakening = caster.awakening || {};
    const reducedTurns = casterAwakening.mindflayerOwnCooldownReductionTurns ?? raceConstants.mindflayer.ownCooldownReductionTurns;
    if (reducedTurns > 0) cdReduction = Math.max(cdReduction, reducedTurns);
  }
  if (cdReduction > 0 && adjustedCooldown > 1) {
    adjustedCooldown = Math.max(1, adjustedCooldown - cdReduction);
  }

  return adjustedCooldown;
}

function applyMindflayerCapacityMod(caster, _target, baseDamage, capacityId, log, playerColor) {
  if (caster.race !== 'Mindflayer' && (caster.awakening?.mindflayerNoCooldownSpellBonus == null)) return baseDamage;
  if (caster.mindflayerNoCooldownBonusUsed) return baseDamage;

  const effectiveCooldown = getMindflayerCapacityCooldown(caster, _target, capacityId);
  if (effectiveCooldown > 1) return baseDamage;

  const casterAwakening = caster.awakening || {};
  const bonus = casterAwakening.mindflayerNoCooldownSpellBonus ?? 0;
  if (!bonus || bonus <= 0) return baseDamage;

  caster.mindflayerNoCooldownBonusUsed = true;
  const boosted = Math.round(baseDamage * (1 + bonus));
  log.push(`${playerColor} 🦑 Éveil Mindflayer — première capacité sans CD: +${Math.round(bonus * 100)}% de dégâts !`);
  return boosted;
}

function triggerMindflayerCapacityCopy(caster, target, log, playerColor, atkPassives, defPassives, atkUnicorn, defUnicorn, auraBonus, capacityMagnitude = null, healMagnitude = null, turn = null) {
  // Le Mindflayer copie la capacité uniquement, pas les passifs de la tour. Attaquant = Mindflayer → passifs vides. Défenseur = caster → garde ses passifs défensifs.
  const attackerPassives = [];
  const defenderPassives = Array.isArray(atkPassives) ? atkPassives : (atkPassives ? [atkPassives] : []);
  const targetHasMindflayer = target?.race === 'Mindflayer' || target?.awakening?.mindflayerStealSpellCapDamageScale != null;
  const casterHasMindflayer = caster?.race === 'Mindflayer' || caster?.awakening?.mindflayerStealSpellCapDamageScale != null;
  if (!targetHasMindflayer) return;
  if (casterHasMindflayer) return; // Ne pas copier si l'adversaire est aussi un Mindflayer
  if (target.mindflayerCapacityCopyUsed) return;
  if (target.currentHP <= 0 || caster.currentHP <= 0) return;

  target.mindflayerCapacityCopyUsed = true;
  const targetAwakening = target.awakening || {};
  // Même capacité en plus fort : intensité reçue (dégâts ou soin adverse) + 10% CAP (éveil) ou 5% CAP (pré-éveil)
  const isAwakenedMindflayer = Boolean(target.awakening);
  const capScale = isAwakenedMindflayer
    ? (targetAwakening.mindflayerStealSpellCapDamageScale ?? raceConstants.mindflayer.stealSpellCapDamageScale)
    : raceConstants.mindflayer.stealSpellCapDamageScale;
  const capBonus = Math.max(0, Math.round(target.base.cap * capScale));
  const useMagnitude = capacityMagnitude != null && capacityMagnitude > 0;

  const copiedClass = caster.class;

  switch (copiedClass) {
    case 'Demoniste': {
      const raw = useMagnitude ? Math.max(1, capacityMagnitude + capBonus) : (() => {
        const { capBase, capPerCap, ignoreResist } = classConstants.demoniste;
        const hit = Math.max(1, Math.round((capBase + capPerCap * target.base.cap) * target.base.cap));
        return dmgCap(hit, caster.base.rescap * (1 - ignoreResist)) + capBonus;
      })();
      const inflicted = applyDamage(target, caster, raw, false, log, playerColor, attackerPassives, defenderPassives, defUnicorn, atkUnicorn, auraBonus, true, true, turn);
      log.push(`${playerColor} 🦑 ${target.name} copie le familier de ${caster.name} et inflige ${inflicted} dégâts !`);
      break;
    }
    case 'Masochiste': {
      // Soin copié : si healMagnitude fourni (appel depuis le bloc Masochiste), on l'utilise et on ajoute le +10% CAP
      const healAmount = healMagnitude != null && healMagnitude >= 0
        ? Math.max(1, Math.round(healMagnitude) + capBonus)
        : (() => {
            const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
            const masoTaken = caster.maso_taken || 0;
            return Math.max(1, Math.round(masoTaken * healPercent * getAntiHealFactor(caster)) + capBonus);
          })();
      if (healAmount > 0) target.currentHP = Math.min(target.maxHP, target.currentHP + healAmount);
      const dmg = useMagnitude ? Math.max(1, capacityMagnitude + capBonus) : (() => {
        const { returnBase, returnPerCap } = classConstants.masochiste;
        const masoTaken = caster.maso_taken || 0;
        return Math.max(1, Math.round(masoTaken * (returnBase + returnPerCap * target.base.cap))) + capBonus;
      })();
      const inflicted = applyDamage(target, caster, dmg, false, log, playerColor, attackerPassives, defenderPassives, defUnicorn, atkUnicorn, auraBonus, true, true, turn);
      log.push(`${playerColor} 🦑 ${target.name} copie le renvoi de dégâts de ${caster.name}, inflige ${inflicted} dégâts et récupère ${healAmount} PV !`);
      break;
    }
    case 'Paladin': {
      const { reflectBase, reflectPerCap } = classConstants.paladin;
      target.reflect = reflectBase + reflectPerCap * target.base.cap;
      log.push(`${playerColor} 🦑 ${target.name} copie la riposte de ${caster.name} et renverra ${Math.round(target.reflect * 100)}% des dégâts !`);
      break;
    }
    case 'Healer': {
      const miss = target.maxHP - target.currentHP;
      const { missingHpPercent, capScale: healCapScale } = classConstants.healer;
      const heal = useMagnitude ? Math.max(1, capacityMagnitude + capBonus) : Math.max(1, Math.round((missingHpPercent * miss + healCapScale * target.base.cap) * getAntiHealFactor(caster)));
      target.currentHP = Math.min(target.maxHP, target.currentHP + heal);
      log.push(`${playerColor} 🦑 ${target.name} copie le soin de ${caster.name} et récupère ${heal} PV !`);
      break;
    }
    case 'Succube': {
      const raw = useMagnitude ? Math.max(1, capacityMagnitude + capBonus) : dmgCap(Math.round(target.base.auto + target.base.cap * classConstants.succube.capScale), caster.base.rescap) + capBonus;
      const inflicted = applyDamage(target, caster, raw, false, log, playerColor, attackerPassives, defenderPassives, defUnicorn, atkUnicorn, auraBonus, true, true, turn);
      caster.succubeWeakenNextAttack = true;
      log.push(`${playerColor} 🦑 ${target.name} copie le fouet de ${caster.name}, inflige ${inflicted} dégâts et affaiblit sa prochaine attaque !`);
      break;
    }
    case 'Bastion': {
      const raw = useMagnitude ? Math.max(1, capacityMagnitude + capBonus) : dmgCap(Math.round(target.base.auto + target.base.cap * classConstants.bastion.capScale + target.base.def * classConstants.bastion.defScale), caster.base.rescap) + capBonus;
      const inflicted = applyDamage(target, caster, raw, false, log, playerColor, attackerPassives, defenderPassives, defUnicorn, atkUnicorn, auraBonus, true, true, turn);
      log.push(`${playerColor} 🦑 ${target.name} copie la Charge du Rempart de ${caster.name} et inflige ${inflicted} dégâts !`);
      break;
    }
    case 'Voleur':
      target.dodge = true;
      log.push(`${playerColor} 🦑 ${target.name} copie l'esquive de ${caster.name} et évitera la prochaine attaque !`);
      break;
    case 'Mage': {
      const raw = useMagnitude ? Math.max(1, capacityMagnitude + capBonus) : (() => {
        const { capBase, capPerCap } = classConstants.mage;
        const atkSpell = Math.round(target.base.auto + (capBase + capPerCap * target.base.cap) * target.base.cap);
        return dmgCap(atkSpell, caster.base.rescap) + capBonus;
      })();
      const inflicted = applyDamage(target, caster, raw, false, log, playerColor, attackerPassives, defenderPassives, defUnicorn, atkUnicorn, auraBonus, true, true, turn);
      log.push(`${playerColor} 🦑 ${target.name} copie la capacité magique de ${caster.name} et inflige ${inflicted} dégâts !`);
      break;
    }
    case 'Guerrier': {
      const raw = useMagnitude ? Math.max(1, capacityMagnitude + capBonus) : (() => {
        const { ignoreBase, ignorePerCap, autoBonus } = classConstants.guerrier;
        const ignore = ignoreBase + ignorePerCap * target.base.cap;
        const effectiveAuto = Math.round(target.base.auto + autoBonus);
        if (caster.base.def <= caster.base.rescap) {
          const effDef = Math.max(0, Math.round(caster.base.def * (1 - ignore)));
          return dmgPhys(effectiveAuto, effDef) + capBonus;
        }
        const effRes = Math.max(0, Math.round(caster.base.rescap * (1 - ignore)));
        return dmgPhys(effectiveAuto, effRes) + capBonus;
      })();
      const inflicted = applyDamage(target, caster, raw, false, log, playerColor, attackerPassives, defenderPassives, defUnicorn, atkUnicorn, auraBonus, true, true, turn);
      log.push(`${playerColor} 🦑 ${target.name} copie la frappe pénétrante de ${caster.name} et inflige ${inflicted} dégâts !`);
      break;
    }
    case 'Archer': {
      const raw = useMagnitude ? Math.max(1, capacityMagnitude + capBonus) : null;
      if (raw !== null) {
        const inflicted = applyDamage(target, caster, raw, false, log, playerColor, attackerPassives, defenderPassives, defUnicorn, atkUnicorn, auraBonus, true, true, turn);
        log.push(`${playerColor} 🦑 ${target.name} copie le tir multiple de ${caster.name} et inflige ${inflicted} dégâts !`);
      } else {
        const { hitCount, hit2AutoMultiplier, hit2CapMultiplier } = classConstants.archer;
        let totalDmg = 0;
        for (let i = 0; i < hitCount; i++) {
          let r;
          if (i === 0) r = dmgPhys(Math.round(target.base.auto), caster.base.def) + capBonus;
          else {
            const physPart = dmgPhys(Math.round(target.base.auto * hit2AutoMultiplier), caster.base.def);
            const capPart = dmgCap(Math.round(target.base.cap * hit2CapMultiplier), caster.base.rescap);
            r = physPart + capPart + capBonus;
          }
          const inflicted = applyDamage(target, caster, r, false, log, playerColor, attackerPassives, defenderPassives, defUnicorn, atkUnicorn, auraBonus, true, true, turn);
          totalDmg += inflicted;
          if (caster.currentHP <= 0) break;
        }
        log.push(`${playerColor} 🦑 ${target.name} copie le tir multiple de ${caster.name} et inflige ${totalDmg} dégâts !`);
      }
      break;
    }
    case 'Alchimiste': {
      const raw = useMagnitude ? Math.max(1, capacityMagnitude + capBonus) : (() => {
        const alchC = classConstants.alchimiste;
        return dmgCap(Math.round(target.base.auto + target.base.cap * alchC.fireCapScale), caster.base.rescap) + capBonus;
      })();
      const inflicted = applyDamage(target, caster, raw, false, log, playerColor, attackerPassives, defenderPassives, defUnicorn, atkUnicorn, auraBonus, true, true, turn);
      log.push(`${playerColor} 🦑 ${target.name} copie la flasque de ${caster.name} et inflige ${inflicted} dégâts !`);
      break;
    }
    default: {
      const raw = useMagnitude ? Math.max(1, capacityMagnitude + capBonus) : Math.max(1, Math.round(target.base.cap * capScale));
      const inflicted = applyDamage(target, caster, raw, false, log, playerColor, attackerPassives, defenderPassives, defUnicorn, atkUnicorn, auraBonus, true, true, turn);
      log.push(`${playerColor} 🦑 ${target.name} copie la capacité de ${caster.name} et inflige ${inflicted} dégâts !`);
      break;
    }
  }
}

function grantOnCapacityHitDefenderEffects(def, adjusted, log, playerColor) {
  if (adjusted <= 0) return;
  if (def.race === 'Sirène' || def.awakening?.sireneMaxStacks != null) {
    const maxStacks = def.awakening?.sireneMaxStacks ?? raceConstants.sirene.maxStacks;
    def.sireneStacks = Math.min(maxStacks, (def.sireneStacks || 0) + 1);
    log.push(`${playerColor} 🧜 ${def.name} gagne un stack Sirène (${def.sireneStacks}/${maxStacks}).`);
  }
  if (def.class === 'Briseur de Sort') {
    const shield = Math.max(1, Math.round(adjusted * classConstants.briseurSort.shieldFromSpellDamage + getEffectiveCapForSceptre(def) * classConstants.briseurSort.shieldFromCap));
    def.shield = (def.shield || 0) + shield;
    log.push(`${playerColor} 🧱 ${def.name} convertit la capacité en bouclier (+${shield}).`);
    if (def.subclass?.id === 'stratege_arcanique') {
      const briseurC = getSubclassCapacityConstants(def.class, def.subclass?.id);
      def.nextSpellReduction = briseurC.nextSpellReduction ?? 0.30;
      log.push(`${playerColor} 📐 Stratège Arcanique: les dégâts du prochain sort subi sont réduits de ${Math.round((def.nextSpellReduction ?? 0) * 100)}%.`);
    }
    if (def.subclass?.id === 'mentaliste') {
      const briseurC = getSubclassCapacityConstants(def.class, def.subclass?.id);
      const stack = briseurC.defBonusStack ?? 0.08;
      def.mentalisteDefStack = (def.mentalisteDefStack || 0) + stack;
      def.base = { ...def.base, def: Math.max(1, Math.round(def.base.def * (1 + stack))) };
      log.push(`${playerColor} 🧠 Mentaliste: ${def.name} gagne +${Math.round((stack ?? 0) * 100)}% DEF (stackable).`);
    }
  }
}


function flushPendingCombatLogs(fighter, log) {
  if (!fighter?._pendingCombatLogs || fighter._pendingCombatLogs.length === 0) return;
  log.push(...fighter._pendingCombatLogs);
  fighter._pendingCombatLogs = [];
}

function applyDamage(att, def, raw, isCrit, log, playerColor, atkPassives, defPassives, atkUnicorn, defUnicorn, auraBoost, applyOnHitPassives = true, isCapacityDamage = false, turn = null) {
  const atkList = Array.isArray(atkPassives) ? atkPassives : (atkPassives ? [atkPassives] : []);
  const defList = Array.isArray(defPassives) ? defPassives : (defPassives ? [defPassives] : []);
  if (turn != null && (att?.ability?.type === 'unicorn_cycle' || def?.ability?.type === 'unicorn_cycle')) {
    const mult = getUnicornCycleMultiplier(turn);
    if (att?.ability?.type === 'unicorn_cycle') raw = Math.round(raw * mult);
    if (def?.ability?.type === 'unicorn_cycle') raw = Math.round(raw * mult);
  }
  let adjusted = raw;
  // Koro Sensei (Collège Kunugigaoka) : Leçon du maître — réduction sur la prochaine attaque de la cible
  if (att.trainerNextAttackReduction != null && att.trainerNextAttackReduction > 0) {
    adjusted = Math.max(1, Math.round(adjusted * (1 - att.trainerNextAttackReduction)));
    log.push(`${playerColor} 📉 Leçon du maître : l'attaque de ${att.name} inflige -${Math.round(att.trainerNextAttackReduction * 100)}% de dégâts.`);
    att.trainerNextAttackReduction = undefined;
  }
  if (att.paladinNextAttackReduction != null && att.paladinNextAttackReduction > 0) {
    adjusted = Math.max(1, Math.round(adjusted * (1 - att.paladinNextAttackReduction)));
    log.push(`${playerColor} ✨ Croisé lumineux : l'attaque de ${att.name} inflige -${Math.round(att.paladinNextAttackReduction * 100)}% de dégâts.`);
    att.paladinNextAttackReduction = undefined;
  }
  if (atkUnicorn) adjusted = Math.round(adjusted * (1 + atkUnicorn.outgoing));
  if (auraBoost) adjusted = Math.round(adjusted * (1 + auraBoost));
  // Entrave Arcanique : bonus de dégâts tant que l'ennemi n'a pas lancé sa première capacité
  if (att._entraveDamageBonus > 0 && !def._entraveFirstCapUsed) {
    adjusted = Math.round(adjusted * (1 + att._entraveDamageBonus));
  }
  // Pendule de Chronos : +5% dégâts et soins sur les capacités
  if (isCapacityDamage) {
    const penduleBonus = getPenduleSpellBonus(att.weaponState);
    if (penduleBonus > 0) adjusted = Math.round(adjusted * (1 + penduleBonus));
  }
  if (def.spectralMarked && def.spectralMarkBonus) adjusted = Math.round(adjusted * (1 + def.spectralMarkBonus));
  if (defUnicorn) adjusted = Math.round(adjusted * (1 + defUnicorn.incoming));
  const atkOnction = getPassiveById(atkList, 'onction_eternite');
  if (atkOnction?.levelData?.outgoingDamageMultiplier != null && att.onctionLastStandUsed) {
    adjusted = Math.max(1, Math.round(adjusted * atkOnction.levelData.outgoingDamageMultiplier));
  }
  const defObsidian = defList.find((p) => p?.id === 'obsidian_skin');
  if (defObsidian && isCrit) adjusted = Math.round(adjusted * (1 - (defObsidian.levelData?.critReduction ?? 0)));
  if (def?.ability?.type === 'bone_guard' && def.boneGuardActive) {
    adjusted = Math.round(adjusted * 0.7);
  }
  adjusted = applyOutgoingAwakeningBonus(att, adjusted);
  adjusted = applyIncomingAwakeningModifiers(def, adjusted);
  if (def.arcanisteDamageTakenStack != null && def.arcanisteDamageTakenStack > 0) {
    adjusted = Math.max(1, Math.round(adjusted * (1 + def.arcanisteDamageTakenStack)));
  }
  if (att.sorcierNeantBurn) {
    adjusted = Math.max(1, Math.round(adjusted * 0.90));
    log.push(`${playerColor} 🌑 Brûlure du Néant: ${att.name} inflige -10% dégâts.`);
  }
  if (def.nextSpellReduction != null && def.nextSpellReduction > 0 && isCapacityDamage) {
    adjusted = Math.max(1, Math.round(adjusted * (1 - def.nextSpellReduction)));
    log.push(`${playerColor} 📐 Stratège Arcanique: le sort inflige -${Math.round(def.nextSpellReduction * 100)}% de dégâts.`);
    def.nextSpellReduction = undefined;
  }

  if (att.suddenDeath) {
    adjusted = Math.round(adjusted * (1 + generalConstants.suddenDeathDamageBonus));
  }

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
  // Turtlekin : cap le premier coup reçu à 10% PV max
  if ((def.race === 'Turtlekin' || def.awakening?.turtlekinResetAt50) && !def.turtlekinFirstHitUsed && adjusted > 0) {
    const maxDmg = Math.max(1, Math.round(def.maxHP * raceConstants.turtlekin.firstHitCapPercent));
    if (adjusted > maxDmg) {
      log.push(`${playerColor} 🐢 Carapace de ${def.name} absorbe le choc ! Dégâts réduits de ${adjusted} à ${maxDmg}.`);
      adjusted = maxDmg;
    }
    def.turtlekinFirstHitUsed = true;
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
        tryTriggerOnctionLastStand(att, log, playerColor);
        if (att.awakening?.damageStackBonus) att.awakening.damageTakenStacks += 1;
        log.push(`${playerColor} 💥 Le bouclier de ${def.name} explose et inflige ${explosionDamage} points de dégâts à ${att.name}`);
        if (att.currentHP <= 0 && hasMortVivantRevive(att)) {
          reviveUndead(att, def, log, playerColor);
        }
      }
    }
  }
  if (adjusted > 0) {
    const hadReflectBeforeHit = Boolean(def.reflect);
    def.currentHP -= adjusted;
    tryTriggerOnctionLastStand(def, log, playerColor);
    def.maso_taken = (def.maso_taken || 0) + adjusted;
    if (def.awakening?.damageStackBonus) def.awakening.damageTakenStacks += 1;

    // Turtlekin éveillé : réinitialise le passif quand il atteint 50% PV pour la première fois
    if (def.awakening?.turtlekinResetAt50 && def.turtlekinFirstHitUsed && !def.turtlekinResetAt50Used && def.currentHP > 0 && def.currentHP <= def.maxHP * 0.5) {
      def.turtlekinFirstHitUsed = false;
      def.turtlekinResetAt50Used = true;
      log.push(`${playerColor} 🐢 Éveil Turtlekin: la carapace de ${def.name} se régénère !`);
    }

    // Reflet Maudit : renvoi de dégâts bruts sur crit + réduction crit adverse
    if (isCrit && adjusted > 0 && def.currentHP > 0) {
      const refletPassive = defList.find((p) => p?.id === 'reflet_maudit');
      if (refletPassive) {
        const reflectDmg = Math.max(1, Math.round(adjusted * (refletPassive.levelData?.reflectPercent ?? 0)));
        att.currentHP -= reflectDmg;
        tryTriggerOnctionLastStand(att, log, playerColor);
        log.push(`${playerColor} 🪞 Reflet Maudit: ${att.name} subit ${reflectDmg} dégâts bruts en retour du crit !`);
        if (refletPassive.levelData?.critReduction && !att._refletMauditApplied) {
          att._refletMauditCritMalus = (att._refletMauditCritMalus || 0) + refletPassive.levelData.critReduction;
          att._refletMauditApplied = true;
          log.push(`${playerColor} 🪞 Reflet Maudit: ${att.name} perd ${Math.round(refletPassive.levelData.critReduction * 100)}% de crit permanent !`);
        }
        if (att.currentHP <= 0 && hasMortVivantRevive(att)) {
          reviveUndead(att, def, log, playerColor);
        }
      }
    }

    if (isCapacityDamage) {
      grantOnCapacityHitDefenderEffects(def, adjusted, log, playerColor);
      // Masochiste : la copie (dégâts + soin avec +10%) est déclenchée depuis le bloc capacité, pas ici
      if (att.class !== 'Masochiste') {
        triggerMindflayerCapacityCopy(att, def, log, playerColor, atkList, defList, atkUnicorn, defUnicorn, auraBoost, adjusted, null, turn);
      }
    }

    if (hadReflectBeforeHit && def.currentHP > 0) {
      let back = Math.round(def.reflect * adjusted);
      if (def.riposteVerdictMultiplier) {
        back = Math.round(back * def.riposteVerdictMultiplier);
      }
      att.currentHP -= back;
      tryTriggerOnctionLastStand(att, log, playerColor);
      att._pendingCombatLogs = att._pendingCombatLogs || [];
      att._pendingCombatLogs.push(`${playerColor} 🔁 ${def.name} riposte et renvoie ${back} points de dégâts à ${att.name}`);
      // Égide du Briseur de Sort : les dégâts de riposte comptent comme une capacité reçue
      if (back > 0 && att.class === 'Briseur de Sort') {
        const shield = Math.max(1, Math.round(back * classConstants.briseurSort.shieldFromSpellDamage + getEffectiveCapForSceptre(att) * classConstants.briseurSort.shieldFromCap));
        att.shield = (att.shield || 0) + shield;
        att._pendingCombatLogs.push(`${playerColor} 🧱 ${att.name} convertit la capacité en bouclier (+${shield}).`);
      }
      if (def.riposteTwice && back > 0) {
        att.currentHP -= back;
        tryTriggerOnctionLastStand(att, log, playerColor);
        att._pendingCombatLogs.push(`${playerColor} 📜 Codex Archon : ${def.name} riposte et renvoie ${back} points de dégâts à ${att.name}`);
        if (att.class === 'Briseur de Sort') {
          const shield2 = Math.max(1, Math.round(back * classConstants.briseurSort.shieldFromSpellDamage + getEffectiveCapForSceptre(att) * classConstants.briseurSort.shieldFromCap));
          att.shield = (att.shield || 0) + shield2;
          att._pendingCombatLogs.push(`${playerColor} 🧱 ${att.name} convertit la capacité en bouclier (+${shield2}).`);
        }
      }
      def.reflect = false;
      def.riposteTwice = false;
      def.riposteVerdictMultiplier = undefined;
    }
  }
  if (applyOnHitPassives && adjusted > 0 && !def.spectralMarked) {
    const spectralPassive = atkList.find((p) => p?.id === 'spectral_mark');
    if (spectralPassive) {
      def.spectralMarked = true;
      const bonus = Math.max(...atkList.filter((p) => p?.id === 'spectral_mark').map((p) => p.levelData?.damageTakenBonus ?? 0));
      def.spectralMarkBonus = bonus;
      log.push(`${playerColor} 🟣 ${def.name} est marqué et subira +${Math.round(def.spectralMarkBonus * 100)}% dégâts.`);
    }
  }
  if (applyOnHitPassives && adjusted > 0) {
    for (const p of atkList) {
      if (p?.id !== 'essence_drain') continue;
      const heal = Math.max(1, Math.round(adjusted * (p.levelData?.healPercent ?? 0) * getAntiHealFactor(def)));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} 🩸 ${att.name} siphonne ${heal} points de vie grâce au Vol d'essence`);
      const healEffects = onHeal(att.weaponState, att, heal, def);
      if (healEffects.bonusDamage > 0) {
        const bonusDmg = dmgCap(healEffects.bonusDamage, def.base.rescap);
        applyDamage(att, def, bonusDmg, false, log, playerColor, atkList, defList, atkUnicorn, defUnicorn, auraBoost, false, false, turn);
        log.push(`${playerColor} ${healEffects.log.join(' ')}`);
      }
    }
  }

  if (def?.ability?.type === 'bone_guard' && !def.boneGuardActive && def.currentHP > 0 && def.currentHP <= def.maxHP * 0.4) {
    def.boneGuardActive = true;
    log.push(`${playerColor} 💀 ${def.name} renforce sa carapace et réduit les dégâts reçus !`);
  }

  return adjusted;
}

function processPlayerAction(att, def, log, isP1, turn) {
  if (att.currentHP <= 0 || def.currentHP <= 0) return;

  const playerColor = isP1 ? '[P1]' : '[P2]';
  const attackerPassiveList = getPassiveDetailsList(att);
  const defenderPassiveList = getPassiveDetailsList(def);
  const attackerUnicorn = getUnicornPactTurnDataFromList(attackerPassiveList, turn);
  const defenderUnicorn = getUnicornPactTurnDataFromList(defenderPassiveList, turn);
  const auraBonus = getAuraBonusFromList(attackerPassiveList, turn);
  const auraOverloadPassive = getPassiveById(attackerPassiveList, 'aura_overload');
  const consumeAuraCapacityCapMultiplier = () => {
    if (!auraOverloadPassive) return 1;
    if (att.firstCapacityCapBoostUsed) return 1;
    att.firstCapacityCapBoostUsed = true;
    return 1 + (auraOverloadPassive?.levelData?.spellCapBonus ?? 0);
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
    const effectiveCd = getMindflayerCapacityCooldown(att, def, k);
    att.cd[k] = (att.cd[k] % effectiveCd) + 1;
  }

  // Entrave Arcanique : retarder la première capacité de 1 tour
  if (att._entraveCdDelay > 0 && !att._entraveDelayConsumed) {
    for (const k of Object.keys(cooldowns)) {
      const effectiveCd = getMindflayerCapacityCooldown(att, def, k);
      if (att.cd[k] === effectiveCd) {
        att.cd[k] = Math.max(1, att.cd[k] - 1);
        att._entraveDelayConsumed = true;
        break;
      }
    }
  }

  // La copie de capacité du Mindflayer est déclenchée après avoir reçu une capacité (dans applyDamage).
  let capacityStolen = false;

  const turnEffects = onTurnStart(att.weaponState, att, turn);
  // Zweihander: le bonus de dégâts s'applique au premier dégât du tour puis est consommé
  let weaponDamageBonusAvailable = turnEffects.damageMultiplier !== undefined && turnEffects.damageMultiplier !== 1;
  const consumeWeaponDamageBonus = () => {
    if (weaponDamageBonusAvailable) {
      weaponDamageBonusAvailable = false;
      return turnEffects.damageMultiplier;
    }
    return 1;
  };
  if (turnEffects.log.length > 0) log.push(...turnEffects.log.map(e => `${playerColor} ${e}`));
  if (turnEffects.regen > 0) {
    const weaponRegen = Math.max(1, Math.round(turnEffects.regen * getAntiHealFactor(def)));
    att.currentHP = Math.min(att.maxHP, att.currentHP + weaponRegen);
  }

  // Sylvari (race principale ou éveil additionnel) : régen % PV max par tour
  if (att.race === 'Sylvari' || (att.awakening?.regenPercent ?? 0) > 0) {
    const regenPercent = att.awakening ? (att.awakening.regenPercent ?? 0) : raceConstants.sylvari.regenPercent;
    const heal = Math.max(1, Math.round(att.maxHP * regenPercent * getAntiHealFactor(def)));
    att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
    log.push(`${playerColor} 🌿 ${att.name} régénère naturellement et récupère ${heal} points de vie`);
    const healEffects = onHeal(att.weaponState, att, heal, def);
    if (healEffects.bonusDamage > 0) {
      const bonusDmg = dmgCap(healEffects.bonusDamage, def.base.rescap);
      applyDamage(att, def, bonusDmg, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
      log.push(`${playerColor} ${healEffects.log.join(' ')}`);
    }
  }

  // Onction d'Éternité: regen % HP max par tour
  const onctionPassive = getPassiveById(attackerPassiveList, 'onction_eternite');
  if (onctionPassive) {
    const onctionHeal = Math.max(1, Math.round(att.maxHP * onctionPassive.levelData.regenPercent * getAntiHealFactor(def)));
    att.currentHP = Math.min(att.maxHP, att.currentHP + onctionHeal);
    log.push(`${playerColor} 🌿 Onction d'Éternité: ${att.name} régénère ${onctionHeal} points de vie`);
    const healEffects = onHeal(att.weaponState, att, onctionHeal, def);
    if (healEffects.bonusDamage > 0) {
      const bonusDmg = dmgCap(healEffects.bonusDamage, def.base.rescap);
      applyDamage(att, def, bonusDmg, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
      log.push(`${playerColor} ${healEffects.log.join(' ')}`);
    }
  }

  let mult = 1.0;
  if (att.succubeWeakenNextAttack) {
    mult *= (1 - classConstants.succube.nextAttackReduction);
    att.succubeWeakenNextAttack = false;
    log.push(`${playerColor} 💋 ${att.name} est affaibli et inflige -${Math.round(classConstants.succube.nextAttackReduction * 100)}% dégâts sur cette attaque.`);
  }
  const hasOrcLowHpBonus = (att.race === 'Orc' || att.awakening?.damageBonus != null) && att.currentHP < raceConstants.orc.lowHpThreshold * att.maxHP;
  if (hasOrcLowHpBonus) mult = att.awakening?.damageBonus ?? raceConstants.orc.damageBonus;

  if (att.class === 'Demoniste' && !capacityStolen) {
    if (shouldSkipVerdictDemonFamiliar(att.weaponState, turn)) {
      // Arbalète du Verdict : 1ère attaque tour 2, 2e tour 4 (pas d'attaque ce tour)
    } else {
    skillUsed = true; // Familier = capacité → Furie élémentaire, Mindflayer -1 CD, etc.
    const demonC = getSubclassCapacityConstants(att.class, att.subclass?.id);
    const capBase = demonC.capBase ?? classConstants.demoniste.capBase;
    const ignoreResist = demonC.ignoreResist ?? classConstants.demoniste.ignoreResist;
    const stackPerAuto = demonC.stackPerAuto ?? classConstants.demoniste.stackPerAuto;
    const isPacteSombre = att.subclass?.id === 'pacte_sombre';
    const stackBonus = stackPerAuto * (att.familiarStacks || 0);
    const hit = Math.max(1, Math.round((capBase + stackBonus) * getEffectiveCapForSceptre(att)));
    let raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
    if (isPacteSombre) {
      const capSteal = (demonC.capStealPercent ?? 0.03);
      const stolen = Math.max(0, Math.round(def.base.cap * capSteal));
      if (stolen > 0) {
        def.base = { ...def.base, cap: Math.max(1, def.base.cap - stolen) };
        att.pacteSombreCapStolen = (att.pacteSombreCapStolen || 0) + stolen;
        def.pacteSombreCapLost = (def.pacteSombreCapLost || 0) + stolen;
        log.push(`${playerColor} 💠 Pacte Sombre: ${att.name} vole ${stolen} CAP à ${def.name}.`);
      }
    }
    raw = applyMindflayerCapacityMod(att, def, raw, 'dem', log, playerColor);
    raw = Math.round(raw * consumeWeaponDamageBonus());
    const verdictBonusDem = getVerdictCapacityBonus(att.weaponState);
    if (verdictBonusDem.damageMultiplier !== 1) {
      raw = Math.round(raw * verdictBonusDem.damageMultiplier);
      verdictBonusDem.log.forEach((l) => log.push(`${playerColor} ${l}`));
    }
    const inflicted = applyDamage(att, def, raw, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, true, true, turn);
    log.push(`${playerColor} 💠 Le familier de ${att.name} attaque ${def.name} et inflige ${inflicted} points de dégâts`);
    const demonSpellEffects = onCapacityCast(att.weaponState, att, def, raw, 'demoniste');
    applySceptreCapBuff(att, demonSpellEffects, log, playerColor);
    if (demonSpellEffects.doubleCast && demonSpellEffects.secondCastDamage > 0) {
      const inflictedCodex = applyDamage(att, def, demonSpellEffects.secondCastDamage, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
      log.push(`${playerColor} 📜 Codex Archon : Le familier de ${att.name} attaque ${def.name} et inflige ${inflictedCodex} points de dégâts`);
    }
    if (def.currentHP <= 0 && hasMortVivantRevive(def)) reviveUndead(def, att, log, playerColor);
    }
  }

  if (att.class === 'Masochiste' && !capacityStolen) {
    if (att.cd.maso === getMindflayerCapacityCooldown(att, def, 'maso') && att.maso_taken > 0) {
      skillUsed = true;
      const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
      const dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerCap * getEffectiveCapForSceptre(att))));
      let healAmount = Math.max(1, Math.round(att.maso_taken * healPercent * getAntiHealFactor(def)));
      const verdictBonusMaso = getVerdictCapacityBonus(att.weaponState);
      if (verdictBonusMaso.damageMultiplier !== 1 || verdictBonusMaso.healMultiplier !== 1) {
        healAmount = Math.max(1, Math.round(healAmount * verdictBonusMaso.healMultiplier));
        verdictBonusMaso.log.forEach(l => log.push(`${playerColor} ${l}`));
      }
      att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
      if (att.subclass?.id === 'flagellant_sanglant' && !att.flagellantApplied) {
        att.flagellantApplied = true;
        const masoC = getSubclassCapacityConstants(att.class, att.subclass?.id);
        const defMult = masoC.defMultiplier ?? 0.80;
        const autoMult = masoC.autoMultiplier ?? 1.16;
        att.base = { ...att.base, def: Math.max(1, Math.round(att.base.def * defMult)), auto: Math.round(att.base.auto * autoMult) };
        log.push(`${playerColor} 🩸 Flagellant Sanglant: ${att.name} -20% DEF, +16% Auto pour le reste du combat.`);
      }
      if (att.subclass?.id === 'ecorche_fer') {
        const masoC = getSubclassCapacityConstants(att.class, att.subclass?.id);
        const stack = masoC.defRescapStack ?? 0.07;
        att.base = { ...att.base, def: Math.max(1, Math.round(att.base.def * (1 + stack))), rescap: Math.max(1, Math.round(att.base.rescap * (1 + stack))) };
        log.push(`${playerColor} ⛓️ Ecorché de Fer: ${att.name} +7% DEF et ResC.`);
      }
      const masoHealEffects = onHeal(att.weaponState, att, healAmount, def);
      if (masoHealEffects.bonusDamage > 0) {
        const bonusDmg = dmgCap(masoHealEffects.bonusDamage, def.base.rescap);
        applyDamage(att, def, bonusDmg, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
        log.push(`${playerColor} ${masoHealEffects.log.join(' ')}`);
      }
      att.maso_taken = 0;
      let spellDmg = applyMindflayerCapacityMod(att, def, dmg, 'maso', log, playerColor);
      spellDmg = Math.round(spellDmg * consumeWeaponDamageBonus());
      if (verdictBonusMaso.damageMultiplier !== 1) {
        spellDmg = Math.round(spellDmg * verdictBonusMaso.damageMultiplier);
      }
      const inflicted = applyDamage(att, def, spellDmg, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, true, true, turn);
      if (def?.race === 'Mindflayer' || def?.awakening?.mindflayerStealSpellCapDamageScale != null) {
        triggerMindflayerCapacityCopy(att, def, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, dmg, healAmount, turn);
      }
      const masoSpellEffects = onCapacityCast(att.weaponState, att, def, dmg, 'maso', { healAmount });
      applySceptreCapBuff(att, masoSpellEffects, log, playerColor);
      log.push(`${playerColor} 🩸 ${att.name} renvoie les dégâts accumulés: inflige ${inflicted} points de dégâts et récupère ${healAmount} points de vie`);
      if (masoSpellEffects.doubleCast && (masoSpellEffects.secondCastDamage > 0 || masoSpellEffects.secondCastHeal > 0)) {
        const inflicted2 = masoSpellEffects.secondCastDamage > 0
          ? applyDamage(att, def, masoSpellEffects.secondCastDamage, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn)
          : 0;
        if (masoSpellEffects.secondCastHeal > 0) {
          att.currentHP = Math.min(att.maxHP, att.currentHP + masoSpellEffects.secondCastHeal);
        }
        log.push(`${playerColor} 📜 Codex Archon : ${att.name} renvoie les dégâts accumulés: inflige ${inflicted2} points de dégâts et récupère ${masoSpellEffects.secondCastHeal} points de vie`);
      }
    if (def.currentHP <= 0 && hasMortVivantRevive(def)) reviveUndead(def, att, log, playerColor);
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
    tryTriggerOnctionLastStand(att, log, playerColor);
    log.push(`${playerColor} 🩸 ${att.name} saigne abondamment et perd ${bleedDmg} points de vie`);
    if (att.currentHP <= 0 && hasMortVivantRevive(att)) reviveUndead(att, def, log, playerColor);
  }

  // Saignement Labrys d'Arès: dégâts bruts quand la cible attaque (cap Cataclysme comme le bleed Lycan)
  if (att._labrysBleedPercent > 0) {
    const labrysResult = processLabrysBleed(att);
    if (labrysResult.damage > 0) {
      let damageToApply = labrysResult.damage;
      if (att.isWorldBoss) {
        damageToApply = Math.max(1, Math.round(damageToApply * (1 - WORLD_BOSS_CONSTANTS.LABRYS_CATACLYSM_DAMAGE_REDUCTION)));
      }
      att.currentHP -= damageToApply;
      tryTriggerOnctionLastStand(att, log, playerColor);
      if (att.isWorldBoss) {
        log.push(`${playerColor} 🪓 Saignement d'Arès (${att.name}): ${att.name} perd ${damageToApply} PV bruts`);
      } else {
        labrysResult.log.forEach(l => log.push(`${playerColor} ${l}`));
      }
    if (att.currentHP <= 0 && hasMortVivantRevive(att)) reviveUndead(att, def, log, playerColor);
  }
}

  if (att.class === 'Paladin' && att.cd.pal === getMindflayerCapacityCooldown(att, def, 'pal') && !capacityStolen) {
    skillUsed = true;
    const { reflectBase, reflectPerCap } = classConstants.paladin;
    const spellCapMult = consumeAuraCapacityCapMultiplier();
    const reflectValue = reflectBase + reflectPerCap * getEffectiveCapForSceptre(att) * spellCapMult;
    att.reflect = reflectValue;
    const verdictBonusPal = getVerdictCapacityBonus(att.weaponState);
    if (verdictBonusPal.damageMultiplier !== 1) {
      att.riposteVerdictMultiplier = verdictBonusPal.damageMultiplier;
      verdictBonusPal.log.forEach((l) => log.push(`${playerColor} ${l}`));
    }
    if (att.subclass?.id === 'croise_lumineux') {
      const paladinC = getSubclassCapacityConstants(att.class, att.subclass?.id);
      def.paladinNextAttackReduction = paladinC.nextAttackReduction ?? 0.20;
      log.push(`${playerColor} ✨ Croisé lumineux: la prochaine attaque de ${def.name} infligera -20% de dégâts.`);
    }
    if (att.subclass?.id === 'juge_implacable') {
      const paladinC = getSubclassCapacityConstants(att.class, att.subclass?.id);
      const stack = paladinC.defReductionStack ?? 0.03;
      def.paladinDefReductionStack = (def.paladinDefReductionStack || 0) + stack;
      def.base = { ...def.base, def: Math.max(1, Math.round(def.base.def * 0.97)) };
      log.push(`${playerColor} ⚖️ Juge implacable: la DEF de ${def.name} est réduite de 3% (stackable).`);
    }
    const paladinSpellEffects = onCapacityCast(att.weaponState, att, def, reflectValue, 'paladin');
    applySceptreCapBuff(att, paladinSpellEffects, log, playerColor);
    if (paladinSpellEffects.doubleCast && paladinSpellEffects.riposteTwice) {
      att.riposteTwice = true;
      log.push(`${playerColor} 📜 Codex Archon : ${att.name} se prépare à riposter et renverra deux fois les dégâts`);
    }
    log.push(`${playerColor} 🛡️ ${att.name} se prépare à riposter et renverra ${Math.round(att.reflect * 100)}% des dégâts`);
    if (def?.race === 'Mindflayer' || def?.awakening?.mindflayerStealSpellCapDamageScale != null) {
      triggerMindflayerCapacityCopy(att, def, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, null, null, turn);
    }
  }

  if (att.class === 'Healer' && att.cd.heal === getMindflayerCapacityCooldown(att, def, 'heal') && !capacityStolen) {
    skillUsed = true;
    const miss = att.maxHP - att.currentHP;
    const { missingHpPercent, capScale } = classConstants.healer;
    if (att.subclass?.id === 'latum') {
      const healerC = getSubclassCapacityConstants(att.class, att.subclass?.id);
      const pct = healerC.missingHpDamagePercent ?? 0.20;
      const latumRaw = Math.max(1, Math.round(miss * pct));
      const latumDmg = dmgCap(latumRaw, def.base.rescap);
      const inflicted = applyDamage(att, def, latumDmg, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, true, turn);
      log.push(`${playerColor} ✚ Latum: ${att.name} inflige ${inflicted} dégâts (20% PV manquants, vs ResC) à ${def.name}.`);
    }
    const spellCapMultiplier = consumeAuraCapacityCapMultiplier();
    const sireneBoost = (att.race === 'Sirène' || att.awakening?.sireneStackBonus != null) ? ((att.awakening?.sireneStackBonus ?? raceConstants.sirene.stackBonus) * (att.sireneStacks || 0)) : 0;
    let baseHeal = Math.max(1, Math.round((missingHpPercent * miss + capScale * getEffectiveCapForSceptre(att) * spellCapMultiplier) * (1 + sireneBoost)));
    baseHeal = Math.max(1, Math.round(baseHeal * getAntiHealFactor(def)));
    const verdictBonusHeal = getVerdictCapacityBonus(att.weaponState);
    if (verdictBonusHeal.healMultiplier !== 1) {
      baseHeal = Math.max(1, Math.round(baseHeal * verdictBonusHeal.healMultiplier));
      verdictBonusHeal.log.forEach((l) => log.push(`${playerColor} ${l}`));
    }
    const penduleBonusHeal = getPenduleSpellBonus(att.weaponState);
    if (penduleBonusHeal > 0) baseHeal = Math.max(1, Math.round(baseHeal * (1 + penduleBonusHeal)));
    const healCritResult = rollHealCrit(att.weaponState, att, baseHeal);
    const heal = healCritResult.amount;
    if (att.subclass?.id === 'luxum') {
      const healerC = getSubclassCapacityConstants(att.class, att.subclass?.id);
      const capShieldPct = healerC.capShieldPercent ?? 0.10;
      const capShield = Math.max(1, Math.round(getEffectiveCapForSceptre(att) * capShieldPct));
      att.shield = (att.shield || 0) + capShield;
      const overflow = Math.max(0, (att.currentHP + heal) - att.maxHP);
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      if (overflow > 0) {
        att.shield = (att.shield || 0) + overflow;
        log.push(`${playerColor} ✚ ${att.name} lance sa capacité de soin et récupère ${heal} PV${healCritResult.isCrit ? ' CRITIQUE !' : ''}; +${capShield} bouclier (10% CAP); ${overflow} en bouclier (overheal).`);
      } else {
        log.push(`${playerColor} ✚ ${att.name} lance sa capacité de soin puissante et récupère ${heal} points de vie${healCritResult.isCrit ? ' CRITIQUE !' : ''}; +${capShield} bouclier (10% CAP).`);
      }
    } else {
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} ✚ ${att.name} lance sa capacité de soin puissante et récupère ${heal} points de vie${healCritResult.isCrit ? ' CRITIQUE !' : ''}`);
    }
    const healSpellEffects = onCapacityCast(att.weaponState, att, def, heal, 'heal');
    applySceptreCapBuff(att, healSpellEffects, log, playerColor);
    if (healSpellEffects.doubleCast && healSpellEffects.secondCastHeal > 0) {
      att.currentHP = Math.min(att.maxHP, att.currentHP + healSpellEffects.secondCastHeal);
      log.push(`${playerColor} 📜 Codex Archon : ${att.name} lance sa capacité de soin puissante et récupère ${healSpellEffects.secondCastHeal} points de vie`);
    }
    const healEffects = onHeal(att.weaponState, att, heal, def);
    if (healEffects.bonusDamage > 0) {
      const bonusDmg = dmgCap(healEffects.bonusDamage, def.base.rescap);
      applyDamage(att, def, bonusDmg, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
      log.push(`${playerColor} ${healEffects.log.join(' ')}`);
    }
    if (def?.race === 'Mindflayer' || def?.awakening?.mindflayerStealSpellCapDamageScale != null) {
      triggerMindflayerCapacityCopy(att, def, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, null, heal, turn);
    }
  }


  if (att.class === 'Succube' && att.cd.succ === getMindflayerCapacityCooldown(att, def, 'succ') && !capacityStolen) {
    skillUsed = true;
    const spellCapMultSucc = consumeAuraCapacityCapMultiplier();
    const forceCritAme = att.subclass?.id === 'ame_tentatrice' && !att.succubeLastWasCrit;
    const isCrit = forceCritAme || Math.random() < calcCritChance(att, def);
    if (att.subclass?.id === 'ame_tentatrice') att.succubeLastWasCrit = isCrit;
    if (att.subclass?.id === 'dompteuse_chair') {
      const succubeC = getSubclassCapacityConstants(att.class, att.subclass?.id);
      const stack = succubeC.autoReductionStack ?? 0.06;
      def.succubeAutoReductionStack = (def.succubeAutoReductionStack || 0) + stack;
      def.base = { ...def.base, auto: Math.max(1, Math.round(def.base.auto * 0.94)) };
      log.push(`${playerColor} 💋 Dompteuse de Chair: l'Auto de ${def.name} est réduite de 6% (stackable).`);
    }
    let raw = dmgCap(Math.round(att.base.auto + getEffectiveCapForSceptre(att) * spellCapMultSucc * classConstants.succube.capScale), def.base.rescap);
    raw = Math.round(raw * consumeWeaponDamageBonus());
    raw = applyMindflayerCapacityMod(att, def, raw, 'succ', log, playerColor);
    if (isCrit) {
      const critDamage = Math.round(raw * getCritMultiplier(att, def));
      raw = modifyCritDamage(att.weaponState, critDamage);
    }
    // Arbalète du Verdict
    const verdictBonusSucc = getVerdictCapacityBonus(att.weaponState);
    if (verdictBonusSucc.damageMultiplier !== 1) {
      raw = Math.round(raw * verdictBonusSucc.damageMultiplier);
      verdictBonusSucc.log.forEach(l => log.push(`${playerColor} ${l}`));
    }
    const inflicted = applyDamage(att, def, raw, isCrit, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, true, true, turn);
    def.succubeWeakenNextAttack = true;
    log.push(`${playerColor} 💋 ${att.name} fouette ${def.name} et inflige ${inflicted} dégâts${isCrit ? ' CRITIQUE !' : ''}. La prochaine attaque de ${def.name} est affaiblie.`);
    const succSpellEffects = onCapacityCast(att.weaponState, att, def, raw, 'succ');
    applySceptreCapBuff(att, succSpellEffects, log, playerColor);
    if (succSpellEffects.doubleCast && succSpellEffects.secondCastDamage > 0) {
      const inflictedCodex = applyDamage(att, def, succSpellEffects.secondCastDamage, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
      log.push(`${playerColor} 📜 Codex Archon : ${att.name} fouette ${def.name} et inflige ${inflictedCodex} points de dégâts`);
    }
  }

  const isBastion = !capacityStolen && att.class === 'Bastion' && att.cd.bast === getMindflayerCapacityCooldown(att, def, 'bast');
  if (isBastion) {
    skillUsed = true;
    const spellCapMultBast = consumeAuraCapacityCapMultiplier();
    const isCrit = Math.random() < calcCritChance(att, def);
    let raw = dmgCap(Math.round(att.base.auto + getEffectiveCapForSceptre(att) * spellCapMultBast * classConstants.bastion.capScale + att.base.def * classConstants.bastion.defScale), def.base.rescap);
    raw = Math.round(raw * consumeWeaponDamageBonus());
    raw = applyMindflayerCapacityMod(att, def, raw, 'bast', log, playerColor);
    if (isCrit) {
      const critDamage = Math.round(raw * getCritMultiplier(att, def));
      raw = modifyCritDamage(att.weaponState, critDamage);
    }
    // Arbalète du Verdict
    const verdictBonusBast = getVerdictCapacityBonus(att.weaponState);
    if (verdictBonusBast.damageMultiplier !== 1) {
      raw = Math.round(raw * verdictBonusBast.damageMultiplier);
      verdictBonusBast.log.forEach(l => log.push(`${playerColor} ${l}`));
    }
    const inflicted = applyDamage(att, def, raw, isCrit, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, true, true, turn);
    log.push(`${playerColor} 🏰 ${att.name} percute ${def.name} et inflige ${inflicted} dégâts avec la Charge du Rempart${isCrit ? ' CRITIQUE !' : ''}.`);
    const bastSpellEffects = onCapacityCast(att.weaponState, att, def, raw, 'bast');
    applySceptreCapBuff(att, bastSpellEffects, log, playerColor);
    if (bastSpellEffects.doubleCast && bastSpellEffects.secondCastDamage > 0) {
      const inflictedCodex = applyDamage(att, def, bastSpellEffects.secondCastDamage, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
      log.push(`${playerColor} 📜 Codex Archon : ${att.name} percute ${def.name} et inflige ${inflictedCodex} points de dégâts avec la Charge du Rempart`);
    }
  }

  // ===== ALCHIMISTE : Cycle de flasques =====
  const isAlchimiste = !capacityStolen && att.class === 'Alchimiste';
  const alchVerdictSkip = isAlchimiste && shouldSkipVerdictDemonFamiliar(att.weaponState, turn);
  if (isAlchimiste && !alchVerdictSkip) {
    skillUsed = true;
    const alchC = getSubclassCapacityConstants(att.class, att.subclass?.id);
    const cycleLen = alchC.cycleLength ?? classConstants.alchimiste.cycleLength;
    const phase = att.alchPhase % cycleLen;
    const spellCapMult = consumeAuraCapacityCapMultiplier();
    const fireCapScale = alchC.fireCapScale ?? classConstants.alchimiste.fireCapScale;
    const lifeCapScale = alchC.lifeCapScale ?? classConstants.alchimiste.lifeCapScale;
    const acidDefRed = alchC.acidDefReduction ?? classConstants.alchimiste.acidDefReduction;
    const acidRescRed = alchC.acidRescReduction ?? classConstants.alchimiste.acidRescReduction;

    if (phase === 0) {
      // Flasque de feu : dégâts vs ResC
      const isCrit = turnEffects.guaranteedCrit ? true : Math.random() < calcCritChance(att, def);
      let raw = dmgCap(Math.round((att.base.auto + getEffectiveCapForSceptre(att) * spellCapMult * fireCapScale) * mult), def.base.rescap);
      raw = Math.round(raw * consumeWeaponDamageBonus());
      raw = applyMindflayerCapacityMod(att, def, raw, 'alch', log, playerColor);
      if (isCrit) {
        const critDamage = Math.round(raw * getCritMultiplier(att, def));
        raw = modifyCritDamage(att.weaponState, critDamage);
      }
      const verdictBonus = getVerdictCapacityBonus(att.weaponState);
      if (verdictBonus.damageMultiplier !== 1) {
        raw = Math.round(raw * verdictBonus.damageMultiplier);
        verdictBonus.log.forEach(l => log.push(`${playerColor} ${l}`));
      }
      // Sirène stacks
      if ((att.race === 'Sirène' || att.awakening?.sireneStackBonus != null) && (att.sireneStacks || 0) > 0) {
        const stackBonus = att.awakening?.sireneStackBonus ?? raceConstants.sirene.stackBonus;
        raw = Math.max(1, Math.round(raw * (1 + stackBonus * att.sireneStacks)));
      }
      const inflicted = applyDamage(att, def, raw, isCrit, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, true, true, turn);
      log.push(`${playerColor} 🧪🔥 ${att.name} lance une flasque de feu sur ${def.name} et inflige ${inflicted} dégâts${isCrit ? ' CRITIQUE !' : ''}`);
      // onAttack pour les armes (Option B : flasques offensives déclenchent les hooks)
      const attackEffects = onAttack(att.weaponState, att, def, inflicted);
      if (attackEffects.stunTarget) Object.assign(def, applyMjollnirStun(def));
      if (attackEffects.atkDebuff && !def.base._gungnirDebuffed) def.base = applyGungnirDebuff(def.base);
      if (attackEffects.anathemeDebuff && !def.base._anathemeDebuffed) def.base = applyAnathemeDebuff(def.base);
      if (attackEffects.applyLabrysBleed) applyLabrysBleed(def);
      if (attackEffects.fauxBonusDamage > 0) { def.currentHP -= attackEffects.fauxBonusDamage; tryTriggerOnctionLastStand(def, log, playerColor); }
      if (attackEffects.fauxExecuteDamage > 0) { def.currentHP -= attackEffects.fauxExecuteDamage; tryTriggerOnctionLastStand(def, log, playerColor); }
      if (attackEffects.log.length > 0) log.push(`${playerColor} ${attackEffects.log.join(' ')}`);
      // Codex Archon
      const spellEffects = onCapacityCast(att.weaponState, att, def, raw, 'alch');
      applySceptreCapBuff(att, spellEffects, log, playerColor);
      if (spellEffects.doubleCast && spellEffects.secondCastDamage > 0) {
        const inflictedCodex = applyDamage(att, def, spellEffects.secondCastDamage, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
        log.push(`${playerColor} 📜 Codex Archon : ${att.name} lance une seconde flasque de feu et inflige ${inflictedCodex} dégâts`);
      }
      if (def.currentHP <= 0 && hasMortVivantRevive(def)) reviveUndead(def, att, log, playerColor);

    } else if (phase === 1) {
      // Flasque de vie : soin
      let baseHeal = Math.max(1, Math.round((att.base.auto + getEffectiveCapForSceptre(att) * spellCapMult * lifeCapScale) * getAntiHealFactor(def)));
      // Sirène stacks (boost soins)
      if ((att.race === 'Sirène' || att.awakening?.sireneStackBonus != null) && (att.sireneStacks || 0) > 0) {
        const stackBonus = att.awakening?.sireneStackBonus ?? raceConstants.sirene.stackBonus;
        baseHeal = Math.max(1, Math.round(baseHeal * (1 + stackBonus * att.sireneStacks)));
      }
      const verdictBonus = getVerdictCapacityBonus(att.weaponState);
      if (verdictBonus.healMultiplier !== 1) {
        baseHeal = Math.max(1, Math.round(baseHeal * verdictBonus.healMultiplier));
        verdictBonus.log.forEach(l => log.push(`${playerColor} ${l}`));
      }
      const penduleBonusAlchHeal = getPenduleSpellBonus(att.weaponState);
      if (penduleBonusAlchHeal > 0) baseHeal = Math.max(1, Math.round(baseHeal * (1 + penduleBonusAlchHeal)));
      const healCritResult = rollHealCrit(att.weaponState, att, baseHeal);
      const heal = healCritResult.amount;
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} 🧪💚 ${att.name} boit une flasque de vie et récupère ${heal} PV${healCritResult.isCrit ? ' CRITIQUE !' : ''}`);
      const healEffects = onHeal(att.weaponState, att, heal, def);
      if (healEffects.bonusDamage > 0) {
        const bonusDmg = dmgCap(healEffects.bonusDamage, def.base.rescap);
        applyDamage(att, def, bonusDmg, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
        log.push(`${playerColor} ${healEffects.log.join(' ')}`);
      }
      // Codex Archon (double soin)
      const spellEffects = onCapacityCast(att.weaponState, att, def, heal, 'alch_heal');
      applySceptreCapBuff(att, spellEffects, log, playerColor);
      if (spellEffects.doubleCast && spellEffects.secondCastHeal > 0) {
        att.currentHP = Math.min(att.maxHP, att.currentHP + spellEffects.secondCastHeal);
        log.push(`${playerColor} 📜 Codex Archon : ${att.name} boit une seconde flasque de vie et récupère ${spellEffects.secondCastHeal} PV`);
      }
      // Mindflayer copie
      if (def?.race === 'Mindflayer' || def?.awakening?.mindflayerStealSpellCapDamageScale != null) {
        triggerMindflayerCapacityCopy(att, def, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, null, heal, turn);
      }

    } else if (phase === 2) {
      // Flasque d'acide : dégâts + réduction DEF/ResC
      const isCrit = turnEffects.guaranteedCrit ? true : Math.random() < calcCritChance(att, def);
      let raw = dmgCap(Math.round(att.base.auto * mult), def.base.rescap);
      raw = Math.round(raw * consumeWeaponDamageBonus());
      raw = applyMindflayerCapacityMod(att, def, raw, 'alch', log, playerColor);
      if (isCrit) {
        const critDamage = Math.round(raw * getCritMultiplier(att, def));
        raw = modifyCritDamage(att.weaponState, critDamage);
      }
      const verdictBonus = getVerdictCapacityBonus(att.weaponState);
      if (verdictBonus.damageMultiplier !== 1) {
        raw = Math.round(raw * verdictBonus.damageMultiplier);
        verdictBonus.log.forEach(l => log.push(`${playerColor} ${l}`));
      }
      // Sirène stacks
      if ((att.race === 'Sirène' || att.awakening?.sireneStackBonus != null) && (att.sireneStacks || 0) > 0) {
        const stackBonus = att.awakening?.sireneStackBonus ?? raceConstants.sirene.stackBonus;
        raw = Math.max(1, Math.round(raw * (1 + stackBonus * att.sireneStacks)));
      }
      const inflicted = applyDamage(att, def, raw, isCrit, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, true, true, turn);
      // Réduction DEF/ResC
      const defBefore = def.base.def;
      const rescBefore = def.base.rescap;
      def.base = {
        ...def.base,
        def: Math.max(1, Math.round(def.base.def * (1 - acidDefRed))),
        rescap: Math.max(1, Math.round(def.base.rescap * (1 - acidRescRed)))
      };
      log.push(`${playerColor} 🧪🟢 ${att.name} lance une flasque d'acide sur ${def.name} et inflige ${inflicted} dégâts${isCrit ? ' CRITIQUE !' : ''}. DEF -${Math.round(acidDefRed * 100)}% (${defBefore}→${def.base.def}), ResC -${Math.round(acidRescRed * 100)}% (${rescBefore}→${def.base.rescap}).`);
      // onAttack pour les armes
      const attackEffects = onAttack(att.weaponState, att, def, inflicted);
      if (attackEffects.stunTarget) Object.assign(def, applyMjollnirStun(def));
      if (attackEffects.atkDebuff && !def.base._gungnirDebuffed) def.base = applyGungnirDebuff(def.base);
      if (attackEffects.anathemeDebuff && !def.base._anathemeDebuffed) def.base = applyAnathemeDebuff(def.base);
      if (attackEffects.applyLabrysBleed) applyLabrysBleed(def);
      if (attackEffects.fauxBonusDamage > 0) { def.currentHP -= attackEffects.fauxBonusDamage; tryTriggerOnctionLastStand(def, log, playerColor); }
      if (attackEffects.fauxExecuteDamage > 0) { def.currentHP -= attackEffects.fauxExecuteDamage; tryTriggerOnctionLastStand(def, log, playerColor); }
      if (attackEffects.log.length > 0) log.push(`${playerColor} ${attackEffects.log.join(' ')}`);
      // Codex Archon
      const spellEffects = onCapacityCast(att.weaponState, att, def, raw, 'alch');
      applySceptreCapBuff(att, spellEffects, log, playerColor);
      if (spellEffects.doubleCast && spellEffects.secondCastDamage > 0) {
        const inflictedCodex = applyDamage(att, def, spellEffects.secondCastDamage, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
        log.push(`${playerColor} 📜 Codex Archon : ${att.name} lance une seconde flasque d'acide et inflige ${inflictedCodex} dégâts`);
      }
      if (def.currentHP <= 0 && hasMortVivantRevive(def)) reviveUndead(def, att, log, playerColor);

    } else if (phase === 3) {
      // Flasque de métal (sous-classe Alchimiste de Métal uniquement)
      const isCrit = turnEffects.guaranteedCrit ? true : Math.random() < calcCritChance(att, def);
      let raw = dmgCap(Math.round(att.base.auto * mult), def.base.rescap);
      raw = Math.round(raw * consumeWeaponDamageBonus());
      raw = applyMindflayerCapacityMod(att, def, raw, 'alch', log, playerColor);
      if (isCrit) {
        const critDamage = Math.round(raw * getCritMultiplier(att, def));
        raw = modifyCritDamage(att.weaponState, critDamage);
      }
      const verdictBonus = getVerdictCapacityBonus(att.weaponState);
      if (verdictBonus.damageMultiplier !== 1) {
        raw = Math.round(raw * verdictBonus.damageMultiplier);
        verdictBonus.log.forEach(l => log.push(`${playerColor} ${l}`));
      }
      // Sirène stacks
      if ((att.race === 'Sirène' || att.awakening?.sireneStackBonus != null) && (att.sireneStacks || 0) > 0) {
        const stackBonus = att.awakening?.sireneStackBonus ?? raceConstants.sirene.stackBonus;
        raw = Math.max(1, Math.round(raw * (1 + stackBonus * att.sireneStacks)));
      }
      const inflicted = applyDamage(att, def, raw, isCrit, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, true, true, turn);
      const stunDur = alchC.metalStunDuration ?? classConstants.alchimiste.metalStunDuration;
      if (def.currentHP > 0) {
        def.stunned = true;
        def.stunnedTurns = stunDur;
      }
      log.push(`${playerColor} 🧪⚙️ ${att.name} lance une flasque de métal sur ${def.name} et inflige ${inflicted} dégâts${isCrit ? ' CRITIQUE !' : ''}. ${def.name} est étourdi ${stunDur} tour !`);
      // onAttack pour les armes
      const attackEffects = onAttack(att.weaponState, att, def, inflicted);
      if (attackEffects.stunTarget) Object.assign(def, applyMjollnirStun(def));
      if (attackEffects.atkDebuff && !def.base._gungnirDebuffed) def.base = applyGungnirDebuff(def.base);
      if (attackEffects.anathemeDebuff && !def.base._anathemeDebuffed) def.base = applyAnathemeDebuff(def.base);
      if (attackEffects.applyLabrysBleed) applyLabrysBleed(def);
      if (attackEffects.fauxBonusDamage > 0) { def.currentHP -= attackEffects.fauxBonusDamage; tryTriggerOnctionLastStand(def, log, playerColor); }
      if (attackEffects.fauxExecuteDamage > 0) { def.currentHP -= attackEffects.fauxExecuteDamage; tryTriggerOnctionLastStand(def, log, playerColor); }
      if (attackEffects.log.length > 0) log.push(`${playerColor} ${attackEffects.log.join(' ')}`);
      // Codex Archon
      const spellEffects = onCapacityCast(att.weaponState, att, def, raw, 'alch');
      applySceptreCapBuff(att, spellEffects, log, playerColor);
      if (spellEffects.doubleCast && spellEffects.secondCastDamage > 0) {
        const inflictedCodex = applyDamage(att, def, spellEffects.secondCastDamage, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
        log.push(`${playerColor} 📜 Codex Archon : ${att.name} lance une seconde flasque de métal et inflige ${inflictedCodex} dégâts`);
      }
      if (def.currentHP <= 0 && hasMortVivantRevive(def)) reviveUndead(def, att, log, playerColor);
    }

    att.alchPhase = (att.alchPhase + 1) % cycleLen;
  }

  if (att.class === 'Voleur' && att.cd.rog === getMindflayerCapacityCooldown(att, def, 'rog') && !capacityStolen) {
    skillUsed = true;
    consumeAuraCapacityCapMultiplier();
    att.dodge = true;
    if (att.subclass?.id === 'assassin') {
      att.voleurGuaranteedCrit = true;
      log.push(`${playerColor} 🗡️ Assassin: la prochaine attaque de ${att.name} sera un critique.`);
    }
    if (att.subclass?.id === 'roublard') {
      const stats = ['auto', 'def', 'cap', 'rescap', 'spd'];
      const stat = stats[Math.floor(Math.random() * stats.length)];
      const stolen = Math.max(0, Math.round(def.base[stat] * 0.06));
      if (stolen > 0) {
        def.base = { ...def.base, [stat]: Math.max(1, def.base[stat] - stolen) };
        att.base = { ...att.base, [stat]: (att.base[stat] || 0) + stolen };
        log.push(`${playerColor} 🎭 Roublard: ${att.name} vole 6% ${stat} (${stolen}) à ${def.name}.`);
      }
    }
    log.push(`${playerColor} 🌀 ${att.name} entre dans une posture d'esquive et évitera la prochaine attaque`);
    if (def?.race === 'Mindflayer' || def?.awakening?.mindflayerStealSpellCapDamageScale != null) {
      triggerMindflayerCapacityCopy(att, def, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, null, null, turn);
    }
  }

  // ===== CAPACITÉS SPÉCIALES DES BOSS =====
  if (att.isBoss && att.ability) {
    att.cd.boss_ability = (att.cd.boss_ability || 0) + 1;

    // Bandit: Saignement tous les N tours
    if (att.bossId === 'bandit' && att.cd.boss_ability >= att.ability.cooldown) {
      def.bleed_stacks = (def.bleed_stacks || 0) + (att.ability.effect?.stacksPerHit || 1);
      log.push(`${playerColor} 🗡️ ${att.name} empoisonne sa lame et applique un saignement !`);
      triggerMindflayerCapacityCopy(att, def, log, playerColor, attackerPassiveList, defenderPassiveList, defenderUnicorn, attackerUnicorn, auraBonus, null, null, turn);
      att.cd.boss_ability = 0;
    }

    // Dragon: Sort dévastateur tous les N tours
    if (att.bossId === 'dragon' && att.cd.boss_ability >= att.ability.cooldown) {
      const spellDmg = Math.round(att.base.cap * (1 + (att.ability.effect?.damageBonus || 0.5)));
      const raw = dmgCap(spellDmg, def.base.rescap);
      const inflicted = applyDamage(att, def, raw, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, true, true, turn);
      log.push(`${playerColor} 🔥 ${att.name} lance un Souffle de Flammes dévastateur et inflige ${inflicted} points de dégâts`);
      triggerMindflayerCapacityCopy(att, def, log, playerColor, attackerPassiveList, defenderPassiveList, defenderUnicorn, attackerUnicorn, auraBonus, inflicted, null, turn);
      if (def.currentHP <= 0 && hasMortVivantRevive(def)) {
        reviveUndead(def, att, log, playerColor);
      }
      att.cd.boss_ability = 0;
    }

    // Ornn: Appel du dieu de la forge — Auto + 50% CAP, Stun 1 tour, CD 5
    if (att.bossId === 'ornn' && att.cd.boss_ability >= att.ability.cooldown) {
      const capScale = att.ability.effect?.capScale || 0.5;
      const spellDmg = Math.round(att.base.auto + att.base.cap * capScale);
      const raw = dmgCap(spellDmg, def.base.rescap);
      const inflicted = applyDamage(att, def, raw, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, true, true, turn);
      log.push(`${playerColor} 🔥 ${att.name} invoque l'Appel du dieu de la forge et inflige ${inflicted} points de dégâts`);
      triggerMindflayerCapacityCopy(att, def, log, playerColor, attackerPassiveList, defenderPassiveList, defenderUnicorn, attackerUnicorn, auraBonus, inflicted, null, turn);
      if (def.currentHP > 0) {
        const stunDuration = att.ability.effect?.stunDuration || 1;
        def.stunned = true;
        def.stunnedTurns = stunDuration;
        log.push(`${playerColor} 😵 ${def.name} est étourdi pendant ${stunDuration} tour !`);
      }
      if (def.currentHP <= 0 && hasMortVivantRevive(def)) {
        reviveUndead(def, att, log, playerColor);
      }
      att.cd.boss_ability = 0;
    }

    // Koro Sensei (Collège Kunugigaoka) : Leçon du maître — Auto + 30% CAP, réduit prochaine attaque adverse de 15%, CD 4
    if (att.bossId === 'koro_sensei' && att.cd.boss_ability >= att.ability.cooldown) {
      const capScale = att.ability.effect?.capScale ?? 0.3;
      const spellDmg = Math.round(att.base.auto + att.base.cap * capScale);
      const raw = dmgCap(spellDmg, def.base.rescap);
      const inflicted = applyDamage(att, def, raw, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, true, true, turn);
      log.push(`${playerColor} 🎓 ${att.name} donne une Leçon du maître et inflige ${inflicted} points de dégâts`);
      triggerMindflayerCapacityCopy(att, def, log, playerColor, attackerPassiveList, defenderPassiveList, defenderUnicorn, attackerUnicorn, auraBonus, inflicted, null, turn);
      const reduction = att.ability.effect?.nextAttackReduction ?? 0.15;
      def.trainerNextAttackReduction = reduction;
      log.push(`${playerColor} 📉 La prochaine attaque de ${def.name} infligera -${Math.round(reduction * 100)}% de dégâts.`);
      if (def.currentHP <= 0 && hasMortVivantRevive(def)) {
        reviveUndead(def, att, log, playerColor);
      }
      att.cd.boss_ability = 0;
    }

    // Gojo (Extension du Territoire) : sorts fixes aux tours 2, 4, 6
    if (att.bossId === 'gojo' && att.ability?.spells) {
      const spell = att.ability.spells[turn];
      if (spell) {
        let spellDmg;
        if (spell.damage.targetHpPercent != null) {
          spellDmg = Math.round(att.base.auto + def.currentHP * spell.damage.targetHpPercent);
        } else {
          spellDmg = Math.round(att.base.auto * (spell.damage.autoScale || 1) + att.base.cap * (spell.damage.capScale || 0));
        }
        const raw = dmgCap(spellDmg, def.base.rescap);
        const inflicted = applyDamage(att, def, raw, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, true, true, turn);
        const emoji = spell.color === 'bleu' ? '🔵' : spell.color === 'rouge' ? '🔴' : '🟣';
        log.push(`${playerColor} ${emoji} ${att.name} lance ${spell.name} et inflige ${inflicted} points de dégâts`);
        triggerMindflayerCapacityCopy(att, def, log, playerColor, attackerPassiveList, defenderPassiveList, defenderUnicorn, attackerUnicorn, auraBonus, inflicted, null, turn);
        if (def.currentHP > 0 && spell.stun > 0) {
          def.stunned = true;
          def.stunnedTurns = spell.stun;
          log.push(`${playerColor} 😵 ${def.name} est étourdi pendant ${spell.stun} tour !`);
        }
        if (def.currentHP <= 0 && hasMortVivantRevive(def)) {
          reviveUndead(def, att, log, playerColor);
        }
        return;
      }
    }
  }

  const isMage = !capacityStolen && att.class === 'Mage' && att.cd.mag === getMindflayerCapacityCooldown(att, def, 'mag');
  const isWar = !capacityStolen && att.class === 'Guerrier' && att.cd.war === getMindflayerCapacityCooldown(att, def, 'war');
  const isArcher = !capacityStolen && att.class === 'Archer' && att.cd.arc === getMindflayerCapacityCooldown(att, def, 'arc');
  skillUsed = skillUsed || isMage || isWar || isArcher;

  // Mindflayer éveillé: -1 CD uniquement sur la première capacité avec CD > 1 (réinitialiser le CD utilisé).
  // Pour capacité à 0/1 CD (ex. Demoniste familier), seul le buff de dégâts (mindflayerNoCooldownSpellBonus) s'applique, dans applyMindflayerCapacityMod.
  if (skillUsed && (att.race === 'Mindflayer' || att.awakening?.mindflayerOwnCooldownReductionTurns != null) && !att.mindflayerFirstCDUsed) {
    const aw = att.awakening || {};
    const reduction = aw.mindflayerOwnCooldownReductionTurns ?? raceConstants.mindflayer.ownCooldownReductionTurns;
    if (reduction > 0) {
      let didResetCd = false;
      if (att.class === 'Paladin') { att.cd.pal = 0; didResetCd = true; }
      else if (att.class === 'Healer') { att.cd.heal = 0; didResetCd = true; }
      else if (att.class === 'Succube') { att.cd.succ = 0; didResetCd = true; }
      else if (att.class === 'Bastion') { att.cd.bast = 0; didResetCd = true; }
      else if (att.class === 'Voleur') { att.cd.rog = 0; didResetCd = true; }
      else if (att.class === 'Masochiste') { att.cd.maso = 0; didResetCd = true; }
      else if (isMage) { att.cd.mag = 0; didResetCd = true; }
      else if (isWar) { att.cd.war = 0; didResetCd = true; }
      else if (isArcher) { att.cd.arc = 0; didResetCd = true; }
      if (didResetCd) att.mindflayerFirstCDUsed = true;
    }
  }

  // Pendule de Chronos : consommer la charge de CDR quand une capacité est effectivement lancée
  if (skillUsed) {
    consumePenduleCdCharge(att.weaponState);
    // Remettre le CD de la capacité utilisée à 0 pour que le cycle (cd % effectiveCd)+1 reparte correctement.
    // Sinon, après la 2e utilisation avec Pendule, effectiveCd passe de 3 à 4 et (3%4)+1=4 rend la cap dispo au tour suivant.
    if (att.class === 'Paladin') att.cd.pal = 0;
    else if (att.class === 'Healer') att.cd.heal = 0;
    else if (att.class === 'Succube') att.cd.succ = 0;
    else if (att.class === 'Bastion') att.cd.bast = 0;
    else if (att.class === 'Voleur') att.cd.rog = 0;
    else if (att.class === 'Masochiste') att.cd.maso = 0;
    else if (att.class === 'Mage') att.cd.mag = 0;
    else if (att.class === 'Guerrier') att.cd.war = 0;
    else if (att.class === 'Archer') att.cd.arc = 0;
  }

  // Entrave Arcanique : marquer que la première capacité a été utilisée (pour stopper le bonus de dégâts)
  if (skillUsed && !att._entraveFirstCapUsed) {
    att._entraveFirstCapUsed = true;
  }

  const baseHits = (isAlchimiste && !alchVerdictSkip) ? 0 : isBastion ? 0 : isArcher ? classConstants.archer.hitCount : 1;
  const totalHits = baseHits + (turnEffects.bonusAttacks || 0);
  let total = 0;
  let wasCrit = false;

  const obsidianPassive = getPassiveById(attackerPassiveList, 'obsidian_skin');
  const forceCrit = obsidianPassive && att.currentHP <= att.maxHP * (obsidianPassive.levelData?.critThreshold ?? 0);
  let fractureUsedThisTurn = false;

  for (let i = 0; i < totalHits; i++) {
    const isBonusAttack = i >= baseHits;
    const subclassCritBonus = att.subclass?.id === 'ame_tentatrice' ? 0.15 : (att.subclass?.id === 'chasseur_fantome' ? 0.10 : 0);
    const critChance = Math.max(0, calcCritChance(att, def) + subclassCritBonus - (att._refletMauditCritMalus || 0));
    const isCrit = turnEffects.guaranteedCrit ? true : forceCrit ? true : att.voleurGuaranteedCrit ? (att.voleurGuaranteedCrit = false, true) : Math.random() < critChance;
    if (isCrit) wasCrit = true;
    let raw = 0;
    const weaponBonus = i === 0 ? consumeWeaponDamageBonus() : 1;
    const attackMultiplier = mult * weaponBonus * (isBonusAttack ? (turnEffects.bonusAttackDamage || 1) : 1);

    if (isMage) {
      const { capBase, capPerCap } = classConstants.mage;
      const spellCapMultiplier = consumeAuraCapacityCapMultiplier();
      const effectiveCap = getEffectiveCapForSceptre(att);
      const scaledCap = effectiveCap * spellCapMultiplier;
      const atkSpell = Math.round(att.base.auto * attackMultiplier + (capBase + capPerCap * scaledCap) * scaledCap * attackMultiplier);
      raw = dmgCap(atkSpell, def.base.rescap);
      if (att.subclass?.id === 'arcaniste_instable' && i === 0) {
        const mageC = getSubclassCapacityConstants(att.class, att.subclass?.id);
        const stack = mageC.damageTakenStack ?? 0.05;
        def.arcanisteDamageTakenStack = (def.arcanisteDamageTakenStack || 0) + stack;
        log.push(`${playerColor} 💥 Arcaniste Instable: ${def.name} subira +5% dégâts (stackable).`);
      }
      if (att.subclass?.id === 'sorcier_neant' && i === 0) {
        def.sorcierNeantBurn = true;
        log.push(`${playerColor} 🌑 Brûlure du Néant: ${def.name} infligera -10% dégâts Auto et perd 2% PV/tour.`);
      }
      if (i === 0) log.push(`${playerColor} 🔮 ${att.name} utilise sa capacité magique`);
      raw = applyMindflayerCapacityMod(att, def, raw, 'mag', log, playerColor);
      // Arbalète du Verdict: +100% dégâts sur les 2 premières capacités
      const verdictBonus = getVerdictCapacityBonus(att.weaponState);
      if (verdictBonus.damageMultiplier !== 1) {
        raw = Math.round(raw * verdictBonus.damageMultiplier);
        verdictBonus.log.forEach(l => log.push(`${playerColor} ${l}`));
      }
      const spellEffects = onCapacityCast(att.weaponState, att, def, raw, 'mage');
      applySceptreCapBuff(att, spellEffects, log, playerColor);
      if (spellEffects.doubleCast && spellEffects.secondCastDamage > 0) {
        const inflictedCodex = applyDamage(att, def, spellEffects.secondCastDamage, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
        log.push(`${playerColor} 📜 Codex Archon : ${att.name} utilise sa capacité magique et inflige ${inflictedCodex} points de dégâts`);
      }
    } else if (isWar) {
      // Maître d'armes (sous-classe) : ignore 100% def/resC, inflige Auto + X% CAP
      if (att.subclass?.id === 'maitre_armes') {
        const guerrierC = getSubclassCapacityConstants(att.class, att.subclass?.id);
        const capScale = guerrierC.capScale ?? 0.10;
        const spellCapMultWar = consumeAuraCapacityCapMultiplier();
        raw = Math.max(1, Math.round((att.base.auto + getEffectiveCapForSceptre(att) * capScale) * spellCapMultWar * attackMultiplier));
      } else {
        const { ignoreBase, ignorePerCap, autoBonus } = classConstants.guerrier;
        const spellCapMultWar = consumeAuraCapacityCapMultiplier();
        const ignore = ignoreBase + ignorePerCap * getEffectiveCapForSceptre(att) * spellCapMultWar;
        const effectiveAuto = Math.round((att.base.auto + autoBonus) * attackMultiplier);
        // Frappe la résistance la plus FAIBLE entre Déf et ResC
        if (def.base.def <= def.base.rescap) {
          const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
          raw = dmgPhys(effectiveAuto, effDef);
        } else {
          const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
          raw = dmgPhys(effectiveAuto, effRes);
        }
      }
      raw = applyMindflayerCapacityMod(att, def, raw, 'war', log, playerColor);
      // Arbalète du Verdict: +100% dégâts sur les 2 premières capacités
      const verdictBonusWar = getVerdictCapacityBonus(att.weaponState);
      if (verdictBonusWar.damageMultiplier !== 1) {
        raw = Math.round(raw * verdictBonusWar.damageMultiplier);
        verdictBonusWar.log.forEach(l => log.push(`${playerColor} ${l}`));
      }
      if (i === 0) {
        log.push(`${playerColor} 🗡️ ${att.name} exécute une frappe pénétrante`);
        const warSpellEffects = onCapacityCast(att.weaponState, att, def, raw, 'war');
        applySceptreCapBuff(att, warSpellEffects, log, playerColor);
        if (warSpellEffects.doubleCast && warSpellEffects.secondCastDamage > 0) {
          const inflictedCodex = applyDamage(att, def, warSpellEffects.secondCastDamage, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
          log.push(`${playerColor} 📜 Codex Archon : ${att.name} exécute une frappe pénétrante et inflige ${inflictedCodex} points de dégâts`);
        }
        if (att.subclass?.id === 'duracier') {
          const guerrierC = getSubclassCapacityConstants(att.class, att.subclass?.id);
          const shieldAuto = guerrierC.shieldAutoPercent ?? 0.15;
          const shieldCap = guerrierC.shieldCapPercent ?? 0.005;
          const duracierShield = Math.max(1, Math.round(att.base.auto * shieldAuto + getEffectiveCapForSceptre(att) * shieldCap));
          att.shield = (att.shield || 0) + duracierShield;
          log.push(`${playerColor} 🛡️ Duracier: ${att.name} gagne un bouclier de ${duracierShield} PV (15% Auto + 0,5% CAP).`);
        }
      }
    } else if (isArcher && !isBonusAttack) {
      if (i === 0) {
        raw = dmgPhys(Math.round(att.base.auto * attackMultiplier), def.base.def);
      } else {
        const archerC = getSubclassCapacityConstants(att.class, att.subclass?.id);
        const hit2AutoMult = archerC.hit2AutoMultiplier ?? classConstants.archer.hit2AutoMultiplier;
        const { hit2CapMultiplier } = classConstants.archer;
        const spellCapMultArc = consumeAuraCapacityCapMultiplier();
        const physPart = dmgPhys(Math.round(att.base.auto * hit2AutoMult * attackMultiplier), def.base.def);
        const capPart = dmgCap(Math.round(getEffectiveCapForSceptre(att) * spellCapMultArc * hit2CapMultiplier * attackMultiplier), def.base.rescap);
        raw = physPart + capPart;
        if (att.subclass?.id === 'chasseur_fantome' && att.ghostHunterNextDamageCapBonus) {
          raw += Math.max(0, Math.round(getEffectiveCapForSceptre(att) * att.ghostHunterNextDamageCapBonus));
          log.push(`${playerColor} 👻 Chasseur Fantôme: +20% CAP aux dégâts après le crit.`);
          att.ghostHunterNextDamageCapBonus = undefined;
        }
      }
      if (att.subclass?.id === 'chasseur_fantome' && isCrit && i === 0) {
        const archerC = getSubclassCapacityConstants(att.class, att.subclass?.id);
        att.ghostHunterNextDamageCapBonus = archerC.ghostHunterCapBonus ?? 0.20;
      }
      raw = applyMindflayerCapacityMod(att, def, raw, 'arc', log, playerColor);
      // Arbalète du Verdict: +100% dégâts sur les 2 premières capacités (1 seul usage par activation skill)
      if (i === 0) {
        const verdictBonusArc = getVerdictCapacityBonus(att.weaponState);
        if (verdictBonusArc.damageMultiplier !== 1) {
          raw = Math.round(raw * verdictBonusArc.damageMultiplier);
          verdictBonusArc.log.forEach(l => log.push(`${playerColor} ${l}`));
        }
      }
      if (i === 1) {
        const arcSpellEffects = onCapacityCast(att.weaponState, att, def, raw, 'arc');
        applySceptreCapBuff(att, arcSpellEffects, log, playerColor);
        if (arcSpellEffects.doubleCast && arcSpellEffects.secondCastDamage > 0) {
          const inflictedCodex = applyDamage(att, def, arcSpellEffects.secondCastDamage, false, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, false, false, turn);
          log.push(`${playerColor} 📜 Codex Archon : ${att.name} lance un tir renforcé et inflige ${inflictedCodex} points de dégâts`);
        }
      }
    } else {
      const autoCapBonus = getBriseurAutoBonus(att);
      raw = dmgPhys(Math.round((att.base.auto + autoCapBonus) * attackMultiplier), def.base.def);
      // Orbe du Sacrifice Sanguin: +Y% dégâts autos, -X% HP max
      const orbePassive = getPassiveById(attackerPassiveList, 'orbe_sacrifice');
      if (orbePassive) {
        raw = Math.round(raw * (1 + orbePassive.levelData.autoDamageBonus));
        const hpCost = Math.max(1, Math.round(att.maxHP * orbePassive.levelData.hpCostPercent));
        att.currentHP -= hpCost;
        tryTriggerOnctionLastStand(att, log, playerColor);
        log.push(`${playerColor} 🩸 Orbe du Sacrifice: ${att.name} se sacrifie (-${hpCost} PV) pour frapper plus fort (+${Math.round(orbePassive.levelData.autoDamageBonus * 100)}%)`);
      }
      if (att.race === 'Lycan' || (att.awakening?.bleedStacksPerHit ?? 0) > 0) {
        const bleedStacks = att.awakening ? (att.awakening.bleedStacksPerHit ?? 0) : raceConstants.lycan.bleedPerHit;
        if (bleedStacks > 0) {
          def.bleed_stacks = (def.bleed_stacks || 0) + bleedStacks;
        }
        if (att.awakening?.bleedPercentPerStack) def.bleedPercentPerStack = att.awakening.bleedPercentPerStack;
        else if (att.race === 'Lycan') def.bleedPercentPerStack = raceConstants.lycan.bleedPercentPerStack;
      }
    }

    if ((isMage || isWar || (isArcher && !isBonusAttack)) && (att.race === 'Sirène' || att.awakening?.sireneStackBonus != null) && (att.sireneStacks || 0) > 0) {
      const stackBonus = att.awakening?.sireneStackBonus ?? raceConstants.sirene.stackBonus;
      raw = Math.max(1, Math.round(raw * (1 + stackBonus * att.sireneStacks)));
    }

    if (isCrit) {
      const critDamage = Math.round(raw * getCritMultiplier(att, def));
      raw = modifyCritDamage(att.weaponState, critDamage);
    }

    // Ours (forêt) : Rage — à 25% PV prépare un coup dévastateur (double dégâts au prochain coup)
    if (att?.ability?.type === 'bear_rage' && att.rageReady) {
      raw = Math.round(raw * 2);
      att.rageReady = false;
      att.rageUsed = true;
      log.push(`${playerColor} 🐻 ${att.name} libère sa Rage et inflige un coup dévastateur !`);
    }

    // Rituel de Fracture: explose le bouclier ennemi sur auto (1 fois par tour)
    const fracturePassive = getPassiveById(attackerPassiveList, 'rituel_fracture');
    if (fracturePassive && !fractureUsedThisTurn && !isMage && !isWar && def.shield > 0) {
      fractureUsedThisTurn = true;
      const shieldValue = def.shield;
      const fractureDmg = Math.max(1, Math.round(shieldValue * (fracturePassive.levelData?.shieldExplosionPercent ?? 0)));
      def.shield = 0;
      def.currentHP -= fractureDmg;
      tryTriggerOnctionLastStand(def, log, playerColor);
      def.maso_taken = (def.maso_taken || 0) + fractureDmg;
      if (def.awakening?.damageStackBonus) def.awakening.damageTakenStacks += 1;
      log.push(`${playerColor} 💥 Rituel de Fracture: ${att.name} brise le bouclier de ${def.name} (${shieldValue}) et inflige ${fractureDmg} dégâts bruts !`);

      if (def?.ability?.type === 'lich_shield' && !def.shieldExploded) {
        def.shieldExploded = true;
        let lichExplosion = Math.max(1, Math.round(def.maxHP * 0.2));
        lichExplosion = applyIncomingAwakeningModifiers(att, lichExplosion);
        att.currentHP -= lichExplosion;
        tryTriggerOnctionLastStand(att, log, playerColor);
        if (att.awakening?.damageStackBonus) att.awakening.damageTakenStacks += 1;
        log.push(`${playerColor} 💥 Le bouclier de liche de ${def.name} explose aussi et inflige ${lichExplosion} dégâts à ${att.name}`);
      }
    }

    const inflicted = applyDamage(att, def, raw, isCrit, log, playerColor, attackerPassiveList, defenderPassiveList, attackerUnicorn, defenderUnicorn, auraBonus, true, (isMage || isWar || (isArcher && !isBonusAttack)), turn);
    if (att.class === 'Demoniste' && !isMage && !isWar && !isArcher && !isBonusAttack) {
      att.familiarStacks = (att.familiarStacks || 0) + 1;
    }

    if (!isMage) {
      const attackEffects = onAttack(att.weaponState, att, def, inflicted);
      if (attackEffects.stunTarget) Object.assign(def, applyMjollnirStun(def));
      if (attackEffects.atkDebuff && !def.base._gungnirDebuffed) def.base = applyGungnirDebuff(def.base);
      if (attackEffects.anathemeDebuff && !def.base._anathemeDebuffed) def.base = applyAnathemeDebuff(def.base);
      if (attackEffects.applyLabrysBleed) applyLabrysBleed(def);
      if (attackEffects.fauxBonusDamage > 0) { def.currentHP -= attackEffects.fauxBonusDamage; tryTriggerOnctionLastStand(def, log, playerColor); }
      if (attackEffects.fauxExecuteDamage > 0) { def.currentHP -= attackEffects.fauxExecuteDamage; tryTriggerOnctionLastStand(def, log, playerColor); }
      if (attackEffects.log.length > 0) log.push(`${playerColor} ${attackEffects.log.join(' ')}`);
    }

    // Écho de Guerre : +X% Auto par attaque (stackable)
    // - Autos classiques : proc sur chaque attaque non-Mage/non-Guerrier
    // - Archer : proc sur le premier tir de Double tir uniquement
    if (!isMage && !isWar && inflicted > 0 && (!isArcher || i === 0)) {
      const echoPassive = getPassiveById(attackerPassiveList, 'echo_guerre');
      if (echoPassive) {
        att._echoStacks = (att._echoStacks || 0);
        const maxStacks = echoPassive.levelData?.maxStacks ?? 5;
        if (att._echoStacks < maxStacks) {
          att._echoStacks++;
          const stackPct = echoPassive.levelData?.autoStackPercent ?? 0.02;
          const bonus = Math.max(1, Math.round(att.base.auto * stackPct));
          att.base = { ...att.base, auto: att.base.auto + bonus };
          log.push(`${playerColor} ⚔️ Écho de Guerre: Auto de ${att.name} +${bonus} (stack ${att._echoStacks}/${maxStacks})`);
        }
      }
    }

    // Log du tir / attaque bonus avant le test de mort : si le second tir est létal, on doit quand même afficher ses dégâts
    if (isArcher && !isBonusAttack) {
      const critText = isCrit ? ' CRITIQUE !' : '';
      const shotLabel = i === 0 ? 'tir' : 'tir renforcé';
      log.push(`${playerColor} 🏹 ${att.name} lance un ${shotLabel} et inflige ${inflicted} points de dégâts${critText}`);
      flushPendingCombatLogs(att, log);
    } else if (isBonusAttack) {
      log.push(`${playerColor} 🌟 Attaque bonus: ${att.name} inflige ${inflicted} points de dégâts`);
      flushPendingCombatLogs(att, log);
    }

    if (def.currentHP <= 0 && hasMortVivantRevive(def)) {
      reviveUndead(def, att, log, playerColor);
    } else if (def.currentHP <= 0) {
      total += inflicted;
      break;
    }

    // Ours (forêt) : quand le défenseur tombe à ≤25% PV, il entre en Rage au prochain tour
    if (def?.ability?.type === 'bear_rage' && !def.rageReady && !def.rageUsed && def.currentHP > 0 && def.currentHP <= def.maxHP * 0.25) {
      def.rageReady = true;
      log.push(`${playerColor} 🐻 ${def.name} entre en Rage et prépare un coup dévastateur !`);
    }

    total += inflicted;
  }

  const elementalFuryPassive = getPassiveById(attackerPassiveList, 'elemental_fury');
  if (elementalFuryPassive && skillUsed) {
    const lightningDamage = Math.max(1, Math.round(att.base.auto * (elementalFuryPassive.levelData?.lightningPercent ?? 0)));
    def.currentHP -= lightningDamage;
    tryTriggerOnctionLastStand(def, log, playerColor);
    log.push(`${playerColor} ⚡ Furie élémentaire déclenche un éclair et inflige ${lightningDamage} dégâts bruts`);
    if (def.currentHP <= 0 && hasMortVivantRevive(def)) reviveUndead(def, att, log, playerColor);
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

  flushPendingCombatLogs(att, log);
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

/**
 * Simule un combat entre deux combattants.
 * IMPORTANT: char1 et char2 doivent être des données BRUTES (personnage / boss non préparés).
 * simulerMatch appelle preparerCombattant() sur les deux arguments. Ne jamais passer
 * un objet déjà passé par prepareForCombat ou preparerCombattant (sinon forêt/arme/passif
 * sont appliqués deux fois → bug "double préparation" dans les donjons).
 * @param {Object} char1 - Personnage ou NPC brut (ex. character depuis Firestore, createBossCombatant(), buildFloorEnemy())
 * @param {Object} char2 - Idem
 */
export function simulerMatch(char1, char2, { maxTurns = Infinity } = {}) {
  const p1 = preparerCombattant(char1);
  const p2 = preparerCombattant(char2);

  // Appliquer le bonus de CAP conditionnel du Gnome
  applyGnomeCapBonus(p1, p2);
  applyGnomeCapBonus(p2, p1);

  const allLogs = [];
  const steps = [];

  // Phase intro
  const introLogs = [`⚔️ Le combat épique commence entre ${p1.name} et ${p2.name} !`];
  const p1DefBefore = p1.base?.def;
  const p2DefBefore = p2.base?.def;
  applyStartOfCombatPassives(p1, p2, introLogs, '[P1]');
  applyStartOfCombatPassives(p2, p1, introLogs, '[P2]');
  allLogs.push(...introLogs);
  const p1Modifiers = {};
  const p2Modifiers = {};
  if (p1DefBefore != null && p1.base?.def !== p1DefBefore) {
    p1Modifiers.def = [{ label: 'Brèche mentale', value: p1.base.def - p1DefBefore }];
  }
  if (p2DefBefore != null && p2.base?.def !== p2DefBefore) {
    p2Modifiers.def = [{ label: 'Brèche mentale', value: p2.base.def - p2DefBefore }];
  }
  const snapshotBase = (b) => (b?.base ? { hp: b.base.hp, auto: b.base.auto, def: b.base.def, cap: b.base.cap, rescap: b.base.rescap, spd: b.base.spd } : undefined);
  const snapshotStatus = (b) => {
    if (!b) return undefined;
    const status = {
      stunned: !!b.stunned,
      stunnedTurns: b.stunnedTurns ?? 0,
      bleed_stacks: b.bleed_stacks ?? 0,
      bleedPercentPerStack: b.bleedPercentPerStack ?? 0,
      spectralMarked: !!b.spectralMarked,
      spectralMarkBonus: b.spectralMarkBonus ?? 0,
      dodge: !!b.dodge,
      reflect: typeof b.reflect === 'number' ? b.reflect : 0,
      sorcierNeantBurn: !!b.sorcierNeantBurn,
      undead: !!b.undead,
      boneGuardActive: !!b.boneGuardActive,
      sireneStacks: b.sireneStacks ?? 0,
      succubeWeakenNextAttack: !!b.succubeWeakenNextAttack,
      familiarStacks: b.familiarStacks ?? 0,
      nextSpellReduction: typeof b.nextSpellReduction === 'number' ? b.nextSpellReduction : 0,
      onctionLastStandUsed: !!b.onctionLastStandUsed,
      gungnirDebuffed: !!b.base?._gungnirDebuffed,
      awakening: (b.awakening && (b.awakening.damageStackBonus != null || b.awakening.damageTakenStacks != null))
        ? { damageTakenStacks: b.awakening.damageTakenStacks ?? 0, damageStackBonus: b.awakening.damageStackBonus ?? 0 }
        : null,
      pacteSombreCapStolen: b.pacteSombreCapStolen ?? 0,
      pacteSombreCapLost: b.pacteSombreCapLost ?? 0,
      suddenDeath: !!b.suddenDeath,
    };
    if (b.class === 'Demoniste' && b.base) {
      const { capBase, capPerCap, stackPerAuto } = classConstants.demoniste;
      const cap = b.base.cap;
      const stacks = b.familiarStacks ?? 0;
      const familierPct = capBase + capPerCap * cap + stackPerAuto * stacks;
      status.familiarPercent = familierPct * 100;
      status.familiarDamage = Math.round(familierPct * cap);
    }
    return status;
  };
  const stepExtras = () => ({ p1Modifiers, p2Modifiers, p1Status: snapshotStatus(p1), p2Status: snapshotStatus(p2) });

  // Step intro : état après passifs de début (bouclier liche, Brèche mentale, etc.) pour affichage immédiat
  steps.push({
    phase: 'intro',
    logs: introLogs.slice(),
    p1HP: p1.currentHP,
    p2HP: p2.currentHP,
    p1Shield: p1.shield,
    p2Shield: p2.shield,
    p1Base: snapshotBase(p1),
    p2Base: snapshotBase(p2),
    ...stepExtras()
  });

  let turn = 1;
  while (p1.currentHP > 0 && p2.currentHP > 0 && turn <= maxTurns) {
    // Turn start
    const turnStartLogs = [`--- Début du tour ${turn} ---`];

    if (turn === generalConstants.suddenDeathTurn && !p1.suddenDeath) {
      p1.suddenDeath = true;
      p2.suddenDeath = true;
      turnStartLogs.push(`💀 MORT SUBITE ! Les dégâts augmentent de ${generalConstants.suddenDeathDamageBonus * 100}% et les soins sont réduits de ${generalConstants.suddenDeathHealReduction * 100}%.`);
    }

    const p1Unicorn = getUnicornPactTurnDataFromList(getPassiveDetailsList(p1), turn);
    const p2Unicorn = getUnicornPactTurnDataFromList(getPassiveDetailsList(p2), turn);
    if (p1Unicorn) turnStartLogs.push(`🦄 Pacte de la Licorne — ${p1.name}: ${p1Unicorn.label}`);
    if (p2Unicorn) turnStartLogs.push(`🦄 Pacte de la Licorne — ${p2.name}: ${p2Unicorn.label}`);
    if (p1.ability?.type === 'unicorn_cycle' || p2.ability?.type === 'unicorn_cycle') {
      turnStartLogs.push(`🦄 Alternance mystique: dégâts infligés et reçus ${turn % 2 === 1 ? '+15%' : '-15%'} ce tour.`);
    }
    if (p1.sorcierNeantBurn && p1.currentHP > 0) {
      const burn = Math.max(1, Math.round(p1.currentHP * 0.02));
      p1.currentHP -= burn;
      turnStartLogs.push(`🌑 Brûlure du Néant: ${p1.name} perd ${burn} PV (2%).`);
    }
    if (p2.sorcierNeantBurn && p2.currentHP > 0) {
      const burn = Math.max(1, Math.round(p2.currentHP * 0.02));
      p2.currentHP -= burn;
      turnStartLogs.push(`🌑 Brûlure du Néant: ${p2.name} perd ${burn} PV (2%).`);
    }

    allLogs.push(...turnStartLogs);
    steps.push({ phase: 'turn_start', turn, logs: turnStartLogs.slice(), p1HP: p1.currentHP, p2HP: p2.currentHP, p1Shield: p1.shield, p2Shield: p2.shield, p1Base: snapshotBase(p1), p2Base: snapshotBase(p2), ...stepExtras() });

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
    } else if (p1.class === 'Bastion' && p1.cd.bast === 0 && p1.subclass?.id === 'mur_implacable') {
      first = p1;
    } else if (p2.class === 'Bastion' && p2.cd.bast === 0 && p2.subclass?.id === 'mur_implacable') {
      first = p2;
    } else {
      first = p1.base.spd >= p2.base.spd ? p1 : p2;
    }
    let second = first === p1 ? p2 : p1;
    let firstIsP1 = first === p1;

    // Gojo (Extension du Territoire) : tour 2 et 6 il attaque en premier, tour 4 en second
    const gojoFighter = p1.bossId === 'gojo' ? p1 : (p2.bossId === 'gojo' ? p2 : null);
    if (gojoFighter && (turn === 2 || turn === 4 || turn === 6)) {
      const spell = gojoFighter.ability?.spells?.[turn];
      if (spell) {
        if (spell.attackFirst) {
          first = gojoFighter;
          second = gojoFighter === p1 ? p2 : p1;
          firstIsP1 = first === p1;
        } else {
          first = gojoFighter === p1 ? p2 : p1;
          second = gojoFighter;
          firstIsP1 = first === p1;
        }
      }
    }

    // First player action
    const firstActionLogs = [];
    processPlayerAction(first, second, firstActionLogs, firstIsP1, turn);
    allLogs.push(...firstActionLogs);
    p1.currentHP = Math.min(p1.maxHP, p1.currentHP);
    p2.currentHP = Math.min(p2.maxHP, p2.currentHP);
    steps.push({ phase: 'action', player: firstIsP1 ? 1 : 2, logs: firstActionLogs.slice(), p1HP: p1.currentHP, p2HP: p2.currentHP, p1Shield: p1.shield, p2Shield: p2.shield, p1Base: snapshotBase(p1), p2Base: snapshotBase(p2), ...stepExtras() });

    // Second player action
    if (p1.currentHP > 0 && p2.currentHP > 0) {
      const secondActionLogs = [];
      processPlayerAction(second, first, secondActionLogs, !firstIsP1, turn);
      allLogs.push(...secondActionLogs);
      p1.currentHP = Math.min(p1.maxHP, p1.currentHP);
      p2.currentHP = Math.min(p2.maxHP, p2.currentHP);
      steps.push({ phase: 'action', player: !firstIsP1 ? 1 : 2, logs: secondActionLogs.slice(), p1HP: p1.currentHP, p2HP: p2.currentHP, p1Shield: p1.shield, p2Shield: p2.shield, p1Base: snapshotBase(p1), p2Base: snapshotBase(p2), ...stepExtras() });
    }

    turn++;
  }

  const turnLimitReached = p1.currentHP > 0 && p2.currentHP > 0;
  const winnerIsP1 = turnLimitReached ? true : p1.currentHP > 0;
  const winner = winnerIsP1 ? p1 : p2;
  const loser = winnerIsP1 ? p2 : p1;
  const victoryLog = turnLimitReached
    ? `⏱️ Limite de ${maxTurns} tours atteinte ! Combat terminé.`
    : `🏆 ${winner.name} remporte glorieusement le combat contre ${loser.name} !`;
  allLogs.push(victoryLog);
  steps.push({ phase: 'victory', logs: [victoryLog], p1HP: p1.currentHP, p2HP: p2.currentHP, p1Shield: p1.shield, p2Shield: p2.shield, p1Base: snapshotBase(p1), p2Base: snapshotBase(p2), ...stepExtras() });

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
