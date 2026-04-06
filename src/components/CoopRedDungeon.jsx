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
  COOP_RED_DIFFICULTY_LABELS,
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
import {
  backfillCoopRedMatchHistoryFromRooms,
  ensureCoopRedHistoryEntryFromRoom,
  subscribeCoopRedMatchHistory,
  markCoopRedHistoryMatchViewed,
  setCoopRedHistoryEchoDelivered,
} from '../services/coopRedMatchHistoryService';
import CoopRedAnimatedReplay from './CoopRedAnimatedReplay';
/** Portrait du dresseur Red (remplace `src/assets/coop/red.png` si besoin). */
import redTrainerPortraitUrl from '../assets/coop/Red.png';

const COOP_RED_PAGE_BG = '/assets/backgrounds/red.png';

function coopRedHostRoomStorageKey(uid) {
  return uid ? `coopRedHostRoom:${uid}` : null;
}

function coopRedGuestRoomStorageKey(uid) {
  return uid ? `coopRedGuestRoom:${uid}` : null;
}

/** Salle terminée : récap + récompenses à voir (hôte ou invité), même après reconnexion. */
function coopRedPendingRecapStorageKey(uid) {
  return uid ? `coopRedPendingRecap:${uid}` : null;
}

function clearCoopRedRoomPersistence(uid) {
  if (!uid) return;
  sessionStorage.removeItem('coopRedRoomId');
  const hostKey = coopRedHostRoomStorageKey(uid);
  if (hostKey) localStorage.removeItem(hostKey);
  const guestKey = coopRedGuestRoomStorageKey(uid);
  if (guestKey) localStorage.removeItem(guestKey);
  const pendingKey = coopRedPendingRecapStorageKey(uid);
  if (pendingKey) localStorage.removeItem(pendingKey);
}

function formatCoopRedHistoryDate(completedAt) {
  if (!completedAt) return '—';
  try {
    const d = typeof completedAt.toDate === 'function'
      ? completedAt.toDate()
      : new Date(completedAt);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

/** Libellé Pointeau ADN pour une ligne d’historique (myDropGranted / myEchoRaceGrant). */
function formatCoopRedPointeauLabel(row) {
  if (!row?.myDropGranted) return 'Non';
  return row.myEchoRaceGrant ? `Oui — ${row.myEchoRaceGrant}` : 'Oui';
}

function CoopRedDungeon() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);
  const characterInstanceIdRef = useRef(null);
  const pseudoKeyRef = useRef(null);
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
  const [echoOfferBusy, setEchoOfferBusy] = useState(false);
  const [echoOfferDecision, setEchoOfferDecision] = useState(null);
  const [matchHistory, setMatchHistory] = useState([]);
  const [historyReplayRow, setHistoryReplayRow] = useState(null);
  const [historyClaimBusy, setHistoryClaimBusy] = useState(false);

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

  useEffect(() => {
    characterInstanceIdRef.current = character?.characterInstanceId || null;
  }, [character?.characterInstanceId]);

  useEffect(() => {
    const normalizePseudoKey = (name) => String(name || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 _-]+/g, '')
      .replace(/[ _]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    pseudoKeyRef.current = character?.name ? normalizePseudoKey(character.name) : null;
  }, [character?.name]);

  useEffect(() => {
    const key = pseudoKeyRef.current;
    if (!currentUser?.uid || !key) {
      setMatchHistory([]);
      return undefined;
    }
    const unsub = subscribeCoopRedMatchHistory(
      currentUser.uid,
      key,
      setMatchHistory,
      (e) => console.warn('coop red history', e),
      50
    );
    backfillCoopRedMatchHistoryFromRooms(currentUser.uid, key).catch(() => {});
    return () => unsub();
  }, [currentUser?.uid, character?.name]);

  /** Retrouver l’id de salle : récap en attente (combat fini sans toi), puis session, puis salle hôte. */
  useEffect(() => {
    if (!currentUser?.uid || roomId) return;
    if (skipAutoResumeRef.current) return;
    const pendingKey = coopRedPendingRecapStorageKey(currentUser.uid);
    const pending = pendingKey ? localStorage.getItem(pendingKey) : '';
    const sid = sessionStorage.getItem('coopRedRoomId');
    const key = coopRedHostRoomStorageKey(currentUser.uid);
    const lid = key ? localStorage.getItem(key) : '';
    const gk = coopRedGuestRoomStorageKey(currentUser.uid);
    const gid = gk ? localStorage.getItem(gk) : '';
    const raw = (pending || sid || lid || gid || '').trim();
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
          clearCoopRedRoomPersistence(currentUser?.uid);
          setRoomId('');
          return;
        }
        setRoom(data);
        if (data.status === 'completed' && currentUser?.uid) {
          const uid = currentUser.uid;
          if (data.hostId === uid || data.guestId === uid) {
            const pk = coopRedPendingRecapStorageKey(uid);
            if (pk) localStorage.setItem(pk, data.id);
          }
        }
        if (currentUser?.uid && data.hostId === currentUser.uid) {
          const k = coopRedHostRoomStorageKey(currentUser.uid);
          if (k) localStorage.setItem(k, roomId);
        }
        if (currentUser?.uid && data.guestId === currentUser.uid) {
          const gk = coopRedGuestRoomStorageKey(currentUser.uid);
          if (gk) localStorage.setItem(gk, roomId);
        }
        if (data?.status === 'completed' && data?.combat?.winner && currentUser) {
          const key = pseudoKeyRef.current;
          ensureCoopRedHistoryEntryFromRoom(data, currentUser.uid, key).catch((err) => {
            console.warn('coop red historique — écriture impossible', err);
          });
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
    setShowAnimatedReplay(true);
  }, [room?.id, room?.status, room?.combat]);

  const isHost = room && currentUser && room.hostId === currentUser.uid;
  const isGuest = room && currentUser && room.guestId === currentUser.uid;
  const inRoom = isHost || isGuest;

  /** Id de salle à reprendre (récap terminé, salle hôte ou invité) si pas encore d’abonnement actif. */
  const resumePendingRoomId =
    currentUser?.uid && !roomId
      ? (
          localStorage.getItem(coopRedPendingRecapStorageKey(currentUser.uid))
          || localStorage.getItem(coopRedHostRoomStorageKey(currentUser.uid))
          || localStorage.getItem(coopRedGuestRoomStorageKey(currentUser.uid))
          || ''
        ).trim()
      : '';

  const replayRewardContent = useMemo(() => {
    if (!room?.combat) return null;
    if (room.combat.winner === 'boss') {
      return (
        <div className="bg-stone-950/75 border border-stone-700/80 rounded-xl shadow-lg px-4 py-3 text-sm">
          <p className="text-red-400 font-bold">💀 Défaite…</p>
        </div>
      );
    }
    if (room.combat.winner !== 'players') return null;

    const granted = isHost ? room.hostDropGranted : room.guestDropGranted;
    const grantedRace = isHost ? room.hostEchoRaceGrant : room.guestEchoRaceGrant;

    return (
      <div className="bg-stone-950/75 border border-stone-700/80 rounded-xl shadow-lg px-4 py-3 text-sm space-y-2">
        <p className="text-emerald-400 font-bold">🏆 Victoire !</p>
        {granted ? (
          <div className="text-stone-300 space-y-1">
            <p>
              Pointeau ADN tiré au sort : <span className="text-emerald-300 font-semibold">{grantedRace ?? '—'}</span>
            </p>
            {character?.coopRaceEcho?.race && character?.coopRaceEchoOffer?.roomId === room.id && (
              <div className="mt-2 rounded-lg border border-amber-500/50 bg-amber-950/30 p-3 space-y-2">
                <p className="text-amber-200/90 text-xs">
                  Tu avais déjà un Pointeau ADN : choisis de remplacer ou de garder l’actuel.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={echoOfferBusy}
                    onClick={() => handleResolveEchoOffer(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold border border-emerald-600/60 disabled:opacity-50"
                  >
                    Remplacer par {character.coopRaceEchoOffer.race}
                  </button>
                  <button
                    type="button"
                    disabled={echoOfferBusy}
                    onClick={() => handleResolveEchoOffer(false)}
                    className="px-3 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-100 text-xs font-bold border border-stone-500/60 disabled:opacity-50"
                  >
                    Garder le Pointeau ADN actuel
                  </button>
                </div>
              </div>
            )}
            {!!grantedRace && (
              <div className="mt-2 text-[11px] text-stone-400">
                <span className="text-stone-300">{getPointeauAdnIntensityLabel()}</span>
                {splitDescriptionLines(buildRacePointeauAdnDescription(grantedRace)).map((line, idx) => (
                  <span key={`replay-echo-${idx}`} className="block">• {line}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-stone-400">Pas de pointeau pour toi sur cette salle.</p>
        )}
        {echoOfferDecision?.roomId === room.id && echoOfferDecision.accepted === false && (
          <p className="text-amber-300 text-xs">
            Pointeau refusé : tu as conservé ton Pointeau ADN actuel.
          </p>
        )}
      </div>
    );
  }, [
    room,
    isHost,
    echoOfferBusy,
    character?.coopRaceEcho?.race,
    character?.coopRaceEchoOffer?.roomId,
    character?.coopRaceEchoOffer?.race,
    echoOfferDecision,
  ]);

  const handleCreate = async () => {
    setError(null);
    // On doit avoir un nom (clé pseudo) AVANT de snapshotter le perso dans la salle.
    if (!character?.name) {
      await loadCharAndAttempts();
    }
    if (!pseudoKeyRef.current) {
      setError("Ton personnage n'est pas encore prêt (nom manquant). Recharge la page puis réessaie.");
      return;
    }
    setBusy(true);
    const pk = currentUser?.uid ? coopRedPendingRecapStorageKey(currentUser.uid) : null;
    if (pk) localStorage.removeItem(pk);
    const gkClear = currentUser?.uid ? coopRedGuestRoomStorageKey(currentUser.uid) : null;
    if (gkClear) localStorage.removeItem(gkClear);
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
    // Masquage UI uniquement : on ne “quitte” pas la salle côté Firestore.
    // On conserve donc les clés localStorage pour permettre "Reprendre ma salle".
    sessionStorage.removeItem('coopRedRoomId');
    setRoomId('');
    setRoom(null);
    setShowAnimatedReplay(false);
    autoOpenedReplayRoomRef.current = '';
  };

  const handleJoinListedRoom = async (id) => {
    setError(null);
    if (!character?.name) {
      await loadCharAndAttempts();
    }
    if (!pseudoKeyRef.current) {
      setError("Ton personnage n'est pas encore prêt (nom manquant). Recharge la page puis réessaie.");
      return;
    }
    setBusy(true);
    const attemptsCheck = await getCoopRedAttemptsLeft(currentUser.uid);
    if (!attemptsCheck.success || attemptsCheck.attemptsLeft <= 0) {
      setBusy(false);
      setError('Plus d’essais Red disponibles aujourd’hui — impossible de rejoindre un combat.');
      return;
    }
    const pk = currentUser?.uid ? coopRedPendingRecapStorageKey(currentUser.uid) : null;
    if (pk) localStorage.removeItem(pk);
    const hkClear = currentUser?.uid ? coopRedHostRoomStorageKey(currentUser.uid) : null;
    if (hkClear) localStorage.removeItem(hkClear);
    const res = await joinCoopRedRoom(currentUser.uid, id);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setRoomId(res.roomId);
    const gk = coopRedGuestRoomStorageKey(currentUser.uid);
    if (gk) localStorage.setItem(gk, res.roomId);
  };

  const handleOpenHistoryReplay = useCallback(async (row) => {
    setHistoryReplayRow(row);
    if (!currentUser?.uid) return;
    const key = pseudoKeyRef.current;
    if (!key) return;
    const rid = row?.roomId || row?.id;
    if (!rid) return;
    await markCoopRedHistoryMatchViewed(currentUser.uid, key, rid);
  }, [currentUser?.uid]);

  const handleClaimHistoryEcho = useCallback(async (row) => {
    if (!currentUser?.uid) return;
    const key = pseudoKeyRef.current;
    if (!key) return;
    const rid = row?.roomId || row?.id;
    if (!rid) return;
    setError(null);
    setHistoryClaimBusy(true);
    const res = await claimCoopRedRaceEchoIfNeeded(rid, currentUser.uid);
    setHistoryClaimBusy(false);
    if (!res?.success) {
      setError(res?.error || 'Impossible de récupérer la récompense.');
      return;
    }
    await setCoopRedHistoryEchoDelivered(currentUser.uid, key, rid, true);
    await loadCharAndAttempts();
  }, [currentUser?.uid, loadCharAndAttempts]);

  const handleToggleReady = async (next) => {
    if (!roomId || !currentUser) return;
    if (next && attemptsLeft <= 0) {
      setError('Plus d’essais Red disponibles aujourd’hui — impossible de se mettre prêt.');
      return;
    }
    setReadyBusy(true);
    setError(null);
    const res = await setCoopRedPlayerReady(roomId, currentUser.uid, next);
    setReadyBusy(false);
    if (!res.success) setError(res.error);
  };

  const handleLeaveRoom = () => {
    skipAutoResumeRef.current = false;
    clearCoopRedRoomPersistence(currentUser?.uid);
    setRoomId('');
    setRoom(null);
    setShowAnimatedReplay(false);
    setEchoOfferDecision(null);
    autoOpenedReplayRoomRef.current = '';
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
    setEchoOfferDecision({
      roomId: room?.id ?? null,
      accepted: acceptReplace,
      race: character?.coopRaceEchoOffer?.race ?? null,
    });
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
      <div className="relative z-10 p-4 md:p-6 min-h-screen">
        <Header />
        <div className="mx-auto max-w-[1900px] px-0 pt-14 md:pt-8">
          <button
            type="button"
            onClick={() => navigate('/dungeons')}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-stone-950/80 border border-stone-700/80 text-sm text-stone-200 hover:text-white hover:bg-stone-900/90 shadow-sm"
          >
            ← Retour aux donjons
          </button>
        </div>
        <div
          className={`mx-auto ${isCombatLaunched ? 'pt-2 md:pt-4' : 'pt-8'} px-0 flex flex-col xl:flex-row gap-8 xl:items-start xl:justify-center ${
            displayAnimatedReplay ? 'max-w-[2000px]' : 'max-w-6xl'
          }`}
        >
        <div
          className={`space-y-6 flex-1 min-w-0 w-full ${
            displayAnimatedReplay ? '' : 'max-w-3xl mx-auto xl:mx-0'
          }`}
        >
        {!isCombatLaunched && (
        <div className="text-center rounded-xl border border-stone-700 bg-stone-900/80 p-4">
          <h1 className="text-2xl md:text-3xl font-bold text-red-400 mb-1">L'arène de Red</h1>
          <p className="text-stone-400 text-sm">
            Crée une salle ou choisis-en une dans la liste. Une fois à deux, chacun clique sur{' '}
            <span className="text-stone-300">Prêt</span> : le combat se lance quand les deux sont prêts. Même moteur que
            le tournoi ; seed déterministe. Tu peux quitter la page.
          </p>
        </div>
        )}

        {!isCombatLaunched && (
        <div className="rounded-xl border border-stone-700 bg-stone-900/80 p-4 text-sm space-y-3">
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

        {currentUser && !displayAnimatedReplay && (
          <div className="xl:hidden rounded-xl border border-stone-700 bg-stone-900/80 p-4 space-y-3 w-full max-w-none">
            <h2 className="font-bold text-amber-400 text-xs uppercase tracking-wide">Historique des matchs</h2>
            {matchHistory.length === 0 ? (
              <p className="text-sm text-stone-500">Aucun match enregistré pour l’instant. Les matchs terminés apparaissent ici (replay conservé).</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm text-left min-w-[880px]">
                  <thead>
                    <tr className="text-[11px] uppercase text-stone-500 border-b border-stone-700">
                      <th className="py-2 pr-3 whitespace-nowrap">Date</th>
                      <th className="py-2 pr-3">Difficulté</th>
                      <th className="py-2 pr-3 min-w-[120px]">Allié</th>
                      <th className="py-2 pr-3">Résultat</th>
                      <th className="py-2 pr-3 min-w-[160px]">Pointeau ADN</th>
                      <th className="py-2 pr-2 text-right whitespace-nowrap">Replay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchHistory.map((row) => {
                      const win = row.winner === 'players';
                      const diffLabel = COOP_RED_DIFFICULTY_LABELS[row.difficulty] ?? row.difficulty ?? '—';
                      const pointeau = formatCoopRedPointeauLabel(row);
                      return (
                        <tr
                          key={row.id || row.roomId}
                          className={`border-b border-stone-800/80 text-stone-300 ${row.viewedAt ? '' : 'font-bold text-amber-200/95'}`}
                        >
                          <td className="py-2 pr-3 whitespace-nowrap align-top">{formatCoopRedHistoryDate(row.completedAt)}</td>
                          <td className="py-2 pr-3 align-top">{diffLabel}</td>
                          <td className="py-2 pr-3 align-top max-w-[200px]">
                            <span className="line-clamp-2 break-words" title={row.partnerName ?? ''}>
                              {row.partnerName ?? '—'}
                            </span>
                          </td>
                          <td className={`py-2 pr-3 font-semibold align-top ${win ? 'text-emerald-400' : 'text-red-400'}`}>
                            {win ? 'Victoire' : 'Défaite'}
                          </td>
                          <td
                            className={`py-2 pr-3 align-top text-[13px] ${row.myDropGranted ? 'text-emerald-300' : 'text-stone-500'}`}
                            title={pointeau}
                          >
                            {pointeau}
                          </td>
                          <td className="py-2 text-right align-top whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {row.winner === 'players' && row.myDropGranted && !row.myEchoDelivered && (
                                <button
                                  type="button"
                                  disabled={historyClaimBusy}
                                  onClick={() => handleClaimHistoryEcho(row)}
                                  className="px-3 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold border border-emerald-600/60 disabled:opacity-50"
                                  title="Récupérer le Pointeau ADN (1 fois)"
                                >
                                  Récupérer
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenHistoryReplay(row)}
                                className="px-3 py-1 rounded-lg bg-red-900/80 hover:bg-red-800 text-amber-100 text-xs font-bold border border-red-700/60"
                              >
                                Voir le replay
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!inRoom && (
          <>
            {resumePendingRoomId && (
              <div className="rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-amber-100/95">
                  Tu as une salle ou un récap Red en attente (combat peut s’être terminé pendant ton absence — reprends pour voir le déroulé et les récompenses).
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleResumeHostRoom(resumePendingRoomId)}
                  className="shrink-0 px-4 py-2 rounded-lg bg-red-800 hover:bg-red-700 font-bold text-sm disabled:opacity-40"
                >
                  Reprendre ma salle
                </button>
              </div>
            )}
            <div className="bg-stone-900/80 border border-stone-700 rounded-xl p-4 space-y-2">
              <h2 className="font-bold text-lg text-red-300">Arène de Red</h2>
              <p className="text-xs text-stone-400">
                Donjon coop à 2 joueurs contre une rotation de boss. Les deux joueurs cliquent sur prêt, puis le combat
                se lance automatiquement avec un replay animé et des récompenses en fin de run.
              </p>
            </div>
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
                {attemptsLeft <= 0 && (
                  <p className="text-red-300 text-xs font-semibold">
                    Tu n’as plus d’essais Red aujourd’hui : tu ne peux pas te mettre prêt (l’autre joueur peut l’être s’il lui en reste).
                  </p>
                )}
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
                        disabled={readyBusy || (!room.hostReady && attemptsLeft <= 0)}
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
                        disabled={readyBusy || (!room.guestReady && attemptsLeft <= 0)}
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
              <div className="space-y-4 pt-4">
                {room.combatSeed != null && room.hostSnapshot && room.guestSnapshot && (
                  <div className="space-y-3">
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
                          rewardContent={replayRewardContent}
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleLeaveRoom}
                    className="px-5 py-2.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-100 text-sm font-bold border border-stone-500"
                  >
                    Fermer le récap (retour à la liste)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        </div>

        {!isCombatLaunched && (
          <aside className="hidden xl:flex flex-col items-stretch flex-shrink-0 w-[min(100%,min(480px,44vw))] min-w-[380px] sticky top-24 self-start gap-4">
            <div className="relative rounded-xl overflow-hidden border-2 border-red-800/55 shadow-2xl bg-stone-950 ring-1 ring-red-950/40 w-full">
              <img
                src={redTrainerPortraitUrl}
                alt="Red"
                className="w-full h-auto object-cover object-top block max-h-[min(72vh,560px)]"
              />
              <div className="absolute bottom-0 inset-x-0 bg-black/55 border-t border-red-900/60 py-1.5 text-center">
                <span className="text-red-300 text-lg font-bold tracking-wide">Red</span>
              </div>
            </div>
            {currentUser && (
              <div className="w-full rounded-xl border border-stone-700 bg-stone-900/80 p-3 space-y-2 min-w-0">
                <h2 className="font-bold text-amber-400 text-[10px] uppercase tracking-wide">Historique des matchs</h2>
                {matchHistory.length === 0 ? (
                  <p className="text-xs text-stone-500 leading-snug">
                    Aucun match enregistré. Les matchs terminés apparaissent ici.
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-0.5 max-h-[min(44vh,380px)] overflow-y-auto pr-0.5">
                    <table className="w-full text-[11px] text-left min-w-[340px]">
                      <thead>
                        <tr className="uppercase text-stone-500 border-b border-stone-700">
                          <th className="py-1.5 pr-1.5 whitespace-nowrap">Date</th>
                          <th className="py-1.5 pr-1.5">Diff.</th>
                          <th className="py-1.5 pr-1.5 min-w-[4.5rem]">Allié</th>
                          <th className="py-1.5 pr-1.5">Rés.</th>
                          <th className="py-1.5 pr-1.5 min-w-[5.5rem]">Pointeau</th>
                          <th className="py-1.5 pr-0 text-right whitespace-nowrap">Replay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchHistory.map((row) => {
                          const win = row.winner === 'players';
                          const diffLabel = COOP_RED_DIFFICULTY_LABELS[row.difficulty] ?? row.difficulty ?? '—';
                          const pointeau = formatCoopRedPointeauLabel(row);
                          return (
                            <tr
                              key={row.id || row.roomId}
                              className={`border-b border-stone-800/80 text-stone-300 ${row.viewedAt ? '' : 'font-bold text-amber-200/95'}`}
                            >
                              <td className="py-1.5 pr-1.5 whitespace-nowrap align-top text-[10px]">
                                {formatCoopRedHistoryDate(row.completedAt)}
                              </td>
                              <td className="py-1.5 pr-1.5 align-top">{diffLabel}</td>
                              <td className="py-1.5 pr-1.5 align-top max-w-[100px]">
                                <span className="line-clamp-2 break-words" title={row.partnerName ?? ''}>
                                  {row.partnerName ?? '—'}
                                </span>
                              </td>
                              <td className={`py-1.5 pr-1.5 font-semibold align-top ${win ? 'text-emerald-400' : 'text-red-400'}`}>
                                {win ? 'V' : 'D'}
                              </td>
                              <td
                                className={`py-1.5 pr-1.5 align-top leading-snug ${row.myDropGranted ? 'text-emerald-300' : 'text-stone-500'}`}
                                title={pointeau}
                              >
                                {pointeau}
                              </td>
                              <td className="py-1.5 text-right align-top whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-1">
                                  {row.winner === 'players' && row.myDropGranted && !row.myEchoDelivered && (
                                    <button
                                      type="button"
                                      disabled={historyClaimBusy}
                                      onClick={() => handleClaimHistoryEcho(row)}
                                      className="px-1.5 py-0.5 rounded bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 text-[10px] font-bold border border-emerald-700/60 disabled:opacity-50"
                                      title="Récupérer le Pointeau ADN (1 fois)"
                                    >
                                      Récup.
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenHistoryReplay(row)}
                                    className="px-1.5 py-0.5 rounded bg-red-900/80 hover:bg-red-800 text-amber-100 text-[10px] font-bold border border-red-700/60"
                                  >
                                    Voir
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
        </div>
        <audio ref={audioRef} id="coop-red-music" loop preload="auto" playsInline>
          <source src="/assets/music/red.mp3" type="audio/mpeg" />
        </audio>

        {historyReplayRow &&
          historyReplayRow.hostSnapshot &&
          historyReplayRow.guestSnapshot &&
          historyReplayRow.combatSeed != null && (
            <div
              className="fixed inset-0 z-[220] flex flex-col bg-black/80 backdrop-blur-sm p-3 pt-5 md:p-6 md:pt-8 overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Replay historique Red"
            >
              <div className="max-w-[2000px] w-full mx-auto flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <p className="text-stone-200 text-sm font-semibold">
                    Replay — {formatCoopRedHistoryDate(historyReplayRow.completedAt)} ·{' '}
                    {COOP_RED_DIFFICULTY_LABELS[historyReplayRow.difficulty] ?? historyReplayRow.difficulty} · avec{' '}
                    <span className="text-amber-200">{historyReplayRow.partnerName}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setHistoryReplayRow(null)}
                    className="px-4 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-white text-sm font-bold border border-stone-500"
                  >
                    Fermer
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-stone-600 bg-stone-950/90 p-2">
                  <CoopRedAnimatedReplay
                    key={`hist-${historyReplayRow.id}-${historyReplayRow.combatSeed}`}
                    hostSnap={historyReplayRow.hostSnapshot}
                    guestSnap={historyReplayRow.guestSnapshot}
                    difficulty={historyReplayRow.difficulty}
                    combatSeed={historyReplayRow.combatSeed}
                    logTitle="🔴 Red — replay (historique)"
                    wrapperClassName="mt-0"
                    onReplayError={(msg) => setError(msg)}
                    rewardContent={
                      historyReplayRow.winner === 'players' ? (
                        <div className="bg-stone-950/75 border border-stone-700/80 rounded-xl shadow-lg px-4 py-3 text-sm space-y-1">
                          <p className="text-emerald-400 font-bold">Récompenses (à ce match)</p>
                          {historyReplayRow.myDropGranted ? (
                                  <div className="space-y-2">
                                    <p className="text-stone-300">
                                      Pointeau ADN :{' '}
                                      <span className="text-emerald-300 font-semibold">
                                        {historyReplayRow.myEchoRaceGrant ?? '—'}
                                      </span>
                                    </p>
                                    {!historyReplayRow.myEchoDelivered && (
                                      <button
                                        type="button"
                                        disabled={historyClaimBusy}
                                        onClick={() => handleClaimHistoryEcho(historyReplayRow)}
                                        className="px-3 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold border border-emerald-600/60 disabled:opacity-50"
                                      >
                                        Récupérer la récompense (1 fois)
                                      </button>
                                    )}
                                  </div>
                          ) : (
                            <p className="text-stone-400">Pas de pointeau pour toi sur ce tirage.</p>
                          )}
                        </div>
                      ) : null
                    }
                  />
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

export default CoopRedDungeon;
