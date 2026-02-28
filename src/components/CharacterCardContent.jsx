/**
 * Carte personnage partagée : même calcul de stats et même style que la page d'accueil (CharacterCreation).
 * Utilise useCharacterStatsDisplay + UnifiedCharacterCard.
 * À utiliser dans : donjons, entraînement, labyrinthe, world boss, PvP, tournois.
 */

import React from 'react';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { getRaceBonusText } from '../utils/descriptionBuilders';
import { getCalculatedClassDescription } from '../utils/calculatedClassDescription';
import { formatUpgradePct, extractForgeUpgrade } from '../data/forgeDungeon';
import { useCharacterStatsDisplay } from '../hooks/useCharacterStatsDisplay';
import SharedTooltip from './SharedTooltip';
import UnifiedCharacterCard from './UnifiedCharacterCard';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import { getWeaponImage, getWeaponTooltipContent, formatWeaponStats, RARITY_COLORS } from '../utils/weaponDisplayUtils';
import { getAbilityDisplayLabel } from '../data/subclasses';
import { getCombatBuffsDebuffs } from '../utils/combatBuffsDebuffs';

const STAT_KEYS_TOP = ['hp', 'spd'];
const STAT_KEYS_MAIN = ['auto', 'def', 'cap', 'rescap'];
const STAT_LABELS_MAP = { hp: 'HP', spd: 'VIT', auto: 'Auto', def: 'Déf', cap: 'Cap', rescap: 'ResC' };

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
  /** Base de combat courante (ex. après debuffs) : affiche ces valeurs au lieu de finalStats pour les stats. */
  combatBaseOverride = null,
  /** Modificateurs de combat par stat pour l'info-bulle. Ex: { def: [{ label: 'Brèche mentale', value: -8 }] } */
  combatModifiers = null,
  /** Adversaire (boss ou autre joueur) qui applique des debuffs sur ce personnage — pour afficher les icônes buffs/debuffs */
  opponent = null,
  /** État de combat courant du personnage (stun, saignement, marque, esquive, riposte, brûlure Néant) — ex. step.p1Status */
  combatStatus = null,
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
  const safeMaxHP = Math.max(1, maxHP ?? character?.maxHP ?? (combatBaseOverride?.hp ?? finalStats.hp) ?? 1);
  const rawCurrentHP = currentHP ?? character?.currentHP ?? safeMaxHP;
  const safeCurrentHP = Math.max(0, Math.min(safeMaxHP, Math.round(rawCurrentHP)));
  const hpRatio = safeMaxHP > 0 ? safeCurrentHP / safeMaxHP : 1;
  const hpPercent = hpRatio * 100;
  const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
  const shieldPercent = safeMaxHP > 0 ? Math.min(100, ((shield ?? character?.shield ?? 0) / safeMaxHP) * 100) : 0;

  const combatBuffsDebuffs = (showHpBar && (opponent || combatModifiers || combatStatus)) ? getCombatBuffsDebuffs(opponent, combatModifiers, combatStatus) : [];
  const aboveHpBar = combatBuffsDebuffs.length > 0 ? (
    combatBuffsDebuffs.map((eff) => (
      <SharedTooltip key={eff.id} content={<span className="whitespace-normal block text-left max-w-[320px]">{eff.description}</span>}>
        <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-stone-700 border border-stone-500 text-base cursor-help" title={eff.label}>
          {eff.icon}
        </span>
      </SharedTooltip>
    ))
  ) : null;

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

  const getCombatStatTooltip = (statKey) => {
    const v = combatBaseOverride?.[statKey];
    const fiche = finalStats[statKey];
    const parts = [];
    if (v != null) parts.push(`En combat : ${v}`);
    if (fiche != null && typeof fiche === 'number' && typeof v === 'number' && v !== fiche) {
      parts.push(`Fiche : ${fiche}`);
    }
    const mods = combatModifiers?.[statKey];
    if (mods?.length) {
      const malusLines = mods.map((m) => `${m.label} : ${m.value > 0 ? '+' : ''}${m.value}`).join(' | ');
      parts.push(`Malus/Bonus : ${malusLines}`);
    } else if (fiche != null && typeof fiche === 'number' && typeof v === 'number' && v !== fiche) {
      const delta = v - fiche;
      parts.push(`Modificateurs : ${delta > 0 ? '+' : ''}${delta} (passifs de combat)`);
    }
    return parts.length ? parts.join(' | ') : null;
  };

  const CombatStatLine = ({ statKey, valueClassName = '' }) => {
    const v = combatBaseOverride?.[statKey];
    const label = STAT_LABELS_MAP[statKey] ?? statKey;
    const tooltip = getCombatStatTooltip(statKey);
    const line = (
      <div className={valueClassName || ''}>
        {label} : <span className="text-white font-bold">{v != null ? v : '—'}</span>
      </div>
    );
    return tooltip ? (
      <SharedTooltip content={tooltip}>{line}</SharedTooltip>
    ) : (
      line
    );
  };

  const topStats = combatBaseOverride ? (
    <>
      {STAT_KEYS_TOP.map((k) => <CombatStatLine key={k} statKey={k} valueClassName="text-white" />)}
    </>
  ) : (
    <>
      <StatLine statKey="hp" label="HP" valueClassName="text-white" />
      <StatLine statKey="spd" label="VIT" valueClassName="text-white" />
    </>
  );

  const mainStats = combatBaseOverride ? (
    <>
      {STAT_KEYS_MAIN.map((k) => <CombatStatLine key={k} statKey={k} />)}
    </>
  ) : (
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
              <SharedTooltip
                content={
                  <span className="whitespace-normal block text-left max-w-[260px]">
                    <span className="text-amber-300 font-semibold">{fusedPassiveDisplay.primaryDetails.icon} {fusedPassiveDisplay.primaryDetails.name}</span>
                    <span className="text-stone-400"> — Niv.{fusedPassiveDisplay.primaryDetails.level} (principal)</span>
                    <br />
                    <span className="text-violet-300 font-semibold">{fusedPassiveDisplay.extensionDetails.icon} {fusedPassiveDisplay.extensionDetails.name}</span>
                    <span className="text-stone-400"> — Niv.{fusedPassiveDisplay.extensionDetails.level} (extension)</span>
                  </span>
                }
              >
                <div className="font-semibold extension-territory-text cursor-help">
                  {fusedPassiveDisplay.displayLabel}
                </div>
              </SharedTooltip>
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
      {character?.additionalAwakeningRaces?.length > 0 && character.additionalAwakeningRaces[0] && races[character.additionalAwakeningRaces[0]]?.awakening && (
        <div className="flex items-start gap-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
          <span className="text-lg">✨</span>
          <div className="flex-1">
            <div className="font-semibold text-amber-200">
              Éveil racial actif — {character.additionalAwakeningRaces[0]} (Niv {races[character.additionalAwakeningRaces[0]].awakening.levelRequired}+)
            </div>
            <div className="text-stone-400 text-[11px]">
              {races[character.additionalAwakeningRaces[0]].awakening.description}
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
        character.subclass ? (
          <div className="subclass-gold-border subclass-gold-glow overflow-visible">
            <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300 subclass-gold-shine">
              <span className="text-lg">{classes[character.class].icon}</span>
              <div className="flex-1">
                <div className="font-semibold subclass-gold-text">{getAbilityDisplayLabel(character.class, character.subclass)}</div>
                <div className="text-stone-400 text-[11px]">
                  {getCalculatedClassDescription(character.class, finalStats.cap ?? 0, finalStats.auto ?? 0)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
            <span className="text-lg">{classes[character.class].icon}</span>
            <div className="flex-1">
              <div className="font-semibold text-amber-200">{classes[character.class].ability}</div>
              <div className="text-stone-400 text-[11px]">
                {getCalculatedClassDescription(character.class, finalStats.cap ?? 0, finalStats.auto ?? 0)}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );

  const headerRacePart = (character?.additionalAwakeningRaces?.length > 0 && character?.race)
    ? `${character.race} + ${character.additionalAwakeningRaces[0]}`
    : (character?.race ?? '');
  const header = `${headerRacePart} • ${character?.class ?? ''} • Niveau ${character?.level ?? 1}`;

  return (
    <UnifiedCharacterCard
      header={header}
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
      aboveHpBar={aboveHpBar}
      cardClassName={cardClassName}
    />
  );
}
