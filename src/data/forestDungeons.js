export const FOREST_DIFFICULTY_COLORS = {
  'Ultra simple': 'text-green-400',
  'Équilibré': 'text-amber-400',
  'Très dur': 'text-red-400'
};

export const FOREST_LEVELS = [
  {
    id: 'forest_1',
    niveau: 1,
    nom: 'Clairière',
    difficulte: 'Ultra simple',
    boss: {
      id: 'sanglier',
      nom: 'Sanglier',
      icon: '🐗',
      imageFile: 'sanglier.png',
      stats: { hp: 165, auto: 22, def: 17, rescap: 11, spd: 11, cap: 11 },
      ability: null
    },
    rewardRolls: 1
  },
  {
    id: 'forest_2',
    niveau: 2,
    nom: 'Bosquet',
    difficulte: 'Équilibré',
    boss: {
      id: 'ours',
      nom: 'Ours',
      icon: '🐻',
      imageFile: 'ours.png',
      stats: { hp: 220, auto: 31, def: 31, rescap: 31, spd: 31, cap: 31 },
      ability: {
        type: 'bear_rage',
        name: 'Rage',
        description: 'À 25% HP, prépare un coup dévastateur.'
      }
    },
    rewardRolls: 2
  },
  {
    id: 'forest_3',
    niveau: 3,
    nom: 'Sanctuaire',
    difficulte: 'Très dur',
    boss: {
      id: 'licorne',
      nom: 'Licorne',
      icon: '🦄',
      imageFile: 'licorne.png',
      stats: { hp: 275, auto: 37, def: 37, rescap: 37, spd: 37, cap: 37 },
      ability: {
        type: 'unicorn_cycle',
        name: 'Alternance mystique',
        description: 'Un tour sur deux, modifie les dégâts infligés et reçus.'
      }
    },
    rewardRolls: 3
  }
];

export const getForestLevelByNumber = (levelNumber) =>
  FOREST_LEVELS.find(level => level.niveau === levelNumber) || null;

export const getAllForestLevels = () =>
  [...FOREST_LEVELS].sort((a, b) => a.niveau - b.niveau);

export const createForestBossCombatant = (bossData) => ({
  name: bossData.nom,
  bossId: bossData.id,
  base: { ...bossData.stats },
  currentHP: bossData.stats.hp,
  maxHP: bossData.stats.hp,
  ability: bossData.ability,
  rageReady: false,
  rageUsed: false,
  imageFile: bossData.imageFile || null,
  cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0, succ: 0, bast: 0, sorc: 0, berz: 0 },
  undead: false,
  dodge: false,
  reflect: false,
  bleed_stacks: 0,
  maso_taken: 0
});
