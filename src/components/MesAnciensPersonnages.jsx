import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { getArchivedCharacters } from '../services/tournamentService';
import { getWeaponById } from '../data/weapons';
import { races } from '../data/gameData';

const MesAnciensPersonnages = () => {
  const { currentUser } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      const result = await getArchivedCharacters(currentUser.uid);
      if (result.success) {
        const sorted = [...result.data].sort((a, b) => {
          const aTs = a.archivedAt?.toMillis?.() || 0;
          const bTs = b.archivedAt?.toMillis?.() || 0;
          return bTs - aTs;
        });
        const enriched = sorted.map(char => {
          const copy = { ...char };
          if (copy.equippedWeaponId && !copy.equippedWeaponData) {
            copy.equippedWeaponData = getWeaponById(copy.equippedWeaponId);
          }
          return copy;
        });
        setCharacters(enriched);
      }
      setLoading(false);
    };
    load();
  }, [currentUser]);

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
      <div className="max-w-[1800px] mx-auto pt-20">
        <div className="text-center mb-8">
          <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block">
            <h1 className="text-4xl font-bold text-amber-400">📜 Mes Anciens Personnages</h1>
            <p className="text-stone-400 mt-1">Les héros qui ont participé aux tournois</p>
          </div>
        </div>

        {characters.length === 0 ? (
          <div className="bg-stone-800/90 p-8 border-2 border-stone-600 rounded-xl text-center max-w-lg mx-auto">
            <p className="text-stone-400 text-xl">Aucun ancien personnage</p>
            <p className="text-stone-500 mt-2">Tes personnages apparaîtront ici après chaque tournoi</p>
          </div>
        ) : (
          <div className="space-y-6">
            {characters.map((char) => (
              <div key={char.id} className="relative">
                {char.tournamentChampion && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold z-20 shadow-lg">
                    👑 CHAMPION
                  </div>
                )}
                <CharacterCardContent
                  character={char}
                  borderId={char.tournamentChampion ? 'champion' : null}
                  detailsPlacement="left"
                />
                {char.archivedAt && (
                  <div className="text-stone-600 text-xs text-center mt-1">
                    Archivé le {char.archivedAt.toDate?.().toLocaleDateString('fr-FR') || ''}
                  </div>
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

export default MesAnciensPersonnages;
