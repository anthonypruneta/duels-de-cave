import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { V2_IMPOSED_CHARACTER, V2_PASSIVE, V2_WEAPON } from '../data/v2Kit';
import {
  getPortraitsForRaceClass,
  loadV2PortraitsFromFirestore,
} from '../services/v2PortraitCatalog';
import {
  createV2Champion,
  ensureV2Prototype,
  hasV2Champion,
  uploadV2ChampionImage,
} from '../services/v2PrototypeService';

const MIN_NAME = 2;
const MAX_NAME = 40;

/**
 * Écran post-roll : nom + image (galerie race/classe ou upload) → lore.
 */
export default function V2ChampionSelect() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [checking, setChecking] = useState(true);
  const [alreadyReady, setAlreadyReady] = useState(false);
  const [name, setName] = useState('');
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [selectedMeta, setSelectedMeta] = useState(null);
  const [portraits, setPortraits] = useState([]);
  const [catalogError, setCatalogError] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    let cancelled = false;
    (async () => {
      const res = await ensureV2Prototype(currentUser.uid);
      if (cancelled) return;
      if (res.success && hasV2Champion(res.data)) {
        setAlreadyReady(true);
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCatalog(true);
      const res = await loadV2PortraitsFromFirestore();
      if (cancelled) return;
      if (!res.success) {
        setCatalogError(res.error || 'Catalogue indisponible');
        setPortraits([]);
      } else {
        setPortraits(res.portraits);
        setCatalogError(null);
      }
      setLoadingCatalog(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kitPortraits = useMemo(
    () =>
      getPortraitsForRaceClass(
        portraits,
        V2_IMPOSED_CHARACTER.race,
        V2_IMPOSED_CHARACTER.class
      ),
    [portraits]
  );

  const handleSelectPortrait = (p) => {
    setSelectedUrl(p.characterImage);
    setSelectedMeta({
      portraitSourceId: p.sourceId,
      portraitName: p.name,
    });
    setError(null);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentUser?.uid) return;
    if (!file.type.startsWith('image/')) {
      setError('Fichier image requis.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const up = await uploadV2ChampionImage(currentUser.uid, dataUrl);
      if (!up.success) {
        setError(up.error);
        setBusy(false);
        return;
      }
      setSelectedUrl(up.imageUrl);
      setSelectedMeta({
        portraitSourceId: 'upload',
        portraitName: file.name,
      });
    } catch (err) {
      setError(err.message || 'Lecture image impossible');
    }
    setBusy(false);
  };

  const handleConfirm = async () => {
    if (!currentUser?.uid) return;
    const trimmed = name.trim();
    if (trimmed.length < MIN_NAME || trimmed.length > MAX_NAME) {
      setError(`Nom : ${MIN_NAME} à ${MAX_NAME} caractères.`);
      return;
    }
    if (!selectedUrl) {
      setError('Choisis une image du roll ou uploade la tienne.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createV2Champion(currentUser.uid, {
      name: trimmed,
      characterImage: selectedUrl,
      portraitSourceId: selectedMeta?.portraitSourceId,
      portraitName: selectedMeta?.portraitName,
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    navigate('/v2/lore', { replace: true });
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-400 flex items-center justify-center">
        Chargement…
      </div>
    );
  }

  if (alreadyReady) {
    return <Navigate to="/v2" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-stone-100">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <Link to="/v2" className="text-xs text-stone-500 hover:text-amber-500">
            ← Retour
          </Link>
          <h1 className="text-2xl font-bold text-amber-400 mt-2">Ton roll</h1>
          <p className="text-sm text-stone-400 mt-1">
            Personnalise ton champion avant de plonger dans la Cave.
          </p>
        </div>

        {/* Roll imposé */}
        <section className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
          <p className="text-[10px] uppercase tracking-widest text-amber-500/80 mb-2">Roll obtenu</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-bold text-amber-300">{V2_IMPOSED_CHARACTER.race}</span>
            <span className="text-stone-500">/</span>
            <span className="text-2xl font-bold text-amber-300">{V2_IMPOSED_CHARACTER.class}</span>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Kit : {V2_WEAPON.name} · {V2_PASSIVE.name}
          </p>
        </section>

        {/* Nom */}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-stone-300">Nom du champion</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME}
            placeholder="Ex. Revolte"
            className="w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2.5 text-stone-100 placeholder:text-stone-600 focus:border-amber-600 focus:outline-none"
          />
        </label>

        {/* Image */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wide">
              Image — {V2_IMPOSED_CHARACTER.race} / {V2_IMPOSED_CHARACTER.class}
            </h2>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded border border-stone-600 text-stone-300 hover:border-amber-600 hover:text-amber-300 disabled:opacity-50"
            >
              Uploader mon image
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {selectedUrl && (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-2">
              <img src={selectedUrl} alt="" className="w-16 h-16 object-contain bg-stone-950 rounded" />
              <p className="text-xs text-emerald-300">
                Image sélectionnée
                {selectedMeta?.portraitName ? ` · ${selectedMeta.portraitName}` : ''}
              </p>
            </div>
          )}

          {loadingCatalog && <p className="text-xs text-stone-500">Chargement des portraits…</p>}
          {catalogError && <p className="text-xs text-amber-400">{catalogError}</p>}

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
            {kitPortraits.map((p) => {
              const selected = selectedUrl === p.characterImage;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handleSelectPortrait(p)}
                  className={`rounded border p-1.5 text-left transition ${
                    selected
                      ? 'border-amber-500 bg-amber-950/40'
                      : 'border-stone-700 bg-stone-950/50 hover:border-stone-500'
                  }`}
                >
                  <img
                    src={p.characterImage}
                    alt={p.name}
                    className="w-full aspect-square object-contain bg-stone-900"
                    loading="lazy"
                  />
                  <div className="text-[10px] text-stone-400 truncate mt-1">{p.name}</div>
                </button>
              );
            })}
          </div>
          {!loadingCatalog && !kitPortraits.length && (
            <p className="text-xs text-stone-500">
              Aucun portrait Orc/Masochiste en BDD — utilise l’upload.
            </p>
          )}
        </section>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={handleConfirm}
          className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold disabled:opacity-50"
        >
          {busy ? 'Création…' : 'Valider et commencer'}
        </button>
      </div>
    </div>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Lecture fichier échouée'));
    reader.readAsDataURL(file);
  });
}
