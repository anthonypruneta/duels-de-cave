/**
 * Lobby PvP entre joueurs (personnages archivés tournoi uniquement).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import { simulerMatch } from '../utils/tournamentCombat';
import { runWithCombatRandom01 } from '../utils/combatRngContext';
import { createCoopSeededRng } from '../utils/coopRedTournamentSim';
import { getOwnerPseudoFromAccount } from './characterService';
import { MAX_LEVEL } from '../data/featureFlags';

const ROOMS = 'pvpLobbyRooms';
const PVP_STATS = 'pvpDuelStatsByUser';
/** Sous-collection dédiée (évite collectionGroup sur « characters », en conflit avec la collection racine). */
const PVP_CHAR_STATS_SUB = 'pvpDuelCharStats';
const PVP_CHAR_STATS_LEGACY_SUB = 'characters';
/** Collection racine pour le classement (query simple + règles fiables ; pas de collectionGroup). */
const PVP_LEADERBOARD_ENTRIES = 'pvpDuelLeaderboardEntries';

export function pvpLeaderboardEntryDocId(userId, characterId) {
  const u = String(userId || '');
  const c = String(characterId || '');
  return `${u}__${c}`;
}

const LEADERBOARD_DEFAULT_LIMIT = 200;

/** Niveau max autorisé en lobby PvP (= MAX_LEVEL du jeu). */
export function isCharacterEligibleForPvpLobby(character) {
  if (!character || typeof character !== 'object') return false;
  const lv = Number(character.level ?? 1);
  if (!Number.isFinite(lv)) return false;
  return lv <= MAX_LEVEL;
}

export function getPvpLobbyMaxLevel() {
  return MAX_LEVEL;
}

/** Copie profonde « brute » pour simulerMatch / Firestore (aligné sur le donjon Red). */
export function snapshotCharacterForPvp(data) {
  if (!data) return null;
  return {
    userId: data.userId,
    id: data.id,
    name: data.name,
    gender: data.gender ?? null,
    characterImage: data.characterImage ?? null,
    equippedTitle: data.equippedTitle ?? null,
    equippedBorder: data.equippedBorder ?? null,
    equippedRealBorder: data.equippedRealBorder ?? null,
    race: data.race,
    class: data.class,
    level: data.level ?? 1,
    base: data.base ? { ...data.base } : {},
    bonuses: data.bonuses ? JSON.parse(JSON.stringify(data.bonuses)) : { race: {}, class: {} },
    forestBoosts: data.forestBoosts ? { ...data.forestBoosts } : {},
    equippedWeaponId: data.equippedWeaponId ?? null,
    equippedWeaponData: data.equippedWeaponData
      ? JSON.parse(JSON.stringify(data.equippedWeaponData))
      : null,
    forgeUpgrade: data.forgeUpgrade ? JSON.parse(JSON.stringify(data.forgeUpgrade)) : null,
    subclass: data.subclass ?? null,
    mageTowerPassive: data.mageTowerPassive ?? null,
    mageTowerExtensionPassive: data.mageTowerExtensionPassive ?? null,
    additionalAwakeningRaces: Array.isArray(data.additionalAwakeningRaces)
      ? [...data.additionalAwakeningRaces]
      : [],
    awakeningForced: !!data.awakeningForced,
    coopRaceEcho: data.coopRaceEcho ?? null,
  };
}

export async function hashPvpLobbyPassword(plain) {
  const t = String(plain || '').trim();
  if (!t) return '';
  const enc = new TextEncoder().encode(t);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

/**
 * Copie une fois les compteurs depuis l’ancienne sous-collection `characters` vers `pvpDuelCharStats`
 * (classement global). Appeler depuis les écrans qui listent les archivés du joueur.
 */
export async function migrateLegacyPvpStatsToLeaderboardDocs(userId, entries, ownerPseudo) {
  const pseudo = String(ownerPseudo || 'Joueur').trim().slice(0, 40) || 'Joueur';
  if (!userId || !Array.isArray(entries) || !entries.length) return { success: true };
  try {
    await waitForFirestore();
    await Promise.all(
      entries.map(async ({ id, name }) => {
        if (!id) return;
        const refNew = doc(db, PVP_STATS, userId, PVP_CHAR_STATS_SUB, String(id));
        const refOld = doc(db, PVP_STATS, userId, PVP_CHAR_STATS_LEGACY_SUB, String(id));
        const [sNew, sOld] = await Promise.all([getDoc(refNew), getDoc(refOld)]);
        if (sNew.exists()) return;
        if (!sOld.exists()) return;
        const o = sOld.data();
        const w = Number(o.wins) || 0;
        const l = Number(o.losses) || 0;
        if (w === 0 && l === 0) return;
        const updatedAt = Timestamp.now();
        const payload = {
          wins: w,
          losses: l,
          characterName: String(name || '—').slice(0, 40),
          ownerUserId: userId,
          ownerPseudo: pseudo,
          characterId: String(id),
          migratedFromLegacy: true,
          updatedAt,
        };
        await setDoc(refNew, payload, { merge: true });
        const boardRef = doc(db, PVP_LEADERBOARD_ENTRIES, pvpLeaderboardEntryDocId(userId, id));
        await setDoc(
          boardRef,
          {
            wins: w,
            losses: l,
            characterName: payload.characterName,
            ownerUserId: userId,
            ownerPseudo: pseudo,
            characterId: String(id),
            updatedAt,
          },
          { merge: true }
        );
      })
    );
    return { success: true };
  } catch (e) {
    console.warn('migrateLegacyPvpStatsToLeaderboardDocs', e);
    return { success: false, error: e.message };
  }
}

/**
 * Recopie les docs `pvpDuelCharStats` du joueur vers la collection racine du classement
 * (utile après déploiement des règles ou pour réparer d’anciennes données).
 */
export async function syncPvpLeaderboardEntriesForUser(userId) {
  if (!userId) return { success: true };
  try {
    await waitForFirestore();
    const subRef = collection(db, PVP_STATS, userId, PVP_CHAR_STATS_SUB);
    const snap = await getDocs(subRef);
    if (snap.empty) return { success: true };
    const pseudoRes = await getOwnerPseudoFromAccount(userId);
    const ownerPseudo =
      String(pseudoRes.ownerPseudo || 'Joueur').trim().slice(0, 40) || 'Joueur';
    let batch = writeBatch(db);
    let n = 0;
    for (const d of snap.docs) {
      const data = d.data();
      const charId = d.id;
      const wins = Number(data.wins) || 0;
      const losses = Number(data.losses) || 0;
      if (wins === 0 && losses === 0) continue;
      const boardRef = doc(db, PVP_LEADERBOARD_ENTRIES, pvpLeaderboardEntryDocId(userId, charId));
      batch.set(
        boardRef,
        {
          wins,
          losses,
          characterName: String(data.characterName || '—').slice(0, 40),
          ownerUserId: userId,
          ownerPseudo: String(data.ownerPseudo || ownerPseudo).slice(0, 40),
          characterId: String(charId),
          updatedAt: data.updatedAt || Timestamp.now(),
        },
        { merge: true }
      );
      n += 1;
      if (n % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
    if (n % 400 !== 0) await batch.commit();
    return { success: true };
  } catch (e) {
    console.warn('syncPvpLeaderboardEntriesForUser', e);
    return { success: false, error: e.message };
  }
}

/**
 * Classement global : victoires / défaites par perso archivé (nom perso + pseudo compte).
 * Lit la collection racine `pvpDuelLeaderboardEntries` (évite collectionGroup / règles capricieuses).
 */
export async function fetchPvpDuelLeaderboard(maxRows = LEADERBOARD_DEFAULT_LIMIT) {
  const cap = Math.min(500, Math.max(1, Number(maxRows) || LEADERBOARD_DEFAULT_LIMIT));
  try {
    await waitForFirestore();
    const q = query(
      collection(db, PVP_LEADERBOARD_ENTRIES),
      orderBy('wins', 'desc'),
      limit(cap)
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => {
      const data = d.data();
      const charId = String(data.characterId || '').trim() || d.id.split('__').slice(1).join('__');
      return {
        id: charId || d.id,
        ownerUserId: data.ownerUserId || '',
        ownerPseudo: String(data.ownerPseudo || '—').slice(0, 40),
        characterName: String(data.characterName || '—').slice(0, 40),
        wins: Number(data.wins) || 0,
        losses: Number(data.losses) || 0,
        updatedAt: data.updatedAt,
      };
    });
    rows.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return String(a.characterName).localeCompare(String(b.characterName), 'fr');
    });
    return { success: true, data: rows };
  } catch (e) {
    console.warn('fetchPvpDuelLeaderboard', e);
    const code = e?.code ? ` [${e.code}]` : '';
    return { success: false, data: [], error: `${e.message || 'Erreur Firestore'}${code}` };
  }
}

/**
 * Lit les compteurs duels PvP (lobby) pour une liste d’ids de persos archivés (doc `pvpDuelCharStats`).
 */
export async function fetchPvpDuelStatsForUserCharacters(userId, archivedCharacterIds) {
  const ids = [...new Set((archivedCharacterIds || []).filter(Boolean).map(String))];
  if (!ids.length) return { success: true, data: {} };
  try {
    await waitForFirestore();
    const pairs = await Promise.all(
      ids.map(async (charId) => {
        const ref = doc(db, PVP_STATS, userId, PVP_CHAR_STATS_SUB, charId);
        const s = await getDoc(ref);
        const d = s.exists() ? s.data() : {};
        return [charId, { wins: Number(d.wins) || 0, losses: Number(d.losses) || 0 }];
      })
    );
    return { success: true, data: Object.fromEntries(pairs) };
  } catch (e) {
    console.warn('fetchPvpDuelStatsForUserCharacters', e);
    return { success: false, data: {}, error: e.message };
  }
}

/**
 * Après un duel terminé : chaque joueur applique +1 V ou +1 D sur SON perso (idempotent par salle).
 */
export async function applyMyPvpDuelStatsFromRoom(roomId, userId) {
  const id = String(roomId || '').trim();
  if (!id || !userId) return { success: false, error: 'Paramètres invalides.' };
  const pseudoRes = await getOwnerPseudoFromAccount(userId);
  const ownerPseudo =
    String(pseudoRes.ownerPseudo || 'Joueur').trim().slice(0, 40) || 'Joueur';
  try {
    await retryOperation(async () => {
      const ref = doc(db, ROOMS, id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const d = snap.data();
        if (d.status !== 'completed') return;
        if (d.pvpDuelStatsSchemaVersion !== 1) return;
        const slot = Number(d.combat?.winnerSlot);
        if (slot !== 1 && slot !== 2) return;

        if (d.hostId === userId) {
          if (d.hostDuelStatsApplied === true) return;
          const charId = d.hostSnapshot?.id;
          if (!charId) {
            tx.update(ref, { hostDuelStatsApplied: true, updatedAt: Timestamp.now() });
            return;
          }
          const won = slot === 1;
          const charName = String(d.hostSnapshot?.name || '—').slice(0, 40);
          const statsRef = doc(db, PVP_STATS, userId, PVP_CHAR_STATS_SUB, String(charId));
          const boardRef = doc(db, PVP_LEADERBOARD_ENTRIES, pvpLeaderboardEntryDocId(userId, charId));
          const meta = {
            characterName: charName,
            ownerUserId: userId,
            ownerPseudo,
            characterId: String(charId),
            updatedAt: Timestamp.now(),
          };
          if (won) {
            tx.set(statsRef, { wins: increment(1), ...meta }, { merge: true });
            tx.set(boardRef, { wins: increment(1), ...meta }, { merge: true });
          } else {
            tx.set(statsRef, { losses: increment(1), ...meta }, { merge: true });
            tx.set(boardRef, { losses: increment(1), ...meta }, { merge: true });
          }
          tx.update(ref, { hostDuelStatsApplied: true, updatedAt: Timestamp.now() });
        } else if (d.guestId === userId) {
          if (d.guestDuelStatsApplied === true) return;
          const charId = d.guestSnapshot?.id;
          if (!charId) {
            tx.update(ref, { guestDuelStatsApplied: true, updatedAt: Timestamp.now() });
            return;
          }
          const won = slot === 2;
          const charName = String(d.guestSnapshot?.name || '—').slice(0, 40);
          const statsRef = doc(db, PVP_STATS, userId, PVP_CHAR_STATS_SUB, String(charId));
          const boardRef = doc(db, PVP_LEADERBOARD_ENTRIES, pvpLeaderboardEntryDocId(userId, charId));
          const meta = {
            characterName: charName,
            ownerUserId: userId,
            ownerPseudo,
            characterId: String(charId),
            updatedAt: Timestamp.now(),
          };
          if (won) {
            tx.set(statsRef, { wins: increment(1), ...meta }, { merge: true });
            tx.set(boardRef, { wins: increment(1), ...meta }, { merge: true });
          } else {
            tx.set(statsRef, { losses: increment(1), ...meta }, { merge: true });
            tx.set(boardRef, { losses: increment(1), ...meta }, { merge: true });
          }
          tx.update(ref, { guestDuelStatsApplied: true, updatedAt: Timestamp.now() });
        }
      });
    });
    return { success: true };
  } catch (e) {
    console.warn('applyMyPvpDuelStatsFromRoom', e);
    return { success: false, error: e.message };
  }
}

/** Sérialise le résultat simulerMatch pour Firestore (évite undefined). */
function combatResultForFirestore(result) {
  const steps = JSON.parse(JSON.stringify(result.steps || []));
  return {
    steps,
    combatLog: result.combatLog || [],
    p1MaxHP: result.p1MaxHP,
    p2MaxHP: result.p2MaxHP,
    winnerSlot: result.winnerSlot,
    winnerNom: result.winnerNom,
    winnerId: result.winnerId,
    loserId: result.loserId,
    loserNom: result.loserNom,
  };
}

export function subscribeOpenPvpLobbyRooms(onData, onError) {
  const q = query(collection(db, ROOMS), where('status', '==', 'waiting'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (r) =>
            !r.guestId &&
            r.isOpenLobby === true &&
            !r.isMatchmakingQueue &&
            isCharacterEligibleForPvpLobby(r.hostSnapshot)
        );
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

export function subscribePvpLobbyRoom(roomId, onData, onError) {
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

/**
 * @param {string} hostUserId
 * @param {{ password?: string, character: object, matchmakingQueue?: boolean }} opts
 */
export async function createPvpLobbyRoom(hostUserId, { password = '', character, matchmakingQueue = false }) {
  if (!isCharacterEligibleForPvpLobby(character)) {
    return {
      success: false,
      error: `Les personnages au-delà du niveau ${MAX_LEVEL} ne peuvent pas combattre en PvP lobby.`,
    };
  }
  const snap = snapshotCharacterForPvp(character);
  if (!snap?.name || !snap.race) {
    return { success: false, error: 'Personnage invalide.' };
  }
  const pwd = String(password || '').trim();
  const passwordHash = pwd ? await hashPvpLobbyPassword(pwd) : '';
  const isMm = !!matchmakingQueue;
  if (isMm && passwordHash) {
    return { success: false, error: 'Le matchmaking ne supporte pas le mot de passe.' };
  }
  const isOpenLobby = !passwordHash && !isMm;

  const roomRef = doc(collection(db, ROOMS));
  const roomId = roomRef.id;

  const room = {
    hostId: hostUserId,
    guestId: null,
    status: 'waiting',
    isOpenLobby,
    isMatchmakingQueue: isMm,
    passwordHash: passwordHash || '',
    hostSnapshot: snap,
    guestSnapshot: null,
    hostReady: true,
    guestReady: false,
    combatSeed: null,
    combat: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await retryOperation(() => setDoc(roomRef, room));
  return { success: true, roomId };
}

/**
 * Matchmaking : tente de rejoindre la salle d’attente la plus ancienne, sinon crée une salle dédiée.
 * Les salles matchmaking n’apparaissent pas dans la liste « salles ouvertes ».
 */
export async function enterPvpMatchmaking(userId, character) {
  if (!userId) return { success: false, error: 'Non connecté.' };
  if (!isCharacterEligibleForPvpLobby(character)) {
    return {
      success: false,
      error: `Les personnages au-delà du niveau ${MAX_LEVEL} ne peuvent pas combattre en PvP lobby.`,
    };
  }

  try {
    await waitForFirestore();
    const q = query(
      collection(db, ROOMS),
      where('status', '==', 'waiting'),
      where('isMatchmakingQueue', '==', true),
      orderBy('createdAt', 'asc'),
      limit(25)
    );
    const snap = await retryOperation(() => getDocs(q));

    const candidates = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => !r.guestId && r.hostId && r.hostId !== userId && isCharacterEligibleForPvpLobby(r.hostSnapshot));

    for (const row of candidates) {
      const joinRes = await joinPvpLobbyRoomAsGuest(userId, row.id, '', character);
      if (joinRes.success) {
        return { success: true, roomId: joinRes.roomId, mode: 'joined' };
      }
    }

    const createRes = await createPvpLobbyRoom(userId, {
      password: '',
      character,
      matchmakingQueue: true,
    });
    if (!createRes.success) return createRes;
    return { success: true, roomId: createRes.roomId, mode: 'created' };
  } catch (e) {
    console.warn('enterPvpMatchmaking', e);
    const code = e?.code ? ` [${e.code}]` : '';
    return { success: false, error: `${e.message || 'Erreur matchmaking'}${code}` };
  }
}

export async function joinPvpLobbyRoomAsGuest(guestUserId, roomId, passwordPlaintext, guestCharacter) {
  const id = String(roomId || '').trim();
  if (!id) return { success: false, error: 'Identifiant de salle invalide.' };

  if (!isCharacterEligibleForPvpLobby(guestCharacter)) {
    return {
      success: false,
      error: `Les personnages au-delà du niveau ${MAX_LEVEL} ne peuvent pas combattre en PvP lobby.`,
    };
  }
  const guestSnap = snapshotCharacterForPvp(guestCharacter);
  if (!guestSnap?.name) {
    return { success: false, error: 'Personnage invité invalide.' };
  }

  const ref = doc(db, ROOMS, id);
  const preSnap = await retryOperation(() => getDoc(ref));
  if (!preSnap.exists()) return { success: false, error: 'Salle introuvable.' };
  const pre = preSnap.data();
  if (pre.hostId === guestUserId) {
    return { success: false, error: 'Tu es déjà l’hôte de cette salle.' };
  }
  if (!isCharacterEligibleForPvpLobby(pre.hostSnapshot)) {
    return {
      success: false,
      error: `Cette salle n’est pas valide : l’hôte a un personnage au-delà du niveau ${MAX_LEVEL} (non autorisé en PvP).`,
    };
  }
  const needHash = String(pre.passwordHash || '').trim();
  if (needHash) {
    const attempt = await hashPvpLobbyPassword(passwordPlaintext || '');
    if (attempt !== needHash) {
      return { success: false, error: 'Mot de passe incorrect.' };
    }
  }

  try {
    await retryOperation(async () => {
      await runTransaction(db, async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists()) throw new Error('room_not_found');
        const r = s.data();
        if (r.status !== 'waiting') throw new Error('room_closed');
        if (r.hostId === guestUserId) throw new Error('self_join');
        if (r.guestId && r.guestId !== guestUserId) throw new Error('room_full');
        tx.update(ref, {
          guestId: guestUserId,
          guestSnapshot: guestSnap,
          status: 'lobby',
          guestReady: false,
          updatedAt: Timestamp.now(),
        });
      });
    });
    return { success: true, roomId: id };
  } catch (e) {
    const msg = e?.message;
    if (msg === 'room_not_found') return { success: false, error: 'Salle introuvable.' };
    if (msg === 'room_closed') return { success: false, error: 'Cette salle n’est plus disponible.' };
    if (msg === 'self_join') return { success: false, error: 'Tu es l’hôte de cette salle.' };
    if (msg === 'room_full') return { success: false, error: 'La salle est pleine.' };
    return { success: false, error: e.message || 'Erreur' };
  }
}

export async function setPvpLobbyGuestReady(roomId, userId, ready) {
  const ref = doc(db, ROOMS, roomId);
  try {
    await retryOperation(async () => {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('missing');
        const r = snap.data();
        if (r.status !== 'lobby') throw new Error('not_lobby');
        if (r.guestId !== userId) throw new Error('not_guest');
        tx.update(ref, {
          guestReady: !!ready,
          updatedAt: Timestamp.now(),
        });
      });
    });
    return { success: true };
  } catch (e) {
    const m = e?.message;
    if (m === 'not_lobby') return { success: false, error: 'Impossible de changer le prêt maintenant.' };
    if (m === 'not_guest') return { success: false, error: 'Tu n’es pas l’invité de cette salle.' };
    return { success: false, error: e.message || 'Erreur' };
  }
}

export async function leavePvpLobbyRoomAsGuest(roomId, userId) {
  const ref = doc(db, ROOMS, roomId);
  try {
    await retryOperation(async () => {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const r = snap.data();
        if (r.guestId !== userId) return;
        if (r.status === 'completed') return;
        tx.update(ref, {
          guestId: null,
          guestSnapshot: null,
          guestReady: false,
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

export async function deletePvpLobbyRoom(roomId, hostUserId) {
  const ref = doc(db, ROOMS, roomId);
  try {
    const snap = await retryOperation(() => getDoc(ref));
    if (!snap.exists()) return { success: true };
    const r = snap.data();
    if (r.hostId !== hostUserId) {
      return { success: false, error: 'Seul l’hôte peut supprimer la salle.' };
    }
    await retryOperation(() => deleteDoc(ref));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Lance la simulation si lobby + deux prêts + deux snapshots. Idempotent.
 */
export async function runPvpLobbySimulation(roomId) {
  const ref = doc(db, ROOMS, roomId);
  const snap = await retryOperation(() => getDoc(ref));
  if (!snap.exists()) return { success: false, error: 'Salle introuvable.' };
  const r = snap.data();

  if (r.status === 'completed' && r.combat?.winnerNom) {
    return { success: true };
  }

  const canKickOff =
    r.status === 'lobby' && r.hostReady === true && r.guestReady === true && r.guestId && r.hostSnapshot && r.guestSnapshot;

  if (!canKickOff) {
    return { success: true };
  }

  if (!isCharacterEligibleForPvpLobby(r.hostSnapshot) || !isCharacterEligibleForPvpLobby(r.guestSnapshot)) {
    return {
      success: false,
      error: `Au moins un combattant dépasse le niveau ${MAX_LEVEL} autorisé en PvP lobby.`,
    };
  }

  if (r.combat?.steps?.length) {
    return { success: true };
  }

  const seed = (Math.random() * 0x7fffffff) >>> 0;
  const rng = createCoopSeededRng(seed);

  let result;
  try {
    result = runWithCombatRandom01(() => rng.next01(), () =>
      simulerMatch(r.hostSnapshot, r.guestSnapshot)
    );
  } catch (e) {
    return { success: false, error: `Simulation impossible : ${e.message || 'erreur'}` };
  }

  const combatPayload = combatResultForFirestore(result);

  try {
    await retryOperation(async () => {
      await runTransaction(db, async (tx) => {
        const s2 = await tx.get(ref);
        if (!s2.exists()) throw new Error('missing');
        const d = s2.data();
        if (d.combat?.winnerNom || (d.combat?.steps && d.combat.steps.length > 0)) {
          return;
        }
        const still =
          d.status === 'lobby' &&
          d.hostReady === true &&
          d.guestReady === true &&
          d.guestId &&
          d.hostSnapshot &&
          d.guestSnapshot;
        if (!still) return;

        tx.update(ref, {
          combatSeed: seed,
          status: 'completed',
          combat: combatPayload,
          pvpDuelStatsSchemaVersion: 1,
          hostDuelStatsApplied: false,
          guestDuelStatsApplied: false,
          updatedAt: Timestamp.now(),
        });
      });
    });
  } catch (e) {
    return { success: false, error: e.message || 'Erreur enregistrement combat.' };
  }

  return { success: true };
}
