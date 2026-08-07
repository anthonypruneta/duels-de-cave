/**
 * Kit proto V2 — arme / passifs / sorts de classe + sorts de base.
 * Les races sont des passifs (pas des sorts de rotation).
 */

import {
  V2_CLASS_SPELL_IDS,
  V2_CLASS_SPELLS,
  getClassSpellIds,
  isOnceInRotationSpell,
} from './v2Classes';
import {
  V2_DEFAULT_PASSIVE_ID,
  getEquippedPassiveSpellIds,
  getV2Passive,
  normalizePassiveIds,
} from './v2Passives';
import {
  V2_DEFAULT_WEAPON_ID,
  V2_WEAPON_SPELL_IDS,
  V2_WEAPONS,
  getV2Weapon,
} from './v2Weapons';

export const V2_MAX_LEVEL = 20;

export const V2_SPELL_IDS = {
  STIGMATE: 'stigmate',
  COUP_DE_PIED: 'coup_de_pied',
  CROCHET: 'crochet',
  COUP_DE_TETE: 'coup_de_tete',
  ...V2_WEAPON_SPELL_IDS,
  ...V2_CLASS_SPELL_IDS,
};

/** Sorts de base (tous les persos) — remplissage de cycle. */
export const V2_BASIC_SPELL_IDS = [
  V2_SPELL_IDS.COUP_DE_PIED,
  V2_SPELL_IDS.CROCHET,
  V2_SPELL_IDS.COUP_DE_TETE,
];

const V2_BASIC_SPELLS = {
  [V2_SPELL_IDS.COUP_DE_PIED]: {
    id: V2_SPELL_IDS.COUP_DE_PIED,
    name: 'Coup de pied',
    source: 'basic',
    sourceLabel: 'Base',
    icon: '🦵',
    damageType: 'phys',
    description: 'Physique. Inflige 100 % Auto (vs DEF).',
  },
  [V2_SPELL_IDS.CROCHET]: {
    id: V2_SPELL_IDS.CROCHET,
    name: 'Crochet',
    source: 'basic',
    sourceLabel: 'Base',
    icon: '👊',
    damageType: 'phys',
    description: 'Physique. Inflige 100 % Auto (vs DEF).',
  },
  [V2_SPELL_IDS.COUP_DE_TETE]: {
    id: V2_SPELL_IDS.COUP_DE_TETE,
    name: 'Coup de tête',
    source: 'basic',
    sourceLabel: 'Base',
    icon: '🤕',
    damageType: 'mag',
    description: 'Magique. Inflige 100 % Cap (vs ResC).',
  },
};

/** Sorts d’armes (source weapon ; sourceLabel mis à jour via arme équipée si besoin). */
const V2_WEAPON_SPELLS = {
  [V2_WEAPON_SPELL_IDS.COUPE_NETTE]: {
    id: V2_WEAPON_SPELL_IDS.COUPE_NETTE,
    name: 'Coupe nette',
    source: 'weapon',
    sourceLabel: 'Arme',
    icon: '🗡️',
    damageType: 'phys',
    description: 'Physique. Inflige 100 % Auto (vs DEF).',
  },
  [V2_WEAPON_SPELL_IDS.ECLAT_ARDENT]: {
    id: V2_WEAPON_SPELL_IDS.ECLAT_ARDENT,
    name: 'Éclat ardent',
    source: 'weapon',
    sourceLabel: 'Arme',
    icon: '🔥',
    damageType: 'mag',
    description: 'Magique. Inflige 120 % Cap (vs ResC).',
  },
  [V2_WEAPON_SPELL_IDS.LANCE_FRACTURE]: {
    id: V2_WEAPON_SPELL_IDS.LANCE_FRACTURE,
    name: 'Lance fracturée',
    source: 'weapon',
    sourceLabel: 'Arme',
    icon: '🔱',
    damageType: 'phys',
    description: 'Physique. Auto + 20 % Cap (vs DEF).',
  },
  [V2_WEAPON_SPELL_IDS.ORBE_GLACE]: {
    id: V2_WEAPON_SPELL_IDS.ORBE_GLACE,
    name: 'Orbe de glace',
    source: 'weapon',
    sourceLabel: 'Arme',
    icon: '❄️',
    damageType: 'mag',
    description: 'Magique. Auto + 60 % Cap (vs ResC).',
  },
  [V2_WEAPON_SPELL_IDS.PLUIE_CELESTE]: {
    id: V2_WEAPON_SPELL_IDS.PLUIE_CELESTE,
    name: 'Pluie Céleste',
    source: 'weapon',
    sourceLabel: 'Arc des Cieux',
    icon: '🌟',
    damageType: 'phys',
    description: 'Physique. Deux tirs : 100 % puis 70 % Auto (vs DEF).',
  },
  [V2_WEAPON_SPELL_IDS.LAME_DU_ROI]: {
    id: V2_WEAPON_SPELL_IDS.LAME_DU_ROI,
    name: 'Lame du Roi',
    source: 'weapon',
    sourceLabel: 'Lame du Roi',
    icon: '⚔️',
    damageType: 'phys',
    description: 'Physique. Auto + 40 % DEF (vs DEF).',
  },
};

export const V2_SPELLS = {
  [V2_SPELL_IDS.STIGMATE]: {
    id: V2_SPELL_IDS.STIGMATE,
    name: 'Stigmate',
    source: 'passive',
    sourceLabel: 'Marque du Martyr',
    icon: '💠',
    damageType: 'util',
    description: 'Débuff ennemi 4 tours : +15 % de dégâts reçus.',
  },
  ...V2_BASIC_SPELLS,
  ...V2_WEAPON_SPELLS,
  ...V2_CLASS_SPELLS,
};

/** @deprecated Prefer getV2Weapon — conservé pour imports existants. */
export const V2_WEAPON = V2_WEAPONS[V2_DEFAULT_WEAPON_ID];

/** @deprecated Prefer getV2Passive — conservé pour imports existants. */
export const V2_PASSIVE = {
  id: V2_DEFAULT_PASSIVE_ID,
  name: 'Marque du Martyr',
  spellId: V2_SPELL_IDS.STIGMATE,
  description: 'Passif adapté V2 — sort Stigmate.',
};

/** Stats / defaults de création (race/classe viennent du roll joueur). */
export const V2_IMPOSED_CHARACTER = {
  name: 'Champion',
  race: 'Humain',
  class: 'Guerrier',
  gender: 'male',
  characterImage: null,
  weaponId: V2_DEFAULT_WEAPON_ID,
  passiveId: V2_DEFAULT_PASSIVE_ID,
  passiveIds: [V2_DEFAULT_PASSIVE_ID, null],
  base: {
    hp: 140,
    auto: 22,
    def: 18,
    cap: 20,
    rescap: 16,
    spd: 18,
  },
};

/**
 * Remplace un sort d’arme par un autre dans les cycles.
 */
export function replaceSpellInCycles(cycles, oldSpellId, newSpellId) {
  const next = sanitizeSpellCycles(cycles).map((col) =>
    col.map((id) => (id === oldSpellId ? newSpellId : id))
  );
  if (oldSpellId === newSpellId) return next;
  // Si le nouveau n’était nulle part et l’ancien a été remplacé, ok.
  // Si l’ancien n’était pas dans la rotation, ajoute le nouveau en cycle 1.
  const flat = next.flat();
  if (newSpellId && V2_SPELLS[newSpellId] && !flat.includes(newSpellId)) {
    next[0] = [...next[0], newSpellId];
  }
  return sanitizeSpellCycles(next);
}

/** Kit : base + arme + passifs équipés + classe (les races sont des passifs, pas des sorts). */
export function getAvailableKitSpellIds(prototype = V2_IMPOSED_CHARACTER) {
  const ids = [...V2_BASIC_SPELL_IDS];

  const weapon = getV2Weapon(prototype?.weaponId) || getV2Weapon(V2_DEFAULT_WEAPON_ID);
  if (weapon?.spellId) ids.push(weapon.spellId);

  ids.push(...getEquippedPassiveSpellIds(prototype));
  ids.push(...getClassSpellIds(prototype?.class || V2_IMPOSED_CHARACTER.class));

  const unique = [];
  const seen = new Set();
  for (const id of ids) {
    if (!id || !V2_SPELLS[id] || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

/** Sorts actifs (hors passifs) pour l’affichage carte. */
export function getActiveKitSpellIds(prototype = V2_IMPOSED_CHARACTER) {
  return getAvailableKitSpellIds(prototype).filter((id) => {
    const s = V2_SPELLS[id];
    return s && s.source !== 'passive';
  });
}

export const V2_DEFAULT_SPELL_ORDER = getAvailableKitSpellIds(V2_IMPOSED_CHARACTER);

export const V2_GROWTH_RATES = {
  hp: 0.75,
  auto: 0.5,
  def: 0.45,
  cap: 0.35,
  rescap: 0.3,
  spd: 0.25,
};

export const V2_GROWTH_POINT_VALUES = {
  hp: 6,
  auto: 1,
  def: 1,
  cap: 1,
  rescap: 1,
  spd: 1,
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
  const spell = V2_SPELLS[spellId] || null;
  if (!spell) return null;
  return spell;
}

/** Enrichit le label arme selon l’équipement. */
export function getSpellDisplay(spellId, prototype) {
  const spell = getSpellById(spellId);
  if (!spell) return null;
  if (spell.source === 'weapon' && prototype?.weaponId) {
    const w = getV2Weapon(prototype.weaponId);
    if (w?.spellId === spellId) {
      return { ...spell, sourceLabel: w.name, icon: w.icon || spell.icon };
    }
  }
  if (spell.source === 'passive' && prototype) {
    const ids = normalizePassiveIds(prototype);
    for (const pid of ids) {
      const p = getV2Passive(pid);
      if (p?.spellId === spellId) {
        return { ...spell, sourceLabel: p.name, icon: p.icon || spell.icon };
      }
    }
  }
  return spell;
}

export { isOnceInRotationSpell, getClassSpellIds, normalizePassiveIds, getV2Weapon, getV2Passive };

/**
 * Firestore n’accepte pas les tableaux imbriqués.
 * En mémoire : [[...],[...],[...]] — en BDD : { c0, c1, c2 }.
 */
export function spellCyclesToFirestore(cycles) {
  const [c0, c1, c2] = sanitizeSpellCycles(cycles);
  return { c0, c1, c2 };
}

function rawCyclesToTriple(raw) {
  if (!raw) return [[], [], []];
  if (Array.isArray(raw)) {
    return [raw[0] || [], raw[1] || [], raw[2] || []];
  }
  if (typeof raw === 'object') {
    return [
      raw.c0 || raw[0] || raw.cycle1 || [],
      raw.c1 || raw[1] || raw.cycle2 || [],
      raw.c2 || raw[2] || raw.cycle3 || [],
    ];
  }
  return [[], [], []];
}

export function spellCyclesFromFirestore(raw) {
  return sanitizeSpellCycles(rawCyclesToTriple(raw));
}

/**
 * Contour UI selon type / source basic.
 * basic → gris ; phys rouge ; mag bleu ; util jaune ; heal vert.
 */
export function getSpellBorderClass(spell) {
  if (spell?.source === 'basic') {
    return 'border-stone-400/80 bg-stone-900/70';
  }
  switch (spell?.damageType) {
    case 'phys':
      return 'border-red-500/75 bg-red-950/25';
    case 'mag':
      return 'border-blue-500/75 bg-blue-950/25';
    case 'heal':
      return 'border-emerald-500/75 bg-emerald-950/25';
    case 'util':
      return 'border-amber-400/75 bg-amber-950/25';
    default:
      return 'border-stone-600/80 bg-stone-900/80';
  }
}

export function sanitizeSpellCycles(cycles) {
  const raw = rawCyclesToTriple(cycles);
  const globalOnce = new Set();
  return [0, 1, 2].map((i) => {
    const seen = new Set();
    const out = [];
    const list = Array.isArray(raw[i]) ? raw[i] : [];
    for (const id of list) {
      if (!id || !V2_SPELLS[id] || seen.has(id)) continue;
      if (isOnceInRotationSpell(id) && globalOnce.has(id)) continue;
      seen.add(id);
      if (isOnceInRotationSpell(id)) globalOnce.add(id);
      out.push(id);
    }
    return out;
  });
}

export function normalizeSpellCycles(prototypeOrCycles) {
  if (Array.isArray(prototypeOrCycles)) {
    const sanitized = sanitizeSpellCycles(prototypeOrCycles);
    if (sanitized.some((c) => c.length > 0)) return sanitized;
  }
  if (
    prototypeOrCycles &&
    typeof prototypeOrCycles === 'object' &&
    (prototypeOrCycles.c0 || prototypeOrCycles.c1 || prototypeOrCycles.c2)
  ) {
    const sanitized = spellCyclesFromFirestore(prototypeOrCycles);
    if (sanitized.some((c) => c.length > 0)) return sanitized;
  }
  const rawCycles = prototypeOrCycles?.spellCycles;
  if (rawCycles != null) {
    const sanitized = spellCyclesFromFirestore(rawCycles);
    if (sanitized.some((c) => c.length > 0)) return sanitized;
  }
  const kit = getAvailableKitSpellIds(
    typeof prototypeOrCycles === 'object' && !Array.isArray(prototypeOrCycles)
      ? prototypeOrCycles
      : V2_IMPOSED_CHARACTER
  );
  const flat = Array.isArray(prototypeOrCycles?.spellOrder)
    ? prototypeOrCycles.spellOrder.filter((id) => V2_SPELLS[id])
    : [...kit];
  const uniqueFlat = [];
  const seen = new Set();
  for (const id of flat) {
    if (seen.has(id)) continue;
    seen.add(id);
    uniqueFlat.push(id);
  }
  return [uniqueFlat.length ? uniqueFlat : [...kit], [], []];
}

export function flattenSpellCycles(cycles) {
  const flat = sanitizeSpellCycles(
    Array.isArray(cycles) ? cycles : normalizeSpellCycles(cycles)
  ).flat();
  return flat.length > 0 ? flat : [...V2_DEFAULT_SPELL_ORDER];
}
