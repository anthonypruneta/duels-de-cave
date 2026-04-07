export const PARIS_TZ = 'Europe/Paris';

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
 * sans dépendre du fuseau de l'utilisateur.
 */
function parisLocalToUtcDate({ year, month, day, hour, minute = 0, second = 0 }) {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);

  const parisOffsetMsAt = (utcMs) => {
    const p = getParisWallClockParts(new Date(utcMs));
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

/**
 * Millisecondes avant le prochain crédit runs (00h / 12h / 18h, heure de Paris).
 * Sert à rafraîchir l'UI au moment du créneau (le serveur décide du crédit réel).
 */
export function getMsUntilNextParisDungeonReset(now = new Date()) {
  const p = getParisWallClockParts(now);

  let nextHour;
  let nextYear = p.year;
  let nextMonth = p.month;
  let nextDay = p.day;

  if (p.hour < 12) nextHour = 12;
  else if (p.hour < 18) nextHour = 18;
  else {
    nextHour = 0;
    const nextLocalMidnightUtc = parisLocalToUtcDate({
      year: p.year,
      month: p.month,
      day: p.day,
      hour: 0,
      minute: 0,
      second: 0,
    });
    const plusOneDay = new Date(nextLocalMidnightUtc.getTime() + 24 * 60 * 60 * 1000);
    const p2 = getParisWallClockParts(plusOneDay);
    nextYear = p2.year;
    nextMonth = p2.month;
    nextDay = p2.day;
  }

  const nextUtc = parisLocalToUtcDate({
    year: nextYear,
    month: nextMonth,
    day: nextDay,
    hour: nextHour,
    minute: 0,
    second: 0,
  });

  return Math.max(0, nextUtc.getTime() - now.getTime());
}

export function getParisDateKey(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: PARIS_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch (_) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}

export function isSameParisDay(a, b) {
  return getParisDateKey(a) === getParisDateKey(b);
}

/**
 * Retourne true si le Miroir a déjà été fait aujourd'hui (jour civil Europe/Paris).
 * @param {any} lastMirrorDate - Timestamp Firestore, Date, ou valeur convertible en Date
 * @param {Date} [now]
 */
export function isMirrorDoneToday(lastMirrorDate, now = new Date()) {
  if (!lastMirrorDate) return false;
  const toDateSafe = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === 'function') {
      try { return v.toDate(); } catch (_) { /* ignore */ }
    }
    // Timestamp sérialisé (callable / JSON): { seconds, nanoseconds } ou { _seconds, _nanoseconds }
    const secs = Number.isFinite(v.seconds) ? v.seconds : (Number.isFinite(v._seconds) ? v._seconds : null);
    const nanos = Number.isFinite(v.nanoseconds) ? v.nanoseconds : (Number.isFinite(v._nanoseconds) ? v._nanoseconds : 0);
    if (secs != null) {
      const ms = Math.floor(secs * 1000 + Math.floor(nanos / 1e6));
      return new Date(ms);
    }
    // ISO string / number fallback
    const d = new Date(v);
    return d;
  };

  const d = toDateSafe(lastMirrorDate);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return false;
  return isSameParisDay(d, now);
}

