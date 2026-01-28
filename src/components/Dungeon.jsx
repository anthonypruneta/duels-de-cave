import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter } from '../services/characterService';
import {
  getPlayerDungeonSummary,
  startDungeonRun,
  endDungeonRun,
  handleLootChoice
} from '../services/dungeonService';
import {
  getAllDungeonLevels,
  getDungeonLevelByNumber,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  DIFFICULTY_BG_COLORS,
  DUNGEON_CONSTANTS
} from '../data/dungeons';
import {
  RARITY_COLORS,
  RARITY_BORDER_COLORS,
  RARITY_BG_COLORS
} from '../data/weapons';
import Header from './Header';

const Dungeon = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // États
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [dungeonSummary, setDungeonSummary] = useState(null);
  const [gameState, setGameState] = useState('lobby'); // lobby, fighting, victory, defeat, loot
  const [currentLevel, setCurrentLevel] = useState(1);
  const [highestLevelBeaten, setHighestLevelBeaten] = useState(0);
  const [lootWeapon, setLootWeapon] = useState(null);
  const [error, setError] = useState(null);

  // Charger les données au montage
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;

      setLoading(true);
      try {
        // Charger le personnage
        const charResult = await getUserCharacter(currentUser.uid);
        if (!charResult.success || !charResult.data) {
          navigate('/');
          return;
        }
        setCharacter(charResult.data);

        // Charger la progression donjon
        const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
        if (summaryResult.success) {
          setDungeonSummary(summaryResult.data);
        }
      } catch (err) {
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, navigate]);

  // Démarrer une run
  const handleStartRun = async () => {
    setError(null);
    const result = await startDungeonRun(currentUser.uid);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setGameState('fighting');
    setCurrentLevel(1);
    setHighestLevelBeaten(0);
  };

  // Simuler un combat (victoire/défaite)
  // TODO: Intégrer le vrai système de combat
  const handleFightResult = async (victory) => {
    if (victory) {
      const newHighest = currentLevel;
      setHighestLevelBeaten(newHighest);

      if (currentLevel < DUNGEON_CONSTANTS.TOTAL_LEVELS) {
        // Passer au niveau suivant
        setCurrentLevel(currentLevel + 1);
      } else {
        // Full clear!
        const result = await endDungeonRun(currentUser.uid, newHighest);
        if (result.success && result.lootWeapon) {
          setLootWeapon(result.lootWeapon);
          setGameState('loot');
        } else {
          setGameState('victory');
        }
      }
    } else {
      // Défaite
      const result = await endDungeonRun(currentUser.uid, highestLevelBeaten, currentLevel);
      if (result.success && result.lootWeapon) {
        setLootWeapon(result.lootWeapon);
        setGameState('loot');
      } else {
        setGameState('defeat');
      }
    }
  };

  // Gérer le choix du loot
  const handleLootDecision = async (equipNew) => {
    if (lootWeapon) {
      await handleLootChoice(currentUser.uid, lootWeapon.id, equipNew);
    }

    // Recharger le résumé
    const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
    if (summaryResult.success) {
      setDungeonSummary(summaryResult.data);
    }

    setLootWeapon(null);
    setGameState('lobby');
  };

  // Retour au lobby
  const handleBackToLobby = async () => {
    const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
    if (summaryResult.success) {
      setDungeonSummary(summaryResult.data);
    }
    setGameState('lobby');
    setCurrentLevel(1);
    setHighestLevelBeaten(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-amber-400 text-2xl">Chargement du donjon...</div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <p className="text-gray-300 text-xl">Vous devez créer un personnage d'abord</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 font-bold"
          >
            Créer un personnage
          </button>
        </div>
      </div>
    );
  }

  const levels = getAllDungeonLevels();
  const currentLevelData = getDungeonLevelByNumber(currentLevel);

  // ============================================================================
  // ÉCRAN DE LOOT
  // ============================================================================
  if (gameState === 'loot' && lootWeapon) {
    const hasCurrentWeapon = dungeonSummary?.equippedWeaponData;

    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-2xl mx-auto pt-20">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎁</div>
            <h2 className="text-4xl font-bold text-amber-400 mb-2">Butin obtenu !</h2>
            <p className="text-gray-300">
              {highestLevelBeaten === DUNGEON_CONSTANTS.TOTAL_LEVELS
                ? 'Vous avez vaincu tous les boss !'
                : `Vous avez atteint le niveau ${highestLevelBeaten}`}
            </p>
          </div>

          {/* Arme droppée */}
          <div className={`p-6 border-2 ${RARITY_BORDER_COLORS[lootWeapon.rarete]} ${RARITY_BG_COLORS[lootWeapon.rarete]} mb-6`}>
            <div className="text-center">
              <div className="text-6xl mb-3">{lootWeapon.icon}</div>
              <h3 className={`text-2xl font-bold ${RARITY_COLORS[lootWeapon.rarete]}`}>
                {lootWeapon.nom}
              </h3>
              <p className={`text-sm uppercase ${RARITY_COLORS[lootWeapon.rarete]}`}>
                {lootWeapon.rarete}
              </p>
              <p className="text-gray-400 text-sm mt-2">{lootWeapon.description}</p>

              {/* Stats */}
              <div className="mt-4 flex justify-center gap-4 flex-wrap">
                {Object.entries(lootWeapon.stats).map(([stat, value]) => (
                  <div key={stat} className="bg-stone-800 px-3 py-1 border border-stone-600">
                    <span className="text-gray-400 text-sm">{stat.toUpperCase()}</span>
                    <span className={`ml-2 font-bold ${value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {value > 0 ? '+' : ''}{value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Effet légendaire */}
              {lootWeapon.effet && (
                <div className="mt-4 bg-amber-900/30 border border-amber-600 p-3">
                  <p className="text-amber-300 font-bold">{lootWeapon.effet.nom}</p>
                  <p className="text-amber-200 text-sm">{lootWeapon.effet.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Arme actuelle si existante */}
          {hasCurrentWeapon && (
            <div className="mb-6">
              <p className="text-center text-gray-400 mb-2">Arme actuellement équipée :</p>
              <div className={`p-4 border ${RARITY_BORDER_COLORS[hasCurrentWeapon.rarete]} ${RARITY_BG_COLORS[hasCurrentWeapon.rarete]}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{hasCurrentWeapon.icon}</span>
                  <div>
                    <p className={`font-bold ${RARITY_COLORS[hasCurrentWeapon.rarete]}`}>
                      {hasCurrentWeapon.nom}
                    </p>
                    <div className="flex gap-2">
                      {Object.entries(hasCurrentWeapon.stats).map(([stat, value]) => (
                        <span key={stat} className="text-xs text-gray-400">
                          {stat.toUpperCase()}: {value > 0 ? '+' : ''}{value}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Boutons de choix */}
          <div className="flex gap-4">
            {hasCurrentWeapon ? (
              <>
                <button
                  onClick={() => handleLootDecision(false)}
                  className="flex-1 bg-stone-700 hover:bg-stone-600 text-white px-6 py-4 font-bold border border-stone-500"
                >
                  Garder mon arme actuelle
                </button>
                <button
                  onClick={() => handleLootDecision(true)}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-6 py-4 font-bold border border-amber-500"
                >
                  Équiper la nouvelle arme
                </button>
              </>
            ) : (
              <button
                onClick={() => handleLootDecision(true)}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white px-6 py-4 font-bold border border-amber-500"
              >
                Équiper l'arme
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ÉCRAN DE COMBAT
  // ============================================================================
  if (gameState === 'fighting' && currentLevelData) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-4xl mx-auto pt-20">
          {/* Header du niveau */}
          <div className="text-center mb-8">
            <div className="flex justify-center items-center gap-4 mb-4">
              {levels.map((level, idx) => (
                <div
                  key={level.id}
                  className={`w-12 h-12 flex items-center justify-center border-2 ${
                    idx + 1 < currentLevel
                      ? 'bg-green-600 border-green-400 text-white'
                      : idx + 1 === currentLevel
                        ? 'bg-amber-600 border-amber-400 text-white animate-pulse'
                        : 'bg-stone-800 border-stone-600 text-stone-500'
                  }`}
                >
                  {idx + 1 < currentLevel ? '✓' : level.niveau}
                </div>
              ))}
            </div>
            <h2 className="text-3xl font-bold text-amber-400">{currentLevelData.nom}</h2>
            <p className={`${DIFFICULTY_COLORS[currentLevelData.difficulte]}`}>
              {DIFFICULTY_LABELS[currentLevelData.difficulte]}
            </p>
          </div>

          {/* Zone de combat */}
          <div className={`p-8 border-2 ${DIFFICULTY_BG_COLORS[currentLevelData.difficulte]} mb-6`}>
            <div className="text-center">
              <div className="text-8xl mb-4">{currentLevelData.bossIcon}</div>
              <h3 className="text-2xl font-bold text-white mb-2">{currentLevelData.bossNom}</h3>
              <p className="text-gray-400">{currentLevelData.description}</p>

              {/* Info sur le loot */}
              <div className="mt-4 bg-stone-800/50 p-3 border border-stone-600">
                <p className="text-sm text-gray-300">
                  Récompense : Arme <span className={RARITY_COLORS[currentLevelData.dropRarity]}>
                    {currentLevelData.dropRarity}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* TODO: Remplacer par le vrai système de combat */}
          <div className="bg-stone-800 p-6 border border-stone-600 mb-6">
            <p className="text-center text-gray-400 mb-4">
              Simulation de combat (à remplacer par le vrai moteur)
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => handleFightResult(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 font-bold"
              >
                Simuler Victoire
              </button>
              <button
                onClick={() => handleFightResult(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 font-bold"
              >
                Simuler Défaite
              </button>
            </div>
          </div>

          {/* Bouton retour */}
          <div className="text-center">
            <button
              onClick={handleBackToLobby}
              className="text-gray-400 hover:text-white underline"
            >
              Abandonner la run
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ÉCRAN DE VICTOIRE/DÉFAITE (sans loot)
  // ============================================================================
  if (gameState === 'victory' || gameState === 'defeat') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <div className="text-8xl mb-6">
            {gameState === 'victory' ? '🏆' : '💀'}
          </div>
          <h2 className={`text-4xl font-bold mb-4 ${gameState === 'victory' ? 'text-amber-400' : 'text-red-400'}`}>
            {gameState === 'victory' ? 'Victoire totale !' : 'Défaite...'}
          </h2>
          <p className="text-gray-300 mb-8">
            {gameState === 'victory'
              ? 'Vous avez vaincu tous les boss du donjon !'
              : `Vous avez été vaincu au niveau ${currentLevel}. Aucun loot obtenu.`}
          </p>
          <button
            onClick={handleBackToLobby}
            className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 font-bold"
          >
            Retour au donjon
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LOBBY DU DONJON
  // ============================================================================
  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-4xl mx-auto pt-20">
        {/* Titre */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-stone-800 border border-stone-600 px-8 py-3">
            <h2 className="text-4xl font-bold text-stone-200">Le Donjon</h2>
          </div>
        </div>

        {/* Info runs */}
        <div className="bg-stone-800 border border-amber-600 p-4 mb-8 flex justify-between items-center">
          <div>
            <p className="text-amber-300 font-bold">Runs aujourd'hui</p>
            <p className="text-white text-2xl">
              {dungeonSummary?.runsRemaining || 0} / {DUNGEON_CONSTANTS.MAX_RUNS_PER_DAY} restantes
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Meilleur run</p>
            <p className="text-amber-400 font-bold">
              {dungeonSummary?.bestRun ? `Niveau ${dungeonSummary.bestRun}` : 'Aucune'}
            </p>
          </div>
        </div>

        {/* Arme équipée */}
        {dungeonSummary?.equippedWeaponData && (
          <div className={`mb-8 p-4 border-2 ${RARITY_BORDER_COLORS[dungeonSummary.equippedWeaponData.rarete]} ${RARITY_BG_COLORS[dungeonSummary.equippedWeaponData.rarete]}`}>
            <div className="flex items-center gap-4">
              <span className="text-4xl">{dungeonSummary.equippedWeaponData.icon}</span>
              <div className="flex-1">
                <p className="text-sm text-gray-400">Arme équipée</p>
                <p className={`text-xl font-bold ${RARITY_COLORS[dungeonSummary.equippedWeaponData.rarete]}`}>
                  {dungeonSummary.equippedWeaponData.nom}
                </p>
                <div className="flex gap-3 mt-1">
                  {Object.entries(dungeonSummary.equippedWeaponData.stats).map(([stat, value]) => (
                    <span key={stat} className={`text-sm ${value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {stat.toUpperCase()}: {value > 0 ? '+' : ''}{value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {dungeonSummary.equippedWeaponData.effet && (
              <div className="mt-3 bg-stone-900/50 p-2 border border-amber-600/50">
                <p className="text-amber-300 text-sm font-bold">{dungeonSummary.equippedWeaponData.effet.nom}</p>
                <p className="text-amber-200 text-xs">{dungeonSummary.equippedWeaponData.effet.description}</p>
              </div>
            )}
          </div>
        )}

        {/* Les 3 niveaux */}
        <div className="space-y-4 mb-8">
          {levels.map((level) => (
            <div
              key={level.id}
              className={`p-4 border-2 ${DIFFICULTY_BG_COLORS[level.difficulte]}`}
            >
              <div className="flex items-center gap-4">
                <div className="text-4xl">{level.bossIcon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-lg">Niveau {level.niveau}</span>
                    <span className={`text-sm ${DIFFICULTY_COLORS[level.difficulte]}`}>
                      ({DIFFICULTY_LABELS[level.difficulte]})
                    </span>
                  </div>
                  <p className="text-gray-300">{level.nom}</p>
                  <p className="text-gray-500 text-sm">{level.bossNom}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Loot</p>
                  <p className={`font-bold ${RARITY_COLORS[level.dropRarity]}`}>
                    Arme {level.dropRarity}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Erreur */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 p-4 mb-6 text-center">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Bouton démarrer */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate('/')}
            className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 font-bold border border-stone-500"
          >
            Retour
          </button>
          <button
            onClick={handleStartRun}
            disabled={!dungeonSummary?.runsRemaining}
            className={`px-12 py-4 font-bold text-xl ${
              dungeonSummary?.runsRemaining > 0
                ? 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-500'
                : 'bg-stone-700 text-stone-500 cursor-not-allowed border border-stone-600'
            }`}
          >
            {dungeonSummary?.runsRemaining > 0 ? 'Entrer dans le donjon' : 'Plus de runs aujourd\'hui'}
          </button>
        </div>

        {/* Info */}
        <div className="mt-8 bg-stone-800/50 border border-stone-600 p-4 text-center">
          <p className="text-gray-400 text-sm">
            Le donjon contient 3 niveaux progressifs. Si vous êtes vaincu, vous obtenez le loot du dernier niveau réussi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dungeon;
