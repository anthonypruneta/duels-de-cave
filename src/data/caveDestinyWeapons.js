/**
 * Armes Cave Destiny — tirées du vrai pool Duels de Cave.
 * Départ = commune uniquement. Progression : commune → rare → légendaire.
 */

import {
  RARITY,
  getWeaponsByRarity,
  getWeaponByFamilyAndRarity,
  getWeaponById,
  isWaveActive,
} from './weapons';

function randomInt(max) {
  if (max <= 0) return 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function effectDelta(from = {}, to = {}) {
  const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
  const out = {};
  for (const k of keys) {
    const d = (to[k] || 0) - (from[k] || 0);
    if (d !== 0) out[k] = d;
  }
  return out;
}

/** Convertit les stats d’une arme jeu → stats Cave Destiny (bonus modestes) */
export function destinyEffectsFromGameWeapon(weapon) {
  if (!weapon) return {};
  const s = weapon.stats || {};
  const rarityBonus =
    weapon.rarete === RARITY.LEGENDAIRE ? 3 : weapon.rarete === RARITY.RARE ? 1 : 0;

  return {
    auto: Math.round((s.auto || 0) * 0.9) + rarityBonus,
    def: Math.round((s.def || 0) * 0.8 + (s.rescap || 0) * 0.6 + (s.hp || 0) * 0.12),
    cap: Math.round((s.cap || 0) * 0.9) + (weapon.famille === 'tome' || weapon.famille === 'baton' || weapon.famille === 'sceptre' ? 1 : 0),
    spd: Math.round((s.spd || 0) * 0.9) + (weapon.famille === 'dague' || weapon.famille === 'arc' ? 1 : 0),
    charisme: weapon.rarete === RARITY.LEGENDAIRE ? 2 : weapon.rarete === RARITY.RARE ? 1 : 0,
  };
}

export function buildDestinyWeapon(weaponDoc) {
  if (!weaponDoc) return null;
  const family = weaponDoc.famille;
  const commune = getWeaponByFamilyAndRarity(family, RARITY.COMMUNE);
  const rare = getWeaponByFamilyAndRarity(family, RARITY.RARE);
  const legendaire = getWeaponByFamilyAndRarity(family, RARITY.LEGENDAIRE);

  return {
    id: weaponDoc.id,
    family,
    rarity: weaponDoc.rarete,
    name: weaponDoc.nom,
    icon: weaponDoc.icon || '⚔️',
    description: weaponDoc.description || '',
    effects: destinyEffectsFromGameWeapon(weaponDoc),
    path: {
      communeName: commune?.nom || weaponDoc.nom,
      rareName: rare?.nom || 'Version rare',
      legendaireName: legendaire?.nom || 'Version légendaire',
      communeId: commune?.id || null,
      rareId: rare?.id || null,
      legendaireId: legendaire?.id || null,
    },
  };
}

export function getCommonDestinyWeaponsPool() {
  return getWeaponsByRarity(RARITY.COMMUNE)
    .filter((w) => isWaveActive(w.vague))
    .map(buildDestinyWeapon)
    .filter(Boolean);
}

/** Tire `count` armes communes distinctes (familles différentes). */
export function pickRandomCommonWeapons(count = 4) {
  const pool = getCommonDestinyWeaponsPool();
  return shuffleInPlace([...pool]).slice(0, Math.min(count, pool.length));
}

export function getDestinyWeaponById(weaponId) {
  const doc = getWeaponById(weaponId);
  return doc ? buildDestinyWeapon(doc) : null;
}

export function isWeaponMaxed(weapon) {
  return weapon?.rarity === RARITY.LEGENDAIRE;
}

/**
 * Passe à la rareté suivante (commune→rare ou rare→légendaire).
 * @returns {{ weapon, statDelta, changed, message }}
 */
export function upgradeDestinyWeapon(weapon) {
  if (!weapon || isWeaponMaxed(weapon)) {
    return {
      weapon,
      statDelta: {},
      changed: false,
      message: 'Votre arme est déjà au sommet de sa lignée.',
    };
  }

  const nextRarity = weapon.rarity === RARITY.COMMUNE ? RARITY.RARE : RARITY.LEGENDAIRE;
  const nextDoc = getWeaponByFamilyAndRarity(weapon.family, nextRarity);
  if (!nextDoc) {
    return { weapon, statDelta: {}, changed: false, message: 'Aucune upgrade trouvée.' };
  }

  const next = buildDestinyWeapon(nextDoc);
  const statDelta = effectDelta(weapon.effects, next.effects);
  return {
    weapon: next,
    statDelta,
    changed: true,
    message:
      nextRarity === RARITY.LEGENDAIRE
        ? `Légendaire ! ${next.name} pulse entre vos mains.`
        : `Upgrade : ${weapon.name} devient ${next.name}.`,
  };
}

/**
 * Passe directement à la légendaire de la famille (saut rare).
 */
export function grantLegendaryDestinyWeapon(weapon) {
  if (!weapon) {
    return { weapon, statDelta: {}, changed: false, message: '' };
  }
  if (isWeaponMaxed(weapon)) {
    return {
      weapon,
      statDelta: { renommee: 2 },
      changed: false,
      message: `${weapon.name} brille déjà de sa forme définitive.`,
    };
  }

  const nextDoc = getWeaponByFamilyAndRarity(weapon.family, RARITY.LEGENDAIRE);
  if (!nextDoc) {
    return { weapon, statDelta: {}, changed: false, message: '' };
  }

  const next = buildDestinyWeapon(nextDoc);
  const statDelta = effectDelta(weapon.effects, next.effects);
  return {
    weapon: next,
    statDelta,
    changed: true,
    message: `Miracle d’acier : ${next.name} vous choisit.`,
  };
}

export function fillWeaponPlaceholders(text, weapon) {
  if (!text || !weapon) return text || '';
  return String(text)
    .replaceAll('{arme}', weapon.name)
    .replaceAll('{arme_rare}', weapon.path?.rareName || 'sa version rare')
    .replaceAll('{arme_legendaire}', weapon.path?.legendaireName || 'sa version légendaire');
}

export const WEAPON_RARITY_LABEL = {
  [RARITY.COMMUNE]: 'Commune',
  [RARITY.RARE]: 'Rare',
  [RARITY.LEGENDAIRE]: 'Légendaire',
};
