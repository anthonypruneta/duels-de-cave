/**
 * Système de Donjon - Duels de Cave
 *
 * 3 niveaux de donjon avec difficulté croissante.
 * Chaque niveau a un boss et drop une arme de rareté fixe.
 *
 * Niveau 1: Très facile → Arme Commune
 * Niveau 2: Normal → Arme Rare
 * Niveau 3: Très difficile → Arme Légendaire
 */

import { RARITY } from './weapons.js';

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

// ============================================================================
// DÉFINITION DES NIVEAUX DE DONJON
// ============================================================================
export const dungeonLevels = {
  niveau_1: {
    id: 'niveau_1',
    niveau: 1,
    nom: 'Repaire des Bandits',
    description: 'Une grotte sombre où se cachent des bandits de grand chemin.',
    difficulte: DIFFICULTY.TRES_FACILE,
    bossId: 'bandit',
    dropRarity: RARITY.COMMUNE,
    icon: '🏚️',
    background: 'cave_dark',
    // Modificateurs de stats pour le boss (pourcentage des stats du joueur)
    bossStatModifier: 0.5, // 50% des stats du joueur
    unlockCondition: null, // Toujours débloqué
  },

  niveau_2: {
    id: 'niveau_2',
    niveau: 2,
    nom: 'Forteresse Gobeline',
    description: 'Une forteresse de pierres où règne un chef gobelin impitoyable.',
    difficulte: DIFFICULTY.NORMAL,
    bossId: 'chef_gobelin',
    dropRarity: RARITY.RARE,
    icon: '🏰',
    background: 'fortress',
    // Stats équivalentes au joueur
    bossStatModifier: 1.0, // 100% des stats du joueur
    unlockCondition: {
      type: 'level_complete',
      levelId: 'niveau_1',
    },
  },

  niveau_3: {
    id: 'niveau_3',
    niveau: 3,
    nom: 'Antre du Dragon',
    description: 'L\'antre d\'un dragon ancien, gardien d\'un trésor légendaire.',
    difficulte: DIFFICULTY.TRES_DIFFICILE,
    bossId: 'dragon',
    dropRarity: RARITY.LEGENDAIRE,
    icon: '🐉',
    background: 'dragon_lair',
    // Stats supérieures au joueur
    bossStatModifier: 1.5, // 150% des stats du joueur
    unlockCondition: {
      type: 'level_complete',
      levelId: 'niveau_2',
    },
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
 * Vérifie si un niveau est débloqué pour un joueur
 * @param {string} levelId - ID du niveau à vérifier
 * @param {Array<string>} completedLevels - Liste des IDs de niveaux complétés
 */
export function isLevelUnlocked(levelId, completedLevels = []) {
  const level = getDungeonLevelById(levelId);
  if (!level) return false;

  // Pas de condition = toujours débloqué
  if (!level.unlockCondition) return true;

  // Vérifie la condition
  if (level.unlockCondition.type === 'level_complete') {
    return completedLevels.includes(level.unlockCondition.levelId);
  }

  return false;
}

/**
 * Récupère les niveaux accessibles pour un joueur
 */
export function getAccessibleLevels(completedLevels = []) {
  return getAllDungeonLevels().filter(level =>
    isLevelUnlocked(level.id, completedLevels)
  );
}

/**
 * Récupère le prochain niveau non complété
 */
export function getNextLevel(completedLevels = []) {
  const allLevels = getAllDungeonLevels();
  return allLevels.find(level => !completedLevels.includes(level.id)) || null;
}
