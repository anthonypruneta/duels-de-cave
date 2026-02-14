import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import testImage1 from '../assets/characters/test.png';
import testImage2 from '../assets/characters/test2.png';
import Header from './Header';
import { getAllCharacters, updateCharacterLevel } from '../services/characterService';
import { getEquippedWeapon } from '../services/dungeonService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import { applyPassiveWeaponStats } from '../utils/weaponEffects';
import {
  classConstants,
  getRaceBonus,
  getClassBonus
} from '../data/combatMechanics';
import { simulerMatch, preparerCombattant } from '../utils/tournamentCombat';

const weaponImageModules = import.meta.glob('../assets/weapons/*.png', { eager: true, import: 'default' });

const getWeaponImage = (imageFile) => {
  if (!imageFile) return null;
  return weaponImageModules[`../assets/weapons/${imageFile}`] || null;
};

// Composant Tooltip réutilisable
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

const STAT_LABELS = {
  hp: 'HP',
  auto: 'Auto',
  def: 'Déf',
  cap: 'Cap',
  rescap: 'ResC',
  spd: 'VIT'
};

const getWeaponStatColor = (value) => {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-yellow-300';
};

const getForestBoosts = (character) => ({ ...getEmptyStatBoosts(), ...(character?.forestBoosts || {}) });
const getBaseWithBoosts = (character) => applyStatBoosts(character.base, getForestBoosts(character));

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

const getPassiveDetails = (passive) => {
  if (!passive) return null;
  const base = getMageTowerPassiveById(passive.id);
  const levelData = getMageTowerPassiveLevel(passive.id, passive.level);
  if (!base || !levelData) return null;
  return { ...base, level: passive.level, levelData };
};

const Combat = () => {
  const navigate = useNavigate();
  // États pour les personnages disponibles
  const [availableCharacters, setAvailableCharacters] = useState([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);

  // États pour la sélection
  const [selectedChar1, setSelectedChar1] = useState(null);
  const [selectedChar2, setSelectedChar2] = useState(null);
  const [phase, setPhase] = useState('selection'); // 'selection' ou 'combat'

  // États pour le combat
  const [player1, setPlayer1] = useState(null);
  const [player2, setPlayer2] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [winner, setWinner] = useState(null);
  const [currentAction, setCurrentAction] = useState(null);
  const logEndRef = useRef(null);
  const [isSoundOpen, setIsSoundOpen] = useState(false);
  const [volume, setVolume] = useState(0.05);
  const [isMuted, setIsMuted] = useState(false);

  const shouldAutoScrollLog = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(min-width: 768px)').matches;
  };

  useEffect(() => {
    if (!shouldAutoScrollLog()) return;
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

  const applyCombatVolume = () => {
    const combatMusic = document.getElementById('combat-music');
    const victoryMusic = document.getElementById('victory-music');
    [combatMusic, victoryMusic].forEach((audio) => {
      if (audio) {
        audio.volume = volume;
        audio.muted = isMuted;
      }
    });
  };

  useEffect(() => {
    applyCombatVolume();
  }, [volume, isMuted, phase, winner]);

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
              aria-label={isMuted ? 'Réactiver le son' : 'Couper le son'}
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

  // Charger les personnages depuis la BDD
  useEffect(() => {
    const loadCharacters = async () => {
      setLoadingCharacters(true);
      const result = await getAllCharacters();
      if (result.success) {
        const charactersWithWeapons = await Promise.all(
          result.data.map(async (char) => {
            const level = char.level ?? 1;
            if (char.level == null) {
              await updateCharacterLevel(char.id, level);
            }
            let weaponId = char.equippedWeaponId || null;
            let weaponData = weaponId ? getWeaponById(weaponId) : null;
            if (!weaponData) {
              const weaponResult = await getEquippedWeapon(char.id);
              weaponData = weaponResult.success ? weaponResult.weapon : null;
              weaponId = weaponResult.success ? weaponResult.weapon?.id || null : null;
            }
            return normalizeCharacterBonuses({
              ...char,
              level,
              equippedWeaponData: weaponData,
              equippedWeaponId: weaponId
            });
          })
        );
        setAvailableCharacters(charactersWithWeapons);
      }
      setLoadingCharacters(false);
    };
    loadCharacters();
  }, []);

  // Calculer la description réelle basée sur les stats du personnage (retourne JSX)
  // Utilise les constantes centralisées de combatMechanics.js
  const getCalculatedDescription = (className, cap, auto) => {
    switch(className) {
      case 'Guerrier': {
        const { ignoreBase, ignorePerCap, autoBonus } = classConstants.guerrier;
        const ignoreBasePct = Math.round(ignoreBase * 100);
        const ignoreBonusPct = Math.round(ignorePerCap * cap * 100);
        const ignoreTotalPct = ignoreBasePct + ignoreBonusPct;
        return (
          <>
            +{autoBonus} Auto | Frappe résistance faible & ignore{' '}
            <Tooltip content={`Base: ${ignoreBasePct}% | Bonus (Cap ${cap}): +${ignoreBonusPct}%`}>
              <span className="text-green-400">{ignoreTotalPct}%</span>
            </Tooltip>
          </>
        );
      }

      case 'Voleur': {
        const { spdBonus, critPerCap } = classConstants.voleur;
        const critBonusPct = Math.round(critPerCap * cap * 100);
        return (
          <>
            +{spdBonus} VIT | Esquive 1 coup
            <Tooltip content={`Bonus (Cap ${cap}): +${critBonusPct}%`}>
              <span className="text-green-400"> | +{critBonusPct}% crit</span>
            </Tooltip>
          </>
        );
      }

      case 'Paladin': {
        const { reflectBase, reflectPerCap } = classConstants.paladin;
        const reflectBasePct = Math.round(reflectBase * 100);
        const reflectBonusPct = Math.round(reflectPerCap * cap * 100);
        const reflectTotalPct = reflectBasePct + reflectBonusPct;
        return (
          <>
            Renvoie{' '}
            <Tooltip content={`Base: ${reflectBasePct}% | Bonus (Cap ${cap}): +${reflectBonusPct}%`}>
              <span className="text-green-400">{reflectTotalPct}%</span>
            </Tooltip>
            {' '}des dégâts reçus
          </>
        );
      }

      case 'Healer': {
        const { missingHpPercent, capScale } = classConstants.healer;
        const missingPct = Math.round(missingHpPercent * 100);
        const healValue = Math.round(capScale * cap);
        return (
          <>
            Heal {missingPct}% PV manquants +{' '}
            <Tooltip content={`0.35 × Cap (${cap}) = ${healValue}`}>
              <span className="text-green-400">{healValue}</span>
            </Tooltip>
          </>
        );
      }

      case 'Archer': {
        const { hit2AutoMultiplier, hit2CapMultiplier } = classConstants.archer;
        const hit2Auto = Math.round(hit2AutoMultiplier * auto);
        const hit2Cap = Math.round(hit2CapMultiplier * cap);
        return (
          <>
            2 attaques: 1 tir normal +{' '}
            <Tooltip content={`Hit2 = 1.30×Auto (${auto}) + 0.25×Cap (${cap}) vs ResC`}>
              <span className="text-green-400">{hit2Auto}+{hit2Cap}</span>
            </Tooltip>
          </>
        );
      }

      case 'Mage': {
        const { capBase, capPerCap } = classConstants.mage;
        const magicPct = capBase + capPerCap * cap;
        const magicDmg = Math.round(magicPct * cap);
        return (
          <>
            Dégâts = Auto +{' '}
            <Tooltip content={`Auto (${auto}) + ${(magicPct * 100).toFixed(1)}% × Cap (${cap})`}>
              <span className="text-green-400">{auto + magicDmg}</span>
            </Tooltip>
            {' '}(vs ResC)
          </>
        );
      }

      case 'Demoniste': {
        const { capBase, capPerCap, ignoreResist, stackPerAuto } = classConstants.demoniste;
        const familierPct = capBase + capPerCap * cap;
        const familierDmgTotal = Math.round(familierPct * cap);
        const ignoreResistPct = Math.round(ignoreResist * 100);
        const stackBonusPct = Math.round(stackPerAuto * 100);
        return (
          <>
            Familier:{' '}
            <Tooltip content={`${(familierPct * 100).toFixed(1)}% de la Cap (${cap}) | +${stackBonusPct}% Cap par auto (cumulable)`}>
              <span className="text-green-400">{familierDmgTotal}</span>
            </Tooltip>
            {' '}dégâts / tour (ignore {ignoreResistPct}% ResC)
          </>
        );
      }

      case 'Masochiste': {
        const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
        const returnBasePct = Math.round(returnBase * 100);
        const returnBonusPct = Math.round(returnPerCap * cap * 100);
        const returnTotalPct = returnBasePct + returnBonusPct;
        const healPct = Math.round(healPercent * 100);
        return (
          <>
            Renvoie{' '}
            <Tooltip content={`Base: ${returnBasePct}% | Bonus (Cap ${cap}): +${returnBonusPct}%`}>
              <span className="text-green-400">{returnTotalPct}%</span>
            </Tooltip>
            {' '}des dégâts accumulés & heal {healPct}%
          </>
        );
      }

      default:
        return classes[className]?.description || '';
    }
  };

  // Lancer le combat avec les personnages sélectionnés
  const startCombat = () => {
    if (!selectedChar1 || !selectedChar2) return;

    const p1 = preparerCombattant(selectedChar1);
    const p2 = preparerCombattant(selectedChar2);

    setPlayer1(p1);
    setPlayer2(p2);
    setPhase('combat');
    setCombatLog([]);
    setWinner(null);
  };

  // Simulation de combat — utilise le moteur unique de tournamentCombat.js
  const simulateCombat = async () => {
    if (!player1 || !player2 || isSimulating) return;
    setIsSimulating(true);
    setWinner(null);

    // Jouer la musique de combat
    const combatMusic = document.getElementById('combat-music');
    const victoryMusic = document.getElementById('victory-music');
    if (combatMusic) {
      combatMusic.currentTime = 0;
      combatMusic.volume = volume;
      combatMusic.play().catch(e => console.log('Autoplay bloqué:', e));
    }

    // Lancer le combat via le moteur unique
    const result = simulerMatch(selectedChar1, selectedChar2);
    const allLogs = [];

    // Rejouer les steps avec animation
    for (const step of result.steps) {
      allLogs.push(...step.logs);
      setCombatLog([...allLogs]);

      // Mettre à jour les barres de vie
      setPlayer1(prev => ({ ...prev, currentHP: step.p1HP, shield: step.p1Shield || 0 }));
      setPlayer2(prev => ({ ...prev, currentHP: step.p2HP, shield: step.p2Shield || 0 }));

      if (step.phase === 'intro') {
        await new Promise(r => setTimeout(r, 800));
      } else if (step.phase === 'turn_start') {
        await new Promise(r => setTimeout(r, 800));
      } else if (step.phase === 'action') {
        setCurrentAction({ player: step.player, logs: step.logs });
        await new Promise(r => setTimeout(r, 300));
        await new Promise(r => setTimeout(r, 2000));
        setCurrentAction(null);
      }
    }

    setWinner(result.winnerNom);
    setIsSimulating(false);

    // Arrêter la musique de combat et jouer la musique de victoire
    if (combatMusic) combatMusic.pause();
    if (victoryMusic) {
      victoryMusic.currentTime = 0;
      victoryMusic.volume = volume;
      victoryMusic.play().catch(e => console.log('Autoplay bloqué:', e));
    }
  };

  const backToSelection = () => {
    // Arrêter toutes les musiques
    const combatMusic = document.getElementById('combat-music');
    const victoryMusic = document.getElementById('victory-music');
    if (combatMusic) combatMusic.pause();
    if (victoryMusic) victoryMusic.pause();

    setPhase('selection');
    setPlayer1(null);
    setPlayer2(null);
    setCombatLog([]);
    setWinner(null);
    setIsSimulating(false);
    setCurrentAction(null);
  };


  // Fonction pour formater le texte du log avec les couleurs
  const formatLogMessage = (text, isP1) => {
    if (!player1 || !player2) return text;

    const p1Name = player1.name;
    const p2Name = player2.name;

    // Regex pour trouver les nombres de dégâts/soins
    const parts = [];
    let remaining = text;
    let key = 0;

    // Fonction pour ajouter du texte avec mise en forme
    const processText = (str) => {
      const result = [];
      let current = str;

      // Remplacer les noms des joueurs
      const nameRegex = new RegExp(`(${p1Name}|${p2Name})`, 'g');
      const nameParts = current.split(nameRegex);

      nameParts.forEach((part, i) => {
        if (part === p1Name) {
          result.push(<span key={`name-${key++}`} className="font-bold text-blue-400">{part}</span>);
        } else if (part === p2Name) {
          result.push(<span key={`name-${key++}`} className="font-bold text-purple-400">{part}</span>);
        } else if (part) {
          // Chercher les nombres de dégâts/soins dans cette partie
          const numRegex = /(\d+)\s*(points?\s*de\s*(?:vie|dégâts?|dommages?))/gi;
          let lastIndex = 0;
          let match;
          const subParts = [];

          while ((match = numRegex.exec(part)) !== null) {
            // Texte avant le nombre
            if (match.index > lastIndex) {
              subParts.push(part.slice(lastIndex, match.index));
            }
            // Le nombre avec style
            const isHeal = match[2].toLowerCase().includes('vie');
            const colorClass = isHeal ? 'font-bold text-green-400' : 'font-bold text-red-400';
            subParts.push(<span key={`num-${key++}`} className={colorClass}>{match[1]}</span>);
            subParts.push(` ${match[2]}`);
            lastIndex = match.index + match[0].length;
          }

          // Texte restant
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

  // Composant pour sélectionner un personnage
  const CharacterSelector = ({ selectedChar, onSelect, otherSelectedId, label }) => {
    return (
      <div className="bg-stone-800/90 p-4 border border-stone-600">
        <h3 className="text-xl font-bold text-stone-200 mb-4 text-center">{label}</h3>

        {selectedChar ? (
          <div className="text-center">
            <div className="relative inline-block">
              {selectedChar.characterImage ? (
                <img
                  src={selectedChar.characterImage}
                  alt={selectedChar.name}
                  className="w-40 h-auto object-contain mx-auto"
                />
              ) : (
                <div className="w-32 h-40 bg-stone-700 flex items-center justify-center mx-auto border border-stone-500">
                  <span className="text-5xl">{races[selectedChar.race]?.icon || '❓'}</span>
                </div>
              )}
            </div>
            <p className="text-white font-bold mt-2">{selectedChar.name}</p>
            <p className="text-stone-400 text-sm">
              {selectedChar.race} • {selectedChar.class} • Niveau {selectedChar.level ?? 1}
            </p>
            <p className="text-stone-500 text-xs mt-1">
              Niveau: {selectedChar.level ?? 1} | Arme: {selectedChar.equippedWeaponData?.nom || 'Aucune arme'}
            </p>
            {selectedChar.equippedWeaponData ? (
              <div className="mt-2 flex items-center justify-center gap-2 text-xs text-stone-300">
                <Tooltip content={getWeaponTooltipContent(selectedChar.equippedWeaponData)}>
                  <span className="flex items-center gap-2">
                    {getWeaponImage(selectedChar.equippedWeaponData.imageFile) ? (
                      <img
                        src={getWeaponImage(selectedChar.equippedWeaponData.imageFile)}
                        alt={selectedChar.equippedWeaponData.nom}
                        className="w-6 h-auto"
                      />
                    ) : (
                      <span className="text-base">{selectedChar.equippedWeaponData.icon}</span>
                    )}
                    <span className={`font-semibold ${RARITY_COLORS[selectedChar.equippedWeaponData.rarete]}`}>
                      {selectedChar.equippedWeaponData.nom}
                    </span>
                  </span>
                </Tooltip>
              </div>
            ) : (
              <div className="mt-2 text-xs text-stone-500">Aucune arme équipée</div>
            )}
            {(() => {
              const passiveDetails = getPassiveDetails(selectedChar.mageTowerPassive);
              if (!passiveDetails) return null;
              return (
                <div className="mt-2 text-xs text-stone-300 border border-amber-500/50 bg-stone-900/60 p-2">
                  <span className="flex items-center justify-center gap-2">
                    <span className="text-base">{passiveDetails.icon}</span>
                    <span className="font-semibold text-amber-300">
                      {passiveDetails.name} — Niv. {passiveDetails.level}
                    </span>
                  </span>
                  <div className="text-[10px] text-stone-400 mt-1">
                    {passiveDetails.levelData.description}
                  </div>
                </div>
              );
            })()}
            <button
              onClick={() => onSelect(null)}
              className="mt-2 text-stone-400 text-sm hover:text-white border border-stone-600 px-3 py-1 hover:border-stone-400 transition-all"
            >
              Changer
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {availableCharacters
              .filter(char => char.id !== otherSelectedId)
              .map(char => (
                <div
                  key={char.id}
                  onClick={() => onSelect(char)}
                  className="flex items-center gap-3 p-2 bg-stone-700/50 rounded-lg cursor-pointer hover:bg-stone-600/50 transition"
                >
                  {char.characterImage ? (
                    <img src={char.characterImage} alt={char.name} className="w-12 h-auto object-contain" />
                  ) : (
                    <div className="w-12 h-14 bg-stone-600 rounded flex items-center justify-center">
                      <span className="text-2xl">{races[char.race]?.icon || '❓'}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{char.name}</p>
                    <p className="text-amber-300 text-xs">
                      {char.race} • {char.class} • Niveau {char.level ?? 1}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <p>Niveau: {char.level ?? 1}</p>
                    <p>Arme: {char.equippedWeaponData?.nom || 'Aucune'}</p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  const CharacterCard = ({ character, imageIndex }) => {
    if (!character) return null;
    const hpPercent = (character.currentHP / character.maxHP) * 100;
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const shieldPercent = character.maxHP > 0 ? Math.min(100, ((character.shield || 0) / character.maxHP) * 100) : 0;
    const raceB = getRaceBonus(character.race);
    const classB = getClassBonus(character.class);
    const forestBoosts = getForestBoosts(character);
    const weapon = character.equippedWeaponData;
    const passiveDetails = getPassiveDetails(character.mageTowerPassive);
    const awakeningInfo = races[character.race]?.awakening || null;
    const isAwakeningActive = awakeningInfo && (character.level ?? 1) >= awakeningInfo.levelRequired;
    const computedBase = getBaseWithBoosts(character);
    const baseStats = character.baseWithoutWeapon || computedBase;
    const awakeningRate = character.awakening?.applied ? (character.awakening.bonusPerStat || 0) : 0;
    const preAwakeningBase = awakeningRate > 0
      ? Object.fromEntries(
          Object.entries(baseStats).map(([key, value]) => [key, Math.round((value || 0) / (1 + awakeningRate))])
        )
      : baseStats;
    const baseWithPassive = weapon ? applyPassiveWeaponStats(baseStats, weapon.id, character.class) : baseStats;
    const totalBonus = (k) => (raceB[k] || 0) + (classB[k] || 0);
    const awakeningBonus = (k) => (baseStats[k] || 0) - (preAwakeningBase[k] || 0);
    const baseWithoutBonus = (k) => baseStats[k] - totalBonus(k) - (forestBoosts[k] || 0) - awakeningBonus(k);
    const tooltipContent = (k) => {
      const parts = [`Base: ${baseWithoutBonus(k)}`];
      if (raceB[k] > 0) parts.push(`Race: +${raceB[k]}`);
      if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
      if (forestBoosts[k] > 0) parts.push(`Forêt: +${forestBoosts[k]}`);
      if (awakeningBonus(k) !== 0) parts.push(`Éveil: ${awakeningBonus(k) > 0 ? `+${awakeningBonus(k)}` : awakeningBonus(k)}`);
      const weaponDelta = weapon?.stats?.[k] ?? 0;
      if (weaponDelta !== 0) {
        parts.push(`Arme: ${weaponDelta > 0 ? `+${weaponDelta}` : weaponDelta}`);
      }
      if (k === 'auto') {
        const passiveAutoBonus = (baseWithPassive.auto ?? baseStats.auto) - (baseStats.auto + (weapon?.stats?.auto ?? 0));
        if (passiveAutoBonus !== 0) {
          parts.push(`Passif: ${passiveAutoBonus > 0 ? `+${passiveAutoBonus}` : passiveAutoBonus}`);
        }
      }
      return parts.join(' | ');
    };
    // Utiliser l'image du personnage si elle existe, sinon utiliser l'image par défaut
    const characterImage = character.characterImage || (imageIndex === 1 ? testImage1 : testImage2);

    const StatWithTooltip = ({ statKey, label }) => {
      const weaponDelta = weapon?.stats?.[statKey] ?? 0;
      const passiveAutoBonus = statKey === 'auto'
        ? (baseWithPassive.auto ?? baseStats.auto) - (baseStats.auto + (weapon?.stats?.auto ?? 0))
        : 0;
      const displayValue = baseStats[statKey] + weaponDelta + passiveAutoBonus;
      const hasBonus = totalBonus(statKey) > 0 || forestBoosts[statKey] > 0 || awakeningBonus(statKey) !== 0 || weaponDelta !== 0 || passiveAutoBonus !== 0;
      const totalDelta = totalBonus(statKey) + forestBoosts[statKey] + awakeningBonus(statKey) + weaponDelta + passiveAutoBonus;
      const labelClass = totalDelta > 0 ? 'text-green-400' : totalDelta < 0 ? 'text-red-400' : 'text-yellow-300';
      return hasBonus ? (
        <Tooltip content={tooltipContent(statKey)}>
          <span className={labelClass}>
            {label}: {displayValue}
          </span>
        </Tooltip>
      ) : (
        <span>{label}: {displayValue}</span>
      );
    };

    return (
      <div className="relative shadow-2xl overflow-visible">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-stone-200 px-5 py-1.5 text-sm font-bold shadow-lg border border-stone-500 z-10">
          {character.race} • {character.class} • Niveau {character.level ?? 1}
        </div>
        <div className="overflow-visible">
          <div className="h-auto relative bg-stone-900 flex items-center justify-center">
            <img src={characterImage} alt={character.name} className="w-full h-auto object-contain" />
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-3">
              <div className="text-white font-bold text-xl text-center">{character.name}</div>
            </div>
          </div>
          <div className="bg-stone-800 p-4 border-t border-stone-600">
            <div className="mb-3">
              <div className="flex justify-between text-sm text-white mb-2">
                <StatWithTooltip statKey="hp" label="HP" />
                <StatWithTooltip statKey="spd" label="VIT" />
              </div>
              <div className="text-xs text-stone-400 mb-2">{character.name} — PV {character.currentHP}/{character.maxHP}</div>
              <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600">
                <div className={`h-full transition-all duration-500 ${hpClass}`} style={{width: `${hpPercent}%`}} />
              </div>
              {(character.shield || 0) > 0 && (
                <div className="mt-1 bg-stone-900 h-2 overflow-hidden border border-blue-700">
                  <div className="h-full transition-all duration-500 bg-blue-500" style={{width: `${shieldPercent}%`}} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-stone-400"><StatWithTooltip statKey="auto" label="Auto" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="def" label="Déf" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="cap" label="Cap" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="rescap" label="ResC" /></div>
            </div>
            <div className="space-y-2">
              {weapon && (
                <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                  <Tooltip content={getWeaponTooltipContent(weapon)}>
                    <span className="flex items-center gap-2">
                      {getWeaponImage(weapon.imageFile) ? (
                        <img src={getWeaponImage(weapon.imageFile)} alt={weapon.nom} className="w-8 h-auto" />
                      ) : (
                        <span className="text-xl">{weapon.icon}</span>
                      )}
                      <span className={`font-semibold ${RARITY_COLORS[weapon.rarete]}`}>{weapon.nom}</span>
                    </span>
                  </Tooltip>
                </div>
              )}
              {passiveDetails && (
                <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                  <span className="text-lg">{passiveDetails.icon}</span>
                  <div className="flex-1">
                    <div className="text-amber-300 font-semibold mb-1">
                      {passiveDetails.name} — Niveau {passiveDetails.level}
                    </div>
                    <div className="text-stone-400 text-[10px]">
                      {passiveDetails.levelData.description}
                    </div>
                  </div>
                </div>
              )}
              {isAwakeningActive && (
                <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                  <span className="text-lg">✨</span>
                  <div className="flex-1">
                    <div className="text-amber-300 font-semibold mb-1">
                      Éveil racial actif (Niv {awakeningInfo.levelRequired}+)
                    </div>
                    <div className="text-stone-400 text-[10px]">
                      {awakeningInfo.description}
                    </div>
                  </div>
                </div>
              )}
              {!isAwakeningActive && (
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">{races[character.race].icon}</span>
                <span className="text-stone-300">{races[character.race].bonus}</span>
              </div>
              )}
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">{classes[character.class].icon}</span>
                <div className="flex-1">
                  <div className="text-stone-200 font-semibold mb-1">{classes[character.class].ability}</div>
                  <div className="text-stone-400 text-[10px]">{getCalculatedDescription(character.class, baseStats.cap + (weapon?.stats?.cap ?? 0), baseStats.auto + (weapon?.stats?.auto ?? 0))}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Phase de sélection
  if (phase === 'selection') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <SoundControl />
        <div className="max-w-4xl mx-auto pt-20">
          <div className="flex flex-col items-center mb-8 gap-4">
            <div className="bg-stone-800 border border-stone-600 px-8 py-3">
              <h1 className="text-4xl font-bold text-stone-200">⚔️ Arène de Combat ⚔️</h1>
            </div>
            <button
              onClick={() => navigate('/')}
              className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-6 py-2 border border-stone-500 transition"
            >
              ⬅️ Retour à l&apos;accueil
            </button>
          </div>

          {loadingCharacters ? (
            <div className="text-center text-stone-300 text-xl">Chargement des personnages...</div>
          ) : availableCharacters.length < 2 ? (
            <div className="bg-stone-800/50 p-8 border border-stone-600 text-center">
              <p className="text-stone-400 text-xl mb-4">Il faut au moins 2 personnages pour combattre</p>
              <p className="text-stone-300">Personnages disponibles: {availableCharacters.length}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <CharacterSelector
                  selectedChar={selectedChar1}
                  onSelect={setSelectedChar1}
                  otherSelectedId={selectedChar2?.id}
                  label="Combattant 1"
                />

                <CharacterSelector
                  selectedChar={selectedChar2}
                  onSelect={setSelectedChar2}
                  otherSelectedId={selectedChar1?.id}
                  label="Combattant 2"
                />
              </div>

              {selectedChar1 && selectedChar2 && (
                <div className="text-center -mt-4">
                  <div className="bg-stone-800 border border-stone-600 px-6 py-3 mb-4 inline-block">
                    <div className="flex items-center justify-center gap-4">
                      <span className="text-2xl font-bold text-white">{selectedChar1.name}</span>
                      <span className="text-3xl text-stone-400">⚔️</span>
                      <span className="text-2xl font-bold text-white">{selectedChar2.name}</span>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={startCombat}
                      className="bg-stone-100 hover:bg-white text-stone-900 px-12 py-4 font-bold text-xl shadow-2xl border-2 border-stone-400 hover:border-stone-600 transition-all"
                    >
                      ⚔️ Commencer le Combat ⚔️
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Phase de combat
  return (
    <div className="min-h-screen p-6">
      <Header />
      <SoundControl />
      {/* Musique de combat */}
      <audio id="combat-music" loop>
        <source src="/assets/music/combat.mp3" type="audio/mpeg" />
      </audio>
      <audio id="victory-music">
        <source src="/assets/music/victory.mp3" type="audio/mpeg" />
      </audio>

      <div className="max-w-[1800px] mx-auto pt-16">
        <div className="flex justify-center mb-8">
          <div className="bg-stone-800 border border-stone-600 px-8 py-3">
            <h1 className="text-3xl font-bold text-stone-200">⚔️ Combat ⚔️</h1>
          </div>
        </div>

        {/* Layout principal: Perso 1 | Chat | Perso 2 */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
          {/* Carte joueur 1 - Gauche */}
          <div className="order-1 md:order-1 w-full md:w-[340px] md:flex-shrink-0">
            <CharacterCard character={player1} imageIndex={1} />
          </div>

          {/* Zone centrale - Boutons + Chat */}
          <div className="order-2 md:order-2 w-full md:w-[600px] md:flex-shrink-0 flex flex-col">
            {/* Boutons de contrôle alignés avec le haut des images */}
            <div className="flex justify-center gap-3 md:gap-4 mb-4">
              <button
                onClick={simulateCombat}
                disabled={isSimulating}
                className="bg-stone-100 hover:bg-white disabled:bg-stone-600 disabled:text-stone-400 text-stone-900 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border-2 border-stone-400"
              >
                ▶️ Lancer le combat
              </button>
              <button
                onClick={backToSelection}
                className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-4 py-2 md:px-8 md:py-3 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all shadow-lg border border-stone-500"
              >
                ← Changer
              </button>
            </div>

            {/* Message de victoire */}
            {winner && (
              <div className="flex justify-center mb-4">
                <div className="bg-stone-100 text-stone-900 px-8 py-3 font-bold text-xl animate-pulse shadow-2xl border-2 border-stone-400">
                  🏆 {winner} remporte le combat! 🏆
                </div>
              </div>
            )}

            {/* Zone de chat messenger */}
              <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[480px] md:h-[600px]">
                <div className="bg-stone-900 p-3 border-b border-stone-600">
                  <h2 className="text-lg md:text-2xl font-bold text-stone-200 text-center">⚔️ Combat en direct</h2>
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

                      // Messages de système (tours, victoire, etc.)
                      if (!isP1 && !isP2) {
                        if (log.includes('🏆')) {
                          return (
                            <div key={idx} className="flex justify-center my-4">
                              <div className="bg-stone-100 text-stone-900 px-6 py-3 font-bold text-lg shadow-lg border border-stone-400">
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
                            <div className="text-stone-400 text-sm italic">
                              {cleanLog}
                            </div>
                          </div>
                        );
                      }

                      // Messages du Joueur 1 (gauche)
                      if (isP1) {
                        return (
                          <div key={idx} className="flex justify-start">
                            <div className="max-w-[80%]">
                                <div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-l-4 border-blue-500">
                                  <div className="text-xs md:text-sm">{formatLogMessage(cleanLog, true)}</div>
                                </div>
                              </div>
                            </div>
                        );
                      }

                      // Messages du Joueur 2 (droite)
                      if (isP2) {
                        return (
                          <div key={idx} className="flex justify-end">
                            <div className="max-w-[80%]">
                                <div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-r-4 border-purple-500">
                                  <div className="text-xs md:text-sm">{formatLogMessage(cleanLog, false)}</div>
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

          {/* Carte joueur 2 - Droite */}
          <div className="order-3 md:order-3 w-full md:w-[340px] md:flex-shrink-0">
            <CharacterCard character={player2} imageIndex={2} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Combat;
