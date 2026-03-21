import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveCharacter, getUserCharacter, canCreateCharacter, updateCharacterLevel, savePendingRoll, getPendingRoll, deletePendingRoll, updateCharacterOwnerPseudo, saveOwnerPseudoToAccount, getOwnerPseudoFromAccount, getDisabledCharacters, getAccountTitles, saveAccountTitles, updateCharacterEquippedRealBorder } from '../services/characterService';
import { resetDungeonRuns, getLatestDungeonRunsGrant, getPlayerDungeonSummary } from '../services/dungeonService';
import { resetUserLabyrinthProgress, getUserLabyrinthProgress } from '../services/infiniteLabyrinthService';
import { checkTripleRoll, consumeTripleRoll, getTripleRollCount, getPlayerTournamentRank } from '../services/tournamentService';
import { getWorldBossEvent } from '../services/worldBossService';
import { shouldLockPveModes } from '../services/gameAvailabilityService';
import Header from './Header';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { applyStatBoosts, getEmptyStatBoosts, getStatPointValue } from '../utils/statPoints';
import { getWeaponById, getWeaponFamilyInfo, getWeaponsByFamily, RARITY_COLORS } from '../data/weapons';
import { classConstants, raceConstants, getRaceBonus, getClassBonus, weaponConstants } from '../data/combatMechanics';
import { getMageTowerPassiveById, getMageTowerPassiveLevel, MAGE_TOWER_PASSIVES } from '../data/mageTowerPassives';
import { getFusedPassiveDisplayData } from '../data/extensionDungeon';
import SharedTooltip from './SharedTooltip';
import InteractiveCharacterCard from './InteractiveCharacterCard';
import { getRaceBonusText, getClassDescriptionText, buildRaceAwakeningDescription } from '../utils/descriptionBuilders';
import { getCalculatedClassDescription } from '../utils/calculatedClassDescription';
import { applyPassiveWeaponStats, applyForgeUpgrade } from '../utils/weaponEffects';
import { applyAwakeningToBase, getAwakeningEffect, removeBaseRaceFlatBonusesIfAwakened } from '../utils/awakening';
import { isForgeActive } from '../data/featureFlags';
import { getWeaponUpgrade } from '../services/forgeService';
import { formatUpgradePct, extractForgeUpgrade, hasAnyForgeUpgrade, FORGE_STAT_LABELS, computeForgeStatDelta } from '../data/forgeDungeon';
import { useCharacterStatsDisplay } from '../hooks/useCharacterStatsDisplay';
import SubclassDetailBlock from './SubclassDetailBlock';
import { getDisplayTitle, equipTitle, checkCrossWeekTitles, getObtentionStats } from '../services/titleService';
import { TITLES, getFormattedTitle } from '../data/titles';
import { BORDERS, checkBorderUnlocks, equipBorder, syncUnlockedBorders, resolveBorderId, getBorderGlowClass } from '../data/borders';
import CardBorderCanvas from './CardBorderCanvas';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';

const weaponImageModules = import.meta.glob('../assets/weapons/*.png', { eager: true, import: 'default' });
const realBorderPngModules = import.meta.glob('../assets/backgrounds/*.png', { eager: true, import: 'default' });

const getRealBorderImageSrc = (borderIdOrFile) => {
  const raw = String(borderIdOrFile || '').trim();
  if (!raw) return null;
  const wantsPng = raw.toLowerCase().endsWith('.png');
  const fileName = wantsPng ? raw : `${raw}.png`;
  const base = fileName.replace(/\.png$/i, '');
  if (!base || /^BG$/i.test(base) || /Old$/i.test(base)) return null;
  const key = `../assets/backgrounds/${fileName}`;
  return realBorderPngModules[key] || null;
};

const getRealBorderCandidates = () => {
  const entries = Object.keys(realBorderPngModules)
    .map((k) => {
      const file = k.split('/').pop() || '';
      return { key: k, file };
    })
    .filter(({ file }) => file.toLowerCase().endsWith('.png'))
    .map(({ key, file }) => {
      const base = file.replace(/\.png$/i, '');
      return { key, file, base };
    })
    .filter(({ base }) => !/^BG$/i.test(base))
    .filter(({ base }) => !/Old$/i.test(base));

  // Tri stable: base case-insensitive
  entries.sort((a, b) => a.base.toLowerCase().localeCompare(b.base.toLowerCase(), 'fr'));
  return entries;
};

const REAL_BORDER_CANVAS_OPTIONS = [];

const getWeaponImage = (imageFile) => {
  if (!imageFile) return null;
  return weaponImageModules[`../assets/weapons/${imageFile}`] || null;
};

// Composant Tooltip réutilisable
const Tooltip = ({ children, content }) => {
  return (
    <span className="relative group cursor-help">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-stone-900 border border-amber-500 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[100] shadow-lg">
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

const STAT_DESCRIPTIONS = {
  hp: "Points de vie max. Quand tu tombes à 0, le combat est perdu.",
  auto: "Puissance des attaques de base (et certaines compétences qui scalent dessus).",
  def: "Réduit les dégâts physiques reçus.",
  cap: "Puissance des capacités (CAP) et scaling de plusieurs effets.",
  rescap: "Réduit les dégâts magiques/CAP reçus.",
  spd: "Détermine l'ordre d'action (le plus rapide joue en premier)."
};

const getWeaponStatColor = (value) => {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-yellow-300';
};

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

const getWeaponTooltipContent = (weapon, hideFlatStats = false) => {
  if (!weapon) return null;
  const stats = hideFlatStats ? null : formatWeaponStats(weapon);
  return (
    <span className="block whitespace-normal text-xs">
      <span className="block font-semibold text-white">{weapon.nom}</span>
      <span className="block text-stone-300">{weapon.description}</span>
      {weapon.effet && typeof weapon.effet === 'object' ? (
        <span className="block text-amber-200">
          Effet: {weapon.effet.nom}<br />Description: {weapon.effet.description}
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

const CollapsiblePanel = ({ title, subtitle, isOpen, onToggle, children }) => {
  return (
    <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-stone-900/30 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="min-w-0">
          <div className="text-sm font-bold text-amber-400 uppercase tracking-widest truncate">{title}</div>
          {subtitle ? (
            <div className="text-[11px] text-stone-500 mt-1 leading-snug">
              {subtitle}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] font-semibold text-stone-400">{isOpen ? 'Masquer' : 'Afficher'}</span>
          <span className="text-stone-300 text-lg leading-none">{isOpen ? '▴' : '▾'}</span>
        </div>
      </button>

      <div className={`${isOpen ? 'block' : 'hidden'} px-4 pb-4`}>
        {children}
      </div>
    </div>
  );
};


const RecapPanel = ({ data }) => {
  if (!data) return null;

  const reminders = [];
  if (data.missingWeapon) reminders.push({ icon: '⚔️', text: "Pas d'arme — fais la Grotte !" });
  if (data.missingPassive) reminders.push({ icon: '🔮', text: "Pas de passif — fais la Tour !" });
  if (data.missingForest) reminders.push({ icon: '🌿', text: "Pas de boost — fais la Forêt !" });
  if (data.missingForge) reminders.push({ icon: '🔨', text: "Pas de forge — défie Ornn !" });
  if (data.missingExtension) reminders.push({ icon: '🌀', text: "Pas d'extension — fais Gojo !" });
  if (data.missingSubclass) reminders.push({ icon: '🎓', text: "Pas de sous-classe — fais le Collège !" });

  const labPct = (data.labFloor / 120) * 100;
  const bossDead = data.worldBossHp != null && data.worldBossHp <= 0;
  const bossPct = (data.worldBossMaxHp && data.worldBossMaxHp > 0)
    ? (data.worldBossHp / data.worldBossMaxHp) * 100
    : 0;

  return (
    <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl p-3 shadow-lg space-y-2">
      <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest">📋 Récap</h3>

      {/* Essais donjon */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-stone-400">⚔️ Essais restants</span>
        <span className={`font-bold ${data.runsRemaining > 0 ? 'text-white' : 'text-red-400'}`}>{data.runsRemaining}</span>
      </div>

      {/* Labyrinthe */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-stone-400">🏰 Labyrinthe</span>
          <span className="font-bold text-white">Étage {data.labFloor}/120</span>
        </div>
        <div className="w-full h-1 bg-stone-800 rounded-full overflow-hidden">
          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${labPct}%` }} />
        </div>
      </div>

      {/* Miroir */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-stone-400">🪞 Miroir</span>
        {data.mirrorDoneToday ? (
          <span className="font-semibold text-stone-500">Fait ✓</span>
        ) : (
          <span className="font-semibold text-emerald-400">Disponible</span>
        )}
      </div>

      {/* Cataclysme */}
      {data.worldBossHp != null && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-stone-400">💀 Cataclysme</span>
            {bossDead ? (
              <span className="font-bold text-stone-500">Mort 💀</span>
            ) : (
              <span className="font-bold text-red-400">
                {data.worldBossHp.toLocaleString()} / {data.worldBossMaxHp.toLocaleString()}
              </span>
            )}
          </div>
          {!bossDead && (
            <div className="w-full h-1 bg-stone-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: `${bossPct}%` }} />
            </div>
          )}
          {data.worldBossName && (
            <div className="text-[10px] text-stone-500 mt-0.5">{data.worldBossName}</div>
          )}
        </div>
      )}

      {/* Tournoi */}
      {data.tournamentRank && data.tournamentRank.rank != null && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-stone-400">🏆 Tournoi précédent</span>
          <span className={`font-bold ${data.tournamentRank.rank === 1 ? 'text-amber-300' : 'text-white'}`}>
            {data.tournamentRank.rank === 1 ? 'Champion !' : `${data.tournamentRank.rank}e / ${data.tournamentRank.total}`}
          </span>
        </div>
      )}

      {/* Rappels */}
      {reminders.length > 0 && (
        <div className="border-t border-stone-700/60 pt-2">
          <div className="text-[10px] text-amber-400 font-semibold mb-1.5">💡 N'oublie pas</div>
          <div className="space-y-1">
            {reminders.map((r, i) => (
              <div key={i} className="text-[11px] text-stone-300">
                {r.icon} {r.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const splitDescriptionLines = (text) => {
  if (!text) return [];
  return text
    .split('\n')
    .flatMap((chunk) => chunk.split(' - '))
    .flatMap((chunk) => chunk.split(', '))
    .flatMap((chunk) => chunk.split(' & '))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.startsWith('-') ? line.replace(/^-\s*/, '') : line);
};

const BALANCE_KEY_LABELS_FR = {
  healDamagePercent: 'Dégâts depuis soins',
  regenPercent: 'Régénération',
  healCritMultiplier: 'Multiplicateur critique soin',
  defToAtkPercent: 'DEF convertie en Auto',
  rescapToAtkPercent: 'RESC convertie en Auto',
  damageBonus: 'Bonus dégâts',
  n: 'Fréquence (tours/attaques)',
  shieldPercent: 'Bouclier',
  damageTakenBonus: 'Dégâts subis bonus',
  defReduction: 'Réduction DEF',
  healPercent: 'Soins',
  lightningPercent: 'Dégâts éclair',
  outgoing: 'Dégâts infligés',
  incoming: 'Dégâts reçus',
  critReduction: 'Réduction dégâts critiques',
  critThreshold: 'Seuil critique garanti',
  spellCapBonus: 'Bonus CAP de la capacité',
  turns: 'Durée (tours)',
  hpCostPercent: 'Coût HP',
  autoDamageBonus: 'Bonus dégâts auto',
  shieldExplosionPercent: 'Explosion bouclier',
  healReduction: 'Réduction des soins',
  initialBleedPercent: 'Saignement initial',
  bleedDecayPercent: 'Décroissance saignement',
  stunDuration: 'Durée étourdissement',
  critChanceBonus: 'Chance critique bonus',
  critDamageBonus: 'Dégâts critiques bonus',
  maxStacks: 'Stacks max',
  chance: 'Chance'
};

const prettifyBalanceKey = (key) => BALANCE_KEY_LABELS_FR[key] || key
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/_/g, ' ')
  .replace(/^./, (c) => c.toUpperCase());

const inferBalanceFormat = (key, value) => {
  if (typeof value !== 'number') return 'raw';
  if (Math.abs(value) <= 1 && /(percent|bonus|reduction|multiplier|chance|threshold|scale|outgoing|incoming|regen|damage|heal|crit|ignore|reflect|shield|cost)/i.test(key)) {
    return 'percent';
  }
  return 'raw';
};

const flattenBalanceNumbers = (obj) => {
  const out = [];
  Object.entries(obj || {}).forEach(([key, val]) => {
    if (key === 'description') return;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      flattenBalanceNumbers(val).forEach((entry) => out.push(entry));
      return;
    }
    if (typeof val === 'number') out.push({ key, val, format: inferBalanceFormat(key, val) });
  });
  return out;
};

const buildLiveBalanceDescription = (obj, fallback = '') => {
  const parts = flattenBalanceNumbers(obj).map(({ key, val, format }) => {
    if (format === 'percent') {
      const pct = val * 100;
      const display = Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1);
      return `${prettifyBalanceKey(key)}: ${display}%`;
    }
    return `${prettifyBalanceKey(key)}: ${val}`;
  });
  return parts.join(' · ') || fallback;
};

const CharacterCreation = () => {
  const [loading, setLoading] = useState(true);
  const [existingCharacter, setExistingCharacter] = useState(null);
  const [ownerPseudo, setOwnerPseudo] = useState('');
  const [showPseudoModal, setShowPseudoModal] = useState(false);
  const [pseudoSaving, setPseudoSaving] = useState(false);
  const [pseudoError, setPseudoError] = useState('');
  const [equippedWeapon, setEquippedWeapon] = useState(null);
  const [canCreate, setCanCreate] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [step, setStep] = useState(1); // 1 = roll race/classe, 2 = nom/sexe/mot-clé
  const [rolledCharacter, setRolledCharacter] = useState(null); // Personnage rollé (avec race, classe, stats)
  const [formData, setFormData] = useState({ name: '', gender: '', keyword: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTripleRoll, setHasTripleRoll] = useState(false);
  const [rollsRemaining, setRollsRemaining] = useState(0);
  const [allRolls, setAllRolls] = useState([]);
  const [dungeonGrantPopup, setDungeonGrantPopup] = useState(null);
  const [lastWeekRestrictions, setLastWeekRestrictions] = useState({ race: null, class: null });
  const [isDowntimeLocked, setIsDowntimeLocked] = useState(false);
  const [obtentionStats, setObtentionStats] = useState(null);
  const [recapData, setRecapData] = useState(null);
  const [isTitlesOpen, setIsTitlesOpen] = useState(true);
  const [isEffectsOpen, setIsEffectsOpen] = useState(true);
  const [isBordersOpen, setIsBordersOpen] = useState(true);
  const [unlockProgress, setUnlockProgress] = useState({
    tournamentWins: 0,
    cataclysmeWins: 0,
    bossRushCompletions: 0,
    labyrinthFloor90Wins: 0,
    perfectCharacterCount: 0,
  });
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const weaponFamilies = getWeaponFamilyInfo();
  const titleCount = (existingCharacter?.earnedTitles || []).length;
  const totalTitlesCount = Object.keys(TITLES).length;

  const getBorderProgressText = (borderId) => {
    const progressMap = {
      water_sun: { current: unlockProgress.tournamentWins ?? 0, target: 2 },
      night_moon: { current: unlockProgress.cataclysmeWins ?? 0, target: 3 },
      storm_tempest: { current: unlockProgress.bossRushCompletions ?? 0, target: 5 },
      sable: { current: unlockProgress.labyrinthFloor90Wins ?? 0, target: 5 },
      perfect_character: { current: unlockProgress.perfectCharacterCount ?? 0, target: 1 },
      titane: { current: titleCount, target: 10 },
      cosmique: { current: titleCount, target: 20 },
      transcendance: { current: titleCount, target: totalTitlesCount },
    };
    const p = progressMap[borderId];
    if (!p) return null;
    const current = Math.max(0, Math.min(p.current, p.target));
    return `${current}/${p.target}`;
  };

  const formatBorderCondition = (border) => {
    const progress = getBorderProgressText(border.id);
    if (!progress) return border.condition;
    return `${border.condition} (${progress})`;
  };

  useEffect(() => {
    const introMusic = document.getElementById('intro-music');
    if (!introMusic) return undefined;

    introMusic.play().catch(() => {});

    return () => {
      introMusic.pause();
    };
  }, []);

  const renderIntroMusic = () => (
    <audio id="intro-music" loop>
      <source src="/assets/music/intro.mp3" type="audio/mpeg" />
    </audio>
  );

  const renderGameEncyclopedia = () => (
    <div className="mt-10">
      <button
        type="button"
        onClick={() => navigate('/encyclopedie')}
        className="w-full bg-stone-900/80 border-2 border-amber-600 px-5 py-4 text-amber-300 font-bold text-lg hover:border-amber-400 transition rounded-lg"
      >
        📚 Voir l'encyclopédie du jeu (races, classes, sous-classes, armes…)
      </button>

      {false && (
        <div className="mt-4 space-y-6">
          <div className="bg-stone-800/70 border border-stone-600 p-5">
            <h3 className="text-xl text-amber-300 font-bold mb-3">📊 Description des stats</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.entries(STAT_LABELS).map(([key, label]) => (
                <div key={key} className="bg-stone-900/60 border border-stone-700 p-3">
                  <div className="font-bold text-white mb-1">{label}</div>
                  <div className="text-stone-300 text-xs">{STAT_DESCRIPTIONS[key]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-stone-800/70 border border-stone-600 p-5">
            <h3 className="text-xl text-amber-300 font-bold mb-3">⚔️ Classes détaillées</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.entries(classes).map(([name, info]) => (
                <div key={name} className="bg-stone-900/60 border border-stone-700 p-3">
                  <div className="font-bold text-white mb-1">{info.icon} {name}</div>
                  <div className="text-amber-200 text-sm mb-1">{info.ability}</div>
                  <div className="text-stone-300 text-xs">{getClassDescriptionText(name)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-stone-800/70 border border-stone-600 p-5">
            <h3 className="text-xl text-amber-300 font-bold mb-3">🎭 Races & Awakening</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.entries(races).map(([name, info]) => {
                const bonusLines = splitDescriptionLines(getRaceBonusText(name));
                const awakeningLines = splitDescriptionLines(buildRaceAwakeningDescription(name));

                return (
                  <div key={name} className="bg-stone-900/60 border border-stone-700 p-3">
                    <div className="font-bold text-white mb-2">{info.icon} {name}</div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-stone-300 text-xs font-semibold mb-1">Bonus racial</div>
                        <div className="text-stone-300 text-xs space-y-0.5">
                          {bonusLines.map((line, idx) => (
                            <div key={`${name}-bonus-${idx}`}>- {line}</div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-emerald-300 text-xs font-semibold mb-1">Awakening (Niv {info.awakening?.levelRequired})</div>
                        <div className="text-emerald-200 text-xs space-y-0.5">
                          {awakeningLines.map((line, idx) => (
                            <div key={`${name}-awak-${idx}`}>- {line}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-stone-800/70 border border-stone-600 p-5">
            <h3 className="text-xl text-amber-300 font-bold mb-3">🗡️ Armes</h3>
            <div className="space-y-3">
              {Object.entries(weaponFamilies).map(([familyId, familyInfo]) => {
                const familyWeapons = getWeaponsByFamily(familyId)
                  .sort((a, b) => {
                    const rank = { commune: 1, rare: 2, legendaire: 3 };
                    return rank[a.rarete] - rank[b.rarete];
                  });
                return (
                  <div key={familyId} className="bg-stone-900/60 border border-stone-700 p-3">
                    <div className="font-bold text-white mb-2">{familyInfo.icon} {familyInfo.nom}</div>
                    <div className="grid md:grid-cols-3 gap-2">
                      {familyWeapons.map((weapon) => (
                        <div key={weapon.id} className="bg-stone-950/60 border border-stone-800 p-2">
                          <div className={`text-sm font-bold ${RARITY_COLORS[weapon.rarete]}`}>{weapon.nom}</div>
                          <div className="text-[11px] text-stone-400 mb-1">{weapon.rarete}</div>
                          <div className="text-[11px] text-stone-300 mb-1">{Object.entries(weapon.stats).filter(([, v]) => v !== 0).map(([k, v]) => `${STAT_LABELS[k] || k.toUpperCase()} ${v > 0 ? `+${v}` : v}`).join(' • ')}</div>
                          {weapon.effet && typeof weapon.effet === 'object' ? (
                            <div className="text-[11px] text-amber-200">Effet: {weapon.effet.nom} · Description: {weapon.effet.description}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-stone-800/70 border border-stone-600 p-5">
            <h3 className="text-xl text-amber-300 font-bold mb-3">✨ Passifs (Tour de Mage)</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {MAGE_TOWER_PASSIVES.map((passive) => (
                <div key={passive.id} className="bg-stone-900/60 border border-stone-700 p-3">
                  <div className="font-bold text-white mb-2">{passive.icon} {passive.name}</div>
                  <div className="space-y-1">
                    {Object.entries(passive.levels).map(([lvl, lvlData]) => (
                      <div key={`${passive.id}-${lvl}`} className="text-xs">
                        <span className="text-amber-200 font-semibold">Niv {lvl}:</span>{' '}
                        <span className="text-stone-300">Description: {lvlData.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-stone-800/70 border border-stone-600 p-5">
            <h3 className="text-xl text-amber-300 font-bold mb-3">🔨 Amélioration des armes (Forge des Légendes)</h3>
            <div className="space-y-3 text-stone-300 text-sm">
              <p>
                La <strong className="text-amber-200">Forge des Légendes</strong> est un donjon optionnel affrontant <strong>Ornn, le Dieu de la Forge</strong>. Il est accessible uniquement si vous équipez une <strong>arme légendaire</strong>.
              </p>
              <p>
                En cas de victoire, votre arme reçoit un <strong className="text-emerald-300">upgrade permanent</strong> : des bonus en pourcentage sont appliqués sur chaque stat positive de l’arme (Auto, VIT, CAP, HP, DEF, ResC). Les plages de bonus sont tirées aléatoirement (environ +10 % à +20 % par stat concernée). Certaines armes peuvent aussi recevoir un <strong className="text-amber-300">malus</strong> sur une stat (par exemple la Vitesse), réduisant légèrement cette stat en échange des autres bonus. Les bonus et malus s’appliquent sur les stats totales du personnage en combat. Une fois forgée, l’arme conserve cet upgrade pour tous vos futurs combats.
              </p>
            </div>
          </div>

          <div className="bg-stone-800/70 border border-stone-600 p-5">
            <h3 className="text-xl text-amber-300 font-bold mb-3">✨ Fusion des passifs (Extension du Territoire)</h3>
            <div className="space-y-3 text-stone-300 text-sm">
              <p>
                L’<strong className="text-amber-200">Extension du Territoire</strong> est un donjon optionnel affrontant <strong>Satoru Gojo</strong>. Il est accessible uniquement si vous avez un <strong>passif Tour du Mage au niveau 3</strong>.
              </p>
              <p>
                En cas de victoire, vous <strong className="text-emerald-300">conservez votre passif actuel</strong> (niveau 3) et vous gagnez un <strong className="text-emerald-300">second passif</strong>, tiré aléatoirement parmi les autres passifs du Tour du Mage. Le <strong>niveau</strong> du passif d’extension est lui aussi tiré au sort : <strong className="text-amber-200">90 % niveau 1</strong>, <strong className="text-amber-200">9 % niveau 2</strong>, <strong className="text-amber-200">1 % niveau 3</strong>.
              </p>
              <p>
                Le nom affiché est une <strong>fusion</strong> des deux passifs (ex. « Orbe du Sacrifice de la Licorne », « Barrière du Sacrifice »). Si le passif d’extension est niveau 2 ou 3, le niveau apparaît à côté du nom (ex. « Barrière du Sacrifice, niveau 2 »). Au survol du nom fusionné, vous pouvez voir le détail des deux passifs. Vous cumulez les effets de votre passif principal (niv. 3) et ceux du passif secondaire (niv. 1, 2 ou 3) pour tous vos combats.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const getCalculatedDescription = getCalculatedClassDescription;

  const pseudoStorageKey = currentUser ? `ownerPseudo:${currentUser.uid}` : null;

  const normalizePseudo = (value) => value.trim().slice(0, 24);

  const handleSavePseudo = async () => {
    const normalized = normalizePseudo(ownerPseudo);
    if (normalized.length < 3) {
      setPseudoError('Pseudo requis (3-24 caractères).');
      return;
    }

    setPseudoSaving(true);
    setPseudoError('');
    try {
      if (existingCharacter) {
        const result = await updateCharacterOwnerPseudo(currentUser.uid, normalized);
        if (!result.success) {
          setPseudoError(result.error || 'Erreur sauvegarde pseudo');
          return;
        }
        setExistingCharacter(prev => prev ? { ...prev, ownerPseudo: normalized } : prev);
      }

      if (pseudoStorageKey) {
        localStorage.setItem(pseudoStorageKey, normalized);
      }
      setOwnerPseudo(normalized);
      setShowPseudoModal(false);
    } finally {
      setPseudoSaving(false);
    }
  };

  // Charger le personnage existant au montage
  useEffect(() => {
    const loadCharacter = async () => {
      if (!currentUser) return;

      setLoading(true);
      const { success, data } = await getUserCharacter(currentUser.uid);
      const accountPseudoResult = await getOwnerPseudoFromAccount(currentUser.uid);
      const accountPseudo = accountPseudoResult.success ? (accountPseudoResult.ownerPseudo || '') : '';
      const storedPseudo = localStorage.getItem(`ownerPseudo:${currentUser.uid}`) || '';

      if (success && data && !data.disabled) {
        const normalized = normalizeCharacterBonuses(data);
        const level = normalized.level ?? 1;
        if (normalized.level == null) {
          updateCharacterLevel(currentUser.uid, level);
        }
        // Charger forge upgrade si le feature est actif
        let forgeUpgradeData = null;
        if (isForgeActive()) {
          const upgradeResult = await getWeaponUpgrade(currentUser.uid);
          if (upgradeResult.success && upgradeResult.data) {
            forgeUpgradeData = upgradeResult.data;
          }
        }
        const charData = { ...normalized, level, forgeUpgrade: forgeUpgradeData };
        getAccountTitles(currentUser.uid).then(accountTitles => {
          if (!accountTitles.earnedTitles.length) return;
          const charTitles = charData.earnedTitles || [];
          const merged = [...new Set([...charTitles, ...accountTitles.earnedTitles])];
          if (merged.length > charTitles.length) {
            setExistingCharacter(prev => ({
              ...prev,
              earnedTitles: merged,
              equippedTitle: prev.equippedTitle || accountTitles.equippedTitle || null,
            }));
            saveAccountTitles(currentUser.uid, merged, charData.equippedTitle || accountTitles.equippedTitle);
          }
        }).catch(() => {});
        setExistingCharacter(charData);
        Promise.all([
          getUserLabyrinthProgress(currentUser.uid),
          getPlayerDungeonSummary(currentUser.uid),
          getWorldBossEvent(),
          getPlayerTournamentRank(currentUser.uid),
          getDoc(doc(db, 'tournamentRewards', currentUser.uid)),
        ]).then(([labResult, summaryResult, wbResult, rankResult, rewardSnap]) => {
          const labFloor = labResult.success ? (labResult.data?.highestClearedFloor ?? 0) : 0;
          const labCurrentFloor = labResult.success ? (labResult.data?.currentFloor ?? labFloor + 1) : 1;
          const bossRushDone = summaryResult.success ? !!summaryResult.data?.bossRushCompleted : false;
          const bossRushCompletions = summaryResult.success
            ? (Number.isFinite(summaryResult.data?.bossRushCompletions)
              ? summaryResult.data?.bossRushCompletions
              : (bossRushDone ? 1 : 0))
            : 0;
          const dungeonCompletions = summaryResult.success ? (summaryResult.data?.dungeonCompletions || {}) : {};
          const rewardData = rewardSnap?.exists?.() ? (rewardSnap.data() || {}) : {};
          const tournamentWinsRaw = Number.isFinite(rewardData.tournamentWins) ? rewardData.tournamentWins : undefined;
          const cataclysmeWinsRaw = Number.isFinite(rewardData.cataclysmeWins) ? rewardData.cataclysmeWins : undefined;
          const rewardBossRushCompletions = Number.isFinite(rewardData.bossRushCompletions)
            ? rewardData.bossRushCompletions
            : 0;
          const labyrinthFloor90Wins = Number.isFinite(rewardData.labyrinthFloor90Wins)
            ? rewardData.labyrinthFloor90Wins
            : (labFloor >= 90 ? 1 : 0);
          const perfectCharacterCount = Number.isFinite(rewardData.perfectCharacterCount)
            ? rewardData.perfectCharacterCount
            : 0;
          const bossRushCompletionsAccount = Math.max(bossRushCompletions, rewardBossRushCompletions);
          const earnedTitles = charData.earnedTitles || [];
          const unlockedBorders = charData.unlockedBorders || [];

          // Fallbacks d'affichage pour les anciens joueurs:
          // - si les compteurs n'existent pas encore dans tournamentRewards,
          //   on infère un minimum cohérent via titres/bordures déjà obtenus.
          const inferredTournamentWins = Math.max(
            tournamentWinsRaw ?? 0,
            earnedTitles.includes('legendaire') ? 2 : 0,
            earnedTitles.includes('champion') ? 1 : 0,
            unlockedBorders.includes('water_sun') ? 2 : 0,
            unlockedBorders.includes('champion') ? 1 : 0,
          );
          const inferredCataclysmeWins = Math.max(
            cataclysmeWinsRaw ?? 0,
            earnedTitles.includes('sauveur_monde') ? 1 : 0,
            unlockedBorders.includes('night_moon') ? 3 : 0,
          );
          const inferredBossRushCompletions = Math.max(
            bossRushCompletionsAccount,
            unlockedBorders.includes('storm_tempest') ? 5 : 0,
            unlockedBorders.includes('blood') ? 1 : 0,
          );
          const inferredLabyrinthFloor90Wins = Math.max(
            labyrinthFloor90Wins,
            unlockedBorders.includes('sable') ? 5 : 0,
          );
          const inferredPerfectCharacterCount = Math.max(
            perfectCharacterCount,
            unlockedBorders.includes('perfect_character') ? 1 : 0,
          );

          setUnlockProgress({
            tournamentWins: inferredTournamentWins,
            cataclysmeWins: inferredCataclysmeWins,
            bossRushCompletions: inferredBossRushCompletions,
            labyrinthFloor90Wins: inferredLabyrinthFloor90Wins,
            perfectCharacterCount: inferredPerfectCharacterCount,
          });

          const extras = {
            labyrinthHighestFloor: labFloor,
            bossRushCompleted: bossRushDone,
            bossRushCompletions: bossRushCompletionsAccount,
            dungeonCompletions,
            tournamentWins: tournamentWinsRaw,
            cataclysmeWins: cataclysmeWinsRaw,
            labyrinthFloor90Wins,
          };

          syncUnlockedBorders(currentUser.uid, charData, extras).then(borders => {
            if (borders && borders.length > (charData.unlockedBorders?.length || 0)) {
              setExistingCharacter(prev => ({ ...prev, unlockedBorders: borders }));
            }
          });

          checkCrossWeekTitles(currentUser.uid, extras).then(newTitles => {
            if (newTitles?.length > 0) {
              setExistingCharacter(prev => ({
                ...prev,
                earnedTitles: [...(prev?.earnedTitles || []), ...newTitles],
              }));
            }
          });

          const runsRemaining = summaryResult.success ? (summaryResult.data?.runsRemaining ?? 0) : 0;
          const maxRuns = summaryResult.success ? (summaryResult.data?.maxRuns ?? 5) : 5;

          let mirrorDoneToday = false;
          if (summaryResult.success && summaryResult.data?.lastMirrorDate) {
            const raw = summaryResult.data.lastMirrorDate;
            const lastDate = typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw);
            const now = new Date();
            mirrorDoneToday = lastDate.getFullYear() === now.getFullYear()
              && lastDate.getMonth() === now.getMonth()
              && lastDate.getDate() === now.getDate();
          }

          const wbData = wbResult.success ? wbResult.data : null;
          const tournamentRank = rankResult.success ? rankResult.data : null;

          setRecapData({
            runsRemaining,
            maxRuns,
            labFloor,
            labCurrentFloor,
            mirrorDoneToday,
            worldBossName: wbData?.bossName || null,
            worldBossHp: wbData?.hpRemaining ?? null,
            worldBossMaxHp: wbData?.hpMax ?? null,
            worldBossStatus: wbData?.status || null,
            tournamentRank,
            missingWeapon: !charData.equippedWeaponId,
            missingPassive: !charData.mageTowerPassive,
            missingForest: !charData.forestBoosts || Object.values(charData.forestBoosts || {}).every(v => !v),
            missingForge: !charData.forgeUpgrade,
            missingExtension: !charData.mageTowerExtensionPassive,
            missingSubclass: !charData.subclass,
          });
        });
        getObtentionStats().then(setObtentionStats).catch(() => {});
        const pseudoValue = normalized.ownerPseudo || accountPseudo || storedPseudo;
        setOwnerPseudo(pseudoValue);
        setShowPseudoModal(!pseudoValue);
        if (normalized.ownerPseudo) {
          saveOwnerPseudoToAccount(currentUser.uid, normalizePseudo(normalized.ownerPseudo));
        }
        const weaponId = normalized.equippedWeaponId || null;
        const weaponData = weaponId ? getWeaponById(weaponId) : null;
        setEquippedWeapon(weaponData);
        setCanCreate(false);
      } else {
        // Vérifier si l'utilisateur peut créer un personnage
        const canCreateResult = await canCreateCharacter(currentUser.uid);
        setCanCreate(canCreateResult.canCreate);
        const pseudoValue = accountPseudo || storedPseudo;
        setOwnerPseudo(pseudoValue);
        setShowPseudoModal(!pseudoValue);
        if (!canCreateResult.canCreate && canCreateResult.daysRemaining) {
          setDaysRemaining(canCreateResult.daysRemaining);
        }

        // Vérifier s'il y a un roll en attente (lock anti-refresh)
        if (canCreateResult.canCreate) {
          const pendingResult = await getPendingRoll(currentUser.uid);
          if (pendingResult.success && pendingResult.data) {
            const pending = pendingResult.data;
            if (pending.type === 'triple' && pending.rolls) {
              setAllRolls(pending.rolls);
              setHasTripleRoll(true);
            } else if (pending.type === 'single' && pending.roll) {
              setRolledCharacter(pending.roll);
            }
            // Ne pas vérifier triple roll si un pending existe déjà
            setLoading(false);
            return;
          }
        }

        if (canCreateResult.canCreate) {
          const disabledCharsResult = await getDisabledCharacters(currentUser.uid);
          if (disabledCharsResult.success && disabledCharsResult.data.length > 0) {
            const latestDisabled = [...disabledCharsResult.data].sort((a, b) => {
              const aCreated = a.createdAt?.toMillis?.() || 0;
              const bCreated = b.createdAt?.toMillis?.() || 0;
              return bCreated - aCreated;
            })[0];

            setLastWeekRestrictions({
              race: latestDisabled?.race || null,
              class: latestDisabled?.class || null
            });
          }
        }

        // Vérifier la récompense triple roll
        const tripleRoll = await checkTripleRoll(currentUser.uid);
        if (tripleRoll) {
          const rollCount = await getTripleRollCount(currentUser.uid);
          setHasTripleRoll(true);
          setRollsRemaining(rollCount);
        }
      }

      setLoading(false);
    };

    loadCharacter();
  }, [currentUser]);

  useEffect(() => {
    const checkDowntime = async () => {
      const result = await shouldLockPveModes();
      setIsDowntimeLocked(!!result.locked);
    };

    checkDowntime();
  }, []);

  useEffect(() => {
    const loadDungeonGrantPopup = async () => {
      if (!currentUser?.uid) return;

      const result = await getLatestDungeonRunsGrant();
      if (!result.success || !result.data?.grantId) return;

      const storageKey = `dungeonGrantSeen:${currentUser.uid}`;
      const lastSeenGrantId = localStorage.getItem(storageKey);

      if (lastSeenGrantId !== result.data.grantId) {
        setDungeonGrantPopup(result.data);
      }
    };

    loadDungeonGrantPopup();
  }, [currentUser]);

  const closeDungeonGrantPopup = () => {
    if (!currentUser?.uid || !dungeonGrantPopup?.grantId) {
      setDungeonGrantPopup(null);
      return;
    }

    localStorage.setItem(`dungeonGrantSeen:${currentUser.uid}`, dungeonGrantPopup.grantId);
    setDungeonGrantPopup(null);
  };

  const renderDungeonGrantPopup = () => {
    if (!dungeonGrantPopup) return null;

    return (
      <div className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-stone-900 border-2 border-cyan-500 rounded-xl p-6 shadow-2xl">
          <h3 className="text-2xl font-bold text-cyan-300 mb-3">🎁 Bonus Donjon reçu !</h3>
          <p className="text-stone-200 mb-2">
            L'admin vous a offert <span className="text-cyan-300 font-bold">{dungeonGrantPopup.attemptsGranted} essai{dungeonGrantPopup.attemptsGranted > 1 ? 's' : ''}</span> de donjon.
          </p>
          <div className="bg-stone-800 border border-stone-600 rounded-lg p-4 mb-5">
            <p className="text-stone-300 whitespace-pre-wrap">{dungeonGrantPopup.message}</p>
          </div>
          <button
            onClick={closeDungeonGrantPopup}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-lg font-bold transition"
          >
            Compris
          </button>
        </div>
      </div>
    );
  };

  const genStats = () => {
    const s = { hp: 120, auto: 15, def: 15, cap: 15, rescap: 15, spd: 15 };
    let rem = 35; // 35 points à distribuer équitablement

    // Spike optionnel (30% chance) - ajoute de la variété sans dominer
    const pool = ['auto', 'def', 'cap', 'rescap', 'spd'];
    if (Math.random() < 0.3) {
      const k = pool[Math.floor(Math.random() * pool.length)];
      const spikeAmount = 5 + Math.floor(Math.random() * 6); // +5 à +10
      const actual = Math.min(spikeAmount, 35 - s[k]);
      s[k] += actual;
      rem -= actual;
    }

    // Distribution équilibrée des points restants
    let guard = 1000;
    while (rem > 0 && guard-- > 0) {
      // Poids égaux : HP a autant de chances que les autres stats
      const entries = [['hp',2],['auto',2],['def',2],['cap',2],['rescap',2],['spd',2]];
      const tot = entries.reduce((a,[,w]) => a + w, 0);
      let r = Math.random() * tot;
      let k = 'hp';
      for (const [key, w] of entries) {
        r -= w;
        if (r <= 0) { k = key; break; }
      }

      // 1 point = bonus selon la conversion des stats
      if (k === 'hp') {
        const hpGain = getStatPointValue('hp');
        if (s.hp + hpGain <= 200) { s.hp += hpGain; rem--; }
        // Si HP au max, on continue (pas de break)
      } else {
        const statGain = getStatPointValue(k);
        if (s[k] + statGain <= 35) { s[k] += statGain; rem--; }
        // Si stat au max, on continue (pas de break)
      }
    }

    return s;
  };

  // Utilise les fonctions centralisées de combatMechanics.js
  const raceBonus = (race) => getRaceBonus(race);
  const classBonus = (clazz) => getClassBonus(clazz);

  const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

  const pickRaceAndClass = () => {
    const racePool = Object.keys(races).filter((raceName) => raceName !== lastWeekRestrictions.race);
    const classPool = Object.keys(classes).filter((className) => className !== lastWeekRestrictions.class);

    const finalRacePool = racePool.length > 0 ? racePool : Object.keys(races);
    const finalClassPool = classPool.length > 0 ? classPool : Object.keys(classes);

    return {
      race: pickRandom(finalRacePool),
      charClass: pickRandom(finalClassPool)
    };
  };

  // Roll aléatoire de race/classe/stats (étape 1)
  const rollCharacter = async () => {
    if (hasTripleRoll) {
      // Triple roll: 3 rolls (tournoi ou cataclysme) ou 6 (tournoi + cataclysme)
      const count = rollsRemaining >= 6 ? 6 : 3;
      const rolls = [];
      for (let i = 0; i < count; i++) {
        const { race, charClass } = pickRaceAndClass();
        const raw = genStats();
        const rB = raceBonus(race);
        const cB = classBonus(charClass);
        const base = {
          hp: raw.hp+rB.hp+cB.hp,
          auto: raw.auto+rB.auto+cB.auto,
          def: raw.def+rB.def+cB.def,
          cap: raw.cap+rB.cap+cB.cap,
          rescap: raw.rescap+rB.rescap+cB.rescap,
          spd: raw.spd+rB.spd+cB.spd
        };
        rolls.push({ race, class: charClass, base, bonuses: { race: rB, class: cB } });
      }
      setAllRolls(rolls);
      setRolledCharacter(null);
      setRollsRemaining(0);
      // Sauvegarder les rolls en Firestore (3 ou 6)
      if (currentUser) {
        await savePendingRoll(currentUser.uid, { type: 'triple', rolls });
      }
    } else {
      const { race, charClass } = pickRaceAndClass();
      const raw = genStats();
      const rB = raceBonus(race);
      const cB = classBonus(charClass);
      const base = {
        hp: raw.hp+rB.hp+cB.hp,
        auto: raw.auto+rB.auto+cB.auto,
        def: raw.def+rB.def+cB.def,
        cap: raw.cap+rB.cap+cB.cap,
        rescap: raw.rescap+rB.rescap+cB.rescap,
        spd: raw.spd+rB.spd+cB.spd
      };
      const rolled = { race, class: charClass, base, bonuses: { race: rB, class: cB } };
      setRolledCharacter(rolled);
      // Sauvegarder le roll en Firestore
      if (currentUser) {
        await savePendingRoll(currentUser.uid, { type: 'single', roll: rolled });
      }
    }
  };

  const selectTripleRollChoice = async (roll) => {
    setRolledCharacter(roll);
    setAllRolls([]);
    setHasTripleRoll(false);
    if (currentUser) {
      // Consommer la récompense triple roll
      await consumeTripleRoll(currentUser.uid);
      // Mettre à jour le pending roll avec le choix final
      await savePendingRoll(currentUser.uid, { type: 'single', roll });
    }
  };

  // Générer le personnage final avec nom/sexe/mot-clé (étape 2)
  const generateCharacter = (name, gender, keyword) => {
    return {
      name,
      gender,
      keyword,
      race: rolledCharacter.race,
      class: rolledCharacter.class,
      base: rolledCharacter.base,
      bonuses: rolledCharacter.bonuses,
      forestBoosts: getEmptyStatBoosts(),
      level: 1,
      equippedWeaponId: null,
      mageTowerPassive: null,
      ownerPseudo: normalizePseudo(ownerPseudo) || null
    };
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim() || formData.name.trim().length < 3) newErrors.name = 'Nom requis (3-40 car.)';
    if (!formData.gender) newErrors.gender = 'Sélectionnez un sexe';
    if (!formData.keyword.trim() || formData.keyword.trim().length < 3) newErrors.keyword = 'Mot-clé requis (3-100 car.)';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!canCreate) return;
    if (!normalizePseudo(ownerPseudo)) {
      setShowPseudoModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const newChar = generateCharacter(formData.name.trim(), formData.gender, formData.keyword.trim());

      // Sauvegarder dans Firestore
      const result = await saveCharacter(currentUser.uid, newChar);

      if (result.success) {
        // Supprimer le pending roll
        await deletePendingRoll(currentUser.uid);
        await resetDungeonRuns(currentUser.uid);
        await resetUserLabyrinthProgress(currentUser.uid);
        const normalizedPseudo = normalizePseudo(ownerPseudo);
        if (pseudoStorageKey) localStorage.setItem(pseudoStorageKey, normalizedPseudo);
        await saveOwnerPseudoToAccount(currentUser.uid, normalizedPseudo);
        setExistingCharacter(newChar);
        setEquippedWeapon(null);
        setCanCreate(false);
      } else {
        setErrors({ submit: 'Erreur lors de la sauvegarde' });
      }
    } catch (error) {
      setErrors({ submit: 'Erreur survenue' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({...prev, [field]: value}));
    if (errors[field]) setErrors(prev => ({...prev, [field]: ''}));
  };


  const PseudoModal = showPseudoModal ? (
    <div className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-stone-900 border border-amber-500 p-5 shadow-2xl">
        <h3 className="text-xl font-bold text-amber-300 mb-2">Ton pseudo public</h3>
        <p className="text-stone-300 text-sm mb-4">
          Renseigne un pseudo pour identifier le propriétaire du personnage dans le Hall of Fame.
        </p>
        <input
          type="text"
          value={ownerPseudo}
          onChange={(e) => {
            setOwnerPseudo(e.target.value);
            if (pseudoError) setPseudoError('');
          }}
          placeholder="Ex: CrocMaster"
          className="w-full px-3 py-2 bg-stone-800 border border-stone-600 text-white focus:border-amber-400 outline-none"
          maxLength={24}
        />
        {pseudoError && <div className="text-red-400 text-xs mt-2">{pseudoError}</div>}
        <button
          onClick={handleSavePseudo}
          disabled={pseudoSaving}
          className="mt-4 w-full bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white font-bold py-2"
        >
          {pseudoSaving ? '⏳ Sauvegarde...' : 'Valider le pseudo'}
        </button>
      </div>
    </div>
  ) : null;

  // Chargement
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />

        {renderIntroMusic()}
        {PseudoModal}
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  // Afficher le personnage existant
  if (existingCharacter) {
    const statsDisplay = useCharacterStatsDisplay(existingCharacter, equippedWeapon);
    const {
      finalStats,
      getStatLineProps,
      hasForgeUpgrade,
      forgeUpgrade,
      forgeLabel,
      passiveDetails,
      fusedPassiveDisplay,
      awakeningInfo,
      isAwakeningActive,
      weapon,
    } = statsDisplay;

    const StatLine = ({ statKey, label, valueClassName = '' }) => {
      const props = getStatLineProps(statKey, label, valueClassName);
      const { displayValue, hasBonus, labelClass, tooltipContent: tip } = props;
      return hasBonus ? (
        <Tooltip content={tip}>
          <div className={valueClassName}>
            {label} : <span className={`font-bold ${labelClass}`}>{displayValue}</span>
          </div>
        </Tooltip>
      ) : (
        <div className={valueClassName}>
          {label} : <span className="text-white font-bold">{displayValue}</span>
        </div>
      );
    };

    return (
      <div className="min-h-screen p-6">
        <Header />

        {renderIntroMusic()}
        {PseudoModal}
        <div className="max-w-[1400px] mx-auto pt-24 sm:pt-20">
          <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
            {/* Info Panel (stats, weapon, passive, etc.) */}
            <div className="order-2 lg:order-1 w-full lg:w-[320px] lg:flex-shrink-0">
              <div className="bg-stone-950/85 border border-stone-700/80 rounded-xl overflow-visible shadow-lg">
                <div className="p-4 space-y-3 overflow-visible">
                  <div className="flex justify-between text-sm text-white font-bold">
                    <StatLine statKey="hp" label="HP" valueClassName="text-white" />
                    <StatLine statKey="spd" label="VIT" valueClassName="text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-sm text-gray-300">
                    <StatLine statKey="auto" label="Auto" />
                    <StatLine statKey="def" label="Déf" />
                    <StatLine statKey="cap" label="Cap" />
                    <StatLine statKey="rescap" label="ResC" />
                  </div>
                  <div className="border-t border-stone-700/60 pt-3 space-y-2 overflow-visible">
                    {weapon ? (() => {
                      const weaponContent = (
                        <>
                          <Tooltip content={getWeaponTooltipContent(weapon, hasForgeUpgrade)}>
                            <span className="flex items-center gap-2">
                              {getWeaponImage(weapon.imageFile) ? (
                                <img src={getWeaponImage(weapon.imageFile)} alt={weapon.nom} className="w-8 h-auto" />
                              ) : (
                                <span className="text-xl">{weapon.icon}</span>
                              )}
                              <span className={`font-semibold ${hasForgeUpgrade ? 'forge-lava-text' : RARITY_COLORS[weapon.rarete]}`}>{weapon.nom}</span>
                            </span>
                          </Tooltip>
                          <div className="text-[11px] text-stone-400 mt-1 space-y-1">
                            <div>{weapon.description}</div>
                            {weapon.effet && typeof weapon.effet === 'object' ? (
                              <div className="text-amber-200">
                                Effet: {weapon.effet.nom}<br />Description: {weapon.effet.description}
                              </div>
                            ) : null}
                            {weapon.stats && Object.keys(weapon.stats).length > 0 && !hasForgeUpgrade ? (
                              <div className="text-stone-200">
                                Stats: {formatWeaponStats(weapon)}
                              </div>
                            ) : null}
                            {hasForgeUpgrade && (
                              <div className="text-orange-300 font-semibold">
                                🔨 Forge: {Object.entries(extractForgeUpgrade(forgeUpgrade).bonuses).map(([k, pct]) => `${forgeLabel(k)} +${formatUpgradePct(pct)}`).join(' • ')}
                                {Object.entries(extractForgeUpgrade(forgeUpgrade).penalties).map(([k, pct]) => `${forgeLabel(k)} -${formatUpgradePct(pct)}`).join(' • ') ? ` • ${Object.entries(extractForgeUpgrade(forgeUpgrade).penalties).map(([k, pct]) => `${forgeLabel(k)} -${formatUpgradePct(pct)}`).join(' • ')}` : ''}
                              </div>
                            )}
                          </div>
                        </>
                      );
                      return hasForgeUpgrade ? (
                        <div className="forge-lava-border forge-lava-glow overflow-visible">
                          <div className="text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2 forge-lava-shine">
                            {weaponContent}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
                          {weaponContent}
                        </div>
                      );
                    })() : (
                      <div className="text-xs text-stone-500 border border-stone-600 bg-stone-900/60 p-2">
                        Aucune arme équipée
                      </div>
                    )}
                    {(() => {
                      const fused = fusedPassiveDisplay;
                      if (fused) {
                        return (
                          <div className="extension-territory-border extension-territory-glow overflow-visible">
                            <div className="flex items-start gap-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2 extension-territory-shine">
                              <span className="text-lg">{fused.primaryDetails.icon}</span>
                              <div className="flex-1">
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
                                  <div className="font-semibold extension-territory-text cursor-help">
                                    {fused.displayLabel}
                                  </div>
                                </SharedTooltip>
                                <div className="text-stone-400 text-[11px] mt-1 space-y-1">
                                  <div><span className="text-amber-300/90">Niv.{fused.primaryDetails.level} —</span> {fused.primaryDetails.levelData.description}</div>
                                  <div><span className="text-violet-300/90">Niv.{fused.extensionDetails.level} (Extension) —</span> {fused.extensionDetails.levelData.description}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (passiveDetails) {
                        return (
                          <div className="flex items-start gap-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
                            <span className="text-lg">{passiveDetails.icon}</span>
                            <div className="flex-1">
                              <div className="font-semibold text-amber-200">
                                {passiveDetails.name} — Niveau {passiveDetails.level}
                              </div>
                              <div className="text-stone-400 text-[11px]">
                                {passiveDetails.levelData.description}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="text-xs text-stone-500 border border-stone-600 bg-stone-900/60 p-2">
                          Aucun passif de Tour du Mage équipé
                        </div>
                      );
                    })()}
                    {isAwakeningActive && (
                      <div className="flex items-start gap-2 text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
                        <span className="text-lg">✨</span>
                        <div className="flex-1">
                          <div className="font-semibold text-amber-200">
                            Éveil racial actif (Niv {awakeningInfo.levelRequired}+)
                          </div>
                          <div className="text-stone-400 text-[11px]">
                            {awakeningInfo.description}
                          </div>
                        </div>
                      </div>
                    )}
                    {!isAwakeningActive && (
                      <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                        <span className="text-lg">{races[existingCharacter.race].icon}</span>
                        <span className="text-stone-300">{getRaceBonusText(existingCharacter.race)}</span>
                      </div>
                    )}
                    {existingCharacter.subclass ? (
                      <SubclassDetailBlock
                        subclass={existingCharacter.subclass}
                        classIcon={classes[existingCharacter.class].icon}
                        stats={{
                          cap: finalStats.cap ?? 0,
                          auto: finalStats.auto ?? 0,
                          def: finalStats.def ?? 0,
                          rescap: finalStats.rescap ?? 0,
                        }}
                      />
                    ) : (
                      <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                        <span className="text-lg">{classes[existingCharacter.class].icon}</span>
                        <div className="flex-1">
                          <div className="font-semibold text-amber-200">{classes[existingCharacter.class].ability}</div>
                          <div className="text-stone-400 text-[11px]">
                            {getCalculatedDescription(
                              existingCharacter.class,
                              finalStats.cap ?? 0,
                              finalStats.auto ?? 0,
                              finalStats.def ?? 0,
                              finalStats.rescap ?? 0
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Character Card (image + name) */}
            <div className="order-1 lg:order-2 relative flex-shrink-0 mx-auto lg:mx-0" style={{ width: '340px' }}>
              <div className="shadow-2xl">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-amber-200 px-5 py-1 text-xs font-bold shadow-lg z-10 border border-stone-600 text-center whitespace-nowrap">
                  {existingCharacter.race} • {existingCharacter.class} • Niveau {existingCharacter.level ?? 1}
                </div>
                <div className={`relative overflow-hidden bg-stone-900 rounded-lg ${
                  (() => {
                    const bid = resolveBorderId(existingCharacter.equippedBorder);
                    return bid !== 'default' ? (getBorderGlowClass(bid) || '') : 'border border-stone-600';
                  })()
                }`}>
                  <InteractiveCharacterCard>
                    <div
                      className="relative bg-stone-900 flex items-center justify-center min-h-[280px]"
                      style={(() => {
                        const bid = resolveBorderId(existingCharacter.equippedBorder);
                        return bid === 'ancient' ? { filter: 'grayscale(1) contrast(1.42) brightness(0.96) saturate(0.15)' } : undefined;
                      })()}
                    >
                      {existingCharacter.characterImage ? (
                        <img
                          src={existingCharacter.characterImage}
                          alt={existingCharacter.name}
                          className="w-full h-auto object-contain"
                        />
                      ) : (
                        <div className="h-96 w-full flex items-center justify-center">
                          <div className="text-9xl opacity-20">{races[existingCharacter.race].icon}</div>
                        </div>
                      )}
                      {(() => {
                        const src = getRealBorderImageSrc(existingCharacter.equippedRealBorder);
                        if (!src) return null;
                        return (
                          <img
                            src={src}
                            alt=""
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                            style={{ zIndex: 2 }}
                          />
                        );
                      })()}
                      {(() => {
                        const bid = resolveBorderId(existingCharacter.equippedBorder);
                        return bid !== 'default' ? <CardBorderCanvas borderId={bid} imageSrc={existingCharacter.characterImage || null} /> : null;
                      })()}
                      <div
                        className={`absolute ${existingCharacter.equippedTitle ? 'bottom-2' : 'bottom-5'} left-2 right-2 py-1 text-center`}
                        style={{ color: 'rgb(254 243 199)', textShadow: '0 0 2px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000', zIndex: 4 }}
                      >
                        <div className="character-card-name font-bold text-lg leading-tight">{existingCharacter.name}</div>
                        {existingCharacter.equippedTitle && (
                          <div className="character-card-name text-sm leading-tight mt-0.5">
                            {getDisplayTitle(existingCharacter.equippedTitle, existingCharacter.gender)}
                          </div>
                        )}
                      </div>
                    </div>
                  </InteractiveCharacterCard>
                </div>
              </div>
            </div>

            {/* Recap Panel */}
            {recapData && (
              <div className="order-3 w-full lg:w-[240px] lg:flex-shrink-0">
                <RecapPanel data={recapData} />
              </div>
            )}
          </div>

          {/* Titres et Bordures */}
          {existingCharacter && (
            <div className="max-w-[1400px] mx-auto mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
              {/* Section Titres */}
              <CollapsiblePanel
                title="🏅 Titres"
                isOpen={isTitlesOpen}
                onToggle={() => setIsTitlesOpen(v => !v)}
              >
                {(existingCharacter.earnedTitles?.length > 0) ? (
                  <div className="space-y-1.5">
                    {existingCharacter.equippedTitle && (
                      <button
                        onClick={async () => {
                          await equipTitle(currentUser.uid, null);
                          setExistingCharacter(prev => ({ ...prev, equippedTitle: null }));
                        }}
                        className="w-full text-left text-xs bg-stone-800 border border-red-700/50 rounded px-3 py-2 text-red-300 hover:bg-red-900/30 transition-colors"
                      >
                        ✕ Retirer le titre
                      </button>
                    )}
                    {existingCharacter.earnedTitles.map(tid => {
                      const t = TITLES[tid];
                      if (!t) return null;
                      const isEquipped = existingCharacter.equippedTitle === tid;
                      return (
                        <button
                          key={tid}
                          onClick={async () => {
                            if (isEquipped) return;
                            await equipTitle(currentUser.uid, tid);
                            setExistingCharacter(prev => ({ ...prev, equippedTitle: tid }));
                          }}
                          className={`w-full text-left text-xs rounded px-3 py-2 transition-colors ${
                            isEquipped
                              ? 'bg-amber-900/40 border border-amber-500 text-amber-200'
                              : 'bg-stone-800 border border-stone-600 text-stone-300 hover:border-amber-600'
                          }`}
                        >
                          <span className="mr-1.5">{t.icon}</span>
                          <span className="font-semibold">{getFormattedTitle(tid, existingCharacter.gender)}</span>
                          {isEquipped && <span className="ml-2 text-amber-400 text-[10px]">ÉQUIPÉ</span>}
                          <div className="text-[10px] text-stone-500 mt-0.5 ml-5 flex items-center gap-1.5">
                            <span>{t.description}</span>
                            {obtentionStats && obtentionStats.total > 0 && (
                              <span className="text-amber-600/80 whitespace-nowrap">
                                — {(() => {
                                  const pct = Math.round(((obtentionStats.titleCounts[tid] || 0) / obtentionStats.total) * 100);
                                  return pct === 0 && (obtentionStats.titleCounts[tid] || 0) > 0 ? '< 1%' : `${pct}%`;
                                })()}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500">Aucun titre obtenu. Combattez pour en débloquer !</p>
                )}
              </CollapsiblePanel>

              {/* Section Effets + Bordures (même colonne) */}
              <div className="space-y-4">
                <CollapsiblePanel
                  title="✨ Effets"
                  isOpen={isEffectsOpen}
                  onToggle={() => setIsEffectsOpen(v => !v)}
                >
                  {[
                    { label: 'Personnage', desc: 'Liées à la progression du personnage', filter: b => b.type !== 'account' },
                    { label: 'Compte', desc: 'Conservées de semaine en semaine', filter: b => b.type === 'account' },
                  ].map(section => {
                    const borders = Object.values(BORDERS).filter(section.filter);
                    if (!borders.length) return null;
                    return (
                      <div key={section.label} className="mb-3 last:mb-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">{section.label}</span>
                          <span className="text-[9px] text-stone-600 italic">{section.desc}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {borders.map(border => {
                            const unlocked = existingCharacter.unlockedBorders?.includes(border.id) || border.id === 'default';
                            const currentBorderId = resolveBorderId(existingCharacter.equippedBorder);
                            const isEquipped = currentBorderId === border.id;
                            return (
                              <SharedTooltip key={border.id} content={
                                <span>
                                  {formatBorderCondition(border)}
                                  {obtentionStats && obtentionStats.total > 0 && border.id !== 'default' && (
                                    <span className="text-amber-500/80">
                                      {' — '}{(() => {
                                        const pct = Math.round(((obtentionStats.borderCounts[border.id] || 0) / obtentionStats.total) * 100);
                                        return pct === 0 && (obtentionStats.borderCounts[border.id] || 0) > 0 ? '< 1%' : `${pct}%`;
                                      })()}{' des joueurs'}
                                    </span>
                                  )}
                                </span>
                              }>
                                <button
                                  disabled={!unlocked}
                                  onClick={async () => {
                                    if (!unlocked) return;
                                    const id = border.id === 'default' ? null : border.id;
                                    await equipBorder(currentUser.uid, id);
                                    setExistingCharacter(prev => ({ ...prev, equippedBorder: id }));
                                  }}
                                  className={`relative text-center rounded-lg p-2 text-[10px] transition-colors overflow-hidden ${
                                    !unlocked
                                      ? 'bg-stone-900 border border-stone-700 text-stone-600 cursor-not-allowed opacity-50'
                                      : isEquipped
                                        ? 'bg-amber-900/40 border-2 border-amber-500 text-amber-200'
                                        : 'bg-stone-800 border border-stone-600 text-stone-300 hover:border-amber-600 cursor-pointer'
                                  }`}
                                >
                                  {unlocked && border.id !== 'default' && (
                                    <CardBorderCanvas borderId={border.id} imageSrc={existingCharacter.characterImage || null} />
                                  )}
                                  <div className="relative z-10">
                                    <div className="text-lg mb-1">{border.icon}</div>
                                    <div className="font-semibold">{border.nom}</div>
                                    {!unlocked && <div className="text-[9px] text-stone-600 mt-0.5">{formatBorderCondition(border)}</div>}
                                    {isEquipped && unlocked && <div className="text-amber-400 text-[9px]">ACTIF</div>}
                                  </div>
                                </button>
                              </SharedTooltip>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CollapsiblePanel>

                <CollapsiblePanel
                  title="🧷 Bordures"
                  subtitle={
                    <span>
                      Bordure visuelle autour de ta carte (sans re-upload d&apos;image). Les fichiers{' '}
                      <strong className="text-stone-400">*Old</strong> et <strong className="text-stone-400">BG</strong> sont ignorés.
                    </span>
                  }
                  isOpen={isBordersOpen}
                  onToggle={() => setIsBordersOpen(v => !v)}
                >
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await updateCharacterEquippedRealBorder(currentUser.uid, null);
                        setExistingCharacter(prev => (prev ? { ...prev, equippedRealBorder: null } : prev));
                      }}
                      className={`rounded-lg p-2 text-[10px] transition-colors border ${
                        !existingCharacter.equippedRealBorder
                          ? 'bg-amber-900/40 border-amber-500 text-amber-200'
                          : 'bg-stone-800 border-stone-600 text-stone-300 hover:border-amber-600'
                      }`}
                      title="Aucune bordure"
                    >
                      <div className="text-lg mb-1">✕</div>
                      <div className="font-semibold">Aucune</div>
                    </button>

                    {getRealBorderCandidates().map(({ key, base, file }) => {
                      const src = realBorderPngModules[key];
                      const isEquipped = (existingCharacter.equippedRealBorder || '').toLowerCase() === base.toLowerCase()
                        || (existingCharacter.equippedRealBorder || '').toLowerCase() === file.toLowerCase();

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={async () => {
                            await updateCharacterEquippedRealBorder(currentUser.uid, base);
                            setExistingCharacter(prev => (prev ? { ...prev, equippedRealBorder: base } : prev));
                          }}
                          className={`relative overflow-hidden rounded-lg p-2 text-[10px] transition-colors border ${
                            isEquipped
                              ? 'bg-amber-900/40 border-amber-500 text-amber-200'
                              : 'bg-stone-800 border-stone-600 text-stone-300 hover:border-amber-600'
                          }`}
                          title={base}
                        >
                          <div className="w-full aspect-[2/3] bg-stone-900/60 border border-stone-700 rounded mb-1 relative overflow-hidden">
                            <img src={src} alt={base} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                          </div>
                          <div className="font-semibold truncate">{base}</div>
                          {isEquipped && <div className="text-amber-400 text-[9px]">ACTIF</div>}
                        </button>
                      );
                    })}
                  </div>
                </CollapsiblePanel>
              </div>
            </div>
          )}
        </div>
      {renderDungeonGrantPopup()}
      </div>
    );
  }

  // Message si l'utilisateur ne peut pas créer de personnage (< 7 jours)
  if (!canCreate) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Header />

        {renderIntroMusic()}
        <div className="max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">⏳</div>
          <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block mb-4">
            <h2 className="text-4xl font-bold text-amber-400">Patience, Guerrier...</h2>
          </div>
          <div className="bg-stone-800/90 rounded-2xl p-8 border-2 border-amber-600">
            <p className="text-xl text-gray-300 mb-4">
              Vous avez déjà créé un personnage cette semaine.
            </p>
            <p className="text-lg text-amber-300">
              Prochain reset: <span className="font-bold text-2xl">Lundi prochain</span>
            </p>
            <p className="text-sm text-gray-400 mt-2">
              (dans {daysRemaining} jour{daysRemaining > 1 ? 's' : ''})
            </p>
          </div>
        </div>
        <div className="max-w-4xl w-full">{renderGameEncyclopedia()}</div>
      {renderDungeonGrantPopup()}
      </div>
    );
  }

  // Formulaire de création - Étape 1: Roll Race/Classe
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Header />

        {renderIntroMusic()}
        <div className="max-w-4xl w-full pt-24 sm:pt-20">
          <div className="text-center mb-8">
            <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block">
              <h2 className="text-5xl font-bold mb-3 text-amber-400">🎲 Étape 1: Roll ton Personnage</h2>
              <p className="text-amber-300 text-lg">Lance les dés et découvre ta race et ta classe!</p>
              {(lastWeekRestrictions.race || lastWeekRestrictions.class) && (
                <p className="text-sm text-red-300 mt-3">
                  Restriction hebdo: impossible de reroll <strong>{lastWeekRestrictions.race || '—'}</strong> et <strong>{lastWeekRestrictions.class || '—'}</strong> (semaine précédente).
                </p>
              )}
            </div>
          </div>

          {!rolledCharacter && allRolls.length === 0 ? (
            /* Avant le roll: gros bouton central */
            <div className="max-w-2xl mx-auto">
              <div className="bg-stone-800/90 rounded-2xl p-12 border-4 border-amber-600 shadow-2xl text-center">
                <div className="text-8xl mb-8">🎲</div>
                {hasTripleRoll && (
                  <div className="bg-yellow-900/50 border-2 border-yellow-500 rounded-xl p-4 mb-6">
                    <p className="text-yellow-300 font-bold text-lg">👑 Récompense Champion!</p>
                    <p className="text-yellow-200 text-sm">Tu as gagné le droit de choisir parmi {rollsRemaining >= 6 ? 6 : 3} rolls!</p>
                  </div>
                )}
                <button
                  onClick={rollCharacter}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 px-8 py-6 rounded-lg font-bold text-2xl shadow-lg border-2 border-amber-400 transition-all transform hover:scale-105"
                >
                  {hasTripleRoll ? `👑 ROLL x${rollsRemaining >= 6 ? 6 : 3} MON PERSONNAGE 👑` : '🎲 ROLL MON PERSONNAGE 🎲'}
                </button>
                <p className="text-gray-400 mt-4 text-sm">Race et classe seront générées aléatoirement</p>
              </div>

              {/* Info races et classes */}
              <div className="mt-8 grid md:grid-cols-2 gap-6">
                <div className="bg-stone-800/50 rounded-xl p-6 border-2 border-amber-600">
                  <h3 className="text-2xl font-bold text-amber-400 mb-4 text-center">🎭 11 Races</h3>
                  <div className="space-y-2">
                    {Object.entries(races).map(([name, info]) => (
                      <div key={name} className="bg-stone-900/50 rounded-lg p-3 border border-stone-700">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{info.icon}</span>
                          <span className="text-white font-bold">{name}</span>
                        </div>
                        <p className="text-xs text-gray-400 ml-8">{getRaceBonusText(name)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-stone-800/50 rounded-xl p-6 border-2 border-amber-600">
                  <h3 className="text-2xl font-bold text-amber-400 mb-4 text-center">⚔️ 11 Classes</h3>
                  <div className="space-y-2">
                    {Object.entries(classes).map(([name, info]) => (
                      <div key={name} className="bg-stone-900/50 rounded-lg p-3 border border-stone-700">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{info.icon}</span>
                          <span className="text-white font-bold">{name}</span>
                        </div>
                        <p className="text-xs text-gray-400 ml-8">{info.ability}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : allRolls.length > 0 ? (
            /* Triple roll: choisir parmi 3 ou 6 personnages */
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-6">
                <p className="text-yellow-300 font-bold text-xl">👑 Choisis ton personnage parmi les {allRolls.length} rolls!</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {allRolls.map((roll, idx) => (
                  <div key={idx} className="bg-stone-800/90 rounded-2xl p-5 border-4 border-yellow-600 shadow-2xl hover:border-yellow-400 transition-all cursor-pointer" onClick={() => selectTripleRollChoice(roll)}>
                    <div className="text-center mb-4">
                      <h3 className="text-xl font-bold text-amber-400">
                        {races[roll.race].icon} {roll.race} • {classes[roll.class].icon} {roll.class}
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {['hp','auto','def','cap','rescap','spd'].map(stat => (
                        <div key={stat} className="bg-stone-900/50 rounded p-2 border border-stone-700 text-center">
                          <div className="text-gray-400 text-xs">{STAT_LABELS[stat]}</div>
                          <div className="text-white font-bold text-lg">{roll.base[stat]}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-stone-400 mb-1">{getRaceBonusText(roll.race)}</div>
                      <div className="text-sm text-amber-300">{classes[roll.class].ability}</div>
                    </div>
                    <button className="w-full mt-4 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-stone-900 px-4 py-3 rounded-lg font-bold text-lg shadow-lg border-2 border-yellow-400 transition-all">
                      Choisir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Après le roll: afficher le personnage */
            <div className="max-w-3xl mx-auto">
              <div className="bg-stone-800/90 rounded-2xl p-6 border-4 border-amber-600 shadow-2xl">
                <div className="text-center mb-6">
                  <h3 className="text-3xl font-bold text-amber-400 mb-2">
                    {rolledCharacter.race} • {rolledCharacter.class}
                  </h3>
                  <p className="text-gray-300">Voici ton personnage généré aléatoirement!</p>
                </div>

                {/* Stats */}
                <div className="bg-stone-900/50 rounded-xl p-6 border-2 border-amber-500 mb-6">
                  <h4 className="text-xl font-bold text-amber-300 mb-4">📊 Statistiques</h4>
                  {(() => {
                    const raceB = rolledCharacter.bonuses.race;
                    const classB = rolledCharacter.bonuses.class;
                    const totalBonus = (k) => (raceB[k] || 0) + (classB[k] || 0);
                    const baseWithoutBonus = (k) => rolledCharacter.base[k] - totalBonus(k);
                    const tooltipContent = (k) => {
                      const parts = [`Base: ${baseWithoutBonus(k)}`];
                      if (raceB[k] > 0) parts.push(`Race: +${raceB[k]}`);
                      if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
                      return parts.join(' | ');
                    };
                    const StatDisplay = ({ statKey, label }) => {
                      const hasBonus = totalBonus(statKey) > 0;
                      return (
                        <div className="bg-stone-800 rounded p-3 border border-stone-700">
                          <div className="text-gray-400 text-sm">{label}</div>
                          {hasBonus ? (
                            <Tooltip content={tooltipContent(statKey)}>
                              <div className="text-green-400 font-bold text-2xl">{rolledCharacter.base[statKey]}</div>
                            </Tooltip>
                          ) : (
                            <div className="text-white font-bold text-2xl">{rolledCharacter.base[statKey]}</div>
                          )}
                        </div>
                      );
                    };
                    return (
                      <div className="grid grid-cols-2 gap-4">
                        <StatDisplay statKey="hp" label="HP (Points de Vie)" />
                        <StatDisplay statKey="spd" label="VIT (Vitesse)" />
                        <StatDisplay statKey="auto" label="Auto (Attaque)" />
                        <StatDisplay statKey="def" label="Déf (Défense)" />
                        <StatDisplay statKey="cap" label="Cap (Capacité)" />
                        <StatDisplay statKey="rescap" label="ResC (Résistance Cap.)" />
                      </div>
                    );
                  })()}
                </div>

                {/* Bonus Race */}
                <div className="bg-stone-900/50 rounded-xl p-4 border-2 border-blue-500 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{races[rolledCharacter.race].icon}</span>
                    <span className="text-blue-300 font-bold text-lg">Race: {rolledCharacter.race}</span>
                  </div>
                  <p className="text-gray-300 text-sm">{getRaceBonusText(rolledCharacter.race)}</p>
                </div>

                {/* Bonus Classe */}
                <div className="bg-stone-900/50 rounded-xl p-4 border-2 border-purple-500 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{classes[rolledCharacter.class].icon}</span>
                    <span className="text-purple-300 font-bold text-lg">Classe: {rolledCharacter.class}</span>
                  </div>
                  <div className="text-sm mb-1 text-amber-300">{classes[rolledCharacter.class].ability}</div>
                  <div className="text-gray-300 text-xs">{getCalculatedDescription(rolledCharacter.class, rolledCharacter.base.cap, rolledCharacter.base.auto, rolledCharacter.base.def, rolledCharacter.base.rescap)}</div>
                </div>

                {/* Bouton */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 px-6 py-4 rounded-lg font-bold text-lg shadow-lg border-2 border-amber-400 transition-all"
                  >
                    ✅ Continuer
                  </button>
                </div>
              </div>
            </div>
          )}
          {renderGameEncyclopedia()}
        </div>
      {renderDungeonGrantPopup()}
      </div>
    );
  }

  // Formulaire de création - Étape 2: Nom/Sexe/Mot-clé
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Header />

        {renderIntroMusic()}
      {PseudoModal}
      <div className="max-w-4xl w-full pt-24 sm:pt-20">
        <div className="text-center mb-8">
          <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block">
            <h2 className="text-5xl font-bold mb-3 text-amber-400">📝 Étape 2: Personnalise ton Héros</h2>
            <p className="text-amber-300 text-lg">Donne-lui un nom et forge son identité...</p>
          </div>
        </div>

        {/* Résumé du personnage rollé */}
        <div className="max-w-2xl mx-auto mb-6">
          <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-xl p-6 border-2 border-amber-500 shadow-lg">
            <div className="text-center mb-4">
              <h3 className="text-2xl font-bold text-amber-300">
                {races[rolledCharacter.race].icon} {rolledCharacter.race} • {classes[rolledCharacter.class].icon} {rolledCharacter.class}
              </h3>
            </div>
            <div className="grid grid-cols-6 gap-2 text-center text-sm">
              <div className="bg-stone-900/50 rounded p-2 border border-stone-700">
                <div className="text-gray-400 text-xs">HP</div>
                <div className="text-white font-bold">{rolledCharacter.base.hp}</div>
              </div>
              <div className="bg-stone-900/50 rounded p-2 border border-stone-700">
                <div className="text-gray-400 text-xs">Auto</div>
                <div className="text-white font-bold">{rolledCharacter.base.auto}</div>
              </div>
              <div className="bg-stone-900/50 rounded p-2 border border-stone-700">
                <div className="text-gray-400 text-xs">Déf</div>
                <div className="text-white font-bold">{rolledCharacter.base.def}</div>
              </div>
              <div className="bg-stone-900/50 rounded p-2 border border-stone-700">
                <div className="text-gray-400 text-xs">Cap</div>
                <div className="text-white font-bold">{rolledCharacter.base.cap}</div>
              </div>
              <div className="bg-stone-900/50 rounded p-2 border border-stone-700">
                <div className="text-gray-400 text-xs">ResC</div>
                <div className="text-white font-bold">{rolledCharacter.base.rescap}</div>
              </div>
              <div className="bg-stone-900/50 rounded p-2 border border-stone-700">
                <div className="text-gray-400 text-xs">VIT</div>
                <div className="text-white font-bold">{rolledCharacter.base.spd}</div>
              </div>
            </div>
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => setStep(1)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all border border-gray-600"
              >
                ← Retour au roll
              </button>
            </div>
          </div>
        </div>

        <div className="bg-stone-800/90 rounded-2xl p-8 border-4 border-amber-600 shadow-2xl max-w-2xl mx-auto">
          {/* Nom */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-amber-400 font-bold mb-3 text-lg">
              👤 Nom du personnage
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Ex: Thorgar, Aria..."
              className={`w-full bg-stone-900 border-2 ${errors.name ? 'border-red-500' : 'border-amber-600'} rounded-lg px-4 py-4 text-white text-lg focus:outline-none focus:border-amber-400`}
              maxLength={40}
            />
            {errors.name && <p className="text-red-400 text-sm mt-2">⚠️ {errors.name}</p>}
            <p className="text-gray-500 text-xs mt-2">{formData.name.length}/40 caractères</p>
          </div>

          {/* Sexe */}
          <div className="mb-6">
            <label className="text-amber-400 font-bold mb-3 text-lg block">Sexe</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleInputChange('gender', 'male')}
                className={`py-5 px-6 rounded-lg font-bold text-lg transition-all border-2 ${
                  formData.gender === 'male'
                    ? 'bg-amber-600 border-amber-400 text-white shadow-lg scale-105'
                    : 'bg-stone-900 border-stone-700 text-gray-400 hover:border-amber-600'
                }`}
              >
                <span className="text-3xl mb-2 block">👨</span>
                Homme
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('gender', 'female')}
                className={`py-5 px-6 rounded-lg font-bold text-lg transition-all border-2 ${
                  formData.gender === 'female'
                    ? 'bg-pink-600 border-pink-400 text-white shadow-lg scale-105'
                    : 'bg-stone-900 border-stone-700 text-gray-400 hover:border-pink-600'
                }`}
              >
                <span className="text-3xl mb-2 block">👩</span>
                Femme
              </button>
            </div>
            {errors.gender && <p className="text-red-400 text-sm mt-2">⚠️ {errors.gender}</p>}
          </div>

          {/* Mot-clé */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-amber-400 font-bold mb-3 text-lg">
              #️⃣ Mot-clé (Midjourney)
            </label>
            <input
              type="text"
              value={formData.keyword}
              onChange={(e) => handleInputChange('keyword', e.target.value)}
              placeholder="Ex: dragon, ombre, feu..."
              className={`w-full bg-stone-900 border-2 ${errors.keyword ? 'border-red-500' : 'border-amber-600'} rounded-lg px-4 py-4 text-white text-lg focus:outline-none focus:border-amber-400`}
              maxLength={100}
            />
            {errors.keyword && <p className="text-red-400 text-sm mt-2">⚠️ {errors.keyword}</p>}
            <p className="text-gray-500 text-xs mt-2">{formData.keyword.length}/100 caractères</p>
          </div>

          {errors.submit && (
            <div className="mb-6 bg-red-900/50 border-2 border-red-500 rounded-lg p-4">
              <p className="text-red-300 text-center font-bold">{errors.submit}</p>
            </div>
          )}

          {/* Bouton soumettre */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 disabled:from-gray-600 disabled:to-gray-700 text-stone-900 px-6 py-4 rounded-lg font-bold text-xl shadow-lg border-2 border-amber-400 flex items-center justify-center gap-2 transition-all"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-stone-900" />
                Création...
              </>
            ) : (
              <>✨ Créer mon Personnage ✨</>
            )}
          </button>
        </div>
        {renderGameEncyclopedia()}
      </div>
      {renderDungeonGrantPopup()}
    </div>
  );
};

export default CharacterCreation;
