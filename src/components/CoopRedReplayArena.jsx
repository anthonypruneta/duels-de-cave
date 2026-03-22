import React, { useMemo } from 'react';
import CharacterCardContent from './CharacterCardContent';
import testImage1 from '../assets/characters/test.png';
import testImage2 from '../assets/characters/test2.png';
import { getCoopRedSpriteUrl } from '../utils/coopRedSprites';

/**
 * Disposition type arène : joueur actif à gauche (switch hôte / invité au tour) | centre boss + log | boss actif à droite.
 */
export default function CoopRedReplayArena({
  run,
  hostF,
  guestF,
  hostCombatBase,
  guestCombatBase,
  hostCombatStatus,
  guestCombatStatus,
  bossCombatBase,
  bossCombatStatus,
  bossShield = 0,
  bossHPs,
  activeBossIdx,
  combatLog,
  coopActor,
  focusLeftIsHost,
  replaySpeed,
  setReplaySpeed,
  replaying,
  onRelanceReplay,
  logTitle = '🔴 Red — déroulé',
  wrapperClassName = 'mt-4 border border-red-900/60 rounded-lg p-4 bg-black/40',
}) {
  const leftIsHost = focusLeftIsHost;
  const leftChar = leftIsHost ? hostF : guestF;
  const leftBase = leftIsHost ? hostCombatBase : guestCombatBase;
  const leftStatus = leftIsHost ? hostCombatStatus : guestCombatStatus;
  const leftImg = leftIsHost ? hostF.characterImage ?? testImage1 : guestF.characterImage ?? testImage2;

  const activeBossDef = run.lineup?.[activeBossIdx] ?? null;
  const bossMaxHP = activeBossDef?.baseStats?.hp ?? 1;
  const bossCurrentHP = bossHPs[activeBossIdx] ?? 0;
  const bossSprite = activeBossDef?.imageFile ? getCoopRedSpriteUrl(activeBossDef.imageFile) : null;

  const bossBaseForCard = useMemo(() => {
    if (!activeBossDef?.baseStats) return null;
    const snap = bossCombatBase;
    return snap ? { ...activeBossDef.baseStats, ...snap } : { ...activeBossDef.baseStats };
  }, [activeBossDef, bossCombatBase]);

  const bossCharacter = useMemo(() => {
    if (!activeBossDef || !bossBaseForCard) return null;
    return {
      name: activeBossDef.nom,
      race: 'Boss',
      class: 'Boss',
      isBoss: true,
      bossId: activeBossDef.id,
      level: 1,
      userId: `coop-boss-arena-${activeBossDef.id}`,
      base: bossBaseForCard,
      bonuses: { race: {}, class: {} },
      forestBoosts: {},
      equippedWeaponId: null,
      equippedWeaponData: null,
      mageTowerPassive: null,
      subclass: null,
      forgeUpgrade: null,
      additionalAwakeningRaces: [],
    };
  }, [activeBossDef, bossBaseForCard]);

  const leftHighlight =
    (leftIsHost && coopActor === 1) || (!leftIsHost && coopActor === 2)
      ? leftIsHost
        ? 'ring-blue-400'
        : 'ring-violet-400'
      : null;

  const bossHighlight = coopActor === 3 ? 'ring-red-500' : null;

  return (
    <div className={wrapperClassName}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-stone-500 text-xs flex items-center gap-2">
          Vitesse
          <select
            value={replaySpeed}
            onChange={(e) => setReplaySpeed(e.target.value)}
            disabled={replaying}
            className="bg-stone-800 border border-stone-600 rounded px-2 py-1 text-white text-xs"
          >
            <option value="normal">Normal</option>
            <option value="fast">Rapide</option>
            <option value="turbo">Turbo</option>
          </select>
        </label>
        <button
          type="button"
          disabled={replaying}
          onClick={onRelanceReplay}
          className="text-xs px-3 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-200 disabled:opacity-40"
        >
          Relancer le déroulé
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base max-w-[1800px] mx-auto">
        <div
          className={`order-1 md:order-1 w-full md:w-[340px] lg:w-auto md:flex-shrink-0 rounded-xl transition-all duration-300 ease-out ${
            leftHighlight
              ? `ring-2 ${leftHighlight} ring-offset-2 ring-offset-stone-950 scale-[1.02] z-[1]`
              : ''
          } ${coopActor === 3 ? 'opacity-90' : ''}`}
        >
          <CharacterCardContent
            key={leftIsHost ? 'slot-left-host' : 'slot-left-guest'}
            character={leftChar}
            showHpBar
            currentHP={leftChar.currentHP}
            maxHP={leftChar.maxHP}
            shield={leftChar.shield ?? 0}
            combatBaseOverride={leftBase}
            combatStatus={leftStatus}
            opponent={bossCharacter ?? leftChar}
            imageOverride={leftImg}
            detailsPlacement="left"
          />
        </div>

        <div className="order-2 md:order-2 w-full md:w-[600px] lg:w-[500px] lg:flex-1 lg:min-w-[400px] md:flex-shrink-0 lg:flex-shrink flex flex-col gap-3">
          <div className="rounded-lg border border-stone-600 bg-stone-900/80 px-3 py-2 text-[11px] text-stone-400">
            <p className="text-stone-500 font-bold uppercase text-center mb-2">Équipe</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-blue-300/90 font-semibold truncate">{hostF.name}</p>
                <div className="h-1.5 bg-stone-800 rounded overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, (100 * hostF.currentHP) / (hostF.maxHP || 1)))}%`,
                    }}
                  />
                </div>
                <p className="text-stone-500 mt-0.5">
                  {hostF.currentHP} / {hostF.maxHP}
                </p>
              </div>
              <div>
                <p className="text-violet-300/90 font-semibold truncate">{guestF.name}</p>
                <div className="h-1.5 bg-stone-800 rounded overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-violet-600 transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, (100 * guestF.currentHP) / (guestF.maxHP || 1)))}%`,
                    }}
                  />
                </div>
                <p className="text-stone-500 mt-0.5">
                  {guestF.currentHP} / {guestF.maxHP}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-stone-900/90 border border-stone-600 rounded-lg px-3 py-2">
            <p className="text-stone-500 text-xs font-bold uppercase tracking-wide text-center">Boss (rotation)</p>
            <div className="grid gap-2 mt-2">
              {(run.lineup || []).map((boss, i) => {
                const maxH = boss?.baseStats?.hp ?? 1;
                const cur = bossHPs[i] ?? 0;
                const pct = Math.min(100, Math.max(0, (cur / maxH) * 100));
                const isActive = activeBossIdx === i;
                const rowBossHighlight = coopActor === 3 && isActive;
                const sprite = boss.imageFile ? getCoopRedSpriteUrl(boss.imageFile) : null;
                return (
                  <div
                    key={i}
                    className={`rounded-lg px-2 py-1.5 border transition ${
                      rowBossHighlight
                        ? 'border-red-400 bg-red-950/40'
                        : isActive
                          ? 'border-amber-600/80 bg-stone-900/80'
                          : 'border-stone-700 bg-stone-900/40 opacity-70'
                    }`}
                  >
                    <div className="flex justify-between text-[11px] text-stone-400 mb-1 gap-2 items-center">
                      <span className="flex items-center gap-2 min-w-0 text-stone-300 font-medium">
                        {sprite ? (
                          <img
                            src={sprite}
                            alt=""
                            className="w-9 h-9 object-contain flex-shrink-0"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        ) : null}
                        <span className="truncate">{boss.nom}</span>
                      </span>
                      <span className="flex-shrink-0">
                        {cur} / {maxH}
                      </span>
                    </div>
                    <div className="h-2 bg-stone-800 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-800 to-amber-700 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[360px] md:h-[480px]">
            <div className="bg-stone-900 p-3 border-b border-stone-600">
              <h2 className="text-lg md:text-xl font-bold text-stone-200 text-center">{logTitle}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
              {combatLog.length === 0 ? (
                <p className="text-stone-500 italic text-center py-6 text-sm">Le fil de combat apparaît ici…</p>
              ) : (
                combatLog.map((line, idx) => (
                  <p key={idx} className="text-xs md:text-sm text-stone-200 leading-snug font-mono whitespace-pre-wrap">
                    {line}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>

        <div
          className={`order-3 md:order-3 w-full md:w-[340px] lg:w-auto md:flex-shrink-0 rounded-xl transition-all duration-300 ease-out ${
            bossHighlight
              ? `ring-2 ${bossHighlight} ring-offset-2 ring-offset-stone-950 scale-[1.02] z-[1]`
              : ''
          } ${coopActor === 3 ? '' : 'opacity-95'}`}
        >
          {bossCharacter ? (
            <CharacterCardContent
              key={`boss-slot-${activeBossIdx}-${activeBossDef.id}`}
              character={bossCharacter}
              showHpBar
              currentHP={bossCurrentHP}
              maxHP={bossMaxHP}
              shield={bossShield}
              combatBaseOverride={bossCombatBase}
              combatStatus={bossCombatStatus}
              opponent={leftChar}
              imageOverride={bossSprite ?? undefined}
              detailsPlacement="right"
            />
          ) : (
            <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-6 text-stone-500 text-sm text-center">
              Boss indisponible
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
