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
