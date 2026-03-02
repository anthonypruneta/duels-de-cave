/**
 * Système d'armes - Duels de Cave
 *
 * 8 familles d'armes × 3 raretés = 24 armes
 * Raretés: commune, rare, légendaire
 *
 * Stats: auto (Auto), def (DEF), rescap (RESC), spd (VIT), hp (HP), cap (CAP)
 *
 * Les armes légendaires ont un effet spécial avec un trigger.
 */

// ============================================================================
// TYPES DE TRIGGERS POUR LES EFFETS LÉGENDAIRES
// ============================================================================
export const TRIGGER_TYPES = {
  EVERY_N_TURNS: 'every_n_turns',       // Tous les N tours
  EVERY_N_ATTACKS: 'every_n_attacks',   // Toutes les N attaques
  EVERY_N_SPELLS: 'every_n_spells',     // Tous les N capacités lancées
  FIRST_HIT: 'first_hit',               // Premier coup du combat
  PASSIVE: 'passive',                   // Effet passif permanent
  ON_HEAL: 'on_heal',                   // Quand le personnage se soigne
};

// ============================================================================
// RARETÉS
// ============================================================================
export const RARITY = {
  COMMUNE: 'commune',
  RARE: 'rare',
  LEGENDAIRE: 'légendaire',
};

export const RARITY_COLORS = {
  [RARITY.COMMUNE]: 'text-stone-400',
  [RARITY.RARE]: 'text-blue-400',
  [RARITY.LEGENDAIRE]: 'text-amber-400',
};

export const RARITY_BG_COLORS = {
  [RARITY.COMMUNE]: 'bg-stone-700/50',
  [RARITY.RARE]: 'bg-blue-900/50',
  [RARITY.LEGENDAIRE]: 'bg-amber-900/50',
};

export const RARITY_BORDER_COLORS = {
  [RARITY.COMMUNE]: 'border-stone-500',
  [RARITY.RARE]: 'border-blue-500',
  [RARITY.LEGENDAIRE]: 'border-amber-500',
};

// ============================================================================
// FAMILLES D'ARMES
// ============================================================================
export const WEAPON_FAMILIES = {
  BATON: 'baton',
  BOUCLIER: 'bouclier',
  EPEE: 'epee',
  DAGUE: 'dague',
  MARTEAU: 'marteau',
  LANCE: 'lance',
  ARC: 'arc',
  TOME: 'tome',
  FLEAU: 'fleau',
  ARBALETE: 'arbalete',
  HACHE: 'hache',
};

// ============================================================================
// SYSTÈME DE VAGUES (activation progressive du contenu)
// ============================================================================
// Vague 1 : contenu initial (toujours actif)
// Vague 2 : nouvelles armes/passifs post-tournoi S2
const WAVE_ACTIVATION_DATES = {
  1: null, // Toujours actif
  2: new Date('2026-02-21T22:00:00+01:00'), // Samedi 21 février 2026, 22h Paris
};

/**
 * Vérifie si une vague de contenu est active
 */
export function isWaveActive(wave) {
  if (!wave || wave === 1) return true;
  const activationDate = WAVE_ACTIVATION_DATES[wave];
  if (!activationDate) return false;
  return new Date() >= activationDate;
}

// ============================================================================
// DÉFINITION DES 24 ARMES
// ============================================================================
export const weapons = {
  // =========================================================================
  // A. BÂTONS
  // =========================================================================
  baton_commun: {
    id: 'baton_commun',
    nom: 'Bâton',
    famille: WEAPON_FAMILIES.BATON,
    rarete: RARITY.COMMUNE,
    icon: '🪄',
    imageFile: 'baton1.png',
    stats: {
      cap: 3,
      hp: 5,
    },
    effet: null,
    description: 'Un simple bâton de bois, utile pour canaliser la magie.',
  },

  baton_rare: {
    id: 'baton_rare',
    nom: 'Bâton de soin',
    famille: WEAPON_FAMILIES.BATON,
    rarete: RARITY.RARE,
    icon: '🪄',
    imageFile: 'baton2.png',
    stats: {
      cap: 5,
      hp: 10,
    },
    effet: null,
    description: 'Un bâton imprégné de magie curative.',
  },

  baton_legendaire: {
    id: 'baton_legendaire',
    nom: 'Branche d\'Yggdrasil',
    famille: WEAPON_FAMILIES.BATON,
    rarete: RARITY.LEGENDAIRE,
    icon: '🌳',
    imageFile: 'baton3.png',
    stats: {
      cap: 5,
      hp: 10,
    },
    effet: {
      nom: 'Vie de l\'Arbre-Monde',
      description: 'Si le personnage peut se soigner, ses soins peuvent crit, sont conservés et infligent aussi 50% de dégâts. Sinon, régénère 3% HP max par tour.',
      trigger: {
        type: TRIGGER_TYPES.PASSIVE,
        // La logique vérifie si la classe peut heal (Healer, Paladin avec riposte qui heal, etc.)
      },
      values: {
        healDamagePercent: 0.5,    // 50% des soins en dégâts
        regenPercent: 0.03,        // 3% HP max par tour
        healCritMultiplier: 1.5,   // Critiques de soin
      },
    },
    description: 'Une branche de l\'arbre cosmique, source de toute vie.',
  },

  // =========================================================================
  // B. BOUCLIERS
  // =========================================================================
  bouclier_commun: {
    id: 'bouclier_commun',
    nom: 'Bouclier',
    famille: WEAPON_FAMILIES.BOUCLIER,
    rarete: RARITY.COMMUNE,
    icon: '🛡️',
    imageFile: 'bouclier1.png',
    stats: {
      def: 3,
      rescap: 3,
    },
    effet: null,
    description: 'Un bouclier de bois renforcé de fer.',
  },

  bouclier_rare: {
    id: 'bouclier_rare',
    nom: 'Bouclier de Fer',
    famille: WEAPON_FAMILIES.BOUCLIER,
    rarete: RARITY.RARE,
    icon: '🛡️',
    imageFile: 'bouclier2.png',
    stats: {
      def: 5,
      rescap: 5,
    },
    effet: null,
    description: 'Un solide bouclier entièrement forgé en fer.',
  },

  bouclier_legendaire: {
    id: 'bouclier_legendaire',
    nom: 'Égide d\'Athéna',
    famille: WEAPON_FAMILIES.BOUCLIER,
    rarete: RARITY.LEGENDAIRE,
    icon: '⚔️',
    imageFile: 'bouclier3.png',
    stats: {
      def: 5,
      rescap: 5,
    },
    effet: {
      nom: 'Protection Divine',
      description: 'Ajoute 10% de la DEF et 10% de la RESC à l\'Auto.',
      trigger: {
        type: TRIGGER_TYPES.PASSIVE,
      },
      values: {
        defToAtkPercent: 0.1,    // 10% DEF → Auto
        rescapToAtkPercent: 0.1, // 10% RESC → Auto
      },
    },
    description: 'Le bouclier légendaire de la déesse de la guerre.',
  },

  // =========================================================================
  // C. ÉPÉES
  // =========================================================================
  epee_commune: {
    id: 'epee_commune',
    nom: 'Épée',
    famille: WEAPON_FAMILIES.EPEE,
    rarete: RARITY.COMMUNE,
    icon: '⚔️',
    imageFile: 'epee1.png',
    stats: {
      auto: 3,
    },
    effet: null,
    description: 'Une épée à une main, bien équilibrée.',
  },

  epee_rare: {
    id: 'epee_rare',
    nom: 'Épée lourde',
    famille: WEAPON_FAMILIES.EPEE,
    rarete: RARITY.RARE,
    icon: '⚔️',
    imageFile: 'epee2.png',
    stats: {
      auto: 5,
    },
    effet: null,
    description: 'Une épée massive qui frappe fort.',
  },

  epee_legendaire: {
    id: 'epee_legendaire',
    nom: 'Zweihänder',
    famille: WEAPON_FAMILIES.EPEE,
    rarete: RARITY.LEGENDAIRE,
    icon: '🗡️',
    imageFile: 'epee3.png',
    stats: {
      auto: 10,
      spd: -10,
    },
    effet: {
      nom: 'Frappe Dévastatrice',
      description: 'Tous les 4 tours, frappe en premier et inflige +30% de dégâts.',
      trigger: {
        type: TRIGGER_TYPES.EVERY_N_TURNS,
        n: 4,
      },
      values: {
        damageBonus: 0.3,         // +30% dégâts
        priorityOverride: true,   // Frappe en premier
      },
    },
    description: 'Une épée à deux mains d\'origine germanique, dévastatrice.',
  },

  // =========================================================================
  // D. DAGUES
  // =========================================================================
  dague_commune: {
    id: 'dague_commune',
    nom: 'Dague',
    famille: WEAPON_FAMILIES.DAGUE,
    rarete: RARITY.COMMUNE,
    icon: '🗡️',
    imageFile: 'dague1.png',
    stats: {
      auto: 2,
      spd: 2,
    },
    effet: null,
    description: 'Une dague rapide et maniable.',
  },

  dague_rare: {
    id: 'dague_rare',
    nom: 'Dague dentelée',
    famille: WEAPON_FAMILIES.DAGUE,
    rarete: RARITY.RARE,
    icon: '🗡️',
    imageFile: 'dague2.png',
    stats: {
      auto: 4,
      spd: 4,
    },
    effet: null,
    description: 'Une dague aux lames dentelées qui déchire les chairs.',
  },

  dague_legendaire: {
    id: 'dague_legendaire',
    nom: 'Lævateinn',
    famille: WEAPON_FAMILIES.DAGUE,
    rarete: RARITY.LEGENDAIRE,
    icon: '🔥',
    imageFile: 'dague3.png',
    stats: {
      auto: 4,
      spd: 4,
    },
    effet: {
      nom: 'Flamme de Surtr',
      description: 'Tous les 4 tours, critique garanti. Tous les critiques infligent +20% de dégâts.',
      trigger: {
        type: TRIGGER_TYPES.EVERY_N_TURNS,
        n: 4,
      },
      values: {
        guaranteedCrit: true,     // Crit garanti tous les 4 tours
        critDamageBonus: 0.20,    // +20% sur TOUS les crits (était 30%)
      },
    },
    description: 'La dague enflammée du géant Surtr, annonciatrice du Ragnarök.',
  },

  // =========================================================================
  // E. MARTEAUX
  // =========================================================================
  marteau_commun: {
    id: 'marteau_commun',
    nom: 'Marteau',
    famille: WEAPON_FAMILIES.MARTEAU,
    rarete: RARITY.COMMUNE,
    icon: '🔨',
    imageFile: 'marteau1.png',
    stats: {
      auto: 3,
      spd: -2,
    },
    effet: null,
    description: 'Un marteau de guerre lourd mais puissant.',
  },

  marteau_rare: {
    id: 'marteau_rare',
    nom: 'Marteau de guerre',
    famille: WEAPON_FAMILIES.MARTEAU,
    rarete: RARITY.RARE,
    icon: '🔨',
    imageFile: 'marteau2.png',
    stats: {
      auto: 6,
      spd: -3,
    },
    effet: null,
    description: 'Un imposant marteau forgé pour la bataille.',
  },

  marteau_legendaire: {
    id: 'marteau_legendaire',
    nom: 'Mjöllnir',
    famille: WEAPON_FAMILIES.MARTEAU,
    rarete: RARITY.LEGENDAIRE,
    icon: '⚡',
    imageFile: 'marteau3.png',
    stats: {
      auto: 8,
      spd: -3,
    },
    effet: {
      nom: 'Tonnerre Divin',
      description: 'Toutes les 5 attaques, étourdit l\'ennemi pendant 1 tour.',
      trigger: {
        type: TRIGGER_TYPES.EVERY_N_ATTACKS,
        n: 5,
      },
      values: {
        stunDuration: 1,          // 1 tour de stun
      },
    },
    description: 'Le marteau de Thor, capable de déchaîner la foudre.',
  },

  // =========================================================================
  // F. LANCES
  // =========================================================================
  lance_commune: {
    id: 'lance_commune',
    nom: 'Lance',
    famille: WEAPON_FAMILIES.LANCE,
    rarete: RARITY.COMMUNE,
    icon: '🔱',
    imageFile: 'lance1.png',
    stats: {
      auto: 3,
      spd: 1,
    },
    effet: null,
    description: 'Une lance d\'infanterie, alliant portée et vitesse.',
  },

  lance_rare: {
    id: 'lance_rare',
    nom: 'Hasta royale',
    famille: WEAPON_FAMILIES.LANCE,
    rarete: RARITY.RARE,
    icon: '🔱',
    imageFile: 'lance2.png',
    stats: {
      auto: 5,
      spd: 2,
    },
    effet: null,
    description: 'Une lance de cérémonie romaine, redoutable au combat.',
  },

  lance_legendaire: {
    id: 'lance_legendaire',
    nom: 'Gungnir',
    famille: WEAPON_FAMILIES.LANCE,
    rarete: RARITY.LEGENDAIRE,
    icon: '✨',
    imageFile: 'lance3.png',
    stats: {
      auto: 7,
      spd: 3,
    },
    effet: {
      nom: 'Serment d\'Odin',
      description: 'Au premier coup du combat, applique -10% Auto permanent à l\'ennemi (non cumulable).',
      trigger: {
        type: TRIGGER_TYPES.FIRST_HIT,
      },
      values: {
        atkReductionPercent: 0.1, // -10% Auto ennemi
        stackable: false,         // Non cumulable
      },
    },
    description: 'La lance d\'Odin, qui ne rate jamais sa cible.',
  },

  // =========================================================================
  // G. ARCS
  // =========================================================================
  arc_commun: {
    id: 'arc_commun',
    nom: 'Arc court',
    famille: WEAPON_FAMILIES.ARC,
    rarete: RARITY.COMMUNE,
    icon: '🏹',
    imageFile: 'arc1.png',
    stats: {
      auto: 2,
      spd: 3,
    },
    effet: null,
    description: 'Un arc léger, idéal pour les tirs rapides.',
  },

  arc_rare: {
    id: 'arc_rare',
    nom: 'Arc long',
    famille: WEAPON_FAMILIES.ARC,
    rarete: RARITY.RARE,
    icon: '🏹',
    imageFile: 'arc2.png',
    stats: {
      auto: 4,
      spd: 5,
    },
    effet: null,
    description: 'Un arc à longue portée, précis et puissant.',
  },

  arc_legendaire: {
    id: 'arc_legendaire',
    nom: 'Arc des Cieux',
    famille: WEAPON_FAMILIES.ARC,
    rarete: RARITY.LEGENDAIRE,
    icon: '🌟',
    imageFile: 'arc3.png',
    stats: {
      auto: 5,
      spd: 7,
    },
    effet: {
      nom: 'Pluie Céleste',
      description: 'Tous les 4 tours, effectue une attaque supplémentaire à 90% de dégâts.',
      trigger: {
        type: TRIGGER_TYPES.EVERY_N_TURNS,
        n: 4,
      },
      values: {
        bonusAttacks: 1,          // 1 attaque bonus
        bonusAttackDamage: 0.9,   // 90% des dégâts
      },
    },
    description: 'Un arc forgé dans les nuages, béni par les dieux.',
  },

  // =========================================================================
  // H. TOMES
  // =========================================================================
  tome_commun: {
    id: 'tome_commun',
    nom: 'Tome élémentaire',
    famille: WEAPON_FAMILIES.TOME,
    rarete: RARITY.COMMUNE,
    icon: '📖',
    imageFile: 'tome1.png',
    stats: {
      cap: 3,
    },
    effet: null,
    description: 'Un grimoire contenant des capacités élémentaires basiques.',
  },

  tome_rare: {
    id: 'tome_rare',
    nom: 'Grimoire ancien',
    famille: WEAPON_FAMILIES.TOME,
    rarete: RARITY.RARE,
    icon: '📖',
    imageFile: 'tome2.png',
    stats: {
      cap: 5,
    },
    effet: null,
    description: 'Un grimoire poussiéreux rempli de connaissances oubliées.',
  },

  tome_legendaire: {
    id: 'tome_legendaire',
    nom: 'Codex Archon',
    famille: WEAPON_FAMILIES.TOME,
    rarete: RARITY.LEGENDAIRE,
    icon: '📜',
    imageFile: 'tome3.png',
    stats: {
      cap: 6,
      hp: 10,
    },
    effet: {
      nom: 'Arcane Majeure',
      description: 'Chaque capacité sur deux (2e, 4e, 6e…) se lance deux fois et fait 70% de dégâts.',
      trigger: {
        type: TRIGGER_TYPES.EVERY_N_SPELLS,
        everyN: 2,                // Se déclenche toutes les 2 capacités
      },
      values: {
        doubleCast: true,
        secondCastDamage: 0.7,    // 70% des dégâts/soins
      },
    },
    description: 'Le livre ultime des arcanes, rédigé par les Archons primordiaux.',
  },

  // =========================================================================
  // I. FLÉAUX (Vague 2 — anti-tank)
  // =========================================================================
  fleau_commun: {
    id: 'fleau_commun',
    nom: 'Fléau Brutal',
    famille: WEAPON_FAMILIES.FLEAU,
    rarete: RARITY.COMMUNE,
    icon: '⛓️',
    imageFile: 'fleau1.png',
    stats: {
      auto: 2,
    },
    effet: null,
    description: 'Un fléau d\'armes rudimentaire mais efficace.',
    vague: 2,
  },

  fleau_rare: {
    id: 'fleau_rare',
    nom: 'Fléau du Crépuscule',
    famille: WEAPON_FAMILIES.FLEAU,
    rarete: RARITY.RARE,
    icon: '⛓️',
    imageFile: 'fleau2.png',
    stats: {
      auto: 3,
      def: 1,
    },
    effet: null,
    description: 'Un fléau forgé dans les ombres du crépuscule.',
    vague: 2,
  },

  fleau_legendaire: {
    id: 'fleau_legendaire',
    nom: 'Fléau d\'Anathème',
    famille: WEAPON_FAMILIES.FLEAU,
    rarete: RARITY.LEGENDAIRE,
    icon: '🔗',
    imageFile: 'fleau3.png',
    stats: {
      auto: 5,
      def: 3,
    },
    effet: {
      nom: 'Anathème',
      description: 'Après votre première attaque, la cible perd 15% DEF et 15% ResC pour le reste du combat.',
      trigger: {
        type: TRIGGER_TYPES.FIRST_HIT,
      },
      values: {
        defReductionPercent: 0.15,
        rescapReductionPercent: 0.15,
      },
    },
    description: 'Un fléau maudit qui brise les défenses de l\'âme et du corps.',
    vague: 2,
  },

  // =========================================================================
  // J. ARBALÈTES (Vague 2 — burst)
  // =========================================================================
  arbalete_commune: {
    id: 'arbalete_commune',
    nom: 'Arbalète de Chasse',
    famille: WEAPON_FAMILIES.ARBALETE,
    rarete: RARITY.COMMUNE,
    icon: '🏹',
    imageFile: 'arbalete1.png',
    stats: {
      auto: 1,
      cap: 1,
    },
    effet: null,
    description: 'Une arbalète légère pour le petit gibier.',
    vague: 2,
  },

  arbalete_rare: {
    id: 'arbalete_rare',
    nom: 'Arbalète du Serment',
    famille: WEAPON_FAMILIES.ARBALETE,
    rarete: RARITY.RARE,
    icon: '🏹',
    imageFile: 'arbalete2.png',
    stats: {
      auto: 3,
      cap: 3,
    },
    effet: null,
    description: 'Une arbalète de précision, forgée sous serment de loyauté.',
    vague: 2,
  },

  arbalete_legendaire: {
    id: 'arbalete_legendaire',
    nom: 'Arbalète du Verdict',
    famille: WEAPON_FAMILIES.ARBALETE,
    rarete: RARITY.LEGENDAIRE,
    icon: '⚖️',
    imageFile: 'arbalete3.png',
    stats: {
      auto: 4,
      cap: 4,
    },
    effet: {
      nom: 'Verdict',
      description: 'Vos deux premières capacités infligent +100% dégâts et soins mais ont +1 CD.',
      trigger: {
        type: TRIGGER_TYPES.PASSIVE,
      },
      values: {
        spellDamageBonus: 1,
        spellBonusCount: 2,
        cooldownPenalty: 1,
      },
    },
    description: 'L\'arbalète du juge suprême, dont chaque carreau est un verdict.',
    vague: 2,
  },

  // =========================================================================
  // K. HACHES (Vague 2 — saignement)
  // =========================================================================
  hache_commune: {
    id: 'hache_commune',
    nom: 'Hache de Bûcheron',
    famille: WEAPON_FAMILIES.HACHE,
    rarete: RARITY.COMMUNE,
    icon: '🪓',
    imageFile: 'hache1.png',
    stats: {
      auto: 4,
    },
    effet: null,
    description: 'Une hache de travail reconvertie pour le combat.',
    vague: 2,
  },

  hache_rare: {
    id: 'hache_rare',
    nom: 'Hache Géante',
    famille: WEAPON_FAMILIES.HACHE,
    rarete: RARITY.RARE,
    icon: '🪓',
    imageFile: 'hache2.png',
    stats: {
      auto: 6,
    },
    effet: null,
    description: 'Une hache massive qui fend tout sur son passage.',
    vague: 2,
  },

  hache_legendaire: {
    id: 'hache_legendaire',
    nom: 'Labrys d\'Arès',
    famille: WEAPON_FAMILIES.HACHE,
    rarete: RARITY.LEGENDAIRE,
    icon: '⚔️',
    imageFile: 'hache3.png',
    stats: {
      auto: 6,
      hp: 10,
    },
    effet: {
      nom: 'Saignement d\'Arès',
      description: 'Votre attaque applique un saignement brut : la cible perd 3% HP max à chacun de ses tours d\'action. Réduit de 1% par tour (3→2→1→0). Réapplicable à 0%. Dégâts bruts.',
      trigger: {
        type: TRIGGER_TYPES.PASSIVE,
      },
      values: {
        initialBleedPercent: 0.03,
        bleedDecayPercent: 0.01,
        rawDamage: true,
      },
    },
    description: 'La hache double du dieu de la guerre, qui inflige des blessures inguérissables.',
    vague: 2,
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Récupère une arme par son ID
 */
export function getWeaponById(weaponId) {
  return weapons[weaponId] || null;
}

/**
 * Récupère toutes les armes d'une famille
 */
export function getWeaponsByFamily(family) {
  return Object.values(weapons).filter(w => w.famille === family);
}

/**
 * Récupère toutes les armes d'une rareté
 */
export function getWeaponsByRarity(rarity) {
  return Object.values(weapons).filter(w => w.rarete === rarity);
}

/**
 * Récupère l'arme d'une famille pour une rareté donnée
 */
export function getWeaponByFamilyAndRarity(family, rarity) {
  return Object.values(weapons).find(
    w => w.famille === family && w.rarete === rarity
  ) || null;
}

/**
 * Tire une arme aléatoire d'une rareté donnée (filtrée par vague active)
 */
export function getRandomWeaponByRarity(rarity) {
  const available = Object.values(weapons).filter(
    w => w.rarete === rarity && isWaveActive(w.vague)
  );
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Liste toutes les familles d'armes avec leurs icônes
 */
export function getWeaponFamilyInfo() {
  return {
    [WEAPON_FAMILIES.BATON]: { nom: 'Bâtons', icon: '🪄' },
    [WEAPON_FAMILIES.BOUCLIER]: { nom: 'Boucliers', icon: '🛡️' },
    [WEAPON_FAMILIES.EPEE]: { nom: 'Épées', icon: '⚔️' },
    [WEAPON_FAMILIES.DAGUE]: { nom: 'Dagues', icon: '🗡️' },
    [WEAPON_FAMILIES.MARTEAU]: { nom: 'Marteaux', icon: '🔨' },
    [WEAPON_FAMILIES.LANCE]: { nom: 'Lances', icon: '🔱' },
    [WEAPON_FAMILIES.ARC]: { nom: 'Arcs', icon: '🏹' },
    [WEAPON_FAMILIES.TOME]: { nom: 'Tomes', icon: '📖' },
    [WEAPON_FAMILIES.FLEAU]: { nom: 'Fléaux', icon: '⛓️' },
    [WEAPON_FAMILIES.ARBALETE]: { nom: 'Arbalètes', icon: '🏹' },
    [WEAPON_FAMILIES.HACHE]: { nom: 'Haches', icon: '🪓' },
  };
}

/**
 * Calcule les stats totales d'un personnage avec son arme équipée
 */
export function applyWeaponStats(baseStats, weaponId) {
  if (!weaponId) return { ...baseStats };

  const weapon = getWeaponById(weaponId);
  if (!weapon) return { ...baseStats };

  const result = { ...baseStats };

  // Applique les bonus de stats de l'arme
  for (const [stat, value] of Object.entries(weapon.stats)) {
    if (result[stat] !== undefined) {
      result[stat] += value;
    }
  }

  return result;
}

/**
 * Valide la cohérence des données d'armes
 */
export function validateWeaponsData() {
  const errors = [];
  const weaponList = Object.values(weapons);
  const familyCount = Object.values(WEAPON_FAMILIES).length;
  const expectedTotal = familyCount * 3;

  // Vérifie que chaque famille a exactement 3 armes (une par rareté)
  for (const family of Object.values(WEAPON_FAMILIES)) {
    const familyWeapons = weaponList.filter(w => w.famille === family);

    if (familyWeapons.length !== 3) {
      errors.push(`Famille ${family}: attendu 3 armes, trouvé ${familyWeapons.length}`);
    }

    // Vérifie les raretés
    for (const rarity of Object.values(RARITY)) {
      const hasRarity = familyWeapons.some(w => w.rarete === rarity);
      if (!hasRarity) {
        errors.push(`Famille ${family}: manque rareté ${rarity}`);
      }
    }

    // Vérifie que seules les légendaires ont des effets
    for (const weapon of familyWeapons) {
      if (weapon.rarete === RARITY.LEGENDAIRE && !weapon.effet) {
        errors.push(`${weapon.nom}: arme légendaire sans effet`);
      }
      if (weapon.rarete !== RARITY.LEGENDAIRE && weapon.effet) {
        errors.push(`${weapon.nom}: arme non-légendaire avec effet`);
      }
    }
  }

  // Vérifie le total (familles × 3 raretés)
  if (weaponList.length !== expectedTotal) {
    errors.push(`Total armes: attendu ${expectedTotal}, trouvé ${weaponList.length}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
