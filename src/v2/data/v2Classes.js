/**
 * Classes V2 — sorts et constantes (source de vérité proto).
 *
 * damageType :
 * - 'phys' → mitigé par DEF
 * - 'mag'  → mitigé par ResC
 * - null   → pas de dégâts (utilitaire / soin)
 * Le scaling (Auto / Cap / …) est indépendant du type.
 */

export const V2_CLASS_SPELL_IDS = {
  FRAPPE_PENETRANTE: 'frappe_penetrante',
  ESQUIVE: 'esquive',
  RIPOSTE: 'riposte',
  SOIN_PUISSANT: 'soin_puissant',
  DOUBLE_TIR: 'double_tir',
  EXPLOSION_ARCANIQUE: 'explosion_arcanique',
  INVOCATION_FAMILIER: 'invocation_familier',
  PURGE_SANGLANTE: 'purge_sanglante',
  EGIDE_FRACTALE: 'egide_fractale',
  COUP_DE_FOUET: 'coup_de_fouet',
  CHARGE_REMPART: 'charge_rempart',
  FLASQUE_FEU: 'flasque_feu',
  FLASQUE_VIE: 'flasque_vie',
  FLASQUE_ACIDE: 'flasque_acide',
  MALEDICTION: 'malediction',
  RAGE: 'rage',
};

/** Sorts Alchimiste : une seule fois dans toute la rotation. */
export const V2_ONCE_IN_ROTATION_SPELLS = new Set([
  V2_CLASS_SPELL_IDS.FLASQUE_FEU,
  V2_CLASS_SPELL_IDS.FLASQUE_VIE,
  V2_CLASS_SPELL_IDS.FLASQUE_ACIDE,
]);

export const V2_CLASS_CONSTANTS = {
  guerrier: {
    ignoreBase: 0.3,
    ignorePerCap: 0.01,
  },
  voleur: {},
  paladin: {
    reflectBase: 0.45,
    reflectPerCap: 0.006,
  },
  healer: {
    missingHpPercent: 0.28,
    capScale: 0.43,
  },
  archer: {
    hit1AutoMultiplier: 1.0,
    hit2AutoMultiplier: 1.3,
    hit2CapMultiplier: 0.2,
  },
  mage: {
    autoBase: 1.0,
    capBase: 0.9,
  },
  demoniste: {
    familiarTurns: 4,
    familiarCapScale: 0.3,
  },
  masochiste: {
    returnBase: 0.07,
    returnPerCap: 0.005,
    healPercent: 0.12,
  },
  briseurSort: {
    shieldFromDamage: 0.4,
    antiHealReduction: 0.2,
    antiHealTurns: 3,
  },
  succube: {
    capScale: 0.45,
    nextAttackReduction: 0.5,
  },
  bastion: {
    startShieldFromDef: 0.3,
    capScale: 0.5,
    defScale: 0.5,
  },
  alchimiste: {
    fireCapScale: 0.1,
    lifeCapScale: 0.82,
    acidDefReduction: 0.1,
    acidRescReduction: 0.1,
  },
  sorciere: {
    curseStatReduction: 0.1,
    capBase: 0.7,
  },
  berserk: {
    rageHpCostPercent: 0.1,
    rageMissingHpDamageScale: 0.25,
    rageMissingHpScalePerCap: 0.001,
  },
};

/** Nom de classe → ids de sorts de classe (kit). */
export const V2_CLASS_SPELLS_BY_NAME = {
  Guerrier: [V2_CLASS_SPELL_IDS.FRAPPE_PENETRANTE],
  Voleur: [V2_CLASS_SPELL_IDS.ESQUIVE],
  Paladin: [V2_CLASS_SPELL_IDS.RIPOSTE],
  Healer: [V2_CLASS_SPELL_IDS.SOIN_PUISSANT],
  Archer: [V2_CLASS_SPELL_IDS.DOUBLE_TIR],
  Mage: [V2_CLASS_SPELL_IDS.EXPLOSION_ARCANIQUE],
  Demoniste: [V2_CLASS_SPELL_IDS.INVOCATION_FAMILIER],
  Masochiste: [V2_CLASS_SPELL_IDS.PURGE_SANGLANTE],
  'Briseur de Sort': [V2_CLASS_SPELL_IDS.EGIDE_FRACTALE],
  Succube: [V2_CLASS_SPELL_IDS.COUP_DE_FOUET],
  Bastion: [V2_CLASS_SPELL_IDS.CHARGE_REMPART],
  Alchimiste: [
    V2_CLASS_SPELL_IDS.FLASQUE_FEU,
    V2_CLASS_SPELL_IDS.FLASQUE_VIE,
    V2_CLASS_SPELL_IDS.FLASQUE_ACIDE,
  ],
  Sorcière: [V2_CLASS_SPELL_IDS.MALEDICTION],
  Berserk: [V2_CLASS_SPELL_IDS.RAGE],
};

export const V2_CLASS_SPELLS = {
  [V2_CLASS_SPELL_IDS.FRAPPE_PENETRANTE]: {
    id: V2_CLASS_SPELL_IDS.FRAPPE_PENETRANTE,
    name: 'Frappe pénétrante',
    source: 'class',
    sourceLabel: 'Guerrier',
    icon: '🗡️',
    damageType: 'phys',
    description:
      'Physique. Auto vs DEF. Ignore 30 % de la DEF (+ 1 %/Cap).',
  },
  [V2_CLASS_SPELL_IDS.ESQUIVE]: {
    id: V2_CLASS_SPELL_IDS.ESQUIVE,
    name: 'Esquive',
    source: 'class',
    sourceLabel: 'Voleur',
    icon: '🌀',
    damageType: 'util',
    description: 'Esquive totale : la prochaine action adverse ne fait rien.',
  },
  [V2_CLASS_SPELL_IDS.RIPOSTE]: {
    id: V2_CLASS_SPELL_IDS.RIPOSTE,
    name: 'Riposte',
    source: 'class',
    sourceLabel: 'Paladin',
    icon: '🛡️',
    damageType: 'mag',
    description:
      'Magique. Renvoie 45 % (+ 0,6 %/Cap) de la prochaine attaque reçue (vs ResC).',
  },
  [V2_CLASS_SPELL_IDS.SOIN_PUISSANT]: {
    id: V2_CLASS_SPELL_IDS.SOIN_PUISSANT,
    name: 'Soin puissant',
    source: 'class',
    sourceLabel: 'Healer',
    icon: '✚',
    damageType: 'heal',
    description: 'Soigne 28 % des PV manquants + 43 % Cap.',
  },
  [V2_CLASS_SPELL_IDS.DOUBLE_TIR]: {
    id: V2_CLASS_SPELL_IDS.DOUBLE_TIR,
    name: 'Double tir',
    source: 'class',
    sourceLabel: 'Archer',
    icon: '🏹',
    damageType: 'phys',
    description: 'Physique. 1er tir : 100 % Auto. 2e : 130 % Auto + 20 % Cap.',
  },
  [V2_CLASS_SPELL_IDS.EXPLOSION_ARCANIQUE]: {
    id: V2_CLASS_SPELL_IDS.EXPLOSION_ARCANIQUE,
    name: 'Explosion arcanique',
    source: 'class',
    sourceLabel: 'Mage',
    icon: '🔮',
    damageType: 'mag',
    description: 'Magique. 100 % Auto + 90 % Cap (vs ResC).',
  },
  [V2_CLASS_SPELL_IDS.INVOCATION_FAMILIER]: {
    id: V2_CLASS_SPELL_IDS.INVOCATION_FAMILIER,
    name: 'Invocation du familier',
    source: 'class',
    sourceLabel: 'Demoniste',
    icon: '💠',
    damageType: 'mag',
    description:
      'Magique. Familier 4 actions : chaque action ajoute +30 % Cap (vs ResC).',
  },
  [V2_CLASS_SPELL_IDS.PURGE_SANGLANTE]: {
    id: V2_CLASS_SPELL_IDS.PURGE_SANGLANTE,
    name: 'Purge sanglante',
    source: 'class',
    sourceLabel: 'Masochiste',
    icon: '🩸',
    damageType: 'mag',
    description:
      'Magique. 7 % du cumul (+ 0,5 %/Cap) vs ResC. Soigne 12 % du cumul.',
  },
  [V2_CLASS_SPELL_IDS.EGIDE_FRACTALE]: {
    id: V2_CLASS_SPELL_IDS.EGIDE_FRACTALE,
    name: 'Égide fractale',
    source: 'class',
    sourceLabel: 'Briseur de Sort',
    icon: '🧱',
    damageType: 'util',
    description:
      'Prochaine attaque reçue → bouclier 40 % des dégâts + anti-soin (−20 %) 3 tours.',
  },
  [V2_CLASS_SPELL_IDS.COUP_DE_FOUET]: {
    id: V2_CLASS_SPELL_IDS.COUP_DE_FOUET,
    name: 'Coup de Fouet',
    source: 'class',
    sourceLabel: 'Succube',
    icon: '💋',
    damageType: 'phys',
    description: 'Physique. Auto + 45 % Cap. Prochaine attaque adverse −50 %.',
  },
  [V2_CLASS_SPELL_IDS.CHARGE_REMPART]: {
    id: V2_CLASS_SPELL_IDS.CHARGE_REMPART,
    name: 'Charge du Rempart',
    source: 'class',
    sourceLabel: 'Bastion',
    icon: '🏰',
    damageType: 'phys',
    description:
      'Physique. Bouclier 30 % DEF puis Auto + 50 % Cap + 50 % DEF.',
  },
  [V2_CLASS_SPELL_IDS.FLASQUE_FEU]: {
    id: V2_CLASS_SPELL_IDS.FLASQUE_FEU,
    name: 'Flasque de feu',
    source: 'class',
    sourceLabel: 'Alchimiste',
    icon: '🔥',
    damageType: 'mag',
    onceInRotation: true,
    description:
      'Magique. Auto + 10 % Cap (vs ResC). Une seule fois dans toute la rotation.',
  },
  [V2_CLASS_SPELL_IDS.FLASQUE_VIE]: {
    id: V2_CLASS_SPELL_IDS.FLASQUE_VIE,
    name: 'Flasque de vie',
    source: 'class',
    sourceLabel: 'Alchimiste',
    icon: '💚',
    damageType: 'heal',
    onceInRotation: true,
    description: 'Soin égal à 82 % Cap. Une seule fois dans toute la rotation.',
  },
  [V2_CLASS_SPELL_IDS.FLASQUE_ACIDE]: {
    id: V2_CLASS_SPELL_IDS.FLASQUE_ACIDE,
    name: 'Flasque d’acide',
    source: 'class',
    sourceLabel: 'Alchimiste',
    icon: '🧪',
    damageType: 'mag',
    onceInRotation: true,
    description:
      'Magique. Auto (vs ResC) + −10 % DEF / −10 % ResC. Une seule fois dans toute la rotation.',
  },
  [V2_CLASS_SPELL_IDS.MALEDICTION]: {
    id: V2_CLASS_SPELL_IDS.MALEDICTION,
    name: 'Malédiction',
    source: 'class',
    sourceLabel: 'Sorcière',
    icon: '🕯️',
    damageType: 'mag',
    description:
      'Magique. −10 % d’une stat au hasard. Auto + 70 % Cap + points retirés (vs ResC).',
  },
  [V2_CLASS_SPELL_IDS.RAGE]: {
    id: V2_CLASS_SPELL_IDS.RAGE,
    name: 'Rage',
    source: 'class',
    sourceLabel: 'Berserk',
    icon: '🪓',
    damageType: 'phys',
    description:
      'Physique. Coût 10 % PV max. Auto + 25 % PV manquants (+ 0,1 %/Cap).',
  },
};

export function getClassSpellIds(className) {
  return V2_CLASS_SPELLS_BY_NAME[className] ? [...V2_CLASS_SPELLS_BY_NAME[className]] : [];
}

export function isOnceInRotationSpell(spellId) {
  return V2_ONCE_IN_ROTATION_SPELLS.has(spellId);
}
