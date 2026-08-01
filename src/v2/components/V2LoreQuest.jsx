import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  V2_LORE_STORY,
  getLoreEnding,
  getLoreNode,
  getLocalDateKey,
  isLoreEndingId,
} from '../data/v2LoreStories';
import { V2_STAT_KEYS, V2_STAT_LABELS, getEmptyV2StatBlock } from '../data/v2Kit';
import { ensureV2Prototype, saveV2Prototype } from '../services/v2PrototypeService';

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
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-stone-100">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Link to="/v2" className="text-xs text-amber-500 hover:underline">
          ← Hub V2
        </Link>
        <h1 className="text-2xl font-bold text-amber-400">{V2_LORE_STORY.title}</h1>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {alreadyDone && !ending && (
          <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-4 space-y-2">
            <p className="text-stone-300">Tu as déjà fait la quête du jour.</p>
            {proto?.lore?.lastPathLabel && (
              <p className="text-sm text-emerald-400">Dernière voie : {proto.lore.lastPathLabel}</p>
            )}
            <p className="text-xs text-stone-500">Reviens demain pour un nouveau boost permanent.</p>
          </div>
        )}

        {!alreadyDone && !ending && node && (
          <div className="rounded-lg border border-amber-800/40 bg-stone-900/70 p-5 space-y-4">
            <p className="text-stone-200 leading-relaxed whitespace-pre-wrap">{node.text}</p>
            <div className="space-y-2">
              {node.choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  onClick={() => pickChoice(c)}
                  className="w-full text-left rounded border border-stone-600 bg-stone-950/50 hover:border-amber-600/60 px-3 py-3 text-sm text-stone-100 disabled:opacity-50"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {ending && (
          <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-5 space-y-3">
            <p className="text-emerald-300 font-bold">{ending.pathLabel}</p>
            <p className="text-stone-200 leading-relaxed">{ending.text}</p>
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
        )}
      </div>
    </div>
  );
}
