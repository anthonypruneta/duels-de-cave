/**
 * Système de titres rares — Duels de Cave
 *
 * Chaque titre a un ID unique, un nom masculin/féminin,
 * une description de la condition, et un détecteur.
 */

export const TITLES = {
  // ======================== TITRES GÉNÉRAUX ========================

  grosse_cave: {
    id: 'grosse_cave',
    male: 'le Gros Cave',
    female: 'la Grosse Cave',
    description: 'Perdre alors que l\'ennemi avait 1 PV',
    icon: '🤡',
    category: 'general',
  },
  miracle: {
    id: 'miracle',
    male: 'le Miraculé',
    female: 'la Miraculée',
    description: 'Gagner un combat avec 1 PV restant',
    icon: '🍀',
    category: 'general',
  },
  intouchable: {
    id: 'intouchable',
    male: 'l\'Intouchable',
    female: 'l\'Intouchable',
    description: 'Gagner un combat de tournoi sans prendre de dégâts',
    icon: '🛡️',
    category: 'general',
  },
  boucher: {
    id: 'boucher',
    male: 'le Boucher',
    female: 'la Bouchère',
    description: 'One-shot un ennemi en tournoi',
    icon: '🪓',
    category: 'general',
  },
  fleau_labyrinthe: {
    id: 'fleau_labyrinthe',
    male: 'Dieu du Labyrinthe',
    female: 'Déesse du Labyrinthe',
    description: 'Vaincre l\'étage 120 du Labyrinthe Infini',
    icon: '🌀',
    category: 'general',
  },
  maudit: {
    id: 'maudit',
    male: 'le Maudit',
    female: 'la Maudite',
    description: 'Perdre au 1er tour du tournoi 3 semaines de suite',
    icon: '💀',
    category: 'general',
  },
  tueur_dieu: {
    id: 'tueur_dieu',
    male: 'Tueur de Dieu',
    female: 'Tueuse de Dieu',
    description: 'Battre Ornn en moins de 5 tours',
    icon: '⚡',
    category: 'general',
  },
  sang_froid: {
    id: 'sang_froid',
    male: 'Sang-Froid',
    female: 'Sang-Froid',
    description: 'Gagner un combat de tournoi après être passé sous 10% PV au moins 3 fois',
    icon: '🧊',
    category: 'general',
  },
  legendaire: {
    id: 'legendaire',
    male: 'le Légendaire',
    female: 'la Légendaire',
    description: 'Remporter 2 tournois (via Hall of Fame)',
    icon: '👑',
    category: 'general',
  },
  survivant: {
    id: 'survivant',
    male: 'le Survivant',
    female: 'la Survivante',
    description: 'Compléter le Boss Rush',
    icon: '💀',
    category: 'general',
  },

  // ======================== TITRES RACIAUX ========================

  title_humain: {
    id: 'title_humain',
    male: 'le Polyvalent',
    female: 'la Polyvalente',
    description: 'Gagner un combat avec toutes les stats sous la moyenne adverse',
    icon: '👥',
    category: 'racial',
    race: 'Humain',
  },
  title_elfe: {
    id: 'title_elfe',
    male: 'l\'Assassin',
    female: 'l\'Assassine',
    description: 'Réaliser 3 critiques consécutifs dans un combat',
    icon: '🧝',
    category: 'racial',
    race: 'Elfe',
  },
  title_orc: {
    id: 'title_orc',
    male: 'le Berserker',
    female: 'la Berserker',
    description: 'Gagner en étant sous 10% PV grâce au bonus Orc',
    icon: '🪓',
    category: 'racial',
    race: 'Orc',
  },
  title_nain: {
    id: 'title_nain',
    male: 'le Mur',
    female: 'la Muraille',
    description: 'Subir 30+ coups et gagner',
    icon: '⛏️',
    category: 'racial',
    race: 'Nain',
  },
  title_dragonkin: {
    id: 'title_dragonkin',
    male: 'Écaille d\'Acier',
    female: 'Écaille d\'Acier',
    description: 'Accumuler 50%+ de PV max en dégâts de rage Dragonkin',
    icon: '🐲',
    category: 'racial',
    race: 'Dragonkin',
  },
  title_mortvivant: {
    id: 'title_mortvivant',
    male: 'le Revenant',
    female: 'la Revenante',
    description: 'Gagner grâce à la résurrection Mort-vivant',
    icon: '☠️',
    category: 'racial',
    race: 'Mort-vivant',
  },
  title_lycan: {
    id: 'title_lycan',
    male: 'Crocs Éternels',
    female: 'Crocs Éternels',
    description: 'Tuer un ennemi uniquement avec le saignement',
    icon: '🐺',
    category: 'racial',
    race: 'Lycan',
  },
  title_sylvari: {
    id: 'title_sylvari',
    male: 'Cœur de Chêne',
    female: 'Cœur de Chêne',
    description: 'Régénérer plus de 50% de ses PV max au cours d\'un combat',
    icon: '🌿',
    category: 'racial',
    race: 'Sylvari',
  },
  title_gnome: {
    id: 'title_gnome',
    male: 'le Filou',
    female: 'la Filoute',
    description: 'Gagner un combat avec un avantage de vitesse décisif',
    icon: '🧬',
    category: 'racial',
    race: 'Gnome',
  },
  title_sirene: {
    id: 'title_sirene',
    male: 'Voix des Abysses',
    female: 'Voix des Abysses',
    description: 'Atteindre le maximum de stacks Sirène dans un combat',
    icon: '🧜',
    category: 'racial',
    race: 'Sirène',
  },
  title_mindflayer: {
    id: 'title_mindflayer',
    male: 'le Parasite',
    female: 'la Parasite',
    description: 'Copier un sort et gagner grâce à ce sort copié',
    icon: '🦑',
    category: 'racial',
    race: 'Mindflayer',
  },
  title_turtlekin: {
    id: 'title_turtlekin',
    male: 'Forteresse Vivante',
    female: 'Forteresse Vivante',
    description: 'Gagner un combat où la carapace a réduit un coup de plus de 30% de vos PV max',
    icon: '🐢',
    category: 'racial',
    race: 'Turtlekin',
  },

  // ======================== NOUVEAUX TITRES ========================

  speedrunner: {
    id: 'speedrunner',
    male: 'l\'Éclair',
    female: 'l\'Éclair',
    description: 'Gagner un combat en 3 tours ou moins',
    icon: '🏃',
    category: 'general',
  },
  eternel: {
    id: 'eternel',
    male: 'l\'Éternel',
    female: 'l\'Éternelle',
    description: 'Gagner un combat en mort subite (tour 30)',
    icon: '⏳',
    category: 'general',
  },
  comeback: {
    id: 'comeback',
    male: 'le Phénix',
    female: 'le Phénix',
    description: 'Gagner après être passé sous 5% PV',
    icon: '🔥',
    category: 'general',
  },
  crit_machine: {
    id: 'crit_machine',
    male: 'Machine à Crits',
    female: 'Machine à Crits',
    description: 'Réaliser 5+ critiques dans un combat',
    icon: '💥',
    category: 'general',
  },
  pacifiste: {
    id: 'pacifiste',
    male: 'le Stratège',
    female: 'la Stratège',
    description: 'Gagner un combat de tournoi sans faire de critique',
    icon: '🕊️',
    category: 'general',
  },
  executeur: {
    id: 'executeur',
    male: 'l\'Exécuteur',
    female: 'l\'Exécutrice',
    description: 'Achever l\'ennemi avec une capacité spéciale',
    icon: '⚔️',
    category: 'general',
  },
  dominateur: {
    id: 'dominateur',
    male: 'le Dominateur',
    female: 'la Dominatrice',
    description: 'Gagner en tournoi sans jamais passer sous 50% PV',
    icon: '👊',
    category: 'general',
  },
  destruction: {
    id: 'destruction',
    male: 'Force Brute',
    female: 'Force Brute',
    description: 'Infliger un coup unique supérieur à 50% des PV max ennemis',
    icon: '💣',
    category: 'general',
  },
  tank_absolu: {
    id: 'tank_absolu',
    male: 'le Tank Absolu',
    female: 'le Tank Absolu',
    description: 'Subir plus de 200% de ses PV max en dégâts et gagner',
    icon: '🛡️',
    category: 'general',
  },
  ombre_fatale: {
    id: 'ombre_fatale',
    male: 'l\'Ombre Fatale',
    female: 'l\'Ombre Fatale',
    description: 'Esquiver 3+ attaques dans un combat',
    icon: '🌑',
    category: 'general',
  },
  miroir_parfait: {
    id: 'miroir_parfait',
    male: 'le Narcissique',
    female: 'le Narcissique',
    description: 'Gagner en mode miroir',
    icon: '🪞',
    category: 'general',
  },
  tueur_koro: {
    id: 'tueur_koro',
    male: 'le Diplômé',
    female: 'la Diplômée',
    description: 'Battre Koro Sensei en moins de 10 tours',
    icon: '🎓',
    category: 'general',
  },
  boss_rush_parfait: {
    id: 'boss_rush_parfait',
    male: 'l\'Impitoyable',
    female: 'l\'Impitoyable',
    description: 'Finir le Boss Rush sans descendre sous 30% PV',
    icon: '☠️',
    category: 'general',
  },
  maitre_soins: {
    id: 'maitre_soins',
    male: 'le Guérisseur Divin',
    female: 'la Guérisseuse Divine',
    description: 'Soigner 100%+ de ses PV max cumulés dans un combat',
    icon: '💚',
    category: 'general',
  },
  champion: {
    id: 'champion',
    male: 'le Champion',
    female: 'la Championne',
    description: 'Remporter un tournoi',
    icon: '🏆',
    category: 'general',
  },
  roi_labyrinthe: {
    id: 'roi_labyrinthe',
    male: 'Roi du Labyrinthe',
    female: 'Reine du Labyrinthe',
    description: 'Atteindre l\'étage 100 du Labyrinthe Infini',
    icon: '🏰',
    category: 'general',
  },
  full_stuff: {
    id: 'full_stuff',
    male: 'Full Stuff',
    female: 'Full Stuff',
    description: 'Avoir arme + passif niv3 + forge + extension + sous-classe',
    icon: '💎',
    category: 'general',
  },
  collectionneur: {
    id: 'collectionneur',
    male: 'le Collectionneur',
    female: 'la Collectionneuse',
    description: 'Débloquer 5+ bordures cosmétiques',
    icon: '🖼️',
    category: 'general',
  },
  sauveur_monde: {
    id: 'sauveur_monde',
    male: 'Sauveur du Monde',
    female: 'Sauveuse du Monde',
    description: 'Vaincre un Boss Mondial (Cataclysme)',
    icon: '🌍',
    category: 'general',
  },
  explorateur: {
    id: 'explorateur',
    male: 'l\'Explorateur',
    female: 'l\'Exploratrice',
    description: 'Compléter les 3 donjons de base (Donjon, Forêt, Tour)',
    icon: '🗺️',
    category: 'general',
  },
  colosse_mille: {
    id: 'colosse_mille',
    male: 'le Colosse',
    female: 'la Colosse',
    description: 'Dépasser 1000 PV sur le personnage (PV totaux)',
    icon: '❤️',
    category: 'general',
  },
  sommet_hp: {
    id: 'sommet_hp',
    male: 'le Géant',
    female: 'la Géante',
    description: 'Dépasser 200 en PV (stat totale)',
    icon: '🫀',
    category: 'general',
  },
  sommet_auto: {
    id: 'sommet_auto',
    male: 'le Destructeur',
    female: 'la Destructrice',
    description: 'Dépasser 200 en Auto (stat totale)',
    icon: '⚔️',
    category: 'general',
  },
  sommet_def: {
    id: 'sommet_def',
    male: 'le Rempart',
    female: 'la Forteresse',
    description: 'Dépasser 200 en Défense (stat totale)',
    icon: '🛡️',
    category: 'general',
  },
  sommet_cap: {
    id: 'sommet_cap',
    male: 'le Grand Arcaniste',
    female: 'la Grande Arcaniste',
    description: 'Dépasser 200 en Cap (stat totale)',
    icon: '🔮',
    category: 'general',
  },
  sommet_rescap: {
    id: 'sommet_rescap',
    male: 'le Paratonnerre',
    female: 'la Paratonnerre',
    description: 'Dépasser 200 en Résistance Cap (stat totale)',
    icon: '⚡',
    category: 'general',
  },
  sommet_spd: {
    id: 'sommet_spd',
    male: 'le Fulgurant',
    female: 'la Fulgurante',
    description: 'Dépasser 200 en Vitesse (stat totale)',
    icon: '💨',
    category: 'general',
  },
};

/**
 * Retourne le titre formaté selon le genre du personnage.
 */
export function getFormattedTitle(titleId, gender) {
  const title = TITLES[titleId];
  if (!title) return '';
  return gender === 'female' ? title.female : title.male;
}

/**
 * Retourne tous les titres existants triés par catégorie.
 */
export function getAllTitles() {
  return Object.values(TITLES);
}

/**
 * Détecte les titres obtenus après un combat en analysant les steps.
 *
 * @param {Array} steps - Steps retournées par simulerMatch
 * @param {Object} result - Résultat de simulerMatch { winnerId, loserId, p1MaxHP, p2MaxHP }
 * @param {Object} playerChar - Données du personnage du joueur (avec userId, race, gender)
 * @param {Object} context - Contexte : { mode, floor, bossId, ... }
 *   mode: 'tournoi' | 'donjon' | 'labyrinthe' | 'boss-rush' | 'forge' | 'mirror'
 * @returns {string[]} IDs des titres nouvellement détectés
 */
export function detectTitlesFromCombat(steps, result, playerChar, context = {}) {
  if (!steps?.length || !result || !playerChar) return [];

  const detected = [];
  const playerId = playerChar.userId;
  const isWinner = result.winnerId === playerId;
  const isLoser = !isWinner;
  // En tournoi, le joueur peut être P1 ou P2 ; en PvE il est toujours P1
  const playerIsP1 = context.playerIsP1 !== undefined ? context.playerIsP1 : true;

  const victoryStep = steps.find(s => s.phase === 'victory');
  const introStep = steps.find(s => s.phase === 'intro');
  const actionSteps = steps.filter(s => s.phase === 'action');

  if (!victoryStep) return detected;

  const finalP1HP = victoryStep.p1HP;
  const finalP2HP = victoryStep.p2HP;
  const playerFinalHP = playerIsP1 ? finalP1HP : finalP2HP;
  const enemyFinalHP = playerIsP1 ? finalP2HP : finalP1HP;
  const playerMaxHP = playerIsP1 ? result.p1MaxHP : result.p2MaxHP;

  // --- grosse_cave : perdre alors que l'ennemi a 1 PV ---
  if (isLoser && enemyFinalHP === 1) {
    detected.push('grosse_cave');
  }

  // --- miracle : gagner avec 1 PV restant ---
  if (isWinner && playerFinalHP === 1) {
    detected.push('miracle');
  }

  // --- intouchable : gagner sans prendre de dégâts (tournoi uniquement) ---
  if (isWinner && context.mode === 'tournoi') {
    const introHP = introStep ? (playerIsP1 ? introStep.p1HP : introStep.p2HP) : playerMaxHP;
    if (playerFinalHP >= introHP) {
      detected.push('intouchable');
    }
  }

  // --- boucher : one-shot en tournoi ---
  if (isWinner && context.mode === 'tournoi') {
    const enemyMaxHP = playerIsP1 ? result.p2MaxHP : result.p1MaxHP;
    const firstDamageAction = actionSteps.find(s => {
      const enemyHP = playerIsP1 ? s.p2HP : s.p1HP;
      return enemyHP <= 0;
    });
    if (firstDamageAction) {
      const prevStepIdx = steps.indexOf(firstDamageAction) - 1;
      if (prevStepIdx >= 0) {
        const prevEnemyHP = playerIsP1 ? steps[prevStepIdx].p2HP : steps[prevStepIdx].p1HP;
        if (prevEnemyHP >= enemyMaxHP) {
          detected.push('boucher');
        }
      }
    }
  }

  // --- tueur_dieu : battre Ornn en < 5 tours ---
  if (isWinner && context.bossId === 'ornn') {
    const lastTurnStep = [...steps].reverse().find(s => s.turn);
    if (lastTurnStep && lastTurnStep.turn < 5) {
      detected.push('tueur_dieu');
    }
  }

  // --- sang_froid : gagner après être passé sous 10% PV 3+ fois (tournoi) ---
  if (isWinner && context.mode === 'tournoi') {
    let timesBelow10 = 0;
    let wasBelow = false;
    for (const step of steps) {
      const hp = playerIsP1 ? step.p1HP : step.p2HP;
      const below = hp > 0 && hp < playerMaxHP * 0.1;
      if (below && !wasBelow) timesBelow10++;
      wasBelow = below;
    }
    if (timesBelow10 >= 3) {
      detected.push('sang_froid');
    }
  }

  // --- survivant : compléter le Boss Rush ---
  if (isWinner && context.mode === 'boss-rush' && context.isFinalBoss) {
    detected.push('survivant');
  }

  // --- fleau_labyrinthe : étage 120 ---
  if (isWinner && context.mode === 'labyrinthe' && context.floor === 120) {
    detected.push('fleau_labyrinthe');
  }

  // ======================== NOUVEAUX TITRES DE COMBAT ========================

  const lastTurnStep = [...steps].reverse().find(s => s.turn);
  const lastTurn = lastTurnStep ? lastTurnStep.turn : 0;
  const playerPrefix = playerIsP1 ? '[P1]' : '[P2]';
  const enemyPrefix = playerIsP1 ? '[P2]' : '[P1]';
  const enemyMaxHP = playerIsP1 ? result.p2MaxHP : result.p1MaxHP;

  // --- speedrunner : gagner en 3 tours ou moins ---
  if (isWinner && lastTurn > 0 && lastTurn <= 3) {
    detected.push('speedrunner');
  }

  // --- eternel : gagner en mort subite (tour 30) ---
  if (isWinner && lastTurn >= 30) {
    detected.push('eternel');
  }

  // --- comeback : gagner après être passé sous 5% PV ---
  if (isWinner) {
    const wentBelow5 = steps.some(s => {
      const hp = playerIsP1 ? s.p1HP : s.p2HP;
      return hp > 0 && hp < playerMaxHP * 0.05;
    });
    if (wentBelow5) detected.push('comeback');
  }

  // --- crit_machine : 5+ critiques dans un combat ---
  if (isWinner) {
    let critCount = 0;
    for (const step of actionSteps) {
      if (step.logs?.some(l => l.includes(playerPrefix) && l.includes('CRITIQUE'))) {
        critCount++;
      }
    }
    if (critCount >= 5) detected.push('crit_machine');
  }

  // --- pacifiste : gagner en tournoi sans crit ---
  if (isWinner && context.mode === 'tournoi') {
    const hadCrit = actionSteps.some(s =>
      s.logs?.some(l => l.includes(playerPrefix) && l.includes('CRITIQUE'))
    );
    if (!hadCrit) detected.push('pacifiste');
  }

  // --- executeur : achever avec une capacité spéciale ---
  if (isWinner) {
    const deathStep = [...actionSteps].reverse().find(s => {
      const eHP = playerIsP1 ? s.p2HP : s.p1HP;
      return eHP <= 0;
    });
    if (deathStep) {
      const hasAbilityKill = deathStep.logs?.some(l =>
        l.includes(playerPrefix) && (l.includes('capacité') || l.includes('sort') || l.includes('Explosion') || l.includes('Souffle') || l.includes('tir') || l.includes('Tir') || l.includes('riposte') || l.includes('purge') || l.includes('fouet') || l.includes('Charge') || l.includes('flasque'))
      );
      if (hasAbilityKill) detected.push('executeur');
    }
  }

  // --- dominateur : gagner en tournoi sans passer sous 50% PV ---
  if (isWinner && context.mode === 'tournoi') {
    const alwaysAbove50 = steps.every(s => {
      const hp = playerIsP1 ? s.p1HP : s.p2HP;
      return hp === undefined || hp >= playerMaxHP * 0.5;
    });
    if (alwaysAbove50) detected.push('dominateur');
  }

  // --- destruction : un coup unique > 50% PV max ennemi ---
  if (isWinner) {
    let prevEnemyHP = enemyMaxHP;
    for (const step of steps) {
      const currEnemyHP = playerIsP1 ? step.p2HP : step.p1HP;
      if (currEnemyHP !== undefined && prevEnemyHP !== undefined) {
        const singleHitDmg = prevEnemyHP - currEnemyHP;
        if (singleHitDmg > enemyMaxHP * 0.5) {
          detected.push('destruction');
          break;
        }
      }
      if (currEnemyHP !== undefined) prevEnemyHP = currEnemyHP;
    }
  }

  // --- tank_absolu : subir 200%+ PV max en dégâts et gagner ---
  if (isWinner) {
    let totalDmgReceived = 0;
    let prevPlayerHP = playerMaxHP;
    for (const step of steps) {
      const currHP = playerIsP1 ? step.p1HP : step.p2HP;
      if (currHP !== undefined && prevPlayerHP !== undefined) {
        const lost = prevPlayerHP - currHP;
        if (lost > 0) totalDmgReceived += lost;
      }
      if (currHP !== undefined) prevPlayerHP = currHP;
    }
    if (totalDmgReceived >= playerMaxHP * 2) detected.push('tank_absolu');
  }

  // --- ombre_fatale : esquiver 3+ attaques ---
  if (isWinner) {
    let dodgeCount = 0;
    for (const step of actionSteps) {
      if (step.logs?.some(l => l.includes(playerPrefix) && l.includes('esquive'))) {
        dodgeCount++;
      }
    }
    if (dodgeCount >= 3) detected.push('ombre_fatale');
  }

  // --- miroir_parfait : gagner en mode miroir ---
  if (isWinner && context.mode === 'mirror') {
    detected.push('miroir_parfait');
  }

  // --- tueur_koro : battre Koro Sensei en < 10 tours ---
  if (isWinner && (context.bossId === 'koro_sensei' || context.bossId === 'koro') && lastTurn < 10) {
    detected.push('tueur_koro');
  }

  // --- maitre_soins : soigner 100%+ PV max cumulés dans un combat ---
  if (isWinner) {
    let totalHealing = 0;
    for (const step of steps) {
      for (const log of (step.logs || [])) {
        if (log.includes(playerPrefix) && (log.includes('récupère') || log.includes('soigne') || log.includes('régénère') || log.includes('Régénération') || log.includes('Soin'))) {
          const match = log.match(/(\d+)\s*PV/);
          if (match) totalHealing += parseInt(match[1], 10);
        }
      }
    }
    if (totalHealing >= playerMaxHP) detected.push('maitre_soins');
  }

  // ======================== TITRES RACIAUX ========================

  const playerRace = playerChar.race;

  // --- title_humain : gagner avec toutes les stats < adversaire ---
  if (isWinner && playerRace === 'Humain' && introStep) {
    const pBase = playerIsP1 ? introStep.p1Base : introStep.p2Base;
    const eBase = playerIsP1 ? introStep.p2Base : introStep.p1Base;
    if (pBase && eBase) {
      const allBelow = ['auto', 'def', 'cap', 'rescap', 'spd'].every(k => pBase[k] < eBase[k]);
      if (allBelow) detected.push('title_humain');
    }
  }

  // --- title_elfe : 3 crits consécutifs ---
  if (isWinner && playerRace === 'Elfe') {
    let consecutiveCrits = 0;
    let maxConsecutive = 0;
    const playerPrefix = playerIsP1 ? '[P1]' : '[P2]';
    for (const step of actionSteps) {
      const hasPlayerCrit = step.logs?.some(l => l.includes(playerPrefix) && l.includes('CRITIQUE'));
      const isPlayerAction = step.logs?.some(l => l.includes(playerPrefix));
      if (isPlayerAction && hasPlayerCrit) {
        consecutiveCrits++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveCrits);
      } else if (isPlayerAction) {
        consecutiveCrits = 0;
      }
    }
    if (maxConsecutive >= 3) detected.push('title_elfe');
  }

  // --- title_orc : gagner sous 10% PV ---
  if (isWinner && playerRace === 'Orc') {
    if (playerFinalHP > 0 && playerFinalHP <= playerMaxHP * 0.1) {
      detected.push('title_orc');
    }
  }

  // --- title_nain : subir 30+ coups et gagner ---
  if (isWinner && playerRace === 'Nain') {
    let hitsReceived = 0;
    const enemyPrefix = playerIsP1 ? '[P2]' : '[P1]';
    for (const step of actionSteps) {
      const enemyDealtDamage = step.logs?.some(l =>
        l.includes(enemyPrefix) && (l.includes('inflige') || l.includes('dégâts'))
      );
      if (enemyDealtDamage) hitsReceived++;
    }
    if (hitsReceived >= 30) detected.push('title_nain');
  }

  // --- title_dragonkin : 50%+ PV max en dégâts cumulés de rage ---
  if (isWinner && playerRace === 'Dragonkin') {
    const playerPrefix = playerIsP1 ? '[P1]' : '[P2]';
    let totalRageDmg = 0;
    for (const step of actionSteps) {
      for (const log of (step.logs || [])) {
        if (log.includes(playerPrefix) && log.includes('rage')) {
          const match = log.match(/(\d+)\s*dégâts/);
          if (match) totalRageDmg += parseInt(match[1], 10);
        }
      }
    }
    if (totalRageDmg >= playerMaxHP * 0.5) detected.push('title_dragonkin');
  }

  // --- title_mortvivant : gagner grâce à la résurrection ---
  if (isWinner && playerRace === 'Mort-vivant') {
    const playerPrefix = playerIsP1 ? '[P1]' : '[P2]';
    const hadResurrection = steps.some(s =>
      s.logs?.some(l => l.includes(playerPrefix) && l.includes('ressuscite'))
    );
    if (hadResurrection) detected.push('title_mortvivant');
  }

  // --- title_lycan : kill uniquement via saignement ---
  if (isWinner && playerRace === 'Lycan') {
    const lastActionBeforeDeath = [...actionSteps].reverse().find(s => {
      const eHP = playerIsP1 ? s.p2HP : s.p1HP;
      return eHP <= 0;
    });
    if (lastActionBeforeDeath) {
      const hasBleedKill = lastActionBeforeDeath.logs?.some(l =>
        l.includes('saignement') || l.includes('Saignement')
      );
      if (hasBleedKill) detected.push('title_lycan');
    }
  }

  // --- title_sylvari : régénérer 50%+ PV max ---
  if (isWinner && playerRace === 'Sylvari') {
    let totalRegen = 0;
    const playerPrefix = playerIsP1 ? '[P1]' : '[P2]';
    for (const step of steps) {
      for (const log of (step.logs || [])) {
        if (log.includes(playerPrefix) && (log.includes('régénère') || log.includes('Régénération'))) {
          const match = log.match(/(\d+)\s*PV/);
          if (match) totalRegen += parseInt(match[1], 10);
        }
      }
    }
    if (totalRegen >= playerMaxHP * 0.5) detected.push('title_sylvari');
  }

  // --- title_gnome : gagner et la vitesse a été décisive (double différence de spd) ---
  if (isWinner && playerRace === 'Gnome' && introStep) {
    const pBase = playerIsP1 ? introStep.p1Base : introStep.p2Base;
    const eBase = playerIsP1 ? introStep.p2Base : introStep.p1Base;
    if (pBase && eBase && pBase.spd >= eBase.spd * 2) {
      detected.push('title_gnome');
    }
  }

  // --- title_sirene : atteindre le max de stacks (3 standard, 4 avec awakening) ---
  if (isWinner && playerRace === 'Sirène') {
    const maxStacksTarget = (playerChar.level ?? 1) >= 100 ? 4 : 3;
    const playerStatusKey = playerIsP1 ? 'p1Status' : 'p2Status';
    const maxReached = steps.some(s => {
      const status = s[playerStatusKey];
      return status && status.sireneStacks >= maxStacksTarget;
    });
    if (maxReached) detected.push('title_sirene');
  }

  // --- title_mindflayer : copier un sort et gagner ---
  if (isWinner && playerRace === 'Mindflayer') {
    const playerPrefix = playerIsP1 ? '[P1]' : '[P2]';
    const copiedSpell = steps.some(s =>
      s.logs?.some(l => l.includes(playerPrefix) && (l.includes('copie') || l.includes('Copie')))
    );
    if (copiedSpell) detected.push('title_mindflayer');
  }

  // --- title_turtlekin : la carapace a réduit un coup de plus de 30% PV max ---
  if (isWinner && playerRace === 'Turtlekin') {
    const shellPrefix = playerIsP1 ? '[P2]' : '[P1]';
    for (const step of steps) {
      for (const log of (step.logs || [])) {
        if (log.includes(shellPrefix) && log.includes('Carapace') && log.includes('absorbe le choc')) {
          const match = log.match(/réduits de (\d+) à (\d+)/);
          if (match) {
            const reduction = parseInt(match[1], 10) - parseInt(match[2], 10);
            if (reduction >= playerMaxHP * 0.3) {
              detected.push('title_turtlekin');
              break;
            }
          }
        }
      }
      if (detected.includes('title_turtlekin')) break;
    }
  }

  return detected;
}
