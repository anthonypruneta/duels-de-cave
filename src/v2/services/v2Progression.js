/**
 * Progression V2 — XP + level-ups style Fire Emblem.
 */

import {
  V2_GROWTH_POINT_VALUES,
  V2_GROWTH_RATES,
  V2_MAX_LEVEL,
  V2_STAT_KEYS,
  getEmptyV2StatBlock,
} from '../data/v2Kit';
import { getXpToNextLevel } from '../data/v2XpCurve';

/**
 * Roll FE : chaque stat a une chance de +1 point (valeur selon V2_GROWTH_POINT_VALUES).
 * Garantit au moins `minGains` stats qui montent.
 */
export function rollLevelUpGains(rng = Math.random) {
  const gains = getEmptyV2StatBlock();
  const risen = [];

  for (const key of V2_STAT_KEYS) {
    const rate = V2_GROWTH_RATES[key] ?? 0;
    if (rng() < rate) {
      const delta = V2_GROWTH_POINT_VALUES[key] ?? 1;
      gains[key] += delta;
      risen.push(key);
    }
  }

  const minGains = 2;
  while (risen.length < minGains) {
    const candidates = V2_STAT_KEYS.filter((k) => !risen.includes(k));
    const pool = candidates.length ? candidates : V2_STAT_KEYS;
    const pick = pool[Math.floor(rng() * pool.length)];
    if (!risen.includes(pick)) {
      risen.push(pick);
      gains[pick] += V2_GROWTH_POINT_VALUES[pick] ?? 1;
    } else {
      break;
    }
  }

  return gains;
}

/**
 * Ajoute de l’XP et applique les level-ups éventuels.
 * @returns {{ level, xp, xpToNext, growthGains, levelUps: Array<{ level, gains }> }}
 */
export function applyXpGain(state, xpAmount, rng = Math.random) {
  let level = Math.max(1, Number(state.level) || 1);
  let xp = Math.max(0, Number(state.xp) || 0);
  let growthGains = { ...getEmptyV2StatBlock(), ...(state.growthGains || {}) };
  const levelUps = [];

  let remaining = Math.max(0, Math.floor(Number(xpAmount) || 0));
  xp += remaining;

  while (level < V2_MAX_LEVEL) {
    const need = getXpToNextLevel(level);
    if (xp < need) break;
    xp -= need;
    level += 1;
    const gains = rollLevelUpGains(rng);
    for (const key of V2_STAT_KEYS) {
      growthGains[key] = (growthGains[key] || 0) + (gains[key] || 0);
    }
    levelUps.push({ level, gains });
  }

  if (level >= V2_MAX_LEVEL) {
    level = V2_MAX_LEVEL;
    xp = 0;
  }

  return {
    level,
    xp,
    xpToNext: getXpToNextLevel(level),
    growthGains,
    levelUps,
  };
}
