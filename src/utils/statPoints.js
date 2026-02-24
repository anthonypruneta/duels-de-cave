const STAT_POINT_VALUES = {
  hp: 6,
  auto: 1,
  def: 1,
  cap: 1,
  rescap: 1,
  spd: 1
};

export const getStatPointValue = (statKey) => STAT_POINT_VALUES[statKey] ?? 1;

export const getEmptyStatBoosts = () => ({
  hp: 0,
  auto: 0,
  def: 0,
  cap: 0,
  rescap: 0,
  spd: 0
});

export const applyStatBoosts = (baseStats, boosts = {}) => {
  const result = { ...baseStats };
  const normalizedBoosts = { ...getEmptyStatBoosts(), ...boosts };

  Object.entries(normalizedBoosts).forEach(([statKey, value]) => {
    if (result[statKey] !== undefined) {
      result[statKey] += value;
    }
  });

  return result;
};

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
  auto: 'Auto',
  def: 'DEF',
  rescap: 'RESC',
  spd: 'VIT',
  cap: 'CAP'
});
