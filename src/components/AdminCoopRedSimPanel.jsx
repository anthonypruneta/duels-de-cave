import React, { useCallback, useRef, useState } from 'react';
import CharacterCardContent from './CharacterCardContent';
import testImage1 from '../assets/characters/test.png';
import testImage2 from '../assets/characters/test2.png';
import { runAdminCoopRedSimulations } from '../utils/coopRedAdminSim';
import { rebuildPreparedCoop } from '../utils/coopRedCombat';
import { replayCoopRedSteps } from '../utils/combatReplay';

export default function AdminCoopRedSimPanel() {
  const [redSimLoading, setRedSimLoading] = useState(false);
  const [redSimError, setRedSimError] = useState('');
  const [redSimPayload, setRedSimPayload] = useState(null);
  const [redSimSeedInput, setRedSimSeedInput] = useState('');
  const [redSimExpandedKey, setRedSimExpandedKey] = useState(null);
  const [replayArenaKey, setReplayArenaKey] = useState(null);
  const [replaySpeed, setReplaySpeed] = useState('fast');
  const [replaying, setReplaying] = useState(false);
  const [hostF, setHostF] = useState(null);
  const [guestF, setGuestF] = useState(null);
  const [bossHPs, setBossHPs] = useState([0, 0, 0]);
  const [activeBossIdx, setActiveBossIdx] = useState(0);
  const [hostCombatBase, setHostCombatBase] = useState(null);
  const [guestCombatBase, setGuestCombatBase] = useState(null);
  const [hostCombatStatus, setHostCombatStatus] = useState(null);
  const [guestCombatStatus, setGuestCombatStatus] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [coopActor, setCoopActor] = useState(null);
  const replayGenRef = useRef(0);

  const applyStepToArena = useCallback((s) => {
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
  }, []);

  const startReplay = useCallback(
    async (run, arenaKey) => {
      const steps = run.steps;
      if (!Array.isArray(steps) || steps.length === 0) {
        setRedSimError('Aucun enregistrement de combat pour le déroulé. Relance une simulation.');
        return;
      }
      const gen = ++replayGenRef.current;
      setReplayArenaKey(arenaKey);
      setRedSimError('');
      setReplaying(true);
      setCoopActor(null);

      const { host, guest, bosses } = rebuildPreparedCoop(run.hostSnap, run.guestSnap, run.difficulty);
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
      setCombatLog([]);

      try {
        await replayCoopRedSteps(steps, {
          setCombatLog,
          onCoopStep: applyStepToArena,
          setCoopActor: setCoopActor,
          existingLogs: [],
          speed: replaySpeed,
        });
      } catch (e) {
        if (replayGenRef.current === gen) {
          setRedSimError(e?.message || 'Erreur pendant le replay');
        }
      } finally {
        if (replayGenRef.current === gen) setReplaying(false);
      }
    },
    [applyStepToArena, replaySpeed]
  );

  return (
    <div className="bg-stone-900/70 border-2 border-red-700 rounded-xl p-6 mb-8">
      <h2 className="text-2xl font-bold text-red-400 mb-2">🔴 Simulation donjon Red (coop)</h2>
      <p className="text-stone-400 text-sm mb-4">
        Génère deux personnages <span className="text-stone-300">aléatoires</span> par palier (niveau 150, 250 et 350)
        et lance le <span className="text-stone-300">même moteur</span> que le donjon coop. Tu peux lire le combat avec
        l’interface type arène (barres, cartes, log animé).
      </p>
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label className="text-stone-500 text-xs block mb-1">Seed (optionnel, entier)</label>
          <input
            type="text"
            inputMode="numeric"
            value={redSimSeedInput}
            onChange={(e) => setRedSimSeedInput(e.target.value)}
            placeholder="Vide = horodatage"
            className="w-48 bg-stone-800 border border-stone-600 rounded px-3 py-2 text-white text-sm"
          />
        </div>
        <button
          type="button"
          disabled={redSimLoading}
          onClick={() => {
            setRedSimError('');
            setRedSimLoading(true);
            try {
              const raw = redSimSeedInput.trim();
              const parsed = raw === '' ? Date.now() : parseInt(raw, 10);
              const seed = Number.isFinite(parsed) ? parsed : Date.now();
              const payload = runAdminCoopRedSimulations(seed);
              setRedSimPayload(payload);
              setRedSimExpandedKey(null);
              setReplayArenaKey(null);
              setHostF(null);
              setGuestF(null);
            } catch (err) {
              setRedSimError(err?.message || 'Erreur simulation');
              setRedSimPayload(null);
            } finally {
              setRedSimLoading(false);
            }
          }}
          className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 font-bold text-white disabled:opacity-40"
        >
          {redSimLoading ? 'Simulation…' : 'Lancer 3 combats (150 / 250 / 350)'}
        </button>
      </div>
      {redSimError && <p className="text-red-400 text-sm mb-3">{redSimError}</p>}
      {redSimPayload && <p className="text-stone-500 text-xs mb-4">Seed utilisé : {redSimPayload.seed}</p>}
      {redSimPayload?.runs?.map((run) => {
        const key = `${run.difficulty}-${run.level}`;
        const open = redSimExpandedKey === key;
        const arenaOpen = replayArenaKey === key;
        return (
          <div key={key} className="border border-stone-600 rounded-lg p-4 mb-3 bg-stone-950/50">
            <div className="flex flex-wrap justify-between gap-2 items-start">
              <div>
                <p className="font-bold text-amber-300">
                  {run.difficultyLabel} — niveau {run.level}
                </p>
                <p className="text-stone-400 text-sm mt-1">
                  {run.hostSummary.name} : {run.hostSummary.race} {run.hostSummary.class} ·{' '}
                  {run.guestSummary.name} : {run.guestSummary.race} {run.guestSummary.class}
                </p>
                <p className="text-stone-500 text-xs mt-1">Seed combat : {run.combatSeed}</p>
              </div>
              <div className="text-right text-sm">
                <p
                  className={
                    run.winner === 'players' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'
                  }
                >
                  {run.winner === 'players' ? 'Victoire joueurs' : 'Défaite'}
                </p>
                <p className="text-stone-500 text-xs">
                  Tours ~{run.tours} · PV finaux hôte {run.hostHP} · invité {run.guestHP}
                </p>
                <p className="text-stone-500 text-xs">Boss restants : {run.bossHP?.join(' / ') ?? '—'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                disabled={replaying}
                onClick={() => startReplay(run, key)}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-700/80 hover:bg-amber-600 text-white font-bold disabled:opacity-40"
              >
                {arenaOpen && replaying ? 'Lecture…' : 'Déroulé animé (UI combat)'}
              </button>
              {arenaOpen && (
                <button
                  type="button"
                  disabled={replaying}
                  onClick={() => {
                    replayGenRef.current += 1;
                    setReplaying(false);
                    setReplayArenaKey(null);
                    setCoopActor(null);
                  }}
                  className="text-xs text-stone-500 hover:text-stone-300 underline"
                >
                  Fermer l’arène
                </button>
              )}
              <button
                type="button"
                onClick={() => setRedSimExpandedKey(open ? null : key)}
                className="text-xs text-amber-500/90 hover:text-amber-400 underline"
              >
                {open ? 'Masquer le log brut' : 'Voir le log brut'}
              </button>
            </div>
            {arenaOpen && hostF && guestF && (
              <div className="mt-4 border border-red-900/60 rounded-lg p-4 bg-black/40">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <label className="text-stone-500 text-xs flex items-center gap-2">
                    Vitesse
                    <select
                      value={replaySpeed}
                      onChange={(e) => setReplaySpeed(e.target.value)}
                      disabled={replaying}
                      className="bg-stone-800 border border-stone-600 rounded px-2 py-1 text-white text-xs"
                    >
                      <option value="normal">Normal</option>
                      <option value="fast">Rapide</option>
                      <option value="turbo">Turbo</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={replaying}
                    onClick={() => startReplay(run, key)}
                    className="text-xs px-3 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-200 disabled:opacity-40"
                  >
                    Relancer le déroulé
                  </button>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div
                    className={`rounded-xl transition-shadow ${
                      coopActor === 1 ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-stone-950' : ''
                    }`}
                  >
                    <CharacterCardContent
                      character={hostF}
                      showHpBar
                      currentHP={hostF.currentHP}
                      maxHP={hostF.maxHP}
                      shield={hostF.shield ?? 0}
                      combatBaseOverride={hostCombatBase}
                      combatStatus={hostCombatStatus}
                      opponent={guestF}
                      imageOverride={hostF.characterImage ?? testImage1}
                      detailsPlacement="left"
                    />
                  </div>
                  <div className="flex flex-col gap-3 min-h-[200px]">
                    <p className="text-stone-500 text-xs font-bold uppercase tracking-wide">Boss (rotation)</p>
                    <div className="grid gap-2">
                      {(run.lineup || []).map((boss, i) => {
                        const maxH = boss?.baseStats?.hp ?? 1;
                        const cur = bossHPs[i] ?? 0;
                        const pct = Math.min(100, Math.max(0, (cur / maxH) * 100));
                        const isActive = activeBossIdx === i;
                        const bossHighlight = coopActor === 3 && isActive;
                        return (
                          <div
                            key={i}
                            className={`rounded-lg px-2 py-1.5 border transition ${
                              bossHighlight
                                ? 'border-red-400 bg-red-950/40'
                                : isActive
                                  ? 'border-amber-600/80 bg-stone-900/80'
                                  : 'border-stone-700 bg-stone-900/40 opacity-70'
                            }`}
                          >
                            <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                              <span className="text-stone-300 font-medium">{boss.nom}</span>
                              <span>
                                {cur} / {maxH}
                              </span>
                            </div>
                            <div className="h-2 bg-stone-800 rounded overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-red-800 to-amber-700 transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex-1 min-h-[160px] max-h-72 overflow-y-auto rounded-lg border border-stone-700 bg-black/50 p-2 text-left">
                      {combatLog.length === 0 ? (
                        <p className="text-stone-600 text-xs">Le fil de combat apparaît ici…</p>
                      ) : (
                        combatLog.map((line, idx) => (
                          <p key={idx} className="text-[11px] text-stone-300 leading-snug mb-0.5 font-mono">
                            {line}
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                  <div
                    className={`rounded-xl transition-shadow ${
                      coopActor === 2 ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-stone-950' : ''
                    }`}
                  >
                    <CharacterCardContent
                      character={guestF}
                      showHpBar
                      currentHP={guestF.currentHP}
                      maxHP={guestF.maxHP}
                      shield={guestF.shield ?? 0}
                      combatBaseOverride={guestCombatBase}
                      combatStatus={guestCombatStatus}
                      opponent={hostF}
                      imageOverride={guestF.characterImage ?? testImage2}
                      detailsPlacement="right"
                    />
                  </div>
                </div>
              </div>
            )}
            {open && (
              <pre className="mt-2 max-h-64 overflow-y-auto text-[11px] text-stone-400 whitespace-pre-wrap font-mono bg-black/40 p-2 rounded border border-stone-700">
                {(run.log || []).join('\n')}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
