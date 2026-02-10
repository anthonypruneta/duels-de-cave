// Données partagées pour les races du jeu

export const races = {
  'Humain': {
    bonus: '+10 PV & +1 toutes stats',
    icon: '👥',
    awakening: {
      levelRequired: 100,
      description: '+6% à toutes les stats',
      effect: {
        statMultipliers: {
          auto: 1.06,
          def: 1.06,
          rescap: 1.06,
          spd: 1.06,
          cap: 1.06,
          hp: 1.06
        }
      }
    }
  },
  'Elfe': {
    bonus: '+1 AUTO, +1 CAP, +5 VIT, +20% crit',
    icon: '🧝',
    awakening: {
      levelRequired: 100,
      description: '+5% Auto, +5% Cap, +5 VIT, +10% crit, +20% dégâts crit',
      effect: {
        statMultipliers: {
          auto: 1.05,
          cap: 1.05
        },
        statBonuses: {
          spd: 5
        },
        critChanceBonus: 0.10,
        critDamageBonus: 0.2
      }
    }
  },
  'Orc': {
    bonus: 'Sous 50% PV: +25% dégâts',
    icon: '🪓',
    awakening: {
      levelRequired: 100,
      description: 'Les 4 premières attaques subies infligent 33% dégâts',
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
      description: '+15% PV max, -8% dégâts subis',
      effect: {
        statMultipliers: {
          hp: 1.15
        },
        damageTakenMultiplier: 0.92
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
      description: 'Première mort: explosion 6% PV max + résurrection 15% PV max',
      effect: {
        explosionPercent: 0.06,
        revivePercent: 0.15,
        reviveOnce: true
      }
    }
  },
  'Lycan': {
    bonus: 'Attaque inflige saignement +1/tour',
    icon: '🐺',
    awakening: {
      levelRequired: 100,
      description: 'Chaque auto: +1 stack de saignement (2,8% PV max par tour) + 12% VIT + 10% Auto',
      effect: {
        bleedStacksPerHit: 1,
        statMultipliers: {
          spd: 1.12,
          auto: 1.10
        },
        bleedPercentPerStack: 0.028
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
  }
};
