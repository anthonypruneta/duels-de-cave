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
    text: 'Une planque murmure un coup.\nVotre {arme} est trop fine pour la gloire et parfaite pour l’ombre et les serrures.',
    tags: ['ombres'],
    options: [
      {
        id: 'guetter',
        label: 'Guetter les rondes',
        outcomes: trio(
          { text: 'Vous chronométrez tout.\nLe braquage a une fenêtre nette et votre {arme} arbore un sourire.', deltas: { spd: 3, charisme: 1, or: 3 } },
          { text: 'Le plan reste presque parfait.\nUne ronde de trop apparaît, mais vous notez quand même le rythme.', deltas: { spd: 1 } },
          { text: 'On vous remarque trop tôt.\nLa fuite reste sèche sans butin, avec seulement le goût du risque raté.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'crocheter',
        label: 'Crocheter la porte d’essai',
        outcomes: trio(
          { text: 'La serrure fait clic et cède.\nVotre {arme} glisse comme une clé vivante.', deltas: { spd: 2, or: 5, renommee: 1 } },
          { text: 'La serrure force un peu, mais elle passe.\nVos doigts brûlent légèrement tandis que l’orgueil reste intact.', deltas: { or: 2, hp: -1 } },
          { text: 'Une alarme sourde se déclenche.\nVous disparaissez avant les gardes et laissez le coffre derrière vous.', deltas: { hp: -4, moral: -2 } },
        ),
      },
      {
        id: 'recruter',
        label: 'Recruter un regard complice',
        outcomes: trio(
          { text: 'Un clin d’œil scelle un pacte.\nLe coup a deux ombres maintenant.', deltas: { charisme: 3, or: 2 } },
          { text: 'L’accord reste tiède.\nIls viendront peut-être, sans promesse claire.', deltas: { charisme: 1 } },
          { text: 'On tente de vous vendre à la table.\nVous partez avant que le marché se retourne.', deltas: { moral: -3, renommee: -1 } },
        ),
      },
    ],
  }),
  q({
    id: 'dague_fuite',
    family: 'dague',
    title: 'Fuite dans les ruelles',
    text: 'Le coffre s’ouvre trop vite.\nDes pas résonnent derrière vous.\nVotre {arme} connaît déjà le chemin des toits.',
    rarity: 'rare',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'toits',
        label: 'Prendre les toits',
        outcomes: trio(
          { text: 'Tuiles, vent et silence s’enchaînent.\nVous disparaissez avec le butin, {arme} encore chaude.', deltas: { spd: 4, or: 8, hp: -3 } },
          { text: 'Une tuile cède sous le pied.\nVous glissez, sauvez le sac et perdez un peu de peau.', deltas: { spd: 2, or: 3, hp: -5 } },
          { text: 'La chute reste courte mais nette.\nLes poursuivants gagnent du terrain, et le butin bascule vers eux.', deltas: { hp: -8, or: -2, moral: -3 } },
        ),
      },
      {
        id: 'couper',
        label: 'Couper la bourse et semer',
        outcomes: trio(
          { text: 'Deux coups tombent d’affilée.\nDeux bourses changent de main.\nLa ruelle vous avale ensuite.', deltas: { auto: 2, spd: 2, or: 6 } },
          { text: 'Un seul coup net suffit cette fois.\nIl reste assez pour fuir, sans briller.', deltas: { or: 3, hp: -2 } },
          { text: 'La lame se montre trop courte ce soir.\nOn vous rattrape dans un coup, un juron et une fuite honteuse.', deltas: { hp: -9, moral: -4 } },
        ),
      },
      {
        id: 'cachette',
        label: 'Se fondre dans un tas d’ombre',
        outcomes: trio(
          { text: 'Ils passent sans vous voir.\nVous comptez l’or en silence, {arme} contre la poitrine.', deltas: { spd: 2, or: 5, moral: 2 } },
          { text: 'L’attente s’étire longtemps.\nIls s’éloignent enfin et le cœur se calme.', deltas: { or: 2 } },
          { text: 'Un chien vous trahit d’un aboiement.\nLa course reprend plus sale et plus courte.', deltas: { hp: -6, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'dague_coupe',
    family: 'dague',
    title: 'La coupe finale',
    text: 'Le dernier garde barre le passage.\nLa dernière serrure attend encore.\nVotre {arme} décide si le braquage devient légende ou simple anecdote.',
    rarity: 'rare',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'silent',
        label: 'Frapper sans un bruit',
        outcomes: trio(
          { text: 'Un geste net suffit.\nLe garde s’affaisse sans bruit.\nLe coffre-fort est à vous et la Cave le sait.', deltas: { spd: 5, or: 12, renommee: 4, hp: -2 } },
          { text: 'Le coup reste presque silencieux.\nIl suffit pour ouvrir, sans partir propres.', deltas: { spd: 2, or: 5, hp: -4 } },
          { text: 'Il crie assez fort pour réveiller le quartier.\nTout le monde répond et vous fuyez les mains vides.', deltas: { hp: -10, moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'bluff',
        label: 'Bluffer en sortant {arme}',
        outcomes: trio(
          { text: 'Le fer parle à leur place.\nIls reculent devant la lame.\nVous repartez riches et insolents.', deltas: { charisme: 4, or: 10, renommee: 3 } },
          { text: 'Le bluff reste tiède.\nIls hésitent assez longtemps pour que vous glissiez avec le minimum.', deltas: { charisme: 1, or: 4 } },
          { text: 'Ils rient d’abord devant la menace.\nPuis ils frappent sans pitié.\nVotre {arme} n’a pas suffi à faire peur.', deltas: { hp: -8, moral: -4, charisme: -2 } },
        ),
      },
      {
        id: 'partager',
        label: 'Partager le butin et disparaître',
        outcomes: trio(
          { text: 'Les pactes tiennent jusqu’au bout.\nVous repartez avec moins d’or et plus d’alliés dans l’ombre.', deltas: { or: 6, charisme: 3, moral: 3, renommee: 2 } },
          { text: 'Le partage reste correct.\nPersonne ne trahit ce soir.', deltas: { or: 3, charisme: 1 } },
          { text: 'On vous coupe la part sans cérémonie.\nL’ombre a ses règles et vous les apprenez trop tard.', deltas: { or: -4, moral: -4 } },
        ),
      },
    ],
  }),

  // ——— Arc ———
  q({
    id: 'arc_rumeur',
    family: 'arc',
    title: 'Rumeur de la tour',
    text: 'On dit qu’au sommet d’une tour oubliée, le vent tire encore des flèches.\nVotre {arme} vibre à l’idée.',
    tags: ['donjons'],
    options: [
      {
        id: 'ecouter',
        label: 'Écouter les chasseurs',
        outcomes: trio(
          { text: 'Une carte orale se dessine à voix basse.\nDirection, vents et dangers s’alignent, et votre {arme} a déjà une cible.', deltas: { spd: 2, charisme: 1, or: 2 } },
          { text: 'Les rumeurs se contredisent sans pitié.\nVous gardez le meilleur fragment.', deltas: { spd: 1 } },
          { text: 'On se moque de votre {arme} à la table.\nL’orgueil pique et les infos restent nulles.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'viser',
        label: 'Tirer une flèche-test au loin',
        outcomes: trio(
          { text: 'La flèche chante juste dans l’air.\nLe chemin se révèle dans le sifflement.', deltas: { spd: 3, auto: 1 } },
          { text: 'Le tir reste correct.\nIl suffit pour calibrer le vent.', deltas: { spd: 1 } },
          { text: 'La flèche se perd dans le lointain.\nVous vous perdez aussi, un instant.', deltas: { moral: -2, or: -1 } },
        ),
      },
      {
        id: 'partir',
        label: 'Partir sans attendre l’aube',
        outcomes: trio(
          { text: 'La marche nocturne commence sans torche.\nVos yeux s’habituent et la tour se dessine.', deltas: { spd: 2, moral: 1, hp: -2 } },
          { text: 'La route s’étire longtemps.\nRien de glorieux n’arrive, et rien n’est perdu.', deltas: { hp: -1 } },
          { text: 'Le sentier se montre mauvais dès le départ.\nRonces et fatigue s’accumulent tandis que la tour reste loin.', deltas: { hp: -5, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'arc_tour',
    family: 'arc',
    title: 'Escalade sous le vent',
    text: 'La tour penche sous le ciel.\nChaque palier demande un tir d’ancrage.\nVotre {arme} devient grappin, serment et souffle.',
    rarity: 'rare',
    tags: ['donjons'],
    options: [
      {
        id: 'ancrer',
        label: 'Ancrer chaque palier d’une flèche',
        outcomes: trio(
          { text: 'La progression reste parfaite.\nCorde, pierre et rythme s’accordent tandis que le sommet approche.', deltas: { spd: 4, def: 1, hp: -3 } },
          { text: 'Quelques flèches se perdent dans le vide.\nVous grimpez quand même.', deltas: { spd: 2, hp: -4 } },
          { text: 'L’ancrage lâche sans prévenir.\nLa chute reste courte et l’orgueil met longtemps à remonter.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'archer',
        label: 'Compter sur l’œil d’archer',
        ifClass: ['Archer', 'Voleur'],
        outcomes: trio(
          { text: 'Chaque prise devient une cible.\nVous dansez sur la pierre.', deltas: { spd: 5, renommee: 2 } },
          { text: 'L’œil reste bon, mais le bras fatigue.\nÇa suffit pour tenir.', deltas: { spd: 2, hp: -2 } },
          { text: 'Le vent ment sur la distance.\nVous ratez une prise et apprenez la leçon dans la dureté.', deltas: { hp: -7, moral: -2 } },
        ),
      },
      {
        id: 'abris',
        label: 'Attendre une accalmie',
        outcomes: trio(
          { text: 'Le vent tombe enfin.\nL’escalade reste propre et le souffle s’allonge.', deltas: { moral: 3, spd: 1 } },
          { text: 'L’attente se révèle utile.\nRien de plus ne s’ajoute.', deltas: { moral: 1 } },
          { text: 'L’accalmie ne vient pas.\nLa nuit se perd et la tour devient plus froide.', deltas: { moral: -3, hp: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'arc_ciel',
    family: 'arc',
    title: 'Ciel tendu',
    text: 'Au sommet, aucune arme n’attend pour être prise.\nUne épreuve seule se dresse.\nIl faut tirer juste, une fois, sous un ciel trop bas.',
    rarity: 'rare',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'tir',
        label: 'Tirer au cœur du vent',
        outcomes: trio(
          { text: 'La flèche disparaît dans le bleu.\nVotre {arme} vibre d’accord et le ciel a répondu.', deltas: { spd: 5, auto: 3, renommee: 5, hp: -2 } },
          { text: 'Le tir reste honorable.\nAucun mythe ne naît, mais la main sait.', deltas: { spd: 2, auto: 1, hp: -3 } },
          { text: 'Le vent gagne la partie.\nLa flèche se perd et l’orgueil aussi.', deltas: { hp: -6, moral: -5 } },
        ),
      },
      {
        id: 'salut',
        label: 'Saluer la tour et redescendre',
        outcomes: trio(
          { text: 'Le respect marque le geste.\nUne plume s’accroche à votre carquois, assez pour se souvenir.', deltas: { moral: 4, cap: 2, renommee: 2 } },
          { text: 'La descente reste propre.\nLa leçon se range dans la poche.', deltas: { moral: 2 } },
          { text: 'La descente porte la honte.\nOn murmure que vous avez eu peur du ciel.', deltas: { moral: -3, renommee: -1 } },
        ),
      },
      {
        id: 'defi',
        label: 'Défier un tireur rival au sommet',
        outcomes: trio(
          { text: 'Deux flèches partent ensemble.\nLa vôtre gagne l’échange.\nLe rival incline la tête.', deltas: { spd: 3, renommee: 4, or: 4 } },
          { text: 'Le match tombe à égalité.\nLe respect reste mutuel tandis que les mains tremblent.', deltas: { spd: 1, charisme: 1 } },
          { text: 'Sa flèche est plus vraie que la vôtre.\nVous redescendez plus sages et vexés.', deltas: { moral: -4, hp: -3 } },
        ),
      },
    ],
  }),

  // ——— Lance ———
  q({
    id: 'lance_runes',
    family: 'lance',
    title: 'Runes de la haste',
    text: 'Des runes anciennes parlent de ligne droite.\nVotre {arme} semble déjà connaître le chemin.',
    tags: ['forge'],
    options: [
      {
        id: 'lire',
        label: 'Lire les runes à voix basse',
        outcomes: trio(
          { text: 'Le sens s’ouvre sous la voix.\nLa prochaine frappe sera plus longue et plus juste.', deltas: { cap: 3, auto: 2 } },
          { text: 'Quelques glyphes restent utiles.\nLe reste du mur reste muet.', deltas: { cap: 1 } },
          { text: 'Les runes tournent devant les yeux.\nLe vertige multiplie les lignes et retire le sol.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'tracer',
        label: 'Retracer une rune sur {arme}',
        outcomes: trio(
          { text: 'Le trait tient sur le métal.\nVotre {arme} chauffe d’approbation.', deltas: { auto: 3, renommee: 1 } },
          { text: 'Le trait reste imparfait.\nIl tiendra le temps d’un duel.', deltas: { auto: 1 } },
          { text: 'La rune refuse le dessin.\nLa main brûle et l’orgueil aussi.', deltas: { hp: -4, moral: -2 } },
        ),
      },
      {
        id: 'garder',
        label: 'Garder le secret pour plus tard',
        outcomes: trio(
          { text: 'La sagesse gagne ce tour.\nVous repartez avec une carte mentale intacte.', deltas: { moral: 2, cap: 1 } },
          { text: 'Rien n’est perdu dans l’attente.\nRien n’est gagné non plus.', deltas: {} },
          { text: 'Le secret vous démange sans relâche.\nLa concentration tombe en berne.', deltas: { moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'lance_jet',
    family: 'lance',
    title: 'Jet rituel',
    text: 'Un cercle de pierre attend le rite.\nOn jette la haste, on la récupère, ou l’on rate.\nDans chaque cas, la ligne vous juge.',
    rarity: 'rare',
    tags: ['combat', 'forge'],
    options: [
      {
        id: 'jeter',
        label: 'Jeter {arme} au cœur du cercle',
        outcomes: trio(
          { text: 'Elle revient dans la main.\nSifflement, chaleur et certitude s’accordent, et la ligne vous accepte.', deltas: { auto: 4, spd: 2, renommee: 3 } },
          { text: 'Le jet reste presque juste.\nElle vibre, puis se tait, assez pour apprendre.', deltas: { auto: 2, hp: -2 } },
          { text: 'Elle vous fuit d’un écart.\nLes doigts brûlent sous le regard trop clair des témoins.', deltas: { hp: -6, moral: -4 } },
        ),
      },
      {
        id: 'viser_loin',
        label: 'Viser plus loin que le cercle',
        outcomes: trio(
          { text: 'La portée devient folle.\nLes anciens hochent la tête, rare pour une {arme}.', deltas: { auto: 3, spd: 3, renommee: 2 } },
          { text: 'Le geste reste beau.\nLa distance reste moyenne.', deltas: { spd: 1, auto: 1 } },
          { text: 'Vous visez trop loin.\nLa lance se plante ailleurs et l’humiliation reste propre.', deltas: { moral: -4, renommee: -1 } },
        ),
      },
      {
        id: 'observer',
        label: 'Observer un autre lanceur d’abord',
        outcomes: trio(
          { text: 'Vous volez le rythme du lanceur.\nVotre jet suivant sera meilleur.', deltas: { cap: 2, auto: 1, moral: 1 } },
          { text: 'Quelques détails restent retenus.\nLe reste s’efface déjà.', deltas: { cap: 1 } },
          { text: 'Trop regarder tue le bras.\nUne paralysie sèche s’installe.', deltas: { moral: -3 } },
        ),
      },
    ],
  }),
  q({
    id: 'lance_etendard',
    family: 'lance',
    title: 'Étendard planté',
    text: 'La dernière épreuve demande de planter {arme} comme un étendard.\nIl faut tenir la ligne sans la laisser tomber.',
    rarity: 'rare',
    tags: ['combat'],
    options: [
      {
        id: 'planter',
        label: 'Planter et tenir',
        outcomes: trio(
          { text: 'L’étendard tient dans la terre.\nAutour de vous, les regards se redressent.', deltas: { auto: 3, charisme: 3, renommee: 5, def: 2 } },
          { text: 'Ça tient juste assez.\nLa leçon passe quand même.', deltas: { auto: 1, charisme: 1, hp: -3 } },
          { text: 'Elle tombe dans la poussière.\nAvec elle, un peu de votre stature s’effondre.', deltas: { moral: -5, renommee: -2, hp: -3 } },
        ),
      },
      {
        id: 'charge',
        label: 'Charger derrière la pointe',
        outcomes: trio(
          { text: 'La ligne reste droite et le choc reste net.\nLa formation suit votre {arme}.', deltas: { auto: 5, spd: 2, renommee: 3, hp: -4 } },
          { text: 'La charge reste correcte.\nAucune rupture n’arrive, et aucun triomphe non plus.', deltas: { auto: 2, hp: -4 } },
          { text: 'La ligne se brise derrière vous.\nVous seul avancez trop loin.', deltas: { hp: -10, moral: -4 } },
        ),
      },
      {
        id: 'guerrier',
        label: 'Haranguer comme un porte-étendard',
        ifClass: ['Guerrier', 'Paladin', 'Bastion'],
        outcomes: trio(
          { text: 'Votre voix porte sur la ligne.\nLa lance n’est plus seule, toute une file avance avec elle.', deltas: { charisme: 4, renommee: 4, auto: 2 } },
          { text: 'La harangue reste correcte.\nQuelques dos se redressent.', deltas: { charisme: 2 } },
          { text: 'La voix casse au milieu du cri.\nUn silence gênant s’installe.', deltas: { moral: -3, charisme: -1 } },
        ),
      },
    ],
  }),

  // ——— Marteau ———
  q({
    id: 'marteau_enclume',
    family: 'marteau',
    title: 'Murmure d’enclume',
    text: 'Une enclume abandonnée résonne quand votre {arme} s’approche.\nElle ne forge aucune arme nouvelle et juge seulement le bras.',
    tags: ['forge'],
    options: [
      {
        id: 'frappe',
        label: 'Frapper l’enclume trois fois',
        outcomes: trio(
          { text: 'Trois notes tombent justes.\nLe métal vous reconnaît comme ouvrier, pas comme voleur.', deltas: { auto: 3, def: 1, renommee: 1 } },
          { text: 'Deux frappes sonnent bien et une reste sourde.\nIl reste assez pour continuer.', deltas: { auto: 1 } },
          { text: 'L’enclume se tait entièrement.\nVos poignets vibrent de trop.', deltas: { hp: -4, moral: -2 } },
        ),
      },
      {
        id: 'ecouter',
        label: 'Écouter la résonance',
        outcomes: trio(
          { text: 'Vous entendez le défaut dans votre geste.\nVous le corrigez sur le coup.', deltas: { cap: 2, auto: 1, moral: 1 } },
          { text: 'Un souffle d’insight traverse la tête.\nIl reste court.', deltas: { cap: 1 } },
          { text: 'Trop de silence pèse sur l’atelier.\nLe doute s’installe.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'nain',
        label: 'Invoquer la cadence naine',
        ifRace: ['Nain', 'Dragonkin'],
        outcomes: trio(
          { text: 'La cadence tombe juste.\nL’enclume répond comme à la maison.', deltas: { auto: 4, def: 2 } },
          { text: 'Le geste reste presque ancestral.\nLes tendons protestent quand même.', deltas: { auto: 2, hp: -2 } },
          { text: 'Même le sang de forge rate parfois.\nLa leçon tombe sans pitié.', deltas: { hp: -5, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'marteau_soulever',
    family: 'marteau',
    title: 'Poids digne',
    text: 'On vous propose de soulever une masse sacrée.\nVous ne la gardez pas : vous prouvez seulement que votre {arme} n’est pas du vent.',
    rarity: 'rare',
    tags: ['forge', 'combat'],
    options: [
      {
        id: 'soulever',
        label: 'Soulever d’un seul élan',
        outcomes: trio(
          { text: 'La masse monte d’un élan.\nUn tonnerre discret répond et les forgerons hochent.', deltas: { auto: 5, def: 2, renommee: 4, hp: -4 } },
          { text: 'Elle bouge d’un pouce.\nIl reste assez pour croire.', deltas: { auto: 2, hp: -5 } },
          { text: 'La masse reste immobile.\nL’humiliation pèse aussi lourd que l’acier.', deltas: { moral: -6, renommee: -2, hp: -3 } },
        ),
      },
      {
        id: 'technique',
        label: 'Utiliser levier et souffle',
        outcomes: trio(
          { text: 'La technique bat la force brute.\nLa masse cède avec élégance.', deltas: { auto: 3, cap: 2, renommee: 2 } },
          { text: 'Le levier passe sans fanfare.\nLe geste reste peu glorieux et efficace.', deltas: { auto: 1, hp: -2 } },
          { text: 'Le levier casse sous la charge.\nVous cassez presque avec lui.', deltas: { hp: -8, moral: -3 } },
        ),
      },
      {
        id: 'defier',
        label: 'Défier un rival au même poids',
        outcomes: trio(
          { text: 'Vous gagnez au dernier souffle.\nLa forge applaudit du regard.', deltas: { auto: 3, renommee: 3, or: 3 } },
          { text: 'L’égalité tranche le défi.\nLe respect et les bleus se partagent.', deltas: { auto: 1, hp: -3 } },
          { text: 'Il soulève la masse.\nVous restez collé au sol.\nLa leçon pèse.', deltas: { moral: -4, hp: -4 } },
        ),
      },
    ],
  }),
  q({
    id: 'marteau_foudre',
    family: 'marteau',
    title: 'Écho de foudre',
    text: 'La dernière frappe vise la cloche de bronze.\nSi votre {arme} chante juste, le tonnerre répond sans rien donner d’autre que le respect.',
    rarity: 'epic',
    tags: ['forge'],
    options: [
      {
        id: 'frappe_cloche',
        label: 'Frapper la cloche de plein fouet',
        outcomes: trio(
          { text: 'La cloche hurle sous le coup.\nUn éclair lointain répond.\nVotre {arme} n’a jamais sonné si vrai.', deltas: { auto: 6, def: 3, renommee: 6, hp: -5 } },
          { text: 'Le son reste beau sans foudre.\nIl suffit pour les anciens.', deltas: { auto: 3, renommee: 2, hp: -4 } },
          { text: 'Le son reste creux.\nLes rires sonnent plus fort que le bronze.', deltas: { moral: -6, renommee: -2, hp: -4 } },
        ),
      },
      {
        id: 'prier',
        label: 'Demander un signe à la Forge',
        outcomes: trio(
          { text: 'Une rune de chaleur vous marque le poignet.\nCe n’est pas une arme, c’est une permission.', deltas: { auto: 3, cap: 2, renommee: 3, moral: 2 } },
          { text: 'Le silence reste poli.\nVous repartez un peu plus calmes.', deltas: { moral: 2 } },
          { text: 'Aucun signe ne vient.\nSeul le froid de l’enclume répond.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'partager',
        label: 'Laisser un apprenti frapper après vous',
        outcomes: trio(
          { text: 'La transmission compte plus que la gloire.\nLa forge aime ce geste.', deltas: { charisme: 3, renommee: 3, moral: 3 } },
          { text: 'Le geste reste correct.\nL’apprenti sourit trop fort.', deltas: { charisme: 1, moral: 1 } },
          { text: 'Il rate la frappe.\nOn vous regarde comme un mauvais maître.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  }),

  // ——— Tome ———
  q({
    id: 'tome_seuil',
    family: 'tome',
    title: 'Seuil du savoir',
    text: 'Une bibliothèque condamnée attend derrière le seuil.\nVotre {arme} pulse, non pour voler un grimoire, mais pour prouver que vous savez lire sans vous perdre.',
    tags: ['magie'],
    options: [
      {
        id: 'ouvrir',
        label: 'Ouvrir le premier livre scellé',
        outcomes: trio(
          { text: 'Une formule stable se fixe.\nVotre esprit tient et le livre aussi.', deltas: { cap: 4, renommee: 1 } },
          { text: 'Les pages restent utiles.\nUne migraine légère suit la lecture.', deltas: { cap: 2, hp: -2 } },
          { text: 'Le sceau mord la peau.\nLe sang de nez tombe et la leçon reste claire.', deltas: { hp: -5, moral: -3, cap: 1 } },
        ),
      },
      {
        id: 'cataloguer',
        label: 'Cataloguer sans lire trop loin',
        outcomes: trio(
          { text: 'Une carte mentale des rayons se forme.\nPlus tard, vous saurez où frapper.', deltas: { cap: 2, moral: 2, or: 2 } },
          { text: 'Quelques titres restent retenus.\nLe reste se noie dans la poussière.', deltas: { cap: 1 } },
          { text: 'Trop de titres s’empilent.\nLa paralysie du savant s’installe.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'mindflayer',
        label: 'Goûter une page par l’esprit',
        ifRace: ['Mindflayer'],
        outcomes: trio(
          { text: 'Le savoir s’absorbe proprement.\nLe résultat reste terrifiant et utile.', deltas: { cap: 5, renommee: 2 } },
          { text: 'Un fragment se digère sans mal.\nLa soif d’en savoir encore grandit.', deltas: { cap: 2 } },
          { text: 'Le retour de bâton frappe net.\nLe livre a mordu plus fort.', deltas: { moral: -5, hp: -3 } },
        ),
      },
    ],
  }),
  q({
    id: 'tome_copie',
    family: 'tome',
    title: 'Copie sous pression',
    text: 'On vous demande une rune.\nUne seule ligne suffit.\nVotre {arme} sert d’encrier, pas de trophée.',
    rarity: 'rare',
    tags: ['magie'],
    options: [
      {
        id: 'copier',
        label: 'Copier la rune sans lire le reste',
        outcomes: trio(
          { text: 'Le trait tombe net.\nLe pouvoir reste contenu.\nAucune voix parasite ne s’élève.', deltas: { cap: 5, spd: 1 } },
          { text: 'La copie reste imparfaite.\nElle tiendra si vous ne forcez pas.', deltas: { cap: 2 } },
          { text: 'L’encre brûle la peau.\nLa main se marque et la leçon coûte cher.', deltas: { hp: -7, moral: -3 } },
        ),
      },
      {
        id: 'tricher',
        label: 'Improviser une rune « assez proche »',
        outcomes: trio(
          { text: 'Le bluff arcanique réussit.\nLes examinateurs hochent trop vite.', deltas: { cap: 3, charisme: 2, renommee: 2 } },
          { text: 'La copie passe quand même.\nElle passe de justesse.', deltas: { cap: 1, charisme: 1 } },
          { text: 'On voit l’imposture tout de suite.\nL’humiliation reste érudite.', deltas: { moral: -4, renommee: -2 } },
        ),
      },
      {
        id: 'sorciere',
        label: 'Sceller la copie d’une malédiction douce',
        ifClass: ['Sorcière', 'Demoniste', 'Mage'],
        outcomes: trio(
          { text: 'Le sceau tient sous l’ombre.\nLa rune obéit à votre volonté.', deltas: { cap: 4, charisme: 2, renommee: 2 } },
          { text: 'Le sceau reste fragile.\nIl reste utile une saison.', deltas: { cap: 2 } },
          { text: 'Le retour de sort frappe.\nL’amertume reste juste.', deltas: { moral: -4, hp: -4 } },
        ),
      },
    ],
  }),
  q({
    id: 'tome_esprit',
    family: 'tome',
    title: 'Esprit sous les pages',
    text: 'La finale confronte une idée vivante née d’un livre.\nVotre {arme} ne se transforme pas, mais vous changez.',
    rarity: 'epic',
    tags: ['magie', 'combat'],
    options: [
      {
        id: 'affronter',
        label: 'Affronter l’idée de face',
        outcomes: trio(
          { text: 'Vous pliez le concept.\nLa capacité devient plus nette et le regard plus dur.', deltas: { cap: 7, renommee: 4, moral: -1, hp: -5 } },
          { text: 'Le match mental s’équilibre.\nVous repartez avec une migraine et une formule.', deltas: { cap: 3, hp: -4 } },
          { text: 'L’idée vous lit jusqu’au bout.\nVous fermez le livre trop tard.', deltas: { cap: 1, moral: -7, hp: -6 } },
        ),
      },
      {
        id: 'negocier',
        label: 'Négocier un chapitre d’existence',
        outcomes: trio(
          { text: 'Un pacte d’encre se noue.\nLe savoir s’échange contre le silence, et le deal tient.', deltas: { cap: 4, charisme: 3, renommee: 2 } },
          { text: 'L’accord reste tiède.\nUne page passe, pas plus.', deltas: { cap: 2 } },
          { text: 'L’idée refuse le marché.\nElle garde ses mots et vous gardez vos peurs.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'fermer',
        label: 'Refermer et partir vivant',
        outcomes: trio(
          { text: 'La sagesse rare gagne le tour.\nUne bénédiction discrète vous suit.', deltas: { moral: 4, def: 2, cap: 2 } },
          { text: 'La fuite reste propre.\nLe livre reste affamé derrière vous.', deltas: { moral: 1 } },
          { text: 'On murmure une lâcheté savante.\nLe bruit vous suit jusqu’à la sortie.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  }),

  // ——— Faux ———
  q({
    id: 'faux_couloir',
    family: 'faux',
    title: 'Couloir qui murmure',
    text: 'Le Labyrinthe reconnaît votre {arme}.\nIl ne vous en donne pas une autre et demande qui vous comptez faucher.',
    tags: ['ombres'],
    options: [
      {
        id: 'ecouter',
        label: 'Écouter les murmures',
        outcomes: trio(
          { text: 'Des noms glissent dans le murmure.\nLe vôtre n’y figure pas.\nVous avancez plus sûrs.', deltas: { cap: 2, spd: 1, moral: 1 } },
          { text: 'Les murmures restent flous.\nUn frisson utile traverse le dos.', deltas: { cap: 1 } },
          { text: 'Trop de voix parlent à la fois.\nLa vôtre se perd un instant.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'faucher',
        label: 'Faucher une illusion de garde',
        outcomes: trio(
          { text: 'La lame reste vraie contre un fantôme faux.\nLe couloir s’ouvre.', deltas: { auto: 3, cap: 1, renommee: 1 } },
          { text: 'La coupe reste correcte.\nLe brouillard se dissipe à demi.', deltas: { auto: 1, hp: -2 } },
          { text: 'Vous frappez du vide.\nLe vide rend le coup.', deltas: { hp: -6, moral: -2 } },
        ),
      },
      {
        id: 'mortvivant',
        label: 'Saluer la mort comme une égale',
        ifRace: ['Mort-vivant'],
        outcomes: trio(
          { text: 'Un accord d’ombres se noue.\nVotre {arme} devient plus polie et plus cruelle.', deltas: { def: 3, cap: 2, renommee: 2 } },
          { text: 'Une tolérance mutuelle s’installe.\nPersonne n’exige davantage.', deltas: { def: 1 } },
          { text: 'Même les morts peuvent être snobés.\nLa leçon tombe froide.', deltas: { moral: -4 } },
        ),
      },
    ],
  }),
  q({
    id: 'faux_marche',
    family: 'faux',
    title: 'Marché d’ombres',
    text: 'Une entité propose un prix.\nUne peur s’échange contre une précision.\nVotre {arme} attend votre réponse.',
    rarity: 'rare',
    tags: ['ombres'],
    options: [
      {
        id: 'payer',
        label: 'Céder une peur mineure',
        outcomes: trio(
          { text: 'Le deal se conclut.\nVotre prochaine coupe sera plus nette, et le prix semble déjà oublié.', deltas: { auto: 3, spd: 2, moral: -1 } },
          { text: 'La peur part pour un gain tiède.\nL’échange laisse un goût fade.', deltas: { auto: 1, moral: -1 } },
          { text: 'Elle prend trop dans le marché.\nUn vide s’ouvre dans la poitrine.', deltas: { moral: -6, hp: -3 } },
        ),
      },
      {
        id: 'refuser',
        label: 'Refuser le marché',
        outcomes: trio(
          { text: 'L’orgueil reste propre dans le refus.\nL’ombre respecte ça parfois.', deltas: { moral: 3, renommee: 1 } },
          { text: 'Rien n’est perdu dans le refus.\nRien n’est gagné non plus.', deltas: {} },
          { text: 'L’ombre boude après le non.\nLe couloir devient plus froid.', deltas: { moral: -2, spd: -1 } },
        ),
      },
      {
        id: 'tromper',
        label: 'Tromper l’entité avec une fausse peur',
        outcomes: trio(
          { text: 'Le bluff tombe parfait.\nElle repart avec du vent et vous gardez le tranchant.', deltas: { charisme: 3, auto: 2, renommee: 2 } },
          { text: 'Elle doute, puis part.\nLe gain reste mince.', deltas: { charisme: 1 } },
          { text: 'Vous êtes pris la main dans le sac spectral.\nLa correction tombe nette.', deltas: { moral: -4, hp: -4 } },
        ),
      },
    ],
  }),
  q({
    id: 'faux_silence',
    family: 'faux',
    title: 'Silence après la coupe',
    text: 'La finale dresse une présence trop grande pour un nom.\nUne seule coupe juste ou un sceau décidera.\nVotre {arme} choisit avec vous.',
    rarity: 'epic',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'brandir',
        label: 'Brandir et couper',
        outcomes: trio(
          { text: 'Thanatos aurait souri.\nL’ombre s’allonge non pour vous prendre, mais pour vous suivre.', deltas: { auto: 5, cap: 3, renommee: 5, moral: -2, hp: -5 } },
          { text: 'La coupe reste honorable.\nLa présence s’affaiblit et vous aussi.', deltas: { auto: 2, hp: -5 } },
          { text: 'Elle voulait un acompte.\nVous avez failli le payer.', deltas: { hp: -11, moral: -6 } },
        ),
      },
      {
        id: 'sceller',
        label: 'Sceller sans frapper',
        outcomes: trio(
          { text: 'La sagesse guide le geste.\nUne bénédiction discrète ramène le silence.', deltas: { moral: 5, def: 3, renommee: 2 } },
          { text: 'Le sceau reste correct.\nLe couloir respire enfin.', deltas: { moral: 2 } },
          { text: 'Le murmure continue la nuit.\nAucun repos ne vient vraiment.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'offrir',
        label: 'Offrir une prière plutôt qu’un coup',
        outcomes: trio(
          { text: 'L’ombre accepte la prière.\nLa trêve reste rare et précieuse.', deltas: { moral: 4, cap: 2, renommee: 2 } },
          { text: 'Les prières restent tièdes.\nElles suffisent à passer.', deltas: { moral: 1 } },
          { text: 'Rien n’écoute vraiment.\nOu trop bien.', deltas: { moral: -3, hp: -2 } },
        ),
      },
    ],
  }),

  // ——— Épée ———
  q({
    id: 'epee_garde',
    family: 'epee',
    title: 'Leçon de garde',
    text: 'Un maître d’armes propose une garde oubliée.\nVotre {arme} doit l’apprendre sans se faire remplacer.',
    tags: ['combat'],
    options: [
      {
        id: 'apprendre',
        label: 'Répéter la garde cent fois',
        outcomes: trio(
          { text: 'Le geste s’ancre dans le muscle.\nVotre {arme} trouve un nouvel angle.', deltas: { def: 3, auto: 2 } },
          { text: 'Le progrès reste correct.\nLe bras devient lourd.', deltas: { def: 1, hp: -2 } },
          { text: 'Vous forcez trop le mouvement.\nLe poignet crie.', deltas: { hp: -5, moral: -2 } },
        ),
      },
      {
        id: 'defier',
        label: 'Défier le maître tout de suite',
        outcomes: trio(
          { text: 'Vous touchez une fois.\nIl sourit, ce qui reste rare.', deltas: { auto: 3, renommee: 2, hp: -3 } },
          { text: 'La défaite reste pédagogique.\nElle se révèle utile.', deltas: { def: 1, hp: -3 } },
          { text: 'La correction humilie sans détour.\nLa salle retient le bruit.', deltas: { moral: -4, hp: -4 } },
        ),
      },
      {
        id: 'observer',
        label: 'Observer les élèves d’abord',
        outcomes: trio(
          { text: 'Vous volez trois erreurs à éviter.\nCe butin vaut de l’or pur.', deltas: { cap: 2, def: 1, moral: 1 } },
          { text: 'Quelques notes restent prises.\nLe reste s’oublie déjà.', deltas: { cap: 1 } },
          { text: 'Trop regarder freine le bras.\nVous n’avez pas assez fait.', deltas: { moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'epee_duel',
    family: 'epee',
    title: 'Duel de salle',
    text: 'Un rival veut mesurer les lames.\nAucun trophée d’arme n’est en jeu, seulement le respect du fer.',
    rarity: 'rare',
    tags: ['combat', 'tournoi'],
    options: [
      {
        id: 'duel',
        label: 'Accepter le duel à la première touche',
        outcomes: trio(
          { text: 'La touche tombe nette.\nLa salle murmure votre nom avec {arme}.', deltas: { auto: 4, renommee: 4, hp: -3 } },
          { text: 'L’échange s’étire longtemps.\nLe match reste honorable.', deltas: { auto: 2, def: 1, hp: -4 } },
          { text: 'Il touche d’abord.\nLa leçon reste cuisante.', deltas: { hp: -7, moral: -3, renommee: -1 } },
        ),
      },
      {
        id: 'parade',
        label: 'Jouer la parade parfaite',
        outcomes: trio(
          { text: 'Rien ne passe la garde.\nIl abandonne, admiratif.', deltas: { def: 4, renommee: 2, charisme: 1 } },
          { text: 'Les parades tiennent bien.\nUne faille apparaît quand même.', deltas: { def: 2, hp: -2 } },
          { text: 'La parade monte trop haut.\nLe contre tombe immédiat.', deltas: { hp: -8, moral: -2 } },
        ),
      },
      {
        id: 'saluer',
        label: 'Saluer et proposer un autre jour',
        outcomes: trio(
          { text: 'Le respect marque la rencontre.\nIl boira à votre santé ce soir.', deltas: { charisme: 3, moral: 2 } },
          { text: 'Le report est accepté.\nLe fer attendra un autre jour.', deltas: { moral: 1 } },
          { text: 'On crie à la peur dans votre dos.\nLe jugement reste injuste et efficace.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'epee_honneur',
    family: 'epee',
    title: 'Serment de lame',
    text: 'La finale demande de prêter serment sur {arme}.\nCe n’est pas une nouvelle épée, c’est une ligne que vous ne franchirez plus.',
    rarity: 'rare',
    tags: ['combat', 'social'],
    options: [
      {
        id: 'serment',
        label: 'Jurer sur la garde',
        outcomes: trio(
          { text: 'Le serment tient.\nVotre {arme} semble plus droite, ou c’est vous.', deltas: { auto: 3, def: 2, renommee: 5, moral: 3 } },
          { text: 'Le serment reste sobre.\nIl compte quand même.', deltas: { renommee: 2, moral: 1 } },
          { text: 'Les mots glissent trop vite.\nLe doute suit la cérémonie.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'proteger',
        label: 'Protéger un plus faible sous serment',
        outcomes: trio(
          { text: 'Vous tenez la ligne.\nLa foule le voit.\n{arme} se met au service de quelqu’un.', deltas: { def: 3, charisme: 3, renommee: 4, hp: -3 } },
          { text: 'La protection reste correcte.\nAucune chanson ne naît.', deltas: { def: 1, charisme: 1 } },
          { text: 'Vous cédez un pas.\nLa honte pèse plus lourd que le coup.', deltas: { moral: -5, renommee: -2, hp: -4 } },
        ),
      },
      {
        id: 'defier_code',
        label: 'Défier un code injuste',
        outcomes: trio(
          { text: 'Vous brisez une règle absurde.\nCertains applaudissent et d’autres grincent.', deltas: { renommee: 3, charisme: 2, auto: 2 } },
          { text: 'Le geste se fait remarquer.\nAucune révolution ne suit.', deltas: { charisme: 1 } },
          { text: 'Le défi arrive trop tôt.\nOn vous isole.', deltas: { renommee: -3, moral: -3 } },
        ),
      },
    ],
  }),

  // ——— Hache ———
  q({
    id: 'hache_abattage',
    family: 'hache',
    title: 'Arbre-témoin',
    text: 'Un tronc marqué attend un coup net.\nVotre {arme} doit parler fort, une seule fois.',
    tags: ['combat'],
    options: [
      {
        id: 'abattre',
        label: 'Abattre d’un seul coup',
        outcomes: trio(
          { text: 'Le tronc se fend net.\nLes bûcherons hochent et les guerriers aussi.', deltas: { auto: 4, renommee: 2 } },
          { text: 'Deux coups suffisent.\nLe résultat reste correct.', deltas: { auto: 2, hp: -2 } },
          { text: 'La hache se coince dans le bois.\nL’humiliation reste collante.', deltas: { hp: -5, moral: -3 } },
        ),
      },
      {
        id: 'mesurer',
        label: 'Mesurer le fil avant de frapper',
        outcomes: trio(
          { text: 'L’angle tombe parfait.\nMoins de force produit plus de vérité.', deltas: { auto: 2, cap: 2 } },
          { text: 'La mesure reste bonne.\nLe bras suit le trait.', deltas: { auto: 1 } },
          { text: 'Trop réfléchir refroidit le bras.\nLe coup perd sa force.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'defi',
        label: 'Défier un rival à l’abattage',
        outcomes: trio(
          { text: 'Vous gagnez au bruit du bois.\nLe pari s’encaisse.', deltas: { auto: 2, or: 5, renommee: 2 } },
          { text: 'L’égalité tranche le défi.\nLes sueurs se partagent.', deltas: { auto: 1, hp: -2 } },
          { text: 'Il fend mieux que vous.\nVotre orgueil se fend aussi.', deltas: { moral: -3, or: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'hache_charge',
    family: 'hache',
    title: 'Porte barricadée',
    text: 'Une porte trop épaisse barre le passage.\nOn n’ouvre pas avec une clé, on ouvre avec votre {arme}.',
    rarity: 'rare',
    tags: ['combat', 'donjons'],
    options: [
      {
        id: 'enfoncer',
        label: 'Enfoncer la porte',
        outcomes: trio(
          { text: 'Le bois part en éclats.\nLe passage est à vous et le bruit annonce un champion.', deltas: { auto: 4, def: 1, renommee: 3, hp: -4 } },
          { text: 'La porte cède au troisième coup.\nLe chemin s’ouvre enfin.', deltas: { auto: 2, hp: -5 } },
          { text: 'La porte tient encore.\nVos épaules tiennent moins.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'coins',
        label: 'Fendre les gonds plutôt que le panneau',
        outcomes: trio(
          { text: 'Le plan reste malin.\nLa porte tombe sans théâtre inutile.', deltas: { auto: 3, spd: 2, or: 2 } },
          { text: 'Ça marche malgré la lenteur.\nLes gonds lâchent un à un.', deltas: { auto: 1, hp: -2 } },
          { text: 'Le mauvais gond répond mal.\nLe rebond devient douloureux.', deltas: { hp: -7, moral: -2 } },
        ),
      },
      {
        id: 'intimider',
        label: 'Menacer de fendre… et négocier',
        outcomes: trio(
          { text: 'Ils ouvrent avant le choc.\nVotre {arme} n’a même pas dû mordre.', deltas: { charisme: 3, or: 4, renommee: 2 } },
          { text: 'La négociation reste tiède.\nLe passage se paie.', deltas: { or: -2, charisme: 1 } },
          { text: 'Le bluff rate net.\nLes portes et les poings répondent ensemble.', deltas: { hp: -6, moral: -3 } },
        ),
      },
    ],
  }),
  q({
    id: 'hache_muron',
    family: 'hache',
    title: 'Mur qui défie',
    text: 'La finale dresse un mur runique.\nOn ne gagne pas une hache nouvelle : on prouve que la vôtre peut faire plier la pierre.',
    rarity: 'rare',
    tags: ['combat', 'donjons'],
    options: [
      {
        id: 'fracasser',
        label: 'Fracasser le point faible',
        outcomes: trio(
          { text: 'La faille s’ouvre.\nPierre et poussière s’envolent, et le respect suit.\nVotre {arme} a parlé.', deltas: { auto: 5, renommee: 4, hp: -5 } },
          { text: 'La brèche reste étroite.\nVous passez de biais.', deltas: { auto: 2, hp: -5 } },
          { text: 'Le mur rend le coup.\nVous le rendez aussi, plus mal.', deltas: { hp: -11, moral: -4 } },
        ),
      },
      {
        id: 'rythme',
        label: 'Frapper en cadence jusqu’à la faille',
        outcomes: trio(
          { text: 'La cadence de siège s’installe.\nLe mur cède par épuisement.', deltas: { auto: 3, def: 2, renommee: 2, hp: -4 } },
          { text: 'Le travail reste long et efficace.\nLa pierre finit par craquer.', deltas: { auto: 1, hp: -4 } },
          { text: 'La cadence se casse.\nLes bras brûlent et le mur reste intact.', deltas: { hp: -8, moral: -3 } },
        ),
      },
      {
        id: 'renoncer',
        label: 'Chercher un détour plutôt que le mur',
        outcomes: trio(
          { text: 'Le détour se révèle intelligent.\nParfois la hache sert à ne pas frapper.', deltas: { spd: 2, moral: 2, or: 3 } },
          { text: 'Le détour s’étire longtemps.\nVous arrivez quand même.', deltas: { hp: -2 } },
          { text: 'Le cul-de-sac se ferme.\nLe retour au mur vous trouve plus fatigué.', deltas: { moral: -3, hp: -3 } },
        ),
      },
    ],
  }),

  // ——— Bouclier ———
  q({
    id: 'bouclier_ligne',
    family: 'bouclier',
    title: 'Tenir la ligne',
    text: 'Une ligne vacille sous la pression.\nOn n’a pas besoin d’une égide légendaire, juste de votre {arme} au bon endroit.',
    tags: ['combat'],
    options: [
      {
        id: 'couvrir',
        label: 'Couvrir le flanc exposé',
        outcomes: trio(
          { text: 'Rien ne passe le bois.\nLa ligne se reforme derrière votre {arme}.', deltas: { def: 4, charisme: 1, renommee: 2 } },
          { text: 'La couverture reste correcte.\nQuelques coups s’encaissent.', deltas: { def: 2, hp: -3 } },
          { text: 'Vous arrivez trop tard.\nLa brèche s’ouvre et le blâme suit.', deltas: { hp: -7, moral: -3 } },
        ),
      },
      {
        id: 'avancer',
        label: 'Avancer en mur mobile',
        outcomes: trio(
          { text: 'Vous gagnez trois pas.\nL’ennemi recule au rythme du bois.', deltas: { def: 3, auto: 1, renommee: 2, hp: -2 } },
          { text: 'L’avancée reste lente.\nElle se révèle utile.', deltas: { def: 1, hp: -2 } },
          { text: 'Vous vous isolez trop tôt.\nOn vous harcèle sans relâche.', deltas: { hp: -8, moral: -2 } },
        ),
      },
      {
        id: 'bastion',
        label: 'Crier l’ordre du Rempart',
        ifClass: ['Bastion', 'Paladin'],
        outcomes: trio(
          { text: 'La ligne obéit à l’ordre.\nVotre {arme} devient un étendard de bois.', deltas: { def: 5, charisme: 2, renommee: 3 } },
          { text: 'L’ordre est entendu.\nL’exécution reste moyenne.', deltas: { def: 2 } },
          { text: 'La voix se perd sous le chaos.\nAucun ordre ne passe vraiment.', deltas: { moral: -3 } },
        ),
      },
    ],
  }),
  q({
    id: 'bouclier_siege',
    family: 'bouclier',
    title: 'Sous les projectiles',
    text: 'Le siège presse les murs.\nLes flèches pleuvent sans cesse.\nVotre {arme} doit devenir un toit.',
    rarity: 'rare',
    tags: ['combat'],
    options: [
      {
        id: 'toit',
        label: 'Former un toit de bois',
        outcomes: trio(
          { text: 'Personne ne tombe sous votre arc.\nLes flèches s’énervent toutes seules.', deltas: { def: 5, renommee: 3, hp: -3 } },
          { text: 'Quelques éclats traversent le bois.\nLe groupe tient quand même.', deltas: { def: 2, hp: -4 } },
          { text: 'Une flèche trouve le joint.\nLa leçon reste sanglante.', deltas: { hp: -10, moral: -3 } },
        ),
      },
      {
        id: 'charger_archers',
        label: 'Charger les archers sous {arme}',
        outcomes: trio(
          { text: 'Vous rompez leur ligne.\nLe siège respire enfin.', deltas: { def: 3, auto: 2, renommee: 3, hp: -5 } },
          { text: 'La charge reste utile.\nLe coût reste réel.', deltas: { def: 1, hp: -6 } },
          { text: 'Trop de traits s’abattent.\nLe recul devient forcé.', deltas: { hp: -11, moral: -4 } },
        ),
      },
      {
        id: 'tenir',
        label: 'Tenir sans avancer',
        outcomes: trio(
          { text: 'Vous formez un mur simple.\nLa pensée reste claire.\nLa victoire naît de l’ennui héroïque.', deltas: { def: 4, moral: 2 } },
          { text: 'Vous tenez la position.\nC’est déjà beaucoup.', deltas: { def: 2, hp: -2 } },
          { text: 'La fatigue gagne avant les flèches.\nLes genoux cèdent.', deltas: { hp: -6, moral: -3 } },
        ),
      },
    ],
  }),
  q({
    id: 'bouclier_egide',
    family: 'bouclier',
    title: 'Épreuve de l’égide',
    text: 'La finale demande d’encaisser un coup digne d’une égide, sans en recevoir une.\nVotre {arme} doit suffire.',
    rarity: 'rare',
    tags: ['combat'],
    options: [
      {
        id: 'encaisser',
        label: 'Encaisser le coup rituel',
        outcomes: trio(
          { text: 'Le choc passe dans le bois.\nVos os chantent et votre {arme} aussi.\nLe respect est acquis.', deltas: { def: 6, renommee: 5, hp: -6 } },
          { text: 'Vous tenez à genoux.\nIl reste assez pour la leçon.', deltas: { def: 3, hp: -7 } },
          { text: 'Le coup traverse trop.\nOn vous relève du sol.', deltas: { hp: -12, moral: -5 } },
        ),
      },
      {
        id: 'renvoyer',
        label: 'Renvoyer l’angle du choc',
        outcomes: trio(
          { text: 'La parade savante détourne l’angle.\nLe coup repart ailleurs.\nLa salle applaudit.', deltas: { def: 4, spd: 2, renommee: 3, hp: -3 } },
          { text: 'La déviation reste partielle.\nUne part du choc passe quand même.', deltas: { def: 2, hp: -4 } },
          { text: 'Le mauvais angle vous trahit.\nVous goûtez le plein.', deltas: { hp: -10, moral: -3 } },
        ),
      },
      {
        id: 'proteger',
        label: 'Protéger un autre plutôt que soi',
        outcomes: trio(
          { text: 'Ils se relèvent grâce à vous.\nVotre {arme} porte un autre nom ce soir : promesse.', deltas: { def: 3, charisme: 4, renommee: 4, hp: -5 } },
          { text: 'Le geste est vu.\nLa douleur reste réelle.', deltas: { charisme: 2, hp: -5 } },
          { text: 'Vous ratez le placement.\nDeux blessés tombent.', deltas: { hp: -8, moral: -4, renommee: -1 } },
        ),
      },
    ],
  }),

  // ——— Bâton ———
  q({
    id: 'baton_sentier',
    family: 'baton',
    title: 'Sentier des blessés',
    text: 'Des voyageurs boitent sur le sentier.\nVotre {arme} n’est pas une branche d’Yggdrasil, mais elle peut encore soigner.',
    tags: ['magie', 'social'],
    options: [
      {
        id: 'soigner',
        label: 'Soigner avec {arme}',
        outcomes: trio(
          { text: 'Les blessures ferment sous le bois.\nOn vous bénit sans connaître votre vrai nom.', deltas: { cap: 3, charisme: 2, moral: 2 } },
          { text: 'Les soins restent corrects.\nLa fatigue se partage.', deltas: { cap: 1, hp: -1 } },
          { text: 'Le dosage tombe mauvais.\nVous aggravez avant de corriger.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'guide',
        label: 'Guider le groupe hors du marais',
        outcomes: trio(
          { text: 'Le bâton avance devant le groupe.\nLe sentier se trouve et le sauveur reste humble.', deltas: { spd: 2, charisme: 2, renommee: 2 } },
          { text: 'Les détours s’accumulent.\nLa sortie arrive quand même.', deltas: { spd: 1 } },
          { text: 'Vous vous perdez avec eux.\nLa nuit tombe plus vite.', deltas: { moral: -3, hp: -3 } },
        ),
      },
      {
        id: 'healer',
        label: 'Canaliser un vrai soin de classe',
        ifClass: ['Healer', 'Alchimiste'],
        outcomes: trio(
          { text: 'La lumière tombe propre.\nVotre {arme} amplifie sans se vanter.', deltas: { cap: 5, charisme: 2, renommee: 2 } },
          { text: 'Le soin reste utile.\nRien de plus ne s’ajoute.', deltas: { cap: 2 } },
          { text: 'Le canal devient instable.\nLe retour de fatigue frappe.', deltas: { hp: -4, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'baton_bosquet',
    family: 'baton',
    title: 'Bosquet qui juge',
    text: 'Les arbres testent votre {arme}.\nIls jugent si le bois est vrai ou simple bâton de voyageur.',
    rarity: 'rare',
    tags: ['magie', 'donjons'],
    options: [
      {
        id: 'offrir',
        label: 'Offrir une goutte de sève à {arme}',
        outcomes: trio(
          { text: 'Le bois répond à l’offrande.\nUne chaleur douce naît, non comme une arme nouvelle, mais comme une alliance.', deltas: { cap: 4, def: 1, moral: 2 } },
          { text: 'Les feuilles donnent un léger assentiment.\nRien de plus ne suit.', deltas: { cap: 2 } },
          { text: 'Les racines se taisent.\nLe rejet reste poli.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'defendre',
        label: 'Défendre le bosquet d’un braconnier',
        outcomes: trio(
          { text: 'Vous chassez l’intrus.\nLes arbres vous doivent une faveur.', deltas: { cap: 2, auto: 2, renommee: 3, or: 3 } },
          { text: 'L’escarmouche s’achève vite.\nLe bosquet est sauvé et vous restez éraflé.', deltas: { hp: -3, renommee: 1 } },
          { text: 'Vous ratez l’intervention.\nLes branches semblent déçues.', deltas: { moral: -3, hp: -3 } },
        ),
      },
      {
        id: 'sylvari',
        label: 'Parler sève à sève',
        ifRace: ['Sylvari'],
        outcomes: trio(
          { text: 'Le bosquet vous reconnaît.\nVotre {arme} frémit d’appartenance.', deltas: { cap: 3, def: 2, hp: 3, moral: 2 } },
          { text: 'Le dialogue reste court.\nIl suffit pour aujourd’hui.', deltas: { cap: 1, hp: 1 } },
          { text: 'Même la sève a ses silences.\nAucun mot ne revient.', deltas: { moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'baton_sève',
    family: 'baton',
    title: 'Sève partagée',
    text: 'La finale ouvre un rituel de partage.\nVotre {arme} conduit la sève pour guérir ou pour brûler.',
    rarity: 'rare',
    tags: ['magie'],
    options: [
      {
        id: 'rituel',
        label: 'Conduire le rituel de soin',
        outcomes: trio(
          { text: 'La clairière respire.\nVous respirez aussi.\nLa capacité s’ancre sans trophée d’arme.', deltas: { cap: 5, moral: 3, renommee: 3, hp: 4 } },
          { text: 'Le rituel reste correct.\nUne fatigue verte suit.', deltas: { cap: 2, hp: 1 } },
          { text: 'La sève trop vive brûle.\nLa brûlure intérieure s’installe.', deltas: { hp: -7, moral: -3 } },
        ),
      },
      {
        id: 'garder',
        label: 'Garder une goutte pour plus tard',
        outcomes: trio(
          { text: 'La fiole reste tiède.\nElle promet un soin futur.', deltas: { cap: 2, or: 3, moral: 2 } },
          { text: 'Une petite réserve tient en poche.\nRien de plus ne se conserve.', deltas: { or: 1 } },
          { text: 'La goutte sèche trop vite.\nLa promesse meurt.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'offrir_groupe',
        label: 'Tout donner au groupe blessé',
        outcomes: trio(
          { text: 'Vous repartez vides et aimés.\nÇa compte plus qu’une branche mythique.', deltas: { charisme: 4, renommee: 4, moral: 3, cap: 1 } },
          { text: 'Le don est apprécié.\nLes regards le confirment.', deltas: { charisme: 2, moral: 1 } },
          { text: 'On oublie de dire merci.\nÇa pique quand même.', deltas: { moral: -3 } },
        ),
      },
    ],
  }),

  // ——— Sceptre ———
  q({
    id: 'sceptre_audience',
    family: 'sceptre',
    title: 'Audience de couloir',
    text: 'Une petite cour d’ombres s’assemble.\nVotre {arme} n’ouvre pas un trône, elle ouvre des portes de négociation.',
    tags: ['social'],
    options: [
      {
        id: 'parler',
        label: 'Parler comme si la salle était à vous',
        outcomes: trio(
          { text: 'Ils écoutent jusqu’au bout.\nLe pouvoir soft reste le meilleur genre.', deltas: { charisme: 4, renommee: 2 } },
          { text: 'L’attention reste polie.\nRien de plus ne s’ajoute.', deltas: { charisme: 2 } },
          { text: 'On vous coupe au milieu du discours.\nUn silence gênant s’installe.', deltas: { moral: -3, charisme: -1 } },
        ),
      },
      {
        id: 'cadeau',
        label: 'Offrir un cadeau calculé',
        outcomes: trio(
          { text: 'Le cadeau ouvre une alliance.\nVotre {arme} n’a pas eu à menacer.', deltas: { charisme: 2, or: -4, renommee: 2, cap: 1 } },
          { text: 'Le cadeau reste correct.\nLa politesse suffit.', deltas: { or: -2, charisme: 1 } },
          { text: 'Le cadeau est mal choisi.\nL’offense reste discrète.', deltas: { or: -3, moral: -2, renommee: -1 } },
        ),
      },
      {
        id: 'menacer',
        label: 'Laisser {arme} parler à votre place',
        outcomes: trio(
          { text: 'La peur se révèle utile.\nLes accords se signent trop vite.', deltas: { charisme: 2, renommee: 1, or: 4 } },
          { text: 'L’intimidation reste tiède.\nQuelques pièces changent de main.', deltas: { or: 2 } },
          { text: 'On vous trouve vulgaire.\nLes portes se ferment.', deltas: { renommee: -3, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'sceptre_pacte',
    family: 'sceptre',
    title: 'Pacte de couloir',
    text: 'Un prince sans couronne propose un pacte.\nVotre {arme} scelle l’accord ou le refuse.',
    rarity: 'rare',
    tags: ['social', 'magie'],
    options: [
      {
        id: 'sceller',
        label: 'Sceller le pacte sur {arme}',
        outcomes: trio(
          { text: 'Le pacte tient.\nL’influence monte avec une dette utile.', deltas: { charisme: 3, cap: 2, renommee: 3, or: 4 } },
          { text: 'Le pacte reste flou.\nLes avantages restent flous aussi.', deltas: { charisme: 1, or: 2 } },
          { text: 'Une clause piège se referme.\nVous payez trop tôt.', deltas: { or: -6, moral: -3 } },
        ),
      },
      {
        id: 'renegocier',
        label: 'Renégocier chaque clause',
        outcomes: trio(
          { text: 'Vous gagnez sur les marges.\nUn roi-sorcier en herbe se dessine.', deltas: { charisme: 4, cap: 1, or: 3 } },
          { text: 'Quelques clauses sont sauvées.\nLe reste reste dur.', deltas: { charisme: 2 } },
          { text: 'Ils s’impatientent trop vite.\nLe pacte se casse.', deltas: { moral: -3, renommee: -1 } },
        ),
      },
      {
        id: 'refuser',
        label: 'Refuser avec élégance',
        outcomes: trio(
          { text: 'Le refus reste admirable.\nOn vous craint un peu plus.', deltas: { renommee: 2, moral: 2, charisme: 1 } },
          { text: 'Le refus reste plat.\nLa porte suivante s’ouvre déjà.', deltas: {} },
          { text: 'On prend le refus pour une insulte.\nLes regards durcissent.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'sceptre_trone',
    family: 'sceptre',
    title: 'Trône vide',
    text: 'La finale dresse un siège sans roi.\nS’y asseoir ne donne pas le Sceptre du Roi-Sorcier, seulement le poids du regard.',
    rarity: 'epic',
    tags: ['social'],
    options: [
      {
        id: 'asseoir',
        label: 'S’asseoir un souffle',
        outcomes: trio(
          { text: 'Le silence vous couronne un instant.\nVous vous levez plus grand, {arme} plus lourde de sens.', deltas: { charisme: 5, renommee: 5, cap: 2, moral: 1 } },
          { text: 'La sensation reste étrange.\nLa leçon reste courte.', deltas: { charisme: 2, renommee: 1 } },
          { text: 'Le siège vous rejette.\nDes rires secs répondent.', deltas: { moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'couronner_autre',
        label: 'Y faire asseoir un autre',
        outcomes: trio(
          { text: 'Vous devenez roi-faiseur.\nL’influence reste nette et la gloire se partage.', deltas: { charisme: 4, renommee: 4, or: 5 } },
          { text: 'Le geste politique reste correct.\nRien de plus ne suit.', deltas: { charisme: 2, or: 2 } },
          { text: 'Votre pion vous trahit déjà.\nLa leçon tombe vite.', deltas: { moral: -4, renommee: -2 } },
        ),
      },
      {
        id: 'detruire',
        label: 'Renverser le siège',
        outcomes: trio(
          { text: 'Le symbole tombe avec le siège.\nCertains vous aiment pour ça.', deltas: { renommee: 3, auto: 2, charisme: 2 } },
          { text: 'Le bruit et la poussière remplissent la salle.\nPeu de suite s’ensuit.', deltas: { renommee: 1 } },
          { text: 'Le sacrilège se lit mal.\nLes portes se ferment.', deltas: { renommee: -4, moral: -3 } },
        ),
      },
    ],
  }),

  // ——— Fléau ———
  q({
    id: 'fleau_liens',
    family: 'fleau',
    title: 'Chaînes au sol',
    text: 'Des chaînes traînent au sol.\nVotre {arme} veut les faire danser, par discipline plutôt que par sadisme, enfin on verra.',
    tags: ['combat'],
    options: [
      {
        id: 'maitriser',
        label: 'Maîtriser le mouvement des chaînes',
        outcomes: trio(
          { text: 'Le rythme se trouve.\nLa masse obéit au poignet.', deltas: { auto: 3, spd: 1 } },
          { text: 'Le progrès avance.\nQuelques hématomes pédagogiques suivent.', deltas: { auto: 1, hp: -2 } },
          { text: 'La chaîne vous mord.\nL’ironie reste lourde.', deltas: { hp: -6, moral: -2 } },
        ),
      },
      {
        id: 'desarmer',
        label: 'Désarmer un mannequin enchaîné',
        outcomes: trio(
          { text: 'La frappe circulaire tombe parfaite.\nLe mannequin n’a plus de bras de bois.', deltas: { auto: 3, renommee: 1 } },
          { text: 'Le désarmement reste correct.\nRien de plus ne s’ajoute.', deltas: { auto: 1 } },
          { text: 'Vous vous emmêlez dans les liens.\nLe spectacle devient public.', deltas: { moral: -3, hp: -3 } },
        ),
      },
      {
        id: 'intimider',
        label: 'Faire siffler {arme} pour disperser une foule',
        outcomes: trio(
          { text: 'La rue s’ouvre devant le sifflement.\nLa peur se révèle utile.', deltas: { charisme: 2, renommee: 2, or: 2 } },
          { text: 'Quelques pas de recul s’ouvrent.\nLa foule cède un peu.', deltas: { charisme: 1 } },
          { text: 'On ne bouge pas.\nL’humiliation reste bruyante.', deltas: { moral: -3, renommee: -1 } },
        ),
      },
    ],
  }),
  q({
    id: 'fleau_crepuscule',
    family: 'fleau',
    title: 'Crépuscule lié',
    text: 'Un duel au fléau s’ouvre sous lumière rouge.\nVotre {arme} doit nouer l’espace sans devenir Anathème.',
    rarity: 'rare',
    tags: ['combat'],
    options: [
      {
        id: 'lier',
        label: 'Lier le bras adverse',
        outcomes: trio(
          { text: 'La chaîne tombe parfaite.\nIl tombe avant de comprendre.', deltas: { auto: 4, spd: 2, renommee: 3, hp: -3 } },
          { text: 'Le lien reste partiel.\nLa fin reste sale mais gagnante.', deltas: { auto: 2, hp: -4 } },
          { text: 'Il coupe le lien.\nLe contre devient brutal.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'tourbillon',
        label: 'Tourbillon de masse',
        outcomes: trio(
          { text: 'Un cercle de fer s’installe.\nPersonne n’ose plus approcher le cercle.', deltas: { auto: 3, def: 2, renommee: 2, hp: -4 } },
          { text: 'Le geste reste beau.\nL’essoufflement suit vite.', deltas: { auto: 1, hp: -4 } },
          { text: 'Le vertige prend le dessus.\nVous vous frappez presque vous-même.', deltas: { hp: -8, moral: -3 } },
        ),
      },
      {
        id: 'finir',
        label: 'Finir au sol, contrôle total',
        outcomes: trio(
          { text: 'La soumission tombe nette.\nLe crépuscule applaudit mollement.', deltas: { auto: 3, charisme: 2, renommee: 3 } },
          { text: 'Le contrôle reste correct.\nRien de plus ne s’ajoute.', deltas: { auto: 1 } },
          { text: 'Il se relève trop vite.\nVous perdez le fil et le duel.', deltas: { hp: -7, moral: -4 } },
        ),
      },
    ],
  }),
  q({
    id: 'fleau_anatheme',
    family: 'fleau',
    title: 'Nom d’anathème',
    text: 'La finale demande de nommer une faute avec {arme}.\nAucune arme nouvelle n’apparaît, seulement une sentence.',
    rarity: 'rare',
    tags: ['combat', 'ombres'],
    options: [
      {
        id: 'juger',
        label: 'Rendre la sentence',
        outcomes: trio(
          { text: 'La faute est marquée.\nLes témoins se taisent.\nVotre {arme} a un poids de loi.', deltas: { auto: 4, renommee: 5, charisme: 2, moral: -1 } },
          { text: 'La sentence reste tiède.\nL’effet reste partiel.', deltas: { auto: 2, renommee: 1 } },
          { text: 'L’injustice se perçoit.\nLa foule se retourne.', deltas: { renommee: -3, moral: -4 } },
        ),
      },
      {
        id: 'epargner',
        label: 'Épargner sous condition',
        outcomes: trio(
          { text: 'La pitié reste stratégique.\nUne dette s’ouvre en votre faveur.', deltas: { charisme: 4, renommee: 2, moral: 3 } },
          { text: 'L’épargne est acceptée.\nLe souffle reprend.', deltas: { charisme: 1, moral: 1 } },
          { text: 'On prend la pitié pour de la faiblesse.\nLes regards baissent.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
      {
        id: 'detruire_chaine',
        label: 'Briser vos propres chaînes de rage',
        outcomes: trio(
          { text: 'La maîtrise revient.\nLe fléau obéit et vous aussi.', deltas: { auto: 2, moral: 4, def: 2, renommee: 2 } },
          { text: 'Le calme reste fragile.\nIl tient juste assez.', deltas: { moral: 2 } },
          { text: 'La rage gagne un round.\nLe souffle se perd.', deltas: { moral: -4, hp: -3 } },
        ),
      },
    ],
  }),

  // ——— Arbalète ———
  q({
    id: 'arbalete_embuscade',
    family: 'arbalete',
    title: 'Embuscade préparée',
    text: 'Un convoi avance dans la fenaison.\nVotre {arme} aime les angles, pas les trophées d’arbalète mythique.',
    tags: ['combat', 'ombres'],
    options: [
      {
        id: 'viser',
        label: 'Prendre l’angle parfait',
        outcomes: trio(
          { text: 'Le premier trait tombe décisif.\nLe convoi se fige et votre équipe bouge.', deltas: { spd: 3, auto: 2, or: 4 } },
          { text: 'L’angle reste bon.\nLe timing reste moyen.', deltas: { spd: 1, or: 2 } },
          { text: 'Le trait part trop tôt.\nL’alerte générale se déclenche.', deltas: { hp: -5, moral: -3 } },
        ),
      },
      {
        id: 'attendre',
        label: 'Attendre le signal',
        outcomes: trio(
          { text: 'La patience gagne le tour.\nLe trait part au bon souffle.', deltas: { spd: 2, moral: 2, auto: 1 } },
          { text: 'L’attente se révèle utile.\nRien de plus ne s’ajoute.', deltas: { moral: 1 } },
          { text: 'Le signal ne vient pas.\nL’occasion se perd.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'couvrir',
        label: 'Couvrir la retraite d’un allié',
        outcomes: trio(
          { text: 'Deux traits partent nets.\nDeux menaces restent clouées.\nOn vous doit une bière.', deltas: { spd: 2, charisme: 2, renommee: 2 } },
          { text: 'La couverture reste correcte.\nL’allié passe grâce à votre couverture.', deltas: { spd: 1 } },
          { text: 'Vous ratez le flanc.\nLa fuite devient plus sale.', deltas: { moral: -3, hp: -3 } },
        ),
      },
    ],
  }),
  q({
    id: 'arbalete_serment',
    family: 'arbalete',
    title: 'Serment de trait',
    text: 'On vous fait jurer un seul trait pour une seule promesse.\nVotre {arme} devient parole.',
    rarity: 'rare',
    tags: ['combat', 'social'],
    options: [
      {
        id: 'jurer',
        label: 'Jurer sur la noix de {arme}',
        outcomes: trio(
          { text: 'Le serment tient d’avance.\nLa main devient plus ferme.', deltas: { spd: 3, renommee: 3, moral: 2 } },
          { text: 'Le serment reste sobre.\nIl compte quand même.', deltas: { renommee: 1, moral: 1 } },
          { text: 'Les mots glissent trop vite.\nLe doute frappe au moment de viser.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'tir_serment',
        label: 'Tirer pour sceller le serment',
        outcomes: trio(
          { text: 'Le trait tombe parfait dans la cible rituelle.\nLa salle acquiesce.', deltas: { spd: 4, auto: 2, renommee: 3 } },
          { text: 'Le trait entre dans le cercle.\nIl manque presque le centre.', deltas: { spd: 2 } },
          { text: 'Le trait sort hors cible.\nLe serment se fait moquer.', deltas: { moral: -4, renommee: -2 } },
        ),
      },
      {
        id: 'refuser',
        label: 'Refuser un serment trop lourd',
        outcomes: trio(
          { text: 'L’honneur de dire non tient.\nCertains respectent ce refus net.', deltas: { moral: 3, charisme: 1 } },
          { text: 'Le refus reste plat.\nAucune suite ne s’ajoute.', deltas: {} },
          { text: 'On vous traite de lâche à distance.\nLe bruit porte loin.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'arbalete_verdict',
    family: 'arbalete',
    title: 'Verdict à distance',
    text: 'La finale demande qu’un jugement tombe d’une flèche.\nCe n’est pas l’Arbalète du Verdict, c’est la vôtre aujourd’hui.',
    rarity: 'rare',
    tags: ['combat'],
    options: [
      {
        id: 'verdict',
        label: 'Tirer le verdict',
        outcomes: trio(
          { text: 'Le trait tombe juste.\nUn silence de cour s’installe.\nVotre {arme} a tranché sans s’approcher.', deltas: { spd: 5, renommee: 5, auto: 2, hp: -2 } },
          { text: 'Le verdict est accepté.\nLe tir reste imparfait.', deltas: { spd: 2, renommee: 2 } },
          { text: 'Le trait reste douteux.\nLa contestation ouvre le chaos.', deltas: { moral: -5, renommee: -3, hp: -3 } },
        ),
      },
      {
        id: 'manquer_exprès',
        label: 'Manquer exprès pour épargner',
        outcomes: trio(
          { text: 'La pitié reste visible.\nUne dette politique s’ouvre.', deltas: { charisme: 4, moral: 3, renommee: 2 } },
          { text: 'Le geste se lit à moitié.\nUne part seulement comprend.', deltas: { charisme: 1, moral: 1 } },
          { text: 'On crie à la trahison du serment.\nLes regards durcissent.', deltas: { renommee: -3, moral: -3 } },
        ),
      },
      {
        id: 'double',
        label: 'Préparer un second trait « si besoin »',
        outcomes: trio(
          { text: 'La discipline du tireur tient.\nLe second trait n’est pas nécessaire et tout le monde le voit.', deltas: { spd: 3, def: 1, renommee: 2, moral: 2 } },
          { text: 'La prudence reste correcte.\nRien de plus ne s’ajoute.', deltas: { spd: 1 } },
          { text: 'L’hésitation gagne la main.\nLe premier trait tremble.', deltas: { moral: -3, spd: -1 } },
        ),
      },
    ],
  }),

  // ——— Pendule ———
  q({
    id: 'pendule_tic',
    family: 'pendule',
    title: 'Tic contre tac',
    text: 'Un pendule étranger bat à côté du vôtre.\nVotre {arme} doit trouver le rythme sans voler Chronos.',
    tags: ['ombres', 'magie'],
    options: [
      {
        id: 'synchroniser',
        label: 'Synchroniser les battements',
        outcomes: trio(
          { text: 'Un seul temps s’installe.\nLe couloir ralentit pour vous.', deltas: { spd: 2, cap: 2, moral: 1 } },
          { text: 'Vous restez presque en phase.\nLe battement hésite encore.', deltas: { spd: 1 } },
          { text: 'La dissonance frappe net.\nUne nausée temporelle suit.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'accelerer',
        label: 'Forcer un tic plus vite',
        outcomes: trio(
          { text: 'Une petite avance est volée.\nElle suffit pour un geste décisif.', deltas: { spd: 3, renommee: 1 } },
          { text: 'Le gain reste mince.\nLe temps cède à peine.', deltas: { spd: 1 } },
          { text: 'Le temps mord en retour.\nLes articulations deviennent lourdes.', deltas: { hp: -5, moral: -2 } },
        ),
      },
      {
        id: 'ecouter',
        label: 'Écouter sans toucher',
        outcomes: trio(
          { text: 'Vous entendez une faille dans le futur proche.\nLe murmure suffit à préparer le geste.', deltas: { cap: 3, moral: 2 } },
          { text: 'Un murmure utile traverse l’oreille.\nRien de plus ne s’ajoute.', deltas: { cap: 1 } },
          { text: 'Trop écouter fige le corps.\nLe moment passe sans vous.', deltas: { moral: -2 } },
        ),
      },
    ],
  }),
  q({
    id: 'pendule_fige',
    family: 'pendule',
    title: 'Seconde figée',
    text: 'Une menace tombe sur vous.\nVotre {arme} peut figer une seconde, pas davantage.',
    rarity: 'rare',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'figer',
        label: 'Figer la seconde fatale',
        outcomes: trio(
          { text: 'Le coup passe à côté.\nVous respirez dans un trou du temps.', deltas: { spd: 3, def: 2, moral: 3, hp: 2 } },
          { text: 'Une demi-seconde suffit.\nElle permet de parer.', deltas: { def: 1, hp: -2 } },
          { text: 'Le temps refuse l’appel.\nLe coup arrive quand même.', deltas: { hp: -8, moral: -3 } },
        ),
      },
      {
        id: 'offrir_seconde',
        label: 'Offrir la seconde à un allié',
        outcomes: trio(
          { text: 'Ils survivent grâce à vous.\nLa dette reste claire.', deltas: { charisme: 3, renommee: 3, moral: 2 } },
          { text: 'Le geste est vu.\nRien de plus ne s’ajoute.', deltas: { charisme: 1 } },
          { text: 'Le rythme tombe mal cadencé.\nLes deux souffrent.', deltas: { hp: -5, moral: -3 } },
        ),
      },
      {
        id: 'voler',
        label: 'Voler deux secondes… risquer le retour',
        outcomes: trio(
          { text: 'L’audace paie sans trop attendre.\nDeux gestes partent pour le prix d’un.', deltas: { spd: 4, auto: 2, renommee: 2, hp: -3 } },
          { text: 'Une seconde et demie passe.\nLe résultat reste correct.', deltas: { spd: 2, hp: -2 } },
          { text: 'Le temps se venge.\nVous vieillissez d’un mauvais rêve.', deltas: { hp: -7, moral: -5, def: -1 } },
        ),
      },
    ],
  }),
  q({
    id: 'pendule_dette',
    family: 'pendule',
    title: 'Dette de Chronos',
    text: 'La finale demande de rendre le temps emprunté.\nVotre {arme} compte chaque tic, et Chronos aussi.',
    rarity: 'epic',
    tags: ['ombres', 'magie'],
    options: [
      {
        id: 'rendre',
        label: 'Rendre chaque tic dû',
        outcomes: trio(
          { text: 'Le compte est soldé.\nLe pendule bat plus juste, et vous aussi.', deltas: { spd: 3, cap: 3, moral: 4, renommee: 3 } },
          { text: 'La dette s’allège.\nLe souffle reprend.', deltas: { moral: 2, spd: 1 } },
          { text: 'Il en manque encore.\nChronos fronce devant le manque.', deltas: { moral: -4, hp: -3 } },
        ),
      },
      {
        id: 'negocier',
        label: 'Négocier un report',
        outcomes: trio(
          { text: 'Le report est accordé.\nLes intérêts restent acceptables.', deltas: { charisme: 3, or: -3, spd: 2 } },
          { text: 'Le report reste court.\nLe temps revient vite.', deltas: { or: -1 } },
          { text: 'Le refus tombe net.\nLa pénalité arrive immédiate.', deltas: { hp: -6, moral: -3, or: -2 } },
        ),
      },
      {
        id: 'briser_cycle',
        label: 'Tenter de briser le cycle',
        outcomes: trio(
          { text: 'Une fêlure s’ouvre dans la boucle.\nLe geste reste rare, dangereux et magnifique.', deltas: { cap: 4, spd: 3, renommee: 4, moral: -2, hp: -4 } },
          { text: 'Une micro-fêlure apparaît.\nElle suffit pour rêver.', deltas: { cap: 2, spd: 1 } },
          { text: 'Le cycle se referme sur vos doigts.\nLa boucle mord.', deltas: { hp: -9, moral: -5, spd: -1 } },
        ),
      },
    ],
  }),
];
