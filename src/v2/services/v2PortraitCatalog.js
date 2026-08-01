/**
 * Catalogue de portraits V2 — images Firebase (Firestore) classées par race / classe.
 * Source : mêmes pools que l’annuaire admin (characters + archivedCharacters).
 */

import { hasCharacterImage } from '../../data/caveDestiny';
import { getAllCharacters } from '../../services/characterService';
import { getAllArchivedCharacters } from '../../services/tournamentService';

function normKey(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function portraitKey(entry) {
  return `${entry.sourceId}::${normKey(entry.name)}::${entry.characterImage}`;
}

/**
 * Charge actifs + archives, ne garde que les persos avec URL https d’image.
 */
export async function loadV2PortraitsFromFirestore() {
  try {
    const [liveRes, archivedRes] = await Promise.all([
      getAllCharacters(),
      getAllArchivedCharacters(),
    ]);

    if (!liveRes?.success) {
      return { success: false, error: liveRes?.error || 'Lecture characters impossible' };
    }
    if (!archivedRes?.success) {
      return { success: false, error: archivedRes?.error || 'Lecture archives impossible' };
    }

    const live = liveRes.data || [];
    const archived = archivedRes.data || [];
    const map = new Map();

    const ingest = (raw, fromArchive) => {
      if (!raw || raw.disabled) return;
      if (!hasCharacterImage(raw)) return;
      const race = String(raw.race || '').trim();
      const classe = String(raw.class || '').trim();
      const name = String(raw.name || raw.nom || '').trim();
      if (!race || !classe || !name) return;

      const sourceId = String(raw.id || raw.userId || raw.originalUserId || '');
      const entry = {
        id: `${fromArchive ? 'arch' : 'live'}_${sourceId || name}`,
        sourceId: sourceId || name,
        name,
        race,
        class: classe,
        characterImage: String(raw.characterImage).trim(),
        fromArchive: !!fromArchive,
      };

      const key = portraitKey(entry);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, entry);
        return;
      }
      if (!fromArchive && prev.fromArchive) {
        map.set(key, entry);
      }
    };

    archived.forEach((c) => ingest(c, true));
    live.forEach((c) => ingest(c, false));

    const portraits = Array.from(map.values()).sort((a, b) => {
      const r = a.race.localeCompare(b.race, 'fr');
      if (r !== 0) return r;
      const cl = a.class.localeCompare(b.class, 'fr');
      if (cl !== 0) return cl;
      return a.name.localeCompare(b.name, 'fr');
    });

    return { success: true, portraits };
  } catch (error) {
    console.error('V2 loadV2PortraitsFromFirestore:', error);
    return { success: false, error: error.message || 'Erreur chargement portraits' };
  }
}

/** Structure dossiers : race → classe → portraits[] */
export function groupPortraitsByRaceClass(portraits) {
  const tree = {};
  for (const p of portraits || []) {
    if (!tree[p.race]) tree[p.race] = {};
    if (!tree[p.race][p.class]) tree[p.race][p.class] = [];
    tree[p.race][p.class].push(p);
  }
  return tree;
}

export function getPortraitsForRaceClass(portraits, race, classe) {
  const r = String(race || '').trim();
  const c = String(classe || '').trim();
  return (portraits || []).filter((p) => p.race === r && p.class === c);
}

export function pickPortraitForKit(portraits, race, classe, rng = Math.random) {
  const exact = getPortraitsForRaceClass(portraits, race, classe);
  const raceOnly = (portraits || []).filter((p) => p.race === String(race || '').trim());
  const pool = exact.length ? exact : raceOnly.length ? raceOnly : portraits || [];
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

export function isLocalV2PlaceholderImage(url) {
  if (!url || typeof url !== 'string') return true;
  const u = url.trim();
  if (!u) return true;
  if (u.startsWith('/assets/v2/')) return true;
  if (!/^https?:\/\//i.test(u)) return true;
  return false;
}
