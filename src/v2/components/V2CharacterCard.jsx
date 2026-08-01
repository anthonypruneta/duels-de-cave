import React, { useMemo } from 'react';
import CharacterCardContent from '../../components/CharacterCardContent';
import { getWeaponById } from '../../data/weapons';
import { V2_PASSIVE, V2_SPELLS, computeFinalStats, getSpellById } from '../data/v2Kit';

/** Mappe un doc proto V2 vers la forme attendue par la carte V1. */
export function buildV2CardCharacter(proto) {
  if (!proto) return null;
  const finals = computeFinalStats(proto);
  const weaponV1 = getWeaponById('arc_legendaire');
  // Affiche Arc des Cieux (visuel / effet) sans ajouter ses stats plate à l’affichage :
  // le combat V2 utilise déjà computeFinalStats sans bonus arme V1.
  const equippedWeaponData = weaponV1
    ? { ...weaponV1, stats: {} }
    : null;
  return {
    name: proto.name,
    race: proto.race,
    class: proto.class,
    gender: proto.gender || 'male',
    level: proto.level ?? 1,
    characterImage: proto.characterImage || null,
    base: { ...finals },
    forestBoosts: {},
    equippedWeaponId: 'arc_legendaire',
    equippedWeaponData,
  };
}

/**
 * Carte personnage style V1 (UnifiedCharacterCard / CharacterCardContent).
 */
export default function V2CharacterCard({ proto, detailsPlacement = 'right', cardClassName = '' }) {
  const character = useMemo(() => buildV2CardCharacter(proto), [proto]);

  const detailsAppend = useMemo(() => {
    if (!proto) return null;
    const order = Array.isArray(proto.spellOrder) ? proto.spellOrder : [];
    return (
      <div className="space-y-2 text-xs text-stone-300 border-t border-stone-700/60 pt-2 mt-1">
        <div>
          <span className="text-amber-400/90 font-semibold">Passif V2 </span>
          {V2_PASSIVE.name}
          <p className="text-stone-500 mt-0.5">{V2_PASSIVE.description}</p>
        </div>
        {order.length > 0 && (
          <div>
            <span className="text-amber-400/90 font-semibold">Rotation </span>
            <ol className="mt-1 space-y-0.5 list-decimal list-inside text-stone-400">
              {order.map((id, i) => {
                const spell = getSpellById(id) || V2_SPELLS[id];
                return (
                  <li key={`${id}-${i}`}>
                    {spell?.icon} {spell?.name || id}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        <p className="text-stone-500">
          XP {proto.xp ?? 0}/{proto.xpToNext || '—'}
        </p>
      </div>
    );
  }, [proto]);

  if (!character) return null;

  return (
    <CharacterCardContent
      character={character}
      detailsPlacement={detailsPlacement}
      cardClassName={cardClassName}
      detailsAppend={detailsAppend}
    />
  );
}
