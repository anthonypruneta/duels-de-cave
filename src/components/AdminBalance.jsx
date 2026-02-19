import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { classConstants, raceConstants, getRaceBonus, getClassBonus } from '../data/combatMechanics';
import { getAwakeningEffect, applyAwakeningToBase } from '../utils/awakening';
import { simulerMatch, preparerCombattant } from '../utils/tournamentCombat';
import { getStatPointValue } from '../utils/statPoints';
import { createForestBossCombatant, FOREST_LEVELS } from '../data/forestDungeons';
import { createMageTowerBossCombatant, MAGE_TOWER_LEVELS } from '../data/mageTowerDungeons';
import { createBossCombatant } from '../data/bosses';
import { applyBalanceConfig, loadPersistedBalanceConfig, savePersistedBalanceConfig } from '../services/balanceConfigService';
import { buildRaceBonusDescription, buildRaceAwakeningDescription, buildClassDescription, RACE_TO_CONSTANT_KEY, CLASS_TO_CONSTANT_KEY } from '../utils/descriptionBuilders';
import { weapons, isWaveActive, RARITY } from '../data/weapons';
import { getAvailablePassives, getMageTowerPassiveById, MAGE_TOWER_PASSIVES } from '../data/mageTowerPassives';

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const applyNumericOverrides = (target, source) => {
  Object.entries(source).forEach(([key, val]) => {
    if (!(key in target)) return;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      applyNumericOverrides(target[key], val);
      return;
    }

    const parsed = Number(val);
    if (!Number.isNaN(parsed)) target[key] = parsed;
  });
};

const updateNestedValue = (obj, path, value) => {
  if (!path.length) return obj;
  const [head, ...rest] = path;
  return {
    ...obj,
    [head]: rest.length ? updateNestedValue(obj[head] || {}, rest, value) : value
  };
};

const NumberTreeEditor = ({ value, onChange, path = [] }) => (
  <div className="space-y-2">
    {Object.entries(value || {}).map(([key, val]) => {
      const keyPath = [...path, key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return (
          <div key={keyPath.join('.')} className="border border-stone-700 p-2 bg-stone-950/50">
            <div className="text-xs text-amber-300 font-semibold mb-2">{key}</div>
            <NumberTreeEditor value={val} onChange={onChange} path={keyPath} />
          </div>
        );
      }

      return (
        <label key={keyPath.join('.')} className="flex items-center justify-between gap-3 text-xs">
          <span className="text-stone-300">{key}</span>
          <input
            type="number"
            step="any"
            value={val}
            onChange={(e) => onChange(keyPath, e.target.value)}
            className="w-28 px-2 py-1 bg-stone-900 border border-stone-600 text-white"
          />
        </label>
      );
    })}
  </div>
);

const genStats = () => {
  const s = { hp: 120, auto: 15, def: 15, cap: 15, rescap: 15, spd: 15 };
  let rem = 35;

  // Spike optionnel (30% chance)
  const pool = ['auto', 'def', 'cap', 'rescap', 'spd'];
  if (Math.random() < 0.3) {
    const k = pool[Math.floor(Math.random() * pool.length)];
    const spikeAmount = 5 + Math.floor(Math.random() * 6);
    const actual = Math.min(spikeAmount, 35 - s[k]);
    s[k] += actual;
    rem -= actual;
  }

  // Distribution équilibrée des points restants
  let guard = 1000;
  while (rem > 0 && guard-- > 0) {
    const entries = [['hp',2],['auto',2],['def',2],['cap',2],['rescap',2],['spd',2]];
    const tot = entries.reduce((a,[,w]) => a + w, 0);
    let r = Math.random() * tot;
    let k = 'hp';
    for (const [key, w] of entries) {
      r -= w;
      if (r <= 0) { k = key; break; }
    }
    if (k === 'hp') {
      const hpGain = getStatPointValue('hp');
      if (s.hp + hpGain <= 200) { s.hp += hpGain; rem--; }
    } else {
      const statGain = getStatPointValue(k);
      if (s[k] + statGain <= 35) { s[k] += statGain; rem--; }
    }
  }

  return s;
};

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const STAT_KEYS = ['hp', 'auto', 'def', 'cap', 'rescap', 'spd'];

const genLevelBoosts = (level) => {
  const boosts = { hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 };
  const points = Math.max(0, level - 1);
  for (let i = 0; i < points; i++) {
    const stat = randomItem(STAT_KEYS);
    boosts[stat] += getStatPointValue(stat);
  }
  return boosts;
};

const getPassiveLevelForCharacterLevel = (level) => {
  if (level >= 100) return 3;
  if (level >= 50) return 2;
  return 1;
};


const buildRaceTextDraft = (raceBonusDraft, raceAwakeningDraft) => {
  const data = {};
  Object.entries(RACE_TO_CONSTANT_KEY).forEach(([raceName, key]) => {
    data[raceName] = {
      bonus: buildRaceBonusDescription(raceName, raceBonusDraft[key] || {}),
      awakeningDescription: buildRaceAwakeningDescription(raceName, raceAwakeningDraft[raceName] || {})
    };
  });
  return data;
};

const buildClassTextDraft = (classDraft) => {
  const data = {};
  Object.entries(CLASS_TO_CONSTANT_KEY).forEach(([className, key]) => {
    data[className] = {
      ability: classes[className]?.ability || '',
      description: buildClassDescription(className, classDraft[key] || {})
    };
  });
  return data;
};

const makeCharacter = (id, level, availableWeaponIds, availablePassiveIds) => {
  const raceName = randomItem(Object.keys(races));
  const className = randomItem(Object.keys(classes));
  const weaponId = availableWeaponIds.length > 0 ? randomItem(availableWeaponIds) : null;
  const passiveId = availablePassiveIds.length > 0 ? randomItem(availablePassiveIds) : null;
  const raw = genStats();
  const raceBonus = getRaceBonus(raceName);
  const classBonus = getClassBonus(className);
  const levelBoosts = genLevelBoosts(level);

  const base = applyAwakeningToBase({
    hp: raw.hp + raceBonus.hp + classBonus.hp,
    auto: raw.auto + raceBonus.auto + classBonus.auto,
    def: raw.def + raceBonus.def + classBonus.def,
    cap: raw.cap + raceBonus.cap + classBonus.cap,
    rescap: raw.rescap + raceBonus.rescap + classBonus.rescap,
    spd: raw.spd + raceBonus.spd + classBonus.spd
  }, getAwakeningEffect(raceName, level));

  return {
    id,
    userId: id,
    name: id,
    race: raceName,
    class: className,
    base,
    level,
    bonuses: { race: raceBonus, class: classBonus },
    forestBoosts: levelBoosts,
    mageTowerPassive: passiveId ? { id: passiveId, level: getPassiveLevelForCharacterLevel(level) } : null,
    equippedWeaponId: weaponId
  };
};

function AdminBalance({ embedded = false }) {
  const navigate = useNavigate();
  const [duels, setDuels] = useState(500);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [raceTab, setRaceTab] = useState('bonus');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Duel 1v1
  const raceNames = useMemo(() => Object.keys(races), []);
  const classNames = useMemo(() => Object.keys(classes), []);
  const availableWeapons = useMemo(() => Object.values(weapons).filter((weapon) => isWaveActive(weapon.vague) && weapon.rarete === RARITY.LEGENDAIRE), []);
  const availablePassives = useMemo(() => getAvailablePassives(), []);
  const defaultWeaponId = availableWeapons[0]?.id || '';
  const defaultPassiveId = availablePassives[0]?.id || '';

  const [duelP1, setDuelP1] = useState({ race: raceNames[0], class: classNames[0], level: 1, weaponId: defaultWeaponId, passiveId: defaultPassiveId, passiveLevel: 1 });
  const [duelP2, setDuelP2] = useState({ race: raceNames[0], class: classNames[0], level: 1, weaponId: defaultWeaponId, passiveId: defaultPassiveId, passiveLevel: 1 });
  const [duelOpponent, setDuelOpponent] = useState('pvp');
  const [duelResult, setDuelResult] = useState(null);

  const [raceBonusDraft, setRaceBonusDraft] = useState(() => deepClone(raceConstants));
  const [raceAwakeningDraft, setRaceAwakeningDraft] = useState(() => {
    const draft = {};
    Object.entries(races).forEach(([name, info]) => {
      draft[name] = deepClone(info?.awakening?.effect || {});
    });
    return draft;
  });
  const [classDraft, setClassDraft] = useState(() => deepClone(classConstants));
  const [weaponDraft, setWeaponDraft] = useState(() => deepClone(weapons));
  const [passiveDraft, setPassiveDraft] = useState(() => deepClone(MAGE_TOWER_PASSIVES));
  const [raceTextDraft, setRaceTextDraft] = useState(() => buildRaceTextDraft(deepClone(raceConstants), Object.fromEntries(Object.entries(races).map(([name, info]) => [name, deepClone(info?.awakening?.effect || {})]))));
  const [classTextDraft, setClassTextDraft] = useState(() => buildClassTextDraft(deepClone(classConstants)));

  const raceCards = useMemo(() => Object.entries(races), []);
  const classCards = useMemo(() => Object.entries(classes), []);

  // Charger la config depuis Firebase au démarrage
  useEffect(() => {
    const loadSavedConfig = async () => {
      const result = await loadPersistedBalanceConfig();
      if (!result.success || !result.data) return;

      setRaceBonusDraft(deepClone(raceConstants));
      setClassDraft(deepClone(classConstants));
      setWeaponDraft(deepClone(weapons));
      setPassiveDraft(deepClone(MAGE_TOWER_PASSIVES));
      
      const loadedAwakeningDraft = {};
      Object.entries(races).forEach(([name, info]) => {
        loadedAwakeningDraft[name] = deepClone(info?.awakening?.effect || {});
      });
      setRaceAwakeningDraft(loadedAwakeningDraft);
      setRaceTextDraft(buildRaceTextDraft(deepClone(raceConstants), loadedAwakeningDraft));
      setClassTextDraft(buildClassTextDraft(deepClone(classConstants)));
    };

    loadSavedConfig();
  }, []);

  const applyDraftToLiveData = () => {
    applyNumericOverrides(raceConstants, raceBonusDraft);
    applyNumericOverrides(classConstants, classDraft);
    applyNumericOverrides(weapons, weaponDraft);
    passiveDraft.forEach((passive, index) => {
      if (!MAGE_TOWER_PASSIVES[index]) return;
      applyNumericOverrides(MAGE_TOWER_PASSIVES[index], passive);
    });

    Object.entries(raceAwakeningDraft).forEach(([raceName, effectDraft]) => {
      const currentEffect = races?.[raceName]?.awakening?.effect;
      if (!currentEffect || !effectDraft) return;
      applyNumericOverrides(currentEffect, effectDraft);
    });
  };

  // Sauvegarder dans Firebase et appliquer immédiatement
  const handleApplyChanges = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      const config = {
        raceConstants: deepClone(raceBonusDraft),
        classConstants: deepClone(classDraft),
        weaponConstants: deepClone(weaponDraft),
        mageTowerPassives: deepClone(passiveDraft),
        raceAwakenings: deepClone(raceAwakeningDraft),
        raceTexts: deepClone(raceTextDraft),
        classTexts: deepClone(classTextDraft)
      };

      const saveResult = await savePersistedBalanceConfig({
        config,
        updatedBy: 'admin'
      });

      if (!saveResult.success) {
        setSaveMessage(`❌ ${saveResult.error}`);
        return;
      }

      applyBalanceConfig(config);
      setSaveMessage('✅ Modifications sauvegardées et appliquées à tout le jeu !');
    } catch (error) {
      setSaveMessage(`❌ Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const withTemporaryDraftOverrides = (callback) => {
    const previousRaceConstants = deepClone(raceConstants);
    const previousClassConstants = deepClone(classConstants);
    const previousWeapons = deepClone(weapons);
    const previousPassives = deepClone(MAGE_TOWER_PASSIVES);
    const previousAwakeningEffects = {};

    Object.entries(races).forEach(([name, info]) => {
      previousAwakeningEffects[name] = deepClone(info?.awakening?.effect || {});
    });

    try {
      applyDraftToLiveData();
      callback();
    } finally {
      Object.keys(raceConstants).forEach((key) => delete raceConstants[key]);
      Object.assign(raceConstants, previousRaceConstants);

      Object.keys(classConstants).forEach((key) => delete classConstants[key]);
      Object.assign(classConstants, previousClassConstants);

      Object.keys(weapons).forEach((key) => delete weapons[key]);
      Object.assign(weapons, previousWeapons);

      MAGE_TOWER_PASSIVES.splice(0, MAGE_TOWER_PASSIVES.length, ...previousPassives);

      Object.entries(previousAwakeningEffects).forEach(([name, effect]) => {
        if (!races?.[name]?.awakening) return;
        races[name].awakening.effect = effect;
      });
    }
  };

  const simulateForLevel = (level, count) => {
    const raceWins = Object.fromEntries(Object.keys(races).map((name) => [name, 0]));
    const classWins = Object.fromEntries(Object.keys(classes).map((name) => [name, 0]));
    const weaponWins = Object.fromEntries(availableWeapons.map((weapon) => [weapon.id, 0]));
    const passiveWins = Object.fromEntries(availablePassives.map((passive) => [passive.id, 0]));
    const raceAppearances = Object.fromEntries(Object.keys(races).map((name) => [name, 0]));
    const classAppearances = Object.fromEntries(Object.keys(classes).map((name) => [name, 0]));
    const weaponAppearances = Object.fromEntries(availableWeapons.map((weapon) => [weapon.id, 0]));
    const passiveAppearances = Object.fromEntries(availablePassives.map((passive) => [passive.id, 0]));

    const availableWeaponIds = availableWeapons.map((weapon) => weapon.id);
    const availablePassiveIds = availablePassives.map((passive) => passive.id);

    for (let i = 0; i < count; i++) {
      const p1 = makeCharacter(`L${level}-A-${i}`, level, availableWeaponIds, availablePassiveIds);
      const p2 = makeCharacter(`L${level}-B-${i}`, level, availableWeaponIds, availablePassiveIds);

      raceAppearances[p1.race] += 1;
      raceAppearances[p2.race] += 1;
      classAppearances[p1.class] += 1;
      classAppearances[p2.class] += 1;
      if (p1.equippedWeaponId) weaponAppearances[p1.equippedWeaponId] += 1;
      if (p2.equippedWeaponId) weaponAppearances[p2.equippedWeaponId] += 1;
      if (p1.mageTowerPassive?.id) passiveAppearances[p1.mageTowerPassive.id] += 1;
      if (p2.mageTowerPassive?.id) passiveAppearances[p2.mageTowerPassive.id] += 1;

      const match = simulerMatch(p1, p2);
      const winner = match.winnerId === p1.userId ? p1 : p2;
      raceWins[winner.race] += 1;
      classWins[winner.class] += 1;
      if (winner.equippedWeaponId) weaponWins[winner.equippedWeaponId] += 1;
      if (winner.mageTowerPassive?.id) passiveWins[winner.mageTowerPassive.id] += 1;
    }

    const sortedRaces = Object.entries(raceWins)
      .map(([race, wins]) => {
        const appearances = raceAppearances[race] || 0;
        const rate = appearances > 0 ? (wins / appearances) * 100 : 0;
        return { race, wins, appearances, rate: rate.toFixed(1) };
      })
      .sort((a, b) => Number(b.rate) - Number(a.rate));

    const sortedClasses = Object.entries(classWins)
      .map(([clazz, wins]) => {
        const appearances = classAppearances[clazz] || 0;
        const rate = appearances > 0 ? (wins / appearances) * 100 : 0;
        return { clazz, wins, appearances, rate: rate.toFixed(1) };
      })
      .sort((a, b) => Number(b.rate) - Number(a.rate));

    const sortedWeapons = Object.entries(weaponWins)
      .map(([weaponId, wins]) => {
        const appearances = weaponAppearances[weaponId] || 0;
        const rate = appearances > 0 ? (wins / appearances) * 100 : 0;
        return { weaponId, wins, appearances, rate: rate.toFixed(1) };
      })
      .sort((a, b) => Number(b.rate) - Number(a.rate));

    const sortedPassives = Object.entries(passiveWins)
      .map(([passiveId, wins]) => {
        const appearances = passiveAppearances[passiveId] || 0;
        const rate = appearances > 0 ? (wins / appearances) * 100 : 0;
        return { passiveId, wins, appearances, rate: rate.toFixed(1) };
      })
      .sort((a, b) => Number(b.rate) - Number(a.rate));

    return { sortedRaces, sortedClasses, sortedWeapons, sortedPassives };
  };

  const handleRun = async () => {
    const duelCount = Math.max(10, Number(duels) || 10);
    setRunning(true);
    setSaveMessage('');

    try {
      withTemporaryDraftOverrides(() => {
        const level1 = simulateForLevel(1, duelCount);
        const level100 = simulateForLevel(100, duelCount);
        const level400 = simulateForLevel(400, duelCount);
        setResults({ duelCount, level1, level100, level400 });
      });
    } finally {
      setRunning(false);
    }
  };

  // La page est maintenant en lecture seule - les valeurs viennent directement du code
  // Pour modifier l'équilibrage, éditez les fichiers:
  // - /src/data/combatMechanics.js (classConstants, raceConstants)
  // - /src/data/races.js (awakening effects)

  const makeCustomCharacter = (id, raceName, className, level, weaponId, passiveId, passiveLevel) => {
    const raw = genStats();
    const raceBonus = getRaceBonus(raceName);
    const classBonus = getClassBonus(className);
    const levelBoosts = genLevelBoosts(level);
    const base = applyAwakeningToBase({
      hp: raw.hp + raceBonus.hp + classBonus.hp,
      auto: raw.auto + raceBonus.auto + classBonus.auto,
      def: raw.def + raceBonus.def + classBonus.def,
      cap: raw.cap + raceBonus.cap + classBonus.cap,
      rescap: raw.rescap + raceBonus.rescap + classBonus.rescap,
      spd: raw.spd + raceBonus.spd + classBonus.spd
    }, getAwakeningEffect(raceName, level));
    return {
      id, userId: id,
      name: `${races[raceName]?.icon || ''} ${raceName} ${classes[className]?.icon || ''} ${className}`,
      race: raceName, class: className, base, level,
      bonuses: { race: raceBonus, class: classBonus },
      forestBoosts: levelBoosts,
      mageTowerPassive: passiveId ? { id: passiveId, level: Math.max(1, Math.min(3, Number(passiveLevel) || 1)) } : null,
      equippedWeaponId: weaponId || null
    };
  };

  const BOSS_OPTIONS = [
    { id: 'pvp', label: '⚔️ PvP (Joueur vs Joueur)' },
    { id: 'licorne', label: '🦄 Licorne (Forêt)', icon: '🦄' },
    { id: 'dragon', label: '🐲 Dragon (Donjon)', icon: '🐲' },
    { id: 'lich', label: '🧟 Liche (Tour de Mage)', icon: '🧟' }
  ];

  const createBossForDuel = (bossId) => {
    if (bossId === 'licorne') {
      const bossData = FOREST_LEVELS.find(l => l.boss.id === 'licorne')?.boss;
      if (!bossData) return null;
      const boss = createForestBossCombatant(bossData);
      boss.shield = 0;
      boss.shieldExploded = false;
      return boss;
    }
    if (bossId === 'lich') {
      const bossData = MAGE_TOWER_LEVELS.find(l => l.boss.id === 'lich')?.boss;
      if (!bossData) return null;
      const boss = createMageTowerBossCombatant(bossData);
      boss.shield = Math.max(1, Math.round(boss.maxHP * 0.2));
      return boss;
    }
    if (bossId === 'dragon') {
      return createBossCombatant('dragon');
    }
    return null;
  };

  const handleDuel = () => {
    withTemporaryDraftOverrides(() => {
      const p1 = makeCustomCharacter('P1', duelP1.race, duelP1.class, duelP1.level, duelP1.weaponId, duelP1.passiveId, duelP1.passiveLevel);
      const p1Final = preparerCombattant(p1);
      const p1Display = { ...p1, base: p1Final.base };

      if (duelOpponent === 'pvp') {
        const p2 = makeCustomCharacter('P2', duelP2.race, duelP2.class, duelP2.level, duelP2.weaponId, duelP2.passiveId, duelP2.passiveLevel);
        const p2Final = preparerCombattant(p2);
        const result = simulerMatch(p1, p2);
        setDuelResult({ ...result, p1: p1Display, p2: { ...p2, base: p2Final.base } });
      } else {
        const boss = createBossForDuel(duelOpponent);
        if (!boss) return;
        const result = simulerMatch(p1, boss);
        setDuelResult({ ...result, p1: p1Display, p2: boss, isBoss: true });
      }
    });
  };

  const content = (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-amber-300">⚖️ Équilibrage (Admin)</h1>
        {!embedded && (
          <button onClick={() => navigate('/admin')} className="bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded">← Retour admin</button>
        )}
      </div>

        <div className="bg-stone-900/70 border border-amber-600 p-4 mb-6">
          <label className="text-stone-300 text-sm block mb-2">Nombre de duels par niveau (1, 100 et 400)</label>
          <div className="flex gap-3 flex-wrap">
            <input type="number" min="10" value={duels} onChange={(e) => setDuels(e.target.value)} className="px-3 py-2 bg-stone-800 border border-stone-600 text-white w-40" />
            <button onClick={handleRun} disabled={running} className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white px-4 py-2 font-bold">
              {running ? '⏳ Simulation...' : '▶️ Lancer simulation niv 1 + niv 100 + niv 400'}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 2xl:grid-cols-4 gap-6 mb-8">
          <div className="bg-stone-900/70 border border-stone-600 p-4">
            <h2 className="text-xl text-amber-300 font-bold mb-3">Races</h2>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setRaceTab('bonus')}
                className={`px-3 py-2 rounded text-sm font-bold ${raceTab === 'bonus' ? 'bg-amber-600 text-white' : 'bg-stone-800 text-stone-300'}`}
              >
                Bonus racial
              </button>
              <button
                onClick={() => setRaceTab('awakening')}
                className={`px-3 py-2 rounded text-sm font-bold ${raceTab === 'awakening' ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-300'}`}
              >
                Éveil racial
              </button>
            </div>

            <div className="space-y-3 max-h-[70vh] overflow-auto pr-2">
              {raceCards.map(([name, info]) => {
                const constantKey = RACE_TO_CONSTANT_KEY[name];
                const bonusValues = constantKey ? raceBonusDraft[constantKey] : null;
                const awakeningValues = raceAwakeningDraft[name];
                return (
                  <div key={name} className="bg-stone-950/70 border border-stone-700 p-3">
                    <div className="font-bold text-white mb-1">{info.icon} {name}</div>
                    {raceTab === 'bonus' ? (
                      <>
                        <textarea
                          className="w-full text-xs text-stone-300 mb-2 whitespace-pre-line bg-stone-900 border border-stone-700 p-2"
                          value={`Bonus: ${raceTextDraft[name]?.bonus || ''}`}
                          readOnly
                          rows={2}
                        />
                        {bonusValues ? (
                          <NumberTreeEditor
                            value={bonusValues}
                            onChange={(path, value) => {
                              setRaceBonusDraft((prev) => {
                                const next = { ...prev, [constantKey]: updateNestedValue(prev[constantKey], path, value) };
                                setRaceTextDraft(buildRaceTextDraft(next, raceAwakeningDraft));
                                return next;
                              });
                            }}
                          />
                        ) : (
                          <div className="text-xs text-stone-500">Aucune valeur numérique mappée pour ce bonus.</div>
                        )}
                      </>
                    ) : (
                      <>
                        <textarea
                          className="w-full text-xs text-emerald-300 mb-2 whitespace-pre-line bg-stone-900 border border-stone-700 p-2"
                          value={`Awakening: ${raceTextDraft[name]?.awakeningDescription || ''}`}
                          readOnly
                          rows={4}
                        />
                        <NumberTreeEditor
                          value={awakeningValues}
                          onChange={(path, value) => {
                            setRaceAwakeningDraft((prev) => {
                              const next = { ...prev, [name]: updateNestedValue(prev[name] || {}, path, value) };
                              setRaceTextDraft(buildRaceTextDraft(raceBonusDraft, next));
                              return next;
                            });
                          }}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-stone-900/70 border border-stone-600 p-4">
            <h2 className="text-xl text-amber-300 font-bold mb-3">Classes (description auto + valeurs modifiables)</h2>
            <div className="space-y-3 max-h-[70vh] overflow-auto pr-2">
              {classCards.map(([name, info]) => {
                const constantKey = CLASS_TO_CONSTANT_KEY[name];
                if (!constantKey || !classDraft[constantKey]) return null;
                return (
                  <div key={name} className="bg-stone-950/70 border border-stone-700 p-3">
                    <div className="font-bold text-white mb-1">{info.icon} {name}</div>
                    <div className="text-xs text-amber-300 mb-1">{classTextDraft[name]?.ability || info.ability}</div>
                    <textarea
                      className="w-full text-xs text-stone-300 mb-2 whitespace-pre-line bg-stone-900 border border-stone-700 p-2"
                      value={classTextDraft[name]?.description || info.description}
                      readOnly
                      rows={3}
                    />
                    <NumberTreeEditor
                      value={classDraft[constantKey]}
                      onChange={(path, value) => {
                        setClassDraft((prev) => {
                          const next = { ...prev, [constantKey]: updateNestedValue(prev[constantKey], path, value) };
                          setClassTextDraft(buildClassTextDraft(next));
                          return next;
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-stone-900/70 border border-stone-600 p-4">
            <h2 className="text-xl text-amber-300 font-bold mb-3">Armes légendaires (up/nerf)</h2>
            <div className="space-y-3 max-h-[70vh] overflow-auto pr-2">
              {availableWeapons.map((weapon) => {
                const draft = weaponDraft[weapon.id];
                if (!draft) return null;
                return (
                  <div key={weapon.id} className="bg-stone-950/70 border border-stone-700 p-3">
                    <div className="font-bold text-white mb-2">{weapon.icon} {weapon.nom}</div>
                    <NumberTreeEditor
                      value={draft}
                      onChange={(path, value) => {
                        setWeaponDraft((prev) => ({
                          ...prev,
                          [weapon.id]: updateNestedValue(prev[weapon.id] || {}, path, value)
                        }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-stone-900/70 border border-stone-600 p-4">
            <h2 className="text-xl text-amber-300 font-bold mb-3">Passifs tour de mage (up/nerf)</h2>
            <div className="space-y-3 max-h-[70vh] overflow-auto pr-2">
              {passiveDraft.map((passive, idx) => (
                <div key={passive.id} className="bg-stone-950/70 border border-stone-700 p-3">
                  <div className="font-bold text-white mb-2">{passive.icon} {passive.name}</div>
                  <NumberTreeEditor
                    value={passive}
                    onChange={(path, value) => {
                      setPassiveDraft((prev) => prev.map((item, itemIdx) => (
                        itemIdx === idx ? updateNestedValue(item, path, value) : item
                      )));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-stone-900/70 border border-amber-500 rounded-lg p-4 mb-8">
          <button
            onClick={handleApplyChanges}
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-stone-700 text-white py-3 rounded font-bold"
          >
            {saving ? '⏳ Sauvegarde...' : '✅ Sauvegarder et appliquer à tout le jeu'}
          </button>
          {saveMessage && <p className="text-sm text-green-300 mt-3">{saveMessage}</p>}
        </div>

        {/* Duel 1v1 */}
        <div className="bg-stone-900/70 border border-purple-500 rounded-lg p-4 mb-8">
          <h2 className="text-xl text-purple-300 font-bold mb-4">⚔️ Duel 1v1</h2>

          <div className="flex flex-wrap gap-2 mb-4">
            {BOSS_OPTIONS.map(({ id, label }) => (
              <button key={id} onClick={() => { setDuelOpponent(id); setDuelResult(null); }}
                className={`px-3 py-1 text-xs font-bold rounded border ${duelOpponent === id
                  ? 'bg-purple-600 border-purple-400 text-white'
                  : 'bg-stone-800 border-stone-600 text-stone-400 hover:border-stone-400'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className={`grid ${duelOpponent === 'pvp' ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 mb-4`}>
            <div className="bg-stone-950/70 border border-stone-700 p-3 space-y-2">
              <div className="font-bold text-blue-300">{duelOpponent === 'pvp' ? 'Joueur 1' : 'Joueur'}</div>
              <label className="flex items-center gap-2 text-xs text-stone-300">
                Race
                <select value={duelP1.race} onChange={(e) => setDuelP1((p) => ({ ...p, race: e.target.value }))}
                  className="flex-1 px-2 py-1 bg-stone-900 border border-stone-600 text-white text-xs">
                  {raceNames.map((r) => <option key={r} value={r}>{races[r]?.icon} {r}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-300">
                Classe
                <select value={duelP1.class} onChange={(e) => setDuelP1((p) => ({ ...p, class: e.target.value }))}
                  className="flex-1 px-2 py-1 bg-stone-900 border border-stone-600 text-white text-xs">
                  {classNames.map((c) => <option key={c} value={c}>{classes[c]?.icon} {c}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-300">
                Niveau
                <input type="number" min="1" max="200" value={duelP1.level}
                  onChange={(e) => setDuelP1((p) => ({ ...p, level: Math.max(1, Number(e.target.value) || 1) }))}
                  className="w-20 px-2 py-1 bg-stone-900 border border-stone-600 text-white text-xs" />
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-300">
                Arme
                <select value={duelP1.weaponId} onChange={(e) => setDuelP1((p) => ({ ...p, weaponId: e.target.value }))}
                  className="flex-1 px-2 py-1 bg-stone-900 border border-stone-600 text-white text-xs">
                  {availableWeapons.map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.icon} {weapon.nom}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-300">
                Passif Tour de Mage
                <select value={duelP1.passiveId} onChange={(e) => setDuelP1((p) => ({ ...p, passiveId: e.target.value }))}
                  className="flex-1 px-2 py-1 bg-stone-900 border border-stone-600 text-white text-xs">
                  {availablePassives.map((passive) => <option key={passive.id} value={passive.id}>{passive.icon} {passive.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-300">
                Niveau passif
                <input type="number" min="1" max="3" value={duelP1.passiveLevel}
                  onChange={(e) => setDuelP1((p) => ({ ...p, passiveLevel: Math.max(1, Math.min(3, Number(e.target.value) || 1)) }))}
                  className="w-20 px-2 py-1 bg-stone-900 border border-stone-600 text-white text-xs" />
              </label>
            </div>
            {duelOpponent === 'pvp' && (
              <div className="bg-stone-950/70 border border-stone-700 p-3 space-y-2">
                <div className="font-bold text-red-300">Joueur 2</div>
                <label className="flex items-center gap-2 text-xs text-stone-300">
                  Race
                  <select value={duelP2.race} onChange={(e) => setDuelP2((p) => ({ ...p, race: e.target.value }))}
                    className="flex-1 px-2 py-1 bg-stone-900 border border-stone-600 text-white text-xs">
                    {raceNames.map((r) => <option key={r} value={r}>{races[r]?.icon} {r}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-stone-300">
                  Classe
                  <select value={duelP2.class} onChange={(e) => setDuelP2((p) => ({ ...p, class: e.target.value }))}
                    className="flex-1 px-2 py-1 bg-stone-900 border border-stone-600 text-white text-xs">
                    {classNames.map((c) => <option key={c} value={c}>{classes[c]?.icon} {c}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-stone-300">
                  Niveau
                  <input type="number" min="1" max="200" value={duelP2.level}
                    onChange={(e) => setDuelP2((p) => ({ ...p, level: Math.max(1, Number(e.target.value) || 1) }))}
                    className="w-20 px-2 py-1 bg-stone-900 border border-stone-600 text-white text-xs" />
                </label>
                <label className="flex items-center gap-2 text-xs text-stone-300">
                  Arme
                  <select value={duelP2.weaponId} onChange={(e) => setDuelP2((p) => ({ ...p, weaponId: e.target.value }))}
                    className="flex-1 px-2 py-1 bg-stone-900 border border-stone-600 text-white text-xs">
                    {availableWeapons.map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.icon} {weapon.nom}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-stone-300">
                  Passif Tour de Mage
                  <select value={duelP2.passiveId} onChange={(e) => setDuelP2((p) => ({ ...p, passiveId: e.target.value }))}
                    className="flex-1 px-2 py-1 bg-stone-900 border border-stone-600 text-white text-xs">
                    {availablePassives.map((passive) => <option key={passive.id} value={passive.id}>{passive.icon} {passive.name}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-stone-300">
                  Niveau passif
                  <input type="number" min="1" max="3" value={duelP2.passiveLevel}
                    onChange={(e) => setDuelP2((p) => ({ ...p, passiveLevel: Math.max(1, Math.min(3, Number(e.target.value) || 1)) }))}
                    className="w-20 px-2 py-1 bg-stone-900 border border-stone-600 text-white text-xs" />
                </label>
              </div>
            )}
          </div>
          <button onClick={handleDuel} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded font-bold mb-4">
            {duelOpponent === 'pvp' ? '⚔️ Lancer le duel' : `⚔️ Combattre le boss`}
          </button>

          {duelResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-stone-950/70 border border-stone-600 p-3">
                <div className="text-sm">
                  <span className="text-blue-300 font-bold">{duelResult.p1.name}</span>
                  <span className="text-stone-500 text-xs ml-2">niv.{duelResult.p1.level} — HP:{duelResult.p1.base.hp} ATK:{duelResult.p1.base.auto} DEF:{duelResult.p1.base.def} CAP:{duelResult.p1.base.cap} RES:{duelResult.p1.base.rescap} SPD:{duelResult.p1.base.spd}</span>
                  <span className="text-stone-400 text-xs block">Arme: {weapons[duelResult.p1.equippedWeaponId]?.icon} {weapons[duelResult.p1.equippedWeaponId]?.nom || 'Aucune'} · Passif: {getMageTowerPassiveById(duelResult.p1.mageTowerPassive?.id)?.icon} {getMageTowerPassiveById(duelResult.p1.mageTowerPassive?.id)?.name || 'Aucun'} (Niv.{duelResult.p1.mageTowerPassive?.level || 0})</span>
                </div>
                <span className="text-stone-500 font-bold">VS</span>
                <div className="text-sm text-right">
                  <span className="text-red-300 font-bold">{duelResult.p2.name}</span>
                  <span className="text-stone-500 text-xs ml-2">{duelResult.p2.level ? `niv.${duelResult.p2.level} — ` : ''}HP:{duelResult.p2.base.hp} ATK:{duelResult.p2.base.auto} DEF:{duelResult.p2.base.def} CAP:{duelResult.p2.base.cap} RES:{duelResult.p2.base.rescap} SPD:{duelResult.p2.base.spd}</span>
                  {!duelResult.isBoss && (
                    <span className="text-stone-400 text-xs block">Arme: {weapons[duelResult.p2.equippedWeaponId]?.icon} {weapons[duelResult.p2.equippedWeaponId]?.nom || 'Aucune'} · Passif: {getMageTowerPassiveById(duelResult.p2.mageTowerPassive?.id)?.icon} {getMageTowerPassiveById(duelResult.p2.mageTowerPassive?.id)?.name || 'Aucun'} (Niv.{duelResult.p2.mageTowerPassive?.level || 0})</span>
                  )}
                </div>
              </div>
              <div className="text-center text-lg font-bold text-amber-300">
                🏆 {duelResult.winnerNom} gagne !
              </div>
              <div className="bg-stone-950 border border-stone-700 p-3 max-h-[50vh] overflow-auto font-mono text-xs space-y-0.5">
                {duelResult.combatLog.map((line, i) => {
                  const isP1 = line.startsWith('[P1]');
                  const isP2 = line.startsWith('[P2]');
                  const isTurn = line.startsWith('---');
                  const isVictory = line.startsWith('🏆') || line.startsWith('⚔️');
                  const cleanLine = line.replace(/^\[P[12]\]\s*/, '');
                  return (
                    <div key={i} className={
                      isTurn ? 'text-stone-500 font-bold mt-2 border-t border-stone-800 pt-1' :
                      isVictory ? 'text-amber-300 font-bold' :
                      isP1 ? 'text-blue-300' :
                      isP2 ? 'text-red-300' :
                      'text-stone-400'
                    }>
                      {isP1 && <span className="text-blue-500 mr-1">[P1]</span>}
                      {isP2 && <span className="text-red-500 mr-1">[P2]</span>}
                      {(isP1 || isP2) ? cleanLine : line}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {results && (
          <div className="grid lg:grid-cols-2 gap-6">
            {[
              { key: 'level1', title: 'Résultats Niveau 1' },
              { key: 'level100', title: 'Résultats Niveau 100' },
              { key: 'level400', title: 'Résultats Niveau 400' }
            ].map(({ key, title }) => (
              <div key={key} className="bg-stone-900/70 border border-amber-600 p-4">
                <h3 className="text-lg text-amber-300 font-bold mb-3">{title} ({results.duelCount} duels)</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-semibold text-stone-200 mb-2">Races</div>
                    <div className="space-y-1">
                      {results[key].sortedRaces.map((row) => (
                        <div key={`${key}-race-${row.race}`} className="flex justify-between text-stone-300">
                          <span>{races[row.race]?.icon} {row.race}</span>
                          <span>{row.rate}% WR</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-stone-200 mb-2">Classes</div>
                    <div className="space-y-1">
                      {results[key].sortedClasses.map((row) => (
                        <div key={`${key}-class-${row.clazz}`} className="flex justify-between text-stone-300">
                          <span>{classes[row.clazz]?.icon} {row.clazz}</span>
                          <span>{row.rate}% WR</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-stone-200 mb-2">Armes</div>
                    <div className="space-y-1 max-h-48 overflow-auto pr-1">
                      {results[key].sortedWeapons.map((row) => (
                        <div key={`${key}-weapon-${row.weaponId}`} className="flex justify-between text-stone-300">
                          <span>{weapons[row.weaponId]?.icon} {weapons[row.weaponId]?.nom}</span>
                          <span>{row.rate}% WR</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-stone-200 mb-2">Passifs Tour de Mage</div>
                    <div className="space-y-1 max-h-48 overflow-auto pr-1">
                      {results[key].sortedPassives.map((row) => {
                        const passive = getMageTowerPassiveById(row.passiveId);
                        return (
                          <div key={`${key}-passive-${row.passiveId}`} className="flex justify-between text-stone-300">
                            <span>{passive?.icon} {passive?.name}</span>
                            <span>{row.rate}% WR</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-7xl mx-auto pt-20">
        {content}
      </div>
    </div>
  );
}

export default AdminBalance;
