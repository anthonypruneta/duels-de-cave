import React, { useEffect, useMemo, useState } from 'react';
import {
  getPortraitsForRaceClass,
  groupPortraitsByRaceClass,
  loadV2PortraitsFromFirestore,
} from '../services/v2PortraitCatalog';
import { V2_IMPOSED_CHARACTER } from '../data/v2Kit';

/**
 * Galerie des portraits Firebase classés en dossiers race → classe.
 * Pour le proto : sélection limitée au kit imposé (Orc / Masochiste).
 */
export default function V2PortraitBrowser({
  selectedImage,
  onSelect,
  disabled,
}) {
  const [portraits, setPortraits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [raceFilter, setRaceFilter] = useState(V2_IMPOSED_CHARACTER.race);
  const [classFilter, setClassFilter] = useState(V2_IMPOSED_CHARACTER.class);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await loadV2PortraitsFromFirestore();
      if (cancelled) return;
      if (!res.success) {
        setError(res.error || 'Catalogue indisponible');
        setPortraits([]);
      } else {
        setPortraits(res.portraits);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tree = useMemo(() => groupPortraitsByRaceClass(portraits), [portraits]);
  const races = useMemo(() => Object.keys(tree).sort((a, b) => a.localeCompare(b, 'fr')), [tree]);
  const classesForRace = useMemo(() => {
    const map = tree[raceFilter] || {};
    return Object.keys(map).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [tree, raceFilter]);

  const folderPortraits = useMemo(
    () => getPortraitsForRaceClass(portraits, raceFilter, classFilter),
    [portraits, raceFilter, classFilter]
  );

  const kitFolderCount = useMemo(
    () =>
      getPortraitsForRaceClass(
        portraits,
        V2_IMPOSED_CHARACTER.race,
        V2_IMPOSED_CHARACTER.class
      ).length,
    [portraits]
  );

  const canSelect = raceFilter === V2_IMPOSED_CHARACTER.race && classFilter === V2_IMPOSED_CHARACTER.class;

  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/70 p-3 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide">
          Portraits (BDD)
        </h3>
        <p className="text-xs text-stone-400 mt-1">
          Images des personnages Firebase, classées par race / classe (comme l’annuaire). Le proto
          utilise le dossier{' '}
          <span className="text-amber-300">
            {V2_IMPOSED_CHARACTER.race}/{V2_IMPOSED_CHARACTER.class}
          </span>{' '}
          ({kitFolderCount} image{kitFolderCount !== 1 ? 's' : ''}).
        </p>
      </div>

      {loading && <p className="text-xs text-stone-500">Chargement du catalogue…</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {!loading && !error && (
        <>
          <div className="flex flex-wrap gap-2">
            <label className="text-xs text-stone-400 flex items-center gap-1">
              Race
              <select
                value={raceFilter}
                onChange={(e) => {
                  const nextRace = e.target.value;
                  setRaceFilter(nextRace);
                  const classes = Object.keys(tree[nextRace] || {}).sort((a, b) =>
                    a.localeCompare(b, 'fr')
                  );
                  setClassFilter(classes[0] || '');
                }}
                className="ml-1 rounded bg-stone-950 border border-stone-600 text-stone-200 text-xs px-2 py-1"
              >
                {races.map((r) => (
                  <option key={r} value={r}>
                    {r} ({Object.values(tree[r] || {}).reduce((n, arr) => n + arr.length, 0)})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-stone-400 flex items-center gap-1">
              Classe
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="ml-1 rounded bg-stone-950 border border-stone-600 text-stone-200 text-xs px-2 py-1"
              >
                {classesForRace.map((c) => (
                  <option key={c} value={c}>
                    {c} ({(tree[raceFilter]?.[c] || []).length})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-[10px] text-stone-500">
            Dossier : {raceFilter || '—'} / {classFilter || '—'} · {folderPortraits.length} portrait
            {folderPortraits.length !== 1 ? 's' : ''}
            {!canSelect && ' (consultation seule — sélection réservée au kit imposé)'}
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {folderPortraits.map((p) => {
              const selected = selectedImage === p.characterImage;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled || !canSelect}
                  onClick={() => onSelect?.(p)}
                  title={p.name}
                  className={`rounded border p-1.5 text-left transition ${
                    selected
                      ? 'border-amber-500 bg-amber-950/40'
                      : 'border-stone-700 bg-stone-950/50 hover:border-stone-500'
                  } disabled:opacity-40`}
                >
                  <img
                    src={p.characterImage}
                    alt={p.name}
                    className="w-full aspect-square object-contain bg-stone-900"
                    loading="lazy"
                  />
                  <div className="text-[10px] text-stone-300 truncate mt-1">{p.name}</div>
                </button>
              );
            })}
            {!folderPortraits.length && (
              <p className="col-span-full text-xs text-stone-500">Aucun portrait dans ce dossier.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
