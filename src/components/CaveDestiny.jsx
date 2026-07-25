import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAVE_DESTINY_AMBITIONS,
  CAVE_DESTINY_MENTORS,
  CAVE_DESTINY_WEAPONS,
  pickRandomGameCharacters,
  LAST_OFFERED_STORAGE_KEY,
  LAST_OFFERED_HISTORY_LIMIT,
} from '../data/caveDestiny';
import {
  createCareer,
  ensureCurrentEvent,
  resolveChoice,
  loadSave,
  persistSave,
  clearSave,
  loadPantheon,
  pushToPantheon,
  buildFinalStory,
  formatDelta,
  computeScore,
  getTier,
} from '../utils/caveDestinyEngine';
import { loadCaveDestinyCharacterPool } from '../services/caveDestinyCharacters';
import { useAuth } from '../contexts/AuthContext';

const SETUP_STEPS = ['personnage', 'ambition', 'mentor', 'arme'];

function readLastOfferedIds() {
  try {
    const raw = sessionStorage.getItem(LAST_OFFERED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeLastOfferedIds(ids) {
  try {
    const incoming = ids.map(String);
    const prev = readLastOfferedIds().filter((id) => !incoming.includes(id));
    const next = [...incoming, ...prev].slice(0, LAST_OFFERED_HISTORY_LIMIT);
    sessionStorage.setItem(LAST_OFFERED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function Shell({ children }) {
  return (
    <div className="cave-destiny-shell relative min-h-screen text-stone-100 overflow-hidden">
      <div className="cave-destiny-orb cave-destiny-orb-a" aria-hidden="true" />
      <div className="cave-destiny-orb cave-destiny-orb-b" aria-hidden="true" />
      <div className="cave-destiny-vignette" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-lg px-4 pt-10 pb-16">{children}</div>
    </div>
  );
}

function StepDots({ step }) {
  const idx = SETUP_STEPS.indexOf(step);
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {SETUP_STEPS.map((s, i) => (
        <span
          key={s}
          className={`h-2 w-2 rounded-full border ${
            i < idx
              ? 'bg-amber-500 border-amber-400'
              : i === idx
                ? 'bg-amber-300 border-amber-200'
                : 'bg-stone-800 border-stone-600'
          }`}
        />
      ))}
    </div>
  );
}

function BackLink({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-stone-400 hover:text-amber-300 mb-4 transition"
    >
      ← Retour
    </button>
  );
}

function ScreenTitle({ title, sub }) {
  return (
    <div className="mb-6 text-center">
      <h2 className="font-[Cinzel,serif] text-2xl sm:text-3xl font-bold text-amber-100 uppercase tracking-wide">
        {title}
      </h2>
      {sub && <p className="mt-2 text-sm text-stone-400 leading-relaxed">{sub}</p>}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3.5 rounded-xl border-2 border-amber-500/80 bg-amber-700/40 text-amber-50 text-sm font-bold tracking-wide hover:bg-amber-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition"
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 rounded-xl border border-stone-600 text-stone-200 text-sm font-medium hover:bg-stone-800/70 disabled:opacity-40 transition"
    >
      {children}
    </button>
  );
}

function ChoiceRow({ title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-stone-600/80 bg-stone-950/70 px-4 py-4 hover:border-amber-500/60 hover:bg-amber-950/20 transition"
    >
      <p className="font-semibold text-amber-50">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-stone-400 leading-relaxed">{description}</p>
      )}
    </button>
  );
}

function Gauge({ label, value, colorClass = 'bg-amber-500' }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-[11px] text-stone-400 mb-1">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-stone-900 border border-stone-700 overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-500`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function CharacterPortrait({ src, alt, className }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`${className} bg-stone-800 border border-stone-600 flex items-center justify-center text-stone-500 text-xs`}
      >
        ?
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt || ''}
      referrerPolicy="no-referrer"
      className={`${className} object-cover bg-stone-900 border border-stone-600`}
      onError={() => setFailed(true)}
    />
  );
}

const CaveDestiny = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [screen, setScreen] = useState('home');
  const [setup, setSetup] = useState({
    character: null,
    ambitionId: null,
    mentorId: null,
    weaponId: null,
  });
  const [career, setCareer] = useState(null);
  const [pantheon, setPantheon] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [outcomeFlash, setOutcomeFlash] = useState(null);
  const [allGameCharacters, setAllGameCharacters] = useState([]);
  const [offeredCharacters, setOfferedCharacters] = useState([]);
  const [charsLoading, setCharsLoading] = useState(false);
  const [charsError, setCharsError] = useState(null);
  const [drawNonce, setDrawNonce] = useState(0);
  const poolRef = useRef([]);

  useEffect(() => {
    document.body.classList.add('cave-destiny-plain');
    return () => document.body.classList.remove('cave-destiny-plain');
  }, []);

  const ensurePool = useCallback(async () => {
    if (poolRef.current.length > 0) return poolRef.current;
    const res = await loadCaveDestinyCharacterPool();
    if (!res.success) {
      throw new Error(res.error || 'Chargement impossible');
    }
    poolRef.current = res.data || [];
    setAllGameCharacters(poolRef.current);
    return poolRef.current;
  }, []);

  const drawFreshOffer = useCallback(async () => {
    setCharsLoading(true);
    setCharsError(null);
    try {
      const pool = await ensurePool();
      if (!pool.length) {
        setOfferedCharacters([]);
        setCharsError('Aucun personnage actif trouvé dans Duels de Cave.');
        return;
      }
      const excludeIds = readLastOfferedIds();
      const picked = pickRandomGameCharacters(pool, 3, { excludeIds });
      setOfferedCharacters(picked);
      writeLastOfferedIds(picked.map((c) => c.id));
    } catch (e) {
      setCharsError(e?.message || 'Erreur de chargement.');
      setOfferedCharacters([]);
    } finally {
      setCharsLoading(false);
    }
  }, [ensurePool]);

  useEffect(() => {
    setPantheon(loadPantheon());
    const saved = loadSave();
    if (saved?.phase === 'playing') {
      setCareer(ensureCurrentEvent(saved));
    }
  }, []);

  useEffect(() => {
    if (career) persistSave(career);
  }, [career]);

  // Nouveau tirage à chaque visite de l’écran (drawNonce incrémenté à l’entrée)
  useEffect(() => {
    if (screen !== 'personnage') return;
    drawFreshOffer();
  }, [screen, drawNonce, drawFreshOffer]);

  const startFresh = () => {
    setSetup({ character: null, ambitionId: null, mentorId: null, weaponId: null });
    setCareer(null);
    clearSave();
    setOutcomeFlash(null);
    setDrawNonce((n) => n + 1);
    setScreen('personnage');
  };

  const resume = () => {
    if (!career) return;
    setScreen(career.phase === 'finished' ? 'final' : 'game');
  };

  const selectCharacter = (character) => {
    setSetup((s) => ({ ...s, character }));
    setScreen('ambition');
  };

  const selectAmbition = (id) => {
    setSetup((s) => ({ ...s, ambitionId: id }));
    setScreen('mentor');
  };

  const selectMentor = (id) => {
    setSetup((s) => ({ ...s, mentorId: id }));
    setScreen('arme');
  };

  const selectWeapon = (id) => {
    const nextSetup = { ...setup, weaponId: id };
    setSetup(nextSetup);
    const created = ensureCurrentEvent(createCareer(nextSetup));
    setCareer(created);
    setScreen('game');
  };

  const handleChoice = (optionIndex) => {
    if (!career) return;
    const next = resolveChoice(career, optionIndex);
    setOutcomeFlash(next.lastOutcome);
    setCareer(next);
    if (next.phase === 'finished') {
      const list = pushToPantheon(next);
      setPantheon(list);
    }
  };

  const continueAfterOutcome = () => {
    setOutcomeFlash(null);
    if (career?.phase === 'finished') setScreen('final');
  };

  const backSetup = () => {
    const order = ['home', 'personnage', 'ambition', 'mentor', 'arme'];
    const i = order.indexOf(screen);
    if (i <= 1) setScreen('home');
    else setScreen(order[i - 1]);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (e) {
      console.error(e);
    }
  };

  /* ---------- HOME ---------- */
  if (screen === 'home') {
    const canResume = career?.phase === 'playing';
    return (
      <Shell>
        <div className="flex flex-col items-center text-center min-h-[70vh] justify-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-amber-500/80 mb-3 font-bold">
            Duels de Cave
          </p>
          <h1 className="font-[Cinzel,serif] text-4xl sm:text-5xl font-bold text-amber-100 drop-shadow-[0_2px_20px_rgba(245,158,11,0.25)]">
            Cave Destiny
          </h1>
          <p className="mt-4 text-sm text-stone-300 leading-relaxed max-w-sm">
            Incarnez un personnage de la Cave et écrivez sa carrière, saison après saison.
          </p>

          <div className="mt-10 w-full space-y-3 max-w-sm">
            {canResume && (
              <PrimaryButton onClick={resume}>
                Reprendre — saison {career.season}/{career.maxSeasons}
              </PrimaryButton>
            )}
            <PrimaryButton onClick={startFresh}>Commencer une carrière</PrimaryButton>
            <GhostButton onClick={() => setScreen('pantheon')}>Panthéon</GhostButton>
          </div>

          {pantheon[0] && (
            <p className="mt-8 text-xs text-stone-500">
              Dernière légende : {pantheon[0].name}
            </p>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="mt-12 text-xs text-stone-600 hover:text-stone-400 transition"
          >
            Déconnexion
          </button>
        </div>
      </Shell>
    );
  }

  /* ---------- PANTHEON ---------- */
  if (screen === 'pantheon') {
    return (
      <Shell>
        <BackLink onClick={() => setScreen('home')} />
        <ScreenTitle title="Panthéon" sub="Les carrières que vous avez terminées." />
        <div className="space-y-2">
          {pantheon.length === 0 && (
            <p className="text-center text-sm text-stone-500 py-12">Aucune carrière pour l’instant.</p>
          )}
          {pantheon.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-xl border border-stone-700 bg-stone-950/70 p-3"
            >
              <CharacterPortrait
                src={entry.characterImage}
                alt={entry.name}
                className="w-12 h-12 rounded-lg shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-amber-50 truncate">{entry.name}</p>
                <p className="text-xs italic text-stone-500">
                  Créateur : {entry.ownerPseudo || 'Inconnu'}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">{entry.tierLabel}</p>
              </div>
              <p className="text-sm font-bold text-amber-300 shrink-0">{entry.score}</p>
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  /* ---------- SETUP: PERSONNAGE ---------- */
  if (screen === 'personnage') {
    return (
      <Shell>
        <BackLink onClick={backSetup} />
        <StepDots step="personnage" />
        <ScreenTitle
          title="Choisissez un personnage"
          sub="Trois personnages existants de Duels de Cave."
        />

        {charsLoading && (
          <p className="text-center text-sm text-stone-400 py-10">Chargement…</p>
        )}

        {!charsLoading && charsError && offeredCharacters.length === 0 && (
          <div className="text-center py-8 space-y-4">
            <p className="text-sm text-red-300">{charsError}</p>
            <GhostButton
              onClick={() => {
                poolRef.current = [];
                setAllGameCharacters([]);
                setDrawNonce((n) => n + 1);
              }}
            >
              Réessayer
            </GhostButton>
          </div>
        )}

        <div className="space-y-3">
          {!charsLoading && offeredCharacters.map((c) => (
            <button
              key={`${c.id}-${c.name}`}
              type="button"
              onClick={() => selectCharacter(c)}
              className="w-full text-left rounded-xl border border-stone-600 bg-stone-950/80 p-3 hover:border-amber-500/70 hover:bg-amber-950/20 transition flex items-center gap-4"
            >
              <CharacterPortrait
                src={c.characterImage}
                alt={c.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg shrink-0"
              />
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-amber-50 leading-tight font-[Cinzel,serif]">
                  {c.name}
                </h3>
                <p className="mt-1.5 text-sm italic text-stone-500">
                  Créateur : {c.ownerPseudo || 'Inconnu'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  /* ---------- SETUP: AMBITION ---------- */
  if (screen === 'ambition') {
    return (
      <Shell>
        <BackLink onClick={backSetup} />
        <StepDots step="ambition" />
        <ScreenTitle title="Votre ambition" sub="Elle orientera votre carrière." />
        <div className="space-y-2">
          {CAVE_DESTINY_AMBITIONS.map((a) => (
            <ChoiceRow
              key={a.id}
              title={a.name}
              description={a.desc}
              onClick={() => selectAmbition(a.id)}
            />
          ))}
        </div>
      </Shell>
    );
  }

  /* ---------- SETUP: MENTOR ---------- */
  if (screen === 'mentor') {
    return (
      <Shell>
        <BackLink onClick={backSetup} />
        <StepDots step="mentor" />
        <ScreenTitle title="Votre mentor" sub="Qui vous guide au début ?" />
        <div className="space-y-2">
          {CAVE_DESTINY_MENTORS.map((m) => (
            <ChoiceRow
              key={m.id}
              title={m.name}
              description={m.desc}
              onClick={() => selectMentor(m.id)}
            />
          ))}
        </div>
      </Shell>
    );
  }

  /* ---------- SETUP: ARME ---------- */
  if (screen === 'arme') {
    return (
      <Shell>
        <BackLink onClick={backSetup} />
        <StepDots step="arme" />
        <ScreenTitle title="Votre voie d’arme" sub="Choisissez l’arme qui vous définit." />
        <div className="space-y-2">
          {CAVE_DESTINY_WEAPONS.map((w) => (
            <ChoiceRow
              key={w.id}
              title={w.name}
              description={w.desc}
              onClick={() => selectWeapon(w.id)}
            />
          ))}
        </div>
      </Shell>
    );
  }

  /* ---------- FINAL ---------- */
  if (screen === 'final' && career) {
    const { score, tier, story } = buildFinalStory(career);
    const trophyEntries = Object.entries(career.trophies || {}).filter(([, v]) => v > 0);
    return (
      <Shell>
        <div className="rounded-2xl border-2 border-amber-600/50 bg-stone-950/85 p-5 shadow-[0_0_30px_rgba(245,158,11,0.12)]">
          <div className="flex gap-4 items-start">
            <CharacterPortrait
              src={career.character.characterImage}
              alt={career.character.name}
              className="w-20 h-20 rounded-lg shrink-0"
            />
            <div className="min-w-0">
              <p className={`text-xs uppercase tracking-wider font-bold ${tier.color}`}>
                {tier.label}
              </p>
              <h2 className="font-[Cinzel,serif] text-2xl font-bold text-amber-50 mt-0.5">
                {career.character.name}
              </h2>
              <p className="text-sm italic text-stone-500 mt-1">
                Créateur : {career.character.ownerPseudo || 'Inconnu'}
              </p>
              <p className="text-sm text-stone-400 mt-2">{career.ambition.name}</p>
            </div>
          </div>

          <div className="mt-6 flex items-end gap-2">
            <span className="text-4xl font-black text-amber-300">{score}</span>
            <span className="text-sm text-stone-500 pb-1">score</span>
          </div>

          <p className="mt-4 text-sm text-stone-300 leading-relaxed">{story}</p>

          {trophyEntries.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {trophyEntries.map(([k, v]) => (
                <span
                  key={k}
                  className="text-xs px-2 py-1 rounded-md bg-amber-950/50 border border-amber-800/40 text-amber-100"
                >
                  {k} ×{v}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <PrimaryButton onClick={startFresh}>Nouvelle carrière</PrimaryButton>
          <GhostButton
            onClick={() => {
              clearSave();
              setCareer(null);
              setScreen('home');
            }}
          >
            Accueil
          </GhostButton>
        </div>
      </Shell>
    );
  }

  /* ---------- GAME ---------- */
  if (screen === 'game' && career) {
    const event = career.currentEvent;
    const progress = ((career.season - 1) / career.maxSeasons) * 100;
    const liveScore = computeScore(career);
    const liveTier = getTier(liveScore);

    return (
      <Shell>
        <header className="flex items-center gap-3 mb-5 rounded-xl border border-stone-700 bg-stone-950/80 px-3 py-2.5">
          <CharacterPortrait
            src={career.character.characterImage}
            alt=""
            className="w-10 h-10 rounded-lg shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-50 truncate">{career.character.name}</p>
            <p className="text-xs italic text-stone-500 truncate">
              Créateur : {career.character.ownerPseudo || 'Inconnu'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-stone-200">
              {career.season}/{career.maxSeasons}
            </p>
            <p className={`text-[11px] ${liveTier.color}`}>{liveTier.label}</p>
          </div>
        </header>

        <div className="flex gap-4 text-sm mb-4">
          <div>
            <p className="text-[11px] text-stone-500">Score</p>
            <p className="font-bold text-amber-300">{liveScore}</p>
          </div>
          <div>
            <p className="text-[11px] text-stone-500">Or</p>
            <p className="font-bold text-yellow-200">{Math.round(career.stats.or)}</p>
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-stone-500">Renommée</p>
            <p className="font-bold text-amber-100">{Math.round(career.stats.renommee)}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowProfile((v) => !v)}
            className="text-xs text-stone-400 hover:text-amber-300 self-end"
          >
            Profil
          </button>
        </div>

        <div className="flex gap-3 mb-3">
          <Gauge label="Forme" value={career.stats.forme} colorClass="bg-emerald-500" />
          <Gauge label="Moral" value={career.stats.moral} colorClass="bg-sky-500" />
        </div>

        {showProfile && (
          <div className="mb-4 rounded-xl border border-stone-700 bg-stone-950/80 p-3 grid grid-cols-3 gap-2 text-center text-xs">
            {[
              ['Puissance', career.stats.puissance],
              ['Endurance', career.stats.endurance],
              ['Magie', career.stats.magie],
              ['Vitesse', career.stats.vitesse],
              ['Charisme', career.stats.charisme],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-stone-500">{label}</p>
                <p className="font-semibold text-amber-100">{Math.round(value)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="h-1 rounded-full bg-stone-900 border border-stone-700 overflow-hidden mb-6">
          <div
            className="h-full bg-gradient-to-r from-amber-700 to-amber-400 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="rounded-2xl border border-stone-600 bg-stone-950/85 p-5 min-h-[260px] flex flex-col">
          {outcomeFlash ? (
            <>
              <p className="text-[11px] uppercase tracking-wider text-amber-500/90 font-bold">
                Saison {outcomeFlash.season}
              </p>
              <h3 className="text-lg font-bold text-amber-50 mt-1">{outcomeFlash.title}</h3>
              <p className="text-sm text-stone-300 mt-3 leading-relaxed flex-1">
                {outcomeFlash.text}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {formatDelta(outcomeFlash.deltas).map((d) => (
                  <span
                    key={d}
                    className={`text-xs px-2 py-0.5 rounded border ${
                      d.startsWith('+')
                        ? 'border-emerald-700/50 bg-emerald-950/40 text-emerald-300'
                        : 'border-red-800/50 bg-red-950/40 text-red-300'
                    }`}
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="mt-5">
                <PrimaryButton onClick={continueAfterOutcome}>Continuer</PrimaryButton>
              </div>
            </>
          ) : event ? (
            <>
              <p className="text-[11px] uppercase tracking-wider text-amber-500/90 font-bold">
                Événement
              </p>
              <h3 className="text-lg font-bold text-amber-50 mt-1">{event.title}</h3>
              <p className="text-sm text-stone-300 mt-3 leading-relaxed flex-1">{event.text}</p>
              <div className="mt-5 space-y-2">
                {event.options.map((opt, i) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => handleChoice(i)}
                    className="w-full text-left rounded-xl border border-stone-600 px-4 py-3 text-sm text-stone-100 hover:border-amber-500/60 hover:bg-amber-950/25 transition"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-stone-400">Chargement…</p>
          )}
        </div>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setScreen('home')}
            className="text-sm text-stone-500 hover:text-amber-300 transition"
          >
            Accueil
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-center text-sm text-stone-400 pt-20">Chargement…</p>
    </Shell>
  );
};

export default CaveDestiny;
