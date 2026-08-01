/**
 * Buffs / débuffs à durée (tours) — proto V2.
 */

export function createEmptyStatus() {
  return {
    /** Buff Fureur du sang : tours restants */
    fureurSang: 0,
    /** Débuff Stigmate : tours restants */
    stigmate: 0,
  };
}

export function tickStatuses(status) {
  return {
    fureurSang: Math.max(0, (status.fureurSang || 0) - 1),
    stigmate: Math.max(0, (status.stigmate || 0) - 1),
  };
}

export function hasFureurSang(status) {
  return (status?.fureurSang || 0) > 0;
}

export function hasStigmate(status) {
  return (status?.stigmate || 0) > 0;
}
