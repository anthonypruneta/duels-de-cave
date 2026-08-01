/**
 * Kit imposé du proto V2 — Revolte (Orc / Masochiste).
 * Uniquement ce personnage pour le sandbox.
 */

export const V2_MAX_LEVEL = 20;

export const V2_SPELL_IDS = {
  FUREUR_SANG: 'fureur_sang',
  PURGE_SANGLANTE: 'purge_sanglante',
  PLUIE_CELESTE: 'pluie_celeste',
  STIGMATE: 'stigmate',
};

export const V2_SPELLS = {
  [V2_SPELL_IDS.FUREUR_SANG]: {
    id: V2_SPELL_IDS.FUREUR_SANG,
    name: 'Fureur du sang',
    source: 'race',
    sourceLabel: 'Orc',
    icon: '🪓',
    description: 'Buff 3 tours : +25 % de dégâts si vos PV ≤ 50 %.',
  },
  [V2_SPELL_IDS.PURGE_SANGLANTE]: {
    id: V2_SPELL_IDS.PURGE_SANGLANTE,
    name: 'Purge sanglante',
    source: 'class',
    sourceLabel: 'Masochiste',
    icon: '🩸',
    description: 'Inflige 7 % des dégâts subis cumulés + 0,5 % Cap. Soigne 12 % de ce cumul, puis reset.',
  },
  [V2_SPELL_IDS.PLUIE_CELESTE]: {
    id: V2_SPELL_IDS.PLUIE_CELESTE,
    name: 'Pluie Céleste',
    source: 'weapon',
    sourceLabel: 'Arc des Cieux',
    icon: '🌟',
    description: 'Deux tirs : 100 % puis 70 % de votre Auto (physique).',
  },
  [V2_SPELL_IDS.STIGMATE]: {
    id: V2_SPELL_IDS.STIGMATE,
    name: 'Stigmate',
    source: 'passive',
    sourceLabel: 'Marque du Martyr',
    icon: '💠',
    description: 'Débuff ennemi 4 tours : +15 % de dégâts reçus.',
  },
};

export const V2_DEFAULT_SPELL_ORDER = [
  V2_SPELL_IDS.FUREUR_SANG,
  V2_SPELL_IDS.STIGMATE,
  V2_SPELL_IDS.PLUIE_CELESTE,
  V2_SPELL_IDS.PURGE_SANGLANTE,
];

/** Growth rates Fire Emblem-style (0–1), Orc + Masochiste. */
export const V2_GROWTH_RATES = {
  hp: 0.75,
  auto: 0.5,
  def: 0.45,
  cap: 0.35,
  rescap: 0.3,
  spd: 0.25,
};

/** +1 point FE : PV vaut +6 HP, le reste +1. */
export const V2_GROWTH_POINT_VALUES = {
  hp: 6,
  auto: 1,
  def: 1,
  cap: 1,
  rescap: 1,
  spd: 1,
};

export const V2_WEAPON = {
  id: 'arc_des_cieux_v2',
  name: 'Arc des Cieux',
  spellId: V2_SPELL_IDS.PLUIE_CELESTE,
  description: 'Arc légendaire adapté V2 — sort Pluie Céleste.',
};

export const V2_PASSIVE = {
  id: 'marque_du_martyr_v2',
  name: 'Marque du Martyr',
  spellId: V2_SPELL_IDS.STIGMATE,
  description: 'Passif adapté V2 — sort Stigmate.',
};

export const V2_IMPOSED_CHARACTER = {
  name: 'Revolte',
  race: 'Orc',
  class: 'Masochiste',
  gender: 'male',
  /** Image résolue depuis Firestore (annuaire) — pas de sprite repo. */
  characterImage: null,
  weaponId: V2_WEAPON.id,
  passiveId: V2_PASSIVE.id,
  /** Stats de départ (avant growth / lore). */
  base: {
    hp: 140,
    auto: 22,
    def: 18,
    cap: 20,
    rescap: 16,
    spd: 18,
  },
};

export const V2_STAT_KEYS = ['hp', 'auto', 'def', 'cap', 'rescap', 'spd'];

export const V2_STAT_LABELS = {
  hp: 'PV',
  auto: 'Auto',
  def: 'DEF',
  cap: 'CAP',
  rescap: 'ResC',
  spd: 'VIT',
};

export function getEmptyV2StatBlock() {
  return { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 };
}

export function mergeV2Stats(...blocks) {
  const out = getEmptyV2StatBlock();
  for (const block of blocks) {
    if (!block) continue;
    for (const key of V2_STAT_KEYS) {
      out[key] += Number(block[key]) || 0;
    }
  }
  return out;
}

export function computeFinalStats(prototype) {
  return mergeV2Stats(
    prototype?.base || V2_IMPOSED_CHARACTER.base,
    prototype?.growthGains,
    prototype?.loreBoosts
  );
}

export function getSpellById(spellId) {
  return V2_SPELLS[spellId] || null;
}
