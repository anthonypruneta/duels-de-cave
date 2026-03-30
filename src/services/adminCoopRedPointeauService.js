/**
 * Admin — Nettoyage manuel "Pointeau ADN" (Red coop)
 * - Supprime l'obtention (champ `coopRaceEcho` + `coopRaceEchoOffer`) sur tous les personnages
 * - Supprime l'historique (collection `coopRedMatchHistory/{userId}/matches/{roomId}`)
 *
 * IMPORTANT: ces opérations supposent que les règles Firestore autorisent l'admin.
 */
import { db, waitForFirestore } from '../firebase/config';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

const HISTORY_ROOT = 'coopRedMatchHistory';

async function commitInChunks(ops, chunkSize = 450) {
  let committed = 0;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = writeBatch(db);
    const chunk = ops.slice(i, i + chunkSize);
    chunk.forEach((fn) => fn(batch));
    await batch.commit();
    committed += chunk.length;
  }
  return committed;
}

export async function adminCleanCoopRedPointeauAndHistory() {
  await waitForFirestore();

  const ops = [];
  let charactersPatched = 0;
  let historyMatchesDeleted = 0;
  let historyUsersDeleted = 0;

  // 1) Nettoyer les pointeaux obtenus (characters/*)
  const charsSnap = await getDocs(collection(db, 'characters'));
  for (const d of charsSnap.docs) {
    const data = d.data() || {};
    const hasEcho = Boolean(data.coopRaceEcho?.race);
    const hasOffer = Boolean(data.coopRaceEchoOffer?.race || data.coopRaceEchoOffer?.roomId);
    if (!hasEcho && !hasOffer) continue;

    const ref = doc(db, 'characters', d.id);
    ops.push((batch) => {
      batch.update(ref, {
        coopRaceEcho: deleteField(),
        coopRaceEchoOffer: deleteField(),
      });
    });
    charactersPatched += 1;
  }

  // 2) Supprimer l’historique (coopRedMatchHistory/*/matches/*)
  const usersSnap = await getDocs(collection(db, HISTORY_ROOT));
  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const matchesSnap = await getDocs(collection(db, HISTORY_ROOT, userId, 'matches'));
    for (const matchDoc of matchesSnap.docs) {
      const ref = doc(db, HISTORY_ROOT, userId, 'matches', matchDoc.id);
      ops.push((batch) => batch.delete(ref));
      historyMatchesDeleted += 1;
    }

    // Supprimer le doc parent (souvent vide) pour éviter d'accumuler du bruit.
    const parentRef = doc(db, HISTORY_ROOT, userId);
    ops.push((batch) => batch.delete(parentRef));
    historyUsersDeleted += 1;
  }

  const committedOps = await commitInChunks(ops);

  return {
    success: true,
    committedOps,
    charactersPatched,
    historyMatchesDeleted,
    historyUsersDeleted,
  };
}

