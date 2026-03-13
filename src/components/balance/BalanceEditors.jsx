import React, { useState } from 'react';
import { getNested, formatNumberFr } from './balanceUtils';

export const DescriptionWithEditableSlots = ({ parts, draft, onSlotChange, className = '', slotInputClass = '' }) => {
  const [editingValues, setEditingValues] = useState({});

  const slotDisplayValue = (rawVal, format) => formatNumberFr(rawVal, format);
  const parseSlotValue = (input, format) => {
    const normalized = String(input).replace(/,/g, '.');
    const num = Number(normalized);
    if (Number.isNaN(num)) return undefined;
    switch (format) {
      case 'percent':
      case 'percent1dec': return num / 100;
      case 'percentMinus1': return 1 + (num / 100);
      case 'percentReduction': return 1 - (num / 100);
      default: return num;
    }
  };

  return (
    <div className={`text-xs whitespace-pre-line ${className}`}>
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return <span key={idx}>{part.value}</span>;
        }
        if (part.type === 'slot') {
          const slotKey = part.path.join('.');
          const rawVal = getNested(draft, part.path);
          const displayVal = editingValues[slotKey] ?? slotDisplayValue(rawVal, part.format);
          return (
            <span key={idx} className="inline-flex items-center">
              [
              <input
                type="text"
                value={displayVal}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  setEditingValues((prev) => ({ ...prev, [slotKey]: inputValue }));
                  const parsed = parseSlotValue(inputValue, part.format);
                  if (parsed !== undefined) onSlotChange(part.path, parsed);
                }}
                onBlur={() => {
                  const currentVal = editingValues[slotKey];
                  const parsed = parseSlotValue(currentVal, part.format);
                  if (parsed !== undefined) onSlotChange(part.path, parsed);
                  setEditingValues((prev) => {
                    const next = { ...prev };
                    delete next[slotKey];
                    return next;
                  });
                }}
                onKeyDown={(e) => {
                  const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', '.', ',', '-'];
                  if (!allowed.includes(e.key) && (e.key < '0' || e.key > '9')) {
                    e.preventDefault();
                  }
                }}
                className={`w-14 text-center mx-0.5 px-1 py-0.5 bg-stone-800 border border-amber-600/70 text-amber-200 rounded ${slotInputClass}`}
              />
              ]
            </span>
          );
        }
        return null;
      })}
    </div>
  );
};

export const NumberTreeEditor = ({ value, onChange, path = [] }) => {
  const [editingValues, setEditingValues] = useState({});

  return (
    <div className="space-y-2">
      {Object.entries(value || {}).map(([key, val]) => {
        const keyPath = [...path, key];
        const fullPath = keyPath.join('.');

        if (val && typeof val === 'object' && !Array.isArray(val)) {
          return (
            <div key={fullPath} className="border border-stone-700 p-2 bg-stone-950/50">
              <div className="text-xs text-amber-300 font-semibold mb-2">{key}</div>
              <NumberTreeEditor value={val} onChange={onChange} path={keyPath} />
            </div>
          );
        }

        const isNumericOrEmpty = typeof val === 'number' || (typeof val === 'string' && (val === '' || !Number.isNaN(Number(val))));
        if (!isNumericOrEmpty) return null;

        const displayValue = editingValues[fullPath] !== undefined
          ? editingValues[fullPath]
          : (typeof val === 'number' ? (Number.isInteger(val) ? String(val) : String(val).replace('.', ',')) : (val === '' ? '' : String(val).replace('.', ',')));

        return (
          <label key={fullPath} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-stone-300">{key}</span>
            <input
              type="text"
              value={displayValue}
              onChange={(e) => {
                const inputValue = e.target.value;
                const filtered = inputValue.replace(/[^\d.,-]/g, '');
                setEditingValues(prev => ({ ...prev, [fullPath]: filtered }));
                const normalized = filtered.replace(/,/g, '.');
                if (normalized === '' || normalized === '-' || normalized.endsWith('.') || filtered.endsWith(',')) return;
                const num = Number(normalized);
                if (!Number.isNaN(num)) onChange(keyPath, num);
              }}
              onBlur={() => {
                const currentVal = editingValues[fullPath] !== undefined ? editingValues[fullPath] : displayValue;
                setEditingValues(prev => {
                  const newState = { ...prev };
                  delete newState[fullPath];
                  return newState;
                });
                const normalized = String(currentVal).replace(/,/g, '.');
                const num = Number(normalized);
                if (normalized !== '' && !Number.isNaN(num)) onChange(keyPath, num);
              }}
              className="w-28 px-2 py-1 bg-stone-900 border border-stone-600 text-white"
            />
          </label>
        );
      })}
    </div>
  );
};
