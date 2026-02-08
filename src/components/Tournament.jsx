import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import {
  onTournoiUpdate, getCombatLog, creerTournoi, lancerTournoi,
  avancerMatch, terminerTournoi
} from '../services/tournamentService';

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
  const day = now.getDay(); // 0=dim, 6=sam
  let daysUntil = (6 - day + 7) % 7;
  // Si on est samedi mais après 19h → prochain samedi
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
    if (hour >= 19) return 'combat'; // samedi 19h+
    if (hour >= 18) return 'annonce'; // samedi 18h-19h
  }
  return 'attente'; // pas encore samedi 18h
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
// COMPOSANT
// ============================================================================

const Tournament = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  const [tournoi, setTournoi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [combatLog, setCombatLog] = useState([]);
  const [annonceActuelle, setAnnonceActuelle] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [matchEnCours, setMatchEnCours] = useState(null);
  const [replayMatchId, setReplayMatchId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Schedule
  const [countdown, setCountdown] = useState('');
  const [phase, setPhase] = useState('attente');
  const autoCreatedRef = useRef(false);
  const autoLaunchedRef = useRef(false);

  const logEndRef = useRef(null);
  const animationRef = useRef(null);
  const lastAnimatedMatch = useRef(-1);

  // Listener tournoi
  useEffect(() => {
    const unsubscribe = onTournoiUpdate((data) => {
      setTournoi(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Timer countdown + auto-triggers
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

  // Auto-création à 18h (admin uniquement)
  useEffect(() => {
    if (!isAdmin || autoCreatedRef.current || tournoi || loading) return;
    if (phase === 'annonce' || phase === 'combat') {
      autoCreatedRef.current = true;
      (async () => {
        setActionLoading(true);
        const result = await creerTournoi();
        if (!result.success) console.error('Auto-création échouée:', result.error);
        setActionLoading(false);
      })();
    }
  }, [phase, isAdmin, tournoi, loading]);

  // Auto-lancement à 19h (admin uniquement)
  useEffect(() => {
    if (!isAdmin || autoLaunchedRef.current || !tournoi || loading) return;
    if (phase === 'combat' && tournoi.statut === 'preparation') {
      autoLaunchedRef.current = true;
      (async () => {
        setActionLoading(true);
        const result = await lancerTournoi();
        if (!result.success) console.error('Auto-lancement échoué:', result.error);
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

  // Animer le match quand matchActuel change
  useEffect(() => {
    if (!tournoi || tournoi.statut !== 'en_cours') return;
    if (tournoi.matchActuel < 0) return;
    if (tournoi.matchActuel === lastAnimatedMatch.current) return;

    lastAnimatedMatch.current = tournoi.matchActuel;
    animerMatch(tournoi.matchOrder[tournoi.matchActuel]);
  }, [tournoi?.matchActuel]);

  const animerMatch = async (matchId) => {
    if (!matchId || isAnimating) return;

    if (animationRef.current) {
      animationRef.current.cancelled = true;
    }
    const token = { cancelled: false };
    animationRef.current = token;

    setIsAnimating(true);
    setCombatLog([]);
    setMatchEnCours(matchId);
    setReplayMatchId(null);

    const result = await getCombatLog(matchId);
    if (!result.success || token.cancelled) {
      setIsAnimating(false);
      return;
    }

    const logData = result.data;

    setAnnonceActuelle(logData.annonceDebut);
    await delay(3000);
    if (token.cancelled) return;

    setAnnonceActuelle('');

    for (let i = 0; i < logData.combatLog.length; i++) {
      if (token.cancelled) return;
      const line = logData.combatLog[i];
      setCombatLog(prev => [...prev, line]);
      const isNewTurn = line.includes('---');
      await delay(isNewTurn ? 800 : 350);
    }

    if (!token.cancelled) {
      setAnnonceActuelle(logData.annonceFin);
      setIsAnimating(false);
    }
  };

  const rejouerMatch = async (matchId) => {
    if (animationRef.current) {
      animationRef.current.cancelled = true;
    }
    setReplayMatchId(matchId);
    setMatchEnCours(matchId);
    await animerMatch(matchId);
  };

  // ============================================================================
  // ADMIN ACTIONS
  // ============================================================================

  const handleMatchSuivant = async () => {
    setActionLoading(true);
    setCombatLog([]);
    setAnnonceActuelle('');
    const result = await avancerMatch();
    if (!result.success) alert('Erreur: ' + result.error);
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
  // FORMAT COMBAT LOG
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
        {isTermine && <div className="text-stone-500 text-center text-[10px] mt-1">Terminé - Cliquer pour revoir</div>}
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
  // RENDER MATCH VIEWER
  // ============================================================================

  const renderMatchViewer = () => {
    if (!matchEnCours) return null;

    return (
      <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[500px] md:h-[600px]">
        <div className="bg-stone-900 p-3 border-b border-stone-600">
          <h2 className="text-lg font-bold text-stone-200 text-center">
            ⚔️ {replayMatchId ? 'Replay' : 'Combat en direct'}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
          {combatLog.length === 0 && !isAnimating ? (
            <p className="text-stone-500 italic text-center py-8 text-sm">En attente du prochain match...</p>
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
                        <div className="bg-stone-100 text-stone-900 px-6 py-3 font-bold text-base shadow-lg border border-stone-400">
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
                      <div className="max-w-[85%]">
                        <div className="bg-stone-700 text-stone-200 px-3 py-2 shadow-lg border-l-4 border-blue-500">
                          <div className="text-xs md:text-sm">{formatLogMessage(cleanLog)}</div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="flex justify-end">
                    <div className="max-w-[85%]">
                      <div className="bg-stone-700 text-stone-200 px-3 py-2 shadow-lg border-r-4 border-purple-500">
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
    );
  };

  // ============================================================================
  // RENDER
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
  // PAS DE TOURNOI → COUNTDOWN ou EN ATTENTE DE CRÉATION
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
  // TOURNOI EN PRÉPARATION (18h-19h: bracket visible, attente du lancement)
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

          {/* Bracket en préparation */}
          <div className="bg-stone-800/90 border border-stone-600 p-4 rounded-xl mb-8 overflow-x-auto">
            <h2 className="text-xl font-bold text-stone-200 mb-4">📊 Arbre du tournoi</h2>
            {renderBracket()}
          </div>

          {/* Liste des participants */}
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

          {/* Admin: lancement manuel si besoin */}
          {isAdmin && (
            <div className="text-center bg-stone-900 border border-red-600 p-6 rounded-xl">
              <h3 className="text-red-400 font-bold mb-4">Admin</h3>
              <p className="text-stone-500 text-sm mb-4">Le tournoi se lance automatiquement à 19h. Bouton de secours :</p>
              <button
                onClick={async () => {
                  setActionLoading(true);
                  const result = await lancerTournoi();
                  if (!result.success) alert('Erreur: ' + result.error);
                  setActionLoading(false);
                }}
                disabled={actionLoading}
                className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white px-12 py-4 font-bold text-xl rounded-lg transition"
              >
                {actionLoading ? '⏳ Simulation en cours...' : '🚀 LANCER MANUELLEMENT'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // TOURNOI EN COURS OU TERMINÉ
  // ============================================================================
  const isTournoiTermine = tournoi.statut === 'termine' || (tournoi.matchActuel >= tournoi.matchOrder.length);
  const matchProgress = tournoi.matchActuel >= 0
    ? `Match ${Math.min(tournoi.matchActuel + 1, tournoi.matchOrder.length)} / ${tournoi.matchOrder.length}`
    : '';

  return (
    <div className="min-h-screen p-4 md:p-6">
      <Header />
      <div className="max-w-[1600px] mx-auto pt-16">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block">
            <h1 className="text-3xl md:text-4xl font-bold text-amber-400">
              🏟️ {isTournoiTermine ? 'Tournoi Terminé' : 'Tournoi en cours'}
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

        {/* Layout principal: Bracket + Match Viewer */}
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-1/2 bg-stone-800/90 border border-stone-600 p-4 rounded-xl overflow-x-auto">
            <h2 className="text-xl font-bold text-stone-200 mb-4">📊 Bracket</h2>
            {renderBracket()}
          </div>

          <div className="lg:w-1/2">
            {renderMatchViewer()}
          </div>
        </div>

        {/* Admin Controls */}
        {isAdmin && !isTournoiTermine && (
          <div className="mt-6 bg-stone-900 border border-red-600 p-4 rounded-xl flex flex-wrap gap-4 justify-center">
            <button
              onClick={handleMatchSuivant}
              disabled={actionLoading || isAnimating}
              className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white px-8 py-3 font-bold rounded-lg transition"
            >
              {actionLoading ? '⏳...' : '⏭️ Match suivant'}
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
              {actionLoading ? '⏳...' : '🏁 Archiver & Terminer le tournoi'}
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

// ============================================================================
// UTILS
// ============================================================================

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default Tournament;
