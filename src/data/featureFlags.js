/**
 * Feature Flags globaux - Duels de Cave
 *
 * Contrôle l'activation progressive du contenu post-tournoi.
 * Même date que la vague 2 d'armes : samedi 21 février 2026, 22h Paris.
 */

// Date d'activation globale : samedi 21 février 2026, 22h heure de Paris (UTC+1)
const FORGE_ACTIVATION_DATE = new Date('2026-02-21T22:00:00+01:00');

/**
 * Vérifie si le contenu Forge des Légendes est actif
 * (level cap 400, donjon Forge, upgrade, effets lave)
 */
export function isForgeActive() {
  return new Date() >= FORGE_ACTIVATION_DATE;
}

/**
 * Level cap global (actif uniquement après activation)
 */
export const MAX_LEVEL = 400;

/**
 * Vérifie si le level cap est actif
 */
export function isLevelCapActive() {
  return isForgeActive();
}

/**
 * Applique le level cap si actif
 */
export function clampLevel(level) {
  if (!isLevelCapActive()) return level;
  return Math.min(level, MAX_LEVEL);
}

// Date à partir de laquelle le donjon Collège Kunugigaoka (sous-classes) est visible et accessible
// Modifier cette date pour l'ouverture officielle (ex. lundi suivant le tournoi)
const SUBCLASS_DUNGEON_VISIBLE_DATE = new Date('2026-03-02T00:00:00+01:00');

/**
 * Vérifie si le donjon sous-classe (Collège Kunugigaoka) est visible dans la liste et accessible.
 * Masqué jusqu'à la date d'ouverture pour garder la surprise.
 */
export function isSubclassDungeonVisible() {
  return new Date() >= SUBCLASS_DUNGEON_VISIBLE_DATE;
}
