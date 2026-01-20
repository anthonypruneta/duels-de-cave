import React, { useState } from 'react';
import Header from './Header';

const CharacterCreation = () => {
  const [step, setStep] = useState('welcome');
  const [formData, setFormData] = useState({ name: '', gender: '', keyword: '' });
  const [character, setCharacter] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const races = {
    'Humain': { bonus: '+10 PV & +2 toutes stats', icon: '👥' },
    'Elfe': { bonus: 'Si plus rapide: +15% crit (+5 VIT)', icon: '🧝' },
    'Orc': { bonus: 'Sous 50% PV: +20% dégâts', icon: '🪓' },
    'Nain': { bonus: '+10 PV & +5 Déf', icon: '⛏️' },
    'Dragonkin': { bonus: '+10 PV & +10 ResC', icon: '🐲' },
    'Mort-vivant': { bonus: 'Revient à 20% PV (1x)', icon: '☠️' },
    'Lycan': { bonus: 'Auto = Saignement +1 stack', icon: '🐺' },
    'Sylvari': { bonus: 'Regen 3% PV/tour', icon: '🌿' }
  };

  const classes = {
    'Guerrier': { ability: 'Frappe pénétrante', icon: '🗡️', cd: 3 },
    'Voleur': { ability: 'Esquive + Crit', icon: '🌀', cd: 4 },
    'Paladin': { ability: 'Renvoie 30%+ dégâts', icon: '🛡️', cd: 2 },
    'Healer': { ability: 'Soin puissant', icon: '✚', cd: 5 },
    'Archer': { ability: 'Volée 2+ flèches', icon: '🏹', cd: 3 },
    'Mage': { ability: 'Sort magique', icon: '🔮', cd: 3 },
    'Demoniste': { ability: 'Familier', icon: '💠', cd: 1 },
    'Masochiste': { ability: 'Renvoie dégâts', icon: '🩸', cd: 4 }
  };

  const genStats = () => {
    const s = { hp: 120, auto: 15, def: 15, cap: 15, rescap: 15, spd: 15 };
    let rem = 120 - (120 * 0.20 + 75);
    const pool = ['auto', 'def', 'cap', 'rescap', 'spd'];
    const spikeCount = Math.random() < 0.5 ? 2 : 1;
    for (let i = 0; i < spikeCount && rem > 0; i++) {
      const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const target = Math.min(35, s[k] + 8 + Math.floor(Math.random() * 10));
      while (s[k] < target && rem > 0) { s[k]++; rem--; }
    }
    let guard = 10000;
    while (rem > 0 && guard--) {
      const entries = [['hp',1],['auto',3],['def',3],['cap',3],['rescap',3],['spd',3]];
      let tot = entries.reduce((a,[,w])=>a+w,0), r = Math.random()*tot, k='hp';
      for (const [key,w] of entries) { r-=w; if(r<=0){k=key;break;}}
      if (k==='hp' && s.hp+4<=200) {s.hp+=4;rem--;} 
      else if (k!=='hp' && s[k]+1<=35) {s[k]++;rem--;} 
      else break;
    }
    return s;
  };

  const raceBonus = (race) => {
    const b = {hp:0,auto:0,def:0,cap:0,rescap:0,spd:0};
    if (race==='Humain') {b.hp=10;b.auto=2;b.def=2;b.cap=2;b.rescap=2;b.spd=2;}
    else if (race==='Nain') {b.hp=10;b.def=5;}
    else if (race==='Dragonkin') {b.hp=10;b.rescap=10;}
    else if (race==='Elfe') b.spd=5;
    return b;
  };

  const classBonus = (clazz) => {
    const b = {hp:0,auto:0,def:0,cap:0,rescap:0,spd:0};
    if (clazz==='Voleur') b.spd=5;
    if (clazz==='Guerrier') b.auto=3;
    return b;
  };

  const getClassAbilityDetail = (charClass, cap) => {
    const t = Math.floor(cap / 15);
    if (charClass === 'Guerrier') return `Tous les 3 tours : frappe la résistance la plus faible (Déf/ResC) et ignore ${20 + 5 * t}% de cette stat.`;
    if (charClass === 'Voleur') return `Tous les 4 tours : esquive la prochaine attaque. Crit +${5 * t}%/15 Cap.`;
    if (charClass === 'Paladin') return `1 tour sur 2 : renvoie ${30 + 5 * t}% des dégâts reçus (attaque quand même).`;
    if (charClass === 'Healer') return `Tous les 5 tours : soin = 20% PV manquants + ${(25 + 5 * t)}% × Capacité.`;
    if (charClass === 'Archer') return `Tous les 3 tours : volée de ${Math.max(2, 1 + t)} flèches (2 à 15 Cap, +1 par +15 Cap).`;
    if (charClass === 'Mage') return `Tous les 3 tours : sort = Auto + ${(40 + 5 * t)}% × Capacité (dégâts magiques vs ResC).`;
    if (charClass === 'Demoniste') return `Chaque tour : familier inflige ${(10 + 2 * t)}% × Capacité en dégâts de capacité.`;
    if (charClass === 'Masochiste') return `Tous les 4 tours : renvoie ${(10 + 2 * t)}% des dégâts reçus cumulés (puis reset).`;
    return '';
  };

  const generateCharacter = (name, gender, keyword) => {
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
    return { name, race, class: charClass, gender, keyword, base, bonuses: {race:rB,class:cB} };
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
    setIsSubmitting(true);
    try {
      const newChar = generateCharacter(formData.name.trim(), formData.gender, formData.keyword.trim());
      console.log('📤 Données:', { name: newChar.name, gender: newChar.gender, keyword: newChar.keyword, race: newChar.race, class: newChar.class, stats: newChar.base });
      
      // TODO: Envoyer au backend
      // await fetch('/api/characters', { method: 'POST', body: JSON.stringify(newChar) });
      
      await new Promise(r => setTimeout(r, 1500));
      setCharacter(newChar);
      setStep('success');
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

  // Welcome screen
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 flex items-center justify-center p-6">
        <div className="max-w-3xl w-full text-center">
          <div className="w-24 h-24 mx-auto text-amber-400 mb-4 animate-pulse text-6xl">✨</div>
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-transparent bg-clip-text">Duels de Cave</h1>
          <p className="text-2xl text-amber-300 mb-8 font-semibold">Bienvenue, Guerrier !</p>
          <div className="bg-stone-800/80 rounded-2xl p-8 mb-8 border-2 border-amber-600 shadow-2xl">
            <p className="text-lg text-gray-300 mb-6">Combats épiques au tour par tour dans l'arène légendaire.</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-stone-800/50 rounded-lg p-4 border border-amber-600">
                <div className="text-amber-400 font-bold mb-3">🎭 8 Races</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                  {Object.entries(races).map(([n,i])=><div key={n} className="flex items-center gap-1"><span>{i.icon}</span><span>{n}</span></div>)}
                </div>
              </div>
              <div className="bg-stone-800/50 rounded-lg p-4 border border-amber-600">
                <div className="text-amber-400 font-bold mb-3">⚔️ 8 Classes</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                  {Object.entries(classes).map(([n,i])=><div key={n} className="flex items-center gap-1"><span>{i.icon}</span><span>{n}</span></div>)}
                </div>
              </div>
            </div>
            <p className="text-amber-300 text-sm italic">Stats équilibrées (HP: 120-200, Stats: 15-35)</p>
          </div>
          <button onClick={()=>setStep('create')} className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-900 px-12 py-5 rounded-xl font-bold text-xl shadow-2xl border-4 border-amber-400 hover:scale-105 transition-all">
            <span className="flex items-center justify-center gap-3">✨ Créer mon Personnage ✨</span>
          </button>
        </div>
      </div>
    );
  }

  // Success screen
  if (step === 'success') {
    const totalBonus = (k) => (character.bonuses.race[k]||0) + (character.bonuses.class[k]||0);
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-2xl"><span className="text-5xl">✓</span></div>
            <h2 className="text-5xl font-bold mb-4 text-amber-400">Personnage Créé !</h2>
            <p className="text-amber-300 text-lg">Votre héros est prêt</p>
          </div>
          <div className="relative max-w-md mx-auto" style={{width:'340px'}}>
            <div className="bg-gradient-to-br from-amber-100 via-stone-100 to-amber-50 rounded-2xl p-2 shadow-2xl border-4 border-amber-600">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-5 py-1 rounded-full text-xs font-bold shadow-lg border-2 border-amber-700 z-10">{character.race.toLowerCase()} • {character.class.toLowerCase()}</div>
              <div className="border-2 border-amber-400 rounded-xl p-1 bg-white">
                <div className="border border-amber-700 rounded-lg overflow-hidden">
                  <div className="h-96 relative bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 flex items-center justify-center border-b-2 border-amber-700">
                    <div className="text-9xl opacity-20">{races[character.race].icon}</div>
                    <div className="absolute bottom-3 left-3 right-3 bg-black/70 rounded-lg p-3 border border-amber-600">
                      <div className="text-white font-bold text-lg text-center">{character.name}</div>
                      <div className="text-xs text-amber-300 text-center mt-1">{character.gender==='male'?'homme':'femme'} • {character.race.toLowerCase()}/{character.class.toLowerCase()}</div>
                    </div>
                  </div>
                  <div className="bg-stone-800 p-3">
                    <div className="flex justify-between text-xs text-white mb-2 font-bold">
                      <div>HP : {character.base.hp}{totalBonus('hp')>0&&<span className="text-green-400 ml-1">(+{totalBonus('hp')})</span>}</div>
                      <div>VIT : {character.base.spd}{totalBonus('spd')>0&&<span className="text-green-400 ml-1">(+{totalBonus('spd')})</span>}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 mb-3 text-xs text-gray-300">
                      <div>Auto : <span className="text-white font-bold">{character.base.auto}</span>{totalBonus('auto')>0&&<span className="text-green-400 ml-1">(+{totalBonus('auto')})</span>}</div>
                      <div>Déf : <span className="text-white font-bold">{character.base.def}</span>{totalBonus('def')>0&&<span className="text-green-400 ml-1">(+{totalBonus('def')})</span>}</div>
                      <div>Capacité : <span className="text-white font-bold">{character.base.cap}</span>{totalBonus('cap')>0&&<span className="text-green-400 ml-1">(+{totalBonus('cap')})</span>}</div>
                      <div>ResCapacité : <span className="text-white font-bold">{character.base.rescap}</span>{totalBonus('rescap')>0&&<span className="text-green-400 ml-1">(+{totalBonus('rescap')})</span>}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-start gap-2 bg-stone-800/90 rounded-lg p-2 border border-stone-700">
                <span className="text-xl">{races[character.race].icon}</span>
                <div className="text-gray-300 text-xs leading-tight">{races[character.race].bonus}</div>
              </div>
              <div className="flex items-start gap-2 bg-stone-800/90 rounded-lg p-2 border border-stone-700">
                <span className="text-xl">{classes[character.class].icon}</span>
                <div className="text-gray-300 text-xs leading-tight">{getClassAbilityDetail(character.class, character.base.cap)}</div>
              </div>
            </div>
          </div>
          <div className="bg-amber-900/30 rounded-lg p-3 border border-amber-600 mb-6 max-w-md mx-auto mt-6">
            <p className="text-amber-300 text-xs text-center">✅ Données envoyées au back office pour génération Midjourney</p>
            <div className="mt-2 text-xs text-stone-300 text-center">Mot-clé: <span className="text-amber-400 font-bold">{character.keyword}</span></div>
          </div>
          <div className="flex justify-center">
            <button onClick={()=>{setStep('welcome');setFormData({name:'',gender:'',keyword:''});setCharacter(null);setErrors({});}} className="bg-gradient-to-r from-stone-700 to-stone-800 hover:from-stone-800 hover:to-stone-900 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg border-2 border-stone-600 transition-all">Créer un Autre Personnage</button>
          </div>
        </div>
      </div>
    );
  }

  // Creation form
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 flex items-center justify-center p-6">
      <Header />
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-5xl font-bold mb-3 text-amber-400">Création de Personnage</h2>
          <p className="text-amber-300 text-lg">Forgez votre légende...</p>
        </div>
        <div className="bg-stone-800/90 rounded-2xl p-8 border-4 border-amber-600 shadow-2xl">
          <div className="mb-6">
            <label className="flex items-center gap-2 text-amber-400 font-bold mb-3 text-lg">👤 Nom du personnage</label>
            <input type="text" value={formData.name} onChange={(e)=>handleInputChange('name',e.target.value)} placeholder="Ex: Thorgar, Aria..." className={`w-full bg-stone-900 border-2 ${errors.name?'border-red-500':'border-amber-600'} rounded-lg px-4 py-4 text-white text-lg focus:outline-none focus:border-amber-400`} maxLength={20}/>
            {errors.name && <p className="text-red-400 text-sm mt-2">⚠️ {errors.name}</p>}
            <p className="text-gray-500 text-xs mt-2">{formData.name.length}/20 caractères</p>
          </div>
          <div className="mb-6">
            <label className="text-amber-400 font-bold mb-3 text-lg block">Sexe</label>
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={()=>handleInputChange('gender','male')} className={`py-5 px-6 rounded-lg font-bold text-lg transition-all border-2 ${formData.gender==='male'?'bg-amber-600 border-amber-400 text-white shadow-lg scale-105':'bg-stone-900 border-stone-700 text-gray-400 hover:border-amber-600'}`}>
                <span className="text-3xl mb-2 block">👨</span>Homme
              </button>
              <button type="button" onClick={()=>handleInputChange('gender','female')} className={`py-5 px-6 rounded-lg font-bold text-lg transition-all border-2 ${formData.gender==='female'?'bg-pink-600 border-pink-400 text-white shadow-lg scale-105':'bg-stone-900 border-stone-700 text-gray-400 hover:border-pink-600'}`}>
                <span className="text-3xl mb-2 block">👩</span>Femme
              </button>
            </div>
            {errors.gender && <p className="text-red-400 text-sm mt-2">⚠️ {errors.gender}</p>}
          </div>
          <div className="mb-8">
            <label className="flex items-center gap-2 text-amber-400 font-bold mb-3 text-lg">#️⃣ Mot-clé (Midjourney)</label>
            <input type="text" value={formData.keyword} onChange={(e)=>handleInputChange('keyword',e.target.value)} placeholder="Ex: dragon, ombre, feu..." className={`w-full bg-stone-900 border-2 ${errors.keyword?'border-red-500':'border-amber-600'} rounded-lg px-4 py-4 text-white text-lg focus:outline-none focus:border-amber-400`} maxLength={50}/>
            {errors.keyword && <p className="text-red-400 text-sm mt-2">⚠️ {errors.keyword}</p>}
            <p className="text-gray-500 text-xs mt-2">{formData.keyword.length}/50 caractères</p>
          </div>
          {errors.submit && <div className="mb-6 bg-red-900/50 border-2 border-red-500 rounded-lg p-4"><p className="text-red-300 text-center font-bold">{errors.submit}</p></div>}
          <div className="flex gap-4">
            <button onClick={()=>setStep('welcome')} className="flex-1 bg-stone-700 hover:bg-stone-600 text-white px-6 py-4 rounded-lg font-bold text-lg border-2 border-stone-600 transition-all">Retour</button>
            <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 disabled:from-gray-600 disabled:to-gray-700 text-stone-900 px-6 py-4 rounded-lg font-bold text-lg shadow-lg border-2 border-amber-400 flex items-center justify-center gap-2 transition-all">
              {isSubmitting ? <><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-stone-900"/>Création...</> : <>📤 Créer</>}
            </button>
          </div>
        </div>
        <div className="mt-6 bg-stone-800/30 border border-amber-600 rounded-lg p-4">
          <p className="text-amber-300 text-sm text-center">🎲 Race et classe générées aléatoirement</p>
        </div>
      </div>
    </div>
  );
};

export default CharacterCreation;