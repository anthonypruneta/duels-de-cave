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
  bast: 4,  // Bastion - Charge du rempart
  alch: 1,  // Alchimiste - Cycle de flasques (chaque tour)
  sorc: 4,  // Sorcière - Malédiction (Hexe Noire : 3 via getMindflayerCapacityCooldown)
  berz: 4   // Berserk - Rage
};

// Constantes des classes (valeurs réelles utilisées dans le combat)
export const classConstants = {
  guerrier: {
    autoBonus: 7,          // +7 Auto quand la capacité est utilisée
    ignoreBase: 0.30,      // 30% ignore résistance de base
    ignorePerCap: 0.01     // +1% par point de Cap
  },
  voleur: {
    spdBonus: 5,           // +5 VIT
    critPerCap: 0.004      // +0.4% crit par point de Cap
  },
  paladin: {
    reflectBase: 0.45,     // 45% renvoi de base
    reflectPerCap: 0.006   // +0.6% par point de Cap
  },
  healer: {
    missingHpPercent: 0.25, // 25% des PV manquants
    capScale: 0.40          // 40% de la Cap
  },
  archer: {
    hitCount: 2,
    hit1AutoMultiplier: 1.0,  // Premier tir: 100% Auto
    hit2AutoMultiplier: 1.3,  // Second tir: 130% Auto
    hit2CapMultiplier: 0.2    // Second tir: +20% Cap
  },
  mage: {
    autoBase: 1.0,         // 100% de l'attaque de base
    capBase: 0.90,         // +90% de Cap
    capPerCap: 0           // Pas de scaling supplémentaire
  },
  demoniste: {
    capBase: 0.45,         // 45% de Cap
    capPerCap: 0,          // Pas de scaling supplémentaire
    ignoreResist: 0.45,    // Ignore 45% de la ResC
    stackPerAuto: 0.008    // +0,8% de Cap par auto (cumulable)
  },
  masochiste: {
    returnBase: 0.06,      // 6% des dégâts accumulés
    returnPerCap: 0.005,   // +0.5% par point de Cap
    healPercent: 0.10      // Heal 10% des dégâts accumulés
  },
  briseurSort: {
    shieldFromSpellDamage: 0.50,  // 50% des dégâts reçus en bouclier
    shieldFromCap: 0.30,          // +30% de CAP
    antiHealReduction: 0.20,      // Réduit soins adverses de 20%
    autoCapBonus: 0.15            // Auto + 15% CAP
  },
  succube: {
    capScale: 0.45,              // +45% CAP
    nextAttackReduction: 0.50   // -50% dégâts prochaine attaque adverse
  },
  bastion: {
    defPercentBonus: 0.08,       // Passif: +8% DEF
    startShieldFromDef: 0.30,    // Début combat: bouclier = 30% DEF
    capScale: 0.50,              // Inflige +50% CAP
    defScale: 0.50               // Inflige +50% DEF
  },
  alchimiste: {
    cycleLength: 3,              // 3 phases : feu, vie, acide
    fireCapScale: 0.10,          // Flasque de feu : Auto + 10% CAP
    lifeCapScale: 1.0,           // Flasque de vie (sans sous-classe / pré-éveil) : 100% de la Cap
    acidDefReduction: 0.10,      // Flasque d'acide : -10% DEF ennemi
    acidRescReduction: 0.10,     // Flasque d'acide : -10% ResC ennemi
    metalStunDuration: 1         // Flasque de métal (sous-classe) : stun 1 tour
  },
  sorciere: {
    curseStatReduction: 0.10,    // Malédiction : -10% (Enchanteresse : 15% via sous-classe)
    capBase: 0.80,               // Portion Cap dans la formule (comme le Mage)
    capPerCap: 0
  },
  berserk: {
    rageHpCostPercent: 0.10,     // Coût PV max par Rage
    rageMissingHpDamageScale: 0.35, // Bonus dégâts = scale × PV manquants (après coût)
    nextAutoDamageBonus: 0.20    // Brise-Caves : +20% sur la prochaine auto
  }
};

// Mapping nom de classe (affiché) → clé dans classConstants
const CLASS_NAME_TO_KEY = {
  'Guerrier': 'guerrier', 'Voleur': 'voleur', 'Paladin': 'paladin', 'Healer': 'healer',
  'Archer': 'archer', 'Mage': 'mage', 'Demoniste': 'demoniste', 'Masochiste': 'masochiste',
  'Briseur de Sort': 'briseurSort', 'Succube': 'succube', 'Bastion': 'bastion',
  'Alchimiste': 'alchimiste', 'Sorcière': 'sorciere', 'Berserk': 'berserk'
};

/**
 * Constantes des sous-classes (ratios liés à la CAP / capacités).
 * Overridables via la config d'équilibrage (Admin) comme classConstants.
 * Seules les clés présentes ici overrident la classe de base.
 */
export const subclassConstants = {
  maitre_armes: { capScale: 0.10 },                    // Auto + 10% CAP (ignore def/resC)
  duracier: { shieldAutoPercent: 0.25, shieldCapPercent: 0.008 }, // Bouclier 25% Auto + 0,8% CAP
  croise_lumineux: { nextAttackReduction: 0.30 },      // -30% dégâts prochaine attaque
  juge_implacable: { defReductionStack: 0.03 },        // -3% DEF ennemi par proc (stackable)
  sniper: { hit2AutoMultiplier: 1.40 },                // 2e tir 140% Auto
  chasseur_fantome: { ghostHunterCapBonus: 0.40 },     // +40% CAP après crit sur la capacité
  arcaniste_instable: { damageTakenStack: 0.06 },     // +5% dégâts subis (stackable)
  sorcier_neant: {},                                  // Brûlure (pas de ratio CAP overridable ici)
  maitre_invocateur: { capBase: 0.50, ignoreResist: 0.50, stackPerAuto: 0.008 },  // 50% Cap, 50% ignore, +1% Cap/auto
  pacte_sombre: { capBase: 0.50, ignoreResist: 0.45, stackPerAuto: 0.008, capStealPercent: 0.06 }, // 45% + vol 3% CAP
  stratege_arcanique: { nextSpellReduction: 0.40 },    // -30% dégâts prochain sort
  mentaliste: { defBonusStack: 0.08 },                 // +8% DEF (stackable)
  dompteuse_chair: { autoReductionStack: 0.09 },       // -6% Auto ennemi (stackable)
  ame_tentatrice: {},                                  // Crit alterné (pas de ratio)
  rempart_fer: { startShieldFromDef: 0.55 },           // Bouclier 55% DEF
  mur_implacable: {
    startShieldFromDef: 0.35,                          // Bouclier 35% DEF
    capScale: 0.55,                                    // Charge du Rempart: +55% CAP
    defScale: 0.55                                     // Charge du Rempart: +55% DEF
  },
  luxum: { capShieldPercent: 0.25 },                   // Bouclier 10% CAP au soin
  latum: { missingHpDamagePercent: 0.15 },             // 20% PV manquants en dégâts
  flagellant_sanglant: { defMultiplier: 0.80, autoMultiplier: 1.12 }, // -20% DEF, +12% Auto
  ecorche_fer: { defRescapStack: 0.03 },               // +3% DEF et ResC par Purge
  assassin: {},                                        // Crit garanti (pas de ratio)
  roublard: {},                                        // Vol stat (pas de ratio)
  maitre_alchimiste: { fireCapScale: 0.30, lifeCapScale: 1.3, acidDefReduction: 0.25, acidRescReduction: 0.25 }, // Maître : 130% Cap au soin (Alchimiste de métal : 100%, hérite de la base)
  alchimiste_metal: { cycleLength: 4 },                // 4 phases ; soin Vie = 100% Cap (comme la classe de base)
  hexe_noire: { sorcEffectiveCooldown: 3 },             // Malédiction CD 3 (override dans getMindflayerCapacityCooldown)
  enchanteresse: { curseStatReduction: 0.15, capBase: 1.0 },
  boucher: { rageMissingHpDamageScale: 0.50 },
  brise_caves: { rageMissingHpDamageScale: 0.35 }       // +20% prochaine auto : berserk.nextAutoDamageBonus
};

/**
 * Retourne les constantes de capacité effectives pour un combattant (classe + overrides sous-classe).
 * À utiliser en combat pour avoir les ratios réels (y compris overrides admin).
 */
export function getSubclassCapacityConstants(className, subclassId) {
  const classKey = CLASS_NAME_TO_KEY[className];
  const base = (classKey && classConstants[classKey]) ? { ...classConstants[classKey] } : {};
  if (!subclassId || !subclassConstants[subclassId]) return base;
  const overrides = subclassConstants[subclassId];
  return { ...base, ...overrides };
}

// Constantes des races
export const raceConstants = {
  humain: { hp: 10, auto: 1, def: 1, cap: 1, rescap: 1, spd: 1 },
  elfe: { auto: 1, cap: 1, spd: 5, critBonus: 0.20 },
  orc: { lowHpThreshold: 0.50, damageBonus: 1.20 },  // +20% sous 50% PV (base)
  nain: { hp: 10, def: 4 },
  dragonkin: { hp: 15, rescap: 15 },
  mortVivant: { revivePercent: 0.20 },
  lycan: { bleedPerHit: 1, bleedDivisor: 5, bleedPercentPerStack: 0.005 }, // 0.5% PV max par stack par tour (base)
  sylvari: { regenPercent: 0.02 },
  sirene: { cap: 10, stackBonus: 0.10, maxStacks: 3 },  // +10 CAP base
  gnome: { 
    critIfFaster: 0.20, critDmgIfFaster: 0.10,   // 10% dégâts crit (était 20%)
    dodgeIfSlower: 0.20, capBonusIfSlower: 0.20, 
    critIfEqual: 0.05, critDmgIfEqual: 0.05,     // égalité inchangé
    dodgeIfEqual: 0.05, capBonusIfEqual: 0.05, 
    spd: 5, cap: 5 
  },
  mindflayer: {
    stealSpellCapDamageScale: 0.05,      // Copie de la première capacité reçue: +5% CAP aux dégâts
    ownCooldownReductionTurns: 0,
    noCooldownSpellBonus: 0              // Bonus dégâts capacité sans CD: uniquement à l'éveil
  },
  turtlekin: {
    firstHitCapPercent: 0.10,            // Premier coup reçu capé à 10% PV max
    def: 8,
    rescap: 8
  },
  ecailleux: {
    /** % des VIT/ResC actuels à chaque dégât de capacité sur les PV (cumulable). */
    capacityRefStatPercent: 0.03,
    /** Lien VIT ↔ ResC une fois au calcul des stats (race Écailleux). */
    statLinkDivisorRacial: 3,
    /** Lien VIT/ResC du Pointeau ADN quand la race du fragment est Écailleux (1 pour 6). */
    statLinkDivisorPointeau: 6
  },
  /** Braises Cendrés : règles du bonus racial (sans éveil niveau 100). L’éveil surcharge via races.js. */
  cendres: {
    hpDamageThreshold: 0.10,
    braisMultPerBraiseRacial: 0.10,
    guaranteedBraisesPerTurnRacial: 1
  }
};

/** Fragment d’éveil fusionné : mécanique « braises » de base (hors éveil). */
export function getCendresRacialAwakeningFragment() {
  return {
    cendresHpDamageThreshold: raceConstants.cendres.hpDamageThreshold,
    cendresBraiseGuaranteedEachTurn: raceConstants.cendres.guaranteedBraisesPerTurnRacial,
    cendresBraiseSpellMult: raceConstants.cendres.braisMultPerBraiseRacial
  };
}

// Constantes générales
export const generalConstants = {
  baseCritChance: 0.10,    // 10% crit de base
  critMultiplier: 1.5,     // x1.5 dégâts crit (sauf Voleur)
  suddenDeathTurn: 30,     // Tour d'activation de la mort subite
  suddenDeathDamageBonus: 0.50,   // +50% dégâts en mort subite
  suddenDeathHealReduction: 0.50, // -50% soins en mort subite
};

// Fonctions utilitaires
export const dmgPhys = (auto, def) => Math.max(1, Math.round(auto - 0.5 * def));
export const dmgCap = (cap, rescap) => Math.max(1, Math.round(cap - 0.5 * rescap));

// Calcul du crit chance (identique à Combat.jsx)
export const getSpeedDuelBonuses = (attacker, defender) => {
  const bonuses = { crit: 0, critDamage: 0, dodge: 0, capBonus: 0 };
  if (!defender?.base) return bonuses;

  const aw = attacker?.awakening || {};
  const hasSpeedDuelFromAwakening =
    aw.speedDuelCritHigh != null ||
    aw.speedDuelDodgeLow != null ||
    aw.speedDuelEqualCrit != null;
  if (attacker?.race !== 'Gnome' && !hasSpeedDuelFromAwakening) return bonuses;

  const critIfFaster = aw.speedDuelCritHigh ?? raceConstants.gnome.critIfFaster;
  const critDmgIfFaster = aw.speedDuelCritDmgHigh ?? raceConstants.gnome.critDmgIfFaster;
  let dodgeIfSlower = aw.speedDuelDodgeLow ?? raceConstants.gnome.dodgeIfSlower;
  let capBonusIfSlower = aw.speedDuelCapBonusLow ?? aw.speedDuelCapBonusHigh ?? raceConstants.gnome.capBonusIfSlower;
  const critIfEqual = aw.speedDuelEqualCrit ?? raceConstants.gnome.critIfEqual;
  const critDmgIfEqual = aw.speedDuelEqualCritDmg ?? raceConstants.gnome.critDmgIfEqual;
  let dodgeIfEqual = aw.speedDuelEqualDodge ?? raceConstants.gnome.dodgeIfEqual;
  let capBonusIfEqual = aw.speedDuelEqualCapBonus ?? raceConstants.gnome.capBonusIfEqual;

  // Gnome éveillé : aligner sur la description (30 % / 10 %) si la config a encore les valeurs de base (20 % / 5 %)
  const hasAwakeningValues = aw.speedDuelCritHigh != null || aw.speedDuelDodgeLow != null;
  if (hasAwakeningValues) {
    if (dodgeIfSlower === 0.20) dodgeIfSlower = 0.30;
    if (capBonusIfSlower === 0.20) capBonusIfSlower = 0.30;
    if (dodgeIfEqual === 0.05) dodgeIfEqual = 0.10;
    if (capBonusIfEqual === 0.05) capBonusIfEqual = 0.10;
  }

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
  const weaponCritBonus =
    attacker?.weaponState?.isLegendary && attacker.weaponState.weaponId === 'dague_legendaire'
      ? weaponConstants.laevateinn.critDamageBonus
      : 0;
  return generalConstants.critMultiplier * (1 + bonus + speedDuelBonus + weaponCritBonus);
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
    case 'Turtlekin':
      b.def = raceConstants.turtlekin.def;
      b.rescap = raceConstants.turtlekin.rescap;
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
    healDamagePercent: 0.5,    // 50% des soins en dégâts bonus (le soin reste)
    regenPercent: 0.03,        // 3% HP max par tour (si pas de heal)
    healCritMultiplier: 1.5,   // Critiques de soin (Yggdrasil)
  },

  // Égide d'Athéna (Bouclier légendaire)
  egide: {
    defToAtkPercent: 0.06,    // 6% DEF → Auto
    rescapToAtkPercent: 0.06, // 6% RESC → Auto
  },

  // Zweihänder (Épée légendaire)
  zweihander: {
    triggerEveryNTurns: 4,
    damageBonus: 0.25,         // +25% dégâts
    priorityOverride: true,
  },

  // Lævateinn (Dague légendaire)
  laevateinn: {
    triggerEveryNTurns: 4,
    critDamageBonus: 0.20,    // +20% dégâts sur tous les crits (était 30%)
    guaranteedCrit: true,
  },

  // Mjöllnir (Marteau légendaire)
  mjollnir: {
    triggerEveryNAttacks: 6,
    stunDuration: 1,
  },

  // Gungnir (Lance légendaire)
  gungnir: {
    atkReductionPercent: 0.08, // -8% Auto ennemi au premier coup
  },

  // Arc des Cieux (Arc légendaire)
  arcCieux: {
    triggerEveryNTurns: 4,
    bonusAttacks: 1,
    bonusAttackDamage: 0.9,    // 90% des dégâts
  },

  // Codex Archon (Tome légendaire)
  codexArchon: {
    doubleCastEveryN: 2,       // Se déclenche toutes les 2 capacités (2e, 4e, 6e…)
    secondCastDamage: 0.9,      // 90% des dégâts/soins
  },

  // Fléau d'Anathème (Fléau légendaire) — Vague 2
  fleauAnatheme: {
    defReductionPercent: 0.15,   // -15% DEF ennemi au premier coup
    rescapReductionPercent: 0.15, // -15% ResC ennemi au premier coup
  },

  // Arbalète du Verdict (Arbalète légendaire) — Vague 2
  arbaleteVerdict: {
    spellDamageBonus: 1,         // +100% dégâts et soins sur les 2 premières capacités
    spellBonusCount: 2,          // Nombre de capacités bonus (bonus dégâts + pénalité CD uniquement sur ces 2)
    cooldownPenalty: 1,          // +1 CD uniquement sur les 2 premières capacités
  },

  // Labrys d'Arès (Hache légendaire) — Vague 2
  labrysAres: {
    initialBleedPercent: 0.025,  // 2.5% HP max par auto de la cible
    bleedDecayPercent: 0.01,     // Réduit de 1% par auto
    rawDamage: true,             // Dégâts bruts (ignorent DEF/ResC)
  },

  // Faux de Thanatos (Faux légendaire) — Vague 3
  fauxThanatos: {
    missingHpDamagePercent: 0.03, // 3% PV manquants de l'ennemi en dégâts bruts
    executeThreshold: 0.20,       // Seuil 20% PV
    executePercent: 0.05,         // 5% PV max en dégâts bruts (1 seule fois)
  },

  // Sceptre du Roi-Sorcier (Sceptre légendaire) — Vague 3
  sceptreRoiSorcier: {
    capStackPercent: 0.08,        // +8% CAP par capacité lancée
    maxCapStacks: 7,              // Max 7 stacks (+56%)
  },

  // Pendule de Chronos (Pendule légendaire) — Vague 3
  penduleChronos: {
    cdReduction: 1,               // -1 tour de CD
    cdBonusCount: 2,              // Sur les 2 premières capacités seulement
    spellBonus: 0.05,             // +5% dégâts/soins de toutes les capacités
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
    summonDamagePercent: 0.3,  // 30% Auto en dégâts bonus
    physicalReduction: 0.1,    // -10% dégâts physiques (passif)
  },

  // Dragon (Boss niveau 3)
  dragon: {
    abilityTrigger: 3,         // Tous les 3 tours
    breathDamagePercent: 0.8,  // 80% CAP en dégâts magiques
    enrageThreshold: 0.25,     // À 25% HP
    enrageStatBonus: 0.25,     // +25% Auto et CAP en enrage
    lowHpReduction: 0.15,      // -15% dégâts sous 30% HP (passif)
    lowHpThreshold: 0.3,
  },
};

// ============================================================================
// CLASSES QUI PEUVENT SE SOIGNER (pour Branche d'Yggdrasil)
// ============================================================================
export const healingClasses = ['Healer', 'Masochiste', 'Alchimiste'];
