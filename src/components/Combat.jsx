import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import testImage1 from '../assets/characters/test.png';
import testImage2 from '../assets/characters/test2.png';
import Header from './Header';
import CharacterCardContent from './CharacterCardContent';
import { getAllCharacters, updateCharacterLevel } from '../services/characterService';
import { getEquippedWeapon } from '../services/dungeonService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import { isForgeActive } from '../data/featureFlags';
import { extractForgeUpgrade, computeForgeStatDelta, hasAnyForgeUpgrade } from '../data/forgeDungeon';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { getFusedPassiveDisplayData } from '../data/extensionDungeon';
import SharedTooltip from './SharedTooltip';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import { applyPassiveWeaponStats } from '../utils/weaponEffects';
import {
  classConstants,
  getRaceBonus,
  getClassBonus
} from '../data/combatMechanics';
import { simulerMatch, preparerCombattant } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { getRaceBonusText, getClassDescriptionText } from '../utils/descriptionBuilders';
import { getCalculatedClassDescription } from '../utils/calculatedClassDescription';

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
  const [selectingFor, setSelectingFor] = useState(1);

  // États pour le combat
  const [player1, setPlayer1] = useState(null);
  const [player2, setPlayer2] = useState(null);
  const [p1CombatBase, setP1CombatBase] = useState(null);
  const [p2CombatBase, setP2CombatBase] = useState(null);
  const [p1CombatModifiers, setP1CombatModifiers] = useState(null);
  const [p2CombatModifiers, setP2CombatModifiers] = useState(null);
  const [p1CombatStatus, setP1CombatStatus] = useState(null);
  const [p2CombatStatus, setP2CombatStatus] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [winner, setWinner] = useState(null);
  const [currentAction, setCurrentAction] = useState(null);
  const logEndRef = useRef(null);
  const logContainerRef = useRef(null);
  const shouldAutoScrollLog = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(min-width: 768px)').matches;
  };

  // Auto-scroll du journal : scroll le conteneur uniquement (pas la page)
  useEffect(() => {
    if (!shouldAutoScrollLog() || !logContainerRef.current) return;
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [combatLog]);

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

  const getCalculatedDescription = getCalculatedClassDescription;

  // Lancer le combat avec les personnages sélectionnés
  const startCombat = () => {
    if (!selectedChar1 || !selectedChar2) return;

    const p1 = preparerCombattant(selectedChar1);
    const p2 = preparerCombattant(selectedChar2);

    setPlayer1(p1);
    setPlayer2(p2);
    setP1CombatBase(null);
    setP2CombatBase(null);
    setP1CombatModifiers(null);
    setP2CombatModifiers(null);
    setP1CombatStatus(null);
    setP2CombatStatus(null);
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
      combatMusic.play().catch(e => console.log('Autoplay bloqué:', e));
    }

    // Lancer le combat via le moteur unique
    const result = simulerMatch(selectedChar1, selectedChar2);

    // Rejouer les steps avec animation
    await replayCombatSteps(result.steps, {
      setCombatLog,
      onStepHP: (step) => {
        setP1CombatBase(step.p1Base ?? undefined);
        setP2CombatBase(step.p2Base ?? undefined);
        setP1CombatModifiers(step.p1Modifiers ?? null);
        setP2CombatModifiers(step.p2Modifiers ?? null);
        setP1CombatStatus(step.p1Status ?? null);
        setP2CombatStatus(step.p2Status ?? null);
        setPlayer1(prev => ({ ...prev, currentHP: step.p1HP, shield: step.p1Shield || 0 }));
        setPlayer2(prev => ({ ...prev, currentHP: step.p2HP, shield: step.p2Shield || 0 }));
      },
      setCurrentAction,
      speed: 'normal'
    });

    setWinner(result.winnerNom);
    setIsSimulating(false);

    // Arrêter la musique de combat et jouer la musique de victoire
    if (combatMusic) combatMusic.pause();
    if (victoryMusic) {
      victoryMusic.currentTime = 0;
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
    setP1CombatBase(null);
    setP2CombatBase(null);
    setP1CombatModifiers(null);
    setP2CombatModifiers(null);
    setP1CombatStatus(null);
    setP2CombatStatus(null);
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
            // Texte avant le nombre
            if (match.index > lastIndex) {
              pushWithCritHighlight(part.slice(lastIndex, match.index));
            }
            // Le nombre avec style
            const token = match[2].toLowerCase();
            const isHeal = token.includes('vie') || token.includes('pv');
            const colorClass = isHeal ? 'font-bold text-green-400' : 'font-bold text-red-400';
            subParts.push(<span key={`num-${key++}`} className={colorClass}>{match[1]}</span>);
            subParts.push(` ${match[2]}`);
            lastIndex = match.index + match[0].length;
          }

          // Texte restant
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
                    <span className="flex flex-col items-start">
                      <WeaponNameWithForge weapon={selectedChar.equippedWeaponData} forgeUpgrade={selectedChar.forgeUpgrade} />
                    </span>
                  </span>
                </Tooltip>
              </div>
            ) : (
              <div className="mt-2 text-xs text-stone-500">Aucune arme équipée</div>
            )}
            {(() => {
              const fused = getFusedPassiveDisplayData(selectedChar);
              if (fused) {
                return (
                  <div className="mt-2 extension-territory-border extension-territory-glow overflow-visible">
                    <div className="text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2 extension-territory-shine">
                      <span className="flex items-center justify-center gap-2">
                        <span className="text-base">{fused.primaryDetails.icon}</span>
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
                          <span className="font-semibold extension-territory-text cursor-help">
                            {fused.displayLabel}
                          </span>
                        </SharedTooltip>
                      </span>
                      <div className="text-[10px] text-stone-400 mt-1 space-y-1">
                        <div><span className="text-amber-300/90">Niv.{fused.primaryDetails.level} —</span> {fused.primaryDetails.levelData.description}</div>
                        <div><span className="text-violet-300/90">Niv.{fused.extensionDetails.level} (Extension) —</span> {fused.extensionDetails.levelData.description}</div>
                      </div>
                    </div>
                  </div>
                );
              }
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

  const handleRosterClick = (char) => {
    if (selectingFor === 1) {
      if (char.id === selectedChar2?.id) return;
      setSelectedChar1(char);
      if (!selectedChar2) setSelectingFor(2);
    } else {
      if (char.id === selectedChar1?.id) return;
      setSelectedChar2(char);
    }
  };

  // Phase de sélection — style fighting game
  if (phase === 'selection') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Header />

        {loadingCharacters ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-stone-300 text-xl">Chargement des personnages...</div>
          </div>
        ) : availableCharacters.length < 2 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-stone-400 text-xl">Il faut au moins 2 personnages pour combattre</div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col pt-20">
            {/* Zone principale — les 2 combattants côte à côte */}
            <div className="flex-1 flex items-stretch min-h-0 relative">
              {/* P1 — gauche */}
              <div
                className={`flex-1 flex flex-col items-center justify-end cursor-pointer relative overflow-hidden transition-opacity ${selectingFor === 1 ? '' : 'opacity-60 hover:opacity-80'}`}
                onClick={() => setSelectingFor(1)}
              >
                {selectedChar1 ? (
                  <img
                    src={selectedChar1.characterImage}
                    alt={selectedChar1.name}
                    className="absolute inset-0 w-full h-full object-contain object-bottom"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-8xl text-stone-700/50 select-none">?</span>
                  </div>
                )}
                <div className="relative z-10 w-full p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="text-white font-black text-2xl md:text-4xl uppercase tracking-wide text-center drop-shadow-lg" style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000' }}>
                    {selectedChar1?.name || '—'}
                  </div>
                  {selectedChar1 && (
                    <div className="text-blue-300 text-xs md:text-sm text-center mt-1">
                      {selectedChar1.race} • {selectedChar1.class} • Niv.{selectedChar1.level ?? 1}
                    </div>
                  )}
                </div>
                {/* Indicateur P1 */}
                <div className={`absolute top-2 left-3 z-10 text-xs font-black uppercase tracking-widest ${selectingFor === 1 ? 'text-blue-400' : 'text-blue-400/40'}`}>P1</div>
              </div>

              {/* Séparateur central + VS + Fight */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
                <div className="text-center mb-2">
                  <div className="text-stone-400 text-[10px] md:text-xs uppercase tracking-[0.3em]">Choix du personnage</div>
                </div>
                {selectedChar1 && selectedChar2 && (
                  <button
                    onClick={startCombat}
                    className="pointer-events-auto bg-red-600 hover:bg-red-500 text-white px-8 md:px-12 py-3 md:py-4 font-black text-xl md:text-2xl uppercase tracking-wider shadow-2xl border-2 border-red-400 hover:border-red-300 transition-all animate-pulse hover:animate-none"
                  >
                    Fight!
                  </button>
                )}
              </div>

              {/* P2 — droite */}
              <div
                className={`flex-1 flex flex-col items-center justify-end cursor-pointer relative overflow-hidden transition-opacity ${selectingFor === 2 ? '' : 'opacity-60 hover:opacity-80'}`}
                onClick={() => setSelectingFor(2)}
              >
                {selectedChar2 ? (
                  <img
                    src={selectedChar2.characterImage}
                    alt={selectedChar2.name}
                    className="absolute inset-0 w-full h-full object-contain object-bottom"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-8xl text-stone-700/50 select-none">?</span>
                  </div>
                )}
                <div className="relative z-10 w-full p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="text-white font-black text-2xl md:text-4xl uppercase tracking-wide text-center drop-shadow-lg" style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000' }}>
                    {selectedChar2?.name || '—'}
                  </div>
                  {selectedChar2 && (
                    <div className="text-purple-300 text-xs md:text-sm text-center mt-1">
                      {selectedChar2.race} • {selectedChar2.class} • Niv.{selectedChar2.level ?? 1}
                    </div>
                  )}
                </div>
                <div className={`absolute top-2 right-3 z-10 text-xs font-black uppercase tracking-widest ${selectingFor === 2 ? 'text-purple-400' : 'text-purple-400/40'}`}>P2</div>
              </div>
            </div>

            {/* Roster — une ligne en bas */}
            <div className="flex-shrink-0 px-2 md:px-6 py-3">
              <div className="flex items-center gap-2 md:gap-3 overflow-x-auto justify-center pb-1">
                {availableCharacters.map(char => {
                  const isP1 = selectedChar1?.id === char.id;
                  const isP2 = selectedChar2?.id === char.id;
                  const isDisabled = (selectingFor === 1 && isP2) || (selectingFor === 2 && isP1);
                  return (
                    <div
                      key={char.id}
                      onClick={() => !isDisabled && handleRosterClick(char)}
                      className={`
                        relative flex-shrink-0 w-24 h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 overflow-hidden cursor-pointer transition-all
                        border-2
                        ${isP1 ? 'border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)] scale-105 z-10' : ''}
                        ${isP2 ? 'border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.5)] scale-105 z-10' : ''}
                        ${!isP1 && !isP2 ? 'border-stone-600/60 hover:border-stone-400' : ''}
                        ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105'}
                      `}
                    >
                      {char.characterImage ? (
                        <img src={char.characterImage} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-stone-800 flex items-center justify-center">
                          <span className="text-3xl">{races[char.race]?.icon || '❓'}</span>
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                        <div className="text-white text-[10px] md:text-xs font-bold truncate text-center">{char.name}</div>
                      </div>
                      {isP1 && <div className="absolute top-0.5 left-0.5 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5">P1</div>}
                      {isP2 && <div className="absolute top-0.5 right-0.5 bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.5">P2</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Phase de combat
  return (
    <div className="min-h-screen p-6">
      <Header />
      {/* Musique de combat */}
      <audio id="combat-music" loop>
        <source src="/assets/music/combat.mp3" type="audio/mpeg" />
      </audio>
      <audio id="victory-music">
        <source src="/assets/music/victory.mp3" type="audio/mpeg" />
      </audio>

      <div className="max-w-[1800px] mx-auto pt-20">
        <div className="flex justify-center mb-8">
          <div className="bg-stone-800 border border-stone-600 px-8 py-3">
            <h1 className="text-3xl font-bold text-stone-200">⚔️ Combat ⚔️</h1>
          </div>
        </div>

        {/* Layout principal: Perso 1 | Chat | Perso 2 */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
          {/* Carte joueur 1 - Gauche (infos à gauche de l'image) */}
          <div className="order-1 md:order-1 w-full md:w-[340px] lg:w-auto md:flex-shrink-0">
            <CharacterCardContent character={player1} showHpBar imageOverride={player1?.characterImage ?? testImage1} combatBaseOverride={p1CombatBase} combatModifiers={p1CombatModifiers} opponent={player2} combatStatus={p1CombatStatus} detailsPlacement="left" />
          </div>

          {/* Zone centrale - Boutons + Chat */}
          <div className="order-2 md:order-2 w-full md:w-[600px] lg:w-[500px] lg:flex-1 lg:min-w-[400px] md:flex-shrink-0 lg:flex-shrink flex flex-col">
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
                <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
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

          {/* Carte joueur 2 - Droite (infos à droite de l'image) */}
          <div className="order-3 md:order-3 w-full md:w-[340px] lg:w-auto md:flex-shrink-0">
            <CharacterCardContent character={player2} showHpBar imageOverride={player2?.characterImage ?? testImage2} combatBaseOverride={p2CombatBase} combatModifiers={p2CombatModifiers} opponent={player1} combatStatus={p2CombatStatus} detailsPlacement="right" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Combat;
