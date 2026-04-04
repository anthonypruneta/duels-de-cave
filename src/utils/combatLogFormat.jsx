import React from 'react';

function escapeRegex(str) {
  if (str == null) return '';
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Mise en forme des lignes de log (noms P1/P2, nombres, CRITIQUE) — partagé tournoi / PvP.
 */
export function formatCombatLogMessage(text, p1Name, p2Name) {
  const a = p1Name != null ? String(p1Name) : '';
  const b = p2Name != null ? String(p2Name) : '';
  if (!a.trim() || !b.trim()) return text;

  const parts = [];
  const nameRegex = new RegExp(`(${escapeRegex(a)}|${escapeRegex(b)})`, 'g');
  const nameParts = text.split(nameRegex);
  let key = 0;

  nameParts.forEach((part) => {
    if (part === a) {
      parts.push(<span key={key++} className="font-bold text-blue-400">{part}</span>);
    } else if (part === b) {
      parts.push(<span key={key++} className="font-bold text-purple-400">{part}</span>);
    } else if (part) {
      const numRegex =
        /(\d+)\s*(points?\s*de\s*(?:vie|dégâts?|dommages?)|PV(?:\s*max)?|dégâts?(?:\s*(?:magiques?|physiques?|bruts?))?)/gi;
      const critRegex = /(CRITIQUE\s*!?)/gi;
      let lastIndex = 0;
      let numMatch;
      const pushWithCritHighlight = (chunk) => {
        if (!chunk) return;
        const critParts = chunk.split(critRegex);
        critParts.forEach((critPart) => {
          if (!critPart) return;
          if (/^CRITIQUE\s*!?$/i.test(critPart)) {
            parts.push(<span key={key++} className="font-bold text-yellow-300">{critPart}</span>);
          } else {
            parts.push(critPart);
          }
        });
      };
      while ((numMatch = numRegex.exec(part)) !== null) {
        if (numMatch.index > lastIndex) pushWithCritHighlight(part.slice(lastIndex, numMatch.index));
        const token = numMatch[2].toLowerCase();
        const isHeal = token.includes('vie') || token.includes('pv');
        parts.push(
          <span key={key++} className={isHeal ? 'font-bold text-green-400' : 'font-bold text-red-400'}>
            {numMatch[1]}
          </span>
        );
        parts.push(` ${numMatch[2]}`);
        lastIndex = numMatch.index + numMatch[0].length;
      }
      if (lastIndex < part.length) pushWithCritHighlight(part.slice(lastIndex));
    }
  });

  return parts;
}
