import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllCharacters, deleteCharacter, updateCharacterImage, toggleCharacterDisabled } from '../services/characterService';
import { envoyerAnnonceDiscord } from '../services/discordService';
import { simulerTournoiTest } from '../services/tournamentService';
import Header from './Header';
import borderImage from '../assets/backgrounds/border.png';

const Admin = () => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // États pour l'upload d'image
  const [uploadedImage, setUploadedImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // États pour les annonces Discord
  const [annonceTitre, setAnnonceTitre] = useState('');
  const [annonceMessage, setAnnonceMessage] = useState('');
  const [annonceMention, setAnnonceMention] = useState(false);
  const [annonceEnvoi, setAnnonceEnvoi] = useState(false);
  const [annonceSucces, setAnnonceSucces] = useState(false);

  // États pour la simulation de tournoi
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);

  // Onglet actif/désactivé
  const [adminTab, setAdminTab] = useState('actifs');

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

  // Fonction pour charger/recharger les personnages
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

  useEffect(() => {
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

  // Fonction pour gérer l'upload d'image
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Vérifier que c'est une image
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image valide');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target.result);
      setProcessedImage(null);
    };
    reader.readAsDataURL(file);
  };

  // Fonction pour superposer la bordure sur l'image
  const processImageWithBorder = () => {
    if (!uploadedImage) return;

    setProcessingImage(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Charger l'image uploadée
    const userImg = new Image();
    userImg.onload = () => {
      // Charger l'image de bordure
      const border = new Image();
      border.onload = () => {
        // Limiter la taille max pour éviter les images trop lourdes
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 900;

        // Calculer le ratio pour respecter les proportions de la bordure
        const borderRatio = border.width / border.height;
        let targetWidth = Math.min(border.width, MAX_WIDTH);
        let targetHeight = targetWidth / borderRatio;

        if (targetHeight > MAX_HEIGHT) {
          targetHeight = MAX_HEIGHT;
          targetWidth = targetHeight * borderRatio;
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Calculer les dimensions pour que l'image remplisse le canvas
        const scale = Math.max(targetWidth / userImg.width, targetHeight / userImg.height);
        const scaledWidth = userImg.width * scale;
        const scaledHeight = userImg.height * scale;
        const offsetX = (targetWidth - scaledWidth) / 2;
        const offsetY = (targetHeight - scaledHeight) / 2;

        // Dessiner l'image uploadée (en arrière-plan, redimensionnée pour couvrir)
        ctx.drawImage(userImg, offsetX, offsetY, scaledWidth, scaledHeight);

        // Superposer la bordure par-dessus
        ctx.drawImage(border, 0, 0, targetWidth, targetHeight);

        // Convertir en JPEG avec compression (qualité 0.85)
        const resultDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setProcessedImage(resultDataUrl);
        setProcessingImage(false);
      };
      border.src = borderImage;
    };
    userImg.src = uploadedImage;
  };

  // Fonction pour télécharger l'image résultante
  const downloadProcessedImage = () => {
    if (!processedImage || !selectedCharacter) return;

    const link = document.createElement('a');
    link.download = `${selectedCharacter.name}-with-border.png`;
    link.href = processedImage;
    link.click();
  };

  // Fonction pour sauvegarder l'image dans Firebase Storage
  const saveImageToCharacter = async () => {
    if (!processedImage || !selectedCharacter) return;

    setSavingImage(true);
    const result = await updateCharacterImage(selectedCharacter.id, processedImage);

    if (result.success) {
      // Recharger les données depuis Firestore pour avoir l'URL correcte
      await loadCharacters();
      // Fermer le modal et réinitialiser
      setSelectedCharacter(null);
      resetUpload();
      alert('Image sauvegardée avec succès !');
    } else {
      alert('Erreur lors de la sauvegarde: ' + result.error);
    }

    setSavingImage(false);
  };

  // Réinitialiser l'upload
  const resetUpload = () => {
    setUploadedImage(null);
    setProcessedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Envoi d'annonce Discord
  const handleEnvoyerAnnonce = async () => {
    if (!annonceTitre.trim() || !annonceMessage.trim()) return;

    setAnnonceEnvoi(true);
    setAnnonceSucces(false);

    try {
      await envoyerAnnonceDiscord({
        titre: annonceTitre.trim(),
        message: annonceMessage.trim(),
        mentionEveryone: annonceMention
      });
      setAnnonceSucces(true);
      setAnnonceTitre('');
      setAnnonceMessage('');
      setAnnonceMention(false);
      setTimeout(() => setAnnonceSucces(false), 3000);
    } catch (err) {
      alert('Erreur envoi Discord: ' + err.message);
    }

    setAnnonceEnvoi(false);
  };

  // Simulation de tournoi test
  const handleSimulerTournoi = async () => {
    setSimulationLoading(true);
    setSimulationResult(null);
    const result = await simulerTournoiTest();
    setSimulationResult(result);
    setSimulationLoading(false);
  };

  // Activer/désactiver un personnage
  const handleToggleDisabled = async (char) => {
    const newState = !char.disabled;
    const result = await toggleCharacterDisabled(char.id, newState);
    if (result.success) {
      setCharacters(prev => prev.map(c =>
        c.id === char.id ? { ...c, disabled: newState } : c
      ));
      if (selectedCharacter?.id === char.id) {
        setSelectedCharacter({ ...selectedCharacter, disabled: newState });
      }
    } else {
      alert('Erreur: ' + result.error);
    }
  };

  // Réinitialiser l'upload quand on change de personnage
  const handleSelectCharacter = (char) => {
    setSelectedCharacter(char);
    resetUpload();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Header />
        <div className="bg-red-900/50 border-2 border-red-500 rounded-lg p-6 max-w-md">
          <p className="text-red-300 text-center">Erreur: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-7xl mx-auto pt-20">
        <div className="text-center mb-8">
          <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block">
            <h1 className="text-5xl font-bold mb-4 text-stone-300">🎯 Backoffice Admin</h1>
            <p className="text-stone-400 text-lg">
              {characters.filter(c => !c.disabled).length} actif{characters.filter(c => !c.disabled).length > 1 ? 's' : ''} • {characters.filter(c => c.disabled).length} désactivé{characters.filter(c => c.disabled).length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Section Annonces Discord */}
        <div className="bg-stone-900/70 border-2 border-indigo-500 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-indigo-300 mb-4">📢 Annonce Discord</h2>

          <div className="space-y-4">
            <div>
              <label className="text-stone-400 text-sm block mb-1">Titre</label>
              <input
                type="text"
                value={annonceTitre}
                onChange={(e) => setAnnonceTitre(e.target.value)}
                placeholder="Ex: Mise à jour v2.0"
                className="w-full bg-stone-800 border border-stone-600 text-white px-4 py-2 rounded-lg focus:border-indigo-400 focus:outline-none"
                maxLength={256}
              />
            </div>

            <div>
              <label className="text-stone-400 text-sm block mb-1">Message</label>
              <textarea
                value={annonceMessage}
                onChange={(e) => setAnnonceMessage(e.target.value)}
                placeholder="Contenu de l'annonce..."
                rows={4}
                className="w-full bg-stone-800 border border-stone-600 text-white px-4 py-2 rounded-lg focus:border-indigo-400 focus:outline-none resize-none"
                maxLength={4096}
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={annonceMention}
                  onChange={(e) => setAnnonceMention(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500"
                />
                <span className="text-stone-300 text-sm">Mentionner @everyone</span>
              </label>
            </div>

            <button
              onClick={handleEnvoyerAnnonce}
              disabled={annonceEnvoi || !annonceTitre.trim() || !annonceMessage.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-stone-700 disabled:text-stone-500 text-white py-3 rounded-lg font-bold transition"
            >
              {annonceEnvoi ? '⏳ Envoi en cours...' : annonceSucces ? '✅ Envoyé !' : '📤 Envoyer sur Discord'}
            </button>
          </div>
        </div>

        {/* Section Simulation Tournoi */}
        <div className="bg-stone-900/70 border-2 border-amber-500 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-amber-300 mb-4">🏆 Simulation de Tournoi</h2>
          <p className="text-stone-400 text-sm mb-4">Simule un tournoi complet avec tous les personnages disponibles. Aucune donnée n'est sauvegardée, pas d'annonce Discord.</p>

          <button
            onClick={handleSimulerTournoi}
            disabled={simulationLoading}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500 text-white py-3 rounded-lg font-bold transition mb-4"
          >
            {simulationLoading ? '⏳ Simulation en cours...' : '🎲 Simuler un tournoi'}
          </button>

          {simulationResult && !simulationResult.success && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
              <p className="text-red-300">{simulationResult.error}</p>
            </div>
          )}

          {simulationResult && simulationResult.success && (
            <div className="space-y-4">
              {/* Champion */}
              <div className="bg-gradient-to-r from-yellow-900/50 via-amber-800/50 to-yellow-900/50 border-2 border-yellow-500 p-6 rounded-xl text-center">
                <div className="text-4xl mb-2">👑</div>
                {simulationResult.champion?.characterImage && (
                  <img src={simulationResult.champion.characterImage} alt={simulationResult.champion.nom} className="w-24 h-auto mx-auto mb-2 object-contain" />
                )}
                <h3 className="text-2xl font-bold text-yellow-300">{simulationResult.champion?.nom}</h3>
                <p className="text-amber-300 text-sm">{simulationResult.champion?.race} • {simulationResult.champion?.classe}</p>
                <p className="text-stone-400 text-xs mt-2">
                  {simulationResult.nbParticipants} participants • {simulationResult.nbMatchs} matchs joués
                </p>
              </div>

              {/* Liste des matchs */}
              <div className="bg-stone-800/80 border border-stone-600 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                <h4 className="text-stone-300 font-bold mb-3">Résultats des matchs</h4>
                <div className="space-y-2">
                  {simulationResult.resultatsMatchs.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-sm bg-stone-900/50 p-2 rounded border border-stone-700 cursor-pointer hover:border-amber-500 hover:bg-stone-800/80 transition"
                      onClick={() => setSelectedMatch(m)}
                    >
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        m.bracket === 'winners' ? 'bg-amber-900/50 text-amber-300' :
                        m.bracket === 'losers' ? 'bg-red-900/50 text-red-300' :
                        'bg-yellow-900/50 text-yellow-300'
                      }`}>
                        {m.roundLabel}
                      </span>
                      <span className={m.winnerNom === m.p1Nom ? 'text-green-400 font-bold' : 'text-stone-400'}>{m.p1Nom}</span>
                      <span className="text-stone-600">vs</span>
                      <span className={m.winnerNom === m.p2Nom ? 'text-green-400 font-bold' : 'text-stone-400'}>{m.p2Nom}</span>
                      <span className="text-stone-500 text-xs ml-auto">🔍 {m.nbTours} tours</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Canvas caché pour le traitement */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Onglets Actifs / Désactivés */}
        {(() => {
          const activeChars = characters.filter(c => !c.disabled);
          const disabledChars = characters.filter(c => c.disabled);
          const displayedChars = adminTab === 'actifs' ? activeChars : disabledChars;

          return (
            <>
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setAdminTab('actifs')}
                  className={`flex-1 py-3 rounded-lg font-bold text-lg transition border-2 ${
                    adminTab === 'actifs'
                      ? 'bg-amber-600 border-amber-400 text-white'
                      : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-500'
                  }`}
                >
                  Actifs ({activeChars.length})
                </button>
                <button
                  onClick={() => setAdminTab('desactives')}
                  className={`flex-1 py-3 rounded-lg font-bold text-lg transition border-2 ${
                    adminTab === 'desactives'
                      ? 'bg-red-600 border-red-400 text-white'
                      : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-500'
                  }`}
                >
                  Désactivés ({disabledChars.length})
                </button>
              </div>

              {displayedChars.length === 0 ? (
                <div className="bg-stone-800/50 rounded-xl p-8 border-2 border-amber-600 text-center">
                  <p className="text-gray-400 text-xl">
                    {adminTab === 'actifs' ? 'Aucun personnage actif' : 'Aucun personnage désactivé'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedChars.map((char) => (
                    <div
                      key={char.id}
                      className={`bg-stone-800/90 rounded-xl p-6 border-2 shadow-xl hover:shadow-2xl transition-shadow cursor-pointer ${
                        char.disabled ? 'border-red-600' : 'border-amber-600'
                      }`}
                      onClick={() => handleSelectCharacter(char)}
                    >
                      {/* Image du personnage si elle existe */}
                      {char.characterImage && (
                        <div className="mb-4 -mx-2 -mt-2">
                          <img
                            src={char.characterImage}
                            alt={char.name}
                            className="w-full object-contain rounded-t-lg bg-stone-900"
                            style={{ maxHeight: '280px' }}
                          />
                        </div>
                      )}

                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-4xl">{races[char.race] || '❓'}</span>
                          <span className="text-4xl">{classes[char.class] || '❓'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {char.characterImage && <span className="text-green-400 text-xs">🖼️</span>}
                          <span className="text-amber-400 text-xs">
                            {char.gender === 'male' ? '👨' : '👩'}
                          </span>
                        </div>
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
                          handleSelectCharacter(char);
                        }}
                        className="mt-4 w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded transition"
                      >
                        {char.characterImage ? 'Modifier l\'image' : 'Ajouter une image'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}

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
          onClick={() => { setSelectedCharacter(null); resetUpload(); }}
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
                onClick={() => { setSelectedCharacter(null); resetUpload(); }}
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

            {/* Section Upload d'image */}
            <div className="bg-stone-900/50 rounded-lg p-4 border-2 border-amber-600 mb-4">
              <p className="text-amber-400 font-bold mb-3">🖼️ Image du personnage:</p>

              {/* Image actuelle */}
              {selectedCharacter.characterImage && !processedImage && (
                <div className="mb-4 text-center">
                  <img
                    src={selectedCharacter.characterImage}
                    alt={selectedCharacter.name}
                    className="max-h-64 mx-auto rounded-lg shadow-lg"
                  />
                  <p className="text-green-400 text-sm mt-2">Image actuelle</p>
                </div>
              )}

              {/* Zone d'upload */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
                id="character-image-upload"
              />

              {!uploadedImage && !processedImage && (
                <label
                  htmlFor="character-image-upload"
                  className="block w-full p-6 border-2 border-dashed border-amber-500/50 rounded-lg cursor-pointer hover:border-amber-400 hover:bg-stone-700/30 transition text-center"
                >
                  <span className="text-3xl mb-2 block">📤</span>
                  <p className="text-amber-300">Cliquez pour uploader une image</p>
                  <p className="text-gray-500 text-sm mt-1">PNG, JPG, WEBP...</p>
                </label>
              )}

              {/* Image uploadée (avant traitement) */}
              {uploadedImage && !processedImage && (
                <div className="space-y-3">
                  <div className="text-center">
                    <img
                      src={uploadedImage}
                      alt="Image uploadée"
                      className="max-h-48 mx-auto rounded-lg"
                    />
                    <p className="text-gray-400 text-sm mt-2">Image originale</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={processImageWithBorder}
                      disabled={processingImage}
                      className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 text-white py-2 rounded font-bold transition"
                    >
                      {processingImage ? '⏳ Traitement...' : '✨ Appliquer la bordure'}
                    </button>
                    <button
                      onClick={resetUpload}
                      className="bg-stone-600 hover:bg-stone-500 text-white px-4 py-2 rounded transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Image traitée (après bordure) */}
              {processedImage && (
                <div className="space-y-3">
                  <div className="text-center">
                    <img
                      src={processedImage}
                      alt="Image avec bordure"
                      className="max-h-64 mx-auto rounded-lg shadow-lg"
                    />
                    <p className="text-green-400 text-sm mt-2">Aperçu avec bordure</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveImageToCharacter}
                      disabled={savingImage}
                      className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white py-2 rounded font-bold transition"
                    >
                      {savingImage ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
                    </button>
                    <button
                      onClick={downloadProcessedImage}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition"
                      title="Télécharger"
                    >
                      📥
                    </button>
                    <button
                      onClick={resetUpload}
                      className="bg-stone-600 hover:bg-stone-500 text-white px-4 py-2 rounded transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bouton activer/désactiver */}
            <button
              onClick={() => handleToggleDisabled(selectedCharacter)}
              className={`w-full py-3 rounded-lg font-bold transition mb-4 ${
                selectedCharacter.disabled
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              }`}
            >
              {selectedCharacter.disabled ? '✅ Réactiver ce personnage' : '🚫 Désactiver ce personnage'}
            </button>

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

      {/* Modal combat log simulation */}
      {selectedMatch && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedMatch(null)}
        >
          <div
            className="bg-stone-800 rounded-2xl border-4 border-amber-600 max-w-2xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-stone-900 p-4 rounded-t-xl border-b border-stone-600 flex items-center justify-between">
              <div>
                <div className="text-xs text-stone-500 mb-1">{selectedMatch.roundLabel}</div>
                <h2 className="text-lg font-bold text-white">
                  <span className="text-blue-400">{selectedMatch.p1Nom}</span>
                  <span className="text-stone-500 mx-2">vs</span>
                  <span className="text-purple-400">{selectedMatch.p2Nom}</span>
                </h2>
              </div>
              <button
                onClick={() => setSelectedMatch(null)}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Combat log */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedMatch.combatLog.map((log, idx) => {
                const isP1 = log.startsWith('[P1]');
                const isP2 = log.startsWith('[P2]');
                const cleanLog = log.replace(/^\[P[12]\]\s*/, '');

                if (!isP1 && !isP2) {
                  if (log.includes('🏆')) {
                    return (
                      <div key={idx} className="flex justify-center my-4">
                        <div className="bg-stone-100 text-stone-900 px-6 py-3 font-bold text-base shadow-lg border border-stone-400 rounded">
                          {cleanLog}
                        </div>
                      </div>
                    );
                  }
                  if (log.includes('---')) {
                    return (
                      <div key={idx} className="flex justify-center my-3">
                        <div className="bg-stone-700 text-stone-200 px-4 py-1 text-sm font-bold border border-stone-500 rounded">
                          {cleanLog}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="flex justify-center">
                      <div className="text-stone-400 text-sm italic">{cleanLog}</div>
                    </div>
                  );
                }

                if (isP1) {
                  return (
                    <div key={idx} className="flex justify-start">
                      <div className="max-w-[85%] bg-stone-700 text-stone-200 px-3 py-2 shadow-lg border-l-4 border-blue-500 rounded">
                        <div className="text-xs md:text-sm">{cleanLog}</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="flex justify-end">
                    <div className="max-w-[85%] bg-stone-700 text-stone-200 px-3 py-2 shadow-lg border-r-4 border-purple-500 rounded">
                      <div className="text-xs md:text-sm">{cleanLog}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="bg-stone-900 p-3 rounded-b-xl border-t border-stone-600 text-center">
              <span className="text-green-400 font-bold">🏆 {selectedMatch.winnerNom}</span>
              <span className="text-stone-500 text-sm ml-2">remporte le match en {selectedMatch.nbTours} tours</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
