// Génération dynamique des descriptions de races et classes
// basée sur les constantes de combatMechanics.js (modifiables via /admin/balance)

import { raceConstants, classConstants } from '../data/combatMechanics';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { getAwakeningEffect } from './awakening';

const pct = (v, digits = 0) => `${(Number(v || 0) * 100).toFixed(digits)}%`;

// Mapping nom affiché → clé dans raceConstants/classConstants
export const RACE_TO_CONSTANT_KEY = {
  'Humain': 'humain',
  'Elfe': 'elfe',
  'Orc': 'orc',
  'Nain': 'nain',
  'Dragonkin': 'dragonkin',
  'Mort-vivant': 'mortVivant',
  'Lycan': 'lycan',
  'Sylvari': 'sylvari',
  'Sirène': 'sirene',
  'Gnome': 'gnome',
  'Mindflayer': 'mindflayer'
};

export const CLASS_TO_CONSTANT_KEY = {
  'Guerrier': 'guerrier',
  'Voleur': 'voleur',
  'Paladin': 'paladin',
  'Healer': 'healer',
  'Archer': 'archer',
  'Mage': 'mage',
  'Demoniste': 'demoniste',
  'Masochiste': 'masochiste',
  'Briseur de Sort': 'briseurSort',
  'Succube': 'succube',
  'Bastion': 'bastion'
};

// ============================================================================
// DESCRIPTIONS DE RACES
// ============================================================================

export const buildRaceBonusDescription = (raceName, constants = null) => {
  const c = constants || raceConstants[RACE_TO_CONSTANT_KEY[raceName]] || {};
  switch (raceName) {
    case 'Humain': return `+${c.hp || 0} PV & +${c.auto || 0} toutes stats`;
    case 'Elfe': return `+${c.auto || 0} AUTO, +${c.cap || 0} CAP, +${c.spd || 0} VIT, +${pct(c.critBonus, 0)} crit`;
    case 'Orc': return `Sous ${(Number(c.lowHpThreshold || 0) * 100).toFixed(0)}% PV: +${((Number(c.damageBonus || 1) - 1) * 100).toFixed(0)}% dégâts`;
    case 'Nain': return `+${c.hp || 0} PV & +${c.def || 0} Déf`;
    case 'Dragonkin': return `+${c.hp || 0} PV & +${c.rescap || 0} ResC`;
    case 'Mort-vivant': return `Revient à ${pct(c.revivePercent, 0)} PV (1x)`;
    case 'Lycan': return `Attaque inflige saignement +${c.bleedPerHit || 0} de dégât/tour`;
    case 'Sylvari': return `Regen ${pct(c.regenPercent, 1)} PV max/tour`;
    case 'Sirène': return `+${c.cap || 0} CAP, subit un spell: +${pct(c.stackBonus, 0)} dégâts/soins des capacités (max ${c.maxStacks || 0} stacks)`;
    case 'Gnome': return `+${c.spd || 0} VIT, +${c.cap || 0} CAP\nVIT > cible: +${pct(c.critIfFaster, 0)} crit, +${pct(c.critDmgIfFaster, 0)} dégâts crit\nVIT < cible: +${pct(c.dodgeIfSlower, 0)} esquive, +${pct(c.capBonusIfSlower, 0)} CAP\nÉgalité: +${pct(c.critIfEqual, 0)} crit/dégâts crit, +${pct(c.dodgeIfEqual, 0)} esquive/CAP`;
    case 'Mindflayer': return `Vole et relance le premier sort lancé par l'ennemi et ajoute ${pct(c.stealSpellCapDamageScale, 0)} de votre CAP aux dégâts\nSort sans CD: +${pct(c.noCooldownSpellBonus, 0)} dégâts`;
    default: return races[raceName]?.bonus || '';
  }
};

export const buildRaceAwakeningDescription = (raceName, effect = null) => {
  const e = effect || getAwakeningEffect(raceName);
  if (!e) return races[raceName]?.awakening?.description || '';
  switch (raceName) {
    case 'Humain': return `+${pct((e?.statMultipliers?.hp || 1) - 1, 0)} à toutes les stats`;
    case 'Elfe': return `+${pct((e?.statMultipliers?.auto || 1) - 1, 0)} Auto, +${pct((e?.statMultipliers?.cap || 1) - 1, 0)} Cap, +${e?.statBonuses?.spd || 0} VIT, +${pct(e?.critChanceBonus, 0)} crit, +${pct(e?.critDamageBonus, 0)} dégâts crit`;
    case 'Orc': return `- Sous 50% PV: +22% dégâts\n- Les ${e?.incomingHitCount || 0} premières attaques subies infligent ${(Number(e?.incomingHitMultiplier || 1) * 100).toFixed(0)}% dégâts`;
    case 'Nain': return `+${pct((e?.statMultipliers?.hp || 1) - 1, 0)} PV max, +${pct((e?.statMultipliers?.def || 1) - 1, 0)} Déf`;
    case 'Dragonkin': return `+${pct((e?.statMultipliers?.hp || 1) - 1, 0)} PV max, +${pct((e?.statMultipliers?.rescap || 1) - 1, 0)} ResC, +${pct(e?.damageStackBonus, 0)} dégâts infligés par dégât reçu`;
    case 'Mort-vivant': return `Première mort: explosion ${pct(e?.explosionPercent, 0)} PV max + résurrection ${pct(e?.revivePercent, 0)} PV max`;
    case 'Lycan': return `Chaque auto: +${e?.bleedStacksPerHit || 0} stack de saignement (${pct(e?.bleedPercentPerStack, 1)} PV max par tour)`;
    case 'Sylvari': return `Regen ${pct(e?.regenPercent, 1)} PV max/tour, +${pct(e?.highHpDamageBonus, 0)} dégâts si PV > ${(Number(e?.highHpThreshold || 0) * 100).toFixed(0)}%`;
    case 'Sirène': return `+${e?.statBonuses?.cap || 0} CAP, stacks à +${pct(e?.sireneStackBonus, 0)} dégâts/soins des capacités (max ${e?.sireneMaxStacks || 0})`;
    case 'Gnome': return `+${pct((e?.statMultipliers?.spd || 1) - 1, 0)} VIT, +${pct((e?.statMultipliers?.cap || 1) - 1, 0)} CAP\nVIT > cible: +${pct(e?.speedDuelCritHigh, 0)} crit, +${pct(e?.speedDuelCritDmgHigh, 0)} dégâts crit\nVIT < cible: +${pct(e?.speedDuelDodgeLow, 0)} esquive, +${pct(e?.speedDuelCapBonusLow, 0)} CAP\nÉgalité: +${pct(e?.speedDuelEqualCrit, 0)} crit/dégâts crit, +${pct(e?.speedDuelEqualDodge, 0)} esquive/CAP`;
    case 'Mindflayer': return `Vole et relance le premier sort lancé par l'ennemi et ajoute ${pct(e?.mindflayerStealSpellCapDamageScale, 0)} de votre CAP aux dégâts\nPremier sort: -${e?.mindflayerOwnCooldownReductionTurns || 0} de CD\nSort sans CD: +${pct(e?.mindflayerNoCooldownSpellBonus, 0)} dégâts`;
    default: return races[raceName]?.awakening?.description || '';
  }
};

// ============================================================================
// DESCRIPTIONS DE CLASSES
// ============================================================================

export const buildClassDescription = (className, constants = null) => {
  const c = constants || classConstants[CLASS_TO_CONSTANT_KEY[className]] || {};
  switch (className) {
    case 'Guerrier': return `Frappe la résistance la plus faible. Ignore ${(c.ignoreBase || 0) * 100}% de la résistance ennemie + ${(c.ignorePerCap || 0) * 100}% de votre Cap. Gagne +${c.autoBonus || 0} ATK.`;
    case 'Voleur': return `Esquive la prochaine attaque. Gagne +${c.spdBonus || 0} VIT et +${((c.critPerCap || 0) * 100).toFixed(1)}% de votre Cap en chance de critique.`;
    case 'Paladin': return `Renvoie ${(c.reflectBase || 0) * 100}% des dégâts reçus + ${(c.reflectPerCap || 0) * 100}% de votre Cap.`;
    case 'Healer': return `Soigne ${(c.missingHpPercent || 0) * 100}% des PV manquants + ${(c.capScale || 0) * 100}% de votre Cap.`;
    case 'Archer': return `Deux tirs : le premier inflige 100% de votre attaque. Le second inflige ${(c.hit2AutoMultiplier || 0) * 100}% de votre attaque + ${(c.hit2CapMultiplier || 0) * 100}% de votre Cap (opposé à la RésCap).`;
    case 'Mage': return `Inflige votre attaque de base + ${(c.capBase || 0) * 100}% de votre Cap (vs RésCap).`;
    case 'Demoniste': return `Chaque tour, votre familier inflige ${(c.capBase || 0) * 100}% de votre Cap et ignore ${(c.ignoreResist || 0) * 100}% de la RésCap ennemie. Chaque auto augmente ces dégâts de ${(c.stackPerAuto || 0) * 100}% de Cap (cumulable).`;
    case 'Masochiste': return `Renvoie ${(c.returnBase || 0) * 100}% des dégâts accumulés + ${(c.returnPerCap || 0) * 100}% de votre Cap. Se soigne de ${(c.healPercent || 0) * 100}% des dégâts accumulés.`;
    case 'Briseur de Sort': return `Après avoir subi un spell, gagne un bouclier égal à ${(c.shieldFromSpellDamage || 0) * 100}% des dégâts reçus + ${(c.shieldFromCap || 0) * 100}% de votre CAP. Réduit les soins adverses de ${(c.antiHealReduction || 0) * 100}%. Auto + ${(c.autoCapBonus || 0) * 100}% CAP.`;
    case 'Succube': return `Inflige auto + ${(c.capScale || 0) * 100}% CAP. La prochaine attaque adverse inflige -${(c.nextAttackReduction || 0) * 100}% dégâts.`;
    case 'Bastion': return `Début du combat: bouclier = ${(c.startShieldFromDef || 0) * 100}% DEF. Passif: +${(c.defPercentBonus || 0) * 100}% DEF. Inflige auto + ${(c.capScale || 0) * 100}% CAP + ${(c.defScale || 0) * 100}% DEF.`;
    default: return classes[className]?.description || '';
  }
};

// ============================================================================
// RACCOURCIS — lire directement depuis les constantes live
// ============================================================================

/** Retourne la description du bonus racial en lisant les constantes live */
export const getRaceBonusText = (raceName) => buildRaceBonusDescription(raceName);

/** Retourne la description de la classe en lisant les constantes live */
export const getClassDescriptionText = (className) => buildClassDescription(className);
