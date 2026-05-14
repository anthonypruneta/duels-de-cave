import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import Header from './Header';
import { db } from '../firebase/config';
import { getAllCharacters } from '../services/characterService';
import { getAllArchivedCharacters, getHallOfFame, LEGACY_TOURNAMENT_DOC_ID } from '../services/tournamentService';
import { getWeaponById } from '../data/weapons';
import { getMageTowerPassiveById } from '../data/mageTowerPassives';
import { computeCharacterStatsDisplay } from '../hooks/useCharacterStatsDisplay';
import { getEmptyStatBoosts } from '../utils/statPoints';
import { extractForgeUpgrade, hasAnyForgeUpgrade } from '../data/forgeDungeon';
import { clampLevel, MAX_LEVEL } from '../data/featureFlags';

const STAT_KEYS = [
  ['hp', 'PV'],
  ['auto', 'Auto'],
  ['def', 'DEF'],
  ['cap', 'CAP'],
  ['rescap', 'ResC'],
  ['spd', 'VIT'],
];

function normaliserCle(v) {
  return String(v || '').trim().toLowerCase();
}

function tsMs(v) {
  if (!v) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function isLegacyHoFEntry(entry) {
  return (
    entry.sourceTournamentType === 'legacy_archives'
    || entry.sourceTournamentId === 'legacy_current'
    || String(entry.sourceTournamentId || '').startsWith('legacy_')
  );
}

function enrichWeapon(char) {
  const copy = { ...char };
  if (copy.equippedWeaponId && !copy.equippedWeaponData) {
    copy.equippedWeaponData = getWeaponById(copy.equippedWeaponId);
  }
  return copy;
}

function formatForestBoosts(fb) {
  const merged = { ...getEmptyStatBoosts(), ...(fb || {}) };
  const labels = { hp: 'PV', auto: 'Auto', def: 'DEF', cap: 'CAP', rescap: 'ResC', spd: 'VIT' };
  const parts = Object.keys(labels)
    .filter((k) => Number(merged[k]) > 0)
    .map((k) => `+${merged[k]} ${labels[k]}`);
  return parts.length ? parts.join(', ') : '—';
}

function formatForgeShort(forgeUpgrade) {
  if (!hasAnyForgeUpgrade(forgeUpgrade)) return '—';
  const { bonuses, penalties } = extractForgeUpgrade(forgeUpgrade);
  const bits = [];
  Object.entries(bonuses).forEach(([k, v]) => {
    if (v) bits.push(`${k} +${Math.round(Number(v) * 100)}%`);
  });
  Object.entries(penalties).forEach(([k, v]) => {
    if (v) bits.push(`${k} ${Math.round(Number(v) * 100)}%`);
  });
  return bits.length ? bits.join(' · ') : '—';
}

function passiveLine(ref) {
  if (!ref?.id) return '—';
  const def = getMageTowerPassiveById(ref.id);
  const nom = def?.name || ref.id;
  const lv = ref.level != null ? ` nv.${ref.level}` : '';
  return `${nom}${lv}`;
}

function buildExpandedHoFEntries(hallRows, legacyRetiredRows) {
  const out = [];

  for (const e of hallRows || []) {
    out.push(e);
  }

  for (const row of legacyRetiredRows || []) {
    const uid = row.ownerUserId;
    const nom = row.nom || row.name;
    if (!uid || !nom) continue;
    out.push({
      id: `synth-legacy-retired-${row.id}`,
      champion: { userId: uid, nom, name: nom },
      date: row.retiredAt || null,
      sourceTournamentType: 'legacy_archives',
      sourceTournamentId: LEGACY_TOURNAMENT_DOC_ID,
    });
  }

  return out;
}

/**
 * @param {object} char — fiche Firestore (actif, désactivé ou archivé)
 * @param {object[]} expandedHoF
 */
function resolveChampionFlags(char, expandedHoF) {
  const ownerUserId = char.userId || char.id;
  const nameKey = normaliserCle(char.name || char.nom);
  const archivedMs = tsMs(char.archivedAt);
  const fromArchiveCollection = Boolean(char._listingSource === 'archive');

  const flags = {
    tournoiSamediFiche: char.tournamentChampion === true,
    hallSamedi: false,
    hallAnciens: false,
  };

  for (const entry of expandedHoF) {
    const ch = entry.champion || entry;
    const uid = ch.userId || ch.ownerUserId;
    if (!uid || uid !== ownerUserId) continue;

    const nameCh = normaliserCle(ch.nom || ch.name);
    if (nameKey && nameCh && nameKey !== nameCh) continue;
    if (!nameKey && !nameCh) continue;

    const entryMs = tsMs(entry.date);
    const legacy = isLegacyHoFEntry(entry);

    if (archivedMs != null && entryMs != null) {
      if (Math.abs(archivedMs - entryMs) > 21 * 86400000) continue;
    } else if (archivedMs != null && entryMs == null) {
      if (!nameKey || !nameCh || nameKey !== nameCh) continue;
    } else if (fromArchiveCollection && archivedMs == null) {
      continue;
    } else if (!fromArchiveCollection) {
      // Perso encore dans `characters` : éviter d'attribuer un titre gagné par une fiche archivée
      // à un nouveau perso du même compte (sans correspondance de nom stricte).
      if (!nameKey || !nameCh || nameKey !== nameCh) continue;
    }

    if (legacy) flags.hallAnciens = true;
    else flags.hallSamedi = true;
  }

  return flags;
}

function buildRows(actifs, archives) {
  const rows = [];

  for (const c of actifs || []) {
    const isArchiveSlot = false;
    let source = 'actif';
    if (c.disabled) source = 'désactivé';
    rows.push({
      ...c,
      _rowKey: `live-${c.id}`,
      _listingSource: 'live',
      _sourceLabel: source,
      _isArchive: isArchiveSlot,
    });
  }

  for (const c of archives || []) {
    rows.push({
      ...c,
      _rowKey: `arch-${c.id}`,
      _listingSource: 'archive',
      _sourceLabel: 'archivé',
      _isArchive: true,
    });
  }

  return rows;
}

function AdminCharacterDirectory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterText, setFilterText] = useState('');
  const [sourceFilter, setSourceFilter] = useState('tous'); // tous | actif | archivé
  const [rows, setRows] = useState([]);
  const [expandedHoF, setExpandedHoF] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [charsRes, archRes, hofRes, legacySnap] = await Promise.all([
        getAllCharacters(),
        getAllArchivedCharacters(),
        getHallOfFame(),
        getDocs(collection(db, 'legacyRetiredArchives')),
      ]);

      if (!charsRes.success) throw new Error(charsRes.error || 'Personnages actifs');
      if (!archRes.success) throw new Error(archRes.error || 'Archives');
      if (!hofRes.success) throw new Error(hofRes.error || 'Hall of Fame');

      const legacyRows = legacySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const hofCombined = buildExpandedHoFEntries(hofRes.data || [], legacyRows);
      setExpandedHoF(hofCombined);

      setRows(buildRows(charsRes.data || [], archRes.data || []));
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Chargement impossible');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = normaliserCle(filterText);
    let list = rows;

    if (sourceFilter === 'actif') {
      list = list.filter((r) => r._listingSource === 'live' && !r.disabled);
    } else if (sourceFilter === 'desactive') {
      list = list.filter((r) => r._listingSource === 'live' && r.disabled);
    } else if (sourceFilter === 'archive') {
      list = list.filter((r) => r._listingSource === 'archive');
    }

    if (!q) {
      return [...list].sort((a, b) => {
        const la = clampLevel(a.level ?? 1);
        const lb = clampLevel(b.level ?? 1);
        if (lb !== la) return lb - la;
        return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
      });
    }

    return list
      .filter((r) => {
        const blob = [
          r.name,
          r.nom,
          r.userId,
          r.id,
          r.race,
          r.class,
          r.ownerPseudo,
          r.equippedWeaponId,
          r.equippedWeaponData?.nom,
        ]
          .map((x) => normaliserCle(x))
          .join(' ');
        return blob.includes(q);
      })
      .sort((a, b) => {
        const la = clampLevel(a.level ?? 1);
        const lb = clampLevel(b.level ?? 1);
        if (lb !== la) return lb - la;
        return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
      });
  }, [rows, filterText, sourceFilter]);

  const prepared = useMemo(() => {
    return filtered.map((raw) => {
      const char = enrichWeapon(raw);
      const display = computeCharacterStatsDisplay(char);
      const champs = resolveChampionFlags(char, expandedHoF);
      const level = clampLevel(char.level ?? 1);
      const ext = char.mageTowerExtensionPassive;
      const extDef = ext?.id ? getMageTowerPassiveById(ext.id) : null;
      const bordersBits = [];
      if (char.equippedBorder) bordersBits.push(`équipée: ${char.equippedBorder}`);
      const unlocked = Array.isArray(char.unlockedBorders) ? char.unlockedBorders.length : 0;
      if (unlocked) bordersBits.push(`débloquées: ${unlocked}`);

      return {
        raw: char,
        rowKey: char._rowKey,
        display,
        champs,
        level,
        statsLine: STAT_KEYS.map(([k, lab]) => `${lab} ${display.finalStats?.[k] ?? '—'}`).join(' · '),
        weaponName: char.equippedWeaponData?.nom || char.equippedWeaponId || '—',
        forgeLine: formatForgeShort(char.forgeUpgrade),
        extensionLine: ext ? `${extDef?.name || ext.id}${ext.level != null ? ` nv.${ext.level}` : ''}` : '—',
        fusedLine: display.fusedPassiveDisplay?.name || '—',
        pointeau: char.coopRaceEcho?.race ? `Race echo: ${char.coopRaceEcho.race}` : '—',
        gojoUnlock: extDef && Number(ext?.level) >= 3,
        ornnUnlock: hasAnyForgeUpgrade(char.forgeUpgrade),
        bordersLine: bordersBits.length ? bordersBits.join(' · ') : '—',
      };
    });
  }, [filtered, expandedHoF]);

  return (
    <div className="min-h-screen p-4 md:p-6 pb-24">
      <Header />
      <div className="max-w-[1800px] mx-auto pt-16 md:pt-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-amber-400">📋 Annuaire personnages (admin)</h1>
            <p className="text-stone-400 text-sm mt-1">
              Actifs, désactivés et archives tournoi — niveau plafonné affiché à {MAX_LEVEL} — stats finales (forêt, arme,
              passifs, forge, sous-classe, pointeau) — statut champions (samedi / anciens).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="px-4 py-2 rounded-lg border border-stone-600 bg-stone-800 text-stone-200 text-sm font-bold hover:border-amber-500"
            >
              ← Backoffice
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-amber-500 bg-amber-700/80 text-white text-sm font-bold disabled:opacity-50"
            >
              {loading ? 'Chargement…' : 'Rafraîchir'}
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 mb-6">
          <input
            type="search"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtrer (nom, userId, race, classe, arme…)"
            className="flex-1 bg-stone-900 border border-stone-600 rounded-lg px-3 py-2 text-sm text-white"
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-stone-900 border border-stone-600 rounded-lg px-3 py-2 text-sm text-white lg:w-56"
          >
            <option value="tous">Toutes les fiches</option>
            <option value="actif">Actifs seulement</option>
            <option value="desactive">Désactivés (copies)</option>
            <option value="archive">Archives tournoi</option>
          </select>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-500 bg-red-900/30 text-red-200 text-sm">{error}</div>
        )}

        {loading && !prepared.length ? (
          <div className="text-amber-400 text-xl py-12 text-center">Chargement des fiches…</div>
        ) : (
          <p className="text-stone-500 text-sm mb-4">
            {prepared.length} fiche{prepared.length > 1 ? 's' : ''} affichée{prepared.length > 1 ? 's' : ''}
            {expandedHoF.length ? ` · ${expandedHoF.length} entrées HoF / legacy (champions)` : ''}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {prepared.map((p) => {
            const c = p.raw;
            const img = c.characterImage;
            const titre = c.equippedTitle || (Array.isArray(c.earnedTitles) && c.earnedTitles[0]) || null;

            const badges = [];
            if (p.champs.tournoiSamediFiche) badges.push({ t: '🏆 Tournoi samedi (fiche)', cls: 'bg-yellow-700/50 border-yellow-500 text-yellow-100' });
            if (p.champs.hallSamedi) badges.push({ t: '👑 HoF — samedi', cls: 'bg-amber-800/50 border-amber-400 text-amber-100' });
            if (p.champs.hallAnciens) badges.push({ t: '👑 HoF — anciens', cls: 'bg-violet-900/50 border-violet-400 text-violet-100' });

            return (
              <article
                key={p.rowKey}
                className="rounded-xl border border-stone-600 bg-stone-900/80 p-4 text-sm text-stone-200 shadow-lg"
              >
                <div className="flex gap-3">
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="w-14 h-14 md:w-16 md:h-16 rounded-lg object-cover border border-stone-600 flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg bg-stone-800 border border-stone-700 flex-shrink-0 text-[10px] text-stone-500 flex items-center justify-center text-center px-1">
                      sans image
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-amber-200 truncate">{c.name || c.nom || 'Sans nom'}</div>
                    <div className="text-xs text-stone-400 truncate">
                      {c.race} · {c.class}
                      {c.subclass?.id ? ` · SC: ${c.subclass.id}` : ''}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      Nv. <span className="text-amber-300 font-mono">{p.level}</span>
                      <span className="mx-1.5 text-stone-600">|</span>
                      <span className="uppercase text-[10px] tracking-wide">{c._sourceLabel}</span>
                    </div>
                  </div>
                </div>

                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {badges.map((b) => (
                      <span key={b.t} className={`text-[10px] font-bold px-2 py-0.5 rounded border ${b.cls}`}>
                        {b.t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 space-y-1.5 text-xs">
                  <div>
                    <span className="text-stone-500">Stats finales :</span>{' '}
                    <span className="text-stone-200 font-mono text-[11px]">{p.statsLine}</span>
                  </div>
                  <div>
                    <span className="text-stone-500">Forêt :</span> {formatForestBoosts(c.forestBoosts)}
                  </div>
                  <div>
                    <span className="text-stone-500">Arme :</span> {p.weaponName}
                    {c.equippedWeaponData?.rarete ? (
                      <span className="text-stone-500"> ({c.equippedWeaponData.rarete})</span>
                    ) : null}
                  </div>
                  <div>
                    <span className="text-stone-500">Passif tour :</span> {passiveLine(c.mageTowerPassive)}
                  </div>
                  <div>
                    <span className="text-stone-500">Extension (Gojo) :</span> {p.extensionLine}
                  </div>
                  <div>
                    <span className="text-stone-500">Passif fusionné :</span>{' '}
                    <span className={p.fusedLine !== '—' ? 'text-cyan-300' : ''}>{p.fusedLine}</span>
                  </div>
                  <div>
                    <span className="text-stone-500">Forge (Ornn) :</span> {p.forgeLine}
                  </div>
                  <div>
                    <span className="text-stone-500">Pointeau ADN :</span> {p.pointeau}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Débloquages : Gojo (passif ext. ≥3){' '}
                    <span className={p.gojoUnlock ? 'text-emerald-400' : 'text-stone-600'}>{p.gojoUnlock ? 'oui' : 'non'}</span>
                    {' · '}
                    Forge (roll présent){' '}
                    <span className={p.ornnUnlock ? 'text-emerald-400' : 'text-stone-600'}>{p.ornnUnlock ? 'oui' : 'non'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500">Bordures :</span> {p.bordersLine}
                  </div>
                  {titre ? (
                    <div>
                      <span className="text-stone-500">Titre :</span> {titre}
                    </div>
                  ) : null}
                  <div className="text-[11px] text-stone-500 break-all pt-1 border-t border-stone-700/80 mt-2">
                    <span className="text-stone-500">userId :</span> {c.userId || c.id}
                    {c.characterInstanceId ? (
                      <>
                        <br />
                        <span className="text-stone-500">instance :</span> {c.characterInstanceId}
                      </>
                    ) : null}
                    {c._listingSource === 'archive' ? (
                      <>
                        <br />
                        <span className="text-stone-500">doc archivé :</span> {c.id}
                      </>
                    ) : (
                      <>
                        <br />
                        <span className="text-stone-500">doc Firestore :</span> {c.id}
                      </>
                    )}
                  </div>
                  {c.pvpDuelStats && (c.pvpDuelStats.wins > 0 || c.pvpDuelStats.losses > 0) ? (
                    <div className="text-[11px]">
                      <span className="text-stone-500">PvP lobby :</span>{' '}
                      <span className="text-emerald-400">{c.pvpDuelStats.wins ?? 0}V</span> /{' '}
                      <span className="text-rose-400">{c.pvpDuelStats.losses ?? 0}D</span>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default AdminCharacterDirectory;
