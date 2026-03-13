import React, { useMemo, useState } from 'react';
import { races } from '../../data/races';
import { classes } from '../../data/classes';
import { weapons, isWaveActive, RARITY } from '../../data/weapons';
import { getAvailablePassives, getMageTowerPassiveById } from '../../data/mageTowerPassives';
import { simulerMatch, preparerCombattant } from '../../utils/tournamentCombat';
import { createForestBossCombatant, FOREST_LEVELS } from '../../data/forestDungeons';
import { createMageTowerBossCombatant, MAGE_TOWER_LEVELS } from '../../data/mageTowerDungeons';
import { createBossCombatant } from '../../data/bosses';

const BOSS_OPTIONS = [
  { id: 'pvp', label: '⚔️ PvP (Joueur vs Joueur)' },
  { id: 'licorne', label: '🦄 Licorne (Forêt)' },
  { id: 'dragon', label: '🐲 Dragon (Donjon)' },
  { id: 'lich', label: '🧟 Liche (Tour de Mage)' }
];

const createBossForDuel = (bossId) => {
  if (bossId === 'licorne') {
    const bossData = FOREST_LEVELS.find(l => l.boss.id === 'licorne')?.boss;
    if (!bossData) return null;
    const boss = createForestBossCombatant(bossData);
    boss.shield = 0;
    boss.shieldExploded = false;
    return boss;
  }
  if (bossId === 'lich') {
    const bossData = MAGE_TOWER_LEVELS.find(l => l.boss.id === 'lich')?.boss;
    if (!bossData) return null;
    const boss = createMageTowerBossCombatant(bossData);
    boss.shield = Math.max(1, Math.round(boss.maxHP * 0.2));
    return boss;
  }
  if (bossId === 'dragon') {
    return createBossCombatant('dragon');
  }
  return null;
};

const PlayerConfig = ({ label, color, player, setPlayer, raceNames, classNames, availableWeapons, availablePassives }) => (
  <div className="bg-stone-950/70 border border-stone-700 rounded-lg p-4 space-y-2">
    <div className={`font-bold ${color}`}>{label}</div>
    <label className="flex items-center gap-2 text-xs text-stone-300">
      Race
      <select value={player.race} onChange={(e) => setPlayer((p) => ({ ...p, race: e.target.value }))}
        className="flex-1 px-2 py-1.5 bg-stone-900 border border-stone-600 text-white text-xs rounded">
        {raceNames.map((r) => <option key={r} value={r}>{races[r]?.icon} {r}</option>)}
      </select>
    </label>
    <label className="flex items-center gap-2 text-xs text-stone-300">
      Classe
      <select value={player.class} onChange={(e) => setPlayer((p) => ({ ...p, class: e.target.value }))}
        className="flex-1 px-2 py-1.5 bg-stone-900 border border-stone-600 text-white text-xs rounded">
        {classNames.map((c) => <option key={c} value={c}>{classes[c]?.icon} {c}</option>)}
      </select>
    </label>
    <label className="flex items-center gap-2 text-xs text-stone-300">
      Niveau
      <input type="number" min="1" max="400" value={player.level}
        onChange={(e) => setPlayer((p) => ({ ...p, level: Math.max(1, Number(e.target.value) || 1) }))}
        className="w-20 px-2 py-1.5 bg-stone-900 border border-stone-600 text-white text-xs rounded" />
    </label>
    <label className="flex items-center gap-2 text-xs text-stone-300">
      Arme
      <select value={player.weaponId} onChange={(e) => setPlayer((p) => ({ ...p, weaponId: e.target.value }))}
        className="flex-1 px-2 py-1.5 bg-stone-900 border border-stone-600 text-white text-xs rounded">
        {availableWeapons.map((w) => <option key={w.id} value={w.id}>{w.icon} {w.nom}</option>)}
      </select>
    </label>
    <label className="flex items-center gap-2 text-xs text-stone-300">
      Passif
      <select value={player.passiveId} onChange={(e) => setPlayer((p) => ({ ...p, passiveId: e.target.value }))}
        className="flex-1 px-2 py-1.5 bg-stone-900 border border-stone-600 text-white text-xs rounded">
        {availablePassives.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
      </select>
    </label>
    <label className="flex items-center gap-2 text-xs text-stone-300">
      Niv. passif
      <input type="number" min="1" max="3" value={player.passiveLevel}
        onChange={(e) => setPlayer((p) => ({ ...p, passiveLevel: Math.max(1, Math.min(3, Number(e.target.value) || 1)) }))}
        className="w-20 px-2 py-1.5 bg-stone-900 border border-stone-600 text-white text-xs rounded" />
    </label>
  </div>
);

export default function BalanceDuel({ withTemporaryDraftOverrides, makeCustomCharacter }) {
  const raceNames = useMemo(() => Object.keys(races), []);
  const classNames = useMemo(() => Object.keys(classes), []);
  const availableWeapons = useMemo(() => Object.values(weapons).filter((w) => isWaveActive(w.vague) && w.rarete === RARITY.LEGENDAIRE), []);
  const availablePassives = useMemo(() => getAvailablePassives(), []);

  const defaultWeaponId = availableWeapons[0]?.id || '';
  const defaultPassiveId = availablePassives[0]?.id || '';

  const [duelP1, setDuelP1] = useState({ race: raceNames[0], class: classNames[0], level: 1, weaponId: defaultWeaponId, passiveId: defaultPassiveId, passiveLevel: 1 });
  const [duelP2, setDuelP2] = useState({ race: raceNames[0], class: classNames[0], level: 1, weaponId: defaultWeaponId, passiveId: defaultPassiveId, passiveLevel: 1 });
  const [duelOpponent, setDuelOpponent] = useState('pvp');
  const [duelResult, setDuelResult] = useState(null);
  const [duelError, setDuelError] = useState('');

  const handleDuel = () => {
    setDuelError('');
    try {
      withTemporaryDraftOverrides(() => {
        const p1 = makeCustomCharacter('P1', duelP1.race, duelP1.class, duelP1.level, duelP1.weaponId, duelP1.passiveId, duelP1.passiveLevel);
        const p1Final = preparerCombattant(p1);
        const p1Display = { ...p1, base: p1Final.base };

        if (duelOpponent === 'pvp') {
          const p2 = makeCustomCharacter('P2', duelP2.race, duelP2.class, duelP2.level, duelP2.weaponId, duelP2.passiveId, duelP2.passiveLevel);
          const p2Final = preparerCombattant(p2);
          const result = simulerMatch(p1, p2);
          setDuelResult({ ...result, p1: p1Display, p2: { ...p2, base: p2Final.base } });
        } else {
          const boss = createBossForDuel(duelOpponent);
          if (!boss) return;
          const result = simulerMatch(p1, boss);
          setDuelResult({ ...result, p1: p1Display, p2: boss, isBoss: true });
        }
      });
    } catch (err) {
      console.error('Erreur duel:', err);
      setDuelError(err.message || 'Erreur inconnue');
    }
  };

  const sharedProps = { raceNames, classNames, availableWeapons, availablePassives };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-4">
        {BOSS_OPTIONS.map(({ id, label }) => (
          <button key={id} onClick={() => { setDuelOpponent(id); setDuelResult(null); setDuelError(''); }}
            className={`px-4 py-2 text-xs font-bold rounded border transition-colors ${duelOpponent === id
              ? 'bg-purple-600 border-purple-400 text-white'
              : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-400'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className={`grid ${duelOpponent === 'pvp' ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-xl'} gap-4`}>
        <PlayerConfig label={duelOpponent === 'pvp' ? 'Joueur 1' : 'Joueur'} color="text-blue-300" player={duelP1} setPlayer={setDuelP1} {...sharedProps} />
        {duelOpponent === 'pvp' && (
          <PlayerConfig label="Joueur 2" color="text-red-300" player={duelP2} setPlayer={setDuelP2} {...sharedProps} />
        )}
      </div>

      <button onClick={handleDuel} className="w-full max-w-xl bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded font-bold transition-colors">
        {duelOpponent === 'pvp' ? '⚔️ Lancer le duel' : '⚔️ Combattre le boss'}
      </button>

      {duelError && (
        <div className="bg-red-900/50 border border-red-500 rounded p-3 text-red-200 text-sm">❌ {duelError}</div>
      )}

      {duelResult && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-stone-950/70 border border-stone-600 rounded-lg p-4">
            <div className="text-sm">
              <span className="text-blue-300 font-bold">{duelResult.p1.name}</span>
              <span className="text-stone-500 text-xs ml-2">niv.{duelResult.p1.level} — HP:{duelResult.p1.base.hp} Auto:{duelResult.p1.base.auto} DEF:{duelResult.p1.base.def} CAP:{duelResult.p1.base.cap} RES:{duelResult.p1.base.rescap} SPD:{duelResult.p1.base.spd}</span>
              <span className="text-stone-400 text-xs block">Arme: {weapons[duelResult.p1.equippedWeaponId]?.icon} {weapons[duelResult.p1.equippedWeaponId]?.nom || 'Aucune'} · Passif: {getMageTowerPassiveById(duelResult.p1.mageTowerPassive?.id)?.icon} {getMageTowerPassiveById(duelResult.p1.mageTowerPassive?.id)?.name || 'Aucun'} (Niv.{duelResult.p1.mageTowerPassive?.level || 0})</span>
            </div>
            <span className="text-stone-500 font-bold px-4">VS</span>
            <div className="text-sm text-right">
              <span className="text-red-300 font-bold">{duelResult.p2.name}</span>
              <span className="text-stone-500 text-xs ml-2">{duelResult.p2.level ? `niv.${duelResult.p2.level} — ` : ''}HP:{duelResult.p2.base.hp} Auto:{duelResult.p2.base.auto} DEF:{duelResult.p2.base.def} CAP:{duelResult.p2.base.cap} RES:{duelResult.p2.base.rescap} SPD:{duelResult.p2.base.spd}</span>
              {!duelResult.isBoss && (
                <span className="text-stone-400 text-xs block">Arme: {weapons[duelResult.p2.equippedWeaponId]?.icon} {weapons[duelResult.p2.equippedWeaponId]?.nom || 'Aucune'} · Passif: {getMageTowerPassiveById(duelResult.p2.mageTowerPassive?.id)?.icon} {getMageTowerPassiveById(duelResult.p2.mageTowerPassive?.id)?.name || 'Aucun'} (Niv.{duelResult.p2.mageTowerPassive?.level || 0})</span>
              )}
            </div>
          </div>
          <div className="text-center text-lg font-bold text-amber-300">
            🏆 {duelResult.winnerNom} gagne !
          </div>
          <div className="bg-stone-950 border border-stone-700 rounded-lg p-3 max-h-[50vh] overflow-auto font-mono text-xs space-y-0.5">
            {duelResult.combatLog.map((line, i) => {
              const isP1 = line.startsWith('[P1]');
              const isP2 = line.startsWith('[P2]');
              const isTurn = line.startsWith('---');
              const isVictory = line.startsWith('🏆') || line.startsWith('⚔️');
              const cleanLine = line.replace(/^\[P[12]\]\s*/, '');
              return (
                <div key={i} className={
                  isTurn ? 'text-stone-500 font-bold mt-2 border-t border-stone-800 pt-1' :
                  isVictory ? 'text-amber-300 font-bold' :
                  isP1 ? 'text-blue-300' :
                  isP2 ? 'text-red-300' :
                  'text-stone-400'
                }>
                  {isP1 && <span className="text-blue-500 mr-1">[P1]</span>}
                  {isP2 && <span className="text-red-500 mr-1">[P2]</span>}
                  {(isP1 || isP2) ? cleanLine : line}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
