import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter, saveAccountTitles } from '../services/characterService';
import { grantRunsToPlayer, getPlayerDungeonSummary } from '../services/dungeonService';
import { getWeaponUpgrade } from '../services/forgeService';
import { checkAndAwardTitles } from '../services/titleService';
import { getBossRushBosses, createBossRushCombatant, BOSS_RUSH_COUNT } from '../data/bossRush';
import { simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { MiniCard } from './CombatLayout';
import UnifiedCharacterCard from './UnifiedCharacterCard';
import { syncUnlockedBorders } from '../data/borders';
import { doc, getDoc, setDoc, Timestamp, increment } from 'firebase/firestore';
import { db } from '../firebase/config';

const bossImageModules = import.meta.glob('../assets/bosses/*.png', { eager: true, import: 'default' });
const forgeImageModules = import.meta.glob('../assets/forge/*.png', { eager: true, import: 'default' });
const extensionImageModules = import.meta.glob('../assets/extension/*.png', { eager: true, import: 'default' });
const subclassImageModules = import.meta.glob('../assets/subclass/*.png', { eager: true, import: 'default' });

const IMAGE_SOURCES = {
  bosses: (f) => bossImageModules[`../assets/bosses/${f}`] || null,
  forge: (f) => forgeImageModules[`../assets/forge/${f}`] || null,
  extension: (f) => extensionImageModules[`../assets/extension/${f}`] || null,
  subclass: (f) => subclassImageModules[`../assets/subclass/${f}`] || null,
};

const getBossImage = (imageFile, imageSource) => {
  if (!imageFile || !imageSource) return null;
  const resolver = IMAGE_SOURCES[imageSource];
  return resolver ? resolver(imageFile) : null;
};

const BossRush = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [gameState, setGameState] = useState('lobby');
  const [currentBossIndex, setCurrentBossIndex] = useState(0);
  const [player, setPlayer] = useState(null);
  const [boss, setBoss] = useState(null);
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
  const [bossRushCompletions, setBossRushCompletions] = useState(0);
  const [rewardGiven, setRewardGiven] = useState(false);
  const [newTitles, setNewTitles] = useState([]);
  const minHPPercentRef = useRef(100);
  const [error, setError] = useState(null);
  const logEndRef = useRef(null);
  const logContainerRef = useRef(null);

  const bosses = getBossRushBosses();

  useEffect(() => {
    const el = document.getElementById('bossrush-music');
    if (el && el.paused) el.play().catch(() => {});
    return () => {
      if (el) { el.pause(); el.currentTime = 0; }
    };
  }, []);

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
          const data = progressSnap.data() || {};
          const completed = !!data.bossRushCompleted;
          setBossRushCompleted(completed);
          const completions = Number.isFinite(data.bossRushCompletions)
            ? data.bossRushCompletions
            : (completed ? 1 : 0);
          setBossRushCompletions(completions);
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
    minHPPercentRef.current = 100;
    setPlayer(null);
    setBoss(null);
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

    try {
      const bossData = createBossRushCombatant(bossIdx);

      const playerData = { ...character };
      if (previousHP !== null) {
        playerData._bossRushStartHP = previousHP;
      }

      const result = simulerMatch(playerData, bossData);

      setPlayer({ name: character.name });
      setBoss({ ...bossData, imageFile: bosses[bossIdx].imageFile, imageSource: bosses[bossIdx].imageSource });
      setPlayerMaxHP(result.p1MaxHP);
      setBossMaxHP(result.p2MaxHP);
      setPlayerHP(result.p1MaxHP);
      setBossHP(result.p2MaxHP);

      await replayCombatSteps(result.steps, {
        setCombatLog,
        onStepHP: (step) => {
          setPlayerHP(step.p1HP);
          setBossHP(step.p2HP);
          setPlayerShield(step.p1Shield || 0);
          setBossShield(step.p2Shield || 0);
          setPlayerCombatBase(step.p1Base || null);
          setBossCombatBase(step.p2Base || null);
          setPlayerCombatModifiers(step.p1Modifiers || null);
          setPlayerCombatStatus(step.p1Status || null);
        },
        speed: 'fast',
      });

      const lastStep = result.steps[result.steps.length - 1];
      const isWin = lastStep ? lastStep.p1HP > 0 : false;
      setCombatResult({ ...result, isWin });
      setIsSimulating(false);

      // Tracker le HP min pour le titre boss_rush_parfait
      for (const step of result.steps) {
        if (step.p1HP !== undefined && result.p1MaxHP > 0) {
          const pct = (step.p1HP / result.p1MaxHP) * 100;
          if (pct < minHPPercentRef.current) minHPPercentRef.current = pct;
        }
      }

      const isFinalBoss = bossIdx === BOSS_RUSH_COUNT - 1;
      checkAndAwardTitles(
        currentUser.uid, result.steps, result, character,
        { mode: 'boss-rush', bossId: bosses[bossIdx].id, isFinalBoss: isFinalBoss && isWin }
      ).then(titles => {
        if (titles.length > 0) setNewTitles(prev => [...prev, ...titles]);
      }).catch(() => {});

      if (isWin) {
        const finalHP = result.steps[result.steps.length - 1]?.p1HP ?? 0;
        setCarriedHP(finalHP);

        if (isFinalBoss) {
          setGameState('victory');
          const firstCompletion = !bossRushCompleted;

          // On compte les complétions (pour déblocages à seuils, ex: 5 boss rush).
          const progressRef = doc(db, 'dungeonProgress', currentUser.uid);
          const progressSnap = await getDoc(progressRef);
          const prevCompletions = progressSnap.exists()
            ? (Number.isFinite(progressSnap.data()?.bossRushCompletions)
              ? progressSnap.data().bossRushCompletions
              : (progressSnap.data()?.bossRushCompleted ? 1 : 0))
            : 0;
          const newCompletions = prevCompletions + 1;

          if (firstCompletion) {
            await grantRunsToPlayer(currentUser.uid, 10);
            setRewardGiven(true);
          }

          await setDoc(progressRef, {
            bossRushCompleted: true,
            bossRushCompletions: newCompletions,
            updatedAt: Timestamp.now(),
          }, { merge: true });

          // Persistance compte: conserve la progression boss rush même si dungeonProgress est reset.
          await setDoc(doc(db, 'tournamentRewards', currentUser.uid), {
            bossRushCompletions: increment(1),
            updatedAt: Timestamp.now(),
          }, { merge: true });

          setBossRushCompleted(true);
          setBossRushCompletions(newCompletions);

          // Titre boss_rush_parfait : jamais descendu sous 30% PV
          if (minHPPercentRef.current >= 30) {
            (async () => {
              try {
                const charSnap = await getDoc(doc(db, 'characters', currentUser.uid));
                const earned = charSnap.data()?.earnedTitles || [];
                if (!earned.includes('boss_rush_parfait')) {
                  const updatedEarned = [...earned, 'boss_rush_parfait'];
                  await setDoc(doc(db, 'characters', currentUser.uid), {
                    earnedTitles: updatedEarned,
                    updatedAt: Timestamp.now(),
                  }, { merge: true });
                  saveAccountTitles(currentUser.uid, updatedEarned, charSnap.data()?.equippedTitle);
                  setNewTitles(prev => [...prev, 'boss_rush_parfait']);
                }
              } catch (_) { /* silencieux */ }
            })();
          }
          syncUnlockedBorders(currentUser.uid, character, {
            bossRushCompleted: true,
            bossRushCompletions: newCompletions,
          }).catch(() => {});
        } else {
          setGameState('transition');
        }
      } else {
        setGameState('defeat');
      }
    } catch (err) {
      console.error('Erreur combat Boss Rush:', err);
      setIsSimulating(false);
      setError('Erreur lors du combat: ' + err.message);
      setGameState('lobby');
    }
  };

  const proceedToNextBoss = () => {
    if (!combatResult?.isWin || isSimulating) return;
    const nextIdx = currentBossIndex + 1;
    if (nextIdx >= BOSS_RUSH_COUNT) return;
    setCurrentBossIndex(nextIdx);
    setGameState('fighting');
    startFight(nextIdx, carriedHP);
  };

  const formatLogMessage = (text) => {
    if (!player || !boss) return text;
    const pName = player.name;
    const bName = boss.name;
    const parts = [];
    let key = 0;
    const nameRegex = new RegExp(`(${pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
    const nameParts = text.split(nameRegex);
    nameParts.forEach((part) => {
      if (part === pName) {
        parts.push(<span key={`n-${key++}`} className="font-bold text-blue-400">{part}</span>);
      } else if (part === bName) {
        parts.push(<span key={`n-${key++}`} className="font-bold text-red-400">{part}</span>);
      } else if (part) {
        parts.push(<span key={`n-${key++}`}>{part}</span>);
      }
    });
    return parts.length > 0 ? parts : text;
  };

  const BossCard = ({ bossChar, combatBaseOverride: bossCombatBaseOverride }) => {
    if (!bossChar) return null;
    const base = bossCombatBaseOverride ?? bossChar.base;
    const safeMaxHP = bossMaxHP || bossChar.maxHP || base.hp || 1;
    const currentHP = Math.max(0, bossHP ?? safeMaxHP);
    const hpPct = Math.max(0, Math.min(100, (currentHP / safeMaxHP) * 100));
    const hpClass = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const shieldPct = safeMaxHP > 0 ? Math.min(100, ((bossShield || 0) / safeMaxHP) * 100) : 0;
    const bossImg = getBossImage(bossChar.imageFile, bossChar.imageSource);
    const bossInfo = bosses[currentBossIndex];

    return (
      <UnifiedCharacterCard
        header={`Boss ${currentBossIndex + 1}/${BOSS_RUSH_COUNT} • Boss Rush`}
        name={bossChar.name}
        image={bossImg}
        fallback={<span className="text-7xl">{bossInfo?.icon || '👹'}</span>}
        topStats={<><span>HP: {base.hp}</span><span>VIT: {base.spd}</span></>}
        hpText={`${bossChar.name} — PV ${currentHP}/${safeMaxHP}`}
        hpPercent={hpPct}
        hpClass={hpClass}
        shieldPercent={shieldPct}
        mainStats={
          <>
            <div>Auto: {base.auto}</div>
            <div>Déf: {base.def}</div>
            <div>Cap: {base.cap}</div>
            <div>ResC: {base.rescap}</div>
          </>
        }
        details={bossChar.ability ? (
          <div className="flex items-start gap-2 bg-stone-700/50 p-2 rounded-lg text-xs border border-stone-600">
            <span className="text-lg">⚡</span>
            <div className="flex-1">
              <div className="text-red-300 font-semibold mb-1">{bossChar.ability.name || bossChar.ability.nom}</div>
              <div className="text-stone-400 text-[10px]">{bossChar.ability.description}</div>
            </div>
          </div>
        ) : null}
        cardClassName="border-2 border-red-600/50"
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <audio id="bossrush-music" loop>
          <source src="/assets/music/bossrush.mp3" type="audio/mpeg" />
        </audio>
        <div className="text-red-400 text-2xl animate-pulse">Chargement du Boss Rush...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <Header />
        <audio id="bossrush-music" loop>
          <source src="/assets/music/bossrush.mp3" type="audio/mpeg" />
        </audio>
        <div className="text-red-400 text-xl">{error}</div>
        <button onClick={() => { setError(null); setGameState('lobby'); }} className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg font-bold border border-stone-500">
          Retour
        </button>
      </div>
    );
  }

  const currentBoss = bosses[currentBossIndex];

  // LOBBY
  if (gameState === 'lobby') {
    return (
      <div className="min-h-screen p-4">
        <Header />
        <audio id="bossrush-music" loop>
          <source src="/assets/music/bossrush.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-6xl mx-auto pt-20">
          <div className="text-center mb-6">
            <div className="bg-stone-950 border-2 border-red-600 rounded-xl px-6 py-3 shadow-xl inline-block">
              <h2 className="text-3xl font-bold text-red-400">💀 Boss Rush</h2>
              <p className="text-red-300 text-sm mt-1">6 boss sans répit. Vos PV persistent entre chaque combat.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start justify-center mb-6">
            <div className="w-full md:w-auto md:flex-shrink-0">
              {character && <CharacterCardContent character={character} detailsPlacement="left" />}
              <div className="text-center mt-2 text-xs text-stone-400">Votre personnage</div>
            </div>

            <div className="flex-1 max-w-2xl">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {bosses.map((b) => {
                  const img = getBossImage(b.imageFile, b.imageSource);
                  return (
                    <div key={b.id} className="bg-stone-950 border border-stone-600 rounded-lg p-3 text-center">
                      {img ? (
                        <img src={img} alt={b.nom} className="w-16 h-16 object-contain mx-auto mb-2" />
                      ) : (
                        <div className="text-3xl mb-2">{b.icon}</div>
                      )}
                      <div className="text-sm font-bold text-stone-200">{b.nom}</div>
                      <div className="text-[10px] text-stone-400 mt-1">HP {b.stats.hp} • Stats ~{b.stats.auto}</div>
                    </div>
                  );
                })}
              </div>

              {bossRushCompleted && (
                <div className="bg-green-950 border border-green-600 rounded-lg p-3 mb-4 text-green-300 text-sm text-center">
                  ✅ Boss Rush déjà complété ! ({bossRushCompletions} complétions)
                  <br />
                  Vous pouvez retenter sans récompense supplémentaire.
                </div>
              )}

              <div className="text-center">
                <button
                  onClick={startBossRush}
                  className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-10 py-4 rounded-lg font-bold text-xl shadow-lg border-2 border-red-500 transition-all transform hover:scale-105"
                >
                  💀 Commencer le Boss Rush
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // COMBAT / TRANSITION / VICTORY / DEFEAT
  return (
    <div className="min-h-screen p-4">
      <Header />
      <audio id="bossrush-music" loop>
        <source src="/assets/music/bossrush.mp3" type="audio/mpeg" />
      </audio>
      <div className="max-w-[1800px] mx-auto pt-20">
        {/* Barre de progression des boss */}
        <div className="flex justify-center gap-2 mb-4">
          {bosses.map((b, i) => {
            let cls = 'bg-stone-950 border-stone-600 text-stone-500';
            if (i < currentBossIndex || gameState === 'victory') cls = 'bg-green-950 border-green-600 text-green-300';
            else if (i === currentBossIndex && (gameState === 'fighting' || gameState === 'transition')) cls = 'bg-amber-950 border-amber-500 text-amber-300';
            else if (i === currentBossIndex && gameState === 'defeat') cls = 'bg-red-950 border-red-600 text-red-300';
            return (
              <div key={b.id} className={`border rounded-lg px-3 py-2 text-center text-xs ${cls}`}>
                <div className="text-lg">{b.icon}</div>
                <div className="font-bold hidden md:block">{b.nom}</div>
              </div>
            );
          })}
        </div>

        {/* Bandeaux de résultat */}
        {combatResult?.isWin && gameState !== 'fighting' && (
          <div className="flex justify-center mb-4">
            <div className="bg-stone-100 text-stone-900 px-8 py-3 rounded-lg font-bold text-xl shadow-2xl border-2 border-stone-400">
              🏆 {character.name} remporte le combat !
            </div>
          </div>
        )}
        {combatResult && !combatResult.isWin && gameState === 'defeat' && (
          <div className="flex justify-center mb-4">
            <div className="bg-red-900/80 text-red-200 px-8 py-3 rounded-xl font-bold text-xl shadow-2xl border border-red-600">
              💀 {character.name} a été écrasé... 💀
            </div>
          </div>
        )}

        {/* ═══ MOBILE (< 1024px) : Mini-cartes + journal compact ═══ */}
        <div className="lg:hidden flex flex-col gap-2">
          <div className="flex gap-2">
            <MiniCard 
              entity={{ 
                name: character?.name, 
                currentHP: playerHP, 
                maxHP: playerMaxHP, 
                shield: playerShield ?? 0, 
                base: playerCombatBase ?? character?.base ?? {}, 
                image: character?.characterImage 
              }} 
              side="left" 
            />
            <MiniCard 
              entity={{ 
                name: boss?.name ?? currentBoss?.nom, 
                currentHP: boss?.currentHP ?? bossHP, 
                maxHP: boss?.maxHP ?? bossMaxHP ?? currentBoss?.stats?.hp, 
                shield: bossShield ?? 0, 
                base: bossCombatBase ?? boss?.base ?? currentBoss?.stats ?? {}, 
                ability: boss?.ability ?? currentBoss?.ability,
                image: getBossImage(boss?.imageFile ?? currentBoss?.imageFile, boss?.imageSource ?? currentBoss?.imageSource)
              }} 
              side="right" 
            />
          </div>
          {carriedHP !== null && gameState === 'transition' && (
            <div className="text-center text-amber-300 text-xs font-bold">
              PV restants: {carriedHP}/{playerMaxHP}
            </div>
          )}
          <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col" style={{ height: 'calc(100dvh - 320px)', minHeight: '260px', maxHeight: '400px' }}>
            <div className="bg-stone-900/90 px-3 py-2 border-b border-red-600/50 rounded-t-xl">
              <h2 className="text-sm font-bold text-red-300 text-center">💀 Boss Rush — {currentBoss?.nom}</h2>
            </div>
            <div ref={logContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
              {combatLog.length === 0 ? (
                <p className="text-stone-500 italic text-center py-4">Le combat va commencer...</p>
              ) : (
                <>
                  {combatLog.map((log, idx) => {
                    const isP1 = log.startsWith('[P1]');
                    const isP2 = log.startsWith('[P2]');
                    const cleanLog = log.replace(/^\[P[12]\]\s*/, '');
                    if (!isP1 && !isP2) {
                      if (log.includes('🏆')) return <div key={idx} className="flex justify-center my-2"><div className="bg-stone-100 text-stone-900 px-3 py-1.5 font-bold text-xs rounded-lg">{cleanLog}</div></div>;
                      if (log.includes('💀')) return <div key={idx} className="flex justify-center my-2"><div className="bg-red-900 text-red-200 px-3 py-1.5 font-bold text-xs rounded-lg">{cleanLog}</div></div>;
                      if (log.includes('---')) return <div key={idx} className="flex justify-center my-1"><div className="bg-stone-700 text-stone-200 px-2 py-0.5 text-[10px] font-bold rounded">{cleanLog}</div></div>;
                      return <div key={idx} className="text-center text-stone-400 text-[10px] italic">{cleanLog}</div>;
                    }
                    if (isP1) return <div key={idx} className="flex justify-start"><div className="max-w-[85%] bg-stone-700 text-stone-200 px-2 py-1 rounded border-l-2 border-blue-500 text-[11px]">{formatLogMessage(cleanLog)}</div></div>;
                    return <div key={idx} className="flex justify-end"><div className="max-w-[85%] bg-stone-700 text-stone-200 px-2 py-1 rounded border-r-2 border-red-500 text-[11px]">{formatLogMessage(cleanLog)}</div></div>;
                  })}
                  <div ref={logEndRef} />
                </>
              )}
            </div>
          </div>
          {/* Boutons mobile */}
          {gameState === 'transition' && !isSimulating && combatResult?.isWin && (
            <div className="text-center">
              <div className="text-green-400 font-bold text-xs mb-1">✅ {currentBoss.nom} vaincu !</div>
              <button onClick={proceedToNextBoss} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-sm">
                ⚔️ Boss suivant ({currentBossIndex + 2}/{BOSS_RUSH_COUNT})
              </button>
            </div>
          )}
          {gameState === 'victory' && (
            <div className="text-center bg-amber-900/80 border border-amber-500 rounded-xl p-3">
              <div className="text-2xl">🏆</div>
              <div className="text-amber-400 font-bold">Boss Rush Complété !</div>
              {rewardGiven && <div className="text-green-300 text-xs">🎁 +10 essais !</div>}
              <button onClick={() => setGameState('lobby')} className="mt-2 bg-stone-700 text-white px-4 py-1 rounded text-sm">Retour</button>
            </div>
          )}
          {gameState === 'defeat' && (
            <div className="text-center bg-red-950 border border-red-600 rounded-xl p-3">
              <div className="text-2xl">💀</div>
              <div className="text-red-400 font-bold">Défaite...</div>
              <button onClick={startBossRush} className="mt-2 bg-red-700 text-white px-4 py-1 rounded text-sm">🔄 Recommencer</button>
            </div>
          )}
        </div>

        {/* ═══ DESKTOP (1024px+) : Layout original avec detailsPlacement ═══ */}
        <div className="hidden lg:flex flex-col lg:flex-row gap-4 items-stretch lg:items-start justify-center text-sm">
          {/* Carte joueur - Gauche */}
          <div className="w-full lg:w-auto flex-shrink-0">
            {character && (
              <CharacterCardContent
                character={character}
                showHpBar
                currentHP={playerHP}
                maxHP={playerMaxHP}
                shield={playerShield}
                combatBaseOverride={playerCombatBase}
                combatModifiers={playerCombatModifiers}
                opponent={boss}
                combatStatus={playerCombatStatus}
                detailsPlacement="left"
              />
            )}
            {carriedHP !== null && gameState === 'transition' && (
              <div className="text-center mt-2 text-amber-300 text-sm font-bold">
                PV restants: {carriedHP}/{playerMaxHP}
              </div>
            )}
          </div>

          {/* Zone centrale - Chat */}
          <div className="w-full lg:flex-1 lg:min-w-[400px] flex flex-col">
            <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col h-[600px]">
              <div className="bg-stone-900/90 p-3 border-b border-red-600/50 rounded-t-xl">
                <h2 className="text-xl font-bold text-red-300 text-center">💀 Boss Rush — {currentBoss?.nom}</h2>
              </div>
              <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
                {combatLog.length === 0 ? (
                  <p className="text-stone-500 italic text-center py-8 text-sm">Le combat va commencer...</p>
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
                              <div className="bg-stone-700/80 text-stone-200 px-4 py-2 rounded-lg shadow-lg border-l-4 border-blue-500">
                                <div className="text-sm">{formatLogMessage(cleanLog)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (isP2) {
                        return (
                          <div key={idx} className="flex justify-end">
                            <div className="max-w-[80%]">
                              <div className="bg-stone-700/80 text-stone-200 px-4 py-2 rounded-lg shadow-lg border-r-4 border-red-500">
                                <div className="text-sm">{formatLogMessage(cleanLog)}</div>
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

            {/* Boutons de transition */}
            {gameState === 'transition' && !isSimulating && combatResult?.isWin && (
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
                <div className="bg-gradient-to-r from-amber-900 to-yellow-900 border-2 border-amber-500 rounded-xl p-6">
                  <div className="text-4xl mb-2">🏆</div>
                  <div className="text-2xl font-bold text-amber-400">Boss Rush Complété !</div>
                  <p className="text-amber-200 mt-2">Vous avez vaincu les 6 boss d'affilée !</p>
                  {rewardGiven && (
                    <div className="mt-3 text-green-300 font-bold">🎁 +10 essais de donjon obtenus !</div>
                  )}
                  {newTitles.length > 0 && (
                    <div className="mt-2 text-purple-300 font-bold">🏅 Nouveau titre débloqué !</div>
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
                <div className="bg-red-950 border-2 border-red-600 rounded-xl p-6">
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

          {/* Carte boss - Droite */}
          <div className="w-full lg:w-auto flex-shrink-0">
            {boss && <BossCard bossChar={boss} combatBaseOverride={bossCombatBase} />}
            {!boss && currentBoss && (
              <UnifiedCharacterCard
                header={`Boss ${currentBossIndex + 1}/${BOSS_RUSH_COUNT} • Boss Rush`}
                name={currentBoss.nom}
                image={getBossImage(currentBoss.imageFile, currentBoss.imageSource)}
                fallback={<span className="text-7xl">{currentBoss.icon}</span>}
                topStats={<><span>HP: {currentBoss.stats.hp}</span><span>VIT: {currentBoss.stats.spd}</span></>}
                mainStats={
                  <>
                    <div>Auto: {currentBoss.stats.auto}</div>
                    <div>Déf: {currentBoss.stats.def}</div>
                    <div>Cap: {currentBoss.stats.cap}</div>
                    <div>ResC: {currentBoss.stats.rescap}</div>
                  </>
                }
                details={currentBoss.ability ? (
                  <div className="flex items-start gap-2 bg-stone-700/50 p-2 rounded-lg text-xs border border-stone-600">
                    <span className="text-lg">⚡</span>
                    <div className="flex-1">
                      <div className="text-red-300 font-semibold mb-1">{currentBoss.ability.name || currentBoss.ability.nom}</div>
                      <div className="text-stone-400 text-[10px]">{currentBoss.ability.description}</div>
                    </div>
                  </div>
                ) : null}
                cardClassName="border-2 border-red-600/50"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BossRush;
