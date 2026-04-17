import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

// Gen 2 = Cloud Run : sans accès public, OPTIONS est coupé avant le handler → « CORS » côté navigateur.
setGlobalOptions({
  region: 'europe-west1',
  invoker: 'public',
  ingressSettings: 'ALLOW_ALL',
});

initializeApp();

const db = getFirestore();

/** cors: true = autoriser toutes les origines (callables ; l’auth reste dans le corps de la requête). */
const CALLABLE_OPTS = { cors: true };

const DUNGEON_CONSTANTS = {
  MAX_RUNS_PER_RESET: 5,
  /** Plafond : 3 créneaux × 5 runs par jour civil (Europe/Paris), crédits automatiques uniquement. */
  MAX_PERIOD_BLOCKS_PER_PARIS_DAY: 3,
};

const PARIS_TZ = 'Europe/Paris';

// ============================================================================
// Timezone Paris (CET/CEST) — sans dépendre d'Intl timeZone côté runtime
// ============================================================================

function lastSundayOfMonthUTC(year, monthIndex0) {
  // monthIndex0: 0=Jan ... 11=Dec
  const lastDay = new Date(Date.UTC(year, monthIndex0 + 1, 0, 0, 0, 0));
  const dow = lastDay.getUTCDay(); // 0=Sun
  lastDay.setUTCDate(lastDay.getUTCDate() - dow);
  return lastDay; // 00:00 UTC du dernier dimanche
}

function parisOffsetMinutesForUtcDate(dateUtc = new Date()) {
  // DST Europe/Paris: du dernier dimanche de mars 01:00 UTC
  // au dernier dimanche d'octobre 01:00 UTC.
  const y = dateUtc.getUTCFullYear();
  const dstStart = lastSundayOfMonthUTC(y, 2); // mars
  dstStart.setUTCHours(1, 0, 0, 0);
  const dstEnd = lastSundayOfMonthUTC(y, 9); // octobre
  dstEnd.setUTCHours(1, 0, 0, 0);

  const t = dateUtc.getTime();
  const inDst = t >= dstStart.getTime() && t < dstEnd.getTime();
  return inDst ? 120 : 60; // minutes
}

function getParisWallClockParts(dateUtc = new Date()) {
  // On convertit l'instant UTC en "murale Paris" via offset CET/CEST déterministe.
  const offsetMin = parisOffsetMinutesForUtcDate(dateUtc);
  const parisMs = dateUtc.getTime() + offsetMin * 60 * 1000;
  const d = new Date(parisMs);

  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(), // 0=dim, 1=lun...
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

function assertAuthed(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Vous devez être connecté.');
  }
  return request.auth.uid;
}

function getIsoWeekIdUTC(referenceDate = new Date()) {
  const date = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Convertit une date/heure "murale" Europe/Paris en instant UTC (Date),
 * sans dépendre du fuseau du serveur (Cloud = souvent UTC).
 *
 * Approche: on applique un offset CET/CEST déterministe, puis on itère
 * (l'offset dépend du DST, donc il faut converger).
 */
function parisLocalToUtcDate({ year, month, day, hour, minute = 0, second = 0 }) {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);

  // Première estimation: assume l'offset au même instant UTC.
  let guess = naiveUtc - parisOffsetMinutesForUtcDate(new Date(naiveUtc)) * 60 * 1000;
  for (let i = 0; i < 6; i++) {
    const offsetMin = parisOffsetMinutesForUtcDate(new Date(guess));
    const candidate = naiveUtc - offsetMin * 60 * 1000;
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
  const p = getParisWallClockParts(date);
  if (p.weekday === 0) return true; // dimanche
  if (p.weekday === 6 && p.hour >= 18) return true; // samedi >= 18h
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
  const p = getParisWallClockParts(date);
  const y = String(p.year);
  const m = String(p.month).padStart(2, '0');
  const d = String(p.day).padStart(2, '0');
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
  const blocksCreditedToday = Math.floor(runsCreditedParisDay / DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET);
  const remainingBlocksToday = Math.max(0, DUNGEON_CONSTANTS.MAX_PERIOD_BLOCKS_PER_PARIS_DAY - blocksCreditedToday);

  if (!data?.lastCreditDate) {
    updates.lastCreditDate = Timestamp.fromDate(currentAnchor);
    updates.dungeonPeriodRunsParisDate = parisKey;
    updates.dungeonPeriodRunsCreditedToday = 0;
  } else {
    const periods = getResetPeriodsSince(lastCreditDate, now);

    if (periods > 0) {
      // Rattrapage OUI, mais plafond journalier appliqué UNIQUEMENT aux créneaux du jour Paris.
      // Les créneaux des jours précédents doivent pouvoir s'accumuler sans "consommer" midi/18h du jour.
      const last = lastCreditDate instanceof Date ? lastCreditDate : lastCreditDate.toDate();
      const lastAnchor = getResetAnchor(last);

      let cursor = advanceResetAnchor(new Date(lastAnchor.getTime()));
      let grantRunsTotal = 0;
      let grantedTodayBlocks = 0;

      while (cursor <= currentAnchor) {
        if (!isParisSunday(cursor)) {
          const cursorKey = getParisDateKey(cursor);
          if (cursorKey === parisKey) {
            if (grantedTodayBlocks < remainingBlocksToday) {
              grantRunsTotal += DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET;
              grantedTodayBlocks += 1;
            }
          } else {
            // Jour précédent : rattrapage complet (pas de plafond du jour courant)
            grantRunsTotal += DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET;
          }
        }
        cursor = advanceResetAnchor(cursor);
      }

      if (grantRunsTotal > 0) {
        updates.runsAvailable =
          (Number.isFinite(data?.runsAvailable) ? data.runsAvailable : 0) + grantRunsTotal;
      }

      // On avance toujours le pointeur au créneau courant pour éviter qu'un plafond journalier
      // laisse des créneaux "en retard" qui seraient re-crédités le lendemain.
      updates.lastCreditDate = Timestamp.fromDate(currentAnchor);
      updates.dungeonPeriodRunsParisDate = parisKey;
      updates.dungeonPeriodRunsCreditedToday = runsCreditedParisDay + grantedTodayBlocks * DUNGEON_CONSTANTS.MAX_RUNS_PER_RESET;
    } else if (data?.dungeonPeriodRunsParisDate !== parisKey) {
      // Jour nouveau mais aucun créneau écoulé depuis la dernière ancre: on réinitialise le compteur "du jour".
      updates.dungeonPeriodRunsParisDate = parisKey;
      updates.dungeonPeriodRunsCreditedToday = 0;
    }
  }

  if (Object.keys(updates).length > 0) {
    tx.set(progressRef, { ...updates, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  return updates;
}

export const dungeon_getProgress = onCall(CALLABLE_OPTS, async (request) => {
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

export const dungeon_startRun = onCall(CALLABLE_OPTS, async (request) => {
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

export const dungeon_endRun = onCall(CALLABLE_OPTS, async (request) => {
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

export const dungeon_setEquippedWeapon = onCall(CALLABLE_OPTS, async (request) => {
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

export const dungeon_markCompleted = onCall(CALLABLE_OPTS, async (request) => {
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

export const dungeon_grantRuns = onCall(CALLABLE_OPTS, async (request) => {
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
// Boss Rush — récompense runs (10) : claim serveur + rétroactif
// - Une fois par semaine ISO (UTC) par joueur
// - Déclenché à la victoire Boss Rush OU à l'arrivée sur l'accueil
// ============================================================================

export const bossRush_claimReward = onCall(CALLABLE_OPTS, async (request) => {
  const uid = assertAuthed(request);
  const userId = request.data?.userId;
  if (!userId || String(userId) !== String(uid)) {
    throw new HttpsError('permission-denied', 'Accès refusé.');
  }

  const progressRef = db.collection('dungeonProgress').doc(uid);
  const now = new Date();
  const currentWeekId = getIsoWeekIdUTC(now);

  const res = await db.runTransaction(async (tx) => {
    const snap = await tx.get(progressRef);
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', 'Progression donjon introuvable.');
    }
    const data = snap.data() || {};
    // Éligibilité = Boss Rush compté sur la semaine courante.
    // (Côté client, `bossRushLastCountedWeekId` est posé lors de la victoire finale.)
    const countedWeekId = data.bossRushLastCountedWeekId ?? null;
    if (String(countedWeekId || '') !== String(currentWeekId)) {
      return { granted: false, reason: 'not_completed_this_week' };
    }

    const lastGrantedWeekId = data.bossRushRewardLastGrantedWeekId ?? null;
    if (String(lastGrantedWeekId || '') === String(currentWeekId)) {
      return { granted: false, reason: 'already_granted' };
    }

    // Crédit runs en transaction + marquage "déjà donné cette semaine"
    tx.set(progressRef, {
      runsAvailable: FieldValue.increment(10),
      bossRushRewardLastGrantedWeekId: currentWeekId,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { granted: true, reason: 'granted' };
  });

  return { success: true, ...res };
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

/** Lecture tolérante du doc userBet (nombre / chaîne / BigInt / Long admin SDK / champ legacy amount). */
function parseRunsStakedFromBetData(data) {
  if (!data || typeof data !== 'object') return 0;

  const tryCoerce = (pick) => {
    if (pick == null) return null;
    if (typeof pick === 'number' && Number.isFinite(pick)) return Math.max(0, Math.floor(pick));
    if (typeof pick === 'bigint') {
      const n = Number(pick);
      return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
    }
    if (typeof pick === 'string' && pick.trim() !== '') {
      const n = Number(pick);
      return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
    }
    if (typeof pick === 'object' && pick !== null && typeof pick.toNumber === 'function') {
      try {
        const n = pick.toNumber();
        if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
      } catch (_) {
        /* ignore */
      }
    }
    if (typeof pick === 'object' && pick !== null && typeof pick.valueOf === 'function') {
      try {
        const v = pick.valueOf();
        if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.floor(v));
        if (typeof v === 'bigint') {
          const n = Number(v);
          if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
        }
      } catch (_) {
        /* ignore */
      }
    }
    return null;
  };

  const fromStaked = tryCoerce(data.runsStaked);
  if (fromStaked != null) return fromStaked;
  const fromAmount = tryCoerce(data.amount);
  if (fromAmount != null) return fromAmount;
  return 0;
}

/** Indique si le doc pari porte un champ de mise connu (même à 0). */
function betDocHasStakeFields(data) {
  if (!data || typeof data !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(data, 'runsStaked') || Object.prototype.hasOwnProperty.call(data, 'amount');
}

export const betting_placeBet = onCall(CALLABLE_OPTS, async (request) => {
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
      const prevStake = parseRunsStakedFromBetData(prev);
      const nextTotal = prevStake + amount;
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

// Redeploy tag: ensure IAM invoker=public is (re)applied on Cloud Run service.
export const betting_cancelBet = onCall(CALLABLE_OPTS, async (request) => {
  const uid = assertAuthed(request);
  const tRef = tournamentRef();
  const bRef = betDocRef(uid);
  const dRef = dungeonProgressRef(uid);

  let refundedRuns = 0;

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
      // Idempotent : double clic / doc déjà supprimé
      return;
    }

    const data = betSnap.data() || {};
    const refund = parseRunsStakedFromBetData(data);
    const hasStake = betDocHasStakeFields(data);

    if (refund > 0) {
      tx.delete(bRef);
      tx.set(
        dRef,
        {
          runsAvailable: FieldValue.increment(refund),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      refundedRuns = refund;
      return;
    }

    // refund === 0 : soit mise réellement 0, soit doc sans champ, soit valeur illisible
    if (!hasStake) {
      tx.delete(bRef);
      console.warn('betting_cancelBet: suppression doc pari sans champ runsStaked/amount', { uid });
      return;
    }

    const raw = data.runsStaked !== undefined ? data.runsStaked : data.amount;
    const explicitZero =
      raw === 0 ||
      raw === '0' ||
      (typeof raw === 'string' && raw.trim() === '0');

    if (explicitZero) {
      tx.delete(bRef);
      return;
    }

    // Champ présent mais montant > 0 non lisible : ne pas supprimer (éviter de voler des runs)
    console.error('betting_cancelBet: mise illisible', { uid, rawType: typeof raw });
    throw new HttpsError(
      'failed-precondition',
      'Impossible de lire le montant de votre mise. Réessayez ou contactez un administrateur.'
    );
  });

  return { success: true, refunded: refundedRuns };
});

