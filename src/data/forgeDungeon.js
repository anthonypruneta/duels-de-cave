/**
 * Données du donjon Forge des Légendes
 *
 * Boss unique : Ornn, le Dieu de la Forge
 * Accessible uniquement avec une arme légendaire équipée.
 * Récompense : upgrade d'arme en % sur les stats de l'arme équipée.
 */

import { getWeaponById } from './weapons';

export const FORGE_BOSS = {
  id: 'ornn',
  nom: 'Ornn, le Dieu de la Forge',
  icon: '🔨',
  imageFile: 'Ornn, le Dieu de la Forge.png',
  stats: {
    hp: 450,
    auto: 100,
    def: 100,
    cap: 100,
    rescap: 100,
    spd: 100,
  },
  ability: {
    type: 'forge_god_spell',
    name: 'Appel du dieu de la forge',
    description: 'Inflige Auto + 50% CAP et étourdit la cible pendant 1 tour. Cooldown: 5 tours.',
    cooldown: 5,
    effect: {
      capScale: 0.5,     // 50% CAP ajouté aux dégâts
      stunDuration: 1,    // Stun 1 tour
    },
  },
};

/**
 * Labels des stats pour l'affichage des upgrades Forge (partagé partout)
 */
export const FORGE_STAT_LABELS = {
  auto: 'Auto',
  spd: 'VIT',
  cap: 'CAP',
  hp: 'HP',
  def: 'DEF',
  rescap: 'RESC',
};

/**
 * Extrait bonus et malus % d'un roll d'upgrade (nouveau format + legacy)
 */
export function extractForgeUpgrade(roll) {
  if (!roll) return { bonuses: {}, penalties: {} };
  if (roll.statBonusesPct || roll.statPenaltyPct) {
    return {
      bonuses: { ...(roll.statBonusesPct || {}) },
      penalties: { ...(roll.statPenaltyPct || {}) },
    };
  }
  const bonuses = {};
  const penalties = {};
  if (roll.upgradeAutoPct) bonuses.auto = roll.upgradeAutoPct;
  if (roll.upgradeVitPct) bonuses.spd = roll.upgradeVitPct;
  if (roll.upgradeVitPenaltyPct) penalties.spd = roll.upgradeVitPenaltyPct;
  return { bonuses, penalties };
}

/**
 * Indique si le roll contient au moins un bonus ou un malus
 */
export function hasAnyForgeUpgrade(roll) {
  const { bonuses, penalties } = extractForgeUpgrade(roll);
  return Object.values(bonuses).some((v) => v > 0) || Object.values(penalties).some((v) => v > 0);
}

/**
 * Plages de % pour les upgrades d'armes (tirage aléatoire)
 */
export const UPGRADE_RANGES = {
  positivePct: { min: 0.10, max: 0.20 },
  negativePctByWeapon: {
    epee_legendaire: { spd: { min: 0, max: 0.10 } },
    marteau_legendaire: { spd: { min: 0, max: 0.05 } },
  },
  negativePctDefault: { min: 0, max: 0.10 },
};

const rollPct = (range) => parseFloat((Math.random() * (range.max - range.min) + range.min).toFixed(4));

const rollPctWithRng = (range, rng) =>
  parseFloat((rng() * (range.max - range.min) + range.min).toFixed(4));

/**
 * Génère un roll d'upgrade aléatoire pour une arme légendaire.
 * Les % sont appliqués aux stats totales du personnage (voir applyForgeUpgrade dans weaponEffects).
 * @param {string} weaponId - ID de l'arme légendaire équipée
 * @returns {{ statBonusesPct: Object<string, number>, statPenaltyPct: Object<string, number> }}
 */
export function generateForgeUpgradeRoll(weaponId) {
  const weapon = getWeaponById(weaponId);
  if (!weapon?.stats) {
    return { statBonusesPct: {}, statPenaltyPct: {} };
  }

  const { positivePct, negativePctByWeapon, negativePctDefault } = UPGRADE_RANGES;
  const statBonusesPct = {};
  const statPenaltyPct = {};

  for (const [statKey, statValue] of Object.entries(weapon.stats)) {
    if (statValue > 0) {
      statBonusesPct[statKey] = rollPct(positivePct);
    } else if (statValue < 0) {
      const range = negativePctByWeapon[weaponId]?.[statKey] || negativePctDefault;
      statPenaltyPct[statKey] = rollPct(range);
    }
  }

  return {
    statBonusesPct,
    statPenaltyPct,
  };
}

/**
 * Même logique que generateForgeUpgradeRoll mais avec un RNG déterministe (ex. labyrinthe hebdo).
 * @param {string} weaponId - ID de l'arme légendaire
 * @param {function(): number} rng - Fonction retournant un nombre dans [0, 1)
 * @returns {{ statBonusesPct: Object<string, number>, statPenaltyPct: Object<string, number> }}
 */
export function generateForgeUpgradeRollSeeded(weaponId, rng) {
  const weapon = getWeaponById(weaponId);
  if (!weapon?.stats || !rng) {
    return { statBonusesPct: {}, statPenaltyPct: {} };
  }

  const { positivePct, negativePctByWeapon, negativePctDefault } = UPGRADE_RANGES;
  const statBonusesPct = {};
  const statPenaltyPct = {};

  for (const [statKey, statValue] of Object.entries(weapon.stats)) {
    if (statValue > 0) {
      statBonusesPct[statKey] = rollPctWithRng(positivePct, rng);
    } else if (statValue < 0) {
      const range = negativePctByWeapon[weaponId]?.[statKey] || negativePctDefault;
      statPenaltyPct[statKey] = rollPctWithRng(range, rng);
    }
  }

  return {
    statBonusesPct,
    statPenaltyPct,
  };
}

/**
 * Crée le combattant Ornn pour le combat
 */
export function createForgeBossCombatant() {
  return {
    name: FORGE_BOSS.nom,
    bossId: FORGE_BOSS.id,
    isBoss: true,
    base: { ...FORGE_BOSS.stats },
    currentHP: FORGE_BOSS.stats.hp,
    maxHP: FORGE_BOSS.stats.hp,
    ability: FORGE_BOSS.ability,
    imageFile: FORGE_BOSS.imageFile,
    cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0, succ: 0, bast: 0, boss_ability: 0 },
    undead: false,
    dodge: false,
    reflect: false,
    bleed_stacks: 0,
    bleedPercentPerStack: 0,
    maso_taken: 0,
    familiarStacks: 0,
    shield: 0,
    spectralMarked: false,
    spectralMarkBonus: 0,
    stunned: false,
    stunnedTurns: 0,
    _labrysBleedPercent: 0,
  };
}

/**
 * Formate un % d'upgrade pour l'affichage
 */
export function formatUpgradePct(value) {
  const pct = (value * 100).toFixed(1);
  return `${pct.endsWith('.0') ? pct.slice(0, -2) : pct}%`;
}

/**
 * Calcule le gain (ou perte) réel en points de stat appliqué par la Forge.
 * Même ordre que applyForgeUpgrade : bonus puis malus.
 * @param {number} valueBeforeForge - Valeur de la stat avant application Forge
 * @param {number} bonusPct - Bonus (ex. 0.15 pour +15%)
 * @param {number} penaltyPct - Malus (ex. 0.10 pour -10%)
 * @returns {number} Delta (ex. +12 ou -5)
 */
export function computeForgeStatDelta(valueBeforeForge, bonusPct = 0, penaltyPct = 0) {
  if (valueBeforeForge == null || (!bonusPct && !penaltyPct)) return 0;
  const afterBonus = bonusPct ? Math.round(valueBeforeForge * (1 + bonusPct)) : valueBeforeForge;
  const afterPenalty = penaltyPct ? Math.round(afterBonus * (1 - penaltyPct)) : afterBonus;
  return afterPenalty - valueBeforeForge;
}
