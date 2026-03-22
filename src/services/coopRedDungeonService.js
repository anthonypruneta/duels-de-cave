/**
 * Donjon coop async « Red » — rooms Firestore + quota quotidien.
 */
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  limit,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import {
  COOP_RED_LEVEL_REQUIRED,
  COOP_RED_MAX_ATTEMPTS_PER_DAY,
  COOP_RED_DROP_RATE,
} from '../data/coopRedDungeon.js';
import { simulateCoopRedCombatFull } from '../utils/coopRedCombat';
import { getUserCharacter } from './characterService';
import { races } from '../data/races.js';

const ROOMS = 'coopDungeonRooms';

function coopDropRoll01(seed, rngCounter, salt) {
  const s = (Math.imul((seed ^ salt) >>> 0, 1597334677) ^ (rngCounter * 2654435761)) >>> 0;
  return (s >>> 0) / 4294967296;
}
const DAILY = 'coopDungeonDaily';

function getParisDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

/** Salles ouvertes (en attente d’un invité) pour la liste publique. */
export function subscribeOpenCoopRedRooms(onData, onError) {
  const q = query(collection(db, ROOMS), where('status', '==', 'waiting'), limit(60));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => !r.guestId);
      rows.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds * 1000 ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds * 1000 ?? 0;
        return tb - ta;
      });
      onData(rows);
    },
    onError
  );
}

function snapshotCharacterForCoop(data) {
  if (!data) return null;
  return {
    userId: data.userId,
    name: data.name,
    race: data.race,
    class: data.class,
    level: data.level ?? 1,
    base: data.base ? { ...data.base } : {},
    bonuses: data.bonuses ? JSON.parse(JSON.stringify(data.bonuses)) : { race: {}, class: {} },
    forestBoosts: data.forestBoosts ? { ...data.forestBoosts } : {},
    equippedWeaponId: data.equippedWeaponId ?? null,
    equippedWeaponData: data.equippedWeaponData ?? null,
    forgeUpgrade: data.forgeUpgrade ?? null,
    subclass: data.subclass ?? null,
    mageTowerPassive: data.mageTowerPassive ?? null,
    additionalAwakeningRaces: Array.isArray(data.additionalAwakeningRaces)
      ? [...data.additionalAwakeningRaces]
      : [],
    awakeningForced: !!data.awakeningForced,
    coopRaceEcho: data.coopRaceEcho ?? null,
  };
}

async function retryOperation(operation, maxRetries = 3, delayMs = 1000) {
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
        error.message?.includes('Failed to fetch');
      if (!isNetworkError || attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs *= 2;
    }
  }
  throw lastError;
}

export function subscribeCoopRedRoom(roomId, onData, onError) {
  const ref = doc(db, ROOMS, roomId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({ id: snap.id, ...snap.data() });
    },
    onError
  );
}

export async function getCoopRedAttemptsLeft(userId) {
  const key = getParisDateKey();
  const ref = doc(db, DAILY, userId);
  const snap = await retryOperation(() => getDoc(ref));
  if (!snap.exists()) {
    return { success: true, attemptsLeft: COOP_RED_MAX_ATTEMPTS_PER_DAY, dateKey: key };
  }
  const d = snap.data();
  if (d.attemptsDate !== key) {
    return { success: true, attemptsLeft: COOP_RED_MAX_ATTEMPTS_PER_DAY, dateKey: key };
  }
  const used = Number(d.attemptsUsed) || 0;
  return {
    success: true,
    attemptsLeft: Math.max(0, COOP_RED_MAX_ATTEMPTS_PER_DAY - used),
    dateKey: key,
  };
}

export async function createCoopRedRoom(hostUserId, difficulty) {
  const charRes = await getUserCharacter(hostUserId);
  if (!charRes.success || !charRes.data) {
    return { success: false, error: 'Personnage introuvable.' };
  }
  const level = charRes.data.level ?? 1;
  const minLv = COOP_RED_LEVEL_REQUIRED[difficulty];
  if (level < minLv) {
    return { success: false, error: `Niveau ${minLv} requis pour cette difficulté.` };
  }
  const attempts = await getCoopRedAttemptsLeft(hostUserId);
  if (!attempts.success || attempts.attemptsLeft <= 0) {
    return { success: false, error: 'Plus d’essais disponibles aujourd’hui.' };
  }

  const roomRef = doc(collection(db, ROOMS));
  const roomId = roomRef.id;

  const room = {
    hostId: hostUserId,
    guestId: null,
    difficulty,
    status: 'waiting',
    hostSnapshot: snapshotCharacterForCoop(charRes.data),
    guestSnapshot: null,
    hostReady: false,
    guestReady: false,
    combat: null,
    attemptsConsumed: false,
    combatSeed: null,
    hostDropGranted: false,
    guestDropGranted: false,
    hostEchoDelivered: false,
    guestEchoDelivered: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await retryOperation(() => setDoc(roomRef, room));
  return { success: true, roomId };
}

/**
 * Rejoindre une salle ouverte (id document Firestore, ex. depuis la liste).
 */
export async function joinCoopRedRoom(guestUserId, roomId) {
  const id = String(roomId || '').trim();
  if (!id) {
    return { success: false, error: 'Salle invalide.' };
  }
  const charRes = await getUserCharacter(guestUserId);
  if (!charRes.success || !charRes.data) {
    return { success: false, error: 'Personnage introuvable.' };
  }

  const ref = doc(db, ROOMS, id);
  const result = await retryOperation(async () => {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        throw new Error('room_not_found');
      }
      const r = snap.data();
      if (r.status !== 'waiting') {
        throw new Error('room_closed');
      }
      if (r.hostId === guestUserId) {
        throw new Error('self_join');
      }
      if (r.guestId && r.guestId !== guestUserId) {
        throw new Error('room_full');
      }
      const minLv = COOP_RED_LEVEL_REQUIRED[r.difficulty];
      if ((charRes.data.level ?? 1) < minLv) {
        throw new Error(`level_too_low:${minLv}`);
      }
      tx.update(ref, {
        guestId: guestUserId,
        guestSnapshot: snapshotCharacterForCoop(charRes.data),
        status: 'lobby',
        hostReady: false,
        guestReady: false,
        updatedAt: Timestamp.now(),
      });
      return { roomId: id };
    });
  }).catch((e) => {
    const msg = e?.message;
    if (msg === 'room_not_found') return { success: false, error: 'Salle introuvable.' };
    if (msg === 'room_closed') return { success: false, error: 'Cette salle n’est plus disponible.' };
    if (msg === 'self_join') return { success: false, error: 'Tu es déjà l’hôte de cette salle.' };
    if (msg === 'room_full') return { success: false, error: 'La salle est pleine.' };
    if (msg?.startsWith('level_too_low')) {
      const parts = msg.split(':');
      const minLv = parts[1] ? parseInt(parts[1], 10) : 0;
      return { success: false, error: `Niveau ${minLv || '?'} requis pour cette difficulté.` };
    }
    throw e;
  });

  if (result && result.success === false) return result;
  return { success: true, roomId: id };
}

export async function setCoopRedPlayerReady(roomId, userId, ready) {
  const ref = doc(db, ROOMS, roomId);
  try {
    await retryOperation(async () => {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('missing');
        const r = snap.data();
        if (r.status !== 'lobby') throw new Error('not_lobby');
        const patch = { updatedAt: Timestamp.now() };
        if (r.hostId === userId) patch.hostReady = !!ready;
        else if (r.guestId === userId) patch.guestReady = !!ready;
        else throw new Error('not_member');
        tx.update(ref, patch);
      });
    });
    return { success: true };
  } catch (e) {
    const m = e?.message;
    if (m === 'not_lobby') return { success: false, error: 'Impossible de changer le prêt maintenant.' };
    if (m === 'not_member') return { success: false, error: 'Tu n’es pas dans cette salle.' };
    return { success: false, error: e.message || 'Erreur' };
  }
}

/** Invité quitte avant combat : la salle redevient ouverte. */
export async function leaveCoopRedRoomAsGuest(roomId, userId) {
  const ref = doc(db, ROOMS, roomId);
  try {
    await retryOperation(async () => {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const r = snap.data();
        if (r.guestId !== userId) return;
        if (r.status === 'completed' || r.status === 'simulating') return;
        tx.update(ref, {
          guestId: null,
          guestSnapshot: null,
          guestReady: false,
          hostReady: false,
          status: 'waiting',
          updatedAt: Timestamp.now(),
        });
      });
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/** Hôte supprime la salle (attente ou lobby). */
export async function deleteCoopRedRoom(roomId, hostUserId) {
  const ref = doc(db, ROOMS, roomId);
  try {
    const snap = await retryOperation(() => getDoc(ref));
    if (!snap.exists()) return { success: true };
    const r = snap.data();
    if (r.hostId !== hostUserId) return { success: false, error: 'Seul l’hôte peut supprimer la salle.' };
    if (r.status === 'simulating' && !r.combat?.winner) {
      return { success: false, error: 'Combat en cours.' };
    }
    if (r.status === 'completed') {
      return { success: false, error: 'La salle est déjà terminée.' };
    }
    await retryOperation(() => deleteDoc(ref));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Dès que les deux joueurs sont inscrits : consomme les essais, simule tout le combat (bots), enregistre le résultat.
 * Idempotent : plusieurs appels / clients convergent vers le même état final.
 */
export async function runCoopRedAutoSimulation(roomId) {
  const ref = doc(db, ROOMS, roomId);
  try {
    await retryOperation(async () => {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('missing');
        const r = snap.data();
        if (r.status === 'completed' && r.combat?.winner) return;
        if (!r.guestId || !r.hostSnapshot || !r.guestSnapshot) return;
        if (r.status === 'waiting') return;
        if (r.attemptsConsumed === true) return;

        const legacyReady =
          r.status === 'ready' && r.hostReady == null && r.guestReady == null;
        const bothReadyLobby = r.status === 'lobby' && r.hostReady === true && r.guestReady === true;
        if (!legacyReady && !bothReadyLobby) return;

        await consumeOneAttemptInTransaction(tx, r.hostId);
        await consumeOneAttemptInTransaction(tx, r.guestId);
        const seed = (Math.random() * 0x7fffffff) >>> 0;
        tx.update(ref, {
          attemptsConsumed: true,
          combatSeed: seed,
          status: 'simulating',
          combat: null,
          updatedAt: Timestamp.now(),
        });
      });
    });
  } catch (e) {
    if (e.message === 'no_attempts') {
      await retryOperation(() =>
        updateDoc(ref, {
          status: 'failed_no_attempts',
          updatedAt: Timestamp.now(),
        })
      ).catch(() => {});
      return { success: false, error: 'Un joueur n’a plus d’essais aujourd’hui.' };
    }
    return { success: false, error: e.message || 'Erreur' };
  }

  const snapAfter = await retryOperation(() => getDoc(ref));
  if (!snapAfter.exists()) return { success: false, error: 'Salle introuvable.' };
  const rd = snapAfter.data();
  if (rd.status === 'completed' && rd.combat?.winner) return { success: true };
  if (rd.status === 'failed_no_attempts') {
    return { success: false, error: 'Essais insuffisants pour lancer la simulation.' };
  }
  if (!rd.attemptsConsumed || rd.combatSeed == null) return { success: true };

  const finalCombat = simulateCoopRedCombatFull(
    rd.hostSnapshot,
    rd.guestSnapshot,
    rd.difficulty,
    rd.combatSeed
  );
  const combatForDb = { ...finalCombat };
  delete combatForDb.steps;

  try {
    await retryOperation(async () => {
      await runTransaction(db, async (tx) => {
        const s2 = await tx.get(ref);
        if (!s2.exists()) return;
        const d = s2.data();
        if (d.status === 'completed' && d.combat?.winner) return;
        if (d.combat?.winner) return;

        const rate = COOP_RED_DROP_RATE[d.difficulty] ?? 0.25;
        const hRoll = coopDropRoll01(finalCombat.seed, finalCombat.rngCounter, 0x51a1beef);
        const gRoll = coopDropRoll01(finalCombat.seed, finalCombat.rngCounter, 0x52a1beef);

        tx.update(ref, {
          combat: combatForDb,
          status: 'completed',
          hostDropGranted: hRoll < rate,
          guestDropGranted: gRoll < rate,
          updatedAt: Timestamp.now(),
        });
      });
    });
  } catch (e) {
    return { success: false, error: e.message || 'Erreur sauvegarde combat.' };
  }

  return { success: true };
}

/**
 * Après victoire + pointeau : enregistre sur le perso l’écho de la race du coéquipier (fragment d’éveil ~25 %).
 * Idempotent (hostEchoDelivered / guestEchoDelivered).
 */
export async function claimCoopRedRaceEchoIfNeeded(roomId, userId) {
  const ref = doc(db, ROOMS, roomId);
  try {
    await retryOperation(async () => {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const r = snap.data();
        if (r.status !== 'completed' || r.combat?.winner !== 'players') return;
        const charRef = doc(db, 'characters', userId);
        const cSnap = await tx.get(charRef);
        if (!cSnap.exists()) return;

        if (r.hostId === userId && r.hostDropGranted && !r.hostEchoDelivered) {
          const allyRace = r.guestSnapshot?.race;
          const charUpdate = { updatedAt: Timestamp.now() };
          if (allyRace && races[allyRace]) {
            charUpdate.coopRaceEcho = { race: allyRace };
          }
          tx.update(charRef, charUpdate);
          tx.update(ref, { hostEchoDelivered: true, updatedAt: Timestamp.now() });
        } else if (r.guestId === userId && r.guestDropGranted && !r.guestEchoDelivered) {
          const allyRace = r.hostSnapshot?.race;
          const charUpdate = { updatedAt: Timestamp.now() };
          if (allyRace && races[allyRace]) {
            charUpdate.coopRaceEcho = { race: allyRace };
          }
          tx.update(charRef, charUpdate);
          tx.update(ref, { guestEchoDelivered: true, updatedAt: Timestamp.now() });
        }
      });
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function consumeOneAttemptInTransaction(tx, userId) {
  const dateKey = getParisDateKey();
  const dRef = doc(db, DAILY, userId);
  const snap = await tx.get(dRef);
  let used = 0;
  let storedDate = null;
  if (snap.exists()) {
    const d = snap.data();
    storedDate = d.attemptsDate;
    if (d.attemptsDate === dateKey) used = Number(d.attemptsUsed) || 0;
  }
  if (storedDate !== dateKey) used = 0;
  if (used >= COOP_RED_MAX_ATTEMPTS_PER_DAY) {
    throw new Error('no_attempts');
  }
  tx.set(
    dRef,
    {
      userId,
      attemptsDate: dateKey,
      attemptsUsed: used + 1,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
}
