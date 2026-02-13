import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { classConstants, raceConstants, getRaceBonus, getClassBonus } from '../data/combatMechanics';
import { getAwakeningEffect, applyAwakeningToBase } from '../utils/awakening';
import { simulerMatch } from '../utils/tournamentCombat';

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
  if (path.length === 0) return obj;
  const [head, ...rest] = path;
  return {
    ...obj,
    [head]: rest.length ? updateNestedValue(obj[head] || {}, rest, value) : value
  };
};

const NumberTreeEditor = ({ value, onChange, path = [] }) => {
  return (
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
};

const genStats = () => ({
  hp: 120 + Math.floor(Math.random() * 81),
  auto: 15 + Math.floor(Math.random() * 21),
  def: 15 + Math.floor(Math.random() * 21),
  cap: 15 + Math.floor(Math.random() * 21),
  rescap: 15 + Math.floor(Math.random() * 21),
  spd: 15 + Math.floor(Math.random() * 21)
});

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

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

  const [raceDraft, setRaceDraft] = useState(() => deepClone(raceConstants));
  const [classDraft, setClassDraft] = useState(() => deepClone(classConstants));

  const raceCards = useMemo(() => Object.entries(races), []);
  const classCards = useMemo(() => Object.entries(classes), []);

  const simulateForLevel = (level, count) => {
    const raceWins = Object.fromEntries(Object.keys(races).map((name) => [name, 0]));
    const classWins = Object.fromEntries(Object.keys(classes).map((name) => [name, 0]));

    for (let i = 0; i < count; i++) {
      const p1 = makeCharacter(`L${level}-A-${i}`, level);
      const p2 = makeCharacter(`L${level}-B-${i}`, level);
      const match = simulerMatch(p1, p2);
      const winner = match.winnerId === p1.userId ? p1 : p2;
      raceWins[winner.race] += 1;
      classWins[winner.class] += 1;
    }

    const sortedRaces = Object.entries(raceWins)
      .map(([race, wins]) => ({ race, wins, rate: ((wins / count) * 100).toFixed(1) }))
      .sort((a, b) => Number(b.rate) - Number(a.rate));

    const sortedClasses = Object.entries(classWins)
      .map(([clazz, wins]) => ({ clazz, wins, rate: ((wins / count) * 100).toFixed(1) }))
      .sort((a, b) => Number(b.rate) - Number(a.rate));

    return { sortedRaces, sortedClasses };
  };

  const handleRun = async () => {
    const duelCount = Math.max(10, Number(duels) || 10);
    setRunning(true);

    const previousRaceConstants = deepClone(raceConstants);
    const previousClassConstants = deepClone(classConstants);

    try {
      applyNumericOverrides(raceConstants, raceDraft);
      applyNumericOverrides(classConstants, classDraft);

      const level1 = simulateForLevel(1, duelCount);
      const level100 = simulateForLevel(100, duelCount);
      setResults({ duelCount, level1, level100 });
    } finally {
      Object.keys(raceConstants).forEach((key) => delete raceConstants[key]);
      Object.assign(raceConstants, previousRaceConstants);
      Object.keys(classConstants).forEach((key) => delete classConstants[key]);
      Object.assign(classConstants, previousClassConstants);
      setRunning(false);
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
          <div className="flex gap-3">
            <input type="number" min="10" value={duels} onChange={(e) => setDuels(e.target.value)} className="px-3 py-2 bg-stone-800 border border-stone-600 text-white w-40" />
            <button onClick={handleRun} disabled={running} className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white px-4 py-2 font-bold">
              {running ? '⏳ Simulation...' : '▶️ Lancer simulation niv 1 + niv 100'}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-stone-900/70 border border-stone-600 p-4">
            <h2 className="text-xl text-amber-300 font-bold mb-3">Races (description + valeurs modifiables)</h2>
            <div className="space-y-3 max-h-[70vh] overflow-auto pr-2">
              {raceCards.map(([name, info]) => {
                const constantKey = RACE_TO_CONSTANT_KEY[name];
                if (!constantKey || !raceDraft[constantKey]) return null;
                return (
                  <div key={name} className="bg-stone-950/70 border border-stone-700 p-3">
                    <div className="font-bold text-white mb-1">{info.icon} {name}</div>
                    <div className="text-xs text-stone-300 mb-1">Bonus: {info.bonus}</div>
                    <div className="text-xs text-emerald-300 whitespace-pre-line mb-2">Awakening: {info.awakening?.description}</div>
                    <NumberTreeEditor
                      value={raceDraft[constantKey]}
                      onChange={(path, value) => {
                        setRaceDraft((prev) => ({ ...prev, [constantKey]: updateNestedValue(prev[constantKey], path, value) }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-stone-900/70 border border-stone-600 p-4">
            <h2 className="text-xl text-amber-300 font-bold mb-3">Classes (description + valeurs modifiables)</h2>
            <div className="space-y-3 max-h-[70vh] overflow-auto pr-2">
              {classCards.map(([name, info]) => {
                const constantKey = CLASS_TO_CONSTANT_KEY[name];
                if (!constantKey || !classDraft[constantKey]) return null;
                return (
                  <div key={name} className="bg-stone-950/70 border border-stone-700 p-3">
                    <div className="font-bold text-white mb-1">{info.icon} {name}</div>
                    <div className="text-xs text-amber-300 mb-2">{info.ability} — {info.description}</div>
                    <NumberTreeEditor
                      value={classDraft[constantKey]}
                      onChange={(path, value) => {
                        setClassDraft((prev) => ({ ...prev, [constantKey]: updateNestedValue(prev[constantKey], path, value) }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
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
                          <span>{row.rate}%</span>
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
                          <span>{row.rate}%</span>
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
