import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { simulerMatchV2 } from '../combat/v2CombatEngine';
import {
  V2_WEAPON_DUNGEON_FLOORS,
  getWeaponDungeonFloor,
} from '../data/v2WeaponDungeon';
import {
  flattenSpellCycles,
  getSpellById,
  getV2Weapon,
  normalizeSpellCycles,
  replaceSpellInCycles,
} from '../data/v2Kit';
import {
  V2_WEAPON_RARITY_LABEL,
  rollWeaponLoot,
} from '../data/v2Weapons';
import { ensureV2Prototype, saveV2Prototype } from '../services/v2PrototypeService';
import V2CombatView from './V2CombatView';

/**
 * Donjon d’armes V2 — 3 étages, loot 3 armes de la rareté de l’étage, équipement.
 */
export default function V2WeaponDungeon() {
  const { currentUser } = useAuth();
  const [proto, setProto] = useState(null);
  const [combatResult, setCombatResult] = useState(null);
  const [floorData, setFloorData] = useState(null);
  const [lootOptions, setLootOptions] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [equipMsg, setEquipMsg] = useState(null);

  const load = useCallback(async () => {
    if (!currentUser?.uid) return;
    const res = await ensureV2Prototype(currentUser.uid);
    if (res.success) setProto(res.data);
    else setError(res.error);
  }, [currentUser?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  const equipped = getV2Weapon(proto?.weaponId);

  const startFloor = (n) => {
    if (!proto) return;
    const data = getWeaponDungeonFloor(n);
    if (!data) return;
    setError(null);
    setEquipMsg(null);
    setLootOptions(null);
    setFloorData(data);
    setCombatResult(simulerMatchV2(proto, data.enemy));
  };

  const openLoot = () => {
    if (!floorData || combatResult?.winner !== 'player') return;
    setLootOptions(rollWeaponLoot(floorData.dropRarity, 3));
    setCombatResult(null);
  };

  const equipWeapon = async (weapon) => {
    if (!currentUser?.uid || !proto || !weapon) return;
    setBusy(true);
    setError(null);
    const oldWeapon = getV2Weapon(proto.weaponId);
    const oldSpellId = oldWeapon?.spellId;
    const cycles = replaceSpellInCycles(
      normalizeSpellCycles(proto),
      oldSpellId,
      weapon.spellId
    );
    const spellOrder = flattenSpellCycles(cycles);
    const patch = {
      weaponId: weapon.id,
      spellCycles: cycles,
      spellOrder,
    };
    const save = await saveV2Prototype(currentUser.uid, patch);
    setBusy(false);
    if (!save.success) {
      setError(save.error);
      return;
    }
    setProto({ ...proto, ...patch });
    setLootOptions(null);
    setFloorData(null);
    setEquipMsg(`${weapon.icon} ${weapon.name} équipée — sort ${getSpellById(weapon.spellId)?.name || weapon.spellId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-stone-100">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Link to="/v2" className="text-xs text-amber-500 hover:underline">
              ← Hub V2
            </Link>
            <h1 className="text-2xl font-bold text-amber-400">Donjon d’armes</h1>
            <p className="text-xs text-stone-400 mt-1">
              3 étages · commune / rare / légendaire
            </p>
          </div>
          {equipped && (
            <p className="text-sm text-stone-300 text-right">
              <span className="text-stone-500 text-xs block">Arme équipée</span>
              {equipped.icon} {equipped.name}
            </p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {equipMsg && <p className="text-emerald-400 text-sm">{equipMsg}</p>}

        {!combatResult && !lootOptions && (
          <div className="space-y-3">
            {V2_WEAPON_DUNGEON_FLOORS.map((f) => (
              <button
                key={f.floor}
                type="button"
                disabled={!proto || busy}
                onClick={() => startFloor(f.floor)}
                className="w-full text-left rounded-lg border border-stone-700 bg-stone-900/60 hover:border-amber-700/50 p-4 disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-stone-100">
                    {f.icon} Étage {f.floor} — {f.name}
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-amber-400/90">
                    {V2_WEAPON_RARITY_LABEL[f.dropRarity]}
                  </span>
                </div>
                <div className="text-xs text-stone-400 mt-1">
                  {f.enemy.icon} {f.enemy.name} · {f.difficulty}
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
            onClose={() => {
              setCombatResult(null);
              setFloorData(null);
            }}
            winActions={
              <button
                type="button"
                disabled={busy}
                onClick={openLoot}
                className="w-full py-2 rounded bg-amber-700/80 hover:bg-amber-600 text-stone-950 font-bold"
              >
                Voir le butin ({V2_WEAPON_RARITY_LABEL[floorData.dropRarity]})
              </button>
            }
          />
        )}

        {lootOptions && (
          <div className="space-y-3 rounded-xl border border-amber-700/40 bg-amber-950/15 p-4">
            <h2 className="text-lg font-bold text-amber-300">Choisis une arme</h2>
            <p className="text-xs text-stone-400">
              Équiper remplace ton arme actuelle et met à jour le sort d’arme dans ta rotation.
            </p>
            <div className="space-y-2">
              {lootOptions.map((w, i) => {
                const spell = getSpellById(w.spellId);
                return (
                  <button
                    key={`${w.id}-${i}`}
                    type="button"
                    disabled={busy}
                    onClick={() => equipWeapon(w)}
                    className="w-full text-left rounded-lg border border-stone-600 bg-stone-900/80 hover:border-amber-500/60 p-3 disabled:opacity-50"
                  >
                    <div className="font-semibold text-stone-100">
                      {w.icon} {w.name}{' '}
                      <span className="text-[10px] text-amber-400/80 uppercase">
                        {V2_WEAPON_RARITY_LABEL[w.rarity]}
                      </span>
                    </div>
                    <div className="text-xs text-stone-400 mt-1">
                      Sort : {spell?.icon} {spell?.name} — {spell?.description}
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                setLootOptions(null);
                setFloorData(null);
              }}
              className="w-full py-2 rounded border border-stone-600 text-stone-300 text-sm hover:bg-stone-800"
            >
              Refuser le butin
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
