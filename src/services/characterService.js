import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
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
    const characterRef = doc(db, 'characters', userId);
    const characterSnap = await getDoc(characterRef);

    if (characterSnap.exists()) {
      return { success: true, data: characterSnap.data() };
    } else {
      return { success: true, data: null };
    }
  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    return { success: false, error: error.message };
  }
};

// Vérifier si l'utilisateur peut créer un personnage (1 par semaine)
export const canCreateCharacter = async (userId) => {
  try {
    const characterRef = doc(db, 'characters', userId);
    const characterSnap = await getDoc(characterRef);

    if (!characterSnap.exists()) {
      return { canCreate: true, reason: 'no_character' };
    }

    const character = characterSnap.data();
    const createdAt = character.createdAt.toDate();
    const now = new Date();
    const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);

    if (daysSinceCreation >= 7) {
      return { canCreate: true, reason: 'week_passed' };
    } else {
      const daysRemaining = Math.ceil(7 - daysSinceCreation);
      return {
        canCreate: false,
        reason: 'too_soon',
        daysRemaining
      };
    }
  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    return { canCreate: false, error: error.message };
  }
};

// Récupérer tous les personnages (pour backoffice admin)
export const getAllCharacters = async () => {
  try {
    const charactersRef = collection(db, 'characters');
    const q = query(charactersRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const characters = [];
    querySnapshot.forEach((doc) => {
      characters.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return { success: true, data: characters };
  } catch (error) {
    console.error('Erreur lors de la récupération des personnages:', error);
    return { success: false, error: error.message };
  }
};
