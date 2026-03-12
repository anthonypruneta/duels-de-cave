/**
 * Bordures cosmétiques de carte — Duels de Cave
 *
 * Chaque bordure a un ID, un nom, une icône, une classe CSS,
 * une description de la condition de déblocage, et un checker.
 */

import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TITLES } from './titles';

/**
 * type: 'character' = lié à la progression hebdomadaire du personnage (reset chaque semaine)
 * type: 'account'   = lié à la progression du compte (persiste d'une semaine à l'autre)
 */
export const BORDERS = {
  default: {
    id: 'default',
    nom: 'Standard',
    icon: '🪨',
    cssClass: null,
    type: 'character',
    condition: 'Toujours disponible',
  },
  lava: {
    id: 'lava',
    nom: 'Lave',
    icon: '🔥',
    cssClass: 'forge-lava-border forge-lava-glow',
    type: 'character',
    condition: 'Forger son arme',
  },
  ice: {
    id: 'ice',
    nom: 'Givre',
    icon: '❄️',
    cssClass: 'border-ice-frost border-ice-glow',
    type: 'character',
    condition: 'Atteindre l\'étage 80 du Labyrinthe',
  },
  shadow: {
    id: 'shadow',
    nom: 'Ombre',
    icon: '🌑',
    cssClass: 'border-shadow-dark border-shadow-glow',
    type: 'character',
    condition: 'Vaincre son Doppelganger (Miroir)',
  },
  gold: {
    id: 'gold',
    nom: 'Or',
    icon: '✨',
    cssClass: 'subclass-gold-border subclass-gold-glow',
    type: 'character',
    condition: 'Obtenir une sous-classe',
  },
  champion: {
    id: 'champion',
    nom: 'Champion',
    icon: '👑',
    cssClass: 'border-champion-rainbow border-champion-glow',
    type: 'account',
    condition: 'Remporter un tournoi',
  },
  territory: {
    id: 'territory',
    nom: 'Territoire',
    icon: '👁️',
    cssClass: 'extension-territory-border extension-territory-glow',
    type: 'character',
    condition: 'Obtenir le 2e passif',
  },
  blood: {
    id: 'blood',
    nom: 'Sang',
    icon: '🩸',
    cssClass: 'border-blood-pulse border-blood-glow',
    type: 'character',
    condition: 'Compléter le Boss Rush',
  },
  nature: {
    id: 'nature',
    nom: 'Nature',
    icon: '🌿',
    cssClass: 'border-nature-emerald border-nature-glow',
    type: 'character',
    condition: 'Atteindre niveau 400',
  },
  titane: {
    id: 'titane',
    nom: 'Titane',
    icon: '⚙️',
    cssClass: 'border-titane-metal border-titane-glow',
    type: 'account',
    condition: 'Débloquer 10 titres',
  },
  cosmique: {
    id: 'cosmique',
    nom: 'Cosmique',
    icon: '🌌',
    cssClass: 'border-cosmique-galaxy border-cosmique-glow',
    type: 'account',
    condition: 'Débloquer 20 titres',
  },
  transcendance: {
    id: 'transcendance',
    nom: 'Transcendance',
    icon: '💠',
    cssClass: 'border-transcendance-prism border-transcendance-glow',
    type: 'account',
    condition: 'Débloquer tous les titres',
  },
};

export const ACCOUNT_BORDER_IDS = new Set(
  Object.values(BORDERS).filter(b => b.type === 'account').map(b => b.id)
);

/**
 * Retourne la classe CSS d'une bordure par ID.
 */
export function getBorderCssClass(borderId) {
  const border = BORDERS[borderId];
  return border?.cssClass || null;
}

/**
 * Retourne uniquement la classe CSS de glow (box-shadow) pour un ID de bordure.
 */
export function getBorderGlowClass(borderId) {
  const border = BORDERS[borderId];
  if (!border?.cssClass) return null;
  const parts = border.cssClass.split(' ');
  return parts.find(p => p.includes('glow')) || null;
}

const _cssToIdCache = {};
/**
 * Résout une valeur equippedBorder (ancienne cssClass OU nouvel ID) vers un ID de bordure.
 * Rétro-compatible : si la valeur est une ancienne classe CSS, la mappe vers l'ID.
 */
export function resolveBorderId(value) {
  if (!value) return 'default';
  if (BORDERS[value]) return value;
  if (_cssToIdCache[value]) return _cssToIdCache[value];
  for (const border of Object.values(BORDERS)) {
    if (border.cssClass === value) {
      _cssToIdCache[value] = border.id;
      return border.id;
    }
  }
  return 'default';
}

/**
 * Vérifie quelles bordures sont débloquées d'après les données du personnage.
 *
 * @param {Object} character - Données du personnage
 * @param {Object} [extras] - Données supplémentaires (progression labyrinthe, etc.)
 * @param {number} [extras.labyrinthHighestFloor] - Meilleur étage du labyrinthe cette semaine
 * @returns {string[]} IDs des bordures débloquées
 */
export function checkBorderUnlocks(character, extras = {}) {
  if (!character) return ['default'];
  const unlocked = ['default'];

  if (character.forgeUpgrade && Object.keys(character.forgeUpgrade).length > 0) {
    unlocked.push('lava');
  }

  const labFloor = extras.labyrinthHighestFloor ?? character.labyrinthBestFloor ?? 0;
  if (labFloor >= 80) {
    unlocked.push('ice');
  }

  if (character.mirrorDefeated || (character.earnedTitles || []).includes('miroir_parfait')) {
    unlocked.push('shadow');
  }

  if (character.mageTowerExtensionPassive) {
    unlocked.push('territory');
  }

  if (character.subclass) {
    unlocked.push('gold');
  }

  if ((extras.tournamentWins ?? 0) >= 1) {
    unlocked.push('champion');
  }

  if (character.bossRushCompleted || extras.bossRushCompleted) {
    unlocked.push('blood');
  }

  if ((character.level ?? 1) >= 400) {
    unlocked.push('nature');
  }

  const titleCount = (character.earnedTitles || []).length;
  if (titleCount >= 10) {
    unlocked.push('titane');
  }
  if (titleCount >= 20) {
    unlocked.push('cosmique');
  }
  const totalTitles = Object.keys(TITLES).length;
  if (titleCount >= totalTitles) {
    unlocked.push('transcendance');
  }

  return unlocked;
}

/**
 * Met à jour les bordures débloquées en Firestore si nécessaire.
 */
export async function syncUnlockedBorders(userId, character, extras = {}) {
  if (extras.tournamentWins === undefined) {
    let wins = 0;
    try {
      const rewardSnap = await getDoc(doc(db, 'tournamentRewards', userId));
      if (rewardSnap.exists()) {
        wins = rewardSnap.data().tournamentWins ?? 0;
      }
    } catch (_) { /* ignore */ }

    if (wins === 0) {
      try {
        const q = query(
          collection(db, 'archivedCharacters'),
          where('userId', '==', userId),
          where('tournamentChampion', '==', true)
        );
        const snap = await getDocs(q);
        if (!snap.empty) wins = snap.size;
      } catch (_) { /* ignore */ }
    }

    extras = { ...extras, tournamentWins: wins };
  }

  const newUnlocked = checkBorderUnlocks(character, extras);
  const currentUnlocked = character.unlockedBorders || [];

  const hasNew = newUnlocked.some(id => !currentUnlocked.includes(id));
  if (!hasNew) return currentUnlocked;

  const merged = [...new Set([...currentUnlocked, ...newUnlocked])];
  try {
    await setDoc(doc(db, 'characters', userId), {
      unlockedBorders: merged,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Erreur sync bordures:', err);
  }
  return merged;
}

/**
 * Équipe une bordure pour le personnage (stocke l'ID, ex: 'lava', 'ice').
 */
export async function equipBorder(userId, borderId) {
  const resolvedId = (borderId && borderId !== 'default') ? resolveBorderId(borderId) : null;
  const value = (resolvedId && resolvedId !== 'default') ? resolvedId : null;
  try {
    await setDoc(doc(db, 'characters', userId), {
      equippedBorder: value,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Erreur équipement bordure:', err);
  }
}
