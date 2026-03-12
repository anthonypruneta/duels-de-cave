/**
 * Service de gestion des titres — persistance Firestore
 *
 * Deux mécanismes de détection :
 * 1. detectTitlesFromCombat — titres basés sur un combat unique (grosse_cave, miracle, etc.)
 * 2. checkCrossWeekTitles — titres basés sur l'historique cross-semaines (legendaire, maudit)
 *    Utilise tournamentRewards/{userId}.tournamentWins et .consecutiveFirstRoundLosses
 */

import { doc, getDoc, setDoc, Timestamp, increment } from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import { detectTitlesFromCombat, getFormattedTitle } from '../data/titles';

/**
 * Vérifie si de nouveaux titres ont été obtenus après un combat et les enregistre.
 *
 * @param {string} userId
 * @param {Array} steps - Steps de simulerMatch
 * @param {Object} result - Résultat de simulerMatch
 * @param {Object} playerChar - Données du personnage
 * @param {Object} context - { mode, floor, bossId, isFinalBoss, ... }
 * @returns {string[]} Nouveaux titres obtenus lors de ce combat
 */
export async function checkAndAwardTitles(userId, steps, result, playerChar, context = {}) {
  if (!userId || !steps || !result) return [];

  const detected = detectTitlesFromCombat(steps, result, playerChar, context);
  if (detected.length === 0) return [];

  try {
    await waitForFirestore();
    const charRef = doc(db, 'characters', userId);
    const snap = await getDoc(charRef);
    const data = snap.data() || {};
    const earnedTitles = data.earnedTitles || [];

    const newTitles = detected.filter(id => !earnedTitles.includes(id));
    if (newTitles.length === 0) return [];

    const updatedEarned = [...earnedTitles, ...newTitles];
    await setDoc(charRef, {
      earnedTitles: updatedEarned,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    return newTitles;
  } catch (err) {
    console.error('Erreur lors de l\'attribution des titres:', err);
    return [];
  }
}

/**
 * Vérifie les titres basés sur l'historique et la progression du compte.
 * Appelé au chargement du personnage (page d'accueil).
 *
 * Vérifie :
 * - tournamentWins >= 2 → titre "legendaire"
 * - consecutiveFirstRoundLosses >= 3 → titre "maudit"
 * - bossRushCompleted → titre "survivant"
 * - labyrinth highestClearedFloor >= 120 → titre "fleau_labyrinthe"
 *
 * @param {string} userId - ID du compte
 * @param {Object} [extras] - Données de progression supplémentaires
 * @param {number} [extras.labyrinthHighestFloor] - Meilleur étage du labyrinthe
 * @returns {string[]} Nouveaux titres attribués
 */
export async function checkCrossWeekTitles(userId, extras = {}) {
  if (!userId) return [];

  try {
    await waitForFirestore();

    const [charSnap, rewardSnap] = await Promise.all([
      getDoc(doc(db, 'characters', userId)),
      getDoc(doc(db, 'tournamentRewards', userId)),
    ]);

    if (!charSnap.exists()) return [];
    const charData = charSnap.data();
    const earnedTitles = charData.earnedTitles || [];
    const rewardData = rewardSnap.exists() ? rewardSnap.data() : {};

    const newTitles = [];

    if (!earnedTitles.includes('legendaire') && (rewardData.tournamentWins ?? 0) >= 2) {
      newTitles.push('legendaire');
    }

    if (!earnedTitles.includes('maudit') && (rewardData.consecutiveFirstRoundLosses ?? 0) >= 3) {
      newTitles.push('maudit');
    }

    if (!earnedTitles.includes('survivant') && charData.bossRushCompleted) {
      newTitles.push('survivant');
    }

    const labFloor = extras.labyrinthHighestFloor ?? 0;
    if (!earnedTitles.includes('fleau_labyrinthe') && labFloor >= 120) {
      newTitles.push('fleau_labyrinthe');
    }

    if (newTitles.length === 0) return [];

    const updatedEarned = [...earnedTitles, ...newTitles];
    await setDoc(doc(db, 'characters', userId), {
      earnedTitles: updatedEarned,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    return newTitles;
  } catch (err) {
    console.error('Erreur vérification titres cross-semaines:', err);
    return [];
  }
}

/**
 * Met à jour le tracking des défaites au 1er tour du tournoi.
 * Appelé par le système de tournoi après chaque match du 1er tour.
 *
 * @param {string} ownerUserId - ID du compte du joueur
 * @param {boolean} lostFirstRound - true si le joueur a perdu au 1er tour
 */
export async function trackTournamentFirstRoundResult(ownerUserId, lostFirstRound) {
  if (!ownerUserId) return;
  try {
    await waitForFirestore();
    const rewardRef = doc(db, 'tournamentRewards', ownerUserId);

    if (lostFirstRound) {
      await setDoc(rewardRef, {
        consecutiveFirstRoundLosses: increment(1),
      }, { merge: true });
    } else {
      await setDoc(rewardRef, {
        consecutiveFirstRoundLosses: 0,
      }, { merge: true });
    }
  } catch (err) {
    console.error('Erreur tracking 1er tour tournoi:', err);
  }
}

/**
 * Équipe un titre pour le personnage.
 */
export async function equipTitle(userId, titleId) {
  try {
    await waitForFirestore();
    const charRef = doc(db, 'characters', userId);
    await setDoc(charRef, {
      equippedTitle: titleId || null,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Erreur lors de l\'équipement du titre:', err);
  }
}

/**
 * Retourne le titre formaté pour affichage sur la carte.
 */
export function getDisplayTitle(titleId, gender) {
  if (!titleId) return null;
  return getFormattedTitle(titleId, gender);
}
