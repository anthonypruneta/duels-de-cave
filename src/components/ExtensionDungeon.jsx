import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserCharacter,
  updateCharacterMageTowerExtensionPassive,
} from '../services/characterService';
import { getPlayerDungeonSummary, startDungeonRun } from '../services/dungeonService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getRaceBonusText } from '../utils/descriptionBuilders';
import {
  classConstants,
  raceConstants,
  getRaceBonus,
  getClassBonus
} from '../data/combatMechanics';
import { applyAwakeningToBase, buildAwakeningState, getAwakeningEffect, removeBaseRaceFlatBonusesIfAwakened } from '../utils/awakening';
import { getWeaponById } from '../data/weapons';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import {
  applyPassiveWeaponStats,
  initWeaponCombatState,
} from '../utils/weaponEffects';
import {
  EXTENSION_BOSS,
  createExtensionBossCombatant,
  rollExtensionPassive,
  getMixedPassiveDisplayName,
  getFusedPassiveDisplayData,
  canAccessExtensionDungeon,
  EXTENSION_LEVEL_DROP_LABEL,
} from '../data/extensionDungeon';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { MiniCard } from './CombatLayout';
import UnifiedCharacterCard from './UnifiedCharacterCard';
import SharedTooltip from './SharedTooltip';
import { preparerCombattant, simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { envoyerAnnonceDiscord } from '../services/discordService';
import { checkAndAwardTitles } from '../services/titleService';
import { db } from '../firebase/config';
import { doc, increment, setDoc, Timestamp } from 'firebase/firestore';

const extensionImageModules = import.meta.glob('../assets/extension/*.png', { eager: true, import: 'default' });
const weaponImageModules = import.meta.glob('../assets/weapons/*.png', { eager: true, import: 'default' });

const getExtensionImage = (imageFile) => {
  if (!imageFile) return null;
  return extensionImageModules[`../assets/extension/${imageFile}`] || null;
};

const getWeaponImage = (imageFile) => {
  if (!imageFile) return null;
  return weaponImageModules[`../assets/weapons/${imageFile}`] || null;
};

const STAT_LABELS = {
  hp: 'HP',
  auto: 'Auto',
  def: 'DEF',
  cap: 'CAP',
  rescap: 'RESC',
  spd: 'VIT'
};

const Tooltip = ({ children, content }) => (
  <span className="relative group cursor-help">
    {children}
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-stone-900 border border-violet-500 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
      {content}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-violet-500" />
    </span>
  </span>
);

const getPassiveDetails = (passive) => {
  if (!passive) return null;
  const base = getMageTowerPassiveById(passive.id);
  const levelData = getMageTowerPassiveLevel(passive.id, passive.level);
  if (!base || !levelData) return null;
  return { ...base, level: passive.level, levelData };
};

const ExtensionDungeon = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [equippedWeapon, setEquippedWeapon] = useState(null);
  const [gameState, setGameState] = useState('lobby');
  const [player, setPlayer] = useState(null);
  const [boss, setBoss] = useState(null);
  const [playerCombatBase, setPlayerCombatBase] = useState(null);
  const [bossCombatBase, setBossCombatBase] = useState(null);
  const [playerCombatModifiers, setPlayerCombatModifiers] = useState(null);
  const [playerCombatStatus, setPlayerCombatStatus] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [error, setError] = useState(null);
  const [dungeonSummary, setDungeonSummary] = useState(null);
  const logEndRef = useRef(null);
  const logContainerRef = useRef(null);
  const hasAutoStartedRef = useRef(false);
  const combatStartLockRef = useRef(false);
  const [rolledExtensionPassive, setRolledExtensionPassive] = useState(null);
  const [previousExtensionPassive, setPreviousExtensionPassive] = useState(null);
  const [extensionChoice, setExtensionChoice] = useState(null);
  const [savingChoice, setSavingChoice] = useState(false);
  const [showUpgradeAnimation, setShowUpgradeAnimation] = useState(false);

  const hasExistingExtension = !!character?.mageTowerExtensionPassive;

  const shouldAutoScrollLog = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(min-width: 768px)').matches;
  };

  // Auto-scroll du journal : scroll le conteneur uniquement (pas la page)
  useEffect(() => {
    if (!shouldAutoScrollLog() || !logContainerRef.current) return;
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [combatLog]);

  const ensureExtensionMusic = () => {
    const el = document.getElementById('extension-music');
    if (el) {
      if (el.paused) el.play().catch(() => {});
    }
  };

  const stopExtensionMusic = () => {
    const el = document.getElementById('extension-music');
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;
      setLoading(true);
      const charResult = await getUserCharacter(currentUser.uid);
      if (!charResult.success || !charResult.data) {
        navigate('/');
        return;
      }
      const characterData = charResult.data;
      const level = characterData.level ?? 1;
      const forestBoosts = { ...getEmptyStatBoosts(), ...(characterData.forestBoosts || {}) };
      let weaponId = characterData.equippedWeaponId || null;
      let weaponData = weaponId ? getWeaponById(weaponId) : null;
      if (!weaponData) {
        const { getEquippedWeapon } = await import('../services/dungeonService');
        const weaponResult = await getEquippedWeapon(currentUser.uid);
        weaponData = weaponResult.success ? weaponResult.weapon : null;
        weaponId = weaponData?.id || null;
      }
      const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
      if (summaryResult.success) setDungeonSummary(summaryResult.data);
      setEquippedWeapon(weaponData);
      setCharacter(normalizeCharacterBonuses({
        ...characterData,
        forestBoosts,
        level,
        equippedWeaponData: weaponData,
        equippedWeaponId: weaponId,
      }));
      setLoading(false);
    };
    loadData();
  }, [currentUser, navigate]);

  useEffect(() => {
    if (gameState === 'lobby' || gameState === 'fighting') ensureExtensionMusic();
    if (gameState === 'victory' || gameState === 'defeat') stopExtensionMusic();
  }, [gameState]);

  // Mobile: certains layouts masquent le bouton, on lance le combat automatiquement.
  useEffect(() => {
    if (gameState !== 'fighting') {
      hasAutoStartedRef.current = false;
      return;
    }

    if (typeof window === 'undefined' || !window.matchMedia) return;
    const isPhone = window.matchMedia('(max-width: 767px)').matches;
    if (!isPhone) return;

    if (!player || !boss || !character) return;
    if (isSimulating) return;
    if (combatResult !== null) return;
    if (hasAutoStartedRef.current) return;

    hasAutoStartedRef.current = true;
    void simulateCombat();
  }, [gameState, player, boss, character, combatResult, isSimulating]);

  useEffect(() => {
    return () => stopExtensionMusic();
  }, []);

  const canAccess = character && canAccessExtensionDungeon(character.mageTowerPassive);

  const handleStartRun = async () => {
    setError(null);
    setRolledExtensionPassive(null);
    setPreviousExtensionPassive(null);
    setExtensionChoice(null);
    const result = await startDungeonRun(currentUser.uid);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setGameState('fighting');
    setCombatResult(null);
    setIsSimulating(false);
    ensureExtensionMusic();
    const playerReady = preparerCombattant(character);
    const bossReady = preparerCombattant(createExtensionBossCombatant());
    setPlayer(playerReady);
    setBoss(bossReady);
    setPlayerCombatBase(null);
    setBossCombatBase(null);
    setPlayerCombatModifiers(null);
    setPlayerCombatStatus(null);
    setCombatLog([`⚔️ Extension du Territoire — ${playerReady.name} vs ${EXTENSION_BOSS.nom} !`]);
  };

  const simulateCombat = async () => {
    if (!player || !boss || !character) return;
    if (combatStartLockRef.current) return;
    combatStartLockRef.current = true;
    setIsSimulating(true);
    setCombatResult(null);
    setPlayerCombatBase(null);
    setBossCombatBase(null);
    setPlayerCombatModifiers(null);
    setPlayerCombatStatus(null);
    ensureExtensionMusic();
    const p = { ...player };
    const b = { ...boss };
    const logs = [...combatLog, `--- Combat contre ${b.name} ---`];
    const matchResult = simulerMatch(character, createExtensionBossCombatant());
    checkAndAwardTitles(currentUser.uid, matchResult.steps, matchResult, character, { mode: 'extension', bossId: 'gojo' });
    const finalLogs = await replayCombatSteps(matchResult.steps, {
      setCombatLog,
      onStepHP: (step) => {
        setPlayerCombatBase(step.p1Base ?? undefined);
        setBossCombatBase(step.p2Base ?? undefined);
        setPlayerCombatModifiers(step.p1Modifiers ?? null);
        setPlayerCombatStatus(step.p1Status ?? null);
        setPlayer((prev) => prev ? { ...prev, currentHP: step.p1HP, shield: step.p1Shield ?? 0 } : null);
        setBoss((prev) => prev ? { ...prev, currentHP: step.p2HP, shield: step.p2Shield ?? 0 } : null);
      },
      existingLogs: logs,
      speed: 'normal'
    });
    logs.length = 0;
    logs.push(...finalLogs);
    const lastStep = matchResult.steps[matchResult.steps.length - 1];
    const playerWon = lastStep && lastStep.p1HP > 0;
    if (playerWon) {
      logs.push(`🏆 ${player?.name ?? p.name} terrasse ${boss?.name ?? b.name} !`);
      setCombatLog([...logs]);
      setCombatResult('victory');
      const rolled = rollExtensionPassive(character.mageTowerPassive?.id);
      setRolledExtensionPassive(rolled);
      if (rolled) {
        const newExtension = { id: rolled.id, level: rolled.level ?? 1 };
        setPreviousExtensionPassive(character.mageTowerExtensionPassive || null);
        updateCharacterMageTowerExtensionPassive(currentUser.uid, newExtension)
          .then(result => {
            if (result.success) {
              setCharacter(prev => prev ? { ...prev, mageTowerExtensionPassive: newExtension } : prev);
            }
          });
      }
      setGameState('reward');
    } else {
      logs.push(`💀 ${player?.name ?? p.name} a été vaincu par ${boss?.name ?? b.name}...`);
      setCombatLog([...logs]);
      setCombatResult('defeat');
      setGameState('defeat');
    }
    setIsSimulating(false);
    combatStartLockRef.current = false;
  };

  const handleAcceptNewPassive = async () => {
    if (!rolledExtensionPassive) return;
    setSavingChoice(true);
    const newExtension = { id: rolledExtensionPassive.id, level: rolledExtensionPassive.level ?? 1 };
    setExtensionChoice('new');
    setShowUpgradeAnimation(true);
    if (newExtension.level === 3) {
      const primaryName = getMageTowerPassiveById(character.mageTowerPassive?.id)?.name ?? 'Passif principal';
      const extensionName = getMageTowerPassiveById(newExtension.id)?.name ?? 'Passif extension';
      const mixedName = getMixedPassiveDisplayName(character.mageTowerPassive?.id, newExtension.id) || `${primaryName} + ${extensionName}`;
      envoyerAnnonceDiscord({
        titre: '👁️ MESDAMES ET MESSIEURS — DROP LEGENDAIRE !!!',
        message: `**INCREDIBLE!!!** La foule en délire!!! **${character?.name ?? 'Un combattant'}** vient de décrocher le graal : un passif d'extension **NIVEAU TROIS**!!!\n\n` +
          `*"Quelle rareté!!! Une chance sur cent!!! On n'avait jamais vu ça depuis le début du Tenka— euh, de l'Extension du Territoire!!!"*\n\n` +
          `**${mixedName}** — la fusion de ${primaryName} et ${extensionName} — résonne dans l'arène!!! QUELLE PUISSANCE!!!`,
      }).catch((err) => console.warn('Annonce Discord extension niv.3:', err));

      // Progression compte: passif extension Gojo niveau 3 (persistante).
      await setDoc(doc(db, 'tournamentRewards', currentUser.uid), {
        gojoPassiveLevel3Count: increment(1),
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }
    setSavingChoice(false);
  };

  const handleKeepOldCombo = async () => {
    setSavingChoice(true);
    const runResult = await startDungeonRun(currentUser.uid);
    if (!runResult.success) {
      setError('Plus de runs disponibles pour conserver l\'ancienne combinaison.');
      setSavingChoice(false);
      return;
    }
    const revertResult = await updateCharacterMageTowerExtensionPassive(currentUser.uid, previousExtensionPassive);
    if (revertResult.success) {
      setCharacter(prev => prev ? { ...prev, mageTowerExtensionPassive: previousExtensionPassive } : prev);
    }
    const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
    if (summaryResult.success) setDungeonSummary(summaryResult.data);
    setExtensionChoice('keep');
    setSavingChoice(false);
  };

  const handleBackToLobby = () => {
    stopExtensionMusic();
    setGameState('lobby');
    setPlayer(null);
    setBoss(null);
    setCombatLog([]);
    setCombatResult(null);
    setRolledExtensionPassive(null);
    setPreviousExtensionPassive(null);
    setExtensionChoice(null);
    setShowUpgradeAnimation(false);
  };

  const formatLogMessage = (text) => {
    if (!player || !boss) return text;
    const pName = player.name;
    const bName = boss.name;
    const nameRegex = new RegExp(`(${pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
    return text.split(nameRegex).map((part, i) => {
      if (part === pName) return <span key={i} className="font-bold text-blue-400">{part}</span>;
      if (part === bName) return <span key={i} className="font-bold text-violet-400">{part}</span>;
      return part;
    });
  };

  const BossCard = ({ bossChar, combatBaseOverride: bossCombatBaseOverride }) => {
    if (!bossChar) return null;
    const base = bossCombatBaseOverride ?? bossChar.base;
    const hpPercent = Math.max(0, Math.min(100, (bossChar.currentHP / bossChar.maxHP) * 100));
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const shieldPercent = bossChar.maxHP > 0 ? Math.min(100, ((bossChar.shield ?? 0) / bossChar.maxHP) * 100) : 0;
    const bossImg = getExtensionImage(bossChar.imageFile);
    return (
      <UnifiedCharacterCard
        header="Boss • Extension du Territoire"
        name={bossChar.name}
        image={bossImg}
        fallback={<span className="text-7xl">{EXTENSION_BOSS.icon}</span>}
        topStats={<><span>HP: {base.hp}</span><span>VIT: {base.spd}</span></>}
        hpText={`${bossChar.name} — PV ${Math.max(0, bossChar.currentHP)}/${bossChar.maxHP}`}
        hpPercent={hpPercent}
        hpClass={hpClass}
        shieldPercent={shieldPercent}
        mainStats={
          <>
            <div>Auto: {base.auto}</div>
            <div>DEF: {base.def}</div>
            <div>CAP: {base.cap}</div>
            <div>RESC: {base.rescap}</div>
          </>
        }
        details={
          <div className="space-y-2">
            {[2, 4, 6].map((t) => {
              const spell = EXTENSION_BOSS.spells[t];
              const emoji = spell.color === 'bleu' ? '🔵' : spell.color === 'rouge' ? '🔴' : '🟣';
              return (
                <SharedTooltip
                  key={t}
                  content={<span className="whitespace-normal block text-left max-w-[220px]">{spell.description}</span>}
                >
                  <div className="flex items-start gap-2 bg-stone-700/50 p-2 rounded-lg text-xs border border-stone-600 cursor-help">
                    <span className="text-lg">{emoji}</span>
                    <div>
                      <div className="text-amber-300 font-semibold">Tour {t}: {spell.name}</div>
                      <div className="text-stone-400 text-[10px]">{spell.description}</div>
                    </div>
                  </div>
                </SharedTooltip>
              );
            })}
          </div>
        }
        cardClassName=""
        borderId="territory"
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <audio id="extension-music" loop>
          <source src="/assets/music/extension.mp3" type="audio/mpeg" />
        </audio>
        <div className="text-violet-400 text-2xl">Chargement de l'Extension...</div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-red-400 text-2xl">Aucun personnage trouvé.</div>
      </div>
    );
  }

  if (gameState === 'reward') {
    const alreadyChose = extensionChoice !== null;
    const primaryPassive = character.mageTowerPassive;
    const primaryDetails = getPassiveDetails(primaryPassive);
    const baseMixedName = rolledExtensionPassive
      ? (getMixedPassiveDisplayName(primaryPassive?.id, rolledExtensionPassive.id) || `${primaryDetails?.name ?? ''} + ${getMageTowerPassiveById(rolledExtensionPassive.id)?.name ?? rolledExtensionPassive.name}`)
      : '';
    const mixedName = rolledExtensionPassive && rolledExtensionPassive.level > 1
      ? `${baseMixedName}, niveau ${rolledExtensionPassive.level}`
      : baseMixedName;

    return (
      <div className="min-h-screen p-6">
        <Header />
        <audio id="extension-music" loop>
          <source src="/assets/music/extension.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-5xl mx-auto pt-20 sm:pt-16 text-center">
          <div className="flex justify-center mb-8">
            <CharacterCardContent character={character} detailsPlacement="left" />
          </div>

          <div className="inline-block bg-stone-950/85 border border-violet-600/80 rounded-lg px-6 py-3 shadow-lg mb-6">
            <h2 className="text-2xl font-bold text-violet-400">👁️ Satoru Gojo est vaincu !</h2>
            <p className="text-stone-300 text-sm mt-1">Passif aléatoire obtenu (niveau 1, 2 ou 3 selon le drop).</p>
          </div>

          {showUpgradeAnimation && rolledExtensionPassive && (
            <div
              className="mb-6 py-6 px-6 rounded-xl border-2 animate-pulse max-w-2xl mx-auto"
              style={{
                background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(15, 10, 25, 0.95) 25%, rgba(15, 10, 25, 0.95) 75%, rgba(139, 92, 246, 0.15) 100%)',
                borderColor: 'rgba(139, 92, 246, 0.8)',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.3), 0 0 20px rgba(239, 68, 68, 0.3), 0 0 20px rgba(139, 92, 246, 0.3)'
              }}
            >
              <p className="text-white font-bold text-lg">✨ Passif étendu — Bleu, Rouge, Violet ✨</p>
              <p className="text-stone-200 text-sm mt-2 font-medium">
                {mixedName || `${primaryDetails?.name} (Niv.3) + ${getMageTowerPassiveById(rolledExtensionPassive.id)?.name} (Niv.${rolledExtensionPassive?.level ?? 1})`}
              </p>
            </div>
          )}

          {!rolledExtensionPassive && (
            <p className="text-amber-400 mb-4">Aucun passif éligible pour l’extension.</p>
          )}

          {!alreadyChose && rolledExtensionPassive ? (
            <>
              {/* Ancien vs nouveau second passif avec effets */}
              <div className="mb-6 space-y-4 max-w-2xl mx-auto">
                {previousExtensionPassive && (() => {
                  const oldExt = previousExtensionPassive;
                  const oldDetails = getPassiveDetails(oldExt);
                  const oldMixedName = getMixedPassiveDisplayName(primaryPassive?.id, oldExt?.id) || (oldDetails && `${primaryDetails?.name ?? ''} + ${oldDetails.name}`);
                  return oldDetails ? (
                    <div className="p-5 bg-stone-950/90 border border-amber-500/70 rounded-xl text-left shadow-lg">
                      <p className="text-amber-300 font-bold mb-2 text-sm uppercase tracking-wider">🟡 Ancien second passif (actuel)</p>
                      <p className="text-white font-semibold text-lg">{oldMixedName} — Niv.{oldExt?.level ?? 1}</p>
                      <p className="text-stone-300 text-sm mt-2">{oldDetails.levelData?.description ?? '—'}</p>
                    </div>
                  ) : null;
                })()}
                {(() => {
                  const newLevelData = getMageTowerPassiveLevel(rolledExtensionPassive.id, rolledExtensionPassive.level ?? 1);
                  const newMixedName = getMixedPassiveDisplayName(primaryPassive?.id, rolledExtensionPassive.id) || `${primaryDetails?.name ?? ''} + ${getMageTowerPassiveById(rolledExtensionPassive.id)?.name ?? rolledExtensionPassive.name}`;
                  return (
                    <div className="p-5 bg-stone-950/90 border border-violet-500/70 rounded-xl text-left shadow-lg">
                      <p className="text-violet-300 font-bold mb-2 text-sm uppercase tracking-wider">🟣 Nouveau second passif (récompense)</p>
                      <p className="text-white font-semibold text-lg">{newMixedName} — Niv.{rolledExtensionPassive.level ?? 1}</p>
                      <p className="text-stone-300 text-sm mt-2">{newLevelData?.description ?? '—'}</p>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-3 max-w-md mx-auto">
                <button
                  onClick={handleAcceptNewPassive}
                  disabled={savingChoice}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-stone-700 text-white px-8 py-3 rounded-lg font-bold border border-violet-500 transition shadow-lg"
                >
                  {savingChoice ? 'Sauvegarde...' : 'Accepter le nouveau passif'}
                </button>
                {previousExtensionPassive && (
                  <button
                    onClick={handleKeepOldCombo}
                    disabled={savingChoice || !dungeonSummary?.runsRemaining}
                    className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 text-white px-8 py-3 rounded-lg font-bold border border-amber-500 transition shadow-lg"
                  >
                    {savingChoice ? 'Sauvegarde...' : "Conserver l'ancienne combinaison (coûte 1 run)"}
                  </button>
                )}
                {previousExtensionPassive && !dungeonSummary?.runsRemaining && (
                  <p className="text-red-400 text-sm">Plus de runs pour conserver l'ancienne combinaison.</p>
                )}
              </div>
            </>
          ) : alreadyChose ? (
            <div className="mb-6 max-w-md mx-auto">
              {extensionChoice === 'new' && rolledExtensionPassive ? (
                <div className="bg-stone-950/90 border border-violet-500/70 rounded-xl p-5 shadow-lg">
                  <p className="text-violet-300 font-bold mb-2">Nouveau passif ajouté !</p>
                  <p className="text-white">
                    {mixedName || `${primaryDetails?.name} (Niv.3) + ${getMageTowerPassiveById(rolledExtensionPassive.id)?.name} (Niv.${rolledExtensionPassive?.level ?? 1})`}
                  </p>
                </div>
              ) : (
                <div className="bg-stone-950/90 border border-amber-500/70 rounded-xl p-5 shadow-lg">
                  <p className="text-amber-300 font-bold mb-2">Ancienne combinaison conservée (1 run dépensé)</p>
                </div>
              )}
            </div>
          ) : null}

          {(extensionChoice !== null || !rolledExtensionPassive) && (
            <button
              onClick={handleBackToLobby}
              className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 rounded-lg font-bold border border-stone-500 transition mt-4"
            >
              ← Retour à l'extension
            </button>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'victory' || gameState === 'defeat') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <audio id="extension-music" loop>
          <source src="/assets/music/extension.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-2xl mx-auto pt-20 sm:pt-16 text-center">
          <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl p-10 shadow-lg">
            <div className="text-7xl mb-6">{gameState === 'victory' ? '👁️' : '💀'}</div>
            <h2 className={`text-3xl font-bold mb-4 ${gameState === 'victory' ? 'text-violet-400' : 'text-red-400'}`}>
              {gameState === 'victory' ? 'Victoire !' : 'Défaite...'}
            </h2>
            <p className="text-stone-300 mb-8">
              {gameState === 'victory' ? 'Choisissez votre récompense.' : 'Gojo vous a dominé.'}
            </p>
            <button onClick={handleBackToLobby} className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 rounded-lg font-bold border border-stone-500 transition">
              ← Retour à l'extension
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'fighting') {
    const playerHP = player?.currentHP ?? player?.maxHP ?? playerCombatBase?.hp ?? player?.base?.hp ?? 1;
    const playerMaxHP = player?.maxHP ?? playerCombatBase?.hp ?? player?.base?.hp ?? 1;
    const playerShield = player?.shield ?? 0;
    const bossHP = boss?.currentHP ?? boss?.maxHP ?? bossCombatBase?.hp ?? boss?.base?.hp ?? 1;
    const bossMaxHP = boss?.maxHP ?? bossCombatBase?.hp ?? boss?.base?.hp ?? 1;
    const bossShield = boss?.shield ?? 0;

    return (
      <div className="min-h-screen p-6">
        <Header />
        <audio id="extension-music" loop>
          <source src="/assets/music/extension.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-[1800px] mx-auto pt-20 sm:pt-16">
          {/* Boutons centrés en haut */}
          <div className="flex justify-center gap-3 md:gap-4 mb-6">
            {combatResult === null && (
              <button
                onClick={simulateCombat}
                disabled={isSimulating || !player || !boss}
                className="bg-violet-600 hover:bg-violet-700 disabled:bg-stone-700 disabled:text-stone-400 text-white px-6 py-3 rounded-lg font-bold text-sm md:text-base flex items-center justify-center gap-2 transition shadow-lg border border-violet-500"
              >
                ▶️ Lancer le combat
              </button>
            )}
            <button
              onClick={handleBackToLobby}
              className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-6 py-3 rounded-lg font-bold text-sm md:text-base flex items-center justify-center gap-2 transition shadow-lg border border-stone-500"
            >
              ← Abandonner
            </button>
          </div>

          {combatResult === 'victory' && (
            <div className="flex justify-center mb-4">
              <div className="bg-violet-600/90 text-white px-8 py-3 rounded-xl font-bold text-xl animate-pulse shadow-2xl border border-violet-400">
                👁️ {player.name} étend son territoire ! 👁️
              </div>
            </div>
          )}
          {combatResult === 'defeat' && (
            <div className="flex justify-center mb-4">
              <div className="bg-red-900/80 text-red-200 px-8 py-3 rounded-xl font-bold text-xl shadow-2xl border border-red-600">
                💀 {player.name} a été dominé... 💀
              </div>
            </div>
          )}

          {/* ═══ MOBILE (< 1024px) : Mini-cartes + journal compact ═══ */}
          <div className="lg:hidden flex flex-col gap-2">
            <div className="flex gap-2">
              <MiniCard entity={{ name: player?.name, currentHP: playerHP, maxHP: playerMaxHP, shield: playerShield ?? 0, base: playerCombatBase ?? player?.base ?? {}, image: player?.characterImage }} side="left" />
              <MiniCard entity={{ name: boss?.name, currentHP: bossHP, maxHP: bossMaxHP, shield: bossShield ?? 0, base: bossCombatBase ?? boss?.base ?? {}, ability: boss?.ability, image: boss?.characterImage }} side="right" />
            </div>
            <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col" style={{ height: 'calc(100dvh - 280px)', minHeight: '260px', maxHeight: '420px' }}>
              <div className="bg-stone-900/90 px-3 py-2 border-b border-violet-600/50 rounded-t-xl">
                <h2 className="text-sm font-bold text-violet-300 text-center">👁️ Extension du Territoire</h2>
              </div>
              <div ref={logContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
                {combatLog.length === 0 ? (
                  <p className="text-stone-500 italic text-center py-4">Cliquez sur "Lancer le combat"...</p>
                ) : (
                  <>
                    {combatLog.map((log, idx) => {
                      const isP1 = log.startsWith('[P1]');
                      const isP2 = log.startsWith('[P2]');
                      const cleanLog = log.replace(/^\[P[12]\]\s*/, '');
                      if (!isP1 && !isP2) {
                        if (log.includes('🏆') || log.includes('👁️')) return <div key={idx} className="flex justify-center my-2"><div className="bg-violet-600/90 text-white px-3 py-1.5 font-bold text-xs rounded-lg">{cleanLog}</div></div>;
                        if (log.includes('💀')) return <div key={idx} className="flex justify-center my-2"><div className="bg-red-900 text-red-200 px-3 py-1.5 font-bold text-xs rounded-lg">{cleanLog}</div></div>;
                        if (log.includes('---')) return <div key={idx} className="flex justify-center my-1"><div className="bg-stone-700 text-stone-200 px-2 py-0.5 text-[10px] font-bold rounded">{cleanLog}</div></div>;
                        return <div key={idx} className="text-center text-stone-400 text-[10px] italic">{cleanLog}</div>;
                      }
                      if (isP1) return <div key={idx} className="flex justify-start"><div className="max-w-[85%] bg-stone-700 text-stone-200 px-2 py-1 rounded border-l-2 border-blue-500 text-[11px]">{formatLogMessage(cleanLog)}</div></div>;
                      return <div key={idx} className="flex justify-end"><div className="max-w-[85%] bg-stone-700 text-stone-200 px-2 py-1 rounded border-r-2 border-violet-500 text-[11px]">{formatLogMessage(cleanLog)}</div></div>;
                    })}
                    <div ref={logEndRef} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ═══ DESKTOP (1024px+) : Layout original avec detailsPlacement ═══ */}
          <div className="hidden lg:flex flex-row gap-4 items-start justify-center text-sm">
            <div className="w-auto flex-shrink-0">
              <CharacterCardContent character={player} showHpBar combatBaseOverride={playerCombatBase} combatModifiers={playerCombatModifiers} opponent={boss} combatStatus={playerCombatStatus} detailsPlacement="left" />
            </div>

            <div className="flex-1 min-w-[400px] flex flex-col">
              <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-2xl flex flex-col h-[600px]">
                <div className="bg-stone-900/90 p-3 border-b border-violet-600/50 rounded-t-xl">
                  <h2 className="text-xl font-bold text-violet-300 text-center">👁️ Extension du Territoire</h2>
                </div>
                <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
                  {combatLog.length === 0 ? (
                    <p className="text-stone-500 italic text-center py-8 text-sm">Cliquez sur "Lancer le combat" pour commencer...</p>
                  ) : (
                    <>
                      {combatLog.map((log, idx) => {
                        const isP1 = log.startsWith('[P1]');
                        const isP2 = log.startsWith('[P2]');
                        const cleanLog = log.replace(/^\[P[12]\]\s*/, '');
                        if (!isP1 && !isP2) {
                          if (log.includes('🏆') || log.includes('👁️')) {
                            return (
                              <div key={idx} className="flex justify-center my-4">
                                <div className="bg-violet-600/90 text-white px-6 py-3 rounded-lg font-bold text-lg shadow-lg border border-violet-400">{cleanLog}</div>
                              </div>
                            );
                          }
                          if (log.includes('💀')) {
                            return (
                              <div key={idx} className="flex justify-center my-4">
                                <div className="bg-red-900/80 text-red-200 px-6 py-3 rounded-lg font-bold text-lg shadow-lg border border-red-600">{cleanLog}</div>
                              </div>
                            );
                          }
                          if (log.includes('---') || log.includes('⚔️')) {
                            return (
                              <div key={idx} className="flex justify-center my-3">
                                <div className="bg-stone-700/80 text-stone-200 px-4 py-1 rounded-lg text-sm font-bold border border-stone-500">{cleanLog}</div>
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
                        return (
                          <div key={idx} className="flex justify-end">
                            <div className="max-w-[80%]">
                              <div className="bg-stone-700/80 text-stone-200 px-4 py-2 rounded-lg shadow-lg border-r-4 border-violet-500">
                                <div className="text-sm">{formatLogMessage(cleanLog)}</div>
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

            <div className="w-auto flex-shrink-0">
              <BossCard bossChar={boss} combatBaseOverride={bossCombatBase} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const bossImg = getExtensionImage(EXTENSION_BOSS.imageFile);

  const LobbyBossCard = () => (
    <UnifiedCharacterCard
      header="Boss • Extension du Territoire"
      name={EXTENSION_BOSS.nom}
      image={bossImg}
      fallback={<span className="text-7xl">{EXTENSION_BOSS.icon}</span>}
      topStats={<><span>HP: {EXTENSION_BOSS.stats.hp}</span><span>VIT: {EXTENSION_BOSS.stats.spd}</span></>}
      mainStats={
        <>
          <div>Auto: {EXTENSION_BOSS.stats.auto}</div>
          <div>DEF: {EXTENSION_BOSS.stats.def}</div>
          <div>CAP: {EXTENSION_BOSS.stats.cap}</div>
          <div>RESC: {EXTENSION_BOSS.stats.rescap}</div>
        </>
      }
      details={
        <div className="space-y-2">
          {[2, 4, 6].map((t) => {
            const spell = EXTENSION_BOSS.spells[t];
            const emoji = spell.color === 'bleu' ? '🔵' : spell.color === 'rouge' ? '🔴' : '🟣';
            return (
              <div key={t} className="flex items-start gap-2 bg-stone-700/50 p-2 rounded-lg text-xs border border-stone-600">
                <span className="text-lg">{emoji}</span>
                <div>
                  <div className="text-violet-300 font-semibold">Tour {t}: {spell.name}</div>
                  <div className="text-stone-400 text-[10px]">{spell.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      }
      cardClassName=""
      borderId="territory"
    />
  );

  return (
    <div className="min-h-screen p-6">
      <Header />
      <audio id="extension-music" loop>
        <source src="/assets/music/extension.mp3" type="audio/mpeg" />
      </audio>
      <div className="max-w-5xl mx-auto pt-20 sm:pt-16">
        {/* Titre */}
        <div className="flex justify-center mb-6">
          <div className="bg-stone-950/85 border border-violet-600/80 rounded-lg px-8 py-3 shadow-lg">
            <h2 className="text-3xl md:text-4xl font-bold text-violet-400">👁️ Extension du Territoire</h2>
          </div>
        </div>

        {/* Essais disponibles */}
        <div className="bg-stone-950/85 border border-violet-600/60 rounded-xl p-5 mb-6 shadow-lg">
          <p className="text-violet-300 font-bold text-sm uppercase tracking-wider">Essais disponibles</p>
          <p className="text-white text-3xl font-bold mt-1">{dungeonSummary?.runsRemaining ?? 0}</p>
          <p className="text-stone-400 text-xs mt-1">1 run = 1 combat (garder ancienne combinaison = +1 run)</p>
        </div>

        {/* Erreurs */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-xl p-4 mb-6 text-center shadow-lg">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {!canAccess && (
          <div className="bg-red-950 border border-red-600 rounded-xl p-4 mb-6 text-center shadow-lg">
            <p className="text-red-300 font-bold">Vous devez avoir un passif Tour du Mage niveau 3 pour accéder à l'Extension du Territoire.</p>
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-4 justify-center mb-6">
          <button
            onClick={handleStartRun}
            disabled={!canAccess || !dungeonSummary?.runsRemaining}
            className={`px-10 py-4 rounded-lg font-bold text-lg transition shadow-lg ${
              canAccess && dungeonSummary?.runsRemaining > 0
                ? 'bg-violet-600 hover:bg-violet-700 text-white border border-violet-500'
                : 'bg-stone-700 text-stone-500 cursor-not-allowed border border-stone-600'
            }`}
          >
            {canAccess && dungeonSummary?.runsRemaining > 0 ? '⚔️ Défier Satoru Gojo' : 'Accès impossible'}
          </button>
          <button
            onClick={() => navigate('/dungeons')}
            className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-3 rounded-lg font-bold border border-stone-500 transition"
          >
            ← Retour aux donjons
          </button>
        </div>

        {/* Personnage gauche - Boss droite */}
        <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center">
          <div className="w-full md:w-auto md:flex-shrink-0">
            <CharacterCardContent character={character} detailsPlacement="left" />
          </div>
          <div className="w-full md:w-[340px] md:flex-shrink-0">
            <LobbyBossCard />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtensionDungeon;
