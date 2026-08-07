/**
 * Passifs de race V2 — toujours actifs, pas des sorts de rotation.
 */

export const V2_RACE_PASSIVES = {
  Orc: {
    id: 'fureur_du_sang',
    name: 'Fureur du sang',
    icon: '🪓',
    description: 'Sous 50 % PV : +25 % de dégâts infligés.',
    lowHpThreshold: 0.5,
    damageBonus: 1.25,
  },
};

export function getRacePassive(raceName) {
  return V2_RACE_PASSIVES[raceName] || null;
}

/** True si le passif Orc (fureur) est actif sur ce combattant. */
export function isOrcFureurActive(combattant) {
  if (combattant?.race !== 'Orc') return false;
  const p = V2_RACE_PASSIVES.Orc;
  const max = combattant.maxHP || 1;
  return combattant.currentHP <= max * p.lowHpThreshold;
}
