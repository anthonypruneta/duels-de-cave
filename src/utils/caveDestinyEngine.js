/**
 * Moteur Cave Destiny — création de carrière, résolution d’événements, scoring.
 */

import {
  CAVE_DESTINY_AMBITIONS,
  CAVE_DESTINY_MENTORS,
  CAVE_DESTINY_EVENTS,
  CAVE_DESTINY_TIERS,
  CAVE_DESTINY_SEASON_COUNT,
  STORAGE_KEY_SAVE,
  STORAGE_KEY_PANTHEON,
  getOptionsForEvent,
  getDestinyWeaponById,
  upgradeDestinyWeapon,
  grantLegendaryDestinyWeapon,
  fillWeaponPlaceholders,
  isWeaponMaxed,
} from '../data/caveDestiny';
import { getEventBaseWeight } from '../data/caveDestinyRarity';
import { RARITY } from '../data/weapons';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pickWeighted(items) {
  const total = items.reduce((s, it) => s + (it.weight || 1), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight || 1;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function emptyTrophies() {
  return {
    tournoi: 0,
    donjon: 0,
    tour: 0,
    forge: 0,
    labyrinthe: 0,
    cataclysme: 0,
    pvp: 0,
    bossRush: 0,
    extension: 0,
    coop: 0,
  };
}

function applyEffects(stats, effects = {}) {
  const next = { ...stats };
  for (const [k, v] of Object.entries(effects)) {
    if (k === 'trophies' || typeof v !== 'number') continue;
    if (k in next) next[k] = (next[k] || 0) + v;
  }
  next.forme = clamp(next.forme ?? 70, 0, 100);
  next.moral = clamp(next.moral ?? 70, 0, 100);
  next.or = Math.max(0, next.or ?? 0);
  next.renommee = Math.max(0, next.renommee ?? 0);
  return next;
}

function applyTrophies(trophies, deltaTrophies) {
  if (!deltaTrophies) return trophies;
  const next = { ...trophies };
  for (const [k, v] of Object.entries(deltaTrophies)) {
    next[k] = (next[k] || 0) + v;
  }
  return next;
}

/** Bonus passifs dérivés de la race / classe du perso réel choisi */
function characterBonus(character, deltas) {
  const next = { ...deltas };
  if (!character) return next;

  if (character.prefersGrit && (next.renommee || 0) > 0 && (next.forme || 0) < 0) {
    next.renommee += 3;
  }
  if (character.prefersMagic && (next.magie || 0) > 0) {
    next.magie += 1;
  }
  if (character.prefersRebound && (next.moral || 0) < 0) {
    next.moral += 3;
  }
  if (character.prefersSpeed && (next.vitesse || 0) > 0) {
    next.vitesse += 1;
  }
  return next;
}

/**
 * @param {{ character: object, ambitionId: string, mentorId: string, weaponId: string }} opts
 * `character` = profil déjà construit via buildDestinyCharacterFromGame
 */
export function createCareer({ character, ambitionId, mentorId, weaponId }) {
  const ambition = CAVE_DESTINY_AMBITIONS.find((a) => a.id === ambitionId);
  const mentor = CAVE_DESTINY_MENTORS.find((m) => m.id === mentorId);
  const weapon = getDestinyWeaponById(weaponId);
  if (!character || !ambition || !mentor || !weapon) {
    throw new Error('Choix de création incomplets');
  }
  if (weapon.rarity !== RARITY.COMMUNE) {
    throw new Error('L’arme de départ doit être commune');
  }

  let stats = {
    ...(character.baseStats || {
      puissance: 45,
      endurance: 45,
      magie: 45,
      vitesse: 45,
      charisme: 45,
    }),
    renommee: 10,
    or: 20,
    forme: 78,
    moral: 72,
  };

  stats = applyEffects(stats, ambition.effects);
  stats = applyEffects(stats, mentor.effects);
  stats = applyEffects(stats, weapon.effects);

  return {
    version: 5,
    createdAt: Date.now(),
    season: 1,
    maxSeasons: CAVE_DESTINY_SEASON_COUNT,
    phase: 'playing',
    character,
    ambition,
    mentor,
    weapon,
    stats,
    trophies: emptyTrophies(),
    history: [],
    recentEventIds: [],
    currentEvent: null,
    lastOutcome: null,
  };
}

function eventWeight(event, career) {
  let w = getEventBaseWeight(event);
  const ambitionId = career.ambition?.id;
  if (ambitionId && event.tags?.includes(ambitionId)) w *= 1.7;
  if (career.stats.forme < 35 && event.id === 'blessure') w *= 2.2;
  if (career.stats.forme < 25 && event.tags?.includes('combat')) w *= 0.55;
  if (career.recentEventIds.includes(event.id)) w *= 0.25;

  // Events d’upgrade / légendaire : inutiles si déjà au max
  if (event.tags?.includes('arme') && isWeaponMaxed(career.weapon)) {
    w *= 0.05;
  }
  // Légendaire plus probable si déjà en rare
  if (event.tags?.includes('arme_legendaire') && career.weapon?.rarity === RARITY.RARE) {
    w *= 1.4;
  }
  // Upgrade plus utile en commune
  if (event.tags?.includes('arme_upgrade') && career.weapon?.rarity === RARITY.COMMUNE) {
    w *= 1.35;
  }
  return w;
}

function localizeEventForWeapon(event, weapon) {
  const options = (event.options || []).map((opt) => ({
    ...opt,
    label: fillWeaponPlaceholders(opt.label, weapon),
    outcomes: (opt.outcomes || []).map((o) => ({
      ...o,
      text: fillWeaponPlaceholders(o.text, weapon),
    })),
  }));
  return {
    ...event,
    title: fillWeaponPlaceholders(event.title, weapon),
    text: fillWeaponPlaceholders(event.text, weapon),
    options,
  };
}

export function drawEvent(career) {
  const pool = CAVE_DESTINY_EVENTS.map((e) => ({
    ...e,
    weight: eventWeight(e, career),
  }));
  const raw = pickWeighted(pool);
  const options = getOptionsForEvent(raw, career.character);
  const localized = localizeEventForWeapon({ ...raw, options }, career.weapon);
  return {
    id: localized.id,
    title: localized.title,
    text: localized.text,
    tags: localized.tags,
    rarity: localized.rarity || 'common',
    options: localized.options,
  };
}

export function ensureCurrentEvent(career) {
  if (career.phase !== 'playing') return career;
  if (career.currentEvent) return career;
  return { ...career, currentEvent: drawEvent(career) };
}

export function resolveChoice(career, optionIndex) {
  if (!career.currentEvent) return career;
  const option = career.currentEvent.options[optionIndex];
  if (!option) return career;

  // Garantit un trio bonus/neutre/malus même sur d’anciennes saves
  let outcomes = option.outcomes || [];
  const variants = new Set(outcomes.map((o) => o.variant).filter(Boolean));
  if (!variants.has('bonus') || !variants.has('neutre') || !variants.has('malus')) {
    // fallback : redistribue poids existants
    outcomes = outcomes.length ? outcomes : [{ weight: 100, text: 'Rien ne se passe.', deltas: {} }];
  }

  const outcome = pickWeighted(outcomes);
  let deltas = { ...(outcome.deltas || {}) };
  const trophyDelta = deltas.trophies;
  delete deltas.trophies;
  const weaponProgress = outcome.weaponProgress || deltas.weaponProgress || null;
  delete deltas.weaponProgress;
  deltas = characterBonus(career.character, deltas);

  let stats = applyEffects(career.stats, deltas);
  const trophies = applyTrophies(career.trophies, trophyDelta);

  let weapon = career.weapon;
  let outcomeText = fillWeaponPlaceholders(outcome.text, weapon);
  const weaponDeltas = {};

  if (weaponProgress === 'upgrade' || weaponProgress === 'legendary') {
    const result =
      weaponProgress === 'legendary'
        ? grantLegendaryDestinyWeapon(weapon)
        : upgradeDestinyWeapon(weapon);
    if (result.changed || Object.keys(result.statDelta || {}).length) {
      weapon = result.weapon;
      stats = applyEffects(stats, result.statDelta);
      Object.assign(weaponDeltas, result.statDelta);
      if (result.message) {
        outcomeText = `${outcomeText} ${result.message}`;
      }
    } else if (result.message) {
      outcomeText = `${outcomeText} ${result.message}`;
    }
  }

  const mergedDeltas = { ...deltas, ...weaponDeltas };

  const historyEntry = {
    season: career.season,
    eventId: career.currentEvent.id,
    title: career.currentEvent.title,
    choice: option.label,
    text: outcomeText,
    variant: outcome.variant || 'neutre',
    deltas: mergedDeltas,
    weaponProgress: weaponProgress || null,
    weaponName: weapon?.name || null,
    weaponRarity: weapon?.rarity || null,
  };

  const recentEventIds = [...career.recentEventIds, career.currentEvent.id].slice(-4);
  const nextSeason = career.season + 1;
  const retired = nextSeason > career.maxSeasons;

  const agedStats = applyEffects(stats, {
    puissance: 1,
    endurance: 1,
    magie: career.character?.prefersMagic ? 1 : 0,
    vitesse: career.character?.prefersSpeed ? 1 : 0,
  });

  let next = {
    ...career,
    weapon,
    stats: agedStats,
    trophies,
    history: [...career.history, historyEntry],
    recentEventIds,
    lastOutcome: historyEntry,
    currentEvent: null,
    season: retired ? career.maxSeasons : nextSeason,
    phase: retired ? 'finished' : 'playing',
  };

  if (!retired) {
    next = ensureCurrentEvent(next);
  }

  return next;
}

export function computeScore(career) {
  const s = career.stats || {};
  const t = career.trophies || {};
  const trophyPoints =
    (t.tournoi || 0) * 28 +
    (t.donjon || 0) * 10 +
    (t.tour || 0) * 12 +
    (t.forge || 0) * 22 +
    (t.labyrinthe || 0) * 14 +
    (t.cataclysme || 0) * 20 +
    (t.pvp || 0) * 12 +
    (t.bossRush || 0) * 14 +
    (t.extension || 0) * 10 +
    (t.coop || 0) * 10;

  return Math.round(
    (s.puissance || 0) * 1.2 +
      (s.endurance || 0) * 1.1 +
      (s.magie || 0) * 1.2 +
      (s.vitesse || 0) * 1.1 +
      (s.charisme || 0) * 1.0 +
      (s.renommee || 0) * 1.4 +
      (s.or || 0) * 0.35 +
      trophyPoints
  );
}

export function getTier(score) {
  let tier = CAVE_DESTINY_TIERS[0];
  for (const t of CAVE_DESTINY_TIERS) {
    if (score >= t.minScore) tier = t;
  }
  return tier;
}

export function buildFinalStory(career) {
  const score = computeScore(career);
  const tier = getTier(score);
  const name = career.character?.name || 'Aventurier';
  const ambition = career.ambition?.name || 'la gloire';
  const wins = career.trophies?.tournoi || 0;
  const forge = career.trophies?.forge || 0;
  const owner = career.character?.ownerPseudo;

  let arc = owner
    ? `${name} (${owner}) a poursuivi « ${ambition} » pendant ${career.maxSeasons} saisons — un vrai cave des Duels.`
    : `${name} a poursuivi « ${ambition} » pendant ${career.maxSeasons} saisons — un vrai cave des Duels.`;
  if (wins >= 2) arc += ' Les tournois du samedi ont appris à craindre son nom.';
  else if (wins === 1) arc += ' Une couronne arrachée sous les acclamations de l’arène.';
  else arc += ' Aucune couronne… mais des histoires à la Taverne.';

  if (forge >= 1) arc += ' Ornn a reconnu son bras dans le feu de la forge.';
  const weaponName = career.weapon?.name;
  const weaponRarity = career.weapon?.rarity;
  if (weaponName && weaponRarity === RARITY.LEGENDAIRE) {
    arc += ` ${weaponName} a révélé sa forme légendaire.`;
  } else if (weaponName && weaponRarity === RARITY.RARE) {
    arc += ` ${weaponName} a été améliorée en chemin.`;
  }
  if (score >= 360) arc += ' On murmure déjà « légende » plutôt que « cave ».';
  else if (score < 160) arc += ' Cave jusqu’au bout — et fier de l’être.';

  return { score, tier, story: arc };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function persistSave(career) {
  try {
    if (!career) localStorage.removeItem(STORAGE_KEY_SAVE);
    else localStorage.setItem(STORAGE_KEY_SAVE, JSON.stringify(career));
  } catch {
    /* ignore quota */
  }
}

export function loadPantheon() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PANTHEON);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function pushToPantheon(career) {
  const { score, tier, story } = buildFinalStory(career);
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: Date.now(),
    name: career.character.name,
    race: career.character.race,
    class: career.character.class,
    ownerPseudo: career.character.ownerPseudo || null,
    characterImage: career.character.characterImage || null,
    ambition: career.ambition.name,
    weapon: career.weapon.name,
    score,
    tierId: tier.id,
    tierLabel: tier.label,
    trophies: career.trophies,
    story,
    stats: career.stats,
  };
  const list = [entry, ...loadPantheon()].slice(0, 20);
  try {
    localStorage.setItem(STORAGE_KEY_PANTHEON, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

export function clearSave() {
  persistSave(null);
}

export function formatDelta(deltas = {}) {
  const labels = {
    puissance: 'Puissance',
    endurance: 'Endurance',
    magie: 'Magie',
    vitesse: 'Vitesse',
    charisme: 'Charisme',
    renommee: 'Renommée',
    or: 'Or',
    forme: 'Forme',
    moral: 'Moral',
  };
  return Object.entries(deltas)
    .filter(([, v]) => typeof v === 'number' && v !== 0)
    .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${labels[k] || k}`);
}
