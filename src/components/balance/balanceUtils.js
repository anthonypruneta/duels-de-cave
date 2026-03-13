export const deepClone = (value) => JSON.parse(JSON.stringify(value));

export const applyNumericOverrides = (target, source) => {
  Object.entries(source).forEach(([key, val]) => {
    if (!(key in target)) return;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      applyNumericOverrides(target[key], val);
      return;
    }
    const parsed = Number(val);
    if (!Number.isNaN(parsed)) target[key] = parsed;
  });
};

export const updateNestedValue = (obj, path, value) => {
  if (!path.length) return obj;
  const [head, ...rest] = path;
  return {
    ...obj,
    [head]: rest.length ? updateNestedValue(obj[head] || {}, rest, value) : value
  };
};

export const getNested = (obj, path) => {
  let cur = obj;
  for (const k of path) cur = cur?.[k];
  return cur;
};

const BALANCE_KEY_LABELS_FR = {
  healDamagePercent: 'Dégâts depuis soins',
  regenPercent: 'Régénération',
  healCritMultiplier: 'Multiplicateur critique soin',
  defToAtkPercent: 'DEF convertie en Auto',
  rescapToAtkPercent: 'RESC convertie en Auto',
  damageBonus: 'Bonus dégâts',
  n: 'Fréquence (tours/attaques)',
  shieldPercent: 'Bouclier',
  damageTakenBonus: 'Dégâts subis bonus',
  defReduction: 'Réduction DEF',
  healPercent: 'Soins',
  lightningPercent: 'Dégâts éclair',
  outgoing: 'Dégâts infligés',
  incoming: 'Dégâts reçus',
  critReduction: 'Réduction dégâts critiques',
  critThreshold: 'Seuil critique garanti',
  spellCapBonus: 'Bonus CAP de la capacité',
  turns: 'Durée (tours)',
  hpCostPercent: 'Coût HP',
  autoDamageBonus: 'Bonus dégâts auto',
  shieldExplosionPercent: 'Explosion bouclier',
  healReduction: 'Réduction des soins',
  initialBleedPercent: 'Saignement initial',
  bleedDecayPercent: 'Décroissance saignement',
  stunDuration: 'Durée étourdissement',
  critChanceBonus: 'Chance critique bonus',
  critDamageBonus: 'Dégâts critiques bonus',
  outgoingDamageMultiplier: 'Multiplicateur dégâts infligés (ex. 0.8 = -20%)',
  maxStacks: 'Stacks max',
  chance: 'Chance'
};

export const prettifyKey = (key) => BALANCE_KEY_LABELS_FR[key] || key
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/_/g, ' ')
  .replace(/^./, (c) => c.toUpperCase());

export const inferSlotFormat = (key, value) => {
  if (typeof value !== 'number') return 'raw';
  if (Math.abs(value) <= 1 && /(percent|bonus|reduction|multiplier|chance|threshold|scale|outgoing|incoming|regen|damage|heal|crit|ignore|reflect|shield|cost)/i.test(key)) {
    return 'percent';
  }
  return 'raw';
};

export const flattenNumericEntries = (obj, basePath = []) => {
  const entries = [];
  Object.entries(obj || {}).forEach(([key, val]) => {
    if (key === 'description') return;
    const path = [...basePath, key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      entries.push(...flattenNumericEntries(val, path));
      return;
    }
    if (typeof val === 'number') {
      entries.push({ key, path, format: inferSlotFormat(key, val) });
    }
  });
  return entries;
};

export const buildPartsFromEntries = (entries) => entries.flatMap((entry, index) => {
  const head = index === 0 ? '' : ' · ';
  return [
    { type: 'text', value: `${head}${prettifyKey(entry.key)}: ` },
    { type: 'slot', path: entry.path, format: entry.format }
  ];
});

export const buildAutoDescription = (values) => {
  const entries = flattenNumericEntries(values || {}, []);
  if (entries.length === 0) return '';
  return entries.map((e) => {
    const v = getNested(values, e.path);
    const num = Number(v);
    if (Number.isNaN(num)) return '';
    const pct100 = num * 100;
    const useDecimals = e.format === 'percent1dec' || (e.format === 'percent' && pct100 % 1 !== 0);
    const display = e.format === 'percent' || e.format === 'percent1dec'
      ? `${pct100.toFixed(useDecimals ? 1 : 0)}%`
      : String(num);
    return `${prettifyKey(e.key)}: ${display}`;
  }).filter(Boolean).join(' · ');
};

const buildCodexEffetDescription = (values) => {
  const pct = values?.secondCastDamage != null
    ? (Number(values.secondCastDamage) * 100).toFixed((Number(values.secondCastDamage) * 100) % 1 === 0 ? 0 : 1)
    : '70';
  return `Chaque capacité sur deux (2e, 4e, 6e…) se lance deux fois et fait ${pct}% de dégâts.`;
};

const WEAPON_EFFET_DESCRIPTION_TEMPLATES = {
  baton_legendaire: 'Les soins du personnage peuvent critiquer et infligent aussi {{healDamagePercent}} % de leur valeur en dégâts. S\'il ne possède aucun soin, il régénère {{regenPercent}} % de ses PV max par tour.',
  bouclier_legendaire: 'Ajoute {{defToAtkPercent}}% de la DEF et {{rescapToAtkPercent}}% de la RESC à l\'Auto.',
  epee_legendaire: 'Tous les {{n}} tours, frappe en premier et inflige +{{damageBonus}}% de dégâts.',
  dague_legendaire: 'Tous les {{n}} tours, critique garanti. Tous les critiques infligent +{{critDamageBonus}}% de dégâts.',
  marteau_legendaire: 'Toutes les {{n}} attaques, étourdit l\'ennemi pendant {{stunDuration}} tour.',
  lance_legendaire: 'Au premier coup du combat, applique -{{atkReductionPercent}}% Auto permanent à l\'ennemi (non cumulable).',
  arc_legendaire: 'Tous les {{n}} tours, effectue une attaque supplémentaire à {{bonusAttackDamage}}% de dégâts.',
  tome_legendaire: null,
  fleau_legendaire: 'Après votre première attaque, la cible perd {{defReductionPercent}}% DEF et {{rescapReductionPercent}}% ResC pour le reste du combat.',
  arbalete_legendaire: 'Vos {{spellBonusCount}} premières capacités infligent +{{spellDamageBonus}}% dégâts et soins mais ont +{{cooldownPenalty}} CD.',
  hache_legendaire: 'Votre attaque applique un saignement brut : la cible perd {{initialBleedPercent}}% HP max à chacun de ses tours d\'action. Réduit de {{bleedDecayPercent}}% par tour (3→2→1→0). Réapplicable à 0%. Dégâts bruts.',
};

const formatValueForDescription = (key, value) => {
  const v = Number(value);
  if (Number.isNaN(v)) return String(value ?? '');
  if (Math.abs(v) <= 1 && /(percent|bonus|reduction|damage|heal|scale)/i.test(key)) {
    const pct = v * 100;
    return pct % 1 === 0 ? String(Math.round(pct)) : pct.toFixed(1).replace('.', ',');
  }
  return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
};

export const buildWeaponEffetDescriptionFromTemplate = (weaponId, effet) => {
  if (!effet) return '';
  if (weaponId === 'tome_legendaire' && effet.values) return buildCodexEffetDescription(effet.values);
  const template = WEAPON_EFFET_DESCRIPTION_TEMPLATES[weaponId];
  if (!template) return effet.description || '';
  const values = effet.values || {};
  const trigger = effet.trigger || {};
  const replacements = { ...values, n: trigger.n };
  let out = template;
  Object.entries(replacements).forEach(([key, val]) => {
    if (val === undefined || val === null) return;
    const str = typeof val === 'number' ? formatValueForDescription(key, val) : String(val);
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), str);
  });
  return out;
};

export const formatNumberFr = (val, format) => {
  const v = Number(val);
  if (Number.isNaN(v)) return '';
  switch (format) {
    case 'percent': return (v * 100) % 1 === 0 ? String(Math.round(v * 100)) : (v * 100).toFixed(1).replace('.', ',');
    case 'percent1dec': return (v * 100).toFixed(1).replace('.', ',');
    case 'percentMinus1': return ((v - 1) * 100) % 1 === 0 ? String(Math.round((v - 1) * 100)) : ((v - 1) * 100).toFixed(1).replace('.', ',');
    case 'percentReduction': return ((1 - v) * 100) % 1 === 0 ? String(Math.round((1 - v) * 100)) : ((1 - v) * 100).toFixed(1).replace('.', ',');
    default: return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
  }
};
