import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  sendTaverneMessage,
  subscribeTavernePresence,
  subscribeTaverneChat,
} from '../services/taverneService';

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

const BUBBLE_DURATION_MS = 12000;

const CHAT_STORAGE_KEY = 'taverne-chat-layout';
const DEFAULT_CHAT_WIDTH = 420;
const DEFAULT_CHAT_HEIGHT = 400;
const MIN_CHAT_WIDTH = 280;
const MIN_CHAT_HEIGHT = 200;

function loadChatLayout() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveChatLayout(layout) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(layout));
  } catch { /* ignore */ }
}

const TAVERN_SLOTS = [
  { id: 'tavernier', x: 26, y: 60, label: 'Derrière le bar' },
  { id: 'bar-1', x: 12, y: 85, label: 'Entrée' },
  { id: 'bar-2', x: 35, y: 69, label: 'Comptoir' },
  { id: 'table1-1', x: 24, y: 83, label: 'Table gauche' },
  { id: 'table1-2', x: 41, y: 105, label: 'Table gauche' },
  { id: 'table1-3', x: 34, y: 93, label: 'Table gauche' },
  { id: 'table2-1', x: 60, y: 70, label: 'Table droite' },
  { id: 'table2-2', x: 80, y: 90, label: 'Table droite' },
  { id: 'table2-3', x: 60, y: 90, label: 'Table droite' },
  { id: 'cheminee', x: 77, y: 60, label: 'Cheminée' },
  { id: 'escalier', x: 43, y: 46, label: 'Escalier' },
  { id: 'tonneaux', x: 87, y: 71, label: 'Tonneaux' },
];

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
  const [hoveredSlotId, setHoveredSlotId] = useState(null);
  const chatEndRef = useRef(null);
  const hasEnteredRef = useRef(false);

  const savedLayout = useRef(loadChatLayout());
  const [chatPos, setChatPos] = useState(() => savedLayout.current?.pos ?? null);
  const [chatSize, setChatSize] = useState(() => ({
    w: savedLayout.current?.size?.w ?? DEFAULT_CHAT_WIDTH,
    h: savedLayout.current?.size?.h ?? DEFAULT_CHAT_HEIGHT,
  }));
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const chatBoxRef = useRef(null);

  const persistLayout = useCallback((pos, size) => {
    saveChatLayout({ pos, size });
  }, []);

  const handleDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const box = chatBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top };

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      const newLeft = Math.max(0, Math.min(window.innerWidth - 100, d.origLeft + dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - 60, d.origTop + dy));
      setChatPos({ x: newLeft, y: newTop });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setChatPos((p) => { setChatSize((s) => { persistLayout(p, s); return s; }); return p; });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [persistLayout]);

  const handleResizeStart = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const box = chatBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: rect.width, origH: rect.height };

    const onMove = (ev) => {
      const r = resizeRef.current;
      if (!r) return;
      const newW = Math.max(MIN_CHAT_WIDTH, r.origW + (ev.clientX - r.startX));
      const newH = Math.max(MIN_CHAT_HEIGHT, r.origH + (ev.clientY - r.startY));
      setChatSize({ w: newW, h: newH });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setChatPos((p) => { setChatSize((s) => { persistLayout(p, s); return s; }); return p; });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [persistLayout]);

  const handleResetChatLayout = useCallback(() => {
    setChatPos(null);
    setChatSize({ w: DEFAULT_CHAT_WIDTH, h: DEFAULT_CHAT_HEIGHT });
    saveChatLayout(null);
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
      if (el && el.paused) el.play().catch(() => {});
      return () => stopTaverneMusic();
    }
    stopTaverneMusic();
  }, [allowedInTaverne]);

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
      await enterTaverne(currentUser.uid);
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

  const slotAssignments = useMemo(() => {
    const assignments = [];
    const usedIds = new Set();

    const sortedPresences = [...presences].sort((a, b) => {
      if (a.userId === currentUser?.uid) return -1;
      if (b.userId === currentUser?.uid) return 1;
      return 0;
    });

    let idx = 0;
    for (const p of sortedPresences) {
      if (idx >= TAVERN_SLOTS.length) break;
      const char = charactersByUserId[p.userId];
      if (!char) continue;
      assignments.push({
        slot: TAVERN_SLOTS[idx],
        character: char,
        userId: p.userId,
        isPresent: true,
        isMe: p.userId === currentUser?.uid,
        presence: p,
      });
      usedIds.add(p.userId);
      idx++;
    }

    for (const char of activeCharacters) {
      if (idx >= TAVERN_SLOTS.length) break;
      const uid = char.id || char.userId;
      if (usedIds.has(uid)) continue;
      assignments.push({
        slot: TAVERN_SLOTS[idx],
        character: char,
        userId: uid,
        isPresent: false,
        isMe: false,
        presence: null,
      });
      usedIds.add(uid);
      idx++;
    }

    return assignments;
  }, [presences, activeCharacters, charactersByUserId, currentUser?.uid]);

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
    <div className="min-h-screen flex flex-col bg-black">
      <Header />
      <audio id="taverne-music" loop>
        <source src="/assets/music/taverne.mp3" type="audio/mpeg" />
      </audio>

      <div className="flex-1 flex items-center justify-center p-2 relative overflow-hidden">
        {/* Conteneur isometrique avec aspect-ratio fixe */}
        <div
          className="relative w-full"
          style={{
            aspectRatio: '1456 / 816',
            maxHeight: 'calc(100vh - 4.5rem)',
            maxWidth: 'calc((100vh - 4.5rem) * 1456 / 816)',
          }}
        >
          <img
            src="/assets/backgrounds/taverneIso.png"
            alt=""
            className="absolute inset-0 w-full h-full select-none"
            draggable={false}
          />

          {/* Slots des personnages */}
          {slotAssignments.map(({ slot, character, userId, isPresent, isMe, presence }) => {
            const isHovered = hoveredSlotId === slot.id;
            const showBubble = isPresent && presence && isBubbleVisible(presence.lastChatAt) && presence.lastChatMessage;
            const { src: imgSrc, isChibi } = getTaverneCharacterImage(character);

            return (
              <div
                key={slot.id}
                className="absolute z-10 flex flex-col items-center pointer-events-none"
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                {showBubble && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 max-w-[220px] rounded-xl bg-stone-900/95 border border-amber-500/70 text-sm text-stone-200 shadow-xl z-30 pointer-events-none whitespace-normal">
                    <div className="break-words line-clamp-3">{presence.lastChatMessage}</div>
                  </div>
                )}

                <div
                  className={`
                    relative transition-all duration-200
                    ${isHovered ? 'scale-125 z-20' : ''}
                  `}
                  style={{ width: 'clamp(150px, 25vw, 270px)', height: 'clamp(150px, 25vw, 270px)' }}
                >
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={character.name || ''}
                      className={`w-full h-full select-none pointer-events-none ${isChibi ? 'object-contain object-bottom' : 'object-cover object-top rounded'}`}
                      style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))' }}
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl pointer-events-none">
                      🧙
                    </div>
                  )}
                  <div
                    className="absolute inset-y-[10%] inset-x-[25%] cursor-pointer pointer-events-auto"
                    onMouseEnter={() => setHoveredSlotId(slot.id)}
                    onMouseLeave={() => setHoveredSlotId(null)}
                    onClick={() => setSelectedCharacter({ ...character, userId })}
                  />
                  {isPresent && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-emerald-400 rounded-full border-2 border-stone-900 pointer-events-none" />
                  )}
                </div>

                <div
                  className={`
                    mt-0.5 px-1.5 py-0.5 rounded text-center transition-opacity duration-200 max-w-[80px] pointer-events-none
                    ${isHovered || isMe ? 'opacity-100' : 'opacity-0'}
                    ${isMe ? 'bg-amber-500/90 text-stone-900' : 'bg-stone-900/90 text-stone-200'}
                  `}
                  style={{ fontSize: 'clamp(8px, 1vw, 11px)' }}
                >
                  <span className="truncate block font-semibold">{character.name || '???'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chat déplaçable et redimensionnable */}
        <div
          ref={chatBoxRef}
          className="fixed z-20 flex flex-col bg-stone-900/95 border border-stone-600 rounded-xl shadow-2xl backdrop-blur-sm"
          style={{
            width: `${chatSize.w}px`,
            height: `${chatSize.h}px`,
            ...(chatPos
              ? { left: `${chatPos.x}px`, top: `${chatPos.y}px` }
              : { left: '1rem', bottom: '1rem' }),
            maxWidth: 'calc(100vw - 1rem)',
            maxHeight: 'calc(100vh - 1rem)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b border-stone-700 rounded-t-xl cursor-grab active:cursor-grabbing select-none shrink-0"
            onMouseDown={handleDragStart}
          >
            <span className="text-amber-400 font-bold text-base">💬 Chat de la Taverne</span>
            <div className="flex items-center gap-2">
              <span className="text-stone-500 text-sm">{presences.length} en ligne</span>
              <button
                type="button"
                onClick={handleResetChatLayout}
                className="text-stone-500 hover:text-amber-400 transition text-xs px-1.5 py-0.5 rounded hover:bg-stone-700"
                title="Réinitialiser position et taille"
              >
                ↺
              </button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 p-3 space-y-1.5">
            {messages.length === 0 && (
              <p className="text-stone-500 text-sm text-center py-4">Aucun message.</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="text-sm">
                <span className="font-semibold text-amber-300">{m.characterName}</span>
                <span className="text-stone-500 mx-1">:</span>
                <span className="text-stone-200 break-words">{m.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="p-3 flex gap-2 border-t border-stone-700 shrink-0">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message…"
              maxLength={300}
              className="flex-1 min-w-0 px-3 py-2 text-sm bg-stone-800 border border-stone-600 rounded-lg text-stone-200 placeholder-stone-500 focus:border-amber-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-900 font-bold rounded-lg border border-amber-500 transition"
            >
              Envoyer
            </button>
          </form>
          {/* Poignée de redimensionnement */}
          <div
            className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-30 flex items-end justify-end pr-0.5 pb-0.5"
            onMouseDown={handleResizeStart}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="text-stone-500 opacity-70 hover:opacity-100 transition">
              <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
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
              <CharacterCardContent character={selectedCharacter} detailsPlacement="left" />
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
                    <span>💀 Boss Rush</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedProgression?.dungeon?.bossRushCompleted ? '✓' : '—'}
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
