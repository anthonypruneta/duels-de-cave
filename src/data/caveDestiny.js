/**
 * Cave Destiny — données du mode carrière (inspiré Destiny Eleven)
 * Premier choix : 3 personnages tirés au hasard parmi les persos réels de Duels de Cave.
 */

import { races } from './races';
import { classes } from './classes';

/** Classes plutôt orientées magie (progression Cave Destiny) */
const MAGIC_CLASSES = new Set([
  'Mage', 'Healer', 'Demoniste', 'Sorcière', 'Alchimiste', 'Succube', 'Briseur de Sort',
]);

/** Classes plutôt orientées vitesse / critique */
const SPEED_CLASSES = new Set(['Voleur', 'Archer', 'Gnome']);

/**
 * Convertit un document personnage Firestore en profil jouable Cave Destiny.
 */
export function buildDestinyCharacterFromGame(char) {
  const level = Number(char.level) || 1;
  const base = char.base || {};
  const race = char.race || 'Humain';
  const classe = char.class || 'Guerrier';
  const name = char.name || 'Sans nom';
  const ownerPseudo = char.ownerPseudo || null;
  const raceBonus = races[race]?.bonus || '';
  const classAbility = classes[classe]?.ability || '';

  const scaleStat = (value, fallback = 20) => {
    const v = Number(value);
    const raw = Number.isFinite(v) ? v : fallback;
    return Math.round(28 + (raw / 40) * 45 + Math.min(level, 200) * 0.12);
  };

  return {
    id: char.id || char.userId,
    name,
    race,
    class: classe,
    level,
    characterImage: char.characterImage || null,
    ownerPseudo,
    gender: char.gender || null,
    keyword: char.keyword || null,
    tagline: ownerPseudo ? `${ownerPseudo} · Niv. ${level}` : `Niv. ${level}`,
    blurb: raceBonus
      ? `${race} ${classe} — ${String(raceBonus).split('\n')[0]}`
      : `${race} ${classe} de Duels de Cave.`,
    playstyle: classAbility || `${race} · ${classe}`,
    baseStats: {
      puissance: scaleStat(base.auto, 22),
      endurance: scaleStat(base.def ?? base.hp, 22),
      magie: scaleStat(base.cap, 20),
      vitesse: scaleStat(base.spd, 20),
      charisme: Math.round(38 + Math.min(level, 300) * 0.08),
    },
    trait: races[race]?.awakening?.description
      ? `Héritage de race : ${String(races[race].awakening.description).split('\n')[0]}`
      : `Vous incarnez ${name}, un vrai personnage de la Cave.`,
    prefersMagic: MAGIC_CLASSES.has(classe) || race === 'Elfe' || race === 'Sirène' || race === 'Mindflayer',
    prefersSpeed: SPEED_CLASSES.has(classe) || race === 'Elfe' || race === 'Gnome' || race === 'Écailleux',
    prefersGrit: race === 'Orc' || race === 'Cendrés' || classe === 'Berserk' || classe === 'Masochiste',
    prefersRebound: race === 'Mort-vivant' || race === 'Turtlekin' || classe === 'Paladin' || classe === 'Bastion',
  };
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Tire `count` personnages actifs distincts au hasard.
 * Préfère ceux qui ont une image ; évite les IDs exclus (dernier tirage).
 */
export function pickRandomGameCharacters(allCharacters, count = 3, options = {}) {
  const excludeIds = new Set((options.excludeIds || []).map(String));
  const active = (allCharacters || []).filter(
    (c) => c && !c.disabled && !c.archived && c.name && c.race && c.class
  );

  const eligible = active.filter((c) => !excludeIds.has(String(c.id || c.userId)));
  const pool = eligible.length >= count ? eligible : active;

  const withImage = shuffleInPlace(pool.filter((c) => c.characterImage));
  const withoutImage = shuffleInPlace(pool.filter((c) => !c.characterImage));
  const ordered = [...withImage, ...withoutImage];

  // Si trop peu après exclusion, complète depuis le reste
  if (ordered.length < count) {
    const pickedIds = new Set(ordered.map((c) => String(c.id || c.userId)));
    const fillers = shuffleInPlace(
      active.filter((c) => !pickedIds.has(String(c.id || c.userId)))
    );
    ordered.push(...fillers);
  }

  return ordered.slice(0, count).map(buildDestinyCharacterFromGame);
}

export const LAST_OFFERED_STORAGE_KEY = 'caveDestiny:lastOfferedIds';

export const CAVE_DESTINY_AMBITIONS = [
  {
    id: 'tournoi',
    name: 'Couronne du Tournoi',
    icon: '🏆',
    desc: 'Visez le trône du samedi. Chaque bracket forge votre légende.',
    effects: { renommee: 8, puissance: 4, or: -2 },
  },
  {
    id: 'donjons',
    name: 'Maître des Donjons',
    icon: '🏰',
    desc: 'Forêt, Tour, Extension… vous voulez tout nettoyer.',
    effects: { endurance: 5, magie: 3, or: 4 },
  },
  {
    id: 'forge',
    name: 'Héritier de la Forge',
    icon: '🔨',
    desc: 'Ornn vous attend. Votre arme sera votre testament.',
    effects: { puissance: 5, endurance: 3, or: -4 },
  },
  {
    id: 'ombres',
    name: 'Seigneur des Ombres',
    icon: '🪞',
    desc: 'Miroir, Cataclysme, Labyrinthe : les modes qui brisent les faibles.',
    effects: { vitesse: 6, magie: 3, charisme: -2 },
  },
];

export const CAVE_DESTINY_MENTORS = [
  {
    id: 'tavernier',
    name: 'Le Tavernier',
    icon: '🍺',
    desc: 'Paris, rumeurs et alliés. Il connaît chaque champion… et chaque looser.',
    effects: { charisme: 8, or: 6, moral: 5 },
  },
  {
    id: 'forgeron',
    name: 'Le Forgeron errant',
    icon: '⚒️',
    desc: 'Un disciple d’Ornn. Peu de mots, beaucoup d’étincelles.',
    effects: { puissance: 6, endurance: 5, or: -3 },
  },
  {
    id: 'archimage',
    name: 'L’Archimage voilé',
    icon: '🔮',
    desc: 'Il murmure les secrets des étages de la Tour.',
    effects: { magie: 9, vitesse: 2, moral: -2 },
  },
  {
    id: 'champion',
    name: 'Le Champion déchu',
    icon: '👑',
    desc: 'Il a tout gagné. Puis tout perdu. Il veut que vous fassiez mieux.',
    effects: { renommee: 6, puissance: 4, charisme: 3 },
  },
];

export const CAVE_DESTINY_WEAPONS = [
  {
    id: 'epee',
    name: 'Voie de l’Épée',
    icon: '⚔️',
    weaponHint: 'Zweihänder',
    desc: 'Coups nets, ego tranchant. La Cave aime les lames qui ont une histoire.',
    effects: { puissance: 7, vitesse: 2 },
  },
  {
    id: 'baton',
    name: 'Voie du Bâton',
    icon: '🪄',
    weaponHint: 'Branche d’Yggdrasil',
    desc: 'Soins, arcs et racines. La magie vit dans le bois.',
    effects: { magie: 7, endurance: 2 },
  },
  {
    id: 'dague',
    name: 'Voie de la Dague',
    icon: '🗡️',
    weaponHint: 'Lævateinn',
    desc: 'Une ombre, un éclair, un crit. Puis le silence.',
    effects: { vitesse: 7, puissance: 2 },
  },
  {
    id: 'bouclier',
    name: 'Voie du Bouclier',
    icon: '🛡️',
    weaponHint: 'Égide d’Athéna',
    desc: 'Tenir. Encore. Toujours. Les légendes survivent.',
    effects: { endurance: 8, charisme: 2 },
  },
];

/** Événements de saison (choix → impacts) */
export const CAVE_DESTINY_EVENTS = [
  {
    id: 'tournoi_samedi',
    title: 'Tournoi du samedi',
    text: 'Les brackets s’ouvrent. La Taverne gronde. On vous attend dans l’arène.',
    weight: 12,
    tags: ['tournoi', 'combat'],
    options: [
      {
        label: 'Entrer en force — viser le titre',
        outcomes: [
          { weight: 45, text: 'Vous tranchez jusqu’en finale et levez la couronne.', deltas: { renommee: 14, puissance: 5, moral: 8, or: 10, trophies: { tournoi: 1 } } },
          { weight: 35, text: 'Belle course… jusqu’à une demi-finale cruelle.', deltas: { renommee: 6, puissance: 3, moral: -4, or: 4 } },
          { weight: 20, text: 'Éliminé dès le premier tour. Les paris étaient contre vous.', deltas: { renommee: -4, moral: -10, forme: -6 } },
        ],
      },
      {
        label: 'Observer depuis la Taverne',
        outcomes: [
          { weight: 70, text: 'Vous analysez les métas. Votre prochain build sera plus malin.', deltas: { magie: 3, charisme: 4, or: 2, moral: 2 } },
          { weight: 30, text: 'Vous perdez une fortune en paris foireux.', deltas: { or: -12, moral: -4, charisme: 1 } },
        ],
      },
      {
        label: 'Pariez tout sur un outsider',
        outcomes: [
          { weight: 35, text: 'Cote folle. Vous repartez riche et célèbre.', deltas: { or: 22, renommee: 5, charisme: 3 } },
          { weight: 65, text: 'L’outsider se fait démolir. Votre bourse aussi.', deltas: { or: -15, moral: -6 } },
        ],
      },
    ],
  },
  {
    id: 'foret',
    title: 'Incursion en Forêt',
    text: 'Les arbres murmurent. Les bosses aussi. Une run forêt s’ouvre devant vous.',
    weight: 11,
    tags: ['donjons', 'combat'],
    options: [
      {
        label: 'Rush full clear',
        outcomes: [
          { weight: 55, text: 'Vous nettoyez la forêt. Le butin cliquette.', deltas: { endurance: 4, or: 12, forme: -5, trophies: { donjon: 1 } } },
          { weight: 45, text: 'Un embuscade vous force à fuir, blessé mais vivant.', deltas: { forme: -12, endurance: 2, moral: -3 } },
        ],
      },
      {
        label: 'Farm prudent des étages bas',
        outcomes: [
          { weight: 80, text: 'Progression lente, coffre correct, zéro drame.', deltas: { or: 6, endurance: 2, forme: 2 } },
          { weight: 20, text: 'Même prudent, un élite vous humilie.', deltas: { moral: -5, forme: -4 } },
        ],
      },
    ],
  },
  {
    id: 'tour_mage',
    title: 'Tour du Mage',
    text: 'Un étage de plus. Un passif de plus. La Tour ne pardonne pas l’hésitation.',
    weight: 10,
    tags: ['donjons', 'magie'],
    options: [
      {
        label: 'Pousser l’étage supérieur',
        outcomes: [
          { weight: 50, text: 'Nouvel étage conquis. Un passif rare s’ancre en vous.', deltas: { magie: 7, renommee: 5, forme: -6, trophies: { tour: 1 } } },
          { weight: 50, text: 'Le gardien vous renvoie au rez-de-chaussée… littéralement.', deltas: { magie: 2, forme: -10, moral: -5 } },
        ],
      },
      {
        label: 'Étudier les passifs avant d’attaquer',
        outcomes: [
          { weight: 100, text: 'Votre préparation paie. Moins de gloire, plus de maîtrise.', deltas: { magie: 4, vitesse: 2, or: -2 } },
        ],
      },
    ],
  },
  {
    id: 'forge_ornn',
    title: 'Appel de la Forge',
    text: 'Les soufflets d’Ornn rugissent. Votre arme légendaire pulse dans son fourreau.',
    weight: 8,
    tags: ['forge'],
    options: [
      {
        label: 'Affronter Ornn pour forger l’upgrade',
        outcomes: [
          { weight: 40, text: 'L’upgrade s’ancre. L’arme chante.', deltas: { puissance: 8, endurance: 3, or: -8, forme: -8, trophies: { forge: 1 } } },
          { weight: 60, text: 'Ornn vous rappelle que les dieux ne se pressent pas.', deltas: { forme: -10, moral: -4, puissance: 2 } },
        ],
      },
      {
        label: 'Reporter — trop tôt',
        outcomes: [
          { weight: 100, text: 'Vous rangez l’ambition. Pour l’instant.', deltas: { moral: -2, or: 3 } },
        ],
      },
    ],
  },
  {
    id: 'labyrinthe',
    title: 'Labyrinthe Infini',
    text: 'Les couloirs se reformulent. Chaque semaine, une nouvelle géométrie de douleur.',
    weight: 9,
    tags: ['ombres', 'combat'],
    options: [
      {
        label: 'Creuser le record',
        outcomes: [
          { weight: 40, text: 'Nouveau palier. Votre nom grimpe au classement.', deltas: { vitesse: 5, renommee: 8, forme: -8, trophies: { labyrinthe: 1 } } },
          { weight: 60, text: 'Vous vous perdez. Le labyrinthe gagne.', deltas: { forme: -12, moral: -6, vitesse: 2 } },
        ],
      },
      {
        label: 'Run courte pour le loot',
        outcomes: [
          { weight: 75, text: 'Sortie propre, bourse un peu plus lourde.', deltas: { or: 8, forme: -3 } },
          { weight: 25, text: 'Même une run courte peut mal tourner.', deltas: { forme: -7, or: 2 } },
        ],
      },
    ],
  },
  {
    id: 'miroir',
    title: 'Mode Miroir',
    text: 'Face à vous : vous. Ou pire — une version qui a fait les bons choix.',
    weight: 7,
    tags: ['ombres', 'combat'],
    options: [
      {
        label: 'Accepter le duel intérieur',
        outcomes: [
          { weight: 55, text: 'Vous battez votre reflet. Quelque chose se décante.', deltas: { puissance: 4, magie: 3, moral: 6, renommee: 4 } },
          { weight: 45, text: 'Le reflet gagne. La leçon est amère.', deltas: { moral: -8, forme: -5, charisme: 2 } },
        ],
      },
      {
        label: 'Refuser et méditer',
        outcomes: [
          { weight: 100, text: 'Pas de gloire. Un peu de paix.', deltas: { moral: 5, forme: 4, renommee: -2 } },
        ],
      },
    ],
  },
  {
    id: 'cataclysme',
    title: 'Cataclysme',
    text: 'Le ciel de la Cave se fend. Un World Boss attend ceux qui osent.',
    weight: 6,
    tags: ['ombres', 'combat'],
    options: [
      {
        label: 'Charger le boss mondial',
        outcomes: [
          { weight: 35, text: 'Vous survituez au cataclysme. Les bardes noteront ça.', deltas: { renommee: 16, puissance: 6, forme: -14, trophies: { cataclysme: 1 } } },
          { weight: 65, text: 'Vous êtes une statistique de plus dans les logs.', deltas: { forme: -16, moral: -8, renommee: 2 } },
        ],
      },
      {
        label: 'Soutenir depuis l’arrière',
        outcomes: [
          { weight: 70, text: 'Contribution solide, risques contenus.', deltas: { or: 6, renommee: 4, forme: -4 } },
          { weight: 30, text: 'Même à l’arrière, le souffle vous atteint.', deltas: { forme: -9, moral: -3 } },
        ],
      },
    ],
  },
  {
    id: 'entrainement',
    title: 'Salle d’entraînement',
    text: 'Cibles. Sparring. Stats. La gloire attend ceux qui grindent.',
    weight: 10,
    tags: ['train'],
    options: [
      {
        label: 'Session intensive',
        outcomes: [
          { weight: 100, text: 'Sueurs, micro-gains, moral d’acier.', deltas: { puissance: 3, endurance: 3, vitesse: 2, forme: -4, moral: 3 } },
        ],
      },
      {
        label: 'Optimiser le build',
        outcomes: [
          { weight: 100, text: 'Vous redistribuez, affinez, devenez plus tranchant.', deltas: { magie: 3, vitesse: 3, charisme: 1 } },
        ],
      },
    ],
  },
  {
    id: 'taverne_nuit',
    title: 'Nuit à la Taverne',
    text: 'Chants, paris, disputes de meta. La Cave sociale ne dort jamais.',
    weight: 9,
    tags: ['social'],
    options: [
      {
        label: 'Réseauter avec les champions',
        outcomes: [
          { weight: 60, text: 'On retient votre nom. Une porte s’ouvre.', deltas: { charisme: 6, renommee: 4, or: -4 } },
          { weight: 40, text: 'Vous parlez trop fort. On se moque gentiment.', deltas: { charisme: 2, moral: -2 } },
        ],
      },
      {
        label: 'Boire et oublier',
        outcomes: [
          { weight: 50, text: 'Lendemain difficile. Cœur plus léger.', deltas: { moral: 8, forme: -6, or: -6 } },
          { weight: 50, text: 'Bagarre de taverne. Votre réputation… évolue.', deltas: { puissance: 2, renommee: 3, forme: -8, or: -3 } },
        ],
      },
    ],
  },
  {
    id: 'extension',
    title: 'Donjon d’Extension',
    text: 'Une aile oubliée. Des mécaniques nouvelles. L’équipe balance déjà.',
    weight: 7,
    tags: ['donjons'],
    options: [
      {
        label: 'Tester le contenu frais',
        outcomes: [
          { weight: 55, text: 'Vous trouvez une faille. Patch incoming… trop tard pour le loot.', deltas: { renommee: 7, or: 10, magie: 3, trophies: { extension: 1 } } },
          { weight: 45, text: 'Contenu pas encore équilibré. Vous en faites les frais.', deltas: { forme: -10, moral: -4 } },
        ],
      },
      {
        label: 'Attendre le hotifix',
        outcomes: [
          { weight: 100, text: 'Patience de vétéran. Moins de risque, moins de scoop.', deltas: { moral: 2, or: 2 } },
        ],
      },
    ],
  },
  {
    id: 'pvp',
    title: 'Défi PvP',
    text: 'Un lobby s’ouvre. Quelqu’un doute de votre niveau. Publiquement.',
    weight: 8,
    tags: ['combat', 'tournoi'],
    options: [
      {
        label: 'Accepter le 1v1',
        outcomes: [
          { weight: 50, text: 'Victoire nette. Le classement sourit.', deltas: { renommee: 9, puissance: 3, moral: 5, trophies: { pvp: 1 } } },
          { weight: 50, text: 'Défaite éducative. Très éducative.', deltas: { moral: -7, forme: -5, vitesse: 2 } },
        ],
      },
      {
        label: 'Ignorer la provocation',
        outcomes: [
          { weight: 100, text: 'Vous gardez votre énergie pour ce qui compte.', deltas: { moral: 2, charisme: -2 } },
        ],
      },
    ],
  },
  {
    id: 'boss_rush',
    title: 'Boss Rush',
    text: 'Enchaînement. Pas de souffle. Les bosses défilent comme un mauvais rêve.',
    weight: 6,
    tags: ['combat', 'ombres'],
    options: [
      {
        label: 'Lancer la rush complète',
        outcomes: [
          { weight: 40, text: 'Clear. Les mains tremblent encore.', deltas: { endurance: 5, puissance: 4, forme: -12, renommee: 8, trophies: { bossRush: 1 } } },
          { weight: 60, text: 'Wipe au milieu. Recommencez… ou pas.', deltas: { forme: -14, moral: -6 } },
        ],
      },
      {
        label: 'S’arrêter au checkpoint',
        outcomes: [
          { weight: 100, text: 'Progression honorable. Ego intact.', deltas: { endurance: 2, or: 4, forme: -4 } },
        ],
      },
    ],
  },
  {
    id: 'blessure',
    title: 'Contrecoup',
    text: 'Une ancienne blessure se rappelle à vous. La Cave ne soigne pas tout.',
    weight: 5,
    tags: ['crise'],
    options: [
      {
        label: 'Forcer malgré la douleur',
        outcomes: [
          { weight: 40, text: 'Vous devenez une légende… ou une statistique. Aujourd’hui, légende.', deltas: { renommee: 6, puissance: 3, forme: -10, moral: 4 } },
          { weight: 60, text: 'Vous aggravez tout. Repos forcé.', deltas: { forme: -16, moral: -8, puissance: -2 } },
        ],
      },
      {
        label: 'Se soigner à la Taverne',
        outcomes: [
          { weight: 100, text: 'Repos, tisane douteuse, moral remonté.', deltas: { forme: 12, moral: 6, or: -5, renommee: -2 } },
        ],
      },
    ],
  },
  {
    id: 'mentor_conseil',
    title: 'Conseil du mentor',
    text: 'Votre mentor vous tire à part. « La Cave change. Toi aussi. »',
    weight: 6,
    tags: ['social'],
    options: [
      {
        label: 'Suivre le conseil à la lettre',
        outcomes: [
          { weight: 70, text: 'La voie indiquée porte ses fruits.', deltas: { magie: 3, puissance: 3, moral: 4 } },
          { weight: 30, text: 'Mauvais timing. Le conseil date d’une autre meta.', deltas: { moral: -3, renommee: -2 } },
        ],
      },
      {
        label: 'Suivre votre instinct',
        outcomes: [
          { weight: 55, text: 'Vous aviez raison. Le mentor sourit, un peu vexé.', deltas: { charisme: 4, renommee: 3, moral: 3 } },
          { weight: 45, text: 'L’instinct vous trompe. Leçon notée.', deltas: { moral: -4, forme: -2 } },
        ],
      },
    ],
  },
  {
    id: 'arme_rare',
    title: 'Butin d’arme',
    text: 'Un coffre pulse d’une lueur rare. Dedans : une arme qui pourrait tout changer.',
    weight: 7,
    tags: ['loot'],
    options: [
      {
        label: 'L’équiper immédiatement',
        outcomes: [
          { weight: 60, text: 'Le feeling est là. Votre build s’illumine.', deltas: { puissance: 4, magie: 3, vitesse: 2, or: -2 } },
          { weight: 40, text: 'Mauvaise synergie. Vous perdez un temps précieux.', deltas: { moral: -3, or: -4 } },
        ],
      },
      {
        label: 'La vendre aux enchères',
        outcomes: [
          { weight: 100, text: 'Un collectionneur paie le prix fort.', deltas: { or: 18, renommee: 2 } },
        ],
      },
    ],
  },
  {
    id: 'coop_red',
    title: 'Expédition Coop Rouge',
    text: 'On vous propose un groupe. Quatre egos. Un donjon. Zéro excuse.',
    weight: 6,
    tags: ['donjons', 'social'],
    options: [
      {
        label: 'Mener le groupe',
        outcomes: [
          { weight: 50, text: 'Leadership impeccable. Clear et respect.', deltas: { charisme: 5, renommee: 6, or: 8, trophies: { coop: 1 } } },
          { weight: 50, text: 'Le wipe est spectaculaire. Les logs aussi.', deltas: { charisme: -3, moral: -6, forme: -6 } },
        ],
      },
      {
        label: 'Jouer support discret',
        outcomes: [
          { weight: 80, text: 'Vous portez sans briller. L’équipe s’en souvient.', deltas: { endurance: 3, magie: 2, or: 5, moral: 3 } },
          { weight: 20, text: 'On vous ignore dans le loot. Classique.', deltas: { or: 1, moral: -4 } },
        ],
      },
    ],
  },
];

export const CAVE_DESTINY_TIERS = [
  { minScore: 0, id: 'recrue', label: 'Recrue de la Cave', color: 'text-stone-300' },
  { minScore: 120, id: 'aventurier', label: 'Aventurier confirmé', color: 'text-emerald-300' },
  { minScore: 200, id: 'elite', label: 'Élite des profondeurs', color: 'text-blue-300' },
  { minScore: 280, id: 'champion', label: 'Champion de la Cave', color: 'text-amber-300' },
  { minScore: 360, id: 'legende', label: 'Légende vivante', color: 'text-yellow-200' },
  { minScore: 440, id: 'mythe', label: 'Mythe des Duels', color: 'text-fuchsia-300' },
];

export const CAVE_DESTINY_SEASON_COUNT = 14;
export const STORAGE_KEY_SAVE = 'caveDestiny:save';
export const STORAGE_KEY_PANTHEON = 'caveDestiny:pantheon';

export function getRaceIcon(race) {
  return races[race]?.icon || '⚔️';
}

export function getClassIcon(classe) {
  return classes[classe]?.icon || '🗡️';
}

export function getClassAbility(classe) {
  return classes[classe]?.ability || '';
}
