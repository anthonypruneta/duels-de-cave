/**
 * Labyrinthe V2 — 10 étages, boss aux étages 5 et 10.
 */

export const V2_LABYRINTH_FLOOR_COUNT = 10;
export const V2_LABYRINTH_BOSS_FLOORS = [5, 10];

const BASE_ENEMY = {
  hp: 70,
  auto: 14,
  def: 10,
  cap: 10,
  rescap: 10,
  spd: 12,
};

const NAMES = [
  'Ombre rampante',
  'Squelette errant',
  'Loup des caves',
  'Gobelin sournois',
  'Gardien de pierre',
  'Spectre affamé',
  'Brute des profondeurs',
  'Araignée de magma',
  'Champion déchu',
  'Seigneur du labyrinthe',
];

export function isV2LabyrinthBossFloor(floor) {
  return V2_LABYRINTH_BOSS_FLOORS.includes(floor);
}

export function buildV2LabyrinthEnemy(floor) {
  const f = Math.max(1, Math.min(floor, V2_LABYRINTH_FLOOR_COUNT));
  const isBoss = isV2LabyrinthBossFloor(f);
  const scale = 1 + (f - 1) * 0.12;
  const bossMult = isBoss ? 1.35 : 1;

  const base = {
    hp: Math.round(BASE_ENEMY.hp * scale * bossMult),
    auto: Math.round(BASE_ENEMY.auto * scale * bossMult),
    def: Math.round(BASE_ENEMY.def * scale * (isBoss ? 1.2 : 1)),
    cap: Math.round(BASE_ENEMY.cap * scale * bossMult),
    rescap: Math.round(BASE_ENEMY.rescap * scale * (isBoss ? 1.2 : 1)),
    spd: Math.round(BASE_ENEMY.spd * scale),
  };

  return {
    name: NAMES[f - 1] || `Ennemi étage ${f}`,
    icon: isBoss ? '👹' : '💀',
    isBoss,
    floor: f,
    base,
  };
}

/** XP par étage (boss un peu plus). */
export function getV2LabyrinthXpReward(floor) {
  const f = Math.max(1, Math.min(floor, V2_LABYRINTH_FLOOR_COUNT));
  const base = 20 + f * 8;
  return isV2LabyrinthBossFloor(f) ? Math.round(base * 1.5) : base;
}
