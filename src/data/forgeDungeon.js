/**
 * Données du donjon Forge des Légendes
 *
 * Boss unique : Ornn, le Dieu de la Forge
 * Accessible uniquement avec une arme légendaire équipée.
 * Récompense : upgrade d'arme en % sur les stats totales du personnage.
 */

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
  // Bonus standard pour toutes les armes légendaires
  autoPct: { min: 0.10, max: 0.20 },   // Auto +10% à +20%
  vitPct: { min: 0.10, max: 0.20 },     // Vit +10% à +20%

  // Pénalités VIT spécifiques aux armes lourdes
  vitPenalty: {
    epee_legendaire: { min: 0, max: 0.10 },     // Zweihänder: 0-10%
    marteau_legendaire: { min: 0, max: 0.05 },   // Mjöllnir: 0-5%
  },
};

/**
 * Génère un roll d'upgrade aléatoire pour une arme légendaire
 * @param {string} weaponId - ID de l'arme légendaire équipée
 * @returns {{ upgradeAutoPct: number, upgradeVitPct: number, upgradeVitPenaltyPct: number }}
 */
export function generateForgeUpgradeRoll(weaponId) {
  const { autoPct, vitPct, vitPenalty } = UPGRADE_RANGES;

  const upgradeAutoPct = parseFloat(
    (Math.random() * (autoPct.max - autoPct.min) + autoPct.min).toFixed(4)
  );
  const upgradeVitPct = parseFloat(
    (Math.random() * (vitPct.max - vitPct.min) + vitPct.min).toFixed(4)
  );

  let upgradeVitPenaltyPct = 0;
  const penaltyRange = vitPenalty[weaponId];
  if (penaltyRange) {
    upgradeVitPenaltyPct = parseFloat(
      (Math.random() * (penaltyRange.max - penaltyRange.min) + penaltyRange.min).toFixed(4)
    );
  }

  return {
    upgradeAutoPct,
    upgradeVitPct,
    upgradeVitPenaltyPct,
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
  return `${Math.round(value * 100)}%`;
}
