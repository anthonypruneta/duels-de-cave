import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { envoyerAnnonceDiscord } from './discordService';
import { getAllForestLevels } from '../data/forestDungeons';
import { getAllMageTowerLevels } from '../data/mageTowerDungeons';

const FINAL_FOREST_BOSS = getAllForestLevels().at(-1)?.boss || null;
const FINAL_MAGE_TOWER_BOSS = getAllMageTowerLevels().at(-1)?.boss || null;

const DUNGEON_MILESTONES = {
  cave: {
    dungeonName: 'Donjon de la Cave',
    bossName: 'Vyraxion le Dévoreur'
  },
  forest: {
    dungeonName: 'La Forêt',
    bossName: FINAL_FOREST_BOSS?.nom || 'Boss inconnu'
  },
  mageTower: {
    dungeonName: 'Tour du Mage',
    bossName: FINAL_MAGE_TOWER_BOSS?.nom || 'Boss inconnu'
  }
};


const getDisplayName = (character) => {
  if (character?.ownerPseudo) return character.ownerPseudo;
  if (character?.name) return character.name;
  return 'Un héros inconnu';
};


const formatEnemyName = (enemyName, floorNumber) => {
  if (!enemyName || typeof enemyName !== 'string') {
    return `le boss de l'étage **${floorNumber}**`;
  }

  const cleanName = enemyName
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return `**${cleanName || `Boss étage ${floorNumber}`}**`;
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

export async function announceFirstLabyrinthFloorClear({ userId, weekId, floorNumber, character, enemyName = null }) {
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

    const zoneName = `Labyrinthe infini (Étage ${level})`;
    const bossLabel = formatEnemyName(enemyName, level);

    await trySendDiscordAnnouncement({
      titre: `🌀 Premier clear Semaine ${weekId} – ${zoneName}`,
      message: `**${getDisplayName(character)}** est le premier à vaincre ${bossLabel} dans le ${zoneName} cette semaine !`,
      mentionEveryone: true
    });

    return { success: true, announced: true };
  } catch (error) {
    console.error('Erreur milestone labyrinthe:', error);
    return { success: false, error: error.message };
  }
}
