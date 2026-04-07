import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

initializeApp();

const db = getFirestore();

const DUNGEON_CONSTANTS = {
  MAX_RUNS_PER_RESET: 5,
  /** Plafond : 3 créneaux × 5 runs par jour civil (Europe/Paris), crédits automatiques uniquement. */
  MAX_PERIOD_BLOCKS_PER_PARIS_DAY: 3,
};

const PARIS_TZ = 'Europe/Paris';

function assertAuthed(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Vous devez être connecté.');
  }
  return request.auth.uid;
}

function getParisWallClockParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PARIS_TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);

  const m = {};
  for (const p of parts) {
    if (p.type !== 'literal') m[p.type] = p.value;
  }

  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    year: parseInt(m.year, 10),
    month: parseInt(m.month, 10),
    day: parseInt(m.day, 10),
    weekday: weekdayMap[m.weekday] ?? null,
    hour: parseInt(m.hour, 10),
    minute: parseInt(m.minute, 10),
    second: parseInt(m.second, 10),
  };
}

/**
 * Convertit une date/heure "murale" Europe/Paris en instant UTC (Date),
 * sans dépendre du fuseau du serveur (Cloud = souvent UTC).
 *
 * Approche: on calcule l'offset Europe/Paris à un instant donné via formatToParts,
 * puis on itère (l'offset dépend du DST).
 */
function parisLocalToUtcDate({ year, month, day, hour, minute = 0, second = 0 }) {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);

  const parisOffsetMsAt = (utcMs) => {
    const p = getParisWallClockParts(new Date(utcMs));
    // "p" est l'heure locale Paris observée à l'instant utcMs.
    // Si on l'interprète comme un instant UTC, l'écart avec utcMs = offset du fuseau.
    const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0);
    return asIfUtc - utcMs;
  };

  let guess = naiveUtc;
  for (let i = 0; i < 6; i++) {
    const offset = parisOffsetMsAt(guess);
    const candidate = naiveUtc - offset;
    if (candidate === guess) break;
    guess = candidate;
  }

  return new Date(guess);
}

function getResetAnchor(date) {
  const p = getParisWallClockParts(date);
  const slotHour = p.hour < 12 ? 0 : p.hour < 18 ? 12 : 18;
  return parisLocalToUtcDate({ year: p.year, month: p.month, day: p.day, hour: slotHour, minute: 0, second: 0 });
}

function isParisSunday(date) {
  return getParisWallClockParts(date).weekday === 0;
}

function isParisPostTournament(date = new Date()) {
  const tz = PARIS_TZ;
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: tz,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  let weekday = '';
  let hour = 0;
  for (const p of parts) {
    if (p.type === 'weekday') weekday = p.value;
    if (p.type === 'hour') hour = parseInt(p.value, 10);
  }
  if (weekday === 'dim.') return true;
  if (weekday === 'sam.' && hour >= 18) return true;
  return false;
}

function advanceResetAnchor(anchor) {
  const p = getParisWallClockParts(anchor);
  let nextYear = p.year;
  let nextMonth = p.month;
  let nextDay = p.day;
  let nextHour = 0;

  if (p.hour === 0) nextHour = 12;
  else if (p.hour === 12) nextHour = 18;
  else {
    nextHour = 0;
    const nextLocalMidnight = parisLocalToUtcDate({
      year: p.year,
      month: p.month,
      day: p.day,
      hour: 0,
      minute: 0,
      second: 0,
    });
    const plusOneDay = new Date(nextLocalMidnight.getTime() + 24 * 60 * 60 * 1000);
    const p2 = getParisWallClockParts(plusOneDay);
    nextYear = p2.year;
    nextMonth = p2.month;
    nextDay = p2.day;
  }

  return parisLocalToUtcDate({
    year: nextYear,
    month: nextMonth,
    day: nextDay,
    hour: nextHour,
    minute: 0,
    second: 0,
  });
}

/** Jour civil Paris YYYY-MM-DD (aligné dimanche / tournoi). */
function getParisDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

/** Avance lastCreditDate de N périodes (sans sauter au « maintenant » si cap journalier). */
function lastCreditDateAfterGrantingPeriods(lastCreditDate, periodsToGrant) {
  if (periodsToGrant <= 0) return null;
  const last = lastCreditDate instanceof Date ? lastCreditDate : lastCreditDate.toDate();
  let anchor = getResetAnchor(last);
  for (let i = 0; i < periodsToGrant; i++) {
    anchor = advanceResetAnchor(anchor);
  }
  return anchor;
}

function getResetPeriodsSince(lastCreditDate, now = new Date()) {
  if (!lastCreditDate) return 0;
  const last = lastCreditDate instanceof Date ? lastCreditDate : lastCreditDate.toDate();
  const currentAnchor = getResetAnchor(now);
  const lastAnchor = getResetAnchor(last);
  const diffMs = currentAnchor - lastAnchor;
  if (diffMs <= 0) return 0;
  let count = 0;
  let cursor = advanceResetAnchor(new Date(lastAnchor.getTime()));
  while (cursor <= currentAnchor) {
    if (!isParisSunday(cursor)) count += 1;
    cursor = advanceResetAnchor(cursor);
  }
  return count;
}

function isNewDay(lastRunDate, now = new Date()) {
  if (!lastRunDate) return true;
  const last = lastRunDate instanceof Date ? lastRunDate : lastRunDate.toDate();
  const currentAnchor = getResetAnchor(now);
  return last < currentAnchor;
}

function getRunsSinceWeekStart(now = new Date()) {
  const p = getParisWallClockParts(now);
  const weekday = p.weekday; // 0=dim, 1=lun, ...
  const diffDays = weekday === 0 ? -6 : 1 - weekday; // ramener au lundi (Paris)

  const todayParisMidnightUtc = parisLocalToUtcDate({
    year: p.year,
    month: p.month,
    day: p.day,
    hour: 0,
    minute: 0,
    second: 0,
  });
  const mondayUtc = new Date(todayParisMidnightUtc.getTime() + diffDays * 24 * 60 * 60 * 1000);

  const periods = getResetPeriodsSince(mondayUtc, now);
  return (periods + 1) * DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET;
}

function getInitialRunsForNewPlayer(now = new Date()) {
  if (isParisPostTournament(now)) return 0;
  return getRunsSinceWeekStart(now);
}

async function applyRunCreditsInTransaction(tx, progressRef, data, now) {
  const updates = {};

  const parisKey = getParisDateKey(now);
  const lastCreditDate = data?.lastCreditDate ?? null;
  const currentAnchor = getResetAnchor(now);

  const runsCreditedParisDay =
    data?.dungeonPeriodRunsParisDate === parisKey
      ? Math.min(
          DUNGEON_CONSTANTS.MAX_PERIOD_BLOCKS_PER_PARIS_DAY * DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET,
          Math.max(0, Math.floor(Number(data.dungeonPeriodRunsCreditedToday) || 0))
        )
      : 0;
  const remainingSlots = Math.max(
    0,
    DUNGEON_CONSTANTS.MAX_PERIOD_BLOCKS_PER_PARIS_DAY -
      Math.floor(runsCreditedParisDay / DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET)
  );

  if (!data?.lastCreditDate) {
    updates.lastCreditDate = Timestamp.fromDate(currentAnchor);
    updates.dungeonPeriodRunsParisDate = parisKey;
    updates.dungeonPeriodRunsCreditedToday = 0;
  } else {
    const periods = getResetPeriodsSince(lastCreditDate, now);
    if (periods > 0) {
      const periodsToGrant = Math.min(periods, remainingSlots);
      if (periodsToGrant > 0) {
        const grantRuns = periodsToGrant * DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET;
        updates.runsAvailable = (Number.isFinite(data?.runsAvailable) ? data.runsAvailable : 0) + grantRuns;
        const newLast = lastCreditDateAfterGrantingPeriods(lastCreditDate, periodsToGrant);
        updates.lastCreditDate = Timestamp.fromDate(newLast);
        updates.dungeonPeriodRunsParisDate = parisKey;
        updates.dungeonPeriodRunsCreditedToday = runsCreditedParisDay + grantRuns;
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    tx.set(progressRef, { ...updates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  return updates;
}

export const dungeon_getProgress = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = assertAuthed(request);
  const userId = request.data?.userId;
  if (!userId || String(userId) !== String(uid)) {
    throw new HttpsError('permission-denied', 'Accès refusé.');
  }

  const progressRef = db.collection('dungeonProgress').doc(uid);
  const rewardRef = db.collection('tournamentRewards').doc(uid);
  const now = new Date();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(progressRef);
    const data = snap.exists ? (snap.data() || {}) : {};

    if (!snap.exists) {
      const rewardSnap = await tx.get(rewardRef);
      const pending = rewardSnap.exists
        ? Math.max(0, Math.floor(Number(rewardSnap.data()?.pendingTournamentBettingRuns || 0)))
        : 0;
      const initialRuns = getInitialRunsForNewPlayer(now);
      const totalRuns = initialRuns + pending;

      const parisKeyNew = getParisDateKey(now);
      tx.set(progressRef, {
        userId: uid,
        equippedWeapon: null,
        runsToday: 0,
        runsAvailable: totalRuns,
        lastRunDate: null,
        lastCreditDate: Timestamp.fromDate(getResetAnchor(now)),
        dungeonPeriodRunsParisDate: parisKeyNew,
        dungeonPeriodRunsCreditedToday: 0,
        totalRuns: 0,
        bestRun: 0,
        totalBossKills: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      if (pending > 0) {
        tx.set(rewardRef, { pendingTournamentBettingRuns: 0, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      const created = {
        userId: uid,
        equippedWeapon: null,
        runsToday: 0,
        runsAvailable: totalRuns,
        lastRunDate: null,
        lastCreditDate: Timestamp.fromDate(getResetAnchor(now)),
        dungeonPeriodRunsParisDate: parisKeyNew,
        dungeonPeriodRunsCreditedToday: 0,
        totalRuns: 0,
        bestRun: 0,
        totalBossKills: 0,
      };
      return { exists: true, data: created };
    }

    // Créditer les runs en utilisant l'heure serveur.
    const credited = await applyRunCreditsInTransaction(tx, progressRef, data, now);

    // Reset "runsToday" si on est dans un nouveau créneau (0h/12h/18h).
    const lastRunDate = data.lastRunDate ?? null;
    if (isNewDay(lastRunDate, now) && (data.runsToday || 0) !== 0) {
      tx.set(progressRef, { runsToday: 0 }, { merge: true });
      data.runsToday = 0;
    }

    const merged = { ...data, ...credited };
    return { exists: true, data: merged };
  });

  return { success: true, data: result.data || {} };
});

export const dungeon_startRun = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = assertAuthed(request);
  const userId = request.data?.userId;
  if (!userId || String(userId) !== String(uid)) {
    throw new HttpsError('permission-denied', 'Accès refusé.');
  }

  const progressRef = db.collection('dungeonProgress').doc(uid);
  const now = new Date();

  const res = await db.runTransaction(async (tx) => {
    const snap = await tx.get(progressRef);
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', 'Progression donjon introuvable.');
    }

    const data = snap.data() || {};

    // Créditer les runs manquants (heure serveur), puis consommer 1 run.
    const credited = await applyRunCreditsInTransaction(tx, progressRef, data, now);
    const afterCredit = { ...data, ...credited };

    const currentAvailable = Number.isFinite(afterCredit.runsAvailable) ? Math.max(0, Math.floor(afterCredit.runsAvailable)) : 0;
    if (currentAvailable <= 0) {
      throw new HttpsError('resource-exhausted', 'Plus de runs disponibles');
    }

    const newRunsToday = isNewDay(afterCredit.lastRunDate ?? null, now) ? 1 : (afterCredit.runsToday || 0) + 1;
    const newRunsAvailable = currentAvailable - 1;

    tx.set(progressRef, {
      runsToday: newRunsToday,
      runsAvailable: newRunsAvailable,
      lastRunDate: Timestamp.fromDate(now),
      totalRuns: (afterCredit.totalRuns || 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { runsRemaining: newRunsAvailable, startingLevel: 1 };
  });

  return { success: true, ...res };
});

export const dungeon_endRun = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = assertAuthed(request);
  const userId = request.data?.userId;
  if (!userId || String(userId) !== String(uid)) {
    throw new HttpsError('permission-denied', 'Accès refusé.');
  }
  const highestLevelBeaten = Math.floor(Number(request.data?.highestLevelBeaten || 0));
  if (!Number.isFinite(highestLevelBeaten) || highestLevelBeaten < 0 || highestLevelBeaten > 9999) {
    throw new HttpsError('invalid-argument', 'highestLevelBeaten invalide.');
  }

  const progressRef = db.collection('dungeonProgress').doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(progressRef);
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', 'Progression donjon introuvable.');
    }
    const data = snap.data() || {};
    const currentBest = Number(data.bestRun) || 0;
    const update = {
      totalBossKills: (Number(data.totalBossKills) || 0) + highestLevelBeaten,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (highestLevelBeaten > currentBest) update.bestRun = highestLevelBeaten;
    tx.set(progressRef, update, { merge: true });
  });

  return { success: true };
});

export const dungeon_setEquippedWeapon = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = assertAuthed(request);
  const userId = request.data?.userId;
  if (!userId || String(userId) !== String(uid)) {
    throw new HttpsError('permission-denied', 'Accès refusé.');
  }
  const weaponId = request.data?.weaponId ?? null;
  if (weaponId !== null && (typeof weaponId !== 'string' || weaponId.length < 1 || weaponId.length > 128)) {
    throw new HttpsError('invalid-argument', 'weaponId invalide.');
  }

  const progressRef = db.collection('dungeonProgress').doc(uid);
  await progressRef.set({
    equippedWeapon: weaponId,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
});

export const dungeon_markCompleted = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = assertAuthed(request);
  const userId = request.data?.userId;
  if (!userId || String(userId) !== String(uid)) {
    throw new HttpsError('permission-denied', 'Accès refusé.');
  }
  const dungeonKey = request.data?.dungeonKey;
  if (!dungeonKey || typeof dungeonKey !== 'string' || dungeonKey.length > 64) {
    throw new HttpsError('invalid-argument', 'dungeonKey invalide.');
  }

  const progressRef = db.collection('dungeonProgress').doc(uid);
  await progressRef.set({
    dungeonCompletions: { [dungeonKey]: true },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
});

export const dungeon_grantRuns = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = assertAuthed(request);
  const userId = request.data?.userId;
  if (!userId || String(userId) !== String(uid)) {
    throw new HttpsError('permission-denied', 'Accès refusé.');
  }
  const attempts = Math.floor(Number(request.data?.attempts || 0));
  if (!Number.isFinite(attempts) || attempts <= 0 || attempts > 1000) {
    throw new HttpsError('invalid-argument', 'attempts invalide.');
  }

  const progressRef = db.collection('dungeonProgress').doc(uid);
  await progressRef.set({
    runsAvailable: FieldValue.increment(attempts),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
});

// ============================================================================
// Tournoi — paris (runs) via Functions (anti-cheat: runsAvailable côté serveur)
// ============================================================================

const TOURNAMENT_BETTING_DOC_ID = 'current';

function betDocRef(uid) {
  return db.collection('tournaments').doc(TOURNAMENT_BETTING_DOC_ID).collection('userBets').doc(uid);
}

function tournamentRef() {
  return db.collection('tournaments').doc(TOURNAMENT_BETTING_DOC_ID);
}

function dungeonProgressRef(uid) {
  return db.collection('dungeonProgress').doc(uid);
}

function characterRef(participantId) {
  return db.collection('characters').doc(participantId);
}

function runsAvailableFromProgress(data) {
  if (!data) return 0;
  const n = data.runsAvailable;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export const betting_placeBet = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = assertAuthed(request);
  const participantId = request.data?.participantId;
  const amount = Math.floor(Number(request.data?.amount || 0));
  if (!participantId || typeof participantId !== 'string' || participantId.length > 128) {
    throw new HttpsError('invalid-argument', 'participantId invalide.');
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > 50000) {
    throw new HttpsError('invalid-argument', 'Mise invalide.');
  }

  const tRef = tournamentRef();
  const bRef = betDocRef(uid);
  const dRef = dungeonProgressRef(uid);
  const cRef = characterRef(participantId);

  await db.runTransaction(async (tx) => {
    const tSnap = await tx.get(tRef);
    if (tSnap.exists) {
      const tData = tSnap.data() || {};
      if (tData.statut !== 'preparation') {
        throw new HttpsError('failed-precondition', 'Les paris sont fermés (tournoi lancé ou terminé).');
      }
      const target = tData.participants?.[participantId];
      if (target && target.ownerUserId != null) {
        if (String(target.ownerUserId) === String(uid)) {
          throw new HttpsError('failed-precondition', 'Vous ne pouvez pas parier sur votre propre personnage.');
        }
      } else {
        const cSnap = await tx.get(cRef);
        if (!cSnap.exists) throw new HttpsError('not-found', 'Combattant inconnu ou non éligible.');
        const c = cSnap.data() || {};
        if (c.archived || c.disabled) throw new HttpsError('failed-precondition', 'Ce personnage ne participe pas au tournoi.');
        if (String(participantId) === String(uid)) {
          throw new HttpsError('failed-precondition', 'Vous ne pouvez pas parier sur votre propre personnage.');
        }
      }
    } else {
      const cSnap = await tx.get(cRef);
      if (!cSnap.exists) throw new HttpsError('not-found', 'Combattant inconnu ou non éligible.');
      const c = cSnap.data() || {};
      if (c.archived || c.disabled) throw new HttpsError('failed-precondition', 'Ce personnage ne participe pas au tournoi.');
      if (String(participantId) === String(uid)) {
        throw new HttpsError('failed-precondition', 'Vous ne pouvez pas parier sur votre propre personnage.');
      }
    }

    const dSnap = await tx.get(dRef);
    const available = runsAvailableFromProgress(dSnap.data());
    if (available < amount) {
      throw new HttpsError('failed-precondition', 'Pas assez de runs disponibles.');
    }

    const betSnap = await tx.get(bRef);
    if (betSnap.exists) {
      const prev = betSnap.data() || {};
      if (prev.participantId !== participantId) {
        throw new HttpsError('failed-precondition', 'Annulez votre pari avant de changer de combattant.');
      }
      const nextTotal = (Number(prev.runsStaked) || 0) + amount;
      if (nextTotal > 500000) {
        throw new HttpsError('failed-precondition', 'Mise totale maximale dépassée (500 000 runs).');
      }
      tx.set(bRef, { runsStaked: nextTotal, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } else {
      tx.set(bRef, { participantId, runsStaked: amount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    tx.set(dRef, {
      runsAvailable: FieldValue.increment(-amount),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { success: true };
});

export const betting_cancelBet = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = assertAuthed(request);
  const tRef = tournamentRef();
  const bRef = betDocRef(uid);
  const dRef = dungeonProgressRef(uid);

  await db.runTransaction(async (tx) => {
    const tSnap = await tx.get(tRef);
    if (tSnap.exists) {
      const tData = tSnap.data() || {};
      if (tData.statut !== 'preparation') {
        throw new HttpsError('failed-precondition', 'Impossible d’annuler : le tournoi a déjà commencé.');
      }
    }

    const betSnap = await tx.get(bRef);
    if (!betSnap.exists) {
      throw new HttpsError('not-found', 'Aucun pari à annuler.');
    }
    const refund = Number(betSnap.data()?.runsStaked) || 0;
    tx.delete(bRef);
    if (refund > 0) {
      tx.set(dRef, {
        runsAvailable: FieldValue.increment(refund),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });

  return { success: true };
});

