import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getPlayerDungeonSummary } from '../services/dungeonService';
import Header from './Header';

const DungeonSelection = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [runsRemaining, setRunsRemaining] = useState(0);
  const [maxRuns, setMaxRuns] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      if (!currentUser) return;
      setLoading(true);
      const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
      if (summaryResult.success) {
        setRunsRemaining(summaryResult.data.runsRemaining);
        setMaxRuns(summaryResult.data.maxRuns);
      }
      setLoading(false);
    };

    loadSummary();
  }, [currentUser]);

  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-5xl mx-auto pt-20">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-stone-800 border border-stone-600 px-8 py-3">
            <h2 className="text-4xl font-bold text-stone-200">Les Donjons</h2>
          </div>
        </div>

        <div className="bg-stone-800 border border-amber-600 p-4 mb-8 flex justify-between items-center">
          <div>
            <p className="text-amber-300 font-bold">Essais disponibles (cumulables)</p>
            <p className="text-white text-2xl">
              {loading ? '...' : `${runsRemaining}`}
            </p>
            <p className="text-stone-400 text-sm">+{maxRuns} à minuit et +{maxRuns} à midi</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Chaque donjon consomme 1 essai</p>
          </div>
        </div>

        <div className="bg-stone-800 border border-stone-600 p-4 mb-8">
          <h3 className="text-xl font-bold text-amber-400 mb-4 text-center">Choisis ton aventure</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-stone-900/50 p-4 border border-stone-700 text-center">
              <div className="text-4xl mb-2">🏰</div>
              <p className="text-white font-bold text-lg">La Grotte aux merveilles</p>
              <p className="text-sm text-stone-400 mb-4">Donjon d’armes et loot</p>
              <button
                onClick={() => navigate('/dungeon')}
                className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 font-bold border border-amber-500"
              >
                Entrer dans la grotte
              </button>
            </div>
            <div className="bg-stone-900/50 p-4 border border-stone-700 text-center">
              <div className="text-4xl mb-2">🌲</div>
              <p className="text-white font-bold text-lg">La Forêt enchantée</p>
              <p className="text-sm text-stone-400 mb-4">Donjon d’EXP et progression</p>
              <button
                onClick={() => navigate('/forest')}
                className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 font-bold border border-amber-500"
              >
                Entrer dans la forêt
              </button>
            </div>
            <div className="bg-stone-900/50 p-4 border border-stone-700 text-center">
              <div className="text-4xl mb-2">🪄</div>
              <p className="text-white font-bold text-lg">Tour du Mage</p>
              <p className="text-sm text-stone-400 mb-4">Donjon de passifs mystiques</p>
              <button
                onClick={() => navigate('/mage-tower')}
                className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 font-bold border border-amber-500"
              >
                Entrer dans la tour
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => navigate('/')}
            className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 font-bold border border-stone-500"
          >
            Retour
          </button>
        </div>
      </div>
    </div>
  );
};

export default DungeonSelection;
