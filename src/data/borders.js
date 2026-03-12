/**
 * Bordures cosmétiques de carte — Duels de Cave
 *
 * Chaque bordure a un ID, un nom, une icône, une classe CSS,
 * une description de la condition de déblocage, et un checker.
 */

import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export const BORDERS = {
  default: {
    id: 'default',
    nom: 'Standard',
    icon: '🪨',
    cssClass: null,
    condition: 'Toujours disponible',
  },
  lava: {
    id: 'lava',
    nom: 'Lave',
    icon: '🔥',
    cssClass: 'forge-lava-border forge-lava-glow',
    condition: 'Forger son arme',
  },
  ice: {
    id: 'ice',
    nom: 'Givre',
    icon: '❄️',
    cssClass: 'border-ice-frost border-ice-glow',
    condition: 'Atteindre l\'étage 60 du Labyrinthe',
  },
  shadow: {
    id: 'shadow',
    nom: 'Ombre',
    icon: '🌑',
    cssClass: 'border-shadow-dark border-shadow-glow',
    condition: 'Battre Gojo (Extension)',
  },
  gold: {
    id: 'gold',
    nom: 'Or',
    icon: '✨',
    cssClass: 'subclass-gold-border subclass-gold-glow',
    condition: 'Obtenir une sous-classe',
  },
  champion: {
    id: 'champion',
    nom: 'Champion',
    icon: '👑',
    cssClass: 'border-champion-rainbow border-champion-glow',
    condition: 'Remporter un tournoi',
  },
  territory: {
    id: 'territory',
    nom: 'Territoire',
    icon: '👁️',
    cssClass: 'extension-territory-border extension-territory-glow',
    condition: 'Obtenir le 2e passif',
  },
  blood: {
    id: 'blood',
    nom: 'Sang',
    icon: '🩸',
    cssClass: 'border-blood-pulse border-blood-glow',
    condition: 'Compléter le Boss Rush',
  },
  nature: {
    id: 'nature',
    nom: 'Nature',
    icon: '🌿',
    cssClass: 'border-nature-emerald border-nature-glow',
    condition: 'Atteindre niveau 400',
  },
};

/**
 * Retourne la classe CSS d'une bordure par ID.
 */
export function getBorderCssClass(borderId) {
  const border = BORDERS[borderId];
  return border?.cssClass || null;
}

/**
 * Vérifie quelles bordures sont débloquées d'après les données du personnage.
 * Retourne un tableau d'IDs.
 */
export function checkBorderUnlocks(character) {
  if (!character) return ['default'];
  const unlocked = ['default'];

  if (character.forgeUpgrade && Object.keys(character.forgeUpgrade).length > 0) {
    unlocked.push('lava');
  }

  if (character.labyrinthBestFloor >= 60) {
    unlocked.push('ice');
  }

  if (character.mageTowerExtensionPassive) {
    unlocked.push('shadow');
    unlocked.push('territory');
  }

  if (character.subclass) {
    unlocked.push('gold');
  }

  if (character.isChampion || character.championCount >= 1) {
    unlocked.push('champion');
  }

  if (character.bossRushCompleted) {
    unlocked.push('blood');
  }

  if ((character.level ?? 1) >= 400) {
    unlocked.push('nature');
  }

  return unlocked;
}

/**
 * Met à jour les bordures débloquées en Firestore si nécessaire.
 */
export async function syncUnlockedBorders(userId, character) {
  const newUnlocked = checkBorderUnlocks(character);
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
 * Équipe une bordure pour le personnage.
 */
export async function equipBorder(userId, borderCssClass) {
  try {
    await setDoc(doc(db, 'characters', userId), {
      equippedBorder: borderCssClass || null,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Erreur équipement bordure:', err);
  }
}
