/**
 * Service de snapshots de stats — Duels de Cave
 *
 * À chaque exploit significatif (victoire d'étage du Labyrinthe, premier clear
 * d'un boss de donjon…), on enregistre les stats actuelles du personnage dans
 * une sous-collection `characters/{userId}/statSnapshots/{autoId}`.
 *
 * Objectif : si un joueur modifie ses stats le temps de battre un boss, puis
 * remet ses stats normales ensuite, l'audit admin pourra comparer les stats
 * stockées dans les snapshots à ses stats actuelles et lever une alerte.
 *
 * 100% côté client (l'admin lit, le joueur écrit seulement son propre sous-doc).
 */

import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Type de snapshot.
 * - 'labyrinth' : victoire d'un étage du Labyrinthe Infini
 * - 'dungeon'   : premier clear d'un boss de donjon (forest, cave, mageTower,
 *                 extension, subclass, forge, bossRush)
 */

/**
 * Extrait une copie "propre" des stats du personnage pour archivage.
 */
function extractCharacterSnapshot(charData) {
  if (!charData) return null;
  const safeBase = charData.base && typeof charData.base === 'object' ? { ...charData.base } : null;
  const safeForest = charData.forestBoosts && typeof charData.forestBoosts === 'object'
    ? { ...charData.forestBoosts }
    : null;

  const passive = charData.mageTowerPassive;
  const passiveSnap = passive && typeof passive === 'object'
    ? { id: passive.id || null, name: passive.name || null }
    : (typeof passive === 'string' ? { id: passive, name: null } : null);

  const ext = charData.mageTowerExtensionPassive;
  const extSnap = ext && typeof ext === 'object'
    ? { id: ext.id || null, level: Number(ext.level ?? 1) || 1 }
    : null;

  const sub = charData.subclass;
  const subSnap = sub && typeof sub === 'object'
    ? { id: sub.id || null, name: sub.name || null }
    : null;

  const forge = charData.forgeUpgrade;
  const forgeSnap = forge && typeof forge === 'object'
    ? {
        weaponId: forge.weaponId || null,
        // Stats importantes pour l'audit : % et clés existantes.
        stats: forge.stats && typeof forge.stats === 'object' ? { ...forge.stats } : null,
      }
    : null;

  return {
    name: charData.name || null,
    race: charData.race || null,
    class: charData.class || null,
    level: Number(charData.level ?? 1) || 1,
    gender: charData.gender || null,
    base: safeBase,
    forestBoosts: safeForest,
    equippedWeaponId: charData.equippedWeaponId || null,
    mageTowerPassive: passiveSnap,
    mageTowerExtensionPassive: extSnap,
    subclass: subSnap,
    forgeUpgrade: forgeSnap,
    ownerPseudo: charData.ownerPseudo || null,
  };
}

/**
 * Enregistre un snapshot de stats pour un joueur.
 *
 * @param {string} userId
 * @param {Object} params
 * @param {'labyrinth'|'dungeon'} params.type
 * @param {string} params.context  - Ex: 'laby_floor_42', 'mageTower', 'bossRush'
 * @param {Object} [params.extra] - Données additionnelles (ex: { floor: 42 })
 * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
 */
export async function recordStatSnapshot(userId, { type, context, extra = null } = {}) {
  try {
    if (!userId || !type || !context) {
      return { success: false, error: 'Paramètres manquants' };
    }

    const charRef = doc(db, 'characters', userId);
    const snap = await getDoc(charRef);
    if (!snap.exists()) {
      return { success: false, error: 'Personnage introuvable' };
    }
    const charData = snap.data();
    const statSnap = extractCharacterSnapshot(charData);
    if (!statSnap) {
      return { success: false, error: 'Impossible de sérialiser les stats' };
    }

    // characterInstanceId : permet de lier un snapshot à une INSTANCE précise de
    // personnage. Quand l'utilisateur reroll après un tournoi, un nouvel id est
    // généré, donc l'audit peut ignorer les vieux snapshots d'un ancien perso.
    const characterInstanceId = charData.characterInstanceId || null;

    const payload = {
      type,
      context,
      when: serverTimestamp(),
      stats: statSnap,
      characterInstanceId,
      ...(extra && typeof extra === 'object' ? { extra } : {}),
    };

    const colRef = collection(db, 'characters', userId, 'statSnapshots');
    const added = await addDoc(colRef, payload);
    return { success: true, id: added.id };
  } catch (error) {
    console.warn('recordStatSnapshot error:', error?.message || error);
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Helper : enregistre un snapshot pour une victoire d'étage du Labyrinthe.
 *
 * @param {string} userId
 * @param {number} floorNumber
 * @param {Object} [extra] ex: { weekId, enemyName }
 */
export async function recordLabyrinthFloorSnapshot(userId, floorNumber, extra = null) {
  const n = Number(floorNumber);
  if (!Number.isFinite(n) || n <= 0) return { success: false, error: 'Étage invalide' };
  return recordStatSnapshot(userId, {
    type: 'labyrinth',
    context: `laby_floor_${n}`,
    extra: { floor: n, ...(extra || {}) },
  });
}

/**
 * Helper : enregistre un snapshot pour le premier clear d'un boss de donjon.
 *
 * @param {string} userId
 * @param {string} dungeonKey - 'forest' | 'cave' | 'mageTower' | 'extension' | 'subclass' | 'forge' | 'bossRush'
 * @param {Object} [extra]
 */
export async function recordDungeonFirstClearSnapshot(userId, dungeonKey, extra = null) {
  if (!userId || !dungeonKey) return { success: false, error: 'Paramètres manquants' };
  return recordStatSnapshot(userId, {
    type: 'dungeon',
    context: String(dungeonKey),
    extra: extra || null,
  });
}
