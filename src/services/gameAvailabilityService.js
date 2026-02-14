import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const shouldLockPveModes = async () => {
  try {
    const tournoiSnap = await getDoc(doc(db, 'tournaments', 'current'));
    if (!tournoiSnap.exists()) {
      return { success: true, locked: false };
    }

    const tournoi = tournoiSnap.data();
    const isTermine = tournoi?.statut === 'termine';

    return {
      success: true,
      locked: isTermine,
      reason: isTermine ? 'post_tournament_downtime' : null,
      tournoiStatus: tournoi?.statut || null
    };
  } catch (error) {
    console.error('Erreur vérification disponibilité des modes:', error);
    return { success: false, locked: false, error: error.message };
  }
};

