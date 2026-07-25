import React, { useCallback, useEffect, useState } from 'react';
import Header from './Header';
import {
  CAVE_DESTINY_AMBITIONS,
  CAVE_DESTINY_MENTORS,
  CAVE_DESTINY_WEAPONS,
  pickRandomGameCharacters,
  getRaceIcon,
  getClassIcon,
  getClassAbility,
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
import { getAllCharacters } from '../services/characterService';

const SETUP_STEPS = ['personnage', 'ambition', 'mentor', 'arme'];

function StepDots({ step }) {
  const idx = SETUP_STEPS.indexOf(step);
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      {SETUP_STEPS.map((s, i) => (
        <span
          key={s}
          className={`h-2.5 w-2.5 rounded-full border transition ${
            i < idx
              ? 'bg-amber-500 border-amber-400'
              : i === idx
                ? 'bg-amber-300 border-amber-200 scale-110'
                : 'bg-stone-800 border-stone-600'
          }`}
        />
      ))}
    </div>
  );
}

function Gauge({ label, value, color }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-stone-400 mb-1">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-stone-900/80 border border-stone-700 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div className="rounded-lg bg-stone-900/70 border border-stone-700 px-2 py-1.5 text-center">
      <div className="text-[10px] uppercase tracking-wider text-stone-500">{label}</div>
      <div className="text-sm font-bold text-amber-200">{Math.round(value)}</div>
    </div>
  );
}

function ChoiceCard({ title, subtitle, description, badge, onClick, accent = 'amber' }) {
  const accents = {
    amber: 'hover:border-amber-400/70 hover:bg-amber-950/40',
    emerald: 'hover:border-emerald-400/70 hover:bg-emerald-950/30',
    violet: 'hover:border-violet-400/70 hover:bg-violet-950/30',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border border-stone-600/80 bg-stone-950/60 p-4 transition shadow-lg ${accents[accent]} active:scale-[0.99]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-amber-100 leading-tight">{title}</h3>
          {subtitle && <p className="text-sm text-stone-300 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-md bg-stone-800 text-stone-200 border border-stone-600">
            {badge}
          </span>
        )}
      </div>
      {description && <p className="text-sm text-stone-400 mt-2 leading-relaxed">{description}</p>}
    </button>
  );
}

const CaveDestiny = () => {
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

  const reshuffleOffered = useCallback((pool) => {
    const source = pool || allGameCharacters;
    setOfferedCharacters(pickRandomGameCharacters(source, 3));
  }, [allGameCharacters]);

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
      setOfferedCharacters(pickRandomGameCharacters(active, 3));
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
  }, []);

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

  /* ---------- HOME ---------- */
  if (screen === 'home') {
    const canResume = career?.phase === 'playing';
    return (
      <div className="min-h-screen text-white relative overflow-hidden">
        <Header />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(180,83,9,0.25),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(28,25,23,0.95),_#0c0a09)]" />
        <div className="absolute inset-0 opacity-[0.07] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><path d=%22M0 39h40M39 0v40%22 stroke=%22%23fbbf24%22 stroke-width=%220.4%22/></svg>')]" />

        <div className="relative z-10 max-w-lg mx-auto px-4 pt-20 pb-16 flex flex-col items-center text-center min-h-screen">
          <p className="text-amber-500/90 text-xs font-bold uppercase tracking-[0.35em] mb-3 animate-[fadeIn_0.6s_ease]">
            Duels de Cave
          </p>
          <h1 className="font-[Cinzel,serif] text-5xl sm:text-6xl font-bold text-amber-100 drop-shadow-[0_4px_24px_rgba(245,158,11,0.35)] leading-none animate-[fadeIn_0.8s_ease]">
            Cave Destiny
          </h1>
          <p className="mt-5 text-stone-300 text-sm sm:text-base leading-relaxed max-w-md animate-[fadeIn_1s_ease]">
            Incarnez un vrai personnage de Duels de Cave et écrivez sa carrière saison après saison.
            <br />
            Chaque choix compte. Personne ne connaît son destin dans la Cave.
          </p>

          <div className="mt-8 w-full flex flex-col gap-3 items-center animate-[fadeIn_1.1s_ease]">
            {canResume && (
              <button
                type="button"
                onClick={resume}
                className="w-full max-w-sm py-3.5 rounded-xl border-2 border-amber-300/90 bg-amber-600/20 text-amber-50 font-bold tracking-wide hover:bg-amber-500/30 transition"
              >
                Reprendre — Saison {career.season}/{career.maxSeasons}
              </button>
            )}
            <button
              type="button"
              onClick={startFresh}
              className="w-full max-w-sm py-3.5 rounded-xl border-2 border-white/90 bg-white/5 text-white font-bold tracking-wide hover:bg-white/10 transition"
            >
              Commencer ma carrière
            </button>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setScreen('pantheon')}
              className="text-sm text-amber-200/90 hover:text-amber-100 underline-offset-4 hover:underline"
            >
              Panthéon
            </button>
          </div>

          {pantheon[0] && (
            <p className="mt-8 text-xs text-stone-500">
              Dernière légende : {pantheon[0].name} — {pantheon[0].tierLabel}
            </p>
          )}
        </div>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: none; }
          }
        `}</style>
      </div>
    );
  }

  /* ---------- PANTHEON ---------- */
  if (screen === 'pantheon') {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-20 pb-12">
          <h2 className="font-[Cinzel,serif] text-3xl text-amber-200 text-center uppercase tracking-wide">
            Panthéon
          </h2>
          <p className="text-center text-stone-400 text-sm mt-2 mb-6">
            Les légendes que vous avez écrites.
          </p>
          <div className="space-y-3">
            {pantheon.length === 0 && (
              <p className="text-center text-stone-500 py-10">Aucune carrière terminée pour l’instant.</p>
            )}
            {pantheon.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-stone-700 bg-stone-950/70 p-4"
              >
                <div className="flex justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    {entry.characterImage ? (
                      <img
                        src={entry.characterImage}
                        alt={entry.name}
                        className="w-12 h-12 rounded-lg object-cover border border-stone-600 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-stone-600 bg-stone-900 flex items-center justify-center text-xl shrink-0">
                        {getRaceIcon(entry.race)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-amber-100 truncate">{entry.name}</p>
                      <p className="text-xs text-stone-400">
                        {getRaceIcon(entry.race)} {entry.race} · {getClassIcon(entry.class)} {entry.class}
                      </p>
                      {entry.ownerPseudo && (
                        <p className="text-[11px] text-stone-500">Joueur : {entry.ownerPseudo}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-amber-300 font-bold">{entry.score}</p>
                    <p className="text-[11px] text-stone-400">{entry.tierLabel}</p>
                  </div>
                </div>
                <p className="text-xs text-stone-500 mt-2">{entry.ambition}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setScreen('home')}
            className="mt-8 w-full py-3 rounded-xl border border-stone-500 text-stone-200 hover:bg-stone-800 transition"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  /* ---------- SETUP: PERSONNAGE ---------- */
  if (screen === 'personnage') {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-20 pb-12">
          <button type="button" onClick={backSetup} className="text-sm text-stone-400 hover:text-amber-200 mb-2">
            ← Retour
          </button>
          <StepDots step="personnage" />
          <h2 className="font-[Cinzel,serif] text-2xl sm:text-3xl text-amber-100 text-center uppercase tracking-wide">
            Votre personnage
          </h2>
          <p className="text-center text-stone-400 text-sm mt-2 mb-4">
            Trois personnages tirés au hasard parmi ceux qui existent déjà dans Duels de Cave.
            Lequel allez-vous incarner ?
          </p>

          <div className="flex justify-center mb-5">
            <button
              type="button"
              onClick={() => reshuffleOffered()}
              disabled={charsLoading || allGameCharacters.length < 2}
              className="text-sm px-3 py-1.5 rounded-lg border border-stone-600 text-amber-200 hover:border-amber-500/60 hover:bg-amber-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Relancer les 3 choix
            </button>
          </div>

          {charsLoading && (
            <p className="text-center text-stone-400 py-10">Chargement des personnages de la Cave…</p>
          )}

          {!charsLoading && charsError && offeredCharacters.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <p className="text-red-300 text-sm">{charsError}</p>
              <button
                type="button"
                onClick={loadGameCharacters}
                className="px-4 py-2 rounded-lg border border-amber-600/60 text-amber-200 hover:bg-amber-950/40"
              >
                Réessayer
              </button>
            </div>
          )}

          <div className="space-y-3">
            {offeredCharacters.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCharacter(c)}
                className="w-full text-left rounded-2xl border border-stone-600 bg-gradient-to-br from-stone-900/90 to-stone-950/90 p-4 hover:border-amber-400/80 hover:shadow-[0_0_30px_rgba(245,158,11,0.12)] transition"
              >
                <div className="flex items-start gap-3">
                  {c.characterImage ? (
                    <img
                      src={c.characterImage}
                      alt={c.name}
                      className="w-16 h-16 rounded-xl object-cover border border-stone-600 shrink-0 bg-stone-900"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-stone-600 bg-stone-900 flex items-center justify-center text-3xl shrink-0">
                      {getRaceIcon(c.race)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-amber-50">{c.name}</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700/50 text-amber-200">
                        {c.tagline}
                      </span>
                    </div>
                    <p className="text-sm text-stone-300 mt-1">
                      {getRaceIcon(c.race)} {c.race} · {getClassIcon(c.class)} {c.class}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">{getClassAbility(c.class)}</p>
                    <p className="text-sm text-stone-400 mt-2 leading-relaxed">{c.blurb}</p>
                    <p className="text-xs text-stone-500 mt-1 italic">{c.trait}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {!charsLoading && offeredCharacters.length > 0 && offeredCharacters.length < 3 && (
            <p className="text-center text-xs text-stone-500 mt-4">
              Seulement {offeredCharacters.length} personnage(s) disponible(s) pour le moment.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ---------- SETUP: AMBITION ---------- */
  if (screen === 'ambition') {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-20 pb-12">
          <button type="button" onClick={backSetup} className="text-sm text-stone-400 hover:text-amber-200 mb-2">
            ← Retour
          </button>
          <StepDots step="ambition" />
          <h2 className="font-[Cinzel,serif] text-2xl sm:text-3xl text-amber-100 text-center uppercase tracking-wide">
            Votre ambition
          </h2>
          <p className="text-center text-stone-400 text-sm mt-2 mb-6">
            Elle orientera vos événements… et votre légende.
          </p>
          <div className="space-y-3">
            {CAVE_DESTINY_AMBITIONS.map((a) => (
              <ChoiceCard
                key={a.id}
                title={`${a.icon} ${a.name}`}
                description={a.desc}
                onClick={() => selectAmbition(a.id)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- SETUP: MENTOR ---------- */
  if (screen === 'mentor') {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-20 pb-12">
          <button type="button" onClick={backSetup} className="text-sm text-stone-400 hover:text-amber-200 mb-2">
            ← Retour
          </button>
          <StepDots step="mentor" />
          <h2 className="font-[Cinzel,serif] text-2xl sm:text-3xl text-amber-100 text-center uppercase tracking-wide">
            Votre mentor
          </h2>
          <p className="text-center text-stone-400 text-sm mt-2 mb-6">
            Qui guide vos premiers pas avant la gloire ?
          </p>
          <div className="space-y-3">
            {CAVE_DESTINY_MENTORS.map((m) => (
              <ChoiceCard
                key={m.id}
                title={`${m.icon} ${m.name}`}
                description={m.desc}
                onClick={() => selectMentor(m.id)}
                accent="emerald"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- SETUP: ARME ---------- */
  if (screen === 'arme') {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-20 pb-12">
          <button type="button" onClick={backSetup} className="text-sm text-stone-400 hover:text-amber-200 mb-2">
            ← Retour
          </button>
          <StepDots step="arme" />
          <h2 className="font-[Cinzel,serif] text-2xl sm:text-3xl text-amber-100 text-center uppercase tracking-wide">
            Votre voie d’arme
          </h2>
          <p className="text-center text-stone-400 text-sm mt-2 mb-6">
            Les recruteurs de la Cave ont observé votre profil.
          </p>
          <div className="space-y-3">
            {CAVE_DESTINY_WEAPONS.map((w) => (
              <ChoiceCard
                key={w.id}
                title={`${w.icon} ${w.name}`}
                subtitle={`Rêve d’arme : ${w.weaponHint}`}
                description={w.desc}
                onClick={() => selectWeapon(w.id)}
                accent="violet"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- FINAL ---------- */
  if (screen === 'final' && career) {
    const { score, tier, story } = buildFinalStory(career);
    const trophyEntries = Object.entries(career.trophies || {}).filter(([, v]) => v > 0);
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-20 pb-16">
          <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/60 bg-gradient-to-b from-stone-900 to-stone-950 p-5 shadow-[0_0_40px_rgba(245,158,11,0.15)]">
            <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_20%_0%,_rgba(251,191,36,0.35),_transparent_45%)]" />
            <div className="relative">
              <div className="flex gap-4 items-start">
                {career.character.characterImage ? (
                  <img
                    src={career.character.characterImage}
                    alt={career.character.name}
                    className="w-20 h-20 rounded-xl object-cover border border-amber-700/50 shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl border border-amber-700/50 bg-stone-900 flex items-center justify-center text-4xl shrink-0">
                    {getRaceIcon(career.character.race)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-sm text-stone-400 gap-2">
                    <span>
                      {getRaceIcon(career.character.race)} {career.character.race}
                    </span>
                    <span>{career.maxSeasons} saisons</span>
                  </div>
                  <p className={`mt-2 text-xs font-bold uppercase tracking-[0.2em] ${tier.color}`}>
                    {tier.label}
                  </p>
                  <h2 className="font-[Cinzel,serif] text-3xl text-amber-50 mt-1 leading-tight">
                    {career.character.name}
                  </h2>
                  {career.character.ownerPseudo && (
                    <p className="text-xs text-stone-500">Joueur : {career.character.ownerPseudo}</p>
                  )}
                  <p className="text-stone-400 text-sm">
                    {getClassIcon(career.character.class)} {career.character.class} · {career.ambition.name}
                  </p>
                  <p className="text-amber-300/90 text-sm mt-1">{career.weapon.name}</p>
                </div>
              </div>

              <div className="mt-4 flex items-end gap-3">
                <span className="text-5xl font-black text-amber-300 leading-none">{score}</span>
                <span className="text-stone-500 text-sm pb-1">score de légende</span>
              </div>

              <p className="mt-4 text-sm text-stone-300 leading-relaxed">{story}</p>

              <p className="mt-5 text-[11px] uppercase tracking-wider text-stone-500">Statistiques finales</p>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  ['Puissance', career.stats.puissance],
                  ['Endurance', career.stats.endurance],
                  ['Magie', career.stats.magie],
                  ['Vitesse', career.stats.vitesse],
                  ['Charisme', career.stats.charisme],
                  ['Renommée', career.stats.renommee],
                ].map(([label, value]) => (
                  <StatChip key={label} label={label} value={value} />
                ))}
              </div>

              <p className="mt-5 text-[11px] uppercase tracking-wider text-stone-500">Palmarès</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {trophyEntries.length === 0 && (
                  <span className="text-sm text-stone-500">Aucun trophée majeur.</span>
                )}
                {trophyEntries.map(([k, v]) => (
                  <span
                    key={k}
                    className="text-xs px-2 py-1 rounded-md bg-amber-950/50 border border-amber-700/40 text-amber-100"
                  >
                    {k} ×{v}
                  </span>
                ))}
              </div>

              <p className="mt-5 text-[11px] uppercase tracking-wider text-stone-500">Parcours</p>
              <p className="text-sm text-stone-400 mt-1">
                Mentor : {career.mentor.name} · Ambition : {career.ambition.name}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={startFresh}
              className="w-full py-3.5 rounded-xl border-2 border-white/80 bg-white/5 font-bold hover:bg-white/10 transition"
            >
              Nouvelle carrière
            </button>
            <button
              type="button"
              onClick={() => {
                clearSave();
                setCareer(null);
                setScreen('home');
              }}
              className="w-full py-3 rounded-xl border border-stone-500 text-stone-200 hover:bg-stone-800 transition"
            >
              Retour à l’accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- GAME ---------- */
  if (screen === 'game' && career) {
    const event = career.currentEvent;
    const progress = ((career.season - 1) / career.maxSeasons) * 100;
    const liveScore = computeScore(career);
    const liveTier = getTier(liveScore);

    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="max-w-lg mx-auto px-4 pt-16 pb-12">
          <header className="rounded-xl border border-stone-700/80 bg-stone-950/80 px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {career.character.characterImage ? (
                <img
                  src={career.character.characterImage}
                  alt=""
                  className="w-9 h-9 rounded-lg object-cover border border-stone-600 shrink-0"
                />
              ) : (
                <span className="text-xl shrink-0">{getRaceIcon(career.character.race)}</span>
              )}
              <div className="min-w-0">
                <p className="font-bold text-amber-100 truncate text-sm sm:text-base">
                  {career.character.name}
                </p>
                <p className="text-[11px] text-stone-500 truncate">
                  {career.ambition.icon} {career.ambition.name}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-stone-200">
                Saison {career.season}/{career.maxSeasons}
              </p>
              <p className={`text-[11px] ${liveTier.color}`}>{liveTier.label}</p>
            </div>
          </header>

          <div className="mt-3 flex gap-3">
            <div className="rounded-lg border border-stone-700 bg-stone-900/70 px-2.5 py-1.5 text-center">
              <div className="text-[10px] text-stone-500 uppercase">Score</div>
              <div className="font-bold text-amber-300">{liveScore}</div>
            </div>
            <div className="rounded-lg border border-stone-700 bg-stone-900/70 px-2.5 py-1.5 text-center">
              <div className="text-[10px] text-stone-500 uppercase">Or</div>
              <div className="font-bold text-yellow-200">{Math.round(career.stats.or)}</div>
            </div>
            <div className="rounded-lg border border-stone-700 bg-stone-900/70 px-2.5 py-1.5 text-center flex-1">
              <div className="text-[10px] text-stone-500 uppercase">Renommée</div>
              <div className="font-bold text-amber-100">{Math.round(career.stats.renommee)}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowProfile((v) => !v)}
              className="rounded-lg border border-stone-600 bg-stone-800/80 px-3 text-sm hover:border-amber-500/50"
              title="Profil"
            >
              Profil
            </button>
          </div>

          <div className="mt-3 flex gap-3">
            <Gauge label="Forme" value={career.stats.forme} color="bg-emerald-500" />
            <Gauge label="Moral" value={career.stats.moral} color="bg-sky-500" />
          </div>

          {showProfile && (
            <div className="mt-3 rounded-xl border border-stone-700 bg-stone-950/90 p-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Puissance', career.stats.puissance],
                  ['Endurance', career.stats.endurance],
                  ['Magie', career.stats.magie],
                  ['Vitesse', career.stats.vitesse],
                  ['Charisme', career.stats.charisme],
                ].map(([label, value]) => (
                  <StatChip key={label} label={label} value={value} />
                ))}
              </div>
              <p className="text-xs text-stone-500 mt-2">
                {career.weapon.icon} {career.weapon.name} · Mentor : {career.mentor.name}
              </p>
            </div>
          )}

          <div className="mt-4 h-1.5 rounded-full bg-stone-900 border border-stone-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-700 to-amber-400 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-stone-600/90 bg-gradient-to-b from-stone-900/95 to-stone-950 p-5 min-h-[280px] flex flex-col shadow-xl">
            {outcomeFlash ? (
              <>
                <p className="text-xs uppercase tracking-wider text-amber-500/90 font-bold">
                  Saison {outcomeFlash.season} — Résultat
                </p>
                <h3 className="text-xl font-bold text-amber-50 mt-1">{outcomeFlash.title}</h3>
                <p className="text-stone-300 mt-3 leading-relaxed flex-1">{outcomeFlash.text}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {formatDelta(outcomeFlash.deltas).map((d) => (
                    <span
                      key={d}
                      className={`text-xs px-2 py-1 rounded-md border ${
                        d.startsWith('+')
                          ? 'border-emerald-700/50 bg-emerald-950/40 text-emerald-300'
                          : 'border-red-800/50 bg-red-950/40 text-red-300'
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={continueAfterOutcome}
                  className="mt-5 w-full py-3 rounded-xl border-2 border-amber-400/80 bg-amber-600/20 font-bold hover:bg-amber-500/30 transition"
                >
                  Continuer
                </button>
              </>
            ) : event ? (
              <>
                <p className="text-xs uppercase tracking-wider text-amber-500/90 font-bold">
                  Événement
                </p>
                <h3 className="text-xl font-bold text-amber-50 mt-1">{event.title}</h3>
                <p className="text-stone-300 mt-3 leading-relaxed flex-1">{event.text}</p>
                <div className="mt-5 space-y-2.5">
                  {event.options.map((opt, i) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => handleChoice(i)}
                      className="w-full text-left rounded-xl border border-stone-500/80 bg-stone-950/50 px-4 py-3 text-sm text-stone-100 hover:border-amber-400/70 hover:bg-amber-950/30 transition"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-stone-400">Chargement de la saison…</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setScreen('home')}
            className="mt-6 w-full py-2.5 text-sm text-stone-400 hover:text-amber-200 transition"
          >
            ← Accueil (progression sauvegardée)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex items-center justify-center">
      <Header />
      <p className="text-stone-400 pt-20">Chargement de Cave Destiny…</p>
    </div>
  );
};

export default CaveDestiny;
