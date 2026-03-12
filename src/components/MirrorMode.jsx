import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter } from '../services/characterService';
import { grantRunsToPlayer, getPlayerDungeonSummary } from '../services/dungeonService';
import { getWeaponUpgrade } from '../services/forgeService';
import { checkAndAwardTitles } from '../services/titleService';
import { simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

function buildMirrorClone(character) {
  const clone = JSON.parse(JSON.stringify(character));
  clone.base = {
    ...clone.base,
    auto: character.base.def,
    def: character.base.auto,
    cap: character.base.rescap,
    rescap: character.base.cap,
  };
  if (clone.forestBoosts) {
    const fb = { ...clone.forestBoosts };
    const tmpAuto = fb.auto || 0;
    const tmpDef = fb.def || 0;
    const tmpCap = fb.cap || 0;
    const tmpRescap = fb.rescap || 0;
    fb.auto = tmpDef;
    fb.def = tmpAuto;
    fb.cap = tmpRescap;
    fb.rescap = tmpCap;
    clone.forestBoosts = fb;
  }
  const reversed = character.name.split('').reverse().join('');
  clone.name = reversed.charAt(0).toUpperCase() + reversed.slice(1).toLowerCase();
  clone.userId = 'mirror_clone';
  return clone;
}

function isSameDay(ts1, ts2) {
  if (!ts1 || !ts2) return false;
  const d1 = ts1 instanceof Date ? ts1 : ts1.toDate();
  const d2 = ts2 instanceof Date ? ts2 : ts2.toDate();
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

const MirrorMode = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [gameState, setGameState] = useState('lobby');
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [playerHP, setPlayerHP] = useState(null);
  const [playerMaxHP, setPlayerMaxHP] = useState(null);
  const [cloneHP, setCloneHP] = useState(null);
  const [cloneMaxHP, setCloneMaxHP] = useState(null);
  const [playerShield, setPlayerShield] = useState(0);
  const [cloneShield, setCloneShield] = useState(0);
  const [playerCombatBase, setPlayerCombatBase] = useState(null);
  const [cloneCombatBase, setCloneCombatBase] = useState(null);
  const [playerCombatModifiers, setPlayerCombatModifiers] = useState(null);
  const [playerCombatStatus, setPlayerCombatStatus] = useState(null);
  const [cloneCombatModifiers, setCloneCombatModifiers] = useState(null);
  const [cloneCombatStatus, setCloneCombatStatus] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [rewardGiven, setRewardGiven] = useState(false);
  const [error, setError] = useState(null);
  const logEndRef = useRef(null);
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const charResult = await getUserCharacter(currentUser.uid);
        if (!charResult.success || !charResult.data) { navigate('/'); return; }
        const charData = { ...charResult.data, level: charResult.data.level ?? 1 };

        const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
        if (summaryResult.success && summaryResult.data?.equippedWeaponData) {
          charData.equippedWeaponData = summaryResult.data.equippedWeaponData;
          charData.equippedWeaponId = summaryResult.data.equippedWeaponData.id || null;
        }
        const upgradeResult = await getWeaponUpgrade(currentUser.uid);
        if (upgradeResult.success && upgradeResult.data) {
          charData.forgeUpgrade = upgradeResult.data;
        }

        setCharacter(charData);

        const progressRef = doc(db, 'dungeonProgress', currentUser.uid);
        const progressSnap = await getDoc(progressRef);
        if (progressSnap.exists()) {
          const data = progressSnap.data();
          if (data.lastMirrorDate) {
            const lastDate = typeof data.lastMirrorDate.toDate === 'function'
              ? data.lastMirrorDate.toDate()
              : new Date(data.lastMirrorDate);
            if (isSameDay(lastDate, new Date())) {
              setAlreadyDone(true);
            }
          }
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

  const startMirrorFight = async () => {
    setGameState('fighting');
    setIsSimulating(true);
    setCombatLog([]);
    setCombatResult(null);
    setPlayerCombatBase(null);
    setCloneCombatBase(null);
    setPlayerCombatModifiers(null);
    setPlayerCombatStatus(null);
    setCloneCombatModifiers(null);
    setCloneCombatStatus(null);
    setPlayerShield(0);
    setCloneShield(0);
    setRewardGiven(false);

    try {
      const clone = buildMirrorClone(character);
      const result = simulerMatch(character, clone);

      setPlayerMaxHP(result.p1MaxHP);
      setCloneMaxHP(result.p2MaxHP);
      setPlayerHP(result.p1MaxHP);
      setCloneHP(result.p2MaxHP);

      await replayCombatSteps(result.steps, {
        setCombatLog,
        onStepHP: (step) => {
          setPlayerHP(step.p1HP);
          setCloneHP(step.p2HP);
          setPlayerShield(step.p1Shield || 0);
          setCloneShield(step.p2Shield || 0);
          setPlayerCombatBase(step.p1Base || null);
          setCloneCombatBase(step.p2Base || null);
          setPlayerCombatModifiers(step.p1Modifiers || null);
          setPlayerCombatStatus(step.p1Status || null);
          setCloneCombatModifiers(step.p2Modifiers || null);
          setCloneCombatStatus(step.p2Status || null);
        },
        speed: 'normal',
      });

      const lastStep = result.steps[result.steps.length - 1];
      const isWin = lastStep ? lastStep.p1HP > 0 : false;
      setCombatResult({ ...result, isWin });
      setIsSimulating(false);

      checkAndAwardTitles(
        currentUser.uid, result.steps, result, character,
        { mode: 'mirror' }
      ).catch(() => {});

      if (isWin) {
        setGameState('victory');
        await grantRunsToPlayer(currentUser.uid, 2);
        await setDoc(doc(db, 'dungeonProgress', currentUser.uid), {
          lastMirrorDate: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }, { merge: true });
        setAlreadyDone(true);
        setRewardGiven(true);
      } else {
        setGameState('defeat');
      }
    } catch (err) {
      console.error('Erreur combat miroir:', err);
      setIsSimulating(false);
      setError('Erreur lors du combat: ' + err.message);
      setGameState('lobby');
    }
  };

  const mirrorCloneForDisplay = character ? buildMirrorClone(character) : null;

  const formatLogMessage = (text) => {
    if (!character || !mirrorCloneForDisplay) return text;
    const pName = character.name;
    const bName = mirrorCloneForDisplay.name;
    const parts = [];
    let key = 0;
    const nameRegex = new RegExp(`(${pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
    const nameParts = text.split(nameRegex);
    nameParts.forEach((part) => {
      if (part === pName) {
        parts.push(<span key={`n-${key++}`} className="font-bold text-blue-400">{part}</span>);
      } else if (part === bName) {
        parts.push(<span key={`n-${key++}`} className="font-bold text-stone-300">{part}</span>);
      } else if (part) {
        parts.push(<span key={`n-${key++}`}>{part}</span>);
      }
    });
    return parts.length > 0 ? parts : text;
  };

  const CloneCard = ({ showHp = false, detailsPlacement = null }) => {
    if (!mirrorCloneForDisplay) return null;
    return (
      <CharacterCardContent
        character={mirrorCloneForDisplay}
        nameOverride={mirrorCloneForDisplay.name}
        showHpBar={showHp}
        currentHP={cloneHP}
        maxHP={cloneMaxHP}
        shield={cloneShield}
        combatBaseOverride={showHp ? cloneCombatBase : null}
        combatModifiers={showHp ? cloneCombatModifiers : null}
        opponent={showHp ? character : null}
        combatStatus={showHp ? cloneCombatStatus : null}
        cardClassName="border-2 border-stone-500/50"
        imageClassName="scale-x-[-1]"
        imageOverlayContent={<div className="mirror-fog-overlay" />}
        detailsPlacement={detailsPlacement}
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-stone-400 text-2xl animate-pulse">Chargement du Miroir...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <Header />
        <div className="text-red-400 text-xl">{error}</div>
        <button onClick={() => { setError(null); setGameState('lobby'); }} className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg font-bold border border-stone-500">
          Retour
        </button>
      </div>
    );
  }

  // LOBBY
  if (gameState === 'lobby') {
    return (
      <div className="min-h-screen p-4">
        <Header />
        <div className="max-w-6xl mx-auto pt-20">
          <div className="text-center mb-6">
            <div className="bg-stone-900 border-2 border-stone-500 rounded-xl px-6 py-3 shadow-xl inline-block">
              <h2 className="text-3xl font-bold text-stone-300">🪞 Mode Miroir</h2>
              <p className="text-stone-400 text-sm mt-1">Affrontez votre clone aux stats inversées. 1 fois par jour.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start justify-center mb-6">
            <div className="w-full md:w-[340px] md:flex-shrink-0">
              {character && <CharacterCardContent character={character} />}
              <div className="text-center mt-2 text-xs text-stone-400">Vous</div>
            </div>

            <div className="flex items-center justify-center text-4xl text-stone-500 font-bold self-center">
              ⚔️
            </div>

            <div className="w-full md:w-[340px] md:flex-shrink-0">
              <CloneCard />
              <div className="text-center mt-2 text-xs text-stone-400">Doppelgänger</div>
            </div>
          </div>

          <div className="text-center">
            {alreadyDone ? (
              <div className="bg-stone-800/80 border border-stone-600 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-stone-400">🪞 Miroir déjà affronté aujourd'hui. Revenez demain !</p>
              </div>
            ) : (
              <button
                onClick={startMirrorFight}
                className="bg-gradient-to-r from-stone-600 to-stone-800 hover:from-stone-500 hover:to-stone-700 text-white px-10 py-4 rounded-lg font-bold text-xl shadow-lg border-2 border-stone-400 transition-all transform hover:scale-105"
              >
                🪞 Affronter mon Miroir
              </button>
            )}
            <p className="text-stone-500 text-xs mt-3">Récompense : +2 essais de donjon</p>
          </div>
        </div>
      </div>
    );
  }

  // COMBAT / VICTORY / DEFEAT
  return (
    <div className="min-h-screen p-4">
      <Header />
      <div className="max-w-[1800px] mx-auto pt-20">
        {/* Bandeaux de résultat */}
        {combatResult?.isWin && !isSimulating && (
          <div className="flex justify-center mb-4">
            <div className="bg-stone-100 text-stone-900 px-8 py-3 rounded-lg font-bold text-xl shadow-2xl border-2 border-stone-400">
              🏆 {character.name} remporte le combat !
            </div>
          </div>
        )}
        {combatResult && !combatResult.isWin && !isSimulating && (
          <div className="flex justify-center mb-4">
            <div className="bg-red-900/80 text-red-200 px-8 py-3 rounded-xl font-bold text-xl shadow-2xl border border-red-600">
              💀 {character.name} a été vaincu... 💀
            </div>
          </div>
        )}

        {/* Layout principal: Joueur | Chat | Clone */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
          {/* Carte joueur - Gauche */}
          <div className="order-1 md:order-1 w-full md:w-[340px] lg:w-auto md:flex-shrink-0">
            {character && (
              <CharacterCardContent
                character={character}
                showHpBar
                currentHP={playerHP}
                maxHP={playerMaxHP}
                shield={playerShield}
                combatBaseOverride={playerCombatBase}
                combatModifiers={playerCombatModifiers}
                opponent={mirrorCloneForDisplay}
                combatStatus={playerCombatStatus}
                detailsPlacement="left"
              />
            )}
          </div>

          {/* Zone centrale - Chat */}
          <div className="order-2 md:order-2 w-full md:flex-1 md:min-w-[400px] flex flex-col">
            <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col h-[480px] md:h-[600px]">
              <div className="bg-stone-900/90 p-3 border-b border-stone-500/50 rounded-t-xl">
                <h2 className="text-lg md:text-xl font-bold text-stone-300 text-center">🪞 Combat Miroir</h2>
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
                        if (log.includes('🏆')) {
                          return (
                            <div key={idx} className="flex justify-center my-4">
                              <div className="bg-stone-100 text-stone-900 px-6 py-3 rounded-lg font-bold text-lg shadow-lg border border-stone-400">
                                {cleanLog}
                              </div>
                            </div>
                          );
                        }
                        if (log.includes('💀')) {
                          return (
                            <div key={idx} className="flex justify-center my-4">
                              <div className="bg-red-900/80 text-red-200 px-6 py-3 rounded-lg font-bold text-lg shadow-lg border border-red-600">
                                {cleanLog}
                              </div>
                            </div>
                          );
                        }
                        if (log.includes('---') || log.includes('⚔️')) {
                          return (
                            <div key={idx} className="flex justify-center my-3">
                              <div className="bg-stone-700/80 text-stone-200 px-4 py-1 rounded-lg text-sm font-bold border border-stone-500">
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
                              <div className="bg-stone-700/80 text-stone-200 px-3 py-2 md:px-4 rounded-lg shadow-lg border-l-4 border-blue-500">
                                <div className="text-xs md:text-sm">{formatLogMessage(cleanLog)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (isP2) {
                        return (
                          <div key={idx} className="flex justify-end">
                            <div className="max-w-[80%]">
                              <div className="bg-stone-700/80 text-stone-200 px-3 py-2 md:px-4 rounded-lg shadow-lg border-r-4 border-stone-400">
                                <div className="text-xs md:text-sm">{formatLogMessage(cleanLog)}</div>
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

            {/* Résultat */}
            {gameState === 'victory' && !isSimulating && (
              <div className="text-center mt-4 space-y-3">
                <div className="bg-green-900 border-2 border-green-600 rounded-xl p-6">
                  <div className="text-3xl mb-2">🏆</div>
                  <div className="text-xl font-bold text-green-400">Victoire contre votre Doppelgänger !</div>
                  {rewardGiven && (
                    <div className="mt-2 text-green-300 font-bold">🎁 +2 essais de donjon</div>
                  )}
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg font-bold border border-stone-500"
                >
                  Retour
                </button>
              </div>
            )}

            {gameState === 'defeat' && !isSimulating && (
              <div className="text-center mt-4 space-y-3">
                <div className="bg-red-900 border-2 border-red-600 rounded-xl p-6">
                  <div className="text-3xl mb-2">💀</div>
                  <div className="text-xl font-bold text-red-400">Défaite face à votre Doppelgänger</div>
                  <p className="text-red-200 text-sm mt-1">Pas de récompense aujourd'hui.</p>
                </div>
                <button
                  onClick={() => setGameState('lobby')}
                  className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg font-bold border border-stone-500"
                >
                  Retour
                </button>
              </div>
            )}
          </div>

          {/* Carte clone - Droite */}
          <div className="order-3 md:order-3 w-full md:w-[340px] lg:w-auto md:flex-shrink-0">
            <CloneCard showHp detailsPlacement="right" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MirrorMode;
