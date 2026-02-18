import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import {
  onTournoiUpdate, getCombatLog, creerTournoi, lancerTournoi,
  avancerMatch, terminerTournoi, annoncerFinMatchDiscord, supprimerTournoiTermine
} from '../services/tournamentService';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { applyStatBoosts, getEmptyStatBoosts } from '../utils/statPoints';
import { applyPassiveWeaponStats } from '../utils/weaponEffects';
import { getAwakeningEffect, applyAwakeningToBase, removeBaseRaceFlatBonusesIfAwakened } from '../utils/awakening';
import { classConstants } from '../data/combatMechanics';

const ADMIN_EMAIL = 'antho.pruneta@gmail.com';

// ============================================================================
// UTILS HORAIRES PARIS
// ============================================================================

function getParisNow() {
  const str = new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' });
  return new Date(str);
}

function getNextSaturday18h() {
  const now = getParisNow();
  const day = now.getDay();
  let daysUntil = (6 - day + 7) % 7;
  if (daysUntil === 0 && now.getHours() >= 19) {
    daysUntil = 7;
  }
  const target = new Date(now);
  target.setDate(target.getDate() + daysUntil);
  target.setHours(18, 0, 0, 0);
  return target;
}

function getSchedulePhase() {
  const now = getParisNow();
  const day = now.getDay();
  const hour = now.getHours();

  if (day === 6) {
    if (hour >= 19) return 'combat';
    if (hour >= 18) return 'annonce';
  }
  return 'attente';
}

function formatCountdown(targetDate) {
  const now = getParisNow();
  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) return null;

  const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
  const heures = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const secondes = Math.floor((diff / 1000) % 60);

  const parts = [];
  if (jours > 0) parts.push(`${jours}j`);
  parts.push(`${String(heures).padStart(2, '0')}h`);
  parts.push(`${String(minutes).padStart(2, '0')}m`);
  parts.push(`${String(secondes).padStart(2, '0')}s`);
  return parts.join(' ');
}

// ============================================================================
// HELPERS
// ============================================================================

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// HELPERS UI (mêmes que Combat.jsx)
// ============================================================================

const weaponImageModules = import.meta.glob('../assets/weapons/*.png', { eager: true, import: 'default' });

const getWeaponImage = (imageFile) => {
  if (!imageFile) return null;
  return weaponImageModules[`../assets/weapons/${imageFile}`] || null;
};

const Tooltip = ({ children, content }) => (
  <span className="relative group cursor-help">
    {children}
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-stone-900 border border-amber-500 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
      {content}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-500"></span>
    </span>
  </span>
);

const STAT_LABELS = { hp: 'HP', auto: 'Auto', def: 'Déf', cap: 'Cap', rescap: 'ResC', spd: 'VIT' };

const getWeaponStatColor = (value) => {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-yellow-300';
};

const getForestBoosts = (character) => ({ ...getEmptyStatBoosts(), ...(character?.forestBoosts || {}) });

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
    case 'Briseur de Sort': {
      const { shieldFromSpellDamage, shieldFromCap, autoCapBonus, antiHealReduction } = classConstants.briseurSort;
      const shieldDmgPct = Math.round(shieldFromSpellDamage * 100);
      const shieldCapValue = Math.round(shieldFromCap * cap);
      const autoBonusValue = Math.round(autoCapBonus * cap);
      const antiHealPct = Math.round(antiHealReduction * 100);
      return (
        <>
          Bouclier après spell:{' '}
          <Tooltip content={`${shieldDmgPct}% dégâts reçus + ${shieldFromCap * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{shieldDmgPct}% dmg + {shieldCapValue}</span>
          </Tooltip>
          {' '}| Auto +{' '}
          <Tooltip content={`${autoCapBonus * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{autoBonusValue}</span>
          </Tooltip>
          {' '}| -{antiHealPct}% soins adverses
        </>
      );
    }
    case 'Succube': {
      const { capScale, nextAttackReduction } = classConstants.succube;
      const capDmg = Math.round(capScale * cap);
      const reductionPct = Math.round(nextAttackReduction * 100);
      return (
        <>
          Auto +{' '}
          <Tooltip content={`${capScale * 100}% × Cap (${cap})`}>
            <span className="text-green-400">{capDmg}</span>
          </Tooltip>
          {' '}CAP | Prochaine attaque adverse -{reductionPct}%
        </>
      );
    }
    case 'Bastion': {
      const { defPercentBonus, startShieldFromDef, capScale, defScale } = classConstants.bastion;
      const defBonusPct = Math.round(defPercentBonus * 100);
      const shieldPct = Math.round(startShieldFromDef * 100);
      const capDmg = Math.round(capScale * cap);
      return (
        <>
          Bouclier initial {shieldPct}% DEF | +{defBonusPct}% DEF | Auto +{' '}
          <Tooltip content={`${capScale * 100}% × Cap (${cap}) + ${defScale * 100}% DEF`}>
            <span className="text-green-400">{capDmg}</span>
          </Tooltip>
        </>
      );
    }
    default:
      return classes[className]?.description || '';
  }
};

// ============================================================================
// CARTE PERSONNAGE TOURNOI (même style que Combat.jsx)
// ============================================================================

const TournamentCharacterCard = ({ participant, currentHP, maxHP, shield = 0 }) => {
  if (!participant) return null;
  const hpPercent = maxHP > 0 ? (currentHP / maxHP) * 100 : 100;
  const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
  const shieldPercent = maxHP > 0 ? Math.min(100, (shield / maxHP) * 100) : 0;
  const weapon = participant.equippedWeaponData ||
    (participant.equippedWeaponId ? getWeaponById(participant.equippedWeaponId) : null);
  const pClass = participant.classe || participant.class;
  const pRace = participant.race;
  const pName = participant.nom || participant.name;

  const passiveDetails = (() => {
    if (!participant.mageTowerPassive) return null;
    const base = getMageTowerPassiveById(participant.mageTowerPassive.id);
    const levelData = base ? getMageTowerPassiveLevel(participant.mageTowerPassive.id, participant.mageTowerPassive.level) : null;
    if (!base || !levelData) return null;
    return { ...base, level: participant.mageTowerPassive.level, levelData };
  })();

  const raceData = races[participant.race];
  const classData = classes[pClass];
  const awakeningInfo = raceData?.awakening || null;
  const isAwakeningActive = awakeningInfo && (participant.level ?? 1) >= awakeningInfo.levelRequired;

  // Pipeline de stats (même ordre que preparerCombattant: forest → weapon → awakening → bastion)
  const raceB = participant.bonuses?.race || {};
  const classB = participant.bonuses?.class || {};
  const forestBoosts = getForestBoosts(participant);
  const effectiveLevel = participant.level ?? 1;
  const baseWithBoostsRaw = applyStatBoosts(participant.base, forestBoosts);
  const baseWithBoosts = removeBaseRaceFlatBonusesIfAwakened(baseWithBoostsRaw, participant.race, effectiveLevel);
  const baseWithWeapon = weapon ? applyPassiveWeaponStats(baseWithBoosts, weapon.id, pClass, pRace, null) : baseWithBoosts;
  const awakeningEffect = getAwakeningEffect(participant.race, effectiveLevel);
  const baseWithAwakening = applyAwakeningToBase(baseWithWeapon, awakeningEffect);
  const baseStats = pClass === 'Bastion'
    ? { ...baseWithAwakening, def: Math.max(1, Math.round(baseWithAwakening.def * (1 + classConstants.bastion.defPercentBonus))) }
    : baseWithAwakening;
  const baseWithPassive = baseStats;
  const raceFlatBonus = (k) => (isAwakeningActive ? 0 : (raceB[k] || 0));
    const totalBonus = (k) => raceFlatBonus(k) + (classB[k] || 0);
  const weaponDelta = (k) => weapon?.stats?.[k] ?? 0;
  const passiveAutoBonus = baseWithWeapon.auto - baseWithBoosts.auto - (weapon?.stats?.auto ?? 0);
  const awakeningDelta = (k) => (baseWithAwakening[k] || 0) - (baseWithWeapon[k] || 0);
  const bastionDelta = (k) => (baseStats[k] || 0) - (baseWithAwakening[k] || 0);
  const baseWithoutBonus = (k) => baseWithBoosts[k] - totalBonus(k) - (forestBoosts[k] || 0);
  const getRaceDisplayBonus = (k) => {
    if (!isAwakeningActive) return raceB[k] || 0;
    const classBonus = classB[k] || 0;
    const forestBonus = forestBoosts[k] || 0;
    const weaponBonus = weaponDelta(k);
    const passiveBonus = k === 'auto' ? passiveAutoBonus : 0;
    return (baseStats[k] || 0) - (baseWithoutBonus(k) + classBonus + forestBonus + weaponBonus + passiveBonus + bastionDelta(k));
  };
  const tooltipContent = (k) => {
    const parts = [`Base: ${baseWithoutBonus(k)}`];
    if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
    if (forestBoosts[k] > 0) parts.push(`Forêt: +${forestBoosts[k]}`);
    if (weaponDelta(k) !== 0) parts.push(`Arme: ${weaponDelta(k) > 0 ? `+${weaponDelta(k)}` : weaponDelta(k)}`);
    if (k === 'auto' && passiveAutoBonus !== 0) parts.push(`Passif: ${passiveAutoBonus > 0 ? `+${passiveAutoBonus}` : passiveAutoBonus}`);
    const raceDisplayBonus = getRaceDisplayBonus(k);
    if (raceDisplayBonus !== 0) parts.push(`Race: ${raceDisplayBonus > 0 ? `+${raceDisplayBonus}` : raceDisplayBonus}`);
    if (bastionDelta(k) !== 0) parts.push(`Bastion: ${bastionDelta(k) > 0 ? `+${bastionDelta(k)}` : bastionDelta(k)}`);
    return parts.join(' | ');
  };

  const StatWithTooltip = ({ statKey, label }) => {
    const displayValue = baseStats[statKey];
    const raceDisplayBonus = getRaceDisplayBonus(statKey);
    const allBonuses = raceDisplayBonus + (classB[statKey] || 0) + forestBoosts[statKey] + weaponDelta(statKey)
      + (statKey === 'auto' ? passiveAutoBonus : 0) + bastionDelta(statKey);
    const hasBonus = allBonuses !== 0;
    const totalDelta = allBonuses;
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
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-stone-200 px-5 py-1.5 text-sm font-bold shadow-lg border border-stone-500 z-10 whitespace-nowrap">
        {participant.race} • {pClass} • Niv. {participant.level ?? 1}
      </div>
      <div className="overflow-visible">
        <div className="h-auto relative bg-stone-900 flex items-center justify-center">
          {participant.characterImage ? (
            <img src={participant.characterImage} alt={pName} className="w-full h-auto object-contain" />
          ) : (
            <div className="w-full h-48 bg-stone-800 flex items-center justify-center">
              <span className="text-6xl">{raceData?.icon || '❓'}</span>
            </div>
          )}
          <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-3">
            <div className="text-white font-bold text-xl text-center">{pName}</div>
          </div>
        </div>
        <div className="bg-stone-800 p-4 border-t border-stone-600">
          <div className="mb-3">
            <div className="flex justify-between text-sm text-white mb-2">
              <StatWithTooltip statKey="hp" label="HP" />
              <StatWithTooltip statKey="spd" label="VIT" />
            </div>
            <div className="text-xs text-stone-400 mb-2">{pName} — PV {Math.max(0, currentHP)}/{maxHP}</div>
            <div className="bg-stone-900 h-3 overflow-hidden border border-stone-600">
              <div className={`h-full transition-all duration-500 ${hpClass}`} style={{width: `${Math.max(0, hpPercent)}%`}} />
            </div>
            {shield > 0 && (
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
                    {passiveDetails.name} — Niv. {passiveDetails.level}
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
                  <div className="text-stone-400 text-[10px]">{awakeningInfo.description}</div>
                </div>
              </div>
            )}
            {raceData && !isAwakeningActive && (
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">{raceData.icon}</span>
                <span className="text-stone-300">{raceData.bonus}</span>
              </div>
            )}
            {classData && (
              <div className="flex items-start gap-2 bg-stone-700/50 p-2 text-xs border border-stone-600">
                <span className="text-lg">{classData.icon}</span>
                <div className="flex-1">
                  <div className="text-stone-200 font-semibold mb-1">{classData.ability}</div>
                  <div className="text-stone-400 text-[10px]">{getCalculatedDescription(pClass, baseStats.cap + (weapon?.stats?.cap ?? 0), baseStats.auto + (weapon?.stats?.auto ?? 0))}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

const Tournament = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSimulation = searchParams.get('mode') === 'simulation';
  const docId = isSimulation ? 'simulation' : 'current';
  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  // Tournoi state
  const [tournoi, setTournoi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listenerError, setListenerError] = useState(null);

  // Combat state
  const [combatLog, setCombatLog] = useState([]);
  const [matchEnCours, setMatchEnCours] = useState(null);
  const [p1HP, setP1HP] = useState(0);
  const [p2HP, setP2HP] = useState(0);
  const [p1Shield, setP1Shield] = useState(0);
  const [p2Shield, setP2Shield] = useState(0);
  const [p1MaxHP, setP1MaxHP] = useState(0);
  const [p2MaxHP, setP2MaxHP] = useState(0);
  const [winner, setWinner] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [annonceActuelle, setAnnonceActuelle] = useState('');
  const [replayMatchId, setReplayMatchId] = useState(null);

  // Sound
  const [isSoundOpen, setIsSoundOpen] = useState(false);
  const [volume, setVolume] = useState(0.05);
  const [isMuted, setIsMuted] = useState(false);

  // Schedule
  const [countdown, setCountdown] = useState('');
  const [phase, setPhase] = useState('attente');
  const autoCreatedRef = useRef(false);
  const autoLaunchedRef = useRef(false);

  // Bracket toggle
  const [showBracket, setShowBracket] = useState(false);

  // Admin
  const [actionLoading, setActionLoading] = useState(false);

  // Refs
  const logContainerRef = useRef(null);
  const logEndRef = useRef(null);
  const animationRef = useRef(null);
  const lastAnimatedMatch = useRef(-1);
  const autoAdvanceRef = useRef(null);

  // ============================================================================
  // SOUND CONTROL
  // ============================================================================

  const applyCombatVolume = () => {
    const combatMusic = document.getElementById('tournament-combat-music');
    const victoryMusic = document.getElementById('tournament-victory-music');
    [combatMusic, victoryMusic].forEach((audio) => {
      if (audio) {
        audio.volume = volume;
        audio.muted = isMuted;
      }
    });
  };

  useEffect(() => {
    applyCombatVolume();
  }, [volume, isMuted, matchEnCours, winner]);

  const handleVolumeChange = (event) => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
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
        className="bg-amber-600 text-white border border-amber-400 px-3 py-2 text-sm font-bold shadow-lg hover:bg-amber-500"
      >
        {isMuted || volume === 0 ? '🔇' : '🔊'} Son
      </button>
      {isSoundOpen && (
        <div className="bg-stone-900 border border-stone-600 p-3 w-56 shadow-xl">
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleMute} className="text-lg">
              {isMuted ? '🔇' : '🔊'}
            </button>
            <input
              type="range" min="0" max="1" step="0.05"
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

  // ============================================================================
  // LISTENERS ET TIMERS
  // ============================================================================

  // Listener tournoi en temps réel
  useEffect(() => {
    const unsubscribe = onTournoiUpdate((data) => {
      setTournoi(data);
      setLoading(false);
      setListenerError(null);
    }, docId, (error) => {
      setListenerError(error?.message || 'Erreur de synchronisation tournoi');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [docId]);

  // Timer countdown + phase
  useEffect(() => {
    const tick = () => {
      const currentPhase = getSchedulePhase();
      setPhase(currentPhase);
      if (currentPhase === 'attente') {
        const target = getNextSaturday18h();
        setCountdown(formatCountdown(target) || '');
      } else {
        setCountdown('');
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-nettoyage : supprimer le tournoi terminé quand on passe à la semaine suivante (lundi)
  useEffect(() => {
    if (isSimulation || !tournoi || loading) return;
    if (tournoi.statut !== 'termine') return;
    const now = getParisNow();
    const day = now.getDay(); // 0=dimanche, 6=samedi
    // Si on n'est plus samedi (6) ni dimanche (0), le tournoi terminé doit disparaître
    if (day !== 0 && day !== 6) {
      supprimerTournoiTermine(docId);
    }
  }, [tournoi, loading, isSimulation, docId]);

  // Auto-création à 18h — pas en simulation
  useEffect(() => {
    if (isSimulation) return;
    if (autoCreatedRef.current || tournoi || loading) return;
    if (phase === 'annonce' || phase === 'combat') {
      autoCreatedRef.current = true;
      (async () => {
        setActionLoading(true);
        try {
          await creerTournoi(docId);
        } finally {
          setActionLoading(false);
        }
      })();
    }
  }, [phase, tournoi, loading, isSimulation, docId]);

  // Auto-lancement à 19h — pas en simulation
  useEffect(() => {
    if (isSimulation) return;
    if (autoLaunchedRef.current || !tournoi || loading) return;
    if (phase === 'combat' && tournoi.statut === 'preparation') {
      autoLaunchedRef.current = true;
      (async () => {
        setActionLoading(true);
        try {
          await lancerTournoi(docId);
        } finally {
          setActionLoading(false);
        }
      })();
    }
  }, [phase, tournoi, loading, isSimulation, docId]);

  // Auto-scroll du combat log (scroll le conteneur uniquement, pas la page)
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [combatLog]);

  // Cleanup auto-advance on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  // ============================================================================
  // ANIMATION DU MATCH EN COURS
  // ============================================================================

  useEffect(() => {
    if (!tournoi || tournoi.statut !== 'en_cours') return;
    if (tournoi.matchActuel < 0) return;
    if (tournoi.matchActuel === lastAnimatedMatch.current) return;

    lastAnimatedMatch.current = tournoi.matchActuel;
    const matchId = tournoi.matchOrder[tournoi.matchActuel];
    animerMatch(matchId);
  }, [tournoi?.matchActuel, tournoi?.statut]);

  const animerMatch = async (matchId) => {
    if (!matchId) return;

    // Cancel previous animation
    if (animationRef.current) {
      animationRef.current.cancelled = true;
    }
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }

    const token = { cancelled: false };
    animationRef.current = token;

    const stopAnimation = () => {
      if (animationRef.current === token) {
        animationRef.current = null;
      }
      setIsAnimating(false);
    };

    setIsAnimating(true);
    setCombatLog([]);
    setMatchEnCours(matchId);
    setReplayMatchId(null);
    setWinner(null);
    setAnnonceActuelle('');

    // Lancer la musique de combat
    const combatMusic = document.getElementById('tournament-combat-music');
    const victoryMusic = document.getElementById('tournament-victory-music');
    if (victoryMusic) victoryMusic.pause();
    if (combatMusic) {
      combatMusic.currentTime = 0;
      combatMusic.volume = volume;
      combatMusic.play().catch(e => console.log('Autoplay bloqué:', e));
    }

    // Charger le combat log (avec retries pour absorber les délais Firestore)
    let result = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (token.cancelled) { stopAnimation(); return; }
      result = await getCombatLog(matchId, docId);
      if (result.success) break;
      if (attempt < 3) await delay(800 * (attempt + 1));
    }
    if (!result?.success || token.cancelled) {
      stopAnimation();
      // Même en cas d'échec, planifier l'auto-avancement pour ne pas bloquer la simulation
      if (isAdmin && !replayMatchId) {
        autoAdvanceRef.current = setTimeout(async () => {
          autoAdvanceRef.current = null;
          await avancerMatch(docId);
        }, 3000);
      }
      return;
    }

    const logData = result.data;
    setP1MaxHP(logData.p1MaxHP || 0);
    setP2MaxHP(logData.p2MaxHP || 0);
    setP1HP(logData.p1MaxHP || 0);
    setP2HP(logData.p2MaxHP || 0);
    setP1Shield(0);
    setP2Shield(0);

    // Annonce de début
    setAnnonceActuelle(logData.annonceDebut);
    await delay(3000);
    if (token.cancelled) {
      stopAnimation();
      return;
    }
    setAnnonceActuelle('');

    // Jouer les steps un par un
    if (logData.steps && logData.steps.length > 0) {
      for (const step of logData.steps) {
        if (token.cancelled) {
          stopAnimation();
          return;
        }

        if (step.phase === 'intro') {
          for (const line of step.logs) {
            if (token.cancelled) {
              stopAnimation();
              return;
            }
            setCombatLog(prev => [...prev, line]);
            await delay(300);
          }
          setP1HP(step.p1HP);
          setP2HP(step.p2HP);
          setP1Shield(step.p1Shield || 0);
          setP2Shield(step.p2Shield || 0);
          await delay(500);
        } else if (step.phase === 'turn_start') {
          for (const line of step.logs) {
            if (token.cancelled) {
              stopAnimation();
              return;
            }
            setCombatLog(prev => [...prev, line]);
          }
          setP1Shield(step.p1Shield || 0);
          setP2Shield(step.p2Shield || 0);
          await delay(800);
        } else if (step.phase === 'action') {
          for (const line of step.logs) {
            if (token.cancelled) {
              stopAnimation();
              return;
            }
            setCombatLog(prev => [...prev, line]);
          }
          setP1HP(step.p1HP);
          setP2HP(step.p2HP);
          setP1Shield(step.p1Shield || 0);
          setP2Shield(step.p2Shield || 0);
          await delay(2000);
        } else if (step.phase === 'victory') {
          for (const line of step.logs) {
            if (token.cancelled) {
              stopAnimation();
              return;
            }
            setCombatLog(prev => [...prev, line]);
          }
          setP1HP(step.p1HP);
          setP2HP(step.p2HP);
          setP1Shield(step.p1Shield || 0);
          setP2Shield(step.p2Shield || 0);
        }
      }
    } else {
      // Fallback: affichage ligne par ligne (ancien format sans steps)
      for (let i = 0; i < logData.combatLog.length; i++) {
        if (token.cancelled) {
          stopAnimation();
          return;
        }
        const line = logData.combatLog[i];
        setCombatLog(prev => [...prev, line]);
        const isNewTurn = line.includes('---');
        await delay(isNewTurn ? 800 : 350);
      }
    }

    if (token.cancelled) {
      stopAnimation();
      return;
    }

    // Victoire
    setWinner(logData.winnerNom);
    setAnnonceActuelle(logData.annonceFin);
    stopAnimation();

    // Annoncer le vainqueur sur Discord après l'animation (admin + vrai tournoi uniquement)
    if (isAdmin && !isSimulation && !replayMatchId) {
      annoncerFinMatchDiscord(logData).catch(() => {});
    }

    // Arrêter musique combat, jouer victoire
    if (combatMusic) combatMusic.pause();
    if (victoryMusic) {
      victoryMusic.currentTime = 0;
      victoryMusic.volume = volume;
      victoryMusic.play().catch(e => console.log('Autoplay bloqué:', e));
    }

    // Auto-avancer après 8 secondes (admin seulement)
    if (isAdmin && !replayMatchId) {
      autoAdvanceRef.current = setTimeout(async () => {
        autoAdvanceRef.current = null;
        await avancerMatch(docId);
      }, 8000);
    }
  };

  const rejouerMatch = async (matchId) => {
    if (animationRef.current) animationRef.current.cancelled = true;
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    setReplayMatchId(matchId);
    await animerMatch(matchId);
  };

  // ============================================================================
  // ADMIN ACTIONS
  // ============================================================================

  const handleMatchSuivant = async () => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    setActionLoading(true);
    const result = await avancerMatch(docId);
    if (!result.success) alert('Erreur: ' + result.error);
    if (result.termine && tournoi?.champion) {
      setAnnonceActuelle(tournoi.annonceChampion || `🏆 ${tournoi.champion.nom} EST LE CHAMPION !!!`);
    }
    setActionLoading(false);
  };

  const handleTerminerTournoi = async () => {
    if (isSimulation) {
      setActionLoading(true);
      await terminerTournoi(docId);
      setActionLoading(false);
      navigate('/admin');
      return;
    }
    if (!window.confirm('Terminer le tournoi ? Tous les personnages seront archivés.')) return;
    setActionLoading(true);
    const result = await terminerTournoi(docId);
    if (!result.success) alert('Erreur: ' + result.error);
    else alert('Tournoi terminé ! Personnages archivés, champion récompensé.');
    setActionLoading(false);
  };

  // ============================================================================
  // FORMAT COMBAT LOG (même style que Combat.jsx)
  // ============================================================================

  const formatLogMessage = (text) => {
    if (!matchEnCours || !tournoi) return text;
    const match = tournoi.matches[matchEnCours];
    if (!match) return text;

    const p1Data = tournoi.participants[match.p1];
    const p2Data = tournoi.participants[match.p2];
    if (!p1Data || !p2Data) return text;

    const p1Name = p1Data.nom;
    const p2Name = p2Data.nom;

    const parts = [];
    const nameRegex = new RegExp(`(${escapeRegex(p1Name)}|${escapeRegex(p2Name)})`, 'g');
    const nameParts = text.split(nameRegex);
    let key = 0;

    nameParts.forEach((part) => {
      if (part === p1Name) {
        parts.push(<span key={key++} className="font-bold text-blue-400">{part}</span>);
      } else if (part === p2Name) {
        parts.push(<span key={key++} className="font-bold text-purple-400">{part}</span>);
      } else if (part) {
        const numRegex = /(\d+)\s*(points?\s*de\s*(?:vie|dégâts?|dommages?))/gi;
        let lastIndex = 0;
        let numMatch;
        while ((numMatch = numRegex.exec(part)) !== null) {
          if (numMatch.index > lastIndex) parts.push(part.slice(lastIndex, numMatch.index));
          const isHeal = numMatch[2].toLowerCase().includes('vie');
          parts.push(<span key={key++} className={isHeal ? 'font-bold text-green-400' : 'font-bold text-red-400'}>{numMatch[1]}</span>);
          parts.push(` ${numMatch[2]}`);
          lastIndex = numMatch.index + numMatch[0].length;
        }
        if (lastIndex < part.length) parts.push(part.slice(lastIndex));
      }
    });

    return parts;
  };

  // ============================================================================
  // RENDER BRACKET
  // ============================================================================

  const renderBracketMatch = (matchId) => {
    if (!tournoi) return null;
    const match = tournoi.matches[matchId];
    if (!match) return null;

    const isCurrentAnimatedMatch = isAnimating && matchEnCours === tournoi.matchOrder[tournoi.matchActuel] && !winner;
    const currentAnimatedMatch = isCurrentAnimatedMatch ? tournoi.matches[matchEnCours] : null;

    const shouldHidePropagatedParticipant = (participantId) => {
      if (!participantId || participantId === 'BYE' || !currentAnimatedMatch) return false;
      if (matchId === matchEnCours) return false;
      // Ne masquer que les matchs pas encore terminés pour conserver
      // l'historique visuel des duels déjà joués dans le bracket.
      if (match.statut === 'termine') return false;
      return participantId === currentAnimatedMatch.winnerId || participantId === currentAnimatedMatch.loserId;
    };

    const displayedP1Id = shouldHidePropagatedParticipant(match.p1) ? null : match.p1;
    const displayedP2Id = shouldHidePropagatedParticipant(match.p2) ? null : match.p2;

    const p1 = displayedP1Id && displayedP1Id !== 'BYE' ? tournoi.participants[displayedP1Id] : null;
    const p2 = displayedP2Id && displayedP2Id !== 'BYE' ? tournoi.participants[displayedP2Id] : null;
    const isCurrentMatch = tournoi.matchOrder[tournoi.matchActuel] === matchId;
    const isTermine = match.statut === 'termine';
    const isBye = match.statut === 'bye';
    const hasAnyParticipant = Boolean(p1 || p2 || match.winnerId || match.loserId);
    const isAnimatingCurrentMatch = matchId === matchEnCours && !winner;
    const showWinner = isTermine && !isAnimatingCurrentMatch;

    if (isBye || !hasAnyParticipant) return null;

    const borderClass = isCurrentMatch ? 'border-amber-400 bg-amber-900/20' :
      isTermine ? 'border-stone-600 bg-stone-800/50' : 'border-stone-700 bg-stone-900/30';

    return (
      <div
        key={matchId}
        className={`border ${borderClass} p-2 text-xs cursor-pointer hover:border-amber-500 transition mb-2`}
        onClick={() => isTermine && rejouerMatch(matchId)}
        title={isTermine ? 'Cliquer pour revoir' : ''}
      >
        <div className="text-stone-500 text-[10px] mb-1">{match.roundLabel}</div>
        <div className={`flex justify-between items-center ${showWinner && match.winnerId === match.p1 ? 'text-amber-300 font-bold' : 'text-stone-400'}`}>
          <span>{p1 ? p1.nom : '?'}</span>
          {showWinner && match.winnerId === match.p1 && <span className="text-green-400 text-[10px]">W</span>}
        </div>
        <div className="text-stone-600 text-center text-[10px]">vs</div>
        <div className={`flex justify-between items-center ${showWinner && match.winnerId === match.p2 ? 'text-amber-300 font-bold' : 'text-stone-400'}`}>
          <span>{p2 ? p2.nom : '?'}</span>
          {showWinner && match.winnerId === match.p2 && <span className="text-green-400 text-[10px]">W</span>}
        </div>
        {isCurrentMatch && <div className="text-amber-400 text-center text-[10px] mt-1 animate-pulse">EN COURS</div>}
        {isTermine && <div className="text-stone-500 text-center text-[10px] mt-1">Cliquer pour revoir</div>}
      </div>
    );
  };

  const renderBracket = () => {
    if (!tournoi || !tournoi.matches) return null;

    const winnersRounds = {};
    const losersRounds = {};
    let hasGF = false;
    let hasGFR = false;

    const shouldDisplayMatch = (match) => {
      if (!match || match.statut === 'bye') return false;
      const hasP1 = Boolean(match.p1 && match.p1 !== 'BYE');
      const hasP2 = Boolean(match.p2 && match.p2 !== 'BYE');
      const hasWinner = Boolean(match.winnerId && match.winnerId !== 'BYE');
      const hasLoser = Boolean(match.loserId && match.loserId !== 'BYE');

      // Éviter l'affichage des matchs fantômes ('?' vs '?') qui peuvent exister
      // temporairement pendant le remplissage des tableaux.
      if (!hasP1 && !hasP2) return false;

      return hasP1 || hasP2 || hasWinner || hasLoser;
    };

    for (const [id, match] of Object.entries(tournoi.matches)) {
      if (!shouldDisplayMatch(match)) continue;
      if (match.bracket === 'winners') {
        if (!winnersRounds[match.round]) winnersRounds[match.round] = [];
        winnersRounds[match.round].push(id);
      } else if (match.bracket === 'losers') {
        if (!losersRounds[match.round]) losersRounds[match.round] = [];
        losersRounds[match.round].push(id);
      } else if (match.bracket === 'grand_final') {
        hasGF = true;
      } else if (match.bracket === 'grand_final_reset') {
        hasGFR = true;
      }
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-amber-400 font-bold mb-2">🏆 Winners Bracket</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {Object.keys(winnersRounds).sort((a, b) => a - b).map(round => (
              <div key={`wr-${round}`} className="min-w-[160px]">
                {winnersRounds[round].sort().map(id => renderBracketMatch(id))}
              </div>
            ))}
          </div>
        </div>

        {Object.keys(losersRounds).length > 0 && (
          <div>
            <h3 className="text-red-400 font-bold mb-2">💀 Losers Bracket</h3>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {Object.keys(losersRounds).sort((a, b) => a - b).map(round => (
                <div key={`lr-${round}`} className="min-w-[160px]">
                  {losersRounds[round].sort().map(id => renderBracketMatch(id))}
                </div>
              ))}
            </div>
          </div>
        )}

        {hasGF && (
          <div>
            <h3 className="text-yellow-300 font-bold mb-2">👑 Grande Finale</h3>
            <div className="max-w-[200px]">
              {renderBracketMatch('GF')}
              {hasGFR && renderBracketMatch('GFR')}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER COMBAT UI (même layout que Combat.jsx)
  // ============================================================================

  const renderCombatUI = () => {
    if (!matchEnCours || !tournoi) return null;

    const match = tournoi.matches[matchEnCours];
    if (!match) return null;

    const p1Data = tournoi.participants[match.p1];
    const p2Data = tournoi.participants[match.p2];

    return (
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-start justify-center text-sm md:text-base">
        {/* Carte joueur 1 */}
        <div className="order-1 md:order-1 w-full md:w-[340px] md:flex-shrink-0">
          <TournamentCharacterCard
            participant={p1Data}
            currentHP={p1HP}
            maxHP={p1MaxHP}
            shield={p1Shield}
          />
        </div>

        {/* Zone centrale - Combat log */}
        <div className="order-2 md:order-2 w-full md:w-[600px] md:flex-shrink-0 flex flex-col">
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
              <h2 className="text-lg md:text-2xl font-bold text-stone-200 text-center">
                ⚔️ {replayMatchId ? 'Replay' : 'Combat en direct'}
              </h2>
            </div>
            <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-stone-800">
              {combatLog.length === 0 && !isAnimating ? (
                <p className="text-stone-500 italic text-center py-6 md:py-8 text-xs md:text-sm">
                  En attente du combat...
                </p>
              ) : (
                <>
                  {combatLog.map((log, idx) => {
                    const isP1 = log.startsWith('[P1]');
                    const isP2 = log.startsWith('[P2]');
                    const cleanLog = log.replace(/^\[P[12]\]\s*/, '');

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
                          <div className="bg-stone-700 text-stone-200 px-3 py-2 md:px-4 shadow-lg border-r-4 border-purple-500">
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

        {/* Carte joueur 2 */}
        <div className="order-3 md:order-3 w-full md:w-[340px] md:flex-shrink-0">
          <TournamentCharacterCard
            participant={p2Data}
            currentHP={p2HP}
            maxHP={p2MaxHP}
            shield={p2Shield}
          />
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER PRINCIPAL
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-amber-400 text-2xl">Chargement du tournoi...</div>
      </div>
    );
  }

  if (listenerError) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <div className="bg-stone-800/90 p-8 border-2 border-red-700 rounded-xl">
            <p className="text-red-300 text-xl">Impossible de charger le tournoi</p>
            <p className="text-stone-400 mt-2 text-sm">{listenerError}</p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="mt-6 bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg transition"
          >
            ← Retour à l'admin
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PAS DE TOURNOI → COUNTDOWN
  // ============================================================================
  if (!tournoi) {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-2xl mx-auto pt-20 text-center">
          {isSimulation ? (
            <>
              <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block mb-8">
                <h1 className="text-4xl font-bold text-amber-400">🎲 Simulation de Tournoi</h1>
              </div>
              <div className="bg-stone-800/90 p-8 border-2 border-stone-600 rounded-xl">
                <p className="text-stone-300 text-xl">Aucune simulation en cours</p>
                <p className="text-stone-500 mt-2">Lancez une simulation depuis le panel admin</p>
              </div>
              <button onClick={() => navigate('/admin')} className="mt-6 bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg transition">
                ← Retour à l'admin
              </button>
            </>
          ) : (
            <>
              <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block mb-8">
                <h1 className="text-4xl font-bold text-amber-400">🏟️ Tournoi du Samedi</h1>
              </div>

              {phase === 'attente' && countdown && (
                <div className="bg-stone-800/90 p-8 border-2 border-stone-600 rounded-xl">
                  <p className="text-stone-300 text-xl mb-6">Prochain tournoi dans</p>
                  <div className="text-5xl md:text-6xl font-bold text-amber-400 font-mono tracking-wider mb-6">
                    {countdown}
                  </div>
                  <p className="text-stone-500">Samedi à 18h — Annonce des duels</p>
                  <p className="text-stone-500">Samedi à 19h — Début des combats</p>
                </div>
              )}

              {(phase === 'annonce' || phase === 'combat') && (
                <div className="bg-stone-800/90 p-8 border-2 border-amber-500 rounded-xl">
                  <div className="text-4xl mb-4 animate-pulse">⏳</div>
                  <p className="text-amber-300 text-xl font-bold">Préparation du tournoi en cours...</p>
                  <p className="text-stone-400 mt-2">Les duels seront annoncés dans un instant</p>
                </div>
              )}

              <button onClick={() => navigate('/')} className="mt-6 bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg transition">
                ← Retour
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // TOURNOI EN PRÉPARATION (18h-19h)
  // ============================================================================
  if (tournoi.statut === 'preparation') {
    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-4xl mx-auto pt-20">
          <div className="text-center mb-8">
            <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block">
              <h1 className="text-4xl font-bold text-amber-400">
                {isSimulation ? '🎲 Simulation — Les duels sont prêts !' : '🏟️ Les duels sont annoncés !'}
              </h1>
              <p className="text-stone-400 mt-2">
                {tournoi.participantsList?.length || 0} combattants{isSimulation ? '' : ' • Début à 19h'}
              </p>
            </div>
          </div>

          <div className="bg-stone-800/90 border border-stone-600 p-4 rounded-xl mb-8 overflow-x-auto">
            <h2 className="text-xl font-bold text-stone-200 mb-4">📊 Arbre du tournoi</h2>
            {renderBracket()}
          </div>

          <div className="bg-stone-800 border border-stone-600 p-6 rounded-xl mb-8">
            <h2 className="text-xl font-bold text-amber-300 mb-4">Participants</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {tournoi.participantsList?.map(p => (
                <div key={p.participantId || p.userId} className="bg-stone-900/50 p-3 border border-stone-700 text-center">
                  {p.characterImage && (
                    <img src={p.characterImage} alt={p.nom} className="w-16 h-auto mx-auto mb-2 object-contain" />
                  )}
                  <p className="text-white font-bold text-sm">{p.nom}</p>
                  <p className="text-stone-400 text-xs">{p.race} • {p.classe}</p>
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="text-center bg-stone-900 border border-red-600 p-6 rounded-xl">
              <h3 className="text-red-400 font-bold mb-4">Admin</h3>
              <p className="text-stone-500 text-sm mb-4">Le tirage se lance automatiquement à 18h, puis le premier combat à 19h.</p>
              <button
                onClick={async () => {
                  setActionLoading(true);
                  await lancerTournoi(docId);
                  setActionLoading(false);
                }}
                disabled={actionLoading}
                className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white px-12 py-4 font-bold text-xl rounded-lg transition"
              >
                {actionLoading ? '⏳ Lancement...' : '🚀 LANCER MANUELLEMENT'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // TOURNOI EN COURS OU TERMINÉ — COMBAT UI
  // ============================================================================
  const isTournoiTermine = tournoi.statut === 'termine' || (tournoi.matchActuel >= tournoi.matchOrder.length);
  const matchProgress = tournoi.matchActuel >= 0
    ? `Match ${Math.min(tournoi.matchActuel + 1, tournoi.matchOrder.length)} / ${tournoi.matchOrder.length}`
    : '';

  return (
    <div className="min-h-screen p-4 md:p-6">
      <Header />
      <SoundControl />

      {/* Musique de combat */}
      <audio id="tournament-combat-music" loop>
        <source src="/assets/music/combat.mp3" type="audio/mpeg" />
      </audio>
      <audio id="tournament-victory-music">
        <source src="/assets/music/victory.mp3" type="audio/mpeg" />
      </audio>

      <div className="max-w-[1800px] mx-auto pt-16">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block">
            <h1 className="text-3xl md:text-4xl font-bold text-amber-400">
              {isSimulation ? '🎲' : '🏟️'} {isTournoiTermine
                ? (isSimulation ? 'Simulation Terminée' : 'Tournoi Terminé')
                : (isSimulation ? 'Simulation en direct' : 'Tournoi en direct')}
            </h1>
            {matchProgress && <p className="text-stone-400 mt-1">{matchProgress}</p>}
          </div>
        </div>

        {/* Annonce DBZ */}
        {annonceActuelle && (
          <div className="mb-6 bg-gradient-to-r from-red-900/80 via-amber-900/80 to-red-900/80 border-2 border-amber-500 p-6 text-center animate-pulse rounded-xl">
            <p className="text-amber-200 font-bold text-lg md:text-xl whitespace-pre-line">
              📢 {annonceActuelle}
            </p>
          </div>
        )}

        {/* Champion */}
        {isTournoiTermine && tournoi.champion && (
          <div className="mb-6 bg-gradient-to-r from-yellow-900/50 via-amber-800/50 to-yellow-900/50 border-2 border-yellow-500 p-8 text-center rounded-xl">
            <div className="text-6xl mb-4">👑</div>
            {tournoi.champion.characterImage && (
              <img src={tournoi.champion.characterImage} alt={tournoi.champion.nom} className="w-32 h-auto mx-auto mb-4 object-contain" />
            )}
            <h2 className="text-3xl font-bold text-yellow-300">{tournoi.champion.nom}</h2>
            <p className="text-amber-300">{tournoi.champion.race} • {tournoi.champion.classe}</p>
            <p className="text-yellow-400 font-bold mt-2">{isSimulation ? 'CHAMPION DE LA SIMULATION' : 'CHAMPION DU TOURNOI'}</p>
            {!isSimulation && <p className="text-stone-400 text-sm mt-1">Récompense: 3 rolls pour le prochain personnage</p>}
          </div>
        )}

        {/* Combat UI (même layout que Combat.jsx) */}
        {renderCombatUI()}

        {/* Bracket (toggle) */}
        <div className="mt-6">
          <button
            onClick={() => setShowBracket(!showBracket)}
            className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-6 py-2 rounded-lg transition border border-stone-600 w-full text-left font-bold"
          >
            {showBracket ? '▼' : '▶'} 📊 Arbre du tournoi
          </button>
          {showBracket && (
            <div className="bg-stone-800/90 border border-stone-600 p-4 rounded-b-xl overflow-x-auto">
              {renderBracket()}
            </div>
          )}
        </div>

        {/* Admin Controls */}
        {isAdmin && !isTournoiTermine && (
          <div className="mt-6 bg-stone-900 border border-red-600 p-4 rounded-xl flex flex-wrap gap-4 justify-center">
            <button
              onClick={handleMatchSuivant}
              disabled={actionLoading || isAnimating}
              className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white px-8 py-3 font-bold rounded-lg transition"
            >
              {actionLoading ? '⏳ Simulation...' : '⏭️ Match suivant'}
            </button>
          </div>
        )}

        {isAdmin && isTournoiTermine && (
          <div className="mt-6 bg-stone-900 border border-red-600 p-4 rounded-xl flex flex-wrap gap-4 justify-center">
            <button
              onClick={handleTerminerTournoi}
              disabled={actionLoading}
              className={`${isSimulation ? 'bg-stone-600 hover:bg-stone-500' : 'bg-red-600 hover:bg-red-500'} disabled:bg-stone-700 text-white px-8 py-3 font-bold rounded-lg transition`}
            >
              {actionLoading ? '⏳...' : isSimulation ? '← Quitter la simulation' : '🏁 Archiver & Terminer'}
            </button>
          </div>
        )}

        {/* Bouton quitter simulation (toujours visible en simulation) */}
        {isSimulation && !isTournoiTermine && (
          <div className="mt-4 text-center">
            <button
              onClick={async () => {
                if (animationRef.current) animationRef.current.cancelled = true;
                if (autoAdvanceRef.current) { clearTimeout(autoAdvanceRef.current); autoAdvanceRef.current = null; }
                setActionLoading(true);
                await terminerTournoi(docId);
                setActionLoading(false);
                navigate('/admin');
              }}
              disabled={actionLoading}
              className="bg-stone-600 hover:bg-stone-500 disabled:bg-stone-700 text-white px-6 py-2 rounded-lg transition"
            >
              {actionLoading ? '⏳...' : '← Quitter la simulation'}
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 text-center">
          <button onClick={() => navigate(isSimulation ? '/admin' : '/')} className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg transition">
            ← Retour
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tournament;
