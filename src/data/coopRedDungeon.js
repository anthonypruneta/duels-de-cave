/**
 * Donjon coop « Red » — 3 difficultés, 3 adversaires en rotation par run.
 * Noms & sprites Pokémon (FR) — images dans src/assets/coop/.
 */

import { getCoopRedSpriteUrl } from '../utils/coopRedSprites.js';

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

export const COOP_RED_MAX_ATTEMPTS_PER_DAY = 3;

/** Chances de pointeau par joueur après victoire Red (tirages indépendants). */
export const COOP_RED_DROP_RATE = {
  [COOP_RED_DIFFICULTY.EASY]: 0.15,
  [COOP_RED_DIFFICULTY.MEDIUM]: 0.25,
  [COOP_RED_DIFFICULTY.HARD]: 0.45,
};

/** Intensité de l’écho racial gravé : fraction de l’éveil de la race de l’allié (passifs numériques). */
export const COOP_RACE_ECHO_POTENCY = 0.25;

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
      nom: 'Salamèche',
      icon: '🔥',
      imageFile: 'Salameche.png',
      baseStats: { hp: 190, auto: 55, def: 40, cap: 50, rescap: 40, spd: 50 },
      /** Pas de CD : chaque attaque = Lance-Flammes (physique) + brûlure. */
      ability: {
        cooldown: 0,
        effect: {
          burnAutoMult: 0.9,
          burnHpPerTurnPercent: 0.01,
        },
      },
    },
    {
      id: 'coop_red_carapace',
      nom: 'Carapuce',
      icon: '💧',
      imageFile: 'Carapuce.png',
      baseStats: { hp: 260, auto: 45, def: 55, cap: 50, rescap: 45, spd: 40 },
      ability: {
        cooldown: 2,
        effect: { capBonusRatio: 0.35 },
      },
    },
    {
      id: 'coop_red_pousse',
      nom: 'Bulbizarre',
      icon: '🌿',
      imageFile: 'Bulbizarre.png',
      baseStats: { hp: 240, auto: 45, def: 50, cap: 60, rescap: 55, spd: 40 },
      ability: {
        cooldown: 3,
        effect: { capScale: 1, leechMaxHpPercent: 0.01 },
      },
    },
  ],
  [COOP_RED_DIFFICULTY.MEDIUM]: [
    {
      id: 'coop_red_foudre',
      nom: 'Pikachu',
      icon: '⚡',
      imageFile: 'Pikachu.png',
      baseStats: { hp: 400, auto: 65, def: 50, cap: 65, rescap: 50, spd: 90 },
      ability: {
        cooldown: 5,
        effect: { capScale: 0.3, stunDuration: 1 },
      },
    },
    {
      id: 'coop_red_dormeur',
      nom: 'Ronflex',
      icon: '😴',
      imageFile: 'Ronflex.png',
      baseStats: { hp: 800, auto: 80, def: 70, cap: 50, rescap: 50, spd: 20 },
      ability: {
        cooldown: 6,
        effect: { oncePerCombat: true, selfStunTurns: 2 },
      },
    },
    {
      id: 'coop_red_lagon',
      nom: 'Lokhlass',
      icon: '🌊',
      imageFile: 'Lokhlass.png',
      baseStats: { hp: 550, auto: 50, def: 60, cap: 80, rescap: 70, spd: 55 },
      ability: {
        cooldown: 5,
        effect: {
          capScale: 1,
          teamDamageReduction: 0.3,
          teamReductionTurns: 2,
        },
      },
    },
  ],
  [COOP_RED_DIFFICULTY.HARD]: [
    {
      id: 'coop_red_dragonnet',
      nom: 'Dracaufeu',
      icon: '🐉',
      imageFile: 'Dracaufeu.png',
      baseStats: { hp: 580, auto: 52, def: 44, cap: 48, rescap: 44, spd: 46 },
    },
    {
      id: 'coop_red_blinde',
      nom: 'Tortank',
      icon: '🛡️',
      // Pas de sprite Tortank dans le dossier pour l’instant : même ligne que Carapuce (à remplacer par Tortank.png).
      imageFile: 'Carapuce.png',
      baseStats: { hp: 640, auto: 48, def: 56, cap: 40, rescap: 50, spd: 38 },
    },
    {
      id: 'coop_red_flore',
      nom: 'Florizarre',
      icon: '🌸',
      imageFile: 'Florizarre.png',
      baseStats: { hp: 560, auto: 46, def: 42, cap: 54, rescap: 48, spd: 44 },
    },
  ],
};

export function getCoopRedLineup(difficulty) {
  return coopRedBossLineups[difficulty] || null;
}

/**
 * Objet combattant brut compatible preparerCombattant (boss).
 */
export function coopRedBossDefToCombatant(def) {
  if (!def) return null;
  const characterImage = def.imageFile ? getCoopRedSpriteUrl(def.imageFile) : null;
  return {
    name: def.nom,
    race: 'Boss',
    class: 'Boss',
    isBoss: true,
    bossId: def.id,
    imageFile: def.imageFile,
    characterImage,
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
    ability: def.ability ? { ...def.ability, effect: def.ability.effect ? { ...def.ability.effect } : {} } : null,
    passive: null,
  };
}

export function buildCoopRedBossCombatants(difficulty) {
  const lineup = getCoopRedLineup(difficulty);
  if (!lineup) return [];
  return lineup.map(coopRedBossDefToCombatant);
}
