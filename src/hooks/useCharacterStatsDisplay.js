/**
 * Hook partagé pour le calcul et l'affichage des stats de personnage.
 * Même logique que la page d'accueil (CharacterCreation) : finalStats avec forge,
 * getRaceDisplayBonus basé sur finalStatsBeforeForge pour ne pas mélanger Race et Forge dans le tooltip.
 *
 * @param {Object} character - { base, race, class, forestBoosts, forgeUpgrade, mageTowerPassive, level }
 * @param {Object} [weaponOverride] - arme si pas sur character.equippedWeaponData
 * @returns {Object} finalStats, tooltipContent, getStatLineProps, etc.
 */

import { getRaceBonus, getClassBonus } from '../data/combatMechanics';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import { applyPassiveWeaponStats, applyForgeUpgrade } from '../utils/weaponEffects';
import { applyAwakeningToBase, getAwakeningEffect, removeBaseRaceFlatBonusesIfAwakened } from '../utils/awakening';
import { isForgeActive } from '../data/featureFlags';
import { extractForgeUpgrade, hasAnyForgeUpgrade, FORGE_STAT_LABELS, computeForgeStatDelta } from '../data/forgeDungeon';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { races } from '../data/races';

export function useCharacterStatsDisplay(character, weaponOverride = null) {
  if (!character?.base) {
    return {
      finalStats: {},
      finalStatsBeforeForge: {},
      tooltipContent: () => '',
      getRaceDisplayBonus: () => 0,
      getStatLineProps: () => ({}),
      weaponStatValue: () => 0,
      skipWeaponFlat: false,
      hasForgeUpgrade: false,
      forgeUpgrade: null,
      forgeLabel: () => '',
      passiveAutoBonus: 0,
      passiveDetails: null,
      awakeningInfo: null,
      isAwakeningActive: false,
      weapon: null,
      baseWithoutBonus: () => 0,
      raceB: {},
      classB: {},
      forestBoosts: {},
    };
  }

  const raceB = getRaceBonus(character.race);
  const classB = getClassBonus(character.class);
  const totalBonus = (k) => (raceB[k] || 0) + (classB[k] || 0);
  const forestBoosts = { ...getEmptyStatBoosts(), ...(character.forestBoosts || {}) };
  const baseStatsRaw = applyStatBoosts(character.base, forestBoosts);
  const baseStats = removeBaseRaceFlatBonusesIfAwakened(baseStatsRaw, character.race, character.level ?? 1);
  const weapon = weaponOverride ?? character.equippedWeaponData ?? null;
  const mageTowerPassive = character.mageTowerPassive || null;
  const passiveBase = mageTowerPassive ? getMageTowerPassiveById(mageTowerPassive.id) : null;
  const passiveLevel = mageTowerPassive ? getMageTowerPassiveLevel(mageTowerPassive.id, mageTowerPassive.level) : null;
  const passiveDetails = passiveBase && passiveLevel ? { ...passiveBase, level: mageTowerPassive.level, levelData: passiveLevel } : null;
  const awakeningInfo = character.race ? (races[character.race]?.awakening ?? null) : null;
  const isAwakeningActive = awakeningInfo && (character.level ?? 1) >= awakeningInfo.levelRequired;
  const forgeUpgrade = character.forgeUpgrade;
  const forgeLabel = (statKey) => FORGE_STAT_LABELS[statKey] || statKey.toUpperCase();
  const hasForgeUpgrade = isForgeActive() && hasAnyForgeUpgrade(forgeUpgrade);
  const skipWeaponFlat = isForgeActive() && forgeUpgrade && hasAnyForgeUpgrade(forgeUpgrade);
  const weaponStatValue = (k) => (skipWeaponFlat ? 0 : (weapon?.stats?.[k] ?? 0));
  const rawBase = character.base;
  const baseWithPassive = weapon ? applyPassiveWeaponStats(baseStats, weapon.id, character.class, character.race, character.mageTowerPassive, skipWeaponFlat) : baseStats;
  const passiveAutoBonus = (baseWithPassive.auto ?? baseStats.auto) - (baseStats.auto + (skipWeaponFlat ? 0 : (weapon?.stats?.auto ?? 0)));
  const awakeningEffect = getAwakeningEffect(character.race, character.level ?? 1);
  const finalStatsBeforeForge = applyAwakeningToBase(baseWithPassive, awakeningEffect);
  const finalStats = (isForgeActive() && forgeUpgrade && hasAnyForgeUpgrade(forgeUpgrade))
    ? applyForgeUpgrade(finalStatsBeforeForge, forgeUpgrade)
    : finalStatsBeforeForge;

  const baseWithoutBonus = (k) => (rawBase[k] ?? 0) - totalBonus(k);

  const getRaceDisplayBonus = (k) => {
    if (!isAwakeningActive) return raceB[k] || 0;
    const classBonus = classB[k] || 0;
    const forestBonus = forestBoosts[k] || 0;
    const weaponBonus = weaponStatValue(k);
    const passiveBonus = k === 'auto' ? passiveAutoBonus : 0;
    const subtotalWithoutRace = baseWithoutBonus(k) + classBonus + forestBonus + weaponBonus + passiveBonus;
    return (finalStatsBeforeForge[k] ?? 0) - subtotalWithoutRace;
  };

  const tooltipContent = (k) => {
    const parts = [`Base: ${baseWithoutBonus(k)}`];
    if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
    if (forestBoosts[k] > 0) parts.push(`Forêt: +${forestBoosts[k]}`);
    if (weaponStatValue(k) !== 0) parts.push(`Arme: ${weaponStatValue(k) > 0 ? `+${weaponStatValue(k)}` : weaponStatValue(k)}`);
    if (k === 'auto' && passiveAutoBonus > 0) parts.push(`Passif arme: +${passiveAutoBonus}`);

    const raceDisplayBonus = getRaceDisplayBonus(k);
    if (raceDisplayBonus !== 0) parts.push(`Race: ${raceDisplayBonus > 0 ? `+` : ''}${raceDisplayBonus}`);
    if (isForgeActive() && forgeUpgrade) {
      const { bonuses, penalties } = extractForgeUpgrade(forgeUpgrade);
      const valueBeforeForge = baseWithoutBonus(k) + (classB[k] || 0) + (forestBoosts[k] || 0) + weaponStatValue(k) + (k === 'auto' ? passiveAutoBonus : 0) + getRaceDisplayBonus(k);
      const forgeDelta = computeForgeStatDelta(valueBeforeForge, bonuses[k], penalties[k]);
      if (forgeDelta !== 0) parts.push(`Forge: ${forgeDelta > 0 ? '+' : ''}${forgeDelta}`);
    }
    return parts.join(' | ');
  };

  const getStatLineProps = (statKey, label, valueClassName = '') => {
    const displayValue = finalStats[statKey] ?? 0;
    const raceDisplayBonus = getRaceDisplayBonus(statKey);
    const valueBeforeForgeForStat = baseWithoutBonus(statKey) + (classB[statKey] || 0) + (forestBoosts[statKey] || 0) + weaponStatValue(statKey) + (statKey === 'auto' ? passiveAutoBonus : 0) + raceDisplayBonus;
    const forgeDeltaForStat = (isForgeActive() && forgeUpgrade) ? (() => {
      const { bonuses, penalties } = extractForgeUpgrade(forgeUpgrade);
      return computeForgeStatDelta(valueBeforeForgeForStat, bonuses[statKey], penalties[statKey]);
    })() : 0;
    const hasBonus = raceDisplayBonus !== 0 || classB[statKey] > 0 || forestBoosts[statKey] > 0 || weaponStatValue(statKey) !== 0 || (statKey === 'auto' && passiveAutoBonus !== 0) || forgeDeltaForStat !== 0;
    const totalDelta = raceDisplayBonus + (classB[statKey] || 0) + (forestBoosts[statKey] || 0) + weaponStatValue(statKey) + (statKey === 'auto' ? passiveAutoBonus : 0) + forgeDeltaForStat;
    const labelClass = totalDelta > 0 ? 'text-green-400' : totalDelta < 0 ? 'text-red-400' : 'text-yellow-300';
    return {
      displayValue,
      hasBonus,
      labelClass,
      tooltipContent: tooltipContent(statKey),
      label,
      valueClassName,
    };
  };

  return {
    finalStats,
    finalStatsBeforeForge,
    tooltipContent,
    getRaceDisplayBonus,
    getStatLineProps,
    weaponStatValue,
    skipWeaponFlat,
    hasForgeUpgrade,
    forgeUpgrade,
    forgeLabel,
    passiveAutoBonus,
    passiveDetails,
    awakeningInfo,
    isAwakeningActive,
    weapon,
    baseWithoutBonus,
    raceB,
    classB,
    forestBoosts,
  };
}
