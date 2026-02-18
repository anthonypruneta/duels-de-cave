const emptyBonus = { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 };

export const getClassBonus = (clazz) => {
  const b = { ...emptyBonus };
  if (clazz === 'Voleur') b.spd = 5;
  if (clazz === 'Guerrier') b.auto = 5;
  if (clazz === 'Bastion') b.def = 3;
  return b;
};

export const normalizeCharacterBonuses = (character) => {
  if (!character?.bonuses?.class || !character?.bonuses?.race || !character?.base) return character;
  const expectedClassBonus = getClassBonus(character.class);
  const classBonus = { ...emptyBonus, ...character.bonuses.class };
  const raceBonus = { ...emptyBonus, ...character.bonuses.race };
  const updatedBase = { ...character.base };
  let changed = false;

  Object.keys(expectedClassBonus).forEach((key) => {
    const diff = (expectedClassBonus[key] || 0) - (classBonus[key] || 0);
    if (diff !== 0) {
      updatedBase[key] = (updatedBase[key] || 0) + diff;
      classBonus[key] = expectedClassBonus[key];
      changed = true;
    }
  });

  if (!changed) return character;

  return {
    ...character,
    base: updatedBase,
    bonuses: {
      ...character.bonuses,
      race: raceBonus,
      class: classBonus,
    },
  };
};
