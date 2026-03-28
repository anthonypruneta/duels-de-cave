import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllCharacters, deleteCharacter, updateCharacterImage, updateArchivedCharacterImage, toggleCharacterDisabled, updateCharacterForestBoosts, updateCharacterMageTowerPassive, updateCharacterEquippedWeapon, updateCharacterLevel, migrateHpStat4To6, clampCharacterLevelInDb, clampAllCharactersLevelInDb, reduceCharacterForestStats, reduceAllCharactersForestStats } from '../services/characterService';
import { grantDungeonRunsToAllPlayers, resetDungeonRuns } from '../services/dungeonService';
import { envoyerAnnonceDiscord } from '../services/discordService';
import {
  creerTournoi,
  lancerTournoi,
  getAllArchivedCharacters,
  resetAllRerollGains,
  creerTournoiLegacy,
  getLegacyQualifierSnapshot,
  nettoyerTournoiLegacy,
  LEGACY_TOURNAMENT_DOC_ID
} from '../services/tournamentService';
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
import { races as racesData } from '../data/races';
import { classes as classesData } from '../data/classes';
import WorldBossAdmin from './WorldBossAdmin';
import AdminBalance from './AdminBalance';
import AdminCombatHD2D from './AdminCombatHD2D';
import CharacterCardContent from './CharacterCardContent';
import { BORDERS } from '../data/borders';
import { TITLES } from '../data/titles';
import { getDisplayTitle } from '../services/titleService';
import AdminCoopRedSimPanel from './AdminCoopRedSimPanel';

const realBorderPngModules = import.meta.glob('../assets/backgrounds/*.png', { eager: true, import: 'default' });

const Admin = () => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // États pour l'upload d'image
  const [uploadedImage, setUploadedImage] = useState(null);
  const [savingImage, setSavingImage] = useState(false);
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
  const [legacyTournamentLoading, setLegacyTournamentLoading] = useState(false);
  const [legacyQualifier, setLegacyQualifier] = useState(null);
  const [legacyTournamentDocId, setLegacyTournamentDocId] = useState(null);

  // État pour les rerolls disponibles
  const [rerollsData, setRerollsData] = useState([]);
  const [rerollsLoading, setRerollsLoading] = useState(false);
  const [resetRerollsLoading, setResetRerollsLoading] = useState(false);

  // État pour le reset de progression
  const [resetProgressionLoading, setResetProgressionLoading] = useState(false);

  // État pour la migration PV 4→6
  const [migrationHpLoading, setMigrationHpLoading] = useState(false);

  // Niveau / stats Forêt (admin)
  const [clampLevelLoading, setClampLevelLoading] = useState(false);
  const [clampAllLevelLoading, setClampAllLevelLoading] = useState(false);
  const [reduceStatsPoints, setReduceStatsPoints] = useState(10);
  const [reduceStatsLoading, setReduceStatsLoading] = useState(false);
  const [reduceAllStatsLoading, setReduceAllStatsLoading] = useState(false);

  // État pour le tirage manuel du tournoi
  const [tirageLoading, setTirageLoading] = useState(false);

  // Personnages archivés
  const [archivedCharacters, setArchivedCharacters] = useState([]);

  const [adminMainTab, setAdminMainTab] = useState('annonce');
  const [characterStatusTab, setCharacterStatusTab] = useState('actifs');
  const [skinPreviewCharacterId, setSkinPreviewCharacterId] = useState('');
  const [skinPreviewBorderId, setSkinPreviewBorderId] = useState('');
  const [skinPreviewRealBorderId, setSkinPreviewRealBorderId] = useState('');
  const [skinPreviewTitleId, setSkinPreviewTitleId] = useState('');

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
  const realBorderCandidates = Object.keys(realBorderPngModules)
    .map((k) => {
      const file = k.split('/').pop() || '';
      const base = file.replace(/\.png$/i, '');
      return { file, base };
    })
    .filter(({ file, base }) =>
      file.toLowerCase().endsWith('.png') &&
      !/^BG$/i.test(base) &&
      !/Old$/i.test(base)
    )
    .sort((a, b) => a.base.localeCompare(b.base, 'fr'));

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
    if (skinPreviewCharacterId) return;
    if (currentUser?.uid && characters.some((c) => c.id === currentUser.uid)) {
      setSkinPreviewCharacterId(currentUser.uid);
      return;
    }
    if (characters.length > 0) {
      setSkinPreviewCharacterId(characters[0].id);
    }
  }, [characters, currentUser?.uid, skinPreviewCharacterId]);

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
    };
    reader.readAsDataURL(file);
  };

  // Fonction pour sauvegarder l'image dans Firebase Storage
  const saveImageToCharacter = async () => {
    if (!uploadedImage || !selectedCharacter) return;

    setSavingImage(true);
    const isArchived = selectedCharacter._source === 'archived';
    const result = isArchived
      ? await updateArchivedCharacterImage(selectedCharacter.id, uploadedImage)
      : await updateCharacterImage(selectedCharacter.id, uploadedImage);

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
    refreshLegacyQualifier();
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

  const refreshLegacyQualifier = async () => {
    const r = await getLegacyQualifierSnapshot();
    setLegacyQualifier(r.success && r.data ? r.data : null);
  };

  useEffect(() => {
    if (adminMainTab === 'annonce') refreshLegacyQualifier();
  }, [adminMainTab]);

  const handleCreerTournoiLegacy = async () => {
    if (
      !window.confirm(
        'Créer le tournoi des anciens (archivés sur les 2 dernières semaines, niveau ≤ 400) ? Un tournoi legacy en cours sera écrasé.'
      )
    ) {
      return;
    }
    setLegacyTournamentLoading(true);
    const createResult = await creerTournoiLegacy();
    if (!createResult.success) {
      alert('❌ ' + createResult.error);
      setLegacyTournamentLoading(false);
      return;
    }
    if (createResult.tournamentDocId) setLegacyTournamentDocId(createResult.tournamentDocId);
    const excl =
      typeof createResult.retiredExclusionsCount === 'number'
        ? ` • ${createResult.retiredExclusionsCount} fiche(s) à la retraite (ex-tchampions legacy)`
        : '';
    const dedupe =
      typeof createResult.dedupeDroppedCount === 'number' && createResult.dedupeDroppedCount > 0
        ? ` • ${createResult.dedupeDroppedCount} doublon(s) retiré(s) (même compte + même nom)`
        : '';
    alert(`✅ ${createResult.nbParticipants} combattants${excl}${dedupe} — ouvrez la page legacy puis lancez le 1er combat.`);
    setLegacyTournamentLoading(false);
  };

  const handleCreerTournoiLegacySansDiscord = async () => {
    if (
      !window.confirm(
        'Créer le tirage du tournoi des anciens dans Firestore sans publication Discord (pas de message @everyone pour le tirage) ? Même bracket sauvegardé que le bouton « Créer uniquement le tirage ».'
      )
    ) {
      return;
    }
    setLegacyTournamentLoading(true);
    const createResult = await creerTournoiLegacy({ announceDiscord: false });
    if (!createResult.success) {
      alert('❌ ' + createResult.error);
      setLegacyTournamentLoading(false);
      return;
    }
    if (createResult.tournamentDocId) setLegacyTournamentDocId(createResult.tournamentDocId);
    const excl =
      typeof createResult.retiredExclusionsCount === 'number'
        ? ` • ${createResult.retiredExclusionsCount} fiche(s) à la retraite (ex-tchampions legacy)`
        : '';
    const dedupe =
      typeof createResult.dedupeDroppedCount === 'number' && createResult.dedupeDroppedCount > 0
        ? ` • ${createResult.dedupeDroppedCount} doublon(s) retiré(s) (même compte + même nom)`
        : '';
    alert(
      `✅ ${createResult.nbParticipants} combattants${excl}${dedupe} • annonce Discord du tirage ignorée — ouvrez la page legacy puis lancez le 1er combat.`
    );
    setLegacyTournamentLoading(false);
  };

  const handleDemarrerTournoiLegacy = async () => {
    if (
      !window.confirm(
        'Créer + lancer le tournoi des anciens et ouvrir la page en direct ? (écrase un legacy en cours)'
      )
    ) {
      return;
    }
    setLegacyTournamentLoading(true);
    let docId = legacyTournamentDocId;
    let createResult = null;

    if (!docId) {
      createResult = await creerTournoiLegacy();
      if (!createResult.success) {
        alert('❌ ' + createResult.error);
        setLegacyTournamentLoading(false);
        return;
      }
      docId = createResult.tournamentDocId;
      if (docId) setLegacyTournamentDocId(docId);
    }

    const launchResult = await lancerTournoi(docId || LEGACY_TOURNAMENT_DOC_ID);
    if (!launchResult.success) {
      alert('❌ Lancement: ' + launchResult.error);
      setLegacyTournamentLoading(false);
      return;
    }
    if (typeof createResult?.dedupeDroppedCount === 'number' && createResult.dedupeDroppedCount > 0) {
      alert(
        `ℹ️ ${createResult.dedupeDroppedCount} archive(s) ignorée(s) (même compte + même nom → la plus récente).`
      );
    }
    setLegacyTournamentLoading(false);
    navigate(`/tournament?mode=legacy&legacyDocId=${encodeURIComponent(docId || LEGACY_TOURNAMENT_DOC_ID)}`);
  };

  const handleNettoyerTournoiLegacy = async () => {
    if (!window.confirm('Supprimer le document tournoi des anciens (combatLogs inclus) ?')) return;
    const r = await nettoyerTournoiLegacy();
    if (r.success) alert('✅ Nettoyé');
    else alert('❌ ' + (r.error || 'Erreur'));
  };

  const loadRerollsData = async () => {
    setRerollsLoading(true);
    try {
      const { db } = await import('../firebase/config');
      const { collection, getDocs } = await import('firebase/firestore');
      const { getTripleRollCount } = await import('../services/tournamentService');
      
      const rewardsRef = collection(db, 'tournamentRewards');
      const rewardsSnap = await getDocs(rewardsRef);
      
      const rerollsArray = [];
      for (const rewardDoc of rewardsSnap.docs) {
        const data = rewardDoc.data();
        const userId = rewardDoc.id;
        
        // Récupérer le nombre de rerolls
        const rollCount = await getTripleRollCount(userId);
        if (rollCount > 0) {
          // Trouver le personnage correspondant
          const character = characters.find(c => c.id === userId);
          
          rerollsArray.push({
            userId,
            characterName: character?.name || 'Inconnu',
            rollCount,
            tournamentWins: data.tournamentWins || 0,
            cataclysmeWins: data.cataclysmeWins || 0,
            source: data.source || 'N/A',
            lastTournamentDate: data.lastTournamentDate,
            lastCataclysmeDate: data.lastCataclysmeDate
          });
        }
      }
      
      // Trier par nombre de rerolls décroissant
      rerollsArray.sort((a, b) => b.rollCount - a.rollCount);
      setRerollsData(rerollsArray);
    } catch (error) {
      console.error('Erreur chargement rerolls:', error);
    }
    setRerollsLoading(false);
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

  // Plafonner le niveau à 400 (perso sélectionné)
  const handleClampLevel = async () => {
    if (!selectedCharacter || selectedCharacter._source === 'archived') return;
    setClampLevelLoading(true);
    try {
      const res = await clampCharacterLevelInDb(selectedCharacter.id);
      if (res.success) {
        if (res.updated) {
          setCharacters(prev => prev.map(c => c.id === selectedCharacter.id ? { ...c, level: 400 } : c));
          setSelectedCharacter(prev => prev ? { ...prev, level: 400 } : prev);
          alert('Niveau plafonné à 400 pour ce personnage.');
        } else {
          alert('Ce personnage avait déjà un niveau ≤ 400.');
        }
      } else alert('Erreur: ' + res.error);
    } finally {
      setClampLevelLoading(false);
    }
  };

  // Plafonner le niveau à 400 pour tous (niveau > 400)
  const handleClampAllLevels = async () => {
    if (!window.confirm('Plafonner le niveau à 400 pour tous les personnages actuellement > 400 ?')) return;
    setClampAllLevelLoading(true);
    try {
      const res = await clampAllCharactersLevelInDb();
      if (res.success) {
        alert(`${res.updated} personnage(s) mis à niveau 400.`);
        loadCharacters();
      } else alert('Erreur: ' + res.error);
    } finally {
      setClampAllLevelLoading(false);
    }
  };

  // Enlever X points par stat Forêt (perso sélectionné)
  const handleReduceStats = async () => {
    if (!selectedCharacter || selectedCharacter._source === 'archived') return;
    const pts = Math.max(0, Number(reduceStatsPoints) || 0);
    if (pts <= 0) {
      alert('Indiquez un nombre de points à enlever par stat (≥ 1).');
      return;
    }
    setReduceStatsLoading(true);
    try {
      const res = await reduceCharacterForestStats(selectedCharacter.id, pts);
      if (res.success) {
        alert(`${pts} points enlevés par stat (Forêt) pour "${selectedCharacter.name}".`);
        loadCharacters();
      } else alert('Erreur: ' + res.error);
    } finally {
      setReduceStatsLoading(false);
    }
  };

  // Enlever X points par stat Forêt (tous)
  const handleReduceAllStats = async () => {
    const pts = Math.max(0, Number(reduceStatsPoints) || 0);
    if (pts <= 0) {
      alert('Indiquez un nombre de points à enlever par stat (≥ 1).');
      return;
    }
    if (!window.confirm(`Enlever ${pts} points par stat Forêt pour TOUS les personnages ?`)) return;
    setReduceAllStatsLoading(true);
    try {
      const res = await reduceAllCharactersForestStats(pts);
      if (res.success) {
        alert(`${res.updated} personnage(s) mis à jour.`);
        loadCharacters();
      } else alert('Erreur: ' + res.error);
    } finally {
      setReduceAllStatsLoading(false);
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

        <div className="flex flex-wrap gap-2 mb-8">
{[
            { key: 'annonce', label: '📢 Annonce' },
            { key: 'labyrinthe', label: '🌀 Labyrinthe' },
            { key: 'cataclysme', label: '🌋 Cataclysme' },
            { key: 'tournois', label: '🏆 Tournois' },
            { key: 'equilibrage', label: '⚖️ Équilibrage' },
            { key: 'red-sim', label: '🔴 Red simu' },
            { key: 'combat-hd2d', label: '⚔️ Combat HD-2D' },
            { key: 'skins', label: '🎨 Skins' },
            { key: 'personnage', label: '👤 Personnage' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setAdminMainTab(tab.key)}
              className={`px-4 py-2 rounded-lg font-bold border-2 transition ${
                adminMainTab === tab.key
                  ? 'bg-amber-600 border-amber-400 text-white'
                  : 'bg-stone-800 border-stone-600 text-stone-300 hover:border-stone-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {adminMainTab === 'annonce' && (
          <>
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

          </>
        )}

        {adminMainTab === 'cataclysme' && (
          <>
            {/* Section Boss Mondial */}
            <WorldBossAdmin characters={characters} />
          </>
        )}

        {adminMainTab === 'labyrinthe' && (
          <>
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

          </>
        )}

        {adminMainTab === 'tournois' && (
          <>
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

        {/* Section Rerolls disponibles */}
        <div className="bg-stone-900/70 border-2 border-green-600 rounded-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-green-400">🎲 Rerolls disponibles</h2>
            <div className="flex gap-2">
              <button
                onClick={loadRerollsData}
                disabled={rerollsLoading}
                className="bg-green-700 hover:bg-green-600 disabled:bg-stone-700 text-white px-4 py-2 rounded-lg font-bold transition"
              >
                {rerollsLoading ? '⏳ Chargement...' : '🔄 Actualiser'}
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm('Réinitialiser tous les gains de reroll (Tournoi + Cataclysme) pour tous les joueurs ? Cette action est irréversible.')) return;
                  setResetRerollsLoading(true);
                  try {
                    const result = await resetAllRerollGains();
                    if (result.success) {
                      setRerollsData([]);
                      alert(`✅ ${result.count ?? 0} gain(s) de reroll supprimé(s).`);
                    } else alert(`❌ ${result.error}`);
                  } finally {
                    setResetRerollsLoading(false);
                  }
                }}
                disabled={resetRerollsLoading}
                className="bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 text-white px-4 py-2 rounded-lg font-bold transition"
              >
                {resetRerollsLoading ? '⏳ Reset...' : '🗑️ Reset gains de reroll'}
              </button>
            </div>
          </div>
          
          <p className="text-stone-400 text-sm mb-4">Liste des joueurs ayant des rerolls disponibles pour leur prochain personnage (Tournoi + Cataclysme)</p>

          {rerollsData.length === 0 && !rerollsLoading && (
            <div className="text-stone-500 text-center py-8 border border-stone-700 rounded-lg">
              Aucun reroll disponible. Cliquez sur "Actualiser" pour charger les données.
            </div>
          )}

          {rerollsData.length > 0 && (
            <div className="overflow-x-auto border border-stone-700 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-stone-800">
                  <tr className="text-stone-300 text-left">
                    <th className="px-4 py-3">Personnage</th>
                    <th className="px-4 py-3 text-center">Rerolls</th>
                    <th className="px-4 py-3 text-center">🏆 Tournoi</th>
                    <th className="px-4 py-3 text-center">☄️ Cataclysme</th>
                    <th className="px-4 py-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800">
                  {rerollsData.map((item, index) => (
                    <tr key={item.userId} className={`${index % 2 === 0 ? 'bg-stone-900/50' : 'bg-stone-900/30'} hover:bg-stone-800/50 transition`}>
                      <td className="px-4 py-3 text-white font-semibold">{item.characterName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full font-bold ${
                          item.rollCount === 6 ? 'bg-purple-600 text-white' : 
                          item.rollCount === 3 ? 'bg-green-600 text-white' : 
                          'bg-stone-600 text-stone-300'
                        }`}>
                          {item.rollCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.tournamentWins > 0 ? (
                          <span className="text-amber-400 font-bold">✓ ({item.tournamentWins})</span>
                        ) : (
                          <span className="text-stone-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.cataclysmeWins > 0 ? (
                          <span className="text-red-400 font-bold">✓ ({item.cataclysmeWins})</span>
                        ) : (
                          <span className="text-stone-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-400 text-xs">
                        {item.tournamentWins > 0 && item.cataclysmeWins > 0 ? '🏆 + ☄️' : 
                         item.tournamentWins > 0 ? '🏆 Tournoi' : 
                         item.cataclysmeWins > 0 ? '☄️ Cataclysme' : 
                         item.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rerollsData.length > 0 && (
            <div className="mt-4 text-sm text-stone-400">
              <p>📊 Total : <span className="text-white font-bold">{rerollsData.length}</span> joueur(s) avec des rerolls</p>
              <p className="mt-1">
                💜 = 6 rerolls (Tournoi + Cataclysme) • 
                💚 = 3 rerolls (une seule source)
              </p>
            </div>
          )}
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
        </div>

        <div className="bg-stone-900/70 border-2 border-violet-500 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-violet-300 mb-2">📜 Tournoi des anciens</h2>
          <p className="text-stone-400 text-sm mb-3">
            <strong>Fiches archivées</strong> éligibles : archivées sur les <strong>2 dernières semaines</strong> (même découpage que la semaine jeu / récompenses), niveau ≤ 400, hors ex-champions legacy. Plusieurs persos par compte OK ; même nom + même compte = une entrée (la plus récente).             Le gagnant
            est inscrit au <strong>prochain</strong> tournoi du samedi (création du tournoi principal). Discord comme
            le samedi pour le tirage « officiel » ; le bouton <strong>sans Discord</strong> enregistre le même bracket dans Firestore sans message sur le serveur. N&apos;archive pas les persos actifs.
          </p>
          {legacyQualifier?.display?.nom && (
            <div className="mb-4 p-3 rounded-lg bg-violet-950/40 border border-violet-600/40 text-sm">
              <span className="text-violet-200 font-bold">Qualifié pour le samedi :</span>{' '}
              <span className="text-white">{legacyQualifier.display.nom}</span>
              <span className="text-stone-500">
                {' '}
                ({legacyQualifier.display.classe || '?'} • archivé #{legacyQualifier.archiveFirestoreId})
              </span>
              <p className="text-stone-500 text-xs mt-1">
                Consommé automatiquement à la prochaine création du tournoi principal.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleCreerTournoiLegacy}
              disabled={legacyTournamentLoading}
              className="w-full bg-violet-700 hover:bg-violet-600 disabled:bg-stone-700 text-white py-2.5 rounded-lg font-bold transition text-sm"
            >
              {legacyTournamentLoading ? '⏳...' : '📋 Créer uniquement le tirage (legacy)'}
            </button>
            <button
              type="button"
              onClick={handleCreerTournoiLegacySansDiscord}
              disabled={legacyTournamentLoading}
              className="w-full bg-stone-800 hover:bg-stone-700 disabled:bg-stone-700 text-violet-200 border border-violet-600/50 py-2.5 rounded-lg font-bold transition text-sm"
            >
              {legacyTournamentLoading ? '⏳...' : '🧪 Tirage sans annonce Discord'}
            </button>
            <button
              type="button"
              onClick={handleDemarrerTournoiLegacy}
              disabled={legacyTournamentLoading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-stone-700 text-white py-3 rounded-lg font-bold transition"
            >
              {legacyTournamentLoading ? '⏳...' : '⚔️ Créer + lancer + ouvrir en direct'}
            </button>
            <button
              type="button"
              onClick={() => navigate(
                legacyTournamentDocId
                  ? `/tournament?mode=legacy&legacyDocId=${encodeURIComponent(legacyTournamentDocId)}`
                  : '/tournament?mode=legacy'
              )}
              className="w-full bg-stone-700 hover:bg-stone-600 text-stone-200 py-2 rounded-lg font-semibold transition text-sm"
            >
              Ouvrir la page tournoi des anciens
            </button>
            <button
              type="button"
              onClick={handleNettoyerTournoiLegacy}
              className="w-full bg-stone-800 hover:bg-stone-700 text-stone-400 py-2 rounded-lg text-xs transition border border-stone-600"
            >
              Nettoyer le doc legacy (après l&apos;événement)
            </button>
            <button
              type="button"
              onClick={() => refreshLegacyQualifier()}
              className="text-stone-500 text-xs hover:text-stone-400"
            >
              Rafraîchir l&apos;état du qualifié samedi
            </button>
          </div>
        </div>

          </>
        )}

        {adminMainTab === 'equilibrage' && (
          <div className="bg-stone-900/40 border-2 border-amber-600 rounded-xl p-6 mb-8">
            <AdminBalance embedded />
          </div>
        )}

        {adminMainTab === 'red-sim' && <AdminCoopRedSimPanel />}

        {adminMainTab === 'combat-hd2d' && (
          <AdminCombatHD2D characters={characters} />
        )}

        {adminMainTab === 'skins' && (() => {
          const previewCharacter = characters.find((c) => c.id === skinPreviewCharacterId) || null;
          const previewCharacterPatched = previewCharacter ? {
            ...previewCharacter,
            equippedBorder: skinPreviewBorderId || null,
            equippedRealBorder: skinPreviewRealBorderId || null,
            equippedTitle: skinPreviewTitleId || null,
          } : null;

          return (
            <div className="bg-stone-900/70 border-2 border-cyan-500 rounded-xl p-6 mb-8">
              <h2 className="text-2xl font-bold text-cyan-300 mb-2">🎨 Testeur de skins</h2>
              <p className="text-stone-400 text-sm mb-6">
                Prévisualise librement toutes les bordures, effets et titres sans condition de déblocage.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <div>
                    <label className="text-stone-400 text-sm block mb-1">Personnage de test</label>
                    <select
                      value={skinPreviewCharacterId}
                      onChange={(e) => setSkinPreviewCharacterId(e.target.value)}
                      className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-2 text-white"
                    >
                      <option value="">Sélectionner un personnage</option>
                      {characters.map((char) => (
                        <option key={char.id} value={char.id}>
                          {char.name} • {char.race} {char.class}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-stone-400 text-sm block mb-1">Effet (bordure animée)</label>
                    <select
                      value={skinPreviewBorderId}
                      onChange={(e) => setSkinPreviewBorderId(e.target.value)}
                      className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-2 text-white"
                    >
                      <option value="">Aucun</option>
                      {Object.values(BORDERS).map((border) => (
                        <option key={border.id} value={border.id === 'default' ? '' : border.id}>
                          {border.icon} {border.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-stone-400 text-sm block mb-1">Bordure visuelle (PNG)</label>
                    <select
                      value={skinPreviewRealBorderId}
                      onChange={(e) => setSkinPreviewRealBorderId(e.target.value)}
                      className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-2 text-white"
                    >
                      <option value="">Aucune</option>
                      {realBorderCandidates.map(({ base, file }) => (
                        <option key={base} value={base}>
                          {base} ({file})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-stone-400 text-sm block mb-1">Titre</label>
                    <select
                      value={skinPreviewTitleId}
                      onChange={(e) => setSkinPreviewTitleId(e.target.value)}
                      className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-2 text-white"
                    >
                      <option value="">Aucun</option>
                      {Object.values(TITLES).map((title) => (
                        <option key={title.id} value={title.id}>
                          {title.icon} {previewCharacter ? getDisplayTitle(title.id, previewCharacter.gender) : title.male}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSkinPreviewBorderId('');
                      setSkinPreviewRealBorderId('');
                      setSkinPreviewTitleId('');
                    }}
                    className="w-full bg-stone-700 hover:bg-stone-600 text-white py-2 rounded-lg font-bold transition"
                  >
                    Réinitialiser la prévisualisation
                  </button>
                </div>

                <div className="bg-stone-950/70 border border-stone-700 rounded-lg p-4">
                  {previewCharacterPatched ? (
                    <>
                      <p className="text-stone-400 text-xs mb-3">
                        Aperçu: {previewCharacterPatched.name}
                        {skinPreviewTitleId && ` • ${getDisplayTitle(skinPreviewTitleId, previewCharacterPatched.gender)}`}
                      </p>
                      <CharacterCardContent
                        character={previewCharacterPatched}
                        detailsPlacement="left"
                        borderOnImageOnly
                      />
                    </>
                  ) : (
                    <p className="text-stone-500 text-sm">Sélectionne un personnage pour afficher l'aperçu.</p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {adminMainTab === 'personnage' && (
          <>
        {/* Migrations (PV 4→6) */}
        <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl p-4 mb-6">
          <h2 className="text-lg font-bold text-amber-400 mb-2">🔄 Migrations données</h2>
          <p className="text-stone-400 text-sm mb-3">Applique la mise à jour des PV (+6 par point de stat au lieu de +4) aux personnages non encore migrés. Les personnages déjà migrés sont ignorés.</p>
          <button
            onClick={async () => {
              if (!window.confirm('Lancer la migration PV 4→6 sur tous les personnages actifs non encore migrés ?')) return;
              setMigrationHpLoading(true);
              try {
                const result = await migrateHpStat4To6();
                if (result.success) {
                  alert(`✅ Migration terminée : ${result.migrated} migré(s), ${result.skipped} ignoré(s) / ${result.total} total.`);
                  loadCharacters();
                } else alert(`❌ ${result.error}`);
              } finally {
                setMigrationHpLoading(false);
              }
            }}
            disabled={migrationHpLoading}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500 text-white px-4 py-2 rounded-lg font-bold transition"
          >
            {migrationHpLoading ? '⏳ Migration...' : '🩺 Migration PV 4→6'}
          </button>
        </div>

        {/* Onglets Actifs / Désactivés / Archivés */}
        {(() => {
          const activeChars = characters.filter(c => !c.disabled);
          const disabledChars = characters.filter(c => c.disabled);
          const displayedChars = characterStatusTab === 'actifs' ? activeChars : characterStatusTab === 'desactives' ? disabledChars : archivedCharacters;

          return (
            <>
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setCharacterStatusTab('actifs')}
                  className={`flex-1 py-3 rounded-lg font-bold text-lg transition border-2 ${
                    characterStatusTab === 'actifs'
                      ? 'bg-amber-600 border-amber-400 text-white'
                      : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-500'
                  }`}
                >
                  Actifs ({activeChars.length})
                </button>
                <button
                  onClick={() => setCharacterStatusTab('desactives')}
                  className={`flex-1 py-3 rounded-lg font-bold text-lg transition border-2 ${
                    characterStatusTab === 'desactives'
                      ? 'bg-red-600 border-red-400 text-white'
                      : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-500'
                  }`}
                >
                  Désactivés ({disabledChars.length})
                </button>
                <button
                  onClick={() => setCharacterStatusTab('archives')}
                  className={`flex-1 py-3 rounded-lg font-bold text-lg transition border-2 ${
                    characterStatusTab === 'archives'
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
                    {characterStatusTab === 'actifs' ? 'Aucun personnage actif' : characterStatusTab === 'desactives' ? 'Aucun personnage désactivé' : 'Aucun personnage archivé'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedChars.map((char) => (
                    <div
                      key={char.id}
                      className={`bg-stone-800/90 rounded-xl p-6 border-2 shadow-xl hover:shadow-2xl transition-shadow cursor-pointer ${
                        characterStatusTab === 'archives' ? 'border-purple-600' : char.disabled ? 'border-red-600' : 'border-amber-600'
                      }`}
                      onClick={() => handleSelectCharacter(characterStatusTab === 'archives' ? { ...char, _source: 'archived' } : char)}
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
                          handleSelectCharacter(characterStatusTab === 'archives' ? { ...char, _source: 'archived' } : char);
                        }}
                        className={`mt-4 w-full py-2 rounded transition ${
                          characterStatusTab === 'archives' ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
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
          </>
        )}

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
              {selectedCharacter.characterImage && (
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

              {!uploadedImage && (
                <label
                  htmlFor="character-image-upload"
                  className="block w-full p-6 border-2 border-dashed border-amber-500/50 rounded-lg cursor-pointer hover:border-amber-400 hover:bg-stone-700/30 transition text-center"
                >
                  <span className="text-3xl mb-2 block">📤</span>
                  <p className="text-amber-300">Cliquez pour uploader une image</p>
                  <p className="text-gray-500 text-sm mt-1">PNG, JPG, WEBP...</p>
                </label>
              )}

              {/* Image uploadée */}
              {uploadedImage && (
                <div className="space-y-3">
                  <div className="text-center">
                    <img
                      src={uploadedImage}
                      alt="Image uploadée"
                      className="max-h-48 mx-auto rounded-lg"
                    />
                    <p className="text-gray-400 text-sm mt-2">Aperçu (upload sans bordure)</p>
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

            {/* Niveau / Stats Forêt (admin) */}
            <div className="border border-stone-600 rounded-lg p-4 mb-4 bg-stone-900/50">
              <p className="text-stone-300 font-bold mb-3">📊 Niveau & stats Forêt</p>
              <div className="space-y-2 mb-3">
                <button
                  onClick={handleClampLevel}
                  disabled={clampLevelLoading || selectedCharacter._source === 'archived'}
                  className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-gray-600 text-white py-2 rounded font-bold text-sm"
                >
                  {clampLevelLoading ? '⏳...' : 'Plafonner niveau à 400 (ce perso)'}
                </button>
                <button
                  onClick={handleClampAllLevels}
                  disabled={clampAllLevelLoading}
                  className="w-full bg-amber-800 hover:bg-amber-700 disabled:bg-gray-600 text-white py-2 rounded font-bold text-sm"
                >
                  {clampAllLevelLoading ? '⏳...' : 'Plafonner niveau à 400 pour tous (> 400)'}
                </button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-stone-400 text-sm whitespace-nowrap">Points à enlever par stat :</label>
                <input
                  type="number"
                  min={0}
                  value={reduceStatsPoints}
                  onChange={(e) => setReduceStatsPoints(e.target.value)}
                  className="w-20 bg-stone-800 border border-stone-600 rounded px-2 py-1 text-white text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReduceStats}
                  disabled={reduceStatsLoading || selectedCharacter._source === 'archived'}
                  className="flex-1 bg-stone-600 hover:bg-stone-500 disabled:bg-gray-600 text-white py-2 rounded font-bold text-sm"
                >
                  {reduceStatsLoading ? '⏳' : 'Enlever (ce perso)'}
                </button>
                <button
                  onClick={handleReduceAllStats}
                  disabled={reduceAllStatsLoading}
                  className="flex-1 bg-stone-600 hover:bg-stone-500 disabled:bg-gray-600 text-white py-2 rounded font-bold text-sm"
                >
                  {reduceAllStatsLoading ? '⏳' : 'Enlever (tous)'}
                </button>
              </div>
            </div>

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
