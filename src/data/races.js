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
      description: '+4% Auto, +4% Cap, +4 VIT, +15% crit, +20% dégâts crit',
      effect: {
        statMultipliers: {
          auto: 1.04,
          cap: 1.04
        },
        statBonuses: {
          spd: 4
        },
        critChanceBonus: 0.15,
        critDamageBonus: 0.2
      }
    }
  },
  'Orc': {
    bonus: 'Sous 50% PV: +20% dégâts',
    icon: '🪓',
    awakening: {
      levelRequired: 100,
      description: 'Les 4 premières attaques subies infligent 40% dégâts',
      effect: {
        incomingHitMultiplier: 0.4,
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
      description: 'Première mort: explosion 7% PV max + résurrection 15% PV max',
      effect: {
        explosionPercent: 0.07,
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
      description: 'Chaque auto: +3 stacks de saignement (1.4% PV max par tour)',
      effect: {
        bleedStacksPerHit: 3,
        bleedPercentPerStack: 0.014
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
