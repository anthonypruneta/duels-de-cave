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

function characterKey(char) {
  const uid = String(char.id || char.userId || '');
  return `${uid}::${normName(char.name || char.nom)}`;
}

/**
 * Fusionne actifs + archives, dédupliqués, en privilégiant image + données live.
 */
function mergeCharacterPools(liveList, archivedList) {
  const map = new Map();

  const consider = (raw, { fromArchive }) => {
    if (!raw || raw.disabled || !raw.name || !raw.race || !raw.class) return;
    const id = raw.id || raw.userId;
    if (!id) return;

    const entry = {
      ...raw,
      id,
      userId: raw.userId || id,
      fromArchive: !!fromArchive,
    };
    const key = characterKey(entry);
    const prev = map.get(key);

    if (!prev) {
      map.set(key, entry);
      return;
    }

    // Préfère la version avec image ; à égalité, préfère le live
    const prevImg = hasCharacterImage(prev);
    const nextImg = hasCharacterImage(entry);
    if (nextImg && !prevImg) {
      map.set(key, entry);
      return;
    }
    if (prevImg && !nextImg) return;
    if (!fromArchive && prev.fromArchive) {
      map.set(key, { ...entry, characterImage: entry.characterImage || prev.characterImage });
    }
  };

  archivedList.forEach((c) => consider(c, { fromArchive: true }));
  liveList.forEach((c) => consider(c, { fromArchive: false }));

  return Array.from(map.values());
}

async function loadArchivedCharacters() {
  try {
    const snap = await getDocs(collection(db, 'archivedCharacters'));
    return snap.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      return {
        id: data.userId || docSnap.id,
        ...data,
        userId: data.userId || docSnap.id,
      };
    });
  } catch (e) {
    console.warn('Cave Destiny: lecture archives impossible', e?.message || e);
    return [];
  }
}

async function enrichPseudos(characters) {
  // Limite les lectures : seulement ceux sans pseudo
  const need = characters.filter((c) => !c.ownerPseudo);
  if (need.length === 0) return characters;

  const pseudoByUser = new Map();
  await Promise.all(
    need.map(async (c) => {
      const userId = c.id || c.userId;
      if (!userId || pseudoByUser.has(userId)) return;
      try {
        const pseudoRes = await getOwnerPseudoFromAccount(userId);
        const ownerPseudo = pseudoRes.success ? (pseudoRes.ownerPseudo || '') : '';
        pseudoByUser.set(userId, ownerPseudo);
      } catch {
        pseudoByUser.set(userId, '');
      }
    })
  );

  return characters.map((c) => {
    if (c.ownerPseudo) return c;
    const userId = c.id || c.userId;
    const ownerPseudo = pseudoByUser.get(userId);
    return ownerPseudo ? { ...c, ownerPseudo } : c;
  });
}

/**
 * Pool large : personnages actifs + archives (légendes passées).
 */
export async function loadCaveDestinyCharacterPool() {
  const [liveRes, archived] = await Promise.all([
    getAllCharacters(),
    loadArchivedCharacters(),
  ]);

  if (!liveRes.success && archived.length === 0) {
    return { success: false, error: liveRes.error || 'Chargement impossible', data: [] };
  }

  const live = (liveRes.success ? liveRes.data : []) || [];
  const liveActive = live.filter((c) => c && !c.disabled && !c.archived);

  let pool = mergeCharacterPools(liveActive, archived);
  pool = await enrichPseudos(pool);

  return { success: true, data: pool };
}
