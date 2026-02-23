/**
 * Service Boss Mondial (Cataclysme) - Duels de Cave
 *
 * Gère :
 * - État global de l'event (HP restant, statut, dates)
 * - Dégâts par personnage (cumul, tentatives, leaderboard)
 * - Tentatives matin/aprem avec reset automatique
 *
 * Collections Firestore :
 * - worldBossEvent (document unique "current")
 * - worldBossEvent/current/damages (sous-collection par personnage)
 */

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  increment,
  Timestamp,
  writeBatch,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import { WORLD_BOSS, EVENT_STATUS, WORLD_BOSS_CONSTANTS } from '../data/worldBoss.js';
import { getWeeklyChampionBoss, getCurrentWeekNumber } from '../data/championBosses.js';
import { getHallOfFame } from './tournamentService.js';

// ============================================================================
// HELPER RETRY
// ============================================================================
const retryOperation = async (operation, maxRetries = 3, delayMs = 1000) => {
  await waitForFirestore();
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isNetworkError =
        error.code === 'unavailable' ||
        error.code === 'deadline-exceeded' ||
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('network') ||
        error.message?.includes('offline');
      if (!isNetworkError || attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
  throw lastError;
};

// ============================================================================
// HELPERS DATE
// ============================================================================
function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================================
// EVENT GLOBAL
// ============================================================================
const EVENT_DOC_REF = () => doc(db, 'worldBossEvent', 'current');

/**
 * Récupérer l'état de l'event
 */
export const getWorldBossEvent = async () => {
  try {
    const result = await retryOperation(async () => {
      return await getDoc(EVENT_DOC_REF());
    });

    if (result.exists()) {
      return { success: true, data: result.data() };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error('Erreur récupération event world boss:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Démarrer l'event
 */
export const startWorldBossEvent = async () => {
  try {
    const eventData = {
      bossId: WORLD_BOSS.id,
      bossName: WORLD_BOSS.nom,
      status: EVENT_STATUS.ACTIVE,
      hpMax: WORLD_BOSS.baseStats.hp,
      hpRemaining: WORLD_BOSS.baseStats.hp,
      totalDamageDealt: 0,
      totalAttempts: 0,
      startedAt: Timestamp.now(),
      endedAt: null,
      updatedAt: Timestamp.now()
    };

    await retryOperation(async () => {
      await setDoc(EVENT_DOC_REF(), eventData);
    });

    return { success: true, data: eventData };
  } catch (error) {
    console.error('Erreur démarrage event:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Terminer l'event
 */
export const endWorldBossEvent = async () => {
  try {
    await retryOperation(async () => {
      await updateDoc(EVENT_DOC_REF(), {
        status: EVENT_STATUS.FINISHED,
        endedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur fin event:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Reset complet de l'event (HP, scores, tentatives)
 */
export const resetWorldBossEvent = async () => {
  try {
    // Supprimer toutes les entrées de dégâts
    const damagesRef = collection(db, 'worldBossEvent', 'current', 'damages');
    const damagesSnap = await retryOperation(async () => getDocs(damagesRef));

    if (!damagesSnap.empty) {
      const batch = writeBatch(db);
      damagesSnap.docs.forEach(d => batch.delete(d.ref));
      await retryOperation(async () => batch.commit());
    }

    // Reset le document event
    await retryOperation(async () => {
      await setDoc(EVENT_DOC_REF(), {
        bossId: WORLD_BOSS.id,
        bossName: WORLD_BOSS.nom,
        status: EVENT_STATUS.INACTIVE,
        hpMax: WORLD_BOSS.baseStats.hp,
        hpRemaining: WORLD_BOSS.baseStats.hp,
        totalDamageDealt: 0,
        totalAttempts: 0,
        startedAt: null,
        endedAt: null,
        updatedAt: Timestamp.now()
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur reset event:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Forcer un reset des tentatives journalières (nouvelle journée simulée)
 */
export const forceNewDay = async () => {
  try {
    const damagesRef = collection(db, 'worldBossEvent', 'current', 'damages');
    const damagesSnap = await retryOperation(async () => getDocs(damagesRef));

    if (!damagesSnap.empty) {
      const batch = writeBatch(db);
      damagesSnap.docs.forEach(d => {
        batch.update(d.ref, {
          dateKey: '',
          morningUsed: false,
          afternoonUsed: false,
          updatedAt: Timestamp.now()
        });
      });
      await retryOperation(async () => batch.commit());
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur force new day:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// DÉGÂTS PAR PERSONNAGE
// ============================================================================

/**
 * Récupérer les données de dégâts d'un personnage
 */
export const getCharacterDamage = async (characterId) => {
  try {
    const ref = doc(db, 'worldBossEvent', 'current', 'damages', characterId);
    const snap = await retryOperation(async () => getDoc(ref));
    if (snap.exists()) {
      return { success: true, data: snap.data() };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error('Erreur récupération dégâts perso:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Vérifier si un personnage peut tenter le boss
 * 2 tentatives par jour, non cumulables (perdues si non utilisées)
 */
export const canAttemptBoss = async (characterId) => {
  const result = await getCharacterDamage(characterId);
  if (!result.success) return { canAttempt: false, reason: 'Erreur de lecture' };

  const data = result.data;
  if (!data) return { canAttempt: true, attemptsLeft: WORLD_BOSS_CONSTANTS.ATTEMPTS_PER_DAY };

  const todayKey = getTodayKey();

  // Reset auto si jour différent
  if (data.dateKey !== todayKey) {
    return { canAttempt: true, attemptsLeft: WORLD_BOSS_CONSTANTS.ATTEMPTS_PER_DAY };
  }

  const todayAttempts = data.dailyAttempts || 0;
  const remaining = WORLD_BOSS_CONSTANTS.ATTEMPTS_PER_DAY - todayAttempts;

  if (remaining <= 0) {
    return { canAttempt: false, reason: `Tu as utilisé tes ${WORLD_BOSS_CONSTANTS.ATTEMPTS_PER_DAY} tentatives du jour. Reviens demain !` };
  }

  return { canAttempt: true, attemptsLeft: remaining };
};

/**
 * Enregistrer les dégâts d'une tentative
 * Met à jour atomiquement : dégâts perso + HP global
 */
export const recordAttemptDamage = async (characterId, characterName, damage) => {
  try {
    const todayKey = getTodayKey();
    const damageRef = doc(db, 'worldBossEvent', 'current', 'damages', characterId);

    // Lire l'état actuel du perso
    const snap = await retryOperation(async () => getDoc(damageRef));
    const existing = snap.exists() ? snap.data() : null;

    // Compteur journalier (reset chaque jour, non cumulable)
    const isNewDate = !existing || existing.dateKey !== todayKey;
    const dailyAttempts = isNewDate ? 1 : (existing.dailyAttempts || 0) + 1;

    const updatedDamage = {
      characterId,
      characterName,
      totalDamage: (existing?.totalDamage || 0) + damage,
      lastAttemptDamage: damage,
      totalAttempts: (existing?.totalAttempts || 0) + 1,
      dateKey: todayKey,
      dailyAttempts,
      updatedAt: Timestamp.now()
    };

    // Batch : update dégâts perso + HP global
    const batch = writeBatch(db);
    batch.set(damageRef, updatedDamage);
    batch.update(EVENT_DOC_REF(), {
      hpRemaining: increment(-damage),
      totalDamageDealt: increment(damage),
      totalAttempts: increment(1),
      updatedAt: Timestamp.now()
    });

    await retryOperation(async () => batch.commit());

    // Vérifier si le boss est mort après cet enregistrement
    const eventSnap = await retryOperation(async () => getDoc(EVENT_DOC_REF()));
    if (eventSnap.exists()) {
      const eventState = eventSnap.data();
      if (eventState.hpRemaining <= 0 && eventState.status === EVENT_STATUS.ACTIVE) {
        await onBossDefeated(characterName);
      }
    }

    return { success: true, data: updatedDamage };
  } catch (error) {
    console.error('Erreur enregistrement dégâts:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Récupérer le leaderboard (tous les personnages triés par dégâts)
 */
export const getLeaderboard = async () => {
  try {
    const damagesRef = collection(db, 'worldBossEvent', 'current', 'damages');
    const snap = await retryOperation(async () => getDocs(damagesRef));

    const entries = [];
    snap.docs.forEach(d => {
      entries.push({ id: d.id, ...d.data() });
    });

    // Tri décroissant par dégâts totaux
    entries.sort((a, b) => (b.totalDamage || 0) - (a.totalDamage || 0));

    return { success: true, data: entries };
  } catch (error) {
    console.error('Erreur récupération leaderboard:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// BOSS VAINCU : REWARDS + FIN AUTO
// ============================================================================

/**
 * Appelé quand le boss tombe à 0 HP
 * - Termine l'event
 * - Donne 3 rerolls (tripleRoll) à tous les participants
 * - Annonce Discord de victoire
 */
const onBossDefeated = async (killerName) => {
  try {
    // 1. Terminer l'event
    await retryOperation(async () => {
      await updateDoc(EVENT_DOC_REF(), {
        status: EVENT_STATUS.FINISHED,
        hpRemaining: 0,
        endedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    });

    // 2. Donner tripleRoll à tous les participants
    const damagesRef = collection(db, 'worldBossEvent', 'current', 'damages');
    const damagesSnap = await retryOperation(async () => getDocs(damagesRef));
    const rewardBatch = writeBatch(db);
    const participantNames = [];

    damagesSnap.docs.forEach(d => {
      const data = d.data();
      if (data.characterId && (data.totalDamage || 0) > 0) {
        // Utiliser merge pour ne pas écraser les rewards existants
        const rewardRef = doc(db, 'tournamentRewards', data.characterId);
        rewardBatch.set(rewardRef, {
          tripleRoll: true,
          cataclysmeWins: increment(1),
          lastCataclysmeDate: Timestamp.now(),
          source: 'cataclysme'
        }, { merge: true });
        participantNames.push(data.characterName);
      }
    });

    await retryOperation(async () => rewardBatch.commit());

    // 3. Annonce Discord
    try {
      const { envoyerAnnonceDiscord } = await import('./discordService.js');
      const eventSnap = await retryOperation(async () => getDoc(EVENT_DOC_REF()));
      const eventData = eventSnap.exists() ? eventSnap.data() : {};

      await envoyerAnnonceDiscord({
        titre: `🎉 VICTOIRE !!! LE CATACLYSME A ÉTÉ VAINCU !!!`,
        message: `C'EST FINI !!! L'ABOMINATION EST TOMBÉE !!!\n\n` +
          `Le coup fatal a été porté par **${killerName}** !!! ` +
          `QUEL HÉROS !!! QUELLE PUISSANCE !!!\n\n` +
          `📊 **${eventData.totalAttempts || 0} tentatives** au total — **${participantNames.length} combattants** ont participé à cette guerre épique !!!\n\n` +
          `🎁 **RÉCOMPENSE : 3 REROLLS DE PERSONNAGE** pour tous les participants !!!\n\n` +
          `${participantNames.map(n => `⚔️ ${n}`).join('\n')}\n\n` +
          `GLOIRE ÉTERNELLE AUX HÉROS DU CATACLYSME !!!`,
        mentionEveryone: true
      });
      console.log('✅ Annonce Discord de victoire envoyée avec succès !');
    } catch (discordError) {
      console.error('❌ ERREUR ANNONCE DISCORD VICTOIRE:', discordError);
      console.error('Message d\'erreur:', discordError.message);
      console.error('Stack:', discordError.stack);
      // On ne throw pas pour ne pas bloquer les rewards
    }
  } catch (error) {
    console.error('Erreur onBossDefeated:', error);
  }
};

/**
 * Vérifie si l'event doit se terminer (samedi 12h)
 */
export const checkAutoEnd = async () => {
  try {
    const now = new Date();
    const day = now.getDay(); // 0=dim, 6=sam
    const hour = now.getHours();

    // Samedi à partir de 12h
    if (day !== 6 || hour < 12) return { ended: false };

    const result = await retryOperation(async () => getDoc(EVENT_DOC_REF()));
    if (!result.exists()) return { ended: false };

    const data = result.data();
    if (data.status !== EVENT_STATUS.ACTIVE) return { ended: false };

    // Terminer l'event
    await retryOperation(async () => {
      await updateDoc(EVENT_DOC_REF(), {
        status: EVENT_STATUS.FINISHED,
        endedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    });

    // Donner les récompenses même si le boss n'est pas mort
    const damagesRef = collection(db, 'worldBossEvent', 'current', 'damages');
    const damagesSnap = await retryOperation(async () => getDocs(damagesRef));
    const rewardBatch = writeBatch(db);
    const participantNames = [];

    damagesSnap.docs.forEach(d => {
      const dData = d.data();
      if (dData.characterId && (dData.totalDamage || 0) > 0) {
        rewardBatch.set(doc(db, 'tournamentRewards', dData.characterId), {
          tripleRoll: true,
          date: Timestamp.now(),
          source: 'cataclysme'
        });
        participantNames.push(dData.characterName);
      }
    });

    if (participantNames.length > 0) {
      await retryOperation(async () => rewardBatch.commit());
    }

    // Annonce Discord
    try {
      const { envoyerAnnonceDiscord } = await import('./discordService.js');
      const hpPct = data.hpMax > 0 ? ((data.hpRemaining / data.hpMax) * 100).toFixed(1) : '???';

      await envoyerAnnonceDiscord({
        titre: `⏰ FIN DU CATACLYSME !!!`,
        message: `LE TEMPS EST ÉCOULÉ !!! Le Cataclysme prend fin !!!\n\n` +
          `Le boss avait encore **${hpPct}%** de ses PV (${(data.hpRemaining || 0).toLocaleString('fr-FR')} / ${(data.hpMax || 0).toLocaleString('fr-FR')}).\n\n` +
          `**${participantNames.length} combattants** ont participé à cette guerre.\n\n` +
          `🎁 **RÉCOMPENSE : 3 REROLLS DE PERSONNAGE** distribués à tous les participants !!!\n\n` +
          `Rendez-vous lundi prochain à 18h pour un nouveau Cataclysme !!!`,
        mentionEveryone: true
      });
    } catch (discordError) {
      console.error('Erreur annonce Discord fin event:', discordError);
    }

    return { ended: true };
  } catch (error) {
    console.error('Erreur auto-end cataclysme:', error);
    return { ended: false };
  }
};

// ============================================================================
// LANCEMENT AUTOMATIQUE + ANNONCE DISCORD
// ============================================================================

/**
 * Annonces Discord style DBZ pour le Cataclysme
 */
const cataclysmAnnouncements = [
  (bossName) => `TREMBLEZ, MORTELS !!! UNE SECTE DE CULTISTES FOUS A BRISÉ LE SCEAU ANCESTRAL !!!\n\n` +
    `Dans les profondeurs des caves interdites, des adorateurs du chaos ont accompli un rituel interdit... ` +
    `Ils ont invoqué **${bossName}**, UN DIEU OUBLIÉ D'UNE ÈRE RÉVOLUE !!!\n\n` +
    `☄️ SON ÉNERGIE EST COLOSSALE !!! L'AIR LUI-MÊME SE DÉCHIRE SOUS SA PUISSANCE !!!\n\n` +
    `GUERRIERS ! MAGES ! VOLEURS ! TOUS DOIVENT S'UNIR OU PÉRIR !!! ` +
    `VOUS AVEZ **2 TENTATIVES PAR JOUR** POUR INFLIGER UN MAXIMUM DE DÉGÂTS À CETTE ABOMINATION !!!\n\n` +
    `💀 **${WORLD_BOSS.baseStats.hp.toLocaleString('fr-FR')} POINTS DE VIE** À DÉTRUIRE ENSEMBLE !!!\n\n` +
    `QUE LE COMBAT COMMENCE !!! L'HUMANITÉ TOUTE ENTIÈRE COMPTE SUR VOUS !!!`,

  (bossName) => `L'HEURE EST GRAVE !!! LES TÉNÈBRES S'ABATTENT SUR LE MONDE !!!\n\n` +
    `Une confrérie de cultistes hérétiques a ouvert un portail dimensionnel au cœur des caves... ` +
    `De l'autre côté, une entité titanesque a répondu à leur appel : **${bossName}** !!!\n\n` +
    `☄️ LA TERRE TREMBLE !!! LES MONTAGNES SE FISSURENT !!! CE DIEU OUBLIÉ VEUT TOUT RÉDUIRE EN CENDRES !!!\n\n` +
    `COMBATTANTS DE TOUTES LES RACES, C'EST L'HEURE DE PROUVER VOTRE VALEUR !!! ` +
    `**2 TENTATIVES PAR JOUR** — CHAQUE COUP COMPTE DANS CETTE GUERRE TOTALE !!!\n\n` +
    `⚔️ **${WORLD_BOSS.baseStats.hp.toLocaleString('fr-FR')} PV** SE DRESSENT ENTRE VOUS ET LA VICTOIRE !!!\n\n` +
    `ALLEZ-VOUS RESTER LÀ À TREMBLER OU ALLEZ-VOUS VOUS BATTRE ?! EN AVANT !!!`,

  (bossName) => `IMPOSSIBLE !!! LES PROPHÉTIES DISAIENT VRAI !!!\n\n` +
    `Des cultistes fanatiques ont sacrifié leur propre essence pour briser le dernier sceau de la prison dimensionnelle... ` +
    `Et de cette brèche a surgi **${bossName}**, UNE DIVINITÉ DÉCHUE QUE LE MONDE AVAIT OUBLIÉE DEPUIS DES MILLÉNAIRES !!!\n\n` +
    `☄️ SA SIMPLE PRÉSENCE FAIT PLIER LA RÉALITÉ !!! C'EST UN CATACLYSME VIVANT !!!\n\n` +
    `HÉROS ! LE DESTIN DU MONDE EST ENTRE VOS MAINS !!! ` +
    `**2 ESSAIS PAR JOUR** POUR FRAPPER CETTE HORREUR AVEC TOUT CE QUE VOUS AVEZ !!!\n\n` +
    `🔥 **${WORLD_BOSS.baseStats.hp.toLocaleString('fr-FR')} PV** — IL FAUDRA L'EFFORT DE TOUS POUR L'ABATTRE !!!\n\n` +
    `NE RECULEZ PAS !!! C'EST MAINTENANT OU JAMAIS !!!`
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Lancer le Cataclysme : reset total + annonce Discord
 * @param {object} bossData - Données du boss { name, isChampion, championData }
 */
export const launchCataclysm = async (bossData) => {
  try {
    // Accepter soit un string (ancien format) soit un objet (nouveau format)
    let finalBossName = WORLD_BOSS.nom;
    let useBossStats = WORLD_BOSS.baseStats;
    let isChampionBoss = false;
    let championName = null;
    let originalChampion = null;
    
    if (typeof bossData === 'string') {
      // Ancien format : juste un nom de boss générique
      finalBossName = bossData || WORLD_BOSS.nom;
    } else if (bossData && typeof bossData === 'object') {
      // Nouveau format avec données complètes
      finalBossName = bossData.name || WORLD_BOSS.nom;
      
      if (bossData.isChampion && bossData.championData) {
        const champion = bossData.championData;
        
        // Charger les stats complètes du champion depuis archivedCharacters (même clé que championBosses.js)
        try {
          const archivedRef = collection(db, 'archivedCharacters');
          const q = query(
            archivedRef,
            where('userId', '==', champion.userId),
            where('tournamentChampion', '==', true)
          );
          
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const fullChampion = snapshot.docs[0].data();
            
            if (fullChampion.base) {
              useBossStats = {
                hp: WORLD_BOSS.baseStats.hp, // HP du boss (45k)
                auto: fullChampion.base.auto || 0,
                cap: fullChampion.base.cap || 0,
                def: fullChampion.base.def || 0,
                rescap: fullChampion.base.rescap || 0,
                spd: fullChampion.base.spd || 0
              };
              
              isChampionBoss = true;
              championName = champion.nom || champion.name || finalBossName;
              // Firestore n'accepte pas undefined : n'inclure que des valeurs définies ou null
              originalChampion = {
                userId: fullChampion.userId ?? null,
                odUserId: fullChampion.odUserId ?? fullChampion.userId ?? null,
                odPseudo: fullChampion.odPseudo ?? fullChampion.ownerPseudo ?? null,
                race: fullChampion.race ?? null,
                classe: fullChampion.classe ?? fullChampion.class ?? null,
                level: fullChampion.level ?? null,
                characterImage: fullChampion.characterImage ?? null
              };
              
              console.log('✅ Stats du champion chargées:', useBossStats);
            }
          } else {
            console.log('⚠️ Champion non trouvé dans archivedCharacters, utilisation des stats par défaut');
          }
        } catch (championError) {
          console.error('Erreur chargement stats champion:', championError);
        }
      }
    }
    
    // 1. Reset le leaderboard (supprimer toutes les entrées de dégâts)
    const damagesRef = collection(db, 'worldBossEvent', 'current', 'damages');
    const damagesSnap = await retryOperation(async () => getDocs(damagesRef));

    if (!damagesSnap.empty) {
      const batch = writeBatch(db);
      damagesSnap.docs.forEach(d => batch.delete(d.ref));
      await retryOperation(async () => batch.commit());
    }

    // 2. Reset et activer l'event avec les stats appropriées
    const eventData = {
      bossId: isChampionBoss ? `champion_${originalChampion?.userId}` : WORLD_BOSS.id,
      bossName: finalBossName,
      bossStats: useBossStats, // Stats du champion ou stats génériques
      isChampionBoss,
      championName,
      originalChampion,
      status: EVENT_STATUS.ACTIVE,
      hpMax: useBossStats.hp,
      hpRemaining: useBossStats.hp,
      totalDamageDealt: 0,
      totalAttempts: 0,
      startedAt: Timestamp.now(),
      endedAt: null,
      launchedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    await retryOperation(async () => {
      await setDoc(EVENT_DOC_REF(), eventData);
    });

    // 3. Annonce Discord
    try {
      const { envoyerAnnonceDiscord } = await import('./discordService.js');
      let announcement = pickRandom(cataclysmAnnouncements)(finalBossName);
      
      // Message spécial si c'est un ancien champion
      if (isChampionBoss && championName) {
        announcement += `\n\n⚠️ **ATTENTION** : Ce boss est ${championName}, ancien champion du tournoi ! Il possède ses véritables capacités de combat !`;
      }
      
      await envoyerAnnonceDiscord({
        titre: `☄️ CATACLYSME — ${finalBossName.toUpperCase()} EST LÀ !!!`,
        message: announcement,
        mentionEveryone: true
      });
    } catch (discordError) {
      console.error('Erreur annonce Discord cataclysme:', discordError);
    }

    return { success: true, data: eventData };
  } catch (error) {
    console.error('Erreur lancement cataclysme:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// SÉLECTION ALÉATOIRE DU BOSS (GÉNÉRIQUES + CHAMPIONS)
// ============================================================================

/**
 * Retourne un seed de semaine qui change le samedi à midi
 */
function getWeekSeed() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  let daysSinceSat = (day - 6 + 7) % 7;
  if (daysSinceSat === 0 && hour < 12) daysSinceSat = 7;
  const lastSatNoon = new Date(now);
  lastSatNoon.setDate(now.getDate() - daysSinceSat);
  lastSatNoon.setHours(12, 0, 0, 0);
  return Math.floor(lastSatNoon.getTime() / (1000 * 60 * 60 * 24));
}

/**
 * Sélectionne un boss de la semaine parmi les boss génériques ET les champions
 * @param {Array} genericBossNames - Liste des noms de boss génériques (depuis les fichiers images)
 * @param {Array} championBossNames - Liste des noms de boss champions (depuis les fichiers images ChampBoss/)
 * @returns {Promise<Array<{name: string, isChampion: boolean, championData: object|null}>>}
 */
export const getAllCataclysmBossOptions = async (genericBossNames = [], championBossNames = []) => {
  const genericBosses = genericBossNames.map(name => ({
    name,
    isChampion: false,
    championData: null
  }));

  let championBosses = [];
  if (championBossNames.length > 0) {
    let hallOfFameData = [];
    try {
      const hallOfFameResult = await getHallOfFame();
      if (hallOfFameResult.success) hallOfFameData = hallOfFameResult.data;
    } catch (error) {
      console.error('Erreur récupération Hall of Fame:', error);
    }
    championBosses = championBossNames.map(bossName => {
      // Début du nom de l'image (avant la virgule) = "Croc Me Tender" pour "Croc Me Tender, Première Championne.png"
      const nameFromImage = bossName.split(',')[0].trim().toLowerCase();
      let matchedChampion = null;
      for (const entry of hallOfFameData) {
        const championName = (entry.champion?.nom || entry.champion?.name || '').toLowerCase().trim();
        if (!championName) continue;
        // Match exact ou l'un est le préfixe de l'autre (ex: "croc me tender" vs "croc me tender" ou "croc me tender, première championne")
        const match = nameFromImage === championName ||
          championName.startsWith(nameFromImage) ||
          nameFromImage.startsWith(championName);
        if (match) {
          matchedChampion = entry.champion;
          break;
        }
      }
      return { name: bossName, isChampion: true, championData: matchedChampion };
    });
  }

  const allBosses = [...genericBosses, ...championBosses];
  if (allBosses.length === 0) {
    return [{ name: WORLD_BOSS.nom, isChampion: false, championData: null }];
  }
  return allBosses;
};

/**
 * Choisit un boss de la semaine (déterministe) parmi génériques + champions.
 * @param {Array} genericBossNames - Liste des noms de boss génériques (depuis les fichiers images)
 * @param {Array} championBossNames - Liste des noms de boss champions (depuis les fichiers images ChampBoss/)
 * @returns {Promise<{name: string, isChampion: boolean, championData: object|null}>}
 */
export const pickWeeklyBossWithChampions = async (genericBossNames = [], championBossNames = []) => {
  const allBosses = await getAllCataclysmBossOptions(genericBossNames, championBossNames);
  if (allBosses.length === 0) {
    return { name: WORLD_BOSS.nom, isChampion: false, championData: null };
  }
  const seed = getWeekSeed();
  const index = seed % allBosses.length;
  const genericCount = genericBossNames.length;
  const championCount = championBossNames.length;
  console.log(`🎲 Boss pool: ${allBosses.length} boss (${genericCount} génériques + ${championCount} champions), seed=${seed}, index=${index}`);
  return allBosses[index];
};

/**
 * Vérifie si le cataclysme doit être lancé automatiquement (lundi 18h)
 * Retourne true si un lancement a été déclenché
 * @param {Array} genericBossNames - Liste des noms de boss génériques
 * @param {Array} championBossNames - Liste des noms de boss champions (depuis ChampBoss/)
 */
export const checkAutoLaunch = async (genericBossNames = [], championBossNames = []) => {
  try {
    const now = new Date();
    const day = now.getDay(); // 0=dim, 1=lun
    const hour = now.getHours();

    // Seulement le lundi à partir de 18h
    if (day !== 1 || hour < 18) return { launched: false };

    // Vérifier l'état actuel de l'event
    const result = await retryOperation(async () => getDoc(EVENT_DOC_REF()));
    if (!result.exists()) {
      // Pas d'event, on lance avec sélection aléatoire (génériques + champions)
      const weeklyBoss = await pickWeeklyBossWithChampions(genericBossNames, championBossNames);
      console.log('🚀 Auto-launch Cataclysme avec boss:', weeklyBoss);
      await launchCataclysm(weeklyBoss);
      return { launched: true };
    }

    const data = result.data();

    // Si déjà actif, ne rien faire
    if (data.status === EVENT_STATUS.ACTIVE) return { launched: false };

    // Si inactif ou terminé, vérifier qu'on n'a pas déjà lancé aujourd'hui
    if (data.launchedAt) {
      const launchedDate = data.launchedAt.toDate();
      const todayKey = getTodayKey();
      const launchedKey = `${launchedDate.getFullYear()}-${String(launchedDate.getMonth() + 1).padStart(2, '0')}-${String(launchedDate.getDate()).padStart(2, '0')}`;
      if (launchedKey === todayKey) return { launched: false }; // Déjà lancé aujourd'hui
    }

    // Lancer avec sélection aléatoire (génériques + champions)
    const weeklyBoss = await pickWeeklyBossWithChampions(genericBossNames, championBossNames);
    console.log('🚀 Auto-launch Cataclysme avec boss:', weeklyBoss);
    await launchCataclysm(weeklyBoss);
    return { launched: true };
  } catch (error) {
    console.error('Erreur auto-launch cataclysme:', error);
    return { launched: false };
  }
};

// ============================================================================
// LISTENERS TEMPS RÉEL
// ============================================================================

/**
 * Écouter les changements de l'event en temps réel (HP du boss, statut, etc.)
 * Retourne une fonction unsubscribe à appeler au démontage
 */
export const onWorldBossEventChange = (callback) => {
  return onSnapshot(EVENT_DOC_REF(), (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    }
  }, (error) => {
    console.error('Erreur listener event world boss:', error);
  });
};

/**
 * Écouter les changements du leaderboard en temps réel
 * Retourne une fonction unsubscribe à appeler au démontage
 */
export const onLeaderboardChange = (callback) => {
  const damagesRef = collection(db, 'worldBossEvent', 'current', 'damages');
  return onSnapshot(damagesRef, (snap) => {
    const entries = [];
    snap.docs.forEach(d => {
      entries.push({ id: d.id, ...d.data() });
    });
    entries.sort((a, b) => (b.totalDamage || 0) - (a.totalDamage || 0));
    callback(entries);
  }, (error) => {
    console.error('Erreur listener leaderboard:', error);
  });
};
