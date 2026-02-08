export const MAGE_TOWER_DIFFICULTY_COLORS = {
  'Ultra simple': 'text-green-400',
  'Équilibré': 'text-amber-400',
  'Très dur': 'text-red-400'
};

export const MAGE_TOWER_LEVELS = [
  {
    id: 'mage_tower_1',
    niveau: 1,
    nom: 'Hall des grimoires',
    difficulte: 'Ultra simple',
    boss: {
      id: 'rat',
      nom: 'Rat',
      icon: '🐀',
      imageFile: 'rat.png',
      stats: { hp: 130, auto: 15, def: 15, rescap: 15, spd: 15, cap: 15 },
      ability: null
    }
  },
  {
    id: 'mage_tower_2',
    niveau: 2,
    nom: 'Galerie d’os',
    difficulte: 'Équilibré',
    boss: {
      id: 'skeleton_golem',
      nom: 'Golem squelettique',
      icon: '💀',
      imageFile: 'golem.png',
      stats: { hp: 200, auto: 28, def: 28, rescap: 28, spd: 28, cap: 28 },
      ability: {
        type: 'bone_guard',
        name: 'Carapace d’os',
        description: 'Sous 40% HP, subit -30% dégâts (déclenchement unique).'
      }
    }
  },
  {
    id: 'mage_tower_3',
    niveau: 3,
    nom: 'Sommet nécromant',
    difficulte: 'Très dur',
    boss: {
      id: 'lich',
      nom: 'Liche',
      icon: '🧟',
      imageFile: 'liche.png',
      stats: { hp: 260, auto: 34, def: 34, rescap: 34, spd: 34, cap: 34 },
      ability: {
        type: 'lich_shield',
        name: 'Barrière macabre',
        description: 'Début du combat: bouclier 20% HP. À la rupture: explosion 20% HP une fois.'
      }
    }
  }
];

export const getMageTowerLevelByNumber = (levelNumber) =>
  MAGE_TOWER_LEVELS.find(level => level.niveau === levelNumber) || null;

export const getAllMageTowerLevels = () =>
  [...MAGE_TOWER_LEVELS].sort((a, b) => a.niveau - b.niveau);

export const createMageTowerBossCombatant = (bossData) => ({
  name: bossData.nom,
  bossId: bossData.id,
  base: { ...bossData.stats },
  currentHP: bossData.stats.hp,
  maxHP: bossData.stats.hp,
  ability: bossData.ability,
  rageReady: false,
  rageUsed: false,
  imageFile: bossData.imageFile || null,
  cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 },
  undead: false,
  dodge: false,
  reflect: false,
  bleed_stacks: 0,
  maso_taken: 0,
  shield: 0,
  shieldExploded: false,
  boneGuardActive: false
});
