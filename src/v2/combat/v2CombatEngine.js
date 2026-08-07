/**
 * Moteur de combat V2 — rotation de sorts, pas de CD classiques.
 */

import { V2_SPELL_IDS, computeFinalStats, flattenSpellCycles, getSpellById, normalizeSpellCycles } from '../data/v2Kit';
import { createEmptyStatus, hasFureurSang, hasStigmate, tickStatuses } from './v2Status';

const MAX_TURNS = 40;

function physDamage(attacker, defender) {
  return Math.max(1, Math.round(attacker.base.auto - 0.5 * defender.base.def));
}

function magDamage(attacker, defender) {
  return Math.max(1, Math.round(attacker.base.cap - 0.5 * defender.base.rescap));
}

function outgoingMultiplier(attacker) {
  let m = 1;
  if (hasFureurSang(attacker.status) && attacker.currentHP <= attacker.maxHP * 0.5) {
    m *= 1.25;
  }
  return m;
}

function incomingMultiplier(defender) {
  let m = 1;
  if (hasStigmate(defender.status)) {
    m *= 1.15;
  }
  return m;
}

function applyDamage(attacker, defender, raw, log, label) {
  const dmg = Math.max(1, Math.round(raw * outgoingMultiplier(attacker) * incomingMultiplier(defender)));
  defender.currentHP = Math.max(0, defender.currentHP - dmg);
  defender.damageTakenSincePurge = (defender.damageTakenSincePurge || 0) + dmg;
  log.push(`${attacker.name} — ${label} : ${dmg} dégâts → ${defender.name} (${defender.currentHP}/${defender.maxHP} PV)`);
  return dmg;
}

/**
 * @returns {{ damageToEnemy: number, damageToPlayer: number, healToPlayer: number }}
 */
function castSpell(attacker, defender, spellId, log) {
  const spell = getSpellById(spellId);
  const spellName = spell?.name || spellId;
  log.push(`✨ ${attacker.name} lance ${spellName} !`);

  let damageToEnemy = 0;
  let damageToPlayer = 0;
  let healToPlayer = 0;

  const hitEnemy = (raw, label) => {
    const d = applyDamage(attacker, defender, raw, log, label);
    damageToEnemy += d;
    return d;
  };

  switch (spellId) {
    case V2_SPELL_IDS.FUREUR_SANG: {
      attacker.status.fureurSang = 3;
      log.push(`🔥 ${attacker.name} entre en Fureur du sang (3 tours).`);
      break;
    }
    case V2_SPELL_IDS.STIGMATE: {
      defender.status.stigmate = 4;
      log.push(`💠 ${defender.name} est marqué par Stigmate (4 tours, +15 % dégâts reçus).`);
      break;
    }
    case V2_SPELL_IDS.PLUIE_CELESTE: {
      hitEnemy(physDamage(attacker, defender), 'Pluie Céleste (1)');
      if (defender.currentHP > 0) {
        hitEnemy(Math.max(1, Math.round(physDamage(attacker, defender) * 0.7)), 'Pluie Céleste (2)');
      }
      break;
    }
    case V2_SPELL_IDS.PURGE_SANGLANTE: {
      const taken = attacker.damageTakenSincePurge || 0;
      const raw = Math.max(1, Math.round(taken * 0.07 + attacker.base.cap * 0.005));
      hitEnemy(raw, 'Purge sanglante');
      const heal = Math.max(0, Math.round(taken * 0.12));
      if (heal > 0) {
        attacker.currentHP = Math.min(attacker.maxHP, attacker.currentHP + heal);
        healToPlayer = heal;
        log.push(`💚 ${attacker.name} se soigne de ${heal} PV (${attacker.currentHP}/${attacker.maxHP}).`);
      }
      attacker.damageTakenSincePurge = 0;
      log.push(`🩸 Cumul de douleur remis à zéro.`);
      break;
    }
    default: {
      hitEnemy(physDamage(attacker, defender), 'Attaque');
    }
  }

  if (!attacker.isPlayer) {
    damageToPlayer = damageToEnemy;
    damageToEnemy = 0;
  }

  return { damageToEnemy, damageToPlayer, healToPlayer };
}

function enemyAutoAttack(attacker, defender, log) {
  const raw = physDamage(attacker, defender);
  const dmg = applyDamage(attacker, defender, raw, log, 'Attaque');
  return { damageToEnemy: 0, damageToPlayer: dmg, healToPlayer: 0 };
}

export function preparerCombattantV2(prototype) {
  const base = computeFinalStats(prototype);
  const maxHP = base.hp;
  const spellOrder = flattenSpellCycles(normalizeSpellCycles(prototype));
  return {
    name: prototype.name || 'Revolte',
    isPlayer: true,
    base: { ...base },
    currentHP: maxHP,
    maxHP,
    spellOrder: spellOrder.length > 0 ? spellOrder : null,
    spellIndex: 0,
    damageTakenSincePurge: 0,
    status: createEmptyStatus(),
    characterImage: prototype.characterImage || null,
  };
}

export function preparerEnnemiV2(enemy) {
  const base = { ...enemy.base };
  const maxHP = base.hp;
  return {
    name: enemy.name || 'Ennemi',
    isPlayer: false,
    base,
    currentHP: maxHP,
    maxHP,
    spellOrder: null,
    spellIndex: 0,
    damageTakenSincePurge: 0,
    status: createEmptyStatus(),
    icon: enemy.icon || null,
  };
}

function nextPlayerSpellId(player) {
  if (!player.spellOrder?.length) return null;
  return player.spellOrder[player.spellIndex % player.spellOrder.length];
}

function takeTurn(attacker, defender, log) {
  attacker.status = tickStatuses(attacker.status);

  if (attacker.isPlayer && attacker.spellOrder?.length) {
    const spellId = attacker.spellOrder[attacker.spellIndex % attacker.spellOrder.length];
    attacker.spellIndex += 1;
    const fx = castSpell(attacker, defender, spellId, log);
    return { spellId, ...fx };
  }
  const fx = enemyAutoAttack(attacker, defender, log);
  return { spellId: null, ...fx };
}

export function simulerMatchV2(prototypeDoc, enemyRaw) {
  const player = preparerCombattantV2(prototypeDoc);
  const enemy = preparerEnnemiV2(enemyRaw);
  const log = [];
  const steps = [];

  log.push(`⚔️ ${player.name} vs ${enemy.name} !`);
  steps.push(snapshotStep(0, player, enemy, log[log.length - 1], {}));

  let turn = 0;
  while (turn < MAX_TURNS && player.currentHP > 0 && enemy.currentHP > 0) {
    turn += 1;
    log.push(`—— Tour ${turn} ——`);

    const playerFirst = player.base.spd >= enemy.base.spd;
    const order = playerFirst ? [player, enemy] : [enemy, player];

    for (const actor of order) {
      if (player.currentHP <= 0 || enemy.currentHP <= 0) break;
      const target = actor === player ? enemy : player;
      const fx = takeTurn(actor, target, log);
      steps.push(snapshotStep(turn, player, enemy, log[log.length - 1], fx));
    }
  }

  let winner = 'draw';
  if (player.currentHP <= 0 && enemy.currentHP <= 0) winner = 'draw';
  else if (enemy.currentHP <= 0) winner = 'player';
  else if (player.currentHP <= 0) winner = 'enemy';
  else {
    winner = player.currentHP >= enemy.currentHP ? 'player' : 'enemy';
    log.push(`⏱️ Limite de tours — décision aux PV restants.`);
  }

  if (winner === 'player') log.push(`🏆 Victoire de ${player.name} !`);
  else if (winner === 'enemy') log.push(`💀 Défaite… ${enemy.name} l’emporte.`);
  else log.push(`🤝 Match nul.`);

  return {
    winner,
    log,
    steps,
    playerFinal: { currentHP: player.currentHP, maxHP: player.maxHP },
    enemyFinal: { currentHP: enemy.currentHP, maxHP: enemy.maxHP },
    spellOrder: player.spellOrder ? [...player.spellOrder] : [],
  };
}

function snapshotStep(turn, player, enemy, lastLine, fx = {}) {
  return {
    turn,
    playerHP: player.currentHP,
    playerMaxHP: player.maxHP,
    enemyHP: enemy.currentHP,
    enemyMaxHP: enemy.maxHP,
    playerStatus: { ...player.status },
    enemyStatus: { ...enemy.status },
    line: lastLine,
    damageToEnemy: fx.damageToEnemy || 0,
    damageToPlayer: fx.damageToPlayer || 0,
    healToPlayer: fx.healToPlayer || 0,
    spellId: fx.spellId || null,
    nextSpellId: nextPlayerSpellId(player),
    spellOrder: player.spellOrder ? [...player.spellOrder] : [],
  };
}
