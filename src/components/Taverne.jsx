import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { getUserCharacter, getAllCharacters } from '../services/characterService';
import { getWeaponById } from '../data/weapons';
import { getDungeonProgress } from '../services/dungeonService';
import { getUserLabyrinthProgress } from '../services/infiniteLabyrinthService';
import {
  enterTaverne,
  leaveTaverne,
  updateTavernePosition,
  sendTaverneMessage,
  subscribeTavernePresence,
  subscribeTaverneChat,
} from '../services/taverneService';

const BUBBLE_DURATION_MS = 12000;
const WALKABLE_ZONE_HEIGHT_PCT = 42;
const FIXED_Y_PCT = 55;
const MOVE_DURATION_MS = 2000;
const MOVE_INTERVAL_MS = 4500;

export default function Taverne() {
  const { currentUser } = useAuth();
  const [presences, setPresences] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeCharacters, setActiveCharacters] = useState([]);
  const [charactersByUserId, setCharactersByUserId] = useState({});
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [selectedProgression, setSelectedProgression] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [allowedInTaverne, setAllowedInTaverne] = useState(false);
  const [noCharacterReason, setNoCharacterReason] = useState(null);
  const walkableRef = useRef(null);
  const chatEndRef = useRef(null);
  const [myDisplayX, setMyDisplayX] = useState(30);
  const myDisplayXRef = useRef(30);
  const moveRafRef = useRef(null);
  const [volume, setVolume] = useState(0.05);
  const [isMuted, setIsMuted] = useState(false);
  const [isSoundOpen, setIsSoundOpen] = useState(false);

  const hasEnteredRef = useRef(false);

  const ensureTaverneMusic = useCallback(() => {
    const el = document.getElementById('taverne-music');
    if (el) {
      el.volume = volume;
      el.muted = isMuted;
      if (el.paused) el.play().catch(() => {});
    }
  }, [volume, isMuted]);

  const stopTaverneMusic = useCallback(() => {
    const el = document.getElementById('taverne-music');
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, []);

  useEffect(() => {
    const el = document.getElementById('taverne-music');
    if (el) {
      el.volume = volume;
      el.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (allowedInTaverne) {
      ensureTaverneMusic();
      return () => stopTaverneMusic();
    }
    stopTaverneMusic();
  }, [allowedInTaverne, ensureTaverneMusic, stopTaverneMusic]);

  useEffect(() => {
    myDisplayXRef.current = myDisplayX;
  }, [myDisplayX]);

  // Même critère que le tournoi : personnage actif (non archivé, non désactivé)
  const isEligibleForTournament = (char) => char && !char.archived && !char.disabled;

  // Vérifier que le joueur a un personnage éligible au tournoi avant d'entrer
  useEffect(() => {
    if (!currentUser?.uid) return;
    let mounted = true;
    hasEnteredRef.current = false;
    (async () => {
      const res = await getUserCharacter(currentUser.uid);
      if (!mounted) return;
      if (!res.success || !res.data) {
        setNoCharacterReason('Tu n’as pas de personnage actif.');
        setLoading(false);
        return;
      }
      if (!isEligibleForTournament(res.data)) {
        setNoCharacterReason('Seuls les personnages qui participent au tournoi peuvent entrer dans la taverne.');
        setLoading(false);
        return;
      }
      setAllowedInTaverne(true);
      hasEnteredRef.current = true;
      await enterTaverne(currentUser.uid, 30, FIXED_Y_PCT);
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
      if (hasEnteredRef.current) leaveTaverne(currentUser.uid);
    };
  }, [currentUser?.uid]);

  // Abonnements présence et chat
  useEffect(() => {
    const unsubPresence = subscribeTavernePresence(setPresences);
    const unsubChat = subscribeTaverneChat(setMessages);
    return () => {
      unsubPresence();
      unsubChat();
    };
  }, []);

  // Charger tous les personnages actifs (même critère que le tournoi : non archivés, non désactivés)
  useEffect(() => {
    if (!allowedInTaverne) return;
    let cancelled = false;
    (async () => {
      const res = await getAllCharacters();
      if (!cancelled && res.success && res.data) {
        const active = res.data.filter((c) => !c.archived && !c.disabled);
        const enriched = active.map((c) => {
          const userId = c.id || c.userId;
          const weaponId = c.equippedWeaponId ?? null;
          const equippedWeaponData = weaponId ? getWeaponById(weaponId) : null;
          return { ...c, userId, equippedWeaponData };
        });
        setActiveCharacters(enriched);
        setCharactersByUserId(Object.fromEntries(enriched.map((c) => [c.userId, c])));
      }
    })();
    return () => { cancelled = true; };
  }, [allowedInTaverne]);

  // Scroll chat vers le bas à chaque nouveau message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Charger la progression (donjon + labyrinthe) quand on ouvre la modal d'un personnage
  useEffect(() => {
    if (!selectedCharacter?.userId) {
      setSelectedProgression(null);
      return;
    }
    setSelectedProgression(null);
    let cancelled = false;
    (async () => {
      const [dungeonRes, labyrinthRes] = await Promise.all([
        getDungeonProgress(selectedCharacter.userId),
        getUserLabyrinthProgress(selectedCharacter.userId),
      ]);
      if (!cancelled) {
        setSelectedProgression({
          dungeon: dungeonRes.success ? dungeonRes.data : null,
          labyrinth: labyrinthRes.success ? labyrinthRes.data : null,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCharacter?.userId]);

  // Déplacement automatique : ligne horizontale fixe (y constant), mouvement fluide en X
  useEffect(() => {
    if (!currentUser?.uid || !allowedInTaverne) return;
    const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    let intervalId;
    const scheduleNext = () => {
      intervalId = setTimeout(() => {
        const targetX = 8 + Math.random() * 84;
        const startX = myDisplayXRef.current;
        const startTime = performance.now();
        const tick = () => {
          const elapsed = performance.now() - startTime;
          const t = Math.min(1, elapsed / MOVE_DURATION_MS);
          const eased = easeInOutQuad(t);
          const newX = startX + (targetX - startX) * eased;
          setMyDisplayX(newX);
          myDisplayXRef.current = newX;
          if (t < 1) {
            moveRafRef.current = requestAnimationFrame(tick);
          } else {
            updateTavernePosition(currentUser.uid, targetX, FIXED_Y_PCT);
          }
        };
        moveRafRef.current = requestAnimationFrame(tick);
        scheduleNext();
      }, MOVE_INTERVAL_MS);
    };
    scheduleNext();
    return () => {
      if (intervalId) clearTimeout(intervalId);
      if (moveRafRef.current) cancelAnimationFrame(moveRafRef.current);
    };
  }, [currentUser?.uid, allowedInTaverne]);

  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      if (!currentUser?.uid || !chatInput.trim()) return;
      const character = charactersByUserId[currentUser.uid];
      const name = character?.name || currentUser.email?.split('@')[0] || 'Inconnu';
      await sendTaverneMessage(currentUser.uid, name, chatInput.trim());
      setChatInput('');
    },
    [currentUser?.uid, chatInput, charactersByUserId]
  );

  const isBubbleVisible = (lastChatAt) => {
    if (!lastChatAt?.toMillis) return false;
    return Date.now() - lastChatAt.toMillis() < BUBBLE_DURATION_MS;
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-900">
        <Header />
        <p className="text-amber-400">Connecte-toi pour entrer dans la taverne.</p>
      </div>
    );
  }

  if (noCharacterReason) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-900 p-4">
        <Header />
        <p className="text-amber-400 text-center text-lg max-w-md">{noCharacterReason}</p>
      </div>
    );
  }

  const SoundControl = () => (
    <div className="fixed top-20 right-4 z-50 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setIsSoundOpen((prev) => !prev)}
        className="bg-amber-600 text-white border border-amber-400 px-3 py-2 text-sm font-bold shadow-lg hover:bg-amber-500"
      >
        {isMuted || volume === 0 ? '🔇' : '🔊'} Son
      </button>
      {isSoundOpen && (
        <div className="bg-stone-900 border border-stone-600 p-3 w-56 shadow-xl">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setIsMuted((m) => !m); if (isMuted && volume === 0) setVolume(0.05); }} className="text-lg" aria-label={isMuted ? 'Réactiver le son' : 'Couper le son'}>
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => { const v = Number(e.target.value); setVolume(v); setIsMuted(v === 0); }}
              className="w-full accent-amber-500"
            />
            <span className="text-xs text-stone-200 w-10 text-right">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-stone-900">
      <Header />
      <SoundControl />
      <audio id="taverne-music" loop>
        <source src="/assets/music/taverne.mp3" type="audio/mpeg" />
      </audio>

      {/* Fond taverne */}
      <div
        className="absolute inset-0 bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/assets/backgrounds/taverne.png)',
          backgroundSize: 'cover',
        }}
      />

      {/* Zone des personnages : devant le bar vers le feu */}
      <div
        ref={walkableRef}
        className="absolute left-0 right-0 bottom-0"
        style={{ height: `${WALKABLE_ZONE_HEIGHT_PCT}%` }}
      >
        {/* Tous les personnages actifs (éligibles au tournoi) : présents = position live, absents = position fixe sur la ligne */}
        {(() => {
          const nonPresentList = activeCharacters.filter(
            (c) => !presences.some((p) => p.userId === (c.id || c.userId))
          );
          return activeCharacters.map((character) => {
            const userId = character.id || character.userId;
            const presence = presences.find((p) => p.userId === userId);
            const isMe = userId === currentUser?.uid;
            const showBubble = presence && isBubbleVisible(presence.lastChatAt) && presence.lastChatMessage;
            const nonPresentIndex = nonPresentList.findIndex((c) => (c.id || c.userId) === userId);
            const displayX = presence
              ? (isMe ? myDisplayX : presence.x)
              : 6 + ((nonPresentIndex + 1) * 88) / (nonPresentList.length + 1);
            const displayY = FIXED_Y_PCT;

          return (
            <div
              key={userId}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 hover:scale-105 hover:z-20 ${!isMe ? 'opacity-60 hover:opacity-100 transition-opacity duration-200' : ''}`}
              style={{
                left: `${displayX}%`,
                top: `${displayY}%`,
                width: '260px',
                transition: isMe ? 'none' : 'left 0.5s ease-out',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCharacter({ ...character, userId });
              }}
            >
              {/* Bulle de chat au-dessus (uniquement si présent) */}
              {showBubble && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1.5 max-w-[160px] rounded-lg bg-stone-800 border border-amber-600/60 text-xs text-stone-200 shadow-xl z-30">
                  <div className="font-semibold text-amber-300 truncate">
                    {character.name || userId.slice(0, 8)}
                  </div>
                  <div className="break-words line-clamp-2">{presence.lastChatMessage}</div>
                </div>
              )}

              {/* Mini carte */}
              <div className={`rounded border-2 overflow-hidden shadow-lg ${isMe ? 'border-amber-500 ring-2 ring-amber-400/50' : 'border-stone-600'}`}>
                {character.characterImage ? (
                  <img
                    src={character.characterImage}
                    alt={character.name}
                    className="w-full h-72 object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-72 bg-stone-700 flex items-center justify-center text-5xl">
                    {character.race ? '🧙' : '?'}
                  </div>
                )}
                <div className="bg-stone-800/95 px-2 py-2 text-center">
                  <span className="text-sm font-bold text-amber-200 truncate block">
                    {character.name || '…'}
                  </span>
                </div>
              </div>
            </div>
          );
        });
        })()}
      </div>

      {/* Zone de chat : étroite, en bas à droite */}
      <div className="absolute right-4 bottom-4 z-20 flex flex-col w-72 max-w-[calc(100vw-2rem)] bg-stone-900/95 border border-stone-600 rounded-t-lg shadow-2xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-stone-600 rounded-t-lg">
          <span className="text-amber-400 font-bold text-sm">💬 Chat</span>
        </div>
        <div className="overflow-y-auto max-h-[160px] min-h-[80px] p-2 space-y-1">
          {messages.length === 0 && (
            <p className="text-stone-500 text-xs text-center py-3">Aucun message.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="text-xs">
              <span className="font-semibold text-amber-300">{m.characterName}</span>
              <span className="text-stone-400 mx-1">:</span>
              <span className="text-stone-200 break-words">{m.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className="p-2 flex gap-2 border-t border-stone-600">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Message…"
            maxLength={300}
            className="flex-1 min-w-0 px-2 py-1.5 text-sm bg-stone-800 border border-stone-600 rounded text-stone-200 placeholder-stone-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!chatInput.trim()}
            className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-900 font-bold rounded border border-amber-500 transition"
          >
            Envoyer
          </button>
        </form>
      </div>

      {/* Modal carte complète au clic sur un personnage */}
      {selectedCharacter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setSelectedCharacter(null)}
          role="button"
          tabIndex={0}
          aria-label="Fermer"
          onKeyDown={(e) => e.key === 'Escape' && setSelectedCharacter(null)}
        >
          <div
            className="max-h-[90vh] overflow-y-auto bg-stone-900 border-2 border-amber-600 rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={() => setSelectedCharacter(null)}
                  className="px-3 py-1 bg-stone-700 hover:bg-stone-600 rounded text-stone-300"
                >
                  Fermer
                </button>
              </div>
              <CharacterCardContent character={selectedCharacter} />
              {/* Progression : boss battus + labyrinthe */}
              <div className="mt-4 p-3 border border-stone-600 bg-stone-800/80 rounded-lg">
                <h4 className="text-amber-400 font-bold text-sm mb-2">📊 Progression cette semaine</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-300">
                  <div className="flex justify-between">
                    <span>🏰 La Grotte aux merveilles</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedProgression?.dungeon?.bestRun ? '✓' : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>🌲 La Forêt enchantée</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedCharacter?.forestBoosts ? '✓' : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>🪄 Tour du Mage</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedCharacter?.mageTowerPassive ? '✓' : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>🔨 Forge des Légendes</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedCharacter?.forgeUpgrade ? '✓' : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>👁️ Extension du Territoire</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedCharacter?.mageTowerExtensionPassive ? '✓' : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>🎓 Collège Kunugigaoka</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedCharacter?.subclass ? '✓' : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>🌀 Labyrinthe (étage max)</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedProgression?.labyrinth?.highestClearedFloor != null
                        ? `Étage ${selectedProgression.labyrinth.highestClearedFloor}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>🌀 Labyrinthe (boss battus)</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedProgression?.labyrinth?.bossesDefeated != null
                        ? `${selectedProgression.labyrinth.bossesDefeated}`
                        : '0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-stone-900/80 z-30">
          <span className="text-amber-400 text-xl">Entrée dans la taverne…</span>
        </div>
      )}
    </div>
  );
}
