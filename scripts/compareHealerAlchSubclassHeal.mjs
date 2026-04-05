/**
 * Comparaison théorique Soin puissant (Healer) vs Flasque de vie (Alchimiste)
 * avec sous-classes — aligné sur combatMechanics + getSubclassStatBonuses.
 *
 * Hypothèses : pas d'anti-soin, pas Sirène / Pendule / Verdict / braises,
 * getEffectiveCapForSceptre = base.cap, spellCapMult = 1, pas crit Yggdrasil.
 *
 * Usage : node scripts/compareHealerAlchSubclassHeal.mjs
 */

import { classConstants, subclassConstants } from '../src/data/combatMechanics.js';

/** Aligné sur src/data/subclasses.js SUBCLASS_STAT_BONUSES (évite l’import de classes.jsx). */
const SUBCLASS_STAT_BONUSES = {
  luxum: { cap: 0.1 },
  latum: { auto: 0.08 },
  maitre_alchimiste: { cap: 0.1 },
  alchimiste_metal: { auto: 0.05 },
};

const maxHP = 700;
const currentHP = Math.round(maxHP * 0.3);
const miss = maxHP - currentHP;

/** Stats « feuille » avant bonus sous-classe (comme l’exemple 100 Auto / 150 Cap). */
const baseAuto = 100;
const baseCap = 150;

function applySubclassStats(subclassId) {
  const b = { auto: baseAuto, cap: baseCap };
  const pct = SUBCLASS_STAT_BONUSES[subclassId];
  if (!pct) return b;
  const out = { ...b };
  for (const [stat, p] of Object.entries(pct)) {
    if (out[stat] != null && p) {
      out[stat] = Math.max(1, Math.round(out[stat] * (1 + p)));
    }
  }
  return out;
}

function healerBaseHeal(cap) {
  const { missingHpPercent, capScale } = classConstants.healer;
  return Math.max(1, Math.round(missingHpPercent * miss + capScale * cap));
}

function alchLifeHeal(cap, subclassId) {
  const alchBase = classConstants.alchimiste;
  const sub = getSubclassCapacityConstantsMerged('Alchimiste', subclassId);
  const lifeCapScale = sub.lifeCapScale ?? alchBase.lifeCapScale;
  return Math.max(1, Math.round(cap * lifeCapScale));
}

function getSubclassCapacityConstantsMerged(className, subclassId) {
  const key =
    className === 'Healer'
      ? 'healer'
      : className === 'Alchimiste'
        ? 'alchimiste'
        : null;
  const base = key ? { ...classConstants[key] } : {};
  if (subclassId && subclassConstants[subclassId]) {
    return { ...base, ...subclassConstants[subclassId] };
  }
  return base;
}

console.log('=== Paramètres ===');
console.log(`PV max ${maxHP}, PV actuels ${currentHP} (${((currentHP / maxHP) * 100).toFixed(0)} %), PV manquants ${miss}`);
console.log(`Base avant sous-classe : Auto ${baseAuto}, Cap ${baseCap}\n`);

console.log('=== Healer — Soin puissant (25 % PV manquants + 40 % Cap) ===');
for (const id of ['luxum', 'latum']) {
  const st = applySubclassStats(id);
  const h = healerBaseHeal(st.cap);
  console.log(`  ${id}: Cap effective ${st.cap} (Auto ${st.auto}) → soin base ${h} PV`);
}

console.log('\n=== Alchimiste — Flasque de vie (lifeCapScale × Cap) ===');
for (const id of ['maitre_alchimiste', 'alchimiste_metal']) {
  const st = applySubclassStats(id);
  const sub = getSubclassCapacityConstantsMerged('Alchimiste', id);
  const scale = sub.lifeCapScale ?? classConstants.alchimiste.lifeCapScale;
  const h = alchLifeHeal(st.cap, id);
  console.log(`  ${id}: Cap ${st.cap}, lifeCapScale ${scale} → soin base ${h} PV`);
}

console.log('\n=== Matrice (soin d’un cast, même scénario) ===');
const healers = {
  Luxum: healerBaseHeal(applySubclassStats('luxum').cap),
  Latum: healerBaseHeal(applySubclassStats('latum').cap),
};
const alchs = {
  'Maître Alchimiste': alchLifeHeal(applySubclassStats('maitre_alchimiste').cap, 'maitre_alchimiste'),
  'Alchimiste de Métal': alchLifeHeal(applySubclassStats('alchimiste_metal').cap, 'alchimiste_metal'),
};
for (const [hk, hv] of Object.entries(healers)) {
  for (const [ak, av] of Object.entries(alchs)) {
    const cmp = hv > av ? 'Healer' : hv < av ? 'Alch' : '=';
    console.log(`  ${hk} (${hv}) vs ${ak} (${av}) → +${Math.abs(hv - av)} pour ${cmp === '=' ? 'égalité' : cmp}`);
  }
}
