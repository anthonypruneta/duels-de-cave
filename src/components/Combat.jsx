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
import {
  applyGungnirDebuff,
  applyMjollnirStun,
  applyPassiveWeaponStats,
  initWeaponCombatState,
  modifyCritDamage,
  onAttack,
  onHeal,
  onSpellCast,
  onTurnStart
} from '../utils/weaponEffects';
import {
  cooldowns,
  classConstants,
  raceConstants,
  generalConstants,
  weaponConstants,
  dmgPhys,
  dmgCap,
  calcCritChance
} from '../data/combatMechanics';

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

const getUnicornPactTurnData = (passiveDetails, turn) => {
  if (!passiveDetails || passiveDetails.id !== 'unicorn_pact') return null;
  const isTurnA = turn % 2 === 1;
  return isTurnA ? { label: 'Tour A', ...passiveDetails.levelData.turnA } : { label: 'Tour B', ...passiveDetails.levelData.turnB };
};

const getAuraBonus = (passiveDetails, turn) => {
  if (!passiveDetails || passiveDetails.id !== 'aura_overload') return 0;
  return turn <= passiveDetails.levelData.turns ? passiveDetails.levelData.damageBonus : 0;
};

const applyStartOfCombatPassives = (attacker, defender, log, label) => {
  const passiveDetails = getPassiveDetails(attacker.mageTowerPassive);
  if (!passiveDetails) return;

  if (passiveDetails.id === 'arcane_barrier') {
    const shieldValue = Math.max(1, Math.round(attacker.maxHP * passiveDetails.levelData.shieldPercent));
    attacker.shield = shieldValue;
    log.push(`${label} 🛡️ Barrière arcanique: ${attacker.name} gagne un bouclier de ${shieldValue} PV.`);
  }

  if (passiveDetails.id === 'mind_breach') {
    const reduction = passiveDetails.levelData.defReduction;
    defender.base.def = Math.max(0, Math.round(defender.base.def * (1 - reduction)));
    log.push(`${label} 🧠 Brèche mentale: ${defender.name} perd ${Math.round(reduction * 100)}% de DEF.`);
  }

  defender.spectralMarked = false;
  defender.spectralMarkBonus = 0;
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
  const [isSoundOpen, setIsSoundOpen] = useState(true);
  const [volume, setVolume] = useState(0.3);
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
      setVolume(0.3);
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
        const { capBase, capPerCap, ignoreResist } = classConstants.demoniste;
        const familierPct = capBase + capPerCap * cap;
        const familierDmgTotal = Math.round(familierPct * cap);
        const ignoreResistPct = Math.round(ignoreResist * 100);
        return (
          <>
            Familier:{' '}
            <Tooltip content={`${(familierPct * 100).toFixed(1)}% de la Cap (${cap})`}>
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

  // Préparer un personnage pour le combat
  const prepareForCombat = (char) => {
    const weaponId = char?.equippedWeaponId || char?.equippedWeaponData?.id || null;
    const baseWithBoosts = applyStatBoosts(char.base, char.forestBoosts);
    const baseWithWeapon = applyPassiveWeaponStats(baseWithBoosts, weaponId, char.class);
    const weaponState = initWeaponCombatState(char, weaponId);
    return {
      ...char,
      base: baseWithWeapon,
      baseWithoutWeapon: baseWithBoosts,
      currentHP: baseWithWeapon.hp,
      maxHP: baseWithWeapon.hp,
      cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 },
      undead: false,
      dodge: false,
      reflect: false,
      bleed_stacks: 0,
      maso_taken: 0,
      shield: 0,
      spectralMarked: false,
      spectralMarkBonus: 0,
      stunned: false,
      stunnedTurns: 0,
      weaponState
    };
  };

  // Fonctions utilitaires importées depuis combatMechanics.js

  const reviveUndead = (target, log, playerColor) => {
    const revive = Math.max(1, Math.round(raceConstants.mortVivant.revivePercent * target.maxHP));
    target.undead = true;
    target.currentHP = revive;
    log.push(`${playerColor} ☠️ ${target.name} ressuscite d'entre les morts et revient avec ${revive} points de vie !`);
  };

  const processPlayerAction = (att, def, log, isP1, turn) => {
    if (att.currentHP <= 0 || def.currentHP <= 0) return;

      const playerColor = isP1 ? '[P1]' : '[P2]';
      const attackerPassive = getPassiveDetails(att.mageTowerPassive);
      const defenderPassive = getPassiveDetails(def.mageTowerPassive);
      const attackerUnicorn = getUnicornPactTurnData(attackerPassive, turn);
      const defenderUnicorn = getUnicornPactTurnData(defenderPassive, turn);
      const auraBonus = getAuraBonus(attackerPassive, turn);
      let skillUsed = false;

      const applyMageTowerDamage = (
        attacker,
        defender,
        raw,
        isCrit,
        combatLog,
        atkPassive,
        defPassive,
        atkUnicorn,
        defUnicorn,
        auraBoost
      ) => {
        let adjusted = raw;

        if (atkUnicorn) {
          adjusted = Math.round(adjusted * (1 + atkUnicorn.outgoing));
        }
        if (auraBoost) {
          adjusted = Math.round(adjusted * (1 + auraBoost));
        }
        if (defender.spectralMarked && defender.spectralMarkBonus) {
          adjusted = Math.round(adjusted * (1 + defender.spectralMarkBonus));
        }
        if (defUnicorn) {
          adjusted = Math.round(adjusted * (1 + defUnicorn.incoming));
        }
        if (defPassive?.id === 'obsidian_skin' && isCrit) {
          adjusted = Math.round(adjusted * (1 - defPassive.levelData.critReduction));
        }

        if (defender.dodge) {
          defender.dodge = false;
          combatLog.push(`${playerColor} 💨 ${defender.name} esquive habilement l'attaque !`);
          return 0;
        }

        if (defender.shield > 0 && adjusted > 0) {
          const absorbed = Math.min(defender.shield, adjusted);
          defender.shield -= absorbed;
          adjusted -= absorbed;
          combatLog.push(`${playerColor} 🛡️ ${defender.name} absorbe ${absorbed} points de dégâts grâce à un bouclier`);
        }

        if (defender.reflect && adjusted > 0) {
          const back = Math.round(defender.reflect * adjusted);
          attacker.currentHP -= back;
          combatLog.push(`${playerColor} 🔁 ${defender.name} riposte et renvoie ${back} points de dégâts à ${attacker.name}`);
        }

        if (adjusted > 0) {
          defender.currentHP -= adjusted;
          defender.maso_taken = (defender.maso_taken || 0) + adjusted;
        }

        if (atkPassive?.id === 'spectral_mark' && adjusted > 0 && !defender.spectralMarked) {
          defender.spectralMarked = true;
          defender.spectralMarkBonus = atkPassive.levelData.damageTakenBonus;
          combatLog.push(`${playerColor} 🟣 ${defender.name} est marqué et subira +${Math.round(defender.spectralMarkBonus * 100)}% dégâts.`);
        }

        if (atkPassive?.id === 'essence_drain' && adjusted > 0) {
          const heal = Math.max(1, Math.round(attacker.maxHP * atkPassive.levelData.healPercent));
          attacker.currentHP = Math.min(attacker.maxHP, attacker.currentHP + heal);
          combatLog.push(`${playerColor} 🩸 ${attacker.name} siphonne ${heal} points de vie grâce au Vol d’essence`);
        }

        return adjusted;
      };
      if (att.stunnedTurns > 0) {
        att.stunnedTurns -= 1;
        if (att.stunnedTurns <= 0) {
          att.stunned = false;
        }
        log.push(`${playerColor} 😵 ${att.name} est étourdi et ne peut pas agir ce tour`);
        return;
      }

      att.reflect = false;
      for (const k of Object.keys(cooldowns)) {
        att.cd[k] = (att.cd[k] % cooldowns[k]) + 1;
      }

      const turnEffects = onTurnStart(att.weaponState, att, turn);
      if (turnEffects.log.length > 0) {
        log.push(...turnEffects.log.map(entry => `${playerColor} ${entry}`));
      }
      if (turnEffects.regen > 0) {
        att.currentHP = Math.min(att.maxHP, att.currentHP + turnEffects.regen);
      }

      if (att.race === 'Sylvari') {
        const heal = Math.max(1, Math.round(att.maxHP * raceConstants.sylvari.regenPercent));
        att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
        log.push(`${playerColor} 🌿 ${att.name} régénère naturellement et récupère ${heal} points de vie`);
      }

      if (att.class === 'Demoniste') {
        const { capBase, capPerCap, ignoreResist } = classConstants.demoniste;
        const hit = Math.max(1, Math.round((capBase + capPerCap * att.base.cap) * att.base.cap));
        const raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
        const inflicted = applyMageTowerDamage(att, def, raw, false, log, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
        log.push(`${playerColor} 💠 Le familier de ${att.name} attaque ${def.name} et inflige ${inflicted} points de dégâts`);
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log, playerColor);
        }
      }

      if (att.class === 'Masochiste') {
        if (att.cd.maso === cooldowns.maso && att.maso_taken > 0) {
          skillUsed = true;
          const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
          const dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerCap * att.base.cap)));
          const healAmount = Math.max(1, Math.round(att.maso_taken * healPercent));
          att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
          att.maso_taken = 0;
          const inflicted = applyMageTowerDamage(att, def, dmg, false, log, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
          log.push(`${playerColor} 🩸 ${att.name} renvoie les dégâts accumulés: inflige ${inflicted} points de dégâts et récupère ${healAmount} points de vie`);
          if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
            reviveUndead(def, log, playerColor);
          }
        }
      }

      if (att.bleed_stacks > 0) {
        const bleedDmg = Math.ceil(att.bleed_stacks / raceConstants.lycan.bleedDivisor);
        att.currentHP -= bleedDmg;
        log.push(`${playerColor} 🩸 ${att.name} saigne abondamment et perd ${bleedDmg} points de vie`);
        if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
          reviveUndead(att, log, playerColor);
        }
      }

      if (att.class === 'Paladin' && att.cd.pal === cooldowns.pal) {
        skillUsed = true;
        const { reflectBase, reflectPerCap } = classConstants.paladin;
        att.reflect = reflectBase + reflectPerCap * att.base.cap;
        log.push(`${playerColor} 🛡️ ${att.name} se prépare à riposter et renverra ${Math.round(att.reflect * 100)}% des dégâts`);
      }

      if (att.class === 'Healer' && att.cd.heal === cooldowns.heal) {
        skillUsed = true;
        const miss = att.maxHP - att.currentHP;
        const { missingHpPercent, capScale } = classConstants.healer;
        const heal = Math.max(1, Math.round(missingHpPercent * miss + capScale * att.base.cap));
        att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
        log.push(`${playerColor} ✚ ${att.name} lance un sort de soin puissant et récupère ${heal} points de vie`);
        const healEffects = onHeal(att.weaponState, att, heal, def);
        if (healEffects.bonusDamage > 0) {
          const bonusDmg = dmgCap(healEffects.bonusDamage, def.base.rescap);
          applyMageTowerDamage(att, def, bonusDmg, false, log, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
          log.push(`${playerColor} ${healEffects.log.join(' ')}`);
        }
      }

      if (att.class === 'Voleur' && att.cd.rog === cooldowns.rog) {
        skillUsed = true;
        att.dodge = true;
        log.push(`${playerColor} 🌀 ${att.name} entre dans une posture d'esquive et évitera la prochaine attaque`);
      }

      const isMage = att.class === 'Mage' && att.cd.mag === cooldowns.mag;
      const isWar = att.class === 'Guerrier' && att.cd.war === cooldowns.war;
      const isArcher = att.class === 'Archer' && att.cd.arc === cooldowns.arc;
      skillUsed = skillUsed || isMage || isWar || isArcher;

      let mult = 1.0;
      if (att.race === 'Orc' && att.currentHP < raceConstants.orc.lowHpThreshold * att.maxHP) {
        mult = raceConstants.orc.damageBonus;
      }
      if (turnEffects.damageMultiplier !== 1) {
        mult *= turnEffects.damageMultiplier;
      }

      const baseHits = isArcher ? classConstants.archer.hitCount : 1;
      const totalHits = baseHits + (turnEffects.bonusAttacks || 0);
      let total = 0;
      let wasCrit = false;

      const forceCrit = attackerPassive?.id === 'obsidian_skin'
        && att.currentHP <= att.maxHP * attackerPassive.levelData.critThreshold;

      for (let i = 0; i < totalHits; i++) {
        const isBonusAttack = i >= baseHits;
        const isCrit = turnEffects.guaranteedCrit ? true : forceCrit ? true : Math.random() < calcCritChance(att);
        if (isCrit) wasCrit = true;
        let raw = 0;
        const attackMultiplier = mult * (isBonusAttack ? (turnEffects.bonusAttackDamage || 1) : 1);

        if (isMage) {
          const { capBase, capPerCap } = classConstants.mage;
          const atkSpell = Math.round(att.base.auto * attackMultiplier + (capBase + capPerCap * att.base.cap) * att.base.cap * attackMultiplier);
          raw = dmgCap(atkSpell, def.base.rescap);
          if (i === 0) log.push(`${playerColor} 🔮 ${att.name} invoque un puissant sort magique`);
          const spellEffects = onSpellCast(att.weaponState, att, def, raw, 'mage');
          if (spellEffects.doubleCast) {
            const secondCast = applyMageTowerDamage(att, def, spellEffects.secondCastDamage, false, log, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
            log.push(`${playerColor} ${spellEffects.log.join(' ')}`);
          }
        } else if (isWar) {
          const { ignoreBase, ignorePerCap } = classConstants.guerrier;
          const ignore = ignoreBase + ignorePerCap * att.base.cap;
          if (def.base.def <= def.base.rescap) {
            const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
            raw = dmgPhys(Math.round(att.base.auto * attackMultiplier), effDef);
          } else {
            const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
            raw = dmgCap(Math.round(att.base.cap * attackMultiplier), effRes);
          }
          if (i === 0) log.push(`${playerColor} 🗡️ ${att.name} exécute une frappe pénétrante`);
        } else if (isArcher && !isBonusAttack) {
          if (i === 0) {
            raw = dmgPhys(Math.round(att.base.auto * attackMultiplier), def.base.def);
          } else {
            const { hit2AutoMultiplier, hit2CapMultiplier } = classConstants.archer;
            const physPart = dmgPhys(Math.round(att.base.auto * hit2AutoMultiplier * attackMultiplier), def.base.def);
            const capPart = dmgCap(Math.round(att.base.cap * hit2CapMultiplier * attackMultiplier), def.base.rescap);
            raw = physPart + capPart;
          }
        } else {
          raw = dmgPhys(Math.round(att.base.auto * attackMultiplier), def.base.def);
          if (att.race === 'Lycan') {
            def.bleed_stacks = (def.bleed_stacks || 0) + raceConstants.lycan.bleedPerHit;
          }
        }

        if (isCrit) {
          const critDamage = Math.round(raw * generalConstants.critMultiplier);
          raw = modifyCritDamage(att.weaponState, critDamage);
        }

        const inflicted = applyMageTowerDamage(att, def, raw, isCrit, log, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);

        if (!isMage) {
          const attackEffects = onAttack(att.weaponState, att, def, inflicted);
          if (attackEffects.stunTarget) {
            Object.assign(def, applyMjollnirStun(def));
          }
          if (attackEffects.atkDebuff && !def.base._gungnirDebuffed) {
            def.base = applyGungnirDebuff(def.base);
          }
          if (attackEffects.log.length > 0) {
            log.push(`${playerColor} ${attackEffects.log.join(' ')}`);
          }
        }

        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log, playerColor);
        } else if (def.currentHP <= 0) {
          total += inflicted;
          break;
        }

        total += inflicted;
        if (isArcher && !isBonusAttack) {
          const critText = isCrit ? ' CRITIQUE !' : '';
          const shotLabel = i === 0 ? 'tir' : 'tir renforcé';
          log.push(`${playerColor} 🏹 ${att.name} lance un ${shotLabel} et inflige ${inflicted} points de dégâts${critText}`);
        } else if (isBonusAttack) {
          log.push(`${playerColor} 🌟 Attaque bonus: ${att.name} inflige ${inflicted} points de dégâts`);
        }
      }

      if (attackerPassive?.id === 'elemental_fury' && skillUsed) {
        const baseLightning = Math.max(1, Math.round(att.base.auto * attackerPassive.levelData.lightningPercent));
        const lightningRaw = dmgPhys(baseLightning, def.base.def);
        const lightningDamage = applyMageTowerDamage(att, def, lightningRaw, false, log, attackerPassive, defenderPassive, attackerUnicorn, defenderUnicorn, auraBonus);
        log.push(`${playerColor} ⚡ Furie élémentaire déclenche un éclair et inflige ${lightningDamage} points de dégâts`);
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
    applyStartOfCombatPassives(p1, p2, logs, '[P1]');
    applyStartOfCombatPassives(p2, p1, logs, '[P2]');
    setCombatLog(logs);

    let turn = 1;
    while (p1.currentHP > 0 && p2.currentHP > 0 && turn <= generalConstants.maxTurns) {
      logs.push(`--- Début du tour ${turn} ---`);
      setCombatLog([...logs]);
      await new Promise(r => setTimeout(r, 800));

      const p1Unicorn = getUnicornPactTurnData(getPassiveDetails(p1.mageTowerPassive), turn);
      const p2Unicorn = getUnicornPactTurnData(getPassiveDetails(p2.mageTowerPassive), turn);
      if (p1Unicorn) {
        logs.push(`🦄 Pacte de la Licorne — ${p1.name}: ${p1Unicorn.label}`);
      }
      if (p2Unicorn) {
        logs.push(`🦄 Pacte de la Licorne — ${p2.name}: ${p2Unicorn.label}`);
      }

      // Déterminer qui attaque en premier selon la vitesse + priorité d'arme
      const p1HasPriority = p1.weaponState?.isLegendary
        && p1.weaponState.weaponId === 'epee_legendaire'
        && ((p1.weaponState.counters?.turnCount ?? 0) + 1) % weaponConstants.zweihander.triggerEveryNTurns === 0;
      const p2HasPriority = p2.weaponState?.isLegendary
        && p2.weaponState.weaponId === 'epee_legendaire'
        && ((p2.weaponState.counters?.turnCount ?? 0) + 1) % weaponConstants.zweihander.triggerEveryNTurns === 0;

      let first;
      if (p1Unicorn && !p2Unicorn) {
        first = p1Unicorn.label === 'Tour A' ? p1 : p2;
      } else if (p2Unicorn && !p1Unicorn) {
        first = p2Unicorn.label === 'Tour A' ? p2 : p1;
      } else if (p1HasPriority && !p2HasPriority) {
        first = p1;
      } else if (p2HasPriority && !p1HasPriority) {
        first = p2;
      } else {
        first = p1.base.spd >= p2.base.spd ? p1 : p2;
      }
      const second = first === p1 ? p2 : p1;
      const firstIsP1 = first === p1;

      // Action du premier joueur
      const log1 = [];
      setCurrentAction({ player: firstIsP1 ? 1 : 2, logs: [] });
      await new Promise(r => setTimeout(r, 300));
      processPlayerAction(first, second, log1, firstIsP1, turn);
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
        processPlayerAction(second, first, log2, !firstIsP1, turn);
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
    const raceB = character.bonuses?.race || {};
    const classB = character.bonuses?.class || {};
    const forestBoosts = getForestBoosts(character);
    const weapon = character.equippedWeaponData;
    const passiveDetails = getPassiveDetails(character.mageTowerPassive);
    const baseStats = character.baseWithoutWeapon || getBaseWithBoosts(character);
    const baseWithPassive = weapon ? applyPassiveWeaponStats(baseStats, weapon.id, character.class) : baseStats;
    const totalBonus = (k) => (raceB[k] || 0) + (classB[k] || 0);
    const baseWithoutBonus = (k) => baseStats[k] - totalBonus(k) - (forestBoosts[k] || 0);
    const tooltipContent = (k) => {
      const parts = [`Base: ${baseWithoutBonus(k)}`];
      if (raceB[k] > 0) parts.push(`Race: +${raceB[k]}`);
      if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
      if (forestBoosts[k] > 0) parts.push(`Forêt: +${forestBoosts[k]}`);
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
      const hasBonus = totalBonus(statKey) > 0 || forestBoosts[statKey] > 0 || weaponDelta !== 0 || passiveAutoBonus !== 0;
      const totalDelta = totalBonus(statKey) + forestBoosts[statKey] + weaponDelta + passiveAutoBonus;
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
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">{races[character.race].icon}</span>
                <span className="text-stone-300">{races[character.race].bonus}</span>
              </div>
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
