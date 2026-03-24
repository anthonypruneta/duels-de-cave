import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import { getUserCharacter, resolveCoopRaceEchoOffer } from '../services/characterService';
import {
  COOP_RED_DIFFICULTY,
  COOP_RED_LEVEL_REQUIRED,
  COOP_RED_MAX_ATTEMPTS_PER_DAY,
  COOP_RED_DROP_RATE,
  COOP_RACE_ECHO_POTENCY,
  COOP_RED_DIFFICULTY_LABELS,
  getCoopRedLineup,
  getCoopRedBossMoveDisplay,
} from '../data/coopRedDungeon';
import {
  buildRacePointeauAdnDescription,
  getPointeauAdnIntensityLabel,
  splitDescriptionLines,
} from '../utils/descriptionBuilders';
import {
  createCoopRedRoom,
  joinCoopRedRoom,
  subscribeCoopRedRoom,
  subscribeOpenCoopRedRooms,
  setCoopRedPlayerReady,
  leaveCoopRedRoomAsGuest,
  deleteCoopRedRoom,
  runCoopRedAutoSimulation,
  getCoopRedAttemptsLeft,
  claimCoopRedRaceEchoIfNeeded,
} from '../services/coopRedDungeonService';
import CoopRedAnimatedReplay from './CoopRedAnimatedReplay';
import CoopRedCombatLog from './CoopRedCombatLog';
import { getCoopRedSpriteUrl } from '../utils/coopRedSprites';
/** Portrait du dresseur Red (remplace `src/assets/coop/red.png` si besoin). */
import redTrainerPortraitUrl from '../assets/coop/red.png';

const COOP_RED_PAGE_BG = '/assets/backgrounds/red.png';

function coopRedHostRoomStorageKey(uid) {
  return uid ? `coopRedHostRoom:${uid}` : null;
}

function CoopRedDungeon() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);
  const [attemptsLeft, setAttemptsLeft] = useState(COOP_RED_MAX_ATTEMPTS_PER_DAY);
  const [difficulty, setDifficulty] = useState(COOP_RED_DIFFICULTY.EASY);
  const [roomId, setRoomId] = useState(() => sessionStorage.getItem('coopRedRoomId') || '');
  const [room, setRoom] = useState(null);
  const [openRooms, setOpenRooms] = useState([]);
  const [listDifficultyFilter, setListDifficultyFilter] = useState('all');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [readyBusy, setReadyBusy] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const simRunningRef = useRef(false);
  const autoOpenedReplayRoomRef = useRef('');
  /** Après « Masquer », on n’applique pas tout de suite la restauration auto depuis localStorage (sinon retour instantané dans la salle). */
  const skipAutoResumeRef = useRef(false);
  const audioRef = useRef(null);
  const [showAnimatedReplay, setShowAnimatedReplay] = useState(false);
  const [isReplayFinished, setIsReplayFinished] = useState(false);
  const [echoOfferBusy, setEchoOfferBusy] = useState(false);

  const loadCharAndAttempts = useCallback(async () => {
    if (!currentUser) return;
    const [c, a] = await Promise.all([
      getUserCharacter(currentUser.uid),
      getCoopRedAttemptsLeft(currentUser.uid),
    ]);
    if (c.success && c.data) setCharacter(c.data);
    if (a.success) setAttemptsLeft(a.attemptsLeft);
  }, [currentUser]);

  useEffect(() => {
    loadCharAndAttempts();
  }, [loadCharAndAttempts]);

  /** Retrouver l’id de salle (session puis localStorage hôte) si on revient sur la page sans roomId en mémoire. */
  useEffect(() => {
    if (!currentUser?.uid || roomId) return;
    if (skipAutoResumeRef.current) return;
    const sid = sessionStorage.getItem('coopRedRoomId');
    const key = coopRedHostRoomStorageKey(currentUser.uid);
    const lid = key ? localStorage.getItem(key) : '';
    const raw = (sid || lid || '').trim();
    if (!raw) return;
    setRoomId(raw);
    sessionStorage.setItem('coopRedRoomId', raw);
  }, [currentUser?.uid, roomId]);

  // Autoplay navigateur : souvent bloqué sans geste — on retente au 1er pointerdown (salle / boutons / header).
  useEffect(() => {
    const tryPlay = () => {
      const el = audioRef.current;
      if (!el || !el.paused) return;
      el.play().catch(() => {});
    };

    tryPlay();

    const onGesture = () => tryPlay();
    window.addEventListener('pointerdown', onGesture, true);

    return () => {
      window.removeEventListener('pointerdown', onGesture, true);
      const el = audioRef.current;
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    };
  }, []);

  useEffect(() => {
    if (!currentUser || roomId) {
      setOpenRooms([]);
      return undefined;
    }
    const unsub = subscribeOpenCoopRedRooms(
      (rows) => setOpenRooms(rows),
      (e) => console.warn('coop open rooms', e)
    );
    return () => unsub();
  }, [currentUser, roomId]);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      return;
    }
    sessionStorage.setItem('coopRedRoomId', roomId);
    const unsub = subscribeCoopRedRoom(
      roomId,
      (data) => {
        if (!data) {
          setRoom(null);
          sessionStorage.removeItem('coopRedRoomId');
          const k = currentUser?.uid ? coopRedHostRoomStorageKey(currentUser.uid) : null;
          if (k) localStorage.removeItem(k);
          setRoomId('');
          return;
        }
        setRoom(data);
        if (data.status === 'completed') {
          // On garde l'affichage courant, mais on n'auto-réouvre jamais une salle déjà terminée au prochain passage.
          sessionStorage.removeItem('coopRedRoomId');
          const k = currentUser?.uid ? coopRedHostRoomStorageKey(currentUser.uid) : null;
          if (k) localStorage.removeItem(k);
        }
        if (currentUser?.uid && data.hostId === currentUser.uid && data.status !== 'completed') {
          const k = coopRedHostRoomStorageKey(currentUser.uid);
          if (k) localStorage.setItem(k, roomId);
        }
        if (data?.status === 'completed' && data?.combat?.winner === 'players' && currentUser) {
          claimCoopRedRaceEchoIfNeeded(roomId, currentUser.uid).then(() => loadCharAndAttempts());
        } else if (data?.status === 'completed' && data?.combat?.winner && currentUser) {
          loadCharAndAttempts();
        }
      },
      (e) => console.warn('coop room snap', e)
    );
    return () => unsub();
  }, [roomId, currentUser, loadCharAndAttempts]);

  useEffect(() => {
    if (!roomId || !room || !currentUser) return;
    if (!room.guestId || !room.hostSnapshot || !room.guestSnapshot) return;
    if (room.status === 'waiting' || room.status === 'failed_no_attempts') return;
    if (room.status === 'completed' && room.combat?.winner) return;

    const legacyReadyFlow =
      room.status === 'ready' && room.hostReady == null && room.guestReady == null;
    const lobbyBothReady =
      room.status === 'lobby' && room.hostReady === true && room.guestReady === true;
    const canKickOff = legacyReadyFlow || lobbyBothReady;

    const needSim =
      (canKickOff && room.attemptsConsumed !== true) ||
      (room.status === 'simulating' && !room.combat?.winner);

    if (!needSim) return;
    if (simRunningRef.current) return;

    simRunningRef.current = true;
    setSimRunning(true);
    runCoopRedAutoSimulation(roomId)
      .then((res) => {
        if (!res.success && res.error) setError(res.error);
      })
      .finally(() => {
        simRunningRef.current = false;
        setSimRunning(false);
      });
  }, [
    roomId,
    currentUser,
    room?.guestId,
    room?.status,
    room?.hostReady,
    room?.guestReady,
    room?.attemptsConsumed,
    room?.combat?.winner,
    room?.hostSnapshot,
    room?.guestSnapshot,
  ]);

  useEffect(() => {
    if (!room?.id || room?.status !== 'completed' || !room?.combat) return;
    if (autoOpenedReplayRoomRef.current === room.id) return;
    autoOpenedReplayRoomRef.current = room.id;
    setIsReplayFinished(false);
    setShowAnimatedReplay(true);
  }, [room?.id, room?.status, room?.combat]);

  const isHost = room && currentUser && room.hostId === currentUser.uid;
  const isGuest = room && currentUser && room.guestId === currentUser.uid;
  const inRoom = isHost || isGuest;

  /** Salle hôte encore enregistrée localement alors qu’on n’a pas d’abonnement actif (masqué ou navigation). */
  const hostPendingRoomId =
    currentUser?.uid && !roomId
      ? (localStorage.getItem(coopRedHostRoomStorageKey(currentUser.uid)) || '').trim()
      : '';

  const lineup = useMemo(() => (room ? getCoopRedLineup(room.difficulty) : null), [room]);

  const handleCreate = async () => {
    setError(null);
    setBusy(true);
    const res = await createCoopRedRoom(currentUser.uid, difficulty);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    const id = res.roomId;
    setRoomId(id);
    sessionStorage.setItem('coopRedRoomId', id);
    const k = coopRedHostRoomStorageKey(currentUser.uid);
    if (k) localStorage.setItem(k, id);
  };

  const handleResumeHostRoom = (id) => {
    if (!id || !currentUser?.uid) return;
    setError(null);
    skipAutoResumeRef.current = false;
    const t = String(id).trim();
    setRoomId(t);
    sessionStorage.setItem('coopRedRoomId', t);
    const k = coopRedHostRoomStorageKey(currentUser.uid);
    if (k) localStorage.setItem(k, t);
  };

  /** Affiche la liste / création sans quitter la salle Firestore (ex. annuler / supprimer toujours possibles après). */
  const handleMasquerSalleVoirListe = () => {
    skipAutoResumeRef.current = true;
    sessionStorage.removeItem('coopRedRoomId');
    setRoomId('');
    setRoom(null);
    setShowAnimatedReplay(false);
  };

  const handleJoinListedRoom = async (id) => {
    setError(null);
    setBusy(true);
    const res = await joinCoopRedRoom(currentUser.uid, id);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setRoomId(res.roomId);
  };

  const handleToggleReady = async (next) => {
    if (!roomId || !currentUser) return;
    setReadyBusy(true);
    setError(null);
    const res = await setCoopRedPlayerReady(roomId, currentUser.uid, next);
    setReadyBusy(false);
    if (!res.success) setError(res.error);
  };

  const handleLeaveRoom = () => {
    skipAutoResumeRef.current = false;
    sessionStorage.removeItem('coopRedRoomId');
    const k = currentUser?.uid ? coopRedHostRoomStorageKey(currentUser.uid) : null;
    if (k) localStorage.removeItem(k);
    setRoomId('');
    setRoom(null);
    setShowAnimatedReplay(false);
  };

  const handleGuestLeaveLobby = async () => {
    if (!roomId || !currentUser) return;
    setBusy(true);
    setError(null);
    const res = await leaveCoopRedRoomAsGuest(roomId, currentUser.uid);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    handleLeaveRoom();
  };

  const handleResolveEchoOffer = async (acceptReplace) => {
    if (!currentUser) return;
    setEchoOfferBusy(true);
    setError(null);
    const res = await resolveCoopRaceEchoOffer(currentUser.uid, acceptReplace);
    setEchoOfferBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    await loadCharAndAttempts();
  };

  const handleHostCancelRoom = async () => {
    if (!roomId || !currentUser) return;
    setBusy(true);
    setError(null);
    const res = await deleteCoopRedRoom(roomId, currentUser.uid);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    handleLeaveRoom();
  };

  const level = character?.level ?? 1;

  const diffOptions = [
    COOP_RED_DIFFICULTY.EASY,
    COOP_RED_DIFFICULTY.MEDIUM,
    COOP_RED_DIFFICULTY.HARD,
  ];

  const filteredOpenRooms = useMemo(() => {
    if (listDifficultyFilter === 'all') return openRooms;
    return openRooms.filter((r) => r.difficulty === listDifficultyFilter);
  }, [openRooms, listDifficultyFilter]);

  const isCombatLaunched =
    inRoom &&
    room &&
    (room.status === 'simulating' || room.status === 'completed');
  const displayAnimatedReplay = isCombatLaunched ? true : showAnimatedReplay;

  return (
    <div className="relative min-h-screen text-stone-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 min-h-full bg-stone-950 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${COOP_RED_PAGE_BG})` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 min-h-full bg-stone-950/70"
      />
      <div className="relative z-10 p-4 md:p-6 min-h-screen">
        {!isCombatLaunched && <Header />}
        <div
          className={`mx-auto ${isCombatLaunched ? 'pt-4' : 'pt-20'} px-0 flex flex-col xl:flex-row gap-8 xl:items-start xl:justify-center ${
            displayAnimatedReplay ? 'max-w-[1800px]' : 'max-w-6xl'
          }`}
        >
        <div
          className={`space-y-6 flex-1 min-w-0 w-full ${
            displayAnimatedReplay ? '' : 'max-w-3xl mx-auto xl:mx-0'
          }`}
        >
        {!isCombatLaunched && (
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-red-400 mb-1">L'arène de Red</h1>
          <p className="text-stone-400 text-sm">
            Crée une salle ou choisis-en une dans la liste. Une fois à deux, chacun clique sur{' '}
            <span className="text-stone-300">Prêt</span> : le combat se lance quand les deux sont prêts. Même moteur que
            le tournoi ; seed déterministe. Tu peux quitter la page.
          </p>
        </div>
        )}

        {!isCombatLaunched && (
        <div className="rounded-xl border border-amber-900/40 bg-stone-900/60 p-4 text-sm space-y-3">
          <h2 className="font-bold text-amber-400 text-xs uppercase tracking-wide">Récompenses Red : Pointeau ADN</h2>
          <ul className="space-y-2 text-stone-400 leading-relaxed">
            <li>
              <span className="text-stone-200 font-semibold">Après une victoire</span> — Chaque joueur a un{' '}
              <span className="text-stone-300">tirage séparé</span> (chance de pointeau). S’il réussit, tu obtiens un{' '}
              <span className="text-stone-300">Pointeau ADN</span> : une{' '}
              <span className="text-stone-300">race aléatoire</span> (hors la tienne) ajouté à ton personnage.
              Ses bonus s’appliquent dans tes combats, sur tout le jeu. Si tu avais déjà un Pointeau ADN, tu choisis de{' '}
              <span className="text-stone-300">remplacer</span> ou de <span className="text-stone-300">garder</span> l’ancien.
            </li>
            <li>
              Chance de tirage : Facile {Math.round(COOP_RED_DROP_RATE[COOP_RED_DIFFICULTY.EASY] * 100)} %, Moyen{' '}
              {Math.round(COOP_RED_DROP_RATE[COOP_RED_DIFFICULTY.MEDIUM] * 100)} %, Difficile{' '}
              {Math.round(COOP_RED_DROP_RATE[COOP_RED_DIFFICULTY.HARD] * 100)} %. Rien en défaite.
            </li>
          </ul>
        </div>
        )}

        {!isCombatLaunched && (
        <div className="bg-stone-900/80 border border-stone-700 rounded-xl p-4 flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-amber-400 text-xs font-bold uppercase">Essais restants</p>
            <p className="text-2xl font-bold">{attemptsLeft} / {COOP_RED_MAX_ATTEMPTS_PER_DAY}</p>
          </div>
          {character?.coopRaceEcho?.race && (
            <div className="text-right text-sm text-stone-400 max-w-sm">
              <p className="text-amber-400 text-xs font-bold uppercase mb-1">Pointeau ADN actif</p>
              <span className="text-emerald-300 font-semibold">{character.coopRaceEcho.race}</span>
              <p className="text-[11px] text-stone-500 mt-1">{getPointeauAdnIntensityLabel()}</p>
              <div className="mt-2 space-y-1 text-[11px] text-stone-400">
                {splitDescriptionLines(buildRacePointeauAdnDescription(character.coopRaceEcho.race)).map((line, idx) => (
                  <p key={`echo-active-${idx}`}>• {line}</p>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

        {error && (
          <div className="bg-red-950/50 border border-red-700/60 text-red-200 text-sm px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        {character?.coopRaceEchoOffer?.race && (
          <div className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-4 space-y-3">
            <p className="text-sm text-stone-200">
              <span className="font-bold text-amber-400">Nouveau Pointeau ADN (Red)</span> — proposition :{' '}
              <span className="text-emerald-300 font-semibold">{character.coopRaceEchoOffer.race}</span>
              {character.coopRaceEcho?.race && (
                <>
                  {' '}
                  · Pointeau ADN actuel :{' '}
                  <span className="text-stone-300">{character.coopRaceEcho.race}</span>
                </>
              )}
            </p>
            <p className="text-xs text-stone-500">
              Remplace ton Pointeau ADN actuel par celui-ci, ou garde l’actuel et abandonne la proposition.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={echoOfferBusy}
                onClick={() => handleResolveEchoOffer(true)}
                className="px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-sm font-bold border border-emerald-600/60 disabled:opacity-50"
              >
                Remplacer par {character.coopRaceEchoOffer.race}
              </button>
              <button
                type="button"
                disabled={echoOfferBusy}
                onClick={() => handleResolveEchoOffer(false)}
                className="px-4 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-100 text-sm font-bold border border-stone-500/60 disabled:opacity-50"
              >
                Garder le Pointeau ADN actuel
              </button>
            </div>
          </div>
        )}

        {!inRoom && (
          <>
            {hostPendingRoomId && (
              <div className="rounded-xl border border-amber-600/70 bg-amber-950/25 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-amber-100/95">
                  Tu as une salle Red en cours (elle n’apparaît pas toujours dans la liste, ex. si un invité a déjà rejoint).
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleResumeHostRoom(hostPendingRoomId)}
                  className="shrink-0 px-4 py-2 rounded-lg bg-red-800 hover:bg-red-700 font-bold text-sm disabled:opacity-40"
                >
                  Reprendre ma salle
                </button>
              </div>
            )}
            <div className="bg-stone-900/80 border border-stone-700 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-amber-400">Difficulté</p>
              <div className="flex flex-wrap gap-2">
                {diffOptions.map((d) => {
                  const min = COOP_RED_LEVEL_REQUIRED[d];
                  const locked = level < min;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={locked}
                      onClick={() => setDifficulty(d)}
                      className={`px-3 py-2 rounded-lg text-sm font-bold border ${
                        difficulty === d
                          ? 'bg-red-800 border-red-500 text-white'
                          : 'bg-stone-800 border-stone-600 text-stone-300'
                      } ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {COOP_RED_DIFFICULTY_LABELS[d]} (niv. {min}+)
                      <span className="block text-[10px] font-normal text-stone-400">
                        Pointeau {Math.round((COOP_RED_DROP_RATE[d] ?? 0) * 100)} %
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="bg-stone-900/80 border border-stone-700 rounded-xl p-4 space-y-3">
                <h2 className="font-bold text-lg">Créer une salle</h2>
                <p className="text-xs text-stone-500">
                  Ta salle apparaît dans la liste avec la difficulté choisie ci-dessus.
                </p>
                <button
                  type="button"
                  disabled={busy || attemptsLeft <= 0}
                  onClick={handleCreate}
                  className="w-full py-3 rounded-lg bg-red-700 hover:bg-red-600 font-bold disabled:opacity-40"
                >
                  Créer la salle
                </button>
              </div>
              <div className="bg-stone-900/80 border border-stone-700 rounded-xl p-4 space-y-3">
                <h2 className="font-bold text-lg">Salles ouvertes</h2>
                <div className="flex flex-wrap gap-2 items-center text-xs">
                  <span className="text-stone-500">Filtrer :</span>
                  {[
                    { id: 'all', label: 'Toutes' },
                    { id: COOP_RED_DIFFICULTY.EASY, label: COOP_RED_DIFFICULTY_LABELS[COOP_RED_DIFFICULTY.EASY] },
                    { id: COOP_RED_DIFFICULTY.MEDIUM, label: COOP_RED_DIFFICULTY_LABELS[COOP_RED_DIFFICULTY.MEDIUM] },
                    { id: COOP_RED_DIFFICULTY.HARD, label: COOP_RED_DIFFICULTY_LABELS[COOP_RED_DIFFICULTY.HARD] },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setListDifficultyFilter(opt.id)}
                      className={`px-2 py-1 rounded border text-[11px] font-bold ${
                        listDifficultyFilter === opt.id
                          ? 'bg-amber-900/60 border-amber-500 text-amber-100'
                          : 'border-stone-600 text-stone-400 hover:border-stone-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {filteredOpenRooms.length === 0 && (
                    <p className="text-sm text-stone-500 py-4 text-center">Aucune salle pour ce filtre.</p>
                  )}
                  {filteredOpenRooms.map((row) => {
                    const minLv = COOP_RED_LEVEL_REQUIRED[row.difficulty];
                    const locked = level < minLv;
                    const mine = row.hostId === currentUser?.uid;
                    return (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-600 bg-stone-800/60 px-3 py-2"
                      >
                        <div className="text-sm min-w-0">
                          <p className="font-semibold text-stone-200 truncate">{row.hostSnapshot?.name ?? 'Hôte'}</p>
                          <p className="text-[11px] text-stone-500">
                            {COOP_RED_DIFFICULTY_LABELS[row.difficulty]} · niv. {minLv}+
                          </p>
                        </div>
                        {mine ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleResumeHostRoom(row.id)}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-sm font-bold disabled:opacity-40"
                          >
                            Reprendre ma salle
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy || attemptsLeft <= 0 || locked}
                            onClick={() => handleJoinListedRoom(row.id)}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-sm font-bold disabled:opacity-40"
                          >
                            {locked ? 'Niveau' : 'Rejoindre'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {inRoom && room && (
          <div className={isCombatLaunched ? 'space-y-4' : 'bg-stone-900/80 border border-stone-700 rounded-xl p-4 space-y-4'}>
            {!isCombatLaunched && (
            <div className="flex flex-wrap justify-between gap-2">
              <p className="text-sm text-stone-400">
                {COOP_RED_DIFFICULTY_LABELS[room.difficulty]} — hôte :{' '}
                <span className="text-stone-200">{room.hostSnapshot?.name}</span>
                {room.guestSnapshot && (
                  <>
                    {' '}
                    · invité : <span className="text-stone-200">{room.guestSnapshot.name}</span>
                  </>
                )}
              </p>
              <div className="flex flex-wrap gap-3">
                {isGuest && (room.status === 'waiting' || room.status === 'lobby') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleGuestLeaveLobby}
                    className="text-sm text-amber-300 hover:text-amber-200 underline"
                  >
                    Quitter la salle
                  </button>
                )}
                {isHost && (room.status === 'waiting' || room.status === 'lobby') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleHostCancelRoom}
                    className="text-sm text-red-400 hover:text-red-300 underline"
                  >
                    Annuler la salle
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleMasquerSalleVoirListe}
                  className="text-sm text-stone-400 hover:text-white underline"
                >
                  Masquer (voir la liste) — reprends via « Reprendre ma salle »
                </button>
              </div>
            </div>
            )}

            {room.status === 'waiting' && (
              <p className="text-amber-200 text-sm">
                En attente d’un joueur depuis la liste des salles ouvertes…
              </p>
            )}

            {room.status === 'lobby' && room.guestId && (
              <div className="rounded-lg border border-stone-600 bg-stone-800/50 p-4 space-y-3">
                <p className="text-sm font-bold text-amber-400">Prêt pour le combat</p>
                <p className="text-xs text-stone-500">
                  Les deux joueurs doivent indiquer qu’ils sont prêts. Le combat démarre automatiquement ensuite.
                </p>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded border border-stone-600 px-3 py-2">
                    <p className="text-stone-400 text-xs mb-1">Hôte — {room.hostSnapshot?.name}</p>
                    <p className={room.hostReady ? 'text-emerald-400 font-bold' : 'text-stone-500'}>
                      {room.hostReady ? 'Prêt' : 'Pas prêt'}
                    </p>
                    {isHost && (
                      <button
                        type="button"
                        disabled={readyBusy}
                        onClick={() => handleToggleReady(!room.hostReady)}
                        className="mt-2 w-full py-2 rounded-lg bg-red-800 hover:bg-red-700 font-bold text-sm disabled:opacity-40"
                      >
                        {room.hostReady ? 'Annuler prêt' : 'Je suis prêt'}
                      </button>
                    )}
                  </div>
                  <div className="rounded border border-stone-600 px-3 py-2">
                    <p className="text-stone-400 text-xs mb-1">Invité — {room.guestSnapshot?.name}</p>
                    <p className={room.guestReady ? 'text-emerald-400 font-bold' : 'text-stone-500'}>
                      {room.guestReady ? 'Prêt' : 'Pas prêt'}
                    </p>
                    {isGuest && (
                      <button
                        type="button"
                        disabled={readyBusy}
                        onClick={() => handleToggleReady(!room.guestReady)}
                        className="mt-2 w-full py-2 rounded-lg bg-amber-800 hover:bg-amber-700 font-bold text-sm disabled:opacity-40"
                      >
                        {room.guestReady ? 'Annuler prêt' : 'Je suis prêt'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {room.status === 'failed_no_attempts' && (
              <p className="text-red-300 text-sm">
                Impossible de lancer le combat : au moins un joueur n’avait plus d’essais. Crée une nouvelle salle.
              </p>
            )}

            {(room.status === 'simulating' || simRunning) && room.guestId && !room.combat?.winner && !isCombatLaunched && (
              <div className="rounded-lg border border-amber-600/50 bg-amber-950/30 px-3 py-2 text-amber-100 text-sm">
                Simulation (moteur tournoi) en cours…
              </div>
            )}

            {room.status === 'completed' && room.combat && (
              <div className="space-y-4 border-t border-stone-700 pt-4">
                {room.combatSeed != null && room.hostSnapshot && room.guestSnapshot && (
                  <div className="space-y-3">
                    {!isCombatLaunched && (
                      <button
                        type="button"
                        onClick={() => setShowAnimatedReplay((v) => !v)}
                        className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-800/80 hover:bg-amber-700 text-white text-sm font-bold border border-amber-600/60"
                      >
                        {showAnimatedReplay
                          ? 'Voir le récap rapide'
                          : 'Voir le déroulé animé (même UI que le combat)'}
                      </button>
                    )}
                    {displayAnimatedReplay && (
                      <div className="w-full">
                        <CoopRedAnimatedReplay
                          key={`${room.id}-${room.combatSeed}`}
                          hostSnap={room.hostSnapshot}
                          guestSnap={room.guestSnapshot}
                          difficulty={room.difficulty}
                          combatSeed={room.combatSeed}
                          logTitle="🔴 Red — ton combat"
                          wrapperClassName="mt-0"
                          onReplayError={(msg) => setError(msg)}
                          onReplayFinished={setIsReplayFinished}
                        />
                      </div>
                    )}
                  </div>
                )}

                {(!displayAnimatedReplay || isReplayFinished) && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-stone-500">{room.hostSnapshot?.name} (hôte)</p>
                        <div className="h-3 bg-stone-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{
                              width: `${Math.max(0, Math.min(100, (100 * room.combat.hostHP) / (room.combat.hostMaxHP || 1)))}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs mt-1">
                          {room.combat.hostHP} / {room.combat.hostMaxHP} PV
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-500">{room.guestSnapshot?.name} (invité)</p>
                        <div className="h-3 bg-stone-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 transition-all"
                            style={{
                              width: `${Math.max(0, Math.min(100, (100 * room.combat.guestHP) / (room.combat.guestMaxHP || 1)))}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs mt-1">
                          {room.combat.guestHP} / {room.combat.guestMaxHP} PV
                        </p>
                      </div>
                    </div>

                    {lineup && (
                      <div>
                        <p className="text-xs text-stone-500 mb-1">Adversaires (rotation)</p>
                        <div className="flex flex-wrap gap-2">
                          {lineup.map((b, i) => {
                            const hp = room.combat.bossHP[i] ?? 0;
                            const maxHp = room.combat.bossMaxHP[i] ?? 1;
                            const active = i === (room.combat.activeBossIndex % 3);
                            const sprite = b.imageFile ? getCoopRedSpriteUrl(b.imageFile) : null;
                            const moveUi = getCoopRedBossMoveDisplay(b);
                            return (
                              <div
                                key={b.id}
                                className={`px-2 py-1 rounded border text-xs flex items-center gap-2 ${active ? 'border-amber-500 bg-amber-950/40' : 'border-stone-600'}`}
                              >
                                {sprite ? (
                                  <img
                                    src={sprite}
                                    alt=""
                                    className="w-8 h-8 object-contain flex-shrink-0"
                                    style={{ imageRendering: 'pixelated' }}
                                  />
                                ) : (
                                  <span>{b.icon}</span>
                                )}
                                <div className="min-w-0 flex flex-col gap-0.5">
                                  <span>
                                    {b.nom} — {hp}/{maxHp}
                                  </span>
                                  {moveUi && (
                                    <span
                                      className="text-[10px] text-amber-200/85 truncate"
                                      title={`${moveUi.name} — ${moveUi.description}`}
                                    >
                                      Sort : {moveUi.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-stone-500">
                      Résolution : chaque tour, ordre par VIT (même priorités que le tournoi) ; tout le monde vivant joue
                      une fois — 2 joueurs + chaque boss encore debout. Les joueurs attaquent le boss focal du tour (il
                      change à chaque tour). Logs = règles PvP habituelles.
                    </p>

                    <CoopRedCombatLog
                      lines={room.combat.log || []}
                      hostName={room.hostSnapshot?.name}
                      guestName={room.guestSnapshot?.name}
                      title="⚔️ Red — journal de combat"
                      containerStyle={{ maxHeight: '24rem', minHeight: '12rem' }}
                      className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-lg flex flex-col overflow-hidden min-h-0 w-full"
                    />
                  </>
                )}

                {(!displayAnimatedReplay || isReplayFinished) && (
                <div className="text-sm space-y-1">
                  {room.combat.winner === 'players' && (
                    <p className="text-emerald-400 font-bold">Victoire !</p>
                  )}
                  {room.combat.winner === 'boss' && (
                    <p className="text-red-400 font-bold">Défaite…</p>
                  )}
                  {room.combat.winner === 'players' && (
                    <p className="text-stone-400 space-y-1">
                      {isHost && room.hostDropGranted && (
                        <>
                          <span>
                            Pointeau ADN tiré au sort :{' '}
                            <span className="text-emerald-300 font-semibold">
                              {room.hostEchoRaceGrant ?? '—'}
                            </span>{' '}
                            (~{Math.round(COOP_RACE_ECHO_POTENCY * 100)} % du passif d’éveil de cette race).
                            {character?.coopRaceEcho?.race &&
                              character?.coopRaceEchoOffer?.roomId === room.id && (
                                <span className="block mt-1 text-amber-200/90 text-xs">
                                  Tu avais déjà un Pointeau ADN : choisis en haut de page de remplacer ou de le garder.
                                </span>
                              )}
                          </span>
                          {!!room.hostEchoRaceGrant && (
                            <span className="block mt-2 text-[11px] text-stone-400">
                              <span className="text-stone-300">{getPointeauAdnIntensityLabel()}</span>
                              {splitDescriptionLines(buildRacePointeauAdnDescription(room.hostEchoRaceGrant)).map((line, idx) => (
                                <span key={`host-echo-${idx}`} className="block">• {line}</span>
                              ))}
                            </span>
                          )}
                        </>
                      )}
                      {isHost && !room.hostDropGranted && <>Pas de pointeau pour toi sur cette salle.</>}
                      {isGuest && room.guestDropGranted && (
                        <>
                          <span>
                            Pointeau ADN tiré au sort :{' '}
                            <span className="text-emerald-300 font-semibold">
                              {room.guestEchoRaceGrant ?? '—'}
                            </span>{' '}
                            (~{Math.round(COOP_RACE_ECHO_POTENCY * 100)} % du passif d’éveil de cette race).
                            {character?.coopRaceEcho?.race &&
                              character?.coopRaceEchoOffer?.roomId === room.id && (
                                <span className="block mt-1 text-amber-200/90 text-xs">
                                  Tu avais déjà un Pointeau ADN : choisis en haut de page de remplacer ou de le garder.
                                </span>
                              )}
                          </span>
                          {!!room.guestEchoRaceGrant && (
                            <span className="block mt-2 text-[11px] text-stone-400">
                              <span className="text-stone-300">{getPointeauAdnIntensityLabel()}</span>
                              {splitDescriptionLines(buildRacePointeauAdnDescription(room.guestEchoRaceGrant)).map((line, idx) => (
                                <span key={`guest-echo-${idx}`} className="block">• {line}</span>
                              ))}
                            </span>
                          )}
                        </>
                      )}
                      {isGuest && !room.guestDropGranted && <>Pas de pointeau pour toi sur cette salle.</>}
                    </p>
                  )}
                </div>
                )}

                <p className="text-[11px] text-stone-500">
                  Même disposition que l’arène PvP : deux cartes complètes qui changent de côté au tour de chaque
                  joueur. Recalcul local avec le seed de la salle — résultat identique à celui enregistré.
                </p>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate('/dungeons')}
          className="text-sm text-stone-200/80 hover:text-white drop-shadow-sm"
        >
          ← Retour aux donjons
        </button>
        </div>

        {!displayAnimatedReplay && (
          <aside className="hidden xl:flex flex-col items-center flex-shrink-0 w-[min(100%,300px)] sticky top-24 self-start">
            <div className="rounded-xl overflow-hidden border-2 border-red-800/55 shadow-2xl bg-stone-950 ring-1 ring-red-950/40 w-full">
              <img
                src={redTrainerPortraitUrl}
                alt="Red"
                className="w-full h-auto object-cover object-top block max-h-[min(72vh,560px)]"
              />
            </div>
            <p className="text-center text-red-400/95 text-sm font-bold mt-2 tracking-wide drop-shadow-sm">Red</p>
          </aside>
        )}
        </div>
        <audio ref={audioRef} id="coop-red-music" loop preload="auto" playsInline>
          <source src="/assets/music/red.mp3" type="audio/mpeg" />
        </audio>
      </div>
    </div>
  );
}

export default CoopRedDungeon;
