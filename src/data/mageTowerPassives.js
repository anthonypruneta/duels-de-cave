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
        description: 'Quand vous lancez une compétence, un éclair inflige 5% de votre Auto.',
        lightningPercent: 0.05
      },
      2: {
        description: 'Quand vous lancez une compétence, un éclair inflige 10% de votre Auto.',
        lightningPercent: 0.1
      },
      3: {
        description: 'Quand vous lancez une compétence, un éclair inflige 15% de votre Auto.',
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
        description: '+5% dégâts infligés pendant le tour 1.',
        damageBonus: 0.05,
        turns: 1
      },
      2: {
        description: '+10% dégâts infligés pendant le tour 1.',
        damageBonus: 0.1,
        turns: 1
      },
      3: {
        description: '+15% dégâts infligés pendant les tours 1 et 2.',
        damageBonus: 0.15,
        turns: 2
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

export const rollMageTowerPassive = (level) => {
  const passive = MAGE_TOWER_PASSIVES[Math.floor(Math.random() * MAGE_TOWER_PASSIVES.length)];
  return passive ? { id: passive.id, level } : null;
};
