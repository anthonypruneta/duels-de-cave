import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getPlayerDungeonSummary } from '../services/dungeonService';
import { isForgeActive, isSubclassDungeonVisible } from '../data/featureFlags';
import Header from './Header';

/** Style du nom aligné sur UnifiedCharacterCard */
const cardNameStyle = {
  color: 'rgb(254 243 199)',
  textShadow: '0 0 2px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
};

function DungeonCard({ header, icon, title, description, buttonLabel, onClick, accent = 'amber' }) {
  const accentClasses = {
    amber: 'bg-amber-600 hover:bg-amber-700 border-amber-500',
    orange: 'bg-orange-600 hover:bg-orange-700 border-orange-500',
    violet: 'bg-violet-600 hover:bg-violet-700 border-violet-500',
  };
  const btnClass = accentClasses[accent] || accentClasses.amber;

  return (
    <div className="w-full max-w-[340px] mx-auto">
      <div className="relative shadow-2xl">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-amber-200 px-5 py-1 text-xs font-bold shadow-lg z-10 border border-stone-600 text-center whitespace-nowrap">
          {header}
        </div>

        <div className="overflow-visible border border-stone-600 bg-stone-900">
          <div className="relative bg-stone-900 flex items-center justify-center min-h-[180px]">
            <div className="text-6xl mb-2">{icon}</div>
            <div className="absolute bottom-5 left-2 right-2 py-1 text-center">
              <div className="font-bold text-lg leading-tight" style={cardNameStyle}>{title}</div>
            </div>
          </div>

          <div className="bg-stone-800 p-3 border-t border-stone-600">
            <p className="text-xs text-stone-400 mb-3">{description}</p>
            <button
              onClick={onClick}
              className={`w-full text-white px-6 py-3 font-bold border ${btnClass}`}
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
            <DungeonCard
              header="Donjon"
              icon="🏰"
              title="La Grotte aux merveilles"
              description="Donjon d’armes et loot"
              buttonLabel="Entrer dans la grotte"
              onClick={() => navigate('/dungeon')}
            />
            <DungeonCard
              header="Donjon"
              icon="🌲"
              title="La Forêt enchantée"
              description="Donjon d’EXP et progression"
              buttonLabel="Entrer dans la forêt"
              onClick={() => navigate('/forest')}
            />
            <DungeonCard
              header="Donjon"
              icon="🪄"
              title="Tour du Mage"
              description="Donjon de passifs mystiques"
              buttonLabel="Entrer dans la tour"
              onClick={() => navigate('/mage-tower')}
            />
            {isForgeActive() && (
              <DungeonCard
                header="Donjon"
                icon="🔨"
                title="Forge des Legendes"
                description="Upgrade d'arme legendaire"
                buttonLabel="Entrer dans la forge"
                onClick={() => navigate('/forge')}
                accent="orange"
              />
            )}
            <DungeonCard
              header="Donjon"
              icon="👁️"
              title="Extension du Territoire"
              description="Passif niv.3 + second passif niv.1 à 3 (90%/9%/1%) — Gojo"
              buttonLabel="Étendre le territoire"
              onClick={() => navigate('/extension')}
              accent="violet"
            />
            {isSubclassDungeonVisible() && (
              <DungeonCard
                header="Donjon"
                icon="🎓"
                title="Collège Kunugigaoka"
                description="Sous-classe — Niveau 400 requis"
                buttonLabel="Entrer au Collège"
                onClick={() => navigate('/sous-classe')}
              />
            )}
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
