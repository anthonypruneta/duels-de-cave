import React, { useCallback, useEffect, useRef, useState } from 'react';
import CoopRedReplayArena from './CoopRedReplayArena';
import { rebuildPreparedCoop } from '../utils/coopRedCombat';
import { replayCoopRedSteps } from '../utils/combatReplay';
import { simulerMatchCoopRed, createCoopSeededRng } from '../utils/coopRedTournamentSim';
import { getCoopRedLineup } from '../data/coopRedDungeon';
import { getUserCharacter } from '../services/characterService';
import { getWeaponById } from '../data/weapons';

/**
 * Replay animé Red (même UI que l’admin) : steps fournis ou recalculés côté client (seed déterministe).
 */
export default function CoopRedAnimatedReplay({
  hostSnap,
  guestSnap,
  difficulty,
  combatSeed,
  steps: stepsProp = null,
  lineup: lineupProp = null,
  logTitle,
  wrapperClassName,
  rewardContent = null,
  onReplayError,
  onReplayFinished,
}) {
  const replaySpeed = 'normal';

  const [replaying, setReplaying] = useState(false);
  const [hostF, setHostF] = useState(null);
  const [guestF, setGuestF] = useState(null);
  const [bossHPs, setBossHPs] = useState([0, 0, 0]);
  const [activeBossIdx, setActiveBossIdx] = useState(0);
  const [hostCombatBase, setHostCombatBase] = useState(null);
  const [guestCombatBase, setGuestCombatBase] = useState(null);
  const [hostCombatStatus, setHostCombatStatus] = useState(null);
  const [guestCombatStatus, setGuestCombatStatus] = useState(null);
  const [bossCombatBase, setBossCombatBase] = useState(null);
  const [bossCombatStatus, setBossCombatStatus] = useState(null);
  const [bossShield, setBossShield] = useState(0);
  const [combatLog, setCombatLog] = useState([]);
  const [coopActor, setCoopActor] = useState(null);
  const [focusLeftIsHost, setFocusLeftIsHost] = useState(true);
  const replayGenRef = useRef(0);

  const lineup = lineupProp ?? getCoopRedLineup(difficulty);
  const run = { lineup };

  const applyStepToArena = useCallback((s) => {
    if (s.phase === 'action') {
      if (s.player === 1) setFocusLeftIsHost(true);
      else if (s.player === 2) setFocusLeftIsHost(false);
    }
    setHostF((prev) =>
      prev
        ? {
            ...prev,
            currentHP: s.hostHP,
            shield: s.hostShield ?? 0,
          }
        : null
    );
    setGuestF((prev) =>
      prev
        ? {
            ...prev,
            currentHP: s.guestHP,
            shield: s.guestShield ?? 0,
          }
        : null
    );
    if (Array.isArray(s.bossHP)) setBossHPs(s.bossHP);
    if (typeof s.activeBossIndex === 'number') setActiveBossIdx(s.activeBossIndex);
    setHostCombatBase(s.hostBase ?? null);
    setGuestCombatBase(s.guestBase ?? null);
    setHostCombatStatus(s.hostStatus ?? null);
    setGuestCombatStatus(s.guestStatus ?? null);
    setBossCombatBase(s.bossBase ?? null);
    setBossCombatStatus(s.bossStatus ?? null);
    setBossShield(s.bossShield ?? 0);
  }, []);

  const runReplay = useCallback(async () => {
    const gen = ++replayGenRef.current;
    let steps = stepsProp;
    if (!Array.isArray(steps) || steps.length === 0) {
      const combat = simulerMatchCoopRed(hostSnap, guestSnap, difficulty, combatSeed, { recordSteps: true });
      steps = combat.steps;
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      onReplayError?.('Impossible de rejouer ce combat (pas de steps).');
      return;
    }

    setReplaying(true);
    onReplayFinished?.(false);
    setCoopActor(null);

    const loadSnapWithVisualFallbacks = async (snap) => {
      if (!snap?.userId) return snap;
      const needsVisualData = !snap?.characterImage
        || !snap?.equippedTitle
        || !snap?.equippedBorder
        || !snap?.equippedRealBorder
        || !snap?.gender
        || (!snap?.equippedWeaponData && !!snap?.equippedWeaponId);
      if (!needsVisualData) return snap;
      const res = await getUserCharacter(snap.userId);
      const fresh = res.success && res.data ? res.data : null;
      const weaponId = snap.equippedWeaponId ?? fresh?.equippedWeaponId ?? null;
      const weaponData = snap.equippedWeaponData
        ?? fresh?.equippedWeaponData
        ?? (weaponId ? getWeaponById(weaponId) : null);
      if (!fresh) {
        return {
          ...snap,
          equippedWeaponId: weaponId,
          equippedWeaponData: weaponData,
        };
      }
      return {
        ...snap,
        characterImage: snap.characterImage ?? fresh.characterImage ?? null,
        equippedTitle: snap.equippedTitle ?? fresh.equippedTitle ?? null,
        equippedBorder: snap.equippedBorder ?? fresh.equippedBorder ?? null,
        equippedRealBorder: snap.equippedRealBorder ?? fresh.equippedRealBorder ?? null,
        gender: snap.gender ?? fresh.gender ?? null,
        equippedWeaponId: weaponId,
        equippedWeaponData: weaponData,
      };
    };

    const [hostSnapResolved, guestSnapResolved] = await Promise.all([
      loadSnapWithVisualFallbacks(hostSnap),
      loadSnapWithVisualFallbacks(guestSnap),
    ]);

    const prepRng = createCoopSeededRng(combatSeed >>> 0);
    const { host, guest, bosses } = rebuildPreparedCoop(hostSnapResolved, guestSnapResolved, difficulty, {
      rngNext01: () => prepRng.next01(),
    });
    const s0 = steps[0];
    setHostF({
      ...host,
      currentHP: s0.hostHP,
      shield: s0.hostShield ?? 0,
    });
    setGuestF({
      ...guest,
      currentHP: s0.guestHP,
      shield: s0.guestShield ?? 0,
    });
    setBossHPs(s0.bossHP ?? bosses.map((b) => Math.max(0, b.currentHP)));
    setActiveBossIdx(s0.activeBossIndex ?? 0);
    setHostCombatBase(s0.hostBase ?? null);
    setGuestCombatBase(s0.guestBase ?? null);
    setHostCombatStatus(s0.hostStatus ?? null);
    setGuestCombatStatus(s0.guestStatus ?? null);
    setBossCombatBase(s0.bossBase ?? null);
    setBossCombatStatus(s0.bossStatus ?? null);
    setBossShield(s0.bossShield ?? 0);
    setCombatLog([]);
    setFocusLeftIsHost(true);

    try {
      await replayCoopRedSteps(steps, {
        setCombatLog,
        onCoopStep: applyStepToArena,
        setCoopActor,
        existingLogs: [],
        speed: replaySpeed,
      });
    } catch (e) {
      if (replayGenRef.current === gen) {
        onReplayError?.(e?.message || 'Erreur pendant le replay');
      }
    } finally {
      if (replayGenRef.current === gen) {
        setReplaying(false);
        onReplayFinished?.(true);
      }
    }
  }, [
    applyStepToArena,
    combatSeed,
    difficulty,
    guestSnap,
    hostSnap,
    onReplayError,
    onReplayFinished,
    replaySpeed,
    stepsProp,
  ]);

  useEffect(() => {
    runReplay();
    return () => {
      replayGenRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- montage uniquement ; « Relancer » appelle runReplay()
  }, []);

  const handleRelance = useCallback(() => {
    runReplay();
  }, [runReplay]);

  if (!hostF || !guestF) {
    return (
      <div className="text-stone-500 text-sm py-6 text-center">
        Préparation du déroulé…
      </div>
    );
  }

  return (
    <CoopRedReplayArena
      run={run}
      difficulty={difficulty}
      hostF={hostF}
      guestF={guestF}
      hostCombatBase={hostCombatBase}
      guestCombatBase={guestCombatBase}
      hostCombatStatus={hostCombatStatus}
      guestCombatStatus={guestCombatStatus}
      bossCombatBase={bossCombatBase}
      bossCombatStatus={bossCombatStatus}
      bossShield={bossShield}
      bossHPs={bossHPs}
      activeBossIdx={activeBossIdx}
      combatLog={combatLog}
      coopActor={coopActor}
      focusLeftIsHost={focusLeftIsHost}
      replaying={replaying}
      onRelanceReplay={handleRelance}
      logTitle={logTitle}
      wrapperClassName={wrapperClassName}
      rewardContent={rewardContent}
    />
  );
}
