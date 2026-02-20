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
    case 'Gnome': return `+${pct((e?.statMultipliers?.spd || 1) - 1, 0)} VIT, +${pct((e?.statMultipliers?.cap || 1) - 1, 0)} CAP\nVIT > cible: +${pct(e?.speedDuelCritHigh, 0)} crit, +${pct(e?.speedDuelCritDmgHigh, 0)} dégâts crit\nVIT < cible: +${pct(e?.speedDuelDodgeLow, 0)} esquive, +${pct(e?.speedDuelCapBonusLow ?? e?.speedDuelCapBonusHigh, 0)} CAP\nÉgalité: +${pct(e?.speedDuelEqualCrit, 0)} crit/dégâts crit, +${pct(e?.speedDuelEqualDodge, 0)} esquive/CAP`;
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

// ============================================================================
// DESCRIPTIONS EN PARTIES (texte + slots éditables [valeur]) pour la page équilibrage
// Chaque slot a: path (clés dans le draft), format ('percent' = stocké 0.25 affiché 25, 'raw', 'percent1dec')
// ============================================================================

export const buildClassDescriptionParts = (className, constants = null) => {
  const key = CLASS_TO_CONSTANT_KEY[className];
  if (!key) return [{ type: 'text', value: classes[className]?.description || '' }];
  const c = constants || classConstants[key] || {};
  const slot = (path, format = 'raw') => ({ type: 'slot', path: [key, ...path], format });
  const text = (v) => ({ type: 'text', value: v });
  switch (className) {
    case 'Guerrier':
      return [
        text('Frappe la résistance la plus faible. Ignore '), slot(['ignoreBase'], 'percent'),
        text('% de la résistance ennemie + '), slot(['ignorePerCap'], 'percent'),
        text('% de votre Cap. Gagne +'), slot(['autoBonus'], 'raw'), text(' ATK.')
      ];
    case 'Voleur':
      return [
        text('Esquive la prochaine attaque. Gagne +'), slot(['spdBonus'], 'raw'),
        text(' VIT et +'), slot(['critPerCap'], 'percent1dec'),
        text('% de votre Cap en chance de critique.')
      ];
    case 'Paladin':
      return [
        text('Renvoie '), slot(['reflectBase'], 'percent'),
        text('% des dégâts reçus + '), slot(['reflectPerCap'], 'percent'),
        text('% de votre Cap.')
      ];
    case 'Healer':
      return [
        text('Soigne '), slot(['missingHpPercent'], 'percent'),
        text('% des PV manquants + '), slot(['capScale'], 'percent'),
        text('% de votre Cap.')
      ];
    case 'Archer':
      return [
        text('Deux tirs : le premier inflige 100% de votre attaque. Le second inflige '),
        slot(['hit2AutoMultiplier'], 'percent'), text('% de votre attaque + '),
        slot(['hit2CapMultiplier'], 'percent'), text('% de votre Cap (opposé à la RésCap).')
      ];
    case 'Mage':
      return [
        text('Inflige votre attaque de base + '), slot(['capBase'], 'percent'),
        text('% de votre Cap (vs RésCap).')
      ];
    case 'Demoniste':
      return [
        text('Chaque tour, votre familier inflige '), slot(['capBase'], 'percent'),
        text('% de votre Cap et ignore '), slot(['ignoreResist'], 'percent'),
        text('% de la RésCap ennemie. Chaque auto augmente ces dégâts de '),
        slot(['stackPerAuto'], 'percent'), text('% de Cap (cumulable).')
      ];
    case 'Masochiste':
      return [
        text('Renvoie '), slot(['returnBase'], 'percent'),
        text('% des dégâts accumulés + '), slot(['returnPerCap'], 'percent'),
        text('% de votre Cap. Se soigne de '), slot(['healPercent'], 'percent'),
        text('% des dégâts accumulés.')
      ];
    case 'Briseur de Sort':
      return [
        text('Après avoir subi un spell, gagne un bouclier égal à '), slot(['shieldFromSpellDamage'], 'percent'),
        text('% des dégâts reçus + '), slot(['shieldFromCap'], 'percent'),
        text('% de votre CAP. Réduit les soins adverses de '), slot(['antiHealReduction'], 'percent'),
        text('%. Auto + '), slot(['autoCapBonus'], 'percent'), text('% CAP.')
      ];
    case 'Succube':
      return [
        text('Inflige auto + '), slot(['capScale'], 'percent'),
        text('% CAP. La prochaine attaque adverse inflige -'), slot(['nextAttackReduction'], 'percent'),
        text('% dégâts.')
      ];
    case 'Bastion':
      return [
        text('Début du combat: bouclier = '), slot(['startShieldFromDef'], 'percent'),
        text('% DEF. Passif: +'), slot(['defPercentBonus'], 'percent'),
        text('% DEF. Inflige auto + '), slot(['capScale'], 'percent'),
        text('% CAP + '), slot(['defScale'], 'percent'), text('% DEF.')
      ];
    default:
      return [{ type: 'text', value: buildClassDescription(className, c) }];
  }
};

export const buildRaceBonusDescriptionParts = (raceName, constants = null) => {
  const key = RACE_TO_CONSTANT_KEY[raceName];
  if (!key) return [{ type: 'text', value: races[raceName]?.bonus || '' }];
  const c = constants || raceConstants[key] || {};
  const slot = (path, format = 'raw') => ({ type: 'slot', path: [key, ...path], format });
  const text = (v) => ({ type: 'text', value: v });
  switch (raceName) {
    case 'Humain':
      return [text('+'), slot(['hp'], 'raw'), text(' PV & +'), slot(['auto'], 'raw'), text(' toutes stats')];
    case 'Elfe':
      return [
        text('+'), slot(['auto'], 'raw'), text(' AUTO, +'), slot(['cap'], 'raw'), text(' CAP, +'), slot(['spd'], 'raw'),
        text(' VIT, +'), slot(['critBonus'], 'percent'), text(' crit')
      ];
    case 'Orc':
      return [
        text('Sous '), slot(['lowHpThreshold'], 'percent'),
        text('% PV: +'), slot(['damageBonus'], 'percentMinus1'),
        text('% dégâts')
      ];
    case 'Nain':
      return [text('+'), slot(['hp'], 'raw'), text(' PV & +'), slot(['def'], 'raw'), text(' Déf')];
    case 'Dragonkin':
      return [text('+'), slot(['hp'], 'raw'), text(' PV & +'), slot(['rescap'], 'raw'), text(' ResC')];
    case 'Mort-vivant':
      return [text('Revient à '), slot(['revivePercent'], 'percent'), text(' PV (1x)')];
    case 'Lycan':
      return [text('Attaque inflige saignement +'), slot(['bleedPerHit'], 'raw'), text(' de dégât/tour')];
    case 'Sylvari':
      return [text('Regen '), slot(['regenPercent'], 'percent1dec'), text(' PV max/tour')];
    case 'Sirène':
      return [
        text('+'), slot(['cap'], 'raw'), text(' CAP, subit un spell: +'), slot(['stackBonus'], 'percent'),
        text(' dégâts/soins des capacités (max '), slot(['maxStacks'], 'raw'), text(' stacks)')
      ];
    case 'Gnome':
      return [
        text('+'), slot(['spd'], 'raw'), text(' VIT, +'), slot(['cap'], 'raw'), text(' CAP\nVIT > cible: +'),
        slot(['critIfFaster'], 'percent'), text(' crit, +'), slot(['critDmgIfFaster'], 'percent'), text(' dégâts crit\nVIT < cible: +'),
        slot(['dodgeIfSlower'], 'percent'), text(' esquive, +'), slot(['capBonusIfSlower'], 'percent'), text(' CAP\nÉgalité: +'),
        slot(['critIfEqual'], 'percent'), text(' crit/dégâts crit, +'), slot(['dodgeIfEqual'], 'percent'), text(' esquive/CAP')
      ];
    case 'Mindflayer':
      return [
        text("Vole et relance le premier sort lancé par l'ennemi et ajoute "), slot(['stealSpellCapDamageScale'], 'percent'),
        text(" de votre CAP aux dégâts\nSort sans CD: +"), slot(['noCooldownSpellBonus'], 'percent'), text(' dégâts')
      ];
    default:
      return [{ type: 'text', value: buildRaceBonusDescription(raceName, c) }];
  }
};

export const buildRaceAwakeningDescriptionParts = (raceName, effect = null) => {
  const e = effect || getAwakeningEffect(raceName);
  if (!e) return [{ type: 'text', value: races[raceName]?.awakening?.description || '' }];
  const slot = (path, format = 'raw') => ({ type: 'slot', path: [raceName, ...path], format });
  const text = (v) => ({ type: 'text', value: v });
  switch (raceName) {
    case 'Humain':
      return [text('+'), slot(['statMultipliers', 'hp'], 'percentMinus1'), text(' à toutes les stats')];
    case 'Elfe':
      return [
        text('+'), slot(['statMultipliers', 'auto'], 'percentMinus1'), text(' Auto, +'), slot(['statMultipliers', 'cap'], 'percentMinus1'),
        text(' Cap, +'), slot(['statBonuses', 'spd'], 'raw'), text(' VIT, +'), slot(['critChanceBonus'], 'percent'),
        text(' crit, +'), slot(['critDamageBonus'], 'percent'), text(' dégâts crit')
      ];
    case 'Orc':
      return [
        text('- Sous 50% PV: +22% dégâts\n- Les '), slot(['incomingHitCount'], 'raw'),
        text(' premières attaques subies infligent '), slot(['incomingHitMultiplier'], 'percent'), text('% dégâts')
      ];
    case 'Nain':
      return [
        text('+'), slot(['statMultipliers', 'hp'], 'percentMinus1'), text(' PV max, +'),
        slot(['statMultipliers', 'def'], 'percentMinus1'), text(' Déf')
      ];
    case 'Dragonkin':
      return [
        text('+'), slot(['statMultipliers', 'hp'], 'percentMinus1'), text(' PV max, +'),
        slot(['statMultipliers', 'rescap'], 'percentMinus1'), text(' ResC, +'), slot(['damageStackBonus'], 'percent'),
        text(' dégâts infligés par dégât reçu')
      ];
    case 'Mort-vivant':
      return [
        text('Première mort: explosion '), slot(['explosionPercent'], 'percent'),
        text(' PV max + résurrection '), slot(['revivePercent'], 'percent'), text(' PV max')
      ];
    case 'Lycan':
      return [
        text('Chaque auto: +'), slot(['bleedStacksPerHit'], 'raw'),
        text(' stack de saignement ('), slot(['bleedPercentPerStack'], 'percent1dec'), text(' PV max par tour)')
      ];
    case 'Sylvari':
      return [
        text('Regen '), slot(['regenPercent'], 'percent1dec'),
        text(' PV max/tour, +'), slot(['highHpDamageBonus'], 'percent'),
        text(' dégâts si PV > '), slot(['highHpThreshold'], 'percent'), text('%')
      ];
    case 'Sirène':
      return [
        text('+'), slot(['statBonuses', 'cap'], 'raw'), text(' CAP, stacks à +'), slot(['sireneStackBonus'], 'percent'),
        text(' dégâts/soins des capacités (max '), slot(['sireneMaxStacks'], 'raw'), text(')')
      ];
    case 'Gnome':
      return [
        text('+'), slot(['statMultipliers', 'spd'], 'percentMinus1'), text(' VIT, +'), slot(['statMultipliers', 'cap'], 'percentMinus1'),
        text(' CAP\nVIT > cible: +'), slot(['speedDuelCritHigh'], 'percent'), text(' crit, +'), slot(['speedDuelCritDmgHigh'], 'percent'),
        text(' dégâts crit\nVIT < cible: +'), slot(['speedDuelDodgeLow'], 'percent'), text(' esquive, +'), slot(['speedDuelCapBonusLow'], 'percent'),
        text(' CAP\nÉgalité: +'), slot(['speedDuelEqualCrit'], 'percent'), text(' crit/dégâts crit, +'), slot(['speedDuelEqualDodge'], 'percent'), text(' esquive/CAP')
      ];
    case 'Mindflayer':
      return [
        text("Vole et relance le premier sort lancé par l'ennemi et ajoute "), slot(['mindflayerStealSpellCapDamageScale'], 'percent'),
        text(" de votre CAP aux dégâts\nPremier sort: -"), slot(['mindflayerOwnCooldownReductionTurns'], 'raw'),
        text(' de CD\nSort sans CD: +'), slot(['mindflayerNoCooldownSpellBonus'], 'percent'), text(' dégâts')
      ];
    default:
      return [{ type: 'text', value: buildRaceAwakeningDescription(raceName, e) }];
  }
};
