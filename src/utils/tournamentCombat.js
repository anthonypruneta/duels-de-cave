/**
 * Simulation de combat PvP pour le tournoi
 * Réplique fidèle du moteur de Combat.jsx en version synchrone
 * Retourne des "steps" avec snapshots HP pour l'animation client
 */

import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives.js';
import { applyStatBoosts } from './statPoints.js';
import {
  applyGungnirDebuff, applyMjollnirStun, applyPassiveWeaponStats,
  initWeaponCombatState, modifyCritDamage, onAttack, onHeal, onSpellCast, onTurnStart
} from './weaponEffects.js';
import {
  cooldowns, classConstants, raceConstants, generalConstants, weaponConstants,
  dmgPhys, dmgCap, calcCritChance, getCritMultiplier
} from '../data/combatMechanics.js';
import { applyAwakeningToBase, buildAwakeningState, getAwakeningEffect } from './awakening.js';

// ============================================================================
// HELPERS
// ============================================================================

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

function applyStartOfCombatPassives(attacker, defender, log, label) {
  const passiveDetails = getPassiveDetails(attacker.mageTowerPassive);
  if (!passiveDetails) return;
  if (passiveDetails.id === 'arcane_barrier') {
    const shieldValue = Math.max(1, Math.round(attacker.maxHP * passiveDetails.levelData.shieldPercent));
    attacker.shield = shieldValue;
    log.push(`${label} 🛡️ Barrière arcanique: ${attacker.name} gagne un bouclier de ${shieldValue} PV.`);
  }
  if (passiveDetails.id === 'mind_breach') {
    const reduction = passiveDetails.levelData.defReduction;
    defender.base.def = Math.max(0, Math.round(defender.base.def * (1 - reduction)));
    log.push(`${label} 🧠 Brèche mentale: ${defender.name} perd ${Math.round(reduction * 100)}% de DEF.`);
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
  const awakeningEffect = getAwakeningEffect(char.race, char.level ?? 1);
  const baseWithAwakening = applyAwakeningToBase(baseWithWeapon, awakeningEffect);
  const weaponState = initWeaponCombatState(char, weaponId);
  return {
    ...char,
    base: baseWithAwakening,
    currentHP: baseWithAwakening.hp,
    maxHP: baseWithAwakening.hp,
    cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 },
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
    stunned: false,
    stunnedTurns: 0,
    weaponState,
    awakening: buildAwakeningState(awakeningEffect)
  };
}

// ============================================================================
// LOGIQUE DE COMBAT
// ============================================================================

function reviveUndead(target, attacker, log, playerColor) {
  const revivePercent = target.awakening?.revivePercent ?? raceConstants.mortVivant.revivePercent;
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

function applyDamage(att, def, raw, isCrit, log, playerColor, atkPassive, defPassive, atkUnicorn, defUnicorn, auraBoost) {
  let adjusted = raw;
  if (atkUnicorn) adjusted = Math.round(adjusted * (1 + atkUnicorn.outgoing));
  if (auraBoost) adjusted = Math.round(adjusted * (1 + auraBoost));
  if (def.spectralMarked && def.spectralMarkBonus) adjusted = Math.round(adjusted * (1 + def.spectralMarkBonus));
  if (defUnicorn) adjusted = Math.round(adjusted * (1 + defUnicorn.incoming));
  if (defPassive?.id === 'obsidian_skin' && isCrit) adjusted = Math.round(adjusted * (1 - defPassive.levelData.critReduction));
  adjusted = applyOutgoingAwakeningBonus(att, adjusted);
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
  if (def.reflect && adjusted > 0) {
    const back = Math.round(def.reflect * adjusted);
    att.currentHP -= back;
    log.push(`${playerColor} 🔁 ${def.name} riposte et renvoie ${back} points de dégâts à ${att.name}`);
  }
  if (adjusted > 0) {
    def.currentHP -= adjusted;
    def.maso_taken = (def.maso_taken || 0) + adjusted;
    if (def.awakening?.damageStackBonus) def.awakening.damageTakenStacks += 1;
  }
  if (atkPassive?.id === 'spectral_mark' && adjusted > 0 && !def.spectralMarked) {
    def.spectralMarked = true;
    def.spectralMarkBonus = atkPassive.levelData.damageTakenBonus;
    log.push(`${playerColor} 🟣 ${def.name} est marqué et subira +${Math.round(def.spectralMarkBonus * 100)}% dégâts.`);
  }
  if (atkPassive?.id === 'essence_drain' && adjusted > 0) {
    const heal = Math.max(1, Math.round(att.maxHP * atkPassive.levelData.healPercent));
    att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
    log.push(`${playerColor} 🩸 ${att.name} siphonne ${heal} points de vie grâce au Vol d'essence`);
  }
  return adjusted;
}

function processPlayerAction(att, def, log, isP1, turn) {
  if (att.currentHP <= 0 || def.currentHP <= 0) return;

  const playerColor = isP1 ? '[P1]' : '[P2]';
  const attackerPassive = getPassiveDetails(att.mageTowerPassive);
  const defenderPassive = getPassiveDetails(def.mageTowerPassive);
  const attackerUnicorn = getUnicornPactTurnData(attackerPassive, turn);
  const defenderUnicorn = getUnicornPactTurnData(defenderPassive, turn);
  const auraBonus = getAuraBonus(attackerPassive, turn);
  let skillUsed = false;

  if (att.stunnedTurns > 0) {
    att.stunnedTurns -= 1;
    if (att.stunnedTurns <= 0) att.stunned = false;
    log.push(`${playerColor} 😵 ${att.name} est étourdi et ne peut pas agir ce tour`);
    return;
  }

  att.reflect = false;
  for (const k of Object.keys(cooldowns)) {
    att.cd[k] = (att.cd[k] % cooldowns[k]) + 1;
  }

  const turnEffects = onTurnStart(att.weaponState, att, turn);
  if (turnEffects.log.length > 0) log.push(...turnEffects.log.map(e => `${playerColor} ${e}`));
  if (turnEffects.regen > 0) att.currentHP = Math.min(att.maxHP, att.currentHP + turnEffects.regen);

  if (att.race === 'Sylvari') {
    const regenPercent = att.awakening?.regenPercent ?? raceConstants.sylvari.regenPercent;
    const heal = Math.max(1, Math.round(att.maxHP * regenPercent));
    att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
    log.push(`${playerColor} 🌿 ${att.name} régénère naturellement et récupère ${heal} points de vie`);
  }

  if (att.class === 'Demoniste') {
    const { capBase, capPerCap, ignoreResist, stackPerAuto } = classConstants.demoniste;
    const stackBonus = stackPerAuto * (att.familiarStacks || 0);
    const hit = Math.max(1, Math.round((capBase + capPerCap * att.base.cap + stackBonus) * att.base.cap));
    const raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
    const inflicted = applyDamage(att, def, raw, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
    log.push(`${playerColor} 💠 Le familier de ${att.name} attaque ${def.name} et inflige ${inflicted} points de dégâts`);
    if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) reviveUndead(def, att, log, playerColor);
  }

  if (att.class === 'Masochiste') {
    if (att.cd.maso === cooldowns.maso && att.maso_taken > 0) {
      skillUsed = true;
      const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
      const dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerCap * att.base.cap)));
      const healAmount = Math.max(1, Math.round(att.maso_taken * healPercent));
      att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
      att.maso_taken = 0;
      const inflicted = applyDamage(att, def, dmg, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
      log.push(`${playerColor} 🩸 ${att.name} renvoie les dégâts accumulés: inflige ${inflicted} points de dégâts et récupère ${healAmount} points de vie`);
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) reviveUndead(def, att, log, playerColor);
    }
  }

  if (att.bleed_stacks > 0) {
    let bleedDmg = att.bleedPercentPerStack
      ? Math.max(1, Math.round(att.maxHP * att.bleedPercentPerStack * att.bleed_stacks))
      : Math.ceil(att.bleed_stacks / raceConstants.lycan.bleedDivisor);
    if (att.awakening?.damageTakenMultiplier) bleedDmg = Math.max(1, Math.round(bleedDmg * att.awakening.damageTakenMultiplier));
    att.currentHP -= bleedDmg;
    log.push(`${playerColor} 🩸 ${att.name} saigne abondamment et perd ${bleedDmg} points de vie`);
    if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) reviveUndead(att, def, log, playerColor);
  }

  if (att.class === 'Paladin' && att.cd.pal === cooldowns.pal) {
    skillUsed = true;
    const { reflectBase, reflectPerCap } = classConstants.paladin;
    att.reflect = reflectBase + reflectPerCap * att.base.cap;
    log.push(`${playerColor} 🛡️ ${att.name} se prépare à riposter et renverra ${Math.round(att.reflect * 100)}% des dégâts`);
  }

  if (att.class === 'Healer' && att.cd.heal === cooldowns.heal) {
    skillUsed = true;
    const miss = att.maxHP - att.currentHP;
    const { missingHpPercent, capScale } = classConstants.healer;
    const heal = Math.max(1, Math.round(missingHpPercent * miss + capScale * att.base.cap));
    att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
    log.push(`${playerColor} ✚ ${att.name} lance un sort de soin puissant et récupère ${heal} points de vie`);
    const healEffects = onHeal(att.weaponState, att, heal, def);
    if (healEffects.bonusDamage > 0) {
      const bonusDmg = dmgCap(healEffects.bonusDamage, def.base.rescap);
      applyDamage(att, def, bonusDmg, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
      log.push(`${playerColor} ${healEffects.log.join(' ')}`);
    }
  }

  if (att.class === 'Voleur' && att.cd.rog === cooldowns.rog) {
    skillUsed = true;
    att.dodge = true;
    log.push(`${playerColor} 🌀 ${att.name} entre dans une posture d'esquive et évitera la prochaine attaque`);
  }

  const isMage = att.class === 'Mage' && att.cd.mag === cooldowns.mag;
  const isWar = att.class === 'Guerrier' && att.cd.war === cooldowns.war;
  const isArcher = att.class === 'Archer' && att.cd.arc === cooldowns.arc;
  skillUsed = skillUsed || isMage || isWar || isArcher;

  let mult = 1.0;
  if (att.race === 'Orc' && att.currentHP < raceConstants.orc.lowHpThreshold * att.maxHP) mult = raceConstants.orc.damageBonus;
  if (turnEffects.damageMultiplier !== 1) mult *= turnEffects.damageMultiplier;

  const baseHits = isArcher ? classConstants.archer.hitCount : 1;
  const totalHits = baseHits + (turnEffects.bonusAttacks || 0);
  let total = 0;
  let wasCrit = false;

  const forceCrit = attackerPassive?.id === 'obsidian_skin' && att.currentHP <= att.maxHP * attackerPassive.levelData.critThreshold;

  for (let i = 0; i < totalHits; i++) {
    const isBonusAttack = i >= baseHits;
    const isCrit = turnEffects.guaranteedCrit ? true : forceCrit ? true : Math.random() < calcCritChance(att);
    if (isCrit) wasCrit = true;
    let raw = 0;
    const attackMultiplier = mult * (isBonusAttack ? (turnEffects.bonusAttackDamage || 1) : 1);

    if (isMage) {
      const { capBase, capPerCap } = classConstants.mage;
      const atkSpell = Math.round(att.base.auto * attackMultiplier + (capBase + capPerCap * att.base.cap) * att.base.cap * attackMultiplier);
      raw = dmgCap(atkSpell, def.base.rescap);
      if (i === 0) log.push(`${playerColor} 🔮 ${att.name} invoque un puissant sort magique`);
      const spellEffects = onSpellCast(att.weaponState, att, def, raw, 'mage');
      if (spellEffects.doubleCast) {
        applyDamage(att, def, spellEffects.secondCastDamage, false, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
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
        const bleedStacks = att.awakening?.bleedStacksPerHit ?? raceConstants.lycan.bleedPerHit;
        def.bleed_stacks = (def.bleed_stacks || 0) + bleedStacks;
        if (att.awakening?.bleedPercentPerStack) def.bleedPercentPerStack = att.awakening.bleedPercentPerStack;
      }
    }

    if (isCrit) {
      const critDamage = Math.round(raw * getCritMultiplier(att));
      raw = modifyCritDamage(att.weaponState, critDamage);
    }

    const inflicted = applyDamage(att, def, raw, isCrit, log, playerColor, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
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

export function simulerMatch(char1, char2) {
  const p1 = preparerCombattant(char1);
  const p2 = preparerCombattant(char2);

  const allLogs = [];
  const steps = [];

  // Phase intro
  const introLogs = [`⚔️ Le combat épique commence entre ${p1.name} et ${p2.name} !`];
  applyStartOfCombatPassives(p1, p2, introLogs, '[P1]');
  applyStartOfCombatPassives(p2, p1, introLogs, '[P2]');
  allLogs.push(...introLogs);
  steps.push({ phase: 'intro', logs: introLogs.slice(), p1HP: p1.currentHP, p2HP: p2.currentHP });

  let turn = 1;
  while (p1.currentHP > 0 && p2.currentHP > 0 && turn <= generalConstants.maxTurns) {
    // Turn start
    const turnStartLogs = [`--- Début du tour ${turn} ---`];
    const p1Unicorn = getUnicornPactTurnData(getPassiveDetails(p1.mageTowerPassive), turn);
    const p2Unicorn = getUnicornPactTurnData(getPassiveDetails(p2.mageTowerPassive), turn);
    if (p1Unicorn) turnStartLogs.push(`🦄 Pacte de la Licorne — ${p1.name}: ${p1Unicorn.label}`);
    if (p2Unicorn) turnStartLogs.push(`🦄 Pacte de la Licorne — ${p2.name}: ${p2Unicorn.label}`);

    allLogs.push(...turnStartLogs);
    steps.push({ phase: 'turn_start', turn, logs: turnStartLogs.slice(), p1HP: p1.currentHP, p2HP: p2.currentHP });

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
    steps.push({ phase: 'action', player: firstIsP1 ? 1 : 2, logs: firstActionLogs.slice(), p1HP: p1.currentHP, p2HP: p2.currentHP });

    // Second player action
    if (p1.currentHP > 0 && p2.currentHP > 0) {
      const secondActionLogs = [];
      processPlayerAction(second, first, secondActionLogs, !firstIsP1, turn);
      allLogs.push(...secondActionLogs);
      steps.push({ phase: 'action', player: !firstIsP1 ? 1 : 2, logs: secondActionLogs.slice(), p1HP: p1.currentHP, p2HP: p2.currentHP });
    }

    turn++;
  }

  const winnerIsP1 = p1.currentHP > 0;
  const winner = winnerIsP1 ? p1 : p2;
  const loser = winnerIsP1 ? p2 : p1;
  const victoryLog = `🏆 ${winner.name} remporte glorieusement le combat contre ${loser.name} !`;
  allLogs.push(victoryLog);
  steps.push({ phase: 'victory', logs: [victoryLog], p1HP: p1.currentHP, p2HP: p2.currentHP });

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
