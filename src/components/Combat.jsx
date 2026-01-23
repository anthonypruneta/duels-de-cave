import React, { useState, useEffect, useRef } from 'react';
import testImage1 from '../assets/characters/test.png';
import testImage2 from '../assets/characters/test2.png';
import Header from './Header';

const Combat = () => {
  const [player1, setPlayer1] = useState(null);
  const [player2, setPlayer2] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [winner, setWinner] = useState(null);
  const [currentAction, setCurrentAction] = useState(null); // {player: 1|2, action: string}
  const logEndRef = useRef(null);

  const races = {
    'Humain': { bonus: '+10 PV & +2 toutes stats', icon: '👥' },
    'Elfe': { bonus: '+15% crit permanent (+5 VIT)', icon: '🧝' },
    'Orc': { bonus: 'Sous 50% PV: +20% dégâts', icon: '🪓' },
    'Nain': { bonus: '+10 PV & +5 Déf', icon: '⛏️' },
    'Dragonkin': { bonus: '+10 PV & +15 ResC', icon: '🐲' },
    'Mort-vivant': { bonus: 'Revient à 25% PV (1x)', icon: '☠️' },
    'Lycan': { bonus: 'Auto = Saignement (0.5/stack)', icon: '🐺' },
    'Sylvari': { bonus: 'Regen 2% PV/tour', icon: '🌿' }
  };

  const classes = {
    'Guerrier': { ability: 'Frappe pénétrante (CD: 3 tours)', description: '+3 Auto | Frappe résistance faible & ignore 8% +2%/15Cap', icon: '🗡️' },
    'Voleur': { ability: 'Esquive (CD: 2 tours)', description: '+5 VIT | Esquive 1 coup | +15% crit/palier 15Cap | Crit x2', icon: '🌀' },
    'Paladin': { ability: 'Riposte (Chaque tour)', description: 'Renvoie 70% +12%/15Cap des dégâts reçus', icon: '🛡️' },
    'Healer': { ability: 'Soin puissant (CD: 2 tours)', description: '+2 Auto | Heal 20% PV manquants + (25% +5%/15Cap) × Capacité', icon: '✚' },
    'Archer': { ability: 'Tir multiple (CD: 3 tours)', description: '2 tirs à Cap15, +1 tir par palier 15Cap', icon: '🏹' },
    'Mage': { ability: 'Sort magique (CD: 3 tours)', description: 'Dégâts = Auto + (40% +5%/15Cap) × Capacité (vs ResC)', icon: '🔮' },
    'Demoniste': { ability: 'Familier (Passif)', description: 'Chaque tour: (15% +3%/15Cap) × Capacité en dégâts', icon: '💠' },
    'Masochiste': { ability: 'Renvoi dégâts (CD: 4 tours)', description: 'Renvoie (60% +12%/15Cap) des dégâts reçus accumulés', icon: '🩸' }
  };

  // Calculer la description réelle basée sur les stats du personnage
  const getCalculatedDescription = (className, cap, auto) => {
    const paliers = Math.floor(cap / 15);

    switch(className) {
      case 'Guerrier':
        const ignorePercent = 8 + (paliers * 2);
        return `+3 Auto | Frappe résistance faible & ignore ${ignorePercent}%`;

      case 'Voleur':
        const critBonus = paliers * 15;
        return `+5 VIT | Esquive 1 coup | +${critBonus}% crit | Crit x2`;

      case 'Paladin':
        const ripostePercent = 70 + (paliers * 12);
        return `Renvoie ${ripostePercent}% des dégâts reçus`;

      case 'Healer':
        const healPercent = 25 + (paliers * 5);
        return `+2 Auto | Heal 20% PV manquants + ${healPercent}% × Cap (${cap})`;

      case 'Archer':
        const arrows = 2 + paliers;
        return `${arrows} tirs simultanés`;

      case 'Mage':
        const magicPercent = 40 + (paliers * 5);
        const magicDmg = Math.round(cap * (magicPercent / 100));
        return `Dégâts = Auto + ${magicDmg} dégâts magiques (vs ResC)`;

      case 'Demoniste':
        const familierPercent = 15 + (paliers * 3);
        const familierDmg = Math.round(cap * (familierPercent / 100));
        return `Chaque tour: ${familierDmg} dégâts automatiques`;

      case 'Masochiste':
        const returnPercent = 60 + (paliers * 12);
        return `Renvoie ${returnPercent}% des dégâts reçus accumulés`;

      default:
        return classes[className]?.description || '';
    }
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
    if (race==='Humain') {b.hp=10;b.auto=1;b.def=1;b.cap=1;b.rescap=1;b.spd=1;}
    else if (race==='Nain') {b.hp=10;b.def=4;}
    else if (race==='Dragonkin') {b.hp=10;b.rescap=15;}
    else if (race==='Elfe') {b.auto=1;b.cap=1;b.spd=5;}
    return b;
  };

  const classBonus = (clazz) => {
    const b = {hp:0,auto:0,def:0,cap:0,rescap:0,spd:0};
    if (clazz==='Voleur') b.spd=5;
    if (clazz==='Guerrier') b.auto=2;
    return b;
  };

  const generateCharacter = (name) => {
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
    return {
      name, race, class: charClass, base,
      bonuses: { race: rB, class: cB },
      currentHP: base.hp, maxHP: base.hp,
      cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 },
      undead: false, dodge: false, reflect: false,
      bleed_stacks: 0, maso_taken: 0
    };
  };

  const tiers15 = (cap) => Math.floor(cap / 15);
  const dmgPhys = (auto, def) => Math.max(1, Math.round(auto - 0.5 * def));
  const dmgCap = (cap, rescap) => Math.max(1, Math.round(cap - 0.5 * rescap));

  const critChance = (att, def) => {
    let c = 0.10;
    if (att.class === 'Voleur') c += 0.05 * tiers15(att.base.cap);
    if (att.race === 'Elfe') c += 0.20;
    return c;
  };

  const reviveUndead = (target, log, playerColor) => {
    const revive = Math.max(1, Math.round(0.20 * target.maxHP));
    target.undead = true;
    target.currentHP = revive;
    log.push(`${playerColor} ☠️ ${target.name} revient à ${revive} PV!`);
  };

  const processPlayerAction = (att, def, log, isP1) => {
    if (att.currentHP <= 0 || def.currentHP <= 0) return;
      
      att.reflect = false;
      const cycle = { war: 3, rog: 4, pal: 2, heal: 5, arc: 3, mag: 3, dem: 1, maso: 4 };
      for (const k of Object.keys(cycle)) {
        att.cd[k] = (att.cd[k] % cycle[k]) + 1;
      }
      
      const playerColor = isP1 ? '[P1]' : '[P2]';

      if (att.race === 'Sylvari') {
        const heal = Math.max(1, Math.round(att.maxHP * 0.02));
        att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
        log.push(`${playerColor}${playerColor} 🌿 ${att.name} régénère ${heal} PV`);
      }
      
      if (att.class === 'Demoniste') {
        const t = tiers15(att.base.cap);
        const hit = Math.max(1, Math.round((0.20 + 0.04 * t) * att.base.cap));
        const raw = dmgCap(hit, def.base.rescap);
        def.currentHP -= raw;
        log.push(`${playerColor}💠 Familier de ${att.name} → ${raw} dégâts`);
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log, playerColor);
        }
      }
      
      if (att.class === 'Masochiste') {
        att.cd.maso = (att.cd.maso % 4) + 1;
        if (att.cd.maso === 4 && att.maso_taken > 0) {
          const t = tiers15(att.base.cap);
          const dmg = Math.max(1, Math.round(att.maso_taken * (0.15 + 0.03 * t)));
          att.maso_taken = 0;
          def.currentHP -= dmg;
          log.push(`${playerColor}🩸 ${att.name} renvoie ${dmg} dégâts accumulés`);
          if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
            reviveUndead(def, log, playerColor);
          }
        }
      }
      
      if (att.bleed_stacks > 0) {
        const bleedDmg = Math.ceil(att.bleed_stacks / 3);
        att.currentHP -= bleedDmg;
        log.push(`${playerColor}🩸 ${att.name} saigne ${bleedDmg} dégâts`);
        if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
          reviveUndead(att, log, playerColor);
        }
      }

      if (att.class === 'Paladin' && att.cd.pal === 2) {
        att.reflect = 0.40 + 0.05 * tiers15(att.base.cap);
        log.push(`${playerColor}🛡️ ${att.name} prépare riposte ${Math.round(att.reflect * 100)}%`);
      }
      
      if (att.class === 'Healer' && att.cd.heal === 5) {
        const miss = att.maxHP - att.currentHP;
        const heal = Math.max(1, Math.round(0.20 * miss + (0.25 + 0.05 * tiers15(att.base.cap)) * att.base.cap));
        att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
        log.push(`${playerColor}✚ ${att.name} soigne ${heal} PV`);
      }
      
      if (att.class === 'Voleur' && att.cd.rog === 4) {
        att.dodge = true;
        log.push(`${playerColor}🌀 ${att.name} esquivera prochaine attaque`);
      }
      
      const isMage = att.class === 'Mage' && att.cd.mag === 3;
      const isWar = att.class === 'Guerrier' && att.cd.war === 3;
      const isArcher = att.class === 'Archer' && att.cd.arc === 3;
      
      let mult = 1.0;
      if (att.race === 'Orc' && att.currentHP < 0.5 * att.maxHP) mult = 1.2;
      
      let hits = isArcher ? Math.max(2, 1 + tiers15(att.base.cap)) : 1;
      let total = 0;
      
      for (let i = 0; i < hits; i++) {
        const isCrit = Math.random() < critChance(att, def);
        let raw = 0;
        
        if (isMage) {
          const atkSpell = Math.round(att.base.auto * mult + (0.40 + 0.05 * tiers15(att.base.cap)) * att.base.cap * mult);
          raw = dmgCap(atkSpell, def.base.rescap);
          if (i === 0) log.push(`${playerColor}🔮 ${att.name} lance un sort`);
        } else if (isWar) {
          const ignore = 0.12 + 0.02 * tiers15(att.base.cap);
          if (def.base.def <= def.base.rescap) {
            const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
            raw = dmgPhys(Math.round(att.base.auto * mult), effDef);
          } else {
            const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
            raw = dmgCap(Math.round(att.base.cap * mult), effRes);
          }
          if (i === 0) log.push(`${playerColor}🗡️ ${att.name} frappe pénétrant`);
        } else {
          raw = dmgPhys(Math.round(att.base.auto * mult), def.base.def);
          if (att.race === 'Lycan') {
            def.bleed_stacks = (def.bleed_stacks || 0) + 1;
          }
        }
        
        if (isCrit) raw = Math.round(raw * 1.5);
        
        if (def.dodge) {
          def.dodge = false;
          log.push(`${playerColor}💨 ${def.name} esquive!`);
          raw = 0;
        }
        
        if (def.reflect && raw > 0) {
          const back = Math.round(def.reflect * raw);
          att.currentHP -= back;
          log.push(`${playerColor}🔁 ${def.name} renvoie ${back}`);
        }
        
        def.currentHP -= raw;
        if (raw > 0) def.maso_taken = (def.maso_taken || 0) + raw;
        
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log, playerColor);
        } else if (def.currentHP <= 0) {
          total += raw;
          break;
        }
        
        total += raw;
        if (isArcher) log.push(`${playerColor}🏹 Flèche ${i + 1}: ${raw}${isCrit ? ' CRIT' : ''}`);
      }
      
      if (!isArcher && total > 0) {
        log.push(`${playerColor}${att.name} → ${def.name}: ${total} dégâts`);
      }
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

    const p1 = { ...player1, currentHP: player1.maxHP, cd: {war:0,rog:0,pal:0,heal:0,arc:0,mag:0,dem:0,maso:0}, undead: false, dodge: false, reflect: false, bleed_stacks: 0, maso_taken: 0 };
    const p2 = { ...player2, currentHP: player2.maxHP, cd: {war:0,rog:0,pal:0,heal:0,arc:0,mag:0,dem:0,maso:0}, undead: false, dodge: false, reflect: false, bleed_stacks: 0, maso_taken: 0 };

    const logs = [`⚔️ Combat: ${p1.name} vs ${p2.name}`];
    setCombatLog(logs);

    let turn = 1;
    while (p1.currentHP > 0 && p2.currentHP > 0 && turn <= 30) {
      logs.push(`--- Tour ${turn} ---`);
      setCombatLog([...logs]);
      await new Promise(r => setTimeout(r, 400));

      // Déterminer qui attaque en premier selon la vitesse
      const first = p1.base.spd >= p2.base.spd ? p1 : p2;
      const second = first === p1 ? p2 : p1;
      const firstIsP1 = first === p1;

      // Action du premier joueur
      const log1 = [];
      setCurrentAction({ player: firstIsP1 ? 1 : 2, logs: [] });
      await new Promise(r => setTimeout(r, 300));
      processPlayerAction(first, second, log1, firstIsP1);
      setCurrentAction({ player: firstIsP1 ? 1 : 2, logs: log1 });
      logs.push(...log1);
      setCombatLog([...logs]);
      setPlayer1({...p1});
      setPlayer2({...p2});
      await new Promise(r => setTimeout(r, 1200));
      setCurrentAction(null);

      // Si le combat n'est pas fini, action du deuxième joueur
      if (p1.currentHP > 0 && p2.currentHP > 0) {
        const log2 = [];
        setCurrentAction({ player: !firstIsP1 ? 1 : 2, logs: [] });
        await new Promise(r => setTimeout(r, 300));
        processPlayerAction(second, first, log2, !firstIsP1);
        setCurrentAction({ player: !firstIsP1 ? 1 : 2, logs: log2 });
        logs.push(...log2);
        setCombatLog([...logs]);
        setPlayer1({...p1});
        setPlayer2({...p2});
        await new Promise(r => setTimeout(r, 1200));
        setCurrentAction(null);
      }

      turn++;
    }

    const w = p1.currentHP > 0 ? p1.name : p2.name;
    logs.push(`🏆 ${w} remporte le combat!`);
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

  const resetCombat = () => {
    // Arrêter toutes les musiques
    const combatMusic = document.getElementById('combat-music');
    const victoryMusic = document.getElementById('victory-music');
    if (combatMusic) combatMusic.pause();
    if (victoryMusic) victoryMusic.pause();

    setPlayer1(generateCharacter('SansNom'));
    setPlayer2(generateCharacter('SansNom'));
    setCombatLog([]);
    setWinner(null);
    setIsSimulating(false);
    setCurrentAction(null);
  };

  useEffect(() => { resetCombat(); }, []);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [combatLog]);

  const CharacterCard = ({ character, imageIndex }) => {
    if (!character) return null;
    const hpPercent = (character.currentHP / character.maxHP) * 100;
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const totalBonus = (k) => (character.bonuses.race[k] || 0) + (character.bonuses.class[k] || 0);
    const characterImage = imageIndex === 1 ? testImage1 : testImage2;

    return (
      <div className="relative bg-gradient-to-br from-stone-200 to-stone-100 rounded-2xl p-2 shadow-2xl border-4 border-amber-600">
        <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-5 py-1.5 rounded-full text-sm font-bold shadow-lg border-2 border-amber-700 z-10">
          {character.race} • {character.class}
        </div>
        <div className="border-2 border-amber-400 rounded-xl overflow-hidden">
          <div className="h-96 relative border-4 border-amber-900 bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 flex items-center justify-center overflow-hidden">
            <img src={characterImage} alt={character.name} className="w-full h-full object-cover" />
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 rounded-lg p-3 border border-amber-600">
              <div className="text-white font-bold text-xl text-center">{character.name}</div>
              <div className="text-xs text-amber-300 text-center">{character.race} / {character.class}</div>
            </div>
          </div>
          <div className="bg-stone-800/95 p-4">
            <div className="mb-3">
              <div className="flex justify-between text-sm text-white mb-2">
                <div>HP: {character.base.hp}{totalBonus('hp') > 0 && <span className="text-green-400 text-xs ml-1">(+{totalBonus('hp')})</span>}</div>
                <div>VIT: {character.base.spd}{totalBonus('spd') > 0 && <span className="text-green-400 text-xs ml-1">(+{totalBonus('spd')})</span>}</div>
              </div>
              <div className="text-xs text-amber-300 mb-2">{character.name} — PV {character.currentHP}/{character.maxHP}</div>
              <div className="bg-stone-900 rounded-full h-3 overflow-hidden border border-amber-600">
                <div className={`h-full transition-all duration-500 ${hpClass}`} style={{width: `${hpPercent}%`}} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-white mb-3">
              <div className="text-gray-400">Auto: <span className="font-bold">{character.base.auto}</span>{totalBonus('auto') > 0 && <span className="text-green-400 text-xs ml-1">(+{totalBonus('auto')})</span>}</div>
              <div className="text-gray-400">Déf: <span className="font-bold">{character.base.def}</span>{totalBonus('def') > 0 && <span className="text-green-400 text-xs ml-1">(+{totalBonus('def')})</span>}</div>
              <div className="text-gray-400">Cap: <span className="font-bold">{character.base.cap}</span>{totalBonus('cap') > 0 && <span className="text-green-400 text-xs ml-1">(+{totalBonus('cap')})</span>}</div>
              <div className="text-gray-400">ResC: <span className="font-bold">{character.base.rescap}</span>{totalBonus('rescap') > 0 && <span className="text-green-400 text-xs ml-1">(+{totalBonus('rescap')})</span>}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2 bg-stone-700/50 rounded p-2 text-xs">
                <span className="text-lg">{races[character.race].icon}</span>
                <span className="text-amber-400">{races[character.race].bonus}</span>
              </div>
              <div className="flex items-start gap-2 bg-stone-700/50 rounded p-2 text-xs">
                <span className="text-lg">{classes[character.class].icon}</span>
                <div className="flex-1">
                  <div className="text-amber-400 font-semibold mb-1">{classes[character.class].ability}</div>
                  <div className="text-gray-400 text-[10px]">{getCalculatedDescription(character.class, character.base.cap, character.base.auto)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 p-6">
      <Header />
      {/* Musique de combat */}
      <audio id="combat-music" loop>
        <source src="/assets/music/combat.mp3" type="audio/mpeg" />
      </audio>
      <audio id="victory-music">
        <source src="/assets/music/victory.mp3" type="audio/mpeg" />
      </audio>

      <div className="max-w-[1800px] mx-auto">
        <h1 className="text-5xl font-bold text-center mb-8 text-amber-400">⚔️ Étape 3 — Combat ⚔️</h1>

        {/* Boutons de contrôle en haut */}
        <div className="flex justify-center gap-4 mb-8">
          <button onClick={simulateCombat} disabled={isSimulating} className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-10 py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg border-2 border-amber-400">
            ▶️ Lancer le combat
          </button>
          <button onClick={resetCombat} className="bg-gradient-to-r from-stone-700 to-stone-800 hover:from-stone-800 hover:to-stone-900 text-white px-10 py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg border-2 border-stone-600">
            🔄 Recommencer
          </button>
        </div>

        {/* VS et Winner */}
        {winner && (
          <div className="flex justify-center mb-8">
            <div className="bg-gradient-to-r from-yellow-500 to-amber-600 text-stone-900 px-12 py-5 rounded-xl font-bold text-3xl animate-pulse shadow-2xl border-4 border-yellow-400">
              🏆 {winner} remporte le combat! 🏆
            </div>
          </div>
        )}

        {/* Affichage des cartes de personnages */}
        <div className="flex gap-6 justify-center mb-6">
          <div className="flex-shrink-0" style={{width: '320px'}}>
            <CharacterCard character={player1} imageIndex={1} />
          </div>
          <div className="flex-shrink-0" style={{width: '320px'}}>
            <CharacterCard character={player2} imageIndex={2} />
          </div>
        </div>

        {/* Layout principal: Actions + Journal au centre */}
        <div className="grid grid-cols-3 gap-4 items-start">
          {/* Zone d'action Joueur 1 - Gauche */}
          <div className="bg-stone-800 rounded-lg p-4 border-4 border-blue-600 shadow-2xl h-[400px] flex flex-col">
            <h3 className="text-xl font-bold text-blue-400 mb-4 text-center">Attaque Joueur 1</h3>
            <div className="flex-1 overflow-y-auto">
              {currentAction && currentAction.player === 1 ? (
                <div className="space-y-2 font-mono text-sm">
                  {currentAction.logs.map((log, idx) => {
                    const cleanLog = log.replace(/^\[P[12]\]\s*/, '');
                    return (
                      <div key={idx} className="text-blue-300 p-2 bg-blue-900/30 rounded">
                        {cleanLog}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 italic text-center py-8">En attente...</p>
              )}
            </div>
          </div>

          {/* Journal de combat - Centre */}
          <div className="bg-stone-800 rounded-lg p-4 border-4 border-amber-700 shadow-2xl h-[400px] flex flex-col">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="text-5xl font-bold text-amber-400">VS</div>
            </div>
            <h2 className="text-xl font-bold text-amber-400 mb-3 text-center">📜 Journal de Combat</h2>
            <div className="flex-1 overflow-y-auto">
              {combatLog.length === 0 ? (
                <p className="text-gray-400 italic text-center py-8">Cliquez sur "Lancer le combat" pour commencer...</p>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {combatLog.map((log, idx) => {
                    const isP1 = log.startsWith('[P1]');
                    const isP2 = log.startsWith('[P2]');
                    const cleanLog = log.replace(/^\[P[12]\]\s*/, '');
                    const baseColor = isP1 ? 'text-blue-400' : isP2 ? 'text-red-400' : 'text-gray-300';
                    const className = `${log.includes('🏆') ? 'text-yellow-400 font-bold text-base' : log.includes('☠️') ? 'text-amber-400 font-bold' : log.includes('---') ? 'text-amber-300 font-bold mt-2 pt-1 border-t border-stone-700' : log.includes('CRIT') ? 'text-red-400 font-bold' : log.includes('esquive') || log.includes('régénère') || log.includes('soigne') ? 'text-green-300' : log.includes('🩸') || log.includes('🐺') ? 'text-red-300' : baseColor}`;
                    return (
                      <div key={idx} className={className}>
                        {cleanLog}
                      </div>
                    );
                  })}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Zone d'action Joueur 2 - Droite */}
          <div className="bg-stone-800 rounded-lg p-4 border-4 border-red-600 shadow-2xl h-[400px] flex flex-col">
            <h3 className="text-xl font-bold text-red-400 mb-4 text-center">Attaque Joueur 2</h3>
            <div className="flex-1 overflow-y-auto">
              {currentAction && currentAction.player === 2 ? (
                <div className="space-y-2 font-mono text-sm">
                  {currentAction.logs.map((log, idx) => {
                    const cleanLog = log.replace(/^\[P[12]\]\s*/, '');
                    return (
                      <div key={idx} className="text-red-300 p-2 bg-red-900/30 rounded">
                        {cleanLog}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 italic text-center py-8">En attente...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Combat;