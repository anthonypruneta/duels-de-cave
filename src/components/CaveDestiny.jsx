import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAVE_DESTINY_AMBITIONS,
  pickRandomGameCharacters,
  pickRandomMentors,
  pickRandomCommonWeapons,
  CAVE_DESTINY_MENTOR_OFFER_COUNT,
  CAVE_DESTINY_WEAPON_OFFER_COUNT,
  LAST_OFFERED_STORAGE_KEY,
  LAST_OFFERED_HISTORY_LIMIT,
  getRaceIcon,
  getClassIcon,
  WEAPON_RARITY_LABEL,
} from '../data/caveDestiny';
import {
  createCareer,
  ensureCurrentEvent,
  resolveChoice,
  loadSave,
  persistSave,
  clearSave,
  pushToPantheon,
  buildFinalStory,
  formatDelta,
  computeScore,
  getTier,
} from '../utils/caveDestinyEngine';
import { getRarityMeta } from '../data/caveDestinyRarity';
import { loadCaveDestinyCharacterPool } from '../services/caveDestinyCharacters';
import {
  saveCaveDestinyFinishedRun,
  loadMyCaveDestinyRuns,
  loadCaveDestinyPantheon,
  migrateLocalCaveDestinyPantheon,
} from '../services/caveDestinyRunsService';
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
      <div className="relative z-10 mx-auto max-w-xl px-4 pt-10 pb-16">{children}</div>
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

/** Portrait format carte TCG (ratio ~5:7) */
function CharacterPortrait({ src, alt, className = '', size = 'md' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const sizeClass =
    size === 'sm'
      ? 'w-12 cave-destiny-tcg'
      : size === 'lg'
        ? 'w-36 sm:w-40 cave-destiny-tcg'
        : size === 'xl'
          ? 'w-full max-w-[11rem] cave-destiny-tcg'
          : 'w-20 sm:w-24 cave-destiny-tcg';

  if (!src || failed) {
    return (
      <div
        className={`${sizeClass} ${className} bg-stone-800 border border-amber-800/40 rounded-md flex items-center justify-center text-stone-500 text-xs shadow-inner`}
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
      className={`${sizeClass} ${className} object-cover object-top bg-stone-900 border border-amber-700/50 rounded-md shadow-[0_4px_14px_rgba(0,0,0,0.45)]`}
      onError={() => setFailed(true)}
    />
  );
}

function RaceClassLine({ race, classe, subclass, className = '', centered = false }) {
  if (!race && !classe) return null;
  return (
    <p
      className={`text-xs text-amber-200/90 ${centered ? 'text-center' : ''} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        <span aria-hidden="true">{getRaceIcon(race)}</span>
        <span>{race || '—'}</span>
      </span>
      <span className="text-stone-600 mx-1.5">·</span>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden="true">{getClassIcon(classe)}</span>
        <span>{classe || '—'}</span>
      </span>
      {subclass?.name ? (
        <>
          <span className="text-stone-600 mx-1.5">·</span>
          <span className="text-violet-300">{subclass.name}</span>
        </>
      ) : null}
    </p>
  );
}

function RpgStatsBar({ stats, weapon, compact = false }) {
  if (!stats) return null;
  const rows = [
    ['PUJ', 'Puissance', stats.puissance],
    ['END', 'Endurance', stats.endurance],
    ['MAG', 'Magie', stats.magie],
    ['VIT', 'Vitesse', stats.vitesse],
    ['CHA', 'Charisme', stats.charisme],
  ];
  return (
    <div
      className={`rounded-xl border border-stone-700 bg-stone-950/85 ${
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
      }`}
    >
      <div className="grid grid-cols-5 gap-1 text-center">
        {rows.map(([short, label, value]) => (
          <div key={short} title={label}>
            <p className="text-[10px] uppercase tracking-wide text-stone-500">{short}</p>
            <p className="text-sm font-bold text-amber-100 tabular-nums">{Math.round(value || 0)}</p>
          </div>
        ))}
      </div>
      {weapon?.name ? (
        <p className="mt-2 text-center text-[11px] text-stone-400 truncate">
          Arme :{' '}
          <span className="text-amber-200/90">
            {weapon.icon ? `${weapon.icon} ` : ''}
            {weapon.name}
          </span>
          {weapon.rarity ? (
            <span className="text-stone-500">
              {' '}
              · {WEAPON_RARITY_LABEL[weapon.rarity] || weapon.rarity}
            </span>
          ) : null}
        </p>
      ) : (
        <p className="mt-2 text-center text-[11px] text-stone-600">Arme : —</p>
      )}
    </div>
  );
}

function CharacterIdentity({ character, compact = false }) {
  if (!character) return null;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-stone-700 bg-stone-950/80 ${
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
      }`}
    >
      <CharacterPortrait
        src={character.characterImage}
        alt={character.name}
        size={compact ? 'sm' : 'md'}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-amber-50 truncate ${compact ? 'text-sm' : 'font-[Cinzel,serif] text-base'}`}>
          {character.name}
        </p>
        <RaceClassLine
          race={character.race}
          classe={character.class}
          subclass={character.subclass}
          className="mt-0.5"
        />
        <p className="text-[11px] italic text-stone-500 truncate mt-0.5">
          Créateur : {character.ownerPseudo || 'Inconnu'}
        </p>
      </div>
    </div>
  );
}

function RarityBadge({ rarity }) {
  const meta = getRarityMeta(rarity);
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function formatRunDate(date) {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function RunEntryCard({ entry, rank = null, showPlayer = false }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-700 bg-stone-950/70 p-3">
      {rank != null && (
        <span
          className={`shrink-0 w-8 text-center text-sm font-bold tabular-nums ${
            rank === 1
              ? 'text-amber-300'
              : rank === 2
                ? 'text-stone-300'
                : rank === 3
                  ? 'text-amber-700'
                  : 'text-stone-500'
          }`}
        >
          #{rank}
        </span>
      )}
      <CharacterPortrait
        src={entry.characterImage}
        alt={entry.name}
        size="sm"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-amber-50 truncate">{entry.name}</p>
        <RaceClassLine
          race={entry.race}
          classe={entry.class}
          subclass={
            entry.subclass
              ? typeof entry.subclass === 'string'
                ? { name: entry.subclass }
                : entry.subclass
              : null
          }
          className="mt-0.5"
        />
        {showPlayer && (
          <p className="text-[11px] text-amber-200/80 mt-0.5 truncate">
            Joueur : {entry.userPseudo || 'Anonyme'}
          </p>
        )}
        <p className="text-[11px] italic text-stone-500 mt-0.5 truncate">
          Créateur : {entry.ownerPseudo || 'Inconnu'}
          {entry.ambition ? ` · ${entry.ambition}` : ''}
        </p>
        <p className="text-xs text-stone-500 mt-0.5">
          {entry.tierLabel || '—'}
          {formatRunDate(entry.date) ? ` · ${formatRunDate(entry.date)}` : ''}
        </p>
      </div>
      <p className="text-sm font-bold text-amber-300 shrink-0 tabular-nums">{entry.score}</p>
    </div>
  );
}

const CaveDestiny = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [screen, setScreen] = useState('home');
  const [setup, setSetup] = useState({
    character: null,
    ambitionId: null,
    mentorId: null,
    weaponId: null,
  });
  const [career, setCareer] = useState(null);
  const [myRuns, setMyRuns] = useState([]);
  const [pantheon, setPantheon] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState(null);
  const [outcomeFlash, setOutcomeFlash] = useState(null);
  const [allGameCharacters, setAllGameCharacters] = useState([]);
  const [offeredCharacters, setOfferedCharacters] = useState([]);
  const [offeredMentors, setOfferedMentors] = useState([]);
  const [offeredWeapons, setOfferedWeapons] = useState([]);
  const [charsLoading, setCharsLoading] = useState(false);
  const [charsError, setCharsError] = useState(null);
  const [drawNonce, setDrawNonce] = useState(0);
  const [mentorDrawNonce, setMentorDrawNonce] = useState(0);
  const [weaponDrawNonce, setWeaponDrawNonce] = useState(0);
  const poolRef = useRef([]);
  const savingRunRef = useRef(false);

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
    const saved = loadSave();
    if (saved?.phase === 'playing') {
      setCareer(ensureCurrentEvent(saved));
    }
  }, []);

  useEffect(() => {
    if (career) persistSave(career);
  }, [career]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    migrateLocalCaveDestinyPantheon(currentUser.uid).catch(() => {});
  }, [currentUser?.uid]);

  useEffect(() => {
    if (screen !== 'mesRuns' && screen !== 'pantheon') return;
    let cancelled = false;

    const load = async () => {
      setRunsLoading(true);
      setRunsError(null);
      try {
        if (screen === 'mesRuns') {
          if (!currentUser?.uid) {
            if (!cancelled) {
              setMyRuns([]);
              setRunsError('Connexion requise.');
            }
            return;
          }
          await migrateLocalCaveDestinyPantheon(currentUser.uid);
          const res = await loadMyCaveDestinyRuns(currentUser.uid);
          if (cancelled) return;
          if (!res.success) setRunsError(res.error || 'Chargement impossible.');
          setMyRuns(res.runs || []);
        } else {
          const res = await loadCaveDestinyPantheon();
          if (cancelled) return;
          if (!res.success) setRunsError(res.error || 'Chargement impossible.');
          setPantheon(res.runs || []);
        }
      } catch (e) {
        if (!cancelled) setRunsError(e?.message || 'Chargement impossible.');
      } finally {
        if (!cancelled) setRunsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [screen, currentUser?.uid]);

  // Nouveau tirage à chaque visite de l’écran (drawNonce incrémenté à l’entrée)
  useEffect(() => {
    if (screen !== 'personnage') return;
    drawFreshOffer();
  }, [screen, drawNonce, drawFreshOffer]);

  useEffect(() => {
    if (screen !== 'mentor') return;
    setOfferedMentors(pickRandomMentors(CAVE_DESTINY_MENTOR_OFFER_COUNT));
  }, [screen, mentorDrawNonce]);

  useEffect(() => {
    if (screen !== 'arme') return;
    setOfferedWeapons(pickRandomCommonWeapons(CAVE_DESTINY_WEAPON_OFFER_COUNT));
  }, [screen, weaponDrawNonce]);

  const startFresh = () => {
    setSetup({ character: null, ambitionId: null, mentorId: null, weaponId: null });
    setCareer(null);
    clearSave();
    setOutcomeFlash(null);
    setDrawNonce((n) => n + 1);
    setMentorDrawNonce((n) => n + 1);
    setWeaponDrawNonce((n) => n + 1);
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
    setMentorDrawNonce((n) => n + 1);
    setScreen('mentor');
  };

  const selectMentor = (id) => {
    setSetup((s) => ({ ...s, mentorId: id }));
    setWeaponDrawNonce((n) => n + 1);
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
      const uid = currentUser?.uid || null;
      pushToPantheon(next, { userId: uid });
      if (uid && !savingRunRef.current) {
        savingRunRef.current = true;
        saveCaveDestinyFinishedRun({ userId: uid, career: next })
          .then((res) => {
            if (res.success && res.entry) {
              setMyRuns((prev) => {
                const without = prev.filter((r) => r.id !== res.entry.id);
                return [res.entry, ...without].sort(
                  (a, b) => (b.score || 0) - (a.score || 0) || (b.date || 0) - (a.date || 0)
                );
              });
              setPantheon((prev) => {
                const without = prev.filter((r) => r.id !== res.entry.id);
                return [res.entry, ...without].sort(
                  (a, b) => (b.score || 0) - (a.score || 0) || (b.date || 0) - (a.date || 0)
                );
              });
            } else if (!res.success) {
              console.error('Sauvegarde run Cave Destiny:', res.error);
            }
          })
          .finally(() => {
            savingRunRef.current = false;
          });
      }
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
            Incarnez un perso de Duels de Cave et survivez à la saison — donjons, tournoi, forge… en vrai cave.
          </p>

          <div className="mt-10 w-full space-y-3 max-w-sm">
            {canResume && (
              <PrimaryButton onClick={resume}>
                Reprendre — saison {career.season}/{career.maxSeasons}
              </PrimaryButton>
            )}
            <PrimaryButton onClick={startFresh}>Commencer une carrière</PrimaryButton>
            <GhostButton onClick={() => setScreen('mesRuns')}>Mes runs</GhostButton>
            <GhostButton onClick={() => setScreen('pantheon')}>Panthéon</GhostButton>
          </div>

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

  /* ---------- MES RUNS ---------- */
  if (screen === 'mesRuns') {
    return (
      <Shell>
        <BackLink onClick={() => setScreen('home')} />
        <ScreenTitle
          title="Mes runs"
          sub="Vos carrières terminées, du meilleur score au plus faible."
        />
        <div className="space-y-2">
          {runsLoading && (
            <p className="text-center text-sm text-stone-500 py-12">Chargement…</p>
          )}
          {!runsLoading && runsError && (
            <p className="text-center text-sm text-red-400/90 py-8">{runsError}</p>
          )}
          {!runsLoading && !runsError && myRuns.length === 0 && (
            <p className="text-center text-sm text-stone-500 py-12">
              Aucune carrière enregistrée pour l’instant.
            </p>
          )}
          {!runsLoading &&
            myRuns.map((entry, i) => (
              <RunEntryCard key={entry.id} entry={entry} rank={i + 1} />
            ))}
        </div>
      </Shell>
    );
  }

  /* ---------- PANTHEON ---------- */
  if (screen === 'pantheon') {
    return (
      <Shell>
        <BackLink onClick={() => setScreen('home')} />
        <ScreenTitle
          title="Panthéon"
          sub="Toutes les carrières des joueurs, du meilleur score au plus nul."
        />
        <div className="space-y-2">
          {runsLoading && (
            <p className="text-center text-sm text-stone-500 py-12">Chargement…</p>
          )}
          {!runsLoading && runsError && (
            <p className="text-center text-sm text-red-400/90 py-8">{runsError}</p>
          )}
          {!runsLoading && !runsError && pantheon.length === 0 && (
            <p className="text-center text-sm text-stone-500 py-12">
              Le Panthéon est encore vide. Terminez une carrière pour y entrer.
            </p>
          )}
          {!runsLoading &&
            pantheon.map((entry, i) => (
              <RunEntryCard key={entry.id} entry={entry} rank={i + 1} showPlayer />
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
          sub="Trois persos réels tirés du roster. Choisissez votre destin, cave."
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

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {!charsLoading && offeredCharacters.map((c) => (
            <button
              key={`${c.id}-${c.name}`}
              type="button"
              onClick={() => selectCharacter(c)}
              className="cave-destiny-tcg-card group text-left rounded-xl border border-stone-600 bg-stone-950/85 p-2 sm:p-2.5 hover:border-amber-500/70 hover:bg-amber-950/25 transition flex flex-col items-center"
            >
              <CharacterPortrait
                src={c.characterImage}
                alt={c.name}
                size="xl"
                className="shrink-0"
              />
              <h3 className="mt-2 w-full text-center text-sm sm:text-base font-bold text-amber-50 leading-tight font-[Cinzel,serif] truncate">
                {c.name}
              </h3>
              <RaceClassLine
                race={c.race}
                classe={c.class}
                subclass={c.subclass}
                centered
                className="mt-1"
              />
              <p className="mt-1 w-full text-center text-[10px] sm:text-xs italic text-stone-500 truncate">
                {c.ownerPseudo || 'Inconnu'}
              </p>
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
        {setup.character && (
          <div className="mb-4">
            <CharacterIdentity character={setup.character} compact />
          </div>
        )}
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
        {setup.character && (
          <div className="mb-4">
            <CharacterIdentity character={setup.character} compact />
          </div>
        )}
        <ScreenTitle
          title="Votre mentor"
          sub={`${CAVE_DESTINY_MENTOR_OFFER_COUNT} guides tirés au hasard. Qui vous accompagne ?`}
        />
        <div className="space-y-2">
          {offeredMentors.map((m) => (
            <ChoiceRow
              key={m.id}
              title={`${m.icon || ''} ${m.name}`.trim()}
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
        {setup.character && (
          <div className="mb-4">
            <CharacterIdentity character={setup.character} compact />
          </div>
        )}
        <ScreenTitle
          title="Votre arme"
          sub="4 armes communes tirées du roster. Les events pourront l’upgrader… ou, rarement, révéler sa légendaire."
        />
        <div className="space-y-2">
          {offeredWeapons.map((w) => (
            <ChoiceRow
              key={w.id}
              title={`${w.icon || ''} ${w.name}`.trim()}
              description={`${w.description} → rare : ${w.path?.rareName || '—'} · légendaire : ${w.path?.legendaireName || '—'}`}
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
              size="lg"
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className={`text-xs uppercase tracking-wider font-bold ${tier.color}`}>
                {tier.label}
              </p>
              <h2 className="font-[Cinzel,serif] text-2xl font-bold text-amber-50 mt-0.5">
                {career.character.name}
              </h2>
              <RaceClassLine
                race={career.character.race}
                classe={career.character.class}
                subclass={career.subclass || career.character.subclass}
                className="mt-1.5"
              />
              <p className="text-sm italic text-stone-500 mt-1">
                Créateur : {career.character.ownerPseudo || 'Inconnu'}
              </p>
              {career.weapon?.name && (
                <p className="text-sm text-amber-200/80 mt-1">
                  Arme : {career.weapon.icon} {career.weapon.name}
                  {career.weapon.rarity
                    ? ` · ${WEAPON_RARITY_LABEL[career.weapon.rarity] || career.weapon.rarity}`
                    : ''}
                </p>
              )}
              <p className="text-sm text-stone-400 mt-2">{career.ambition.name}</p>
            </div>
          </div>

          <div className="mt-4">
            <RpgStatsBar stats={career.stats} weapon={career.weapon} />
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
            size="sm"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-50 truncate">{career.character.name}</p>
            <RaceClassLine
              race={career.character.race}
              classe={career.character.class}
              subclass={career.subclass || career.character.subclass}
              className="mt-0.5"
            />
            <p className="text-[11px] italic text-stone-500 truncate mt-0.5">
              Créateur : {career.character.ownerPseudo || 'Inconnu'}
              {career.mentor?.name ? ` · Mentor : ${career.mentor.name}` : ''}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-stone-200">
              {career.season}/{career.maxSeasons}
            </p>
            <p className={`text-[11px] ${liveTier.color}`}>{liveTier.label}</p>
          </div>
        </header>

        <div className="mb-3">
          <RpgStatsBar stats={career.stats} weapon={career.weapon} />
        </div>

        <div className="flex gap-4 text-sm mb-3">
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
          {(career.subclass || career.character.subclass) && (
            <div className="text-right">
              <p className="text-[11px] text-stone-500">Sous-classe</p>
              <p className="text-xs font-semibold text-violet-300 truncate max-w-[7rem]">
                {(career.subclass || career.character.subclass)?.name}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mb-3">
          <Gauge label="Forme" value={career.stats.forme} colorClass="bg-emerald-500" />
          <Gauge label="Moral" value={career.stats.moral} colorClass="bg-sky-500" />
        </div>

        <div className="h-1 rounded-full bg-stone-900 border border-stone-700 overflow-hidden mb-6">
          <div
            className="h-full bg-gradient-to-r from-amber-700 to-amber-400 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="rounded-2xl border border-stone-600 bg-stone-950/85 p-5 min-h-[260px] flex flex-col">
            {outcomeFlash ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-wider text-amber-500/90 font-bold">
                    Saison {outcomeFlash.season}
                  </p>
                  {outcomeFlash.variant && (
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${
                        outcomeFlash.variant === 'bonus'
                          ? 'border-emerald-600/50 bg-emerald-950/50 text-emerald-300'
                          : outcomeFlash.variant === 'malus'
                            ? 'border-red-700/50 bg-red-950/50 text-red-300'
                            : 'border-stone-600 bg-stone-900 text-stone-300'
                      }`}
                    >
                      {outcomeFlash.variant}
                    </span>
                  )}
                </div>
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
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wider text-amber-500/90 font-bold">
                  Événement
                </p>
                <RarityBadge rarity={event.rarity} />
              </div>
              <h3 className="text-lg font-bold text-amber-50 mt-1">{event.title}</h3>
              <p className="text-sm text-stone-300 mt-3 leading-relaxed flex-1">{event.text}</p>
              <div className="mt-5 space-y-2">
                {event.options.map((opt, i) => {
                  const locked = !!opt.locked;
                  const requireLabels = opt.requireLabels || [];
                  return (
                    <button
                      key={opt.id || opt.label}
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && handleChoice(i)}
                      className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition ${
                        locked
                          ? 'border-stone-700/80 bg-stone-950/40 text-stone-500 cursor-not-allowed'
                          : 'border-stone-600 text-stone-100 hover:border-amber-500/60 hover:bg-amber-950/25'
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span>{opt.label}</span>
                          {!locked && requireLabels.length > 0 && (
                            <span className="text-[11px] font-medium text-emerald-400/95">
                              {requireLabels.join(' · ')}
                            </span>
                          )}
                        </span>
                        {locked && (
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-stone-500">
                            🔒
                          </span>
                        )}
                      </span>
                      {locked && opt.lockReasons?.length > 0 && (
                        <span className="block mt-1 text-[11px] text-stone-500 leading-snug">
                          Requis : {opt.lockReasons.join(' · ')}
                        </span>
                      )}
                    </button>
                  );
                })}
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
