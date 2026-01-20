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
import { db } from '../firebase/config';

// Sauvegarder un personnage
export const saveCharacter = async (userId, characterData) => {
  try {
    const characterRef = doc(db, 'characters', userId);
    const data = {
      ...characterData,
      userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    await setDoc(characterRef, data);
    return { success: true, data };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    return { success: false, error: error.message };
  }
};

// Récupérer le personnage d'un utilisateur
export const getUserCharacter = async (userId) => {
  try {
    console.log('📖 Tentative de récupération du personnage pour userId:', userId);
    const characterRef = doc(db, 'characters', userId);
    const characterSnap = await getDoc(characterRef);

    if (characterSnap.exists()) {
      console.log('✅ Personnage trouvé:', characterSnap.data());
      return { success: true, data: characterSnap.data() };
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
    const characterRef = doc(db, 'characters', userId);
    const characterSnap = await getDoc(characterRef);

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
    const charactersRef = collection(db, 'characters');
    // Essayer sans orderBy d'abord (peut nécessiter un index)
    const querySnapshot = await getDocs(charactersRef);

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
    const characterRef = doc(db, 'characters', userId);
    await deleteDoc(characterRef);
    console.log('Personnage supprimé:', userId);
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    return { success: false, error: error.message };
  }
};
