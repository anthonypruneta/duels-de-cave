import React from 'react';
import { DescriptionWithEditableSlots, NumberTreeEditor } from './BalanceEditors';
import { updateNestedValue, flattenNumericEntries, buildPartsFromEntries, buildWeaponEffetDescriptionFromTemplate } from './balanceUtils';

export default function BalanceWeapons({ availableWeapons, weaponDraft, setWeaponDraft }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {availableWeapons.map((weapon) => {
        const draft = weaponDraft[weapon.id];
        if (!draft) return null;
        const statsParts = buildPartsFromEntries(flattenNumericEntries(draft.stats || {}, [weapon.id, 'stats']));
        const effectParts = buildPartsFromEntries(flattenNumericEntries(draft.effet?.values || {}, [weapon.id, 'effet', 'values']));
        return (
          <div key={weapon.id} className="bg-stone-950/70 border border-stone-700 rounded-lg p-4">
            <div className="font-bold text-white mb-2 text-sm">{weapon.icon} {weapon.nom}</div>
            <div className="text-xs text-stone-400 mb-2">{draft.description}</div>
            {statsParts.length > 0 && (
              <DescriptionWithEditableSlots
                parts={statsParts}
                draft={weaponDraft}
                onSlotChange={(path, value) => {
                  setWeaponDraft((prev) => ({
                    ...prev,
                    [weapon.id]: updateNestedValue(prev[weapon.id] || {}, path.slice(1), value)
                  }));
                }}
                className="text-stone-300 mb-2"
              />
            )}
            {draft.effet && effectParts.length > 0 && (
              <>
                <DescriptionWithEditableSlots
                  parts={effectParts}
                  draft={weaponDraft}
                  onSlotChange={(path, value) => {
                    setWeaponDraft((prev) => {
                      const updatedWeapon = updateNestedValue(prev[weapon.id] || {}, path.slice(1), value);
                      const desc = buildWeaponEffetDescriptionFromTemplate(weapon.id, updatedWeapon.effet);
                      const withDesc = desc ? updateNestedValue(updatedWeapon, ['effet', 'description'], desc) : updatedWeapon;
                      return { ...prev, [weapon.id]: withDesc };
                    });
                  }}
                  className="text-amber-200/90 mb-2"
                />
                <div className="text-xs text-amber-300/80 mb-2">Description: {draft.effet.description}</div>
              </>
            )}
            <NumberTreeEditor
              value={draft}
              onChange={(path, value) => {
                setWeaponDraft((prev) => {
                  const updatedWeapon = updateNestedValue(prev[weapon.id] || {}, path, value);
                  const desc = updatedWeapon.effet ? buildWeaponEffetDescriptionFromTemplate(weapon.id, updatedWeapon.effet) : '';
                  const withDesc = desc ? updateNestedValue(updatedWeapon, ['effet', 'description'], desc) : updatedWeapon;
                  return { ...prev, [weapon.id]: withDesc };
                });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
