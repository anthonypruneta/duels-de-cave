// Données partagées pour les races du jeu

export const races = {
  'Humain': {
    bonus: '+10 PV & +1 toutes stats',
    icon: '👥',
    awakening: {
      levelRequired: 100,
      description: '+3% à toutes les stats',
      effect: {
        statMultipliers: {
          auto: 1.03,
          def: 1.03,
          rescap: 1.03,
          spd: 1.03,
          cap: 1.03,
          hp: 1.03
        }
      }
    }
  },
  'Elfe': {
    bonus: '+1 AUTO, +1 CAP, +5 VIT, +20% crit',
    icon: '🧝',
    awakening: {
      levelRequired: 100,
      description: '+3% Auto, +3% Cap, +3 VIT, +12% crit, +15% dégâts crit',
      effect: {
        statMultipliers: {
          auto: 1.03,
          cap: 1.03
        },
        statBonuses: {
          spd: 3
        },
        critChanceBonus: 0.12,
        critDamageBonus: 0.15
      }
    }
  },
  'Orc': {
    bonus: 'Sous 50% PV: +22% dégâts',
    icon: '🪓',
    awakening: {
      levelRequired: 100,
      description: 'Les 4 premières attaques subies infligent 33% dégâts (conserve: Sous 50% PV: +22% dégâts)',
      effect: {
        incomingHitMultiplier: 0.33,
        incomingHitCount: 4
      }
    }
  },
  'Nain': {
    bonus: '+10 PV & +4 Déf',
    icon: '⛏️',
    awakening: {
      levelRequired: 100,
      description: '+15% PV max, -5% dégâts subis',
      effect: {
        statMultipliers: {
          hp: 1.15
        },
        damageTakenMultiplier: 0.95
      }
    }
  },
  'Dragonkin': {
    bonus: '+15 PV & +15 ResC',
    icon: '🐲',
    awakening: {
      levelRequired: 100,
      description: '+10% PV max, +15% ResC, +1% dégâts infligés par dégât reçu',
      effect: {
        statMultipliers: {
          hp: 1.1,
          rescap: 1.15
        },
        damageStackBonus: 0.01
      }
    }
  },
  'Mort-vivant': {
    bonus: 'Revient à 20% PV (1x)',
    icon: '☠️',
    awakening: {
      levelRequired: 100,
      description: 'Première mort: explosion 9% PV max + résurrection 20% PV max',
      effect: {
        explosionPercent: 0.09,
        revivePercent: 0.2,
        reviveOnce: true
      }
    }
  },
  'Lycan': {
    bonus: 'Attaque inflige saignement +1/tour',
    icon: '🐺',
    awakening: {
      levelRequired: 100,
      description: 'Chaque auto: +1 stack de saignement (0.7% PV max par tour)',
      effect: {
        bleedStacksPerHit: 1,
        bleedPercentPerStack: 0.007
      }
    }
  },
  'Sylvari': {
    bonus: 'Regen 2% PV max/tour',
    icon: '🌿',
    awakening: {
      levelRequired: 100,
      description: 'Regen 3,5% PV max/tour, +8% dégâts si PV > 80%',
      effect: {
        regenPercent: 0.035,
        highHpDamageBonus: 0.08,
        highHpThreshold: 0.8
      }
    }
  },
  'Gnome': {
    bonus: '+3 VIT, +2 CAP, VIT > cible: +20% crit, VIT < cible: +20% esquive, égalité: +10% crit/esquive',
    icon: '🧠',
    awakening: {
      levelRequired: 100,
      description: '+12% VIT, +8% CAP, VIT > cible: +45% crit, VIT < cible: +45% esquive, égalité: +22% crit/esquive',
      effect: {
        speedDuelCritHigh: 0.45,
        speedDuelDodgeLow: 0.45,
        speedDuelEqualCrit: 0.22,
        speedDuelEqualDodge: 0.22,
        statMultipliers: {
          spd: 1.12,
          cap: 1.08
        }
      }
    }
  },
  'Sirène': {
    bonus: '+15 CAP, subit un spell: +10% dégâts/soins des capacités (max 3 stacks)',
    icon: '🧜',
    awakening: {
      levelRequired: 100,
      description: '+23 CAP, stacks à +15% dégâts/soins des capacités (max 3), -5% dégâts subis',
      effect: {
        statBonuses: {
          cap: 8
        },
        sireneStackBonus: 0.15,
        sireneMaxStacks: 3,
        damageTakenMultiplier: 0.95
      }
    }
  },
  'Mindflayer': {
    bonus: '+8 ResC, quand l’ennemi lance un spell: CD+1 & -15% dégâts, sans CD → -35% dégâts',
    icon: '🦑',
    awakening: {
      levelRequired: 100,
      description: 'CD+1 & -20% dégâts, sans CD → -45% dégâts',
      effect: {
        mindflayerCooldownSpellReduction: 0.2,
        mindflayerNoCooldownSpellReduction: 0.45,
        mindflayerAddCooldownTurns: 1
      }
    }
  }
};
