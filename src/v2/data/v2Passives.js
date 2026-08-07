/**
 * Passifs V2 — jusqu’à 2 emplacements (carte / kit).
 * Chaque passif peut donner un sort utilisable en rotation.
 */

export const V2_PASSIVE_SPELL_IDS = {
  STIGMATE: 'stigmate',
};

export const V2_PASSIVES = {
  marque_du_martyr_v2: {
    id: 'marque_du_martyr_v2',
    name: 'Marque du Martyr',
    icon: '💠',
    spellId: V2_PASSIVE_SPELL_IDS.STIGMATE,
    description: 'Sort Stigmate — débuff +15 % dégâts reçus (4 tours).',
  },
};

export const V2_DEFAULT_PASSIVE_ID = 'marque_du_martyr_v2';
export const V2_PASSIVE_SLOT_COUNT = 2;

export function getV2Passive(passiveId) {
  return V2_PASSIVES[passiveId] || null;
}

/** Normalise [id|null, id|null] (longueur 2). */
export function normalizePassiveIds(prototypeOrIds) {
  let raw = [];
  if (Array.isArray(prototypeOrIds)) {
    raw = prototypeOrIds;
  } else if (Array.isArray(prototypeOrIds?.passiveIds)) {
    raw = prototypeOrIds.passiveIds;
  } else if (prototypeOrIds?.passiveId) {
    raw = [prototypeOrIds.passiveId];
  } else {
    raw = [V2_DEFAULT_PASSIVE_ID];
  }
  const out = [null, null];
  for (let i = 0; i < V2_PASSIVE_SLOT_COUNT; i += 1) {
    const id = raw[i];
    out[i] = id && V2_PASSIVES[id] ? id : null;
  }
  if (!out[0] && !out[1]) out[0] = V2_DEFAULT_PASSIVE_ID;
  return out;
}

export function getEquippedPassiveSpellIds(prototype) {
  return normalizePassiveIds(prototype)
    .map((id) => (id ? V2_PASSIVES[id]?.spellId : null))
    .filter(Boolean);
}
