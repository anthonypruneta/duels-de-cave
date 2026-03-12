/**
 * Service de gestion des titres — persistance Firestore
 */

import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
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
