import React from 'react';
import { COOP_RED_BOSS_NAME_COLORS } from './CoopRedLogLine';

export function escapeRegex(str) {
  if (str == null || str === '') return '';
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Surligne les nombres « X points de vie / dégâts » comme Combat / Tournoi.
 */
function appendDamageHealHighlights(part, out, keyRef) {
  const numRegex = /(\d+)\s*(points?\s*de\s*(?:vie|dégâts?|dommages?))/gi;
  let lastIndex = 0;
  let match;
  while ((match = numRegex.exec(part)) !== null) {
    if (match.index > lastIndex) {
      out.push(part.slice(lastIndex, match.index));
    }
    const isHeal = match[2].toLowerCase().includes('vie');
    out.push(
      <span key={`n-${keyRef.k++}`} className={isHeal ? 'font-bold text-green-400' : 'font-bold text-red-400'}>
        {match[1]}
      </span>
    );
    out.push(` ${match[2]}`);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < part.length) {
    out.push(part.slice(lastIndex));
  }
}

/**
 * Noms en bleu (hôte) / violet (invité) / couleurs boss Red ; chiffres dégâts/soins comme le tournoi.
 */
export function formatCoopRedLogRichText(text, hostName, guestName) {
  if (text == null || text === '') return null;

  const entries = [];
  if (hostName) {
    entries.push({ name: hostName, cls: 'font-bold text-blue-400' });
  }
  if (guestName) {
    entries.push({ name: guestName, cls: 'font-bold text-purple-400' });
  }
  for (const [bn, tw] of Object.entries(COOP_RED_BOSS_NAME_COLORS)) {
    entries.push({ name: bn, cls: `${tw} font-bold` });
  }
  entries.sort((a, b) => b.name.length - a.name.length);

  const pattern = entries
    .map((e) => escapeRegex(e.name))
    .filter(Boolean)
    .join('|');
  const keyRef = { k: 0 };
  const parts = [];

  if (!pattern) {
    appendDamageHealHighlights(text, parts, keyRef);
    return parts;
  }

  const nameRegex = new RegExp(`(${pattern})`, 'g');
  const chunks = text.split(nameRegex);

  chunks.forEach((chunk) => {
    if (!chunk) return;
    const found = entries.find((e) => e.name === chunk);
    if (found) {
      parts.push(
        <span key={`name-${keyRef.k++}`} className={found.cls}>
          {chunk}
        </span>
      );
    } else {
      appendDamageHealHighlights(chunk, parts, keyRef);
    }
  });

  return parts;
}
