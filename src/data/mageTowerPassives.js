import { isWaveActive } from './weapons.js';

export const MAGE_TOWER_PASSIVES = [
  {
    id: 'spectral_mark',
    name: 'Marque spectrale',
    icon: '🟣',
    levels: {
      1: {
        description: 'La première attaque marque l’ennemi : il subit +6% dégâts pendant tout le combat.',
        damageTakenBonus: 0.06
      },
      2: {
        description: 'La première attaque marque l’ennemi : il subit +10% dégâts pendant tout le combat.',
        damageTakenBonus: 0.1
      },
      3: {
        description: 'La première attaque marque l’ennemi : il subit +15% dégâts pendant tout le combat.',
        damageTakenBonus: 0.15
      }
    }
  },
  {
    id: 'arcane_barrier',
    name: 'Barrière arcanique',
    icon: '🛡️',
    levels: {
      1: {
        description: 'Au début du combat, gagne un bouclier de 8% des PV max.',
        shieldPercent: 0.08
      },
      2: {
        description: 'Au début du combat, gagne un bouclier de 15% des PV max.',
        shieldPercent: 0.15
      },
      3: {
        description: 'Au début du combat, gagne un bouclier de 25% des PV max.',
        shieldPercent: 0.25
      }
    }
  },
  {
    id: 'mind_breach',
    name: 'Brèche mentale',
    icon: '🧠',
    levels: {
      1: {
        description: 'Au début du combat, l’ennemi perd 8% de DEF en permanence.',
        defReduction: 0.08
      },
      2: {
        description: 'Au début du combat, l’ennemi perd 12% de DEF en permanence.',
        defReduction: 0.12
      },
      3: {
        description: 'Au début du combat, l’ennemi perd 18% de DEF en permanence.',
        defReduction: 0.18
      }
    }
  },
  {
    id: 'essence_drain',
    name: 'Vol d’essence',
    icon: '🩸',
    levels: {
      1: {
        description: 'Chaque attaque soigne 3% des dégâts infligés.',
        healPercent: 0.03
      },
      2: {
        description: 'Chaque attaque soigne 7% des dégâts infligés.',
        healPercent: 0.07
      },
      3: {
        description: 'Chaque attaque soigne 10% des dégâts infligés.',
        healPercent: 0.10
      }
    }
  },
  {
    id: 'elemental_fury',
    name: 'Furie élémentaire',
    icon: '⚡',
    levels: {
      1: {
        description: 'Quand vous lancez une compétence, un éclair inflige 5% de votre Auto en dégâts bruts.',
        lightningPercent: 0.05
      },
      2: {
        description: 'Quand vous lancez une compétence, un éclair inflige 10% de votre Auto en dégâts bruts.',
        lightningPercent: 0.1
      },
      3: {
        description: 'Quand vous lancez une compétence, un éclair inflige 15% de votre Auto en dégâts bruts.',
        lightningPercent: 0.15
      }
    }
  },
  {
    id: 'unicorn_pact',
    name: 'Pacte de la Licorne',
    icon: '🦄',
    levels: {
      1: {
        description: 'Tour A: vous attaquez en premier (+10% dégâts infligés, +5% dégâts reçus). Tour B: vous attaquez en second (-5% dégâts infligés, -10% dégâts reçus).',
        turnA: { outgoing: 0.1, incoming: 0.05 },
        turnB: { outgoing: -0.05, incoming: -0.1 }
      },
      2: {
        description: 'Tour A: vous attaquez en premier (+15% dégâts infligés, +5% dégâts reçus). Tour B: vous attaquez en second (-5% dégâts infligés, -15% dégâts reçus).',
        turnA: { outgoing: 0.15, incoming: 0.05 },
        turnB: { outgoing: -0.05, incoming: -0.15 }
      },
      3: {
        description: 'Tour A: vous attaquez en premier (+20% dégâts infligés, +5% dégâts reçus). Tour B: vous attaquez en second (-5% dégâts infligés, -20% dégâts reçus).',
        turnA: { outgoing: 0.2, incoming: 0.05 },
        turnB: { outgoing: -0.05, incoming: -0.2 }
      }
    }
  },
  {
    id: 'obsidian_skin',
    name: 'Peau d’obsidienne',
    icon: '🪨',
    levels: {
      1: {
        description: 'Subit -4% dégâts critiques. Sous 10% PV max: crits garantis.',
        critReduction: 0.04,
        critThreshold: 0.1
      },
      2: {
        description: 'Subit -7% dégâts critiques. Sous 15% PV max: crits garantis.',
        critReduction: 0.07,
        critThreshold: 0.15
      },
      3: {
        description: 'Subit -12% dégâts critiques. Sous 20% PV max: crits garantis.',
        critReduction: 0.12,
        critThreshold: 0.2
      }
    }
  },
  {
    id: 'aura_overload',
    name: 'Surcharge d’aura',
    icon: '✨',
    levels: {
      1: {
        description: 'Tours 1–2 : +5% dégâts. Première capacité du combat : +5% CAP.',
        damageBonus: 0.05,
        spellCapBonus: 0.05,
        turns: 2
      },
      2: {
        description: 'Tours 1–2 : +13% dégâts. Première capacité du combat : +13% CAP.',
        damageBonus: 0.13,
        spellCapBonus: 0.13,
        turns: 2
      },
      3: {
        description: 'Tours 1–2 : +25% dégâts. Première capacité du combat : +25% CAP.',
        damageBonus: 0.25,
        spellCapBonus: 0.25,
        turns: 2
      }
    }
  },
  // =========================================================================
  // Vague 2 — Nouveaux passifs post-tournoi
  // =========================================================================
  {
    id: 'orbe_sacrifice',
    name: 'Orbe du Sacrifice Sanguin',
    icon: '🩸',
    vague: 2,
    levels: {
      1: {
        description: '-1% HP max par auto, +20% dégâts autos.',
        hpCostPercent: 0.01,
        autoDamageBonus: 0.20
      },
      2: {
        description: '-2% HP max par auto, +38% dégâts autos.',
        hpCostPercent: 0.02,
        autoDamageBonus: 0.38
      },
      3: {
        description: '-3% HP max par auto, +50% dégâts autos.',
        hpCostPercent: 0.03,
        autoDamageBonus: 0.50
      }
    }
  },
  {
    id: 'onction_eternite',
    name: 'Onction d\'Éternité',
    icon: '🌿',
    vague: 2,
    levels: {
      1: {
        description: 'Régénère 0.8% HP max par tour. Vous survivez à 1 HP (1 fois par combat). Après avoir survécu: -30% dégâts infligés.',
        regenPercent: 0.008,
        outgoingDamageMultiplier: 0.70
      },
      2: {
        description: 'Régénère 1.5% HP max par tour. Vous survivez à 1 HP (1 fois par combat). Après avoir survécu: -25% dégâts infligés.',
        regenPercent: 0.015,
        outgoingDamageMultiplier: 0.75
      },
      3: {
        description: 'Régénère 2% HP max par tour. Vous survivez à 1 HP (1 fois par combat). Après avoir survécu: -20% dégâts infligés.',
        regenPercent: 0.02,
        outgoingDamageMultiplier: 0.80
      }
    }
  },
  {
    id: 'rituel_fracture',
    name: 'Rituel de Fracture',
    icon: '💥',
    vague: 2,
    levels: {
      1: {
        description: 'Votre auto explose les boucliers ennemis et inflige 40% de leur valeur en dégâts bruts. Réduit les soins adverses de 10%.',
        shieldExplosionPercent: 0.40,
        healReduction: 0.10
      },
      2: {
        description: 'Votre auto explose les boucliers ennemis et inflige 50% de leur valeur en dégâts bruts. Réduit les soins adverses de 20%.',
        shieldExplosionPercent: 0.50,
        healReduction: 0.20
      },
      3: {
        description: 'Votre auto explose les boucliers ennemis et inflige 60% de leur valeur en dégâts bruts. Réduit les soins adverses de 30%.',
        shieldExplosionPercent: 0.60,
        healReduction: 0.30
      }
    }
  },
  // =========================================================================
  // Vague 3 — Nouveaux passifs
  // =========================================================================
  {
    id: 'echo_guerre',
    name: 'Écho de Guerre',
    icon: '⚔️',
    vague: 3,
    levels: {
      1: {
        description: 'Chaque attaque augmente votre Auto de 2% (max 5 stacks = +10%).',
        autoStackPercent: 0.02,
        maxStacks: 5
      },
      2: {
        description: 'Chaque attaque augmente votre Auto de 3% (max 5 stacks = +15%).',
        autoStackPercent: 0.03,
        maxStacks: 5
      },
      3: {
        description: 'Chaque attaque augmente votre Auto de 4% (max 6 stacks = +24%).',
        autoStackPercent: 0.04,
        maxStacks: 6
      }
    }
  },
  {
    id: 'reflet_maudit',
    name: 'Reflet Maudit',
    icon: '🪞',
    vague: 3,
    levels: {
      1: {
        description: 'Quand l\'ennemi crit, il subit 20% des dégâts critiques en retour (bruts).',
        reflectPercent: 0.20
      },
      2: {
        description: 'Quand l\'ennemi crit, il subit 30% des dégâts critiques en retour (bruts). L\'ennemi perd 5% de crit permanent.',
        reflectPercent: 0.30,
        critReduction: 0.05
      },
      3: {
        description: 'Quand l\'ennemi crit, il subit 40% des dégâts critiques en retour (bruts). L\'ennemi perd 10% de crit permanent.',
        reflectPercent: 0.40,
        critReduction: 0.10
      }
    }
  },
  {
    id: 'entrave_arcanique',
    name: 'Entrave Arcanique',
    icon: '⛓️',
    vague: 3,
    levels: {
      1: {
        description: 'La première capacité ennemie est retardée de 1 tour.',
        enemyCdDelay: 1
      },
      2: {
        description: 'La première capacité ennemie est retardée de 1 tour. +8% dégâts tant que l\'ennemi n\'a pas lancé sa première capacité.',
        enemyCdDelay: 1,
        damageBonus: 0.08
      },
      3: {
        description: 'La première capacité ennemie est retardée de 1 tour. +15% dégâts tant que l\'ennemi n\'a pas lancé sa première capacité.',
        enemyCdDelay: 1,
        damageBonus: 0.15
      }
    }
  }
];

export const getMageTowerPassiveById = (passiveId) =>
  MAGE_TOWER_PASSIVES.find(passive => passive.id === passiveId) || null;

export const getMageTowerPassiveLevel = (passiveId, level) => {
  const passive = getMageTowerPassiveById(passiveId);
  if (!passive) return null;
  return passive.levels[level] || null;
};

/**
 * Retourne la liste des passifs disponibles (filtrés par vague active)
 */
export const getAvailablePassives = () => {
  return MAGE_TOWER_PASSIVES.filter(p => isWaveActive(p.vague));
};

export const rollMageTowerPassive = (level) => {
  const available = getAvailablePassives();
  const passive = available[Math.floor(Math.random() * available.length)];
  return passive ? { id: passive.id, level } : null;
};

export const rollMageTowerPassivePair = (level) => {
  const available = getAvailablePassives();
  const count = Math.min(3, available.length);
  const picked = [];
  while (picked.length < count) {
    const idx = Math.floor(Math.random() * available.length);
    if (!picked.some(p => p.idx === idx)) {
      picked.push({ idx, id: available[idx].id });
    }
  }
  return picked.map(p => ({ id: p.id, level }));
};
