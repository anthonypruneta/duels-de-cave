import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { getUserCharacter } from '../services/characterService';
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

export default function Taverne() {
  const { currentUser } = useAuth();
  const [presences, setPresences] = useState([]);
  const [messages, setMessages] = useState([]);
  const [charactersByUserId, setCharactersByUserId] = useState({});
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [selectedProgression, setSelectedProgression] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [allowedInTaverne, setAllowedInTaverne] = useState(false);
  const [noCharacterReason, setNoCharacterReason] = useState(null);
  const walkableRef = useRef(null);
  const chatEndRef = useRef(null);

  const hasEnteredRef = useRef(false);

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
      await enterTaverne(currentUser.uid, 30, 60);
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

  const loadedUserIdsRef = useRef(new Set());

  // Charger les personnages des joueurs présents
  useEffect(() => {
    const userIds = [...new Set(presences.map((p) => p.userId))];
    let cancelled = false;
    (async () => {
      for (const uid of userIds) {
        if (loadedUserIdsRef.current.has(uid)) continue;
        loadedUserIdsRef.current.add(uid);
        const res = await getUserCharacter(uid);
        if (!cancelled && res.success && res.data) {
          setCharactersByUserId((prev) => ({ ...prev, [uid]: res.data }));
        } else {
          loadedUserIdsRef.current.delete(uid);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [presences]);

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

  // Déplacement automatique : nouvelle position aléatoire toutes les 4 secondes
  useEffect(() => {
    if (!currentUser?.uid || !allowedInTaverne) return;
    const interval = setInterval(() => {
      const x = 15 + Math.random() * 70;
      const y = 20 + Math.random() * 60;
      updateTavernePosition(currentUser.uid, x, y);
    }, 4000);
    return () => clearInterval(interval);
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

  return (
    <div className="min-h-screen relative overflow-hidden bg-stone-900">
      <Header />

      {/* Fond taverne (dézoomé) */}
      <div
        className="absolute inset-0 bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/assets/backgrounds/taverne.png)',
          backgroundSize: '75%',
        }}
      />

      {/* Zone des personnages : devant le bar vers le feu */}
      <div
        ref={walkableRef}
        className="absolute left-0 right-0 bottom-0"
        style={{ height: `${WALKABLE_ZONE_HEIGHT_PCT}%` }}
      >
        {/* Cartes des joueurs (mini) — uniquement ceux éligibles au tournoi */}
        {presences
          .filter((p) => {
            const char = charactersByUserId[p.userId];
            return isEligibleForTournament(char);
          })
          .map((p) => {
          const character = charactersByUserId[p.userId];
          const isMe = p.userId === currentUser?.uid;
          const showBubble = isBubbleVisible(p.lastChatAt) && p.lastChatMessage;

          return (
            <div
              key={p.userId}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 hover:scale-105 hover:z-20"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: '72px',
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (character) setSelectedCharacter({ ...character, userId: character.userId || p.userId });
              }}
            >
              {/* Bulle de chat au-dessus */}
              {showBubble && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1.5 max-w-[160px] rounded-lg bg-stone-800 border border-amber-600/60 text-xs text-stone-200 shadow-xl z-30">
                  <div className="font-semibold text-amber-300 truncate">
                    {character?.name || p.userId.slice(0, 8)}
                  </div>
                  <div className="break-words line-clamp-2">{p.lastChatMessage}</div>
                </div>
              )}

              {/* Mini carte (image + nom) */}
              <div className={`rounded border-2 overflow-hidden shadow-lg ${isMe ? 'border-amber-500 ring-2 ring-amber-400/50' : 'border-stone-600'}`}>
                {character?.characterImage ? (
                  <img
                    src={character.characterImage}
                    alt={character.name}
                    className="w-full h-20 object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-20 bg-stone-700 flex items-center justify-center text-2xl">
                    {character?.race ? '🧙' : '?'}
                  </div>
                )}
                <div className="bg-stone-800/95 px-1 py-0.5 text-center">
                  <span className="text-[10px] font-bold text-amber-200 truncate block">
                    {character?.name || '…'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Zone de chat en bas */}
      <div className="absolute left-0 right-0 bottom-0 z-20 flex flex-col bg-stone-900/95 border-t border-stone-600 shadow-2xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-stone-600">
          <span className="text-amber-400 font-bold text-sm">💬 Chat de la taverne</span>
        </div>
        <div className="overflow-y-auto max-h-[180px] min-h-[100px] p-2 space-y-1">
          {messages.length === 0 && (
            <p className="text-stone-500 text-sm text-center py-4">Aucun message. Dis bonjour !</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="font-semibold text-amber-300">{m.characterName}</span>
              <span className="text-stone-400 mx-1">:</span>
              <span className="text-stone-200">{m.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className="p-2 flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Écris un message…"
            maxLength={300}
            className="flex-1 px-3 py-2 bg-stone-800 border border-stone-600 rounded text-stone-200 placeholder-stone-500 focus:border-amber-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!chatInput.trim()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-900 font-bold rounded border border-amber-500 transition"
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
                    <span>🏰 Donjon Cave</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedProgression?.dungeon?.bestRun
                        ? `Niveau ${selectedProgression.dungeon.bestRun}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>🌲 Forêt</span>
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
                    <span>🔨 Forge</span>
                    <span className="text-amber-200 font-semibold">
                      {selectedCharacter?.forgeUpgrade ? '✓' : '—'}
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
