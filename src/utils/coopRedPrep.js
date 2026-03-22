/**
 * Préparation des combattants donjon Red (preparerCombattant).
 */
import { preparerCombattant } from './tournamentCombat.js';
import { buildCoopRedBossCombatants } from '../data/coopRedDungeon.js';

export function rebuildPreparedCoop(hostSnap, guestSnap, difficulty) {
  const host = preparerCombattant(hostSnap);
  const guest = preparerCombattant(guestSnap);
  const bossRaws = buildCoopRedBossCombatants(difficulty);
  const bosses = bossRaws.map((b) => preparerCombattant(b));
  return { host, guest, bosses };
}
