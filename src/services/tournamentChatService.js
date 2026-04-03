/**
 * Chat temps réel pendant un tournoi (samedi, anciens, simulation).
 * Firestore : tournaments/{tournamentDocId}/chatMessages/{messageId}
 */

import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';

export const TOURNAMENT_CHAT_SUBCOLLECTION = 'chatMessages';
const CHAT_MESSAGES_LIMIT = 120;

function chatCollectionRef(tournamentDocId) {
  return collection(db, 'tournaments', tournamentDocId, TOURNAMENT_CHAT_SUBCOLLECTION);
}

/**
 * Supprime tous les messages du chat d’un tournoi (fin d’événement / nettoyage doc).
 * @param {string} tournamentDocId
 */
export async function supprimerMessagesChatTournoi(tournamentDocId) {
  if (!tournamentDocId) return;
  const snap = await getDocs(chatCollectionRef(tournamentDocId));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

/**
 * @param {string} tournamentDocId
 * @param {string} userId
 * @param {string} characterName
 * @param {string} text
 */
export async function sendTournamentChatMessage(tournamentDocId, userId, characterName, text) {
  await waitForFirestore();
  const trimmed = (text || '').trim();
  if (!trimmed || !tournamentDocId || !userId) return;

  await addDoc(chatCollectionRef(tournamentDocId), {
    userId,
    characterName: characterName || 'Inconnu',
    text: trimmed.slice(0, 400),
    createdAt: Timestamp.now(),
  });
}

/**
 * @param {string} tournamentDocId
 * @param {(messages: Array<{ id: string, userId: string, characterName: string, text: string, createdAt: unknown }>) => void} callback
 * @param {(err: Error) => void} [onError]
 * @returns {() => void}
 */
export function subscribeTournamentChat(tournamentDocId, callback, onError) {
  if (!tournamentDocId) {
    callback([]);
    return () => {};
  }

  const q = query(
    chatCollectionRef(tournamentDocId),
    orderBy('createdAt', 'desc'),
    limit(CHAT_MESSAGES_LIMIT)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId,
          characterName: data.characterName || 'Inconnu',
          text: data.text || '',
          createdAt: data.createdAt,
        };
      });
      callback(messages.reverse());
    },
    (err) => {
      console.error('Erreur abonnement chat tournoi:', err);
      if (typeof onError === 'function') onError(err);
    }
  );
}
