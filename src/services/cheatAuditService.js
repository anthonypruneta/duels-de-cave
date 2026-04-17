/**
 * Service d'audit anti-triche — Duels de Cave
 *
 * Parcourt tous les personnages et leurs données annexes (dungeonProgress,
 * pvpDuelLeaderboardEntries, worldBossEvent) et remonte les incohérences
 * qui peuvent signaler une modification directe de la base de données.
 *
 * Le service est 100% en lecture. Aucune modification n'est effectuée.
 */

import { collection, getDocs, collectionGroup } from 'firebase/firestore';
import { db, waitForFirestore } from '../firebase/config';
import { getAllCharacters } from './characterService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { TITLES } from '../data/titles';
import { BORDERS } from '../data/borders';
import { weapons, getWeaponById } from '../data/weapons';
import { MAGE_TOWER_PASSIVES } from '../data/mageTowerPassives';
import { SUBCLASSES_BY_CLASS } from '../data/subclasses';
import { getRaceBonus, getClassBonus } from '../data/combatMechanics';
import { MAX_LEVEL } from '../data/featureFlags';
import { getStatPointValue } from '../utils/statPoints';

// =====================================================================
// Constantes d'audit
// =====================================================================

const BASE_HP_MIN = 120;
const BASE_STAT_MIN = 15;
const BASE_HP_MAX_BEFORE_BONUS = 200; // cap hardcodé dans genStats()
const BASE_STAT_MAX_BEFORE_BONUS = 35;

// Marge de sécurité sur la somme de points investis à la création.
// 35 points distribués + spike éventuel (+5 à +10 inclus dans ces 35).
// On met une tolérance à 40 pour couvrir les edge cases historiques.
const BASE_POINTS_SOFT_LIMIT = 40;

// Au-delà, c'est forcément de la triche.
const BASE_POINTS_HARD_LIMIT = 50;

// Seuils "warning" sur les stats finales (après tous bonus).
const FINAL_HP_SUSPICIOUS = 2000;
const FINAL_STAT_SUSPICIOUS = 300;

// Seuils forêt (très élevé).
const FOREST_POINTS_WARN = 200;

// Seuils PvP.
const PVP_WINS_WARN = 500;
const PVP_WINS_NO_LOSS_WARN = 100;

// Seuils Cataclysme.
const CATACLYSME_DAMAGE_WARN = 10_000_000;

// =====================================================================
// Types (JSDoc)
// =====================================================================

/**
 * @typedef {'critical'|'high'|'medium'|'low'|'info'} Severity
 *
 * @typedef {Object} Finding
 * @property {string} userId
 * @property {string} characterName
 * @property {string} ownerPseudo
 * @property {Severity} severity
 * @property {string} category
 * @property {string} message
 * @property {Object} [details]
 */

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const mkFinding = (char, severity, category, message, details) => ({
  userId: char?.id || char?.userId || '?',
  characterName: char?.name || '(sans nom)',
  ownerPseudo: char?.ownerPseudo || '',
  severity,
  category,
  message,
  details: details || null,
});

// =====================================================================
// Checks individuels
// =====================================================================

/** Race / classe / genre valides. */
function checkIdentity(char, findings) {
  if (char.race && !races[char.race]) {
    findings.push(
      mkFinding(char, 'critical', 'identity', `Race inconnue: "${char.race}"`)
    );
  }
  if (char.class && !classes[char.class]) {
    findings.push(
      mkFinding(char, 'critical', 'identity', `Classe inconnue: "${char.class}"`)
    );
  }
  if (char.gender && char.gender !== 'male' && char.gender !== 'female') {
    findings.push(
      mkFinding(char, 'low', 'identity', `Genre inattendu: "${char.gender}"`)
    );
  }
  if (char.coopRaceEcho?.race && !races[char.coopRaceEcho.race]) {
    findings.push(
      mkFinding(
        char,
        'high',
        'identity',
        `Pointeau ADN race inconnue: "${char.coopRaceEcho.race}"`
      )
    );
  }
}

/** Stats de base cohérentes avec un roll légitime à la création. */
function checkBaseStats(char, findings) {
  if (!char.base || typeof char.base !== 'object') {
    findings.push(mkFinding(char, 'high', 'stats', 'Champ "base" manquant'));
    return;
  }

  const raceBonus = getRaceBonus(char.race || '');
  const classBonus = getClassBonus(char.class || '');
  const hpPerPoint = getStatPointValue('hp');

  const rawHp = (char.base.hp ?? 0) - BASE_HP_MIN - raceBonus.hp - classBonus.hp;
  const hpPoints = rawHp / hpPerPoint;

  const statKeys = ['auto', 'def', 'cap', 'rescap', 'spd'];
  const statPoints = {};
  let totalPoints = hpPoints;

  for (const k of statKeys) {
    const rawK = (char.base[k] ?? 0) - BASE_STAT_MIN - raceBonus[k] - classBonus[k];
    statPoints[k] = rawK;
    totalPoints += rawK;
  }

  // HP doit être un multiple entier de la conversion PV/point.
  if (!Number.isInteger(hpPoints)) {
    findings.push(
      mkFinding(
        char,
        'high',
        'stats',
        `base.hp non conforme (pas un multiple de ${hpPerPoint} après déduction des bonus)`,
        { baseHp: char.base.hp, raceBonusHp: raceBonus.hp, classBonusHp: classBonus.hp, hpPoints }
      )
    );
  }

  // Points négatifs = le joueur a moins que le minimum de départ → cheat.
  if (hpPoints < 0) {
    findings.push(
      mkFinding(char, 'critical', 'stats', `base.hp (${char.base.hp}) inférieur au minimum théorique`)
    );
  }
  for (const k of statKeys) {
    if (statPoints[k] < 0) {
      findings.push(
        mkFinding(
          char,
          'critical',
          'stats',
          `base.${k} (${char.base[k]}) inférieur au minimum théorique`
        )
      );
    }
    if (!Number.isInteger(statPoints[k])) {
      findings.push(
        mkFinding(char, 'medium', 'stats', `base.${k} non entier après déduction des bonus`)
      );
    }
  }

  // Plafonds de la routine genStats() (hp ≤ 200, autres ≤ 35 avant bonus).
  if ((char.base.hp ?? 0) - raceBonus.hp - classBonus.hp > BASE_HP_MAX_BEFORE_BONUS) {
    findings.push(
      mkFinding(
        char,
        'high',
        'stats',
        `base.hp ${char.base.hp} dépasse le plafond de création ${BASE_HP_MAX_BEFORE_BONUS}`,
        { baseHp: char.base.hp }
      )
    );
  }
  for (const k of statKeys) {
    const rawK = (char.base[k] ?? 0) - raceBonus[k] - classBonus[k];
    if (rawK > BASE_STAT_MAX_BEFORE_BONUS) {
      findings.push(
        mkFinding(
          char,
          'high',
          'stats',
          `base.${k} ${char.base[k]} dépasse le plafond de création ${BASE_STAT_MAX_BEFORE_BONUS}`,
          { raw: rawK }
        )
      );
    }
  }

  // Somme totale de points distribués.
  if (totalPoints > BASE_POINTS_HARD_LIMIT) {
    findings.push(
      mkFinding(
        char,
        'critical',
        'stats',
        `Total points distribués à la création: ${totalPoints} (max théorique: ~35, limite dure: ${BASE_POINTS_HARD_LIMIT})`,
        { hpPoints, statPoints, totalPoints }
      )
    );
  } else if (totalPoints > BASE_POINTS_SOFT_LIMIT) {
    findings.push(
      mkFinding(
        char,
        'high',
        'stats',
        `Total points distribués à la création: ${totalPoints} (au-delà du seuil normal de ~35)`,
        { hpPoints, statPoints, totalPoints }
      )
    );
  }
}

/** Niveau borné. */
function checkLevel(char, findings) {
  const lvl = Number(char.level ?? 1);
  if (!Number.isFinite(lvl) || lvl < 1) {
    findings.push(mkFinding(char, 'high', 'level', `Niveau invalide: ${char.level}`));
    return;
  }
  if (lvl > MAX_LEVEL) {
    const sev = lvl > MAX_LEVEL + 100 ? 'critical' : 'high';
    findings.push(
      mkFinding(char, sev, 'level', `Niveau ${lvl} dépasse le cap ${MAX_LEVEL}`, { level: lvl })
    );
  }
}

/** Boosts de la forêt : entiers, HP multiple de 6, total plausible. */
function checkForestBoosts(char, findings) {
  if (!char.forestBoosts) return;
  const fb = char.forestBoosts;
  const hpPerPoint = getStatPointValue('hp');

  const hpRaw = fb.hp ?? 0;
  if (hpRaw < 0) {
    findings.push(mkFinding(char, 'critical', 'forest', `forestBoosts.hp négatif: ${hpRaw}`));
  }
  if (hpRaw % hpPerPoint !== 0) {
    findings.push(
      mkFinding(char, 'high', 'forest', `forestBoosts.hp ${hpRaw} non multiple de ${hpPerPoint}`)
    );
  }

  let totalPts = hpRaw / hpPerPoint;
  for (const k of ['auto', 'def', 'cap', 'rescap', 'spd']) {
    const v = fb[k] ?? 0;
    if (v < 0) {
      findings.push(
        mkFinding(char, 'critical', 'forest', `forestBoosts.${k} négatif: ${v}`)
      );
    }
    if (!Number.isInteger(v)) {
      findings.push(mkFinding(char, 'medium', 'forest', `forestBoosts.${k} non entier: ${v}`));
    }
    totalPts += v;
  }

  if (totalPts > FOREST_POINTS_WARN) {
    findings.push(
      mkFinding(
        char,
        'medium',
        'forest',
        `Total points forêt très élevé: ${totalPts} (seuil d'alerte: ${FOREST_POINTS_WARN})`,
        { totalPts, forestBoosts: fb }
      )
    );
  }
}

/** Équipement (armes, passifs tour du mage, sous-classe, forge). */
function checkEquipment(char, dungeonProgress, findings) {
  const completions = dungeonProgress?.dungeonCompletions || {};

  if (char.equippedWeaponId) {
    if (!getWeaponById(char.equippedWeaponId)) {
      findings.push(
        mkFinding(
          char,
          'high',
          'equipment',
          `Arme équipée inconnue: "${char.equippedWeaponId}"`
        )
      );
    } else if (dungeonProgress && !dungeonProgress.bestRun && !dungeonProgress.totalRuns) {
      findings.push(
        mkFinding(
          char,
          'medium',
          'equipment',
          `Arme équipée "${char.equippedWeaponId}" mais aucun run de donjon (bestRun=0, totalRuns=0)`
        )
      );
    }
  }

  if (char.mageTowerPassive) {
    const id = typeof char.mageTowerPassive === 'string'
      ? char.mageTowerPassive
      : char.mageTowerPassive.id;
    const found = id && MAGE_TOWER_PASSIVES.some((p) => p.id === id);
    if (!found) {
      findings.push(
        mkFinding(char, 'high', 'equipment', `Passif Tour du Mage inconnu: "${id}"`)
      );
    }
    if (!completions.mageTower) {
      findings.push(
        mkFinding(
          char,
          'medium',
          'equipment',
          'Passif Tour du Mage défini sans completion dungeonProgress.dungeonCompletions.mageTower'
        )
      );
    }
  }

  if (char.mageTowerExtensionPassive) {
    const ext = char.mageTowerExtensionPassive;
    if (typeof ext !== 'object' || !ext.id) {
      findings.push(
        mkFinding(char, 'medium', 'equipment', 'mageTowerExtensionPassive sans id valide', { ext })
      );
    } else {
      const found = MAGE_TOWER_PASSIVES.some((p) => p.id === ext.id);
      if (!found) {
        findings.push(
          mkFinding(char, 'high', 'equipment', `Passif Extension inconnu: "${ext.id}"`)
        );
      }
    }
    if (!completions.extension && !completions.mageTowerExtension) {
      findings.push(
        mkFinding(
          char,
          'low',
          'equipment',
          'Passif Extension défini sans completion Extension enregistrée'
        )
      );
    }
  }

  if (char.subclass) {
    const sc = char.subclass;
    const className = char.class || '';
    const validForClass = (SUBCLASSES_BY_CLASS[className] || []).some(
      (s) => s.id === sc.id
    );
    if (!validForClass) {
      findings.push(
        mkFinding(
          char,
          'high',
          'equipment',
          `Sous-classe "${sc.id}" incompatible avec la classe "${className}"`
        )
      );
    }
  }

  if (char.forgeUpgrade) {
    const fuWeapon = char.forgeUpgrade.weaponId;
    if (fuWeapon && char.equippedWeaponId && fuWeapon !== char.equippedWeaponId) {
      findings.push(
        mkFinding(
          char,
          'low',
          'equipment',
          `forgeUpgrade.weaponId (${fuWeapon}) ≠ equippedWeaponId (${char.equippedWeaponId})`
        )
      );
    }
  }
}

/** Titres et bordures cohérents avec les définitions. */
function checkCosmetics(char, findings) {
  const earned = char.earnedTitles || [];
  for (const id of earned) {
    if (!TITLES[id]) {
      findings.push(
        mkFinding(char, 'low', 'cosmetics', `Titre inconnu dans earnedTitles: "${id}"`)
      );
    }
  }
  if (char.equippedTitle && !earned.includes(char.equippedTitle)) {
    findings.push(
      mkFinding(
        char,
        'medium',
        'cosmetics',
        `equippedTitle "${char.equippedTitle}" absent de earnedTitles`
      )
    );
  }

  const unlocked = char.unlockedBorders || [];
  for (const id of unlocked) {
    if (!BORDERS[id]) {
      findings.push(
        mkFinding(char, 'low', 'cosmetics', `Bordure inconnue dans unlockedBorders: "${id}"`)
      );
    }
  }
  if (char.equippedBorder && char.equippedBorder !== 'default' && !unlocked.includes(char.equippedBorder)) {
    findings.push(
      mkFinding(
        char,
        'medium',
        'cosmetics',
        `equippedBorder "${char.equippedBorder}" absent de unlockedBorders`
      )
    );
  }
}

/** Stats finales (base + forêt) aberrantes. */
function checkFinalStats(char, findings) {
  const base = char.base || {};
  const fb = char.forestBoosts || {};
  const hp = (base.hp ?? 0) + (fb.hp ?? 0);
  const final = {
    hp,
    auto: (base.auto ?? 0) + (fb.auto ?? 0),
    def: (base.def ?? 0) + (fb.def ?? 0),
    cap: (base.cap ?? 0) + (fb.cap ?? 0),
    rescap: (base.rescap ?? 0) + (fb.rescap ?? 0),
    spd: (base.spd ?? 0) + (fb.spd ?? 0),
  };

  if (final.hp > FINAL_HP_SUSPICIOUS) {
    findings.push(
      mkFinding(
        char,
        'medium',
        'stats',
        `PV finaux très élevés: ${final.hp} (seuil: ${FINAL_HP_SUSPICIOUS})`,
        { final }
      )
    );
  }
  for (const k of ['auto', 'def', 'cap', 'rescap', 'spd']) {
    if (final[k] > FINAL_STAT_SUSPICIOUS) {
      findings.push(
        mkFinding(
          char,
          'medium',
          'stats',
          `${k.toUpperCase()} final très élevé: ${final[k]} (seuil: ${FINAL_STAT_SUSPICIOUS})`,
          { final }
        )
      );
    }
  }
}

/** Entrées PvP aberrantes pour un personnage. */
function checkPvpEntries(char, pvpEntries, findings) {
  const charId = char.id || char.userId;
  const related = pvpEntries.filter(
    (e) => e.ownerUserId === charId || e.characterId === charId
  );
  for (const e of related) {
    const wins = Number(e.wins) || 0;
    const losses = Number(e.losses) || 0;
    if (wins > PVP_WINS_WARN) {
      findings.push(
        mkFinding(
          char,
          'medium',
          'pvp',
          `PvP wins élevés: ${wins} (entry ${e.id})`,
          { entryId: e.id, wins, losses }
        )
      );
    }
    if (wins >= PVP_WINS_NO_LOSS_WARN && losses === 0) {
      findings.push(
        mkFinding(
          char,
          'high',
          'pvp',
          `PvP wins=${wins} sans aucune défaite (entry ${e.id})`,
          { entryId: e.id, wins, losses }
        )
      );
    }
  }
}

/** Dégâts Cataclysme aberrants. */
function checkCataclysmeDamage(char, damageEntries, findings) {
  const charId = char.id || char.userId;
  const own = damageEntries.filter(
    (d) => d.characterId === charId || d.userId === charId
  );
  for (const d of own) {
    const dmg = Number(d.totalDamage ?? d.damage ?? 0) || 0;
    if (dmg > CATACLYSME_DAMAGE_WARN) {
      findings.push(
        mkFinding(
          char,
          'medium',
          'cataclysme',
          `Dégâts Cataclysme élevés: ${dmg.toLocaleString('fr-FR')}`,
          { damage: dmg }
        )
      );
    }
  }
}

// =====================================================================
// Pipeline principal
// =====================================================================

/**
 * Exécute l'audit complet et retourne un rapport trié par gravité.
 *
 * @returns {Promise<{ success: boolean, report?: { summary: Object, findings: Finding[], suspects: any[] }, error?: string }>}
 */
export async function runCheatAudit() {
  try {
    await waitForFirestore();

    const charactersRes = await getAllCharacters();
    if (!charactersRes.success) {
      return { success: false, error: charactersRes.error };
    }

    const allCharacters = (charactersRes.data || []).filter((c) => !c.disabled);

    const [dungeonSnap, pvpSnap, worldBossDamages] = await Promise.all([
      getDocs(collection(db, 'dungeonProgress')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'pvpDuelLeaderboardEntries')).catch(() => ({ docs: [] })),
      (async () => {
        try {
          const snap = await getDocs(collectionGroup(db, 'damages'));
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch {
          return [];
        }
      })(),
    ]);

    const dungeonByUser = {};
    (dungeonSnap.docs || []).forEach((d) => {
      dungeonByUser[d.id] = d.data();
    });

    const pvpEntries = (pvpSnap.docs || []).map((d) => ({ id: d.id, ...d.data() }));

    // Audit de chaque perso.
    const findings = [];
    for (const char of allCharacters) {
      const dp = dungeonByUser[char.id];
      checkIdentity(char, findings);
      checkBaseStats(char, findings);
      checkLevel(char, findings);
      checkForestBoosts(char, findings);
      checkEquipment(char, dp, findings);
      checkCosmetics(char, findings);
      checkFinalStats(char, findings);
      checkPvpEntries(char, pvpEntries, findings);
      checkCataclysmeDamage(char, worldBossDamages, findings);
    }

    // Trier par gravité puis par nom de perso.
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

    // Suspects triés par sévérité (critical > high > medium > low).
    const suspects = Array.from(byUser.values()).sort((a, b) => {
      const scoreA =
        a.counts.critical * 1000 +
        a.counts.high * 100 +
        a.counts.medium * 10 +
        a.counts.low;
      const scoreB =
        b.counts.critical * 1000 +
        b.counts.high * 100 +
        b.counts.medium * 10 +
        b.counts.low;
      return scoreB - scoreA;
    });

    const summary = {
      totalCharacters: allCharacters.length,
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
      report: { summary, findings, suspects },
    };
  } catch (error) {
    console.error('runCheatAudit error:', error);
    return { success: false, error: error?.message || String(error) };
  }
}

/** Libellés affichables pour la sévérité. */
export const SEVERITY_LABELS = {
  critical: { label: 'Critique', color: 'text-red-400', bg: 'bg-red-900/40', border: 'border-red-500' },
  high: { label: 'Élevé', color: 'text-orange-300', bg: 'bg-orange-900/30', border: 'border-orange-500' },
  medium: { label: 'Moyen', color: 'text-amber-300', bg: 'bg-amber-900/30', border: 'border-amber-500' },
  low: { label: 'Faible', color: 'text-stone-300', bg: 'bg-stone-800/60', border: 'border-stone-600' },
  info: { label: 'Info', color: 'text-sky-300', bg: 'bg-sky-900/30', border: 'border-sky-500' },
};

export const CATEGORY_LABELS = {
  identity: 'Identité',
  stats: 'Stats',
  level: 'Niveau',
  forest: 'Forêt',
  equipment: 'Équipement',
  cosmetics: 'Cosmétiques',
  pvp: 'PvP',
  cataclysme: 'Cataclysme',
};

// Export utilitaire (debug) : nombre de références weapons/passifs/etc.
export const AUDIT_CONTEXT = {
  weaponsCount: Object.keys(weapons).length,
  passivesCount: MAGE_TOWER_PASSIVES.length,
  titlesCount: Object.keys(TITLES).length,
  bordersCount: Object.keys(BORDERS).length,
};
