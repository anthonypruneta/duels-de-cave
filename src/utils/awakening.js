import { races } from '../data/races.js';
import { getRaceBonus } from '../data/combatMechanics.js';

export const getAwakeningEffect = (race, level = 1) => {
  const awakening = races[race]?.awakening;
  if (!awakening || level < awakening.levelRequired) return null;
  return awakening.effect || null;
};

export const applyAwakeningToBase = (base, awakeningEffect) => {
  if (!awakeningEffect) return { ...base };
  let updated = { ...base };

  // Bonus flat AVANT les multiplicateurs %
  if (awakeningEffect.statBonuses) {
    for (const [stat, bonus] of Object.entries(awakeningEffect.statBonuses)) {
      if (typeof updated[stat] === 'number') {
        updated[stat] = Math.round(updated[stat] + bonus);
      }
    }
  }

  if (awakeningEffect.statMultipliers) {
    for (const [stat, multiplier] of Object.entries(awakeningEffect.statMultipliers)) {
      if (typeof updated[stat] === 'number') {
        updated[stat] = Math.round(updated[stat] * multiplier);
      }
    }
  }

  return updated;
};

export const removeBaseRaceFlatBonusesIfAwakened = (base, race, level = 1) => {
  const awakeningEffect = getAwakeningEffect(race, level);
  if (!awakeningEffect) return { ...base };

  const raceBonus = getRaceBonus(race);
  const updated = { ...base };

  Object.entries(raceBonus).forEach(([stat, bonus]) => {
    if (typeof updated[stat] === 'number' && typeof bonus === 'number' && bonus !== 0) {
      updated[stat] = Math.round(updated[stat] - bonus);
    }
  });

  return updated;
};

export const buildAwakeningState = (awakeningEffect) => {
  if (!awakeningEffect) return null;
  return {
    ...awakeningEffect,
    incomingHitCountRemaining: awakeningEffect.incomingHitCount ?? 0,
    damageTakenStacks: 0
  };
};

/**
 * Fusionne plusieurs effets d'éveil (ex. boss 100 avec 2 races).
 * statBonuses/statMultipliers et clés combat sont fusionnés de façon cohérente avec le combat.
 */
export function mergeAwakeningEffects(effects = []) {
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
      'sireneStackBonus'];
    additiveKeys.forEach((key) => {
      if (typeof effect[key] === 'number') acc[key] = (acc[key] ?? 0) + effect[key];
    });
    const speedDuelKeys = [
      'speedDuelCritHigh', 'speedDuelCritDmgHigh', 'speedDuelCapBonusLow', 'speedDuelDodgeLow',
      'speedDuelEqualCrit', 'speedDuelEqualCritDmg', 'speedDuelEqualDodge', 'speedDuelEqualCapBonus',
    ];
    speedDuelKeys.forEach((key) => {
      if (typeof effect[key] === 'number') acc[key] = (acc[key] ?? 0) + effect[key];
    });
    if (typeof effect.sireneMaxStacks === 'number') {
      acc.sireneMaxStacks = Math.max(acc.sireneMaxStacks ?? 0, effect.sireneMaxStacks);
    }
    if (typeof effect.turtlekinFirstHitCapPercent === 'number' && effect.turtlekinFirstHitCapPercent > 0) {
      acc.turtlekinFirstHitCapPercent = Math.max(
        acc.turtlekinFirstHitCapPercent ?? 0,
        effect.turtlekinFirstHitCapPercent
      );
    }
    if (
      typeof effect.mindflayerCoopEchoCopyDamageMult === 'number' &&
      effect.mindflayerCoopEchoCopyDamageMult > 0 &&
      effect.mindflayerCoopEchoCopyDamageMult < 1
    ) {
      acc.mindflayerCoopEchoCopyDamageMult = effect.mindflayerCoopEchoCopyDamageMult;
    }
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
    if (typeof effect.cendresHpDamageThreshold === 'number') acc.cendresHpDamageThreshold = effect.cendresHpDamageThreshold;
    if (typeof effect.cendresBraiseSpellMult === 'number') acc.cendresBraiseSpellMult = effect.cendresBraiseSpellMult;
    if (typeof effect.cendresBraiseGuaranteedEachTurn === 'number') acc.cendresBraiseGuaranteedEachTurn = effect.cendresBraiseGuaranteedEachTurn;
    if (typeof effect.ecailleuxCapacityRefStatPercent === 'number') acc.ecailleuxCapacityRefStatPercent = effect.ecailleuxCapacityRefStatPercent;
    return acc;
  }, {});
}
