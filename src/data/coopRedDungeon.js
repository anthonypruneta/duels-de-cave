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

/** Pointeau ADN — Cendrés : 1 braise / 20% PV max cumulés ; +5% par braise ; pas de braise garantie au tour. */
export const COOP_CENDRES_ECHO_HP_THRESHOLD = 0.20;
export const COOP_CENDRES_ECHO_BRAISE_MULT = 0.05;
export const COOP_CENDRES_ECHO_GUARANTEED = 0;

/** Pointeau ADN — Écailleux : +1 % VIT / +1 % ResC (réf. début de combat) par dégât de capacité sur les PV (pas de scaling % de l’éveil). */
export const COOP_ECAILLEUX_ECHO_REF_STAT_PERCENT = 0.01;

/** Pointeau ADN — Écailleux : lien VIT ↔ ResC à 1 pour 6. */
export const COOP_ECAILLEUX_ECHO_STAT_LINK_DIVISOR = 6;

export const COOP_RED_DIFFICULTY_LABELS = {
  [COOP_RED_DIFFICULTY.EASY]: 'Facile',
  [COOP_RED_DIFFICULTY.MEDIUM]: 'Moyen',
  [COOP_RED_DIFFICULTY.HARD]: 'Difficile',
};

/** Multiplicateur appliqué aux baseStats des boss Pokémon au moment du combat (valeurs de base = fiche ci-dessous). +10 % vs l’ancien 1.2. */
export const COOP_RED_BOSS_STAT_MULT = {
  [COOP_RED_DIFFICULTY.EASY]: 1.32,
  [COOP_RED_DIFFICULTY.MEDIUM]: 1.32,
  [COOP_RED_DIFFICULTY.HARD]: 1.32,
};

/** Stats affichées / combat après multiplicateur de difficulté (+10 % / +5 % / −5 %). */
export function scaleCoopRedBossBaseStats(baseStats, difficulty) {
  const mult = COOP_RED_BOSS_STAT_MULT[difficulty] ?? 1;
  const r = (n) => Math.max(1, Math.round(Number(n) * mult));
  return {
    hp: r(baseStats.hp),
    auto: r(baseStats.auto),
    def: r(baseStats.def),
    cap: r(baseStats.cap),
    rescap: r(baseStats.rescap),
    spd: r(baseStats.spd),
  };
}

/**
 * Lignes de boss par difficulté : ordre de rotation (0 → 1 → 2).
 * baseStats de référence par palier ; au combat, `scaleCoopRedBossBaseStats` applique `COOP_RED_BOSS_STAT_MULT`.
 */
export const coopRedBossLineups = {
  [COOP_RED_DIFFICULTY.EASY]: [
    {
      id: 'coop_red_salamandre',
      nom: 'Salamèche',
      icon: '🔥',
      imageFile: 'salameche.png',
      baseStats: { hp: 162, auto: 47, def: 34, cap: 43, rescap: 34, spd: 43 },
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
          'À chaque action : inflige des dégâts physiques. Applique Brûlure : la cible perd 1% de ses PV max par tour.',
      },
    },
    {
      id: 'coop_red_carapace',
      nom: 'Carapuce',
      icon: '💧',
      imageFile: 'carapuce.png',
      baseStats: { hp: 221, auto: 38, def: 47, cap: 43, rescap: 38, spd: 34 },
      ability: {
        cooldown: 2,
        effect: { capBonusRatio: 0.35 },
      },
      moveDisplay: {
        name: 'Pistolet à O',
        description:
          'Recharge 2 tours : inflige des dégâts magiques (Auto + 35% CAP).',
      },
    },
    {
      id: 'coop_red_pousse',
      nom: 'Bulbizarre',
      icon: '🌿',
      imageFile: 'bulbizarre.png',
      baseStats: { hp: 204, auto: 38, def: 43, cap: 51, rescap: 47, spd: 34 },
      ability: {
        cooldown: 3,
        effect: { capScale: 1, leechMaxHpPercent: 0.01 },
      },
      moveDisplay: {
        name: 'Vampigraine',
        description:
          'Recharge 3 tours : inflige des dégâts magiques (Auto + 100% CAP). Applique Vampigraine : 1% PV max volés chaque tour.',
      },
    },
  ],
  [COOP_RED_DIFFICULTY.MEDIUM]: [
    {
      id: 'coop_red_foudre',
      nom: 'Pikachu',
      icon: '⚡',
      imageFile: 'pikachu.png',
      baseStats: { hp: 340, auto: 55, def: 43, cap: 55, rescap: 43, spd: 77 },
      ability: {
        cooldown: 5,
        effect: { capScale: 0.3, stunDuration: 1 },
      },
      moveDisplay: {
        name: 'Fatal-Foudre',
        description:
          'Recharge 5 tours : inflige des dégâts magiques (Auto + 30% CAP) et étourdit 1 tour.',
      },
    },
    {
      id: 'coop_red_dormeur',
      nom: 'Ronflex',
      icon: '😴',
      imageFile: 'ronflex.png',
      baseStats: { hp: 680, auto: 68, def: 60, cap: 43, rescap: 43, spd: 17 },
      ability: {
        cooldown: 6,
        effect: { oncePerCombat: true, selfStunTurns: 2 },
      },
      moveDisplay: {
        name: 'Repos',
        description:
          '1 fois par combat : restaure fortement ses PV, puis s’endort pendant 2 tours.',
      },
    },
    {
      id: 'coop_red_lagon',
      nom: 'Lokhlass',
      icon: '🌊',
      imageFile: 'lokhlass.png',
      baseStats: { hp: 468, auto: 43, def: 51, cap: 68, rescap: 60, spd: 47 },
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
          'Recharge 5 tours : inflige des dégâts magiques (Auto + 100% CAP), puis réduit les dégâts subis des autres boss de 30% pendant 2 tours.',
      },
    },
  ],
  [COOP_RED_DIFFICULTY.HARD]: [
    {
      id: 'coop_red_dragonnet',
      nom: 'Dracaufeu',
      icon: '🐉',
      imageFile: 'dracaufeu.png',
      // Nerf balance : -10% stats de base (avant multiplicateur de difficulté).
      baseStats: { hp: 574, auto: 77, def: 61, cap: 69, rescap: 54, spd: 69 },
      ability: {
        cooldown: 4,
        effect: { capScale: 0.3 },
      },
      moveDisplay: {
        name: 'Déflagration',
        description:
          'Recharge 4 tours : inflige des dégâts magiques de zone (Auto + 30% CAP) à tous les joueurs vivants.',
      },
    },
    {
      id: 'coop_red_blinde',
      nom: 'Tortank',
      icon: '🛡️',
      imageFile: 'tortank.png',
      // Nerf balance : -10% stats de base (avant multiplicateur de difficulté).
      baseStats: { hp: 612, auto: 85, def: 77, cap: 54, rescap: 61, spd: 50 },
      ability: {
        cooldown: 3,
        effect: { capScale: 0.1 },
      },
      moveDisplay: {
        name: 'Aqua-jet',
        description:
          'Recharge 3 tours : inflige des dégâts magiques (Auto + 10% CAP). Quand prêt, Tortank joue en premier.',
      },
    },
    {
      id: 'coop_red_flore',
      nom: 'Florizarre',
      icon: '🌸',
      imageFile: 'florizarre.png',
      // Nerf balance : -10% stats de base (avant multiplicateur de difficulté).
      baseStats: { hp: 689, auto: 65, def: 85, cap: 77, rescap: 77, spd: 39 },
      ability: {
        cooldown: 5,
        effect: { capScale: 1 },
      },
      moveDisplay: {
        name: 'Lance-soleil',
        description:
          'Recharge 5 tours : charge 1 action, puis inflige des dégâts magiques (Auto + 100% CAP) à l’action suivante.',
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
 * @param {string} difficulty — COOP_RED_DIFFICULTY : applique COOP_RED_BOSS_STAT_MULT sur les stats.
 */
export function coopRedBossDefToCombatant(def, difficulty) {
  if (!def) return null;
  const characterImage = def.imageFile ? getCoopRedSpriteUrl(def.imageFile) : null;
  const scaled = scaleCoopRedBossBaseStats(def.baseStats, difficulty);
  return {
    name: def.nom,
    race: 'Boss',
    class: 'Boss',
    isBoss: true,
    bossId: def.id,
    imageFile: def.imageFile,
    characterImage,
    base: { ...scaled },
    bonuses: { race: {}, class: {} },
    currentHP: scaled.hp,
    maxHP: scaled.hp,
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
  return lineup.map((def) => coopRedBossDefToCombatant(def, difficulty));
}
