import React, { useMemo } from 'react';
import CharacterCardContent from '../../components/CharacterCardContent';
import SharedTooltip from '../../components/SharedTooltip';
import { V2_PASSIVE, V2_SPELLS, computeFinalStats, getSpellById } from '../data/v2Kit';

/** Mappe un doc proto V2 vers la forme attendue par la carte V1. */
export function buildV2CardCharacter(proto) {
  if (!proto) return null;
  const finals = computeFinalStats(proto);
  return {
    name: proto.name,
    race: proto.race,
    class: proto.class,
    gender: proto.gender || 'male',
    level: proto.level ?? 1,
    characterImage: proto.characterImage || null,
    base: { ...finals },
    forestBoosts: {},
  };
}

function V2XpBar({ xp, xpToNext }) {
  const max = Math.max(1, Number(xpToNext) || 1);
  const cur = Math.max(0, Number(xp) || 0);
  const pct = Math.min(100, Math.round((cur / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-stone-400">
        <span>XP</span>
        <span>
          {cur}/{xpToNext || '—'}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-stone-900 border border-stone-600 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-300 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Carte personnage style V1 + panneau V2 (passif / rotation / XP).
 */
export default function V2CharacterCard({ proto, detailsPlacement = 'right', cardClassName = '' }) {
  const character = useMemo(() => buildV2CardCharacter(proto), [proto]);

  const detailsOverride = useMemo(() => {
    if (!proto) return null;
    const order = Array.isArray(proto.spellOrder) ? proto.spellOrder : [];
    return (
      <div className="space-y-3 text-xs text-stone-300">
        <div>
          <span className="text-amber-400/90 font-semibold">Passif V2 </span>
          {V2_PASSIVE.name}
          <p className="text-stone-500 mt-0.5">{V2_PASSIVE.description}</p>
        </div>
        {order.length > 0 && (
          <div>
            <span className="text-amber-400/90 font-semibold">Rotation </span>
            <ol className="mt-1 space-y-1 list-decimal list-inside text-stone-400">
              {order.map((id, i) => {
                const spell = getSpellById(id) || V2_SPELLS[id];
                const tip = (
                  <span className="whitespace-normal block text-left max-w-[260px] leading-relaxed">
                    <span className="text-amber-300 font-semibold">
                      {spell?.icon} {spell?.name || id}
                    </span>
                    <br />
                    <span className="text-stone-400">
                      Provenance : {spell?.sourceLabel || '—'}
                    </span>
                    <br />
                    <span className="text-stone-200">{spell?.description || ''}</span>
                  </span>
                );
                return (
                  <li key={`${id}-${i}`} className="marker:text-stone-500">
                    <SharedTooltip
                      content={tip}
                      tooltipClassName="whitespace-normal px-3 py-2 max-w-[280px] leading-relaxed"
                    >
                      <span className="text-stone-300 hover:text-amber-200">
                        {spell?.icon} {spell?.name || id}
                      </span>
                    </SharedTooltip>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        <V2XpBar xp={proto.xp} xpToNext={proto.xpToNext} />
      </div>
    );
  }, [proto]);

  if (!character) return null;

  return (
    <CharacterCardContent
      character={character}
      detailsPlacement={detailsPlacement}
      sidePanelIncludeStats={false}
      cardClassName={cardClassName}
      detailsOverride={detailsOverride}
    />
  );
}
