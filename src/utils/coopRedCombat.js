/**
 * Combat coop 2 joueurs vs boss à rotation (donjon Rouge).
 * RNG déterministe : state.seed + state.rngCounter (incrémenté à chaque tirage).
 */
import { preparerCombattant } from './tournamentCombat';
import {
  dmgPhys,
  dmgCap,
  calcCritChance,
  getCritMultiplier,
  classConstants,
  cooldowns,
} from '../data/combatMechanics';
import { applyCoopAllyRaceEchoToRawCharacter } from './coopAllyRaceEcho';
import { buildCoopRedBossCombatants, getCoopRedLineup } from '../data/coopRedDungeon';

const MAX_ROUNDS = 80;
const MAX_LOG = 40;

const CLASS_TO_CD = {
  Guerrier: 'war',
  Voleur: 'rog',
  Paladin: 'pal',
  Healer: 'heal',
  Archer: 'arc',
  Mage: 'mag',
  Demoniste: 'dem',
  Masochiste: 'maso',
  Succube: 'succ',
  Bastion: 'bast',
  Alchimiste: 'alch',
  'Briseur de Sort': 'mag',
};

export function coopRand01(state) {
  const c = (state.rngCounter = (state.rngCounter || 0) + 1);
  let x = Math.imul(c ^ state.seed, 2246822519) ^ Math.imul(state.seed, 3266489917);
  x ^= x >>> 13;
  x = Math.imul(x, 2246822519);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function pushLog(state, line) {
  if (!state.log) state.log = [];
  state.log.push(line);
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

function cdKeyForClass(className) {
  return CLASS_TO_CD[className] || 'war';
}

export function rebuildPreparedCoop(hostSnap, guestSnap, difficulty) {
  const hostRaw = applyCoopAllyRaceEchoToRawCharacter(hostSnap, guestSnap?.race);
  const guestRaw = applyCoopAllyRaceEchoToRawCharacter(guestSnap, hostSnap?.race);
  const host = preparerCombattant(hostRaw);
  const guest = preparerCombattant(guestRaw);
  const bossRaws = buildCoopRedBossCombatants(difficulty);
  const bosses = bossRaws.map((b) => preparerCombattant(b));
  return { host, guest, bosses };
}

function syncHpFromState(fighter, currentHP) {
  fighter.currentHP = currentHP;
}

function getActiveBossIndex(state) {
  let idx = state.activeBossIndex % 3;
  for (let k = 0; k < 3; k++) {
    const i = (idx + k) % 3;
    if ((state.bossHP[i] ?? 0) > 0) return i;
  }
  return idx;
}

function allBossesDead(state) {
  return state.bossHP.every((hp) => hp <= 0);
}

function buildTurnQueue(state, host, guest, bosses) {
  const bi = getActiveBossIndex(state);
  const boss = bosses[bi];
  const bossHP = state.bossHP[bi] ?? 0;
  const actors = [];
  if ((state.hostHP ?? 0) > 0) actors.push({ key: 'host', spd: host.base.spd });
  if ((state.guestHP ?? 0) > 0) actors.push({ key: 'guest', spd: guest.base.spd });
  if (boss && bossHP > 0) actors.push({ key: 'boss', spd: boss.base.spd });
  actors.sort((a, b) => {
    if (b.spd !== a.spd) return b.spd - a.spd;
    const order = { host: 0, guest: 1, boss: 2 };
    return order[a.key] - order[b.key];
  });
  return actors.map((a) => a.key);
}

function applyOutgoingOrc(attacker, raw) {
  if (attacker.race === 'Orc' && attacker.currentHP < attacker.maxHP * 0.5) {
    return Math.round(raw * (attacker.awakening?.damageBonus ?? 1.2));
  }
  return raw;
}

function dealPhysToTargetFixed(attacker, defender, state, tag) {
  let raw = dmgPhys(attacker.base.auto, defender.base.def);
  raw = applyOutgoingOrc(attacker, raw);
  const crit = calcCritChance(attacker, defender);
  const isCrit = coopRand01(state) < crit;
  if (isCrit) {
    raw = Math.max(1, Math.round(raw * getCritMultiplier(attacker, defender)));
    pushLog(state, `${tag} 💥 Critique ! ${raw} dégâts physiques sur ${defender.name}`);
  } else {
    pushLog(state, `${tag} ⚔️ ${attacker.name} inflige ${raw} dégâts physiques à ${defender.name}`);
  }
  return raw;
}

function applySylvariRegen(fighter, state, tag) {
  if (fighter.race === 'Sylvari' || fighter.additionalAwakeningRaces?.includes?.('Sylvari')) {
    const pct = fighter.awakening?.regenPercent ?? 0.02;
    const heal = Math.max(1, Math.round(fighter.maxHP * pct));
    fighter.currentHP = Math.min(fighter.maxHP, fighter.currentHP + heal);
    pushLog(state, `${tag} 🌿 ${fighter.name} régénère ${heal} PV`);
  }
}

function processBossAttack(state, host, guest, bosses, lineup) {
  const bi = getActiveBossIndex(state);
  const boss = bosses[bi];
  const def = lineup[bi];
  boss.currentHP = state.bossHP[bi];
  const targetHost = state.bossNextTargetsHost;
  let defender = targetHost ? host : guest;
  let dodgeField = targetHost ? 'hostDodgeNext' : 'guestDodgeNext';
  if (defender.currentHP <= 0) {
    defender = targetHost ? guest : host;
    dodgeField = targetHost ? 'guestDodgeNext' : 'hostDodgeNext';
  }
  if (defender.currentHP <= 0) return;

  if (state[dodgeField]) {
    state[dodgeField] = false;
    pushLog(state, `💨 ${defender.name} esquive l’attaque de ${def.nom} !`);
    state.bossNextTargetsHost = !state.bossNextTargetsHost;
    state.activeBossIndex = (bi + 1) % 3;
    return;
  }

  const raw = dealPhysToTargetFixed(boss, defender, state, '🎯');
  defender.currentHP -= raw;
  if (defender === host) state.hostHP = defender.currentHP;
  else state.guestHP = defender.currentHP;

  if (defender.reflect && typeof defender.reflect === 'number' && defender.reflect > 0) {
    const refDmg = Math.max(1, Math.round(raw * defender.reflect));
    boss.currentHP -= refDmg;
    state.bossHP[bi] = boss.currentHP;
    pushLog(state, `🪞 Riposte : ${refDmg} dégâts à ${def.nom} !`);
    defender.reflect = 0;
  }

  state.bossNextTargetsHost = !state.bossNextTargetsHost;
  state.activeBossIndex = (bi + 1) % 3;
}

function healTarget(fighter, amount, state, tag) {
  const prev = fighter.currentHP;
  fighter.currentHP = Math.min(fighter.maxHP, fighter.currentHP + amount);
  const gained = fighter.currentHP - prev;
  if (gained > 0) pushLog(state, `${tag} 💚 ${fighter.name} récupère ${gained} PV`);
}

function processPlayerCapacity(state, actorKey, host, guest, bosses, lineup) {
  const fighter = actorKey === 'host' ? host : guest;
  const cd = actorKey === 'host' ? state.hostCd : state.guestCd;
  const key = cdKeyForClass(fighter.class);
  if ((cd[key] ?? 0) > 0) return false;

  const bi = getActiveBossIndex(state);
  const boss = bosses[bi];
  boss.currentHP = state.bossHP[bi];
  const tag = actorKey === 'host' ? '[Hôte]' : '[Invité]';

  switch (fighter.class) {
    case 'Guerrier': {
      const ign = classConstants.guerrier.ignoreBase + classConstants.guerrier.ignorePerCap * fighter.base.cap;
      const effDef = boss.base.def * (1 - Math.min(0.9, ign));
      let raw = dmgPhys(fighter.base.auto + classConstants.guerrier.autoBonus, effDef);
      raw = applyOutgoingOrc(fighter, raw);
      if (coopRand01(state) < calcCritChance(fighter, boss)) {
        raw = Math.max(1, Math.round(raw * getCritMultiplier(fighter, boss)));
      }
      boss.currentHP -= raw;
      state.bossHP[bi] = boss.currentHP;
      pushLog(state, `${tag} 🗡️ Frappe pénétrante ! ${raw} à ${lineup[bi].nom}`);
      break;
    }
    case 'Mage': {
      const spell = Math.round(
        fighter.base.auto * classConstants.mage.autoBase + fighter.base.cap * classConstants.mage.capBase
      );
      let raw = dmgCap(spell, boss.base.rescap);
      raw = applyOutgoingOrc(fighter, raw);
      if (coopRand01(state) < calcCritChance(fighter, boss)) {
        raw = Math.max(1, Math.round(raw * getCritMultiplier(fighter, boss)));
      }
      boss.currentHP -= raw;
      state.bossHP[bi] = boss.currentHP;
      pushLog(state, `${tag} 🔮 Sort magique ! ${raw} à ${lineup[bi].nom}`);
      break;
    }
    case 'Healer': {
      const missing = fighter.maxHP - fighter.currentHP;
      const fromMissing = Math.round(missing * classConstants.healer.missingHpPercent);
      const fromCap = Math.round(fighter.base.cap * classConstants.healer.capScale);
      healTarget(fighter, fromMissing + fromCap, state, tag);
      if (actorKey === 'host') state.hostHP = fighter.currentHP;
      else state.guestHP = fighter.currentHP;
      break;
    }
    case 'Archer': {
      let total = 0;
      let r1 = dmgPhys(Math.round(fighter.base.auto * classConstants.archer.hit1AutoMultiplier), boss.base.def);
      r1 = applyOutgoingOrc(fighter, r1);
      total += r1;
      let r2a = dmgPhys(Math.round(fighter.base.auto * classConstants.archer.hit2AutoMultiplier), boss.base.def);
      let r2b = dmgCap(Math.round(fighter.base.cap * classConstants.archer.hit2CapMultiplier), boss.base.rescap);
      r2a = applyOutgoingOrc(fighter, r2a);
      total += r2a + r2b;
      boss.currentHP -= total;
      state.bossHP[bi] = boss.currentHP;
      pushLog(state, `${tag} 🏹 Tir multiple ! ${total} à ${lineup[bi].nom}`);
      break;
    }
    case 'Voleur': {
      if (actorKey === 'host') state.hostDodgeNext = true;
      else state.guestDodgeNext = true;
      const raw = dealPhysToTargetFixed(fighter, boss, state, tag);
      boss.currentHP -= raw;
      state.bossHP[bi] = boss.currentHP;
      pushLog(state, `${tag} 🌀 Esquive préparée au prochain coup du boss !`);
      break;
    }
    case 'Paladin': {
      let raw = dealPhysToTargetFixed(fighter, boss, state, tag);
      boss.currentHP -= raw;
      state.bossHP[bi] = boss.currentHP;
      fighter.reflect = classConstants.paladin.reflectBase + classConstants.paladin.reflectPerCap * fighter.base.cap;
      pushLog(state, `${tag} 🛡️ Riposte ! ${Math.round(fighter.reflect * 100)}% renvoi sur le prochain coup du boss`);
      break;
    }
    case 'Demoniste': {
      let raw = dmgCap(
        Math.round(fighter.base.cap * classConstants.demoniste.capBase),
        boss.base.rescap * (1 - classConstants.demoniste.ignoreResist)
      );
      raw = applyOutgoingOrc(fighter, raw);
      boss.currentHP -= raw;
      state.bossHP[bi] = boss.currentHP;
      pushLog(state, `${tag} 💠 Familier ! ${raw} à ${lineup[bi].nom}`);
      break;
    }
    case 'Masochiste': {
      let raw = dealPhysToTargetFixed(fighter, boss, state, tag);
      raw = Math.round(raw * 1.15);
      boss.currentHP -= raw;
      state.bossHP[bi] = boss.currentHP;
      pushLog(state, `${tag} 🩸 Frappe intense ! ${raw} à ${lineup[bi].nom}`);
      break;
    }
    case 'Succube': {
      let raw = dmgCap(
        Math.round(fighter.base.auto + fighter.base.cap * classConstants.succube.capScale),
        boss.base.rescap
      );
      raw = applyOutgoingOrc(fighter, raw);
      boss.currentHP -= raw;
      state.bossHP[bi] = boss.currentHP;
      pushLog(state, `${tag} 💋 Coup de fouet ! ${raw} à ${lineup[bi].nom}`);
      break;
    }
    case 'Bastion': {
      let raw = dmgCap(
        Math.round(fighter.base.auto + fighter.base.cap * classConstants.bastion.capScale + fighter.base.def * classConstants.bastion.defScale),
        boss.base.rescap
      );
      raw = applyOutgoingOrc(fighter, raw);
      boss.currentHP -= raw;
      state.bossHP[bi] = boss.currentHP;
      pushLog(state, `${tag} 🏰 Charge du rempart ! ${raw} à ${lineup[bi].nom}`);
      break;
    }
    case 'Alchimiste': {
      const raw = dmgCap(
        Math.round(fighter.base.auto + fighter.base.cap * classConstants.alchimiste.fireCapScale),
        boss.base.rescap
      );
      boss.currentHP -= Math.max(1, raw);
      state.bossHP[bi] = boss.currentHP;
      pushLog(state, `${tag} 🧪 Flasque de feu ! ${raw} à ${lineup[bi].nom}`);
      break;
    }
    case 'Briseur de Sort': {
      let raw = dmgCap(Math.round(fighter.base.auto + fighter.base.cap * 0.5), boss.base.rescap);
      raw = applyOutgoingOrc(fighter, raw);
      boss.currentHP -= raw;
      state.bossHP[bi] = boss.currentHP;
      pushLog(state, `${tag} ✨ Sort brisé ! ${raw} à ${lineup[bi].nom}`);
      break;
    }
    default: {
      let raw = dealPhysToTargetFixed(fighter, boss, state, tag);
      boss.currentHP -= raw;
      state.bossHP[bi] = boss.currentHP;
      break;
    }
  }

  const cdBase = cooldowns[key] ?? 3;
  cd[key] = cdBase;
  if (actorKey === 'host') state.hostCd = { ...cd };
  else state.guestCd = { ...cd };
  return true;
}

function processPlayerAuto(state, actorKey, host, guest, bosses, lineup) {
  const fighter = actorKey === 'host' ? host : guest;
  const bi = getActiveBossIndex(state);
  const boss = bosses[bi];
  boss.currentHP = state.bossHP[bi];
  const tag = actorKey === 'host' ? '[Hôte]' : '[Invité]';
  const raw = dealPhysToTargetFixed(fighter, boss, state, tag);
  boss.currentHP -= raw;

  state.bossHP[bi] = boss.currentHP;
  if (actorKey === 'host') state.hostHP = fighter.currentHP;
  else state.guestHP = fighter.currentHP;
}

function tickCooldownsStartOfRound(state) {
  if (state.round <= 1) return;
  const h = { ...state.hostCd };
  const g = { ...state.guestCd };
  Object.keys(h).forEach((k) => {
    if (typeof h[k] === 'number' && h[k] > 0) h[k] -= 1;
  });
  Object.keys(g).forEach((k) => {
    if (typeof g[k] === 'number' && g[k] > 0) g[k] -= 1;
  });
  state.hostCd = h;
  state.guestCd = g;
}

/**
 * Crée l’état initial de combat (à persister dans la room).
 */
export function createCoopRedCombatState(hostSnap, guestSnap, difficulty, seed) {
  const { host, guest, bosses } = rebuildPreparedCoop(hostSnap, guestSnap, difficulty);
  const lineup = getCoopRedLineup(difficulty);
  const state = {
    seed: seed >>> 0,
    rngCounter: 0,
    round: 1,
    activeBossIndex: 0,
    bossNextTargetsHost: true,
    hostHP: host.currentHP,
    guestHP: guest.currentHP,
    hostMaxHP: host.maxHP,
    guestMaxHP: guest.maxHP,
    bossHP: bosses.map((b, i) => lineup[i].baseStats.hp),
    bossMaxHP: bosses.map((b, i) => lineup[i].baseStats.hp),
    turnQueue: [],
    turnQueueIndex: 0,
    pendingUserId: null,
    winner: null,
    hostCd: { ...host.cd },
    guestCd: { ...guest.cd },
    hostDodgeNext: false,
    guestDodgeNext: false,
    log: [],
  };

  syncHpFromState(host, state.hostHP);
  syncHpFromState(guest, state.guestHP);
  bosses.forEach((b, i) => {
    b.currentHP = state.bossHP[i];
  });

  pushLog(state, `⚔️ Rouge envoie ${lineup.map((l) => l.nom).join(', ')} !`);
  startNewRoundInternal(state, host, guest, bosses, lineup);
  return state;
}

function startNewRoundInternal(state, host, guest, bosses, lineup) {
  if (state.winner) return;
  if (allBossesDead(state)) {
    state.winner = 'players';
    state.pendingUserId = null;
    pushLog(state, '🏆 Victoire ! Tous les adversaires sont à terre !');
    return;
  }
  if (state.hostHP <= 0 || state.guestHP <= 0) {
    state.winner = 'boss';
    state.pendingUserId = null;
    pushLog(state, '💀 Défaite… Un héros est tombé.');
    return;
  }

  tickCooldownsStartOfRound(state);

  syncHpFromState(host, state.hostHP);
  syncHpFromState(guest, state.guestHP);
  bosses.forEach((b, i) => {
    b.currentHP = state.bossHP[i];
  });

  applySylvariRegen(host, state, '[Hôte]');
  applySylvariRegen(guest, state, '[Invité]');
  state.hostHP = host.currentHP;
  state.guestHP = guest.currentHP;

  state.turnQueue = buildTurnQueue(state, host, guest, bosses);
  state.turnQueueIndex = 0;
  pushLog(state, `--- Manche ${state.round} (ordre VIT) : ${state.turnQueue.join(' → ')} ---`);
}

/**
 * Avance le combat jusqu’au prochain input joueur ou fin.
 * @param {'auto'|'capacity'} actionType — ignoré si pendingUserId ne correspond pas (appelant doit vérifier)
 */
export function coopRedAdvance(state, hostSnap, guestSnap, difficulty, actingUserId, actionType) {
  const { host, guest, bosses } = rebuildPreparedCoop(hostSnap, guestSnap, difficulty);
  const lineup = getCoopRedLineup(difficulty);
  const hostId = hostSnap.userId;
  const guestId = guestSnap.userId;

  syncHpFromState(host, state.hostHP);
  syncHpFromState(guest, state.guestHP);
  bosses.forEach((b, i) => {
    b.currentHP = state.bossHP[i];
  });
  host.cd = { ...state.hostCd };
  guest.cd = { ...state.guestCd };

  if (state.winner) return state;

  const queue = state.turnQueue || [];
  let idx = state.turnQueueIndex ?? 0;

  while (!state.winner && idx < queue.length) {
    const actor = queue[idx];

    if (actor === 'boss') {
      processBossAttack(state, host, guest, bosses, lineup);
      state.hostHP = host.currentHP;
      state.guestHP = guest.currentHP;
      idx += 1;
      state.turnQueueIndex = idx;

      if (state.hostHP <= 0 || state.guestHP <= 0) {
        state.winner = 'boss';
        state.pendingUserId = null;
        pushLog(state, '💀 Défaite…');
        return state;
      }
      if (allBossesDead(state)) {
        state.winner = 'players';
        state.pendingUserId = null;
        pushLog(state, '🏆 Victoire !');
        return state;
      }
      continue;
    }

    const uid = actor === 'host' ? hostId : guestId;
    if (actingUserId && actingUserId !== uid) return state;
    if (!actingUserId) {
      state.pendingUserId = uid;
      return state;
    }
    if (actingUserId === uid && state.pendingUserId === uid) {
      if (actionType === 'capacity') {
        processPlayerCapacity(state, actor, host, guest, bosses, lineup);
      } else {
        processPlayerAuto(state, actor, host, guest, bosses, lineup);
      }
      state.hostHP = host.currentHP;
      state.guestHP = guest.currentHP;
      state.pendingUserId = null;
      idx += 1;
      state.turnQueueIndex = idx;

      if (state.hostHP <= 0 || state.guestHP <= 0) {
        state.winner = 'boss';
        state.pendingUserId = null;
        return state;
      }
      if (allBossesDead(state)) {
        state.winner = 'players';
        state.pendingUserId = null;
        return state;
      }
      continue;
    }

    return state;
  }

  if (idx >= queue.length && !state.winner) {
    state.round = (state.round || 1) + 1;
    if (state.round > MAX_ROUNDS) {
      state.winner = 'boss';
      state.pendingUserId = null;
      pushLog(state, '⏱️ Limite de manches atteinte.');
      return state;
    }
    startNewRoundInternal(state, host, guest, bosses, lineup);
    let inner = 0;
    while (!state.winner && state.pendingUserId == null && inner < 200) {
      coopRedAdvance(state, hostSnap, guestSnap, difficulty, null, null);
      inner++;
    }
  }

  return state;
}

/**
 * Premier tick après création état : résoudre tous les boss jusqu’au premier joueur.
 */
export function coopRedResolveFromNewState(state, hostSnap, guestSnap, difficulty) {
  let s = state;
  let guard = 0;
  while (!s.winner && s.pendingUserId == null && guard < 200) {
    const prev = s.rngCounter;
    s = coopRedAdvance(s, hostSnap, guestSnap, difficulty, null, null);
    if (s.rngCounter === prev && s.pendingUserId == null && !s.winner) break;
    guard++;
  }
  return s;
}

/**
 * Soumission joueur : applique l’action puis enchaîne boss / manche.
 */
export function coopRedSubmitPlayerAction(state, hostSnap, guestSnap, difficulty, userId, actionType) {
  let s = { ...state, log: [...(state.log || [])] };
  s = coopRedAdvance(s, hostSnap, guestSnap, difficulty, userId, actionType);
  let guard = 0;
  while (!s.winner && s.pendingUserId == null && guard < 200) {
    s = coopRedAdvance(s, hostSnap, guestSnap, difficulty, null, null);
    guard++;
  }
  return s;
}
