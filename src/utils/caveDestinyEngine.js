/**
 * Moteur Cave Destiny — création de carrière, résolution d’événements, scoring.
 */

import {
  CAVE_DESTINY_CHARACTERS,
  CAVE_DESTINY_AMBITIONS,
  CAVE_DESTINY_MENTORS,
  CAVE_DESTINY_WEAPONS,
  CAVE_DESTINY_EVENTS,
  CAVE_DESTINY_TIERS,
  CAVE_DESTINY_SEASON_COUNT,
  STORAGE_KEY_SAVE,
  STORAGE_KEY_PANTHEON,
} from '../data/caveDestiny';

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

function characterBonus(characterId, deltas) {
  const next = { ...deltas };
  if (characterId === 'grom' && (next.renommee || 0) > 0 && (next.forme || 0) < 0) {
    next.renommee += 3;
  }
  if (characterId === 'elyndra' && (next.magie || 0) > 0) {
    next.magie += 1;
  }
  if (characterId === 'shade' && (next.moral || 0) < 0) {
    next.moral += 3;
  }
  return next;
}

export function createCareer({ characterId, ambitionId, mentorId, weaponId }) {
  const character = CAVE_DESTINY_CHARACTERS.find((c) => c.id === characterId);
  const ambition = CAVE_DESTINY_AMBITIONS.find((a) => a.id === ambitionId);
  const mentor = CAVE_DESTINY_MENTORS.find((m) => m.id === mentorId);
  const weapon = CAVE_DESTINY_WEAPONS.find((w) => w.id === weaponId);
  if (!character || !ambition || !mentor || !weapon) {
    throw new Error('Choix de création incomplets');
  }

  let stats = {
    ...character.baseStats,
    renommee: 10,
    or: 20,
    forme: 78,
    moral: 72,
  };

  stats = applyEffects(stats, ambition.effects);
  stats = applyEffects(stats, mentor.effects);
  stats = applyEffects(stats, weapon.effects);

  return {
    version: 1,
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
  let w = event.weight || 1;
  const ambitionId = career.ambition?.id;
  if (ambitionId && event.tags?.includes(ambitionId)) w *= 1.7;
  if (career.stats.forme < 35 && event.id === 'blessure') w *= 2.2;
  if (career.stats.forme < 25 && event.tags?.includes('combat')) w *= 0.55;
  if (career.recentEventIds.includes(event.id)) w *= 0.25;
  return w;
}

export function drawEvent(career) {
  const pool = CAVE_DESTINY_EVENTS.map((e) => ({
    ...e,
    weight: eventWeight(e, career),
  }));
  return pickWeighted(pool);
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

  const outcome = pickWeighted(option.outcomes);
  let deltas = { ...(outcome.deltas || {}) };
  const trophyDelta = deltas.trophies;
  delete deltas.trophies;
  deltas = characterBonus(career.character.id, deltas);

  const stats = applyEffects(career.stats, deltas);
  const trophies = applyTrophies(career.trophies, trophyDelta);

  const historyEntry = {
    season: career.season,
    eventId: career.currentEvent.id,
    title: career.currentEvent.title,
    choice: option.label,
    text: outcome.text,
    deltas,
  };

  const recentEventIds = [...career.recentEventIds, career.currentEvent.id].slice(-4);
  const nextSeason = career.season + 1;
  const retired = nextSeason > career.maxSeasons;

  // Micro progression naturelle chaque saison
  const agedStats = applyEffects(stats, {
    puissance: 1,
    endurance: 1,
    magie: career.character.id === 'elyndra' ? 1 : 0,
    vitesse: career.character.id === 'shade' ? 1 : 0,
  });

  let next = {
    ...career,
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

  let arc = `${name} a poursuivi « ${ambition} » pendant ${career.maxSeasons} saisons dans la Cave.`;
  if (wins >= 2) arc += ' Les tournois du samedi se souviennent encore de ses finales.';
  else if (wins === 1) arc += ' Une couronne de tournoi brille dans son palmarès.';
  else arc += ' Le trône du tournoi lui a échappé — d’autres gloires restent.';

  if (forge >= 1) arc += ' L’empreinte d’Ornn marque son arme pour toujours.';
  if (score >= 360) arc += ' On murmure déjà son nom dans le Hall of Fame.';
  else if (score < 160) arc += ' Une carrière humble, mais bien réelle.';

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
