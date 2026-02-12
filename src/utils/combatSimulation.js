// Script de simulation pour tester l'équilibrage du jeu
// Utilise les mécaniques centralisées de combatMechanics.js

import { races } from '../data/races.js';
import { classes } from '../data/classes.js';
import {
  cooldowns,
  classConstants,
  raceConstants,
  generalConstants,
  dmgPhys,
  dmgCap,
  calcCritChance,
  getCritMultiplier,
  getRaceBonus,
  getClassBonus
} from '../data/combatMechanics.js';
import { getMageTowerPassiveLevel } from '../data/mageTowerPassives.js';
import { applyAwakeningToBase, buildAwakeningState, getAwakeningEffect } from './awakening.js';

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

const generateCharacter = (name, level = 1) => {
  const raceKeys = Object.keys(races);
  const classKeys = Object.keys(classes);
  const race = raceKeys[Math.floor(Math.random()*raceKeys.length)];
  const charClass = classKeys[Math.floor(Math.random()*classKeys.length)];
  const awakeningEffect = getAwakeningEffect(race, level);
  const raw = genStats();
  const rB = getRaceBonus(race);
  const cB = getClassBonus(charClass);
  const base = applyAwakeningToBase({
    hp: raw.hp+rB.hp+cB.hp,
    auto: raw.auto+rB.auto+cB.auto,
    def: raw.def+rB.def+cB.def,
    cap: raw.cap+rB.cap+cB.cap,
    rescap: raw.rescap+rB.rescap+cB.rescap,
    spd: raw.spd+rB.spd+cB.spd
  }, awakeningEffect);
  return {
    name, race, class: charClass, base, level,
    bonuses: { race: rB, class: cB },
    currentHP: base.hp, maxHP: base.hp,
    cd: { war: 0, rog: 0, pal: 0, heal: 0, arc: 0, mag: 0, dem: 0, maso: 0 },
    undead: false, dodge: false, reflect: false,
    bleed_stacks: 0, bleedPercentPerStack: 0,
    maso_taken: 0, familiarStacks: 0,
    firstSpellCapBoostUsed: false,
    awakening: buildAwakeningState(awakeningEffect)
  };
};

const reviveUndead = (target, attacker) => {
  const revivePercent = target.awakening?.revivePercent ?? raceConstants.mortVivant.revivePercent;
  const revive = Math.max(1, Math.round(revivePercent * target.maxHP));
  const explosionPercent = target.awakening?.explosionPercent ?? 0;
  if (attacker && explosionPercent > 0) {
    let explosion = Math.max(1, Math.round(explosionPercent * target.maxHP));
    if (attacker.awakening?.damageTakenMultiplier) {
      explosion = Math.max(1, Math.round(explosion * attacker.awakening.damageTakenMultiplier));
    }
    attacker.currentHP -= explosion;
    if (attacker.awakening?.damageStackBonus) {
      attacker.awakening.damageTakenStacks += 1;
    }
  }
  target.undead = true;
  target.currentHP = revive;
};

const applyIncomingAwakeningModifiers = (defender, damage) => {
  let adjusted = damage;
  if (defender.awakening?.incomingHitMultiplier && defender.awakening.incomingHitCountRemaining > 0) {
    adjusted = Math.round(adjusted * defender.awakening.incomingHitMultiplier);
    defender.awakening.incomingHitCountRemaining -= 1;
  }
  if (defender.awakening?.damageTakenMultiplier) {
    adjusted = Math.round(adjusted * defender.awakening.damageTakenMultiplier);
  }
  return adjusted;
};

const applyOutgoingAwakeningMultiplier = (attacker, baseMultiplier) => {
  let mult = baseMultiplier;
  if (attacker.awakening?.highHpDamageBonus && attacker.currentHP > attacker.maxHP * (attacker.awakening.highHpThreshold ?? 1)) {
    mult *= 1 + attacker.awakening.highHpDamageBonus;
  }
  if (attacker.awakening?.damageStackBonus && attacker.awakening.damageTakenStacks > 0) {
    mult *= 1 + attacker.awakening.damageStackBonus * attacker.awakening.damageTakenStacks;
  }
  return mult;
};

const processTurn = (p1, p2) => {
  const first = p1.base.spd >= p2.base.spd ? p1 : p2;
  const second = first === p1 ? p2 : p1;

  [first, second].forEach((att) => {
    const def = att === first ? second : first;
    if (att.currentHP <= 0 || def.currentHP <= 0) return;

    att.reflect = false;
    const consumeAuraSpellCapMultiplier = () => {
      if (att.mageTowerPassive?.id !== 'aura_overload') return 1;
      if (att.firstSpellCapBoostUsed) return 1;
      att.firstSpellCapBoostUsed = true;
      const levelData = getMageTowerPassiveLevel('aura_overload', att.mageTowerPassive?.level ?? 1);
      return 1 + (levelData?.spellCapBonus ?? 0);
    };
    for (const k of Object.keys(cooldowns)) {
      att.cd[k] = (att.cd[k] % cooldowns[k]) + 1;
    }

    // Sylvari - Régénération
    if (att.race === 'Sylvari') {
      const regenPercent = att.awakening?.regenPercent ?? raceConstants.sylvari.regenPercent;
      const heal = Math.max(1, Math.round(att.maxHP * regenPercent));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
    }

    // Demoniste - Familier
    if (att.class === 'Demoniste') {
      const { capBase, capPerCap, ignoreResist, stackPerAuto } = classConstants.demoniste;
      const stackBonus = stackPerAuto * (att.familiarStacks || 0);
      const hit = Math.max(1, Math.round((capBase + capPerCap * att.base.cap + stackBonus) * att.base.cap));
      let raw = dmgCap(hit, def.base.rescap * (1 - ignoreResist));
      raw = applyIncomingAwakeningModifiers(def, raw);
      def.currentHP -= raw;
      if (raw > 0 && def.awakening?.damageStackBonus) {
        def.awakening.damageTakenStacks += 1;
      }
      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def, att);
      }
    }

    // Masochiste - Renvoi de dégâts
    if (att.class === 'Masochiste') {
      if (att.cd.maso === cooldowns.maso && att.maso_taken > 0) {
        const { returnBase, returnPerCap, healPercent } = classConstants.masochiste;
        const dmg = Math.max(1, Math.round(att.maso_taken * (returnBase + returnPerCap * att.base.cap)));
        const healAmount = Math.max(1, Math.round(att.maso_taken * healPercent));
        att.currentHP = Math.min(att.maxHP, att.currentHP + healAmount);
        att.maso_taken = 0;
        def.currentHP -= dmg;
        if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
          reviveUndead(def, att);
        }
      }
    }

    // Lycan - Saignement
    if (att.bleed_stacks > 0) {
      let bleedDmg = att.bleedPercentPerStack
        ? Math.max(1, Math.round(att.maxHP * att.bleedPercentPerStack * att.bleed_stacks))
        : Math.ceil(att.bleed_stacks / raceConstants.lycan.bleedDivisor);
      if (att.awakening?.damageTakenMultiplier) {
        bleedDmg = Math.max(1, Math.round(bleedDmg * att.awakening.damageTakenMultiplier));
      }
      att.currentHP -= bleedDmg;
      if (att.currentHP <= 0 && att.race === 'Mort-vivant' && !att.undead) {
        reviveUndead(att, def);
      }
    }

    // Paladin - Riposte
    if (att.class === 'Paladin' && att.cd.pal === cooldowns.pal) {
      const { reflectBase, reflectPerCap } = classConstants.paladin;
      att.reflect = reflectBase + reflectPerCap * att.base.cap;
    }

    // Healer - Soin
    if (att.class === 'Healer' && att.cd.heal === cooldowns.heal) {
      const miss = att.maxHP - att.currentHP;
      const { missingHpPercent, capScale } = classConstants.healer;
      const spellCapMultiplier = consumeAuraSpellCapMultiplier();
      const heal = Math.max(1, Math.round(missingHpPercent * miss + capScale * att.base.cap * spellCapMultiplier));
      att.currentHP = Math.min(att.maxHP, att.currentHP + heal);
    }

    // Voleur - Esquive
    if (att.class === 'Voleur' && att.cd.rog === cooldowns.rog) {
      att.dodge = true;
    }

    const isMage = att.class === 'Mage' && att.cd.mag === cooldowns.mag;
    const isWar = att.class === 'Guerrier' && att.cd.war === cooldowns.war;
    const isArcher = att.class === 'Archer' && att.cd.arc === cooldowns.arc;

    // Orc - Bonus dégâts sous 50% PV
    let mult = 1.0;
    if (att.race === 'Orc' && att.currentHP < raceConstants.orc.lowHpThreshold * att.maxHP) {
      mult = raceConstants.orc.damageBonus;
    }
    mult = applyOutgoingAwakeningMultiplier(att, mult);

    // Archer - Tirs multiples
    const hits = isArcher ? classConstants.archer.hitCount : 1;

    for (let i = 0; i < hits; i++) {
      const isCrit = Math.random() < calcCritChance(att);
      let raw = 0;

      if (isMage) {
        // Mage - Sort magique
        const { capBase, capPerCap } = classConstants.mage;
        const spellCapMultiplier = consumeAuraSpellCapMultiplier();
        const scaledCap = att.base.cap * spellCapMultiplier;
        const atkSpell = Math.round(att.base.auto * mult + (capBase + capPerCap * scaledCap) * scaledCap * mult);
        raw = dmgCap(atkSpell, def.base.rescap);
      } else if (isWar) {
        // Guerrier - Frappe pénétrante
        const { ignoreBase, ignorePerCap } = classConstants.guerrier;
        const ignore = ignoreBase + ignorePerCap * att.base.cap;
        if (def.base.def <= def.base.rescap) {
          const effDef = Math.max(0, Math.round(def.base.def * (1 - ignore)));
          raw = dmgPhys(Math.round(att.base.auto * mult), effDef);
        } else {
          const effRes = Math.max(0, Math.round(def.base.rescap * (1 - ignore)));
          raw = dmgCap(Math.round(att.base.cap * mult), effRes);
        }
      } else if (isArcher) {
        if (i === 0) {
          raw = dmgPhys(Math.round(att.base.auto * mult), def.base.def);
        } else {
          const { hit2AutoMultiplier, hit2CapMultiplier } = classConstants.archer;
          const physPart = dmgPhys(Math.round(att.base.auto * hit2AutoMultiplier * mult), def.base.def);
          const capPart = dmgCap(Math.round(att.base.cap * hit2CapMultiplier * mult), def.base.rescap);
          raw = physPart + capPart;
        }
      } else {
        // Attaque normale
        raw = dmgPhys(Math.round(att.base.auto * mult), def.base.def);
        if (att.race === 'Lycan') {
          const bleedStacks = att.awakening?.bleedStacksPerHit ?? raceConstants.lycan.bleedPerHit;
          def.bleed_stacks = (def.bleed_stacks || 0) + bleedStacks;
          if (att.awakening?.bleedPercentPerStack) {
            def.bleedPercentPerStack = att.awakening.bleedPercentPerStack;
          }
        }
      }

      if (isCrit) raw = Math.round(raw * getCritMultiplier(att));

      // Esquive
      if (def.dodge) {
        def.dodge = false;
        raw = 0;
      }

      raw = applyIncomingAwakeningModifiers(def, raw);
      def.currentHP -= raw;
      if (raw > 0 && def.awakening?.damageStackBonus) {
        def.awakening.damageTakenStacks += 1;
      }
      // Riposte Paladin (après avoir encaissé les dégâts)
      if (def.reflect && raw > 0 && def.currentHP > 0) {
        const back = Math.round(def.reflect * raw);
        att.currentHP -= back;
      }
      if (att.class === 'Demoniste' && !isMage && !isWar && !isArcher) {
        att.familiarStacks = (att.familiarStacks || 0) + 1;
      }
      if (raw > 0) def.maso_taken = (def.maso_taken || 0) + raw;

      if (def.currentHP <= 0 && def.race === 'Mort-vivant' && !def.undead) {
        reviveUndead(def, att);
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

export const runSimulation = (numCombats = 1000) => {
  console.log(`🎮 Simulation de ${numCombats} combats...`);

  const results = [];
  const raceWins = {};
  const classWins = {};
  const raceCombats = {};
  const classCombats = {};
  let totalTurns = 0;

  // Initialiser les compteurs
  Object.keys(races).forEach(race => {
    raceWins[race] = 0;
    raceCombats[race] = 0;
  });
  Object.keys(classes).forEach(cls => {
    classWins[cls] = 0;
    classCombats[cls] = 0;
  });

  // Lancer les simulations
  for (let i = 0; i < numCombats; i++) {
    const result = simulateSingleCombat();
    results.push(result);
    totalTurns += result.turns;

    // Compter les races
    raceCombats[result.p1Race]++;
    raceCombats[result.p2Race]++;
    if (result.winner === 'P1') raceWins[result.p1Race]++;
    else raceWins[result.p2Race]++;

    // Compter les classes
    classCombats[result.p1Class]++;
    classCombats[result.p2Class]++;
    if (result.winner === 'P1') classWins[result.p1Class]++;
    else classWins[result.p2Class]++;
  }

  const avgTurns = (totalTurns / numCombats).toFixed(1);

  console.log('\n📊 RÉSULTATS DE LA SIMULATION\n');
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
    console.log(`  ${races[race].icon} ${race.padEnd(12)} - ${winRate}% (${wins}/${combats})`);
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
    console.log(`  ${classes[cls].icon} ${cls.padEnd(12)} - ${winRate}% (${wins}/${combats})`);
  });

  // Analyse de l'équilibrage
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
    console.log('  ❌ Déséquilibrage détecté');
  }

  return { sortedRaces, sortedClasses, avgTurns, raceSpread, classSpread };
};
