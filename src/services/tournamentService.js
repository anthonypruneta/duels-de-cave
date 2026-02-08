/**
 * Service Firestore pour le système de tournoi
 * Les matchs sont simulés 1 par 1 en direct (pas de pré-simulation)
 */

import { db } from '../firebase/config';
import {
  doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, addDoc,
  query, where, orderBy, onSnapshot, serverTimestamp
} from 'firebase/firestore';
import { getAllCharacters } from './characterService';
import { getEquippedWeapon } from './dungeonService';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getWeaponById } from '../data/weapons';
import { genererBracket, resoudreMatch, getParticipantNom } from '../utils/tournamentBracket';
import { simulerMatch } from '../utils/tournamentCombat';
import { annonceDebutTournoi, annonceDebutMatch, annonceFinMatch, annonceChampion } from '../utils/dbzAnnouncer';

// ============================================================================
// CHARGER LES PERSONNAGES POUR LE TOURNOI
// ============================================================================

async function chargerParticipants() {
  const result = await getAllCharacters();
  if (!result.success) throw new Error(result.error);

  const participants = await Promise.all(
    result.data
      .filter(char => !char.archived)
      .map(async (char) => {
        const level = char.level ?? 1;
        let weaponId = char.equippedWeaponId || null;
        let weaponData = weaponId ? getWeaponById(weaponId) : null;
        if (!weaponData) {
          const weaponResult = await getEquippedWeapon(char.id);
          weaponData = weaponResult.success ? weaponResult.weapon : null;
          weaponId = weaponResult.success ? (weaponResult.weapon?.id || null) : null;
        }
        return normalizeCharacterBonuses({
          ...char,
          level,
          equippedWeaponData: weaponData,
          equippedWeaponId: weaponId
        });
      })
  );

  return participants;
}

// ============================================================================
// CRÉER UN TOURNOI
// ============================================================================

export async function creerTournoi(docId = 'current') {
  try {
    const participants = await chargerParticipants();
    if (participants.length < 2) {
      return { success: false, error: 'Il faut au moins 2 personnages pour créer un tournoi' };
    }

    // Générer le bracket
    const participantIds = participants.map(p => p.userId || p.id);
    const { matches, matchOrder } = genererBracket(participantIds);

    // Stocker les données de participants pour la simulation
    const participantsMap = {};
    for (const p of participants) {
      participantsMap[p.userId || p.id] = {
        userId: p.userId || p.id,
        nom: p.name,
        race: p.race,
        classe: p.class,
        characterImage: p.characterImage || null,
        base: p.base,
        bonuses: p.bonuses,
        level: p.level ?? 1,
        equippedWeaponId: p.equippedWeaponId || null,
        equippedWeaponData: p.equippedWeaponData || null,
        mageTowerPassive: p.mageTowerPassive || null,
        forestBoosts: p.forestBoosts || null,
        name: p.name,
        class: p.class
      };
    }

    const tournoi = {
      statut: 'preparation',
      createdAt: serverTimestamp(),
      participants: participantsMap,
      participantsList: participants.map(p => ({
        userId: p.userId || p.id,
        nom: p.name,
        race: p.race,
        classe: p.class,
        characterImage: p.characterImage || null,
      })),
      matches,
      matchOrder,
      matchActuel: -1,
      champion: null,
      annonceIntro: annonceDebutTournoi(participants.length),
    };

    await setDoc(doc(db, 'tournaments', docId), tournoi);

    return { success: true, nbParticipants: participants.length };
  } catch (error) {
    console.error('Erreur création tournoi:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// SIMULER UN MATCH UNIQUE ET STOCKER LE RÉSULTAT
// ============================================================================

function simulerUnMatch(matches, participants, matchId) {
  const match = matches[matchId];
  if (!match || match.statut === 'bye' || match.statut === 'termine') return null;

  const p1Data = participants[match.p1];
  const p2Data = participants[match.p2];
  if (!p1Data || !p2Data) return null;

  const result = simulerMatch(p1Data, p2Data);
  resoudreMatch(matches, matchId, result.winnerId, result.loserId);

  const annonceDebut = annonceDebutMatch(p1Data.nom, p2Data.nom, match.bracket, match.roundLabel);
  const annonceFin = annonceFinMatch(result.winnerNom, result.loserNom);

  return {
    combatLogData: {
      combatLog: result.combatLog,
      steps: result.steps,
      p1MaxHP: result.p1MaxHP,
      p2MaxHP: result.p2MaxHP,
      annonceDebut,
      annonceFin,
      p1Nom: p1Data.nom,
      p2Nom: p2Data.nom,
      winnerNom: result.winnerNom,
      loserNom: result.loserNom,
    },
    winnerId: result.winnerId,
    loserId: result.loserId,
  };
}

// ============================================================================
// LANCER LE TOURNOI (simule uniquement le premier match)
// ============================================================================

export async function lancerTournoi(docId = 'current') {
  try {
    const tournoiDoc = await getDoc(doc(db, 'tournaments', docId));
    if (!tournoiDoc.exists()) return { success: false, error: 'Aucun tournoi trouvé' };

    const tournoi = tournoiDoc.data();
    if (tournoi.statut !== 'preparation') return { success: false, error: 'Le tournoi a déjà été lancé' };

    const { matches, matchOrder, participants } = tournoi;
    const firstMatchId = matchOrder[0];

    // Simuler le premier match uniquement
    const result = simulerUnMatch(matches, participants, firstMatchId);
    if (!result) return { success: false, error: 'Impossible de simuler le premier match' };

    // Stocker le combat log
    await setDoc(doc(db, 'tournaments', docId, 'combatLogs', firstMatchId), result.combatLogData);

    // Mettre à jour le tournoi
    await updateDoc(doc(db, 'tournaments', docId), {
      statut: 'en_cours',
      matches,
      matchActuel: 0,
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur lancement tournoi:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// AVANCER AU MATCH SUIVANT (simule le prochain match)
// ============================================================================

export async function avancerMatch(docId = 'current') {
  try {
    const tournoiDoc = await getDoc(doc(db, 'tournaments', docId));
    if (!tournoiDoc.exists()) return { success: false, error: 'Aucun tournoi trouvé' };

    const tournoi = tournoiDoc.data();
    const { matches, participants, participantsList } = tournoi;
    let matchOrder = [...tournoi.matchOrder];
    const nextIndex = (tournoi.matchActuel ?? -1) + 1;

    // Vérifier si un GFR a été créé et doit être ajouté
    if (matches['GFR'] && matches['GFR'].statut === 'en_attente' && !matchOrder.includes('GFR')) {
      matchOrder.push('GFR');
    }

    // Si on a dépassé tous les matchs → tournoi terminé
    if (nextIndex >= matchOrder.length) {
      const gfrMatch = matches['GFR'];
      const gfMatch = matches['GF'];
      let championId = gfrMatch?.winnerId || gfMatch?.winnerId;
      const championData = participantsList.find(p => p.userId === championId);
      const champion = championData ? {
        userId: championData.userId,
        nom: championData.nom,
        race: championData.race,
        classe: championData.classe,
        characterImage: championData.characterImage
      } : null;

      await updateDoc(doc(db, 'tournaments', docId), {
        statut: 'termine',
        matchActuel: nextIndex,
        matchOrder,
        champion,
        annonceChampion: champion ? annonceChampion(champion.nom) : null,
      });
      return { success: true, termine: true, champion };
    }

    const nextMatchId = matchOrder[nextIndex];

    // Simuler le prochain match
    const result = simulerUnMatch(matches, participants, nextMatchId);

    if (!result) {
      // Match bye ou erreur → passer au suivant
      await updateDoc(doc(db, 'tournaments', docId), {
        matchActuel: nextIndex,
        matchOrder,
        matches,
      });
      return { success: true, termine: false, matchIndex: nextIndex, skipped: true };
    }

    // Stocker le combat log
    await setDoc(doc(db, 'tournaments', docId, 'combatLogs', nextMatchId), result.combatLogData);

    // Préparer la mise à jour
    let updateData = {
      matchActuel: nextIndex,
      matches,
      matchOrder,
    };

    // Vérifier si c'est le dernier match (pour déterminer le champion)
    // Mais un GFR peut encore être créé par le GF
    const isLastInOrder = nextIndex >= matchOrder.length - 1;
    if (isLastInOrder) {
      // Vérifier si GFR a été créé par la résolution du GF
      if (matches['GFR'] && matches['GFR'].statut === 'en_attente' && !matchOrder.includes('GFR')) {
        matchOrder.push('GFR');
        updateData.matchOrder = matchOrder;
        // Pas encore terminé, le GFR doit être joué
      } else {
        // Déterminer le champion
        const gfrMatch = matches['GFR'];
        const gfMatch = matches['GF'];
        let championId = gfrMatch?.winnerId || gfMatch?.winnerId;
        const championData = participantsList.find(p => p.userId === championId);
        if (championData) {
          updateData.champion = {
            userId: championData.userId,
            nom: championData.nom,
            race: championData.race,
            classe: championData.classe,
            characterImage: championData.characterImage
          };
          updateData.annonceChampion = annonceChampion(championData.nom);
        }
      }
    }

    await updateDoc(doc(db, 'tournaments', docId), updateData);

    return { success: true, termine: false, matchIndex: nextIndex };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// RÉCUPÉRER LE COMBAT LOG D'UN MATCH
// ============================================================================

export async function getCombatLog(matchId, docId = 'current') {
  try {
    const logDoc = await getDoc(doc(db, 'tournaments', docId, 'combatLogs', matchId));
    if (!logDoc.exists()) return { success: false, error: 'Combat log non trouvé' };
    return { success: true, data: logDoc.data() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// LISTENER TEMPS RÉEL
// ============================================================================

export function onTournoiUpdate(callback, docId = 'current') {
  return onSnapshot(doc(db, 'tournaments', docId), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Erreur listener tournoi:', error);
  });
}

// ============================================================================
// TERMINER LE TOURNOI (archiver personnages + hall of fame)
// ============================================================================

export async function terminerTournoi(docId = 'current') {
  try {
    // Pour les simulations, juste supprimer le document et les logs
    if (docId !== 'current') {
      const logsSnapshot = await getDocs(collection(db, 'tournaments', docId, 'combatLogs'));
      for (const logDoc of logsSnapshot.docs) {
        await deleteDoc(logDoc.ref);
      }
      await deleteDoc(doc(db, 'tournaments', docId));
      return { success: true };
    }

    const tournoiDoc = await getDoc(doc(db, 'tournaments', docId));
    if (!tournoiDoc.exists()) return { success: false, error: 'Aucun tournoi trouvé' };

    const tournoi = tournoiDoc.data();
    if (!tournoi.champion) return { success: false, error: 'Pas de champion désigné' };

    // 1. Ajouter au Hall of Fame
    await addDoc(collection(db, 'hallOfFame'), {
      champion: tournoi.champion,
      nbParticipants: tournoi.participantsList.length,
      nbMatchs: tournoi.matchOrder.length,
      date: serverTimestamp()
    });

    // 2. Donner la récompense triple roll au champion
    await setDoc(doc(db, 'tournamentRewards', tournoi.champion.userId), {
      tripleRoll: true,
      date: serverTimestamp()
    });

    // 3. Archiver tous les personnages
    const charsResult = await getAllCharacters();
    if (charsResult.success) {
      for (const char of charsResult.data) {
        // Copier vers archivedCharacters
        await addDoc(collection(db, 'archivedCharacters'), {
          ...char,
          archivedAt: serverTimestamp(),
          tournamentChampion: char.userId === tournoi.champion.userId
        });

        // Supprimer le personnage original
        await deleteDoc(doc(db, 'characters', char.id || char.userId));
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur terminaison tournoi:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// HALL OF FAME
// ============================================================================

export async function getHallOfFame() {
  try {
    const snapshot = await getDocs(query(collection(db, 'hallOfFame'), orderBy('date', 'desc')));
    const champions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, data: champions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// ANCIENS PERSONNAGES
// ============================================================================

export async function getArchivedCharacters(userId) {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'archivedCharacters'), where('userId', '==', userId))
    );
    const characters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, data: characters };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// VÉRIFIER RÉCOMPENSE TRIPLE ROLL
// ============================================================================

export async function checkTripleRoll(userId) {
  try {
    const rewardDoc = await getDoc(doc(db, 'tournamentRewards', userId));
    return rewardDoc.exists() && rewardDoc.data().tripleRoll === true;
  } catch {
    return false;
  }
}

export async function consumeTripleRoll(userId) {
  try {
    await deleteDoc(doc(db, 'tournamentRewards', userId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// SIMULATION DE TEST (aucune écriture Firestore, pas de Discord)
// ============================================================================

export async function simulerTournoiTest() {
  try {
    const participants = await chargerParticipants();
    if (participants.length < 2) {
      return { success: false, error: 'Il faut au moins 2 personnages pour simuler un tournoi' };
    }

    const participantIds = participants.map(p => p.userId || p.id);
    const { matches, matchOrder } = genererBracket(participantIds);

    const participantsMap = {};
    for (const p of participants) {
      const id = p.userId || p.id;
      participantsMap[id] = {
        userId: id,
        nom: p.name,
        race: p.race,
        classe: p.class,
        characterImage: p.characterImage || null,
        base: p.base,
        bonuses: p.bonuses,
        level: p.level ?? 1,
        equippedWeaponId: p.equippedWeaponId || null,
        equippedWeaponData: p.equippedWeaponData || null,
        mageTowerPassive: p.mageTowerPassive || null,
        forestBoosts: p.forestBoosts || null,
        name: p.name,
        class: p.class
      };
    }

    const resultatsMatchs = [];

    for (const matchId of matchOrder) {
      const match = matches[matchId];
      if (!match || match.statut === 'bye' || match.statut === 'termine') continue;

      const p1Data = participantsMap[match.p1];
      const p2Data = participantsMap[match.p2];
      if (!p1Data || !p2Data) continue;

      const result = simulerMatch(p1Data, p2Data);
      resoudreMatch(matches, matchId, result.winnerId, result.loserId);

      resultatsMatchs.push({
        matchId,
        roundLabel: match.roundLabel,
        bracket: match.bracket,
        p1Nom: p1Data.nom,
        p2Nom: p2Data.nom,
        winnerNom: result.winnerNom,
        loserNom: result.loserNom,
        nbTours: result.combatLog.filter(l => l.includes('---')).length,
        combatLog: result.combatLog,
      });

      // Si GFR créé, l'ajouter dans l'ordre
      if (matchId === 'GF' && matches['GFR'] && matches['GFR'].statut === 'en_attente') {
        matchOrder.push('GFR');
      }
    }

    // Déterminer le champion
    const gfrMatch = matches['GFR'];
    const gfMatch = matches['GF'];
    let championId = gfrMatch?.winnerId || gfMatch?.winnerId;
    const championData = participantsMap[championId];

    return {
      success: true,
      champion: championData ? { nom: championData.nom, race: championData.race, classe: championData.classe, characterImage: championData.characterImage } : null,
      nbParticipants: participants.length,
      nbMatchs: resultatsMatchs.length,
      resultatsMatchs,
    };
  } catch (error) {
    console.error('Erreur simulation test:', error);
    return { success: false, error: error.message };
  }
}
