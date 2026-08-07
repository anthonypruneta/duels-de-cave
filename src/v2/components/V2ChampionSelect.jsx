import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getClassSpellIds } from '../data/v2Classes';
import {
  getClassIcon,
  getRaceIcon,
  rollV2CharacterOffers,
} from '../data/v2CharacterRoll';
import { getRacePassive } from '../data/v2Races';
import { getSpellById } from '../data/v2Kit';
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
import V2ImageCropModal from './V2ImageCropModal';

const MIN_NAME = 2;
const MAX_NAME = 40;

/**
 * Création champion : 3 rolls race/classe → nom + images filtrées par combo.
 */
export default function V2ChampionSelect() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [checking, setChecking] = useState(true);
  const [alreadyReady, setAlreadyReady] = useState(false);
  const [offers, setOffers] = useState([]);
  const [picked, setPicked] = useState(null);

  const [name, setName] = useState('');
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [selectedMeta, setSelectedMeta] = useState(null);
  const [portraits, setPortraits] = useState([]);
  const [catalogError, setCatalogError] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [pendingFileName, setPendingFileName] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    let cancelled = false;
    (async () => {
      const res = await ensureV2Prototype(currentUser.uid);
      if (cancelled) return;
      if (res.success && hasV2Champion(res.data)) {
        setAlreadyReady(true);
      } else {
        const storageKey = `v2_roll_offers_${currentUser.uid}`;
        try {
          const cached = sessionStorage.getItem(storageKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length >= 3) {
              setOffers(parsed.slice(0, 3));
            } else {
              const rolled = rollV2CharacterOffers(3);
              sessionStorage.setItem(storageKey, JSON.stringify(rolled));
              setOffers(rolled);
            }
          } else {
            const rolled = rollV2CharacterOffers(3);
            sessionStorage.setItem(storageKey, JSON.stringify(rolled));
            setOffers(rolled);
          }
        } catch {
          setOffers(rollV2CharacterOffers(3));
        }
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

  const kitPortraits = useMemo(() => {
    if (!picked) return [];
    return getPortraitsForRaceClass(portraits, picked.race, picked.class);
  }, [portraits, picked]);

  const classSpells = useMemo(() => {
    if (!picked) return [];
    return getClassSpellIds(picked.class).map((id) => getSpellById(id)).filter(Boolean);
  }, [picked]);

  const racePassive = picked ? getRacePassive(picked.race) : null;

  const handlePickOffer = (offer) => {
    setPicked(offer);
    setSelectedUrl(null);
    setSelectedMeta(null);
    setError(null);
  };

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
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPendingFileName(file.name);
      setCropSrc(dataUrl);
    } catch (err) {
      setError(err.message || 'Lecture image impossible');
    }
  };

  const handleCropConfirm = async (croppedDataUrl) => {
    if (!currentUser?.uid) return;
    setBusy(true);
    setError(null);
    const up = await uploadV2ChampionImage(currentUser.uid, croppedDataUrl);
    setBusy(false);
    if (!up.success) {
      setError(up.error);
      return;
    }
    setSelectedUrl(up.imageUrl);
    setSelectedMeta({
      portraitSourceId: 'upload',
      portraitName: pendingFileName || 'upload',
    });
    setCropSrc(null);
    setPendingFileName(null);
  };

  const handleConfirm = async () => {
    if (!currentUser?.uid || !picked) return;
    const trimmed = name.trim();
    if (trimmed.length < MIN_NAME || trimmed.length > MAX_NAME) {
      setError(`Nom : ${MIN_NAME} à ${MAX_NAME} caractères.`);
      return;
    }
    if (!selectedUrl) {
      setError('Choisis une image de ta combinaison ou uploade la tienne.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createV2Champion(currentUser.uid, {
      name: trimmed,
      characterImage: selectedUrl,
      race: picked.race,
      class: picked.class,
      portraitSourceId: selectedMeta?.portraitSourceId,
      portraitName: selectedMeta?.portraitName,
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    try {
      sessionStorage.removeItem(`v2_roll_offers_${currentUser.uid}`);
    } catch {
      /* ignore */
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
          <h1 className="text-2xl font-bold text-amber-400 mt-2">
            {picked ? 'Personnalise ton champion' : 'Choisis ton roll'}
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            {picked
              ? 'Nom + image filtrée sur ta combinaison race / classe.'
              : '3 propositions aléatoires — choisis celle qui te plaît.'}
          </p>
        </div>

        {!picked && (
          <div className="space-y-3">
            {offers.map((offer) => {
              const portraitCount = getPortraitsForRaceClass(
                portraits,
                offer.race,
                offer.class
              ).length;
              return (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => handlePickOffer(offer)}
                  className="w-full text-left rounded-xl border border-stone-600 bg-stone-900/70 hover:border-amber-500/70 hover:bg-amber-950/20 p-4 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getRaceIcon(offer.race)}</span>
                    <span className="text-3xl">{getClassIcon(offer.class)}</span>
                    <div className="min-w-0">
                      <div className="text-lg font-bold text-amber-300">
                        {offer.race} / {offer.class}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {portraitCount === 0
                          ? 'Aucun portrait en BDD (upload possible)'
                          : `${portraitCount} portrait${portraitCount > 1 ? 's' : ''} disponible${portraitCount > 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const rolled = rollV2CharacterOffers(3);
                setOffers(rolled);
                if (currentUser?.uid) {
                  try {
                    sessionStorage.setItem(
                      `v2_roll_offers_${currentUser.uid}`,
                      JSON.stringify(rolled)
                    );
                  } catch {
                    /* ignore */
                  }
                }
              }}
              className="w-full text-xs text-stone-500 hover:text-amber-400 py-2"
            >
              Relancer les 3 propositions
            </button>
          </div>
        )}

        {picked && (
          <>
            <section className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-amber-500/80 mb-1">
                    Combinaison choisie
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xl font-bold text-amber-300">
                    <span>
                      {getRaceIcon(picked.race)} {picked.race}
                    </span>
                    <span className="text-stone-500">/</span>
                    <span>
                      {getClassIcon(picked.class)} {picked.class}
                    </span>
                  </div>
                  {racePassive && (
                    <p className="text-xs text-red-200/90 mt-1">
                      Passif race : {racePassive.icon} {racePassive.name} — {racePassive.description}
                    </p>
                  )}
                  {classSpells.length > 0 && (
                    <p className="text-xs text-stone-400 mt-1">
                      Sort{classSpells.length > 1 ? 's' : ''} de classe :{' '}
                      {classSpells.map((s) => `${s.icon} ${s.name}`).join(' · ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(null);
                    setSelectedUrl(null);
                    setSelectedMeta(null);
                    setError(null);
                  }}
                  className="text-xs text-stone-400 underline hover:text-amber-400"
                >
                  Changer de roll
                </button>
              </div>
            </section>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-stone-300">Nom du champion</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME}
                placeholder="Nom du personnage"
                className="w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2.5 text-stone-100 placeholder:text-stone-600 focus:border-amber-600 focus:outline-none"
              />
            </label>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wide">
                  Image — {picked.race} / {picked.class} uniquement
                </h2>
                <button
                  type="button"
                  disabled={busy || Boolean(cropSrc)}
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
                  <img
                    src={selectedUrl}
                    alt=""
                    className="w-16 h-16 object-cover bg-stone-950 rounded"
                  />
                  <p className="text-xs text-emerald-300">Image sélectionnée</p>
                </div>
              )}

              {loadingCatalog && (
                <p className="text-xs text-stone-500">Chargement des portraits…</p>
              )}
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
                        alt=""
                        className="w-full aspect-square object-contain bg-stone-900"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
              {!loadingCatalog && !kitPortraits.length && (
                <p className="text-xs text-stone-500">
                  Aucun portrait {picked.race}/{picked.class} en BDD — utilise l’upload.
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
          </>
        )}
      </div>

      {cropSrc && (
        <V2ImageCropModal
          imageSrc={cropSrc}
          busy={busy}
          onCancel={() => {
            if (busy) return;
            setCropSrc(null);
            setPendingFileName(null);
          }}
          onConfirm={handleCropConfirm}
        />
      )}
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
