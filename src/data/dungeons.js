/**
 * Système de Donjon - Duels de Cave
 *
 * 3 niveaux de donjon progressifs (1 → 2 → 3 à la suite)
 * Limite: 15 runs par jour max cumulés (5 à minuit, 5 à midi, 5 à 18h)
 * Si on meurt, on récupère le loot du dernier étage réussi
 *
 * Niveau 1: Très facile → Arme Commune
 * Niveau 2: Normal → Arme Rare
 * Niveau 3: Très difficile → Arme Légendaire
 */

import { RARITY } from './weapons.js';

// ============================================================================
// CONSTANTES DU DONJON
// ============================================================================
export const DUNGEON_CONSTANTS = {
  MAX_RUNS_PER_DAY: 15,
  MAX_RUNS_PER_RESET: 5,
  TOTAL_LEVELS: 3,
};

// ============================================================================
// DIFFICULTÉS
// ============================================================================
export const DIFFICULTY = {
  TRES_FACILE: 'tres_facile',
  NORMAL: 'normal',
  TRES_DIFFICILE: 'tres_difficile',
};

export const DIFFICULTY_LABELS = {
  [DIFFICULTY.TRES_FACILE]: 'Très Facile',
  [DIFFICULTY.NORMAL]: 'Normal',
  [DIFFICULTY.TRES_DIFFICILE]: 'Très Difficile',
};

export const DIFFICULTY_COLORS = {
  [DIFFICULTY.TRES_FACILE]: 'text-green-400',
  [DIFFICULTY.NORMAL]: 'text-yellow-400',
  [DIFFICULTY.TRES_DIFFICILE]: 'text-red-400',
};

export const DIFFICULTY_BG_COLORS = {
  [DIFFICULTY.TRES_FACILE]: 'bg-green-900/30 border-green-600',
  [DIFFICULTY.NORMAL]: 'bg-yellow-900/30 border-yellow-600',
  [DIFFICULTY.TRES_DIFFICILE]: 'bg-red-900/30 border-red-600',
};

// ============================================================================
// DÉFINITION DES NIVEAUX DE DONJON
// ============================================================================
export const dungeonLevels = {
  niveau_1: {
    id: 'niveau_1',
    niveau: 1,
    nom: 'Forteresse Gobeline',
    description: 'Une forteresse de pierres où règne un chef gobelin vicieux.',
    difficulte: DIFFICULTY.TRES_FACILE,
    bossId: 'chef_gobelin',
    bossNom: 'Chef Gobelin Grukk',
    dropRarity: RARITY.COMMUNE,
    icon: '🏰',
    bossIcon: '👺',
    bossStatModifier: 0.5,
  },

  niveau_2: {
    id: 'niveau_2',
    niveau: 2,
    nom: 'Repaire des Bandits',
    description: 'Une grotte sombre où se cache un bandit de grand chemin redoutable.',
    difficulte: DIFFICULTY.NORMAL,
    bossId: 'bandit',
    bossNom: 'Bandit des Grands Chemins',
    dropRarity: RARITY.RARE,
    icon: '🏚️',
    bossIcon: '🗡️',
    bossStatModifier: 1.15,
  },

  niveau_3: {
    id: 'niveau_3',
    niveau: 3,
    nom: 'Antre du Dragon',
    description: 'L\'antre d\'un dragon ancien, gardien d\'un trésor légendaire.',
    difficulte: DIFFICULTY.TRES_DIFFICILE,
    bossId: 'dragon',
    bossNom: 'Vyraxion le Dévoreur',
    dropRarity: RARITY.LEGENDAIRE,
    icon: '🐉',
    bossIcon: '🐲',
    // Stats supérieures au joueur
    bossStatModifier: 1.7, // 170% des stats du joueur
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Récupère un niveau de donjon par son ID
 */
export function getDungeonLevelById(levelId) {
  return dungeonLevels[levelId] || null;
}

/**
 * Récupère un niveau de donjon par son numéro (1, 2, 3)
 */
export function getDungeonLevelByNumber(levelNumber) {
  return Object.values(dungeonLevels).find(l => l.niveau === levelNumber) || null;
}

/**
 * Récupère tous les niveaux triés
 */
export function getAllDungeonLevels() {
  return Object.values(dungeonLevels).sort((a, b) => a.niveau - b.niveau);
}

/**
 * Début de la période courante : minuit, midi ou 18h (heure locale).
 */
export function getResetAnchor(date) {
  const anchor = new Date(date);
  const hour = anchor.getHours();
  if (hour < 12) {
    anchor.setHours(0, 0, 0, 0);
  } else if (hour < 18) {
    anchor.setHours(12, 0, 0, 0);
  } else {
    anchor.setHours(18, 0, 0, 0);
  }
  return anchor;
}

/** Prochain début de période après une ancre déjà normalisée (0h, 12h ou 18h). */
function advanceResetAnchor(anchor) {
  const d = new Date(anchor);
  const h = d.getHours();
  if (h === 0) {
    d.setHours(12, 0, 0, 0);
  } else if (h === 12) {
    d.setHours(18, 0, 0, 0);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

export function isNewDay(lastRunDate) {
  if (!lastRunDate) return true;

  const last = lastRunDate instanceof Date ? lastRunDate : lastRunDate.toDate();
  const now = new Date();

  const currentAnchor = getResetAnchor(now);

  return last < currentAnchor;
}

/** Dimanche en heure de Paris (pour ne pas créditer de runs le dimanche). */
export function isParisSunday(date) {
  const str = new Date(date).toLocaleString('en-US', { timeZone: 'Europe/Paris' });
  return new Date(str).getDay() === 0;
}

/** Samedi 18h ou plus tard, ou dimanche, en heure de Paris (après le tournoi = zone fresh restart). */
export function isParisPostTournament(date = new Date()) {
  const tz = 'Europe/Paris';
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(date);
  let weekday = '';
  let hour = 0;
  for (const p of parts) {
    if (p.type === 'weekday') weekday = p.value;
    if (p.type === 'hour') hour = parseInt(p.value, 10);
  }
  if (weekday === 'dim.') return true;
  if (weekday === 'sam.' && hour >= 18) return true;
  return false;
}

export function getResetPeriodsSince(lastCreditDate, now = new Date()) {
  if (!lastCreditDate) return 0;
  const last = lastCreditDate instanceof Date ? lastCreditDate : lastCreditDate.toDate();
  const currentAnchor = getResetAnchor(now);
  const lastAnchor = getResetAnchor(last);
  const diffMs = currentAnchor - lastAnchor;
  if (diffMs <= 0) return 0;
  let count = 0;
  let cursor = advanceResetAnchor(new Date(lastAnchor.getTime()));
  while (cursor <= currentAnchor) {
    if (!isParisSunday(cursor)) {
      count++;
    }
    cursor = advanceResetAnchor(cursor);
  }
  return count;
}

/**
 * Calcule le nombre d'essais accumulés depuis le lundi 00h00 de la semaine courante.
 * Un nouveau joueur qui rejoint en cours de semaine reçoit tous les essais qu'il a loupés.
 * Ex: arrivée mardi 10h → 4 créneaux depuis lundi 0h (lun 0–12, 12–18, 18–mar 0, mar 0–12) × 5 = 20
 */
export function getRunsSinceWeekStart(now = new Date()) {
  const day = now.getDay(); // 0=dim, 1=lun, ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const periods = getResetPeriodsSince(monday, now);
  // +1 car la période courante (lundi matin) compte aussi
  return (periods + 1) * DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET;
}

/**
 * Runs à attribuer à un nouveau joueur (première init ou après reset).
 * Samedi soir (18h Paris) et dimanche : 0 run pour que tout le monde reparte à égalité le lundi (fresh restart après le tournoi).
 */
export function getInitialRunsForNewPlayer(now = new Date()) {
  if (isParisPostTournament(now)) return 0;
  return getRunsSinceWeekStart(now);
}

/**
 * Calcule les runs restantes aujourd'hui
 */
export function getRemainingRuns(runsToday, lastRunDate) {
  if (!lastRunDate) {
    return DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET;
  }
  const periods = getResetPeriodsSince(lastRunDate, new Date());
  const totalAllowance = (periods + 1) * DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET;
  return Math.max(0, totalAllowance - (runsToday || 0));
}

/**
 * Récupère le loot correspondant au niveau atteint
 * @param {number} highestLevelBeaten - Plus haut niveau battu (0 si aucun)
 */
export function getLootForLevel(highestLevelBeaten) {
  if (highestLevelBeaten <= 0) return null;

  const level = getDungeonLevelByNumber(highestLevelBeaten);
  return level ? level.dropRarity : null;
}
