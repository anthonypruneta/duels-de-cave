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
import UnifiedCharacterCard from './UnifiedCharacterCard';
import { preparerCombattant, simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { envoyerAnnonceDiscord } from '../services/discordService';

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
  const stats = formatWeaponStats(weapon);
  return (
    <span className="block whitespace-normal text-xs">
      <span className="block font-semibold text-white">{weapon.nom}</span>
      <span className="block text-stone-300">{weapon.description}</span>
      {weapon.effet && (
        <span className="block text-amber-200">
          Effet: {weapon.effet.nom} — {weapon.effet.description}
        </span>
      )}
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
  const [player, setPlayer] = useState(null);
  const [boss, setBoss] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [error, setError] = useState(null);
  const [dungeonSummary, setDungeonSummary] = useState(null);
  const logEndRef = useRef(null);
  const [isSoundOpen, setIsSoundOpen] = useState(false);
  const [volume, setVolume] = useState(0.05);
  const [isMuted, setIsMuted] = useState(false);

  // Upgrade state
  const [currentUpgrade, setCurrentUpgrade] = useState(null); // upgrade actuel du joueur
  const [newUpgradeRoll, setNewUpgradeRoll] = useState(null); // nouveau roll proposé
  const [upgradeChoice, setUpgradeChoice] = useState(null); // 'new' ou 'keep'
  const [savingUpgrade, setSavingUpgrade] = useState(false);

  const ensureForgeMusic = () => {
    const forgeMusic = document.getElementById('forge-music');
    if (forgeMusic) {
      forgeMusic.volume = volume;
      forgeMusic.muted = isMuted;
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

  useEffect(() => {
    if (!shouldAutoScrollLog()) return;
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

  const applyForgeVolume = () => {
    const forgeMusic = document.getElementById('forge-music');
    if (forgeMusic) {
      forgeMusic.volume = volume;
      forgeMusic.muted = isMuted;
    }
  };

  useEffect(() => {
    applyForgeVolume();
  }, [volume, isMuted, gameState]);

  const handleVolumeChange = (event) => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    if (isMuted && volume === 0) {
      setVolume(0.05);
    }
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
            <button
              type="button"
              onClick={toggleMute}
              className="text-lg"
              aria-label={isMuted ? 'Reactiver le son' : 'Couper le son'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
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

  useEffect(() => {
    if (gameState === 'lobby' || gameState === 'fighting') {
      ensureForgeMusic();
    }
    if (gameState === 'victory' || gameState === 'defeat') {
      stopForgeMusic();
    }
  }, [gameState]);

  // Cleanup music on unmount
  useEffect(() => {
    return () => stopForgeMusic();
  }, []);

  const isLegendaryEquipped = equippedWeapon?.rarete === RARITY.LEGENDAIRE;



  const handleStartRun = async () => {
    setError(null);
    setNewUpgradeRoll(null);
    setUpgradeChoice(null);

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
    setCombatLog([`⚔️ Forge des Legendes — ${playerReady.name} vs ${FORGE_BOSS.nom} !`]);
  };

  const simulateCombat = async () => {
    if (!player || !boss || isSimulating) return;
    setIsSimulating(true);
    setCombatResult(null);
    ensureForgeMusic();

    const p = { ...player };
    const b = { ...boss };
    const logs = [...combatLog, `--- Combat contre ${b.name} ---`];

    const matchResult = simulerMatch(character, createForgeBossCombatant());

    const finalLogs = await replayCombatSteps(matchResult.steps, {
      setCombatLog,
      onStepHP: (step) => {
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

      // Generer le nouveau roll d'upgrade
      const weaponId = character.equippedWeaponId || equippedWeapon?.id;
      const roll = generateForgeUpgradeRoll(weaponId);
      setNewUpgradeRoll(roll);
      setGameState('reward');
    } else {
      logs.push(`💀 ${player?.name ?? p.name} a été vaincu par ${boss?.name ?? b.name}...`);
      setCombatLog([...logs]);
      setCombatResult('defeat');
      setGameState('defeat');
    }

    setIsSimulating(false);
  };

  const handleAcceptNewRoll = async () => {
    if (!newUpgradeRoll) return;
    setSavingUpgrade(true);

    const weaponId = character?.equippedWeaponId || equippedWeapon?.id;
    const result = await saveWeaponUpgrade(currentUser.uid, { ...newUpgradeRoll, weaponId });
    if (result.success) {
      setCurrentUpgrade(newUpgradeRoll);
      setCharacter(prev => ({ ...prev, forgeUpgrade: newUpgradeRoll }));
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
      }
    } else {
      setError('Erreur lors de la sauvegarde de l\'upgrade.');
    }

    setSavingUpgrade(false);
  };

  const handleKeepOldRoll = async () => {
    // Coute 1 run supplementaire
    setSavingUpgrade(true);

    const runResult = await startDungeonRun(currentUser.uid);
    if (!runResult.success) {
      setError('Plus de runs disponibles pour conserver l\'ancien roll.');
      setSavingUpgrade(false);
      return;
    }

    // Refresh le summary
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
          const numRegex = /(\d+)\s*(points?\s*de\s*(?:vie|dégâts?|dommages?))/gi;
          let lastIndex = 0;
          let match;
          const subParts = [];

          while ((match = numRegex.exec(part)) !== null) {
            if (match.index > lastIndex) {
              subParts.push(part.slice(lastIndex, match.index));
            }
            const isHeal = match[2].toLowerCase().includes('vie');
            const colorClass = isHeal ? 'font-bold text-green-400' : 'font-bold text-red-400';
            subParts.push(<span key={`num-${key++}`} className={colorClass}>{match[1]}</span>);
            subParts.push(` ${match[2]}`);
            lastIndex = match.index + match[0].length;
          }

          if (lastIndex < part.length) {
            subParts.push(part.slice(lastIndex));
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
      <div className={`bg-stone-800 border p-4 text-center ${isCurrent ? 'border-amber-500' : 'border-orange-500'}`}>
        <div className="text-lg mb-2">{isCurrent ? '🛡️' : '🔥'}</div>
        <div className={`text-sm font-semibold mb-3 ${isCurrent ? 'text-amber-300' : 'text-orange-300'}`}>{label}</div>
        <div className="space-y-2">
          {Object.entries(bonuses).map(([statKey, pct]) => (
            <div key={`bonus-${statKey}`} className="text-green-400 font-semibold">
              {UPGRADE_STAT_LABELS[statKey] || statKey.toUpperCase()} +{formatUpgradePct(pct)}
            </div>
          ))}
          {Object.entries(penalties).map(([statKey, pct]) => (
            <div key={`penalty-${statKey}`} className="text-red-400 font-semibold">
              {UPGRADE_STAT_LABELS[statKey] || statKey.toUpperCase()} -{formatUpgradePct(pct)} (malus arme)
            </div>
          ))}
        </div>
      </div>
    );
  };

  const BossCard = ({ bossChar }) => {
    if (!bossChar) return null;
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
        topStats={<><span>HP: {bossChar.base.hp}</span><span>VIT: {bossChar.base.spd}</span></>}
        hpText={`${bossChar.name} — PV ${Math.max(0, bossChar.currentHP)}/${bossChar.maxHP}`}
        hpPercent={hpPercent}
        hpClass={hpClass}
        shieldPercent={shieldPercent}
        mainStats={
          <>
            <div>Auto: {bossChar.base.auto}</div>
            <div>DEF: {bossChar.base.def}</div>
            <div>CAP: {bossChar.base.cap}</div>
            <div>RESC: {bossChar.base.rescap}</div>
          </>
        }
        details={bossChar.ability ? (
          <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
            <span className="text-lg">🔥</span>
            <div className="flex-1">
              <div className="text-amber-300 font-semibold mb-1">{bossChar.ability.name}</div>
              <div className="text-stone-400 text-[10px]">{bossChar.ability.description}</div>
            </div>
          </div>
        ) : null}
        cardClassName="border-2 border-orange-600/50"
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <SoundControl />
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
    const hasExistingUpgrade = hasAnyForgeUpgrade(currentUpgrade);
    const alreadyChose = upgradeChoice !== null;

    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Header />
        <SoundControl />
        <audio id="forge-music" loop>
          <source src="/assets/music/forge.mp3" type="audio/mpeg" />
        </audio>
        <div className="bg-stone-800 border border-orange-600 p-8 max-w-2xl w-full text-center">
          <div className="text-6xl mb-4">🔨</div>
          <h2 className="text-3xl font-bold text-orange-400 mb-2">Ornn est vaincu !</h2>
          <p className="text-stone-300 mb-6">La forge produit une amelioration pour votre arme.</p>

          {!alreadyChose ? (
            <>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                {hasExistingUpgrade && (
                  <UpgradeRollDisplay
                    roll={currentUpgrade}
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

              <div className="space-y-3">
                <button
                  onClick={handleAcceptNewRoll}
                  disabled={savingUpgrade}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-stone-600 text-white px-8 py-3 font-bold border border-orange-500"
                >
                  {savingUpgrade ? 'Sauvegarde...' : 'Accepter le nouveau roll'}
                </button>

                {hasExistingUpgrade && (
                  <button
                    onClick={handleKeepOldRoll}
                    disabled={savingUpgrade || !dungeonSummary?.runsRemaining}
                    className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-stone-600 text-white px-8 py-3 font-bold border border-amber-500"
                  >
                    {savingUpgrade ? 'Sauvegarde...' : `Conserver l'ancien roll (coute 1 run)`}
                  </button>
                )}

                {hasExistingUpgrade && !dungeonSummary?.runsRemaining && (
                  <p className="text-red-400 text-sm">Plus de runs pour conserver l'ancien roll.</p>
                )}
              </div>
            </>
          ) : (
            <div className="mb-6">
              {upgradeChoice === 'new' ? (
                <div className="bg-orange-900/30 border border-orange-600 p-4">
                  <p className="text-orange-300 font-bold mb-2">Nouveau roll applique !</p>
                  <UpgradeRollDisplay roll={newUpgradeRoll} label="Roll actif" isCurrent={false} />
                </div>
              ) : (
                <div className="bg-amber-900/30 border border-amber-600 p-4">
                  <p className="text-amber-300 font-bold mb-2">Ancien roll conserve ! (1 run depense)</p>
                  <UpgradeRollDisplay roll={currentUpgrade} label="Roll actif" isCurrent={true} />
                </div>
              )}
            </div>
          )}

          {(alreadyChose || !hasExistingUpgrade) && upgradeChoice !== null && (
            <button
              onClick={handleBackToLobby}
              className="bg-stone-100 hover:bg-white text-stone-900 px-8 py-4 font-bold border-2 border-stone-400 mt-4"
            >
              Retour
            </button>
          )}

          {!alreadyChose && !hasExistingUpgrade && (
            <p className="text-stone-500 text-sm mt-2">Premiere forge — le roll sera automatiquement applique.</p>
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
        <SoundControl />
        <audio id="forge-music" loop>
          <source src="/assets/music/forge.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <div className="text-8xl mb-6">{gameState === 'victory' ? '🔨' : '💀'}</div>
          <h2 className={`text-4xl font-bold mb-4 ${gameState === 'victory' ? 'text-orange-400' : 'text-red-400'}`}>
            {gameState === 'victory' ? 'Victoire dans la Forge !' : 'Defaite...'}
          </h2>
          <p className="text-gray-300 mb-8">
            {gameState === 'victory' ? 'Votre arme est plus puissante.' : 'Ornn vous a broye. Aucun upgrade cette fois.'}
          </p>
          <button onClick={handleBackToLobby} className="bg-stone-100 hover:bg-white text-stone-900 px-8 py-4 font-bold border-2 border-stone-400">
            Retour
          </button>
        </div>
      </div>
    );
  }

  // Combat screen
  if (gameState === 'fighting') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <SoundControl />
        <audio id="forge-music" loop>
          <source src="/assets/music/forge.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-6xl mx-auto pt-20">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-stone-800 border border-orange-600 px-8 py-3">
              <h2 className="text-4xl font-bold text-orange-400">Forge des Legendes</h2>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
            <div className="order-1 md:order-1 w-full md:w-[340px] md:flex-shrink-0">
              <CharacterCardContent character={player} showHpBar />
            </div>

            <div className="order-2 md:order-2 w-full md:w-[600px] md:flex-shrink-0 flex flex-col">
              <div className="flex justify-center gap-3 md:gap-4 mb-4">
                {combatResult === null && (
                  <button
                    onClick={simulateCombat}
                    disabled={isSimulating || !player || !boss}
                    className="bg-stone-100 hover:bg-white disabled:bg-stone-600 disabled:text-stone-400 text-stone-900 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border-2 border-stone-400"
                  >
                    ▶️ Lancer le combat
                  </button>
                )}
                <button
                  onClick={handleBackToLobby}
                  className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border border-stone-500"
                >
                  ← Abandonner
                </button>
              </div>

              {combatResult === 'victory' && (
                <div className="flex justify-center mb-4">
                  <div className="bg-stone-100 text-stone-900 px-8 py-3 font-bold text-xl animate-pulse shadow-2xl border-2 border-stone-400">
                    🔨 {player.name} forge sa victoire ! 🔨
                  </div>
                </div>
              )}

              {combatResult === 'defeat' && (
                <div className="flex justify-center mb-4">
                  <div className="bg-red-900 text-red-200 px-8 py-3 font-bold text-xl shadow-2xl border-2 border-red-600">
                    💀 {player.name} a ete ecrase... 💀
                  </div>
                </div>
              )}

              <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[480px] md:h-[600px]">
                <div className="bg-stone-900 p-3 border-b border-orange-600/50">
                  <h2 className="text-lg md:text-2xl font-bold text-orange-300 text-center">🔥 Combat — Forge des Legendes</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
                  {combatLog.length === 0 ? (
                    <p className="text-stone-500 italic text-center py-6 md:py-8 text-xs md:text-sm">Cliquez sur "Lancer le combat" pour commencer...</p>
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
                                <div className="bg-stone-100 text-stone-900 px-6 py-3 font-bold text-lg shadow-lg border border-stone-400">
                                  {cleanLog}
                                </div>
                              </div>
                            );
                          }
                          if (log.includes('💀')) {
                            return (
                              <div key={idx} className="flex justify-center my-4">
                                <div className="bg-red-900 text-red-200 px-6 py-3 font-bold text-lg shadow-lg border border-red-600">
                                  {cleanLog}
                                </div>
                              </div>
                            );
                          }
                          if (log.includes('---') || log.includes('⚔️')) {
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
                              <div className="text-stone-400 text-sm italic">
                                {cleanLog}
                              </div>
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

                        if (isP2) {
                          return (
                            <div key={idx} className="flex justify-end">
                              <div className="max-w-[80%]">
                                <div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-r-4 border-orange-500">
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
            </div>

            <div className="order-3 md:order-3 w-full md:w-[340px] md:flex-shrink-0">
              <BossCard bossChar={boss} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lobby screen
  const bossImg = getForgeImage(FORGE_BOSS.imageFile);

  return (
    <div className="min-h-screen p-6">
      <Header />
      <SoundControl />
      <audio id="forge-music" loop>
        <source src="/assets/music/forge.mp3" type="audio/mpeg" />
      </audio>
      <div className="max-w-4xl mx-auto pt-20">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-stone-800 border border-orange-600 px-8 py-3">
            <h2 className="text-4xl font-bold text-orange-400">Forge des Legendes</h2>
          </div>
        </div>

        {/* Boss presentation */}
        <div className="bg-stone-800 border border-orange-600/50 p-6 mb-8 text-center">
          {bossImg && (
            <img
              src={bossImg}
              alt={FORGE_BOSS.nom}
              className="w-48 h-auto mx-auto mb-4 border-2 border-orange-600"
            />
          )}
          <h3 className="text-2xl font-bold text-orange-300 mb-2">{FORGE_BOSS.nom}</h3>
          <p className="text-stone-400 mb-4">Le dieu de la forge vous attend. Seuls les porteurs d'armes legendaires peuvent le defier.</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 max-w-lg mx-auto text-sm">
            {Object.entries(FORGE_BOSS.stats).map(([stat, val]) => (
              <div key={stat} className="bg-stone-900/60 border border-stone-700 p-2 text-center">
                <div className="text-orange-300 font-bold">{STAT_LABELS[stat]}</div>
                <div className="text-white">{val}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-stone-900/60 border border-orange-600/30 p-3 inline-block">
            <span className="text-orange-300 font-semibold">🔥 {FORGE_BOSS.ability.name}</span>
            <span className="text-stone-400 text-sm ml-2">— CD {FORGE_BOSS.ability.cooldown} tours</span>
          </div>
        </div>

        {/* Current upgrade display */}
        {hasAnyForgeUpgrade(currentUpgrade) && (
          <div className="bg-stone-800 border border-amber-600 p-4 mb-8">
            <h3 className="text-lg font-bold text-amber-400 mb-3 text-center">🔨 Upgrade actif</h3>
            <div className="flex flex-wrap justify-center gap-6">
              {Object.entries(extractForgeUpgrade(currentUpgrade).bonuses).map(([statKey, pct]) => (
                <span key={`active-bonus-${statKey}`} className="text-green-400 font-semibold">
                  {UPGRADE_STAT_LABELS[statKey] || statKey.toUpperCase()} +{formatUpgradePct(pct)}
                </span>
              ))}
              {Object.entries(extractForgeUpgrade(currentUpgrade).penalties).map(([statKey, pct]) => (
                <span key={`active-penalty-${statKey}`} className="text-red-400 font-semibold">
                  {UPGRADE_STAT_LABELS[statKey] || statKey.toUpperCase()} -{formatUpgradePct(pct)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Runs info */}
        <div className="bg-stone-800 border border-orange-600/50 p-4 mb-8 flex justify-between items-center">
          <div>
            <p className="text-orange-300 font-bold">Essais disponibles</p>
            <p className="text-white text-2xl">
              {dungeonSummary?.runsRemaining || 0}
            </p>
            <p className="text-stone-400 text-sm">1 run = 1 combat (garder ancien roll = +1 run)</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Arme legendaire</p>
            <p className={`font-bold ${isLegendaryEquipped ? 'text-amber-400' : 'text-red-400'}`}>
              {isLegendaryEquipped ? `${equippedWeapon.nom}` : 'Requise'}
            </p>
          </div>
        </div>

        {/* Errors */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 p-4 mb-6 text-center">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {!isLegendaryEquipped && (
          <div className="bg-red-900/30 border border-red-600 p-4 mb-6 text-center">
            <p className="text-red-300 font-bold">Vous devez equiper une arme legendaire pour acceder a la Forge des Legendes.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <button onClick={() => navigate('/dungeons')} className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 font-bold border border-stone-500">
            Retour
          </button>
          <button
            onClick={handleStartRun}
            disabled={!isLegendaryEquipped || !dungeonSummary?.runsRemaining}
            className={`px-12 py-4 font-bold text-xl ${
              isLegendaryEquipped && dungeonSummary?.runsRemaining > 0
                ? 'bg-orange-600 hover:bg-orange-700 text-white border border-orange-500'
                : 'bg-stone-700 text-stone-500 cursor-not-allowed border border-stone-600'
            }`}
          >
            {isLegendaryEquipped && dungeonSummary?.runsRemaining > 0 ? 'Defier Ornn' : 'Acces impossible'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgeDungeon;
