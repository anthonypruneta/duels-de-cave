// Script de simulation pour tester l'équilibrage du jeu
// Utilise exactement le moteur partagé de tournoi (simulerMatch)

import { races } from '../data/races.js';
import { classes } from '../data/classes.js';
import { getRaceBonus, getClassBonus, generalConstants } from '../data/combatMechanics.js';
import { getAwakeningEffect, applyAwakeningToBase } from './awakening.js';
import { simulerMatch } from './tournamentCombat.js';
import { getStatPointValue } from './statPoints.js';

const genStats = () => ({
  hp: 120 + Math.floor(Math.random() * 81),
  auto: 15 + Math.floor(Math.random() * 21),
  def: 15 + Math.floor(Math.random() * 21),
  cap: 15 + Math.floor(Math.random() * 21),
  rescap: 15 + Math.floor(Math.random() * 21),
  spd: 15 + Math.floor(Math.random() * 21)
});

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const STAT_KEYS = ['hp', 'auto', 'def', 'cap', 'rescap', 'spd'];

const genLevelBoosts = (level) => {
  const boosts = { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 };
  const points = Math.max(0, level - 1);
  for (let i = 0; i < points; i++) {
    const stat = randomItem(STAT_KEYS);
    boosts[stat] += getStatPointValue(stat);
  }
  return boosts;
};

const makeCharacter = (id, level = 1) => {
  const race = randomItem(Object.keys(races));
  const className = randomItem(Object.keys(classes));
  const raw = genStats();
  const raceBonus = getRaceBonus(race);
  const classBonus = getClassBonus(className);
  const levelBoosts = genLevelBoosts(level);

  const base = applyAwakeningToBase({
    hp: raw.hp + raceBonus.hp + classBonus.hp,
    auto: raw.auto + raceBonus.auto + classBonus.auto,
    def: raw.def + raceBonus.def + classBonus.def,
    cap: raw.cap + raceBonus.cap + classBonus.cap,
    rescap: raw.rescap + raceBonus.rescap + classBonus.rescap,
    spd: raw.spd + raceBonus.spd + classBonus.spd
  }, getAwakeningEffect(race, level));

  return {
    id,
    userId: id,
    name: id,
    race,
    class: className,
    base,
    level,
    bonuses: { race: raceBonus, class: classBonus },
    forestBoosts: levelBoosts,
    mageTowerPassive: null,
    equippedWeaponId: null
  };
};

const simulateSingleCombat = (level = 1) => {
  const p1 = makeCharacter('P1', level);
  const p2 = makeCharacter('P2', level);
  const result = simulerMatch(p1, p2);

  const winnerIsP1 = result.winnerId === 'P1';
  const turns = result.steps?.filter((step) => step.phase === 'turn_start').length ?? generalConstants.maxTurns;

  return {
    winner: winnerIsP1 ? 'P1' : 'P2',
    p1Race: p1.race,
    p1Class: p1.class,
    p2Race: p2.race,
    p2Class: p2.class,
    turns
  };
};

export const runSimulation = (numCombats = 1000, level = 1) => {
  console.log(`🎮 Simulation de ${numCombats} combats (niveau ${level})...`);

  const raceWins = {};
  const classWins = {};
  const raceCombats = {};
  const classCombats = {};
  let totalTurns = 0;

  Object.keys(races).forEach((race) => {
    raceWins[race] = 0;
    raceCombats[race] = 0;
  });

  Object.keys(classes).forEach((cls) => {
    classWins[cls] = 0;
    classCombats[cls] = 0;
  });

  for (let i = 0; i < numCombats; i++) {
    const result = simulateSingleCombat(level);
    totalTurns += result.turns;

    raceCombats[result.p1Race] += 1;
    raceCombats[result.p2Race] += 1;
    classCombats[result.p1Class] += 1;
    classCombats[result.p2Class] += 1;

    if (result.winner === 'P1') {
      raceWins[result.p1Race] += 1;
      classWins[result.p1Class] += 1;
    } else {
      raceWins[result.p2Race] += 1;
      classWins[result.p2Class] += 1;
    }
  }

  const avgTurns = (totalTurns / numCombats).toFixed(1);

  const sortedRaces = Object.entries(raceWins)
    .map(([race, wins]) => ({
      race,
      wins,
      combats: raceCombats[race],
      winRate: ((wins / raceCombats[race]) * 100).toFixed(1)
    }))
    .sort((a, b) => Number(b.winRate) - Number(a.winRate));

  const sortedClasses = Object.entries(classWins)
    .map(([cls, wins]) => ({
      cls,
      wins,
      combats: classCombats[cls],
      winRate: ((wins / classCombats[cls]) * 100).toFixed(1)
    }))
    .sort((a, b) => Number(b.winRate) - Number(a.winRate));

  return { sortedRaces, sortedClasses, avgTurns };
};
