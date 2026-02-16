/**
 * Combat World Boss (Cataclysme) - Duels de Cave
 *
 * Réutilise le moteur de combat tournoi (simulerMatch) avec modifications :
 * - 10 tours max, EXTINCTION au tour 10 = mort instantanée du joueur
 * - Le boss est immunisé au stun
 * - On calcule les dégâts totaux infligés au boss
 */

import { preparerCombattant, simulerMatch } from './tournamentCombat.js';
import { WORLD_BOSS, WORLD_BOSS_CONSTANTS } from '../data/worldBoss.js';

/**
 * Crée le combattant World Boss pour simulerMatch
 */
export function createWorldBossCombatant() {
  const stats = WORLD_BOSS.baseStats;
  return {
    name: WORLD_BOSS.nom,
    race: 'Boss',
    class: 'Boss',
    level: 1,
    userId: 'world-boss',
    characterImage: null,
    isWorldBoss: true,
    equippedWeaponId: null,
    equippedWeaponData: null,
    mageTowerPassive: null,
    forestBoosts: {},
    additionalAwakeningRaces: [],
    base: { ...stats },
    bonuses: {
      race: { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 },
      class: { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 }
    }
  };
}

/**
 * Simule un combat contre le World Boss
 *
 * @param {Object} playerChar - Le personnage du joueur (données Firestore brutes)
 * @param {number} bossCurrentHP - HP restant du boss global
 * @returns {{ steps, combatLog, damageDealt, playerDied, bossHPAfter, p1MaxHP, bossMaxHP }}
 */
export function simulerWorldBossCombat(playerChar, bossCurrentHP) {
  const bossChar = createWorldBossCombatant();
  // Le boss utilise ses HP restants globaux (plafonné à son max)
  const bossHP = Math.min(bossCurrentHP, WORLD_BOSS.baseStats.hp);
  bossChar.base.hp = bossHP;

  // Lancer le combat via le moteur standard
  const result = simulerMatch(playerChar, bossChar);

  // Analyser les steps pour trouver le tour 10 et appliquer EXTINCTION
  const maxTurn = WORLD_BOSS_CONSTANTS.MAX_TURNS;
  const processedSteps = [];
  let bossHPAtEnd = bossHP;
  let playerHPAtEnd = 0;
  let lastBossHP = bossHP; // p2HP dans les steps
  let lastPlayerHP = 0;
  let reachedExtinction = false;
  let currentTurn = 0;

  for (const step of result.steps) {
    if (step.phase === 'turn_start') {
      currentTurn = step.turn || 0;
    }

    // Si on dépasse le tour max, on stop (ne pas inclure les tours > 10)
    if (currentTurn > maxTurn) break;

    // Tour 10 : on inclut les actions normales du tour 10,
    // puis on injecte EXTINCTION à la fin
    if (step.phase === 'turn_start' && currentTurn === maxTurn && !reachedExtinction) {
      // Ajouter le step normalement
      processedSteps.push(step);
      lastBossHP = step.p2HP;
      lastPlayerHP = step.p1HP;
      continue;
    }

    if (currentTurn === maxTurn && step.phase === 'action') {
      // Inclure les actions du tour 10 normalement
      processedSteps.push(step);
      lastBossHP = step.p2HP;
      lastPlayerHP = step.p1HP;
      continue;
    }

    if (currentTurn < maxTurn) {
      processedSteps.push(step);
      lastBossHP = step.p2HP;
      lastPlayerHP = step.p1HP;
    }

    // Arrêter si le joueur meurt avant le tour 10
    if (step.p1HP <= 0 && step.phase !== 'intro') {
      bossHPAtEnd = step.p2HP;
      playerHPAtEnd = 0;
      break;
    }

    // Arrêter si le boss meurt avant le tour 10
    if (step.p2HP <= 0 && step.phase !== 'intro') {
      bossHPAtEnd = 0;
      playerHPAtEnd = step.p1HP;
      break;
    }
  }

  // Si le joueur est encore vivant après les tours traités, EXTINCTION
  if (lastPlayerHP > 0 && lastBossHP > 0 && currentTurn >= maxTurn) {
    reachedExtinction = true;
    bossHPAtEnd = lastBossHP;
    playerHPAtEnd = 0;

    // Injecter le step EXTINCTION
    const extinctionLogs = [
      `☠️ --- TOUR ${maxTurn} : EXTINCTION ---`,
      `💀 ${WORLD_BOSS.nom} concentre une énergie dévastatrice...`,
      `🔥 EXTINCTION ! Une vague de destruction pure anéantit tout sur son passage !`,
      `☠️ ${playerChar.name} est instantanément terrassé. Aucune défense ne peut résister.`
    ];
    processedSteps.push({
      phase: 'action',
      player: 2,
      logs: extinctionLogs,
      p1HP: 0,
      p2HP: lastBossHP,
      p1Shield: 0,
      p2Shield: 0
    });
  }

  // Calculer les dégâts totaux infligés au boss
  const damageDealt = Math.max(0, bossHP - (bossHPAtEnd > 0 ? bossHPAtEnd : 0));

  // Step de fin
  const endLogs = damageDealt > 0
    ? [`⚔️ ${playerChar.name} a infligé ${damageDealt} dégâts à ${WORLD_BOSS.nom} !`]
    : [`💨 ${playerChar.name} n'a pas réussi à blesser ${WORLD_BOSS.nom}.`];

  if (bossHPAtEnd <= 0) {
    endLogs.push(`🎉 ${WORLD_BOSS.nom} a été vaincu !`);
  }

  processedSteps.push({
    phase: 'victory',
    logs: endLogs,
    p1HP: playerHPAtEnd,
    p2HP: Math.max(0, bossHPAtEnd),
    p1Shield: 0,
    p2Shield: 0
  });

  // Reconstruire le combatLog à partir des steps traités
  const combatLog = [];
  for (const step of processedSteps) {
    combatLog.push(...step.logs);
  }

  return {
    steps: processedSteps,
    combatLog,
    damageDealt,
    playerDied: playerHPAtEnd <= 0,
    bossHPAfter: Math.max(0, bossHPAtEnd),
    p1MaxHP: result.p1MaxHP,
    bossMaxHP: bossHP,
    reachedExtinction
  };
}
