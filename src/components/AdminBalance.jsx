import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { classConstants, raceConstants, getRaceBonus, getClassBonus } from '../data/combatMechanics';
import { getAwakeningEffect, applyAwakeningToBase } from '../utils/awakening';
import { simulerMatch } from '../utils/tournamentCombat';
import { applyBalanceConfig, loadPersistedBalanceConfig, savePersistedBalanceConfig } from '../services/balanceConfigService';

const RACE_TO_CONSTANT_KEY = {
  'Humain': 'humain',
  'Elfe': 'elfe',
  'Orc': 'orc',
  'Nain': 'nain',
  'Dragonkin': 'dragonkin',
  'Mort-vivant': 'mortVivant',
  'Lycan': 'lycan',
  'Sylvari': 'sylvari',
  'Sirène': 'sirene',
  'Gnome': 'gnome',
  'Mindflayer': 'mindflayer'
};

const CLASS_TO_CONSTANT_KEY = {
  'Guerrier': 'guerrier',
  'Voleur': 'voleur',
  'Paladin': 'paladin',
  'Healer': 'healer',
  'Archer': 'archer',
  'Mage': 'mage',
  'Demoniste': 'demoniste',
  'Masochiste': 'masochiste',
  'Briseur de Sort': 'briseurSort',
  'Succube': 'succube',
  'Bastion': 'bastion'
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));
const pct = (v, digits = 0) => `${(Number(v || 0) * 100).toFixed(digits)}%`;

const applyNumericOverrides = (target, source) => {
  Object.entries(source).forEach(([key, val]) => {
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

const genStats = () => ({
  hp: 120 + Math.floor(Math.random() * 81),
  auto: 15 + Math.floor(Math.random() * 21),
  def: 15 + Math.floor(Math.random() * 21),
  cap: 15 + Math.floor(Math.random() * 21),
  rescap: 15 + Math.floor(Math.random() * 21),
  spd: 15 + Math.floor(Math.random() * 21)
});

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const buildRaceBonusDescription = (raceName, constants) => {
  switch (raceName) {
    case 'Humain': return `+${constants.hp || 0} PV & +${constants.auto || 0} toutes stats`;
    case 'Elfe': return `+${constants.auto || 0} AUTO, +${constants.cap || 0} CAP, +${constants.spd || 0} VIT, +${pct(constants.critBonus, 0)} crit`;
    case 'Orc': return `Sous ${(Number(constants.lowHpThreshold || 0) * 100).toFixed(0)}% PV: +${((Number(constants.damageBonus || 1) - 1) * 100).toFixed(0)}% dégâts`;
    case 'Nain': return `+${constants.hp || 0} PV & +${constants.def || 0} Déf`;
    case 'Dragonkin': return `+${constants.hp || 0} PV & +${constants.rescap || 0} ResC`;
    case 'Mort-vivant': return `Revient à ${pct(constants.revivePercent, 0)} PV (1x)`;
    case 'Lycan': return `Attaque inflige saignement +${constants.bleedPerHit || 0} de dégât/tour`;
    case 'Sylvari': return `Regen ${pct(constants.regenPercent, 1)} PV max/tour`;
    case 'Sirène': return `+${constants.cap || 0} CAP, subit un spell: +${pct(constants.stackBonus, 0)} dégâts/soins des capacités (max ${constants.maxStacks || 0} stacks)`;
    case 'Gnome': return `+${constants.spd || 0} VIT, +${constants.cap || 0} CAP, VIT > cible: +${pct(constants.critIfFaster, 0)} crit, VIT < cible: +${pct(constants.dodgeIfSlower, 0)} esquive, égalité: +${pct(constants.critIfEqual, 0)}/${pct(constants.dodgeIfEqual, 0)} crit/esquive`;
    case 'Mindflayer': return `Vole et relance le premier sort lancé par l'ennemi et ajoute ${pct(constants.stealSpellCapDamageScale, 0)} de votre CAP aux dégâts`;
    default: return races[raceName]?.bonus || '';
  }
};

const buildRaceAwakeningDescription = (raceName, effect) => {
  switch (raceName) {
    case 'Humain': return `+${pct((effect?.statMultipliers?.hp || 1) - 1, 0)} à toutes les stats`;
    case 'Elfe': return `+${pct((effect?.statMultipliers?.auto || 1) - 1, 0)} Auto, +${pct((effect?.statMultipliers?.cap || 1) - 1, 0)} Cap, +${effect?.statBonuses?.spd || 0} VIT, +${pct(effect?.critChanceBonus, 0)} crit, +${pct(effect?.critDamageBonus, 0)} dégâts crit`;
    case 'Orc': return `- Sous 50% PV: +22% dégâts\n- Les ${effect?.incomingHitCount || 0} premières attaques subies infligent ${(Number(effect?.incomingHitMultiplier || 1) * 100).toFixed(0)}% dégâts`;
    case 'Nain': return `+${pct((effect?.statMultipliers?.hp || 1) - 1, 0)} PV max, +${pct((effect?.statMultipliers?.def || 1) - 1, 0)} Déf`;
    case 'Dragonkin': return `+${pct((effect?.statMultipliers?.hp || 1) - 1, 0)} PV max, +${pct((effect?.statMultipliers?.rescap || 1) - 1, 0)} ResC, +${pct(effect?.damageStackBonus, 0)} dégâts infligés par dégât reçu`;
    case 'Mort-vivant': return `Première mort: explosion ${pct(effect?.explosionPercent, 0)} PV max + résurrection ${pct(effect?.revivePercent, 0)} PV max`;
    case 'Lycan': return `Chaque auto: +${effect?.bleedStacksPerHit || 0} stack de saignement (${pct(effect?.bleedPercentPerStack, 1)} PV max par tour)`;
    case 'Sylvari': return `Regen ${pct(effect?.regenPercent, 1)} PV max/tour, +${pct(effect?.highHpDamageBonus, 0)} dégâts si PV > ${(Number(effect?.highHpThreshold || 0) * 100).toFixed(0)}%`;
    case 'Sirène': return `+${effect?.statBonuses?.cap || 0} CAP, stacks à +${pct(effect?.sireneStackBonus, 0)} dégâts/soins des capacités (max ${effect?.sireneMaxStacks || 0})`;
    case 'Gnome': return `+${pct((effect?.statMultipliers?.spd || 1) - 1, 0)} VIT, +${pct((effect?.statMultipliers?.cap || 1) - 1, 0)} CAP, VIT > cible: +${pct(effect?.speedDuelCritHigh, 0)} crit, VIT < cible: +${pct(effect?.speedDuelDodgeLow, 0)} esquive, égalité: +${pct(effect?.speedDuelEqualCrit, 0)}/${pct(effect?.speedDuelEqualDodge, 0)} crit/esquive`;
    case 'Mindflayer': return `Vole et relance le premier sort lancé par l'ennemi et ajoute ${pct(effect?.mindflayerStealSpellCapDamageScale, 0)} de votre CAP aux dégâts\nVotre sort a -${effect?.mindflayerOwnCooldownReductionTurns || 0} de CD`;
    default: return races[raceName]?.awakening?.description || '';
  }
};

const buildClassDescription = (className, constants) => {
  switch (className) {
    case 'Guerrier': return `Frappe la résistance la plus faible. Ignore ${(constants.ignoreBase || 0) * 100}% de la résistance ennemie + ${(constants.ignorePerCap || 0) * 100}% de votre Cap. Gagne +${constants.autoBonus || 0} ATK.`;
    case 'Voleur': return `Esquive la prochaine attaque. Gagne +${constants.spdBonus || 0} VIT et +${((constants.critPerCap || 0) * 100).toFixed(1)}% de votre Cap en chance de critique.`;
    case 'Paladin': return `Renvoie ${(constants.reflectBase || 0) * 100}% des dégâts reçus + ${(constants.reflectPerCap || 0) * 100}% de votre Cap.`;
    case 'Healer': return `Soigne ${(constants.missingHpPercent || 0) * 100}% des PV manquants + ${(constants.capScale || 0) * 100}% de votre Cap.`;
    case 'Archer': return `Deux tirs : le premier inflige 100% de votre attaque. Le second inflige ${(constants.hit2AutoMultiplier || 0) * 100}% de votre attaque + ${(constants.hit2CapMultiplier || 0) * 100}% de votre Cap (opposé à la RésCap).`;
    case 'Mage': return `Inflige votre attaque de base + ${(constants.capBase || 0) * 100}% de votre Cap (vs RésCap).`;
    case 'Demoniste': return `Chaque tour, votre familier inflige ${(constants.capBase || 0) * 100}% de votre Cap et ignore ${(constants.ignoreResist || 0) * 100}% de la RésCap ennemie. Chaque auto augmente ces dégâts de ${(constants.stackPerAuto || 0) * 100}% de Cap (cumulable).`;
    case 'Masochiste': return `Renvoie ${(constants.returnBase || 0) * 100}% des dégâts accumulés + ${(constants.returnPerCap || 0) * 100}% de votre Cap. Se soigne de ${(constants.healPercent || 0) * 100}% des dégâts accumulés.`;
    case 'Briseur de Sort': return `Après avoir subi un spell, gagne un bouclier égal à ${(constants.shieldFromSpellDamage || 0) * 100}% des dégâts reçus + ${(constants.shieldFromCap || 0) * 100}% de votre CAP.`;
    case 'Succube': return `Inflige auto + ${(constants.capScale || 0) * 100}% CAP. La prochaine attaque adverse inflige -${(constants.nextAttackReduction || 0) * 100}% dégâts.`;
    case 'Bastion': return `Passif: +${(constants.defPercentBonus || 0) * 100}% DEF. Inflige auto + ${(constants.capScale || 0) * 100}% CAP + ${(constants.defScale || 0) * 100}% DEF.`;
    default: return classes[className]?.description || '';
  }
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

const makeCharacter = (id, level) => {
  const raceName = randomItem(Object.keys(races));
  const className = randomItem(Object.keys(classes));
  const raw = genStats();
  const raceBonus = getRaceBonus(raceName);
  const classBonus = getClassBonus(className);

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
    forestBoosts: null,
    mageTowerPassive: null,
    equippedWeaponId: null
  };
};

function AdminBalance() {
  const navigate = useNavigate();
  const [duels, setDuels] = useState(500);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [raceTab, setRaceTab] = useState('bonus');

  const [raceBonusDraft, setRaceBonusDraft] = useState(() => deepClone(raceConstants));
  const [raceAwakeningDraft, setRaceAwakeningDraft] = useState(() => {
    const draft = {};
    Object.entries(races).forEach(([name, info]) => {
      draft[name] = deepClone(info?.awakening?.effect || {});
    });
    return draft;
  });
  const [classDraft, setClassDraft] = useState(() => deepClone(classConstants));
  const [raceTextDraft, setRaceTextDraft] = useState(() => buildRaceTextDraft(deepClone(raceConstants), Object.fromEntries(Object.entries(races).map(([name, info]) => [name, deepClone(info?.awakening?.effect || {})]))));
  const [classTextDraft, setClassTextDraft] = useState(() => buildClassTextDraft(deepClone(classConstants)));

  const raceCards = useMemo(() => Object.entries(races), []);
  const classCards = useMemo(() => Object.entries(classes), []);

  useEffect(() => {
    const loadSavedConfig = async () => {
      const result = await loadPersistedBalanceConfig();
      if (!result.success || !result.data) return;

      const loadedRaceBonusDraft = deepClone(raceConstants);
      const loadedClassDraft = deepClone(classConstants);
      const loadedAwakeningDraft = {};
      Object.entries(races).forEach(([name, info]) => {
        loadedAwakeningDraft[name] = deepClone(info?.awakening?.effect || {});
      });

      setRaceBonusDraft(loadedRaceBonusDraft);
      setClassDraft(loadedClassDraft);
      setRaceAwakeningDraft(loadedAwakeningDraft);
      setRaceTextDraft(buildRaceTextDraft(loadedRaceBonusDraft, loadedAwakeningDraft));
      setClassTextDraft(buildClassTextDraft(loadedClassDraft));
    };

    loadSavedConfig();
  }, []);

  const applyDraftToLiveData = () => {
    applyNumericOverrides(raceConstants, raceBonusDraft);
    applyNumericOverrides(classConstants, classDraft);

    Object.entries(raceAwakeningDraft).forEach(([raceName, effectDraft]) => {
      const currentEffect = races?.[raceName]?.awakening?.effect;
      if (!currentEffect || !effectDraft) return;
      applyNumericOverrides(currentEffect, effectDraft);
    });
  };

  const withTemporaryDraftOverrides = (callback) => {
    const previousRaceConstants = deepClone(raceConstants);
    const previousClassConstants = deepClone(classConstants);
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

      Object.entries(previousAwakeningEffects).forEach(([name, effect]) => {
        if (!races?.[name]?.awakening) return;
        races[name].awakening.effect = effect;
      });
    }
  };

  const simulateForLevel = (level, count) => {
    const raceWins = Object.fromEntries(Object.keys(races).map((name) => [name, 0]));
    const classWins = Object.fromEntries(Object.keys(classes).map((name) => [name, 0]));
    const raceAppearances = Object.fromEntries(Object.keys(races).map((name) => [name, 0]));
    const classAppearances = Object.fromEntries(Object.keys(classes).map((name) => [name, 0]));

    for (let i = 0; i < count; i++) {
      const p1 = makeCharacter(`L${level}-A-${i}`, level);
      const p2 = makeCharacter(`L${level}-B-${i}`, level);

      raceAppearances[p1.race] += 1;
      raceAppearances[p2.race] += 1;
      classAppearances[p1.class] += 1;
      classAppearances[p2.class] += 1;

      const match = simulerMatch(p1, p2);
      const winner = match.winnerId === p1.userId ? p1 : p2;
      raceWins[winner.race] += 1;
      classWins[winner.class] += 1;
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

    return { sortedRaces, sortedClasses };
  };

  const handleRun = async () => {
    const duelCount = Math.max(10, Number(duels) || 10);
    setRunning(true);
    setSaveMessage('');

    try {
      withTemporaryDraftOverrides(() => {
        const level1 = simulateForLevel(1, duelCount);
        const level100 = simulateForLevel(100, duelCount);
        setResults({ duelCount, level1, level100 });
      });
    } finally {
      setRunning(false);
    }
  };

  const handleApplyGlobally = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      const config = {
        raceConstants: deepClone(raceBonusDraft),
        classConstants: deepClone(classDraft),
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
      setSaveMessage('✅ Modifications sauvegardées en base et descriptions synchronisées.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-7xl mx-auto pt-20">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-amber-300">⚖️ Équilibrage (Admin)</h1>
          <button onClick={() => navigate('/admin')} className="bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded">← Retour admin</button>
        </div>

        <div className="bg-stone-900/70 border border-amber-600 p-4 mb-6">
          <label className="text-stone-300 text-sm block mb-2">Nombre de duels par niveau (1 et 100)</label>
          <div className="flex gap-3 flex-wrap">
            <input type="number" min="10" value={duels} onChange={(e) => setDuels(e.target.value)} className="px-3 py-2 bg-stone-800 border border-stone-600 text-white w-40" />
            <button onClick={handleRun} disabled={running} className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white px-4 py-2 font-bold">
              {running ? '⏳ Simulation...' : '▶️ Lancer simulation niv 1 + niv 100'}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
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
        </div>

        <div className="bg-stone-900/70 border border-amber-500 rounded-lg p-4 mb-8">
          <button
            onClick={handleApplyGlobally}
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-stone-700 text-white py-3 rounded font-bold"
          >
            {saving ? '⏳ Validation...' : '✅ Valider les modifications (appliquer à tout le jeu)'}
          </button>
          {saveMessage && <p className="text-sm text-green-300 mt-3">{saveMessage}</p>}
        </div>

        {results && (
          <div className="grid lg:grid-cols-2 gap-6">
            {[{ key: 'level1', title: 'Résultats Niveau 1' }, { key: 'level100', title: 'Résultats Niveau 100' }].map(({ key, title }) => (
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminBalance;
