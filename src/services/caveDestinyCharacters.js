/**
 * Chargement / enrichissement des personnages pour Cave Destiny.
 */

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAllCharacters, getOwnerPseudoFromAccount } from './characterService';
import { hasCharacterImage } from '../data/caveDestiny';

function normName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Complète characterImage manquant via archivedCharacters (même userId / nom).
 */
async function mergeImagesFromArchives(characters) {
  const missing = characters.filter((c) => !hasCharacterImage(c));
  if (missing.length === 0) return characters;

  try {
    const snap = await getDocs(collection(db, 'archivedCharacters'));
    const byUserName = new Map();
    const byUser = new Map();

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      if (!hasCharacterImage(data)) return;
      const uid = String(data.userId || '');
      if (!uid) return;
      const key = `${uid}::${normName(data.name || data.nom)}`;
      // garde la première URL valide rencontrée (archives les + récentes en tête si besoin)
      if (!byUserName.has(key)) byUserName.set(key, data.characterImage);
      if (!byUser.has(uid)) byUser.set(uid, data.characterImage);
    });

    return characters.map((c) => {
      if (hasCharacterImage(c)) return c;
      const uid = String(c.id || c.userId || '');
      const key = `${uid}::${normName(c.name)}`;
      const img = byUserName.get(key) || byUser.get(uid) || null;
      return img ? { ...c, characterImage: img } : c;
    });
  } catch (e) {
    console.warn('Cave Destiny: enrichissement images archives impossible', e?.message || e);
    return characters;
  }
}

async function enrichPseudos(characters) {
  return Promise.all(
    characters.map(async (c) => {
      if (c.ownerPseudo) return c;
      const userId = c.id || c.userId;
      if (!userId) return c;
      try {
        const pseudoRes = await getOwnerPseudoFromAccount(userId);
        const ownerPseudo = pseudoRes.success ? (pseudoRes.ownerPseudo || '') : '';
        return ownerPseudo ? { ...c, ownerPseudo } : c;
      } catch {
        return c;
      }
    })
  );
}

/**
 * Charge tous les personnages jouables pour Cave Destiny (actifs + images si possible).
 */
export async function loadCaveDestinyCharacterPool() {
  const res = await getAllCharacters();
  if (!res.success) {
    return { success: false, error: res.error || 'Chargement impossible', data: [] };
  }

  let active = (res.data || []).filter((c) => c && !c.disabled && !c.archived && c.name && c.race && c.class);
  active = await mergeImagesFromArchives(active);
  active = await enrichPseudos(active);

  return { success: true, data: active };
}
