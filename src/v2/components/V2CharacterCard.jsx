import React, { useMemo } from 'react';
import CharacterCardContent from '../../components/CharacterCardContent';
import SharedTooltip from '../../components/SharedTooltip';
import {
  V2_STAT_LABELS,
  computeFinalStats,
  getActiveKitSpellIds,
  getSpellDisplay,
  normalizePassiveIds,
} from '../data/v2Kit';
import { getV2Passive } from '../data/v2Passives';
import { getRacePassive } from '../data/v2Races';

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

const MAX_ACTIVE_SLOTS = 4;

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

function capsuleClass(variant = 'active') {
  if (variant === 'passive') {
    return 'flex items-center gap-1 rounded-full border border-amber-400/45 bg-gradient-to-r from-amber-950/90 via-amber-900/75 to-amber-950/80 px-1.5 py-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] min-h-[1.2rem]';
  }
  return 'flex items-center gap-1 rounded-full border border-sky-300/40 bg-gradient-to-r from-sky-950/85 via-sky-900/75 to-sky-950/70 px-1.5 py-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] min-h-[1.2rem]';
}

function SpellTooltipContent({ spell, fallbackId, emptyLabel }) {
  if (!spell) {
    return (
      <span className="whitespace-normal block text-left max-w-[260px] leading-relaxed text-stone-300">
        {emptyLabel || 'Emplacement vide'}
      </span>
    );
  }
  const typeLabel =
    spell.damageType === 'phys'
      ? 'Physique (vs DEF)'
      : spell.damageType === 'mag'
        ? 'Magique (vs ResC)'
        : null;
  return (
    <span className="whitespace-normal block text-left max-w-[260px] leading-relaxed">
      <span className="text-amber-300 font-semibold">
        {spell.icon} {spell.name || fallbackId}
      </span>
      {typeLabel && (
        <>
          <br />
          <span className="text-sky-300/90">{typeLabel}</span>
        </>
      )}
      <br />
      <span className="text-stone-400">Provenance : {spell.sourceLabel || '—'}</span>
      <br />
      <span className="text-stone-200">{spell.description || ''}</span>
    </span>
  );
}

function V2FeHeroesPanel({ proto, stats }) {
  const level = proto?.level ?? 1;
  const xp = Number(proto?.xp) || 0;
  const xpToNext = Number(proto?.xpToNext) || 0;
  const xpPct = xpToNext > 0 ? Math.min(100, Math.round((xp / xpToNext) * 100)) : 100;
  const xpLabel = xpToNext > 0 ? `${xp}/${xpToNext}` : 'MAX';

  const { activeRows, passiveRows } = useMemo(() => {
    const actives = getActiveKitSpellIds(proto).slice(0, MAX_ACTIVE_SLOTS);
    const activeRowsInner = actives.map((id) => {
      const spell = getSpellDisplay(id, proto);
      const badge = SOURCE_BADGE[spell?.source] || SOURCE_BADGE.weapon;
      return {
        key: `a-${id}`,
        icon: spell?.icon || '✨',
        label: spell?.name || id,
        badge,
        spell,
        id,
        empty: false,
      };
    });
    while (activeRowsInner.length < MAX_ACTIVE_SLOTS) {
      const i = activeRowsInner.length;
      activeRowsInner.push({
        key: `a-empty-${i}`,
        icon: '·',
        label: '—',
        badge: null,
        spell: null,
        id: null,
        empty: true,
      });
    }

    const passiveIds = normalizePassiveIds(proto);
    const passiveRowsInner = passiveIds.map((pid, i) => {
      const passive = getV2Passive(pid);
      const spell = passive?.spellId ? getSpellDisplay(passive.spellId, proto) : null;
      return {
        key: `p-${i}-${pid || 'empty'}`,
        icon: passive?.icon || spell?.icon || '·',
        label: passive?.name || 'Passif',
        badge: SOURCE_BADGE.passive,
        spell: spell
          ? { ...spell, sourceLabel: passive?.name || spell.sourceLabel }
          : null,
        id: passive?.spellId || null,
        empty: !passive,
        slotIndex: i + 1,
      };
    });

    return { activeRows: activeRowsInner, passiveRows: passiveRowsInner };
  }, [proto]);

  const subtitle = [proto?.race, proto?.class].filter(Boolean).join(' · ');
  const racePassive = getRacePassive(proto?.race);

  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end">
      <div className="relative z-[1] mx-auto mb-0.5 w-[70%] max-w-[14rem]">
        <div className="rounded-sm border border-amber-700/50 bg-gradient-to-b from-[#6b4a32]/95 to-[#3d2a1c]/95 px-2.5 py-1 text-center shadow-lg">
          <div className="text-[8px] uppercase tracking-[0.14em] text-amber-200/80 font-semibold truncate">
            {subtitle}
          </div>
          {racePassive && (
            <div
              className="text-[8px] text-red-200/90 truncate"
              title={racePassive.description}
            >
              {racePassive.icon} {racePassive.name}
            </div>
          )}
          <div
            className="character-card-name text-base font-bold text-white leading-tight truncate"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
          >
            {proto?.name || '—'}
          </div>
        </div>
      </div>

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
              <li key={key} className={capsuleClass('active')}>
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
            {activeRows.map((row) => (
              <li key={row.key} className="pointer-events-auto">
                <SharedTooltip
                  content={
                    <SpellTooltipContent spell={row.spell} fallbackId={row.id} emptyLabel="Slot actif vide" />
                  }
                  tooltipClassName="whitespace-normal px-3 py-2 max-w-[280px] leading-relaxed"
                >
                  <div
                    className={`${capsuleClass('active')} cursor-help hover:border-amber-300/60 ${
                      row.empty ? 'opacity-50' : ''
                    }`}
                  >
                    <span className="text-xs leading-none shrink-0 w-3.5 text-center">{row.icon}</span>
                    <span className="flex-1 min-w-0 text-[9px] font-semibold text-sky-50 truncate">
                      {row.label}
                    </span>
                    {row.badge && (
                      <span
                        className={`shrink-0 w-3.5 h-3.5 rounded-sm text-[8px] font-black flex items-center justify-center ${row.badge.className}`}
                      >
                        {row.badge.letter}
                      </span>
                    )}
                  </div>
                </SharedTooltip>
              </li>
            ))}
            {passiveRows.map((row) => (
              <li key={row.key} className="pointer-events-auto">
                <SharedTooltip
                  content={
                    <SpellTooltipContent
                      spell={row.spell}
                      fallbackId={row.id}
                      emptyLabel={`Emplacement passif ${row.slotIndex} — vide`}
                    />
                  }
                  tooltipClassName="whitespace-normal px-3 py-2 max-w-[280px] leading-relaxed"
                >
                  <div
                    className={`${capsuleClass('passive')} cursor-help hover:border-amber-200/70 ${
                      row.empty ? 'opacity-55' : ''
                    }`}
                  >
                    <span className="text-xs leading-none shrink-0 w-3.5 text-center">{row.icon}</span>
                    <span className="flex-1 min-w-0 text-[9px] font-semibold text-amber-50 truncate">
                      {row.empty ? `Passif ${row.slotIndex}` : row.label}
                    </span>
                    <span
                      className={`shrink-0 w-3.5 h-3.5 rounded-sm text-[8px] font-black flex items-center justify-center ${SOURCE_BADGE.passive.className}`}
                    >
                      P
                    </span>
                  </div>
                </SharedTooltip>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

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
