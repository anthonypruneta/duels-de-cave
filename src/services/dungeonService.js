/**
 * Service Donjon - Duels de Cave
 *
 * Gère les opérations liées au donjon :
 * - Limite 15 runs/jour max cumulés (5 à minuit, 5 à midi, 5 à 18h)
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
  query,
  runTransaction,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, functions, getHttpsCallable, waitForFirestore } from '../firebase/config';
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
import { PENDING_TOURNAMENT_BETTING_RUNS_FIELD } from './tournamentBettingService';

/**
 * Bornes pour recaler bossRushCompletions (rétroactif + anti-spam) :
 * - ceiling : un perso actif = au plus une semaine de jeu ; chaque archive = une semaine passée.
 *   Donc au plus (archives + 1) complétions « légitimes » une par semaine.
 * - survivantEvidence : archives + perso actuel avec le titre Survivant (preuve d’au moins un BR sur cette vie).
 */
export async function getBossRushCompletionBounds(userId, character) {
  if (!userId) return { ceiling: 999, survivantEvidence: 0 };
  let archivedCount = 0;
  let survivantLives = 0;
  try {
    const snap = await getDocs(
      query(collection(db, 'archivedCharacters'), where('userId', '==', userId))
    );
    archivedCount = snap.size;
    snap.forEach((d) => {
      const t = d.data()?.earnedTitles;
      if (Array.isArray(t) && t.includes('survivant')) survivantLives += 1;
    });
  } catch (_) {
    /* ignore */
  }

  const ceiling = Math.max(1, archivedCount + 1);
  const curTitles = character?.earnedTitles;
  const curSurvivant = Array.isArray(curTitles) && curTitles.includes('survivant') ? 1 : 0;
  const survivantEvidence = survivantLives + curSurvivant;

  return { ceiling, survivantEvidence };
}

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

    // Tout le crédit de runs / init doit venir du serveur (anti-cheat horloge).
    const call = getHttpsCallable(functions, 'dungeon_getProgress');
    const response = await call({ userId });
    const data = response?.data?.data || response?.data || {};
    return { success: true, data };
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
    const call = getHttpsCallable(functions, 'dungeon_startRun');
    const response = await call({ userId });
    const payload = response?.data || {};
    return {
      success: true,
      runsRemaining: payload.runsRemaining,
      startingLevel: payload.startingLevel ?? 1,
    };
  } catch (error) {
    const msg = error?.message || '';
    if (msg.includes('resource-exhausted') || msg.includes('Plus de runs disponibles')) {
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
  if (!level) return [null, null, null];

  const picked = [];
  for (let i = 0; i < 3; i++) {
    let weapon = getRandomWeaponByRarity(level.dropRarity);
    let attempts = 0;
    while (picked.some(w => w.id === weapon.id) && attempts < 10) {
      weapon = getRandomWeaponByRarity(level.dropRarity);
      attempts++;
    }
    picked.push(weapon);
  }

  console.log(`🎁 Loot triplet: ${picked.map(w => w.nom).join(' / ')}`);
  return picked;
};

// ============================================================================
// ENREGISTRER LA FIN D'UNE RUN (victoire ou défaite)
// ============================================================================
export const endDungeonRun = async (userId, highestLevelBeaten, defeatedOnLevel = null) => {
  try {
    console.log('🏆 Fin de run:', { userId, highestLevelBeaten, defeatedOnLevel });

    // Générer le loot basé sur le dernier niveau réussi (triplet de 3 armes)
    const lootWeapons = highestLevelBeaten > 0 ? generateLootPair(highestLevelBeaten) : [null, null, null];
    const lootWeapon = lootWeapons[0];

    // Mettre à jour les stats côté serveur (anti-cheat).
    const call = getHttpsCallable(functions, 'dungeon_endRun');
    await call({ userId, highestLevelBeaten, defeatedOnLevel });

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

    const call = getHttpsCallable(functions, 'dungeon_setEquippedWeapon');
    await call({ userId, weaponId });

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

    const call = getHttpsCallable(functions, 'dungeon_setEquippedWeapon');
    await call({ userId, weaponId: null });

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

    const call = getHttpsCallable(functions, 'dungeon_setEquippedWeapon');
    await call({ userId, weaponId: null });

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
    const call = getHttpsCallable(functions, 'dungeon_markCompleted');
    await call({ userId, dungeonKey });

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
    // Récompenses runs (Boss Rush / Mirror / Labyrinthe) : côté serveur (anti-cheat).
    const call = getHttpsCallable(functions, 'dungeon_grantRuns');
    await call({ userId, attempts });
    return true;
  } catch (err) {
    console.error('Erreur grantRunsToPlayer:', err);
    return false;
  }
}

/**
 * Réclame la récompense Boss Rush (+10 runs) si éligible.
 * Serveur-side (transaction) et rétroactif: accordée à la prochaine visite.
 */
export async function claimBossRushRewardIfEligible(userId) {
  if (!userId) return { success: false, granted: false, error: 'Utilisateur manquant' };
  try {
    const call = getHttpsCallable(functions, 'bossRush_claimReward');
    const res = await call({ userId });
    const data = res?.data || {};
    return { success: true, granted: !!data.granted, reason: data.reason || null };
  } catch (err) {
    console.error('claimBossRushRewardIfEligible:', err);
    return { success: false, granted: false, error: err?.message || String(err) };
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
