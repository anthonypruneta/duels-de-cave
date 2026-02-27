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
import UnifiedCharacterCard from './UnifiedCharacterCard';
import SharedTooltip from './SharedTooltip';
import { preparerCombattant, simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { envoyerAnnonceDiscord } from '../services/discordService';

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
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [error, setError] = useState(null);
  const [dungeonSummary, setDungeonSummary] = useState(null);
  const logEndRef = useRef(null);
  const [isSoundOpen, setIsSoundOpen] = useState(false);
  const [volume, setVolume] = useState(0.05);
  const [isMuted, setIsMuted] = useState(false);

  const [rolledExtensionPassive, setRolledExtensionPassive] = useState(null);
  const [extensionChoice, setExtensionChoice] = useState(null);
  const [savingChoice, setSavingChoice] = useState(false);
  const [showUpgradeAnimation, setShowUpgradeAnimation] = useState(false);

  const hasExistingExtension = !!character?.mageTowerExtensionPassive;

  const shouldAutoScrollLog = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(min-width: 768px)').matches;
  };

  useEffect(() => {
    if (!shouldAutoScrollLog()) return;
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

  const ensureExtensionMusic = () => {
    const el = document.getElementById('extension-music');
    if (el) {
      el.volume = volume;
      el.muted = isMuted;
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

  const applyExtensionVolume = () => {
    const el = document.getElementById('extension-music');
    if (el) {
      el.volume = volume;
      el.muted = isMuted;
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

  useEffect(() => {
    applyExtensionVolume();
  }, [volume, isMuted, gameState]);

  useEffect(() => {
    return () => stopExtensionMusic();
  }, []);

  const handleVolumeChange = (e) => {
    const v = Number(e.target.value);
    setVolume(v);
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    if (isMuted && volume === 0) setVolume(0.05);
  };

  const SoundControl = () => (
    <div className="fixed top-20 right-4 z-50 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setIsSoundOpen((prev) => !prev)}
        className="bg-violet-600 text-white border border-violet-400 px-3 py-2 text-sm font-bold shadow-lg hover:bg-violet-500"
      >
        {isMuted || volume === 0 ? '🔇' : '🔊'} Son
      </button>
      {isSoundOpen && (
        <div className="bg-stone-900 border border-stone-600 p-3 w-56 shadow-xl">
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleMute} className="text-lg" aria-label={isMuted ? 'Réactiver le son' : 'Couper le son'}>
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full accent-violet-500"
            />
            <span className="text-xs text-stone-200 w-10 text-right">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );

  const canAccess = character && canAccessExtensionDungeon(character.mageTowerPassive);

  const handleStartRun = async () => {
    setError(null);
    setRolledExtensionPassive(null);
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
    setCombatLog([`⚔️ Extension du Territoire — ${playerReady.name} vs ${EXTENSION_BOSS.nom} !`]);
  };

  const simulateCombat = async () => {
    if (!player || !boss || isSimulating) return;
    setIsSimulating(true);
    setCombatResult(null);
    setPlayerCombatBase(null);
    setBossCombatBase(null);
    ensureExtensionMusic();
    const p = { ...player };
    const b = { ...boss };
    const logs = [...combatLog, `--- Combat contre ${b.name} ---`];
    const matchResult = simulerMatch(character, createExtensionBossCombatant());
    const finalLogs = await replayCombatSteps(matchResult.steps, {
      setCombatLog,
      onStepHP: (step) => {
        setPlayerCombatBase(step.p1Base ?? undefined);
        setBossCombatBase(step.p2Base ?? undefined);
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
      setGameState('reward');
    } else {
      logs.push(`💀 ${player?.name ?? p.name} a été vaincu par ${boss?.name ?? b.name}...`);
      setCombatLog([...logs]);
      setCombatResult('defeat');
      setGameState('defeat');
    }
    setIsSimulating(false);
  };

  const handleAcceptNewPassive = async () => {
    if (!rolledExtensionPassive) return;
    setSavingChoice(true);
    const newExtension = { id: rolledExtensionPassive.id, level: rolledExtensionPassive.level ?? 1 };
    const result = await updateCharacterMageTowerExtensionPassive(currentUser.uid, newExtension);
    if (result.success) {
      setCharacter((prev) => (prev ? { ...prev, mageTowerExtensionPassive: newExtension } : prev));
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
      }
    } else {
      setError('Erreur lors de la sauvegarde du passif.');
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
                  <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600 cursor-help">
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
        cardClassName="border-2 border-violet-600/50"
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <SoundControl />
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
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Header />
        <SoundControl />
        <audio id="extension-music" loop>
          <source src="/assets/music/extension.mp3" type="audio/mpeg" />
        </audio>
        <div className="bg-stone-800 border border-violet-600 p-8 max-w-2xl w-full text-center">
          <div className="text-6xl mb-4">👁️</div>
          <h2 className="text-3xl font-bold text-violet-400 mb-2">Satoru Gojo est vaincu !</h2>
          <p className="text-stone-300 mb-6">Extension du Territoire : vous avez obtenu un passif aléatoire (niveau 1, 2 ou 3 selon le drop).</p>

          {showUpgradeAnimation && rolledExtensionPassive && (
            <div
              className="mb-6 py-6 px-4 rounded-lg border-2 animate-pulse"
              style={{
                background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, rgba(239, 68, 68, 0.2) 50%, rgba(139, 92, 246, 0.2) 100%)',
                borderColor: 'rgba(139, 92, 246, 0.8)',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.3), 0 0 20px rgba(239, 68, 68, 0.3), 0 0 20px rgba(139, 92, 246, 0.3)'
              }}
            >
              <p className="text-white font-bold text-lg">✨ Passif étendu — Bleu, Rouge, Violet ✨</p>
              <p className="text-stone-300 text-sm mt-2">
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
              <div className="mb-6 space-y-4">
                {hasExistingExtension && (() => {
                  const oldExt = character.mageTowerExtensionPassive;
                  const oldDetails = getPassiveDetails(oldExt);
                  const oldMixedName = getMixedPassiveDisplayName(primaryPassive?.id, oldExt?.id) || (oldDetails && `${primaryDetails?.name ?? ''} + ${oldDetails.name}`);
                  return oldDetails ? (
                    <div className="p-4 bg-amber-900/20 border border-amber-600/60 rounded text-left">
                      <p className="text-amber-300 font-semibold mb-1">🟡 Ancien second passif (actuel)</p>
                      <p className="text-white font-medium">{oldMixedName} — Niv.{oldExt?.level ?? 1}</p>
                      <p className="text-stone-400 text-sm mt-2">{oldDetails.levelData?.description ?? '—'}</p>
                    </div>
                  ) : null;
                })()}
                {(() => {
                  const newLevelData = getMageTowerPassiveLevel(rolledExtensionPassive.id, rolledExtensionPassive.level ?? 1);
                  const newMixedName = getMixedPassiveDisplayName(primaryPassive?.id, rolledExtensionPassive.id) || `${primaryDetails?.name ?? ''} + ${getMageTowerPassiveById(rolledExtensionPassive.id)?.name ?? rolledExtensionPassive.name}`;
                  return (
                    <div className="p-4 bg-violet-900/20 border border-violet-600/60 rounded text-left">
                      <p className="text-violet-300 font-semibold mb-1">🟣 Nouveau second passif (récompense)</p>
                      <p className="text-white font-medium">{newMixedName} — Niv.{rolledExtensionPassive.level ?? 1}</p>
                      <p className="text-stone-400 text-sm mt-2">{newLevelData?.description ?? '—'}</p>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleAcceptNewPassive}
                  disabled={savingChoice}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-stone-600 text-white px-8 py-3 font-bold border border-violet-500"
                >
                  {savingChoice ? 'Sauvegarde...' : 'Accepter le nouveau passif'}
                </button>
                {hasExistingExtension && (
                  <button
                    onClick={handleKeepOldCombo}
                    disabled={savingChoice || !dungeonSummary?.runsRemaining}
                    className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-stone-600 text-white px-8 py-3 font-bold border border-amber-500"
                  >
                    {savingChoice ? 'Sauvegarde...' : "Conserver l'ancienne combinaison (coûte 1 run)"}
                  </button>
                )}
                {hasExistingExtension && !dungeonSummary?.runsRemaining && (
                  <p className="text-red-400 text-sm">Plus de runs pour conserver l'ancienne combinaison.</p>
                )}
              </div>
            </>
          ) : alreadyChose ? (
            <div className="mb-6">
              {extensionChoice === 'new' && rolledExtensionPassive ? (
                <div className="bg-violet-900/30 border border-violet-600 p-4">
                  <p className="text-violet-300 font-bold mb-2">Nouveau passif ajouté !</p>
                  <p className="text-white">
                    {mixedName || `${primaryDetails?.name} (Niv.3) + ${getMageTowerPassiveById(rolledExtensionPassive.id)?.name} (Niv.${rolledExtensionPassive?.level ?? 1})`}
                  </p>
                </div>
              ) : (
                <div className="bg-amber-900/30 border border-amber-600 p-4">
                  <p className="text-amber-300 font-bold mb-2">Ancienne combinaison conservée (1 run dépensé)</p>
                </div>
              )}
            </div>
          ) : null}

          {(extensionChoice !== null || !rolledExtensionPassive) && (
            <button
              onClick={handleBackToLobby}
              className="bg-stone-100 hover:bg-white text-stone-900 px-8 py-4 font-bold border-2 border-stone-400 mt-4"
            >
              Retour
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
        <SoundControl />
        <audio id="extension-music" loop>
          <source src="/assets/music/extension.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <div className="text-8xl mb-6">{gameState === 'victory' ? '👁️' : '💀'}</div>
          <h2 className={`text-4xl font-bold mb-4 ${gameState === 'victory' ? 'text-violet-400' : 'text-red-400'}`}>
            {gameState === 'victory' ? 'Victoire !' : 'Défaite...'}
          </h2>
          <p className="text-gray-300 mb-8">
            {gameState === 'victory' ? 'Choisissez votre récompense.' : 'Gojo vous a dominé.'}
          </p>
          <button onClick={handleBackToLobby} className="bg-stone-100 hover:bg-white text-stone-900 px-8 py-4 font-bold border-2 border-stone-400">
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'fighting') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <SoundControl />
        <audio id="extension-music" loop>
          <source src="/assets/music/extension.mp3" type="audio/mpeg" />
        </audio>
        <div className="max-w-6xl mx-auto pt-20">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-stone-800 border border-violet-600 px-8 py-3">
              <h2 className="text-4xl font-bold text-violet-400">Extension du Territoire</h2>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
            <div className="order-1 md:order-1 w-full md:w-[340px] md:flex-shrink-0">
              <CharacterCardContent character={player} showHpBar combatBaseOverride={playerCombatBase} />
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
                    👁️ {player.name} étend son territoire ! 👁️
                  </div>
                </div>
              )}
              {combatResult === 'defeat' && (
                <div className="flex justify-center mb-4">
                  <div className="bg-red-900 text-red-200 px-8 py-3 font-bold text-xl shadow-2xl border-2 border-red-600">
                    💀 {player.name} a été dominé...
                  </div>
                </div>
              )}

              <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[480px] md:h-[600px]">
                <div className="bg-stone-900 p-3 border-b border-violet-600/50">
                  <h2 className="text-lg md:text-2xl font-bold text-violet-300 text-center">👁️ Combat — Extension du Territoire</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {combatLog.length === 0 ? (
                    <p className="text-stone-500 italic text-center py-6 md:py-8 text-xs md:text-sm">Cliquez sur "Lancer le combat" pour commencer...</p>
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
                                <div className="bg-stone-100 text-stone-900 px-6 py-3 font-bold text-lg shadow-lg border border-stone-400">{cleanLog}</div>
                              </div>
                            );
                          }
                          if (log.includes('💀')) {
                            return (
                              <div key={idx} className="flex justify-center my-4">
                                <div className="bg-red-900 text-red-200 px-6 py-3 font-bold text-lg shadow-lg border border-red-600">{cleanLog}</div>
                              </div>
                            );
                          }
                          if (log.includes('---') || log.includes('⚔️')) {
                            return (
                              <div key={idx} className="flex justify-center my-3">
                                <div className="bg-stone-700 text-stone-200 px-4 py-1 text-sm font-bold border border-stone-500">{cleanLog}</div>
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
                              <div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-r-4 border-violet-500">
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

            <div className="order-3 md:order-3 w-full md:w-[340px] md:flex-shrink-0">
              <BossCard bossChar={boss} combatBaseOverride={bossCombatBase} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const bossImg = getExtensionImage(EXTENSION_BOSS.imageFile);

  return (
    <div className="min-h-screen p-6">
      <Header />
      <SoundControl />
      <audio id="extension-music" loop>
        <source src="/assets/music/extension.mp3" type="audio/mpeg" />
      </audio>
      <div className="max-w-4xl mx-auto pt-20">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-stone-800 border border-violet-600 px-8 py-3">
            <h2 className="text-4xl font-bold text-violet-400">Extension du Territoire</h2>
          </div>
        </div>

        <div className="bg-stone-800 border border-violet-600/50 p-6 mb-8 text-center">
          {bossImg && (
            <img
              src={bossImg}
              alt={EXTENSION_BOSS.nom}
              className="w-48 h-auto mx-auto mb-4 border-2 border-violet-600"
            />
          )}
          <h3 className="text-2xl font-bold text-violet-300 mb-2">{EXTENSION_BOSS.nom}</h3>
          <p className="text-stone-400 mb-2">Accédez à un second passif (niveau 1, 2 ou 3). Obligation d'avoir un passif Tour du Mage niveau 3.</p>
          <p className="text-stone-500 text-sm mb-4">Taux de drop : {EXTENSION_LEVEL_DROP_LABEL}</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 max-w-lg mx-auto text-sm">
            {Object.entries(EXTENSION_BOSS.stats).map(([stat, val]) => (
              <div key={stat} className="bg-stone-900/60 border border-stone-700 p-2 text-center">
                <div className="text-violet-300 font-bold">{STAT_LABELS[stat]}</div>
                <div className="text-white">{val}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[2, 4, 6].map((t) => {
              const spell = EXTENSION_BOSS.spells[t];
              const emoji = spell.color === 'bleu' ? '🔵' : spell.color === 'rouge' ? '🔴' : '🟣';
              return (
                <SharedTooltip
                  key={t}
                  content={
                    <span className="whitespace-normal block text-left max-w-[220px]">
                      {spell.description}
                    </span>
                  }
                >
                  <div className="bg-stone-900/60 border border-violet-600/30 px-3 py-2 cursor-help">
                    <span className="text-violet-300 font-semibold">{emoji} Tour {t}: {spell.name}</span>
                  </div>
                </SharedTooltip>
              );
            })}
          </div>
        </div>

        {character.mageTowerExtensionPassive && (() => {
          const fused = getFusedPassiveDisplayData(character);
          return (
            <div className="bg-stone-800 border border-violet-600 p-4 mb-8">
              <h3 className="text-lg font-bold text-violet-400 mb-3 text-center">👁️ Extension actuelle</h3>
              <div className="flex flex-wrap justify-center gap-4 items-center">
                {fused ? (
                  <SharedTooltip
                    content={
                      <span className="whitespace-normal block text-left max-w-[260px]">
                        <span className="text-amber-300 font-semibold">{fused.primaryDetails.icon} {fused.primaryDetails.name}</span>
                        <span className="text-stone-400"> — Niv.{fused.primaryDetails.level} (principal)</span>
                        <br />
                        <span className="text-violet-300 font-semibold">{fused.extensionDetails.icon} {fused.extensionDetails.name}</span>
                        <span className="text-stone-400"> — Niv.{fused.extensionDetails.level} (extension)</span>
                      </span>
                    }
                  >
                    <span className="text-amber-300 font-semibold cursor-help">
                      {fused.primaryDetails.icon} {fused.displayLabel}
                    </span>
                  </SharedTooltip>
                ) : (
                  <>
                    {getPassiveDetails(character.mageTowerPassive) && (
                      <span className="text-amber-300 font-semibold">
                        {getPassiveDetails(character.mageTowerPassive).icon} {getPassiveDetails(character.mageTowerPassive).name} (Niv.3)
                      </span>
                    )}
                    <span className="text-stone-500">+</span>
                    {getPassiveDetails(character.mageTowerExtensionPassive) && (
                      <span className="text-violet-300 font-semibold">
                        {getPassiveDetails(character.mageTowerExtensionPassive).icon} {getPassiveDetails(character.mageTowerExtensionPassive).name} (Niv.{character.mageTowerExtensionPassive?.level ?? 1})
                      </span>
                    )}
                  </>
                )}
              </div>
              {fused && (
                <p className="text-stone-400 text-sm mt-2 text-center">
                  Niv.{fused.primaryDetails.level} (principal) + Niv.{fused.extensionDetails.level} (extension, 1 à 3)
                </p>
              )}
            </div>
          );
        })()}

        <div className="bg-stone-800 border border-violet-600/50 p-4 mb-8 flex justify-between items-center">
          <div>
            <p className="text-violet-300 font-bold">Essais disponibles</p>
            <p className="text-white text-2xl">{dungeonSummary?.runsRemaining ?? 0}</p>
            <p className="text-stone-400 text-sm">1 run = 1 combat (garder ancienne combinaison = +1 run)</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Passif Tour du Mage</p>
            <p className={`font-bold ${canAccess ? 'text-amber-400' : 'text-red-400'}`}>
              {canAccess ? `Niveau 3 — ${getMageTowerPassiveById(character.mageTowerPassive?.id)?.name}` : 'Niveau 3 requis'}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-600 p-4 mb-6 text-center">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {!canAccess && (
          <div className="bg-red-900/30 border border-red-600 p-4 mb-6 text-center">
            <p className="text-red-300 font-bold">Vous devez avoir un passif Tour du Mage niveau 3 pour accéder à l'Extension du Territoire.</p>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate('/dungeons')}
            className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 font-bold border border-stone-500"
          >
            Retour
          </button>
          <button
            onClick={handleStartRun}
            disabled={!canAccess || !dungeonSummary?.runsRemaining}
            className={`px-12 py-4 font-bold text-xl ${
              canAccess && dungeonSummary?.runsRemaining > 0
                ? 'bg-violet-600 hover:bg-violet-700 text-white border border-violet-500'
                : 'bg-stone-700 text-stone-500 cursor-not-allowed border border-stone-600'
            }`}
          >
            {canAccess && dungeonSummary?.runsRemaining > 0 ? 'Défier Satoru Gojo' : 'Accès impossible'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExtensionDungeon;
