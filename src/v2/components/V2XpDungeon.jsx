import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { simulerMatchV2 } from '../combat/v2CombatEngine';
import { V2_XP_DUNGEON_FLOORS, getXpDungeonFloor } from '../data/v2XpDungeon';
import { applyXpGain } from '../services/v2Progression';
import { ensureV2Prototype, saveV2Prototype } from '../services/v2PrototypeService';
import V2CombatView from './V2CombatView';
import V2XpGainOverlay from './V2XpGainOverlay';

export default function V2XpDungeon() {
  const { currentUser } = useAuth();
  const [proto, setProto] = useState(null);
  const [floor, setFloor] = useState(1);
  const [combatResult, setCombatResult] = useState(null);
  const [floorData, setFloorData] = useState(null);
  const [xpAnim, setXpAnim] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser?.uid) return;
    const res = await ensureV2Prototype(currentUser.uid);
    if (res.success) setProto(res.data);
    else setError(res.error);
  }, [currentUser?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  const startFloor = (n) => {
    if (!proto) return;
    const data = getXpDungeonFloor(n);
    if (!data) return;
    setError(null);
    setXpAnim(null);
    setFloor(n);
    setFloorData(data);
    const result = simulerMatchV2(proto, data.enemy);
    setCombatResult(result);
  };

  const claimVictory = async () => {
    if (!currentUser?.uid || !proto || !floorData || combatResult?.winner !== 'player') return;
    setBusy(true);
    const beforeProto = { ...proto };
    const xpResult = applyXpGain(proto, floorData.xpReward);
    const patch = {
      level: xpResult.level,
      xp: xpResult.xp,
      xpToNext: xpResult.xpToNext,
      growthGains: xpResult.growthGains,
    };
    const save = await saveV2Prototype(currentUser.uid, patch);
    setBusy(false);
    if (!save.success) {
      setError(save.error);
      return;
    }
    const afterProto = { ...proto, ...patch };
    setProto(afterProto);
    setCombatResult(null);
    setXpAnim({
      beforeProto,
      afterProto,
      xpGained: floorData.xpReward,
      levelUps: xpResult.levelUps,
    });
    if (floor < 3) setFloor(floor + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-stone-100">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Link to="/v2" className="text-xs text-amber-500 hover:underline">
              ← Hub V2
            </Link>
            <h1 className="text-2xl font-bold text-amber-400">Donjon XP</h1>
          </div>
          {proto && (
            <p className="text-sm text-stone-400">
              Niv. {proto.level} · {proto.xp}/{proto.xpToNext || '—'} XP
            </p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!combatResult && !xpAnim && (
          <div className="space-y-3">
            {V2_XP_DUNGEON_FLOORS.map((f) => (
              <button
                key={f.floor}
                type="button"
                disabled={!proto || busy}
                onClick={() => startFloor(f.floor)}
                className="w-full text-left rounded-lg border border-stone-700 bg-stone-900/60 hover:border-amber-700/50 p-4 disabled:opacity-50"
              >
                <div className="font-bold text-stone-100">
                  Étage {f.floor} — {f.name}
                </div>
                <div className="text-xs text-stone-400 mt-1">
                  {f.enemy.icon} {f.enemy.name} · +{f.xpReward} XP
                </div>
              </button>
            ))}
          </div>
        )}

        {combatResult && floorData && (
          <V2CombatView
            result={combatResult}
            playerName={proto?.name}
            playerImage={proto?.characterImage}
            enemyName={floorData.enemy.name}
            enemyIcon={floorData.enemy.icon}
            onClose={() => setCombatResult(null)}
            winActions={
              <button
                type="button"
                disabled={busy}
                onClick={claimVictory}
                className="w-full py-2 rounded bg-amber-700/80 hover:bg-amber-600 text-stone-950 font-bold"
              >
                Réclamer +{floorData.xpReward} XP
              </button>
            }
          />
        )}
      </div>

      {xpAnim && (
        <V2XpGainOverlay
          beforeProto={xpAnim.beforeProto}
          afterProto={xpAnim.afterProto}
          xpGained={xpAnim.xpGained}
          levelUps={xpAnim.levelUps}
          onDone={() => setXpAnim(null)}
        />
      )}
    </div>
  );
}
