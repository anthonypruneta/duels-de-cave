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

// Sprites chibi (sans fond). Correspondance normalis\u00e9e : espaces/tirets insensibles (ex. "Orc en ciel" \u2194 "Orc-en-ciel")
const chibiImageModules = import.meta.glob('../assets/chibi/*.png', { eager: true, import: 'default' });
const chibiByNombreNormalise = Object.fromEntries(
  Object.entries(chibiImageModules).map(([path, url]) => {
    const nomFichier = path.replace(/^.*\//, '').replace(/\.png$/i, '');
    const normalise = nomFichier.trim().toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
    return [normalise, url];
  })
);

function normaliserNomPourChibi(nom) {
  if (!nom || typeof nom !== 'string') return '';
  return nom.trim().toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
}

function getTaverneCharacterImage(character) {
  const nom = character?.name?.trim();
  if (nom) {
    const key = normaliserNomPourChibi(nom);
    if (chibiByNombreNormalise[key]) return { src: chibiByNombreNormalise[key], isChibi: true };
  }
  if (character?.characterImage) return { src: character.characterImage, isChibi: false };
  return { src: null, isChibi: false };
}

function getNaturalPixelAlphaAtClientPoint(imgEl, clientX, clientY) {
  if (!imgEl || !imgEl.complete || !imgEl.naturalWidth || !imgEl.naturalHeight) return 0;
  const rect = imgEl.getBoundingClientRect();
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return 0;
  }

  const xInBox = clientX - rect.left;
  const yInBox = clientY - rect.top;
  const fit = imgEl.dataset.fit || 'contain';
  const position = imgEl.dataset.position || 'center';
  const naturalW = imgEl.naturalWidth;
  const naturalH = imgEl.naturalHeight;

  let scale;
  if (fit === 'cover') {
    scale = Math.max(rect.width / naturalW, rect.height / naturalH);
  } else {
    scale = Math.min(rect.width / naturalW, rect.height / naturalH);
  }

  const drawnW = naturalW * scale;
  const drawnH = naturalH * scale;
  const offsetX = (rect.width - drawnW) / 2;
  const offsetY = position === 'bottom'
    ? rect.height - drawnH
    : position === 'top'
      ? 0
      : (rect.height - drawnH) / 2;

  const xInImage = xInBox - offsetX;
  const yInImage = yInBox - offsetY;
  if (xInImage < 0 || yInImage < 0 || xInImage >= drawnW || yInImage >= drawnH) return 0;

  const naturalX = Math.floor(xInImage / scale);
  const naturalY = Math.floor(yInImage / scale);

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 255;
  ctx.drawImage(imgEl, naturalX, naturalY, 1, 1, 0, 0, 1, 1);
  return ctx.getImageData(0, 0, 1, 1).data[3];
}

const BUBBLE_DURATION_MS = 12000;
const WALKABLE_ZONE_HEIGHT_PCT = 50;
const FIXED_Y_PCT = 99;
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
  const [hoveredUserId, setHoveredUserId] = useState(null);
  const spriteRefs = useRef({});
  const spriteOrderRef = useRef([]);

  const hasEnteredRef = useRef(false);

  const startTaverneMusicOnInteraction = useCallback(() => {
    const el = document.getElementById('taverne-music');
    if (el && el.paused) {
      el.play().catch(() => {});
    }
  }, []);

  const stopTaverneMusic = useCallback(() => {
    const el = document.getElementById('taverne-music');
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, []);

  useEffect(() => {
    if (allowedInTaverne) {
      const el = document.getElementById('taverne-music');
      if (el) {
        if (el.paused) el.play().catch(() => {});
      }
      return () => stopTaverneMusic();
    }
    stopTaverneMusic();
  }, [allowedInTaverne]);

  useEffect(() => {
    myDisplayXRef.current = myDisplayX;
  }, [myDisplayX]);

  const isEligibleForTournament = (char) => char && !char.archived && !char.disabled;

  useEffect(() => {
    if (!currentUser?.uid) return;
    let mounted = true;
    hasEnteredRef.current = false;
    (async () => {
      const res = await getUserCharacter(currentUser.uid);
      if (!mounted) return;
      if (!res.success || !res.data) {
        setNoCharacterReason('Tu n\u2019as pas de personnage actif.');
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

  useEffect(() => {
    const unsubPresence = subscribeTavernePresence(setPresences);
    const unsubChat = subscribeTaverneChat(setMessages);
    return () => {
      unsubPresence();
      unsubChat();
    };
  }, []);

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const getTopCharacterUnderPointer = useCallback((clientX, clientY) => {
    const order = spriteOrderRef.current || [];
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const userId = order[i];
      const imgEl = spriteRefs.current[userId];
      if (!imgEl) continue;
      const alpha = getNaturalPixelAlphaAtClientPoint(imgEl, clientX, clientY);
      if (alpha > 8) return userId;
    }
    return null;
  }, []);

  const handleWalkablePointerMove = useCallback((e) => {
    const hitUserId = getTopCharacterUnderPointer(e.clientX, e.clientY);
    setHoveredUserId((prev) => (prev === hitUserId ? prev : hitUserId));
  }, [getTopCharacterUnderPointer]);

  const handleWalkableClick = useCallback((e) => {
    const hitUserId = getTopCharacterUnderPointer(e.clientX, e.clientY);
    if (!hitUserId) return;
    const character = charactersByUserId[hitUserId];
    if (!character) return;
    setSelectedCharacter({ ...character, userId: hitUserId });
  }, [charactersByUserId, getTopCharacterUnderPointer]);

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

  return (
    <div className="min-h-screen relative overflow-hidden bg-stone-900">
      <Header />
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
        onMouseMove={handleWalkablePointerMove}
        onMouseLeave={() => setHoveredUserId(null)}
        onClick={handleWalkableClick}
      >
        {/* Tous les personnages actifs : pr\u00e9sents = position live, absents = position fixe sur la ligne */}
        {(() => {
          const nonPresentList = activeCharacters.filter(
            (c) => !presences.some((p) => p.userId === (c.id || c.userId))
          );
          const renderedOrder = [];
          const rendered = activeCharacters.map((character) => {
            const userId = character.id || character.userId;
            renderedOrder.push(userId);
            const presence = presences.find((p) => p.userId === userId);
            const isMe = userId === currentUser?.uid;
            const isHovered = hoveredUserId === userId;
            const showBubble = presence && isBubbleVisible(presence.lastChatAt) && presence.lastChatMessage;
            const nonPresentIndex = nonPresentList.findIndex((c) => (c.id || c.userId) === userId);
            const displayX = presence
              ? (isMe ? myDisplayX : presence.x)
              : 6 + ((nonPresentIndex + 1) * 88) / (nonPresentList.length + 1);
            const displayY = FIXED_Y_PCT;

          return (
            <div
              key={userId}
              className={`absolute transform -translate-x-1/2 -translate-y-full transition-all duration-200 flex flex-col items-center pointer-events-none ${!isMe ? (isHovered ? 'opacity-100 z-20' : 'opacity-60') : ''}`}
              style={{
                left: `${displayX}%`,
                top: `${displayY}%`,
                transition: isMe ? 'none' : 'left 0.5s ease-out',
              }}
            >
              {showBubble && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1.5 max-w-[160px] rounded-lg bg-stone-800 border border-amber-600/60 text-xs text-stone-200 shadow-xl z-30 pointer-events-none">
                  <div className="font-semibold text-amber-300 truncate">
                    {character.name || userId.slice(0, 8)}
                  </div>
                  <div className="break-words line-clamp-2">{presence.lastChatMessage}</div>
                </div>
              )}

              {(() => {
                const { src, isChibi } = getTaverneCharacterImage(character);
                if (src) {
                  return (
                    <img
                      ref={(el) => {
                        if (el) spriteRefs.current[userId] = el;
                        else delete spriteRefs.current[userId];
                      }}
                      src={src}
                      alt=""
                      data-fit={isChibi ? 'contain' : 'cover'}
                      data-position={isChibi ? 'bottom' : 'top'}
                      className={`pointer-events-none select-none max-w-none transition-transform duration-200 ${isHovered ? 'scale-105 z-20' : ''} ${isChibi ? 'h-[48rem] w-auto object-contain object-bottom' : 'h-[48rem] w-[32rem] object-cover object-top rounded'}`}
                      style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
                    />
                  );
                }
                return (
                  <div className="h-[48rem] w-[24rem] flex items-center justify-center text-6xl bg-stone-700/80 rounded">
                    {character.race ? '\uD83E\uDDD9' : '?'}
                  </div>
                );
              })()}
            </div>
          );
        });
          spriteOrderRef.current = renderedOrder;
          return rendered;
        })()}
      </div>

      {/* Zone de chat */}
      <div className="absolute right-4 bottom-4 z-20 flex flex-col w-72 max-w-[calc(100vw-2rem)] bg-stone-900/95 border border-stone-600 rounded-t-lg shadow-2xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-stone-600 rounded-t-lg">
          <span className="text-amber-400 font-bold text-sm">\uD83D\uDCAC Chat</span>
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
            placeholder="Message\u2026"
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
              <div className="mt-4 p-3 border border-stone-600 bg-stone-800/80 rounded-lg">
                <h4 className="text-amber-400 font-bold text-sm mb-2">\uD83D\uDCCA Progression cette semaine</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-300">
                  <div className="flex justify-between">
                    <span>\uD83C\uDFF0 La Grotte aux merveilles</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedProgression?.dungeon?.bestRun ? '\u2713' : '\u2014'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>\uD83C\uDF32 La For\u00eat enchant\u00e9e</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedCharacter?.forestBoosts ? '\u2713' : '\u2014'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>\uD83E\uDE84 Tour du Mage</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedCharacter?.mageTowerPassive ? '\u2713' : '\u2014'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>\uD83D\uDD28 Forge des L\u00e9gendes</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedCharacter?.forgeUpgrade ? '\u2713' : '\u2014'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>\uD83D\uDC41\uFE0F Extension du Territoire</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedCharacter?.mageTowerExtensionPassive ? '\u2713' : '\u2014'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>\uD83C\uDF93 Coll\u00e8ge Kunugigaoka</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedCharacter?.subclass ? '\u2713' : '\u2014'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>\uD83C\uDF00 Labyrinthe (\u00e9tage max)</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedProgression?.labyrinth?.highestClearedFloor != null
                        ? `\u00c9tage ${selectedProgression.labyrinth.highestClearedFloor}`
                        : '\u2014'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>\uD83C\uDF00 Labyrinthe (boss battus)</span>
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
          <span className="text-amber-400 text-xl">Entr\u00e9e dans la taverne\u2026</span>
        </div>
      )}
    </div>
  );
}
