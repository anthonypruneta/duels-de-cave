import React, { useMemo } from 'react';

/** Couleurs des noms de boss Red (affichage fil de combat). */
export const COOP_RED_BOSS_NAME_COLORS = {
  Salamèche: 'text-orange-400',
  Carapuce: 'text-sky-400',
  Bulbizarre: 'text-emerald-400',
  Pikachu: 'text-yellow-400',
  Ronflex: 'text-stone-400',
  Lokhlass: 'text-cyan-400',
  Dracaufeu: 'text-orange-500',
  Tortank: 'text-blue-500',
  Florizarre: 'text-green-500',
};

export function getCoopRedLogAlign(line) {
  const t = line.trimStart();
  if (/^--- Tour \d+ ---/.test(line.trim())) return 'center';
  if (/^\[Boss\]/.test(t)) return 'right';
  if (/^\[Hôte\]/.test(t) || /^\[Invité\]/.test(t)) return 'left';
  return 'left';
}

function buildColoredSpans(line, hostName, guestName) {
  const bossNames = Object.keys(COOP_RED_BOSS_NAME_COLORS).sort((a, b) => b.length - a.length);
  const namesToCheck = [];
  if (hostName) namesToCheck.push({ name: hostName, cls: 'text-violet-300 font-medium' });
  if (guestName) namesToCheck.push({ name: guestName, cls: 'text-red-300 font-medium' });
  for (const bn of bossNames) {
    namesToCheck.push({
      name: bn,
      cls: `${COOP_RED_BOSS_NAME_COLORS[bn]} font-medium`,
    });
  }
  namesToCheck.sort((a, b) => b.name.length - a.name.length);

  const out = [];
  let key = 0;
  let i = 0;
  let plain = '';

  const flushPlain = () => {
    if (plain) {
      out.push(
        <span key={key++} className="text-stone-200">
          {plain}
        </span>
      );
      plain = '';
    }
  };

  while (i < line.length) {
    if (line.startsWith('[Hôte]', i)) {
      flushPlain();
      out.push(
        <span key={key++} className="text-violet-400 font-semibold">
          [Hôte]
        </span>
      );
      i += 6;
      continue;
    }
    if (line.startsWith('[Invité]', i)) {
      flushPlain();
      out.push(
        <span key={key++} className="text-red-400 font-semibold">
          [Invité]
        </span>
      );
      i += 8;
      continue;
    }
    if (line.startsWith('[Boss]', i)) {
      flushPlain();
      out.push(
        <span key={key++} className="text-stone-500">
          [Boss]
        </span>
      );
      i += 6;
      continue;
    }

    let matched = null;
    for (const entry of namesToCheck) {
      if (entry.name && line.startsWith(entry.name, i)) {
        matched = entry;
        break;
      }
    }
    if (matched) {
      flushPlain();
      out.push(
        <span key={key++} className={matched.cls}>
          {matched.name}
        </span>
      );
      i += matched.name.length;
      continue;
    }

    plain += line[i];
    i += 1;
  }
  flushPlain();
  return out;
}

/**
 * Une ligne du journal Red : alignement (joueurs gauche, boss droite, séparateur de tour centré) + couleurs noms.
 */
export default function CoopRedLogLine({ line, hostName, guestName }) {
  const trimmed = line.trim();
  const isTour = /^--- Tour \d+ ---$/.test(trimmed);
  const align = isTour ? 'center' : getCoopRedLogAlign(line);
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  const nodes = useMemo(
    () => buildColoredSpans(line, hostName, guestName),
    [line, hostName, guestName]
  );

  if (isTour) {
    return (
      <p
        className={`text-xs md:text-sm leading-snug font-mono font-semibold whitespace-pre-wrap ${alignCls} text-amber-400/95`}
      >
        {trimmed}
      </p>
    );
  }

  return (
    <p className={`text-xs md:text-sm leading-snug font-mono whitespace-pre-wrap ${alignCls}`}>{nodes}</p>
  );
}
