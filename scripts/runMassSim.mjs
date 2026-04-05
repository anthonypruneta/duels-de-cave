/**
 * Simulation de masse (simulerMatch / combatSimulation).
 * Usage : node scripts/runMassSim.mjs [nombreCombats] [niveau]
 */
import { runSimulation } from '../src/utils/combatSimulation.js';

const num = Math.max(1, Number(process.argv[2]) || 2000);
const level = Math.max(1, Number(process.argv[3]) || 100);

const r = runSimulation(num, level, { quiet: true });

const B = {
  tl: '┌',
  tr: '┐',
  bl: '└',
  br: '┘',
  h: '─',
  v: '│',
  lj: '├',
  rj: '┤',
  tm: '┬',
  bm: '┴',
  x: '┼'
};

/** Largeur totale d'une ligne de tableau (bordures │ incluses) */
function tableOuterWidth(widths) {
  return widths.reduce((a, w) => a + w, 0) + 3 * widths.length + 1;
}

function padCell(s, w, right = false) {
  const str = String(s);
  if (str.length >= w) return str.slice(0, w);
  const sp = w - str.length;
  return right ? ' '.repeat(sp) + str : str + ' '.repeat(sp);
}

/** Barre de taux (plein █, vide ░) ; sans données → points · */
function winRateBar(rateStr, barW = 18) {
  const p = Number(rateStr);
  if (!Number.isFinite(p)) return '·'.repeat(barW);
  const clamped = Math.min(100, Math.max(0, p));
  const filled = Math.round((clamped / 100) * barW);
  return '█'.repeat(filled) + '░'.repeat(barW - filled);
}

/**
 * @param {string} title
 * @param {{ key: string, header: string, width: number, right?: boolean }[]} cols
 * @param {Record<string, unknown>[]} rows
 */
function printTable(title, cols, rows) {
  const widths = cols.map((c) => c.width);
  const W = tableOuterWidth(widths);
  const inner = W - 2;

  let t = title;
  if (t.length > inner) t = `${t.slice(0, Math.max(0, inner - 1))}…`;

  const pad = inner - t.length;
  const padL = Math.floor(pad / 2);
  const padR = pad - padL;

  console.log('');
  console.log(`${B.tl}${B.h.repeat(W - 2)}${B.tr}`);
  console.log(`${B.v}${' '.repeat(padL)}${t}${' '.repeat(padR)}${B.v}`);

  const headerCells = cols.map((c, i) => padCell(c.header, widths[i], c.right));
  console.log(`${B.lj}${widths.map((w) => B.h.repeat(w + 2)).join(B.tm)}${B.rj}`);
  console.log(`${B.v} ${headerCells.join(` ${B.v} `)} ${B.v}`);
  console.log(`${B.lj}${widths.map((w) => B.h.repeat(w + 2)).join(B.x)}${B.rj}`);

  for (const row of rows) {
    const cells = cols.map((c, i) => padCell(row[c.key], widths[i], c.right));
    console.log(`${B.v} ${cells.join(` ${B.v} `)} ${B.v}`);
  }

  console.log(`${B.bl}${widths.map((w) => B.h.repeat(w + 2)).join(B.bm)}${B.br}`);
}

function rowDisplay(x, primaryKey) {
  const empty = x.combats === 0;
  return {
    [primaryKey]: x[primaryKey],
    rate: empty ? '—' : `${x.winRate}%`,
    bar: empty ? '·'.repeat(18) : winRateBar(x.winRate),
    ratio: empty ? '—' : `${x.wins} / ${x.combats}`
  };
}

const raceRows = r.sortedRaces.map((x) => rowDisplay(x, 'race'));
const classRows = r.sortedClasses.map((x) => rowDisplay(x, 'cls'));
const subRows = r.sortedSubclasses.map((x) => ({ ...rowDisplay(x, 'name'), id: x.id }));

function padCenter(text, width) {
  const s = String(text);
  if (s.length >= width) return s.slice(0, width);
  const p = width - s.length;
  const l = Math.floor(p / 2);
  return ' '.repeat(l) + s + ' '.repeat(p - l);
}

const wRace = Math.max(12, ...raceRows.map((o) => o.race.length));
const wClass = Math.max(14, ...classRows.map((o) => o.cls.length));
const wSubName = Math.max(22, ...subRows.map((o) => o.name.length));
const wSubId = Math.max(18, ...subRows.map((o) => o.id.length));

const ratioCol = { key: 'ratio', header: 'Victoires / apparitions', width: 24, right: true };

printTable(`Races  ·  ${num} combats  ·  niveau ${level}`, [
  { key: 'race', header: 'Race', width: wRace },
  { key: 'rate', header: 'Taux', width: 7, right: true },
  { key: 'bar', header: 'Répartition', width: 18 },
  ratioCol
], raceRows);

printTable('Classes', [
  { key: 'cls', header: 'Classe', width: wClass },
  { key: 'rate', header: 'Taux', width: 7, right: true },
  { key: 'bar', header: 'Répartition', width: 18 },
  ratioCol
], classRows);

printTable('Sous-classes', [
  { key: 'name', header: 'Nom', width: wSubName },
  { key: 'id', header: 'Identifiant', width: wSubId },
  { key: 'rate', header: 'Taux', width: 7, right: true },
  { key: 'bar', header: 'Répartition', width: 18 },
  ratioCol
], subRows);

const summaryW = 36;
console.log('');
console.log(`${B.tl}${B.h.repeat(summaryW - 2)}${B.tr}`);
console.log(`${B.v}${padCenter(`Tours moyens : ${r.avgTurns}`, summaryW - 2)}${B.v}`);
console.log(`${B.bl}${B.h.repeat(summaryW - 2)}${B.br}`);
console.log('');
