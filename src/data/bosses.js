/**
 * Système de Boss - Duels de Cave
 *
 * Définition des 3 boss de donjon avec leurs stats,
 * capacités spéciales et comportements.
 *
 * Les boss utilisent le même système de combat que les personnages
 * mais avec des capacités uniques.
 */

// ============================================================================
// DÉFINITION DES BOSS
// ============================================================================
export const bosses = {
  // =========================================================================
  // BOSS NIVEAU 1 - BANDIT (Très Facile)
  // =========================================================================
  bandit: {
    id: 'bandit',
    nom: 'Bandit des Grands Chemins',
    description: 'Un brigand sans scrupules qui terrorise les voyageurs.',
    icon: '🗡️',
    image: null, // URL vers l'image du boss (optionnel)

    // Stats de base (seront multipliées par bossStatModifier du niveau)
    baseStats: {
      hp: 100,
      auto: 18,
      def: 12,
      cap: 8,
      rescap: 10,
      spd: 22,
    },

    // Capacité spéciale du boss
    ability: {
      nom: 'Coup Sournois',
      description: 'Tous les 3 tours, attaque avec +20% de dégâts.',
      cooldown: 3,
      trigger: 'every_n_turns',
      effect: {
        type: 'damage_boost',
        value: 0.2, // +20% dégâts
      },
    },

    // Comportement IA
    behavior: {
      preferPhysical: true, // Préfère les attaques physiques
      aggressiveness: 0.6,  // 60% chance d'attaquer vs défendre
    },

    // Loot et récompenses
    rewards: {
      experience: 50, // Pour future feature XP
    },
  },

  // =========================================================================
  // BOSS NIVEAU 2 - CHEF GOBELIN (Normal)
  // =========================================================================
  chef_gobelin: {
    id: 'chef_gobelin',
    nom: 'Chef Gobelin Grukk',
    description: 'Le chef d\'une tribu gobeline, rusé et vicieux.',
    icon: '👺',
    image: null,

    baseStats: {
      hp: 140,
      auto: 22,
      def: 18,
      cap: 15,
      rescap: 15,
      spd: 25,
    },

    ability: {
      nom: 'Appel de la Meute',
      description: 'Tous les 4 tours, invoque un sbire qui inflige 30% ATK en dégâts.',
      cooldown: 4,
      trigger: 'every_n_turns',
      effect: {
        type: 'summon_damage',
        value: 0.3, // 30% de l'ATK en dégâts bonus
        duration: 1,
      },
    },

    // Capacité passive
    passive: {
      nom: 'Peau Verte',
      description: 'Réduit les dégâts physiques reçus de 10%.',
      effect: {
        type: 'damage_reduction',
        damageType: 'physical',
        value: 0.1, // -10% dégâts physiques
      },
    },

    behavior: {
      preferPhysical: true,
      aggressiveness: 0.7,
      usesAbilityOnCooldown: true,
    },

    rewards: {
      experience: 100,
    },
  },

  // =========================================================================
  // BOSS NIVEAU 3 - DRAGON (Très Difficile)
  // =========================================================================
  dragon: {
    id: 'dragon',
    nom: 'Vyraxion le Dévoreur',
    description: 'Un dragon ancien aux écailles impénétrables, gardien d\'un trésor légendaire.',
    icon: '🐲',
    image: null,

    baseStats: {
      hp: 200,
      auto: 28,
      def: 25,
      cap: 30,
      rescap: 25,
      spd: 18,
    },

    ability: {
      nom: 'Souffle de Flammes',
      description: 'Tous les 3 tours, inflige des dégâts magiques égaux à 80% CAP.',
      cooldown: 3,
      trigger: 'every_n_turns',
      effect: {
        type: 'magic_damage',
        value: 0.8, // 80% de CAP en dégâts magiques
        ignoreDefense: false,
      },
    },

    passive: {
      nom: 'Écailles Ancestrales',
      description: 'Immunisé aux effets de stun. +15% résistance à tous les dégâts sous 30% HP.',
      effect: {
        type: 'multi',
        effects: [
          { type: 'stun_immunity' },
          {
            type: 'damage_reduction_threshold',
            threshold: 0.3, // Sous 30% HP
            value: 0.15,    // -15% dégâts
          },
        ],
      },
    },

    // Phase enrage quand HP bas
    enrage: {
      threshold: 0.25, // À 25% HP
      nom: 'Fureur Draconique',
      description: 'Le dragon entre en furie, gagnant +25% ATK et +25% CAP.',
      effect: {
        type: 'stat_boost',
        stats: {
          auto: 0.25,
          cap: 0.25,
        },
      },
    },

    behavior: {
      preferPhysical: false, // Utilise plus la magie
      aggressiveness: 0.8,
      usesAbilityOnCooldown: true,
      prioritizeLowHP: true, // Cible les personnages à bas HP
    },

    rewards: {
      experience: 250,
    },
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Récupère un boss par son ID
 */
export function getBossById(bossId) {
  return bosses[bossId] || null;
}

/**
 * Génère les stats d'un boss selon le modificateur du niveau
 * @param {string} bossId - ID du boss
 * @param {number} statModifier - Multiplicateur de stats (0.5, 1.0, 1.5)
 * @param {Object} playerStats - Stats du joueur (optionnel, pour scaling)
 */
export function generateBossStats(bossId, statModifier = 1.0, playerStats = null) {
  const boss = getBossById(bossId);
  if (!boss) return null;

  const stats = {};

  if (playerStats) {
    // Scaling basé sur les stats du joueur
    for (const [stat, value] of Object.entries(boss.baseStats)) {
      const playerValue = playerStats[stat] || value;
      stats[stat] = Math.round(playerValue * statModifier);
    }
  } else {
    // Utilise les stats de base avec le modificateur
    for (const [stat, value] of Object.entries(boss.baseStats)) {
      stats[stat] = Math.round(value * statModifier);
    }
  }

  return stats;
}

/**
 * Crée un combattant boss pour le système de combat
 * @param {string} bossId - ID du boss
 * @param {number} statModifier - Multiplicateur de stats
 * @param {Object} playerStats - Stats du joueur pour scaling
 */
export function createBossCombatant(bossId, statModifier = 1.0, playerStats = null) {
  const boss = getBossById(bossId);
  if (!boss) return null;

  const stats = generateBossStats(bossId, statModifier, playerStats);

  return {
    // Identité
    nom: boss.nom,
    isBoss: true,
    bossId: boss.id,
    icon: boss.icon,

    // Stats de combat
    base: { ...stats },
    currentHP: stats.hp,
    maxHP: stats.hp,

    // Cooldowns (format du système existant)
    cd: {
      boss_ability: 0, // Cooldown de la capacité spéciale
    },

    // État de combat
    stunned: false,
    enraged: false,

    // Référence aux données du boss
    ability: boss.ability,
    passive: boss.passive,
    enrage: boss.enrage,
    behavior: boss.behavior,
  };
}

/**
 * Vérifie si le boss doit entrer en phase enrage
 */
export function checkBossEnrage(bossCombatant) {
  if (!bossCombatant.enrage || bossCombatant.enraged) return false;

  const hpPercent = bossCombatant.currentHP / bossCombatant.maxHP;
  return hpPercent <= bossCombatant.enrage.threshold;
}

/**
 * Applique les effets d'enrage au boss
 */
export function applyBossEnrage(bossCombatant) {
  if (!bossCombatant.enrage || bossCombatant.enraged) return bossCombatant;

  const enraged = { ...bossCombatant, enraged: true };

  // Applique les boosts de stats
  if (bossCombatant.enrage.effect.type === 'stat_boost') {
    for (const [stat, bonus] of Object.entries(bossCombatant.enrage.effect.stats)) {
      enraged.base[stat] = Math.round(enraged.base[stat] * (1 + bonus));
    }
  }

  return enraged;
}

/**
 * Liste tous les boss
 */
export function getAllBosses() {
  return Object.values(bosses);
}
