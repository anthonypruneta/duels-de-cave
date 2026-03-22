/**
 * Simulation donjon Red (admin) : persos aléatoires par palier de niveau + moteur tournoi coop.
 */
import { races } from '../data/races.js';
import { classes } from '../data/classes.js';
import { getRaceBonus, getClassBonus } from '../data/combatMechanics.js';
import { getAwakeningEffect, applyAwakeningToBase } from './awakening.js';
import { getStatPointValue } from './statPoints.js';
import { simulerMatchCoopRed } from './coopRedTournamentSim.js';
import {
  COOP_RED_DIFFICULTY,
  COOP_RED_DIFFICULTY_LABELS,
  getCoopRedLineup,
} from '../data/coopRedDungeon.js';

const STAT_KEYS = ['hp', 'auto', 'def', 'cap', 'rescap', 'spd'];

/** RNG déterministe [0, 1) à partir d’un seed entier. */
export function createMulberry32(seed) {
  let a = seed >>> 0;
  return function rand01() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickStat(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function genLevelBoosts(level, rng) {
  const boosts = { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 };
  const points = Math.max(0, level - 1);
  for (let i = 0; i < points; i++) {
    const stat = pickStat(rng, STAT_KEYS);
    boosts[stat] += getStatPointValue(stat);
  }
  return boosts;
}

/**
 * Personnage brut compatible preparerCombattant / donjon Red (sans arme / tour / forge).
 */
export function buildAdminRandomCoopCharacter(userId, name, level, rng) {
  const race = pickStat(rng, Object.keys(races));
  const className = pickStat(rng, Object.keys(classes));
  const raw = {
    hp: 120 + Math.floor(rng() * 81),
    auto: 15 + Math.floor(rng() * 21),
    def: 15 + Math.floor(rng() * 21),
    cap: 15 + Math.floor(rng() * 21),
    rescap: 15 + Math.floor(rng() * 21),
    spd: 15 + Math.floor(rng() * 21),
  };
  const raceBonus = getRaceBonus(race);
  const classBonus = getClassBonus(className);
  const levelBoosts = genLevelBoosts(level, rng);

  const base = applyAwakeningToBase(
    {
      hp: raw.hp + raceBonus.hp + classBonus.hp,
      auto: raw.auto + raceBonus.auto + classBonus.auto,
      def: raw.def + raceBonus.def + classBonus.def,
      cap: raw.cap + raceBonus.cap + classBonus.cap,
      rescap: raw.rescap + raceBonus.rescap + classBonus.rescap,
      spd: raw.spd + raceBonus.spd + classBonus.spd,
    },
    getAwakeningEffect(race, level)
  );

  return {
    userId,
    name,
    race,
    class: className,
    level,
    base,
    bonuses: { race: raceBonus, class: classBonus },
    forestBoosts: levelBoosts,
    equippedWeaponId: null,
    equippedWeaponData: null,
    forgeUpgrade: null,
    subclass: null,
    mageTowerPassive: null,
    mageTowerExtensionPassive: null,
    additionalAwakeningRaces: [],
    awakeningForced: false,
    coopRaceEcho: null,
  };
}

function countTours(log) {
  if (!Array.isArray(log)) return 0;
  return log.filter((line) => typeof line === 'string' && line.startsWith('--- Tour ')).length;
}

/**
 * Trois combats : niveaux 150 / 250 / 350 avec difficultés easy / medium / hard.
 * @param {number} seed
 */
export function runAdminCoopRedSimulations(seed) {
  const rng = createMulberry32(seed >>> 0);
  const runs = [];

  const configs = [
    { difficulty: COOP_RED_DIFFICULTY.EASY, level: 150 },
    { difficulty: COOP_RED_DIFFICULTY.MEDIUM, level: 250 },
    { difficulty: COOP_RED_DIFFICULTY.HARD, level: 350 },
  ];

  for (const { difficulty, level } of configs) {
    const host = buildAdminRandomCoopCharacter(`sim-h-${level}`, `Hôte ${level}`, level, rng);
    const guest = buildAdminRandomCoopCharacter(`sim-g-${level}`, `Invité ${level}`, level, rng);
    const combatSeed = (Math.floor(rng() * 0x7fffffff) >>> 0);
    const combat = simulerMatchCoopRed(host, guest, difficulty, combatSeed, { recordSteps: true });
    runs.push({
      difficulty,
      difficultyLabel: COOP_RED_DIFFICULTY_LABELS[difficulty] ?? difficulty,
      level,
      combatSeed,
      hostSnap: host,
      guestSnap: guest,
      lineup: getCoopRedLineup(difficulty),
      steps: combat.steps ?? [],
      hostSummary: { race: host.race, class: host.class, name: host.name },
      guestSummary: { race: guest.race, class: guest.class, name: guest.name },
      winner: combat.winner,
      hostHP: combat.hostHP,
      guestHP: combat.guestHP,
      bossHP: combat.bossHP,
      tours: countTours(combat.log),
      log: combat.log,
    });
  }

  return { seed: seed >>> 0, runs };
}
