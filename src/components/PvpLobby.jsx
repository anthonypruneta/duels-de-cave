import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import { getOwnerPseudoFromAccount } from '../services/characterService';
import { getArchivedCharacters } from '../services/tournamentService';
import { getWeaponById } from '../data/weapons';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import CharacterCardContent from './CharacterCardContent';
import { preparerCombattant } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { races } from '../data/races';
import { formatCombatLogMessage } from '../utils/combatLogFormat';
import {
  createPvpLobbyRoom,
  enterPvpMatchmaking,
  joinPvpLobbyRoomAsGuest,
  subscribePvpLobbyRoom,
  subscribeOpenPvpLobbyRooms,
  setPvpLobbyGuestReady,
  leavePvpLobbyRoomAsGuest,
  deletePvpLobbyRoom,
  runPvpLobbySimulation,
  fetchPvpDuelStatsForUserCharacters,
  applyMyPvpDuelStatsFromRoom,
  migrateLegacyPvpStatsToLeaderboardDocs,
  syncPvpLeaderboardEntriesForUser,
  isCharacterEligibleForPvpLobby,
  getPvpLobbyMaxLevel,
} from '../services/pvpLobbyService';

const SESSION_KEY = 'pvpLobbyRoomId';

function PvpLobby() {
  const { currentUser } = useAuth();
  const [archivedChars, setArchivedChars] = useState([]);
  /** Nombre d’archivés chargés avant filtre niveau PvP (message si tous exclus). */
  const [totalArchivedCount, setTotalArchivedCount] = useState(0);
  const [loadingArchived, setLoadingArchived] = useState(true);
  const [roomId, setRoomId] = useState(() => sessionStorage.getItem(SESSION_KEY) || '');
  const [room, setRoom] = useState(null);
  const [openRooms, setOpenRooms] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [readyBusy, setReadyBusy] = useState(false);

  const [createPassword, setCreatePassword] = useState('');
  const [createSelected, setCreateSelected] = useState(null);
  const [matchmakingSelected, setMatchmakingSelected] = useState(null);
  const [joinRoomIdInput, setJoinRoomIdInput] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinSelected, setJoinSelected] = useState(null);

  const [player1, setPlayer1] = useState(null);
  const [player2, setPlayer2] = useState(null);
  const [p1CombatBase, setP1CombatBase] = useState(null);
  const [p2CombatBase, setP2CombatBase] = useState(null);
  const [p1CombatModifiers, setP1CombatModifiers] = useState(null);
  const [p2CombatModifiers, setP2CombatModifiers] = useState(null);
  const [p1CombatStatus, setP1CombatStatus] = useState(null);
  const [p2CombatStatus, setP2CombatStatus] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [winner, setWinner] = useState(null);
  const [replayPhase, setReplayPhase] = useState(false);

  const simRunningRef = useRef(false);
  const logContainerRef = useRef(null);
  const logEndRef = useRef(null);
  const replayGuardRef = useRef({ roomId: null, done: false });

  const loadArchived = useCallback(async () => {
    if (!currentUser) return;
    setLoadingArchived(true);
    const result = await getArchivedCharacters(currentUser.uid);
    if (result.success && Array.isArray(result.data)) {
      const sorted = [...result.data].sort((a, b) => {
        const aTs = a.archivedAt?.toMillis?.() || 0;
        const bTs = b.archivedAt?.toMillis?.() || 0;
        return bTs - aTs;
      });
      const enriched = sorted.map((char) => {
        const copy = { ...char };
        if (copy.equippedWeaponId && !copy.equippedWeaponData) {
          copy.equippedWeaponData = getWeaponById(copy.equippedWeaponId);
        }
        return normalizeCharacterBonuses(copy);
      });
      const pseudoRes = await getOwnerPseudoFromAccount(currentUser.uid);
      const ownerPseudo = pseudoRes.success ? pseudoRes.ownerPseudo || 'Joueur' : 'Joueur';
      await migrateLegacyPvpStatsToLeaderboardDocs(
        currentUser.uid,
        enriched.map((c) => ({ id: c.id, name: c.name })),
        ownerPseudo
      );
      await syncPvpLeaderboardEntriesForUser(currentUser.uid);
      const ids = enriched.map((c) => c.id).filter(Boolean);
      const statsRes = await fetchPvpDuelStatsForUserCharacters(currentUser.uid, ids);
      const statsMap = statsRes.success ? statsRes.data : {};
      const withStats = enriched.map((c) => ({
        ...c,
        pvpDuelStats: statsMap[c.id] || { wins: 0, losses: 0 },
      }));
      setTotalArchivedCount(withStats.length);
      setArchivedChars(withStats.filter(isCharacterEligibleForPvpLobby));
    } else {
      setArchivedChars([]);
      setTotalArchivedCount(0);
    }
    setLoadingArchived(false);
  }, [currentUser]);

  useEffect(() => {
    loadArchived();
  }, [loadArchived]);

  useEffect(() => {
    const unsub = subscribeOpenPvpLobbyRooms(setOpenRooms, (e) =>
      console.warn('pvp open rooms', e)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!roomId.trim()) {
      setRoom(null);
      return undefined;
    }
    const unsub = subscribePvpLobbyRoom(
      roomId.trim(),
      (data) => {
        setRoom(data);
        if (!data) {
          sessionStorage.removeItem(SESSION_KEY);
          setRoomId('');
        }
      },
      (e) => console.warn('pvp room snap', e)
    );
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !room || !currentUser) return;
    if (room.status !== 'lobby') return;
    if (!room.guestId || !room.hostSnapshot || !room.guestSnapshot) return;
    if (!room.hostReady || !room.guestReady) return;
    if (simRunningRef.current) return;

    simRunningRef.current = true;
    runPvpLobbySimulation(roomId.trim())
      .then((res) => {
        if (!res.success && res.error) setError(res.error);
      })
      .finally(() => {
        simRunningRef.current = false;
      });
  }, [
    roomId,
    currentUser,
    room?.status,
    room?.guestId,
    room?.hostReady,
    room?.guestReady,
    room?.hostSnapshot,
    room?.guestSnapshot,
  ]);

  useEffect(() => {
    if (!room?.id || room.status !== 'completed' || !currentUser?.uid) return;
    if (room.pvpDuelStatsSchemaVersion !== 1) return;
    if (room.combat?.winnerSlot == null && !room.combat?.winnerNom) return;
    let cancelled = false;
    applyMyPvpDuelStatsFromRoom(room.id, currentUser.uid).then((res) => {
      if (cancelled || !res.success) return;
      loadArchived();
    });
    return () => {
      cancelled = true;
    };
  }, [
    room?.id,
    room?.status,
    room?.combat?.winnerSlot,
    room?.combat?.winnerNom,
    room?.pvpDuelStatsSchemaVersion,
    room?.hostDuelStatsApplied,
    room?.guestDuelStatsApplied,
    currentUser?.uid,
    loadArchived,
  ]);

  useEffect(() => {
    if (!room?.id || room.status !== 'completed' || !room.combat?.steps?.length) {
      return undefined;
    }
    if (replayGuardRef.current.roomId !== room.id) {
      replayGuardRef.current = { roomId: room.id, done: false };
    }
    if (replayGuardRef.current.done) return undefined;

    replayGuardRef.current.done = true;
    let cancelled = false;

    const play = async () => {
      const p1 = preparerCombattant(room.hostSnapshot);
      const p2 = preparerCombattant(room.guestSnapshot);
      if (cancelled) return;
      setPlayer1(p1);
      setPlayer2(p2);
      setP1CombatBase(null);
      setP2CombatBase(null);
      setP1CombatModifiers(null);
      setP2CombatModifiers(null);
      setP1CombatStatus(null);
      setP2CombatStatus(null);
      setCombatLog([]);
      setWinner(null);
      setReplayPhase(true);

      const combatMusic = document.getElementById('pvp-combat-music');
      const victoryMusic = document.getElementById('pvp-victory-music');
      if (combatMusic) {
        combatMusic.currentTime = 0;
        combatMusic.play().catch(() => {});
      }

      await replayCombatSteps(room.combat.steps, {
        setCombatLog,
        onStepHP: (step) => {
          setP1CombatBase(step.p1Base ?? undefined);
          setP2CombatBase(step.p2Base ?? undefined);
          setP1CombatModifiers(step.p1Modifiers ?? null);
          setP2CombatModifiers(step.p2Modifiers ?? null);
          setP1CombatStatus(step.p1Status ?? null);
          setP2CombatStatus(step.p2Status ?? null);
          setPlayer1((prev) =>
            prev ? { ...prev, currentHP: step.p1HP, shield: step.p1Shield || 0 } : prev
          );
          setPlayer2((prev) =>
            prev ? { ...prev, currentHP: step.p2HP, shield: step.p2Shield || 0 } : prev
          );
        },
        speed: 'normal',
      });

      if (cancelled) return;
      setWinner(room.combat.winnerNom || null);
      if (combatMusic) combatMusic.pause();
      if (victoryMusic) {
        victoryMusic.currentTime = 0;
        victoryMusic.play().catch(() => {});
      }
    };

    play();
    return () => {
      cancelled = true;
    };
  }, [room?.id, room?.status, room?.combat, room?.hostSnapshot, room?.guestSnapshot]);

  useEffect(() => {
    if (!replayPhase || !logContainerRef.current) return;
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [combatLog, replayPhase]);

  const isHost = room && currentUser && room.hostId === currentUser.uid;
  const isGuest = room && currentUser && room.guestId === currentUser.uid;
  const inRoom = isHost || isGuest;

  const persistRoom = (id) => {
    const t = String(id || '').trim();
    setRoomId(t);
    if (t) sessionStorage.setItem(SESSION_KEY, t);
    else sessionStorage.removeItem(SESSION_KEY);
  };

  const handleCreateRoom = async () => {
    setError(null);
    if (!createSelected) {
      setError('Choisis un personnage archivé.');
      return;
    }
    setBusy(true);
    const res = await createPvpLobbyRoom(currentUser.uid, {
      password: createPassword,
      character: createSelected,
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error || 'Erreur');
      return;
    }
    persistRoom(res.roomId);
    setCreatePassword('');
    setCreateSelected(null);
  };

  const handleMatchmaking = async () => {
    setError(null);
    if (!matchmakingSelected) {
      setError('Choisis un personnage archivé pour le matchmaking.');
      return;
    }
    setBusy(true);
    const res = await enterPvpMatchmaking(currentUser.uid, matchmakingSelected);
    setBusy(false);
    if (!res.success) {
      setError(res.error || 'Erreur matchmaking');
      return;
    }
    persistRoom(res.roomId);
    setMatchmakingSelected(null);
  };

  const handleJoinRoom = async () => {
    setError(null);
    const id = joinRoomIdInput.trim() || roomId.trim();
    if (!id) {
      setError('Indique l’identifiant de la salle.');
      return;
    }
    if (!joinSelected) {
      setError('Choisis ton personnage archivé.');
      return;
    }
    setBusy(true);
    const res = await joinPvpLobbyRoomAsGuest(
      currentUser.uid,
      id,
      joinPassword,
      joinSelected
    );
    setBusy(false);
    if (!res.success) {
      setError(res.error || 'Erreur');
      return;
    }
    persistRoom(res.roomId);
    setJoinPassword('');
    setJoinSelected(null);
    setJoinRoomIdInput('');
  };

  const handleGuestReady = async (ready) => {
    if (!roomId || !isGuest) return;
    setReadyBusy(true);
    setError(null);
    const res = await setPvpLobbyGuestReady(roomId.trim(), currentUser.uid, ready);
    setReadyBusy(false);
    if (!res.success) setError(res.error || 'Erreur');
  };

  const handleLeaveGuest = async () => {
    if (!roomId || !isGuest) return;
    setBusy(true);
    await leavePvpLobbyRoomAsGuest(roomId.trim(), currentUser.uid);
    setBusy(false);
    persistRoom('');
    replayGuardRef.current = { roomId: null, done: false };
    setReplayPhase(false);
    setPlayer1(null);
    setPlayer2(null);
    setCombatLog([]);
    setWinner(null);
  };

  const handleDeleteHost = async () => {
    if (!roomId || !isHost) return;
    setBusy(true);
    const res = await deletePvpLobbyRoom(roomId.trim(), currentUser.uid);
    setBusy(false);
    if (!res.success) {
      setError(res.error || 'Erreur');
      return;
    }
    persistRoom('');
    replayGuardRef.current = { roomId: null, done: false };
    setReplayPhase(false);
    setPlayer1(null);
    setPlayer2(null);
    setCombatLog([]);
    setWinner(null);
  };

  const handleQuitAfterReplay = () => {
    persistRoom('');
    replayGuardRef.current = { roomId: null, done: false };
    setReplayPhase(false);
    setPlayer1(null);
    setPlayer2(null);
    setCombatLog([]);
    setWinner(null);
    const combatMusic = document.getElementById('pvp-combat-music');
    const victoryMusic = document.getElementById('pvp-victory-music');
    if (combatMusic) combatMusic.pause();
    if (victoryMusic) victoryMusic.pause();
  };

  const copyRoomId = () => {
    if (!roomId) return;
    navigator.clipboard?.writeText(roomId).catch(() => {});
  };

  const renderLeaderboardEncadre = () => (
    <div className="rounded-xl border-2 border-amber-600/55 bg-stone-950/90 p-4 shadow-lg ring-1 ring-amber-900/30">
      <p className="text-center text-amber-200/90 text-xs font-bold uppercase tracking-widest mb-3">
        🏆 Classement duels PvP
      </p>
      <Link
        to="/pvp-classement"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/60 bg-amber-500/15 px-4 py-3 text-center text-sm font-bold text-amber-100 transition hover:bg-amber-500/25 hover:border-amber-400"
      >
        Ouvrir le classement
      </Link>
      <p className="mt-2 text-center text-[11px] text-stone-500">
        Victoires / défaites lobby · archivés niveau ≤ {getPvpLobbyMaxLevel()}
      </p>
    </div>
  );

  const renderCharPicker = (selected, onSelect, label) => (
    <div className="bg-stone-800/90 border border-stone-600 rounded-xl p-4">
      <h3 className="text-lg font-bold text-amber-300 mb-3">{label}</h3>
      {loadingArchived ? (
        <p className="text-stone-400">Chargement…</p>
      ) : archivedChars.length === 0 ? (
        <p className="text-stone-400 text-sm">
          {totalArchivedCount > 0 ? (
            <>
              Tes archivés sont tous au-delà du niveau {getPvpLobbyMaxLevel()} : ils ne sont pas
              utilisables en PvP lobby.
            </>
          ) : (
            <>
              Aucun personnage archivé (tournoi). Les anciens persos apparaissent après archivage
              tournoi.
            </>
          )}
        </p>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-2">
          {archivedChars.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className={`w-full flex items-center gap-3 p-2 rounded-lg border text-left transition ${
                selected?.id === c.id
                  ? 'border-amber-500 bg-amber-950/40'
                  : 'border-stone-600 bg-stone-900/50 hover:border-stone-500'
              }`}
            >
              {c.characterImage ? (
                <img src={c.characterImage} alt="" className="w-10 h-10 object-cover rounded" />
              ) : (
                <span className="text-2xl">{races[c.race]?.icon || '❓'}</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-white text-sm">{c.name}</div>
                <div className="text-xs text-stone-400">
                  {c.race} • {c.class} • Niv.{c.level ?? 1}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  Duels PvP :{' '}
                  <span className="text-emerald-400 font-semibold">{c.pvpDuelStats?.wins ?? 0}V</span>
                  {' · '}
                  <span className="text-rose-400 font-semibold">{c.pvpDuelStats?.losses ?? 0}D</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (replayPhase && player1 && player2 && room?.combat) {
    const p1Name = player1?.name ?? '';
    const p2Name = player2?.name ?? '';

    return (
      <div className="min-h-screen p-4 md:p-6">
        <Header />
        <audio id="pvp-combat-music" loop>
          <source src="/assets/music/combat.mp3" type="audio/mpeg" />
        </audio>
        <audio id="pvp-victory-music">
          <source src="/assets/music/victory.mp3" type="audio/mpeg" />
        </audio>

        <div className="max-w-[1800px] mx-auto pt-20">
          <div className="text-center mb-5">
            <h1 className="text-2xl md:text-3xl font-bold text-amber-400">⚔️ Duel PvP</h1>
          </div>

          {/* Même grille que Tournament.jsx → renderCombatUI */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
            <div className="order-1 md:order-1 w-full md:w-[340px] lg:w-auto md:flex-shrink-0">
              <CharacterCardContent
                character={player1}
                showHpBar
                currentHP={player1.currentHP}
                maxHP={player1.maxHP}
                shield={player1.shield ?? 0}
                nameOverride={p1Name}
                combatBaseOverride={p1CombatBase}
                combatModifiers={p1CombatModifiers}
                opponent={player2}
                combatStatus={p1CombatStatus}
                detailsPlacement="left"
                borderId={player1?.equippedBorder ?? null}
              />
            </div>

            <div className="order-2 md:order-2 w-full md:w-[600px] lg:w-[500px] lg:flex-1 lg:min-w-[400px] md:flex-shrink-0 lg:flex-shrink flex flex-col">
              {winner && (
                <div className="flex justify-center mb-3">
                  <div className="bg-amber-500/10 border border-amber-500/60 text-amber-200 px-6 py-2.5 font-bold text-lg rounded-lg animate-pulse">
                    🏆 {winner} remporte le combat !
                  </div>
                </div>
              )}

              <div
                className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-lg flex flex-col overflow-hidden"
                style={{ height: 'clamp(260px, 55dvh, 600px)' }}
              >
                <div className="p-3 border-b border-stone-700/60">
                  <h2 className="text-sm font-bold text-stone-300 text-center uppercase tracking-wider">
                    ⚔️ Replay
                  </h2>
                </div>
                <div
                  ref={logContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-transparent"
                >
                  {combatLog.length === 0 && !winner ? (
                    <p className="text-stone-600 italic text-center py-8 text-sm">
                      En attente du combat...
                    </p>
                  ) : (
                    <>
                      {combatLog.map((log, idx) => {
                        const isP1 = log.startsWith('[P1]');
                        const isP2 = log.startsWith('[P2]');
                        const cleanLog = log.replace(/^\[P[12]\]\s*/, '');

                        if (!isP1 && !isP2) {
                          if (log.includes('🏆')) {
                            return (
                              <div key={idx} className="flex justify-center my-3">
                                <div className="bg-amber-500/10 border border-amber-500/50 text-amber-200 px-5 py-2 font-bold text-sm rounded-lg">
                                  {cleanLog}
                                </div>
                              </div>
                            );
                          }
                          if (log.includes('---')) {
                            return (
                              <div key={idx} className="flex justify-center my-2">
                                <div className="bg-stone-800/80 text-stone-400 px-4 py-1 text-xs font-bold rounded-md border border-stone-700/50">
                                  {cleanLog}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={idx} className="flex justify-center">
                              <div className="text-stone-500 text-xs italic">{cleanLog}</div>
                            </div>
                          );
                        }

                        if (isP1) {
                          return (
                            <div key={idx} className="flex justify-start">
                              <div className="max-w-[80%]">
                                <div className="bg-stone-800/80 text-stone-200 px-3 py-2 rounded-r-lg rounded-tl-lg border-l-2 border-blue-500/70">
                                  <div className="text-xs md:text-sm">
                                    {formatCombatLogMessage(cleanLog, p1Name, p2Name)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={idx} className="flex justify-end">
                            <div className="max-w-[80%]">
                              <div className="bg-stone-800/80 text-stone-200 px-3 py-2 rounded-l-lg rounded-tr-lg border-r-2 border-purple-500/70">
                                <div className="text-xs md:text-sm">
                                  {formatCombatLogMessage(cleanLog, p1Name, p2Name)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={logEndRef} />
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleQuitAfterReplay}
                className="mt-6 mx-auto block bg-stone-800 hover:bg-stone-700 text-stone-200 px-6 py-2 rounded-lg transition border border-stone-600"
              >
                Retour au menu PvP
              </button>
            </div>

            <div className="order-3 md:order-3 w-full md:w-[340px] lg:w-auto md:flex-shrink-0">
              <CharacterCardContent
                character={player2}
                showHpBar
                currentHP={player2.currentHP}
                maxHP={player2.maxHP}
                shield={player2.shield ?? 0}
                nameOverride={p2Name}
                combatBaseOverride={p2CombatBase}
                combatModifiers={p2CombatModifiers}
                opponent={player1}
                combatStatus={p2CombatStatus}
                detailsPlacement="right"
                borderId={player2?.equippedBorder ?? null}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const mainMaxWidth =
    inRoom && room && !replayPhase ? 'max-w-[min(90rem,calc(100vw-1.5rem))]' : 'max-w-6xl';

  return (
    <div className="min-h-screen p-4 md:p-6">
      <Header />
      <div className={`${mainMaxWidth} mx-auto pt-20 space-y-6`}>
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-amber-400">⚔️ PvP — Lobby</h1>
          <p className="text-stone-400 text-sm max-w-xl mx-auto">
            Uniquement des personnages archivés (tournoi), pas ton personnage actif. Niveau max
            en PvP : {getPvpLobbyMaxLevel()}.
          </p>
          {!inRoom && <div className="max-w-md mx-auto">{renderLeaderboardEncadre()}</div>}
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {!inRoom && (
          <>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-stone-900/80 border border-cyan-700/50 rounded-xl p-5 space-y-4 ring-1 ring-cyan-900/20">
                <h2 className="text-xl font-bold text-cyan-200">Matchmaking</h2>
                <p className="text-stone-400 text-sm">
                  Cherche une salle d’attente existante ou en crée une. Dès qu’un adversaire rejoint, vous
                  passez en lobby comme d’habitude.
                </p>
                {renderCharPicker(
                  matchmakingSelected,
                  setMatchmakingSelected,
                  'Ton combattant archivé'
                )}
                <button
                  type="button"
                  disabled={busy || !matchmakingSelected}
                  onClick={handleMatchmaking}
                  className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg border border-cyan-500/60"
                >
                  {busy ? 'Recherche…' : 'Lancer le matchmaking'}
                </button>
              </div>

              <div className="bg-stone-900/80 border border-stone-600 rounded-xl p-5 space-y-4">
                <h2 className="text-xl font-bold text-stone-200">Créer une salle</h2>
                <label className="block text-sm text-stone-400">
                  Mot de passe (optionnel)
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className="mt-1 w-full bg-stone-800 border border-stone-600 rounded px-3 py-2 text-white"
                    placeholder="Laisser vide = salle ouverte"
                    autoComplete="new-password"
                  />
                </label>
                {renderCharPicker(createSelected, setCreateSelected, 'Ton combattant archivé')}
                <button
                  type="button"
                  disabled={busy || !createSelected}
                  onClick={handleCreateRoom}
                  className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg"
                >
                  Créer le lobby
                </button>
              </div>

              <div className="bg-stone-900/80 border border-stone-600 rounded-xl p-5 space-y-4">
                <h2 className="text-xl font-bold text-stone-200">Rejoindre une salle</h2>
                <label className="block text-sm text-stone-400">
                  ID de la salle
                  <input
                    value={joinRoomIdInput}
                    onChange={(e) => setJoinRoomIdInput(e.target.value)}
                    className="mt-1 w-full bg-stone-800 border border-stone-600 rounded px-3 py-2 text-white font-mono text-sm"
                    placeholder="Coller l’ID"
                  />
                </label>
                <label className="block text-sm text-stone-400">
                  Mot de passe (si la salle est protégée)
                  <input
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    className="mt-1 w-full bg-stone-800 border border-stone-600 rounded px-3 py-2 text-white"
                    autoComplete="new-password"
                  />
                </label>
                {renderCharPicker(joinSelected, setJoinSelected, 'Ton combattant archivé')}
                <button
                  type="button"
                  disabled={busy || !joinSelected}
                  onClick={handleJoinRoom}
                  className="w-full bg-stone-700 hover:bg-stone-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg border border-stone-500"
                >
                  Rejoindre
                </button>
              </div>
            </div>

            <div className="bg-stone-900/80 border border-stone-600 rounded-xl p-5">
              <h2 className="text-lg font-bold text-stone-200 mb-3">Salles ouvertes (sans mot de passe)</h2>
              {openRooms.length === 0 ? (
                <p className="text-stone-500 text-sm">Aucune salle ouverte pour le moment.</p>
              ) : (
                <ul className="space-y-2">
                  {openRooms.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-stone-800/80 p-3 rounded-lg border border-stone-700"
                    >
                      <div>
                        <span className="text-stone-300 font-mono text-xs">{r.id}</span>
                        <span className="text-stone-500 text-xs ml-2">
                          Hôte : {r.hostSnapshot?.name || '—'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setJoinRoomIdInput(r.id)}
                        className="text-amber-400 text-sm font-semibold hover:underline"
                      >
                        Utiliser cet ID
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {inRoom && room && !replayPhase && (
          <div className="bg-stone-900/80 border border-stone-600 rounded-xl p-5 space-y-4">
            <h2 className="text-xl font-bold text-stone-200">Salle</h2>
            <p className="text-stone-400 text-sm font-mono break-all">ID : {room.id}</p>
            <div className="max-w-md">{renderLeaderboardEncadre()}</div>
            {isHost && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyRoomId}
                  className="bg-stone-700 text-white px-4 py-2 rounded border border-stone-500 text-sm"
                >
                  Copier l’ID
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDeleteHost}
                  className="bg-red-900/60 text-red-100 px-4 py-2 rounded border border-red-700 text-sm"
                >
                  Supprimer la salle
                </button>
              </div>
            )}

            {room.status === 'waiting' && isHost && (
              <p className="text-amber-200">
                {room.isMatchmakingQueue
                  ? 'Matchmaking : en attente d’un adversaire… Dès qu’un joueur lance le matchmaking avec un archivé, il te rejoindra ici.'
                  : 'En attente d’un adversaire… Tu es prêt avec ton archivé.'}
              </p>
            )}

            {room.status === 'lobby' && (
              <div className="space-y-4">
                <p className="text-stone-300 text-sm">
                  Les deux joueurs sont dans le lobby. L’invité doit confirmer son personnage et se déclarer prêt.
                </p>
                <div className="grid md:grid-cols-2 gap-y-8 gap-x-6 md:gap-x-12 lg:gap-x-16 xl:gap-x-24 items-start">
                  <div className="min-w-0 border border-stone-600 rounded-lg p-3 md:p-4 bg-stone-950/40 md:mr-1 lg:mr-2">
                    <div className="text-blue-400 font-bold text-sm mb-2">Hôte</div>
                    {room.hostSnapshot && (
                      <CharacterCardContent
                        character={preparerCombattant(room.hostSnapshot)}
                        detailsPlacement="left"
                      />
                    )}
                    <p className="text-xs text-stone-500 mt-2">
                      Prêt : {room.hostReady ? 'oui' : 'non'}
                    </p>
                    {isHost && room.hostSnapshot?.id && (
                      <p className="text-[11px] text-stone-500 mt-1">
                        Record duels PvP :{' '}
                        <span className="text-emerald-400 font-semibold">
                          {archivedChars.find((c) => c.id === room.hostSnapshot.id)?.pvpDuelStats?.wins ?? 0}V
                        </span>
                        {' · '}
                        <span className="text-rose-400 font-semibold">
                          {archivedChars.find((c) => c.id === room.hostSnapshot.id)?.pvpDuelStats?.losses ?? 0}D
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="min-w-0 border border-stone-600 rounded-lg p-3 md:p-4 bg-stone-950/40 md:ml-1 lg:ml-2">
                    <div className="text-purple-400 font-bold text-sm mb-2">Invité</div>
                    {room.guestSnapshot && (
                      <CharacterCardContent
                        character={preparerCombattant(room.guestSnapshot)}
                        detailsPlacement="right"
                      />
                    )}
                    <p className="text-xs text-stone-500 mt-2">
                      Prêt : {room.guestReady ? 'oui' : 'non'}
                    </p>
                    {isGuest && room.guestSnapshot?.id && (
                      <p className="text-[11px] text-stone-500 mt-1">
                        Record duels PvP :{' '}
                        <span className="text-emerald-400 font-semibold">
                          {archivedChars.find((c) => c.id === room.guestSnapshot.id)?.pvpDuelStats?.wins ?? 0}V
                        </span>
                        {' · '}
                        <span className="text-rose-400 font-semibold">
                          {archivedChars.find((c) => c.id === room.guestSnapshot.id)?.pvpDuelStats?.losses ?? 0}D
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                {isGuest && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={readyBusy}
                      onClick={() => handleGuestReady(true)}
                      className="bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50"
                    >
                      Je suis prêt
                    </button>
                    <button
                      type="button"
                      disabled={readyBusy}
                      onClick={() => handleGuestReady(false)}
                      className="bg-stone-700 text-stone-200 px-4 py-2 rounded-lg border border-stone-500 disabled:opacity-50"
                    >
                      Pas prêt
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleLeaveGuest}
                      className="bg-stone-800 text-amber-200 px-4 py-2 rounded-lg border border-stone-600"
                    >
                      Quitter la salle
                    </button>
                  </div>
                )}
                {isHost && (
                  <p className="text-stone-400 text-sm">
                    Dès que l’invité est prêt, le combat se lance automatiquement.
                  </p>
                )}
              </div>
            )}

            {room.status === 'completed' && !replayPhase && (
              <p className="text-stone-400">Préparation du replay…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PvpLobby;
