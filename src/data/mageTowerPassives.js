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
        description: 'Chaque attaque soigne 5% des dégâts infligés.',
        healPercent: 0.05
      },
      3: {
        description: 'Chaque attaque soigne 8% des dégâts infligés.',
        healPercent: 0.08
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
        description: 'Tours 1–2 : +5% dégâts. Premier sort Mage/Healer du combat : +5% CAP.',
        damageBonus: 0.05,
        spellCapBonus: 0.05,
        turns: 2
      },
      2: {
        description: 'Tours 1–2 : +10% dégâts. Premier sort Mage/Healer du combat : +10% CAP.',
        damageBonus: 0.1,
        spellCapBonus: 0.1,
        turns: 2
      },
      3: {
        description: 'Tours 1–2 : +20% dégâts. Premier sort Mage/Healer du combat : +20% CAP.',
        damageBonus: 0.2,
        spellCapBonus: 0.2,
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
        description: '-2% HP max par auto, +30% dégâts autos.',
        hpCostPercent: 0.02,
        autoDamageBonus: 0.30
      },
      3: {
        description: '-3% HP max par auto, +40% dégâts autos.',
        hpCostPercent: 0.03,
        autoDamageBonus: 0.40
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
        description: 'Régénère 1% HP max par tour. Vous survivez à 1 HP (1 fois par combat).',
        regenPercent: 0.01
      },
      2: {
        description: 'Régénère 2% HP max par tour. Vous survivez à 1 HP (1 fois par combat).',
        regenPercent: 0.02
      },
      3: {
        description: 'Régénère 3% HP max par tour. Vous survivez à 1 HP (1 fois par combat).',
        regenPercent: 0.03
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
  const idx1 = Math.floor(Math.random() * available.length);
  let idx2 = Math.floor(Math.random() * available.length);
  let attempts = 0;
  while (idx2 === idx1 && attempts < 10) {
    idx2 = Math.floor(Math.random() * available.length);
    attempts++;
  }
  return [
    { id: available[idx1].id, level },
    { id: available[idx2].id, level }
  ];
};
