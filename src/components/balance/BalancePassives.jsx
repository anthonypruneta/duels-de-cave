import React from 'react';
import { DescriptionWithEditableSlots, NumberTreeEditor } from './BalanceEditors';
import { updateNestedValue, flattenNumericEntries, buildPartsFromEntries, buildAutoDescription } from './balanceUtils';

export default function BalancePassives({ passiveDraft, setPassiveDraft }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {passiveDraft.map((passive, idx) => (
        <div key={passive.id} className="bg-stone-950/70 border border-stone-700 rounded-lg p-4">
          <div className="font-bold text-white mb-2 text-sm">{passive.icon} {passive.name}</div>
          <div className="space-y-2 mb-3">
            {Object.entries(passive.levels || {}).map(([level, levelData]) => (
              <div key={`${passive.id}-${level}`} className="text-xs text-stone-300">
                <div className="mb-1 font-semibold text-amber-300/80">Niveau {level}</div>
                <DescriptionWithEditableSlots
                  parts={buildPartsFromEntries(flattenNumericEntries(levelData || {}, [idx, 'levels', level]))}
                  draft={passiveDraft}
                  onSlotChange={(path, value) => {
                    setPassiveDraft((prev) => prev.map((item, itemIdx) => {
                      if (itemIdx !== idx) return item;
                      const updated = updateNestedValue(item, path.slice(1), value);
                      const newLevelData = updated.levels?.[level];
                      const desc = buildAutoDescription(newLevelData || {});
                      return updateNestedValue(updated, ['levels', level, 'description'], desc);
                    }));
                  }}
                  className="text-stone-300"
                />
                <div className="text-[11px] text-stone-500 mt-1">Description: {levelData?.description}</div>
              </div>
            ))}
          </div>
          <NumberTreeEditor
            value={passive}
            onChange={(path, value) => {
              setPassiveDraft((prev) => prev.map((item, itemIdx) => {
                if (itemIdx !== idx) return item;
                const updated = updateNestedValue(item, path, value);
                const [, level] = path;
                if (!level) return updated;
                return updateNestedValue(updated, ['levels', level, 'description'], buildAutoDescription(updated.levels?.[level] || {}));
              }));
            }}
          />
        </div>
      ))}
    </div>
  );
}
