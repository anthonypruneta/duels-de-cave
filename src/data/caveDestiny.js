/**
 * Cave Destiny — données du mode carrière (inspiré Destiny Eleven)
 * Premier choix : 3 personnages tirés au hasard parmi les persos réels de Duels de Cave.
 */

import { races } from './races';
import { classes } from './classes';

/** Classes plutôt orientées magie (progression Cave Destiny) */
const MAGIC_CLASSES = new Set([
  'Mage', 'Healer', 'Demoniste', 'Sorcière', 'Alchimiste', 'Succube', 'Briseur de Sort',
]);

/** Classes plutôt orientées vitesse / critique */
const SPEED_CLASSES = new Set(['Voleur', 'Archer', 'Gnome']);

/**
 * Convertit un document personnage Firestore en profil jouable Cave Destiny.
 */
export function buildDestinyCharacterFromGame(char) {
  const level = Number(char.level) || 1;
  const base = char.base || {};
  const race = char.race || 'Humain';
  const classe = char.class || 'Guerrier';
  const name = char.name || 'Sans nom';
  const ownerPseudo = char.ownerPseudo || null;
  const raceBonus = races[race]?.bonus || '';
  const classAbility = classes[classe]?.ability || '';

  /**
   * Conversion volontairement plate : tout le monde démarre bas.
   * Le perso réel n’apporte qu’une légère coloration (≈ 14–24),
   * le niveau compte à peine. La carrière fait le reste.
   */
  const scaleStat = (value, fallback = 18) => {
    const v = Number(value);
    const raw = Number.isFinite(v) ? v : fallback;
    const t = Math.max(0, Math.min(1, (raw - 12) / 30));
    return Math.round(14 + t * 10 + Math.min(level, 100) * 0.02);
  };

  // HP jeu (~120–200) ne doit pas exploser l’endurance Destiny
  const enduranceSource = Number.isFinite(Number(base.def))
    ? Number(base.def)
    : Number.isFinite(Number(base.hp))
      ? Number(base.hp) / 8
      : 18;

  return {
    id: char.id || char.userId,
    name,
    race,
    class: classe,
    level,
    characterImage: char.characterImage || null,
    ownerPseudo,
    gender: char.gender || null,
    keyword: char.keyword || null,
    tagline: ownerPseudo ? `${ownerPseudo} · Niv. ${level}` : `Niv. ${level}`,
    blurb: raceBonus
      ? `${race} ${classe} — ${String(raceBonus).split('\n')[0]}`
      : `${race} ${classe} de Duels de Cave.`,
    playstyle: classAbility || `${race} · ${classe}`,
    baseStats: {
      puissance: scaleStat(base.auto, 18),
      endurance: scaleStat(enduranceSource, 18),
      magie: scaleStat(base.cap, 18),
      vitesse: scaleStat(base.spd, 18),
      charisme: Math.round(16 + Math.min(level, 100) * 0.04),
    },
    trait: races[race]?.awakening?.description
      ? `Héritage de race : ${String(races[race].awakening.description).split('\n')[0]}`
      : `Vous incarnez ${name}, un vrai perso de Duels de Cave.`,
    prefersMagic: MAGIC_CLASSES.has(classe) || race === 'Elfe' || race === 'Sirène' || race === 'Mindflayer',
    prefersSpeed: SPEED_CLASSES.has(classe) || race === 'Elfe' || race === 'Gnome' || race === 'Écailleux',
    prefersGrit: race === 'Orc' || race === 'Cendrés' || classe === 'Berserk' || classe === 'Masochiste',
    prefersRebound: race === 'Mort-vivant' || race === 'Turtlekin' || classe === 'Paladin' || classe === 'Bastion',
  };
}

function randomInt(max) {
  if (max <= 0) return 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function hasCharacterImage(char) {
  const img = char?.characterImage;
  return typeof img === 'string' && /^https?:\/\//i.test(img.trim());
}

/**
 * Tire `count` personnages distincts au hasard dans TOUT le pool
 * (plus de restriction aux seuls persos avec image — c’était ça qui
 * renvoyait toujours les mêmes 3).
 * Évite autant que possible les IDs récemment proposés.
 */
export function pickRandomGameCharacters(allCharacters, count = 3, options = {}) {
  const excludeIds = new Set((options.excludeIds || []).map(String));
  const active = (allCharacters || []).filter(
    (c) => c && !c.disabled && c.name && c.race && c.class
  );

  if (active.length === 0) return [];

  let pool = active.filter((c) => !excludeIds.has(String(c.id || c.userId)));
  // Si trop peu restent, élargit progressivement
  if (pool.length < count) {
    const recent = (options.excludeIds || []).map(String);
    const softExclude = new Set(recent.slice(0, Math.max(0, recent.length - count * 2)));
    pool = active.filter((c) => !softExclude.has(String(c.id || c.userId)));
  }
  if (pool.length < count) pool = [...active];

  const ordered = shuffleInPlace([...pool]);
  return ordered.slice(0, count).map(buildDestinyCharacterFromGame);
}

export const LAST_OFFERED_STORAGE_KEY = 'caveDestiny:lastOfferedIds';
export const LAST_OFFERED_HISTORY_LIMIT = 24;

export { CAVE_DESTINY_EVENTS, getOptionsForEvent, trio } from './caveDestinyEvents';

export const CAVE_DESTINY_AMBITIONS = [
  {
    id: 'tournoi',
    name: 'Couronne du samedi',
    icon: '🏆',
    desc: 'Vaincre l’arène du tournoi et graver son nom au Hall of Fame.',
    effects: { renommee: 4, puissance: 3, or: -2 },
  },
  {
    id: 'donjons',
    name: 'Maître des donjons',
    icon: '🏰',
    desc: 'Forêt enchantée, Tour du Mage, Grotte aux merveilles, Extension… tout explorer.',
    effects: { endurance: 3, magie: 2, or: 3 },
  },
  {
    id: 'forge',
    name: 'Forgé par Ornn',
    icon: '🔨',
    desc: 'Impressionner le Dieu de la Forge et reforger une arme légendaire.',
    effects: { puissance: 3, endurance: 2, or: -3 },
  },
  {
    id: 'ombres',
    name: 'Affronter les épreuves sombres',
    icon: '🪞',
    desc: 'Miroir, Cataclysme, Labyrinthe Infini : là où la légende se juge.',
    effects: { vitesse: 4, magie: 2, charisme: -1 },
  },
];

export const CAVE_DESTINY_MENTORS = [
  {
    id: 'tavernier',
    name: 'Le Tavernier',
    icon: '🍺',
    desc: 'Il a vu naître et tomber des champions. Il parie encore sur vous.',
    effects: { charisme: 8, or: 6, moral: 5 },
  },
  {
    id: 'forgeron',
    name: 'L’apprenti d’Ornn',
    icon: '⚒️',
    desc: 'Peu de mots. Beaucoup de martelage. Il juge le fer… et le bras.',
    effects: { puissance: 6, endurance: 5, or: -3 },
  },
  {
    id: 'archimage',
    name: 'Un archimage de la Tour',
    icon: '🔮',
    desc: 'Il connaît les passifs des étages. Vous, pas encore. Alliance précieuse.',
    effects: { magie: 9, vitesse: 2, moral: -2 },
  },
  {
    id: 'champion',
    name: 'Un ancien vainqueur',
    icon: '👑',
    desc: 'Il a porté la couronne. Puis s’est retiré. Il veut un digne successeur.',
    effects: { renommee: 6, puissance: 4, charisme: 3 },
  },
  {
    id: 'forestier',
    name: 'Le forestier de la Forêt enchantée',
    icon: '🌲',
    desc: 'Il connaît chaque clairière, chaque embuscade, chaque murmure d’arbre.',
    effects: { endurance: 5, vitesse: 4, or: 3 },
  },
  {
    id: 'bibliothecaire',
    name: 'Le bibliothécaire de l’Encyclopédie',
    icon: '📚',
    desc: 'Bestiaires, lignées d’armes, notes de vainqueurs : tout est dans sa tête.',
    effects: { magie: 6, charisme: 3, moral: 3 },
  },
  {
    id: 'parieur',
    name: 'Un parieur de la Taverne',
    icon: '🎲',
    desc: 'Il lit les cotes mieux que les sorts. Chance… ou arnaque.',
    effects: { or: 10, charisme: 4, moral: -2 },
  },
  {
    id: 'guetteur',
    name: 'Le Guetteur du Labyrinthe',
    icon: '🌀',
    desc: 'Cent vingt étages dans les yeux. Il sait quand un couloir ment.',
    effects: { vitesse: 7, magie: 3, forme: -3 },
  },
  {
    id: 'nain_forge',
    name: 'Un maître-nain de la Forge',
    icon: '⛏️',
    desc: 'Il a vu Ornn travailler. Il ne le dira jamais… mais il enseigne.',
    effects: { endurance: 7, puissance: 4, or: -2 },
  },
  {
    id: 'spectre_tour',
    name: 'Un spectre de la Tour du Mage',
    icon: '👻',
    desc: 'Ancien aspirant. Il murmure les passifs oubliés entre deux étages.',
    effects: { magie: 8, vitesse: 3, moral: -3 },
  },
  {
    id: 'veteran_red',
    name: 'Un vétéran de l’arène de Red',
    icon: '🔴',
    desc: 'Il a survécu à Dracaufeu. Deux fois. Il parle encore trop fort.',
    effects: { puissance: 5, charisme: 4, endurance: 2 },
  },
  {
    id: 'messager_hall',
    name: 'Un messager du Hall of Fame',
    icon: '📜',
    desc: 'Il grave les noms. Il sait lesquels méritent l’encre… et lesquels non.',
    effects: { renommee: 8, charisme: 3, moral: 2 },
  },
];

/** Nombre de mentors proposés au tirage (parmi le pool complet). */
export const CAVE_DESTINY_MENTOR_OFFER_COUNT = 4;

/** Nombre d’armes communes proposées au tirage. */
export const CAVE_DESTINY_WEAPON_OFFER_COUNT = 4;

export function pickRandomMentors(count = CAVE_DESTINY_MENTOR_OFFER_COUNT) {
  const pool = [...CAVE_DESTINY_MENTORS];
  return shuffleInPlace(pool).slice(0, Math.min(count, pool.length));
}

export {
  pickRandomCommonWeapons,
  getDestinyWeaponById,
  buildDestinyWeapon,
  upgradeDestinyWeapon,
  grantLegendaryDestinyWeapon,
  fillWeaponPlaceholders,
  isWeaponMaxed,
  WEAPON_RARITY_LABEL,
} from './caveDestinyWeapons';

/** @deprecated — utiliser pickRandomCommonWeapons / getDestinyWeaponById */
export const CAVE_DESTINY_WEAPONS = [];

export const CAVE_DESTINY_TIERS = [
  { minScore: 0, id: 'bronze_cave', label: 'Cave bronze', color: 'text-stone-300' },
  { minScore: 120, id: 'cave_confirme', label: 'Cave confirmé', color: 'text-emerald-300' },
  { minScore: 200, id: 'aventurier', label: 'Aventurier', color: 'text-blue-300' },
  { minScore: 280, id: 'champion_local', label: 'Champion local', color: 'text-amber-300' },
  { minScore: 360, id: 'legende_arene', label: 'Légende de l’arène', color: 'text-yellow-200' },
  { minScore: 440, id: 'mythe', label: 'Mythe des Duels', color: 'text-fuchsia-300' },
];

export const CAVE_DESTINY_SEASON_COUNT = 14;
export const STORAGE_KEY_SAVE = 'caveDestiny:save';
export const STORAGE_KEY_PANTHEON = 'caveDestiny:pantheon';

export function getRaceIcon(race) {
  return races[race]?.icon || '⚔️';
}

export function getClassIcon(classe) {
  return classes[classe]?.icon || '🗡️';
}

export function getClassAbility(classe) {
  return classes[classe]?.ability || '';
}
