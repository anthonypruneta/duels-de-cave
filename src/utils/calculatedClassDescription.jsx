/**
 * Description calculée de la capacité de classe (valeurs réelles selon Cap/Auto).
 * Partagé entre CharacterCreation et CharacterCardContent (donjons, PvP, etc.)
 */

import React from 'react';
import { classConstants, getSubclassCapacityConstants, dmgCap } from '../data/combatMechanics';
import { getSubclassStatBonuses } from '../data/subclasses';
import { getClassDescriptionText, buildSubclassDescription } from './descriptionBuilders';
import SharedTooltip from '../components/SharedTooltip';

/** @param {{ cap?: number, auto?: number, def?: number, rescap?: number }} stats */
function safe(stats, key, fallback = 0) {
  const v = stats?.[key];
  return typeof v === 'number' && !Number.isNaN(v) ? v : fallback;
}

function formatPercent(value) {
  const p = (value ?? 0) * 100;
  const rounded = Math.round((p + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, '');
}

export function getCalculatedClassDescription(className, cap, auto, def = 0, rescap = 0, subclassId = null) {
  const Tooltip = SharedTooltip;
  switch (className) {
    case 'Guerrier': {
      const { ignoreBase, ignorePerCap, autoBonus } = classConstants.guerrier;
      const ignoreBasePct = Math.round(ignoreBase * 100);
      const ignoreBonusPct = Math.round(ignorePerCap * cap * 100);
      const ignoreTotalPct = ignoreBasePct + ignoreBonusPct;
      return (
        <>
          +{autoBonus} Auto
          <br />
          Frappe résistance faible & ignore{' '}
          <Tooltip content={`Base: ${ignoreBasePct}%\nBonus (Cap ${cap}): +${ignoreBonusPct}%`}>
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
          +{spdBonus} VIT
          <br />
          Esquive 1 coup
          <br />
          <Tooltip content={`Bonus (Cap ${cap}): +${critBonusPct}%`}>
            <span className="text-green-400">+{critBonusPct}% crit</span>
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
          <Tooltip content={`Base: ${reflectBasePct}%\nBonus (Cap ${cap}): +${reflectBonusPct}%`}>
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
          <Tooltip content={`Hit2 = ${hit2AutoMultiplier.toFixed(2)}×Auto (${auto}) + ${hit2CapMultiplier.toFixed(2)}×Cap (${cap})`}>
            <span className="text-green-400">{hit2Auto}+{hit2Cap}</span>
          </Tooltip>
        </>
      );
    }

    case 'Mage': {
      const mageC = getSubclassCapacityConstants('Mage', subclassId);
      const capBase = mageC.capBase ?? classConstants.mage.capBase;
      const capPerCap = mageC.capPerCap ?? classConstants.mage.capPerCap;
      const magicPct = capBase + capPerCap * cap;
      const magicDmgTotal = Math.round(magicPct * cap);
      const total = auto + magicDmgTotal;
      return (
        <>
          Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${formatPercent(magicPct)}% × Cap (${cap}) = ${magicDmgTotal}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          {' '}dégâts magiques
        </>
      );
    }

    case 'Demoniste': {
      const { capBase, capPerCap, ignoreResist, stackPerAuto } = classConstants.demoniste;
      const familierPct = capBase + capPerCap * cap;
      const familierDmgTotal = Math.round(familierPct * cap);
      const ignoreResPct = Math.round(ignoreResist * 100);
      const stackBonusPctDisplay = formatPercent(stackPerAuto);
      return (
        <>
          Chaque tour:{' '}
          <Tooltip content={`${formatPercent(familierPct)}% de Cap (${cap})\n+${stackBonusPctDisplay}% Cap par auto (cumulable)\nIgnore ${ignoreResPct}% ResC`}>
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
          <Tooltip content={`Base: ${returnBasePct}%\nBonus (Cap ${cap}): +${returnBonusPct}%`}>
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
          Bouclier après capacité{' '}
          <Tooltip content={`${shieldDmgPct}% dégâts reçus\n${formatPercent(shieldFromCap)}% × Cap (${cap})`}>
            <span className="text-green-400">{shieldDmgPct}% dmg + {shieldCapValue}</span>
          </Tooltip>
          <br />
          Auto ={' '}
          <Tooltip content={`Auto (${auto}) + ${formatPercent(autoCapBonus)}% × Cap (${cap}) = ${autoBonusValue}`}>
            <span className="text-green-400">{autoTotal}</span>
          </Tooltip>
          <br />
          Réduit les soins adverses de <span className="text-green-400">{antiHealPct}%</span>
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
          <Tooltip content={`Auto (${auto}) + ${formatPercent(capScale)}% × Cap (${cap}) = ${capDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          <br />
          Attaque adverse -{reductionPct}%
        </>
      );
    }

    case 'Bastion': {
      const { defPercentBonus, startShieldFromDef, capScale, defScale } = classConstants.bastion;
      const shieldValue = Math.round((startShieldFromDef ?? 0) * def);
      const p = defPercentBonus ?? 0;
      const defBeforePassive = p > 0 ? Math.round(def / (1 + p)) : def;
      const defBonusValue = Math.max(0, def - defBeforePassive);
      const capDmg = Math.round(capScale * cap);
      const defDmg = Math.round(defScale * def);
      const total = auto + capDmg + defDmg;
      return (
        <>
          Passif: DEF{' '}
          <Tooltip content={p > 0 ? `${Math.round(p * 100)}% × DEF (${defBeforePassive}) = +${defBonusValue}` : ''}>
            <span className="text-green-400">+{defBonusValue}</span>
          </Tooltip>
          {' '}
          <br />
          Bouclier initial{' '}
          <Tooltip content={`${formatPercent(startShieldFromDef)}% × DEF (${def}) = ${shieldValue}`}>
            <span className="text-green-400">{shieldValue}</span>
          </Tooltip>
          {' '}
          <br />
          Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${formatPercent(capScale)}% × Cap (${cap}) = ${capDmg} + ${formatPercent(defScale)}% × DEF (${def}) = ${defDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
        </>
      );
    }

    case 'Alchimiste': {
      const { cycleLength, fireCapScale, lifeCapScale, acidDefReduction, acidRescReduction } = classConstants.alchimiste;
      const fireBonus = Math.round(fireCapScale * cap);
      const fireTotal = auto + fireBonus;
      const lifeBonus = Math.round(lifeCapScale * cap);
      const lifeTotal = lifeBonus;
      const defRedPct = Math.round((acidDefReduction ?? 0) * 100);
      const resRedPct = Math.round((acidRescReduction ?? 0) * 100);
      return (
        <>
          Cycle de {cycleLength} flasques :
          <br />
          Feu :{' '}
          <Tooltip content={`Auto (${auto}) + ${formatPercent(fireCapScale)}% × Cap (${cap}) = ${fireBonus}`}>
            <span className="text-green-400">{fireTotal}</span>
          </Tooltip>
          {' '}dégâts
          <br />
          Vie :{' '}
          <Tooltip content={`Soin = ${formatPercent(lifeCapScale)}% × Cap (${cap}) = ${lifeBonus}`}>
            <span className="text-green-400">{lifeTotal}</span>
          </Tooltip>
          {' '}soins
          <br />
          Acide : inflige{' '}
          <Tooltip content={`Auto : ${auto}`}>
            <span className="text-green-400">{auto}</span>
          </Tooltip>
          {' '}dégâts, réduit DEF de <span className="text-green-400">{defRedPct}%</span> et ResC de <span className="text-green-400">{resRedPct}%</span>
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
  const rescap = safe(stats, 'rescap');
  const Tooltip = SharedTooltip;
  const c = getSubclassCapacityConstants(className, subclassId);

  /** Passif Bastion +8% DEF (même affichage que la classe de base), en retirant le % DEF Collège si besoin */
  const bastionSubclassPassiveBlock = (scId) => {
    const p = classConstants.bastion.defPercentBonus ?? 0;
    const subDefPct = getSubclassStatBonuses(scId)?.def ?? 0;
    const defAfterBastion = subDefPct > 0 ? Math.round(def / (1 + subDefPct)) : def;
    const defBeforePassive = p > 0 ? Math.round(defAfterBastion / (1 + p)) : defAfterBastion;
    const defBonusValue = Math.max(0, defAfterBastion - defBeforePassive);
    return (
      <>
        Passif: DEF{' '}
        <Tooltip content={p > 0 ? `${Math.round(p * 100)}% × DEF (${defBeforePassive}) = +${defBonusValue}` : ''}>
          <span className="text-green-400">+{defBonusValue}</span>
        </Tooltip>
        <br />
      </>
    );
  };

  switch (subclassId) {
    case 'maitre_armes': {
      const capDmg = Math.round((c.capScale ?? 0) * cap);
      const total = auto + capDmg;
      return (
        <>
          Ignore totalement la def/resC et inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${formatPercent(c.capScale)}% × Cap (${cap}) = ${capDmg}`}>
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
          Frappe la résistance la plus faible. Ignore{' '}
          <Tooltip content={`Base ${formatPercent(c.ignoreBase)}% + ${formatPercent(c.ignorePerCap)}% × Cap (${cap})`}>
            <span className="text-green-400">{ignoreTotalPct}%</span>
          </Tooltip>
          {' '}de la résistance ennemie. Bouclier de{' '}
          <Tooltip content={`${formatPercent(c.shieldAutoPercent)}% × Auto (${auto}) + ${formatPercent(c.shieldCapPercent)}% × Cap (${cap})`}>
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
          <Tooltip content={`Base ${formatPercent(c.reflectBase)}% + ${formatPercent(c.reflectPerCap)}% × Cap (${cap})`}>
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
          <Tooltip content={`Base ${formatPercent(c.reflectBase)}% + ${formatPercent(c.reflectPerCap)}% × Cap (${cap})`}>
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
      const hit2Total = hit2Auto + hit2Cap;
      return (
        <>
          Deux tirs : 100% Auto puis{' '}
          <Tooltip content={`${formatPercent(c.hit2AutoMultiplier)}% × Auto (${auto}) = ${hit2Auto} + ${formatPercent(c.hit2CapMultiplier)}% × Cap (${cap}) = ${hit2Cap}`}>
            <span className="text-green-400">{hit2Total}</span>
          </Tooltip>
          .
        </>
      );
    }
    case 'chasseur_fantome': {
      const ghostPct = Math.round((c.ghostHunterCapBonus ?? 0) * 100);
      const hit2Auto = Math.round((c.hit2AutoMultiplier ?? 0) * auto);
      const hit2Cap = Math.round((c.hit2CapMultiplier ?? 0) * cap);
      const hit2Total = hit2Auto + hit2Cap;
      return (
        <>
          Après un crit : +<span className="text-green-400">{ghostPct}%</span> CAP.
          {' '}Deux tirs : 100% Auto puis{' '}
          <Tooltip content={`${formatPercent(c.hit2AutoMultiplier)}% × Auto (${auto}) = ${hit2Auto} + ${formatPercent(c.hit2CapMultiplier)}% × Cap (${cap}) = ${hit2Cap}`}>
            <span className="text-green-400">{hit2Total}</span>
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
          <Tooltip content={`Auto (${auto}) + ${formatPercent(c.capBase)}% × Cap (${cap}) = ${spellDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          . Débuff: +<span className="text-green-400">{stackPct}%</span> dégâts subis (cumulable).
        </>
      );
    }
    case 'sorcier_neant': {
      const spellDmg = Math.round((c.capBase ?? 0) * cap);
      const total = auto + spellDmg;
      return (
        <>
          Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${formatPercent(c.capBase)}% × Cap (${cap}) = ${spellDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          .{' '}
          <Tooltip content="Effet permanent appliqué à chaque lancement de la capacité.">
            <span className="text-purple-400 underline decoration-dotted cursor-help">Brûlure du Néant</span>
          </Tooltip>
          {' '}: ennemi perd <span className="text-green-400">2%</span> PV actuels/tour, <span className="text-red-400">-10%</span> dégâts auto.
        </>
      );
    }
    case 'maitre_invocateur': {
      const familierPct = (c.capBase ?? 0) + (c.capPerCap ?? 0) * cap;
      const familierDmg = Math.round(familierPct * cap);
      const ignorePct = Math.round((c.ignoreResist ?? 0) * 100);
      const stackPct = formatPercent(c.stackPerAuto);
      return (
        <>
          Chaque tour, familier inflige{' '}
          <Tooltip content={`${familierDmg} dégâts | ${formatPercent(familierPct)}% × Cap (${cap}) | +${stackPct}% Cap/auto (cumulable) | Ignore ${ignorePct}% ResC`}>
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
      const stackPct = formatPercent(c.stackPerAuto);
      const stealPct = Math.round((c.capStealPercent ?? 0) * 100);
      return (
        <>
          Chaque tour, familier inflige{' '}
          <Tooltip content={`${familierDmg} dégâts | ${formatPercent(familierPct)}% × Cap (${cap}) | +${stackPct}% Cap/auto | Ignore ${ignorePct}% ResC`}>
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
          Après capacité subie : bouclier{' '}
          <Tooltip content={`${shieldDmgPct}% dégâts + ${formatPercent(c.shieldFromCap)}% × Cap (${cap})`}>
            <span className="text-green-400">{shieldDmgPct}% + {shieldCapVal}</span>
          </Tooltip>
          , réduit les dégâts d&apos;un sort sur deux de <span className="text-green-400">{nextSpellPct}%</span> (pas de cumul).
          {' '}Réduit les soins adverses de <span className="text-green-400">{antiHealPct}%</span>.
          {' '}Auto ={' '}
          <Tooltip content={`Auto (${auto}) + ${formatPercent(c.autoCapBonus)}% × Cap (${cap}) = ${autoBonusVal}`}>
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
          Après capacité subie : bouclier{' '}
          <Tooltip content={`${shieldDmgPct}% dégâts + ${formatPercent(c.shieldFromCap)}% × Cap (${cap})`}>
            <span className="text-green-400">{shieldDmgPct}% + {shieldCapVal}</span>
          </Tooltip>
          , augmente votre DEF de <span className="text-green-400">{defStackPct}%</span> (cumulable).
          {' '}Réduit les soins adverses de <span className="text-green-400">{antiHealPct}%</span>.
          {' '}Auto ={' '}
          <Tooltip content={`Auto (${auto}) + ${formatPercent(c.autoCapBonus)}% × Cap (${cap}) = ${autoBonusVal}`}>
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
          <Tooltip content={`Auto (${auto}) + ${formatPercent(c.capScale)}% × Cap (${cap}) = ${capDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          . La prochaine attaque adverse inflige{' '}
          <span className="text-red-400">-{nextPct}%</span> dégâts et réduit l'Auto ennemi de{' '}
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
          <Tooltip content={`Auto (${auto}) + ${formatPercent(c.capScale)}% × Cap (${cap}) = ${capDmg}`}>
            <span className="text-green-400">{total}</span>
          </Tooltip>
          . La prochaine attaque adverse inflige{' '}
          <span className="text-red-400">-{nextPct}%</span> dégâts.{' '}
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
          {bastionSubclassPassiveBlock('rempart_fer')}
          Bouclier initial{' '}
          <Tooltip content={`${formatPercent(c.startShieldFromDef)}% × DEF (${def})`}>
            <span className="text-green-400">{shieldVal}</span>
          </Tooltip>
          . Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${formatPercent(c.capScale)}% × Cap (${cap}) = ${capDmg} + ${formatPercent(c.defScale)}% × DEF (${def}) = ${defDmg}`}>
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
          {bastionSubclassPassiveBlock('mur_implacable')}
          Bouclier initial{' '}
          <Tooltip content={`${formatPercent(c.startShieldFromDef)}% × DEF (${def})`}>
            <span className="text-green-400">{shieldVal}</span>
          </Tooltip>
          .{' '}
          <Tooltip content="Vous attaquez avant l'ennemi le tour où la capacité est utilisée, peu importe la vitesse.">
            <span className="text-purple-400 underline decoration-dotted cursor-help">Priorité au tour capacité</span>
          </Tooltip>
          . Inflige{' '}
          <Tooltip content={`Auto (${auto}) + ${formatPercent(c.capScale)}% × Cap (${cap}) = ${capDmg} + ${formatPercent(c.defScale)}% × DEF (${def}) = ${defDmg}`}>
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
          <Tooltip content={`${formatPercent(c.capScale)}% × Cap (${cap})`}>
            <span className="text-green-400">{healCap}</span>
          </Tooltip>
          . Bouclier{' '}
          <Tooltip content={`${formatPercent(c.capShieldPercent)}% × Cap (${cap})`}>
            <span className="text-green-400">{shieldCap}</span>
          </Tooltip>
          {' '}au soin.{' '}
          <Tooltip content="Les soins excédentaires (au-delà du PV max) sont convertis en bouclier.">
            <span className="text-purple-400 underline decoration-dotted cursor-help">Overheal → bouclier</span>
          </Tooltip>.
        </>
      );
    }
    case 'latum': {
      const missingDmgPct = Math.round((c.missingHpDamagePercent ?? 0) * 100);
      const healCap = Math.round((c.capScale ?? 0) * cap);
      const missingHealPct = Math.round((c.missingHpPercent ?? 0) * 100);
      return (
        <>
          Inflige <span className="text-green-400">{missingDmgPct}%</span> PV manquants en dégâts, puis soigne {missingHealPct}% PV manquants +{' '}
          <Tooltip content={`${formatPercent(c.capScale)}% × Cap (${cap})`}>
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
      const defReductionPct = Math.round((1 - (c.defMultiplier ?? 1)) * 100);
      const autoIncreasePct = Math.round(((c.autoMultiplier ?? 1) - 1) * 100);
      return (
        <>
          Renvoie{' '}
          <Tooltip content={`Base ${returnBasePct}% + ${formatPercent(c.returnPerCap)}% × Cap (${cap})`}>
            <span className="text-green-400">{returnTotalPct}%</span>
          </Tooltip>
          {' '}dégâts accumulés + <span className="text-green-400">{formatPercent(c.returnPerCap)}%</span> Cap.
          {' '}Soigne <span className="text-green-400">{healPct}%</span> des dégâts accumulés.
          {' '}Réduit votre DEF de <span className="text-red-400">{defReductionPct}%</span> mais augmente votre Auto de{' '}
          <span className="text-green-400">{autoIncreasePct}%</span> pour le reste du combat.
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
          <Tooltip content={`Base ${returnBasePct}% + ${formatPercent(c.returnPerCap)}% × Cap (${cap})`}>
            <span className="text-green-400">{returnTotalPct}%</span>
          </Tooltip>
          {' '}dégâts accumulés + <span className="text-green-400">{formatPercent(c.returnPerCap)}%</span> Cap.
          {' '}Soigne <span className="text-green-400">{healPct}%</span> des dégâts accumulés.
          {' '}Chaque Purge augmente votre DEF et ResC de <span className="text-green-400">{stackPct}%</span>.
        </>
      );
    }
    case 'assassin': {
      const critBonusPct = Math.round((c.critPerCap ?? 0) * cap * 100);
      return (
        <>
          Esquive 1 coup. +<span className="text-green-400">{c.spdBonus ?? 0}</span> VIT, +{' '}
          <Tooltip content={`${formatPercent(c.critPerCap)}% × Cap (${cap})`}>
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
          Esquive 1 coup. +<span className="text-green-400">{c.spdBonus ?? 0}</span> VIT, +{' '}
          <Tooltip content={`${formatPercent(c.critPerCap)}% × Cap (${cap})`}>
            <span className="text-green-400">{critBonusPct}%</span>
          </Tooltip>
          {' '}crit.{' '}
          <Tooltip content="Vole 8% d'une stat aléatoire de l'ennemi (Auto/Déf/Cap/ResC/Vit) à chaque esquive.">
            <span className="text-purple-400 underline decoration-dotted cursor-help">Vol de stat</span>
          </Tooltip>.
        </>
      );
    }

    case 'maitre_alchimiste':
    case 'alchimiste_metal': {
      const cycleLen = c.cycleLength ?? 3;
      const fireBonus = Math.round((c.fireCapScale ?? 0) * cap);
      const fireTotal = auto + fireBonus;
      const lifeBonus = Math.round((c.lifeCapScale ?? 0) * cap);
      const lifeTotal = lifeBonus;
      const defRedPct = Math.round((c.acidDefReduction ?? 0) * 100);
      const resRedPct = Math.round((c.acidRescReduction ?? 0) * 100);

      const hasMetal = cycleLen >= 4;
      const stunDur = c.metalStunDuration ?? classConstants.alchimiste.metalStunDuration;

      return (
        <>
          Cycle complet (1 flasque par tour, en boucle) :
          <br />
          <span className="text-stone-300">Feu → Vie → Acide{hasMetal ? ' → Métal' : ''} → …</span>
          <br />
          Feu :{' '}
          <Tooltip content={`Auto (${auto}) + ${formatPercent(c.fireCapScale)}% × Cap (${cap}) = ${fireBonus}`}>
            <span className="text-green-400">{fireTotal}</span>
          </Tooltip>
          {' '}dégâts
          <br />
          Vie :{' '}
          <Tooltip content={`Soin = ${formatPercent(c.lifeCapScale)}% × Cap (${cap}) = ${lifeBonus}`}>
            <span className="text-green-400">{lifeTotal}</span>
          </Tooltip>
          {' '}soins
          <br />
          Acide : inflige{' '}
          <Tooltip content={`Auto : ${auto}`}>
            <span className="text-green-400">{auto}</span>
          </Tooltip>
          {' '}dégâts, réduit DEF de <span className="text-green-400">{defRedPct}%</span> et ResC de <span className="text-green-400">{resRedPct}%</span>
          {hasMetal ? (
            <>
              <br />
              Métal : inflige{' '}
              <Tooltip content={`Auto : ${auto}`}>
                <span className="text-green-400">{auto}</span>
              </Tooltip>
              {' '}dégâts et étourdit <span className="text-green-400">{stunDur}</span> tour
            </>
          ) : null}
        </>
      );
    }
    default:
      return <>{buildSubclassDescription(className, subclassId)}</>;
  }
}
