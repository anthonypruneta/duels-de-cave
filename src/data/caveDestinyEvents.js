/**
 * Événements Cave Destiny — 100 % univers Duels de Cave.
 * Chaque choix : 3 issues (bonus / neutre / malus).
 * Options supplémentaires selon race / classe.
 * Rareté : common | uncommon | rare | epic | legendary.
 */

import { CAVE_DESTINY_EVENTS_EXTRA } from './caveDestinyEventsExtra';
import { trio, getOptionsForEvent } from './caveDestinyEventUtils';

export { trio, getOptionsForEvent };

const CAVE_DESTINY_EVENTS_CORE = [
  {
    id: 'tournoi_samedi',
    title: 'Tournoi du samedi',
    text: 'Les tambours de l’arène battent déjà. Les lots sont tirés, le Hall of Fame guette : un nouveau nom… ou un oublié de plus.',
    rarity: 'uncommon',
    tags: ['tournoi', 'combat'],
    options: [
      {
        id: 'entrer',
        label: 'Entrer dans l’arène et viser la couronne',
        check: { auto: 1.2, spd: 0.7, def: 0.6 },
        outcomes: trio(
          { text: 'Vous tranchez jusqu’en finale. La couronne claque sur votre front, le Hall hurle votre nom.', deltas: { renommee: 14, auto: 5, moral: 8, or: 10, trophies: { tournoi: 1 } } },
          { text: 'Demi-finale sous les torches. Vous sortez salué, sans couronne — l’arène retient pourtant le geste.', deltas: { renommee: 5, auto: 2, moral: -1, or: 3 } },
          { text: 'Le premier coup vous jette au sol. Le public détourne le regard ; votre nom ne franchit pas les gradins.', deltas: { renommee: -5, moral: -10, hp: -6 } },
        ),
      },
      {
        id: 'observer',
        label: 'Observer les combats depuis les gradins',
        check: { cap: 0.9, charisme: 0.8 },
        outcomes: trio(
          { text: 'Vous décryptez chaque feinte. Demain, votre duel aura le goût d’un piège bien tendu.', deltas: { cap: 4, charisme: 3, moral: 3 } },
          { text: 'Deux ouvertures retenues, un timing noté. Pas de révélation, mais des armes pour le prochain samedi.', deltas: { cap: 1, charisme: 1 } },
          { text: 'Le match s’étire ; votre menton touche la pierre. Vous vous réveillez sans leçon, la bouche amère.', deltas: { moral: -4, hp: -2 } },
        ),
      },
      {
        id: 'parier',
        label: 'Parier à la Taverne sur un challenger oublié',
        check: { charisme: 1.3, renommee: 0.4 },
        outcomes: trio(
          { text: 'Cote folle : le challenger renverse le favori. La bourse de la Taverne s’ouvre… dans votre poche.', deltas: { or: 22, renommee: 4, charisme: 2 } },
          { text: 'Un gain, une perte, une pinte. La soirée s’équilibre sans éclat ni ruine.', deltas: { or: 2, moral: 1 } },
          { text: 'Votre challenger s’effondre au premier échange. Les pièces quittent la table comme des rats.', deltas: { or: -16, moral: -6 } },
        ),
      },
      {
        id: 'orc_rage',
        label: 'Laisser la fureur orc dicter le combat',
        ifRace: ['Orc', 'Cendrés'],
        outcomes: trio(
          { text: 'Le sang coule — et avec lui la fureur. L’adversaire recule, l’arène apprend votre nom dans un hurlement.', deltas: { auto: 6, renommee: 6, hp: -4 } },
          { text: 'La rage pousse vos coups sans tout emporter. Vous gagnez du terrain, pas la légende.', deltas: { auto: 2, hp: -5 } },
          { text: 'Vous forcez trop tôt. L’arbitre siffle, le public siffle plus fort : l’arène vous rappelle à l’ordre.', deltas: { hp: -12, moral: -7, renommee: -2 } },
        ),
      },
      {
        id: 'mage_burst',
        label: 'Préparer une explosion arcanique décisive',
        ifClass: ['Mage', 'Sorcière', 'Demoniste'],
        outcomes: trio(
          { text: 'L’explosion clôt le duel d’un souffle blanc. Les gradins retiennent l’air — puis éclatent.', deltas: { cap: 7, renommee: 8, trophies: { tournoi: 1 } } },
          { text: 'Le sort lacère l’armure sans achever. Gros dégâts, duel encore ouvert, poumons brûlés.', deltas: { cap: 3, hp: -3 } },
          { text: 'Le sort part trop tôt. Votre adversaire glisse dans la brèche et vous cloue au sable.', deltas: { cap: -1, moral: -8, hp: -4 } },
        ),
      },
      {
        id: 'gated_finale',
        label: 'Viser la finale sans détour',
        require: { stats: { auto: 28, spd: 24 }, minRenommee: 12 },
        outcomes: trio(
          { text: 'Vous forcez le bracket comme une lame. La couronne tremble déjà sur le présentoir.', deltas: { renommee: 16, auto: 4, trophies: { tournoi: 1 } } },
          { text: 'Demi-finale honorable sous pression. Les torches vous suivent jusqu’à la sortie, sans titre.', deltas: { renommee: 6, hp: -5 } },
          { text: 'Trop tôt pour ce bracket. Élimination sèche : le sable avale votre course avant la finale.', deltas: { renommee: -4, moral: -8, hp: -6 } },
        ),
      },
      {
        id: 'gated_lame',
        label: 'Imposer votre lignée d’arme en duel',
        require: { weaponFamilies: ['epee', 'hache', 'lance', 'dague'], stats: { auto: 22 } },
        outcomes: trio(
          { text: 'Votre arme dicte le rythme. L’arène retient le geste — un trait net dans la mémoire du samedi.', deltas: { auto: 4, renommee: 5 } },
          { text: 'Belle exhibition sous les vivats. Pas de titre, mais la garde adverse a appris votre nom.', deltas: { auto: 2 } },
          { text: 'L’adversaire lit votre garde comme un livre ouvert. Votre lignée d’arme s’incline, sèche.', deltas: { hp: -7, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'foret',
    title: 'La Forêt enchantée',
    text: 'Clairière, bosquet, sanctuaire… Les arbres murmurent. Quelque chose de vieux veille encore sous la mousse.',
    rarity: 'common',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'rush',
        label: 'Traverser la forêt jusqu’au sanctuaire',
        check: { def: 1.1, auto: 0.8, spd: 0.5 },
        outcomes: trio(
          { text: 'Vous nettoyez les sentiers jusqu’au sanctuaire. Le butin des clairières pèse lourd dans vos sacs.', deltas: { def: 4, or: 12, hp: -4, trophies: { donjon: 1 } } },
          { text: 'Progression honorable entre racines et ronces. Quelques égratignures, un peu d’or, pas de gloire.', deltas: { or: 5, def: 1, hp: -5 } },
          { text: 'Le sanglier fond depuis le sous-bois. L’embuscade vous renvoie sur le chemin, sanglant et honteux.', deltas: { hp: -12, moral: -5 } },
        ),
      },
      {
        id: 'farm',
        label: 'Chasser prudemment dans les clairières basses',
        check: { def: 0.9, spd: 0.6 },
        outcomes: trio(
          { text: 'Gibier, herbes, or. Une journée de forestier accomplie : les clairières basses ont payé leur dû.', deltas: { or: 8, def: 2, hp: 2 } },
          { text: 'Peu de gloire, un peu d’or. Vous rentrez avec des herbes et la fatigue des sentiers.', deltas: { or: 3 } },
          { text: 'Même un ours « facile » vous humilie. Vous rampez hors de la clairière, la fierté en lambeaux.', deltas: { moral: -4, hp: -5, or: 1 } },
        ),
      },
      {
        id: 'licorne',
        label: 'Suivre la trace de la Licorne',
        outcomes: trio(
          { text: 'Vous l’affrontez sous la lune. Sa faveur mystique s’ancre en vous — corne, lumière, serment.', deltas: { cap: 5, renommee: 4, or: 6 } },
          { text: 'Vous l’apercevez entre deux hêtres… puis elle disparaît. Il reste un frisson et une leçon incomplète.', deltas: { cap: 2, moral: 1 } },
          { text: 'La Licorne vous égare dans un labyrinthe de fougères. Vous sortez épuisé, sans gloire ni trace.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'sylvari',
        label: 'Vous laisser guider par la sève Sylvari',
        ifRace: ['Sylvari'],
        outcomes: trio(
          { text: 'La forêt vous reconnaît. La sève remonte, la régénération coule, le butin s’offre aux racines amies.', deltas: { def: 5, hp: 6, or: 4 } },
          { text: 'Les racines vous soutiennent… un peu. Assez pour tenir, pas assez pour régner sur le sous-bois.', deltas: { hp: 2, def: 1 } },
          { text: 'Même la sève a ses limites. Les arbres se taisent ; vous tombez seul parmi les fougères.', deltas: { hp: -10, moral: -3 } },
        ),
      },
      {
        id: 'archer',
        label: 'Harceler les bêtes à distance',
        ifClass: ['Archer', 'Voleur'],
        outcomes: trio(
          { text: 'Vos flèches dansent entre les arbres. La clairière se vide ; le silence vous appartient.', deltas: { spd: 6, or: 7, renommee: 3 } },
          { text: 'Vous harcelez bien, mais quelques flèches se perdent dans la mousse. Butin correct, rythme cassé.', deltas: { spd: 2, hp: -3 } },
          { text: 'Vous vous coinces contre un chêne. La faune en profite : crocs, griffes, retraite honteuse.', deltas: { hp: -9, spd: -1, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'tour_mage',
    title: 'Tour du Mage',
    text: 'Hall des grimoires, galerie d’os, sommet nécromant. Chaque étage offre un passif… et un prix écrit en sang.',
    rarity: 'uncommon',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'push',
        label: 'Gravir l’étage suivant sans détour',
        outcomes: trio(
          { text: 'Étage conquis. Un passif rare s’ancre sous votre peau comme une rune encore chaude.', deltas: { cap: 7, renommee: 5, hp: -5, trophies: { tour: 1 } } },
          { text: 'Vous passez… avec très peu de PV. L’escalier suivant sent déjà le sang et la poussière d’os.', deltas: { cap: 3, hp: -8 } },
          { text: 'Le gardien vous renvoie au hall d’entrée. Les grimoires se ferment ; la Tour vous a jugé trop tôt.', deltas: { hp: -11, moral: -6, cap: 1 } },
        ),
      },
      {
        id: 'passif',
        label: 'Choisir un passif avec soin',
        outcomes: trio(
          { text: 'Synergie parfaite. Votre aura change de teinte : l’étage suivant semble déjà plus bas.', deltas: { cap: 5, spd: 2, moral: 3 } },
          { text: 'Passif correct, rien d’éclatant. Vous grimpez avec un outil utile, pas une révélation.', deltas: { cap: 2 } },
          { text: 'Mauvais choix. L’étage suivant le prouve : votre aura grince, les runes se moquent.', deltas: { moral: -5, cap: -1, renommee: -2 } },
        ),
      },
      {
        id: 'liche',
        label: 'Affronter les ombres de la Liche',
        outcomes: trio(
          { text: 'La barrière macabre cède. Vous grimpez dans un souffle d’os et de victoire froide.', deltas: { cap: 6, renommee: 4, or: 5 } },
          { text: 'Vous survolez la galerie d’os sans la conquérir. Assez pour avancer, pas pour briller.', deltas: { cap: 2, hp: -4 } },
          { text: 'Les ossements vous enterrent presque. La Liche rit sans bouche ; vous rampez vers la sortie.', deltas: { hp: -12, moral: -5 } },
        ),
      },
      {
        id: 'mindflayer',
        label: 'Voler la première capacité reçue',
        ifRace: ['Mindflayer'],
        outcomes: trio(
          { text: 'Vous renvoyez le sort volé. Le gardien vacille ; votre esprit goûte le pouvoir encore chaud.', deltas: { cap: 8, renommee: 4 } },
          { text: 'Le sort copié est… moyen. Suffisant pour tenir l’échange, trop fade pour la légende.', deltas: { cap: 3 } },
          { text: 'Rien à voler au bon moment. Votre esprit vacille ; la Tour vous rend la monnaie en migraine.', deltas: { moral: -5, hp: -3 } },
        ),
      },
      {
        id: 'healer',
        label: 'Soutenir la montée par des soins précis',
        ifClass: ['Healer', 'Alchimiste'],
        outcomes: trio(
          { text: 'Vos soins portent l’assaut. L’étage tombe sous une lumière verte qui sent l’herbe et la victoire.', deltas: { cap: 5, charisme: 4, or: 5 } },
          { text: 'Vous maintenez le rythme : assez de baume pour ne pas mourir, pas assez pour dominer.', deltas: { cap: 2, hp: 1 } },
          { text: 'Un soin trop tard. Retour au hall, les mains vides, le goût du sang dans la gorge.', deltas: { moral: -6, renommee: -3 } },
        ),
      },
    ],
  },
  {
    id: 'forge_ornn',
    title: 'Forge des Légendes',
    text: 'Les soufflets d’Ornn rugissent. Votre {arme} attend d’être jugée — rare… ou, les dieux aidant, {arme_legendaire}. Une arme qu’il a touchée pèse autrement quand le duel mythique viendra.',
    rarity: 'rare',
    tags: ['forge', 'arme', 'arme_upgrade'],
    options: [
      {
        id: 'fight',
        label: 'Défier Ornn pour reforger {arme}',
        outcomes: trio(
          {
            text: 'Ornn incline la tête. Le métal chante : votre {arme} naît une fois de plus, plus vive, plus fière.',
            deltas: { or: -6, hp: -7, trophies: { forge: 1 } },
            weaponProgress: 'upgrade',
          },
          { text: 'Presque. Le dieu exige encore une épreuve ; les étincelles meurent avant la dernière frappe.', deltas: { auto: 2, hp: -8, or: -2 } },
          { text: 'Ornn n’est pas impressionné. Les étincelles s’éteignent ; votre {arme} reste ce qu’elle était.', deltas: { hp: -12, moral: -6 } },
        ),
      },
      {
        id: 'wait',
        label: 'Attendre d’être prêt… vraiment prêt',
        outcomes: trio(
          { text: 'Vous préparez or et résolution. Sagesse rare : la forge attend, et vous aussi, sans trembler.', deltas: { or: 8, moral: 2 } },
          { text: 'Vous attendez. La forge attend aussi. Le temps passe ; rien ne se brise, rien ne s’élève.', deltas: { or: 2 } },
          { text: 'D’autres partent reforgés. Pas vous. Les soufflets sifflent votre absence comme un affront.', deltas: { moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'offrir',
        label: 'Présenter {arme} en offrande',
        outcomes: [
          {
            variant: 'bonus',
            weight: 12,
            text: 'Miracle. Ornn ne se contente pas d’upgrader — il transcende. Votre {arme} devient {arme_legendaire}.',
            deltas: { renommee: 4, hp: -5, or: -4, trophies: { forge: 1 } },
            weaponProgress: 'legendary',
          },
          {
            variant: 'neutre',
            weight: 48,
            text: 'Il regarde longtemps… puis reforgé d’un cran. Pas de mythe, mais le métal a changé de voix.',
            deltas: { charisme: 1, or: -2 },
            weaponProgress: 'upgrade',
          },
          {
            variant: 'malus',
            weight: 40,
            text: 'L’offrande est jugée indigne. Humiliation tiède sous les soufflets : Ornn détourne le regard.',
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
            text: 'Vous tenez comme la montagne. Ornn forge : le marteau tombe, et votre lignée d’acier s’élève.',
            deltas: { def: 3, trophies: { forge: 1 } },
            weaponProgress: 'upgrade',
          },
          { text: 'Vous encaissez… juste assez. La tradition tient ; le dieu ne sourit pas encore.', deltas: { def: 3, hp: -6 } },
          { text: 'Même la pierre peut se fendre. Votre tradition naine craque sous un seul coup de marteau divin.', deltas: { hp: -13, def: -1, moral: -5 } },
        ),
      },
      {
        id: 'bastion',
        label: 'Avancer derrière le Rempart',
        ifClass: ['Bastion', 'Paladin', 'Briseur de Sort'],
        outcomes: trio(
          { text: 'L’égide tient. Les coups d’Ornn rebondissent ; derrière le Rempart, vous avancez sans plier.', deltas: { def: 6, renommee: 4, hp: -4 } },
          { text: 'Bouclier correct, progression lente. Vous absorbez, vous avancez, sans encore forcer le respect divin.', deltas: { def: 2, hp: -5 } },
          { text: 'Le rempart cède trop tôt. Le marteau d’Ornn traverse l’égide ; vous reculez, brûlé et muet.', deltas: { hp: -11, moral: -4 } },
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
            text: 'Ornn cède. La légende s’écrit dans le fer : votre {arme} devient {arme_legendaire} sous les soufflets.',
            deltas: { renommee: 6, hp: -8, or: -8, trophies: { forge: 1 } },
            weaponProgress: 'legendary',
          },
          {
            variant: 'neutre',
            weight: 45,
            text: 'Il refuse le mythe… mais upgrade quand même. Le métal progresse ; la légende attendra.',
            deltas: { or: -4, hp: -5 },
            weaponProgress: 'upgrade',
          },
          {
            variant: 'malus',
            weight: 35,
            text: 'Orgueil puni. Les soufflets se taisent ; Ornn vous laisse avec le goût du fer froid.',
            deltas: { moral: -7, renommee: -3, hp: -6 },
          },
        ],
      },
    ],
  },
  {
    id: 'labyrinthe',
    title: 'Labyrinthe Infini',
    text: 'Cent vingt étages qui se reforment. Rois et dieux du labyrinthe attendent au fond du couloir qui bouge.',
    rarity: 'uncommon',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'record',
        label: 'Pousser pour un nouveau palier',
        outcomes: trio(
          { text: 'Nouveau record. Votre nom monte au classement hebdomadaire ; les murs applaudissent en silence.', deltas: { spd: 5, renommee: 8, hp: -7, trophies: { labyrinthe: 1 } } },
          { text: 'Palier correct. Rien d’historique : vous gagnez un étage, perdez du sang, gardez l’honneur.', deltas: { spd: 2, hp: -5, or: 2 } },
          { text: 'Les couloirs se referment. Vous êtes perdu ; l’écho de vos pas devient une moquerie.', deltas: { hp: -12, moral: -6 } },
        ),
      },
      {
        id: 'loot',
        label: 'Une incursion courte pour le butin',
        outcomes: trio(
          { text: 'Entrée, coffre, sortie. Propre : l’or cliquette, les murs n’ont pas eu le temps de se refermer.', deltas: { or: 10, hp: -2 } },
          { text: 'Butin modeste dans un alcôve poussiéreux. Assez pour boire, pas assez pour se vanter à la Taverne.', deltas: { or: 3, hp: -3 } },
          { text: 'Vous tombez pour quelques pièces. Le labyrinthe prend son dû ; vous rampez avec des monnaies collées au sang.', deltas: { hp: -8, or: 1, moral: -3 } },
        ),
      },
      {
        id: 'carte',
        label: 'Cartographier les détours avant d’avancer',
        outcomes: trio(
          { text: 'Votre carte ment moins que les murs. Avantage : le prochain couloir s’ouvre comme une porte connue.', deltas: { cap: 3, spd: 3, renommee: 2 } },
          { text: 'Quelques notes utiles au crayon. Pas de carte parfaite, mais moins de pièges sous vos pieds.', deltas: { cap: 1 } },
          { text: 'La carte était fausse dès le départ. Vous suivez une piste morte jusqu’à une embuscade.', deltas: { hp: -9, moral: -5 } },
        ),
      },
      {
        id: 'elfe',
        label: 'Compter sur la grâce critique des Elfes',
        ifRace: ['Elfe', 'Gnome'],
        outcomes: trio(
          { text: 'Les critiques s’enchaînent. Le couloir s’ouvre sous une pluie de traits précis et cruels.', deltas: { spd: 4, auto: 4, renommee: 3 } },
          { text: 'Quelques critiques décisifs, puis le rythme retombe. Vous avancez sans écrire l’histoire.', deltas: { spd: 2 } },
          { text: 'Aucun critique. La malchance règne ; vos lames glissent, le labyrinthe sourit dans l’ombre.', deltas: { moral: -6, hp: -4 } },
        ),
      },
      {
        id: 'voleur',
        label: 'Esquiver dans l’ombre des couloirs',
        ifClass: ['Voleur'],
        outcomes: trio(
          { text: 'Vous n’êtes qu’une ombre. Les coups vous manquent ; le couloir vous appartient sans bruit.', deltas: { spd: 7, renommee: 3, hp: 2 } },
          { text: 'Esquives utiles, progression moyenne. Vous glissez, vous survolez, sans encore disparaître.', deltas: { spd: 3, hp: -2 } },
          { text: 'L’esquive tombe au mauvais instant. Un mur vous trouve ; l’ombre vous abandonne.', deltas: { hp: -10, moral: -4 } },
        ),
      },
      {
        id: 'gated_couloir',
        label: 'Ouvrir un couloir interdit',
        require: { stats: { spd: 26, cap: 22 }, races: ['Elfe', 'Gnome'], classes: ['Voleur', 'Archer'] },
        outcomes: trio(
          { text: 'Le couloir cède. Record et butin : l’interdit s’ouvre comme une plaie dorée dans la pierre.', deltas: { spd: 4, renommee: 6, or: 8, trophies: { labyrinthe: 1 } } },
          { text: 'Vous avancez… puis rebroussez. Le souffle du labyrinthe vous rappelle que l’interdit a un prix.', deltas: { spd: 2, hp: -4 } },
          { text: 'Le labyrinthe se moque. Cul-de-sac : les murs se referment sur votre orgueil.', deltas: { hp: -10, moral: -5 } },
        ),
      },
    ],
  },
  {
    id: 'miroir',
    title: 'Le Miroir',
    text: 'Un reflet maudit vous attend. Même race, même classe… meilleurs choix ? Le verre attend votre réponse.',
    rarity: 'rare',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'duel',
        label: 'Accepter le duel contre votre reflet',
        outcomes: trio(
          { text: 'Vous brisez le miroir. Quelque chose se décante en vous — plus net, plus dur, enfin vôtre.', deltas: { auto: 4, cap: 3, moral: 6, renommee: 4 } },
          { text: 'Match nul intérieur. Leçon tiède : ni vainqueur, ni paix ; seulement le goût du verre frotté.', deltas: { moral: 1, hp: -3 } },
          { text: 'Le reflet gagne. La leçon est amère : vous vous voyez vaincu dans chaque éclat de verre.', deltas: { moral: -8, hp: -5, charisme: 1 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier ses feintes avant de frapper',
        outcomes: trio(
          { text: 'Vous anticipez chaque geste. Victoire nette : le reflet tombe avant d’avoir fini sa feinte.', deltas: { cap: 4, spd: 3, renommee: 3 } },
          { text: 'Vous voyez deux ouvertures. Une suffit : assez pour tenir, pas pour briser le mythe.', deltas: { cap: 2 } },
          { text: 'Trop d’hésitation. Le reflet frappe premier ; le verre vous renvoie votre propre lenteur.', deltas: { hp: -8, moral: -4 } },
        ),
      },
      {
        id: 'refuser',
        label: 'Refuser le miroir et méditer',
        outcomes: trio(
          { text: 'Pas de gloire. Un peu de paix intérieure : le verre reste intact, votre souffle aussi.', deltas: { moral: 6, hp: 5, renommee: -1 } },
          { text: 'Vous reposez l’esprit au bord du miroir. Calme relatif, sans illumination ni cicatrice.', deltas: { moral: 2, hp: 2 } },
          { text: 'Le reflet vous hante quand même. Derrière les paupières, il sourit — et vous ne dormez pas.', deltas: { moral: -4, renommee: -2 } },
        ),
      },
      {
        id: 'mortvivant',
        label: 'Tomber… puis revenir une fois',
        ifRace: ['Mort-vivant'],
        outcomes: trio(
          { text: 'La résurrection retourne le duel. Vous vous relevez ; le reflet, lui, reste brisé.', deltas: { def: 4, renommee: 5, moral: 3 } },
          { text: 'Vous revenez… juste pour tenir. Assez pour ne pas perdre, pas assez pour écraser le verre.', deltas: { def: 2, hp: -4 } },
          { text: 'La seconde mort est définitive. Même votre retour ne suffit ; le miroir garde votre silence.', deltas: { hp: -12, moral: -6 } },
        ),
      },
      {
        id: 'paladin',
        label: 'Riposter chaque coup du reflet',
        ifClass: ['Paladin'],
        outcomes: trio(
          { text: 'Chaque riposte sacrée le brise un peu plus. Le verre pleure de la lumière que vous renvoyez.', deltas: { def: 4, auto: 3, renommee: 3 } },
          { text: 'Quelques ripostes utiles. Le reflet recule d’un pas, sans encore se fendre.', deltas: { def: 2 } },
          { text: 'Vous ripostez dans le vide. Le reflet rit ; votre foi frappe l’air et revient vous mordre.', deltas: { moral: -4, hp: -4 } },
        ),
      },
    ],
  },
  {
    id: 'cataclysme',
    title: 'Cataclysme',
    text: 'Le ciel se fend. Une entité menace le monde entier. Au dixième souffle : EXTINCTION — ou votre nom.',
    rarity: 'epic',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'charge',
        label: 'Charger le cœur du Cataclysme',
        outcomes: trio(
          { text: 'Vos coups comptent. On murmure déjà « sauveur » ; le ciel, un instant, se referme.', deltas: { renommee: 14, auto: 5, hp: -10, trophies: { cataclysme: 1 } } },
          { text: 'Contribution solide avant le retrait. Vous avez blessé la chose — assez pour vivre, pas pour régner.', deltas: { renommee: 4, or: 4, hp: -6 } },
          { text: 'Vous êtes balayé dès les premiers tours. Le Cataclysme ne retient même pas votre silhouette.', deltas: { hp: -14, moral: -6, renommee: 1 } },
        ),
      },
      {
        id: 'soutien',
        label: 'Soutenir depuis les lignes arrières',
        outcomes: trio(
          { text: 'Soutien précieux. Le front tient grâce à vous ; les vivants gardent votre nom dans un murmure.', deltas: { or: 7, renommee: 4, hp: -2 } },
          { text: 'Présence correcte, impact discret. Vous avez servi ; le ciel n’a pas changé de couleur.', deltas: { or: 2 } },
          { text: 'Trop loin pour compter. On doute de vous ; les lignes avancent sans votre ombre.', deltas: { renommee: -4, moral: -3 } },
        ),
      },
      {
        id: 'corruption',
        label: 'Affronter un champion corrompu du Hall',
        outcomes: trio(
          { text: 'Vous brisez la corruption. L’ancien champion s’incline ; le Hall of Fame retrouve un visage propre.', deltas: { renommee: 10, cap: 4, auto: 3 } },
          { text: 'Duel difficile. Vous en sortez vivant, la corruption encore chaude sous les ongles.', deltas: { renommee: 3, hp: -7 } },
          { text: 'La corruption vous submerge. Le champion du Hall vous renvoie, noirci, aux portes du monde.', deltas: { hp: -13, moral: -7 } },
        ),
      },
      {
        id: 'dragonkin',
        label: 'Opposer vos écailles à la destruction',
        ifRace: ['Dragonkin', 'Écailleux', 'Turtlekin'],
        outcomes: trio(
          { text: 'Vos écailles tiennent le souffle du monde. Sous le feu, vous restez un rempart vivant.', deltas: { def: 5, cap: 3, renommee: 4 } },
          { text: 'Vous absorbez une part du choc. Assez pour que le front tienne ; votre carapace chante encore.', deltas: { def: 2, hp: -4 } },
          { text: 'Même une carapace a un point de rupture. Le Cataclysme le trouve ; vous pliez en silence.', deltas: { hp: -12, moral: -4 } },
        ),
      },
      {
        id: 'guerrier',
        label: 'Frappe pénétrante au point faible',
        ifClass: ['Guerrier', 'Berserk'],
        outcomes: trio(
          { text: 'La frappe ouvre une brèche. Le monde respire ; votre lame a touché le cœur de la chose.', deltas: { auto: 6, renommee: 5, trophies: { cataclysme: 1 } } },
          { text: 'Frappe correcte sur l’entité. Elle saigne un peu ; vous aussi. Le ciel reste fendu.', deltas: { auto: 2, hp: -3 } },
          { text: 'Vous frappez trop tôt. La brèche se referme ; votre élan se brise contre une peau d’étoiles.', deltas: { moral: -5, hp: -5 } },
        ),
      },
      {
        id: 'gated_sauveur',
        label: 'Se déclarer sauveur du Cataclysme',
        require: { stats: { auto: 32, cap: 28, def: 28 }, minRenommee: 25 },
        outcomes: trio(
          { text: 'Le monde retient votre nom. EXTINCTION recule ; les chroniques ouvrent une page à votre sang.', deltas: { renommee: 20, auto: 4, cap: 3, hp: -12, trophies: { cataclysme: 1 } } },
          { text: 'Contribution majeure, pas de mythe. Vous avez tenu le ciel — sans devenir la légende.', deltas: { renommee: 8, hp: -8 } },
          { text: 'L’entité vous brise. Le front tient sans vous ; votre déclaration de sauveur meurt dans la poussière.', deltas: { hp: -16, moral: -8 } },
        ),
      },
      {
        id: 'gated_bouclier',
        label: 'Tenir le rempart magique',
        require: { classes: ['Bastion', 'Paladin', 'Briseur de Sort'], weaponFamilies: ['bouclier'], stats: { def: 26 } },
        outcomes: trio(
          { text: 'Le rempart tient. Les lignes respirent derrière votre égide ; le Cataclysme bute, un souffle.', deltas: { def: 5, renommee: 7, hp: -5 } },
          { text: 'Vous absorbez l’essentiel. Le bouclier gémit, le front tient, la gloire reste ailleurs.', deltas: { def: 2, hp: -6 } },
          { text: 'Brèche. Recul forcé : le rempart magique se fend, et la ligne avec lui.', deltas: { hp: -11, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'grotte_merveilles',
    title: 'La Grotte aux merveilles',
    text: 'Forteresse gobeline, repaire des bandits, antre du dragon… Des armes y dorment encore sous la pierre.',
    rarity: 'uncommon',
    tags: ['donjons', 'loot'],
    options: [
      {
        id: 'grukk',
        label: 'Affronter le Chef Gobelin Grukk',
        outcomes: trio(
          { text: 'Grukk tombe. Une arme commune devient votre trophée ; la forteresse de pierre se tait enfin.', deltas: { or: 8, auto: 2, renommee: 3, trophies: { donjon: 1 } } },
          { text: 'Victoire poussive sur la tribu de pierre. Grukk fuit ; vous gardez l’or, pas la fierté.', deltas: { or: 3, hp: -4 } },
          { text: 'Les gobelins vous chassent hors de la forteresse. Leurs rires vous suivent jusqu’à l’air libre.', deltas: { hp: -9, moral: -4 } },
        ),
      },
      {
        id: 'bandit',
        label: 'Défier le Bandit des Grands Chemins',
        outcomes: trio(
          { text: 'Sa Lame Empoisonnée devient votre butin. Le Grand Chemin, pour une nuit, vous appartient.', deltas: { spd: 3, or: 10, renommee: 3 } },
          { text: 'Vous le battez… après une longue poursuite. Le poison a manqué ; la fatigue, non.', deltas: { or: 4, hp: -5 } },
          { text: 'Le poison vous force à fuir. Les Grands Chemins vous crachent ; la lame reste au bandit.', deltas: { hp: -10, moral: -3 } },
        ),
      },
      {
        id: 'vyraxion',
        label: 'Descendre dans l’antre de Vyraxion',
        outcomes: trio(
          { text: 'Le Dévoreur s’effondre. Un trésor légendaire pulse dans la cendre encore chaude.', deltas: { auto: 5, renommee: 8, or: 14, trophies: { donjon: 1 } } },
          { text: 'Vous échappez au Souffle de Flammes… de justesse. L’antre garde son cœur ; vous gardez la vie.', deltas: { def: 2, hp: -8, or: 4 } },
          { text: 'Vyraxion vous brûle hors de son antre. Vous rampez, noirci, sans même avoir vu le trésor.', deltas: { hp: -14, moral: -7 } },
        ),
      },
      {
        id: 'lycan',
        label: 'Laisser le saignement du Lycan faire son œuvre',
        ifRace: ['Lycan'],
        outcomes: trio(
          { text: 'Les blessures s’accumulent. La proie s’effondre ; votre meute intérieure hurle de satisfaction.', deltas: { auto: 5, renommee: 4, or: 5 } },
          { text: 'Le saignement aide sans tout décider. La proie boite ; le combat reste ouvert.', deltas: { auto: 2 } },
          { text: 'La proie vous échappe avant que le saignement porte. Vos crocs claquent dans le vide.', deltas: { moral: -5, hp: -4 } },
        ),
      },
      {
        id: 'masochiste',
        label: 'Accumuler la douleur pour la Purge sanglante',
        ifClass: ['Masochiste', 'Berserk'],
        outcomes: trio(
          { text: 'La purge explose. L’antre tremble ; votre douleur devient une lame que rien n’arrête.', deltas: { auto: 6, renommee: 4, hp: -5 } },
          { text: 'Douleur utile, résultat moyen. Vous avez payé le prix ; le butin reste tiède.', deltas: { auto: 2, hp: -6 } },
          { text: 'Vous tombez avant la purge. La douleur s’accumule… pour rien ; l’antre vous recrache.', deltas: { hp: -13, moral: -6 } },
        ),
      },
    ],
  },
  {
    id: 'taverne',
    title: 'La Taverne',
    text: 'Musique, paris, chibis sur les tables. Les champions du tournoi boivent… et jugent chaque mot.',
    rarity: 'common',
    tags: ['social'],
    options: [
      {
        id: 'recit',
        label: 'Raconter vos exploits (enjolivés)',
        outcomes: trio(
          { text: 'L’assemblée croit assez pour vous offrir une tournée… et un contact qui vaut de l’or demain.', deltas: { charisme: 6, renommee: 3, or: -2 } },
          { text: 'Quelques rires polis. On tape dans le dos ; personne ne retient vraiment le détail.', deltas: { charisme: 2 } },
          { text: 'On vous coupe : « Encore une histoire. » La salle se détourne ; votre voix meurt dans la bière.', deltas: { charisme: -3, moral: -4 } },
        ),
      },
      {
        id: 'pari',
        label: 'Rejoindre la table des paris',
        outcomes: trio(
          { text: 'Votre intuition paie. La Taverne murmure votre nom ; les pièces s’empilent comme des trophées.', deltas: { or: 14, renommee: 3, charisme: 2 } },
          { text: 'Ni riche, ni ruiné. Une soirée à égalité : la table vous rend ce qu’elle a pris, presque.', deltas: { or: 2 } },
          { text: 'Mauvaise série. La bourse fond ; les dés semblent vous connaître — et vous haïr.', deltas: { or: -12, moral: -5 } },
        ),
      },
      {
        id: 'ecouter',
        label: 'Écouter les rumeurs de combats et de donjons',
        outcomes: trio(
          { text: 'Une rumeur vraie sur un boss. Avantage net : demain, vous frapperez là où ça compte.', deltas: { cap: 3, spd: 2, moral: 2 } },
          { text: 'Des demi-vérités. Toujours ça : assez pour éviter un piège, pas pour ouvrir un trésor.', deltas: { cap: 1 } },
          { text: 'Rumeur fausse. Vous perdrez du temps plus tard — et peut-être du sang — sur une piste morte.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'sirene',
        label: 'Chanter pour apaiser la salle',
        ifRace: ['Sirène'],
        outcomes: trio(
          { text: 'Votre voix captive. Alliés et or affluent ; la Taverne retient son souffle jusqu’à la dernière note.', deltas: { charisme: 7, or: 5, moral: 3 } },
          { text: 'Jolie mélodie. Rien de plus : quelques sourires, pas de pacte, pas de bourse ouverte.', deltas: { charisme: 2 } },
          { text: 'Fausse note. On vous siffle ; la salle reprend ses paris comme si vous n’aviez jamais ouvert la bouche.', deltas: { charisme: -4, moral: -4 } },
        ),
      },
      {
        id: 'succube',
        label: 'Négocier un pacte… amical',
        ifClass: ['Succube'],
        outcomes: trio(
          { text: 'Un champion accepte de vous entraîner. Le pacte est tiède, utile, et sent la promesse tenue.', deltas: { charisme: 6, renommee: 3, cap: 2 } },
          { text: 'Conversation agréable, sans suite. Un sourire, un toast — puis chacun reprend son chemin.', deltas: { charisme: 2 } },
          { text: 'On vous prend pour un manipulateur. Froid soudain : les regards se ferment comme des portes.', deltas: { charisme: -4, moral: -5, renommee: -2 } },
        ),
      },
    ],
  },
  {
    id: 'boss_rush',
    title: 'Boss Rush',
    text: 'Vyraxion, Licorne, Liche, Ornn, Gojo, Koro Sensei… Six épreuves. Une seule respiration entre elles.',
    rarity: 'rare',
    tags: ['combat', 'ombres'],
    options: [
      {
        id: 'full',
        label: 'Affronter les six épreuves d’affilée',
        outcomes: trio(
          { text: 'Les six tombent. Vos mains tremblent encore ; la salle sent le sang, la cendre et la victoire.', deltas: { def: 5, auto: 4, hp: -11, renommee: 9, trophies: { bossRush: 1 } } },
          { text: 'Vous tombez au milieu… puis recommencez plus sage. Trois scalps, une leçon, pas la couronne.', deltas: { def: 2, hp: -8, moral: -2 } },
          { text: 'Vyraxion vous écrase d’entrée. Repos forcé : la rush s’arrête avant d’avoir vraiment commencé.', deltas: { hp: -14, moral: -7 } },
        ),
      },
      {
        id: 'checkpoint',
        label: 'S’arrêter après trois bosses',
        outcomes: trio(
          { text: 'Trois scalpés. Orgueil intact, gains solides : vous sortez avant que la fatigue ne mente.', deltas: { def: 3, or: 6, renommee: 3, hp: -4 } },
          { text: 'Progression honorable jusqu’au troisième. Vous vous arrêtez sans éclat, sans honte non plus.', deltas: { def: 1, or: 3, hp: -3 } },
          { text: 'Même trois, c’était trop. Le troisième vous jette ; le checkpoint devient une civière.', deltas: { hp: -9, moral: -4 } },
        ),
      },
      {
        id: 'gojo',
        label: 'Garder des forces pour Satoru Gojo',
        outcomes: trio(
          { text: 'Bleu, Rouge, Violet… vous survivez au territoire. Gojo incline à peine la tête — c’est assez.', deltas: { cap: 5, renommee: 6, hp: -6 } },
          { text: 'Vous passez Gojo de justesse. Le territoire vous lâche ; vos genoux, eux, se souviennent.', deltas: { cap: 2, hp: -7 } },
          { text: 'Le Violet vous efface. Une seconde d’infini — puis le noir, et la rush qui continue sans vous.', deltas: { hp: -13, moral: -6 } },
        ),
      },
      {
        id: 'humain',
        label: 'Compter sur la polyvalence humaine',
        ifRace: ['Humain'],
        outcomes: trio(
          { text: 'Un peu de tout, au bon moment. Victoire nette : chaque boss trouve la faille que vous saviez déjà.', deltas: { auto: 2, def: 2, cap: 2, spd: 2, renommee: 3 } },
          { text: 'Polyvalence correcte. Vous adaptez sans briller ; les six restent trop hauts pour un seul souffle.', deltas: { auto: 1, cap: 1 } },
          { text: 'Trop dispersé. Aucune force ne suffit ; chaque boss vous trouve médiocre là où il frappe.', deltas: { moral: -4, hp: -5 } },
        ),
      },
      {
        id: 'alchimiste',
        label: 'Enchaîner le cycle Feu / Vie / Acide',
        ifClass: ['Alchimiste'],
        outcomes: trio(
          { text: 'Le cycle est parfait. Les bosses fondent sous Feu, Vie et Acide — une danse de flasques précises.', deltas: { cap: 5, def: 2, or: 4, renommee: 3 } },
          { text: 'Flasques utiles, timing moyen. Le cycle aide ; il ne décide pas encore du sort des six.', deltas: { cap: 2 } },
          { text: 'Mauvaise flasque au mauvais boss. L’acide vous revient ; le Feu s’éteint trop tôt.', deltas: { hp: -9, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'extension',
    title: 'Extension du Territoire',
    text: 'Un domaine arcanique s’ouvre. On y fusionne un second passif mystique… si l’on survit à la porte.',
    rarity: 'rare',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'fusion',
        label: 'Tenter la fusion de passifs',
        outcomes: trio(
          { text: 'Fusion réussie. Votre aura devient unique : deux passifs tressés en une seule signature vivante.', deltas: { cap: 6, renommee: 5, or: 6, trophies: { extension: 1 } } },
          { text: 'Fusion partielle. Potentiel entrevu : une moitié d’aura, une moitié de doute sous la peau.', deltas: { cap: 3, hp: -4 } },
          { text: 'Le rituel échoue. Retour au seuil ; le domaine recrache votre ambition comme un os.', deltas: { hp: -10, moral: -5 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier les runes avant d’entrer',
        outcomes: trio(
          { text: 'Les runes révèlent une faille. Vous en profitez : le territoire s’ouvre comme un livre annoté.', deltas: { cap: 4, spd: 2, moral: 2 } },
          { text: 'Quelques indices utiles sur la pierre. Assez pour ne pas mourir bête, pas assez pour régner.', deltas: { cap: 1 } },
          { text: 'Vous lisez de travers. Le domaine punit : les runes se ferment sur vos doigts et votre orgueil.', deltas: { moral: -4, hp: -4 } },
        ),
      },
      {
        id: 'forcer',
        label: 'Forcer le territoire sans préparation',
        outcomes: trio(
          { text: 'L’audace paie. Passif rare arraché à mains nues ; le domaine cède à celui qui n’a pas douté.', deltas: { renommee: 6, cap: 3, or: 8 } },
          { text: 'Vous en sortez vivant, sans éclat. Le territoire vous a laissé passer — pas vous enrichir.', deltas: { hp: -5, or: 2 } },
          { text: 'Le territoire vous expulse. Une main invisible vous jette hors du cercle ; le seuil vous accueille à genoux.', deltas: { hp: -11, moral: -5 } },
        ),
      },
      {
        id: 'briseur',
        label: 'Briser les sorts du domaine',
        ifClass: ['Briseur de Sort', 'Sorcière'],
        outcomes: trio(
          { text: 'L’égide fractale étouffe le territoire. Les runes se taisent ; votre pas devient loi.', deltas: { cap: 5, def: 3, renommee: 3 } },
          { text: 'Vous affaiblissez quelques runes. Le domaine boite ; vous avancez sans encore le posséder.', deltas: { cap: 2 } },
          { text: 'Le domaine ignore votre égide. Vos fractures s’émoussent ; la magie adverse reste intacte.', deltas: { moral: -5, hp: -5 } },
        ),
      },
      {
        id: 'cendres',
        label: 'Nourrir vos braises Cendrés',
        ifRace: ['Cendrés'],
        outcomes: trio(
          { text: 'Les braises enflamment votre sort décisif. Le territoire brûle d’une flamme qui porte votre nom.', deltas: { cap: 6, auto: 3, hp: -3 } },
          { text: 'Quelques braises, effet correct. Assez de chaleur pour tenir, pas pour consumer le domaine.', deltas: { cap: 2, hp: -2 } },
          { text: 'Braises gaspillées trop tôt. Le feu meurt avant le sort ; le territoire vous glace en retour.', deltas: { hp: -8, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'coop_red',
    title: 'L’arène de Red',
    text: 'Finale chez Red. Les créatures attendent. Choisissez un dernier allié réel pour le duo — ou refusez et sortez.',
    rarity: 'uncommon',
    tags: ['donjons', 'social'],
    // Options injectées dynamiquement (3 personnages réels + refus)
    options: [],
  },
];

export const CAVE_DESTINY_EVENTS = [
  ...CAVE_DESTINY_EVENTS_CORE,
  ...CAVE_DESTINY_EVENTS_EXTRA,
];
