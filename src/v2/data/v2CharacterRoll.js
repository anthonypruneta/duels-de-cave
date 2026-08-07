/**
 * Roll de création V2 — 3 offres aléatoires race/classe.
 */

import { classes } from '../../data/classes';
import { races } from '../../data/races';
import { V2_CLASS_SPELLS_BY_NAME } from './v2Classes';

/** Races jouables V2 (catalogue V1). */
export const V2_PLAYABLE_RACES = Object.keys(races);

/** Classes jouables V2 (celles qui ont un sort codé). */
export const V2_PLAYABLE_CLASSES = Object.keys(V2_CLASS_SPELLS_BY_NAME);

export function getRaceIcon(raceName) {
  return races[raceName]?.icon || '❓';
}

export function getClassIcon(className) {
  return classes[className]?.icon || '✨';
}

/**
 * Tire `count` combinaisons uniques (race, classe).
 * @returns {{ id: string, race: string, class: string }[]}
 */
export function rollV2CharacterOffers(count = 3, rng = Math.random) {
  const offers = [];
  const seen = new Set();
  let guard = 0;
  const maxGuard = Math.max(200, count * 50);

  while (offers.length < count && guard < maxGuard) {
    guard += 1;
    const race = V2_PLAYABLE_RACES[Math.floor(rng() * V2_PLAYABLE_RACES.length)];
    const classe = V2_PLAYABLE_CLASSES[Math.floor(rng() * V2_PLAYABLE_CLASSES.length)];
    const id = `${race}::${classe}`;
    if (seen.has(id)) continue;
    seen.add(id);
    offers.push({ id, race, class: classe });
  }

  return offers;
}
