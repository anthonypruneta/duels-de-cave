/**
 * Donjon Red coop : même moteur que le tournoi (processPlayerAction, armes, passifs, sous-classes).
 * Chaque tour : tous les combattants vivants agissent une fois, dans l’ordre d’initiative (VIT + Licorne / Zweihänder / Bastion puis ex-aequo hôte → invité → boss0 → boss1 → boss2).
 * Les joueurs frappent le boss « focal » du tour (rotation en fin de round). Chaque boss vivant joue son tour ; la cible du boss alterne toujours hôte / invité.
 * Défaite des joueurs uniquement si hôte et invité sont tous les deux à 0 PV.
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
import { snapshotCombatantStatusForUi } from './combatStatusSnapshot.js';

const MAX_COOP_TURNS = 400;

/** RNG déterministe pour donjon Red (préparation + combat). */
export function createCoopSeededRng(seed) {
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

/** Tortank : au tour où Aqua-jet est prêt (CD-1 avant incrément), initiative maximale. */
function tortankAquaJetPriorityThisRound(f) {
  if (f?.bossId !== 'coop_red_blinde' || !f.ability?.cooldown) return false;
  const cd = f.ability.cooldown;
  const cur = f.cd?.boss_ability ?? 0;
  return cur === cd - 1 && cd > 0;
}

/** Ex-aequo sur la VIT : hôte, puis invité, puis boss slot 0 → 1 → 2. */
function initiativeTiebreakRank(entry) {
  if (entry.key === 'host') return 0;
  if (entry.key === 'guest') return 1;
  const m = /^boss(\d+)$/.exec(entry.key);
  if (m) return 2 + parseInt(m[1], 10);
  return 99;
}

/**
 * Ordre d’initiative sur un tour : Tortank (Aqua-jet prêt), Licorne, Zweihänder, Bastion mur, puis VIT, puis départage fixe.
 */
function compareCoopActors(a, b, turn) {
  const aTort = tortankAquaJetPriorityThisRound(a.f);
  const bTort = tortankAquaJetPriorityThisRound(b.f);
  if (aTort && !bTort) return -1;
  if (bTort && !aTort) return 1;

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
  return initiativeTiebreakRank(a) - initiativeTiebreakRank(b);
}

/** Tous les vivants : hôte, invité, puis chaque boss encore debout. */
function buildRoundOrder(host, guest, bosses, turn) {
  const entries = [];
  if (host.currentHP > 0) entries.push({ key: 'host', f: host });
  if (guest.currentHP > 0) entries.push({ key: 'guest', f: guest });
  for (let i = 0; i < bosses.length; i++) {
    if ((bosses[i]?.currentHP ?? 0) > 0) entries.push({ key: `boss${i}`, f: bosses[i] });
  }
  if (entries.length <= 1) return entries.map((e) => e.key);

  entries.sort((a, b) => compareCoopActors(a, b, turn));
  return entries.map((e) => e.key);
}

/** Boss ciblé par les joueurs : préfère le focal s’il vit, sinon premier vivant. */
function getPlayerTargetBossIndex(bosses, preferredIdx) {
  if (bosses[preferredIdx]?.currentHP > 0) return preferredIdx;
  return getActiveBossIndex(bosses, 0);
}

function allBossesDead(bosses) {
  return bosses.every((b) => (b?.currentHP ?? 0) <= 0);
}

function snapshotFighterBase(b) {
  if (!b?.base) return undefined;
  return {
    hp: b.base.hp,
    auto: b.base.auto,
    def: b.base.def,
    cap: b.base.cap,
    rescap: b.base.rescap,
    spd: b.base.spd,
  };
}

/** Aligné sur tournamentCombat (steps / CharacterCardContent), + champs donjon Red. */
function snapshotFighterStatus(b) {
  const status = snapshotCombatantStatusForUi(b);
  if (!status) return undefined;
  return {
    ...status,
    coopRedBrulureDrain: typeof b.coopRedBrulureDrain === 'number' && b.coopRedBrulureDrain > 0 ? b.coopRedBrulureDrain : null,
    coopRedVampigraineLeech: typeof b.coopRedVampigraineLeech === 'number' && b.coopRedVampigraineLeech > 0 ? b.coopRedVampigraineLeech : null,
    coopRedBrulureAutoApplied: !!b.coopRedBrulureAutoApplied,
  };
}

function buildCombatResult(
  host,
  guest,
  bosses,
  lineup,
  winner,
  log,
  seed,
  rngCounter,
  activeBossIndex,
  bossNextTargetsHost,
  steps = null
) {
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
  if (steps && steps.length > 0) {
    payload.steps = steps;
  }
  if (payload.log.length > 200) {
    payload.log = payload.log.slice(-200);
  }
  return payload;
}

/**
 * @returns {object} Même forme que l’ancien simulateCoopRedCombatFull pour Firestore / UI.
 */
/**
 * @param {object} [options]
 * @param {boolean} [options.recordSteps] — si true, ajoute `steps` pour replay UI (ne pas persister tel quel dans Firestore).
 * @param {boolean} [options.injectSimulationLoot] — active le mode test arme/passif aléatoires.
 */
export function simulerMatchCoopRed(hostSnap, guestSnap, difficulty, seed, options = {}) {
  const recordSteps = options.recordSteps === true;
  const injectSimulationLoot = options.injectSimulationLoot === true;
  const seedU = seed >>> 0;
  const rng = createCoopSeededRng(seedU);
  return runWithCombatRandom01(() => rng.next01(), () =>
    runCoopRedEngine(hostSnap, guestSnap, difficulty, seedU, rng, recordSteps, injectSimulationLoot)
  );
}

function runCoopRedEngine(hostSnap, guestSnap, difficulty, seedU, rng, recordSteps, injectSimulationLoot = false) {
  const { host, guest, bosses } = rebuildPreparedCoop(hostSnap, guestSnap, difficulty, {
    rngNext01: () => rng.next01(),
    injectSimulationLoot,
  });
  const lineup = getCoopRedLineup(difficulty);
  const steps = [];

  const makeSnap = (activeIdx) => {
    const bi = getActiveBossIndex(bosses, activeIdx);
    const bb = bosses[bi];
    return {
      hostHP: Math.max(0, host.currentHP),
      guestHP: Math.max(0, guest.currentHP),
      hostShield: host.shield || 0,
      guestShield: guest.shield || 0,
      bossHP: bosses.map((b) => Math.max(0, b.currentHP)),
      bossMaxHP: lineup.map((l) => l.baseStats.hp),
      activeBossIndex: bi,
      bossShield: bb.shield || 0,
      hostBase: snapshotFighterBase(host),
      guestBase: snapshotFighterBase(guest),
      bossBase: snapshotFighterBase(bb),
      hostStatus: snapshotFighterStatus(host),
      guestStatus: snapshotFighterStatus(guest),
      bossStatus: snapshotFighterStatus(bb),
    };
  };

  const pushStep = (phase, logsSlice, activeIdx, extras = {}) => {
    if (!recordSteps) return;
    steps.push({
      phase,
      logs: Array.isArray(logsSlice) ? [...logsSlice] : [],
      ...makeSnap(activeIdx),
      ...extras,
    });
  };

  if (!lineup || bosses.length !== 3) {
    return buildCombatResult(
      host,
      guest,
      bosses,
      lineup || [],
      'boss',
      ['Erreur lineup Red.'],
      seedU,
      rng.getCounter(),
      0,
      true,
      recordSteps
        ? [
            {
              phase: 'victory',
              logs: ['Erreur lineup Red.'],
              hostHP: Math.max(0, host.currentHP),
              guestHP: Math.max(0, guest.currentHP),
              hostShield: host.shield || 0,
              guestShield: guest.shield || 0,
              bossHP: bosses.map((b) => Math.max(0, b.currentHP)),
              bossMaxHP: [1, 1, 1],
              activeBossIndex: 0,
              hostBase: snapshotFighterBase(host),
              guestBase: snapshotFighterBase(guest),
              bossBase: snapshotFighterBase(bosses[0]),
              hostStatus: snapshotFighterStatus(host),
              guestStatus: snapshotFighterStatus(guest),
              bossStatus: snapshotFighterStatus(bosses[0]),
              bossShield: bosses[0].shield || 0,
            },
          ]
        : null
    );
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
  pushStep('intro', log, activeBossIndex);
  let bossNextTargetsHost = true;
  let turn = 1;
  let winner = null;

  while (!winner && turn <= MAX_COOP_TURNS) {
    for (const b of bosses) {
      if (b.coopRedBorealisLastTurn != null && turn > b.coopRedBorealisLastTurn) {
        b.coopRedDamageTakenMult = 1;
        b.coopRedBorealisFirstTurn = undefined;
        b.coopRedBorealisLastTurn = undefined;
      }
    }

    const biStart = getActiveBossIndex(bosses, activeBossIndex);
    activeBossIndex = biStart;

    if (host.currentHP <= 0 && guest.currentHP <= 0) {
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
    for (const pj of [host, guest]) {
      if (pj.currentHP <= 0) continue;
      if (pj.coopRedBrulureDrain > 0) {
        const d = Math.max(1, Math.round(pj.maxHP * pj.coopRedBrulureDrain));
        pj.currentHP -= d;
        turnStartLogs.push(
          `🔥 Brûlure (Lance-Flammes) : ${pj.name} perd ${d} PV (${Math.round(pj.coopRedBrulureDrain * 100)}% PV max/tour).`
        );
      }
      if (pj.coopRedVampigraineLeech > 0) {
        const d = Math.max(1, Math.round(pj.maxHP * pj.coopRedVampigraineLeech));
        pj.currentHP -= d;
        const biLeech = getActiveBossIndex(bosses, activeBossIndex);
        const bb = bosses[biLeech];
        if (bb && bb.currentHP > 0) {
          bb.currentHP = Math.min(bb.maxHP, bb.currentHP + d);
        }
        turnStartLogs.push(`🌱 Vampigraine : ${pj.name} perd ${d} PV ; le boss actif récupère des PV.`);
      }
    }
    log.push(...turnStartLogs);
    pushStep('turn_start', turnStartLogs, activeBossIndex);

    if (host.currentHP <= 0 && guest.currentHP <= 0) {
      winner = 'boss';
      break;
    }
    if (allBossesDead(bosses)) {
      winner = 'players';
      break;
    }

    const roundFocalBossIndex = getActiveBossIndex(bosses, activeBossIndex);
    const order = buildRoundOrder(host, guest, bosses, turn);

    for (const actorKey of order) {
      if (winner) break;

      if (host.currentHP <= 0 && guest.currentHP <= 0) {
        winner = 'boss';
        break;
      }
      if (allBossesDead(bosses)) {
        winner = 'players';
        break;
      }

      if (actorKey === 'host' || actorKey === 'guest') {
        const player = actorKey === 'host' ? host : guest;
        if (player.currentHP <= 0) continue;

        const targetBossIdx = getPlayerTargetBossIndex(bosses, roundFocalBossIndex);
        const bossTarget = bosses[targetBossIdx];
        if (!bossTarget || bossTarget.currentHP <= 0) continue;

        const chunk = [];
        const label = actorKey === 'host' ? '[Hôte]' : '[Invité]';
        processPlayerAction(player, bossTarget, chunk, actorKey === 'host', turn, label);
        log.push(...chunk);
        pushStep('action', chunk, targetBossIdx, { player: actorKey === 'host' ? 1 : 2 });
      } else {
        const bi = parseInt(actorKey.replace('boss', ''), 10);
        const bossNow = bosses[bi];
        if (!bossNow || bossNow.currentHP <= 0) continue;

        let target = bossNextTargetsHost ? host : guest;
        if (target.currentHP <= 0) target = target === host ? guest : host;
        if (target.currentHP <= 0) continue;

        const chunk = [];
        const otherPlayer = target === host ? guest : host;
        processPlayerAction(bossNow, target, chunk, false, turn, '[Boss]', {
          coopRedOtherPlayer: otherPlayer,
        });
        if (bossNow.coopRedLokhlassBorealisPending) {
          const p = bossNow.coopRedLokhlassBorealisPending;
          delete bossNow.coopRedLokhlassBorealisPending;
          for (const ob of bosses) {
            if (ob === bossNow || (ob.currentHP ?? 0) <= 0) continue;
            ob.coopRedDamageTakenMult = 1 - p.reduction;
            ob.coopRedBorealisFirstTurn = p.castTurn + 1;
            ob.coopRedBorealisLastTurn = p.castTurn + p.turns;
          }
        }
        log.push(...chunk);
        pushStep('action', chunk, bi, { player: 3 });

        bossNextTargetsHost = !bossNextTargetsHost;
      }
    }

    if (!winner) {
      const nextFocalStart = (roundFocalBossIndex + 1) % bosses.length;
      activeBossIndex = getActiveBossIndex(bosses, nextFocalStart);
    }

    turn += 1;
  }

  const endStart = log.length;
  if (!winner) {
    winner = 'boss';
    log.push('⏱️ Limite de tours atteinte (Red coop).');
  }
  if (winner === 'players') {
    log.push('🏆 Victoire ! Tous les adversaires sont à terre !');
  } else if (winner === 'boss') {
    log.push('💀 Défaite…');
  }
  pushStep('victory', log.slice(endStart), activeBossIndex);

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
    bossNextTargetsHost,
    recordSteps ? steps : null
  );
}
