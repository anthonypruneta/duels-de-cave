/**
 * Pointeau ADN Red (coop) : fragment d’éveil d’une race tirée au sort, à COOP_RACE_ECHO_POTENCY.
 * Basé sur la race uniquement (pas la classe).
 */
import { races } from '../data/races.js';
import { getAwakeningEffect } from './awakening.js';
import {
  COOP_RACE_ECHO_POTENCY,
  COOP_CENDRES_ECHO_HP_THRESHOLD,
  COOP_CENDRES_ECHO_BRAISE_MULT,
  COOP_CENDRES_ECHO_GUARANTEED,
  COOP_ECAILLEUX_ECHO_REF_STAT_PERCENT,
  COOP_ECAILLEUX_ECHO_STAT_LINK_DIVISOR
} from '../data/coopRedDungeon.js';

/** Copie Mindflayer (Pointeau ADN / coop Red uniquement) : dégâts/soins de la copie = ce % de la valeur « pleine ». */
export const COOP_MINDFLAYER_ECHO_COPY_DAMAGE_MULT = 0.5;

/** Sirène (Pointeau ADN coop) : bonus par stack et plafond de stacks (fixe, hors formule globale). */
export const COOP_SIRENE_ECHO_STACK_BONUS = 0.025;
export const COOP_SIRENE_ECHO_MAX_STACKS = 4;

/** Turtlekin (Pointeau ADN coop) : plafond du 1er coup reçu (% PV max). */
export const COOP_TURTLEKIN_ECHO_FIRST_HIT_CAP = 0.2;

const SPEED_DUEL_KEYS = [
  'speedDuelCritHigh',
  'speedDuelCritDmgHigh',
  'speedDuelCapBonusLow',
  'speedDuelDodgeLow',
  'speedDuelEqualCrit',
  'speedDuelEqualCritDmg',
  'speedDuelEqualDodge',
  'speedDuelEqualCapBonus',
];

const LINEAR_ADDITIVE_KEYS = [
  'critChanceBonus',
  'critDamageBonus',
  'damageStackBonus',
  'explosionPercent',
  'regenPercent',
  'bleedPercentPerStack',
  'mindflayerStealSpellCapDamageScale',
  'mindflayerNoCooldownSpellBonus',
  'sireneStackBonus',
  'highHpDamageBonus',
  ...SPEED_DUEL_KEYS,
];

function scaleRaceEchoEffect(effect, p) {
  if (!effect || p <= 0) return null;
  const out = {};

  if (effect.statMultipliers) {
    out.statMultipliers = {};
    for (const [k, v] of Object.entries(effect.statMultipliers)) {
      if (typeof v === 'number' && v > 0) {
        out.statMultipliers[k] = 1 + (v - 1) * p;
      }
    }
    if (Object.keys(out.statMultipliers).length === 0) delete out.statMultipliers;
  }

  if (effect.statBonuses) {
    out.statBonuses = {};
    for (const [k, v] of Object.entries(effect.statBonuses)) {
      if (typeof v === 'number') {
        const n = Math.round(v * p);
        if (n !== 0) out.statBonuses[k] = n;
      }
    }
    if (Object.keys(out.statBonuses).length === 0) delete out.statBonuses;
  }

  for (const key of LINEAR_ADDITIVE_KEYS) {
    if (typeof effect[key] === 'number') {
      const v = effect[key] * p;
      if (Math.abs(v) > 1e-12) out[key] = v;
    }
  }

  if (typeof effect.mindflayerOwnCooldownReductionTurns === 'number') {
    const n = Math.max(0, Math.round(effect.mindflayerOwnCooldownReductionTurns * p));
    if (n > 0) out.mindflayerOwnCooldownReductionTurns = n;
  }

  for (const key of ['damageTakenMultiplier', 'incomingHitMultiplier']) {
    if (typeof effect[key] === 'number') {
      out[key] = 1 + (effect[key] - 1) * p;
    }
  }

  if (typeof effect.incomingHitCount === 'number') {
    const n = Math.max(0, Math.round(effect.incomingHitCount * p));
    if (n > 0) out.incomingHitCount = n;
  }

  if (typeof effect.explosionPercent === 'number') {
    const v = effect.explosionPercent * p;
    if (v > 0) out.explosionPercent = v;
  }

  if (typeof effect.revivePercent === 'number') {
    const v = effect.revivePercent * p;
    if (v > 0) {
      out.revivePercent = v;
      if (effect.reviveOnce) out.reviveOnce = true;
    }
  }

  if (typeof effect.bleedStacksPerHit === 'number') {
    const n = Math.max(0, Math.round(effect.bleedStacksPerHit * p));
    if (n > 0) out.bleedStacksPerHit = n;
  }

  if (typeof effect.highHpThreshold === 'number') {
    out.highHpThreshold = effect.highHpThreshold;
  }

  if (typeof effect.damageBonus === 'number' && effect.damageBonus >= 1) {
    out.damageBonus = 1 + (effect.damageBonus - 1) * p;
  }

  if (effect.turtlekinResetAt50) {
    out.turtlekinResetAt50 = true;
  }

  if (typeof effect.sireneMaxStacks === 'number') {
    const n = Math.max(1, Math.round(effect.sireneMaxStacks * p));
    out.sireneMaxStacks = n;
  }

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * @param {string|null|undefined} echoRaceName - race du coéquipier (nom affiché)
 * @returns {object|null} fragment d’éveil à fusionner dans mergeAwakeningEffects
 */
export function getCoopRaceEchoAwakeningFragment(echoRaceName) {
  if (!echoRaceName || !races[echoRaceName]) return null;

  if (echoRaceName === 'Mindflayer') {
    return {
      mindflayerCoopEchoCopyDamageMult: COOP_MINDFLAYER_ECHO_COPY_DAMAGE_MULT,
      mindflayerStealSpellCapDamageScale: 0,
    };
  }

  const full = getAwakeningEffect(echoRaceName, 999);
  if (!full) return null;

  if (echoRaceName === 'Sirène') {
    const scaled = scaleRaceEchoEffect(full, COOP_RACE_ECHO_POTENCY);
    const base = scaled && Object.keys(scaled).length > 0 ? scaled : {};
    return {
      ...base,
      sireneStackBonus: COOP_SIRENE_ECHO_STACK_BONUS,
      sireneMaxStacks: COOP_SIRENE_ECHO_MAX_STACKS,
    };
  }

  if (echoRaceName === 'Turtlekin') {
    const scaled = scaleRaceEchoEffect(full, COOP_RACE_ECHO_POTENCY);
    const base = scaled && Object.keys(scaled).length > 0 ? scaled : { turtlekinResetAt50: true };
    return {
      ...base,
      turtlekinFirstHitCapPercent: COOP_TURTLEKIN_ECHO_FIRST_HIT_CAP,
    };
  }

  if (echoRaceName === 'Cendrés') {
    return {
      cendresHpDamageThreshold: COOP_CENDRES_ECHO_HP_THRESHOLD,
      cendresBraiseSpellMult: COOP_CENDRES_ECHO_BRAISE_MULT,
      cendresBraiseGuaranteedEachTurn: COOP_CENDRES_ECHO_GUARANTEED
    };
  }

  if (echoRaceName === 'Écailleux') {
    return {
      ecailleuxCapacityRefStatPercent: COOP_ECAILLEUX_ECHO_REF_STAT_PERCENT,
      ecailleuxStatLinkDivisorPointeau: COOP_ECAILLEUX_ECHO_STAT_LINK_DIVISOR
    };
  }

  return scaleRaceEchoEffect(full, COOP_RACE_ECHO_POTENCY);
}
