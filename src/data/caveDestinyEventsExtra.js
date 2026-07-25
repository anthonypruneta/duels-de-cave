/**
 * ~30 événements supplémentaires Cave Destiny (univers Duels de Cave).
 * Raretés variées : common → legendary.
 */

import { trio } from './caveDestinyEventUtils';

export const CAVE_DESTINY_EVENTS_EXTRA = [
  {
    id: 'entrainement',
    title: 'Salle d’entraînement',
    text: 'Les mannequins cognent sous les coups. Pas de gloire ici — seulement la sueur, le fer et l’écho sourd de l’arène.',
    rarity: 'common',
    tags: ['combat'],
    options: [
      {
        id: 'sparring',
        label: 'Enchaîner les duels d’entraînement',
        outcomes: trio(
          { text: 'Vos gestes se durcissent : le corps répond avant la pensée, et le fer chante juste.', deltas: { auto: 3, def: 2, hp: -3 } },
          { text: 'Session correcte : quelques bleus, un peu de souffle, rien qui fera parler la Taverne.', deltas: { auto: 1, hp: -2 } },
          { text: 'Vous forcez trop. Une entorse vous rappelle à l’ordre — le sol de la salle est froid.', deltas: { hp: -8, moral: -2 } },
        ),
      },
      {
        id: 'technique',
        label: 'Travailler une feinte précise',
        outcomes: trio(
          { text: 'La feinte devient réflexe : l’épaule ment, la lame suit, l’adversaire reste un temps trop tard.', deltas: { spd: 3, cap: 1 } },
          { text: 'Progrès discret — le mouvement tient, sans encore surprendre vraiment.', deltas: { spd: 1 } },
          { text: 'Vous confondez les enchaînements. Frustration amère, poings serrés, sueur inutile.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'repos',
        label: 'Observer les autres s’entraîner',
        outcomes: trio(
          { text: 'Vous volez une idée de garde : un angle d’épaule, un pivot — déjà dans vos muscles.', deltas: { def: 2, moral: 2 } },
          { text: 'Spectateur utile… à peine. Vous repartez avec une note mentale et peu d’autre.', deltas: { moral: 1 } },
          { text: 'Vous vous ennuyez. Les PV baissent, le moral aussi — l’inaction a un goût de rouille.', deltas: { hp: -3, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'encyclopedie',
    title: 'L’Encyclopédie',
    text: 'Grimoires, bestiaires, notes de vainqueurs. L’odeur du parchemin tiède ; le savoir attend ceux qui lisent vraiment.',
    rarity: 'common',
    tags: ['ombres'],
    options: [
      {
        id: 'bestiaire',
        label: 'Étudier le bestiaire des donjons',
        outcomes: trio(
          { text: 'Vous retenez une faiblesse de boss — un flanc, un rythme. La Tour du Mage n’aura plus le même goût.', deltas: { cap: 3, renommee: 1 } },
          { text: 'Quelques notes utiles griffonnées à la hâte, assez pour ne pas mourir bête.', deltas: { cap: 1 } },
          { text: 'Trop de pages. Rien ne s’imprime. Les caractères dansent, votre tête lourde.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'armes',
        label: 'Comparer les lignées d’armes',
        outcomes: trio(
          { text: 'Vous comprenez mieux le lien arme–bras : le poids, le souffle, la ligne du coup.', deltas: { auto: 2, cap: 2 } },
          { text: 'Lecture correcte — schémas clairs, mais sans révélation qui change une garde.', deltas: { auto: 1 } },
          { text: 'Vous mélangez Mjöllnir et Gungnir. Honte douce sous les regards des autres lecteurs.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'dormir',
        label: 'S’assoupir sur un tome',
        outcomes: trio(
          { text: 'Un rêve étrange vous inspire : corridors, runes, un cri d’arène — vous vous réveillez plus vif.', deltas: { moral: 4, cap: 1 } },
          { text: 'Sieste lourde sur le cuir du tome. Vous vous étirez, un peu moins cassé, pas plus sage.', deltas: { hp: 3 } },
          { text: 'On vous réveille d’un rire. Ego froissé, joues brûlantes, tomes trop lourds pour votre dignité.', deltas: { charisme: -2, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'repos_taverne',
    title: 'Repos à la Taverne',
    text: 'Bières, chants, chibis endormis sur les tables. La Taverne sent le houblon et le bois brûlé — parfois, ne rien faire est un choix.',
    rarity: 'common',
    tags: ['social'],
    options: [
      {
        id: 'boire',
        label: 'Boire avec les habitués',
        outcomes: trio(
          { text: 'La salle vous adopte. Choppes cognent, rires fusent — moral au beau fixe jusqu’à l’aube.', deltas: { moral: 6, charisme: 2, or: -3, hp: 2 } },
          { text: 'Soirée tiède, tête légère. Vous repartez sans histoire, juste le goût du malt.', deltas: { moral: 2, or: -1 } },
          { text: 'Trop bu. Le lendemain punit : tempes en fer, gorge sèche, bourse plus légère.', deltas: { hp: -6, moral: -2, or: -4 } },
        ),
      },
      {
        id: 'dormir',
        label: 'Louer une chambre jusqu’à l’aube',
        outcomes: trio(
          { text: 'Sommeil réparateur. Les planches craquent, puis le silence — vous renaîtrez demain.', deltas: { hp: 10, moral: 3, or: -2 } },
          { text: 'Repos correct : oreiller dur, sommeil court, mais le corps tient mieux.', deltas: { hp: 5, or: -1 } },
          { text: 'Matelas dur, rêves agités. Vous sortez plus fatigué qu’en entrant, et plus pauvre.', deltas: { hp: 1, moral: -2, or: -2 } },
        ),
      },
      {
        id: 'chanter',
        label: 'Rejoindre le chœur improvisé',
        outcomes: trio(
          { text: 'Votre voix porte jusqu’au fond. On vous offre une tournée — la Taverne bat la mesure.', deltas: { charisme: 4, moral: 3 } },
          { text: 'Vous fredonnez correctement. Personne ne s’arrête, mais personne ne grimace.', deltas: { charisme: 1 } },
          { text: 'Fausse note. On change de sujet. Vos oreilles brûlent plus que la bière.', deltas: { charisme: -3, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'sanglier',
    title: 'Sanglier de la clairière',
    text: 'Dans la Forêt enchantée, un sanglier charge. Feuilles arrachées, sol qui tremble — petits yeux, gros problème.',
    rarity: 'common',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'affronter',
        label: 'Bloquer la charge de front',
        // check secret : bonne Déf → bien plus de succès
        check: { def: 1.5, auto: 0.55 },
        outcomes: trio(
          { text: 'Vous encaissez la charge. Le sanglier s’effondre — viande chaude, gloire mineure, souffle court.', deltas: { def: 2, or: 4, hp: -2 } },
          { text: 'Vous le chassez… après une course. Branches dans le visage, sang dans la bouche, victoire sale.', deltas: { def: 1, hp: -4 } },
          { text: 'Il vous renverse. Départ humiliant : boue dans le dos, rires d’oiseaux dans les branches.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'esquiver',
        label: 'L’attirer hors du sentier',
        check: { spd: 1.4, charisme: 0.3 },
        outcomes: trio(
          { text: 'Piège parfait. Il s’englue dans les ronces — butin sans une égratignure.', deltas: { spd: 3, or: 5 } },
          { text: 'Vous gagnez… salement. Griffures, sueur, et un trophée qui sent encore la bête.', deltas: { or: 2, hp: -2 } },
          { text: 'Vous trébuchez. Les défenses vous trouvent — un coup sourd, le goût du fer.', deltas: { hp: -7, moral: -2 } },
        ),
      },
      {
        id: 'fuir',
        label: 'Contourner le territoire',
        check: { spd: 0.8, charisme: 0.5 },
        outcomes: trio(
          { text: 'Sagesse. Vous trouvez un autre sentier — mousse douce, champignons, un peu d’or oublié.', deltas: { or: 3, moral: 1 } },
          { text: 'Vous perdez du temps, rien de plus. Le soleil a bougé ; le sanglier, non.', deltas: {} },
          { text: 'Le sanglier vous suit quand même. Souffle chaud dans la nuque, panique dans les jambes.', deltas: { hp: -5, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'duel_ami',
    title: 'Duel amical',
    text: 'Un autre combattant propose un affrontement sans enjeu… enfin, presque. Les regards de la Taverne pèsent déjà.',
    rarity: 'common',
    tags: ['combat', 'social'],
    options: [
      {
        id: 'accepter',
        label: 'Accepter le duel',
        outcomes: trio(
          { text: 'Victoire nette. Respect mutuel : poignées de main, sueur partagée, nom un peu plus fort.', deltas: { renommee: 3, auto: 2, charisme: 2 } },
          { text: 'Match serré. Vous apprenez — une parade ratée, une riposte tenue, le corps qui retient.', deltas: { def: 1, hp: -3 } },
          { text: 'Défaite amicale… l’ego moins. Le rire de l’autre sonne trop clair dans votre tête.', deltas: { moral: -5, hp: -4 } },
        ),
      },
      {
        id: 'conseil',
        label: 'Échanger des conseils après l’échauffement',
        outcomes: trio(
          { text: 'Astuce précieuse sur une capacité — un timing, un souffle. Vous repartez plus malin.', deltas: { cap: 2, charisme: 2 } },
          { text: 'Conversation polie, quelques formules banales, un sourire qui ne change pas grand-chose.', deltas: { charisme: 1 } },
          { text: 'Malentendu. L’ambiance se gâte : mots trop secs, regards de travers, poings qui démangent.', deltas: { charisme: -2, moral: -2 } },
        ),
      },
      {
        id: 'refuser',
        label: 'Décliner poliment',
        outcomes: trio(
          { text: 'On respecte votre prudence. Un hochement, un verre levé — la Taverne passe à autre chose.', deltas: { moral: 2 } },
          { text: 'Le moment tombe à plat. Personne n’insiste, personne n’applaudit — juste le bruit des choppes.', deltas: {} },
          { text: 'On murmure « peureux ». Le mot colle à la peau plus longtemps que la bière.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'ours_bosquet',
    title: 'Ours du bosquet',
    text: 'Plus loin dans la Forêt enchantée, l’ours ne négocie pas. Fourrure sombre, souffle lourd, silence qui pèse.',
    rarity: 'uncommon',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'rush',
        label: 'Frapper avant qu’il se lève',
        outcomes: trio(
          { text: 'Assaut parfait. Le bosquet vous appartient — sang, mousse, et un trophée qui sent la victoire.', deltas: { auto: 4, or: 7, hp: -5, trophies: { donjon: 1 } } },
          { text: 'Victoire difficile. Vous tenez debout, tremblant, l’ours à terre et le bras en feu.', deltas: { auto: 1, hp: -6, or: 2 } },
          { text: 'Une patte vous envoie au sol. Le ciel bascule, les côtes crient, le moral aussi.', deltas: { hp: -11, moral: -4 } },
        ),
      },
      {
        id: 'piege',
        label: 'Utiliser le terrain contre lui',
        outcomes: trio(
          { text: 'Racines, pente, surprise. Beau travail — la bête s’écroule sans comprendre le piège.', deltas: { cap: 3, spd: 2, or: 5 } },
          { text: 'Le piège aide un peu. Assez pour finir, pas assez pour vous laisser intact.', deltas: { cap: 1, hp: -3 } },
          { text: 'Vous tombez dans votre propre embuscade. L’ours n’a même pas besoin d’essayer.', deltas: { hp: -8, moral: -3 } },
        ),
      },
      {
        id: 'recul',
        label: 'Reculer vers la clairière',
        outcomes: trio(
          { text: 'Vous sauvez votre peau… et un peu d’orgueil. La clairière accueille votre souffle court.', deltas: { moral: 1, hp: 1 } },
          { text: 'Retraite propre. Pas de gloire, pas de honte — juste le sentier sous vos bottes.', deltas: {} },
          { text: 'L’ours vous poursuit jusqu’au sentier. Branches cassées, panique, griffes trop proches.', deltas: { hp: -6, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'classement_pvp',
    title: 'Classement PvP',
    text: 'Les duels classés appellent. Chaque défaite s’affiche. Chaque victoire aussi — le tableau ne ment jamais.',
    rarity: 'uncommon',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'grimper',
        label: 'Enchaîner les duels pour grimper',
        outcomes: trio(
          { text: 'Série gagnante. Votre rang monte — les noms sous le vôtre tremblent un peu.', deltas: { renommee: 8, auto: 3, hp: -6, trophies: { pvp: 1 } } },
          { text: 'Équilibre victoires / défaites. Le classement bouge à peine ; vos bleus, beaucoup.', deltas: { renommee: 2, hp: -4 } },
          { text: 'Dégringolade. Le classement est cruel : chiffres en chute, gorge serrée, arène froide.', deltas: { renommee: -6, moral: -7, hp: -5 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier les styles du top',
        outcomes: trio(
          { text: 'Vous adaptez une garde du haut du tableau — un angle volé aux meilleurs, déjà dans vos muscles.', deltas: { cap: 3, spd: 2 } },
          { text: 'Quelques idées notées au bas d’une page. Pas de révolution, juste un peu plus d’œil.', deltas: { cap: 1 } },
          { text: 'Trop d’infos. Paralysie : chaque style contredit l’autre, votre propre garde hésite.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'pause',
        label: 'Rester hors du classement cette saison',
        outcomes: trio(
          { text: 'Repos stratégique. Vous revenez frais — muscles calmes, tête claire, soif intacte.', deltas: { hp: 5, moral: 2 } },
          { text: 'Vous regardez les autres progresser. Un pincement discret, rien de plus.', deltas: { moral: -1 } },
          { text: 'On vous oublie du tableau. Votre nom s’efface comme une craie sous la pluie.', deltas: { renommee: -3 } },
        ),
      },
    ],
  },
  {
    id: 'golem_os',
    title: 'Golem squelettique',
    text: 'Dans la galerie d’os de la Tour du Mage, quelque chose s’assemble. Vertèbres qui cliquettent, souffle froid.',
    rarity: 'uncommon',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'briser',
        label: 'Briser le noyau avant qu’il se forme',
        outcomes: trio(
          { text: 'Les os s’effondrent en pluie blanche. Vous grimpez — poussière dans la gorge, magie dans le sang.', deltas: { cap: 4, auto: 2, hp: -4 } },
          { text: 'Combat long. Victoire. Chaque vertèbre cède trop lentement ; vous tenez quand même.', deltas: { cap: 2, hp: -6 } },
          { text: 'Le golem se referme sur vous. Cage d’os, pression sourde, panique qui mord.', deltas: { hp: -10, moral: -4 } },
        ),
      },
      {
        id: 'detour',
        label: 'Contourner la galerie',
        outcomes: trio(
          { text: 'Détour intelligent. Un passif mineur pulse dans une alcôve — vous le prenez sans bruit.', deltas: { cap: 2, or: 3 } },
          { text: 'Vous perdez un étage de temps. Escaliers, couloirs, souffle court — rien d’autre.', deltas: { hp: -2 } },
          { text: 'Cul-de-sac. Le golem vous attendait — cliquetis derrière vous, trop tard pour fuir.', deltas: { hp: -8, moral: -3 } },
        ),
      },
      {
        id: 'nain',
        label: 'Frapper comme un forgeron nain',
        ifRace: ['Nain'],
        outcomes: trio(
          { text: 'Un coup. Le crâne éclate. Le savoir-faire de la Forge Ornn parle à travers vos bras.', deltas: { auto: 5, def: 2, renommee: 2 } },
          { text: 'Bon travail de masse. L’os cède par à-coups ; vous sortez essoufflé mais debout.', deltas: { auto: 2, hp: -3 } },
          { text: 'L’os est plus dur que prévu. Vos poignets vibrent, l’orgueil nain aussi.', deltas: { hp: -7, moral: -2 } },
        ),
      },
      {
        id: 'briseur',
        label: 'Étouffer sa magie d’animation',
        ifClass: ['Briseur de Sort', 'Mage'],
        outcomes: trio(
          { text: 'L’égide coupe le fil. Silence d’os — la galerie retombe dans un calme de tombeau.', deltas: { cap: 5, renommee: 2 } },
          { text: 'Magie affaiblie, combat plus simple. Le golem titube ; vous finissez le travail.', deltas: { cap: 2 } },
          { text: 'Le golem ignore votre égide. Vos runes claquent dans le vide — puis les os vous trouvent.', deltas: { cap: -1, hp: -6 } },
        ),
      },
    ],
  },
  {
    id: 'college_koro',
    title: 'Collège Kunugigaoka',
    text: 'Des sous-classes étranges s’enseignent ici. Le professeur sourit trop — et le tableau noir sent encore le sort.',
    rarity: 'uncommon',
    tags: ['donjons'],
    options: [
      {
        id: 'cours',
        label: 'Suivre un cours intensif',
        outcomes: trio(
          { text: 'Leçon assimilée. Votre style s’affine — chaque geste un peu plus propre, un peu plus mortel.', deltas: { cap: 3, spd: 2, moral: 2 } },
          { text: 'Vous retenez l’essentiel. Assez pour ne pas ridiculiser le Collège… ni vous.', deltas: { cap: 1 } },
          { text: 'Trop de théories. Maux de tête : formules qui tournent, craie qui grince, moral à plat.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'examen',
        label: 'Passer l’examen surprise',
        outcomes: trio(
          { text: 'Réussi. Le collège applaudit — même Koro Sensei semble… presque fier.', deltas: { renommee: 5, cap: 2, or: 4 } },
          { text: 'Juste la moyenne. Un tampon tiède, un regard neutre, rien qui restera au Hall of Fame.', deltas: { renommee: 1 } },
          { text: 'Échec. Tableau noir de la honte — votre nom y brille trop fort, pour de mauvaises raisons.', deltas: { renommee: -3, moral: -5 } },
        ),
      },
      {
        id: 'fugue',
        label: 'Sécher pour explorer les couloirs',
        outcomes: trio(
          { text: 'Cachette secrète. Petit trésor sous une dalle — pièces tièdes, sourire de voleur.', deltas: { or: 8, spd: 1 } },
          { text: 'Couloirs vides, casiers fermés. Vous rentrez sans butin, juste la poussière aux genoux.', deltas: {} },
          { text: 'Pris sur le fait. Punition sèche — regard du prof, moral en chute, réputation ébréchée.', deltas: { moral: -4, renommee: -2 } },
        ),
      },
    ],
  },
  {
    id: 'rat_grimoires',
    title: 'Rat des grimoires',
    text: 'Au hall de la Tour, un rat vole un parchemin… magique. Griffes, squeaks, runes qui traînent dans la poussière.',
    rarity: 'common',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'courir',
        label: 'Courir après le rat',
        outcomes: trio(
          { text: 'Vous récupérez le parchemin. Sagesse mineure — une rune tiède encore dans vos doigts.', deltas: { cap: 3, spd: 2 } },
          { text: 'Course absurde. Parchemin déchiré à moitié — assez pour lire une ligne, pas le sort entier.', deltas: { cap: 1, hp: -2 } },
          { text: 'Vous trébuchez. Le rat s’enfuit — rires d’étudiants, genoux en sang, orgueil à terre.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'piege',
        label: 'Appâter le rat avec une miette',
        outcomes: trio(
          { text: 'Le rat négocie. Vous gagnez une rune — échange absurde, magie réelle.', deltas: { cap: 2, or: 2, charisme: 1 } },
          { text: 'Il prend la miette… et part. Queue en l’air, parchemin perdu, faim un peu moins forte.', deltas: { or: -1 } },
          { text: 'Plus de rats. Chaos. Une marée de griffes, de cris, de parchemins qui volent partout.', deltas: { hp: -4, moral: -2 } },
        ),
      },
      {
        id: 'ignorer',
        label: 'Ignorer et monter',
        outcomes: trio(
          { text: 'Focus. Vous gagnez un étage sans détour — le souffle régulier, l’esprit déjà plus haut.', deltas: { renommee: 1, hp: 1 } },
          { text: 'Vous montez. Rien de spécial — juste les marches, l’écho, et le doute qui traîne.', deltas: {} },
          { text: 'Le parchemin vous manquera plus tard. Vous le sentez déjà, comme un trou dans la poche.', deltas: { moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'blessure',
    title: 'Blessure tenace',
    text: 'Une entaille refuse de se fermer. Vos PV vacillent — chaque pas tire un fil rouge sous le bandage.',
    rarity: 'uncommon',
    tags: ['social'],
    options: [
      {
        id: 'soigner',
        label: 'Chercher un soigneur à la Taverne',
        outcomes: trio(
          { text: 'Mains expertes. Vous respirez à nouveau — chaleur dans la plaie, bière offerte, soulagement vrai.', deltas: { hp: 12, or: -5, moral: 3 } },
          { text: 'Pansement correct. La douleur baisse d’un cran ; la facture, elle, reste nette.', deltas: { hp: 6, or: -2 } },
          { text: 'Mauvais remède. Ça empire — fièvre sourde, or parti, confiance en moins.', deltas: { hp: -4, or: -3, moral: -2 } },
        ),
      },
      {
        id: 'forcer',
        label: 'Combattre quand même',
        outcomes: trio(
          { text: 'La douleur vous aiguise. Chaque coup part plus net, plus cruel — la plaie devient carburant.', deltas: { auto: 3, hp: -5, moral: 2 } },
          { text: 'Vous tenez… juste. Assez pour finir le duel, pas assez pour sourire après.', deltas: { hp: -3 } },
          { text: 'La blessure s’ouvre. Effondrement — genoux au sol, vision qui blanchit, arène qui tourne.', deltas: { hp: -14, moral: -6 } },
        ),
      },
      {
        id: 'healer',
        label: 'Vous soigner vous-même',
        ifClass: ['Healer', 'Alchimiste'],
        outcomes: trio(
          { text: 'Votre art vous sauve. Élégance : lumière douce, plaie qui se referme, main qui ne tremble plus.', deltas: { hp: 10, cap: 2 } },
          { text: 'Soin partiel. La brûlure baisse ; il reste une ligne rouge et un goût d’herbes amères.', deltas: { hp: 5 } },
          { text: 'Mauvais dosage. Vertiges — le monde penche, votre propre magie vous trahit un instant.', deltas: { hp: -3, moral: -2 } },
        ),
      },
      {
        id: 'repos',
        label: 'Rester alité une saison',
        outcomes: trio(
          { text: 'Guérison complète. Patience récompensée — cicatrice nette, corps prêt, nom un peu oublié.', deltas: { hp: 14, moral: 2, renommee: -1 } },
          { text: 'Vous récupérez. Lentes journées, lit trop dur, mais le sang circule enfin sans douleur.', deltas: { hp: 7 } },
          { text: 'L’inactivité ronge le moral. Les autres combattent ; vous comptez les planches du plafond.', deltas: { hp: 3, moral: -5, renommee: -2 } },
        ),
      },
    ],
  },
  {
    id: 'salameche_red',
    title: 'Salamèche dans l’arène',
    text: 'Chez Red, une flamme cracheuse bloque le passage. Petite. Vicieuse. L’air sent déjà le poil brûlé.',
    rarity: 'uncommon',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'eau',
        label: 'Étouffer la flamme d’un sort d’eau',
        outcomes: trio(
          { text: 'Vapeur. Le chemin s’ouvre — sifflement, cendre mouillée, et Red qui hoche ailleurs.', deltas: { cap: 3, or: 4, renommee: 2 } },
          { text: 'La flamme baisse… puis revient. Vous avancez à demi brûlé, à demi victorieux.', deltas: { cap: 1, hp: -3 } },
          { text: 'Vous ratez. Brûlure — peau qui claque, odeur amère, moral qui fond avec la manche.', deltas: { hp: -8, moral: -2 } },
        ),
      },
      {
        id: 'corps',
        label: 'Passer en force',
        outcomes: trio(
          { text: 'Vous encaissez et tranchez. Feu sur l’épaule, lame juste — le passage est à vous.', deltas: { def: 3, auto: 2, hp: -4 } },
          { text: 'Passage brûlant. Vous traversez en courant, cicatrices chaudes, butin tiède au bout.', deltas: { hp: -5, or: 2 } },
          { text: 'Trop de feu. Recul. La flamme vous chasse comme un chien, crachats et honte.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'turtle',
        label: 'Avancer sous carapace',
        ifRace: ['Turtlekin', 'Écailleux', 'Dragonkin'],
        outcomes: trio(
          { text: 'Les flammes glissent. Avancée royale — écailles qui luisent, feu qui glisse, orgueil intact.', deltas: { def: 5, renommee: 2 } },
          { text: 'Vous tiédisez, mais avancez. La carapace tient ; la chaleur, elle, s’installe quand même.', deltas: { def: 2, hp: -2 } },
          { text: 'Même la carapace chauffe trop. Vous sortez fumant, plus lent, moins fier.', deltas: { hp: -7 } },
        ),
      },
    ],
  },
  {
    id: 'arme_commune',
    title: 'Coffre d’arme',
    text: 'Dans la Grotte aux merveilles, un coffre grince. Une arme commune pulse faiblement — fer tiède, promesse courte.',
    rarity: 'uncommon',
    tags: ['donjons', 'loot'],
    options: [
      {
        id: 'prendre',
        label: 'S’équiper immédiatement',
        outcomes: trio(
          { text: 'L’arme s’accorde à votre main. Le poids tombe juste ; le premier coup sonne déjà plus vrai.', deltas: { auto: 3, or: 2 } },
          { text: 'Correcte. Rien de plus — une garde banale, un tranchant honnête, pas de romance.', deltas: { auto: 1 } },
          { text: 'Mauvaise balance. Vous la jetez — le fer ment, votre poignet aussi, rage discrète.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'vendre',
        label: 'La revendre à la Taverne',
        outcomes: trio(
          { text: 'Bon prix. La bourse chante — pièces qui cognent, regard du marchand un peu trop jaloux.', deltas: { or: 12, charisme: 1 } },
          { text: 'Prix moyen. Assez pour une tournée, pas assez pour rêver à la Forge Ornn.', deltas: { or: 5 } },
          { text: 'On vous arnaque. Sourire trop large, pièce trop légère — vous le sentez trop tard.', deltas: { or: 1, moral: -3 } },
        ),
      },
      {
        id: 'offrir_ornn',
        label: 'La garder pour Ornn',
        outcomes: trio(
          { text: 'Ornn appréciera le matériau. Vous le sentez déjà — le fer veut redevenir quelque chose.', deltas: { moral: 2, def: 1 } },
          { text: 'Vous trimballez du fer inutile… pour l’instant. Le poids tire, la promesse attend.', deltas: {} },
          { text: 'Vous la perdez en route. Un trou dans le sac, et la Forge qui n’aura rien de vous ce jour-là.', deltas: { moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'hall_of_fame',
    title: 'Hall of Fame',
    text: 'Les noms des vainqueurs brillent. Le vôtre… pas encore. Ou si ? La pierre froide attend une nouvelle gravure.',
    rarity: 'rare',
    tags: ['tournoi', 'social'],
    options: [
      {
        id: 'contempler',
        label: 'Contempler les légendes',
        outcomes: trio(
          { text: 'L’inspiration vous traverse. Les lettres dorées brûlent derrière vos yeux — vous voulez y être.', deltas: { moral: 6, renommee: 2, auto: 1 } },
          { text: 'Respect silencieux. Vous lisez, vous hochez, vous repartez sans bruit ni serment.', deltas: { moral: 2 } },
          { text: 'L’ombre des grands vous écrase. Chaque nom pèse une défaite que vous n’avez pas encore eue.', deltas: { moral: -5 } },
        ),
      },
      {
        id: 'defier',
        label: 'Jurer de graver votre nom',
        outcomes: trio(
          { text: 'Serment tenu en esprit. Vous partez plus dur — mâchoire serrée, geste déjà plus net.', deltas: { renommee: 5, moral: 4, auto: 2 } },
          { text: 'Serment… pour plus tard. Les mots restent tièdes ; l’arène, elle, n’attend pas.', deltas: { moral: 1 } },
          { text: 'Les murs semblent rire. L’écho de votre voix revient trop petit, trop creux.', deltas: { moral: -4, renommee: -1 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier les styles des vainqueurs',
        outcomes: trio(
          { text: 'Vous volez une posture légendaire — hanche, regard, timing. Déjà dans votre ombre.', deltas: { cap: 3, spd: 3, renommee: 2 } },
          { text: 'Quelques notes. Assez pour ajuster une garde, pas assez pour voler une couronne.', deltas: { cap: 1, spd: 1 } },
          { text: 'Trop d’idoles. Vous perdez votre style — chaque copie tue un peu votre propre rythme.', deltas: { moral: -3, auto: -1 } },
        ),
      },
    ],
  },
  {
    id: 'koro_sensei',
    title: 'Koro Sensei',
    text: 'Le professeur du collège propose une « petite » leçon. Sa vitesse déchire l’air — sourire trop large, ombre trop vite.',
    rarity: 'rare',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'duel',
        label: 'Accepter le duel pédagogique',
        outcomes: trio(
          { text: 'Vous touchez… une fois. Il applaudit. Cette seule touche vaut dix combats ordinaires.', deltas: { spd: 6, renommee: 6, hp: -7 } },
          { text: 'Leçon rude. Vous tenez — bleus, souffle court, et une vitesse un peu moins ridicule.', deltas: { spd: 2, hp: -8 } },
          { text: 'Vous ne voyez même pas les coups. Le sol arrive avant la pensée ; le moral aussi.', deltas: { hp: -12, moral: -5 } },
        ),
      },
      {
        id: 'ecouter',
        label: 'Écouter le cours sans combattre',
        outcomes: trio(
          { text: 'Conseil d’assassin. Précieux — un angle, un silence, une mort propre entre deux phrases.', deltas: { cap: 3, spd: 3, moral: 2 } },
          { text: 'Cours correct. Vous retenez l’essentiel sans que le Collège vous remarque vraiment.', deltas: { cap: 1 } },
          { text: 'Vous décrochez. Interrogation surprise — silence gênant, craie qui tombe, ego à terre.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'elfe',
        label: 'Tenter de matcher sa vitesse',
        ifRace: ['Elfe', 'Gnome'],
        outcomes: trio(
          { text: 'Presque. Il s’incline, amusé — vos pieds ont goûté sa cadence, et ça change tout.', deltas: { spd: 7, renommee: 4 } },
          { text: 'Vous suivez… un temps. Puis l’air se déchire encore, et vous restez un souffle derrière.', deltas: { spd: 3, hp: -4 } },
          { text: 'Humiliation éclair. Vous êtes un statue ; lui, un trait jaune qui rit déjà ailleurs.', deltas: { moral: -6, hp: -5 } },
        ),
      },
    ],
  },
  {
    id: 'licorne_sanctuaire',
    title: 'Sanctuaire de la Licorne',
    text: 'Au cœur de la Forêt, la Licorne attend. Pureté… ou orgueil. La lumière filtre en lames argentées.',
    rarity: 'rare',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'affronter',
        label: 'L’affronter pour sa faveur',
        outcomes: trio(
          { text: 'Elle s’incline. Magie pure en vous — corne qui brille, souffle calme, forêt qui approuve.', deltas: { cap: 6, renommee: 5, or: 6, trophies: { donjon: 1 } } },
          { text: 'Duel égal. Elle part sans colère — feuilles remuées, respect tiède, plaies légères.', deltas: { cap: 2, hp: -5 } },
          { text: 'Sa corne vous repousse hors du sanctuaire. Lumière qui brûle, genoux dans la mousse, honte.', deltas: { hp: -10, moral: -4 } },
        ),
      },
      {
        id: 'offrir',
        label: 'Offrir une offrande de respect',
        outcomes: trio(
          { text: 'Elle bénit votre voie. Une chaleur douce court sous la peau — comme une promesse tenue.', deltas: { moral: 5, cap: 3, hp: 4 } },
          { text: 'Elle accepte… froidement. Un hochement, pas de miracle ; juste le droit de repartir.', deltas: { moral: 2 } },
          { text: 'Offrande jugée impure. Son regard vous juge plus fort qu’un coup — vous reculez.', deltas: { moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'sylvari',
        label: 'Parler le langage de la sève',
        ifRace: ['Sylvari'],
        outcomes: trio(
          { text: 'La forêt traduit. Alliance rare — racines, souffle, et une magie qui vous reconnaît enfin.', deltas: { cap: 5, def: 3, hp: 3 } },
          { text: 'Compréhension partielle. Quelques mots de sève ; le reste reste silence vert.', deltas: { cap: 2 } },
          { text: 'Même la sève se tait. Votre langue raciale sonne creux — la Licorne détourne la tête.', deltas: { moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'tournoi_anciens',
    title: 'Tournoi des anciens',
    text: 'Un tournoi spécial convoque les vieux champions. L’arène tremble autrement — poussière d’âge, cris neufs.',
    rarity: 'rare',
    tags: ['tournoi', 'combat'],
    options: [
      {
        id: 'entrer',
        label: 'Entrer contre les anciens',
        outcomes: trio(
          { text: 'Vous renversez un mythe. L’arène hurle — le Hall of Fame penche déjà vers votre nom.', deltas: { renommee: 12, auto: 4, hp: -8, trophies: { tournoi: 1 } } },
          { text: 'Belle défaite face à un géant. Le public retient votre chute ; vous, la leçon.', deltas: { renommee: 3, hp: -6 } },
          { text: 'Balayé au premier échange. Trop vieux, trop forts — votre garde n’existe même pas.', deltas: { hp: -11, moral: -6, renommee: -2 } },
        ),
      },
      {
        id: 'servir',
        label: 'Servir d’écuyer à un ancien',
        outcomes: trio(
          { text: 'Il vous enseigne une garde oubliée. Main sur l’épaule, secret de champion — vous croissez.', deltas: { def: 4, charisme: 3, or: 4 } },
          { text: 'Travail discret, pourboire discret. Vous portez, vous polissez, vous apprenez peu.', deltas: { or: 3 } },
          { text: 'Il vous ignore. Frustration — vous n’êtes qu’une ombre qui porte son bouclier trop lourd.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'parier',
        label: 'Parier sur le choc des légendes',
        outcomes: trio(
          { text: 'Cote folle. Bourse pleine — les pièces chantent plus fort que les coups dans l’arène.', deltas: { or: 18, charisme: 2 } },
          { text: 'Gain modeste. Assez pour une tournée à la Taverne, pas de quoi changer votre destin.', deltas: { or: 4 } },
          { text: 'Les légendes vous ruinent. La table de paris vous vide plus vite qu’un sort de Mage.', deltas: { or: -14, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'arc_cieux',
    title: 'Arc des Cieux',
    text: 'Une rumeur : l’Arc des Cieux aurait été aperçu au sommet d’une tour oubliée. Vent froid, corde qui chante.',
    rarity: 'rare',
    tags: ['loot', 'donjons', 'arme'],
    requiresWeaponFamily: 'arc',
    options: [
      {
        id: 'grimper',
        label: 'Escalader la tour',
        outcomes: trio(
          { text: 'L’arc pulse entre vos mains. Ciel bas, corde tendue — la lignée vous reconnaît enfin.', deltas: { spd: 5, auto: 3, renommee: 4 } },
          { text: 'Vous trouvez une corde… pas l’arc. Assez pour tirer mieux ; pas assez pour devenir mythe.', deltas: { spd: 2, or: 3 } },
          { text: 'Chute. L’arc reste un mythe — pierre qui frappe, souffle coupé, rêve qui s’effondre.', deltas: { hp: -10, moral: -4 } },
        ),
      },
      {
        id: 'archer',
        label: 'Tenter l’accord parfait',
        ifClass: ['Archer'],
        outcomes: trio(
          { text: 'L’arc vous choisit. Flèches bénies — chaque trait semble déjà connaître la cible.', deltas: { spd: 7, auto: 3, renommee: 5 } },
          { text: 'Accord partiel. La corde vibre juste… puis se tait, comme une promesse inachevée.', deltas: { spd: 3 } },
          { text: 'L’arc refuse votre main. Froid soudain, doigts engourdis, orgueil d’archer à terre.', deltas: { moral: -5 } },
        ),
      },
      {
        id: 'laisser',
        label: 'Laisser l’arc à son sommeil',
        outcomes: trio(
          { text: 'Respect. Une plume céleste tombe à vos pieds — légère, tiède, déjà magique.', deltas: { cap: 3, moral: 3 } },
          { text: 'Vous repartez vides. Le vent de la tour siffle ; l’arc, lui, reste endormi.', deltas: {} },
          { text: 'Un autre s’en empare. Regret — vous entendez la corde chanter… dans d’autres mains.', deltas: { moral: -4, renommee: -1 } },
        ),
      },
    ],
  },
  {
    id: 'gungnir',
    title: 'Gungnir',
    text: 'La lance qui ne rate jamais. On dit qu’elle choisit son porteur — haste runique, promesse de ligne droite.',
    rarity: 'rare',
    tags: ['forge', 'loot', 'arme'],
    requiresWeaponFamily: 'lance',
    options: [
      {
        id: 'lancer',
        label: 'Tenter le lancer rituel',
        outcomes: trio(
          { text: 'La lance revient. Elle vous accepte — sifflement, chaleur au poignet, certitude cruelle.', deltas: { auto: 5, spd: 3, renommee: 4 } },
          { text: 'Presque. Elle vibre… puis se tait. Le rituel a goûté votre bras sans encore le choisir.', deltas: { auto: 2 } },
          { text: 'Elle vous fuit. Doigts brûlés — la ligne droite vous a jugé trop courbe.', deltas: { hp: -6, moral: -4 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier les runes de la haste',
        outcomes: trio(
          { text: 'Compréhension. Votre prochaine frappe portera plus loin — les runes vous ont parlé vrai.', deltas: { cap: 4, auto: 2 } },
          { text: 'Runes partiellement lues. Un fragment de sens, assez pour ajuster un lancer.', deltas: { cap: 1 } },
          { text: 'Les runes mentent. Vertige — symboles qui tournent, estomac qui suit, foi qui lâche.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'guerrier',
        label: 'Planter Gungnir comme un étendard',
        ifClass: ['Guerrier', 'Paladin'],
        outcomes: trio(
          { text: 'L’étendard tient. Moral de troupe — autour de vous, les regards se redressent.', deltas: { renommee: 5, charisme: 3, auto: 2 } },
          { text: 'Geste symbolique. Beau, court — la lance ne reste plantée que le temps d’un souffle.', deltas: { charisme: 1 } },
          { text: 'La lance refuse de rester plantée. Elle tombe ; avec elle, un peu de votre stature.', deltas: { moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'ronflex_red',
    title: 'Ronflex endormi',
    text: 'Dans l’arène de Red, un Ronflex bloque tout le couloir. Il ronfle. Fort. Le sol vibre à chaque expiration.',
    rarity: 'rare',
    tags: ['donjons'],
    options: [
      {
        id: 'reveiller',
        label: 'Le réveiller… doucement',
        outcomes: trio(
          { text: 'Il s’écarte. Chemin libre + baie mystérieuse — douceur sucrée, passage enfin ouvert.', deltas: { or: 8, hp: 3, renommee: 2 } },
          { text: 'Il grogne, puis se rendort ailleurs. Vous glissez dans l’espace libre, cœur battant.', deltas: { or: 2 } },
          { text: 'Il se lève de travers. Charge — masse, odeur, et vous contre le mur comme une puce.', deltas: { hp: -11, moral: -4 } },
        ),
      },
      {
        id: 'grimper',
        label: 'Grimper par-dessus',
        outcomes: trio(
          { text: 'Escalade absurde réussie. Fourrure sous les doigts, équilibre de funambule, rires étouffés.', deltas: { spd: 3, charisme: 2 } },
          { text: 'Vous glissez, mais passez. Une chute molle, un genou meurtri, le couloir enfin libre.', deltas: { hp: -3 } },
          { text: 'Il se retourne. Vous tombe dessus — noir soudain, poids du monde, moral en miettes.', deltas: { hp: -12, moral: -5 } },
        ),
      },
      {
        id: 'attendre',
        label: 'Attendre qu’il bouge',
        outcomes: trio(
          { text: 'Patience. Il part seul. Vous méditez — souffle calme, ronflement qui s’éloigne, paix rare.', deltas: { moral: 4, hp: 2 } },
          { text: 'Longue attente. Les heures traînent ; vous gagnez un peu de repos, rien d’éclatant.', deltas: { hp: 1 } },
          { text: 'Des heures perdues. Frustration — chaque ronflement vous rappelle que le temps fuit sans vous.', deltas: { moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'mjollnir',
    title: 'Mjöllnir',
    text: 'Le marteau de guerre attend dans la Forge. Seuls les dignes le soulèvent — tonnerre distant, enclume chaude.',
    rarity: 'epic',
    tags: ['forge', 'arme'],
    requiresWeaponFamily: 'marteau',
    options: [
      {
        id: 'soulever',
        label: 'Tenter de soulever Mjöllnir',
        outcomes: trio(
          { text: 'Le marteau se lève. Le tonnerre applaudit — foudre dans le bras, Forge Ornn qui retient son souffle.', deltas: { auto: 8, def: 4, renommee: 8, trophies: { forge: 1 } } },
          { text: 'Il bouge… d’un pouce. Assez pour croire ; pas assez pour régner. Vos tendons crient.', deltas: { auto: 3, hp: -6 } },
          { text: 'Immobile. Humiliation divine — le métal vous juge, et la Forge entière l’entend.', deltas: { moral: -8, renommee: -3, hp: -4 } },
        ),
      },
      {
        id: 'ornn',
        label: 'Demander le jugement d’Ornn',
        outcomes: trio(
          { text: 'Ornn hoche. Une rune de foudre vous marque — peau chaude, regard du dieu, destin scellé.', deltas: { auto: 5, cap: 3, renommee: 4 } },
          { text: '« Reviens plus fort. » La voix gronde. Pas de refus net — juste un défi qui reste ouvert.', deltas: { moral: 1 } },
          { text: 'Silence glacial. Les soufflets s’arrêtent ; même le feu semble détourner la tête.', deltas: { moral: -5 } },
        ),
      },
      {
        id: 'nain',
        label: 'Invoquer le droit des forgerons',
        ifRace: ['Nain', 'Dragonkin'],
        outcomes: trio(
          { text: 'Le sang de la forge répond. Mjöllnir cède — ancestralité, chaleur, et foudre dans la paume.', deltas: { auto: 7, def: 3, renommee: 5 } },
          { text: 'Presque digne. Le marteau frémit ; vos ancêtres auraient voulu plus… et moins de douleur.', deltas: { auto: 3, hp: -4 } },
          { text: 'Même le droit ancestral ne suffit pas. Le fer reste sourd ; votre lignée aussi, ce jour-là.', deltas: { moral: -6, hp: -3 } },
        ),
      },
    ],
  },
  {
    id: 'codex_archon',
    title: 'Codex Archon',
    text: 'Un tome interdit pulse au sommet nécromant. Lire, c’est risquer l’esprit — pages noires, savoir qui mord.',
    rarity: 'epic',
    tags: ['magie', 'donjons', 'arme'],
    requiresWeaponFamily: 'tome',
    options: [
      {
        id: 'lire',
        label: 'Ouvrir le Codex',
        outcomes: trio(
          { text: 'Savoir interdit. Votre magie mute — mots qui brûlent, pouvoir qui s’ancre, un prix déjà payé.', deltas: { cap: 9, renommee: 5, moral: -2, trophies: { tour: 1 } } },
          { text: 'Quelques pages. Assez — une formule tenue, une migraine sourde, le livre déjà trop lourd.', deltas: { cap: 4, hp: -3 } },
          { text: 'L’esprit se fissure. Fermez le livre — murmures, sang au nez, Tour du Mage qui rit trop bas.', deltas: { cap: 1, moral: -9, hp: -5 } },
        ),
      },
      {
        id: 'copier',
        label: 'Copier une rune sans lire le reste',
        outcomes: trio(
          { text: 'Rune stable. Gain propre — tracé net, pouvoir contenu, aucune voix dans votre tête.', deltas: { cap: 5, spd: 2 } },
          { text: 'Copie imparfaite. Le trait tremble ; la rune tient… à condition de ne pas trop forcer.', deltas: { cap: 2 } },
          { text: 'La rune vous brûle la main. Encre qui fume, peau qui claque, leçon trop chère.', deltas: { hp: -7, moral: -3 } },
        ),
      },
      {
        id: 'mindflayer',
        label: 'Absorber une page par l’esprit',
        ifRace: ['Mindflayer'],
        outcomes: trio(
          { text: 'La page devient vôtre. Terrifiant — savoir qui s’installe comme une seconde voix.', deltas: { cap: 10, renommee: 4 } },
          { text: 'Absorption partielle. Fragments de sens, goût de métal, soif d’en savoir encore trop.', deltas: { cap: 4 } },
          { text: 'Retour de bâton mental. Votre crâne sonne comme une cloche ; le Codex a mordu plus fort.', deltas: { moral: -8, hp: -4 } },
        ),
      },
      {
        id: 'sorciere',
        label: 'Sceller le Codex d’une malédiction',
        ifClass: ['Sorcière', 'Demoniste'],
        outcomes: trio(
          { text: 'Le sceau tient. Pouvoir détourné — le livre obéit à votre ombre, pas l’inverse.', deltas: { cap: 6, charisme: 3, renommee: 3 } },
          { text: 'Sceau fragile. Il tiendra… jusqu’à la prochaine page trop curieuse.', deltas: { cap: 2 } },
          { text: 'Le Codex renvoie la malédiction. Votre propre sort vous revient au visage — amer, juste.', deltas: { moral: -6, hp: -5 } },
        ),
      },
    ],
  },
  {
    id: 'faux_thanatos',
    title: 'Faux de Thanatos',
    text: 'Une faux d’ombre traîne dans un couloir du Labyrinthe. Elle murmure des fins — métal froid, voix trop proches.',
    rarity: 'epic',
    tags: ['ombres', 'loot', 'arme'],
    requiresWeaponFamily: 'faux',
    options: [
      {
        id: 'brandir',
        label: 'Brandir la faux',
        outcomes: trio(
          { text: 'Thanatos sourit. Votre ombre s’allonge — la lame chante la fin des autres, pas encore la vôtre.', deltas: { auto: 6, cap: 4, renommee: 6, moral: -2 } },
          { text: 'L’arme obéit… à moitié. Coups nets, murmures persistants, un prix encore flou.', deltas: { auto: 3, hp: -4 } },
          { text: 'Elle veut votre âme en acompte. Froid dans la poitrine, genoux mous, Labyrinthe qui se tait.', deltas: { hp: -10, moral: -7 } },
        ),
      },
      {
        id: 'sceller',
        label: 'La sceller dans un coffre',
        outcomes: trio(
          { text: 'Sagesse. Une bénédiction discrète vous suit — silence retrouvé, ombre un peu moins longue.', deltas: { moral: 5, def: 2, renommee: 2 } },
          { text: 'Coffre fermé. Silence. Le couloir reprend son souffle ; vous aussi, à peine.', deltas: { moral: 1 } },
          { text: 'Le murmure continue la nuit. Derrière le bois, la faux parle encore — et vous écoutez.', deltas: { moral: -5 } },
        ),
      },
      {
        id: 'mortvivant',
        label: 'Négocier avec la mort',
        ifRace: ['Mort-vivant'],
        outcomes: trio(
          { text: 'La faux reconnaît les siens. Accord d’ombres — tranchant partagé, silence complice.', deltas: { def: 5, cap: 4, renommee: 4 } },
          { text: 'Accord tiède. Elle vous tolère ; vous tolérez ses murmures. Personne ne sourit.', deltas: { def: 2 } },
          { text: 'Même les morts peuvent être refusés. La faux se détourne — et ça fait plus mal qu’un coup.', deltas: { moral: -6, hp: -4 } },
        ),
      },
    ],
  },
  {
    id: 'eveil_race',
    title: 'Éveil de race',
    text: 'Quelque chose en vous se fissure… puis s’ouvre. L’héritage racial appelle — sang chaud, vieux noms qui se réveillent.',
    rarity: 'epic',
    tags: ['ombres'],
    options: [
      {
        id: 'accepter',
        label: 'Accueillir l’éveil',
        outcomes: trio(
          { text: 'L’héritage s’ancre. Vous n’êtes plus tout à fait le même — puissance, mémoire, peau qui brûle juste.', deltas: { auto: 4, def: 4, cap: 4, spd: 3, renommee: 6 } },
          { text: 'Éveil partiel. Prometteur — un souffle d’ancêtre, une force incomplète, une soif qui reste.', deltas: { auto: 2, cap: 2, hp: -3 } },
          { text: 'Le corps refuse. Douleur sourde — os qui résistent, héritage qui force, vous qui cédez trop tôt.', deltas: { hp: -10, moral: -5 } },
        ),
      },
      {
        id: 'retarder',
        label: 'Retarder l’appel',
        outcomes: trio(
          { text: 'Contrôle. Vous choisissez le moment — la braise reste ; c’est vous qui tenez l’allumette.', deltas: { moral: 4, charisme: 2 } },
          { text: 'L’appel s’éloigne. Silence relatif, héritage en sourdine, rien de gagné ni de perdu.', deltas: {} },
          { text: 'L’héritage s’offense. Faiblesse — quelque chose en vous se détourne, et ça se sent.', deltas: { moral: -4, auto: -1 } },
        ),
      },
      {
        id: 'cendres',
        label: 'Attiser les braises',
        ifRace: ['Cendrés'],
        outcomes: trio(
          { text: 'Les braises deviennent brasier. Chaleur dans les veines, cendre dans l’air, magie qui flambe.', deltas: { cap: 6, auto: 4, renommee: 3 } },
          { text: 'Braises stables. Assez pour chauffer un sort ; pas encore pour brûler un étage.', deltas: { cap: 3 } },
          { text: 'Vous vous consumez trop vite. Peau qui fume, souffle court, braise qui vous mange avant l’ennemi.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'humain',
        label: 'Équilibrer toutes les voies',
        ifRace: ['Humain'],
        outcomes: trio(
          { text: 'Polyvalence absolue. Rare — chaque voie s’ouvre un peu, aucune ne vous refuse.', deltas: { auto: 3, def: 3, cap: 3, spd: 3, renommee: 4 } },
          { text: 'Équilibre correct. Pas de sommet, pas de gouffre — juste un humain qui tient toutes les rênes.', deltas: { auto: 1, cap: 1, spd: 1 } },
          { text: 'Trop dilué. Aucune voie ne s’ouvre — vous touchez tout, vous ne saisissez rien.', deltas: { moral: -5 } },
        ),
      },
    ],
  },
  {
    id: 'corruption_hall',
    title: 'Corruption du Hall',
    text: 'Un ancien champion du Hall of Fame revient… corrompu par le Cataclysme. Son nom brille encore ; son regard, non.',
    rarity: 'epic',
    tags: ['ombres', 'combat', 'cataclysme'],
    options: [
      {
        id: 'affronter',
        label: 'L’affronter pour purifier son nom',
        outcomes: trio(
          { text: 'La corruption cède. Le Hall murmure votre gloire — pierre qui s’éclaircit, mythe rendu propre.', deltas: { renommee: 14, auto: 5, cap: 3, hp: -9, trophies: { cataclysme: 1 } } },
          { text: 'Vous le repoussez. Pas encore vaincu — ombre en retraite, vous en sang, combat à reprendre.', deltas: { renommee: 4, hp: -7 } },
          { text: 'Sa corruption vous marque. Une veine noire sous la peau — le Cataclysme vous a goûté.', deltas: { hp: -13, moral: -7, renommee: 1 } },
        ),
      },
      {
        id: 'raisonner',
        label: 'Tenter de le ramener par la parole',
        outcomes: trio(
          { text: 'Un éclair de lucidité. Il part en paix — larmes noires, nom sauvé, votre voix encore tremblante.', deltas: { charisme: 6, renommee: 6, moral: 4 } },
          { text: 'Il hésite… puis fuit. Vos mots ont ouvert une brèche ; trop étroite pour le sauver.', deltas: { charisme: 2 } },
          { text: 'Vos mots l’enragent. La corruption hurle à travers lui — et vous en prenez le choc.', deltas: { hp: -8, moral: -5 } },
        ),
      },
      {
        id: 'paladin',
        label: 'Riposter la corruption',
        ifClass: ['Paladin', 'Briseur de Sort'],
        outcomes: trio(
          { text: 'Chaque riposte brûle l’ombre. Lumière sèche, égide qui chante, Hall qui respire enfin.', deltas: { def: 5, renommee: 7, auto: 3 } },
          { text: 'Vous tenez la ligne. Assez pour ne pas céder ; pas assez pour purifier tout le Hall.', deltas: { def: 2, hp: -5 } },
          { text: 'La corruption traverse l’égide. Votre lumière vacille — et le noir s’installe un instant.', deltas: { hp: -10, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'double_passif',
    title: 'Fusion de passifs',
    text: 'L’Extension du Territoire offre une fusion rare : deux auras, un seul corps. L’air vibre déjà trop fort.',
    rarity: 'epic',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'fusion',
        label: 'Accepter la double fusion',
        outcomes: trio(
          { text: 'Deux passifs s’entrelacent. Vous devenez unique — auras croisées, territoire qui vous reconnaît.', deltas: { cap: 8, renommee: 7, or: 6, trophies: { extension: 1 } } },
          { text: 'Fusion instable mais utile. Ça tient… tant que vous ne respirez pas trop fort.', deltas: { cap: 4, hp: -5 } },
          { text: 'Rejet. Le territoire vous expulse — sol qui refuse, auras qui hurlent, chute brutale.', deltas: { hp: -12, moral: -6 } },
        ),
      },
      {
        id: 'choisir',
        label: 'N’en garder qu’un, parfaitement',
        outcomes: trio(
          { text: 'Maîtrise pure. Un passif souverain — net, stable, déjà collé à vos gestes comme une seconde peau.', deltas: { cap: 5, moral: 3 } },
          { text: 'Choix correct. Pas de génie, pas de catastrophe — juste une aura qui tient bien.', deltas: { cap: 2 } },
          { text: 'Mauvais choix. Regret immédiat — la mauvaise aura, le mauvais goût, trop tard pour revenir.', deltas: { moral: -4, cap: -1 } },
        ),
      },
      {
        id: 'mage',
        label: 'Forcer une troisième rune',
        ifClass: ['Mage', 'Sorcière', 'Alchimiste'],
        outcomes: trio(
          { text: 'Folie géniale. Trois échos — le territoire plie, votre magie danse, le prix brûle déjà.', deltas: { cap: 10, renommee: 5, hp: -6 } },
          { text: 'La troisième rune cède à moitié. Assez pour briller ; trop pour rester sans cicatrice.', deltas: { cap: 4, hp: -4 } },
          { text: 'Surcharge. Noir. Le territoire claque comme une porte — et vous avec.', deltas: { hp: -14, moral: -6, cap: -2 } },
        ),
      },
    ],
  },
  {
    id: 'etage_120',
    title: 'Étage 120 du Labyrinthe',
    text: 'Le fond du Labyrinthe Infini. Les rois et dieux du couloir ouvrent les yeux — murs vivants, destin trop près.',
    rarity: 'legendary',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'defier',
        label: 'Défier le roi du labyrinthe',
        outcomes: trio(
          { text: 'Le roi tombe. Votre nom devient mythe — couloirs qui s’inclinent, pierre qui retient votre sang.', deltas: { renommee: 18, spd: 6, auto: 5, hp: -12, trophies: { labyrinthe: 1 } } },
          { text: 'Vous survolez… puis fuyez digne. Assez vu pour grandir ; assez saigné pour ne pas rester.', deltas: { renommee: 6, hp: -9, spd: 2 } },
          { text: 'Le labyrinthe se referme sur vous. Murs, ombres, roi qui rit — vous sortez brisé, pas oublié.', deltas: { hp: -16, moral: -8, renommee: 2 } },
        ),
      },
      {
        id: 'pacte',
        label: 'Négocier un pacte avec le couloir',
        outcomes: trio(
          { text: 'Le labyrinthe vous reconnaît. Raccourci éternel — les murs s’écartent pour vous seuls.', deltas: { cap: 7, spd: 5, renommee: 8 } },
          { text: 'Pacte mineur. Un passage plus court, un prix discret — le couloir n’offre jamais tout.', deltas: { cap: 3, or: 5 } },
          { text: 'Le pacte était un piège. Les murs se referment ; vos mots n’avaient jamais valu grand-chose.', deltas: { moral: -7, hp: -8 } },
        ),
      },
      {
        id: 'voleur',
        label: 'Voler un trésor et disparaître',
        ifClass: ['Voleur'],
        outcomes: trio(
          { text: 'Butin légendaire. Personne ne vous a vu — or tiède, ombre propre, sourire de Voleur.', deltas: { or: 25, spd: 5, renommee: 6 } },
          { text: 'Fuite avec un coffre moyen. Assez pour la Taverne, pas pour le Hall of Fame.', deltas: { or: 10, spd: 2 } },
          { text: 'Alarme. Les murs vous chassent — pièges, cris de pierre, course qui finit trop mal.', deltas: { hp: -12, moral: -5 } },
        ),
      },
    ],
  },
  {
    id: 'extinction',
    title: 'EXTINCTION',
    text: 'Le Cataclysme atteint son dixième souffle. Le monde retient le sien — ciel fendu, arène de Red trop loin.',
    rarity: 'legendary',
    tags: ['ombres', 'combat', 'cataclysme'],
    options: [
      {
        id: 'tout',
        label: 'Tout donner contre l’entité',
        outcomes: trio(
          { text: 'Votre nom sauve une ère. Les chroniques tremblent — sang, lumière, et un silence après le monstre.', deltas: { renommee: 22, auto: 6, cap: 5, hp: -14, trophies: { cataclysme: 1 } } },
          { text: 'Vous retardez l’extinction. Assez pour d’autres — votre corps paye, le monde gagne une heure.', deltas: { renommee: 8, hp: -10 } },
          { text: 'Balayé. Le monde continue sans vous… pour l’instant. Cendres dans la bouche, mythe inachevé.', deltas: { hp: -18, moral: -8, renommee: 3 } },
        ),
      },
      {
        id: 'soutien',
        label: 'Coordonner la dernière ligne',
        outcomes: trio(
          { text: 'Votre voix tient l’armée. Victoire collective — ordres nets, cœurs qui suivent, Cataclysme qui cède.', deltas: { charisme: 8, renommee: 12, or: 10 } },
          { text: 'Coordination correcte. La ligne tient ; personne ne chante encore votre nom trop fort.', deltas: { charisme: 3, renommee: 3 } },
          { text: 'Panique. La ligne rompt — cris, fuite, votre voix noyée sous le souffle du monstre.', deltas: { charisme: -4, moral: -7, hp: -6 } },
        ),
      },
      {
        id: 'dragonkin',
        label: 'Opposer le souffle du dragon',
        ifRace: ['Dragonkin', 'Cendrés'],
        outcomes: trio(
          { text: 'Deux souffles s’entrechoquent. Le vôtre tient — chaleur ancestrale contre fin du monde.', deltas: { cap: 8, def: 5, renommee: 10 } },
          { text: 'Vous absorbez une part du choc. Écailles qui craquent, feu contenu, survie digne.', deltas: { def: 3, hp: -8 } },
          { text: 'Votre souffle s’éteint trop tôt. Le Cataclysme avale la flamme — et une part de vous avec.', deltas: { hp: -14, moral: -6 } },
        ),
      },
    ],
  },
  {
    id: 'pointeau_adn',
    title: 'Pointeau ADN',
    text: 'Au bout de l’arène de Red, le Pointeau ADN attend ceux qui ont tout vaincu. Verre froid, destin liquide.',
    rarity: 'legendary',
    tags: ['donjons'],
    options: [
      {
        id: 'prendre',
        label: 'Saisir le Pointeau',
        outcomes: trio(
          { text: 'Le pouvoir change votre essence. Rare. Irréversible — veines qui chantent, Red qui retient son souffle.', deltas: { auto: 5, def: 5, cap: 5, spd: 5, renommee: 12, trophies: { coop: 1 } } },
          { text: 'Le Pointeau pulse… puis se calme. Un goût de possible ; pas encore la métamorphose.', deltas: { auto: 2, cap: 2, renommee: 4 } },
          { text: 'Rejet. Votre corps n’est pas prêt — convulsions, froid, et le Pointeau qui se détourne.', deltas: { hp: -12, moral: -6 } },
        ),
      },
      {
        id: 'partager',
        label: 'Le partager avec votre allié',
        outcomes: trio(
          { text: 'Duo légendaire. Red applaudit — deux mains, un destin, or et gloire qui se partagent juste.', deltas: { charisme: 7, renommee: 10, or: 12, trophies: { coop: 1 } } },
          { text: 'Partage honnête. Pas de mythe, pas de trahison — juste deux parts égales et un silence correct.', deltas: { charisme: 3, or: 5 } },
          { text: 'Jalousie. L’alliance se fissure — regards de travers, doigts qui se crispent sur le verre.', deltas: { charisme: -4, moral: -5 } },
        ),
      },
      {
        id: 'garder',
        label: 'Le sceller pour plus tard',
        outcomes: trio(
          { text: 'Patience de sage. Le sceau vous bénit — pouvoir contenu, esprit clair, Red qui hoche.', deltas: { moral: 6, cap: 3, renommee: 3 } },
          { text: 'Vous repartez les mains vides… pour l’instant. Le Pointeau attend ; vous aussi.', deltas: {} },
          { text: 'Quelqu’un le vole derrière vous. Pas de bruit — juste le vide où le destin aurait dû être.', deltas: { moral: -7, renommee: -3 } },
        ),
      },
    ],
  },
  {
    id: 'ornn_jugement',
    title: 'Jugement d’Ornn',
    text: 'Le Dieu de la Forge convoque les prétendants. Une seule offrande sera reforgée ce jour — feu, enclume, silence divin.',
    rarity: 'legendary',
    tags: ['forge'],
    options: [
      {
        id: 'offrande',
        label: 'Présenter votre arme légendaire',
        outcomes: trio(
          { text: 'Ornn forge. Le métal devient mythe — étincelles, rune, et un poids nouveau dans votre main.', deltas: { auto: 9, def: 5, renommee: 10, or: -8, trophies: { forge: 1 } } },
          { text: 'Il retient l’arme… pour « plus tard ». Jugement suspendu ; votre orgueil, moins.', deltas: { renommee: 3, hp: -4 } },
          { text: 'Indigne. Les soufflets s’éteignent. Même le feu refuse de regarder votre offrande.', deltas: { moral: -8, renommee: -4 } },
        ),
      },
      {
        id: 'defi',
        label: 'Survivre à sa forge brûlante',
        outcomes: trio(
          { text: 'Vous tenez. Une rune d’endurance vous marque — peau brûlée, volonté intacte, Ornn qui approuve.', deltas: { def: 8, auto: 3, renommee: 8, hp: -10, trophies: { forge: 1 } } },
          { text: 'Vous sortez brûlé mais vivant. Assez pour prouver ; pas assez pour forger la légende.', deltas: { def: 3, hp: -9 } },
          { text: 'La chaleur vous brise. Genoux sur l’enclume, vision blanche, Forge qui ne vous retient pas.', deltas: { hp: -16, moral: -7 } },
        ),
      },
      {
        id: 'bastion',
        label: 'Devenir le rempart de l’épreuve',
        ifClass: ['Bastion', 'Paladin'],
        outcomes: trio(
          { text: 'Ornn reconnaît le mur. Reforgé digne — chaque choc enfoncé, chaque pas tenu, métal qui chante.', deltas: { def: 9, renommee: 7, hp: -6 } },
          { text: 'Vous encaissez l’essentiel. Le rempart tremble ; il ne tombe pas… encore.', deltas: { def: 4, hp: -7 } },
          { text: 'Le rempart cède trop tôt. Une faille, un coup de chaleur — et votre ligne rompt.', deltas: { hp: -13, moral: -5 } },
        ),
      },
    ],
  },
  {
    id: 'pendule_chronos',
    title: 'Pendule de Chronos',
    text: 'Un pendule d’argent bat hors du temps. Une saison peut s’étirer… ou se contracter. Tic. Tac. Destin.',
    rarity: 'legendary',
    tags: ['ombres', 'loot'],
    options: [
      {
        id: 'accelerer',
        label: 'Accélérer votre destin',
        outcomes: trio(
          { text: 'Deux saisons d’expérience en un battement — muscles qui se souviennent, cicatrices déjà vieilles.', deltas: { auto: 5, cap: 5, spd: 5, renommee: 8, hp: -6 } },
          { text: 'Léger gain de temps. Assez pour un geste de plus ; pas assez pour voler une ère.', deltas: { spd: 3, cap: 2 } },
          { text: 'Le temps vous mord. Vieilli trop vite — articulations lourdes, miroir cruel, moral en cendre.', deltas: { hp: -12, moral: -5, def: -2 } },
        ),
      },
      {
        id: 'figer',
        label: 'Figer un mauvais présage',
        outcomes: trio(
          { text: 'Le malheur passe à côté. Chance rare — le coup qui devait vous trouver s’égare ailleurs.', deltas: { moral: 8, hp: 6, renommee: 4 } },
          { text: 'Présage atténué. La menace reste ; elle mord moins fort. Vous respirez un peu mieux.', deltas: { moral: 3 } },
          { text: 'Vous figez… votre propre élan. Jambes lourdes, destin en pause, frustration glacée.', deltas: { spd: -2, moral: -4 } },
        ),
      },
      {
        id: 'rendre',
        label: 'Rendre le pendule au silence',
        outcomes: trio(
          { text: 'Chronos approuve. Bénédiction discrète — le tic-tac s’apaise, votre souffle aussi.', deltas: { cap: 4, moral: 5, charisme: 3 } },
          { text: 'Silence. Paix. Le métal se range ; le temps reprend sans vous demander votre avis.', deltas: { moral: 2 } },
          { text: 'Le pendule refuse d’être rendu. Il bat plus fort — et quelque chose en vous se déchire.', deltas: { moral: -5, hp: -3 } },
        ),
      },
    ],
  },

  {
    id: 'arme_upgrade_chemin',
    title: 'L’appel du fer',
    text: 'Votre {arme} vibre. Une forge ambulante, un coffre, un artisan… quelque chose peut la faire évoluer vers {arme_rare}.',
    rarity: 'uncommon',
    tags: ['arme', 'arme_upgrade', 'forge'],
    options: [
      {
        id: 'forger',
        label: 'Confier {arme} à l’artisan',
        outcomes: trio(
          {
            text: 'Le métal se tend. Nouvelle forme — étincelles, marteau juste, et {arme} qui renaît sous vos doigts.',
            deltas: { or: -5, hp: -2 },
            weaponProgress: 'upgrade',
          },
          { text: 'Travail correct, pas de miracle. Le fil s’améliore ; la légende, elle, attend encore.', deltas: { auto: 1, or: -2 } },
          { text: 'Il abîme le pommeau. Rage contenue — fer abîmé, or parti, confiance en l’artisan en cendres.', deltas: { or: -4, moral: -4 } },
        ),
      },
      {
        id: 'coffre',
        label: 'Chercher les plans d’upgrade dans un coffre',
        outcomes: trio(
          {
            text: 'Plans trouvés. Vous appliquez la méthode — schémas nets, métal qui répond, lignée qui avance.',
            deltas: { cap: 1 },
            weaponProgress: 'upgrade',
          },
          { text: 'Plans incomplets. Inspiration tiède — assez pour rêver, pas assez pour forger vrai.', deltas: { cap: 1, or: 2 } },
          { text: 'Piège. Le coffre claque sur vos doigts — sang, jurons, et plans qui s’envolent en cendres.', deltas: { hp: -7, moral: -3 } },
        ),
      },
      {
        id: 'patienter',
        label: 'Garder {arme} telle quelle',
        outcomes: trio(
          { text: 'Patience. Vous affinez votre geste — même sans upgrade, la main apprend encore le fer.', deltas: { moral: 3, spd: 1 } },
          { text: 'Rien ne change vraiment. {arme} reste {arme} ; le destin, lui, bat le pied ailleurs.', deltas: {} },
          { text: 'Vous doutez de votre choix d’arme. Chaque silence de la Forge Ornn pèse un peu plus.', deltas: { moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'arme_legendaire_revelation',
    title: 'Révélation de lignée',
    text: 'Un ancien murmure : la lignée de {arme} culmine en {arme_legendaire}. Très peu y touchent — feu, rune, destin serré.',
    rarity: 'epic',
    tags: ['arme', 'arme_legendaire', 'forge'],
    options: [
      {
        id: 'rituel',
        label: 'Tenter le rituel de lignée',
        outcomes: [
          {
            variant: 'bonus',
            weight: 10,
            text: 'Le ciel de la forge se fend. {arme_legendaire} prend forme — lumière, métal, et votre nom dessus.',
            deltas: { renommee: 6, hp: -8, or: -6, trophies: { forge: 1 } },
            weaponProgress: 'legendary',
          },
          {
            variant: 'neutre',
            weight: 45,
            text: 'Le rituel n’atteint pas le mythe… mais avance d’un cran. La lignée respire encore.',
            deltas: { or: -3, hp: -4 },
            weaponProgress: 'upgrade',
          },
          {
            variant: 'malus',
            weight: 45,
            text: 'Le rituel échoue. Votre esprit vacille — runes qui mentent, forge qui se tait, goût de cendre.',
            deltas: { hp: -10, moral: -6 },
          },
        ],
      },
      {
        id: 'etudier',
        label: 'Étudier les runes sans forcer',
        outcomes: trio(
          { text: 'Compréhension. Votre prochain upgrade sera plus sûr — les runes ont enfin un sens clair.', deltas: { cap: 4, moral: 2 } },
          { text: 'Quelques notes utiles. Assez pour ne pas se brûler ; pas assez pour réveiller la lignée.', deltas: { cap: 1 } },
          { text: 'Les runes mentent. Vertige — symboles qui dansent, foi qui lâche, forge trop loin.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'renoncer',
        label: 'Renoncer au mythe pour cette saison',
        outcomes: trio(
          { text: 'Humilité. La Taverne respecte ça… parfois. Un verre levé, un regard moins dur.', deltas: { charisme: 2, moral: 3 } },
          { text: 'Vous repartez. Pas de mythe, pas de scandale — juste {arme} au côté et la saison qui continue.', deltas: {} },
          { text: 'On murmure lâcheté. Le mot court plus vite que vous jusqu’à l’arène.', deltas: { renommee: -3, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'arme_donjon_echo',
    title: 'Écho d’arme dans le donjon',
    text: 'Au fond d’une salle, un socle porte l’empreinte de {arme_legendaire}. Votre {arme} réagit — métal qui chauffe, destin qui tire.',
    rarity: 'rare',
    tags: ['arme', 'arme_upgrade', 'donjons'],
    options: [
      {
        id: 'poser',
        label: 'Poser {arme} sur le socle',
        outcomes: [
          {
            variant: 'bonus',
            weight: 8,
            text: 'L’empreinte s’empare du métal. Lignée accomplie — lumière basse, {arme_legendaire} qui s’éveille.',
            deltas: { renommee: 5, hp: -5 },
            weaponProgress: 'legendary',
          },
          {
            variant: 'neutre',
            weight: 52,
            text: 'Le socle chauffe. Upgrade stable — pas le mythe encore, mais le fer a changé de ton.',
            deltas: { hp: -3 },
            weaponProgress: 'upgrade',
          },
          {
            variant: 'malus',
            weight: 40,
            text: 'Rejet. Une décharge vous renvoie — pierre froide, bras engourdi, promesse brisée net.',
            deltas: { hp: -9, moral: -4 },
          },
        ],
      },
      {
        id: 'prier',
        label: 'Prier la lignée sans toucher',
        outcomes: trio(
          { text: 'Une bénédiction discrète vous suit — chaleur légère dans la garde, silence respectueux du donjon.', deltas: { moral: 4, cap: 2 } },
          { text: 'Silence respectueux. Les murs n’offrent rien ; votre {arme} ne vibre plus autant.', deltas: { moral: 1 } },
          { text: 'Rien qu’un froid de pierre. L’empreinte reste sourde ; votre prière, trop courte.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'briser',
        label: 'Briser le socle pour le butin',
        outcomes: trio(
          { text: 'Or et fragments. Pas de gloire d’arme — juste le bruit du sac et un peu de honte utile.', deltas: { or: 14, renommee: -1 } },
          { text: 'Quelques pièces. Le socle cède mal ; le butin aussi. Vous repartez avec peu.', deltas: { or: 4 } },
          { text: 'Le socle se venge. Malédiction légère — doigts engourdis, goût de rouille, or trop cher.', deltas: { hp: -8, moral: -3, or: 2 } },
        ),
      },
    ],
  },

  {
    id: 'college_sous_classe',
    title: 'Collège Kunugigaoka — Sous-classe',
    text: 'Koro Sensei ouvre le registre des voies. Une sous-classe peut redéfinir votre classe… si vous en êtes digne.',
    rarity: 'rare',
    tags: ['donjons', 'subclass'],
    options: [
      {
        id: 'placeholder',
        label: 'Écouter le discours d’ouverture',
        outcomes: trio(
          { text: 'Le discours inspire. Les voies s’éclaircissent — chaque sous-classe a déjà un visage dans votre tête.', deltas: { cap: 2, moral: 2 } },
          { text: 'Long discours. Vous retenez l’essentiel entre deux bâillements ; le reste glisse.', deltas: {} },
          { text: 'Vous ratez le début. Portes qui claquent, regard du prof, moral déjà en retard.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'placeholder2',
        label: 'Prendre des notes',
        outcomes: trio(
          { text: 'Notes utiles pour plus tard — schémas, noms de voies, un croquis qui pourrait changer une carrière.', deltas: { cap: 1, charisme: 1 } },
          { text: 'Quelques griffonnages. Assez pour prouver que vous étiez là ; pas pour briller demain.', deltas: {} },
          { text: 'Votre stylo casse. Encre partout, pages gâchées, et le Collège qui continue sans vous.', deltas: { moral: -1 } },
        ),
      },
      {
        id: 'placeholder3',
        label: 'Quitter l’amphi',
        outcomes: trio(
          { text: 'Vous repartez. Le Collège reste ouvert — air libre, choix reporté, conscience un peu plus légère.', deltas: { moral: 1 } },
          { text: 'Couloir vide, discours derrière la porte. Vous n’avez ni gagné ni perdu — juste quitté.', deltas: {} },
          { text: 'On note votre absence. Une croix sur le registre ; un murmure qui suivra jusqu’à la Taverne.', deltas: { renommee: -1 } },
        ),
      },
    ],
  },
];
