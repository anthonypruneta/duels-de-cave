/**
 * ~30 événements supplémentaires Cave Destiny (univers Duels de Cave).
 * Raretés variées : common → legendary.
 */

import { trio } from './caveDestinyEventUtils';

export const CAVE_DESTINY_EVENTS_EXTRA = [
  {
    id: 'entrainement',
    title: 'Salle d’entraînement',
    text: 'Les mannequins cognent sous les coups.\nIci, il n’y a pas de gloire, seulement la sueur, le fer et l’écho sourd de l’arène.',
    rarity: 'common',
    tags: ['combat'],
    options: [
      {
        id: 'sparring',
        label: 'Enchaîner les duels d’entraînement',
        outcomes: trio(
          { text: 'Vos gestes se durcissent : le corps répond avant la pensée, et le fer chante juste.', deltas: { auto: 3, def: 2, hp: -3 } },
          { text: 'La session reste correcte : quelques bleus, un peu de souffle, rien qui fera parler la Taverne.', deltas: { auto: 1, hp: -2 } },
          { text: 'Vous forcez trop.\nUne entorse vous rappelle à l’ordre, et le sol de la salle est froid.', deltas: { hp: -8, moral: -2 } },
        ),
      },
      {
        id: 'technique',
        label: 'Travailler une feinte précise',
        outcomes: trio(
          { text: 'La feinte devient réflexe : l’épaule ment, la lame suit, l’adversaire reste un temps trop tard.', deltas: { spd: 3, cap: 1 } },
          { text: 'Le progrès reste discret : le mouvement tient, sans encore surprendre vraiment.', deltas: { spd: 1 } },
          { text: 'Vous confondez les enchaînements.\nLa frustration amère serre vos poings sur une sueur inutile.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'repos',
        label: 'Observer les autres s’entraîner',
        outcomes: trio(
          { text: 'Vous volez une idée de garde : un angle d’épaule, un pivot déjà ancré dans vos muscles.', deltas: { def: 2, moral: 2 } },
          { text: 'Vous restez un spectateur à peine utile.\nVous repartez avec une note mentale et peu d’autre.', deltas: { moral: 1 } },
          { text: 'Vous vous ennuyez.\nLes PV baissent, le moral aussi, et l’inaction a un goût de rouille.', deltas: { hp: -3, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'encyclopedie',
    title: 'L’Encyclopédie',
    text: 'Grimoires, bestiaires, notes de vainqueurs.\nL’odeur du parchemin tiède ; le savoir attend ceux qui lisent vraiment.',
    rarity: 'common',
    tags: ['ombres'],
    options: [
      {
        id: 'bestiaire',
        label: 'Étudier le bestiaire des donjons',
        outcomes: trio(
          { text: 'Vous retenez une faiblesse de boss : un flanc, un rythme.\nLa Tour du Mage n’aura plus le même goût.', deltas: { cap: 3, renommee: 1 } },
          { text: 'Vous griffonnez à la hâte quelques notes utiles, assez pour ne pas mourir bête.', deltas: { cap: 1 } },
          { text: 'Trop de pages s’empilent.\nRien ne s’imprime.\nLes caractères dansent, et votre tête devient lourde.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'armes',
        label: 'Comparer les lignées d’armes',
        outcomes: trio(
          { text: 'Vous comprenez mieux le lien entre l’arme et le bras : le poids, le souffle, la ligne du coup.', deltas: { auto: 2, cap: 2 } },
          { text: 'La lecture reste correcte : schémas clairs, mais sans révélation qui change une garde.', deltas: { auto: 1 } },
          { text: 'Vous mélangez Mjöllnir et Gungnir.\nUne honte douce vous prend sous les regards des autres lecteurs.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'dormir',
        label: 'S’assoupir sur un tome',
        outcomes: trio(
          { text: 'Un rêve étrange vous inspire : corridors, runes, un cri d’arène.\nVous vous réveillez plus vif.', deltas: { moral: 4, cap: 1 } },
          { text: 'La sieste pèse sur le cuir du tome.\nVous vous étirez, un peu moins cassé, pas plus sage.', deltas: { hp: 3 } },
          { text: 'On vous réveille d’un rire.\nL’ego se froisse, les joues brûlent, et les tomes pèsent trop pour votre dignité.', deltas: { charisme: -2, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'repos_taverne',
    title: 'Repos à la Taverne',
    text: 'Bières, chants, chibis endormis sur les tables.\nLa Taverne sent le houblon et le bois brûlé : parfois, ne rien faire est un choix.',
    rarity: 'common',
    tags: ['social'],
    options: [
      {
        id: 'boire',
        label: 'Boire avec les habitués',
        outcomes: trio(
          { text: 'La salle vous adopte.\nLes choppes cognent, les rires fusent, et le moral tient au beau fixe jusqu’à l’aube.', deltas: { moral: 6, charisme: 2, or: -3, hp: 2 } },
          { text: 'La soirée reste tiède, la tête légère.\nVous repartez sans histoire, juste le goût du malt.', deltas: { moral: 2, or: -1 } },
          { text: 'Vous avez trop bu.\nLe lendemain punit : tempes en fer, gorge sèche, bourse plus légère.', deltas: { hp: -6, moral: -2, or: -4 } },
        ),
      },
      {
        id: 'dormir',
        label: 'Louer une chambre jusqu’à l’aube',
        outcomes: trio(
          { text: 'Le sommeil vous répare.\nLes planches craquent, puis le silence s’installe, et vous renaîtrez demain.', deltas: { hp: 10, moral: 3, or: -2 } },
          { text: 'Le repos reste correct : oreiller dur, sommeil court, mais le corps tient mieux.', deltas: { hp: 5, or: -1 } },
          { text: 'Le matelas est dur, les rêves agités.\nVous sortez plus fatigué qu’en entrant, et plus pauvre.', deltas: { hp: 1, moral: -2, or: -2 } },
        ),
      },
      {
        id: 'chanter',
        label: 'Rejoindre le chœur improvisé',
        outcomes: trio(
          { text: 'Votre voix porte jusqu’au fond.\nOn vous offre une tournée, et la Taverne bat la mesure.', deltas: { charisme: 4, moral: 3 } },
          { text: 'Vous fredonnez correctement.\nPersonne ne s’arrête, mais personne ne grimace.', deltas: { charisme: 1 } },
          { text: 'Une fausse note part trop fort.\nOn change de sujet.\nVos oreilles brûlent plus que la bière.', deltas: { charisme: -3, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'sanglier',
    title: 'Sanglier de la clairière',
    text: 'Dans la Forêt enchantée, un sanglier charge.\nLes feuilles s’arrachent, le sol tremble, et de petits yeux annoncent un gros problème.',
    rarity: 'common',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'affronter',
        label: 'Bloquer la charge de front',
        // check secret : bonne Déf → bien plus de succès
        check: { def: 1.5, auto: 0.55 },
        outcomes: trio(
          { text: 'Vous encaissez la charge.\nLe sanglier s’effondre : viande chaude, gloire mineure, souffle court.', deltas: { def: 2, or: 4, hp: -2 } },
          { text: 'Vous le chassez… après une course.\nBranches dans le visage, sang dans la bouche, victoire sale.', deltas: { def: 1, hp: -4 } },
          { text: 'Il vous renverse.\nLe départ est humiliant : boue dans le dos, rires d’oiseaux dans les branches.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'esquiver',
        label: 'L’attirer hors du sentier',
        check: { spd: 1.4, charisme: 0.3 },
        outcomes: trio(
          { text: 'Le piège se referme parfaitement.\nIl s’englue dans les ronces, et le butin tombe sans une égratignure.', deltas: { spd: 3, or: 5 } },
          { text: 'Vous gagnez le duel de façon sale.\nGriffures, sueur, et un trophée qui sent encore la bête.', deltas: { or: 2, hp: -2 } },
          { text: 'Vous trébuchez au mauvais moment.\nLes défenses vous trouvent : un coup sourd, le goût du fer.', deltas: { hp: -7, moral: -2 } },
        ),
      },
      {
        id: 'fuir',
        label: 'Contourner le territoire',
        check: { spd: 0.8, charisme: 0.5 },
        outcomes: trio(
          { text: 'Vous choisissez la sagesse et trouvez un autre sentier : mousse douce, champignons, un peu d’or oublié.', deltas: { or: 3, moral: 1 } },
          { text: 'Vous perdez du temps, rien de plus.\nLe soleil a bougé ; le sanglier, non.', deltas: {} },
          { text: 'Le sanglier vous suit quand même.\nLe souffle chaud colle à la nuque, et la panique court dans les jambes.', deltas: { hp: -5, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'duel_ami',
    title: 'Duel amical',
    text: 'Un autre combattant propose un affrontement sans enjeu, enfin presque.\nLes regards de la Taverne pèsent déjà.',
    rarity: 'common',
    tags: ['combat', 'social'],
    options: [
      {
        id: 'accepter',
        label: 'Accepter le duel',
        outcomes: trio(
          { text: 'Vous remportez une victoire nette.\nLe respect devient mutuel : poignées de main, sueur partagée, nom un peu plus fort.', deltas: { renommee: 3, auto: 2, charisme: 2 } },
          { text: 'Le match reste serré.\nVous apprenez une parade ratée, une riposte tenue, et le corps retient la leçon.', deltas: { def: 1, hp: -3 } },
          { text: 'La défaite reste amicale, mais l’ego en sort diminué.\nLe rire de l’autre sonne trop clair dans votre tête.', deltas: { moral: -5, hp: -4 } },
        ),
      },
      {
        id: 'conseil',
        label: 'Échanger des conseils après l’échauffement',
        outcomes: trio(
          { text: 'Vous glanez une astuce précieuse sur une capacité : un timing, un souffle.\nVous repartez plus malin.', deltas: { cap: 2, charisme: 2 } },
          { text: 'La conversation reste polie, avec quelques formules banales et un sourire qui ne change pas grand-chose.', deltas: { charisme: 1 } },
          { text: 'Un malentendu gâche l’échange.\nL’ambiance se gâte : mots trop secs, regards de travers, poings qui démangent.', deltas: { charisme: -2, moral: -2 } },
        ),
      },
      {
        id: 'refuser',
        label: 'Décliner poliment',
        outcomes: trio(
          { text: 'On respecte votre prudence.\nUn hochement, un verre levé, et la Taverne passe à autre chose.', deltas: { moral: 2 } },
          { text: 'Le moment tombe à plat.\nPersonne n’insiste, personne n’applaudit : juste le bruit des choppes.', deltas: {} },
          { text: 'On murmure « peureux ».\nLe mot colle à la peau plus longtemps que la bière.', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'ours_bosquet',
    title: 'Ours du bosquet',
    text: 'Plus loin dans la Forêt enchantée, l’ours ne négocie pas.\nFourrure sombre, souffle lourd, silence qui pèse.',
    rarity: 'uncommon',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'rush',
        label: 'Frapper avant qu’il se lève',
        outcomes: trio(
          { text: 'L’assaut tombe parfait.\nLe bosquet vous appartient : sang, mousse, et un trophée qui sent la victoire.', deltas: { auto: 4, or: 7, hp: -5, trophies: { donjon: 1 } } },
          { text: 'La victoire reste difficile.\nVous tenez debout, tremblant, l’ours à terre et le bras en feu.', deltas: { auto: 1, hp: -6, or: 2 } },
          { text: 'Une patte vous envoie au sol.\nLe ciel bascule, les côtes crient, et le moral suit.', deltas: { hp: -11, moral: -4 } },
        ),
      },
      {
        id: 'piege',
        label: 'Utiliser le terrain contre lui',
        outcomes: trio(
          { text: 'Racines, pente, surprise : le travail est beau.\nLa bête s’écroule sans comprendre le piège.', deltas: { cap: 3, spd: 2, or: 5 } },
          { text: 'Le piège aide un peu.\nAssez pour finir, pas assez pour vous laisser intact.', deltas: { cap: 1, hp: -3 } },
          { text: 'Vous tombez dans votre propre embuscade.\nL’ours n’a même pas besoin d’essayer.', deltas: { hp: -8, moral: -3 } },
        ),
      },
      {
        id: 'recul',
        label: 'Reculer vers la clairière',
        outcomes: trio(
          { text: 'Vous sauvez votre peau… et un peu d’orgueil.\nLa clairière accueille votre souffle court.', deltas: { moral: 1, hp: 1 } },
          { text: 'La retraite reste propre.\nPas de gloire, pas de honte : juste le sentier sous vos bottes.', deltas: {} },
          { text: 'L’ours vous poursuit jusqu’au sentier.\nBranches cassées, panique, griffes trop proches.', deltas: { hp: -6, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'classement_pvp',
    title: 'Classement PvP',
    text: 'Les duels classés appellent.\nChaque défaite s’affiche.\nChaque victoire aussi.\nLe tableau ne ment jamais.',
    rarity: 'uncommon',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'grimper',
        label: 'Enchaîner les duels pour grimper',
        outcomes: trio(
          {
            text: 'Vous enchaînez les victoires.\nVotre nom grimpe dans le tableau, et ceux juste en dessous commencent à vous étudier avant de vous croiser.',
            deltas: { renommee: 8, auto: 3, hp: -6, trophies: { pvp: 1 } },
          },
          {
            text: 'Autant de wins que de pertes.\nLe rang bouge à peine, mais vos bleus racontent mieux la soirée que les chiffres.',
            deltas: { renommee: 2, hp: -4 },
          },
          {
            text: 'La série casse.\nVous descendez rang après rang, la gorge serrée, pendant que le tableau affiche froidement la chute.',
            deltas: { renommee: -6, moral: -7, hp: -5 },
          },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier les styles du top',
        outcomes: trio(
          {
            text: 'Vous piquez une garde au haut du tableau.\nUn angle volé aux meilleurs s’ancre déjà dans vos muscles.',
            deltas: { cap: 3, spd: 2 },
          },
          {
            text: 'Quelques notes restent en bas de page.\nRien de révolutionnaire, juste un œil un peu plus aiguisé.',
            deltas: { cap: 1 },
          },
          {
            text: 'Trop de styles, trop d’avis.\nChaque garde contredit la suivante, et la vôtre finit par hésiter.',
            deltas: { moral: -3 },
          },
        ),
      },
      {
        id: 'pause',
        label: 'Rester hors du classement cette saison',
        outcomes: trio(
          {
            text: 'Vous laissez le tableau aux autres.\nAu retour, muscles calmes, tête claire, et la soif de grimper intacte.',
            deltas: { hp: 5, moral: 2 },
          },
          {
            text: 'Vous regardez les autres progresser.\nUn pincement discret, rien de plus.',
            deltas: { moral: -1 },
          },
          {
            text: 'On vous oublie du tableau.\nVotre nom s’efface comme une craie sous la pluie.',
            deltas: { renommee: -3 },
          },
        ),
      },
    ],
  },
  {
    id: 'golem_os',
    title: 'Golem squelettique',
    text: 'Dans la galerie d’os de la Tour du Mage, quelque chose s’assemble.\nVertèbres qui cliquettent, souffle froid.',
    rarity: 'uncommon',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'briser',
        label: 'Briser le noyau avant qu’il se forme',
        outcomes: trio(
          { text: 'Les os s’effondrent en pluie blanche.\nVous grimpez, la poussière dans la gorge et la magie dans le sang.', deltas: { cap: 4, auto: 2, hp: -4 } },
          { text: 'Le combat s’étire longtemps avant la victoire.\nChaque vertèbre cède trop lentement ; vous tenez quand même.', deltas: { cap: 2, hp: -6 } },
          { text: 'Le golem se referme sur vous.\nCage d’os, pression sourde, panique qui mord.', deltas: { hp: -10, moral: -4 } },
        ),
      },
      {
        id: 'detour',
        label: 'Contourner la galerie',
        outcomes: trio(
          { text: 'Le détour se révèle intelligent.\nUn passif mineur pulse dans une alcôve, et vous le prenez sans bruit.', deltas: { cap: 2, or: 3 } },
          { text: 'Vous perdez un étage de temps.\nEscaliers, couloirs, souffle court : rien d’autre.', deltas: { hp: -2 } },
          { text: 'Vous tombez dans un cul-de-sac.\nLe golem vous attendait : cliquetis derrière vous, trop tard pour fuir.', deltas: { hp: -8, moral: -3 } },
        ),
      },
      {
        id: 'nain',
        label: 'Frapper comme un forgeron nain',
        ifRace: ['Nain'],
        outcomes: trio(
          { text: 'Un seul coup suffit.\nLe crâne éclate.\nLe savoir-faire de la Forge Ornn parle à travers vos bras.', deltas: { auto: 5, def: 2, renommee: 2 } },
          { text: 'Le travail de masse tient bon.\nL’os cède par à-coups ; vous sortez essoufflé mais debout.', deltas: { auto: 2, hp: -3 } },
          { text: 'L’os est plus dur que prévu.\nVos poignets vibrent, et l’orgueil nain aussi.', deltas: { hp: -7, moral: -2 } },
        ),
      },
      {
        id: 'briseur',
        label: 'Étouffer sa magie d’animation',
        ifClass: ['Briseur de Sort', 'Mage'],
        outcomes: trio(
          { text: 'L’égide coupe le fil.\nLe silence d’os s’installe, et la galerie retombe dans un calme de tombeau.', deltas: { cap: 5, renommee: 2 } },
          { text: 'La magie s’affaiblit, le combat devient plus simple.\nLe golem titube ; vous finissez le travail.', deltas: { cap: 2 } },
          { text: 'Le golem ignore votre égide.\nVos runes claquent dans le vide, puis les os vous trouvent.', deltas: { cap: -1, hp: -6 } },
        ),
      },
    ],
  },
  {
    id: 'college_koro',
    title: 'Collège Kunugigaoka',
    text: 'Des sous-classes étranges s’enseignent ici.\nLe professeur sourit trop, et le tableau noir sent encore le sort.',
    rarity: 'uncommon',
    tags: ['donjons'],
    options: [
      {
        id: 'cours',
        label: 'Suivre un cours intensif',
        outcomes: trio(
          { text: 'La leçon s’assimile.\nVotre style s’affine : chaque geste un peu plus propre, un peu plus mortel.', deltas: { cap: 3, spd: 2, moral: 2 } },
          { text: 'Vous retenez l’essentiel.\nC’est assez pour ne pas ridiculiser le Collège, ni vous-même.', deltas: { cap: 1 } },
          { text: 'Trop de théories s’empilent.\nLes maux de tête suivent : formules qui tournent, craie qui grince, moral à plat.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'examen',
        label: 'Passer l’examen surprise',
        outcomes: trio(
          { text: 'Vous réussissez l’examen.\nLe collège applaudit, et même Koro Sensei semble presque fier.', deltas: { renommee: 5, cap: 2, or: 4 } },
          { text: 'Vous obtenez juste la moyenne.\nUn tampon tiède, un regard neutre, rien qui restera au Hall of Fame.', deltas: { renommee: 1 } },
          { text: 'Vous échouez à l’examen.\nLe tableau noir de la honte affiche votre nom trop fort, pour de mauvaises raisons.', deltas: { renommee: -3, moral: -5 } },
        ),
      },
      {
        id: 'fugue',
        label: 'Sécher pour explorer les couloirs',
        outcomes: trio(
          { text: 'Vous trouvez une cachette secrète.\nUn petit trésor attend sous une dalle : pièces tièdes, sourire de voleur.', deltas: { or: 8, spd: 1 } },
          { text: 'Les couloirs restent vides, les casiers fermés.\nVous rentrez sans butin, juste la poussière aux genoux.', deltas: {} },
          { text: 'On vous prend sur le fait.\nLa punition tombe sèche : regard du prof, moral en chute, réputation ébréchée.', deltas: { moral: -4, renommee: -2 } },
        ),
      },
    ],
  },
  {
    id: 'rat_grimoires',
    title: 'Rat des grimoires',
    text: 'Au hall de la Tour, un rat vole un parchemin magique.\nGriffes, squeaks, runes qui traînent dans la poussière.',
    rarity: 'common',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'courir',
        label: 'Courir après le rat',
        outcomes: trio(
          { text: 'Vous récupérez le parchemin.\nUne sagesse mineure reste tiède dans vos doigts, sous la forme d’une rune.', deltas: { cap: 3, spd: 2 } },
          { text: 'La course tourne à l’absurde.\nLe parchemin se déchire à moitié : assez pour lire une ligne, pas le sort entier.', deltas: { cap: 1, hp: -2 } },
          { text: 'Vous trébuchez au milieu de la course.\nLe rat s’enfuit : rires d’étudiants, genoux en sang, orgueil à terre.', deltas: { moral: -3, hp: -2 } },
        ),
      },
      {
        id: 'piege',
        label: 'Appâter le rat avec une miette',
        outcomes: trio(
          { text: 'Le rat négocie.\nVous gagnez une rune : échange absurde, magie réelle.', deltas: { cap: 2, or: 2, charisme: 1 } },
          { text: 'Il prend la miette et part aussitôt.\nQueue en l’air, parchemin perdu, faim un peu moins forte.', deltas: { or: -1 } },
          { text: 'D’autres rats affluent, et le chaos suit.\nUne marée de griffes, de cris, de parchemins qui volent partout.', deltas: { hp: -4, moral: -2 } },
        ),
      },
      {
        id: 'ignorer',
        label: 'Ignorer et monter',
        outcomes: trio(
          { text: 'Vous gardez le focus et gagnez un étage sans détour : le souffle régulier, l’esprit déjà plus haut.', deltas: { renommee: 1, hp: 1 } },
          { text: 'Vous montez sans incident particulier.\nJuste les marches, l’écho, et le doute qui traîne.', deltas: {} },
          { text: 'Le parchemin vous manquera plus tard.\nVous le sentez déjà, comme un trou dans la poche.', deltas: { moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'blessure',
    title: 'Blessure tenace',
    text: 'Une entaille refuse de se fermer.\nVos PV vacillent : chaque pas tire un fil rouge sous le bandage.',
    rarity: 'uncommon',
    tags: ['social'],
    options: [
      {
        id: 'soigner',
        label: 'Chercher un soigneur à la Taverne',
        outcomes: trio(
          { text: 'Des mains expertes vous soignent.\nVous respirez à nouveau : chaleur dans la plaie, bière offerte, soulagement vrai.', deltas: { hp: 12, or: -5, moral: 3 } },
          { text: 'Le pansement reste correct.\nLa douleur baisse d’un cran ; la facture, elle, reste nette.', deltas: { hp: 6, or: -2 } },
          { text: 'Le remède est mauvais, et ça empire : fièvre sourde, or parti, confiance en moins.', deltas: { hp: -4, or: -3, moral: -2 } },
        ),
      },
      {
        id: 'forcer',
        label: 'Combattre quand même',
        outcomes: trio(
          { text: 'La douleur vous aiguise.\nChaque coup part plus net, plus cruel, et la plaie devient carburant.', deltas: { auto: 3, hp: -5, moral: 2 } },
          { text: 'Vous tenez le rythme de justesse.\nAssez pour finir le duel, pas assez pour sourire après.', deltas: { hp: -3 } },
          { text: 'La blessure s’ouvre, et l’effondrement suit.\nGenoux au sol, vision qui blanchit, arène qui tourne.', deltas: { hp: -14, moral: -6 } },
        ),
      },
      {
        id: 'healer',
        label: 'Vous soigner vous-même',
        ifClass: ['Healer', 'Alchimiste'],
        outcomes: trio(
          { text: 'Votre art vous sauve avec élégance : lumière douce, plaie qui se referme, main qui ne tremble plus.', deltas: { hp: 10, cap: 2 } },
          { text: 'Le soin reste partiel.\nLa brûlure baisse ; il reste une ligne rouge et un goût d’herbes amères.', deltas: { hp: 5 } },
          { text: 'Le dosage est mauvais, et les vertiges suivent.\nLe monde penche, votre propre magie vous trahit un instant.', deltas: { hp: -3, moral: -2 } },
        ),
      },
      {
        id: 'repos',
        label: 'Rester alité une saison',
        outcomes: trio(
          { text: 'La guérison est complète, et la patience est récompensée : cicatrice nette, corps prêt, nom un peu oublié.', deltas: { hp: 14, moral: 2, renommee: -1 } },
          { text: 'Vous récupérez peu à peu.\nLentes journées, lit trop dur, mais le sang circule enfin sans douleur.', deltas: { hp: 7 } },
          { text: 'L’inactivité ronge le moral.\nLes autres combattent ; vous comptez les planches du plafond.', deltas: { hp: 3, moral: -5, renommee: -2 } },
        ),
      },
    ],
  },
  {
    id: 'salameche_red',
    title: 'Salamèche dans l’arène',
    text: 'Red vous propose un duo.\nUne flamme cracheuse bloque le passage : choisissez un allié réel, ou refusez l’arène.',
    rarity: 'uncommon',
    tags: ['donjons', 'combat', 'social'],
    // Options injectées dynamiquement (3 personnages réels + refus)
    options: [],
  },
  {
    id: 'arme_commune',
    title: 'Seuil de la Grotte',
    text: 'L’entrée de la Grotte aux merveilles grince.\nCe n’est pas une arme à prendre, mais une carte, un passage, un choix de sentier.',
    rarity: 'uncommon',
    tags: ['donjons', 'loot'],
    options: [
      {
        id: 'carte',
        label: 'Déchiffrer la carte du seuil',
        outcomes: trio(
          { text: 'Le plan s’ouvre.\nCouloirs, pièges, caches : la Grotte a moins de secrets.', deltas: { cap: 2, spd: 1, or: 3 } },
          { text: 'Quelques annotations restent utiles.\nAssez pour ne pas mourir bête.', deltas: { cap: 1 } },
          { text: 'La carte ment.\nOu vous la lisez de travers : même résultat.', deltas: { moral: -2, hp: -2 } },
        ),
      },
      {
        id: 'forcer',
        label: 'Forcer le passage sans détour',
        outcomes: trio(
          { text: 'La porte s’enfonce.\nLe bruit annonce un intrus… et un butin plus proche.', deltas: { auto: 2, or: 5, hp: -3 } },
          { text: 'Le passage reste correct.\nSueurs, poussière, et la suite du couloir.', deltas: { or: 2, hp: -2 } },
          { text: 'Un piège de seuil vous attend.\nLa Grotte vous mord dès l’entrée.', deltas: { hp: -7, moral: -2 } },
        ),
      },
      {
        id: 'discret',
        label: 'Glisser en silence entre les stalactites',
        outcomes: trio(
          { text: 'Personne ne vous voit.\nUne cachette mineure paye déjà le risque.', deltas: { spd: 3, or: 4 } },
          { text: 'La discrétion reste correcte.\nPeu de gloire, peu de bruit.', deltas: { spd: 1 } },
          { text: 'Un caillou traître trahit votre pas.\nL’écho court plus vite que vous.', deltas: { moral: -3, hp: -2 } },
        ),
      },
    ],
  },
  {
    id: 'hall_of_fame',
    title: 'Hall of Fame',
    text: 'Les noms des vainqueurs brillent.\nLe vôtre n’y figure pas encore, ou peut-être si.\nLa pierre froide attend une nouvelle gravure.',
    rarity: 'rare',
    tags: ['tournoi', 'social'],
    options: [
      {
        id: 'contempler',
        label: 'Contempler les légendes',
        outcomes: trio(
          { text: 'L’inspiration vous traverse.\nLes lettres dorées brûlent derrière vos yeux, et vous voulez y être.', deltas: { moral: 6, renommee: 2, auto: 1 } },
          { text: 'Vous offrez un respect silencieux.\nVous lisez, vous hochez, vous repartez sans bruit ni serment.', deltas: { moral: 2 } },
          { text: 'L’ombre des grands vous écrase.\nChaque nom pèse une défaite que vous n’avez pas encore eue.', deltas: { moral: -5 } },
        ),
      },
      {
        id: 'defier',
        label: 'Jurer de graver votre nom',
        outcomes: trio(
          { text: 'Le serment tient en esprit.\nVous partez plus dur : mâchoire serrée, geste déjà plus net.', deltas: { renommee: 5, moral: 4, auto: 2 } },
          { text: 'Le serment reste pour plus tard.\nLes mots restent tièdes ; l’arène, elle, n’attend pas.', deltas: { moral: 1 } },
          { text: 'Les murs semblent rire.\nL’écho de votre voix revient trop petit, trop creux.', deltas: { moral: -4, renommee: -1 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier les styles des vainqueurs',
        outcomes: trio(
          { text: 'Vous volez une posture légendaire : hanche, regard, timing.\nElle s’installe déjà dans votre ombre.', deltas: { cap: 3, spd: 3, renommee: 2 } },
          { text: 'Quelques notes suffisent.\nAssez pour ajuster une garde, pas assez pour voler une couronne.', deltas: { cap: 1, spd: 1 } },
          { text: 'Trop d’idoles vous brouillent.\nVous perdez votre style : chaque copie tue un peu votre propre rythme.', deltas: { moral: -3, auto: -1 } },
        ),
      },
    ],
  },
  {
    id: 'koro_sensei',
    title: 'Koro Sensei',
    text: 'Le professeur du collège propose une « petite » leçon.\nSa vitesse déchire l’air : sourire trop large, ombre trop vite.',
    rarity: 'rare',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'duel',
        label: 'Accepter le duel pédagogique',
        outcomes: trio(
          { text: 'Vous le touchez une seule fois.\nIl applaudit à pleine voix.\nCette seule touche vaut dix combats ordinaires.', deltas: { spd: 6, renommee: 6, hp: -7 } },
          { text: 'La leçon reste rude.\nVous tenez malgré les bleus et le souffle court, avec une vitesse un peu moins ridicule.', deltas: { spd: 2, hp: -8 } },
          { text: 'Vous ne voyez même pas les coups.\nLe sol arrive avant la pensée ; le moral aussi.', deltas: { hp: -12, moral: -5 } },
        ),
      },
      {
        id: 'ecouter',
        label: 'Écouter le cours sans combattre',
        outcomes: trio(
          { text: 'Vous recevez un conseil d’assassin, précieux : un angle, un silence, une mort propre entre deux phrases.', deltas: { cap: 3, spd: 3, moral: 2 } },
          { text: 'Le cours reste correct.\nVous retenez l’essentiel sans que le Collège vous remarque vraiment.', deltas: { cap: 1 } },
          { text: 'Vous décrochez du cours.\nL’interrogation surprise tombe : silence gênant, craie qui tombe, ego à terre.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'elfe',
        label: 'Tenter de matcher sa vitesse',
        ifRace: ['Elfe', 'Gnome'],
        outcomes: trio(
          { text: 'Vous le suivez presque.\nIl s’incline, amusé : vos pieds ont goûté sa cadence, et ça change tout.', deltas: { spd: 7, renommee: 4 } },
          { text: 'Vous suivez sa cadence un court instant.\nPuis l’air se déchire encore, et vous restez un souffle derrière.', deltas: { spd: 3, hp: -4 } },
          { text: 'L’humiliation tombe comme un éclair.\nVous êtes une statue ; lui, un trait jaune qui rit déjà ailleurs.', deltas: { moral: -6, hp: -5 } },
        ),
      },
    ],
  },
  {
    id: 'licorne_sanctuaire',
    title: 'Sanctuaire de la Licorne',
    text: 'Au cœur de la Forêt, la Licorne attend.\nEntre pureté et orgueil, son regard ne cède rien.\nLa lumière filtre en lames argentées.',
    rarity: 'rare',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'affronter',
        label: 'L’affronter pour sa faveur',
        outcomes: trio(
          { text: 'La Licorne s’incline devant vous.\nLa magie pure entre en vous : corne qui brille, souffle calme, forêt qui approuve.', deltas: { cap: 6, renommee: 5, or: 6, trophies: { donjon: 1 } } },
          { text: 'Le duel reste égal.\nElle part sans colère : feuilles remuées, respect tiède, plaies légères.', deltas: { cap: 2, hp: -5 } },
          { text: 'Sa corne vous repousse hors du sanctuaire.\nLumière qui brûle, genoux dans la mousse, honte.', deltas: { hp: -10, moral: -4 } },
        ),
      },
      {
        id: 'offrir',
        label: 'Offrir une offrande de respect',
        outcomes: trio(
          { text: 'Elle bénit votre voie.\nUne chaleur douce court sous la peau, comme une promesse tenue.', deltas: { moral: 5, cap: 3, hp: 4 } },
          { text: 'Elle accepte l’offrande avec froideur.\nUn hochement, pas de miracle ; juste le droit de repartir.', deltas: { moral: 2 } },
          { text: 'L’offrande est jugée impure.\nSon regard vous juge plus fort qu’un coup, et vous reculez.', deltas: { moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'sylvari',
        label: 'Parler le langage de la sève',
        ifRace: ['Sylvari'],
        outcomes: trio(
          { text: 'La forêt traduit.\nL’alliance est rare : racines, souffle, et une magie qui vous reconnaît enfin.', deltas: { cap: 5, def: 3, hp: 3 } },
          { text: 'La compréhension reste partielle.\nQuelques mots de sève ; le reste reste silence vert.', deltas: { cap: 2 } },
          { text: 'Même la sève se tait.\nVotre langue raciale sonne creux, et la Licorne détourne la tête.', deltas: { moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'tournoi_anciens',
    title: 'Invitation au Tournoi des anciens',
    text: 'Suite à une erreur d’inscription, on vous a convoqué au Tournoi des anciens.\nLes vrais champions haussent déjà un sourcil : votre nom n’a rien à faire sur cette liste… sauf si vous le prouvez.',
    rarity: 'rare',
    tags: ['tournoi', 'combat'],
    options: [
      {
        id: 'participer',
        label: 'Participer quand même',
        ambitionPayoff: true,
        check: { auto: 1.2, def: 0.7, spd: 0.5 },
        outcomes: trio(
          { text: 'Erreur ou pas : vous renversez un mythe.\nL’arène hurle ; le Hall penche déjà vers votre nom.', deltas: { renommee: 12, auto: 4, hp: -8, trophies: { tournoi: 1 } }, ambitionPayoff: true },
          { text: 'Vous tenez tête à un ancien.\nPas de titre, mais le public retient l’intrus qui a osé.', deltas: { renommee: 4, hp: -7 }, ambitionPayoff: true },
          { text: 'Vous êtes balayé au premier échange.\nOn corrige « l’erreur » dans un rire : trop vieux, trop forts pour vous.', deltas: { hp: -11, moral: -6, renommee: -2 } },
        ),
      },
      {
        id: 'decliner',
        label: 'Décliner poliment',
        check: { charisme: 1.1 },
        outcomes: trio(
          { text: 'Vous rendez le carton.\nLe respect est rare : un ancien hoche la tête, et mieux vaut l’honneur que l’humiliation.', deltas: { charisme: 3, moral: 4, renommee: 1 } },
          { text: 'Le déclin reste tiède.\nOn raye votre nom ; la salle passe à autre chose sans vous regarder.', deltas: { moral: 1 } },
          { text: 'On murmure la lâcheté.\nL’erreur devient une blague qui court jusqu’à la Taverne.', deltas: { moral: -4, renommee: -3 } },
        ),
      },
      {
        id: 'corriger',
        label: 'Tenter de faire corriger l’erreur',
        check: { charisme: 0.9, renommee: 0.5 },
        outcomes: trio(
          { text: 'Un scribe s’excuse.\nEn compensation : une place au prochain samedi… et un secret de garde oubliée.', deltas: { renommee: 3, def: 2, or: 4, moral: 2 } },
          { text: 'Paperasse, tampons, oubli.\nOn vous raye : ni gloire, ni honte, juste de l’encre.', deltas: { moral: 1 } },
          { text: 'Personne n’avoue l’erreur.\nOn vous laisse sur le banc, ridicule, sans combat ni excuse.', deltas: { moral: -5, renommee: -1 } },
        ),
      },
      {
        id: 'parier',
        label: 'Rester dans les gradins et parier',
        outcomes: trio(
          { text: 'La cote est folle sur un ancien fatigué.\nLa bourse enfle pendant que les mythes s’entrechoquent.', deltas: { or: 16, charisme: 2 } },
          { text: 'Petit gain, grand spectacle.\nVous repartez plus riche d’images que d’or.', deltas: { or: 4, moral: 1 } },
          { text: 'Les légendes vous ruinent.\nLes paris vident votre poche plus vite qu’un sort de Mage.', deltas: { or: -12, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'ronflex_red',
    title: 'Ronflex endormi',
    text: 'Le couloir est bloqué par un Ronflex.\nRed attend votre duo : un autre allié réel… ou la sortie.',
    rarity: 'rare',
    tags: ['donjons', 'social'],
    // Options injectées dynamiquement (3 personnages réels + refus)
    options: [],
  },
  {
    id: 'eveil_race',
    title: 'Éveil de race',
    text: 'Quelque chose en vous se fissure, puis s’ouvre.\nL’héritage racial appelle : sang chaud, vieux noms qui se réveillent.',
    rarity: 'epic',
    tags: ['ombres'],
    options: [
      {
        id: 'accepter',
        label: 'Accueillir l’éveil',
        outcomes: trio(
          { text: 'L’héritage s’ancre dans votre sang.\nVous n’êtes plus tout à fait le même : puissance, mémoire, peau qui brûle juste.', deltas: { auto: 4, def: 4, cap: 4, spd: 3, renommee: 6 } },
          { text: 'L’éveil reste partiel, mais prometteur : un souffle d’ancêtre, une force incomplète, une soif qui reste.', deltas: { auto: 2, cap: 2, hp: -3 } },
          { text: 'Le corps refuse.\nUne douleur sourde suit : os qui résistent, héritage qui force, vous qui cédez trop tôt.', deltas: { hp: -10, moral: -5 } },
        ),
      },
      {
        id: 'retarder',
        label: 'Retarder l’appel',
        outcomes: trio(
          { text: 'Vous gardez le contrôle et choisissez le moment : la braise reste ; c’est vous qui tenez l’allumette.', deltas: { moral: 4, charisme: 2 } },
          { text: 'L’appel s’éloigne pour un temps.\nSilence relatif, héritage en sourdine, rien de gagné ni de perdu.', deltas: {} },
          { text: 'L’héritage s’offense de votre refus.\nUne faiblesse s’installe : quelque chose en vous se détourne, et ça se sent.', deltas: { moral: -4, auto: -1 } },
        ),
      },
      {
        id: 'cendres',
        label: 'Attiser les braises',
        ifRace: ['Cendrés'],
        outcomes: trio(
          { text: 'Les braises deviennent brasier.\nChaleur dans les veines, cendre dans l’air, magie qui flambe.', deltas: { cap: 6, auto: 4, renommee: 3 } },
          { text: 'Les braises restent stables.\nAssez pour chauffer un sort ; pas encore pour brûler un étage.', deltas: { cap: 3 } },
          { text: 'Vous vous consumez trop vite.\nPeau qui fume, souffle court, braise qui vous mange avant l’ennemi.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'humain',
        label: 'Équilibrer toutes les voies',
        ifRace: ['Humain'],
        outcomes: trio(
          { text: 'La polyvalence devient absolue, et rare : chaque voie s’ouvre un peu, aucune ne vous refuse.', deltas: { auto: 3, def: 3, cap: 3, spd: 3, renommee: 4 } },
          { text: 'L’équilibre reste correct.\nPas de sommet, pas de gouffre : juste un humain qui tient toutes les rênes.', deltas: { auto: 1, cap: 1, spd: 1 } },
          { text: 'Vous êtes trop dilué.\nAucune voie ne s’ouvre : vous touchez tout, vous ne saisissez rien.', deltas: { moral: -5 } },
        ),
      },
    ],
  },
  {
    id: 'corruption_hall',
    title: 'Corruption du Hall',
    text: 'Un ancien champion du Hall of Fame revient… corrompu par le Cataclysme.\nSon nom brille encore ; son regard, non.',
    rarity: 'epic',
    tags: ['ombres', 'combat', 'cataclysme'],
    options: [
      {
        id: 'affronter',
        label: 'L’affronter pour purifier son nom',
        outcomes: trio(
          { text: 'La corruption cède.\nLe Hall murmure votre gloire : pierre qui s’éclaircit, mythe rendu propre.', deltas: { renommee: 14, auto: 5, cap: 3, hp: -9, trophies: { cataclysme: 1 } } },
          { text: 'Vous le repoussez.\nIl n’est pas encore vaincu : ombre en retraite, vous en sang, combat à reprendre.', deltas: { renommee: 4, hp: -7 } },
          { text: 'Sa corruption vous marque.\nUne veine noire court sous la peau : le Cataclysme vous a goûté.', deltas: { hp: -13, moral: -7, renommee: 1 } },
        ),
      },
      {
        id: 'raisonner',
        label: 'Tenter de le ramener par la parole',
        outcomes: trio(
          { text: 'Un éclair de lucidité traverse son regard.\nIl part en paix : larmes noires, nom sauvé, votre voix encore tremblante.', deltas: { charisme: 6, renommee: 6, moral: 4 } },
          { text: 'Il hésite un instant, puis fuit.\nVos mots ont ouvert une brèche ; trop étroite pour le sauver.', deltas: { charisme: 2 } },
          { text: 'Vos mots l’enragent.\nLa corruption hurle à travers lui, et vous en prenez le choc.', deltas: { hp: -8, moral: -5 } },
        ),
      },
      {
        id: 'paladin',
        label: 'Riposter la corruption',
        ifClass: ['Paladin', 'Briseur de Sort'],
        outcomes: trio(
          { text: 'Chaque riposte brûle l’ombre.\nLumière sèche, égide qui chante, Hall qui respire enfin.', deltas: { def: 5, renommee: 7, auto: 3 } },
          { text: 'Vous tenez la ligne.\nAssez pour ne pas céder ; pas assez pour purifier tout le Hall.', deltas: { def: 2, hp: -5 } },
          { text: 'La corruption traverse l’égide.\nVotre lumière vacille, et le noir s’installe un instant.', deltas: { hp: -10, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'double_passif',
    title: 'Fusion de passifs',
    text: 'L’Extension du Territoire offre une fusion rare : deux auras, un seul corps.\nL’air vibre déjà trop fort.',
    rarity: 'epic',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'fusion',
        label: 'Accepter la double fusion',
        outcomes: trio(
          { text: 'Deux passifs s’entrelacent.\nVous devenez unique : auras croisées, territoire qui vous reconnaît.', deltas: { cap: 8, renommee: 7, or: 6, trophies: { extension: 1 } } },
          { text: 'La fusion reste instable mais utile.\nÇa tient tant que vous ne respirez pas trop fort.', deltas: { cap: 4, hp: -5 } },
          { text: 'Le territoire vous rejette et vous expulse : sol qui refuse, auras qui hurlent, chute brutale.', deltas: { hp: -12, moral: -6 } },
        ),
      },
      {
        id: 'choisir',
        label: 'N’en garder qu’un, parfaitement',
        outcomes: trio(
          { text: 'La maîtrise est pure.\nUn passif souverain s’installe : net, stable, déjà collé à vos gestes comme une seconde peau.', deltas: { cap: 5, moral: 3 } },
          { text: 'Le choix reste correct.\nPas de génie, pas de catastrophe : juste une aura qui tient bien.', deltas: { cap: 2 } },
          { text: 'Le choix est mauvais, et le regret est immédiat : la mauvaise aura, le mauvais goût, trop tard pour revenir.', deltas: { moral: -4, cap: -1 } },
        ),
      },
      {
        id: 'mage',
        label: 'Forcer une troisième rune',
        ifClass: ['Mage', 'Sorcière', 'Alchimiste'],
        outcomes: trio(
          { text: 'La folie est géniale.\nTrois échos répondent : le territoire plie, votre magie danse, le prix brûle déjà.', deltas: { cap: 10, renommee: 5, hp: -6 } },
          { text: 'La troisième rune cède à moitié.\nAssez pour briller ; trop pour rester sans cicatrice.', deltas: { cap: 4, hp: -4 } },
          { text: 'La surcharge vous plonge dans le noir.\nLe territoire claque comme une porte, et vous avec.', deltas: { hp: -14, moral: -6, cap: -2 } },
        ),
      },
    ],
  },
  {
    id: 'etage_120',
    title: 'Étage 120 du Labyrinthe',
    text: 'Le fond du Labyrinthe Infini s’ouvre.\nLes rois et dieux du couloir ouvrent les yeux : murs vivants, destin trop près.',
    rarity: 'legendary',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'defier',
        label: 'Défier le roi du labyrinthe',
        outcomes: trio(
          { text: 'Le roi tombe.\nVotre nom devient mythe : couloirs qui s’inclinent, pierre qui retient votre sang.', deltas: { renommee: 18, spd: 6, auto: 5, hp: -12, trophies: { labyrinthe: 1 } } },
          { text: 'Vous survolez le roi… puis fuyez digne.\nAssez vu pour grandir ; assez saigné pour ne pas rester.', deltas: { renommee: 6, hp: -9, spd: 2 } },
          { text: 'Le labyrinthe se referme sur vous.\nMurs, ombres, roi qui rit : vous sortez brisé, pas oublié.', deltas: { hp: -16, moral: -8, renommee: 2 } },
        ),
      },
      {
        id: 'pacte',
        label: 'Négocier un pacte avec le couloir',
        outcomes: trio(
          { text: 'Le labyrinthe vous reconnaît.\nUn raccourci éternel s’ouvre : les murs s’écartent pour vous seuls.', deltas: { cap: 7, spd: 5, renommee: 8 } },
          { text: 'Le pacte reste mineur.\nUn passage plus court, un prix discret : le couloir n’offre jamais tout.', deltas: { cap: 3, or: 5 } },
          { text: 'Le pacte était un piège.\nLes murs se referment ; vos mots n’avaient jamais valu grand-chose.', deltas: { moral: -7, hp: -8 } },
        ),
      },
      {
        id: 'voleur',
        label: 'Voler un trésor et disparaître',
        ifClass: ['Voleur'],
        outcomes: trio(
          { text: 'Le butin est légendaire.\nPersonne ne vous a vu : or tiède, ombre propre, sourire de Voleur.', deltas: { or: 25, spd: 5, renommee: 6 } },
          { text: 'Vous fuyez avec un coffre moyen.\nAssez pour la Taverne, pas pour le Hall of Fame.', deltas: { or: 10, spd: 2 } },
          { text: 'L’alarme retentit dans les couloirs.\nLes murs vous chassent : pièges, cris de pierre, course qui finit trop mal.', deltas: { hp: -12, moral: -5 } },
        ),
      },
    ],
  },
  {
    id: 'extinction',
    title: 'EXTINCTION',
    text: 'Le Cataclysme atteint son dixième souffle.\nLe monde retient le sien : ciel fendu, arène de Red trop loin.',
    rarity: 'legendary',
    tags: ['ombres', 'combat', 'cataclysme'],
    options: [
      {
        id: 'tout',
        label: 'Tout donner contre l’entité',
        outcomes: trio(
          { text: 'Votre nom sauve une ère.\nLes chroniques tremblent : sang, lumière, et un silence après le monstre.', deltas: { renommee: 22, auto: 6, cap: 5, hp: -14, trophies: { cataclysme: 1 } } },
          { text: 'Vous retardez l’extinction.\nAssez pour d’autres : votre corps paye, le monde gagne une heure.', deltas: { renommee: 8, hp: -10 } },
          { text: 'Vous êtes balayé.\nLe monde continue sans vous pour l’instant.\nCendres dans la bouche, mythe inachevé.', deltas: { hp: -18, moral: -8, renommee: 3 } },
        ),
      },
      {
        id: 'soutien',
        label: 'Coordonner la dernière ligne',
        outcomes: trio(
          { text: 'Votre voix tient l’armée.\nLa victoire devient collective : ordres nets, cœurs qui suivent, Cataclysme qui cède.', deltas: { charisme: 8, renommee: 12, or: 10 } },
          { text: 'La coordination reste correcte.\nLa ligne tient ; personne ne chante encore votre nom trop fort.', deltas: { charisme: 3, renommee: 3 } },
          { text: 'La panique gagne.\nLa ligne rompt : cris, fuite, votre voix noyée sous le souffle du monstre.', deltas: { charisme: -4, moral: -7, hp: -6 } },
        ),
      },
      {
        id: 'dragonkin',
        label: 'Opposer le souffle du dragon',
        ifRace: ['Dragonkin', 'Cendrés'],
        outcomes: trio(
          { text: 'Deux souffles s’entrechoquent.\nLe vôtre tient : chaleur ancestrale contre fin du monde.', deltas: { cap: 8, def: 5, renommee: 10 } },
          { text: 'Vous absorbez une part du choc.\nÉcailles qui craquent, feu contenu, survie digne.', deltas: { def: 3, hp: -8 } },
          { text: 'Votre souffle s’éteint trop tôt.\nLe Cataclysme avale la flamme, et une part de vous avec.', deltas: { hp: -14, moral: -6 } },
        ),
      },
    ],
  },
  {
    id: 'pointeau_adn',
    title: 'Pointeau ADN',
    text: 'Au bout de l’arène de Red, le Pointeau ADN attend ceux qui ont tout vaincu.\nVerre froid, destin liquide.',
    rarity: 'legendary',
    tags: ['donjons'],
    options: [
      {
        id: 'prendre',
        label: 'Saisir le Pointeau',
        outcomes: trio(
          { text: 'Le pouvoir change votre essence.\nLe changement est rare et irréversible : veines qui chantent, Red qui retient son souffle.', deltas: { auto: 5, def: 5, cap: 5, spd: 5, renommee: 12, trophies: { coop: 1 } } },
          { text: 'Le Pointeau pulse… puis se calme.\nUn goût de possible ; pas encore la métamorphose.', deltas: { auto: 2, cap: 2, renommee: 4 } },
          { text: 'Votre corps rejette le pouvoir et n’est pas prêt : convulsions, froid, et le Pointeau qui se détourne.', deltas: { hp: -12, moral: -6 } },
        ),
      },
      {
        id: 'partager',
        label: 'Le partager avec votre allié',
        outcomes: trio(
          { text: 'Le duo devient légendaire.\nRed applaudit : deux mains, un destin, or et gloire qui se partagent juste.', deltas: { charisme: 7, renommee: 10, or: 12, trophies: { coop: 1 } } },
          { text: 'Le partage reste honnête.\nPas de mythe, pas de trahison : juste deux parts égales et un silence correct.', deltas: { charisme: 3, or: 5 } },
          { text: 'La jalousie s’installe.\nL’alliance se fissure : regards de travers, doigts qui se crispent sur le verre.', deltas: { charisme: -4, moral: -5 } },
        ),
      },
      {
        id: 'garder',
        label: 'Le sceller pour plus tard',
        outcomes: trio(
          { text: 'Vous montrez la patience d’un sage.\nLe sceau vous bénit : pouvoir contenu, esprit clair, Red qui hoche.', deltas: { moral: 6, cap: 3, renommee: 3 } },
          { text: 'Vous repartez les mains vides pour l’instant.\nLe Pointeau attend ; vous aussi.', deltas: {} },
          { text: 'Quelqu’un le vole derrière vous.\nPas de bruit : juste le vide où le destin aurait dû être.', deltas: { moral: -7, renommee: -3 } },
        ),
      },
    ],
  },
  {
    id: 'ornn_jugement',
    title: 'Défi mythique d’Ornn',
    text: 'Le Dieu de la Forge vous fixe.\nCe n’est pas une offrande, c’est un duel.\nSans {arme_legendaire}, c’est une folie.\nAvec elle, le choc devient tenable ; si Ornn l’a lui-même reforgée, le fer incline enfin le destin.',
    rarity: 'legendary',
    tags: ['forge', 'combat'],
    options: [
      {
        id: 'affronter_maintenant',
        label: 'Lancer le défi tout de suite (très dur sans légendaire)',
        ambitionPayoff: true,
        check: { auto: 1.2, def: 1.0, hp: 0.3 },
        outcomes: trio(
          { text: 'Un miracle rare se produit : sans lignée mythique, vous tenez quand même.\nOrnn incline la tête, brûlant, mérité, presque impossible.', deltas: { auto: 5, def: 3, renommee: 10, hp: -20, trophies: { forge: 1 } }, ambitionPayoff: true },
          { text: 'Vous sortez à demi cendre.\nLe dieu n’est pas vaincu ; vous non plus, à peine.', deltas: { def: 1, auto: 1, hp: -16, moral: -3 }, ambitionPayoff: true },
          { text: 'Vous êtes arrivé trop tôt.\nLe marteau divin vous écrase : ambition en miettes, forge qui ricane.', deltas: { hp: -24, moral: -10, renommee: -5, auto: -1 } },
          [18, 32, 50],
        ),
      },
      {
        id: 'affronter_legendaire',
        label: 'L’affronter avec {arme_legendaire}',
        ambitionPayoff: true,
        require: { weaponRarities: ['légendaire'] },
        check: { auto: 1.1, def: 1.1 },
        outcomes: trio(
          { text: 'Fer contre dieu.\nVotre {arme_legendaire} chante ; Ornn forge le respect dans l’étincelle du choc.', deltas: { auto: 10, def: 6, renommee: 12, hp: -10, or: -4, trophies: { forge: 1 } }, ambitionPayoff: true },
          { text: 'Le duel reste égal.\nLe dieu s’amuse ; vous survévez avec une rune et des brûlures dignes d’un mythe.', deltas: { auto: 4, def: 3, renommee: 5, hp: -11 }, ambitionPayoff: true },
          { text: 'Même le légendaire plie.\nOrnn vous renvoie, plus sage, plus brisé, encore vivant.', deltas: { hp: -15, moral: -5, renommee: -1 } },
        ),
      },
      {
        id: 'reporter',
        label: 'Reporter le défi (arme légendaire… ou forgée)',
        outcomes: trio(
          {
            text: 'Ornn grogne un instant, puis accepte.\n« Reviens quand le fer sera digne, mieux encore, quand je l’aurai touché. »\nLe défi reste ouvert.',
            deltas: { moral: 3, renommee: 1 },
            flags: { ornn_duel_pending: true },
          },
          {
            text: 'Vous reculez d’un pas.\nPas de honte : seulement la forge qui attend, et vous aussi.',
            deltas: { moral: 1 },
            flags: { ornn_duel_pending: true },
          },
          {
            text: 'Un murmure court : peureux.\nOrnn ne dit rien ; le défi, lui, ne s’efface pas.',
            deltas: { moral: -2, renommee: -1 },
            flags: { ornn_duel_pending: true },
          },
        ),
      },
      {
        id: 'bastion',
        label: 'Tenir le rempart face au dieu',
        ambitionPayoff: true,
        ifClass: ['Bastion', 'Paladin'],
        outcomes: trio(
          { text: 'Le mur tient.\nOrnn reconnaît l’égide : chaque choc enfoncé, chaque pas digne d’être forgé.', deltas: { def: 9, renommee: 7, hp: -8, trophies: { forge: 1 } }, ambitionPayoff: true },
          { text: 'Vous encaissez l’essentiel.\nLe rempart tremble ; le dieu n’a pas encore décidé.', deltas: { def: 4, hp: -9 }, ambitionPayoff: true },
          { text: 'Le rempart cède.\nUne faille, un coup de chaleur, et votre ligne rompt.', deltas: { hp: -14, moral: -5 } },
        ),
      },
    ],
  },
  {
    id: 'pendule_chronos',
    title: 'Pendule de Chronos',
    text: 'Un pendule d’argent bat hors du temps.\nUne saison peut s’étirer… ou se contracter.\nLe pendule marque tic, puis tac, et le destin écoute.',
    rarity: 'legendary',
    tags: ['ombres', 'loot'],
    options: [
      {
        id: 'accelerer',
        label: 'Accélérer votre destin',
        outcomes: trio(
          { text: 'Deux saisons d’expérience passent en un battement : muscles qui se souviennent, cicatrices déjà vieilles.', deltas: { auto: 5, cap: 5, spd: 5, renommee: 8, hp: -6 } },
          { text: 'Vous gagnez un léger surplus de temps.\nAssez pour un geste de plus ; pas assez pour voler une ère.', deltas: { spd: 3, cap: 2 } },
          { text: 'Le temps vous mord.\nVous vieillissez trop vite : articulations lourdes, miroir cruel, moral en cendre.', deltas: { hp: -12, moral: -5, def: -2 } },
        ),
      },
      {
        id: 'figer',
        label: 'Figer un mauvais présage',
        outcomes: trio(
          { text: 'Le malheur passe à côté.\nLa chance est rare : le coup qui devait vous trouver s’égare ailleurs.', deltas: { moral: 8, hp: 6, renommee: 4 } },
          { text: 'Le présage s’atténue.\nLa menace reste ; elle mord moins fort.\nVous respirez un peu mieux.', deltas: { moral: 3 } },
          { text: 'Vous figez votre propre élan au mauvais moment.\nJambes lourdes, destin en pause, frustration glacée.', deltas: { spd: -2, moral: -4 } },
        ),
      },
      {
        id: 'rendre',
        label: 'Rendre le pendule au silence',
        outcomes: trio(
          { text: 'Chronos approuve votre geste.\nLa bénédiction reste discrète : le tic-tac s’apaise, votre souffle aussi.', deltas: { cap: 4, moral: 5, charisme: 3 } },
          { text: 'Le silence revient, et avec lui une paix relative.\nLe métal se range ; le temps reprend sans vous demander votre avis.', deltas: { moral: 2 } },
          { text: 'Le pendule refuse d’être rendu.\nIl bat plus fort, et quelque chose en vous se déchire.', deltas: { moral: -5, hp: -3 } },
        ),
      },
    ],
  },

  {
    id: 'arme_upgrade_chemin',
    title: 'L’appel du fer',
    text: 'Votre {arme} vibre.\nUne forge ambulante, un coffre, un artisan… quelque chose peut la faire évoluer vers {arme_rare}.',
    rarity: 'uncommon',
    tags: ['arme', 'arme_upgrade', 'forge'],
    options: [
      {
        id: 'forger',
        label: 'Confier {arme} à l’artisan',
        outcomes: trio(
          {
            text: 'Le métal se tend.\nUne nouvelle forme apparaît : étincelles, marteau juste, et {arme} qui renaît sous vos doigts.',
            deltas: { or: -5, hp: -2 },
            weaponProgress: 'upgrade',
          },
          { text: 'Le travail reste correct, sans miracle.\nLe fil s’améliore ; la légende, elle, attend encore.', deltas: { auto: 1, or: -2 } },
          { text: 'Il abîme le pommeau.\nLa rage reste contenue : fer abîmé, or parti, confiance en l’artisan en cendres.', deltas: { or: -4, moral: -4 } },
        ),
      },
      {
        id: 'coffre',
        label: 'Chercher les plans d’upgrade dans un coffre',
        outcomes: trio(
          {
            text: 'Vous trouvez les plans et appliquez la méthode : schémas nets, métal qui répond, lignée qui avance.',
            deltas: { cap: 1 },
            weaponProgress: 'upgrade',
          },
          { text: 'Les plans restent incomplets.\nL’inspiration est tiède : assez pour rêver, pas assez pour forger vrai.', deltas: { cap: 1, or: 2 } },
          { text: 'C’est un piège.\nLe coffre claque sur vos doigts : sang, jurons, et plans qui s’envolent en cendres.', deltas: { hp: -7, moral: -3 } },
        ),
      },
      {
        id: 'patienter',
        label: 'Garder {arme} telle quelle',
        outcomes: trio(
          { text: 'La patience paie.\nVous affinez votre geste : même sans upgrade, la main apprend encore le fer.', deltas: { moral: 3, spd: 1 } },
          { text: 'Rien ne change vraiment.\n{arme} reste {arme} ; le destin, lui, bat le pied ailleurs.', deltas: {} },
          { text: 'Vous doutez de votre choix d’arme.\nChaque silence de la Forge Ornn pèse un peu plus.', deltas: { moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'arme_legendaire_revelation',
    title: 'Révélation de lignée',
    text: 'Un ancien murmure : la lignée de {arme} culmine en {arme_legendaire}.\nTrès peu y touchent : feu, rune, destin serré.',
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
            text: 'Le ciel de la forge se fend.\n{arme_legendaire} prend forme : lumière, métal, et votre nom dessus.',
            deltas: { renommee: 6, hp: -8, or: -6, trophies: { forge: 1 } },
            weaponProgress: 'legendary',
          },
          {
            variant: 'neutre',
            weight: 45,
            text: 'Le rituel n’atteint pas le mythe… mais avance d’un cran.\nLa lignée respire encore.',
            deltas: { or: -3, hp: -4 },
            weaponProgress: 'upgrade',
          },
          {
            variant: 'malus',
            weight: 45,
            text: 'Le rituel échoue.\nVotre esprit vacille : runes qui mentent, forge qui se tait, goût de cendre.',
            deltas: { hp: -10, moral: -6 },
          },
        ],
      },
      {
        id: 'etudier',
        label: 'Étudier les runes sans forcer',
        outcomes: trio(
          { text: 'La compréhension s’installe.\nVotre prochain upgrade sera plus sûr : les runes ont enfin un sens clair.', deltas: { cap: 4, moral: 2 } },
          { text: 'Quelques notes restent utiles.\nAssez pour ne pas se brûler ; pas assez pour réveiller la lignée.', deltas: { cap: 1 } },
          { text: 'Les runes mentent.\nLe vertige suit : symboles qui dansent, foi qui lâche, forge trop loin.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'renoncer',
        label: 'Renoncer au mythe pour cette saison',
        outcomes: trio(
          { text: 'L’humilité vous guide.\nLa Taverne respecte ça parfois.\nUn verre levé, un regard moins dur.', deltas: { charisme: 2, moral: 3 } },
          { text: 'Vous repartez sans forcer le mythe.\nPas de mythe, pas de scandale : juste {arme} au côté et la saison qui continue.', deltas: {} },
          { text: 'On murmure la lâcheté.\nLe mot court plus vite que vous jusqu’à l’arène.', deltas: { renommee: -3, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'college_sous_classe',
    title: 'Collège Kunugigaoka : sous-classe',
    text: 'Koro Sensei ouvre le registre des voies.\nUne sous-classe peut redéfinir votre classe… si vous en êtes digne.',
    rarity: 'rare',
    tags: ['donjons', 'subclass'],
    options: [
      {
        id: 'placeholder',
        label: 'Écouter le discours d’ouverture',
        outcomes: trio(
          { text: 'Le discours inspire.\nLes voies s’éclaircissent : chaque sous-classe a déjà un visage dans votre tête.', deltas: { cap: 2, moral: 2 } },
          { text: 'Le discours s’étire trop long.\nVous retenez l’essentiel entre deux bâillements ; le reste glisse.', deltas: {} },
          { text: 'Vous ratez le début.\nPortes qui claquent, regard du prof, moral déjà en retard.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'placeholder2',
        label: 'Prendre des notes',
        outcomes: trio(
          { text: 'Vous prenez des notes utiles pour plus tard : schémas, noms de voies, un croquis qui pourrait changer une carrière.', deltas: { cap: 1, charisme: 1 } },
          { text: 'Quelques griffonnages restent sur la page.\nAssez pour prouver que vous étiez là ; pas pour briller demain.', deltas: {} },
          { text: 'Votre stylo casse.\nEncre partout, pages gâchées, et le Collège qui continue sans vous.', deltas: { moral: -1 } },
        ),
      },
      {
        id: 'placeholder3',
        label: 'Quitter l’amphi',
        outcomes: trio(
          { text: 'Vous repartez de l’amphi.\nLe Collège reste ouvert : air libre, choix reporté, conscience un peu plus légère.', deltas: { moral: 1 } },
          { text: 'Le couloir est vide, le discours derrière la porte.\nVous n’avez ni gagné ni perdu : vous avez juste quitté.', deltas: {} },
          { text: 'On note votre absence.\nUne croix sur le registre ; un murmure qui suivra jusqu’à la Taverne.', deltas: { renommee: -1 } },
        ),
      },
    ],
  },
  {
    id: 'tournoi_qualification',
    title: 'Qualifications du samedi',
    text: 'Avant la couronne, il faut un ticket.\nL’arène des qualifications sent la sueur et l’encre des listes : un seul passage mène au vrai tournoi.',
    rarity: 'uncommon',
    tags: ['tournoi', 'combat'],
    options: [
      {
        id: 'combattre',
        label: 'Gagner votre place dans le sang',
        check: { auto: 1.1, spd: 0.7, def: 0.5 },
        outcomes: trio(
          { text: 'Vous tranchez le bracket.\nVotre nom s’inscrit sur la liste du samedi, l’encre encore chaude.', deltas: { renommee: 6, auto: 3, moral: 4, hp: -4 } },
          { text: 'Les matchs restent serrés, et la place s’obtient sans éclat.\nVous êtes dedans ; le public, lui, attend encore.', deltas: { renommee: 2, hp: -5 } },
          { text: 'Vous êtes éliminé dès les poules.\nLa liste se ferme sans vous : papier froid, regard des autres.', deltas: { renommee: -3, moral: -6, hp: -6 } },
        ),
      },
      {
        id: 'parade',
        label: 'Impressionner les juges en parade',
        check: { charisme: 1.2, renommee: 0.5 },
        outcomes: trio(
          { text: 'Les juges hochent.\nUne wildcard vous tombe dans la main : sourire, tampon, destin ouvert.', deltas: { renommee: 5, charisme: 3, moral: 3 } },
          { text: 'La parade reste correcte, et la place arrive de justesse.\nAssez pour entrer ; pas assez pour qu’on crie votre nom.', deltas: { charisme: 1, renommee: 1 } },
          { text: 'Trop de style, pas assez de fond.\nOn vous raye d’un trait : l’arène n’a pas ri.', deltas: { moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'parier_place',
        label: 'Racheter une place à la Taverne',
        check: { or: 0.2, charisme: 0.8 },
        outcomes: trio(
          { text: 'Un parieur craque.\nVotre place est payée : or qui brûle, billet qui sent la bière et la chance.', deltas: { or: -10, renommee: 2, moral: 2 } },
          { text: 'Le marché reste tiède.\nVous payez trop pour une place moyenne, mais vous êtes inscrit.', deltas: { or: -6 } },
          { text: 'C’est une arnaque.\nPlus d’or, pas de ticket : rires dans le fond de la Taverne.', deltas: { or: -8, moral: -4, renommee: -1 } },
        ),
      },
    ],
  },
  {
    id: 'tournoi_qualif_finale',
    title: 'Porte de la finale',
    text: 'Les demi-finales commencent.\nL’air de l’arène est plus dense : une seule victoire ouvre la porte de la couronne, l’autre renvoie aux gradins.',
    rarity: 'rare',
    tags: ['tournoi', 'combat'],
    options: [
      {
        id: 'forcer',
        label: 'Forcer l’entrée en finale',
        check: { auto: 1.3, spd: 0.8, def: 0.6 },
        outcomes: trio(
          { text: 'Vous brisez le dernier obstacle.\nLa finale vous attend : torches, hush, couronne déjà trop proche.', deltas: { renommee: 8, auto: 3, hp: -6, moral: 5 } },
          { text: 'Le combat s’étire longtemps, et la qualification s’arrache.\nVous passez ; les jambes tremblent encore.', deltas: { renommee: 3, hp: -7 } },
          { text: 'La porte se referme.\nVous restez demi-finaliste, pas finaliste : le Hall n’écrit pas les presque.', deltas: { renommee: -2, moral: -7, hp: -8 } },
        ),
      },
      {
        id: 'lire',
        label: 'Lire l’adversaire avant le coup',
        check: { cap: 1.1, charisme: 0.6 },
        outcomes: trio(
          { text: 'Vous voyez la faille.\nUn seul geste suffit : la finale s’ouvre comme une porte trop bien huilée.', deltas: { cap: 3, renommee: 6, spd: 2 } },
          { text: 'La lecture reste correcte, le duel serré.\nVous passez sans panache ; la couronne, elle, attend encore.', deltas: { cap: 1, hp: -4 } },
          { text: 'Vous avez mal lu.\nLe contre est piégé ; les gradins comprennent avant vous.', deltas: { moral: -5, hp: -7, renommee: -1 } },
        ),
      },
      {
        id: 'public',
        label: 'Soulever le public pour le momentum',
        check: { charisme: 1.4, renommee: 0.6 },
        outcomes: trio(
          { text: 'L’arène scande votre nom.\nL’adversaire plie sous le bruit, et vous entrez en finale porté par la foule.', deltas: { charisme: 4, renommee: 7, moral: 4 } },
          { text: 'Quelques cris suffisent pour tenir.\nLa qualification arrive sans mythe.', deltas: { charisme: 1, renommee: 2 } },
          { text: 'Le public se tait.\nVotre élan meurt avant le dernier échange.', deltas: { moral: -6, renommee: -2, hp: -5 } },
        ),
      },
    ],
  },
];
