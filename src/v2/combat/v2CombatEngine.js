/**
 * Moteur de combat V2 — rotation de sorts, pas de CD classiques.
 *
 * Règle dégâts : power (scaling Auto/Cap/…) − 0,5 × résistance.
 * - phys → DEF
 * - mag  → ResC
 * Le scaling ne détermine pas le type.
 */

import { V2_CLASS_CONSTANTS } from '../data/v2Classes';
import {
  V2_SPELL_IDS,
  computeFinalStats,
  flattenSpellCycles,
  getSpellById,
  normalizeSpellCycles,
} from '../data/v2Kit';
import {
  V2_RACE_PASSIVES,
  consumeCendresBraisesIfNeeded,
  createEmptyRaceState,
  getGnomeDodgeChance,
  getRaceCritChance,
  getRaceCritDamageMult,
  getRaceSpellPowerMult,
  isOrcFureurActive,
} from '../data/v2Races';
import {
  createEmptyStatus,
  hasAntiHeal,
  hasFamiliar,
  hasStigmate,
  tickStatuses,
} from './v2Status';

const MAX_TURNS = 40;
const CURSE_STAT_KEYS = ['auto', 'def', 'cap', 'rescap', 'spd'];

/** Résistance selon le type de dégâts. */
function resistOf(defender, damageType) {
  return damageType === 'mag' ? defender.base.rescap : defender.base.def;
}

/**
 * Convertit une puissance de sort en dégâts bruts (avant multi buffs).
 * @param {'phys'|'mag'} damageType
 * @param {number} [ignoreResist=0] fraction de résistance ignorée (0–1)
 */
function rawFromPower(defender, power, damageType, ignoreResist = 0) {
  const resist = resistOf(defender, damageType) * (1 - Math.min(0.95, Math.max(0, ignoreResist)));
  return Math.max(1, Math.round(power - 0.5 * resist));
}

function outgoingMultiplier(attacker) {
  let m = 1;
  if (isOrcFureurActive(attacker)) {
    m *= V2_RACE_PASSIVES.Orc.damageBonus;
  }
  return m;
}

function incomingMultiplier(defender) {
  let m = 1;
  if (hasStigmate(defender.status)) {
    m *= 1.15;
  }
  return m;
}

function tryRevive(target, log) {
  if (target?.race !== 'Mort-vivant' || !target.raceState) return false;
  if (target.raceState.revived || target.currentHP > 0) return false;
  const pct = V2_RACE_PASSIVES['Mort-vivant'].revivePercent;
  target.raceState.revived = true;
  target.currentHP = Math.max(1, Math.round(target.maxHP * pct));
  log.push(`☠️ ${target.name} revient à ${target.currentHP} PV (Non-mort) !`);
  return true;
}

function registerHpDamageTaken(target, hpLoss, log) {
  if (hpLoss <= 0 || !target?.raceState) return;
  if (target.race === 'Cendrés') {
    const p = V2_RACE_PASSIVES.Cendrés;
    const before = Math.floor(target.raceState.cendresDamage / (target.maxHP * p.hpDamageThreshold));
    target.raceState.cendresDamage += hpLoss;
    const after = Math.floor(target.raceState.cendresDamage / (target.maxHP * p.hpDamageThreshold));
    const gained = after - before;
    if (gained > 0) {
      target.raceState.cendresBank += gained;
      log.push(`🔥 ${target.name} gagne ${gained} braise(s) (banque ${target.raceState.cendresBank}).`);
    }
  }
}

/**
 * Dégâts directs (riposte déjà mitigée) — sans retrigger esquive / aegis / riposte.
 */
function applyDirectHpLoss(target, amount, log, label) {
  const dmg = Math.max(0, Math.round(amount));
  if (dmg <= 0) return 0;
  let dealt = dmg;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed;
    dealt = dmg - absorbed;
    if (absorbed > 0) log.push(`🛡️ Bouclier absorbe ${absorbed} (${label}).`);
    if (dealt <= 0) return absorbed;
  }
  target.currentHP = Math.max(0, target.currentHP - dealt);
  target.damageTakenSincePurge = (target.damageTakenSincePurge || 0) + dealt;
  registerHpDamageTaken(target, dealt, log);
  if (target.currentHP <= 0) tryRevive(target, log);
  return dmg;
}

/**
 * Pipeline de dégâts : `raw` = déjà calculé (power − 0,5 × resist).
 * @param {{ isCapacity?: boolean, damageType?: 'phys'|'mag' }} [opts]
 * @returns {number} dégâts PV réellement infligés (après bouclier)
 */
function applyDamage(attacker, defender, raw, log, label, opts = {}) {
  if ((defender.status.esquive || 0) > 0) {
    defender.status.esquive = 0;
    log.push(`🌀 ${defender.name} esquive totalement (${label}) !`);
    return 0;
  }

  const gnomeDodge = getGnomeDodgeChance(defender, attacker);
  if (gnomeDodge > 0 && Math.random() < gnomeDodge) {
    log.push(`🧬 ${defender.name} esquive (Gnome, ${Math.round(gnomeDodge * 100)} %) !`);
    return 0;
  }

  let dmg = Math.max(1, Math.round(raw * outgoingMultiplier(attacker) * incomingMultiplier(defender)));

  const critChance = getRaceCritChance(attacker, defender);
  if (critChance > 0 && Math.random() < critChance) {
    const critMult = getRaceCritDamageMult(attacker, defender);
    dmg = Math.max(1, Math.round(dmg * critMult));
    log.push(`💥 Critique ×${critMult.toFixed(2)} !`);
  }

  if (attacker.status.nextAttackPenalty > 0) {
    dmg = Math.max(1, Math.round(dmg * (1 - attacker.status.nextAttackPenalty)));
    attacker.status.nextAttackPenalty = 0;
    log.push(`💋 Attaque affaiblie…`);
  }

  // Turtlekin : premier gros coup plafonné
  if (
    defender.race === 'Turtlekin' &&
    defender.raceState &&
    !defender.raceState.turtlekinUsed
  ) {
    const cap = Math.round(defender.maxHP * V2_RACE_PASSIVES.Turtlekin.firstHitCapPercent);
    if (dmg > cap) {
      defender.raceState.turtlekinUsed = true;
      log.push(`🐢 Carapace : coup plafonné à ${cap} PV.`);
      dmg = cap;
    }
  }

  if (defender.shield > 0) {
    const absorbed = Math.min(defender.shield, dmg);
    defender.shield -= absorbed;
    dmg -= absorbed;
    if (absorbed > 0) {
      log.push(`🛡️ Bouclier de ${defender.name} absorbe ${absorbed}.`);
    }
  }

  if (dmg <= 0) {
    log.push(`${attacker.name} — ${label} : bloqué par le bouclier.`);
    return 0;
  }

  defender.currentHP = Math.max(0, defender.currentHP - dmg);
  defender.damageTakenSincePurge = (defender.damageTakenSincePurge || 0) + dmg;
  registerHpDamageTaken(defender, dmg, log);
  log.push(
    `${attacker.name} — ${label} : ${dmg} dégâts → ${defender.name} (${defender.currentHP}/${defender.maxHP} PV)`
  );

  if (defender.currentHP <= 0) tryRevive(defender, log);

  // Lycan : saignement
  if (attacker.race === 'Lycan' && dmg > 0) {
    const add = V2_RACE_PASSIVES.Lycan.bleedPerHit || 1;
    defender.status.bleedStacks = (defender.status.bleedStacks || 0) + add;
    log.push(`🐺 Saignement ×${defender.status.bleedStacks} sur ${defender.name}.`);
  }

  // Sirène : stack sur capacité reçue
  if (
    opts.isCapacity &&
    defender.race === 'Sirène' &&
    defender.raceState &&
    dmg > 0
  ) {
    const p = V2_RACE_PASSIVES.Sirène;
    if (defender.raceState.sireneStacks < p.maxStacks) {
      defender.raceState.sireneStacks += 1;
      log.push(
        `🧜 ${defender.name} : chant ×${defender.raceState.sireneStacks} (+${Math.round(p.stackBonus * 100)} % / stack).`
      );
    }
  }

  // Mindflayer : copie la 1ʳᵉ capacité reçue
  if (
    opts.isCapacity &&
    defender.race === 'Mindflayer' &&
    defender.raceState &&
    !defender.raceState.mindflayerDone &&
    !defender.raceState.mindflayerPending &&
    dmg > 0
  ) {
    const dtype = opts.damageType || 'phys';
    defender.raceState.mindflayerPending = { raw: dmg, damageType: dtype };
    log.push(`🦑 ${defender.name} mémorise l’attaque (${label}).`);
  }

  if (defender.status.aegisArmed) {
    defender.status.aegisArmed = false;
    const C = V2_CLASS_CONSTANTS.briseurSort;
    const shieldGain = Math.max(0, Math.round(dmg * C.shieldFromDamage));
    defender.shield += shieldGain;
    attacker.status.antiHeal = C.antiHealTurns;
    log.push(
      `🧱 Égide fractale : +${shieldGain} bouclier pour ${defender.name}, anti-soin sur ${attacker.name} (${C.antiHealTurns} tours).`
    );
  }

  if (defender.status.riposteArmed) {
    defender.status.riposteArmed = false;
    const C = V2_CLASS_CONSTANTS.paladin;
    const pct = C.reflectBase + C.reflectPerCap * defender.base.cap;
    const power = dmg * pct;
    const reflected = rawFromPower(attacker, power, 'mag');
    const dealt = applyDirectHpLoss(attacker, reflected, log, 'Riposte');
    log.push(`🛡️ Riposte (mag) : ${dealt} dégâts renvoyés à ${attacker.name}.`);
  }

  return dmg;
}

function applyHeal(target, amount, log, healer = null, defenderForMult = null) {
  let heal = Math.max(0, Math.round(amount));
  if (healer && defenderForMult) {
    heal = Math.max(0, Math.round(heal * getRaceSpellPowerMult(healer, defenderForMult)));
    consumeCendresBraisesIfNeeded(healer, log);
  }
  if (heal <= 0) return 0;
  if (hasAntiHeal(target.status)) {
    const reduced = Math.max(
      0,
      Math.round(heal * (1 - V2_CLASS_CONSTANTS.briseurSort.antiHealReduction))
    );
    log.push(`🚫 Anti-soin : soin réduit (${heal} → ${reduced}).`);
    heal = reduced;
  }
  if (heal <= 0) return 0;
  target.currentHP = Math.min(target.maxHP, target.currentHP + heal);
  log.push(`💚 ${target.name} se soigne de ${heal} PV (${target.currentHP}/${target.maxHP}).`);
  return heal;
}

function gainShield(target, amount, log, label) {
  const add = Math.max(0, Math.round(amount));
  if (add <= 0) return 0;
  target.shield = (target.shield || 0) + add;
  log.push(`🛡️ ${target.name} gagne ${add} bouclier (${label}) — total ${target.shield}.`);
  return add;
}

/** Familier : magique, power = 30 % Cap. */
function applyFamiliarBonus(attacker, defender, log, fx) {
  if (!hasFamiliar(attacker.status)) return;
  const C = V2_CLASS_CONSTANTS.demoniste;
  const power = attacker.base.cap * C.familiarCapScale;
  const raw = rawFromPower(defender, power, 'mag');
  const d = applyDamage(attacker, defender, raw, log, 'Familier (mag)');
  if (attacker.isPlayer) fx.damageToEnemy += d;
  else fx.damageToPlayer += d;
  attacker.status.familiar = Math.max(0, (attacker.status.familiar || 0) - 1);
}

/**
 * @returns {{ damageToEnemy: number, damageToPlayer: number, healToPlayer: number }}
 */
function castSpell(attacker, defender, spellId, log) {
  const spell = getSpellById(spellId);
  const spellName = spell?.name || spellId;
  const dtype = spell?.damageType || null;
  log.push(`✨ ${attacker.name} lance ${spellName}${dtype ? ` [${dtype}]` : ''} !`);

  const fx = { damageToEnemy: 0, damageToPlayer: 0, healToPlayer: 0 };

  const hit = (power, damageType, label, ignoreResist = 0) => {
    const scaled = power * getRaceSpellPowerMult(attacker, defender);
    consumeCendresBraisesIfNeeded(attacker, log);
    const raw = rawFromPower(defender, scaled, damageType, ignoreResist);
    const d = applyDamage(attacker, defender, raw, log, label, {
      isCapacity: true,
      damageType,
    });
    if (attacker.isPlayer) fx.damageToEnemy += d;
    else fx.damageToPlayer += d;
    return d;
  };

  const healSelf = (amount) => {
    const h = applyHeal(attacker, amount, log, attacker, defender);
    if (attacker.isPlayer) fx.healToPlayer += h;
    return h;
  };

  switch (spellId) {
    case V2_SPELL_IDS.STIGMATE: {
      defender.status.stigmate = 4;
      log.push(`💠 ${defender.name} est marqué par Stigmate (4 tours, +15 % dégâts reçus).`);
      break;
    }
    case V2_SPELL_IDS.PLUIE_CELESTE: {
      hit(attacker.base.auto, 'phys', 'Pluie Céleste (1)');
      if (defender.currentHP > 0) {
        hit(attacker.base.auto * 0.7, 'phys', 'Pluie Céleste (2)');
      }
      break;
    }
    case V2_SPELL_IDS.COUPE_NETTE: {
      hit(attacker.base.auto, 'phys', 'Coupe nette');
      break;
    }
    case V2_SPELL_IDS.ECLAT_ARDENT: {
      hit(attacker.base.cap * 1.2, 'mag', 'Éclat ardent');
      break;
    }
    case V2_SPELL_IDS.LANCE_FRACTURE: {
      hit(attacker.base.auto + attacker.base.cap * 0.2, 'phys', 'Lance fracturée');
      break;
    }
    case V2_SPELL_IDS.ORBE_GLACE: {
      hit(attacker.base.auto + attacker.base.cap * 0.6, 'mag', 'Orbe de glace');
      break;
    }
    case V2_SPELL_IDS.LAME_DU_ROI: {
      hit(attacker.base.auto + attacker.base.def * 0.4, 'phys', 'Lame du Roi');
      break;
    }
    case V2_SPELL_IDS.COUP_DE_PIED: {
      hit(attacker.base.auto, 'phys', 'Coup de pied');
      break;
    }
    case V2_SPELL_IDS.CROCHET: {
      hit(attacker.base.auto, 'phys', 'Crochet');
      break;
    }
    case V2_SPELL_IDS.COUP_DE_TETE: {
      hit(attacker.base.cap, 'mag', 'Coup de tête');
      break;
    }
    case V2_SPELL_IDS.FRAPPE_PENETRANTE: {
      const C = V2_CLASS_CONSTANTS.guerrier;
      const ignore = Math.min(0.95, C.ignoreBase + C.ignorePerCap * attacker.base.cap);
      hit(
        attacker.base.auto,
        'phys',
        `Frappe pénétrante (ignore ${Math.round(ignore * 100)} % DEF)`,
        ignore
      );
      break;
    }
    case V2_SPELL_IDS.ESQUIVE: {
      attacker.status.esquive = 1;
      log.push(`🌀 ${attacker.name} se prépare à esquiver la prochaine action.`);
      break;
    }
    case V2_SPELL_IDS.RIPOSTE: {
      attacker.status.riposteArmed = true;
      log.push(`🛡️ ${attacker.name} arme une Riposte (magique).`);
      break;
    }
    case V2_SPELL_IDS.SOIN_PUISSANT: {
      const C = V2_CLASS_CONSTANTS.healer;
      const missing = attacker.maxHP - attacker.currentHP;
      healSelf(missing * C.missingHpPercent + attacker.base.cap * C.capScale);
      break;
    }
    case V2_SPELL_IDS.DOUBLE_TIR: {
      const C = V2_CLASS_CONSTANTS.archer;
      hit(attacker.base.auto * C.hit1AutoMultiplier, 'phys', 'Double tir (1)');
      if (defender.currentHP > 0) {
        const power2 =
          attacker.base.auto * C.hit2AutoMultiplier +
          attacker.base.cap * C.hit2CapMultiplier;
        hit(power2, 'phys', 'Double tir (2)');
      }
      break;
    }
    case V2_SPELL_IDS.EXPLOSION_ARCANIQUE: {
      const C = V2_CLASS_CONSTANTS.mage;
      const power = attacker.base.auto * C.autoBase + attacker.base.cap * C.capBase;
      hit(power, 'mag', 'Explosion arcanique');
      break;
    }
    case V2_SPELL_IDS.INVOCATION_FAMILIER: {
      const C = V2_CLASS_CONSTANTS.demoniste;
      attacker.status.familiar = C.familiarTurns;
      log.push(
        `💠 Familier invoqué (${C.familiarTurns} actions) : +${Math.round(C.familiarCapScale * 100)} % Cap mag / action.`
      );
      break;
    }
    case V2_SPELL_IDS.PURGE_SANGLANTE: {
      const C = V2_CLASS_CONSTANTS.masochiste;
      const taken = attacker.damageTakenSincePurge || 0;
      const power = taken * C.returnBase + attacker.base.cap * C.returnPerCap;
      hit(power, 'mag', 'Purge sanglante');
      healSelf(taken * C.healPercent);
      attacker.damageTakenSincePurge = 0;
      log.push(`🩸 Cumul de douleur remis à zéro.`);
      break;
    }
    case V2_SPELL_IDS.EGIDE_FRACTALE: {
      attacker.status.aegisArmed = true;
      log.push(`🧱 ${attacker.name} arme l’Égide fractale.`);
      break;
    }
    case V2_SPELL_IDS.COUP_DE_FOUET: {
      const C = V2_CLASS_CONSTANTS.succube;
      const power = attacker.base.auto + attacker.base.cap * C.capScale;
      hit(power, 'phys', 'Coup de Fouet');
      defender.status.nextAttackPenalty = C.nextAttackReduction;
      log.push(
        `💋 Prochaine attaque de ${defender.name} : −${Math.round(C.nextAttackReduction * 100)} % dégâts.`
      );
      break;
    }
    case V2_SPELL_IDS.CHARGE_REMPART: {
      const C = V2_CLASS_CONSTANTS.bastion;
      gainShield(attacker, attacker.base.def * C.startShieldFromDef, log, 'Rempart');
      const power =
        attacker.base.auto +
        attacker.base.cap * C.capScale +
        attacker.base.def * C.defScale;
      hit(power, 'phys', 'Charge du Rempart');
      break;
    }
    case V2_SPELL_IDS.FLASQUE_FEU: {
      const C = V2_CLASS_CONSTANTS.alchimiste;
      const power = attacker.base.auto + attacker.base.cap * C.fireCapScale;
      hit(power, 'mag', 'Flasque de feu');
      break;
    }
    case V2_SPELL_IDS.FLASQUE_VIE: {
      const C = V2_CLASS_CONSTANTS.alchimiste;
      healSelf(attacker.base.cap * C.lifeCapScale);
      break;
    }
    case V2_SPELL_IDS.FLASQUE_ACIDE: {
      const C = V2_CLASS_CONSTANTS.alchimiste;
      defender.base.def = Math.max(1, Math.round(defender.base.def * (1 - C.acidDefReduction)));
      defender.base.rescap = Math.max(
        1,
        Math.round(defender.base.rescap * (1 - C.acidRescReduction))
      );
      log.push(
        `🧪 Acide : DEF et ResC de ${defender.name} −${Math.round(C.acidDefReduction * 100)} % (${defender.base.def}/${defender.base.rescap}).`
      );
      hit(attacker.base.auto, 'mag', 'Flasque d’acide');
      break;
    }
    case V2_SPELL_IDS.MALEDICTION: {
      const C = V2_CLASS_CONSTANTS.sorciere;
      const key = CURSE_STAT_KEYS[Math.floor(Math.random() * CURSE_STAT_KEYS.length)];
      const removed = Math.max(1, Math.round(defender.base[key] * C.curseStatReduction));
      defender.base[key] = Math.max(1, defender.base[key] - removed);
      log.push(`🕯️ Malédiction : ${key.toUpperCase()} de ${defender.name} −${removed}.`);
      const power = attacker.base.auto + attacker.base.cap * C.capBase + removed;
      hit(power, 'mag', 'Malédiction');
      break;
    }
    case V2_SPELL_IDS.RAGE: {
      const C = V2_CLASS_CONSTANTS.berserk;
      const cost = Math.max(1, Math.round(attacker.maxHP * C.rageHpCostPercent));
      const afterCost = Math.max(1, attacker.currentHP - cost);
      const paid = attacker.currentHP - afterCost;
      attacker.currentHP = afterCost;
      log.push(`🪓 Rage : ${attacker.name} sacrifie ${paid} PV.`);
      const missing = attacker.maxHP - attacker.currentHP;
      const scale =
        C.rageMissingHpDamageScale + C.rageMissingHpScalePerCap * attacker.base.cap;
      const power = attacker.base.auto + missing * scale;
      hit(power, 'phys', 'Rage');
      break;
    }
    default: {
      hit(attacker.base.auto, 'phys', 'Attaque');
    }
  }

  if (spellId !== V2_SPELL_IDS.INVOCATION_FAMILIER) {
    applyFamiliarBonus(attacker, defender, log, fx);
  }

  return fx;
}

function enemyAutoAttack(attacker, defender, log) {
  const fx = { damageToEnemy: 0, damageToPlayer: 0, healToPlayer: 0 };
  const power = attacker.base.auto * getRaceSpellPowerMult(attacker, defender);
  consumeCendresBraisesIfNeeded(attacker, log);
  const raw = rawFromPower(defender, power, 'phys');
  const dmg = applyDamage(attacker, defender, raw, log, 'Attaque', {
    isCapacity: true,
    damageType: 'phys',
  });
  if (attacker.isPlayer) fx.damageToEnemy = dmg;
  else fx.damageToPlayer = dmg;
  return fx;
}

function applyStartOfTurnRace(attacker, defender, log, fx) {
  // Sylvari regen
  if (attacker.race === 'Sylvari') {
    const pct = V2_RACE_PASSIVES.Sylvari.regenPercent;
    const amount = attacker.maxHP * pct;
    const h = applyHeal(attacker, amount, log);
    if (attacker.isPlayer) fx.healToPlayer += h;
  }

  // Lycan bleed DoT on self at start of turn
  const stacks = attacker.status?.bleedStacks || 0;
  if (stacks > 0) {
    const pct = V2_RACE_PASSIVES.Lycan.bleedPercentPerStack;
    const raw = Math.max(1, Math.round(attacker.maxHP * pct * stacks));
    const dealt = applyDirectHpLoss(attacker, raw, log, 'Saignement');
    log.push(`🐺 Saignement (${stacks}) : ${dealt} PV.`);
    if (attacker.isPlayer) fx.damageToPlayer += dealt;
    else fx.damageToEnemy += dealt;
  }

  // Cendrés : pool de braises
  if (attacker.race === 'Cendrés' && attacker.raceState) {
    const p = V2_RACE_PASSIVES.Cendrés;
    const fromBank = attacker.raceState.cendresBank || 0;
    attacker.raceState.cendresPool = p.guaranteedBraisesPerTurn + fromBank;
    attacker.raceState.cendresBank = 0;
    attacker.raceState.cendresSpent = false;
    if (attacker.raceState.cendresPool > 0) {
      log.push(`🔥 Pool de braises : ${attacker.raceState.cendresPool}.`);
    }
  }

  // Mindflayer : relance la copie mémorisée
  if (
    attacker.race === 'Mindflayer' &&
    attacker.raceState?.mindflayerPending &&
    !attacker.raceState.mindflayerDone
  ) {
    const pending = attacker.raceState.mindflayerPending;
    attacker.raceState.mindflayerPending = null;
    attacker.raceState.mindflayerDone = true;
    const bonus =
      attacker.base.cap * V2_RACE_PASSIVES.Mindflayer.stealSpellCapDamageScale;
    const power = pending.raw + bonus;
    const raw = rawFromPower(defender, power, pending.damageType || 'phys');
    const d = applyDamage(attacker, defender, raw, log, 'Vol mental', {
      isCapacity: false,
      damageType: pending.damageType || 'phys',
    });
    if (attacker.isPlayer) fx.damageToEnemy += d;
    else fx.damageToPlayer += d;
  }
}

export function preparerCombattantV2(prototype) {
  const base = computeFinalStats(prototype);
  const maxHP = base.hp;
  const spellOrder = flattenSpellCycles(normalizeSpellCycles(prototype));
  return {
    name: prototype.name || 'Champion',
    isPlayer: true,
    race: prototype.race || null,
    className: prototype.class || null,
    base: { ...base },
    currentHP: maxHP,
    maxHP,
    shield: 0,
    spellOrder: spellOrder.length > 0 ? spellOrder : null,
    spellIndex: 0,
    damageTakenSincePurge: 0,
    status: createEmptyStatus(),
    raceState: createEmptyRaceState(),
    characterImage: prototype.characterImage || null,
  };
}

export function preparerEnnemiV2(enemy) {
  const base = { ...enemy.base };
  const maxHP = base.hp;
  return {
    name: enemy.name || 'Ennemi',
    isPlayer: false,
    race: enemy.race || null,
    base,
    currentHP: maxHP,
    maxHP,
    shield: 0,
    spellOrder: null,
    spellIndex: 0,
    damageTakenSincePurge: 0,
    status: createEmptyStatus(),
    raceState: createEmptyRaceState(),
    icon: enemy.icon || null,
  };
}

function nextPlayerSpellId(player) {
  if (!player.spellOrder?.length) return null;
  return player.spellOrder[player.spellIndex % player.spellOrder.length];
}

function takeTurn(attacker, defender, log) {
  attacker.status = tickStatuses(attacker.status);
  const fx = { damageToEnemy: 0, damageToPlayer: 0, healToPlayer: 0 };

  applyStartOfTurnRace(attacker, defender, log, fx);
  if (attacker.currentHP <= 0 || defender.currentHP <= 0) {
    return { spellId: null, ...fx };
  }

  if (attacker.isPlayer && attacker.spellOrder?.length) {
    const spellId = attacker.spellOrder[attacker.spellIndex % attacker.spellOrder.length];
    attacker.spellIndex += 1;
    const castFx = castSpell(attacker, defender, spellId, log);
    return {
      spellId,
      damageToEnemy: fx.damageToEnemy + castFx.damageToEnemy,
      damageToPlayer: fx.damageToPlayer + castFx.damageToPlayer,
      healToPlayer: fx.healToPlayer + castFx.healToPlayer,
    };
  }
  const autoFx = enemyAutoAttack(attacker, defender, log);
  return {
    spellId: null,
    damageToEnemy: fx.damageToEnemy + autoFx.damageToEnemy,
    damageToPlayer: fx.damageToPlayer + autoFx.damageToPlayer,
    healToPlayer: fx.healToPlayer + autoFx.healToPlayer,
  };
}

export function simulerMatchV2(prototypeDoc, enemyRaw) {
  const player = preparerCombattantV2(prototypeDoc);
  const enemy = preparerEnnemiV2(enemyRaw);
  const log = [];
  const steps = [];

  log.push(`⚔️ ${player.name} vs ${enemy.name} !`);
  steps.push(snapshotStep(0, player, enemy, log[log.length - 1], {}));

  let turn = 0;
  while (turn < MAX_TURNS && player.currentHP > 0 && enemy.currentHP > 0) {
    turn += 1;
    log.push(`—— Tour ${turn} ——`);

    const playerFirst = player.base.spd >= enemy.base.spd;
    const order = playerFirst ? [player, enemy] : [enemy, player];

    for (const actor of order) {
      if (player.currentHP <= 0 || enemy.currentHP <= 0) break;
      const target = actor === player ? enemy : player;
      const fx = takeTurn(actor, target, log);
      steps.push(snapshotStep(turn, player, enemy, log[log.length - 1], fx));
    }
  }

  let winner = 'draw';
  if (player.currentHP <= 0 && enemy.currentHP <= 0) winner = 'draw';
  else if (enemy.currentHP <= 0) winner = 'player';
  else if (player.currentHP <= 0) winner = 'enemy';
  else {
    winner = player.currentHP >= enemy.currentHP ? 'player' : 'enemy';
    log.push(`⏱️ Limite de tours — décision aux PV restants.`);
  }

  if (winner === 'player') log.push(`🏆 Victoire de ${player.name} !`);
  else if (winner === 'enemy') log.push(`💀 Défaite… ${enemy.name} l’emporte.`);
  else log.push(`🤝 Match nul.`);

  return {
    winner,
    log,
    steps,
    playerFinal: { currentHP: player.currentHP, maxHP: player.maxHP },
    enemyFinal: { currentHP: enemy.currentHP, maxHP: enemy.maxHP },
    spellOrder: player.spellOrder ? [...player.spellOrder] : [],
  };
}

function snapshotStep(turn, player, enemy, lastLine, fx = {}) {
  return {
    turn,
    playerHP: player.currentHP,
    playerMaxHP: player.maxHP,
    playerShield: player.shield || 0,
    playerRace: player.race || null,
    orcFureur: isOrcFureurActive(player),
    enemyHP: enemy.currentHP,
    enemyMaxHP: enemy.maxHP,
    enemyShield: enemy.shield || 0,
    playerStatus: { ...player.status },
    enemyStatus: { ...enemy.status },
    line: lastLine,
    damageToEnemy: fx.damageToEnemy || 0,
    damageToPlayer: fx.damageToPlayer || 0,
    healToPlayer: fx.healToPlayer || 0,
    spellId: fx.spellId || null,
    nextSpellId: nextPlayerSpellId(player),
    spellOrder: player.spellOrder ? [...player.spellOrder] : [],
  };
}
