import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage, waitForFirestore } from '../firebase/config';
import { ACCOUNT_BORDER_IDS } from '../data/borders';
import { getRaceBonus, getClassBonus } from '../data/combatMechanics';
import { clearWeaponUpgrade } from './forgeService';
import { clampLevel, MAX_LEVEL } from '../data/featureFlags';
import { getEmptyStatBoosts } from '../utils/statPoints';

// Helper pour retry automatique en cas d'erreur réseau
const retryOperation = async (operation, maxRetries = 3, delayMs = 1000) => {
  // Attendre que Firestore soit prêt avant la première tentative
  console.log('⏳ Attente de la connexion Firestore...');
  await waitForFirestore();
  console.log('✅ Firestore prêt, exécution de l\'opération');

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Ne retry que pour les erreurs réseau et offline
      const isNetworkError =
        error.code === 'unavailable' ||
        error.code === 'deadline-exceeded' ||
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('network') ||
        error.message?.includes('offline');

      if (!isNetworkError || attempt === maxRetries) {
        console.error(`❌ Échec définitif après ${attempt} tentatives:`, {
          code: error.code,
          message: error.message
        });
        throw error;
      }

      console.warn(`⚠️ Tentative ${attempt}/${maxRetries} échouée, retry dans ${delayMs}ms...`);
      console.warn(`   Erreur:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2; // Exponential backoff
    }
  }

  throw lastError;
};

// Sauvegarder un personnage
export const saveCharacter = async (userId, characterData) => {
  try {
    const result = await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      const existingSnap = await getDoc(characterRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data();
        if (!existingData.disabled) {
          await addDoc(collection(db, 'characters'), {
            ...existingData,
            disabled: true,
            disabledAt: Timestamp.now()
          });
        }
      }
      const persistedCosmetics = {};
      const accountTitles = await getAccountTitles(userId);
      const accountBordersFromPrefs = await getAccountBorders(userId);
      
      if (existingSnap.exists()) {
        const prev = existingSnap.data();
        const charTitles = prev.earnedTitles || [];
        const merged = [...new Set([...charTitles, ...accountTitles.earnedTitles])];
        if (merged.length) persistedCosmetics.earnedTitles = merged;
        persistedCosmetics.equippedTitle = prev.equippedTitle || accountTitles.equippedTitle || null;
        
        // Fusionner les bordures de compte du personnage précédent ET de userPreferences
        const prevAccountBorders = (prev.unlockedBorders || []).filter(id => ACCOUNT_BORDER_IDS.has(id));
        const allAccountBorders = [...new Set([...prevAccountBorders, ...accountBordersFromPrefs])];
        if (allAccountBorders.length) persistedCosmetics.unlockedBorders = allAccountBorders;
        
        if (prev.equippedBorder && ACCOUNT_BORDER_IDS.has(prev.equippedBorder)) {
          persistedCosmetics.equippedBorder = prev.equippedBorder;
        }
      } else {
        // Nouveau compte sans personnage précédent: récupérer depuis userPreferences
        if (accountTitles.earnedTitles.length) {
          persistedCosmetics.earnedTitles = accountTitles.earnedTitles;
          persistedCosmetics.equippedTitle = accountTitles.equippedTitle;
        }
        if (accountBordersFromPrefs.length) {
          persistedCosmetics.unlockedBorders = accountBordersFromPrefs;
        }
      }

      const data = {
        ...characterData,
        ...persistedCosmetics,
        userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      await setDoc(characterRef, data);
      if (data.earnedTitles?.length) {
        await saveAccountTitles(userId, data.earnedTitles, data.equippedTitle);
      }
      return data;
    });
    return { success: true, data: result };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    return { success: false, error: error.message };
  }
};

// Récupérer le personnage d'un utilisateur
export const getUserCharacter = async (userId) => {
  try {
    console.log('📖 Tentative de récupération du personnage pour userId:', userId);

    const result = await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      const characterSnap = await getDoc(characterRef);
      return characterSnap;
    });

    if (result.exists()) {
      const data = result.data();
      console.log('✅ Personnage trouvé:', data);
      // Rétroactivité: migration PV +4 → +6 par point de stat
      const characterRef = doc(db, 'characters', userId);
      let migratedData = await applyHpStat6MigrationIfNeeded(characterRef, data);
      // Upgrade Forge orphelin : supprimer UNIQUEMENT si l'upgrade a un weaponId différent de l'arme équipée.
      // On ne touche PAS aux rolls "legacy" (sans weaponId) pour ne pas effacer des upgrades valides.
      const forgeWeaponId = migratedData.forgeUpgrade?.weaponId;
      const equippedId = migratedData.equippedWeaponId ?? null;
      if (forgeWeaponId != null && forgeWeaponId !== equippedId) {
        await clearWeaponUpgrade(userId);
        migratedData = { ...migratedData, forgeUpgrade: null };
      }
      // Niveau plafonné à la lecture (rétroactivité : persos > 400 avant activation du cap)
      const rawLevel = migratedData.level ?? 1;
      migratedData = { ...migratedData, level: clampLevel(rawLevel) };
      return { success: true, data: migratedData };
    } else {
      console.log('ℹ️ Aucun personnage trouvé pour cet utilisateur');
      return { success: true, data: null };
    }
  } catch (error) {
    console.error('❌ Erreur lors de la récupération:', error);
    console.error('Code erreur:', error.code);
    console.error('Message:', error.message);
    return { success: false, error: error.message };
  }
};

// Fonction helper pour obtenir le lundi de la semaine d'une date
const getMondayOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dimanche, 1 = lundi, etc.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustement pour avoir le lundi
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0); // Minuit
  return monday;
};

/**
 * Indique si le personnage a été créé pendant la semaine courante (lundi à lundi).
 * Utilisé pour la taverne (uniquement les personnages de la semaine).
 * @param {Object} character - Personnage avec createdAt (Timestamp ou Date)
 * @returns {boolean}
 */
export const isCharacterFromCurrentWeek = (character) => {
  if (!character?.createdAt) return false;
  const createdAt = character.createdAt?.toDate ? character.createdAt.toDate() : new Date(character.createdAt);
  const creationMonday = getMondayOfWeek(createdAt);
  const currentMonday = getMondayOfWeek(new Date());
  return creationMonday.getTime() === currentMonday.getTime();
};

// Vérifier si l'utilisateur peut créer un personnage (1 par semaine, reset le lundi)
export const canCreateCharacter = async (userId) => {
  try {
    console.log('🔍 Vérification si l\'utilisateur peut créer un personnage...');

    const characterSnap = await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      return await getDoc(characterRef);
    });

    if (!characterSnap.exists()) {
      console.log('✅ Pas de personnage existant, création autorisée');
      return { canCreate: true, reason: 'no_character' };
    }

    const character = characterSnap.data();
    const createdAt = character.createdAt.toDate();
    const now = new Date();

    // Trouver le lundi de la semaine de création
    const creationMonday = getMondayOfWeek(createdAt);

    // Trouver le lundi de la semaine actuelle
    const currentMonday = getMondayOfWeek(now);

    // Si le lundi actuel est après le lundi de création, on peut créer
    if (currentMonday > creationMonday) {
      console.log('✅ Nouvelle semaine, création autorisée');
      return { canCreate: true, reason: 'new_week' };
    } else {
      // Calculer le prochain lundi (lundi + 7 jours)
      const nextMonday = new Date(creationMonday);
      nextMonday.setDate(nextMonday.getDate() + 7);

      // Calculer les jours restants jusqu'au prochain lundi
      const daysRemaining = Math.ceil((nextMonday - now) / (1000 * 60 * 60 * 24));

      console.log('⏳ Personnage créé cette semaine, attendre', daysRemaining, 'jours');
      return {
        canCreate: false,
        reason: 'same_week',
        daysRemaining: Math.max(1, daysRemaining) // Au moins 1 jour
      };
    }
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
    console.error('Code erreur:', error.code);
    return { canCreate: false, error: error.message };
  }
};

// Récupérer tous les personnages (pour backoffice admin)
export const getAllCharacters = async () => {
  try {
    const querySnapshot = await retryOperation(async () => {
      const charactersRef = collection(db, 'characters');
      return await getDocs(charactersRef);
    });

    const characters = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const rawLevel = data.level ?? 1;
      characters.push({
        id: docSnap.id,
        ...data,
        level: clampLevel(rawLevel)
      });
    });

    // Trier manuellement par date de création
    characters.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.toMillis() - a.createdAt.toMillis();
    });

    console.log('Personnages récupérés:', characters.length);
    return { success: true, data: characters };
  } catch (error) {
    console.error('Erreur lors de la récupération des personnages:', error);
    return { success: false, error: error.message };
  }
};

// Supprimer un personnage (pour backoffice admin)
export const deleteCharacter = async (userId) => {
  try {
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      const snap = await getDoc(characterRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.earnedTitles?.length) {
          await saveAccountTitles(userId, data.earnedTitles, data.equippedTitle);
        }
      }
      await deleteDoc(characterRef);
    });
    console.log('Personnage supprimé:', userId);
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    return { success: false, error: error.message };
  }
};

// Mettre à jour l'image d'un personnage (pour backoffice admin)
// Upload sur Firebase Storage puis sauvegarde de l'URL dans Firestore
export const updateCharacterImage = async (userId, imageDataUrl) => {
  try {
    // 1. Upload l'image sur Firebase Storage
    const storageRef = ref(storage, `characters/${userId}/profile_${Date.now()}.jpg`);

    // uploadString accepte les data URLs directement
    await uploadString(storageRef, imageDataUrl, 'data_url');
    console.log('Image uploadée sur Storage:', userId);

    // 2. Récupérer l'URL de téléchargement
    const downloadURL = await getDownloadURL(storageRef);
    console.log('URL de téléchargement:', downloadURL);

    // 3. Sauvegarder l'URL dans Firestore
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      await setDoc(characterRef, {
        characterImage: downloadURL,
        updatedAt: Timestamp.now()
      }, { merge: true });
    });

    console.log('Image du personnage mise à jour:', userId);
    return { success: true, imageUrl: downloadURL };
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'image:', error);
    return { success: false, error: error.message };
  }
};

// Mettre à jour l'image d'un personnage archivé
export const updateArchivedCharacterImage = async (docId, imageDataUrl) => {
  try {
    const storageRef = ref(storage, `characters/archived/${docId}/profile_${Date.now()}.jpg`);
    await uploadString(storageRef, imageDataUrl, 'data_url');
    const downloadURL = await getDownloadURL(storageRef);

    await retryOperation(async () => {
      const archivedRef = doc(db, 'archivedCharacters', docId);
      await setDoc(archivedRef, { characterImage: downloadURL }, { merge: true });
    });

    return { success: true, imageUrl: downloadURL };
  } catch (error) {
    console.error('Erreur mise à jour image archivée:', error);
    return { success: false, error: error.message };
  }
};

// Mettre à jour les stats de base d'un personnage
export const updateCharacterBaseStats = async (userId, baseStats) => {
  try {
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      await setDoc(characterRef, {
        base: baseStats,
        updatedAt: Timestamp.now()
      }, { merge: true });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour des stats:', error);
    return { success: false, error: error.message };
  }
};

// Mettre à jour les boosts de stats de la forêt (avec level cap si actif).
// À niveau 400+, les boosts ne sont pas modifiés (donjon forêt bloqué).
export const updateCharacterForestBoosts = async (userId, forestBoosts, level = null) => {
  try {
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      const updateData = { updatedAt: Timestamp.now() };

      const effectiveLevel = level !== null ? clampLevel(level) : null;
      if (effectiveLevel !== null) {
        updateData.level = effectiveLevel;
      }

      if (effectiveLevel !== null && effectiveLevel >= MAX_LEVEL) {
        const snap = await getDoc(characterRef);
        const existing = snap.exists() ? snap.data() : {};
        updateData.forestBoosts = existing.forestBoosts ?? forestBoosts;
      } else {
        updateData.forestBoosts = forestBoosts;
      }

      await setDoc(characterRef, updateData, { merge: true });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour des boosts forêt:', error);
    return { success: false, error: error.message };
  }
};

// Mettre à jour le passif de la tour du mage
export const updateCharacterMageTowerPassive = async (userId, mageTowerPassive) => {
  try {
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      await setDoc(characterRef, {
        mageTowerPassive: mageTowerPassive || null,
        updatedAt: Timestamp.now()
      }, { merge: true });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour du passif tour du mage:', error);
    return { success: false, error: error.message };
  }
};

// Mettre à jour le passif secondaire (Extension du Territoire)
export const updateCharacterMageTowerExtensionPassive = async (userId, mageTowerExtensionPassive) => {
  try {
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      await setDoc(characterRef, {
        mageTowerExtensionPassive: mageTowerExtensionPassive || null,
        updatedAt: Timestamp.now()
      }, { merge: true });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour du passif extension:', error);
    return { success: false, error: error.message };
  }
};

// Mettre à jour la sous-classe (Collège Kunugigaoka)
export const updateCharacterSubclass = async (userId, subclass) => {
  try {
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      await setDoc(characterRef, {
        subclass: subclass ? { id: subclass.id, name: subclass.name } : null,
        updatedAt: Timestamp.now()
      }, { merge: true });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la sous-classe:', error);
    return { success: false, error: error.message };
  }
};

// Mettre à jour l'arme équipée (stockée dans le personnage)
export const updateCharacterEquippedWeapon = async (userId, weaponId) => {
  try {
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      await setDoc(characterRef, {
        equippedWeaponId: weaponId || null,
        updatedAt: Timestamp.now()
      }, { merge: true });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'arme équipée:', error);
    return { success: false, error: error.message };
  }
};

// Sauvegarder un roll en attente (lock race/classe/stats)
export const savePendingRoll = async (userId, rollData) => {
  try {
    await retryOperation(async () => {
      const rollRef = doc(db, 'pendingRolls', userId);
      await setDoc(rollRef, {
        ...rollData,
        userId,
        rolledAt: Timestamp.now()
      });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur sauvegarde pending roll:', error);
    return { success: false, error: error.message };
  }
};

// Récupérer un roll en attente
export const getPendingRoll = async (userId) => {
  try {
    const result = await retryOperation(async () => {
      const rollRef = doc(db, 'pendingRolls', userId);
      return await getDoc(rollRef);
    });
    if (result.exists()) {
      return { success: true, data: result.data() };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error('Erreur récupération pending roll:', error);
    return { success: false, data: null };
  }
};

// Supprimer un roll en attente
export const deletePendingRoll = async (userId) => {
  try {
    await retryOperation(async () => {
      await deleteDoc(doc(db, 'pendingRolls', userId));
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur suppression pending roll:', error);
    return { success: false, error: error.message };
  }
};

// Récupérer les personnages désactivés d'un utilisateur
// Cherche dans 'characters' (disabled) ET 'archivedCharacters' (archivés par le tournoi)
export const getDisabledCharacters = async (userId) => {
  try {
    const result = await retryOperation(async () => {
      const qDisabled = query(
        collection(db, 'characters'),
        where('userId', '==', userId),
        where('disabled', '==', true)
      );
      const qArchived = query(
        collection(db, 'archivedCharacters'),
        where('userId', '==', userId)
      );
      const [disabledSnap, archivedSnap] = await Promise.all([
        getDocs(qDisabled),
        getDocs(qArchived)
      ]);
      const disabled = disabledSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const archived = archivedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      return [...disabled, ...archived];
    });
    return { success: true, data: result };
  } catch (error) {
    console.error('Erreur récupération personnages désactivés:', error);
    return { success: false, error: error.message };
  }
};

// Récupérer TOUS les personnages désactivés (admin)
export const getAllDisabledCharacters = async () => {
  try {
    const result = await retryOperation(async () => {
      const q = query(
        collection(db, 'characters'),
        where('disabled', '==', true)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    return { success: true, data: result };
  } catch (error) {
    console.error('Erreur récupération personnages désactivés:', error);
    return { success: false, error: error.message };
  }
};

// Activer/désactiver un personnage (admin)
export const toggleCharacterDisabled = async (userId, disabled) => {
  try {
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      await setDoc(characterRef, {
        disabled: !!disabled,
        updatedAt: Timestamp.now()
      }, { merge: true });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur lors du changement de statut:', error);
    return { success: false, error: error.message };
  }
};


// Sauvegarder les titres au niveau du compte (userPreferences)
export const saveAccountTitles = async (userId, earnedTitles, equippedTitle) => {
  try {
    await retryOperation(async () => {
      const prefsRef = doc(db, 'userPreferences', userId);
      const update = { updatedAt: Timestamp.now() };
      if (earnedTitles) update.earnedTitles = earnedTitles;
      if (equippedTitle !== undefined) update.equippedTitle = equippedTitle || null;
      await setDoc(prefsRef, update, { merge: true });
    });
  } catch (error) {
    console.error('Erreur sauvegarde titres compte:', error);
  }
};

// Récupérer les titres sauvegardés au niveau du compte
export const getAccountTitles = async (userId) => {
  try {
    await waitForFirestore();
    const prefsRef = doc(db, 'userPreferences', userId);
    const snap = await getDoc(prefsRef);
    if (!snap.exists()) return { earnedTitles: [], equippedTitle: null };
    const data = snap.data();
    return {
      earnedTitles: data.earnedTitles || [],
      equippedTitle: data.equippedTitle || null,
    };
  } catch (error) {
    console.error('Erreur lecture titres compte:', error);
    return { earnedTitles: [], equippedTitle: null };
  }
};

// Récupérer les bordures de compte sauvegardées dans userPreferences
export const getAccountBorders = async (userId) => {
  try {
    await waitForFirestore();
    const prefsRef = doc(db, 'userPreferences', userId);
    const snap = await getDoc(prefsRef);
    if (!snap.exists()) return [];
    return snap.data().unlockedAccountBorders || [];
  } catch (error) {
    console.error('Erreur lecture bordures compte:', error);
    return [];
  }
};

// Récupérer le pseudo enregistré sur le compte (Firestore)
export const getOwnerPseudoFromAccount = async (userId) => {
  try {
    await waitForFirestore();
    const prefsRef = doc(db, 'userPreferences', userId);
    const snap = await getDoc(prefsRef);
    const pseudo = snap.exists() ? (snap.data().ownerPseudo || '') : '';
    return { success: true, ownerPseudo: pseudo };
  } catch (error) {
    console.error('Erreur lecture pseudo compte:', error);
    return { success: false, ownerPseudo: '' };
  }
};

// Enregistrer le pseudo sur le compte (lié au userId, réutilisé à chaque création)
export const saveOwnerPseudoToAccount = async (userId, ownerPseudo) => {
  try {
    await retryOperation(async () => {
      const prefsRef = doc(db, 'userPreferences', userId);
      await setDoc(prefsRef, {
        ownerPseudo: (ownerPseudo || '').trim().slice(0, 24) || null,
        updatedAt: Timestamp.now()
      }, { merge: true });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur sauvegarde pseudo compte:', error);
    return { success: false, error: error.message };
  }
};

// Mettre à jour le pseudo propriétaire du personnage (et sur le compte)
export const updateCharacterOwnerPseudo = async (userId, ownerPseudo) => {
  try {
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      await setDoc(characterRef, {
        ownerPseudo: ownerPseudo || null,
        updatedAt: Timestamp.now()
      }, { merge: true });
    });
    const saveAccount = await saveOwnerPseudoToAccount(userId, ownerPseudo);
    if (!saveAccount.success) return saveAccount;
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour du pseudo propriétaire:', error);
    return { success: false, error: error.message };
  }
};

// Migration: gains PV +4 → +6 par point de stat (base.hp et forestBoosts.hp)
const HP_STAT_MIGRATION_FLAG = 'migrationHpStat6Applied';
const OLD_HP_PER_POINT = 4;
const NEW_HP_PER_POINT = 6;

/**
 * Calcule les valeurs base.hp et forestBoosts.hp après migration 4→6 PV/point.
 * Retourne { newBaseHp, newForestBoostsHp } ou null si rien à migrer.
 */
export const computeHpStat6Migration = (char) => {
  if (!char?.base) return null;
  const raceHp = (char.bonuses?.race?.hp ?? getRaceBonus(char.race || '').hp) || 0;
  const classHp = (char.bonuses?.class?.hp ?? getClassBonus(char.class || '').hp) || 0;
  const rawHp = (char.base.hp ?? 0) - raceHp - classHp;
  const pointsHpBase = rawHp >= 120 ? Math.floor((rawHp - 120) / OLD_HP_PER_POINT) : 0;
  const newBaseHp = (char.base.hp ?? 0) + pointsHpBase * (NEW_HP_PER_POINT - OLD_HP_PER_POINT);

  const forestHpOld = char.forestBoosts?.hp ?? 0;
  const pointsForest = Math.round(forestHpOld / OLD_HP_PER_POINT);
  const newForestBoostsHp = pointsForest * NEW_HP_PER_POINT;

  return { newBaseHp, newForestBoostsHp, pointsHpBase, pointsForest };
};

/**
 * Applique la migration HP 4→6 sur un personnage (écrit en Firestore si pas déjà fait).
 * À appeler après getDoc dans getUserCharacter pour rétroactivité à la lecture.
 */
const applyHpStat6MigrationIfNeeded = async (characterRef, data) => {
  if (data[HP_STAT_MIGRATION_FLAG]) return data;
  const computed = computeHpStat6Migration(data);
  if (!computed) return data;

  const updatedBase = { ...data.base, hp: computed.newBaseHp };
  const updatedForestBoosts = { ...(data.forestBoosts || {}), hp: computed.newForestBoostsHp };

  await setDoc(characterRef, {
    base: updatedBase,
    forestBoosts: updatedForestBoosts,
    [HP_STAT_MIGRATION_FLAG]: true,
    updatedAt: Timestamp.now()
  }, { merge: true });

  return {
    ...data,
    base: updatedBase,
    forestBoosts: updatedForestBoosts,
    [HP_STAT_MIGRATION_FLAG]: true
  };
};

// Migration: convertir les forestBoosts HP de 3/point à 4/point
// Pour chaque personnage, forestBoosts.hp passe de X à X*4/3 (ajoute X/3)
export const migrateForestHpBoosts = async () => {
  try {
    const allResult = await getAllCharacters();
    if (!allResult.success) return { success: false, error: allResult.error };

    const characters = allResult.data;
    let migrated = 0;
    let skipped = 0;

    for (const char of characters) {
      const currentHp = char.forestBoosts?.hp || 0;
      if (currentHp <= 0) {
        skipped++;
        continue;
      }

      // Nombre de points investis = ancienne valeur / 3
      // Nouvelle valeur = nombre de points * 4
      const pointsInvested = Math.round(currentHp / 3);
      const newHp = pointsInvested * 4;

      const updatedBoosts = { ...char.forestBoosts, hp: newHp };
      const characterRef = doc(db, 'characters', char.id);
      await setDoc(characterRef, {
        forestBoosts: updatedBoosts,
        updatedAt: Timestamp.now()
      }, { merge: true });

      console.log(`Migration HP forêt: ${char.name} (${char.id}): ${currentHp} → ${newHp} (+${newHp - currentHp})`);
      migrated++;
    }

    return { success: true, migrated, skipped, total: characters.length };
  } catch (error) {
    console.error('Erreur migration HP forêt:', error);
    return { success: false, error: error.message };
  }
};

// Migration bulk: gains PV +4 → +6 (base.hp + forestBoosts.hp) pour tous les personnages
export const migrateHpStat4To6 = async () => {
  try {
    const allResult = await getAllCharacters();
    if (!allResult.success) return { success: false, error: allResult.error };

    const characters = allResult.data;
    let migrated = 0;
    let skipped = 0;

    for (const char of characters) {
      if (char.disabled) { skipped++; continue; }
      if (char[HP_STAT_MIGRATION_FLAG]) { skipped++; continue; }

      const computed = computeHpStat6Migration(char);
      if (!computed || (computed.pointsHpBase === 0 && computed.pointsForest === 0)) {
        skipped++;
        continue;
      }

      const updatedBase = { ...char.base, hp: computed.newBaseHp };
      const updatedForestBoosts = { ...(char.forestBoosts || {}), hp: computed.newForestBoostsHp };

      const characterRef = doc(db, 'characters', char.id);
      await setDoc(characterRef, {
        base: updatedBase,
        forestBoosts: updatedForestBoosts,
        [HP_STAT_MIGRATION_FLAG]: true,
        updatedAt: Timestamp.now()
      }, { merge: true });

      console.log(`Migration HP 4→6: ${char.name} (${char.id}): base.hp +${computed.pointsHpBase * 2}, forestBoosts.hp ${char.forestBoosts?.hp ?? 0} → ${computed.newForestBoostsHp}`);
      migrated++;
    }

    return { success: true, migrated, skipped, total: characters.length };
  } catch (error) {
    console.error('Erreur migration HP 4→6:', error);
    return { success: false, error: error.message };
  }
};

// Mettre à jour le niveau du personnage (avec level cap si actif)
export const updateCharacterLevel = async (userId, level) => {
  try {
    const clampedLevel = clampLevel(level);
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      await setDoc(characterRef, {
        level: clampedLevel,
        updatedAt: Timestamp.now()
      }, { merge: true });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour du niveau:', error);
    return { success: false, error: error.message };
  }
};

// Admin : plafonner le niveau en base à MAX_LEVEL (retourne true si modif)
export const clampCharacterLevelInDb = async (userId) => {
  try {
    await waitForFirestore();
    const characterRef = doc(db, 'characters', userId);
    const snap = await getDoc(characterRef);
    if (!snap.exists()) return { success: true, updated: false };
    const rawLevel = snap.data().level;
    if (rawLevel == null || rawLevel <= MAX_LEVEL) return { success: true, updated: false };
    await updateCharacterLevel(userId, MAX_LEVEL);
    return { success: true, updated: true };
  } catch (error) {
    console.error('Erreur clamp niveau:', error);
    return { success: false, error: error.message };
  }
};

// Admin : plafonner le niveau à 400 pour tous les persos > 400
export const clampAllCharactersLevelInDb = async () => {
  try {
    await waitForFirestore();
    const ref = collection(db, 'characters');
    const snapshot = await getDocs(ref);
    let updated = 0;
    for (const d of snapshot.docs) {
      const data = d.data();
      const rawLevel = data.level;
      if (rawLevel != null && rawLevel > MAX_LEVEL) {
        const res = await updateCharacterLevel(d.id, MAX_LEVEL);
        if (res.success) updated++;
      }
    }
    return { success: true, updated };
  } catch (error) {
    console.error('Erreur clamp niveau tous:', error);
    return { success: false, error: error.message };
  }
};

// Admin : enlever le même nombre de points par stat (Forêt), plancher 0
export const reduceCharacterForestStats = async (userId, pointsPerStat) => {
  try {
    await waitForFirestore();
    const characterRef = doc(db, 'characters', userId);
    const snap = await getDoc(characterRef);
    if (!snap.exists()) return { success: false, error: 'Personnage introuvable' };
    const current = snap.data().forestBoosts || {};
    const base = getEmptyStatBoosts();
    const newBoosts = { ...base };
    for (const key of Object.keys(base)) {
      newBoosts[key] = Math.max(0, (current[key] ?? 0) - pointsPerStat);
    }
    return await updateCharacterForestBoosts(userId, newBoosts, null);
  } catch (error) {
    console.error('Erreur réduction stats forêt:', error);
    return { success: false, error: error.message };
  }
};

// Admin : enlever le même nombre de points par stat (Forêt) pour tous les persos
export const reduceAllCharactersForestStats = async (pointsPerStat) => {
  try {
    await waitForFirestore();
    const ref = collection(db, 'characters');
    const snapshot = await getDocs(ref);
    let updated = 0;
    for (const d of snapshot.docs) {
      const data = d.data();
      const current = data.forestBoosts || {};
      const base = getEmptyStatBoosts();
      const newBoosts = { ...base };
      for (const key of Object.keys(base)) {
        newBoosts[key] = Math.max(0, (current[key] ?? 0) - pointsPerStat);
      }
      const res = await updateCharacterForestBoosts(d.id, newBoosts, null);
      if (res.success) updated++;
    }
    return { success: true, updated };
  } catch (error) {
    console.error('Erreur réduction stats forêt tous:', error);
    return { success: false, error: error.message };
  }
};
