/**
 * Système de Donjon - Duels de Cave
 *
 * 3 niveaux de donjon progressifs (1 → 2 → 3 à la suite)
 * Limite: 3 runs par jour
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
  MAX_RUNS_PER_DAY: 3,
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
    bossStatModifier: 1.0,
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
    bossStatModifier: 1.5, // 150% des stats du joueur
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
 * Vérifie si c'est un nouveau jour (reset à minuit)
 */
export function isNewDay(lastRunDate) {
  if (!lastRunDate) return true;

  const last = lastRunDate instanceof Date ? lastRunDate : lastRunDate.toDate();
  const now = new Date();

  // Compare les dates (jour/mois/année)
  return (
    last.getDate() !== now.getDate() ||
    last.getMonth() !== now.getMonth() ||
    last.getFullYear() !== now.getFullYear()
  );
}

/**
 * Calcule les runs restantes aujourd'hui
 */
export function getRemainingRuns(runsToday, lastRunDate) {
  // Si c'est un nouveau jour, reset le compteur
  if (isNewDay(lastRunDate)) {
    return DUNGEON_CONSTANTS.MAX_RUNS_PER_DAY;
  }
  return Math.max(0, DUNGEON_CONSTANTS.MAX_RUNS_PER_DAY - runsToday);
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
