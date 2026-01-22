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
    hasRevived: false  // Pour Mort-vivant
  };
};

// Calculer les dégâts de base
const calculateBaseDamage = (attacker, defender) => {
  const baseDmg = Math.max(1, attacker.stats.auto - defender.stats.def);

  // Bonus Elfe: +20% crit
  let critChance = 0.05;
  if (attacker.race === 'Elfe') critChance += 0.20;

  // Voleur: +5% crit par palier
  if (attacker.class === 'Voleur') {
    const paliers = Math.floor(attacker.stats.cap / 15);
    critChance += paliers * 0.05;
  }

  const isCrit = Math.random() < critChance;
  let dmg = isCrit ? baseDmg * 1.5 : baseDmg;

  // Orc: +20% dégâts sous 50% HP
  if (attacker.race === 'Orc' && attacker.currentHp < attacker.stats.hp * 0.5) {
    dmg *= 1.20;
  }

  // Lycan: saignement (pas implémenté ici, compterait +1/tour)

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
        const ignorePct = getScaling(cap, 15, 3) / 100; // Nerfé de 20%+5% à 15%+3%
        const effectiveRes = minRes * (1 - ignorePct);
        dmg = Math.max(1, attacker.stats.auto - effectiveRes);
        effects.push('Frappe pénétrante');
      }
      break;

    case 'Voleur':
      if (turn % 3 === 0) { // Buffé de CD4 à CD3
        effects.push('Esquive');
        attacker.dodgeNext = true;
      }
      break;

    case 'Paladin':
      if (turn % 2 === 0) {
        const ripostePct = getScaling(cap, 50, 8) / 100; // Buffé de 30%+5% à 50%+8%
        attacker.ripostePercent = ripostePct;
        effects.push(`Riposte ${(ripostePct*100).toFixed(0)}%`);
      }
      break;

    case 'Healer':
      if (turn % 4 === 0) { // Buffé de CD5 à CD4
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
      const familierPct = getScaling(cap, 10, 2) / 100;
      dmg = Math.floor(cap * familierPct);
      effects.push('Familier');
      break;

    case 'Masochiste':
      if (turn % 4 === 0 && attacker.damageReceived > 0) {
        const returnPct = getScaling(cap, 20, 4) / 100; // Buffé de 10%+2% à 20%+4%
        dmg = Math.floor(attacker.damageReceived * returnPct);
        attacker.damageReceived = 0;
        effects.push(`Renvoie ${dmg} dégâts`);
      }
      break;
  }

  return { dmg, heal, effects };
};

// Combat complet
const simulateCombat = (char1, char2, maxTurns = 100) => {
  let turn = 0;

  // Reset HP
  char1.currentHp = char1.stats.hp;
  char2.currentHp = char2.stats.hp;
  char1.damageReceived = 0;
  char2.damageReceived = 0;
  char1.hasRevived = false;
  char2.hasRevived = false;

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

      // Esquive du Voleur
      if (defender.dodgeNext) {
        defender.dodgeNext = false;
        continue;
      }

      // Utiliser capacité
      const ability = useAbility(attacker, defender, turn);
      let totalDmg = ability.dmg;

      // Si pas de capacité spéciale, attaque normale
      if (totalDmg === 0 && ability.effects.length === 0) {
        totalDmg = calculateBaseDamage(attacker, defender);
      }

      // Appliquer dégâts
      defender.currentHp -= totalDmg;
      defender.damageReceived += totalDmg;

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
  if (char1.currentHp > 0 && char2.currentHp <= 0) return 'char1';
  if (char2.currentHp > 0 && char1.currentHp <= 0) return 'char2';
  return 'draw';
};

// Simulation massive
const runSimulations = (count = 1000) => {
  const classes = ['Guerrier', 'Voleur', 'Paladin', 'Healer', 'Archer', 'Mage', 'Demoniste', 'Masochiste'];
  const races = ['Humain', 'Elfe', 'Orc', 'Nain', 'Dragonkin', 'Mort-vivant', 'Lycan', 'Sylvari'];

  const results = {};

  // Initialiser résultats
  for (const c of classes) {
    results[c] = { wins: 0, losses: 0, draws: 0 };
  }

  console.log(`🎲 Simulation de ${count} combats par classe...\\n`);

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
    } else if (result === 'char2') {
      results[class2].wins++;
      results[class1].losses++;
    } else {
      results[class1].draws++;
      results[class2].draws++;
    }
  }

  // Afficher résultats
  console.log('📊 Résultats des simulations:\\n');
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
};

// Lancer les simulations
runSimulations(10000);
