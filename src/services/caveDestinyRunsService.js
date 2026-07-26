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
  query,
  setDoc,
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import { getOwnerPseudoFromAccount } from './characterService';
import {
  buildRunEntry,
  loadPantheon,
  migrateRunEntryScore,
  getTier,
} from '../utils/caveDestinyEngine';
import { CAVE_DESTINY_SCORE_MAX } from '../data/caveDestiny';

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
  const base = {
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
    ambitionId: raw.ambitionId || null,
    ambitionIcon: raw.ambitionIcon || null,
    mentor: raw.mentor || null,
    mentorId: raw.mentorId || null,
    mentorIcon: raw.mentorIcon || null,
    weapon: raw.weapon || null,
    weaponRarity: raw.weaponRarity || null,
    weaponIcon: raw.weaponIcon || null,
    score: Number(raw.score) || 0,
    tierId: raw.tierId || null,
    tierLabel: raw.tierLabel || null,
    scoreScale: raw.scoreScale || null,
    scoreLegacy: raw.scoreLegacy || null,
    trophies: raw.trophies || {},
    story: raw.story || '',
    stats: raw.stats || {},
    runScore: raw.runScore != null ? Number(raw.runScore) : undefined,
    endReason: raw.endReason || null,
    subclassId: raw.subclassId || null,
    maxSeasons: raw.maxSeasons != null ? Number(raw.maxSeasons) : undefined,
    history: Array.isArray(raw.history) ? raw.history : undefined,
  };
  return migrateRunEntryScore(base);
}

/** Persiste la migration /100 pour les runs dont on est propriétaire. */
async function persistScoreMigrations(entries, { userId } = {}) {
  if (!userId || !Array.isArray(entries) || !entries.length) return;
  const jobs = [];
  for (const entry of entries) {
    if (!entry?._needsScorePersist || !entry?.id || entry.userId !== userId) continue;
    const { _needsScorePersist, ...rest } = entry;
    const tier = getTier(rest.score);
    const payload = stripUndefined({
      ...rest,
      score: rest.score,
      tierId: tier.id,
      tierLabel: tier.label,
      scoreScale: 100,
      scoreLegacy: rest.scoreLegacy,
    });
    jobs.push(
      setDoc(getUserRunRef(userId, entry.id), payload, { merge: true }).catch(() => {}),
      setDoc(getPantheonRef(entry.id), payload, { merge: true }).catch(() => {})
    );
  }
  if (jobs.length) await Promise.all(jobs);
}

function stripPersistFlag(entry) {
  if (!entry || !entry._needsScorePersist) return entry;
  const { _needsScorePersist, ...rest } = entry;
  return rest;
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
  // Charge large puis trie après conversion /100 (orderBy score brut mélange ancien/nouveau)
  try {
    const snap = await getDocs(query(collectionRef, limit(Math.max(max * 3, 150))));
    return sortRunsBestFirst(
      snap.docs.map((d) => normalizeEntry(d.data(), d.id)).filter(Boolean)
    ).slice(0, max);
  } catch (orderedError) {
    console.warn('Cave Destiny: lecture runs indisponible', orderedError?.message || orderedError);
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
    const loaded = await loadOrderedOrFallback(runsRef, { max });
    await persistScoreMigrations(loaded, { userId });
    return { success: true, runs: loaded.map(stripPersistFlag) };
  } catch (error) {
    console.error('Erreur lecture Mes runs Cave Destiny:', error);
    return { success: false, error: error?.message || 'Lecture impossible.', runs: [] };
  }
}

/** Classement global, du meilleur score au plus faible. */
export async function loadCaveDestinyPantheon({ max = 100, userId = null } = {}) {
  try {
    await waitForFirestore();
    const pantheonRef = collection(db, 'caveDestinyPantheon');
    const loaded = await loadOrderedOrFallback(pantheonRef, { max });
    // Réécrit seulement tes propres docs (règles Firestore)
    if (userId) await persistScoreMigrations(loaded, { userId });
    return { success: true, runs: loaded.map(stripPersistFlag) };
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
