// Données partagées pour les races du jeu

export const races = {
  'Humain': {
    bonus: '- +10 PV\n-+1 toutes stats',
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
      description: '+3% Auto, +3% Cap, +5 VIT, +20% crit, +15% dégâts crit',
      effect: {
        statMultipliers: {
          auto: 1.03,
          cap: 1.03
        },
        statBonuses: {
          spd: 5
        },
        critChanceBonus: 0.20,
        critDamageBonus: 0.15
      }
    }
  },
  'Orc': {
    bonus: 'Sous 50% PV: +22% dégâts',
    icon: '🪓',
    awakening: {
      levelRequired: 100,
      description: '- Sous 50% PV: +22% dégâts\n- Les 4 premières attaques subies infligent 33% dégâts',
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
      description: '+15% PV max, +5% Déf',
      effect: {
        statMultipliers: {
          hp: 1.15,
          def: 1.05
        }
      }
    }
  },
  'Dragonkin': {
    bonus: '- +15 PV\n- +15 ResC',
    icon: '🐲',
    awakening: {
      levelRequired: 100,
      description: '- +10% PV max\n- +15% ResC\n- +1% dégâts infligés par dégât reçu',
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
      description: 'Première mort:\n- explosion 9% PV max\n- résurrection 20% PV max',
      effect: {
        explosionPercent: 0.09,
        revivePercent: 0.2,
        reviveOnce: true
      }
    }
  },
  'Lycan': {
    bonus: 'Attaque inflige saignement +1 de dégât/tour',
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
      description: 'Regen 3,5% PV max/tour\n- +8% dégâts si PV > 80%',
      effect: {
        regenPercent: 0.035,
        highHpDamageBonus: 0.08,
        highHpThreshold: 0.8
      }
    }
  },
  'Gnome': {
    bonus: '- +3 VIT\n- +2 CAP\n- VIT > cible: +20% crit\n- VIT < cible: +20% esquive\n- égalité: +10% crit/esquive',
    icon: '🧠',
    awakening: {
      levelRequired: 100,
      description: '+12% VIT\n- +8% CAP\n- VIT > cible: +45% crit\n- VIT < cible: +45% esquive\n- égalité: +22% crit/esquive',
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
    bonus: '+15 CAP\n- subit un spell: +10% dégâts/soins des capacités (max 3 stacks)',
    icon: '🧜',
    awakening: {
      levelRequired: 100,
      description: '+23 CAP, stacks à +15% dégâts/soins des capacités (max 3)',
      effect: {
        statBonuses: {
          cap: 8
        },
        sireneStackBonus: 0.15,
        sireneMaxStacks: 3
      }
    }
  },
  'Mindflayer': {
    bonus: 'Vole et relance le premier sort lancé par l\'ennemi et ajoute 20% de votre CAP aux dégâts',
    icon: '🦑',
    awakening: {
      levelRequired: 100,
      description: 'Vole et relance le premier sort lancé par l\'ennemi et ajoute 20% de votre CAP aux dégâts\nVotre sort a -1 de CD',
      effect: {
        mindflayerStealSpellCapDamageScale: 0.2,
        mindflayerOwnCooldownReductionTurns: 1
      }
    }
  }
};
