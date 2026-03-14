import React, { useState, useMemo, useCallback } from 'react';
import { races } from '../../data/races';
import { DescriptionWithEditableSlots } from './BalanceEditors';
import { buildRaceBonusDescriptionParts, buildRaceAwakeningDescriptionParts, RACE_TO_CONSTANT_KEY } from '../../utils/descriptionBuilders';
import { updateNestedValue } from './balanceUtils';

export default function BalanceRaces({ raceBonusDraft, setRaceBonusDraft, raceAwakeningDraft, setRaceAwakeningDraft }) {
  const [raceTab, setRaceTab] = useState('bonus');
  const raceCards = Object.entries(races);

  const awakeningCombinedDraft = useMemo(() => ({
    ...raceAwakeningDraft,
    _bonus: raceBonusDraft,
  }), [raceAwakeningDraft, raceBonusDraft]);

  const handleAwakeningSlotChange = useCallback((path, value) => {
    if (path[0] === '_bonus') {
      setRaceBonusDraft((prev) => updateNestedValue(prev, path.slice(1), value));
    } else {
      setRaceAwakeningDraft((prev) => updateNestedValue(prev, path, value));
    }
  }, [setRaceBonusDraft, setRaceAwakeningDraft]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setRaceTab('bonus')}
          className={`px-4 py-2 rounded text-sm font-bold transition-colors ${raceTab === 'bonus' ? 'bg-amber-600 text-white' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
        >
          Bonus racial
        </button>
        <button
          onClick={() => setRaceTab('awakening')}
          className={`px-4 py-2 rounded text-sm font-bold transition-colors ${raceTab === 'awakening' ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
        >
          Éveil racial
        </button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {raceCards.map(([name, info]) => {
          const constantKey = RACE_TO_CONSTANT_KEY[name];
          const bonusValues = constantKey ? raceBonusDraft[constantKey] : null;

          return (
            <div key={name} className="bg-stone-950/70 border border-stone-700 rounded-lg p-4">
              <div className="font-bold text-white mb-2 text-sm">{info.icon} {name}</div>
              {raceTab === 'bonus' ? (
                <>
                  <div className="text-amber-300/90 text-[11px] mb-1 font-semibold">Bonus</div>
                  {constantKey && bonusValues ? (
                    <DescriptionWithEditableSlots
                      parts={buildRaceBonusDescriptionParts(name, raceBonusDraft[constantKey])}
                      draft={raceBonusDraft}
                      onSlotChange={(path, value) => setRaceBonusDraft((prev) => updateNestedValue(prev, path, value))}
                      className="text-stone-300"
                    />
                  ) : (
                    <div className="text-xs text-stone-500">{info.bonus}</div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-emerald-300/90 text-[11px] mb-1 font-semibold">Awakening</div>
                  <DescriptionWithEditableSlots
                    parts={buildRaceAwakeningDescriptionParts(name, raceAwakeningDraft[name])}
                    draft={awakeningCombinedDraft}
                    onSlotChange={handleAwakeningSlotChange}
                    className="text-emerald-200/90"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
