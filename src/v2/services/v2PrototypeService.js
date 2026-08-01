/**
 * Service Firestore — proto V2 (`v2Prototype/{userId}`).
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  V2_DEFAULT_SPELL_ORDER,
  V2_IMPOSED_CHARACTER,
  V2_PASSIVE,
  V2_WEAPON,
  getEmptyV2StatBlock,
} from '../data/v2Kit';
import { createInitialXpState } from '../data/v2XpCurve';
import {
  isLocalV2PlaceholderImage,
  loadV2PortraitsFromFirestore,
  pickPortraitForKit,
} from './v2PortraitCatalog';

const COLLECTION = 'v2Prototype';

export function createDefaultV2Prototype(userId, portrait = null) {
  const xpState = createInitialXpState();
  return {
    userId,
    name: V2_IMPOSED_CHARACTER.name,
    race: V2_IMPOSED_CHARACTER.race,
    class: V2_IMPOSED_CHARACTER.class,
    gender: V2_IMPOSED_CHARACTER.gender,
    characterImage: portrait?.characterImage || null,
    portraitSourceId: portrait?.sourceId || null,
    portraitName: portrait?.name || null,
    base: { ...V2_IMPOSED_CHARACTER.base },
    growthGains: getEmptyV2StatBlock(),
    loreBoosts: getEmptyV2StatBlock(),
    level: xpState.level,
    xp: xpState.xp,
    xpToNext: xpState.xpToNext,
    spellOrder: [...V2_DEFAULT_SPELL_ORDER],
    weaponId: V2_WEAPON.id,
    passiveId: V2_PASSIVE.id,
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

async function resolveImposedPortrait() {
  const catalog = await loadV2PortraitsFromFirestore();
  if (!catalog.success) {
    return { portrait: null, catalogError: catalog.error, portraits: [] };
  }
  const portrait = pickPortraitForKit(
    catalog.portraits,
    V2_IMPOSED_CHARACTER.race,
    V2_IMPOSED_CHARACTER.class
  );
  return { portrait, catalogError: null, portraits: catalog.portraits };
}

export async function getV2Prototype(userId) {
  try {
    const ref = doc(db, COLLECTION, userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { success: true, data: null };
    }
    return { success: true, data: { id: snap.id, ...snap.data() } };
  } catch (error) {
    console.error('V2 getV2Prototype:', error);
    return { success: false, error: error.message || 'Erreur lecture proto V2' };
  }
}

export async function ensureV2Prototype(userId) {
  const existing = await getV2Prototype(userId);
  if (!existing.success) return existing;

  if (existing.data) {
    // Migre les anciens protos qui pointaient vers un sprite repo
    if (isLocalV2PlaceholderImage(existing.data.characterImage)) {
      const { portrait, catalogError } = await resolveImposedPortrait();
      if (portrait?.characterImage) {
        await saveV2Prototype(userId, {
          characterImage: portrait.characterImage,
          portraitSourceId: portrait.sourceId,
          portraitName: portrait.name,
        });
        const again = await getV2Prototype(userId);
        if (again.success) {
          return { ...again, catalogError };
        }
      }
      return { ...existing, catalogError: catalogError || 'Aucun portrait Orc/Masochiste en BDD' };
    }
    return existing;
  }

  const { portrait, catalogError } = await resolveImposedPortrait();
  const payload = createDefaultV2Prototype(userId, portrait);
  try {
    await setDoc(doc(db, COLLECTION, userId), payload);
    const again = await getV2Prototype(userId);
    if (!again.success) return again;
    return { ...again, catalogError };
  } catch (error) {
    console.error('V2 ensureV2Prototype:', error);
    return { success: false, error: error.message || 'Erreur création proto V2' };
  }
}

export async function saveV2Prototype(userId, partial) {
  try {
    const ref = doc(db, COLLECTION, userId);
    await setDoc(
      ref,
      {
        ...partial,
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

export async function resetV2Prototype(userId) {
  const { portrait, catalogError } = await resolveImposedPortrait();
  const payload = createDefaultV2Prototype(userId, portrait);
  try {
    await setDoc(doc(db, COLLECTION, userId), payload);
    const again = await getV2Prototype(userId);
    if (!again.success) return again;
    return { ...again, catalogError };
  } catch (error) {
    console.error('V2 resetV2Prototype:', error);
    return { success: false, error: error.message || 'Erreur reset proto V2' };
  }
}
