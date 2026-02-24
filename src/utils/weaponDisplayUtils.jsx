import React from 'react';
import { RARITY_COLORS } from '../data/weapons';

const weaponImageModules = import.meta.glob('../assets/weapons/*.png', { eager: true, import: 'default' });

export function getWeaponImage(imageFile) {
  if (!imageFile) return null;
  return weaponImageModules[`../assets/weapons/${imageFile}`] || null;
}

const STAT_LABELS = { hp: 'HP', auto: 'Auto', def: 'Déf', cap: 'Cap', rescap: 'ResC', spd: 'VIT' };

const getWeaponStatColor = (value) => {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-yellow-300';
};

export function formatWeaponStats(weapon) {
  if (!weapon?.stats) return null;
  const entries = Object.entries(weapon.stats);
  if (entries.length === 0) return null;
  return entries.map(([stat, value]) => (
    <span key={stat} className={`font-semibold ${getWeaponStatColor(value)}`}>
      {STAT_LABELS[stat] || stat} {value > 0 ? `+${value}` : value}
    </span>
  )).reduce((acc, node, index) => {
    if (index === 0) return [node];
    return acc.concat([<span key={`sep-${index}`} className="text-stone-400"> • </span>, node]);
  }, []);
}

export function getWeaponTooltipContent(weapon, hideFlatStats = false) {
  if (!weapon) return null;
  const stats = hideFlatStats ? null : formatWeaponStats(weapon);
  return (
    <span className="block whitespace-normal text-xs">
      <span className="block font-semibold text-white">{weapon.nom}</span>
      <span className="block text-stone-300">{weapon.description}</span>
      {weapon.effet && typeof weapon.effet === 'object' && (
        <span className="block text-amber-200">
          Effet: {weapon.effet.nom}<br />Description: {weapon.effet.description}
        </span>
      )}
      {stats && (
        <span className="block text-stone-200">
          Stats: {stats}
        </span>
      )}
    </span>
  );
}

export { RARITY_COLORS };
