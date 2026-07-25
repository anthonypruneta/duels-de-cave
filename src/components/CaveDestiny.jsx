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
  EXTEND_SEASON_HP_COST,
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
  formatDelta,
  computeScore,
  getTier,
  buildCompanionPool,
  withCompanionPool,
  listActiveChainQuests,
  canExtendSeason,
  extendCareerSeason,
  retireFromExtend,
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
import CaveDestinyRecap from './CaveDestinyRecap';

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
    ['Auto', 'Auto (Attaque)', stats.auto],
    ['Déf', 'Déf (Défense)', stats.def],
    ['Cap', 'Cap (Capacité)', stats.cap],
    ['VIT', 'VIT (Vitesse)', stats.spd],
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
  const stats = character.baseStats || {};
  const statRows = [
    ['Auto', stats.auto],
    ['Déf', stats.def],
    ['Cap', stats.cap],
    ['VIT', stats.spd],
    ['CHA', stats.charisme],
  ];
  return (
    <div
      className={`rounded-xl border border-stone-700 bg-stone-950/80 ${
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
      }`}
    >
      <div className="flex items-center gap-3">
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
            subclass={null}
            className="mt-0.5"
          />
        </div>
      </div>
      <div
        className={`grid grid-cols-5 gap-0.5 text-center rounded-lg border border-stone-700/80 bg-stone-900/70 ${
          compact ? 'mt-2 px-1 py-1.5' : 'mt-2.5 px-1.5 py-2'
        }`}
      >
        {statRows.map(([label, value]) => (
          <div key={label}>
            <p
              className={`uppercase tracking-wide text-stone-500 leading-none ${
                compact ? 'text-[8px]' : 'text-[9px]'
              }`}
            >
              {label}
            </p>
            <p
              className={`mt-0.5 font-bold text-amber-100 tabular-nums leading-none ${
                compact ? 'text-[11px]' : 'text-xs'
              }`}
            >
              {Math.round(value || 0)}
            </p>
          </div>
        ))}
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
        {entry.ambition ? (
          <p className="text-[11px] italic text-stone-500 mt-0.5 truncate">
            {entry.ambition}
          </p>
        ) : null}
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
    let cancelled = false;
    const boot = async () => {
      const saved = loadSave();
      if (!saved || (saved.phase !== 'playing' && saved.phase !== 'extendOffer')) return;
      try {
        const pool = await ensurePool();
        if (cancelled) return;
        setCareer(withCompanionPool(ensureCurrentEvent(saved), pool));
      } catch {
        if (!cancelled) setCareer(ensureCurrentEvent(saved));
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, [ensurePool]);

  useEffect(() => {
    if (career) persistSave(career);
  }, [career]);

  // Filet : phase prolongation atteinte sans être déjà sur l’écran dédié
  useEffect(() => {
    if (!career || outcomeFlash) return;
    if (career.phase === 'extendOffer' && screen !== 'extend') {
      setScreen('extend');
    }
  }, [career, career?.phase, outcomeFlash, screen]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    migrateLocalCaveDestinyPantheon(currentUser.uid).catch(() => {});
  }, [currentUser?.uid]);

  useEffect(() => {
    if (screen !== 'mesRuns' && screen !== 'pantheon' && screen !== 'final') return;
    let cancelled = false;

    const load = async () => {
      if (screen === 'final') {
        // Panthéon pour percentile réel / rival — silencieux
        try {
          const res = await loadCaveDestinyPantheon({ max: 500 });
          if (!cancelled && res.success) setPantheon(res.runs || []);
        } catch {
          /* ignore */
        }
        return;
      }

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
    if (career.phase === 'finished') setScreen('final');
    else if (career.phase === 'extendOffer') setScreen('extend');
    else setScreen('game');
  };

  const finishAndSaveRun = (finishedCareer) => {
    if (!finishedCareer || finishedCareer.phase !== 'finished') return;
    const uid = currentUser?.uid || null;
    pushToPantheon(finishedCareer, { userId: uid });
    if (uid && !savingRunRef.current) {
      savingRunRef.current = true;
      saveCaveDestinyFinishedRun({ userId: uid, career: finishedCareer })
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

  const selectWeapon = async (id) => {
    const nextSetup = { ...setup, weaponId: id };
    setSetup(nextSetup);
    let companionPool = [];
    try {
      const pool = await ensurePool();
      companionPool = buildCompanionPool(pool, nextSetup.character?.id, 18);
    } catch {
      companionPool = [];
    }
    const created = ensureCurrentEvent(
      createCareer({ ...nextSetup, companionPool })
    );
    setCareer(created);
    setScreen('game');
  };

  const handleChoice = (optionIndex) => {
    if (!career) return;
    const next = resolveChoice(career, optionIndex);
    setOutcomeFlash(next.lastOutcome);
    setCareer(next);
    if (next.phase === 'finished') {
      finishAndSaveRun(next);
    }
  };

  const continueAfterOutcome = () => {
    const phase = career?.phase;
    setOutcomeFlash(null);
    if (phase === 'finished') setScreen('final');
    else if (phase === 'extendOffer') setScreen('extend');
  };

  const handleExtendSeason = () => {
    if (!career || !canExtendSeason(career)) return;
    const next = extendCareerSeason(career);
    setOutcomeFlash(next.lastOutcome);
    setCareer(next);
    setScreen('game');
  };

  const handleRetireFromExtend = () => {
    if (!career) return;
    const next = retireFromExtend(career);
    setCareer(next);
    finishAndSaveRun(next);
    setScreen('final');
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
    const canResume = career?.phase === 'playing' || career?.phase === 'extendOffer';
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
          <p className="mt-2 text-xs text-stone-500 max-w-sm">
            Ouvert à tous les joueurs connectés : carrière, Mes runs et Panthéon.
          </p>

          <div className="mt-10 w-full space-y-3 max-w-sm">
            {canResume && (
              <PrimaryButton onClick={resume}>
                {career.phase === 'extendOffer'
                  ? `Reprendre — fin de saison ${career.maxSeasons}`
                  : `Reprendre — saison ${career.season}/${career.maxSeasons}`}
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
                subclass={null}
                centered
                className="mt-1"
              />
              <p className="mt-1 w-full text-center text-[10px] sm:text-xs italic text-stone-500 truncate">
                {c.ownerPseudo || 'Inconnu'}
              </p>
              <div className="mt-2 w-full grid grid-cols-5 gap-0.5 text-center rounded-lg border border-stone-700/80 bg-stone-900/70 px-1 py-1.5">
                {[
                  ['Auto', c.baseStats?.auto],
                  ['Déf', c.baseStats?.def],
                  ['Cap', c.baseStats?.cap],
                  ['VIT', c.baseStats?.spd],
                  ['CHA', c.baseStats?.charisme],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[8px] sm:text-[9px] uppercase tracking-wide text-stone-500 leading-none">
                      {label}
                    </p>
                    <p className="mt-0.5 text-[11px] sm:text-xs font-bold text-amber-100 tabular-nums leading-none">
                      {Math.round(value || 0)}
                    </p>
                  </div>
                ))}
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
        {setup.character && (
          <div className="mb-4">
            <CharacterIdentity character={setup.character} compact />
          </div>
        )}
        <ScreenTitle
          title="Votre ambition"
          sub="Choisissez une voie. Elle s’éclaire seulement au bout du chemin."
        />
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

  /* ---------- EXTEND (fin de saison max) ---------- */
  if (screen === 'extend' && career?.phase === 'extendOffer') {
    const hp = Math.round(Number(career.stats?.hp ?? career.stats?.forme) || 0);
    const canPay = canExtendSeason(career);
    const cost = EXTEND_SEASON_HP_COST;
    return (
      <Shell>
        <ScreenTitle
          title="Le livre tremble"
          sub={`Saison ${career.maxSeasons} achevée. La Cave peut encore tourner une page — contre votre sang.`}
        />
        <div className="rounded-2xl border-2 border-rose-700/45 bg-rose-950/20 px-4 py-5 shadow-[0_0_22px_rgba(225,29,72,0.12)]">
          <p className="text-[11px] uppercase tracking-wider text-rose-300/90 font-bold">
            Prolongation
          </p>
          <h3 className="mt-1 text-lg font-bold text-amber-50">
            Sacrifier {cost} PV pour +1 saison ?
          </h3>
          <p className="mt-3 text-sm text-stone-300 leading-relaxed font-[Cormorant_Garamond,Georgia,serif]">
            Vous avez {hp} PV. {canPay
              ? `Après le sacrifice, il vous en resterait ${hp - cost}. La run continue à la saison ${career.maxSeasons + 1}.`
              : `Pas assez de PV (il faut plus de ${cost}). La retraite est la seule issue.`}
          </p>
          <p className="mt-2 text-xs text-stone-500">
            Vous pourrez recommencer ce choix à chaque nouveau plafond de saisons.
          </p>
          <div className="mt-6 space-y-3">
            <PrimaryButton onClick={handleExtendSeason} disabled={!canPay}>
              Sacrifier {cost} PV — continuer
            </PrimaryButton>
            <GhostButton onClick={handleRetireFromExtend}>
              Prendre sa retraite
            </GhostButton>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------- FINAL ---------- */
  if (screen === 'final' && career) {
    return (
      <Shell>
        <div className="mb-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.28em] text-amber-500/80 font-bold">
            Fin de carrière
          </p>
          <h2 className="font-[Cinzel,serif] text-2xl font-bold text-amber-100 mt-1">
            Votre destin
          </h2>
        </div>
        <CaveDestinyRecap
          career={career}
          pantheon={pantheon}
          onReplay={startFresh}
          onMyRuns={() => {
            clearSave();
            setCareer(null);
            setScreen('mesRuns');
          }}
          onHome={() => {
            clearSave();
            setCareer(null);
            setScreen('home');
          }}
        />
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
              subclass={career.subclass}
              className="mt-0.5"
            />
            {career.mentor?.name ? (
              <p className="text-[11px] italic text-stone-500 truncate mt-0.5">
                Mentor : {career.mentor.name}
              </p>
            ) : null}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-stone-200">
              {career.season}/{career.maxSeasons}
            </p>
            <p className={`text-[11px] ${liveTier.color}`}>{liveTier.label}</p>
            {career.ambition?.name && (
              <p className="mt-0.5 text-[10px] text-violet-300/90 truncate max-w-[7.5rem]">
                <span aria-hidden="true">{career.ambition.icon || '🎯'}</span>{' '}
                {career.ambition.name}
              </p>
            )}
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
          {career.subclass && (
            <div className="text-right">
              <p className="text-[11px] text-stone-500">Sous-classe</p>
              <p className="text-xs font-semibold text-violet-300 truncate max-w-[7rem]">
                {career.subclass?.name}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mb-3">
          <Gauge
            label="PV"
            value={career.stats.hp ?? career.stats.forme ?? 0}
            colorClass={(career.stats.hp ?? career.stats.forme ?? 0) <= 25 ? 'bg-red-500' : 'bg-rose-500'}
          />
          <Gauge label="Moral" value={career.stats.moral} colorClass="bg-sky-500" />
        </div>

        <div className="h-1 rounded-full bg-stone-900 border border-stone-700 overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-amber-700 to-amber-400 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>

        {(() => {
          const activeQuests = listActiveChainQuests(career);
          if (!activeQuests.length) return <div className="mb-6" />;
          return (
            <div className="mb-6 flex flex-wrap gap-1.5">
              {activeQuests.map((q) => (
                <span
                  key={q.chainId}
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/45 bg-teal-950/40 px-2.5 py-1 text-[11px] font-semibold text-teal-100"
                  title={`Prochaine étape possible : ${q.nextStep}/${q.total}`}
                >
                  <span aria-hidden="true">🗺️</span>
                  <span className="truncate max-w-[12rem]">{q.label}</span>
                  <span className="text-teal-300/90 tabular-nums">
                    {q.done}/{q.total}
                  </span>
                </span>
              ))}
            </div>
          );
        })()}

        <div
          className={`rounded-2xl p-5 min-h-[260px] flex flex-col ${
            event?.ambitionLinked && !outcomeFlash
              ? 'border-2 border-violet-500/60 bg-violet-950/30 shadow-[0_0_28px_rgba(139,92,246,0.18)]'
              : outcomeFlash?.ambitionLinked
                ? 'border-2 border-violet-500/50 bg-violet-950/25 shadow-[0_0_22px_rgba(139,92,246,0.14)]'
                : event?.chain && !outcomeFlash
                  ? 'border-2 border-teal-600/45 bg-teal-950/20 shadow-[0_0_22px_rgba(20,184,166,0.12)]'
                  : 'border border-stone-600 bg-stone-950/85'
          }`}
        >
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
                      {outcomeFlash.variant === 'bonus'
                        ? 'Réussite'
                        : outcomeFlash.variant === 'malus'
                          ? 'Échec'
                          : 'Neutre'}
                    </span>
                  )}
                </div>
                {outcomeFlash.ambitionLinked && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-300">
                    <span aria-hidden="true">{career.ambition?.icon || '🎯'}</span>
                    Ambition · gains renforcés
                  </p>
                )}
                <h3 className="text-lg font-bold text-amber-50 mt-1">{outcomeFlash.title}</h3>
                {outcomeFlash.choice && (
                  <p className="mt-2 text-xs italic text-stone-500">
                    Choix : {outcomeFlash.choice}
                  </p>
                )}
                <p
                  className={`mt-4 text-[15px] sm:text-base leading-relaxed flex-1 font-[Cormorant_Garamond,Georgia,serif] ${
                    outcomeFlash.variant === 'bonus'
                      ? 'text-amber-50'
                      : outcomeFlash.variant === 'malus'
                        ? 'text-stone-200'
                        : 'text-stone-100'
                  }`}
                >
                  {outcomeFlash.text}
                </p>
              <div className="flex flex-wrap gap-1.5 mt-4">
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
                {typeof outcomeFlash.scoreGain === 'number' && outcomeFlash.scoreGain > 0 && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${
                      outcomeFlash.ambitionLinked
                        ? 'border-violet-500/50 bg-violet-950/50 text-violet-200'
                        : 'border-amber-700/50 bg-amber-950/40 text-amber-300'
                    }`}
                  >
                    +{outcomeFlash.scoreGain} score
                    {outcomeFlash.ambitionLinked ? ' · ambition' : ''}
                  </span>
                )}
              </div>
              {outcomeFlash.died && (
                <p className="mt-3 text-sm font-semibold text-red-300">
                  💀 Mort — PV à 0. Score final divisé par 2.
                </p>
              )}
              <div className="mt-5">
                <PrimaryButton onClick={continueAfterOutcome}>
                  {outcomeFlash.died
                    ? 'Voir le destin'
                    : career?.phase === 'extendOffer'
                      ? 'La Cave propose une suite…'
                      : 'Continuer'}
                </PrimaryButton>
              </div>
            </>
          ) : event ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`text-[11px] uppercase tracking-wider font-bold ${
                    event.ambitionLinked
                      ? 'text-violet-300'
                      : event.chain
                        ? 'text-teal-300'
                        : 'text-amber-500/90'
                  }`}
                >
                  {event.ambitionLinked
                    ? 'Finale d’ambition'
                    : event.chain
                      ? 'Suite'
                      : 'Événement'}
                </p>
                <RarityBadge rarity={event.rarity} />
              </div>
              {event.chain && (
                <div
                  className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    event.ambitionLinked
                      ? 'border-violet-500/50 bg-violet-950/60 text-violet-100'
                      : 'border-teal-600/45 bg-teal-950/45 text-teal-100'
                  }`}
                >
                  <span aria-hidden="true">
                    {event.ambitionLinked
                      ? event.ambitionIcon || career.ambition?.icon || '🎯'
                      : '🗺️'}
                  </span>
                  <span>
                    {event.chain.label} · {event.chain.step}/{event.chain.total}
                    {event.ambitionLinked ? ' · ambition' : ''}
                  </span>
                </div>
              )}
              <h3 className="text-lg font-bold text-amber-50 mt-2">{event.title}</h3>
              {event.ambitionLinked ? (
                <p className="mt-1.5 text-xs text-violet-200/90 leading-relaxed">
                  Fin de suite — votre ambition s’allume : les gains sont renforcés.
                </p>
              ) : event.chain ? (
                <p className="mt-1.5 text-xs text-teal-200/85 leading-relaxed">
                  Étape {event.chain.step}/{event.chain.total}
                  {event.chain.isFinale
                    ? ''
                    : ' — réussissez pour débloquer la suite (tirage ultérieur).'}
                </p>
              ) : null}
              <p className="mt-3 text-[15px] sm:text-base text-stone-200 leading-relaxed flex-1 font-[Cormorant_Garamond,Georgia,serif]">
                {event.text}
              </p>
              <div className="mt-5 space-y-2">
                {event.options.map((opt, i) => {
                  const locked = !!opt.locked;
                  const requireLabels = opt.requireLabels || [];
                  const companion = opt.companion;
                  return (
                    <button
                      key={opt.id || opt.label}
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && handleChoice(i)}
                      className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition ${
                        locked
                          ? 'border-stone-700/80 bg-stone-950/40 text-stone-500 cursor-not-allowed'
                          : opt.exitChain || opt.id === 'refuser' || opt.id === 'refuser_quete'
                            ? 'border-stone-600/80 text-stone-300 hover:border-stone-400/70 hover:bg-stone-900/50'
                            : companion
                              ? 'border-rose-700/45 text-stone-100 hover:border-rose-400/70 hover:bg-rose-950/30'
                            : event.ambitionLinked
                              ? 'border-violet-600/45 text-stone-100 hover:border-violet-400/70 hover:bg-violet-950/35'
                              : 'border-stone-600 text-stone-100 hover:border-amber-500/60 hover:bg-amber-950/25'
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        {companion && (
                          <CharacterPortrait
                            src={companion.characterImage}
                            alt={companion.name}
                            size="sm"
                            className="shrink-0"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="flex flex-col gap-0.5">
                              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span>{opt.label}</span>
                                {!locked && requireLabels.length > 0 && (
                                  <span className="text-[11px] font-medium text-emerald-400/95">
                                    {requireLabels.join(' · ')}
                                  </span>
                                )}
                              </span>
                              {companion && (
                                <span className="text-[11px] text-rose-200/85">
                                  {[companion.race, companion.class, companion.ownerPseudo]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              )}
                              {!companion && opt.detail && (
                                <span className="text-[11px] text-stone-400">{opt.detail}</span>
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
                        </span>
                      </span>
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
