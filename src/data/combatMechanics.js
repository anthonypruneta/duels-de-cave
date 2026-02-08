// Mécaniques de combat centralisées
// Ce fichier est la source unique de vérité pour tous les calculs de combat.

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
    ignoreBase: 0.10,      // 10% ignore résistance de base
    ignorePerCap: 0.01     // +1% par point de Cap
  },
  voleur: {
    spdBonus: 5,
    critPerCap: 0.01       // +1% crit par point de Cap
  },
  paladin: {
    reflectBase: 0.40,     // 40% renvoi de base
    reflectPerCap: 0.01    // +1% par point de Cap
  },
  healer: {
    missingHpPercent: 0.15, // 15% des PV manquants
    capScale: 0.35          // 35% de la Cap
  },
  archer: {
    hitCount: 2,
    hit2AutoMultiplier: 1.30,
    hit2CapMultiplier: 0.25
  },
  mage: {
    capBase: 0.43,         // 43% de Cap de base
    capPerCap: 0
  },
  demoniste: {
    capBase: 0.50,         // 50% de Cap de base (pour calcul dégâts)
    capPerCap: 0,
    ignoreResist: 1.0,     // Ignore 100% de la ResC
    stackPerAuto: 0.03     // +3% de Cap par auto du Demoniste (cumulable)
  },
  masochiste: {
    returnBase: 0.15,      // 15% des dégâts accumulés
    returnPerCap: 0.02,    // +2% par point de Cap
    healPercent: 0.50      // Heal 50% des dégâts encaissés
  }
};

// Constantes des races
export const raceConstants = {
  humain: { hp: 10, auto: 1, def: 1, cap: 1, rescap: 1, spd: 1 },
  elfe: { auto: 1, cap: 1, spd: 5, critBonus: 0.20 },
  orc: { lowHpThreshold: 0.50, damageBonus: 1.20 },
  nain: { hp: 10, def: 4 },
  dragonkin: { hp: 15, rescap: 15 },
  mortVivant: { revivePercent: 0.20 },
  lycan: { bleedPerHit: 1, bleedDivisor: 3 },
  sylvari: { regenPercent: 0.02 }
};

// Constantes générales
export const generalConstants = {
  baseCritChance: 0.10,    // 10% crit de base
  critMultiplier: 1.5,     // x1.5 dégâts crit (sauf Voleur)
  maxTurns: 30,            // Maximum de tours par combat
};

// Fonctions utilitaires
export const dmgPhys = (auto, def) => Math.max(1, Math.round(auto - 0.5 * def));
export const dmgCap = (cap, rescap) => Math.max(1, Math.round(cap - 0.5 * rescap));

// Calcul du crit chance (identique à Combat.jsx)
export const calcCritChance = (attacker) => {
  let c = generalConstants.baseCritChance;
  if (attacker.class === 'Voleur') c += classConstants.voleur.critPerCap * attacker.base.cap;
  if (attacker.race === 'Elfe') c += raceConstants.elfe.critBonus;
  if (attacker?.awakening?.critChanceBonus) c += attacker.awakening.critChanceBonus;
  return c;
};

export const getCritMultiplier = (attacker) => {
  const bonus = attacker?.awakening?.critDamageBonus ?? 0;
  return generalConstants.critMultiplier * (1 + bonus);
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

// ============================================================================
// CONSTANTES DES ARMES LÉGENDAIRES
// ============================================================================
export const weaponConstants = {
  // Branche d'Yggdrasil (Bâton légendaire)
  yggdrasil: {
    healDamagePercent: 0.5,    // 50% des soins en dégâts
    regenPercent: 0.03,        // 3% HP max par tour (si pas de heal)
  },

  // Égide d'Athéna (Bouclier légendaire)
  egide: {
    defToAtkPercent: 0.1,     // 10% DEF → ATK
    rescapToAtkPercent: 0.1,  // 10% RESC → ATK
  },

  // Zweihänder (Épée légendaire)
  zweihander: {
    triggerEveryNTurns: 4,
    damageBonus: 0.3,          // +30% dégâts
    priorityOverride: true,
  },

  // Lævateinn (Dague légendaire)
  laevateinn: {
    triggerEveryNTurns: 4,
    critDamageBonus: 0.3,      // +30% dégâts sur tous les crits
    guaranteedCrit: true,
  },

  // Mjöllnir (Marteau légendaire)
  mjollnir: {
    triggerEveryNAttacks: 5,
    stunDuration: 1,
  },

  // Gungnir (Lance légendaire)
  gungnir: {
    atkReductionPercent: 0.1,  // -10% ATK ennemi au premier coup
  },

  // Arc des Cieux (Arc légendaire)
  arcCieux: {
    triggerEveryNTurns: 4,
    bonusAttacks: 1,
    bonusAttackDamage: 0.5,    // 50% des dégâts
  },

  // Codex Archon (Tome légendaire)
  codexArchon: {
    doubleCastTriggers: [2, 6], // Se déclenche au 2e et 6e sort
    secondCastDamage: 0.7,      // 70% des dégâts
  },
};

// ============================================================================
// CONSTANTES DES BOSS
// ============================================================================
export const bossConstants = {
  // Modificateurs de stats par niveau de donjon
  statModifiers: {
    niveau_1: 0.5,  // 50% des stats du joueur
    niveau_2: 1.0,  // 100% des stats du joueur
    niveau_3: 1.5,  // 150% des stats du joueur
  },

  // Bandit (Boss niveau 1)
  bandit: {
    abilityTrigger: 3,         // Tous les 3 tours
    damageBonus: 0.2,          // +20% dégâts
  },

  // Chef Gobelin (Boss niveau 2)
  chefGobelin: {
    abilityTrigger: 4,         // Tous les 4 tours
    summonDamagePercent: 0.3,  // 30% ATK en dégâts bonus
    physicalReduction: 0.1,    // -10% dégâts physiques (passif)
  },

  // Dragon (Boss niveau 3)
  dragon: {
    abilityTrigger: 3,         // Tous les 3 tours
    breathDamagePercent: 0.8,  // 80% CAP en dégâts magiques
    enrageThreshold: 0.25,     // À 25% HP
    enrageStatBonus: 0.25,     // +25% ATK et CAP en enrage
    lowHpReduction: 0.15,      // -15% dégâts sous 30% HP (passif)
    lowHpThreshold: 0.3,
  },
};

// ============================================================================
// CLASSES QUI PEUVENT SE SOIGNER (pour Branche d'Yggdrasil)
// ============================================================================
export const healingClasses = ['Healer', 'Paladin'];
