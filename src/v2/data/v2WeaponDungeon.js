/**
 * Donjon d’armes V2 — 3 étages (commune / rare / légendaire).
 */

import { V2_WEAPON_RARITY } from './v2Weapons';

export const V2_WEAPON_DUNGEON_FLOORS = [
  {
    floor: 1,
    name: 'Forteresse Gobeline',
    difficulty: 'Très facile',
    dropRarity: V2_WEAPON_RARITY.COMMUNE,
    icon: '🏰',
    enemy: {
      name: 'Chef Gobelin Grukk',
      icon: '👺',
      base: { hp: 100, auto: 14, def: 10, cap: 8, rescap: 8, spd: 11 },
    },
  },
  {
    floor: 2,
    name: 'Repaire des Bandits',
    difficulty: 'Normal',
    dropRarity: V2_WEAPON_RARITY.RARE,
    icon: '🏚️',
    enemy: {
      name: 'Bandit des Grands Chemins',
      icon: '🗡️',
      base: { hp: 160, auto: 24, def: 16, cap: 14, rescap: 12, spd: 15 },
    },
  },
  {
    floor: 3,
    name: 'Antre du Dragon',
    difficulty: 'Très difficile',
    dropRarity: V2_WEAPON_RARITY.LEGENDAIRE,
    icon: '🌋',
    enemy: {
      name: 'Dragon des Profondeurs',
      icon: '🐉',
      base: { hp: 240, auto: 32, def: 22, cap: 22, rescap: 20, spd: 17 },
    },
  },
];

export function getWeaponDungeonFloor(floorNumber) {
  return V2_WEAPON_DUNGEON_FLOORS.find((f) => f.floor === floorNumber) || null;
}
