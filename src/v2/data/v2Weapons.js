/**
 * Armes V2 — chaque arme donne un sort (kit).
 * Rareté = drop du donjon d’armes (étage 1/2/3).
 */

export const V2_WEAPON_RARITY = {
  COMMUNE: 'commune',
  RARE: 'rare',
  LEGENDAIRE: 'légendaire',
};

export const V2_WEAPON_RARITY_LABEL = {
  [V2_WEAPON_RARITY.COMMUNE]: 'Commune',
  [V2_WEAPON_RARITY.RARE]: 'Rare',
  [V2_WEAPON_RARITY.LEGENDAIRE]: 'Légendaire',
};

/** Ids de sorts d’armes (définis dans v2Kit / enregistrés ici pour le catalogue). */
export const V2_WEAPON_SPELL_IDS = {
  COUPE_NETTE: 'coupe_nette',
  ECLAT_ARDENT: 'eclat_ardent',
  LANCE_FRACTURE: 'lance_fracture',
  ORBE_GLACE: 'orbe_glace',
  PLUIE_CELESTE: 'pluie_celeste',
  LAME_DU_ROI: 'lame_du_roi',
};

/**
 * @typedef {object} V2Weapon
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} rarity
 * @property {string} spellId
 * @property {string} description
 */

export const V2_WEAPONS = {
  epee_rouillee_v2: {
    id: 'epee_rouillee_v2',
    name: 'Épée rouillée',
    icon: '🗡️',
    rarity: V2_WEAPON_RARITY.COMMUNE,
    spellId: V2_WEAPON_SPELL_IDS.COUPE_NETTE,
    description: 'Sort Coupe nette — physique, Auto.',
  },
  baguette_braise_v2: {
    id: 'baguette_braise_v2',
    name: 'Baguette braise',
    icon: '🪄',
    rarity: V2_WEAPON_RARITY.COMMUNE,
    spellId: V2_WEAPON_SPELL_IDS.ECLAT_ARDENT,
    description: 'Sort Éclat ardent — magique, Cap.',
  },
  lance_brisee_v2: {
    id: 'lance_brisee_v2',
    name: 'Lance brisée',
    icon: '🔱',
    rarity: V2_WEAPON_RARITY.RARE,
    spellId: V2_WEAPON_SPELL_IDS.LANCE_FRACTURE,
    description: 'Sort Lance fracturée — physique, Auto + 20 % Cap.',
  },
  orbe_givre_v2: {
    id: 'orbe_givre_v2',
    name: 'Orbe de givre',
    icon: '❄️',
    rarity: V2_WEAPON_RARITY.RARE,
    spellId: V2_WEAPON_SPELL_IDS.ORBE_GLACE,
    description: 'Sort Orbe de glace — magique, Auto + 60 % Cap.',
  },
  arc_des_cieux_v2: {
    id: 'arc_des_cieux_v2',
    name: 'Arc des Cieux',
    icon: '🌟',
    rarity: V2_WEAPON_RARITY.LEGENDAIRE,
    spellId: V2_WEAPON_SPELL_IDS.PLUIE_CELESTE,
    description: 'Sort Pluie Céleste — physique, double tir.',
  },
  lame_du_roi_v2: {
    id: 'lame_du_roi_v2',
    name: 'Lame du Roi',
    icon: '⚔️',
    rarity: V2_WEAPON_RARITY.LEGENDAIRE,
    spellId: V2_WEAPON_SPELL_IDS.LAME_DU_ROI,
    description: 'Sort Lame du Roi — physique, Auto + 40 % DEF.',
  },
};

/** Arme de départ du proto. */
export const V2_DEFAULT_WEAPON_ID = 'arc_des_cieux_v2';

export function getV2Weapon(weaponId) {
  return V2_WEAPONS[weaponId] || null;
}

export function getWeaponsByRarity(rarity) {
  return Object.values(V2_WEAPONS).filter((w) => w.rarity === rarity);
}

/** Tire `count` armes (avec remise) de la rareté donnée. */
export function rollWeaponLoot(rarity, count = 3) {
  const pool = getWeaponsByRarity(rarity);
  if (!pool.length) return [];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return out;
}
