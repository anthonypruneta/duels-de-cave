import React, { useState, useEffect, useRef } from 'react';
import testImage1 from '../assets/characters/test.png';
import testImage2 from '../assets/characters/test2.png';
import Header from './Header';
import { getAllCharacters } from '../services/characterService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';

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

const Combat = () => {
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

  // Charger les personnages depuis la BDD
  useEffect(() => {
    const loadCharacters = async () => {
      setLoadingCharacters(true);
      const result = await getAllCharacters();
      if (result.success) {
        setAvailableCharacters(result.data.map(normalizeCharacterBonuses));
      }
      setLoadingCharacters(false);
    };
    loadCharacters();
  }, []);

  // Calculer la description réelle basée sur les stats du personnage (retourne JSX)
  const getCalculatedDescription = (className, cap, auto) => {
    const paliers = Math.floor(cap / 15);

    switch(className) {
      case 'Guerrier':
        const ignoreBase = 8;
        const ignoreBonus = paliers * 2;
        const ignoreTotal = ignoreBase + ignoreBonus;
        return (
          <>
            +3 Auto | Frappe résistance faible & ignore{' '}
            {ignoreBonus > 0 ? (
              <Tooltip content={`Base: ${ignoreBase}% | Bonus (${paliers} paliers): +${ignoreBonus}%`}>
                <span className="text-green-400">{ignoreTotal}%</span>
              </Tooltip>
            ) : (
              <span>{ignoreBase}%</span>
            )}
          </>
        );

      case 'Voleur':
        const critBonus = paliers * 15;
        return (
          <>
            +5 VIT | Esquive 1 coup | Crit x2
            {critBonus > 0 && (
              <Tooltip content={`Bonus (${paliers} paliers): +${critBonus}%`}>
                <span className="text-green-400"> | +{critBonus}% crit</span>
              </Tooltip>
            )}
          </>
        );

      case 'Paladin':
        const riposteBase = 70;
        const riposteBonus = paliers * 12;
        const riposteTotal = riposteBase + riposteBonus;
        return (
          <>
            Renvoie{' '}
            {riposteBonus > 0 ? (
              <Tooltip content={`Base: ${riposteBase}% | Bonus (${paliers} paliers): +${riposteBonus}%`}>
                <span className="text-green-400">{riposteTotal}%</span>
              </Tooltip>
            ) : (
              <span>{riposteBase}%</span>
            )}
            {' '}des dégâts reçus
          </>
        );

      case 'Healer':
        const healBase = 25;
        const healBonus = paliers * 5;
        const healTotal = healBase + healBonus;
        const healValue = Math.round(cap * (healTotal / 100));
        return (
          <>
            Heal 15% PV manquants +{' '}
            {healBonus > 0 ? (
              <Tooltip content={`${healTotal}% de la Cap (${cap}) | Base: ${healBase}% | Bonus (${paliers} paliers): +${healBonus}%`}>
                <span className="text-green-400">{healValue}</span>
              </Tooltip>
            ) : (
              <span>{healValue}</span>
            )}
          </>
        );

      case 'Archer':
        const arrowsBase = 1;
        const arrowsBonus = paliers;
        const arrowsTotal = arrowsBase + arrowsBonus;
        return (
          <>
            {arrowsBonus > 0 ? (
              <Tooltip content={`Base: ${arrowsBase} | Bonus (${paliers} paliers): +${arrowsBonus}`}>
                <span className="text-green-400">{arrowsTotal}</span>
              </Tooltip>
            ) : (
              <span>{arrowsBase}</span>
            )}
            {' '}tirs simultanés
          </>
        );

      case 'Mage':
        const magicBase = 40;
        const magicBonusPct = paliers * 5;
        const magicTotalPct = magicBase + magicBonusPct;
        const magicDmgTotal = Math.round(cap * (magicTotalPct / 100));
        return (
          <>
            Dégâts = Auto +{' '}
            {magicBonusPct > 0 ? (
              <Tooltip content={`${magicTotalPct}% de la Cap (${cap}) | Base: ${magicBase}% | Bonus (${paliers} paliers): +${magicBonusPct}%`}>
                <span className="text-green-400">{magicDmgTotal}</span>
              </Tooltip>
            ) : (
              <span>{magicDmgTotal}</span>
            )}
            {' '}(vs ResC)
          </>
        );

      case 'Demoniste':
        const familierBase = 15;
        const familierBonusPct = paliers * 3;
        const familierTotalPct = familierBase + familierBonusPct;
        const familierDmgTotal = Math.round(cap * (familierTotalPct / 100));
        return (
          <>
            Familier:{' '}
            {familierBonusPct > 0 ? (
              <Tooltip content={`${familierTotalPct}% de la Cap (${cap}) | Base: ${familierBase}% | Bonus (${paliers} paliers): +${familierBonusPct}%`}>
                <span className="text-green-400">{familierDmgTotal}</span>
              </Tooltip>
            ) : (
              <span>{familierDmgTotal}</span>
            )}
            {' '}dégâts / tour (ignore 60% ResC)
          </>
        );

      case 'Masochiste':
        const returnBase = 60;
        const returnBonus = paliers * 12;
        const returnTotal = returnBase + returnBonus;
        return (
          <>
            Renvoie{' '}
            {returnBonus > 0 ? (
              <Tooltip content={`Base: ${returnBase}% | Bonus (${paliers} paliers): +${returnBonus}%`}>
                <span className="text-green-400">{returnTotal}%</span>
              </Tooltip>
            ) : (
              <span>{returnBase}%</span>
            )}
            {' '}des dégâts reçus accumulés
          </>
        );

      default:
        return classes[className]?.description || '';
    }
  };

  // Préparer un personnage pour le combat
  const prepareForCombat = (char) => {
    return {
      ...char,
      currentHP: char.base.hp,
      maxHP: char.base.hp,
      cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 },
      undead: false,
      dodge: false,
      reflect: false,
      bleed_stacks: 0,
      maso_taken: 0
    };
  };

  const tiers15 = (cap) => Math.floor(cap / 15);
  const dmgPhys = (auto, def) => Math.max(1, Math.round(auto - 0.5 * def));
  const dmgCap = (cap, rescap) => Math.max(1, Math.round(cap - 0.5 * rescap));

  const critChance = (att, def) => {
    let c = 0.10;
    if (att.class === 'Voleur') c += 0.05 * tiers15(att.base.cap);
    if (att.race === 'Elfe') c += 0.20;
    return c;
  };

  const reviveUndead = (target, log, playerColor) => {
    const revive = Math.max(1, Math.round(0.20 * target.maxHP));
    target.undead = true;
    target.currentHP = revive;
    log.push(`${playerColor} ☠️ ${target.name} ressuscite d'entre les morts et revient avec ${revive} points de vie !`);
  };

  const processPlayerAction = (att, def, log, isP1) => {
    if (att.currentHP <= 0 || def.currentHP <= 0) return;

      att.reflect = false;
      const cycle = { war: 3, rog: 4, pal: 2, heal: 5, arc: 3, mag: 3, dem: 1, maso: 4 };
      for (const k of Object.keys(cycle)) {
        att.cd[k] = (att.cd[k] % cycle[k]) + 1;
      }

      const playerColor = isP1 ? '[P1]' : '[P2]';

      if (att.race === 'Sylvari') {
        const heal = Math.max(1, Math.round(att.maxHP * 0.02));
        att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
        log.push(`${playerColor} 🌿 ${att.name} régénère naturellement et récupère ${heal} points de vie`);
      }

      if (att.class === 'Demoniste') {
        const t = tiers15(att.base.cap);
        const hit = Math.max(1, Math.round((0.20 + 0.04 * t) * att.base.cap));
        // Le familier ignore 60% de la résistance magique
        const raw = dmgCap(hit, def.base.rescap * 0.4);
        def.currentHP -= raw;
        log.push(`${playerColor} 💠 Le familier de ${att.name} attaque ${def.name} et inflige ${raw} points de dégâts`);
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log, playerColor);
        }
      }

      if (att.class === 'Masochiste') {
        if (att.cd.maso === 4 && att.maso_taken > 0) {
          const t = tiers15(att.base.cap);
          const dmg = Math.max(1, Math.round(att.maso_taken * (0.15 + 0.03 * t)));
          // Heal 10% des dégâts encaissés
          const healAmount = Math.max(1, Math.round(att.maso_taken * 0.10));
          att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
          att.maso_taken = 0;
          def.currentHP -= dmg;
          log.push(`${playerColor} 🩸 ${att.name} renvoie les dégâts accumulés: inflige ${dmg} points de dégâts et récupère ${healAmount} points de vie`);
          if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
            reviveUndead(def, log, playerColor);
          }
        }
      }

      if (att.bleed_stacks > 0) {
        const bleedDmg = Math.ceil(att.bleed_stacks / 3);
        att.currentHP -= bleedDmg;
        log.push(`${playerColor} 🩸 ${att.name} saigne abondamment et perd ${bleedDmg} points de vie`);
        if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
          reviveUndead(att, log, playerColor);
        }
      }

      if (att.class === 'Paladin' && att.cd.pal === 2) {
        att.reflect = 0.40 + 0.05 * tiers15(att.base.cap);
        log.push(`${playerColor} 🛡️ ${att.name} se prépare à riposter et renverra ${Math.round(att.reflect * 100)}% des dégâts`);
      }

      if (att.class === 'Healer' && att.cd.heal === 4) {
        const miss = att.maxHP - att.currentHP;
        const heal = Math.max(1, Math.round(0.15 * miss + (0.25 + 0.05 * tiers15(att.base.cap)) * att.base.cap));
        att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
        log.push(`${playerColor} ✚ ${att.name} lance un sort de soin puissant et récupère ${heal} points de vie`);
      }

      if (att.class === 'Voleur' && att.cd.rog === 4) {
        att.dodge = true;
        log.push(`${playerColor} 🌀 ${att.name} entre dans une posture d'esquive et évitera la prochaine attaque`);
      }

      const isMage = att.class === 'Mage' && att.cd.mag === 3;
      const isWar = att.class === 'Guerrier' && att.cd.war === 3;
      const isArcher = att.class === 'Archer' && att.cd.arc === 3;

      let mult = 1.0;
      if (att.race === 'Orc' && att.currentHP < 0.5 * att.maxHP) mult = 1.2;

      let hits = isArcher ? 1 + tiers15(att.base.cap) : 1;
      let total = 0;
      let wasCrit = false;

      for (let i = 0; i < hits; i++) {
        const isCrit = Math.random() < critChance(att, def);
        if (isCrit) wasCrit = true;
        let raw = 0;

        if (isMage) {
          const atkSpell = Math.round(att.base.auto * mult + (0.40 + 0.05 * tiers15(att.base.cap)) * att.base.cap * mult);
          raw = dmgCap(atkSpell, def.base.rescap);
          if (i === 0) log.push(`${playerColor} 🔮 ${att.name} invoque un puissant sort magique`);
        } else if (isWar) {
          const ignore = 0.12 + 0.02 * tiers15(att.base.cap);
          if (def.base.def <= def.base.rescap) {
            const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
            raw = dmgPhys(Math.round(att.base.auto * mult), effDef);
          } else {
            const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
            raw = dmgCap(Math.round(att.base.cap * mult), effRes);
          }
          if (i === 0) log.push(`${playerColor} 🗡️ ${att.name} exécute une frappe pénétrante`);
        } else {
          raw = dmgPhys(Math.round(att.base.auto * mult), def.base.def);
          if (att.race === 'Lycan') {
            def.bleed_stacks = (def.bleed_stacks || 0) + 1;
          }
        }

        if (isCrit) raw = Math.round(raw * 1.5);

        if (def.dodge) {
          def.dodge = false;
          log.push(`${playerColor} 💨 ${def.name} esquive habilement l'attaque !`);
          raw = 0;
        }

        if (def.reflect && raw > 0) {
          const back = Math.round(def.reflect * raw);
          att.currentHP -= back;
          log.push(`${playerColor} 🔁 ${def.name} riposte et renvoie ${back} points de dégâts à ${att.name}`);
        }

        def.currentHP -= raw;
        if (raw > 0) def.maso_taken = (def.maso_taken || 0) + raw;

        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log, playerColor);
        } else if (def.currentHP <= 0) {
          total += raw;
          break;
        }

        total += raw;
        if (isArcher) {
          const critText = isCrit ? ' CRITIQUE !' : '';
          log.push(`${playerColor} 🏹 ${att.name} tire sa flèche n°${i + 1} et inflige ${raw} points de dégâts${critText}`);
        }
      }

      if (!isArcher && total > 0) {
        const critText = wasCrit ? ' CRITIQUE !' : '';
        if (isMage) {
          log.push(`${playerColor} ${att.name} inflige ${total} points de dégâts magiques à ${def.name}${critText}`);
        } else if (isWar) {
          log.push(`${playerColor} ${att.name} transperce les défenses de ${def.name} et inflige ${total} points de dégâts${critText}`);
        } else {
          log.push(`${playerColor} ${att.name} attaque ${def.name} et inflige ${total} points de dégâts${critText}`);
        }
      }
  };

  // Lancer le combat avec les personnages sélectionnés
  const startCombat = () => {
    if (!selectedChar1 || !selectedChar2) return;

    const p1 = prepareForCombat(selectedChar1);
    const p2 = prepareForCombat(selectedChar2);

    setPlayer1(p1);
    setPlayer2(p2);
    setPhase('combat');
    setCombatLog([]);
    setWinner(null);
  };

  const simulateCombat = async () => {
    if (!player1 || !player2 || isSimulating) return;
    setIsSimulating(true);
    setWinner(null);

    // Jouer la musique de combat
    const combatMusic = document.getElementById('combat-music');
    const victoryMusic = document.getElementById('victory-music');
    if (combatMusic) {
      combatMusic.currentTime = 0;
      combatMusic.volume = 0.3;
      combatMusic.play().catch(e => console.log('Autoplay bloqué:', e));
    }

    const p1 = prepareForCombat(selectedChar1);
    const p2 = prepareForCombat(selectedChar2);

    const logs = [`⚔️ Le combat épique commence entre ${p1.name} et ${p2.name} !`];
    setCombatLog(logs);

    let turn = 1;
    while (p1.currentHP > 0 && p2.currentHP > 0 && turn <= 30) {
      logs.push(`--- Début du tour ${turn} ---`);
      setCombatLog([...logs]);
      await new Promise(r => setTimeout(r, 800));

      // Déterminer qui attaque en premier selon la vitesse
      const first = p1.base.spd >= p2.base.spd ? p1 : p2;
      const second = first === p1 ? p2 : p1;
      const firstIsP1 = first === p1;

      // Action du premier joueur
      const log1 = [];
      setCurrentAction({ player: firstIsP1 ? 1 : 2, logs: [] });
      await new Promise(r => setTimeout(r, 300));
      processPlayerAction(first, second, log1, firstIsP1);
      setCurrentAction({ player: firstIsP1 ? 1 : 2, logs: log1 });
      logs.push(...log1);
      setCombatLog([...logs]);
      setPlayer1({...p1});
      setPlayer2({...p2});
      await new Promise(r => setTimeout(r, 2000));
      setCurrentAction(null);

      // Si le combat n'est pas fini, action du deuxième joueur
      if (p1.currentHP > 0 && p2.currentHP > 0) {
        const log2 = [];
        setCurrentAction({ player: !firstIsP1 ? 1 : 2, logs: [] });
        await new Promise(r => setTimeout(r, 300));
        processPlayerAction(second, first, log2, !firstIsP1);
        setCurrentAction({ player: !firstIsP1 ? 1 : 2, logs: log2 });
        logs.push(...log2);
        setCombatLog([...logs]);
        setPlayer1({...p1});
        setPlayer2({...p2});
        await new Promise(r => setTimeout(r, 2000));
        setCurrentAction(null);
      }

      turn++;
    }

    const w = p1.currentHP > 0 ? p1.name : p2.name;
    const loser = p1.currentHP > 0 ? p2.name : p1.name;
    logs.push(`🏆 ${w} remporte glorieusement le combat contre ${loser} !`);
    setCombatLog([...logs]);
    setWinner(w);
    setIsSimulating(false);

    // Arrêter la musique de combat et jouer la musique de victoire
    if (combatMusic) combatMusic.pause();
    if (victoryMusic) {
      victoryMusic.currentTime = 0;
      victoryMusic.volume = 0.4;
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

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [combatLog]);

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
            <p className="text-stone-400 text-sm">{selectedChar.race} • {selectedChar.class}</p>
            <p className="text-stone-500 text-xs mt-1">HP: {selectedChar.base.hp} | VIT: {selectedChar.base.spd}</p>
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
                    <p className="text-amber-300 text-xs">{char.race} • {char.class}</p>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <p>HP: {char.base.hp}</p>
                    <p>VIT: {char.base.spd}</p>
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
    const raceB = character.bonuses.race;
    const classB = character.bonuses.class;
    const totalBonus = (k) => (raceB[k] || 0) + (classB[k] || 0);
    const baseWithoutBonus = (k) => character.base[k] - totalBonus(k);
    const tooltipContent = (k) => {
      const parts = [`Base: ${baseWithoutBonus(k)}`];
      if (raceB[k] > 0) parts.push(`Race: +${raceB[k]}`);
      if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
      return parts.join(' | ');
    };
    // Utiliser l'image du personnage si elle existe, sinon utiliser l'image par défaut
    const characterImage = character.characterImage || (imageIndex === 1 ? testImage1 : testImage2);

    const StatWithTooltip = ({ statKey, label }) => {
      const hasBonus = totalBonus(statKey) > 0;
      return hasBonus ? (
        <Tooltip content={tooltipContent(statKey)}>
          <span className="text-green-400">{label}: {character.base[statKey]}</span>
        </Tooltip>
      ) : (
        <span>{label}: {character.base[statKey]}</span>
      );
    };

    return (
      <div className="relative shadow-2xl overflow-visible">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-stone-200 px-5 py-1.5 text-sm font-bold shadow-lg border border-stone-500 z-10">
          {character.race} • {character.class}
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
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-stone-400"><StatWithTooltip statKey="auto" label="Auto" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="def" label="Déf" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="cap" label="Cap" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="rescap" label="ResC" /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">{races[character.race].icon}</span>
                <span className="text-stone-300">{races[character.race].bonus}</span>
              </div>
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">{classes[character.class].icon}</span>
                <div className="flex-1">
                  <div className="text-stone-200 font-semibold mb-1">{classes[character.class].ability}</div>
                  <div className="text-stone-400 text-[10px]">{getCalculatedDescription(character.class, character.base.cap, character.base.auto)}</div>
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
        <div className="max-w-4xl mx-auto pt-20">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-stone-800 border border-stone-600 px-8 py-3 mb-3">
              <h1 className="text-4xl font-bold text-stone-200">⚔️ Arène de Combat ⚔️</h1>
            </div>
            <p className="text-stone-400">Sélectionnez deux combattants pour le duel</p>
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
                <div className="text-center">
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <span className="text-2xl font-bold text-white">{selectedChar1.name}</span>
                    <span className="text-4xl text-stone-400">⚔️</span>
                    <span className="text-2xl font-bold text-white">{selectedChar2.name}</span>
                  </div>
                  <button
                    onClick={startCombat}
                    className="bg-stone-100 hover:bg-white text-stone-900 px-12 py-4 font-bold text-xl shadow-2xl border-2 border-stone-400 hover:border-stone-600 transition-all"
                  >
                    ⚔️ Commencer le Combat ⚔️
                  </button>
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
        <div className="flex gap-4 items-start justify-center">
          {/* Carte joueur 1 - Gauche */}
          <div className="flex-shrink-0" style={{width: '340px'}}>
            <CharacterCard character={player1} imageIndex={1} />
          </div>

          {/* Zone centrale - Boutons + Chat */}
          <div className="flex-shrink-0 flex flex-col" style={{width: '600px'}}>
            {/* Boutons de contrôle alignés avec le haut des images */}
            <div className="flex justify-center gap-4 mb-4">
              <button
                onClick={simulateCombat}
                disabled={isSimulating}
                className="bg-stone-100 hover:bg-white disabled:bg-stone-600 disabled:text-stone-400 text-stone-900 px-8 py-3 font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg border-2 border-stone-400"
              >
                ▶️ Lancer le combat
              </button>
              <button
                onClick={backToSelection}
                className="bg-stone-700 hover:bg-stone-600 text-stone-200 px-8 py-3 font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg border border-stone-500"
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
            <div className="bg-stone-800 border-2 border-stone-600 shadow-2xl flex flex-col h-[600px]">
              <div className="bg-stone-900 p-3 border-b border-stone-600">
                <h2 className="text-2xl font-bold text-stone-200 text-center">⚔️ Combat en direct</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
                {combatLog.length === 0 ? (
                  <p className="text-stone-500 italic text-center py-8">Cliquez sur "Lancer le combat" pour commencer...</p>
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
                              <div className="bg-stone-700 text-stone-200 px-4 py-2 shadow-lg border-l-4 border-blue-500">
                                <div className="text-sm">{formatLogMessage(cleanLog, true)}</div>
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
                              <div className="bg-stone-700 text-stone-200 px-4 py-2 shadow-lg border-r-4 border-purple-500">
                                <div className="text-sm">{formatLogMessage(cleanLog, false)}</div>
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
          <div className="flex-shrink-0" style={{width: '340px'}}>
            <CharacterCard character={player2} imageIndex={2} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Combat;
