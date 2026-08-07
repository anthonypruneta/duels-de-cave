/**
 * Service Firestore — proto V2 (`v2Prototype/{userId}`).
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import {
  V2_IMPOSED_CHARACTER,
  flattenSpellCycles,
  getAvailableKitSpellIds,
  getEmptyV2StatBlock,
  normalizePassiveIds,
  normalizeSpellCycles,
  spellCyclesToFirestore,
} from '../data/v2Kit';
import { V2_DEFAULT_PASSIVE_ID } from '../data/v2Passives';
import { V2_DEFAULT_WEAPON_ID } from '../data/v2Weapons';
import { createInitialXpState } from '../data/v2XpCurve';

const COLLECTION = 'v2Prototype';

export function hasV2Champion(proto) {
  if (!proto?.name || !proto?.characterImage) return false;
  if (proto.setupComplete === false) return false;
  return true;
}

export function createDefaultV2Prototype(userId, options = {}) {
  const xpState = createInitialXpState();
  const name = String(options.name || '').trim() || 'Champion';
  const race = String(options.race || '').trim() || V2_IMPOSED_CHARACTER.race;
  const className = String(options.class || '').trim() || V2_IMPOSED_CHARACTER.class;
  const kitProto = {
    race,
    class: className,
    weaponId: V2_DEFAULT_WEAPON_ID,
    passiveIds: normalizePassiveIds([V2_DEFAULT_PASSIVE_ID, null]),
  };
  const spellCycles = normalizeSpellCycles({
    spellOrder: getAvailableKitSpellIds(kitProto),
  });
  const passiveIds = kitProto.passiveIds;
  return {
    userId,
    name,
    race,
    class: className,
    gender: options.gender || V2_IMPOSED_CHARACTER.gender,
    characterImage: options.characterImage || null,
    portraitSourceId: options.portraitSourceId || null,
    portraitName: options.portraitName || null,
    setupComplete: options.setupComplete === true,
    base: { ...(options.base || V2_IMPOSED_CHARACTER.base) },
    growthGains: getEmptyV2StatBlock(),
    loreBoosts: getEmptyV2StatBlock(),
    level: xpState.level,
    xp: xpState.xp,
    xpToNext: xpState.xpToNext,
    spellCycles: spellCyclesToFirestore(spellCycles),
    spellOrder: flattenSpellCycles(spellCycles),
    weaponId: V2_DEFAULT_WEAPON_ID,
    passiveId: passiveIds[0],
    passiveIds,
    labyrinth: {
      currentFloor: 1,
      highestCleared: 0,
    },
    lore: {
      lastCompletedDate: null,
      lastEndingId: null,
      lastPathLabel: null,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function getV2Prototype(userId) {
  try {
    const refDoc = doc(db, COLLECTION, userId);
    const snap = await getDoc(refDoc);
    if (!snap.exists()) {
      return { success: true, data: null };
    }
    const data = { id: snap.id, ...snap.data() };
    const passiveIds = normalizePassiveIds(data);
    data.passiveIds = passiveIds;
    data.passiveId = passiveIds[0];
    if (!data.weaponId) data.weaponId = V2_DEFAULT_WEAPON_ID;
    return { success: true, data };
  } catch (error) {
    console.error('V2 getV2Prototype:', error);
    return { success: false, error: error.message || 'Erreur lecture proto V2' };
  }
}

/**
 * Charge le proto sans le créer. Les pages de jeu doivent rediriger si pas de champion.
 */
export async function ensureV2Prototype(userId) {
  return getV2Prototype(userId);
}

/**
 * Upload image joueur vers Storage, retourne l’URL https.
 */
export async function uploadV2ChampionImage(userId, dataUrl) {
  try {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return { success: false, error: 'Image invalide' };
    }
    const storageRef = ref(storage, `v2Portraits/${userId}/champion_${Date.now()}.jpg`);
    await uploadString(storageRef, dataUrl, 'data_url');
    const downloadURL = await getDownloadURL(storageRef);
    return { success: true, imageUrl: downloadURL };
  } catch (error) {
    console.error('V2 uploadV2ChampionImage:', error);
    return { success: false, error: error.message || 'Échec upload image' };
  }
}

/**
 * Crée le champion V2 à partir du roll choisi (race/classe) + nom + image.
 */
export async function createV2Champion(
  userId,
  { name, characterImage, race, class: className, portraitSourceId, portraitName, gender }
) {
  const trimmed = String(name || '').trim();
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { success: false, error: 'Le nom doit faire entre 2 et 40 caractères.' };
  }
  if (!characterImage || typeof characterImage !== 'string') {
    return { success: false, error: 'Choisis ou uploade une image.' };
  }
  if (!race || !className) {
    return { success: false, error: 'Race et classe requises.' };
  }

  const payload = createDefaultV2Prototype(userId, {
    name: trimmed,
    characterImage,
    race,
    class: className,
    gender: gender || 'male',
    portraitSourceId: portraitSourceId || null,
    portraitName: portraitName || null,
    setupComplete: true,
  });

  try {
    await setDoc(doc(db, COLLECTION, userId), payload);
    const again = await getV2Prototype(userId);
    return again;
  } catch (error) {
    console.error('V2 createV2Champion:', error);
    return { success: false, error: error.message || 'Erreur création champion' };
  }
}

export async function saveV2Prototype(userId, partial) {
  try {
    const payload = { ...partial };
    if (payload.spellCycles) {
      const cycles = normalizeSpellCycles(payload.spellCycles);
      payload.spellCycles = spellCyclesToFirestore(cycles);
      payload.spellOrder = flattenSpellCycles(cycles);
    } else if (payload.spellOrder) {
      const cycles = normalizeSpellCycles({ spellOrder: payload.spellOrder });
      payload.spellCycles = spellCyclesToFirestore(cycles);
      payload.spellOrder = flattenSpellCycles(cycles);
    }
    if (payload.passiveIds || payload.passiveId) {
      const passiveIds = normalizePassiveIds(payload.passiveIds ?? [payload.passiveId, null]);
      payload.passiveIds = passiveIds;
      payload.passiveId = passiveIds[0];
    }
    const refDoc = doc(db, COLLECTION, userId);
    await setDoc(
      refDoc,
      {
        ...payload,
        userId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { success: true };
  } catch (error) {
    console.error('V2 saveV2Prototype:', error);
    return { success: false, error: error.message || 'Erreur sauvegarde proto V2' };
  }
}

/** Reset complet — retour au choix de champion. */
export async function resetV2Prototype(userId) {
  try {
    const payload = createDefaultV2Prototype(userId, { setupComplete: false });
    await setDoc(doc(db, COLLECTION, userId), payload);
    return { success: true, data: { id: userId, ...payload, createdAt: null, updatedAt: null } };
  } catch (error) {
    console.error('V2 resetV2Prototype:', error);
    return { success: false, error: error.message || 'Erreur reset proto V2' };
  }
}
