// Génération dynamique des descriptions de races et classes
// basée sur les constantes de combatMechanics.js (modifiables via /admin/balance)

import { raceConstants, classConstants, getSubclassCapacityConstants } from '../data/combatMechanics';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { getAwakeningEffect } from './awakening';
import { getCoopRaceEchoAwakeningFragment, COOP_MINDFLAYER_ECHO_COPY_DAMAGE_MULT } from './coopRaceEcho.js';

const pct = (v, digits = 0) => `${(Number(v || 0) * 100).toFixed(digits)}%`;
const pct1 = (v) => `${(Number(v || 0) * 100).toFixed(1).replace('.', ',')}%`;

/** Découpe une description en lignes (un effet par ligne). Gère \n, " - ", ", ", " & ". */
export const splitDescriptionLines = (text) => {
  if (!text) return [];
  return text
    .split('\n')
    .flatMap((chunk) => chunk.split(' - '))
    .flatMap((chunk) => chunk.split(', '))
    .flatMap((chunk) => chunk.split(' & '))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith('-') ? line.replace(/^-\s*/, '') : line));
};

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
  'Mindflayer': 'mindflayer',
  'Turtlekin': 'turtlekin'
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
  'Bastion': 'bastion',
  'Alchimiste': 'alchimiste',
  'Sorcière': 'sorciere',
  'Berserk': 'berserk'
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
    case 'Lycan': return c.bleedPercentPerStack != null
    ? `Attaque applique +${c.bleedPerHit || 0} stack de saignement (${pct1(c.bleedPercentPerStack)} PV max par stack au début de son tour)`
    : `Attaque applique +${c.bleedPerHit || 0} stack de saignement (dégâts = ceil(stacks/${c.bleedDivisor || 1}) par tour)`;
    case 'Sylvari': return `Regen ${pct(c.regenPercent, 1)} PV max/tour`;
    case 'Sirène': return `+${c.cap || 0} CAP, subit une capacité: +${pct(c.stackBonus, 0)} dégâts/soins de vos compétences (max ${c.maxStacks || 0} stacks)`;
    case 'Gnome': return `+${c.spd || 0} VIT, +${c.cap || 0} CAP\nVIT > cible: +${pct(c.critIfFaster, 0)} crit, +${pct(c.critDmgIfFaster, 0)} dégâts crit\nVIT < cible: +${pct(c.dodgeIfSlower, 0)} esquive, +${pct(c.capBonusIfSlower, 0)} CAP\nÉgalité: +${pct(c.critIfEqual, 0)} crit/dégâts crit, +${pct(c.dodgeIfEqual, 0)} esquive/CAP`;
    case 'Mindflayer': return `Copie et relance la première capacité reçue et ajoute ${pct(c.stealSpellCapDamageScale, 0)} de votre CAP aux dégâts`;
    case 'Turtlekin': return `Le premier coup reçu ne peut dépasser ${pct(c.firstHitCapPercent, 0)} de vos PV max`;
    default: return races[raceName]?.bonus || '';
  }
};

export const buildRaceAwakeningDescription = (raceName, effect = null) => {
  const e = effect || getAwakeningEffect(raceName);
  if (!e) return races[raceName]?.awakening?.description || '';
  switch (raceName) {
    case 'Humain': return `+${pct((e?.statMultipliers?.hp || 1) - 1, 0)} à toutes les stats`;
    case 'Elfe': return `+${pct((e?.statMultipliers?.auto || 1) - 1, 0)} Auto, +${pct((e?.statMultipliers?.cap || 1) - 1, 0)} Cap, +${e?.statBonuses?.spd || 0} VIT, +${pct(e?.critChanceBonus, 0)} crit, +${pct(e?.critDamageBonus, 0)} dégâts crit`;
    case 'Orc': return `Sous 50% PV: +${pct((e?.damageBonus || 1) - 1, 0)} dégâts\nLes ${e?.incomingHitCount || 0} premières attaques subies infligent ${(Number(e?.incomingHitMultiplier || 1) * 100).toFixed(0)}% dégâts`;
    case 'Nain': return `+${pct((e?.statMultipliers?.hp || 1) - 1, 0)} PV max\n+${pct((e?.statMultipliers?.def || 1) - 1, 0)} Déf\nSubit -${pct(1 - (e?.damageTakenMultiplier ?? 1), 0)}% de dégâts`;
    case 'Dragonkin': return `+${pct((e?.statMultipliers?.hp || 1) - 1, 0)} PV max\n+${pct((e?.statMultipliers?.rescap || 1) - 1, 0)} ResC\n+${pct(e?.damageStackBonus, 0)} dégâts infligés par dégât reçu`;
    case 'Mort-vivant': return `Première mort: explosion ${pct(e?.explosionPercent, 0)} PV max + résurrection ${pct(e?.revivePercent, 0)} PV max`;
    case 'Lycan': return `Chaque auto: +${e?.bleedStacksPerHit || 0} stack de saignement (${pct(e?.bleedPercentPerStack, 1)} PV max par tour)`;
    case 'Sylvari': return `Regen ${pct(e?.regenPercent, 1)} PV max/tour\n+${pct(e?.highHpDamageBonus, 0)} dégâts si PV > ${(Number(e?.highHpThreshold || 0) * 100).toFixed(0)}%`;
    case 'Sirène': return `+${e?.statBonuses?.cap || 0} CAP\nStacks à +${pct(e?.sireneStackBonus, 0)} dégâts/soins de vos compétences (max ${e?.sireneMaxStacks || 0})`;
    case 'Gnome': return `+${pct((e?.statMultipliers?.spd || 1) - 1, 0)} VIT, +${pct((e?.statMultipliers?.cap || 1) - 1, 0)} CAP\nVIT > cible: +${pct(e?.speedDuelCritHigh, 0)} crit, +${pct(e?.speedDuelCritDmgHigh, 0)} dégâts crit\nVIT < cible: +${pct(e?.speedDuelDodgeLow, 0)} esquive, +${pct(e?.speedDuelCapBonusLow ?? e?.speedDuelCapBonusHigh, 0)} CAP\nÉgalité: +${pct(e?.speedDuelEqualCrit, 0)} crit/dégâts crit, +${pct(e?.speedDuelEqualDodge, 0)} esquive/CAP`;
    case 'Mindflayer': return `Copie et relance la première capacité reçue et ajoute ${pct(e?.mindflayerStealSpellCapDamageScale, 0)} de votre CAP aux dégâts\nPremière capacité: -${e?.mindflayerOwnCooldownReductionTurns || 0} de CD\nSi cette première capacité est sans CD: +${pct(e?.mindflayerNoCooldownSpellBonus, 0)} dégâts`;
    case 'Turtlekin': return `+${pct((e?.statMultipliers?.def || 1) - 1, 0)} DEF, +${pct((e?.statMultipliers?.rescap || 1) - 1, 0)} ResC\nLe premier coup reçu ne peut dépasser ${pct(raceConstants.turtlekin.firstHitCapPercent, 0)} de vos PV max.\nSe réinitialise quand vous atteignez 50% PV pour la première fois.`;
    default: return races[raceName]?.awakening?.description || '';
  }
};

/**
 * Effet d’éveil fusionné via le Pointeau ADN (donjon Red coop) : même logique que le combat,
 * valeurs issues de {@link getCoopRaceEchoAwakeningFragment}.
 */
export const buildRacePointeauAdnDescription = (raceName) => {
  const e = getCoopRaceEchoAwakeningFragment(raceName);
  if (!e) return '—';

  if (raceName === 'Mindflayer') {
    return `Copie du sort : dégâts et soins à ${pct(COOP_MINDFLAYER_ECHO_COPY_DAMAGE_MULT, 0)} de la valeur « pleine ». Scaling CAP sur la copie : 0 % (règle Pointeau ADN).`;
  }

  if (raceName === 'Turtlekin') {
    const capP = e.turtlekinFirstHitCapPercent ?? 0.2;
    return `+${pct((e?.statMultipliers?.def || 1) - 1, 0)} DEF, +${pct((e?.statMultipliers?.rescap || 1) - 1, 0)} ResC\nLe premier coup reçu ne peut dépasser ${pct(capP, 0)} de vos PV max.\nSe réinitialise quand vous atteignez 50 % PV pour la première fois.`;
  }

  return buildRaceAwakeningDescription(raceName, e);
};

/** Libellé court d'intensité pour le Pointeau ADN. */
export const getPointeauAdnIntensityLabel = () =>
  `Fragment d’éveil racial`;

// ============================================================================
// DESCRIPTIONS DE CLASSES
// ============================================================================

export const buildClassDescription = (className, constants = null) => {
  const c = constants || classConstants[CLASS_TO_CONSTANT_KEY[className]] || {};
  switch (className) {
    case 'Guerrier': return `Frappe la résistance la plus faible. Ignore ${(c.ignoreBase || 0) * 100}% de la résistance ennemie + ${(c.ignorePerCap || 0) * 100}% de votre Cap. Gagne +${c.autoBonus || 0} Auto.`;
    case 'Voleur': return `Esquive la prochaine attaque. Gagne +${c.spdBonus || 0} VIT et +${((c.critPerCap || 0) * 100).toFixed(1)}% de votre Cap en chance de critique.`;
    case 'Paladin': return `Renvoie ${(c.reflectBase || 0) * 100}% des dégâts reçus + ${(c.reflectPerCap || 0) * 100}% de votre Cap.`;
    case 'Healer': return `Soigne ${(c.missingHpPercent || 0) * 100}% des PV manquants + ${(c.capScale || 0) * 100}% de votre Cap.`;
    case 'Archer': return `Deux tirs : le premier inflige 100% de votre attaque. Le second inflige ${(c.hit2AutoMultiplier || 0) * 100}% de votre attaque + ${(c.hit2CapMultiplier || 0) * 100}% de votre Cap.`;
    case 'Mage': return `Inflige votre attaque de base + ${(c.capBase || 0) * 100}% de votre Cap.`;
    case 'Demoniste': return `Chaque tour, votre familier inflige ${(c.capBase || 0) * 100}% de votre Cap et ignore ${(c.ignoreResist || 0) * 100}% de la RésCap ennemie. Chaque auto augmente ces dégâts de ${(c.stackPerAuto || 0) * 100}% de Cap (cumulable).`;
    case 'Masochiste': return `Renvoie ${(c.returnBase || 0) * 100}% des dégâts accumulés + ${(c.returnPerCap || 0) * 100}% de votre Cap. Se soigne de ${(c.healPercent || 0) * 100}% des dégâts accumulés.`;
    case 'Briseur de Sort': return `Après avoir subi une capacité, gagne un bouclier égal à ${(c.shieldFromSpellDamage || 0) * 100}% des dégâts reçus + ${(c.shieldFromCap || 0) * 100}% de votre CAP. Réduit les soins adverses de ${(c.antiHealReduction || 0) * 100}%. Auto + ${(c.autoCapBonus || 0) * 100}% CAP.`;
    case 'Succube': return `Inflige auto + ${(c.capScale || 0) * 100}% CAP. La prochaine attaque adverse inflige -${(c.nextAttackReduction || 0) * 100}% dégâts.`;
    case 'Bastion': return `Début du combat: bouclier = ${(c.startShieldFromDef || 0) * 100}% DEF. Passif: +${(c.defPercentBonus || 0) * 100}% DEF. Inflige auto + ${(c.capScale || 0) * 100}% CAP + ${(c.defScale || 0) * 100}% DEF.`;
    case 'Alchimiste': return `Cycle de ${c.cycleLength || 3} flasques :\n- Feu : Auto + ${(c.fireCapScale || 0) * 100}% CAP\n- Vie : soin ${(c.lifeCapScale || 0) * 100}% de votre CAP\n- Acide : Auto + réduit DEF ${(c.acidDefReduction || 0) * 100}% / ResC ${(c.acidRescReduction || 0) * 100}%`;
    case 'Sorcière': return `Malédiction : −${(c.curseStatReduction || 0) * 100}% d'une stat adverse au hasard (cumul sur la valeur courante). Dégâts : attaque de base + ${(c.capBase || 0) * 100}% Cap + points de stats retirés à l'ennemi (toutes sources).`;
    case 'Berserk': return `Rage : consomme ${(c.rageHpCostPercent || 0) * 100}% de vos PV max (ne peut pas vous tuer). Inflige votre Auto + ${(c.rageMissingHpDamageScale || 0) * 100}% des PV manquants (après ce coût).`;
    default: return classes[className]?.description || '';
  }
};

// ============================================================================
// DESCRIPTIONS DE SOUS-CLASSES (valeurs réelles depuis config d'équilibrage)
// ============================================================================

/**
 * Construit la description d'une sous-classe avec les valeurs réelles (classConstants + subclassConstants).
 * @param {string} className - Nom de la classe (ex. 'Demoniste')
 * @param {string} subclassId - ID de la sous-classe (ex. 'pacte_sombre')
 * @param {Object|null} constants - Constantes fusionnées (si null, utilise getSubclassCapacityConstants)
 * @returns {string}
 */
export const buildSubclassDescription = (className, subclassId, constants = null) => {
  const c = constants || getSubclassCapacityConstants(className, subclassId);
  const pct0 = (v) => `${(Number(v || 0) * 100).toFixed(0)}%`;
  switch (subclassId) {
    case 'maitre_armes':
      return `Ignore totalement la def/resC et inflige Auto + ${pct0(c.capScale)} CAP.`;
    case 'duracier':
      return `Frappe la résistance la plus faible. Ignore ${pct0(c.ignoreBase)} de la résistance ennemie + ${pct1(c.ignorePerCap)} de votre Cap. Gagne un bouclier de ${pct0(c.shieldAutoPercent)} Auto + ${pct1(c.shieldCapPercent)} CAP.`;
    case 'croise_lumineux':
      return `Renvoie ${pct0(c.reflectBase)} des dégâts reçus + ${pct1(c.reflectPerCap)} de votre Cap. Réduit les dégâts de la prochaine attaque ennemie de ${pct0(c.nextAttackReduction)}.`;
    case 'juge_implacable':
      return `Renvoie ${pct0(c.reflectBase)} des dégâts reçus + ${pct1(c.reflectPerCap)} de votre Cap. Réduit de ${pct0(c.defReductionStack)} la DEF ennemie (stackable).`;
    case 'sniper':
      return `Deux tirs : 100% Auto puis ${(Number(c.hit2AutoMultiplier || 0) * 100).toFixed(0)}% Auto + ${pct0(c.hit2CapMultiplier)} Cap.`;
    case 'chasseur_fantome':
      return `Après un crit, les prochains dégâts gagnent +${pct0(c.ghostHunterCapBonus)} CAP. Deux tirs : 100% Auto puis ${(Number(c.hit2AutoMultiplier || 0) * 100).toFixed(0)}% Auto + ${pct0(c.hit2CapMultiplier)} Cap.`;
    case 'arcaniste_instable':
      return `Inflige Auto + ${pct0(c.capBase)} Cap. Applique débuff : +${pct0(c.damageTakenStack)} dégâts subis par l'ennemi (stackable).`;
    case 'sorcier_neant':
      return `Inflige Auto + ${pct0(c.capBase)} Cap. Brûlure du Néant : l'ennemi inflige -10% dégâts Auto et perd 2% de ses PV actuels par tour.`;
    case 'maitre_invocateur':
      return `Chaque tour, familier inflige ${pct0(c.capBase)} Cap et ignore ${pct0(c.ignoreResist)} RésCap. Chaque auto augmente ces dégâts de ${pct1(c.stackPerAuto)} Cap (cumulable).`;
    case 'pacte_sombre':
      return `Chaque tour, familier inflige ${pct0(c.capBase)} Cap et ignore ${pct0(c.ignoreResist)} RésCap. Chaque auto +${pct1(c.stackPerAuto)} Cap (cumulable) et vole ${pct0(c.capStealPercent)} de la CAP ennemi.`;
    case 'stratege_arcanique':
      return `Après une capacité subie : bouclier ${pct0(c.shieldFromSpellDamage)} dégâts + ${pct0(c.shieldFromCap)} CAP. Réduction des dégâts du prochain sort de ${pct0(c.nextSpellReduction)} (un sort sur deux, sans cumul). Réduit les soins adverses de ${pct0(c.antiHealReduction)}. Auto + ${pct0(c.autoCapBonus)} CAP.`;
    case 'mentaliste':
      return `Après une capacité subie : bouclier ${pct0(c.shieldFromSpellDamage)} dégâts + ${pct0(c.shieldFromCap)} CAP, augmente votre DEF de ${pct0(c.defBonusStack)} (stackable). Réduit les soins adverses de ${pct0(c.antiHealReduction)}. Auto + ${pct0(c.autoCapBonus)} CAP.`;
    case 'dompteuse_chair':
      return `Inflige Auto + ${pct0(c.capScale)} CAP. La prochaine attaque adverse inflige -${pct0(c.nextAttackReduction)} dégâts et réduit l'Auto ennemi de ${pct0(c.autoReductionStack)} (stackable).`;
    case 'ame_tentatrice':
      return `Inflige Auto + ${pct0(c.capScale)} CAP. La prochaine attaque adverse inflige -${pct0(c.nextAttackReduction)} dégâts. Cette capacité crit une fois sur deux (si le précédent n'a pas crit, le prochain crit obligatoire).`;
    case 'rempart_fer':
      return `Passif classe Bastion : +${pct0(classConstants.bastion.defPercentBonus)} DEF. Début du combat : bouclier = ${pct0(c.startShieldFromDef)} DEF. Inflige Auto + ${pct0(c.capScale)} CAP + ${pct0(c.defScale)} DEF.`;
    case 'mur_implacable':
      return `Passif classe Bastion : +${pct0(classConstants.bastion.defPercentBonus)} DEF. Début du combat : bouclier = ${pct0(c.startShieldFromDef)} DEF. Vous attaquez en premier le tour de la capacité. Inflige Auto + ${pct0(c.capScale)} CAP + ${pct0(c.defScale)} DEF.`;
    case 'flagellant_sanglant':
      return `Renvoie ${pct0(c.returnBase)} dégâts accumulés + ${pct1(c.returnPerCap)} Cap. Soigne ${pct0(c.healPercent)} des dégâts accumulés. Réduit votre DEF de ${pct0(1 - (c.defMultiplier ?? 1))} mais augmente votre Auto de ${pct0((c.autoMultiplier ?? 1) - 1)} pour le reste du combat.`;
    case 'ecorche_fer':
      return `Renvoie ${pct0(c.returnBase)} dégâts accumulés + ${pct1(c.returnPerCap)} Cap. Soigne ${pct0(c.healPercent)} des dégâts accumulés. Chaque Purge augmente votre DEF et ResC de ${pct0(c.defRescapStack)}.`;
    case 'assassin':
      return `Esquive la prochaine attaque. Gagne +${c.spdBonus ?? 0} VIT et +${pct1(c.critPerCap)} Cap en chance de critique. Prochaine attaque critique garantie.`;
    case 'roublard':
      return `Esquive la prochaine attaque. Gagne +${c.spdBonus ?? 0} VIT et +${pct1(c.critPerCap)} Cap en critique. Vole 8% d'une stat ennemie aléatoire (jusqu'au prochain proc, pas stackable).`;
    case 'luxum':
      return `Soigne ${pct0(c.missingHpPercent)} des PV manquants + ${pct0(c.capScale)} Cap. À chaque lancement : gain d'un bouclier égal à ${pct0(c.capShieldPercent)} de votre CAP. Convertit l'overheal en bouclier.`;
    case 'latum':
      return `Inflige ${pct0(c.missingHpDamagePercent)} des PV manquants en dégâts à l'ennemi, puis soigne ${pct0(c.missingHpPercent)} des PV manquants + ${pct0(c.capScale)} Cap.`;

    case 'maitre_alchimiste': {
      return `Cycle complet (1 flasque par tour, en boucle) : Feu → Vie → Acide → Feu…\n- Feu : Auto + ${pct0(c.fireCapScale)} CAP\n- Vie : soin ${pct0(c.lifeCapScale)} de votre CAP\n- Acide : Auto et réduit DEF de ${pct0(c.acidDefReduction)} / ResC de ${pct0(c.acidRescReduction)}`;
    }

    case 'alchimiste_metal': {
      const stun = c.metalStunDuration ?? classConstants.alchimiste.metalStunDuration;
      return `Cycle complet (1 flasque par tour, en boucle) : Feu → Vie → Acide → Métal → Feu…\n- Feu : Auto + ${pct0(c.fireCapScale)} CAP\n- Vie : soin ${pct0(c.lifeCapScale)} de votre CAP\n- Acide : Auto et réduit DEF de ${pct0(c.acidDefReduction)} / ResC de ${pct0(c.acidRescReduction)}\n- Métal : Auto et étourdit ${stun} tour`;
    }
    case 'hexe_noire':
      return `Début de combat : −${pct0(c.curseStatReduction ?? classConstants.sorciere.curseStatReduction)} sur une stat adverse aléatoire. Malédiction (CD 3) : −${pct0(c.curseStatReduction ?? classConstants.sorciere.curseStatReduction)} ; total dégâts (Auto + ${pct0(c.capBase ?? classConstants.sorciere.capBase)} Cap + points de stats retirés).`;
    case 'enchanteresse':
      return `Malédiction : −${pct0(c.curseStatReduction)} ; total dégâts (Auto + ${pct0(c.capBase)} Cap + points de stats retirés).`;
    case 'boucher':
      return `Rage : coût ${pct0(c.rageHpCostPercent ?? classConstants.berserk.rageHpCostPercent)} PV max. Auto + ${pct0(c.rageMissingHpDamageScale)} des PV manquants (après coût).`;
    case 'brise_caves':
      return `Rage : coût ${pct0(c.rageHpCostPercent ?? classConstants.berserk.rageHpCostPercent)} PV max. Auto + ${pct0(c.rageMissingHpDamageScale ?? classConstants.berserk.rageMissingHpDamageScale)} des PV manquants. Prochaine auto +${pct0(classConstants.berserk.nextAutoDamageBonus)} dégâts.`;
    default:
      return '';
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
        text('% de votre Cap. Gagne +'), slot(['autoBonus'], 'raw'), text(' Auto.')
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
        slot(['hit2CapMultiplier'], 'percent'), text('% de votre Cap.')
      ];
    case 'Mage':
      return [
        text('Inflige votre attaque de base + '), slot(['capBase'], 'percent'),
        text('% de votre Cap.')
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
        text('Après avoir subi une capacité, gagne un bouclier égal à '), slot(['shieldFromSpellDamage'], 'percent'),
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
    case 'Alchimiste':
      return [
        text('Cycle de '), slot(['cycleLength'], 'raw'), text(' flasques :\n- Feu : Auto + '),
        slot(['fireCapScale'], 'percent'), text('% CAP\n- Vie : soin '),
        slot(['lifeCapScale'], 'percent'), text('% de votre CAP\n- Acide : Auto, réduit DEF '),
        slot(['acidDefReduction'], 'percent'), text('% / ResC '),
        slot(['acidRescReduction'], 'percent'), text('%')
      ];
    case 'Sorcière':
      return [
        text('Malédiction : −'), slot(['curseStatReduction'], 'percent'),
        text('% stat aléatoire (cumul). Attaque de base + '), slot(['capBase'], 'percent'),
        text('% Cap + points de stats retirés à l’ennemi.')
      ];
    case 'Berserk':
      return [
        text('Rage : '), slot(['rageHpCostPercent'], 'percent'),
        text('% PV max (ne peut pas tuer). Auto + '), slot(['rageMissingHpDamageScale'], 'percent'),
        text('% des PV manquants après le coût.')
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
      return [
        text('Attaque applique +'), slot(['bleedPerHit'], 'raw'),
        text(' stack de saignement ('), slot(['bleedPercentPerStack'], 'percent1dec'),
        text(' PV max par stack au début de son tour)')
      ];
    case 'Sylvari':
      return [text('Regen '), slot(['regenPercent'], 'percent1dec'), text(' PV max/tour')];
    case 'Sirène':
      return [
        text('+'), slot(['cap'], 'raw'), text(' CAP, subit une capacité: +'), slot(['stackBonus'], 'percent'),
        text(' dégâts/soins de vos compétences (max '), slot(['maxStacks'], 'raw'), text(' stacks)')
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
        text("Copie et relance la première capacité reçue et ajoute "), slot(['stealSpellCapDamageScale'], 'percent'),
        text(' de votre CAP aux dégâts')
      ];
    case 'Turtlekin':
      return [
        text('Le premier coup reçu ne peut dépasser '), slot(['firstHitCapPercent'], 'percent'),
        text(' de vos PV max')
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
        text('- Sous 50% PV: +'), slot(['damageBonus'], 'percentMinus1'),
        text('% dégâts\n- Les '), slot(['incomingHitCount'], 'raw'),
        text(' premières attaques subies infligent '), slot(['incomingHitMultiplier'], 'percent'), text('% dégâts')
      ];
    case 'Nain':
      return [
        text('+'), slot(['statMultipliers', 'hp'], 'percentMinus1'), text(' PV max\n+'),
        slot(['statMultipliers', 'def'], 'percentMinus1'), text(' Déf\nSubit -'), slot(['damageTakenMultiplier'], 'percentReduction'), text('% de dégâts')
      ];
    case 'Dragonkin':
      return [
        text('+'), slot(['statMultipliers', 'hp'], 'percentMinus1'), text(' PV max\n+'),
        slot(['statMultipliers', 'rescap'], 'percentMinus1'), text(' ResC\n+'), slot(['damageStackBonus'], 'percent'),
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
        text(' PV max/tour\n+'), slot(['highHpDamageBonus'], 'percent'),
        text(' dégâts si PV > '), slot(['highHpThreshold'], 'percent'), text('%')
      ];
    case 'Sirène':
      return [
        text('+'), slot(['statBonuses', 'cap'], 'raw'), text(' CAP\nStacks à +'), slot(['sireneStackBonus'], 'percent'),
        text(' dégâts/soins de vos compétences (max '), slot(['sireneMaxStacks'], 'raw'), text(')')
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
        text("Copie et relance la première capacité reçue et ajoute "), slot(['mindflayerStealSpellCapDamageScale'], 'percent'),
        text(" de votre CAP aux dégâts\nPremière capacité: -"), slot(['mindflayerOwnCooldownReductionTurns'], 'raw'),
        text(' de CD\nSi cette première capacité est sans CD: +'), slot(['mindflayerNoCooldownSpellBonus'], 'percent'), text(' dégâts')
      ];
    case 'Turtlekin':
      return [
        text('+'), slot(['statMultipliers', 'def'], 'percentMinus1'), text(' DEF, +'),
        slot(['statMultipliers', 'rescap'], 'percentMinus1'), text(' ResC\nLe premier coup reçu ne peut dépasser '),
        { type: 'slot', path: ['_bonus', 'turtlekin', 'firstHitCapPercent'], format: 'percent' },
        text(' de vos PV max.\nSe réinitialise quand vous atteignez 50% PV pour la première fois.')
      ];
    default:
      return [{ type: 'text', value: buildRaceAwakeningDescription(raceName, e) }];
  }
};
