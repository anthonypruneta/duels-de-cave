import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserCharacter,
  updateCharacterEquippedWeapon,
} from '../services/characterService';
import { getEquippedWeapon, getPlayerDungeonSummary, startDungeonRun } from '../services/dungeonService';
import { saveWeaponUpgrade, getWeaponUpgrade } from '../services/forgeService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getRaceBonusText } from '../utils/descriptionBuilders';
import {
  cooldowns,
  classConstants,
  raceConstants,
  dmgPhys,
  dmgCap,
  calcCritChance,
  getCritMultiplier,
  getRaceBonus,
  getClassBonus
} from '../data/combatMechanics';
import { applyAwakeningToBase, buildAwakeningState, getAwakeningEffect, removeBaseRaceFlatBonusesIfAwakened } from '../utils/awakening';
import { getWeaponById, RARITY, RARITY_COLORS } from '../data/weapons';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import {
  applyPassiveWeaponStats,
  initWeaponCombatState,
  applyForgeUpgrade,
} from '../utils/weaponEffects';
import { FORGE_BOSS, createForgeBossCombatant, generateForgeUpgradeRoll, formatUpgradePct, extractForgeUpgrade, hasAnyForgeUpgrade, isForgeRollHighPerfection, FORGE_STAT_LABELS } from '../data/forgeDungeon';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { MiniCard } from './CombatLayout';
import UnifiedCharacterCard from './UnifiedCharacterCard';
import { preparerCombattant, simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { envoyerAnnonceDiscord } from '../services/discordService';
import { checkAndAwardTitles } from '../services/titleService';
import CombatSpeedSelector from './CombatSpeedSelector';
import { db } from '../firebase/config';
import { doc, increment, setDoc, Timestamp } from 'firebase/firestore';

const forgeImageModules = import.meta.glob('../assets/forge/*.png', { eager: true, import: 'default' });
const weaponImageModules = import.meta.glob('../assets/weapons/*.png', { eager: true, import: 'default' });

const getForgeImage = (imageFile) => {
  if (!imageFile) return null;
  return forgeImageModules[`../assets/forge/${imageFile}`] || null;
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

const getWeaponStatColor = (value) => {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-yellow-300';
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

const Tooltip = ({ children, content }) => {
  return (
    <span className="relative group cursor-help">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-stone-900 border border-amber-500 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-500"></span>
      </span>
    </span>
  );
};


const UPGRADE_STAT_LABELS = FORGE_STAT_LABELS;

const getPassiveDetails = (passive) => {
  if (!passive) return null;
  const base = getMageTowerPassiveById(passive.id);
  const levelData = getMageTowerPassiveLevel(passive.id, passive.level);
  if (!base || !levelData) return null;
  return { ...base, level: passive.level, levelData };
};

const ForgeDungeon = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [equippedWeapon, setEquippedWeapon] = useState(null);
  const [gameState, setGameState] = useState('lobby'); // lobby, fighting, reward, victory, defeat
  const [combatSpeed, setCombatSpeed] = useState('normal'); // normal | fast | turbo
  const [player, setPlayer] = useState(null);
  const [boss, setBoss] = useState(null);
  const [playerCombatBase, setPlayerCombatBase] = useState(null);
  const [bossCombatBase, setBossCombatBase] = useState(null);
  const [playerCombatModifiers, setPlayerCombatModifiers] = useState(null);
  const [playerCombatStatus, setPlayerCombatStatus] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [error, setError] = useState(null);
  const [dungeonSummary, setDungeonSummary] = useState(null);
  const logEndRef = useRef(null);
  const logContainerRef = useRef(null);
  const hasAutoStartedRef = useRef(false);
  const combatStartLockRef = useRef(false);
  const [currentUpgrade, setCurrentUpgrade] = useState(null);
  const [previousUpgrade, setPreviousUpgrade] = useState(null);
  const [newUpgradeRoll, setNewUpgradeRoll] = useState(null);
  const [upgradeChoice, setUpgradeChoice] = useState(null);
  const [savingUpgrade, setSavingUpgrade] = useState(false);

  const ensureForgeMusic = () => {
    const forgeMusic = document.getElementById('forge-music');
    if (forgeMusic) {
      if (forgeMusic.paused) {
        forgeMusic.play().catch(error => console.log('Autoplay bloque:', error));
      }
    }
  };

  const stopForgeMusic = () => {
    const forgeMusic = document.getElementById('forge-music');
    if (forgeMusic) {
      forgeMusic.pause();
      forgeMusic.currentTime = 0;
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
        const weaponResult = await getEquippedWeapon(currentUser.uid);
        weaponData = weaponResult.success ? weaponResult.weapon : null;
        weaponId = weaponResult.success ? weaponResult.weapon?.id || null : null;
        if (weaponId && weaponId !== characterData.equippedWeaponId) {
          updateCharacterEquippedWeapon(currentUser.uid, weaponId);
        }
      }

      const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
      if (summaryResult.success) {
        setDungeonSummary(summaryResult.data);
      }

      // Charger l'upgrade existant
      const upgradeResult = await getWeaponUpgrade(currentUser.uid);
      if (upgradeResult.success && upgradeResult.data) {
        setCurrentUpgrade(upgradeResult.data);
      }

      setEquippedWeapon(weaponData);
      setCharacter(normalizeCharacterBonuses({
        ...characterData,
        forestBoosts,
        level,
        equippedWeaponData: weaponData,
        equippedWeaponId: weaponId,
        forgeUpgrade: upgradeResult.success ? upgradeResult.data : null,
      }));

      setLoading(false);
    };

    loadData();
  }, [currentUser, navigate]);

  const shouldAutoScrollLog = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(min-width: 768px)').matches;
  };

  // Auto-scroll du journal : scroll le conteneur uniquement (pas la page)
  useEffect(() => {
    if (!shouldAutoScrollLog() || !logContainerRef.current) return;
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [combatLog]);

  useEffect(() => {
    if (gameState === 'lobby' || gameState === 'fighting') {
      ensureForgeMusic();
    }
    if (gameState === 'victory' || gameState === 'defeat') {
      stopForgeMusic();
    }
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

  // Cleanup music on unmount
  useEffect(() => {
    return () => stopForgeMusic();
  }, []);

  const isLegendaryEquipped = equippedWeapon?.rarete === RARITY.LEGENDAIRE;



  const handleStartRun = async () => {
    if (isStartingRun) return;
    setError(null);
    setNewUpgradeRoll(null);
    setPreviousUpgrade(null);
    setUpgradeChoice(null);
    setIsStartingRun(true);
    try {
      const result = await startDungeonRun(currentUser.uid);
      if (!result.success) {
        setError(result.error);
        return;
      }

      setGameState('fighting');
      setCombatResult(null);
      setIsSimulating(false);
      ensureForgeMusic();

      const playerReady = preparerCombattant(character);
      const bossReady = preparerCombattant(createForgeBossCombatant());

      setPlayer(playerReady);
      setBoss(bossReady);
      setPlayerCombatBase(null);
      setBossCombatBase(null);
      setPlayerCombatModifiers(null);
      setPlayerCombatStatus(null);
      setCombatLog([`⚔️ Forge des Legendes — ${playerReady.name} vs ${FORGE_BOSS.nom} !`]);
    } finally {
      setIsStartingRun(false);
    }
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
    ensureForgeMusic();

    const p = { ...player };
    const b = { ...boss };
    const logs = [...combatLog, `--- Combat contre ${b.name} ---`];

    const matchResult = simulerMatch(character, createForgeBossCombatant());
    checkAndAwardTitles(currentUser.uid, matchResult.steps, matchResult, character, { mode: 'forge', bossId: 'ornn' });

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
      speed: combatSpeed
    });
    logs.length = 0;
    logs.push(...finalLogs);
    const lastStep = matchResult.steps[matchResult.steps.length - 1];
    const playerWon = lastStep && lastStep.p1HP > 0;

    if (playerWon) {
      logs.push(`🏆 ${player?.name ?? p.name} terrasse ${boss?.name ?? b.name} !`);
      setCombatLog([...logs]);
      setCombatResult('victory');

      const weaponId = character.equippedWeaponId || equippedWeapon?.id;
      const roll = generateForgeUpgradeRoll(weaponId);
      setNewUpgradeRoll(roll);
      setPreviousUpgrade(currentUpgrade || null);
      saveWeaponUpgrade(currentUser.uid, { ...roll, weaponId })
        .then(result => {
          if (result.success) {
            setCurrentUpgrade(roll);
            setCharacter(prev => ({ ...prev, forgeUpgrade: roll }));
          }
        });
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

  const handleAcceptNewRoll = async () => {
    if (!newUpgradeRoll) return;
    setSavingUpgrade(true);
    setUpgradeChoice('new');
    if (isForgeRollHighPerfection(newUpgradeRoll, 0.9)) {
      const { bonuses, penalties } = extractForgeUpgrade(newUpgradeRoll);
      const bonusStr = Object.entries(bonuses).map(([k, v]) => `${FORGE_STAT_LABELS[k] || k} +${formatUpgradePct(v)}`).join(', ');
      const penaltyStr = Object.entries(penalties).filter(([, v]) => v > 0).map(([k, v]) => `${FORGE_STAT_LABELS[k] || k} -${formatUpgradePct(v)}`).join(', ');
      const rollDesc = [bonusStr, penaltyStr].filter(Boolean).join(' • ');
      const weaponName = character?.equippedWeaponData?.nom ?? character?.equippedWeaponId ?? 'arme légendaire';
      envoyerAnnonceDiscord({
        titre: '🔨 MESDAMES ET MESSIEURS — LA FORGE A PARLÉ !!!',
        message: `**INCROYABLE!!!** Le dieu Ornn lui-même doit être impressionné!!! **${character?.name ?? 'Un combattant'}** vient de produire une forge **AU-DESSUS DE 90% DE PERFECTION**!!!\n\n` +
          `*"Regardez-moi ça!!! Une telle qualité!!! On dirait presque une arme des dieux!!! La foule n'en revient pas!!!"*\n\n` +
          `**${weaponName}** : ${rollDesc} — QUELLE ŒUVRE!!!`,
      }).catch((err) => console.warn('Annonce Discord forge perfection:', err));

      // Progression compte: "arme parfaite d'Ornn" (persistante).
      await setDoc(doc(db, 'tournamentRewards', currentUser.uid), {
        perfectOrnnWeaponCount: increment(1),
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }
    setSavingUpgrade(false);
  };

  const handleKeepOldRoll = async () => {
    setSavingUpgrade(true);

    const runResult = await startDungeonRun(currentUser.uid);
    if (!runResult.success) {
      setError('Plus de runs disponibles pour conserver l\'ancien roll.');
      setSavingUpgrade(false);
      return;
    }

    if (previousUpgrade) {
      const weaponId = character?.equippedWeaponId || equippedWeapon?.id;
      const revertResult = await saveWeaponUpgrade(currentUser.uid, { ...previousUpgrade, weaponId });
      if (revertResult.success) {
        setCurrentUpgrade(previousUpgrade);
        setCharacter(prev => ({ ...prev, forgeUpgrade: previousUpgrade }));
      }
    }

    const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
    if (summaryResult.success) {
      setDungeonSummary(summaryResult.data);
    }

    setUpgradeChoice('keep');
    setSavingUpgrade(false);
  };

  const handleBackToLobby = () => {
    stopForgeMusic();
    setGameState('lobby');
    setPlayer(null);
    setBoss(null);
    setCombatLog([]);
    setCombatResult(null);
    setNewUpgradeRoll(null);
    setPreviousUpgrade(null);
    setUpgradeChoice(null);
  };

  const formatLogMessage = (text) => {
    if (!player || !boss) return text;

    const pName = player.name;
    const bName = boss.name;
    let key = 0;

    const processText = (str) => {
      const result = [];
      const nameRegex = new RegExp(`(${pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
      const nameParts = str.split(nameRegex);

      nameParts.forEach((part) => {
        if (part === pName) {
          result.push(<span key={`name-${key++}`} className="font-bold text-blue-400">{part}</span>);
        } else if (part === bName) {
          result.push(<span key={`name-${key++}`} className="font-bold text-orange-400">{part}</span>);
        } else if (part) {
          const numRegex = /(\d+)\s*(points?\s*de\s*(?:vie|dégâts?|dommages?)|PV(?:\s*max)?|dégâts?(?:\s*(?:magiques?|physiques?|bruts?))?)/gi;
          const critRegex = /(CRITIQUE\s*!?)/gi;
          let lastIndex = 0;
          let match;
          const subParts = [];
          const pushWithCritHighlight = (chunk) => {
            if (!chunk) return;
            const critParts = chunk.split(critRegex);
            critParts.forEach((critPart) => {
              if (!critPart) return;
              if (/^CRITIQUE\s*!?$/i.test(critPart)) {
                subParts.push(<span key={`crit-${key++}`} className="font-bold text-yellow-300">{critPart}</span>);
              } else {
                subParts.push(critPart);
              }
            });
          };

          while ((match = numRegex.exec(part)) !== null) {
            if (match.index > lastIndex) {
              pushWithCritHighlight(part.slice(lastIndex, match.index));
            }
            const token = match[2].toLowerCase();
            const isHeal = token.includes('vie') || token.includes('pv');
            const colorClass = isHeal ? 'font-bold text-green-400' : 'font-bold text-red-400';
            subParts.push(<span key={`num-${key++}`} className={colorClass}>{match[1]}</span>);
            subParts.push(` ${match[2]}`);
            lastIndex = match.index + match[0].length;
          }

          if (lastIndex < part.length) {
            pushWithCritHighlight(part.slice(lastIndex));
          }

          if (subParts.length > 0) {
            result.push(...subParts);
          }
        }
      });

      return result;
    };

    return processText(text);
  };

  const UpgradeRollDisplay = ({ roll, label, isCurrent }) => {
    const { bonuses, penalties } = extractForgeUpgrade(roll);

    return (
      <div className={`flex-1 rounded-xl bg-stone-950/85 border p-5 text-center shadow-lg ${isCurrent ? 'border-amber-500/80' : 'border-orange-500/80'}`}>
        <div className="text-2xl mb-2">{isCurrent ? '🛡️' : '🔥'}</div>
        <div className={`text-sm font-bold mb-3 uppercase tracking-wider ${isCurrent ? 'text-amber-300' : 'text-orange-300'}`}>{label}</div>
        <div className="space-y-1.5">
          {Object.entries(bonuses).map(([statKey, pct]) => (
            <div key={`bonus-${statKey}`} className="text-green-400 font-semibold text-sm">
              {UPGRADE_STAT_LABELS[statKey] || statKey.toUpperCase()} +{formatUpgradePct(pct)}
            </div>
          ))}
          {Object.entries(penalties).map(([statKey, pct]) => (
            <div key={`penalty-${statKey}`} className="text-red-400 font-semibold text-sm">
              {UPGRADE_STAT_LABELS[statKey] || statKey.toUpperCase()} -{formatUpgradePct(pct)} (malus)
            </div>
          ))}
        </div>
      </div>
    );
  };

  const BossCard = ({ bossChar, combatBaseOverride: bossCombatBaseOverride }) => {
    if (!bossChar) return null;
    const base = bossCombatBaseOverride ?? bossChar.base;
    const hpPercent = Math.max(0, Math.min(100, (bossChar.currentHP / bossChar.maxHP) * 100));
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const shieldPercent = bossChar.maxHP > 0 ? Math.min(100, ((bossChar.shield ?? 0) / bossChar.maxHP) * 100) : 0;
    const bossImg = getForgeImage(bossChar.imageFile);
    return (
      <UnifiedCharacterCard
        header="Boss • Forge des Légendes"
        name={bossChar.name}
        image={bossImg}
        fallback={<span className="text-7xl">{FORGE_BOSS.icon}</span>}
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
        details={bossChar.ability ? (
          <div className="flex items-start gap-2 bg-stone-700/50 p-2 rounded-lg text-xs border border-stone-600">
            <span className="text-lg">🔥</span>
            <div className="flex-1">
              <div className="text-orange-300 font-semibold mb-1">{bossChar.ability.name}</div>
              <div className="text-stone-400 text-[10px]">{bossChar.ability.description}</div>
            </div>
          </div>
        ) : null}
        cardClassName=""
        borderId="lava"
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <audio id="forge-music" loop>
          <source src="/assets/music/forge.mp3" type="audio/mpeg" />
        </audio>
        <div className="text-orange-400 text-2xl">Chargement de la Forge...</div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-red-400 text-2xl">Aucun personnage trouve.</div>
      </div>
    );
  }

  // Reward screen after victory
  if (gameState === 'reward' && newUpgradeRoll) {
    const hadPreviousUpgrade = hasAnyForgeUpgrade(previousUpgrade);
    const alreadyChose = upgradeChoice !== null;

    return (
      <div className="min-h-screen p-6">
        <Header />
        <audio id="forge-music" loop>
          <source src="/assets/music/forge.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-5xl mx-auto pt-20 sm:pt-16 text-center">
          {/* Carte du personnage */}
          <div className="flex justify-center mb-8">
            <CharacterCardContent character={character} detailsPlacement="left" />
          </div>

          <div className="inline-block bg-stone-950/85 border border-orange-600/80 rounded-lg px-6 py-3 shadow-lg mb-6">
            <h2 className="text-2xl font-bold text-orange-400">🔨 Ornn est vaincu !</h2>
            <p className="text-stone-300 text-sm mt-1">La forge produit une amélioration pour votre arme.</p>
          </div>

          {!alreadyChose ? (
            <>
              <div className="flex flex-col sm:flex-row gap-4 mb-6 max-w-2xl mx-auto">
                {hadPreviousUpgrade && (
                  <UpgradeRollDisplay
                    roll={previousUpgrade}
                    label="Roll actuel"
                    isCurrent={true}
                  />
                )}
                <UpgradeRollDisplay
                  roll={newUpgradeRoll}
                  label="Nouveau roll"
                  isCurrent={false}
                />
              </div>

              <div className="space-y-3 max-w-md mx-auto">
                <button
                  onClick={handleAcceptNewRoll}
                  disabled={savingUpgrade}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-stone-700 text-white px-8 py-3 rounded-lg font-bold border border-orange-500 transition shadow-lg"
                >
                  {savingUpgrade ? 'Sauvegarde...' : 'Accepter le nouveau roll'}
                </button>

                {hadPreviousUpgrade && (
                  <button
                    onClick={handleKeepOldRoll}
                    disabled={savingUpgrade || !dungeonSummary?.runsRemaining}
                    className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 text-white px-8 py-3 rounded-lg font-bold border border-amber-500 transition shadow-lg"
                  >
                    {savingUpgrade ? 'Sauvegarde...' : `Conserver l'ancien roll (coûte 1 run)`}
                  </button>
                )}

                {hadPreviousUpgrade && !dungeonSummary?.runsRemaining && (
                  <p className="text-red-400 text-sm">Plus de runs pour conserver l'ancien roll.</p>
                )}
              </div>
            </>
          ) : (
            <div className="mb-6 max-w-md mx-auto">
              {upgradeChoice === 'new' ? (
                <div className="bg-stone-950/90 border border-orange-500/70 rounded-xl p-5 shadow-lg">
                  <p className="text-orange-300 font-bold mb-2">Nouveau roll appliqué !</p>
                  <UpgradeRollDisplay roll={newUpgradeRoll} label="Roll actif" isCurrent={false} />
                </div>
              ) : (
                <div className="bg-stone-950/90 border border-amber-500/70 rounded-xl p-5 shadow-lg">
                  <p className="text-amber-300 font-bold mb-2">Ancien roll conservé ! (1 run dépensé)</p>
                  <UpgradeRollDisplay roll={currentUpgrade} label="Roll actif" isCurrent={true} />
                </div>
              )}
            </div>
          )}

          {(alreadyChose || !hadPreviousUpgrade) && upgradeChoice !== null && (
            <button
              onClick={handleBackToLobby}
              className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 rounded-lg font-bold border border-stone-500 transition mt-4"
            >
              ← Retour à la forge
            </button>
          )}

          {!alreadyChose && !hadPreviousUpgrade && (
            <p className="text-stone-500 text-sm mt-2">Première forge — le roll sera automatiquement appliqué.</p>
          )}
        </div>
      </div>
    );
  }

  // Victory / Defeat end screen
  if (gameState === 'victory' || gameState === 'defeat') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <audio id="forge-music" loop>
          <source src="/assets/music/forge.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-2xl mx-auto pt-20 sm:pt-16 text-center">
          <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl p-10 shadow-lg">
            <div className="text-7xl mb-6">{gameState === 'victory' ? '🔨' : '💀'}</div>
            <h2 className={`text-3xl font-bold mb-4 ${gameState === 'victory' ? 'text-orange-400' : 'text-red-400'}`}>
              {gameState === 'victory' ? 'Victoire dans la Forge !' : 'Défaite...'}
            </h2>
            <p className="text-stone-300 mb-8">
              {gameState === 'victory' ? 'Votre arme est plus puissante.' : 'Ornn vous a broyé. Aucun upgrade cette fois.'}
            </p>
            <button onClick={handleBackToLobby} className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 rounded-lg font-bold border border-stone-500 transition">
              ← Retour à la forge
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Combat screen
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
        <audio id="forge-music" loop>
          <source src="/assets/music/forge.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-[1800px] mx-auto pt-20 sm:pt-16">
          {/* Boutons centrés en haut */}
          <div className="flex justify-center gap-3 md:gap-4 mb-6">
            {combatResult === null && (
              <button
                onClick={simulateCombat}
                disabled={isSimulating || !player || !boss}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-stone-700 disabled:text-stone-400 text-white px-6 py-3 rounded-lg font-bold text-sm md:text-base flex items-center justify-center gap-2 transition shadow-lg border border-orange-500"
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
              <div className="bg-orange-600/90 text-white px-8 py-3 rounded-xl font-bold text-xl animate-pulse shadow-2xl border border-orange-400">
                🔨 {player.name} forge sa victoire ! 🔨
              </div>
            </div>
          )}

          {combatResult === 'defeat' && (
            <div className="flex justify-center mb-4">
              <div className="bg-red-900/80 text-red-200 px-8 py-3 rounded-xl font-bold text-xl shadow-2xl border border-red-600">
                💀 {player.name} a été écrasé... 💀
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
              <div className="bg-stone-900/90 px-3 py-2 border-b border-orange-600/50 rounded-t-xl">
                <h2 className="text-sm font-bold text-orange-300 text-center">🔥 Forge des Légendes</h2>
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
                        if (log.includes('🏆') || log.includes('🔨')) return <div key={idx} className="flex justify-center my-2"><div className="bg-orange-600/90 text-white px-3 py-1.5 font-bold text-xs rounded-lg">{cleanLog}</div></div>;
                        if (log.includes('💀')) return <div key={idx} className="flex justify-center my-2"><div className="bg-red-900 text-red-200 px-3 py-1.5 font-bold text-xs rounded-lg">{cleanLog}</div></div>;
                        if (log.includes('---')) return <div key={idx} className="flex justify-center my-1"><div className="bg-stone-700 text-stone-200 px-2 py-0.5 text-[10px] font-bold rounded">{cleanLog}</div></div>;
                        return <div key={idx} className="text-center text-stone-400 text-[10px] italic">{cleanLog}</div>;
                      }
                      if (isP1) return <div key={idx} className="flex justify-start"><div className="max-w-[85%] bg-stone-700 text-stone-200 px-2 py-1 rounded border-l-2 border-blue-500 text-[11px]">{formatLogMessage(cleanLog)}</div></div>;
                      return <div key={idx} className="flex justify-end"><div className="max-w-[85%] bg-stone-700 text-stone-200 px-2 py-1 rounded border-r-2 border-orange-500 text-[11px]">{formatLogMessage(cleanLog)}</div></div>;
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
                <div className="bg-stone-900/90 p-3 border-b border-orange-600/50 rounded-t-xl">
                  <h2 className="text-xl font-bold text-orange-300 text-center">🔥 Forge des Légendes</h2>
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
                          if (log.includes('🏆') || log.includes('🔨')) {
                            return (
                              <div key={idx} className="flex justify-center my-4">
                                <div className="bg-orange-600/90 text-white px-6 py-3 rounded-lg font-bold text-lg shadow-lg border border-orange-400">
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
                                <div className="bg-stone-700/80 text-stone-200 px-4 py-2 rounded-lg shadow-lg border-r-4 border-orange-500">
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
            </div>

            <div className="w-auto flex-shrink-0">
              <BossCard bossChar={boss} combatBaseOverride={bossCombatBase} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lobby screen
  const bossImg = getForgeImage(FORGE_BOSS.imageFile);

  const LobbyBossCard = () => (
    <UnifiedCharacterCard
      header={`Boss • Forge des Légendes`}
      name={FORGE_BOSS.nom}
      image={bossImg}
      fallback={<span className="text-7xl">{FORGE_BOSS.icon}</span>}
      topStats={<><span>HP: {FORGE_BOSS.stats.hp}</span><span>VIT: {FORGE_BOSS.stats.spd}</span></>}
      mainStats={
        <>
          <div>Auto: {FORGE_BOSS.stats.auto}</div>
          <div>DEF: {FORGE_BOSS.stats.def}</div>
          <div>CAP: {FORGE_BOSS.stats.cap}</div>
          <div>RESC: {FORGE_BOSS.stats.rescap}</div>
        </>
      }
      details={
        <div className="flex items-start gap-2 bg-stone-700/50 p-2 rounded-lg text-xs border border-stone-600">
          <span className="text-lg">🔥</span>
          <div className="flex-1">
            <div className="text-orange-300 font-semibold mb-1">{FORGE_BOSS.ability.name} (CD {FORGE_BOSS.ability.cooldown})</div>
            <div className="text-stone-400 text-[10px]">{FORGE_BOSS.ability.description || 'Capacité spéciale du boss'}</div>
          </div>
        </div>
      }
      cardClassName=""
      borderId="lava"
    />
  );

  return (
    <div className="min-h-screen p-6">
      <Header />
      <audio id="forge-music" loop>
        <source src="/assets/music/forge.mp3" type="audio/mpeg" />
      </audio>
      <div className="max-w-5xl mx-auto pt-20 sm:pt-16">
        {/* Titre */}
        <div className="flex justify-center mb-6">
          <div className="bg-stone-950/85 border border-orange-600/80 rounded-lg px-8 py-3 shadow-lg">
            <h2 className="text-3xl md:text-4xl font-bold text-orange-400">🔨 Forge des Légendes</h2>
          </div>
        </div>

        {/* 1 - Essais disponibles */}
        <div className="bg-stone-950/85 border border-orange-600/60 rounded-xl p-5 mb-6 shadow-lg">
          <p className="text-orange-300 font-bold text-sm uppercase tracking-wider">Essais disponibles</p>
          <p className="text-white text-3xl font-bold mt-1">
            {dungeonSummary?.runsRemaining || 0}
          </p>
          <p className="text-stone-400 text-xs mt-1">1 run = 1 combat (garder ancien roll = +1 run)</p>
        </div>

        {/* Upgrade actif */}
        {hasAnyForgeUpgrade(currentUpgrade) && (
          <div className="bg-stone-950/85 border border-amber-600/60 rounded-xl p-4 mb-6 shadow-lg text-center">
            <p className="text-amber-400 font-bold text-sm uppercase tracking-wider mb-2">🔨 Upgrade actif</p>
            <div className="flex flex-wrap justify-center gap-4">
              {Object.entries(extractForgeUpgrade(currentUpgrade).bonuses).map(([statKey, pct]) => (
                <span key={`active-bonus-${statKey}`} className="text-green-400 font-semibold text-sm">
                  {UPGRADE_STAT_LABELS[statKey] || statKey.toUpperCase()} +{formatUpgradePct(pct)}
                </span>
              ))}
              {Object.entries(extractForgeUpgrade(currentUpgrade).penalties).map(([statKey, pct]) => (
                <span key={`active-penalty-${statKey}`} className="text-red-400 font-semibold text-sm">
                  {UPGRADE_STAT_LABELS[statKey] || statKey.toUpperCase()} -{formatUpgradePct(pct)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Erreurs */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-xl p-4 mb-6 text-center shadow-lg">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {!isLegendaryEquipped && (
          <div className="bg-red-950 border border-red-600 rounded-xl p-4 mb-6 text-center shadow-lg">
            <p className="text-red-300 font-bold">Vous devez équiper une arme légendaire pour accéder à la Forge.</p>
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-4 justify-center mb-6 flex-wrap">
          <CombatSpeedSelector value={combatSpeed} onChange={setCombatSpeed} label="Vitesse des combats" />
          <button
            onClick={handleStartRun}
            disabled={!isLegendaryEquipped || !dungeonSummary?.runsRemaining || isStartingRun}
            className={`px-10 py-4 rounded-lg font-bold text-lg transition shadow-lg ${
              isLegendaryEquipped && dungeonSummary?.runsRemaining > 0 && !isStartingRun
                ? 'bg-orange-600 hover:bg-orange-700 text-white border border-orange-500'
                : 'bg-stone-700 text-stone-500 cursor-not-allowed border border-stone-600'
            }`}
          >
            {isStartingRun ? 'Patientez...' : isLegendaryEquipped && dungeonSummary?.runsRemaining > 0 ? '⚔️ Défier Ornn' : 'Accès impossible'}
          </button>
          <button
            onClick={() => navigate('/dungeons')}
            className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-3 rounded-lg font-bold border border-stone-500 transition"
          >
            ← Retour aux donjons
          </button>
        </div>

        {/* Personnage gauche - Ornn droite */}
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

export default ForgeDungeon;
