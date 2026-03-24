/**
 * Historique des matchs Red coop : un document par joueur et par salle
 * (coopRedMatchHistory/{userId}/matches/{roomId}).
 * Écriture côté client au moment où le joueur reçoit la salle en « completed »
 * (chaque joueur écrit uniquement son propre chemin — règles Firestore).
 */
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';

const ROOT = 'coopRedMatchHistory';

/**
 * @param {object} roomData — snapshot salle { id, status, combat, hostId, guestId, ... }
 * @param {string} userId
 * @returns {Promise<{ success: boolean }>}
 */
export async function ensureCoopRedHistoryEntryFromRoom(roomData, userId) {
  if (!roomData?.id || !userId) return { success: false };
  if (roomData.status !== 'completed' || !roomData.combat?.winner) return { success: false };
  if (roomData.hostId !== userId && roomData.guestId !== userId) return { success: false };
  if (roomData.combatSeed == null || !roomData.hostSnapshot || !roomData.guestSnapshot) {
    return { success: false };
  }

  await waitForFirestore();

  const iWasHost = roomData.hostId === userId;
  const partnerName = iWasHost
    ? (roomData.guestSnapshot?.name ?? 'Invité')
    : (roomData.hostSnapshot?.name ?? 'Hôte');
  const partnerUserId = iWasHost ? roomData.guestId : roomData.hostId;

  const entry = {
    roomId: roomData.id,
    difficulty: roomData.difficulty,
    combatSeed: roomData.combatSeed,
    combat: roomData.combat,
    hostSnapshot: roomData.hostSnapshot,
    guestSnapshot: roomData.guestSnapshot,
    winner: roomData.combat.winner,
    iWasHost,
    partnerName,
    partnerUserId: partnerUserId ?? null,
    myDropGranted: iWasHost ? !!roomData.hostDropGranted : !!roomData.guestDropGranted,
    myEchoRaceGrant: iWasHost
      ? (roomData.hostEchoRaceGrant ?? null)
      : (roomData.guestEchoRaceGrant ?? null),
    completedAt: roomData.updatedAt ?? roomData.createdAt ?? Timestamp.now(),
  };

  const ref = doc(db, ROOT, userId, 'matches', roomData.id);
  await setDoc(ref, entry, { merge: true });
  return { success: true };
}

/**
 * @param {string} userId
 * @param {(rows: object[]) => void} onData
 * @param {(e: Error) => void} [onError]
 * @param {number} [maxRows]
 * @returns {() => void} unsubscribe
 */
export function subscribeCoopRedMatchHistory(userId, onData, onError, maxRows = 50) {
  if (!userId) {
    return () => {};
  }
  const q = query(
    collection(db, ROOT, userId, 'matches'),
    orderBy('completedAt', 'desc'),
    limit(maxRows)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(rows);
    },
    onError || (() => {})
  );
}
