/**
 * Service Forge des Légendes - Duels de Cave
 *
 * Gère :
 * - Sauvegarde/chargement des upgrades d'armes forgées
 * - Stockage des données d'upgrade sur le personnage
 */

import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';

const retryOperation = async (operation, maxRetries = 3, delayMs = 1000) => {
  await waitForFirestore();
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const isNetworkError =
        error.code === 'unavailable' ||
        error.code === 'deadline-exceeded' ||
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('network') ||
        error.message?.includes('offline');

      if (!isNetworkError || attempt === maxRetries) {
        console.error(`Echec definitif apres ${attempt} tentatives:`, error.message);
        throw error;
      }

      console.warn(`Tentative ${attempt}/${maxRetries} echouee, retry dans ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }

  throw lastError;
};

/**
 * Sauvegarde l'upgrade de forge sur le personnage
 */
export const saveWeaponUpgrade = async (userId, upgradeData) => {
  try {
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      await setDoc(characterRef, {
        forgeUpgrade: {
          ...upgradeData,
          updatedAt: Timestamp.now(),
        },
        updatedAt: Timestamp.now(),
      }, { merge: true });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur sauvegarde upgrade forge:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Charge l'upgrade de forge du personnage
 */
export const getWeaponUpgrade = async (userId) => {
  try {
    const result = await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      return await getDoc(characterRef);
    });

    if (result.exists()) {
      const data = result.data();
      return { success: true, data: data.forgeUpgrade || null };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error('Erreur chargement upgrade forge:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Supprime l'upgrade de forge du personnage
 */
export const clearWeaponUpgrade = async (userId) => {
  try {
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      await setDoc(characterRef, {
        forgeUpgrade: null,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur suppression upgrade forge:', error);
    return { success: false, error: error.message };
  }
};
