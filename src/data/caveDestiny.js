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

  const scaleStat = (value, fallback = 20) => {
    const v = Number(value);
    const raw = Number.isFinite(v) ? v : fallback;
    return Math.round(28 + (raw / 40) * 45 + Math.min(level, 200) * 0.12);
  };

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
      puissance: scaleStat(base.auto, 22),
      endurance: scaleStat(base.def ?? base.hp, 22),
      magie: scaleStat(base.cap, 20),
      vitesse: scaleStat(base.spd, 20),
      charisme: Math.round(38 + Math.min(level, 300) * 0.08),
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
    effects: { renommee: 8, puissance: 4, or: -2 },
  },
  {
    id: 'donjons',
    name: 'Maître des donjons',
    icon: '🏰',
    desc: 'Forêt enchantée, Tour du Mage, Grotte aux merveilles, Extension… tout explorer.',
    effects: { endurance: 5, magie: 3, or: 4 },
  },
  {
    id: 'forge',
    name: 'Forgé par Ornn',
    icon: '🔨',
    desc: 'Impressionner le Dieu de la Forge et reforger une arme légendaire.',
    effects: { puissance: 5, endurance: 3, or: -4 },
  },
  {
    id: 'ombres',
    name: 'Affronter les épreuves sombres',
    icon: '🪞',
    desc: 'Miroir, Cataclysme, Labyrinthe Infini : là où la légende se juge.',
    effects: { vitesse: 6, magie: 3, charisme: -2 },
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
];

export const CAVE_DESTINY_WEAPONS = [
  {
    id: 'epee',
    name: 'Voie de l’épée',
    icon: '⚔️',
    weaponHint: 'Zweihänder',
    desc: 'Lame lourde, coups francs. La voie du guerrier qui avance.',
    effects: { puissance: 7, vitesse: 2 },
  },
  {
    id: 'baton',
    name: 'Voie du bâton',
    icon: '🪄',
    weaponHint: 'Branche d’Yggdrasil',
    desc: 'Arcane et soutien. La sagesse… ou l’illusion de l’avoir.',
    effects: { magie: 7, endurance: 2 },
  },
  {
    id: 'dague',
    name: 'Voie de la dague',
    icon: '🗡️',
    weaponHint: 'Lævateinn',
    desc: 'Critiques, esquives, orgueil fragile entre deux ombres.',
    effects: { vitesse: 7, puissance: 2 },
  },
  {
    id: 'bouclier',
    name: 'Voie du bouclier',
    icon: '🛡️',
    weaponHint: 'Égide d’Athéna',
    desc: 'Encaisser, protéger, tenir le front quand les autres fléchissent.',
    effects: { endurance: 8, charisme: 2 },
  },
];

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
