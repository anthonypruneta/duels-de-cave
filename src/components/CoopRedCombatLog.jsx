import React, { useRef, useLayoutEffect } from 'react';
import { formatCoopRedLogRichText } from './coopRedLogFormat';

function stripCoopActorPrefix(log) {
  if (log.startsWith('[Hôte]')) {
    return { kind: 'host', clean: log.slice(6).trimStart() };
  }
  if (log.startsWith('[Invité]')) {
    return { kind: 'guest', clean: log.slice(8).trimStart() };
  }
  if (log.startsWith('[Boss]')) {
    return { kind: 'boss', clean: log.slice(6).trimStart() };
  }
  return { kind: 'system', clean: log };
}

/**
 * Journal donjon Red : même présentation que le tournoi (bulles bleu / violet / boss, séparateurs de tour).
 */
export default function CoopRedCombatLog({
  lines,
  hostName = '',
  guestName = '',
  title = '⚔️ Combat en direct',
  emptyMessage = 'Le fil de combat apparaît ici…',
  /** Conteneur extérieur (bordure + ombre) */
  className = 'bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-lg flex flex-col overflow-hidden min-h-0',
  /** Hauteur du bloc (ex. clamp en arène, maxHeight sur la page salle) */
  containerStyle,
  /** Zone scroll */
  scrollClassName = 'flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5 scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-transparent',
}) {
  const scrollRef = useRef(null);

  // Toujours afficher la fin du journal (replay animé + combat terminé)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className={className} style={containerStyle}>
      <div className="p-3 border-b border-stone-700/60 shrink-0">
        <h2 className="text-sm font-bold text-stone-300 text-center uppercase tracking-wider">{title}</h2>
      </div>
      <div ref={scrollRef} className={scrollClassName}>
        {lines.length === 0 ? (
          <p className="text-stone-600 italic text-center py-8 text-sm">{emptyMessage}</p>
        ) : (
          lines.map((log, idx) => {
            const trimmed = log.trim();
            if (log.includes('🏆')) {
              return (
                <div key={idx} className="flex justify-center my-3">
                  <div className="bg-amber-500/10 border border-amber-500/50 text-amber-200 px-5 py-2 font-bold text-sm rounded-lg">
                    {trimmed}
                  </div>
                </div>
              );
            }
            if (log.includes('💀') && log.includes('Défaite')) {
              return (
                <div key={idx} className="flex justify-center my-3">
                  <div className="bg-red-950/40 border border-red-700/50 text-red-200 px-5 py-2 font-bold text-sm rounded-lg">
                    {trimmed}
                  </div>
                </div>
              );
            }
            if (log.includes('---')) {
              return (
                <div key={idx} className="flex justify-center my-2">
                  <div className="bg-stone-800/80 text-stone-400 px-4 py-1 text-xs font-bold rounded-md border border-stone-700/50">
                    {trimmed}
                  </div>
                </div>
              );
            }

            const { kind, clean } = stripCoopActorPrefix(log);

            if (kind === 'host') {
              return (
                <div key={idx} className="flex justify-start">
                  <div className="max-w-[80%]">
                    <div className="bg-stone-800/80 text-stone-200 px-3 py-2 rounded-r-lg rounded-tl-lg border-l-2 border-blue-500/70">
                      <div className="text-xs md:text-sm leading-snug whitespace-pre-wrap">
                        {formatCoopRedLogRichText(clean, hostName, guestName)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (kind === 'guest') {
              return (
                <div key={idx} className="flex justify-end">
                  <div className="max-w-[80%]">
                    <div className="bg-stone-800/80 text-stone-200 px-3 py-2 rounded-l-lg rounded-tr-lg border-r-2 border-purple-500/70">
                      <div className="text-xs md:text-sm leading-snug whitespace-pre-wrap">
                        {formatCoopRedLogRichText(clean, hostName, guestName)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (kind === 'boss') {
              return (
                <div key={idx} className="flex justify-end">
                  <div className="max-w-[80%]">
                    <div className="bg-stone-800/80 text-stone-200 px-3 py-2 rounded-l-lg rounded-tr-lg border-r-2 border-rose-500/75">
                      <div className="text-xs md:text-sm leading-snug whitespace-pre-wrap">
                        {formatCoopRedLogRichText(clean, hostName, guestName)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={idx} className="flex justify-center">
                <div className="text-stone-500 text-xs italic text-center max-w-[95%] whitespace-pre-wrap leading-snug">
                  {formatCoopRedLogRichText(clean, hostName, guestName)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
