/**
 * Préparation des combattants donjon Red (écho allié + preparerCombattant).
 */
import { preparerCombattant } from './tournamentCombat.js';
import { applyCoopAllyRaceEchoToRawCharacter } from './coopAllyRaceEcho.js';
import { buildCoopRedBossCombatants } from '../data/coopRedDungeon.js';

export function rebuildPreparedCoop(hostSnap, guestSnap, difficulty) {
  const hostRaw = applyCoopAllyRaceEchoToRawCharacter(
    hostSnap,
    hostSnap?.allyRaceEcho?.race === guestSnap?.race ? null : guestSnap?.race
  );
  const guestRaw = applyCoopAllyRaceEchoToRawCharacter(
    guestSnap,
    guestSnap?.allyRaceEcho?.race === hostSnap?.race ? null : hostSnap?.race
  );
  const host = preparerCombattant(hostRaw);
  const guest = preparerCombattant(guestRaw);
  const bossRaws = buildCoopRedBossCombatants(difficulty);
  const bosses = bossRaws.map((b) => preparerCombattant(b));
  return { host, guest, bosses };
}
