/**
 * Donjon Collège Kunugigaoka
 *
 * Boss unique : Koro Sensei (l'entraîneur)
 * Accessible à partir du niveau 400. Déblocage après le tournoi, même règle que les autres donjons (bloqué jusqu'au lundi).
 * Récompense : choix d'une sous-classe pour sa classe.
 */

/** Nom du donjon affiché partout */
export const SUBCLASS_DUNGEON_NAME = 'Collège Kunugigaoka';

/** Niveau minimum pour accéder au donjon */
export const SUBCLASS_DUNGEON_LEVEL_REQUIRED = 400;

export const SUBCLASS_BOSS = {
  id: 'koro_sensei',
  nom: 'Koro Sensei',
  icon: '🎓',
  imageFile: 'Koro Sensei.png',
  stats: {
    hp: 460,
    auto: 85,
    def: 115,
    cap: 85,
    rescap: 115,
    spd: 95,
  },
  ability: {
    type: 'trainer_spell',
    name: 'Leçon du maître',
    description: 'Inflige Auto + 30% CAP. Réduit les dégâts de la prochaine attaque adverse de 15%. Cooldown: 4 tours.',
    cooldown: 4,
    effect: {
      capScale: 0.3,
      nextAttackReduction: 0.15,
    },
  },
};

/**
 * Crée le combattant Koro Sensei pour le combat
 */
export function createSubclassBossCombatant() {
  return {
    name: SUBCLASS_BOSS.nom,
    bossId: SUBCLASS_BOSS.id,
    isBoss: true,
    base: { ...SUBCLASS_BOSS.stats },
    currentHP: SUBCLASS_BOSS.stats.hp,
    maxHP: SUBCLASS_BOSS.stats.hp,
    ability: SUBCLASS_BOSS.ability,
    imageFile: SUBCLASS_BOSS.imageFile,
    cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0, succ: 0, bast: 0, sorc: 0, berz: 0, boss_ability: 0 },
    undead: false,
    dodge: false,
    reflect: false,
    bleed_stacks: 0,
    bleedPercentPerStack: 0,
    maso_taken: 0,
    familiarStacks: 0,
    shield: 0,
    spectralMarked: false,
    spectralMarkBonus: 0,
    stunned: false,
    stunnedTurns: 0,
    _labrysBleedPercent: 0,
  };
}
