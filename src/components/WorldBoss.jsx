import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import { getUserCharacter } from '../services/characterService';
import { getWorldBossEvent, getLeaderboard, onWorldBossEventChange, onLeaderboardChange, recordAttemptDamage, canAttemptBoss, checkAutoLaunch, checkAutoEnd } from '../services/worldBossService';
import { getEquippedWeapon } from '../services/dungeonService';
import { simulerWorldBossCombat } from '../utils/worldBossCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { WORLD_BOSS, EVENT_STATUS } from '../data/worldBoss';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
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

// Liste des noms de boss génériques (pour l'auto-launch)
const GENERIC_BOSS_NAMES = Object.keys(CATACLYSM_IMAGES)
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
  const entries = Object.entries(weapon.stats);
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
  const stats = weapon.stats ? Object.entries(weapon.stats) : [];
  return (
    <span className="block whitespace-normal text-xs">
      <span className="block font-semibold text-white">{weapon.nom}</span>
      <span className="block text-stone-300">{weapon.description}</span>
      {weapon.effet && (
        <span className="block text-amber-200">
          Effet: {weapon.effet.nom} — {weapon.effet.description}
        </span>
      )}
      {stats.length > 0 && (
        <span className="block text-stone-200">
          Stats: {stats.map(([stat, value]) => `${STAT_LABELS[stat] || stat} ${value > 0 ? `+${value}` : value}`).join(' • ')}
        </span>
      )}
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
    // Si c'est un boss champion, chercher son image dans ChampBoss/
    if (eventData?.isChampionBoss && eventData?.championName) {
      const championImage = getChampionBossImage(eventData.championName);
      if (championImage) return championImage;
    }
    // Sinon, utiliser l'image normale du cataclysme
    return getCataclysmImageByName(activeBossName) || boss.image;
  }, [activeBossName, eventData?.isChampionBoss, eventData?.championName, boss.image]);

  // Combat - player state pour CharacterCard
  const [playerState, setPlayerState] = useState(null);
  const [bossState, setBossState] = useState(null);
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

      // Auto-launch si c'est lundi >= 18h et event inactif
      await checkAutoLaunch(activeBossName);
      // Auto-end si c'est samedi >= 12h
      await checkAutoEnd();

      setLoading(false);
    };
    load();
  }, [currentUser]);

  // Vérification périodique pour garantir l'auto-end/auto-launch même si la page reste ouverte
  useEffect(() => {
    const runChecks = async () => {
      await checkAutoLaunch(activeBossName);
      await checkAutoEnd();
    };

    runChecks();
    const interval = setInterval(runChecks, 60 * 1000);
    return () => clearInterval(interval);
  }, [activeBossName]);

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

  // === getCalculatedDescription (identique à Combat.jsx) ===
  const getCalculatedDescription = (className, cap, auto) => {
    switch(className) {
      case 'Guerrier': {
        const { ignoreBase, ignorePerCap, autoBonus } = classConstants.guerrier;
        const ignoreBasePct = Math.round(ignoreBase * 100);
        const ignoreBonusPct = Math.round(ignorePerCap * cap * 100);
        const ignoreTotalPct = ignoreBasePct + ignoreBonusPct;
        return (
          <>
            +{autoBonus} Auto | Frappe résistance faible & ignore{' '}
            <Tooltip content={`Base: ${ignoreBasePct}% | Bonus (Cap ${cap}): +${ignoreBonusPct}%`}>
              <span className="text-green-400">{ignoreTotalPct}%</span>
            </Tooltip>
          </>
        );
      }

      case 'Voleur': {
        const { spdBonus, critPerCap } = classConstants.voleur;
        const critBonusPct = Math.round(critPerCap * cap * 100);
        return (
          <>
            +{spdBonus} VIT | Esquive 1 coup
            <Tooltip content={`Bonus (Cap ${cap}): +${critBonusPct}%`}>
              <span className="text-green-400"> | +{critBonusPct}% crit</span>
            </Tooltip>
          </>
        );
      }

      case 'Paladin': {
        const { reflectBase, reflectPerCap } = classConstants.paladin;
        const reflectBasePct = Math.round(reflectBase * 100);
        const reflectBonusPct = Math.round(reflectPerCap * cap * 100);
        const reflectTotalPct = reflectBasePct + reflectBonusPct;
        return (
          <>
            Renvoie{' '}
            <Tooltip content={`Base: ${reflectBasePct}% | Bonus (Cap ${cap}): +${reflectBonusPct}%`}>
              <span className="text-green-400">{reflectTotalPct}%</span>
            </Tooltip>
            {' '}des dégâts reçus
          </>
        );
      }

      case 'Healer': {
        const { missingHpPercent, capScale } = classConstants.healer;
        const missingPct = Math.round(missingHpPercent * 100);
        const healValue = Math.round(capScale * cap);
        return (
          <>
            Heal {missingPct}% PV manquants +{' '}
            <Tooltip content={`0.35 × Cap (${cap}) = ${healValue}`}>
              <span className="text-green-400">{healValue}</span>
            </Tooltip>
          </>
        );
      }

      case 'Archer': {
        const { hit2AutoMultiplier, hit2CapMultiplier } = classConstants.archer;
        const hit2Auto = Math.round(hit2AutoMultiplier * auto);
        const hit2Cap = Math.round(hit2CapMultiplier * cap);
        return (
          <>
            2 attaques: 1 tir normal +{' '}
            <Tooltip content={`Hit2 = 1.30×Auto (${auto}) + 0.25×Cap (${cap}) vs ResC`}>
              <span className="text-green-400">{hit2Auto}+{hit2Cap}</span>
            </Tooltip>
          </>
        );
      }

      case 'Mage': {
        const { capBase, capPerCap } = classConstants.mage;
        const magicPct = capBase + capPerCap * cap;
        const magicDmg = Math.round(magicPct * cap);
        return (
          <>
            Dégâts = Auto +{' '}
            <Tooltip content={`Auto (${auto}) + ${(magicPct * 100).toFixed(1)}% × Cap (${cap})`}>
              <span className="text-green-400">{auto + magicDmg}</span>
            </Tooltip>
            {' '}(vs ResC)
          </>
        );
      }

      case 'Demoniste': {
        const { capBase, capPerCap, ignoreResist, stackPerAuto } = classConstants.demoniste;
        const familierPct = capBase + capPerCap * cap;
        const familierDmgTotal = Math.round(familierPct * cap);
        const ignoreResistPct = Math.round(ignoreResist * 100);
        const stackBonusPct = Math.round(stackPerAuto * 100);
        return (
          <>
            Familier:{' '}
            <Tooltip content={`${(familierPct * 100).toFixed(1)}% de la Cap (${cap}) | +${stackBonusPct}% Cap par auto (cumulable)`}>
              <span className="text-green-400">{familierDmgTotal}</span>
            </Tooltip>
            {' '}dégâts / tour (ignore {ignoreResistPct}% ResC)
          </>
        );
      }

      case 'Masochiste': {
        const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
        const returnBasePct = Math.round(returnBase * 100);
        const returnBonusPct = Math.round(returnPerCap * cap * 100);
        const returnTotalPct = returnBasePct + returnBonusPct;
        const healPct = Math.round(healPercent * 100);
        return (
          <>
            Renvoie{' '}
            <Tooltip content={`Base: ${returnBasePct}% | Bonus (Cap ${cap}): +${returnBonusPct}%`}>
              <span className="text-green-400">{returnTotalPct}%</span>
            </Tooltip>
            {' '}des dégâts accumulés & heal {healPct}%
          </>
        );
      }

      case 'Briseur de Sort': {
        const { shieldFromSpellDamage, shieldFromCap, autoCapBonus, antiHealReduction } = classConstants.briseurSort;
        const shieldDmgPct = Math.round(shieldFromSpellDamage * 100);
        const shieldCapValue = Math.round(shieldFromCap * cap);
        const autoBonusValue = Math.round(autoCapBonus * cap);
        const antiHealPct = Math.round(antiHealReduction * 100);
        return (
          <>
            Bouclier après spell:{' '}
            <Tooltip content={`${shieldDmgPct}% dégâts reçus + ${shieldFromCap * 100}% × Cap (${cap})`}>
              <span className="text-green-400">{shieldDmgPct}% dmg + {shieldCapValue}</span>
            </Tooltip>
            {' '}| Auto +{' '}
            <Tooltip content={`${autoCapBonus * 100}% × Cap (${cap})`}>
              <span className="text-green-400">{autoBonusValue}</span>
            </Tooltip>
            {' '}| -{antiHealPct}% soins adverses
          </>
        );
      }

      case 'Succube': {
        const { capScale, nextAttackReduction } = classConstants.succube;
        const capDmg = Math.round(capScale * cap);
        const reductionPct = Math.round(nextAttackReduction * 100);
        return (
          <>
            Auto +{' '}
            <Tooltip content={`${capScale * 100}% × Cap (${cap})`}>
              <span className="text-green-400">{capDmg}</span>
            </Tooltip>
            {' '}CAP | Prochaine attaque adverse -{reductionPct}%
          </>
        );
      }

      case 'Bastion': {
        const { defPercentBonus, startShieldFromDef, capScale, defScale } = classConstants.bastion;
        const shieldPct = Math.round(startShieldFromDef * 100);
        const defBonusPct = Math.round(defPercentBonus * 100);
        const capDmg = Math.round(capScale * cap);
        return (
          <>
            Bouclier initial {shieldPct}% DEF | +{defBonusPct}% DEF | Auto +{' '}
            <Tooltip content={`${capScale * 100}% × Cap (${cap}) + ${defScale * 100}% DEF`}>
              <span className="text-green-400">{capDmg}</span>
            </Tooltip>
          </>
        );
      }
      default:
        return getClassDescriptionText(className);
    }
  };

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
          result.push(<span key={`name-${key++}`} className="font-bold text-red-400">{part}</span>);
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

  // === CharacterCard joueur (identique à Combat.jsx) ===
  const PlayerCard = ({ char }) => {
    if (!char) return null;
    const safeMaxHP = Math.max(1, char.maxHP || 1);
    const hpRatio = Math.max(0, Math.min(1, (char.currentHP || 0) / safeMaxHP));
    const hpPercent = hpRatio * 100;
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const shieldPercent = safeMaxHP > 0 ? Math.min(100, ((char.shield || 0) / safeMaxHP) * 100) : 0;
    const raceB = getRaceBonus(char.race);
    const classB = getClassBonus(char.class);
    const totalBonus = (k) => (raceB[k] || 0) + (classB[k] || 0);
    const forestBoosts = getForestBoosts(char);
    const weapon = char.equippedWeaponData;
    const passiveDetails = getPassiveDetails(char.mageTowerPassive);
    const awakeningInfo = races[char.race]?.awakening || null;
    const isAwakeningActive = awakeningInfo && (char.level ?? 1) >= awakeningInfo.levelRequired;
    const baseStatsRaw = applyStatBoosts(char.base, forestBoosts);
    const baseStats = removeBaseRaceFlatBonusesIfAwakened(baseStatsRaw, char.race, char.level ?? 1);
    const rawBase = char.base;
    const weaponStatValue = (k) => weapon?.stats?.[k] ?? 0;
    const baseWithPassive = weapon ? applyPassiveWeaponStats(baseStats, weapon.id, char.class, char.race, char.mageTowerPassive) : baseStats;
    const passiveAutoBonus = (baseWithPassive.auto ?? baseStats.auto) - (baseStats.auto + weaponStatValue('auto'));
    const awakeningEffect = getAwakeningEffect(char.race, char.level ?? 1);
    const finalStats = applyAwakeningToBase(baseWithPassive, awakeningEffect);
    const baseWithoutBonus = (k) => (rawBase?.[k] ?? 0) - totalBonus(k);

    const getRaceDisplayBonus = (k) => {
      if (!isAwakeningActive) return raceB[k] || 0;

      const classBonus = classB[k] || 0;
      const forestBonus = forestBoosts[k] || 0;
      const weaponBonus = weaponStatValue(k);
      const passiveBonus = k === 'auto' ? passiveAutoBonus : 0;
      const subtotalWithoutRace = baseWithoutBonus(k) + classBonus + forestBonus + weaponBonus + passiveBonus;
      return (finalStats[k] ?? 0) - subtotalWithoutRace;
    };

    const tooltipContent = (k) => {
      const parts = [`Base: ${baseWithoutBonus(k)}`];
      if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
      if (forestBoosts[k] > 0) parts.push(`Forêt: +${forestBoosts[k]}`);
      if (weaponStatValue(k) !== 0) parts.push(`Arme: ${weaponStatValue(k) > 0 ? `+${weaponStatValue(k)}` : weaponStatValue(k)}`);
      if (k === 'auto' && passiveAutoBonus > 0) parts.push(`Passif arme: +${passiveAutoBonus}`);

      const raceDisplayBonus = getRaceDisplayBonus(k);
      if (raceDisplayBonus !== 0) parts.push(`Race: ${raceDisplayBonus > 0 ? `+${raceDisplayBonus}` : raceDisplayBonus}`);
      return parts.join(' | ');
    };

    const getDisplayedStatValue = (statKey) => {
      return finalStats[statKey] ?? 0;
    };

    const displayedMaxHP = Math.max(1, getDisplayedStatValue('hp'));
    const displayedCurrentHP = Math.max(0, Math.round(displayedMaxHP * hpRatio));
    const characterImage = char.characterImage || testImage1;

    const StatWithTooltip = ({ statKey, label }) => {
      const weaponDelta = weaponStatValue(statKey);
      const passiveBonus = statKey === 'auto' ? passiveAutoBonus : 0;
      const raceDisplayBonus = getRaceDisplayBonus(statKey);
      const totalDelta = raceDisplayBonus + (classB[statKey] || 0) + (forestBoosts[statKey] || 0) + weaponDelta + passiveBonus;
      const labelClass = totalDelta > 0 ? 'text-green-400' : totalDelta < 0 ? 'text-red-400' : 'text-yellow-300';
      const finalDisplayValue = getDisplayedStatValue(statKey);
      return (
        <Tooltip content={tooltipContent(statKey)}>
          <span className={`${totalDelta !== 0 ? labelClass : ''} font-bold`}>
            {label}: {finalDisplayValue}
          </span>
        </Tooltip>
      );
    };

    return (
      <div className="relative shadow-2xl overflow-visible">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-amber-200 px-5 py-1 text-xs font-bold shadow-lg z-10 border border-stone-600 text-center whitespace-nowrap">
          {char.race} • {char.class} • Niveau {char.level ?? 1}
        </div>
        <div className="overflow-visible">
          <div className="h-auto relative bg-stone-900 flex items-center justify-center">
            <img src={characterImage} alt={char.name} className="w-full h-auto object-contain" />
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-3">
              <div className="text-white font-bold text-xl text-center">{char.name}</div>
            </div>
          </div>
          <div className="bg-stone-800 p-4 border-t border-stone-600">
            <div className="mb-3">
              <div className="flex justify-between text-sm text-white mb-2">
                <StatWithTooltip statKey="hp" label="HP" />
                <StatWithTooltip statKey="spd" label="VIT" />
              </div>
              <div className="text-xs text-stone-400 mb-2">{char.name} — PV {displayedCurrentHP}/{displayedMaxHP}</div>
              <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600">
                <div className={`h-full transition-all duration-500 ${hpClass}`} style={{width: `${hpPercent}%`}} />
              </div>
              {(char.shield || 0) > 0 && (
                <div className="mt-1 bg-stone-900 h-2 overflow-hidden border border-blue-700">
                  <div className="h-full transition-all duration-500 bg-blue-500" style={{width: `${shieldPercent}%`}} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-stone-400"><StatWithTooltip statKey="auto" label="Auto" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="def" label="Déf" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="cap" label="Cap" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="rescap" label="ResC" /></div>
            </div>
            <div className="space-y-2">
              {weapon && (
                <div className="border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                  <Tooltip content={getWeaponTooltipContent(weapon)}>
                    <span className="flex items-center gap-2">
                      {getWeaponImage(weapon.imageFile) ? (
                        <img src={getWeaponImage(weapon.imageFile)} alt={weapon.nom} className="w-8 h-auto" />
                      ) : (
                        <span className="text-xl">{weapon.icon}</span>
                      )}
                      <span className={`font-semibold ${RARITY_COLORS[weapon.rarete]}`}>{weapon.nom}</span>
                    </span>
                  </Tooltip>
                  <div className="text-[11px] text-stone-400 mt-1 space-y-1">
                    <div>{weapon.description}</div>
                    {weapon.effet && (
                      <div className="text-amber-200">
                        Effet: {weapon.effet.nom} — {weapon.effet.description}
                      </div>
                    )}
                    {weapon.stats && Object.keys(weapon.stats).length > 0 && (
                      <div className="text-stone-200">
                        Stats: {formatWeaponStats(weapon)}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {passiveDetails && (
                <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                  <span className="text-lg">{passiveDetails.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-amber-200">
                      {passiveDetails.name} — Niveau {passiveDetails.level}
                    </div>
                    <div className="text-stone-400 text-[11px]">
                      {passiveDetails.levelData.description}
                    </div>
                  </div>
                </div>
              )}
              {isAwakeningActive && (
                <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                  <span className="text-lg">✨</span>
                  <div className="flex-1">
                    <div className="font-semibold text-amber-200">
                      Éveil racial actif (Niv {awakeningInfo.levelRequired}+)
                    </div>
                    <div className="text-stone-400 text-[11px]">{awakeningInfo.description}</div>
                  </div>
                </div>
              )}
              {!isAwakeningActive && (
                <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                  <span className="text-lg">{races[char.race]?.icon}</span>
                  <span className="text-stone-300">{getRaceBonusText(char.race)}</span>
                </div>
              )}
              <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                <span className="text-lg">{classes[char.class]?.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold text-amber-200">{classes[char.class]?.ability}</div>
                  <div className="text-stone-400 text-[11px]">{getCalculatedDescription(char.class, finalStats.cap, finalStats.auto)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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

  // === Tableau des participants ===
  const LeaderboardPanel = () => (
    <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl overflow-hidden">
      <div className="bg-stone-900 p-3 border-b border-stone-600">
        <h3 className="text-sm font-bold text-amber-400 text-center">🏅 Participants</h3>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        {leaderboard.length === 0 ? (
          <p className="text-stone-500 text-xs text-center py-4 italic">Aucun participant</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-stone-900 sticky top-0">
              <tr>
                <th className="text-left text-stone-400 px-3 py-2">#</th>
                <th className="text-left text-stone-400 px-3 py-2">Nom</th>
                <th className="text-right text-stone-400 px-3 py-2">Dégâts</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => (
                <tr key={entry.id} className={`border-t border-stone-700 ${entry.characterId === character?.userId ? 'bg-amber-900/30' : ''}`}>
                  <td className="px-3 py-2 text-stone-500">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className="px-3 py-2 text-stone-200 truncate max-w-[120px]">{entry.characterName}</td>
                  <td className="px-3 py-2 text-amber-400 font-mono text-right">{(entry.totalDamage || 0).toLocaleString('fr-FR')}</td>
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

    const result = simulerWorldBossCombat(character, eventData.hpRemaining);

    // Init les states de combat pour les cards
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
            <button onClick={() => navigate('/')} className="mt-6 bg-stone-700 hover:bg-stone-600 text-stone-200 px-6 py-2 border border-stone-500 transition">
              ⬅️ Retour
            </button>
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
          <h1 className="text-5xl font-bold text-red-500 mb-6">☄️ Cataclysme</h1>
          <div className="bg-stone-800/90 border-2 border-stone-600 p-8">
            <p className="text-stone-400 text-xl">L&apos;event n&apos;est pas actif pour le moment</p>
            <p className="text-stone-500 mt-2">Revenez plus tard !</p>
          </div>
          <button onClick={() => navigate('/')} className="mt-6 bg-stone-700 hover:bg-stone-600 text-stone-200 px-6 py-2 border border-stone-500 transition">
            ⬅️ Retour
          </button>
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
        {/* === NOM DU BOSS EN ROUGE BIEN GROS === */}
        <div className="flex justify-center mb-4">
          <h1 className="text-5xl md:text-6xl font-black text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)] tracking-wide">
            ☄️ {activeBossName}
          </h1>
        </div>

        {/* === BARRE DE VIE GLOBALE STYLE ELDEN RING === */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="relative">
            {/* Fond de la barre */}
            <div className="bg-stone-900/90 border-2 border-red-800 shadow-[0_0_20px_rgba(239,68,68,0.3)] p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-red-400 font-bold text-sm tracking-wider uppercase">PV du Boss</span>
                <span className="text-stone-300 font-mono text-sm">
                  {eventData.hpRemaining.toLocaleString('fr-FR')} / {eventData.hpMax.toLocaleString('fr-FR')}
                </span>
              </div>
              <div className="relative w-full bg-stone-800 h-8 overflow-hidden border border-red-900">
                <div
                  className={`h-full ${globalHpBarColor} transition-all duration-700 shadow-[0_0_15px_rgba(239,68,68,0.4)]`}
                  style={{ width: `${globalHpPercent}%` }}
                />
                {/* Marqueurs de ticks style Elden Ring */}
                {[25, 50, 75].map(tick => (
                  <div key={tick} className="absolute top-0 bottom-0 w-px bg-stone-600/50" style={{ left: `${tick}%` }} />
                ))}
              </div>
              <div className="flex justify-between mt-1 text-xs text-stone-500">
                <span>{globalHpPercent.toFixed(1)}%</span>
                <span>⏰ Fin : {countdown}</span>
                <span>{eventData.totalAttempts || 0} tentatives</span>
              </div>
            </div>
          </div>
        </div>

        {/* === LAYOUT COMBAT : Joueur | Logs | Boss === */}
        {phase === 'pre' ? (
          /* Avant le combat : bouton central */
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col md:flex-row gap-4 items-start justify-center w-full">
              {/* Leaderboard */}
              <div className="w-full md:w-[220px] md:flex-shrink-0 order-4 md:order-1">
                <LeaderboardPanel />
              </div>

              {/* Aperçu joueur */}
              <div className="w-full md:w-[340px] md:flex-shrink-0 order-1 md:order-2">
                <PlayerCard char={{ ...character, currentHP: character.base?.hp || 0, maxHP: character.base?.hp || 0, shield: 0 }} />
              </div>

              {/* Zone centrale */}
              <div className="w-full md:w-[400px] flex flex-col items-center justify-center gap-6 py-12 order-2 md:order-3">
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
                  className="bg-red-700 hover:bg-red-600 disabled:bg-stone-600 disabled:text-stone-400 disabled:border-stone-500 text-white px-12 py-4 font-bold text-xl shadow-2xl border-2 border-red-500 hover:border-red-300 transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                >
                  ☄️ Affronter {activeBossName}
                </button>
                <p className="text-stone-500 text-xs">2 tentatives par jour (non cumulables)</p>
                {attemptError && (
                  <p className="text-red-400 text-sm text-center bg-red-900/30 border border-red-700 px-4 py-2">{attemptError}</p>
                )}
                <button onClick={() => navigate('/')} className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-6 py-2 border border-stone-500 transition">
                  ⬅️ Retour
                </button>
              </div>

              {/* Aperçu boss */}
              <div className="w-full md:w-[520px] md:flex-shrink-0 order-3 md:order-4">
                <BossCard />
              </div>
            </div>
          </div>
        ) : (
          /* Phase combat */
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
            {/* Leaderboard */}
            <div className="order-5 md:order-1 w-full md:w-[220px] md:flex-shrink-0">
              <LeaderboardPanel />
            </div>

            {/* Joueur */}
            <div className="order-1 md:order-2 w-full md:w-[340px] md:flex-shrink-0">
              {playerState && <PlayerCard char={playerState} />}
            </div>

            {/* Zone centrale : boutons + logs */}
            <div className="order-2 md:order-3 w-full md:w-[600px] md:flex-shrink-0 flex flex-col">
              {/* Boutons */}
              <div className="flex justify-center gap-3 md:gap-4 mb-4">
                <button
                  onClick={handleFight}
                  disabled={isSimulating}
                  className="bg-red-700 hover:bg-red-600 disabled:bg-stone-600 disabled:text-stone-400 text-white px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base transition-all shadow-lg border-2 border-red-500"
                >
                  {isSimulating ? '⚔️ En cours...' : '▶️ Relancer'}
                </button>
                <button
                  onClick={() => { setPhase('pre'); setCombatLog([]); setWinner(null); setCombatResult(null); setPlayerState(null); setBossState(null); }}
                  className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base transition-all shadow-lg border border-stone-500"
                >
                  ← Retour
                </button>
              </div>

              {/* Résultat */}
              {combatResult && !isSimulating && (
                <div className="flex justify-center mb-4">
                  <div className={`px-8 py-3 font-bold text-xl shadow-2xl border-2 ${
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

              {/* Zone de logs */}
              <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[480px] md:h-[600px]">
                <div className="bg-stone-900 p-3 border-b border-red-800">
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
                                <div className="bg-red-900 text-red-200 px-6 py-3 font-bold text-lg shadow-lg border-2 border-red-600 animate-pulse">
                                  {cleanLog}
                                </div>
                              </div>
                            );
                          }
                          if (log.includes('🏆') || log.includes('🎉')) {
                            return (
                              <div key={idx} className="flex justify-center my-4">
                                <div className="bg-stone-100 text-stone-900 px-6 py-3 font-bold text-lg shadow-lg border border-stone-400">
                                  {cleanLog}
                                </div>
                              </div>
                            );
                          }
                          if (log.includes('---')) {
                            return (
                              <div key={idx} className="flex justify-center my-3">
                                <div className="bg-stone-700 text-stone-200 px-4 py-1 text-sm font-bold border border-stone-500">
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

            {/* Boss à droite (plus large) */}
            <div className="order-3 md:order-4 w-full md:w-[520px] md:flex-shrink-0">
              <BossCard />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorldBoss;
