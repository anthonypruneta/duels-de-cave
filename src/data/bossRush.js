/**
 * Boss Rush — Données des 6 boss normalisés
 *
 * Stats calibrées sur l'étage 80 du Labyrinthe Infini :
 *   base 17 × mult 3.694 × boss 1.15 ≈ 72 (stats)
 *   base 132 × mult 3.694 × boss 1.4  ≈ 683 (HP)
 *
 * Chaque boss garde ses abilities uniques d'origine.
 * Gojo et Koro Sensei conservent une distribution asymétrique proportionnelle.
 */

const BOSS_RUSH_BOSSES = [
  {
    id: 'dragon',
    nom: 'Vyraxion le Dévoreur',
    icon: '🐲',
    imageFile: 'dragon.png',
    imageSource: 'bosses',
    stats: { hp: 683, auto: 72, def: 72, cap: 72, rescap: 72, spd: 72 },
    ability: {
      nom: 'Souffle de Flammes',
      name: 'Souffle de Flammes',
      description: 'Tous les 5 tours, inflige +50% de dégâts magiques.',
      cooldown: 5,
      trigger: 'every_n_turns',
      effect: { type: 'spell_boost', damageBonus: 0.5 },
    },
  },
  {
    id: 'licorne',
    nom: 'Licorne',
    icon: '🦄',
    imageFile: 'licorne.png',
    imageSource: 'bosses',
    stats: { hp: 683, auto: 72, def: 72, cap: 72, rescap: 72, spd: 72 },
    ability: {
      type: 'unicorn_cycle',
      name: 'Alternance mystique',
      description: 'Un tour sur deux, modifie les dégâts infligés et reçus.',
    },
  },
  {
    id: 'lich',
    nom: 'Liche',
    icon: '🧟',
    imageFile: 'liche.png',
    imageSource: 'bosses',
    stats: { hp: 683, auto: 72, def: 72, cap: 72, rescap: 72, spd: 72 },
    ability: {
      type: 'lich_shield',
      name: 'Barrière macabre',
      description: 'Début du combat: bouclier 20% HP. À la rupture: explosion 20% HP une fois.',
    },
  },
  {
    id: 'ornn',
    nom: 'Ornn, le Dieu de la Forge',
    icon: '🔨',
    imageFile: 'Ornn, le Dieu de la Forge.png',
    imageSource: 'forge',
    stats: { hp: 683, auto: 72, def: 72, cap: 72, rescap: 72, spd: 72 },
    ability: {
      type: 'forge_god_spell',
      name: 'Appel du dieu de la forge',
      description: 'Inflige Auto + 50% CAP et étourdit 1 tour.',
      cooldown: 5,
      effect: { capScale: 0.5, stunDuration: 1 },
    },
  },
  {
    id: 'gojo',
    nom: 'Satoru Gojo',
    icon: '👁️',
    imageFile: 'Satoru Gojo.png',
    imageSource: 'extension',
    stats: { hp: 683, auto: 86, def: 57, cap: 86, rescap: 57, spd: 86 },
    ability: {
      type: 'gojo_turn_spells',
      name: 'Sorts dimensionnels',
      description: 'Tours 2/4/6 : sorts Bleu, Rouge et Violet aux effets dévastateurs.',
      spells: {
        2: { name: 'Sort Originel, Bleu', attackFirst: true, damage: { autoScale: 1, capScale: 0.5 }, stun: 0 },
        4: { name: 'Sort Inversé, Rouge', attackFirst: false, damage: { autoScale: 1, capScale: 0.25 }, stun: 1 },
        6: { name: 'Équation Imaginaire, Violet', attackFirst: true, damage: { autoScale: 1, targetHpPercent: 0.5 }, stun: 0 },
      },
    },
  },
  {
    id: 'koro_sensei',
    nom: 'Koro Sensei',
    icon: '🎓',
    imageFile: 'Koro Sensei.png',
    imageSource: 'subclass',
    stats: { hp: 683, auto: 61, def: 82, cap: 61, rescap: 82, spd: 72 },
    ability: {
      type: 'trainer_spell',
      name: 'Leçon du maître',
      description: 'Inflige Auto + 30% CAP. Réduit les dégâts de la prochaine attaque adverse de 15%.',
      cooldown: 4,
      effect: { capScale: 0.3, nextAttackReduction: 0.15 },
    },
  },
];

export function getBossRushBosses() {
  return BOSS_RUSH_BOSSES;
}

export function getBossRushBoss(index) {
  return BOSS_RUSH_BOSSES[index] || null;
}

/**
 * Crée un combattant boss pour simulerMatch (données brutes).
 */
export function createBossRushCombatant(index) {
  const boss = BOSS_RUSH_BOSSES[index];
  if (!boss) return null;

  return {
    name: boss.nom,
    race: 'Boss',
    class: 'Boss',
    isBoss: true,
    bossId: boss.id,
    imageFile: boss.imageFile,
    imageSource: boss.imageSource,
    base: { ...boss.stats },
    bonuses: { race: {}, class: {} },
    currentHP: boss.stats.hp,
    maxHP: boss.stats.hp,
    cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0, succ: 0, bast: 0, boss_ability: 0 },
    undead: false,
    dodge: false,
    reflect: false,
    bleed_stacks: 0,
    bleedPercentPerStack: 0,
    maso_taken: 0,
    familiarStacks: 0,
    shield: 0,
    shieldExploded: false,
    stunned: false,
    stunnedTurns: 0,
    sireneStacks: 0,
    spectralMarked: false,
    spectralMarkBonus: 0,
    boneGuardActive: false,
    _labrysBleedPercent: 0,
    ability: boss.ability,
    passive: null,
  };
}

export const BOSS_RUSH_COUNT = BOSS_RUSH_BOSSES.length;
