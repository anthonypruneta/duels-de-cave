import React, { useMemo } from 'react';
import CharacterCardContent from './CharacterCardContent';
import { MiniCard } from './CombatLayout';
import testImage1 from '../assets/characters/test.png';
import testImage2 from '../assets/characters/test2.png';
import { getCoopRedSpriteUrl } from '../utils/coopRedSprites';
import { getCoopRedBossMoveDisplay, scaleCoopRedBossBaseStats } from '../data/coopRedDungeon';
import { COOP_RED_BOSS_NAME_COLORS } from './CoopRedLogLine';
import CoopRedCombatLog from './CoopRedCombatLog';

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
  replaying,
  onRelanceReplay,
  logTitle = '🔴 Red — déroulé',
  wrapperClassName = 'mt-2 rounded-2xl border border-red-900/45 bg-stone-950/60 backdrop-blur-[1px] p-2 md:p-3',
  /** Aligne les PV max affichés sur les stats réelles du combat (multiplicateur par difficulté). */
  difficulty = null,
}) {
  const leftIsHost = focusLeftIsHost;
  const leftChar = leftIsHost ? hostF : guestF;
  const leftCardKey = `${leftIsHost ? 'host' : 'guest'}-${leftChar?.userId ?? leftChar?.name ?? 'unknown'}`;
  const leftBase = leftIsHost ? hostCombatBase : guestCombatBase;
  const leftStatus = leftIsHost ? hostCombatStatus : guestCombatStatus;
  const leftImg = leftIsHost ? hostF.characterImage ?? testImage1 : guestF.characterImage ?? testImage2;
  const hostImg = hostF?.characterImage ?? testImage1;
  const guestImg = guestF?.characterImage ?? testImage2;

  const activeBossDef = run.lineup?.[activeBossIdx] ?? null;
  const bossMaxHP =
    activeBossDef?.baseStats && difficulty
      ? scaleCoopRedBossBaseStats(activeBossDef.baseStats, difficulty).hp
      : activeBossDef?.baseStats?.hp ?? 1;
  const bossCurrentHP = bossHPs[activeBossIdx] ?? 0;
  const bossSprite = activeBossDef?.imageFile ? getCoopRedSpriteUrl(activeBossDef.imageFile) : null;

  const bossBaseForCard = useMemo(() => {
    if (!activeBossDef?.baseStats) return null;
    const base =
      difficulty != null ? scaleCoopRedBossBaseStats(activeBossDef.baseStats, difficulty) : { ...activeBossDef.baseStats };
    const snap = bossCombatBase;
    return snap ? { ...base, ...snap } : base;
  }, [activeBossDef, bossCombatBase, difficulty]);

  const bossCharacter = useMemo(() => {
    if (!activeBossDef || !bossBaseForCard) return null;
    const coopRedMoveDisplay = getCoopRedBossMoveDisplay(activeBossDef);
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
      coopRedBossIcon: activeBossDef.icon,
      coopRedMoveDisplay,
    };
  }, [activeBossDef, bossBaseForCard]);

  const leftHighlight =
    (leftIsHost && coopActor === 1) || (!leftIsHost && coopActor === 2)
      ? leftIsHost
        ? 'ring-violet-400'
        : 'ring-red-400'
      : null;

  const bossHighlight = coopActor === 3 ? 'ring-red-500' : null;

  return (
    <div className={`${wrapperClassName} w-full max-w-[1800px] mx-auto overflow-x-hidden`}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          disabled={replaying}
          onClick={onRelanceReplay}
          className="text-xs px-3 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-200 disabled:opacity-40"
        >
          Relancer le déroulé
        </button>
      </div>

      <div className="lg:hidden flex flex-col gap-2">
        <div className="rounded-lg border border-stone-600 bg-stone-900/80 px-2 py-2 text-[10px] text-stone-400">
          <p className="text-stone-500 font-bold uppercase text-center mb-1">Équipe</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-violet-300/90 font-semibold truncate flex items-center gap-1">
                <img src={hostImg} alt="" className="w-4 h-4 rounded object-cover border border-stone-600" />
                <span className="truncate">{hostF.name}</span>
              </p>
              <div className="h-1.5 bg-stone-800 rounded overflow-hidden mt-0.5">
                <div className="h-full bg-violet-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, (100 * hostF.currentHP) / (hostF.maxHP || 1)))}%` }} />
              </div>
              <p className="text-stone-500 mt-0.5">{hostF.currentHP} / {hostF.maxHP}</p>
            </div>
            <div>
              <p className="text-red-300/90 font-semibold truncate flex items-center gap-1">
                <img src={guestImg} alt="" className="w-4 h-4 rounded object-cover border border-stone-600" />
                <span className="truncate">{guestF.name}</span>
              </p>
              <div className="h-1.5 bg-stone-800 rounded overflow-hidden mt-0.5">
                <div className="h-full bg-red-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, (100 * guestF.currentHP) / (guestF.maxHP || 1)))}%` }} />
              </div>
              <p className="text-stone-500 mt-0.5">{guestF.currentHP} / {guestF.maxHP}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <MiniCard
            entity={{
              name: leftChar?.name,
              currentHP: leftChar?.currentHP,
              maxHP: leftChar?.maxHP,
              shield: leftChar?.shield ?? 0,
              base: leftBase ?? leftChar?.base ?? {},
              image: leftImg,
            }}
            side="left"
          />
          <MiniCard
            entity={{
              name: bossCharacter?.name,
              currentHP: bossCurrentHP,
              maxHP: bossMaxHP,
              shield: bossShield,
              base: bossCombatBase ?? bossCharacter?.base ?? {},
              image: bossSprite ?? undefined,
            }}
            side="right"
          />
        </div>
        <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl p-2">
          <p className="text-stone-500 text-[11px] font-bold uppercase text-center mb-2">Boss (rotation)</p>
          <div className="grid gap-2">
            {(run.lineup || []).map((boss, i) => {
              const maxH = boss?.baseStats && difficulty
                ? scaleCoopRedBossBaseStats(boss.baseStats, difficulty).hp
                : boss?.baseStats?.hp ?? 1;
              const cur = bossHPs[i] ?? 0;
              const pct = Math.min(100, Math.max(0, (cur / maxH) * 100));
              const isActive = activeBossIdx === i;
              const sprite = boss.imageFile ? getCoopRedSpriteUrl(boss.imageFile) : null;
              return (
                <div key={i} className={`rounded px-2 py-1 border ${isActive ? 'border-amber-500 bg-amber-950/30' : 'border-stone-700 bg-stone-900/50'}`}>
                  <div className="flex justify-between text-[10px] text-stone-300">
                    <span className="flex items-center gap-2 min-w-0">
                      {sprite ? <img src={sprite} alt="" className="w-6 h-6 object-contain flex-shrink-0" style={{ imageRendering: 'pixelated' }} /> : null}
                      <span className={`truncate ${COOP_RED_BOSS_NAME_COLORS[boss.nom] ?? 'text-stone-300'}`}>{boss.nom}</span>
                    </span>
                    <span>{cur}/{maxH}</span>
                  </div>
                  <div className="h-1.5 bg-stone-800 rounded overflow-hidden mt-1">
                    <div className="h-full bg-gradient-to-r from-red-800 to-amber-700 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <CoopRedCombatLog
          lines={combatLog}
          hostName={hostF?.name}
          guestName={guestF?.name}
          title={logTitle}
          containerStyle={{ height: 'calc(100dvh - 430px)', minHeight: '190px', maxHeight: '300px' }}
          className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden min-h-0 w-full"
        />
      </div>

      <div className="hidden lg:flex gap-4 items-stretch justify-center text-sm">
        <div className="w-[340px] flex-shrink-0 flex flex-col gap-3">
          <div className="rounded-lg border border-stone-600 bg-stone-900/80 px-3 py-2 text-[11px] text-stone-400">
            <p className="text-stone-500 font-bold uppercase text-center mb-2">Équipe</p>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <p className="text-violet-300/90 font-semibold truncate flex items-center gap-2">
                  <img src={hostImg} alt="" className="w-5 h-5 rounded object-cover border border-stone-600" />
                  <span className="truncate">{hostF.name}</span>
                </p>
                <div className="h-1.5 bg-stone-800 rounded overflow-hidden mt-0.5">
                  <div className="h-full bg-violet-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, (100 * hostF.currentHP) / (hostF.maxHP || 1)))}%` }} />
                </div>
                <p className="text-stone-500 mt-0.5">{hostF.currentHP} / {hostF.maxHP}</p>
              </div>
              <div>
                <p className="text-red-300/90 font-semibold truncate flex items-center gap-2">
                  <img src={guestImg} alt="" className="w-5 h-5 rounded object-cover border border-stone-600" />
                  <span className="truncate">{guestF.name}</span>
                </p>
                <div className="h-1.5 bg-stone-800 rounded overflow-hidden mt-0.5">
                  <div className="h-full bg-red-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, (100 * guestF.currentHP) / (guestF.maxHP || 1)))}%` }} />
                </div>
                <p className="text-stone-500 mt-0.5">{guestF.currentHP} / {guestF.maxHP}</p>
              </div>
            </div>
          </div>
          <div
            key={leftCardKey}
            className={`rounded-xl transition-all duration-300 ease-out ${
              leftHighlight ? `ring-2 ${leftHighlight} ring-offset-2 ring-offset-stone-950 scale-[1.02] z-[1]` : ''
            } ${coopActor === 3 ? 'opacity-90' : ''}`}
          >
            <CharacterCardContent
              character={leftChar}
              weaponOverride={leftChar?.equippedWeaponData ?? null}
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
        </div>

        <div className="flex-1 min-w-[400px] flex flex-col">
          <CoopRedCombatLog
            lines={combatLog}
            hostName={hostF?.name}
            guestName={guestF?.name}
            title={logTitle}
            containerStyle={{ height: '420px' }}
            className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden min-h-0 w-full min-w-0"
          />
        </div>

        <div className="w-[340px] flex-shrink-0 flex flex-col gap-3">
          <div className="bg-stone-900/90 border border-stone-600 rounded-lg px-3 py-2">
            <p className="text-stone-500 text-xs font-bold uppercase tracking-wide text-center">Boss (rotation)</p>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {(run.lineup || []).map((boss, i) => {
                const maxH = boss?.baseStats && difficulty
                  ? scaleCoopRedBossBaseStats(boss.baseStats, difficulty).hp
                  : boss?.baseStats?.hp ?? 1;
                const cur = bossHPs[i] ?? 0;
                const pct = Math.min(100, Math.max(0, (cur / maxH) * 100));
                const isActive = activeBossIdx === i;
                const sprite = boss.imageFile ? getCoopRedSpriteUrl(boss.imageFile) : null;
                return (
                  <div key={i} className={`rounded px-2 py-1 border ${isActive ? 'border-amber-600/80 bg-stone-900/80' : 'border-stone-700 bg-stone-900/40 opacity-80'}`}>
                    <div className="flex items-center gap-1 min-w-0 text-[10px]">
                      {sprite ? <img src={sprite} alt="" className="w-6 h-6 object-contain flex-shrink-0" style={{ imageRendering: 'pixelated' }} /> : null}
                      <span className={`truncate ${COOP_RED_BOSS_NAME_COLORS[boss.nom] ?? 'text-stone-300'}`}>{boss.nom}</span>
                    </div>
                    <div className="h-1.5 bg-stone-800 rounded overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-red-800 to-amber-700 transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-0.5 text-right">{cur}/{maxH}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={`rounded-xl transition-all duration-300 ease-out ${
            bossHighlight ? `ring-2 ${bossHighlight} ring-offset-2 ring-offset-stone-950 scale-[1.02] z-[1]` : ''
          } ${coopActor === 3 ? '' : 'opacity-95'}`}>
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
                detailsPlacement={null}
              />
            ) : (
              <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-6 text-stone-500 text-sm text-center">
                Boss indisponible
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
