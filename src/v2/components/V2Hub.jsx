import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { flattenSpellCycles, getAvailableKitSpellIds, normalizeSpellCycles } from '../data/v2Kit';
import { getLocalDateKey } from '../data/v2LoreStories';
import {
  ensureV2Prototype,
  hasV2Champion,
  resetV2Prototype,
  saveV2Prototype,
} from '../services/v2PrototypeService';
import V2CharacterCard from './V2CharacterCard';
import V2RotationEditor from './V2RotationEditor';

export default function V2Hub() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [proto, setProto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [draftCycles, setDraftCycles] = useState(null);
  const [cyclesDirty, setCyclesDirty] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);

  const applyProto = useCallback((data) => {
    if (!data) {
      setProto(null);
      setDraftCycles(null);
      setCyclesDirty(false);
      return;
    }
    const spellCycles = normalizeSpellCycles(data);
    setProto({
      ...data,
      spellCycles,
      spellOrder: flattenSpellCycles(spellCycles),
    });
    setDraftCycles(spellCycles);
    setCyclesDirty(false);
  }, []);

  const load = useCallback(async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    setError(null);
    const res = await ensureV2Prototype(currentUser.uid);
    if (!res.success) {
      setError(res.error || 'Impossible de charger le proto V2');
      applyProto(null);
    } else {
      applyProto(res.data);
    }
    setLoading(false);
  }, [currentUser?.uid, applyProto]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSpellCyclesChange = (nextCycles) => {
    if (!proto) return;
    setDraftCycles(normalizeSpellCycles(nextCycles));
    setCyclesDirty(true);
    setSaveFeedback(null);
  };

  const handleSaveSpellCycles = async () => {
    if (!currentUser?.uid || !proto || !draftCycles) return;
    const spellCycles = normalizeSpellCycles(draftCycles);
    const spellOrder = flattenSpellCycles(spellCycles);
    setSaving(true);
    setSaveFeedback(null);
    try {
      const res = await saveV2Prototype(currentUser.uid, { spellCycles, spellOrder });
      if (!res.success) {
        setSaveFeedback(res.error || 'Échec de la sauvegarde');
        return;
      }
      setProto({ ...proto, spellCycles, spellOrder });
      setDraftCycles(spellCycles);
      setCyclesDirty(false);
      setSaveFeedback('Cycles enregistrés');
    } catch (err) {
      setSaveFeedback(err?.message || 'Erreur inattendue');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!currentUser?.uid) return;
    if (!window.confirm('Réinitialiser le proto V2 (champion, lore, labyrinthe) ?')) return;
    setSaving(true);
    const res = await resetV2Prototype(currentUser.uid);
    setSaving(false);
    if (res.success) {
      applyProto(res.data);
    } else setError(res.error);
  };

  const ready = hasV2Champion(proto);
  const loreDoneToday = proto?.lore?.lastCompletedDate === getLocalDateKey();

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-stone-100">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link to="/perso" className="text-xs text-stone-500 hover:text-amber-500">
              ← Jeu classique
            </Link>
            <p className="text-xs uppercase tracking-widest text-amber-500/80 mt-2">Sandbox</p>
            <h1 className="text-3xl font-bold text-amber-400">Proto V2</h1>
            <p className="text-sm text-stone-400 mt-1">
              Cycles de sorts · XP Fire Emblem · lore quotidien · laby 10 étages
            </p>
          </div>
          {ready && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || loading}
              className="text-xs px-3 py-1.5 rounded border border-red-800/60 text-red-300 hover:bg-red-950/40"
            >
              Reset proto
            </button>
          )}
        </div>

        {loading && <p className="text-stone-400">Chargement…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !ready && (
          <section className="rounded-xl border border-amber-700/40 bg-amber-950/15 p-8 text-center space-y-4">
            <p className="text-stone-300 text-sm max-w-md mx-auto">
              Un roll t’attend : Orc / Masochiste. Choisis ton nom et ton image, puis commence
              par la quête du jour.
            </p>
            <button
              type="button"
              onClick={() => navigate('/v2/champion')}
              className="inline-flex px-8 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-lg shadow-lg"
            >
              Choisir son champion
            </button>
          </section>
        )}

        {ready && proto && (
          <>
            <div className="flex justify-center">
              <V2CharacterCard proto={proto} />
            </div>
            <V2RotationEditor
              spellCycles={draftCycles ?? proto.spellCycles}
              spellOrder={proto.spellOrder}
              kitSpellIds={getAvailableKitSpellIds(proto)}
              onChange={handleSpellCyclesChange}
              onSave={handleSaveSpellCycles}
              dirty={cyclesDirty}
              saving={saving}
              saveFeedback={saveFeedback}
              disabled={saving}
            />

            <nav className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <ModeLink
                to="/v2/lore"
                title="Quête du jour"
                subtitle={loreDoneToday ? 'Déjà faite aujourd’hui' : 'Orc-en-ciel — 3 choix'}
                ready={!loreDoneToday}
              />
              <ModeLink to="/v2/donjon-xp" title="Donjon XP" subtitle="3 étages · level-ups FE" ready />
              <ModeLink
                to="/v2/donjon-armes"
                title="Donjon d’armes"
                subtitle="3 étages · commune → légendaire"
                ready
              />
              <ModeLink
                to="/v2/labyrinthe"
                title="Labyrinthe"
                subtitle={`Étage ${proto.labyrinth?.currentFloor ?? 1} / 10`}
                ready
              />
            </nav>
          </>
        )}
      </div>
    </div>
  );
}

function ModeLink({ to, title, subtitle, ready }) {
  return (
    <Link
      to={to}
      className={`rounded-lg border p-4 transition ${
        ready
          ? 'border-amber-700/50 bg-amber-950/20 hover:bg-amber-950/40'
          : 'border-stone-700 bg-stone-900/40 hover:bg-stone-900/70'
      }`}
    >
      <div className="font-bold text-amber-300">{title}</div>
      <div className="text-xs text-stone-400 mt-1">{subtitle}</div>
    </Link>
  );
}
