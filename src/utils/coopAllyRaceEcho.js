/**
 * Écho racial de l’allié (donjon coop) : bonus plats réduits sur la base, avant preparerCombattant.
 */
import { getRaceBonus } from '../data/combatMechanics';
import { COOP_ALLY_RACE_ECHO_FACTOR } from '../data/coopRedDungeon';

const STAT_KEYS = ['hp', 'auto', 'def', 'cap', 'rescap', 'spd'];

/**
 * @param {object} rawCharacter - personnage Firestore brut
 * @param {string|null} allyRace - race de l’allié (nom affiché, ex. 'Elfe')
 * @returns {object} clone avec base modifiée (ne pas muter l’original)
 */
export function applyCoopAllyRaceEchoToRawCharacter(rawCharacter, allyRace) {
  if (!rawCharacter || !allyRace) return rawCharacter ? { ...rawCharacter } : rawCharacter;
  const bonus = getRaceBonus(allyRace);
  const base = { ...(rawCharacter.base || {}) };
  for (const k of STAT_KEYS) {
    const v = bonus[k];
    if (typeof v === 'number' && v !== 0) {
      base[k] = Math.max(1, Math.round((base[k] || 0) + v * COOP_ALLY_RACE_ECHO_FACTOR));
    }
  }
  return { ...rawCharacter, base };
}
