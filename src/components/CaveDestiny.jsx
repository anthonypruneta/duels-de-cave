import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAVE_DESTINY_AMBITIONS,
  CAVE_DESTINY_MENTORS,
  CAVE_DESTINY_WEAPONS,
  pickRandomGameCharacters,
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
import { getAllCharacters, getOwnerPseudoFromAccount } from '../services/characterService';
import { useAuth } from '../contexts/AuthContext';

const SETUP_STEPS = ['personnage', 'ambition', 'mentor', 'arme'];

function Shell({ children, narrow = true }) {
  return (
    <div className="cave-destiny-root min-h-screen bg-neutral-50 text-neutral-900">
      <div className={`mx-auto px-5 pt-10 pb-16 ${narrow ? 'max-w-md' : 'max-w-lg'}`}>
        {children}
      </div>
    </div>
  );
}

function StepDots({ step }) {
  const idx = SETUP_STEPS.indexOf(step);
  return (
    <div className="flex items-center justify-center gap-1.5 mb-8">
      {SETUP_STEPS.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 w-1.5 rounded-full ${
            i <= idx ? 'bg-neutral-800' : 'bg-neutral-300'
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
      className="text-sm text-neutral-400 hover:text-neutral-700 mb-6 transition"
    >
      ← Retour
    </button>
  );
}

function ScreenTitle({ title, sub }) {
  return (
    <div className="mb-8 text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h2>
      {sub && <p className="mt-2 text-sm text-neutral-500 leading-relaxed">{sub}</p>}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3.5 rounded-lg bg-neutral-900 text-white text-sm font-medium tracking-wide hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
      className="w-full py-3 rounded-lg border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-100 disabled:opacity-40 transition"
    >
      {children}
    </button>
  );
}

function TextLink({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-neutral-400 hover:text-neutral-700 underline-offset-4 hover:underline transition"
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
      className="w-full text-left rounded-xl border border-neutral-200 bg-white px-4 py-4 hover:border-neutral-400 transition"
    >
      <p className="font-medium text-neutral-900">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-neutral-500 leading-relaxed">{description}</p>
      )}
    </button>
  );
}

function Gauge({ label, value }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-[11px] text-neutral-500 mb-1">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
        <div
          className="h-full bg-neutral-800 transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
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

  useEffect(() => {
    document.body.classList.add('cave-destiny-plain');
    return () => document.body.classList.remove('cave-destiny-plain');
  }, []);

  const enrichOffered = useCallback(async (picked) => {
    const enriched = await Promise.all(
      picked.map(async (c) => {
        if (c.ownerPseudo) return c;
        const userId = c.id || c.userId;
        if (!userId) return c;
        const pseudoRes = await getOwnerPseudoFromAccount(userId);
        const ownerPseudo = pseudoRes.success ? (pseudoRes.ownerPseudo || '') : '';
        return ownerPseudo ? { ...c, ownerPseudo } : c;
      })
    );
    setOfferedCharacters(enriched);
  }, []);

  const reshuffleOffered = useCallback(async (pool) => {
    const source = pool || allGameCharacters;
    const picked = pickRandomGameCharacters(source, 3);
    setOfferedCharacters(picked);
    await enrichOffered(picked);
  }, [allGameCharacters, enrichOffered]);

  const loadGameCharacters = useCallback(async () => {
    setCharsLoading(true);
    setCharsError(null);
    try {
      const res = await getAllCharacters();
      if (!res.success) {
        setCharsError(res.error || 'Impossible de charger les personnages.');
        setAllGameCharacters([]);
        setOfferedCharacters([]);
        return;
      }
      const active = (res.data || []).filter((c) => !c.disabled && !c.archived);
      setAllGameCharacters(active);
      const picked = pickRandomGameCharacters(active, 3);
      setOfferedCharacters(picked);
      await enrichOffered(picked);
      if (active.length === 0) {
        setCharsError('Aucun personnage actif trouvé dans Duels de Cave.');
      }
    } catch (e) {
      setCharsError(e?.message || 'Erreur de chargement.');
      setAllGameCharacters([]);
      setOfferedCharacters([]);
    } finally {
      setCharsLoading(false);
    }
  }, [enrichOffered]);

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

  useEffect(() => {
    if (screen === 'personnage' && allGameCharacters.length === 0 && !charsLoading) {
      loadGameCharacters();
    }
  }, [screen, allGameCharacters.length, charsLoading, loadGameCharacters]);

  const startFresh = () => {
    setSetup({ character: null, ambitionId: null, mentorId: null, weaponId: null });
    setCareer(null);
    clearSave();
    setOutcomeFlash(null);
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
          <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-400 mb-3">
            Duels de Cave
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-900">
            Cave Destiny
          </h1>
          <p className="mt-4 text-sm text-neutral-500 leading-relaxed max-w-sm">
            Incarnez un personnage de la Cave et écrivez sa carrière, saison après saison.
          </p>

          <div className="mt-10 w-full space-y-3">
            {canResume && (
              <PrimaryButton onClick={resume}>
                Reprendre — saison {career.season}/{career.maxSeasons}
              </PrimaryButton>
            )}
            <PrimaryButton onClick={startFresh}>Commencer une carrière</PrimaryButton>
            <GhostButton onClick={() => setScreen('pantheon')}>Panthéon</GhostButton>
          </div>

          {pantheon[0] && (
            <p className="mt-8 text-xs text-neutral-400">
              Dernière légende : {pantheon[0].name}
            </p>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="mt-12 text-xs text-neutral-300 hover:text-neutral-500 transition"
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
            <p className="text-center text-sm text-neutral-400 py-12">Aucune carrière pour l’instant.</p>
          )}
          {pantheon.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
            >
              {entry.characterImage ? (
                <img
                  src={entry.characterImage}
                  alt={entry.name}
                  className="w-12 h-12 rounded-lg object-cover shrink-0 bg-neutral-100"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-neutral-100 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-neutral-900 truncate">{entry.name}</p>
                {entry.ownerPseudo && (
                  <p className="text-xs italic text-neutral-300">
                    Créateur : {entry.ownerPseudo}
                  </p>
                )}
                <p className="text-xs text-neutral-400 mt-0.5">{entry.tierLabel}</p>
              </div>
              <p className="text-sm font-semibold text-neutral-800 shrink-0">{entry.score}</p>
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

        <div className="flex justify-center mb-6">
          <TextLink
            onClick={() => !charsLoading && allGameCharacters.length >= 2 && reshuffleOffered()}
          >
            Relancer les choix
          </TextLink>
        </div>

        {charsLoading && (
          <p className="text-center text-sm text-neutral-400 py-10">Chargement…</p>
        )}

        {!charsLoading && charsError && offeredCharacters.length === 0 && (
          <div className="text-center py-8 space-y-4">
            <p className="text-sm text-red-600">{charsError}</p>
            <GhostButton onClick={loadGameCharacters}>Réessayer</GhostButton>
          </div>
        )}

        <div className="space-y-3">
          {offeredCharacters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCharacter(c)}
              className="w-full text-left rounded-xl border border-neutral-200 bg-white p-3 hover:border-neutral-400 transition flex items-center gap-4"
            >
              {c.characterImage ? (
                <img
                  src={c.characterImage}
                  alt={c.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover shrink-0 bg-neutral-100"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-neutral-100 shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-neutral-900 leading-tight">
                  {c.name}
                </h3>
                <p className="mt-1 text-sm italic text-neutral-300">
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
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex gap-4 items-start">
            {career.character.characterImage ? (
              <img
                src={career.character.characterImage}
                alt={career.character.name}
                className="w-20 h-20 rounded-lg object-cover shrink-0 bg-neutral-100"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-neutral-100 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-neutral-400">{tier.label}</p>
              <h2 className="text-2xl font-semibold text-neutral-900 mt-0.5">
                {career.character.name}
              </h2>
              <p className="text-sm italic text-neutral-300 mt-1">
                Créateur : {career.character.ownerPseudo || 'Inconnu'}
              </p>
              <p className="text-sm text-neutral-500 mt-2">{career.ambition.name}</p>
            </div>
          </div>

          <div className="mt-6 flex items-end gap-2">
            <span className="text-4xl font-semibold text-neutral-900">{score}</span>
            <span className="text-sm text-neutral-400 pb-1">score</span>
          </div>

          <p className="mt-4 text-sm text-neutral-600 leading-relaxed">{story}</p>

          {trophyEntries.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {trophyEntries.map(([k, v]) => (
                <span
                  key={k}
                  className="text-xs px-2 py-1 rounded-md bg-neutral-100 text-neutral-600"
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
        <header className="flex items-center gap-3 mb-5">
          {career.character.characterImage ? (
            <img
              src={career.character.characterImage}
              alt=""
              className="w-10 h-10 rounded-lg object-cover bg-neutral-100 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-neutral-100 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-neutral-900 truncate">{career.character.name}</p>
            <p className="text-xs italic text-neutral-300 truncate">
              Créateur : {career.character.ownerPseudo || 'Inconnu'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium text-neutral-800">
              {career.season}/{career.maxSeasons}
            </p>
            <p className="text-[11px] text-neutral-400">{liveTier.label}</p>
          </div>
        </header>

        <div className="flex gap-4 text-sm mb-4">
          <div>
            <p className="text-[11px] text-neutral-400">Score</p>
            <p className="font-semibold text-neutral-900">{liveScore}</p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Or</p>
            <p className="font-semibold text-neutral-900">{Math.round(career.stats.or)}</p>
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-neutral-400">Renommée</p>
            <p className="font-semibold text-neutral-900">{Math.round(career.stats.renommee)}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowProfile((v) => !v)}
            className="text-xs text-neutral-400 hover:text-neutral-700 self-end"
          >
            Profil
          </button>
        </div>

        <div className="flex gap-3 mb-3">
          <Gauge label="Forme" value={career.stats.forme} />
          <Gauge label="Moral" value={career.stats.moral} />
        </div>

        {showProfile && (
          <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-3 grid grid-cols-3 gap-2 text-center text-xs">
            {[
              ['Puissance', career.stats.puissance],
              ['Endurance', career.stats.endurance],
              ['Magie', career.stats.magie],
              ['Vitesse', career.stats.vitesse],
              ['Charisme', career.stats.charisme],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-neutral-400">{label}</p>
                <p className="font-semibold text-neutral-800">{Math.round(value)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="h-1 rounded-full bg-neutral-200 overflow-hidden mb-6">
          <div
            className="h-full bg-neutral-800 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 min-h-[260px] flex flex-col">
          {outcomeFlash ? (
            <>
              <p className="text-[11px] uppercase tracking-wider text-neutral-400">
                Saison {outcomeFlash.season}
              </p>
              <h3 className="text-lg font-semibold text-neutral-900 mt-1">{outcomeFlash.title}</h3>
              <p className="text-sm text-neutral-600 mt-3 leading-relaxed flex-1">
                {outcomeFlash.text}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {formatDelta(outcomeFlash.deltas).map((d) => (
                  <span
                    key={d}
                    className={`text-xs px-2 py-0.5 rounded ${
                      d.startsWith('+')
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
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
              <p className="text-[11px] uppercase tracking-wider text-neutral-400">Événement</p>
              <h3 className="text-lg font-semibold text-neutral-900 mt-1">{event.title}</h3>
              <p className="text-sm text-neutral-600 mt-3 leading-relaxed flex-1">{event.text}</p>
              <div className="mt-5 space-y-2">
                {event.options.map((opt, i) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => handleChoice(i)}
                    className="w-full text-left rounded-lg border border-neutral-200 px-4 py-3 text-sm text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 transition"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-400">Chargement…</p>
          )}
        </div>

        <div className="mt-8 text-center">
          <TextLink onClick={() => setScreen('home')}>Accueil</TextLink>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-center text-sm text-neutral-400 pt-20">Chargement…</p>
    </Shell>
  );
};

export default CaveDestiny;
