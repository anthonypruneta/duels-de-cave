import React, { useMemo } from 'react';
import CharacterCardContent from '../../components/CharacterCardContent';
import SharedTooltip from '../../components/SharedTooltip';
import {
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

const SOURCE_BADGE = {
  weapon: { letter: 'W', className: 'bg-amber-500 text-amber-950' },
  race: { letter: 'R', className: 'bg-red-500 text-white' },
  class: { letter: 'C', className: 'bg-rose-500 text-white' },
  passive: { letter: 'P', className: 'bg-violet-500 text-white' },
};

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

function capsuleClass() {
  return 'flex items-center gap-1 rounded-full border border-sky-300/40 bg-gradient-to-r from-sky-950/85 via-sky-900/75 to-sky-950/70 px-1.5 py-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] min-h-[1.2rem]';
}

function SpellTooltipContent({ spell, fallbackId }) {
  return (
    <span className="whitespace-normal block text-left max-w-[260px] leading-relaxed">
      <span className="text-amber-300 font-semibold">
        {spell?.icon} {spell?.name || fallbackId}
      </span>
      <br />
      <span className="text-stone-400">Provenance : {spell?.sourceLabel || '—'}</span>
      <br />
      <span className="text-stone-200">{spell?.description || ''}</span>
    </span>
  );
}

/**
 * Panneau bas style Fire Emblem Heroes :
 * nameplate, LV/EXP, stats à gauche, skills à droite (hover provenance + effet).
 */
function V2FeHeroesPanel({ proto, stats }) {
  const level = proto?.level ?? 1;
  const xp = Number(proto?.xp) || 0;
  const xpToNext = Number(proto?.xpToNext) || 0;
  const xpPct = xpToNext > 0 ? Math.min(100, Math.round((xp / xpToNext) * 100)) : 100;
  const xpLabel = xpToNext > 0 ? `${xp}/${xpToNext}` : 'MAX';

  const skillRows = useMemo(() => {
    const order = Array.isArray(proto?.spellOrder) ? proto.spellOrder : [];
    return order.map((id, i) => {
      const spell = getSpellById(id) || V2_SPELLS[id];
      const badge = SOURCE_BADGE[spell?.source] || SOURCE_BADGE.passive;
      return {
        key: `${id}-${i}`,
        icon: spell?.icon || '✨',
        label: spell?.name || id,
        badge,
        spell,
        id,
      };
    });
  }, [proto?.spellOrder]);

  const subtitle = [proto?.race, proto?.class].filter(Boolean).join(' · ');

  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end">
      {/* Nameplate — compact */}
      <div className="relative z-[1] mx-auto mb-0.5 w-[70%] max-w-[14rem]">
        <div className="rounded-sm border border-amber-700/50 bg-gradient-to-b from-[#6b4a32]/95 to-[#3d2a1c]/95 px-2.5 py-1 text-center shadow-lg">
          <div className="text-[8px] uppercase tracking-[0.14em] text-amber-200/80 font-semibold truncate">
            {subtitle}
          </div>
          <div
            className="character-card-name text-base font-bold text-white leading-tight truncate"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
          >
            {proto?.name || '—'}
          </div>
        </div>
      </div>

      {/* Panneau teal FE — compact pour laisser le portrait visible */}
      <div className="mx-1.5 mb-1.5 rounded-lg border border-sky-400/35 bg-[#0a2a38]/88 backdrop-blur-[2px] px-1.5 pt-1 pb-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-2 mb-1 px-0.5">
          <div className="flex items-center gap-1 text-sky-50">
            <span className="text-xs leading-none">🪓</span>
            <span className="text-[9px] font-bold tracking-wide text-sky-200/90">LV.</span>
            <span className="text-sm font-black tabular-nums text-white leading-none">{level}</span>
          </div>
          <div className="flex-1 max-w-[58%] flex items-center gap-1">
            <span className="text-[8px] font-bold tracking-wider text-sky-200/80">EXP</span>
            <div className="flex-1 h-2.5 rounded-sm bg-sky-950/90 border border-sky-500/30 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-teal-700 to-teal-400"
                style={{ width: `${xpPct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-white/90 drop-shadow">
                {xpLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <ul className="space-y-[2px]">
            {FE_STAT_ROWS.map(({ key, label }) => (
              <li key={key} className={capsuleClass()}>
                <span className="text-[9px] font-bold uppercase tracking-wide text-sky-100/95 shrink-0">
                  {label || V2_STAT_LABELS[key]}
                </span>
                <span className="flex-1 text-right text-[11px] font-black tabular-nums text-amber-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.75)]">
                  {stats?.[key] ?? '—'}
                </span>
              </li>
            ))}
          </ul>

          <ul className="space-y-[2px]">
            {skillRows.map((row) => (
              <li key={row.key} className="pointer-events-auto">
                <SharedTooltip
                  content={<SpellTooltipContent spell={row.spell} fallbackId={row.id} />}
                  tooltipClassName="whitespace-normal px-3 py-2 max-w-[280px] leading-relaxed"
                >
                  <div className={`${capsuleClass()} cursor-help hover:border-amber-300/60 hover:from-sky-800/90`}>
                    <span className="text-xs leading-none shrink-0 w-3.5 text-center">{row.icon}</span>
                    <span className="flex-1 min-w-0 text-[9px] font-semibold text-sky-50 truncate">
                      {row.label}
                    </span>
                    <span
                      className={`shrink-0 w-3.5 h-3.5 rounded-sm text-[8px] font-black flex items-center justify-center ${row.badge.className}`}
                    >
                      {row.badge.letter}
                    </span>
                  </div>
                </SharedTooltip>
              </li>
            ))}
            {Array.from({ length: Math.max(0, FE_STAT_ROWS.length - skillRows.length) }).map((_, i) => (
              <li key={`empty-${i}`} className={capsuleClass()}>
                <span className="text-xs leading-none shrink-0 w-3.5 text-center opacity-40">·</span>
                <span className="flex-1 text-[9px] font-semibold text-sky-200/40">—</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Carte personnage V2 — disposition Fire Emblem Heroes (stats + skills sur le portrait).
 */
export default function V2CharacterCard({ proto, cardClassName = '' }) {
  const character = useMemo(() => buildV2CardCharacter(proto), [proto]);
  const finals = useMemo(() => computeFinalStats(proto), [proto]);

  const imageOverlayContent = useMemo(() => {
    if (!proto) return null;
    return <V2FeHeroesPanel proto={proto} stats={finals} />;
  }, [proto, finals]);

  if (!character) return null;

  return (
    <CharacterCardContent
      character={character}
      hideStats
      nameOnCard=""
      headerOverride=""
      imageOverlayContent={imageOverlayContent}
      imageClassName="min-h-[420px] object-cover object-top"
      cardClassName={`max-w-[460px] ${cardClassName}`.trim()}
      detailsOverride={null}
    />
  );
}
