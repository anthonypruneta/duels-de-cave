import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllCharacters, deleteCharacter, updateCharacterImage, updateArchivedCharacterImage, toggleCharacterDisabled, updateCharacterForestBoosts, updateCharacterMageTowerPassive, updateCharacterEquippedWeapon, updateCharacterLevel, migrateForestHpBoosts } from '../services/characterService';
import { grantDungeonRunsToAllPlayers, resetDungeonRuns } from '../services/dungeonService';
import { envoyerAnnonceDiscord } from '../services/discordService';
import { creerTournoi, lancerTournoi, getAllArchivedCharacters } from '../services/tournamentService';
import {
  ensureWeeklyInfiniteLabyrinth,
  generateWeeklyInfiniteLabyrinth,
  getCurrentWeekId,
  getUserLabyrinthProgress,
  launchLabyrinthCombat,
  resetUserLabyrinthProgress,
  resetWeeklyInfiniteLabyrinthEnemyPool
} from '../services/infiniteLabyrinthService';
import Header from './Header';
import borderImage from '../assets/backgrounds/border.png';
import { races as racesData } from '../data/races';
import { classes as classesData } from '../data/classes';
import WorldBossAdmin from './WorldBossAdmin';

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
  const labyrinthAudioRef = useRef(null);
  const labyrinthReplayTokenRef = useRef(null);
  const labyrinthReplayTimeoutRef = useRef(null);

  // États pour les annonces Discord
  const [annonceTitre, setAnnonceTitre] = useState('');
  const [annonceMessage, setAnnonceMessage] = useState('');
  const [annonceMention, setAnnonceMention] = useState(false);
  const [annonceEnvoi, setAnnonceEnvoi] = useState(false);
  const [annonceSucces, setAnnonceSucces] = useState(false);
  const [annonceImage, setAnnonceImage] = useState(null);
  const [annonceImagePreview, setAnnonceImagePreview] = useState(null);

  // États pour ajout global d'essais de donjon
  const [dungeonAttemptsToGrant, setDungeonAttemptsToGrant] = useState(1);
  const [dungeonGrantMessage, setDungeonGrantMessage] = useState('');
  const [dungeonGrantLoading, setDungeonGrantLoading] = useState(false);

  // État pour la simulation de tournoi
  const [simulationLoading, setSimulationLoading] = useState(false);

  // État pour le reset de progression
  const [resetProgressionLoading, setResetProgressionLoading] = useState(false);

  // État pour la migration HP forêt
  const [migrationHpLoading, setMigrationHpLoading] = useState(false);
  const [migrationHpResult, setMigrationHpResult] = useState(null);

  // État pour le tirage manuel du tournoi
  const [tirageLoading, setTirageLoading] = useState(false);

  // Personnages archivés
  const [archivedCharacters, setArchivedCharacters] = useState([]);

  // Onglet actif/désactivé
  const [adminTab, setAdminTab] = useState('actifs');

  const [labyrinthWeekId, setLabyrinthWeekId] = useState(getCurrentWeekId());
  const [labyrinthData, setLabyrinthData] = useState(null);
  const [labyrinthProgress, setLabyrinthProgress] = useState(null);
  const [labyrinthLoading, setLabyrinthLoading] = useState(false);
  const [selectedLabFloor, setSelectedLabFloor] = useState(1);
  const [labyrinthCombatResult, setLabyrinthCombatResult] = useState(null);
  const [labyrinthCombatLogs, setLabyrinthCombatLogs] = useState([]);
  const [labyrinthError, setLabyrinthError] = useState('');
  const [labyrinthMusicEnabled, setLabyrinthMusicEnabled] = useState(false);
  const [selectedLabUserId, setSelectedLabUserId] = useState('');
  const [isLabyrinthReplayOpen, setIsLabyrinthReplayOpen] = useState(false);
  const [isLabyrinthReplayAnimating, setIsLabyrinthReplayAnimating] = useState(false);
  const [labyrinthReplayLogs, setLabyrinthReplayLogs] = useState([]);
  const [labyrinthReplayP1Name, setLabyrinthReplayP1Name] = useState('');
  const [labyrinthReplayP2Name, setLabyrinthReplayP2Name] = useState('');
  const [labyrinthReplayP1HP, setLabyrinthReplayP1HP] = useState(0);
  const [labyrinthReplayP2HP, setLabyrinthReplayP2HP] = useState(0);
  const [labyrinthReplayP1MaxHP, setLabyrinthReplayP1MaxHP] = useState(0);
  const [labyrinthReplayP2MaxHP, setLabyrinthReplayP2MaxHP] = useState(0);
  const [labyrinthReplayWinner, setLabyrinthReplayWinner] = useState('');

  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const races = Object.fromEntries(Object.entries(racesData).map(([k, v]) => [k, v.icon]));
  const classes = Object.fromEntries(Object.entries(classesData).map(([k, v]) => [k, v.icon]));

  // Fonction pour charger/recharger les personnages
  const loadCharacters = async () => {
    setLoading(true);
    const [result, archivedResult] = await Promise.all([
      getAllCharacters(),
      getAllArchivedCharacters()
    ]);

    if (result.success) {
      setCharacters(result.data);
      console.log('Personnages chargés dans Admin:', result.data);
    } else {
      setError(result.error);
      console.error('Erreur chargement personnages:', result.error);
    }

    if (archivedResult.success) {
      setArchivedCharacters(archivedResult.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadCharacters();
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const bootstrapLabyrinth = async () => {
      setLabyrinthLoading(true);
      setLabyrinthError('');
      try {
        const weekId = getCurrentWeekId();
        setLabyrinthWeekId(weekId);
        const labyrinthResult = await ensureWeeklyInfiniteLabyrinth(weekId);
        if (labyrinthResult.success) {
          setLabyrinthData(labyrinthResult.data);
        } else {
          setLabyrinthError(labyrinthResult.error || 'Impossible de charger le Labyrinthe Infini.');
        }
      } finally {
        setLabyrinthLoading(false);
      }
    };
    bootstrapLabyrinth();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid || selectedLabUserId) return;
    const ownCharacter = characters.find((char) => char.id === currentUser.uid);
    if (ownCharacter?.id) {
      setSelectedLabUserId(ownCharacter.id);
      return;
    }
    if (currentUser.uid) {
      setSelectedLabUserId(currentUser.uid);
      return;
    }
    if (characters.length > 0) {
      setSelectedLabUserId(characters[0].id);
    }
  }, [characters, currentUser?.uid, selectedLabUserId]);

  useEffect(() => {
    if (!selectedLabUserId) return;

    const loadProgress = async () => {
      setLabyrinthLoading(true);
      setLabyrinthError('');
      try {
        const weekId = labyrinthWeekId || getCurrentWeekId();
        const progressResult = await getUserLabyrinthProgress(selectedLabUserId, weekId);
        if (progressResult.success) {
          setLabyrinthProgress(progressResult.data);
          setSelectedLabFloor(progressResult.data.currentFloor || 1);
          setLabyrinthCombatResult(null);
          setLabyrinthCombatLogs([]);
        } else {
          setLabyrinthError(progressResult.error || 'Impossible de charger la progression du joueur sélectionné.');
        }
      } finally {
        setLabyrinthLoading(false);
      }
    };

    loadProgress();
  }, [labyrinthWeekId, selectedLabUserId]);

  useEffect(() => () => {
    const audio = labyrinthAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    if (labyrinthReplayTokenRef.current) {
      labyrinthReplayTokenRef.current.cancelled = true;
    }
    if (labyrinthReplayTimeoutRef.current) {
      clearTimeout(labyrinthReplayTimeoutRef.current);
      labyrinthReplayTimeoutRef.current = null;
    }
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
    const isArchived = selectedCharacter._source === 'archived';
    const result = isArchived
      ? await updateArchivedCharacterImage(selectedCharacter.id, processedImage)
      : await updateCharacterImage(selectedCharacter.id, processedImage);

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

  // Gestion image collée pour Discord
  const handlePasteImage = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        setAnnonceImage(blob);
        setAnnonceImagePreview(URL.createObjectURL(blob));
        return;
      }
    }
  };

  const handleDropImage = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setAnnonceImage(file);
      setAnnonceImagePreview(URL.createObjectURL(file));
    }
  };

  const supprimerAnnonceImage = () => {
    if (annonceImagePreview) URL.revokeObjectURL(annonceImagePreview);
    setAnnonceImage(null);
    setAnnonceImagePreview(null);
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
        mentionEveryone: annonceMention,
        imageBlob: annonceImage
      });
      setAnnonceSucces(true);
      setAnnonceTitre('');
      setAnnonceMessage('');
      setAnnonceMention(false);
      supprimerAnnonceImage();
      setTimeout(() => setAnnonceSucces(false), 3000);
    } catch (err) {
      alert('Erreur envoi Discord: ' + err.message);
    }

    setAnnonceEnvoi(false);
  };

  // Démarrer l'event : créer le tirage + lancer le tournoi + rediriger
  const handleDemarrerEvent = async () => {
    if (!confirm('Démarrer l\'event maintenant avec tous les personnages actifs ? Cela écrasera tout tournoi existant.')) return;
    setTirageLoading(true);
    const createResult = await creerTournoi('current');
    if (!createResult.success) {
      alert('❌ Erreur création: ' + createResult.error);
      setTirageLoading(false);
      return;
    }
    const launchResult = await lancerTournoi('current');
    if (!launchResult.success) {
      alert('❌ Erreur lancement: ' + launchResult.error);
      setTirageLoading(false);
      return;
    }
    setTirageLoading(false);
    navigate('/tournament');
  };

  // Simulation de tournoi en direct
  const handleSimulerTournoi = async () => {
    setSimulationLoading(true);
    const createResult = await creerTournoi('simulation');
    if (!createResult.success) {
      alert('Erreur création simulation: ' + createResult.error);
      setSimulationLoading(false);
      return;
    }
    const launchResult = await lancerTournoi('simulation');
    if (!launchResult.success) {
      alert('Erreur lancement simulation: ' + launchResult.error);
      setSimulationLoading(false);
      return;
    }
    setSimulationLoading(false);
    navigate('/tournament?mode=simulation');
  };

  const handleGrantDungeonRuns = async () => {
    const attempts = Number(dungeonAttemptsToGrant);
    const message = dungeonGrantMessage.trim();

    if (!Number.isFinite(attempts) || attempts <= 0) {
      alert('Le nombre d\'essais doit être supérieur à 0.');
      return;
    }

    if (!message) {
      alert('Le message est obligatoire.');
      return;
    }

    const confirmMessage = `Ajouter ${attempts} essai${attempts > 1 ? 's' : ''} de donjon à tous les joueurs ?`;
    if (!window.confirm(confirmMessage)) return;

    setDungeonGrantLoading(true);
    const result = await grantDungeonRunsToAllPlayers({
      attempts,
      message,
      adminEmail: currentUser?.email || null
    });

    if (result.success) {
      alert(`✅ ${attempts} essai${attempts > 1 ? 's' : ''} ajouté${attempts > 1 ? 's' : ''} à ${result.affectedPlayers} joueur${result.affectedPlayers > 1 ? 's' : ''}.`);
      setDungeonGrantMessage('');
      setDungeonAttemptsToGrant(1);
    } else {
      alert('Erreur lors de l\'ajout global: ' + result.error);
    }

    setDungeonGrantLoading(false);
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

  // Reset complet de la progression d'un personnage (donjon, labyrinthe, récompenses)
  const handleResetProgression = async (char) => {
    const confirmMsg = `Réinitialiser TOUTE la progression de "${char.name}" ?\n\n` +
      '- Progression donjon (grotte, forêt, tour du mage)\n' +
      '- Arme équipée\n' +
      '- Boosts de forêt\n' +
      '- Passif tour du mage\n' +
      '- Niveau\n' +
      '- Progression labyrinthe\n\n' +
      'Cette action est irréversible !';

    if (!window.confirm(confirmMsg)) return;

    setResetProgressionLoading(true);
    try {
      const userId = char.id;

      const results = await Promise.all([
        resetDungeonRuns(userId),
        resetUserLabyrinthProgress(userId),
        updateCharacterForestBoosts(userId, null),
        updateCharacterMageTowerPassive(userId, null),
        updateCharacterEquippedWeapon(userId, null),
        updateCharacterLevel(userId, 1),
      ]);

      const allSuccess = results.every(r => r.success);

      if (allSuccess) {
        alert(`Progression de "${char.name}" réinitialisée avec succès !`);
      } else {
        const failed = results.filter(r => !r.success);
        alert(`Progression partiellement réinitialisée. ${failed.length} opération(s) ont échoué.`);
      }
    } catch (error) {
      alert('Erreur lors du reset: ' + error.message);
    } finally {
      setResetProgressionLoading(false);
    }
  };

  const handleGenerateLabyrinth = async () => {
    setLabyrinthLoading(true);
    setLabyrinthError('');
    try {
      const weekId = getCurrentWeekId();
      const generated = await generateWeeklyInfiniteLabyrinth(weekId);
      if (generated.success) {
        setLabyrinthWeekId(weekId);
        setLabyrinthData(generated.labyrinth);
        alert('✅ Labyrinthe infini hebdomadaire généré.');
      } else {
        setLabyrinthError(generated.error || 'Erreur génération labyrinthe.');
        alert('❌ ' + (generated.error || 'Erreur génération labyrinthe.'));
      }
    } finally {
      setLabyrinthLoading(false);
    }
  };

  const handleResetLabyrinthEnemyPool = async () => {
    setLabyrinthLoading(true);
    setLabyrinthError('');
    try {
      const weekId = labyrinthWeekId || getCurrentWeekId();
      const resetPoolResult = await resetWeeklyInfiniteLabyrinthEnemyPool(weekId);
      if (resetPoolResult.success) {
        setLabyrinthData(resetPoolResult.labyrinth);
        setLabyrinthWeekId(weekId);
        setLabyrinthCombatResult(null);
        setLabyrinthCombatLogs([]);
        alert("✅ Pool d'ennemis du labyrinthe régénéré (boss uniques reroll).");
      } else {
        setLabyrinthError(resetPoolResult.error || 'Erreur reset pool ennemis.');
        alert('❌ ' + (resetPoolResult.error || 'Erreur reset pool ennemis.'));
      }
    } finally {
      setLabyrinthLoading(false);
    }
  };

  const handleResetMyLabyrinthProgress = async () => {
    if (!selectedLabUserId) return;
    setLabyrinthLoading(true);
    setLabyrinthError('');
    try {
      const weekId = labyrinthWeekId || getCurrentWeekId();
      const reset = await resetUserLabyrinthProgress(selectedLabUserId, weekId);
      if (reset.success) {
        const progress = await getUserLabyrinthProgress(selectedLabUserId, weekId);
        if (progress.success) {
          setLabyrinthProgress(progress.data);
          setSelectedLabFloor(progress.data.currentFloor || 1);
        }
        setLabyrinthCombatResult(null);
        setLabyrinthCombatLogs([]);
        alert('✅ Progression labyrinthe réinitialisée pour le personnage sélectionné.');
      }
    } finally {
      setLabyrinthLoading(false);
    }
  };

  const handleLaunchLabyrinthCombat = async (floorOverride = null) => {
    if (!selectedLabUserId) return;
    setLabyrinthLoading(true);
    setLabyrinthError('');
    try {
      const result = await launchLabyrinthCombat({
        userId: selectedLabUserId,
        floorNumber: floorOverride || Number(selectedLabFloor),
        weekId: labyrinthWeekId
      });
      if (!result.success) {
        setLabyrinthError(result.error || 'Erreur combat labyrinthe.');
        alert('Erreur combat labyrinthe: ' + result.error);
        return;
      }
      setLabyrinthCombatResult(result);
      setLabyrinthCombatLogs(result.result.combatLog || []);
      setLabyrinthProgress(result.progress);
      setSelectedLabFloor(result.progress.currentFloor || 1);
      playLabyrinthCombatReplay(result);
    } finally {
      setLabyrinthLoading(false);
    }
  };

  const selectedLabCharacter = characters.find((char) => char.id === selectedLabUserId) || null;

  const delayLabReplay = (ms) => new Promise((resolve) => {
    labyrinthReplayTimeoutRef.current = setTimeout(resolve, ms);
  });

  const closeLabyrinthReplay = () => {
    if (labyrinthReplayTokenRef.current) {
      labyrinthReplayTokenRef.current.cancelled = true;
    }
    if (labyrinthReplayTimeoutRef.current) {
      clearTimeout(labyrinthReplayTimeoutRef.current);
      labyrinthReplayTimeoutRef.current = null;
    }
    setIsLabyrinthReplayAnimating(false);
    setIsLabyrinthReplayOpen(false);
  };

  const playLabyrinthCombatReplay = async (combatResult) => {
    if (!combatResult?.result) return;

    if (labyrinthReplayTokenRef.current) {
      labyrinthReplayTokenRef.current.cancelled = true;
    }
    if (labyrinthReplayTimeoutRef.current) {
      clearTimeout(labyrinthReplayTimeoutRef.current);
      labyrinthReplayTimeoutRef.current = null;
    }

    const token = { cancelled: false };
    labyrinthReplayTokenRef.current = token;

    const playerName = selectedLabCharacter?.name || 'Joueur';
    const enemyName = combatResult.floor?.enemyName || 'Ennemi';
    const data = combatResult.result;

    setIsLabyrinthReplayOpen(true);
    setIsLabyrinthReplayAnimating(true);
    setLabyrinthReplayLogs([]);
    setLabyrinthReplayWinner('');
    setLabyrinthReplayP1Name(playerName);
    setLabyrinthReplayP2Name(enemyName);
    setLabyrinthReplayP1MaxHP(data.p1MaxHP || 0);
    setLabyrinthReplayP2MaxHP(data.p2MaxHP || 0);
    setLabyrinthReplayP1HP(data.p1MaxHP || 0);
    setLabyrinthReplayP2HP(data.p2MaxHP || 0);

    const steps = data.steps || [];
    if (steps.length > 0) {
      for (const step of steps) {
        if (token.cancelled) return;
        const logs = step.logs || [];
        for (const line of logs) {
          if (token.cancelled) return;
          setLabyrinthReplayLogs((prev) => [...prev, line]);
          await delayLabReplay(step.phase === 'victory' ? 200 : 280);
        }
        setLabyrinthReplayP1HP(step.p1HP ?? 0);
        setLabyrinthReplayP2HP(step.p2HP ?? 0);
        await delayLabReplay(step.phase === 'action' ? 600 : 400);
      }
    } else {
      const combatLog = data.combatLog || [];
      for (const line of combatLog) {
        if (token.cancelled) return;
        setLabyrinthReplayLogs((prev) => [...prev, line]);
        await delayLabReplay(line.includes('---') ? 450 : 250);
      }
    }

    if (token.cancelled) return;

    setLabyrinthReplayWinner(data.winnerNom || (combatResult.didWin ? playerName : enemyName));
    setIsLabyrinthReplayAnimating(false);
  };

  const handleToggleLabyrinthMusic = async () => {
    const audio = labyrinthAudioRef.current;
    if (!audio) return;

    if (labyrinthMusicEnabled) {
      audio.pause();
      setLabyrinthMusicEnabled(false);
      return;
    }

    audio.volume = 0.35;
    audio.loop = true;
    try {
      await audio.play();
      setLabyrinthMusicEnabled(true);
    } catch (error) {
      setLabyrinthError('Impossible de lancer la musique Labyrinthe (autoplay bloqué par le navigateur).');
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
                onPaste={handlePasteImage}
                placeholder="Contenu de l'annonce... (Ctrl+V pour coller une image)"
                rows={4}
                className="w-full bg-stone-800 border border-stone-600 text-white px-4 py-2 rounded-lg focus:border-indigo-400 focus:outline-none resize-none"
                maxLength={4096}
              />
            </div>

            {/* Zone image : collage, drag & drop, ou preview */}
            <div
              onPaste={handlePasteImage}
              onDrop={handleDropImage}
              onDragOver={(e) => e.preventDefault()}
              className={`border-2 border-dashed rounded-lg p-4 text-center transition ${annonceImagePreview ? 'border-indigo-400 bg-indigo-900/20' : 'border-stone-600 hover:border-stone-500'}`}
            >
              {annonceImagePreview ? (
                <div className="relative inline-block">
                  <img src={annonceImagePreview} alt="Preview" className="max-h-48 rounded-lg mx-auto" />
                  <button
                    onClick={supprimerAnnonceImage}
                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white w-6 h-6 rounded-full text-sm font-bold leading-none"
                  >
                    ×
                  </button>
                  <p className="text-indigo-300 text-xs mt-2">Image jointe</p>
                </div>
              ) : (
                <p className="text-stone-500 text-sm">
                  📷 Coller une image (Ctrl+V) ou glisser-déposer ici
                </p>
              )}
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

        {/* Section Donjon - cadeau global */}
        <div className="bg-stone-900/70 border-2 border-cyan-500 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">🏰 Bonus Donjon Global</h2>
          <p className="text-stone-400 text-sm mb-4">
            Ajoute des essais de donjon à tous les joueurs et affiche une pop-up d'information sur leur page d'accueil.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-stone-400 text-sm block mb-1">Nombre d'essais à ajouter</label>
              <input
                type="number"
                min={1}
                step={1}
                value={dungeonAttemptsToGrant}
                onChange={(e) => setDungeonAttemptsToGrant(e.target.value)}
                className="w-full bg-stone-800 border border-stone-600 text-white px-4 py-2 rounded-lg focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-stone-400 text-sm block mb-1">Message affiché dans la pop-up</label>
              <textarea
                value={dungeonGrantMessage}
                onChange={(e) => setDungeonGrantMessage(e.target.value)}
                placeholder="Ex: Maintenance terminée, vous recevez 3 essais bonus. Bon courage !"
                rows={3}
                maxLength={500}
                className="w-full bg-stone-800 border border-stone-600 text-white px-4 py-2 rounded-lg focus:border-cyan-400 focus:outline-none resize-none"
              />
            </div>

            <button
              onClick={handleGrantDungeonRuns}
              disabled={dungeonGrantLoading || !String(dungeonAttemptsToGrant).trim() || !dungeonGrantMessage.trim()}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-stone-700 disabled:text-stone-500 text-white py-3 rounded-lg font-bold transition"
            >
              {dungeonGrantLoading ? '⏳ Attribution en cours...' : '🎁 Ajouter les essais à tous les joueurs'}
            </button>
          </div>
        </div>

        {/* Migration HP Forêt */}
        <div className="bg-stone-900/70 border-2 border-emerald-500 rounded-xl p-6 mb-8">
          <h3 className="text-xl font-bold text-emerald-300 mb-4">🌿 Migration HP Forêt (3→4 par point)</h3>
          <p className="text-stone-400 mb-4 text-sm">
            Convertit les HP de forêt de tous les personnages de l'ancien ratio (3 HP/point) vers le nouveau (4 HP/point).
          </p>
          <button
            onClick={async () => {
              if (!window.confirm('Migrer les HP de forêt de TOUS les personnages ? (3→4 par point)')) return;
              setMigrationHpLoading(true);
              setMigrationHpResult(null);
              const result = await migrateForestHpBoosts();
              setMigrationHpResult(result);
              setMigrationHpLoading(false);
              if (result.success) {
                const refreshed = await getAllCharacters();
                if (refreshed.success) setCharacters(refreshed.data);
              }
            }}
            disabled={migrationHpLoading}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-700 disabled:text-stone-500 text-white py-3 px-6 rounded-lg font-bold transition"
          >
            {migrationHpLoading ? '⏳ Migration en cours...' : '🔄 Lancer la migration HP'}
          </button>
          {migrationHpResult && (
            <div className={`mt-4 p-3 rounded-lg ${migrationHpResult.success ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
              {migrationHpResult.success
                ? `${migrationHpResult.migrated} personnages migrés, ${migrationHpResult.skipped} ignorés (pas de HP forêt)`
                : `Erreur: ${migrationHpResult.error}`}
            </div>
          )}
        </div>

        {/* Section Boss Mondial */}
        <WorldBossAdmin characters={characters} />

        <div className="bg-stone-900/70 border-2 border-fuchsia-500 rounded-xl p-6 mb-8">
          <audio ref={labyrinthAudioRef} loop>
            <source src="/assets/music/Labyrinthe.mp3" type="audio/mpeg" />
            <source src="/assets/music/labyrinthe.mp3" type="audio/mpeg" />
          </audio>
          <h2 className="text-2xl font-bold text-fuchsia-300 mb-2">🌀 Labyrinthe Infini (Admin uniquement)</h2>
          <p className="text-stone-400 text-sm mb-4">Mode en test: aucune reward active et aucune exposition côté joueurs.</p>
          {labyrinthError && <p className="text-red-300 text-sm mb-4">⚠️ {labyrinthError}</p>}

          <div className="mb-4">
            <label className="text-stone-400 text-sm block mb-2">Personnage de test Labyrinthe</label>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <select
                value={selectedLabUserId}
                onChange={(e) => setSelectedLabUserId(e.target.value)}
                className="bg-stone-800 border border-stone-600 rounded px-3 py-2 text-white w-full md:w-auto md:min-w-[320px]"
              >
                <option value="">Sélectionner un personnage</option>
                {characters.map((char) => (
                  <option key={char.id} value={char.id}>
                    {char.name} • {char.race} {char.class} {char.disabled ? '(désactivé)' : ''}
                  </option>
                ))}
              </select>
              <span className="text-stone-300 text-xs">
                {selectedLabCharacter ? `UID: ${selectedLabCharacter.id}` : 'Aucun personnage sélectionné'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <button onClick={handleToggleLabyrinthMusic} className="bg-violet-700 hover:bg-violet-600 text-white px-4 py-2 rounded-lg font-bold">
              {labyrinthMusicEnabled ? '⏸️ Couper musique Labyrinthe' : '🎵 Lancer musique Labyrinthe'}
            </button>
            <button onClick={handleGenerateLabyrinth} disabled={labyrinthLoading} className="bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold">Générer Labyrinthe Infini de la semaine</button>
            <button onClick={handleResetLabyrinthEnemyPool} disabled={labyrinthLoading} className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold">Reset pool ennemis (reroll semaine)</button>
            <button onClick={handleResetMyLabyrinthProgress} disabled={labyrinthLoading} className="bg-stone-700 hover:bg-stone-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold">Reset progression (perso sélectionné)</button>
            <button onClick={() => handleLaunchLabyrinthCombat(labyrinthProgress?.currentFloor || 1)} disabled={labyrinthLoading} className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold">Combat au currentFloor</button>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-4 text-sm">
            <div className="bg-stone-800/60 border border-stone-700 rounded-lg p-3"><p className="text-stone-400">WeekId</p><p className="text-white font-bold">{labyrinthWeekId}</p></div>
            <div className="bg-stone-800/60 border border-stone-700 rounded-lg p-3"><p className="text-stone-400">Current floor</p><p className="text-white font-bold">{labyrinthProgress?.currentFloor ?? 1}</p></div>
            <div className="bg-stone-800/60 border border-stone-700 rounded-lg p-3"><p className="text-stone-400">Boss vaincus</p><p className="text-white font-bold">{labyrinthProgress?.bossesDefeated ?? 0}</p></div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <input type="number" min={1} max={100} value={selectedLabFloor} onChange={(e) => setSelectedLabFloor(e.target.value)} className="bg-stone-800 border border-stone-600 rounded px-3 py-2 text-white w-32" />
            <button onClick={() => handleLaunchLabyrinthCombat(Number(selectedLabFloor))} disabled={labyrinthLoading} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold">Lancer combat à l'étage choisi</button>
          </div>

          {labyrinthCombatResult && <div className="bg-stone-800/60 border border-stone-700 rounded-lg p-3 mb-4 text-sm"><p className="text-white font-bold">Résultat étage {labyrinthCombatResult.floor.floorNumber}: {labyrinthCombatResult.didWin ? '🏆 Victoire' : '💀 Défaite'}</p></div>}

          {labyrinthCombatLogs.length > 0 && <div className="bg-black/50 border border-stone-700 rounded-lg p-3 mb-4 max-h-56 overflow-y-auto text-xs font-mono text-stone-300">{labyrinthCombatLogs.map((log, idx) => <div key={`lab-log-${idx}`}>{log}</div>)}</div>}

          <div className="max-h-80 overflow-y-auto border border-stone-700 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-stone-800 sticky top-0"><tr className="text-stone-300 text-left"><th className="px-2 py-2">Étage</th><th className="px-2 py-2">Type</th><th className="px-2 py-2">Nom</th><th className="px-2 py-2">Image</th><th className="px-2 py-2">Kit boss</th></tr></thead>
              <tbody>
                {(labyrinthData?.floors || []).map((floor) => (
                  <tr key={floor.floorNumber} className="border-t border-stone-800">
                    <td className="px-2 py-2 text-white">{floor.floorNumber}</td>
                    <td className="px-2 py-2 text-stone-300">{floor.type}</td>
                    <td className="px-2 py-2 text-stone-200">{floor.enemyName}</td>
                    <td className="px-2 py-2"><img src={floor.imagePath} alt={floor.enemyName} className="w-10 h-10 object-contain" /></td>
                    <td className="px-2 py-2 text-stone-300">{floor.bossKit ? JSON.stringify(floor.bossKit) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section Démarrer l'Event */}
        <div className="bg-stone-900/70 border-2 border-red-500 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-red-300 mb-4">🎯 Démarrer l'Event</h2>
          <p className="text-stone-400 text-sm mb-4">Lance le tournoi avec tous les personnages actifs de la semaine. Crée le tirage, lance le premier combat et redirige vers la page tournoi. Les matchs s'enchaînent automatiquement.</p>

          <button
            onClick={handleDemarrerEvent}
            disabled={tirageLoading}
            className="w-full bg-red-600 hover:bg-red-500 disabled:bg-stone-700 disabled:text-stone-500 text-white py-3 rounded-lg font-bold transition"
          >
            {tirageLoading ? '⏳ Lancement de l\'event...' : '🚀 Démarrer l\'event'}
          </button>
        </div>

        {/* Section Simulation Tournoi */}
        <div className="bg-stone-900/70 border-2 border-amber-500 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-amber-300 mb-4">🏆 Simulation de Tournoi</h2>
          <p className="text-stone-400 text-sm mb-4">Lance une simulation en direct avec tous les personnages. Même vue que le vrai tournoi : combats 1 par 1, musique, animations. Aucune donnée n'est sauvegardée, pas d'annonce Discord.</p>

          <button
            onClick={handleSimulerTournoi}
            disabled={simulationLoading}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500 text-white py-3 rounded-lg font-bold transition"
          >
            {simulationLoading ? '⏳ Préparation...' : '🎲 Lancer une simulation en direct'}
          </button>

          <button
            onClick={() => navigate('/admin/balance')}
            className="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold transition"
          >
            ⚖️ Ouvrir la page d'équilibrage (admin)
          </button>
        </div>

        {/* Canvas caché pour le traitement */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Onglets Actifs / Désactivés / Archivés */}
        {(() => {
          const activeChars = characters.filter(c => !c.disabled);
          const disabledChars = characters.filter(c => c.disabled);
          const displayedChars = adminTab === 'actifs' ? activeChars : adminTab === 'desactives' ? disabledChars : archivedCharacters;

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
                <button
                  onClick={() => setAdminTab('archives')}
                  className={`flex-1 py-3 rounded-lg font-bold text-lg transition border-2 ${
                    adminTab === 'archives'
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-500'
                  }`}
                >
                  Archivés ({archivedCharacters.length})
                </button>
              </div>

              {displayedChars.length === 0 ? (
                <div className="bg-stone-800/50 rounded-xl p-8 border-2 border-amber-600 text-center">
                  <p className="text-gray-400 text-xl">
                    {adminTab === 'actifs' ? 'Aucun personnage actif' : adminTab === 'desactives' ? 'Aucun personnage désactivé' : 'Aucun personnage archivé'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedChars.map((char) => (
                    <div
                      key={char.id}
                      className={`bg-stone-800/90 rounded-xl p-6 border-2 shadow-xl hover:shadow-2xl transition-shadow cursor-pointer ${
                        adminTab === 'archives' ? 'border-purple-600' : char.disabled ? 'border-red-600' : 'border-amber-600'
                      }`}
                      onClick={() => handleSelectCharacter(adminTab === 'archives' ? { ...char, _source: 'archived' } : char)}
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
                      {char.base && <div className="bg-stone-900/50 rounded-lg p-3 mb-4 text-xs">
                        <div className="grid grid-cols-2 gap-2 text-gray-300">
                          <div>HP: <span className="text-white font-bold">{char.base.hp}</span></div>
                          <div>VIT: <span className="text-white font-bold">{char.base.spd}</span></div>
                          <div>Auto: <span className="text-white font-bold">{char.base.auto}</span></div>
                          <div>Déf: <span className="text-white font-bold">{char.base.def}</span></div>
                          <div>Cap: <span className="text-white font-bold">{char.base.cap}</span></div>
                          <div>ResC: <span className="text-white font-bold">{char.base.rescap}</span></div>
                        </div>
                      </div>}

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
                          handleSelectCharacter(adminTab === 'archives' ? { ...char, _source: 'archived' } : char);
                        }}
                        className={`mt-4 w-full py-2 rounded transition ${
                          adminTab === 'archives' ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
                        }`}
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

      {isLabyrinthReplayOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => { if (!isLabyrinthReplayAnimating) closeLabyrinthReplay(); }}>
          <div className="bg-stone-900 border-2 border-fuchsia-500 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700">
              <h3 className="text-fuchsia-300 font-bold text-lg">⚔️ Combat Labyrinthe</h3>
              <button onClick={closeLabyrinthReplay} className="text-stone-300 hover:text-white">✖</button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 p-4 border-b border-stone-800">
              <div className="bg-stone-800/60 rounded p-3">
                <p className="text-stone-300 text-sm">{labyrinthReplayP1Name}</p>
                <div className="w-full h-3 bg-stone-700 rounded mt-2">
                  <div className="h-3 bg-green-500 rounded" style={{ width: `${labyrinthReplayP1MaxHP ? Math.max(0, Math.min(100, (labyrinthReplayP1HP / labyrinthReplayP1MaxHP) * 100)) : 0}%` }} />
                </div>
                <p className="text-xs text-stone-400 mt-1">HP: {Math.max(0, labyrinthReplayP1HP)} / {labyrinthReplayP1MaxHP}</p>
              </div>
              <div className="bg-stone-800/60 rounded p-3">
                <p className="text-stone-300 text-sm">{labyrinthReplayP2Name}</p>
                <div className="w-full h-3 bg-stone-700 rounded mt-2">
                  <div className="h-3 bg-red-500 rounded" style={{ width: `${labyrinthReplayP2MaxHP ? Math.max(0, Math.min(100, (labyrinthReplayP2HP / labyrinthReplayP2MaxHP) * 100)) : 0}%` }} />
                </div>
                <p className="text-xs text-stone-400 mt-1">HP: {Math.max(0, labyrinthReplayP2HP)} / {labyrinthReplayP2MaxHP}</p>
              </div>
            </div>

            <div className="p-4 max-h-[45vh] overflow-y-auto bg-black/40 text-sm font-mono text-stone-200">
              {labyrinthReplayLogs.length === 0 ? (
                <p className="text-stone-500 italic">Préparation du combat...</p>
              ) : (
                labyrinthReplayLogs.map((line, idx) => <div key={`lab-replay-${idx}`}>{line}</div>)
              )}
            </div>

            <div className="px-4 py-3 border-t border-stone-700 flex items-center justify-between">
              <p className="text-amber-300 font-bold">{labyrinthReplayWinner ? `🏆 Vainqueur: ${labyrinthReplayWinner}` : (isLabyrinthReplayAnimating ? '⏳ Combat en cours...' : 'Combat terminé')}</p>
              <button onClick={closeLabyrinthReplay} className="bg-fuchsia-700 hover:bg-fuchsia-600 text-white px-3 py-1 rounded">Fermer</button>
            </div>
          </div>
        </div>
      )}

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

              {selectedCharacter.base && (
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
              )}

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

            {/* Bouton activer/désactiver (pas pour les archivés) */}
            {selectedCharacter._source !== 'archived' && (
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
            )}

            {/* Bouton reset progression (pas pour les archivés) */}
            {selectedCharacter._source !== 'archived' && (
              <button
                onClick={() => handleResetProgression(selectedCharacter)}
                disabled={resetProgressionLoading}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold transition mb-4"
              >
                {resetProgressionLoading ? '⏳ Réinitialisation...' : '🔄 Reset progression (donjon, armes, boosts)'}
              </button>
            )}

            {/* Bouton suppression (pas pour les archivés) */}
            {selectedCharacter._source !== 'archived' && (
              <button
                onClick={() => handleDelete(selectedCharacter.id, selectedCharacter.name)}
                disabled={deleting}
                className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold transition mb-4"
              >
                {deleting ? '⏳ Suppression...' : '🗑️ Supprimer ce personnage'}
              </button>
            )}

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
