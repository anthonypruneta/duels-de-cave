/**
 * Algorithme de bracket double élimination
 */

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function genererBracket(participantIds) {
  if (participantIds.length < 2) throw new Error('Il faut au moins 2 participants');

  const shuffled = shuffle(participantIds);
  const size = nextPowerOf2(shuffled.length);
  const n = Math.log2(size); // nombre de rounds WB

  // Pad avec des BYE
  const seeded = [...shuffled];
  while (seeded.length < size) seeded.push('BYE');

  const matches = {};

  // ============================================================================
  // WINNERS BRACKET
  // ============================================================================
  for (let r = 0; r < n; r++) {
    const matchCount = size / Math.pow(2, r + 1);
    for (let m = 0; m < matchCount; m++) {
      const id = `W-${r}-${m}`;
      matches[id] = {
        id,
        bracket: 'winners',
        round: r,
        matchInRound: m,
        roundLabel: r === n - 1 ? 'Finale Winners' : `Winners Tour ${r + 1}`,
        p1: null,
        p2: null,
        winnerId: null,
        loserId: null,
        statut: 'en_attente',
        winnerGoesTo: null,
        loserGoesTo: null
      };
    }
  }

  // Seed le premier round WB
  const r0Count = size / 2;
  for (let m = 0; m < r0Count; m++) {
    matches[`W-0-${m}`].p1 = seeded[m * 2];
    matches[`W-0-${m}`].p2 = seeded[m * 2 + 1];
  }

  // Routing WB : winner → WB round suivant
  for (let r = 0; r < n - 1; r++) {
    const matchCount = size / Math.pow(2, r + 1);
    for (let m = 0; m < matchCount; m++) {
      matches[`W-${r}-${m}`].winnerGoesTo = {
        matchId: `W-${r + 1}-${Math.floor(m / 2)}`,
        slot: m % 2 === 0 ? 'p1' : 'p2'
      };
    }
  }

  // ============================================================================
  // LOSERS BRACKET
  // ============================================================================
  // LB a 2*(n-1) rounds pour n >= 2, 0 rounds pour n=1
  const lbRounds = n >= 2 ? 2 * (n - 1) : 0;

  for (let r = 0; r < lbRounds; r++) {
    const isMinor = r % 2 === 0; // rounds pairs = internes (minor)
    let matchCount;

    if (r === 0) {
      matchCount = size / 4; // moitié des losers WR0
    } else if (isMinor) {
      // Minor: réduit de moitié le round précédent
      const prevMatchCount = Object.keys(matches).filter(k => k.startsWith(`L-${r - 1}-`)).length;
      matchCount = Math.ceil(prevMatchCount / 2);
    } else {
      // Major: même nombre que le round mineur précédent
      const prevMatchCount = Object.keys(matches).filter(k => k.startsWith(`L-${r - 1}-`)).length;
      matchCount = prevMatchCount;
    }

    for (let m = 0; m < matchCount; m++) {
      const id = `L-${r}-${m}`;
      const isLBFinal = r === lbRounds - 1;
      matches[id] = {
        id,
        bracket: 'losers',
        round: r,
        matchInRound: m,
        roundLabel: isLBFinal ? 'Finale Losers' : `Losers Tour ${r + 1}`,
        p1: null,
        p2: null,
        winnerId: null,
        loserId: null,
        statut: 'en_attente',
        winnerGoesTo: null,
        loserGoesTo: null // losers bracket = éliminé si on perd
      };
    }
  }

  // Routing WB losers → LB
  // WR0 losers → LR0 (minor, paired)
  if (lbRounds > 0) {
    const wr0Count = size / 2;
    for (let m = 0; m < wr0Count; m++) {
      matches[`W-0-${m}`].loserGoesTo = {
        matchId: `L-0-${Math.floor(m / 2)}`,
        slot: m % 2 === 0 ? 'p1' : 'p2'
      };
    }

    // WR1+ losers → LB major rounds
    for (let wr = 1; wr < n; wr++) {
      const lbMajorRound = 2 * wr - 1; // WR1→LR1, WR2→LR3, WR3→LR5
      const wrMatchCount = size / Math.pow(2, wr + 1);
      for (let m = 0; m < wrMatchCount; m++) {
        matches[`W-${wr}-${m}`].loserGoesTo = {
          matchId: `L-${lbMajorRound}-${m}`,
          slot: 'p2' // WB losers come in as p2
        };
      }
    }

    // Routing interne LB
    for (let r = 0; r < lbRounds; r++) {
      const isMinor = r % 2 === 0;
      const currentMatches = Object.keys(matches).filter(k => k.startsWith(`L-${r}-`));

      if (r < lbRounds - 1) {
        if (isMinor) {
          // Minor → Major suivant (winners gardent leur position)
          for (const matchId of currentMatches) {
            const m = matches[matchId].matchInRound;
            matches[matchId].winnerGoesTo = {
              matchId: `L-${r + 1}-${m}`,
              slot: 'p1' // LB survivors are p1
            };
          }
        } else {
          // Major → Minor suivant (reduce)
          for (const matchId of currentMatches) {
            const m = matches[matchId].matchInRound;
            matches[matchId].winnerGoesTo = {
              matchId: `L-${r + 1}-${Math.floor(m / 2)}`,
              slot: m % 2 === 0 ? 'p1' : 'p2'
            };
          }
        }
      }
    }
  }

  // ============================================================================
  // GRAND FINAL
  // ============================================================================
  matches['GF'] = {
    id: 'GF',
    bracket: 'grand_final',
    round: 0,
    matchInRound: 0,
    roundLabel: 'Grande Finale',
    p1: null, // WB champion
    p2: null, // LB champion
    winnerId: null,
    loserId: null,
    statut: 'en_attente',
    winnerGoesTo: null,
    loserGoesTo: null
  };

  // WB Final winner → GF p1
  matches[`W-${n - 1}-0`].winnerGoesTo = { matchId: 'GF', slot: 'p1' };

  // LB Final winner → GF p2 (si LB existe)
  if (lbRounds > 0) {
    matches[`L-${lbRounds - 1}-0`].winnerGoesTo = { matchId: 'GF', slot: 'p2' };
  } else {
    // Pour 2 joueurs (n=1), le loser de WR0 va directement en GF
    matches['W-0-0'].loserGoesTo = { matchId: 'GF', slot: 'p2' };
  }

  // Grand Final Reset (créé à la demande dans resoudreMatch)

  // ============================================================================
  // AUTO-RÉSOUDRE LES BYES
  // ============================================================================
  let changed = true;
  while (changed) {
    changed = false;
    for (const match of Object.values(matches)) {
      if (match.statut !== 'en_attente') continue;
      if (match.p1 === null || match.p2 === null) continue;

      const p1Bye = match.p1 === 'BYE';
      const p2Bye = match.p2 === 'BYE';

      if (p1Bye && p2Bye) {
        match.statut = 'bye';
        match.winnerId = 'BYE';
        changed = true;
      } else if (p1Bye || p2Bye) {
        const winner = p1Bye ? match.p2 : match.p1;
        const loser = 'BYE';
        match.winnerId = winner;
        match.loserId = loser;
        match.statut = 'bye';

        // Propager le winner
        if (match.winnerGoesTo) {
          const next = matches[match.winnerGoesTo.matchId];
          if (next) next[match.winnerGoesTo.slot] = winner;
        }
        // Propager le loser (BYE)
        if (match.loserGoesTo) {
          const next = matches[match.loserGoesTo.matchId];
          if (next) next[match.loserGoesTo.slot] = 'BYE';
        }
        changed = true;
      }
    }
  }

  // ============================================================================
  // ORDRE DES MATCHS
  // ============================================================================
  const matchOrder = [];

  // Interleave WB et LB
  if (n === 1) {
    // 2 joueurs: juste WR0 puis GF
    addNonByeMatches(matches, 'W-0-', matchOrder);
    matchOrder.push('GF');
  } else {
    // WR0
    addNonByeMatches(matches, 'W-0-', matchOrder);
    // LR0 (minor)
    addNonByeMatches(matches, 'L-0-', matchOrder);

    for (let wr = 1; wr < n; wr++) {
      // WR_i
      addNonByeMatches(matches, `W-${wr}-`, matchOrder);
      // LB major (2*wr - 1)
      const lbMajor = 2 * wr - 1;
      if (lbMajor < lbRounds) addNonByeMatches(matches, `L-${lbMajor}-`, matchOrder);
      // LB minor (2*wr) si c'est pas le dernier WR
      const lbMinor = 2 * wr;
      if (lbMinor < lbRounds) addNonByeMatches(matches, `L-${lbMinor}-`, matchOrder);
    }

    matchOrder.push('GF');
  }

  return { matches, matchOrder };
}

function addNonByeMatches(matches, prefix, order) {
  const relevant = Object.values(matches)
    .filter(m => m.id.startsWith(prefix) && m.statut !== 'bye')
    .sort((a, b) => a.matchInRound - b.matchInRound);
  for (const m of relevant) {
    order.push(m.id);
  }
}

// ============================================================================
// RÉSOUDRE UN MATCH
// ============================================================================

export function resoudreMatch(matches, matchId, winnerId, loserId) {
  const match = matches[matchId];
  if (!match) return matches;

  match.winnerId = winnerId;
  match.loserId = loserId;
  match.statut = 'termine';

  // Propager le winner
  if (match.winnerGoesTo) {
    const next = matches[match.winnerGoesTo.matchId];
    if (next) next[match.winnerGoesTo.slot] = winnerId;
  }

  // Propager le loser
  if (match.loserGoesTo && loserId !== 'BYE') {
    const next = matches[match.loserGoesTo.matchId];
    if (next) next[match.loserGoesTo.slot] = loserId;
  }

  // Cas spécial: Grand Final gagnée par le LB champion → créer GF Reset
  if (matchId === 'GF' && winnerId === match.p2 && !matches['GFR']) {
    matches['GFR'] = {
      id: 'GFR',
      bracket: 'grand_final_reset',
      round: 1,
      matchInRound: 0,
      roundLabel: 'Grande Finale - Match Décisif',
      p1: match.p1, // WB champion (a perdu la GF)
      p2: match.p2, // LB champion (a gagné la GF)
      winnerId: null,
      loserId: null,
      statut: 'en_attente',
      winnerGoesTo: null,
      loserGoesTo: null
    };
  }

  return matches;
}

export function getParticipantNom(participants, userId) {
  const p = participants.find(p => p.userId === userId);
  return p ? p.nom : userId;
}
