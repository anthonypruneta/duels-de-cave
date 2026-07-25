/**
 * Quêtes liées à la famille d’arme (Cave Destiny).
 * Pas d’obtention / upgrade d’arme — uniquement défis narratifs + stats.
 * La progression d’arme reste la voie Ornn (forge_voie).
 */

import { trio } from './caveDestinyEventUtils';

function q({ id, family, title, text, rarity = 'uncommon', tags = [], options }) {
  return {
    id,
    title,
    text,
    rarity,
    tags: ['arme_quete', ...tags],
    requiresWeaponFamily: family,
    options,
  };
}

/** @type {import('./caveDestinyChains').DestinyChain[]} */
export const WEAPON_QUEST_CHAIN_DEFS = [
  { id: 'suite_dague', family: 'dague', label: 'Braquage à la dague', steps: ['dague_plan', 'dague_fuite', 'dague_coupe'] },
  { id: 'suite_arc', family: 'arc', label: 'Tir vers les cieux', steps: ['arc_rumeur', 'arc_tour', 'arc_ciel'] },
  { id: 'suite_lance', family: 'lance', label: 'Ligne de la lance', steps: ['lance_runes', 'lance_jet', 'lance_etendard'] },
  { id: 'suite_marteau', family: 'marteau', label: 'Tonnerre du marteau', steps: ['marteau_enclume', 'marteau_soulever', 'marteau_foudre'] },
  { id: 'suite_tome', family: 'tome', label: 'Pages interdites', steps: ['tome_seuil', 'tome_copie', 'tome_esprit'] },
  { id: 'suite_faux', family: 'faux', label: 'Murmures de la faux', steps: ['faux_couloir', 'faux_marche', 'faux_silence'] },
  { id: 'suite_epee', family: 'epee', label: 'Voie de la lame', steps: ['epee_garde', 'epee_duel', 'epee_honneur'] },
  { id: 'suite_hache', family: 'hache', label: 'Fendeur de portes', steps: ['hache_abattage', 'hache_charge', 'hache_muron'] },
  { id: 'suite_bouclier', family: 'bouclier', label: 'Rempart vivant', steps: ['bouclier_ligne', 'bouclier_siege', 'bouclier_egide'] },
  { id: 'suite_baton', family: 'baton', label: 'Bois qui soigne', steps: ['baton_sentier', 'baton_bosquet', 'baton_sève'] },
  { id: 'suite_sceptre', family: 'sceptre', label: 'Cour de l’ombre', steps: ['sceptre_audience', 'sceptre_pacte', 'sceptre_trone'] },
  { id: 'suite_fleau', family: 'fleau', label: 'Chaînes du fléau', steps: ['fleau_liens', 'fleau_crepuscule', 'fleau_anatheme'] },
  { id: 'suite_arbalete', family: 'arbalete', label: 'Serment de l’arbalète', steps: ['arbalete_embuscade', 'arbalete_serment', 'arbalete_verdict'] },
  { id: 'suite_pendule', family: 'pendule', label: 'Temps suspendu', steps: ['pendule_tic', 'pendule_fige', 'pendule_dette'] },
];

export const CAVE_DESTINY_WEAPON_QUEST_CHAINS = Object.fromEntries(
  WEAPON_QUEST_CHAIN_DEFS.map((c) => [
    c.id,
    {
      id: c.id,
      ambition: null,
      label: c.label,
      steps: c.steps,
    },
  ])
);

export const CAVE_DESTINY_WEAPON_QUEST_EVENTS = [
  // ——— Dague : braquage ———
  q({
    id: 'dague_plan',
    family: 'dague',
    title: 'Plan de braquage',
    text: 'Une planque murmure un coup. Votre {arme} est trop fine pour la gloire — parfaite pour l’ombre et les serrures.',
    tags: ['ombres'],
    options: [
      {
        id: 'guetter',
        label: 'Guetter les rondes',
        outcomes: trio(
          { text: 'Vous chronométrez tout. Le braquage a une fenêtre — et votre {arme} un sourire.', deltas: { spd: 3, charisme: 1, or: 3 } },
          { text: 'Presque parfait. Une ronde de trop ; vous notez quand même le rythme.', deltas: { spd: 1 } },
          { text: 'On vous remarque. Fuite sèche — pas de butin, juste le goût du risque raté.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'crocheter',
        label: 'Crocheter la porte d’essai',
        outcomes: trio(
          { text: 'Clic. La serrure cède. Votre {arme} glisse comme une clé vivante.', deltas: { spd: 2, or: 5, renommee: 1 } },
          { text: 'Ça force, mais ça passe. Doigts un peu brûlés, orgueil intact.', deltas: { or: 2, hp: -1 } },
          { text: 'Alarme sourde. Vous disparaissez avant les gardes — sans le coffre.', deltas: { hp: -4, moral: -2 } },
        ),
      },
      {
        id: 'recruter',
        label: 'Recruter un regard complice',
        outcomes: trio(
          { text: 'Un clin d’œil, un pacte. Le coup a deux ombres maintenant.', deltas: { charisme: 3, or: 2 } },
          { text: 'Accord tiède. Ils viendront… peut-être.', deltas: { charisme: 1 } },
          { text: 'On vous vend. Presque. Vous partez avant que la table se retourne.', deltas: { moral: -3, renommee: -1 } },
        ),
      },
    ],
  }),
  q({
    id: 'dague_fuite',
    family: 'dague',
    title: 'Fuite dans les ruelles',
    text: 'Le coffre est ouvert — trop vite. Des pas derrière. Votre {arme} connaît déjà le chemin des toits.',
    rarity: 'rare',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'toits',
        label: 'Prendre les toits',
        outcomes: trio(
          { text: 'Tuiles, vent, silence. Vous disparaissez avec le butin — {arme} encore chaude.', deltas: { spd: 4, or: 8, hp: -3 } },
          { text: 'Une tuile cède. Vous glissez, sauvez le sac, perdez un peu de peau.', deltas: { spd: 2, or: 3, hp: -5 } },
          { text: 'Chute courte. Les poursuivants gagnent du terrain ; le butin aussi… vers eux.', deltas: { hp: -8, or: -2, moral: -3 } },
        ),
      },
      {
        id: 'couper',
        label: 'Couper la bourse et semer',
        outcomes: trio(
          { text: 'Deux coups. Deux bourses. La ruelle vous avale.', deltas: { auto: 2, spd: 2, or: 6 } },
          { text: 'Un seul coup net. Assez pour fuir, pas pour briller.', deltas: { or: 3, hp: -2 } },
          { text: 'Lame trop courte ce soir. On vous rattrape — coup, juron, fuite honteuse.', deltas: { hp: -9, moral: -4 } },
        ),
      },
      {
        id: 'cachette',
        label: 'Se fondre dans un tas d’ombre',
        outcomes: trio(
          { text: 'Ils passent. Vous comptez l’or en silence, {arme} contre la poitrine.', deltas: { spd: 2, or: 5, moral: 2 } },
          { text: 'Longue attente. Ils s’éloignent. Le cœur se calme enfin.', deltas: { or: 2 } },
          { text: 'Un chien vous trahit. Course reprise — plus sale, plus courte.', deltas: { hp: -6, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'dague_coupe',
    family: 'dague',
    title: 'La coupe finale',
    text: 'Dernier garde. Dernière serrure. Votre {arme} décide si le braquage devient légende… ou anecdote.',
    rarity: 'rare',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'silent',
        label: 'Frapper sans un bruit',
        outcomes: trio(
          { text: 'Un geste. Le garde s’affaisse. Le coffre-fort est à vous — et la Cave le sait.', deltas: { spd: 5, or: 12, renommee: 4, hp: -2 } },
          { text: 'Presque silencieux. Assez pour ouvrir ; pas assez pour partir propres.', deltas: { spd: 2, or: 5, hp: -4 } },
          { text: 'Il crie. Tout le quartier répond. Vous fuyez les mains vides.', deltas: { hp: -10, moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'bluff',
        label: 'Bluffer en sortant {arme}',
        outcomes: trio(
          { text: 'Le fer parle. Ils reculent. Vous repartez riches et insolents.', deltas: { charisme: 4, or: 10, renommee: 3 } },
          { text: 'Bluff tiède. Ils hésitent ; vous glissez avec le minimum.', deltas: { charisme: 1, or: 4 } },
          { text: 'Ils rient. Puis frappent. Votre {arme} n’a pas suffi à faire peur.', deltas: { hp: -8, moral: -4, charisme: -2 } },
        ),
      },
      {
        id: 'partager',
        label: 'Partager le butin et disparaître',
        outcomes: trio(
          { text: 'Pactes tenus. Moins d’or, plus d’alliés dans l’ombre.', deltas: { or: 6, charisme: 3, moral: 3, renommee: 2 } },
          { text: 'Partage correct. Personne ne trahit… ce soir.', deltas: { or: 3, charisme: 1 } },
          { text: 'On vous coupe la part. L’ombre a ses règles ; vous les apprenez trop tard.', deltas: { or: -4, moral: -4 } },
        ),
      },
    ],
  }),

  // ——— Arc ———
  q({
    id: 'arc_rumeur',
    family: 'arc',
    title: 'Rumeur de la tour',
    text: 'On dit qu’au sommet d’une tour oubliée, le vent tire encore des flèches. Votre {arme} vibre à l’idée.',
    tags: ['donjons'],
    options: [
      {
        id: 'ecouter',
        label: 'Écouter les chasseurs',
        outcomes: trio(
          { text: 'Une carte orale. Direction, vents, dangers — votre {arme} a déjà une cible.', deltas: { spd: 2, charisme: 1, or: 2 } },
          { text: 'Rumeurs contradictoires. Vous gardez le meilleur fragment.', deltas: { spd: 1 } },
          { text: 'On se moque de votre {arme}. Orgueil piqué, infos nulles.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'viser',
        label: 'Tirer une flèche-test au loin',
        outcomes: trio(
          { text: 'La flèche chante juste. Le chemin se révèle dans le sifflement.', deltas: { spd: 3, auto: 1 } },
          { text: 'Tir correct. Assez pour calibrer le vent.', deltas: { spd: 1 } },
          { text: 'La flèche se perd. Vous aussi, un instant.', deltas: { moral: -2, or: -1 } },
        ),
      },
      {
        id: 'partir',
        label: 'Partir sans attendre l’aube',
        outcomes: trio(
          { text: 'Marche nocturne. Vos yeux s’habituent ; la tour se dessine.', deltas: { spd: 2, moral: 1, hp: -2 } },
          { text: 'Route longue. Rien de glorieux, rien de perdu.', deltas: { hp: -1 } },
          { text: 'Mauvais sentier. Ronces, fatigue, tour encore loin.', deltas: { hp: -5, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'arc_tour',
    family: 'arc',
    title: 'Escalade sous le vent',
    text: 'La tour penche. Chaque palier demande un tir d’ancrage. Votre {arme} devient grappin, serment, souffle.',
    rarity: 'rare',
    tags: ['donjons'],
    options: [
      {
        id: 'ancrer',
        label: 'Ancrer chaque palier d’une flèche',
        outcomes: trio(
          { text: 'Progression parfaite. Corde, pierre, rythme — le sommet approche.', deltas: { spd: 4, def: 1, hp: -3 } },
          { text: 'Quelques flèches perdues. Vous grimpez quand même.', deltas: { spd: 2, hp: -4 } },
          { text: 'Ancrage qui lâche. Chute courte, orgueil long à remonter.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'archer',
        label: 'Compter sur l’œil d’archer',
        ifClass: ['Archer', 'Voleur'],
        outcomes: trio(
          { text: 'Chaque prise est une cible. Vous dansez sur la pierre.', deltas: { spd: 5, renommee: 2 } },
          { text: 'Bon œil, bras fatigué. Ça suffit.', deltas: { spd: 2, hp: -2 } },
          { text: 'Le vent ment. Vous ratez une prise — leçons dures.', deltas: { hp: -7, moral: -2 } },
        ),
      },
      {
        id: 'abris',
        label: 'Attendre une accalmie',
        outcomes: trio(
          { text: 'Le vent tombe. Escalade propre, souffle long.', deltas: { moral: 3, spd: 1 } },
          { text: 'Attente utile. Rien de plus.', deltas: { moral: 1 } },
          { text: 'L’accalmie ne vient pas. Nuit perdue, tour plus froide.', deltas: { moral: -3, hp: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'arc_ciel',
    family: 'arc',
    title: 'Ciel tendu',
    text: 'Au sommet : pas une arme à prendre — une épreuve. Tirer juste, une fois, sous un ciel trop bas.',
    rarity: 'rare',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'tir',
        label: 'Tirer au cœur du vent',
        outcomes: trio(
          { text: 'La flèche disparaît dans le bleu. Votre {arme} vibre d’accord — le ciel a répondu.', deltas: { spd: 5, auto: 3, renommee: 5, hp: -2 } },
          { text: 'Tir honorable. Pas de mythe, mais la main sait.', deltas: { spd: 2, auto: 1, hp: -3 } },
          { text: 'Le vent gagne. Flèche perdue, orgueil aussi.', deltas: { hp: -6, moral: -5 } },
        ),
      },
      {
        id: 'salut',
        label: 'Saluer la tour et redescendre',
        outcomes: trio(
          { text: 'Respect. Une plume s’accroche à votre carquois — assez pour se souvenir.', deltas: { moral: 4, cap: 2, renommee: 2 } },
          { text: 'Descente propre. Leçon empochée.', deltas: { moral: 2 } },
          { text: 'Descente honteuse. On murmure que vous avez eu peur du ciel.', deltas: { moral: -3, renommee: -1 } },
        ),
      },
      {
        id: 'defi',
        label: 'Défier un tireur rival au sommet',
        outcomes: trio(
          { text: 'Deux flèches. La vôtre gagne. Le rival incline la tête.', deltas: { spd: 3, renommee: 4, or: 4 } },
          { text: 'Match nul. Respect mutuel, mains qui tremblent.', deltas: { spd: 1, charisme: 1 } },
          { text: 'Sa flèche est plus vraie. Vous redescendez plus sages… et vexés.', deltas: { moral: -4, hp: -3 } },
        ),
      },
    ],
  }),

  // ——— Lance ———
  q({
    id: 'lance_runes',
    family: 'lance',
    title: 'Runes de la haste',
    text: 'Des runes anciennes parlent de ligne droite. Votre {arme} semble déjà connaître le chemin.',
    tags: ['forge'],
    options: [
      {
        id: 'lire',
        label: 'Lire les runes à voix basse',
        outcomes: trio(
          { text: 'Le sens s’ouvre. Prochaine frappe plus longue, plus juste.', deltas: { cap: 3, auto: 2 } },
          { text: 'Quelques glyphes utiles. Le reste reste muet.', deltas: { cap: 1 } },
          { text: 'Les runes tournent. Vertige — trop de lignes, pas assez de sol.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'tracer',
        label: 'Retracer une rune sur {arme}',
        outcomes: trio(
          { text: 'Le trait tient. Votre {arme} chauffe d’approbation.', deltas: { auto: 3, renommee: 1 } },
          { text: 'Trait imparfait. Ça tiendra le temps d’un duel.', deltas: { auto: 1 } },
          { text: 'La rune refuse. Main brûlée, orgueil aussi.', deltas: { hp: -4, moral: -2 } },
        ),
      },
      {
        id: 'garder',
        label: 'Garder le secret pour plus tard',
        outcomes: trio(
          { text: 'Sagesse. Vous repartez avec une carte mentale intacte.', deltas: { moral: 2, cap: 1 } },
          { text: 'Rien de perdu, rien gagné.', deltas: {} },
          { text: 'Le secret vous démange. Concentration en berne.', deltas: { moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'lance_jet',
    family: 'lance',
    title: 'Jet rituel',
    text: 'Un cercle de pierre. On jette. On récupère. Ou on rate — et la ligne vous juge.',
    rarity: 'rare',
    tags: ['combat', 'forge'],
    options: [
      {
        id: 'jeter',
        label: 'Jeter {arme} au cœur du cercle',
        outcomes: trio(
          { text: 'Elle revient. Sifflement, chaleur, certitude — la ligne vous accepte.', deltas: { auto: 4, spd: 2, renommee: 3 } },
          { text: 'Presque. Elle vibre, puis se tait. Assez pour apprendre.', deltas: { auto: 2, hp: -2 } },
          { text: 'Elle vous fuit. Doigts brûlés, regard des témoins trop clair.', deltas: { hp: -6, moral: -4 } },
        ),
      },
      {
        id: 'viser_loin',
        label: 'Viser plus loin que le cercle',
        outcomes: trio(
          { text: 'Portée folle. Les anciens hochent — rare pour une {arme}.', deltas: { auto: 3, spd: 3, renommee: 2 } },
          { text: 'Beau geste, distance moyenne.', deltas: { spd: 1, auto: 1 } },
          { text: 'Trop loin. La lance se plante… ailleurs. Humiliation propre.', deltas: { moral: -4, renommee: -1 } },
        ),
      },
      {
        id: 'observer',
        label: 'Observer un autre lanceur d’abord',
        outcomes: trio(
          { text: 'Vous volez le rythme. Votre jet suivant sera meilleur.', deltas: { cap: 2, auto: 1, moral: 1 } },
          { text: 'Quelques détails retenus.', deltas: { cap: 1 } },
          { text: 'Trop regarder tue le bras. Paralysie sèche.', deltas: { moral: -3 } },
        ),
      },
    ],
  }),
  q({
    id: 'lance_etendard',
    family: 'lance',
    title: 'Étendard planté',
    text: 'Dernière épreuve : planter {arme} comme un étendard et tenir la ligne — sans la laisser tomber.',
    rarity: 'rare',
    tags: ['combat'],
    options: [
      {
        id: 'planter',
        label: 'Planter et tenir',
        outcomes: trio(
          { text: 'L’étendard tient. Autour de vous, les regards se redressent.', deltas: { auto: 3, charisme: 3, renommee: 5, def: 2 } },
          { text: 'Ça tient… juste. Assez pour la leçon.', deltas: { auto: 1, charisme: 1, hp: -3 } },
          { text: 'Elle tombe. Avec elle, un peu de votre stature.', deltas: { moral: -5, renommee: -2, hp: -3 } },
        ),
      },
      {
        id: 'charge',
        label: 'Charger derrière la pointe',
        outcomes: trio(
          { text: 'Ligne droite, choc net. La formation suit votre {arme}.', deltas: { auto: 5, spd: 2, renommee: 3, hp: -4 } },
          { text: 'Charge correcte. Pas de rupture, pas de triomphe.', deltas: { auto: 2, hp: -4 } },
          { text: 'La ligne se brise. Vous seul avancez — trop loin.', deltas: { hp: -10, moral: -4 } },
        ),
      },
      {
        id: 'guerrier',
        label: 'Haranguer comme un porte-étendard',
        ifClass: ['Guerrier', 'Paladin', 'Bastion'],
        outcomes: trio(
          { text: 'Votre voix porte. La lance n’est plus seule — toute une ligne avec elle.', deltas: { charisme: 4, renommee: 4, auto: 2 } },
          { text: 'Harangue correcte. Quelques dos se redressent.', deltas: { charisme: 2 } },
          { text: 'La voix casse. Silence gênant.', deltas: { moral: -3, charisme: -1 } },
        ),
      },
    ],
  }),

  // ——— Marteau ———
  q({
    id: 'marteau_enclume',
    family: 'marteau',
    title: 'Murmure d’enclume',
    text: 'Une enclume abandonnée résonne quand votre {arme} s’approche. Pas pour forger une arme — pour juger le bras.',
    tags: ['forge'],
    options: [
      {
        id: 'frappe',
        label: 'Frapper l’enclume trois fois',
        outcomes: trio(
          { text: 'Trois notes justes. Le métal vous reconnaît comme ouvrier, pas comme voleur.', deltas: { auto: 3, def: 1, renommee: 1 } },
          { text: 'Deux bonnes, une sourde. Assez pour continuer.', deltas: { auto: 1 } },
          { text: 'L’enclume se tait. Vos poignets vibrent de trop.', deltas: { hp: -4, moral: -2 } },
        ),
      },
      {
        id: 'ecouter',
        label: 'Écouter la résonance',
        outcomes: trio(
          { text: 'Vous entendez le défaut dans votre geste — et le corrigez.', deltas: { cap: 2, auto: 1, moral: 1 } },
          { text: 'Un souffle d’insight. Court.', deltas: { cap: 1 } },
          { text: 'Trop de silence. Doute.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'nain',
        label: 'Invoquer la cadence naine',
        ifRace: ['Nain', 'Dragonkin'],
        outcomes: trio(
          { text: 'La cadence tombe juste. L’enclume répond comme à la maison.', deltas: { auto: 4, def: 2 } },
          { text: 'Presque ancestral. Les tendons protestent.', deltas: { auto: 2, hp: -2 } },
          { text: 'Même le sang de forge rate parfois.', deltas: { hp: -5, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'marteau_soulever',
    family: 'marteau',
    title: 'Poids digne',
    text: 'On vous propose de soulever une masse sacrée — pas pour la garder : pour prouver que votre {arme} n’est pas du vent.',
    rarity: 'rare',
    tags: ['forge', 'combat'],
    options: [
      {
        id: 'soulever',
        label: 'Soulever d’un seul élan',
        outcomes: trio(
          { text: 'La masse monte. Tonnerre discret — les forgerons hochent.', deltas: { auto: 5, def: 2, renommee: 4, hp: -4 } },
          { text: 'Elle bouge d’un pouce. Assez pour croire.', deltas: { auto: 2, hp: -5 } },
          { text: 'Immobile. Humiliation lourde comme l’acier.', deltas: { moral: -6, renommee: -2, hp: -3 } },
        ),
      },
      {
        id: 'technique',
        label: 'Utiliser levier et souffle',
        outcomes: trio(
          { text: 'Technique > force brute. La masse cède avec élégance.', deltas: { auto: 3, cap: 2, renommee: 2 } },
          { text: 'Ça passe. Peu glorieux, efficace.', deltas: { auto: 1, hp: -2 } },
          { text: 'Le levier casse. Vous avec, presque.', deltas: { hp: -8, moral: -3 } },
        ),
      },
      {
        id: 'defier',
        label: 'Défier un rival au même poids',
        outcomes: trio(
          { text: 'Vous gagnez au dernier souffle. La forge applaudit du regard.', deltas: { auto: 3, renommee: 3, or: 3 } },
          { text: 'Égalité. Respect, bleus partagés.', deltas: { auto: 1, hp: -3 } },
          { text: 'Il soulève. Pas vous. La leçon pèse.', deltas: { moral: -4, hp: -4 } },
        ),
      },
    ],
  }),
  q({
    id: 'marteau_foudre',
    family: 'marteau',
    title: 'Écho de foudre',
    text: 'Dernière frappe : viser la cloche de bronze. Si votre {arme} chante juste, le tonnerre répond — sans rien vous donner d’autre que le respect.',
    rarity: 'epic',
    tags: ['forge'],
    options: [
      {
        id: 'frappe_cloche',
        label: 'Frapper la cloche de plein fouet',
        outcomes: trio(
          { text: 'La cloche hurle. Un éclair lointain répond. Votre {arme} n’a jamais sonné si vrai.', deltas: { auto: 6, def: 3, renommee: 6, hp: -5 } },
          { text: 'Beau son, pas de foudre. Suffisant pour les anciens.', deltas: { auto: 3, renommee: 2, hp: -4 } },
          { text: 'Son creux. Les rires sonnent plus fort que le bronze.', deltas: { moral: -6, renommee: -2, hp: -4 } },
        ),
      },
      {
        id: 'prier',
        label: 'Demander un signe à la Forge',
        outcomes: trio(
          { text: 'Une rune de chaleur vous marque le poignet. Pas une arme — une permission.', deltas: { auto: 3, cap: 2, renommee: 3, moral: 2 } },
          { text: 'Silence poli. Vous repartez un peu plus calmes.', deltas: { moral: 2 } },
          { text: 'Pas de signe. Seulement le froid de l’enclume.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'partager',
        label: 'Laisser un apprenti frapper après vous',
        outcomes: trio(
          { text: 'Transmission. La forge aime ça plus que la gloire.', deltas: { charisme: 3, renommee: 3, moral: 3 } },
          { text: 'Geste correct. L’apprenti sourit trop fort.', deltas: { charisme: 1, moral: 1 } },
          { text: 'Il rate. On vous regarde comme un mauvais maître.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  }),

  // ——— Tome ———
  q({
    id: 'tome_seuil',
    family: 'tome',
    title: 'Seuil du savoir',
    text: 'Une bibliothèque condamnée. Votre {arme} pulse — non pour voler un grimoire, pour prouver que vous savez lire sans vous perdre.',
    tags: ['magie'],
    options: [
      {
        id: 'ouvrir',
        label: 'Ouvrir le premier livre scellé',
        outcomes: trio(
          { text: 'Une formule stable. Votre esprit tient ; le livre aussi.', deltas: { cap: 4, renommee: 1 } },
          { text: 'Pages utiles, migraine légère.', deltas: { cap: 2, hp: -2 } },
          { text: 'Le sceau mord. Sang de nez, leçon claire.', deltas: { hp: -5, moral: -3, cap: 1 } },
        ),
      },
      {
        id: 'cataloguer',
        label: 'Cataloguer sans lire trop loin',
        outcomes: trio(
          { text: 'Carte mentale des rayons. Plus tard, vous saurez où frapper.', deltas: { cap: 2, moral: 2, or: 2 } },
          { text: 'Quelques titres retenus.', deltas: { cap: 1 } },
          { text: 'Trop de titres. Paralysie du savant.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'mindflayer',
        label: 'Goûter une page par l’esprit',
        ifRace: ['Mindflayer'],
        outcomes: trio(
          { text: 'Savoir absorbé proprement. Terrifiant… et utile.', deltas: { cap: 5, renommee: 2 } },
          { text: 'Fragment digéré. Soif d’en savoir encore.', deltas: { cap: 2 } },
          { text: 'Retour de bâton. Le livre a mordu plus fort.', deltas: { moral: -5, hp: -3 } },
        ),
      },
    ],
  }),
  q({
    id: 'tome_copie',
    family: 'tome',
    title: 'Copie sous pression',
    text: 'On vous demande une rune. Une seule. Votre {arme} sert d’encrier — pas de trophée.',
    rarity: 'rare',
    tags: ['magie'],
    options: [
      {
        id: 'copier',
        label: 'Copier la rune sans lire le reste',
        outcomes: trio(
          { text: 'Trait net. Pouvoir contenu. Aucune voix parasite.', deltas: { cap: 5, spd: 1 } },
          { text: 'Copie imparfaite. Elle tiendra si vous ne forcez pas.', deltas: { cap: 2 } },
          { text: 'Encre qui brûle. Main marquée, leçon chère.', deltas: { hp: -7, moral: -3 } },
        ),
      },
      {
        id: 'tricher',
        label: 'Improviser une rune « assez proche »',
        outcomes: trio(
          { text: 'Bluff arcanique réussi. Les examinateurs hochent… trop vite.', deltas: { cap: 3, charisme: 2, renommee: 2 } },
          { text: 'Ça passe. De justesse.', deltas: { cap: 1, charisme: 1 } },
          { text: 'On voit l’imposture. Humiliation érudite.', deltas: { moral: -4, renommee: -2 } },
        ),
      },
      {
        id: 'sorciere',
        label: 'Sceller la copie d’une malédiction douce',
        ifClass: ['Sorcière', 'Demoniste', 'Mage'],
        outcomes: trio(
          { text: 'Le sceau tient. La rune obéit à votre ombre.', deltas: { cap: 4, charisme: 2, renommee: 2 } },
          { text: 'Sceau fragile. Utile une saison.', deltas: { cap: 2 } },
          { text: 'Retour de sort. Amer, juste.', deltas: { moral: -4, hp: -4 } },
        ),
      },
    ],
  }),
  q({
    id: 'tome_esprit',
    family: 'tome',
    title: 'Esprit sous les pages',
    text: 'Finale : affronter une idée vivante née d’un livre. Votre {arme} ne se transforme pas — vous, si.',
    rarity: 'epic',
    tags: ['magie', 'combat'],
    options: [
      {
        id: 'affronter',
        label: 'Affronter l’idée de face',
        outcomes: trio(
          { text: 'Vous pliez le concept. Capacité plus nette, regard plus dur.', deltas: { cap: 7, renommee: 4, moral: -1, hp: -5 } },
          { text: 'Match mental. Vous repartez avec une migraine et une formule.', deltas: { cap: 3, hp: -4 } },
          { text: 'L’idée vous lit. Vous fermez le livre trop tard.', deltas: { cap: 1, moral: -7, hp: -6 } },
        ),
      },
      {
        id: 'negocier',
        label: 'Négocier un chapitre d’existence',
        outcomes: trio(
          { text: 'Pacte d’encre. Savoir contre silence — deal tenu.', deltas: { cap: 4, charisme: 3, renommee: 2 } },
          { text: 'Accord tiède. Une page, pas plus.', deltas: { cap: 2 } },
          { text: 'L’idée refuse. Elle garde ses mots ; vous gardez vos peurs.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'fermer',
        label: 'Refermer et partir vivant',
        outcomes: trio(
          { text: 'Sagesse rare. Une bénédiction discrète vous suit.', deltas: { moral: 4, def: 2, cap: 2 } },
          { text: 'Fuite propre. Le livre reste affamé.', deltas: { moral: 1 } },
          { text: 'On murmure lâcheté savante.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  }),

  // ——— Faux ———
  q({
    id: 'faux_couloir',
    family: 'faux',
    title: 'Couloir qui murmure',
    text: 'Le Labyrinthe reconnaît votre {arme}. Pas pour vous en donner une autre — pour vous demander qui vous comptez faucher.',
    tags: ['ombres'],
    options: [
      {
        id: 'ecouter',
        label: 'Écouter les murmures',
        outcomes: trio(
          { text: 'Des noms. Pas le vôtre. Vous avancez plus sûrs.', deltas: { cap: 2, spd: 1, moral: 1 } },
          { text: 'Murmures flous. Un frisson utile.', deltas: { cap: 1 } },
          { text: 'Trop de voix. La vôtre se perd un instant.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'faucher',
        label: 'Faucher une illusion de garde',
        outcomes: trio(
          { text: 'Lame vraie, fantôme faux. Le couloir s’ouvre.', deltas: { auto: 3, cap: 1, renommee: 1 } },
          { text: 'Coupe correcte. Brouillard qui se dissipe à demi.', deltas: { auto: 1, hp: -2 } },
          { text: 'Vous frappez du vide. Le vide rend le coup.', deltas: { hp: -6, moral: -2 } },
        ),
      },
      {
        id: 'mortvivant',
        label: 'Saluer la mort comme une égale',
        ifRace: ['Mort-vivant'],
        outcomes: trio(
          { text: 'Accord d’ombres. Votre {arme} devient plus polie… et plus cruelle.', deltas: { def: 3, cap: 2, renommee: 2 } },
          { text: 'Tolérance mutuelle.', deltas: { def: 1 } },
          { text: 'Même les morts peuvent être snobés.', deltas: { moral: -4 } },
        ),
      },
    ],
  }),
  q({
    id: 'faux_marche',
    family: 'faux',
    title: 'Marché d’ombres',
    text: 'Une entité propose un prix : une peur contre une précision. Votre {arme} attend votre réponse.',
    rarity: 'rare',
    tags: ['ombres'],
    options: [
      {
        id: 'payer',
        label: 'Céder une peur mineure',
        outcomes: trio(
          { text: 'Deal. Votre prochaine coupe sera plus nette — le prix, déjà oublié.', deltas: { auto: 3, spd: 2, moral: -1 } },
          { text: 'Peur vendue, gain tiède.', deltas: { auto: 1, moral: -1 } },
          { text: 'Elle prend trop. Vide dans la poitrine.', deltas: { moral: -6, hp: -3 } },
        ),
      },
      {
        id: 'refuser',
        label: 'Refuser le marché',
        outcomes: trio(
          { text: 'Orgueil propre. L’ombre respecte ça… parfois.', deltas: { moral: 3, renommee: 1 } },
          { text: 'Rien de perdu.', deltas: {} },
          { text: 'L’ombre boude. Couloir plus froid.', deltas: { moral: -2, spd: -1 } },
        ),
      },
      {
        id: 'tromper',
        label: 'Tromper l’entité avec une fausse peur',
        outcomes: trio(
          { text: 'Bluff parfait. Elle repart avec du vent ; vous avec le tranchant.', deltas: { charisme: 3, auto: 2, renommee: 2 } },
          { text: 'Elle doute, puis part. Gain mince.', deltas: { charisme: 1 } },
          { text: 'Pris la main dans le sac spectral.', deltas: { moral: -4, hp: -4 } },
        ),
      },
    ],
  }),
  q({
    id: 'faux_silence',
    family: 'faux',
    title: 'Silence après la coupe',
    text: 'Finale : une présence trop grande pour un nom. Une seule coupe juste — ou un sceau. Votre {arme} choisit avec vous.',
    rarity: 'epic',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'brandir',
        label: 'Brandir et couper',
        outcomes: trio(
          { text: 'Thanatos aurait souri. L’ombre s’allonge — pas pour vous prendre, pour vous suivre.', deltas: { auto: 5, cap: 3, renommee: 5, moral: -2, hp: -5 } },
          { text: 'Coupe honorable. Présence affaiblie, vous aussi.', deltas: { auto: 2, hp: -5 } },
          { text: 'Elle voulait un acompte. Vous avez failli le payer.', deltas: { hp: -11, moral: -6 } },
        ),
      },
      {
        id: 'sceller',
        label: 'Sceller sans frapper',
        outcomes: trio(
          { text: 'Sagesse. Une bénédiction discrète — silence retrouvé.', deltas: { moral: 5, def: 3, renommee: 2 } },
          { text: 'Sceau correct. Le couloir respire.', deltas: { moral: 2 } },
          { text: 'Le murmure continue la nuit.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'offrir',
        label: 'Offrir une prière plutôt qu’un coup',
        outcomes: trio(
          { text: 'L’ombre accepte. Trêve rare — et précieuse.', deltas: { moral: 4, cap: 2, renommee: 2 } },
          { text: 'Prières tièdes. Ça suffit à passer.', deltas: { moral: 1 } },
          { text: 'Rien n’écoute. Ou trop bien.', deltas: { moral: -3, hp: -2 } },
        ),
      },
    ],
  }),

  // ——— Épée ———
  q({
    id: 'epee_garde',
    family: 'epee',
    title: 'Leçon de garde',
    text: 'Un maître d’armes propose une garde oubliée. Votre {arme} doit l’apprendre — pas se faire remplacer.',
    tags: ['combat'],
    options: [
      {
        id: 'apprendre',
        label: 'Répéter la garde cent fois',
        outcomes: trio(
          { text: 'Le geste s’ancre. Votre {arme} trouve un nouvel angle.', deltas: { def: 3, auto: 2 } },
          { text: 'Progrès correct. Bras lourd.', deltas: { def: 1, hp: -2 } },
          { text: 'Vous forcez. Poignet qui crie.', deltas: { hp: -5, moral: -2 } },
        ),
      },
      {
        id: 'defier',
        label: 'Défier le maître tout de suite',
        outcomes: trio(
          { text: 'Vous touchez une fois. Il sourit — rare.', deltas: { auto: 3, renommee: 2, hp: -3 } },
          { text: 'Défaite pédagogique. Utile.', deltas: { def: 1, hp: -3 } },
          { text: 'Correction humiliante. La salle retient le bruit.', deltas: { moral: -4, hp: -4 } },
        ),
      },
      {
        id: 'observer',
        label: 'Observer les élèves d’abord',
        outcomes: trio(
          { text: 'Vous volez trois erreurs à éviter. Or pur.', deltas: { cap: 2, def: 1, moral: 1 } },
          { text: 'Quelques notes.', deltas: { cap: 1 } },
          { text: 'Trop regarder, pas assez faire.', deltas: { moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'epee_duel',
    family: 'epee',
    title: 'Duel de salle',
    text: 'Un rival veut mesurer les lames. Pas de trophée d’arme — seulement le respect du fer.',
    rarity: 'rare',
    tags: ['combat', 'tournoi'],
    options: [
      {
        id: 'duel',
        label: 'Accepter le duel à la première touche',
        outcomes: trio(
          { text: 'Touche nette. La salle murmure votre nom avec {arme}.', deltas: { auto: 4, renommee: 4, hp: -3 } },
          { text: 'Échange long. Match honorable.', deltas: { auto: 2, def: 1, hp: -4 } },
          { text: 'Il touche d’abord. Leçon cuisante.', deltas: { hp: -7, moral: -3, renommee: -1 } },
        ),
      },
      {
        id: 'parade',
        label: 'Jouer la parade parfaite',
        outcomes: trio(
          { text: 'Rien ne passe. Il abandonne, admiratif.', deltas: { def: 4, renommee: 2, charisme: 1 } },
          { text: 'Bonnes parades, une faille.', deltas: { def: 2, hp: -2 } },
          { text: 'Parade trop haute. Contre immédiat.', deltas: { hp: -8, moral: -2 } },
        ),
      },
      {
        id: 'saluer',
        label: 'Saluer et proposer un autre jour',
        outcomes: trio(
          { text: 'Respect. Il boira à votre santé ce soir.', deltas: { charisme: 3, moral: 2 } },
          { text: 'Report accepté.', deltas: { moral: 1 } },
          { text: 'On crie à la peur. Injuste… efficace.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'epee_honneur',
    family: 'epee',
    title: 'Serment de lame',
    text: 'Finale : prêter serment sur {arme}. Pas une nouvelle épée — une ligne que vous ne franchirez plus.',
    rarity: 'rare',
    tags: ['combat', 'social'],
    options: [
      {
        id: 'serment',
        label: 'Jurer sur la garde',
        outcomes: trio(
          { text: 'Le serment tient. Votre {arme} semble plus droite — ou c’est vous.', deltas: { auto: 3, def: 2, renommee: 5, moral: 3 } },
          { text: 'Serment sobre. Ça compte.', deltas: { renommee: 2, moral: 1 } },
          { text: 'Les mots glissent. Doute après la cérémonie.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'proteger',
        label: 'Protéger un plus faible sous serment',
        outcomes: trio(
          { text: 'Vous tenez. La foule le voit. {arme} au service de quelqu’un.', deltas: { def: 3, charisme: 3, renommee: 4, hp: -3 } },
          { text: 'Protection correcte. Pas de chanson.', deltas: { def: 1, charisme: 1 } },
          { text: 'Vous cédez un pas. La honte est plus lourde que le coup.', deltas: { moral: -5, renommee: -2, hp: -4 } },
        ),
      },
      {
        id: 'defier_code',
        label: 'Défier un code injuste',
        outcomes: trio(
          { text: 'Vous brisez une règle absurde. Certains applaudissent ; d’autres grincent.', deltas: { renommee: 3, charisme: 2, auto: 2 } },
          { text: 'Geste remarqué, sans révolution.', deltas: { charisme: 1 } },
          { text: 'Trop tôt. On vous isole.', deltas: { renommee: -3, moral: -3 } },
        ),
      },
    ],
  }),

  // ——— Hache ———
  q({
    id: 'hache_abattage',
    family: 'hache',
    title: 'Arbre-témoin',
    text: 'Un tronc marqué attend un coup net. Votre {arme} doit parler fort — une fois.',
    tags: ['combat'],
    options: [
      {
        id: 'abattre',
        label: 'Abattre d’un seul coup',
        outcomes: trio(
          { text: 'Fendu net. Les bûcherons hochent ; les guerriers aussi.', deltas: { auto: 4, renommee: 2 } },
          { text: 'Deux coups. Correct.', deltas: { auto: 2, hp: -2 } },
          { text: 'La hache se coince. Humiliation collante.', deltas: { hp: -5, moral: -3 } },
        ),
      },
      {
        id: 'mesurer',
        label: 'Mesurer le fil avant de frapper',
        outcomes: trio(
          { text: 'Angle parfait. Moins de force, plus de vérité.', deltas: { auto: 2, cap: 2 } },
          { text: 'Bonne mesure.', deltas: { auto: 1 } },
          { text: 'Trop réfléchir. Le bras refroidit.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'defi',
        label: 'Défier un rival à l’abattage',
        outcomes: trio(
          { text: 'Vous gagnez au bruit du bois. Pari encaissé.', deltas: { auto: 2, or: 5, renommee: 2 } },
          { text: 'Égalité. Sueurs partagées.', deltas: { auto: 1, hp: -2 } },
          { text: 'Il fend mieux. Votre orgueil aussi.', deltas: { moral: -3, or: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'hache_charge',
    family: 'hache',
    title: 'Porte barricadée',
    text: 'Une porte trop épaisse. On n’ouvre pas avec une clé — avec votre {arme}.',
    rarity: 'rare',
    tags: ['combat', 'donjons'],
    options: [
      {
        id: 'enfoncer',
        label: 'Enfoncer la porte',
        outcomes: trio(
          { text: 'Bois en éclats. Le passage est à vous — et le bruit annonce un champion.', deltas: { auto: 4, def: 1, renommee: 3, hp: -4 } },
          { text: 'La porte cède au troisième coup.', deltas: { auto: 2, hp: -5 } },
          { text: 'La porte tient. Vos épaules moins.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'coins',
        label: 'Fendre les gonds plutôt que le panneau',
        outcomes: trio(
          { text: 'Malin. La porte tombe sans théâtre inutile.', deltas: { auto: 3, spd: 2, or: 2 } },
          { text: 'Ça marche. Lentement.', deltas: { auto: 1, hp: -2 } },
          { text: 'Mauvais gond. Rebond douloureux.', deltas: { hp: -7, moral: -2 } },
        ),
      },
      {
        id: 'intimider',
        label: 'Menacer de fendre… et négocier',
        outcomes: trio(
          { text: 'Ils ouvrent. Votre {arme} n’a même pas dû mordre.', deltas: { charisme: 3, or: 4, renommee: 2 } },
          { text: 'Négociation tiède. Passage payé.', deltas: { or: -2, charisme: 1 } },
          { text: 'Bluff raté. Portes + poings.', deltas: { hp: -6, moral: -3 } },
        ),
      },
    ],
  }),
  q({
    id: 'hache_muron',
    family: 'hache',
    title: 'Mur qui défie',
    text: 'Finale : un mur runique. On ne « gagne » pas une hache — on prouve que la vôtre peut faire plier la pierre.',
    rarity: 'rare',
    tags: ['combat', 'donjons'],
    options: [
      {
        id: 'fracasser',
        label: 'Fracasser le point faible',
        outcomes: trio(
          { text: 'La faille s’ouvre. Pierre, poussière, respect. Votre {arme} a parlé.', deltas: { auto: 5, renommee: 4, hp: -5 } },
          { text: 'Brèche étroite. Vous passez de biais.', deltas: { auto: 2, hp: -5 } },
          { text: 'Le mur rend le coup. Vous aussi.', deltas: { hp: -11, moral: -4 } },
        ),
      },
      {
        id: 'rythme',
        label: 'Frapper en cadence jusqu’à la faille',
        outcomes: trio(
          { text: 'Cadence de siège. Le mur cède par épuisement.', deltas: { auto: 3, def: 2, renommee: 2, hp: -4 } },
          { text: 'Long, efficace.', deltas: { auto: 1, hp: -4 } },
          { text: 'Cadence cassée. Bras en feu, mur intact.', deltas: { hp: -8, moral: -3 } },
        ),
      },
      {
        id: 'renoncer',
        label: 'Chercher un détour plutôt que le mur',
        outcomes: trio(
          { text: 'Détour intelligent. Parfois la hache sert à… ne pas frapper.', deltas: { spd: 2, moral: 2, or: 3 } },
          { text: 'Détour long. Vous arrivez.', deltas: { hp: -2 } },
          { text: 'Cul-de-sac. Retour au mur, plus fatigué.', deltas: { moral: -3, hp: -3 } },
        ),
      },
    ],
  }),

  // ——— Bouclier ———
  q({
    id: 'bouclier_ligne',
    family: 'bouclier',
    title: 'Tenir la ligne',
    text: 'Une ligne vacille. On n’a pas besoin d’une égide légendaire — juste de votre {arme} au bon endroit.',
    tags: ['combat'],
    options: [
      {
        id: 'couvrir',
        label: 'Couvrir le flanc exposé',
        outcomes: trio(
          { text: 'Rien ne passe. La ligne se reforme derrière votre {arme}.', deltas: { def: 4, charisme: 1, renommee: 2 } },
          { text: 'Couverture correcte. Quelques coups encaissés.', deltas: { def: 2, hp: -3 } },
          { text: 'Trop tard. Brèche — et blâme.', deltas: { hp: -7, moral: -3 } },
        ),
      },
      {
        id: 'avancer',
        label: 'Avancer en mur mobile',
        outcomes: trio(
          { text: 'Vous gagnez trois pas. L’ennemi recule au rythme du bois.', deltas: { def: 3, auto: 1, renommee: 2, hp: -2 } },
          { text: 'Avancée lente. Utile.', deltas: { def: 1, hp: -2 } },
          { text: 'Isolé trop tôt. On vous harcèle.', deltas: { hp: -8, moral: -2 } },
        ),
      },
      {
        id: 'bastion',
        label: 'Crier l’ordre du Rempart',
        ifClass: ['Bastion', 'Paladin'],
        outcomes: trio(
          { text: 'La ligne obéit. Votre {arme} devient un étendard de bois.', deltas: { def: 5, charisme: 2, renommee: 3 } },
          { text: 'Ordre entendu. Exécution moyenne.', deltas: { def: 2 } },
          { text: 'Voix couverte par le chaos.', deltas: { moral: -3 } },
        ),
      },
    ],
  }),
  q({
    id: 'bouclier_siege',
    family: 'bouclier',
    title: 'Sous les projectiles',
    text: 'Siège. Flèches. Votre {arme} doit devenir un toit.',
    rarity: 'rare',
    tags: ['combat'],
    options: [
      {
        id: 'toit',
        label: 'Former un toit de bois',
        outcomes: trio(
          { text: 'Personne ne tombe sous votre arc. Les flèches s’énervent toutes seules.', deltas: { def: 5, renommee: 3, hp: -3 } },
          { text: 'Quelques éclats. Le groupe tient.', deltas: { def: 2, hp: -4 } },
          { text: 'Une flèche trouve le joint. Leçon sanglante.', deltas: { hp: -10, moral: -3 } },
        ),
      },
      {
        id: 'charger_archers',
        label: 'Charger les archers sous {arme}',
        outcomes: trio(
          { text: 'Vous rompez leur ligne. Le siège respire.', deltas: { def: 3, auto: 2, renommee: 3, hp: -5 } },
          { text: 'Charge utile, coût réel.', deltas: { def: 1, hp: -6 } },
          { text: 'Trop de traits. Recul forcé.', deltas: { hp: -11, moral: -4 } },
        ),
      },
      {
        id: 'tenir',
        label: 'Tenir sans avancer',
        outcomes: trio(
          { text: 'Mur. Pensée simple. Victoire de l’ennui héroïque.', deltas: { def: 4, moral: 2 } },
          { text: 'Vous tenez. C’est déjà beaucoup.', deltas: { def: 2, hp: -2 } },
          { text: 'La fatigue gagne avant les flèches.', deltas: { hp: -6, moral: -3 } },
        ),
      },
    ],
  }),
  q({
    id: 'bouclier_egide',
    family: 'bouclier',
    title: 'Épreuve de l’égide',
    text: 'Finale : encaisser un coup « digne d’une égide » — sans en recevoir une. Votre {arme} doit suffire.',
    rarity: 'rare',
    tags: ['combat'],
    options: [
      {
        id: 'encaisser',
        label: 'Encaisser le coup rituel',
        outcomes: trio(
          { text: 'Le choc passe. Vos os chantent ; votre {arme} aussi. Respect acquis.', deltas: { def: 6, renommee: 5, hp: -6 } },
          { text: 'Vous tenez… à genoux. Assez.', deltas: { def: 3, hp: -7 } },
          { text: 'Le coup traverse trop. On vous relève.', deltas: { hp: -12, moral: -5 } },
        ),
      },
      {
        id: 'renvoyer',
        label: 'Renvoyer l’angle du choc',
        outcomes: trio(
          { text: 'Parade savante. Le coup repart ailleurs. La salle applaudit.', deltas: { def: 4, spd: 2, renommee: 3, hp: -3 } },
          { text: 'Déviation partielle.', deltas: { def: 2, hp: -4 } },
          { text: 'Mauvais angle. Vous goûtez le plein.', deltas: { hp: -10, moral: -3 } },
        ),
      },
      {
        id: 'proteger',
        label: 'Protéger un autre plutôt que soi',
        outcomes: trio(
          { text: 'Ils se relèvent grâce à vous. Votre {arme} a un autre nom ce soir : promesse.', deltas: { def: 3, charisme: 4, renommee: 4, hp: -5 } },
          { text: 'Geste vu. Douleur réelle.', deltas: { charisme: 2, hp: -5 } },
          { text: 'Vous ratez le placement. Deux blessés.', deltas: { hp: -8, moral: -4, renommee: -1 } },
        ),
      },
    ],
  }),

  // ——— Bâton ———
  q({
    id: 'baton_sentier',
    family: 'baton',
    title: 'Sentier des blessés',
    text: 'Des voyageurs boitent. Votre {arme} n’est pas une branche d’Yggdrasil — mais elle peut encore soigner.',
    tags: ['magie', 'social'],
    options: [
      {
        id: 'soigner',
        label: 'Soigner avec {arme}',
        outcomes: trio(
          { text: 'Blessures qui ferment. On vous bénit sans connaître votre vrai nom.', deltas: { cap: 3, charisme: 2, moral: 2 } },
          { text: 'Soins corrects. Fatigue partagée.', deltas: { cap: 1, hp: -1 } },
          { text: 'Mauvais dosage. Vous aggravez avant de corriger.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'guide',
        label: 'Guider le groupe hors du marais',
        outcomes: trio(
          { text: 'Bâton en avant, sentier trouvé. Sauveur humble.', deltas: { spd: 2, charisme: 2, renommee: 2 } },
          { text: 'Détours, mais sortie.', deltas: { spd: 1 } },
          { text: 'Vous vous perdez avec eux. La nuit tombe plus vite.', deltas: { moral: -3, hp: -3 } },
        ),
      },
      {
        id: 'healer',
        label: 'Canaliser un vrai soin de classe',
        ifClass: ['Healer', 'Alchimiste'],
        outcomes: trio(
          { text: 'Lumière propre. Votre {arme} amplifie sans se vanter.', deltas: { cap: 5, charisme: 2, renommee: 2 } },
          { text: 'Soin utile.', deltas: { cap: 2 } },
          { text: 'Canal instable. Retour de fatigue.', deltas: { hp: -4, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'baton_bosquet',
    family: 'baton',
    title: 'Bosquet qui juge',
    text: 'Les arbres testent votre {arme} : boisé vrai ou simple bâton de voyageur ?',
    rarity: 'rare',
    tags: ['magie', 'donjons'],
    options: [
      {
        id: 'offrir',
        label: 'Offrir une goutte de sève à {arme}',
        outcomes: trio(
          { text: 'Le bois répond. Chaleur douce — pas une arme nouvelle, une alliance.', deltas: { cap: 4, def: 1, moral: 2 } },
          { text: 'Léger assentiment des feuilles.', deltas: { cap: 2 } },
          { text: 'Les racines se taisent. Rejet poli.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'defendre',
        label: 'Défendre le bosquet d’un braconnier',
        outcomes: trio(
          { text: 'Vous chassez l’intrus. Les arbres vous doivent une faveur.', deltas: { cap: 2, auto: 2, renommee: 3, or: 3 } },
          { text: 'Escarmouche. Bosquet sauvé, vous éraflé.', deltas: { hp: -3, renommee: 1 } },
          { text: 'Vous ratez l’intervention. Branches… déçues.', deltas: { moral: -3, hp: -3 } },
        ),
      },
      {
        id: 'sylvari',
        label: 'Parler sève à sève',
        ifRace: ['Sylvari'],
        outcomes: trio(
          { text: 'Le bosquet vous reconnaît. Votre {arme} frémit d’appartenance.', deltas: { cap: 3, def: 2, hp: 3, moral: 2 } },
          { text: 'Dialogue court. Assez.', deltas: { cap: 1, hp: 1 } },
          { text: 'Même la sève a ses silences.', deltas: { moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'baton_sève',
    family: 'baton',
    title: 'Sève partagée',
    text: 'Finale : un rituel de partage. Votre {arme} conduit la sève — guérir, ou brûler.',
    rarity: 'rare',
    tags: ['magie'],
    options: [
      {
        id: 'rituel',
        label: 'Conduire le rituel de soin',
        outcomes: trio(
          { text: 'La clairière respire. Vous aussi. Capacité ancrée sans trophée d’arme.', deltas: { cap: 5, moral: 3, renommee: 3, hp: 4 } },
          { text: 'Rituel correct. Fatigue verte.', deltas: { cap: 2, hp: 1 } },
          { text: 'Sève trop vive. Brûlure intérieure.', deltas: { hp: -7, moral: -3 } },
        ),
      },
      {
        id: 'garder',
        label: 'Garder une goutte pour plus tard',
        outcomes: trio(
          { text: 'Fiole tiède. Promesse de soin futur.', deltas: { cap: 2, or: 3, moral: 2 } },
          { text: 'Petite réserve.', deltas: { or: 1 } },
          { text: 'La goutte sèche. Promesse morte.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'offrir_groupe',
        label: 'Tout donner au groupe blessé',
        outcomes: trio(
          { text: 'Vous repartez vides… et aimés. Ça compte plus qu’une branche mythique.', deltas: { charisme: 4, renommee: 4, moral: 3, cap: 1 } },
          { text: 'Don apprécié.', deltas: { charisme: 2, moral: 1 } },
          { text: 'On oublie de dire merci. Ça pique.', deltas: { moral: -3 } },
        ),
      },
    ],
  }),

  // ——— Sceptre ———
  q({
    id: 'sceptre_audience',
    family: 'sceptre',
    title: 'Audience de couloir',
    text: 'Une petite cour d’ombres. Votre {arme} n’ouvre pas un trône — elle ouvre des portes de négociation.',
    tags: ['social'],
    options: [
      {
        id: 'parler',
        label: 'Parler comme si la salle était à vous',
        outcomes: trio(
          { text: 'Ils écoutent. Pouvoir soft — le meilleur genre.', deltas: { charisme: 4, renommee: 2 } },
          { text: 'Attention polie.', deltas: { charisme: 2 } },
          { text: 'On vous coupe. Silence gênant.', deltas: { moral: -3, charisme: -1 } },
        ),
      },
      {
        id: 'cadeau',
        label: 'Offrir un cadeau calculé',
        outcomes: trio(
          { text: 'Le cadeau ouvre une alliance. Votre {arme} n’a pas eu à menacer.', deltas: { charisme: 2, or: -4, renommee: 2, cap: 1 } },
          { text: 'Cadeau correct.', deltas: { or: -2, charisme: 1 } },
          { text: 'Mal choisi. Offense discrète.', deltas: { or: -3, moral: -2, renommee: -1 } },
        ),
      },
      {
        id: 'menacer',
        label: 'Laisser {arme} parler à votre place',
        outcomes: trio(
          { text: 'Peur utile. Accords signés trop vite.', deltas: { charisme: 2, renommee: 1, or: 4 } },
          { text: 'Intimidation tiède.', deltas: { or: 2 } },
          { text: 'On vous trouve vulgaire. Portes qui se ferment.', deltas: { renommee: -3, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'sceptre_pacte',
    family: 'sceptre',
    title: 'Pacte de couloir',
    text: 'Un prince sans couronne propose un pacte. Votre {arme} scelle — ou refuse.',
    rarity: 'rare',
    tags: ['social', 'magie'],
    options: [
      {
        id: 'sceller',
        label: 'Sceller le pacte sur {arme}',
        outcomes: trio(
          { text: 'Pacte tenu. Influence + dette utile.', deltas: { charisme: 3, cap: 2, renommee: 3, or: 4 } },
          { text: 'Pacte flou. Avantages flous.', deltas: { charisme: 1, or: 2 } },
          { text: 'Clause piégée. Vous payez trop tôt.', deltas: { or: -6, moral: -3 } },
        ),
      },
      {
        id: 'renegocier',
        label: 'Renégocier chaque clause',
        outcomes: trio(
          { text: 'Vous gagnez sur les marges. Roi-sorcier en herbe.', deltas: { charisme: 4, cap: 1, or: 3 } },
          { text: 'Quelques clauses sauvées.', deltas: { charisme: 2 } },
          { text: 'Ils s’impatientent. Pacte cassé.', deltas: { moral: -3, renommee: -1 } },
        ),
      },
      {
        id: 'refuser',
        label: 'Refuser avec élégance',
        outcomes: trio(
          { text: 'Refus admirable. On vous craint un peu plus.', deltas: { renommee: 2, moral: 2, charisme: 1 } },
          { text: 'Refus plat. Porte suivante.', deltas: {} },
          { text: 'On prend le refus pour une insulte.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'sceptre_trone',
    family: 'sceptre',
    title: 'Trône vide',
    text: 'Finale : un siège sans roi. S’y asseoir ne donne pas le Sceptre du Roi-Sorcier — seulement le poids du regard.',
    rarity: 'epic',
    tags: ['social'],
    options: [
      {
        id: 'asseoir',
        label: 'S’asseoir un souffle',
        outcomes: trio(
          { text: 'Le silence vous couronne. Vous vous levez plus grand — {arme} plus lourde de sens.', deltas: { charisme: 5, renommee: 5, cap: 2, moral: 1 } },
          { text: 'Sensation étrange. Leçon courte.', deltas: { charisme: 2, renommee: 1 } },
          { text: 'Le siège vous rejette. Rires secs.', deltas: { moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'couronner_autre',
        label: 'Y faire asseoir un autre',
        outcomes: trio(
          { text: 'Roi-faiseur. Influence nette, gloire partagée.', deltas: { charisme: 4, renommee: 4, or: 5 } },
          { text: 'Geste politique correct.', deltas: { charisme: 2, or: 2 } },
          { text: 'Votre pion vous trahit déjà.', deltas: { moral: -4, renommee: -2 } },
        ),
      },
      {
        id: 'detruire',
        label: 'Renverser le siège',
        outcomes: trio(
          { text: 'Fin du symbole. Certains vous aiment pour ça.', deltas: { renommee: 3, auto: 2, charisme: 2 } },
          { text: 'Bruit. Poussière. Peu de suite.', deltas: { renommee: 1 } },
          { text: 'Sacrilège mal lu. Portes qui se ferment.', deltas: { renommee: -4, moral: -3 } },
        ),
      },
    ],
  }),

  // ——— Fléau ———
  q({
    id: 'fleau_liens',
    family: 'fleau',
    title: 'Chaînes au sol',
    text: 'Des chaînes traînent. Votre {arme} veut les faire danser — discipline, pas sadisme… enfin, on verra.',
    tags: ['combat'],
    options: [
      {
        id: 'maitriser',
        label: 'Maîtriser le mouvement des chaînes',
        outcomes: trio(
          { text: 'Rythme trouvé. La masse obéit au poignet.', deltas: { auto: 3, spd: 1 } },
          { text: 'Progrès. Quelques hématomes pédagogiques.', deltas: { auto: 1, hp: -2 } },
          { text: 'La chaîne vous mord. Ironie lourde.', deltas: { hp: -6, moral: -2 } },
        ),
      },
      {
        id: 'desarmer',
        label: 'Désarmer un mannequin enchaîné',
        outcomes: trio(
          { text: 'Frappe circulaire parfaite. Le mannequin n’a plus de bras… de bois.', deltas: { auto: 3, renommee: 1 } },
          { text: 'Correct.', deltas: { auto: 1 } },
          { text: 'Vous vous emmêlez. Spectacle.', deltas: { moral: -3, hp: -3 } },
        ),
      },
      {
        id: 'intimider',
        label: 'Faire siffler {arme} pour disperser une foule',
        outcomes: trio(
          { text: 'La rue s’ouvre. Peur utile.', deltas: { charisme: 2, renommee: 2, or: 2 } },
          { text: 'Quelques pas de recul.', deltas: { charisme: 1 } },
          { text: 'On ne bouge pas. Humiliation bruyante.', deltas: { moral: -3, renommee: -1 } },
        ),
      },
    ],
  }),
  q({
    id: 'fleau_crepuscule',
    family: 'fleau',
    title: 'Crépuscule lié',
    text: 'Un duel au fléau sous lumière rouge. Votre {arme} doit nouer l’espace — pas devenir Anathème.',
    rarity: 'rare',
    tags: ['combat'],
    options: [
      {
        id: 'lier',
        label: 'Lier le bras adverse',
        outcomes: trio(
          { text: 'Chaîne parfaite. Il tombe avant de comprendre.', deltas: { auto: 4, spd: 2, renommee: 3, hp: -3 } },
          { text: 'Lien partiel. Fin sale mais gagnante.', deltas: { auto: 2, hp: -4 } },
          { text: 'Il coupe le lien. Contre brutal.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'tourbillon',
        label: 'Tourbillon de masse',
        outcomes: trio(
          { text: 'Cercle de fer. Personne n’approche.', deltas: { auto: 3, def: 2, renommee: 2, hp: -4 } },
          { text: 'Beau geste, essoufflement.', deltas: { auto: 1, hp: -4 } },
          { text: 'Vertige. Vous vous frappez presque vous-même.', deltas: { hp: -8, moral: -3 } },
        ),
      },
      {
        id: 'finir',
        label: 'Finir au sol, contrôle total',
        outcomes: trio(
          { text: 'Soumission nette. Le crépuscule applaudit mollement.', deltas: { auto: 3, charisme: 2, renommee: 3 } },
          { text: 'Contrôle correct.', deltas: { auto: 1 } },
          { text: 'Il se relève. Vous perdez le fil — et le duel.', deltas: { hp: -7, moral: -4 } },
        ),
      },
    ],
  }),
  q({
    id: 'fleau_anatheme',
    family: 'fleau',
    title: 'Nom d’anathème',
    text: 'Finale : on vous demande de « nommer » une faute avec {arme}. Pas d’arme nouvelle — une sentence.',
    rarity: 'rare',
    tags: ['combat', 'ombres'],
    options: [
      {
        id: 'juger',
        label: 'Rendre la sentence',
        outcomes: trio(
          { text: 'La faute est marquée. Les témoins se taisent. Votre {arme} a un poids de loi.', deltas: { auto: 4, renommee: 5, charisme: 2, moral: -1 } },
          { text: 'Sentence tiède. Effet partiel.', deltas: { auto: 2, renommee: 1 } },
          { text: 'Injustice perçue. La foule se retourne.', deltas: { renommee: -3, moral: -4 } },
        ),
      },
      {
        id: 'epargner',
        label: 'Épargner sous condition',
        outcomes: trio(
          { text: 'Pitié stratégique. Dette ouverte en votre faveur.', deltas: { charisme: 4, renommee: 2, moral: 3 } },
          { text: 'Épargne acceptée.', deltas: { charisme: 1, moral: 1 } },
          { text: 'On prend la pitié pour de la faiblesse.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
      {
        id: 'detruire_chaine',
        label: 'Briser vos propres chaînes de rage',
        outcomes: trio(
          { text: 'Maîtrise. Le fléau obéit — vous aussi.', deltas: { auto: 2, moral: 4, def: 2, renommee: 2 } },
          { text: 'Calme fragile.', deltas: { moral: 2 } },
          { text: 'La rage gagne un round.', deltas: { moral: -4, hp: -3 } },
        ),
      },
    ],
  }),

  // ——— Arbalète ———
  q({
    id: 'arbalete_embuscade',
    family: 'arbalete',
    title: 'Embuscade préparée',
    text: 'Un convoi. Une fenaison. Votre {arme} aime les angles — pas les trophées d’arbalète mythique.',
    tags: ['combat', 'ombres'],
    options: [
      {
        id: 'viser',
        label: 'Prendre l’angle parfait',
        outcomes: trio(
          { text: 'Premier trait décisif. Le convoi se fige ; votre équipe bouge.', deltas: { spd: 3, auto: 2, or: 4 } },
          { text: 'Bon angle, timing moyen.', deltas: { spd: 1, or: 2 } },
          { text: 'Trop tôt. Alerte générale.', deltas: { hp: -5, moral: -3 } },
        ),
      },
      {
        id: 'attendre',
        label: 'Attendre le signal',
        outcomes: trio(
          { text: 'Patience. Le trait part au bon souffle.', deltas: { spd: 2, moral: 2, auto: 1 } },
          { text: 'Attente utile.', deltas: { moral: 1 } },
          { text: 'Le signal ne vient pas. Occasion perdue.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'couvrir',
        label: 'Couvrir la retraite d’un allié',
        outcomes: trio(
          { text: 'Deux traits. Deux menaces clouées. On vous doit une bière.', deltas: { spd: 2, charisme: 2, renommee: 2 } },
          { text: 'Couverture correcte.', deltas: { spd: 1 } },
          { text: 'Vous ratez le flanc. Fuite plus sale.', deltas: { moral: -3, hp: -3 } },
        ),
      },
    ],
  }),
  q({
    id: 'arbalete_serment',
    family: 'arbalete',
    title: 'Serment de trait',
    text: 'On vous fait jurer : un seul trait, une seule promesse. Votre {arme} devient parole.',
    rarity: 'rare',
    tags: ['combat', 'social'],
    options: [
      {
        id: 'jurer',
        label: 'Jurer sur la noix de {arme}',
        outcomes: trio(
          { text: 'Serment tenu d’avance. Main plus ferme.', deltas: { spd: 3, renommee: 3, moral: 2 } },
          { text: 'Serment sobre.', deltas: { renommee: 1, moral: 1 } },
          { text: 'Les mots glissent. Doute au moment de viser.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'tir_serment',
        label: 'Tirer pour sceller le serment',
        outcomes: trio(
          { text: 'Trait parfait dans la cible rituelle. La salle acquiesce.', deltas: { spd: 4, auto: 2, renommee: 3 } },
          { text: 'Dans le cercle… presque au centre.', deltas: { spd: 2 } },
          { text: 'Hors cible. Serment moqué.', deltas: { moral: -4, renommee: -2 } },
        ),
      },
      {
        id: 'refuser',
        label: 'Refuser un serment trop lourd',
        outcomes: trio(
          { text: 'Honneur de dire non. Certains respectent.', deltas: { moral: 3, charisme: 1 } },
          { text: 'Refus plat.', deltas: {} },
          { text: 'On vous traite de lâche à distance.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'arbalete_verdict',
    family: 'arbalete',
    title: 'Verdict à distance',
    text: 'Finale : un jugement doit tomber d’une flèche. Pas l’Arbalète du Verdict — la vôtre, aujourd’hui.',
    rarity: 'rare',
    tags: ['combat'],
    options: [
      {
        id: 'verdict',
        label: 'Tirer le verdict',
        outcomes: trio(
          { text: 'Trait juste. Silence de cour. Votre {arme} a tranché sans s’approcher.', deltas: { spd: 5, renommee: 5, auto: 2, hp: -2 } },
          { text: 'Verdict accepté, tir imparfait.', deltas: { spd: 2, renommee: 2 } },
          { text: 'Trait douteux. Contestation, chaos.', deltas: { moral: -5, renommee: -3, hp: -3 } },
        ),
      },
      {
        id: 'manquer_exprès',
        label: 'Manquer exprès pour épargner',
        outcomes: trio(
          { text: 'Pitié visible. Dette politique ouverte.', deltas: { charisme: 4, moral: 3, renommee: 2 } },
          { text: 'Geste lu… à moitié.', deltas: { charisme: 1, moral: 1 } },
          { text: 'On crie à la trahison du serment.', deltas: { renommee: -3, moral: -3 } },
        ),
      },
      {
        id: 'double',
        label: 'Préparer un second trait « si besoin »',
        outcomes: trio(
          { text: 'Discipline de tireur. Le second n’est pas nécessaire — et tout le monde le voit.', deltas: { spd: 3, def: 1, renommee: 2, moral: 2 } },
          { text: 'Prudence correcte.', deltas: { spd: 1 } },
          { text: 'Hésitation. Le premier trait tremble.', deltas: { moral: -3, spd: -1 } },
        ),
      },
    ],
  }),

  // ——— Pendule ———
  q({
    id: 'pendule_tic',
    family: 'pendule',
    title: 'Tic contre tac',
    text: 'Un pendule étranger bat à côté du vôtre. Votre {arme} doit trouver le rythme — pas voler Chronos.',
    tags: ['ombres', 'magie'],
    options: [
      {
        id: 'synchroniser',
        label: 'Synchroniser les battements',
        outcomes: trio(
          { text: 'Un seul temps. Le couloir ralentit pour vous.', deltas: { spd: 2, cap: 2, moral: 1 } },
          { text: 'Presque en phase.', deltas: { spd: 1 } },
          { text: 'Dissonance. Nausée temporelle.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'accelerer',
        label: 'Forcer un tic plus vite',
        outcomes: trio(
          { text: 'Petite avance volée. Assez pour un geste décisif.', deltas: { spd: 3, renommee: 1 } },
          { text: 'Gain mince.', deltas: { spd: 1 } },
          { text: 'Le temps mord. Articulations lourdes.', deltas: { hp: -5, moral: -2 } },
        ),
      },
      {
        id: 'ecouter',
        label: 'Écouter sans toucher',
        outcomes: trio(
          { text: 'Vous entendez une faille dans le futur proche.', deltas: { cap: 3, moral: 2 } },
          { text: 'Murmure utile.', deltas: { cap: 1 } },
          { text: 'Trop écouter fige.', deltas: { moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'pendule_fige',
    family: 'pendule',
    title: 'Seconde figée',
    text: 'Une menace tombe. Votre {arme} peut figer… une seconde. Pas plus.',
    rarity: 'rare',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'figer',
        label: 'Figer la seconde fatale',
        outcomes: trio(
          { text: 'Le coup passe à côté. Vous respirez dans un trou du temps.', deltas: { spd: 3, def: 2, moral: 3, hp: 2 } },
          { text: 'Demi-seconde. Assez pour parer.', deltas: { def: 1, hp: -2 } },
          { text: 'Le temps refuse. Le coup arrive quand même.', deltas: { hp: -8, moral: -3 } },
        ),
      },
      {
        id: 'offrir_seconde',
        label: 'Offrir la seconde à un allié',
        outcomes: trio(
          { text: 'Ils survivent grâce à vous. Dette claire.', deltas: { charisme: 3, renommee: 3, moral: 2 } },
          { text: 'Geste vu.', deltas: { charisme: 1 } },
          { text: 'Mal cadencé. Les deux souffrent.', deltas: { hp: -5, moral: -3 } },
        ),
      },
      {
        id: 'voler',
        label: 'Voler deux secondes… risquer le retour',
        outcomes: trio(
          { text: 'Audace payante. Deux gestes pour le prix d’un.', deltas: { spd: 4, auto: 2, renommee: 2, hp: -3 } },
          { text: 'Une seconde et demie. Correct.', deltas: { spd: 2, hp: -2 } },
          { text: 'Le temps se venge. Vous vieillissez d’un mauvais rêve.', deltas: { hp: -7, moral: -5, def: -1 } },
        ),
      },
    ],
  }),
  q({
    id: 'pendule_dette',
    family: 'pendule',
    title: 'Dette de Chronos',
    text: 'Finale : rendre le temps emprunté. Votre {arme} compte — et Chronos aussi.',
    rarity: 'epic',
    tags: ['ombres', 'magie'],
    options: [
      {
        id: 'rendre',
        label: 'Rendre chaque tic dû',
        outcomes: trio(
          { text: 'Compte soldé. Le pendule bat plus juste — vous aussi.', deltas: { spd: 3, cap: 3, moral: 4, renommee: 3 } },
          { text: 'Dette allégée.', deltas: { moral: 2, spd: 1 } },
          { text: 'Il en manque. Chronos fronce.', deltas: { moral: -4, hp: -3 } },
        ),
      },
      {
        id: 'negocier',
        label: 'Négocier un report',
        outcomes: trio(
          { text: 'Report accordé. Intérêts… acceptables.', deltas: { charisme: 3, or: -3, spd: 2 } },
          { text: 'Report court.', deltas: { or: -1 } },
          { text: 'Refus net. Pénalité immédiate.', deltas: { hp: -6, moral: -3, or: -2 } },
        ),
      },
      {
        id: 'briser_cycle',
        label: 'Tenter de briser le cycle',
        outcomes: trio(
          { text: 'Fêlure dans la boucle. Rare. Dangereux. Magnifique.', deltas: { cap: 4, spd: 3, renommee: 4, moral: -2, hp: -4 } },
          { text: 'Micro-fêlure. Assez pour rêver.', deltas: { cap: 2, spd: 1 } },
          { text: 'Le cycle se referme sur vos doigts.', deltas: { hp: -9, moral: -5, spd: -1 } },
        ),
      },
    ],
  }),
];
