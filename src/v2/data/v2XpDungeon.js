/**
 * Donjon XP V2 — 3 étages.
 */

export const V2_XP_DUNGEON_FLOORS = [
  {
    floor: 1,
    name: 'Clairière d’essai',
    xpReward: 30,
    enemy: {
      name: 'Sanglier d’entraînement',
      icon: '🐗',
      base: { hp: 90, auto: 16, def: 10, cap: 8, rescap: 8, spd: 12 },
    },
  },
  {
    floor: 2,
    name: 'Bosquet d’essai',
    xpReward: 50,
    enemy: {
      name: 'Ours d’entraînement',
      icon: '🐻',
      base: { hp: 140, auto: 22, def: 16, cap: 12, rescap: 12, spd: 14 },
    },
  },
  {
    floor: 3,
    name: 'Sanctuaire d’essai',
    xpReward: 80,
    enemy: {
      name: 'Gardien d’essai',
      icon: '🦄',
      base: { hp: 200, auto: 28, def: 20, cap: 18, rescap: 18, spd: 16 },
    },
  },
];

export function getXpDungeonFloor(floorNumber) {
  return V2_XP_DUNGEON_FLOORS.find((f) => f.floor === floorNumber) || null;
}
