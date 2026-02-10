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
import { genererBracket, resoudreMatch, autoResolveByes, getParticipantNom } from '../utils/tournamentBracket';
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

  // Vérifier si un participant est BYE ou manquant
  const p1IsBye = !match.p1 || match.p1 === 'BYE';
  const p2IsBye = !match.p2 || match.p2 === 'BYE';

  if (p1IsBye || p2IsBye) {
    if (p1IsBye && p2IsBye) {
      match.statut = 'bye';
      match.winnerId = 'BYE';
      match.loserId = 'BYE';
      if (match.winnerGoesTo) {
        const next = matches[match.winnerGoesTo.matchId];
        if (next) next[match.winnerGoesTo.slot] = 'BYE';
      }
      if (match.loserGoesTo) {
        const next = matches[match.loserGoesTo.matchId];
        if (next) next[match.loserGoesTo.slot] = 'BYE';
      }
    } else {
      const winnerId = p1IsBye ? match.p2 : match.p1;
      resoudreMatch(matches, matchId, winnerId, 'BYE');
      match.statut = 'bye';
    }
    autoResolveByes(matches);
    return null;
  }

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

function isMatchPlayable(match) {
  if (!match || match.statut === 'bye' || match.statut === 'termine') return false;
  if (!match.p1 || !match.p2) return false;
  if (match.p1 === 'BYE' || match.p2 === 'BYE') return false;
  return true;
}

function trouverProchainMatchJouable(matches, matchOrder, startIndex = 0) {
  for (let i = Math.max(0, startIndex); i < matchOrder.length; i++) {
    const matchId = matchOrder[i];
    if (isMatchPlayable(matches[matchId])) {
      return { index: i, matchId };
    }
  }

  // Si rien après startIndex, on repart du début pour récupérer les matchs
  // qui n'étaient pas encore prêts lors d'un passage précédent.
  for (let i = 0; i < Math.max(0, startIndex); i++) {
    const matchId = matchOrder[i];
    if (isMatchPlayable(matches[matchId])) {
      return { index: i, matchId };
    }
  }

  return null;
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

    const prochainMatch = trouverProchainMatchJouable(matches, matchOrder, 0);
    if (!prochainMatch) return { success: false, error: 'Aucun match jouable trouvé' };

    const { index: firstIndex, matchId: firstMatchId } = prochainMatch;
    const result = simulerUnMatch(matches, participants, firstMatchId);
    if (!result) return { success: false, error: 'Aucun match jouable trouvé' };

    // Stocker le combat log
    await setDoc(doc(db, 'tournaments', docId, 'combatLogs', firstMatchId), result.combatLogData);

    // Mettre à jour le tournoi
    await updateDoc(doc(db, 'tournaments', docId), {
      statut: 'en_cours',
      matches,
      matchOrder,
      matchActuel: firstIndex,
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
    let nextIndex = (tournoi.matchActuel ?? -1) + 1;

    // Vérifier si un GFR a été créé et doit être ajouté
    if (matches['GFR'] && matches['GFR'].statut === 'en_attente' && !matchOrder.includes('GFR')) {
      matchOrder.push('GFR');
    }

    const prochainMatch = trouverProchainMatchJouable(matches, matchOrder, nextIndex);
    let result = null;
    let nextMatchId = null;

    if (prochainMatch) {
      nextIndex = prochainMatch.index;
      nextMatchId = prochainMatch.matchId;
      result = simulerUnMatch(matches, participants, nextMatchId);
    }

    // Si plus de matchs jouables → tournoi terminé
    if (!result) {
      // Vérifier GFR créé entre-temps
      if (matches['GFR'] && matches['GFR'].statut === 'en_attente' && !matchOrder.includes('GFR')) {
        matchOrder.push('GFR');
        // Essayer de jouer le GFR
        nextIndex = matchOrder.length - 1;
        nextMatchId = 'GFR';
        result = simulerUnMatch(matches, participants, nextMatchId);
      }
    }

    if (!result) {
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
        matches,
        champion,
        annonceChampion: champion ? annonceChampion(champion.nom) : null,
      });
      return { success: true, termine: true, champion };
    }

    // Stocker le combat log
    await setDoc(doc(db, 'tournaments', docId, 'combatLogs', nextMatchId), result.combatLogData);

    // Préparer la mise à jour
    let updateData = {
      matchActuel: nextIndex,
      matches,
      matchOrder,
    };

    // Vérifier si c'est le dernier match jouable
    let hasMorePlayableMatches = false;
    for (let i = nextIndex + 1; i < matchOrder.length; i++) {
      const m = matches[matchOrder[i]];
      if (m && m.statut !== 'bye' && m.statut !== 'termine') {
        hasMorePlayableMatches = true;
        break;
      }
    }

    if (!hasMorePlayableMatches) {
      // Vérifier si GFR a été créé par la résolution du GF
      if (matches['GFR'] && matches['GFR'].statut === 'en_attente' && !matchOrder.includes('GFR')) {
        matchOrder.push('GFR');
        updateData.matchOrder = matchOrder;
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

    let startIndex = 0;
    while (true) {
      const prochainMatch = trouverProchainMatchJouable(matches, matchOrder, startIndex);
      if (!prochainMatch) break;

      const { index, matchId } = prochainMatch;
      const match = matches[matchId];
      const p1Data = participantsMap[match.p1];
      const p2Data = participantsMap[match.p2];
      if (!p1Data || !p2Data) {
        startIndex = index + 1;
        continue;
      }

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
      if (matchId === 'GF' && matches['GFR'] && matches['GFR'].statut === 'en_attente' && !matchOrder.includes('GFR')) {
        matchOrder.push('GFR');
      }

      startIndex = index + 1;
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
