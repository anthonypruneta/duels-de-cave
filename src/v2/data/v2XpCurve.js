/**
 * Courbe XP V2 — niveaux 1 → 20.
 * XP totale requise pour passer du niveau N à N+1.
 */

import { V2_MAX_LEVEL } from './v2Kit';

/** XP pour passer de level → level+1 (index = level actuel). */
const XP_TO_NEXT = {
  1: 40,
  2: 50,
  3: 60,
  4: 75,
  5: 90,
  6: 110,
  7: 130,
  8: 155,
  9: 180,
  10: 210,
  11: 240,
  12: 275,
  13: 310,
  14: 350,
  15: 390,
  16: 435,
  17: 480,
  18: 530,
  19: 580,
};

export function getXpToNextLevel(level) {
  const lv = Math.max(1, Math.min(Number(level) || 1, V2_MAX_LEVEL));
  if (lv >= V2_MAX_LEVEL) return 0;
  return XP_TO_NEXT[lv] ?? 100;
}

export function createInitialXpState() {
  return {
    level: 1,
    xp: 0,
    xpToNext: getXpToNextLevel(1),
  };
}
