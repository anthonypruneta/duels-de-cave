import React, { useState, useEffect, useRef } from 'react';

const Combat = () => {
  const [player1, setPlayer1] = useState(null);
  const [player2, setPlayer2] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [winner, setWinner] = useState(null);
  const logEndRef = useRef(null);

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
    'Guerrier': { ability: 'Frappe pénétrante', icon: '🗡️' },
    'Voleur': { ability: 'Esquive + Crit', icon: '🌀' },
    'Paladin': { ability: 'Renvoie 30%+ dégâts', icon: '🛡️' },
    'Healer': { ability: 'Soin puissant', icon: '✚' },
    'Archer': { ability: 'Volée 2+ flèches', icon: '🏹' },
    'Mage': { ability: 'Sort magique', icon: '🔮' },
    'Demoniste': { ability: 'Familier', icon: '💠' },
    'Masochiste': { ability: 'Renvoie dégâts', icon: '🩸' }
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
    if (att.race === 'Elfe' && att.base.spd > def.base.spd) c += 0.15;
    return c;
  };

  const reviveUndead = (target, log) => {
    const revive = Math.max(1, Math.round(0.20 * target.maxHP));
    target.undead = true;
    target.currentHP = revive;
    log.push(`☠️ ${target.name} revient à ${revive} PV!`);
  };

  const processTurn = (p1, p2, log) => {
    const first = p1.base.spd >= p2.base.spd ? p1 : p2;
    const second = first === p1 ? p2 : p1;
    
    [first, second].forEach((att) => {
      const def = att === first ? second : first;
      if (att.currentHP <= 0 || def.currentHP <= 0) return;
      
      att.reflect = false;
      const cycle = { war: 3, rog: 4, pal: 2, heal: 5, arc: 3, mag: 3, dem: 1, maso: 4 };
      for (const k of Object.keys(cycle)) {
        att.cd[k] = (att.cd[k] % cycle[k]) + 1;
      }
      
      if (att.race === 'Sylvari') {
        const heal = Math.max(1, Math.round(att.maxHP * 0.03));
        att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
        log.push(`🌿 ${att.name} régénère ${heal} PV`);
      }
      
      if (att.class === 'Demoniste') {
        const t = tiers15(att.base.cap);
        const hit = Math.max(1, Math.round((0.10 + 0.02 * t) * att.base.cap));
        const raw = dmgCap(hit, def.base.rescap);
        def.currentHP -= raw;
        log.push(`💠 Familier de ${att.name} → ${raw} dégâts`);
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log);
        }
      }
      
      if (att.class === 'Masochiste') {
        att.cd.maso = (att.cd.maso % 4) + 1;
        if (att.cd.maso === 4 && att.maso_taken > 0) {
          const t = tiers15(att.base.cap);
          const dmg = Math.max(1, Math.round(att.maso_taken * (0.10 + 0.02 * t)));
          att.maso_taken = 0;
          def.currentHP -= dmg;
          log.push(`🩸 ${att.name} renvoie ${dmg} dégâts accumulés`);
          if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
            reviveUndead(def, log);
          }
        }
      }
      
      if (att.bleed_stacks > 0) {
        att.currentHP -= att.bleed_stacks;
        log.push(`🩸 ${att.name} saigne ${att.bleed_stacks} dégâts`);
        if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
          reviveUndead(att, log);
        }
      }
      
      if (att.class === 'Paladin' && att.cd.pal === 2) {
        att.reflect = 0.30 + 0.05 * tiers15(att.base.cap);
        log.push(`🛡️ ${att.name} prépare riposte ${Math.round(att.reflect * 100)}%`);
      }
      
      if (att.class === 'Healer' && att.cd.heal === 5) {
        const miss = att.maxHP - att.currentHP;
        const heal = Math.max(1, Math.round(0.20 * miss + (0.25 + 0.05 * tiers15(att.base.cap)) * att.base.cap));
        att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
        log.push(`✚ ${att.name} soigne ${heal} PV`);
      }
      
      if (att.class === 'Voleur' && att.cd.rog === 4) {
        att.dodge = true;
        log.push(`🌀 ${att.name} esquivera prochaine attaque`);
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
          if (i === 0) log.push(`🔮 ${att.name} lance un sort`);
        } else if (isWar) {
          const ignore = 0.20 + 0.05 * tiers15(att.base.cap);
          if (def.base.def <= def.base.rescap) {
            const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
            raw = dmgPhys(Math.round(att.base.auto * mult), effDef);
          } else {
            const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
            raw = dmgCap(Math.round(att.base.cap * mult), effRes);
          }
          if (i === 0) log.push(`🗡️ ${att.name} frappe pénétrant`);
        } else {
          raw = dmgPhys(Math.round(att.base.auto * mult), def.base.def);
          if (att.race === 'Lycan') {
            def.bleed_stacks = (def.bleed_stacks || 0) + 1;
          }
        }
        
        if (isCrit) raw = Math.round(raw * 1.5);
        
        if (def.dodge) {
          def.dodge = false;
          log.push(`💨 ${def.name} esquive!`);
          raw = 0;
        }
        
        if (def.reflect && raw > 0) {
          const back = Math.round(def.reflect * raw);
          att.currentHP -= back;
          log.push(`🔁 ${def.name} renvoie ${back}`);
        }
        
        def.currentHP -= raw;
        if (raw > 0) def.maso_taken = (def.maso_taken || 0) + raw;
        
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, log);
        } else if (def.currentHP <= 0) {
          total += raw;
          break;
        }
        
        total += raw;
        if (isArcher) log.push(`🏹 Flèche ${i + 1}: ${raw}${isCrit ? ' CRIT' : ''}`);
      }
      
      if (!isArcher && total > 0) {
        log.push(`${att.name} → ${def.name}: ${total} dégâts`);
      }
    });
  };

  const simulateCombat = async () => {
    if (!player1 || !player2 || isSimulating) return;
    setIsSimulating(true);
    setWinner(null);
    
    const p1 = { ...player1, currentHP: player1.maxHP, cd: {war:0,rog:0,pal:0,heal:0,arc:0,mag:0,dem:0,maso:0}, undead: false, dodge: false, reflect: false, bleed_stacks: 0, maso_taken: 0 };
    const p2 = { ...player2, currentHP: player2.maxHP, cd: {war:0,rog:0,pal:0,heal:0,arc:0,mag:0,dem:0,maso:0}, undead: false, dodge: false, reflect: false, bleed_stacks: 0, maso_taken: 0 };
    
    const logs = [`⚔️ Combat: ${p1.name} vs ${p2.name}`];
    setCombatLog(logs);
    
    let turn = 1;
    while (p1.currentHP > 0 && p2.currentHP > 0 && turn <= 30) {
      const turnLog = [`--- Tour ${turn} ---`];
      processTurn(p1, p2, turnLog);
      logs.push(...turnLog);
      setCombatLog([...logs]);
      setPlayer1({...p1});
      setPlayer2({...p2});
      await new Promise(r => setTimeout(r, 1200));
      turn++;
    }
    
    const w = p1.currentHP > 0 ? p1.name : p2.name;
    logs.push(`🏆 ${w} remporte le combat!`);
    setCombatLog([...logs]);
    setWinner(w);
    setIsSimulating(false);
  };

  const resetCombat = () => {
    setPlayer1(generateCharacter('SansNom'));
    setPlayer2(generateCharacter('SansNom'));
    setCombatLog([]);
    setWinner(null);
    setIsSimulating(false);
  };

  useEffect(() => { resetCombat(); }, []);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [combatLog]);

  const CharacterCard = ({ character }) => {
    if (!character) return null;
    const hpPercent = (character.currentHP / character.maxHP) * 100;
    const hpClass = hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';
    const totalBonus = (k) => (character.bonuses.race[k] || 0) + (character.bonuses.class[k] || 0);
    
    return (
      <div className="relative bg-gradient-to-br from-stone-200 to-stone-100 rounded-2xl p-2 shadow-2xl border-4 border-amber-600">
        <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-5 py-1.5 rounded-full text-sm font-bold shadow-lg border-2 border-amber-700 z-10">
          {character.race} • {character.class}
        </div>
        <div className="border-2 border-amber-400 rounded-xl overflow-hidden">
          <div className="h-96 relative border-4 border-amber-900 bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
            <div className="text-9xl opacity-30">{races[character.race].icon}</div>
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
                <span className="text-gray-400">{classes[character.class].ability}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-8 text-amber-400">Étape 3 — Combat</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <CharacterCard character={player1} />
          <div className="flex flex-col justify-center items-center gap-6">
            <div className="text-8xl font-bold text-amber-400">VS</div>
            {winner && <div className="bg-gradient-to-r from-yellow-500 to-amber-600 text-stone-900 px-8 py-4 rounded-lg font-bold text-2xl animate-pulse shadow-2xl border-4 border-yellow-400">🏆 {winner} gagne!</div>}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={simulateCombat} disabled={isSimulating} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 text-white px-8 py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg border-2 border-blue-400">
                ▶️ Lancer le combat
              </button>
              <button onClick={resetCombat} className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-8 py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg border-2 border-purple-400">
                🔄 Recommencer
              </button>
            </div>
          </div>
          <CharacterCard character={player2} />
        </div>
        <div className="bg-stone-800 rounded-lg p-6 border-4 border-amber-700 max-h-96 overflow-y-auto shadow-2xl">
          <h2 className="text-2xl font-bold text-amber-400 mb-4">📜 Journal de Combat</h2>
          {combatLog.length === 0 ? (
            <p className="text-gray-400 italic text-center py-8">Cliquez sur Lancer le combat...</p>
          ) : (
            <div className="space-y-1 font-mono text-sm">
              {combatLog.map((log, idx) => (
                <div key={idx} className={`${log.includes('🏆') ? 'text-yellow-400 font-bold text-lg' : log.includes('☠️') ? 'text-purple-400 font-bold' : log.includes('---') ? 'text-blue-400 font-bold mt-3 pt-2 border-t border-stone-700' : log.includes('CRIT') ? 'text-red-400 font-bold' : log.includes('esquive') || log.includes('régénère') || log.includes('soigne') ? 'text-green-300' : log.includes('🩸') || log.includes('🐺') ? 'text-red-300' : 'text-gray-300'}`}>
                  {log}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Combat;