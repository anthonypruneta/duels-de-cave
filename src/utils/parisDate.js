export const PARIS_TZ = 'Europe/Paris';

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
  const d =
    lastMirrorDate instanceof Date
      ? lastMirrorDate
      : typeof lastMirrorDate?.toDate === 'function'
        ? lastMirrorDate.toDate()
        : new Date(lastMirrorDate);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return false;
  return isSameParisDay(d, now);
}

