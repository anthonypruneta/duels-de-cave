import { db } from '../firebase/config';
import { Timestamp, doc, getDoc, increment, setDoc, serverTimestamp } from 'firebase/firestore';
import { getMageTowerPassiveById, MAGE_TOWER_PASSIVES } from '../data/mageTowerPassives';
import { races } from '../data/races';
import { getWeaponsByRarity, RARITY } from '../data/weapons';
import { simulerMatch } from '../utils/tournamentCombat';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getEquippedWeapon } from './dungeonService';
import { announceFirstLabyrinthFloorClear } from './milestoneAnnouncementService';

const FLOOR_COUNT = 100;
const BOSS_FLOOR_STEP = 10;
const BOSS_FLOOR_COUNT = FLOOR_COUNT / BOSS_FLOOR_STEP;

const MOB_IMAGES = import.meta.glob('../assets/labyrinthe/mobs/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const BOSS_IMAGES = import.meta.glob('../assets/labyrinthe/bosses/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });

const BASE_DUNGEON_LEVEL_1_STATS = {
  hp: 120,
  auto: 15,
  def: 15,
  cap: 15,
  rescap: 15,
  spd: 15
};

const LEGENDARY_WEAPONS = getWeaponsByRarity(RARITY.LEGENDAIRE);
const SPELL_POOL = [
  { id: 'war', class: 'Guerrier', name: 'Frappe pénétrante' },
  { id: 'rog', class: 'Voleur', name: 'Esquive' },
  { id: 'pal', class: 'Paladin', name: 'Riposte' },
  { id: 'heal', class: 'Healer', name: 'Soin puissant' },
  { id: 'arc', class: 'Archer', name: 'Tir multiple' },
  { id: 'mag', class: 'Mage', name: 'Sort magique' },
  { id: 'dem', class: 'Demoniste', name: 'Invocation familière' },
  { id: 'maso', class: 'Masochiste', name: 'Renvoi sanguin' }
];

const AWAKENING_RACE_POOL = Object.keys(races).filter((raceName) => races[raceName]?.awakening);

const BOSS_MULTIPLIER = {
  hp: 1.4,
  otherStats: 1.15
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededRng(seedString) {
  const seedFactory = xmur3(seedString);
  return mulberry32(seedFactory());
}

function pickSeeded(list, rng) {
  const idx = Math.floor(rng() * list.length);
  return list[clamp(idx, 0, list.length - 1)];
}

function shuffleSeeded(list, rng) {
  const cloned = [...list];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const safeJ = clamp(j, 0, i);
    [cloned[i], cloned[safeJ]] = [cloned[safeJ], cloned[i]];
  }
  return cloned;
}

function getImageEntries(globResult) {
  return Object.entries(globResult)
    .map(([sourcePath, imagePath]) => ({ sourcePath, imagePath }))
    .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}


function getFloorImageEntriesByType(type) {
  return type === 'boss' ? getImageEntries(BOSS_IMAGES) : getImageEntries(MOB_IMAGES);
}

function normalizeAssetName(raw = '') {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getNameFromImagePath(path) {
  if (!path) return '';
  const filename = decodeURIComponent((path.split('/').pop() || '').trim());
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  return withoutExt.replace(/-[A-Za-z0-9_-]{6,}$/u, '');
}

export function resolveLabyrinthFloorImagePath(floor) {
  if (!floor) return null;

  const candidates = getFloorImageEntriesByType(floor.type);
  if (!candidates.length) return floor.imagePath || null;

  const bySourcePath = floor.imageSourcePath
    ? candidates.find((entry) => entry.sourcePath === floor.imageSourcePath)
    : null;
  if (bySourcePath) return bySourcePath.imagePath;

  const currentImagePaths = new Set(candidates.map((entry) => entry.imagePath));
  if (floor.imagePath && currentImagePaths.has(floor.imagePath)) return floor.imagePath;

  const expectedName = normalizeAssetName(floor.enemyName || getNameFromImagePath(floor.imagePath));
  if (expectedName) {
    const byEnemyName = candidates.find((entry) => normalizeAssetName(getEnemyNameFromFilename(entry.sourcePath)) === expectedName);
    if (byEnemyName) return byEnemyName.imagePath;
  }

  const legacyName = normalizeAssetName(getNameFromImagePath(floor.imagePath));
  if (legacyName) {
    const byLegacyName = candidates.find((entry) => normalizeAssetName(getNameFromImagePath(entry.sourcePath)) === legacyName);
    if (byLegacyName) return byLegacyName.imagePath;
  }

  return floor.imagePath || null;
}

async function grantDungeonRunsForLabyrinthBoss(userId, attempts = 5) {
  const progressRef = doc(db, 'dungeonProgress', userId);
  await setDoc(progressRef, {
    userId,
    runsAvailable: increment(attempts),
    updatedAt: Timestamp.now()
  }, { merge: true });
}

export function getEnemyNameFromFilename(path) {
  if (!path) return 'inconnu';
  const filename = path.split('/').pop() || path;
  return filename.replace(/\.[^/.]+$/, '');
}

export function getCurrentWeekId(referenceDate = new Date()) {
  const date = new Date(Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getLabyrinthPhase(floorNumber) {
  if (floorNumber <= 40) return 1;
  if (floorNumber <= 70) return 2;
  return 3;
}

export function computeLabyrinthStats(baseStats, floorNumber) {
  const phase = getLabyrinthPhase(floorNumber);
  const floorInPhase = phase === 1 ? floorNumber - 1 : phase === 2 ? floorNumber - 41 : floorNumber - 71;

  let multiplier;
  if (phase === 1) {
    multiplier = 1 + floorInPhase * 0.018;
  } else if (phase === 2) {
    multiplier = 1.72 + floorInPhase * 0.032;
  } else {
    // Phase hard (71-100): montée plus agressive pour que 70/80/90/100 soient réellement exigeants
    // Exemple: 71 ≈ 2.92x, 80 ≈ 3.50x, 90 ≈ 4.40x, 100 ≈ 5.50x
    multiplier = 2.92 + floorInPhase * 0.086;
    if (floorNumber >= 90) {
      // Palier final: accentuer le mur de difficulté sur les 10 derniers étages
      multiplier *= 1.12;
    }
  }

  return {
    hp: Math.round(baseStats.hp * multiplier),
    auto: Math.round(baseStats.auto * multiplier),
    def: Math.round(baseStats.def * multiplier),
    cap: Math.round(baseStats.cap * multiplier),
    rescap: Math.round(baseStats.rescap * multiplier),
    spd: Math.round(baseStats.spd * multiplier)
  };
}

function computeBossStats(stats) {
  return {
    hp: Math.round(stats.hp * BOSS_MULTIPLIER.hp),
    auto: Math.round(stats.auto * BOSS_MULTIPLIER.otherStats),
    def: Math.round(stats.def * BOSS_MULTIPLIER.otherStats),
    cap: Math.round(stats.cap * BOSS_MULTIPLIER.otherStats),
    rescap: Math.round(stats.rescap * BOSS_MULTIPLIER.otherStats),
    spd: Math.round(stats.spd * BOSS_MULTIPLIER.otherStats)
  };
}

function pickBossKit(phase, floorNumber, rng) {
  const passiveLevel = phase;
  const passive = pickSeeded(MAGE_TOWER_PASSIVES, rng);
  let awakeningRaces = [];

  if (floorNumber === 90 || floorNumber === 100) {
    const firstRace = pickSeeded(AWAKENING_RACE_POOL, rng);
    awakeningRaces = [firstRace];
    if (floorNumber === 100) {
      const remaining = AWAKENING_RACE_POOL.filter((raceName) => raceName !== firstRace);
      const secondRace = remaining.length ? pickSeeded(remaining, rng) : firstRace;
      awakeningRaces.push(secondRace);
    }
  }

  if (phase === 1) {
    return {
      passiveId: passive.id,
      passiveLevel,
      awakeningRaces
    };
  }

  const spell = pickSeeded(SPELL_POOL, rng);

  if (phase === 2) {
    return {
      spellId: spell.id,
      spellClass: spell.class,
      passiveId: passive.id,
      passiveLevel,
      awakeningRaces
    };
  }

  const weapon = pickSeeded(LEGENDARY_WEAPONS, rng);
  return {
    spellId: spell.id,
    spellClass: spell.class,
    passiveId: passive.id,
    passiveLevel,
    weaponId: weapon.id,
    awakeningRaces
  };
}

export function buildInfiniteLabyrinth(weekId, rerollVersion = 0) {
  const mobs = getImageEntries(MOB_IMAGES);
  const bosses = getImageEntries(BOSS_IMAGES);
  if (!mobs.length || !bosses.length) {
    throw new Error('Assets labyrinthe manquants: ajoutez des images dans src/assets/labyrinthe/mobs et bosses.');
  }

  if (bosses.length < BOSS_FLOOR_COUNT) {
    throw new Error(`Il faut au moins ${BOSS_FLOOR_COUNT} images de boss pour garantir des boss uniques (actuel: ${bosses.length}).`);
  }

  const seed = `infinite-labyrinth-${weekId}-reroll-${rerollVersion}`;
  const rng = createSeededRng(seed);
  const bossPool = shuffleSeeded(bosses, rng);

  const floors = Array.from({ length: FLOOR_COUNT }, (_, idx) => {
    const floorNumber = idx + 1;
    const type = floorNumber % BOSS_FLOOR_STEP === 0 ? 'boss' : 'normal';
    const phase = getLabyrinthPhase(floorNumber);
    const picked = type === 'boss' ? bossPool.shift() : pickSeeded(mobs, rng);

    const stats = computeLabyrinthStats(BASE_DUNGEON_LEVEL_1_STATS, floorNumber);
    const finalStats = type === 'boss' ? computeBossStats(stats) : stats;
    const bossKit = type === 'boss' ? pickBossKit(phase, floorNumber, rng) : null;

    return {
      floorNumber,
      type,
      phase,
      enemyName: getEnemyNameFromFilename(picked.sourcePath),
      imagePath: picked.imagePath,
      imageSourcePath: picked.sourcePath,
      stats: finalStats,
      bossKit
    };
  });

  return {
    weekId,
    seed,
    generatedAt: new Date().toISOString(),
    floors,
    rewardsEnabled: false,
    rerollVersion
  };
}

export async function generateWeeklyInfiniteLabyrinth(forceWeekId = null, rerollVersion = null) {
  try {
    const weekId = forceWeekId || getCurrentWeekId();
    const effectiveRerollVersion = rerollVersion ?? 0;
    const labyrinth = buildInfiniteLabyrinth(weekId, effectiveRerollVersion);
    await setDoc(doc(db, 'weeklyInfiniteLabyrinths', weekId), {
      ...labyrinth,
      generatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true, weekId, labyrinth };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function resetWeeklyInfiniteLabyrinthEnemyPool(forceWeekId = null) {
  try {
    const weekId = forceWeekId || getCurrentWeekId();
    const currentSnap = await getDoc(doc(db, 'weeklyInfiniteLabyrinths', weekId));
    const currentRerollVersion = currentSnap.exists() ? (currentSnap.data().rerollVersion || 0) : 0;
    const nextRerollVersion = currentRerollVersion + 1;
    const labyrinth = buildInfiniteLabyrinth(weekId, nextRerollVersion);

    await setDoc(doc(db, 'weeklyInfiniteLabyrinths', weekId), {
      ...labyrinth,
      generatedAt: serverTimestamp()
    }, { merge: true });

    return { success: true, weekId, labyrinth };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getWeeklyInfiniteLabyrinth(weekId = null) {
  const resolvedWeekId = weekId || getCurrentWeekId();
  const snap = await getDoc(doc(db, 'weeklyInfiniteLabyrinths', resolvedWeekId));
  if (!snap.exists()) return { success: false, error: 'Labyrinthe hebdo introuvable', weekId: resolvedWeekId };
  return { success: true, data: snap.data(), weekId: resolvedWeekId };
}

export async function ensureWeeklyInfiniteLabyrinth(weekId = null) {
  const existing = await getWeeklyInfiniteLabyrinth(weekId);
  if (existing.success) return existing;
  const created = await generateWeeklyInfiniteLabyrinth(existing.weekId);
  if (!created.success) return created;
  return { success: true, data: created.labyrinth, weekId: created.weekId };
}

export async function getUserLabyrinthProgress(userId, weekId = null) {
  const resolvedWeekId = weekId || getCurrentWeekId();
  const progressRef = doc(db, 'userLabyrinthProgress', userId, 'weeks', resolvedWeekId);
  const snap = await getDoc(progressRef);
  if (!snap.exists()) {
    return {
      success: true,
      data: {
        currentFloor: 1,
        highestClearedFloor: 0,
        bossesDefeated: 0
      },
      weekId: resolvedWeekId
    };
  }
  return { success: true, data: snap.data(), weekId: resolvedWeekId };
}

export async function resetUserLabyrinthProgress(userId, weekId = null) {
  const resolvedWeekId = weekId || getCurrentWeekId();
  const payload = {
    currentFloor: 1,
    highestClearedFloor: 0,
    bossesDefeated: 0,
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, 'userLabyrinthProgress', userId, 'weeks', resolvedWeekId), payload, { merge: true });
  return { success: true, weekId: resolvedWeekId };
}

async function getPreparedUserCharacter(userId) {
  const charSnap = await getDoc(doc(db, 'characters', userId));
  if (!charSnap.exists()) return null;
  const data = charSnap.data();
  let weaponId = data.equippedWeaponId || null;
  if (!weaponId) {
    const weaponResult = await getEquippedWeapon(userId);
    weaponId = weaponResult.success ? weaponResult.weapon?.id || null : null;
  }
  return normalizeCharacterBonuses({
    ...data,
    userId,
    level: data.level ?? 1,
    equippedWeaponId: weaponId
  });
}

function buildFloorEnemy(floor) {
  const passive = floor.bossKit?.passiveId ? getMageTowerPassiveById(floor.bossKit.passiveId) : null;
  const awakeningRaces = floor.bossKit?.awakeningRaces || [];
  const race = awakeningRaces[0] || 'Humain';
  const additionalAwakeningRaces = awakeningRaces.slice(1);
  const enemyClass = floor.bossKit?.spellClass || 'Guerrier';

  return {
    name: floor.enemyName,
    race,
    additionalAwakeningRaces,
    class: enemyClass,
    level: floor.floorNumber,
    base: floor.stats,
    bonuses: { race: {}, class: {} },
    mageTowerPassive: floor.bossKit?.passiveId ? {
      id: floor.bossKit.passiveId,
      level: floor.bossKit.passiveLevel || 1
    } : null,
    equippedWeaponId: floor.bossKit?.weaponId || null
  };
}

export async function launchLabyrinthCombat({ userId, floorNumber = null, weekId = null }) {
  try {
    const resolvedWeekId = weekId || getCurrentWeekId();
    const labyrinthResult = await ensureWeeklyInfiniteLabyrinth(resolvedWeekId);
    if (!labyrinthResult.success) {
      return { success: false, error: labyrinthResult.error || 'Labyrinthe indisponible.' };
    }
    const progressResult = await getUserLabyrinthProgress(userId, resolvedWeekId);
    if (!progressResult.success) {
      return { success: false, error: progressResult.error || 'Progression indisponible.' };
    }
    const char = await getPreparedUserCharacter(userId);

    if (!char) {
      return { success: false, error: 'Personnage introuvable pour ce joueur.' };
    }

    const selectedFloor = floorNumber || progressResult.data.currentFloor || 1;
    const floor = labyrinthResult.data.floors.find((f) => f.floorNumber === Number(selectedFloor));
    if (!floor) return { success: false, error: 'Étage invalide.' };
    if (!floor.stats) return { success: false, error: "Stats d'étage manquantes." };

    const enemy = buildFloorEnemy(floor);
    const result = simulerMatch(char, enemy);
    const lastStep = result.steps?.at(-1) || null;
    const didWin = Number(lastStep?.p2HP) <= 0;

    const updatedProgress = { ...progressResult.data };
    let rewardGranted = false;

    if (didWin) {
      updatedProgress.highestClearedFloor = Math.max(updatedProgress.highestClearedFloor || 0, floor.floorNumber);
      updatedProgress.currentFloor = Math.min(FLOOR_COUNT, floor.floorNumber + 1);

      if ([80, 90, 100].includes(floor.floorNumber)) {
        await announceFirstLabyrinthFloorClear({
          userId,
          weekId: resolvedWeekId,
          floorNumber: floor.floorNumber,
          character: char,
          enemyName: floor.enemyName
        });
      }

      if (floor.type === 'boss') {
        updatedProgress.bossesDefeated = (updatedProgress.bossesDefeated || 0) + 1;
        await grantDungeonRunsForLabyrinthBoss(userId, 5);
        rewardGranted = true;
      }
    } else {
      updatedProgress.currentFloor = floor.floorNumber;
    }

    await setDoc(doc(db, 'userLabyrinthProgress', userId, 'weeks', resolvedWeekId), {
      ...updatedProgress,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return {
      success: true,
      weekId: resolvedWeekId,
      floor,
      result,
      didWin,
      progress: updatedProgress,
      rewardGranted
    };
  } catch (error) {
    return { success: false, error: error?.message || 'Erreur combat labyrinthe.' };
  }
}
