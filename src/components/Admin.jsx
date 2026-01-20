import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllCharacters } from '../services/characterService';
import Header from './Header';

const Admin = () => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const races = {
    'Humain': '👥',
    'Elfe': '🧝',
    'Orc': '🪓',
    'Nain': '⛏️',
    'Dragonkin': '🐲',
    'Mort-vivant': '☠️',
    'Lycan': '🐺',
    'Sylvari': '🌿'
  };

  const classes = {
    'Guerrier': '🗡️',
    'Voleur': '🌀',
    'Paladin': '🛡️',
    'Healer': '✚',
    'Archer': '🏹',
    'Mage': '🔮',
    'Demoniste': '💠',
    'Masochiste': '🩸'
  };

  useEffect(() => {
    const loadCharacters = async () => {
      setLoading(true);
      const result = await getAllCharacters();

      if (result.success) {
        setCharacters(result.data);
      } else {
        setError(result.error);
      }

      setLoading(false);
    };

    loadCharacters();
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const generateMidjourneyPrompt = (char) => {
    const genderText = char.gender === 'male' ? 'homme' : 'femme';
    return `${genderText} ${char.race.toLowerCase()} ${char.class.toLowerCase()}, ${char.keyword}, fantasy art, detailed character portrait, epic, dramatic lighting, high quality --ar 2:3`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Prompt copié!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 flex items-center justify-center">
        <Header />
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 flex items-center justify-center p-6">
        <Header />
        <div className="bg-red-900/50 border-2 border-red-500 rounded-lg p-6 max-w-md">
          <p className="text-red-300 text-center">Erreur: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 p-6">
      <Header />
      <div className="max-w-7xl mx-auto pt-20">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 text-amber-400">🎯 Backoffice Admin</h1>
          <p className="text-amber-300 text-lg">
            {characters.length} personnage{characters.length > 1 ? 's' : ''} créé{characters.length > 1 ? 's' : ''}
          </p>
        </div>

        {characters.length === 0 ? (
          <div className="bg-stone-800/50 rounded-xl p-8 border-2 border-amber-600 text-center">
            <p className="text-gray-400 text-xl">Aucun personnage créé pour le moment</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((char) => (
              <div
                key={char.id}
                className="bg-stone-800/90 rounded-xl p-6 border-2 border-amber-600 shadow-xl hover:shadow-2xl transition-shadow cursor-pointer"
                onClick={() => setSelectedCharacter(char)}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-4xl">{races[char.race] || '❓'}</span>
                    <span className="text-4xl">{classes[char.class] || '❓'}</span>
                  </div>
                  <span className="text-amber-400 text-xs">
                    {char.gender === 'male' ? '👨' : '👩'}
                  </span>
                </div>

                {/* Nom */}
                <h3 className="text-2xl font-bold text-white mb-2">{char.name}</h3>
                <p className="text-amber-300 text-sm mb-4">
                  {char.race} • {char.class}
                </p>

                {/* Stats */}
                <div className="bg-stone-900/50 rounded-lg p-3 mb-4 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-gray-300">
                    <div>HP: <span className="text-white font-bold">{char.base.hp}</span></div>
                    <div>VIT: <span className="text-white font-bold">{char.base.spd}</span></div>
                    <div>Auto: <span className="text-white font-bold">{char.base.auto}</span></div>
                    <div>Déf: <span className="text-white font-bold">{char.base.def}</span></div>
                    <div>Cap: <span className="text-white font-bold">{char.base.cap}</span></div>
                    <div>ResC: <span className="text-white font-bold">{char.base.rescap}</span></div>
                  </div>
                </div>

                {/* Mot-clé */}
                <div className="bg-amber-900/30 rounded-lg p-2 mb-3">
                  <p className="text-xs text-gray-400">Mot-clé:</p>
                  <p className="text-amber-300 font-bold">{char.keyword}</p>
                </div>

                {/* Date */}
                <p className="text-xs text-gray-500">
                  Créé le: {formatDate(char.createdAt)}
                </p>

                {/* Bouton détails */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCharacter(char);
                  }}
                  className="mt-4 w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded transition"
                >
                  Voir prompt Midjourney
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bouton retour */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-3 rounded-lg font-bold transition"
          >
            ← Retour
          </button>
        </div>
      </div>

      {/* Modal détails personnage */}
      {selectedCharacter && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50"
          onClick={() => setSelectedCharacter(null)}
        >
          <div
            className="bg-stone-800 rounded-2xl p-8 max-w-2xl w-full border-4 border-amber-600 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-5xl">{races[selectedCharacter.race]}</span>
                <span className="text-5xl">{classes[selectedCharacter.class]}</span>
                <div>
                  <h2 className="text-3xl font-bold text-white">{selectedCharacter.name}</h2>
                  <p className="text-amber-300">
                    {selectedCharacter.race} • {selectedCharacter.class}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCharacter(null)}
                className="text-gray-400 hover:text-white text-3xl"
              >
                ×
              </button>
            </div>

            {/* Infos */}
            <div className="space-y-4 mb-6">
              <div className="bg-stone-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Genre</p>
                <p className="text-white font-bold">
                  {selectedCharacter.gender === 'male' ? 'Homme 👨' : 'Femme 👩'}
                </p>
              </div>

              <div className="bg-stone-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Mot-clé Midjourney</p>
                <p className="text-amber-300 font-bold text-lg">{selectedCharacter.keyword}</p>
              </div>

              <div className="bg-stone-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-2">Statistiques de base</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">HP:</span>{' '}
                    <span className="text-white font-bold">{selectedCharacter.base.hp}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Auto:</span>{' '}
                    <span className="text-white font-bold">{selectedCharacter.base.auto}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Déf:</span>{' '}
                    <span className="text-white font-bold">{selectedCharacter.base.def}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Cap:</span>{' '}
                    <span className="text-white font-bold">{selectedCharacter.base.cap}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">ResC:</span>{' '}
                    <span className="text-white font-bold">{selectedCharacter.base.rescap}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">VIT:</span>{' '}
                    <span className="text-white font-bold">{selectedCharacter.base.spd}</span>
                  </div>
                </div>
              </div>

              <div className="bg-stone-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Date de création</p>
                <p className="text-white">{formatDate(selectedCharacter.createdAt)}</p>
              </div>
            </div>

            {/* Prompt Midjourney */}
            <div className="bg-amber-900/30 rounded-lg p-4 border-2 border-amber-600">
              <p className="text-amber-400 font-bold mb-2">🎨 Prompt Midjourney:</p>
              <p className="text-white text-sm mb-3 font-mono bg-stone-900/50 p-3 rounded">
                {generateMidjourneyPrompt(selectedCharacter)}
              </p>
              <button
                onClick={() => copyToClipboard(generateMidjourneyPrompt(selectedCharacter))}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded font-bold transition"
              >
                📋 Copier le prompt
              </button>
            </div>

            {/* User ID */}
            <div className="mt-4 text-xs text-gray-500 text-center">
              User ID: {selectedCharacter.userId}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
