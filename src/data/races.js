// Données partagées pour les races du jeu

export const races = {
  'Humain': {
    bonus: '- +10 PV\n- +1 toutes stats',
    icon: '👥',
    awakening: {
      levelRequired: 100,
      description: '+5% à toutes les stats',
      effect: {
        statMultipliers: {
          auto: 1.05,
          def: 1.05,
          rescap: 1.05,
          spd: 1.05,
          cap: 1.05,
          hp: 1.05
        }
      }
    }
  },
  'Elfe': {
    bonus: '+1 AUTO, +1 CAP, +5 VIT, +20% crit',
    icon: '🧝',
    awakening: {
      levelRequired: 100,
      description: '+3% Auto, +3% Cap, +5 VIT, +20% crit, +10% dégâts crit',
      effect: {
        statMultipliers: {
          auto: 1.03,
          cap: 1.03
        },
        statBonuses: {
          spd: 5
        },
        critChanceBonus: 0.20,
        critDamageBonus: 0.10   // 10% (était 15%)
      }
    }
  },
  'Orc': {
    bonus: 'Sous 50% PV: +20% dégâts',
    icon: '🪓',
    awakening: {
      levelRequired: 100,
      description: '- Sous 50% PV: +18% dégâts\n- Les 3 premières attaques subies infligent 60% dégâts',
      effect: {
        damageBonus: 1.18,
        incomingHitMultiplier: 0.60,
        incomingHitCount: 3
      }
    }
  },
  'Nain': {
    bonus: '+10 PV & +4 Déf',
    icon: '⛏️',
    awakening: {
      levelRequired: 100,
      description: '+10% PV max, +4% Déf, subit -10% de dégâts',
      effect: {
        statMultipliers: {
          hp: 1.10,
          def: 1.04
        },
        damageTakenMultiplier: 0.9
      }
    }
  },
  'Dragonkin': {
    bonus: '- +15 PV\n- +15 ResC',
    icon: '🐲',
    awakening: {
      levelRequired: 100,
      description: '- +10% PV max\n- +15% ResC\n- +2% dégâts infligés par dégât reçu',
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
      description: 'Première mort:\n- explosion 6% PV max\n- résurrection 17% PV max',
      effect: {
        explosionPercent: 0.06,
        revivePercent: 0.17,
        reviveOnce: true
      }
    }
  },
  'Lycan': {
    bonus: 'Attaque applique +1 stack de saignement (dégâts = ceil(stacks/5) par tour)',
    icon: '🐺',
    awakening: {
      levelRequired: 100,
      description: 'Chaque auto: +1 stack de saignement (1.1% PV max par tour)',
      effect: {
        bleedStacksPerHit: 1,
        bleedPercentPerStack: 0.011
      }
    }
  },
  'Sylvari': {
    bonus: 'Regen 2% PV max/tour',
    icon: '🌿',
    awakening: {
      levelRequired: 100,
      description: 'Regen 3.5% PV max/tour\n- +7% dégâts si PV > 50%',
      effect: {
        regenPercent: 0.035,
        highHpDamageBonus: 0.07,
        highHpThreshold: 0.50
      }
    }
  },
  'Gnome': {
    bonus: '- +5 VIT\n- +5 CAP\n- VIT > cible: +20% crit, +10% dégâts crit\n- VIT < cible: +20% esquive, +20% CAP\n- égalité: +5% crit/dégâts crit/esquive/CAP',
    icon: '🧬',
    awakening: {
      levelRequired: 100,
      description: '+10% VIT\n- +10% CAP\n- VIT > cible: +30% crit, +20% dégâts crit\n- VIT < cible: +30% esquive, +30% CAP\n- égalité: +10% crit/dégâts crit/esquive/CAP',
      effect: {
        speedDuelCritHigh: 0.30,
        speedDuelCritDmgHigh: 0.20,   // 20% (était 30%)
        speedDuelCapBonusLow: 0.30,
        speedDuelDodgeLow: 0.30,
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
    bonus: '+10 CAP\n- subit une capacité: +10% dégâts/soins de vos compétences (max 3 stacks)',
    icon: '🧜',
    awakening: {
      levelRequired: 100,
      description: '+40 CAP, stacks à +40% dégâts/soins de vos compétences (max 4)',
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
    bonus: '+5 DEF, +5 ResC\nLe premier coup reçu ne peut dépasser 10% de vos PV max',
    icon: '🐢',
    awakening: {
      levelRequired: 100,
      description: '+10% DEF, +10% ResC\nLe premier coup reçu ne peut dépasser 10% de vos PV max.\nSe réinitialise quand vous atteignez 50% PV pour la première fois.',
      effect: {
        turtlekinResetAt50: true,
        statMultipliers: {
          def: 1.10,
          rescap: 1.10
        }
      }
    }
  }
};
