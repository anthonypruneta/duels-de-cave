/**
 * Générateur de Boss Cataclysme basés sur les champions du Hall of Fame
 * Transforme les anciens champions en boss avec leurs vraies stats
 */

/**
 * Génère un boss à partir d'un champion du Hall of Fame
 * @param {Object} champion - Champion du Hall of Fame ou personnage archivé
 * @param {number} bossHP - HP du boss (par défaut 35000)
 * @returns {Object} Boss prêt pour le Cataclysme
 */
export const generateChampionBoss = (champion, bossHP = 35000) => {
  if (!champion || !champion.base) {
    return null;
  }

  // Nom du champion pour l'image
  const championName = champion.nom || champion.name;
  
  return {
    id: `champion_${champion.userId || 'unknown'}`,
    nom: `${championName} - Corruption du Cataclysme`,
    description: `L'ancien champion ${championName} a été corrompu par le Cataclysme. Ses pouvoirs ont été amplifiés par les ténèbres !`,
    championName: championName,
    isChampionBoss: true,
    baseStats: {
      hp: bossHP,
      // Utiliser les vraies stats du champion (avec tous les bonus)
      auto: champion.base.auto || 0,
      cap: champion.base.cap || 0,
      def: champion.base.def || 0,
      rescap: champion.base.rescap || 0,
      spd: champion.base.spd || 0
    },
    originalChampion: {
      userId: champion.userId,
      ownerPseudo: champion.ownerPseudo,
      race: champion.race,
      classe: champion.classe || champion.class,
      level: champion.level
    }
  };
};

/**
 * Récupère un champion aléatoire du Hall of Fame et le transforme en boss
 * @param {Array} hallOfFameChampions - Liste des champions du Hall of Fame
 * @param {number} bossHP - HP du boss
 * @returns {Object} Boss champion
 */
export const getRandomChampionBoss = async (hallOfFameChampions, bossHP = 35000) => {
  if (!hallOfFameChampions || hallOfFameChampions.length === 0) {
    return null;
  }

  // Prendre un champion aléatoire
  const randomIndex = Math.floor(Math.random() * hallOfFameChampions.length);
  const championEntry = hallOfFameChampions[randomIndex];
  
  // Si le champion a un userId, essayer de charger ses données complètes depuis archivedCharacters
  if (championEntry.champion?.userId) {
    try {
      const { db } = await import('../firebase/config');
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      const archivedRef = collection(db, 'archivedCharacters');
      const q = query(
        archivedRef,
        where('userId', '==', championEntry.champion.userId),
        where('tournamentChampion', '==', true)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // On a les données complètes !
        const fullChampion = snapshot.docs[0].data();
        return generateChampionBoss(fullChampion, bossHP);
      }
    } catch (error) {
      console.error('Erreur chargement champion complet pour boss:', error);
    }
  }
  
  // Fallback : utiliser les données du Hall of Fame (peut-être incomplètes)
  return generateChampionBoss(championEntry.champion, bossHP);
};

/**
 * Sélectionne le boss champion de la semaine (basé sur le numéro de semaine)
 * @param {Array} hallOfFameChampions - Liste des champions du Hall of Fame
 * @param {number} weekNumber - Numéro de semaine pour déterminer le champion
 * @param {number} bossHP - HP du boss
 * @returns {Object} Boss champion de la semaine
 */
export const getWeeklyChampionBoss = async (hallOfFameChampions, weekNumber, bossHP = 35000) => {
  if (!hallOfFameChampions || hallOfFameChampions.length === 0) {
    return null;
  }

  // Utiliser le modulo pour choisir un champion basé sur la semaine
  const championIndex = weekNumber % hallOfFameChampions.length;
  const championEntry = hallOfFameChampions[championIndex];
  
  // Charger les données complètes comme dans getRandomChampionBoss
  if (championEntry.champion?.userId) {
    try {
      const { db } = await import('../firebase/config');
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      const archivedRef = collection(db, 'archivedCharacters');
      const q = query(
        archivedRef,
        where('userId', '==', championEntry.champion.userId),
        where('tournamentChampion', '==', true)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const fullChampion = snapshot.docs[0].data();
        return generateChampionBoss(fullChampion, bossHP);
      }
    } catch (error) {
      console.error('Erreur chargement champion complet pour boss hebdomadaire:', error);
    }
  }
  
  return generateChampionBoss(championEntry.champion, bossHP);
};

/**
 * Obtient le numéro de semaine actuel (pour rotation des boss)
 * @returns {number} Numéro de semaine
 */
export const getCurrentWeekNumber = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.floor(diff / oneWeek);
};
