import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import narrateurImg from '../../assets/characters/Narrateur.png';
import {
  V2_LORE_STORY,
  getLoreEnding,
  getLoreNode,
  getLocalDateKey,
  isLoreEndingId,
} from '../data/v2LoreStories';
import { V2_STAT_KEYS, V2_STAT_LABELS, getEmptyV2StatBlock } from '../data/v2Kit';
import { ensureV2Prototype, saveV2Prototype } from '../services/v2PrototypeService';

/** Bulle BD au-dessus du narrateur. */
function SpeechBubble({ children, accent = 'amber' }) {
  const isEnd = accent === 'emerald';
  return (
    <div className="relative w-full max-w-md mx-auto px-2 z-10">
      <div
        className={`relative rounded-2xl border-[3px] px-4 py-3.5 shadow-[4px_4px_0_rgba(0,0,0,0.4)] ${
          isEnd
            ? 'border-emerald-800 bg-emerald-50 text-emerald-950'
            : 'border-stone-900 bg-[#f7f1e6] text-stone-900'
        }`}
      >
        <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap font-semibold text-center">
          {children}
        </p>
        {/* Queue BD vers le bas */}
        <span
          className={`absolute left-1/2 -translate-x-1/2 -bottom-[18px] w-0 h-0 border-l-[14px] border-r-[14px] border-t-[18px] border-l-transparent border-r-transparent ${
            isEnd ? 'border-t-emerald-800' : 'border-t-stone-900'
          }`}
          aria-hidden
        />
        <span
          className={`absolute left-1/2 -translate-x-1/2 -bottom-[14px] w-0 h-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent ${
            isEnd ? 'border-t-emerald-50' : 'border-t-[#f7f1e6]'
          }`}
          aria-hidden
        />
      </div>
    </div>
  );
}

function NarrateurScene({ bubbleText, bubbleAccent, choices, onPick, busy, footer }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <SpeechBubble accent={bubbleAccent}>{bubbleText}</SpeechBubble>

      <div className="relative w-full max-w-[280px] sm:max-w-[320px] mt-5">
        <img
          src={narrateurImg}
          alt="Narrateur"
          className="w-full h-auto object-contain drop-shadow-2xl select-none pointer-events-none"
          draggable={false}
        />
      </div>

      {choices?.length > 0 && (
        <div className="w-full max-w-lg space-y-2 mt-3">
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              onClick={() => onPick?.(c)}
              className="w-full text-left rounded-lg border border-stone-600 bg-stone-950/70 hover:border-amber-500/70 hover:bg-amber-950/30 px-4 py-3 text-sm text-stone-100 transition disabled:opacity-50"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {footer && <div className="w-full max-w-lg mt-3">{footer}</div>}
    </div>
  );
}

export default function V2LoreQuest() {
  const { currentUser } = useAuth();
  const [proto, setProto] = useState(null);
  const [nodeId, setNodeId] = useState(V2_LORE_STORY.startNodeId);
  const [ending, setEnding] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser?.uid) return;
    const res = await ensureV2Prototype(currentUser.uid);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setProto(res.data);
  }, [currentUser?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  const alreadyDone = proto?.lore?.lastCompletedDate === getLocalDateKey();

  const pickChoice = async (choice) => {
    if (isLoreEndingId(choice.next)) {
      const end = getLoreEnding(choice.next);
      setEnding(end);
      if (!currentUser?.uid || !proto || alreadyDone) return;

      setBusy(true);
      const loreBoosts = { ...getEmptyV2StatBlock(), ...(proto.loreBoosts || {}) };
      for (const key of V2_STAT_KEYS) {
        loreBoosts[key] = (loreBoosts[key] || 0) + (end.boosts?.[key] || 0);
      }
      const lore = {
        lastCompletedDate: getLocalDateKey(),
        lastEndingId: choice.next,
        lastPathLabel: end.pathLabel,
      };
      const save = await saveV2Prototype(currentUser.uid, { loreBoosts, lore });
      setBusy(false);
      if (!save.success) {
        setError(save.error);
        return;
      }
      setProto({ ...proto, loreBoosts, lore });
      return;
    }
    setNodeId(choice.next);
  };

  const node = getLoreNode(nodeId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-[#1a1510] to-stone-950 text-stone-100">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        <div>
          <Link to="/v2" className="text-xs text-amber-500 hover:underline">
            ← Hub V2
          </Link>
          <h1 className="text-2xl font-bold text-amber-400 mt-1">{V2_LORE_STORY.title}</h1>
          <p className="text-xs text-stone-500 mt-0.5">Quête du jour — narrée depuis la Cave</p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {alreadyDone && !ending && (
          <NarrateurScene
            bubbleText={
              proto?.lore?.lastPathLabel
                ? `Tu as déjà fait la quête du jour.\nDernière voie : ${proto.lore.lastPathLabel}.\nReviens demain pour un nouveau boost permanent.`
                : 'Tu as déjà fait la quête du jour. Reviens demain pour un nouveau boost permanent.'
            }
            footer={
              <Link
                to="/v2"
                className="block text-center text-sm text-amber-400 underline py-2"
              >
                Retour au hub
              </Link>
            }
          />
        )}

        {!alreadyDone && !ending && node && (
          <NarrateurScene
            bubbleText={node.text}
            choices={node.choices}
            onPick={pickChoice}
            busy={busy}
          />
        )}

        {ending && (
          <NarrateurScene
            bubbleText={`${ending.pathLabel}\n\n${ending.text}`}
            bubbleAccent="emerald"
            footer={
              <div className="space-y-2 text-center">
                <p className="text-sm text-amber-300">
                  Boost permanent :{' '}
                  {Object.entries(ending.boosts || {})
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => `+${v} ${V2_STAT_LABELS[k]}`)
                    .join(', ')}
                </p>
                <Link to="/v2" className="inline-block text-sm text-amber-400 underline">
                  Retour au hub
                </Link>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
