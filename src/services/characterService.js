import {
  collection,
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
      const data = {
        ...characterData,
        userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      await setDoc(characterRef, data);
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
      console.log('✅ Personnage trouvé:', result.data());
      return { success: true, data: result.data() };
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
    querySnapshot.forEach((doc) => {
      characters.push({
        id: doc.id,
        ...doc.data()
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
    const storageRef = ref(storage, `characters/${userId}/profile.jpg`);

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

// Mettre à jour les boosts de stats de la forêt
export const updateCharacterForestBoosts = async (userId, forestBoosts) => {
  try {
    await retryOperation(async () => {
      const characterRef = doc(db, 'characters', userId);
      await setDoc(characterRef, {
        forestBoosts,
        updatedAt: Timestamp.now()
      }, { merge: true });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour des boosts forêt:', error);
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
