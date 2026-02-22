import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveCharacter, getUserCharacter, canCreateCharacter, updateCharacterLevel, savePendingRoll, getPendingRoll, deletePendingRoll, updateCharacterOwnerPseudo, getDisabledCharacters } from '../services/characterService';
import { resetDungeonRuns, getLatestDungeonRunsGrant } from '../services/dungeonService';
import { resetUserLabyrinthProgress } from '../services/infiniteLabyrinthService';
import { checkTripleRoll, consumeTripleRoll, getTripleRollCount } from '../services/tournamentService';
import { shouldLockPveModes } from '../services/gameAvailabilityService';
import Header from './Header';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { applyStatBoosts, getEmptyStatBoosts, getStatPointValue } from '../utils/statPoints';
import { getWeaponById, getWeaponFamilyInfo, getWeaponsByFamily, RARITY_COLORS } from '../data/weapons';
import { classConstants, raceConstants, getRaceBonus, getClassBonus, weaponConstants } from '../data/combatMechanics';
import { getMageTowerPassiveById, getMageTowerPassiveLevel, MAGE_TOWER_PASSIVES } from '../data/mageTowerPassives';
import { getRaceBonusText, getClassDescriptionText, buildRaceAwakeningDescription } from '../utils/descriptionBuilders';
import { applyPassiveWeaponStats } from '../utils/weaponEffects';
import { applyAwakeningToBase, getAwakeningEffect, removeBaseRaceFlatBonusesIfAwakened } from '../utils/awakening';
import { isForgeActive } from '../data/featureFlags';
import { getWeaponUpgrade } from '../services/forgeService';
import { formatUpgradePct } from '../data/forgeDungeon';

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

const STAT_DESCRIPTIONS = {
  hp: "Points de vie max. Quand tu tombes à 0, le combat est perdu.",
  auto: "Puissance des attaques de base (et certaines compétences qui scalent dessus).",
  def: "Réduit les dégâts physiques reçus.",
  cap: "Puissance des sorts/compétences CAP et scaling de plusieurs effets.",
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
      {weapon.effet && typeof weapon.effet === 'object' && (
        <span className="block text-amber-200">
          Effet: {weapon.effet.nom} — {buildLiveBalanceDescription(weapon.effet.values, weapon.effet.description)}
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

const prettifyBalanceKey = (key) => key
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
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [lastWeekRestrictions, setLastWeekRestrictions] = useState({ race: null, class: null });
  const [isDowntimeLocked, setIsDowntimeLocked] = useState(false);
  const [isSoundOpen, setIsSoundOpen] = useState(false);
  const [volume, setVolume] = useState(0.05);
  const [isMuted, setIsMuted] = useState(false);

  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const weaponFamilies = getWeaponFamilyInfo();

  const applyIntroVolume = () => {
    const introMusic = document.getElementById('intro-music');
    if (!introMusic) return;
    introMusic.volume = volume;
    introMusic.muted = isMuted;
  };

  useEffect(() => {
    applyIntroVolume();
  }, [volume, isMuted]);

  useEffect(() => {
    const introMusic = document.getElementById('intro-music');
    if (!introMusic) return undefined;

    introMusic.volume = volume;
    introMusic.muted = isMuted;
    introMusic.play().catch(() => {});

    return () => {
      introMusic.pause();
    };
  }, []);

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

  const renderSoundControl = () => (
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
              className="w-full accent-amber-500"
            />
            <span className="text-xs text-stone-200 w-10 text-right">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderIntroMusic = () => (
    <audio id="intro-music" loop>
      <source src="/assets/music/intro.mp3" type="audio/mpeg" />
    </audio>
  );

  const renderGameEncyclopedia = () => (
    <div className="mt-10">
      <button
        type="button"
        onClick={() => setShowEncyclopedia(prev => !prev)}
        className="w-full bg-stone-900/80 border-2 border-amber-600 px-5 py-4 text-amber-300 font-bold text-lg hover:border-amber-400 transition"
      >
        {showEncyclopedia ? '▼' : '▶'} 📚 Encyclopédie du jeu
      </button>

      {showEncyclopedia && (
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
                          <div className="text-[11px] text-stone-300 mb-1">{Object.entries(weapon.stats).map(([k, v]) => `${STAT_LABELS[k] || k.toUpperCase()} ${v > 0 ? `+${v}` : v}`).join(' • ')}</div>
                          {weapon.effet && typeof weapon.effet === 'object' && (
                            <div className="text-[11px] text-amber-200">{weapon.effet.nom}: {buildLiveBalanceDescription(weapon.effet.values, weapon.effet.description)}</div>
                          )}
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
                        <span className="text-stone-300">{buildLiveBalanceDescription(lvlData, lvlData.description)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

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
        const magicDmgTotal = Math.round(magicPct * cap);
        return (
          <>
            Dégâts = Auto +{' '}
            <Tooltip content={`Auto (${auto}) + ${(magicPct * 100).toFixed(1)}% × Cap (${cap})`}>
              <span className="text-green-400">{auto + magicDmgTotal}</span>
            </Tooltip>
            {' '}dégâts magiques (vs ResC)
          </>
        );
      }

      case 'Demoniste': {
        const { capBase, capPerCap, ignoreResist, stackPerAuto } = classConstants.demoniste;
        const familierPct = capBase + capPerCap * cap;
        const familierDmgTotal = Math.round(familierPct * cap);
        const ignoreResPct = Math.round(ignoreResist * 100);
        const stackBonusPct = Math.round(stackPerAuto * 100);
        return (
          <>
            Chaque tour:{' '}
            <Tooltip content={`${(familierPct * 100).toFixed(1)}% de Cap (${cap}) | +${stackBonusPct}% Cap par auto (cumulable) | Ignore ${ignoreResPct}% ResC`}>
              <span className="text-green-400">{familierDmgTotal}</span>
            </Tooltip>
            {' '}dégâts (ignore {ignoreResPct}% ResC)
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
        return getClassDescriptionText(className);
    }
  };


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
        setExistingCharacter({
          ...normalized,
          level,
          forgeUpgrade: forgeUpgradeData,
        });
        const storedPseudo = localStorage.getItem(`ownerPseudo:${currentUser.uid}`) || '';
        const pseudoValue = normalized.ownerPseudo || storedPseudo;
        setOwnerPseudo(pseudoValue);
        setShowPseudoModal(!normalized.ownerPseudo);
        const weaponId = normalized.equippedWeaponId || null;
        const weaponData = weaponId ? getWeaponById(weaponId) : null;
        setEquippedWeapon(weaponData);
        setCanCreate(false);
      } else {
        // Vérifier si l'utilisateur peut créer un personnage
        const canCreateResult = await canCreateCharacter(currentUser.uid);
        setCanCreate(canCreateResult.canCreate);
        const storedPseudo = localStorage.getItem(`ownerPseudo:${currentUser.uid}`) || '';
        setOwnerPseudo(storedPseudo);
        setShowPseudoModal(!storedPseudo);
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
      // Triple roll: générer 3 personnages d'un coup
      const rolls = [];
      for (let i = 0; i < 3; i++) {
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
      // Sauvegarder les 3 rolls en Firestore
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
    if (!formData.name.trim() || formData.name.trim().length < 3) newErrors.name = 'Nom requis (3-20 car.)';
    if (!formData.gender) newErrors.gender = 'Sélectionnez un sexe';
    if (!formData.keyword.trim() || formData.keyword.trim().length < 3) newErrors.keyword = 'Mot-clé requis (3-50 car.)';
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
        if (pseudoStorageKey) localStorage.setItem(pseudoStorageKey, normalizePseudo(ownerPseudo));
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
        {renderSoundControl()}
        {renderIntroMusic()}
        {PseudoModal}
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  // Afficher le personnage existant
  if (existingCharacter) {
    const raceB = getRaceBonus(existingCharacter.race);
    const classB = getClassBonus(existingCharacter.class);
    const totalBonus = (k) => (raceB[k] || 0) + (classB[k] || 0);
    const forestBoosts = { ...getEmptyStatBoosts(), ...(existingCharacter.forestBoosts || {}) };
    const baseStatsRaw = applyStatBoosts(existingCharacter.base, forestBoosts);
    const baseStats = removeBaseRaceFlatBonusesIfAwakened(baseStatsRaw, existingCharacter.race, existingCharacter.level ?? 1);
    const weapon = equippedWeapon;
    const mageTowerPassive = existingCharacter.mageTowerPassive || null;
    const passiveBase = mageTowerPassive ? getMageTowerPassiveById(mageTowerPassive.id) : null;
    const passiveLevel = mageTowerPassive ? getMageTowerPassiveLevel(mageTowerPassive.id, mageTowerPassive.level) : null;
    const passiveDetails = passiveBase && passiveLevel ? { ...passiveBase, level: mageTowerPassive.level, levelData: passiveLevel } : null;
    const awakeningInfo = races[existingCharacter.race]?.awakening || null;
    const isAwakeningActive = awakeningInfo && (existingCharacter.level ?? 1) >= awakeningInfo.levelRequired;
    const forgeUpgrade = existingCharacter.forgeUpgrade;
    const extractForgeUpgrade = (roll) => {
      if (!roll) return { bonuses: {}, penalties: {} };
      if (roll.statBonusesPct || roll.statPenaltyPct) {
        return {
          bonuses: { ...(roll.statBonusesPct || {}) },
          penalties: { ...(roll.statPenaltyPct || {}) }
        };
      }
      const bonuses = {};
      const penalties = {};
      if (roll.upgradeAutoPct) bonuses.auto = roll.upgradeAutoPct;
      if (roll.upgradeVitPct) bonuses.spd = roll.upgradeVitPct;
      if (roll.upgradeVitPenaltyPct) penalties.spd = roll.upgradeVitPenaltyPct;
      return { bonuses, penalties };
    };
    const hasAnyForgeUpgrade = (roll) => {
      const { bonuses, penalties } = extractForgeUpgrade(roll);
      return Object.values(bonuses).some(v => v > 0) || Object.values(penalties).some(v => v > 0);
    };
    const forgeLabel = (statKey) => ({ auto: 'ATK', spd: 'VIT', cap: 'CAP', hp: 'HP', def: 'DEF', rescap: 'RESC' }[statKey] || statKey.toUpperCase());
    const hasForgeUpgrade = isForgeActive() && hasAnyForgeUpgrade(forgeUpgrade);
    const weaponStatValue = (k) => weapon?.stats?.[k] ?? 0;
    const rawBase = existingCharacter.base;
    const baseWithPassive = weapon ? applyPassiveWeaponStats(baseStats, weapon.id, existingCharacter.class, existingCharacter.race, existingCharacter.mageTowerPassive) : baseStats;
    const passiveAutoBonus = (baseWithPassive.auto ?? baseStats.auto) - (baseStats.auto + (weapon?.stats?.auto ?? 0));
    const awakeningEffect = getAwakeningEffect(existingCharacter.race, existingCharacter.level ?? 1);
    const finalStats = applyAwakeningToBase(baseWithPassive, awakeningEffect);

    const baseWithoutBonus = (k) => rawBase[k] - totalBonus(k);
    const getRaceDisplayBonus = (k) => {
      if (!isAwakeningActive) return raceB[k] || 0;

      const classBonus = classB[k] || 0;
      const forestBonus = forestBoosts[k] || 0;
      const weaponBonus = weaponStatValue(k);
      const passiveBonus = k === 'auto' ? passiveAutoBonus : 0;
      const subtotalWithoutRace = baseWithoutBonus(k) + classBonus + forestBonus + weaponBonus + passiveBonus;
      return (finalStats[k] ?? 0) - subtotalWithoutRace;
    };

    const tooltipContent = (k) => {
      const parts = [`Base: ${baseWithoutBonus(k)}`];
      if (classB[k] > 0) parts.push(`Classe: +${classB[k]}`);
      if (forestBoosts[k] > 0) parts.push(`Forêt: +${forestBoosts[k]}`);
      if (weaponStatValue(k) !== 0) parts.push(`Arme: ${weaponStatValue(k) > 0 ? `+${weaponStatValue(k)}` : weaponStatValue(k)}`);
      if (k === 'auto' && passiveAutoBonus > 0) parts.push(`Passif arme: +${passiveAutoBonus}`);

      const raceDisplayBonus = getRaceDisplayBonus(k);
      if (raceDisplayBonus !== 0) parts.push(`Race: ${raceDisplayBonus > 0 ? `+${raceDisplayBonus}` : raceDisplayBonus}`);
      return parts.join(' | ');
    };
    const StatLine = ({ statKey, label, valueClassName = '' }) => {
      const displayValue = finalStats[statKey] ?? 0;
      const raceDisplayBonus = getRaceDisplayBonus(statKey);
      const hasBonus = raceDisplayBonus !== 0 || classB[statKey] > 0 || forestBoosts[statKey] > 0 || weaponStatValue(statKey) !== 0 || (statKey === 'auto' && passiveAutoBonus !== 0);
      const totalDelta = raceDisplayBonus + (classB[statKey] || 0) + (forestBoosts[statKey] || 0) + weaponStatValue(statKey) + (statKey === 'auto' ? passiveAutoBonus : 0);
      const labelClass = totalDelta > 0 ? 'text-green-400' : totalDelta < 0 ? 'text-red-400' : 'text-yellow-300';
      return hasBonus ? (
        <Tooltip content={tooltipContent(statKey)}>
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
        {renderSoundControl()}
        {renderIntroMusic()}
        {PseudoModal}
        <div className="max-w-4xl mx-auto pt-20">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-stone-800 border border-stone-600 px-8 py-3">
              <h2 className="text-4xl font-bold text-stone-200">Mon Personnage</h2>
            </div>
          </div>

          <div className={`relative max-w-md mx-auto ${hasForgeUpgrade ? 'forge-lava-border forge-lava-glow' : ''}`} style={{width:'340px'}}>
            <div className={`shadow-2xl ${hasForgeUpgrade ? 'forge-lava-shine' : ''}`}>
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-amber-200 px-5 py-1 text-xs font-bold shadow-lg z-10 border border-stone-600 text-center whitespace-nowrap">
                {existingCharacter.race} • {existingCharacter.class} • Niveau {existingCharacter.level ?? 1}
              </div>
              <div className="overflow-visible">
                <div className="relative bg-stone-900 flex items-center justify-center">
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
                  <div className="absolute bottom-3 left-3 right-3 bg-black/80 p-3">
                    <div className="text-white font-bold text-lg text-center">{existingCharacter.name}</div>
                  </div>
                </div>
                <div className="bg-stone-800 p-3">
                  <div className="flex justify-between text-xs text-white mb-2 font-bold">
                    <StatLine statKey="hp" label="HP" valueClassName="text-white" />
                    <StatLine statKey="spd" label="VIT" valueClassName="text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-1 mb-3 text-xs text-gray-300">
                    <StatLine statKey="auto" label="Auto" />
                    <StatLine statKey="def" label="Déf" />
                    <StatLine statKey="cap" label="Cap" />
                    <StatLine statKey="rescap" label="ResC" />
                  </div>
                  <div className="space-y-2">
                    {weapon ? (
                      <div className="text-xs text-stone-300 border border-stone-600 bg-stone-900/60 p-2">
                        <Tooltip content={getWeaponTooltipContent(weapon)}>
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
                          {weapon.effet && typeof weapon.effet === 'object' && (
                            <div className="text-amber-200">
                              Effet: {weapon.effet.nom} — {weapon.effet.description}
                            </div>
                          )}
                          {weapon.stats && Object.keys(weapon.stats).length > 0 && (
                            <div className="text-stone-200">
                              Stats: {formatWeaponStats(weapon)}
                            </div>
                          )}
                          {hasForgeUpgrade && (
                            <div className="text-orange-300 font-semibold">
                              🔨 Forge: {Object.entries(extractForgeUpgrade(forgeUpgrade).bonuses).map(([k, pct]) => `${forgeLabel(k)} +${formatUpgradePct(pct)}`).join(' • ')}
                              {Object.entries(extractForgeUpgrade(forgeUpgrade).penalties).map(([k, pct]) => `${forgeLabel(k)} -${formatUpgradePct(pct)}`).join(' • ') ? ` • ${Object.entries(extractForgeUpgrade(forgeUpgrade).penalties).map(([k, pct]) => `${forgeLabel(k)} -${formatUpgradePct(pct)}`).join(' • ')}` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-stone-500 border border-stone-600 bg-stone-900/60 p-2">
                        Aucune arme équipée
                      </div>
                    )}
                    {passiveDetails ? (
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
                    ) : (
                      <div className="text-xs text-stone-500 border border-stone-600 bg-stone-900/60 p-2">
                        Aucun passif de Tour du Mage équipé
                      </div>
                    )}
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
                    <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                      <span className="text-lg">{classes[existingCharacter.class].icon}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-amber-200">{classes[existingCharacter.class].ability}</div>
                        <div className="text-stone-400 text-[11px]">
                          {getCalculatedDescription(
                            existingCharacter.class,
                            finalStats.cap ?? 0,
                            finalStats.auto ?? 0
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate('/dungeons')}
              disabled={isDowntimeLocked}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-stone-700 disabled:text-stone-300 disabled:border-stone-500 disabled:cursor-not-allowed text-white px-12 py-4 font-bold text-xl shadow-2xl border-2 border-amber-500 hover:border-amber-400 transition-all"
            >
              🏰 Donjon 🏰
            </button>
            <button
              onClick={() => navigate('/training')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-10 py-4 font-bold text-xl shadow-2xl border-2 border-orange-500 hover:border-orange-400 transition-all"
            >
              🎯 Entraînement 🎯
            </button>
            <button
              onClick={() => navigate('/labyrinthe-infini')}
              disabled={isDowntimeLocked}
              className="bg-fuchsia-700 hover:bg-fuchsia-600 disabled:bg-stone-700 disabled:text-stone-300 disabled:border-stone-500 disabled:cursor-not-allowed text-white px-10 py-4 font-bold text-xl shadow-2xl border-2 border-fuchsia-500 hover:border-fuchsia-300 transition-all"
            >
              🌀 Labyrinthe infini 🌀
            </button>
            <button
              onClick={() => navigate('/cataclysme')}
              className="bg-red-800 hover:bg-red-700 text-white px-10 py-4 font-bold text-xl shadow-2xl border-2 border-red-500 hover:border-red-300 transition-all"
            >
              ☄️ Cataclysme ☄️
            </button>
            {currentUser?.email === 'antho.pruneta@gmail.com' && (
              <button
                onClick={() => navigate('/combat')}
                className="bg-red-700 hover:bg-red-600 text-white px-10 py-4 font-bold text-xl shadow-2xl border-2 border-red-500 hover:border-red-300 transition-all"
              >
                ⚔️ PvP ⚔️
              </button>
            )}
          </div>

          {isDowntimeLocked && (
            <div className="mt-6 bg-stone-800 border border-red-500/60 px-6 py-4 max-w-lg mx-auto rounded-lg">
              <p className="text-red-300 text-base text-center font-medium">
                🔒 Après le tournoi, les donjons et le labyrinthe sont fermés jusqu'à lundi.
              </p>
            </div>
          )}

          <div className="mt-6 bg-stone-800 border border-amber-600/50 px-6 py-4 max-w-lg mx-auto rounded-lg">
            <p className="text-amber-200 text-base text-center font-medium">
              ℹ️ Nouveau personnage disponible après le tournoi
            </p>
          </div>
          {renderGameEncyclopedia()}
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
        {renderSoundControl()}
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
        {renderSoundControl()}
        {renderIntroMusic()}
        <div className="max-w-4xl w-full pt-20">
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
                    <p className="text-yellow-200 text-sm">Tu as gagné le droit de choisir parmi 3 rolls!</p>
                  </div>
                )}
                <button
                  onClick={rollCharacter}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 px-8 py-6 rounded-lg font-bold text-2xl shadow-lg border-2 border-amber-400 transition-all transform hover:scale-105"
                >
                  {hasTripleRoll ? '👑 ROLL x3 MON PERSONNAGE 👑' : '🎲 ROLL MON PERSONNAGE 🎲'}
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
            /* Triple roll: choisir parmi 3 personnages */
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-6">
                <p className="text-yellow-300 font-bold text-xl">👑 Choisis ton personnage parmi les 3 rolls!</p>
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
                  <div className="text-gray-300 text-xs">{getCalculatedDescription(rolledCharacter.class, rolledCharacter.base.cap, rolledCharacter.base.auto)}</div>
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
        {renderSoundControl()}
        {renderIntroMusic()}
      {PseudoModal}
      <div className="max-w-4xl w-full pt-20">
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
              maxLength={20}
            />
            {errors.name && <p className="text-red-400 text-sm mt-2">⚠️ {errors.name}</p>}
            <p className="text-gray-500 text-xs mt-2">{formData.name.length}/20 caractères</p>
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
              maxLength={50}
            />
            {errors.keyword && <p className="text-red-400 text-sm mt-2">⚠️ {errors.keyword}</p>}
            <p className="text-gray-500 text-xs mt-2">{formData.keyword.length}/50 caractères</p>
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
