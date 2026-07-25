/**
 * Événements Cave Destiny
 * « Cave » = joueur un peu con / débilos — pas une grotte.
 * Chaque choix a 3 issues aléatoires : bonus / neutre / malus.
 * Des options supplémentaires apparaissent selon race / classe.
 */

/** Construit le trio obligatoire bonus / neutre / malus */
export function trio(bonus, neutre, malus, weights = [30, 40, 30]) {
  return [
    { variant: 'bonus', weight: weights[0], text: bonus.text, deltas: bonus.deltas },
    { variant: 'neutre', weight: weights[1], text: neutre.text, deltas: neutre.deltas },
    { variant: 'malus', weight: weights[2], text: malus.text, deltas: malus.deltas },
  ];
}

function optionMatches(opt, character) {
  const race = character?.race;
  const classe = character?.class;
  if (opt.ifRace?.length && !opt.ifRace.includes(race)) return false;
  if (opt.ifClass?.length && !opt.ifClass.includes(classe)) return false;
  return true;
}

/**
 * Options visibles pour un perso : génériques + spécifiques race/classe.
 * Garantit au moins 3 choix.
 */
export function getOptionsForEvent(event, character) {
  const all = event?.options || [];
  const matched = all.filter((o) => optionMatches(o, character));
  if (matched.length >= 3) return matched;

  // Sécurité : complète avec des options sans filtre
  const generics = all.filter((o) => !o.ifRace?.length && !o.ifClass?.length);
  const ids = new Set(matched.map((o) => o.id || o.label));
  for (const g of generics) {
    const key = g.id || g.label;
    if (ids.has(key)) continue;
    matched.push(g);
    ids.add(key);
    if (matched.length >= 3) break;
  }
  return matched;
}

export const CAVE_DESTINY_EVENTS = [
  {
    id: 'tournoi_samedi',
    title: 'Tournoi du samedi',
    text: 'Brackets ouverts. Tout le Discord spit. On te traite déjà de cave avant même le premier match.',
    weight: 12,
    tags: ['tournoi', 'combat'],
    options: [
      {
        id: 'all_in',
        label: 'All-in, tu vises le titre (et tu tilt déjà)',
        outcomes: trio(
          { text: 'Tu grind jusqu’en finale. Même les caves applaudissent.', deltas: { renommee: 14, puissance: 5, moral: 8, or: 10, trophies: { tournoi: 1 } } },
          { text: 'Belle run… puis une demi-finale qui te ramène sur terre.', deltas: { renommee: 5, puissance: 2, moral: -2, or: 3 } },
          { text: 'Out T1. Chat : « cave confirmé ».', deltas: { renommee: -5, moral: -10, forme: -6 } },
        ),
      },
      {
        id: 'parer',
        label: 'Parier ton or sur un random',
        outcomes: trio(
          { text: 'Cote de malade. Tu touches le jackpot.', deltas: { or: 22, renommee: 4, charisme: 2 } },
          { text: 'Tu gagnes un peu, tu perds un peu. Classic cave banking.', deltas: { or: 2, moral: 1 } },
          { text: 'Ton outsider se fait farmer. Portefeuille en PLS.', deltas: { or: -16, moral: -6 } },
        ),
      },
      {
        id: 'analyser',
        label: 'Analyser la meta (enfin… essayer)',
        outcomes: trio(
          { text: 'Tu piges un truc. Pour une fois.', deltas: { magie: 4, charisme: 3, moral: 3 } },
          { text: 'Tu notes des trucs faux mais avec conviction.', deltas: { magie: 1, charisme: 1 } },
          { text: 'Tu confonds deux classes. On t’exile du vocal.', deltas: { moral: -5, renommee: -3 } },
        ),
      },
      {
        id: 'orc_rage',
        label: 'Mode rage Orc : sous 50% PV tu spam tout',
        ifRace: ['Orc', 'Cendrés'],
        outcomes: trio(
          { text: 'La rage paie. Le chat spit des emotes.', deltas: { puissance: 6, renommee: 6, forme: -4 } },
          { text: 'Spectaculaire… et moyen efficace.', deltas: { puissance: 2, forme: -6 } },
          { text: 'Tu te suicides en beauté. Cave energy.', deltas: { forme: -12, moral: -7, renommee: -2 } },
        ),
      },
      {
        id: 'mage_one_shot',
        label: 'Tenter le one-shot Mage plein Cap',
        ifClass: ['Mage', 'Sorcière', 'Demoniste'],
        outcomes: trio(
          { text: 'Explosion parfaite. L’adversaire n’a rien vu.', deltas: { magie: 7, renommee: 8, trophies: { tournoi: 1 } } },
          { text: 'Gros dégâts, pas assez pour finir.', deltas: { magie: 3, forme: -3 } },
          { text: 'Tu rates le timing. Esquive. Humiliation.', deltas: { magie: -1, moral: -8, forme: -4 } },
        ),
      },
    ],
  },
  {
    id: 'foret',
    title: 'Run Forêt',
    text: 'Tu lances une forêt « easy ». Spoiler : rien n’est easy quand t’es un cave.',
    weight: 11,
    tags: ['donjons', 'combat'],
    options: [
      {
        id: 'rush',
        label: 'Rush full clear sans lire les mécaniques',
        outcomes: trio(
          { text: 'Clear clean. Même un cave a le droit d’être lucky.', deltas: { endurance: 4, or: 12, forme: -4, trophies: { donjon: 1 } } },
          { text: 'Clear moyen, loot moyen, ego moyen.', deltas: { or: 5, endurance: 1, forme: -5 } },
          { text: 'Wipe sur un pack. Tu blame le lag.', deltas: { forme: -12, moral: -5 } },
        ),
      },
      {
        id: 'farm',
        label: 'Farm les étages bas comme un rat',
        outcomes: trio(
          { text: 'Petit benefit, zéro stress. Intelligent… pour un cave.', deltas: { or: 8, endurance: 2, forme: 2 } },
          { text: 'Tu farm. C’est tout.', deltas: { or: 3 } },
          { text: 'Même un étage bas te tape. Respect.', deltas: { moral: -4, forme: -5, or: 1 } },
        ),
      },
      {
        id: 'guide',
        label: 'Ouvrir un guide… puis ne pas le suivre',
        outcomes: trio(
          { text: 'Tu suis 2 lignes du guide. Ça suffit miraculeusement.', deltas: { magie: 3, or: 6, moral: 2 } },
          { text: 'Tu lis le titre du guide. Ça compte.', deltas: { magie: 1 } },
          { text: 'Tu fais l’inverse du guide. On t’avait prévenu.', deltas: { forme: -8, moral: -4 } },
        ),
      },
      {
        id: 'sylvari_heal',
        label: 'Compter sur la régène Sylvari et AFK mental',
        ifRace: ['Sylvari'],
        outcomes: trio(
          { text: 'La régène te porte. Nature is healing.', deltas: { endurance: 5, forme: 6, or: 4 } },
          { text: 'Ça tient… tout juste.', deltas: { forme: 2, endurance: 1 } },
          { text: 'Régène ≠ invincible. Découverte du jour.', deltas: { forme: -10, moral: -3 } },
        ),
      },
      {
        id: 'archer_kiting',
        label: 'Kiter comme un Archer pro (en théorie)',
        ifClass: ['Archer', 'Voleur'],
        outcomes: trio(
          { text: 'Kiting parfait. Les mobs te touchent jamais.', deltas: { vitesse: 6, or: 7, renommee: 3 } },
          { text: 'Tu kites… dans le mauvais sens une fois.', deltas: { vitesse: 2, forme: -3 } },
          { text: 'Tu te coins dans un arbre. Pixel perfect cave.', deltas: { forme: -9, vitesse: -1, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'tour_mage',
    title: 'Tour du Mage',
    text: 'Un nouvel étage. Un nouveau passif. Une nouvelle occasion de prouver que t’es un cave.',
    weight: 10,
    tags: ['donjons', 'magie'],
    options: [
      {
        id: 'push',
        label: 'Push l’étage les yeux fermés',
        outcomes: trio(
          { text: 'Étage pris. Passif stylé. Ego +3000.', deltas: { magie: 7, renommee: 5, forme: -5, trophies: { tour: 1 } } },
          { text: 'Tu passes… avec 3 PV. Classique.', deltas: { magie: 3, forme: -8 } },
          { text: 'Le gardien te renvoie au lobby.', deltas: { forme: -11, moral: -6, magie: 1 } },
        ),
      },
      {
        id: 'passif',
        label: 'Choisir le passif au feeling',
        outcomes: trio(
          { text: 'Feeling divin. Synergie parfaite.', deltas: { magie: 5, vitesse: 2, moral: 3 } },
          { text: 'Passif ok. Rien d’oufou.', deltas: { magie: 2 } },
          { text: 'Tu prends le pire passif possible. Bravo.', deltas: { moral: -5, magie: -1, renommee: -2 } },
        ),
      },
      {
        id: 'quit',
        label: 'Ragequit et dire que la Tour est trash',
        outcomes: trio(
          { text: 'Bizarrement, dormir t’aide. Tu reviens meilleur.', deltas: { moral: 6, forme: 5 } },
          { text: 'Tu rage. Personne ne lit ton message.', deltas: { moral: -1 } },
          { text: 'L’admin a vu ton message. Oops.', deltas: { renommee: -6, moral: -4 } },
        ),
      },
      {
        id: 'mindflayer',
        label: 'Vol de sort façon Mindflayer',
        ifRace: ['Mindflayer'],
        outcomes: trio(
          { text: 'Tu copies la capacité. Brain big.', deltas: { magie: 8, renommee: 4 } },
          { text: 'Tu copies… un sort meh.', deltas: { magie: 3 } },
          { text: 'Tu copies rien. Cerveau offline.', deltas: { moral: -5, forme: -3 } },
        ),
      },
      {
        id: 'healer_carry',
        label: 'Jouer Healer et claim le carry',
        ifClass: ['Healer', 'Alchimiste'],
        outcomes: trio(
          { text: 'Tes soins portent la run. Quiet carry.', deltas: { magie: 5, charisme: 4, or: 5 } },
          { text: 'Tu soignes. C’est le job.', deltas: { magie: 2, forme: 1 } },
          { text: 'Tu overheal le vide. Le DPS wipe.', deltas: { moral: -6, renommee: -3 } },
        ),
      },
    ],
  },
  {
    id: 'forge_ornn',
    title: 'Forge des Légendes',
    text: 'Ornn t’attend. Ton arme légendaire aussi. Ton cerveau… on verra.',
    weight: 8,
    tags: ['forge'],
    options: [
      {
        id: 'fight',
        label: 'Go Ornn, trust the process',
        outcomes: trio(
          { text: 'Upgrade proc. L’arme devient sales.', deltas: { puissance: 8, endurance: 3, or: -6, forme: -7, trophies: { forge: 1 } } },
          { text: 'Presque. Encore une run.', deltas: { puissance: 2, forme: -8, or: -2 } },
          { text: 'Ornn te regarde comme le cave que t’es.', deltas: { forme: -12, moral: -6 } },
        ),
      },
      {
        id: 'wait',
        label: 'Attendre d’être « prêt » (jamais)',
        outcomes: trio(
          { text: 'Tu farm l’or intelligemment. Rare.', deltas: { or: 8, moral: 2 } },
          { text: 'Tu attends. Le temps passe.', deltas: { or: 2 } },
          { text: 'Tout le monde a forgé sauf toi.', deltas: { moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'flex',
        label: 'Flex l’arme non forgée dans le chat',
        outcomes: trio(
          { text: 'Quelqu’un te donne un tip utile.', deltas: { charisme: 4, magie: 2 } },
          { text: 'Personne ne répond. Silence radio.', deltas: { charisme: -1 } },
          { text: 'On te roast. Mérité.', deltas: { renommee: -4, moral: -4 } },
        ),
      },
      {
        id: 'nain_tank',
        label: 'Tank Ornn en vrai Nain',
        ifRace: ['Nain', 'Turtlekin', 'Dragonkin'],
        outcomes: trio(
          { text: 'Tu tiens comme un mur. Forge secured.', deltas: { endurance: 7, puissance: 3, trophies: { forge: 1 } } },
          { text: 'Tu tiens… avec de la glue.', deltas: { endurance: 3, forme: -6 } },
          { text: 'Le mur a un trou. C’est toi le trou.', deltas: { forme: -13, endurance: -1, moral: -5 } },
        ),
      },
      {
        id: 'bastion',
        label: 'Bouclier Bastion full face',
        ifClass: ['Bastion', 'Paladin', 'Briseur de Sort'],
        outcomes: trio(
          { text: 'Égide active. Ornn râle. Tu souris.', deltas: { endurance: 6, renommee: 4, forme: -4 } },
          { text: 'Bouclier ok, DPS faible.', deltas: { endurance: 2, forme: -5 } },
          { text: 'Bouclier pop trop tôt. Free hit.', deltas: { forme: -11, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'labyrinthe',
    title: 'Labyrinthe Infini',
    text: 'Couloirs qui changent. Classement qui juge. Toi qui es perdu depuis l’entrée.',
    weight: 9,
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'record',
        label: 'Chase le record (ego first)',
        outcomes: trio(
          { text: 'Nouveau PB. Tu screenshots déjà.', deltas: { vitesse: 5, renommee: 8, forme: -7, trophies: { labyrinthe: 1 } } },
          { text: 'Palier correct. Rien à flex.', deltas: { vitesse: 2, forme: -5, or: 2 } },
          { text: 'Tu te perds au coin 2. Pathfinding cave.', deltas: { forme: -12, moral: -6 } },
        ),
      },
      {
        id: 'loot',
        label: 'Run courte loot & leave',
        outcomes: trio(
          { text: 'In and out. Portefeuille content.', deltas: { or: 10, forme: -2 } },
          { text: 'Loot meh.', deltas: { or: 3, forme: -3 } },
          { text: 'Tu meurs pour 2 pièces.', deltas: { forme: -8, or: 1, moral: -3 } },
        ),
      },
      {
        id: 'copier',
        label: 'Copier la run du top 1 (mal)',
        outcomes: trio(
          { text: 'Tu comprends 40% de sa run. Suffisant.', deltas: { magie: 3, vitesse: 3, renommee: 2 } },
          { text: 'Tu copies les emotes, pas le gameplay.', deltas: { charisme: 1 } },
          { text: 'Tu copies son wipe aussi.', deltas: { forme: -9, moral: -5 } },
        ),
      },
      {
        id: 'elfe_crit',
        label: 'Prier pour les crits Elfe',
        ifRace: ['Elfe', 'Gnome'],
        outcomes: trio(
          { text: 'Crits partout. RNG is God.', deltas: { vitesse: 4, puissance: 4, renommee: 3 } },
          { text: 'Crits moyens. RNG is mid.', deltas: { vitesse: 2 } },
          { text: 'Aucun crit. RNG is dead.', deltas: { moral: -6, forme: -4 } },
        ),
      },
      {
        id: 'voleur_dodge',
        label: 'Spam esquive Voleur',
        ifClass: ['Voleur'],
        outcomes: trio(
          { text: 'Tu es une ombre. Les coups te manquent.', deltas: { vitesse: 7, renommee: 3, forme: 2 } },
          { text: 'Esquive ok, DPS soft.', deltas: { vitesse: 3, forme: -2 } },
          { text: 'Esquive en CD au mauvais moment.', deltas: { forme: -10, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'taverne_nuit',
    title: 'Soirée Discord / Taverne',
    text: 'Vocal bondé. Quelqu’un explique la meta. Toi tu as mis le mute par erreur.',
    weight: 10,
    tags: ['social'],
    options: [
      {
        id: 'flex_build',
        label: 'Flex ton build pourri avec confiance',
        outcomes: trio(
          { text: 'Un joueur fort te corrige gentiment. Level up.', deltas: { charisme: 5, magie: 3, moral: 3 } },
          { text: 'On ignore. Survivable.', deltas: { charisme: 1 } },
          { text: 'Thread de 40 messages pour te démonter.', deltas: { renommee: -5, moral: -6 } },
        ),
      },
      {
        id: 'troll',
        label: 'Troll le chat (léger… ou pas)',
        outcomes: trio(
          { text: 'Le troll passe. On rit. Charisme cave.', deltas: { charisme: 6, renommee: 3, or: -2 } },
          { text: 'Un smiley. C’est tout.', deltas: { charisme: 1 } },
          { text: 'Warn. Tu jouais avec le feu.', deltas: { renommee: -7, moral: -4 } },
        ),
      },
      {
        id: 'afk',
        label: 'AFK en laissant le jeu ouvert',
        outcomes: trio(
          { text: 'Tu reviens frais. Miracle.', deltas: { forme: 8, moral: 4 } },
          { text: 'AFK productif : tu as pensé à rien.', deltas: { forme: 2 } },
          { text: 'Tu rate un event. FOMO instantané.', deltas: { moral: -5, renommee: -2 } },
        ),
      },
      {
        id: 'mortvivant',
        label: 'Blaguer sur ta rez Mort-vivant',
        ifRace: ['Mort-vivant'],
        outcomes: trio(
          { text: 'La blague tue. On t’adore (un peu).', deltas: { charisme: 6, moral: 4 } },
          { text: 'Rire poli.', deltas: { charisme: 2 } },
          { text: 'Personne ne rigole. Mort sociale.', deltas: { charisme: -3, moral: -5 } },
        ),
      },
      {
        id: 'succube',
        label: 'Tenter le lore Succube en vocal',
        ifClass: ['Succube'],
        outcomes: trio(
          { text: 'Charme réussi. Lobby friend +1.', deltas: { charisme: 7, renommee: 2 } },
          { text: 'Cringe soft.', deltas: { charisme: 1, moral: -1 } },
          { text: 'Cringe hard. Mute recommandé.', deltas: { charisme: -4, moral: -6, renommee: -2 } },
        ),
      },
    ],
  },
  {
    id: 'pvp',
    title: 'Défi PvP',
    text: 'Un random te challenge. Il a mis « ez » avant le match. Cave vs cave.',
    weight: 9,
    tags: ['combat', 'tournoi'],
    options: [
      {
        id: 'accept',
        label: 'Accept et ez clap (mental)',
        outcomes: trio(
          { text: 'Tu gagnes. Tu réponds « ez ». Circle of life.', deltas: { renommee: 9, puissance: 3, moral: 5, trophies: { pvp: 1 } } },
          { text: 'Match serré. Respect mutuel (rare).', deltas: { renommee: 3, forme: -4, moral: 1 } },
          { text: '0-1. Il a vraiment dit ez.', deltas: { moral: -8, forme: -5, renommee: -2 } },
        ),
      },
      {
        id: 'dodge',
        label: 'Dodge le lobby comme un lâche tactique',
        outcomes: trio(
          { text: 'Tu évites un smurf. Genius.', deltas: { moral: 4, forme: 2 } },
          { text: 'Tu dodge. Personne remarque.', deltas: { moral: 1 } },
          { text: 'Il post ton dodge. Shame.', deltas: { renommee: -5, moral: -4 } },
        ),
      },
      {
        id: 'swap',
        label: 'Changer de build 10 sec avant le start',
        outcomes: trio(
          { text: 'Le swap hard-counter. Brain blast.', deltas: { magie: 4, renommee: 5, moral: 3 } },
          { text: 'Swap neutre. Bof.', deltas: { magie: 1 } },
          { text: 'Tu te trompes d’arme. Free win pour lui.', deltas: { moral: -7, forme: -3, renommee: -3 } },
        ),
      },
      {
        id: 'lycan',
        label: 'Stack saignement Lycan jusqu’à l’infini',
        ifRace: ['Lycan'],
        outcomes: trio(
          { text: 'Bleed city. Il fond tour après tour.', deltas: { puissance: 5, renommee: 5, trophies: { pvp: 1 } } },
          { text: 'Bleed utile, pas décisif.', deltas: { puissance: 2 } },
          { text: 'Il cleanse. Ton kit pleure.', deltas: { moral: -6, forme: -4 } },
        ),
      },
      {
        id: 'berserk',
        label: 'Berserk : sacrifier des PV pour le style',
        ifClass: ['Berserk', 'Masochiste'],
        outcomes: trio(
          { text: 'Low life god mode. Chat en feu.', deltas: { puissance: 7, renommee: 6, forme: -5 } },
          { text: 'Style mid, résultat mid.', deltas: { puissance: 2, forme: -6 } },
          { text: 'Tu te one-shot tout seul. Peak cave.', deltas: { forme: -14, moral: -8, renommee: -3 } },
        ),
      },
    ],
  },
  {
    id: 'patch_notes',
    title: 'Patch notes',
    text: 'Nouveau patch. Ton main est nerfé. Ou buff… tu sais pas lire.',
    weight: 8,
    tags: ['social', 'train'],
    options: [
      {
        id: 'read',
        label: 'Lire les patch notes (vraiment)',
        outcomes: trio(
          { text: 'Tu adaptes ton build. Évolution.', deltas: { magie: 4, vitesse: 2, moral: 3 } },
          { text: 'Tu lis la moitié. Ça ira.', deltas: { magie: 1 } },
          { text: 'Tu lis de travers. Build encore pire.', deltas: { moral: -4, puissance: -1 } },
        ),
      },
      {
        id: 'cry',
        label: 'Plaindre dans le salon #général',
        outcomes: trio(
          { text: 'L’équilibrage te compatit. Tip reçu.', deltas: { charisme: 3, moral: 4 } },
          { text: 'Un « F » dans le chat.', deltas: { moral: 1 } },
          { text: 'On te répond « skill issue ».', deltas: { moral: -6, renommee: -2 } },
        ),
      },
      {
        id: 'reroll_mental',
        label: 'Menacer de reroll (sans le faire)',
        outcomes: trio(
          { text: 'Tu restes. Tu progress. Mature… ish.', deltas: { endurance: 3, moral: 3 } },
          { text: 'Tu menaces. Personne croit.', deltas: {} },
          { text: 'Tu reroll vraiment. Regret immédiat.', deltas: { moral: -5, renommee: -3, or: -4 } },
        ),
      },
      {
        id: 'sirene',
        label: 'Stack les sorts Sirène après le patch',
        ifRace: ['Sirène'],
        outcomes: trio(
          { text: 'Stacks monstrueux. Meta slave smart.', deltas: { magie: 6, renommee: 3 } },
          { text: 'Stacks corrects.', deltas: { magie: 2 } },
          { text: 'Tu stacks… dans le mauvais ordre.', deltas: { magie: -1, moral: -3 } },
        ),
      },
      {
        id: 'alchimiste',
        label: 'Tester le cycle de flasques Alchimiste',
        ifClass: ['Alchimiste'],
        outcomes: trio(
          { text: 'Cycle parfait. Science, bitch.', deltas: { magie: 5, endurance: 2, or: 3 } },
          { text: 'Tu mixes à peu près.', deltas: { magie: 2 } },
          { text: 'Mauvaise flasque. Poison personnel.', deltas: { forme: -8, moral: -4 } },
        ),
      },
    ],
  },
  {
    id: 'cataclysme',
    title: 'Cataclysme',
    text: 'World Boss up. Tout le serveur tape. Toi tu cherches encore le bouton.',
    weight: 7,
    tags: ['ombres', 'combat'],
    options: [
      {
        id: 'charge',
        label: 'Charge tête baissée',
        outcomes: trio(
          { text: 'Gros parse. On te cite dans le recap.', deltas: { renommee: 12, puissance: 5, forme: -10, trophies: { cataclysme: 1 } } },
          { text: 'Dégâts honnêtes. Participation validée.', deltas: { renommee: 4, or: 4, forme: -6 } },
          { text: 'Tu meurs en 2s. Contribution : ambiance.', deltas: { forme: -14, moral: -6, renommee: 1 } },
        ),
      },
      {
        id: 'safe',
        label: 'Rester safe à distance',
        outcomes: trio(
          { text: 'Safe et utile. Rare combo.', deltas: { or: 7, renommee: 3, forme: -2 } },
          { text: 'Safe. Invisible.', deltas: { or: 2 } },
          { text: 'Trop safe = 0 dégât. On t’accuse d’AFK.', deltas: { renommee: -4, moral: -3 } },
        ),
      },
      {
        id: 'photo',
        label: 'Faire un screenshot pour le flex',
        outcomes: trio(
          { text: 'Le shot est clean. Likes + ego.', deltas: { charisme: 5, renommee: 3 } },
          { text: 'Screenshot flou. Autant ne rien poster.', deltas: { charisme: 1 } },
          { text: 'Tu post ton écran de mort. Own goal.', deltas: { renommee: -5, moral: -4 } },
        ),
      },
      {
        id: 'dragonkin',
        label: 'Tank magique Dragonkin',
        ifRace: ['Dragonkin', 'Écailleux'],
        outcomes: trio(
          { text: 'ResC go brrr. Tu tiens la face.', deltas: { endurance: 5, magie: 3, renommee: 4 } },
          { text: 'Tu tiens un moment.', deltas: { endurance: 2, forme: -4 } },
          { text: 'Même ResC a des limites.', deltas: { forme: -12, moral: -4 } },
        ),
      },
      {
        id: 'guerrier',
        label: 'Frappe pénétrante Guerrier sur le boss',
        ifClass: ['Guerrier'],
        outcomes: trio(
          { text: 'Penétration divine. Gros chunk.', deltas: { puissance: 6, renommee: 5, trophies: { cataclysme: 1 } } },
          { text: 'Hit correct.', deltas: { puissance: 2, forme: -3 } },
          { text: 'Tu frappes le mauvais add.', deltas: { moral: -5, forme: -5 } },
        ),
      },
    ],
  },
  {
    id: 'entrainement',
    title: 'Entraînement',
    text: 'Salle d’entraînement. Personne ne regarde. Parfait pour un cave ambitieux.',
    weight: 9,
    tags: ['train'],
    options: [
      {
        id: 'grind',
        label: 'Grind stats jusqu’à en chialer',
        outcomes: trio(
          { text: 'Session propre. Gains réels.', deltas: { puissance: 3, endurance: 3, vitesse: 2, forme: -3, moral: 3 } },
          { text: 'Tu touches un peu à tout.', deltas: { puissance: 1, endurance: 1 } },
          { text: 'Tu cliques à côté pendant 20 min.', deltas: { forme: -4, moral: -2 } },
        ),
      },
      {
        id: 'mirror_train',
        label: 'Sparring contre le mannequin (et perdre)',
        outcomes: trio(
          { text: 'Tu bats le mannequin. Victoire… humiliante pour lui.', deltas: { puissance: 2, moral: 4, forme: -2 } },
          { text: 'Égalité contre un pieu de bois.', deltas: { moral: 1 } },
          { text: 'Le mannequin gagne. On n’en parle plus.', deltas: { moral: -6, renommee: -1 } },
        ),
      },
      {
        id: 'meta',
        label: 'Regarder un vod et dormir dessus',
        outcomes: trio(
          { text: 'Tu retiens un tech. Énorme pour un cave.', deltas: { magie: 4, vitesse: 2, moral: 2 } },
          { text: 'Tu retiens l’intro du vod.', deltas: { magie: 1 } },
          { text: 'Tu rêves que tu es bon. Réveil brutal.', deltas: { moral: -3 } },
        ),
      },
      {
        id: 'humain',
        label: 'Polyvalence Humain : un peu de tout',
        ifRace: ['Humain'],
        outcomes: trio(
          { text: 'Jack of all trades. Gains propres.', deltas: { puissance: 2, endurance: 2, magie: 2, vitesse: 2 } },
          { text: 'Un peu de tout, beaucoup de rien.', deltas: { puissance: 1, magie: 1 } },
          { text: 'Trop dispersé. Stats en vrac.', deltas: { moral: -3, forme: -2 } },
        ),
      },
      {
        id: 'demoniste',
        label: 'Optimiser le familier Demoniste',
        ifClass: ['Demoniste'],
        outcomes: trio(
          { text: 'Le familier carry. Toi tu poses.', deltas: { magie: 6, renommee: 2 } },
          { text: 'Familier ok.', deltas: { magie: 2 } },
          { text: 'Tu le mets au mauvais endroit. Free target.', deltas: { magie: -1, moral: -4, forme: -3 } },
        ),
      },
    ],
  },
  {
    id: 'loot_arme',
    title: 'Drop d’arme',
    text: 'Un drop rare. Ton inventaire tremble. Ton IQ aussi.',
    weight: 8,
    tags: ['loot'],
    options: [
      {
        id: 'equip',
        label: 'Équiper direct sans lire les stats',
        outcomes: trio(
          { text: 'Parfaitement itemisé par accident.', deltas: { puissance: 4, magie: 3, vitesse: 2 } },
          { text: 'Item ok. Pas bisou.', deltas: { puissance: 1, or: 1 } },
          { text: 'Pire item de ta vie. Tu le gardes par fierté.', deltas: { moral: -4, puissance: -1 } },
        ),
      },
      {
        id: 'sell',
        label: 'Vendre aux enchères',
        outcomes: trio(
          { text: 'Quelqu’un surpaye. Cave economy win.', deltas: { or: 18, renommee: 1 } },
          { text: 'Prix correct.', deltas: { or: 7 } },
          { text: 'Tu te fais sniper / sous-vendre.', deltas: { or: 1, moral: -3 } },
        ),
      },
      {
        id: 'ask',
        label: 'Demander « c’est bien ? » dans le chat',
        outcomes: trio(
          { text: 'Un goat te donne le biS path.', deltas: { magie: 3, charisme: 3, moral: 3 } },
          { text: 'On te dit « ça dépend ». Merci.', deltas: { charisme: 1 } },
          { text: 'On te spoil que c’est trash. Haha.', deltas: { moral: -5, renommee: -1 } },
        ),
      },
      {
        id: 'gnome_speed',
        label: 'Chercher le breakpoint VIT Gnome',
        ifRace: ['Gnome'],
        outcomes: trio(
          { text: 'Breakpoint trouvé. Speeeed.', deltas: { vitesse: 7, magie: 2 } },
          { text: 'Presque le breakpoint.', deltas: { vitesse: 2 } },
          { text: 'Tu caps la mauvaise stat. Classic.', deltas: { moral: -3, vitesse: -1 } },
        ),
      },
      {
        id: 'paladin',
        label: 'Tester la riposte Paladin avec la nouvelle arme',
        ifClass: ['Paladin'],
        outcomes: trio(
          { text: 'Ripostes sales. Reflect goated.', deltas: { endurance: 4, puissance: 3, renommee: 2 } },
          { text: 'Riposte correcte.', deltas: { endurance: 2 } },
          { text: 'Tu ripostes dans le vide.', deltas: { moral: -4, forme: -3 } },
        ),
      },
    ],
  },
];
