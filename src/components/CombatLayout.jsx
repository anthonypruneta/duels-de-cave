/**
 * CombatLayout — Layout partagé pour tous les écrans de combat.
 *
 * Mobile (< lg / 1024px) : mini-cartes compactes côte à côte + journal scrollable.
 * Desktop (lg+)           : 3 colonnes classiques (carte p1 | journal | carte p2).
 *
 * Props:
 *  p1Entity       : objet combat joueur  { name, currentHP, maxHP, shield?, base: { auto, def, cap, spd }, ability? }
 *  p2Entity       : objet combat adversaire (même forme)
 *  p1CombatBase   : override de base pour les stats p1 (optionnel)
 *  p2CombatBase   : override de base pour les stats p2 (optionnel)
 *  p1Card         : JSX de la carte complète p1 (desktop uniquement)
 *  p2Card         : JSX de la carte complète p2 (desktop uniquement)
 *  logRef         : ref React pour le scroll du journal (desktop)
 *  logTitle       : texte du titre du journal
 *  logTitleClass  : classes Tailwind pour le titre (défaut : texte blanc)
 *  logHeaderBg    : classe Tailwind pour le fond du header journal (défaut : bg-stone-900)
 *  logContainerClass : classes supplémentaires sur le conteneur journal (optionnel)
 *  renderLog      : () => JSX — contenu des entrées de journal (appelé dans mobile ET desktop)
 *  belowLog       : JSX optionnel affiché sous le journal (transitions BossRush, etc.)
 *  aboveLog       : JSX optionnel affiché au-dessus du journal dans la colonne centrale
 *  p1MobileExtra  : JSX optionnel sous la mini-carte p1 sur mobile
 */
import React from 'react';

const getMiniHpClass = (current, max) => {
  const pct = max > 0 ? current / max : 1;
  return pct > 0.5 ? 'bg-green-500' : pct > 0.25 ? 'bg-yellow-500' : 'bg-red-500';
};

export const MiniCard = ({ entity, combatBase, side }) => {
  if (!entity) return <div className="flex-1" />;
  const base = combatBase ?? entity.base ?? {};
  const maxHP = entity.maxHP ?? entity.base?.hp ?? 1;
  const currentHP = Math.max(0, entity.currentHP ?? maxHP);
  const shield = entity.shield ?? 0;
  const hpPct = maxHP > 0 ? Math.max(0, Math.min(100, (currentHP / maxHP) * 100)) : 100;
  const shieldPct = maxHP > 0 ? Math.min(100, (shield / maxHP) * 100) : 0;
  const borderColor = side === 'left' ? 'border-blue-500/40' : 'border-purple-500/40';
  const nameColor = side === 'left' ? 'text-blue-300' : 'text-purple-300';
  const image = entity.image ?? null;

  return (
    <div className={`flex-1 min-w-0 bg-stone-900/90 border ${borderColor} rounded-xl overflow-hidden`}>
      {/* Image + barre HP superposée */}
      {image && (
        <div className="relative w-full h-20 overflow-hidden bg-stone-800">
          <img
            src={image}
            alt={entity.name}
            className="w-full h-full object-contain object-center"
          />
          {/* HP bar en overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1">
            <div className="bg-stone-800/80 h-2 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getMiniHpClass(currentHP, maxHP)}`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
            {shieldPct > 0 && (
              <div className="bg-stone-800/80 h-1 rounded overflow-hidden mt-0.5 border border-blue-800/60">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${shieldPct}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-2">
        <div className={`text-xs font-bold ${nameColor} truncate mb-1`}>{entity.name || '—'}</div>
        <div className="text-[10px] text-stone-400 mb-1">
          PV {Math.round(currentHP)} / {maxHP}
        </div>

        {/* HP bar sans image */}
        {!image && (
          <>
            <div className="bg-stone-800 h-2 rounded overflow-hidden mb-1">
              <div
                className={`h-full transition-all duration-300 ${getMiniHpClass(currentHP, maxHP)}`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
            {shieldPct > 0 && (
              <div className="bg-stone-800 h-1.5 rounded overflow-hidden mb-1 border border-blue-800">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${shieldPct}%` }} />
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-x-2 text-[10px] text-stone-400">
          {[['Auto', base.auto], ['DEF', base.def], ['CAP', base.cap], ['VIT', base.spd]].map(([lbl, val]) =>
            val != null ? (
              <span key={lbl}>{lbl}: <span className="text-white font-semibold">{val}</span></span>
            ) : null
          )}
        </div>
        {entity.ability && (
          <div className="mt-1 text-[10px] text-amber-300 truncate">⚡ {entity.ability.name}</div>
        )}
      </div>
    </div>
  );
};

const CombatLayout = ({
  p1Entity,
  p2Entity,
  p1CombatBase,
  p2CombatBase,
  p1Card,
  p2Card,
  logRef,
  logTitle = '⚔️ Combat en direct',
  logTitleClass = 'text-xl font-bold text-stone-200 text-center',
  logHeaderBg = 'bg-stone-900',
  logContainerClass = '',
  renderLog,
  belowLog = null,
  aboveLog = null,
  p1MobileExtra = null,
}) => (
  <>
    {/* ── MOBILE (< 1024px) : mini-cartes + journal ── */}
    <div className="lg:hidden flex flex-col gap-2">
      <div className="flex gap-2">
        <MiniCard entity={p1Entity} combatBase={p1CombatBase} side="left" />
        <MiniCard entity={p2Entity} combatBase={p2CombatBase} side="right" />
      </div>
      {p1MobileExtra}
      {aboveLog && <div>{aboveLog}</div>}
      <div
        className={`bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col ${logContainerClass}`}
        style={{ height: 'calc(100dvh - 300px)', minHeight: '260px', maxHeight: '480px' }}
      >
        <div className={`${logHeaderBg} px-3 py-2 border-b border-stone-700 rounded-t-xl flex-shrink-0`}>
          <h2 className="text-sm font-bold text-stone-200 text-center">{logTitle}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
          {renderLog && renderLog()}
        </div>
      </div>
      {belowLog && <div>{belowLog}</div>}
    </div>

    {/* ── DESKTOP (1024px+) : 3 colonnes ── */}
    <div className="hidden lg:flex gap-4 items-stretch justify-center text-sm">
      <div className="w-[340px] flex-shrink-0">{p1Card}</div>

      <div className="flex-1 min-w-[400px] flex-shrink flex flex-col">
        {aboveLog && <div className="mb-3">{aboveLog}</div>}
        <div className={`bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col h-[600px] ${logContainerClass}`}>
          <div className={`${logHeaderBg} p-3 border-b border-stone-700 rounded-t-xl`}>
            <h2 className={logTitleClass}>{logTitle}</h2>
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
            {renderLog && renderLog()}
          </div>
        </div>
        {belowLog && <div className="mt-3">{belowLog}</div>}
      </div>

      <div className="w-[340px] flex-shrink-0">{p2Card}</div>
    </div>
  </>
);

export default CombatLayout;
