/**
 * Utilitaires partagés des événements Cave Destiny.
 */

/** Construit le trio obligatoire bonus / neutre / malus */
export function trio(bonus, neutre, malus, weights = [30, 40, 30]) {
  const pack = (variant, weight, o) => ({
    variant,
    weight,
    text: o.text,
    deltas: o.deltas,
    ...(o.weaponProgress ? { weaponProgress: o.weaponProgress } : {}),
  });
  return [
    pack('bonus', weights[0], bonus),
    pack('neutre', weights[1], neutre),
    pack('malus', weights[2], malus),
  ];
}

function optionMatches(opt, character) {
  const race = character?.race;
  const classe = character?.class;
  if (opt.ifRace?.length && !opt.ifRace.includes(race)) return false;
  if (opt.ifClass?.length && !opt.ifClass.includes(classe)) return false;
  return true;
}

/**
 * Options visibles pour un perso : génériques + spécifiques race/classe.
 * Garantit au moins 3 choix.
 */
export function getOptionsForEvent(event, character) {
  const all = event?.options || [];
  const matched = all.filter((o) => optionMatches(o, character));
  if (matched.length >= 3) return matched;

  const generics = all.filter((o) => !o.ifRace?.length && !o.ifClass?.length);
  const ids = new Set(matched.map((o) => o.id || o.label));
  for (const g of generics) {
    const key = g.id || g.label;
    if (ids.has(key)) continue;
    matched.push(g);
    ids.add(key);
    if (matched.length >= 3) break;
  }
  return matched;
}
