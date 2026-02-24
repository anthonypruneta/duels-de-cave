/**
 * Description calculée de la capacité de classe (valeurs réelles selon Cap/Auto).
 * Partagé entre CharacterCreation et CharacterCardContent (donjons, PvP, etc.)
 */

import React from 'react';
import { classConstants } from '../data/combatMechanics';
import { getClassDescriptionText } from './descriptionBuilders';
import SharedTooltip from '../components/SharedTooltip';

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
      return (
        <>
          Dégâts = Auto +{' '}
          <Tooltip content={`Auto (${auto}) + ${(magicPct * 100).toFixed(1)}% × Cap (${cap})`}>
            <span className="text-green-400">{auto + magicDmgTotal}</span>
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
      const stackBonusPct = Math.round(stackPerAuto * 100);
      return (
        <>
          Chaque tour:{' '}
          <Tooltip content={`${(familierPct * 100).toFixed(1)}% de Cap (${cap}) | +${stackBonusPct}% Cap par auto (cumulable) | Ignore ${ignoreResPct}% ResC`}>
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
      const antiHealPct = Math.round(antiHealReduction * 100);
      return (
        <>
          Bouclier après capacité:{' '}
          <Tooltip content={`${shieldDmgPct}% dégâts reçus + ${shieldFromCap * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{shieldDmgPct}% dmg + {shieldCapValue}</span>
          </Tooltip>
          {' '}| Auto +{' '}
          <Tooltip content={`${autoCapBonus * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{autoBonusValue}</span>
          </Tooltip>
          {' '}| -{antiHealPct}% soins adverses
        </>
      );
    }

    case 'Succube': {
      const { capScale, nextAttackReduction } = classConstants.succube;
      const capDmg = Math.round(capScale * cap);
      const reductionPct = Math.round(nextAttackReduction * 100);
      return (
        <>
          Auto +{' '}
          <Tooltip content={`${capScale * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{capDmg}</span>
          </Tooltip>
          {' '}CAP | Prochaine attaque adverse -{reductionPct}%
        </>
      );
    }

    case 'Bastion': {
      const { defPercentBonus, startShieldFromDef, capScale, defScale } = classConstants.bastion;
      const defBonusPct = Math.round(defPercentBonus * 100);
      const shieldPct = Math.round(startShieldFromDef * 100);
      const capDmg = Math.round(capScale * cap);
      return (
        <>
          Bouclier initial {shieldPct}% DEF | +{defBonusPct}% DEF | Auto +{' '}
          <Tooltip content={`${capScale * 100}% × Cap (${cap}) + ${defScale * 100}% DEF`}>
            <span className="text-green-400">{capDmg}</span>
          </Tooltip>
        </>
      );
    }

    default:
      return getClassDescriptionText(className);
  }
}
