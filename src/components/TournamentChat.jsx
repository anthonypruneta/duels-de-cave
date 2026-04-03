import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter } from '../services/characterService';
import {
  subscribeTournamentChat,
  sendTournamentChatMessage,
} from '../services/tournamentChatService';

const STORAGE_KEY = 'tournamentChatPosition';

const MIN_WIDTH = 260;
const MIN_HEIGHT = 200;
const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 400;

function clampSize(width, height) {
  if (typeof window === 'undefined') {
    return {
      width: Math.max(MIN_WIDTH, width),
      height: Math.max(MIN_HEIGHT, height),
    };
  }
  const maxW = Math.max(MIN_WIDTH, window.innerWidth - 16);
  const maxH = Math.max(MIN_HEIGHT, window.innerHeight - 24);
  return {
    width: Math.min(Math.max(MIN_WIDTH, width), maxW),
    height: Math.min(Math.max(MIN_HEIGHT, height), maxH),
  };
}

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

function loadStoredLayout() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p.left !== 'number' || typeof p.top !== 'number') return null;
    const width = typeof p.width === 'number' ? p.width : DEFAULT_WIDTH;
    const height = typeof p.height === 'number' ? p.height : DEFAULT_HEIGHT;
    const { width: cw, height: ch } = clampSize(width, height);
    const { left, top } = clampPosition(p.left, p.top, cw, ch);
    return { left, top, width: cw, height: ch };
  } catch {
    return null;
  }
}

function defaultLayout() {
  if (typeof window === 'undefined') {
    return { left: 16, top: 96, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }
  const h = Math.min(480, Math.max(MIN_HEIGHT, Math.round(window.innerHeight * 0.65)));
  const w = DEFAULT_WIDTH;
  const stored = loadStoredLayout();
  if (stored) return stored;
  const pos = clampPosition(window.innerWidth - w - 16, 96, w, h);
  return { ...pos, width: w, height: h };
}

/**
 * Chat public pendant un tournoi — fenêtre flottante déplaçable et redimensionnable.
 */
export default function TournamentChat({ tournamentDocId }) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [layout, setLayout] = useState(defaultLayout);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const bottomRef = useRef(null);
  const panelRef = useRef(null);
  const dragPointerOffset = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const saveLayout = useCallback((L) => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ left: L.left, top: L.top, width: L.width, height: L.height })
      );
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
    if (resizing) return;
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragPointerOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setDragging(true);
    e.preventDefault();
  }, [resizing]);

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e) => {
      const { width: w, height: h } = layoutRef.current;
      const nextLeft = e.clientX - dragPointerOffset.current.x;
      const nextTop = e.clientY - dragPointerOffset.current.y;
      const pos = clampPosition(nextLeft, nextTop, w, h);
      setLayout((prev) => ({ ...prev, ...pos }));
    };

    const onUp = () => {
      setDragging(false);
      setLayout((prev) => {
        const pos = clampPosition(prev.left, prev.top, prev.width, prev.height);
        const next = { ...prev, ...pos };
        saveLayout(next);
        return next;
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
  }, [dragging, saveLayout]);

  useEffect(() => {
    if (!resizing) return undefined;

    const onMove = (e) => {
      const s = resizeStartRef.current;
      if (!s) return;
      const dw = e.clientX - s.mouseX;
      const dh = e.clientY - s.mouseY;
      const { width, height } = clampSize(s.width + dw, s.height + dh);
      setLayout((prev) => ({ ...prev, width, height }));
    };

    const onUp = () => {
      setResizing(false);
      resizeStartRef.current = null;
      setLayout((prev) => {
        const sized = clampSize(prev.width, prev.height);
        const pos = clampPosition(prev.left, prev.top, sized.width, sized.height);
        const next = { ...prev, ...sized, ...pos };
        saveLayout(next);
        return next;
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
  }, [resizing, saveLayout]);

  const handleResizeStart = useCallback(
    (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      resizeStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        width: layout.width,
        height: layout.height,
      };
      setResizing(true);
    },
    [layout.width, layout.height]
  );

  useEffect(() => {
    const onWinResize = () => {
      setLayout((prev) => {
        const sized = clampSize(prev.width, prev.height);
        const pos = clampPosition(prev.left, prev.top, sized.width, sized.height);
        return { ...prev, ...sized, ...pos };
      });
    };
    window.addEventListener('resize', onWinResize);
    return () => window.removeEventListener('resize', onWinResize);
  }, []);

  if (!tournamentDocId) return null;

  return (
    <div
      ref={panelRef}
      className={`fixed z-[100] bg-stone-950/95 border border-stone-700/80 rounded-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden backdrop-blur-sm ${
        dragging || resizing ? 'select-none' : ''
      }`}
      style={{
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
      }}
    >
      <div
        onPointerDown={handleDragStart}
        className={`shrink-0 px-3 py-2 border-b border-stone-700/60 bg-stone-900/80 rounded-t-xl ${
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
              En-tête : déplacer · coin bas-droite : taille · effacé à la fin
            </p>
          </div>
          <span className="text-stone-500 text-sm leading-none" aria-hidden>
            ⠿
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-transparent">
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

      <div className="shrink-0 p-2 border-t border-stone-700/60 flex gap-2">
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
          className="flex-1 min-w-0 bg-stone-900 border border-stone-600 rounded-lg px-2 py-1.5 text-stone-200 text-xs placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50"
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

      <div
        role="button"
        tabIndex={-1}
        aria-label="Redimensionner la fenêtre du chat"
        onPointerDown={handleResizeStart}
        className={`absolute bottom-0 right-0 z-[110] w-7 h-7 cursor-nwse-resize touch-none flex items-end justify-end rounded-br-xl ${
          resizing ? 'bg-amber-900/30' : 'hover:bg-stone-800/80'
        }`}
        title="Tirer pour agrandir ou réduire"
      >
        <span
          className="text-stone-500 text-xs leading-none pr-1 pb-1 select-none pointer-events-none"
          aria-hidden
        >
          ◢
        </span>
      </div>
    </div>
  );
}
