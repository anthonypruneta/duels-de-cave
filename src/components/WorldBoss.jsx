import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import { getUserCharacter } from '../services/characterService';
import { getWorldBossEvent, getLeaderboard, onWorldBossEventChange, onLeaderboardChange, recordAttemptDamage, canAttemptBoss, checkAutoLaunch, checkAutoEnd, getChampionBossStatsByUserId } from '../services/worldBossService';
import { getEquippedWeapon } from '../services/dungeonService';
import { simulerWorldBossCombat } from '../utils/worldBossCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { WORLD_BOSS, EVENT_STATUS } from '../data/worldBoss';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import { isForgeActive } from '../data/featureFlags';
import { extractForgeUpgrade, computeForgeStatDelta, hasAnyForgeUpgrade } from '../data/forgeDungeon';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import { applyAwakeningToBase, getAwakeningEffect, removeBaseRaceFlatBonusesIfAwakened } from '../utils/awakening';
import { applyPassiveWeaponStats } from '../utils/weaponEffects';
import {
  classConstants,
  getRaceBonus,
  getClassBonus
} from '../data/combatMechanics';
import { getRaceBonusText, getClassDescriptionText } from '../utils/descriptionBuilders';
import { getCalculatedClassDescription } from '../utils/calculatedClassDescription';
import CharacterCardContent from './CharacterCardContent';
import testImage1 from '../assets/characters/test.png';

// Images du boss cataclysme (piochées par semaine, nom du fichier = nom du boss)
const CATACLYSM_IMAGES = import.meta.glob('../assets/cataclysme/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });

// Images des boss champions (ancien champions du Hall of Fame)
const CHAMPION_BOSS_IMAGES = import.meta.glob('../assets/cataclysme/ChampBoss/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });

const weaponImageModules = import.meta.glob('../assets/weapons/*.png', { eager: true, import: 'default' });

const getWeaponImage = (imageFile) => {
  if (!imageFile) return null;
  return weaponImageModules[`../assets/weapons/${imageFile}`] || null;
};

// Extraire le nom du boss depuis le nom de fichier (sans extension)
function getBossNameFromPath(path) {
  if (!path) return 'Cataclysme';
  const filename = decodeURIComponent((path.split('/').pop() || '').trim());
  return filename.replace(/\.[^/.]+$/, '');
}

// Liste des noms de boss génériques (noms de fichiers)
const GENERIC_BOSS_NAMES = Object.keys(CATACLYSM_IMAGES)
  .sort((a, b) => a.localeCompare(b, 'fr'))
  .map(path => getBossNameFromPath(path));

// Liste des noms de boss champions (noms de fichiers dans ChampBoss/)
const CHAMPION_BOSS_NAMES = Object.keys(CHAMPION_BOSS_IMAGES)
  .sort((a, b) => a.localeCompare(b, 'fr'))
  .map(path => getBossNameFromPath(path));

// Retourne un index de semaine qui change le samedi à midi
function getWeekSeed() {
  const now = new Date();
  // Reculer au dernier samedi midi
  // jour 0=dim, 6=sam
  const day = now.getDay();
  const hour = now.getHours();
  // Nombre de jours depuis samedi midi dernier
  let daysSinceSat = (day - 6 + 7) % 7;
  if (daysSinceSat === 0 && hour < 12) daysSinceSat = 7; // avant samedi midi = semaine précédente
  const lastSatNoon = new Date(now);
  lastSatNoon.setDate(now.getDate() - daysSinceSat);
  lastSatNoon.setHours(12, 0, 0, 0);
  // Seed = timestamp du samedi midi en jours (stable pour toute la semaine)
  return Math.floor(lastSatNoon.getTime() / (1000 * 60 * 60 * 24));
}

// Piocher un boss déterministe par semaine (change le samedi à midi)
function pickWeeklyBoss() {
  const entries = Object.entries(CATACLYSM_IMAGES)
    .sort(([a], [b]) => a.localeCompare(b, 'fr'));
  if (entries.length === 0) return { name: WORLD_BOSS.nom, image: null };
  const seed = getWeekSeed();
  const index = seed % entries.length;
  const [sourcePath, imagePath] = entries[index];
  return { name: getBossNameFromPath(sourcePath), image: imagePath };
}

function getCataclysmImageByName(name) {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  const entries = Object.entries(CATACLYSM_IMAGES);
  for (const [sourcePath, imagePath] of entries) {
    if (getBossNameFromPath(sourcePath).trim().toLowerCase() === normalized) {
      return imagePath;
    }
  }
  return null;
}

function getChampionBossImage(championName) {
  if (!championName) return null;
  const normalized = championName.trim().toLowerCase().replace(/\s+/g, '');
  const entries = Object.entries(CHAMPION_BOSS_IMAGES);
  
  // Chercher une image qui correspond au nom du champion
  for (const [path, img] of entries) {
    const pathLower = path.toLowerCase().replace(/\s+/g, '');
    if (pathLower.includes(normalized)) {
      return img;
    }
  }
  return null;
}

function getNextMondayAt18() {
  const now = new Date();
  const target = new Date(now);
  const day = now.getDay(); // 0=dim, 1=lun
  let daysUntilMonday = (1 - day + 7) % 7;
  if (daysUntilMonday === 0 && now.getHours() >= 18) {
    daysUntilMonday = 7;
  }
  target.setDate(now.getDate() + daysUntilMonday);
  target.setHours(18, 0, 0, 0);
  return target;
}

const STAT_LABELS = {
  hp: 'HP', auto: 'Auto', def: 'Déf', cap: 'Cap', rescap: 'ResC', spd: 'VIT'
};

const Tooltip = ({ children, content }) => (
  <span className="relative group cursor-help">
    {children}
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-stone-900 border border-red-500 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
      {content}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-500"></span>
    </span>
  </span>
);

const getForestBoosts = (character) => ({ ...getEmptyStatBoosts(), ...(character?.forestBoosts || {}) });

const getPassiveDetails = (passive) => {
  if (!passive) return null;
  const base = getMageTowerPassiveById(passive.id);
  const levelData = getMageTowerPassiveLevel(passive.id, passive.level);
  if (!base || !levelData) return null;
  return { ...base, level: passive.level, levelData };
};

const getWeaponStatColor = (value) => {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-stone-300';
};

const formatWeaponStats = (weapon) => {
  if (!weapon?.stats) return null;
  const entries = Object.entries(weapon.stats).filter(([, v]) => v !== 0);
  if (entries.length === 0) return null;
  return entries.map(([stat, value]) => (
    <span key={stat} className={`font-semibold ${getWeaponStatColor(value)}`}>
      {STAT_LABELS[stat] || stat} {value > 0 ? `+${value}` : value}
    </span>
  )).reduce((acc, node, index) => {
    if (index === 0) return [node];
    return acc.concat([<span key={`sep-${index}`} className="text-stone-400"> • </span>, node]);
  }, []);
};

const getWeaponTooltipContent = (weapon) => {
  if (!weapon) return null;
  const stats = weapon.stats ? Object.entries(weapon.stats).filter(([, v]) => v !== 0) : [];
  return (
    <span className="block whitespace-normal text-xs">
      <span className="block font-semibold text-white">{weapon.nom}</span>
      <span className="block text-stone-300">{weapon.description}</span>
      {weapon.effet && typeof weapon.effet === 'object' ? (
        <span className="block text-amber-200">
          Effet: {weapon.effet.nom} — {weapon.effet.description}
        </span>
      ) : null}
      {stats.length > 0 ? (
        <span className="block text-stone-200">
          Stats: {stats.map(([stat, value]) => `${STAT_LABELS[stat] || stat} ${value > 0 ? `+${value}` : value}`).join(' • ')}
        </span>
      ) : null}
    </span>
  );
};

const WorldBoss = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Données
  const [character, setCharacter] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [nextLaunchCountdown, setNextLaunchCountdown] = useState('');

  // Boss aléatoire (choisi une fois au montage)
  const boss = useMemo(() => pickWeeklyBoss(), []);
  const activeBossName = eventData?.bossName || boss.name;
  const activeBossImage = useMemo(() => {
    // Toujours essayer l'image champion par nom du boss (au cas où isChampionBoss serait faux côté event mais le nom correspond à un champion)
    const championImage = getChampionBossImage(activeBossName || eventData?.championName);
    if (championImage) return championImage;
    // Sinon, image générique du cataclysme par nom
    return getCataclysmImageByName(activeBossName) || boss.image;
  }, [activeBossName, eventData?.championName, boss.image]);

  // Combat - player state pour CharacterCard
  const [playerState, setPlayerState] = useState(null);
  const [bossState, setBossState] = useState(null);
  const [playerCombatBase, setPlayerCombatBase] = useState(null);
  const [bossCombatBase, setBossCombatBase] = useState(null);
  const [playerCombatModifiers, setPlayerCombatModifiers] = useState(null);
  const [playerCombatStatus, setPlayerCombatStatus] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [combatResult, setCombatResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [winner, setWinner] = useState(null);
  const [phase, setPhase] = useState('pre'); // 'pre' ou 'combat'
  const replayTokenRef = useRef(0);
  const logEndRef = useRef(null);
  const logContainerRef = useRef(null);

  // Musique
  const bossAudioRef = useRef(null);
  const [volume, setVolume] = useState(0.05);
  const [isMuted, setIsMuted] = useState(false);
  const [isSoundOpen, setIsSoundOpen] = useState(false);

  // Fond de page custom
  useEffect(() => {
    document.body.classList.add('cataclysm-bg');
    return () => document.body.classList.remove('cataclysm-bg');
  }, []);

  // Chargement initial du personnage
  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      const charResult = await getUserCharacter(currentUser.uid);

      if (charResult.success && charResult.data) {
        const char = charResult.data;
        let weaponId = char.equippedWeaponId || null;
        let weaponData = weaponId ? getWeaponById(weaponId) : null;
        if (!weaponData) {
          const weaponResult = await getEquippedWeapon(char.userId || currentUser.uid);
          weaponData = weaponResult.success ? weaponResult.weapon : null;
          weaponId = weaponResult.success ? weaponResult.weapon?.id || null : null;
        }
        setCharacter(normalizeCharacterBonuses({
          ...char,
          level: char.level ?? 1,
          equippedWeaponData: weaponData,
          equippedWeaponId: weaponId
        }));
      }

      // Auto-launch si c'est lundi >= 18h et event inactif (avec champions dans le pool)
      await checkAutoLaunch(GENERIC_BOSS_NAMES, CHAMPION_BOSS_NAMES);
      // Auto-end si c'est samedi >= 12h
      await checkAutoEnd();

      setLoading(false);
    };
    load();
  }, [currentUser]);

  // Vérification périodique pour garantir l'auto-end/auto-launch même si la page reste ouverte
  useEffect(() => {
    const runChecks = async () => {
      await checkAutoLaunch(GENERIC_BOSS_NAMES, CHAMPION_BOSS_NAMES);
      await checkAutoEnd();
    };

    runChecks();
    const interval = setInterval(runChecks, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Listeners temps réel : HP du boss + leaderboard (se mettent à jour en live)
  useEffect(() => {
    const unsubEvent = onWorldBossEventChange((data) => {
      setEventData(data);
    });
    const unsubLeaderboard = onLeaderboardChange((entries) => {
      setLeaderboard(entries);
    });
    return () => {
      unsubEvent();
      unsubLeaderboard();
    };
  }, []);

  // Countdown vers le prochain lancement (lundi 18h)
  useEffect(() => {
    if (eventData?.status !== EVENT_STATUS.FINISHED && eventData?.status !== EVENT_STATUS.INACTIVE) {
      setNextLaunchCountdown('');
      return;
    }

    const updateCountdown = () => {
      const target = getNextMondayAt18();
      const diff = target - new Date();

      if (diff <= 0) {
        setNextLaunchCountdown('Lancement imminent...');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const parts = [];
      if (days > 0) parts.push(`${days}j`);
      parts.push(`${String(hours).padStart(2, '0')}h`);
      parts.push(`${String(minutes).padStart(2, '0')}m`);
      parts.push(`${String(seconds).padStart(2, '0')}s`);
      setNextLaunchCountdown(parts.join(' '));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [eventData?.status]);

  // Countdown vers samedi 12h
  useEffect(() => {
    const getNextSaturdayNoon = () => {
      const now = new Date();
      const day = now.getDay(); // 0=dim, 6=sam
      let daysUntilSat = (6 - day + 7) % 7;
      if (daysUntilSat === 0 && now.getHours() >= 12) daysUntilSat = 7;
      const target = new Date(now);
      target.setDate(now.getDate() + daysUntilSat);
      target.setHours(12, 0, 0, 0);
      return target;
    };

    const updateCountdown = () => {
      const target = getNextSaturdayNoon();
      const diff = target - new Date();
      if (diff <= 0) {
        setCountdown('Terminé');
        checkAutoEnd();
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const parts = [];
      if (days > 0) parts.push(`${days}j`);
      parts.push(`${String(hours).padStart(2, '0')}h`);
      parts.push(`${String(minutes).padStart(2, '0')}m`);
      parts.push(`${String(seconds).padStart(2, '0')}s`);
      setCountdown(parts.join(' '));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Musique dès l'ouverture
  useEffect(() => {
    if (!loading && bossAudioRef.current) {
      bossAudioRef.current.volume = volume;
      bossAudioRef.current.muted = isMuted;
      bossAudioRef.current.play().catch(() => {});
    }
    return () => {
      if (bossAudioRef.current) bossAudioRef.current.pause();
    };
  }, [loading]);

  // Sync volume
  useEffect(() => {
    if (bossAudioRef.current) {
      bossAudioRef.current.volume = volume;
      bossAudioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Auto-scroll du conteneur de logs uniquement (pas la page)
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [combatLog]);

  // Contrôle son
  const SoundControl = () => (
    <div className="fixed top-20 right-4 z-50 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setIsSoundOpen(prev => !prev)}
        className="bg-red-800 text-white border border-red-500 px-3 py-2 text-sm font-bold shadow-lg hover:bg-red-700"
      >
        {isMuted || volume === 0 ? '🔇' : '🔊'} Son
      </button>
      {isSoundOpen && (
        <div className="bg-stone-900 border border-stone-600 p-3 w-56 shadow-xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsMuted(prev => !prev);
                if (isMuted && volume === 0) setVolume(0.05);
              }}
              className="text-lg"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                setIsMuted(v === 0);
              }}
              className="w-full accent-red-500"
            />
            <span className="text-xs text-stone-200 w-10 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const getCalculatedDescription = getCalculatedClassDescription;

  // === formatLogMessage (identique à Combat.jsx) ===
  const formatLogMessage = (text, isP1) => {
    const p1Name = playerState?.name || character?.name || 'Joueur';
    const p2Name = activeBossName;
    let key = 0;

    const processText = (str) => {
      const result = [];
      const nameRegex = new RegExp(`(${p1Name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${p2Name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
      const nameParts = str.split(nameRegex);

      nameParts.forEach((part) => {
        if (part === p1Name) {
          result.push(<span key={`name-${key++}`} className="font-bold text-blue-400">{part}</span>);
        } else if (part === p2Name) {
          result.push(<span key={`name-${key++}`} className="font-bold text-orange-400">{part}</span>);
        } else if (part) {
          const numRegex = /(\d+)\s*(points?\s*de\s*(?:vie|dégâts?|dommages?))/gi;
          let lastIndex = 0;
          let match;
          const subParts = [];

          while ((match = numRegex.exec(part)) !== null) {
            if (match.index > lastIndex) subParts.push(part.slice(lastIndex, match.index));
            const isHeal = match[2].toLowerCase().includes('vie');
            const colorClass = isHeal ? 'font-bold text-green-400' : 'font-bold text-red-400';
            subParts.push(<span key={`num-${key++}`} className={colorClass}>{match[1]}</span>);
            subParts.push(` ${match[2]}`);
            lastIndex = match.index + match[0].length;
          }
          if (lastIndex < part.length) subParts.push(part.slice(lastIndex));
          if (subParts.length > 0) result.push(...subParts);
        }
      });
      return result;
    };
    return processText(text);
  };

  // === Carte du Boss (image plus grande) ===
  const BossCard = () => {
    const bossCurrentHP = bossState?.currentHP ?? 0;
    const bossMax = bossState?.maxHP ?? WORLD_BOSS.baseStats.hp;
    const hpPct = bossMax > 0 ? (bossCurrentHP / bossMax) * 100 : 100;
    const hpClass = hpPct > 50 ? 'bg-red-600' : hpPct > 25 ? 'bg-orange-500' : 'bg-yellow-500';

    return (
      <div className="relative shadow-2xl overflow-visible">
        <div className="overflow-visible">
          <div className="h-auto relative bg-stone-900 flex items-center justify-center">
            {activeBossImage ? (
              <img src={activeBossImage} alt={activeBossName} className="w-full h-auto object-contain" style={{ minHeight: '400px' }} />
            ) : (
              <div className="w-full flex items-center justify-center bg-stone-800" style={{ minHeight: '400px' }}>
                <span className="text-8xl">☄️</span>
              </div>
            )}
          </div>
          <div className="bg-stone-800 p-4 border-t border-red-800">
            {/* Stats du boss */}
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-red-300">Auto: {eventData?.bossStats?.auto || WORLD_BOSS.baseStats.auto}</div>
              <div className="text-red-300">Déf: {eventData?.bossStats?.def || WORLD_BOSS.baseStats.def}</div>
              <div className="text-red-300">Cap: {eventData?.bossStats?.cap || WORLD_BOSS.baseStats.cap}</div>
              <div className="text-red-300">ResC: {eventData?.bossStats?.rescap || WORLD_BOSS.baseStats.rescap}</div>
            </div>
            <div className="bg-red-900/50 p-2 text-xs border border-red-700 text-red-300">
              <span className="text-lg">☠️</span> Tour 10 : EXTINCTION — Mort instantanée du joueur
            </div>
          </div>
        </div>
      </div>
    );
  };

  const LeaderboardPanel = () => (
    <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-lg overflow-hidden">
      <div className="bg-stone-900/60 px-4 py-2.5 border-b border-stone-700/60">
        <h3 className="text-xs font-bold text-amber-400/90 uppercase tracking-widest text-center">Participants</h3>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {leaderboard.length === 0 ? (
          <p className="text-stone-500 text-xs text-center py-4 italic">Aucun participant</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-stone-900/60 sticky top-0">
              <tr>
                <th className="text-left text-stone-400 px-3 py-2">#</th>
                <th className="text-left text-stone-400 px-3 py-2">Nom</th>
                <th className="text-right text-stone-400 px-3 py-2">Dégâts</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => (
                <tr key={entry.id} className={`border-t border-stone-700/40 ${entry.characterId === character?.userId ? 'bg-amber-900/30' : ''}`}>
                  <td className="px-3 py-1.5 text-stone-500">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className="px-3 py-1.5 text-stone-200 truncate max-w-[120px]">{entry.characterName}</td>
                  <td className="px-3 py-1.5 text-amber-400 font-mono text-right">{(entry.totalDamage || 0).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // === Tentatives restantes ===
  const [attemptInfo, setAttemptInfo] = useState(null);

  const refreshAttemptInfo = async () => {
    if (!character || !currentUser) return;
    const charId = character.userId || currentUser.uid;
    const info = await canAttemptBoss(charId);
    setAttemptInfo(info);
  };

  useEffect(() => {
    if (character && eventData?.status === EVENT_STATUS.ACTIVE) {
      refreshAttemptInfo();
    }
  }, [character, eventData?.status]);

  // === Lancer le combat ===
  const [attemptError, setAttemptError] = useState(null);

  const handleFight = async () => {
    if (!character || !eventData || eventData.status !== EVENT_STATUS.ACTIVE || isSimulating) return;
    setAttemptError(null);

    // Vérifier si le joueur peut tenter le boss
    const charId = character.userId || currentUser.uid;
    const check = await canAttemptBoss(charId);
    if (!check.canAttempt) {
      setAttemptError(check.reason);
      return;
    }

    setIsSimulating(true);
    setWinner(null);
    setCombatResult(null);
    setCombatLog([]);
    setPhase('combat');

    replayTokenRef.current++;
    const currentToken = replayTokenRef.current;

    // Pour les boss champions : toujours charger les stats depuis archivedCharacters (source de vérité)
    // pour éviter dégâts trop hauts / trop bas si l'event a été sauvegardé avec de mauvaises stats.
    // Sinon utiliser bossStats de l'event (boss générique).
    let bossStatsToUse = eventData.bossStats;
    if (eventData.isChampionBoss && eventData.originalChampion?.userId) {
      const championStats = await getChampionBossStatsByUserId(eventData.originalChampion.userId);
      if (championStats) bossStatsToUse = championStats;
    }
    const bossNameForSim = eventData.bossName || activeBossName || WORLD_BOSS.nom;
    const result = simulerWorldBossCombat(character, eventData.hpRemaining, bossStatsToUse, bossNameForSim);

    // Init les states de combat pour les cards
    setPlayerCombatBase(null);
    setBossCombatBase(null);
    setPlayerCombatModifiers(null);
    setPlayerCombatStatus(null);
    setPlayerState({
      ...character,
      currentHP: result.p1MaxHP,
      maxHP: result.p1MaxHP,
      shield: 0
    });
    setBossState({
      currentHP: result.bossMaxHP,
      maxHP: result.bossMaxHP,
      shield: 0
    });

    await replayCombatSteps(result.steps, {
      setCombatLog: (logs) => {
        if (replayTokenRef.current !== currentToken) return;
        setCombatLog(typeof logs === 'function' ? logs : Array.isArray(logs) ? logs : []);
      },
      onStepHP: (step) => {
        if (replayTokenRef.current !== currentToken) return;
        setPlayerCombatBase(step.p1Base ?? undefined);
        setBossCombatBase(step.p2Base ?? undefined);
        setPlayerCombatModifiers(step.p1Modifiers ?? null);
        setPlayerCombatStatus(step.p1Status ?? null);
        setPlayerState(prev => prev ? { ...prev, currentHP: Math.min(prev.maxHP, Math.max(0, step.p1HP)), shield: step.p1Shield || 0 } : prev);
        setBossState(prev => prev ? { ...prev, currentHP: Math.min(prev.maxHP, Math.max(0, step.p2HP)), shield: step.p2Shield || 0 } : prev);
      },
      speed: 'normal'
    });

    if (replayTokenRef.current !== currentToken) return;

    setIsSimulating(false);
    setCombatResult(result);

    // Enregistrer les dégâts dans Firestore (met à jour HP boss + leaderboard en temps réel)
    if (result.damageDealt > 0) {
      const charId = character.userId || currentUser.uid;
      await recordAttemptDamage(charId, character.name, result.damageDealt);
    }

    // Refresh les tentatives restantes
    await refreshAttemptInfo();
  };

  // === Variables ===
  const isActive = eventData?.status === EVENT_STATUS.ACTIVE;
  const globalHpPercent = eventData ? Math.max(0, (eventData.hpRemaining / eventData.hpMax) * 100) : 0;
  const globalHpBarColor = globalHpPercent > 50 ? 'bg-red-600' : globalHpPercent > 25 ? 'bg-orange-500' : 'bg-yellow-500';

  // === LOADING ===
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-red-400 text-2xl animate-pulse">Chargement...</div>
        <audio ref={bossAudioRef} loop>
          <source src="/assets/music/cataclysm.mp3" type="audio/mpeg" />
        </audio>
      </div>
    );
  }

  // === EVENT INACTIF ===
  if (!isActive) {
    if (eventData?.status === EVENT_STATUS.FINISHED) {
      const topParticipants = leaderboard.slice(0, 3);
      const totalDamage = leaderboard.reduce((acc, entry) => acc + (entry.totalDamage || 0), 0);
      return (
        <div className="min-h-screen p-6">
          <Header />
          <SoundControl />
          <div className="max-w-4xl mx-auto pt-20 text-center">
            <h1 className="text-5xl font-bold text-red-500 mb-6">🏁 Cataclysme terminé</h1>
            <div className="bg-stone-800/90 border-2 border-stone-600 p-8 text-left space-y-6">
              <div className="text-center">
                <p className="text-stone-200 text-xl font-semibold">{activeBossName} a été vaincu.</p>
                <p className="text-stone-400 mt-2">Un nouveau boss arrivera automatiquement lundi à 18h.</p>
                <p className="text-amber-300 font-mono text-lg mt-3">⏳ {nextLaunchCountdown || 'Calcul en cours...'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-stone-900/70 border border-stone-600 p-4">
                  <div className="text-stone-400 text-xs uppercase">Tentatives totales</div>
                  <div className="text-2xl text-amber-300 font-bold">{(eventData.totalAttempts || 0).toLocaleString('fr-FR')}</div>
                </div>
                <div className="bg-stone-900/70 border border-stone-600 p-4">
                  <div className="text-stone-400 text-xs uppercase">Combattants</div>
                  <div className="text-2xl text-amber-300 font-bold">{leaderboard.length.toLocaleString('fr-FR')}</div>
                </div>
                <div className="bg-stone-900/70 border border-stone-600 p-4">
                  <div className="text-stone-400 text-xs uppercase">Dégâts cumulés</div>
                  <div className="text-2xl text-amber-300 font-bold">{totalDamage.toLocaleString('fr-FR')}</div>
                </div>
              </div>

              <div className="bg-stone-900/70 border border-stone-600 p-4">
                <h2 className="text-amber-400 font-bold mb-3">🏅 Top 3 des héros</h2>
                {topParticipants.length === 0 ? (
                  <p className="text-stone-500 italic text-sm">Aucun participant enregistré pour ce Cataclysme.</p>
                ) : (
                  <ol className="space-y-2">
                    {topParticipants.map((entry, i) => (
                      <li key={entry.id} className="flex justify-between text-stone-200 border-b border-stone-700 pb-2">
                        <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {entry.characterName}</span>
                        <span className="font-mono text-amber-300">{(entry.totalDamage || 0).toLocaleString('fr-FR')}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
            </div>
          </div>
          <audio ref={bossAudioRef} loop>
            <source src="/assets/music/cataclysm.mp3" type="audio/mpeg" />
          </audio>
        </div>
      );
    }

    return (
      <div className="min-h-screen p-6">
        <Header />
        <SoundControl />
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-red-950/80 border border-red-800/80 rounded-lg px-6 py-2 shadow">
              <h1 className="text-3xl font-bold text-red-400">☄️ Cataclysme</h1>
            </div>
          </div>
          <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl p-8">
            <p className="text-stone-400 text-xl">L&apos;event n&apos;est pas actif pour le moment</p>
            <p className="text-stone-500 mt-2">Revenez plus tard !</p>
          </div>
        </div>
        <audio ref={bossAudioRef} loop>
          <source src="/assets/music/cataclysm.mp3" type="audio/mpeg" />
        </audio>
      </div>
    );
  }

  // === PAS DE PERSO ===
  if (!character) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <SoundControl />
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <h1 className="text-5xl font-bold text-red-500 mb-6">☄️ {activeBossName}</h1>
          <div className="bg-stone-800/90 border-2 border-stone-600 p-8">
            <p className="text-stone-400 text-xl">Tu n&apos;as pas de personnage actif.</p>
            <button onClick={() => navigate('/')} className="mt-4 bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 font-bold transition">
              Créer un personnage
            </button>
          </div>
        </div>
        <audio ref={bossAudioRef} loop>
          <source src="/assets/music/cataclysm.mp3" type="audio/mpeg" />
        </audio>
      </div>
    );
  }

  // === PAGE PRINCIPALE ===
  return (
    <div className="min-h-screen p-4 md:p-6">
      <Header />
      <SoundControl />

      <audio ref={bossAudioRef} loop>
        <source src="/assets/music/cataclysm.mp3" type="audio/mpeg" />
      </audio>

      <div className="max-w-[1800px] mx-auto pt-16">
        {/* Titre */}
        <div className="flex justify-center mb-4">
          <div className="bg-red-950/80 border border-red-800/80 rounded-lg px-6 py-2 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <h1 className="text-3xl md:text-4xl font-black text-red-400 tracking-wide">
              ☄️ {activeBossName}
            </h1>
          </div>
        </div>

        {/* Barre de vie globale */}
        <div className="max-w-3xl mx-auto mb-6">
          <div className="bg-stone-950/85 border border-red-900/60 rounded-xl p-3 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-red-400 font-bold text-sm tracking-wider uppercase">PV du Boss</span>
              <span className="text-stone-300 font-mono text-sm">
                {eventData.hpRemaining.toLocaleString('fr-FR')} / {eventData.hpMax.toLocaleString('fr-FR')}
              </span>
            </div>
            <div className="relative w-full bg-stone-800 h-7 overflow-hidden rounded-md border border-red-900/40">
              <div
                className={`h-full ${globalHpBarColor} transition-all duration-700`}
                style={{ width: `${globalHpPercent}%` }}
              />
              {[25, 50, 75].map(tick => (
                <div key={tick} className="absolute top-0 bottom-0 w-px bg-stone-600/50" style={{ left: `${tick}%` }} />
              ))}
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-stone-500">
              <span>{globalHpPercent.toFixed(1)}%</span>
              <span>⏰ Fin : {countdown}</span>
              <span>{eventData.totalAttempts || 0} tentatives</span>
            </div>
          </div>
        </div>

        {/* LAYOUT */}
        {phase === 'pre' ? (
          <div className="flex flex-col items-center gap-6">
            {/* Joueur | Action | Boss */}
            <div className="flex flex-col md:flex-row gap-4 items-start justify-center w-full">
              <div className="w-full md:w-[340px] lg:w-auto md:flex-shrink-0 order-1">
                <CharacterCardContent character={{ ...character, currentHP: character.base?.hp ?? 0, maxHP: character.base?.hp ?? 0, shield: 0 }} showHpBar={true} imageOverride={character.characterImage || testImage1} detailsPlacement="left" />
              </div>

              <div className="w-full md:w-[350px] flex flex-col items-center justify-center gap-5 py-10 order-2">
                <div className="text-6xl">⚔️</div>
                {attemptInfo && (
                  <p className={`text-sm font-semibold ${attemptInfo.canAttempt ? 'text-amber-400' : 'text-red-400'}`}>
                    {attemptInfo.canAttempt
                      ? `${attemptInfo.attemptsLeft} / 2 tentative${attemptInfo.attemptsLeft > 1 ? 's' : ''} restante${attemptInfo.attemptsLeft > 1 ? 's' : ''} aujourd'hui`
                      : 'Plus de tentatives aujourd\'hui'}
                  </p>
                )}
                <button
                  onClick={handleFight}
                  disabled={attemptInfo && !attemptInfo.canAttempt}
                  className="bg-red-700 hover:bg-red-600 disabled:bg-stone-600 disabled:text-stone-400 disabled:border-stone-500 text-white px-10 py-3 font-bold text-lg rounded-lg shadow-2xl border-2 border-red-500 hover:border-red-300 transition-all"
                >
                  ☄️ Affronter {activeBossName}
                </button>
                <p className="text-stone-500 text-xs">2 tentatives par jour (non cumulables)</p>
                {attemptError && (
                  <p className="text-red-400 text-sm text-center bg-red-900/30 border border-red-700 rounded-lg px-4 py-2">{attemptError}</p>
                )}
              </div>

              <div className="w-full md:w-[440px] md:flex-shrink-0 order-3">
                <BossCard />
              </div>
            </div>

            {/* Leaderboard en dessous, centré */}
            <div className="w-full max-w-md">
              <LeaderboardPanel />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Joueur | Logs | Boss */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
              <div className="order-1 w-full md:w-[340px] lg:w-auto md:flex-shrink-0">
                {playerState && <CharacterCardContent character={playerState} showHpBar currentHP={playerState.currentHP} maxHP={playerState.maxHP} shield={playerState.shield} imageOverride={playerState.characterImage || testImage1} combatBaseOverride={playerCombatBase} combatModifiers={playerCombatModifiers} combatStatus={playerCombatStatus} detailsPlacement="left" />}
              </div>

              <div className="order-2 w-full md:w-[600px] lg:w-[500px] lg:flex-1 lg:min-w-[400px] md:flex-shrink-0 lg:flex-shrink flex flex-col">
                <div className="flex justify-center gap-3 md:gap-4 mb-4">
                  <button
                    onClick={handleFight}
                    disabled={isSimulating}
                    className="bg-red-700 hover:bg-red-600 disabled:bg-stone-600 disabled:text-stone-400 text-white px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base rounded-lg transition-all shadow-lg border-2 border-red-500"
                  >
                    {isSimulating ? '⚔️ En cours...' : '▶️ Relancer'}
                  </button>
                  <button
                    onClick={() => { setPhase('pre'); setCombatLog([]); setWinner(null); setCombatResult(null); setPlayerState(null); setBossState(null); setPlayerCombatBase(null); setBossCombatBase(null); setPlayerCombatModifiers(null); setPlayerCombatStatus(null); }}
                    className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base rounded-lg transition-all shadow-lg border border-stone-500"
                  >
                    ← Retour
                  </button>
                </div>

                {combatResult && !isSimulating && (
                  <div className="flex justify-center mb-4">
                    <div className={`px-8 py-3 font-bold text-xl shadow-2xl rounded-lg border-2 ${
                      combatResult.reachedExtinction ? 'bg-red-900 text-red-300 border-red-600' :
                      !combatResult.playerDied ? 'bg-green-900 text-green-300 border-green-600' :
                      'bg-orange-900 text-orange-300 border-orange-600'
                    }`}>
                      {combatResult.reachedExtinction && '☠️ EXTINCTION'}
                      {!combatResult.reachedExtinction && combatResult.playerDied && '💀 Défaite'}
                      {!combatResult.reachedExtinction && !combatResult.playerDied && '🎉 Victoire !'}
                      {' — '}{combatResult.damageDealt.toLocaleString('fr-FR')} dégâts
                    </div>
                  </div>
                )}

                <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col h-[480px] md:h-[600px] overflow-hidden">
                  <div className="bg-stone-900/60 p-3 border-b border-red-900/40">
                    <h2 className="text-lg md:text-2xl font-bold text-red-400 text-center">☄️ Combat en direct</h2>
                  </div>
                  <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
                    {combatLog.length === 0 ? (
                      <p className="text-stone-500 italic text-center py-6 md:py-8 text-xs md:text-sm">Le combat va commencer...</p>
                    ) : (
                      <>
                        {combatLog.map((log, idx) => {
                          const isP1 = log.startsWith('[P1]');
                          const isP2 = log.startsWith('[P2]');
                          const cleanLog = log.replace(/^\[P[12]\]\s*/, '');

                          if (!isP1 && !isP2) {
                            if (log.includes('EXTINCTION')) {
                              return (
                                <div key={idx} className="flex justify-center my-4">
                                  <div className="bg-red-900 text-red-200 px-6 py-3 font-bold text-lg shadow-lg rounded-lg border-2 border-red-600 animate-pulse">
                                    {formatLogMessage(cleanLog, false)}
                                  </div>
                                </div>
                              );
                            }
                            if (log.includes('🏆') || log.includes('🎉')) {
                              return (
                                <div key={idx} className="flex justify-center my-4">
                                  <div className="bg-stone-100 text-stone-900 px-6 py-3 font-bold text-lg shadow-lg rounded-lg border border-stone-400">
                                    {formatLogMessage(cleanLog, false)}
                                  </div>
                                </div>
                              );
                            }
                            if (log.includes('---')) {
                              return (
                                <div key={idx} className="flex justify-center my-3">
                                  <div className="bg-stone-700 text-stone-200 px-4 py-1 text-sm font-bold rounded border border-stone-500">
                                    {cleanLog}
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div key={idx} className="flex justify-center">
                                <div className="text-stone-400 text-sm italic">{formatLogMessage(cleanLog, false)}</div>
                              </div>
                            );
                          }

                          if (isP1) {
                            return (
                              <div key={idx} className="flex justify-start">
                                <div className="max-w-[80%]">
                                  <div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-l-4 border-blue-500">
                                    <div className="text-xs md:text-sm">{formatLogMessage(cleanLog, true)}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          if (isP2) {
                            return (
                              <div key={idx} className="flex justify-end">
                                <div className="max-w-[80%]">
                                  <div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-r-4 border-red-500">
                                    <div className="text-xs md:text-sm">{formatLogMessage(cleanLog, false)}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        })}
                        <div ref={logEndRef} />
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="order-3 w-full md:w-[440px] md:flex-shrink-0">
                <BossCard />
              </div>
            </div>

            {/* Leaderboard en dessous, centré */}
            <div className="w-full max-w-md mx-auto">
              <LeaderboardPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorldBoss;
