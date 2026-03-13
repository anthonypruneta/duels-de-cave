import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import {
  onTournoiUpdate, getCombatLog, creerTournoi, lancerTournoi,
  avancerMatch, terminerTournoi, annoncerFinMatchDiscord, supprimerTournoiTermine
} from '../services/tournamentService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import { isForgeActive } from '../data/featureFlags';
import { extractForgeUpgrade, computeForgeStatDelta, hasAnyForgeUpgrade } from '../data/forgeDungeon';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import { applyPassiveWeaponStats } from '../utils/weaponEffects';
import { getAwakeningEffect, applyAwakeningToBase, removeBaseRaceFlatBonusesIfAwakened } from '../utils/awakening';
import { classConstants } from '../data/combatMechanics';
import { getCalculatedClassDescription } from '../utils/calculatedClassDescription';

const ADMIN_EMAIL = 'antho.pruneta@gmail.com';

// ============================================================================
// UTILS HORAIRES PARIS
// ============================================================================

function getParisNow() {
  const str = new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' });
  return new Date(str);
}

function getNextSaturday18h() {
  const now = getParisNow();
  const day = now.getDay();
  let daysUntil = (6 - day + 7) % 7;
  if (daysUntil === 0 && now.getHours() >= 19) {
    daysUntil = 7;
  }
  const target = new Date(now);
  target.setDate(target.getDate() + daysUntil);
  target.setHours(18, 0, 0, 0);
  return target;
}

function getSchedulePhase() {
  const now = getParisNow();
  const day = now.getDay();
  const hour = now.getHours();

  if (day === 6) {
    if (hour >= 19) return 'combat';
    if (hour >= 18) return 'annonce';
  }
  return 'attente';
}

function formatCountdown(targetDate) {
  const now = getParisNow();
  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) return null;

  const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
  const heures = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const secondes = Math.floor((diff / 1000) % 60);

  const parts = [];
  if (jours > 0) parts.push(`${jours}j`);
  parts.push(`${String(heures).padStart(2, '0')}h`);
  parts.push(`${String(minutes).padStart(2, '0')}m`);
  parts.push(`${String(secondes).padStart(2, '0')}s`);
  return parts.join(' ');
}

// ============================================================================
// HELPERS
// ============================================================================

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// HELPERS UI (mêmes que Combat.jsx)
// ============================================================================

const weaponImageModules = import.meta.glob('../assets/weapons/*.png', { eager: true, import: 'default' });

const getWeaponImage = (imageFile) => {
  if (!imageFile) return null;
  return weaponImageModules[`../assets/weapons/${imageFile}`] || null;
};

const Tooltip = ({ children, content }) => (
  <span className="relative group cursor-help">
    {children}
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-stone-900 border border-amber-500 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
      {content}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-500"></span>
    </span>
  </span>
);

const STAT_LABELS = { hp: 'HP', auto: 'Auto', def: 'Déf', cap: 'Cap', rescap: 'ResC', spd: 'VIT' };

const getWeaponStatColor = (value) => {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-yellow-300';
};

const getForestBoosts = (character) => ({ ...getEmptyStatBoosts(), ...(character?.forestBoosts || {}) });

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
  const stats = formatWeaponStats(weapon);
  return (
    <span className="block whitespace-normal text-xs">
      <span className="block font-semibold text-white">{weapon.nom}</span>
      <span className="block text-stone-300">{weapon.description}</span>
      {weapon.effet && typeof weapon.effet === 'object' ? (
        <span className="block text-amber-200">
          Effet: {weapon.effet.nom} — {weapon.effet.description}
        </span>
      ) : null}
      {stats && (
        <span className="block text-stone-200">
          Stats: {stats}
        </span>
      )}
    </span>
  );
};

const getCalculatedDescription = getCalculatedClassDescription;

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

const Tournament = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSimulation = searchParams.get('mode') === 'simulation';
  const docId = isSimulation ? 'simulation' : 'current';
  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  // Tournoi state
  const [tournoi, setTournoi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listenerError, setListenerError] = useState(null);

  // Combat state
  const [combatLog, setCombatLog] = useState([]);
  const [matchEnCours, setMatchEnCours] = useState(null);
  const [p1HP, setP1HP] = useState(0);
  const [p2HP, setP2HP] = useState(0);
  const [p1Shield, setP1Shield] = useState(0);
  const [p2Shield, setP2Shield] = useState(0);
  const [p1MaxHP, setP1MaxHP] = useState(0);
  const [p2MaxHP, setP2MaxHP] = useState(0);
  const [p1CombatBase, setP1CombatBase] = useState(null);
  const [p2CombatBase, setP2CombatBase] = useState(null);
  const [p1CombatModifiers, setP1CombatModifiers] = useState(null);
  const [p2CombatModifiers, setP2CombatModifiers] = useState(null);
  const [p1CombatStatus, setP1CombatStatus] = useState(null);
  const [p2CombatStatus, setP2CombatStatus] = useState(null);
  const [winner, setWinner] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [annonceActuelle, setAnnonceActuelle] = useState('');
  const [replayMatchId, setReplayMatchId] = useState(null);

  // Schedule
  const [countdown, setCountdown] = useState('');
  const [phase, setPhase] = useState('attente');
  const autoCreatedRef = useRef(false);
  const autoLaunchedRef = useRef(false);

  // Bracket toggle
  const [showBracket, setShowBracket] = useState(false);

  // Cooldown between matches
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownIntervalRef = useRef(null);

  // Admin
  const [actionLoading, setActionLoading] = useState(false);

  // Refs
  const logContainerRef = useRef(null);
  const logEndRef = useRef(null);
  const animationRef = useRef(null);
  const lastAnimatedMatch = useRef(-1);
  const autoAdvanceRef = useRef(null);

  // ============================================================================
  // LISTENERS ET TIMERS
  // ============================================================================

  // Listener tournoi en temps réel
  useEffect(() => {
    const unsubscribe = onTournoiUpdate((data) => {
      setTournoi(data);
      setLoading(false);
      setListenerError(null);
    }, docId, (error) => {
      setListenerError(error?.message || 'Erreur de synchronisation tournoi');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [docId]);

  // Timer countdown + phase
  useEffect(() => {
    const tick = () => {
      const currentPhase = getSchedulePhase();
      setPhase(currentPhase);
      if (currentPhase === 'attente') {
        const target = getNextSaturday18h();
        setCountdown(formatCountdown(target) || '');
      } else {
        setCountdown('');
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-nettoyage : supprimer le tournoi terminé quand on passe à la semaine suivante (lundi)
  useEffect(() => {
    if (isSimulation || !tournoi || loading) return;
    if (tournoi.statut !== 'termine') return;
    const now = getParisNow();
    const day = now.getDay(); // 0=dimanche, 6=samedi
    // Si on n'est plus samedi (6) ni dimanche (0), le tournoi terminé doit disparaître
    if (day !== 0 && day !== 6) {
      supprimerTournoiTermine(docId);
    }
  }, [tournoi, loading, isSimulation, docId]);

  // Auto-création à 18h — pas en simulation
  useEffect(() => {
    if (isSimulation) return;
    if (autoCreatedRef.current || tournoi || loading) return;
    if (phase === 'annonce' || phase === 'combat') {
      autoCreatedRef.current = true;
      (async () => {
        setActionLoading(true);
        try {
          await creerTournoi(docId);
        } finally {
          setActionLoading(false);
        }
      })();
    }
  }, [phase, tournoi, loading, isSimulation, docId]);

  // Auto-lancement à 19h — pas en simulation
  useEffect(() => {
    if (isSimulation) return;
    if (autoLaunchedRef.current || !tournoi || loading) return;
    if (phase === 'combat' && tournoi.statut === 'preparation') {
      autoLaunchedRef.current = true;
      (async () => {
        setActionLoading(true);
        try {
          await lancerTournoi(docId);
        } finally {
          setActionLoading(false);
        }
      })();
    }
  }, [phase, tournoi, loading, isSimulation, docId]);

  // Auto-scroll du combat log (scroll le conteneur uniquement, pas la page)
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [combatLog]);

  // Cleanup auto-advance + cooldown on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  // ============================================================================
  // ANIMATION DU MATCH EN COURS
  // ============================================================================

  useEffect(() => {
    if (!tournoi || tournoi.statut !== 'en_cours') return;
    if (tournoi.matchActuel < 0) return;
    if (tournoi.matchActuel === lastAnimatedMatch.current) return;

    lastAnimatedMatch.current = tournoi.matchActuel;
    const matchId = tournoi.matchOrder[tournoi.matchActuel];
    animerMatch(matchId);
  }, [tournoi?.matchActuel, tournoi?.statut]);

  const animerMatch = async (matchId, isReplay = false) => {
    if (!matchId) return;

    // Cancel previous animation
    if (animationRef.current) {
      animationRef.current.cancelled = true;
    }
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }

    const token = { cancelled: false };
    animationRef.current = token;

    const stopAnimation = () => {
      if (animationRef.current === token) {
        animationRef.current = null;
      }
      setIsAnimating(false);
    };

    setIsAnimating(true);
    setCombatLog([]);
    setMatchEnCours(matchId);
    setCooldownRemaining(0);
    if (cooldownIntervalRef.current) { clearInterval(cooldownIntervalRef.current); cooldownIntervalRef.current = null; }
    if (!isReplay) {
      setShowBracket(false);
      setReplayMatchId(null);
    }
    setWinner(null);
    setAnnonceActuelle('');

    // Lancer la musique de combat
    const combatMusic = document.getElementById('tournament-combat-music');
    const victoryMusic = document.getElementById('tournament-victory-music');
    if (victoryMusic) victoryMusic.pause();
    if (combatMusic) {
      combatMusic.currentTime = 0;
      combatMusic.play().catch(e => console.log('Autoplay bloqué:', e));
    }

    // Charger le combat log (avec retries pour absorber les délais Firestore)
    let result = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (token.cancelled) { stopAnimation(); return; }
      result = await getCombatLog(matchId, docId);
      if (result.success) break;
      if (attempt < 3) await delay(800 * (attempt + 1));
    }
    if (!result?.success || token.cancelled) {
      stopAnimation();
      // Même en cas d'échec, planifier l'auto-avancement pour ne pas bloquer la simulation
      if (isAdmin && !isReplay) {
        autoAdvanceRef.current = setTimeout(async () => {
          autoAdvanceRef.current = null;
          await avancerMatch(docId);
        }, 3000);
      }
      return;
    }

    const logData = result.data;
    setP1MaxHP(logData.p1MaxHP || 0);
    setP2MaxHP(logData.p2MaxHP || 0);
    setP1HP(logData.p1MaxHP || 0);
    setP2HP(logData.p2MaxHP || 0);
    setP1Shield(0);
    setP2Shield(0);
    setP1CombatBase(null);
    setP2CombatBase(null);
    setP1CombatModifiers(null);
    setP2CombatModifiers(null);
    setP1CombatStatus(null);
    setP2CombatStatus(null);

    // Annonce de début
    setAnnonceActuelle(logData.annonceDebut);
    await delay(3000);
    if (token.cancelled) {
      stopAnimation();
      return;
    }
    setAnnonceActuelle('');

    // Jouer les steps un par un
    if (logData.steps && logData.steps.length > 0) {
      for (const step of logData.steps) {
        if (token.cancelled) {
          stopAnimation();
          return;
        }

        if (step.phase === 'intro') {
          for (const line of step.logs) {
            if (token.cancelled) {
              stopAnimation();
              return;
            }
            setCombatLog(prev => [...prev, line]);
            await delay(300);
          }
          setP1CombatBase(step.p1Base ?? undefined);
          setP2CombatBase(step.p2Base ?? undefined);
          setP1CombatModifiers(step.p1Modifiers ?? null);
          setP2CombatModifiers(step.p2Modifiers ?? null);
          setP1CombatStatus(step.p1Status ?? null);
          setP2CombatStatus(step.p2Status ?? null);
          setP1HP(step.p1HP);
          setP2HP(step.p2HP);
          setP1Shield(step.p1Shield || 0);
          setP2Shield(step.p2Shield || 0);
          await delay(500);
        } else if (step.phase === 'turn_start') {
          for (const line of step.logs) {
            if (token.cancelled) {
              stopAnimation();
              return;
            }
            setCombatLog(prev => [...prev, line]);
          }
          setP1CombatBase(step.p1Base ?? undefined);
          setP2CombatBase(step.p2Base ?? undefined);
          setP1CombatModifiers(step.p1Modifiers ?? null);
          setP2CombatModifiers(step.p2Modifiers ?? null);
          setP1CombatStatus(step.p1Status ?? null);
          setP2CombatStatus(step.p2Status ?? null);
          setP1Shield(step.p1Shield || 0);
          setP2Shield(step.p2Shield || 0);
          await delay(800);
        } else if (step.phase === 'action') {
          for (const line of step.logs) {
            if (token.cancelled) {
              stopAnimation();
              return;
            }
            setCombatLog(prev => [...prev, line]);
          }
          setP1CombatBase(step.p1Base ?? undefined);
          setP2CombatBase(step.p2Base ?? undefined);
          setP1CombatModifiers(step.p1Modifiers ?? null);
          setP2CombatModifiers(step.p2Modifiers ?? null);
          setP1CombatStatus(step.p1Status ?? null);
          setP2CombatStatus(step.p2Status ?? null);
          setP1HP(step.p1HP);
          setP2HP(step.p2HP);
          setP1Shield(step.p1Shield || 0);
          setP2Shield(step.p2Shield || 0);
          await delay(2000);
        } else if (step.phase === 'victory') {
          for (const line of step.logs) {
            if (token.cancelled) {
              stopAnimation();
              return;
            }
            setCombatLog(prev => [...prev, line]);
          }
          setP1CombatBase(step.p1Base ?? undefined);
          setP2CombatBase(step.p2Base ?? undefined);
          setP1CombatModifiers(step.p1Modifiers ?? null);
          setP2CombatModifiers(step.p2Modifiers ?? null);
          setP1CombatStatus(step.p1Status ?? null);
          setP2CombatStatus(step.p2Status ?? null);
          setP1HP(step.p1HP);
          setP2HP(step.p2HP);
          setP1Shield(step.p1Shield || 0);
          setP2Shield(step.p2Shield || 0);
        }
      }
    } else {
      // Fallback: affichage ligne par ligne (ancien format sans steps)
      for (let i = 0; i < logData.combatLog.length; i++) {
        if (token.cancelled) {
          stopAnimation();
          return;
        }
        const line = logData.combatLog[i];
        setCombatLog(prev => [...prev, line]);
        const isNewTurn = line.includes('---');
        await delay(isNewTurn ? 800 : 350);
      }
    }

    if (token.cancelled) {
      stopAnimation();
      return;
    }

    // Victoire
    setWinner(logData.winnerNom);
    setAnnonceActuelle(logData.annonceFin);
    stopAnimation();

    // Annoncer le vainqueur sur Discord après l'animation (admin + vrai tournoi uniquement)
    // Ne pas annoncer si c'est un replay
    if (isAdmin && !isSimulation && !isReplay) {
      annoncerFinMatchDiscord(logData).catch(() => {});
    }

    // Arrêter musique combat, jouer victoire
    if (combatMusic) combatMusic.pause();
    if (victoryMusic) {
      victoryMusic.currentTime = 0;
      victoryMusic.play().catch(e => console.log('Autoplay bloqué:', e));
    }

    // Cooldown + auto-avancer (admin seulement, pas en replay)
    if (isAdmin && !isReplay) {
      setShowBracket(true);
      const COOLDOWN_SECONDS = 60;
      setCooldownRemaining(COOLDOWN_SECONDS);
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = setInterval(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      autoAdvanceRef.current = setTimeout(async () => {
        autoAdvanceRef.current = null;
        setCooldownRemaining(0);
        if (cooldownIntervalRef.current) { clearInterval(cooldownIntervalRef.current); cooldownIntervalRef.current = null; }
        setShowBracket(false);
        await avancerMatch(docId);
      }, COOLDOWN_SECONDS * 1000);
    }
  };

  const rejouerMatch = async (matchId) => {
    if (animationRef.current) animationRef.current.cancelled = true;
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    setReplayMatchId(matchId);
    await animerMatch(matchId, true); // Passer true pour indiquer que c'est un replay
  };

  // ============================================================================
  // ADMIN ACTIONS
  // ============================================================================

  const handleMatchSuivant = async () => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    if (cooldownIntervalRef.current) { clearInterval(cooldownIntervalRef.current); cooldownIntervalRef.current = null; }
    setCooldownRemaining(0);
    setShowBracket(false);
    setActionLoading(true);
    const result = await avancerMatch(docId);
    if (!result.success) alert('Erreur: ' + result.error);
    if (result.termine && tournoi?.champion) {
      setAnnonceActuelle(tournoi.annonceChampion || `🏆 ${tournoi.champion.nom} EST LE CHAMPION !!!`);
    }
    setActionLoading(false);
  };

  const handleTerminerTournoi = async () => {
    if (isSimulation) {
      setActionLoading(true);
      await terminerTournoi(docId);
      setActionLoading(false);
      navigate('/admin');
      return;
    }
    if (!window.confirm('Terminer le tournoi ? Tous les personnages seront archivés.')) return;
    setActionLoading(true);
    const result = await terminerTournoi(docId);
    if (!result.success) alert('Erreur: ' + result.error);
    else alert('Tournoi terminé ! Personnages archivés, champion récompensé.');
    setActionLoading(false);
  };

  // ============================================================================
  // FORMAT COMBAT LOG (même style que Combat.jsx)
  // ============================================================================

  const formatLogMessage = (text) => {
    if (!matchEnCours || !tournoi) return text;
    const match = tournoi.matches[matchEnCours];
    if (!match) return text;

    const p1Data = tournoi.participants[match.p1];
    const p2Data = tournoi.participants[match.p2];
    if (!p1Data || !p2Data) return text;

    const p1Name = p1Data.nom;
    const p2Name = p2Data.nom;

    const parts = [];
    const nameRegex = new RegExp(`(${escapeRegex(p1Name)}|${escapeRegex(p2Name)})`, 'g');
    const nameParts = text.split(nameRegex);
    let key = 0;

    nameParts.forEach((part) => {
      if (part === p1Name) {
        parts.push(<span key={key++} className="font-bold text-blue-400">{part}</span>);
      } else if (part === p2Name) {
        parts.push(<span key={key++} className="font-bold text-purple-400">{part}</span>);
      } else if (part) {
        const numRegex = /(\d+)\s*(points?\s*de\s*(?:vie|dégâts?|dommages?))/gi;
        let lastIndex = 0;
        let numMatch;
        while ((numMatch = numRegex.exec(part)) !== null) {
          if (numMatch.index > lastIndex) parts.push(part.slice(lastIndex, numMatch.index));
          const isHeal = numMatch[2].toLowerCase().includes('vie');
          parts.push(<span key={key++} className={isHeal ? 'font-bold text-green-400' : 'font-bold text-red-400'}>{numMatch[1]}</span>);
          parts.push(` ${numMatch[2]}`);
          lastIndex = numMatch.index + numMatch[0].length;
        }
        if (lastIndex < part.length) parts.push(part.slice(lastIndex));
      }
    });

    return parts;
  };

  // ============================================================================
  // RENDER BRACKET
  // ============================================================================

  // Déterminer le prochain match (pour highlight pendant le cooldown)
  const getNextMatchId = () => {
    if (!tournoi || !tournoi.matchOrder) return null;
    const nextIdx = (tournoi.matchActuel ?? -1) + 1;
    if (nextIdx >= tournoi.matchOrder.length) return null;
    return tournoi.matchOrder[nextIdx];
  };

  const renderBracketMatch = (matchId, isGrandFinale = false) => {
    if (!tournoi) return null;
    const match = tournoi.matches[matchId];
    if (!match) return null;

    const isCurrentAnimatedMatch = isAnimating && matchEnCours === tournoi.matchOrder[tournoi.matchActuel] && !winner;
    const currentAnimatedMatch = isCurrentAnimatedMatch ? tournoi.matches[matchEnCours] : null;

    const shouldHidePropagatedParticipant = (participantId) => {
      if (!participantId || participantId === 'BYE' || !currentAnimatedMatch) return false;
      if (matchId === matchEnCours) return false;
      if (match.statut === 'termine') return false;
      return participantId === currentAnimatedMatch.winnerId || participantId === currentAnimatedMatch.loserId;
    };

    const displayedP1Id = shouldHidePropagatedParticipant(match.p1) ? null : match.p1;
    const displayedP2Id = shouldHidePropagatedParticipant(match.p2) ? null : match.p2;

    const p1 = displayedP1Id && displayedP1Id !== 'BYE' ? tournoi.participants[displayedP1Id] : null;
    const p2 = displayedP2Id && displayedP2Id !== 'BYE' ? tournoi.participants[displayedP2Id] : null;
    const isCurrentMatch = tournoi.matchOrder[tournoi.matchActuel] === matchId;
    const isNextMatch = cooldownRemaining > 0 && getNextMatchId() === matchId;
    const isTermine = match.statut === 'termine';
    const isBye = match.statut === 'bye';
    const hasAnyParticipant = Boolean(p1 || p2 || match.winnerId || match.loserId);
    const isAnimatingCurrentMatch = matchId === matchEnCours && !winner;
    const showWinner = isTermine && !isAnimatingCurrentMatch;

    if (isBye || !hasAnyParticipant) return null;

    const p1Won = showWinner && match.winnerId === match.p1;
    const p2Won = showWinner && match.winnerId === match.p2;

    const cardWidth = isGrandFinale ? 'w-[250px]' : 'w-[210px]';

    const borderClass = isCurrentMatch
      ? 'border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
      : isNextMatch
        ? 'border-amber-600/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
        : isTermine
          ? 'border-stone-600/50'
          : 'border-stone-700/40';

    const bgClass = isCurrentMatch
      ? 'bg-gradient-to-r from-amber-950/50 to-stone-900/80'
      : isNextMatch
        ? 'bg-amber-950/25'
        : isTermine
          ? 'bg-stone-900/80'
          : 'bg-stone-900/50';

    const renderPlayer = (pData, pId, won, lost) => {
      const imgSize = isGrandFinale ? 'w-9 h-9' : 'w-7 h-7';
      const textSize = isGrandFinale ? 'text-sm' : 'text-xs';
      const isEmpty = !pData && (!pId || pId === 'BYE');
      return (
        <div className={`flex items-center gap-2.5 px-3 py-2 transition-colors ${
          won ? 'bg-emerald-500/10' : lost ? 'bg-red-950/20' : ''
        }`}>
          {pData?.characterImage ? (
            <img src={pData.characterImage} alt="" className={`${imgSize} rounded-md object-cover flex-shrink-0 ${
              lost ? 'opacity-30 grayscale' : ''
            }`} />
          ) : !isEmpty ? (
            <div className={`${imgSize} rounded-md bg-stone-800/80 flex-shrink-0 flex items-center justify-center text-stone-600 text-[10px]`}>?</div>
          ) : (
            <div className={`${imgSize} flex-shrink-0`} />
          )}
          <span className={`${textSize} truncate flex-1 font-medium ${
            won ? 'text-emerald-300 font-bold'
            : lost ? 'text-stone-600 line-through'
            : isEmpty ? 'text-stone-700 italic'
            : 'text-stone-200'
          }`}>
            {pData?.nom || (isEmpty ? '—' : '?')}
          </span>
          {pData && !won && !lost && (
            <span className="text-[9px] text-stone-600 flex-shrink-0 hidden sm:inline font-medium">{pData.classe}</span>
          )}
          {won && <span className="text-emerald-400 text-sm flex-shrink-0">✓</span>}
        </div>
      );
    };

    return (
      <div
        key={matchId}
        className={`${cardWidth} border ${borderClass} ${bgClass} rounded-lg overflow-hidden transition-all duration-300 ${
          isTermine ? 'cursor-pointer hover:border-amber-500/40 hover:shadow-[0_0_12px_rgba(245,158,11,0.1)]' : ''
        }`}
        onClick={() => isTermine && rejouerMatch(matchId)}
        title={isTermine ? 'Revoir ce match' : ''}
      >
        {renderPlayer(p1, displayedP1Id, p1Won, p2Won)}
        <div className="h-px bg-stone-600/30" />
        {renderPlayer(p2, displayedP2Id, p2Won, p1Won)}
        {isCurrentMatch && (
          <div className="text-amber-400 text-center text-[10px] py-1.5 font-bold bg-amber-500/10 animate-pulse border-t border-amber-500/20">⚔️ EN COURS</div>
        )}
        {isNextMatch && (
          <div className="text-amber-500/70 text-center text-[10px] py-1.5 font-bold bg-amber-500/5 animate-pulse border-t border-amber-500/10">⏳ PROCHAIN</div>
        )}
        {isTermine && !isCurrentMatch && !isNextMatch && (
          <div className="text-stone-700 text-center text-[8px] py-0.5 border-t border-stone-800/50 hover:text-stone-500 transition-colors">▶ replay</div>
        )}
      </div>
    );
  };

  const renderBracket = () => {
    if (!tournoi || !tournoi.matches) return null;

    const winnersRounds = {};
    const losersRounds = {};
    let hasGF = false;
    let hasGFR = false;

    const shouldDisplayMatch = (match) => {
      if (!match || match.statut === 'bye') return false;
      const hasP1 = Boolean(match.p1 && match.p1 !== 'BYE');
      const hasP2 = Boolean(match.p2 && match.p2 !== 'BYE');
      const hasWinner = Boolean(match.winnerId && match.winnerId !== 'BYE');
      const hasLoser = Boolean(match.loserId && match.loserId !== 'BYE');
      if (!hasP1 && !hasP2) return false;
      return hasP1 || hasP2 || hasWinner || hasLoser;
    };

    for (const [id, match] of Object.entries(tournoi.matches)) {
      if (!shouldDisplayMatch(match)) continue;
      if (match.bracket === 'winners') {
        if (!winnersRounds[match.round]) winnersRounds[match.round] = [];
        winnersRounds[match.round].push(id);
      } else if (match.bracket === 'losers') {
        if (!losersRounds[match.round]) losersRounds[match.round] = [];
        losersRounds[match.round].push(id);
      } else if (match.bracket === 'grand_final') {
        hasGF = true;
      } else if (match.bracket === 'grand_final_reset') {
        hasGFR = true;
      }
    }

    for (const r of Object.values(winnersRounds)) {
      r.sort((a, b) => tournoi.matches[a].matchInRound - tournoi.matches[b].matchInRound);
    }
    for (const r of Object.values(losersRounds)) {
      r.sort((a, b) => tournoi.matches[a].matchInRound - tournoi.matches[b].matchInRound);
    }

    const SLOT_H = 120;

    const renderBracketSection = (rounds, label, icon, labelColor, accentBorder) => {
      const roundKeys = Object.keys(rounds).map(Number).sort((a, b) => a - b);
      if (roundKeys.length === 0) return null;

      return (
        <div>
          <h3 className={`text-sm font-bold ${labelColor} uppercase tracking-widest mb-4 flex items-center gap-2`}>
            {icon} {label}
          </h3>
          <div className="flex items-start overflow-x-auto pb-3">
            {roundKeys.map((round, rIdx) => {
              const slotH = SLOT_H * Math.pow(2, rIdx);
              const matchIds = rounds[round];
              const isLast = rIdx === roundKeys.length - 1;

              return (
                <React.Fragment key={round}>
                  <div className="flex flex-col flex-shrink-0">
                    {matchIds.map(id => (
                      <div key={id} className="flex items-center" style={{ height: slotH }}>
                        {rIdx > 0 && <div className={`flex-shrink-0 border-t-2 ${accentBorder}`} style={{ width: 20 }} />}
                        {renderBracketMatch(id)}
                      </div>
                    ))}
                  </div>

                  {!isLast && matchIds.length >= 2 && (
                    <div className="flex flex-col flex-shrink-0" style={{ width: 36 }}>
                      {matchIds.map((id, mIdx) => {
                        const isTop = mIdx % 2 === 0;
                        return (
                          <div key={`c-${id}`} className="flex flex-col" style={{ height: slotH }}>
                            {isTop ? (
                              <>
                                <div className="flex-1" />
                                <div className={`flex-1 border-t-2 border-r-2 ${accentBorder} rounded-tr`} />
                              </>
                            ) : (
                              <>
                                <div className={`flex-1 border-r-2 border-b-2 ${accentBorder} rounded-br`} />
                                <div className="flex-1" />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!isLast && matchIds.length === 1 && (
                    <div className="flex flex-col flex-shrink-0" style={{ width: 36 }}>
                      {matchIds.map(id => (
                        <div key={`c-${id}`} className="flex items-center" style={{ height: slotH }}>
                          <div className={`w-full border-t-2 ${accentBorder}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-8">
        {renderBracketSection(winnersRounds, 'Winners Bracket', '🏆', 'text-amber-400', 'border-amber-700/30')}

        {Object.keys(losersRounds).length > 0 &&
          renderBracketSection(losersRounds, 'Losers Bracket', '💀', 'text-red-400', 'border-red-800/30')}

        {hasGF && (
          <div>
            <h3 className="text-sm font-bold text-yellow-300 uppercase tracking-widest mb-4 flex items-center gap-2">👑 Grande Finale</h3>
            <div className="flex flex-wrap gap-4 items-center">
              {renderBracketMatch('GF', true)}
              {hasGFR && (
                <>
                  <div className="text-stone-600 text-lg font-bold px-1">→</div>
                  {renderBracketMatch('GFR', true)}
                </>
              )}
            </div>
          </div>
        )}

        {cooldownRemaining > 0 && (
          <div className="flex justify-center mt-4">
            <div className="bg-amber-500/10 border border-amber-600/40 rounded-lg px-8 py-4 text-center">
              <div className="text-amber-400 font-bold text-xl font-mono">{cooldownRemaining}s</div>
              <div className="text-stone-400 text-xs mt-1">avant le prochain combat</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER COMBAT UI (même layout que Combat.jsx)
  // ============================================================================

  const renderCombatUI = () => {
    if (!matchEnCours || !tournoi) return null;

    const match = tournoi.matches[matchEnCours];
    if (!match) return null;

    const p1Data = tournoi.participants[match.p1];
    const p2Data = tournoi.participants[match.p2];

    return (
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
        {/* Carte joueur 1 */}
        <div className="order-1 md:order-1 w-full md:w-[340px] lg:w-auto md:flex-shrink-0">
          <CharacterCardContent
            character={p1Data}
            showHpBar
            currentHP={p1HP}
            maxHP={p1MaxHP}
            shield={p1Shield}
            nameOverride={p1Data?.nom ?? p1Data?.name}
            combatBaseOverride={p1CombatBase}
            combatModifiers={p1CombatModifiers}
            opponent={p2Data}
            combatStatus={p1CombatStatus}
            detailsPlacement="left"
          />
        </div>

        {/* Zone centrale - Combat log */}
        <div className="order-2 md:order-2 w-full md:w-[600px] lg:w-[500px] lg:flex-1 lg:min-w-[400px] md:flex-shrink-0 lg:flex-shrink flex flex-col">
          {/* Message de victoire */}
          {winner && (
            <div className="flex justify-center mb-3">
              <div className="bg-amber-500/10 border border-amber-500/60 text-amber-200 px-6 py-2.5 font-bold text-lg rounded-lg animate-pulse">
                🏆 {winner} remporte le combat !
              </div>
            </div>
          )}

          {/* Zone de chat messenger */}
          <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-lg flex flex-col h-[480px] md:h-[600px]">
            <div className="p-3 border-b border-stone-700/60">
              <h2 className="text-sm font-bold text-stone-300 text-center uppercase tracking-wider">
                ⚔️ {replayMatchId ? 'Replay' : 'Combat en direct'}
              </h2>
            </div>
            <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-transparent">
              {combatLog.length === 0 && !isAnimating ? (
                <p className="text-stone-600 italic text-center py-8 text-sm">
                  En attente du combat...
                </p>
              ) : (
                <>
                  {combatLog.map((log, idx) => {
                    const isP1 = log.startsWith('[P1]');
                    const isP2 = log.startsWith('[P2]');
                    const cleanLog = log.replace(/^\[P[12]\]\s*/, '');

                    if (!isP1 && !isP2) {
                      if (log.includes('🏆')) {
                        return (
                          <div key={idx} className="flex justify-center my-3">
                            <div className="bg-amber-500/10 border border-amber-500/50 text-amber-200 px-5 py-2 font-bold text-sm rounded-lg">
                              {cleanLog}
                            </div>
                          </div>
                        );
                      }
                      if (log.includes('---')) {
                        return (
                          <div key={idx} className="flex justify-center my-2">
                            <div className="bg-stone-800/80 text-stone-400 px-4 py-1 text-xs font-bold rounded-md border border-stone-700/50">
                              {cleanLog}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={idx} className="flex justify-center">
                          <div className="text-stone-500 text-xs italic">{cleanLog}</div>
                        </div>
                      );
                    }

                    if (isP1) {
                      return (
                        <div key={idx} className="flex justify-start">
                          <div className="max-w-[80%]">
                            <div className="bg-stone-800/80 text-stone-200 px-3 py-2 rounded-r-lg rounded-tl-lg border-l-2 border-blue-500/70">
                              <div className="text-xs md:text-sm">{formatLogMessage(cleanLog)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="flex justify-end">
                        <div className="max-w-[80%]">
                          <div className="bg-stone-800/80 text-stone-200 px-3 py-2 rounded-l-lg rounded-tr-lg border-r-2 border-purple-500/70">
                            <div className="text-xs md:text-sm">{formatLogMessage(cleanLog)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={logEndRef} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Carte joueur 2 */}
        <div className="order-3 md:order-3 w-full md:w-[340px] lg:w-auto md:flex-shrink-0">
          <CharacterCardContent
            character={p2Data}
            showHpBar
            currentHP={p2HP}
            maxHP={p2MaxHP}
            shield={p2Shield}
            nameOverride={p2Data?.nom ?? p2Data?.name}
            combatBaseOverride={p2CombatBase}
            combatModifiers={p2CombatModifiers}
            opponent={p1Data}
            combatStatus={p2CombatStatus}
            detailsPlacement="right"
          />
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER PRINCIPAL
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-amber-400 text-lg animate-pulse">Chargement du tournoi...</div>
      </div>
    );
  }

  if (listenerError) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <div className="bg-stone-950/85 border border-red-800/50 rounded-xl p-8">
            <p className="text-red-400 text-lg font-bold">Impossible de charger le tournoi</p>
            <p className="text-stone-500 mt-2 text-sm">{listenerError}</p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="mt-6 bg-stone-800 hover:bg-stone-700 text-stone-200 px-6 py-2 rounded-lg transition border border-stone-600"
          >
            ← Retour à l'admin
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PAS DE TOURNOI → COUNTDOWN
  // ============================================================================
  if (!tournoi) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-2xl mx-auto pt-20 text-center">
          {isSimulation ? (
            <>
              <h1 className="text-3xl font-bold text-amber-400 mb-6">🎲 Simulation de Tournoi</h1>
              <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl p-8">
                <p className="text-stone-300 text-lg">Aucune simulation en cours</p>
                <p className="text-stone-500 mt-2 text-sm">Lancez une simulation depuis le panel admin</p>
              </div>
              <button onClick={() => navigate('/admin')} className="mt-6 bg-stone-800 hover:bg-stone-700 text-stone-200 px-6 py-2 rounded-lg transition border border-stone-600">
                ← Retour à l'admin
              </button>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-amber-400 mb-6">🏟️ Tournoi du Samedi</h1>

              {phase === 'attente' && countdown && (
                <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl p-8">
                  <p className="text-stone-400 text-sm uppercase tracking-widest mb-4">Prochain tournoi dans</p>
                  <div className="text-5xl md:text-6xl font-bold text-amber-400 font-mono tracking-wider mb-6">
                    {countdown}
                  </div>
                  <div className="flex justify-center gap-6 text-sm text-stone-500">
                    <span>📣 18h — Annonce</span>
                    <span>⚔️ 19h — Combats</span>
                  </div>
                </div>
              )}

              {(phase === 'annonce' || phase === 'combat') && (
                <div className="bg-stone-950/85 border border-amber-700/60 rounded-xl p-8">
                  <div className="text-4xl mb-4 animate-pulse">⏳</div>
                  <p className="text-amber-300 text-lg font-bold">Préparation du tournoi en cours...</p>
                  <p className="text-stone-500 mt-2 text-sm">Les duels seront annoncés dans un instant</p>
                </div>
              )}

              <button onClick={() => navigate('/')} className="mt-6 bg-stone-800 hover:bg-stone-700 text-stone-200 px-6 py-2 rounded-lg transition border border-stone-600">
                ← Retour
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // TOURNOI EN PRÉPARATION (18h-19h)
  // ============================================================================
  if (tournoi.statut === 'preparation') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-5xl mx-auto pt-20">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-amber-400">
              {isSimulation ? '🎲 Simulation — Les duels sont prêts !' : '🏟️ Les duels sont annoncés !'}
            </h1>
            <p className="text-stone-400 mt-2 text-sm">
              {tournoi.participantsList?.length || 0} combattants{isSimulation ? '' : ' • Début à 19h'}
            </p>
          </div>

          <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl p-4 mb-6 overflow-x-auto">
            <h2 className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-4">📊 Arbre du tournoi</h2>
            {renderBracket()}
          </div>

          <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl p-4 mb-6">
            <h2 className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-4">👥 Participants</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {tournoi.participantsList?.map(p => (
                <div key={p.participantId || p.userId} className="bg-stone-900/80 border border-stone-700/60 rounded-lg p-3 text-center">
                  {p.characterImage && (
                    <img src={p.characterImage} alt={p.nom} className="w-14 h-auto mx-auto mb-2 object-contain rounded" />
                  )}
                  <p className="text-white font-bold text-xs truncate">{p.nom}</p>
                  <p className="text-stone-500 text-[10px]">{p.race} • {p.classe}</p>
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="text-center bg-stone-950/85 border border-red-800/50 rounded-xl p-6">
              <p className="text-stone-500 text-xs mb-4">Le tirage se lance automatiquement à 18h, puis le premier combat à 19h.</p>
              <button
                onClick={async () => {
                  setActionLoading(true);
                  await lancerTournoi(docId);
                  setActionLoading(false);
                }}
                disabled={actionLoading}
                className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white px-10 py-3 font-bold text-lg rounded-lg transition"
              >
                {actionLoading ? '⏳ Lancement...' : '🚀 Lancer manuellement'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // TOURNOI EN COURS OU TERMINÉ — COMBAT UI
  // ============================================================================
  const isTournoiTermine = tournoi.statut === 'termine' || (tournoi.matchActuel >= tournoi.matchOrder.length);
  const matchProgress = tournoi.matchActuel >= 0
    ? `Match ${Math.min(tournoi.matchActuel + 1, tournoi.matchOrder.length)} / ${tournoi.matchOrder.length}`
    : '';

  return (
    <div className="min-h-screen p-4 md:p-6">
      <Header />

      {/* Musique de combat */}
      <audio id="tournament-combat-music" loop>
        <source src="/assets/music/combat.mp3" type="audio/mpeg" />
      </audio>
      <audio id="tournament-victory-music">
        <source src="/assets/music/victory.mp3" type="audio/mpeg" />
      </audio>

      <div className="max-w-[1800px] mx-auto pt-16">
        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="text-2xl md:text-3xl font-bold text-amber-400">
            {isSimulation ? '🎲' : '🏟️'} {isTournoiTermine
              ? (isSimulation ? 'Simulation Terminée' : 'Tournoi Terminé')
              : (isSimulation ? 'Simulation en direct' : 'Tournoi en direct')}
          </h1>
          {matchProgress && <p className="text-stone-500 text-sm mt-1">{matchProgress}</p>}
        </div>

        {/* Annonce DBZ */}
        {annonceActuelle && (
          <div className="mb-5 bg-gradient-to-r from-red-950/70 via-amber-950/70 to-red-950/70 border border-amber-600/60 rounded-xl p-5 text-center">
            <p className="text-amber-200 font-bold text-base md:text-lg whitespace-pre-line animate-pulse">
              📢 {annonceActuelle}
            </p>
          </div>
        )}

        {/* Champion */}
        {isTournoiTermine && tournoi.champion && (
          <div className="mb-5 bg-stone-950/85 border border-amber-600/50 rounded-xl p-6 text-center">
            <div className="text-5xl mb-3">👑</div>
            {tournoi.champion.characterImage && (
              <img src={tournoi.champion.characterImage} alt={tournoi.champion.nom} className="w-28 h-auto mx-auto mb-3 object-contain rounded-lg" />
            )}
            <h2 className="text-2xl font-bold text-amber-300">{tournoi.champion.nom}</h2>
            <p className="text-stone-400 text-sm mt-1">{tournoi.champion.race} • {tournoi.champion.classe}</p>
            <p className="text-amber-400 font-bold text-sm mt-2 uppercase tracking-widest">{isSimulation ? 'Champion de la simulation' : 'Champion du tournoi'}</p>
            {!isSimulation && <p className="text-stone-500 text-xs mt-1">Récompense : 3 rolls pour le prochain personnage</p>}
          </div>
        )}

        {/* Combat UI (même layout que Combat.jsx) */}
        {renderCombatUI()}

        {/* Bracket (toggle) */}
        <div className="mt-5">
          <button
            onClick={() => setShowBracket(!showBracket)}
            className={`bg-stone-950/85 hover:bg-stone-900 text-stone-300 px-5 py-2.5 transition border w-full text-left text-sm font-bold ${
              showBracket ? 'rounded-t-xl border-stone-700/80' : 'rounded-xl border-stone-700/80'
            } ${cooldownRemaining > 0 ? 'border-amber-700/40' : ''}`}
          >
            {showBracket ? '▼' : '▶'} 📊 Arbre du tournoi
            {cooldownRemaining > 0 && (
              <span className="ml-3 text-amber-400 font-mono text-xs">
                ⏳ {cooldownRemaining}s
              </span>
            )}
          </button>
          {showBracket && (
            <div className={`bg-stone-950/85 border border-t-0 rounded-b-xl p-4 overflow-x-auto ${cooldownRemaining > 0 ? 'border-amber-700/40' : 'border-stone-700/80'}`}>
              {renderBracket()}
            </div>
          )}
        </div>

        {/* Admin Controls */}
        {isAdmin && !isTournoiTermine && (
          <div className="mt-5 bg-stone-950/85 border border-red-800/40 rounded-xl p-4 flex flex-wrap gap-3 justify-center">
            <button
              onClick={handleMatchSuivant}
              disabled={actionLoading || isAnimating}
              className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white px-6 py-2.5 font-bold text-sm rounded-lg transition"
            >
              {actionLoading ? '⏳ Simulation...' : '⏭️ Match suivant'}
            </button>
          </div>
        )}

        {isAdmin && isTournoiTermine && (
          <div className="mt-5 bg-stone-950/85 border border-red-800/40 rounded-xl p-4 flex flex-wrap gap-3 justify-center">
            <button
              onClick={handleTerminerTournoi}
              disabled={actionLoading}
              className={`${isSimulation ? 'bg-stone-700 hover:bg-stone-600' : 'bg-red-700 hover:bg-red-600'} disabled:bg-stone-700 text-white px-6 py-2.5 font-bold text-sm rounded-lg transition`}
            >
              {actionLoading ? '⏳...' : isSimulation ? '← Quitter la simulation' : '🏁 Archiver & Terminer'}
            </button>
          </div>
        )}

        {isSimulation && !isTournoiTermine && (
          <div className="mt-4 text-center">
            <button
              onClick={async () => {
                if (animationRef.current) animationRef.current.cancelled = true;
                if (autoAdvanceRef.current) { clearTimeout(autoAdvanceRef.current); autoAdvanceRef.current = null; }
                setActionLoading(true);
                await terminerTournoi(docId);
                setActionLoading(false);
                navigate('/admin');
              }}
              disabled={actionLoading}
              className="bg-stone-800 hover:bg-stone-700 disabled:bg-stone-700 text-stone-200 px-5 py-2 text-sm rounded-lg transition border border-stone-600"
            >
              {actionLoading ? '⏳...' : '← Quitter la simulation'}
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-5 text-center">
          <button onClick={() => navigate(isSimulation ? '/admin' : '/')} className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-5 py-2 text-sm rounded-lg transition border border-stone-600">
            ← Retour
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tournament;
