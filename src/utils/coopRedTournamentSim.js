/**
 * Donjon Red coop : même moteur que le tournoi (processPlayerAction, armes, passifs, sous-classes).
 * 2 joueurs vs 3 boss en rotation (cible du boss alternée comme avant).
 */
import { runWithCombatRandom01 } from './combatRngContext.js';
import {
  processPlayerAction,
  applyStartOfCombatPassives,
  applyGnomeCapBonus,
  getPassiveDetailsList,
  getUnicornPactTurnDataFromList,
} from './tournamentCombat.js';
import { rebuildPreparedCoop } from './coopRedPrep.js';
import { getCoopRedLineup } from '../data/coopRedDungeon.js';
import { generalConstants, weaponConstants } from '../data/combatMechanics.js';

const MAX_COOP_TURNS = 250;

function createCoopSeededRng(seed) {
  let counter = 0;
  return {
    next01() {
      counter += 1;
      let x = Math.imul(counter ^ seed, 2246822519) ^ Math.imul(seed, 3266489917);
      x ^= x >>> 13;
      x = Math.imul(x, 2246822519);
      x ^= x >>> 16;
      return (x >>> 0) / 4294967296;
    },
    getCounter: () => counter,
  };
}

function getActiveBossIndex(bosses, startIdx) {
  let idx = startIdx % 3;
  for (let k = 0; k < 3; k++) {
    const i = (idx + k) % 3;
    if ((bosses[i]?.currentHP ?? 0) > 0) return i;
  }
  return idx;
}

function zweihanderPriorityThisAction(f) {
  const ws = f?.weaponState;
  if (!ws?.isLegendary || ws.weaponId !== 'epee_legendaire') return false;
  const tc = (ws.counters?.turnCount ?? 0) + 1;
  const n = weaponConstants.zweihander.triggerEveryNTurns;
  return tc % n === 0;
}

function bastionMurFirst(f) {
  return f.class === 'Bastion' && f.cd.bast === 0 && f.subclass?.id === 'mur_implacable';
}

/**
 * Ordre d’initiative sur un tour (3 acteurs vivants) : Licorne, Zweihänder, Bastion mur, puis VIT (ex-aequo hôte → invité → boss).
 */
function compareCoopActors(a, b, turn) {
  const aUni = getUnicornPactTurnDataFromList(getPassiveDetailsList(a.f), turn);
  const bUni = getUnicornPactTurnDataFromList(getPassiveDetailsList(b.f), turn);
  if (aUni && !bUni) return aUni.label === 'Tour A' ? -1 : 1;
  if (bUni && !aUni) return bUni.label === 'Tour A' ? 1 : -1;

  const aZ = zweihanderPriorityThisAction(a.f);
  const bZ = zweihanderPriorityThisAction(b.f);
  if (aZ && !bZ) return -1;
  if (bZ && !aZ) return 1;

  const aB = bastionMurFirst(a.f);
  const bB = bastionMurFirst(b.f);
  if (aB && !bB) return -1;
  if (bB && !aB) return 1;

  if (b.f.base.spd !== a.f.base.spd) return b.f.base.spd - a.f.base.spd;
  const order = { host: 0, guest: 1, boss: 2 };
  return order[a.key] - order[b.key];
}

function buildRoundOrder(host, guest, bossFighter, bossKey, turn) {
  const entries = [];
  if (host.currentHP > 0) entries.push({ key: 'host', f: host });
  if (guest.currentHP > 0) entries.push({ key: 'guest', f: guest });
  if (bossFighter.currentHP > 0) entries.push({ key: bossKey, f: bossFighter });
  if (entries.length <= 1) return entries.map((e) => e.key);

  entries.sort((a, b) => compareCoopActors(a, b, turn));
  return entries.map((e) => e.key);
}

function allBossesDead(bosses) {
  return bosses.every((b) => (b?.currentHP ?? 0) <= 0);
}

function buildCombatResult(host, guest, bosses, lineup, winner, log, seed, rngCounter, activeBossIndex, bossNextTargetsHost) {
  const bossHP = bosses.map((b) => Math.max(0, b.currentHP));
  const bossMaxHP = lineup.map((l) => l.baseStats.hp);
  const payload = {
    seed,
    rngCounter,
    winner,
    hostHP: Math.max(0, host.currentHP),
    guestHP: Math.max(0, guest.currentHP),
    hostMaxHP: host.maxHP,
    guestMaxHP: guest.maxHP,
    bossHP,
    bossMaxHP,
    activeBossIndex,
    bossNextTargetsHost,
    log,
    pendingUserId: null,
  };
  if (payload.log.length > 200) {
    payload.log = payload.log.slice(-200);
  }
  return payload;
}

/**
 * @returns {object} Même forme que l’ancien simulateCoopRedCombatFull pour Firestore / UI.
 */
export function simulerMatchCoopRed(hostSnap, guestSnap, difficulty, seed) {
  const seedU = seed >>> 0;
  const rng = createCoopSeededRng(seedU);
  return runWithCombatRandom01(() => rng.next01(), () =>
    runCoopRedEngine(hostSnap, guestSnap, difficulty, seedU, rng)
  );
}

function runCoopRedEngine(hostSnap, guestSnap, difficulty, seedU, rng) {
  const { host, guest, bosses } = rebuildPreparedCoop(hostSnap, guestSnap, difficulty);
  const lineup = getCoopRedLineup(difficulty);
  if (!lineup || bosses.length !== 3) {
    return buildCombatResult(host, guest, bosses, lineup || [], 'boss', ['Erreur lineup Red.'], seedU, rng.getCounter(), 0, true);
  }

  const refBoss = bosses[0];
  applyGnomeCapBonus(host, refBoss);
  applyGnomeCapBonus(guest, refBoss);
  applyGnomeCapBonus(refBoss, host);

  const introLogs = [];
  applyStartOfCombatPassives(host, refBoss, introLogs, '[Hôte]');
  applyStartOfCombatPassives(guest, refBoss, introLogs, '[Invité]');
  applyStartOfCombatPassives(refBoss, host, introLogs, '[Boss]');

  const log = [...introLogs, `⚔️ Red (moteur tournoi) : ${lineup.map((l) => l.nom).join(', ')} !`];

  let activeBossIndex = 0;
  let bossNextTargetsHost = true;
  let turn = 1;
  let winner = null;

  while (!winner && turn <= MAX_COOP_TURNS) {
    const biStart = getActiveBossIndex(bosses, activeBossIndex);
    activeBossIndex = biStart;

    if (host.currentHP <= 0 || guest.currentHP <= 0) {
      winner = 'boss';
      break;
    }
    if (allBossesDead(bosses)) {
      winner = 'players';
      break;
    }

    const turnStartLogs = [`--- Tour ${turn} ---`];
    if (turn === generalConstants.suddenDeathTurn) {
      host.suddenDeath = true;
      guest.suddenDeath = true;
      for (const b of bosses) b.suddenDeath = true;
      turnStartLogs.push(
        `💀 MORT SUBITE ! +${Math.round(generalConstants.suddenDeathDamageBonus * 100)}% dégâts, soins -${Math.round(generalConstants.suddenDeathHealReduction * 100)}%.`
      );
    }

    for (const f of [host, guest, ...bosses]) {
      if (f.sorcierNeantBurn && f.currentHP > 0) {
        const burn = Math.max(1, Math.round(f.currentHP * 0.02));
        f.currentHP -= burn;
        turnStartLogs.push(`🌑 Brûlure du Néant: ${f.name} perd ${burn} PV.`);
      }
    }
    log.push(...turnStartLogs);

    if (host.currentHP <= 0 || guest.currentHP <= 0) {
      winner = 'boss';
      break;
    }
    if (allBossesDead(bosses)) {
      winner = 'players';
      break;
    }

    const activeBoss = bosses[activeBossIndex];
    const order = buildRoundOrder(host, guest, activeBoss, 'boss', turn);

    for (const actorKey of order) {
      if (winner) break;

      const biNow = getActiveBossIndex(bosses, activeBossIndex);
      activeBossIndex = biNow;
      const bossNow = bosses[biNow];

      if (host.currentHP <= 0 || guest.currentHP <= 0) {
        winner = 'boss';
        break;
      }
      if (allBossesDead(bosses)) {
        winner = 'players';
        break;
      }

      if (actorKey === 'boss') {
        if (bossNow.currentHP <= 0) continue;
        let target = bossNextTargetsHost ? host : guest;
        if (target.currentHP <= 0) target = target === host ? guest : host;
        if (target.currentHP <= 0) continue;

        const chunk = [];
        processPlayerAction(bossNow, target, chunk, false, turn, '[Boss]');
        log.push(...chunk);

        bossNextTargetsHost = !bossNextTargetsHost;
        activeBossIndex = (biNow + 1) % 3;
      } else {
        const player = actorKey === 'host' ? host : guest;
        if (player.currentHP <= 0) continue;
        if (bossNow.currentHP <= 0) continue;

        const chunk = [];
        const label = actorKey === 'host' ? '[Hôte]' : '[Invité]';
        processPlayerAction(player, bossNow, chunk, actorKey === 'host', turn, label);
        log.push(...chunk);
      }
    }

    turn += 1;
  }

  if (!winner) {
    winner = 'boss';
    log.push('⏱️ Limite de tours atteinte (Red coop).');
  }
  if (winner === 'players') {
    log.push('🏆 Victoire ! Tous les adversaires sont à terre !');
  } else if (winner === 'boss') {
    log.push('💀 Défaite…');
  }

  return buildCombatResult(
    host,
    guest,
    bosses,
    lineup,
    winner,
    log,
    seedU,
    rng.getCounter(),
    activeBossIndex,
    bossNextTargetsHost
  );
}
