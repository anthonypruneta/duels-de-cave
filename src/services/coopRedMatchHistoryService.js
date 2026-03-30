/**
 * Historique des matchs Red coop : un document par joueur et par salle
 * L'historique est lié au personnage ACTUEL via `characterInstanceId` :
 * (coopRedMatchHistory/{userId}/characters/{characterInstanceId}/matches/{roomId}).
 * Écriture côté client au moment où le joueur reçoit la salle en « completed »
 * (chaque joueur écrit uniquement son propre chemin — règles Firestore).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';

const ROOT = 'coopRedMatchHistory';
const CHAR_SUB = 'characters';
const MATCHES = 'matches';
/** Même collection que `coopRedDungeonService` — salles Red (hôte / invité). */
const COOP_RED_ROOMS = 'coopDungeonRooms';

/**
 * @param {object} roomData — snapshot salle { id, status, combat, hostId, guestId, ... }
 * @param {string} userId
 * @returns {Promise<{ success: boolean }>}
 */
export async function ensureCoopRedHistoryEntryFromRoom(roomData, userId, characterInstanceId) {
  if (!roomData?.id || !userId || !characterInstanceId) return { success: false };
  if (roomData.status !== 'completed' || !roomData.combat?.winner) return { success: false };
  if (roomData.hostId !== userId && roomData.guestId !== userId) return { success: false };
  if (!roomData.hostSnapshot || !roomData.guestSnapshot) {
    return { success: false };
  }

  await waitForFirestore();

  const iWasHost = roomData.hostId === userId;
  const mySnap = iWasHost ? roomData.hostSnapshot : roomData.guestSnapshot;
  // L'historique doit correspondre au perso actuel : ignore les salles d'un ancien perso.
  if (!mySnap?.characterInstanceId || mySnap.characterInstanceId !== characterInstanceId) {
    return { success: false };
  }
  const partnerName = iWasHost
    ? (roomData.guestSnapshot?.name ?? 'Invité')
    : (roomData.hostSnapshot?.name ?? 'Hôte');
  const partnerUserId = iWasHost ? roomData.guestId : roomData.hostId;

  const completedAtRaw = roomData.updatedAt ?? roomData.createdAt ?? Timestamp.now();
  const completedAt =
    completedAtRaw && typeof completedAtRaw.toMillis === 'function'
      ? completedAtRaw
      : Timestamp.now();

  /** Ne pas stocker tout l’objet combat (logs énormes) — le replay repose sur seed + snapshots. */
  const combatMinimal = {
    winner: roomData.combat.winner,
  };

  const entry = {
    roomId: roomData.id,
    difficulty: roomData.difficulty,
    combatSeed: roomData.combatSeed ?? null,
    combat: combatMinimal,
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
    myEchoDelivered: iWasHost ? !!roomData.hostEchoDelivered : !!roomData.guestEchoDelivered,
    completedAt,
  };

  const ref = doc(db, ROOT, userId, CHAR_SUB, String(characterInstanceId), MATCHES, roomData.id);
  // Ne jamais écraser viewedAt (si déjà vu) : on ne le set qu'à la création.
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    entry.viewedAt = null;
  }
  await setDoc(ref, entry, { merge: true });
  return { success: true };
}

export async function markCoopRedHistoryMatchViewed(userId, characterInstanceId, roomId) {
  if (!userId || !characterInstanceId || !roomId) return { success: false };
  await waitForFirestore();
  try {
    const ref = doc(db, ROOT, userId, CHAR_SUB, String(characterInstanceId), MATCHES, String(roomId));
    await updateDoc(ref, { viewedAt: Timestamp.now() });
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || 'Erreur' };
  }
}

export async function setCoopRedHistoryEchoDelivered(userId, characterInstanceId, roomId, delivered) {
  if (!userId || !characterInstanceId || !roomId) return { success: false };
  await waitForFirestore();
  try {
    const ref = doc(db, ROOT, userId, CHAR_SUB, String(characterInstanceId), MATCHES, String(roomId));
    await updateDoc(ref, { myEchoDelivered: !!delivered });
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || 'Erreur' };
  }
}

/**
 * @param {string} userId
 * @param {(rows: object[]) => void} onData
 * @param {(e: Error) => void} [onError]
 * @param {number} [maxRows]
 * @returns {() => void} unsubscribe
 */
function completedAtToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'number') return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Écoute toute la sous-collection (peu de docs par joueur), tri côté client par date.
 * Évite les erreurs d’index Firestore sur orderBy('completedAt') et les docs sans champ.
 */
export function subscribeCoopRedMatchHistory(userId, characterInstanceId, onData, onError, maxRows = 50) {
  if (!userId || !characterInstanceId) {
    return () => {};
  }
  const ref = collection(db, ROOT, userId, CHAR_SUB, String(characterInstanceId), MATCHES);
  return onSnapshot(
    ref,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => completedAtToMillis(b.completedAt) - completedAtToMillis(a.completedAt))
        .slice(0, maxRows);
      onData(rows);
    },
    onError || (() => {})
  );
}

/**
 * Rattrapage : écrit les entrées d’historique à partir des salles `coopDungeonRooms` terminées
 * (au cas où le client n’était pas abonné au moment du « completed » ou si l’écriture avait échoué).
 */
export async function backfillCoopRedMatchHistoryFromRooms(userId, characterInstanceId) {
  if (!userId || !characterInstanceId) return { success: false, written: 0 };
  await waitForFirestore();
  const qHost = query(
    collection(db, COOP_RED_ROOMS),
    where('hostId', '==', userId),
    limit(80)
  );
  const qGuest = query(
    collection(db, COOP_RED_ROOMS),
    where('guestId', '==', userId),
    limit(80)
  );
  let written = 0;
  try {
    const [snapH, snapG] = await Promise.all([getDocs(qHost), getDocs(qGuest)]);
    const seen = new Set();
    const docs = [...snapH.docs, ...snapG.docs];
    for (const s of docs) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      const data = { id: s.id, ...s.data() };
      if (data.status !== 'completed' || !data.combat?.winner) continue;
      const res = await ensureCoopRedHistoryEntryFromRoom(data, userId, characterInstanceId);
      if (res.success) written += 1;
    }
    return { success: true, written };
  } catch (e) {
    console.warn('coop red history — backfill', e);
    return { success: false, written: 0, error: e?.message };
  }
}
