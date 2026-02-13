import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const DOWNTIME_DAY = 0; // dimanche

export const isPostTournamentDowntimeDay = (date = new Date()) => date.getDay() === DOWNTIME_DAY;

export const shouldLockPveModes = async () => {
  try {
    if (!isPostTournamentDowntimeDay()) {
      return { success: true, locked: false };
    }

    const tournoiSnap = await getDoc(doc(db, 'tournaments', 'current'));
    if (!tournoiSnap.exists()) {
      return { success: true, locked: false };
    }

    const tournoi = tournoiSnap.data();
    const isReplayAvailable = tournoi?.statut === 'termine';

    return {
      success: true,
      locked: isReplayAvailable,
      reason: isReplayAvailable ? 'post_tournament_downtime' : null,
      tournoiStatus: tournoi?.statut || null
    };
  } catch (error) {
    console.error('Erreur vérification disponibilité des modes:', error);
    return { success: false, locked: false, error: error.message };
  }
};

