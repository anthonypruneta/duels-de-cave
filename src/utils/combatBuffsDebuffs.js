/**
 * Calcule la liste des buffs/debuffs à afficher sur une carte de personnage en combat.
 * - Effets venant de l'adversaire (opponent) : anti-heal, Brèche mentale (via combatModifiers).
 * - Effets sur le personnage (combatStatus) : étourdissement, saignement, marque spectrale, esquive, riposte, brûlure du Néant.
 *
 * @param {Object} opponent - L'adversaire qui applique des effets sur ce personnage
 * @param {Object} combatModifiers - Modificateurs déjà calculés (ex. { def: [{ label: 'Brèche mentale', value: -13 }] })
 * @param {Object} combatStatus - État de combat courant du personnage (stunned, bleed_stacks, spectralMarked, dodge, reflect, sorcierNeantBurn)
 * @returns {Array<{ id: string, icon: import('react').ReactNode, label: string, description: string }>}
 */
import React from 'react';
import { CendresBraisesCombatIcon } from '../components/CendresBraisesCombatIcon';
import { classConstants, raceConstants, weaponConstants } from '../data/combatMechanics';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';

function getPassiveDetails(p) {
  if (!p) return null;
  const base = getMageTowerPassiveById(p.id);
  const levelData = getMageTowerPassiveLevel(p.id, p.level);
  return base && levelData ? { ...base, levelData } : null;
}

export function getCombatBuffsDebuffs(opponent, combatModifiers, combatStatus = null) {
  const list = [];

  // --- Effets venant de l'adversaire (début de combat) ---

  // Anti-heal : adversaire Briseur de Sort et/ou Rituel de Fracture
  let healFactor = 1;
  const sources = [];
  if (opponent?.class === 'Briseur de Sort') {
    const pct = (classConstants.briseurSort?.antiHealReduction ?? 0) * 100;
    healFactor *= (1 - (classConstants.briseurSort?.antiHealReduction ?? 0));
    sources.push(`${Math.round(pct)}% (Briseur de Sort)`);
  }
  for (const p of [opponent?.mageTowerPassive, opponent?.mageTowerExtensionPassive].filter(Boolean)) {
    const det = getPassiveDetails(p);
    if (det?.id === 'rituel_fracture' && det.levelData?.healReduction != null) {
      const pct = Math.round(det.levelData.healReduction * 100);
      healFactor *= (1 - det.levelData.healReduction);
      sources.push(`${pct}% (Rituel de Fracture)`);
    }
  }
  if (sources.length > 0) {
    const totalPct = Math.round((1 - healFactor) * 100);
    list.push({
      id: 'anti_heal',
      icon: '🚫',
      label: `Soins reçus -${totalPct}%`,
      description: `Vos soins sont réduits de ${totalPct}% : ${sources.join(', ')}.`,
    });
  }

  // Brèche mentale (réduction DEF)
  const defMods = combatModifiers?.def;
  if (defMods?.length) {
    for (const m of defMods) {
      if (m.label === 'Brèche mentale' && m.value < 0) {
        list.push({
          id: 'mind_breach_def',
          icon: '🧠',
          label: `Déf ${m.value}`,
          description: `Brèche mentale : Défense réduite de ${-m.value} points.`,
        });
        break;
      }
    }
  }

  // --- Debuff Gungnir (lance) : Auto -10% ---
  if (combatStatus?.gungnirDebuffed) {
    list.push({
      id: 'gungnir_debuff',
      icon: '🔱',
      label: 'Gungnir : -10% Auto',
      description: 'Serment d\'Odin : votre Attaque a été réduite de 10% par la lance légendaire (permanent ce combat).',
    });
  }

  // --- Effets sur le personnage (état de combat courant) ---
  if (combatStatus) {
    if (combatStatus.stunned && combatStatus.stunnedTurns > 0) {
      list.push({
        id: 'stun',
        icon: '😵',
        label: `Étourdissement (${combatStatus.stunnedTurns} tour${combatStatus.stunnedTurns > 1 ? 's' : ''})`,
        description: `Vous ne pouvez pas agir pendant ${combatStatus.stunnedTurns} tour(s).`,
      });
    }
    if ((combatStatus.bleed_stacks ?? 0) > 0) {
      const stacks = combatStatus.bleed_stacks;
      const pct = combatStatus.bleedPercentPerStack ? Math.round(combatStatus.bleedPercentPerStack * 100) : null;
      list.push({
        id: 'bleed',
        icon: '🩸',
        label: pct ? `Saignement (${stacks} × ${pct}%)` : `Saignement (${stacks})`,
        description: pct
          ? `Vous subissez des dégâts de saignement chaque tour (${stacks} stack(s), ${pct}% PV max par stack).`
          : `Vous subissez des dégâts de saignement chaque tour (${stacks} stack(s)).`,
      });
    }
    if (combatStatus.spectralMarked && (combatStatus.spectralMarkBonus ?? 0) > 0) {
      const pct = Math.round((combatStatus.spectralMarkBonus ?? 0) * 100);
      list.push({
        id: 'spectral_mark',
        icon: '🟣',
        label: `Marque spectrale (+${pct}% dégâts)`,
        description: `Vous subissez ${pct}% de dégâts en plus jusqu'à la fin du tour.`,
      });
    }
    if (combatStatus.dodge) {
      list.push({
        id: 'dodge',
        icon: '💨',
        label: 'Esquive',
        description: 'La prochaine attaque physique qui vous cible sera esquivée.',
      });
    }
    if (typeof combatStatus.reflect === 'number' && combatStatus.reflect > 0) {
      const pct = Math.round(combatStatus.reflect * 100);
      list.push({
        id: 'reflect',
        icon: '🦑',
        label: `Riposte (${pct}%)`,
        description: `Vous renverrez ${pct}% des dégâts reçus au prochain coup.`,
      });
    }
    if (combatStatus.sorcierNeantBurn) {
      list.push({
        id: 'sorcier_neant_burn',
        icon: '🌑',
        label: 'Brûlure du Néant',
        description: 'Vous perdez 1,5% de vos PV actuels au début de chaque tour et infligez moins de dégâts avec vos attaques.',
      });
    }
    if (combatStatus.undead) {
      list.push({
        id: 'undead',
        icon: '🧟',
        label: 'Ressuscité',
        description: 'Mort-vivant : vous avez été ressuscité et combattez avec une partie de vos PV.',
      });
    }
    if (combatStatus.boneGuardActive) {
      list.push({
        id: 'bone_guard',
        icon: '💀',
        label: 'Garde des Os',
        description: 'Sous 40% PV : carapace renforcée, réduction des dégâts reçus.',
      });
    }
    if ((combatStatus.sireneStacks ?? 0) > 0) {
      const n = combatStatus.sireneStacks;
      list.push({
        id: 'sirene_stacks',
        icon: '🧜',
        label: `Sirène (${n} stack${n > 1 ? 's' : ''})`,
        description: `Bonus CAP et soins par stack Sirène (${n} stack(s)).`,
      });
    }

    // Pointeau ADN / Orc : coups subis réduits (incomingHitCountRemaining)
    const awIncoming = combatStatus.awakening;
    if (
      awIncoming &&
      typeof awIncoming.incomingHitCountRemaining === 'number' &&
      awIncoming.incomingHitCountRemaining > 0 &&
      typeof awIncoming.incomingHitMultiplier === 'number'
    ) {
      const n = awIncoming.incomingHitCountRemaining;
      const multPct = Math.round(awIncoming.incomingHitMultiplier * 100);
      list.push({
        id: 'orc_incoming_reduction',
        icon: '🪓',
        label: `Coups amortis (${n})`,
        description: `Les ${n} prochain(s) coup(s) subi(s) n'infligent que ${multPct}% des dégâts bruts (Orc / Pointeau ADN).`,
      });
    }

    // Pointeau ADN / Mindflayer : vol de sort
    if (combatStatus.mindflayerCopyState === 'pending') {
      list.push({
        id: 'mindflayer_copy_pending',
        icon: '🦑',
        label: 'Vol psychique (prêt)',
        description:
          'La première capacité ennemie qui vous cible sera copiée et relancée (Mindflayer / Pointeau ADN).',
      });
    } else if (combatStatus.mindflayerCopyState === 'used') {
      list.push({
        id: 'mindflayer_copy_used',
        icon: '🦑',
        label: 'Vol psychique (copié)',
        description: 'Vous avez déjà copié une capacité adverse ce combat.',
      });
    }

    // Pointeau ADN / Turtlekin : plafond du premier coup + réarmement éventuel
    const tkCap = combatStatus.turtlekinFirstHitCapPercent;
    if (typeof tkCap === 'number' && tkCap > 0) {
      if (!combatStatus.turtlekinFirstHitUsed) {
        list.push({
          id: 'turtlekin_shell_ready',
          icon: '🐢',
          label: `Carapace (coup > ${Math.round(tkCap * 100)}% → ${Math.round(tkCap * 100)}%)`,
          description: `Le premier coup reçu qui inflige plus de ${Math.round(tkCap * 100)}% de vos PV max est réduit à ${Math.round(tkCap * 100)}% (Turtlekin / Pointeau ADN).`,
        });
      } else if (combatStatus.turtlekinResetAt50 && !combatStatus.turtlekinResetAt50Used) {
        list.push({
          id: 'turtlekin_shell_reset_pending',
          icon: '🐢',
          label: 'Carapace (réarmement 50% PV)',
          description:
            'Votre carapace peut se réinitialiser une fois quand vous passez sous 50% PV pour la première fois.',
        });
      }
    }

    if (combatStatus.succubeWeakenNextAttack) {
      list.push({
        id: 'succube_weaken',
        icon: '😈',
        label: 'Attaque adverse affaiblie',
        description: 'La prochaine attaque physique de l\'adversaire infligera 50% de dégâts en moins.',
      });
    }
    if ((combatStatus.pacteSombreCapStolen ?? 0) > 0) {
      const total = combatStatus.pacteSombreCapStolen;
      list.push({
        id: 'pacte_sombre_stolen',
        icon: '🌑',
        label: `Pacte Sombre: +${total} CAP volée`,
        description: `Votre familier a volé au total ${total} points de Cap à l'adversaire (3% par coup).`,
      });
    }
    if ((combatStatus.pacteSombreCapLost ?? 0) > 0) {
      const total = combatStatus.pacteSombreCapLost;
      list.push({
        id: 'pacte_sombre_lost',
        icon: '🌑',
        label: `Pacte Sombre: -${total} CAP`,
        description: `L'adversaire (Pacte Sombre) vous a drainé au total ${total} points de Cap (3% par coup du familier).`,
      });
    }
    if ((combatStatus.familiarStacks ?? 0) > 0 || combatStatus.familiarPercent != null) {
      const n = combatStatus.familiarStacks ?? 0;
      const pct = combatStatus.familiarPercent != null ? combatStatus.familiarPercent.toFixed(1) : null;
      const dmg = combatStatus.familiarDamage != null ? combatStatus.familiarDamage : null;
      const labelParts = [`Familier`];
      if (n > 0) labelParts.push(`(${n} stack${n > 1 ? 's' : ''})`);
      if (pct != null) labelParts.push(`${pct}%`);
      if (dmg != null) labelParts.push(`→ ${dmg}`);
      const descParts = ['Démoniste : votre familier inflige des dégâts chaque tour.'];
      if (pct != null) descParts.push(` Actuellement ${pct}% de votre Cap.`);
      if (dmg != null) descParts.push(` Dégâts actuels : ${dmg}.`);
      if (n > 0) {
        const stackPctDisplay = ((classConstants.demoniste?.stackPerAuto ?? 0.008) * 100) % 1 === 0 ? String(Math.round((classConstants.demoniste?.stackPerAuto ?? 0.008) * 100)) : ((classConstants.demoniste?.stackPerAuto ?? 0.008) * 100).toFixed(1);
        descParts.push(` Bonus : +${stackPctDisplay}% Cap par auto (${n} stack(s)).`);
      }
      list.push({
        id: 'familiar_stacks',
        icon: '🐾',
        label: labelParts.join(' '),
        description: descParts.join(''),
      });
    }
    if (typeof combatStatus.nextSpellReduction === 'number' && combatStatus.nextSpellReduction > 0) {
      const pct = Math.round(combatStatus.nextSpellReduction * 100);
      list.push({
        id: 'next_spell_reduction',
        icon: '📐',
        label: `Prochain sort -${pct}%`,
        description: `Stratège Arcanique : les dégâts du prochain sort que vous subissez sont réduits de ${pct}% (puis pas de nouvelle réduction avant le sort suivant).`,
      });
    }
    if (combatStatus.onctionLastStandUsed) {
      list.push({
        id: 'onction_debuff',
        icon: '📉',
        label: 'Onction : -dégâts',
        description: 'Onction d\'Éternité : vous avez survécu à 1 PV. Vos dégâts infligés sont réduits jusqu\'à la fin du combat.',
      });
    }
    // Buff Dragonkin éveillé (écaille) : +X% dégâts par stack de dégâts reçus
    const aw = combatStatus.awakening;
    if (aw && typeof aw.damageStackBonus === 'number' && aw.damageStackBonus > 0) {
      const stacks = aw.damageTakenStacks ?? 0;
      const bonusPct = Math.round(aw.damageStackBonus * 100 * stacks);
      list.push({
        id: 'dragonkin_awakening',
        icon: '🐲',
        label: bonusPct > 0 ? `Écailles (+${bonusPct}% dégâts)` : 'Écailles',
        description: bonusPct > 0
          ? `Dragonkin éveillé : +${Math.round(aw.damageStackBonus * 100)}% dégâts infligés par dégât reçu. Actuellement +${bonusPct}% (${stacks} stack(s)).`
          : `Dragonkin éveillé : +${Math.round(aw.damageStackBonus * 100)}% dégâts infligés par dégât reçu (cumulable).`,
      });
    }

    // Écho de Guerre : stacks d'Auto
    if ((combatStatus._echoStacks ?? 0) > 0) {
      const n = combatStatus._echoStacks;
      list.push({
        id: 'echo_guerre',
        icon: '⚔️',
        label: `Écho de Guerre (${n} stack${n > 1 ? 's' : ''})`,
        description: `Écho de Guerre : votre Auto augmente à chaque attaque (${n} stack(s)).`,
      });
    }

    // Sceptre du Roi-Sorcier : stacks de CAP (valeur depuis équilibrage : 0.08 ou 10 pour 10%)
    if (combatStatus.weaponState?.counters?.sceptreCapStacks > 0) {
      const n = combatStatus.weaponState.counters.sceptreCapStacks;
      const pctRaw = weaponConstants?.sceptreRoiSorcier?.capStackPercent ?? 0.08;
      const pctDisplay = pctRaw > 1 ? pctRaw : Math.round(pctRaw * 100);
      list.push({
        id: 'sceptre_stacks',
        icon: '🏆',
        label: `Sceptre (+${n * pctDisplay}% CAP)`,
        description: `Sceptre du Roi-Sorcier : chaque capacité augmente votre CAP de ${pctDisplay}% (${n} stack(s)).`,
      });
    }

    // Cendrés : braises (pool au 1er sort du tour, recharge au début de votre action)
    if (typeof combatStatus.cendresHpDamageThreshold === 'number' && combatStatus.cendresHpDamageThreshold > 0) {
      const pool = combatStatus.cendresPool ?? 0;
      const first = !!combatStatus.cendresFirstSpellThisTurn;
      const cum = combatStatus.cendresCumulativeHpDamage ?? 0;
      const maxHp = combatStatus.cendresMaxHpRef ?? 1;
      const th = combatStatus.cendresHpDamageThreshold;
      const mult = combatStatus.cendresBraiseSpellMult ?? raceConstants.cendres.braisMultPerBraiseRacial;
      const g = combatStatus.cendresGuaranteedPerTurn ?? raceConstants.cendres.guaranteedBraisesPerTurnRacial;
      const pctTh = Math.round(th * 100);
      const pctMult = Math.round(mult * 100);
      const chunk = th * maxHp;
      const braisesFromHp = chunk > 0 ? Math.floor(cum / chunk) : 0;
      const used = combatStatus.cendresBraisesHpConsumed ?? 0;
      const banked = Math.max(0, braisesFromHp - used);
      const label =
        first && pool > 0
          ? `Braises (${pool})`
          : first
            ? 'Braises (0)'
            : 'Braises (dépensées)';
      const descParts = [
        `Cendrés : au début de votre tour d’action, vous regagnez ${g} braise(s) garantie(s) plus les braises gagnées via les PV que vous avez perdus (${pctTh}% des PV max par braise, non consommées reportées).`,
        `Le premier sort du tour (dégâts ou soin) consomme tout le pool et applique +${pctMult}% par braise.`,
        `Prochaines braises HP déjà « banquées » pour le prochain refresh : ${banked}. Dégâts PV cumulés (référence) : ${Math.round(cum)}.`,
      ];
      list.push({
        id: 'cendres_braises',
        icon: React.createElement(CendresBraisesCombatIcon, {
          pool,
          firstSpellThisTurn: first,
          cumulativeHpDamage: cum,
          threshold: th,
          maxHpRef: maxHp,
        }),
        label,
        description: descParts.join(' '),
      });
    }

    // Reflet Maudit (sur l'adversaire) : réduction de crit
    if ((combatStatus._refletMauditCritMalus ?? 0) > 0) {
      const pct = Math.round(combatStatus._refletMauditCritMalus * 100);
      list.push({
        id: 'reflet_maudit_crit',
        icon: '🪞',
        label: `Crit -${pct}%`,
        description: `Reflet Maudit : votre chance de critique a été réduite de ${pct}% (permanent).`,
      });
    }

    // Entrave Arcanique : capacité retardée
    if (combatStatus._entraveCdDelay > 0 && !combatStatus._entraveDelayConsumed) {
      list.push({
        id: 'entrave_arcanique',
        icon: '⛓️',
        label: 'Première capacité retardée',
        description: 'Entrave Arcanique : votre première capacité est retardée de 1 tour.',
      });
    }
  }

  return list;
}
