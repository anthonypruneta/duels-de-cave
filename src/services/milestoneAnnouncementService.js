import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { envoyerAnnonceDiscord } from './discordService';

const DUNGEON_MILESTONES = {
  cave: {
    dungeonName: 'Donjon de la Cave',
    bossName: 'Vyraxion le Dévoreur'
  },
  forest: {
    dungeonName: 'Donjon de la Forêt',
    bossName: 'Kurtah le Protecteur'
  },
  mageTower: {
    dungeonName: 'Tour du Mage',
    bossName: 'Golden Thief Bug'
  }
};

const getDisplayName = (character) => {
  if (character?.ownerPseudo) return character.ownerPseudo;
  if (character?.name) return character.name;
  return 'Un héros inconnu';
};

const trySendDiscordAnnouncement = async (payload) => {
  try {
    await envoyerAnnonceDiscord(payload);
  } catch (error) {
    console.error('Erreur annonce Discord milestone:', error);
  }
};

export async function announceFirstDungeonFinalBossKill({ userId, dungeonKey, character }) {
  try {
    const dungeonInfo = DUNGEON_MILESTONES[dungeonKey];
    if (!dungeonInfo || !userId) {
      return { success: false, skipped: true, reason: 'invalid_params' };
    }

    const milestoneRef = doc(db, 'globalMilestones', `first_dungeon_${dungeonKey}`);
    let created = false;

    await runTransaction(db, async (transaction) => {
      const milestoneSnap = await transaction.get(milestoneRef);
      if (milestoneSnap.exists()) return;

      transaction.set(milestoneRef, {
        type: 'first_dungeon_final_boss_kill',
        dungeonKey,
        dungeonName: dungeonInfo.dungeonName,
        bossName: dungeonInfo.bossName,
        winnerUserId: userId,
        winnerName: getDisplayName(character),
        winnerCharacterName: character?.name || null,
        createdAt: serverTimestamp()
      });
      created = true;
    });

    if (!created) {
      return { success: true, announced: false, reason: 'already_claimed' };
    }

    await trySendDiscordAnnouncement({
      titre: `🏆 Premier kill mondial – ${dungeonInfo.dungeonName}`,
      message: `**${getDisplayName(character)}** est le premier joueur à vaincre le boss final **${dungeonInfo.bossName}** !`,
      mentionEveryone: true
    });

    return { success: true, announced: true };
  } catch (error) {
    console.error('Erreur milestone boss final donjon:', error);
    return { success: false, error: error.message };
  }
}

export async function announceFirstLabyrinthFloorClear({ userId, weekId, floorNumber, character }) {
  try {
    if (!userId || !weekId || ![80, 90, 100].includes(Number(floorNumber))) {
      return { success: false, skipped: true, reason: 'invalid_params' };
    }

    const level = Number(floorNumber);
    const milestoneRef = doc(db, 'globalMilestones', `labyrinth_${weekId}_floor_${level}`);
    let created = false;

    await runTransaction(db, async (transaction) => {
      const milestoneSnap = await transaction.get(milestoneRef);
      if (milestoneSnap.exists()) return;

      transaction.set(milestoneRef, {
        type: 'first_labyrinth_floor_clear',
        weekId,
        floorNumber: level,
        winnerUserId: userId,
        winnerName: getDisplayName(character),
        winnerCharacterName: character?.name || null,
        createdAt: serverTimestamp()
      });
      created = true;
    });

    if (!created) {
      return { success: true, announced: false, reason: 'already_claimed' };
    }

    await trySendDiscordAnnouncement({
      titre: `🌀 Premier clear Semaine ${weekId} – Étage ${level}`,
      message: `**${getDisplayName(character)}** est le premier à vaincre l'étage **${level}** du Labyrinthe infini cette semaine !`,
      mentionEveryone: true
    });

    return { success: true, announced: true };
  } catch (error) {
    console.error('Erreur milestone labyrinthe:', error);
    return { success: false, error: error.message };
  }
}
