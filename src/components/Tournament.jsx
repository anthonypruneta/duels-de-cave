import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import {
  onTournoiUpdate, getCombatLog, creerTournoi, lancerTournoi,
  avancerMatch, terminerTournoi
} from '../services/tournamentService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';

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
// CARTE PERSONNAGE TOURNOI (même style que Combat.jsx)
// ============================================================================

const TournamentCharacterCard = ({ participant, currentHP, maxHP }) => {
  if (!participant) return null;
  const hpPercent = maxHP > 0 ? (currentHP / maxHP) * 100 : 100;
  const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
  const weapon = participant.equippedWeaponData ||
    (participant.equippedWeaponId ? getWeaponById(participant.equippedWeaponId) : null);
  const pClass = participant.classe || participant.class;
  const pName = participant.nom || participant.name;

  const passiveDetails = (() => {
    if (!participant.mageTowerPassive) return null;
    const base = getMageTowerPassiveById(participant.mageTowerPassive.id);
    const levelData = base ? getMageTowerPassiveLevel(participant.mageTowerPassive.id, participant.mageTowerPassive.level) : null;
    if (!base || !levelData) return null;
    return { ...base, level: participant.mageTowerPassive.level, levelData };
  })();

  const raceData = races[participant.race];
  const classData = classes[pClass];
  const awakeningInfo = raceData?.awakening || null;
  const isAwakeningActive = awakeningInfo && (participant.level ?? 1) >= awakeningInfo.levelRequired;

  return (
    <div className="relative shadow-2xl overflow-visible">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-stone-200 px-5 py-1.5 text-sm font-bold shadow-lg border border-stone-500 z-10 whitespace-nowrap">
        {participant.race} • {pClass} • Niv. {participant.level ?? 1}
      </div>
      <div className="overflow-visible">
        <div className="h-auto relative bg-stone-900 flex items-center justify-center">
          {participant.characterImage ? (
            <img src={participant.characterImage} alt={pName} className="w-full h-auto object-contain" />
          ) : (
            <div className="w-full h-48 bg-stone-800 flex items-center justify-center">
              <span className="text-6xl">{raceData?.icon || '❓'}</span>
            </div>
          )}
          <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-3">
            <div className="text-white font-bold text-xl text-center">{pName}</div>
          </div>
        </div>
        <div className="bg-stone-800 p-4 border-t border-stone-600">
          <div className="mb-3">
            <div className="flex justify-between text-sm text-white mb-2">
              <span>HP: {participant.base?.hp}</span>
              <span>VIT: {participant.base?.spd}</span>
            </div>
            <div className="text-xs text-stone-400 mb-2">{pName} — PV {Math.max(0, currentHP)}/{maxHP}</div>
            <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600">
              <div className={`h-full transition-all duration-500 ${hpClass}`} style={{width: `${Math.max(0, hpPercent)}%`}} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div className="text-stone-400">Auto: <span className="text-white">{participant.base?.auto}</span></div>
            <div className="text-stone-400">Déf: <span className="text-white">{participant.base?.def}</span></div>
            <div className="text-stone-400">Cap: <span className="text-white">{participant.base?.cap}</span></div>
            <div className="text-stone-400">ResC: <span className="text-white">{participant.base?.rescap}</span></div>
          </div>
          <div className="space-y-2">
            {weapon && (
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-xl">{weapon.icon}</span>
                <span className={`font-semibold ${RARITY_COLORS[weapon.rarete]}`}>{weapon.nom}</span>
              </div>
            )}
            {passiveDetails && (
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">{passiveDetails.icon}</span>
                <div className="flex-1">
                  <div className="text-amber-300 font-semibold mb-1">
                    {passiveDetails.name} — Niv. {passiveDetails.level}
                  </div>
                  <div className="text-stone-400 text-[10px]">
                    {passiveDetails.levelData.description}
                  </div>
                </div>
              </div>
            )}
            {isAwakeningActive && (
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">✨</span>
                <div className="flex-1">
                  <div className="text-amber-300 font-semibold mb-1">
                    Éveil racial (Niv {awakeningInfo.levelRequired}+)
                  </div>
                  <div className="text-stone-400 text-[10px]">{awakeningInfo.description}</div>
                </div>
              </div>
            )}
            {raceData && (
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">{raceData.icon}</span>
                <span className="text-stone-300">{raceData.bonus}</span>
              </div>
            )}
            {classData && (
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">{classData.icon}</span>
                <div className="flex-1">
                  <div className="text-stone-200 font-semibold mb-1">{classData.ability}</div>
                  <div className="text-stone-400 text-[10px]">{classData.description}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

const Tournament = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  // Tournoi state
  const [tournoi, setTournoi] = useState(null);
  const [loading, setLoading] = useState(true);

  // Combat state
  const [combatLog, setCombatLog] = useState([]);
  const [matchEnCours, setMatchEnCours] = useState(null);
  const [p1HP, setP1HP] = useState(0);
  const [p2HP, setP2HP] = useState(0);
  const [p1MaxHP, setP1MaxHP] = useState(0);
  const [p2MaxHP, setP2MaxHP] = useState(0);
  const [winner, setWinner] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [annonceActuelle, setAnnonceActuelle] = useState('');
  const [replayMatchId, setReplayMatchId] = useState(null);

  // Sound
  const [isSoundOpen, setIsSoundOpen] = useState(true);
  const [volume, setVolume] = useState(0.3);
  const [isMuted, setIsMuted] = useState(false);

  // Schedule
  const [countdown, setCountdown] = useState('');
  const [phase, setPhase] = useState('attente');
  const autoCreatedRef = useRef(false);
  const autoLaunchedRef = useRef(false);

  // Bracket toggle
  const [showBracket, setShowBracket] = useState(false);

  // Admin
  const [actionLoading, setActionLoading] = useState(false);

  // Refs
  const logEndRef = useRef(null);
  const animationRef = useRef(null);
  const lastAnimatedMatch = useRef(-1);
  const autoAdvanceRef = useRef(null);

  // ============================================================================
  // SOUND CONTROL
  // ============================================================================

  const applyCombatVolume = () => {
    const combatMusic = document.getElementById('tournament-combat-music');
    const victoryMusic = document.getElementById('tournament-victory-music');
    [combatMusic, victoryMusic].forEach((audio) => {
      if (audio) {
        audio.volume = volume;
        audio.muted = isMuted;
      }
    });
  };

  useEffect(() => {
    applyCombatVolume();
  }, [volume, isMuted, matchEnCours, winner]);

  const handleVolumeChange = (event) => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    if (isMuted && volume === 0) setVolume(0.3);
  };

  const SoundControl = () => (
    <div className="fixed top-20 right-4 z-50 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setIsSoundOpen((prev) => !prev)}
        className="bg-amber-600 text-white border border-amber-400 px-3 py-2 text-sm font-bold shadow-lg hover:bg-amber-500"
      >
        {isMuted || volume === 0 ? '🔇' : '🔊'} Son
      </button>
      {isSoundOpen && (
        <div className="bg-stone-900 border border-stone-600 p-3 w-56 shadow-xl">
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleMute} className="text-lg">
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input
              type="range" min="0" max="1" step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full accent-amber-500"
            />
            <span className="text-xs text-stone-200 w-10 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // LISTENERS ET TIMERS
  // ============================================================================

  // Listener tournoi en temps réel
  useEffect(() => {
    const unsubscribe = onTournoiUpdate((data) => {
      setTournoi(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  // Auto-création à 18h (admin)
  useEffect(() => {
    if (!isAdmin || autoCreatedRef.current || tournoi || loading) return;
    if (phase === 'annonce' || phase === 'combat') {
      autoCreatedRef.current = true;
      (async () => {
        setActionLoading(true);
        await creerTournoi();
        setActionLoading(false);
      })();
    }
  }, [phase, isAdmin, tournoi, loading]);

  // Auto-lancement à 19h (admin)
  useEffect(() => {
    if (!isAdmin || autoLaunchedRef.current || !tournoi || loading) return;
    if (phase === 'combat' && tournoi.statut === 'preparation') {
      autoLaunchedRef.current = true;
      (async () => {
        setActionLoading(true);
        await lancerTournoi();
        setActionLoading(false);
      })();
    }
  }, [phase, isAdmin, tournoi, loading]);

  // Auto-scroll du combat log
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [combatLog]);

  // Cleanup auto-advance on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
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

  const animerMatch = async (matchId) => {
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

    setIsAnimating(true);
    setCombatLog([]);
    setMatchEnCours(matchId);
    setReplayMatchId(null);
    setWinner(null);
    setAnnonceActuelle('');

    // Lancer la musique de combat
    const combatMusic = document.getElementById('tournament-combat-music');
    const victoryMusic = document.getElementById('tournament-victory-music');
    if (victoryMusic) victoryMusic.pause();
    if (combatMusic) {
      combatMusic.currentTime = 0;
      combatMusic.volume = volume;
      combatMusic.play().catch(e => console.log('Autoplay bloqué:', e));
    }

    // Charger le combat log
    const result = await getCombatLog(matchId);
    if (!result.success || token.cancelled) {
      setIsAnimating(false);
      return;
    }

    const logData = result.data;
    setP1MaxHP(logData.p1MaxHP || 0);
    setP2MaxHP(logData.p2MaxHP || 0);
    setP1HP(logData.p1MaxHP || 0);
    setP2HP(logData.p2MaxHP || 0);

    // Annonce de début
    setAnnonceActuelle(logData.annonceDebut);
    await delay(3000);
    if (token.cancelled) return;
    setAnnonceActuelle('');

    // Jouer les steps un par un
    if (logData.steps && logData.steps.length > 0) {
      for (const step of logData.steps) {
        if (token.cancelled) return;

        if (step.phase === 'intro') {
          for (const line of step.logs) {
            if (token.cancelled) return;
            setCombatLog(prev => [...prev, line]);
            await delay(300);
          }
          setP1HP(step.p1HP);
          setP2HP(step.p2HP);
          await delay(500);
        } else if (step.phase === 'turn_start') {
          for (const line of step.logs) {
            if (token.cancelled) return;
            setCombatLog(prev => [...prev, line]);
          }
          await delay(800);
        } else if (step.phase === 'action') {
          for (const line of step.logs) {
            if (token.cancelled) return;
            setCombatLog(prev => [...prev, line]);
          }
          setP1HP(step.p1HP);
          setP2HP(step.p2HP);
          await delay(2000);
        } else if (step.phase === 'victory') {
          for (const line of step.logs) {
            if (token.cancelled) return;
            setCombatLog(prev => [...prev, line]);
          }
          setP1HP(step.p1HP);
          setP2HP(step.p2HP);
        }
      }
    } else {
      // Fallback: affichage ligne par ligne (ancien format sans steps)
      for (let i = 0; i < logData.combatLog.length; i++) {
        if (token.cancelled) return;
        const line = logData.combatLog[i];
        setCombatLog(prev => [...prev, line]);
        const isNewTurn = line.includes('---');
        await delay(isNewTurn ? 800 : 350);
      }
    }

    if (token.cancelled) return;

    // Victoire
    setWinner(logData.winnerNom);
    setAnnonceActuelle(logData.annonceFin);
    setIsAnimating(false);

    // Arrêter musique combat, jouer victoire
    if (combatMusic) combatMusic.pause();
    if (victoryMusic) {
      victoryMusic.currentTime = 0;
      victoryMusic.volume = volume;
      victoryMusic.play().catch(e => console.log('Autoplay bloqué:', e));
    }

    // Auto-avancer après 8 secondes (admin seulement)
    if (isAdmin && !replayMatchId) {
      autoAdvanceRef.current = setTimeout(async () => {
        autoAdvanceRef.current = null;
        const advResult = await avancerMatch();
        if (advResult.skipped) {
          // Match bye, avancer encore
          await avancerMatch();
        }
      }, 8000);
    }
  };

  const rejouerMatch = async (matchId) => {
    if (animationRef.current) animationRef.current.cancelled = true;
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    setReplayMatchId(matchId);
    await animerMatch(matchId);
  };

  // ============================================================================
  // ADMIN ACTIONS
  // ============================================================================

  const handleMatchSuivant = async () => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    setActionLoading(true);
    const result = await avancerMatch();
    if (!result.success) alert('Erreur: ' + result.error);
    if (result.skipped) {
      await avancerMatch();
    }
    if (result.termine && tournoi?.champion) {
      setAnnonceActuelle(tournoi.annonceChampion || `🏆 ${tournoi.champion.nom} EST LE CHAMPION !!!`);
    }
    setActionLoading(false);
  };

  const handleTerminerTournoi = async () => {
    if (!window.confirm('Terminer le tournoi ? Tous les personnages seront archivés.')) return;
    setActionLoading(true);
    const result = await terminerTournoi();
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

  const renderBracketMatch = (matchId) => {
    if (!tournoi) return null;
    const match = tournoi.matches[matchId];
    if (!match) return null;

    const p1 = match.p1 && match.p1 !== 'BYE' ? tournoi.participants[match.p1] : null;
    const p2 = match.p2 && match.p2 !== 'BYE' ? tournoi.participants[match.p2] : null;
    const isCurrentMatch = tournoi.matchOrder[tournoi.matchActuel] === matchId;
    const isTermine = match.statut === 'termine';
    const isBye = match.statut === 'bye';

    if (isBye) return null;

    const borderClass = isCurrentMatch ? 'border-amber-400 bg-amber-900/20' :
      isTermine ? 'border-stone-600 bg-stone-800/50' : 'border-stone-700 bg-stone-900/30';

    return (
      <div
        key={matchId}
        className={`border ${borderClass} p-2 text-xs cursor-pointer hover:border-amber-500 transition mb-2`}
        onClick={() => isTermine && rejouerMatch(matchId)}
        title={isTermine ? 'Cliquer pour revoir' : ''}
      >
        <div className="text-stone-500 text-[10px] mb-1">{match.roundLabel}</div>
        <div className={`flex justify-between items-center ${match.winnerId === match.p1 ? 'text-amber-300 font-bold' : 'text-stone-400'}`}>
          <span>{p1 ? p1.nom : '?'}</span>
          {match.winnerId === match.p1 && <span className="text-green-400 text-[10px]">W</span>}
        </div>
        <div className="text-stone-600 text-center text-[10px]">vs</div>
        <div className={`flex justify-between items-center ${match.winnerId === match.p2 ? 'text-amber-300 font-bold' : 'text-stone-400'}`}>
          <span>{p2 ? p2.nom : '?'}</span>
          {match.winnerId === match.p2 && <span className="text-green-400 text-[10px]">W</span>}
        </div>
        {isCurrentMatch && <div className="text-amber-400 text-center text-[10px] mt-1 animate-pulse">EN COURS</div>}
        {isTermine && <div className="text-stone-500 text-center text-[10px] mt-1">Cliquer pour revoir</div>}
      </div>
    );
  };

  const renderBracket = () => {
    if (!tournoi || !tournoi.matches) return null;

    const winnersRounds = {};
    const losersRounds = {};
    let hasGF = false;
    let hasGFR = false;

    for (const [id, match] of Object.entries(tournoi.matches)) {
      if (match.statut === 'bye') continue;
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

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-amber-400 font-bold mb-2">🏆 Winners Bracket</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {Object.keys(winnersRounds).sort((a, b) => a - b).map(round => (
              <div key={`wr-${round}`} className="min-w-[160px]">
                {winnersRounds[round].sort().map(id => renderBracketMatch(id))}
              </div>
            ))}
          </div>
        </div>

        {Object.keys(losersRounds).length > 0 && (
          <div>
            <h3 className="text-red-400 font-bold mb-2">💀 Losers Bracket</h3>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {Object.keys(losersRounds).sort((a, b) => a - b).map(round => (
                <div key={`lr-${round}`} className="min-w-[160px]">
                  {losersRounds[round].sort().map(id => renderBracketMatch(id))}
                </div>
              ))}
            </div>
          </div>
        )}

        {hasGF && (
          <div>
            <h3 className="text-yellow-300 font-bold mb-2">👑 Grande Finale</h3>
            <div className="max-w-[200px]">
              {renderBracketMatch('GF')}
              {hasGFR && renderBracketMatch('GFR')}
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
        <div className="order-1 md:order-1 w-full md:w-[340px] md:flex-shrink-0">
          <TournamentCharacterCard
            participant={p1Data}
            currentHP={p1HP}
            maxHP={p1MaxHP}
          />
        </div>

        {/* Zone centrale - Combat log */}
        <div className="order-2 md:order-2 w-full md:w-[600px] md:flex-shrink-0 flex flex-col">
          {/* Message de victoire */}
          {winner && (
            <div className="flex justify-center mb-4">
              <div className="bg-stone-100 text-stone-900 px-8 py-3 font-bold text-xl animate-pulse shadow-2xl border-2 border-stone-400">
                🏆 {winner} remporte le combat! 🏆
              </div>
            </div>
          )}

          {/* Zone de chat messenger */}
          <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[480px] md:h-[600px]">
            <div className="bg-stone-900 p-3 border-b border-stone-600">
              <h2 className="text-lg md:text-2xl font-bold text-stone-200 text-center">
                ⚔️ {replayMatchId ? 'Replay' : 'Combat en direct'}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
              {combatLog.length === 0 && !isAnimating ? (
                <p className="text-stone-500 italic text-center py-6 md:py-8 text-xs md:text-sm">
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
                              <div className="text-xs md:text-sm">{formatLogMessage(cleanLog)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="flex justify-end">
                        <div className="max-w-[80%]">
                          <div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-r-4 border-purple-500">
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
        <div className="order-3 md:order-3 w-full md:w-[340px] md:flex-shrink-0">
          <TournamentCharacterCard
            participant={p2Data}
            currentHP={p2HP}
            maxHP={p2MaxHP}
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
        <div className="text-amber-400 text-2xl">Chargement du tournoi...</div>
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
          <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block mb-8">
            <h1 className="text-4xl font-bold text-amber-400">🏟️ Tournoi du Samedi</h1>
          </div>

          {phase === 'attente' && countdown && (
            <div className="bg-stone-800/90 p-8 border-2 border-stone-600 rounded-xl">
              <p className="text-stone-300 text-xl mb-6">Prochain tournoi dans</p>
              <div className="text-5xl md:text-6xl font-bold text-amber-400 font-mono tracking-wider mb-6">
                {countdown}
              </div>
              <p className="text-stone-500">Samedi à 18h — Annonce des duels</p>
              <p className="text-stone-500">Samedi à 19h — Début des combats</p>
            </div>
          )}

          {(phase === 'annonce' || phase === 'combat') && (
            <div className="bg-stone-800/90 p-8 border-2 border-amber-500 rounded-xl">
              <div className="text-4xl mb-4 animate-pulse">⏳</div>
              <p className="text-amber-300 text-xl font-bold">Préparation du tournoi en cours...</p>
              <p className="text-stone-400 mt-2">Les duels seront annoncés dans un instant</p>
            </div>
          )}

          <button onClick={() => navigate('/')} className="mt-6 bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg transition">
            ← Retour
          </button>
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
        <div className="max-w-4xl mx-auto pt-20">
          <div className="text-center mb-8">
            <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block">
              <h1 className="text-4xl font-bold text-amber-400">🏟️ Les duels sont annoncés !</h1>
              <p className="text-stone-400 mt-2">{tournoi.participantsList?.length || 0} combattants • Début à 19h</p>
            </div>
          </div>

          <div className="bg-stone-800/90 border border-stone-600 p-4 rounded-xl mb-8 overflow-x-auto">
            <h2 className="text-xl font-bold text-stone-200 mb-4">📊 Arbre du tournoi</h2>
            {renderBracket()}
          </div>

          <div className="bg-stone-800 border border-stone-600 p-6 rounded-xl mb-8">
            <h2 className="text-xl font-bold text-amber-300 mb-4">Participants</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {tournoi.participantsList?.map(p => (
                <div key={p.userId} className="bg-stone-900/50 p-3 border border-stone-700 text-center">
                  {p.characterImage && (
                    <img src={p.characterImage} alt={p.nom} className="w-16 h-auto mx-auto mb-2 object-contain" />
                  )}
                  <p className="text-white font-bold text-sm">{p.nom}</p>
                  <p className="text-stone-400 text-xs">{p.race} • {p.classe}</p>
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="text-center bg-stone-900 border border-red-600 p-6 rounded-xl">
              <h3 className="text-red-400 font-bold mb-4">Admin</h3>
              <p className="text-stone-500 text-sm mb-4">Le tournoi se lance automatiquement à 19h.</p>
              <button
                onClick={async () => {
                  setActionLoading(true);
                  await lancerTournoi();
                  setActionLoading(false);
                }}
                disabled={actionLoading}
                className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white px-12 py-4 font-bold text-xl rounded-lg transition"
              >
                {actionLoading ? '⏳ Lancement...' : '🚀 LANCER MANUELLEMENT'}
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
      <SoundControl />

      {/* Musique de combat */}
      <audio id="tournament-combat-music" loop>
        <source src="/assets/music/combat.mp3" type="audio/mpeg" />
      </audio>
      <audio id="tournament-victory-music">
        <source src="/assets/music/victory.mp3" type="audio/mpeg" />
      </audio>

      <div className="max-w-[1800px] mx-auto pt-16">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block">
            <h1 className="text-3xl md:text-4xl font-bold text-amber-400">
              🏟️ {isTournoiTermine ? 'Tournoi Terminé' : 'Tournoi en direct'}
            </h1>
            {matchProgress && <p className="text-stone-400 mt-1">{matchProgress}</p>}
          </div>
        </div>

        {/* Annonce DBZ */}
        {annonceActuelle && (
          <div className="mb-6 bg-gradient-to-r from-red-900/80 via-amber-900/80 to-red-900/80 border-2 border-amber-500 p-6 text-center animate-pulse rounded-xl">
            <p className="text-amber-200 font-bold text-lg md:text-xl whitespace-pre-line">
              📢 {annonceActuelle}
            </p>
          </div>
        )}

        {/* Champion */}
        {isTournoiTermine && tournoi.champion && (
          <div className="mb-6 bg-gradient-to-r from-yellow-900/50 via-amber-800/50 to-yellow-900/50 border-2 border-yellow-500 p-8 text-center rounded-xl">
            <div className="text-6xl mb-4">👑</div>
            {tournoi.champion.characterImage && (
              <img src={tournoi.champion.characterImage} alt={tournoi.champion.nom} className="w-32 h-auto mx-auto mb-4 object-contain" />
            )}
            <h2 className="text-3xl font-bold text-yellow-300">{tournoi.champion.nom}</h2>
            <p className="text-amber-300">{tournoi.champion.race} • {tournoi.champion.classe}</p>
            <p className="text-yellow-400 font-bold mt-2">CHAMPION DU TOURNOI</p>
            <p className="text-stone-400 text-sm mt-1">Récompense: 3 rolls pour le prochain personnage</p>
          </div>
        )}

        {/* Combat UI (même layout que Combat.jsx) */}
        {renderCombatUI()}

        {/* Bracket (toggle) */}
        <div className="mt-6">
          <button
            onClick={() => setShowBracket(!showBracket)}
            className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-6 py-2 rounded-lg transition border border-stone-600 w-full text-left font-bold"
          >
            {showBracket ? '▼' : '▶'} 📊 Arbre du tournoi
          </button>
          {showBracket && (
            <div className="bg-stone-800/90 border border-stone-600 p-4 rounded-b-xl overflow-x-auto">
              {renderBracket()}
            </div>
          )}
        </div>

        {/* Admin Controls */}
        {isAdmin && !isTournoiTermine && (
          <div className="mt-6 bg-stone-900 border border-red-600 p-4 rounded-xl flex flex-wrap gap-4 justify-center">
            <button
              onClick={handleMatchSuivant}
              disabled={actionLoading || isAnimating}
              className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white px-8 py-3 font-bold rounded-lg transition"
            >
              {actionLoading ? '⏳ Simulation...' : '⏭️ Match suivant'}
            </button>
          </div>
        )}

        {isAdmin && isTournoiTermine && (
          <div className="mt-6 bg-stone-900 border border-red-600 p-4 rounded-xl flex flex-wrap gap-4 justify-center">
            <button
              onClick={handleTerminerTournoi}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-500 disabled:bg-stone-700 text-white px-8 py-3 font-bold rounded-lg transition"
            >
              {actionLoading ? '⏳...' : '🏁 Archiver & Terminer'}
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 text-center">
          <button onClick={() => navigate('/')} className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg transition">
            ← Retour
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tournament;
