// Mécaniques de combat centralisées
// Ce fichier est la source unique de vérité pour tous les calculs de combat

// Cooldowns des classes (en tours)
export const cooldowns = {
  war: 3,   // Guerrier - Frappe pénétrante
  rog: 4,   // Voleur - Esquive
  pal: 2,   // Paladin - Riposte
  heal: 4,  // Healer - Soin puissant
  arc: 3,   // Archer - Tir multiple
  mag: 3,   // Mage - Sort magique
  dem: 1,   // Demoniste - Familier (chaque tour)
  maso: 4   // Masochiste - Renvoi dégâts
};

// Constantes des classes (valeurs réelles utilisées dans le combat)
export const classConstants = {
  guerrier: {
    autoBonus: 3,
    ignoreBase: 0.12,      // 12% ignore résistance de base
    ignorePerTier: 0.02    // +2% par palier de 15 Cap
  },
  voleur: {
    spdBonus: 5,
    critPerTier: 0.05      // +5% crit par palier (dans calcCritChance)
  },
  paladin: {
    reflectBase: 0.40,     // 40% renvoi de base
    reflectPerTier: 0.05   // +5% par palier
  },
  healer: {
    missingHpPercent: 0.15, // 15% des PV manquants
    capBase: 0.25,          // 25% de Cap de base
    capPerTier: 0.05        // +5% par palier
  },
  archer: {
    arrowsBase: 1,         // 1 flèche de base
    arrowsPerTier: 1       // +1 flèche par palier
  },
  mage: {
    capBase: 0.40,         // 40% de Cap de base
    capPerTier: 0.05       // +5% par palier
  },
  demoniste: {
    capBase: 0.20,         // 20% de Cap de base (pour calcul dégâts)
    capPerTier: 0.04,      // +4% par palier
    ignoreResist: 0.60     // Ignore 60% de la ResC
  },
  masochiste: {
    returnBase: 0.15,      // 15% des dégâts accumulés
    returnPerTier: 0.03,   // +3% par palier
    healPercent: 0.10      // Heal 10% des dégâts encaissés
  }
};

// Constantes des races
export const raceConstants = {
  humain: { hp: 10, auto: 1, def: 1, cap: 1, rescap: 1, spd: 1 },
  elfe: { auto: 1, cap: 1, spd: 5, critBonus: 0.20 },
  orc: { lowHpThreshold: 0.50, damageBonus: 1.20 },
  nain: { hp: 10, def: 4 },
  dragonkin: { hp: 10, rescap: 15 },
  mortVivant: { revivePercent: 0.20 },
  lycan: { bleedPerHit: 1, bleedDivisor: 3 },
  sylvari: { regenPercent: 0.02 }
};

// Constantes générales
export const generalConstants = {
  baseCritChance: 0.10,    // 10% crit de base
  critMultiplier: 1.5,     // x1.5 dégâts crit (sauf Voleur)
  maxTurns: 30,            // Maximum de tours par combat
  tierThreshold: 15        // Seuil pour les paliers de Cap
};

// Fonctions utilitaires
export const tiers15 = (cap) => Math.floor(cap / generalConstants.tierThreshold);
export const dmgPhys = (auto, def) => Math.max(1, Math.round(auto - 0.5 * def));
export const dmgCap = (cap, rescap) => Math.max(1, Math.round(cap - 0.5 * rescap));

// Calcul du crit chance (identique à Combat.jsx)
export const calcCritChance = (attacker) => {
  let c = generalConstants.baseCritChance;
  if (attacker.class === 'Voleur') c += 0.05 * tiers15(attacker.base.cap);
  if (attacker.race === 'Elfe') c += raceConstants.elfe.critBonus;
  return c;
};

// Bonus de stats par race
export const getRaceBonus = (race) => {
  const b = { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 };
  switch (race) {
    case 'Humain':
      b.hp = raceConstants.humain.hp;
      b.auto = raceConstants.humain.auto;
      b.def = raceConstants.humain.def;
      b.cap = raceConstants.humain.cap;
      b.rescap = raceConstants.humain.rescap;
      b.spd = raceConstants.humain.spd;
      break;
    case 'Elfe':
      b.auto = raceConstants.elfe.auto;
      b.cap = raceConstants.elfe.cap;
      b.spd = raceConstants.elfe.spd;
      break;
    case 'Nain':
      b.hp = raceConstants.nain.hp;
      b.def = raceConstants.nain.def;
      break;
    case 'Dragonkin':
      b.hp = raceConstants.dragonkin.hp;
      b.rescap = raceConstants.dragonkin.rescap;
      break;
  }
  return b;
};

// Bonus de stats par classe
export const getClassBonus = (charClass) => {
  const b = { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 };
  switch (charClass) {
    case 'Voleur':
      b.spd = classConstants.voleur.spdBonus;
      break;
    case 'Guerrier':
      b.auto = classConstants.guerrier.autoBonus;
      break;
  }
  return b;
};
