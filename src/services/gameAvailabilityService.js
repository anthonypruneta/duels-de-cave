import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

function getParisDay() {
  const parisStr = new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' });
  return new Date(parisStr).getDay();
}

export const shouldLockPveModes = async () => {
  try {
    const tournoiSnap = await getDoc(doc(db, 'tournaments', 'current'));
    if (!tournoiSnap.exists()) {
      return { success: true, locked: false };
    }

    const tournoi = tournoiSnap.data();
    const isTermine = tournoi?.statut === 'termine';
    const parisDay = getParisDay();
    // Bloquer samedi soir et dimanche, débloquer dès lundi
    const isWeekend = parisDay === 0 || parisDay === 6;
    const locked = isTermine && isWeekend;

    return {
      success: true,
      locked,
      reason: locked ? 'post_tournament_downtime' : null,
      tournoiStatus: tournoi?.statut || null
    };
  } catch (error) {
    console.error('Erreur vérification disponibilité des modes:', error);
    return { success: false, locked: false, error: error.message };
  }
};

