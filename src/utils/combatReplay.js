// Replay animé des steps de combat retournés par simulerMatch()
// Utilisé par Combat.jsx, Dungeon.jsx, ForestDungeon.jsx, MageTower.jsx

const SPEEDS = {
  normal: { intro: 800, turn_start: 800, action_pre: 300, action_post: 2000 },
  fast:   { intro: 400, turn_start: 400, action_pre: 150, action_post: 1000 }
};

/**
 * Rejoue les steps de combat avec des délais d'animation.
 *
 * @param {Array} steps - Les steps retournés par simulerMatch().steps
 * @param {Object} options
 * @param {Function} options.setCombatLog - Setter React pour le log de combat
 * @param {Function} options.onStepHP - Callback(step) pour mettre à jour les barres de vie
 * @param {Function} [options.setCurrentAction] - Setter React pour l'action en cours (optionnel, utilisé par Combat.jsx)
 * @param {Array} [options.existingLogs=[]] - Logs existants à conserver (pour les donjons multi-niveaux)
 * @param {string} [options.speed='normal'] - 'normal' pour PvP, 'fast' pour donjons
 * @returns {Promise<Array>} Les logs accumulés
 */
export async function replayCombatSteps(steps, {
  setCombatLog,
  onStepHP,
  setCurrentAction = null,
  existingLogs = [],
  speed = 'normal'
}) {
  const delays = SPEEDS[speed] || SPEEDS.normal;
  const logs = [...existingLogs];

  for (const step of steps) {
    logs.push(...step.logs);
    setCombatLog([...logs]);
    onStepHP(step);

    if (step.phase === 'intro') {
      await new Promise(r => setTimeout(r, delays.intro));
    } else if (step.phase === 'turn_start') {
      await new Promise(r => setTimeout(r, delays.turn_start));
    } else if (step.phase === 'action') {
      if (setCurrentAction) {
        setCurrentAction({ player: step.player, logs: step.logs });
      }
      await new Promise(r => setTimeout(r, delays.action_pre));
      await new Promise(r => setTimeout(r, delays.action_post));
      if (setCurrentAction) {
        setCurrentAction(null);
      }
    }
    // 'victory' : pas de délai, géré par l'appelant
  }

  return logs;
}
