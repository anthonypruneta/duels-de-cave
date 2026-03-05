/**
 * Bloc d'affichage complet d'une sous-classe : nom, bonus, capacité, effet.
 * Utilisé dans la carte du personnage (CharacterCardContent, CharacterCreation, etc.).
 */

import React from 'react';
import { getSubclassById } from '../data/subclasses';
import { buildSubclassDescription } from '../utils/descriptionBuilders';

/**
 * @param {{ subclass: { id: string, name: string } | null, classIcon?: string }} props
 */
export default function SubclassDetailBlock({ subclass, classIcon = null }) {
  if (!subclass?.id) return null;

  const full = getSubclassById(subclass.id);
  if (!full) {
    return (
      <div className="subclass-gold-border subclass-gold-glow overflow-visible">
        <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300 subclass-gold-shine">
          {classIcon && <span className="text-lg">{classIcon}</span>}
          <div className="font-semibold subclass-gold-text">{subclass.name}</div>
        </div>
      </div>
    );
  }

  const description = buildSubclassDescription(full.className, subclass.id) || full.description;

  return (
    <div className="subclass-gold-border subclass-gold-glow overflow-visible">
      <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300 subclass-gold-shine">
        {classIcon && <span className="text-lg flex-shrink-0">{classIcon}</span>}
        <div className="flex-1 space-y-1 min-w-0">
          <div className="font-semibold subclass-gold-text">{full.name}</div>
          {full.bonus && (
            <div className="text-amber-200/90 text-[11px]">{full.bonus}</div>
          )}
          <div className="text-stone-300 text-[11px]">
            <span className="text-amber-300/90 font-medium">Capacité</span>
            <br />
            {full.abilityLabel}
          </div>
          <div className="text-stone-400 text-[11px]">
            <span className="text-amber-300/90 font-medium">Effet</span>
            <br />
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}
