/**
 * Événements Cave Destiny — 100 % univers Duels de Cave.
 * Chaque choix : 3 issues (bonus / neutre / malus).
 * Options supplémentaires selon race / classe.
 * Rareté : common | uncommon | rare | epic | legendary.
 */

import { CAVE_DESTINY_EVENTS_EXTRA } from './caveDestinyEventsExtra';
import { CAVE_DESTINY_EVENTS_LINKED } from './caveDestinyEventsLinked';
import { trio, getOptionsForEvent } from './caveDestinyEventUtils';

export { trio, getOptionsForEvent };

const CAVE_DESTINY_EVENTS_CORE = [
  {
    id: 'tournoi_samedi',
    title: 'Tournoi du samedi',
    text: 'L’arène se remplit. Les lots du tournoi sont tirés. Le Hall of Fame attend un nouveau nom… ou un nouvel oublié.',
    rarity: 'uncommon',
    tags: ['tournoi', 'combat'],
    options: [
      {
        id: 'entrer',
        label: 'Entrer dans l’arène et viser la couronne',
        check: { auto: 1.2, spd: 0.7, def: 0.6 },
        outcomes: trio(
          { text: 'Vous tranchez jusqu’en finale. La couronne est à vous.', deltas: { renommee: 14, auto: 5, moral: 8, or: 10, trophies: { tournoi: 1 } } },
          { text: 'Belle course jusqu’en demi-finale. L’arène retient votre nom.', deltas: { renommee: 5, auto: 2, moral: -1, or: 3 } },
          { text: 'Éliminé dès le premier affrontement. Le public détourne le regard.', deltas: { renommee: -5, moral: -10, forme: -6 } },
        ),
      },
      {
        id: 'observer',
        label: 'Observer les combats depuis les gradins',
        check: { cap: 0.9, charisme: 0.8 },
        outcomes: trio(
          { text: 'Vous décryptez les styles. Votre prochain duel sera plus malin.', deltas: { cap: 4, charisme: 3, moral: 3 } },
          { text: 'Vous retenez quelques feintes utiles.', deltas: { cap: 1, charisme: 1 } },
          { text: 'Vous vous endormez sur un match long. Rien appris.', deltas: { moral: -4, forme: -2 } },
        ),
      },
      {
        id: 'parier',
        label: 'Parier à la Taverne sur un challenger oublié',
        check: { charisme: 1.3, renommee: 0.4 },
        outcomes: trio(
          { text: 'Cote folle. La bourse de la Taverne se vide… dans votre poche.', deltas: { or: 22, renommee: 4, charisme: 2 } },
          { text: 'Petit gain, petite perte. La soirée est correcte.', deltas: { or: 2, moral: 1 } },
          { text: 'Votre challenger s’effondre. Votre bourse aussi.', deltas: { or: -16, moral: -6 } },
        ),
      },
      {
        id: 'orc_rage',
        label: 'Laisser la fureur orc dicter le combat',
        ifRace: ['Orc', 'Cendrés'],
        outcomes: trio(
          { text: 'Blessé, vous devenez terrifiant. L’adversaire cède.', deltas: { auto: 6, renommee: 6, forme: -4 } },
          { text: 'La rage aide… sans tout décider.', deltas: { auto: 2, forme: -5 } },
          { text: 'Vous forcez trop tôt. L’arène vous rappelle à l’ordre.', deltas: { forme: -12, moral: -7, renommee: -2 } },
        ),
      },
      {
        id: 'mage_burst',
        label: 'Préparer une explosion arcanique décisive',
        ifClass: ['Mage', 'Sorcière', 'Demoniste'],
        outcomes: trio(
          { text: 'L’explosion clôt le duel. Les gradins retiennent leur souffle.', deltas: { cap: 7, renommee: 8, trophies: { tournoi: 1 } } },
          { text: 'Gros dégâts, pas assez pour finir.', deltas: { cap: 3, forme: -3 } },
          { text: 'Le sort part trop tôt. Votre adversaire en profite.', deltas: { cap: -1, moral: -8, forme: -4 } },
        ),
      },
      {
        id: 'gated_finale',
        label: 'Viser la finale sans détour',
        require: { stats: { auto: 28, spd: 24 }, minRenommee: 12 },
        outcomes: trio(
          { text: 'Vous forcez le bracket. La couronne tremble.', deltas: { renommee: 16, auto: 4, trophies: { tournoi: 1 } } },
          { text: 'Demi-finale honorable sous pression.', deltas: { renommee: 6, forme: -5 } },
          { text: 'Trop tôt. Élimination sèche.', deltas: { renommee: -4, moral: -8, forme: -6 } },
        ),
      },
      {
        id: 'gated_lame',
        label: 'Imposer votre lignée d’arme en duel',
        require: { weaponFamilies: ['epee', 'hache', 'lance', 'dague'], stats: { auto: 22 } },
        outcomes: trio(
          { text: 'Votre arme dicte le rythme. L’arène retient le geste.', deltas: { auto: 4, renommee: 5 } },
          { text: 'Belle exhibition, pas de titre.', deltas: { auto: 2 } },
          { text: 'L’adversaire lit votre garde.', deltas: { forme: -7, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'foret',
    title: 'La Forêt enchantée',
    text: 'Clairière, bosquet, sanctuaire… Les arbres murmurent. Quelque chose de vieux veille encore.',
    rarity: 'common',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'rush',
        label: 'Traverser la forêt jusqu’au sanctuaire',
        check: { def: 1.1, auto: 0.8, spd: 0.5 },
        outcomes: trio(
          { text: 'Vous nettoyez les sentiers. Le butin des clairières est à vous.', deltas: { def: 4, or: 12, forme: -4, trophies: { donjon: 1 } } },
          { text: 'Progression honorable. Quelques égratignures.', deltas: { or: 5, def: 1, forme: -5 } },
          { text: 'Une embuscade du sanglier vous renvoie sur le chemin.', deltas: { forme: -12, moral: -5 } },
        ),
      },
      {
        id: 'farm',
        label: 'Chasser prudemment dans les clairières basses',
        check: { def: 0.9, spd: 0.6 },
        outcomes: trio(
          { text: 'Gibier, herbes, or. Une journée de forestier accomplie.', deltas: { or: 8, def: 2, forme: 2 } },
          { text: 'Peu de gloire, un peu d’or.', deltas: { or: 3 } },
          { text: 'Même un ours « facile » vous humilie.', deltas: { moral: -4, forme: -5, or: 1 } },
        ),
      },
      {
        id: 'licorne',
        label: 'Suivre la trace de la Licorne',
        outcomes: trio(
          { text: 'Vous l’affrontez et gagnez sa faveur mystique.', deltas: { cap: 5, renommee: 4, or: 6 } },
          { text: 'Vous l’apercevez… puis elle disparaît.', deltas: { cap: 2, moral: 1 } },
          { text: 'La Licorne vous égare. Vous sortez épuisé.', deltas: { forme: -9, moral: -3 } },
        ),
      },
      {
        id: 'sylvari',
        label: 'Vous laisser guider par la sève Sylvari',
        ifRace: ['Sylvari'],
        outcomes: trio(
          { text: 'La forêt vous reconnaît. Régénération et butin.', deltas: { def: 5, forme: 6, or: 4 } },
          { text: 'Les racines vous soutiennent… un peu.', deltas: { forme: 2, def: 1 } },
          { text: 'Même la sève a ses limites.', deltas: { forme: -10, moral: -3 } },
        ),
      },
      {
        id: 'archer',
        label: 'Harceler les bêtes à distance',
        ifClass: ['Archer', 'Voleur'],
        outcomes: trio(
          { text: 'Vos flèches dansent entre les arbres. La clairière est à vous.', deltas: { spd: 6, or: 7, renommee: 3 } },
          { text: 'Vous harcelez bien, quelques flèches perdues.', deltas: { spd: 2, forme: -3 } },
          { text: 'Vous vous coinces contre un chêne. La faune en profite.', deltas: { forme: -9, spd: -1, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'tour_mage',
    title: 'Tour du Mage',
    text: 'Hall des grimoires, galerie d’os, sommet nécromant. Chaque étage offre un passif… et un prix.',
    rarity: 'uncommon',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'push',
        label: 'Gravir l’étage suivant sans détour',
        outcomes: trio(
          { text: 'Étage conquis. Un passif rare s’ancre en vous.', deltas: { cap: 7, renommee: 5, forme: -5, trophies: { tour: 1 } } },
          { text: 'Vous passez… avec très peu de PV.', deltas: { cap: 3, forme: -8 } },
          { text: 'Le gardien vous renvoie au hall d’entrée.', deltas: { forme: -11, moral: -6, cap: 1 } },
        ),
      },
      {
        id: 'passif',
        label: 'Choisir un passif avec soin',
        outcomes: trio(
          { text: 'Synergie parfaite. Votre aura change.', deltas: { cap: 5, spd: 2, moral: 3 } },
          { text: 'Passif correct, rien d’éclatant.', deltas: { cap: 2 } },
          { text: 'Mauvais choix. L’étage suivant le prouve.', deltas: { moral: -5, cap: -1, renommee: -2 } },
        ),
      },
      {
        id: 'liche',
        label: 'Affronter les ombres de la Liche',
        outcomes: trio(
          { text: 'La barrière macabre cède. Vous grimpez.', deltas: { cap: 6, renommee: 4, or: 5 } },
          { text: 'Vous survolez la galerie d’os.', deltas: { cap: 2, forme: -4 } },
          { text: 'Les ossements vous enterrent presque.', deltas: { forme: -12, moral: -5 } },
        ),
      },
      {
        id: 'mindflayer',
        label: 'Voler la première capacité reçue',
        ifRace: ['Mindflayer'],
        outcomes: trio(
          { text: 'Vous renvoyez le sort volé. Le gardien vacille.', deltas: { cap: 8, renommee: 4 } },
          { text: 'Le sort copié est… moyen. Suffisant.', deltas: { cap: 3 } },
          { text: 'Rien à voler au bon moment. Votre esprit vacille.', deltas: { moral: -5, forme: -3 } },
        ),
      },
      {
        id: 'healer',
        label: 'Soutenir la montée par des soins précis',
        ifClass: ['Healer', 'Alchimiste'],
        outcomes: trio(
          { text: 'Vos soins portent l’assaut. L’étage tombe.', deltas: { cap: 5, charisme: 4, or: 5 } },
          { text: 'Vous maintenez le rythme.', deltas: { cap: 2, forme: 1 } },
          { text: 'Un soin trop tard. Retour au hall.', deltas: { moral: -6, renommee: -3 } },
        ),
      },
    ],
  },
  {
    id: 'forge_ornn',
    title: 'Forge des Légendes',
    text: 'Les soufflets d’Ornn rugissent. Votre {arme} attend d’être jugée — rare… ou, les dieux aidant, {arme_legendaire}.',
    rarity: 'rare',
    tags: ['forge', 'arme', 'arme_upgrade'],
    options: [
      {
        id: 'fight',
        label: 'Défier Ornn pour reforger {arme}',
        outcomes: trio(
          {
            text: 'Ornn incline la tête. Le métal chante.',
            deltas: { or: -6, forme: -7, trophies: { forge: 1 } },
            weaponProgress: 'upgrade',
          },
          { text: 'Presque. Le dieu exige encore une épreuve.', deltas: { auto: 2, forme: -8, or: -2 } },
          { text: 'Ornn n’est pas impressionné. Les étincelles s’éteignent.', deltas: { forme: -12, moral: -6 } },
        ),
      },
      {
        id: 'wait',
        label: 'Attendre d’être prêt… vraiment prêt',
        outcomes: trio(
          { text: 'Vous préparez or et résolution. Sagesse rare.', deltas: { or: 8, moral: 2 } },
          { text: 'Vous attendez. La forge attend aussi.', deltas: { or: 2 } },
          { text: 'D’autres partent reforgés. Pas vous.', deltas: { moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'offrir',
        label: 'Présenter {arme} en offrande',
        outcomes: [
          {
            variant: 'bonus',
            weight: 12,
            text: 'Miracle. Ornn ne se contente pas d’upgrader — il transcende.',
            deltas: { renommee: 4, forme: -5, or: -4, trophies: { forge: 1 } },
            weaponProgress: 'legendary',
          },
          {
            variant: 'neutre',
            weight: 48,
            text: 'Il regarde… puis reforgé d’un cran.',
            deltas: { charisme: 1, or: -2 },
            weaponProgress: 'upgrade',
          },
          {
            variant: 'malus',
            weight: 40,
            text: 'L’offrande est jugée indigne. Humiliation tiède.',
            deltas: { renommee: -4, moral: -4 },
          },
        ],
      },
      {
        id: 'nain',
        label: 'Invoquer la tradition des forges naines',
        ifRace: ['Nain', 'Turtlekin', 'Dragonkin'],
        outcomes: trio(
          {
            text: 'Vous tenez comme la montagne. Ornn forge.',
            deltas: { def: 3, trophies: { forge: 1 } },
            weaponProgress: 'upgrade',
          },
          { text: 'Vous encaissez… juste assez.', deltas: { def: 3, forme: -6 } },
          { text: 'Même la pierre peut se fendre.', deltas: { forme: -13, def: -1, moral: -5 } },
        ),
      },
      {
        id: 'bastion',
        label: 'Avancer derrière le Rempart',
        ifClass: ['Bastion', 'Paladin', 'Briseur de Sort'],
        outcomes: trio(
          { text: 'L’égide tient. Les coups d’Ornn rebondissent.', deltas: { def: 6, renommee: 4, forme: -4 } },
          { text: 'Bouclier correct, progression lente.', deltas: { def: 2, forme: -5 } },
          { text: 'Le rempart cède trop tôt.', deltas: { forme: -11, moral: -4 } },
        ),
      },
      {
        id: 'gated_legend',
        label: 'Exiger la forme légendaire immédiatement',
        require: { stats: { def: 30, auto: 28 }, weaponRarities: ['rare'], minRenommee: 16 },
        outcomes: [
          {
            variant: 'bonus',
            weight: 20,
            text: 'Ornn cède. La légende s’écrit dans le fer.',
            deltas: { renommee: 6, forme: -8, or: -8, trophies: { forge: 1 } },
            weaponProgress: 'legendary',
          },
          {
            variant: 'neutre',
            weight: 45,
            text: 'Il refuse le mythe… mais upgrade quand même.',
            deltas: { or: -4, forme: -5 },
            weaponProgress: 'upgrade',
          },
          {
            variant: 'malus',
            weight: 35,
            text: 'Orgueil puni. Les soufflets se taisent.',
            deltas: { moral: -7, renommee: -3, forme: -6 },
          },
        ],
      },
    ],
  },
  {
    id: 'labyrinthe',
    title: 'Labyrinthe Infini',
    text: 'Cent vingt étages qui se reforment. Rois et dieux du labyrinthe attendent au fond du couloir.',
    rarity: 'uncommon',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'record',
        label: 'Pousser pour un nouveau palier',
        outcomes: trio(
          { text: 'Nouveau record. Votre nom monte au classement hebdomadaire.', deltas: { spd: 5, renommee: 8, forme: -7, trophies: { labyrinthe: 1 } } },
          { text: 'Palier correct. Rien d’historique.', deltas: { spd: 2, forme: -5, or: 2 } },
          { text: 'Les couloirs se referment. Vous êtes perdu.', deltas: { forme: -12, moral: -6 } },
        ),
      },
      {
        id: 'loot',
        label: 'Une incursion courte pour le butin',
        outcomes: trio(
          { text: 'Entrée, coffre, sortie. Propre.', deltas: { or: 10, forme: -2 } },
          { text: 'Butin modeste.', deltas: { or: 3, forme: -3 } },
          { text: 'Vous tombez pour quelques pièces.', deltas: { forme: -8, or: 1, moral: -3 } },
        ),
      },
      {
        id: 'carte',
        label: 'Cartographier les détours avant d’avancer',
        outcomes: trio(
          { text: 'Votre carte ment moins que les murs. Avantage.', deltas: { cap: 3, spd: 3, renommee: 2 } },
          { text: 'Quelques notes utiles.', deltas: { cap: 1 } },
          { text: 'La carte était fausse dès le départ.', deltas: { forme: -9, moral: -5 } },
        ),
      },
      {
        id: 'elfe',
        label: 'Compter sur la grâce critique des Elfes',
        ifRace: ['Elfe', 'Gnome'],
        outcomes: trio(
          { text: 'Les critiques s’enchaînent. Le couloir s’ouvre.', deltas: { spd: 4, auto: 4, renommee: 3 } },
          { text: 'Quelques critiques décisifs.', deltas: { spd: 2 } },
          { text: 'Aucun critique. La malchance règne.', deltas: { moral: -6, forme: -4 } },
        ),
      },
      {
        id: 'voleur',
        label: 'Esquiver dans l’ombre des couloirs',
        ifClass: ['Voleur'],
        outcomes: trio(
          { text: 'Vous n’êtes qu’une ombre. Les coups vous manquent.', deltas: { spd: 7, renommee: 3, forme: 2 } },
          { text: 'Esquives utiles, progression moyenne.', deltas: { spd: 3, forme: -2 } },
          { text: 'L’esquive tombe au mauvais instant.', deltas: { forme: -10, moral: -4 } },
        ),
      },
      {
        id: 'gated_couloir',
        label: 'Ouvrir un couloir interdit',
        require: { stats: { spd: 26, cap: 22 }, races: ['Elfe', 'Gnome'], classes: ['Voleur', 'Archer'] },
        outcomes: trio(
          { text: 'Le couloir cède. Record et butin.', deltas: { spd: 4, renommee: 6, or: 8, trophies: { labyrinthe: 1 } } },
          { text: 'Vous avancez… puis rebroussez.', deltas: { spd: 2, forme: -4 } },
          { text: 'Le labyrinthe se moque. Cul-de-sac.', deltas: { forme: -10, moral: -5 } },
        ),
      },
    ],
  },
  {
    id: 'miroir',
    title: 'Le Miroir',
    text: 'Un reflet maudit vous attend. Même race, même classe… meilleurs choix ?',
    rarity: 'rare',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'duel',
        label: 'Accepter le duel contre votre reflet',
        outcomes: trio(
          { text: 'Vous brisez le miroir. Quelque chose se décante en vous.', deltas: { auto: 4, cap: 3, moral: 6, renommee: 4 } },
          { text: 'Match nul intérieur. Leçon tiède.', deltas: { moral: 1, forme: -3 } },
          { text: 'Le reflet gagne. La leçon est amère.', deltas: { moral: -8, forme: -5, charisme: 1 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier ses feintes avant de frapper',
        outcomes: trio(
          { text: 'Vous anticipez chaque geste. Victoire nette.', deltas: { cap: 4, spd: 3, renommee: 3 } },
          { text: 'Vous voyez deux ouvertures. Une suffit.', deltas: { cap: 2 } },
          { text: 'Trop d’hésitation. Le reflet frappe premier.', deltas: { forme: -8, moral: -4 } },
        ),
      },
      {
        id: 'refuser',
        label: 'Refuser le miroir et méditer',
        outcomes: trio(
          { text: 'Pas de gloire. Un peu de paix intérieure.', deltas: { moral: 6, forme: 5, renommee: -1 } },
          { text: 'Vous reposez l’esprit.', deltas: { moral: 2, forme: 2 } },
          { text: 'Le reflet vous hante quand même.', deltas: { moral: -4, renommee: -2 } },
        ),
      },
      {
        id: 'mortvivant',
        label: 'Tomber… puis revenir une fois',
        ifRace: ['Mort-vivant'],
        outcomes: trio(
          { text: 'La résurrection retourne le duel.', deltas: { def: 4, renommee: 5, moral: 3 } },
          { text: 'Vous revenez… juste pour tenir.', deltas: { def: 2, forme: -4 } },
          { text: 'La seconde mort est définitive.', deltas: { forme: -12, moral: -6 } },
        ),
      },
      {
        id: 'paladin',
        label: 'Riposter chaque coup du reflet',
        ifClass: ['Paladin'],
        outcomes: trio(
          { text: 'Chaque riposte sacré le brise un peu plus.', deltas: { def: 4, auto: 3, renommee: 3 } },
          { text: 'Quelques ripostes utiles.', deltas: { def: 2 } },
          { text: 'Vous ripostez dans le vide.', deltas: { moral: -4, forme: -4 } },
        ),
      },
    ],
  },
  {
    id: 'cataclysme',
    title: 'Cataclysme',
    text: 'Le ciel se fend. Une entité menace le monde entier. Au dixième souffle : EXTINCTION.',
    rarity: 'epic',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'charge',
        label: 'Charger le cœur du Cataclysme',
        outcomes: trio(
          { text: 'Vos coups comptent. On murmure déjà « sauveur ».', deltas: { renommee: 14, auto: 5, forme: -10, trophies: { cataclysme: 1 } } },
          { text: 'Contribution solide avant le retrait.', deltas: { renommee: 4, or: 4, forme: -6 } },
          { text: 'Vous êtes balayé dès les premiers tours.', deltas: { forme: -14, moral: -6, renommee: 1 } },
        ),
      },
      {
        id: 'soutien',
        label: 'Soutenir depuis les lignes arrières',
        outcomes: trio(
          { text: 'Soutien précieux. Le front tient grâce à vous.', deltas: { or: 7, renommee: 4, forme: -2 } },
          { text: 'Présence correcte, impact discret.', deltas: { or: 2 } },
          { text: 'Trop loin pour compter. On doute de vous.', deltas: { renommee: -4, moral: -3 } },
        ),
      },
      {
        id: 'corruption',
        label: 'Affronter un champion corrompu du Hall',
        outcomes: trio(
          { text: 'Vous brisez la corruption. L’ancien champion s’incline.', deltas: { renommee: 10, cap: 4, auto: 3 } },
          { text: 'Duel difficile. Vous en sortez vivant.', deltas: { renommee: 3, forme: -7 } },
          { text: 'La corruption vous submerge.', deltas: { forme: -13, moral: -7 } },
        ),
      },
      {
        id: 'dragonkin',
        label: 'Opposer vos écailles à la destruction',
        ifRace: ['Dragonkin', 'Écailleux', 'Turtlekin'],
        outcomes: trio(
          { text: 'Vos écailles tiennent le souffle du monde.', deltas: { def: 5, cap: 3, renommee: 4 } },
          { text: 'Vous absorbez une part du choc.', deltas: { def: 2, forme: -4 } },
          { text: 'Même une carapace a un point de rupture.', deltas: { forme: -12, moral: -4 } },
        ),
      },
      {
        id: 'guerrier',
        label: 'Frappe pénétrante au point faible',
        ifClass: ['Guerrier', 'Berserk'],
        outcomes: trio(
          { text: 'La frappe ouvre une brèche. Le monde respire.', deltas: { auto: 6, renommee: 5, trophies: { cataclysme: 1 } } },
          { text: 'Frappe correcte sur l’entité.', deltas: { auto: 2, forme: -3 } },
          { text: 'Vous frappez trop tôt. La brèche se referme.', deltas: { moral: -5, forme: -5 } },
        ),
      },
      {
        id: 'gated_sauveur',
        label: 'Se déclarer sauveur du Cataclysme',
        require: { stats: { auto: 32, cap: 28, def: 28 }, minRenommee: 25 },
        outcomes: trio(
          { text: 'Le monde retient votre nom. EXTINCTION recule.', deltas: { renommee: 20, auto: 4, cap: 3, forme: -12, trophies: { cataclysme: 1 } } },
          { text: 'Contribution majeure, pas de mythe.', deltas: { renommee: 8, forme: -8 } },
          { text: 'L’entité vous brise. Le front tient sans vous.', deltas: { forme: -16, moral: -8 } },
        ),
      },
      {
        id: 'gated_bouclier',
        label: 'Tenir le rempart magique',
        require: { classes: ['Bastion', 'Paladin', 'Briseur de Sort'], weaponFamilies: ['bouclier'], stats: { def: 26 } },
        outcomes: trio(
          { text: 'Le rempart tient. Les lignes respirent.', deltas: { def: 5, renommee: 7, forme: -5 } },
          { text: 'Vous absorbez l’essentiel.', deltas: { def: 2, forme: -6 } },
          { text: 'Brèche. Recul forcé.', deltas: { forme: -11, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'grotte_merveilles',
    title: 'La Grotte aux merveilles',
    text: 'Forteresse gobeline, repaire des bandits, antre du dragon… Des armes y dorment encore.',
    rarity: 'uncommon',
    tags: ['donjons', 'loot'],
    options: [
      {
        id: 'grukk',
        label: 'Affronter le Chef Gobelin Grukk',
        outcomes: trio(
          { text: 'Grukk tombe. Une arme commune devient votre trophée.', deltas: { or: 8, auto: 2, renommee: 3, trophies: { donjon: 1 } } },
          { text: 'Victoire poussive sur la tribu de pierre.', deltas: { or: 3, forme: -4 } },
          { text: 'Les gobelins vous chassent hors de la forteresse.', deltas: { forme: -9, moral: -4 } },
        ),
      },
      {
        id: 'bandit',
        label: 'Défier le Bandit des Grands Chemins',
        outcomes: trio(
          { text: 'Sa Lame Empoisonnée devient votre butin.', deltas: { spd: 3, or: 10, renommee: 3 } },
          { text: 'Vous le battez… après une longue poursuite.', deltas: { or: 4, forme: -5 } },
          { text: 'Le poison vous force à fuir.', deltas: { forme: -10, moral: -3 } },
        ),
      },
      {
        id: 'vyraxion',
        label: 'Descendre dans l’antre de Vyraxion',
        outcomes: trio(
          { text: 'Le Dévoreur s’effondre. Un trésor légendaire pulse.', deltas: { auto: 5, renommee: 8, or: 14, trophies: { donjon: 1 } } },
          { text: 'Vous échappez au Souffle de Flammes… de justesse.', deltas: { def: 2, forme: -8, or: 4 } },
          { text: 'Vyraxion vous brûle hors de son antre.', deltas: { forme: -14, moral: -7 } },
        ),
      },
      {
        id: 'lycan',
        label: 'Laisser le saignement du Lycan faire son œuvre',
        ifRace: ['Lycan'],
        outcomes: trio(
          { text: 'Les blessures s’accumulent. La proie s’effondre.', deltas: { auto: 5, renommee: 4, or: 5 } },
          { text: 'Le saignement aide sans tout décider.', deltas: { auto: 2 } },
          { text: 'La proie vous échappe avant que le saignement porte.', deltas: { moral: -5, forme: -4 } },
        ),
      },
      {
        id: 'masochiste',
        label: 'Accumuler la douleur pour la Purge sanglante',
        ifClass: ['Masochiste', 'Berserk'],
        outcomes: trio(
          { text: 'La purge explose. L’antre tremble.', deltas: { auto: 6, renommee: 4, forme: -5 } },
          { text: 'Douleur utile, résultat moyen.', deltas: { auto: 2, forme: -6 } },
          { text: 'Vous tombez avant la purge.', deltas: { forme: -13, moral: -6 } },
        ),
      },
    ],
  },
  {
    id: 'taverne',
    title: 'La Taverne',
    text: 'Musique, paris, chibis sur les tables. Les champions du tournoi boivent… et jugent.',
    rarity: 'common',
    tags: ['social'],
    options: [
      {
        id: 'recit',
        label: 'Raconter vos exploits (enjolivés)',
        outcomes: trio(
          { text: 'L’assemblée croit assez pour vous offrir une tournée… et un contact.', deltas: { charisme: 6, renommee: 3, or: -2 } },
          { text: 'Quelques rires polis.', deltas: { charisme: 2 } },
          { text: 'On vous coupe : « Encore une histoire. »', deltas: { charisme: -3, moral: -4 } },
        ),
      },
      {
        id: 'pari',
        label: 'Rejoindre la table des paris',
        outcomes: trio(
          { text: 'Votre intuition paie. La Taverne murmure votre nom.', deltas: { or: 14, renommee: 3, charisme: 2 } },
          { text: 'Ni riche, ni ruiné.', deltas: { or: 2 } },
          { text: 'Mauvaise série. La bourse fond.', deltas: { or: -12, moral: -5 } },
        ),
      },
      {
        id: 'ecouter',
        label: 'Écouter les rumeurs de combats et de donjons',
        outcomes: trio(
          { text: 'Une rumeur vraie sur un boss. Avantage net.', deltas: { cap: 3, spd: 2, moral: 2 } },
          { text: 'Des demi-vérités. Toujours ça.', deltas: { cap: 1 } },
          { text: 'Rumeur fausse. Vous perdrez du temps plus tard.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'sirene',
        label: 'Chanter pour apaiser la salle',
        ifRace: ['Sirène'],
        outcomes: trio(
          { text: 'Votre voix captive. Alliés et or affluent.', deltas: { charisme: 7, or: 5, moral: 3 } },
          { text: 'Jolie mélodie. Rien de plus.', deltas: { charisme: 2 } },
          { text: 'Fausse note. On vous siffle.', deltas: { charisme: -4, moral: -4 } },
        ),
      },
      {
        id: 'succube',
        label: 'Négocier un pacte… amical',
        ifClass: ['Succube'],
        outcomes: trio(
          { text: 'Un champion accepte de vous entraîner.', deltas: { charisme: 6, renommee: 3, cap: 2 } },
          { text: 'Conversation agréable, sans suite.', deltas: { charisme: 2 } },
          { text: 'On vous prend pour un manipulateur. Froid soudain.', deltas: { charisme: -4, moral: -5, renommee: -2 } },
        ),
      },
    ],
  },
  {
    id: 'boss_rush',
    title: 'Boss Rush',
    text: 'Vyraxion, Licorne, Liche, Ornn, Gojo, Koro Sensei… Six épreuves. Une seule respiration.',
    rarity: 'rare',
    tags: ['combat', 'ombres'],
    options: [
      {
        id: 'full',
        label: 'Affronter les six épreuves d’affilée',
        outcomes: trio(
          { text: 'Les six tombent. Vos mains tremblent encore.', deltas: { def: 5, auto: 4, forme: -11, renommee: 9, trophies: { bossRush: 1 } } },
          { text: 'Vous tombez au milieu… puis recommencez plus sage.', deltas: { def: 2, forme: -8, moral: -2 } },
          { text: 'Vyraxion vous écrase d’entrée. Repos forcé.', deltas: { forme: -14, moral: -7 } },
        ),
      },
      {
        id: 'checkpoint',
        label: 'S’arrêter après trois bosses',
        outcomes: trio(
          { text: 'Trois scalpés. Orgueil intact, gains solides.', deltas: { def: 3, or: 6, renommee: 3, forme: -4 } },
          { text: 'Progression honorable.', deltas: { def: 1, or: 3, forme: -3 } },
          { text: 'Même trois, c’était trop.', deltas: { forme: -9, moral: -4 } },
        ),
      },
      {
        id: 'gojo',
        label: 'Garder des forces pour Satoru Gojo',
        outcomes: trio(
          { text: 'Bleu, Rouge, Violet… vous survivez au territoire.', deltas: { cap: 5, renommee: 6, forme: -6 } },
          { text: 'Vous passez Gojo de justesse.', deltas: { cap: 2, forme: -7 } },
          { text: 'Le Violet vous efface.', deltas: { forme: -13, moral: -6 } },
        ),
      },
      {
        id: 'humain',
        label: 'Compter sur la polyvalence humaine',
        ifRace: ['Humain'],
        outcomes: trio(
          { text: 'Un peu de tout, au bon moment. Victoire nette.', deltas: { auto: 2, def: 2, cap: 2, spd: 2, renommee: 3 } },
          { text: 'Polyvalence correcte.', deltas: { auto: 1, cap: 1 } },
          { text: 'Trop dispersé. Aucune force ne suffit.', deltas: { moral: -4, forme: -5 } },
        ),
      },
      {
        id: 'alchimiste',
        label: 'Enchaîner le cycle Feu / Vie / Acide',
        ifClass: ['Alchimiste'],
        outcomes: trio(
          { text: 'Le cycle est parfait. Les bosses fondent.', deltas: { cap: 5, def: 2, or: 4, renommee: 3 } },
          { text: 'Flasques utiles, timing moyen.', deltas: { cap: 2 } },
          { text: 'Mauvaise flasque au mauvais boss.', deltas: { forme: -9, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'extension',
    title: 'Extension du Territoire',
    text: 'Un domaine arcanique s’ouvre. On y fusionne un second passif mystique… si l’on survit.',
    rarity: 'rare',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'fusion',
        label: 'Tenter la fusion de passifs',
        outcomes: trio(
          { text: 'Fusion réussie. Votre aura devient unique.', deltas: { cap: 6, renommee: 5, or: 6, trophies: { extension: 1 } } },
          { text: 'Fusion partielle. Potentiel entrevu.', deltas: { cap: 3, forme: -4 } },
          { text: 'Le rituel échoue. Retour au seuil.', deltas: { forme: -10, moral: -5 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier les runes avant d’entrer',
        outcomes: trio(
          { text: 'Les runes révèlent une faille. Vous en profitez.', deltas: { cap: 4, spd: 2, moral: 2 } },
          { text: 'Quelques indices utiles.', deltas: { cap: 1 } },
          { text: 'Vous lisez de travers. Le domaine punit.', deltas: { moral: -4, forme: -4 } },
        ),
      },
      {
        id: 'forcer',
        label: 'Forcer le territoire sans préparation',
        outcomes: trio(
          { text: 'L’audace paie. Passif rare arraché.', deltas: { renommee: 6, cap: 3, or: 8 } },
          { text: 'Vous en sortez vivant, sans éclat.', deltas: { forme: -5, or: 2 } },
          { text: 'Le territoire vous expulse.', deltas: { forme: -11, moral: -5 } },
        ),
      },
      {
        id: 'briseur',
        label: 'Briser les sorts du domaine',
        ifClass: ['Briseur de Sort', 'Sorcière'],
        outcomes: trio(
          { text: 'L’égide fractale étouffe le territoire.', deltas: { cap: 5, def: 3, renommee: 3 } },
          { text: 'Vous affaiblissez quelques runes.', deltas: { cap: 2 } },
          { text: 'Le domaine ignore votre égide.', deltas: { moral: -5, forme: -5 } },
        ),
      },
      {
        id: 'cendres',
        label: 'Nourrir vos braises Cendrés',
        ifRace: ['Cendrés'],
        outcomes: trio(
          { text: 'Les braises enflamment votre sort décisif.', deltas: { cap: 6, auto: 3, forme: -3 } },
          { text: 'Quelques braises, effet correct.', deltas: { cap: 2, forme: -2 } },
          { text: 'Braises gaspillées trop tôt.', deltas: { forme: -8, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'coop_red',
    title: 'L’arène de Red',
    text: 'Deux combattants. Les créatures de Red. Au bout : le Pointeau ADN.',
    rarity: 'uncommon',
    tags: ['donjons', 'social'],
    options: [
      {
        id: 'mener',
        label: 'Mener le duo face à Dracaufeu',
        outcomes: trio(
          { text: 'Duo parfait. Pointeau ADN en récompense.', deltas: { charisme: 5, renommee: 6, or: 8, trophies: { coop: 1 } } },
          { text: 'Victoire correcte, coordination moyenne.', deltas: { charisme: 2, or: 3, forme: -4 } },
          { text: 'Défaite spectaculaire sur Florizarre.', deltas: { charisme: -3, moral: -6, forme: -6 } },
        ),
      },
      {
        id: 'soutien',
        label: 'Jouer le soutien discret',
        outcomes: trio(
          { text: 'Vous portez sans briller. Votre allié s’en souvient.', deltas: { def: 3, cap: 2, or: 5, moral: 3 } },
          { text: 'Soutien honnête.', deltas: { def: 1, or: 2 } },
          { text: 'On oublie de vous laisser le butin.', deltas: { or: 1, moral: -4 } },
        ),
      },
      {
        id: 'pikachu',
        label: 'Prioriser Pikachu avant qu’il charge',
        outcomes: trio(
          { text: 'Priorité parfaite. La salle s’ouvre.', deltas: { spd: 4, renommee: 3, or: 4 } },
          { text: 'Vous le baissez… un peu tard.', deltas: { spd: 1, forme: -3 } },
          { text: 'La foudre vous trouve d’abord.', deltas: { forme: -10, moral: -4 } },
        ),
      },
      {
        id: 'demoniste',
        label: 'Laisser le familier ouvrir la voie',
        ifClass: ['Demoniste'],
        outcomes: trio(
          { text: 'Le familier retient les créatures. Vous finissez.', deltas: { cap: 5, renommee: 3, or: 4 } },
          { text: 'Familier utile.', deltas: { cap: 2 } },
          { text: 'Le familier tombe trop vite.', deltas: { cap: -1, moral: -4, forme: -3 } },
        ),
      },
      {
        id: 'gnome',
        label: 'Gagner le duel de vitesse',
        ifRace: ['Gnome', 'Elfe'],
        outcomes: trio(
          { text: 'Vous frappez toujours en premier. L’arène s’incline.', deltas: { spd: 6, auto: 2, renommee: 3 } },
          { text: 'Légère avance de vitesse.', deltas: { spd: 2 } },
          { text: 'L’ennemi est plus rapide. Mauvaise surprise.', deltas: { moral: -4, forme: -4 } },
        ),
      },
    ],
  },
];

export const CAVE_DESTINY_EVENTS = [
  ...CAVE_DESTINY_EVENTS_CORE,
  ...CAVE_DESTINY_EVENTS_EXTRA,
  ...CAVE_DESTINY_EVENTS_LINKED,
];
