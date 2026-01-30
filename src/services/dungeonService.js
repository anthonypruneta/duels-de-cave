/**
 * Service Donjon - Duels de Cave
 *
 * Gère les opérations liées au donjon :
 * - Limite de 10 runs par jour (cumulables)
 * - Progression niveau 1 → 2 → 3 à la suite
 * - Loot du dernier étage réussi si mort
 * - Équipement des armes
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import {
  getDungeonLevelById,
  getDungeonLevelByNumber,
  isNewDay,
  getRemainingRuns,
  getResetAnchor,
  getResetPeriodsSince,
  DUNGEON_CONSTANTS
} from '../data/dungeons.js';
import { getRandomWeaponByRarity, getWeaponById } from '../data/weapons.js';
import { getUserCharacter, updateCharacterEquippedWeapon } from './characterService';

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
 *   equippedWeapon: string | null,    // ID de l'arme équipée
 *   runsToday: number,                // Nombre de runs aujourd'hui
 *   runsAvailable: number,            // Runs disponibles (cumulables)
 *   lastRunDate: Timestamp,           // Date de la dernière run
 *   lastCreditDate: Timestamp,        // Dernière attribution de runs
 *   totalRuns: number,                // Total de runs effectuées
 *   bestRun: number,                  // Meilleur niveau atteint (1-3)
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
      const data = result.data();
      console.log('✅ Progression trouvée');

      // Reset le compteur si nouveau jour
      if (isNewDay(data.lastRunDate)) {
        data.runsToday = 0;
      }

      const runsAvailable = Number.isFinite(data.runsAvailable)
        ? data.runsAvailable
        : getRemainingRuns(data.runsToday || 0, data.lastRunDate);
      const updates = {};
      const currentAnchor = getResetAnchor(new Date());

      if (!Number.isFinite(data.runsAvailable)) {
        updates.runsAvailable = runsAvailable;
        updates.lastCreditDate = Timestamp.fromDate(currentAnchor);
      } else if (!data.lastCreditDate) {
        updates.lastCreditDate = Timestamp.fromDate(currentAnchor);
      } else {
        const periods = getResetPeriodsSince(data.lastCreditDate, new Date());
        if (periods > 0) {
          updates.runsAvailable = runsAvailable + periods * DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET;
          updates.lastCreditDate = Timestamp.fromDate(currentAnchor);
        }
      }

      if (Object.keys(updates).length > 0) {
        await retryOperation(async () => {
          const progressRef = doc(db, 'dungeonProgress', userId);
          await updateDoc(progressRef, updates);
        });
        Object.assign(data, updates);
      }

      return { success: true, data };
    } else {
      // Initialiser la progression si elle n'existe pas
      console.log('ℹ️ Aucune progression, initialisation...');
      const initialProgress = {
        userId,
        equippedWeapon: null,
        runsToday: 0,
        runsAvailable: DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET,
        lastRunDate: null,
        lastCreditDate: Timestamp.fromDate(getResetAnchor(new Date())),
        totalRuns: 0,
        bestRun: 0,
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
// VÉRIFIER SI LE JOUEUR PEUT FAIRE UNE RUN
// ============================================================================
export const canStartDungeonRun = async (userId) => {
  try {
    const { success, data, error } = await getDungeonProgress(userId);

    if (!success) {
      return { canStart: false, error };
    }

    const remaining = Number.isFinite(data.runsAvailable)
      ? data.runsAvailable
      : getRemainingRuns(data.runsToday, data.lastRunDate);

    return {
      canStart: remaining > 0,
      runsRemaining: remaining,
      runsToday: isNewDay(data.lastRunDate) ? 0 : data.runsToday,
      maxRuns: DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET,
      reason: remaining > 0 ? 'ok' : 'no_runs_left'
    };
  } catch (error) {
    console.error('❌ Erreur vérification run:', error);
    return { canStart: false, error: error.message };
  }
};

// ============================================================================
// DÉMARRER UNE RUN DE DONJON
// ============================================================================
export const startDungeonRun = async (userId) => {
  try {
    const canStartResult = await canStartDungeonRun(userId);

    if (!canStartResult.canStart) {
      return {
        success: false,
        error: 'Plus de runs disponibles aujourd\'hui',
        runsRemaining: 0
      };
    }

    console.log('🏰 Démarrage d\'une run de donjon');

    // Incrémenter le compteur de runs
    await retryOperation(async () => {
      const progressRef = doc(db, 'dungeonProgress', userId);
      const progressSnap = await getDoc(progressRef);
      const currentData = progressSnap.data();

      // Reset si nouveau jour
      const runsToday = isNewDay(currentData.lastRunDate) ? 1 : currentData.runsToday + 1;
      const currentAvailable = Number.isFinite(currentData.runsAvailable)
        ? currentData.runsAvailable
        : getRemainingRuns(currentData.runsToday || 0, currentData.lastRunDate);
      const runsAvailable = Math.max(0, currentAvailable - 1);

      await updateDoc(progressRef, {
        runsToday,
        runsAvailable,
        lastRunDate: Timestamp.now(),
        totalRuns: (currentData.totalRuns || 0) + 1,
        updatedAt: Timestamp.now()
      });
    });

    return {
      success: true,
      runsRemaining: canStartResult.runsRemaining - 1,
      startingLevel: 1
    };
  } catch (error) {
    console.error('❌ Erreur démarrage run:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// GÉNÉRER LE LOOT POUR UN NIVEAU
// ============================================================================
export const generateLoot = (levelNumber) => {
  const level = getDungeonLevelByNumber(levelNumber);

  if (!level) {
    console.error('❌ Niveau invalide:', levelNumber);
    return null;
  }

  // Tire une arme aléatoire de la rareté correspondant au niveau
  const weapon = getRandomWeaponByRarity(level.dropRarity);

  console.log(`🎁 Loot généré: ${weapon.nom} (${weapon.rarete})`);

  return weapon;
};

// ============================================================================
// ENREGISTRER LA FIN D'UNE RUN (victoire ou défaite)
// ============================================================================
export const endDungeonRun = async (userId, highestLevelBeaten, defeatedOnLevel = null) => {
  try {
    console.log('🏆 Fin de run:', { userId, highestLevelBeaten, defeatedOnLevel });

    // Générer le loot basé sur le dernier niveau réussi
    const lootWeapon = highestLevelBeaten > 0 ? generateLoot(highestLevelBeaten) : null;

    // Mettre à jour les stats
    await retryOperation(async () => {
      const progressRef = doc(db, 'dungeonProgress', userId);
      const progressSnap = await getDoc(progressRef);
      const currentData = progressSnap.data();

      const updateData = {
        totalBossKills: (currentData.totalBossKills || 0) + highestLevelBeaten,
        updatedAt: Timestamp.now()
      };

      // Mettre à jour le meilleur score si battu
      if (highestLevelBeaten > (currentData.bestRun || 0)) {
        updateData.bestRun = highestLevelBeaten;
      }

      await updateDoc(progressRef, updateData);
    });

    return {
      success: true,
      highestLevelBeaten,
      defeatedOnLevel,
      lootWeapon,
      isFullClear: highestLevelBeaten === DUNGEON_CONSTANTS.TOTAL_LEVELS
    };
  } catch (error) {
    console.error('❌ Erreur fin de run:', error);
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

    await updateCharacterEquippedWeapon(userId, weaponId);

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

    await updateCharacterEquippedWeapon(userId, null);

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
// RESET LES RUNS D'UN JOUEUR (admin)
// ============================================================================
export const resetDungeonRuns = async (userId) => {
  try {
    console.log('🔄 Reset des runs pour:', userId);

    await retryOperation(async () => {
      const progressRef = doc(db, 'dungeonProgress', userId);
      await deleteDoc(progressRef);
    });

    console.log('✅ Runs réinitialisées');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur reset runs:', error);
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
    let equippedWeapon = null;
    const characterResult = await getUserCharacter(userId);
    const characterWeaponId = characterResult.success ? characterResult.data?.equippedWeaponId || null : null;

    if (characterWeaponId) {
      equippedWeapon = getWeaponById(characterWeaponId);
    }

    if (!equippedWeapon) {
      equippedWeapon = progress.equippedWeapon
        ? getWeaponById(progress.equippedWeapon)
        : null;
    }

    const runsRemaining = Number.isFinite(progress.runsAvailable)
      ? progress.runsAvailable
      : getRemainingRuns(progress.runsToday, progress.lastRunDate);

    return {
      success: true,
      data: {
        ...progress,
        equippedWeaponData: equippedWeapon,
        runsRemaining,
        maxRuns: DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET,
        hasLegendaryWeapon: equippedWeapon?.rarete === 'légendaire'
      }
    };
  } catch (error) {
    console.error('❌ Erreur résumé joueur:', error);
    return { success: false, error: error.message };
  }
};
