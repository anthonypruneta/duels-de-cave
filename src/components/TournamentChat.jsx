import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter } from '../services/characterService';
import {
  subscribeTournamentChat,
  sendTournamentChatMessage,
} from '../services/tournamentChatService';

const STORAGE_KEY = 'tournamentChatPosition';

function clampPosition(left, top, panelW, panelH) {
  if (typeof window === 'undefined') return { left, top };
  const margin = 8;
  const minVisible = 56;
  const maxLeft = Math.max(margin, window.innerWidth - panelW - margin);
  const maxTop = Math.max(margin, window.innerHeight - minVisible);
  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop),
  };
}

function loadStoredPosition(panelW, panelH) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p.left !== 'number' || typeof p.top !== 'number') return null;
    return clampPosition(p.left, p.top, panelW, panelH);
  } catch {
    return null;
  }
}

/**
 * Chat public pendant un tournoi — fenêtre flottante déplaçable (poignée sur l’en-tête).
 */
export default function TournamentChat({ tournamentDocId }) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { left: 16, top: 96 };
    const w = 320;
    const h = 380;
    const stored = loadStoredPosition(w, h);
    if (stored) return stored;
    return clampPosition(window.innerWidth - w - 16, 96, w, h);
  });
  const [dragging, setDragging] = useState(false);
  const bottomRef = useRef(null);
  const panelRef = useRef(null);
  const dragPointerOffset = useRef({ x: 0, y: 0 });

  const savePosition = useCallback((left, top) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ left, top }));
    } catch {
      /* ignore */
    }
  }, []);

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

  const handleDragStart = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragPointerOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setDragging(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e) => {
      const el = panelRef.current;
      const w = el?.offsetWidth ?? 320;
      const h = el?.offsetHeight ?? 400;
      const nextLeft = e.clientX - dragPointerOffset.current.x;
      const nextTop = e.clientY - dragPointerOffset.current.y;
      setPosition(clampPosition(nextLeft, nextTop, w, h));
    };

    const onUp = () => {
      setDragging(false);
      setPosition((p) => {
        const el = panelRef.current;
        const w = el?.offsetWidth ?? 320;
        const h = el?.offsetHeight ?? 400;
        const c = clampPosition(p.left, p.top, w, h);
        savePosition(c.left, c.top);
        return c;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, savePosition]);

  useEffect(() => {
    const onResize = () => {
      const el = panelRef.current;
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setPosition((p) => clampPosition(p.left, p.top, w, h));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!tournamentDocId) return null;

  return (
    <div
      ref={panelRef}
      className={`fixed z-[100] w-[min(calc(100vw-1rem),320px)] bg-stone-950/95 border border-stone-700/80 rounded-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden max-h-[min(480px,70dvh)] backdrop-blur-sm ${
        dragging ? 'select-none' : ''
      }`}
      style={{ left: position.left, top: position.top }}
    >
      <div
        onPointerDown={handleDragStart}
        className={`px-3 py-2 border-b border-stone-700/60 bg-stone-900/80 rounded-t-xl ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        } active:cursor-grabbing touch-none`}
        title="Glisser pour déplacer la fenêtre"
      >
        <div className="flex items-center gap-2">
          <span className="text-stone-500 text-sm leading-none" aria-hidden>
            ⠿
          </span>
          <div className="flex-1 min-w-0 text-center">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              💬 Chat du tournoi
            </h3>
            <p className="text-[10px] text-stone-500 mt-0.5">
              Glisser l&apos;en-tête pour déplacer · effacé à la fin
            </p>
          </div>
          <span className="text-stone-500 text-sm leading-none" aria-hidden>
            ⠿
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-transparent min-h-[100px]">
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

      <div className="p-2 border-t border-stone-700/60 flex gap-2 shrink-0">
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
