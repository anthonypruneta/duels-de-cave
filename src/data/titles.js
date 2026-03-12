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
    male: 'Fléau du Labyrinthe',
    female: 'Fléau du Labyrinthe',
    description: 'Atteindre l\'étage 120 du Labyrinthe Infini',
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

  return detected;
}
