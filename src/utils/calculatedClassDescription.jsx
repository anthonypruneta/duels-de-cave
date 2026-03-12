/**
 * Description calculée de la capacité de classe (valeurs réelles selon Cap/Auto).
 * Partagé entre CharacterCreation et CharacterCardContent (donjons, PvP, etc.)
 */

import React from 'react';
import { classConstants, getSubclassCapacityConstants } from '../data/combatMechanics';
import { getClassDescriptionText, buildSubclassDescription } from './descriptionBuilders';
import SharedTooltip from '../components/SharedTooltip';

/** @param {{ cap?: number, auto?: number, def?: number, rescap?: number }} stats */
function safe(stats, key, fallback = 0) {
  const v = stats?.[key];
  return typeof v === 'number' && !Number.isNaN(v) ? v : fallback;
}

export function getCalculatedClassDescription(className, cap, auto) {
  const Tooltip = SharedTooltip;
  switch (className) {
    case 'Guerrier': {
      const { ignoreBase, ignorePerCap, autoBonus } = classConstants.guerrier;
      const ignoreBasePct = Math.round(ignoreBase * 100);
      const ignoreBonusPct = Math.round(ignorePerCap * cap * 100);
      const ignoreTotalPct = ignoreBasePct + ignoreBonusPct;
      return (
        <>
          +{autoBonus} Auto | Frappe résistance faible & ignore{' '}
          <Tooltip content={`Base: ${ignoreBasePct}% | Bonus (Cap ${cap}): +${ignoreBonusPct}%`}>
            <span className="text-green-400">{ignoreTotalPct}%</span>
          </Tooltip>
        </>
      );
    }

    case 'Voleur': {
      const { spdBonus, critPerCap } = classConstants.voleur;
      const critBonusPct = Math.round(critPerCap * cap * 100);
      return (
        <>
          +{spdBonus} VIT | Esquive 1 coup
          <Tooltip content={`Bonus (Cap ${cap}): +${critBonusPct}%`}>
            <span className="text-green-400"> | +{critBonusPct}% crit</span>
          </Tooltip>
        </>
      );
    }

    case 'Paladin': {
      const { reflectBase, reflectPerCap } = classConstants.paladin;
      const reflectBasePct = Math.round(reflectBase * 100);
      const reflectBonusPct = Math.round(reflectPerCap * cap * 100);
      const reflectTotalPct = reflectBasePct + reflectBonusPct;
      return (
        <>
          Renvoie{' '}
          <Tooltip content={`Base: ${reflectBasePct}% | Bonus (Cap ${cap}): +${reflectBonusPct}%`}>
            <span className="text-green-400">{reflectTotalPct}%</span>
          </Tooltip>
          {' '}des dégâts reçus
        </>
      );
    }

    case 'Healer': {
      const { missingHpPercent, capScale } = classConstants.healer;
      const missingPct = Math.round(missingHpPercent * 100);
      const healValue = Math.round(capScale * cap);
      return (
        <>
          Heal {missingPct}% PV manquants +{' '}
          <Tooltip content={`${capScale.toFixed(2)} × Cap (${cap}) = ${healValue}`}>
            <span className="text-green-400">{healValue}</span>
          </Tooltip>
        </>
      );
    }

    case 'Archer': {
      const { hit2AutoMultiplier, hit2CapMultiplier } = classConstants.archer;
      const hit2Auto = Math.round(hit2AutoMultiplier * auto);
      const hit2Cap = Math.round(hit2CapMultiplier * cap);
      return (
        <>
          2 attaques: 1 tir normal +{' '}
          <Tooltip content={`Hit2 = ${hit2AutoMultiplier.toFixed(2)}×Auto (${auto}) + ${hit2CapMultiplier.toFixed(2)}×Cap (${cap}) vs ResC`}>
            <span className="text-green-400">{hit2Auto}+{hit2Cap}</span>
          </Tooltip>
        </>
      );
    }

    case 'Mage': {
      const { capBase, capPerCap } = classConstants.mage;
      const magicPct = capBase + capPerCap * cap;
      const magicDmgTotal = Math.round(magicPct * cap);
      const total = auto + magicDmgTotal;
      return (
        <>
          Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${(magicPct * 100).toFixed(1)}% × Cap (${cap}) = ${magicDmgTotal}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          {' '}dégâts magiques (vs ResC)
        </>
      );
    }

    case 'Demoniste': {
      const { capBase, capPerCap, ignoreResist, stackPerAuto } = classConstants.demoniste;
      const familierPct = capBase + capPerCap * cap;
      const familierDmgTotal = Math.round(familierPct * cap);
      const ignoreResPct = Math.round(ignoreResist * 100);
      const stackBonusPctDisplay = (stackPerAuto * 100) % 1 === 0 ? String(Math.round(stackPerAuto * 100)) : (stackPerAuto * 100).toFixed(1);
      return (
        <>
          Chaque tour:{' '}
          <Tooltip content={`${(familierPct * 100).toFixed(1)}% de Cap (${cap}) | +${stackBonusPctDisplay}% Cap par auto (cumulable) | Ignore ${ignoreResPct}% ResC`}>
            <span className="text-green-400">{familierDmgTotal}</span>
          </Tooltip>
          {' '}dégâts (ignore {ignoreResPct}% ResC)
        </>
      );
    }

    case 'Masochiste': {
      const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
      const returnBasePct = Math.round(returnBase * 100);
      const returnBonusPct = Math.round(returnPerCap * cap * 100);
      const returnTotalPct = returnBasePct + returnBonusPct;
      const healPct = Math.round(healPercent * 100);
      return (
        <>
          Renvoie{' '}
          <Tooltip content={`Base: ${returnBasePct}% | Bonus (Cap ${cap}): +${returnBonusPct}%`}>
            <span className="text-green-400">{returnTotalPct}%</span>
          </Tooltip>
          {' '}des dégâts accumulés & heal {healPct}%
        </>
      );
    }

    case 'Briseur de Sort': {
      const { shieldFromSpellDamage, shieldFromCap, autoCapBonus, antiHealReduction } = classConstants.briseurSort;
      const shieldDmgPct = Math.round(shieldFromSpellDamage * 100);
      const shieldCapValue = Math.round(shieldFromCap * cap);
      const autoBonusValue = Math.round(autoCapBonus * cap);
      const autoTotal = auto + autoBonusValue;
      const antiHealPct = Math.round(antiHealReduction * 100);
      return (
        <>
          Bouclier après capacité:{' '}
          <Tooltip content={`${shieldDmgPct}% dégâts reçus + ${shieldFromCap * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{shieldDmgPct}% dmg + {shieldCapValue}</span>
          </Tooltip>
          {' '}| Auto ={' '}
          <Tooltip content={`Auto (${auto}) + ${autoCapBonus * 100}% × Cap (${cap}) = ${autoBonusValue}`}>
            <span className="text-green-400">{autoTotal}</span>
          </Tooltip>
          {' '}| -{antiHealPct}% soins adverses
        </>
      );
    }

    case 'Succube': {
      const { capScale, nextAttackReduction } = classConstants.succube;
      const capDmg = Math.round(capScale * cap);
      const total = auto + capDmg;
      const reductionPct = Math.round(nextAttackReduction * 100);
      return (
        <>
          Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${capScale * 100}% × Cap (${cap}) = ${capDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          {' '}(vs RésCap) | Attaque adverse -{reductionPct}%
        </>
      );
    }

    case 'Bastion': {
      const { defPercentBonus, startShieldFromDef, capScale, defScale } = classConstants.bastion;
      const defBonusPct = Math.round(defPercentBonus * 100);
      const shieldPct = Math.round(startShieldFromDef * 100);
      const capDmg = Math.round(capScale * cap);
      const totalBase = auto + capDmg;
      return (
        <>
          Bouclier initial {shieldPct}% DEF | +{defBonusPct}% DEF | Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${capScale * 100}% × Cap (${cap}) = ${capDmg}, + ${defScale * 100}% × DEF`}>
            <span className="text-green-400">{totalBase}</span>
          </Tooltip>
          {' '}+ {Math.round(defScale * 100)}% DEF
        </>
      );
    }

    default:
      return getClassDescriptionText(className);
  }
}

/**
 * Description calculée de la capacité de sous-classe (valeurs réelles en vert, comme pour les classes).
 * Retourne du JSX avec <span className="text-green-400"> pour les valeurs calculées.
 * @param {string} className
 * @param {string} subclassId
 * @param {{ cap?: number, auto?: number, def?: number, rescap?: number }} stats
 * @returns {React.ReactNode}
 */
export function getCalculatedSubclassDescription(className, subclassId, stats) {
  const cap = safe(stats, 'cap');
  const auto = safe(stats, 'auto');
  const def = safe(stats, 'def');
  const Tooltip = SharedTooltip;
  const c = getSubclassCapacityConstants(className, subclassId);

  switch (subclassId) {
    case 'maitre_armes': {
      const capDmg = Math.round((c.capScale ?? 0) * cap);
      const total = auto + capDmg;
      return (
        <>
          Ignore totalement la def/resC et inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${(c.capScale ?? 0) * 100}% × Cap (${cap}) = ${capDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          {' '}dégâts.
        </>
      );
    }
    case 'duracier': {
      const shieldAuto = Math.round((c.shieldAutoPercent ?? 0) * auto);
      const shieldCap = Math.round((c.shieldCapPercent ?? 0) * cap);
      const ignoreTotalPct = Math.round((c.ignoreBase ?? 0) * 100 + (c.ignorePerCap ?? 0) * cap * 100);
      return (
        <>
          Ignore{' '}
          <Tooltip content={`Base ${(c.ignoreBase ?? 0) * 100}% + ${(c.ignorePerCap ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{ignoreTotalPct}%</span>
          </Tooltip>
          {' '}résistance. Bouclier{' '}
          <Tooltip content={`${(c.shieldAutoPercent ?? 0) * 100}% × Auto (${auto}) + ${(c.shieldCapPercent ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{shieldAuto}+{shieldCap}</span>
          </Tooltip>
          .
        </>
      );
    }
    case 'croise_lumineux': {
      const reflectTotalPct = Math.round((c.reflectBase ?? 0) * 100 + (c.reflectPerCap ?? 0) * cap * 100);
      const nextPct = Math.round((c.nextAttackReduction ?? 0) * 100);
      return (
        <>
          Renvoie{' '}
          <Tooltip content={`Base ${(c.reflectBase ?? 0) * 100}% + ${(c.reflectPerCap ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{reflectTotalPct}%</span>
          </Tooltip>
          {' '}dégâts reçus. Réduit prochaine attaque ennemie de{' '}
          <span className="text-green-400">{nextPct}%</span>.
        </>
      );
    }
    case 'juge_implacable': {
      const reflectTotalPct = Math.round((c.reflectBase ?? 0) * 100 + (c.reflectPerCap ?? 0) * cap * 100);
      const defRedPct = Math.round((c.defReductionStack ?? 0) * 100);
      return (
        <>
          Renvoie{' '}
          <Tooltip content={`Base ${(c.reflectBase ?? 0) * 100}% + ${(c.reflectPerCap ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{reflectTotalPct}%</span>
          </Tooltip>
          {' '}dégâts. Réduit DEF ennemie de{' '}
          <span className="text-green-400">{defRedPct}%</span> (stackable).
        </>
      );
    }
    case 'sniper': {
      const hit2Auto = Math.round((c.hit2AutoMultiplier ?? 0) * auto);
      const hit2Cap = Math.round((c.hit2CapMultiplier ?? 0) * cap);
      return (
        <>
          2 attaques: 1 tir normal +{' '}
          <Tooltip content={`${(c.hit2AutoMultiplier ?? 0) * 100}%×Auto (${auto}) + ${(c.hit2CapMultiplier ?? 0) * 100}%×Cap (${cap}) vs ResC`}>
            <span className="text-green-400">{hit2Auto}+{hit2Cap}</span>
          </Tooltip>
          .
        </>
      );
    }
    case 'chasseur_fantome': {
      const ghostPct = Math.round((c.ghostHunterCapBonus ?? 0) * 100);
      const hit2Auto = Math.round((c.hit2AutoMultiplier ?? 0) * auto);
      const hit2Cap = Math.round((c.hit2CapMultiplier ?? 0) * cap);
      return (
        <>
          Après crit: +<span className="text-green-400">{ghostPct}%</span> CAP. 2 tirs: 100% Auto +{' '}
          <Tooltip content={`${(c.hit2AutoMultiplier ?? 0) * 100}%×Auto (${auto}) + ${(c.hit2CapMultiplier ?? 0) * 100}%×Cap (${cap})`}>
            <span className="text-green-400">{hit2Auto}+{hit2Cap}</span>
          </Tooltip>
          .
        </>
      );
    }
    case 'arcaniste_instable': {
      const spellDmg = Math.round((c.capBase ?? 0) * cap);
      const total = auto + spellDmg;
      const stackPct = Math.round((c.damageTakenStack ?? 0) * 100);
      return (
        <>
          Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${(c.capBase ?? 0) * 100}% × Cap (${cap}) = ${spellDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          {' '}(vs RésCap). Débuff: +<span className="text-green-400">{stackPct}%</span> dégâts subis (cumulable).
        </>
      );
    }
    case 'sorcier_neant': {
      const spellDmg = Math.round((c.capBase ?? 0) * cap);
      const total = auto + spellDmg;
      return (
        <>
          Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${(c.capBase ?? 0) * 100}% × Cap (${cap}) = ${spellDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          {' '}(vs RésCap).{' '}
          <Tooltip content="Applique Brûlure du Néant : l'ennemi perd 2% PV par tour et inflige -10% dégâts auto (permanent)">
            <span className="text-purple-400 underline decoration-dotted cursor-help">Brûlure du Néant</span>
          </Tooltip>.
        </>
      );
    }
    case 'maitre_invocateur': {
      const familierPct = (c.capBase ?? 0) + (c.capPerCap ?? 0) * cap;
      const familierDmg = Math.round(familierPct * cap);
      const ignorePct = Math.round((c.ignoreResist ?? 0) * 100);
      const stackPct = ((c.stackPerAuto ?? 0) * 100) % 1 === 0 ? Math.round((c.stackPerAuto ?? 0) * 100) : ((c.stackPerAuto ?? 0) * 100).toFixed(1);
      return (
        <>
          Chaque tour, familier inflige{' '}
          <Tooltip content={`${familierDmg} dégâts | ${(familierPct * 100).toFixed(1)}% × Cap (${cap}) | +${stackPct}% Cap/auto (cumulable) | Ignore ${ignorePct}% ResC`}>
            <span className="text-green-400">{familierDmg}</span>
          </Tooltip>
          {' '}dégâts (ignore {ignorePct}% ResC). Chaque auto +{stackPct}% Cap (cumulable).
        </>
      );
    }
    case 'pacte_sombre': {
      const familierPct = (c.capBase ?? 0) + (c.capPerCap ?? 0) * cap;
      const familierDmg = Math.round(familierPct * cap);
      const ignorePct = Math.round((c.ignoreResist ?? 0) * 100);
      const stackPct = ((c.stackPerAuto ?? 0) * 100) % 1 === 0 ? Math.round((c.stackPerAuto ?? 0) * 100) : ((c.stackPerAuto ?? 0) * 100).toFixed(1);
      const stealPct = Math.round((c.capStealPercent ?? 0) * 100);
      return (
        <>
          Chaque tour, familier inflige{' '}
          <Tooltip content={`${familierDmg} dégâts | ${(familierPct * 100).toFixed(1)}% × Cap (${cap}) | +${stackPct}% Cap/auto | Ignore ${ignorePct}% ResC`}>
            <span className="text-green-400">{familierDmg}</span>
          </Tooltip>
          {' '}dégâts (ignore {ignorePct}% ResC). Chaque auto +{stackPct}% Cap (cumulable) et vole{' '}
          <span className="text-green-400">{stealPct}%</span> CAP ennemi.
        </>
      );
    }
    case 'stratege_arcanique': {
      const shieldCapVal = Math.round((c.shieldFromCap ?? 0) * cap);
      const autoBonusVal = Math.round((c.autoCapBonus ?? 0) * cap);
      const autoTotal = auto + autoBonusVal;
      const shieldDmgPct = Math.round((c.shieldFromSpellDamage ?? 0) * 100);
      const nextSpellPct = Math.round((c.nextSpellReduction ?? 0) * 100);
      const antiHealPct = Math.round((c.antiHealReduction ?? 0) * 100);
      return (
        <>
          Après capacité subie: bouclier{' '}
          <Tooltip content={`${shieldDmgPct}% dégâts + ${(c.shieldFromCap ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{shieldDmgPct}% + {shieldCapVal}</span>
          </Tooltip>
          . Sort -{nextSpellPct}%. Soins adverses -{antiHealPct}%. Auto ={' '}
          <Tooltip content={`Auto (${auto}) + ${(c.autoCapBonus ?? 0) * 100}% × Cap (${cap}) = ${autoBonusVal}`}>
            <span className="text-green-400">{autoTotal}</span>
          </Tooltip>
          .
        </>
      );
    }
    case 'mentaliste': {
      const shieldCapVal = Math.round((c.shieldFromCap ?? 0) * cap);
      const defStackPct = Math.round((c.defBonusStack ?? 0) * 100);
      const shieldDmgPct = Math.round((c.shieldFromSpellDamage ?? 0) * 100);
      const antiHealPct = Math.round((c.antiHealReduction ?? 0) * 100);
      const autoBonusVal = Math.round((c.autoCapBonus ?? 0) * cap);
      const autoTotal = auto + autoBonusVal;
      return (
        <>
          Après capacité subie: bouclier{' '}
          <Tooltip content={`${shieldDmgPct}% dégâts + ${(c.shieldFromCap ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{shieldDmgPct}% + {shieldCapVal}</span>
          </Tooltip>
          , DEF +<span className="text-green-400">{defStackPct}%</span> (cumulable). Soins adverses -{antiHealPct}%. Auto ={' '}
          <Tooltip content={`Auto (${auto}) + ${(c.autoCapBonus ?? 0) * 100}% × Cap (${cap}) = ${autoBonusVal}`}>
            <span className="text-green-400">{autoTotal}</span>
          </Tooltip>
          .
        </>
      );
    }
    case 'dompteuse_chair': {
      const capDmg = Math.round((c.capScale ?? 0) * cap);
      const total = auto + capDmg;
      const nextPct = Math.round((c.nextAttackReduction ?? 0) * 100);
      const autoRedPct = Math.round((c.autoReductionStack ?? 0) * 100);
      return (
        <>
          Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${(c.capScale ?? 0) * 100}% × Cap (${cap}) = ${capDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          {' '}(vs RésCap). Attaque adverse -{nextPct}%. Auto ennemi -{' '}
          <span className="text-green-400">{autoRedPct}%</span> (cumulable).
        </>
      );
    }
    case 'ame_tentatrice': {
      const capDmg = Math.round((c.capScale ?? 0) * cap);
      const total = auto + capDmg;
      const nextPct = Math.round((c.nextAttackReduction ?? 0) * 100);
      return (
        <>
          Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${(c.capScale ?? 0) * 100}% × Cap (${cap}) = ${capDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          {' '}(vs RésCap). Attaque adverse -{nextPct}%.{' '}
          <Tooltip content="Si le dernier sort n'était pas critique, le prochain est garanti crit. +10% crit sur les autos.">
            <span className="text-purple-400 underline decoration-dotted cursor-help">Crit alterné</span>
          </Tooltip>.
        </>
      );
    }
    case 'rempart_fer': {
      const shieldVal = Math.round((c.startShieldFromDef ?? 0) * def);
      const capDmg = Math.round((c.capScale ?? 0) * cap);
      const defDmg = Math.round((c.defScale ?? 0) * def);
      const total = auto + capDmg + defDmg;
      return (
        <>
          Bouclier initial{' '}
          <Tooltip content={`${(c.startShieldFromDef ?? 0) * 100}% × DEF (${def})`}>
            <span className="text-green-400">{shieldVal}</span>
          </Tooltip>
          . Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${(c.capScale ?? 0) * 100}% × Cap (${cap}) = ${capDmg} + ${(c.defScale ?? 0) * 100}% × DEF (${def}) = ${defDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          {' '}dégâts.
        </>
      );
    }
    case 'mur_implacable': {
      const shieldVal = Math.round((c.startShieldFromDef ?? 0) * def);
      const capDmg = Math.round((c.capScale ?? 0) * cap);
      const defDmg = Math.round((c.defScale ?? 0) * def);
      const total = auto + capDmg + defDmg;
      return (
        <>
          Bouclier initial{' '}
          <Tooltip content={`${(c.startShieldFromDef ?? 0) * 100}% × DEF (${def})`}>
            <span className="text-green-400">{shieldVal}</span>
          </Tooltip>
          . Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${(c.capScale ?? 0) * 100}% × Cap (${cap}) = ${capDmg} + ${(c.defScale ?? 0) * 100}% × DEF (${def}) = ${defDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          {' '}dégâts.
        </>
      );
    }
    case 'luxum': {
      const healCap = Math.round((c.capScale ?? 0) * cap);
      const shieldCap = Math.round((c.capShieldPercent ?? 0) * cap);
      const missingPct = Math.round((c.missingHpPercent ?? 0) * 100);
      return (
        <>
          Soigne {missingPct}% PV manquants +{' '}
          <Tooltip content={`${(c.capScale ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{healCap}</span>
          </Tooltip>
          . Bouclier{' '}
          <Tooltip content={`${(c.capShieldPercent ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{shieldCap}</span>
          </Tooltip>
          {' '}au soin.
        </>
      );
    }
    case 'latum': {
      const missingDmgPct = Math.round((c.missingHpDamagePercent ?? 0) * 100);
      const healCap = Math.round((c.capScale ?? 0) * cap);
      const missingHealPct = Math.round((c.missingHpPercent ?? 0) * 100);
      return (
        <>
          Inflige <span className="text-green-400">{missingDmgPct}%</span> PV manquants (dégâts vs ResC), puis soigne {missingHealPct}% PV manquants +{' '}
          <Tooltip content={`${(c.capScale ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{healCap}</span>
          </Tooltip>
          .
        </>
      );
    }
    case 'flagellant_sanglant': {
      const returnBonusPct = Math.round((c.returnPerCap ?? 0) * cap * 100);
      const returnBasePct = Math.round((c.returnBase ?? 0) * 100);
      const returnTotalPct = returnBasePct + returnBonusPct;
      const healPct = Math.round((c.healPercent ?? 0) * 100);
      return (
        <>
          Renvoie{' '}
          <Tooltip content={`Base ${returnBasePct}% + ${(c.returnPerCap ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{returnTotalPct}%</span>
          </Tooltip>
          {' '}dégâts accumulés + <span className="text-green-400">{(c.returnPerCap ?? 0) * 100}%</span> Cap. Soigne{' '}
          <span className="text-green-400">{healPct}%</span> dégâts accumulés.
        </>
      );
    }
    case 'ecorche_fer': {
      const returnBasePct = Math.round((c.returnBase ?? 0) * 100);
      const returnBonusPct = Math.round((c.returnPerCap ?? 0) * cap * 100);
      const returnTotalPct = returnBasePct + returnBonusPct;
      const healPct = Math.round((c.healPercent ?? 0) * 100);
      const stackPct = Math.round((c.defRescapStack ?? 0) * 100);
      return (
        <>
          Renvoie{' '}
          <Tooltip content={`Base ${returnBasePct}% + ${(c.returnPerCap ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{returnTotalPct}%</span>
          </Tooltip>
          {' '}+ <span className="text-green-400">{(c.returnPerCap ?? 0) * 100}%</span> Cap. Soigne {healPct}%. DEF+ResC +<span className="text-green-400">{stackPct}%</span> par Purge.
        </>
      );
    }
    case 'assassin': {
      const critBonusPct = Math.round((c.critPerCap ?? 0) * cap * 100);
      return (
        <>
          +<span className="text-green-400">{c.spdBonus ?? 0}</span> VIT, +{' '}
          <Tooltip content={`${(c.critPerCap ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{critBonusPct}%</span>
          </Tooltip>
          {' '}crit. Prochaine attaque critique garantie.
        </>
      );
    }
    case 'roublard': {
      const critBonusPct = Math.round((c.critPerCap ?? 0) * cap * 100);
      return (
        <>
          +<span className="text-green-400">{c.spdBonus ?? 0}</span> VIT, +{' '}
          <Tooltip content={`${(c.critPerCap ?? 0) * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{critBonusPct}%</span>
          </Tooltip>
          {' '}crit.{' '}
          <Tooltip content="Vole 8% d'une stat aléatoire de l'ennemi (Auto/Déf/Cap/ResC/Vit) à chaque esquive.">
            <span className="text-purple-400 underline decoration-dotted cursor-help">Vol de stat</span>
          </Tooltip>.
        </>
      );
    }
    default:
      return <>{buildSubclassDescription(className, subclassId)}</>;
  }
}
