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
  pickRandomGameCharacters,
} from '../data/caveDestiny';
import { getEventBaseWeight } from '../data/caveDestinyRarity';
import {
  getChainStep,
  isChainLockedStep,
  isAmbitionChainFinale,
  buildChainUiMeta,
} from '../data/caveDestinyChains';
import { RARITY } from '../data/weapons';
import { getSubclassesForClass } from '../data/subclasses';
import { trio } from '../data/caveDestinyEventUtils';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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
  const factor = clamp(checkScore + soft, -0.55, 0.55);

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

/**
 * Points de score gagnés sur un event.
 * Or + renommée multiplient le gain (plafonds).
 * Les trophées restent comptés à part dans computeScore.
 */
function computeEventScoreGain(variant, stats) {
  const base = variant === 'bonus' ? 14 : variant === 'malus' ? 4 : 8;
  const renown = Number(stats?.renommee) || 0;
  const gold = Number(stats?.or) || 0;
  const mult =
    1 + Math.min(0.9, renown * 0.015) + Math.min(0.7, gold * 0.012);
  return Math.max(0, Math.round(base * mult));
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
        text: `${name} et vous étouffez la Salamèche. Vapeur, rires, Red qui hoche — le duo tient.`,
        deltas: withAllyTip({ charisme: 3, or: 4, renommee: 2, hp: -3 }, ally),
      },
      {
        text: `${name} couvre votre flanc. La flamme baisse assez pour passer — brûlures partagées.`,
        deltas: { charisme: 1, hp: -5, or: 2 },
      },
      {
        text: `Mauvais timing avec ${name}. Le feu vous sépare ; Red ricane, l’arène reste fermée.`,
        deltas: { hp: -10, moral: -4, charisme: -1 },
      },
      [32, 40, 28],
    );
  }
  if (eventId === 'ronflex_red') {
    return trio(
      {
        text: `${name} trouve l’angle. Le Ronflex s’écarte — baie partagée, couloir libre, duo soudé.`,
        deltas: withAllyTip({ charisme: 3, or: 6, hp: 2, renommee: 2 }, ally),
      },
      {
        text: `Avec ${name}, vous grimpez / poussez / attendez… assez pour passer, pas pour la légende.`,
        deltas: { charisme: 1, spd: 1, hp: -2 },
      },
      {
        text: `${name} et vous finissez sous la masse. Ronflement, noir, moral en miettes.`,
        deltas: { hp: -12, moral: -5, charisme: -2 },
      },
      [32, 40, 28],
    );
  }
  // coop_red finale
  return trio(
    {
      text: `Duo parfait avec ${name}. Dracaufeu tombe ; le Pointeau ADN reconnaît deux noms.`,
      deltas: withAllyTip(
        { charisme: 5, renommee: 6, or: 8, hp: -4, trophies: { coop: 1 } },
        ally
      ),
    },
    {
      text: `Victoire correcte aux côtés de ${name}. Coordination moyenne, butin partagé, respect muet.`,
      deltas: { charisme: 2, or: 3, hp: -5, renommee: 2 },
    },
    {
      text: `Florizarre vous ensevelit. ${name} vous regarde, muet — le duo se brise sous les racines.`,
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
        ? 'Vous saluez Red et sortez. L’arène reste ouverte… pour d’autres duos.'
        : 'Vous déclinez. Red hausse les épaules — d’autres cherchent un allié.',
      deltas: { moral: 2 },
    },
    {
      text: 'Pas ce soir. Vous laissez l’arène derrière vous, sans gloire ni brûlure.',
      deltas: {},
    },
    {
      text: 'Quelques regards en coin. Refuser Red n’est pas une honte… mais ce n’est pas non plus une couronne.',
      deltas: { moral: -2, renommee: -1 },
    },
    [40, 45, 15],
  );
}

/** Options dynamiques : 3 personnages réels + refus (suite Arène de Red). */
function expandRedArenaEvent(event, career) {
  if (!RED_ARENA_EVENT_IDS.has(event?.id)) return event;
  // Offre déjà matérialisée (save / même tirage)
  if (event.options?.some((o) => o.companion)) return event;

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
      'Red vous propose un duo. Une Salamèche cracheuse bloque le passage — choisissez un allié parmi les vrais caves, ou refusez.',
    ronflex_red:
      'Un Ronflex barre le couloir. Red attend votre prochain duo — un autre perso réel… ou la sortie.',
    coop_red:
      'Finale chez Red. Choisissez un dernier allié réel pour affronter l’arène — ou refusez et partez.',
  };

  return {
    ...event,
    text: texts[event.id] || event.text,
    options: [
      ...allyOptions,
      {
        id: 'refuser',
        label: 'Refuser et quitter l’arène de Red',
        exitChain: true,
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
    version: 9,
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
    runScore: 0,
    ambitionEventsFaced: 0,
    chainProgress: {},
    queuedEventId: null,
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

  // Suite en cours : étapes non débloquées = impossibles
  const chainInfo = getChainStep(event.id);
  if (chainInfo && isChainLockedStep(event.id, career)) {
    return 0;
  }
  // Ouverture de suite alignée sur l’ambition : plus fréquente
  if (
    ambitionId &&
    chainInfo &&
    chainInfo.stepIndex === 0 &&
    chainInfo.chain.ambition === ambitionId
  ) {
    w *= 2.4;
  }
  // Finale de suite (ambition) : boost une fois débloquée
  if (ambitionId && isAmbitionChainFinale(event.id, ambitionId)) {
    w *= 1.8;
  }

  if (hp < 35 && event.id === 'blessure') w *= 2.2;
  if (hp < 25 && event.tags?.includes('combat')) w *= 0.55;

  // Quêtes / events liés à une famille d’arme : gate dure
  const needFamily = requiredWeaponFamily(event);
  if (needFamily && career.weapon?.family !== needFamily) {
    return 0;
  }
  // Ouverture de quête d’arme : boost fort (sinon 1/14 du pool = quasi invisible)
  if (
    event.tags?.includes('arme_quete') &&
    chainInfo &&
    chainInfo.stepIndex === 0 &&
    needFamily &&
    career.weapon?.family === needFamily
  ) {
    w *= 2.8;
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
    detail: sc.bonus || sc.description,
    require: career?.subclass
      ? { noSubclass: true }
      : idx === 0
        ? { stats: { cap: 24 }, noSubclass: true }
        : { stats: { auto: 24 }, noSubclass: true },
    subclassId: sc.id,
    subclassName: sc.name,
    outcomes: trio(
      {
        text: `La voie « ${sc.name} » s’ancre. Votre style de ${className} change.`,
        deltas: { renommee: 5, cap: 2, auto: 2, moral: 3 },
        subclassGain: { id: sc.id, name: sc.name },
      },
      {
        text: `Vous entrevoyez « ${sc.name} »… sans l’embrasser pleinement.`,
        deltas: { cap: 1, moral: 1 },
      },
      {
        text: 'L’examen vous dépasse. Retour aux bancs.',
        deltas: { hp: -6, moral: -4 },
      }
    ),
  }));

  return {
    ...event,
    text: fillWeaponPlaceholders(
      `Au Collège Kunugigaoka, Koro Sensei propose une sous-classe à votre ${className}. Deux voies… et des exigences.`,
      career?.weapon
    ),
    options: [
      {
        id: 'observer',
        label: 'Assister aux cours sans s’engager',
        outcomes: trio(
          { text: 'Vous comprenez mieux les voies. Plus tard peut-être.', deltas: { cap: 2, moral: 2 } },
          { text: 'Cours correct.', deltas: { cap: 1 } },
          { text: 'Vous vous endormez. Interrogation surprise ratée.', deltas: { moral: -3 } }
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
            text: 'Koro Sensei applaudit. Les deux voies vous inspirent — vous choisissez la plus dure.',
            deltas: { renommee: 8, cap: 3, auto: 3, hp: -4 },
            subclassGain: list[1]
              ? { id: list[1].id, name: list[1].name }
              : list[0]
                ? { id: list[0].id, name: list[0].name }
                : null,
          },
          {
            variant: 'neutre',
            weight: 40,
            text: 'Presque. Une seule voie s’ouvre à demi.',
            deltas: { cap: 2, hp: -3 },
            subclassGain: list[0] ? { id: list[0].id, name: list[0].name } : null,
          },
          {
            variant: 'malus',
            weight: 25,
            text: 'Trop tôt. Le Collège vous renvoie.',
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

  const gain = Math.max(scoreGain + 6, Math.round(scoreGain * 1.6));
  return { deltas: next, trophyDelta: trophies, scoreGain: gain };
}

function materializeEvent(raw, career) {
  let event = expandSubclassEvent(raw, career.character, career);
  event = expandRedArenaEvent(event, career);
  const options = getOptionsForEvent(event, career.character, career);
  const localized = localizeEventForWeapon({ ...event, options }, career.weapon);
  const ambitionLinked = isAmbitionLinkedEvent(localized, career);
  const chain = buildChainUiMeta(localized.id);
  return {
    id: localized.id,
    title: localized.title,
    text: localized.text,
    tags: localized.tags,
    rarity: localized.rarity || 'common',
    options: localized.options,
    chain,
    ambitionLinked,
    ambitionId: ambitionLinked ? career.ambition?.id || null : null,
    ambitionName: ambitionLinked ? career.ambition?.name || null : null,
    ambitionIcon: ambitionLinked ? career.ambition?.icon || '🎯' : null,
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
    // Migre les saves / tirages Red sans options compagnons
    if (redEventNeedsExpand(career.currentEvent)) {
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

  // Bonus / neutre : enchaîne l’étage suivant
  chainProgress[info.chainId] = info.stepIndex + 1;
  queuedEventId = info.nextEventId;
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
    outcomes = outcomes.length ? outcomes : [{ weight: 100, text: 'Rien ne se passe.', deltas: {} }];
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

  // Score d’event : or + renommée influencent le gain (stats avant l’event)
  const variant = outcome.variant || 'neutre';
  let scoreGain = computeEventScoreGain(variant, career.stats);
  let resolvedTrophyDelta = trophyDelta;

  const ambitionLinked = isAmbitionPayoff(career.currentEvent, career, option, outcome);
  if (ambitionLinked) {
    const boosted = applyAmbitionEventImpact(deltas, resolvedTrophyDelta, scoreGain, variant);
    deltas = boosted.deltas;
    resolvedTrophyDelta = boosted.trophyDelta;
    scoreGain = boosted.scoreGain;
  }

  const runScore = (Number(career.runScore) || 0) + scoreGain;

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
      outcomeText = `${outcomeText} (Votre lignée légendaire a tenu — une forge divine l’aurait rendue plus sûre encore.)`;
    }
  }
  const redRefuse =
    RED_ARENA_EVENT_IDS.has(career.currentEvent.id) &&
    (option.id === 'refuser' || option.exitChain);
  const chainMeta = buildChainUiMeta(career.currentEvent.id);
  if (redRefuse && chainMeta) {
    outcomeText = `${outcomeText} La quête « ${chainMeta.label} » s’arrête ici.`;
  } else if (ambitionLinked && career.ambition?.name) {
    const mark =
      variant === 'bonus'
        ? `Finale de suite : sous le signe de « ${career.ambition.name} », la Cave vous doit encore une dette.`
        : variant === 'malus'
          ? `Même à la finale, « ${career.ambition.name} » se souvient des chutes — cicatrice utile.`
          : `Finale de « ${chainMeta?.label || career.ambition.name} » : l’ambition grave ce soir sans fanfare.`;
    outcomeText = `${outcomeText} ${mark}`;
  } else if (chainMeta && !chainMeta.isFinale && variant !== 'malus') {
    outcomeText = `${outcomeText} La suite « ${chainMeta.label} » continue (${chainMeta.step}/${chainMeta.total} → ${chainMeta.step + 1}/${chainMeta.total}).`;
  } else if (chainMeta && !chainMeta.isFinale && variant === 'malus') {
    outcomeText = `${outcomeText} La suite « ${chainMeta.label} » se brise ici — il faudra reprendre depuis le début.`;
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
        outcomeText = `${outcomeText} ${result.message}`;
      }
    } else if (result.message) {
      outcomeText = `${outcomeText} ${result.message}`;
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
    outcomeText = `${outcomeText} Sous-classe obtenue : ${subclass.name}.`;
  }

  const dead = (Number(stats.hp) || 0) <= 0;
  if (dead) {
    stats = { ...stats, hp: 0 };
    outcomeText = `${outcomeText} Vos PV tombent à 0 — la Cave referme le livre.`;
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
  // Refus Arène de Red : retire les étapes pour permettre de relancer la quête
  if (redRefuse) {
    recentEventIds = recentEventIds.filter((id) => !RED_ARENA_EVENT_IDS.has(id));
  }
  const nextSeason = career.season + 1;
  const retired = !dead && nextSeason > career.maxSeasons;
  const finished = dead || retired;

  const agedStats = dead
    ? stats
    : applyEffects(stats, {
        auto: 1,
        def: 1,
        cap: career.character?.prefersMagic ? 1 : 0,
        spd: career.character?.prefersSpeed ? 1 : 0,
      });

  // Suites optionnelles : décliner / reporter / refuser Red → pas d’étape forcée
  const softLeave =
    (career.currentEvent.id === 'tournoi_anciens' && option.id !== 'participer') ||
    (career.currentEvent.id === 'ornn_jugement' && option.id === 'reporter') ||
    redRefuse;
  let chainState;
  if (dead) {
    chainState = { chainProgress: { ...(career.chainProgress || {}) }, queuedEventId: null };
  } else if (softLeave) {
    const chainProgress = { ...(career.chainProgress || {}) };
    // Refus Red : reset la quête (pourra être relancée plus tard)
    if (redRefuse) delete chainProgress.arene_red;
    chainState = { chainProgress, queuedEventId: null };
  } else {
    chainState = advanceChainState(career, career.currentEvent.id, variant);
  }

  let next = {
    ...career,
    weapon,
    subclass,
    stats: agedStats,
    trophies,
    runScore,
    flags: nextFlags,
    ambitionEventsFaced: (Number(career.ambitionEventsFaced) || 0) + (ambitionLinked ? 1 : 0),
    chainProgress: chainState.chainProgress,
    queuedEventId: finished ? null : chainState.queuedEventId,
    endReason: dead ? 'death' : retired ? 'retire' : career.endReason || null,
    history: [...career.history, historyEntry],
    recentEventIds,
    lastOutcome: historyEntry,
    currentEvent: null,
    season: finished ? (dead ? career.season : career.maxSeasons) : nextSeason,
    phase: finished ? 'finished' : 'playing',
  };

  if (!finished) {
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

  // Or / renommée boostent surtout les gains par event (runScore).
  const runScore = Number(career.runScore) || 0;

  return Math.round(
    (s.auto || 0) * 1.2 +
      (s.def || 0) * 1.1 +
      (s.cap || 0) * 1.2 +
      (s.spd || 0) * 1.1 +
      (s.charisme || 0) * 1.0 +
      runScore +
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
  const seasonsLived = career.season || career.maxSeasons;
  const died = career.endReason === 'death';

  let arc = `${name} a poursuivi « ${ambition} » pendant ${seasonsLived} saison${seasonsLived > 1 ? 's' : ''} — un vrai cave des Duels.`;

  if (died) {
    arc += ' La mort l’a cueilli avant la retraite : PV à zéro.';
  }

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
  if (!died && score >= 360) arc += ' On murmure déjà « légende » plutôt que « cave ».';
  else if (!died && score < 160) arc += ' Cave jusqu’au bout — et fier de l’être.';

  return { score, tier, story: arc, died };
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
    queuedEventId: career.queuedEventId || null,
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
  // Backfill runScore pour les saves entamées avant ce système
  if (!next.runScore && Array.isArray(next.history) && next.history.length) {
    let total = 0;
    for (const h of next.history) {
      if (typeof h.scoreGain === 'number') total += h.scoreGain;
      else total += computeEventScoreGain(h.variant || 'neutre', next.stats);
    }
    next.runScore = total;
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
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Snapshot d’une carrière terminée (local + serveur). */
export function buildRunEntry(career, extras = {}) {
  const { score, tier, story } = buildFinalStory(career);
  const subclass = career.subclass || null;
  return {
    id: extras.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: extras.date || Date.now(),
    userId: extras.userId || null,
    userPseudo: extras.userPseudo || null,
    name: career.character?.name || 'Aventurier',
    race: career.character?.race || null,
    class: career.character?.class || null,
    subclass: subclass?.name || subclass || null,
    ownerPseudo: career.character?.ownerPseudo || null,
    characterImage: career.character?.characterImage || null,
    ambition: career.ambition?.name || null,
    mentor: career.mentor?.name || null,
    weapon: career.weapon?.name || null,
    weaponRarity: career.weapon?.rarity || null,
    weaponIcon: career.weapon?.icon || null,
    score,
    tierId: tier.id,
    tierLabel: tier.label,
    trophies: career.trophies || {},
    story,
    stats: normalizeHpKey(career.stats || {}),
    runScore: Number(career.runScore) || 0,
    endReason: career.endReason || null,
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
