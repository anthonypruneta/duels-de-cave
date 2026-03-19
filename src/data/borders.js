/**
 * Bordures cosmétiques de carte — Duels de Cave
 *
 * Chaque bordure a un ID, un nom, une icône, une classe CSS,
 * une description de la condition de déblocage, et un checker.
 */

import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TITLES } from './titles';
import { isForgeRollHighPerfection } from './forgeDungeon';

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
  water_sun: {
    id: 'water_sun',
    nom: 'Eau & Soleil',
    icon: '🌊',
    cssClass: 'border-water-glow',
    type: 'account',
    condition: 'Gagner 2 tournois',
  },
  ancient: {
    id: 'ancient',
    nom: 'Ancien',
    icon: '📺',
    cssClass: 'border-ancient-glow',
    type: 'account',
    condition: 'Gagner un tournoi des anciens',
  },
  sable: {
    id: 'sable',
    nom: 'Sable',
    icon: '🏜️',
    cssClass: 'border-sable-glow',
    type: 'account',
    condition: 'Battre 5 fois le niveau 90 du Labyrinthe',
  },
  ornn_runic: {
    id: 'ornn_runic',
    nom: 'Forge Runique',
    icon: 'ᚠ',
    cssClass: 'border-ornn-runic-glow',
    type: 'account',
    condition: 'Obtenir une arme parfaite d’Ornn',
  },
  gojo_infinity: {
    id: 'gojo_infinity',
    nom: 'Infini',
    icon: '∞',
    cssClass: 'border-gojo-infinity-glow',
    type: 'account',
    condition: 'Obtenir un passif niveau 3 chez Gojo',
  },
  night_moon: {
    id: 'night_moon',
    nom: 'Nuit de Lune',
    icon: '🌙',
    cssClass: 'border-night-glow',
    type: 'account',
    condition: 'Vaincre 3 boss de cataclysme',
  },
  storm_tempest: {
    id: 'storm_tempest',
    nom: 'Tempête',
    icon: '⛈️',
    cssClass: 'border-storm-glow',
    type: 'account',
    condition: 'Finir 5 boss rush',
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
 * @param {string[]} [extras.accountTitles] - Titres liés au compte (persistés entre les semaines)
 * @returns {string[]} IDs des bordures débloquées
 */
export function checkBorderUnlocks(character, extras = {}) {
  if (!character) return ['default'];
  const unlocked = ['default'];

  const bossRushCompletions = extras.bossRushCompletions ?? (
    character.bossRushCompletions ?? (
      (character.bossRushCompleted || extras.bossRushCompleted) ? 1 : 0
    )
  );

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
  if ((extras.tournamentWins ?? 0) >= 2) {
    unlocked.push('water_sun');
  }

  // Débloquage rétroactif : champion du tournoi des anciens (archivé)
  if ((extras.anciensChampionWins ?? 0) >= 1) {
    unlocked.push('ancient');
  }

  if ((extras.labyrinthFloor90Wins ?? 0) >= 5) {
    unlocked.push('sable');
  }

  if ((extras.perfectOrnnWeaponCount ?? 0) >= 1) {
    unlocked.push('ornn_runic');
  }

  if ((extras.gojoPassiveLevel3Count ?? 0) >= 1) {
    unlocked.push('gojo_infinity');
  }

  if ((extras.cataclysmeWins ?? 0) >= 3) {
    unlocked.push('night_moon');
  }

  if (bossRushCompletions >= 1) {
    unlocked.push('blood');
  }

  if (bossRushCompletions >= 5) {
    unlocked.push('storm_tempest');
  }

  if ((character.level ?? 1) >= 400) {
    unlocked.push('nature');
  }

  // Pour les bordures liées au compte (titane, cosmique, transcendance),
  // utiliser les titres du compte s'ils sont fournis, sinon ceux du personnage
  const accountTitles = extras.accountTitles || [];
  const charTitles = character.earnedTitles || [];
  // Fusionner les titres du compte et du personnage pour avoir le total réel
  const allTitles = [...new Set([...accountTitles, ...charTitles])];
  const titleCount = allTitles.length;
  
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
 * Les bordures de type 'account' sont également sauvegardées dans userPreferences.
 */
export async function syncUnlockedBorders(userId, character, extras = {}) {
  let rewardSnapshotData = null;
  let rewardReadOk = false;

  if (extras.tournamentWins === undefined || extras.cataclysmeWins === undefined) {
    let wins = extras.tournamentWins ?? 0;
    let catWins = extras.cataclysmeWins ?? 0;

    try {
      const rewardSnap = await getDoc(doc(db, 'tournamentRewards', userId));
      rewardReadOk = true;
      if (rewardSnap.exists()) {
        const data = rewardSnap.data() || {};
        rewardSnapshotData = data;
        if (extras.tournamentWins === undefined) wins = data.tournamentWins ?? 0;
        if (extras.cataclysmeWins === undefined) catWins = data.cataclysmeWins ?? 0;
      }
    } catch (_) { /* ignore */ }

    // Rétro-compat : si le doc ne contient pas encore `tournamentWins`, on tente une détection sur les archis.
    if (extras.tournamentWins === undefined && wins === 0) {
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

    extras = { ...extras, tournamentWins: wins, cataclysmeWins: catWins };
  }

  // Rétroactif : si tu as déjà été champion du tournoi des anciens,
  // alors la bordure "Ancien" doit être débloquée même si les compteurs
  // de tournamentRewards n'existent pas (ou plus).
  if (extras.anciensChampionWins === undefined) {
    try {
      // Source of truth : legacyRetiredArchives contient uniquement les champions
      // (retirés à vie côté "anciens"), donc on débloque uniquement si un
      // ownerUserId existe ici.
      const q = query(
        collection(db, 'legacyRetiredArchives'),
        where('ownerUserId', '==', userId),
      );
      const snap = await getDocs(q);
      extras = { ...extras, anciensChampionWins: snap.size };
    } catch (_) {
      extras = { ...extras, anciensChampionWins: 0 };
    }
  }

  if (extras.bossRushCompletions === undefined) {
    let completions = 0;
    try {
      const rewardSnap = await getDoc(doc(db, 'tournamentRewards', userId));
      rewardReadOk = true;
      if (rewardSnap.exists()) {
        const rewardData = rewardSnap.data() || {};
        rewardSnapshotData = rewardData;
        completions = Number.isFinite(rewardData.bossRushCompletions)
          ? rewardData.bossRushCompletions
          : 0;
      }
    } catch (_) { /* ignore */ }

    try {
      const progressSnap = await getDoc(doc(db, 'dungeonProgress', userId));
      if (progressSnap.exists()) {
        const data = progressSnap.data() || {};
        const progressCompletions = Number.isFinite(data.bossRushCompletions)
          ? data.bossRushCompletions
          : (data.bossRushCompleted ? 1 : 0);
        completions = Math.max(completions, progressCompletions);
      } else {
        completions = Math.max(completions, 0);
      }
    } catch (_) {
      completions = Math.max(completions, 0);
    }
    extras = { ...extras, bossRushCompletions: completions };
  }

  if (extras.labyrinthFloor90Wins === undefined) {
    let floor90Wins = 0;
    try {
      const rewardSnap = await getDoc(doc(db, 'tournamentRewards', userId));
      rewardReadOk = true;
      if (rewardSnap.exists()) {
        const data = rewardSnap.data() || {};
        rewardSnapshotData = data;
        floor90Wins = Number.isFinite(data.labyrinthFloor90Wins) ? data.labyrinthFloor90Wins : 0;
      }
    } catch (_) { /* ignore */ }

    // Rétro-compat : approximation basée sur les semaines où l'étage 90+ a été atteint.
    // (1 victoire max comptée par semaine historique)
    if (floor90Wins < 5) {
      try {
        const weeksSnap = await getDocs(collection(db, 'userLabyrinthProgress', userId, 'weeks'));
        let retroCount = 0;
        weeksSnap.forEach((docSnap) => {
          const d = docSnap.data() || {};
          if ((d.highestClearedFloor ?? 0) >= 90) retroCount += 1;
        });
        floor90Wins = Math.max(floor90Wins, retroCount);
      } catch (_) { /* ignore */ }
    }

    extras = { ...extras, labyrinthFloor90Wins: floor90Wins };
  }

  if (extras.perfectOrnnWeaponCount === undefined || extras.gojoPassiveLevel3Count === undefined) {
    let perfectOrnnWeaponCount = extras.perfectOrnnWeaponCount ?? 0;
    let gojoPassiveLevel3Count = extras.gojoPassiveLevel3Count ?? 0;
    try {
      const rewardSnap = await getDoc(doc(db, 'tournamentRewards', userId));
      rewardReadOk = true;
      if (rewardSnap.exists()) {
        const data = rewardSnap.data() || {};
        rewardSnapshotData = data;
        if (extras.perfectOrnnWeaponCount === undefined) {
          perfectOrnnWeaponCount = Number.isFinite(data.perfectOrnnWeaponCount) ? data.perfectOrnnWeaponCount : 0;
        }
        if (extras.gojoPassiveLevel3Count === undefined) {
          gojoPassiveLevel3Count = Number.isFinite(data.gojoPassiveLevel3Count) ? data.gojoPassiveLevel3Count : 0;
        }
      }
    } catch (_) { /* ignore */ }

    // Rétro-compat: anciens persos archivés / perso actuel.
    // Si les compteurs n'étaient pas encore persistés, on infère un minimum.
    if (perfectOrnnWeaponCount < 1 || gojoPassiveLevel3Count < 1) {
      try {
        const archSnap = await getDocs(query(
          collection(db, 'archivedCharacters'),
          where('userId', '==', userId)
        ));

        let hasPerfectOrnn = false;
        let hasGojoLv3 = false;

        archSnap.forEach((docSnap) => {
          const row = docSnap.data() || {};
          if (!hasPerfectOrnn && row.forgeUpgrade && isForgeRollHighPerfection(row.forgeUpgrade, 0.9)) {
            hasPerfectOrnn = true;
          }
          if (!hasGojoLv3 && Number(row?.mageTowerExtensionPassive?.level ?? 0) >= 3) {
            hasGojoLv3 = true;
          }
        });

        if (!hasPerfectOrnn && character?.forgeUpgrade && isForgeRollHighPerfection(character.forgeUpgrade, 0.9)) {
          hasPerfectOrnn = true;
        }
        if (!hasGojoLv3 && Number(character?.mageTowerExtensionPassive?.level ?? 0) >= 3) {
          hasGojoLv3 = true;
        }

        if (hasPerfectOrnn) perfectOrnnWeaponCount = Math.max(perfectOrnnWeaponCount, 1);
        if (hasGojoLv3) gojoPassiveLevel3Count = Math.max(gojoPassiveLevel3Count, 1);
      } catch (_) { /* ignore */ }
    }

    extras = { ...extras, perfectOrnnWeaponCount, gojoPassiveLevel3Count };
  }

  // Migration rétroactive "compteurs persistants":
  // - ne baisse jamais une valeur déjà en base
  // - injecte les compteurs manquants dans tournamentRewards
  try {
    const baseReward = rewardSnapshotData || {};
    const migratedTournamentWins = Math.max(
      Number.isFinite(baseReward.tournamentWins) ? baseReward.tournamentWins : 0,
      extras.tournamentWins ?? 0
    );
    const migratedCataclysmeWins = Math.max(
      Number.isFinite(baseReward.cataclysmeWins) ? baseReward.cataclysmeWins : 0,
      extras.cataclysmeWins ?? 0
    );
    const migratedBossRushCompletions = Math.max(
      Number.isFinite(baseReward.bossRushCompletions) ? baseReward.bossRushCompletions : 0,
      extras.bossRushCompletions ?? 0
    );
    const migratedLabFloor90Wins = Math.max(
      Number.isFinite(baseReward.labyrinthFloor90Wins) ? baseReward.labyrinthFloor90Wins : 0,
      extras.labyrinthFloor90Wins ?? 0
    );
    const migratedPerfectOrnnWeaponCount = Math.max(
      Number.isFinite(baseReward.perfectOrnnWeaponCount) ? baseReward.perfectOrnnWeaponCount : 0,
      extras.perfectOrnnWeaponCount ?? 0
    );
    const migratedGojoPassiveLevel3Count = Math.max(
      Number.isFinite(baseReward.gojoPassiveLevel3Count) ? baseReward.gojoPassiveLevel3Count : 0,
      extras.gojoPassiveLevel3Count ?? 0
    );

    const needsMigration =
      !rewardReadOk ||
      migratedTournamentWins !== (baseReward.tournamentWins ?? 0) ||
      migratedCataclysmeWins !== (baseReward.cataclysmeWins ?? 0) ||
      migratedBossRushCompletions !== (baseReward.bossRushCompletions ?? 0) ||
      migratedLabFloor90Wins !== (baseReward.labyrinthFloor90Wins ?? 0) ||
      migratedPerfectOrnnWeaponCount !== (baseReward.perfectOrnnWeaponCount ?? 0) ||
      migratedGojoPassiveLevel3Count !== (baseReward.gojoPassiveLevel3Count ?? 0);

    if (needsMigration) {
      await setDoc(doc(db, 'tournamentRewards', userId), {
        tournamentWins: migratedTournamentWins,
        cataclysmeWins: migratedCataclysmeWins,
        bossRushCompletions: migratedBossRushCompletions,
        labyrinthFloor90Wins: migratedLabFloor90Wins,
        perfectOrnnWeaponCount: migratedPerfectOrnnWeaponCount,
        gojoPassiveLevel3Count: migratedGojoPassiveLevel3Count,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }
  } catch (_) { /* ignore migration errors */ }

  // Récupérer les titres du compte pour les bordures liées au compte
  if (extras.accountTitles === undefined) {
    try {
      const prefsSnap = await getDoc(doc(db, 'userPreferences', userId));
      if (prefsSnap.exists()) {
        extras = { ...extras, accountTitles: prefsSnap.data().earnedTitles || [] };
      } else {
        extras = { ...extras, accountTitles: [] };
      }
    } catch (_) {
      extras = { ...extras, accountTitles: [] };
    }
  }

  const newUnlocked = checkBorderUnlocks(character, extras);
  const currentUnlocked = character.unlockedBorders || [];

  // Anti-régression : si "ancient" a été débloqué à tort dans le passé,
  // on le retire si la condition n'est plus valide.
  let adjustedCurrentUnlocked = currentUnlocked;
  if (!newUnlocked.includes('ancient') && currentUnlocked.includes('ancient')) {
    adjustedCurrentUnlocked = currentUnlocked.filter(id => id !== 'ancient');
  }

  const merged = [...new Set([...adjustedCurrentUnlocked, ...newUnlocked])];
  const hasChanges = (
    merged.length !== currentUnlocked.length ||
    merged.some(id => !currentUnlocked.includes(id)) ||
    currentUnlocked.some(id => id === 'ancient' && !merged.includes('ancient'))
  );
  if (!hasChanges) return currentUnlocked;
  
  // Sauvegarder dans le personnage
  try {
    await setDoc(doc(db, 'characters', userId), {
      unlockedBorders: merged,
      // Si l'effet "ancient" n'est plus débloqué mais qu'il était équipé,
      // on le déséquipe pour éviter un affichage incorrect.
      equippedBorder: (!merged.includes('ancient') && character?.equippedBorder === 'ancient') ? null : character?.equippedBorder,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Erreur sync bordures personnage:', err);
  }
  
  // Sauvegarder les bordures de type 'account' dans userPreferences pour persistance
  const accountBordersUnlocked = merged.filter(id => ACCOUNT_BORDER_IDS.has(id));
  if (accountBordersUnlocked.length > 0) {
    try {
      const prefsRef = doc(db, 'userPreferences', userId);
      const prefsSnap = await getDoc(prefsRef);
      let existingAccountBorders = prefsSnap.exists() ? (prefsSnap.data().unlockedAccountBorders || []) : [];
      // Si "ancient" n'est plus débloqué, on le retire aussi des prefs.
      if (!merged.includes('ancient') && existingAccountBorders.includes('ancient')) {
        existingAccountBorders = existingAccountBorders.filter(id => id !== 'ancient');
      }
      const mergedAccountBorders = [...new Set([...existingAccountBorders, ...accountBordersUnlocked])];
      await setDoc(prefsRef, {
        unlockedAccountBorders: mergedAccountBorders,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } catch (err) {
      console.error('Erreur sync bordures compte:', err);
    }
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
