import React, { useCallback, useEffect, useRef, useState } from 'react';
import CoopRedReplayArena from './CoopRedReplayArena';
import { rebuildPreparedCoop } from '../utils/coopRedCombat';
import { replayCoopRedSteps } from '../utils/combatReplay';
import { simulerMatchCoopRed, createCoopSeededRng } from '../utils/coopRedTournamentSim';
import { getCoopRedLineup } from '../data/coopRedDungeon';
import { getUserCharacter } from '../services/characterService';
import { getWeaponById } from '../data/weapons';

/**
 * Champs de combat figés depuis le snapshot de salle / historique (état au moment du match).
 * Ne jamais mélanger avec la fiche perso live (`getUserCharacter`) sinon Pointeau ADN, forge, etc. peuvent
 * apparaître au replay alors qu’ils n’existaient pas au combat.
 */
function pickCombatFieldsFromRoomSnapshot(snap) {
  if (!snap) return {};
  const fields = {
    userId: snap.userId,
    name: snap.name,
    gender: snap.gender ?? null,
    race: snap.race,
    class: snap.class,
    level: snap.level ?? 1,
    base: snap.base ? { ...snap.base } : {},
    bonuses: snap.bonuses ? JSON.parse(JSON.stringify(snap.bonuses)) : { race: {}, class: {} },
    forestBoosts: snap.forestBoosts ? { ...snap.forestBoosts } : {},
    forgeUpgrade: snap.forgeUpgrade ?? null,
    subclass: snap.subclass ?? null,
    mageTowerPassive: snap.mageTowerPassive ?? null,
    mageTowerExtensionPassive: snap.mageTowerExtensionPassive ?? null,
    additionalAwakeningRaces: Array.isArray(snap.additionalAwakeningRaces)
      ? [...snap.additionalAwakeningRaces]
      : [],
    awakeningForced: !!snap.awakeningForced,
    coopRaceEcho: snap.coopRaceEcho ?? null,
    coopRaceEchoOffer: snap.coopRaceEchoOffer ?? null,
  };
  // L’arme est surtout une donnée visuelle : si elle manque dans le snapshot, on autorise un fallback.
  if (snap.equippedWeaponId != null) fields.equippedWeaponId = snap.equippedWeaponId;
  if (snap.equippedWeaponData != null) fields.equippedWeaponData = snap.equippedWeaponData;
  return fields;
}

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
  const [replayFinished, setReplayFinished] = useState(false);
  const [hostF, setHostF] = useState(null);
  const [guestF, setGuestF] = useState(null);
  const [hostWeaponOverride, setHostWeaponOverride] = useState(null);
  const [guestWeaponOverride, setGuestWeaponOverride] = useState(null);
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

    setReplaying(true);
    setReplayFinished(false);
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
      let merged = snap;
      if (needsVisualData) {
        const res = await getUserCharacter(snap.userId);
        const fresh = res.success && res.data ? res.data : null;
        const weaponId = snap.equippedWeaponId ?? fresh?.equippedWeaponId ?? null;
        const weaponData = snap.equippedWeaponData
          ?? fresh?.equippedWeaponData
          ?? (weaponId ? getWeaponById(weaponId) : null);
        if (!fresh) {
          merged = {
            ...snap,
            equippedWeaponId: weaponId,
            equippedWeaponData: weaponData,
          };
        } else {
          merged = {
            ...snap,
            characterImage: snap.characterImage ?? fresh.characterImage ?? null,
            equippedTitle: snap.equippedTitle ?? fresh.equippedTitle ?? null,
            equippedBorder: snap.equippedBorder ?? fresh.equippedBorder ?? null,
            equippedRealBorder: snap.equippedRealBorder ?? fresh.equippedRealBorder ?? null,
            gender: snap.gender ?? fresh.gender ?? null,
            equippedWeaponId: weaponId,
            equippedWeaponData: weaponData,
          };
        }
      }
      // Toujours réappliquer l’état combat depuis le snapshot du match (pas la fiche live).
      return { ...merged, ...pickCombatFieldsFromRoomSnapshot(snap) };
    };

    const [hostSnapResolved, guestSnapResolved] = await Promise.all([
      loadSnapWithVisualFallbacks(hostSnap),
      loadSnapWithVisualFallbacks(guestSnap),
    ]);

    // Les combattants "préparés" peuvent ne pas transporter l’arme ; on la conserve depuis le snapshot du match.
    setHostWeaponOverride(hostSnapResolved?.equippedWeaponData ?? null);
    setGuestWeaponOverride(guestSnapResolved?.equippedWeaponData ?? null);

    let steps = stepsProp;
    if (!Array.isArray(steps) || steps.length === 0) {
      const combat = simulerMatchCoopRed(hostSnapResolved, guestSnapResolved, difficulty, combatSeed, {
        recordSteps: true,
      });
      steps = combat.steps;
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      onReplayError?.('Impossible de rejouer ce combat (pas de steps).');
      if (replayGenRef.current === gen) {
        setReplaying(false);
        onReplayFinished?.(true);
      }
      return;
    }

    const prepRng = createCoopSeededRng(combatSeed >>> 0);
    const { host, guest, bosses } = rebuildPreparedCoop(hostSnapResolved, guestSnapResolved, difficulty, {
      rngNext01: () => prepRng.next01(),
    });
    const s0 = steps[0];
    setHostF({
      ...host,
      currentHP: s0.hostHP,
      shield: s0.hostShield ?? 0,
      equippedWeaponId: hostSnapResolved?.equippedWeaponId ?? host?.equippedWeaponId ?? null,
      equippedWeaponData: hostSnapResolved?.equippedWeaponData ?? host?.equippedWeaponData ?? null,
    });
    setGuestF({
      ...guest,
      currentHP: s0.guestHP,
      shield: s0.guestShield ?? 0,
      equippedWeaponId: guestSnapResolved?.equippedWeaponId ?? guest?.equippedWeaponId ?? null,
      equippedWeaponData: guestSnapResolved?.equippedWeaponData ?? guest?.equippedWeaponData ?? null,
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
        setReplayFinished(true);
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
      hostWeaponOverride={hostWeaponOverride}
      guestWeaponOverride={guestWeaponOverride}
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
      rewardContent={replayFinished ? rewardContent : null}
    />
  );
}
