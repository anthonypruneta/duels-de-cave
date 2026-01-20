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
    const characterRef = doc(db, 'characters', userId);
    const characterSnap = await getDoc(characterRef);

    if (!characterSnap.exists()) {
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
      return { canCreate: true, reason: 'new_week' };
    } else {
      // Calculer le prochain lundi (lundi + 7 jours)
      const nextMonday = new Date(creationMonday);
      nextMonday.setDate(nextMonday.getDate() + 7);

      // Calculer les jours restants jusqu'au prochain lundi
      const daysRemaining = Math.ceil((nextMonday - now) / (1000 * 60 * 60 * 24));

      return {
        canCreate: false,
        reason: 'same_week',
        daysRemaining: Math.max(1, daysRemaining) // Au moins 1 jour
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
