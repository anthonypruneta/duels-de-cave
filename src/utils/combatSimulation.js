// Script de simulation pour tester l'équilibrage du jeu
// Utilise simulerMatch → preparerCombattant (même chemin que le tournoi).
// Les combattants générés doivent avoir un base « brut » (roll + bonus race/classe), sans applyAwakeningToBase ici.

import { races } from '../data/races.js';
import { classes } from '../data/classes.js';
import { SUBCLASSES_BY_CLASS } from '../data/subclasses.js';
import { getRaceBonus, getClassBonus } from '../data/combatMechanics.js';
import { simulerMatch } from './tournamentCombat.js';
import { getStatPointValue } from './statPoints.js';

const SUBCLASS_ID_TO_NAME = Object.fromEntries(
  Object.values(SUBCLASSES_BY_CLASS)
    .flat()
    .map((s) => [s.id, s.name])
);

const ALL_SUBCLASS_IDS = Object.keys(SUBCLASS_ID_TO_NAME);

function pickRandomSubclass(className) {
  const list = SUBCLASSES_BY_CLASS[className];
  if (!list?.length) return null;
  const sc = randomItem(list);
  return { id: sc.id, name: sc.name };
}

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

  // Aligné sur un perso Firestore : base = roll + bonus race/classe (sans éveil).
  // simulerMatch → preparerCombattant applique éveil, forêt, arme, etc.
  const base = {
    hp: raw.hp + raceBonus.hp + classBonus.hp,
    auto: raw.auto + raceBonus.auto + classBonus.auto,
    def: raw.def + raceBonus.def + classBonus.def,
    cap: raw.cap + raceBonus.cap + classBonus.cap,
    rescap: raw.rescap + raceBonus.rescap + classBonus.rescap,
    spd: raw.spd + raceBonus.spd + classBonus.spd
  };

  return {
    id,
    userId: id,
    name: id,
    race,
    class: className,
    subclass: pickRandomSubclass(className),
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
  const turns = result.steps?.filter((step) => step.phase === 'turn_start').length ?? 0;

  return {
    winner: winnerIsP1 ? 'P1' : 'P2',
    p1Race: p1.race,
    p1Class: p1.class,
    p1SubclassId: p1.subclass?.id ?? null,
    p2Race: p2.race,
    p2Class: p2.class,
    p2SubclassId: p2.subclass?.id ?? null,
    turns
  };
};

export const runSimulation = (numCombats = 1000, level = 1, options = {}) => {
  if (!options.quiet) {
    console.log(`🎮 Simulation de ${numCombats} combats (niveau ${level})...`);
  }

  const raceWins = {};
  const classWins = {};
  const subclassWins = {};
  const raceCombats = {};
  const classCombats = {};
  const subclassCombats = {};
  let totalTurns = 0;

  Object.keys(races).forEach((race) => {
    raceWins[race] = 0;
    raceCombats[race] = 0;
  });

  Object.keys(classes).forEach((cls) => {
    classWins[cls] = 0;
    classCombats[cls] = 0;
  });

  ALL_SUBCLASS_IDS.forEach((sid) => {
    subclassWins[sid] = 0;
    subclassCombats[sid] = 0;
  });

  for (let i = 0; i < numCombats; i++) {
    const result = simulateSingleCombat(level);
    totalTurns += result.turns;

    raceCombats[result.p1Race] += 1;
    raceCombats[result.p2Race] += 1;
    classCombats[result.p1Class] += 1;
    classCombats[result.p2Class] += 1;
    if (result.p1SubclassId && subclassCombats[result.p1SubclassId] !== undefined) {
      subclassCombats[result.p1SubclassId] += 1;
    }
    if (result.p2SubclassId && subclassCombats[result.p2SubclassId] !== undefined) {
      subclassCombats[result.p2SubclassId] += 1;
    }

    if (result.winner === 'P1') {
      raceWins[result.p1Race] += 1;
      classWins[result.p1Class] += 1;
      if (result.p1SubclassId && subclassWins[result.p1SubclassId] !== undefined) {
        subclassWins[result.p1SubclassId] += 1;
      }
    } else {
      raceWins[result.p2Race] += 1;
      classWins[result.p2Class] += 1;
      if (result.p2SubclassId && subclassWins[result.p2SubclassId] !== undefined) {
        subclassWins[result.p2SubclassId] += 1;
      }
    }
  }

  const avgTurns = (totalTurns / numCombats).toFixed(1);

  const sortedRaces = Object.entries(raceWins)
    .map(([race, wins]) => {
      const combats = raceCombats[race];
      return {
        race,
        wins,
        combats,
        winRate: combats > 0 ? ((wins / combats) * 100).toFixed(1) : '0.0'
      };
    })
    .sort((a, b) => Number(b.winRate) - Number(a.winRate));

  const sortedClasses = Object.entries(classWins)
    .map(([cls, wins]) => {
      const combats = classCombats[cls];
      return {
        cls,
        wins,
        combats,
        winRate: combats > 0 ? ((wins / combats) * 100).toFixed(1) : '0.0'
      };
    })
    .sort((a, b) => Number(b.winRate) - Number(a.winRate));

  const sortedSubclasses = ALL_SUBCLASS_IDS.map((id) => ({
    id,
    name: SUBCLASS_ID_TO_NAME[id] ?? id,
    wins: subclassWins[id],
    combats: subclassCombats[id],
    winRate: subclassCombats[id] > 0 ? ((subclassWins[id] / subclassCombats[id]) * 100).toFixed(1) : '0.0'
  })).sort((a, b) => Number(b.winRate) - Number(a.winRate));

  return { sortedRaces, sortedClasses, sortedSubclasses, avgTurns };
};
