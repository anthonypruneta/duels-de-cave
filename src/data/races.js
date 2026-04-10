// Données partagées pour les races du jeu

export const races = {
  'Humain': {
    bonus: '+10 PV\n+1 toutes stats',
    icon: '👥',
    awakening: {
      levelRequired: 100,
      description: '+7% à toutes les stats',
      effect: {
        statMultipliers: {
          auto: 1.07,
          def: 1.07,
          rescap: 1.07,
          spd: 1.07,
          cap: 1.07,
          hp: 1.07
        }
      }
    }
  },
  'Elfe': {
    bonus: '+1 AUTO, +1 CAP, +5 VIT, +20% crit',
    icon: '🧝',
    awakening: {
      levelRequired: 100,
      description: '+4% Auto, +4% Cap, +7 VIT, +20% crit, +12% dégâts crit',
      effect: {
        statMultipliers: {
          auto: 1.04,
          cap: 1.04
        },
        statBonuses: {
          spd: 7
        },
        critChanceBonus: 0.20,
        critDamageBonus: 0.12
      }
    }
  },
  'Orc': {
    bonus: 'Sous 50% PV: +20% dégâts',
    icon: '🪓',
    awakening: {
      levelRequired: 100,
      description: 'Sous 50% PV: +18% dégâts\nLes 3 premières attaques subies infligent 60% dégâts',
      effect: {
        damageBonus: 1.18,
        incomingHitMultiplier: 0.60,
        incomingHitCount: 3
      }
    }
  },
  'Nain': {
    bonus: '+10 PV & +7 Déf',
    icon: '⛏️',
    awakening: {
      levelRequired: 100,
      description: '+10% PV max\n+7% Déf\nSubit -10% de dégâts',
      effect: {
        statMultipliers: {
          hp: 1.10,
          def: 1.07
        },
        damageTakenMultiplier: 0.9
      }
    }
  },
  'Dragonkin': {
    bonus: '+15 PV\n+15 ResC',
    icon: '🐲',
    awakening: {
      levelRequired: 100,
      description: '+10% PV max\n+15% ResC\n+2% dégâts infligés par dégât reçu',
      effect: {
        statMultipliers: {
          hp: 1.10,
          rescap: 1.15
        },
        damageStackBonus: 0.02
      }
    }
  },
  'Mort-vivant': {
    bonus: 'Revient à 20% PV (1x)',
    icon: '☠️',
    awakening: {
      levelRequired: 100,
      description: 'Première mort: explosion 6% PV max\nRésurrection 15% PV max',
      effect: {
        explosionPercent: 0.06,
        revivePercent: 0.15,
        reviveOnce: true
      }
    }
  },
  'Lycan': {
    bonus: 'Chaque attaque applique +1 stack de saignement (0,5% PV max par stack au début de son tour)',
    icon: '🐺',
    awakening: {
      levelRequired: 100,
      description: 'Chaque auto: +1 stack de saignement (1% PV max par tour)',
      effect: {
        bleedStacksPerHit: 1,
        bleedPercentPerStack: 0.01
      }
    }
  },
  'Sylvari': {
    bonus: 'Regen 2% PV max/tour',
    icon: '🌿',
    awakening: {
      levelRequired: 100,
      description: 'Regen 3% PV max/tour\n+6% dégâts si PV > 50%',
      effect: {
        regenPercent: 0.03,
        highHpDamageBonus: 0.06,
        highHpThreshold: 0.50
      }
    }
  },
  'Gnome': {
    bonus: '+5 VIT\n+5 CAP\nVIT > cible: +20% crit, +10% dégâts crit\nVIT < cible: +15% esquive, +15% CAP\nÉgalité: +5% crit/dégâts crit/esquive/CAP',
    icon: '🧬',
    awakening: {
      levelRequired: 100,
      description: '+10% VIT\n+10% CAP\nVIT > cible: +25% crit, +15% dégâts crit\nVIT < cible: +20% esquive, +20% CAP\nÉgalité: +10% crit/dégâts crit/esquive/CAP',
      effect: {
        speedDuelCritHigh: 0.25,
        speedDuelCritDmgHigh: 0.15,
        speedDuelCapBonusLow: 0.20,
        speedDuelDodgeLow: 0.20,
        speedDuelEqualCrit: 0.10,
        speedDuelEqualCritDmg: 0.10,  // égalité inchangé
        speedDuelEqualDodge: 0.10,
        speedDuelEqualCapBonus: 0.10,
        statMultipliers: {
          spd: 1.10,
          cap: 1.10
        }
      }
    }
  },
  'Sirène': {
    bonus: '+10 CAP\nSubit une capacité: +10% dégâts/soins de vos compétences (max 3 stacks)',
    icon: '🧜',
    awakening: {
      levelRequired: 100,
      description: '+40 CAP\nStacks à +40% dégâts/soins de vos compétences (max 4)',
      effect: {
        statBonuses: {
          cap: 40
        },
        sireneStackBonus: 0.40,
        sireneMaxStacks: 4
      }
    }
  },
  'Mindflayer': {
    bonus: 'Copie et relance la première capacité reçue et ajoute 5% de votre CAP aux dégâts',
    icon: '🦑',
    awakening: {
      levelRequired: 100,
      description: 'Copie et relance la première capacité reçue et ajoute 10% de votre CAP aux dégâts\nPremière capacité: -1 de CD\nSi cette première capacité est sans CD: +100% dégâts',
      effect: {
        mindflayerStealSpellCapDamageScale: 0.10,
        mindflayerOwnCooldownReductionTurns: 1,
        mindflayerNoCooldownSpellBonus: 1.00
      }
    }
  },
  'Turtlekin': {
    bonus: '+8 DEF\n+8 ResC\nLe premier coup reçu qui inflige plus de 10% de vos PV max est réduit à 10% de vos PV max',
    icon: '🐢',
    awakening: {
      levelRequired: 100,
      description: '+4% DEF\n+4% ResC\nLe premier coup reçu ne peut dépasser 10% de vos PV max.\nSe réinitialise quand vous atteignez 50% PV pour la première fois.',
      effect: {
        turtlekinResetAt50: true,
        turtlekinFirstHitCapPercent: 0.10,
        statMultipliers: {
          def: 1.04,
          rescap: 1.04
        }
      }
    }
  },
  'Écailleux': {
    bonus:
      'Chaque 3 VIT : +1 ResC ; chaque 3 ResC : +1 VIT (une fois au calcul des stats)',
    icon: '🐍',
    awakening: {
      levelRequired: 100,
      description:
        'Chaque capacité qui vous inflige des dégâts sur les PV : +4% VIT et +4% ResC (cumulable). Chaque 3 VIT : +1 ResC ; chaque 3 ResC : +1 VIT (une fois au calcul des stats).',
      effect: {
        ecailleuxCapacityRefStatPercent: 0.04
      }
    }
  },
  'Cendrés': {
    bonus:
      'Chaque 10% de PV max perdus (cumul combat) ajoute 1 braise. Au début de votre tour d\'action : pool = 1 braise + braises non dépensées. Premier sort (dégâts ou soin) : +10% par braise, puis consommation. Les soins ne retirent pas le cumul de dégâts subis.',
    icon: '🔥',
    awakening: {
      levelRequired: 100,
      description:
        'Chaque 10% de PV max perdus (cumul combat) ajoute 1 braise. Au début de votre tour d\'action : pool = 2 braises + braises non dépensées. Premier sort (dégâts ou soin) : +15% par braise, puis consommation. Les soins ne retirent pas le cumul de dégâts subis.',
      effect: {
        cendresHpDamageThreshold: 0.10,
        cendresBraiseSpellMult: 0.15,
        cendresBraiseGuaranteedEachTurn: 2
      }
    }
  }
};
