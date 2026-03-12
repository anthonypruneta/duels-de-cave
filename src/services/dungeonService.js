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
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import {
  getDungeonLevelById,
  getDungeonLevelByNumber,
  isNewDay,
  getRemainingRuns,
  getResetAnchor,
  getResetPeriodsSince,
  getRunsSinceWeekStart,
  getInitialRunsForNewPlayer,
  DUNGEON_CONSTANTS
} from '../data/dungeons.js';
import { getRandomWeaponByRarity, getWeaponById } from '../data/weapons.js';
import { getUserCharacter, updateCharacterEquippedWeapon } from './characterService';
import { clearWeaponUpgrade } from './forgeService';
import { announceFirstDungeonFinalBossKill } from './milestoneAnnouncementService';

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
      // Dimanche (Paris) = 0 runs pour fresh restart le lundi ; sinon rattrapage depuis lundi
      console.log('ℹ️ Aucune progression, initialisation...');
      const now = new Date();
      const initialRuns = getInitialRunsForNewPlayer(now);
      console.log(`🎁 Nouveau joueur: ${initialRuns} essais attribués${initialRuns === 0 ? ' (dimanche, fresh restart lundi)' : ' (rattrapage depuis lundi)'}`);
      const initialProgress = {
        userId,
        equippedWeapon: null,
        runsToday: 0,
        runsAvailable: initialRuns,
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
// DÉMARRER UNE RUN DE DONJON (transaction atomique = anti-spam / pas de double run)
// ============================================================================
export const startDungeonRun = async (userId) => {
  try {
    await waitForFirestore();
    const progressRef = doc(db, 'dungeonProgress', userId);

    let runsRemainingAfter = 0;

    await runTransaction(db, async (transaction) => {
      const progressSnap = await transaction.get(progressRef);
      const currentData = progressSnap.exists() ? progressSnap.data() : null;

      const now = new Date();
      const initialProgress = {
        userId,
        runsToday: 0,
        runsAvailable: getInitialRunsForNewPlayer(now),
        lastRunDate: null,
        lastCreditDate: Timestamp.fromDate(getResetAnchor(now)),
        totalRuns: 0,
        bestRun: 0,
        totalBossKills: 0,
        equippedWeapon: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const data = currentData || initialProgress;
      const runsToday = isNewDay(data.lastRunDate) ? 0 : (data.runsToday || 0);
      const currentAvailable = Number.isFinite(data.runsAvailable)
        ? data.runsAvailable
        : getRemainingRuns(runsToday, data.lastRunDate);

      if (currentAvailable <= 0) {
        throw new Error('NO_RUNS_LEFT');
      }

      const newRunsToday = isNewDay(data.lastRunDate) ? 1 : (data.runsToday || 0) + 1;
      const newRunsAvailable = currentAvailable - 1;
      runsRemainingAfter = newRunsAvailable;

      if (!progressSnap.exists()) {
        transaction.set(progressRef, {
          ...initialProgress,
          runsToday: 1,
          runsAvailable: getInitialRunsForNewPlayer(now) - 1,
          lastRunDate: Timestamp.now(),
          totalRuns: 1,
          updatedAt: Timestamp.now()
        });
      } else {
        transaction.update(progressRef, {
          runsToday: newRunsToday,
          runsAvailable: newRunsAvailable,
          lastRunDate: Timestamp.now(),
          totalRuns: (data.totalRuns || 0) + 1,
          updatedAt: Timestamp.now()
        });
      }
    });

    console.log('🏰 Démarrage d\'une run de donjon (ok)');
    return {
      success: true,
      runsRemaining: runsRemainingAfter,
      startingLevel: 1
    };
  } catch (error) {
    if (error?.message === 'NO_RUNS_LEFT') {
      return {
        success: false,
        error: 'Plus de runs disponibles',
        runsRemaining: 0
      };
    }
    console.error('❌ Erreur démarrage run:', error);
    return { success: false, error: error.message || 'Erreur démarrage run' };
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

export const generateLootPair = (levelNumber) => {
  const level = getDungeonLevelByNumber(levelNumber);
  if (!level) return [null, null];

  const weapon1 = getRandomWeaponByRarity(level.dropRarity);
  let weapon2 = getRandomWeaponByRarity(level.dropRarity);
  let attempts = 0;
  while (weapon2.id === weapon1.id && attempts < 10) {
    weapon2 = getRandomWeaponByRarity(level.dropRarity);
    attempts++;
  }

  console.log(`🎁 Loot paire: ${weapon1.nom} / ${weapon2.nom}`);
  return [weapon1, weapon2];
};

// ============================================================================
// ENREGISTRER LA FIN D'UNE RUN (victoire ou défaite)
// ============================================================================
export const endDungeonRun = async (userId, highestLevelBeaten, defeatedOnLevel = null) => {
  try {
    console.log('🏆 Fin de run:', { userId, highestLevelBeaten, defeatedOnLevel });

    // Générer le loot basé sur le dernier niveau réussi (paire de 2 armes)
    const lootWeapons = highestLevelBeaten > 0 ? generateLootPair(highestLevelBeaten) : [null, null];
    const lootWeapon = lootWeapons[0];

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
      lootWeapons,
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

    // Si on change d'arme, l'upgrade Forge (Ornn) est perdu
    const { success: progressOk, data: progress } = await getDungeonProgress(userId);
    if (progressOk && progress?.equippedWeapon && progress.equippedWeapon !== weaponId) {
      await clearWeaponUpgrade(userId);
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

    // Déséquiper = l'arme perd son upgrade Forge (Ornn)
    await clearWeaponUpgrade(userId);

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
// RÉINITIALISER L'ARME ÉQUIPÉE (création d'un nouveau personnage)
// ============================================================================
export const clearEquippedWeapon = async (userId) => {
  try {
    console.log('🔄 Réinitialisation arme équipée:', userId);

    await retryOperation(async () => {
      const progressRef = doc(db, 'dungeonProgress', userId);
      await setDoc(progressRef, {
        equippedWeapon: null,
        updatedAt: Timestamp.now()
      }, { merge: true });
    });

    await updateCharacterEquippedWeapon(userId, null);

    console.log('✅ Arme équipée réinitialisée');
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur réinitialisation arme équipée:', error);
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


export const markDungeonCompleted = async (userId, dungeonKey) => {
  try {
    if (!userId || !dungeonKey) return { success: false, error: 'Paramètres invalides' };

    await retryOperation(async () => {
      const progressRef = doc(db, 'dungeonProgress', userId);
      try {
        await updateDoc(progressRef, {
          [`dungeonCompletions.${dungeonKey}`]: true,
          updatedAt: Timestamp.now()
        });
      } catch {
        const now = new Date();
        await setDoc(progressRef, {
          userId,
          dungeonCompletions: {
            [dungeonKey]: true
          },
          updatedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
          runsToday: 0,
          runsAvailable: getInitialRunsForNewPlayer(now),
          totalRuns: 0,
          bestRun: 0,
          totalBossKills: 0,
          equippedWeapon: null,
          lastRunDate: null,
          lastCreditDate: Timestamp.fromDate(getResetAnchor(now))
        }, { merge: true });
      }
    });

    const characterResult = await getUserCharacter(userId);
    if (characterResult.success && characterResult.data) {
      await announceFirstDungeonFinalBossKill({
        userId,
        dungeonKey,
        character: characterResult.data
      });
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Erreur marquage donjon terminé:', error);
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

// ============================================================================
// ADMIN - AJOUTER DES ESSAIS DE DONJON À TOUT LE MONDE + MESSAGE GLOBAL
// On utilise updateDoc + increment pour les joueurs qui ont déjà une progression
// (évite un bug connu: set + merge + increment peut écraser la valeur au lieu d'ajouter).
// Pour les nouveaux joueurs sans doc dungeonProgress, on fait setDoc avec la valeur initiale.
// ============================================================================
export const grantDungeonRunsToAllPlayers = async ({ attempts, message, adminEmail }) => {
  try {
    const parsedAttempts = Number(attempts);
    if (!Number.isFinite(parsedAttempts) || parsedAttempts <= 0) {
      return { success: false, error: 'Nombre d\'essais invalide' };
    }

    const cleanMessage = (message || '').trim();
    if (!cleanMessage) {
      return { success: false, error: 'Le message est obligatoire' };
    }

    const result = await retryOperation(async () => {
      const now = Timestamp.now();
      const resetAnchor = Timestamp.fromDate(getResetAnchor(new Date()));
      const grantId = `grant_${Date.now()}`;

      const charactersSnap = await getDocs(collection(db, 'characters'));
      const playerIds = charactersSnap.docs.map((charDoc) => charDoc.id);

      // Savoir quels joueurs ont déjà un doc dungeonProgress (pour update vs set)
      const progressSnap = await getDocs(collection(db, 'dungeonProgress'));
      const existingProgressIds = new Set(progressSnap.docs.map((d) => d.id));

      const chunkSize = 400;
      for (let i = 0; i < playerIds.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = playerIds.slice(i, i + chunkSize);

        chunk.forEach((userId) => {
          const progressRef = doc(db, 'dungeonProgress', userId);
          if (existingProgressIds.has(userId)) {
            // Document existant : ajouter les runs (jamais écraser)
            batch.update(progressRef, {
              runsAvailable: increment(parsedAttempts),
              updatedAt: now
            });
          } else {
            // Nouveau joueur sans progression : créer le doc avec le nombre accordé
            batch.set(progressRef, {
              userId,
              runsAvailable: parsedAttempts,
              lastCreditDate: resetAnchor,
              createdAt: now,
              updatedAt: now,
              runsToday: 0,
              totalRuns: 0,
              bestRun: 0,
              totalBossKills: 0,
              equippedWeapon: null,
              lastRunDate: null
            }, { merge: true });
          }
        });

        await batch.commit();
      }

      await setDoc(doc(db, 'adminBroadcasts', 'dungeonRunsGrant'), {
        grantId,
        attemptsGranted: parsedAttempts,
        message: cleanMessage,
        createdAt: now,
        createdBy: adminEmail || 'admin'
      });

      return { affectedPlayers: playerIds.length, grantId };
    });

    return {
      success: true,
      affectedPlayers: result.affectedPlayers,
      grantId: result.grantId,
      attemptsGranted: parsedAttempts,
      message: cleanMessage
    };
  } catch (error) {
    console.error('❌ Erreur ajout global d\'essais donjon:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Ajoute des essais de donjon à un joueur spécifique.
 */
export async function grantRunsToPlayer(userId, attempts) {
  try {
    await retryOperation(async () => {
      const progressRef = doc(db, 'dungeonProgress', userId);
      const snap = await getDoc(progressRef);
      const now = Timestamp.now();
      if (snap.exists()) {
        await updateDoc(progressRef, {
          runsAvailable: increment(attempts),
          updatedAt: now,
        });
      } else {
        await setDoc(progressRef, {
          userId,
          runsAvailable: attempts,
          updatedAt: now,
          lastCreditDate: now,
          createdAt: now,
          runsToday: 0,
          totalRuns: 0,
          bestRun: 0,
          totalBossKills: 0,
          equippedWeapon: null,
          lastRunDate: null,
        }, { merge: true });
      }
    });
    return true;
  } catch (err) {
    console.error('Erreur grantRunsToPlayer:', err);
    return false;
  }
}

export const getLatestDungeonRunsGrant = async () => {
  try {
    const result = await retryOperation(async () => {
      const grantRef = doc(db, 'adminBroadcasts', 'dungeonRunsGrant');
      return await getDoc(grantRef);
    });

    if (!result.exists()) {
      return { success: true, data: null };
    }

    return { success: true, data: result.data() };
  } catch (error) {
    console.error('❌ Erreur récupération du dernier grant donjon:', error);
    return { success: false, error: error.message };
  }
};
