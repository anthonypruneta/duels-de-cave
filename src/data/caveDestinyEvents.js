/**
 * Événements Cave Destiny — 100 % univers Duels de Cave.
 * Chaque choix : 3 issues (bonus / neutre / malus).
 * Options supplémentaires selon race / classe.
 * Rareté : common | uncommon | rare | epic | legendary.
 */

import { CAVE_DESTINY_EVENTS_EXTRA } from './caveDestinyEventsExtra';
import { CAVE_DESTINY_WEAPON_QUEST_EVENTS } from './caveDestinyWeaponQuests';
import { trio, getOptionsForEvent } from './caveDestinyEventUtils';

export { trio, getOptionsForEvent };

const CAVE_DESTINY_EVENTS_CORE = [
  {
    id: 'tournoi_samedi',
    title: 'Tournoi du samedi',
    text: 'Les tambours de l’arène battent déjà.\nLes lots sont tirés, et le Hall of Fame guette un nouveau nom ou un oublié de plus.',
    rarity: 'uncommon',
    tags: ['tournoi', 'combat'],
    options: [
      {
        id: 'entrer',
        label: 'Entrer dans l’arène et viser la couronne',
        check: { auto: 1.2, spd: 0.7, def: 0.6 },
        outcomes: trio(
          { text: 'Vous tranchez jusqu’en finale.\nLa couronne claque sur votre front, et le Hall hurle votre nom.', deltas: { renommee: 14, auto: 5, moral: 8, or: 10, trophies: { tournoi: 1 } } },
          { text: 'Vous atteignez la demi-finale sous les torches.\nVous sortez salué, sans couronne, et l’arène retient pourtant le geste.', deltas: { renommee: 5, auto: 2, moral: -1, or: 3 } },
          { text: 'Le premier coup vous jette au sol.\nLe public détourne le regard, et votre nom ne franchit pas les gradins.', deltas: { renommee: -5, moral: -10, hp: -6 } },
        ),
      },
      {
        id: 'observer',
        label: 'Observer les combats depuis les gradins',
        check: { cap: 0.9, charisme: 0.8 },
        outcomes: trio(
          { text: 'Vous décryptez chaque feinte.\nDemain, votre duel aura le goût d’un piège bien tendu.', deltas: { cap: 4, charisme: 3, moral: 3 } },
          { text: 'Vous retenez deux ouvertures et un timing utile.\nIl n’y a pas de révélation, mais des armes pour le prochain samedi.', deltas: { cap: 1, charisme: 1 } },
          { text: 'Le match s’étire jusqu’à ce que votre menton touche la pierre.\nVous vous réveillez sans leçon, la bouche amère.', deltas: { moral: -4, hp: -2 } },
        ),
      },
      {
        id: 'parier',
        label: 'Parier à la Taverne sur un challenger oublié',
        check: { charisme: 1.3, renommee: 0.4 },
        outcomes: trio(
          { text: 'La cote était folle, et le challenger renverse le favori.\nLa bourse de la Taverne s’ouvre dans votre poche.', deltas: { or: 22, renommee: 4, charisme: 2 } },
          { text: 'Vous enchaînez un gain, une perte et une pinte.\nLa soirée s’équilibre sans éclat ni ruine.', deltas: { or: 2, moral: 1 } },
          { text: 'Votre challenger s’effondre au premier échange.\nLes pièces quittent la table comme des rats.', deltas: { or: -16, moral: -6 } },
        ),
      },
      {
        id: 'orc_rage',
        label: 'Laisser la fureur orc dicter le combat',
        ifRace: ['Orc', 'Cendrés'],
        outcomes: trio(
          { text: 'Le sang coule, et avec lui la fureur.\nL’adversaire recule, et l’arène apprend votre nom dans un hurlement.', deltas: { auto: 6, renommee: 6, hp: -4 } },
          { text: 'La rage pousse vos coups sans tout emporter.\nVous gagnez du terrain, pas la légende.', deltas: { auto: 2, hp: -5 } },
          { text: 'Vous forcez trop tôt.\nL’arbitre siffle, le public siffle plus fort, et l’arène vous rappelle à l’ordre.', deltas: { hp: -12, moral: -7, renommee: -2 } },
        ),
      },
      {
        id: 'mage_burst',
        label: 'Préparer une explosion arcanique décisive',
        ifClass: ['Mage', 'Sorcière', 'Demoniste'],
        outcomes: trio(
          { text: 'L’explosion clôt le duel d’un souffle blanc.\nLes gradins retiennent l’air, puis éclatent.', deltas: { cap: 7, renommee: 8, trophies: { tournoi: 1 } } },
          { text: 'Le sort lacère l’armure sans achever.\nVous infligez de gros dégâts, le duel reste ouvert, et vos poumons brûlent.', deltas: { cap: 3, hp: -3 } },
          { text: 'Le sort part trop tôt.\nVotre adversaire glisse dans la brèche et vous cloue au sable.', deltas: { cap: -1, moral: -8, hp: -4 } },
        ),
      },
      {
        id: 'gated_finale',
        label: 'Viser la finale sans détour',
        require: { stats: { auto: 28, spd: 24 }, minRenommee: 12 },
        outcomes: trio(
          { text: 'Vous forcez le bracket comme une lame.\nLa couronne tremble déjà sur le présentoir.', deltas: { renommee: 16, auto: 4, trophies: { tournoi: 1 } } },
          { text: 'Vous livrez une demi-finale honorable sous pression.\nLes torches vous suivent jusqu’à la sortie, sans titre.', deltas: { renommee: 6, hp: -5 } },
          { text: 'Vous êtes entré trop tôt pour ce bracket.\nLe sable avale votre course avant la finale.', deltas: { renommee: -4, moral: -8, hp: -6 } },
        ),
      },
      {
        id: 'gated_lame',
        label: 'Imposer votre lignée d’arme en duel',
        require: { weaponFamilies: ['epee', 'hache', 'lance', 'dague'], stats: { auto: 22 } },
        outcomes: trio(
          { text: 'Votre arme dicte le rythme.\nL’arène retient le geste comme un trait net dans la mémoire du samedi.', deltas: { auto: 4, renommee: 5 } },
          { text: 'Vous offrez une belle exhibition sous les vivats.\nIl n’y a pas de titre, mais la garde adverse a appris votre nom.', deltas: { auto: 2 } },
          { text: 'L’adversaire lit votre garde comme un livre ouvert.\nVotre lignée d’arme s’incline, sèche.', deltas: { hp: -7, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'foret',
    title: 'La Forêt enchantée',
    text: 'La clairière, le bosquet et le sanctuaire vous entourent.\nLes arbres murmurent, et quelque chose de vieux veille encore sous la mousse.',
    rarity: 'common',
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'rush',
        label: 'Traverser la forêt jusqu’au sanctuaire',
        check: { def: 1.1, auto: 0.8, spd: 0.5 },
        outcomes: trio(
          { text: 'Vous nettoyez les sentiers jusqu’au sanctuaire.\nLe butin des clairières pèse lourd dans vos sacs.', deltas: { def: 4, or: 12, hp: -4, trophies: { donjon: 1 } } },
          { text: 'Vous progressez honorablement entre racines et ronces.\nQuelques égratignures et un peu d’or suffisent, sans gloire.', deltas: { or: 5, def: 1, hp: -5 } },
          { text: 'Le sanglier fond depuis le sous-bois.\nL’embuscade vous renvoie sur le chemin, sanglant et honteux.', deltas: { hp: -12, moral: -5 } },
        ),
      },
      {
        id: 'farm',
        label: 'Chasser prudemment dans les clairières basses',
        check: { def: 0.9, spd: 0.6 },
        outcomes: trio(
          { text: 'Vous ramassez gibier, herbes et or.\nLes clairières basses ont payé leur dû pour une journée de forestier accomplie.', deltas: { or: 8, def: 2, hp: 2 } },
          { text: 'Vous rentrez avec peu de gloire et un peu d’or.\nLes herbes et la fatigue des sentiers restent votre seul trophée.', deltas: { or: 3 } },
          { text: 'Même un ours dit facile vous humilie.\nVous rampez hors de la clairière, la fierté en lambeaux.', deltas: { moral: -4, hp: -5, or: 1 } },
        ),
      },
      {
        id: 'licorne',
        label: 'Suivre la trace de la Licorne',
        outcomes: trio(
          { text: 'Vous l’affrontez sous la lune.\nSa faveur mystique s’ancre en vous, entre corne, lumière et serment.', deltas: { cap: 5, renommee: 4, or: 6 } },
          { text: 'Vous l’apercevez entre deux hêtres, puis elle disparaît.\nIl reste un frisson et une leçon incomplète.', deltas: { cap: 2, moral: 1 } },
          { text: 'La Licorne vous égare dans un labyrinthe de fougères.\nVous sortez épuisé, sans gloire ni trace.', deltas: { hp: -9, moral: -3 } },
        ),
      },
      {
        id: 'sylvari',
        label: 'Vous laisser guider par la sève Sylvari',
        ifRace: ['Sylvari'],
        outcomes: trio(
          { text: 'La forêt vous reconnaît.\nLa sève remonte, la régénération coule, et le butin s’offre aux racines amies.', deltas: { def: 5, hp: 6, or: 4 } },
          { text: 'Les racines vous soutiennent un peu.\nElles suffisent pour tenir, pas assez pour régner sur le sous-bois.', deltas: { hp: 2, def: 1 } },
          { text: 'Même la sève a ses limites.\nLes arbres se taisent, et vous tombez seul parmi les fougères.', deltas: { hp: -10, moral: -3 } },
        ),
      },
      {
        id: 'archer',
        label: 'Harceler les bêtes à distance',
        ifClass: ['Archer', 'Voleur'],
        outcomes: trio(
          { text: 'Vos flèches dansent entre les arbres.\nLa clairière se vide, et le silence vous appartient.', deltas: { spd: 6, or: 7, renommee: 3 } },
          { text: 'Vous harcelez bien, mais quelques flèches se perdent dans la mousse.\nLe butin reste correct, et le rythme se casse.', deltas: { spd: 2, hp: -3 } },
          { text: 'Vous vous coinces contre un chêne.\nLa faune en profite avec crocs et griffes, et la retraite devient honteuse.', deltas: { hp: -9, spd: -1, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'tour_mage',
    title: 'Tour du Mage',
    text: 'Le hall des grimoires, la galerie d’os et le sommet nécromant vous attendent.\nChaque étage offre un passif, et un prix écrit en sang.',
    rarity: 'uncommon',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'push',
        label: 'Gravir l’étage suivant sans détour',
        outcomes: trio(
          { text: 'Vous conquérez l’étage.\nUn passif rare s’ancre sous votre peau comme une rune encore chaude.', deltas: { cap: 7, renommee: 5, hp: -5, trophies: { tour: 1 } } },
          { text: 'Vous passez avec très peu de PV.\nL’escalier suivant sent déjà le sang et la poussière d’os.', deltas: { cap: 3, hp: -8 } },
          { text: 'Le gardien vous renvoie au hall d’entrée.\nLes grimoires se ferment, et la Tour vous a jugé trop tôt.', deltas: { hp: -11, moral: -6, cap: 1 } },
        ),
      },
      {
        id: 'passif',
        label: 'Choisir un passif avec soin',
        outcomes: trio(
          { text: 'La synergie tombe parfaitement.\nVotre aura change de teinte, et l’étage suivant semble déjà plus bas.', deltas: { cap: 5, spd: 2, moral: 3 } },
          { text: 'Vous choisissez un passif correct, rien d’éclatant.\nVous grimpez avec un outil utile, pas une révélation.', deltas: { cap: 2 } },
          { text: 'Vous avez fait un mauvais choix.\nL’étage suivant le prouve : votre aura grince, et les runes se moquent.', deltas: { moral: -5, cap: -1, renommee: -2 } },
        ),
      },
      {
        id: 'liche',
        label: 'Affronter les ombres de la Liche',
        outcomes: trio(
          { text: 'La barrière macabre cède.\nVous grimpez dans un souffle d’os et de victoire froide.', deltas: { cap: 6, renommee: 4, or: 5 } },
          { text: 'Vous survolez la galerie d’os sans la conquérir.\nVous avancez assez pour progresser, pas pour briller.', deltas: { cap: 2, hp: -4 } },
          { text: 'Les ossements vous enterrent presque.\nLa Liche rit sans bouche, et vous rampez vers la sortie.', deltas: { hp: -12, moral: -5 } },
        ),
      },
      {
        id: 'mindflayer',
        label: 'Voler la première capacité reçue',
        ifRace: ['Mindflayer'],
        outcomes: trio(
          { text: 'Vous renvoyez le sort volé.\nLe gardien vacille, et votre esprit goûte le pouvoir encore chaud.', deltas: { cap: 8, renommee: 4 } },
          { text: 'Le sort copié reste moyen.\nIl suffit pour tenir l’échange, trop fade pour la légende.', deltas: { cap: 3 } },
          { text: 'Vous n’avez rien à voler au bon moment.\nVotre esprit vacille, et la Tour vous rend la monnaie en migraine.', deltas: { moral: -5, hp: -3 } },
        ),
      },
      {
        id: 'healer',
        label: 'Soutenir la montée par des soins précis',
        ifClass: ['Healer', 'Alchimiste'],
        outcomes: trio(
          { text: 'Vos soins portent l’assaut.\nL’étage tombe sous une lumière verte qui sent l’herbe et la victoire.', deltas: { cap: 5, charisme: 4, or: 5 } },
          { text: 'Vous maintenez le rythme avec assez de baume pour ne pas mourir.\nIl n’y en a pas assez pour dominer.', deltas: { cap: 2, hp: 1 } },
          { text: 'Votre soin arrive trop tard.\nVous rentrez au hall les mains vides, le goût du sang dans la gorge.', deltas: { moral: -6, renommee: -3 } },
        ),
      },
    ],
  },
  {
    id: 'forge_ornn',
    title: 'Forge des Légendes',
    text: 'Les soufflets d’Ornn rugissent.\nVotre {arme} attend d’être jugée : rare, ou, les dieux aidant, {arme_legendaire}.\nUne arme qu’il a touchée pèse autrement quand le duel mythique viendra.',
    rarity: 'rare',
    tags: ['forge', 'arme', 'arme_upgrade'],
    options: [
      {
        id: 'fight',
        label: 'Défier Ornn pour reforger {arme}',
        outcomes: trio(
          {
            text: 'Ornn incline la tête.\nLe métal chante, et votre {arme} naît une fois de plus, plus vive, plus fière.',
            deltas: { or: -6, hp: -7, trophies: { forge: 1 } },
            weaponProgress: 'upgrade',
          },
          { text: 'Vous frôlez la réussite.\nLe dieu exige encore une épreuve, et les étincelles meurent avant la dernière frappe.', deltas: { auto: 2, hp: -8, or: -2 } },
          { text: 'Ornn n’est pas impressionné.\nLes étincelles s’éteignent, et votre {arme} reste ce qu’elle était.', deltas: { hp: -12, moral: -6 } },
        ),
      },
      {
        id: 'wait',
        label: 'Attendre d’être prêt… vraiment prêt',
        outcomes: trio(
          { text: 'Vous préparez or et résolution.\nLa forge attend, et vous aussi, sans trembler.', deltas: { or: 8, moral: 2 } },
          { text: 'Vous attendez dans le bruit des soufflets.\nLa forge attend aussi, le temps passe, et rien ne se brise ni ne s’élève.', deltas: { or: 2 } },
          { text: 'D’autres partent reforgés, pas vous.\nLes soufflets sifflent votre absence comme un affront.', deltas: { moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'offrir',
        label: 'Présenter {arme} en offrande',
        outcomes: [
          {
            variant: 'bonus',
            weight: 12,
            text: 'Le miracle se produit sous vos yeux.\nOrnn ne se contente pas d’upgrader : il transcende.\nVotre {arme} devient {arme_legendaire}.',
            deltas: { renommee: 4, hp: -5, or: -4, trophies: { forge: 1 } },
            weaponProgress: 'legendary',
          },
          {
            variant: 'neutre',
            weight: 48,
            text: 'Il regarde longtemps, puis reforgé d’un cran.\nIl n’y a pas de mythe, mais le métal a changé de voix.',
            deltas: { charisme: 1, or: -2 },
            weaponProgress: 'upgrade',
          },
          {
            variant: 'malus',
            weight: 40,
            text: 'L’offrande est jugée indigne.\nOrnn détourne le regard, et l’humiliation reste tiède sous les soufflets.',
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
            text: 'Vous tenez comme la montagne.\nOrnn forge, le marteau tombe, et votre lignée d’acier s’élève.',
            deltas: { def: 3, trophies: { forge: 1 } },
            weaponProgress: 'upgrade',
          },
          { text: 'Vous encaissez juste assez.\nLa tradition tient, et le dieu ne sourit pas encore.', deltas: { def: 3, hp: -6 } },
          { text: 'Même la pierre peut se fendre.\nVotre tradition naine craque sous un seul coup de marteau divin.', deltas: { hp: -13, def: -1, moral: -5 } },
        ),
      },
      {
        id: 'bastion',
        label: 'Avancer derrière le Rempart',
        ifClass: ['Bastion', 'Paladin', 'Briseur de Sort'],
        outcomes: trio(
          { text: 'Votre égide tient le choc.\nLes coups d’Ornn rebondissent, et derrière le Rempart vous avancez sans plier.', deltas: { def: 6, renommee: 4, hp: -4 } },
          { text: 'Votre bouclier reste correct, et la progression lente.\nVous absorbez et avancez, sans encore forcer le respect divin.', deltas: { def: 2, hp: -5 } },
          { text: 'Le rempart cède trop tôt.\nLe marteau d’Ornn traverse l’égide, et vous reculez, brûlé et muet.', deltas: { hp: -11, moral: -4 } },
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
            text: 'Ornn finit par céder.\nLa légende s’écrit dans le fer, et votre {arme} devient {arme_legendaire} sous les soufflets.',
            deltas: { renommee: 6, hp: -8, or: -8, trophies: { forge: 1 } },
            weaponProgress: 'legendary',
          },
          {
            variant: 'neutre',
            weight: 45,
            text: 'Il refuse le mythe, mais upgrade quand même.\nLe métal progresse, et la légende attendra.',
            deltas: { or: -4, hp: -5 },
            weaponProgress: 'upgrade',
          },
          {
            variant: 'malus',
            weight: 35,
            text: 'Votre orgueil reçoit sa punition.\nLes soufflets se taisent, et Ornn vous laisse avec le goût du fer froid.',
            deltas: { moral: -7, renommee: -3, hp: -6 },
          },
        ],
      },
    ],
  },
  {
    id: 'labyrinthe',
    title: 'Labyrinthe Infini',
    text: 'Cent vingt étages se reforment autour de vous.\nRois et dieux du labyrinthe attendent au fond du couloir qui bouge.',
    rarity: 'uncommon',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'record',
        label: 'Pousser pour un nouveau palier',
        outcomes: trio(
          { text: 'Vous posez un nouveau record.\nVotre nom monte au classement hebdomadaire, et les murs applaudissent en silence.', deltas: { spd: 5, renommee: 8, hp: -7, trophies: { labyrinthe: 1 } } },
          { text: 'Vous gagnez un palier correct, sans rien d’historique.\nVous prenez un étage, perdez du sang, et gardez l’honneur.', deltas: { spd: 2, hp: -5, or: 2 } },
          { text: 'Les couloirs se referment.\nVous êtes perdu, et l’écho de vos pas devient une moquerie.', deltas: { hp: -12, moral: -6 } },
        ),
      },
      {
        id: 'loot',
        label: 'Une incursion courte pour le butin',
        outcomes: trio(
          { text: 'Vous enchaînez entrée, coffre et sortie.\nL’or cliquette, et les murs n’ont pas eu le temps de se refermer.', deltas: { or: 10, hp: -2 } },
          { text: 'Vous tirez un butin modeste dans un alcôve poussiéreux.\nIl y en a assez pour boire, pas assez pour se vanter à la Taverne.', deltas: { or: 3, hp: -3 } },
          { text: 'Vous tombez pour quelques pièces.\nLe labyrinthe prend son dû, et vous rampez avec des monnaies collées au sang.', deltas: { hp: -8, or: 1, moral: -3 } },
        ),
      },
      {
        id: 'carte',
        label: 'Cartographier les détours avant d’avancer',
        outcomes: trio(
          { text: 'Votre carte ment moins que les murs.\nLe prochain couloir s’ouvre comme une porte connue.', deltas: { cap: 3, spd: 3, renommee: 2 } },
          { text: 'Vous prenez quelques notes utiles au crayon.\nLa carte n’est pas parfaite, mais moins de pièges attendent sous vos pieds.', deltas: { cap: 1 } },
          { text: 'La carte était fausse dès le départ.\nVous suivez une piste morte jusqu’à une embuscade.', deltas: { hp: -9, moral: -5 } },
        ),
      },
      {
        id: 'elfe',
        label: 'Compter sur la grâce critique des Elfes',
        ifRace: ['Elfe', 'Gnome'],
        outcomes: trio(
          { text: 'Les critiques s’enchaînent.\nLe couloir s’ouvre sous une pluie de traits précis et cruels.', deltas: { spd: 4, auto: 4, renommee: 3 } },
          { text: 'Quelques critiques décisifs tombent, puis le rythme retombe.\nVous avancez sans écrire l’histoire.', deltas: { spd: 2 } },
          { text: 'Aucun critique ne sort de vos lames.\nLa malchance règne, vos lames glissent, et le labyrinthe sourit dans l’ombre.', deltas: { moral: -6, hp: -4 } },
        ),
      },
      {
        id: 'voleur',
        label: 'Esquiver dans l’ombre des couloirs',
        ifClass: ['Voleur'],
        outcomes: trio(
          { text: 'Vous n’êtes qu’une ombre.\nLes coups vous manquent, et le couloir vous appartient sans bruit.', deltas: { spd: 7, renommee: 3, hp: 2 } },
          { text: 'Vos esquives restent utiles, et la progression moyenne.\nVous glissez et survolez, sans encore disparaître.', deltas: { spd: 3, hp: -2 } },
          { text: 'L’esquive tombe au mauvais instant.\nUn mur vous trouve, et l’ombre vous abandonne.', deltas: { hp: -10, moral: -4 } },
        ),
      },
      {
        id: 'gated_couloir',
        label: 'Ouvrir un couloir interdit',
        require: { stats: { spd: 26, cap: 22 }, races: ['Elfe', 'Gnome'], classes: ['Voleur', 'Archer'] },
        outcomes: trio(
          { text: 'Le couloir cède sous votre pas.\nLe record et le butin suivent, et l’interdit s’ouvre comme une plaie dorée dans la pierre.', deltas: { spd: 4, renommee: 6, or: 8, trophies: { labyrinthe: 1 } } },
          { text: 'Vous avancez, puis rebroussez.\nLe souffle du labyrinthe vous rappelle que l’interdit a un prix.', deltas: { spd: 2, hp: -4 } },
          { text: 'Le labyrinthe se moque de vous.\nLes murs se referment sur votre orgueil dans un cul-de-sac.', deltas: { hp: -10, moral: -5 } },
        ),
      },
    ],
  },
  {
    id: 'miroir',
    title: 'Le Miroir',
    text: 'Un reflet maudit vous attend.\nIl porte la même race et la même classe, avec de meilleurs choix peut-être.\nLe verre attend votre réponse.',
    rarity: 'rare',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'duel',
        label: 'Accepter le duel contre votre reflet',
        outcomes: trio(
          { text: 'Vous brisez le miroir.\nQuelque chose se décante en vous, plus net, plus dur, enfin vôtre.', deltas: { auto: 4, cap: 3, moral: 6, renommee: 4 } },
          { text: 'Le duel intérieur se termine sur un match nul.\nLa leçon reste tiède : ni vainqueur, ni paix, seulement le goût du verre frotté.', deltas: { moral: 1, hp: -3 } },
          { text: 'Le reflet gagne.\nLa leçon est amère, et vous vous voyez vaincu dans chaque éclat de verre.', deltas: { moral: -8, hp: -5, charisme: 1 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier ses feintes avant de frapper',
        outcomes: trio(
          { text: 'Vous anticipez chaque geste.\nLe reflet tombe avant d’avoir fini sa feinte.', deltas: { cap: 4, spd: 3, renommee: 3 } },
          { text: 'Vous voyez deux ouvertures, et une suffit.\nVous tenez assez pour durer, pas pour briser le mythe.', deltas: { cap: 2 } },
          { text: 'Vous hésitez trop longtemps.\nLe reflet frappe premier, et le verre vous renvoie votre propre lenteur.', deltas: { hp: -8, moral: -4 } },
        ),
      },
      {
        id: 'refuser',
        label: 'Refuser le miroir et méditer',
        outcomes: trio(
          { text: 'Vous refusez la gloire et gagnez un peu de paix intérieure.\nLe verre reste intact, et votre souffle aussi.', deltas: { moral: 6, hp: 5, renommee: -1 } },
          { text: 'Vous reposez l’esprit au bord du miroir.\nLe calme reste relatif, sans illumination ni cicatrice.', deltas: { moral: 2, hp: 2 } },
          { text: 'Le reflet vous hante quand même.\nDerrière les paupières, il sourit, et vous ne dormez pas.', deltas: { moral: -4, renommee: -2 } },
        ),
      },
      {
        id: 'mortvivant',
        label: 'Tomber… puis revenir une fois',
        ifRace: ['Mort-vivant'],
        outcomes: trio(
          { text: 'La résurrection retourne le duel.\nVous vous relevez, et le reflet, lui, reste brisé.', deltas: { def: 4, renommee: 5, moral: 3 } },
          { text: 'Vous revenez juste pour tenir.\nVous évitez la défaite, sans assez de force pour écraser le verre.', deltas: { def: 2, hp: -4 } },
          { text: 'La seconde mort est définitive.\nMême votre retour ne suffit, et le miroir garde votre silence.', deltas: { hp: -12, moral: -6 } },
        ),
      },
      {
        id: 'paladin',
        label: 'Riposter chaque coup du reflet',
        ifClass: ['Paladin'],
        outcomes: trio(
          { text: 'Chaque riposte sacrée le brise un peu plus.\nLe verre pleure de la lumière que vous renvoyez.', deltas: { def: 4, auto: 3, renommee: 3 } },
          { text: 'Quelques ripostes utiles trouvent leur marque.\nLe reflet recule d’un pas, sans encore se fendre.', deltas: { def: 2 } },
          { text: 'Vous ripostez dans le vide.\nLe reflet rit, et votre foi frappe l’air puis revient vous mordre.', deltas: { moral: -4, hp: -4 } },
        ),
      },
    ],
  },
  {
    id: 'cataclysme',
    title: 'Cataclysme',
    text: 'Le ciel se fend.\nUne entité menace le monde entier.\nAu dixième souffle, EXTINCTION s’approche, ou votre nom s’élève.',
    rarity: 'epic',
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'charge',
        label: 'Charger le cœur du Cataclysme',
        outcomes: trio(
          { text: 'Vos coups comptent.\nOn murmure déjà le mot sauveur, et le ciel, un instant, se referme.', deltas: { renommee: 14, auto: 5, hp: -10, trophies: { cataclysme: 1 } } },
          { text: 'Vous apportez une contribution solide avant le retrait.\nVous avez blessé la chose assez pour vivre, pas pour régner.', deltas: { renommee: 4, or: 4, hp: -6 } },
          { text: 'Vous êtes balayé dès les premiers tours.\nLe Cataclysme ne retient même pas votre silhouette.', deltas: { hp: -14, moral: -6, renommee: 1 } },
        ),
      },
      {
        id: 'soutien',
        label: 'Soutenir depuis les lignes arrières',
        outcomes: trio(
          { text: 'Votre soutien se révèle précieux.\nLe front tient grâce à vous, et les vivants gardent votre nom dans un murmure.', deltas: { or: 7, renommee: 4, hp: -2 } },
          { text: 'Votre présence reste correcte, l’impact discret.\nVous avez servi, et le ciel n’a pas changé de couleur.', deltas: { or: 2 } },
          { text: 'Vous restez trop loin pour compter.\nOn doute de vous, et les lignes avancent sans votre ombre.', deltas: { renommee: -4, moral: -3 } },
        ),
      },
      {
        id: 'corruption',
        label: 'Affronter un champion corrompu du Hall',
        outcomes: trio(
          { text: 'Vous brisez la corruption.\nL’ancien champion s’incline, et le Hall of Fame retrouve un visage propre.', deltas: { renommee: 10, cap: 4, auto: 3 } },
          { text: 'Le duel se révèle difficile.\nVous en sortez vivant, la corruption encore chaude sous les ongles.', deltas: { renommee: 3, hp: -7 } },
          { text: 'La corruption vous submerge.\nLe champion du Hall vous renvoie, noirci, aux portes du monde.', deltas: { hp: -13, moral: -7 } },
        ),
      },
      {
        id: 'dragonkin',
        label: 'Opposer vos écailles à la destruction',
        ifRace: ['Dragonkin', 'Écailleux', 'Turtlekin'],
        outcomes: trio(
          { text: 'Vos écailles tiennent le souffle du monde.\nSous le feu, vous restez un rempart vivant.', deltas: { def: 5, cap: 3, renommee: 4 } },
          { text: 'Vous absorbez une part du choc.\nLe front tient grâce à vous, et votre carapace chante encore.', deltas: { def: 2, hp: -4 } },
          { text: 'Même une carapace a un point de rupture.\nLe Cataclysme le trouve, et vous pliez en silence.', deltas: { hp: -12, moral: -4 } },
        ),
      },
      {
        id: 'guerrier',
        label: 'Frappe pénétrante au point faible',
        ifClass: ['Guerrier', 'Berserk'],
        outcomes: trio(
          { text: 'La frappe ouvre une brèche.\nLe monde respire, et votre lame a touché le cœur de la chose.', deltas: { auto: 6, renommee: 5, trophies: { cataclysme: 1 } } },
          { text: 'Vous portez une frappe correcte sur l’entité.\nElle saigne un peu, vous aussi, et le ciel reste fendu.', deltas: { auto: 2, hp: -3 } },
          { text: 'Vous frappez trop tôt.\nLa brèche se referme, et votre élan se brise contre une peau d’étoiles.', deltas: { moral: -5, hp: -5 } },
        ),
      },
      {
        id: 'gated_sauveur',
        label: 'Se déclarer sauveur du Cataclysme',
        require: { stats: { auto: 32, cap: 28, def: 28 }, minRenommee: 25 },
        outcomes: trio(
          { text: 'Le monde retient votre nom.\nEXTINCTION recule, et les chroniques ouvrent une page à votre sang.', deltas: { renommee: 20, auto: 4, cap: 3, hp: -12, trophies: { cataclysme: 1 } } },
          { text: 'Vous offrez une contribution majeure, sans mythe.\nVous avez tenu le ciel sans devenir la légende.', deltas: { renommee: 8, hp: -8 } },
          { text: 'L’entité vous brise.\nLe front tient sans vous, et votre déclaration de sauveur meurt dans la poussière.', deltas: { hp: -16, moral: -8 } },
        ),
      },
      {
        id: 'gated_bouclier',
        label: 'Tenir le rempart magique',
        require: { classes: ['Bastion', 'Paladin', 'Briseur de Sort'], weaponFamilies: ['bouclier'], stats: { def: 26 } },
        outcomes: trio(
          { text: 'Le rempart tient.\nLes lignes respirent derrière votre égide, et le Cataclysme bute un souffle.', deltas: { def: 5, renommee: 7, hp: -5 } },
          { text: 'Vous absorbez l’essentiel.\nLe bouclier gémit, le front tient, et la gloire reste ailleurs.', deltas: { def: 2, hp: -6 } },
          { text: 'Une brèche s’ouvre dans vos lignes.\nLe rempart magique se fend, et la ligne recule avec lui.', deltas: { hp: -11, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'grotte_merveilles',
    title: 'La Grotte aux merveilles',
    text: 'La forteresse gobeline, le repaire des bandits et l’antre du dragon s’ouvrent devant vous.\nDes armes y dorment encore sous la pierre.',
    rarity: 'uncommon',
    tags: ['donjons', 'loot'],
    options: [
      {
        id: 'grukk',
        label: 'Affronter le Chef Gobelin Grukk',
        outcomes: trio(
          { text: 'Grukk s’écroule à vos pieds.\nUne arme commune devient votre trophée, et la forteresse de pierre se tait enfin.', deltas: { or: 8, auto: 2, renommee: 3, trophies: { donjon: 1 } } },
          { text: 'Vous arrachez une victoire poussive sur la tribu de pierre.\nGrukk fuit, et vous gardez l’or sans la fierté.', deltas: { or: 3, hp: -4 } },
          { text: 'Les gobelins vous chassent hors de la forteresse.\nLeurs rires vous suivent jusqu’à l’air libre.', deltas: { hp: -9, moral: -4 } },
        ),
      },
      {
        id: 'bandit',
        label: 'Défier le Bandit des Grands Chemins',
        outcomes: trio(
          { text: 'Sa Lame Empoisonnée devient votre butin.\nLe Grand Chemin, pour une nuit, vous appartient.', deltas: { spd: 3, or: 10, renommee: 3 } },
          { text: 'Vous le battez après une longue poursuite.\nLe poison a manqué, la fatigue non.', deltas: { or: 4, hp: -5 } },
          { text: 'Le poison vous force à fuir.\nLes Grands Chemins vous crachent, et la lame reste au bandit.', deltas: { hp: -10, moral: -3 } },
        ),
      },
      {
        id: 'vyraxion',
        label: 'Descendre dans l’antre de Vyraxion',
        outcomes: trio(
          { text: 'Le Dévoreur s’effondre.\nUn trésor légendaire pulse dans la cendre encore chaude.', deltas: { auto: 5, renommee: 8, or: 14, trophies: { donjon: 1 } } },
          { text: 'Vous échappez au Souffle de Flammes de justesse.\nL’antre garde son cœur, et vous gardez la vie.', deltas: { def: 2, hp: -8, or: 4 } },
          { text: 'Vyraxion vous brûle hors de son antre.\nVous rampez, noirci, sans même avoir vu le trésor.', deltas: { hp: -14, moral: -7 } },
        ),
      },
      {
        id: 'lycan',
        label: 'Laisser le saignement du Lycan faire son œuvre',
        ifRace: ['Lycan'],
        outcomes: trio(
          { text: 'Les blessures s’accumulent.\nLa proie s’effondre, et votre meute intérieure hurle de satisfaction.', deltas: { auto: 5, renommee: 4, or: 5 } },
          { text: 'Le saignement aide sans tout décider.\nLa proie boite, et le combat reste ouvert.', deltas: { auto: 2 } },
          { text: 'La proie vous échappe avant que le saignement porte.\nVos crocs claquent dans le vide.', deltas: { moral: -5, hp: -4 } },
        ),
      },
      {
        id: 'masochiste',
        label: 'Accumuler la douleur pour la Purge sanglante',
        ifClass: ['Masochiste', 'Berserk'],
        outcomes: trio(
          { text: 'La purge explose.\nL’antre tremble, et votre douleur devient une lame que rien n’arrête.', deltas: { auto: 6, renommee: 4, hp: -5 } },
          { text: 'La douleur reste utile, le résultat moyen.\nVous avez payé le prix, et le butin reste tiède.', deltas: { auto: 2, hp: -6 } },
          { text: 'Vous tombez avant la purge.\nLa douleur s’accumule pour rien, et l’antre vous recrache.', deltas: { hp: -13, moral: -6 } },
        ),
      },
    ],
  },
  {
    id: 'taverne',
    title: 'La Taverne',
    text: 'La musique, les paris et les chibis remplissent les tables.\nLes champions du tournoi boivent, et jugent chaque mot.',
    rarity: 'common',
    tags: ['social'],
    options: [
      {
        id: 'recit',
        label: 'Raconter vos exploits (enjolivés)',
        outcomes: trio(
          { text: 'L’assemblée croit assez pour vous offrir une tournée.\nUn contact qui vaut de l’or demain s’ajoute à la pinte.', deltas: { charisme: 6, renommee: 3, or: -2 } },
          { text: 'Quelques rires polis vous répondent.\nOn tape dans le dos, et personne ne retient vraiment le détail.', deltas: { charisme: 2 } },
          { text: 'On vous coupe avec un « Encore une histoire ».\nLa salle se détourne, et votre voix meurt dans la bière.', deltas: { charisme: -3, moral: -4 } },
        ),
      },
      {
        id: 'pari',
        label: 'Rejoindre la table des paris',
        outcomes: trio(
          { text: 'Votre intuition paie.\nLa Taverne murmure votre nom, et les pièces s’empilent comme des trophées.', deltas: { or: 14, renommee: 3, charisme: 2 } },
          { text: 'Vous n’êtes ni riche ni ruiné.\nLa table vous rend ce qu’elle a pris, presque à égalité.', deltas: { or: 2 } },
          { text: 'La série tourne mal.\nLa bourse fond, et les dés semblent vous connaître et vous haïr.', deltas: { or: -12, moral: -5 } },
        ),
      },
      {
        id: 'ecouter',
        label: 'Écouter les rumeurs de combats et de donjons',
        outcomes: trio(
          { text: 'Vous attrapez une rumeur vraie sur un boss.\nDemain, vous frapperez là où ça compte.', deltas: { cap: 3, spd: 2, moral: 2 } },
          { text: 'Vous n’entendez que des demi-vérités.\nElles suffisent pour éviter un piège, pas pour ouvrir un trésor.', deltas: { cap: 1 } },
          { text: 'La rumeur se révèle fausse.\nVous perdrez du temps plus tard, et peut-être du sang, sur une piste morte.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'sirene',
        label: 'Chanter pour apaiser la salle',
        ifRace: ['Sirène'],
        outcomes: trio(
          { text: 'Votre voix captive la salle.\nAlliés et or affluent, et la Taverne retient son souffle jusqu’à la dernière note.', deltas: { charisme: 7, or: 5, moral: 3 } },
          { text: 'Vous offrez une jolie mélodie, rien de plus.\nQuelques sourires répondent, sans pacte ni bourse ouverte.', deltas: { charisme: 2 } },
          { text: 'Une fausse note traverse la salle.\nOn vous siffle, et la salle reprend ses paris comme si vous n’aviez jamais ouvert la bouche.', deltas: { charisme: -4, moral: -4 } },
        ),
      },
      {
        id: 'succube',
        label: 'Négocier un pacte… amical',
        ifClass: ['Succube'],
        outcomes: trio(
          { text: 'Un champion accepte de vous entraîner.\nLe pacte est tiède, utile, et sent la promesse tenue.', deltas: { charisme: 6, renommee: 3, cap: 2 } },
          { text: 'La conversation reste agréable, sans suite.\nUn sourire et un toast passent, puis chacun reprend son chemin.', deltas: { charisme: 2 } },
          { text: 'On vous prend pour un manipulateur.\nLe froid tombe soudain, et les regards se ferment comme des portes.', deltas: { charisme: -4, moral: -5, renommee: -2 } },
        ),
      },
    ],
  },
  {
    id: 'boss_rush',
    title: 'Boss Rush',
    text: 'Vyraxion, la Licorne, la Liche, Ornn, Gojo et Koro Sensei vous attendent.\nSix épreuves se dressent, avec une seule respiration entre elles.',
    rarity: 'rare',
    tags: ['combat', 'ombres'],
    options: [
      {
        id: 'full',
        label: 'Affronter les six épreuves d’affilée',
        outcomes: trio(
          { text: 'Les six tombent.\nVos mains tremblent encore, et la salle sent le sang, la cendre et la victoire.', deltas: { def: 5, auto: 4, hp: -11, renommee: 9, trophies: { bossRush: 1 } } },
          { text: 'Vous tombez au milieu, puis recommencez plus sage.\nTrois scalps et une leçon restent, pas la couronne.', deltas: { def: 2, hp: -8, moral: -2 } },
          { text: 'Vyraxion vous écrase d’entrée.\nLa rush s’arrête avant d’avoir vraiment commencé.', deltas: { hp: -14, moral: -7 } },
        ),
      },
      {
        id: 'checkpoint',
        label: 'S’arrêter après trois bosses',
        outcomes: trio(
          { text: 'Vous scalpez trois bosses.\nL’orgueil reste intact, les gains solides, et vous sortez avant que la fatigue ne mente.', deltas: { def: 3, or: 6, renommee: 3, hp: -4 } },
          { text: 'Vous progressez honorablement jusqu’au troisième.\nVous vous arrêtez sans éclat, sans honte non plus.', deltas: { def: 1, or: 3, hp: -3 } },
          { text: 'Même trois, c’était trop.\nLe troisième vous jette, et le checkpoint devient une civière.', deltas: { hp: -9, moral: -4 } },
        ),
      },
      {
        id: 'gojo',
        label: 'Garder des forces pour Satoru Gojo',
        outcomes: trio(
          { text: 'Bleu, Rouge et Violet déferlent, et vous survivez au territoire.\nGojo incline à peine la tête, et cela suffit.', deltas: { cap: 5, renommee: 6, hp: -6 } },
          { text: 'Vous passez Gojo de justesse.\nLe territoire vous lâche, et vos genoux, eux, se souviennent.', deltas: { cap: 2, hp: -7 } },
          { text: 'Le Violet vous efface.\nUne seconde d’infini passe, puis le noir, et la rush continue sans vous.', deltas: { hp: -13, moral: -6 } },
        ),
      },
      {
        id: 'humain',
        label: 'Compter sur la polyvalence humaine',
        ifRace: ['Humain'],
        outcomes: trio(
          { text: 'Vous placez un peu de tout au bon moment.\nChaque boss trouve la faille que vous saviez déjà.', deltas: { auto: 2, def: 2, cap: 2, spd: 2, renommee: 3 } },
          { text: 'Votre polyvalence reste correcte.\nVous adaptez sans briller, et les six restent trop hauts pour un seul souffle.', deltas: { auto: 1, cap: 1 } },
          { text: 'Vous vous dispersez trop.\nAucune force ne suffit, et chaque boss vous trouve médiocre là où il frappe.', deltas: { moral: -4, hp: -5 } },
        ),
      },
      {
        id: 'alchimiste',
        label: 'Enchaîner le cycle Feu / Vie / Acide',
        ifClass: ['Alchimiste'],
        outcomes: trio(
          { text: 'Le cycle est parfait.\nLes bosses fondent sous Feu, Vie et Acide, dans une danse de flasques précises.', deltas: { cap: 5, def: 2, or: 4, renommee: 3 } },
          { text: 'Vos flasques restent utiles, le timing moyen.\nLe cycle aide, sans encore décider du sort des six.', deltas: { cap: 2 } },
          { text: 'Vous lancez la mauvaise flasque au mauvais boss.\nL’acide vous revient, et le Feu s’éteint trop tôt.', deltas: { hp: -9, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'extension',
    title: 'Extension du Territoire',
    text: 'Un domaine arcanique s’ouvre.\nOn y fusionne un second passif mystique si l’on survit à la porte.',
    rarity: 'rare',
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'fusion',
        label: 'Tenter la fusion de passifs',
        outcomes: trio(
          { text: 'La fusion réussit.\nVotre aura devient unique, deux passifs tressés en une seule signature vivante.', deltas: { cap: 6, renommee: 5, or: 6, trophies: { extension: 1 } } },
          { text: 'La fusion ne reste que partielle.\nVous entrevoyez le potentiel : une moitié d’aura, une moitié de doute sous la peau.', deltas: { cap: 3, hp: -4 } },
          { text: 'Le rituel échoue.\nVous rentrez au seuil, et le domaine recrache votre ambition comme un os.', deltas: { hp: -10, moral: -5 } },
        ),
      },
      {
        id: 'etudier',
        label: 'Étudier les runes avant d’entrer',
        outcomes: trio(
          { text: 'Les runes révèlent une faille.\nVous en profitez, et le territoire s’ouvre comme un livre annoté.', deltas: { cap: 4, spd: 2, moral: 2 } },
          { text: 'Vous relevez quelques indices utiles sur la pierre.\nIls suffisent pour ne pas mourir bête, pas assez pour régner.', deltas: { cap: 1 } },
          { text: 'Vous lisez de travers.\nLe domaine punit, et les runes se ferment sur vos doigts et votre orgueil.', deltas: { moral: -4, hp: -4 } },
        ),
      },
      {
        id: 'forcer',
        label: 'Forcer le territoire sans préparation',
        outcomes: trio(
          { text: 'L’audace paie son dû.\nVous arrachez un passif rare à mains nues, et le domaine cède à celui qui n’a pas douté.', deltas: { renommee: 6, cap: 3, or: 8 } },
          { text: 'Vous en sortez vivant, sans éclat.\nLe territoire vous a laissé passer, sans vous enrichir.', deltas: { hp: -5, or: 2 } },
          { text: 'Le territoire vous expulse.\nUne main invisible vous jette hors du cercle, et le seuil vous accueille à genoux.', deltas: { hp: -11, moral: -5 } },
        ),
      },
      {
        id: 'briseur',
        label: 'Briser les sorts du domaine',
        ifClass: ['Briseur de Sort', 'Sorcière'],
        outcomes: trio(
          { text: 'L’égide fractale étouffe le territoire.\nLes runes se taisent, et votre pas devient loi.', deltas: { cap: 5, def: 3, renommee: 3 } },
          { text: 'Vous affaiblissez quelques runes.\nLe domaine boite, et vous avancez sans encore le posséder.', deltas: { cap: 2 } },
          { text: 'Le domaine ignore votre égide.\nVos fractures s’émoussent, et la magie adverse reste intacte.', deltas: { moral: -5, hp: -5 } },
        ),
      },
      {
        id: 'cendres',
        label: 'Nourrir vos braises Cendrés',
        ifRace: ['Cendrés'],
        outcomes: trio(
          { text: 'Les braises enflamment votre sort décisif.\nLe territoire brûle d’une flamme qui porte votre nom.', deltas: { cap: 6, auto: 3, hp: -3 } },
          { text: 'Quelques braises donnent un effet correct.\nIl y a assez de chaleur pour tenir, pas pour consumer le domaine.', deltas: { cap: 2, hp: -2 } },
          { text: 'Vous gaspillez vos braises trop tôt.\nLe feu meurt avant le sort, et le territoire vous glace en retour.', deltas: { hp: -8, moral: -3 } },
        ),
      },
    ],
  },
  {
    id: 'coop_red',
    title: 'L’arène de Red',
    text: 'La finale se joue chez Red.\nLes créatures attendent.\nChoisissez un dernier allié réel pour le duo, ou refusez et sortez.',
    rarity: 'uncommon',
    tags: ['donjons', 'social'],
    // Options injectées dynamiquement (3 personnages réels + refus)
    options: [],
  },
];

export const CAVE_DESTINY_EVENTS = [
  ...CAVE_DESTINY_EVENTS_CORE,
  ...CAVE_DESTINY_EVENTS_EXTRA,
  ...CAVE_DESTINY_WEAPON_QUEST_EVENTS,
];
