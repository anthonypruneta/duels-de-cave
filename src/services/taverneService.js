/**
 * Service Taverne : présence des joueurs (position) et chat en temps réel.
 * Firestore : tavernePresence/{userId}, taverneChat (collection de messages).
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';

const PRESENCE_COLLECTION = 'tavernePresence';
const CHAT_COLLECTION = 'taverneChat';
const CHAT_MESSAGES_LIMIT = 80;

/**
 * Entrer dans la taverne (crée ou met à jour la présence avec une position par défaut).
 * @param {string} userId
 * @param {number} x - position X en pourcentage 0-100
 * @param {number} y - position Y en pourcentage 0-100
 */
export async function enterTaverne(userId, x = 30, y = 60) {
  await waitForFirestore();
  const ref = doc(db, PRESENCE_COLLECTION, userId);
  await setDoc(ref, {
    userId,
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Quitter la taverne (supprime la présence).
 */
export async function leaveTaverne(userId) {
  await waitForFirestore();
  const ref = doc(db, PRESENCE_COLLECTION, userId);
  await deleteDoc(ref);
}

/**
 * Mettre à jour la position du joueur dans la taverne.
 * @param {number} x - 0-100
 * @param {number} y - 0-100
 */
export async function updateTavernePosition(userId, x, y) {
  await waitForFirestore();
  const ref = doc(db, PRESENCE_COLLECTION, userId);
  await setDoc(ref, {
    userId,
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
    updatedAt: Timestamp.now(),
  }, { merge: true });
}

/**
 * Envoyer un message dans le chat taverne et enregistrer la dernière bulle sur la présence.
 */
export async function sendTaverneMessage(userId, characterName, text) {
  await waitForFirestore();
  const trimmed = (text || '').trim();
  if (!trimmed) return;

  const chatRef = collection(db, CHAT_COLLECTION);
  await addDoc(chatRef, {
    userId,
    characterName: characterName || 'Inconnu',
    text: trimmed.slice(0, 300),
    createdAt: Timestamp.now(),
  });

  const presenceRef = doc(db, PRESENCE_COLLECTION, userId);
  await setDoc(presenceRef, {
    lastChatMessage: trimmed.slice(0, 100),
    lastChatAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }, { merge: true });
}

/**
 * S'abonner aux présences en temps réel.
 * @param {(presences: Array<{ userId, x, y, updatedAt, lastChatMessage?, lastChatAt? }>) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeTavernePresence(callback) {
  const ref = collection(db, PRESENCE_COLLECTION);
  const unsub = onSnapshot(ref, (snapshot) => {
    const presences = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        userId: data.userId || d.id,
        x: typeof data.x === 'number' ? data.x : 30,
        y: typeof data.y === 'number' ? data.y : 60,
        updatedAt: data.updatedAt,
        lastChatMessage: data.lastChatMessage ?? null,
        lastChatAt: data.lastChatAt ?? null,
      };
    });
    callback(presences);
  }, (err) => {
    console.error('Taverne presence subscription error:', err);
  });
  return unsub;
}

/**
 * S'abonner aux messages du chat taverne.
 * @param {(messages: Array<{ id, userId, characterName, text, createdAt }>) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeTaverneChat(callback) {
  const ref = collection(db, CHAT_COLLECTION);
  const q = query(
    ref,
    orderBy('createdAt', 'desc'),
    limit(CHAT_MESSAGES_LIMIT)
  );
  const unsub = onSnapshot(q, (snapshot) => {
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
  }, (err) => {
    console.error('Taverne chat subscription error:', err);
  });
  return unsub;
}
