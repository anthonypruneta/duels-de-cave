/**
 * Donjon Collège Kunugigaoka — Débloquer une sous-classe.
 * Niveau 400 requis. Consomme les mêmes runs que les autres donjons (bloqué jusqu'au lundi après le tournoi).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter, updateCharacterSubclass } from '../services/characterService';
import { getPlayerDungeonSummary, startDungeonRun } from '../services/dungeonService';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import {
  SUBCLASS_DUNGEON_NAME,
  SUBCLASS_DUNGEON_LEVEL_REQUIRED,
  SUBCLASS_BOSS,
  createSubclassBossCombatant,
} from '../data/subclassDungeon';
import { getSubclassesForClass } from '../data/subclasses';
import { preparerCombattant, simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { isSubclassDungeonVisible } from '../data/featureFlags';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';

const subclassImageModules = import.meta.glob('../assets/subclass/*.png', { eager: true, import: 'default' });
const getSubclassImage = (imageFile) => {
  if (!imageFile) return null;
  return subclassImageModules[`../assets/subclass/${imageFile}`] || null;
};

const STAT_LABELS = { hp: 'HP', auto: 'Auto', def: 'DEF', cap: 'CAP', rescap: 'RESC', spd: 'VIT' };

const SubclassDungeon = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [gameState, setGameState] = useState('lobby');
  const [player, setPlayer] = useState(null);
  const [boss, setBoss] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [error, setError] = useState(null);
  const [dungeonSummary, setDungeonSummary] = useState(null);
  const [selectedSubclass, setSelectedSubclass] = useState(null);
  const [savingSubclass, setSavingSubclass] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    if (!isSubclassDungeonVisible()) {
      navigate('/dungeons', { replace: true });
      return;
    }
    const loadData = async () => {
      setLoading(true);
      const charResult = await getUserCharacter(currentUser.uid);
      if (!charResult.success || !charResult.data) {
        navigate('/');
        setLoading(false);
        return;
      }
      const characterData = charResult.data;
      const level = characterData.level ?? 1;
      const forestBoosts = { ...getEmptyStatBoosts(), ...(characterData.forestBoosts || {}) };
      setCharacter(normalizeCharacterBonuses({
        ...characterData,
        forestBoosts,
        level,
        equippedWeaponData: characterData.equippedWeaponData ?? null,
        equippedWeaponId: characterData.equippedWeaponId ?? null,
      }));
      const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
      if (summaryResult.success) setDungeonSummary(summaryResult.data);
      setLoading(false);
    };
    loadData();
  }, [currentUser, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (window.matchMedia('(min-width: 768px)').matches) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

  const characterLevel = character?.level ?? 1;
  const canAccess = character && characterLevel >= SUBCLASS_DUNGEON_LEVEL_REQUIRED && (dungeonSummary?.runsRemaining ?? 0) > 0;

  const handleStartRun = async () => {
    setError(null);
    setSelectedSubclass(null);
    const result = await startDungeonRun(currentUser.uid);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setGameState('fighting');
    setCombatResult(null);
    setIsSimulating(false);
    const playerReady = preparerCombattant(character);
    const bossReady = preparerCombattant(createSubclassBossCombatant());
    setPlayer(playerReady);
    setBoss(bossReady);
    setCombatLog([`⚔️ ${SUBCLASS_DUNGEON_NAME} — ${playerReady.name} vs ${SUBCLASS_BOSS.nom} !`]);
  };

  const simulateCombat = async () => {
    if (!player || !boss || isSimulating) return;
    setIsSimulating(true);
    setCombatResult(null);
    const logs = [...combatLog, `--- Combat contre ${boss.name} ---`];
    const matchResult = simulerMatch(character, createSubclassBossCombatant());
    const finalLogs = await replayCombatSteps(matchResult.steps, {
      setCombatLog,
      onStepHP: (step) => {
        setPlayer((prev) => prev ? { ...prev, currentHP: step.p1HP, shield: step.p1Shield ?? 0 } : null);
        setBoss((prev) => prev ? { ...prev, currentHP: step.p2HP, shield: step.p2Shield ?? 0 } : null);
      },
      existingLogs: logs,
      speed: 'normal',
    });
    logs.length = 0;
    logs.push(...finalLogs);
    const lastStep = matchResult.steps[matchResult.steps.length - 1];
    const playerWon = lastStep && lastStep.p1HP > 0;
    if (playerWon) {
      logs.push(`🏆 ${player?.name} terrasse ${boss?.name} !`);
      setCombatLog([...logs]);
      setCombatResult('victory');
      setGameState('reward');
    } else {
      logs.push(`💀 ${player?.name} a été vaincu par ${boss?.name}...`);
      setCombatLog([...logs]);
      setCombatResult('defeat');
      setGameState('defeat');
    }
    setIsSimulating(false);
  };

  const handleChooseSubclass = async (sub) => {
    if (!sub) return;
    setSavingSubclass(true);
    const result = await updateCharacterSubclass(currentUser.uid, { id: sub.id, name: sub.name });
    if (result.success) {
      setCharacter((prev) => (prev ? { ...prev, subclass: { id: sub.id, name: sub.name } } : prev));
      setSelectedSubclass(sub.id);
    } else {
      setError(result.error || 'Erreur lors de la sauvegarde de la sous-classe.');
    }
    setSavingSubclass(false);
  };

  const handleBackToLobby = () => {
    setGameState('lobby');
    setPlayer(null);
    setBoss(null);
    setCombatLog([]);
    setCombatResult(null);
    setSelectedSubclass(null);
  };

  const formatLogMessage = (text) => {
    if (!player || !boss) return text;
    const pName = player.name;
    const bName = boss.name;
    const nameRegex = new RegExp(`(${pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
    return text.split(nameRegex).map((part, i) => {
      if (part === pName) return <span key={i} className="font-bold text-blue-400">{part}</span>;
      if (part === bName) return <span key={i} className="font-bold text-amber-400">{part}</span>;
      return part;
    });
  };

  const BossCard = ({ bossChar }) => {
    if (!bossChar) return null;
    const hpPercent = Math.max(0, Math.min(100, (bossChar.currentHP / bossChar.maxHP) * 100));
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const bossImg = getSubclassImage(bossChar.imageFile);
    return (
      <div className="bg-stone-800 border border-amber-600/50 p-4 rounded-lg">
        <div className="flex items-center gap-3">
          {bossImg && <img src={bossImg} alt={bossChar.name} className="w-16 h-16 object-contain" />}
          <div className="flex-1">
            <div className="text-xs text-stone-400 mb-1">{bossChar.name} — PV {Math.max(0, bossChar.currentHP)}/{bossChar.maxHP}</div>
            <div className="w-full bg-stone-700 rounded-full h-2">
              <div className={`h-2 rounded-full ${hpClass}`} style={{ width: `${hpPercent}%` }} />
            </div>
          </div>
        </div>
        {bossChar.ability && (
          <div className="text-stone-400 text-[10px] mt-2">{bossChar.ability.description}</div>
        )}
      </div>
    );
  };

  const subclassesOptions = character?.class ? getSubclassesForClass(character.class) : [];

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-4xl mx-auto pt-20 text-center text-amber-400 text-2xl">Chargement du Collège...</div>
      </div>
    );
  }

  if (!character) {
    return null;
  }

  // Écran de combat (fighting) puis simulation
  if (gameState === 'fighting' && player && boss) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-4xl mx-auto pt-20">
          <h2 className="text-2xl font-bold text-amber-400 mb-4 text-center">Combat — {SUBCLASS_DUNGEON_NAME}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-stone-800 border border-blue-600/50 p-4 rounded-lg">
              <CharacterCardContent character={character} />
              <div className="mt-2 text-sm">
                <span className="text-blue-400 font-bold">PV {Math.max(0, player.currentHP)}/{player.maxHP}</span>
                {(player.shield ?? 0) > 0 && <span className="text-stone-400"> • Bouclier {player.shield}</span>}
              </div>
            </div>
            <BossCard bossChar={boss} />
          </div>
          <div className="bg-stone-900 border border-stone-600 p-4 rounded-lg max-h-64 overflow-y-auto mb-6">
            {combatLog.map((line, i) => (
              <div key={i} className="text-sm text-stone-300 mb-1">{formatLogMessage(line)}</div>
            ))}
            <div ref={logEndRef} />
          </div>
          {!combatResult && (
            <div className="text-center">
              <button
                onClick={simulateCombat}
                disabled={isSimulating}
                className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 font-bold border border-amber-500 disabled:opacity-50"
              >
                {isSimulating ? 'Combat en cours...' : 'Lancer le combat'}
              </button>
            </div>
          )}
          {combatResult && (
            <div className="flex justify-center gap-4">
              <button onClick={handleBackToLobby} className="bg-stone-600 hover:bg-stone-500 text-white px-8 py-4 font-bold border border-stone-500">
                Retour au lobby
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Écran défaite
  if (gameState === 'defeat') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-4xl mx-auto pt-20 text-center">
          <h2 className="text-3xl font-bold text-red-400 mb-4">Défaite</h2>
          <p className="text-stone-300 mb-6">{SUBCLASS_BOSS.nom} vous a vaincu. Réessayez plus tard.</p>
          <button onClick={handleBackToLobby} className="bg-stone-600 hover:bg-stone-500 text-white px-8 py-4 font-bold border border-stone-500">
            Retour au lobby
          </button>
        </div>
      </div>
    );
  }

  // Écran récompense : choix de la sous-classe
  if (gameState === 'reward' && subclassesOptions.length > 0) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-4xl mx-auto pt-20">
          <h2 className="text-3xl font-bold text-amber-400 mb-2 text-center">Victoire !</h2>
          <p className="text-stone-300 text-center mb-6">Choisissez votre sous-classe pour la classe {character.class}.</p>
          {error && (
            <div className="bg-red-900/50 border border-red-600 p-4 mb-6 text-center">
              <p className="text-red-300">{error}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {subclassesOptions.map((sub) => (
              <button
                key={sub.id}
                onClick={() => handleChooseSubclass(sub)}
                disabled={savingSubclass || selectedSubclass != null}
                className="bg-stone-800 border-2 border-amber-600 hover:border-amber-500 p-6 text-left rounded-lg disabled:opacity-70 transition-all"
              >
                <div className="font-bold text-amber-300 text-xl mb-2">{sub.name}</div>
                {sub.bonus && <div className="text-green-400 text-sm mb-2">{sub.bonus}</div>}
                <div className="text-stone-400 text-sm">{sub.abilityLabel}</div>
                <div className="text-stone-500 text-xs mt-2">{sub.description}</div>
                {selectedSubclass === sub.id && <div className="text-amber-400 font-bold mt-2">✓ Choisi</div>}
              </button>
            ))}
          </div>
          {selectedSubclass != null && (
            <div className="text-center">
              <button
                onClick={() => navigate('/dungeons')}
                className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 font-bold border border-amber-500"
              >
                Retour aux donjons
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Lobby
  const bossImg = getSubclassImage(SUBCLASS_BOSS.imageFile);
  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-4xl mx-auto pt-20">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-stone-800 border border-amber-600 px-8 py-3">
            <h2 className="text-4xl font-bold text-amber-400">{SUBCLASS_DUNGEON_NAME}</h2>
          </div>
        </div>

        <div className="bg-stone-800 border border-amber-600/50 p-6 mb-8 text-center">
          {bossImg && (
            <img src={bossImg} alt={SUBCLASS_BOSS.nom} className="w-48 h-auto mx-auto mb-4 border-2 border-amber-600" />
          )}
          <h3 className="text-2xl font-bold text-amber-300 mb-2">{SUBCLASS_BOSS.nom}</h3>
          <p className="text-stone-400 mb-4">Vainquez l'entraîneur pour débloquer une sous-classe de votre classe. Niveau {SUBCLASS_DUNGEON_LEVEL_REQUIRED} requis.</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 max-w-lg mx-auto text-sm mb-4">
            {Object.entries(SUBCLASS_BOSS.stats).map(([stat, val]) => (
              <div key={stat} className="bg-stone-900/60 border border-stone-700 p-2 text-center">
                <div className="text-amber-300 font-bold">{STAT_LABELS[stat]}</div>
                <div className="text-white">{val}</div>
              </div>
            ))}
          </div>
          <div className="text-amber-200 font-semibold">🎓 {SUBCLASS_BOSS.ability.name}</div>
          <div className="text-stone-400 text-sm">CD {SUBCLASS_BOSS.ability.cooldown} tours — {SUBCLASS_BOSS.ability.description}</div>
        </div>

        {character.subclass && (
          <div className="bg-stone-800 border border-amber-600 p-4 mb-8 text-center">
            <h3 className="text-lg font-bold text-amber-400 mb-2">Sous-classe actuelle</h3>
            <p className="text-amber-300 font-semibold">{character.subclass.name} — {character.class}</p>
          </div>
        )}

        <div className="bg-stone-800 border border-amber-600/50 p-4 mb-8 flex justify-between items-center">
          <div>
            <p className="text-amber-300 font-bold">Essais disponibles</p>
            <p className="text-white text-2xl">{dungeonSummary?.runsRemaining ?? 0}</p>
            <p className="text-stone-400 text-sm">1 run = 1 combat</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Niveau requis</p>
            <p className={`font-bold ${characterLevel >= SUBCLASS_DUNGEON_LEVEL_REQUIRED ? 'text-amber-400' : 'text-red-400'}`}>
              {characterLevel >= SUBCLASS_DUNGEON_LEVEL_REQUIRED ? `Niveau ${characterLevel}` : `Niveau ${SUBCLASS_DUNGEON_LEVEL_REQUIRED} requis (vous : ${characterLevel})`}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-600 p-4 mb-6 text-center">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {characterLevel < SUBCLASS_DUNGEON_LEVEL_REQUIRED && (
          <div className="bg-red-900/30 border border-red-600 p-4 mb-6 text-center">
            <p className="text-red-300 font-bold">Le Collège Kunugigaoka est accessible à partir du niveau {SUBCLASS_DUNGEON_LEVEL_REQUIRED}.</p>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button onClick={() => navigate('/dungeons')} className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 font-bold border border-stone-500">
            Retour
          </button>
          <button
            onClick={handleStartRun}
            disabled={!canAccess}
            className={`px-12 py-4 font-bold text-xl ${
              canAccess ? 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-500' : 'bg-stone-700 text-stone-500 cursor-not-allowed border border-stone-600'
            }`}
          >
            {canAccess ? `Défier ${SUBCLASS_BOSS.nom}` : 'Accès impossible'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubclassDungeon;
