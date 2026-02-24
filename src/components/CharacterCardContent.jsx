/**
 * Carte personnage partagée : même calcul de stats et même style que la page d'accueil (CharacterCreation).
 * Utilise useCharacterStatsDisplay + UnifiedCharacterCard.
 * À utiliser dans : donjons, entraînement, labyrinthe, world boss, PvP, tournois.
 */

import React from 'react';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { getRaceBonusText, getClassDescriptionText } from '../utils/descriptionBuilders';
import { formatUpgradePct, extractForgeUpgrade } from '../data/forgeDungeon';
import { useCharacterStatsDisplay } from '../hooks/useCharacterStatsDisplay';
import SharedTooltip from './SharedTooltip';
import UnifiedCharacterCard from './UnifiedCharacterCard';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import { getWeaponImage, getWeaponTooltipContent, formatWeaponStats, RARITY_COLORS } from '../utils/weaponDisplayUtils';

export default function CharacterCardContent({
  character,
  weaponOverride = null,
  imageOverride = null,
  nameOverride = null,
  showHpBar = false,
  currentHP,
  maxHP,
  shield,
  cardClassName = '',
}) {
  const statsDisplay = useCharacterStatsDisplay(character, weaponOverride);
  const {
    finalStats,
    getStatLineProps,
    hasForgeUpgrade,
    forgeUpgrade,
    forgeLabel,
    passiveDetails,
    fusedPassiveDisplay,
    awakeningInfo,
    isAwakeningActive,
    weapon,
  } = statsDisplay;

  const displayName = nameOverride ?? character?.name ?? '';
  const displayImage = imageOverride ?? character?.characterImage ?? null;
  const safeMaxHP = Math.max(1, maxHP ?? character?.maxHP ?? finalStats.hp ?? 1);
  const rawCurrentHP = currentHP ?? character?.currentHP ?? safeMaxHP;
  const safeCurrentHP = Math.max(0, Math.min(safeMaxHP, Math.round(rawCurrentHP)));
  const hpRatio = safeMaxHP > 0 ? safeCurrentHP / safeMaxHP : 1;
  const hpPercent = hpRatio * 100;
  const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
  const shieldPercent = safeMaxHP > 0 ? Math.min(100, ((shield ?? character?.shield ?? 0) / safeMaxHP) * 100) : 0;

  const StatLine = ({ statKey, label, valueClassName = '' }) => {
    const props = getStatLineProps(statKey, label, valueClassName);
    const { displayValue, hasBonus, labelClass, tooltipContent } = props;
    return hasBonus ? (
      <SharedTooltip content={tooltipContent}>
        <div className={valueClassName}>
          {label} : <span className={`font-bold ${labelClass}`}>{displayValue}</span>
        </div>
      </SharedTooltip>
    ) : (
      <div className={valueClassName}>
        {label} : <span className="text-white font-bold">{displayValue}</span>
      </div>
    );
  };

  const topStats = (
    <>
      <StatLine statKey="hp" label="HP" valueClassName="text-white" />
      <StatLine statKey="spd" label="VIT" valueClassName="text-white" />
    </>
  );

  const mainStats = (
    <>
      <StatLine statKey="auto" label="Auto" />
      <StatLine statKey="def" label="Déf" />
      <StatLine statKey="cap" label="Cap" />
      <StatLine statKey="rescap" label="ResC" />
    </>
  );

  const weaponContent = weapon ? (
    (() => {
      const inner = (
        <>
          <SharedTooltip content={getWeaponTooltipContent(weapon, hasForgeUpgrade)}>
            <span className="flex items-center gap-2">
              {getWeaponImage(weapon.imageFile) ? (
                <img src={getWeaponImage(weapon.imageFile)} alt={weapon.nom} className="w-8 h-auto" />
              ) : (
                <span className="text-xl">{weapon.icon}</span>
              )}
              <span className={`font-semibold ${hasForgeUpgrade ? 'forge-lava-text' : RARITY_COLORS[weapon.rarete]}`}>{weapon.nom}</span>
            </span>
          </SharedTooltip>
          <div className="text-[11px] text-stone-400 mt-1 space-y-1">
            <div>{weapon.description}</div>
            {weapon.effet && typeof weapon.effet === 'object' && (
              <div className="text-amber-200">
                Effet: {weapon.effet.nom}<br />Description: {weapon.effet.description}
              </div>
            )}
            {weapon.stats && Object.keys(weapon.stats).length > 0 && !hasForgeUpgrade && (
              <div className="text-stone-200">
                Stats: {formatWeaponStats(weapon)}
              </div>
            )}
            {hasForgeUpgrade && forgeUpgrade && (
              <div className="text-orange-300 font-semibold">
                🔨 Forge: {Object.entries(extractForgeUpgrade(forgeUpgrade).bonuses).map(([k, pct]) => `${forgeLabel(k)} +${formatUpgradePct(pct)}`).join(' • ')}
                {Object.entries(extractForgeUpgrade(forgeUpgrade).penalties).filter(([, v]) => v > 0).length > 0 && ` • ${Object.entries(extractForgeUpgrade(forgeUpgrade).penalties).map(([k, pct]) => `${forgeLabel(k)} -${formatUpgradePct(pct)}`).join(' • ')}`}
              </div>
            )}
          </div>
        </>
      );
      return hasForgeUpgrade ? (
        <div className="forge-lava-border forge-lava-glow overflow-visible">
          <div className="text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2 forge-lava-shine">
            {inner}
          </div>
        </div>
      ) : (
        <div className="text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
          {inner}
        </div>
      );
    })()
  ) : (
    <div className="text-xs text-stone-500 border border-stone-600 bg-stone-900/60 p-2">
      Aucune arme équipée
    </div>
  );

  const details = (
    <div className="space-y-2">
      {weaponContent}
      {fusedPassiveDisplay ? (
        <div className="extension-territory-border extension-territory-glow overflow-visible">
          <div className="flex items-start gap-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2 extension-territory-shine">
            <span className="text-lg">{fusedPassiveDisplay.primaryDetails.icon}</span>
            <div className="flex-1">
              <div className="font-semibold extension-territory-text">
                {fusedPassiveDisplay.mixedName}
              </div>
              <div className="text-stone-400 text-[11px] mt-1 space-y-1">
                <div><span className="text-amber-300/90">Niv.{fusedPassiveDisplay.primaryDetails.level} —</span> {fusedPassiveDisplay.primaryDetails.levelData.description}</div>
                <div><span className="text-violet-300/90">Niv.{fusedPassiveDisplay.extensionDetails.level} (Extension) —</span> {fusedPassiveDisplay.extensionDetails.levelData.description}</div>
              </div>
            </div>
          </div>
        </div>
      ) : passiveDetails ? (
        <div className="flex items-start gap-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
          <span className="text-lg">{passiveDetails.icon}</span>
          <div className="flex-1">
            <div className="font-semibold text-amber-200">
              {passiveDetails.name} — Niveau {passiveDetails.level}
            </div>
            <div className="text-stone-400 text-[11px]">
              {passiveDetails.levelData.description}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-stone-500 border border-stone-600 bg-stone-900/60 p-2">
          Aucun passif de Tour du Mage équipé
        </div>
      )}
      {isAwakeningActive && awakeningInfo && (
        <div className="flex items-start gap-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
          <span className="text-lg">✨</span>
          <div className="flex-1">
            <div className="font-semibold text-amber-200">
              Éveil racial actif (Niv {awakeningInfo.levelRequired}+)
            </div>
            <div className="text-stone-400 text-[11px]">
              {awakeningInfo.description}
            </div>
          </div>
        </div>
      )}
      {!isAwakeningActive && character?.race && races[character.race] && (
        <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
          <span className="text-lg">{races[character.race].icon}</span>
          <span className="text-stone-300">{getRaceBonusText(character.race)}</span>
        </div>
      )}
      {character?.class && classes[character.class] && (
        <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
          <span className="text-lg">{classes[character.class].icon}</span>
          <div className="flex-1">
            <div className="font-semibold text-amber-200">{classes[character.class].ability}</div>
            <div className="text-stone-400 text-[11px]">
              {getClassDescriptionText(character.class)}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <UnifiedCharacterCard
      header={`${character?.race ?? ''} • ${character?.class ?? ''} • Niveau ${character?.level ?? 1}`}
      name={displayName}
      image={displayImage}
      fallback={character?.race && races[character.race] ? <div className="h-96 w-full flex items-center justify-center"><div className="text-9xl opacity-20">{races[character.race].icon}</div></div> : <div className="h-48 w-full flex items-center justify-center"><span className="text-7xl opacity-20">❓</span></div>}
      topStats={topStats}
      mainStats={mainStats}
      details={details}
      hpText={showHpBar ? `${displayName} — PV ${safeCurrentHP}/${safeMaxHP}` : undefined}
      hpPercent={showHpBar ? hpPercent : undefined}
      hpClass={showHpBar ? hpClass : undefined}
      shieldPercent={showHpBar ? shieldPercent : undefined}
      cardClassName={cardClassName}
    />
  );
}
