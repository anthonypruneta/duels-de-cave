import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter } from '../services/characterService';
import {
  getPlayerDungeonSummary,
  startDungeonRun,
  endDungeonRun,
  handleLootChoice
} from '../services/dungeonService';
import {
  getAllDungeonLevels,
  getDungeonLevelByNumber,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  DUNGEON_CONSTANTS
} from '../data/dungeons';
import {
  RARITY_COLORS,
  RARITY_BORDER_COLORS,
  RARITY_BG_COLORS
} from '../data/weapons';
import { createBossCombatant, getBossById } from '../data/bosses';
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
import Header from './Header';

const Dungeon = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // États
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);
  const [dungeonSummary, setDungeonSummary] = useState(null);
  const [gameState, setGameState] = useState('lobby'); // lobby, fighting, victory, defeat, loot
  const [currentLevel, setCurrentLevel] = useState(1);
  const [highestLevelBeaten, setHighestLevelBeaten] = useState(0);
  const [lootWeapon, setLootWeapon] = useState(null);
  const [error, setError] = useState(null);

  // États de combat
  const [player, setPlayer] = useState(null);
  const [boss, setBoss] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [combatResult, setCombatResult] = useState(null); // 'victory' ou 'defeat'
  const logEndRef = useRef(null);

  // Charger les données au montage
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;

      setLoading(true);
      try {
        const charResult = await getUserCharacter(currentUser.uid);
        if (!charResult.success || !charResult.data) {
          navigate('/');
          return;
        }
        setCharacter(charResult.data);

        const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
        if (summaryResult.success) {
          setDungeonSummary(summaryResult.data);
        }
      } catch (err) {
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, navigate]);

  // Scroll auto du log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [combatLog]);

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

  // Fonction de résurrection mort-vivant
  const reviveUndead = (target, log, playerColor) => {
    const revive = Math.max(1, Math.round(raceConstants.mortVivant.revivePercent * target.maxHP));
    target.undead = true;
    target.currentHP = revive;
    log.push(`${playerColor} ☠️ ${target.name} ressuscite et revient avec ${revive} PV !`);
  };

  // Traiter l'action d'un combattant (joueur ou boss)
  const processPlayerAction = (att, def, log, isPlayer, bossAbilityCooldown) => {
    if (att.currentHP <= 0 || def.currentHP <= 0) return bossAbilityCooldown;

    att.reflect = false;
    for (const k of Object.keys(cooldowns)) {
      att.cd[k] = (att.cd[k] % cooldowns[k]) + 1;
    }

    const playerColor = isPlayer ? '[JOUEUR]' : '[BOSS]';

    // Passif Sylvari (regen)
    if (att.race === 'Sylvari') {
      const heal = Math.max(1, Math.round(att.maxHP * raceConstants.sylvari.regenPercent));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} 🌿 ${att.name} régénère ${heal} PV`);
    }

    // Passif Demoniste (familier)
    if (att.class === 'Demoniste') {
      const t = tiers15(att.base.cap);
      const { capBase, capPerTier, ignoreResist } = classConstants.demoniste;
      const hit = Math.max(1, Math.round((capBase + capPerTier * t) * att.base.cap));
      const raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
      def.currentHP -= raw;
      log.push(`${playerColor} 💠 Le familier attaque et inflige ${raw} dégâts`);
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def, log, playerColor);
      }
    }

    // Capacité Masochiste
    if (att.class === 'Masochiste') {
      if (att.cd.maso === cooldowns.maso && att.maso_taken > 0) {
        const t = tiers15(att.base.cap);
        const { returnBase, returnPerTier, healPercent } = classConstants.masochiste;
        const dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerTier * t)));
        const healAmount = Math.max(1, Math.round(att.maso_taken * healPercent));
        att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
        att.maso_taken = 0;
        def.currentHP -= dmg;
        log.push(`${playerColor} 🩸 ${att.name} renvoie ${dmg} dégâts et récupère ${healAmount} PV`);
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log, playerColor);
        }
      }
    }

    // Saignement
    if (att.bleed_stacks > 0) {
      const bleedDmg = Math.ceil(att.bleed_stacks / raceConstants.lycan.bleedDivisor);
      att.currentHP -= bleedDmg;
      log.push(`${playerColor} 🩸 ${att.name} saigne et perd ${bleedDmg} PV`);
      if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
        reviveUndead(att, log, playerColor);
      }
    }

    // Capacité Paladin (riposte)
    if (att.class === 'Paladin' && att.cd.pal === cooldowns.pal) {
      const { reflectBase, reflectPerTier } = classConstants.paladin;
      att.reflect = reflectBase + reflectPerTier * tiers15(att.base.cap);
      log.push(`${playerColor} 🛡️ ${att.name} se prépare à riposter (${Math.round(att.reflect * 100)}%)`);
    }

    // Capacité Healer
    if (att.class === 'Healer' && att.cd.heal === cooldowns.heal) {
      const miss = att.maxHP - att.currentHP;
      const { missingHpPercent, capBase, capPerTier } = classConstants.healer;
      const heal = Math.max(1, Math.round(missingHpPercent * miss + (capBase + capPerTier * tiers15(att.base.cap)) * att.base.cap));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
      log.push(`${playerColor} ✚ ${att.name} se soigne de ${heal} PV`);
    }

    // Capacité Voleur (esquive)
    if (att.class === 'Voleur' && att.cd.rog === cooldowns.rog) {
      att.dodge = true;
      log.push(`${playerColor} 🌀 ${att.name} se prépare à esquiver`);
    }

    // ===== CAPACITÉS SPÉCIALES DES BOSS =====
    let newBossCooldown = bossAbilityCooldown;
    if (!isPlayer && att.ability) {
      newBossCooldown++;
      const bossData = getBossById(att.bossId);

      // Bandit: Saignement tous les 2 tours
      if (att.bossId === 'bandit' && newBossCooldown >= att.ability.cooldown) {
        def.bleed_stacks = (def.bleed_stacks || 0) + 1;
        log.push(`${playerColor} 🗡️ ${att.name} applique un saignement !`);
        newBossCooldown = 0;
      }

      // Dragon: Sort +50% dégâts tous les 5 tours
      if (att.bossId === 'dragon' && newBossCooldown >= att.ability.cooldown) {
        const spellDmg = Math.round(att.base.cap * 1.5);
        const raw = dmgCap(spellDmg, def.base.rescap);
        def.currentHP -= raw;
        log.push(`${playerColor} 🔥 ${att.name} lance un Souffle de Flammes dévastateur ! ${raw} dégâts`);
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log, playerColor);
        }
        newBossCooldown = 0;
      }
    }

    // Déterminer le type d'attaque
    const isMage = att.class === 'Mage' && att.cd.mag === cooldowns.mag;
    const isWar = att.class === 'Guerrier' && att.cd.war === cooldowns.war;
    const isArcher = att.class === 'Archer' && att.cd.arc === cooldowns.arc;

    let mult = 1.0;
    if (att.race === 'Orc' && att.currentHP < raceConstants.orc.lowHpThreshold * att.maxHP) {
      mult = raceConstants.orc.damageBonus;
    }

    let hits = isArcher ? classConstants.archer.arrowsBase + classConstants.archer.arrowsPerTier * tiers15(att.base.cap) : 1;
    let total = 0;
    let wasCrit = false;

    for (let i = 0; i < hits; i++) {
      const isCrit = Math.random() < calcCritChance(att);
      if (isCrit) wasCrit = true;
      let raw = 0;

      if (isMage) {
        const { capBase, capPerTier } = classConstants.mage;
        const atkSpell = Math.round(att.base.auto * mult + (capBase + capPerTier * tiers15(att.base.cap)) * att.base.cap * mult);
        raw = dmgCap(atkSpell, def.base.rescap);
        if (i === 0) log.push(`${playerColor} 🔮 ${att.name} lance un sort magique`);
      } else if (isWar) {
        const { ignoreBase, ignorePerTier } = classConstants.guerrier;
        const ignore = ignoreBase + ignorePerTier * tiers15(att.base.cap);
        if (def.base.def <= def.base.rescap) {
          const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
          raw = dmgPhys(Math.round(att.base.auto * mult), effDef);
        } else {
          const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
          raw = dmgCap(Math.round(att.base.cap * mult), effRes);
        }
        if (i === 0) log.push(`${playerColor} 🗡️ ${att.name} frappe pénétrante`);
      } else {
        raw = dmgPhys(Math.round(att.base.auto * mult), def.base.def);
        if (att.race === 'Lycan') {
          def.bleed_stacks = (def.bleed_stacks || 0) + raceConstants.lycan.bleedPerHit;
        }
      }

      if (isCrit) raw = Math.round(raw * generalConstants.critMultiplier);

      if (def.dodge) {
        def.dodge = false;
        log.push(`${playerColor} 💨 ${def.name} esquive !`);
        raw = 0;
      }

      if (def.reflect && raw > 0) {
        const back = Math.round(def.reflect * raw);
        att.currentHP -= back;
        log.push(`${playerColor} 🔁 ${def.name} riposte et renvoie ${back} dégâts`);
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
        const critText = isCrit ? ' CRIT!' : '';
        log.push(`${playerColor} 🏹 Flèche n°${i + 1}: ${raw} dégâts${critText}`);
      }
    }

    if (!isArcher && total > 0) {
      const critText = wasCrit ? ' CRIT!' : '';
      log.push(`${playerColor} ${att.name} inflige ${total} dégâts${critText}`);
    }

    return newBossCooldown;
  };

  // Démarrer une run
  const handleStartRun = async () => {
    setError(null);
    const result = await startDungeonRun(currentUser.uid);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setGameState('fighting');
    setCurrentLevel(1);
    setHighestLevelBeaten(0);
    setCombatResult(null);

    // Préparer le premier combat
    const levelData = getDungeonLevelByNumber(1);
    const playerReady = prepareForCombat(character);
    const bossReady = createBossCombatant(levelData.bossId);

    setPlayer(playerReady);
    setBoss(bossReady);
    setCombatLog([`⚔️ Niveau 1: ${levelData.nom}`]);
  };

  // Lancer le combat
  const simulateCombat = async () => {
    if (!player || !boss || isSimulating) return;
    setIsSimulating(true);
    setCombatResult(null);

    const p = { ...player };
    const b = { ...boss };
    const logs = [...combatLog, `--- Combat contre ${b.name} ---`];
    setCombatLog(logs);

    let turn = 1;
    let bossAbilityCooldown = 0;

    while (p.currentHP > 0 && b.currentHP > 0 && turn <= generalConstants.maxTurns) {
      logs.push(`--- Tour ${turn} ---`);
      setCombatLog([...logs]);
      await new Promise(r => setTimeout(r, 600));

      // Déterminer qui attaque en premier
      const playerFirst = p.base.spd >= b.base.spd;

      if (playerFirst) {
        // Joueur attaque
        const log1 = [];
        processPlayerAction(p, b, log1, true, 0);
        logs.push(...log1);
        setCombatLog([...logs]);
        setPlayer({ ...p });
        setBoss({ ...b });
        await new Promise(r => setTimeout(r, 1000));

        // Boss attaque si encore vivant
        if (p.currentHP > 0 && b.currentHP > 0) {
          const log2 = [];
          bossAbilityCooldown = processPlayerAction(b, p, log2, false, bossAbilityCooldown);
          logs.push(...log2);
          setCombatLog([...logs]);
          setPlayer({ ...p });
          setBoss({ ...b });
          await new Promise(r => setTimeout(r, 1000));
        }
      } else {
        // Boss attaque en premier
        const log1 = [];
        bossAbilityCooldown = processPlayerAction(b, p, log1, false, bossAbilityCooldown);
        logs.push(...log1);
        setCombatLog([...logs]);
        setPlayer({ ...p });
        setBoss({ ...b });
        await new Promise(r => setTimeout(r, 1000));

        // Joueur attaque si encore vivant
        if (p.currentHP > 0 && b.currentHP > 0) {
          const log2 = [];
          processPlayerAction(p, b, log2, true, 0);
          logs.push(...log2);
          setCombatLog([...logs]);
          setPlayer({ ...p });
          setBoss({ ...b });
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      turn++;
    }

    // Résultat du combat
    if (p.currentHP > 0) {
      logs.push(`🏆 Victoire contre ${b.name} !`);
      setCombatLog([...logs]);
      setCombatResult('victory');

      // Mettre à jour le niveau battu
      const newHighest = currentLevel;
      setHighestLevelBeaten(newHighest);

      // Vérifier si on peut continuer
      if (currentLevel < DUNGEON_CONSTANTS.TOTAL_LEVELS) {
        // Préparer le prochain niveau
        await new Promise(r => setTimeout(r, 1500));
        const nextLevel = currentLevel + 1;
        setCurrentLevel(nextLevel);

        const nextLevelData = getDungeonLevelByNumber(nextLevel);
        const nextBoss = createBossCombatant(nextLevelData.bossId);

        // Le joueur garde ses HP actuels
        setBoss(nextBoss);
        setCombatLog([...logs, ``, `⚔️ Niveau ${nextLevel}: ${nextLevelData.nom}`]);
        setCombatResult(null);
      } else {
        // Full clear!
        await new Promise(r => setTimeout(r, 1500));
        const result = await endDungeonRun(currentUser.uid, newHighest);
        if (result.success && result.lootWeapon) {
          setLootWeapon(result.lootWeapon);
          setGameState('loot');
        } else {
          setGameState('victory');
        }
      }
    } else {
      logs.push(`💀 Défaite contre ${b.name}...`);
      setCombatLog([...logs]);
      setCombatResult('defeat');

      // Attendre puis générer le loot du dernier niveau réussi
      await new Promise(r => setTimeout(r, 1500));
      const result = await endDungeonRun(currentUser.uid, highestLevelBeaten, currentLevel);
      if (result.success && result.lootWeapon) {
        setLootWeapon(result.lootWeapon);
        setGameState('loot');
      } else {
        setGameState('defeat');
      }
    }

    setIsSimulating(false);
  };

  // Gérer le choix du loot
  const handleLootDecision = async (equipNew) => {
    if (lootWeapon) {
      await handleLootChoice(currentUser.uid, lootWeapon.id, equipNew);
    }

    const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
    if (summaryResult.success) {
      setDungeonSummary(summaryResult.data);
    }

    setLootWeapon(null);
    setGameState('lobby');
  };

  // Retour au lobby
  const handleBackToLobby = async () => {
    const summaryResult = await getPlayerDungeonSummary(currentUser.uid);
    if (summaryResult.success) {
      setDungeonSummary(summaryResult.data);
    }
    setGameState('lobby');
    setCurrentLevel(1);
    setHighestLevelBeaten(0);
    setPlayer(null);
    setBoss(null);
    setCombatLog([]);
    setCombatResult(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-amber-400 text-2xl">Chargement du donjon...</div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <p className="text-gray-300 text-xl">Vous devez créer un personnage</p>
          <button onClick={() => navigate('/')} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 font-bold">
            Créer un personnage
          </button>
        </div>
      </div>
    );
  }

  const levels = getAllDungeonLevels();
  const currentLevelData = getDungeonLevelByNumber(currentLevel);

  // ============================================================================
  // ÉCRAN DE LOOT
  // ============================================================================
  if (gameState === 'loot' && lootWeapon) {
    const hasCurrentWeapon = dungeonSummary?.equippedWeaponData;

    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-2xl mx-auto pt-20">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎁</div>
            <h2 className="text-4xl font-bold text-amber-400 mb-2">Butin obtenu !</h2>
            <p className="text-gray-300">
              {highestLevelBeaten === DUNGEON_CONSTANTS.TOTAL_LEVELS
                ? 'Vous avez vaincu tous les boss !'
                : highestLevelBeaten > 0
                  ? `Vous avez atteint le niveau ${highestLevelBeaten}`
                  : 'Défaite au premier niveau'}
            </p>
          </div>

          {/* Arme droppée */}
          <div className={`p-6 border-2 ${RARITY_BORDER_COLORS[lootWeapon.rarete]} ${RARITY_BG_COLORS[lootWeapon.rarete]} mb-6`}>
            <div className="text-center">
              {lootWeapon.image ? (
                <img src={lootWeapon.image} alt={lootWeapon.nom} className="w-32 h-auto mx-auto mb-3" />
              ) : (
                <div className="text-6xl mb-3">{lootWeapon.icon}</div>
              )}
              <h3 className={`text-2xl font-bold ${RARITY_COLORS[lootWeapon.rarete]}`}>{lootWeapon.nom}</h3>
              <p className={`text-sm uppercase ${RARITY_COLORS[lootWeapon.rarete]}`}>{lootWeapon.rarete}</p>
              <p className="text-gray-400 text-sm mt-2">{lootWeapon.description}</p>

              <div className="mt-4 flex justify-center gap-4 flex-wrap">
                {Object.entries(lootWeapon.stats).map(([stat, value]) => (
                  <div key={stat} className="bg-stone-800 px-3 py-1 border border-stone-600">
                    <span className="text-gray-400 text-sm">{stat.toUpperCase()}</span>
                    <span className={`ml-2 font-bold ${value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {value > 0 ? '+' : ''}{value}
                    </span>
                  </div>
                ))}
              </div>

              {lootWeapon.effet && (
                <div className="mt-4 bg-amber-900/30 border border-amber-600 p-3">
                  <p className="text-amber-300 font-bold">{lootWeapon.effet.nom}</p>
                  <p className="text-amber-200 text-sm">{lootWeapon.effet.description}</p>
                </div>
              )}
            </div>
          </div>

          {hasCurrentWeapon && (
            <div className="mb-6">
              <p className="text-center text-gray-400 mb-2">Arme actuellement équipée :</p>
              <div className={`p-4 border ${RARITY_BORDER_COLORS[hasCurrentWeapon.rarete]} ${RARITY_BG_COLORS[hasCurrentWeapon.rarete]}`}>
                <div className="flex items-center gap-3">
                  {hasCurrentWeapon.image ? (
                    <img src={hasCurrentWeapon.image} alt={hasCurrentWeapon.nom} className="w-16 h-auto" />
                  ) : (
                    <span className="text-3xl">{hasCurrentWeapon.icon}</span>
                  )}
                  <div>
                    <p className={`font-bold ${RARITY_COLORS[hasCurrentWeapon.rarete]}`}>{hasCurrentWeapon.nom}</p>
                    <div className="flex gap-2">
                      {Object.entries(hasCurrentWeapon.stats).map(([stat, value]) => (
                        <span key={stat} className="text-xs text-gray-400">
                          {stat.toUpperCase()}: {value > 0 ? '+' : ''}{value}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            {hasCurrentWeapon ? (
              <>
                <button onClick={() => handleLootDecision(false)} className="flex-1 bg-stone-700 hover:bg-stone-600 text-white px-6 py-4 font-bold border border-stone-500">
                  Garder mon arme
                </button>
                <button onClick={() => handleLootDecision(true)} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-6 py-4 font-bold border border-amber-500">
                  Équiper la nouvelle
                </button>
              </>
            ) : (
              <button onClick={() => handleLootDecision(true)} className="w-full bg-amber-600 hover:bg-amber-700 text-white px-6 py-4 font-bold border border-amber-500">
                Équiper l'arme
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ÉCRAN DE COMBAT
  // ============================================================================
  if (gameState === 'fighting' && player && boss) {
    const playerHpPercent = Math.max(0, (player.currentHP / player.maxHP) * 100);
    const bossHpPercent = Math.max(0, (boss.currentHP / boss.maxHP) * 100);

    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-6xl mx-auto pt-16">
          {/* Header progression */}
          <div className="text-center mb-6">
            <div className="flex justify-center items-center gap-4 mb-4">
              {levels.map((level, idx) => (
                <div key={level.id} className={`w-10 h-10 flex items-center justify-center border-2 text-sm font-bold ${
                  idx + 1 < currentLevel ? 'bg-green-600 border-green-400 text-white' :
                  idx + 1 === currentLevel ? 'bg-amber-600 border-amber-400 text-white' :
                  'bg-stone-800 border-stone-600 text-stone-500'
                }`}>
                  {idx + 1 < currentLevel ? '✓' : level.niveau}
                </div>
              ))}
            </div>
            <h2 className="text-2xl font-bold text-amber-400">{currentLevelData?.nom}</h2>
          </div>

          {/* Zone de combat */}
          <div className="grid grid-cols-3 gap-4">
            {/* Joueur */}
            <div className="bg-stone-800 p-4 border border-stone-600">
              <div className="text-center">
                {character.characterImage ? (
                  <img src={character.characterImage} alt={character.name} className="w-full max-w-[200px] mx-auto h-auto" />
                ) : (
                  <div className="text-6xl mb-2">{races[character.race]?.icon}</div>
                )}
                <p className="text-white font-bold">{player.name}</p>
                <p className="text-stone-400 text-sm">{player.race} • {player.class}</p>
                <div className="mt-2">
                  <div className="text-sm text-white mb-1">PV: {Math.max(0, player.currentHP)}/{player.maxHP}</div>
                  <div className="bg-stone-900 h-3 border border-stone-600">
                    <div className={`h-full transition-all ${playerHpPercent > 50 ? 'bg-green-500' : playerHpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                         style={{ width: `${playerHpPercent}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Log de combat */}
            <div className="bg-stone-800 border border-stone-600 flex flex-col h-[500px]">
              <div className="bg-stone-900 p-2 border-b border-stone-600">
                <h3 className="text-lg font-bold text-stone-200 text-center">Combat</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1 text-sm">
                {combatLog.map((log, idx) => {
                  if (log.includes('---') || log.includes('⚔️')) {
                    return <div key={idx} className="text-amber-400 font-bold text-center py-1">{log}</div>;
                  }
                  if (log.includes('🏆')) {
                    return <div key={idx} className="text-green-400 font-bold text-center py-2">{log}</div>;
                  }
                  if (log.includes('💀')) {
                    return <div key={idx} className="text-red-400 font-bold text-center py-2">{log}</div>;
                  }
                  const isPlayer = log.startsWith('[JOUEUR]');
                  const isBoss = log.startsWith('[BOSS]');
                  const cleanLog = log.replace(/^\[(JOUEUR|BOSS)\]\s*/, '');
                  return (
                    <div key={idx} className={`py-1 px-2 ${isPlayer ? 'bg-blue-900/30 border-l-2 border-blue-500' : isBoss ? 'bg-red-900/30 border-l-2 border-red-500' : ''}`}>
                      {cleanLog}
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
            </div>

            {/* Boss */}
            <div className="bg-stone-800 p-4 border border-stone-600">
              <div className="text-center">
                {boss.characterImage ? (
                  <img src={boss.characterImage} alt={boss.name} className="w-full max-w-[200px] mx-auto h-auto" />
                ) : (
                  <div className="text-6xl mb-2">{getBossById(boss.bossId)?.icon}</div>
                )}
                <p className="text-white font-bold">{boss.name}</p>
                <p className={`text-sm ${DIFFICULTY_COLORS[currentLevelData?.difficulte]}`}>
                  {DIFFICULTY_LABELS[currentLevelData?.difficulte]}
                </p>
                <div className="mt-2">
                  <div className="text-sm text-white mb-1">PV: {Math.max(0, boss.currentHP)}/{boss.maxHP}</div>
                  <div className="bg-stone-900 h-3 border border-stone-600">
                    <div className={`h-full transition-all ${bossHpPercent > 50 ? 'bg-green-500' : bossHpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                         style={{ width: `${bossHpPercent}%` }} />
                  </div>
                </div>
                {boss.ability && (
                  <div className="mt-3 bg-stone-900/50 p-2 border border-stone-600 text-xs">
                    <p className="text-amber-300 font-bold">{boss.ability.nom}</p>
                    <p className="text-gray-400">{boss.ability.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex justify-center gap-4 mt-6">
            {combatResult === null && (
              <button
                onClick={simulateCombat}
                disabled={isSimulating}
                className="bg-amber-600 hover:bg-amber-700 disabled:bg-stone-600 text-white px-8 py-3 font-bold"
              >
                {isSimulating ? 'Combat en cours...' : 'Lancer le combat'}
              </button>
            )}
            <button onClick={handleBackToLobby} className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-3 font-bold border border-stone-500">
              Abandonner
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ÉCRAN VICTOIRE/DÉFAITE SANS LOOT
  // ============================================================================
  if (gameState === 'victory' || gameState === 'defeat') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <div className="text-8xl mb-6">{gameState === 'victory' ? '🏆' : '💀'}</div>
          <h2 className={`text-4xl font-bold mb-4 ${gameState === 'victory' ? 'text-amber-400' : 'text-red-400'}`}>
            {gameState === 'victory' ? 'Victoire totale !' : 'Défaite...'}
          </h2>
          <p className="text-gray-300 mb-8">
            {gameState === 'victory' ? 'Vous avez vaincu tous les boss !' : 'Aucun loot obtenu.'}
          </p>
          <button onClick={handleBackToLobby} className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 font-bold">
            Retour
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LOBBY
  // ============================================================================
  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-4xl mx-auto pt-20">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-stone-800 border border-stone-600 px-8 py-3">
            <h2 className="text-4xl font-bold text-stone-200">Le Donjon</h2>
          </div>
        </div>

        {/* Info runs */}
        <div className="bg-stone-800 border border-amber-600 p-4 mb-8 flex justify-between items-center">
          <div>
            <p className="text-amber-300 font-bold">Runs aujourd'hui</p>
            <p className="text-white text-2xl">
              {dungeonSummary?.runsRemaining || 0} / {DUNGEON_CONSTANTS.MAX_RUNS_PER_DAY} restantes
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Meilleur run</p>
            <p className="text-amber-400 font-bold">
              {dungeonSummary?.bestRun ? `Niveau ${dungeonSummary.bestRun}` : 'Aucune'}
            </p>
          </div>
        </div>

        {/* Arme équipée */}
        {dungeonSummary?.equippedWeaponData && (
          <div className={`mb-8 p-4 border-2 ${RARITY_BORDER_COLORS[dungeonSummary.equippedWeaponData.rarete]} ${RARITY_BG_COLORS[dungeonSummary.equippedWeaponData.rarete]}`}>
            <div className="flex items-center gap-4">
              {dungeonSummary.equippedWeaponData.image ? (
                <img src={dungeonSummary.equippedWeaponData.image} alt={dungeonSummary.equippedWeaponData.nom} className="w-16 h-auto" />
              ) : (
                <span className="text-4xl">{dungeonSummary.equippedWeaponData.icon}</span>
              )}
              <div className="flex-1">
                <p className="text-sm text-gray-400">Arme équipée</p>
                <p className={`text-xl font-bold ${RARITY_COLORS[dungeonSummary.equippedWeaponData.rarete]}`}>
                  {dungeonSummary.equippedWeaponData.nom}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Aperçu des niveaux */}
        <div className="bg-stone-800 border border-stone-600 p-4 mb-8">
          <h3 className="text-xl font-bold text-amber-400 mb-4 text-center">3 Niveaux progressifs</h3>
          <div className="grid grid-cols-3 gap-4">
            {levels.map((level) => (
              <div key={level.id} className="bg-stone-900/50 p-3 border border-stone-700 text-center">
                <div className="text-3xl mb-2">{getBossById(level.bossId)?.icon}</div>
                <p className="text-white font-bold">Niveau {level.niveau}</p>
                <p className={`text-sm ${DIFFICULTY_COLORS[level.difficulte]}`}>
                  {DIFFICULTY_LABELS[level.difficulte]}
                </p>
                <p className={`text-xs mt-1 ${RARITY_COLORS[level.dropRarity]}`}>
                  Loot: {level.dropRarity}
                </p>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-600 p-4 mb-6 text-center">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button onClick={() => navigate('/')} className="bg-stone-700 hover:bg-stone-600 text-white px-8 py-4 font-bold border border-stone-500">
            Retour
          </button>
          <button
            onClick={handleStartRun}
            disabled={!dungeonSummary?.runsRemaining}
            className={`px-12 py-4 font-bold text-xl ${
              dungeonSummary?.runsRemaining > 0
                ? 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-500'
                : 'bg-stone-700 text-stone-500 cursor-not-allowed border border-stone-600'
            }`}
          >
            {dungeonSummary?.runsRemaining > 0 ? 'Entrer dans le donjon' : 'Plus de runs'}
          </button>
        </div>

        <div className="mt-8 bg-stone-800/50 border border-stone-600 p-4 text-center">
          <p className="text-gray-400 text-sm">
            Vous gardez vos PV entre les niveaux. Si vous êtes vaincu, vous obtenez le loot du dernier niveau réussi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dungeon;
