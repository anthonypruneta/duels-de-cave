/**
 * Paris sur le vainqueur du tournoi (samedi) en runs (dungeonProgress.runsAvailable).
 * Mise / annulation : tant qu’il n’y a pas de doc tournoi « current » OU que statut === preparation.
 * Une fois le tournoi lancé (en_cours) ou terminé, paris figés côté client + transaction.
 * Les gains (pool) sont versés sur tournamentRewards.pendingTournamentBettingRuns pour le prochain perso.
 */

import { db } from '../firebase/config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

export const TOURNAMENT_BETTING_DOC_ID = 'current';

/** Runs crédités sur tournamentRewards puis transférés au prochain personnage (init dungeonProgress). */
export const PENDING_TOURNAMENT_BETTING_RUNS_FIELD = 'pendingTournamentBettingRuns';

/** Aligné sur firestore.rules (update : +50000 max par transaction) */
export const MAX_RUNS_PER_BET_ADD = 50000;

export const MIN_RUNS_PER_BET = 1;

function betDocRef(userId) {
  return doc(db, 'tournaments', TOURNAMENT_BETTING_DOC_ID, 'userBets', userId);
}

function tournamentRef() {
  return doc(db, 'tournaments', TOURNAMENT_BETTING_DOC_ID);
}

function dungeonProgressRef(userId) {
  return doc(db, 'dungeonProgress', userId);
}

function characterRef(participantId) {
  return doc(db, 'characters', participantId);
}

function runsAvailableFromProgress(data) {
  if (!data) return 0;
  const n = data.runsAvailable;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/**
 * Abonne le doc tournoi current (statut, participantsList, etc.)
 * @returns {() => void} unsubscribe
 */
export function subscribeCurrentTournamentForBetting(onData, onError) {
  return onSnapshot(
    tournamentRef(),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({ id: snap.id, ...snap.data() });
    },
    (err) => onError?.(err)
  );
}

/**
 * Abonne la collection des paris (agrégation pool côté client).
 * @returns {() => void} unsubscribe
 */
export function subscribeBettingPool(onDocs, onError) {
  const col = collection(db, 'tournaments', TOURNAMENT_BETTING_DOC_ID, 'userBets');
  return onSnapshot(
    col,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onDocs(list);
    },
    (err) => onError?.(err)
  );
}

/**
 * Abonne le pari du joueur (doc id = uid).
 * @returns {() => void} unsubscribe
 */
export function subscribeMyBet(userId, onData, onError) {
  if (!userId) {
    onData(null);
    return () => {};
  }
  return onSnapshot(
    betDocRef(userId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({ id: snap.id, ...snap.data() });
    },
    (err) => onError?.(err)
  );
}

export function aggregateStakesByParticipant(betDocs) {
  const map = {};
  for (const b of betDocs) {
    const pid = b.participantId;
    const stake = Number(b.runsStaked) || 0;
    if (!pid || stake <= 0) continue;
    map[pid] = (map[pid] || 0) + stake;
  }
  return map;
}

/**
 * @param {{ userId: string, participantId: string, amount: number }} params
 */
export async function placeBet({ userId, participantId, amount }) {
  if (!userId || !participantId) {
    return { success: false, error: 'Session ou combattant invalide.' };
  }
  const parsed = Math.floor(Number(amount));
  if (!Number.isFinite(parsed) || parsed < MIN_RUNS_PER_BET) {
    return { success: false, error: `Mise minimale : ${MIN_RUNS_PER_BET} run(s).` };
  }
  if (parsed > MAX_RUNS_PER_BET_ADD) {
    return { success: false, error: `Maximum ${MAX_RUNS_PER_BET_ADD} runs par ajout.` };
  }

  const tRef = tournamentRef();
  const bRef = betDocRef(userId);
  const dRef = dungeonProgressRef(userId);
  const cRef = characterRef(participantId);

  try {
    await runTransaction(db, async (transaction) => {
      const tSnap = await transaction.get(tRef);
      if (tSnap.exists()) {
        const tData = tSnap.data();
        if (tData.statut !== 'preparation') {
          throw new Error('Les paris sont fermés (tournoi lancé ou terminé).');
        }
        const target = tData.participants?.[participantId];
        if (target && target.ownerUserId != null) {
          if (String(target.ownerUserId) === String(userId)) {
            throw new Error('Vous ne pouvez pas parier sur votre propre personnage.');
          }
        } else {
          const cSnap = await transaction.get(cRef);
          if (!cSnap.exists()) {
            throw new Error('Combattant inconnu ou non éligible.');
          }
          const c = cSnap.data();
          if (c.archived || c.disabled) {
            throw new Error('Ce personnage ne participe pas au tournoi.');
          }
          if (String(participantId) === String(userId)) {
            throw new Error('Vous ne pouvez pas parier sur votre propre personnage.');
          }
        }
      } else {
        const cSnap = await transaction.get(cRef);
        if (!cSnap.exists()) {
          throw new Error('Combattant inconnu ou non éligible.');
        }
        const c = cSnap.data();
        if (c.archived || c.disabled) {
          throw new Error('Ce personnage ne participe pas au tournoi.');
        }
        if (String(participantId) === String(userId)) {
          throw new Error('Vous ne pouvez pas parier sur votre propre personnage.');
        }
      }

      const dSnap = await transaction.get(dRef);
      const available = runsAvailableFromProgress(dSnap.data());
      if (available < parsed) {
        throw new Error('Pas assez de runs disponibles.');
      }

      const betSnap = await transaction.get(bRef);
      if (betSnap.exists()) {
        const prev = betSnap.data();
        if (prev.participantId !== participantId) {
          throw new Error('Annulez votre pari avant de changer de combattant.');
        }
        const nextTotal = (Number(prev.runsStaked) || 0) + parsed;
        if (nextTotal > 500000) {
          throw new Error('Mise totale maximale dépassée (500 000 runs).');
        }
        transaction.update(bRef, {
          runsStaked: nextTotal,
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(bRef, {
          participantId,
          runsStaked: parsed,
          updatedAt: serverTimestamp(),
        });
      }

      transaction.set(
        dRef,
        {
          runsAvailable: increment(-parsed),
          userId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || 'Échec du pari.' };
  }
}

export async function cancelBet(userId) {
  if (!userId) return { success: false, error: 'Non connecté.' };

  const tRef = tournamentRef();
  const bRef = betDocRef(userId);
  const dRef = dungeonProgressRef(userId);

  try {
    await runTransaction(db, async (transaction) => {
      const tSnap = await transaction.get(tRef);
      if (tSnap.exists() && tSnap.data().statut !== 'preparation') {
        throw new Error('Impossible d’annuler : le tournoi a déjà commencé.');
      }

      const betSnap = await transaction.get(bRef);
      if (!betSnap.exists()) {
        throw new Error('Aucun pari à annuler.');
      }

      const refund = Number(betSnap.data().runsStaked) || 0;
      if (refund <= 0) {
        transaction.delete(bRef);
        return;
      }

      transaction.delete(bRef);
      transaction.set(
        dRef,
        {
          runsAvailable: increment(refund),
          userId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || 'Échec de l’annulation.' };
  }
}

export async function getMyBetOnce(userId) {
  if (!userId) return { success: true, data: null };
  try {
    const snap = await getDoc(betDocRef(userId));
    if (!snap.exists()) return { success: true, data: null };
    return { success: true, data: { id: snap.id, ...snap.data() } };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Distribution du pool à la fin du tournoi (appelé depuis avancerMatch, contexte admin).
 * Idempotent si bettingSettlement.done est déjà true.
 *
 * @param {string} docId
 * @param {string|null|undefined} championParticipantId — id bracket (ex. winnerId GF/GFR)
 */
/** Supprime tous les paris (nouveau tournoi sur le même doc Firestore). */
export async function clearTournamentUserBets(docId) {
  const col = collection(db, 'tournaments', docId, 'userBets');
  const snap = await getDocs(col);
  if (snap.empty) return;
  let batch = writeBatch(db);
  let n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    n += 1;
    if (n >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
}

export async function settleTournamentBettingIfNeeded(docId, championParticipantId) {
  if (docId !== TOURNAMENT_BETTING_DOC_ID || !championParticipantId) {
    return { success: true, skipped: true };
  }

  const tRef = tournamentRef();
  const betsCol = collection(db, 'tournaments', docId, 'userBets');

  try {
    await runTransaction(db, async (transaction) => {
      const tSnap = await transaction.get(tRef);
      if (!tSnap.exists()) return;
      const tData = tSnap.data();
      if (tData.bettingSettlement?.done) return;

      const betsSnap = await transaction.get(query(betsCol));

      let totalPool = 0;
      const rows = [];
      betsSnap.forEach((d) => {
        const data = d.data();
        const stake = Number(data.runsStaked) || 0;
        totalPool += stake;
        rows.push({
          userId: d.id,
          participantId: data.participantId,
          runsStaked: stake,
        });
      });

      const payouts = new Map();
      const winningStake = rows
        .filter((r) => r.participantId === championParticipantId)
        .reduce((s, r) => s + r.runsStaked, 0);

      if (winningStake <= 0) {
        for (const r of rows) {
          if (r.runsStaked > 0) payouts.set(r.userId, r.runsStaked);
        }
      } else {
        for (const r of rows) {
          if (r.participantId !== championParticipantId || r.runsStaked <= 0) continue;
          const base = Math.floor((totalPool * r.runsStaked) / winningStake);
          payouts.set(r.userId, base);
        }
        let distributed = 0;
        payouts.forEach((v) => {
          distributed += v;
        });
        let dust = totalPool - distributed;
        const winners = rows
          .filter((r) => r.participantId === championParticipantId && r.runsStaked > 0)
          .sort((a, b) => a.userId.localeCompare(b.userId));
        let wi = 0;
        while (dust > 0 && winners.length > 0) {
          const u = winners[wi % winners.length].userId;
          payouts.set(u, (payouts.get(u) || 0) + 1);
          dust -= 1;
          wi += 1;
        }
      }

      payouts.forEach((amount, uid) => {
        if (amount <= 0) return;
        if (winningStake <= 0) {
          const progRef = dungeonProgressRef(uid);
          transaction.set(
            progRef,
            {
              runsAvailable: increment(amount),
              userId: uid,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          const rewardRef = doc(db, 'tournamentRewards', uid);
          transaction.set(
            rewardRef,
            {
              [PENDING_TOURNAMENT_BETTING_RUNS_FIELD]: increment(amount),
            },
            { merge: true }
          );
        }
      });

      transaction.update(tRef, {
        bettingSettlement: {
          done: true,
          championParticipantId,
          totalPool,
          winningStake,
          version: 1,
          distributedAt: serverTimestamp(),
        },
      });
    });

    return { success: true };
  } catch (e) {
    console.error('settleTournamentBettingIfNeeded:', e);
    return { success: false, error: e.message };
  }
}
