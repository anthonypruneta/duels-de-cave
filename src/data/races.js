// Données partagées pour les races du jeu

export const races = {
  'Humain': {
    bonus: '+10 PV & +1 toutes stats',
    icon: '👥',
    awakening: {
      levelRequired: 100,
      description: '+10% à toutes les stats',
      effect: {
        statMultipliers: {
          auto: 1.1,
          def: 1.1,
          rescap: 1.1,
          spd: 1.1,
          cap: 1.1,
          hp: 1.1
        }
      }
    }
  },
  'Elfe': {
    bonus: '+1 AUTO, +1 CAP, +5 VIT, +20% crit',
    icon: '🧝',
    awakening: {
      levelRequired: 100,
      description: '+5% Auto, +5% Cap, +5 VIT, +20% crit, +30% dégâts crit',
      effect: {
        statMultipliers: {
          auto: 1.05,
          cap: 1.05
        },
        statBonuses: {
          spd: 5
        },
        critChanceBonus: 0.2,
        critDamageBonus: 0.3
      }
    }
  },
  'Orc': {
    bonus: 'Sous 50% PV: +20% dégâts',
    icon: '🪓',
    awakening: {
      levelRequired: 100,
      description: 'Les 2 premières attaques subies infligent 50% dégâts',
      effect: {
        incomingHitMultiplier: 0.5,
        incomingHitCount: 2
      }
    }
  },
  'Nain': {
    bonus: '+10 PV & +4 Déf',
    icon: '⛏️',
    awakening: {
      levelRequired: 100,
      description: '+20% PV max, -10% dégâts subis',
      effect: {
        statMultipliers: {
          hp: 1.2
        },
        damageTakenMultiplier: 0.9
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
      description: 'Première mort: explosion 30% PV max + résurrection 25% PV max',
      effect: {
        explosionPercent: 0.3,
        revivePercent: 0.25,
        reviveOnce: true
      }
    }
  },
  'Lycan': {
    bonus: 'Attaque inflige saignement +1/tour',
    icon: '🐺',
    awakening: {
      levelRequired: 100,
      description: 'Chaque auto: +1 stack de saignement (0,5% PV max par tour)',
      effect: {
        bleedStacksPerHit: 1,
        bleedPercentPerStack: 0.005
      }
    }
  },
  'Sylvari': {
    bonus: 'Regen 2% PV max/tour',
    icon: '🌿',
    awakening: {
      levelRequired: 100,
      description: 'Regen 3% PV max/tour, +5% dégâts si PV > 80%',
      effect: {
        regenPercent: 0.03,
        highHpDamageBonus: 0.05,
        highHpThreshold: 0.8
      }
    }
  }
};
