/**
 * ~30 événements supplémentaires Cave Destiny (univers Duels de Cave).
 * Raretés variées : common → legendary.
 */

import { trio } from './caveDestinyEventUtils';

export const CAVE_DESTINY_EVENTS_EXTRA = [
  {
    id: 'entrainement',
    title: 'Salle d’entraînement',
    text: 'Les mannequins attendent. Pas de gloire ici — seulement la sueur et le fer.',
    rarity: 'common',
    tags: ['combat'],
    options: [
      {
        id: 'sparring',
        label: 'Enchaîner les duels d’entraînement',
        outcomes: trio(
          { text: 'Vos gestes se durcissent. Le corps répond.', deltas: { puissance: 3, endurance: 2, forme: -3 } },
          { text: 'Session correcte. Rien d’éclatant.', deltas: { puissance: 1, forme: -2 } },
          { text: 'Vous forcez trop. Une entorse vous rappelle à l’ordre.', deltas: { forme: -8, moral: -2 } },
        ),
      },
      {
        id: 'technique',
        label: 'Travailler une feinte précise',
        outcomes: trio(
          { text: 'La feinte devient réflexe.', deltas: { vitesse: 3, magie: 1 } },
          { text: 'Progrès discret.', deltas: { vitesse: 1 } },
          { text: 'Vous confondez les enchaînements. Frustration.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'repos',
        label: 'Observer les autres s’entraîner',
        outcomes: trio(
          { text: 'Vous volez une idée de garde.', deltas: { endurance: 2, moral: 2 } },
          { text: 'Spectateur utile… à peine.', deltas: { moral: 1 } },
          { text: 'Vous vous ennuyez. La forme baisse.', deltas: { forme: -3, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'encyclopedie',
    title: 'L’Encyclopédie',
    text: 'Grimoires, bestiaires, notes de vainqueurs. Le savoir attend ceux qui lisent.',
    rarity: 'common',
    tags: ['ombres'],
    options: [
      {
        id: 'bestiaire',
        label: 'Étudier le bestiaire des donjons',
        outcomes: trio(
          { text: 'Vous retenez une faiblesse de boss.', deltas: { magie: 3, renommee: 1 } },
          { text: 'Quelques notes utiles.', deltas: { magie: 1 } },
          { text: 'Trop de pages. Rien ne s’imprime.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'armes',
        label: 'Comparer les lignées d’armes',
        outcomes: trio(
          { text: 'Vous comprenez mieux le lien arme–bras.', deltas: { puissance: 2, magie: 2 } },
          { text: 'Lecture correcte.', deltas: { puissance: 1 } },
          { text: 'Vous mélangez Mjöllnir et Gungnir. Honte douce.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'dormir',
        label: 'S’assoupir sur un tome',
        outcomes: trio(
          { text: 'Un rêve étrange vous inspire.', deltas: { moral: 4, magie: 1 } },
          { text: 'Sieste. Point.', deltas: { forme: 3 } },
          { text: 'On vous réveille d’un rire. Ego froissé.', deltas: { charisme: -2, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'repos_taverne',
    title: 'Repos à la Taverne',
    text: 'Bières, chants, chibis endormis sur les tables. Parfois, ne rien faire est un choix.',
    rarity: 'common',
    tags: ['social'],
    options: [
      {
        id: 'boire',
        label: 'Boire avec les habitués',
        outcomes: trio(
          { text: 'La salle vous adopte. Moral au beau fixe.', deltas: { moral: 6, charisme: 2, or: -3, forme: 2 } },
          { text: 'Soirée tiède, tête légère.', deltas: { moral: 2, or: -1 } },
          { text: 'Trop bu. Le lendemain punit.', deltas: { forme: -6, moral: -2, or: -4 } },
        ),
      },
      {
        id: 'dormir',
        label: 'Louer une chambre jusqu’à l’aube',
        outcomes: trio(
          { text: 'Sommeil réparateur. Vous renaîtrez demain.', deltas: { forme: 10, moral: 3, or: -2 } },
          { text: 'Repos correct.', deltas: { forme: 5, or: -1 } },
          { text: 'Matelas dur, rêves agités.', deltas: { forme: 1, moral: -2, or: -2 } },
        ),
      },
      {
        id: 'chanter',
        label: 'Rejoindre le chœur improvisé',
        outcomes: trio(
          { text: 'Votre voix porte. On vous offre une tournée.', deltas: { charisme: 4, moral: 3 } },
          { text: 'Vous fredonnez correctement.', deltas: { charisme: 1 } },
          { text: 'Fausse note. On change de sujet.', deltas: { charisme: -3, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'sanglier',
    title: 'Sanglier de la clairière',
    text: 'Dans la Forêt enchantée, un sanglier charge. Petits yeux, gros problème.',
    rarity: 'common',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'affronter',
        label: 'Tenir le choc de front',
        outcomes: trio(
          { text: 'Le sanglier s’effondre. Viande et gloire mineure.', deltas: { puissance: 2, or: 4, forme: -3 } },
          { text: 'Vous le chassez… après une course.', deltas: { endurance: 1, forme: -4 } },
          { text: 'Il vous renverse. Départ humiliant.', deltas: { forme: -9, moral: -3 } },
        ),
      },
      {
        id: 'esquiver',
        label: 'L’attirer hors du sentier',
        outcomes: trio(
          { text: 'Piège parfait. Butin sans une égratignure.', deltas: { vitesse: 3, or: 5 } },
          { text: 'Vous gagnez… salement.', deltas: { or: 2, forme: -2 } },
          { text: 'Vous trébuchez. Les défenses vous trouvent.', deltas: { forme: -7, moral: -2 } },
        ),
      },
      {
        id: 'fuir',
        label: 'Contourner le territoire',
        outcomes: trio(
          { text: 'Sagesse. Vous trouvez un autre sentier riche.', deltas: { or: 3, moral: 1 } },
          { text: 'Vous perdez du temps, rien de plus.', deltas: {} },
          { text: 'Le sanglier vous suit quand même.', deltas: { forme: -5, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'duel_ami',
    title: 'Duel amical',
    text: 'Un autre combattant propose un affrontement sans enjeu… enfin, presque.',
    rarity: 'common',
    tags: ['combat', 'social'],
    options: [
      {
        id: 'accepter',
        label: 'Accepter le duel',
        outcomes: trio(
          { text: 'Victoire nette. Respect mutuel.', deltas: { renommee: 3, puissance: 2, charisme: 2 } },
          { text: 'Match serré. Vous apprenez.', deltas: { endurance: 1, forme: -3 } },
          { text: 'Défaite amicale… l’ego moins.', deltas: { moral: -5, forme: -4 } },
        ),
      },
      {
        id: 'conseil',
        label: 'Échanger des conseils après l’échauffement',
        outcomes: trio(
          { text: 'Astuce précieuse sur une capacité.', deltas: { magie: 2, charisme: 2 } },
          { text: 'Conversation polie.', deltas: { charisme: 1 } },
          { text: 'Malentendu. L’ambiance se gâte.', deltas: { charisme: -2, moral: -2 } },
        ),
      },
      {
        id: 'refuser',
        label: 'Décliner poliment',
        outcomes: trio(
          { text: 'On respecte votre prudence.', deltas: { moral: 2 } },
          { text: 'Rien ne se passe.', deltas: {} },
          { text: 'On murmure « peureux ».', deltas: { renommee: -2, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'ours_bosquet',
    title: 'Ours du bosquet',
    text: 'Plus loin dans la Forêt enchantée, l’ours ne négocie pas.',
    rarity: 'uncommon',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'rush',
        label: 'Frapper avant qu’il se lève',
        outcomes: trio(
          { text: 'Assaut parfait. Le bosquet vous appartient.', deltas: { puissance: 4, or: 7, forme: -5, trophies: { donjon: 1 } } },
          { text: 'Victoire difficile.', deltas: { puissance: 1, forme: -6, or: 2 } },
          { text: 'Une patte vous envoie au sol.', deltas: { forme: -11, moral: -4 } },
        ),
      },
      {
        id: 'piege',
        label: 'Utiliser le terrain contre lui',
        outcomes: trio(
          { text: 'Racines, pente, surprise. Beau travail.', deltas: { magie: 3, vitesse: 2, or: 5 } },
          { text: 'Le piège aide un peu.', deltas: { magie: 1, forme: -3 } },
          { text: 'Vous tombez dans votre propre embuscade.', deltas: { forme: -8, moral: -3 } },
        ),
      },
      {
        id: 'recul',
        label: 'Reculer vers la clairière',
        outcomes: trio(
          { text: 'Vous sauvez votre peau… et un peu d’orgueil.', deltas: { moral: 1, forme: 1 } },
          { text: 'Retraite propre.', deltas: {} },
          { text: 'L’ours vous poursuit jusqu’au sentier.', deltas: { forme: -6, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'classement_pvp',
    title: 'Classement PvP',
    text: 'Les duels classés appellent. Chaque défaite s’affiche. Chaque victoire aussi.',
    rarity: 'uncommon',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'grimper',
        label: 'Enchaîner les duels pour grimper',
        outcomes: trio(
          { text: 'Série gagnante. Votre rang monte.', deltas: { renommee: 8, puissance: 3, forme: -6, trophies: { pvp: 1 } } },
          { text: 'Équilibre victoires / défaites.', deltas: { renommee: 2, forme: -4 } },
          { text: 'Dégringolade. Le classement est cruel.', deltas: { renommee: -6, moral: -7, forme: -5 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier les styles du top',
        outcomes: trio(
          { text: 'Vous adaptez une garde du haut du tableau.', deltas: { magie: 3, vitesse: 2 } },
          { text: 'Quelques idées.', deltas: { magie: 1 } },
          { text: 'Trop d’infos. Paralysie.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'pause',
        label: 'Rester hors du classement cette saison',
        outcomes: trio(
          { text: 'Repos stratégique. Vous revenez frais.', deltas: { forme: 5, moral: 2 } },
          { text: 'Vous regardez les autres progresser.', deltas: { moral: -1 } },
          { text: 'On vous oublie du tableau.', deltas: { renommee: -3 } },
        ),
      },
    ],
  },
  {
    id: 'golem_os',
    title: 'Golem squelettique',
    text: 'Dans la galerie d’os de la Tour du Mage, quelque chose s’assemble.',
    rarity: 'uncommon',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'briser',
        label: 'Briser le noyau avant qu’il se forme',
        outcomes: trio(
          { text: 'Les os s’effondrent. Vous grimpez.', deltas: { magie: 4, puissance: 2, forme: -4 } },
          { text: 'Combat long. Victoire.', deltas: { magie: 2, forme: -6 } },
          { text: 'Le golem se referme sur vous.', deltas: { forme: -10, moral: -4 } },
        ),
      },
      {
        id: 'detour',
        label: 'Contourner la galerie',
        outcomes: trio(
          { text: 'Détour intelligent. Passif mineur trouvé.', deltas: { magie: 2, or: 3 } },
          { text: 'Vous perdez un étage de temps.', deltas: { forme: -2 } },
          { text: 'Cul-de-sac. Le golem vous attendait.', deltas: { forme: -8, moral: -3 } },
        ),
      },
      {
        id: 'nain',
        label: 'Frapper comme un forgeron nain',
        ifRace: ['Nain'],
        outcomes: trio(
          { text: 'Un coup. Le crâne éclate.', deltas: { puissance: 5, endurance: 2, renommee: 2 } },
          { text: 'Bon travail de masse.', deltas: { puissance: 2, forme: -3 } },
          { text: 'L’os est plus dur que prévu.', deltas: { forme: -7, moral: -2 } },
        ),
      },
      {
        id: 'briseur',
        label: 'Étouffer sa magie d’animation',
        ifClass: ['Briseur de Sort', 'Mage'],
        outcomes: trio(
          { text: 'L’égide coupe le fil. Silence d’os.', deltas: { magie: 5, renommee: 2 } },
          { text: 'Magie affaiblie, combat plus simple.', deltas: { magie: 2 } },
          { text: 'Le golem ignore votre égide.', deltas: { magie: -1, forme: -6 } },
        ),
      },
    ],
  },
  {
    id: 'college_koro',
    title: 'Collège Kunugigaoka',
    text: 'Des sous-classes étranges s’enseignent ici. Le professeur sourit trop.',
    rarity: 'uncommon',
    tags: ['donjons'],
    options: [
      {
        id: 'cours',
        label: 'Suivre un cours intensif',
        outcomes: trio(
          { text: 'Leçon assimilée. Votre style s’affine.', deltas: { magie: 3, vitesse: 2, moral: 2 } },
          { text: 'Vous retenez l’essentiel.', deltas: { magie: 1 } },
          { text: 'Trop de théories. Maux de tête.', deltas: { moral: -3, forme: -2 } },
        ),
      },
      {
        id: 'examen',
        label: 'Passer l’examen surprise',
        outcomes: trio(
          { text: 'Réussi. Le collège applaudit.', deltas: { renommee: 5, magie: 2, or: 4 } },
          { text: 'Juste la moyenne.', deltas: { renommee: 1 } },
          { text: 'Échec. Tableau noir de la honte.', deltas: { renommee: -3, moral: -5 } },
        ),
      },
      {
        id: 'fugue',
        label: 'Sécher pour explorer les couloirs',
        outcomes: trio(
          { text: 'Cachette secrète. Petit trésor.', deltas: { or: 8, vitesse: 1 } },
          { text: 'Rien trouvé.', deltas: {} },
          { text: 'Pris sur le fait. Punition.', deltas: { moral: -4, renommee: -2 } },
        ),
      },
    ],
  },
  {
    id: 'rat_grimoires',
    title: 'Rat des grimoires',
    text: 'Au hall de la Tour, un rat volant un parchemin… magique.',
    rarity: 'common',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'courir',
        label: 'Courir après le rat',
        outcomes: trio(
          { text: 'Vous récupérez le parchemin. Sagesse mineure.', deltas: { magie: 3, vitesse: 2 } },
          { text: 'Course absurde. Parchemin déchiré à moitié.', deltas: { magie: 1, forme: -2 } },
          { text: 'Vous trébuchez. Le rat s’enfuit.', deltas: { moral: -3, forme: -2 } },
        ),
      },
      {
        id: 'piege',
        label: 'Appâter le rat avec une miette',
        outcomes: trio(
          { text: 'Le rat négocie. Vous gagnez une rune.', deltas: { magie: 2, or: 2, charisme: 1 } },
          { text: 'Il prend la miette… et part.', deltas: { or: -1 } },
          { text: 'Plus de rats. Chaos.', deltas: { forme: -4, moral: -2 } },
        ),
      },
      {
        id: 'ignorer',
        label: 'Ignorer et monter',
        outcomes: trio(
          { text: 'Focus. Vous gagnez un étage sans détour.', deltas: { renommee: 1, forme: 1 } },
          { text: 'Rien de spécial.', deltas: {} },
          { text: 'Le parchemin vous manquera plus tard.', deltas: { moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'blessure',
    title: 'Blessure tenace',
    text: 'Une entaille refuse de se fermer. La forme vacille.',
    rarity: 'uncommon',
    tags: ['social'],
    options: [
      {
        id: 'soigner',
        label: 'Chercher un soigneur à la Taverne',
        outcomes: trio(
          { text: 'Mains expertes. Vous respirez à nouveau.', deltas: { forme: 12, or: -5, moral: 3 } },
          { text: 'Pansement correct.', deltas: { forme: 6, or: -2 } },
          { text: 'Mauvais remède. Ça empire.', deltas: { forme: -4, or: -3, moral: -2 } },
        ),
      },
      {
        id: 'forcer',
        label: 'Combattre quand même',
        outcomes: trio(
          { text: 'La douleur vous aiguise.', deltas: { puissance: 3, forme: -5, moral: 2 } },
          { text: 'Vous tenez… juste.', deltas: { forme: -3 } },
          { text: 'La blessure s’ouvre. Effondrement.', deltas: { forme: -14, moral: -6 } },
        ),
      },
      {
        id: 'healer',
        label: 'Vous soigner vous-même',
        ifClass: ['Healer', 'Alchimiste'],
        outcomes: trio(
          { text: 'Votre art vous sauve. Élégance.', deltas: { forme: 10, magie: 2 } },
          { text: 'Soin partiel.', deltas: { forme: 5 } },
          { text: 'Mauvais dosage. Vertiges.', deltas: { forme: -3, moral: -2 } },
        ),
      },
      {
        id: 'repos',
        label: 'Rester alité une saison',
        outcomes: trio(
          { text: 'Guérison complète. Patience récompensée.', deltas: { forme: 14, moral: 2, renommee: -1 } },
          { text: 'Vous récupérez.', deltas: { forme: 7 } },
          { text: 'L’inactivité ronge le moral.', deltas: { forme: 3, moral: -5, renommee: -2 } },
        ),
      },
    ],
  },
  {
    id: 'salameche_red',
    title: 'Salamèche dans l’arène',
    text: 'Chez Red, une flamme cracheuse bloque le passage. Petite. Vicieuse.',
    rarity: 'uncommon',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'eau',
        label: 'Étouffer la flamme d’un sort d’eau',
        outcomes: trio(
          { text: 'Vapeur. Le chemin s’ouvre.', deltas: { magie: 3, or: 4, renommee: 2 } },
          { text: 'La flamme baisse… puis revient.', deltas: { magie: 1, forme: -3 } },
          { text: 'Vous ratez. Brûlure.', deltas: { forme: -8, moral: -2 } },
        ),
      },
      {
        id: 'corps',
        label: 'Passer en force',
        outcomes: trio(
          { text: 'Vous encaisez et tranchez.', deltas: { endurance: 3, puissance: 2, forme: -4 } },
          { text: 'Passage brûlant.', deltas: { forme: -5, or: 2 } },
          { text: 'Trop de feu. Recul.', deltas: { forme: -9, moral: -3 } },
        ),
      },
      {
        id: 'turtle',
        label: 'Avancer sous carapace',
        ifRace: ['Turtlekin', 'Écailleux', 'Dragonkin'],
        outcomes: trio(
          { text: 'Les flammes glissent. Avancée royale.', deltas: { endurance: 5, renommee: 2 } },
          { text: 'Vous tiédisez, mais avancez.', deltas: { endurance: 2, forme: -2 } },
          { text: 'Même la carapace chauffe trop.', deltas: { forme: -7 } },
        ),
      },
    ],
  },
  {
    id: 'arme_commune',
    title: 'Coffre d’arme',
    text: 'Dans la Grotte aux merveilles, un coffre grince. Une arme commune pulse faiblement.',
    rarity: 'uncommon',
    tags: ['donjons', 'loot'],
    options: [
      {
        id: 'prendre',
        label: 'S’équiper immédiatement',
        outcomes: trio(
          { text: 'L’arme s’accorde à votre main.', deltas: { puissance: 3, or: 2 } },
          { text: 'Correcte. Rien de plus.', deltas: { puissance: 1 } },
          { text: 'Mauvaise balance. Vous la jetez.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'vendre',
        label: 'La revendre à la Taverne',
        outcomes: trio(
          { text: 'Bon prix. La bourse chante.', deltas: { or: 12, charisme: 1 } },
          { text: 'Prix moyen.', deltas: { or: 5 } },
          { text: 'On vous arnaque.', deltas: { or: 1, moral: -3 } },
        ),
      },
      {
        id: 'offrir_ornn',
        label: 'La garder pour Ornn',
        outcomes: trio(
          { text: 'Ornn appréciera le matériau.', deltas: { moral: 2, endurance: 1 } },
          { text: 'Vous trimballez du fer inutile… pour l’instant.', deltas: {} },
          { text: 'Vous la perdez en route.', deltas: { moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'hall_of_fame',
    title: 'Hall of Fame',
    text: 'Les noms des vainqueurs brillent. Le vôtre… pas encore. Ou si ?',
    rarity: 'rare',
    tags: ['tournoi', 'social'],
    options: [
      {
        id: 'contempler',
        label: 'Contempler les légendes',
        outcomes: trio(
          { text: 'L’inspiration vous traverse.', deltas: { moral: 6, renommee: 2, puissance: 1 } },
          { text: 'Respect silencieux.', deltas: { moral: 2 } },
          { text: 'L’ombre des grands vous écrase.', deltas: { moral: -5 } },
        ),
      },
      {
        id: 'defier',
        label: 'Jurer de graver votre nom',
        outcomes: trio(
          { text: 'Serment tenu en esprit. Vous partez plus dur.', deltas: { renommee: 5, moral: 4, puissance: 2 } },
          { text: 'Serment… pour plus tard.', deltas: { moral: 1 } },
          { text: 'Les murs semblent rire.', deltas: { moral: -4, renommee: -1 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier les styles des vainqueurs',
        outcomes: trio(
          { text: 'Vous volez une posture légendaire.', deltas: { magie: 3, vitesse: 3, renommee: 2 } },
          { text: 'Quelques notes.', deltas: { magie: 1, vitesse: 1 } },
          { text: 'Trop d’idoles. Vous perdez votre style.', deltas: { moral: -3, puissance: -1 } },
        ),
      },
    ],
  },
  {
    id: 'koro_sensei',
    title: 'Koro Sensei',
    text: 'Le professeur du collège propose une « petite » leçon. Sa vitesse déchire l’air.',
    rarity: 'rare',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'duel',
        label: 'Accepter le duel pédagogique',
        outcomes: trio(
          { text: 'Vous touchez… une fois. Il applaudit.', deltas: { vitesse: 6, renommee: 6, forme: -7 } },
          { text: 'Leçon rude. Vous tenez.', deltas: { vitesse: 2, forme: -8 } },
          { text: 'Vous ne voyez même pas les coups.', deltas: { forme: -12, moral: -5 } },
        ),
      },
      {
        id: 'ecouter',
        label: 'Écouter le cours sans combattre',
        outcomes: trio(
          { text: 'Conseil d’assassin. Précieux.', deltas: { magie: 3, vitesse: 3, moral: 2 } },
          { text: 'Cours correct.', deltas: { magie: 1 } },
          { text: 'Vous décrochez. Interrogation surprise.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'elfe',
        label: 'Tenter de matcher sa vitesse',
        ifRace: ['Elfe', 'Gnome'],
        outcomes: trio(
          { text: 'Presque. Il s’incline, amusé.', deltas: { vitesse: 7, renommee: 4 } },
          { text: 'Vous suivez… un temps.', deltas: { vitesse: 3, forme: -4 } },
          { text: 'Humiliation éclair.', deltas: { moral: -6, forme: -5 } },
        ),
      },
    ],
  },
  {
    id: 'licorne_sanctuaire',
    title: 'Sanctuaire de la Licorne',
    text: 'Au cœur de la Forêt, la Licorne attend. Pureté… ou orgueil.',
    rarity: 'rare',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'affronter',
        label: 'L’affronter pour sa faveur',
        outcomes: trio(
          { text: 'Elle s’incline. Magie pure en vous.', deltas: { magie: 6, renommee: 5, or: 6, trophies: { donjon: 1 } } },
          { text: 'Duel égal. Elle part sans colère.', deltas: { magie: 2, forme: -5 } },
          { text: 'Sa corne vous repousse hors du sanctuaire.', deltas: { forme: -10, moral: -4 } },
        ),
      },
      {
        id: 'offrir',
        label: 'Offrir une offrande de respect',
        outcomes: trio(
          { text: 'Elle bénit votre voie.', deltas: { moral: 5, magie: 3, forme: 4 } },
          { text: 'Elle accepte… froidement.', deltas: { moral: 2 } },
          { text: 'Offrande jugée impure.', deltas: { moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'sylvari',
        label: 'Parler le langage de la sève',
        ifRace: ['Sylvari'],
        outcomes: trio(
          { text: 'La forêt traduit. Alliance rare.', deltas: { magie: 5, endurance: 3, forme: 3 } },
          { text: 'Compréhension partielle.', deltas: { magie: 2 } },
          { text: 'Même la sève se tait.', deltas: { moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'tournoi_anciens',
    title: 'Tournoi des anciens',
    text: 'Un tournoi spécial convoque les vieux champions. L’arène tremble autrement.',
    rarity: 'rare',
    tags: ['tournoi', 'combat'],
    options: [
      {
        id: 'entrer',
        label: 'Entrer contre les anciens',
        outcomes: trio(
          { text: 'Vous renversez un mythe. L’arène hurle.', deltas: { renommee: 12, puissance: 4, forme: -8, trophies: { tournoi: 1 } } },
          { text: 'Belle défaite face à un géant.', deltas: { renommee: 3, forme: -6 } },
          { text: 'Balayé au premier échange.', deltas: { forme: -11, moral: -6, renommee: -2 } },
        ),
      },
      {
        id: 'servir',
        label: 'Servir d’écuyer à un ancien',
        outcomes: trio(
          { text: 'Il vous enseigne une garde oubliée.', deltas: { endurance: 4, charisme: 3, or: 4 } },
          { text: 'Travail discret, pourboire discret.', deltas: { or: 3 } },
          { text: 'Il vous ignore. Frustration.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'parier',
        label: 'Parier sur le choc des légendes',
        outcomes: trio(
          { text: 'Cote folle. Bourse pleine.', deltas: { or: 18, charisme: 2 } },
          { text: 'Petit gain.', deltas: { or: 4 } },
          { text: 'Les légendes vous ruinent.', deltas: { or: -14, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'arc_cieux',
    title: 'Arc des Cieux',
    text: 'Une rumeur : l’Arc des Cieux aurait été aperçu au sommet d’une tour oubliée.',
    rarity: 'rare',
    tags: ['loot', 'donjons'],
    options: [
      {
        id: 'grimper',
        label: 'Escalader la tour',
        outcomes: trio(
          { text: 'L’arc pulse entre vos mains.', deltas: { vitesse: 5, puissance: 3, renommee: 4 } },
          { text: 'Vous trouvez une corde… pas l’arc.', deltas: { vitesse: 2, or: 3 } },
          { text: 'Chute. L’arc reste un mythe.', deltas: { forme: -10, moral: -4 } },
        ),
      },
      {
        id: 'archer',
        label: 'Tenter l’accord parfait',
        ifClass: ['Archer'],
        outcomes: trio(
          { text: 'L’arc vous choisit. Flèches bénies.', deltas: { vitesse: 7, puissance: 3, renommee: 5 } },
          { text: 'Accord partiel.', deltas: { vitesse: 3 } },
          { text: 'L’arc refuse votre main.', deltas: { moral: -5 } },
        ),
      },
      {
        id: 'laisser',
        label: 'Laisser l’arc à son sommeil',
        outcomes: trio(
          { text: 'Respect. Une plume céleste tombe à vos pieds.', deltas: { magie: 3, moral: 3 } },
          { text: 'Vous repartez vides.', deltas: {} },
          { text: 'Un autre s’en empare. Regret.', deltas: { moral: -4, renommee: -1 } },
        ),
      },
    ],
  },
  {
    id: 'gungnir',
    title: 'Gungnir',
    text: 'La lance qui ne rate jamais. On dit qu’elle choisit son porteur.',
    rarity: 'rare',
    tags: ['forge', 'loot'],
    options: [
      {
        id: 'lancer',
        label: 'Tenter le lancer rituel',
        outcomes: trio(
          { text: 'La lance revient. Elle vous accepte.', deltas: { puissance: 5, vitesse: 3, renommee: 4 } },
          { text: 'Presque. Elle vibre… puis se tait.', deltas: { puissance: 2 } },
          { text: 'Elle vous fuit. Doigts brûlés.', deltas: { forme: -6, moral: -4 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier les runes de la haste',
        outcomes: trio(
          { text: 'Compréhension. Votre prochaine frappe portera plus loin.', deltas: { magie: 4, puissance: 2 } },
          { text: 'Runes partiellement lues.', deltas: { magie: 1 } },
          { text: 'Les runes mentent. Vertige.', deltas: { moral: -3, forme: -2 } },
        ),
      },
      {
        id: 'guerrier',
        label: 'Planter Gungnir comme un étendard',
        ifClass: ['Guerrier', 'Paladin'],
        outcomes: trio(
          { text: 'L’étendard tient. Moral de troupe.', deltas: { renommee: 5, charisme: 3, puissance: 2 } },
          { text: 'Geste symbolique.', deltas: { charisme: 1 } },
          { text: 'La lance refuse de rester plantée.', deltas: { moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'ronflex_red',
    title: 'Ronflex endormi',
    text: 'Dans l’arène de Red, un Ronflex bloque tout le couloir. Il ronfle. Fort.',
    rarity: 'rare',
    tags: ['donjons'],
    options: [
      {
        id: 'reveiller',
        label: 'Le réveiller… doucement',
        outcomes: trio(
          { text: 'Il s’écarte. Chemin libre + baie mystérieuse.', deltas: { or: 8, forme: 3, renommee: 2 } },
          { text: 'Il grogne, puis se rendort ailleurs.', deltas: { or: 2 } },
          { text: 'Il se lève de travers. Charge.', deltas: { forme: -11, moral: -4 } },
        ),
      },
      {
        id: 'grimper',
        label: 'Grimper par-dessus',
        outcomes: trio(
          { text: 'Escalade absurde réussie.', deltas: { vitesse: 3, charisme: 2 } },
          { text: 'Vous glissez, mais passez.', deltas: { forme: -3 } },
          { text: 'Il se retourne. Vous tombe dessus.', deltas: { forme: -12, moral: -5 } },
        ),
      },
      {
        id: 'attendre',
        label: 'Attendre qu’il bouge',
        outcomes: trio(
          { text: 'Patience. Il part seul. Vous méditez.', deltas: { moral: 4, forme: 2 } },
          { text: 'Longue attente.', deltas: { forme: 1 } },
          { text: 'Des heures perdues. Frustration.', deltas: { moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'mjollnir',
    title: 'Mjöllnir',
    text: 'Le marteau de guerre attend dans la Forge. Seuls les dignes le soulèvent.',
    rarity: 'epic',
    tags: ['forge'],
    options: [
      {
        id: 'soulever',
        label: 'Tenter de soulever Mjöllnir',
        outcomes: trio(
          { text: 'Le marteau se lève. Le tonnerre applaudit.', deltas: { puissance: 8, endurance: 4, renommee: 8, trophies: { forge: 1 } } },
          { text: 'Il bouge… d’un pouce.', deltas: { puissance: 3, forme: -6 } },
          { text: 'Immobile. Humiliation divine.', deltas: { moral: -8, renommee: -3, forme: -4 } },
        ),
      },
      {
        id: 'ornn',
        label: 'Demander le jugement d’Ornn',
        outcomes: trio(
          { text: 'Ornn hoche. Une rune de foudre vous marque.', deltas: { puissance: 5, magie: 3, renommee: 4 } },
          { text: '« Reviens plus fort. »', deltas: { moral: 1 } },
          { text: 'Silence glacial.', deltas: { moral: -5 } },
        ),
      },
      {
        id: 'nain',
        label: 'Invoquer le droit des forgerons',
        ifRace: ['Nain', 'Dragonkin'],
        outcomes: trio(
          { text: 'Le sang de la forge répond. Mjöllnir cède.', deltas: { puissance: 7, endurance: 3, renommee: 5 } },
          { text: 'Presque digne.', deltas: { puissance: 3, forme: -4 } },
          { text: 'Même le droit ancestral ne suffit pas.', deltas: { moral: -6, forme: -3 } },
        ),
      },
    ],
  },
  {
    id: 'codex_archon',
    title: 'Codex Archon',
    text: 'Un tome interdit pulse au sommet nécromant. Lire, c’est risquer l’esprit.',
    rarity: 'epic',
    tags: ['magie', 'donjons'],
    options: [
      {
        id: 'lire',
        label: 'Ouvrir le Codex',
        outcomes: trio(
          { text: 'Savoir interdit. Votre magie mute.', deltas: { magie: 9, renommee: 5, moral: -2, trophies: { tour: 1 } } },
          { text: 'Quelques pages. Assez.', deltas: { magie: 4, forme: -3 } },
          { text: 'L’esprit se fissure. Fermez le livre.', deltas: { magie: 1, moral: -9, forme: -5 } },
        ),
      },
      {
        id: 'copier',
        label: 'Copier une rune sans lire le reste',
        outcomes: trio(
          { text: 'Rune stable. Gain propre.', deltas: { magie: 5, vitesse: 2 } },
          { text: 'Copie imparfaite.', deltas: { magie: 2 } },
          { text: 'La rune vous brûle la main.', deltas: { forme: -7, moral: -3 } },
        ),
      },
      {
        id: 'mindflayer',
        label: 'Absorber une page par l’esprit',
        ifRace: ['Mindflayer'],
        outcomes: trio(
          { text: 'La page devient vôtre. Terrifiant.', deltas: { magie: 10, renommee: 4 } },
          { text: 'Absorption partielle.', deltas: { magie: 4 } },
          { text: 'Retour de bâton mental.', deltas: { moral: -8, forme: -4 } },
        ),
      },
      {
        id: 'sorciere',
        label: 'Sceller le Codex d’une malédiction',
        ifClass: ['Sorcière', 'Demoniste'],
        outcomes: trio(
          { text: 'Le sceau tient. Pouvoir détourné.', deltas: { magie: 6, charisme: 3, renommee: 3 } },
          { text: 'Sceau fragile.', deltas: { magie: 2 } },
          { text: 'Le Codex renvoie la malédiction.', deltas: { moral: -6, forme: -5 } },
        ),
      },
    ],
  },
  {
    id: 'faux_thanatos',
    title: 'Faux de Thanatos',
    text: 'Une faux d’ombre traîne dans un couloir du Labyrinthe. Elle murmure des fins.',
    rarity: 'epic',
    tags: ['ombres', 'loot'],
    options: [
      {
        id: 'brandir',
        label: 'Brandir la faux',
        outcomes: trio(
          { text: 'Thanatos sourit. Votre ombre s’allonge.', deltas: { puissance: 6, magie: 4, renommee: 6, moral: -2 } },
          { text: 'L’arme obéit… à moitié.', deltas: { puissance: 3, forme: -4 } },
          { text: 'Elle veut votre âme en acompte.', deltas: { forme: -10, moral: -7 } },
        ),
      },
      {
        id: 'sceller',
        label: 'La sceller dans un coffre',
        outcomes: trio(
          { text: 'Sagesse. Une bénédiction discrète vous suit.', deltas: { moral: 5, endurance: 2, renommee: 2 } },
          { text: 'Coffre fermé. Silence.', deltas: { moral: 1 } },
          { text: 'Le murmure continue la nuit.', deltas: { moral: -5 } },
        ),
      },
      {
        id: 'mortvivant',
        label: 'Négocier avec la mort',
        ifRace: ['Mort-vivant'],
        outcomes: trio(
          { text: 'La faux reconnaît les siens.', deltas: { endurance: 5, magie: 4, renommee: 4 } },
          { text: 'Accord tiède.', deltas: { endurance: 2 } },
          { text: 'Même les morts peuvent être refusés.', deltas: { moral: -6, forme: -4 } },
        ),
      },
    ],
  },
  {
    id: 'eveil_race',
    title: 'Éveil de race',
    text: 'Quelque chose en vous se fissure… puis s’ouvre. L’héritage racial appelle.',
    rarity: 'epic',
    tags: ['ombres'],
    options: [
      {
        id: 'accepter',
        label: 'Accueillir l’éveil',
        outcomes: trio(
          { text: 'L’héritage s’ancre. Vous n’êtes plus tout à fait le même.', deltas: { puissance: 4, endurance: 4, magie: 4, vitesse: 3, renommee: 6 } },
          { text: 'Éveil partiel. Prometteur.', deltas: { puissance: 2, magie: 2, forme: -3 } },
          { text: 'Le corps refuse. Douleur sourde.', deltas: { forme: -10, moral: -5 } },
        ),
      },
      {
        id: 'retarder',
        label: 'Retarder l’appel',
        outcomes: trio(
          { text: 'Contrôle. Vous choisissez le moment.', deltas: { moral: 4, charisme: 2 } },
          { text: 'L’appel s’éloigne.', deltas: {} },
          { text: 'L’héritage s’offense. Faiblesse.', deltas: { moral: -4, puissance: -1 } },
        ),
      },
      {
        id: 'cendres',
        label: 'Attiser les braises',
        ifRace: ['Cendrés'],
        outcomes: trio(
          { text: 'Les braises deviennent brasier.', deltas: { magie: 6, puissance: 4, renommee: 3 } },
          { text: 'Braises stables.', deltas: { magie: 3 } },
          { text: 'Vous vous consumez trop vite.', deltas: { forme: -9, moral: -3 } },
        ),
      },
      {
        id: 'humain',
        label: 'Équilibrer toutes les voies',
        ifRace: ['Humain'],
        outcomes: trio(
          { text: 'Polyvalence absolue. Rare.', deltas: { puissance: 3, endurance: 3, magie: 3, vitesse: 3, renommee: 4 } },
          { text: 'Équilibre correct.', deltas: { puissance: 1, magie: 1, vitesse: 1 } },
          { text: 'Trop dilué. Aucune voie ne s’ouvre.', deltas: { moral: -5 } },
        ),
      },
    ],
  },
  {
    id: 'corruption_hall',
    title: 'Corruption du Hall',
    text: 'Un ancien champion du Hall of Fame revient… corrompu par le Cataclysme.',
    rarity: 'epic',
    tags: ['ombres', 'combat', 'cataclysme'],
    options: [
      {
        id: 'affronter',
        label: 'L’affronter pour purifier son nom',
        outcomes: trio(
          { text: 'La corruption cède. Le Hall murmure votre gloire.', deltas: { renommee: 14, puissance: 5, magie: 3, forme: -9, trophies: { cataclysme: 1 } } },
          { text: 'Vous le repoussez. Pas encore vaincu.', deltas: { renommee: 4, forme: -7 } },
          { text: 'Sa corruption vous marque.', deltas: { forme: -13, moral: -7, renommee: 1 } },
        ),
      },
      {
        id: 'raisonner',
        label: 'Tenter de le ramener par la parole',
        outcomes: trio(
          { text: 'Un éclair de lucidité. Il part en paix.', deltas: { charisme: 6, renommee: 6, moral: 4 } },
          { text: 'Il hésite… puis fuit.', deltas: { charisme: 2 } },
          { text: 'Vos mots l’enragent.', deltas: { forme: -8, moral: -5 } },
        ),
      },
      {
        id: 'paladin',
        label: 'Riposter la corruption',
        ifClass: ['Paladin', 'Briseur de Sort'],
        outcomes: trio(
          { text: 'Chaque riposte brûle l’ombre.', deltas: { endurance: 5, renommee: 7, puissance: 3 } },
          { text: 'Vous tenez la ligne.', deltas: { endurance: 2, forme: -5 } },
          { text: 'La corruption traverse l’égide.', deltas: { forme: -10, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'double_passif',
    title: 'Fusion de passifs',
    text: 'L’Extension du Territoire offre une fusion rare : deux auras, un seul corps.',
    rarity: 'epic',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'fusion',
        label: 'Accepter la double fusion',
        outcomes: trio(
          { text: 'Deux passifs s’entrelacent. Vous devenez unique.', deltas: { magie: 8, renommee: 7, or: 6, trophies: { extension: 1 } } },
          { text: 'Fusion instable mais utile.', deltas: { magie: 4, forme: -5 } },
          { text: 'Rejet. Le territoire vous expulse.', deltas: { forme: -12, moral: -6 } },
        ),
      },
      {
        id: 'choisir',
        label: 'N’en garder qu’un, parfaitement',
        outcomes: trio(
          { text: 'Maîtrise pure. Un passif souverain.', deltas: { magie: 5, moral: 3 } },
          { text: 'Choix correct.', deltas: { magie: 2 } },
          { text: 'Mauvais choix. Regret immédiat.', deltas: { moral: -4, magie: -1 } },
        ),
      },
      {
        id: 'mage',
        label: 'Forcer une troisième rune',
        ifClass: ['Mage', 'Sorcière', 'Alchimiste'],
        outcomes: trio(
          { text: 'Folie géniale. Trois échos.', deltas: { magie: 10, renommee: 5, forme: -6 } },
          { text: 'La troisième rune cède à moitié.', deltas: { magie: 4, forme: -4 } },
          { text: 'Surcharge. Noir.', deltas: { forme: -14, moral: -6, magie: -2 } },
        ),
      },
    ],
  },
  {
    id: 'etage_120',
    title: 'Étage 120 du Labyrinthe',
    text: 'Le fond du Labyrinthe Infini. Les rois et dieux du couloir ouvrent les yeux.',
    rarity: 'legendary',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'defier',
        label: 'Défier le roi du labyrinthe',
        outcomes: trio(
          { text: 'Le roi tombe. Votre nom devient mythe.', deltas: { renommee: 18, vitesse: 6, puissance: 5, forme: -12, trophies: { labyrinthe: 1 } } },
          { text: 'Vous survolez… puis fuyez digne.', deltas: { renommee: 6, forme: -9, vitesse: 2 } },
          { text: 'Le labyrinthe se referme sur vous.', deltas: { forme: -16, moral: -8, renommee: 2 } },
        ),
      },
      {
        id: 'pacte',
        label: 'Négocier un pacte avec le couloir',
        outcomes: trio(
          { text: 'Le labyrinthe vous reconnaît. Raccourci éternel.', deltas: { magie: 7, vitesse: 5, renommee: 8 } },
          { text: 'Pacte mineur.', deltas: { magie: 3, or: 5 } },
          { text: 'Le pacte était un piège.', deltas: { moral: -7, forme: -8 } },
        ),
      },
      {
        id: 'voleur',
        label: 'Voler un trésor et disparaître',
        ifClass: ['Voleur'],
        outcomes: trio(
          { text: 'Butin légendaire. Personne ne vous a vu.', deltas: { or: 25, vitesse: 5, renommee: 6 } },
          { text: 'Fuite avec un coffre moyen.', deltas: { or: 10, vitesse: 2 } },
          { text: 'Alarme. Les murs vous chassent.', deltas: { forme: -12, moral: -5 } },
        ),
      },
    ],
  },
  {
    id: 'extinction',
    title: 'EXTINCTION',
    text: 'Le Cataclysme atteint son dixième souffle. Le monde retient le sien.',
    rarity: 'legendary',
    tags: ['ombres', 'combat', 'cataclysme'],
    options: [
      {
        id: 'tout',
        label: 'Tout donner contre l’entité',
        outcomes: trio(
          { text: 'Votre nom sauve une ère. Les chroniques tremblent.', deltas: { renommee: 22, puissance: 6, magie: 5, forme: -14, trophies: { cataclysme: 1 } } },
          { text: 'Vous retardez l’extinction. Assez pour d’autres.', deltas: { renommee: 8, forme: -10 } },
          { text: 'Balayé. Le monde continue sans vous… pour l’instant.', deltas: { forme: -18, moral: -8, renommee: 3 } },
        ),
      },
      {
        id: 'soutien',
        label: 'Coordonner la dernière ligne',
        outcomes: trio(
          { text: 'Votre voix tient l’armée. Victoire collective.', deltas: { charisme: 8, renommee: 12, or: 10 } },
          { text: 'Coordination correcte.', deltas: { charisme: 3, renommee: 3 } },
          { text: 'Panique. La ligne rompt.', deltas: { charisme: -4, moral: -7, forme: -6 } },
        ),
      },
      {
        id: 'dragonkin',
        label: 'Opposer le souffle du dragon',
        ifRace: ['Dragonkin', 'Cendrés'],
        outcomes: trio(
          { text: 'Deux souffles s’entrechoquent. Le vôtre tient.', deltas: { magie: 8, endurance: 5, renommee: 10 } },
          { text: 'Vous absorbez une part du choc.', deltas: { endurance: 3, forme: -8 } },
          { text: 'Votre souffle s’éteint trop tôt.', deltas: { forme: -14, moral: -6 } },
        ),
      },
    ],
  },
  {
    id: 'pointeau_adn',
    title: 'Pointeau ADN',
    text: 'Au bout de l’arène de Red, le Pointeau ADN attend ceux qui ont tout vaincu.',
    rarity: 'legendary',
    tags: ['donjons'],
    options: [
      {
        id: 'prendre',
        label: 'Saisir le Pointeau',
        outcomes: trio(
          { text: 'Le pouvoir change votre essence. Rare. Irréversible.', deltas: { puissance: 5, endurance: 5, magie: 5, vitesse: 5, renommee: 12, trophies: { coop: 1 } } },
          { text: 'Le Pointeau pulse… puis se calme.', deltas: { puissance: 2, magie: 2, renommee: 4 } },
          { text: 'Rejet. Votre corps n’est pas prêt.', deltas: { forme: -12, moral: -6 } },
        ),
      },
      {
        id: 'partager',
        label: 'Le partager avec votre allié',
        outcomes: trio(
          { text: 'Duo légendaire. Red applaudit.', deltas: { charisme: 7, renommee: 10, or: 12, trophies: { coop: 1 } } },
          { text: 'Partage honnête.', deltas: { charisme: 3, or: 5 } },
          { text: 'Jalousie. L’alliance se fissure.', deltas: { charisme: -4, moral: -5 } },
        ),
      },
      {
        id: 'garder',
        label: 'Le sceller pour plus tard',
        outcomes: trio(
          { text: 'Patience de sage. Le sceau vous bénit.', deltas: { moral: 6, magie: 3, renommee: 3 } },
          { text: 'Vous repartez les mains vides… pour l’instant.', deltas: {} },
          { text: 'Quelqu’un le vole derrière vous.', deltas: { moral: -7, renommee: -3 } },
        ),
      },
    ],
  },
  {
    id: 'ornn_jugement',
    title: 'Jugement d’Ornn',
    text: 'Le Dieu de la Forge convoque les prétendants. Une seule offrande sera reforgée ce jour.',
    rarity: 'legendary',
    tags: ['forge'],
    options: [
      {
        id: 'offrande',
        label: 'Présenter votre arme légendaire',
        outcomes: trio(
          { text: 'Ornn forge. Le métal devient mythe.', deltas: { puissance: 9, endurance: 5, renommee: 10, or: -8, trophies: { forge: 1 } } },
          { text: 'Il retient l’arme… pour « plus tard ».', deltas: { renommee: 3, forme: -4 } },
          { text: 'Indigne. Les soufflets s’éteignent.', deltas: { moral: -8, renommee: -4 } },
        ),
      },
      {
        id: 'defi',
        label: 'Survivre à sa forge brûlante',
        outcomes: trio(
          { text: 'Vous tenez. Une rune d’endurance vous marque.', deltas: { endurance: 8, puissance: 3, renommee: 8, forme: -10, trophies: { forge: 1 } } },
          { text: 'Vous sortez brûlé mais vivant.', deltas: { endurance: 3, forme: -9 } },
          { text: 'La chaleur vous brise.', deltas: { forme: -16, moral: -7 } },
        ),
      },
      {
        id: 'bastion',
        label: 'Devenir le rempart de l’épreuve',
        ifClass: ['Bastion', 'Paladin'],
        outcomes: trio(
          { text: 'Ornn reconnaît le mur. Reforgé digne.', deltas: { endurance: 9, renommee: 7, forme: -6 } },
          { text: 'Vous encaisez l’essentiel.', deltas: { endurance: 4, forme: -7 } },
          { text: 'Le rempart cède trop tôt.', deltas: { forme: -13, moral: -5 } },
        ),
      },
    ],
  },
  {
    id: 'pendule_chronos',
    title: 'Pendule de Chronos',
    text: 'Un pendule d’argent bat hors du temps. Une saison peut s’étirer… ou se contracter.',
    rarity: 'legendary',
    tags: ['ombres', 'loot'],
    options: [
      {
        id: 'accelerer',
        label: 'Accélérer votre destin',
        outcomes: trio(
          { text: 'Deux saisons d’expérience en un battement.', deltas: { puissance: 5, magie: 5, vitesse: 5, renommee: 8, forme: -6 } },
          { text: 'Léger gain de temps.', deltas: { vitesse: 3, magie: 2 } },
          { text: 'Le temps vous mord. Vieilli trop vite.', deltas: { forme: -12, moral: -5, endurance: -2 } },
        ),
      },
      {
        id: 'figer',
        label: 'Figer un mauvais présage',
        outcomes: trio(
          { text: 'Le malheur passe à côté. Chance rare.', deltas: { moral: 8, forme: 6, renommee: 4 } },
          { text: 'Présage atténué.', deltas: { moral: 3 } },
          { text: 'Vous figez… votre propre élan.', deltas: { vitesse: -2, moral: -4 } },
        ),
      },
      {
        id: 'rendre',
        label: 'Rendre le pendule au silence',
        outcomes: trio(
          { text: 'Chronos approuve. Bénédiction discrète.', deltas: { magie: 4, moral: 5, charisme: 3 } },
          { text: 'Silence. Paix.', deltas: { moral: 2 } },
          { text: 'Le pendule refuse d’être rendu.', deltas: { moral: -5, forme: -3 } },
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
            text: 'Le métal se tend. Nouvelle forme.',
            deltas: { or: -5, forme: -2 },
            weaponProgress: 'upgrade',
          },
          { text: 'Travail correct, pas de miracle.', deltas: { puissance: 1, or: -2 } },
          { text: 'Il abîme le pommeau. Rage contenue.', deltas: { or: -4, moral: -4 } },
        ),
      },
      {
        id: 'coffre',
        label: 'Chercher les plans d’upgrade dans un coffre',
        outcomes: trio(
          {
            text: 'Plans trouvés. Vous appliquez la méthode.',
            deltas: { magie: 1 },
            weaponProgress: 'upgrade',
          },
          { text: 'Plans incomplets. Inspiration tiède.', deltas: { magie: 1, or: 2 } },
          { text: 'Piège. Le coffre claque sur vos doigts.', deltas: { forme: -7, moral: -3 } },
        ),
      },
      {
        id: 'patienter',
        label: 'Garder {arme} telle quelle',
        outcomes: trio(
          { text: 'Patience. Vous affinez votre geste.', deltas: { moral: 3, vitesse: 1 } },
          { text: 'Rien ne change.', deltas: {} },
          { text: 'Vous doutez de votre choix d’arme.', deltas: { moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'arme_legendaire_revelation',
    title: 'Révélation de lignée',
    text: 'Un ancien murmure : la lignée de {arme} culmine en {arme_legendaire}. Très peu y touchent.',
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
            text: 'Le ciel de la forge se fend.',
            deltas: { renommee: 6, forme: -8, or: -6, trophies: { forge: 1 } },
            weaponProgress: 'legendary',
          },
          {
            variant: 'neutre',
            weight: 45,
            text: 'Le rituel n’atteint pas le mythe… mais avance d’un cran.',
            deltas: { or: -3, forme: -4 },
            weaponProgress: 'upgrade',
          },
          {
            variant: 'malus',
            weight: 45,
            text: 'Le rituel échoue. Votre esprit vacille.',
            deltas: { forme: -10, moral: -6 },
          },
        ],
      },
      {
        id: 'etudier',
        label: 'Étudier les runes sans forcer',
        outcomes: trio(
          { text: 'Compréhension. Votre prochain upgrade sera plus sûr.', deltas: { magie: 4, moral: 2 } },
          { text: 'Quelques notes utiles.', deltas: { magie: 1 } },
          { text: 'Les runes mentent. Vertige.', deltas: { moral: -4 } },
        ),
      },
      {
        id: 'renoncer',
        label: 'Renoncer au mythe pour cette saison',
        outcomes: trio(
          { text: 'Humilité. La Taverne respecte ça… parfois.', deltas: { charisme: 2, moral: 3 } },
          { text: 'Vous repartez.', deltas: {} },
          { text: 'On murmure lâcheté.', deltas: { renommee: -3, moral: -2 } },
        ),
      },
    ],
  },
  {
    id: 'arme_donjon_echo',
    title: 'Écho d’arme dans le donjon',
    text: 'Au fond d’une salle, un socle porte l’empreinte de {arme_legendaire}. Votre {arme} réagit.',
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
            text: 'L’empreinte s’empare du métal. Lignée accomplie.',
            deltas: { renommee: 5, forme: -5 },
            weaponProgress: 'legendary',
          },
          {
            variant: 'neutre',
            weight: 52,
            text: 'Le socle chauffe. Upgrade stable.',
            deltas: { forme: -3 },
            weaponProgress: 'upgrade',
          },
          {
            variant: 'malus',
            weight: 40,
            text: 'Rejet. Une décharge vous renvoie.',
            deltas: { forme: -9, moral: -4 },
          },
        ],
      },
      {
        id: 'prier',
        label: 'Prier la lignée sans toucher',
        outcomes: trio(
          { text: 'Une bénédiction discrète vous suit.', deltas: { moral: 4, magie: 2 } },
          { text: 'Silence respectueux.', deltas: { moral: 1 } },
          { text: 'Rien. Juste le froid de la pierre.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'briser',
        label: 'Briser le socle pour le butin',
        outcomes: trio(
          { text: 'Or et fragments. Pas de gloire d’arme.', deltas: { or: 14, renommee: -1 } },
          { text: 'Quelques pièces.', deltas: { or: 4 } },
          { text: 'Le socle se venge. Malédiction légère.', deltas: { forme: -8, moral: -3, or: 2 } },
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
          { text: 'Le discours inspire. Les voies s’éclaircissent.', deltas: { magie: 2, moral: 2 } },
          { text: 'Long discours.', deltas: {} },
          { text: 'Vous ratez le début.', deltas: { moral: -2 } },
        ),
      },
      {
        id: 'placeholder2',
        label: 'Prendre des notes',
        outcomes: trio(
          { text: 'Notes utiles pour plus tard.', deltas: { magie: 1, charisme: 1 } },
          { text: 'Quelques griffonnages.', deltas: {} },
          { text: 'Votre stylo casse.', deltas: { moral: -1 } },
        ),
      },
      {
        id: 'placeholder3',
        label: 'Quitter l’amphi',
        outcomes: trio(
          { text: 'Vous repartez. Le Collège reste ouvert.', deltas: { moral: 1 } },
          { text: 'Rien.', deltas: {} },
          { text: 'On note votre absence.', deltas: { renommee: -1 } },
        ),
      },
    ],
  },
];
