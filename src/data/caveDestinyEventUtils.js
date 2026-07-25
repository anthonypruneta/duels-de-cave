/**
 * Utilitaires partagés des événements Cave Destiny.
 */

const STAT_LABELS = {
  puissance: 'Puissance',
  endurance: 'Endurance',
  magie: 'Magie',
  vitesse: 'Vitesse',
  charisme: 'Charisme',
  renommee: 'Renommée',
  or: 'Or',
  forme: 'Forme',
  moral: 'Moral',
};

const RARITY_LABELS = {
  commune: 'commune',
  rare: 'rare',
  légendaire: 'légendaire',
};

/** Construit le trio obligatoire bonus / neutre / malus */
export function trio(bonus, neutre, malus, weights = [30, 40, 30]) {
  const pack = (variant, weight, o) => ({
    variant,
    weight,
    text: o.text,
    deltas: o.deltas,
    ...(o.weaponProgress ? { weaponProgress: o.weaponProgress } : {}),
    ...(o.subclassGain ? { subclassGain: o.subclassGain } : {}),
  });
  return [
    pack('bonus', weights[0], bonus),
    pack('neutre', weights[1], neutre),
    pack('malus', weights[2], malus),
  ];
}

/**
 * Évalue si un choix est accessible.
 * `require` = restrictions visibles (choix affiché mais verrouillé si non rempli).
 */
export function evaluateOptionAccess(opt, character, career) {
  const req = opt?.require || {};
  const reasons = [];
  const stats = career?.stats || {};

  for (const [stat, min] of Object.entries(req.stats || {})) {
    const val = Number(stats[stat]) || 0;
    if (val < min) {
      reasons.push(`${STAT_LABELS[stat] || stat} ≥ ${min}`);
    }
  }

  // Race / classe : si les deux sont listés → l’un des deux suffit (OU)
  if (req.races?.length && req.classes?.length) {
    const raceOk = req.races.includes(character?.race);
    const classOk = req.classes.includes(character?.class);
    if (!raceOk && !classOk) {
      reasons.push(`Race ${req.races.join('/')} ou classe ${req.classes.join('/')}`);
    }
  } else {
    if (req.races?.length && !req.races.includes(character?.race)) {
      reasons.push(`Race : ${req.races.join(' / ')}`);
    }
    if (req.classes?.length && !req.classes.includes(character?.class)) {
      reasons.push(`Classe : ${req.classes.join(' / ')}`);
    }
  }
  if (req.weaponFamilies?.length && !req.weaponFamilies.includes(career?.weapon?.family)) {
    reasons.push(`Famille d’arme : ${req.weaponFamilies.join(' / ')}`);
  }
  if (req.weaponRarities?.length && !req.weaponRarities.includes(career?.weapon?.rarity)) {
    const labels = req.weaponRarities.map((r) => RARITY_LABELS[r] || r);
    reasons.push(`Arme ${labels.join(' / ')}`);
  }
  if (typeof req.minRenommee === 'number' && (stats.renommee || 0) < req.minRenommee) {
    reasons.push(`Renommée ≥ ${req.minRenommee}`);
  }
  if (req.noSubclass && career?.subclass) {
    reasons.push('Déjà une sous-classe');
  }
  if (req.hasSubclass && !career?.subclass) {
    reasons.push('Sous-classe requise');
  }

  return { locked: reasons.length > 0, lockReasons: reasons };
}

function optionHiddenByLegacyFilter(opt, character) {
  const race = character?.race;
  const classe = character?.class;
  if (opt.ifRace?.length && !opt.ifRace.includes(race)) return true;
  if (opt.ifClass?.length && !opt.ifClass.includes(classe)) return true;
  return false;
}

/**
 * Options pour un event.
 * - ifRace / ifClass : masquent l’option (spécifiques).
 * - require : option visible, éventuellement verrouillée.
 * Garantit ≥ 3 choix débloqués.
 */
export function getOptionsForEvent(event, character, career) {
  const all = event?.options || [];
  const result = [];

  for (const opt of all) {
    if (optionHiddenByLegacyFilter(opt, character)) continue;
    const access = evaluateOptionAccess(opt, character, career);
    result.push({
      ...opt,
      locked: access.locked,
      lockReasons: access.lockReasons,
    });
  }

  const unlocked = result.filter((o) => !o.locked);
  if (unlocked.length >= 3) return result;

  // Complète avec des génériques non encore présents
  const generics = all.filter(
    (o) => !o.ifRace?.length && !o.ifClass?.length && !o.require
  );
  const ids = new Set(result.map((o) => o.id || o.label));
  for (const g of generics) {
    const key = g.id || g.label;
    if (ids.has(key)) continue;
    result.push({ ...g, locked: false, lockReasons: [] });
    ids.add(key);
    if (result.filter((o) => !o.locked).length >= 3) break;
  }
  return result;
}

export { STAT_LABELS };
