/**
 * Système de Donjon - Duels de Cave
 *
 * 3 niveaux de donjon progressifs (1 → 2 → 3 à la suite)
 * Limite: 10 runs par jour (cumulables)
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
  MAX_RUNS_PER_DAY: 10,
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
 * Vérifie si c'est une nouvelle période (reset à minuit et à midi)
 */
export function getResetAnchor(date) {
  const anchor = new Date(date);
  const hour = anchor.getHours();
  anchor.setHours(hour >= 12 ? 12 : 0, 0, 0, 0);
  return anchor;
}

export function isNewDay(lastRunDate) {
  if (!lastRunDate) return true;

  const last = lastRunDate instanceof Date ? lastRunDate : lastRunDate.toDate();
  const now = new Date();

  const currentAnchor = getResetAnchor(now);

  return last < currentAnchor;
}

export function getResetPeriodsSince(lastCreditDate, now = new Date()) {
  if (!lastCreditDate) return 0;
  const last = lastCreditDate instanceof Date ? lastCreditDate : lastCreditDate.toDate();
  const currentAnchor = getResetAnchor(now);
  const lastAnchor = getResetAnchor(last);
  const diffMs = currentAnchor - lastAnchor;
  if (diffMs <= 0) return 0;
  const periodMs = 12 * 60 * 60 * 1000;
  return Math.floor(diffMs / periodMs);
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
