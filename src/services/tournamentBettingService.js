/**
 * Paris sur le vainqueur du tournoi (samedi) en runs (dungeonProgress.runsAvailable).
 * Mise / annulation : tant qu’il n’y a pas de doc tournoi « current » OU que statut === preparation.
 * Une fois le tournoi lancé (en_cours) ou terminé, paris figés côté client + transaction.
 * Les gains (pool) sont versés sur tournamentRewards.pendingTournamentBettingRuns pour le prochain perso.
 */

import { auth, db, functions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';
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
import { onAuthStateChanged } from 'firebase/auth';

export const TOURNAMENT_BETTING_DOC_ID = 'current';

/** Runs crédités sur tournamentRewards puis transférés au prochain personnage (init dungeonProgress). */
export const PENDING_TOURNAMENT_BETTING_RUNS_FIELD = 'pendingTournamentBettingRuns';

/**
 * Même logique que la fin de avancerMatch : id bracket du champion (GF / GFR), avec repli sur la liste.
 * @param {Object|null|undefined} tournoi
 * @returns {string|null}
 */
export function resolveChampionParticipantIdForBetting(tournoi) {
  if (!tournoi) return null;
  const matches = tournoi.matches || {};
  const gfr = matches.GFR;
  const gf = matches.GF;
  let pid = gfr?.winnerId || gf?.winnerId;
  if (pid && pid !== 'BYE') return pid;
  const champ = tournoi.champion;
  if (champ?.userId) {
    const row = (tournoi.participantsList || []).find((p) => p.userId === champ.userId);
    if (row?.participantId && row.participantId !== 'BYE') return row.participantId;
  }
  return null;
}

/** Aligné sur firestore.rules (update : +50000 max par transaction) */
export const MAX_RUNS_PER_BET_ADD = 50000;

export const MIN_RUNS_PER_BET = 1;

/** Message lisible pour les erreurs httpsCallable (Firebase Functions). */
function formatCallableError(e) {
  if (!e) return 'Échec de la requête.';
  const parts = [];
  const msg = typeof e.message === 'string' ? e.message.trim() : '';
  if (msg) parts.push(msg);
  const details = e.details != null ? String(e.details).trim() : '';
  if (details) parts.push(details);
  const code = e.code != null ? String(e.code) : '';
  if (parts.length === 0 && code) parts.push(`Code : ${code}`);
  return parts.length ? parts.join(' — ') : 'Échec de la requête.';
}

/**
 * Assure que l'appel callable part avec un contexte Auth valide.
 * Sans ça, on peut avoir un `userId` côté UI mais un `request.auth` vide côté Functions (race au chargement / token expiré).
 */
async function ensureAuthedForCallable(expectedUid) {
  if (!expectedUid) throw new Error('Non connecté.');

  const current = auth.currentUser;
  if (current && String(current.uid) === String(expectedUid)) {
    // Force un refresh léger si besoin (token expiré) avant l'appel Functions.
    await current.getIdToken();
    return;
  }

  // Attendre une fois la résolution d'état Auth (au premier load, currentUser peut être null brièvement).
  const user = await new Promise((resolve) => {
    let done = false;
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(null);
    }, 2500);

    const unsub = onAuthStateChanged(auth, (u) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      unsub();
      resolve(u || null);
    });
  });

  if (!user || String(user.uid) !== String(expectedUid)) {
    throw new Error('Session expirée, reconnectez-vous.');
  }

  await user.getIdToken();
}

function betDocRef(userId) {
  return doc(db, 'tournaments', TOURNAMENT_BETTING_DOC_ID, 'userBets', userId);
}

function tournamentRef() {
  return doc(db, 'tournaments', TOURNAMENT_BETTING_DOC_ID);
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

  try {
    await ensureAuthedForCallable(userId);
    const call = httpsCallable(functions, 'betting_placeBet');
    await call({ participantId, amount: parsed });
    return { success: true };
  } catch (e) {
    return { success: false, error: formatCallableError(e) };
  }
}

export async function cancelBet(userId) {
  if (!userId) return { success: false, error: 'Non connecté.' };

  try {
    await ensureAuthedForCallable(userId);
    const call = httpsCallable(functions, 'betting_cancelBet');
    const result = await call({});
    const refunded = Math.max(0, Math.floor(Number(result?.data?.refunded ?? 0)));
    return { success: true, refunded };
  } catch (e) {
    return { success: false, error: formatCallableError(e) };
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

      let perEntry = 0;

      if (winningStake > 0) {
        // Gagnants = joueurs ayant parié sur le champion (stake > 0).
        // Règle: 1 run misée = 1 "entrée". Donc si tu mises 5 runs sur le gagnant,
        // tu reçois 5 parts. Pool conservé (pas de création de runs).
        const winnerRows = rows
          .filter((r) => r.participantId === championParticipantId && r.runsStaked > 0)
          .sort((a, b) => a.userId.localeCompare(b.userId));

        perEntry = Math.floor(totalPool / winningStake); // gain par run misée
        if (perEntry > 0) {
          for (const r of winnerRows) {
            payouts.set(r.userId, (payouts.get(r.userId) || 0) + perEntry * r.runsStaked);
          }
        }

        // Distribuer le reste (dust) : 1 run à la fois, en round-robin sur les gagnants,
        // en attribuant au plus 1 run par "entrée" (par run misée).
        let dust = totalPool - perEntry * winningStake;
        if (dust > 0 && winnerRows.length > 0) {
          const credits = new Map();
          let i = 0;
          while (dust > 0) {
            const r = winnerRows[i % winnerRows.length];
            const got = credits.get(r.userId) || 0;
            if (got < r.runsStaked) {
              payouts.set(r.userId, (payouts.get(r.userId) || 0) + 1);
              credits.set(r.userId, got + 1);
              dust -= 1;
            }
            i += 1;
            if (i > winnerRows.length * (winningStake + 5)) break;
          }
        }
      }
      // Si winningStake === 0 : personne n'a parié sur le champion → pool perdu, aucun remboursement.

      payouts.forEach((amount, uid) => {
        if (amount <= 0) return;
        const rewardRef = doc(db, 'tournamentRewards', uid);
        transaction.set(
          rewardRef,
          {
            [PENDING_TOURNAMENT_BETTING_RUNS_FIELD]: increment(amount),
          },
          { merge: true }
        );
      });

      transaction.update(tRef, {
        bettingSettlement: {
          done: true,
          championParticipantId,
          totalPool,
          winningStake,
          // nb de gagnants (utile debug/affichage) — 0 si aucun pari gagnant
          winnersCount: payouts.size,
          distributedTotal: Array.from(payouts.values()).reduce((a, b) => a + b, 0),
          perEntry,
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
