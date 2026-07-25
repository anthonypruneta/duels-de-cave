/**
 * Runs Cave Destiny — persistance Firestore.
 * - caveDestinyRuns/{userId}/runs/{runId}  → « Mes runs »
 * - caveDestinyPantheon/{runId}             → classement global
 */

import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import { getOwnerPseudoFromAccount } from './characterService';
import { buildRunEntry, loadPantheon } from '../utils/caveDestinyEngine';

const LOCAL_MIGRATED_KEY = 'caveDestiny:localPantheonMigrated';

function stripUndefined(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = stripUndefined(v);
  }
  return out;
}

function newRunId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getUserRunRef(userId, runId) {
  return doc(db, 'caveDestinyRuns', userId, 'runs', runId);
}

function getPantheonRef(runId) {
  return doc(db, 'caveDestinyPantheon', runId);
}

function sortRunsBestFirst(list) {
  return [...list].sort((a, b) => {
    const scoreDiff = (Number(b.score) || 0) - (Number(a.score) || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (Number(b.date) || 0) - (Number(a.date) || 0);
  });
}

function normalizeEntry(raw, fallbackId) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: raw.id || fallbackId,
    date: Number(raw.date) || 0,
    userId: raw.userId || null,
    userPseudo: raw.userPseudo || null,
    name: raw.name || 'Aventurier',
    race: raw.race || null,
    class: raw.class || null,
    subclass: raw.subclass || null,
    ownerPseudo: raw.ownerPseudo || null,
    characterImage: raw.characterImage || null,
    ambition: raw.ambition || null,
    mentor: raw.mentor || null,
    weapon: raw.weapon || null,
    weaponRarity: raw.weaponRarity || null,
    weaponIcon: raw.weaponIcon || null,
    score: Number(raw.score) || 0,
    tierId: raw.tierId || null,
    tierLabel: raw.tierLabel || null,
    trophies: raw.trophies || {},
    story: raw.story || '',
    stats: raw.stats || {},
  };
}

async function writeRunDocuments(entry) {
  const payload = stripUndefined(entry);
  await setDoc(getUserRunRef(entry.userId, entry.id), payload, { merge: false });
  await setDoc(getPantheonRef(entry.id), payload, { merge: false });
}

/**
 * Enregistre une carrière terminée (runs perso + panthéon global).
 */
export async function saveCaveDestinyFinishedRun({ userId, career, runId: forcedId } = {}) {
  if (!userId || !career) {
    return { success: false, error: 'Données manquantes.' };
  }
  try {
    await waitForFirestore();
    const pseudoRes = await getOwnerPseudoFromAccount(userId);
    const userPseudo = pseudoRes?.success ? pseudoRes.ownerPseudo || '' : '';
    const runId = forcedId || newRunId();
    const entry = buildRunEntry(career, {
      id: runId,
      userId,
      userPseudo: userPseudo || null,
      date: Date.now(),
    });
    await writeRunDocuments(entry);
    return { success: true, entry };
  } catch (error) {
    console.error('Erreur sauvegarde run Cave Destiny:', error);
    return { success: false, error: error?.message || 'Sauvegarde impossible.' };
  }
}

async function loadOrderedOrFallback(collectionRef, { max = 50 } = {}) {
  try {
    const q = query(collectionRef, orderBy('score', 'desc'), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeEntry(d.data(), d.id)).filter(Boolean);
  } catch (orderedError) {
    // Fallback sans index / orderBy (tri client) — tous joueurs authentifiés
    console.warn('Cave Destiny: orderBy score indisponible, fallback client', orderedError?.message || orderedError);
    const snap = await getDocs(query(collectionRef, limit(Math.max(max, 100))));
    return sortRunsBestFirst(
      snap.docs.map((d) => normalizeEntry(d.data(), d.id)).filter(Boolean)
    ).slice(0, max);
  }
}

/** Liste des runs du joueur, du meilleur score au plus faible. */
export async function loadMyCaveDestinyRuns(userId, { max = 50 } = {}) {
  if (!userId) return { success: false, error: 'Utilisateur requis.', runs: [] };
  try {
    await waitForFirestore();
    const runsRef = collection(db, 'caveDestinyRuns', userId, 'runs');
    const runs = sortRunsBestFirst(await loadOrderedOrFallback(runsRef, { max }));
    return { success: true, runs };
  } catch (error) {
    console.error('Erreur lecture Mes runs Cave Destiny:', error);
    return { success: false, error: error?.message || 'Lecture impossible.', runs: [] };
  }
}

/** Classement global, du meilleur score au plus faible. */
export async function loadCaveDestinyPantheon({ max = 100 } = {}) {
  try {
    await waitForFirestore();
    const pantheonRef = collection(db, 'caveDestinyPantheon');
    const runs = sortRunsBestFirst(await loadOrderedOrFallback(pantheonRef, { max }));
    return { success: true, runs };
  } catch (error) {
    console.error('Erreur lecture Panthéon Cave Destiny:', error);
    return { success: false, error: error?.message || 'Lecture impossible.', runs: [] };
  }
}

/**
 * Migre une seule fois les anciennes runs localStorage vers le serveur
 * (attribuées au compte connecté).
 */
export async function migrateLocalCaveDestinyPantheon(userId) {
  if (!userId) return { success: true, migrated: 0 };
  try {
    if (localStorage.getItem(LOCAL_MIGRATED_KEY) === userId) {
      return { success: true, migrated: 0 };
    }
    const local = loadPantheon();
    if (!local.length) {
      localStorage.setItem(LOCAL_MIGRATED_KEY, userId);
      return { success: true, migrated: 0 };
    }

    await waitForFirestore();
    const pseudoRes = await getOwnerPseudoFromAccount(userId);
    const userPseudo = pseudoRes?.success ? pseudoRes.ownerPseudo || '' : '';

    // Évite les doublons si déjà présents côté serveur (même date+score+name)
    const existingRes = await loadMyCaveDestinyRuns(userId, { max: 100 });
    const existingKeys = new Set(
      (existingRes.runs || []).map((r) => `${r.date}|${r.score}|${r.name}`)
    );

    let migrated = 0;
    for (const raw of local) {
      const key = `${raw.date}|${raw.score}|${raw.name}`;
      if (existingKeys.has(key)) continue;
      const runId = String(raw.id || newRunId());
      const entry = normalizeEntry(
        {
          ...raw,
          id: runId,
          userId,
          userPseudo: userPseudo || raw.userPseudo || null,
        },
        runId
      );
      await writeRunDocuments(entry);
      existingKeys.add(key);
      migrated += 1;
    }

    localStorage.setItem(LOCAL_MIGRATED_KEY, userId);
    return { success: true, migrated };
  } catch (error) {
    console.error('Erreur migration runs locales Cave Destiny:', error);
    return { success: false, error: error?.message || 'Migration impossible.', migrated: 0 };
  }
}
