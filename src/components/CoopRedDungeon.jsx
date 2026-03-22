import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  getCoopRedLineup,
} from '../data/coopRedDungeon';
import {
  createCoopRedRoom,
  joinCoopRedRoom,
  subscribeCoopRedRoom,
  runCoopRedAutoSimulation,
  getCoopRedAttemptsLeft,
  claimCoopRedRewardIfNeeded,
} from '../services/coopRedDungeonService';
import CoopRedAnimatedReplay from './CoopRedAnimatedReplay';

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
  const [simRunning, setSimRunning] = useState(false);
  const simRunningRef = useRef(false);
  const [showAnimatedReplay, setShowAnimatedReplay] = useState(false);

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
          claimCoopRedRewardIfNeeded(roomId, currentUser.uid).then(() => loadCharAndAttempts());
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

    const needSim =
      (room.status === 'ready' && room.attemptsConsumed !== true) ||
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
    room?.attemptsConsumed,
    room?.combat?.winner,
    room?.hostSnapshot,
    room?.guestSnapshot,
  ]);

  const isHost = room && currentUser && room.hostId === currentUser.uid;
  const isGuest = room && currentUser && room.guestId === currentUser.uid;
  const inRoom = isHost || isGuest;

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
    setShowAnimatedReplay(false);
  };

  const level = character?.level ?? 1;

  const diffOptions = [
    COOP_RED_DIFFICULTY.EASY,
    COOP_RED_DIFFICULTY.MEDIUM,
    COOP_RED_DIFFICULTY.HARD,
  ];

  return (
    <div className="min-h-screen p-4 md:p-6 bg-stone-950 text-stone-100">
      <Header />
      <div
        className={`mx-auto pt-20 space-y-6 px-0 ${showAnimatedReplay ? 'max-w-[1800px]' : 'max-w-3xl'}`}
      >
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-red-400 mb-1">Donjon Red (coop)</h1>
          <p className="text-stone-400 text-sm">
            Dès que les deux joueurs sont inscrits, le combat est simulé jusqu’au bout avec le{' '}
            <span className="text-stone-300">même moteur que le tournoi</span> (armes légendaires, passifs, sous-classes,
            etc.). Tirage déterministe (seed) : même résultat pour tout le monde. Tu peux quitter la page.
          </p>
        </div>

        <div className="rounded-xl border border-amber-900/40 bg-stone-900/60 p-4 text-sm space-y-3">
          <h2 className="font-bold text-amber-400 text-xs uppercase tracking-wide">
            Récompenses Red : pointeau & écho de l’allié
          </h2>
          <ul className="space-y-2 text-stone-400 leading-relaxed">
            <li>
              <span className="text-stone-200 font-semibold">Pendant le combat Red</span> — Chacun profite déjà sur sa
              base de <span className="text-stone-300">25 % des bonus plats de la race du coéquipier</span> (allié =
              invité ou hôte selon ton rôle).
            </li>
            <li>
              <span className="text-stone-200 font-semibold">Après une victoire</span> — Chaque joueur a un{' '}
              <span className="text-stone-300">tirage séparé</span> (pointeau). S’il réussit, la{' '}
              <span className="text-stone-300">race de ton allié sur cette salle</span> est enregistrée sur ton
              personnage comme <span className="text-stone-300">écho racial</span> : dans les autres modes (tournoi,
              donjons solo, etc.), tes stats de base reçoivent encore <span className="text-stone-300">25 % des bonus plats</span>{' '}
              de cette race (valeurs numériques seulement, pas les passifs spéciaux type crit ou régén). Une nouvelle
              victoire avec pointeau <span className="text-stone-300">remplace</span> l’écho par la race du nouvel allié.
            </li>
            <li>
              Chances de pointeau selon la difficulté de la salle — Facile{' '}
              {Math.round(COOP_RED_DROP_RATE[COOP_RED_DIFFICULTY.EASY] * 100)} %, Moyen{' '}
              {Math.round(COOP_RED_DROP_RATE[COOP_RED_DIFFICULTY.MEDIUM] * 100)} %, Difficile{' '}
              {Math.round(COOP_RED_DROP_RATE[COOP_RED_DIFFICULTY.HARD] * 100)} %. Rien en défaite.
            </li>
          </ul>
        </div>

        <div className="bg-stone-900/80 border border-stone-700 rounded-xl p-4 flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-amber-400 text-xs font-bold uppercase">Essais restants (Paris)</p>
            <p className="text-2xl font-bold">{attemptsLeft} / {COOP_RED_MAX_ATTEMPTS_PER_DAY}</p>
          </div>
          {character?.allyRaceEcho?.race && (
            <div className="text-right text-sm text-stone-400 max-w-xs">
              <p className="text-amber-400 text-xs font-bold uppercase mb-1">Écho racial enregistré</p>
              <span className="text-emerald-300 font-semibold">{character.allyRaceEcho.race}</span>
              <p className="text-[11px] text-stone-500 mt-1">
                Bonus permanent (hors Red) : 25 % des stats plates de cette race.
              </p>
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
                Quitter l’affichage
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
              <p className="text-amber-200 text-sm">
                En attente d’un invité avec le code… Tu peux quitter : reviens plus tard avec le même code ou la même session.
              </p>
            )}

            {room.status === 'failed_no_attempts' && (
              <p className="text-red-300 text-sm">
                Impossible de lancer le combat : au moins un joueur n’avait plus d’essais. Crée une nouvelle salle.
              </p>
            )}

            {(room.status === 'ready' || room.status === 'simulating' || simRunning) &&
              room.guestId &&
              !room.combat?.winner && (
                <div className="rounded-lg border border-amber-600/50 bg-amber-950/30 px-3 py-2 text-amber-100 text-sm">
                  {room.status === 'simulating' || simRunning
                    ? 'Simulation (moteur tournoi) en cours…'
                    : 'Les deux joueurs sont inscrits — lancement automatique du combat.'}
                </div>
              )}

            {room.status === 'completed' && room.combat && (
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

                <p className="text-xs text-stone-500">
                  Résolution : moteur tournoi complet (2 cibles joueurs, boss actif en rotation). Logs = règles PvP
                  habituelles.
                </p>

                <div className="max-h-64 overflow-y-auto bg-stone-950/80 rounded-lg p-2 text-xs font-mono text-stone-300 space-y-1">
                  {(room.combat.log || []).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>

                <div className="text-sm space-y-1">
                  {room.combat.winner === 'players' && (
                    <p className="text-emerald-400 font-bold">Victoire !</p>
                  )}
                  {room.combat.winner === 'boss' && (
                    <p className="text-red-400 font-bold">Défaite…</p>
                  )}
                  {room.combat.winner === 'players' && (
                    <p className="text-stone-400">
                      {isHost && room.hostDropGranted && (
                        <>
                          Pointeau obtenu : l’écho racial de{' '}
                          <span className="text-emerald-300">{room.guestSnapshot?.name}</span> (
                          {room.guestSnapshot?.race}) est enregistré sur ton personnage (25 % des bonus plats de cette
                          race en dehors de Red).
                        </>
                      )}
                      {isHost && !room.hostDropGranted && <>Pas de pointeau : l’écho de ton allié n’a pas été gravé.</>}
                      {isGuest && room.guestDropGranted && (
                        <>
                          Pointeau obtenu : l’écho racial de{' '}
                          <span className="text-emerald-300">{room.hostSnapshot?.name}</span> ({room.hostSnapshot?.race})
                          est enregistré sur ton personnage (25 % des bonus plats de cette race en dehors de Red).
                        </>
                      )}
                      {isGuest && !room.guestDropGranted && <>Pas de pointeau : l’écho de ton allié n’a pas été gravé.</>}
                    </p>
                  )}
                </div>

                {room.combatSeed != null && room.hostSnapshot && room.guestSnapshot && (
                  <div className="border-t border-stone-700 pt-4 space-y-3">
                    <button
                      type="button"
                      onClick={() => setShowAnimatedReplay((v) => !v)}
                      className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-800/80 hover:bg-amber-700 text-white text-sm font-bold border border-amber-600/60"
                    >
                      {showAnimatedReplay
                        ? 'Masquer le déroulé animé'
                        : 'Voir le déroulé animé (même UI que le combat)'}
                    </button>
                    <p className="text-[11px] text-stone-500">
                      Même disposition que l’arène PvP : deux cartes complètes qui changent de côté au tour de chaque
                      joueur. Recalcul local avec le seed de la salle — résultat identique à celui enregistré.
                    </p>
                    {showAnimatedReplay && (
                      <CoopRedAnimatedReplay
                        key={`${room.roomCode}-${room.combatSeed}`}
                        hostSnap={room.hostSnapshot}
                        guestSnap={room.guestSnapshot}
                        difficulty={room.difficulty}
                        combatSeed={room.combatSeed}
                        logTitle="🔴 Red — ton combat"
                        wrapperClassName="mt-2 border border-amber-900/50 rounded-lg p-3 md:p-4 bg-stone-950/70"
                        onReplayError={(msg) => setError(msg)}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
