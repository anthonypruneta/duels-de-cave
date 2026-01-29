import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter, updateCharacterBaseStats } from '../services/characterService';
import { getEquippedWeapon } from '../services/dungeonService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import {
  cooldowns,
  classConstants,
  raceConstants,
  generalConstants,
  tiers15,
  dmgPhys,
  dmgCap,
  calcCritChance
} from '../data/combatMechanics';
import { applyWeaponStats } from '../data/weapons';
import {
  FOREST_DIFFICULTY_COLORS,
  getAllForestLevels,
  getForestLevelByNumber,
  createForestBossCombatant
} from '../data/forestDungeons';
import { applyStatPoints, getStatLabels } from '../utils/statPoints';
import Header from './Header';

const bossImageModules = import.meta.glob('../assets/bosses/*.png', { eager: true, import: 'default' });

const getBossImage = (imageFile) => {
  if (!imageFile) return null;
  return bossImageModules[`../assets/bosses/${imageFile}`] || null;
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

const ForestDungeon = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const logEndRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [equippedWeapon, setEquippedWeapon] = useState(null);
  const [gameState, setGameState] = useState('lobby'); // lobby, fighting, reward, victory, defeat
  const [currentLevel, setCurrentLevel] = useState(1);
  const [player, setPlayer] = useState(null);
  const [boss, setBoss] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null);
  const [currentAction, setCurrentAction] = useState(null);
  const [rewardSummary, setRewardSummary] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;
      setLoading(true);

      const charResult = await getUserCharacter(currentUser.uid);
      if (!charResult.success || !charResult.data) {
        navigate('/');
        return;
      }

      const weaponResult = await getEquippedWeapon(currentUser.uid);
      setEquippedWeapon(weaponResult.success ? weaponResult.weapon : null);
      setCharacter({
        ...charResult.data,
        equippedWeaponData: weaponResult.success ? weaponResult.weapon : null,
        equippedWeaponId: weaponResult.success ? weaponResult.weapon?.id || null : null
      });

      setLoading(false);
    };

    loadData();
  }, [currentUser, navigate]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

  const prepareForCombat = (char) => {
    const weaponId = char?.equippedWeaponId || char?.equippedWeaponData?.id || null;
    const baseWithWeapon = weaponId ? applyWeaponStats(char.base, weaponId) : { ...char.base };
    return {
      ...char,
      base: baseWithWeapon,
      baseWithoutWeapon: char.base,
      currentHP: baseWithWeapon.hp,
      maxHP: baseWithWeapon.hp,
      cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 },
      undead: false,
      dodge: false,
      reflect: false,
      bleed_stacks: 0,
      maso_taken: 0
    };
  };

  const fullHealPlayer = (p) => {
    p.currentHP = p.maxHP;
    p.undead = false;
    p.dodge = false;
    p.reflect = false;
    p.bleed_stacks = 0;
    p.maso_taken = 0;
    p.cd = { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 };
  };

  const reviveUndead = (target, log, playerColor) => {
    const revive = Math.max(1, Math.round(raceConstants.mortVivant.revivePercent * target.maxHP));
    target.undead = true;
    target.currentHP = revive;
    log.push(`${playerColor} ☠️ ${target.name} ressuscite d'entre les morts et revient avec ${revive} points de vie !`);
  };

  const getUnicornMultiplier = (turn) => (turn % 2 === 1 ? 1.15 : 0.85);

  const applyBossIncomingModifier = (defender, damage, turn) => {
    if (defender?.ability?.type !== 'unicorn_cycle') return damage;
    return Math.round(damage * getUnicornMultiplier(turn));
  };

  const applyBossOutgoingModifier = (attacker, damage, turn) => {
    if (attacker?.ability?.type !== 'unicorn_cycle') return damage;
    return Math.round(damage * getUnicornMultiplier(turn));
  };

  const processPlayerAction = (att, def, log, isPlayer, turn) => {
    if (att.currentHP <= 0 || def.currentHP <= 0) return;

    att.reflect = false;
    for (const k of Object.keys(cooldowns)) {
      att.cd[k] = (att.cd[k] % cooldowns[k]) + 1;
    }

    const playerColor = isPlayer ? '[P1]' : '[P2]';

    if (att.race === 'Sylvari') {
      const heal = Math.max(1, Math.round(att.maxHP * raceConstants.sylvari.regenPercent));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} 🌿 ${att.name} régénère naturellement et récupère ${heal} points de vie`);
    }

    if (att.class === 'Demoniste') {
      const t = tiers15(att.base.cap);
      const { capBase, capPerTier, ignoreResist } = classConstants.demoniste;
      const hit = Math.max(1, Math.round((capBase + capPerTier * t) * att.base.cap));
      let raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
      raw = applyBossOutgoingModifier(att, raw, turn);
      raw = applyBossIncomingModifier(def, raw, turn);
      def.currentHP -= raw;
      log.push(`${playerColor} 💠 Le familier de ${att.name} attaque ${def.name} et inflige ${raw} points de dégâts`);
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def, log, playerColor);
      }
    }

    if (att.class === 'Masochiste') {
      if (att.cd.maso === cooldowns.maso && att.maso_taken > 0) {
        const t = tiers15(att.base.cap);
        const { returnBase, returnPerTier, healPercent } = classConstants.masochiste;
        const dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerTier * t)));
        const healAmount = Math.max(1, Math.round(att.maso_taken * healPercent));
        att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
        att.maso_taken = 0;
        let raw = dmg;
        raw = applyBossOutgoingModifier(att, raw, turn);
        raw = applyBossIncomingModifier(def, raw, turn);
        def.currentHP -= raw;
        log.push(`${playerColor} 🩸 ${att.name} renvoie les dégâts accumulés: inflige ${raw} points de dégâts et récupère ${healAmount} points de vie`);
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log, playerColor);
        }
      }
    }

    if (att.race === 'Lycan') {
      const bleedDmg = raceConstants.lycan.bleedPerTurn * (att.bleed_stacks || 0);
      if (bleedDmg > 0) {
        att.currentHP -= bleedDmg;
        log.push(`${playerColor} 🩸 ${att.name} saigne abondamment et perd ${bleedDmg} points de vie`);
        if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
          reviveUndead(att, log, playerColor);
        }
      }
    }

    if (att.class === 'Healer') {
      if (att.cd.heal === cooldowns.heal) {
        const t = tiers15(att.base.cap);
        const { missingHpPercent, capBase, capPerTier } = classConstants.healer;
        const missing = att.maxHP - att.currentHP;
        const healPercent = missingHpPercent + capBase + capPerTier * t;
        const heal = Math.max(1, Math.round(missing * healPercent));
        att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
        log.push(`${playerColor} ✚ ${att.name} lance un sort de soin puissant et récupère ${heal} points de vie`);
      }
    }

    const isArcher = att.class === 'Archer';
    const isMage = att.class === 'Mage';
    const isWar = att.class === 'Guerrier';

    const paladinReflect = att.class === 'Paladin';
    if (paladinReflect) {
      const t = tiers15(att.base.cap);
      const { reflectBase, reflectPerTier } = classConstants.paladin;
      att.reflect = reflectBase + reflectPerTier * t;
    }

    const masochisteReflect = att.class === 'Masochiste';
    if (masochisteReflect) {
      const t = tiers15(att.base.cap);
      const { returnBase, returnPerTier } = classConstants.masochiste;
      att.reflect = returnBase + returnPerTier * t;
    }

    let total = 0;
    const attacks = isArcher ? classConstants.archer.arrowsBase + classConstants.archer.arrowsPerTier * tiers15(att.base.cap) : 1;
    let wasCrit = false;

    for (let i = 0; i < attacks; i++) {
      let raw = 0;
      const ignore = isWar ? classConstants.guerrier.ignoreBase + classConstants.guerrier.ignorePerTier * tiers15(att.base.cap) : 0;
      const critChance = calcCritChance(att.base.spd, def.base.spd);
      const isCrit = Math.random() < critChance;
      wasCrit = wasCrit || isCrit;
      const mult = isCrit ? 1.5 : 1;

      if (isMage) {
        const t = tiers15(att.base.cap);
        const { capBase, capPerTier } = classConstants.mage;
        const atkSpell = Math.round(att.base.auto * mult + (capBase + capPerTier * t) * att.base.cap * mult);
        raw = dmgCap(atkSpell, def.base.rescap);
      } else if (isWar) {
        if (def.base.def <= def.base.rescap) {
          const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
          raw = dmgPhys(Math.round(att.base.auto * mult), effDef);
        } else {
          const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
          raw = dmgCap(Math.round(att.base.cap * mult), effRes);
        }
      } else {
        raw = dmgPhys(Math.round(att.base.auto * mult), def.base.def);
        if (att.race === 'Lycan') {
          def.bleed_stacks = (def.bleed_stacks || 0) + raceConstants.lycan.bleedPerHit;
        }
      }

      if (att.rageReady) {
        raw = Math.round(raw * 2);
        att.rageReady = false;
        log.push(`${playerColor} 💢 ${att.name} libère sa rage et double ses dégâts !`);
      }

      raw = applyBossOutgoingModifier(att, raw, turn);
      raw = applyBossIncomingModifier(def, raw, turn);

      if (def.dodge) {
        def.dodge = false;
        log.push(`${playerColor} 💨 ${def.name} esquive habilement l'attaque !`);
        continue;
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

    if (def?.ability?.type === 'bear_rage' && !def.rageReady && def.currentHP > 0 && def.currentHP <= def.maxHP * 0.25) {
      def.rageReady = true;
      log.push(`${playerColor} 🐻 ${def.name} entre en rage et prépare un coup dévastateur !`);
    }
  };

  const rollForestRewards = (levelData) => {
    const statsPool = ['hp', 'auto', 'def', 'rescap', 'spd', 'cap'];
    const pointsByStat = {};

    for (let i = 0; i < levelData.rewardRolls; i++) {
      const stat = statsPool[Math.floor(Math.random() * statsPool.length)];
      pointsByStat[stat] = (pointsByStat[stat] || 0) + 2;
    }

    const gainsByStat = {};
    let updatedBase = { ...character.base };
    Object.entries(pointsByStat).forEach(([stat, points]) => {
      const { updatedStats, delta } = applyStatPoints(updatedBase, stat, points);
      updatedBase = updatedStats;
      gainsByStat[stat] = (gainsByStat[stat] || 0) + delta;
    });

    return { updatedBase, gainsByStat };
  };

  const handleStartRun = () => {
    setGameState('fighting');
    setCurrentLevel(1);
    setCombatResult(null);
    setCurrentAction(null);
    setRewardSummary(null);

    const levelData = getForestLevelByNumber(1);
    const playerReady = prepareForCombat(character);
    const bossReady = createForestBossCombatant(levelData.boss);

    setPlayer(playerReady);
    setBoss(bossReady);
    setCombatLog([`⚔️ Niveau 1: ${levelData.nom} — ${playerReady.name} vs ${bossReady.name} !`]);
  };

  const simulateCombat = async () => {
    if (!player || !boss || isSimulating) return;
    setIsSimulating(true);
    setCombatResult(null);

    const p = { ...player };
    const b = { ...boss };
    const logs = [...combatLog, `--- Combat contre ${b.name} ---`];
    setCombatLog(logs);

    let turn = 1;

    while (p.currentHP > 0 && b.currentHP > 0 && turn <= generalConstants.maxTurns) {
      logs.push(`--- Début du tour ${turn} ---`);
      if (b?.ability?.type === 'unicorn_cycle') {
        const mult = turn % 2 === 1 ? '+15%' : '-15%';
        logs.push(`✨ ${b.name} alterne sa magie (${mult} dégâts infligés et reçus)`);
      }
      setCombatLog([...logs]);
      await new Promise(r => setTimeout(r, 800));

      const playerFirst = p.base.spd >= b.base.spd;
      const first = playerFirst ? p : b;
      const second = playerFirst ? b : p;
      const firstIsPlayer = playerFirst;

      const log1 = [];
      setCurrentAction({ player: firstIsPlayer ? 1 : 2, logs: [] });
      await new Promise(r => setTimeout(r, 300));
      processPlayerAction(first, second, log1, firstIsPlayer, turn);
      setCurrentAction({ player: firstIsPlayer ? 1 : 2, logs: log1 });
      logs.push(...log1);
      setCombatLog([...logs]);
      setPlayer({ ...p });
      setBoss({ ...b });
      await new Promise(r => setTimeout(r, 2000));
      setCurrentAction(null);

      if (p.currentHP > 0 && b.currentHP > 0) {
        const log2 = [];
        setCurrentAction({ player: !firstIsPlayer ? 1 : 2, logs: [] });
        await new Promise(r => setTimeout(r, 300));
        processPlayerAction(second, first, log2, !firstIsPlayer, turn);
        setCurrentAction({ player: !firstIsPlayer ? 1 : 2, logs: log2 });
        logs.push(...log2);
        setCombatLog([...logs]);
        setPlayer({ ...p });
        setBoss({ ...b });
        await new Promise(r => setTimeout(r, 2000));
        setCurrentAction(null);
      }

      turn++;
    }

    if (p.currentHP > 0) {
      logs.push(`🏆 ${p.name} remporte glorieusement le combat contre ${b.name} !`);
      setCombatLog([...logs]);
      setCombatResult('victory');

      const levelData = getForestLevelByNumber(currentLevel);
      const rewardResult = rollForestRewards(levelData);
      const updatedCharacter = {
        ...character,
        base: rewardResult.updatedBase
      };
      setCharacter(updatedCharacter);
      updateCharacterBaseStats(currentUser.uid, rewardResult.updatedBase);

      const nextLevel = currentLevel + 1;
      setRewardSummary({
        gainsByStat: rewardResult.gainsByStat,
        hasNextLevel: nextLevel <= getAllForestLevels().length,
        nextLevel
      });
      setGameState('reward');
    } else {
      logs.push(`💀 ${p.name} a été vaincu par ${b.name}...`);
      setCombatLog([...logs]);
      setCombatResult('defeat');
      setGameState('defeat');
    }

    setIsSimulating(false);
  };

  const handleRewardContinue = () => {
    if (!rewardSummary) return;
    if (rewardSummary.hasNextLevel) {
      const nextLevelData = getForestLevelByNumber(rewardSummary.nextLevel);
      const refreshedPlayer = prepareForCombat({
        ...character,
        equippedWeaponData: equippedWeapon,
        equippedWeaponId: equippedWeapon?.id || null
      });
      fullHealPlayer(refreshedPlayer);
      const nextBoss = createForestBossCombatant(nextLevelData.boss);
      setCurrentLevel(rewardSummary.nextLevel);
      setPlayer(refreshedPlayer);
      setBoss(nextBoss);
      setCombatLog([
        `⚔️ Niveau ${rewardSummary.nextLevel}: ${nextLevelData.nom} — ${refreshedPlayer.name} vs ${nextBoss.name} !`
      ]);
      setRewardSummary(null);
      setCombatResult(null);
      setGameState('fighting');
    } else {
      setRewardSummary(null);
      setGameState('victory');
    }
  };

  const handleBackToLobby = () => {
    setGameState('lobby');
    setCurrentLevel(1);
    setPlayer(null);
    setBoss(null);
    setCombatLog([]);
    setCombatResult(null);
    setCurrentAction(null);
    setRewardSummary(null);
  };

  const formatLogMessage = (text) => {
    if (!player || !boss) return text;

    const pName = player.name;
    const bName = boss.name;
    const parts = [];
    let key = 0;

    const processText = (str) => {
      const result = [];
      const nameRegex = new RegExp(`(${pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
      const nameParts = str.split(nameRegex);

      nameParts.forEach((part) => {
        if (part === pName) {
          result.push(<span key={`name-${key++}`} className="font-bold text-blue-400">{part}</span>);
        } else if (part === bName) {
          result.push(<span key={`name-${key++}`} className="font-bold text-purple-400">{part}</span>);
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

  const PlayerCard = ({ char }) => {
    if (!char) return null;
    const hpPercent = (char.currentHP / char.maxHP) * 100;
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const raceB = char.bonuses?.race || {};
    const classB = char.bonuses?.class || {};
    const totalBonus = (k) => (raceB[k] || 0) + (classB[k] || 0);
    const baseStats = char.baseWithoutWeapon || char.base;
    const baseWithoutBonus = (k) => baseStats[k] - totalBonus(k);
    const tooltipContent = (k) => {
      const parts = [`Base: ${baseWithoutBonus(k)}`];
      if (raceB[k] > 0) parts.push(`Race: +${raceB[k]}`);
      if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
      return parts.join(' | ');
    };

    const StatWithTooltip = ({ statKey, label }) => {
      const hasBonus = totalBonus(statKey) > 0;
      return hasBonus ? (
        <Tooltip content={tooltipContent(statKey)}>
          <span className="text-green-400">{label}: {baseStats[statKey]}</span>
        </Tooltip>
      ) : (
        <span>{label}: {baseStats[statKey]}</span>
      );
    };

    return (
      <div className="relative shadow-2xl overflow-visible">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-stone-200 px-5 py-1.5 text-sm font-bold shadow-lg border border-stone-500 z-10">
          {char.race} • {char.class}
        </div>
        <div className="overflow-visible">
          <div className="h-auto relative bg-stone-900 flex items-center justify-center">
            <div className="w-full h-48 flex items-center justify-center">
              <span className="text-7xl">{races[char.race]?.icon || '❓'}</span>
            </div>
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-3">
              <div className="text-white font-bold text-xl text-center">{char.name}</div>
            </div>
          </div>
          <div className="bg-stone-800 p-4 border-t border-stone-600">
            <div className="mb-3">
              <div className="flex justify-between text-sm text-white mb-2">
                <StatWithTooltip statKey="hp" label="HP" />
                <StatWithTooltip statKey="spd" label="VIT" />
              </div>
              <div className="text-xs text-stone-400 mb-2">{char.name} — PV {Math.max(0, char.currentHP)}/{char.maxHP}</div>
              <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600">
                <div className={`h-full transition-all duration-500 ${hpClass}`} style={{ width: `${hpPercent}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-stone-400"><StatWithTooltip statKey="auto" label="ATK" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="def" label="DEF" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="cap" label="CAP" /></div>
              <div className="text-stone-400"><StatWithTooltip statKey="rescap" label="RESC" /></div>
            </div>
            <div className="space-y-2">
              {races[char.race] && (
                <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                  <span className="text-lg">{races[char.race].icon}</span>
                  <span className="text-stone-300">{races[char.race].bonus}</span>
                </div>
              )}
              {classes[char.class] && (
                <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                  <span className="text-lg">{classes[char.class].icon}</span>
                  <div className="flex-1">
                    <div className="text-stone-200 font-semibold mb-1">{classes[char.class].ability}</div>
                    <div className="text-stone-400 text-[10px]">{classes[char.class].description}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const BossCard = ({ bossChar }) => {
    if (!bossChar) return null;
    const hpPercent = (bossChar.currentHP / bossChar.maxHP) * 100;
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const levelData = getForestLevelByNumber(currentLevel);
    const bossImg = getBossImage(bossChar.imageFile);

    return (
      <div className="relative shadow-2xl overflow-visible">
        <div className={`absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 px-5 py-1.5 text-sm font-bold shadow-lg border border-stone-500 z-10 ${FOREST_DIFFICULTY_COLORS[levelData?.difficulte] || 'text-stone-200'}`}>
          Boss • {levelData?.difficulte || 'Forêt'}
        </div>
        <div className="overflow-visible">
          <div className="h-auto relative bg-stone-900 flex items-center justify-center">
            {bossImg ? (
              <img src={bossImg} alt={bossChar.name} className="w-full h-auto object-contain" />
            ) : (
              <div className="w-full h-48 flex items-center justify-center">
                <span className="text-7xl">{levelData?.boss?.icon || '🌲'}</span>
              </div>
            )}
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-3">
              <div className="text-white font-bold text-xl text-center">{bossChar.name}</div>
            </div>
          </div>
          <div className="bg-stone-800 p-4 border-t border-stone-600">
            <div className="mb-3">
              <div className="flex justify-between text-sm text-white mb-2">
                <span>HP: {bossChar.base.hp}</span>
                <span>VIT: {bossChar.base.spd}</span>
              </div>
              <div className="text-xs text-stone-400 mb-2">{bossChar.name} — PV {Math.max(0, bossChar.currentHP)}/{bossChar.maxHP}</div>
              <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600">
                <div className={`h-full transition-all duration-500 ${hpClass}`} style={{ width: `${hpPercent}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="text-stone-400">ATK: {bossChar.base.auto}</div>
              <div className="text-stone-400">DEF: {bossChar.base.def}</div>
              <div className="text-stone-400">CAP: {bossChar.base.cap}</div>
              <div className="text-stone-400">RESC: {bossChar.base.rescap}</div>
            </div>
            {bossChar.ability && (
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">⚡</span>
                <div className="flex-1">
                  <div className="text-amber-300 font-semibold mb-1">{bossChar.ability.name}</div>
                  <div className="text-stone-400 text-[10px]">{bossChar.ability.description}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-emerald-400 text-2xl">Chargement de la forêt...</div>
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

  const levels = getAllForestLevels();

  if (gameState === 'reward' && rewardSummary) {
    const labels = getStatLabels();
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Header />
        <div className="bg-stone-800 border border-emerald-600 p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🌲</div>
          <h2 className="text-3xl font-bold text-emerald-300 mb-4">Victoire !</h2>
          <p className="text-stone-300 mb-6">
            Gains :{' '}
            {Object.entries(rewardSummary.gainsByStat).map(([stat, value], index) => (
              <span key={stat} className="text-emerald-200 font-semibold">
                {labels[stat] || stat} +{value}{index < Object.keys(rewardSummary.gainsByStat).length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
          <button
            onClick={handleRewardContinue}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 font-bold"
          >
            {rewardSummary.hasNextLevel ? 'Continuer' : 'Terminer'}
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'victory' || gameState === 'defeat') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <div className="text-8xl mb-6">{gameState === 'victory' ? '🏆' : '💀'}</div>
          <h2 className={`text-4xl font-bold mb-4 ${gameState === 'victory' ? 'text-emerald-400' : 'text-red-400'}`}>
            {gameState === 'victory' ? 'Victoire totale !' : 'Défaite...'}
          </h2>
          <p className="text-gray-300 mb-8">
            {gameState === 'victory' ? 'La forêt vous renforce.' : 'Aucun gain cette fois-ci.'}
          </p>
          <button onClick={handleBackToLobby} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 font-bold">
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'fighting') {
    const currentLevelData = getForestLevelByNumber(currentLevel);
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-6xl mx-auto pt-20">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-stone-800 border border-emerald-600 px-8 py-3">
              <h2 className="text-4xl font-bold text-emerald-300">Forêt — Niveau {currentLevelData?.niveau}</h2>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-center gap-4">
            <button
              onClick={simulateCombat}
              disabled={isSimulating || !player || !boss}
              className={`px-8 py-3 font-bold ${
                isSimulating ? 'bg-stone-700 text-stone-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isSimulating ? 'Combat en cours...' : 'Lancer le combat'}
            </button>
            <button
              onClick={handleBackToLobby}
              className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-3 font-bold border border-stone-500"
            >
              Quitter
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-shrink-0" style={{ width: '340px' }}>
              <PlayerCard char={player} />
            </div>

            <div className="flex-1 bg-stone-800 border border-stone-600 p-4 h-[520px] overflow-y-auto">
              <div className="text-center text-emerald-300 font-bold mb-4">Journal du combat</div>
              <div className="space-y-2 text-sm">
                {combatLog.map((log, idx) => {
                  const cleanLog = log.trim();
                  if (!cleanLog) return <div key={idx} className="h-2" />;
                  const isP1 = cleanLog.startsWith('[P1]');
                  const isP2 = cleanLog.startsWith('[P2]');

                  if (isP1) {
                    return (
                      <div key={idx} className="flex justify-start">
                        <div className="max-w-[80%]">
                          <div className="bg-stone-700 text-stone-200 px-4 py-2 shadow-lg border-l-4 border-blue-500">
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
                          <div className="bg-stone-700 text-stone-200 px-4 py-2 shadow-lg border-r-4 border-purple-500">
                            <div className="text-sm">{formatLogMessage(cleanLog)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className="flex justify-center">
                      <div className="text-stone-400 text-sm italic">{cleanLog}</div>
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
            </div>

            <div className="flex-shrink-0" style={{ width: '340px' }}>
              <BossCard bossChar={boss} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-4xl mx-auto pt-20">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-stone-800 border border-emerald-600 px-8 py-3">
            <h2 className="text-4xl font-bold text-emerald-300">La Forêt</h2>
          </div>
        </div>

        <div className="bg-stone-800 border border-stone-600 p-4 mb-8">
          <h3 className="text-xl font-bold text-emerald-300 mb-4 text-center">3 niveaux progressifs</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {levels.map((level) => (
              <div key={level.id} className="bg-stone-900/50 p-3 border border-stone-700 text-center">
                <div className="text-3xl mb-2">
                  {getBossImage(level.boss.imageFile) ? (
                    <img
                      src={getBossImage(level.boss.imageFile)}
                      alt={level.boss.nom}
                      className="w-12 h-auto mx-auto"
                    />
                  ) : (
                    level.boss.icon
                  )}
                </div>
                <p className="text-white font-bold">Niveau {level.niveau}</p>
                <p className={`text-sm ${FOREST_DIFFICULTY_COLORS[level.difficulte]}`}>
                  {level.difficulte}
                </p>
                <p className="text-xs mt-1 text-emerald-200">
                  Gains: {level.rewardRolls} stats tirées
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <button onClick={() => navigate('/')} className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 font-bold border border-stone-500">
            Retour
          </button>
          <button
            onClick={handleStartRun}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-4 font-bold text-xl border border-emerald-500"
          >
            Entrer dans la forêt
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForestDungeon;
