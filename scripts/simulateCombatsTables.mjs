#!/usr/bin/env node
/**
 * Simulation (races/classes/sous-classes) + sortie en tableaux Markdown lisibles.
 *
 * Usage:
 *   node scripts/simulateCombatsTables.mjs [nombreCombats] [niveau]
 *
 * Exemple:
 *   node scripts/simulateCombatsTables.mjs 10000 400
 */

import { runSimulation } from '../src/utils/combatSimulation.js';
import { classConstants, raceConstants, getSubclassCapacityConstants } from '../src/data/combatMechanics.js';
import { SUBCLASSES_BY_CLASS } from '../src/data/subclasses.js';
import { races } from '../src/data/races.js';

const numCombats = Number.parseInt(process.argv[2], 10) || 10000;
const level = Number.parseInt(process.argv[3], 10) || 400;
const HIGH_THRESHOLD = 55;
const LOW_THRESHOLD = 45;

const { sortedRaces, sortedClasses, sortedSubclasses, avgTurns } = runSimulation(numCombats, level, { quiet: true });

const toPct = (s) => (typeof s === 'string' ? s : String(s));
const esc = (s) => String(s ?? '').replace(/\r?\n/g, '<br/>');
const asNumber = (v) => {
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
const isOutlier = (pct) => pct > HIGH_THRESHOLD || pct < LOW_THRESHOLD;

function printTable(title, headers, rows) {
  console.log(`\n## ${title}\n`);
  console.log(`- Combats: **${numCombats}** | Niveau: **${level}** | Durée moyenne: **${avgTurns} tours**\n`);
  console.log(`| ${headers.join(' | ')} |`);
  console.log(`| ${headers.map(() => '---').join(' | ')} |`);
  rows.forEach((r) => console.log(`| ${r.join(' | ')} |`));
}

const pct0 = (v) => `${Math.round(Number(v || 0) * 100)}%`;
const pct1 = (v) => `${(Number(v || 0) * 100).toFixed(1).replace('.', ',')}%`;

function buildRaceBonusDescription(raceName) {
  // mapping minimal (mêmes labels que l’app)
  const keyByRace = {
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
    'Turtlekin': 'turtlekin',
  };
  const c = raceConstants[keyByRace[raceName]] || {};
  switch (raceName) {
    case 'Humain': return `+${c.hp || 0} PV & +${c.auto || 0} toutes stats`;
    case 'Elfe': return `+${c.auto || 0} AUTO, +${c.cap || 0} CAP, +${c.spd || 0} VIT, +${pct0(c.critBonus)} crit`;
    case 'Orc': return `Sous ${pct0(c.lowHpThreshold)} PV: +${Math.round(((Number(c.damageBonus || 1) - 1) * 100))}% dégâts`;
    case 'Nain': return `+${c.hp || 0} PV & +${c.def || 0} Déf`;
    case 'Dragonkin': return `+${c.hp || 0} PV & +${c.rescap || 0} ResC`;
    case 'Mort-vivant': return `Revient à ${pct0(c.revivePercent)} PV (1x)`;
    case 'Lycan': return `Attaque applique +${c.bleedPerHit || 0} stack de saignement (${pct1(c.bleedPercentPerStack)} PV max par stack au début de son tour)`;
    case 'Sylvari': return `Regen ${pct1(c.regenPercent)} PV max/tour`;
    case 'Sirène': return `+${c.cap || 0} CAP, subit une capacité: +${pct0(c.stackBonus)} dégâts/soins de vos compétences (max ${c.maxStacks || 0} stacks)`;
    case 'Gnome':
      return `+${c.spd || 0} VIT, +${c.cap || 0} CAP<br/>VIT > cible: +${pct0(c.critIfFaster)} crit, +${pct0(c.critDmgIfFaster)} dégâts crit<br/>VIT < cible: +${pct0(c.dodgeIfSlower)} esquive, +${pct0(c.capBonusIfSlower)} CAP<br/>Égalité: +${pct0(c.critIfEqual)} crit/dégâts crit, +${pct0(c.dodgeIfEqual)} esquive/CAP`;
    case 'Mindflayer': return `Copie la première capacité reçue et ajoute ${pct0(c.stealSpellCapDamageScale)} de votre CAP aux dégâts`;
    case 'Turtlekin': return `Le premier coup reçu ne peut dépasser ${pct0(c.firstHitCapPercent)} de vos PV max`;
    case 'Écailleux':
    case 'Cendrés':
      // Textes plus “design” (et complets) dans races.js ; on les garde comme fallback lisible.
      return races?.[raceName]?.bonus || '';
    default:
      return races?.[raceName]?.bonus || '';
  }
}

function buildRaceFullDescriptionForLevel(raceName, levelValue) {
  const awakeningText = races?.[raceName]?.awakening?.description || '';
  const hasAwakening = levelValue >= (races?.[raceName]?.awakening?.levelRequired ?? Infinity);
  if (hasAwakening && awakeningText) {
    // À haut niveau: on affiche uniquement l’éveil (pas le passif de base).
    return `Éveil: ${awakeningText}`;
  }
  // Sinon (pas éveillé): on affiche uniquement le bonus de base.
  return buildRaceBonusDescription(raceName);
}

function buildClassDescription(className) {
  const keyByClass = {
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
  const c = classConstants[keyByClass[className]] || {};
  switch (className) {
    case 'Guerrier': return `Frappe la résistance la plus faible. Ignore ${pct0(c.ignoreBase)} de la résistance ennemie + ${pct0(c.ignorePerCap)} de votre Cap. Gagne +${c.autoBonus || 0} Auto.`;
    case 'Voleur': return `Esquive la prochaine attaque. Gagne +${c.spdBonus || 0} VIT et +${(Number(c.critPerCap || 0) * 100).toFixed(1).replace('.', ',')}% de votre Cap en chance de critique.`;
    case 'Paladin': return `Renvoie ${pct0(c.reflectBase)} des dégâts reçus + ${pct0(c.reflectPerCap)} de votre Cap.`;
    case 'Healer': return `Soigne ${pct0(c.missingHpPercent)} des PV manquants + ${pct0(c.capScale)} de votre Cap.`;
    case 'Archer': return `Deux tirs : 100% Auto, puis ${pct0(c.hit2AutoMultiplier)} Auto + ${pct0(c.hit2CapMultiplier)} Cap.`;
    case 'Mage': return `Inflige votre attaque de base + ${pct0(c.capBase)} de votre Cap.`;
    case 'Demoniste': return `Chaque tour, familier inflige ${pct0(c.capBase)} de votre Cap et ignore ${pct0(c.ignoreResist)} RésCap. Chaque auto +${pct0(c.stackPerAuto)} de Cap (cumulable).`;
    case 'Masochiste': return `Renvoie ${pct0(c.returnBase)} des dégâts accumulés + ${pct1(c.returnPerCap)} de votre Cap. Se soigne de ${pct0(c.healPercent)} des dégâts accumulés.`;
    case 'Briseur de Sort': return `Après une capacité subie : bouclier ${pct0(c.shieldFromSpellDamage)} dégâts + ${pct0(c.shieldFromCap)} CAP. Réduit soins adverses de ${pct0(c.antiHealReduction)}. Auto + ${pct0(c.autoCapBonus)} CAP.`;
    case 'Succube': return `Inflige Auto + ${pct0(c.capScale)} CAP. Prochaine attaque adverse -${pct0(c.nextAttackReduction)} dégâts.`;
    case 'Bastion': return `Début: bouclier = ${pct0(c.startShieldFromDef)} DEF. Passif: +${pct0(c.defPercentBonus)} DEF. Inflige Auto + ${pct0(c.capScale)} CAP + ${pct0(c.defScale)} DEF.`;
    case 'Alchimiste': return `Cycle ${c.cycleLength || 3} : Feu Auto + ${pct0(c.fireCapScale)} CAP ; Vie soin ${pct0(c.lifeCapScale)} CAP ; Acide -${pct0(c.acidDefReduction)} DEF / -${pct0(c.acidRescReduction)} ResC.`;
    case 'Sorcière': return `Malédiction : −${pct0(c.curseStatReduction)} d'une stat adverse. Dégâts : Auto + ${pct0(c.capBase)} CAP + stats retirées.`;
    case 'Berserk': return `Rage : coût ${pct0(c.rageHpCostPercent)} PV max. Auto + ${pct0(c.rageMissingHpDamageScale)} des PV manquants (après coût). +${pct1(c.rageMissingHpScalePerCap)} par point de Cap sur ce pourcentage.`;
    default: return '';
  }
}

function buildSubclassDescription(className, subclassId) {
  const c = getSubclassCapacityConstants(className, subclassId);
  switch (subclassId) {
    case 'maitre_armes':
      return `Ignore totalement la def/resC et inflige Auto + ${pct0(c.capScale)} CAP.`;
    case 'duracier':
      return `Frappe la résistance la plus faible. Ignore ${pct0(c.ignoreBase)} de la résistance ennemie + ${pct1(c.ignorePerCap)} de votre Cap. Gagne un bouclier de ${pct0(c.shieldAutoPercent)} Auto + ${pct1(c.shieldCapPercent)} CAP.`;
    case 'croise_lumineux':
      return `Renvoie ${pct0(c.reflectBase)} des dégâts reçus + ${pct1(c.reflectPerCap)} de votre Cap. Réduit les dégâts de la prochaine attaque ennemie de ${pct0(c.nextAttackReduction)}.`;
    case 'juge_implacable':
      return `Renvoie ${pct0(c.reflectBase)} des dégâts reçus + ${pct1(c.reflectPerCap)} de votre Cap. Réduit la DEF ennemie de ${pct1(c.defReductionStack)} (stackable).`;
    case 'sniper':
      return `Deux tirs : 100% Auto puis ${pct0(c.hit2AutoMultiplier)} Auto + ${pct0(c.hit2CapMultiplier)} Cap.`;
    case 'chasseur_fantome':
      return `Après un crit, les prochains dégâts gagnent +${pct0(c.ghostHunterCapBonus)} CAP. Deux tirs : ${pct0(c.hit1AutoMultiplier)} Auto puis ${pct0(c.hit2AutoMultiplier)} Auto + ${pct0(c.hit2CapMultiplier)} Cap.`;
    case 'arcaniste_instable':
      return `Inflige Auto + ${pct0(c.capBase)} Cap. Applique débuff : +${pct0(c.damageTakenStack)} dégâts subis par l'ennemi (stackable).`;
    case 'sorcier_neant': {
      const mult = c.neantBurnAutoMultiplier ?? 0.92;
      const autoReduct = Math.round((1 - mult) * 100);
      const burnHp = (c.neantBurnHpPercentPerTurn ?? 0.015) * 100;
      const burnHpStr = String(burnHp).replace('.', ',');
      return `Inflige Auto + ${pct0(c.capBase)} Cap. Brûlure du Néant : l'ennemi inflige -${autoReduct}% dégâts Auto et perd ${burnHpStr}% de ses PV actuels par tour.`;
    }
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
      return `Inflige Auto + ${pct0(c.capScale)} CAP. La prochaine attaque adverse inflige -${pct0(c.nextAttackReduction)} dégâts. Cette capacité crit obligatoirement.`;
    case 'rempart_fer':
      return `Passif classe Bastion : +${pct0(classConstants.bastion.defPercentBonus)} DEF. Début du combat : bouclier = ${pct0(c.startShieldFromDef)} DEF. Inflige Auto + ${pct0(c.capScale)} CAP + ${pct0(c.defScale)} DEF.`;
    case 'mur_implacable':
      return `Passif classe Bastion : +${pct0(classConstants.bastion.defPercentBonus)} DEF. Début du combat : bouclier = ${pct0(c.startShieldFromDef)} DEF. Vous attaquez en premier le tour de la capacité. Inflige Auto + ${pct0(c.capScale)} CAP + ${pct0(c.defScale)} DEF.`;
    case 'flagellant_sanglant':
      return `Renvoie ${pct0(c.returnBase)} dégâts accumulés + ${pct1(c.returnPerCap)} Cap. Soigne ${pct0(c.healPercent)} des dégâts accumulés. Réduit votre DEF de ${pct0(1 - (c.defMultiplier ?? 1))} mais augmente votre Auto de ${pct0((c.autoMultiplier ?? 1) - 1)} et votre CAP de ${pct0((c.capMultiplier ?? 1) - 1)} pour le reste du combat (cumulable).`;
    case 'ecorche_fer':
      return `Renvoie ${pct0(c.returnBase)} dégâts accumulés + ${pct1(c.returnPerCap)} Cap. Soigne ${pct0(c.healPercent)} des dégâts accumulés. Chaque Purge augmente votre DEF et ResC de ${pct0(c.defRescapStack)}.`;
    case 'assassin':
      return `Esquive la prochaine attaque. Gagne +${c.spdBonus ?? classConstants.voleur.spdBonus ?? 0} VIT et +${pct1(c.critPerCap ?? classConstants.voleur.critPerCap)} Cap en chance de critique. Prochaine attaque critique garantie.`;
    case 'roublard':
      return `Esquive la prochaine attaque. Gagne +${c.spdBonus ?? classConstants.voleur.spdBonus ?? 0} VIT et +${pct1(c.critPerCap ?? classConstants.voleur.critPerCap)} Cap en critique. Vole 5% d'une stat ennemie aléatoire (jusqu'au prochain proc, pas stackable).`;
    case 'luxum':
      return `Soigne ${pct0(c.missingHpPercent)} des PV manquants + ${pct0(c.capScale)} Cap. À chaque lancement : gain d'un bouclier égal à ${pct0(c.capShieldPercent)} de votre CAP. Convertit l'overheal en bouclier.`;
    case 'latum':
      return `Inflige ${pct0(c.missingHpDamagePercent)} des PV manquants en dégâts à l'ennemi, puis soigne ${pct0(c.missingHpPercent)} des PV manquants + ${pct0(c.capScale)} Cap.`;
    case 'maitre_alchimiste':
      return `Cycle complet : Feu Auto + ${pct0(c.fireCapScale)} CAP ; Vie soin ${pct0(c.lifeCapScale)} CAP ; Acide -${pct0(c.acidDefReduction)} DEF / -${pct0(c.acidRescReduction)} ResC.`;
    case 'alchimiste_metal': {
      const stun = c.metalStunDuration ?? classConstants.alchimiste.metalStunDuration;
      return `Cycle complet : Feu Auto + ${pct0(c.fireCapScale)} CAP ; Vie soin ${pct0(c.lifeCapScale)} CAP ; Acide -${pct0(c.acidDefReduction)} DEF / -${pct0(c.acidRescReduction)} ResC ; Métal étourdit ${stun} tour.`;
    }
    case 'hexe_noire': {
      const pctDebut = c.curseStatReductionStartOfCombat ?? c.curseStatReduction;
      const pctSort = c.curseStatReduction;
      const capBase = c.capBase ?? classConstants.sorciere.capBase;
      return `Début de combat : Malédiction −${pct0(pctDebut)} (permanent). Malédiction : −${pct0(pctSort)} (CD 3). Total dégâts : Auto + ${pct0(capBase)} CAP + stats retirées.`;
    }
    case 'enchanteresse':
      return `Malédiction : −${pct0(c.curseStatReduction)} d'une stat adverse (cumul sur la valeur courante). Total dégâts : Auto + ${pct0(c.capBase)} CAP + stats retirées.`;
    case 'boucher':
      return `Rage : coût ${pct0(c.rageHpCostPercent ?? classConstants.berserk.rageHpCostPercent)} PV max. Auto + ${pct0(c.rageMissingHpDamageScale)} des PV manquants (après coût). +${pct1(c.rageMissingHpScalePerCap ?? classConstants.berserk.rageMissingHpScalePerCap)} par point de Cap sur ce pourcentage.`;
    case 'brise_caves':
      return `Rage : coût ${pct0(c.rageHpCostPercent ?? classConstants.berserk.rageHpCostPercent)} PV max. Auto + ${pct0(c.rageMissingHpDamageScale ?? classConstants.berserk.rageMissingHpDamageScale)} des PV manquants (après coût). +${pct1(c.rageMissingHpScalePerCap ?? classConstants.berserk.rageMissingHpScalePerCap)} par point de Cap sur ce pourcentage. Prochaine auto +${pct0(classConstants.berserk.nextAutoDamageBonus)} dégâts.`;
    default:
      return '';
  }
}

// ---- RACES
const raceRows = sortedRaces
  .filter((r) => isOutlier(asNumber(r.winRate)))
  .map((r) => ([
    r.race,
    `${toPct(r.winRate)}%`,
    `${r.wins}/${r.combats}`,
    esc(buildRaceFullDescriptionForLevel(r.race, level))
  ]));
printTable('Races (winrate)', ['Race', 'Winrate', 'Victoires/Combats', 'Passif (valeurs actuelles)'], raceRows);

// ---- SOUS-CLASSES
const subclassIdToClass = {};
Object.entries(SUBCLASSES_BY_CLASS).forEach(([className, list]) => {
  (list || []).forEach((s) => { subclassIdToClass[s.id] = className; });
});

const subclassRows = sortedSubclasses
  .filter((s) => s.combats > 0) // évite bruit sur 0 combats
  .filter((s) => isOutlier(asNumber(s.winRate)))
  .map((s) => {
    const className = subclassIdToClass[s.id] ?? '—';
    const desc = className !== '—' ? buildSubclassDescription(className, s.id) : '';
    return [
      s.name,
      s.id,
      className,
      `${toPct(s.winRate)}%`,
      `${s.wins}/${s.combats}`,
      esc(desc || '—')
    ];
  });

printTable(
  'Sous-classes (winrate)',
  ['Sous-classe', 'ID', 'Classe', 'Winrate', 'Victoires/Combats', 'Sort (valeurs actuelles)'],
  subclassRows
);

