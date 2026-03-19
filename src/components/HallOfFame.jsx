import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { getHallOfFame } from '../services/tournamentService';
import { getWeaponById } from '../data/weapons';

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
      normaliserCle(entry.sourceTournamentType),
      normaliserCle(entry.sourceTournamentId),
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

async function loadFullChampionForEntry(entry) {
  const champion = entry?.champion || entry || {};
  const championUserId = champion.userId || champion.ownerUserId || champion.id;

  if (!championUserId) return { entry, fullData: champion };

  try {
    const { db } = await import('../firebase/config');
    const { collection, query, where, getDocs } = await import('firebase/firestore');

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
      return { entry, fullData: fullData || champion };
    }
  } catch (error) {
    console.error('Erreur chargement champion complet:', error);
  }

  return { entry, fullData: champion };
}

const HallOfFame = () => {
  const [champions, setChampions] = useState([]);
  const [activeTab, setActiveTab] = useState('samedi'); // 'samedi' | 'anciens'
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const result = await getHallOfFame();
      if (result.success) {
        const entries = Array.isArray(result.data) ? result.data : [];
        const deduped = dedoublonnerEntreesHallOfFame(entries);

        const loaded = await Promise.all(deduped.map(loadFullChampionForEntry));

        const enriched = loaded.map(({ entry, fullData }) => {
          const char = { ...fullData };
          if (!char.name && char.nom) char.name = char.nom;
          if (!char.class && char.classe) char.class = char.classe;
          if (char.equippedWeaponId && !char.equippedWeaponData) {
            char.equippedWeaponData = getWeaponById(char.equippedWeaponId);
          }
          return {
            id: entry.id,
            nbParticipants: entry.nbParticipants,
            nbMatchs: entry.nbMatchs,
            date: entry.date,
            sourceTournamentId: entry.sourceTournamentId || null,
            sourceTournamentType: entry.sourceTournamentType || null,
            ownerPseudo: entry.champion?.ownerPseudo || char.ownerPseudo,
            character: char,
            tournamentArchiveId: entry.tournamentArchiveId || null,
          };
        });

        setChampions(enriched);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  const entriesAnciens = champions.filter((c) => (
    c.sourceTournamentType === 'legacy_archives'
    || c.sourceTournamentId === 'legacy_current'
    || String(c.sourceTournamentId || '').startsWith('legacy_')
  ));
  const entriesSamedi = champions.filter((c) => !entriesAnciens.includes(c));

  const visibleEntries = activeTab === 'anciens' ? entriesAnciens : entriesSamedi;

  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-[1400px] mx-auto pt-20">
        <div className="text-center mb-8">
          <div className="bg-stone-900/70 border-2 border-yellow-500 rounded-xl px-6 py-4 shadow-xl inline-block">
            <h1 className="text-4xl font-bold text-yellow-400">👑 Hall of Fame</h1>
            <p className="text-yellow-300 mt-1">Les grands champions des tournois</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('samedi')}
            className={`px-4 py-2 rounded-lg text-xs font-bold border transition ${
              activeTab === 'samedi'
                ? 'bg-amber-700/80 text-white border-amber-500/60'
                : 'bg-stone-800/90 text-stone-300 border-stone-600 hover:border-amber-600'
            }`}
          >
            Tournois du samedi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('anciens')}
            className={`px-4 py-2 rounded-lg text-xs font-bold border transition ${
              activeTab === 'anciens'
                ? 'bg-amber-700/80 text-white border-amber-500/60'
                : 'bg-stone-800/90 text-stone-300 border-stone-600 hover:border-amber-600'
            }`}
          >
            Tournois des anciens
          </button>
        </div>

        {visibleEntries.length === 0 ? (
          <div className="bg-stone-800/90 p-8 border-2 border-stone-600 rounded-xl text-center max-w-lg mx-auto">
            <p className="text-stone-400 text-xl">Aucun champion pour le moment</p>
            <p className="text-stone-500 mt-2">
              {activeTab === 'anciens'
                ? 'Le premier tournoi des anciens n’a pas encore eu lieu'
                : 'Le premier tournoi du samedi n’a pas encore eu lieu'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-8 justify-items-center">
            {visibleEntries.map((champ) => (
              <div key={champ.id} className="flex flex-col items-center">
                <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg mb-2 text-center">
                  🏆 {champ.ownerPseudo || champ.character.name || 'Champion'}
                </div>
                <CharacterCardContent
                  character={champ.character}
                  borderId={activeTab === 'anciens' ? 'ancient' : 'champion'}
                  detailsPlacement="left"
                />
                <div className="text-stone-500 text-xs mt-1 text-center">
                  {champ.nbParticipants} participants • {champ.nbMatchs} matchs
                  {champ.date && (
                    <span> • {champ.date.toDate?.().toLocaleDateString('fr-FR') || ''}</span>
                  )}
                </div>
                {champ.tournamentArchiveId && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/tournament/history/${encodeURIComponent(champ.tournamentArchiveId)}`)
                    }
                    className="mt-3 bg-amber-700/80 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-lg border border-amber-500/50 transition"
                  >
                    {activeTab === 'anciens' ? 'Afficher l’arbre' : 'Arbre & replay'}
                  </button>
                )}
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
    </div>
  );
};

export default HallOfFame;
