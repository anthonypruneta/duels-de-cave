/**
 * Récapitulatif de fin de run Cave Destiny
 * (inspiré Destiny Eleven — adapté aux Duels de Cave).
 */

import { WEAPON_RARITY_LABEL } from '../data/caveDestiny';
import { RARITY } from '../data/weapons';
import * as DestinyEngine from './caveDestinyEngine';

const { buildFinalStory, computeScore, getTier, loadPantheon } = DestinyEngine;

/** Ambition eval — utilise le moteur si dispo, sinon heuristique trophées. */
function resolveAmbitionEval(career, fromStory) {
  if (fromStory && typeof fromStory.succeeded === 'boolean') return fromStory;
  // Accès dynamique : `evaluateAmbition` n’existe qu’après les PRs ambition.
  const evaluateAmbitionFn = DestinyEngine['evaluateAmbition'];
  if (typeof evaluateAmbitionFn === 'function') {
    return evaluateAmbitionFn(career);
  }
  const id = career?.ambition?.id || null;
  const name = career?.ambition?.name || 'Ambition';
  const t = career?.trophies || {};
  const base = {
    id,
    name,
    succeeded: false,
    progress: 0,
    goal: 1,
    bonus: 0,
    detail: '',
  };
  if (!id) return base;
  const checks = {
    tournoi: () => (t.tournoi || 0) >= 1,
    donjons: () => (t.donjon || 0) + (t.tour || 0) + (t.extension || 0) >= 2,
    forge: () =>
      (t.forge || 0) >= 1 ||
      career?.weapon?.rarity === RARITY.RARE ||
      career?.weapon?.rarity === RARITY.LEGENDAIRE,
    ombres: () => (t.labyrinthe || 0) + (t.cataclysme || 0) >= 1,
    pvp: () => (t.pvp || 0) >= 1,
    coop: () => (t.coop || 0) >= 1,
    taverne: () => (t.taverne || 0) >= 2,
    rush: () => (t.bossRush || 0) >= 1,
  };
  const ok = checks[id] ? checks[id]() : false;
  return {
    ...base,
    succeeded: ok,
    progress: ok ? 1 : 0,
    detail: ok ? 'Objectif atteint' : 'Objectif non atteint',
    bonus: ok ? 40 : 0,
  };
}

export const TROPHY_META = {
  tournoi: { label: 'Couronne du samedi', icon: '🏆' },
  donjon: { label: 'Donjon', icon: '🏰' },
  tour: { label: 'Tour du Mage', icon: '🔮' },
  forge: { label: 'Forge d’Ornn', icon: '🔨' },
  labyrinthe: { label: 'Labyrinthe Infini', icon: '🌀' },
  cataclysme: { label: 'Cataclysme', icon: '☄️' },
  pvp: { label: 'Duel PvP', icon: '⚔️' },
  bossRush: { label: 'Boss Rush', icon: '💀' },
  extension: { label: 'Extension', icon: '🌌' },
  coop: { label: 'Arène de Red', icon: '🔴' },
  taverne: { label: 'Taverne', icon: '🍺' },
};

const RIVAL_POOL = [
  { name: 'Kael l’Ombre', title: 'Duelliste de comptoir' },
  { name: 'Mira Forgecœur', title: 'Aventurière confirmée' },
  { name: 'Vex des Clairières', title: 'Champion local' },
  { name: 'Orn le Silencieux', title: 'Cave obstiné' },
  { name: 'Syra Pointeau', title: 'Sœur de la fosse' },
  { name: 'Drax Rushbane', title: 'Chasseur de bosses' },
  { name: 'Lior Hallwhisper', title: 'Prétendant du samedi' },
  { name: 'Nox Miroir', title: 'Épreuve sombre' },
];

function hashSeed(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickSeeded(list, seed) {
  if (!list?.length) return null;
  return list[seed % list.length];
}

function dominantCombatStat(stats = {}) {
  const pairs = [
    ['auto', stats.auto],
    ['def', stats.def],
    ['cap', stats.cap],
    ['spd', stats.spd],
    ['charisme', stats.charisme],
  ];
  pairs.sort((a, b) => (b[1] || 0) - (a[1] || 0));
  return pairs[0]?.[0] || 'auto';
}

/** Titre de classe affiché sous le badge de légende. */
export function buildRecapHeadline(tier, career) {
  const ambition = career?.ambition?.name;
  const byTier = {
    mythe: 'MYTHE DES DUELS DE CAVE',
    legende_arene: 'LÉGENDE DE L’ARÈNE',
    champion_local: 'CHAMPION DES DUELS',
    aventurier: 'AVENTURIER DE LA CAVE',
    cave_confirme: 'CAVE CONFIRMÉ',
    bronze_cave: 'CAVE EN DEVENIR',
  };
  if (tier?.id && byTier[tier.id]) return byTier[tier.id];
  return ambition ? ambition.toUpperCase() : 'DESTIN DES DUELS';
}

/** Surnom narratif. */
export function buildNickname(career) {
  const name = career?.character?.name || 'Cave';
  const race = career?.character?.race || '';
  const classe = career?.character?.class || '';
  const ambitionId = career?.ambition?.id;
  const t = career?.trophies || {};
  const seed = hashSeed(`${name}|${race}|${classe}|${ambitionId}`);

  const byAmbition = {
    tournoi: ['Le Couronné', 'L’Écho du Samedi', 'Le Favori de l’Arène'],
    donjons: ['Le Creuseur', 'L’Éclaireur des donjons', 'Le Marcheur d’étages'],
    forge: ['Le Bras d’Ornn', 'Le Marteau vivant', 'L’Enfant du feu'],
    ombres: ['L’Ombre du Miroir', 'Le Survivant', 'Le Veilleur'],
    pvp: ['Le Duelliste', 'La Terreur du lobby', 'Le Roi des duels'],
    coop: ['Le Frère de fosse', 'L’Allié de Red', 'Le Duo parfait'],
    taverne: ['Le Maestro du comptoir', 'L’Habitué', 'La Légende de mousse'],
    rush: ['Le Coureur de bosses', 'L’Inoxydable', 'Le Sixième souffle'],
  };

  if (t.tournoi >= 2) return '« Le Porteur de couronnes »';
  if (t.bossRush >= 2) return '« Le Bourreau du Rush »';
  if (t.cataclysme >= 1 && t.labyrinthe >= 1) return '« Celui qui a vu les ombres »';
  if (career?.weapon?.rarity === RARITY.LEGENDAIRE) {
    return `« Porteur de ${career.weapon.name} »`;
  }

  const pool = byAmbition[ambitionId] || [
    `Le ${race || 'Cave'}`,
    `L’Âme ${classe || 'errante'}`,
    'Le Destin inachevé',
  ];
  const nick = pickSeeded(pool, seed);
  return `« ${nick} »`;
}

/** Traits / tags de personnalité. */
export function buildTraits(career) {
  const s = career?.stats || {};
  const t = career?.trophies || {};
  const f = career?.flags || {};
  const traits = [];

  const dom = dominantCombatStat(s);
  const domMap = {
    auto: { id: 'brut', label: 'Frappe nette', icon: '🗡️' },
    def: { id: 'rempart', label: 'Rempart', icon: '🛡️' },
    cap: { id: 'stratege', label: 'Stratège', icon: '🔮' },
    spd: { id: 'vif', label: 'Vif comme l’éclair', icon: '💨' },
    charisme: { id: 'showman', label: 'Showman', icon: '🎭' },
  };
  if (domMap[dom]) traits.push(domMap[dom]);

  if ((s.charisme || 0) >= 28) traits.push({ id: 'idole', label: 'Idole des foules', icon: '🌟' });
  if ((s.renommee || 0) >= 30) traits.push({ id: 'renom', label: 'Nom qui porte', icon: '📢' });
  if ((s.moral || 0) >= 75) traits.push({ id: 'sangfroid', label: 'Sang-froid', icon: '🧊' });
  else if ((s.moral || 0) < 40) traits.push({ id: 'ombre', label: 'Cœur sombre', icon: '🌑' });
  if ((s.forme || 0) >= 70) traits.push({ id: 'inoxydable', label: 'Inoxydable', icon: '💪' });
  else if ((s.forme || 0) < 35) traits.push({ id: 'blesse', label: 'Marqué au fer', icon: '🩹' });

  if (f.pvp_won || (t.pvp || 0) >= 1) traits.push({ id: 'duelliste', label: 'Duelliste', icon: '⚔️' });
  if (f.pvp_streak) traits.push({ id: 'serie', label: 'En série', icon: '🔥' });
  if ((t.taverne || 0) >= 2) traits.push({ id: 'taverne', label: 'Roi du comptoir', icon: '🍺' });
  if ((t.coop || 0) >= 1 || f.coop_cleared) traits.push({ id: 'coop', label: 'Frère de fosse', icon: '🔴' });
  if ((t.bossRush || 0) >= 1 || f.rush_cleared) traits.push({ id: 'rush', label: 'Chasseur de Rush', icon: '💀' });
  if (f.mirror_read) traits.push({ id: 'miroir', label: 'Lecteur de miroirs', icon: '🪞' });
  if (career?.subclass?.name || career?.character?.subclass?.name) {
    traits.push({ id: 'subclass', label: 'Voie choisie', icon: '🎓' });
  }

  // Déduplique par id, max 5
  const seen = new Set();
  const out = [];
  for (const tr of traits) {
    if (seen.has(tr.id)) continue;
    seen.add(tr.id);
    out.push(tr);
    if (out.length >= 5) break;
  }
  return out;
}

export function buildPalmares(career) {
  const t = career?.trophies || {};
  return Object.entries(TROPHY_META)
    .map(([key, meta]) => ({
      key,
      ...meta,
      count: t[key] || 0,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Badges / distinctions débloqués. */
export function buildBadges(career, ambitionEval) {
  const t = career?.trophies || {};
  const f = career?.flags || {};
  const s = career?.stats || {};
  const badges = [];

  if (ambitionEval?.succeeded) {
    badges.push({
      id: 'ambition',
      icon: career?.ambition?.icon || '🎯',
      label: ambitionEval.name || 'Ambition',
      detail: 'Quête accomplie',
    });
  }
  if ((t.tournoi || 0) >= 1) {
    badges.push({ id: 'couronne', icon: '🏆', label: 'Couronné', detail: `×${t.tournoi}` });
  }
  if ((t.tournoi || 0) >= 2) {
    badges.push({ id: 'dynastie', icon: '👑', label: 'Dynastie du samedi', detail: 'Plusieurs couronnes' });
  }
  if (career?.weapon?.rarity === RARITY.LEGENDAIRE) {
    badges.push({
      id: 'arme_leg',
      icon: career.weapon.icon || '✨',
      label: 'Arme légendaire',
      detail: career.weapon.name,
    });
  } else if (career?.weapon?.rarity === RARITY.RARE) {
    badges.push({
      id: 'arme_rare',
      icon: career.weapon.icon || '🗡️',
      label: 'Arme rare',
      detail: career.weapon.name,
    });
  }
  if ((t.forge || 0) >= 1) badges.push({ id: 'ornn', icon: '🔨', label: 'Reconnu par Ornn', detail: 'Forge' });
  if ((t.labyrinthe || 0) >= 1) badges.push({ id: 'laby', icon: '🌀', label: 'Marcheur infini', detail: 'Labyrinthe' });
  if ((t.cataclysme || 0) >= 1) badges.push({ id: 'cata', icon: '☄️', label: 'Survivant du Cataclysme', detail: '' });
  if ((t.bossRush || 0) >= 1 || f.rush_cleared) {
    badges.push({ id: 'rush', icon: '💀', label: 'Maître du Rush', detail: `×${t.bossRush || 1}` });
  }
  if ((t.coop || 0) >= 1 || f.coop_cleared) {
    badges.push({ id: 'red', icon: '🔴', label: 'Vainqueur de Red', detail: '' });
  }
  if ((t.pvp || 0) >= 2 || f.pvp_streak) {
    badges.push({ id: 'pvp', icon: '⚔️', label: 'Terreur du lobby', detail: `×${t.pvp || 0}` });
  }
  if ((t.taverne || 0) >= 2) {
    badges.push({ id: 'taverne', icon: '🍺', label: 'Légende du comptoir', detail: `×${t.taverne}` });
  }
  if ((s.renommee || 0) >= 40) {
    badges.push({ id: 'renom', icon: '📢', label: 'Nom gravé', detail: `Renommée ${Math.round(s.renommee)}` });
  }
  if ((s.charisme || 0) >= 32) {
    badges.push({ id: 'idole', icon: '🎭', label: 'Idole des foules', detail: '' });
  }
  if (f.taverne_cellar) {
    badges.push({ id: 'cave', icon: '🗝️', label: 'Cave secrète', detail: 'Initié' });
  }
  if (career?.subclass?.name || career?.character?.subclass?.name) {
    const sub = career?.subclass?.name || career?.character?.subclass?.name;
    badges.push({ id: 'sub', icon: '🎓', label: 'Sous-classe', detail: sub });
  }

  return badges.slice(0, 8);
}

/** Parcours saisonnier (timeline). */
export function buildParcours(career) {
  const history = Array.isArray(career?.history) ? career.history : [];
  const milestones = [];

  // Début
  milestones.push({
    season: 1,
    kind: 'start',
    label: 'Saison 1',
    title: 'Entrée dans la Cave',
    detail: [
      career?.ambition?.name ? `Ambition : ${career.ambition.name}` : null,
      career?.mentor?.name ? `Mentor : ${career.mentor.name}` : null,
      career?.weapon?.name ? `Arme : ${career.weapon.name}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    badge: 'DÉBUT',
    badgeTone: 'stone',
  });

  for (const h of history) {
    const deltas = h.deltas || {};
    const trophyGain = deltas.trophies
      ? Object.entries(deltas.trophies).filter(([, v]) => v > 0)
      : [];
    const isHighlight =
      h.variant === 'bonus' ||
      trophyGain.length > 0 ||
      h.weaponProgress ||
      h.subclassName;

    if (!isHighlight && history.length > 8) continue;

    let badge = h.variant === 'bonus' ? 'ÉCLAT' : h.variant === 'malus' ? 'ÉPREUVE' : 'PAS';
    let badgeTone = h.variant === 'bonus' ? 'amber' : h.variant === 'malus' ? 'rose' : 'stone';
    if (trophyGain.length) {
      const [key] = trophyGain[0];
      badge = TROPHY_META[key]?.label?.split(' ')[0]?.toUpperCase() || 'TROPHÉE';
      badgeTone = 'gold';
    }
    if (h.weaponProgress === 'legendary') {
      badge = 'LÉGENDAIRE';
      badgeTone = 'violet';
    } else if (h.weaponProgress === 'upgrade') {
      badge = 'FORGE';
      badgeTone = 'orange';
    }

    milestones.push({
      season: h.season,
      kind: 'event',
      label: `Saison ${h.season}`,
      title: h.title || 'Événement',
      detail: h.choice ? `Choix : ${h.choice}` : h.text || '',
      badge,
      badgeTone,
      variant: h.variant,
    });
  }

  // Fin
  milestones.push({
    season: career?.maxSeasons || 14,
    kind: 'end',
    label: `Saison ${career?.maxSeasons || 14}`,
    title: 'Retraite des Duels',
    detail: career?.weapon?.name
      ? `Dernière arme : ${career.weapon.icon || ''} ${career.weapon.name}`.trim()
      : 'La Cave se souvient.',
    badge: 'FIN',
    badgeTone: 'amber',
  });

  // Limite d’affichage : début + fin + jusqu’à 8 highlights
  if (milestones.length <= 12) return milestones;
  const start = milestones[0];
  const end = milestones[milestones.length - 1];
  const mid = milestones.slice(1, -1);
  const preferred = mid.filter((m) => m.badgeTone === 'gold' || m.badgeTone === 'violet' || m.badgeTone === 'amber');
  const filler = mid.filter((m) => !preferred.includes(m));
  const picked = [...preferred, ...filler].slice(0, 8);
  picked.sort((a, b) => a.season - b.season);
  return [start, ...picked, end];
}

/** Stats cumulées affichées. */
export function buildStatRows(career) {
  const s = career?.stats || {};
  const history = Array.isArray(career?.history) ? career.history : [];
  const bonusCount = history.filter((h) => h.variant === 'bonus').length;
  const malusCount = history.filter((h) => h.variant === 'malus').length;
  return [
    { label: 'Saisons jouées', value: String(career?.maxSeasons || 14) },
    { label: 'Événements vécus', value: String(history.length) },
    { label: 'Éclats (bonus)', value: String(bonusCount) },
    { label: 'Épreuves (malus)', value: String(malusCount) },
    { label: 'Renommée', value: String(Math.round(s.renommee || 0)) },
    { label: 'Or amassé', value: String(Math.round(s.or || 0)), icon: '🪙' },
    { label: 'Forme finale', value: `${Math.round(s.forme || 0)} %` },
    { label: 'Moral final', value: `${Math.round(s.moral || 0)} %` },
  ];
}

/**
 * Percentile vs panthéon (local + optionnel distant).
 * @returns {{ percentile: number, sampleSize: number, label: string }}
 */
export function computePercentile(score, comparisonScores = []) {
  const scores = comparisonScores.filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (scores.length < 3) {
    // Fallback heuristique sur les paliers de tier
    if (score >= 440) return { percentile: 94, sampleSize: scores.length, label: 'Meilleure carrière que ~94 % des destins (estimation)' };
    if (score >= 360) return { percentile: 86, sampleSize: scores.length, label: 'Meilleure carrière que ~86 % des destins (estimation)' };
    if (score >= 280) return { percentile: 72, sampleSize: scores.length, label: 'Meilleure carrière que ~72 % des destins (estimation)' };
    if (score >= 200) return { percentile: 55, sampleSize: scores.length, label: 'Meilleure carrière que ~55 % des destins (estimation)' };
    if (score >= 120) return { percentile: 35, sampleSize: scores.length, label: 'Meilleure carrière que ~35 % des destins (estimation)' };
    return { percentile: 18, sampleSize: scores.length, label: 'Meilleure carrière que ~18 % des destins (estimation)' };
  }
  const below = scores.filter((s) => s < score).length;
  const percentile = Math.round((below / scores.length) * 100);
  return {
    percentile,
    sampleSize: scores.length,
    label: `Meilleure carrière que ${percentile} % des destins simulés`,
  };
}

function scaleRivalStat(base, seed, spread = 0.25) {
  const factor = 0.75 + ((seed % 100) / 100) * spread * 2;
  return Math.max(0, Math.round(base * factor));
}

/** Face-à-face contre un rival (panthéon ou généré). */
export function buildRivalFaceOff(career, score, pantheon = []) {
  const seed = hashSeed(
    `${career?.character?.name}|${career?.ambition?.id}|${career?.createdAt || score}`
  );
  const others = (pantheon || []).filter(
    (e) => e && e.name && e.name !== career?.character?.name
  );
  let rivalEntry = null;
  if (others.length) {
    // Rival le plus proche en score, sinon tirage
    const sorted = [...others].sort(
      (a, b) => Math.abs((a.score || 0) - score) - Math.abs((b.score || 0) - score)
    );
    rivalEntry = sorted[0];
  }

  const poolRival = pickSeeded(RIVAL_POOL, seed);
  const rivalName = rivalEntry?.name || poolRival.name;
  const rivalTitle = rivalEntry?.tierLabel || poolRival.title;
  const rivalScore = rivalEntry?.score ?? scaleRivalStat(score, seed + 3, 0.35);
  const rt = rivalEntry?.trophies || {};
  const t = career?.trophies || {};
  const s = career?.stats || {};
  const rs = rivalEntry?.stats || {};

  const rows = [
    {
      key: 'score',
      label: 'Score',
      you: score,
      rival: rivalScore,
    },
    {
      key: 'renommee',
      label: 'Renommée',
      you: Math.round(s.renommee || 0),
      rival: rivalEntry ? Math.round(rs.renommee || 0) : scaleRivalStat(s.renommee || 0, seed + 1),
    },
    {
      key: 'tournoi',
      label: 'Couronnes',
      you: t.tournoi || 0,
      rival: rivalEntry ? rt.tournoi || 0 : scaleRivalStat(t.tournoi || 0, seed + 2, 0.8),
    },
    {
      key: 'pvp',
      label: 'Duels PvP',
      you: t.pvp || 0,
      rival: rivalEntry ? rt.pvp || 0 : scaleRivalStat(t.pvp || 0, seed + 4, 0.8),
    },
    {
      key: 'ombres',
      label: 'Épreuves sombres',
      you: (t.labyrinthe || 0) + (t.cataclysme || 0),
      rival: rivalEntry
        ? (rt.labyrinthe || 0) + (rt.cataclysme || 0)
        : scaleRivalStat((t.labyrinthe || 0) + (t.cataclysme || 0), seed + 5, 0.8),
    },
    {
      key: 'rush',
      label: 'Boss Rush',
      you: t.bossRush || 0,
      rival: rivalEntry ? rt.bossRush || 0 : scaleRivalStat(t.bossRush || 0, seed + 6, 0.8),
    },
  ];

  let wins = 0;
  let losses = 0;
  for (const row of rows) {
    if (row.you > row.rival) wins += 1;
    else if (row.you < row.rival) losses += 1;
  }

  let narrative;
  if (wins >= losses + 2) {
    narrative = `Face à ${rivalName}, votre destin a fait taire les doutes. La Cave a choisi son champion.`;
  } else if (losses >= wins + 2) {
    narrative = `${rivalName} reste une épine. Votre carrière brille… mais l’ombre du rival aussi.`;
  } else {
    narrative = `Vous et ${rivalName} avez écrit deux légendes presque jumelles. Les habitués en débattent encore à la Taverne.`;
  }

  return {
    rivalName,
    rivalTitle,
    rivalImage: rivalEntry?.characterImage || null,
    fromPantheon: Boolean(rivalEntry),
    rows,
    wins,
    losses,
    narrative,
  };
}

/** Commentaires narratifs + « et si… ». */
export function buildNarratives(career, ambitionEval, traits) {
  const paragraphs = [];
  const t = career?.trophies || {};
  const s = career?.stats || {};
  const history = Array.isArray(career?.history) ? career.history : [];
  const name = career?.character?.name || 'Ce cave';

  if (ambitionEval?.succeeded) {
    paragraphs.push(
      `${name} a tenu parole : « ${ambitionEval.name} » n’était pas un rêve de comptoir. ${ambitionEval.detail}.`
    );
  } else if (ambitionEval?.id) {
    paragraphs.push(
      `L’ambition « ${ambitionEval.name} » reste inachevée (${ambitionEval.detail}). Certains destins se jugent à ce qui manque.`
    );
  }

  if ((t.tournoi || 0) >= 1 && (t.taverne || 0) >= 1) {
    paragraphs.push(
      'Entre les acclamations du samedi et les bières du soir, le mythe s’est construit en deux temps — lame et mousse.'
    );
  }
  if ((s.forme || 0) < 40 && (s.renommee || 0) >= 25) {
    paragraphs.push(
      'Le corps a lâché avant la légende. On se souvient du nom, pas des cicatrices.'
    );
  }
  if (traits.some((tr) => tr.id === 'showman' || tr.id === 'idole')) {
    paragraphs.push(
      'Les foules ont suivi chaque geste. Même les défaites avaient de la mise en scène.'
    );
  }
  if (career?.weapon?.rarity === RARITY.LEGENDAIRE) {
    paragraphs.push(
      `${career.weapon.name} a cessé d’être une arme : c’est devenu une signature.`
    );
  }

  const earlyMalus = history.find((h) => h.season <= 4 && h.variant === 'malus');
  const earlyBonus = history.find((h) => h.season <= 4 && h.variant === 'bonus');
  let whatIf;
  if (earlyMalus) {
    whatIf = `En saison ${earlyMalus.season}, un autre choix après « ${earlyMalus.title} » aurait peut‑être tout changé. Nul ne saura jamais où il vous aurait mené.`;
  } else if (earlyBonus) {
    whatIf = `Dès la saison ${earlyBonus.season}, la Cave vous a ouvert une porte. D’autres chemins existaient — plus sûrs, plus ternes.`;
  } else {
    whatIf =
      'À vos débuts, un autre chemin s’offrait à vous. Nul ne saura jamais où il vous aurait mené.';
  }

  return { paragraphs, whatIf };
}

/**
 * Construit le récap complet de fin de run.
 * @param {object} career
 * @param {{ pantheon?: object[] }} [opts]
 */
export function buildCareerRecap(career, opts = {}) {
  const base = buildFinalStory(career);
  const ambitionEval = resolveAmbitionEval(career, base.ambition);
  const score = base.score ?? computeScore(career);
  const tier = base.tier || getTier(score);

  const pantheon = opts.pantheon?.length ? opts.pantheon : loadPantheon();
  const comparisonScores = pantheon.map((e) => e.score).filter((n) => typeof n === 'number');
  const percentile = computePercentile(score, comparisonScores);

  const traits = buildTraits(career);
  const badges = buildBadges(career, ambitionEval);
  const palmares = buildPalmares(career);
  const parcours = buildParcours(career);
  const statRows = buildStatRows(career);
  const faceOff = buildRivalFaceOff(career, score, pantheon);
  const narratives = buildNarratives(career, ambitionEval, traits);

  const subclass = career?.subclass || career?.character?.subclass || null;
  const headline = buildRecapHeadline(tier, career);
  const nickname = buildNickname(career);

  const legendBadge =
    tier?.id === 'mythe' || tier?.id === 'legende_arene'
      ? 'UNE LÉGENDE'
      : tier?.id === 'champion_local'
        ? 'UN CHAMPION'
        : tier?.id === 'aventurier'
          ? 'UN AVENTURIER'
          : 'UN CAVE';

  return {
    score,
    tier,
    story: base.story,
    ambition: ambitionEval,
    legendBadge,
    headline,
    nickname,
    traits,
    badges,
    palmares,
    parcours,
    statRows,
    faceOff,
    narratives,
    percentile,
    identity: {
      name: career?.character?.name || 'Aventurier',
      race: career?.character?.race || null,
      class: career?.character?.class || null,
      subclass: subclass?.name || subclass || null,
      ownerPseudo: career?.character?.ownerPseudo || null,
      characterImage: career?.character?.characterImage || null,
      ambitionName: career?.ambition?.name || null,
      ambitionIcon: career?.ambition?.icon || null,
      mentorName: career?.mentor?.name || null,
      mentorIcon: career?.mentor?.icon || null,
      weaponName: career?.weapon?.name || null,
      weaponIcon: career?.weapon?.icon || null,
      weaponRarity: career?.weapon?.rarity || null,
      weaponRarityLabel: career?.weapon?.rarity
        ? WEAPON_RARITY_LABEL[career.weapon.rarity] || career.weapon.rarity
        : null,
      seasons: career?.maxSeasons || 14,
      stats: career?.stats || {},
    },
  };
}

/** Texte plat pour partage / presse-papiers. */
export function formatRecapShareText(recap) {
  if (!recap) return '';
  const lines = [
    `${recap.identity.name} — ${recap.tier.label}`,
    recap.nickname,
    `Score : ${recap.score}`,
    recap.ambition?.succeeded
      ? `Ambition réussie : ${recap.ambition.name}`
      : recap.ambition?.name
        ? `Ambition : ${recap.ambition.name}`
        : null,
    recap.percentile?.label,
    recap.palmares?.length
      ? `Palmarès : ${recap.palmares.map((p) => `${p.icon} ${p.label} ×${p.count}`).join(' · ')}`
      : null,
    '',
    recap.story,
    '',
    '— Duels de Cave · Cave Destiny',
  ].filter((l) => l != null);
  return lines.join('\n');
}
