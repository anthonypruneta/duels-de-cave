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
    capacityCount: 0,       // Compteur de capacités (Codex Archon, Arbalète du Verdict)
    firstHitDone: false,    // Premier coup effectué (pour Gungnir, Fléau d'Anathème)
    gungnirApplied: false,  // Debuff Gungnir appliqué (non cumulable)
    anathemeApplied: false,  // Debuff Fléau d'Anathème appliqué
    verdictCapacitiesUsed: 0, // Nombre de capacités boostées par l'Arbalète du Verdict
    labrysBleedActive: false, // Saignement Labrys actif sur la cible
    executeTriggered: false,  // Faux de Thanatos: explosion exécution déjà déclenchée
    sceptreCapStacks: 0,      // Sceptre du Roi-Sorcier: stacks de CAP
    penduleCdUsed: 0,         // Pendule de Chronos: nombre de capacités ayant bénéficié du -1 CD
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

/** mageTowerPassiveOrList: un passif { id } ou une liste de passifs (principal + extension). */
function canUseYggdrasilHealDamage(combatantClass, combatantRace, mageTowerPassiveOrList) {
  if (combatantClass === 'Healer' || combatantClass === 'Masochiste' || combatantClass === 'Alchimiste') return true;
  if (combatantRace === 'Sylvari') return true;
  if (Array.isArray(mageTowerPassiveOrList)) return mageTowerPassiveOrList.some((p) => YGGDRASIL_HEAL_PASSIVES.has(p?.id));
  return YGGDRASIL_HEAL_PASSIVES.has(mageTowerPassiveOrList?.id);
}

/**
 * Variante très ciblée de onAttack, utilisée quand on veut faire progresser / déclencher Mjöllnir
 * sans déclencher les autres effets "après attaque" (Gungnir, Anathème, Labrys, Thanatos...).
 *
 * Typiquement: Alchimiste (phase de flasque de vie) — doit pouvoir proc Mjöllnir.
 */
export function onMjollnirAttackLikeAction(weaponState, attacker, defender) {
  const effects = {
    stunTarget: false,
    stunDuration: 0,
    log: []
  };

  if (!weaponState?.isLegendary || weaponState.weaponId !== 'marteau_legendaire') return effects;

  weaponState.counters.attackCount++;

  if (weaponState.counters.attackCount % weaponConstants.mjollnir.triggerEveryNAttacks === 0) {
    effects.stunTarget = true;
    effects.stunDuration = weaponConstants.mjollnir.stunDuration;
    effects.log.push(`⚡ Mjöllnir: Tonnerre Divin - ${defender?.nom || defender?.name || 'Ennemi'} étourdi !`);
  }

  return effects;
}

// ============================================================================
// MODIFICATION DES STATS DE BASE (Passifs permanents)
// ============================================================================
/**
 * Applique les modifications de stats passives des armes légendaires
 * À appeler après le calcul des stats de base.
 * Si skipFlatStats est true (ex. arme améliorée par Ornn), les bonus plats de l'arme ne sont pas ajoutés :
 * ils sont remplacés par l'effet % Forge appliqué plus tard.
 * mageTowerPassiveOrList: un passif { id } ou une liste [principal, extension] pour prendre en compte la fusion.
 */
export function applyPassiveWeaponStats(stats, weaponId, combatantClass, combatantRace, mageTowerPassiveOrList, skipFlatStats = false) {
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
        // Égide d'Athéna: +10% DEF et +10% RESC → Auto
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
        const hasOffensiveHeal = canUseYggdrasilHealDamage(combatantClass, combatantRace, mageTowerPassiveOrList);
        modifiedStats._yggdrasilRegen = !hasOffensiveHeal;
        modifiedStats._yggdrasilHealDamage = hasOffensiveHeal;
        break;
      }

      case 'pendule_legendaire': {
        modifiedStats._penduleCDR = true;
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
    fauxBonusDamage: 0,
    fauxExecuteDamage: 0,
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
      // Gungnir: premier coup, -10% Auto permanent
      if (!weaponState.counters.firstHitDone && !weaponState.counters.gungnirApplied) {
        weaponState.counters.firstHitDone = true;
        weaponState.counters.gungnirApplied = true;
        effects.atkDebuff = weaponConstants.gungnir.atkReductionPercent;
        effects.log.push(`✨ Gungnir: Serment d'Odin - Auto ennemie réduite de 10%`);
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

    case 'faux_legendaire': {
      const missingHp = Math.max(0, defender.maxHP - defender.currentHP);
      const bonusDmg = Math.max(1, Math.round(missingHp * weaponConstants.fauxThanatos.missingHpDamagePercent));
      effects.fauxBonusDamage = bonusDmg;
      effects.log.push(`☠️ Faux de Thanatos: Moisson Mortelle inflige ${bonusDmg} dégâts bruts (5% PV manquants)`);

      const hpAfterAttack = defender.currentHP - damage - bonusDmg;
      if (hpAfterAttack <= defender.maxHP * weaponConstants.fauxThanatos.executeThreshold && !weaponState.counters.executeTriggered) {
        weaponState.counters.executeTriggered = true;
        const executeDmg = Math.max(1, Math.round(defender.maxHP * weaponConstants.fauxThanatos.executePercent));
        effects.fauxExecuteDamage = executeDmg;
        effects.log.push(`💀 Faux de Thanatos: Exécution ! ${defender.nom || defender.name || 'Ennemi'} subit ${executeDmg} dégâts bruts (8% PV max) !`);
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
 * Hook appelé après chaque capacité lancée.
 * options.healAmount : pour le masochiste, montant du soin à dupliquer (Codex Archon).
 */
export function onCapacityCast(weaponState, caster, target, damage, capacityType, options = {}) {
  const effects = {
    doubleCast: false,
    secondCastDamage: 0,
    secondCastHeal: 0,
    riposteTwice: false,
    sceptreCapBuff: 0,
    log: []
  };

  if (!weaponState.isLegendary) return effects;

  weaponState.counters.capacityCount++;
  const capacityCount = weaponState.counters.capacityCount;

  switch (weaponState.weaponId) {
    case 'tome_legendaire': {
      // Codex Archon: toutes les 2 capacités (2e, 4e, 6e…), double-cast (le combat affiche le texte exact de la capacité dédoublée)
      const everyN = weaponConstants.codexArchon.doubleCastEveryN ?? 2;
      if (capacityCount >= everyN && capacityCount % everyN === 0) {
        effects.doubleCast = true;
        const ratio = weaponConstants.codexArchon.secondCastDamage;
        if (capacityType === 'paladin') {
          effects.riposteTwice = true;
        } else if (capacityType === 'heal' || capacityType === 'alch_heal') {
          effects.secondCastHeal = Math.round(damage * ratio);
        } else if (capacityType === 'maso') {
          effects.secondCastDamage = Math.round(damage * ratio);
          effects.secondCastHeal = Math.round((options.healAmount || 0) * ratio);
        } else {
          effects.secondCastDamage = Math.round(damage * ratio);
        }
      }
      break;
    }

    case 'arbalete_legendaire': {
      // Arbalète du Verdict: les 2 premières capacités infligent +100% dégâts/soins
      // (Le comptage est géré dans getVerdictCapacityBonus, le bonus est appliqué dans le combat)
      break;
    }

    case 'sceptre_legendaire': {
      const maxStacks = weaponConstants.sceptreRoiSorcier.maxCapStacks;
      if (weaponState.counters.sceptreCapStacks < maxStacks) {
        weaponState.counters.sceptreCapStacks++;
        const raw = weaponConstants.sceptreRoiSorcier.capStackPercent;
        const stackPct = raw > 1 ? raw / 100 : raw;
        effects.sceptreCapBuff = stackPct;
        const pctDisplay = raw > 1 ? raw : Math.round(stackPct * 100);
        effects.log.push(`🏆 Sceptre du Roi-Sorcier: +${pctDisplay}% CAP (stack ${weaponState.counters.sceptreCapStacks}/${maxStacks})`);
      }
      break;
    }
  }

  return effects;
}

/**
 * Retourne le bonus de dégâts de capacité pour l'Arbalète du Verdict
 * À appeler AVANT d'infliger les dégâts de la capacité
 */

/**
 * Riposte Paladin avec Codex : si onCapacityCast est appelé avec capacityType 'paladin'
 * et que le Codex proc, effects.riposteTwice = true et la riposte s'appliquera deux fois.
 */
export function onPaladinRiposteCast(_weaponState, _caster, _target) {
  return {
    doubleCast: false,
    secondCastDamage: 0,
    secondCastHeal: 0,
    riposteTwice: false,
    log: []
  };
}

export function getVerdictCapacityBonus(weaponState) {
  if (!weaponState?.isLegendary || weaponState.weaponId !== 'arbalete_legendaire') {
    return { damageMultiplier: 1.0, healMultiplier: 1.0, log: [] };
  }

  weaponState.counters.verdictCapacitiesUsed = (weaponState.counters.verdictCapacitiesUsed || 0) + 1;
  const capacityIndex = weaponState.counters.verdictCapacitiesUsed;

  if (capacityIndex <= weaponConstants.arbaleteVerdict.spellBonusCount) {
    // spellDamageBonus en décimal (1 = +100%). Si > 1, traiter comme entier % (ex. 100 → 100%)
    const bonus = weaponConstants.arbaleteVerdict.spellDamageBonus ?? 0;
    const bonusDecimal = bonus > 1 ? bonus / 100 : bonus;
    const pctLabel = Math.round(bonusDecimal * 100);
    const mult = 1 + bonusDecimal;
    return {
      damageMultiplier: mult,
      healMultiplier: mult,
      log: [`⚖️ Arbalète du Verdict: Capacité ${capacityIndex}/${weaponConstants.arbaleteVerdict.spellBonusCount} — +${pctLabel}% dégâts et soins !`]
    };
  }

  return { damageMultiplier: 1.0, healMultiplier: 1.0, log: [] };
}

/**
 * Retourne la pénalité de cooldown de l'Arbalète du Verdict.
 * La pénalité (+1 CD) ne s'applique que sur les 2 premières capacités (celles qui ont le bonus dégâts).
 */
export function getVerdictCooldownPenalty(weaponState) {
  if (!weaponState?.isLegendary || weaponState.weaponId !== 'arbalete_legendaire') {
    return 0;
  }
  const used = weaponState.counters?.verdictCapacitiesUsed ?? 0;
  if (used >= weaponConstants.arbaleteVerdict.spellBonusCount) {
    return 0;
  }
  return weaponConstants.arbaleteVerdict.cooldownPenalty;
}

/**
 * Démoniste + Arbalète du Verdict : les 2 premières attaques du familier ont +1 CD.
 * Le familier tape donc aux tours 2 et 4 au lieu de 1, 2, 3, 4.
 * Retourne true si on doit ignorer l'attaque du familier ce tour (skip).
 */
export function shouldSkipVerdictDemonFamiliar(weaponState, turn) {
  if (!weaponState?.isLegendary || weaponState.weaponId !== 'arbalete_legendaire') {
    return false;
  }
  const used = weaponState.counters?.verdictCapacitiesUsed ?? 0;
  if (used >= weaponConstants.arbaleteVerdict.spellBonusCount) {
    return false;
  }
  // 1ère capacité autorisée au tour 2, 2e au tour 4
  const allowedTurn = 2 * (used + 1);
  return turn < allowedTurn;
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
      // Branche d'Yggdrasil: le soin s'applique puis 50% du montant en dégâts à l'ennemi
      if (healer.base._yggdrasilHealDamage) {
        effects.bonusDamage = Math.round(healAmount * weaponConstants.yggdrasil.healDamagePercent);
        effects.log.push(`🌳 Branche d'Yggdrasil: inflige ${effects.bonusDamage} dégâts`);
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

// ============================================================================
// PENDULE DE CHRONOS — Réduction de cooldown
// ============================================================================

/**
 * Retourne la réduction de CD du Pendule de Chronos.
 * -1 CD sur les 2 premières capacités. Non cumulable avec Mindflayer éveillé.
 * Appeler AVANT de lancer la capacité. Le compteur est incrémenté automatiquement.
 */
export function getPenduleCooldownReduction(weaponState) {
  if (!weaponState?.isLegendary || weaponState.weaponId !== 'pendule_legendaire') {
    return 0;
  }
  const used = weaponState.counters?.penduleCdUsed ?? 0;
  if (used >= weaponConstants.penduleChronos.cdBonusCount) {
    return 0;
  }
  return -weaponConstants.penduleChronos.cdReduction;
}

/**
 * Consomme une charge de CDR du Pendule (à appeler quand la capacité est effectivement lancée).
 */
export function consumePenduleCdCharge(weaponState) {
  if (!weaponState?.isLegendary || weaponState.weaponId !== 'pendule_legendaire') return;
  weaponState.counters.penduleCdUsed = (weaponState.counters.penduleCdUsed || 0) + 1;
}

/**
 * Retourne le bonus de dégâts/soins des capacités du Pendule de Chronos (+5%).
 */
export function getPenduleSpellBonus(weaponState) {
  if (!weaponState?.isLegendary || weaponState.weaponId !== 'pendule_legendaire') {
    return 0;
  }
  return weaponConstants.penduleChronos.spellBonus;
}
