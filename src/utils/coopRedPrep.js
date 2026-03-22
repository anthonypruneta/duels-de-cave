/**
 * Préparation des combattants donjon Red (preparerCombattant).
 * Simulation : arme légendaire + passif tour de mage niveau 3 tirés au sort (RNG déterministe si rngNext01 fourni).
 */
import { RARITY, getWeaponsByRarity, isWaveActive } from '../data/weapons.js';
import { MAGE_TOWER_PASSIVES } from '../data/mageTowerPassives.js';
import { preparerCombattant } from './tournamentCombat.js';
import { buildCoopRedBossCombatants } from '../data/coopRedDungeon.js';

function getCoopRedLegendaryWeaponPool() {
  return getWeaponsByRarity(RARITY.LEGENDAIRE).filter((w) => isWaveActive(w.vague));
}

function getCoopRedMagePassiveLevel3Pool() {
  return MAGE_TOWER_PASSIVES.filter(
    (p) => p.levels && p.levels[3] && (!p.vague || isWaveActive(p.vague))
  );
}

/**
 * @param {() => number} rngNext01 — renvoie [0, 1)
 */
function injectCoopRedSimulationLoot(hostSnap, guestSnap, rngNext01) {
  const legPool = getCoopRedLegendaryWeaponPool();
  const pasPool = getCoopRedMagePassiveLevel3Pool();
  if (legPool.length === 0 || pasPool.length === 0) {
    return { hostSnap, guestSnap };
  }
  const pick = (pool) => {
    const idx = Math.min(pool.length - 1, Math.floor(rngNext01() * pool.length));
    return pool[idx];
  };
  const merge = (snap) => {
    const w = pick(legPool);
    const p = pick(pasPool);
    return {
      ...snap,
      equippedWeaponId: w.id,
      equippedWeaponData: { ...w },
      mageTowerPassive: { id: p.id, level: 3 },
    };
  };
  return { hostSnap: merge(hostSnap), guestSnap: merge(guestSnap) };
}

/**
 * @param {object} [options]
 * @param {() => number} [options.rngNext01] — si défini (même flux que le combat Red), injecte arme légendaire + passif niv. 3 aléatoires pour l’hôte et l’invité.
 */
export function rebuildPreparedCoop(hostSnap, guestSnap, difficulty, options = {}) {
  let h = hostSnap;
  let g = guestSnap;
  if (typeof options.rngNext01 === 'function') {
    ({ hostSnap: h, guestSnap: g } = injectCoopRedSimulationLoot(hostSnap, guestSnap, options.rngNext01));
  }
  const host = preparerCombattant(h);
  const guest = preparerCombattant(g);
  const bossRaws = buildCoopRedBossCombatants(difficulty);
  const bosses = bossRaws.map((b) => preparerCombattant(b));
  return { host, guest, bosses };
}
