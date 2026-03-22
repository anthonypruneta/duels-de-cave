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

/** Intensité du Pointeau ADN : fraction de l’éveil de la race tirée (passifs numériques). */
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
      moveDisplay: {
        name: 'Lance-Flammes',
        description:
          'Attaque physique à chaque action. Inflige une brûlure : perte de PV chaque tour (fraction des PV max).',
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
      moveDisplay: {
        name: 'Pistolet à O',
        description:
          'Toutes les 2 actions : salve magique avec fort bonus de Cap sur ce tour — dégâts magiques accentués.',
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
      moveDisplay: {
        name: 'Vampigraine',
        description:
          'Toutes les 3 actions : sort magique avec vol de vie sur une fraction des PV max des cibles (effet Vampigraine).',
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
      moveDisplay: {
        name: 'Fatal-Foudre',
        description:
          'Toutes les 5 actions : foudre magique ; peut étourdir un joueur pendant un tour (ne joue pas ce tour-là).',
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
      moveDisplay: {
        name: 'Repos',
        description:
          'Une fois par combat : récupération massive, puis le boss s’endort (ne joue pas pendant 2 tours).',
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
      moveDisplay: {
        name: 'Voile Aurore',
        description:
          'Toutes les 5 actions : vague magique puis protection — dégâts subis réduits pendant plusieurs tours (effet « aurore »).',
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
      moveDisplay: {
        name: 'Danse du Feu',
        description:
          'Phase finale : attaques type arène (même règles que le PvP) — mélange de coups physiques et magiques.',
      },
    },
    {
      id: 'coop_red_blinde',
      nom: 'Tortank',
      icon: '🛡️',
      // Pas de sprite Tortank dans le dossier pour l’instant : même ligne que Carapuce (à remplacer par Tortank.png).
      imageFile: 'Carapuce.png',
      baseStats: { hp: 640, auto: 48, def: 56, cap: 40, rescap: 50, spd: 38 },
      moveDisplay: {
        name: 'Lame de Roc',
        description:
          'Mur défensif : privilégie Auto et Défense ; enchaîne des frappes physiques sous le même moteur que le PvP.',
      },
    },
    {
      id: 'coop_red_flore',
      nom: 'Florizarre',
      icon: '🌸',
      imageFile: 'Florizarre.png',
      baseStats: { hp: 560, auto: 46, def: 42, cap: 54, rescap: 48, spd: 44 },
      moveDisplay: {
        name: 'Tempête Verte',
        description:
          'Équilibré Cap / ResC : sorts et touches magiques fréquents, cadence identique aux combats joueur contre joueur.',
      },
    },
  ],
};

/**
 * Texte affiché sur les cartes (sort signature + recharge) à partir de la fiche boss Red.
 * @param {object|null} def — entrée de coopRedBossLineups
 * @returns {{ name: string, description: string, cooldownLabel: string|null }|null}
 */
export function getCoopRedBossMoveDisplay(def) {
  if (!def?.moveDisplay?.name || !def.moveDisplay.description) return null;
  const cd = def.ability?.cooldown;
  let cooldownLabel = null;
  if (def.ability == null) {
    cooldownLabel = 'Style PvP — pas de sort à recharge fixe';
  } else if (def.ability?.effect?.oncePerCombat && typeof cd === 'number' && cd > 0) {
    cooldownLabel = `1× par combat (après ${cd} tour${cd > 1 ? 's' : ''} de jauge)`;
  } else if (cd === 0) {
    cooldownLabel = 'Sans recharge (chaque action)';
  } else if (typeof cd === 'number' && cd > 0) {
    cooldownLabel = `Recharge : ${cd} tour${cd > 1 ? 's' : ''}`;
  }
  return {
    name: def.moveDisplay.name,
    description: def.moveDisplay.description,
    cooldownLabel,
  };
}

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
