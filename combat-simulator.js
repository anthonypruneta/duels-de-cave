// Simulateur de combats pour tester l'équilibrage des classes

// Formule de scaling par paliers
const getScaling = (cap, basePercent, bonusPerPalier) => {
  const paliers = Math.floor(cap / 15);
  return basePercent + (bonusPerPalier * paliers);
};

// Génération de stats aléatoires (comme dans CharacterCreation.jsx)
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

// Bonus de race
const getRaceBonus = (race) => {
  const b = {hp:0,auto:0,def:0,cap:0,rescap:0,spd:0};
  if (race==='Humain') {b.hp=10;b.auto=1;b.def=1;b.cap=1;b.rescap=1;b.spd=1;}
  else if (race==='Nain') {b.hp=10;b.def=4;}
  else if (race==='Dragonkin') {b.hp=10;b.rescap=15;}
  else if (race==='Elfe') {b.auto=1;b.cap=1;b.spd=5;}
  return b;
};

// Bonus de classe
const getClassBonus = (clazz) => {
  const b = {hp:0,auto:0,def:0,cap:0,rescap:0,spd:0};
  if (clazz==='Voleur') b.spd=5;
  if (clazz==='Guerrier') b.auto=3;
  if (clazz==='Healer') b.auto=2; // Nerfé de +3 à +2
  return b;
};

// Créer un personnage
const createCharacter = (race, clazz) => {
  const base = genStats();
  const raceB = getRaceBonus(race);
  const classB = getClassBonus(clazz);

  const stats = {
    hp: base.hp + raceB.hp + classB.hp,
    auto: base.auto + raceB.auto + classB.auto,
    def: base.def + raceB.def + classB.def,
    cap: base.cap + raceB.cap + classB.cap,
    rescap: base.rescap + raceB.rescap + classB.rescap,
    spd: base.spd + raceB.spd + classB.spd
  };

  return {
    race,
    class: clazz,
    stats,
    currentHp: stats.hp,
    abilityCD: 0,
    damageReceived: 0, // Pour Masochiste
    hasRevived: false,  // Pour Mort-vivant
    bleedStacks: 0     // Pour Lycan
  };
};

// Calculer les dégâts de base
const calculateBaseDamage = (attacker, defender) => {
  const baseDmg = Math.max(1, attacker.stats.auto - defender.stats.def);

  // Bonus Elfe: +20% crit
  let critChance = 0.05;
  if (attacker.race === 'Elfe') critChance += 0.20;

  // Voleur: +15% crit par palier (buffé de +10%)
  if (attacker.class === 'Voleur') {
    const paliers = Math.floor(attacker.stats.cap / 15);
    critChance += paliers * 0.15;
  }

  const isCrit = Math.random() < critChance;
  // Voleur: crit damage x2 au lieu de x1.5
  const critMultiplier = (attacker.class === 'Voleur') ? 2.0 : 1.5;
  let dmg = isCrit ? baseDmg * critMultiplier : baseDmg;

  // Orc: +20% dégâts sous 50% HP
  if (attacker.race === 'Orc' && attacker.currentHp < attacker.stats.hp * 0.5) {
    dmg *= 1.20;
  }

  return Math.floor(dmg);
};

// Utiliser une capacité de classe
const useAbility = (attacker, defender, turn) => {
  let dmg = 0;
  let heal = 0;
  let effects = [];

  const cap = attacker.stats.cap;

  switch (attacker.class) {
    case 'Guerrier':
      if (turn % 3 === 0) {
        // Frappe résistance la plus faible
        const minRes = Math.min(defender.stats.def, defender.stats.rescap);
        const ignorePct = getScaling(cap, 8, 2) / 100; // Nerfé de 10%+2% à 8%+2%
        const effectiveRes = minRes * (1 - ignorePct);
        dmg = Math.max(1, attacker.stats.auto - effectiveRes);
        effects.push('Frappe pénétrante');
      }
      break;

    case 'Voleur':
      if (turn % 2 === 0) { // Buffé de CD3 à CD2
        effects.push('Esquive');
        attacker.dodgeNext = true;
      }
      break;

    case 'Paladin':
      // Riposte est maintenant gérée comme passif permanent (voir combat loop)
      // Pas de capacité spéciale, le Paladin attaque normalement + riposte
      break;

    case 'Healer':
      if (turn % 2 === 0) { // Buffé de CD3 à CD2
        const missingHp = attacker.stats.hp - attacker.currentHp;
        const baseHeal = missingHp * 0.20;
        const capHealPct = getScaling(cap, 25, 5) / 100;
        heal = Math.floor(baseHeal + (cap * capHealPct));
        attacker.currentHp = Math.min(attacker.stats.hp, attacker.currentHp + heal);
        effects.push(`Heal ${heal} PV`);
      }
      break;

    case 'Archer':
      if (turn % 3 === 0) {
        const paliers = Math.floor(cap / 15);
        const arrows = 2 + paliers;
        dmg = calculateBaseDamage(attacker, defender) * arrows;
        effects.push(`${arrows} flèches`);
      }
      break;

    case 'Mage':
      if (turn % 3 === 0) {
        const magicPct = getScaling(cap, 40, 5) / 100;
        const magicDmg = cap * magicPct;
        dmg = Math.max(1, attacker.stats.auto + magicDmg - defender.stats.rescap);
        effects.push('Sort magique');
      }
      break;

    case 'Demoniste':
      // PASSIF - Attaque tous les tours !
      const familierPct = getScaling(cap, 15, 3) / 100; // Buffé de 10%+2% à 15%+3%
      dmg = Math.floor(cap * familierPct);
      effects.push('Familier');
      break;

    case 'Masochiste':
      if (turn % 4 === 0 && attacker.damageReceived > 0) {
        const returnPct = getScaling(cap, 60, 12) / 100; // Buffé de 50%+10% à 60%+12%
        dmg = Math.floor(attacker.damageReceived * returnPct);
        attacker.damageReceived = 0;
        effects.push(`Renvoie ${dmg} dégâts`);
      }
      break;
  }

  return { dmg, heal, effects };
};

// Combat complet
const simulateCombat = (char1, char2, maxTurns = 100, trackTurns = false) => {
  let turn = 0;

  // Reset HP
  char1.currentHp = char1.stats.hp;
  char2.currentHp = char2.stats.hp;
  char1.damageReceived = 0;
  char2.damageReceived = 0;
  char1.hasRevived = false;
  char2.hasRevived = false;
  char1.bleedStacks = 0;
  char2.bleedStacks = 0;

  while (turn < maxTurns && char1.currentHp > 0 && char2.currentHp > 0) {
    turn++;

    // Déterminer l'ordre (vitesse)
    const attackers = char1.stats.spd >= char2.stats.spd
      ? [char1, char2]
      : [char2, char1];

    for (const attacker of attackers) {
      if (char1.currentHp <= 0 || char2.currentHp <= 0) break;

      const defender = attacker === char1 ? char2 : char1;

      // Régénération Sylvari
      if (attacker.race === 'Sylvari') {
        const regen = Math.floor(attacker.stats.hp * 0.02);
        attacker.currentHp = Math.min(attacker.stats.hp, attacker.currentHp + regen);
      }

      // Saignement Lycan
      if (attacker.bleedStacks > 0) {
        const bleedDmg = Math.ceil(attacker.bleedStacks / 3);
        attacker.currentHp -= bleedDmg;
        if (attacker.currentHp <= 0 && attacker.race === 'Mort-vivant' && !attacker.hasRevived) {
          attacker.currentHp = Math.floor(attacker.stats.hp * 0.20);
          attacker.hasRevived = true;
        }
        if (attacker.currentHp <= 0) break;
      }

      // Esquive du Voleur
      if (defender.dodgeNext) {
        defender.dodgeNext = false;
        continue;
      }

      // Paladin: Riposte permanente (passif)
      if (attacker.class === 'Paladin') {
        const ripostePct = getScaling(attacker.stats.cap, 70, 12) / 100;
        attacker.ripostePercent = ripostePct;
      }

      // Utiliser capacité
      const ability = useAbility(attacker, defender, turn);
      let totalDmg = ability.dmg;

      // Si pas de capacité spéciale OU capacité de support (heal/esquive), attaque normale
      // Le Healer et Voleur doivent attaquer même quand ils utilisent leur capacité
      const supportAbility = ability.heal > 0 || ability.effects.includes('Esquive');

      if (totalDmg === 0) {
        totalDmg = calculateBaseDamage(attacker, defender);
      }

      // Appliquer dégâts
      defender.currentHp -= totalDmg;
      defender.damageReceived += totalDmg;

      // Lycan: ajouter stack de saignement
      if (attacker.race === 'Lycan' && totalDmg > 0) {
        defender.bleedStacks += 1;
      }

      // Riposte Paladin
      if (defender.ripostePercent && totalDmg > 0) {
        const riposteDmg = Math.floor(totalDmg * defender.ripostePercent);
        attacker.currentHp -= riposteDmg;
        defender.ripostePercent = 0;
      }

      // Mort-vivant: revient à 20% HP
      if (defender.currentHp <= 0 && defender.race === 'Mort-vivant' && !defender.hasRevived) {
        defender.currentHp = Math.floor(defender.stats.hp * 0.20);
        defender.hasRevived = true;
      }
    }
  }

  // Résultat
  if (trackTurns) {
    if (char1.currentHp > 0 && char2.currentHp <= 0) return { winner: 'char1', turns: turn };
    if (char2.currentHp > 0 && char1.currentHp <= 0) return { winner: 'char2', turns: turn };
    return { winner: 'draw', turns: turn };
  }

  if (char1.currentHp > 0 && char2.currentHp <= 0) return 'char1';
  if (char2.currentHp > 0 && char1.currentHp <= 0) return 'char2';
  return 'draw';
};

// Simulation massive
const runSimulations = (count = 1000, analyzeRaces = false) => {
  const classes = ['Guerrier', 'Voleur', 'Paladin', 'Healer', 'Archer', 'Mage', 'Demoniste', 'Masochiste'];
  const races = ['Humain', 'Elfe', 'Orc', 'Nain', 'Dragonkin', 'Mort-vivant', 'Lycan', 'Sylvari'];

  const results = {};
  const raceResults = {};

  // Initialiser résultats
  for (const c of classes) {
    results[c] = { wins: 0, losses: 0, draws: 0 };
  }
  for (const r of races) {
    raceResults[r] = { wins: 0, losses: 0, draws: 0 };
  }

  const target = analyzeRaces ? 'race' : 'classe';
  console.log(`🎲 Simulation de ${count} combats par ${target}...\\n`);

  for (let i = 0; i < count; i++) {
    // Créer 2 personnages aléatoires
    const race1 = races[Math.floor(Math.random() * races.length)];
    const class1 = classes[Math.floor(Math.random() * classes.length)];
    const char1 = createCharacter(race1, class1);

    const race2 = races[Math.floor(Math.random() * races.length)];
    const class2 = classes[Math.floor(Math.random() * classes.length)];
    const char2 = createCharacter(race2, class2);

    const result = simulateCombat(char1, char2);

    if (result === 'char1') {
      results[class1].wins++;
      results[class2].losses++;
      raceResults[race1].wins++;
      raceResults[race2].losses++;
    } else if (result === 'char2') {
      results[class2].wins++;
      results[class1].losses++;
      raceResults[race2].wins++;
      raceResults[race1].losses++;
    } else {
      results[class1].draws++;
      results[class2].draws++;
      raceResults[race1].draws++;
      raceResults[race2].draws++;
    }
  }

  // Afficher résultats
  if (!analyzeRaces) {
    console.log('📊 Résultats des simulations (CLASSES):\\n');
    console.log('Classe        | Victoires | Défaites | Égalités | Winrate');
    console.log('------------- | --------- | -------- | -------- | -------');

    const sortedClasses = Object.keys(results).sort((a, b) => {
      const wrA = results[a].wins / (results[a].wins + results[a].losses + results[a].draws);
      const wrB = results[b].wins / (results[b].wins + results[b].losses + results[b].draws);
      return wrB - wrA;
    });

    for (const clazz of sortedClasses) {
      const r = results[clazz];
      const total = r.wins + r.losses + r.draws;
      const winrate = ((r.wins / total) * 100).toFixed(1);
      console.log(`${clazz.padEnd(13)} | ${String(r.wins).padStart(9)} | ${String(r.losses).padStart(8)} | ${String(r.draws).padStart(8)} | ${winrate}%`);
    }
  } else {
    console.log('📊 Résultats des simulations (RACES):\\n');
    console.log('Race          | Victoires | Défaites | Égalités | Winrate');
    console.log('------------- | --------- | -------- | -------- | -------');

    const sortedRaces = Object.keys(raceResults).sort((a, b) => {
      const wrA = raceResults[a].wins / (raceResults[a].wins + raceResults[a].losses + raceResults[a].draws);
      const wrB = raceResults[b].wins / (raceResults[b].wins + raceResults[b].losses + raceResults[b].draws);
      return wrB - wrA;
    });

    for (const race of sortedRaces) {
      const r = raceResults[race];
      const total = r.wins + r.losses + r.draws;
      const winrate = ((r.wins / total) * 100).toFixed(1);
      console.log(`${race.padEnd(13)} | ${String(r.wins).padStart(9)} | ${String(r.losses).padStart(8)} | ${String(r.draws).padStart(8)} | ${winrate}%`);
    }
  }
};

// Analyser la durée des combats
const analyzeCombatDuration = (count = 1000) => {
  const classes = ['Guerrier', 'Voleur', 'Paladin', 'Healer', 'Archer', 'Mage', 'Demoniste', 'Masochiste'];
  const races = ['Humain', 'Elfe', 'Orc', 'Nain', 'Dragonkin', 'Mort-vivant', 'Lycan', 'Sylvari'];

  let totalTurns = 0;
  let minTurns = Infinity;
  let maxTurns = 0;
  const turnDistribution = {};

  console.log(`🎲 Analyse de la durée de ${count} combats...\\n`);

  for (let i = 0; i < count; i++) {
    const race1 = races[Math.floor(Math.random() * races.length)];
    const class1 = classes[Math.floor(Math.random() * classes.length)];
    const char1 = createCharacter(race1, class1);

    const race2 = races[Math.floor(Math.random() * races.length)];
    const class2 = classes[Math.floor(Math.random() * classes.length)];
    const char2 = createCharacter(race2, class2);

    const result = simulateCombat(char1, char2, 100, true);
    const turns = result.turns;

    totalTurns += turns;
    minTurns = Math.min(minTurns, turns);
    maxTurns = Math.max(maxTurns, turns);

    const bucket = Math.floor(turns / 5) * 5; // Groupes de 5 tours
    turnDistribution[bucket] = (turnDistribution[bucket] || 0) + 1;
  }

  const avgTurns = (totalTurns / count).toFixed(1);

  console.log(`📊 Statistiques de durée des combats:\\n`);
  console.log(`Durée moyenne: ${avgTurns} tours`);
  console.log(`Min: ${minTurns} tours | Max: ${maxTurns} tours\\n`);

  console.log('Distribution par tranches de 5 tours:');
  const sortedBuckets = Object.keys(turnDistribution).map(Number).sort((a, b) => a - b);
  for (const bucket of sortedBuckets) {
    const count = turnDistribution[bucket];
    const pct = ((count / 1000) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(count / 20));
    console.log(`${String(bucket).padStart(2)}-${String(bucket + 4).padStart(2)} tours: ${bar} ${count} (${pct}%)`);
  }
};

// Lancer les simulations
// runSimulations(10000, true); // true = analyser les races
analyzeCombatDuration(1000);
