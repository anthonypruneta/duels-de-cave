/**
 * Donjon coop « Rouge » — 3 difficultés, 3 adversaires en rotation par run.
 * Noms volontairement dérivés (éviter marques déposées).
 */

export const COOP_RED_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

export const COOP_RED_LEVEL_REQUIRED = {
  [COOP_RED_DIFFICULTY.EASY]: 150,
  [COOP_RED_DIFFICULTY.MEDIUM]: 250,
  [COOP_RED_DIFFICULTY.HARD]: 350,
};

export const COOP_RED_DROP_RATE = {
  [COOP_RED_DIFFICULTY.EASY]: 0.15,
  [COOP_RED_DIFFICULTY.MEDIUM]: 0.25,
  [COOP_RED_DIFFICULTY.HARD]: 0.45,
};

export const COOP_RED_MAX_ATTEMPTS_PER_DAY = 3;

export const COOP_RED_DNA_COST_ECHO = 3;

/** Facteur d’écho racial (allié) : fraction des bonus plats de raceConstants */
export const COOP_ALLY_RACE_ECHO_FACTOR = 0.25;

export const COOP_RED_DIFFICULTY_LABELS = {
  [COOP_RED_DIFFICULTY.EASY]: 'Facile',
  [COOP_RED_DIFFICULTY.MEDIUM]: 'Moyen',
  [COOP_RED_DIFFICULTY.HARD]: 'Difficile',
};

/**
 * Lignes de boss par difficulté : ordre de rotation (0 → 1 → 2).
 * baseStats fixes par palier (équilibrage donjon coop 2 joueurs).
 */
export const coopRedBossLineups = {
  [COOP_RED_DIFFICULTY.EASY]: [
    {
      id: 'coop_red_salamandre',
      nom: 'Salamandre de braise',
      icon: '🔥',
      imageFile: null,
      baseStats: { hp: 220, auto: 22, def: 22, cap: 20, rescap: 20, spd: 24 },
    },
    {
      id: 'coop_red_carapace',
      nom: 'Tortue de cristal',
      icon: '💧',
      imageFile: null,
      baseStats: { hp: 260, auto: 18, def: 28, cap: 18, rescap: 26, spd: 16 },
    },
    {
      id: 'coop_red_pousse',
      nom: 'Pousse géante',
      icon: '🌿',
      imageFile: null,
      baseStats: { hp: 240, auto: 20, def: 20, cap: 24, rescap: 22, spd: 20 },
    },
  ],
  [COOP_RED_DIFFICULTY.MEDIUM]: [
    {
      id: 'coop_red_foudre',
      nom: 'Rongeur foudroyant',
      icon: '⚡',
      imageFile: null,
      baseStats: { hp: 380, auto: 34, def: 30, cap: 32, rescap: 30, spd: 38 },
    },
    {
      id: 'coop_red_dormeur',
      nom: 'Colosse endormi',
      icon: '😴',
      imageFile: null,
      baseStats: { hp: 520, auto: 40, def: 42, cap: 28, rescap: 36, spd: 22 },
    },
    {
      id: 'coop_red_lagon',
      nom: 'Serpent des lagons',
      icon: '🌊',
      imageFile: null,
      baseStats: { hp: 420, auto: 32, def: 32, cap: 36, rescap: 34, spd: 30 },
    },
  ],
  [COOP_RED_DIFFICULTY.HARD]: [
    {
      id: 'coop_red_dragonnet',
      nom: 'Dragonnet cramoisi',
      icon: '🐉',
      imageFile: null,
      baseStats: { hp: 580, auto: 52, def: 44, cap: 48, rescap: 44, spd: 46 },
    },
    {
      id: 'coop_red_blinde',
      nom: 'Blindé marécageux',
      icon: '🛡️',
      imageFile: null,
      baseStats: { hp: 640, auto: 48, def: 56, cap: 40, rescap: 50, spd: 38 },
    },
    {
      id: 'coop_red_flore',
      nom: 'Florézilla',
      icon: '🌸',
      imageFile: null,
      baseStats: { hp: 560, auto: 46, def: 42, cap: 54, rescap: 48, spd: 44 },
    },
  ],
};

export function getCoopRedLineup(difficulty) {
  return coopRedBossLineups[difficulty] || null;
}

export function getCoopRedDropRate(difficulty) {
  return COOP_RED_DROP_RATE[difficulty] ?? 0.25;
}

/**
 * Objet combattant brut compatible preparerCombattant (boss).
 */
export function coopRedBossDefToCombatant(def) {
  if (!def) return null;
  return {
    name: def.nom,
    race: 'Boss',
    class: 'Boss',
    isBoss: true,
    bossId: def.id,
    imageFile: def.imageFile,
    base: { ...def.baseStats },
    bonuses: { race: {}, class: {} },
    currentHP: def.baseStats.hp,
    maxHP: def.baseStats.hp,
    userId: `coop-boss-${def.id}`,
    level: 1,
    equippedWeaponId: null,
    equippedWeaponData: null,
    mageTowerPassive: null,
    forestBoosts: {},
    additionalAwakeningRaces: [],
    ability: null,
    passive: null,
  };
}

export function buildCoopRedBossCombatants(difficulty) {
  const lineup = getCoopRedLineup(difficulty);
  if (!lineup) return [];
  return lineup.map(coopRedBossDefToCombatant);
}
