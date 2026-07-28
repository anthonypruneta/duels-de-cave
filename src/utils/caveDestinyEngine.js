/**
 * Moteur Cave Destiny — création de carrière, résolution d’événements, scoring.
 */

import {
  CAVE_DESTINY_AMBITIONS,
  CAVE_DESTINY_MENTORS,
  CAVE_DESTINY_EVENTS,
  CAVE_DESTINY_TIERS,
  CAVE_DESTINY_SEASON_COUNT,
  EXTEND_SEASON_HP_COST,
  CAVE_DESTINY_SCORE_MAX,
  CAVE_DESTINY_SCORE_START_MIN,
  CAVE_DESTINY_SCORE_START_MAX,
  STORAGE_KEY_SAVE,
  STORAGE_KEY_PANTHEON,
  getOptionsForEvent,
  getDestinyWeaponById,
  upgradeDestinyWeapon,
  grantLegendaryDestinyWeapon,
  fillWeaponPlaceholders,
  isWeaponMaxed,
  pickRandomGameCharacters,
} from '../data/caveDestiny';
import { getEventBaseWeight } from '../data/caveDestinyRarity';
import {
  getChainStep,
  isChainLockedStep,
  isAmbitionChainFinale,
  buildChainUiMeta,
  listActiveChainQuests,
} from '../data/caveDestinyChains';

export { listActiveChainQuests };
import { RARITY } from '../data/weapons';
import { getSubclassesForClass, getSubclassStatBonuses } from '../data/subclasses';
import { trio, CAVE_DESTINY_TRIO_WEIGHTS } from '../data/caveDestinyEventUtils';

const DESTINY_SUBCLASS_STAT_MAP = {
  auto: 'auto',
  def: 'def',
  cap: 'cap',
  spd: 'spd',
  hp: 'hp',
  rescap: 'def',
};

const DESTINY_STAT_LABEL = {
  auto: 'Auto',
  def: 'Défense',
  cap: 'Cap',
  spd: 'Vitesse',
  hp: 'PV',
};

/** Focus Destiny d’une sous-classe (sans afficher les % combat). */
function destinySubclassFocus(sc) {
  const raw = getSubclassStatBonuses(sc?.id);
  if (raw && Object.keys(raw).length) return { ...raw };
  // Crit / voies sans entrée numérique : oriente vers VIT + Auto
  if (/critique/i.test(sc?.bonus || '') || /critique/i.test(sc?.description || '')) {
    return { spd: 0.08, auto: 0.05 };
  }
  return { auto: 0.05, cap: 0.05 };
}

/** Indice UI Destiny (pas le bonus combat). */
function subclassDestinyDetail(sc) {
  const focus = destinySubclassFocus(sc);
  const labels = Object.keys(focus)
    .map((k) => DESTINY_STAT_LABEL[DESTINY_SUBCLASS_STAT_MAP[k] || k])
    .filter(Boolean);
  const uniq = [...new Set(labels)];
  if (!uniq.length) return 'Une voie qui redéfinit votre style au Collège.';
  if (uniq.length === 1) return `Oriente votre progression vers ${uniq[0]}.`;
  if (uniq.length === 2) return `Oriente votre progression vers ${uniq[0]} et ${uniq[1]}.`;
  return `Oriente votre progression vers ${uniq.slice(0, -1).join(', ')} et ${uniq[uniq.length - 1]}.`;
}

/**
 * Deltas Destiny selon la sous-classe.
 * intensity : 1 réussite, ~0.4 aperçu neutre, 0 échec (pas de gain de focus).
 */
function destinyDeltasFromSubclass(sc, intensity = 1) {
  const focus = destinySubclassFocus(sc);
  const deltas = {};
  for (const [k, pct] of Object.entries(focus)) {
    const dest = DESTINY_SUBCLASS_STAT_MAP[k];
    if (!dest || typeof pct !== 'number') continue;
    // 10% → +3 en réussite ; plancher 1 si intensity > 0
    const points = Math.round(pct * 30 * intensity);
    if (points === 0 && intensity > 0) {
      deltas[dest] = (deltas[dest] || 0) + 1;
    } else if (points !== 0) {
      deltas[dest] = (deltas[dest] || 0) + points;
    }
  }
  return deltas;
}

function buildSubclassEmbraceOutcomes(sc, className) {
  const name = sc.name;
  const focusLabels = Object.keys(destinySubclassFocus(sc))
    .map((k) => DESTINY_STAT_LABEL[DESTINY_SUBCLASS_STAT_MAP[k] || k])
    .filter(Boolean);
  const focusPhrase = [...new Set(focusLabels)].join(' et ') || 'votre style';

  const bonusFocus = destinyDeltasFromSubclass(sc, 1);
  const neutreFocus = destinyDeltasFromSubclass(sc, 0.4);

  return trio(
    {
      text: `La voie « ${name} » s’ancre en vous.\nVotre ${className} gagne surtout en ${focusPhrase}, et le Collège grave ce choix.`,
      deltas: { renommee: 5, moral: 3, ...bonusFocus },
      subclassGain: { id: sc.id, name: sc.name },
    },
    {
      text: `Vous entrevoyez « ${name} », sans l’embrasser pleinement.\nUn peu de ${focusPhrase} s’accroche, et la porte reste entrouverte.`,
      deltas: { moral: 1, ...neutreFocus },
    },
    {
      text: `L’examen de la voie « ${name} » vous dépasse.\nVous regagnez les bancs du Collège, un peu plus humble.`,
      deltas: { hp: -6, moral: -4 },
    },
  );
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Ajoute un paragraphe de prose outcome (retour à la ligne, pas de collage). */
function appendOutcomeProse(base, addition) {
  const a = String(addition || '').trim();
  if (!a) return base || '';
  const b = String(base || '').trim();
  if (!b) return a;
  return `${b}\n${a}`;
}

function pickWeighted(items) {
  const total = items.reduce((s, it) => s + Math.max(0, it.weight || 1), 0);
  if (total <= 0) return items[items.length - 1];
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, it.weight || 1);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

/** Stats pouvant influencer secrètement un choix */
const CHECKABLE_STATS = ['auto', 'def', 'cap', 'spd', 'charisme', 'renommee'];

const CHECK_KEYWORDS = {
  auto: [
    'force', 'frappe', 'attaq', 'coup', 'puissan', 'rage', 'combat', 'duel', 'brut',
    'affronter', 'charger', 'charge', 'tournoi', 'arène', 'assaut',
  ],
  def: [
    'bloqu', 'défense', 'defens', 'encaiss', 'tenir', 'résist', 'resist', 'bouclier',
    'rempart', 'tank', 'sanglier', 'endure', 'protect', 'choc', 'front', 'égide', 'egide',
  ],
  cap: [
    'sort', 'arcan', 'magie', 'rituel', 'enchant', 'mage', 'runique', 'mystiq', 'collège',
    'college', 'koro', 'passif', 'tome',
  ],
  spd: [
    'fuir', 'esquiv', 'rapide', 'sprint', 'course', 'ombre', 'discret', 'voleur', 'archer',
    'précis', 'precis', 'éviter', 'eviter', 'contourner', 'attirer', 'piège', 'piege',
  ],
  charisme: [
    'parler', 'négoc', 'negoci', 'persuad', 'bluff', 'pari', 'taverne', 'charme',
    'diplom', 'convainc', 'mentor', 'observer', 'gradin', 'social',
  ],
  renommee: ['gloire', 'renom', 'légende', 'legende', 'prestige', 'foule', 'public', 'couronne'],
};

function optionHasUnlockRequirement(option) {
  const require = option?.require;
  if (!require || typeof require !== 'object') return false;
  return Object.keys(require).some((key) => {
    if (key === 'stats') return Object.keys(require.stats || {}).length > 0;
    if (key === 'minRenommee') return Number.isFinite(Number(require.minRenommee));
    const value = require[key];
    if (Array.isArray(value)) return value.length > 0;
    return value != null;
  });
}

function isSoftRefusalOption(event, option) {
  if (!option) return false;
  if (option.exitChain) return true;
  const id = String(option.id || '');
  if (['refuser', 'refuser_quete', 'decliner', 'reporter', 'abandonner'].includes(id)) {
    return true;
  }
  if (event?.id === 'tournoi_anciens' && id === 'decliner') return true;
  if (event?.id === 'ornn_jugement' && id === 'reporter') return true;
  return false;
}

/**
 * Infère les stats qui influencent un choix (jamais affichées).
 * `option.check` explicite prime si présent sur la définition d’event.
 */
function inferCheckStats(option, event) {
  if (option?.check && typeof option.check === 'object') {
    const explicit = {};
    for (const [stat, w] of Object.entries(option.check)) {
      if (CHECKABLE_STATS.includes(stat) && typeof w === 'number' && w > 0) {
        explicit[stat] = w;
      }
    }
    if (Object.keys(explicit).length) return explicit;
  }

  const weights = {};
  const bump = (stat, amount) => {
    if (!CHECKABLE_STATS.includes(stat)) return;
    weights[stat] = (weights[stat] || 0) + amount;
  };

  for (const [stat, min] of Object.entries(option?.require?.stats || {})) {
    if (typeof min === 'number') bump(stat, 1.25);
  }

  const blob = `${option?.id || ''} ${option?.label || ''}`.toLowerCase();
  for (const [stat, words] of Object.entries(CHECK_KEYWORDS)) {
    if (words.some((w) => blob.includes(w))) bump(stat, 1);
  }

  const tags = event?.tags || [];
  if (tags.includes('combat') || tags.includes('tournoi') || tags.includes('donjons')) {
    bump('auto', 0.35);
    bump('def', 0.3);
    bump('spd', 0.2);
  }
  if (tags.includes('forge')) bump('def', 0.35);
  if (tags.includes('social') || tags.includes('taverne')) bump('charisme', 0.45);
  if (tags.includes('magie') || tags.includes('subclass')) bump('cap', 0.4);

  const bonus = (option?.outcomes || []).find((o) => o.variant === 'bonus');
  if (bonus?.deltas) {
    for (const [stat, v] of Object.entries(bonus.deltas)) {
      if (typeof v === 'number' && v > 0) bump(stat, Math.min(0.7, v * 0.12));
    }
  }

  // Garde les 3 stats les plus pertinentes
  const ranked = Object.entries(weights).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!ranked.length) {
    // Défaut soft selon tags
    if (tags.includes('combat')) return { auto: 0.7, def: 0.7 };
    return { charisme: 0.5, renommee: 0.35 };
  }
  return Object.fromEntries(ranked);
}

/** Score secret [-1, 1] : au-dessus de la baseline → un peu plus de bonus */
function computeCheckScore(stats, checkWeights, season = 1) {
  const entries = Object.entries(checkWeights || {});
  if (!entries.length) return 0;
  // Baseline un peu plus haute + échelle plus douce → moins d’écart win/lose
  const baseline = 18 + Math.max(0, season - 1) * 0.85;
  let sum = 0;
  let totalW = 0;
  for (const [stat, w] of entries) {
    const val = Number(stats?.[stat]) || 0;
    const delta = clamp((val - baseline) / 22, -0.7, 0.7);
    sum += delta * w;
    totalW += w;
  }
  return totalW > 0 ? clamp(sum / totalW, -0.7, 0.7) : 0;
}

/**
 * Ajuste légèrement les poids bonus/neutre/malus selon les stats (secret).
 * Influence volontairement modérée : le hasard reste le moteur principal.
 */
function applySecretStatWeights(outcomes, career, option, event) {
  const check = inferCheckStats(option, event);
  const checkScore = computeCheckScore(career.stats, check, career.season);
  const hp = Number(career.stats?.hp) || 50;
  const moral = Number(career.stats?.moral) || 50;
  const soft =
    clamp((hp - 50) / 70, -0.25, 0.25) * 0.2 +
    clamp((moral - 50) / 70, -0.25, 0.25) * 0.15;
  const chain = event?.id ? buildChainUiMeta(event.id) : null;
  const playerAmbition = career?.ambition?.id || null;
  const alignedAmbition =
    !!(playerAmbition && chain?.ambition && chain.ambition === playerAmbition);
  const rivalAmbition =
    !!(playerAmbition && chain?.ambition && chain.ambition !== playerAmbition);

  let factor = checkScore + soft;

  // Une option vraiment débloquée par une condition mérite un léger bonus caché.
  if (optionHasUnlockRequirement(option)) factor += 0.1;

  // Votre voie doit être un peu plus favorable quand vous osez l'engager.
  if (alignedAmbition && !isSoftRefusalOption(event, option)) factor += 0.1;

  // Les voies des autres ambitions sont moins hospitalières, sauf si vous refusez proprement.
  if (rivalAmbition && !isSoftRefusalOption(event, option)) factor -= 0.14;

  factor = clamp(factor, -0.55, 0.55);

  return (outcomes || []).map((o) => {
    let w = o.weight || 1;
    if (o.variant === 'bonus') w *= 1 + factor * 0.32;
    else if (o.variant === 'malus') w *= 1 - factor * 0.28;
    else w *= 1 + Math.abs(factor) * 0.04;
    return { ...o, weight: Math.max(0.5, w) };
  });
}

const ORNN_DUEL_FIGHT_OPTIONS = new Set(['affronter_maintenant', 'affronter_legendaire', 'bastion']);

/**
 * Défi Ornn : sans arme légendaire = très dur ; légendaire = plus tenable ;
 * légendaire + forgée (forge_ornn réussie) = nettement plus favorable.
 */
function applyOrnnDuelWeaponScaling(outcomes, career, option, event) {
  if (event?.id !== 'ornn_jugement' || !ORNN_DUEL_FIGHT_OPTIONS.has(option?.id)) {
    return outcomes;
  }

  const hasLegendary = career.weapon?.rarity === RARITY.LEGENDAIRE;
  const forged = !!career.flags?.arme_legendaire_forgee;

  let bonusMul;
  let neutreMul;
  let malusMul;
  let hpLossMul;
  let rewardMul;
  let penaltyMul;

  if (!hasLegendary) {
    // Folie : malus dominant, bonus rare, coups plus durs
    bonusMul = 0.22;
    neutreMul = 0.65;
    malusMul = 2.6;
    hpLossMul = 1.4;
    rewardMul = 0.8;
    penaltyMul = 1.45;
  } else if (!forged) {
    // Arme légendaire seule : duel tenable
    bonusMul = 1.2;
    neutreMul = 1;
    malusMul = 0.7;
    hpLossMul = 1;
    rewardMul = 1;
    penaltyMul = 1;
  } else {
    // Légendaire reforgée par Ornn : le fer incline le duel
    bonusMul = 1.9;
    neutreMul = 1.05;
    malusMul = 0.32;
    hpLossMul = 0.72;
    rewardMul = 1.2;
    penaltyMul = 0.85;
  }

  return (outcomes || []).map((o) => {
    let w = o.weight || 1;
    if (o.variant === 'bonus') w *= bonusMul;
    else if (o.variant === 'malus') w *= malusMul;
    else w *= neutreMul;

    const deltas = { ...(o.deltas || {}) };
    if (typeof deltas.hp === 'number' && deltas.hp < 0) {
      deltas.hp = Math.round(deltas.hp * hpLossMul);
    }
    for (const key of ['auto', 'def', 'cap', 'spd', 'renommee', 'or', 'charisme', 'moral']) {
      if (typeof deltas[key] !== 'number') continue;
      if (deltas[key] > 0) {
        deltas[key] = Math.max(1, Math.round(deltas[key] * rewardMul));
      } else if (deltas[key] < 0) {
        deltas[key] = Math.round(deltas[key] * penaltyMul);
      }
    }

    return { ...o, weight: Math.max(0.05, w), deltas };
  });
}

/** Ids d’événements déjà rencontrés dans la run */
function seenEventIds(career) {
  const ids = new Set();
  for (const h of career.history || []) {
    if (h?.eventId) ids.add(h.eventId);
  }
  for (const id of career.recentEventIds || []) {
    if (id) ids.add(id);
  }
  return ids;
}

/** Récupère le `check` secret défini sur l’event source (hors UI) */
function lookupDefinedCheck(eventId, optionId) {
  if (!eventId || !optionId) return null;
  const raw = CAVE_DESTINY_EVENTS.find((e) => e.id === eventId);
  const opt = raw?.options?.find((o) => o.id === optionId);
  return opt?.check || null;
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

/** Migrates legacy `forme` → `hp` on stats / deltas. */
function normalizeHpKey(obj = {}) {
  if (!obj || typeof obj !== 'object') return obj;
  const next = { ...obj };
  if (next.forme != null) {
    next.hp = (Number(next.hp) || 0) + Number(next.forme);
    delete next.forme;
  }
  return next;
}

function applyEffects(stats, effects = {}) {
  const next = normalizeHpKey({ ...stats });
  const eff = normalizeHpKey(effects);
  for (const [k, v] of Object.entries(eff)) {
    if (k === 'trophies' || typeof v !== 'number') continue;
    if (k in next || k === 'hp') next[k] = (Number(next[k]) || 0) + v;
  }
  next.hp = clamp(next.hp ?? 70, 0, 100);
  next.moral = clamp(next.moral ?? 70, 0, 100);
  next.or = Math.max(0, next.or ?? 0);
  next.renommee = Math.max(0, next.renommee ?? 0);
  return next;
}

/**
 * Moral élevé → moins de PV perdus ; moral bas → plus de pertes.
 * Les pertes de base sont un peu amplifiées (~×1.3).
 * moral 0 ≈ ×1.5 · moral 50 ≈ ×1.05 · moral 100 ≈ ×0.65 (après amplification)
 */
function scaleHpLossByMoral(deltas, moral) {
  const next = normalizeHpKey({ ...deltas });
  if (typeof next.hp !== 'number' || next.hp >= 0) return next;
  // Amplifie légèrement les pertes avant l’amortissement du moral
  next.hp = Math.round(next.hp * 1.3);
  const m = Number(moral);
  const moralVal = Number.isFinite(m) ? m : 50;
  const factor = clamp(1.5 - (moralVal / 100) * 0.85, 0.65, 1.6);
  next.hp = Math.round(next.hp * factor);
  // Au moins −1 si une perte était prévue
  if (next.hp >= 0) next.hp = -1;
  return next;
}

function clampScore(n) {
  return Math.max(0, Math.min(CAVE_DESTINY_SCORE_MAX, Math.round(Number(n) || 0)));
}

function rollStartingScore() {
  const span = CAVE_DESTINY_SCORE_START_MAX - CAVE_DESTINY_SCORE_START_MIN + 1;
  return CAVE_DESTINY_SCORE_START_MIN + Math.floor(Math.random() * span);
}

/**
 * Variation de score /100 selon le variant.
 * Réussite +4, neutre 0, échec −2. Ambition : +5 / −3.
 */
function computeEventScoreGain(variant, _stats, { ambitionLinked = false } = {}) {
  if (variant === 'bonus') return ambitionLinked ? 5 : 4;
  if (variant === 'malus') return ambitionLinked ? -3 : -2;
  return 0;
}

/** Famille d’arme requise pour qu’un event soit tirable. */
function requiredWeaponFamily(event) {
  if (!event) return null;
  return event.requiresWeaponFamily || null;
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

  if (character.prefersGrit && (next.renommee || 0) > 0 && (next.hp || 0) < 0) {
    next.renommee += 3;
  }
  if (character.prefersMagic && (next.cap || 0) > 0) {
    next.cap += 1;
  }
  if (character.prefersRebound && (next.moral || 0) < 0) {
    next.moral += 3;
  }
  if (character.prefersSpeed && (next.spd || 0) > 0) {
    next.spd += 1;
  }
  return next;
}

/** Profil compagnon compact (save locale + options d’event). */
export function slimCompanionProfile(char) {
  if (!char) return null;
  return {
    id: char.id || char.userId,
    name: char.name || 'Allié',
    race: char.race || null,
    class: char.class || null,
    characterImage: char.characterImage || null,
    ownerPseudo: char.ownerPseudo || null,
    baseStats: char.baseStats || null,
  };
}

/**
 * Échantillon de persos réels pour la quête Red (évite de sérialiser tout le roster).
 */
export function buildCompanionPool(allCharacters, playerId, count = 18) {
  const list = Array.isArray(allCharacters) ? allCharacters : [];
  if (!list.length) return [];

  // Pool déjà en profils Destiny (baseStats) — échantillon direct
  if (list[0]?.baseStats && !list[0]?.base) {
    const exclude = new Set(playerId ? [String(playerId)] : []);
    const filtered = list.filter((c) => c?.id && !exclude.has(String(c.id)));
    const source = filtered.length ? filtered : list.filter((c) => c?.id);
    const shuffled = [...source];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count).map(slimCompanionProfile).filter((c) => c?.id);
  }

  const picked = pickRandomGameCharacters(list, count, {
    excludeIds: playerId ? [playerId] : [],
  });
  return picked.map(slimCompanionProfile).filter((c) => c?.id);
}

const RED_ARENA_EVENT_IDS = new Set(['salameche_red', 'ronflex_red', 'coop_red']);

function pickRedCompanions(career, count = 3) {
  const pool = Array.isArray(career?.companionPool) ? career.companionPool : [];
  const used = new Set(
    [...(career?.flags?.redAlliesUsed || []), career?.character?.id]
      .filter(Boolean)
      .map(String)
  );
  const available = pool.filter((c) => c?.id && !used.has(String(c.id)));
  const source = available.length >= count ? available : pool.filter((c) => c?.id);
  if (!source.length) return [];
  // Mélange simple
  const shuffled = [...source];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count).map(slimCompanionProfile);
}

function companionStatHint(ally) {
  const s = ally?.baseStats || {};
  const ranked = [
    ['auto', s.auto],
    ['def', s.def],
    ['cap', s.cap],
    ['spd', s.spd],
    ['charisme', s.charisme],
  ]
    .filter(([, v]) => typeof v === 'number')
    .sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] || 'charisme';
}

function withAllyTip(deltas, ally) {
  const next = { ...deltas };
  const tip = companionStatHint(ally);
  next[tip] = (Number(next[tip]) || 0) + 2;
  return next;
}

function buildRedAllyOutcomes(eventId, ally) {
  const name = ally?.name || 'votre allié';

  if (eventId === 'salameche_red') {
    return trio(
      {
        text: `${name} et vous étouffez la Salamèche.
Vapeur, rires, et Red qui hoche : le duo tient.`,
        deltas: withAllyTip({ charisme: 3, or: 4, renommee: 2, hp: -3 }, ally),
      },
      {
        text: `${name} couvre votre flanc.
La flamme baisse assez pour passer, brûlures partagées.`,
        deltas: { charisme: 1, hp: -5, or: 2 },
      },
      {
        text: `Le timing est mauvais avec ${name}.
Le feu vous sépare, Red ricane, et l’arène reste fermée.`,
        deltas: { hp: -10, moral: -4, charisme: -1 },
      },
      [32, 40, 28],
    );
  }
  if (eventId === 'ronflex_red') {
    return trio(
      {
        text: `${name} trouve l’angle.
Le Ronflex s’écarte : baie partagée, couloir libre, duo soudé.`,
        deltas: withAllyTip({ charisme: 3, or: 6, hp: 2, renommee: 2 }, ally),
      },
      {
        text: `Avec ${name}, vous grimpez, poussez et attendez.
C’est assez pour passer, pas pour la légende.`,
        deltas: { charisme: 1, spd: 1, hp: -2 },
      },
      {
        text: `${name} et vous finissez sous la masse.
Il ne reste que le ronflement, le noir, et un moral en miettes.`,
        deltas: { hp: -12, moral: -5, charisme: -2 },
      },
      [32, 40, 28],
    );
  }
  // coop_red finale
  return trio(
    {
      text: `Le duo avec ${name} est parfait.
Dracaufeu tombe, et le Pointeau ADN reconnaît deux noms.`,
      deltas: withAllyTip(
        { charisme: 5, renommee: 6, or: 8, hp: -4, trophies: { coop: 1 } },
        ally
      ),
    },
    {
      text: `Vous remportez une victoire correcte aux côtés de ${name}.
La coordination reste moyenne, le butin se partage, et le respect reste muet.`,
      deltas: { charisme: 2, or: 3, hp: -5, renommee: 2 },
    },
    {
      text: `Florizarre vous ensevelit.
${name} vous regarde, muet, et le duo se brise sous les racines.`,
      deltas: { charisme: -3, moral: -6, hp: -8 },
    },
    [34, 38, 28],
  );
}

function buildRedRefuseOutcomes(eventId) {
  const mid = eventId !== 'salameche_red';
  return trio(
    {
      text: mid
        ? 'Vous saluez Red et quittez l’arène la tête haute. Elle reste ouverte pour d’autres duos plus assoiffés, et votre départ digne vous redonne du souffle autant que de la tenue.'
        : 'Vous déclinez l’invitation avec panache. Red hausse les épaules, un respect muet passe entre vous, et vous repartez plus léger, prêt à un autre combat.',
      deltas: { charisme: 2, moral: 3, spd: 1 },
    },
    {
      text: 'Ce n’est pas pour ce soir.\nVous laissez l’arène derrière vous, sans gloire ni brûlure, simplement parce que le moment n’est pas le bon.',
      deltas: { moral: 1 },
    },
    {
      text: mid
        ? 'Vous quittez trop vite, et un sifflet fuse dans vos oreilles. Red n’aime pas les alliés qui lâchent au milieu du chemin, et la rumeur part avant même que vous ayez refermé la porte.'
        : 'Quelques regards en coin vous suivent jusqu’à la sortie. Fuir Red n’apporte aucune couronne : seulement une rumeur qui s’accroche à votre nom.',
      deltas: { moral: -3, renommee: -2, charisme: -1 },
    },
    CAVE_DESTINY_TRIO_WEIGHTS,
  );
}

/** Options dynamiques : 3 personnages réels + refus (suite Arène de Red). */
function expandRedArenaEvent(event, career) {
  if (!RED_ARENA_EVENT_IDS.has(event?.id)) return event;
  // Toujours reconstruire (évite options compagnons fantômes hors Red)

  const allies = pickRedCompanions(career, 3);
  const allyOptions = allies.map((ally) => ({
    id: `ally_${ally.id}`,
    label: `Combattre avec ${ally.name}`,
    detail: [ally.race, ally.class, ally.ownerPseudo].filter(Boolean).join(' · '),
    companion: ally,
    outcomes: buildRedAllyOutcomes(event.id, ally),
  }));

  // Filet si pool vide : choix générique pour ne pas bloquer la run
  if (!allyOptions.length) {
    allyOptions.push({
      id: 'ally_generic',
      label: 'Combattre avec un allié de fortune',
      detail: 'Aucun perso réel disponible dans le pool',
      companion: null,
      outcomes: buildRedAllyOutcomes(event.id, { name: 'un allié de fortune', baseStats: {} }),
    });
  }

  const texts = {
    salameche_red:
      'Red vous propose un duo.\nUne Salamèche cracheuse bloque le passage.\nChoisissez un allié parmi les vrais caves, ou refusez.',
    ronflex_red:
      'Un Ronflex barre le couloir.\nRed attend votre prochain duo : un autre perso réel, ou la sortie.',
    coop_red:
      'C’est la finale chez Red.\nChoisissez un dernier allié réel pour affronter l’arène, ou refusez et partez.',
  };

  return {
    ...event,
    text: texts[event.id] || event.text,
    options: [
      ...allyOptions,
      {
        id: 'refuser',
        exitChain: true,
        label:
          event.id === 'salameche_red'
            ? 'Saluer Red et s’éclipser'
            : event.id === 'ronflex_red'
              ? 'Laisser le Ronflex… et le duo'
              : 'Quitter l’arène avant la finale',
        detail: 'Sortie RP : libère la suite Arène de Red',
        outcomes: buildRedRefuseOutcomes(event.id),
      },
    ],
  };
}

/**
 * @param {{ character: object, ambitionId: string, mentorId: string, weaponId: string, companionPool?: object[] }} opts
 * `character` = profil déjà construit via buildDestinyCharacterFromGame
 */
export function createCareer({ character, ambitionId, mentorId, weaponId, companionPool = [] }) {
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
      auto: 18,
      def: 18,
      cap: 18,
      spd: 18,
      charisme: 16,
    }),
    renommee: 0,
    or: 10,
    hp: 100,
    moral: 70,
  };

  stats = applyEffects(stats, ambition.effects);
  stats = applyEffects(stats, mentor.effects);
  stats = applyEffects(stats, weapon.effects);

  // Pas de sous-classe au départ : elle se gagne en run (Collège, etc.)
  const careerCharacter = { ...character, subclass: null };
  const pool =
    Array.isArray(companionPool) && companionPool.length
      ? companionPool.map(slimCompanionProfile).filter((c) => c?.id)
      : [];

  return {
    version: 10,
    createdAt: Date.now(),
    season: 1,
    maxSeasons: CAVE_DESTINY_SEASON_COUNT,
    phase: 'playing',
    character: careerCharacter,
    ambition,
    mentor,
    weapon,
    subclass: null,
    companionPool: pool,
    stats,
    trophies: emptyTrophies(),
    runScore: rollStartingScore(),
    scoreScale: 100,
    ambitionEventsFaced: 0,
    chainProgress: {},
    queuedEventId: null,
    suitesStarted: 0,
    flags: {},
    endReason: null,
    history: [],
    recentEventIds: [],
    currentEvent: null,
    lastOutcome: null,
  };
}

function eventWeight(event, career, { seen = null, allowRepeat = false } = {}) {
  let w = getEventBaseWeight(event);
  const ambitionId = career.ambition?.id;
  const hp = Number(career.stats?.hp) || 0;

  // Suite : étapes non débloquées = impossibles
  const chainInfo = getChainStep(event.id);
  if (chainInfo && isChainLockedStep(event.id, career)) {
    return 0;
  }

  const suitesStarted = Number(career.suitesStarted) || 0;
  const activeSuites = Object.keys(career.chainProgress || {}).length;
  const isOpening = chainInfo && chainInfo.stepIndex === 0;
  const isMultiStepQuest = (chainInfo?.chain?.steps?.length || 0) > 1;

  // Cible ~3 suites / run (20 saisons) : freiner les ouvertures après 2–3 démarrages
  if (isOpening && isMultiStepQuest) {
    if (suitesStarted >= 4) w *= 0.06;
    else if (suitesStarted >= 3) w *= 0.22;
    else if (suitesStarted >= 2) w *= 0.5;
    else w *= 0.85;
    // Peu de quêtes simultanées
    if (activeSuites >= 2) w *= 0.12;
    else if (activeSuites >= 1) w *= 0.55;
  }

  // Ouverture alignée ambition : coup de pouce (×1.65)
  if (
    ambitionId &&
    isOpening &&
    chainInfo.chain.ambition === ambitionId
  ) {
    w *= 1.65;
  }
  // Étape débloquée (suite en cours) : un peu plus probable, sans forcer la saison suivante
  if (
    chainInfo &&
    chainInfo.stepIndex > 0 &&
    career.chainProgress?.[chainInfo.chainId] === chainInfo.stepIndex
  ) {
    w *= 1.55;
  }
  // Finale de suite (ambition) : boost une fois débloquée
  if (ambitionId && isAmbitionChainFinale(event.id, ambitionId)) {
    w *= 1.5;
  }

  if (hp < 35 && event.id === 'blessure') w *= 2.2;
  if (hp < 25 && event.tags?.includes('combat')) w *= 0.55;

  // Quêtes / events liés à une famille d’arme : gate dure
  const needFamily = requiredWeaponFamily(event);
  if (needFamily && career.weapon?.family !== needFamily) {
    return 0;
  }
  // Ouverture quête d’arme : visible si la famille match, sans saturer la run
  if (
    event.tags?.includes('arme_quete') &&
    isOpening &&
    needFamily &&
    career.weapon?.family === needFamily
  ) {
    w *= 1.55;
  }

  const seenIds = seen || seenEventIds(career);
  // Défi Ornn reporté : peut revenir (surtout avec arme légendaire)
  const ornnPending = career.flags?.ornn_duel_pending && event.id === 'ornn_jugement';
  if (seenIds.has(event.id) && !ornnPending) {
    // Quasi jamais de doublon ; seulement si le pool unique est épuisé
    w *= allowRepeat ? 0.04 : 0;
  }
  if (ornnPending) {
    w *= career.weapon?.rarity === RARITY.LEGENDAIRE ? 3.2 : 1.6;
  }

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
  // Sous-classe : moins utile si déjà obtenue
  if (event.tags?.includes('subclass') && career.subclass) {
    w *= 0.2;
  }
  return w;
}

/** Options dynamiques pour l’event Collège / sous-classes */
function expandSubclassEvent(event, character, career) {
  if (event.id !== 'college_sous_classe') return event;
  const list = getSubclassesForClass(character?.class) || [];
  const className = character?.class || 'votre classe';

  const subclassOptions = list.map((sc, idx) => ({
    id: `sc_${sc.id}`,
    label: `Embrasser la voie « ${sc.name} »`,
    detail: subclassDestinyDetail(sc),
    require: career?.subclass
      ? { noSubclass: true }
      : idx === 0
        ? { stats: { cap: 24 }, noSubclass: true }
        : { stats: { auto: 24 }, noSubclass: true },
    subclassId: sc.id,
    subclassName: sc.name,
    outcomes: buildSubclassEmbraceOutcomes(sc, className),
  }));

  const eliteHard = list[1] || list[0] || null;
  const eliteSoft = list[0] || null;
  const eliteHardFocus = eliteHard ? destinyDeltasFromSubclass(eliteHard, 1.15) : {};
  const eliteSoftFocus = eliteSoft ? destinyDeltasFromSubclass(eliteSoft, 0.55) : {};

  return {
    ...event,
    text: fillWeaponPlaceholders(
      `Au Collège Kunugigaoka, Koro Sensei propose une sous-classe à votre ${className}.\nDeux voies s’ouvrent, chacune avec ses exigences.`,
      career?.weapon
    ),
    options: [
      {
        id: 'observer',
        label: 'Assister aux cours sans s’engager',
        outcomes: trio(
          {
            text: 'Vous comprenez mieux les voies.\nVous pourrez peut-être vous engager plus tard.',
            deltas: { cap: 2, moral: 2 },
          },
          {
            text: 'Le cours reste correct, sans révélation.\nVous repartez avec une note et peu d’éclat.',
            deltas: { cap: 1 },
          },
          {
            text: 'Vous vous endormez au fond de la salle.\nL’interrogation surprise vous tombe dessus, et vous la ratez.',
            deltas: { moral: -3 },
          }
        ),
      },
      ...subclassOptions,
      {
        id: 'elite',
        label: 'Forcer la voie d’élite du Collège',
        require: {
          stats: { cap: 30, auto: 28 },
          minRenommee: 18,
          weaponRarities: ['rare', 'légendaire'],
          noSubclass: true,
        },
        outcomes: [
          {
            variant: 'bonus',
            weight: 35,
            text: eliteHard
              ? `Koro Sensei applaudit.\nLes deux voies vous inspirent, et vous forcez la plus dure : « ${eliteHard.name} ».`
              : 'Koro Sensei applaudit.\nLes deux voies vous inspirent, et vous choisissez la plus dure.',
            deltas: { renommee: 8, moral: 2, hp: -4, ...eliteHardFocus },
            subclassGain: eliteHard
              ? { id: eliteHard.id, name: eliteHard.name }
              : null,
          },
          {
            variant: 'neutre',
            weight: 40,
            text: eliteSoft
              ? `Vous touchez presque le but.\nLa voie « ${eliteSoft.name} » s’ouvre à demi sous vos pas.`
              : 'Vous touchez presque le but.\nUne seule voie s’ouvre à demi sous vos pas.',
            deltas: { hp: -3, moral: 1, ...eliteSoftFocus },
            subclassGain: eliteSoft
              ? { id: eliteSoft.id, name: eliteSoft.name }
              : null,
          },
          {
            variant: 'malus',
            weight: 25,
            text: 'Vous êtes arrivé trop tôt.\nLe Collège vous renvoie sans cérémonie.',
            deltas: { hp: -10, moral: -6, renommee: -2 },
          },
        ],
      },
    ],
  };
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

/**
 * Ambition allumée uniquement en finale de suite
 * (ex. donjons : boss de forêt / tour / grotte… pas le rat du début).
 * Suites 1 étape (invitation / défi reportable) : pas de violet avant le choix.
 */
export function isAmbitionLinkedEvent(event, career) {
  const ambitionId = career?.ambition?.id;
  if (!ambitionId || !event?.id) return false;
  if (!isAmbitionChainFinale(event.id, ambitionId)) return false;
  const info = getChainStep(event.id);
  // Multi-étapes : la finale s’affiche tout de suite
  if (info && info.chain.steps.length > 1) return true;
  return false;
}

/** Payoff d’ambition après résolution (choix « participer / affronter » sur suites 1 étape). */
function isAmbitionPayoff(event, career, option, outcome) {
  const ambitionId = career?.ambition?.id;
  if (!ambitionId || !event?.id) return false;
  if (!isAmbitionChainFinale(event.id, ambitionId)) return false;
  const info = getChainStep(event.id);
  if (info && info.chain.steps.length > 1) return true;
  return !!(option?.ambitionPayoff || outcome?.ambitionPayoff);
}

/**
 * Amplifie les gains d’un event d’ambition : score, stats positives, trophées.
 * Les pertes de PV ne sont pas adoucies (le destin exige un prix).
 */
function applyAmbitionEventImpact(deltas, trophyDelta, scoreGain, variant) {
  const next = { ...deltas };
  for (const [k, v] of Object.entries(next)) {
    if (typeof v !== 'number' || v <= 0) continue;
    if (k === 'hp') {
      // Soins un peu meilleurs sur la voie
      next[k] = Math.round(v * 1.25);
    } else {
      next[k] = Math.max(v + 1, Math.round(v * 1.4));
    }
  }
  if (variant === 'bonus') {
    next.renommee = (next.renommee || 0) + 2;
    next.moral = (next.moral || 0) + 1;
  }

  let trophies = trophyDelta ? { ...trophyDelta } : null;
  if (trophies) {
    for (const [k, v] of Object.entries(trophies)) {
      if (typeof v === 'number' && v > 0) trophies[k] = v + 1;
    }
  }

  // Score /100 : ambition = +5 / −3 (filet si l’amont n’a pas déjà amplifié)
  let gain = scoreGain;
  if (variant === 'bonus') gain = Math.max(gain, 5);
  else if (variant === 'malus') gain = Math.min(gain, -3);
  return { deltas: next, trophyDelta: trophies, scoreGain: gain };
}

/**
 * Sortie RP d’une suite : libère le slot + vrai trio (réussite / neutre / échec).
 * Prose fluide : vraies phrases, pas de slogans hachés.
 */
function buildChainExitChoice(info) {
  const isOpening = info.stepIndex === 0;
  const label = info.chain.label || 'cette quête';
  const ambition = info.chain.ambition || 'autre';

  const byAmbition = {
    donjons: {
      open: {
        label: 'Faire demi-tour avant l’entrée',
        detail: 'Ranger le sac et laisser le donjon aux obstinés',
        bonus: {
          text: `Vous faites demi-tour proprement : ${label} peut attendre. Elle se referme derrière vous, et vous en profitez pour souffler et reprendre vos marques.`,
          deltas: { spd: 2, moral: 3, hp: 2 },
        },
        neutre: {
          text: `Vous laissez ${label} derrière la porte sans chercher l’exploit. Ce n’est ni une gloire ni une honte, seulement une saison où vous choisissez un autre chemin.`,
          deltas: { moral: 1 },
        },
        malus: {
          text: `Vous reculez trop vite, et un rire file dans le couloir. ${label} n’oublie pas ceux qui fuient avant même d’avoir franchi le seuil, et la rumeur vous colle déjà aux talons.`,
          deltas: { moral: -3, renommee: -2, charisme: -1 },
        },
      },
      mid: {
        label: 'Repartir vivant, les mains vides',
        detail: 'Abandonner la progression pour sauver sa peau',
        bonus: {
          text: `Vous choisissez de partir vivant. ${label} garde ses trophées, mais votre sang reste chaud et votre garde plus solide : parfois la sagesse vaut mieux qu’un butin.`,
          deltas: { def: 2, moral: 2, hp: 3 },
        },
        neutre: {
          text: `Vous tournez les talons et ${label} se referme sans cérémonie. Il faudra tout reprendre depuis le début si vous osez y revenir un jour.`,
          deltas: {},
        },
        malus: {
          text: `Votre retraite est maladroite : une pierre vous accroche, la sortie vous humilie, et ${label} semble vous cracher dehors sous le regard des autres caves.`,
          deltas: { hp: -4, moral: -3, renommee: -2 },
        },
      },
    },
    tournoi: {
      open: {
        label: 'Rendre les armes avant le Hall',
        detail: 'Décliner le bracket et laisser les autres se battre',
        bonus: {
          text: `Vous saluez le Hall et rangez vos armes avec dignité. Refuser ${label} de cette manière n’offense personne : on respecte ceux qui savent partir la tête haute.`,
          deltas: { charisme: 3, moral: 2 },
        },
        neutre: {
          text: `Pas de couronne cette saison. Vous laissez ${label} aux autres noms, sans fanfare ni regret particulier, et le Hall passe déjà à la suite.`,
          deltas: { moral: 1 },
        },
        malus: {
          text: `On murmure que vous avez peur du public. ${label} vous raye sans cérémonie, et le mot « peureux » voyage plus vite qu’une bonne nouvelle à la Taverne.`,
          deltas: { renommee: -3, charisme: -2, moral: -2 },
        },
      },
      mid: {
        label: 'Quitter le bracket sans fanfare',
        detail: 'Sortir du tournoi et libérer votre place',
        bonus: {
          text: `Vous quittez le bracket la tête haute. Mieux vaut un forfait propre sur ${label} qu’une défaite ridicule sous les yeux de toute l’arène, et quelques regards approuvent votre choix.`,
          deltas: { charisme: 2, moral: 3, renommee: 1 },
        },
        neutre: {
          text: `Votre parcours s’arrête là. ${label} continue sans vous, les combats s’enchaînent, et votre nom glisse hors du tableau sans faire de bruit.`,
          deltas: {},
        },
        malus: {
          text: `Vous abandonnez sous les sifflets. Le Hall retient votre nom, non pour la gloire, mais pour s’en moquer jusqu’à la pinte suivante.`,
          deltas: { renommee: -4, moral: -3, charisme: -1 },
        },
      },
    },
    forge: {
      open: {
        label: 'Laisser le fer dormir ce soir',
        detail: 'Éteindre l’enclume et laisser la forge attendre',
        bonus: {
          text: `Vous posez le marteau et laissez le fer dormir. Même Ornn comprend qu’un bras fatigué gâche le travail de ${label}, et cette prudence vous rend un peu d’or et de sang-froid.`,
          deltas: { def: 2, moral: 2, or: 2 },
        },
        neutre: {
          text: `Pas de braise aujourd’hui. ${label} reste froide, l’enclume se tait, et vous repartez sans avoir ni gagné ni perdu grand-chose.`,
          deltas: {},
        },
        malus: {
          text: `Les soufflets sifflent votre absence comme un affront. La forge juge votre refus comme une insulte, et l’humiliation vous coupe un peu le bras avant même le premier coup.`,
          deltas: { moral: -3, renommee: -2, auto: -1 },
        },
      },
      mid: {
        label: 'Éteindre la forge et partir',
        detail: 'Abandonner la voie du fer et tout reprendre plus tard',
        bonus: {
          text: `Vous retirez le fer du feu à temps. ${label} n’est pas ruinée : elle est seulement reportée, et votre main, elle, reste assez ferme pour un autre jour.`,
          deltas: { auto: 1, def: 2, moral: 2 },
        },
        neutre: {
          text: `La braise meurt entre vos doigts. ${label} devra être reprise depuis la première étincelle, et ce constat vous laisse un goût de cendre.`,
          deltas: { moral: -1 },
        },
        malus: {
          text: `Vous fuyez la chaleur trop vite. Une étincelle vous brûle le poignet, comme si la forge punissait l’orgueil de ceux qui lâchent au milieu du travail.`,
          deltas: { hp: -5, moral: -3, renommee: -2 },
        },
      },
    },
    ombres: {
      open: {
        label: 'Reculer avant l’obscurité',
        detail: 'Ne pas descendre et garder la lumière',
        bonus: {
          text: `Vous restez au seuil et laissez ${label} murmurer dans le noir. L’ombre se tait peu à peu, et cette prudence vous redonne du souffle ainsi qu’un peu de clarté d’esprit.`,
          deltas: { spd: 2, cap: 1, moral: 3 },
        },
        neutre: {
          text: `Pas ce noir-là, pas ce soir. Vous laissez ${label} aux fous courageux et regagnez la lumière sans autre incident.`,
          deltas: { moral: 1 },
        },
        malus: {
          text: `En reculant, vous trébuchez, et quelque chose rit dans l’ombre. ${label} n’aime pas les demi-mesures : votre moral et votre concentration en gardent la marque.`,
          deltas: { moral: -4, cap: -1, renommee: -1 },
        },
      },
      mid: {
        label: 'Remonter sans regarder derrière',
        detail: 'Abandonner la descente et libérer la place',
        bonus: {
          text: `Vous remontez à temps, sans vous retourner. ${label} garde ses secrets, mais vous gardez votre souffle et une part de votre force : c’est déjà une victoire discrète.`,
          deltas: { spd: 2, hp: 2, moral: 2 },
        },
        neutre: {
          text: `Vous regagnez la surface. ${label} se referme comme si vous n’aviez jamais foulé ses marches, et le monde d’en haut reprend son cours.`,
          deltas: {},
        },
        malus: {
          text: `Quelque chose vous suit jusqu’à la sortie. Vous échappez à ${label}, mais pas à la peur qu’elle a plantée dans votre nuque, et vos pas restent lourds longtemps après.`,
          deltas: { hp: -4, moral: -4, charisme: -1 },
        },
      },
    },
    autre: {
      open: {
        label: 'Passer son chemin, le regard ailleurs',
        detail: `Ne pas s’engager dans ${label}`,
        bonus: {
          text: `Vous croisez ${label} et continuez votre route. En évitant ce détour, vous gagnez un peu d’or, un peu de tenue, et la sensation d’avoir choisi juste.`,
          deltas: { charisme: 2, or: 2, moral: 2 },
        },
        neutre: {
          text: `Pas cette histoire-là. ${label} attendra un autre cave, et vous poursuivez la vôtre sans que rien d’important ne change.`,
          deltas: { moral: 1 },
        },
        malus: {
          text: `Vous refusez trop sèchement, et ceux qui regardaient retiennent le geste plutôt que votre gloire. La rumeur part petite, mais elle part quand même.`,
          deltas: { renommee: -2, moral: -2 },
        },
      },
      mid: {
        label: 'Couper le fil et s’en aller',
        detail: `Abandonner ${label} et tout recommencer plus tard`,
        bonus: {
          text: `Vous coupez le fil proprement. ${label} n’est plus votre fardeau pour l’instant, et cette liberté retrouvée vous allège l’esprit autant que la bourse.`,
          deltas: { spd: 1, moral: 3, or: 1 },
        },
        neutre: {
          text: `Le fil se brise sans drame. ${label} retombe à zéro, comme une page qu’on referme au milieu du chapitre.`,
          deltas: {},
        },
        malus: {
          text: `Vous lâchez trop vite, et ceux qui suivaient ${label} ne retiennent que votre dos. La place se libère, mais votre réputation prend un coup au passage.`,
          deltas: { renommee: -3, moral: -3, hp: -2 },
        },
      },
    },
  };

  const pack = (byAmbition[ambition] || byAmbition.autre)[isOpening ? 'open' : 'mid'];
  return {
    id: 'refuser_quete',
    exitChain: true,
    label: pack.label,
    detail: pack.detail,
    outcomes: trio(pack.bonus, pack.neutre, pack.malus, CAVE_DESTINY_TRIO_WEIGHTS),
  };
}

/**
 * Ajoute une sortie RP sur toute suite (sauf si déjà présent, ex. Red / Anciens / Ornn).
 * Libère le slot de quête active + roll réussite / neutre / échec.
 */
function expandChainRefuseOption(event, career) {
  const info = getChainStep(event?.id);
  if (!info) return event;
  // Red gère déjà sa sortie dédiée
  if (RED_ARENA_EVENT_IDS.has(event.id)) return event;
  // Suites 1 étape avec sortie soft déjà prévue
  if (event.id === 'tournoi_anciens' || event.id === 'ornn_jugement') return event;
  if (event.options?.some((o) => o?.exitChain || o?.id === 'refuser_quete' || o?.id === 'refuser')) {
    return event;
  }

  return {
    ...event,
    options: [...(event.options || []), buildChainExitChoice(info)],
  };
}

function cloneEventDef(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    ...raw,
    tags: Array.isArray(raw.tags) ? [...raw.tags] : raw.tags,
    options: (raw.options || []).map((o) => ({
      ...o,
      outcomes: (o.outcomes || []).map((x) => ({ ...x, deltas: x.deltas ? { ...x.deltas } : x.deltas })),
    })),
  };
}

function stripCompanionOptions(event) {
  if (!event || RED_ARENA_EVENT_IDS.has(event.id)) return event;
  const options = (event.options || []).filter((o) => {
    if (o?.companion) return false;
    const id = String(o?.id || '');
    if (id === 'ally_generic' || id.startsWith('ally_')) return false;
    return true;
  });
  return options.length === (event.options || []).length ? event : { ...event, options };
}

function materializeEvent(raw, career) {
  let event = cloneEventDef(raw);
  event = expandSubclassEvent(event, career.character, career);
  event = expandRedArenaEvent(event, career);
  event = expandChainRefuseOption(event, career);
  // Filet : aucun choix coop hors arène de Red
  event = stripCompanionOptions(event);
  const options = getOptionsForEvent(event, career.character, career);
  const localized = localizeEventForWeapon({ ...event, options }, career.weapon);
  const ambitionLinked = isAmbitionLinkedEvent(localized, career);
  const rawChain = buildChainUiMeta(localized.id);
  const chain = rawChain?.total > 1 ? rawChain : null;
  const ambitionQuest = !!(
    career.ambition?.id &&
    chain?.ambition &&
    chain.ambition === career.ambition.id
  );
  const showAmbitionMeta = ambitionLinked || ambitionQuest;
  return {
    id: localized.id,
    title: localized.title,
    text: localized.text,
    tags: localized.tags,
    rarity: localized.rarity || 'common',
    options: localized.options,
    chain,
    ambitionLinked,
    /** Suite / ouverture alignée sur l’ambition du joueur (tag UI). */
    ambitionQuest,
    ambitionId: showAmbitionMeta ? career.ambition?.id || null : null,
    ambitionName: showAmbitionMeta ? career.ambition?.name || null : null,
    ambitionIcon: showAmbitionMeta ? career.ambition?.icon || '🎯' : null,
  };
}

function redEventNeedsExpand(event) {
  return RED_ARENA_EVENT_IDS.has(event?.id) && !event?.options?.some((o) => o.companion || o.id === 'refuser');
}

export function drawEvent(career) {
  // Suite en cours : forcer l’étape suivante (rat → niveau 2 → boss…)
  if (career.queuedEventId) {
    const forced = CAVE_DESTINY_EVENTS.find((e) => e.id === career.queuedEventId);
    if (forced) {
      return materializeEvent(forced, career);
    }
  }

  const seen = seenEventIds(career);
  const weightedFresh = CAVE_DESTINY_EVENTS.map((e) => ({
    ...e,
    weight: eventWeight(e, career, { seen, allowRepeat: false }),
  })).filter((e) => e.weight > 0);

  // Priorité absolue aux events jamais vus dans la run
  const pool =
    weightedFresh.length >= 1
      ? weightedFresh
      : CAVE_DESTINY_EVENTS.map((e) => ({
          ...e,
          weight: eventWeight(e, career, { seen, allowRepeat: true }),
        })).filter((e) => e.weight > 0);

  let raw = pickWeighted(pool.length ? pool : CAVE_DESTINY_EVENTS);
  return materializeEvent(raw, career);
}

export function ensureCurrentEvent(career) {
  if (career.phase !== 'playing') return career;
  if (career.currentEvent) {
    // Migre les saves : Red sans compagnons, ou tag ambitionQuest manquant
    const needsRematerialize =
      redEventNeedsExpand(career.currentEvent) ||
      typeof career.currentEvent.ambitionQuest !== 'boolean';
    if (needsRematerialize) {
      const raw = CAVE_DESTINY_EVENTS.find((e) => e.id === career.currentEvent.id);
      if (raw) {
        return { ...career, currentEvent: materializeEvent(raw, career) };
      }
    }
    return career;
  }
  const currentEvent = drawEvent(career);
  const clearedQueue =
    career.queuedEventId && currentEvent?.id === career.queuedEventId
      ? null
      : career.queuedEventId || null;
  return {
    ...career,
    currentEvent,
    queuedEventId: clearedQueue,
  };
}

/** Réinjecte un pool compagnons (reprise de save / pool chargé tardivement). */
export function withCompanionPool(career, rawPool) {
  if (!career) return career;
  if (Array.isArray(career.companionPool) && career.companionPool.length >= 3) {
    return ensureCurrentEvent(career);
  }
  const nextPool = buildCompanionPool(rawPool, career.character?.id, 18);
  return ensureCurrentEvent({
    ...career,
    companionPool: nextPool.length ? nextPool : career.companionPool || [],
  });
}

/** Met à jour la progression de suite après un choix. */
function advanceChainState(career, eventId, variant) {
  const info = getChainStep(eventId);
  const chainProgress = { ...(career.chainProgress || {}) };
  let queuedEventId = null;

  if (!info) {
    return { chainProgress, queuedEventId };
  }

  // Échec : la suite se brise (retour à la case départ)
  if (variant === 'malus') {
    delete chainProgress[info.chainId];
    return { chainProgress, queuedEventId: null };
  }

  if (info.isFinale) {
    delete chainProgress[info.chainId];
    return { chainProgress, queuedEventId: null };
  }

  // Bonus / neutre : débloque l’étape suivante (tirage futur, pas la saison d’après)
  chainProgress[info.chainId] = info.stepIndex + 1;
  queuedEventId = null;
  return { chainProgress, queuedEventId };
}

export function resolveChoice(career, optionIndex) {
  if (!career.currentEvent) return career;
  const option = career.currentEvent.options[optionIndex];
  if (!option || option.locked) return career;

  // Garantit un trio bonus/neutre/malus même sur d’anciennes saves
  let outcomes = option.outcomes || [];
  const variants = new Set(outcomes.map((o) => o.variant).filter(Boolean));
  if (!variants.has('bonus') || !variants.has('neutre') || !variants.has('malus')) {
    // fallback : redistribue poids existants
    outcomes = outcomes.length
      ? outcomes
      : [{ weight: 100, text: 'Rien de notable ne se produit cette fois.', deltas: {} }];
  }

  // Influence secrète des stats (jamais exposée à l’UI)
  const definedCheck = lookupDefinedCheck(career.currentEvent.id, option.id);
  const optionForCheck = definedCheck ? { ...option, check: definedCheck } : option;
  outcomes = applySecretStatWeights(outcomes, career, optionForCheck, career.currentEvent);
  // Défi Ornn : difficulté selon arme légendaire / forgée
  outcomes = applyOrnnDuelWeaponScaling(outcomes, career, option, career.currentEvent);

  const outcome = pickWeighted(outcomes);
  let deltas = normalizeHpKey({ ...(outcome.deltas || {}) });
  const trophyDelta = deltas.trophies;
  delete deltas.trophies;
  const weaponProgress = outcome.weaponProgress || deltas.weaponProgress || null;
  delete deltas.weaponProgress;
  const subclassGain = outcome.subclassGain || null;
  deltas = characterBonus(career.character, deltas);
  // Moral amortit (ou aggrave) les pertes de PV
  deltas = scaleHpLossByMoral(deltas, career.stats?.moral);

  const variant = outcome.variant || 'neutre';
  let resolvedTrophyDelta = trophyDelta;

  const ambitionLinked = isAmbitionPayoff(career.currentEvent, career, option, outcome);
  let scoreGain = computeEventScoreGain(variant, career.stats, { ambitionLinked });
  if (ambitionLinked) {
    const boosted = applyAmbitionEventImpact(deltas, resolvedTrophyDelta, scoreGain, variant);
    deltas = boosted.deltas;
    resolvedTrophyDelta = boosted.trophyDelta;
    scoreGain = boosted.scoreGain;
  }

  const runScore = clampScore((Number(career.runScore) || 0) + scoreGain);

  let stats = applyEffects(career.stats, deltas);
  const trophies = applyTrophies(career.trophies, resolvedTrophyDelta);

  let weapon = career.weapon;
  let subclass = career.subclass || null;
  let outcomeText = fillWeaponPlaceholders(outcome.text, weapon);
  if (
    career.currentEvent.id === 'ornn_jugement' &&
    ORNN_DUEL_FIGHT_OPTIONS.has(option.id)
  ) {
    const hasLegendary = weapon?.rarity === RARITY.LEGENDAIRE;
    const forged = !!career.flags?.arme_legendaire_forgee;
    if (!hasLegendary) {
      outcomeText = `${outcomeText} (Sans arme légendaire, Ornn ne vous a fait aucune faveur.)`;
    } else if (forged) {
      outcomeText = `${outcomeText} (Le fer reforgé par Ornn a parlé pour vous.)`;
    } else {
      outcomeText = appendOutcomeProse(
        outcomeText,
        'Votre lignée légendaire a tenu.\nUne forge divine l’aurait rendue plus sûre encore.',
      );
    }
  }
  const chainMeta = buildChainUiMeta(career.currentEvent.id);
  const questRefuse =
    !!option.exitChain ||
    option.id === 'refuser_quete' ||
    (RED_ARENA_EVENT_IDS.has(career.currentEvent.id) && option.id === 'refuser');
  // Sortie de quête : le texte d’outcome porte déjà la prose (pas de suffixe haché)
  if (questRefuse && chainMeta) {
    /* no-op */
  } else if (ambitionLinked && career.ambition?.name) {
    const mark =
      variant === 'bonus'
        ? `Sous le signe de « ${career.ambition.name} », cette finale laisse la Cave vous devoir encore une dette.`
        : variant === 'malus'
          ? `Même à la finale, « ${career.ambition.name} » se souvient des chutes, et la cicatrice reste utile.`
          : `Cette finale de « ${chainMeta?.label || career.ambition.name} » grave votre ambition sans fanfare, mais elle compte.`;
    outcomeText = appendOutcomeProse(outcomeText, mark);
  } else if (chainMeta && !chainMeta.isFinale && variant !== 'malus') {
    outcomeText = appendOutcomeProse(
      outcomeText,
      `L’étape ${chainMeta.step} sur ${chainMeta.total} de ${chainMeta.label} est validée.`,
    );
  } else if (chainMeta && !chainMeta.isFinale && variant === 'malus') {
    outcomeText = appendOutcomeProse(
      outcomeText,
      `La suite ${chainMeta.label} se brise ici.\nIl faudra tout reprendre depuis le début si vous voulez y revenir.`,
    );
  }
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
        outcomeText = appendOutcomeProse(outcomeText, result.message);
      }
    } else if (result.message) {
      outcomeText = appendOutcomeProse(outcomeText, result.message);
    }
  }

  // Voie du fer : l’étape « révélation » impose l’arme légendaire (si pas malus)
  if (
    variant !== 'malus' &&
    career.currentEvent.id === 'arme_legendaire_revelation' &&
    weapon?.rarity !== RARITY.LEGENDAIRE
  ) {
    const forced = grantLegendaryDestinyWeapon(weapon);
    if (forced.changed || Object.keys(forced.statDelta || {}).length) {
      weapon = forced.weapon;
      stats = applyEffects(stats, forced.statDelta);
      Object.assign(weaponDeltas, forced.statDelta);
      outcomeText = `${outcomeText} La lignée s’éveille : ${forced.message || 'votre arme devient légendaire.'}`;
    } else if (forced.message) {
      outcomeText = `${outcomeText} ${forced.message}`;
    }
  }

  // Flags d’outcome (ex. défi Ornn reporté)
  const nextFlags = { ...(career.flags || {}) };
  if (outcome.flags && typeof outcome.flags === 'object') {
    Object.assign(nextFlags, outcome.flags);
  }
  // Forge d’Ornn réussie → l’arme légendaire est considérée forgée (duel plus favorable)
  if (career.currentEvent.id === 'forge_ornn' && variant !== 'malus') {
    nextFlags.arme_legendaire_forgee = true;
  }
  // Duel Ornn : report → peut revenir ; affrontement → challenge clos
  if (career.currentEvent.id === 'ornn_jugement') {
    if (option.id === 'reporter' || outcome.flags?.ornn_duel_pending) {
      nextFlags.ornn_duel_pending = true;
    } else if (option.ambitionPayoff || outcome.ambitionPayoff) {
      delete nextFlags.ornn_duel_pending;
    }
  }
  // Arène de Red : mémorise l’allié choisi (et évite de le reproposer)
  if (RED_ARENA_EVENT_IDS.has(career.currentEvent.id) && option.companion?.id) {
    nextFlags.redAlly = slimCompanionProfile(option.companion);
    const used = new Set([...(nextFlags.redAlliesUsed || []).map(String)]);
    used.add(String(option.companion.id));
    nextFlags.redAlliesUsed = Array.from(used);
  }
  if (RED_ARENA_EVENT_IDS.has(career.currentEvent.id) && option.id === 'refuser') {
    delete nextFlags.redAlly;
  }

  if (subclassGain?.id && !subclass) {
    subclass = { id: subclassGain.id, name: subclassGain.name };
    outcomeText = appendOutcomeProse(
      outcomeText,
      `Vous obtenez la sous-classe « ${subclass.name} ».`,
    );
  }

  const dead = (Number(stats.hp) || 0) <= 0;
  if (dead) {
    stats = { ...stats, hp: 0 };
    outcomeText = appendOutcomeProse(
      outcomeText,
      'Vos PV tombent à 0.\nLa Cave referme le livre.',
    );
  }

  const mergedDeltas = normalizeHpKey({ ...deltas, ...weaponDeltas });

  const historyEntry = {
    season: career.season,
    eventId: career.currentEvent.id,
    title: career.currentEvent.title,
    choice: option.label,
    text: outcomeText,
    variant,
    deltas: mergedDeltas,
    scoreGain,
    died: dead,
    ambitionLinked,
    weaponProgress: weaponProgress || null,
    weaponName: weapon?.name || null,
    weaponRarity: weapon?.rarity || null,
    subclassName: subclass?.name || null,
  };

  // Historique long pour anti-doublon (toute la run)
  let recentEventIds = [...(career.recentEventIds || []), career.currentEvent.id].slice(-20);
  // Report du défi Ornn : on retire l’id pour qu’il puisse revenir
  if (nextFlags.ornn_duel_pending && career.currentEvent.id === 'ornn_jugement' && option.id === 'reporter') {
    recentEventIds = recentEventIds.filter((id) => id !== 'ornn_jugement');
  }
  // Refus / abandon de suite : retire les ids pour pouvoir la relancer plus tard
  if (questRefuse && chainMeta) {
    const steps = getChainStep(career.currentEvent.id)?.chain?.steps || [];
    recentEventIds = recentEventIds.filter((id) => !steps.includes(id));
  }
  const nextSeason = career.season + 1;
  const hitSeasonCap = !dead && nextSeason > career.maxSeasons;
  const finished = dead;

  const agedStats = dead
    ? stats
    : applyEffects(stats, {
        auto: 1,
        def: 1,
        cap: career.character?.prefersMagic ? 1 : 0,
        spd: career.character?.prefersSpeed ? 1 : 0,
      });

  // Suites optionnelles : décliner / reporter / refuser / abandonner → pas de progression
  const softLeave =
    (career.currentEvent.id === 'tournoi_anciens' && option.id !== 'participer') ||
    (career.currentEvent.id === 'ornn_jugement' && option.id === 'reporter') ||
    questRefuse;
  let chainState;
  if (dead) {
    chainState = { chainProgress: { ...(career.chainProgress || {}) }, queuedEventId: null };
  } else if (softLeave) {
    const chainProgress = { ...(career.chainProgress || {}) };
    // Libère le slot de quête active
    if (questRefuse && chainMeta?.chainId) {
      delete chainProgress[chainMeta.chainId];
    }
    chainState = { chainProgress, queuedEventId: null };
  } else {
    chainState = advanceChainState(career, career.currentEvent.id, variant);
  }

  // Compte les suites réellement engagées (ouverture réussie, hors refus soft)
  let suitesStarted = Number(career.suitesStarted) || 0;
  const openedChain = getChainStep(career.currentEvent.id);
  if (
    !dead &&
    !softLeave &&
    variant !== 'malus' &&
    openedChain &&
    openedChain.stepIndex === 0 &&
    (openedChain.chain?.steps?.length || 0) > 1
  ) {
    suitesStarted += 1;
  }

  let next = {
    ...career,
    weapon,
    subclass,
    stats: agedStats,
    trophies,
    runScore,
    flags: nextFlags,
    suitesStarted,
    ambitionEventsFaced: (Number(career.ambitionEventsFaced) || 0) + (ambitionLinked ? 1 : 0),
    chainProgress: chainState.chainProgress,
    // Plus de forçage d’étape suivante : les suites se tirent dans le pool
    queuedEventId: null,
    endReason: dead ? 'death' : career.endReason || null,
    history: [...career.history, historyEntry],
    recentEventIds,
    lastOutcome: historyEntry,
    currentEvent: null,
    season: dead ? career.season : hitSeasonCap ? career.maxSeasons : nextSeason,
    // Cap atteint → offre de prolonger (sacrifice PV) avant la retraite
    phase: dead ? 'finished' : hitSeasonCap ? 'extendOffer' : 'playing',
  };

  if (!finished && !hitSeasonCap) {
    next = ensureCurrentEvent(next);
  }

  return next;
}

/** Peut sacrifier des PV pour +1 saison (phase extendOffer, PV > coût). */
export function canExtendSeason(career) {
  if (!career || career.phase !== 'extendOffer') return false;
  const hp = Number(career.stats?.hp ?? career.stats?.forme) || 0;
  return hp > EXTEND_SEASON_HP_COST;
}

/**
 * Sacrifie EXTEND_SEASON_HP_COST PV pour allonger la carrière d’une saison.
 * Rejouable à chaque fois que le plafond est atteint.
 */
export function extendCareerSeason(career) {
  if (!canExtendSeason(career)) return career;
  const cost = EXTEND_SEASON_HP_COST;
  const stats = applyEffects(career.stats, { hp: -cost });
  const maxSeasons = (Number(career.maxSeasons) || CAVE_DESTINY_SEASON_COUNT) + 1;
  const season = maxSeasons;
  const historyEntry = {
    season: career.season,
    eventId: 'prolongation',
    title: 'Une saison de plus',
    choice: `Sacrifier ${cost} PV`,
    text: `Vous versez ${cost} PV à la Cave.\nElle vous rend une saison fragile, brûlante, encore jouable.`,
    variant: 'neutre',
    deltas: { hp: -cost },
    scoreGain: 0,
    died: false,
    ambitionLinked: false,
    weaponProgress: null,
    weaponName: career.weapon?.name || null,
    weaponRarity: career.weapon?.rarity || null,
    subclassName: career.subclass?.name || null,
  };
  let next = {
    ...career,
    stats,
    maxSeasons,
    season,
    phase: 'playing',
    endReason: null,
    currentEvent: null,
    history: [...(career.history || []), historyEntry],
    lastOutcome: historyEntry,
    seasonsExtended: (Number(career.seasonsExtended) || 0) + 1,
  };
  return ensureCurrentEvent(next);
}

/** Décline l’offre de prolongation → retraite. */
export function retireFromExtend(career) {
  if (!career || career.phase !== 'extendOffer') return career;
  return {
    ...career,
    phase: 'finished',
    endReason: 'retire',
    season: career.maxSeasons,
    currentEvent: null,
  };
}

export function computeScore(career) {
  // Score unique /100 : démarrage 50–60, puis +4 / 0 / −2 (ambition +5 / −3).
  let score = clampScore(career?.runScore);
  // Mort en run : la Cave ne garde que la moitié de la légende
  if (career?.endReason === 'death') {
    score = clampScore(score / 2);
  }
  return score;
}

export function getTier(score) {
  let tier = CAVE_DESTINY_TIERS[0];
  for (const t of CAVE_DESTINY_TIERS) {
    if (score >= t.minScore) tier = t;
  }
  return tier;
}

/**
 * Convertit un ancien score cumulatif (>100) vers le barème /100.
 * Ancres = anciens paliers → nouveaux paliers.
 * Les scores déjà ≤100 sont laissés tels quels.
 */
export function normalizeDestinyScoreToHundred(rawScore) {
  const s = Number(rawScore);
  if (!Number.isFinite(s) || s <= 0) return 0;
  if (s <= CAVE_DESTINY_SCORE_MAX) return Math.round(s);

  const anchors = [
    [0, 0],
    [220, 45],
    [300, 55],
    [400, 68],
    [520, 80],
    [640, 90],
    [800, 100],
  ];
  if (s >= anchors[anchors.length - 1][0]) return CAVE_DESTINY_SCORE_MAX;
  for (let i = 1; i < anchors.length; i += 1) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (s <= x1) {
      const t = (s - x0) / (x1 - x0 || 1);
      return clampScore(y0 + t * (y1 - y0));
    }
  }
  return CAVE_DESTINY_SCORE_MAX;
}

/**
 * Renvoie une entrée panthéon/run migrée (score + tier).
 * Si conversion depuis l’ancien barème : pose `_needsScorePersist` pour réécriture Firestore.
 */
export function migrateRunEntryScore(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const raw = Number(entry.score);
  if (!Number.isFinite(raw) || raw < 0) {
    const tier = getTier(0);
    return {
      ...entry,
      score: 0,
      tierId: tier.id,
      tierLabel: tier.label,
      scoreScale: 100,
    };
  }
  // Déjà au format /100 en base
  if (entry.scoreScale === 100 && raw <= CAVE_DESTINY_SCORE_MAX) {
    const score = Math.round(raw);
    const tier = getTier(score);
    return {
      ...entry,
      score,
      tierId: tier.id,
      tierLabel: tier.label,
    };
  }
  // Score déjà ≤100 mais pas encore flagué
  if (raw <= CAVE_DESTINY_SCORE_MAX) {
    const score = Math.round(raw);
    const tier = getTier(score);
    return {
      ...entry,
      score,
      tierId: tier.id,
      tierLabel: tier.label,
      scoreScale: 100,
    };
  }
  // Ancien barème cumulatif → /100
  const score = normalizeDestinyScoreToHundred(raw);
  const tier = getTier(score);
  return {
    ...entry,
    score,
    tierId: tier.id,
    tierLabel: tier.label,
    scoreScale: 100,
    scoreLegacy: raw,
    _needsScorePersist: true,
  };
}

export function buildFinalStory(career) {
  const score = computeScore(career);
  const tier = getTier(score);
  const name = career.character?.name || 'Aventurier';
  const ambition = career.ambition?.name || 'la gloire';
  const wins = career.trophies?.tournoi || 0;
  const forge = career.trophies?.forge || 0;
  const seasonsLived = career.season || career.maxSeasons;
  const died = career.endReason === 'death';

  const storyParts = [
    `${name} a poursuivi « ${ambition} » pendant ${seasonsLived} saison${seasonsLived > 1 ? 's' : ''}.\nC’était un vrai cave des Duels.`,
  ];

  if (died) {
    storyParts.push(
      'La mort l’a cueilli avant la retraite : PV à zéro.\nLa Cave ne garde que la moitié de ses points.',
    );
  }

  if (wins >= 2) storyParts.push('Les tournois du samedi ont appris à craindre son nom.');
  else if (wins === 1) storyParts.push('Une couronne a été arrachée sous les acclamations de l’arène.');
  else storyParts.push('Aucune couronne n’est venue, mais des histoires restent à la Taverne.');

  if (forge >= 1) storyParts.push('Ornn a reconnu son bras dans le feu de la forge.');
  const weaponName = career.weapon?.name;
  const weaponRarity = career.weapon?.rarity;
  if (weaponName && weaponRarity === RARITY.LEGENDAIRE) {
    storyParts.push(`${weaponName} a révélé sa forme légendaire.`);
  } else if (weaponName && weaponRarity === RARITY.RARE) {
    storyParts.push(`${weaponName} a été améliorée en chemin.`);
  }
  if (!died && score >= 80) {
    storyParts.push('On murmure déjà « légende » plutôt que « cave ».');
  } else if (!died && score < 50) {
    storyParts.push('Cave jusqu’au bout, et fier de l’être.');
  }

  return { score, tier, story: storyParts.join('\n'), died };
}

/** Migre les anciennes clés Destiny (puissance/endurance/…) vers Auto/Déf/Cap/VIT. */
function migrateDestinyStatKeys(stats) {
  if (!stats || typeof stats !== 'object') return stats;
  const map = { puissance: 'auto', endurance: 'def', magie: 'cap', vitesse: 'spd' };
  const next = { ...stats };
  for (const [oldKey, newKey] of Object.entries(map)) {
    if (next[oldKey] == null) continue;
    if (next[newKey] == null) next[newKey] = next[oldKey];
    delete next[oldKey];
  }
  return next;
}

function migrateCareerStatKeys(career) {
  if (!career || typeof career !== 'object') return career;
  const next = {
    ...career,
    stats: normalizeHpKey(migrateDestinyStatKeys(career.stats)),
    runScore: Number(career.runScore) || 0,
    endReason: career.endReason || null,
    chainProgress:
      career.chainProgress && typeof career.chainProgress === 'object'
        ? career.chainProgress
        : {},
    // Anciennes saves : ne plus forcer l’étape suivante d’une suite
    queuedEventId: null,
    suitesStarted: Number(career.suitesStarted) || 0,
    flags: career.flags && typeof career.flags === 'object' ? career.flags : {},
  };
  // Carrières en cours : allonger jusqu’à la durée actuelle du mode
  if (
    next.phase === 'playing' &&
    (Number(next.maxSeasons) || 0) < CAVE_DESTINY_SEASON_COUNT
  ) {
    next.maxSeasons = CAVE_DESTINY_SEASON_COUNT;
  }
  if (next.character?.baseStats) {
    next.character = {
      ...next.character,
      baseStats: migrateDestinyStatKeys(next.character.baseStats),
    };
  }
  // Sous-classe : uniquement si obtenue en run (entrée history avec subclassName)
  const earnedSubclass = (next.history || []).some((h) => h?.subclassName);
  if (next.subclass && !earnedSubclass) {
    next.subclass = null;
  }
  if (next.character) {
    next.character = { ...next.character, subclass: next.subclass };
  }
  if (Array.isArray(next.history)) {
    next.history = next.history.map((h) =>
      h?.deltas
        ? { ...h, deltas: normalizeHpKey(migrateDestinyStatKeys(h.deltas)) }
        : h
    );
  }
  if (next.lastOutcome?.deltas) {
    next.lastOutcome = {
      ...next.lastOutcome,
      deltas: normalizeHpKey(migrateDestinyStatKeys(next.lastOutcome.deltas)),
    };
  }
  // Migration score /100 (anciennes saves cumulatives → reconstruit depuis l’historique)
  if (next.scoreScale !== 100) {
    let score = 55;
    for (const h of next.history || []) {
      const v = h?.variant || 'neutre';
      const linked = !!h?.ambitionLinked;
      if (typeof h?.scoreGain === 'number' && Math.abs(h.scoreGain) <= 6) {
        score += h.scoreGain;
      } else {
        score += computeEventScoreGain(v, next.stats, { ambitionLinked: linked });
      }
    }
    next.runScore = clampScore(score);
    next.scoreScale = 100;
  } else {
    next.runScore = clampScore(next.runScore);
  }
  // Filet : event courant hors Red ne doit jamais garder des options coop
  if (next.currentEvent && !RED_ARENA_EVENT_IDS.has(next.currentEvent.id)) {
    next.currentEvent = stripCompanionOptions(next.currentEvent);
  }
  return next;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVE);
    if (!raw) return null;
    return migrateCareerStatKeys(JSON.parse(raw));
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
    if (!Array.isArray(list)) return [];
    const migrated = list.map(migrateRunEntryScore);
    const changed = migrated.some((e, i) => e !== list[i] && e?.score !== list[i]?.score);
    if (changed) {
      try {
        localStorage.setItem(STORAGE_KEY_PANTHEON, JSON.stringify(migrated));
      } catch {
        /* ignore */
      }
    }
    return migrated;
  } catch {
    return [];
  }
}

/** Snapshot d’une carrière terminée (local + serveur). */
export function buildRunEntry(career, extras = {}) {
  const { score, tier, story } = buildFinalStory(career);
  const subclass = career.subclass || null;
  const history = Array.isArray(career.history)
    ? career.history.map((h) => ({
        season: h.season,
        eventId: h.eventId,
        title: h.title,
        choice: h.choice,
        text: h.text,
        variant: h.variant,
        deltas: h.deltas || {},
        scoreGain: h.scoreGain,
        died: !!h.died,
        ambitionLinked: !!h.ambitionLinked,
        weaponProgress: h.weaponProgress || null,
        weaponName: h.weaponName || null,
        subclassName: h.subclassName || null,
      }))
    : [];
  return {
    id: extras.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: extras.date || Date.now(),
    userId: extras.userId || null,
    userPseudo: extras.userPseudo || null,
    name: career.character?.name || 'Aventurier',
    race: career.character?.race || null,
    class: career.character?.class || null,
    subclass: subclass?.name || subclass || null,
    subclassId: subclass?.id || null,
    ownerPseudo: career.character?.ownerPseudo || null,
    characterImage: career.character?.characterImage || null,
    ambition: career.ambition?.name || null,
    ambitionId: career.ambition?.id || null,
    ambitionIcon: career.ambition?.icon || null,
    mentor: career.mentor?.name || null,
    mentorId: career.mentor?.id || null,
    mentorIcon: career.mentor?.icon || null,
    weapon: career.weapon?.name || null,
    weaponRarity: career.weapon?.rarity || null,
    weaponIcon: career.weapon?.icon || null,
    score,
    tierId: tier.id,
    tierLabel: tier.label,
    scoreScale: 100,
    trophies: career.trophies || {},
    story,
    stats: normalizeHpKey(career.stats || {}),
    runScore: Number(career.runScore) || 0,
    endReason: career.endReason || null,
    maxSeasons: Number(career.maxSeasons) || CAVE_DESTINY_SEASON_COUNT,
    history,
  };
}

/**
 * Reconstruit une carrière « lecture seule » depuis une entrée Panthéon / Mes runs,
 * pour afficher la carte récap.
 */
export function runEntryToCareer(entry) {
  if (!entry) return null;

  const ambitionFromId = entry.ambitionId
    ? CAVE_DESTINY_AMBITIONS.find((a) => a.id === entry.ambitionId)
    : null;
  const ambitionFromName = entry.ambition
    ? CAVE_DESTINY_AMBITIONS.find((a) => a.name === entry.ambition)
    : null;
  const ambitionSrc = ambitionFromId || ambitionFromName;
  const ambition = ambitionSrc
    ? { id: ambitionSrc.id, name: ambitionSrc.name, icon: ambitionSrc.icon }
    : entry.ambition
      ? {
          id: entry.ambitionId || null,
          name: entry.ambition,
          icon: entry.ambitionIcon || '🎯',
        }
      : null;

  const mentorFromId = entry.mentorId
    ? CAVE_DESTINY_MENTORS.find((m) => m.id === entry.mentorId)
    : null;
  const mentorFromName = entry.mentor
    ? CAVE_DESTINY_MENTORS.find((m) => m.name === entry.mentor)
    : null;
  const mentorSrc = mentorFromId || mentorFromName;
  const mentor = mentorSrc
    ? { id: mentorSrc.id, name: mentorSrc.name, icon: mentorSrc.icon }
    : entry.mentor
      ? {
          id: entry.mentorId || null,
          name: entry.mentor,
          icon: entry.mentorIcon || '🧭',
        }
      : null;

  const subclass =
    entry.subclassId || entry.subclass
      ? {
          id: entry.subclassId || null,
          name:
            typeof entry.subclass === 'string'
              ? entry.subclass
              : entry.subclass?.name || null,
        }
      : null;

  const maxSeasons =
    Number(entry.maxSeasons) ||
    (Array.isArray(entry.history) && entry.history.length
      ? Math.max(...entry.history.map((h) => Number(h.season) || 0), CAVE_DESTINY_SEASON_COUNT)
      : CAVE_DESTINY_SEASON_COUNT);

  return {
    phase: 'finished',
    character: {
      name: entry.name || 'Aventurier',
      race: entry.race || null,
      class: entry.class || null,
      subclass,
      ownerPseudo: entry.ownerPseudo || null,
      characterImage: entry.characterImage || null,
    },
    ambition,
    mentor,
    weapon: entry.weapon
      ? {
          name: entry.weapon,
          rarity: entry.weaponRarity || null,
          icon: entry.weaponIcon || null,
        }
      : null,
    subclass,
    stats: normalizeHpKey(entry.stats || {}),
    trophies: entry.trophies || {},
    history: Array.isArray(entry.history) ? entry.history : [],
    maxSeasons,
    season: maxSeasons,
    runScore:
      entry.runScore != null
        ? Number(entry.runScore)
        : Number(entry.score) || 0,
    endReason: entry.endReason || null,
    savedStory: entry.story || null,
    fromRunEntryId: entry.id || null,
  };
}

export function pushToPantheon(career, extras = {}) {
  const entry = buildRunEntry(career, extras);
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
    auto: 'Auto',
    def: 'Déf',
    cap: 'Cap',
    spd: 'VIT',
    charisme: 'Charisme',
    renommee: 'Renommée',
    or: 'Or',
    hp: 'PV',
    forme: 'PV',
    moral: 'Moral',
  };
  const normalized = normalizeHpKey(deltas);
  return Object.entries(normalized)
    .filter(([, v]) => typeof v === 'number' && v !== 0)
    .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${labels[k] || k}`);
}
