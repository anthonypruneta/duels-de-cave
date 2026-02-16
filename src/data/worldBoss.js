/**
 * Données du Boss Mondial - Cataclysme
 * Event spécial où tous les joueurs combattent un boss commun
 */

// Stats du boss V1
export const WORLD_BOSS = {
  id: 'cataclysme',
  nom: 'Cataclysme',
  description: 'Une entité destructrice menace le monde entier. Tous les combattants doivent unir leurs forces.',
  baseStats: {
    hp: 35000,
    auto: 75,
    cap: 70,
    def: 60,
    rescap: 60,
    spd: 50
  }
};

// Constantes de l'event
export const WORLD_BOSS_CONSTANTS = {
  MAX_TURNS: 10,           // Le combat dure 10 tours max
  EXTINCTION_TURN: 10,     // Tour de l'attaque EXTINCTION
  ATTEMPTS_PER_DAY: 2,     // 1 matin + 1 aprem
  PERCENT_HP_DAMAGE_REDUCTION: 0.90, // 90% de réduction sur les dégâts basés sur %PV max (bleed Lycan, etc.)
};

// Statuts possibles de l'event
export const EVENT_STATUS = {
  INACTIVE: 'inactif',
  ACTIVE: 'actif',
  FINISHED: 'termine'
};
