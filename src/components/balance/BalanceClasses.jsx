import React from 'react';
import { classes } from '../../data/classes';
import { DescriptionWithEditableSlots } from './BalanceEditors';
import { buildClassDescriptionParts, CLASS_TO_CONSTANT_KEY } from '../../utils/descriptionBuilders';
import { updateNestedValue } from './balanceUtils';

export default function BalanceClasses({ classDraft, setClassDraft, classTextDraft }) {
  const classCards = Object.entries(classes);

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {classCards.map(([name, info]) => {
        const constantKey = CLASS_TO_CONSTANT_KEY[name];
        if (!constantKey || !classDraft[constantKey]) return null;
        return (
          <div key={name} className="bg-stone-950/70 border border-stone-700 rounded-lg p-4">
            <div className="font-bold text-white mb-1 text-sm">{info.icon} {name}</div>
            <div className="text-xs text-amber-300 mb-2">{classTextDraft[name]?.ability || info.ability}</div>
            <DescriptionWithEditableSlots
              parts={buildClassDescriptionParts(name, classDraft[constantKey])}
              draft={classDraft}
              onSlotChange={(path, value) => setClassDraft((prev) => updateNestedValue(prev, path, value))}
              className="text-stone-300"
            />
          </div>
        );
      })}
    </div>
  );
}
