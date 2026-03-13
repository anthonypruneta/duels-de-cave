import React, { useMemo } from 'react';
import { races } from '../../data/races';
import { classes } from '../../data/classes';
import { weapons } from '../../data/weapons';
import { getMageTowerPassiveById } from '../../data/mageTowerPassives';
import { getSubclassById } from '../../data/subclasses';

const WinRateBar = ({ rate }) => {
  const r = Number(rate);
  const color = r >= 55 ? 'bg-red-500' : r >= 52 ? 'bg-amber-500' : r <= 45 ? 'bg-blue-500' : r <= 48 ? 'bg-cyan-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 bg-stone-700 rounded overflow-hidden">
        <div className={`h-full ${color} rounded`} style={{ width: `${Math.min(100, r)}%` }} />
      </div>
      <span className="text-xs font-mono w-14 text-right">{rate}%</span>
    </div>
  );
};

const ResultBlock = ({ title, data, duelCount }) => (
  <div className="bg-stone-900/70 border border-stone-700 rounded-lg p-4">
    <h3 className="text-lg text-amber-300 font-bold mb-4">{title} <span className="text-stone-400 text-sm font-normal">({duelCount} duels)</span></h3>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 text-sm">
      <div>
        <div className="font-semibold text-stone-200 mb-2 border-b border-stone-700 pb-1">Races</div>
        <div className="space-y-1.5">
          {data.sortedRaces.map((row) => (
            <div key={row.race} className="flex items-center gap-2 text-stone-300">
              <span className="w-28 truncate">{races[row.race]?.icon} {row.race}</span>
              <WinRateBar rate={row.rate} />
              <span className="text-[10px] text-stone-500 w-10">({row.appearances})</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="font-semibold text-stone-200 mb-2 border-b border-stone-700 pb-1">Classes</div>
        <div className="space-y-1.5">
          {data.sortedClasses.map((row) => (
            <div key={row.clazz} className="flex items-center gap-2 text-stone-300">
              <span className="w-28 truncate">{classes[row.clazz]?.icon} {row.clazz}</span>
              <WinRateBar rate={row.rate} />
              <span className="text-[10px] text-stone-500 w-10">({row.appearances})</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="font-semibold text-stone-200 mb-2 border-b border-stone-700 pb-1">Sous-classes</div>
        <div className="space-y-1.5 max-h-64 overflow-auto pr-1">
          {data.sortedSubclasses.map((row) => {
            const sub = getSubclassById(row.subclassId);
            return (
              <div key={row.subclassId} className="flex items-center gap-2 text-stone-300">
                <span className="w-28 truncate" title={sub?.className}>{sub?.name ?? row.subclassId}</span>
                <WinRateBar rate={row.rate} />
                <span className="text-[10px] text-stone-500 w-10">({row.appearances})</span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="font-semibold text-stone-200 mb-2 border-b border-stone-700 pb-1">Armes</div>
        <div className="space-y-1.5 max-h-64 overflow-auto pr-1">
          {data.sortedWeapons.map((row) => (
            <div key={row.weaponId} className="flex items-center gap-2 text-stone-300">
              <span className="w-28 truncate">{weapons[row.weaponId]?.icon} {weapons[row.weaponId]?.nom}</span>
              <WinRateBar rate={row.rate} />
              <span className="text-[10px] text-stone-500 w-10">({row.appearances})</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="font-semibold text-stone-200 mb-2 border-b border-stone-700 pb-1">Passifs Tour de Mage</div>
        <div className="space-y-1.5 max-h-64 overflow-auto pr-1">
          {data.sortedPassives.map((row) => {
            const passive = getMageTowerPassiveById(row.passiveId);
            return (
              <div key={row.passiveId} className="flex items-center gap-2 text-stone-300">
                <span className="w-28 truncate">{passive?.icon} {passive?.name}</span>
                <WinRateBar rate={row.rate} />
                <span className="text-[10px] text-stone-500 w-10">({row.appearances})</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
);

export default function BalanceSimulation({ duels, setDuels, running, results, errorMessage, onRun }) {
  return (
    <div className="space-y-6">
      <div className="bg-stone-900/70 border border-amber-600/50 rounded-lg p-5">
        <h2 className="text-lg text-amber-300 font-bold mb-3">Simulation de masse</h2>
        <p className="text-stone-400 text-sm mb-4">
          Lance N duels aléatoires à 3 niveaux (1, 100, 400) pour mesurer les win rates de chaque race, classe, arme et passif.
        </p>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-stone-300 text-xs block mb-1">Nombre de duels par niveau</label>
            <input
              type="number" min="10" value={duels}
              onChange={(e) => setDuels(e.target.value)}
              className="px-3 py-2 bg-stone-800 border border-stone-600 text-white w-40 rounded"
            />
          </div>
          <button
            onClick={onRun} disabled={running}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:cursor-not-allowed text-white px-6 py-2 font-bold rounded transition-colors"
          >
            {running ? '⏳ Simulation en cours...' : '▶️ Lancer la simulation'}
          </button>
        </div>
        {errorMessage && (
          <div className="mt-3 bg-red-900/50 border border-red-500 rounded p-3 text-red-200 text-sm">
            ❌ {errorMessage}
          </div>
        )}
      </div>

      {results && (
        <div className="space-y-6">
          {[
            { key: 'level1', title: 'Niveau 1' },
            { key: 'level100', title: 'Niveau 100' },
            { key: 'level400', title: 'Niveau 400' }
          ].map(({ key, title }) => (
            <ResultBlock key={key} title={title} data={results[key]} duelCount={results.duelCount} />
          ))}
        </div>
      )}
    </div>
  );
}
