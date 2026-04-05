import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { classConstants, raceConstants, weaponConstants, subclassConstants, getRaceBonus, getClassBonus } from '../data/combatMechanics';
import { simulerMatch } from '../utils/tournamentCombat';
import { weapons, RARITY } from '../data/weapons';
import { MAGE_TOWER_PASSIVES } from '../data/mageTowerPassives';
import { SUBCLASSES_BY_CLASS, getSubclassesForClass } from '../data/subclasses';
import { applyBalanceConfig, loadPersistedBalanceConfig, savePersistedBalanceConfig, syncWeaponConstantsToCombat, forceSyncFromCode } from '../services/balanceConfigService';
import { buildRaceBonusDescription, buildRaceAwakeningDescription, buildClassDescription, RACE_TO_CONSTANT_KEY, CLASS_TO_CONSTANT_KEY } from '../utils/descriptionBuilders';
import { getStatPointValue } from '../utils/statPoints';

import { deepClone, applyNumericOverrides } from './balance/balanceUtils';
import BalanceSimulation from './balance/BalanceSimulation';
import BalanceRaces from './balance/BalanceRaces';
import BalanceClasses from './balance/BalanceClasses';
import BalanceSubclasses from './balance/BalanceSubclasses';
import BalanceWeapons from './balance/BalanceWeapons';
import BalancePassives from './balance/BalancePassives';
import BalanceDuel from './balance/BalanceDuel';
import BalanceSave from './balance/BalanceSave';

// ============================================================================
// Fonctions de génération de personnages (module-level, pas d'import croisé)
// ============================================================================

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const STAT_KEYS = ['hp', 'auto', 'def', 'cap', 'rescap', 'spd'];

const genStats = () => {
  const s = { hp: 120, auto: 15, def: 15, cap: 15, rescap: 15, spd: 15 };
  let rem = 35;
  const pool = ['auto', 'def', 'cap', 'rescap', 'spd'];
  if (Math.random() < 0.3) {
    const k = pool[Math.floor(Math.random() * pool.length)];
    const spikeAmount = 5 + Math.floor(Math.random() * 6);
    const actual = Math.min(spikeAmount, 35 - s[k]);
    s[k] += actual;
    rem -= actual;
  }
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

const makeCharacter = (id, level, availableWeaponIds, availablePassiveIds) => {
  const raceName = randomItem(Object.keys(races));
  const className = randomItem(Object.keys(classes));
  const subclassesForClass = getSubclassesForClass(className);
  const subclass = subclassesForClass.length > 0 ? randomItem(subclassesForClass) : null;
  const weaponId = availableWeaponIds.length > 0 ? randomItem(availableWeaponIds) : null;
  const passiveId = availablePassiveIds.length > 0 ? randomItem(availablePassiveIds) : null;
  const raw = genStats();
  const raceBonus = getRaceBonus(raceName);
  const classBonus = getClassBonus(className);
  const levelBoosts = genLevelBoosts(level);
  // Même forme que Firestore / roll perso : stats + bonus race/classe uniquement.
  // L'éveil et la forge sont appliqués par preparerCombattant dans simulerMatch (pas de double éveil).
  const base = {
    hp: raw.hp + raceBonus.hp + classBonus.hp,
    auto: raw.auto + raceBonus.auto + classBonus.auto,
    def: raw.def + raceBonus.def + classBonus.def,
    cap: raw.cap + raceBonus.cap + classBonus.cap,
    rescap: raw.rescap + raceBonus.rescap + classBonus.rescap,
    spd: raw.spd + raceBonus.spd + classBonus.spd
  };
  return {
    id, userId: id, name: id,
    race: raceName, class: className,
    subclass: subclass ? { id: subclass.id, name: subclass.name } : null,
    base, level,
    bonuses: { race: raceBonus, class: classBonus },
    forestBoosts: levelBoosts,
    mageTowerPassive: passiveId ? { id: passiveId, level: getPassiveLevelForCharacterLevel(level) } : null,
    equippedWeaponId: weaponId
  };
};

const makeCustomCharacter = (id, raceName, className, level, weaponId, passiveId, passiveLevel) => {
  const raw = genStats();
  const raceBonus = getRaceBonus(raceName);
  const classBonus = getClassBonus(className);
  const levelBoosts = genLevelBoosts(level);
  const base = {
    hp: raw.hp + raceBonus.hp + classBonus.hp,
    auto: raw.auto + raceBonus.auto + classBonus.auto,
    def: raw.def + raceBonus.def + classBonus.def,
    cap: raw.cap + raceBonus.cap + classBonus.cap,
    rescap: raw.rescap + raceBonus.rescap + classBonus.rescap,
    spd: raw.spd + raceBonus.spd + classBonus.spd
  };
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

const TABS = [
  { id: 'simulation', label: '📊 Simulation', icon: '📊' },
  { id: 'races', label: '🧬 Races', icon: '🧬' },
  { id: 'classes', label: '⚔️ Classes', icon: '⚔️' },
  { id: 'subclasses', label: '🔀 Sous-classes', icon: '🔀' },
  { id: 'weapons', label: '🗡️ Armes', icon: '🗡️' },
  { id: 'passives', label: '🔮 Passifs', icon: '🔮' },
  { id: 'duel', label: '🤺 Duel 1v1', icon: '🤺' },
  { id: 'save', label: '💾 Sauvegarde', icon: '💾' },
];

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

function AdminBalance({ embedded = false }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('simulation');

  // Simulation
  const [duels, setDuels] = useState(500);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [simError, setSimError] = useState('');

  // Sauvegarde
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Drafts d'édition
  const [raceBonusDraft, setRaceBonusDraft] = useState(() => deepClone(raceConstants));
  const [raceAwakeningDraft, setRaceAwakeningDraft] = useState(() => {
    const draft = {};
    Object.entries(races).forEach(([name, info]) => {
      draft[name] = deepClone(info?.awakening?.effect || {});
    });
    return draft;
  });
  const [classDraft, setClassDraft] = useState(() => deepClone(classConstants));
  const [subclassDraft, setSubclassDraft] = useState(() => deepClone(subclassConstants));
  const [weaponDraft, setWeaponDraft] = useState(() => deepClone(weapons));
  const [passiveDraft, setPassiveDraft] = useState(() => deepClone(MAGE_TOWER_PASSIVES));

  const raceTextDraft = useMemo(
    () => buildRaceTextDraft(raceBonusDraft, raceAwakeningDraft),
    [raceBonusDraft, raceAwakeningDraft]
  );
  const classTextDraft = useMemo(
    () => buildClassTextDraft(classDraft),
    [classDraft]
  );

  const availableWeapons = useMemo(() => Object.values(weapons).filter((w) => w.rarete === RARITY.LEGENDAIRE), []);
  const availablePassives = useMemo(() => [...MAGE_TOWER_PASSIVES], []);
  const allSubclassIds = useMemo(() => Object.values(SUBCLASSES_BY_CLASS).flat().map((s) => s.id), []);

  useEffect(() => {
    const loadSavedConfig = async () => {
      const result = await loadPersistedBalanceConfig();
      if (!result.success || !result.data) return;

      setRaceBonusDraft(deepClone(raceConstants));
      setClassDraft(deepClone(classConstants));
      setSubclassDraft(deepClone(subclassConstants));
      setWeaponDraft(deepClone(weapons));
      setPassiveDraft(deepClone(MAGE_TOWER_PASSIVES));

      const loadedAwakeningDraft = {};
      Object.entries(races).forEach(([name, info]) => {
        loadedAwakeningDraft[name] = deepClone(info?.awakening?.effect || {});
      });
      setRaceAwakeningDraft(loadedAwakeningDraft);
    };

    loadSavedConfig();
  }, []);

  // ============================================================================
  // Application temporaire des overrides de draft pour simulation/duel
  // ============================================================================

  const applyDraftToLiveData = useCallback(() => {
    applyNumericOverrides(raceConstants, raceBonusDraft);
    applyNumericOverrides(classConstants, classDraft);
    applyNumericOverrides(subclassConstants, subclassDraft);
    applyNumericOverrides(weapons, weaponDraft);
    syncWeaponConstantsToCombat(weaponDraft);
    passiveDraft.forEach((passive, index) => {
      if (!MAGE_TOWER_PASSIVES[index]) return;
      applyNumericOverrides(MAGE_TOWER_PASSIVES[index], passive);
    });
    Object.entries(raceAwakeningDraft).forEach(([raceName, effectDraft]) => {
      const currentEffect = races?.[raceName]?.awakening?.effect;
      if (!currentEffect || !effectDraft) return;
      applyNumericOverrides(currentEffect, effectDraft);
    });
  }, [raceBonusDraft, classDraft, subclassDraft, weaponDraft, passiveDraft, raceAwakeningDraft]);

  const withTemporaryDraftOverrides = useCallback((callback) => {
    const previousRaceConstants = deepClone(raceConstants);
    const previousClassConstants = deepClone(classConstants);
    const previousSubclassConstants = deepClone(subclassConstants);
    const previousWeapons = deepClone(weapons);
    const previousWeaponConstants = deepClone(weaponConstants);
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

      Object.keys(subclassConstants).forEach((key) => delete subclassConstants[key]);
      Object.assign(subclassConstants, previousSubclassConstants);

      Object.keys(weapons).forEach((key) => delete weapons[key]);
      Object.assign(weapons, previousWeapons);

      Object.keys(weaponConstants).forEach((key) => delete weaponConstants[key]);
      Object.assign(weaponConstants, previousWeaponConstants);

      MAGE_TOWER_PASSIVES.splice(0, MAGE_TOWER_PASSIVES.length, ...previousPassives);

      Object.entries(previousAwakeningEffects).forEach(([name, effect]) => {
        if (!races?.[name]?.awakening) return;
        races[name].awakening.effect = effect;
      });
    }
  }, [applyDraftToLiveData]);

  // ============================================================================
  // Simulation de masse (avec fix crash + spinner)
  // ============================================================================

  const simulateForLevel = useCallback((level, count) => {
    const raceWins = Object.fromEntries(Object.keys(races).map((name) => [name, 0]));
    const classWins = Object.fromEntries(Object.keys(classes).map((name) => [name, 0]));
    const subclassWins = Object.fromEntries(allSubclassIds.map((id) => [id, 0]));
    const weaponWins = Object.fromEntries(availableWeapons.map((w) => [w.id, 0]));
    const passiveWins = Object.fromEntries(availablePassives.map((p) => [p.id, 0]));
    const raceAppearances = Object.fromEntries(Object.keys(races).map((name) => [name, 0]));
    const classAppearances = Object.fromEntries(Object.keys(classes).map((name) => [name, 0]));
    const subclassAppearances = Object.fromEntries(allSubclassIds.map((id) => [id, 0]));
    const weaponAppearances = Object.fromEntries(availableWeapons.map((w) => [w.id, 0]));
    const passiveAppearances = Object.fromEntries(availablePassives.map((p) => [p.id, 0]));

    const availableWeaponIds = availableWeapons.map((w) => w.id);
    const availablePassiveIds = availablePassives.map((p) => p.id);

    for (let i = 0; i < count; i++) {
      let p1, p2;
      try {
        p1 = makeCharacter(`L${level}-A-${i}`, level, availableWeaponIds, availablePassiveIds);
      } catch (e) {
        throw new Error(`[makeCharacter P1] i=${i}: ${e.message}`);
      }
      try {
        p2 = makeCharacter(`L${level}-B-${i}`, level, availableWeaponIds, availablePassiveIds);
      } catch (e) {
        throw new Error(`[makeCharacter P2] i=${i}: ${e.message}`);
      }

      raceAppearances[p1.race] += 1;
      raceAppearances[p2.race] += 1;
      classAppearances[p1.class] += 1;
      classAppearances[p2.class] += 1;
      if (p1.subclass?.id) subclassAppearances[p1.subclass.id] = (subclassAppearances[p1.subclass.id] || 0) + 1;
      if (p2.subclass?.id) subclassAppearances[p2.subclass.id] = (subclassAppearances[p2.subclass.id] || 0) + 1;
      if (p1.equippedWeaponId) weaponAppearances[p1.equippedWeaponId] = (weaponAppearances[p1.equippedWeaponId] || 0) + 1;
      if (p2.equippedWeaponId) weaponAppearances[p2.equippedWeaponId] = (weaponAppearances[p2.equippedWeaponId] || 0) + 1;
      if (p1.mageTowerPassive?.id) passiveAppearances[p1.mageTowerPassive.id] = (passiveAppearances[p1.mageTowerPassive.id] || 0) + 1;
      if (p2.mageTowerPassive?.id) passiveAppearances[p2.mageTowerPassive.id] = (passiveAppearances[p2.mageTowerPassive.id] || 0) + 1;

      let match;
      try {
        match = simulerMatch(p1, p2);
      } catch (e) {
        throw new Error(`[simulerMatch] i=${i} ${p1.race}/${p1.class}${p1.subclass ? '/' + p1.subclass.id : ''} vs ${p2.race}/${p2.class}${p2.subclass ? '/' + p2.subclass.id : ''} armes=${p1.equippedWeaponId}/${p2.equippedWeaponId}: ${e.message}`);
      }
      const winner = match.winnerId === p1.userId ? p1 : p2;
      raceWins[winner.race] += 1;
      classWins[winner.class] += 1;
      if (winner.subclass?.id) subclassWins[winner.subclass.id] = (subclassWins[winner.subclass.id] || 0) + 1;
      if (winner.equippedWeaponId) weaponWins[winner.equippedWeaponId] = (weaponWins[winner.equippedWeaponId] || 0) + 1;
      if (winner.mageTowerPassive?.id) passiveWins[winner.mageTowerPassive.id] = (passiveWins[winner.mageTowerPassive.id] || 0) + 1;
    }

    const sortByRate = (entries, appearances) =>
      Object.entries(entries)
        .map(([key, wins]) => {
          const app = appearances[key] || 0;
          const rate = app > 0 ? (wins / app) * 100 : 0;
          return { key, wins, appearances: app, rate: rate.toFixed(1) };
        })
        .sort((a, b) => Number(b.rate) - Number(a.rate));

    return {
      sortedRaces: sortByRate(raceWins, raceAppearances).map(r => ({ race: r.key, ...r })),
      sortedClasses: sortByRate(classWins, classAppearances).map(r => ({ clazz: r.key, ...r })),
      sortedSubclasses: allSubclassIds
        .map((id) => {
          const wins = subclassWins[id] || 0;
          const app = subclassAppearances[id] || 0;
          const rate = app > 0 ? (wins / app) * 100 : 0;
          return { subclassId: id, wins, appearances: app, rate: rate.toFixed(1) };
        })
        .sort((a, b) => Number(b.rate) - Number(a.rate)),
      sortedWeapons: sortByRate(weaponWins, weaponAppearances).map(r => ({ weaponId: r.key, ...r })),
      sortedPassives: sortByRate(passiveWins, passiveAppearances).map(r => ({ passiveId: r.key, ...r })),
    };
  }, [allSubclassIds, availableWeapons, availablePassives]);

  const handleRun = async () => {
    const duelCount = Math.max(10, Number(duels) || 10);
    setRunning(true);
    setSimError('');

    // Laisser le temps au navigateur de peindre le state "en cours"
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      withTemporaryDraftOverrides(() => {
        const level1 = simulateForLevel(1, duelCount);
        const level100 = simulateForLevel(100, duelCount);
        const level400 = simulateForLevel(400, duelCount);
        setResults({ duelCount, level1, level100, level400 });
      });
    } catch (err) {
      console.error('Erreur simulation:', err);
      setSimError(`${err.message}\n\nStack: ${err.stack?.split('\n').slice(0, 5).join('\n') || 'N/A'}`);
    } finally {
      setRunning(false);
    }
  };

  // ============================================================================
  // Sauvegarde
  // ============================================================================

  const handleApplyChanges = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const config = {
        raceConstants: deepClone(raceBonusDraft),
        classConstants: deepClone(classDraft),
        subclassConstants: deepClone(subclassDraft),
        weaponConstants: deepClone(weaponDraft),
        mageTowerPassives: deepClone(passiveDraft),
        raceAwakenings: deepClone(raceAwakeningDraft),
        raceTexts: deepClone(raceTextDraft),
        classTexts: deepClone(classTextDraft)
      };
      const saveResult = await savePersistedBalanceConfig({ config, updatedBy: 'admin' });
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

  const handleForceSyncFromCode = async () => {
    setSyncMessage('');
    setSyncing(true);
    try {
      const result = await forceSyncFromCode('admin-forced');
      if (result.success) {
        setSyncMessage('✅ Fichier Storage mis à jour avec les valeurs du code.');
      } else {
        setSyncMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      setSyncMessage(`❌ Erreur: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // ============================================================================
  // Rendu
  // ============================================================================

  const renderTab = () => {
    switch (activeTab) {
      case 'simulation':
        return (
          <BalanceSimulation
            duels={duels} setDuels={setDuels}
            running={running} results={results}
            errorMessage={simError} onRun={handleRun}
          />
        );
      case 'races':
        return (
          <BalanceRaces
            raceBonusDraft={raceBonusDraft} setRaceBonusDraft={setRaceBonusDraft}
            raceAwakeningDraft={raceAwakeningDraft} setRaceAwakeningDraft={setRaceAwakeningDraft}
          />
        );
      case 'classes':
        return (
          <BalanceClasses
            classDraft={classDraft} setClassDraft={setClassDraft}
            classTextDraft={classTextDraft}
          />
        );
      case 'subclasses':
        return (
          <BalanceSubclasses
            subclassDraft={subclassDraft} setSubclassDraft={setSubclassDraft}
          />
        );
      case 'weapons':
        return (
          <BalanceWeapons
            availableWeapons={availableWeapons}
            weaponDraft={weaponDraft} setWeaponDraft={setWeaponDraft}
          />
        );
      case 'passives':
        return (
          <BalancePassives
            passiveDraft={passiveDraft} setPassiveDraft={setPassiveDraft}
          />
        );
      case 'duel':
        return (
          <BalanceDuel withTemporaryDraftOverrides={withTemporaryDraftOverrides} makeCustomCharacter={makeCustomCharacter} />
        );
      case 'save':
        return (
          <BalanceSave
            saving={saving} saveMessage={saveMessage}
            syncing={syncing} syncMessage={syncMessage}
            onApplyChanges={handleApplyChanges}
            onForceSyncFromCode={handleForceSyncFromCode}
          />
        );
      default:
        return null;
    }
  };

  const content = (
    <>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-amber-300">⚖️ Équilibrage</h1>
        {!embedded && (
          <button onClick={() => navigate('/admin')} className="bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded transition-colors">← Retour admin</button>
        )}
      </div>

      {/* Barre d'onglets */}
      <div className="flex flex-wrap gap-1 mb-6 bg-stone-900/50 p-1 rounded-lg border border-stone-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-bold rounded transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-stone-400 hover:text-white hover:bg-stone-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="min-h-[60vh]">
        {renderTab()}
      </div>

      {/* Barre de sauvegarde rapide sticky (sauf sur l'onglet save) */}
      {activeTab !== 'save' && (
        <div className="sticky bottom-0 mt-6 bg-stone-900/95 backdrop-blur border-t border-amber-600/30 p-3 -mx-6 px-6 flex items-center justify-between gap-4">
          <div className="text-xs text-stone-400">
            {saveMessage && <span className="text-green-300">{saveMessage}</span>}
          </div>
          <button
            onClick={handleApplyChanges}
            disabled={saving}
            className="bg-green-600 hover:bg-green-500 disabled:bg-stone-700 text-white px-6 py-2 rounded font-bold text-sm transition-colors whitespace-nowrap"
          >
            {saving ? '⏳ ...' : '💾 Sauvegarder'}
          </button>
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
