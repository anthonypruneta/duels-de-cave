/**
 * Donjon coop async « Rouge » — rooms Firestore + quota quotidien.
 */
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import {
  COOP_RED_LEVEL_REQUIRED,
  COOP_RED_MAX_ATTEMPTS_PER_DAY,
  COOP_RED_DROP_RATE,
  COOP_RED_DNA_COST_ECHO,
} from '../data/coopRedDungeon.js';
import {
  createCoopRedCombatState,
  coopRedResolveFromNewState,
  coopRedSubmitPlayerAction,
} from '../utils/coopRedCombat';
import { getUserCharacter, updateCharacterCoopRedRewards } from './characterService';
import { races } from '../data/races.js';

function coopDropRoll01(seed, rngCounter, salt) {
  const s = (Math.imul((seed ^ salt) >>> 0, 1597334677) ^ (rngCounter * 2654435761)) >>> 0;
  return (s >>> 0) / 4294967296;
}

const ROOMS = 'coopDungeonRooms';
const DAILY = 'coopDungeonDaily';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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

function randomRoomCode() {
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return s;
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
    allyRaceEcho: data.allyRaceEcho ?? null,
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

  let roomId = randomRoomCode();
  for (let t = 0; t < 5; t++) {
    const existing = await retryOperation(() => getDoc(doc(db, ROOMS, roomId)));
    if (!existing.exists()) break;
    roomId = randomRoomCode();
  }

  const room = {
    roomCode: roomId,
    hostId: hostUserId,
    guestId: null,
    difficulty,
    status: 'waiting',
    hostSnapshot: snapshotCharacterForCoop(charRes.data),
    guestSnapshot: null,
    combat: null,
    hostReady: false,
    guestReady: false,
    hostDropGranted: false,
    guestDropGranted: false,
    rewardsWritten: false,
    hostDnaDelivered: false,
    guestDnaDelivered: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await retryOperation(() => setDoc(doc(db, ROOMS, roomId), room));
  return { success: true, roomId, roomCode: roomId };
}

export async function joinCoopRedRoom(guestUserId, roomCode) {
  const code = String(roomCode || '')
    .trim()
    .toUpperCase();
  if (code.length !== 6) {
    return { success: false, error: 'Code invalide (6 caractères).' };
  }
  const charRes = await getUserCharacter(guestUserId);
  if (!charRes.success || !charRes.data) {
    return { success: false, error: 'Personnage introuvable.' };
  }

  const ref = doc(db, ROOMS, code);
  const result = await retryOperation(async () => {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        throw new Error('room_not_found');
      }
      const r = snap.data();
      if (r.status !== 'waiting' && r.status !== 'ready') {
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
      const updates = {
        guestId: guestUserId,
        guestSnapshot: snapshotCharacterForCoop(charRes.data),
        status: 'ready',
        updatedAt: Timestamp.now(),
      };
      if (!r.guestId) {
        updates.guestReady = false;
      }
      tx.update(ref, updates);
      return { roomId: code };
    });
  }).catch((e) => {
    const msg = e?.message;
    if (msg === 'room_not_found') return { success: false, error: 'Salle introuvable.' };
    if (msg === 'room_closed') return { success: false, error: 'Cette salle n’accepte plus de joueurs.' };
    if (msg === 'self_join') return { success: false, error: 'Tu es déjà l’hôte de cette salle.' };
    if (msg === 'room_full') return { success: false, error: 'La salle est pleine.' };
    if (msg === 'level_too_low') {
      const parts = msg.split(':');
      const minLv = parts[1] ? parseInt(parts[1], 10) : 0;
      return { success: false, error: `Niveau ${minLv || '?'} requis pour cette difficulté.` };
    }
    throw e;
  });

  if (result && result.success === false) return result;
  return { success: true, roomId: code };
}

export async function setCoopRedReady(userId, roomId, ready) {
  const ref = doc(db, ROOMS, roomId);
  const snap = await retryOperation(() => getDoc(ref));
  if (!snap.exists()) return { success: false, error: 'Salle introuvable.' };
  const r = snap.data();
  const field = r.hostId === userId ? 'hostReady' : 'guestReady';
  if (r.guestId == null && r.hostId !== userId) {
    return { success: false, error: 'Accès refusé.' };
  }
  if (r.hostId !== userId && r.guestId !== userId) {
    return { success: false, error: 'Accès refusé.' };
  }
  await retryOperation(() =>
    updateDoc(ref, {
      [field]: !!ready,
      updatedAt: Timestamp.now(),
    })
  );
  return { success: true };
}

export async function startCoopRedCombat(roomId) {
  const ref = doc(db, ROOMS, roomId);
  try {
    await retryOperation(async () => {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('missing');
        const r = snap.data();
        if (r.status !== 'ready' || !r.guestId || !r.hostSnapshot || !r.guestSnapshot) {
          throw new Error('not_ready');
        }
        if (!r.hostReady || !r.guestReady) throw new Error('not_ready');
        if (r.combat) throw new Error('already_started');

        await consumeOneAttemptInTransaction(tx, r.hostId);
        await consumeOneAttemptInTransaction(tx, r.guestId);

        const seed = (Math.random() * 0x7fffffff) >>> 0;
        let combat = createCoopRedCombatState(r.hostSnapshot, r.guestSnapshot, r.difficulty, seed);
        combat = coopRedResolveFromNewState(combat, r.hostSnapshot, r.guestSnapshot, r.difficulty);

        tx.update(ref, {
          status: 'in_progress',
          combat,
          updatedAt: Timestamp.now(),
        });
      });
    });
    return { success: true };
  } catch (e) {
    if (e.message === 'not_ready') return { success: false, error: 'Les deux joueurs doivent être prêts.' };
    if (e.message === 'already_started') return { success: false, error: 'Combat déjà lancé.' };
    if (e.message === 'no_attempts') return { success: false, error: 'Un joueur n’a plus d’essais aujourd’hui.' };
    return { success: false, error: e.message || 'Erreur au lancement.' };
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

function cloneCombatState(combat) {
  if (!combat) return null;
  return {
    ...combat,
    bossHP: [...(combat.bossHP || [])],
    bossMaxHP: [...(combat.bossMaxHP || [])],
    turnQueue: [...(combat.turnQueue || [])],
    log: [...(combat.log || [])],
    hostCd: { ...combat.hostCd },
    guestCd: { ...combat.guestCd },
  };
}

export async function submitCoopRedAction(roomId, userId, actionType) {
  const ref = doc(db, ROOMS, roomId);
  let txResult;
  try {
    txResult = await retryOperation(async () => {
      return await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('missing');
        const r = snap.data();
        if (r.status !== 'in_progress' || !r.combat) throw new Error('no_combat');
        if (r.combat.winner) throw new Error('ended');
        if (r.combat.pendingUserId !== userId) throw new Error('not_your_turn');

        const next = coopRedSubmitPlayerAction(
          cloneCombatState(r.combat),
          r.hostSnapshot,
          r.guestSnapshot,
          r.difficulty,
          userId,
          actionType === 'capacity' ? 'capacity' : 'auto'
        );

        const updates = {
          combat: next,
          updatedAt: Timestamp.now(),
        };

        if (next.winner === 'players' && !r.rewardsWritten) {
          const rate = COOP_RED_DROP_RATE[r.difficulty] ?? 0.25;
          const hRoll = coopDropRoll01(next.seed, next.rngCounter, 0x51a1beef);
          const gRoll = coopDropRoll01(next.seed, next.rngCounter, 0x52a1beef);
          updates.hostDropGranted = hRoll < rate;
          updates.guestDropGranted = gRoll < rate;
          updates.rewardsWritten = true;
          updates.status = 'completed';
        } else if (next.winner === 'boss') {
          updates.status = 'completed';
        }

        tx.update(ref, updates);
        return { combat: next };
      });
    });
  } catch (e) {
    const m = e?.message;
    if (m === 'not_your_turn') return { success: false, error: 'Ce n’est pas à ton tour.' };
    if (m === 'ended') return { success: false, error: 'Le combat est terminé.' };
    if (m === 'no_combat') return { success: false, error: 'Pas de combat en cours.' };
    return { success: false, error: m || 'Erreur' };
  }

  return { success: true, combat: txResult.combat };
}

/**
 * Chaque joueur crédite son propre personnage (règles Firestore) après victoire.
 */
export async function claimCoopRedDnaIfNeeded(roomId, userId) {
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

        if (r.hostId === userId && r.hostDropGranted && !r.hostDnaDelivered) {
          const cur = Number(cSnap.data().dnaFragments) || 0;
          tx.update(charRef, { dnaFragments: cur + 1, updatedAt: Timestamp.now() });
          tx.update(ref, { hostDnaDelivered: true, updatedAt: Timestamp.now() });
        } else if (r.guestId === userId && r.guestDropGranted && !r.guestDnaDelivered) {
          const cur = Number(cSnap.data().dnaFragments) || 0;
          tx.update(charRef, { dnaFragments: cur + 1, updatedAt: Timestamp.now() });
          tx.update(ref, { guestDnaDelivered: true, updatedAt: Timestamp.now() });
        }
      });
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function purchaseAllyRaceEcho(userId, allyRace) {
  const charRes = await getUserCharacter(userId);
  if (!charRes.success || !charRes.data) return { success: false, error: 'Personnage introuvable.' };
  const dna = Number(charRes.data.dnaFragments) || 0;
  if (dna < COOP_RED_DNA_COST_ECHO) {
    return { success: false, error: `Il faut ${COOP_RED_DNA_COST_ECHO} fragments ADN.` };
  }
  if (!allyRace || typeof allyRace !== 'string' || !races[allyRace]) {
    return { success: false, error: 'Race invalide.' };
  }
  return updateCharacterCoopRedRewards(userId, {
    dnaDelta: -COOP_RED_DNA_COST_ECHO,
    setAllyRaceEcho: { race: allyRace },
  });
}
