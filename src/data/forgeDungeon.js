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
 * Plages de % pour les upgrades d'armes
 */
export const UPGRADE_RANGES = {
  // Bonus standard pour les stats positives de l'arme légendaire équipée
  positivePct: { min: 0.10, max: 0.20 },

  // Fluctuation négative pour les stats négatives de l'arme
  // (pas de bonus positif sur ces stats)
  negativePctByWeapon: {
    epee_legendaire: { spd: { min: 0, max: 0.10 } },
    marteau_legendaire: { spd: { min: 0, max: 0.05 } },
  },

  // Fallback si une future arme a une stat négative sans configuration dédiée
  negativePctDefault: { min: 0, max: 0.10 },
};

const rollPct = (range) => parseFloat((Math.random() * (range.max - range.min) + range.min).toFixed(4));

/**
 * Génère un roll d'upgrade aléatoire pour une arme légendaire
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
      continue;
    }

    if (statValue < 0) {
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
