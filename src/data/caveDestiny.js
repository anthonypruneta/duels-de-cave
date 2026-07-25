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
    name: 'Gagner le tournoi (sérieusement)',
    icon: '🏆',
    desc: 'Tu veux la couronne du samedi. Ou au moins ne pas out T1.',
    effects: { renommee: 8, puissance: 4, or: -2 },
  },
  {
    id: 'donjons',
    name: 'Clear tous les donjons',
    icon: '🏰',
    desc: 'Forêt, Tour, Extension… tu veux tout farm. Même mal.',
    effects: { endurance: 5, magie: 3, or: 4 },
  },
  {
    id: 'forge',
    name: 'Forger chez Ornn',
    icon: '🔨',
    desc: 'Upgrade d’arme ou mort héroïque. Pas d’entre-deux.',
    effects: { puissance: 5, endurance: 3, or: -4 },
  },
  {
    id: 'ombres',
    name: 'Devenir un tryhard du classement',
    icon: '🪞',
    desc: 'Miroir, Cataclysme, Labyrinthe : les modes qui exposent les caves.',
    effects: { vitesse: 6, magie: 3, charisme: -2 },
  },
];

export const CAVE_DESTINY_MENTORS = [
  {
    id: 'tavernier',
    name: 'Le Tavernier',
    icon: '🍺',
    desc: 'Il a vu tous les caves. Il te parie quand même dessus.',
    effects: { charisme: 8, or: 6, moral: 5 },
  },
  {
    id: 'forgeron',
    name: 'Un main Forge random',
    icon: '⚒️',
    desc: 'Peu de mots. Beaucoup de « skill issue ».',
    effects: { puissance: 6, endurance: 5, or: -3 },
  },
  {
    id: 'archimage',
    name: 'Le theoricraft Discord',
    icon: '🔮',
    desc: 'Il lit les patch notes. Toi non. Alliance bizarre.',
    effects: { magie: 9, vitesse: 2, moral: -2 },
  },
  {
    id: 'champion',
    name: 'Un ancien top 1',
    icon: '👑',
    desc: 'Il a tout gagné. Puis tilt. Il veut que tu fasses moins pire.',
    effects: { renommee: 6, puissance: 4, charisme: 3 },
  },
];

export const CAVE_DESTINY_WEAPONS = [
  {
    id: 'epee',
    name: 'Main Épée',
    icon: '⚔️',
    weaponHint: 'Zweihänder',
    desc: 'Simple. Efficace. Parfait pour un cave qui veut frapper fort.',
    effects: { puissance: 7, vitesse: 2 },
  },
  {
    id: 'baton',
    name: 'Main Bâton',
    icon: '🪄',
    weaponHint: 'Branche d’Yggdrasil',
    desc: 'Tu joues support / mage. Ou tu croies jouer support.',
    effects: { magie: 7, endurance: 2 },
  },
  {
    id: 'dague',
    name: 'Main Dague',
    icon: '🗡️',
    weaponHint: 'Lævateinn',
    desc: 'Crits, esquives, ego fragile.',
    effects: { vitesse: 7, puissance: 2 },
  },
  {
    id: 'bouclier',
    name: 'Main Bouclier',
    icon: '🛡️',
    weaponHint: 'Égide d’Athéna',
    desc: 'Tu prends les coups. Mentale de mur (parfois).',
    effects: { endurance: 8, charisme: 2 },
  },
];

export const CAVE_DESTINY_TIERS = [
  { minScore: 0, id: 'bronze_cave', label: 'Cave bronze', color: 'text-stone-300' },
  { minScore: 120, id: 'cave_confirme', label: 'Cave confirmé', color: 'text-emerald-300' },
  { minScore: 200, id: 'semi_cerveau', label: 'Semi-cerveau', color: 'text-blue-300' },
  { minScore: 280, id: 'presque_fort', label: 'Presque fort', color: 'text-amber-300' },
  { minScore: 360, id: 'goat_local', label: 'Goat local', color: 'text-yellow-200' },
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
