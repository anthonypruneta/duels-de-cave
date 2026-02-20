// Mécaniques de combat centralisées
// Ce fichier est la source unique de vérité pour tous les calculs de combat.
// Si tu modifies ce fichier (équilibrage) : incrémenter BALANCE_CONFIG_VERSION dans src/services/balanceConfigService.js.

// Cooldowns des classes (en tours)
export const cooldowns = {
  war: 3,   // Guerrier - Frappe pénétrante
  rog: 4,   // Voleur - Esquive
  pal: 2,   // Paladin - Riposte
  heal: 4,  // Healer - Soin puissant
  arc: 3,   // Archer - Tir multiple
  mag: 3,   // Mage - Sort magique
  dem: 1,   // Demoniste - Familier (chaque tour)
  maso: 4,  // Masochiste - Renvoi dégâts
  succ: 4,  // Succube - Coup de fouet
  bast: 4   // Bastion - Charge du rempart
};

// Constantes des classes (valeurs réelles utilisées dans le combat)
export const classConstants = {
  guerrier: {
    autoBonus: 5,          // +5 ATK quand le sort est utilisé
    ignoreBase: 0.25,      // 25% ignore résistance de base
    ignorePerCap: 0.01     // +1% par point de Cap
  },
  voleur: {
    spdBonus: 5,           // +5 VIT
    critPerCap: 0.01       // +1.0% crit par point de Cap
  },
  paladin: {
    reflectBase: 0.50,     // 50% renvoi de base
    reflectPerCap: 0.008   // +0.8% par point de Cap
  },
  healer: {
    missingHpPercent: 0.25, // 25% des PV manquants
    capScale: 0.40          // 40% de la Cap
  },
  archer: {
    hitCount: 2,
    hit1AutoMultiplier: 1.0,  // Premier tir: 100% Auto
    hit2AutoMultiplier: 1.3,  // Second tir: 130% Auto
    hit2CapMultiplier: 0.2    // Second tir: +20% Cap (vs ResC)
  },
  mage: {
    autoBase: 1.0,         // 100% de l'attaque de base
    capBase: 0.80,         // +80% de Cap (vs ResC)
    capPerCap: 0           // Pas de scaling supplémentaire
  },
  demoniste: {
    capBase: 0.45,         // 45% de Cap
    capPerCap: 0,          // Pas de scaling supplémentaire
    ignoreResist: 0.45,    // Ignore 45% de la ResC
    stackPerAuto: 0.008    // +0.8% de Cap par auto (cumulable)
  },
  masochiste: {
    returnBase: 0.09,      // 9% des dégâts accumulés
    returnPerCap: 0.005,   // +0.5% par point de Cap
    healPercent: 0.15      // Heal 15% des dégâts accumulés
  },
  briseurSort: {
    shieldFromSpellDamage: 0.40,  // 40% des dégâts reçus en bouclier
    shieldFromCap: 0.25,          // +25% de CAP
    antiHealReduction: 0.20,      // Réduit soins adverses de 20%
    autoCapBonus: 0.10            // Auto + 10% CAP
  },
  succube: {
    capScale: 0.35,              // +35% CAP
    nextAttackReduction: 0.50   // -50% dégâts prochaine attaque adverse
  },
  bastion: {
    defPercentBonus: 0.08,       // Passif: +8% DEF
    startShieldFromDef: 0.30,    // Début combat: bouclier = 30% DEF
    capScale: 0.50,              // Inflige +50% CAP
    defScale: 0.50               // Inflige +50% DEF
  }
};

// Constantes des races
export const raceConstants = {
  humain: { hp: 10, auto: 1, def: 1, cap: 1, rescap: 1, spd: 1 },
  elfe: { auto: 1, cap: 1, spd: 5, critBonus: 0.20 },
  orc: { lowHpThreshold: 0.50, damageBonus: 1.20 },  // +20% sous 50% PV (base)
  nain: { hp: 10, def: 4 },
  dragonkin: { hp: 15, rescap: 15 },
  mortVivant: { revivePercent: 0.20 },
  lycan: { bleedPerHit: 1, bleedDivisor: 5 },
  sylvari: { regenPercent: 0.02 },
  sirene: { cap: 10, stackBonus: 0.10, maxStacks: 3 },  // +10 CAP base
  gnome: { 
    critIfFaster: 0.20, critDmgIfFaster: 0.20, 
    dodgeIfSlower: 0.20, capBonusIfSlower: 0.20, 
    critIfEqual: 0.05, critDmgIfEqual: 0.05, 
    dodgeIfEqual: 0.05, capBonusIfEqual: 0.05, 
    spd: 5, cap: 5 
  },
  mindflayer: {
    stealSpellCapDamageScale: 0.05,      // +5% de CAP aux dégâts (base)
    ownCooldownReductionTurns: 0,
    noCooldownSpellBonus: 0.05           // Sort sans CD: +5% dégâts (base)
  }
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
export const getSpeedDuelBonuses = (attacker, defender) => {
  const bonuses = { crit: 0, critDamage: 0, dodge: 0, capBonus: 0 };
  if (attacker?.race !== 'Gnome' || !defender?.base) return bonuses;

  const aw = attacker?.awakening || {};
  const critIfFaster = aw.speedDuelCritHigh ?? raceConstants.gnome.critIfFaster;
  const critDmgIfFaster = aw.speedDuelCritDmgHigh ?? raceConstants.gnome.critDmgIfFaster;
  const dodgeIfSlower = aw.speedDuelDodgeLow ?? raceConstants.gnome.dodgeIfSlower;
  const capBonusIfSlower = aw.speedDuelCapBonusLow ?? aw.speedDuelCapBonusHigh ?? raceConstants.gnome.capBonusIfSlower;
  const critIfEqual = aw.speedDuelEqualCrit ?? raceConstants.gnome.critIfEqual;
  const critDmgIfEqual = aw.speedDuelEqualCritDmg ?? raceConstants.gnome.critDmgIfEqual;
  const dodgeIfEqual = aw.speedDuelEqualDodge ?? raceConstants.gnome.dodgeIfEqual;
  const capBonusIfEqual = aw.speedDuelEqualCapBonus ?? raceConstants.gnome.capBonusIfEqual;

  if (attacker.base.spd > defender.base.spd) {
    bonuses.crit += critIfFaster;
    bonuses.critDamage += critDmgIfFaster;
  } else if (attacker.base.spd < defender.base.spd) {
    bonuses.dodge += dodgeIfSlower;
    bonuses.capBonus += capBonusIfSlower;
  } else {
    bonuses.crit += critIfEqual;
    bonuses.critDamage += critDmgIfEqual;
    bonuses.dodge += dodgeIfEqual;
    bonuses.capBonus += capBonusIfEqual;
  }

  return bonuses;
};

export const calcCritChance = (attacker, defender = null) => {
  let c = generalConstants.baseCritChance;
  if (attacker.class === 'Voleur') c += classConstants.voleur.critPerCap * attacker.base.cap;
  if (attacker.race === 'Elfe' && !attacker?.awakening) c += raceConstants.elfe.critBonus;
  if (attacker?.awakening?.critChanceBonus) c += attacker.awakening.critChanceBonus;
  c += getSpeedDuelBonuses(attacker, defender).crit;
  return c;
};

export const getCritMultiplier = (attacker, defender = null) => {
  const bonus = attacker?.awakening?.critDamageBonus ?? 0;
  const speedDuelBonus = getSpeedDuelBonuses(attacker, defender).critDamage;
  return generalConstants.critMultiplier * (1 + bonus + speedDuelBonus);
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
    case 'Gnome':
      b.spd = raceConstants.gnome.spd;
      b.cap = raceConstants.gnome.cap;
      break;
    case 'Sirène':
      b.cap = raceConstants.sirene.cap;
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
    case 'Bastion':
      b.def = 3;
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
    healDamagePercent: 0.5,    // 50% des soins en dégâts bonus (le soin reste)
    regenPercent: 0.03,        // 3% HP max par tour (si pas de heal)
    healCritMultiplier: 1.5,   // Critiques de soin (Yggdrasil)
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
    doubleCastTriggers: [2, 4], // Se déclenche au 2e et 4e sort
    secondCastDamage: 0.7,      // 70% des dégâts/soins
  },

  // Fléau d'Anathème (Fléau légendaire) — Vague 2
  fleauAnatheme: {
    defReductionPercent: 0.15,   // -15% DEF ennemi au premier coup
    rescapReductionPercent: 0.15, // -15% ResC ennemi au premier coup
  },

  // Arbalète du Verdict (Arbalète légendaire) — Vague 2
  arbaleteVerdict: {
    spellDamageBonus: 0.7,       // +70% dégâts sur les 2 premiers sorts
    spellBonusCount: 2,          // Nombre de sorts bonus
    cooldownPenalty: 1,          // +1 CD sur tous les sorts
  },

  // Labrys d'Arès (Hache légendaire) — Vague 2
  labrysAres: {
    initialBleedPercent: 0.03,   // 3% HP max par auto de la cible
    bleedDecayPercent: 0.01,     // Réduit de 1% par auto
    rawDamage: true,             // Dégâts bruts (ignorent DEF/ResC)
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
export const healingClasses = ['Healer', 'Masochiste'];
