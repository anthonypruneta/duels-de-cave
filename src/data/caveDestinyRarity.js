/**
 * Raretés des événements Cave Destiny.
 * Plus la rareté est haute, plus l’événement est rare au tirage.
 */

export const EVENT_RARITY_WEIGHTS = {
  common: 40,
  uncommon: 22,
  rare: 11,
  epic: 4.5,
  legendary: 1.5,
};

export const EVENT_RARITY_META = {
  common: {
    label: 'Commun',
    className: 'border-stone-500/60 bg-stone-900/80 text-stone-300',
  },
  uncommon: {
    label: 'Peu commun',
    className: 'border-emerald-600/50 bg-emerald-950/50 text-emerald-300',
  },
  rare: {
    label: 'Rare',
    className: 'border-sky-600/50 bg-sky-950/50 text-sky-300',
  },
  epic: {
    label: 'Épique',
    className: 'border-violet-500/50 bg-violet-950/50 text-violet-300',
  },
  legendary: {
    label: 'Légendaire',
    className: 'border-amber-500/60 bg-amber-950/50 text-amber-200',
  },
};

export function getEventBaseWeight(event) {
  if (typeof event?.weight === 'number') return event.weight;
  return EVENT_RARITY_WEIGHTS[event?.rarity] ?? EVENT_RARITY_WEIGHTS.common;
}

export function getRarityMeta(rarity) {
  return EVENT_RARITY_META[rarity] || EVENT_RARITY_META.common;
}
