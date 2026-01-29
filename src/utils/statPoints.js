const STAT_POINT_VALUES = {
  hp: 3,
  auto: 1,
  def: 1,
  cap: 1,
  rescap: 1,
  spd: 1
};

export const getStatPointValue = (statKey) => STAT_POINT_VALUES[statKey] ?? 1;

export const applyStatPoints = (baseStats, statKey, points) => {
  const delta = getStatPointValue(statKey) * points;
  return {
    updatedStats: {
      ...baseStats,
      [statKey]: (baseStats[statKey] || 0) + delta
    },
    delta
  };
};

export const getStatLabels = () => ({
  hp: 'HP',
  auto: 'ATK',
  def: 'DEF',
  rescap: 'RESC',
  spd: 'VIT',
  cap: 'CAP'
});
