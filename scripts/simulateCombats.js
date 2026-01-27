#!/usr/bin/env node

// Script de simulation pour tester l'équilibrage
// Usage: node scripts/simulateCombats.js [nombre]

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
  'Guerrier': { ability: 'Frappe pénétrante', icon: '🗡️' },
  'Voleur': { ability: 'Esquive + Crit', icon: '🌀' },
  'Paladin': { ability: 'Renvoie 40%+ dégâts', icon: '🛡️' },
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

const reviveUndead = (target) => {
  const revive = Math.max(1, Math.round(0.20 * target.maxHP));
  target.undead = true;
  target.currentHP = revive;
};

const processTurn = (p1, p2) => {
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
      const heal = Math.max(1, Math.round(att.maxHP * 0.02));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
    }

    if (att.class === 'Demoniste') {
      const t = tiers15(att.base.cap);
      const hit = Math.max(1, Math.round((0.20 + 0.04 * t) * att.base.cap));
      // Le familier ignore 50% de la résistance magique
      const raw = dmgCap(hit, def.base.rescap * 0.5);
      def.currentHP -= raw;
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def);
      }
    }

    if (att.class === 'Masochiste') {
      att.cd.maso = (att.cd.maso % 4) + 1;
      if (att.cd.maso === 4 && att.maso_taken > 0) {
        const t = tiers15(att.base.cap);
        const dmg = Math.max(1, Math.round(att.maso_taken * (0.15 + 0.03 * t)));
        att.maso_taken = 0;
        def.currentHP -= dmg;
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def);
        }
      }
    }

    if (att.bleed_stacks > 0) {
      const bleedDmg = Math.ceil(att.bleed_stacks / 3);
      att.currentHP -= bleedDmg;
      if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
        reviveUndead(att);
      }
    }

    if (att.class === 'Paladin' && att.cd.pal === 2) {
      att.reflect = 0.40 + 0.05 * tiers15(att.base.cap);
    }

    if (att.class === 'Healer' && att.cd.heal === 5) {
      const miss = att.maxHP - att.currentHP;
      const heal = Math.max(1, Math.round(0.20 * miss + (0.25 + 0.05 * tiers15(att.base.cap)) * att.base.cap));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
    }

    if (att.class === 'Voleur' && att.cd.rog === 4) {
      att.dodge = true;
    }

    const isMage = att.class === 'Mage' && att.cd.mag === 3;
    const isWar = att.class === 'Guerrier' && att.cd.war === 3;
    const isArcher = att.class === 'Archer' && att.cd.arc === 3;

    let mult = 1.0;
    if (att.race === 'Orc' && att.currentHP < 0.5 * att.maxHP) mult = 1.2;

    let hits = isArcher ? Math.max(2, 1 + tiers15(att.base.cap)) : 1;

    for (let i = 0; i < hits; i++) {
      const isCrit = Math.random() < critChance(att, def);
      let raw = 0;

      if (isMage) {
        const atkSpell = Math.round(att.base.auto * mult + (0.40 + 0.05 * tiers15(att.base.cap)) * att.base.cap * mult);
        raw = dmgCap(atkSpell, def.base.rescap);
      } else if (isWar) {
        const ignore = 0.12 + 0.02 * tiers15(att.base.cap);
        if (def.base.def <= def.base.rescap) {
          const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
          raw = dmgPhys(Math.round(att.base.auto * mult), effDef);
        } else {
          const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
          raw = dmgCap(Math.round(att.base.cap * mult), effRes);
        }
      } else {
        raw = dmgPhys(Math.round(att.base.auto * mult), def.base.def);
        if (att.race === 'Lycan') {
          def.bleed_stacks = (def.bleed_stacks || 0) + 1;
        }
      }

      if (isCrit) raw = Math.round(raw * 1.5);

      if (def.dodge) {
        def.dodge = false;
        raw = 0;
      }

      if (def.reflect && raw > 0) {
        const back = Math.round(def.reflect * raw);
        att.currentHP -= back;
      }

      def.currentHP -= raw;
      if (raw > 0) def.maso_taken = (def.maso_taken || 0) + raw;

      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def);
      } else if (def.currentHP <= 0) {
        break;
      }
    }
  });
};

const simulateSingleCombat = () => {
  const p1 = generateCharacter('P1');
  const p2 = generateCharacter('P2');

  let turn = 1;
  while (p1.currentHP > 0 && p2.currentHP > 0 && turn <= 30) {
    processTurn(p1, p2);
    turn++;
  }

  return {
    winner: p1.currentHP > 0 ? 'P1' : 'P2',
    p1Race: p1.race,
    p1Class: p1.class,
    p2Race: p2.race,
    p2Class: p2.class,
    turns: turn - 1
  };
};

const runSimulation = (numCombats = 1000) => {
  console.log(`\n🎮 Simulation de ${numCombats} combats...\n`);

  const results = [];
  const raceWins = {};
  const classWins = {};
  const raceCombats = {};
  const classCombats = {};
  let totalTurns = 0;

  Object.keys(races).forEach(race => {
    raceWins[race] = 0;
    raceCombats[race] = 0;
  });
  Object.keys(classes).forEach(cls => {
    classWins[cls] = 0;
    classCombats[cls] = 0;
  });

  for (let i = 0; i < numCombats; i++) {
    const result = simulateSingleCombat();
    results.push(result);
    totalTurns += result.turns;

    raceCombats[result.p1Race]++;
    raceCombats[result.p2Race]++;
    if (result.winner === 'P1') raceWins[result.p1Race]++;
    else raceWins[result.p2Race]++;

    classCombats[result.p1Class]++;
    classCombats[result.p2Class]++;
    if (result.winner === 'P1') classWins[result.p1Class]++;
    else classWins[result.p2Class]++;
  }

  const avgTurns = (totalTurns / numCombats).toFixed(1);

  console.log('📊 RÉSULTATS DE LA SIMULATION\n');
  console.log(`Nombre de combats: ${numCombats}`);
  console.log(`Durée moyenne: ${avgTurns} tours\n`);

  console.log('🏆 TAUX DE VICTOIRE PAR RACE:');
  const sortedRaces = Object.entries(raceWins)
    .map(([race, wins]) => ({
      race,
      wins,
      combats: raceCombats[race],
      winRate: ((wins / raceCombats[race]) * 100).toFixed(1)
    }))
    .sort((a, b) => b.winRate - a.winRate);

  sortedRaces.forEach(({ race, wins, combats, winRate }) => {
    const bar = '█'.repeat(Math.round(winRate / 2));
    console.log(`  ${races[race].icon} ${race.padEnd(13)} ${winRate.padStart(5)}% ${bar.padEnd(50)} (${wins}/${combats})`);
  });

  console.log('\n⚔️ TAUX DE VICTOIRE PAR CLASSE:');
  const sortedClasses = Object.entries(classWins)
    .map(([cls, wins]) => ({
      cls,
      wins,
      combats: classCombats[cls],
      winRate: ((wins / classCombats[cls]) * 100).toFixed(1)
    }))
    .sort((a, b) => b.winRate - a.winRate);

  sortedClasses.forEach(({ cls, wins, combats, winRate }) => {
    const bar = '█'.repeat(Math.round(winRate / 2));
    console.log(`  ${classes[cls].icon} ${cls.padEnd(13)} ${winRate.padStart(5)}% ${bar.padEnd(50)} (${wins}/${combats})`);
  });

  const raceWinRates = sortedRaces.map(r => parseFloat(r.winRate));
  const classWinRates = sortedClasses.map(c => parseFloat(c.winRate));

  const raceSpread = Math.max(...raceWinRates) - Math.min(...raceWinRates);
  const classSpread = Math.max(...classWinRates) - Math.min(...classWinRates);

  console.log('\n📈 ANALYSE D\'ÉQUILIBRAGE:');
  console.log(`  Écart races: ${raceSpread.toFixed(1)}% (idéal < 10%)`);
  console.log(`  Écart classes: ${classSpread.toFixed(1)}% (idéal < 10%)`);

  if (raceSpread < 10 && classSpread < 10) {
    console.log('  ✅ Excellent équilibrage!');
  } else if (raceSpread < 15 && classSpread < 15) {
    console.log('  ⚠️ Équilibrage acceptable');
  } else {
    console.log('  ❌ Déséquilibrage détecté - ajustements recommandés');
  }

  console.log('\n');
};

// Lancer la simulation
const numCombats = parseInt(process.argv[2]) || 1000;
runSimulation(numCombats);
