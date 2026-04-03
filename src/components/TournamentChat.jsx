import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter } from '../services/characterService';
import {
  subscribeTournamentChat,
  sendTournamentChatMessage,
} from '../services/tournamentChatService';

/**
 * Chat public pendant un tournoi (même docId que le tournoi : current, simulation, legacy_…).
 */
export default function TournamentChat({ tournamentDocId, className = '' }) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.uid) return undefined;
    let cancelled = false;
    (async () => {
      const res = await getUserCharacter(currentUser.uid);
      if (cancelled) return;
      if (res.success && res.data?.name) {
        setDisplayName(res.data.name);
      } else {
        const fallback =
          currentUser.displayName ||
          (currentUser.email ? currentUser.email.split('@')[0] : 'Aventurier');
        setDisplayName(fallback);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!tournamentDocId) {
      setMessages([]);
      return undefined;
    }
    const unsub = subscribeTournamentChat(tournamentDocId, setMessages);
    return () => unsub();
  }, [tournamentDocId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !tournamentDocId || !currentUser?.uid || sending) return;
    setSending(true);
    try {
      await sendTournamentChatMessage(
        tournamentDocId,
        currentUser.uid,
        displayName || 'Aventurier',
        trimmed
      );
      setInput('');
    } catch (e) {
      console.error('Envoi message tournoi:', e);
    } finally {
      setSending(false);
    }
  }, [input, tournamentDocId, currentUser, displayName, sending]);

  if (!tournamentDocId) return null;

  return (
    <div
      className={`bg-stone-950/90 border border-stone-700/80 rounded-xl shadow-lg flex flex-col overflow-hidden min-h-[220px] max-h-[min(420px,50dvh)] ${className}`}
    >
      <div className="px-3 py-2 border-b border-stone-700/60 bg-stone-900/50">
        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider text-center">
          💬 Chat du tournoi
        </h3>
        <p className="text-[10px] text-stone-500 text-center mt-0.5">
          Effacé à la fin de l&apos;édition
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-transparent min-h-[120px]">
        {messages.length === 0 ? (
          <p className="text-stone-600 italic text-center text-xs py-6">
            Aucun message pour l&apos;instant…
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.userId === currentUser?.uid;
            return (
              <div
                key={m.id}
                className={`text-xs rounded-lg px-2 py-1.5 border ${
                  mine
                    ? 'bg-amber-950/40 border-amber-800/50 ml-4'
                    : 'bg-stone-900/80 border-stone-700/60 mr-4'
                }`}
              >
                <div className="font-bold text-amber-200/90 truncate">{m.characterName}</div>
                <div className="text-stone-200 break-words whitespace-pre-wrap">{m.text}</div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-2 border-t border-stone-700/60 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Écrire un message…"
          maxLength={400}
          disabled={!currentUser}
          className="flex-1 bg-stone-900 border border-stone-600 rounded-lg px-2 py-1.5 text-stone-200 text-xs placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!currentUser || sending || !input.trim()}
          className="shrink-0 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
        >
          {sending ? '…' : 'Envoyer'}
        </button>
      </div>
    </div>
  );
}
