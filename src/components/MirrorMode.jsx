import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter } from '../services/characterService';
import { grantRunsToPlayer } from '../services/dungeonService';
import { checkAndAwardTitles } from '../services/titleService';
import { simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import UnifiedCharacterCard from './UnifiedCharacterCard';
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
        const char = await getUserCharacter(currentUser.uid);
        if (!char) { navigate('/'); return; }
        setCharacter(char);

        const progressRef = doc(db, 'dungeonProgress', currentUser.uid);
        const progressSnap = await getDoc(progressRef);
        if (progressSnap.exists()) {
          const data = progressSnap.data();
          if (data.lastMirrorDate && isSameDay(data.lastMirrorDate.toDate(), new Date())) {
            setAlreadyDone(true);
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
    setPlayerShield(0);
    setCloneShield(0);
    setRewardGiven(false);

    const clone = buildMirrorClone(character);
    const result = simulerMatch(character, clone);

    setPlayerMaxHP(result.p1MaxHP);
    setCloneMaxHP(result.p2MaxHP);
    setPlayerHP(result.p1MaxHP);
    setCloneHP(result.p2MaxHP);

    await replayCombatSteps(result.steps, {
      onStep: (step) => {
        setPlayerHP(step.p1HP);
        setCloneHP(step.p2HP);
        setPlayerShield(step.p1Shield || 0);
        setCloneShield(step.p2Shield || 0);
        setPlayerCombatBase(step.p1Base || null);
        setCloneCombatBase(step.p2Base || null);
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

    await checkAndAwardTitles(
      currentUser.uid, result.steps, result, character,
      { mode: 'mirror' }
    );

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

  const mirrorCloneForDisplay = character ? buildMirrorClone(character) : null;

  return (
    <div className="min-h-screen p-4">
      <Header />

      <div className="max-w-6xl mx-auto pt-20">
        {/* Titre */}
        <div className="text-center mb-6">
          <div className="bg-stone-900/70 border-2 border-stone-500 rounded-xl px-6 py-3 shadow-xl inline-block">
            <h2 className="text-3xl font-bold text-stone-300">🪞 Mode Miroir</h2>
            <p className="text-stone-400 text-sm mt-1">Affrontez votre clone aux stats inversées. 1 fois par jour.</p>
          </div>
        </div>

        {/* LOBBY */}
        {gameState === 'lobby' && (
          <div>
            <div className="flex flex-col md:flex-row gap-6 items-start justify-center mb-6">
              {/* Carte joueur */}
              <div className="flex-shrink-0">
                {character && <CharacterCardContent character={character} />}
                <div className="text-center mt-2 text-xs text-stone-400">Vous</div>
              </div>

              <div className="flex items-center justify-center text-4xl text-stone-500 font-bold self-center">
                ⚔️
              </div>

              {/* Carte clone (avec brume) */}
              <div className="flex-shrink-0">
                {mirrorCloneForDisplay && (
                  <UnifiedCharacterCard
                    header={`${character.race} • ${character.class} • Miroir`}
                    name={mirrorCloneForDisplay.name}
                    image={character.characterImage}
                    fallback={<div className="h-48 w-full flex items-center justify-center"><span className="text-7xl opacity-20">🪞</span></div>}
                    imageOverlayContent={<div className="mirror-fog-overlay" />}
                    topStats={
                      <>
                        <span className="text-white font-bold">HP {mirrorCloneForDisplay.base.hp}</span>
                        <span className="text-white font-bold">VIT {mirrorCloneForDisplay.base.spd}</span>
                      </>
                    }
                    mainStats={
                      <>
                        <div>Auto : <span className="text-white font-bold">{mirrorCloneForDisplay.base.auto}</span></div>
                        <div>Déf : <span className="text-white font-bold">{mirrorCloneForDisplay.base.def}</span></div>
                        <div>Cap : <span className="text-white font-bold">{mirrorCloneForDisplay.base.cap}</span></div>
                        <div>ResC : <span className="text-white font-bold">{mirrorCloneForDisplay.base.rescap}</span></div>
                      </>
                    }
                  />
                )}
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
        )}

        {/* COMBAT */}
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

              {gameState === 'victory' && !isSimulating && (
                <div className="text-center mt-4">
                  <div className="bg-green-900/30 border-2 border-green-600 rounded-xl p-6">
                    <div className="text-3xl mb-2">🏆</div>
                    <div className="text-xl font-bold text-green-400">Victoire contre votre Miroir !</div>
                    {rewardGiven && (
                      <div className="mt-2 text-green-300 font-bold">🎁 +2 essais de donjon</div>
                    )}
                  </div>
                  <button
                    onClick={() => navigate('/')}
                    className="mt-3 bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg font-bold border border-stone-500"
                  >
                    Retour
                  </button>
                </div>
              )}

              {gameState === 'defeat' && !isSimulating && (
                <div className="text-center mt-4">
                  <div className="bg-red-900/30 border-2 border-red-600 rounded-xl p-6">
                    <div className="text-3xl mb-2">💀</div>
                    <div className="text-xl font-bold text-red-400">Défaite face à votre Miroir</div>
                    <p className="text-red-200 text-sm mt-1">Pas de récompense aujourd'hui.</p>
                  </div>
                  <button
                    onClick={() => setGameState('lobby')}
                    className="mt-3 bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg font-bold border border-stone-500"
                  >
                    Retour
                  </button>
                </div>
              )}
            </div>

            {/* Carte clone */}
            <div className="flex-shrink-0">
              <UnifiedCharacterCard
                header={`${character?.race} • ${character?.class} • Miroir`}
                name={mirrorCloneForDisplay?.name || 'Clone'}
                image={character?.characterImage}
                fallback={<div className="h-48 w-full flex items-center justify-center"><span className="text-7xl opacity-20">🪞</span></div>}
                imageOverlayContent={<div className="mirror-fog-overlay" />}
                hpText={cloneMaxHP ? `Clone — PV ${Math.max(0, cloneHP)}/${cloneMaxHP}` : undefined}
                hpPercent={cloneMaxHP ? Math.max(0, (cloneHP / cloneMaxHP) * 100) : undefined}
                hpClass={cloneHP > cloneMaxHP * 0.5 ? 'bg-green-500' : cloneHP > cloneMaxHP * 0.25 ? 'bg-yellow-500' : 'bg-red-500'}
                shieldPercent={cloneMaxHP ? Math.min(100, ((cloneShield || 0) / cloneMaxHP) * 100) : 0}
                mainStats={
                  cloneCombatBase ? (
                    <>
                      <div>Auto : <span className="text-white font-bold">{cloneCombatBase.auto}</span></div>
                      <div>Déf : <span className="text-white font-bold">{cloneCombatBase.def}</span></div>
                      <div>Cap : <span className="text-white font-bold">{cloneCombatBase.cap}</span></div>
                      <div>ResC : <span className="text-white font-bold">{cloneCombatBase.rescap}</span></div>
                    </>
                  ) : (
                    <>
                      <div>Auto : <span className="text-white font-bold">{mirrorCloneForDisplay?.base?.auto}</span></div>
                      <div>Déf : <span className="text-white font-bold">{mirrorCloneForDisplay?.base?.def}</span></div>
                      <div>Cap : <span className="text-white font-bold">{mirrorCloneForDisplay?.base?.cap}</span></div>
                      <div>ResC : <span className="text-white font-bold">{mirrorCloneForDisplay?.base?.rescap}</span></div>
                    </>
                  )
                }
                topStats={
                  <>
                    <span className="text-white font-bold">HP {mirrorCloneForDisplay?.base?.hp}</span>
                    <span className="text-white font-bold">VIT {cloneCombatBase?.spd ?? mirrorCloneForDisplay?.base?.spd}</span>
                  </>
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MirrorMode;
