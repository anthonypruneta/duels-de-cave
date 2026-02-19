import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { getHallOfFame } from '../services/tournamentService';
import UnifiedCharacterCard from './UnifiedCharacterCard';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { races, classes } from '../data/gameData';

const HallOfFame = () => {
  const [champions, setChampions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChampion, setSelectedChampion] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const result = await getHallOfFame();
      if (result.success) setChampions(result.data);
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
                    onClick={() => setSelectedChampion(entry.champion)}
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

      {selectedChampion && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setSelectedChampion(null)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <UnifiedCharacterCard
              header={`${selectedChampion.race} • ${selectedChampion.classe} • Niveau ${selectedChampion.level ?? 1}`}
              name={selectedChampion.nom}
              image={selectedChampion.characterImage}
              fallback={<span className="text-7xl">👑</span>}
              topStats={
                <>
                  <span className="text-yellow-300">HP: {selectedChampion.base?.hp || 0}</span>
                  <span className="text-yellow-300">VIT: {selectedChampion.base?.spd || 0}</span>
                </>
              }
              mainStats={
                <>
                  <span className="text-stone-300 font-bold">Auto: {selectedChampion.base?.auto || 0}</span>
                  <span className="text-stone-300 font-bold">Déf: {selectedChampion.base?.def || 0}</span>
                  <span className="text-stone-300 font-bold">Cap: {selectedChampion.base?.cap || 0}</span>
                  <span className="text-stone-300 font-bold">ResC: {selectedChampion.base?.rescap || 0}</span>
                </>
              }
              details={
                <div className="space-y-2 text-xs text-stone-300">
                  <div className="border border-stone-600 bg-stone-900/60 p-2">
                    <div className="text-amber-200 font-semibold">🏆 Champion du Tournoi</div>
                    {selectedChampion.ownerPseudo && (
                      <div className="text-cyan-300 mt-1">Joueur: {selectedChampion.ownerPseudo}</div>
                    )}
                  </div>
                  {selectedChampion.weapon && (
                    <div className="border border-stone-600 bg-stone-900/60 p-2">
                      <div className="text-amber-200 font-semibold">{selectedChampion.weapon.nom}</div>
                      <div className="text-stone-400 text-[11px] mt-1">{selectedChampion.weapon.description}</div>
                    </div>
                  )}
                </div>
              }
              cardClassName="shadow-2xl"
            />
            <button
              onClick={() => setSelectedChampion(null)}
              className="mt-4 w-full bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded-lg transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HallOfFame;
