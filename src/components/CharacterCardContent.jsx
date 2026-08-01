/**
 * Carte personnage partagée : même calcul de stats et même style que la page d'accueil (CharacterCreation).
 * Utilise useCharacterStatsDisplay + UnifiedCharacterCard.
 * À utiliser dans : donjons, entraînement, labyrinthe, world boss, PvP, tournois.
 */

import React from 'react';
import { races } from '../data/races';
import { classes } from '../data/classes';
import {
  getRaceBonusText,
  splitDescriptionLines,
  buildRacePointeauAdnDescription,
  getPointeauAdnIntensityLabel,
} from '../utils/descriptionBuilders';
import { getCalculatedClassDescription } from '../utils/calculatedClassDescription';
import { formatUpgradePct, extractForgeUpgrade } from '../data/forgeDungeon';
import { useCharacterStatsDisplay } from '../hooks/useCharacterStatsDisplay';
import SharedTooltip from './SharedTooltip';
import UnifiedCharacterCard from './UnifiedCharacterCard';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import { getWeaponImage, getWeaponTooltipContent, formatWeaponStats, RARITY_COLORS } from '../utils/weaponDisplayUtils';
import SubclassDetailBlock from './SubclassDetailBlock';
import { getCombatBuffsDebuffs } from '../utils/combatBuffsDebuffs';
import { getDisplayTitle } from '../services/titleService';
import { calcCritChance, getCritMultiplier, generalConstants } from '../data/combatMechanics';
import { buildAwakeningState, getMergedAwakeningEffectForPrep } from '../utils/awakening';

const STAT_KEYS_TOP = ['hp', 'spd'];
const STAT_KEYS_MAIN = ['auto', 'def', 'cap', 'rescap'];
const STAT_LABELS_MAP = { hp: 'HP', spd: 'VIT', auto: 'Auto', def: 'Déf', cap: 'Cap', rescap: 'ResC' };

export default function CharacterCardContent({
  character,
  weaponOverride = null,
  imageOverride = null,
  nameOverride = null,
  /** Override complet de l'en-tête (bandeau). */
  headerOverride = null,
  /** Override du fallback (si aucune image). */
  fallbackOverride = null,
  /** Ajoute du contenu dans la section détails (au-dessus des détails standard). */
  detailsAppend = null,
  /** Remplace entièrement la section détails (rare). Passer null pour masquer. */
  detailsOverride = undefined,
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
  /** 'left' | 'right' | null — layout horizontal : infos à gauche ou droite de l'image */
  infoSide = null,
  /** 'left' | 'right' | null — affiche les détails (arme/passif/race/sort) dans un panneau latéral séparé */
  detailsPlacement = null,
  /**
   * Si false avec detailsPlacement : stats restent sur la carte, panneau latéral = détails seulement.
   * Si omis : comportement historique (!showHpBar).
   */
  sidePanelIncludeStats = null,
  /** Classe CSS additionnelle sur l'image (ex: 'scale-x-[-1]' pour miroir) */
  imageClassName = '',
  /** Contenu overlay sur l'image (ex: brume du miroir) */
  imageOverlayContent = null,
  /** Masque les lignes de stats sur la carte (ex. overlay custom) */
  hideStats = false,
  /** Override du nom affiché sur la carte ; chaîne vide pour masquer */
  nameOnCard = undefined,
  /** Override de bordure Canvas (ex: 'lava' pour un boss). Si absent, utilise character.equippedBorder. */
  borderId: borderIdOverride = null,
  /** Si true, l'effet Canvas bordure n'apparaît que sur l'image */
  borderOnImageOnly = false,
}) {
  const statsDisplay = useCharacterStatsDisplay(character, weaponOverride);
  const {
    finalStats,
    getStatLineProps,
    tooltipContent: getTooltipContent,
    baseWithoutBonus,
    hasForgeUpgrade,
    forgeUpgrade,
    forgeLabel,
    passiveDetails,
    fusedPassiveDisplay,
    awakeningInfo,
    isAwakeningActive,
    weapon,
    forestBoosts,
  } = statsDisplay;

  const displayName = nameOverride ?? character?.name ?? '';
  const displayImage = imageOverride ?? character?.characterImage ?? null;
  const displayTitle = character?.equippedTitle
    ? getDisplayTitle(character.equippedTitle, character?.gender)
    : null;
  const safeMaxHP = Math.max(1, maxHP ?? character?.maxHP ?? (combatBaseOverride?.hp ?? finalStats.hp) ?? 1);
  const rawCurrentHP = currentHP ?? character?.currentHP ?? safeMaxHP;
  const safeCurrentHP = Math.max(0, Math.min(safeMaxHP, Math.round(rawCurrentHP)));
  const hpRatio = safeMaxHP > 0 ? safeCurrentHP / safeMaxHP : 1;
  const hpPercent = hpRatio * 100;
  const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
  const shieldPercent = safeMaxHP > 0 ? Math.min(100, ((shield ?? character?.shield ?? 0) / safeMaxHP) * 100) : 0;

  // CC/DC :
  // - En combat : valeur réelle vs l'adversaire (inclut bonus d'écart de VIT / Gnome / éveils, etc.).
  // - Hors combat : pas de défenseur → pas de "duel de VIT" (les bonus Gnome ne doivent pas s'appliquer hors combat).
  const critAttackerBase = combatBaseOverride ?? finalStats ?? character?.base ?? {};
  // Important: pour afficher correctement CC/DC, on a besoin de l'état d'éveil "fusionné"
  // (race principale + races additionnelles + Pointeau ADN). En combat, `character.awakening`
  // existe déjà (préparé par le moteur) → on ne le remplace pas.
  const mergedAwakening = (character?.awakening != null)
    ? character.awakening
    : buildAwakeningState(getMergedAwakeningEffectForPrep({ ...(character || {}), base: critAttackerBase }));
  const critAttacker = { ...(character || {}), base: critAttackerBase, awakening: mergedAwakening };
  const defenderForCrit = opponent?.base ? opponent : null;
  // Reflet Maudit (debuff combat) : malus de crit appliqué sur l'attaquant (stocké dans combatStatusSnapshot).
  const refletMauditCritMalus =
    (combatStatus?._refletMauditCritMalus ?? critAttacker?._refletMauditCritMalus ?? 0) || 0;
  const cc = Math.max(0, calcCritChance(critAttacker, defenderForCrit) - refletMauditCritMalus); // 0..1
  const dc = getCritMultiplier(critAttacker, defenderForCrit); // ex: 1.5
  const ccPct = `${Math.round((cc ?? 0) * 1000) / 10}%`;
  const dcText = `x${(dc ?? 1.5).toFixed(2)}`;

  // Référence "base" pour le vert/rouge : valeur fixe (sans aucun bonus).
  // Les bonus permanents (Elfe/Voleur/éveils/armes) doivent faire passer la stat en vert.
  const baseCc = generalConstants.baseCritChance;
  const baseDc = generalConstants.critMultiplier;

  const ccDelta = (cc ?? 0) - baseCc;
  const dcDelta = (dc ?? baseDc) - baseDc;
  const ccClass = ccDelta > 1e-6 ? 'text-green-400' : ccDelta < -1e-6 ? 'text-red-400' : 'text-white';
  const dcClass = dcDelta > 1e-6 ? 'text-green-400' : dcDelta < -1e-6 ? 'text-red-400' : 'text-white';

  const ccTooltip = `Base: ${Math.round(baseCc * 1000) / 10}% | Total: ${ccPct}${opponent?.base ? ' (vs adversaire)' : ''}`;
  const dcTooltip = `Base: x${baseDc.toFixed(2)} | Total: ${dcText}${opponent?.base ? ' (vs adversaire)' : ''}`;

  const combatBuffsDebuffs = (showHpBar && (opponent || combatModifiers || combatStatus)) ? getCombatBuffsDebuffs(opponent, combatModifiers, combatStatus) : [];
  const aboveHpBar = combatBuffsDebuffs.length > 0 ? (
    combatBuffsDebuffs.map((eff) => (
      <SharedTooltip
        key={eff.id}
        content={<span className="block text-left">{eff.description}</span>}
        tooltipClassName="whitespace-normal px-4 py-3 leading-relaxed max-w-[320px] min-w-[240px]"
      >
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

  // En combat : même détail qu'hors combat (Base | Forêt | Arme | …) + modificateurs de combat
  const getCombatStatTooltip = (statKey) => {
    const baseTooltip = getTooltipContent(statKey);
    const mods = combatModifiers?.[statKey];
    if (!mods?.length) return baseTooltip;
    const modLines = mods.map((m) => `${m.label}: ${m.value > 0 ? '+' : ''}${m.value}`).join(' | ');
    return `${baseTooltip} | ${modLines}`;
  };

  const CombatStatLine = ({ statKey, valueClassName = '' }) => {
    const v = combatBaseOverride?.[statKey];
    const label = STAT_LABELS_MAP[statKey] ?? statKey;
    const tooltip = getCombatStatTooltip(statKey);
    const baseRef = baseWithoutBonus(statKey);
    const isBelowBase = typeof v === 'number' && v < baseRef;
    const valueClass = isBelowBase ? 'text-red-400' : 'text-green-400';
    const line = (
      <div className={valueClassName || ''}>
        {label} : <span className={`font-bold ${valueClass}`}>{v != null ? v : '—'}</span>
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
      <SharedTooltip content={ccTooltip}>
        <div className="cursor-help">
          CC : <span className={`font-bold ${ccClass}`}>{ccPct}</span>
        </div>
      </SharedTooltip>
      <SharedTooltip content={dcTooltip}>
        <div className="cursor-help">
          DC : <span className={`font-bold ${dcClass}`}>{dcText}</span>
        </div>
      </SharedTooltip>
    </>
  ) : (
    <>
      <StatLine statKey="auto" label="Auto" />
      <StatLine statKey="def" label="Déf" />
      <StatLine statKey="cap" label="Cap" />
      <StatLine statKey="rescap" label="ResC" />
      <SharedTooltip content={ccTooltip}>
        <div className="cursor-help">
          CC : <span className={`font-bold ${ccClass}`}>{ccPct}</span>
        </div>
      </SharedTooltip>
      <SharedTooltip content={dcTooltip}>
        <div className="cursor-help">
          DC : <span className={`font-bold ${dcClass}`}>{dcText}</span>
        </div>
      </SharedTooltip>
    </>
  );

  const weaponContent = character?.isBoss ? null : weapon ? (
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
            {weapon.effet && typeof weapon.effet === 'object' ? (
              <div className="text-amber-200">
                Effet: {weapon.effet.nom}<br />Description: {weapon.effet.description}
              </div>
            ) : null}
            {weapon.stats && Object.keys(weapon.stats).length > 0 && !hasForgeUpgrade ? (
              <div className="text-stone-200">
                Stats: {formatWeaponStats(weapon)}
              </div>
            ) : null}
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
      {detailsAppend}
      {character?.coopRedMoveDisplay && (
        <div className="flex items-start gap-2 border border-red-900/45 bg-red-950/25 p-2 text-xs text-stone-300 rounded-md">
          <span className="text-lg leading-none shrink-0">{character.coopRedBossIcon ?? '✨'}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-amber-200">{character.coopRedMoveDisplay.name}</div>
            {character.coopRedMoveDisplay.cooldownLabel && (
              <div className="text-stone-500 text-[10px] mt-0.5">{character.coopRedMoveDisplay.cooldownLabel}</div>
            )}
            <div className="text-stone-400 text-[11px] mt-1 leading-snug">{character.coopRedMoveDisplay.description}</div>
          </div>
        </div>
      )}
      {weaponContent}
      {character?.isBoss ? null : fusedPassiveDisplay ? (
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
            <div className="text-stone-400 text-[11px] space-y-0.5">
              {splitDescriptionLines(awakeningInfo.description).map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
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
            <div className="text-stone-400 text-[11px] space-y-0.5">
              {splitDescriptionLines(races[character.additionalAwakeningRaces[0]].awakening.description).map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      )}
      {!isAwakeningActive && character?.race && races[character.race] && (
        <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
          <span className="text-lg">{races[character.race].icon}</span>
          <div className="text-stone-300 space-y-0.5">
            {splitDescriptionLines(getRaceBonusText(character.race)).map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        </div>
      )}
      {character?.coopRaceEcho?.race && (
        <div className="pointeau-adn-border pointeau-adn-glow overflow-visible">
          <div className="flex items-start gap-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2 pointeau-adn-shine">
            <span className="text-lg">🧬</span>
            <div className="flex-1">
              <div className="font-semibold pointeau-adn-text">
                Pointeau ADN — {character.coopRaceEcho.race}
              </div>
              {getPointeauAdnIntensityLabel() ? (
                <div className="text-stone-500 text-[10px] mt-0.5">{getPointeauAdnIntensityLabel()}</div>
              ) : null}
              <div className="text-stone-400 text-[11px] mt-1 space-y-0.5">
                {splitDescriptionLines(buildRacePointeauAdnDescription(character.coopRaceEcho.race)).map((line, idx) => (
                  <div key={`echo-${character.coopRaceEcho.race}-${idx}`}>• {line}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {character?.class && classes[character.class] && (
        character.subclass ? (
          <SubclassDetailBlock
            subclass={character.subclass}
            classIcon={classes[character.class].icon}
            stats={{
              cap: finalStats.cap ?? 0,
              auto: finalStats.auto ?? 0,
              def: finalStats.def ?? 0,
              rescap: finalStats.rescap ?? 0,
            }}
          />
        ) : (
          <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
            <span className="text-lg">{classes[character.class].icon}</span>
            <div className="flex-1">
              <div className="font-semibold text-amber-200">{classes[character.class].ability}</div>
              <div className="text-stone-400 text-[11px]">
                {getCalculatedClassDescription(character.class, finalStats.cap ?? 0, finalStats.auto ?? 0, finalStats.def ?? 0, finalStats.rescap ?? 0, character.subclass?.id ?? null)}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );

  const effectiveDetails = detailsOverride !== undefined ? detailsOverride : details;

  const headerRacePart = (character?.additionalAwakeningRaces?.length > 0 && character?.race)
    ? `${character.race} + ${character.additionalAwakeningRaces[0]}`
    : (character?.race ?? '');
  const computedHeader = `${headerRacePart} • ${character?.class ?? ''} • Niveau ${character?.level ?? 1}`;
  const header = headerOverride ?? computedHeader;

  const computedFallback = character?.race && races[character.race]
    ? <div className="h-96 w-full flex items-center justify-center"><div className="text-9xl opacity-20">{races[character.race].icon}</div></div>
    : <div className="h-96 w-full flex items-center justify-center"><span className="text-7xl opacity-20">❓</span></div>;
  const cardFallback = fallbackOverride ?? computedFallback;

  const cardProps = {
    header,
    name: nameOnCard !== undefined ? nameOnCard : displayName,
    title: displayTitle,
    image: displayImage,
    fallback: cardFallback,
    topStats: hideStats ? null : topStats,
    mainStats: hideStats ? null : mainStats,
    hpText: showHpBar ? `${displayName} — PV ${safeCurrentHP}/${safeMaxHP}` : undefined,
    hpPercent: showHpBar ? hpPercent : undefined,
    hpClass: showHpBar ? hpClass : undefined,
    shieldPercent: showHpBar ? shieldPercent : undefined,
    aboveHpBar,
    cardClassName,
    infoSide,
    borderId: borderIdOverride || character?.equippedBorder || null,
    realBorderId: character?.equippedRealBorder || null,
    borderOnImageOnly,
    imageClassName,
    imageOverlayContent,
  };

  if (detailsPlacement) {
    const includeStatsInPanel = sidePanelIncludeStats ?? !showHpBar;

    const sidePanelContent = (
      <>
        {includeStatsInPanel && (
          <div className="mb-3">
            <div className="flex justify-between text-sm text-white font-bold mb-1">
              {topStats}
            </div>
            <div className="grid grid-cols-2 gap-1 text-sm text-gray-300">
              {mainStats}
            </div>
          </div>
        )}
        {includeStatsInPanel && <div className="border-t border-stone-700/60 pt-3">{effectiveDetails}</div>}
        {!includeStatsInPanel && effectiveDetails}
      </>
    );

    const sidePanel = (
      <div className="hidden lg:block w-[280px] flex-shrink-0">
        <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl p-3 shadow-lg overflow-visible">
          {sidePanelContent}
        </div>
      </div>
    );

    const sidePanelCardProps =
      includeStatsInPanel || hideStats
        ? { ...cardProps, hideInfoOnLg: true }
        : cardProps;

    return (
      <div className="flex gap-3 items-start">
        {detailsPlacement === 'left' && sidePanel}
        <div className="flex-shrink-0">
          <UnifiedCharacterCard {...sidePanelCardProps} details={<div className="lg:hidden">{effectiveDetails}</div>} />
        </div>
        {detailsPlacement === 'right' && sidePanel}
      </div>
    );
  }

  return <UnifiedCharacterCard {...cardProps} details={effectiveDetails} />;
}
