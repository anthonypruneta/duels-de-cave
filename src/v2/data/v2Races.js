/**
 * Passifs de race V2 — toujours actifs, jamais des sorts de rotation.
 * Effets calqués sur V1 (hors éveils niveau 100).
 */

import { races as V1_RACES } from '../../data/races';
import { raceConstants as RC } from '../../data/combatMechanics';

const EMPTY_STATS = { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 };

const BASE_CRIT = 0.1;
const CRIT_MULT = 1.5;

export const V2_RACE_PASSIVES = {
  Humain: {
    id: 'polyvalence',
    name: 'Polyvalence',
    icon: V1_RACES.Humain?.icon || '👥',
    description: V1_RACES.Humain?.bonus || '+10 PV, +1 toutes stats',
    stats: { hp: 10, auto: 1, def: 1, cap: 1, rescap: 1, spd: 1 },
  },
  Elfe: {
    id: 'precision_elfique',
    name: 'Précision elfique',
    icon: V1_RACES.Elfe?.icon || '🧝',
    description: V1_RACES.Elfe?.bonus || '+1 Auto, +1 Cap, +5 Vit, +20 % crit',
    stats: { auto: 1, cap: 1, spd: 5 },
    critBonus: RC.elfe.critBonus,
  },
  Orc: {
    id: 'fureur_du_sang',
    name: 'Fureur du sang',
    icon: V1_RACES.Orc?.icon || '🪓',
    description: V1_RACES.Orc?.bonus || 'Sous 50 % PV : +20 % dégâts',
    lowHpThreshold: RC.orc.lowHpThreshold,
    damageBonus: RC.orc.damageBonus,
  },
  Nain: {
    id: 'peau_de_pierre',
    name: 'Peau de pierre',
    icon: V1_RACES.Nain?.icon || '⛏️',
    description: V1_RACES.Nain?.bonus || '+10 PV & +7 Déf',
    stats: { hp: 10, def: 7 },
  },
  Dragonkin: {
    id: 'ecaille_draconique',
    name: 'Écaille draconique',
    icon: V1_RACES.Dragonkin?.icon || '🐲',
    description: V1_RACES.Dragonkin?.bonus || '+15 PV, +15 ResC',
    stats: { hp: 15, rescap: 15 },
  },
  'Mort-vivant': {
    id: 'non_mort',
    name: 'Non-mort',
    icon: V1_RACES['Mort-vivant']?.icon || '☠️',
    description: V1_RACES['Mort-vivant']?.bonus || 'Revient à 20 % PV (1×)',
    revivePercent: RC.mortVivant.revivePercent,
  },
  Lycan: {
    id: 'sang_lycan',
    name: 'Sang lycan',
    icon: V1_RACES.Lycan?.icon || '🐺',
    description: V1_RACES.Lycan?.bonus || 'Saignement cumulatif',
    bleedPerHit: RC.lycan.bleedPerHit,
    bleedPercentPerStack: RC.lycan.bleedPercentPerStack,
  },
  Sylvari: {
    id: 'sève_eternelle',
    name: 'Sève éternelle',
    icon: V1_RACES.Sylvari?.icon || '🌿',
    description: V1_RACES.Sylvari?.bonus || 'Regen 2 % PV max/tour',
    regenPercent: RC.sylvari.regenPercent,
  },
  Gnome: {
    id: 'duel_de_vitesse',
    name: 'Duel de vitesse',
    icon: V1_RACES.Gnome?.icon || '🧬',
    description: V1_RACES.Gnome?.bonus || 'Bonus selon VIT vs cible',
    stats: { spd: RC.gnome.spd, cap: RC.gnome.cap },
    duel: {
      critIfFaster: RC.gnome.critIfFaster,
      critDmgIfFaster: RC.gnome.critDmgIfFaster,
      dodgeIfSlower: RC.gnome.dodgeIfSlower,
      capBonusIfSlower: RC.gnome.capBonusIfSlower,
      critIfEqual: RC.gnome.critIfEqual,
      critDmgIfEqual: RC.gnome.critDmgIfEqual,
      dodgeIfEqual: RC.gnome.dodgeIfEqual,
      capBonusIfEqual: RC.gnome.capBonusIfEqual,
    },
  },
  Sirène: {
    id: 'chant_des_profondeurs',
    name: 'Chant des profondeurs',
    icon: V1_RACES.Sirène?.icon || '🧜',
    description: V1_RACES.Sirène?.bonus || '+10 CAP, stacks sur capacités reçues',
    stats: { cap: RC.sirene.cap },
    stackBonus: RC.sirene.stackBonus,
    maxStacks: RC.sirene.maxStacks,
  },
  Mindflayer: {
    id: 'vol_mental',
    name: 'Vol mental',
    icon: V1_RACES.Mindflayer?.icon || '🦑',
    description: V1_RACES.Mindflayer?.bonus || 'Copie la 1ʳᵉ capacité reçue (+5 % Cap)',
    stealSpellCapDamageScale: RC.mindflayer.stealSpellCapDamageScale,
  },
  Turtlekin: {
    id: 'carapace',
    name: 'Carapace',
    icon: V1_RACES.Turtlekin?.icon || '🐢',
    description: V1_RACES.Turtlekin?.bonus || '+8 DEF/ResC, 1ʳᵉ grosse frappe plafonnée',
    stats: { def: RC.turtlekin.def, rescap: RC.turtlekin.rescap },
    firstHitCapPercent: RC.turtlekin.firstHitCapPercent,
  },
  Écailleux: {
    id: 'lien_ecailles',
    name: 'Lien des écailles',
    icon: V1_RACES.Écailleux?.icon || '🐍',
    description: V1_RACES.Écailleux?.bonus || 'Lien VIT ↔ ResC',
    statLinkDivisor: RC.ecailleux.statLinkDivisorRacial,
  },
  Cendrés: {
    id: 'braises',
    name: 'Braises',
    icon: V1_RACES.Cendrés?.icon || '🔥',
    description: V1_RACES.Cendrés?.bonus || 'Braises selon PV perdus',
    hpDamageThreshold: RC.cendres.hpDamageThreshold,
    braisMultPerBraise: RC.cendres.braisMultPerBraiseRacial,
    guaranteedBraisesPerTurn: RC.cendres.guaranteedBraisesPerTurnRacial,
  },
};

export function getRacePassive(raceName) {
  return V2_RACE_PASSIVES[raceName] || null;
}

/** Bonus de stats plats (avant growth / lore). */
export function getRaceStatBonuses(raceName) {
  const p = getRacePassive(raceName);
  const out = { ...EMPTY_STATS };
  if (!p?.stats) return out;
  for (const key of Object.keys(out)) {
    out[key] = Number(p.stats[key]) || 0;
  }
  return out;
}

/** Lien Écailleux : appliqué une fois après merge des blocs. */
export function applyEcailleuxStatLink(stats, raceName) {
  if (raceName !== 'Écailleux') return stats;
  const div = V2_RACE_PASSIVES.Écailleux.statLinkDivisor || 3;
  const spd = Number(stats.spd) || 0;
  const rescap = Number(stats.rescap) || 0;
  return {
    ...stats,
    rescap: rescap + Math.floor(spd / div),
    spd: spd + Math.floor(rescap / div),
  };
}

export function isOrcFureurActive(combattant) {
  if (combattant?.race !== 'Orc') return false;
  const p = V2_RACE_PASSIVES.Orc;
  const max = combattant.maxHP || 1;
  return combattant.currentHP <= max * p.lowHpThreshold;
}

export function createEmptyRaceState() {
  return {
    revived: false,
    turtlekinUsed: false,
    mindflayerPending: null,
    mindflayerDone: false,
    sireneStacks: 0,
    cendresDamage: 0,
    cendresBank: 0,
    cendresPool: 0,
    cendresSpent: false,
  };
}

/** Chance de crit de base (+ race). */
export function getRaceCritChance(attacker, defender) {
  let chance = BASE_CRIT;
  if (attacker?.race === 'Elfe') {
    chance += V2_RACE_PASSIVES.Elfe.critBonus || 0;
  }
  if (attacker?.race === 'Gnome' && defender) {
    const d = V2_RACE_PASSIVES.Gnome.duel;
    const aSpd = attacker.base?.spd || 0;
    const dSpd = defender.base?.spd || 0;
    if (aSpd > dSpd) chance += d.critIfFaster;
    else if (aSpd < dSpd) {
      /* pas de crit bonus */
    } else chance += d.critIfEqual;
  }
  return Math.min(0.95, Math.max(0, chance));
}

export function getRaceCritDamageMult(attacker, defender) {
  let mult = CRIT_MULT;
  if (attacker?.race === 'Gnome' && defender) {
    const d = V2_RACE_PASSIVES.Gnome.duel;
    const aSpd = attacker.base?.spd || 0;
    const dSpd = defender.base?.spd || 0;
    if (aSpd > dSpd) mult += d.critDmgIfFaster;
    else if (aSpd === dSpd) mult += d.critDmgIfEqual;
  }
  return mult;
}

/** Esquive Gnome (0–1). */
export function getGnomeDodgeChance(defender, attacker) {
  if (defender?.race !== 'Gnome' || !attacker) return 0;
  const d = V2_RACE_PASSIVES.Gnome.duel;
  const aSpd = attacker.base?.spd || 0;
  const dSpd = defender.base?.spd || 0;
  if (dSpd < aSpd) return d.dodgeIfSlower;
  if (dSpd === aSpd) return d.dodgeIfEqual;
  return 0;
}

/** Multiplicateur sort/soin Gnome (CAP) + Sirène. */
export function getRaceSpellPowerMult(attacker, defender) {
  let m = 1;
  if (attacker?.race === 'Gnome' && defender) {
    const d = V2_RACE_PASSIVES.Gnome.duel;
    const aSpd = attacker.base?.spd || 0;
    const dSpd = defender.base?.spd || 0;
    if (aSpd < dSpd) m *= 1 + d.capBonusIfSlower;
    else if (aSpd === dSpd) m *= 1 + d.capBonusIfEqual;
  }
  if (attacker?.race === 'Sirène') {
    const stacks = attacker.raceState?.sireneStacks || 0;
    const p = V2_RACE_PASSIVES.Sirène;
    m *= 1 + stacks * p.stackBonus;
  }
  if (attacker?.race === 'Cendrés' && attacker.raceState && !attacker.raceState.cendresSpent) {
    const pool = attacker.raceState.cendresPool || 0;
    if (pool > 0) {
      m *= 1 + pool * V2_RACE_PASSIVES.Cendrés.braisMultPerBraise;
    }
  }
  return m;
}

export function consumeCendresBraisesIfNeeded(attacker, log) {
  if (attacker?.race !== 'Cendrés' || !attacker.raceState) return;
  if (attacker.raceState.cendresSpent) return;
  const pool = attacker.raceState.cendresPool || 0;
  if (pool <= 0) return;
  attacker.raceState.cendresSpent = true;
  attacker.raceState.cendresPool = 0;
  log.push(`🔥 ${attacker.name} consomme ${pool} braise(s).`);
}

export { BASE_CRIT, CRIT_MULT };
