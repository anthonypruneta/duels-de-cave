/**
 * Service d'audit anti-triche — Duels de Cave (version "snapshots")
 *
 * Principe :
 * - À chaque victoire significative (étage du Labyrinthe, 1er clear d'un boss
 *   de donjon), un snapshot des stats actuelles du personnage est écrit dans
 *   `characters/{uid}/statSnapshots/*`.
 * - Cet audit compare les stats au moment des snapshots aux stats ACTUELLES
 *   du personnage. Si le joueur a temporairement "boost" ses stats pour battre
 *   un boss puis les a remises à la normale, l'écart est visible.
 *
 * Tout est en lecture seule.
 */

import { collection, getDocs, collectionGroup, query, orderBy } from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import { getAllCharacters } from './characterService';
import { getStatPointValue } from '../utils/statPoints';

// =====================================================================
// Constantes
// =====================================================================

const STAT_KEYS = ['hp', 'auto', 'def', 'cap', 'rescap', 'spd'];

// Un snapshot est "suspect" si une stat est au moins X points (non-HP) ou
// X points équivalents HP au-dessus de la valeur actuelle. Les stats ne
// peuvent QUE monter (forêt/niveau/éveil), donc toute régression est louche.
const HP_REGRESSION_THRESHOLD = 6; // 1 point de stat HP = 6 PV
const STAT_REGRESSION_THRESHOLD = 1; // toute régression d'1 point est suspecte

// Pour éviter de spammer sur les tout petits écarts dus à des migrations,
// on lève une alerte "critical" seulement à partir de ces écarts :
const HP_REGRESSION_CRITICAL = 30; // ≥ 5 points de stat HP
const STAT_REGRESSION_CRITICAL = 5; // ≥ 5 points de stat non-HP

// Un snapshot peut aussi perdre une forêt boosts / niveau : c'est impossible
// en jeu normal → suspect aussi.
const FOREST_REGRESSION_CRITICAL = 5;
const LEVEL_REGRESSION_CRITICAL = 10;

// =====================================================================
// Types (JSDoc)
// =====================================================================

/**
 * @typedef {'critical'|'high'|'medium'|'low'|'info'} Severity
 *
 * @typedef {Object} StatSnapshot
 * @property {string} id
 * @property {'labyrinth'|'dungeon'} type
 * @property {string} context
 * @property {any} when  // Timestamp Firestore
 * @property {Object} stats
 * @property {Object} [extra]
 *
 * @typedef {Object} Finding
 * @property {string} userId
 * @property {string} characterName
 * @property {string} ownerPseudo
 * @property {Severity} severity
 * @property {string} category
 * @property {string} message
 * @property {StatSnapshot} [snapshot]
 * @property {Object} [diff]
 */

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

// =====================================================================
// Utilitaires
// =====================================================================

function mkFinding(char, severity, category, message, extra = {}) {
  return {
    userId: char?.id || char?.userId || '?',
    characterName: char?.name || '(sans nom)',
    ownerPseudo: char?.ownerPseudo || '',
    severity,
    category,
    message,
    ...extra,
  };
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeStats(obj) {
  const out = { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 };
  if (!obj) return out;
  for (const k of STAT_KEYS) out[k] = toNumber(obj[k], 0);
  return out;
}

function computeFinalStats(statBlock) {
  // Stats finales théoriques : base + forestBoosts
  const base = safeStats(statBlock?.base);
  const fb = safeStats(statBlock?.forestBoosts);
  return STAT_KEYS.reduce((acc, k) => {
    acc[k] = base[k] + fb[k];
    return acc;
  }, {});
}

function formatWhen(ts) {
  try {
    if (!ts) return '—';
    if (typeof ts.toDate === 'function') {
      const d = ts.toDate();
      return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    if (ts.seconds) {
      const d = new Date(ts.seconds * 1000);
      return d.toLocaleString('fr-FR');
    }
    return String(ts);
  } catch {
    return '—';
  }
}

// =====================================================================
// Comparaison snapshot ↔ stats actuelles
// =====================================================================

/**
 * Somme base + forestBoosts pour obtenir la stat "totale" hors bonus race/classe/arme.
 * C'est la métrique qui détecte un cheat, peu importe si le joueur a trafiqué
 * base ou forestBoosts.
 */
function totalStats(statBlock) {
  const base = safeStats(statBlock?.base);
  const forest = safeStats(statBlock?.forestBoosts);
  return STAT_KEYS.reduce((acc, k) => { acc[k] = base[k] + forest[k]; return acc; }, {});
}

/**
 * Compare les stats d'un snapshot aux stats actuelles du personnage.
 * Retourne un tableau de findings.
 */
function compareSnapshotToCurrent(char, snapshot, findings) {
  const snapStats = snapshot?.stats;
  if (!snapStats) return;

  // Incohérence Race/Classe (un joueur ne devrait jamais changer de race/classe)
  if (snapStats.race && char.race && snapStats.race !== char.race) {
    findings.push(
      mkFinding(char, 'critical', 'identity',
        `La race a changé : snapshot "${snapStats.race}" → actuel "${char.race}"`,
        { snapshot, diff: { race: { snap: snapStats.race, current: char.race } } }
      )
    );
  }
  if (snapStats.class && char.class && snapStats.class !== char.class) {
    findings.push(
      mkFinding(char, 'critical', 'identity',
        `La classe a changé : snapshot "${snapStats.class}" → actuel "${char.class}"`,
        { snapshot, diff: { class: { snap: snapStats.class, current: char.class } } }
      )
    );
  }

  // Niveau : ne peut QUE monter.
  const snapLevel = toNumber(snapStats.level, 1);
  const curLevel = toNumber(char.level, 1);
  if (snapLevel > curLevel + LEVEL_REGRESSION_CRITICAL) {
    findings.push(
      mkFinding(char, 'critical', 'level',
        `Niveau au snapshot (${snapLevel}) > niveau actuel (${curLevel}). Le niveau ne peut jamais baisser.`,
        { snapshot, diff: { level: { snap: snapLevel, current: curLevel, delta: snapLevel - curLevel } } }
      )
    );
  } else if (snapLevel > curLevel) {
    findings.push(
      mkFinding(char, 'high', 'level',
        `Niveau au snapshot (${snapLevel}) > niveau actuel (${curLevel})`,
        { snapshot, diff: { level: { snap: snapLevel, current: curLevel, delta: snapLevel - curLevel } } }
      )
    );
  }

  // Stats TOTALES (base + forêt) : ne peuvent QUE monter en jeu normal.
  // Toute régression = le joueur a modifié ses stats, peu importe où (base ou forêt).
  const snapTotal = totalStats(snapStats);
  const curTotal = totalStats(char);
  const snapBase = safeStats(snapStats.base);
  const curBase = safeStats(char.base);
  const snapForest = safeStats(snapStats.forestBoosts);
  const curForest = safeStats(char.forestBoosts);

  for (const k of STAT_KEYS) {
    const delta = snapTotal[k] - curTotal[k];
    if (delta <= 0) continue;
    const isHp = k === 'hp';
    const threshold = isHp ? HP_REGRESSION_THRESHOLD : STAT_REGRESSION_THRESHOLD;
    const critThreshold = isHp ? HP_REGRESSION_CRITICAL : STAT_REGRESSION_CRITICAL;
    if (delta < threshold) continue;

    const severity = delta >= critThreshold ? 'critical' : 'high';
    const deltaBase = snapBase[k] - curBase[k];
    const deltaForest = snapForest[k] - curForest[k];
    const src = [];
    if (deltaBase > 0) src.push(`base: ${snapBase[k]} → ${curBase[k]} (−${deltaBase})`);
    if (deltaForest > 0) src.push(`forêt: ${snapForest[k]} → ${curForest[k]} (−${deltaForest})`);
    const sourceNote = src.length > 0 ? ` [source : ${src.join(', ')}]` : '';

    findings.push(
      mkFinding(char, severity, 'stats_regression',
        `Total ${k} (base+forêt) a DIMINUÉ depuis ${snapshot.context} : ${snapTotal[k]} → ${curTotal[k]} (écart: ${delta})${sourceNote}`,
        {
          snapshot,
          diff: {
            stat: k,
            snapTotal: snapTotal[k],
            currentTotal: curTotal[k],
            delta,
            snapBase: snapBase[k],
            currentBase: curBase[k],
            snapForest: snapForest[k],
            currentForest: curForest[k],
          }
        }
      )
    );
  }
}

// =====================================================================
// Comparaison inter-snapshots (régression entre deux snapshots)
// =====================================================================

/**
 * Compare les snapshots chronologiquement entre eux.
 * Détecte une stat qui descend d'un snapshot au suivant.
 */
function checkSnapshotChronology(char, snapshots, findings) {
  if (!snapshots || snapshots.length < 2) return;

  // Tri chronologique (plus ancien en premier)
  const sorted = [...snapshots].sort((a, b) => {
    const ta = a.when?.seconds ?? (a.when?.toDate ? a.when.toDate().getTime() / 1000 : 0);
    const tb = b.when?.seconds ?? (b.when?.toDate ? b.when.toDate().getTime() / 1000 : 0);
    return ta - tb;
  });

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevTotal = totalStats(prev.stats);
    const currTotal = totalStats(curr.stats);

    for (const k of STAT_KEYS) {
      const delta = prevTotal[k] - currTotal[k];
      if (delta <= 0) continue;
      const isHp = k === 'hp';
      const threshold = isHp ? HP_REGRESSION_THRESHOLD : STAT_REGRESSION_THRESHOLD;
      const critThreshold = isHp ? HP_REGRESSION_CRITICAL : STAT_REGRESSION_CRITICAL;
      if (delta < threshold) continue;

      const severity = delta >= critThreshold ? 'critical' : 'high';
      findings.push(
        mkFinding(char, severity, 'stats_regression',
          `Total ${k} (base+forêt) a baissé entre ${prev.context} et ${curr.context} (${prevTotal[k]} → ${currTotal[k]}, écart: ${delta})`,
          {
            snapshot: curr,
            diff: {
              stat: k,
              from: { context: prev.context, value: prevTotal[k], when: formatWhen(prev.when) },
              to: { context: curr.context, value: currTotal[k], when: formatWhen(curr.when) },
              delta
            }
          }
        )
      );
    }
  }
}

// =====================================================================
// Chargement des snapshots
// =====================================================================

async function loadAllSnapshotsGrouped() {
  // On essaie d'abord la requête collectionGroup (plus efficace).
  // Si les règles ou l'index ne sont pas encore déployés, on fallback vers
  // un parcours perso par perso.
  try {
    const q = query(collectionGroup(db, 'statSnapshots'), orderBy('when', 'asc'));
    const snap = await getDocs(q);
    const grouped = {};
    for (const d of snap.docs) {
      const parentUid = d.ref.parent.parent?.id;
      if (!parentUid) continue;
      if (!grouped[parentUid]) grouped[parentUid] = [];
      grouped[parentUid].push({ id: d.id, ...d.data() });
    }
    return { grouped, mode: 'collectionGroup' };
  } catch (e) {
    console.warn('collectionGroup(statSnapshots) indisponible, fallback:', e?.message || e);
    return { grouped: null, mode: 'fallback' };
  }
}

async function loadSnapshotsForUser(userId) {
  try {
    const colRef = collection(db, 'characters', userId, 'statSnapshots');
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return [];
  }
}

// =====================================================================
// Pipeline principal
// =====================================================================

/**
 * Exécute l'audit snapshot-based.
 *
 * @returns {Promise<{ success: boolean, report?: { summary: Object, suspects: any[], findings: Finding[], perUser: Object }, error?: string }>}
 */
export async function runCheatAudit() {
  try {
    await waitForFirestore();

    const charactersRes = await getAllCharacters();
    if (!charactersRes.success) {
      return { success: false, error: charactersRes.error };
    }

    const allCharacters = (charactersRes.data || []).filter((c) => !c.disabled);

    const { grouped } = await loadAllSnapshotsGrouped();

    // Indexer par userId
    const snapshotsByUser = {};
    if (grouped) {
      Object.assign(snapshotsByUser, grouped);
    } else {
      // Fallback : charger par joueur en parallèle (limité pour éviter les rafales)
      const batchSize = 8;
      for (let i = 0; i < allCharacters.length; i += batchSize) {
        const slice = allCharacters.slice(i, i + batchSize);
        const results = await Promise.all(
          slice.map((c) => loadSnapshotsForUser(c.id).then((list) => [c.id, list]))
        );
        for (const [uid, list] of results) {
          if (list.length > 0) snapshotsByUser[uid] = list;
        }
      }
    }

    const findings = [];
    const perUser = {}; // userId -> { character, snapshots }

    for (const char of allCharacters) {
      const snaps = snapshotsByUser[char.id] || [];
      perUser[char.id] = {
        userId: char.id,
        characterName: char.name,
        ownerPseudo: char.ownerPseudo || '',
        race: char.race,
        class: char.class,
        level: char.level,
        base: char.base,
        forestBoosts: char.forestBoosts,
        snapshots: snaps,
      };

      if (snaps.length === 0) continue;

      for (const s of snaps) {
        compareSnapshotToCurrent(char, s, findings);
      }
      checkSnapshotChronology(char, snaps, findings);
    }

    // Trier par gravité puis par nom.
    findings.sort((a, b) => {
      const sA = SEVERITY_ORDER[a.severity] ?? 99;
      const sB = SEVERITY_ORDER[b.severity] ?? 99;
      if (sA !== sB) return sA - sB;
      return String(a.characterName).localeCompare(String(b.characterName), 'fr');
    });

    // Résumé par joueur.
    const byUser = new Map();
    for (const f of findings) {
      if (!byUser.has(f.userId)) {
        byUser.set(f.userId, {
          userId: f.userId,
          characterName: f.characterName,
          ownerPseudo: f.ownerPseudo,
          counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          findings: [],
        });
      }
      const entry = byUser.get(f.userId);
      entry.counts[f.severity] = (entry.counts[f.severity] || 0) + 1;
      entry.findings.push(f);
    }

    const suspects = Array.from(byUser.values()).sort((a, b) => {
      const scoreA = a.counts.critical * 1000 + a.counts.high * 100 + a.counts.medium * 10 + a.counts.low;
      const scoreB = b.counts.critical * 1000 + b.counts.high * 100 + b.counts.medium * 10 + b.counts.low;
      return scoreB - scoreA;
    });

    const summary = {
      totalCharacters: allCharacters.length,
      totalSnapshots: Object.values(snapshotsByUser).reduce((acc, list) => acc + list.length, 0),
      charactersWithSnapshots: Object.keys(snapshotsByUser).length,
      totalFindings: findings.length,
      totalSuspects: suspects.length,
      bySeverity: findings.reduce((acc, f) => {
        acc[f.severity] = (acc[f.severity] || 0) + 1;
        return acc;
      }, {}),
      byCategory: findings.reduce((acc, f) => {
        acc[f.category] = (acc[f.category] || 0) + 1;
        return acc;
      }, {}),
    };

    return {
      success: true,
      report: { summary, suspects, findings, perUser },
    };
  } catch (error) {
    console.error('runCheatAudit error:', error);
    return { success: false, error: error?.message || String(error) };
  }
}

// =====================================================================
// Libellés UI
// =====================================================================

export const SEVERITY_LABELS = {
  critical: { label: 'Critique', color: 'text-red-400', bg: 'bg-red-900/40', border: 'border-red-500' },
  high: { label: 'Élevé', color: 'text-orange-300', bg: 'bg-orange-900/30', border: 'border-orange-500' },
  medium: { label: 'Moyen', color: 'text-amber-300', bg: 'bg-amber-900/30', border: 'border-amber-500' },
  low: { label: 'Faible', color: 'text-stone-300', bg: 'bg-stone-800/60', border: 'border-stone-600' },
  info: { label: 'Info', color: 'text-sky-300', bg: 'bg-sky-900/30', border: 'border-sky-500' },
};

export const CATEGORY_LABELS = {
  identity: 'Identité',
  level: 'Niveau',
  stats_regression: 'Régression de stats',
  forest_regression: 'Régression forêt',
};

export { formatWhen, computeFinalStats, safeStats, STAT_KEYS };
