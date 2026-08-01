import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { simulerMatchV2 } from '../combat/v2CombatEngine';
import {
  V2_LABYRINTH_FLOOR_COUNT,
  buildV2LabyrinthEnemy,
  getV2LabyrinthXpReward,
  isV2LabyrinthBossFloor,
} from '../data/v2Labyrinth';
import { applyXpGain } from '../services/v2Progression';
import { ensureV2Prototype, saveV2Prototype } from '../services/v2PrototypeService';
import V2CombatView from './V2CombatView';
import V2XpGainOverlay from './V2XpGainOverlay';

export default function V2Labyrinth() {
  const { currentUser } = useAuth();
  const [proto, setProto] = useState(null);
  const [combatResult, setCombatResult] = useState(null);
  const [enemy, setEnemy] = useState(null);
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

  const currentFloor = proto?.labyrinth?.currentFloor ?? 1;
  const cleared = proto?.labyrinth?.highestCleared ?? 0;
  const finished = cleared >= V2_LABYRINTH_FLOOR_COUNT;

  const startFight = () => {
    if (!proto || finished) return;
    const floor = Math.min(currentFloor, V2_LABYRINTH_FLOOR_COUNT);
    const e = buildV2LabyrinthEnemy(floor);
    setEnemy(e);
    setXpAnim(null);
    setError(null);
    setCombatResult(simulerMatchV2(proto, e));
  };

  const claimVictory = async () => {
    if (!currentUser?.uid || !proto || !enemy || combatResult?.winner !== 'player') return;
    setBusy(true);
    const beforeProto = { ...proto };
    const floor = enemy.floor;
    const xpReward = getV2LabyrinthXpReward(floor);
    const xpResult = applyXpGain(proto, xpReward);
    const labyrinth = {
      currentFloor: Math.min(floor + 1, V2_LABYRINTH_FLOOR_COUNT),
      highestCleared: Math.max(proto.labyrinth?.highestCleared || 0, floor),
    };
    if (labyrinth.highestCleared >= V2_LABYRINTH_FLOOR_COUNT) {
      labyrinth.currentFloor = V2_LABYRINTH_FLOOR_COUNT;
    }
    const patch = {
      level: xpResult.level,
      xp: xpResult.xp,
      xpToNext: xpResult.xpToNext,
      growthGains: xpResult.growthGains,
      labyrinth,
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
    setEnemy(null);
    setXpAnim({
      beforeProto,
      afterProto,
      xpGained: xpReward,
      levelUps: xpResult.levelUps,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-stone-100">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Link to="/v2" className="text-xs text-amber-500 hover:underline">
              ← Hub V2
            </Link>
            <h1 className="text-2xl font-bold text-amber-400">Labyrinthe V2</h1>
            <p className="text-xs text-stone-500">10 étages · boss aux étages 5 et 10</p>
          </div>
          {proto && (
            <p className="text-sm text-stone-400">
              Niv. {proto.level} · meilleur {cleared}/{V2_LABYRINTH_FLOOR_COUNT}
            </p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!combatResult && !xpAnim && (
          <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-5 space-y-4">
            {finished ? (
              <p className="text-emerald-300">Labyrinthe terminé. Reset le proto pour recommencer.</p>
            ) : (
              <>
                <p className="text-stone-200">
                  Étage actuel : <span className="text-amber-300 font-bold">{currentFloor}</span>
                  {isV2LabyrinthBossFloor(currentFloor) && (
                    <span className="ml-2 text-red-400 text-sm">Boss</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: V2_LABYRINTH_FLOOR_COUNT }, (_, i) => i + 1).map((f) => (
                    <span
                      key={f}
                      className={`w-7 h-7 text-xs flex items-center justify-center rounded border ${
                        f <= cleared
                          ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                          : f === currentFloor
                            ? 'border-amber-600 bg-amber-950/40 text-amber-300'
                            : 'border-stone-700 text-stone-600'
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!proto || busy}
                  onClick={startFight}
                  className="px-4 py-2 rounded bg-amber-700/80 hover:bg-amber-600 text-stone-950 font-bold disabled:opacity-50"
                >
                  Combattre l’étage {currentFloor}
                </button>
              </>
            )}
          </div>
        )}

        {combatResult && enemy && (
          <V2CombatView
            result={combatResult}
            playerName={proto?.name}
            playerImage={proto?.characterImage}
            enemyName={enemy.name}
            enemyIcon={enemy.icon}
            onClose={() => {
              setCombatResult(null);
              setEnemy(null);
            }}
            winActions={
              <button
                type="button"
                disabled={busy}
                onClick={claimVictory}
                className="w-full py-2 rounded bg-amber-700/80 hover:bg-amber-600 text-stone-950 font-bold"
              >
                Continuer (+{getV2LabyrinthXpReward(enemy.floor)} XP)
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
