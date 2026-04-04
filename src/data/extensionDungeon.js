/**
 * Donjon Extension du Territoire
 *
 * Boss unique : Satoru Gojo
 * Accessible uniquement avec un passif Tour du Mage niveau 3.
 * Récompense : garder son passif actuel + ajout d'un passif niveau 1 (nom mixé).
 */

import { getMageTowerPassiveById, getMageTowerPassiveLevel, getAvailablePassives } from './mageTowerPassives';

export const EXTENSION_BOSS = {
  id: 'gojo',
  nom: 'Satoru Gojo',
  icon: '👁️',
  imageFile: 'Satoru Gojo.png',
  stats: {
    hp: 430,
    auto: 120,
    def: 80,
    cap: 120,
    rescap: 80,
    spd: 120,
  },
  spells: {
    2: {
      name: 'Sort Originel, Bleu',
      color: 'bleu',
      description: 'Attaque en premier. Inflige Auto + 50% CAP en dégâts.',
      attackFirst: true,
      damage: { autoScale: 1, capScale: 0.5 },
      stun: 0,
    },
    4: {
      name: 'Sort Inversé, Rouge',
      color: 'rouge',
      description: 'Attaque en second. Inflige Auto + 25% CAP et étourdit 1 tour.',
      attackFirst: false,
      damage: { autoScale: 1, capScale: 0.25 },
      stun: 1,
    },
    6: {
      name: 'Équation Imaginaire, Violet',
      color: 'violet',
      description: 'Inflige Auto + 50% de la vie actuelle de l\'adversaire.',
      attackFirst: true,
      damage: { autoScale: 1, targetHpPercent: 0.5 },
      stun: 0,
    },
  },
};

/**
 * Noms mixés pour l'affichage (passif principal + passif secondaire).
 * Clé = id1_id2 (ordre alphabétique pour unicité).
 * Ex. Orbe du Sacrifice Sanguin + Pacte de la Licorne → Orbe du Sacrifice de la Licorne
 */
const MIXED_PASSIVE_NAMES = {
  // Barrière arcanique + ...
  arcane_barrier_aura_overload: 'Barrière Surchargée',
  arcane_barrier_elemental_fury: 'Barrière de Foudre',
  arcane_barrier_essence_drain: 'Barrière Sanguine',
  arcane_barrier_mind_breach: 'Barrière Brèche',
  arcane_barrier_obsidian_skin: 'Barrière d\'Obsidienne',
  arcane_barrier_onction_eternite: 'Onction Arcanique',
  arcane_barrier_orbe_sacrifice: 'Barrière du Sacrifice',
  arcane_barrier_rituel_fracture: 'Barrière de Fracture',
  arcane_barrier_spectral_mark: 'Barrière Spectrale',
  arcane_barrier_unicorn_pact: 'Barrière de la Licorne',
  // Surcharge d'aura + ...
  aura_overload_elemental_fury: 'Furie Surchargée',
  aura_overload_essence_drain: 'Vol Surchargé',
  aura_overload_mind_breach: 'Brèche Surchargée',
  aura_overload_obsidian_skin: 'Obsidienne Surchargée',
  aura_overload_onction_eternite: 'Onction Surchargée',
  aura_overload_orbe_sacrifice: 'Sacrifice Surchargé',
  aura_overload_rituel_fracture: 'Rituel Surchargé',
  aura_overload_spectral_mark: 'Marque Surchargée',
  aura_overload_unicorn_pact: 'Pacte Surchargé',
  // Furie élémentaire + ...
  elemental_fury_essence_drain: 'Furie Sanguine',
  elemental_fury_mind_breach: 'Furie Brèche',
  elemental_fury_obsidian_skin: 'Furie d\'Obsidienne',
  elemental_fury_onction_eternite: 'Furie d\'Éternité',
  elemental_fury_orbe_sacrifice: 'Orbe du Sacrifice de Foudre',
  elemental_fury_rituel_fracture: 'Furie de Fracture',
  elemental_fury_spectral_mark: 'Furie Spectrale',
  elemental_fury_unicorn_pact: 'Furie de la Licorne',
  // Vol d'essence + ...
  essence_drain_mind_breach: 'Vol Brèche',
  essence_drain_obsidian_skin: 'Vol d\'Obsidienne',
  essence_drain_onction_eternite: 'Onction Sanguine',
  essence_drain_orbe_sacrifice: 'Orbe du Sacrifice Sanguin',
  essence_drain_rituel_fracture: 'Vol de Fracture',
  essence_drain_spectral_mark: 'Vol Spectral',
  essence_drain_unicorn_pact: 'Pacte Sanguin',
  // Brèche mentale + ...
  mind_breach_obsidian_skin: 'Brèche d\'Obsidienne',
  mind_breach_onction_eternite: 'Brèche d\'Éternité',
  mind_breach_orbe_sacrifice: 'Brèche du Sacrifice',
  mind_breach_rituel_fracture: 'Rituel Brèche',
  mind_breach_spectral_mark: 'Brèche Spectrale',
  mind_breach_unicorn_pact: 'Brèche de la Licorne',
  // Peau d'obsidienne + ...
  obsidian_skin_onction_eternite: 'Onction d\'Obsidienne',
  obsidian_skin_orbe_sacrifice: 'Sacrifice d\'Obsidienne',
  obsidian_skin_rituel_fracture: 'Rituel d\'Obsidienne',
  obsidian_skin_spectral_mark: 'Obsidienne Spectrale',
  obsidian_skin_unicorn_pact: 'Pacte d\'Obsidienne',
  // Onction d'Éternité + ...
  onction_eternite_orbe_sacrifice: 'Onction du Sacrifice',
  onction_eternite_rituel_fracture: 'Onction de Fracture',
  onction_eternite_spectral_mark: 'Onction Spectrale',
  onction_eternite_unicorn_pact: 'Onction de la Licorne',
  // Orbe du Sacrifice Sanguin + ...
  orbe_sacrifice_rituel_fracture: 'Orbe du Sacrifice de Fracture',
  orbe_sacrifice_spectral_mark: 'Orbe du Sacrifice Spectrale',
  orbe_sacrifice_unicorn_pact: 'Orbe du Sacrifice de la Licorne',
  // Rituel de Fracture + ...
  rituel_fracture_spectral_mark: 'Rituel Spectrale',
  rituel_fracture_unicorn_pact: 'Rituel de la Licorne',
  // Marque spectrale + Pacte de la Licorne
  spectral_mark_unicorn_pact: 'Marque de la Licorne',
};

function getMixedKey(id1, id2) {
  if (!id1 || !id2) return null;
  const sorted = [id1, id2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

/**
 * Retourne le nom mixé pour l'affichage (passif principal + passif secondaire)
 */
export function getMixedPassiveDisplayName(primaryPassiveId, secondaryPassiveId) {
  const key = getMixedKey(primaryPassiveId, secondaryPassiveId);
  return (key && MIXED_PASSIVE_NAMES[key]) || null;
}

/** Taux de drop du niveau du passif d'extension : 90% niv.1, 9% niv.2, 1% niv.3 */
const EXTENSION_LEVEL_DROP_RATES = [
  { level: 1, threshold: 0.90 },
  { level: 2, threshold: 0.99 },  // 90% + 9%
  { level: 3, threshold: 1.00 },   // + 1%
];

/** Libellé des taux pour affichage (90% niv.1, 9% niv.2, 1% niv.3) */
export const EXTENSION_LEVEL_DROP_LABEL = '90% niv.1, 9% niv.2, 1% niv.3';

/**
 * Retourne les passifs éligibles comme secondaire : tous sauf le passif principal
 * et, si présent, le passif d'extension déjà équipé (évite un doublon inutile).
 * @param {string} primaryPassiveId - Passif Tour du Mage (niv. 3)
 * @param {string|null|undefined} extensionPassiveId - Passif extension actuel, à exclure du pool
 */
export function getExtensionPassiveOptions(primaryPassiveId, extensionPassiveId = null) {
  const available = getAvailablePassives();
  return available
    .filter((p) => p.id !== primaryPassiveId && (extensionPassiveId == null || p.id !== extensionPassiveId))
    .map((p) => ({ id: p.id, name: p.name, icon: p.icon }));
}

/**
 * Tire un niveau pour le passif d'extension (90% niv.1, 9% niv.2, 1% niv.3).
 */
export function rollExtensionPassiveLevel() {
  const r = Math.random();
  for (const { level, threshold } of EXTENSION_LEVEL_DROP_RATES) {
    if (r < threshold) return level;
  }
  return 1;
}

/**
 * Tire un passif d'extension aléatoire parmi les éligibles, avec un niveau tiré (90% niv.1, 9% niv.2, 1% niv.3).
 * @param {string} primaryPassiveId
 * @param {string|null|undefined} extensionPassiveId - Exclu du tirage s'il existe déjà une extension
 */
export function rollExtensionPassive(primaryPassiveId, extensionPassiveId = null) {
  const options = getExtensionPassiveOptions(primaryPassiveId, extensionPassiveId);
  if (options.length === 0) return null;
  const picked = options[Math.floor(Math.random() * options.length)];
  const level = rollExtensionPassiveLevel();
  return { ...picked, level };
}

/**
 * Crée le combattant Gojo pour le combat
 */
export function createExtensionBossCombatant() {
  return {
    name: EXTENSION_BOSS.nom,
    bossId: EXTENSION_BOSS.id,
    isBoss: true,
    base: { ...EXTENSION_BOSS.stats },
    currentHP: EXTENSION_BOSS.stats.hp,
    maxHP: EXTENSION_BOSS.stats.hp,
    ability: { type: 'gojo_turn_spells', spells: EXTENSION_BOSS.spells },
    imageFile: EXTENSION_BOSS.imageFile,
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

/**
 * Indique si le joueur a accès au donjon (passif niveau 3)
 */
export function canAccessExtensionDungeon(mageTowerPassive) {
  return mageTowerPassive?.level === 3 && mageTowerPassive?.id;
}

/**
 * Données pour l'affichage du passif fusionné (principal + extension).
 * @param {Object} character - { mageTowerPassive, mageTowerExtensionPassive }
 * @returns {{ mixedName: string, displayLabel: string, primaryDetails: Object, extensionDetails: Object } | null}
 */
export function getFusedPassiveDisplayData(character) {
  const primary = character?.mageTowerPassive;
  const extension = character?.mageTowerExtensionPassive;
  if (!primary?.id || !extension?.id) return null;
  const primaryBase = getMageTowerPassiveById(primary.id);
  const primaryLevelData = getMageTowerPassiveLevel(primary.id, primary.level);
  const extLevel = extension.level ?? 1;
  const extensionBase = getMageTowerPassiveById(extension.id);
  const extensionLevelData = getMageTowerPassiveLevel(extension.id, extLevel);
  if (!primaryBase || !primaryLevelData || !extensionBase || !extensionLevelData) return null;
  const mixedName = getMixedPassiveDisplayName(primary.id, extension.id) || `${primaryBase.name} + ${extensionBase.name}`;
  const displayLabel = extLevel > 1 ? `${mixedName}, niveau ${extLevel}` : mixedName;
  return {
    mixedName,
    displayLabel,
    primaryDetails: { ...primaryBase, level: primary.level, levelData: primaryLevelData },
    extensionDetails: { ...extensionBase, level: extLevel, levelData: extensionLevelData },
  };
}
