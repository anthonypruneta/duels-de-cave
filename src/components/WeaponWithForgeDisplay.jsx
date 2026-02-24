/**
 * Affichage du nom d'une arme avec optionnellement la ligne Forge (bonus/malus %).
 * Utilisé partout où on affiche l'arme équipée pour montrer l'upgrade Ornn.
 */

import React from 'react';
import { RARITY_COLORS } from '../data/weapons';
import { isForgeActive } from '../data/featureFlags';
import { extractForgeUpgrade, hasAnyForgeUpgrade, formatUpgradePct, FORGE_STAT_LABELS } from '../data/forgeDungeon';

/**
 * @param {Object} weapon - Arme (nom, rarete, etc.)
 * @param {Object|null} forgeUpgrade - Roll forge du personnage
 * @param {Object} [options] - { nameClassName, showForgeLine }
 */
export function WeaponNameWithForge({ weapon, forgeUpgrade, options = {} }) {
  if (!weapon) return null;
  const { nameClassName = '', showForgeLine = true } = options;
  const hasForge = isForgeActive() && hasAnyForgeUpgrade(forgeUpgrade);
  const label = (k) => FORGE_STAT_LABELS[k] || k.toUpperCase();

  let forgeLine = null;
  if (showForgeLine && hasForge && forgeUpgrade) {
    const { bonuses, penalties } = extractForgeUpgrade(forgeUpgrade);
    const bonusParts = Object.entries(bonuses).filter(([, v]) => v > 0).map(([k, pct]) => `${label(k)} +${formatUpgradePct(pct)}`);
    const penaltyParts = Object.entries(penalties).filter(([, v]) => v > 0).map(([k, pct]) => `${label(k)} -${formatUpgradePct(pct)}`);
    const parts = [...bonusParts, ...penaltyParts];
    if (parts.length > 0) {
      forgeLine = (
        <span className="block text-[11px] text-amber-200/90 mt-0.5">
          🔨 Forge: {parts.join(' • ')}
        </span>
      );
    }
  }

  return (
    <>
      <span className={`font-semibold ${hasForge ? `forge-lava-text ${nameClassName}`.trim() : (nameClassName || RARITY_COLORS[weapon.rarete])}`}>
        {weapon.nom}
      </span>
      {forgeLine}
    </>
  );
}

export default WeaponNameWithForge;
