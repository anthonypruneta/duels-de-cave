/**
 * Service Boss Mondial (Cataclysme) - Duels de Cave
 *
 * Gère :
 * - État global de l'event (HP restant, statut, dates)
 * - Dégâts par personnage (cumul, tentatives, leaderboard)
 * - Tentatives matin/aprem avec reset automatique
 *
 * Collections Firestore :
 * - worldBossEvent (document unique "current")
 * - worldBossEvent/current/damages (sous-collection par personnage)
 */

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  increment,
  Timestamp,
  writeBatch,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import { WORLD_BOSS, EVENT_STATUS } from '../data/worldBoss.js';

// ============================================================================
// HELPER RETRY
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
      if (!isNetworkError || attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
  throw lastError;
};

// ============================================================================
// HELPERS DATE
// ============================================================================
function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isMorning() {
  return new Date().getHours() < 12;
}

// ============================================================================
// EVENT GLOBAL
// ============================================================================
const EVENT_DOC_REF = () => doc(db, 'worldBossEvent', 'current');

/**
 * Récupérer l'état de l'event
 */
export const getWorldBossEvent = async () => {
  try {
    const result = await retryOperation(async () => {
      return await getDoc(EVENT_DOC_REF());
    });

    if (result.exists()) {
      return { success: true, data: result.data() };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error('Erreur récupération event world boss:', error);
    return { success: false, error: error.message };
  }
};


/**
 * S'abonner en temps réel à l'état de l'event
 * @param {(data: object | null) => void} onData
 * @param {(error: Error) => void} onError
 * @returns {() => void} unsubscribe
 */
export const subscribeWorldBossEvent = (onData, onError = () => {}) => {
  let unsubscribe = () => {};

  waitForFirestore()
    .then(() => {
      unsubscribe = onSnapshot(
        EVENT_DOC_REF(),
        (snap) => onData(snap.exists() ? snap.data() : null),
        (error) => {
          console.error('Erreur subscription event world boss:', error);
          onError(error);
        }
      );
    })
    .catch((error) => {
      console.error('Erreur init subscription event world boss:', error);
      onError(error);
    });

  return () => unsubscribe();
};

/**
 * Démarrer l'event
 */
export const startWorldBossEvent = async () => {
  try {
    const eventData = {
      bossId: WORLD_BOSS.id,
      bossName: WORLD_BOSS.nom,
      status: EVENT_STATUS.ACTIVE,
      hpMax: WORLD_BOSS.baseStats.hp,
      hpRemaining: WORLD_BOSS.baseStats.hp,
      totalDamageDealt: 0,
      totalAttempts: 0,
      startedAt: Timestamp.now(),
      endedAt: null,
      updatedAt: Timestamp.now()
    };

    await retryOperation(async () => {
      await setDoc(EVENT_DOC_REF(), eventData);
    });

    return { success: true, data: eventData };
  } catch (error) {
    console.error('Erreur démarrage event:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Terminer l'event
 */
export const endWorldBossEvent = async () => {
  try {
    await retryOperation(async () => {
      await updateDoc(EVENT_DOC_REF(), {
        status: EVENT_STATUS.FINISHED,
        endedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur fin event:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Reset complet de l'event (HP, scores, tentatives)
 */
export const resetWorldBossEvent = async () => {
  try {
    // Supprimer toutes les entrées de dégâts
    const damagesRef = collection(db, 'worldBossEvent', 'current', 'damages');
    const damagesSnap = await retryOperation(async () => getDocs(damagesRef));

    if (!damagesSnap.empty) {
      const batch = writeBatch(db);
      damagesSnap.docs.forEach(d => batch.delete(d.ref));
      await retryOperation(async () => batch.commit());
    }

    // Reset le document event
    await retryOperation(async () => {
      await setDoc(EVENT_DOC_REF(), {
        bossId: WORLD_BOSS.id,
        bossName: WORLD_BOSS.nom,
        status: EVENT_STATUS.INACTIVE,
        hpMax: WORLD_BOSS.baseStats.hp,
        hpRemaining: WORLD_BOSS.baseStats.hp,
        totalDamageDealt: 0,
        totalAttempts: 0,
        startedAt: null,
        endedAt: null,
        updatedAt: Timestamp.now()
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur reset event:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Forcer un reset des tentatives journalières (nouvelle journée simulée)
 */
export const forceNewDay = async () => {
  try {
    const damagesRef = collection(db, 'worldBossEvent', 'current', 'damages');
    const damagesSnap = await retryOperation(async () => getDocs(damagesRef));

    if (!damagesSnap.empty) {
      const batch = writeBatch(db);
      damagesSnap.docs.forEach(d => {
        batch.update(d.ref, {
          dateKey: '',
          morningUsed: false,
          afternoonUsed: false,
          updatedAt: Timestamp.now()
        });
      });
      await retryOperation(async () => batch.commit());
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur force new day:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// DÉGÂTS PAR PERSONNAGE
// ============================================================================

/**
 * Récupérer les données de dégâts d'un personnage
 */
export const getCharacterDamage = async (characterId) => {
  try {
    const ref = doc(db, 'worldBossEvent', 'current', 'damages', characterId);
    const snap = await retryOperation(async () => getDoc(ref));
    if (snap.exists()) {
      return { success: true, data: snap.data() };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error('Erreur récupération dégâts perso:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Vérifier si un personnage peut tenter le boss
 */
export const canAttemptBoss = async (characterId) => {
  const result = await getCharacterDamage(characterId);
  if (!result.success) return { canAttempt: false, reason: 'Erreur de lecture' };

  const data = result.data;
  if (!data) return { canAttempt: true, period: isMorning() ? 'morning' : 'afternoon' };

  const todayKey = getTodayKey();

  // Reset auto si jour différent
  if (data.dateKey !== todayKey) {
    return { canAttempt: true, period: isMorning() ? 'morning' : 'afternoon' };
  }

  const morning = isMorning();
  if (morning && data.morningUsed) {
    return { canAttempt: false, reason: 'Tentative du matin déjà utilisée' };
  }
  if (!morning && data.afternoonUsed) {
    return { canAttempt: false, reason: 'Tentative de l\'après-midi déjà utilisée' };
  }

  return { canAttempt: true, period: morning ? 'morning' : 'afternoon' };
};

/**
 * Enregistrer les dégâts d'une tentative
 * Met à jour atomiquement : dégâts perso + HP global
 */
export const recordAttemptDamage = async (characterId, characterName, damage) => {
  try {
    const todayKey = getTodayKey();
    const morning = isMorning();
    const damageRef = doc(db, 'worldBossEvent', 'current', 'damages', characterId);

    // Lire l'état actuel du perso
    const snap = await retryOperation(async () => getDoc(damageRef));
    const existing = snap.exists() ? snap.data() : null;

    // Déterminer les flags matin/aprem
    const isNewDate = !existing || existing.dateKey !== todayKey;
    const morningUsed = isNewDate ? morning : (morning ? true : existing.morningUsed);
    const afternoonUsed = isNewDate ? !morning : (!morning ? true : existing.afternoonUsed);

    const updatedDamage = {
      characterId,
      characterName,
      totalDamage: (existing?.totalDamage || 0) + damage,
      lastAttemptDamage: damage,
      totalAttempts: (existing?.totalAttempts || 0) + 1,
      dateKey: todayKey,
      morningUsed,
      afternoonUsed,
      updatedAt: Timestamp.now()
    };

    // Batch : update dégâts perso + HP global
    const batch = writeBatch(db);
    batch.set(damageRef, updatedDamage);
    batch.update(EVENT_DOC_REF(), {
      hpRemaining: increment(-damage),
      totalDamageDealt: increment(damage),
      totalAttempts: increment(1),
      updatedAt: Timestamp.now()
    });

    await retryOperation(async () => batch.commit());

    return { success: true, data: updatedDamage };
  } catch (error) {
    console.error('Erreur enregistrement dégâts:', error);
    return { success: false, error: error.message };
  }
};


/**
 * S'abonner en temps réel au leaderboard
 * @param {(entries: Array<object>) => void} onData
 * @param {(error: Error) => void} onError
 * @returns {() => void} unsubscribe
 */
export const subscribeLeaderboard = (onData, onError = () => {}) => {
  let unsubscribe = () => {};

  waitForFirestore()
    .then(() => {
      const damagesRef = collection(db, 'worldBossEvent', 'current', 'damages');
      const q = query(damagesRef, orderBy('totalDamage', 'desc'));
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          onData(entries);
        },
        (error) => {
          console.error('Erreur subscription leaderboard world boss:', error);
          onError(error);
        }
      );
    })
    .catch((error) => {
      console.error('Erreur init subscription leaderboard world boss:', error);
      onError(error);
    });

  return () => unsubscribe();
};

/**
 * Récupérer le leaderboard (tous les personnages triés par dégâts)
 */
export const getLeaderboard = async () => {
  try {
    const damagesRef = collection(db, 'worldBossEvent', 'current', 'damages');
    const snap = await retryOperation(async () => getDocs(damagesRef));

    const entries = [];
    snap.docs.forEach(d => {
      entries.push({ id: d.id, ...d.data() });
    });

    // Tri décroissant par dégâts totaux
    entries.sort((a, b) => (b.totalDamage || 0) - (a.totalDamage || 0));

    return { success: true, data: entries };
  } catch (error) {
    console.error('Erreur récupération leaderboard:', error);
    return { success: false, error: error.message };
  }
};
