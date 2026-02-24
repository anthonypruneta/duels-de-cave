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
import { weaponConstants, dmgPhys, dmgCap, calcCritChance } from '../data/combatMechanics.js';

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
    spellCount: 0,          // Compteur de sorts (pour Codex Archon, Arbalète du Verdict)
    firstHitDone: false,    // Premier coup effectué (pour Gungnir, Fléau d'Anathème)
    gungnirApplied: false,  // Debuff Gungnir appliqué (non cumulable)
    anathemeApplied: false,  // Debuff Fléau d'Anathème appliqué
    verdictSpellsUsed: 0,    // Nombre de sorts boostés par l'Arbalète du Verdict
    labrysBleedActive: false, // Saignement Labrys actif sur la cible
  };

  return {
    hasWeapon: true,
    weaponId,
    weapon,
    isLegendary: true,
    counters
  };
}


const YGGDRASIL_HEAL_PASSIVES = new Set(['essence_drain', 'onction_eternite']);

function canUseYggdrasilHealDamage(combatantClass, combatantRace, mageTowerPassive) {
  if (combatantClass === 'Healer' || combatantClass === 'Masochiste') return true;
  if (combatantRace === 'Sylvari') return true;
  return YGGDRASIL_HEAL_PASSIVES.has(mageTowerPassive?.id);
}

// ============================================================================
// MODIFICATION DES STATS DE BASE (Passifs permanents)
// ============================================================================
/**
 * Applique les modifications de stats passives des armes légendaires
 * À appeler après le calcul des stats de base.
 * Si skipFlatStats est true (ex. arme améliorée par Ornn), les bonus plats de l'arme ne sont pas ajoutés :
 * ils sont remplacés par l'effet % Forge appliqué plus tard.
 */
export function applyPassiveWeaponStats(stats, weaponId, combatantClass, combatantRace, mageTowerPassive, skipFlatStats = false) {
  if (!weaponId) return { ...stats };

  const weapon = getWeaponById(weaponId);
  if (!weapon) return { ...stats };

  const modifiedStats = { ...stats };

  // Ajouter les bonus de stats de l'arme (sauf si arme améliorée : les plats sont remplacés par le % Forge)
  if (!skipFlatStats) {
    for (const [stat, value] of Object.entries(weapon.stats)) {
      if (modifiedStats[stat] !== undefined) {
        modifiedStats[stat] += value;
      }
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
        // Branche d'Yggdrasil: dégâts bonus sur toute source de soin personnelle
        // (Healer, Masochiste, Sylvari, Vol d'essence, Onction d'Éternité), sinon regen passive.
        const hasOffensiveHeal = canUseYggdrasilHealDamage(combatantClass, combatantRace, mageTowerPassive);
        modifiedStats._yggdrasilRegen = !hasOffensiveHeal;
        modifiedStats._yggdrasilHealDamage = hasOffensiveHeal;
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
    anathemeDebuff: false,
    applyLabrysBleed: false,
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

    case 'fleau_legendaire': {
      // Fléau d'Anathème: première attaque, -15% DEF et -15% ResC permanent
      if (!weaponState.counters.anathemeApplied) {
        weaponState.counters.anathemeApplied = true;
        effects.anathemeDebuff = true;
        effects.log.push(`🔗 Fléau d'Anathème: Anathème - ${defender.nom || defender.name || 'Ennemi'} perd 15% DEF et 15% ResC !`);
      }
      break;
    }

    case 'hache_legendaire': {
      // Labrys d'Arès: applique saignement brut si pas déjà actif
      if (!defender._labrysBleedPercent || defender._labrysBleedPercent <= 0) {
        effects.applyLabrysBleed = true;
        effects.log.push(`🪓 Labrys d'Arès: Saignement d'Arès appliqué - ${defender.nom || defender.name || 'Ennemi'} saigne (3% HP max) !`);
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
    secondCastHeal: 0,
    log: []
  };

  if (!weaponState.isLegendary) return effects;

  weaponState.counters.spellCount++;
  const spellCount = weaponState.counters.spellCount;

  switch (weaponState.weaponId) {
    case 'tome_legendaire': {
      // Codex Archon: au 2e et 4e sort, double-cast
      if (weaponConstants.codexArchon.doubleCastTriggers.includes(spellCount)) {
        effects.doubleCast = true;
        const secondCastValue = Math.round(damage * weaponConstants.codexArchon.secondCastDamage);
        if (spellType === 'heal') {
          effects.secondCastHeal = secondCastValue;
          effects.log.push(`📜 Codex Archon: Arcane Majeure - Double-cast ! (${effects.secondCastHeal} soins bonus)`);
        } else {
          effects.secondCastDamage = secondCastValue;
          effects.log.push(`📜 Codex Archon: Arcane Majeure - Double-cast ! (${effects.secondCastDamage} dégâts bonus)`);
        }
      }
      break;
    }

    case 'arbalete_legendaire': {
      // Arbalète du Verdict: les 2 premiers sorts infligent +70% dégâts
      // (Le comptage est géré ici, le bonus de dégâts est appliqué dans le combat)
      // Le spellCount est déjà incrémenté ci-dessus
      break;
    }
  }

  return effects;
}

/**
 * Retourne le bonus de dégâts de sort pour l'Arbalète du Verdict
 * À appeler AVANT d'infliger les dégâts du sort
 */

/**
 * Riposte Paladin: ne doit PAS consommer les déclencheurs de double-cast/bonus de sort.
 *
 * Sans cette garde, Codex Archon peut "brûler" ses procs 2e/4e sort sur une
 * compétence défensive sans dégâts/soin direct, ce qui casse la promesse de
 * double-cast garanti sur les sorts offensifs/soins.
 */
export function onPaladinRiposteCast(_weaponState, _caster, _target) {
  return {
    doubleCast: false,
    secondCastDamage: 0,
    secondCastHeal: 0,
    log: []
  };
}

export function getVerdictSpellBonus(weaponState) {
  if (!weaponState?.isLegendary || weaponState.weaponId !== 'arbalete_legendaire') {
    return { damageMultiplier: 1.0, log: [] };
  }

  weaponState.counters.verdictSpellsUsed = (weaponState.counters.verdictSpellsUsed || 0) + 1;
  const spellIndex = weaponState.counters.verdictSpellsUsed;

  if (spellIndex <= weaponConstants.arbaleteVerdict.spellBonusCount) {
    return {
      damageMultiplier: 1 + weaponConstants.arbaleteVerdict.spellDamageBonus,
      log: [`⚖️ Arbalète du Verdict: Sort ${spellIndex}/${weaponConstants.arbaleteVerdict.spellBonusCount} — +70% dégâts !`]
    };
  }

  return { damageMultiplier: 1.0, log: [] };
}

/**
 * Retourne la pénalité de cooldown de l'Arbalète du Verdict
 */
export function getVerdictCooldownPenalty(weaponState) {
  if (!weaponState?.isLegendary || weaponState.weaponId !== 'arbalete_legendaire') {
    return 0;
  }
  return weaponConstants.arbaleteVerdict.cooldownPenalty;
}



/**
 * Permet aux soins de crit pour la Branche d'Yggdrasil
 */
export function rollHealCrit(weaponState, healer, healAmount) {
  if (!weaponState?.isLegendary || weaponState.weaponId !== 'baton_legendaire') {
    return { amount: healAmount, isCrit: false };
  }

  const critChance = calcCritChance(healer);
  const isCrit = Math.random() < critChance;
  if (!isCrit) return { amount: healAmount, isCrit: false };

  const critAmount = Math.max(1, Math.round(healAmount * weaponConstants.yggdrasil.healCritMultiplier));
  return { amount: critAmount, isCrit: true };
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
      // Branche d'Yggdrasil: le soin est conservé ET inflige 50% en dégâts bonus (si classe heal)
      if (healer.base._yggdrasilHealDamage) {
        effects.bonusDamage = Math.round(healAmount * weaponConstants.yggdrasil.healDamagePercent);
        effects.log.push(`🌳 Branche d'Yggdrasil: Le soin est conservé et inflige ${effects.bonusDamage} dégâts bonus`);
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
 * Modifie les dégâts critiques (effets spéciaux uniquement).
 * Les bonus % (ex. Lævateinn) sont déjà inclus additivement dans getCritMultiplier.
 */
export function modifyCritDamage(weaponState, baseCritDamage) {
  // Bonus % dégâts crit des armes sont appliqués dans getCritMultiplier (additif avec classe/éveil)
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

/**
 * Applique le debuff Anathème (Fléau légendaire) à un défenseur
 * -15% DEF et -15% ResC permanent
 */
export function applyAnathemeDebuff(defenderStats) {
  const debuffedStats = { ...defenderStats };
  debuffedStats.def = Math.max(0, Math.round(debuffedStats.def * (1 - weaponConstants.fleauAnatheme.defReductionPercent)));
  debuffedStats.rescap = Math.max(0, Math.round(debuffedStats.rescap * (1 - weaponConstants.fleauAnatheme.rescapReductionPercent)));
  debuffedStats._anathemeDebuffed = true;
  return debuffedStats;
}

/**
 * Applique le saignement Labrys d'Arès à un défenseur
 * La cible perd 3% HP max à chaque auto, réduit de 1% par auto
 */
export function applyLabrysBleed(defender) {
  defender._labrysBleedPercent = weaponConstants.labrysAres.initialBleedPercent;
}

/**
 * Traite le saignement Labrys quand la cible attaque
 * Retourne les dégâts bruts infligés
 */
export function processLabrysBleed(attacker) {
  if (!attacker._labrysBleedPercent || attacker._labrysBleedPercent <= 0) {
    return { damage: 0, log: [] };
  }

  const bleedDmg = Math.max(1, Math.round(attacker.maxHP * attacker._labrysBleedPercent));
  const log = [`🪓 Saignement d'Arès: ${attacker.nom || attacker.name} perd ${bleedDmg} PV bruts (${Math.round(attacker._labrysBleedPercent * 100)}% HP max)`];

  // Réduire le saignement de 1%
  attacker._labrysBleedPercent = Math.max(0, attacker._labrysBleedPercent - weaponConstants.labrysAres.bleedDecayPercent);

  if (attacker._labrysBleedPercent <= 0) {
    log.push(`🪓 Le saignement d'Arès se dissipe.`);
  }

  return { damage: bleedDmg, log };
}

// ============================================================================
// FORGE DES LÉGENDES — Upgrade % sur stats totales
// ============================================================================

/**
 * Applique les bonus d'upgrade de la Forge des Légendes aux stats finales.
 * Les % s'appliquent sur la stat totale du personnage (après tous les autres bonus).
 *
 * @param {Object} stats - Stats totales calculées du personnage
 * @param {Object|null} forgeUpgrade - Données d'upgrade { upgradeAutoPct, upgradeVitPct, upgradeVitPenaltyPct }
 * @returns {Object} Stats modifiées
 */
export function applyForgeUpgrade(stats, forgeUpgrade) {
  if (!forgeUpgrade) return stats;

  const modified = { ...stats };

  // Nouveau format (par stat)
  if (forgeUpgrade.statBonusesPct) {
    for (const [statKey, pct] of Object.entries(forgeUpgrade.statBonusesPct)) {
      if (modified[statKey] !== undefined && pct > 0) {
        modified[statKey] = Math.round(modified[statKey] * (1 + pct));
      }
    }
  }

  if (forgeUpgrade.statPenaltyPct) {
    for (const [statKey, pct] of Object.entries(forgeUpgrade.statPenaltyPct)) {
      if (modified[statKey] !== undefined && pct > 0) {
        modified[statKey] = Math.round(modified[statKey] * (1 - pct));
      }
    }
  }

  // Compat legacy (anciens rolls déjà stockés)
  if (forgeUpgrade.upgradeAutoPct) {
    modified.auto = Math.round(modified.auto * (1 + forgeUpgrade.upgradeAutoPct));
  }

  if (forgeUpgrade.upgradeVitPct) {
    modified.spd = Math.round(modified.spd * (1 + forgeUpgrade.upgradeVitPct));
  }

  if (forgeUpgrade.upgradeVitPenaltyPct) {
    modified.spd = Math.round(modified.spd * (1 - forgeUpgrade.upgradeVitPenaltyPct));
  }

  return modified;
}
