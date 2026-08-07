/**
 * Buffs / débuffs à durée (tours) — proto V2.
 */

export function createEmptyStatus() {
  return {
    stigmate: 0,
    /** Esquive totale (prochaine action adverse) */
    esquive: 0,
    /** Riposte armée (prochaine attaque reçue) */
    riposteArmed: false,
    /** Égide : prochaine attaque reçue → bouclier + anti-soin */
    aegisArmed: false,
    /** Familier Demoniste : tours restants */
    familiar: 0,
    /** Anti-soin : tours restants (−20 % soins) */
    antiHeal: 0,
    /** Prochaine attaque sortante réduite (0–1), ex. Succube 0.5 */
    nextAttackPenalty: 0,
  };
}

export function tickStatuses(status) {
  return {
    ...status,
    stigmate: Math.max(0, (status.stigmate || 0) - 1),
    antiHeal: Math.max(0, (status.antiHeal || 0) - 1),
    familiar: status.familiar || 0,
    esquive: status.esquive || 0,
    riposteArmed: !!status.riposteArmed,
    aegisArmed: !!status.aegisArmed,
    nextAttackPenalty: status.nextAttackPenalty || 0,
  };
}

export function hasStigmate(status) {
  return (status?.stigmate || 0) > 0;
}

export function hasFamiliar(status) {
  return (status?.familiar || 0) > 0;
}

export function hasAntiHeal(status) {
  return (status?.antiHeal || 0) > 0;
}

export function hasEsquive(status) {
  return (status?.esquive || 0) > 0;
}
