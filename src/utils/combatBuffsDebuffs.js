/**
 * Calcule la liste des buffs/debuffs à afficher sur une carte de personnage en combat.
 * - Effets venant de l'adversaire (opponent) : anti-heal, Brèche mentale (via combatModifiers).
 * - Effets sur le personnage (combatStatus) : étourdissement, saignement, marque spectrale, esquive, riposte, brûlure du Néant.
 *
 * @param {Object} opponent - L'adversaire qui applique des effets sur ce personnage
 * @param {Object} combatModifiers - Modificateurs déjà calculés (ex. { def: [{ label: 'Brèche mentale', value: -13 }] })
 * @param {Object} combatStatus - État de combat courant du personnage (stunned, bleed_stacks, spectralMarked, dodge, reflect, sorcierNeantBurn)
 * @returns {Array<{ id: string, icon: string, label: string, description: string }>}
 */
import { classConstants } from '../data/combatMechanics';
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
        description: 'Vous perdez 2% de vos PV max au début de chaque tour.',
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
        description: `Stratège Arcanique : les dégâts du prochain sort que vous subissez sont réduits de ${pct}%.`,
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
  }

  return list;
}
