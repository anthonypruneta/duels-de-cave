import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllCharacters, deleteCharacter } from '../services/characterService';
import Header from './Header';

const Admin = () => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
        console.log('Personnages chargés dans Admin:', result.data);
      } else {
        setError(result.error);
        console.error('Erreur chargement personnages:', result.error);
      }

      setLoading(false);
    };

    loadCharacters();
  }, []);

  const handleDelete = async (userId, characterName) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le personnage "${characterName}" ?`)) {
      return;
    }

    setDeleting(true);
    const result = await deleteCharacter(userId);

    if (result.success) {
      // Retirer le personnage de la liste
      setCharacters(characters.filter(char => char.id !== userId));
      setSelectedCharacter(null);
      alert('Personnage supprimé avec succès!');
    } else {
      alert('Erreur lors de la suppression: ' + result.error);
    }

    setDeleting(false);
  };

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
    const genderText = char.gender === 'male' ? 'Male' : 'Female';
    const characterType = char.gender === 'male' ? 'hero' : 'heroine';

    // Descriptions physiques par race
    const raceDescriptions = {
      'Humain': 'balanced athletic build, determined eyes, weathered features, battle-scarred skin, strong jawline',
      'Elfe': 'elegant slender build, luminous eyes, pointed ears, graceful features, ethereal presence, flowing hair',
      'Orc': 'massive muscular build, prominent tusks, green-grey skin, fierce eyes, tribal scars, imposing stature',
      'Nain': 'stout powerful build, thick braided beard, rugged features, stone-grey eyes, weathered skin',
      'Dragonkin': 'tall draconic humanoid with emerald and obsidian scales, glowing reptilian eyes, sharp horns swept back, long scaled tail',
      'Mort-vivant': 'gaunt skeletal frame, pale bluish rotten flesh, glowing ghostly eyes, exposed ribs, decayed skin, undead aura',
      'Lycan': 'tall athletic wolf-like humanoid, silver and charcoal fur, glowing amber eyes, sharp claws, feral grace',
      'Sylvari': 'lithe plant-like humanoid, bark-textured skin with moss patches, leaf-like hair, glowing sap veins, nature-infused'
    };

    // Descriptions d'équipement par classe
    const classDescriptions = {
      'Guerrier': 'heavy plate armor with battle dents, large two-handed sword, shield strapped to back, metal greaves, war-ready stance',
      'Voleur': 'light leather armor with dark hood, twin daggers at belt, lockpicks and pouches, agile crouched stance, shadowy presence',
      'Paladin': 'radiant blessed armor, holy symbol glowing on chest, ornate shield, divine aura, righteous stance',
      'Healer': 'flowing robes with herbal pouches, glowing healing staff, bandages and vials, gentle aura around hands, restorative stance',
      'Archer': 'reinforced leather gear, longbow with glowing string, quiver of enchanted arrows, steady aim stance',
      'Mage': 'flowing spellcaster robes, arcane catalysts hanging from belt, glowing crystal focus, magical runes on clothing',
      'Demoniste': 'dark ritualistic robes, summoning circles on fabric, demonic sigils, shadowy familiar lurking, occult accessories',
      'Masochiste': 'torn leather straps, exposed scarred skin, ritual chains, bone spikes, rusted hook weapon, tortured stance'
    };

    // Traits raciaux spécifiques
    const racialTraits = {
      'Humain': 'adaptable presence, versatile stance, inner determination radiating',
      'Elfe': 'graceful movements, magical affinity glowing softly, ancient wisdom in eyes',
      'Orc': 'battle fury barely contained, intimidating war cry stance, tribal warrior pride',
      'Nain': 'unshakeable stance, stone-like resilience, ancient forge wisdom',
      'Dragonkin': 'faint smoke rising from nostrils, inner glow under scales, magical energy pulsing beneath skin',
      'Mort-vivant': 'necrotic aura seeping, spectral presence, death energy swirling',
      'Lycan': 'subtle blood-scent aura, slightly elongated fangs, light feral presence without aggression',
      'Sylvari': 'photosynthetic glow, living vines growing, nature magic emanating, flower blooms appearing'
    };

    // Backgrounds par race
    const raceBackgrounds = {
      'Humain': 'pixel medieval fortress courtyard, training grounds, banners waving, torches lit',
      'Elfe': 'pixel enchanted forest glade, ancient trees, magical mist, moonlight filtering through',
      'Orc': 'pixel tribal war camp, burning braziers, battle trophies, volcanic rocks',
      'Nain': 'pixel mountain forge, anvil glowing, stone halls, underground cavern',
      'Dragonkin': 'pixel arcane canyon lit by volcanic cracks, emerald fog, magical circle etched in stone',
      'Mort-vivant': 'pixel drowned crypt, flooded corridor, eerie teal lighting, broken tombs',
      'Lycan': 'pixel moonlit clearing, ancient forest shrine, shadowy trees, mystical atmosphere',
      'Sylvari': 'pixel living grove, bioluminescent plants, nature spirits floating, verdant magic'
    };

    const raceDesc = raceDescriptions[char.race] || 'mysterious appearance';
    const classDesc = classDescriptions[char.class] || 'warrior gear';
    const racialTrait = racialTraits[char.race] || 'unique presence';
    const background = raceBackgrounds[char.race] || 'pixel fantasy landscape';

    return `HD-2D pixel art sprite, Octopath Traveler style, high-detail pixel clusters, dramatic rim lighting, crisp clean pixels, full-body sprite, imposing but elegant RPG ${characterType}

${genderText} ${char.race} ${char.class} named "${char.name}", ${raceDesc}

${char.class} attire: ${classDesc}

Theme: "${char.keyword}" - subtle ${char.keyword.toLowerCase()}-inspired accents, ${char.keyword.toLowerCase()}-colored highlights, magical aura reflecting the ${char.keyword.toLowerCase()} theme, atmospheric particles

${char.race} trait: ${racialTrait}

Background: ${background}, fantasy atmosphere, cinematic depth

no blur, no watercolor, no chibi, handcrafted pixel art, retro-modern JRPG sprite aesthetic --ar 2:3 --style raw`;
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
            <div className="bg-amber-900/30 rounded-lg p-4 border-2 border-amber-600 mb-4">
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

            {/* Bouton suppression */}
            <button
              onClick={() => handleDelete(selectedCharacter.id, selectedCharacter.name)}
              disabled={deleting}
              className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold transition mb-4"
            >
              {deleting ? '⏳ Suppression...' : '🗑️ Supprimer ce personnage'}
            </button>

            {/* User ID */}
            <div className="text-xs text-gray-500 text-center">
              User ID: {selectedCharacter.userId}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
