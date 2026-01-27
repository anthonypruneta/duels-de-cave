#!/usr/bin/env node

// Script de simulation pour tester l'équilibrage
// Usage: node scripts/simulateCombats.mjs [nombre]

import { races } from '../src/data/races.js';
import { classes } from '../src/data/classes.js';
import {
  cooldowns,
  classConstants,
  raceConstants,
  generalConstants,
  tiers15,
  dmgPhys,
  dmgCap,
  calcCritChance,
  getRaceBonus,
  getClassBonus
} from '../src/data/combatMechanics.js';

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

const generateCharacter = (name) => {
  const raceKeys = Object.keys(races);
  const classKeys = Object.keys(classes);
  const race = raceKeys[Math.floor(Math.random()*raceKeys.length)];
  const charClass = classKeys[Math.floor(Math.random()*classKeys.length)];
  const raw = genStats();
  const rB = getRaceBonus(race);
  const cB = getClassBonus(charClass);
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

const reviveUndead = (target) => {
  const revive = Math.max(1, Math.round(raceConstants.mortVivant.revivePercent * target.maxHP));
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
    for (const k of Object.keys(cooldowns)) {
      att.cd[k] = (att.cd[k] % cooldowns[k]) + 1;
    }

    // Sylvari regen
    if (att.race === 'Sylvari') {
      const heal = Math.max(1, Math.round(att.maxHP * raceConstants.sylvari.regenPercent));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
    }

    // Demoniste familier
    if (att.class === 'Demoniste') {
      const t = tiers15(att.base.cap);
      const { capBase, capPerTier, ignoreResist } = classConstants.demoniste;
      const hit = Math.max(1, Math.round((capBase + capPerTier * t) * att.base.cap));
      const raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
      def.currentHP -= raw;
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def);
      }
    }

    // Masochiste renvoi
    if (att.class === 'Masochiste') {
      if (att.cd.maso === cooldowns.maso && att.maso_taken > 0) {
        const t = tiers15(att.base.cap);
        const { returnBase, returnPerTier, healPercent } = classConstants.masochiste;
        const dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerTier * t)));
        const healAmount = Math.max(1, Math.round(att.maso_taken * healPercent));
        att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
        att.maso_taken = 0;
        def.currentHP -= dmg;
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def);
        }
      }
    }

    // Lycan saignement
    if (att.bleed_stacks > 0) {
      const bleedDmg = Math.ceil(att.bleed_stacks / 3);
      att.currentHP -= bleedDmg;
      if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
        reviveUndead(att);
      }
    }

    // Paladin riposte
    if (att.class === 'Paladin' && att.cd.pal === cooldowns.pal) {
      const { reflectBase, reflectPerTier } = classConstants.paladin;
      att.reflect = reflectBase + reflectPerTier * tiers15(att.base.cap);
    }

    // Healer soin
    if (att.class === 'Healer' && att.cd.heal === cooldowns.heal) {
      const miss = att.maxHP - att.currentHP;
      const { missingHpPercent, capBase, capPerTier } = classConstants.healer;
      const heal = Math.max(1, Math.round(missingHpPercent * miss + (capBase + capPerTier * tiers15(att.base.cap)) * att.base.cap));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
    }

    // Voleur esquive
    if (att.class === 'Voleur' && att.cd.rog === cooldowns.rog) {
      att.dodge = true;
    }

    const isMage = att.class === 'Mage' && att.cd.mag === cooldowns.mag;
    const isWar = att.class === 'Guerrier' && att.cd.war === cooldowns.war;
    const isArcher = att.class === 'Archer' && att.cd.arc === cooldowns.arc;

    // Orc bonus dégâts
    let mult = 1.0;
    if (att.race === 'Orc' && att.currentHP < raceConstants.orc.lowHpThreshold * att.maxHP) {
      mult = raceConstants.orc.damageBonus;
    }

    // Archer flèches multiples
    const { arrowsBase, arrowsPerTier } = classConstants.archer;
    let hits = isArcher ? arrowsBase + arrowsPerTier * tiers15(att.base.cap) : 1;

    for (let i = 0; i < hits; i++) {
      const isCrit = Math.random() < calcCritChance(att);
      let raw = 0;

      if (isMage) {
        const { capBase, capPerTier } = classConstants.mage;
        const atkSpell = Math.round(att.base.auto * mult + (capBase + capPerTier * tiers15(att.base.cap)) * att.base.cap * mult);
        raw = dmgCap(atkSpell, def.base.rescap);
      } else if (isWar) {
        const { ignoreBase, ignorePerTier } = classConstants.guerrier;
        const ignore = ignoreBase + ignorePerTier * tiers15(att.base.cap);
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
          def.bleed_stacks = (def.bleed_stacks || 0) + raceConstants.lycan.bleedPerHit;
        }
      }

      // Crit multiplier (x1.5 pour tous)
      if (isCrit) {
        raw = Math.round(raw * generalConstants.critMultiplier);
      }

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
  while (p1.currentHP > 0 && p2.currentHP > 0 && turn <= generalConstants.maxTurns) {
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
