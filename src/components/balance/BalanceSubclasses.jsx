import React from 'react';
import { NumberTreeEditor } from './BalanceEditors';
import { updateNestedValue } from './balanceUtils';
import { getSubclassById } from '../../data/subclasses';

export default function BalanceSubclasses({ subclassDraft, setSubclassDraft }) {
  return (
    <div>
      <p className="text-stone-400 text-sm mb-4">Valeurs réelles des ratios liés à la CAP (overridables comme pour les classes).</p>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Object.entries(subclassDraft).map(([subclassId, draft]) => {
          const info = getSubclassById(subclassId);
          if (!draft || typeof draft !== 'object') return null;
          if (Object.keys(draft).length === 0) return null;
          return (
            <div key={subclassId} className="bg-stone-950/70 border border-stone-700 rounded-lg p-4">
              <div className="font-bold text-white mb-1 text-sm">{info?.name ?? subclassId}</div>
              <div className="text-xs text-stone-400 mb-2">{info?.className ?? ''}</div>
              <NumberTreeEditor
                value={draft}
                onChange={(path, value) => setSubclassDraft((prev) => updateNestedValue(prev, path, value))}
                path={[subclassId]}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
