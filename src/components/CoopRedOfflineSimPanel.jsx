import React, { useEffect, useState } from 'react';
import { runAdminCoopRedSimulations } from '../utils/coopRedAdminSim';
import CoopRedAnimatedReplay from './CoopRedAnimatedReplay';

/**
 * Simulation locale du donjon Red (même moteur que la prod) avec déroulé animé.
 * Utilisable depuis la page donjon ou l’admin.
 */
export default function CoopRedOfflineSimPanel({
  title = '🔴 Simulation donjon Red (coop)',
  intro = (
    <>
      Génère deux personnages <span className="text-stone-300">aléatoires</span> par palier (niveau 150, 250 et 350)
      et lance le <span className="text-stone-300">même moteur</span> que le donjon coop. Tu peux lire le combat avec
      l’interface type arène (barres, cartes, log animé).
    </>
  ),
  onWideLayoutChange,
  className = '',
}) {
  const [redSimLoading, setRedSimLoading] = useState(false);
  const [redSimError, setRedSimError] = useState('');
  const [redSimPayload, setRedSimPayload] = useState(null);
  const [redSimSeedInput, setRedSimSeedInput] = useState('');
  const [redSimExpandedKey, setRedSimExpandedKey] = useState(null);
  const [replayArenaKey, setReplayArenaKey] = useState(null);
  const [arenaMountNonce, setArenaMountNonce] = useState(0);

  useEffect(() => {
    onWideLayoutChange?.(!!replayArenaKey);
  }, [replayArenaKey, onWideLayoutChange]);

  useEffect(() => {
    return () => {
      onWideLayoutChange?.(false);
    };
  }, [onWideLayoutChange]);

  return (
    <div className={`bg-stone-900/70 border-2 border-red-700 rounded-xl p-6 mb-8 ${className}`}>
      <h2 className="text-2xl font-bold text-red-400 mb-2">{title}</h2>
      <p className="text-stone-400 text-sm mb-4">{intro}</p>
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
                onClick={() => {
                  setRedSimError('');
                  setReplayArenaKey(key);
                  setArenaMountNonce((n) => n + 1);
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-700/80 hover:bg-amber-600 text-white font-bold"
              >
                Déroulé animé (UI combat)
              </button>
              {arenaOpen && (
                <button
                  type="button"
                  onClick={() => setReplayArenaKey(null)}
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
            {arenaOpen && (
              <CoopRedAnimatedReplay
                key={`${key}-${arenaMountNonce}`}
                hostSnap={run.hostSnap}
                guestSnap={run.guestSnap}
                difficulty={run.difficulty}
                combatSeed={run.combatSeed}
                steps={run.steps}
                lineup={run.lineup}
                onReplayError={(m) => setRedSimError(m)}
              />
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
