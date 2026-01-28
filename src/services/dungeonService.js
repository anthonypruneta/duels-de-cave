/**
 * Service Donjon - Duels de Cave
 *
 * Gère les opérations liées au donjon :
 * - Progression des niveaux
 * - Génération et attribution du loot
 * - Équipement des armes
 * - Stockage Firestore
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import { getDungeonLevelById, isLevelUnlocked } from '../data/dungeons.js';
import { getRandomWeaponByRarity, getWeaponById } from '../data/weapons.js';

// ============================================================================
// HELPER RETRY (même pattern que characterService)
// ============================================================================
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
        console.error(`❌ Échec définitif après ${attempt} tentatives:`, error.message);
        throw error;
      }

      console.warn(`⚠️ Tentative ${attempt}/${maxRetries} échouée, retry dans ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }

  throw lastError;
};

// ============================================================================
// STRUCTURE DE DONNÉES DONJON POUR UN JOUEUR
// ============================================================================
/**
 * Document Firestore: dungeonProgress/{userId}
 * {
 *   userId: string,
 *   completedLevels: string[],        // IDs des niveaux complétés
 *   equippedWeapon: string | null,    // ID de l'arme équipée
 *   lastDungeonRun: Timestamp,        // Dernière tentative de donjon
 *   totalBossKills: number,           // Stats globales
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp
 * }
 */

// ============================================================================
// RÉCUPÉRER LA PROGRESSION D'UN JOUEUR
// ============================================================================
export const getDungeonProgress = async (userId) => {
  try {
    console.log('📖 Récupération de la progression donjon pour:', userId);

    const result = await retryOperation(async () => {
      const progressRef = doc(db, 'dungeonProgress', userId);
      return await getDoc(progressRef);
    });

    if (result.exists()) {
      console.log('✅ Progression trouvée');
      return { success: true, data: result.data() };
    } else {
      // Initialiser la progression si elle n'existe pas
      console.log('ℹ️ Aucune progression, initialisation...');
      const initialProgress = {
        userId,
        completedLevels: [],
        equippedWeapon: null,
        lastDungeonRun: null,
        totalBossKills: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await retryOperation(async () => {
        const progressRef = doc(db, 'dungeonProgress', userId);
        await setDoc(progressRef, initialProgress);
      });

      return { success: true, data: initialProgress };
    }
  } catch (error) {
    console.error('❌ Erreur récupération progression:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// VÉRIFIER SI UN NIVEAU EST ACCESSIBLE
// ============================================================================
export const canAccessLevel = async (userId, levelId) => {
  try {
    const { success, data, error } = await getDungeonProgress(userId);

    if (!success) {
      return { canAccess: false, error };
    }

    const canAccess = isLevelUnlocked(levelId, data.completedLevels);
    const level = getDungeonLevelById(levelId);

    return {
      canAccess,
      level,
      completedLevels: data.completedLevels,
      reason: canAccess ? 'unlocked' : 'locked'
    };
  } catch (error) {
    console.error('❌ Erreur vérification accès niveau:', error);
    return { canAccess: false, error: error.message };
  }
};

// ============================================================================
// GÉNÉRER LE LOOT APRÈS VICTOIRE
// ============================================================================
export const generateLoot = (levelId) => {
  const level = getDungeonLevelById(levelId);

  if (!level) {
    console.error('❌ Niveau invalide:', levelId);
    return null;
  }

  // Tire une arme aléatoire de la rareté correspondant au niveau
  const weapon = getRandomWeaponByRarity(level.dropRarity);

  console.log(`🎁 Loot généré: ${weapon.nom} (${weapon.rarete})`);

  return weapon;
};

// ============================================================================
// ENREGISTRER LA VICTOIRE ET LE LOOT
// ============================================================================
export const recordVictory = async (userId, levelId, droppedWeaponId) => {
  try {
    console.log('🏆 Enregistrement victoire:', { userId, levelId, droppedWeaponId });

    const result = await retryOperation(async () => {
      const progressRef = doc(db, 'dungeonProgress', userId);
      const progressSnap = await getDoc(progressRef);
      const currentData = progressSnap.exists() ? progressSnap.data() : {
        userId,
        completedLevels: [],
        equippedWeapon: null,
        totalBossKills: 0,
        createdAt: Timestamp.now()
      };

      // Ajouter le niveau aux niveaux complétés (sans doublon)
      const completedLevels = currentData.completedLevels || [];
      if (!completedLevels.includes(levelId)) {
        completedLevels.push(levelId);
      }

      const updatedData = {
        ...currentData,
        completedLevels,
        lastDungeonRun: Timestamp.now(),
        totalBossKills: (currentData.totalBossKills || 0) + 1,
        updatedAt: Timestamp.now()
      };

      await setDoc(progressRef, updatedData);
      return updatedData;
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Erreur enregistrement victoire:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// ÉQUIPER UNE ARME
// ============================================================================
export const equipWeapon = async (userId, weaponId) => {
  try {
    console.log('⚔️ Équipement arme:', { userId, weaponId });

    // Vérifier que l'arme existe
    const weapon = getWeaponById(weaponId);
    if (!weapon) {
      return { success: false, error: 'Arme invalide' };
    }

    await retryOperation(async () => {
      const progressRef = doc(db, 'dungeonProgress', userId);
      await updateDoc(progressRef, {
        equippedWeapon: weaponId,
        updatedAt: Timestamp.now()
      });
    });

    console.log('✅ Arme équipée:', weapon.nom);
    return { success: true, weapon };
  } catch (error) {
    console.error('❌ Erreur équipement arme:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// DÉSÉQUIPER UNE ARME
// ============================================================================
export const unequipWeapon = async (userId) => {
  try {
    console.log('🔄 Déséquipement arme:', userId);

    await retryOperation(async () => {
      const progressRef = doc(db, 'dungeonProgress', userId);
      await updateDoc(progressRef, {
        equippedWeapon: null,
        updatedAt: Timestamp.now()
      });
    });

    console.log('✅ Arme déséquipée');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur déséquipement:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// RÉCUPÉRER L'ARME ÉQUIPÉE D'UN JOUEUR
// ============================================================================
export const getEquippedWeapon = async (userId) => {
  try {
    const { success, data, error } = await getDungeonProgress(userId);

    if (!success) {
      return { success: false, error };
    }

    if (!data.equippedWeapon) {
      return { success: true, weapon: null };
    }

    const weapon = getWeaponById(data.equippedWeapon);
    return { success: true, weapon };
  } catch (error) {
    console.error('❌ Erreur récupération arme équipée:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// GÉRER LE CHOIX DU LOOT (équiper ou garder l'actuelle)
// ============================================================================
export const handleLootChoice = async (userId, droppedWeaponId, equipNew) => {
  try {
    console.log('🎯 Choix loot:', { userId, droppedWeaponId, equipNew });

    if (equipNew) {
      // Équiper la nouvelle arme
      return await equipWeapon(userId, droppedWeaponId);
    } else {
      // Garder l'ancienne arme - on ne fait rien, le loot est perdu
      console.log('ℹ️ Joueur garde son arme actuelle, nouveau loot ignoré');
      return { success: true, kept: true };
    }
  } catch (error) {
    console.error('❌ Erreur choix loot:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// OBTENIR LE RÉSUMÉ COMPLET D'UN JOUEUR (progression + arme)
// ============================================================================
export const getPlayerDungeonSummary = async (userId) => {
  try {
    const progressResult = await getDungeonProgress(userId);

    if (!progressResult.success) {
      return { success: false, error: progressResult.error };
    }

    const progress = progressResult.data;
    const equippedWeapon = progress.equippedWeapon
      ? getWeaponById(progress.equippedWeapon)
      : null;

    return {
      success: true,
      data: {
        ...progress,
        equippedWeaponData: equippedWeapon,
        levelsCompleted: progress.completedLevels.length,
        hasLegendaryWeapon: equippedWeapon?.rarete === 'légendaire'
      }
    };
  } catch (error) {
    console.error('❌ Erreur résumé joueur:', error);
    return { success: false, error: error.message };
  }
};
