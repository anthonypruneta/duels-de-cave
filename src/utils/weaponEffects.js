/**
 * Effets des Armes Légendaires - Duels de Cave
 *
 * Ce fichier contient toute la logique pour appliquer les effets
 * des armes légendaires pendant le combat.
 *
 * Intégration dans le moteur de combat:
 * 1. Initialiser les compteurs d'arme au début du combat
 * 2. Appeler les hooks appropriés à chaque phase du tour
 * 3. Les effets modifient les dégâts, stats ou état du combat
 */

import { getWeaponById, RARITY } from '../data/weapons.js';
import { weaponConstants, healingClasses, dmgPhys, dmgCap } from '../data/combatMechanics.js';

// ============================================================================
// ÉTAT DE COMBAT POUR LES ARMES
// ============================================================================
/**
 * Initialise l'état de combat pour les effets d'arme d'un combattant
 * À appeler au début de chaque combat
 */
export function initWeaponCombatState(combatant, weaponId) {
  if (!weaponId) {
    return {
      hasWeapon: false,
      weaponId: null,
      counters: {}
    };
  }

  const weapon = getWeaponById(weaponId);
  if (!weapon || weapon.rarete !== RARITY.LEGENDAIRE) {
    return {
      hasWeapon: true,
      weaponId,
      isLegendary: false,
      counters: {}
    };
  }

  // Initialise les compteurs spécifiques à chaque arme légendaire
  const counters = {
    turnCount: 0,           // Compteur de tours (pour Zweihänder, Lævateinn, Arc des Cieux)
    attackCount: 0,         // Compteur d'attaques (pour Mjöllnir)
    spellCount: 0,          // Compteur de sorts (pour Codex Archon)
    firstHitDone: false,    // Premier coup effectué (pour Gungnir)
    gungnirApplied: false,  // Debuff Gungnir appliqué (non cumulable)
  };

  return {
    hasWeapon: true,
    weaponId,
    weapon,
    isLegendary: true,
    counters
  };
}

// ============================================================================
// MODIFICATION DES STATS DE BASE (Passifs permanents)
// ============================================================================
/**
 * Applique les modifications de stats passives des armes légendaires
 * À appeler après le calcul des stats de base
 */
export function applyPassiveWeaponStats(stats, weaponId, combatantClass) {
  if (!weaponId) return { ...stats };

  const weapon = getWeaponById(weaponId);
  if (!weapon) return { ...stats };

  const modifiedStats = { ...stats };

  // Ajouter les bonus de stats de l'arme
  for (const [stat, value] of Object.entries(weapon.stats)) {
    if (modifiedStats[stat] !== undefined) {
      modifiedStats[stat] += value;
    }
  }

  // Effets passifs des armes légendaires
  if (weapon.rarete === RARITY.LEGENDAIRE) {
    switch (weapon.id) {
      case 'bouclier_legendaire': {
        // Égide d'Athéna: +10% DEF et +10% RESC → ATK
        const atkBonus = Math.round(
          modifiedStats.def * weaponConstants.egide.defToAtkPercent +
          modifiedStats.rescap * weaponConstants.egide.rescapToAtkPercent
        );
        modifiedStats.auto += atkBonus;
        break;
      }

      case 'baton_legendaire': {
        // Branche d'Yggdrasil: regen passive si pas de classe heal
        // La regen est gérée dans le hook de tour, pas ici
        // Mais on marque le combattant comme ayant cette arme
        modifiedStats._yggdrasilRegen = !healingClasses.includes(combatantClass);
        modifiedStats._yggdrasilHealDamage = healingClasses.includes(combatantClass);
        break;
      }
    }
  }

  return modifiedStats;
}

// ============================================================================
// HOOKS DE COMBAT - DÉBUT DE TOUR
// ============================================================================
/**
 * Hook appelé au début de chaque tour du combattant
 * Retourne les effets à appliquer
 */
export function onTurnStart(weaponState, combatant, turn) {
  const effects = {
    regen: 0,
    priorityOverride: false,
    damageMultiplier: 1.0,
    guaranteedCrit: false,
    bonusAttacks: 0,
    bonusAttackDamage: 1.0,
    log: []
  };

  if (!weaponState.isLegendary) return effects;

  weaponState.counters.turnCount++;
  const turnCount = weaponState.counters.turnCount;

  switch (weaponState.weaponId) {
    case 'baton_legendaire': {
      // Branche d'Yggdrasil: regen 3% si pas de heal
      if (combatant.base._yggdrasilRegen) {
        effects.regen = Math.round(combatant.maxHP * weaponConstants.yggdrasil.regenPercent);
        effects.log.push(`🌳 Branche d'Yggdrasil régénère ${effects.regen} PV`);
      }
      break;
    }

    case 'epee_legendaire': {
      // Zweihänder: tous les 4 tours, priorité + 30% dégâts
      if (turnCount % weaponConstants.zweihander.triggerEveryNTurns === 0) {
        effects.priorityOverride = true;
        effects.damageMultiplier = 1 + weaponConstants.zweihander.damageBonus;
        effects.log.push(`🗡️ Zweihänder: Frappe Dévastatrice activée (+30% dégâts, priorité)`);
      }
      break;
    }

    case 'dague_legendaire': {
      // Lævateinn: tous les 4 tours, crit garanti
      if (turnCount % weaponConstants.laevateinn.triggerEveryNTurns === 0) {
        effects.guaranteedCrit = true;
        effects.log.push(`🔥 Lævateinn: Critique garanti ce tour`);
      }
      break;
    }

    case 'arc_legendaire': {
      // Arc des Cieux: tous les 4 tours, attaque bonus
      if (turnCount % weaponConstants.arcCieux.triggerEveryNTurns === 0) {
        effects.bonusAttacks = weaponConstants.arcCieux.bonusAttacks;
        effects.bonusAttackDamage = weaponConstants.arcCieux.bonusAttackDamage;
        effects.log.push(`🌟 Arc des Cieux: Pluie Céleste (attaque bonus)`);
      }
      break;
    }
  }

  return effects;
}

// ============================================================================
// HOOKS DE COMBAT - APRÈS ATTAQUE
// ============================================================================
/**
 * Hook appelé après chaque attaque physique
 */
export function onAttack(weaponState, attacker, defender, damage) {
  const effects = {
    stunTarget: false,
    stunDuration: 0,
    atkDebuff: 0,
    log: []
  };

  if (!weaponState.isLegendary) return effects;

  weaponState.counters.attackCount++;

  switch (weaponState.weaponId) {
    case 'marteau_legendaire': {
      // Mjöllnir: toutes les 5 attaques, stun 1 tour
      if (weaponState.counters.attackCount % weaponConstants.mjollnir.triggerEveryNAttacks === 0) {
        effects.stunTarget = true;
        effects.stunDuration = weaponConstants.mjollnir.stunDuration;
        effects.log.push(`⚡ Mjöllnir: Tonnerre Divin - ${defender.nom || 'Ennemi'} étourdi !`);
      }
      break;
    }

    case 'lance_legendaire': {
      // Gungnir: premier coup, -10% ATK permanent
      if (!weaponState.counters.firstHitDone && !weaponState.counters.gungnirApplied) {
        weaponState.counters.firstHitDone = true;
        weaponState.counters.gungnirApplied = true;
        effects.atkDebuff = weaponConstants.gungnir.atkReductionPercent;
        effects.log.push(`✨ Gungnir: Serment d'Odin - ATK ennemie réduite de 10%`);
      }
      break;
    }
  }

  return effects;
}

// ============================================================================
// HOOKS DE COMBAT - APRÈS SORT
// ============================================================================
/**
 * Hook appelé après chaque sort lancé
 */
export function onSpellCast(weaponState, caster, target, damage, spellType) {
  const effects = {
    doubleCast: false,
    secondCastDamage: 0,
    log: []
  };

  if (!weaponState.isLegendary) return effects;

  weaponState.counters.spellCount++;
  const spellCount = weaponState.counters.spellCount;

  switch (weaponState.weaponId) {
    case 'tome_legendaire': {
      // Codex Archon: au 2e et 6e sort, double-cast
      if (weaponConstants.codexArchon.doubleCastTriggers.includes(spellCount)) {
        effects.doubleCast = true;
        effects.secondCastDamage = Math.round(damage * weaponConstants.codexArchon.secondCastDamage);
        effects.log.push(`📜 Codex Archon: Arcane Majeure - Double-cast ! (${effects.secondCastDamage} dégâts bonus)`);
      }
      break;
    }
  }

  return effects;
}

// ============================================================================
// HOOKS DE COMBAT - MODIFICATION DES SOINS
// ============================================================================
/**
 * Hook appelé quand le combattant se soigne
 * Retourne les dégâts à infliger à l'ennemi (Yggdrasil)
 */
export function onHeal(weaponState, healer, healAmount, target) {
  const effects = {
    bonusDamage: 0,
    log: []
  };

  if (!weaponState.isLegendary) return effects;

  switch (weaponState.weaponId) {
    case 'baton_legendaire': {
      // Branche d'Yggdrasil: soins infligent 50% dégâts (si classe heal)
      if (healer.base._yggdrasilHealDamage) {
        effects.bonusDamage = Math.round(healAmount * weaponConstants.yggdrasil.healDamagePercent);
        effects.log.push(`🌳 Branche d'Yggdrasil: Le soin inflige ${effects.bonusDamage} dégâts`);
      }
      break;
    }
  }

  return effects;
}

// ============================================================================
// HOOKS DE COMBAT - MODIFICATION DES CRITIQUES
// ============================================================================
/**
 * Modifie les dégâts critiques
 */
export function modifyCritDamage(weaponState, baseCritDamage) {
  if (!weaponState.isLegendary) return baseCritDamage;

  switch (weaponState.weaponId) {
    case 'dague_legendaire': {
      // Lævateinn: tous les crits +30% dégâts (passif permanent)
      return Math.round(baseCritDamage * (1 + weaponConstants.laevateinn.critDamageBonus));
    }
  }

  return baseCritDamage;
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Vérifie si un combattant a une arme légendaire spécifique
 */
export function hasLegendaryWeapon(weaponState, weaponId) {
  return weaponState.isLegendary && weaponState.weaponId === weaponId;
}

/**
 * Récupère le résumé des effets d'arme actifs pour l'UI
 */
export function getActiveEffectsSummary(weaponState) {
  if (!weaponState.isLegendary) return [];

  const effects = [];
  const weapon = weaponState.weapon;

  if (weapon.effet) {
    effects.push({
      nom: weapon.effet.nom,
      description: weapon.effet.description,
      icon: weapon.icon
    });
  }

  return effects;
}

/**
 * Applique le debuff Gungnir à un défenseur
 */
export function applyGungnirDebuff(defenderStats) {
  const debuffedStats = { ...defenderStats };
  debuffedStats.auto = Math.round(debuffedStats.auto * (1 - weaponConstants.gungnir.atkReductionPercent));
  debuffedStats._gungnirDebuffed = true;
  return debuffedStats;
}

/**
 * Applique le stun Mjöllnir à un défenseur
 */
export function applyMjollnirStun(defenderState) {
  return {
    ...defenderState,
    stunned: true,
    stunnedTurns: weaponConstants.mjollnir.stunDuration
  };
}
