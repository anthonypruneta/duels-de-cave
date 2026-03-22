import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import { getUserCharacter } from '../services/characterService';
import {
  COOP_RED_DIFFICULTY,
  COOP_RED_LEVEL_REQUIRED,
  COOP_RED_MAX_ATTEMPTS_PER_DAY,
  COOP_RED_DROP_RATE,
  COOP_RED_DIFFICULTY_LABELS,
  COOP_RED_DNA_COST_ECHO,
  getCoopRedLineup,
} from '../data/coopRedDungeon';
import { races } from '../data/races';
import {
  createCoopRedRoom,
  joinCoopRedRoom,
  subscribeCoopRedRoom,
  setCoopRedReady,
  startCoopRedCombat,
  submitCoopRedAction,
  getCoopRedAttemptsLeft,
  claimCoopRedDnaIfNeeded,
  purchaseAllyRaceEcho,
} from '../services/coopRedDungeonService';

const RACE_NAMES = Object.keys(races);

const cdKeyForClass = (className) => {
  const m = {
    Guerrier: 'war',
    Voleur: 'rog',
    Paladin: 'pal',
    Healer: 'heal',
    Archer: 'arc',
    Mage: 'mag',
    Demoniste: 'dem',
    Masochiste: 'maso',
    Succube: 'succ',
    Bastion: 'bast',
    Alchimiste: 'alch',
    'Briseur de Sort': 'mag',
  };
  return m[className] || 'war';
};

function CoopRedDungeon() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);
  const [attemptsLeft, setAttemptsLeft] = useState(COOP_RED_MAX_ATTEMPTS_PER_DAY);
  const [difficulty, setDifficulty] = useState(COOP_RED_DIFFICULTY.EASY);
  const [joinCode, setJoinCode] = useState('');
  const [roomId, setRoomId] = useState(() => sessionStorage.getItem('coopRedRoomId') || '');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [echoRacePick, setEchoRacePick] = useState(RACE_NAMES[0] || 'Humain');

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
    if (!roomId) {
      setRoom(null);
      return;
    }
    sessionStorage.setItem('coopRedRoomId', roomId);
    const unsub = subscribeCoopRedRoom(
      roomId,
      (data) => {
        setRoom(data);
        if (data?.status === 'completed' && data?.combat?.winner === 'players' && currentUser) {
          claimCoopRedDnaIfNeeded(roomId, currentUser.uid).then(() => loadCharAndAttempts());
        }
      },
      (e) => console.warn('coop room snap', e)
    );
    return () => unsub();
  }, [roomId, currentUser, loadCharAndAttempts]);

  const isHost = room && currentUser && room.hostId === currentUser.uid;
  const isGuest = room && currentUser && room.guestId === currentUser.uid;
  const inRoom = isHost || isGuest;

  const lineup = useMemo(() => (room ? getCoopRedLineup(room.difficulty) : null), [room]);

  const myCd = useMemo(() => {
    if (!room?.combat) return null;
    return isHost ? room.combat.hostCd : room.combat.guestCd;
  }, [room, isHost]);

  const myClass = character?.class;
  const myCdKey = myClass ? cdKeyForClass(myClass) : 'war';
  const capacityReady = myCd && (myCd[myCdKey] ?? 0) <= 0;

  const handleCreate = async () => {
    setError(null);
    setBusy(true);
    const res = await createCoopRedRoom(currentUser.uid, difficulty);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setRoomId(res.roomId);
  };

  const handleJoin = async () => {
    setError(null);
    setBusy(true);
    const res = await joinCoopRedRoom(currentUser.uid, joinCode);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setRoomId(res.roomId);
  };

  const handleLeaveRoom = () => {
    sessionStorage.removeItem('coopRedRoomId');
    setRoomId('');
    setRoom(null);
  };

  const handleReady = async (ready) => {
    setBusy(true);
    await setCoopRedReady(currentUser.uid, roomId, ready);
    setBusy(false);
  };

  const handleStart = async () => {
    setError(null);
    setBusy(true);
    const res = await startCoopRedCombat(roomId);
    setBusy(false);
    if (!res.success) setError(res.error);
  };

  const handleAction = async (actionType) => {
    setError(null);
    setBusy(true);
    const res = await submitCoopRedAction(roomId, currentUser.uid, actionType);
    setBusy(false);
    if (!res.success) setError(res.error);
  };

  const handlePurchaseEcho = async () => {
    setError(null);
    setBusy(true);
    const res = await purchaseAllyRaceEcho(currentUser.uid, echoRacePick);
    setBusy(false);
    if (!res.success) setError(res.error);
    else await loadCharAndAttempts();
  };

  const level = character?.level ?? 1;
  const dna = Number(character?.dnaFragments) || 0;

  const diffOptions = [
    COOP_RED_DIFFICULTY.EASY,
    COOP_RED_DIFFICULTY.MEDIUM,
    COOP_RED_DIFFICULTY.HARD,
  ];

  return (
    <div className="min-h-screen p-4 md:p-6 bg-stone-950 text-stone-100">
      <Header />
      <div className="max-w-3xl mx-auto pt-20 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-red-400 mb-1">Donjon Rouge (coop async)</h1>
          <p className="text-stone-400 text-sm">
            Deux joueurs, trois adversaires en rotation, ordre des tours selon la VIT. Boss alterne ses cibles.
          </p>
        </div>

        <div className="bg-stone-900/80 border border-stone-700 rounded-xl p-4 flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-amber-400 text-xs font-bold uppercase">Essais restants (Paris)</p>
            <p className="text-2xl font-bold">{attemptsLeft} / {COOP_RED_MAX_ATTEMPTS_PER_DAY}</p>
          </div>
          <div>
            <p className="text-amber-400 text-xs font-bold uppercase">Fragments ADN</p>
            <p className="text-2xl font-bold">{dna}</p>
          </div>
          {character?.allyRaceEcho?.race && (
            <div className="text-right text-sm text-stone-400">
              Écho racial actif : <span className="text-emerald-300">{character.allyRaceEcho.race}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-700/60 text-red-200 text-sm px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        {!inRoom && (
          <>
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
                        Drop {Math.round((COOP_RED_DROP_RATE[d] ?? 0) * 100)} %
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-stone-900/80 border border-stone-700 rounded-xl p-4 space-y-3">
                <h2 className="font-bold text-lg">Créer une salle</h2>
                <button
                  type="button"
                  disabled={busy || attemptsLeft <= 0}
                  onClick={handleCreate}
                  className="w-full py-3 rounded-lg bg-red-700 hover:bg-red-600 font-bold disabled:opacity-40"
                >
                  Générer un code
                </button>
              </div>
              <div className="bg-stone-900/80 border border-stone-700 rounded-xl p-4 space-y-3">
                <h2 className="font-bold text-lg">Rejoindre</h2>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="CODE"
                  className="w-full bg-stone-800 border border-stone-600 rounded-lg px-3 py-2 uppercase tracking-widest text-center"
                />
                <button
                  type="button"
                  disabled={busy || joinCode.length !== 6 || attemptsLeft <= 0}
                  onClick={handleJoin}
                  className="w-full py-3 rounded-lg bg-amber-700 hover:bg-amber-600 font-bold disabled:opacity-40"
                >
                  Rejoindre
                </button>
              </div>
            </div>
          </>
        )}

        {inRoom && room && (
          <div className="bg-stone-900/80 border border-stone-700 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="text-xs text-stone-500">Code salle</p>
                <p className="text-2xl font-mono font-bold tracking-widest text-amber-300">{room.roomCode}</p>
              </div>
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="text-sm text-stone-400 hover:text-white underline"
              >
                Quitter l’affichage (la salle reste en ligne)
              </button>
            </div>

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

            {room.status === 'waiting' && (
              <p className="text-amber-200 text-sm">En attente d’un invité avec le code…</p>
            )}

            {room.status === 'ready' && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3 items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isHost ? !!room.hostReady : !!room.guestReady}
                      onChange={(e) => handleReady(e.target.checked)}
                      disabled={busy}
                    />
                    Prêt
                  </label>
                  {room.hostReady && room.guestReady && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleStart}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-bold"
                    >
                      Lancer le combat (consomme 1 essai chacun)
                    </button>
                  )}
                </div>
              </div>
            )}

            {(room.status === 'in_progress' || room.status === 'completed') && room.combat && (
              <div className="space-y-4 border-t border-stone-700 pt-4">
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
                        return (
                          <div
                            key={b.id}
                            className={`px-2 py-1 rounded border text-xs ${active ? 'border-amber-500 bg-amber-950/40' : 'border-stone-600'}`}
                          >
                            {b.icon} {b.nom} — {hp}/{maxHp}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {room.combat.pendingUserId === currentUser?.uid && room.status === 'in_progress' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAction('auto')}
                      className="px-4 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 font-bold"
                    >
                      Attaque
                    </button>
                    <button
                      type="button"
                      disabled={busy || !capacityReady}
                      onClick={() => handleAction('capacity')}
                      className="px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 font-bold disabled:opacity-40"
                    >
                      Capacité {capacityReady ? '' : `(CD ${myCd?.[myCdKey] ?? '—'})`}
                    </button>
                  </div>
                )}

                {room.combat.pendingUserId && room.combat.pendingUserId !== currentUser?.uid && room.status === 'in_progress' && (
                  <p className="text-amber-200 text-sm">Tour de l’autre joueur — actualisation auto.</p>
                )}

                <div className="max-h-48 overflow-y-auto bg-stone-950/80 rounded-lg p-2 text-xs font-mono text-stone-300 space-y-1">
                  {(room.combat.log || []).slice(-24).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>

                {room.status === 'completed' && (
                  <div className="text-sm space-y-1">
                    {room.combat.winner === 'players' && (
                      <p className="text-emerald-400 font-bold">Victoire !</p>
                    )}
                    {room.combat.winner === 'boss' && (
                      <p className="text-red-400 font-bold">Défaite…</p>
                    )}
                    {room.combat.winner === 'players' && (
                      <p className="text-stone-400">
                        {isHost && room.hostDropGranted && 'Tu as reçu un fragment ADN ! '}
                        {isHost && !room.hostDropGranted && 'Pas de fragment ADN pour toi. '}
                        {isGuest && room.guestDropGranted && 'Tu as reçu un fragment ADN ! '}
                        {isGuest && !room.guestDropGranted && 'Pas de fragment ADN pour toi. '}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-stone-900/80 border border-stone-700 rounded-xl p-4 space-y-3">
          <h2 className="font-bold text-lg text-amber-400">Écho racial (boutique ADN)</h2>
          <p className="text-xs text-stone-400">
            Pour {COOP_RED_DNA_COST_ECHO} fragments, applique un bonus racial réduit ({' '}
            <span className="text-stone-300">25 % des bonus plats</span> de la race choisie) sur tes stats en combat
            (tournoi, donjons, etc.).
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={echoRacePick}
              onChange={(e) => setEchoRacePick(e.target.value)}
              className="bg-stone-800 border border-stone-600 rounded-lg px-2 py-2 text-sm"
            >
              {RACE_NAMES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || dna < COOP_RED_DNA_COST_ECHO}
              onClick={handlePurchaseEcho}
              className="px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 font-bold text-sm disabled:opacity-40"
            >
              Acheter l’écho ({COOP_RED_DNA_COST_ECHO} ADN)
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/dungeons')}
          className="text-sm text-stone-500 hover:text-stone-300"
        >
          ← Retour aux donjons
        </button>
      </div>
    </div>
  );
}

export default CoopRedDungeon;
