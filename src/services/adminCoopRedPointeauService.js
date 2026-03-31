/**
 * Admin — Nettoyage manuel "Pointeau ADN" (Red coop)
 * - Supprime l'obtention (champ `coopRaceEcho` + `coopRaceEchoOffer`) sur tous les personnages
 * - Supprime l'historique (collection `coopRedMatchHistory/.../matches/{roomId}`)
 *
 * IMPORTANT: ces opérations supposent que les règles Firestore autorisent l'admin.
 */
import { db, waitForFirestore } from '../firebase/config';
import {
  collection,
  deleteField,
  doc,
  getDocs,
  collectionGroup,
  writeBatch,
} from 'firebase/firestore';

const HISTORY_ROOT = 'coopRedMatchHistory';
const MATCHES_SUBCOLLECTION = 'matches';

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

  // 1) Nettoyer les pointeaux obtenus (characters/*)
  const charsSnap = await getDocs(collection(db, 'characters'));
  for (const d of charsSnap.docs) {
    const data = d.data() || {};
    // Le champ peut exister sans .race (null / format legacy). On regarde la présence de la clé.
    const hasEcho = Object.prototype.hasOwnProperty.call(data, 'coopRaceEcho');
    const hasOffer = Object.prototype.hasOwnProperty.call(data, 'coopRaceEchoOffer');
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

  // 2) Supprimer l’historique
  //
  // On purge via collectionGroup('matches') puis on filtre au chemin.
  const matchesSnap = await getDocs(collectionGroup(db, MATCHES_SUBCOLLECTION));
  for (const matchDoc of matchesSnap.docs) {
    const path = matchDoc.ref.path || '';
    // Formats attendus (legacy + nouveau):
    // - coopRedMatchHistory/{userId}/matches/{roomId}
    // - coopRedMatchHistory/{userId}/charactersByName/{nameKey}/matches/{roomId}
    if (!path.startsWith(`${HISTORY_ROOT}/`)) continue;
    if (!path.includes(`/${MATCHES_SUBCOLLECTION}/`)) continue;
    ops.push((batch) => batch.delete(matchDoc.ref));
    historyMatchesDeleted += 1;
  }

  const committedOps = await commitInChunks(ops);

  return {
    success: true,
    committedOps,
    charactersPatched,
    historyMatchesDeleted,
  };
}

