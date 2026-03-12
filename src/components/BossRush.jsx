import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter } from '../services/characterService';
import { grantRunsToPlayer, getPlayerDungeonSummary } from '../services/dungeonService';
import { checkAndAwardTitles } from '../services/titleService';
import { getBossRushBosses, createBossRushCombatant, BOSS_RUSH_COUNT } from '../data/bossRush';
import { simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import UnifiedCharacterCard from './UnifiedCharacterCard';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const BossRush = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [gameState, setGameState] = useState('lobby');
  const [currentBossIndex, setCurrentBossIndex] = useState(0);
  const [playerHP, setPlayerHP] = useState(null);
  const [playerMaxHP, setPlayerMaxHP] = useState(null);
  const [bossHP, setBossHP] = useState(null);
  const [bossMaxHP, setBossMaxHP] = useState(null);
  const [playerShield, setPlayerShield] = useState(0);
  const [bossShield, setBossShield] = useState(0);
  const [playerCombatBase, setPlayerCombatBase] = useState(null);
  const [bossCombatBase, setBossCombatBase] = useState(null);
  const [playerCombatModifiers, setPlayerCombatModifiers] = useState(null);
  const [playerCombatStatus, setPlayerCombatStatus] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [carriedHP, setCarriedHP] = useState(null);
  const [bossRushCompleted, setBossRushCompleted] = useState(false);
  const [rewardGiven, setRewardGiven] = useState(false);
  const [newTitles, setNewTitles] = useState([]);
  const [error, setError] = useState(null);
  const logEndRef = useRef(null);
  const logContainerRef = useRef(null);

  const bosses = getBossRushBosses();

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const char = await getUserCharacter(currentUser.uid);
        if (!char) { navigate('/'); return; }
        setCharacter(char);

        const progressRef = doc(db, 'dungeonProgress', currentUser.uid);
        const progressSnap = await getDoc(progressRef);
        if (progressSnap.exists() && progressSnap.data().bossRushCompleted) {
          setBossRushCompleted(true);
        }
      } catch (err) {
        setError('Erreur de chargement: ' + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser, navigate]);

  useEffect(() => {
    if (logEndRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [combatLog]);

  const startBossRush = () => {
    setGameState('fighting');
    setCurrentBossIndex(0);
    setCarriedHP(null);
    setCombatLog([]);
    setCombatResult(null);
    setNewTitles([]);
    setRewardGiven(false);
    startFight(0, null);
  };

  const startFight = async (bossIdx, previousHP) => {
    if (bossIdx >= BOSS_RUSH_COUNT) return;

    setIsSimulating(true);
    setCombatLog([]);
    setCombatResult(null);
    setPlayerCombatBase(null);
    setBossCombatBase(null);
    setPlayerCombatModifiers(null);
    setPlayerCombatStatus(null);
    setPlayerShield(0);
    setBossShield(0);

    const boss = createBossRushCombatant(bossIdx);

    const playerData = { ...character };
    if (previousHP !== null) {
      playerData._bossRushStartHP = previousHP;
    }

    const result = simulerMatch(playerData, boss);

    setPlayerMaxHP(result.p1MaxHP);
    setBossMaxHP(result.p2MaxHP);
    setPlayerHP(result.p1MaxHP);
    setBossHP(result.p2MaxHP);

    await replayCombatSteps(result.steps, {
      onStep: (step) => {
        setPlayerHP(step.p1HP);
        setBossHP(step.p2HP);
        setPlayerShield(step.p1Shield || 0);
        setBossShield(step.p2Shield || 0);
        setPlayerCombatBase(step.p1Base || null);
        setBossCombatBase(step.p2Base || null);
        setPlayerCombatModifiers(step.p1Modifiers || null);
        setPlayerCombatStatus(step.p1Status || null);
        setCombatLog(prev => [...prev, ...step.logs]);
      },
      delayMs: 600,
      introDelayMs: 1200,
    });

    const isWin = result.winnerId === character.userId;
    setCombatResult({ ...result, isWin });
    setIsSimulating(false);

    const isFinalBoss = bossIdx === BOSS_RUSH_COUNT - 1;
    const titles = await checkAndAwardTitles(
      currentUser.uid, result.steps, result, character,
      { mode: 'boss-rush', bossId: bosses[bossIdx].id, isFinalBoss: isFinalBoss && isWin }
    );
    if (titles.length > 0) setNewTitles(prev => [...prev, ...titles]);

    if (isWin) {
      const finalHP = result.steps[result.steps.length - 1]?.p1HP ?? 0;
      setCarriedHP(finalHP);

      if (isFinalBoss) {
        setGameState('victory');
        if (!bossRushCompleted) {
          await grantRunsToPlayer(currentUser.uid, 10);
          await setDoc(doc(db, 'dungeonProgress', currentUser.uid), {
            bossRushCompleted: true,
            updatedAt: Timestamp.now(),
          }, { merge: true });
          setBossRushCompleted(true);
          setRewardGiven(true);
        }
      } else {
        setGameState('transition');
      }
    } else {
      setGameState('defeat');
    }
  };

  const proceedToNextBoss = () => {
    const nextIdx = currentBossIndex + 1;
    setCurrentBossIndex(nextIdx);
    setGameState('fighting');
    startFight(nextIdx, carriedHP);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-amber-400 text-xl animate-pulse">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-red-400 text-xl">{error}</div>
      </div>
    );
  }

  const currentBoss = bosses[currentBossIndex];

  return (
    <div className="min-h-screen p-4">
      <Header />

      <div className="max-w-6xl mx-auto pt-20">
        {/* Titre */}
        <div className="text-center mb-6">
          <div className="bg-stone-900/70 border-2 border-red-600 rounded-xl px-6 py-3 shadow-xl inline-block">
            <h2 className="text-3xl font-bold text-red-400">💀 Boss Rush</h2>
            <p className="text-red-300/80 text-sm mt-1">6 boss sans répit. Vos PV persistent entre chaque combat.</p>
          </div>
        </div>

        {/* Barre de progression des boss */}
        <div className="flex justify-center gap-2 mb-6">
          {bosses.map((b, i) => {
            let cls = 'bg-stone-800 border-stone-600 text-stone-500';
            if (i < currentBossIndex || gameState === 'victory') cls = 'bg-green-900/50 border-green-600 text-green-300';
            else if (i === currentBossIndex && (gameState === 'fighting' || gameState === 'transition')) cls = 'bg-amber-900/50 border-amber-500 text-amber-300';
            else if (i === currentBossIndex && gameState === 'defeat') cls = 'bg-red-900/50 border-red-600 text-red-300';
            return (
              <div key={b.id} className={`border rounded-lg px-3 py-2 text-center text-xs ${cls}`}>
                <div className="text-lg">{b.icon}</div>
                <div className="font-bold">{b.nom}</div>
              </div>
            );
          })}
        </div>

        {/* LOBBY */}
        {gameState === 'lobby' && (
          <div className="text-center">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl mx-auto mb-6">
              {bosses.map((b) => (
                <div key={b.id} className="bg-stone-800/80 border border-stone-600 rounded-lg p-3 text-center">
                  <div className="text-3xl mb-2">{b.icon}</div>
                  <div className="text-sm font-bold text-stone-200">{b.nom}</div>
                  <div className="text-[10px] text-stone-500 mt-1">HP {b.stats.hp} • Stats ~{b.stats.auto}</div>
                </div>
              ))}
            </div>
            {bossRushCompleted && (
              <div className="bg-green-900/30 border border-green-600 rounded-lg p-3 mb-4 text-green-300 text-sm max-w-md mx-auto">
                ✅ Boss Rush déjà complété ! Vous pouvez retenter sans récompense supplémentaire.
              </div>
            )}
            <button
              onClick={startBossRush}
              className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-10 py-4 rounded-lg font-bold text-xl shadow-lg border-2 border-red-500 transition-all transform hover:scale-105"
            >
              💀 Commencer le Boss Rush
            </button>
          </div>
        )}

        {/* COMBAT / TRANSITION / VICTORY / DEFEAT */}
        {gameState !== 'lobby' && (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Carte joueur */}
            <div className="flex-shrink-0">
              {character && (
                <CharacterCardContent
                  character={character}
                  showHpBar={true}
                  currentHP={playerHP}
                  maxHP={playerMaxHP}
                  shield={playerShield}
                  combatBaseOverride={playerCombatBase}
                  combatModifiers={playerCombatModifiers}
                  combatStatus={playerCombatStatus}
                />
              )}
              {carriedHP !== null && gameState === 'transition' && (
                <div className="text-center mt-2 text-amber-300 text-sm font-bold">
                  PV restants: {carriedHP}/{playerMaxHP}
                </div>
              )}
            </div>

            {/* Log de combat */}
            <div className="flex-1 min-w-0">
              <div
                ref={logContainerRef}
                className="bg-stone-900/80 border border-stone-600 rounded-lg p-3 h-[400px] overflow-y-auto text-xs space-y-1"
              >
                {combatLog.map((log, i) => (
                  <div key={i} className={`${
                    log.includes('CRITIQUE') ? 'text-red-400 font-bold' :
                    log.includes('🏆') ? 'text-amber-400 font-bold' :
                    log.includes('[P1]') ? 'text-blue-300' :
                    log.includes('[P2]') ? 'text-red-300' :
                    'text-stone-400'
                  }`}>
                    {log}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>

              {/* Boutons de transition */}
              {gameState === 'transition' && !isSimulating && (
                <div className="text-center mt-4">
                  <div className="text-green-400 font-bold mb-2">
                    ✅ {currentBoss.nom} vaincu ! Prochain boss: {bosses[currentBossIndex + 1]?.nom}
                  </div>
                  <button
                    onClick={proceedToNextBoss}
                    className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg border-2 border-amber-400 transition-all"
                  >
                    ⚔️ Boss suivant ({currentBossIndex + 2}/{BOSS_RUSH_COUNT})
                  </button>
                </div>
              )}

              {gameState === 'victory' && (
                <div className="text-center mt-4 space-y-3">
                  <div className="bg-gradient-to-r from-amber-900/50 to-yellow-900/50 border-2 border-amber-500 rounded-xl p-6">
                    <div className="text-4xl mb-2">🏆</div>
                    <div className="text-2xl font-bold text-amber-400">Boss Rush Complété !</div>
                    <p className="text-amber-200 mt-2">Vous avez vaincu les 6 boss d'affilée !</p>
                    {rewardGiven && (
                      <div className="mt-3 text-green-300 font-bold">
                        🎁 +10 essais de donjon obtenus !
                      </div>
                    )}
                    {newTitles.length > 0 && (
                      <div className="mt-2 text-purple-300 font-bold">
                        🏅 Nouveau titre débloqué !
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setGameState('lobby')}
                    className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg font-bold border border-stone-500"
                  >
                    Retour au lobby
                  </button>
                </div>
              )}

              {gameState === 'defeat' && (
                <div className="text-center mt-4 space-y-3">
                  <div className="bg-red-900/30 border-2 border-red-600 rounded-xl p-6">
                    <div className="text-4xl mb-2">💀</div>
                    <div className="text-2xl font-bold text-red-400">Défaite...</div>
                    <p className="text-red-200 mt-2">
                      Tombé face à {currentBoss.nom} ({currentBossIndex + 1}/{BOSS_RUSH_COUNT})
                    </p>
                  </div>
                  <button
                    onClick={startBossRush}
                    className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg border-2 border-red-500 transition-all"
                  >
                    🔄 Recommencer
                  </button>
                </div>
              )}
            </div>

            {/* Carte boss */}
            <div className="flex-shrink-0">
              {currentBoss && (
                <UnifiedCharacterCard
                  header={`Boss ${currentBossIndex + 1}/${BOSS_RUSH_COUNT}`}
                  name={currentBoss.nom}
                  fallback={<div className="h-48 w-full flex items-center justify-center"><span className="text-7xl">{currentBoss.icon}</span></div>}
                  hpText={bossMaxHP ? `${currentBoss.nom} — PV ${Math.max(0, bossHP)}/${bossMaxHP}` : undefined}
                  hpPercent={bossMaxHP ? Math.max(0, (bossHP / bossMaxHP) * 100) : undefined}
                  hpClass={bossHP > bossMaxHP * 0.5 ? 'bg-green-500' : bossHP > bossMaxHP * 0.25 ? 'bg-yellow-500' : 'bg-red-500'}
                  shieldPercent={bossMaxHP ? Math.min(100, ((bossShield || 0) / bossMaxHP) * 100) : 0}
                  mainStats={
                    bossCombatBase ? (
                      <>
                        <div>Auto : <span className="text-white font-bold">{bossCombatBase.auto}</span></div>
                        <div>Déf : <span className="text-white font-bold">{bossCombatBase.def}</span></div>
                        <div>Cap : <span className="text-white font-bold">{bossCombatBase.cap}</span></div>
                        <div>ResC : <span className="text-white font-bold">{bossCombatBase.rescap}</span></div>
                      </>
                    ) : (
                      <>
                        <div>Auto : <span className="text-white font-bold">{currentBoss.stats.auto}</span></div>
                        <div>Déf : <span className="text-white font-bold">{currentBoss.stats.def}</span></div>
                        <div>Cap : <span className="text-white font-bold">{currentBoss.stats.cap}</span></div>
                        <div>ResC : <span className="text-white font-bold">{currentBoss.stats.rescap}</span></div>
                      </>
                    )
                  }
                  topStats={
                    <>
                      <span className="text-white font-bold">HP {currentBoss.stats.hp}</span>
                      <span className="text-white font-bold">VIT {bossCombatBase?.spd ?? currentBoss.stats.spd}</span>
                    </>
                  }
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BossRush;
