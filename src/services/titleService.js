/**
 * Service de gestion des titres — persistance Firestore
 *
 * Deux mécanismes de détection :
 * 1. detectTitlesFromCombat — titres basés sur un combat unique (grosse_cave, miracle, etc.)
 * 2. checkCrossWeekTitles — titres basés sur l'historique cross-semaines (legendaire, maudit)
 *    Utilise tournamentRewards/{userId}.tournamentWins et .consecutiveFirstRoundLosses
 */

import { doc, getDoc, setDoc, getDocs, collection, query, where, Timestamp, increment } from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import { detectTitlesFromCombat, getFormattedTitle } from '../data/titles';
import { saveAccountTitles } from './characterService';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getWeaponById } from '../data/weapons';
import { computeCharacterStatsDisplay } from '../hooks/useCharacterStatsDisplay';

/** Titres retirés du jeu : enlevés des listes au prochain chargement. */
const OBSOLETE_EARNED_TITLE_IDS = new Set(['sommet_hp']);

/**
 * Vérifie si de nouveaux titres ont été obtenus après un combat et les enregistre.
 *
 * @param {string} userId
 * @param {Array} steps - Steps de simulerMatch
 * @param {Object} result - Résultat de simulerMatch
 * @param {Object} playerChar - Données du personnage
 * @param {Object} context - { mode, floor, bossId, isFinalBoss, ... }
 * @returns {string[]} Nouveaux titres obtenus lors de ce combat
 */
export async function checkAndAwardTitles(userId, steps, result, playerChar, context = {}) {
  if (!userId || !steps || !result) return [];

  const detected = detectTitlesFromCombat(steps, result, playerChar, context);
  if (detected.length === 0) return [];

  try {
    await waitForFirestore();
    const charRef = doc(db, 'characters', userId);
    const snap = await getDoc(charRef);
    const data = snap.data() || {};
    const earnedTitles = data.earnedTitles || [];

    const newTitles = detected.filter(id => !earnedTitles.includes(id));
    if (newTitles.length === 0) return [];

    const updatedEarned = [...earnedTitles, ...newTitles];
    await setDoc(charRef, {
      earnedTitles: updatedEarned,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    saveAccountTitles(userId, updatedEarned, data.equippedTitle);

    return newTitles;
  } catch (err) {
    console.error('Erreur lors de l\'attribution des titres:', err);
    return [];
  }
}

/**
 * Vérifie les titres basés sur l'historique et la progression du compte.
 * Appelé au chargement du personnage (page d'accueil).
 *
 * @param {string} userId - ID du compte
 * @param {Object} [extras] - Données de progression supplémentaires
 * @param {number} [extras.labyrinthHighestFloor] - Meilleur étage du labyrinthe
 * @param {boolean} [extras.bossRushCompleted]
 * @param {Object} [extras.dungeonCompletions] - { dungeon, forest, mageTower }
 * @returns {Promise<{ added: string[], mergedEarnedTitles?: string[], equippedTitleCleared?: boolean }>}
 */
export async function checkCrossWeekTitles(userId, extras = {}) {
  if (!userId) return { added: [] };

  try {
    await waitForFirestore();

    const [charSnap, rewardSnap] = await Promise.all([
      getDoc(doc(db, 'characters', userId)),
      getDoc(doc(db, 'tournamentRewards', userId)),
    ]);

    if (!charSnap.exists()) return { added: [] };
    const charData = charSnap.data();
    const rawEarned = charData.earnedTitles || [];
    const earnedTitles = rawEarned.filter((id) => !OBSOLETE_EARNED_TITLE_IDS.has(id));
    const strippedObsolete = earnedTitles.length !== rawEarned.length;
    const rewardData = rewardSnap.exists() ? rewardSnap.data() : {};

    let tournamentWins = rewardData.tournamentWins ?? 0;
    if (tournamentWins === 0 && (!earnedTitles.includes('champion') || !earnedTitles.includes('legendaire'))) {
      try {
        const q = query(
          collection(db, 'archivedCharacters'),
          where('userId', '==', userId),
          where('tournamentChampion', '==', true)
        );
        const archSnap = await getDocs(q);
        if (!archSnap.empty) tournamentWins = archSnap.size;
      } catch (_) { /* ignore */ }
    }

    const newTitles = [];

    // --- legendaire : 2+ tournois gagnés ---
    if (!earnedTitles.includes('legendaire') && tournamentWins >= 2) {
      newTitles.push('legendaire');
    }

    // --- maudit : 3+ défaites consécutives au 1er tour ---
    if (!earnedTitles.includes('maudit') && (rewardData.consecutiveFirstRoundLosses ?? 0) >= 3) {
      newTitles.push('maudit');
    }

    // --- survivant : boss rush complété ---
    if (!earnedTitles.includes('survivant') && (charData.bossRushCompleted || extras.bossRushCompleted)) {
      newTitles.push('survivant');
    }

    const labFloor = extras.labyrinthHighestFloor ?? 0;

    // --- fleau_labyrinthe : étage 120 ---
    if (!earnedTitles.includes('fleau_labyrinthe') && labFloor >= 120) {
      newTitles.push('fleau_labyrinthe');
    }

    // --- champion : 1+ tournoi gagné ---
    if (!earnedTitles.includes('champion') && tournamentWins >= 1) {
      newTitles.push('champion');
    }

    // --- roi_labyrinthe : étage 100+ ---
    if (!earnedTitles.includes('roi_labyrinthe') && labFloor >= 100) {
      newTitles.push('roi_labyrinthe');
    }

    // --- full_stuff : arme + passif niv3 + forge + extension + sous-classe ---
    if (!earnedTitles.includes('full_stuff')) {
      const hasWeapon = !!charData.equippedWeaponId;
      const hasPassiveLv3 = !!charData.mageTowerPassive;
      const hasForge = charData.forgeUpgrade && Object.keys(charData.forgeUpgrade).length > 0;
      const hasExtension = !!charData.mageTowerExtensionPassive;
      const hasSubclass = !!charData.subclass;
      if (hasWeapon && hasPassiveLv3 && hasForge && hasExtension && hasSubclass) {
        newTitles.push('full_stuff');
      }
    }

    // --- collectionneur : 5+ bordures débloquées ---
    if (!earnedTitles.includes('collectionneur') && (charData.unlockedBorders?.length ?? 0) >= 5) {
      newTitles.push('collectionneur');
    }

    // --- sauveur_monde : 1 Cataclysme gagné ---
    if (!earnedTitles.includes('sauveur_monde') && (rewardData.cataclysmeWins ?? 0) >= 1) {
      newTitles.push('sauveur_monde');
    }

    // --- explorateur : 3 donjons de base complétés ---
    if (!earnedTitles.includes('explorateur')) {
      const completions = extras.dungeonCompletions || {};
      if (completions.dungeon && completions.forest && completions.mageTower) {
        newTitles.push('explorateur');
      }
    }

    // --- Stats totales (même calcul que la fiche perso) : 1000+ PV, puis 200+ par stat — rétroactif au chargement ---
    {
      const normalized = normalizeCharacterBonuses({
        ...charData,
        level: charData.level ?? 1,
      });
      const weapon = charData.equippedWeaponId ? getWeaponById(charData.equippedWeaponId) : null;
      const { finalStats } = computeCharacterStatsDisplay(normalized, weapon || null);
      const fs = finalStats || {};
      if (!earnedTitles.includes('colosse_mille') && (fs.hp ?? 0) > 1000) {
        newTitles.push('colosse_mille');
      }
      const stat200Titles = [
        { key: 'auto', id: 'sommet_auto' },
        { key: 'def', id: 'sommet_def' },
        { key: 'cap', id: 'sommet_cap' },
        { key: 'rescap', id: 'sommet_rescap' },
        { key: 'spd', id: 'sommet_spd' },
      ];
      for (const { key, id } of stat200Titles) {
        if (!earnedTitles.includes(id) && !newTitles.includes(id) && (fs[key] ?? 0) > 200) {
          newTitles.push(id);
        }
      }
    }

    const equippedWasObsolete = charData.equippedTitle && OBSOLETE_EARNED_TITLE_IDS.has(charData.equippedTitle);
    const needsWrite = newTitles.length > 0 || strippedObsolete || equippedWasObsolete;

    if (!needsWrite) return { added: [] };

    const updatedEarned = [...new Set([...earnedTitles, ...newTitles])];
    const patch = {
      earnedTitles: updatedEarned,
      updatedAt: Timestamp.now(),
    };
    if (equippedWasObsolete) patch.equippedTitle = null;

    await setDoc(doc(db, 'characters', userId), patch, { merge: true });
    saveAccountTitles(
      userId,
      updatedEarned,
      equippedWasObsolete ? null : charData.equippedTitle
    );

    return {
      added: newTitles,
      mergedEarnedTitles: updatedEarned,
      equippedTitleCleared: equippedWasObsolete,
    };
  } catch (err) {
    console.error('Erreur vérification titres cross-semaines:', err);
    return { added: [] };
  }
}

/**
 * Met à jour le tracking des défaites au 1er tour du tournoi.
 * Appelé par le système de tournoi après chaque match du 1er tour.
 *
 * @param {string} ownerUserId - ID du compte du joueur
 * @param {boolean} lostFirstRound - true si le joueur a perdu au 1er tour
 */
export async function trackTournamentFirstRoundResult(ownerUserId, lostFirstRound) {
  if (!ownerUserId) return;
  try {
    await waitForFirestore();
    const rewardRef = doc(db, 'tournamentRewards', ownerUserId);

    if (lostFirstRound) {
      await setDoc(rewardRef, {
        consecutiveFirstRoundLosses: increment(1),
      }, { merge: true });
    } else {
      await setDoc(rewardRef, {
        consecutiveFirstRoundLosses: 0,
      }, { merge: true });
    }
  } catch (err) {
    console.error('Erreur tracking 1er tour tournoi:', err);
  }
}

/**
 * Équipe un titre pour le personnage.
 */
export async function equipTitle(userId, titleId) {
  try {
    await waitForFirestore();
    const charRef = doc(db, 'characters', userId);
    await setDoc(charRef, {
      equippedTitle: titleId || null,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    saveAccountTitles(userId, undefined, titleId);
  } catch (err) {
    console.error('Erreur lors de l\'équipement du titre:', err);
  }
}

/**
 * Retourne le titre formaté pour affichage sur la carte.
 */
export function getDisplayTitle(titleId, gender) {
  if (!titleId) return null;
  return getFormattedTitle(titleId, gender);
}

/**
 * Calcule les statistiques d'obtention de tous les titres et bordures
 * en parcourant les personnages actifs, puis en fusionnant avec userPreferences.
 *
 * @returns {{ total: number, titleCounts: Object, borderCounts: Object }}
 */
export async function getObtentionStats() {
  try {
    await waitForFirestore();
    const snapshot = await getDocs(collection(db, 'characters'));
    const allChars = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter(char => !char.disabled);
    const total = allChars.length;

    const titleCounts = {};
    const borderCounts = {};

    const accountPrefsByUserId = new Map(
      await Promise.all(allChars.map(async (char) => {
        const userId = char.userId || char.id;
        if (!userId) return [null, null];
        try {
          // NB: Les règles Firestore limitent `userPreferences` au propriétaire.
          // Ici on calcule des stats globales: on ignore silencieusement les prefs
          // qu'on n'a pas le droit de lire (permission-denied).
          const prefsSnap = await getDoc(doc(db, 'userPreferences', userId));
          return [userId, prefsSnap.exists() ? prefsSnap.data() : null];
        } catch (err) {
          if (String(err?.code || '').includes('permission-denied')) {
            return [userId, null];
          }
          // Autres erreurs : on ne bloque pas l'accueil, mais on les log.
          console.warn('⚠️ Lecture userPreferences échouée (stats obtention):', err?.message || err);
          return [userId, null];
        }
      }))
    );

    for (const char of allChars) {
      const userId = char.userId || char.id;
      const accountPrefs = accountPrefsByUserId.get(userId) || {};

      const mergedTitles = [...new Set([
        ...(char.earnedTitles || []),
        ...(accountPrefs.earnedTitles || []),
      ])];

      const mergedBorders = [...new Set([
        ...(char.unlockedBorders || []),
        ...(accountPrefs.unlockedAccountBorders || []),
      ])];

      for (const tid of mergedTitles) {
        titleCounts[tid] = (titleCounts[tid] || 0) + 1;
      }
      for (const bid of mergedBorders) {
        borderCounts[bid] = (borderCounts[bid] || 0) + 1;
      }
    }

    return { total, titleCounts, borderCounts };
  } catch (err) {
    // Ne doit jamais casser l'accueil : fallback silencieux.
    console.warn('⚠️ Erreur calcul stats obtention:', err?.message || err);
    return { total: 0, titleCounts: {}, borderCounts: {} };
  }
}
