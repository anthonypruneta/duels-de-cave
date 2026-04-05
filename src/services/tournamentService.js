/**
 * Service Firestore pour le système de tournoi
 * Les matchs sont simulés 1 par 1 en direct (pas de pré-simulation)
 */

import { db } from '../firebase/config';
import {
  doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, addDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, increment
} from 'firebase/firestore';
import { getAllCharacters } from './characterService';
import { getEquippedWeapon } from './dungeonService';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getWeaponById } from '../data/weapons';
import { genererBracket, resoudreMatch, autoResolveByes, getParticipantNom } from '../utils/tournamentBracket';
import { simulerMatch } from '../utils/tournamentCombat';
import { annonceDebutTournoi, annonceDebutMatch, annonceFinMatch, annonceChampion } from '../utils/dbzAnnouncer';
import { envoyerAnnonceDiscord } from './discordService';
import { generateWeeklyInfiniteLabyrinth, getCurrentWeekId, resetWeeklyInfiniteLabyrinthEnemyPool } from './infiniteLabyrinthService';
import { checkAndAwardTitles, trackTournamentFirstRoundResult } from './titleService';
import { MAX_LEVEL } from '../data/featureFlags';
import { supprimerMessagesChatTournoi } from './tournamentChatService';

/** Document Firestore du tournoi « des anciens » (archives récentes, niveau ≤ 400) */
export const LEGACY_TOURNAMENT_DOC_ID = 'legacy_current';
/** Fenêtre d’éligibilité : semaine -1 et semaine -2 (getCurrentWeekId), même repère que les récompenses hebdo */
const LEGACY_ARCHIVE_WEEK_WINDOW = 2;
const TOURNAMENT_META_QUALIFIER = 'legacyQualifierNextSaturday';
const LEGACY_RETIRED_COLLECTION = 'legacyRetiredArchives';

async function getLegacyRetiredArchiveIdSet() {
  try {
    const snap = await getDocs(collection(db, LEGACY_RETIRED_COLLECTION));
    return new Set(snap.docs.map((d) => d.id));
  } catch (e) {
    console.warn('getLegacyRetiredArchiveIdSet:', e?.message);
    return new Set();
  }
}

function isDiscordAnnouncableDoc(docId) {
  const id = String(docId || '');
  const isLegacy = id === LEGACY_TOURNAMENT_DOC_ID || id.startsWith('legacy_');
  return docId === 'current' || isLegacy;
}

function discordLegacyPrefix(docId) {
  const id = String(docId || '');
  const isLegacy = id === LEGACY_TOURNAMENT_DOC_ID || id.startsWith('legacy_');
  return isLegacy ? '📜 Tournoi des anciens — ' : '';
}

// ============================================================================
// ANNONCES DISCORD DU TOURNOI (fire-and-forget, ne bloque jamais le tournoi)
// ============================================================================

function annoncerTirageDiscord(matches, matchOrder, participants, nbParticipants, docId = 'current') {
  const premierTour = matchOrder
    .map(id => matches[id])
    .filter(m => m && m.bracket === 'winners' && m.round === 0 && m.p1 && m.p2 && m.p1 !== 'BYE' && m.p2 !== 'BYE')
    .map((m, i) => {
      const p1 = participants[m.p1];
      const p2 = participants[m.p2];
      return `⚔️ Match ${i + 1} : **${p1?.nom || '???'}** vs **${p2?.nom || '???'}**`;
    });

  const intro = annonceDebutTournoi(nbParticipants);
  const message = `${intro}\n\n📋 **VOICI LES PREMIERS AFFRONTEMENTS :**\n\n${premierTour.join('\n')}`;
  const pfx = discordLegacyPrefix(docId);

  return envoyerAnnonceDiscord({ titre: `${pfx}🏆 TIRAGE AU SORT DU TOURNOI`, message, mentionEveryone: true });
}

function annoncerDebutMatchDiscord(match, participants, docId = 'current') {
  const p1 = participants[match.p1];
  const p2 = participants[match.p2];
  if (!p1 || !p2) return Promise.resolve();

  const annonce = annonceDebutMatch(p1.nom, p2.nom, match.bracket, match.roundLabel);
  const isFinale = match.bracket === 'grand_final' || match.bracket === 'grand_final_reset';
  const pfx = discordLegacyPrefix(docId);

  return envoyerAnnonceDiscord({
    titre: `${pfx}${isFinale ? '⚔️ GRANDE FINALE' : `🥊 ${match.roundLabel || 'Combat'}`}`,
    message: annonce,
    mentionEveryone: isFinale
  });
}

export function annoncerFinMatchDiscord(combatLogData, docId = 'current') {
  const pfx = discordLegacyPrefix(docId);
  return envoyerAnnonceDiscord({
    titre: `${pfx}🏁 Victoire de ${combatLogData.winnerNom}`,
    message: combatLogData.annonceFin
  });
}

function annoncerChampionDiscord(champion, docId = 'current') {
  const annonce = annonceChampion(champion.nom);
  const pfx = discordLegacyPrefix(docId);
  return envoyerAnnonceDiscord({
    titre: `${pfx}👑 CHAMPION DU TOURNOI`,
    message: annonce,
    mentionEveryone: true
  });
}

async function supprimerCombatLogsTournoi(tournamentDocId) {
  const logsSnapshot = await getDocs(collection(db, 'tournaments', tournamentDocId, 'combatLogs'));
  await Promise.all(logsSnapshot.docs.map((d) => deleteDoc(d.ref)));
}

async function supprimerChatEtLogsTournoi(tournamentDocId) {
  await supprimerMessagesChatTournoi(tournamentDocId);
  await supprimerCombatLogsTournoi(tournamentDocId);
}

// ============================================================================
// CHARGER LES PERSONNAGES POUR LE TOURNOI
// ============================================================================

async function chargerParticipants() {
  const result = await getAllCharacters();
  if (!result.success) throw new Error(result.error);

  const participants = await Promise.all(
    result.data
      .filter(char => !char.archived && !char.disabled)
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

function buildParticipantEntries(participants) {
  const usedIds = new Set();

  return participants.map((p, index) => {
    const baseId = String(p.userId || p.id || `participant-${index + 1}`);
    let participantId = baseId;
    let suffix = 2;

    while (usedIds.has(participantId)) {
      participantId = `${baseId}#${suffix}`;
      suffix += 1;
    }

    usedIds.add(participantId);

    return {
      ...p,
      participantId,
      ownerUserId: p.userId || p.id || null,
    };
  });
}

function buildParticipantsMapForTournoi(participants) {
  const participantsMap = {};
  for (const p of participants) {
    participantsMap[p.participantId] = {
      userId: p.participantId,
      ownerUserId: p.ownerUserId,
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
      mageTowerExtensionPassive: p.mageTowerExtensionPassive || null,
      forestBoosts: p.forestBoosts || null,
      forgeUpgrade: p.forgeUpgrade || null,
      subclass: p.subclass || null,
      name: p.name,
      class: p.class,
      ownerPseudo: p.ownerPseudo || null,
      equippedBorder: p.equippedBorder || null,
      equippedRealBorder: p.equippedRealBorder || null,
      equippedTitle: p.equippedTitle || null,
      gender: p.gender || null,
      coopRaceEcho: p.coopRaceEcho || null,
    };
  }
  return participantsMap;
}

async function chargerParticipantsArchives(retiredIdsOverride = null) {
  const retiredIds = retiredIdsOverride ?? (await getLegacyRetiredArchiveIdSet());
  const eligibleWeekIds = getEligibleWeekIdsForLegacyArchive();
  const snapshot = await getDocs(collection(db, 'archivedCharacters'));
  /** id doc Firestore — ne jamais utiliser data().id (souvent userId), sinon tous les arch_xxx collent */
  const rows = snapshot.docs
    .map((d) => {
      const data = d.data();
      const firestoreDocId = d.id;
      return { ...data, id: firestoreDocId, _firestoreArchiveId: firestoreDocId };
    })
    .filter((char) => !retiredIds.has(char._firestoreArchiveId))
    .filter((char) => isArchivedWithinLegacyTournamentWeeks(char.archivedAt, eligibleWeekIds));
  return Promise.all(
    rows
      .filter((char) => (char.level ?? 1) <= MAX_LEVEL)
      .map(async (char) => {
        const archiveDocId = char._firestoreArchiveId;
        const level = char.level ?? 1;
        const weaponId = char.equippedWeaponId || null;
        const weaponData =
          char.equippedWeaponData || (weaponId ? getWeaponById(weaponId) : null);
        const normalized = normalizeCharacterBonuses({
          ...char,
          level,
          equippedWeaponData: weaponData,
          equippedWeaponId: weaponId,
        });
        return {
          ...normalized,
          archiveDocId,
          userId: char.userId || null,
          name: char.name,
          class: char.class,
          archivedAt: char.archivedAt ?? null,
        };
      })
  );
}

function archivedAtToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

/** Semaines éligibles pour le tournoi des anciens (fenêtre glissante en « semaines jeu »). */
function getEligibleWeekIdsForLegacyArchive(now = new Date()) {
  const ids = new Set();
  const d = new Date(now.getTime());
  // Important: on exclut volontairement la semaine courante.
  // On veut les persos archivés sur les 2 semaines précédentes (semaine -1 et semaine -2).
  d.setDate(d.getDate() - 7);
  for (let i = 0; i < LEGACY_ARCHIVE_WEEK_WINDOW; i++) {
    ids.add(getCurrentWeekId(d));
    d.setDate(d.getDate() - 7);
  }
  return ids;
}

function isArchivedWithinLegacyTournamentWeeks(archivedAt, eligibleWeekIds) {
  const ms = archivedAtToMillis(archivedAt);
  if (ms <= 0) return false;
  return eligibleWeekIds.has(getCurrentWeekId(new Date(ms)));
}

/**
 * Même joueur + même nom de perso : une seule entrée (archive la plus récente).
 * Plusieurs persos différents par compte restent tous inscrits.
 */
function dedupeLegacyParticipantsByOwnerAndName(rows, tournamentDocId) {
  const norm = (n) => String(n || '').trim().toLowerCase();
  const best = new Map();
  for (const p of rows) {
    if (!p.userId || !p.archiveDocId) continue;
    const key = `${p.userId}|${norm(p.name)}|${tournamentDocId}`;
    const cur = best.get(key);
    const ms = archivedAtToMillis(p.archivedAt);
    if (
      !cur ||
      ms > archivedAtToMillis(cur.archivedAt) ||
      (ms === archivedAtToMillis(cur.archivedAt) && String(p.archiveDocId) > String(cur.archiveDocId))
    ) {
      best.set(key, p);
    }
  }
  return Array.from(best.values());
}

/**
 * Tournoi secondaire : persos archivés (niveau ≤ 400, archivés sur semaine -1 et semaine -2).
 * Le gagnant est enregistré pour le prochain tournoi du samedi (voir creerTournoi current).
 * @param {{ announceDiscord?: boolean }} [options] — si `announceDiscord === false`, pas d’annonce Discord du tirage (tournoi Firestore inchangé).
 */
export async function creerTournoiLegacy(options = {}) {
  const { announceDiscord = true } = options;
  try {
    // Ne jamais écraser un tournoi legacy déjà existant.
    // On crée un nouveau document à chaque événement.
    const tournamentDocId = `legacy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const retiredIds = await getLegacyRetiredArchiveIdSet();
    const retiredCount = retiredIds.size;
    const raw = await chargerParticipantsArchives(retiredIds);
    const rawEligible = raw.filter((p) => p.userId && p.archiveDocId);
    const deduped = dedupeLegacyParticipantsByOwnerAndName(rawEligible, tournamentDocId);
    const dedupeDropped = rawEligible.length - deduped.length;
    const participants = deduped.map((p) => ({
      ...p,
      participantId: `arch_${p.archiveDocId}`,
      ownerUserId: p.userId,
    }));
    if (participants.length < 2) {
      return {
        success: false,
        error:
          `Il faut au moins 2 personnages archivés éligibles (niveau ≤ 400, archivés sur la semaine dernière et celle d’avant, retraités exclus). Éligibles : ${participants.length}. À la retraite : ${retiredCount}.`,
      };
    }

    const participantIds = participants.map((p) => p.participantId);
    const { matches, matchOrder } = genererBracket(participantIds);
    const participantsMap = buildParticipantsMapForTournoi(participants);

    const tournoi = {
      statut: 'preparation',
      tournamentType: 'legacy_archives',
      createdAt: serverTimestamp(),
      participants: participantsMap,
      participantsList: participants.map((p) => ({
        userId: p.ownerUserId,
        participantId: p.participantId,
        archiveFirestoreId: p.archiveDocId,
        nom: p.name,
        race: p.race,
        classe: p.class,
        characterImage: p.characterImage || null,
        ownerPseudo: p.ownerPseudo || null,
        equippedBorder: p.equippedBorder || null,
        equippedRealBorder: p.equippedRealBorder || null,
      })),
      matches,
      matchOrder,
      matchActuel: -1,
      champion: null,
      annonceIntro: annonceDebutTournoi(participants.length),
    };

    await setDoc(doc(db, 'tournaments', tournamentDocId), tournoi);
    if (announceDiscord) {
      annoncerTirageDiscord(
        matches,
        matchOrder,
        participantsMap,
        participants.length,
        tournamentDocId
      ).catch(() => {});
    }

    return {
      success: true,
      nbParticipants: participants.length,
      retiredExclusionsCount: retiredCount,
      dedupeDroppedCount: dedupeDropped,
      tournamentDocId,
      discordAnnounceSkipped: !announceDiscord,
    };
  } catch (error) {
    console.error('Erreur création tournoi legacy:', error);
    return { success: false, error: error.message };
  }
}

/** Nettoie le doc tournoi legacy (après fin d’événement). N’archive pas les persos. */
export async function nettoyerTournoiLegacy() {
  return supprimerTournoiTermine(LEGACY_TOURNAMENT_DOC_ID);
}

export async function getLegacyQualifierSnapshot() {
  try {
    const snap = await getDoc(doc(db, 'tournamentMeta', TOURNAMENT_META_QUALIFIER));
    if (!snap.exists()) return { success: true, data: null };
    return { success: true, data: { id: snap.id, ...snap.data() } };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================================
// CRÉER UN TOURNOI
// ============================================================================

export async function creerTournoi(docId = 'current') {
  try {
    // Ne jamais écraser un tournoi du samedi non archivé.
    // Si le tournoi précédent existe et n'a pas été "terminé/archivé" (archivedAt absent),
    // on bloque la création du suivant pour ne pas perdre les infos d'arbre.
    if (docId === 'current') {
      const existingSnap = await getDoc(doc(db, 'tournaments', docId));
      if (existingSnap.exists()) {
        const existing = existingSnap.data() || {};
        const isArchived = Boolean(existing.archivedAt);
        if (!isArchived) {
          return {
            success: false,
            error: 'Un tournoi du samedi existe déjà mais n’est pas archivé. Termine/archiver le tournoi précédent avant d’en créer un nouveau.',
          };
        }
      }
    }

    if (docId === LEGACY_TOURNAMENT_DOC_ID) {
      return {
        success: false,
        error: 'Utilisez creerTournoiLegacy() pour le tournoi des anciens.',
      };
    }
    const rawParticipants = await chargerParticipants();
    let participants = buildParticipantEntries(rawParticipants);

    const qualifierRef = doc(db, 'tournamentMeta', TOURNAMENT_META_QUALIFIER);
    let qualifierConsumed = false;
    // Inclure le qualifié legacy dans le tournoi du samedi ET dans la simulation
    if (docId === 'current' || docId === 'simulation') {
      const qualSnap = await getDoc(qualifierRef);
      if (qualSnap.exists()) {
        const q = qualSnap.data();
        const legPid = `leg_${q.archiveFirestoreId}`;
        const cs = q.combatSnapshot || {};
        const merged = normalizeCharacterBonuses({
          ...cs,
          level: cs.level ?? 1,
          equippedWeaponData: cs.equippedWeaponData || null,
          equippedWeaponId: cs.equippedWeaponId || null,
        });
        participants.push({
          ...merged,
          participantId: legPid,
          ownerUserId: q.ownerUserId,
          name: merged.name || q.display?.nom || cs.nom,
          class: merged.class || q.display?.classe,
          race: merged.race || q.display?.race,
          characterImage: merged.characterImage ?? q.display?.characterImage ?? null,
          ownerPseudo: merged.ownerPseudo ?? q.display?.ownerPseudo ?? null,
        });
        // Ne consommer le qualifié que pour le tournoi réel, pas la simulation
        if (docId === 'current') {
          qualifierConsumed = true;
        }
      }
    }

    if (participants.length < 2) {
      return { success: false, error: 'Il faut au moins 2 personnages pour créer un tournoi' };
    }

    const participantIds = participants.map((p) => p.participantId);
    const { matches, matchOrder } = genererBracket(participantIds);
    const participantsMap = buildParticipantsMapForTournoi(participants);

    const listRows = participants.map((p) => {
      const row = {
        userId: p.ownerUserId,
        participantId: p.participantId,
        nom: p.name,
        race: p.race,
        classe: p.class,
        characterImage: p.characterImage || null,
        ownerPseudo: p.ownerPseudo || null,
        equippedBorder: p.equippedBorder || null,
        equippedRealBorder: p.equippedRealBorder || null,
      };
      if (p.archiveDocId) row.archiveFirestoreId = p.archiveDocId;
      return row;
    });

    const tournoi = {
      statut: 'preparation',
      createdAt: serverTimestamp(),
      participants: participantsMap,
      participantsList: listRows,
      matches,
      matchOrder,
      matchActuel: -1,
      champion: null,
      annonceIntro: annonceDebutTournoi(participants.length),
    };

    await setDoc(doc(db, 'tournaments', docId), tournoi);

    if (qualifierConsumed) {
      await deleteDoc(qualifierRef).catch(() => {});
    }

    if (isDiscordAnnouncableDoc(docId)) {
      annoncerTirageDiscord(matches, matchOrder, participantsMap, participants.length, docId).catch(
        () => {}
      );
    }

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
  const winnerId = result.winnerSlot === 1 ? match.p1 : match.p2;
  const loserId = result.winnerSlot === 1 ? match.p2 : match.p1;
  resoudreMatch(matches, matchId, winnerId, loserId);

  const annonceDebut = annonceDebutMatch(p1Data.nom, p2Data.nom, match.bracket, match.roundLabel);
  const annonceFin = annonceFinMatch(result.winnerNom, result.loserNom);

  return {
    combatLogData: stripUndefinedDeep({
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
    }),
    winnerId,
    loserId,
    matchBracket: match.bracket,
    matchRound: match.round,
    p1Data,
    p2Data,
    result,
  };
}

/**
 * Gère le tracking des titres après un match de tournoi (fire-and-forget).
 * - Détecte les titres basés sur le combat (grosse_cave, miracle, etc.)
 * - Track les défaites au 1er tour pour le titre "maudit"
 * - Track les victoires en tournoi pour le titre "legendaire" (via terminerTournoi)
 */
function trackTournamentTitles(matchResult, participants, docId) {
  if (docId !== 'current' || !matchResult) return;

  const { winnerId, loserId, matchBracket, matchRound, p1Data, p2Data, result } = matchResult;

  const winnerData = participants[winnerId];
  const loserData = participants[loserId];

  const isFirstRoundWinners = matchBracket === 'winners' && matchRound === 0;

  const winnerIsP1 = winnerId === p1Data?.userId;

  if (winnerData?.ownerUserId && result?.steps) {
    checkAndAwardTitles(winnerData.ownerUserId, result.steps, result, winnerData, {
      mode: 'tournoi',
      playerIsP1: winnerIsP1,
    }).catch(() => {});
  }
  if (loserData?.ownerUserId && result?.steps) {
    checkAndAwardTitles(loserData.ownerUserId, result.steps, result, loserData, {
      mode: 'tournoi',
      playerIsP1: !winnerIsP1,
    }).catch(() => {});
  }

  // Track 1er tour : le perdant incrémente ses défaites consécutives,
  // les participants qui passent le 1er tour remettent le compteur à 0
  if (isFirstRoundWinners) {
    if (loserData?.ownerUserId) {
      trackTournamentFirstRoundResult(loserData.ownerUserId, true).catch(() => {});
    }
    if (winnerData?.ownerUserId) {
      trackTournamentFirstRoundResult(winnerData.ownerUserId, false).catch(() => {});
    }
  }
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

    const { matches, matchOrder } = tournoi;

    const skipParticipantRefresh =
      docId === LEGACY_TOURNAMENT_DOC_ID || tournoi.tournamentType === 'legacy_archives';

    let participants = { ...tournoi.participants };
    if (!skipParticipantRefresh) {
      const freshParticipants = await chargerParticipants();
      const freshParticipantsById = new Map(
        freshParticipants.map((p) => [String(p.userId || p.id), p])
      );
      for (const [id, participantData] of Object.entries(participants)) {
        if (String(id).startsWith('leg_')) continue;
        const sourceId = String(participantData.ownerUserId || id);
        const p = freshParticipantsById.get(sourceId);
        if (!p) continue;

        participants[id] = {
          ...participantData,
          base: p.base,
          bonuses: p.bonuses,
          level: p.level ?? 1,
          equippedWeaponId: p.equippedWeaponId || null,
          equippedWeaponData: p.equippedWeaponData || null,
          mageTowerPassive: p.mageTowerPassive || null,
          mageTowerExtensionPassive: p.mageTowerExtensionPassive || null,
          forestBoosts: p.forestBoosts || null,
          forgeUpgrade: p.forgeUpgrade || null,
          subclass: p.subclass || null,
          equippedBorder: p.equippedBorder || null,
          equippedRealBorder: p.equippedRealBorder || null,
          equippedTitle: p.equippedTitle || null,
          gender: p.gender || null,
          coopRaceEcho: p.coopRaceEcho ?? null,
        };
      }
    }

    const prochainMatch = trouverProchainMatchJouable(matches, matchOrder, 0);
    if (!prochainMatch) return { success: false, error: 'Aucun match jouable trouvé' };

    const { index: firstIndex, matchId: firstMatchId } = prochainMatch;
    const result = simulerUnMatch(matches, participants, firstMatchId);
    if (!result) return { success: false, error: 'Aucun match jouable trouvé' };

    // Stocker le combat log
    await setDoc(doc(db, 'tournaments', docId, 'combatLogs', firstMatchId), result.combatLogData);

    // Tracking des titres de tournoi (fire-and-forget)
    trackTournamentTitles(result, participants, docId);

    if (isDiscordAnnouncableDoc(docId)) {
      annoncerDebutMatchDiscord(matches[firstMatchId], participants, docId).catch(() => {});
    }

    // Mettre à jour le tournoi avec les participants rafraîchis
    await updateDoc(doc(db, 'tournaments', docId), {
      statut: 'en_cours',
      matches,
      matchOrder,
      matchActuel: firstIndex,
      participants,
    });

    if (docId === 'current') {
      await generateWeeklyInfiniteLabyrinth(getCurrentWeekId());
    }

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
      const championData = participantsList.find(
        p => p.participantId === championId || p.userId === championId
      );
      const championSnap = championId ? participants[championId] : null;
      const champion = championData ? {
        userId: championData.userId || championData.participantId,
        nom: championData.nom,
        race: championData.race,
        classe: championData.classe,
        characterImage: championData.characterImage,
        ownerPseudo: championData.ownerPseudo || null,
        equippedBorder: championSnap?.equippedBorder ?? championData.equippedBorder ?? null,
        equippedRealBorder: championSnap?.equippedRealBorder ?? championData.equippedRealBorder ?? null,
      } : null;

      await updateDoc(doc(db, 'tournaments', docId), {
        statut: 'termine',
        matchActuel: nextIndex,
        matchOrder,
        matches,
        champion,
        annonceChampion: champion ? annonceChampion(champion.nom) : null,
      });

      if (tournoi?.tournamentType === 'legacy_archives' && champion && championId) {
        const row = participantsList.find(
          (p) => p.participantId === championId || p.userId === championId
        );
        const archId = row?.archiveFirestoreId;
        const combatSnap = participants[championId];
        if (archId && combatSnap && row?.userId) {
          await setDoc(doc(db, 'tournamentMeta', TOURNAMENT_META_QUALIFIER), {
            archiveFirestoreId: archId,
            ownerUserId: row.userId,
            combatSnapshot: stripUndefinedDeep({ ...combatSnap }),
            display: stripUndefinedDeep({
              nom: champion.nom,
              race: champion.race,
              classe: champion.classe,
              characterImage: champion.characterImage || null,
              ownerPseudo: champion.ownerPseudo || null,
            }),
            qualifiedAt: serverTimestamp(),
          });
          await setDoc(doc(db, LEGACY_RETIRED_COLLECTION, archId), {
            retiredAt: serverTimestamp(),
            nom: champion.nom,
            ownerUserId: row.userId,
            source: 'tournoi_legacy',
          });
        }
      }

      if (isDiscordAnnouncableDoc(docId) && champion) {
        annoncerChampionDiscord(champion, docId).catch(() => {});
      }

      if (docId === 'current') {
        resetWeeklyInfiniteLabyrinthEnemyPool().catch(() => {});
      }

      return { success: true, termine: true, champion };
    }

    // Stocker le combat log
    await setDoc(doc(db, 'tournaments', docId, 'combatLogs', nextMatchId), result.combatLogData);

    // Tracking des titres de tournoi (fire-and-forget)
    trackTournamentTitles(result, participants, docId);

    if (isDiscordAnnouncableDoc(docId)) {
      annoncerDebutMatchDiscord(matches[nextMatchId], participants, docId).catch(() => {});
    }

    // Préparer la mise à jour
    let updateData = {
      matchActuel: nextIndex,
      matches,
      matchOrder,
    };

    // Vérifier si d'autres matchs réellement jouables existent
    const hasMorePlayableMatches = Boolean(
      trouverProchainMatchJouable(matches, matchOrder, nextIndex + 1)
    );

    if (!hasMorePlayableMatches) {
      // Vérifier si GFR a été créé par la résolution du GF
      if (matches['GFR'] && matches['GFR'].statut === 'en_attente' && !matchOrder.includes('GFR')) {
        matchOrder.push('GFR');
        updateData.matchOrder = matchOrder;
      }
      // Ne PAS terminer le tournoi ici — on sauvegarde d'abord le match joué
      // pour que l'animation côté client puisse se faire. Le tournoi sera
      // terminé au prochain appel d'avancerMatch() (quand result sera null).
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

/** Valeurs undefined interdites dans Firestore (préserve Timestamp, etc.) */
function stripUndefinedDeep(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'object') return value;
  if (typeof value.toMillis === 'function' && typeof value.seconds === 'number') return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefinedDeep(v)).filter((v) => v !== undefined);
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    const next = stripUndefinedDeep(v);
    if (next !== undefined) out[k] = next;
  }
  return out;
}

/**
 * Copie l’état final du tournoi + tous les combatLogs vers tournamentArchives/{hallOfFameEntryId}
 */
export async function archiverTournoiComplet(sourceDocId, hallOfFameEntryId, tournoiData) {
  try {
    const archiveRef = doc(db, 'tournamentArchives', hallOfFameEntryId);
    await setDoc(archiveRef, {
      statut: 'termine',
      hallOfFameEntryId,
      sourceTournamentId: sourceDocId,
      matches: stripUndefinedDeep(tournoiData.matches || {}),
      matchOrder: tournoiData.matchOrder || [],
      participants: stripUndefinedDeep(tournoiData.participants || {}),
      participantsList: stripUndefinedDeep(tournoiData.participantsList || []),
      champion: stripUndefinedDeep(tournoiData.champion),
      matchActuel: tournoiData.matchActuel,
      createdAt: tournoiData.createdAt || null,
      annonceIntro: tournoiData.annonceIntro ?? null,
      archivedSnapshotAt: serverTimestamp(),
    }, { merge: true });

    const logsSnap = await getDocs(collection(db, 'tournaments', sourceDocId, 'combatLogs'));
    for (const logDoc of logsSnap.docs) {
      const data = stripUndefinedDeep(logDoc.data());
      await setDoc(
        doc(db, 'tournamentArchives', hallOfFameEntryId, 'combatLogs', logDoc.id),
        data
      );
    }
    return { success: true };
  } catch (error) {
    console.error('Erreur archivage tournoi complet:', error);
    return { success: false, error: error.message };
  }
}

export async function getTournamentArchive(archiveId) {
  try {
    const snap = await getDoc(doc(db, 'tournamentArchives', archiveId));
    if (!snap.exists()) return { success: false, error: 'Archive introuvable' };
    return { success: true, data: snap.data() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getCombatLogArchive(matchId, archiveId) {
  try {
    const logDoc = await getDoc(doc(db, 'tournamentArchives', archiveId, 'combatLogs', matchId));
    if (!logDoc.exists()) return { success: false, error: 'Combat log non trouvé' };
    return { success: true, data: logDoc.data() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// NETTOYAGE TOURNOI TERMINÉ
// ============================================================================

export async function supprimerTournoiTermine(docId = 'current') {
  try {
    // Sécurité : ne pas supprimer un tournoi du samedi tant qu'il n'est pas archivé,
    // pour éviter de perdre l'arbre avant que l'admin ait pu archiver.
    if (docId === 'current') {
      const tournoiSnap = await getDoc(doc(db, 'tournaments', docId));
      if (tournoiSnap.exists()) {
        const tournoi = tournoiSnap.data() || {};
        if (!tournoi.archivedAt) {
          return { success: false, error: 'Tournoi du samedi non archivé: suppression bloquée.' };
        }
      }
    }

    await supprimerChatEtLogsTournoi(docId);
    await deleteDoc(doc(db, 'tournaments', docId));
    return { success: true };
  } catch (error) {
    console.error('Erreur nettoyage tournoi:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// LISTENER TEMPS RÉEL
// ============================================================================

export function onTournoiUpdate(callback, docIdOrOnError = 'current', maybeOnError = null) {
  const requestedDocId = typeof docIdOrOnError === 'string' ? docIdOrOnError.trim() : '';
  const docId = requestedDocId || 'current';
  const onError = typeof docIdOrOnError === 'function'
    ? docIdOrOnError
    : maybeOnError;

  let tournoiRef;
  try {
    tournoiRef = doc(db, 'tournaments', docId);
  } catch (error) {
    console.error('Erreur création référence listener tournoi:', { docId, requestedDocId, error });
    callback(null);
    if (typeof onError === 'function') onError(error);
    return () => {};
  }

  return onSnapshot(tournoiRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Erreur listener tournoi:', { docId, error });
    callback(null);
    if (typeof onError === 'function') {
      onError(error);
    }
  });
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') {
    return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1e6);
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function sanitizeDocIdPart(value, fallback = 'inconnu') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function buildHallOfFameEntryId(tournoi) {
  const championId = sanitizeDocIdPart(tournoi?.champion?.userId || tournoi?.champion?.nom, 'champion');
  const createdAtMs = toMillis(tournoi?.createdAt);
  if (createdAtMs !== null) {
    return `hof_${createdAtMs}_${championId}`;
  }

  // Fallback legacy déterministe si createdAt est absent.
  const participantsSeed = (tournoi?.participantsList || [])
    .map((p) => p?.userId || p?.participantId || p?.nom || '')
    .sort()
    .join('|');
  const fallbackSeed = `${championId}|${tournoi?.matchOrder?.length || 0}|${tournoi?.participantsList?.length || 0}|${participantsSeed}`;
  let hash = 0;
  for (let i = 0; i < fallbackSeed.length; i += 1) {
    hash = ((hash << 5) - hash + fallbackSeed.charCodeAt(i)) >>> 0;
  }
  return `hof_legacy_${championId}_${hash.toString(36)}`;
}

// ============================================================================
// TERMINER LE TOURNOI (archiver personnages + hall of fame)
// ============================================================================

export async function terminerTournoi(docId = 'current') {
  try {
    // Pour les simulations / legacy : supprimer chat, logs et document tournoi
    if (docId !== 'current') {
      await supprimerChatEtLogsTournoi(docId);
      await deleteDoc(doc(db, 'tournaments', docId));
      return { success: true };
    }

    const tournoiDoc = await getDoc(doc(db, 'tournaments', docId));
    if (!tournoiDoc.exists()) return { success: false, error: 'Aucun tournoi trouvé' };

    const tournoi = tournoiDoc.data();
    if (!tournoi.champion) return { success: false, error: 'Pas de champion désigné' };
    if (tournoi.archivedAt) return { success: true, alreadyArchived: true };

    const hallOfFameEntryId = buildHallOfFameEntryId(tournoi);

    const archResult = await archiverTournoiComplet(docId, hallOfFameEntryId, tournoi);
    if (!archResult.success) {
      return { success: false, error: archResult.error || 'Échec archivage arbre / combats' };
    }

    // 1. Ajouter au Hall of Fame
    await setDoc(doc(db, 'hallOfFame', hallOfFameEntryId), {
      champion: tournoi.champion,
      nbParticipants: tournoi.participantsList.length,
      nbMatchs: tournoi.matchOrder.length,
      sourceTournamentId: docId,
      sourceTournamentType: tournoi.tournamentType || null,
      sourceTournamentCreatedAt: tournoi.createdAt || null,
      tournamentArchiveId: hallOfFameEntryId,
      date: serverTimestamp()
    }, { merge: true });

    // 2. Donner la récompense triple roll au champion
    await setDoc(doc(db, 'tournamentRewards', tournoi.champion.userId), {
      tripleRoll: true,
      tournamentWins: increment(1),
      lastTournamentDate: serverTimestamp(),
      lastTournamentWeekId: getCurrentWeekId(),
      source: 'tournoi'
    }, { merge: true });

    // 3. Archiver uniquement les personnages actifs (non disabled)
    const charsResult = await getAllCharacters();
    if (charsResult.success) {
      const activeCharacters = charsResult.data.filter(char => !char.disabled && !char.archived);

      for (const char of activeCharacters) {
        const ownerUserId = char.userId || char.id;
        if (!ownerUserId) continue;

        // Copier vers archivedCharacters (en forçant userId pour garantir la visibilité côté "anciens personnages")
        await addDoc(collection(db, 'archivedCharacters'), {
          ...char,
          userId: ownerUserId,
          archivedAt: serverTimestamp(),
          tournamentChampion: ownerUserId === tournoi.champion.userId
        });

        // Supprimer le personnage original actif
        await deleteDoc(doc(db, 'characters', ownerUserId)).catch(() => {});
        if (char.id && char.id !== ownerUserId) {
          await deleteDoc(doc(db, 'characters', char.id)).catch(() => {});
        }
      }

      // 4. Reset les essais de donjon pour les joueurs archivés
      for (const char of activeCharacters) {
        const ownerUserId = char.userId || char.id;
        if (!ownerUserId) continue;
        const progressRef = doc(db, 'dungeonProgress', ownerUserId);
        await deleteDoc(progressRef).catch(() => {});
      }
    }

    await updateDoc(doc(db, 'tournaments', docId), {
      archivedAt: serverTimestamp(),
      hallOfFameEntryId,
    });

    await supprimerMessagesChatTournoi(docId);

    await generateWeeklyInfiniteLabyrinth(getCurrentWeekId());

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
// CLASSEMENT DU JOUEUR DANS LE TOURNOI ACTUEL / TERMINÉ
// ============================================================================

export async function getPlayerTournamentRank(userId) {
  try {
    const tournoiDoc = await getDoc(doc(db, 'tournaments', 'current'));
    if (!tournoiDoc.exists()) return { success: true, data: null };

    const tournoi = tournoiDoc.data();
    const { matches, matchOrder, participantsList, champion, statut } = tournoi;
    if (!matches || !matchOrder || !participantsList) return { success: true, data: null };

    const participant = participantsList.find(p => p.userId === userId);
    if (!participant) return { success: true, data: null };

    const pid = participant.participantId || participant.userId;
    const nbParticipants = participantsList.length;

    if (champion && (champion.userId === userId)) {
      return { success: true, data: { rank: 1, total: nbParticipants, statut } };
    }

    const eliminatedPlayers = [];
    for (const matchId of matchOrder) {
      const match = matches[matchId];
      if (!match || match.statut !== 'termine') continue;
      const loserId = match.loserId;
      if (!loserId || loserId === 'BYE') continue;

      const isLosersElimination = match.bracket === 'losers';
      const isGrandFinalLoss = match.bracket === 'grand_final' || match.bracket === 'grand_final_reset';

      if (isLosersElimination || isGrandFinalLoss) {
        if (!eliminatedPlayers.includes(loserId)) {
          eliminatedPlayers.push(loserId);
        }
      }
    }

    const playerIdx = eliminatedPlayers.indexOf(pid);
    if (playerIdx === -1) {
      if (statut === 'termine' || statut === 'preparation') {
        return { success: true, data: null };
      }
      return { success: true, data: { rank: null, total: nbParticipants, statut, inProgress: true } };
    }

    const rank = nbParticipants - playerIdx;
    return { success: true, data: { rank, total: nbParticipants, statut } };
  } catch (error) {
    console.error('Erreur récupération classement tournoi:', error);
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
    const characters = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    return { success: true, data: characters };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getAllArchivedCharacters() {
  try {
    const snapshot = await getDocs(collection(db, 'archivedCharacters'));
    const characters = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
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
    if (!rewardDoc.exists()) return false;
    
    const data = rewardDoc.data();
    if (data.tripleRoll !== true) return false;

    // IMPORTANT: les rerolls ne sont valables que pour la SEMAINE en cours
    // (cataclysme + tournoi du samedi de la semaine), pas indéfiniment.
    const currentWeekId = getCurrentWeekId();
    const toDateSafe = (ts) => {
      if (!ts) return null;
      if (typeof ts.toDate === 'function') return ts.toDate();
      if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
      if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
      const parsed = new Date(ts);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const tournamentWeekId =
      data.lastTournamentWeekId ||
      (toDateSafe(data.lastTournamentDate) ? getCurrentWeekId(toDateSafe(data.lastTournamentDate)) : null);
    const cataclysmeWeekId =
      data.lastCataclysmeWeekId ||
      (toDateSafe(data.lastCataclysmeDate) ? getCurrentWeekId(toDateSafe(data.lastCataclysmeDate)) : null) ||
      (toDateSafe(data.date) ? getCurrentWeekId(toDateSafe(data.date)) : null); // legacy checkAutoEnd

    return tournamentWeekId === currentWeekId || cataclysmeWeekId === currentWeekId;
  } catch {
    return false;
  }
}

export async function getTripleRollCount(userId) {
  try {
    const rewardDoc = await getDoc(doc(db, 'tournamentRewards', userId));
    if (!rewardDoc.exists()) return 0;
    
    const data = rewardDoc.data();
    if (data.tripleRoll !== true) return 0;

    const currentWeekId = getCurrentWeekId();
    const toDateSafe = (ts) => {
      if (!ts) return null;
      if (typeof ts.toDate === 'function') return ts.toDate();
      if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
      if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
      const parsed = new Date(ts);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const tournamentWeekId =
      data.lastTournamentWeekId ||
      (toDateSafe(data.lastTournamentDate) ? getCurrentWeekId(toDateSafe(data.lastTournamentDate)) : null);
    const cataclysmeWeekId =
      data.lastCataclysmeWeekId ||
      (toDateSafe(data.lastCataclysmeDate) ? getCurrentWeekId(toDateSafe(data.lastCataclysmeDate)) : null) ||
      (toDateSafe(data.date) ? getCurrentWeekId(toDateSafe(data.date)) : null);

    const hasTournamentThisWeek = tournamentWeekId === currentWeekId;
    const hasCataclysmeThisWeek = cataclysmeWeekId === currentWeekId;
    if (!hasTournamentThisWeek && !hasCataclysmeThisWeek) return 0;
    
    // Comptage strict "semaine en cours" (stack possible: 3 + 3 = 6).
    let totalRerolls = 0;
    if (hasTournamentThisWeek) totalRerolls += 3;
    if (hasCataclysmeThisWeek) totalRerolls += 3;
    return totalRerolls;
  } catch {
    return 0;
  }
}

export async function consumeTripleRoll(userId) {
  try {
    // Ne jamais supprimer le document complet: il contient aussi des compteurs
    // persistants d'achievements (ex: labyrinthFloor90Wins).
    await setDoc(doc(db, 'tournamentRewards', userId), {
      tripleRoll: false,
      updatedAt: serverTimestamp()
    }, { merge: true });
    await generateWeeklyInfiniteLabyrinth(getCurrentWeekId());

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Réinitialise tous les gains de reroll (Tournoi + Cataclysme) pour tous les joueurs.
 * IMPORTANT: conserve les stats persistantes (wins, compteurs achievements, etc.).
 */
export async function resetAllRerollGains() {
  try {
    const snapshot = await getDocs(collection(db, 'tournamentRewards'));
    const updates = snapshot.docs.map((d) => setDoc(doc(db, 'tournamentRewards', d.id), {
      tripleRoll: false,
      // Reset "semaine en cours" : sinon un ancien gain (tournoi/cataclysme) peut rester compté
      // comme actif pour la semaine et re-stack après une redistribution.
      lastTournamentWeekId: null,
      lastCataclysmeWeekId: null,
      // Fallback legacy (certaines vues déduisent via dates)
      lastTournamentDate: null,
      lastCataclysmeDate: null,
      date: null,
      updatedAt: serverTimestamp()
    }, { merge: true }));
    await Promise.all(updates);
    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('Erreur reset rerolls:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// SIMULATION DE TEST (aucune écriture Firestore, pas de Discord)
// ============================================================================

export async function simulerTournoiTest() {
  try {
    const participants = buildParticipantEntries(await chargerParticipants());
    if (participants.length < 2) {
      return { success: false, error: 'Il faut au moins 2 personnages pour simuler un tournoi' };
    }

    const participantIds = participants.map(p => p.participantId);
    const { matches, matchOrder } = genererBracket(participantIds);

    const participantsMap = {};
    for (const p of participants) {
      participantsMap[p.participantId] = {
        userId: p.participantId,
        ownerUserId: p.ownerUserId,
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
        mageTowerExtensionPassive: p.mageTowerExtensionPassive || null,
        forestBoosts: p.forestBoosts || null,
        forgeUpgrade: p.forgeUpgrade || null,
        subclass: p.subclass || null,
        name: p.name,
        class: p.class,
        ownerPseudo: p.ownerPseudo || null,
        equippedBorder: p.equippedBorder || null,
        equippedRealBorder: p.equippedRealBorder || null,
        equippedTitle: p.equippedTitle || null,
        gender: p.gender || null,
        coopRaceEcho: p.coopRaceEcho || null,
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
      const wId = result.winnerSlot === 1 ? match.p1 : match.p2;
      const lId = result.winnerSlot === 1 ? match.p2 : match.p1;
      resoudreMatch(matches, matchId, wId, lId);

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
      champion: championData || null,
      nbParticipants: participants.length,
      nbMatchs: resultatsMatchs.length,
      resultatsMatchs,
    };
  } catch (error) {
    console.error('Erreur simulation test:', error);
    return { success: false, error: error.message };
  }
}
