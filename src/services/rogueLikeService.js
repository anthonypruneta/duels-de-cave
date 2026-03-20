import { db } from '../firebase/config';
import {
  Timestamp,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getDocs,
  query,
  collection,
  orderBy,
  limit,
} from 'firebase/firestore';

import { simulerMatch } from '../utils/tournamentCombat';
import { computeLabyrinthStats, getLabyrinthPhase, getEnemyNameFromFilename, BOSS_TOP_FLOORS, BOSS_TOP_FLOORS_EXTRA_HP } from './infiniteLabyrinthService';
import { races } from '../data/races';
import { getRaceBonus, getClassBonus } from '../data/combatMechanics';
import { getEmptyStatBoosts, applyStatPoints, applyStatBoosts, getStatPointValue } from '../utils/statPoints';
import { classes } from '../data/classes';
import { getMageTowerPassiveById, getMageTowerPassiveLevel, getAvailablePassives } from '../data/mageTowerPassives';
import { canAccessExtensionDungeon, getExtensionPassiveOptions } from '../data/extensionDungeon';
import { getSubclassStatBonuses, getSubclassesForClass } from '../data/subclasses';
import { extractForgeUpgrade, generateForgeUpgradeRollSeeded, hasAnyForgeUpgrade, FORGE_STAT_LABELS } from '../data/forgeDungeon';
import { getWeaponsByRarity, RARITY, getWeaponById } from '../data/weapons';
import { getOwnerPseudoFromAccount } from './characterService';
import { generateForgeUpgradeRoll } from '../data/forgeDungeon';

import { FOREST_LEVELS } from '../data/forestDungeons';
import { MAGE_TOWER_LEVELS } from '../data/mageTowerDungeons';
import { bosses as DUNGEON_BOSSES } from '../data/bosses';

// ============================================================================
// ROGUE-LIKE SERVICE (MVP complet)
// ============================================================================

const BOSS_FLOOR_STEP = 10;
// IMPORTANT MVP : le run ne doit se terminer que par la mort.
// On évite donc d’imposer un plafond “artificiel”.
const MAX_ROGUELIKE_FLOOR = null;

const BASE_DUNGEON_LEVEL_1_STATS = {
  hp: 132,
  auto: 17,
  def: 17,
  cap: 17,
  rescap: 17,
  spd: 17
};

const LEGENDARY_WEAPONS = getWeaponsByRarity(RARITY.LEGENDAIRE);

// Pool d’assets visuels (pour l’affichage). Les pools peuvent être vides
// si les images n’ont pas encore été ajoutées : on fallback sur des emojis.
const LABYRINTH_BOSS_IMAGES = import.meta.glob('../assets/labyrinthe/bosses/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const LABYRINTH_MOB_IMAGES = import.meta.glob('../assets/labyrinthe/mobs/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const CATACLYSM_IMAGES = import.meta.glob('../assets/cataclysme/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const CATACLYSM_CHAMP_BOSS_IMAGES = import.meta.glob('../assets/cataclysme/ChampBoss/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
// Tes assets races sont stockées en sous-dossiers : .../races/<race>/<fichier>.png
// On doit donc inclure récursivement.
const ROGUELIKE_RACE_IMAGES = import.meta.glob('../assets/roguelike/races/**/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });

function stripUndefined(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj !== 'object') return obj;
  if (Object.getPrototypeOf(obj) !== Object.prototype) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = stripUndefined(v);
  }
  return out;
}

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function hash() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  return function rng() {
    // eslint-disable-next-line no-param-reassign
    seed = (seed + 0x6D2B79F5) | 0;
    // eslint-disable-next-line no-bitwise
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    // eslint-disable-next-line no-bitwise
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededRng(seedString) {
  const seedFactory = xmur3(seedString);
  return mulberry32(seedFactory());
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function pickSeeded(list, rng) {
  if (!list || list.length === 0) return null;
  const idx = Math.floor(rng() * list.length);
  return list[clamp(idx, 0, list.length - 1)];
}

function pickNUniqueSeeded(list, n, rng) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const pool = [...list];
  const out = [];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i += 1) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(clamp(idx, 0, pool.length - 1), 1)[0]);
  }
  return out;
}

function rollForestRewards(rolls, baseBoosts = {}) {
  const statsPool = ['hp', 'auto', 'def', 'rescap', 'spd', 'cap'];
  const updatedBoosts = { ...getEmptyStatBoosts(), ...(baseBoosts || {}) };
  const totalPointsByStat = {};

  for (let i = 0; i < rolls; i += 1) {
    const stat = statsPool[i % statsPool.length];
    totalPointsByStat[stat] = (totalPointsByStat[stat] || 0) + 1;
  }

  // NOTE: la version déterministe “vraie” est gérée plus bas (on passe rng)
  // ici on garde une version utile pour fallback si rolls = 0.

  const gainsByStat = {};
  let boosts = updatedBoosts;
  Object.entries(totalPointsByStat).forEach(([stat, points]) => {
    const { updatedStats, delta } = applyStatPoints(boosts, stat, points);
    boosts = updatedStats;
    gainsByStat[stat] = (gainsByStat[stat] || 0) + delta;
  });

  return { updatedBoosts: boosts, gainsByStat };
}

function rollForestRewardsSeeded(rolls, baseBoosts, rng) {
  const statsPool = ['hp', 'auto', 'def', 'rescap', 'spd', 'cap'];
  let boosts = { ...getEmptyStatBoosts(), ...(baseBoosts || {}) };
  const pointsByStat = {};

  for (let i = 0; i < rolls; i += 1) {
    const stat = statsPool[Math.floor(rng() * statsPool.length)];
    pointsByStat[stat] = (pointsByStat[stat] || 0) + 1;
  }

  const gainsByStat = {};
  Object.entries(pointsByStat).forEach(([stat, points]) => {
    const { updatedStats, delta } = applyStatPoints(boosts, stat, points);
    boosts = updatedStats;
    gainsByStat[stat] = (gainsByStat[stat] || 0) + delta;
  });

  return { updatedBoosts: boosts, gainsByStat };
}

function rollMageTowerPassivePairSeeded(level, rng) {
  const available = getAvailablePassives();
  const count = Math.min(3, available.length);
  const picked = pickNUniqueSeeded(available, count, rng);
  return picked.map((p) => ({ id: p.id, level }));
}

const EXTENSION_LEVEL_DROP_RATES = [
  { level: 1, threshold: 0.90 },
  { level: 2, threshold: 0.99 },
  { level: 3, threshold: 1.00 },
];

function rollExtensionPassiveLevelSeeded(rng) {
  const r = rng();
  for (const { level, threshold } of EXTENSION_LEVEL_DROP_RATES) {
    if (r < threshold) return level;
  }
  return 1;
}

function rollExtensionPassiveSeeded(currentPassiveId, rng) {
  const options = getExtensionPassiveOptions(currentPassiveId);
  if (!options || options.length === 0) return null;
  const chosen = pickSeeded(options, rng);
  const level = rollExtensionPassiveLevelSeeded(rng);
  return { id: chosen.id, level };
}

function buildImageListFromGlob(globModules) {
  return Object.entries(globModules).map(([sourcePath, imagePath]) => {
    const src = String(sourcePath ?? '');
    const file = src.split(/[\\/]/).pop() || '';
    const imageName = file.replace(/\.[^/.]+$/, '');
    return {
      sourcePath,
      imagePath,
      imageName,
    };
  });
}

const LAB_BOSS_LIST = buildImageListFromGlob(LABYRINTH_BOSS_IMAGES);
const LAB_MOB_LIST = buildImageListFromGlob(LABYRINTH_MOB_IMAGES);
const CATACLYSM_LIST = buildImageListFromGlob(CATACLYSM_IMAGES);
const CATACLYSM_CHAMP_LIST = buildImageListFromGlob(CATACLYSM_CHAMP_BOSS_IMAGES);
const ROGUELIKE_RACE_LIST = buildImageListFromGlob(ROGUELIKE_RACE_IMAGES);

function normalizeForImageKey(input) {
  const s = String(input ?? '');
  // Supprime accents + minuscule (ex: “Elfe” -> “elfe”)
  const noAccents = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return noAccents.toLowerCase().trim().replace(/\s+/g, '-');
}

function getRogueLikeRaceSlug(raceName) {
  // Les fichiers simple races suivent un slug utilisé côté projet images.
  // Dans le code, les noms de races peuvent être différents (ex: “Elfe” => “elf”).
  const normalized = normalizeForImageKey(raceName);
  switch (normalized) {
    case 'elfe':
      return 'elf';
    default:
      return normalized;
  }
}

const ROGUELIKE_IMAGE_BY_NORMALIZED_NAME = new Map(
  ROGUELIKE_RACE_LIST.map((it) => [normalizeForImageKey(it.imageName), it.imagePath]),
);

function findImagePathByFileName(imageFile) {
  if (!imageFile) return null;
  const fileLower = String(imageFile).toLowerCase();
  const allModules = [LABYRINTH_BOSS_IMAGES, CATACLYSM_IMAGES, CATACLYSM_CHAMP_BOSS_IMAGES, ROGUELIKE_RACE_IMAGES];
  for (const modules of allModules) {
    for (const [sourcePath, imagePath] of Object.entries(modules || {})) {
      const sp = sourcePath.replace(/\\/g, '/').toLowerCase();
      if (sp.endsWith(`/${fileLower}`)) return imagePath;
    }
  }
  return null;
}

function bossTemplateToPoolItem(bossData) {
  if (!bossData) return null;
  return {
    id: bossData.id || bossData.imageFile || null,
    imageName: bossData.nom || getEnemyNameFromFilename(bossData.imageFile || '') || 'Inconnu',
    imagePath: findImagePathByFileName(bossData.imageFile),
    imageFile: bossData.imageFile || null,
    icon: bossData.icon || null,
  };
}

// “Mobs basic” : labyrinthe mobs (+) 2 premiers niveaux des donjons (visuels uniquement)
const BASIC_FOREST_MOBS = FOREST_LEVELS
  .filter((l) => l.niveau <= 2)
  .map((l) => bossTemplateToPoolItem(l.boss))
  .filter(Boolean);
const BASIC_MAGE_TOWER_MOBS = MAGE_TOWER_LEVELS
  .filter((l) => l.niveau <= 2)
  .map((l) => bossTemplateToPoolItem(l.boss))
  .filter(Boolean);
const BASIC_DUNGEON_MOBS = [
  bossTemplateToPoolItem(DUNGEON_BOSSES.chef_gobelin),
  bossTemplateToPoolItem(DUNGEON_BOSSES.bandit),
].filter(Boolean);

const BASIC_MOBS_POOL = [
  ...LAB_MOB_LIST,
  ...BASIC_FOREST_MOBS,
  ...BASIC_MAGE_TOWER_MOBS,
  ...BASIC_DUNGEON_MOBS,
].filter(Boolean);

// “Boss pool” : tout ce qui n’est pas dans le pool mobs basic (visuels uniquement)
const ALL_FOREST_BOSSES = FOREST_LEVELS.map((l) => bossTemplateToPoolItem(l.boss)).filter(Boolean);
const ALL_MAGE_TOWER_BOSSES = MAGE_TOWER_LEVELS.map((l) => bossTemplateToPoolItem(l.boss)).filter(Boolean);
const ALL_DUNGEON_BOSSES = Object.values(DUNGEON_BOSSES || {}).map((b) => bossTemplateToPoolItem(b)).filter(Boolean);

const BOSS_POOL_FOR_VISUALS = [
  ...LAB_BOSS_LIST,
  ...ALL_FOREST_BOSSES,
  ...ALL_MAGE_TOWER_BOSSES,
  ...ALL_DUNGEON_BOSSES,
  ...CATACLYSM_LIST,
  ...CATACLYSM_CHAMP_LIST,
  ...ROGUELIKE_RACE_LIST,
].filter(Boolean);

function getRogueLikeImageForRace(raceName) {
  if (!raceName) return null;
  const key = normalizeForImageKey(getRogueLikeRaceSlug(raceName));
  return ROGUELIKE_IMAGE_BY_NORMALIZED_NAME.get(key) || null;
}

function getRogueLikeImageForRaceClass(raceName, className) {
  if (!raceName || !className) return null;
  const raceKey = normalizeForImageKey(getRogueLikeRaceSlug(raceName));
  const classKey = normalizeForImageKey(className);
  const combinedKey = `${raceKey}-${classKey}`;
  return ROGUELIKE_IMAGE_BY_NORMALIZED_NAME.get(combinedKey) || null;
}

function getRarityLegendaryPool() {
  if (!Array.isArray(LEGENDARY_WEAPONS) || LEGENDARY_WEAPONS.length === 0) return [];
  return LEGENDARY_WEAPONS;
}

function isBossFloor(floorNumber) {
  return floorNumber % BOSS_FLOOR_STEP === 0;
}

function buildNormalEnemy({ floorNumber, runSeed, enemyIndex = 0 }) {
  const rng = createSeededRng(`${runSeed}|enemy|normal|${floorNumber}|${enemyIndex}`);
  const stats = computeLabyrinthStats(BASE_DUNGEON_LEVEL_1_STATS, floorNumber);

  const candidate = pickSeeded(BASIC_MOBS_POOL, rng) || null;
  const enemyName = candidate?.imageName || `Ennemi ${floorNumber}`;
  const imageSource = candidate?.imagePath || null;

  // En MVP : pas de passifs/compétences bosses pour les mobs “basic”
  return {
    id: `enemy-${floorNumber}-${enemyIndex}`,
    name: enemyName,
    race: null,
    class: null,
    level: floorNumber,
    base: { ...stats },
    bonuses: { race: {}, class: {} },
    mageTowerPassive: null,
    mageTowerExtensionPassive: null,
    equippedWeaponId: null,
    forgeUpgrade: null,
    characterImage: imageSource,
  };
}

function buildBossEnemy({ floorNumber, runSeed, enemyIndex = 0 }) {
  const rng = createSeededRng(`${runSeed}|enemy|boss|${floorNumber}|${enemyIndex}`);
  const stats = computeLabyrinthStats(BASE_DUNGEON_LEVEL_1_STATS, floorNumber);
  const phase = getLabyrinthPhase(floorNumber);

  const BOSS_MULTIPLIER = {
    hp: 1.4,
    otherStats: 1.15,
  };

  const bossStats = {
    hp: Math.round(stats.hp * BOSS_MULTIPLIER.hp),
    auto: Math.round(stats.auto * BOSS_MULTIPLIER.otherStats),
    def: Math.round(stats.def * BOSS_MULTIPLIER.otherStats),
    cap: Math.round(stats.cap * BOSS_MULTIPLIER.otherStats),
    rescap: Math.round(stats.rescap * BOSS_MULTIPLIER.otherStats),
    spd: Math.round(stats.spd * BOSS_MULTIPLIER.otherStats),
  };

  // Re-implémentation simplifiée de pickBossKit (seedée)
  const awakeningRacesPool = Object.keys(races).filter((raceName) => races[raceName]?.awakening);
  const passiveCandidates = getAvailablePassives();

  const passive = pickSeeded(passiveCandidates, rng) || null;
  let awakeningRaces = [];

  const floorNum = Number(floorNumber);
  const hasTwoAwakenings = BOSS_TOP_FLOORS.includes(floorNum);
  if (floorNum === 90 || hasTwoAwakenings) {
    const firstRace = pickSeeded(awakeningRacesPool, rng);
    awakeningRaces = firstRace ? [firstRace] : [];
    if (hasTwoAwakenings) {
      const remaining = awakeningRacesPool.filter((raceName) => raceName !== firstRace);
      const secondRace = remaining.length ? pickSeeded(remaining, rng) : firstRace;
      if (secondRace) awakeningRaces.push(secondRace);
    }
  }

  const hasFusedPassive = floorNum === 110 || floorNum === 120;
  let extensionPassive = null;
  if (hasFusedPassive && passive) {
    const otherPassives = passiveCandidates.filter((p) => p.id !== passive.id);
    extensionPassive = pickSeeded(otherPassives, rng) || passive;
  }

  // Spell & weapon : on reprend la logique du labyrinthe (phase 1 -> pas de spell)
  const SPELL_POOL = [
    { id: 'war', class: 'Guerrier', name: 'Frappe pénétrante' },
    { id: 'rog', class: 'Voleur', name: 'Esquive' },
    { id: 'pal', class: 'Paladin', name: 'Riposte' },
    { id: 'heal', class: 'Healer', name: 'Soin puissant' },
    { id: 'arc', class: 'Archer', name: 'Tir multiple' },
    { id: 'mag', class: 'Mage', name: 'Sort magique' },
    { id: 'dem', class: 'Demoniste', name: 'Invocation familière' },
    { id: 'maso', class: 'Masochiste', name: 'Renvoi sanguin' },
    { id: 'bast', class: 'Bastion', name: 'Charge du Rempart' },
    { id: 'succ', class: 'Succube', name: 'Coup de Fouet' },
    { id: 'briseurSort', class: 'Briseur de Sort', name: 'Égide fractale' },
  ];

  const spell = phase === 1 ? null : pickSeeded(SPELL_POOL, rng);
  const weaponPool = getRarityLegendaryPool();
  const weapon = phase === 1 ? null : pickSeeded(weaponPool, rng);

  // Forge boss legacy : labyrinthe met le forge au floor 120
  const forgeUpgrade = floorNum === 120 && weapon
    ? generateForgeUpgradeRollSeeded(weapon.id, rng)
    : null;

  const candidateBossImage = pickSeeded(BOSS_POOL_FOR_VISUALS, rng);
  const enemyName = candidateBossImage?.imageName || `Boss ${floorNum}`;
  const imageSource = candidateBossImage?.imagePath || null;

  const equipWeaponId = weapon?.id || null;
  const enemyBase = (BOSS_TOP_FLOORS.includes(floorNum))
    ? { ...bossStats, hp: bossStats.hp + BOSS_TOP_FLOORS_EXTRA_HP }
    : { ...bossStats };

  return {
    id: `boss-${floorNum}-${enemyIndex}`,
    name: enemyName,
    race: awakeningRaces[0] || null,
    additionalAwakeningRaces: awakeningRaces.slice(1),
    class: spell?.class || null,
    level: floorNum,
    base: enemyBase,
    bonuses: { race: {}, class: {} },
    mageTowerPassive: passive ? { id: passive.id, level: phase } : null,
    mageTowerExtensionPassive: extensionPassive ? { id: extensionPassive.id, level: phase } : null,
    equippedWeaponId: equipWeaponId,
    equippedWeaponData: equipWeaponId ? getWeaponById(equipWeaponId) : null,
    forgeUpgrade: forgeUpgrade || null,
    characterImage: imageSource,
    awakeningForced: awakeningRaces.length > 0,
  };
}

function getRogueLikeRunRef(userId, runId) {
  return doc(db, 'rogueLikeRuns', userId, 'runs', runId);
}

function getRogueLikeLeaderboardRef(entryId) {
  return doc(db, 'rogueLikeLeaderboard', entryId);
}

function normalizeRunCharacterForEngine(character) {
  if (!character) return null;
  // Garantir que equippedWeaponId est cohérent.
  const equippedWeaponId = character.equippedWeaponId || character.equippedWeaponData?.id || null;
  return {
    ...character,
    equippedWeaponId,
  };
}

function buildPendingActionChooseClass({ runSeed, floorNumber }) {
  const allClassIds = Object.keys(classes);
  const rng = createSeededRng(`${runSeed}|chooseClass|${floorNumber}`);
  const picked = pickNUniqueSeeded(allClassIds, 3, rng).filter(Boolean);
  const classList = picked.map((id) => ({
    id,
    icon: classes[id]?.icon ?? '❓',
    ability: classes[id]?.ability ?? '',
  }));
  return {
    type: 'chooseClass',
    createdAt: serverTimestamp(),
    options: classList,
  };
}

function buildPendingActionForestChoice({ runSeed, floorNumber, runCharacter, rngIndex }) {
  const rng1 = createSeededRng(`${runSeed}|forest|${floorNumber}|${rngIndex}|A`);
  const rng2 = createSeededRng(`${runSeed}|forest|${floorNumber}|${rngIndex}|B`);
  const phase = getLabyrinthPhase(floorNumber);
  const rolls = phase;
  const opt1 = rollForestRewardsSeeded(rolls, runCharacter.forestBoosts, rng1);
  const opt2 = rollForestRewardsSeeded(rolls, runCharacter.forestBoosts, rng2);
  return {
    type: 'forestChoice',
    createdAt: serverTimestamp(),
    options: [
      { updatedBoosts: opt1.updatedBoosts, gainsByStat: opt1.gainsByStat },
      { updatedBoosts: opt2.updatedBoosts, gainsByStat: opt2.gainsByStat },
    ],
  };
}

function buildPendingActionMageTowerChoice({ runSeed, floorNumber, runCharacter }) {
  const rng = createSeededRng(`${runSeed}|magtower|${floorNumber}|passivePair|keep`);
  const level = getLabyrinthPhase(floorNumber);
  const list = rollMageTowerPassivePairSeeded(level, rng);
  return {
    type: 'mageTowerPassiveChoice',
    createdAt: serverTimestamp(),
    keepOption: true,
    options: list,
  };
}

function buildPendingActionExtensionChoice({ runSeed, floorNumber, runCharacter }) {
  const rngKeep = createSeededRng(`${runSeed}|extension|${floorNumber}|keep`);
  const current = runCharacter.mageTowerPassive || null;
  const canAccess = canAccessExtensionDungeon(current);
  if (!canAccess) {
    // Fallback : reroll mage tower classique
    return buildPendingActionMageTowerChoice({ runSeed, floorNumber, runCharacter });
  }

  const rngNew = createSeededRng(`${runSeed}|extension|${floorNumber}|new`);
  const rolled = rollExtensionPassiveSeeded(current?.id, rngNew);

  // Si aucune extension possible, retour keep-only.
  return {
    type: 'extensionChoice',
    createdAt: serverTimestamp(),
    keepOption: true,
    options: rolled ? [rolled] : [],
  };
}

function getWeaponPoolLegendary3Seeded({ runSeed, floorNumber, rngKey }) {
  const rng = createSeededRng(`${runSeed}|weapons|${floorNumber}|${rngKey}`);
  const pool = getRarityLegendaryPool();
  const picked = pickNUniqueSeeded(pool, 3, rng).filter(Boolean);
  return picked;
}

function buildPendingActionLegendaryWeaponChoice({ runSeed, floorNumber, runCharacter }) {
  const options = getWeaponPoolLegendary3Seeded({ runSeed, floorNumber, rngKey: 'threeLegendary' });
  return {
    type: 'legendaryWeaponChoice',
    createdAt: serverTimestamp(),
    options: options.map((w) => ({ id: w.id, name: w.nom, icon: w.icon, stats: w.stats, effet: w.effet, rarete: w.rarete, imageFile: w.imageFile })),
    keepOption: true,
    // keepOption géré : si player a déjà une arme, keep la garde. Sinon, keep = null.
  };
}

function buildPendingActionForgeChoice({ runSeed, floorNumber, runCharacter }) {
  const weaponId = runCharacter?.equippedWeaponId || null;
  if (!weaponId || !hasAnyForgeUpgrade({ statBonusesPct: {}, statPenaltyPct: {} })) {
    // hasAnyForgeUpgrade attend une structure de roll, ici c’est un fallback minimal.
  }
  const rng = createSeededRng(`${runSeed}|forge|${floorNumber}|newRoll|${weaponId || 'none'}`);
  let rolled = null;
  if (weaponId) {
    rolled = generateForgeUpgradeRollSeeded(weaponId, rng);
  }
  return {
    type: 'forgeChoice',
    createdAt: serverTimestamp(),
    keepOption: true,
    rolled: rolled ? rolled : null,
    current: runCharacter.forgeUpgrade || null,
    weaponId,
  };
}

function buildPendingActionSubclassChoice({ runSeed, floorNumber, runCharacter }) {
  const mainClass = runCharacter?.class;
  const options = getSubclassesForClass(mainClass)?.map((s) => ({ id: s.id, name: s.name })) || [];
  return {
    type: 'subclassChoice',
    createdAt: serverTimestamp(),
    options,
  };
}

function buildPendingActionGenericMageTowerPassiveChoice({ runSeed, floorNumber, runCharacter }) {
  // Passifs niveau 1/2 (cap à 2).
  const level = Math.min(getLabyrinthPhase(floorNumber), 2);
  const rng = createSeededRng(`${runSeed}|genericPassif|${floorNumber}|lvl2Cap`);

  const all = getAvailablePassives();
  const count = Math.min(3, all.length);
  const picked = pickNUniqueSeeded(all, count, rng);

  const options = picked.map((p) => {
    const data = getMageTowerPassiveById(p.id);
    return {
      id: p.id,
      level,
      name: data?.name || p.id,
      icon: data?.icon || null,
      description: data?.levels?.[level]?.description || '',
    };
  });

  return {
    type: 'genericMageTowerPassiveChoice',
    createdAt: serverTimestamp(),
    keepOption: !!runCharacter?.mageTowerPassive,
    options,
  };
}

function buildPendingActionGenericWeaponChoice({ runSeed, floorNumber, runCharacter }) {
  // Armes commune / rare (3 choix) entre classe (10) et légendaire (120).
  const rng = createSeededRng(`${runSeed}|genericWeapon|${floorNumber}|mix`);

  const communePool = getWeaponsByRarity(RARITY.COMMUNE);
  const rarePool = getWeaponsByRarity(RARITY.RARE);

  // On force une “pâte commune/rare” pour respecter le pacing :
  // - étage 40 : 2 communes + 1 rare
  // - étage 80 : 1 commune + 2 rares
  const targetCommune = floorNumber === 40 ? 2 : 1;
  const targetRare = 3 - targetCommune;

  const communePicked = pickNUniqueSeeded(communePool, targetCommune, rng);
  const rarePicked = pickNUniqueSeeded(rarePool, targetRare, rng);

  const chosen = [...communePicked, ...rarePicked].filter(Boolean);
  const chosenIds = new Set(chosen.map((w) => w?.id).filter(Boolean));

  // Si une rareté n'est pas assez fournie, on complète avec le pool global.
  let guard = 80;
  const combinedPool = [...communePool, ...rarePool].filter(Boolean);
  while (chosen.length < 3 && guard-- > 0) {
    const candidate = pickSeeded(combinedPool, rng);
    if (!candidate?.id) continue;
    if (chosenIds.has(candidate.id)) continue;
    chosenIds.add(candidate.id);
    chosen.push(candidate);
  }

  const options = chosen.slice(0, 3).map((w) => ({
    id: w.id,
    name: w.nom,
    icon: w.icon,
    stats: w.stats,
    effet: w.effet || null,
    rarete: w.rarete,
    imageFile: w.imageFile,
  }));

  return {
    type: 'genericWeaponChoice',
    createdAt: serverTimestamp(),
    keepOption: !!runCharacter?.equippedWeaponId,
    options,
  };
}

function buildPendingActionSpecial150({ runSeed, floorNumber, runCharacter }) {
  const rngWeapon = createSeededRng(`${runSeed}|special150|${floorNumber}|weapon`);
  const rngPassive = createSeededRng(`${runSeed}|special150|${floorNumber}|passive`);
  const rngSubclass = createSeededRng(`${runSeed}|special150|${floorNumber}|subclass`);
  const rngLevel = createSeededRng(`${runSeed}|special150|${floorNumber}|levelup`);

  const legendaryOptions = pickNUniqueSeeded(getRarityLegendaryPool(), 3, rngWeapon).filter(Boolean);

  // Passif : extension si possible, sinon reroll passif principal
  const currentPrimary = runCharacter.mageTowerPassive || null;
  const canExt = canAccessExtensionDungeon(currentPrimary);
  let passiveOption = null;
  if (canExt) {
    const ext = rollExtensionPassiveSeeded(currentPrimary?.id, rngPassive);
    passiveOption = ext ? { kind: 'extension', value: ext } : { kind: 'extension', value: null };
  } else {
    const rolled = rollMageTowerPassivePairSeeded(getLabyrinthPhase(floorNumber), rngPassive);
    // MVP : on prend le 1er de la liste (un nouveau passif, pas un choix)
    passiveOption = rolled?.[0] ? { kind: 'primary', value: rolled[0] } : { kind: 'primary', value: null };
  }

  const subclassOptions = getSubclassesForClass(runCharacter?.class) || [];
  const subclassPicked = pickSeeded(subclassOptions, rngSubclass) || null;

  // “Monter de niveau” : on applique +5 niveaux => roll stats 5 fois (forest-like).
  const levelUpRolls = 5;
  const statsPool = ['hp', 'auto', 'def', 'rescap', 'spd', 'cap'];
  let boosts = { ...runCharacter.forestBoosts, ...(getEmptyStatBoosts() || {}) };
  // ensures numeric keys
  boosts = { ...getEmptyStatBoosts(), ...(runCharacter.forestBoosts || {}) };
  let gains = {};
  for (let i = 0; i < levelUpRolls; i += 1) {
    const stat = statsPool[Math.floor(rngLevel() * statsPool.length)];
    const value = getStatPointValue(stat);
    boosts[stat] = (boosts[stat] || 0) + value;
    gains[stat] = (gains[stat] || 0) + value;
  }

  return {
    type: 'special150',
    createdAt: serverTimestamp(),
    options: [
      {
        id: 'changeWeapon',
        label: 'Changer arme',
        legendaryOptions: legendaryOptions.map((w) => ({ id: w.id, name: w.nom, icon: w.icon, stats: w.stats, effet: w.effet, rarete: w.rarete, imageFile: w.imageFile })),
      },
      {
        id: 'changePassive',
        label: 'Changer passif',
        passiveKind: passiveOption?.kind || null,
        passiveValue: passiveOption?.value || null,
      },
      {
        id: 'changeSubclass',
        label: 'Changer subclass',
        subclass: subclassPicked ? { id: subclassPicked.id, name: subclassPicked.name } : null,
      },
      {
        id: 'levelUp',
        label: 'Monter de niveau (+5)',
        levelGains: gains,
        updatedBoosts: boosts,
      },
    ],
  };
}

async function announceLeaderboardEntry({ userId, entryId, maxFloor, runId, userPseudo, characterSnapshot }) {
  const payload = stripUndefined({
    userId,
    userPseudo,
    maxFloor,
    runId,
    character: characterSnapshot ? characterSnapshot : undefined,
    date: serverTimestamp(),
  });
  await setDoc(getRogueLikeLeaderboardRef(entryId), payload, { merge: false });
}

async function createRunLeaderboardEntryOnDeath({ userId, runId, run }) {
  const maxFloor = run.highestClearedFloor || 0;
  const entryId = `run_${runId}`;
  const userPseudoRes = await getOwnerPseudoFromAccount(userId);
  const userPseudo = userPseudoRes?.success ? userPseudoRes.ownerPseudo : '';

  await announceLeaderboardEntry({
    userId,
    entryId,
    maxFloor,
    runId,
    userPseudo,
    characterSnapshot: {
      race: run.character?.race || null,
      class: run.character?.class || null,
      subclass: run.character?.subclass || null,
      equippedWeaponId: run.character?.equippedWeaponId || null,
      mageTowerPassive: run.character?.mageTowerPassive || null,
      mageTowerExtensionPassive: run.character?.mageTowerExtensionPassive || null,
      forgeUpgrade: run.character?.forgeUpgrade || null,
      levelOffset: run.levelOffset || 0,
    },
  });
}

export async function startRogueLikeRun({ userId, race }) {
  const runId = (typeof crypto !== 'undefined' && crypto?.randomUUID && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const runSeed = `roguelike_${userId}_${runId}`;

  const raceBonus = getRaceBonus(race);
  const emptyBonusesClass = { ...getEmptyStatBoosts() };

  // Stats de base (comme CharacterCreation genStats)
  const baseStatsRaw = genBaseStatsLikeCharacterCreationSeeded(userId, runSeed, 0);
  const base = {
    hp: baseStatsRaw.hp + (raceBonus.hp || 0),
    auto: baseStatsRaw.auto + (raceBonus.auto || 0),
    def: baseStatsRaw.def + (raceBonus.def || 0),
    cap: baseStatsRaw.cap + (raceBonus.cap || 0),
    rescap: baseStatsRaw.rescap + (raceBonus.rescap || 0),
    spd: baseStatsRaw.spd + (raceBonus.spd || 0),
  };

  const runChar = {
    name: `Run ${race}`,
    gender: 'male',
    race,
    class: null,
    level: 1,
    base,
    bonuses: { race: raceBonus, class: emptyBonusesClass },
    forestBoosts: getEmptyStatBoosts(),
    equippedWeaponId: null,
    mageTowerPassive: null,
    mageTowerExtensionPassive: null,
    forgeUpgrade: null,
    subclass: null,
    equippedWeaponData: null,
    characterImage: getRogueLikeImageForRace(race),
    additionalAwakeningRaces: [],
  };

  const payload = stripUndefined({
    userId,
    runId,
    runSeed,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'active',
    currentFloor: 1,
    highestClearedFloor: 0,
    levelOffset: 0,
    pendingAction: null,
    character: runChar,
  });

  await setDoc(getRogueLikeRunRef(userId, runId), payload, { merge: false });
  return { success: true, runId, run: payload };
}

function genBaseStatsLikeCharacterCreationSeeded(_userId, runSeed, salt = 0) {
  // MVP : on réplique les grandes lignes genStats (120/15 + 35 points),
  // mais en déterministe pour le resume.
  const rng = createSeededRng(`${runSeed}|baseStats|${salt}`);
  const s = { hp: 120, auto: 15, def: 15, cap: 15, rescap: 15, spd: 15 };
  let rem = 35;
  const pool = ['auto', 'def', 'cap', 'rescap', 'spd'];
  if (rng() < 0.3) {
    const k = pool[Math.floor(rng() * pool.length)];
    const spikeAmount = 5 + Math.floor(rng() * 6);
    const actual = Math.min(spikeAmount, 35 - s[k]);
    s[k] += actual;
    rem -= actual;
  }

  let guard = 1000;
  while (rem > 0 && guard-- > 0) {
    const entries = [['hp', 2], ['auto', 2], ['def', 2], ['cap', 2], ['rescap', 2], ['spd', 2]];
    const tot = entries.reduce((a, [, w]) => a + w, 0);
    let r = rng() * tot;
    let k = 'hp';
    for (const [key, w] of entries) {
      r -= w;
      if (r <= 0) {
        k = key;
        break;
      }
    }
    if (k === 'hp') {
      const hpGain = getStatPointValue('hp');
      if (s.hp + hpGain <= 200) {
        s.hp += hpGain;
        rem -= 1;
      }
    } else {
      const statGain = getStatPointValue(k);
      if (s[k] + statGain <= 35) {
        s[k] += statGain;
        rem -= 1;
      }
    }
  }
  return s;
}

export async function getLatestActiveRogueLikeRun(userId) {
  const runsRef = collection(db, 'rogueLikeRuns', userId, 'runs');
  const q = query(runsRef, orderBy('updatedAt', 'desc'), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return { success: true, run: null };
  const docSnap = snapshot.docs[0];
  const run = docSnap.data();
  if (run?.status !== 'active') return { success: true, run: null };
  const ensuredRun = await ensureCharacterImagesOnRunMaybeUpdate({ userId, runId: docSnap.id, run });
  return { success: true, runId: docSnap.id, run: ensuredRun };
}

export async function getRogueLikeRun({ userId, runId }) {
  const snap = await getDoc(getRogueLikeRunRef(userId, runId));
  if (!snap.exists()) return { success: false, error: 'Run introuvable.' };
  const run = snap.data();
  if (run?.userId !== userId) return { success: false, error: 'Accès refusé.' };
  const ensuredRun = await ensureCharacterImagesOnRunMaybeUpdate({ userId, runId, run });
  return { success: true, run: ensuredRun };
}

async function ensureCharacterImagesOnRunMaybeUpdate({ userId, runId, run }) {
  try {
    if (!run?.character?.race) return run;
    const character = run.character || {};

    // Si class choisie : image race+classe, sinon image race simple.
    const hasClass = !!character?.class;
    const computed = hasClass
      ? getRogueLikeImageForRaceClass(character.race, character.class)
      : getRogueLikeImageForRace(character.race);

    if (!computed) return run;
    if (character.characterImage === computed) return run;

    const updatedRun = {
      ...run,
      character: { ...character, characterImage: computed },
    };

    // MVP: update “best effort” (évite de recalculer côté UI si run déjà créé avant le patch)
    await setDoc(getRogueLikeRunRef(userId, runId), { character: updatedRun.character }, { merge: true });
    return updatedRun;
  } catch (e) {
    return run;
  }
}

function shouldTriggerClassGate({ floorNumber, runCharacter }) {
  return floorNumber === 10 && !runCharacter?.class;
}

function shouldTriggerForestGateAfterVictory({ floorNumber, bossJustDefeated }) {
  if (!bossJustDefeated) return false;
  return false;
}

function shouldTriggerForestGateOnFloorClear({ floorNumber }) {
  if (isBossFloor(floorNumber)) return false;
  // Porte forest MVP : tous les 5 étages non-boss
  return floorNumber % 5 === 0;
}

function shouldTriggerMageTowerGateAfterBossVictory({ floorNumber }) {
  if (!isBossFloor(floorNumber)) return false;
  // MVP : entre la classe (10) et l'arme légendaire (120),
  // on remplace les passifs “mage tower classique” par des passifs niveau 1/2 via gates génériques.
  if (floorNumber < 110) return false;
  const specialBosses = [110, 120, 130, 140, 150];
  return !specialBosses.includes(floorNumber);
}

function shouldTriggerGenericPassifGate({ floorNumber }) {
  // Objectif : passifs niveau 1/2 entre étage 10 et étage 120.
  if (floorNumber < 10 || floorNumber >= 110) return false;
  return [20, 60, 100].includes(floorNumber);
}

function shouldTriggerGenericWeaponGate({ floorNumber }) {
  // Objectif : armes communes/rares entre étage 10 et étage 120.
  if (floorNumber < 10 || floorNumber >= 110) return false;
  return [40, 80].includes(floorNumber);
}

function shouldTriggerExtensionGate({ floorNumber }) {
  return floorNumber === 110;
}

function shouldTriggerLegendaryWeaponGate({ floorNumber }) {
  return floorNumber === 120;
}

function shouldTriggerForgeGate({ floorNumber }) {
  return floorNumber === 130;
}

function shouldTriggerSubclassGate({ floorNumber }) {
  return floorNumber === 140;
}

function shouldTriggerSpecial150Gate({ floorNumber }) {
  return floorNumber === 150;
}

function buildEnemyAndSimulate({ run, floorNumber, runSeed }) {
  const playerForSim = normalizeRunCharacterForEngine({
    ...run.character,
    level: floorNumber + (run.levelOffset || 0),
  });

  const enemyIndex = 0;
  const enemy = isBossFloor(floorNumber)
    ? buildBossEnemy({ floorNumber, runSeed, enemyIndex })
    : buildNormalEnemy({ floorNumber, runSeed, enemyIndex });

  const result = simulerMatch(playerForSim, enemy);
  return { result, enemy, playerForSim };
}

function getLastStepSafe(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return steps[steps.length - 1];
}

export async function advanceRogueLikeRun({ userId, runId }) {
  const runSnap = await getDoc(getRogueLikeRunRef(userId, runId));
  if (!runSnap.exists()) return { success: false, error: 'Run introuvable.' };
  const run = runSnap.data();
  if (run?.userId !== userId) return { success: false, error: 'Accès refusé.' };
  if (run?.status !== 'active') return { success: false, error: 'Run déjà terminée.' };

  if (run.pendingAction) {
    return { success: false, error: 'Run en attente d’un choix.' };
  }

  const floorNumber = Number(run.currentFloor || 1);
  const runSeed = run.runSeed;
  if (MAX_ROGUELIKE_FLOOR !== null && floorNumber > MAX_ROGUELIKE_FLOOR) {
    // fallback (normalement jamais atteint) : si besoin on peut lever le plafond
    await setDoc(getRogueLikeRunRef(userId, runId), {
      ...run,
      status: 'dead',
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { success: true, isDead: true, run: { ...run, status: 'dead' } };
  }

  // Gate pré-combat : choisir la classe à l’étage 10
  if (shouldTriggerClassGate({ floorNumber, runCharacter: run.character })) {
    const pendingAction = buildPendingActionChooseClass({ runSeed, floorNumber });
    const updatedRun = stripUndefined({
      ...run,
      character: {
        ...run.character,
        level: floorNumber + (run.levelOffset || 0),
      },
      pendingAction,
      updatedAt: serverTimestamp(),
    });
    await setDoc(getRogueLikeRunRef(userId, runId), updatedRun, { merge: true });
    return { success: true, pendingAction, run: updatedRun };
  }

  // Combat
  const { result, enemy } = buildEnemyAndSimulate({ run, floorNumber, runSeed });
  const lastStep = getLastStepSafe(result.steps);
  const didWin = Number(lastStep?.p2HP) <= 0;

  let updatedRun = {
    ...run,
    updatedAt: serverTimestamp(),
    // le niveau pendant le combat correspond au floor + levelOffset
    character: {
      ...run.character,
      level: floorNumber + (run.levelOffset || 0),
    },
  };

  if (!didWin) {
    updatedRun = { ...updatedRun, status: 'dead' };
    await setDoc(getRogueLikeRunRef(userId, runId), stripUndefined(updatedRun), { merge: true });
    await createRunLeaderboardEntryOnDeath({ userId, runId, run: updatedRun });
    return {
      success: true,
      run: stripUndefined(updatedRun),
      isDead: true,
      floorNumber,
      enemy,
      result,
    };
  }

  // didWin => floor progresse
  const nextFloor = floorNumber + 1;
  updatedRun.highestClearedFloor = Math.max(updatedRun.highestClearedFloor || 0, floorNumber);
  updatedRun.currentFloor = nextFloor;

  // Gates post-combat : pendingAction
  let pendingAction = null;

  if (shouldTriggerExtensionGate(floorNumber)) {
    pendingAction = buildPendingActionExtensionChoice({ runSeed, floorNumber, runCharacter: updatedRun.character });
  } else if (shouldTriggerLegendaryWeaponGate(floorNumber)) {
    pendingAction = buildPendingActionLegendaryWeaponChoice({ runSeed, floorNumber, runCharacter: updatedRun.character });
  } else if (shouldTriggerForgeGate(floorNumber)) {
    pendingAction = buildPendingActionForgeChoice({ runSeed, floorNumber, runCharacter: updatedRun.character });
  } else if (shouldTriggerSubclassGate(floorNumber)) {
    pendingAction = buildPendingActionSubclassChoice({ runSeed, floorNumber, runCharacter: updatedRun.character });
  } else if (shouldTriggerSpecial150Gate(floorNumber)) {
    pendingAction = buildPendingActionSpecial150({ runSeed, floorNumber, runCharacter: updatedRun.character });
  } else if (shouldTriggerGenericWeaponGate({ floorNumber })) {
    pendingAction = buildPendingActionGenericWeaponChoice({ runSeed, floorNumber, runCharacter: updatedRun.character });
  } else if (shouldTriggerGenericPassifGate({ floorNumber })) {
    pendingAction = buildPendingActionGenericMageTowerPassiveChoice({ runSeed, floorNumber, runCharacter: updatedRun.character });
  } else if (shouldTriggerMageTowerGateAfterBossVictory(floorNumber)) {
    pendingAction = buildPendingActionMageTowerGateAfterBossVictory({ runSeed, floorNumber, runCharacter: updatedRun.character });
  } else if (shouldTriggerForestGateOnFloorClear(floorNumber)) {
    pendingAction = buildPendingActionForestChoice({ runSeed, floorNumber, runCharacter: updatedRun.character, rngIndex: floorNumber });
  }

  updatedRun.pendingAction = pendingAction;
  await setDoc(getRogueLikeRunRef(userId, runId), stripUndefined(updatedRun), { merge: true });

  return {
    success: true,
    run: stripUndefined(updatedRun),
    pendingAction,
    floorNumber,
    enemy,
    result,
    didWin,
  };
}

function buildPendingActionMageTowerGateAfterBossVictory({ runSeed, floorNumber, runCharacter }) {
  return buildPendingActionMageTowerChoice({ runSeed, floorNumber, runCharacter });
}

export async function applyRogueLikeChoice({ userId, runId, choice }) {
  const runSnap = await getDoc(getRogueLikeRunRef(userId, runId));
  if (!runSnap.exists()) return { success: false, error: 'Run introuvable.' };
  const run = runSnap.data();
  if (run?.userId !== userId) return { success: false, error: 'Accès refusé.' };
  if (run?.status !== 'active') return { success: false, error: 'Run terminée.' };
  if (!run.pendingAction) return { success: false, error: 'Aucune action en attente.' };

  const pending = run.pendingAction;
  const rngKey = `${runSeed}|choice|${pending.type}|${runId}`;
  // eslint-disable-next-line no-unused-vars
  const runSeed = run.runSeed;

  let character = { ...run.character };

  if (pending.type === 'chooseClass') {
    const chosen = pending.options?.find((o) => o.id === choice?.classId) || null;
    if (!chosen) return { success: false, error: 'Classe invalide.' };
    const classBonus = getClassBonus(chosen.id);

    character = {
      ...character,
      class: chosen.id,
      bonuses: {
        ...(character.bonuses || {}),
        class: classBonus,
      },
      characterImage: getRogueLikeImageForRaceClass(character.race, chosen.id),
      base: {
        ...character.base,
        auto: character.base.auto + (classBonus.auto || 0),
        def: character.base.def + (classBonus.def || 0),
        cap: character.base.cap + (classBonus.cap || 0),
        rescap: character.base.rescap + (classBonus.rescap || 0),
        spd: character.base.spd + (classBonus.spd || 0),
        hp: character.base.hp + (classBonus.hp || 0),
      },
    };
  } else if (pending.type === 'forestChoice') {
    const idx = Number(choice?.optionIndex);
    const opt = pending.options?.[idx] || null;
    if (!opt?.updatedBoosts) return { success: false, error: 'Option forêt invalide.' };
    character = { ...character, forestBoosts: opt.updatedBoosts };
  } else if (pending.type === 'mageTowerPassiveChoice') {
    // choix : optionIndex = -1 => keep, sinon index d’option
    const idx = Number(choice?.optionIndex);
    if (idx >= 0) {
      const passive = pending.options?.[idx] || null;
      if (passive?.id) {
        character = { ...character, mageTowerPassive: { id: passive.id, level: passive.level ?? 1 } };
      }
    }
  } else if (pending.type === 'genericMageTowerPassiveChoice') {
    const idx = Number(choice?.optionIndex);
    // optionIndex = -1 => garder / no-op
    if (idx >= 0) {
      const passive = pending.options?.[idx] || null;
      if (passive?.id) {
        character = { ...character, mageTowerPassive: { id: passive.id, level: passive.level ?? 1 } };
      }
    }
  } else if (pending.type === 'extensionChoice') {
    const keep = choice?.keep === true;
    if (!keep) {
      const rolled = pending.options?.[0] || null;
      if (rolled?.id) {
        character = { ...character, mageTowerExtensionPassive: { id: rolled.id, level: rolled.level ?? 1 } };
      }
    }
  } else if (pending.type === 'legendaryWeaponChoice') {
    const idx = Number(choice?.optionIndex);
    // Keep = -1 => no-op
    if (Number.isNaN(idx) || idx < 0) {
      // no change
    } else {
      const opt = pending.options?.[idx] || null;
      if (!opt?.id) return { success: false, error: 'Arme invalide.' };
      const weapon = getWeaponById(opt.id);
      if (!weapon) return { success: false, error: 'Arme introuvable.' };

      character = {
        ...character,
        equippedWeaponId: weapon.id,
        equippedWeaponData: weapon,
        // Switch arme = perte upgrade forge (cohérent avec Dungeon)
        forgeUpgrade: null,
      };
    }
  } else if (pending.type === 'genericWeaponChoice') {
    const idx = Number(choice?.optionIndex);
    // optionIndex = -1 => garder l'arme actuelle
    if (Number.isNaN(idx) || idx < 0) {
      // no-op
    } else {
      const opt = pending.options?.[idx] || null;
      if (!opt?.id) return { success: false, error: 'Arme invalide.' };
      const weapon = getWeaponById(opt.id);
      if (!weapon) return { success: false, error: 'Arme introuvable.' };

      character = {
        ...character,
        equippedWeaponId: weapon.id,
        equippedWeaponData: weapon,
        forgeUpgrade: null,
      };
    }
  } else if (pending.type === 'forgeChoice') {
    // keep = true => garder le forgeUpgrade actuel
    if (choice?.keep === true) {
      // no-op
    } else if (pending.rolled) {
      character = { ...character, forgeUpgrade: pending.rolled };
    }
  } else if (pending.type === 'subclassChoice') {
    const idx = Number(choice?.optionIndex);
    const opt = pending.options?.[idx] || null;
    if (!opt?.id) return { success: false, error: 'Subclass invalide.' };
    character = { ...character, subclass: { id: opt.id, name: opt.name } };
  } else if (pending.type === 'special150') {
    const pickedId = choice?.specialId;
    const opt = pending.options?.find((o) => o.id === pickedId) || null;
    if (!opt) return { success: false, error: 'Option spéciale invalide.' };

    if (pickedId === 'changeWeapon') {
      const weaponIdx = Number.isFinite(Number(choice?.weaponIndex)) ? Number(choice?.weaponIndex) : 0;
      const weaponOpt = opt.legendaryOptions?.[weaponIdx] || null;
      if (!weaponOpt?.id) return { success: false, error: 'Arme spéciale invalide.' };
      const weapon = getWeaponById(weaponOpt.id);
      character = { ...character, equippedWeaponId: weapon.id, equippedWeaponData: weapon, forgeUpgrade: null };
    } else if (pickedId === 'changePassive') {
      if (opt.passiveKind === 'extension' && opt.passiveValue?.id) {
        character = { ...character, mageTowerExtensionPassive: { id: opt.passiveValue.id, level: opt.passiveValue.level ?? 1 } };
      } else if (opt.passiveKind === 'primary' && opt.passiveValue?.id) {
        character = { ...character, mageTowerPassive: { id: opt.passiveValue.id, level: opt.passiveValue.level ?? 1 } };
      }
    } else if (pickedId === 'changeSubclass') {
      if (opt.subclass?.id) character = { ...character, subclass: opt.subclass };
    } else if (pickedId === 'levelUp') {
      character = { ...character, forestBoosts: opt.updatedBoosts, levelOffset: (character.levelOffset || 0) + 5 };
    }
  }

  const updatedRun = stripUndefined({
    ...run,
    character,
    pendingAction: null,
    updatedAt: serverTimestamp(),
  });

  await setDoc(getRogueLikeRunRef(userId, runId), updatedRun, { merge: true });
  return { success: true, run: updatedRun };
}

export async function getRogueLikeLeaderboard({ limit: leaderboardLimit = 30 } = {}) {
  // MVP: une seule orderBy pour éviter les problèmes d'index Firestore.
  const q = query(collection(db, 'rogueLikeLeaderboard'), orderBy('date', 'desc'), limit(leaderboardLimit));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Tri client : furthest progression d'abord, puis date.
  data.sort((a, b) => (b.maxFloor || 0) - (a.maxFloor || 0));
  return { success: true, data };
}

