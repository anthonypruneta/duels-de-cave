/**
 * Snapshot d’état combat pour l’UI (barre PV, pastilles buff/debuff).
 * Doit rester aligné avec getCombatBuffsDebuffs() — notamment Pointeau ADN (Sirène, Orc, Turtlekin, Mindflayer, Dragonkin, Cendrés…).
 */
import { classConstants, raceConstants } from '../data/combatMechanics.js';

/**
 * @param {object|null|undefined} b - combattant préparé (tournamentCombat / coop)
 * @returns {object|undefined}
 */
export function snapshotCombatantStatusForUi(b) {
  if (!b) return undefined;

  const aw = b.awakening;
  let awakeningSnap = null;
  if (aw) {
    const parts = {};
    if (aw.damageStackBonus != null || (aw.damageTakenStacks ?? 0) !== 0) {
      parts.damageTakenStacks = aw.damageTakenStacks ?? 0;
      parts.damageStackBonus = aw.damageStackBonus ?? 0;
    }
    if (
      typeof aw.incomingHitCountRemaining === 'number' &&
      aw.incomingHitCountRemaining > 0 &&
      typeof aw.incomingHitMultiplier === 'number'
    ) {
      parts.incomingHitCountRemaining = aw.incomingHitCountRemaining;
      parts.incomingHitMultiplier = aw.incomingHitMultiplier;
    }
    if (Object.keys(parts).length > 0) awakeningSnap = parts;
  }

  let mindflayerCopyState = null;
  if (
    b.race === 'Mindflayer' ||
    aw?.mindflayerStealSpellCapDamageScale != null ||
    aw?.mindflayerCoopEchoCopyDamageMult != null
  ) {
    mindflayerCopyState = b.mindflayerCapacityCopyUsed ? 'used' : 'pending';
  }

  const turtlekinFirstHitCapPercent =
    typeof aw?.turtlekinFirstHitCapPercent === 'number' && aw.turtlekinFirstHitCapPercent > 0
      ? aw.turtlekinFirstHitCapPercent
      : null;

  const sceptreStacks = b.weaponState?.counters?.sceptreCapStacks ?? 0;

  const status = {
    stunned: !!b.stunned,
    stunnedTurns: b.stunnedTurns ?? 0,
    bleed_stacks: b.bleed_stacks ?? 0,
    bleedPercentPerStack: b.bleedPercentPerStack ?? 0,
    spectralMarked: !!b.spectralMarked,
    spectralMarkBonus: b.spectralMarkBonus ?? 0,
    dodge: !!b.dodge,
    reflect: typeof b.reflect === 'number' ? b.reflect : 0,
    sorcierNeantBurn: !!b.sorcierNeantBurn,
    undead: !!b.undead,
    boneGuardActive: !!b.boneGuardActive,
    sireneStacks: b.sireneStacks ?? 0,
    succubeWeakenNextAttack: !!b.succubeWeakenNextAttack,
    familiarStacks: b.familiarStacks ?? 0,
    nextSpellReduction: typeof b.nextSpellReduction === 'number' ? b.nextSpellReduction : 0,
    onctionLastStandUsed: !!b.onctionLastStandUsed,
    gungnirDebuffed: !!b.base?._gungnirDebuffed,
    awakening: awakeningSnap,
    mindflayerCopyState,
    turtlekinFirstHitCapPercent,
    turtlekinFirstHitUsed: !!b.turtlekinFirstHitUsed,
    turtlekinResetAt50Used: !!b.turtlekinResetAt50Used,
    turtlekinResetAt50: !!aw?.turtlekinResetAt50,
    _echoStacks: b._echoStacks ?? 0,
    _refletMauditCritMalus: b._refletMauditCritMalus ?? 0,
    _entraveCdDelay: b._entraveCdDelay ?? 0,
    _entraveDelayConsumed: !!b._entraveDelayConsumed,
    pacteSombreCapStolen: b.pacteSombreCapStolen ?? 0,
    pacteSombreCapLost: b.pacteSombreCapLost ?? 0,
    suddenDeath: !!b.suddenDeath,
  };

  if (sceptreStacks > 0) {
    status.weaponState = { counters: { sceptreCapStacks: sceptreStacks } };
  }

  if (b.class === 'Demoniste' && b.base) {
    const { capBase, capPerCap, stackPerAuto } = classConstants.demoniste;
    const cap = b.base.cap;
    const stacks = b.familiarStacks ?? 0;
    const familierPct = capBase + capPerCap * cap + stackPerAuto * stacks;
    status.familiarPercent = familierPct * 100;
    status.familiarDamage = Math.round(familierPct * cap);
  }

  if (aw?.cendresHpDamageThreshold) {
    status.cendresPool = b.cendresPool ?? 0;
    status.cendresFirstSpellThisTurn = !!b.cendresFirstSpellThisTurn;
    status.cendresCumulativeHpDamage = b.cendresCumulativeHpDamage ?? 0;
    status.cendresBraisesHpConsumed = b.cendresBraisesHpConsumed ?? 0;
    status.cendresHpDamageThreshold = aw.cendresHpDamageThreshold;
    status.cendresBraiseSpellMult =
      aw.cendresBraiseSpellMult ?? raceConstants.cendres.braisMultPerBraiseRacial;
    status.cendresGuaranteedPerTurn =
      aw.cendresBraiseGuaranteedEachTurn ?? raceConstants.cendres.guaranteedBraisesPerTurnRacial;
    status.cendresMaxHpRef = b._cendresMaxHpRef ?? b.maxHP ?? 1;
  }

  return status;
}
