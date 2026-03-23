import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getPlayerDungeonSummary } from '../services/dungeonService';
import { isForgeActive, isSubclassDungeonVisible } from '../data/featureFlags';
import Header from './Header';

function DungeonCard({ icon, title, description, buttonLabel, onClick, accent = 'amber' }) {
  const accentClasses = {
    amber: 'bg-amber-600 hover:bg-amber-500 border-amber-500/60',
    orange: 'bg-orange-600 hover:bg-orange-500 border-orange-500/60',
    violet: 'bg-violet-600 hover:bg-violet-500 border-violet-500/60',
    yellow: 'bg-yellow-500 hover:bg-yellow-400 border-yellow-400/60 text-stone-900',
  };
  const btnClass = accentClasses[accent] || accentClasses.amber;

  return (
    <div
      className="w-[280px] bg-stone-950/80 border border-stone-700/60 rounded-xl p-5 flex flex-col items-center text-center transition-all duration-200 hover:border-stone-500/60 hover:shadow-lg group cursor-pointer"
      onClick={onClick}
    >
      <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-200">{icon}</div>
      <h4 className="text-lg font-bold text-stone-100 mb-1.5">{title}</h4>
      <p className="text-xs text-stone-400 mb-4 leading-relaxed">{description}</p>
      <button
        className={`w-full text-white px-5 py-2.5 rounded-lg font-bold text-sm border transition-all ${btnClass}`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function CategorySection({ title, children, className = '', cardsClassName = '' }) {
  return (
    <div className={`mb-8 ${className}`}>
      <div className="flex justify-center mb-4">
        <div className="bg-stone-950/85 border border-stone-700/80 rounded-lg px-5 py-1.5 shadow">
          <h3 className="text-sm font-bold text-amber-400/90 uppercase tracking-widest">{title}</h3>
        </div>
      </div>
      <div className={`flex flex-wrap justify-center gap-4 ${cardsClassName}`}>
        {children}
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
      <div className="max-w-6xl mx-auto pt-20 px-2">

        {/* Essais disponibles */}
        <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl p-4 mb-8 flex justify-between items-center">
          <div>
            <p className="text-amber-400 font-bold text-sm">Essais disponibles</p>
            <p className="text-white text-3xl font-bold">
              {loading ? '...' : runsRemaining}
            </p>
            <p className="text-stone-500 text-xs mt-0.5">+{maxRuns} à minuit, +{maxRuns} à midi et +{maxRuns} à 18h</p>
          </div>
          <div className="text-right text-stone-500 text-xs">
            Chaque donjon consomme 1 essai
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 lg:items-start justify-center">
          {/* Colonne gauche : tous les donjons « solo » */}
          <div className="flex-1 min-w-0 w-full max-w-[640px] mx-auto lg:mx-0">
            {/* Armes */}
            <CategorySection title="Armes">
              <DungeonCard
                icon="🏰"
                title="La Grotte aux merveilles"
                description="Donjon d'armes et loot"
                buttonLabel="Entrer dans la grotte"
                onClick={() => navigate('/dungeon')}
              />
              {isForgeActive() && (
                <DungeonCard
                  icon="🔨"
                  title="Forge des Légendes"
                  description="Upgrade d'arme légendaire"
                  buttonLabel="Entrer dans la forge"
                  onClick={() => navigate('/forge')}
                  accent="orange"
                />
              )}
            </CategorySection>

            {/* Sorts */}
            <CategorySection title="Sorts">
              <DungeonCard
                icon="🪄"
                title="Tour du Mage"
                description="Donjon de passifs mystiques"
                buttonLabel="Entrer dans la tour"
                onClick={() => navigate('/mage-tower')}
              />
              <DungeonCard
                icon="👁️"
                title="Extension du Territoire"
                description="Fusionne un second passif mystique"
                buttonLabel="Étendre le territoire"
                onClick={() => navigate('/extension')}
                accent="violet"
              />
            </CategorySection>

            {/* Expérience */}
            <CategorySection title="Expérience" className="mb-0 lg:mb-0">
              <DungeonCard
                icon="🌲"
                title="La Forêt enchantée"
                description="Donjon d'EXP et progression"
                buttonLabel="Entrer dans la forêt"
                onClick={() => navigate('/forest')}
              />
              {isSubclassDungeonVisible() && (
                <DungeonCard
                  icon="🎓"
                  title="Collège Kunugigaoka"
                  description="Sous-classe — Niveau 400 requis"
                  buttonLabel="Entrer au Collège"
                  onClick={() => navigate('/sous-classe')}
                  accent="yellow"
                />
              )}
            </CategorySection>
          </div>

          {/* Colonne droite : coop uniquement (alignée comme sur la maquette) */}
          <aside className="w-full max-w-[320px] mx-auto lg:mx-0 lg:flex-shrink-0 lg:sticky lg:top-24 self-start">
            <CategorySection
              title="Coopération"
              className="mb-0"
              cardsClassName="lg:justify-start"
            >
              <DungeonCard
                icon="🔴"
                title="L'arène de Red"
                description="À deux contre Red : liste de salles, prêt des deux joueurs, tirage Pointeau ADN aléatoire."
                buttonLabel="Défier Red"
                onClick={() => navigate('/coop-red')}
                accent="orange"
              />
            </CategorySection>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DungeonSelection;
