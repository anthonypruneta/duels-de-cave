import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveCharacter, getUserCharacter, canCreateCharacter } from '../services/characterService';
import Header from './Header';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { normalizeCharacterBonuses } from '../utils/characterBonuses';
import { classConstants, raceConstants, tiers15, getRaceBonus, getClassBonus } from '../data/combatMechanics';

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

const CharacterCreation = () => {
  const [loading, setLoading] = useState(true);
  const [existingCharacter, setExistingCharacter] = useState(null);
  const [canCreate, setCanCreate] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [step, setStep] = useState(1); // 1 = roll race/classe, 2 = nom/sexe/mot-clé
  const [rolledCharacter, setRolledCharacter] = useState(null); // Personnage rollé (avec race, classe, stats)
  const [formData, setFormData] = useState({ name: '', gender: '', keyword: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Calculer la description réelle basée sur les stats du personnage (retourne JSX)
  // Utilise les constantes centralisées de combatMechanics.js
  const getCalculatedDescription = (className, cap, auto) => {
    const paliers = tiers15(cap);

    switch(className) {
      case 'Guerrier': {
        const { ignoreBase, ignorePerTier, autoBonus } = classConstants.guerrier;
        const ignoreBasePct = Math.round(ignoreBase * 100);
        const ignoreBonusPct = Math.round(ignorePerTier * 100) * paliers;
        const ignoreTotalPct = ignoreBasePct + ignoreBonusPct;
        return (
          <>
            +{autoBonus} Auto | Frappe résistance faible & ignore{' '}
            {ignoreBonusPct > 0 ? (
              <Tooltip content={`Base: ${ignoreBasePct}% | Bonus (${paliers} paliers): +${ignoreBonusPct}%`}>
                <span className="text-green-400">{ignoreTotalPct}%</span>
              </Tooltip>
            ) : (
              <span>{ignoreBasePct}%</span>
            )}
          </>
        );
      }

      case 'Voleur': {
        const { spdBonus, critPerTier } = classConstants.voleur;
        const critBonusPct = Math.round(critPerTier * 100) * paliers;
        return (
          <>
            +{spdBonus} VIT | Esquive 1 coup
            {critBonusPct > 0 && (
              <Tooltip content={`Bonus (${paliers} paliers): +${critBonusPct}%`}>
                <span className="text-green-400"> | +{critBonusPct}% crit</span>
              </Tooltip>
            )}
          </>
        );
      }

      case 'Paladin': {
        const { reflectBase, reflectPerTier } = classConstants.paladin;
        const reflectBasePct = Math.round(reflectBase * 100);
        const reflectBonusPct = Math.round(reflectPerTier * 100) * paliers;
        const reflectTotalPct = reflectBasePct + reflectBonusPct;
        return (
          <>
            Renvoie{' '}
            {reflectBonusPct > 0 ? (
              <Tooltip content={`Base: ${reflectBasePct}% | Bonus (${paliers} paliers): +${reflectBonusPct}%`}>
                <span className="text-green-400">{reflectTotalPct}%</span>
              </Tooltip>
            ) : (
              <span>{reflectBasePct}%</span>
            )}
            {' '}des dégâts reçus
          </>
        );
      }

      case 'Healer': {
        const { missingHpPercent, capBase, capPerTier } = classConstants.healer;
        const missingPct = Math.round(missingHpPercent * 100);
        const healBasePct = Math.round(capBase * 100);
        const healBonusPct = Math.round(capPerTier * 100) * paliers;
        const healTotalPct = healBasePct + healBonusPct;
        return (
          <>
            Heal {missingPct}% PV manquants +{' '}
            {healBonusPct > 0 ? (
              <Tooltip content={`Base: ${healBasePct}% | Bonus (${paliers} paliers): +${healBonusPct}%`}>
                <span className="text-green-400">{healTotalPct}%</span>
              </Tooltip>
            ) : (
              <span>{healBasePct}%</span>
            )}
            {' '}× Cap
          </>
        );
      }

      case 'Archer': {
        const { arrowsBase, arrowsPerTier } = classConstants.archer;
        const arrowsBonus = arrowsPerTier * paliers;
        const arrowsTotal = arrowsBase + arrowsBonus;
        return (
          <>
            {arrowsBonus > 0 ? (
              <Tooltip content={`Base: ${arrowsBase} | Bonus (${paliers} paliers): +${arrowsBonus}`}>
                <span className="text-green-400">{arrowsTotal}</span>
              </Tooltip>
            ) : (
              <span>{arrowsBase}</span>
            )}
            {' '}tirs simultanés
          </>
        );
      }

      case 'Mage': {
        const { capBase, capPerTier } = classConstants.mage;
        const magicBasePct = Math.round(capBase * 100);
        const magicBonusPct = Math.round(capPerTier * 100) * paliers;
        const magicTotalPct = magicBasePct + magicBonusPct;
        const magicDmgTotal = Math.round(cap * (magicTotalPct / 100));
        return (
          <>
            Dégâts = Auto +{' '}
            {magicBonusPct > 0 ? (
              <Tooltip content={`${magicTotalPct}% de Cap (${cap}) | Base: ${magicBasePct}% | Bonus (${paliers} paliers): +${magicBonusPct}%`}>
                <span className="text-green-400">{magicDmgTotal}</span>
              </Tooltip>
            ) : (
              <span>{magicDmgTotal}</span>
            )}
            {' '}dégâts magiques (vs ResC)
          </>
        );
      }

      case 'Demoniste': {
        const { capBase, capPerTier, ignoreResist } = classConstants.demoniste;
        const familierBasePct = Math.round(capBase * 100);
        const familierBonusPct = Math.round(capPerTier * 100) * paliers;
        const familierTotalPct = familierBasePct + familierBonusPct;
        const familierDmgTotal = Math.round(cap * (familierTotalPct / 100));
        const ignoreResPct = Math.round(ignoreResist * 100);
        return (
          <>
            Chaque tour:{' '}
            {familierBonusPct > 0 ? (
              <Tooltip content={`${familierTotalPct}% de Cap (${cap}) | Base: ${familierBasePct}% | Bonus (${paliers} paliers): +${familierBonusPct}% | Ignore ${ignoreResPct}% ResC`}>
                <span className="text-green-400">{familierDmgTotal}</span>
              </Tooltip>
            ) : (
              <span>{familierDmgTotal}</span>
            )}
            {' '}dégâts (ignore {ignoreResPct}% ResC)
          </>
        );
      }

      case 'Masochiste': {
        const { returnBase, returnPerTier, healPercent } = classConstants.masochiste;
        const returnBasePct = Math.round(returnBase * 100);
        const returnBonusPct = Math.round(returnPerTier * 100) * paliers;
        const returnTotalPct = returnBasePct + returnBonusPct;
        const healPct = Math.round(healPercent * 100);
        return (
          <>
            Renvoie{' '}
            {returnBonusPct > 0 ? (
              <Tooltip content={`Base: ${returnBasePct}% | Bonus (${paliers} paliers): +${returnBonusPct}%`}>
                <span className="text-green-400">{returnTotalPct}%</span>
              </Tooltip>
            ) : (
              <span>{returnBasePct}%</span>
            )}
            {' '}des dégâts accumulés & heal {healPct}%
          </>
        );
      }

      default:
        return classes[className]?.description || '';
    }
  };

  // Charger le personnage existant au montage
  useEffect(() => {
    const loadCharacter = async () => {
      if (!currentUser) return;

      setLoading(true);
      const { success, data } = await getUserCharacter(currentUser.uid);

      if (success && data) {
        setExistingCharacter(normalizeCharacterBonuses(data));
        setCanCreate(false);
      } else {
        // Vérifier si l'utilisateur peut créer un personnage
        const canCreateResult = await canCreateCharacter(currentUser.uid);
        setCanCreate(canCreateResult.canCreate);
        if (!canCreateResult.canCreate && canCreateResult.daysRemaining) {
          setDaysRemaining(canCreateResult.daysRemaining);
        }
      }

      setLoading(false);
    };

    loadCharacter();
  }, [currentUser]);

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

      // 1 point = +3 HP (max 150) ou +1 autre stat (max 35)
      if (k === 'hp') {
        if (s.hp + 3 <= 200) { s.hp += 3; rem--; }
        // Si HP au max, on continue (pas de break)
      } else {
        if (s[k] + 1 <= 35) { s[k]++; rem--; }
        // Si stat au max, on continue (pas de break)
      }
    }

    return s;
  };

  // Utilise les fonctions centralisées de combatMechanics.js
  const raceBonus = (race) => getRaceBonus(race);
  const classBonus = (clazz) => getClassBonus(clazz);

  // Roll aléatoire de race/classe/stats (étape 1)
  const rollCharacter = () => {
    const raceKeys = Object.keys(races);
    const classKeys = Object.keys(classes);
    const race = raceKeys[Math.floor(Math.random()*raceKeys.length)];
    const charClass = classKeys[Math.floor(Math.random()*classKeys.length)];
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
    setRolledCharacter({ race, class: charClass, base, bonuses: {race:rB,class:cB} });
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
      bonuses: rolledCharacter.bonuses
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

    setIsSubmitting(true);
    try {
      const newChar = generateCharacter(formData.name.trim(), formData.gender, formData.keyword.trim());

      // Sauvegarder dans Firestore
      const result = await saveCharacter(currentUser.uid, newChar);

      if (result.success) {
        setExistingCharacter(newChar);
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

  // Chargement
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  // Afficher le personnage existant
  if (existingCharacter) {
    const totalBonus = (k) => (existingCharacter.bonuses.race[k]||0) + (existingCharacter.bonuses.class[k]||0);

    return (
      <div className="min-h-screen p-6">
        <Header />
        <div className="max-w-4xl mx-auto pt-20">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-stone-800 border border-stone-600 px-8 py-3">
              <h2 className="text-4xl font-bold text-stone-200">Mon Personnage</h2>
            </div>
          </div>

          <div className="relative max-w-md mx-auto" style={{width:'340px'}}>
            <div className="shadow-2xl">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-800 text-amber-200 px-5 py-1 text-xs font-bold shadow-lg z-10 border border-stone-600">
                {existingCharacter.race} • {existingCharacter.class}
              </div>
              <div className="overflow-hidden">
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
                      <div>HP : {existingCharacter.base.hp}{totalBonus('hp')>0&&<span className="text-green-400 ml-1">(+{totalBonus('hp')})</span>}</div>
                      <div>VIT : {existingCharacter.base.spd}{totalBonus('spd')>0&&<span className="text-green-400 ml-1">(+{totalBonus('spd')})</span>}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 mb-3 text-xs text-gray-300">
                      <div>Auto : <span className="text-white font-bold">{existingCharacter.base.auto}</span>{totalBonus('auto')>0&&<span className="text-green-400 ml-1">(+{totalBonus('auto')})</span>}</div>
                      <div>Déf : <span className="text-white font-bold">{existingCharacter.base.def}</span>{totalBonus('def')>0&&<span className="text-green-400 ml-1">(+{totalBonus('def')})</span>}</div>
                      <div>Cap : <span className="text-white font-bold">{existingCharacter.base.cap}</span>{totalBonus('cap')>0&&<span className="text-green-400 ml-1">(+{totalBonus('cap')})</span>}</div>
                      <div>ResC : <span className="text-white font-bold">{existingCharacter.base.rescap}</span>{totalBonus('rescap')>0&&<span className="text-green-400 ml-1">(+{totalBonus('rescap')})</span>}</div>
                    </div>
                  </div>
                </div>
              </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-start gap-2 bg-stone-800/90 p-3 border border-stone-600">
                <span className="text-2xl">{races[existingCharacter.race].icon}</span>
                <div>
                  <div className="text-amber-200 font-bold mb-1">Race: {existingCharacter.race}</div>
                  <div className="text-stone-400 text-xs">{races[existingCharacter.race].bonus}</div>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-stone-800/90 p-3 border border-stone-600">
                <span className="text-2xl">{classes[existingCharacter.class].icon}</span>
                <div>
                  <div className="text-amber-200 font-bold mb-1">{existingCharacter.class}: {classes[existingCharacter.class].ability}</div>
                  <div className="text-stone-400 text-xs">{getCalculatedDescription(existingCharacter.class, existingCharacter.base.cap, existingCharacter.base.auto)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => navigate('/combat')}
              className="bg-stone-100 hover:bg-white text-stone-900 px-12 py-4 font-bold text-xl shadow-2xl border-2 border-stone-400 hover:border-stone-600 transition-all"
            >
              ⚔️ Aller au Combat ⚔️
            </button>
            <button
              onClick={() => navigate('/dungeon')}
              className="bg-amber-600 hover:bg-amber-700 text-white px-12 py-4 font-bold text-xl shadow-2xl border-2 border-amber-500 hover:border-amber-400 transition-all"
            >
              🏰 Donjon 🏰
            </button>
          </div>

          <div className="mt-6 bg-stone-800 border border-amber-600/50 px-6 py-4 max-w-lg mx-auto rounded-lg">
            <p className="text-amber-200 text-base text-center font-medium">
              ℹ️ Nouveau personnage disponible lundi prochain
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Message si l'utilisateur ne peut pas créer de personnage (< 7 jours)
  if (!canCreate) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Header />
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
      </div>
    );
  }

  // Formulaire de création - Étape 1: Roll Race/Classe
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Header />
        <div className="max-w-4xl w-full pt-20">
          <div className="text-center mb-8">
            <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block">
              <h2 className="text-5xl font-bold mb-3 text-amber-400">🎲 Étape 1: Roll ton Personnage</h2>
              <p className="text-amber-300 text-lg">Lance les dés et découvre ta race et ta classe!</p>
            </div>
          </div>

          {!rolledCharacter ? (
            /* Avant le roll: gros bouton central */
            <div className="max-w-2xl mx-auto">
              <div className="bg-stone-800/90 rounded-2xl p-12 border-4 border-amber-600 shadow-2xl text-center">
                <div className="text-8xl mb-8">🎲</div>
                <button
                  onClick={rollCharacter}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 px-8 py-6 rounded-lg font-bold text-2xl shadow-lg border-2 border-amber-400 transition-all transform hover:scale-105"
                >
                  🎲 ROLL MON PERSONNAGE 🎲
                </button>
                <p className="text-gray-400 mt-4 text-sm">Race et classe seront générées aléatoirement</p>
              </div>

              {/* Info races et classes */}
              <div className="mt-8 grid md:grid-cols-2 gap-6">
                <div className="bg-stone-800/50 rounded-xl p-6 border-2 border-amber-600">
                  <h3 className="text-2xl font-bold text-amber-400 mb-4 text-center">🎭 8 Races</h3>
                  <div className="space-y-2">
                    {Object.entries(races).map(([name, info]) => (
                      <div key={name} className="bg-stone-900/50 rounded-lg p-3 border border-stone-700">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{info.icon}</span>
                          <span className="text-white font-bold">{name}</span>
                        </div>
                        <p className="text-xs text-gray-400 ml-8">{info.bonus}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-stone-800/50 rounded-xl p-6 border-2 border-amber-600">
                  <h3 className="text-2xl font-bold text-amber-400 mb-4 text-center">⚔️ 8 Classes</h3>
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
                  <p className="text-gray-300 text-sm">{races[rolledCharacter.race].bonus}</p>
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

                {/* Boutons */}
                <div className="flex gap-4">
                  <button
                    onClick={rollCharacter}
                    className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-4 rounded-lg font-bold text-lg shadow-lg border-2 border-gray-500 transition-all"
                  >
                    🎲 Re-roll
                  </button>
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
        </div>
      </div>
    );
  }

  // Formulaire de création - Étape 2: Nom/Sexe/Mot-clé
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Header />
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
      </div>
    </div>
  );
};

export default CharacterCreation;
