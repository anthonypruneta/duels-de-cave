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
  // BOSS NIVEAU 2 - BANDIT (Normal)
  // Stats: 25 partout, 150 HP
  // Capacité: Saignement tous les 2 tours (comme Lycan)
  // =========================================================================
  bandit: {
    id: 'bandit',
    nom: 'Bandit des Grands Chemins',
    description: 'Un brigand sans scrupules qui terrorise les voyageurs.',
    icon: '🗡️',
    imageFile: 'bandit.png',

    // Stats fixes
    baseStats: {
      hp: 150,
      auto: 25,
      def: 25,
      cap: 25,
      rescap: 25,
      spd: 25,
    },

    // Capacité spéciale du boss
    ability: {
      nom: 'Lame Empoisonnée',
      description: 'Tous les 2 tours, applique un saignement à l\'ennemi.',
      cooldown: 2,
      trigger: 'every_n_turns',
      effect: {
        type: 'bleed',
        stacksPerHit: 1, // Comme Lycan
      },
    },

    // Pas de passif pour le bandit
    passive: null,
  },

  // =========================================================================
  // BOSS NIVEAU 1 - CHEF GOBELIN (Très Facile)
  // Stats: 15 partout, 120 HP
  // =========================================================================
  chef_gobelin: {
    id: 'chef_gobelin',
    nom: 'Chef Gobelin Grukk',
    description: 'Le chef d\'une tribu gobeline, rusé et vicieux.',
    icon: '👺',
    imageFile: 'gobelin.png',

    // Stats fixes
    baseStats: {
      hp: 120,
      auto: 15,
      def: 15,
      cap: 15,
      rescap: 15,
      spd: 15,
    },

    // Pas de capacité spéciale
    ability: null,
    passive: null,
  },

  // =========================================================================
  // BOSS NIVEAU 3 - DRAGON (Très Difficile)
  // Stats: 30 partout, 200 HP
  // Capacité: Sort tous les 5 tours avec +50% dégâts
  // =========================================================================
  dragon: {
    id: 'dragon',
    nom: 'Vyraxion le Dévoreur',
    description: 'Un dragon ancien aux écailles impénétrables, gardien d\'un trésor légendaire.',
    icon: '🐲',
    imageFile: 'dragon.png',

    // Stats fixes
    baseStats: {
      hp: 200,
      auto: 30,
      def: 30,
      cap: 30,
      rescap: 30,
      spd: 30,
    },

    // Capacité spéciale du boss
    ability: {
      nom: 'Souffle de Flammes',
      description: 'Tous les 5 tours, lance un sort dévastateur avec +50% de dégâts.',
      cooldown: 5,
      trigger: 'every_n_turns',
      effect: {
        type: 'spell_boost',
        damageBonus: 0.5, // +50% dégâts
      },
    },

    passive: null,
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
 * Crée un combattant boss pour le système de combat
 * Les stats sont fixes, pas de scaling
 */
export function createBossCombatant(bossId) {
  const boss = getBossById(bossId);
  if (!boss) return null;

  return {
    // Identité (format compatible avec le système de combat)
    name: boss.nom,
    race: 'Boss',
    class: 'Boss',
    isBoss: true,
    bossId: boss.id,
    imageFile: boss.imageFile,

    // Stats de combat
    base: { ...boss.baseStats },
    bonuses: { race: {}, class: {} },
    currentHP: boss.baseStats.hp,
    maxHP: boss.baseStats.hp,

    // Cooldowns (format du système existant)
    cd: {
      war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0,
      boss_ability: 0,
    },

    // État de combat
    undead: false,
    dodge: false,
    reflect: false,
    bleed_stacks: 0,
    maso_taken: 0,

    // Référence aux données du boss
    ability: boss.ability,
    passive: boss.passive,
  };
}

/**
 * Liste tous les boss
 */
export function getAllBosses() {
  return Object.values(bosses);
}
