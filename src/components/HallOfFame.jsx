import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { getHallOfFame } from '../services/tournamentService';
import UnifiedCharacterCard from './UnifiedCharacterCard';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { getFusedPassiveDisplayData } from '../data/extensionDungeon';
import SharedTooltip from './SharedTooltip';
import { races, classes } from '../data/gameData';
import { getAbilityDisplayLabel } from '../data/subclasses';

const FENETRE_DOUBLON_MS = 5 * 60 * 1000;

function normaliserCle(value) {
  return String(value || '').trim().toLowerCase();
}

function extraireTimestampMillis(valeur) {
  if (!valeur) return null;
  if (typeof valeur.toMillis === 'function') return valeur.toMillis();
  if (typeof valeur.toDate === 'function') return valeur.toDate().getTime();
  if (typeof valeur.seconds === 'number') {
    return (valeur.seconds * 1000) + Math.floor((valeur.nanoseconds || 0) / 1e6);
  }
  if (typeof valeur === 'number' && Number.isFinite(valeur)) return valeur;
  if (typeof valeur === 'string') {
    const parsed = Date.parse(valeur);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function extraireDateMillis(entry) {
  return extraireTimestampMillis(entry?.date);
}

function trouverMeilleureArchive(candidats, dateEntreeMs) {
  if (!Array.isArray(candidats) || candidats.length === 0) return null;
  if (candidats.length === 1) return candidats[0];

  // Sans date de référence, on prend la plus récente.
  if (dateEntreeMs === null) {
    return [...candidats]
      .sort((a, b) => (extraireTimestampMillis(b.archivedAt) || 0) - (extraireTimestampMillis(a.archivedAt) || 0))[0];
  }

  let meilleur = null;
  let meilleurEcart = Number.POSITIVE_INFINITY;

  for (const candidat of candidats) {
    const archivedAtMs = extraireTimestampMillis(candidat.archivedAt);
    if (archivedAtMs === null) continue;
    const ecart = Math.abs(archivedAtMs - dateEntreeMs);
    if (ecart < meilleurEcart) {
      meilleur = candidat;
      meilleurEcart = ecart;
    }
  }

  return meilleur || candidats[0];
}

function dedoublonnerEntreesHallOfFame(entries) {
  const uniques = [];
  const datesParSignature = new Map();
  const signaturesSansDate = new Set();

  for (const entry of entries) {
    const champion = entry?.champion || {};
    const signature = [
      normaliserCle(champion.userId || champion.ownerUserId),
      normaliserCle(champion.nom || champion.name),
      normaliserCle(champion.race),
      normaliserCle(champion.classe || champion.class),
      Number(entry?.nbParticipants || 0),
      Number(entry?.nbMatchs || 0),
    ].join('|');

    const dateMs = extraireDateMillis(entry);
    if (dateMs === null) {
      if (signaturesSansDate.has(signature)) continue;
      signaturesSansDate.add(signature);
      uniques.push(entry);
      continue;
    }

    const datesConnues = datesParSignature.get(signature) || [];
    const estDoublon = datesConnues.some((dateExistante) =>
      Math.abs(dateExistante - dateMs) <= FENETRE_DOUBLON_MS
    );

    if (estDoublon) continue;

    datesConnues.push(dateMs);
    datesParSignature.set(signature, datesConnues);
    uniques.push(entry);
  }

  return uniques;
}

const HallOfFame = () => {
  const [champions, setChampions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChampion, setSelectedChampion] = useState(null);
  const [fullChampionData, setFullChampionData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const result = await getHallOfFame();
      if (result.success) {
        // On garde les victoires multiples légitimes, mais on filtre les doublons
        // créés par un archivage répété du même tournoi.
        const entries = Array.isArray(result.data) ? result.data : [];
        setChampions(dedoublonnerEntreesHallOfFame(entries));
      }
      setLoading(false);
    };
    load();
  }, []);

  const loadFullChampionData = async (entry) => {
    const champion = entry?.champion || entry || {};
    try {
      // Chercher le personnage archivé complet avec tournamentChampion: true et userId correspondant
      const { db } = await import('../firebase/config');
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const championUserId = champion.userId || champion.ownerUserId || champion.id;

      if (!championUserId) {
        setFullChampionData(champion);
        setSelectedChampion(champion);
        return;
      }

      const archivedRef = collection(db, 'archivedCharacters');
      const q = query(
        archivedRef,
        where('userId', '==', championUserId),
        where('tournamentChampion', '==', true)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const archives = snapshot.docs.map((docSnap) => docSnap.data());
        const fullData = trouverMeilleureArchive(archives, extraireDateMillis(entry));
        setFullChampionData(fullData || champion);
      } else {
        // Pas de données complètes, on utilise ce qu'on a
        setFullChampionData(champion);
      }

      setSelectedChampion(champion);
    } catch (error) {
      console.error('Erreur chargement champion complet:', error);
      setFullChampionData(champion);
      setSelectedChampion(champion);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-3xl mx-auto pt-20">
        <div className="text-center mb-8">
          <div className="bg-stone-900/70 border-2 border-yellow-500 rounded-xl px-6 py-4 shadow-xl inline-block">
            <h1 className="text-4xl font-bold text-yellow-400">👑 Hall of Fame</h1>
            <p className="text-yellow-300 mt-1">Les grands champions des tournois</p>
          </div>
        </div>

        {champions.length === 0 ? (
          <div className="bg-stone-800/90 p-8 border-2 border-stone-600 rounded-xl text-center">
            <p className="text-stone-400 text-xl">Aucun champion pour le moment</p>
            <p className="text-stone-500 mt-2">Le premier tournoi n'a pas encore eu lieu</p>
          </div>
        ) : (
          <div className="space-y-4">
            {champions.map((entry, idx) => (
              <div
                key={entry.id}
                className={`bg-stone-800/90 border-2 ${idx === 0 ? 'border-yellow-500' : 'border-stone-600'} rounded-xl p-6 flex items-center gap-6`}
              >
                <div className="text-4xl">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🏆'}
                </div>
                {entry.champion?.characterImage && (
                  <img
                    src={entry.champion.characterImage}
                    alt={entry.champion.nom}
                    className="w-20 h-auto object-contain cursor-pointer hover:opacity-80 transition hover:scale-110"
                    onClick={() => loadFullChampionData(entry)}
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-yellow-300">{entry.champion?.nom || 'Inconnu'}</h3>
                  <p className="text-stone-400">
                    {entry.champion?.race} • {entry.champion?.classe}
                  </p>
                  {entry.champion?.ownerPseudo && (
                    <p className="text-cyan-300 text-sm">Joueur: {entry.champion.ownerPseudo}</p>
                  )}
                  <p className="text-stone-500 text-sm mt-1">
                    {entry.nbParticipants} participants • {entry.nbMatchs} matchs
                  </p>
                  {entry.date && (
                    <p className="text-stone-600 text-xs mt-1">
                      {entry.date.toDate?.().toLocaleDateString('fr-FR') || ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <button onClick={() => navigate('/')} className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg transition">
            ← Retour
          </button>
        </div>
      </div>

      {selectedChampion && fullChampionData && (() => {
        const weapon = fullChampionData.equippedWeaponId ? getWeaponById(fullChampionData.equippedWeaponId) : null;
        const fused = getFusedPassiveDisplayData(fullChampionData);
        const passive = fullChampionData.mageTowerPassive ? getMageTowerPassiveById(fullChampionData.mageTowerPassive.id) : null;
        const passiveLevel = passive && fullChampionData.mageTowerPassive ? getMageTowerPassiveLevel(fullChampionData.mageTowerPassive.id, fullChampionData.mageTowerPassive.level) : null;
        
        const formatWeaponStats = (w) => {
          if (!w?.stats) return null;
          return Object.entries(w.stats)
            .map(([stat, value]) => `${stat.toUpperCase()} ${value > 0 ? `+${value}` : value}`)
            .join(' • ');
        };

        return (
          <div
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={() => {
              setSelectedChampion(null);
              setFullChampionData(null);
            }}
          >
            <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <UnifiedCharacterCard
                header={`${fullChampionData.race} • ${fullChampionData.classe || fullChampionData.class} • Niveau ${fullChampionData.level ?? 1}`}
                name={fullChampionData.nom || fullChampionData.name}
                image={fullChampionData.characterImage}
                fallback={<span className="text-7xl">👑</span>}
                topStats={
                  <>
                    <span className="text-yellow-300 font-bold">HP: {fullChampionData.base?.hp || 0}</span>
                    <span className="text-yellow-300 font-bold">VIT: {fullChampionData.base?.spd || 0}</span>
                  </>
                }
                mainStats={
                  <>
                    <span className="text-stone-300 font-bold">Auto: {fullChampionData.base?.auto || 0}</span>
                    <span className="text-stone-300 font-bold">Déf: {fullChampionData.base?.def || 0}</span>
                    <span className="text-stone-300 font-bold">Cap: {fullChampionData.base?.cap || 0}</span>
                    <span className="text-stone-300 font-bold">ResC: {fullChampionData.base?.rescap || 0}</span>
                  </>
                }
                details={
                  <div className="space-y-2">
                    <div className="border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                      <div className="text-amber-200 font-semibold">🏆 Champion du Tournoi</div>
                      {fullChampionData.ownerPseudo && (
                        <div className="text-cyan-300 mt-1">Joueur: {fullChampionData.ownerPseudo}</div>
                      )}
                    </div>
                    
                    {weapon && (
                      <div className="border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{weapon.icon}</span>
                          <span className="flex flex-col items-start">
                            <WeaponNameWithForge weapon={weapon} forgeUpgrade={fullChampionData.forgeUpgrade} />
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400 space-y-1">
                          <div>{weapon.description}</div>
                          {weapon.effet && (
                            <div className="text-amber-200">
                              Effet: {weapon.effet.nom} — {weapon.effet.description}
                            </div>
                          )}
                          {weapon.stats && (
                            <div className="text-stone-200">
                              Stats: {formatWeaponStats(weapon)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {fused ? (
                      <div className="extension-territory-border extension-territory-glow overflow-visible">
                        <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300 extension-territory-shine">
                          <span className="text-lg">{fused.primaryDetails.icon}</span>
                          <div className="flex-1">
                            <SharedTooltip
                              content={
                                <span className="whitespace-normal block text-left max-w-[260px]">
                                  <span className="text-amber-300 font-semibold">{fused.primaryDetails.icon} {fused.primaryDetails.name}</span>
                                  <span className="text-stone-400"> — Niv.{fused.primaryDetails.level} (principal)</span>
                                  <br />
                                  <span className="text-violet-300 font-semibold">{fused.extensionDetails.icon} {fused.extensionDetails.name}</span>
                                  <span className="text-stone-400"> — Niv.{fused.extensionDetails.level} (extension)</span>
                                </span>
                              }
                            >
                              <div className="font-semibold extension-territory-text cursor-help">{fused.displayLabel}</div>
                            </SharedTooltip>
                            <div className="text-stone-400 text-[11px] mt-1 space-y-1">
                              <div><span className="text-amber-300/90">Niv.{fused.primaryDetails.level} —</span> {fused.primaryDetails.levelData.description}</div>
                              <div><span className="text-violet-300/90">Niv.{fused.extensionDetails.level} (Extension) —</span> {fused.extensionDetails.levelData.description}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : passive && (
                      <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                        <span className="text-lg">{passive.icon}</span>
                        <div className="flex-1">
                          <div className="font-semibold text-amber-200">
                            {passive.name} — Niveau {fullChampionData.mageTowerPassive.level}
                          </div>
                          {passiveLevel && (
                            <div className="text-stone-400 text-[11px] mt-1">
                              {passiveLevel.description}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {fullChampionData.forestBoosts && Object.values(fullChampionData.forestBoosts).some(v => v > 0) && (
                      <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                        <span className="text-lg">🌲</span>
                        <div className="flex-1">
                          <div className="font-semibold text-amber-200">Boosts Forêt</div>
                          <div className="text-green-300 text-[11px] mt-1">
                            {Object.entries(fullChampionData.forestBoosts)
                              .filter(([, v]) => v > 0)
                              .map(([stat, v]) => `${stat.toUpperCase()} +${v}`)
                              .join(' • ')}
                          </div>
                        </div>
                      </div>
                    )}

                    {classes[fullChampionData.classe || fullChampionData.class] && (
                      fullChampionData.subclass ? (
                        <div className="subclass-gold-border subclass-gold-glow overflow-visible">
                          <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300 subclass-gold-shine">
                            <span className="text-lg">{classes[fullChampionData.classe || fullChampionData.class].icon}</span>
                            <div className="flex-1">
                              <div className="font-semibold subclass-gold-text">{getAbilityDisplayLabel(fullChampionData.classe || fullChampionData.class, fullChampionData.subclass)}</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                          <span className="text-lg">{classes[fullChampionData.classe || fullChampionData.class].icon}</span>
                          <div className="flex-1">
                            <div className="font-semibold text-amber-200">{classes[fullChampionData.classe || fullChampionData.class].ability}</div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                }
                cardClassName="shadow-2xl border-2 border-yellow-500"
              />
              <button
                onClick={() => {
                  setSelectedChampion(null);
                  setFullChampionData(null);
                }}
                className="mt-4 w-full bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded-lg transition"
              >
                Fermer
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default HallOfFame;
