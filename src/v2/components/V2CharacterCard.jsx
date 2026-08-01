import React, { useMemo } from 'react';
import CharacterCardContent from '../../components/CharacterCardContent';
import SharedTooltip from '../../components/SharedTooltip';
import { calcCritChance, getCritMultiplier, generalConstants } from '../../data/combatMechanics';
import {
  V2_PASSIVE,
  V2_SPELLS,
  V2_STAT_LABELS,
  computeFinalStats,
  getSpellById,
} from '../data/v2Kit';

/** Ordre d’affichage style FE Heroes (HP → Atk → Spd → Def → Res…). */
const FE_STAT_ROWS = [
  { key: 'hp', label: 'HP' },
  { key: 'auto', label: 'Auto' },
  { key: 'spd', label: 'VIT' },
  { key: 'def', label: 'Déf' },
  { key: 'cap', label: 'Cap' },
  { key: 'rescap', label: 'ResC' },
];

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

/** Capsules de stats overlay portrait — disposition type Fire Emblem Heroes. */
function V2FeStatsOverlay({ name, stats, race, className: classLabel, level }) {
  const attacker = useMemo(
    () => ({ race, class: classLabel, base: stats || {} }),
    [race, classLabel, stats]
  );
  const ccPct = Math.round((calcCritChance(attacker) || 0) * 1000) / 10;
  const dcMult = getCritMultiplier(attacker) ?? generalConstants.critMultiplier;
  const dcText = `x${Number(dcMult).toFixed(2)}`;

  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end pointer-events-none">
      <div className="bg-gradient-to-t from-[#0a1628]/95 via-[#0c1a2e]/85 to-transparent pt-16 pb-2 px-2">
        <div className="text-center mb-2">
          <div
            className="character-card-name inline-block px-4 py-0.5 text-base font-bold tracking-wide text-white"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)' }}
          >
            {name}
          </div>
        </div>
        <div className="flex items-end justify-between gap-2">
          <ul className="w-[48%] min-w-[7.5rem] max-w-[9.5rem] space-y-[3px]">
            {FE_STAT_ROWS.map(({ key, label }) => (
              <li
                key={key}
                className="flex items-center justify-between gap-2 rounded-full border border-sky-300/45 bg-gradient-to-r from-sky-900/80 via-sky-800/70 to-sky-900/55 px-2.5 py-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-sky-100/95">
                  {label || V2_STAT_LABELS[key]}
                </span>
                <span className="text-sm font-black tabular-nums text-amber-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                  {stats?.[key] ?? '—'}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex-1 flex flex-col items-end gap-1 pb-0.5 pr-0.5">
            <div className="rounded-md border border-sky-400/35 bg-sky-950/70 px-2 py-1 text-[10px] text-sky-100/90">
              <div>
                CC <span className="font-bold text-amber-200">{ccPct}%</span>
              </div>
              <div>
                DC <span className="font-bold text-amber-200">{dcText}</span>
              </div>
            </div>
            <div className="text-[9px] text-sky-200/70 font-semibold tracking-wider">
              LV. {level ?? 1}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Carte personnage style V1 + panneau V2 (passif / rotation / XP).
 * Stats en capsules FE Heroes sur le portrait.
 */
export default function V2CharacterCard({ proto, detailsPlacement = 'right', cardClassName = '' }) {
  const character = useMemo(() => buildV2CardCharacter(proto), [proto]);
  const finals = useMemo(() => computeFinalStats(proto), [proto]);

  const imageOverlayContent = useMemo(() => {
    if (!proto) return null;
    return (
      <V2FeStatsOverlay
        name={proto.name}
        stats={finals}
        race={proto.race}
        className={proto.class}
        level={proto.level}
      />
    );
  }, [proto, finals]);

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
      hideStats
      nameOnCard=""
      imageOverlayContent={imageOverlayContent}
      cardClassName={cardClassName}
      detailsOverride={detailsOverride}
    />
  );
}
