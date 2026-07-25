/**
 * Vague d’événements liés — nouvelles ambitions (pvp, coop, taverne, rush)
 * + chaînes (requiresEvent / requiresFlag / followsEvent).
 */

import { trio } from './caveDestinyEventUtils';

function ev(id, title, text, rarity, tags, options, extra = {}) {
  return { id, title, text, rarity, tags, options, ...extra };
}

function opt(id, label, outcomes, extra = {}) {
  return { id, label, outcomes, ...extra };
}

export const CAVE_DESTINY_EVENTS_LINKED = [
  // ========== PVP (ambition) ==========
  ev(
    'pvp_defi_ouvert',
    'Défi PvP ouvert',
    'Un joueur vous ping. Lobby prêt. Pas de filet de sécurité.',
    'common',
    ['pvp', 'combat'],
    [
      opt('accepter', 'Accepter le duel', trio(
        { text: 'Victoire nette. Le lobby retient votre pseudo.', deltas: { auto: 3, renommee: 4, trophies: { pvp: 1 } }, unlockFlag: 'pvp_won' },
        { text: 'Match serré. Respect mutuel.', deltas: { auto: 1, forme: -3 } },
        { text: 'Défaite sèche. Le chat est cruel.', deltas: { moral: -6, forme: -5 } },
      ), { check: { auto: 1.2, spd: 0.7 } }),
      opt('observer', 'Regarder d’abord les autres duels', trio(
        { text: 'Vous lisez les styles. Avantage mental.', deltas: { cap: 2, charisme: 2 } },
        { text: 'Quelques notes utiles.', deltas: { cap: 1 } },
        { text: 'Vous perdez votre place dans la file.', deltas: { moral: -2 } },
      )),
      opt('fuir', 'Ignorer le ping', trio(
        { text: 'Repos. Vous gardez votre énergie.', deltas: { forme: 3, moral: 1 } },
        { text: 'Silence radio.', deltas: {} },
        { text: 'On vous traite de cave.', deltas: { renommee: -2, moral: -2 } },
      )),
    ]
  ),
  ev(
    'pvp_revanche',
    'Revanche PvP',
    'Le même adversaire revient. Cette fois, il a lu votre garde.',
    'uncommon',
    ['pvp', 'combat'],
    [
      opt('revanche', 'Accepter la revanche', trio(
        { text: 'Vous adaptez. Il tombe.', deltas: { auto: 4, spd: 2, renommee: 5, trophies: { pvp: 1 } } },
        { text: 'Échange long. Match nul moral.', deltas: { forme: -4, auto: 1 } },
        { text: 'Il vous lit parfaitement.', deltas: { forme: -8, moral: -5, renommee: -2 } },
      ), { check: { auto: 1.1, def: 0.6, spd: 0.8 } }),
      opt('changer', 'Changer d’arme mentale', trio(
        { text: 'Nouveau rythme. Surprise totale.', deltas: { spd: 3, cap: 2 } },
        { text: 'Léger avantage.', deltas: { spd: 1 } },
        { text: 'Vous vous embrouillez.', deltas: { moral: -4, forme: -3 } },
      )),
      opt('refuser', 'Refuser poliment', trio(
        { text: 'Respect. Votre aura monte quand même.', deltas: { charisme: 3 } },
        { text: 'Ok.', deltas: {} },
        { text: 'On vous trouve peureux.', deltas: { renommee: -3 } },
      )),
    ],
    { requiresEvent: 'pvp_defi_ouvert', followsEvent: 'pvp_defi_ouvert' }
  ),
  ev(
    'pvp_classement',
    'Classement des duels',
    'Le tableau ELO clignote. Une place juste au-dessus de vous…',
    'uncommon',
    ['pvp'],
    [
      opt('grimper', 'Viser la place du dessus', trio(
        { text: 'Vous grimpez. Le classement tremble.', deltas: { renommee: 6, auto: 2, trophies: { pvp: 1 } } },
        { text: 'Petit gain d’ELO.', deltas: { renommee: 2 } },
        { text: 'Série de défaites. Chute libre.', deltas: { renommee: -5, moral: -5 } },
      ), { check: { auto: 1, spd: 0.8, charisme: 0.4 } }),
      opt('farm', 'Farmer des adversaires plus faibles', trio(
        { text: 'Farm propre. Confiance.', deltas: { auto: 2, moral: 3, or: 3 } },
        { text: 'Quelques wins faciles.', deltas: { or: 1 } },
        { text: 'On vous accuse de smurf.', deltas: { renommee: -3, moral: -2 } },
      )),
      opt('pause', 'Fermer le classement', trio(
        { text: 'Santé mentale préservée.', deltas: { moral: 4, forme: 2 } },
        { text: 'Repos.', deltas: { moral: 1 } },
        { text: 'Vous y pensez quand même.', deltas: { moral: -2 } },
      )),
    ]
  ),
  ev(
    'pvp_mirror_style',
    'Adversaire miroir',
    'Même race. Même classe. Presque vous… en face.',
    'rare',
    ['pvp', 'ombres', 'combat'],
    [
      opt('lire', 'Lire le miroir avant de frapper', trio(
        { text: 'Vous anticipez chaque copie. Victoire clinique.', deltas: { cap: 4, auto: 3, trophies: { pvp: 1 } }, unlockFlag: 'mirror_read' },
        { text: 'Match de patience.', deltas: { cap: 2, forme: -3 } },
        { text: 'Le miroir vous dépasse.', deltas: { forme: -9, moral: -4 } },
      ), { check: { cap: 1.1, auto: 0.8 } }),
      opt('rush', 'Rush immédiat', trio(
        { text: 'Brut. Efficace. Court.', deltas: { auto: 4, renommee: 2 } },
        { text: 'Échange sanglant.', deltas: { forme: -5, auto: 1 } },
        { text: 'Vous vous faites punir.', deltas: { forme: -10, moral: -3 } },
      ), { check: { auto: 1.3 } }),
      opt('fuir', 'Quitter le lobby', trio(
        { text: 'Parfois fuir, c’est gagner.', deltas: { moral: 2 } },
        { text: 'Lobby fermé.', deltas: {} },
        { text: 'Rage quit noté.', deltas: { renommee: -4 } },
      )),
    ],
    { followsFlag: 'pvp_won' }
  ),
  ev(
    'pvp_tournoi_qualif',
    'Qualifs croisées Tournoi / PvP',
    'On murmure qu’un bon dueliste PvP a plus de chances le samedi.',
    'rare',
    ['pvp', 'tournoi'],
    [
      opt('bridge', 'Utiliser vos wins PvP comme levier', trio(
        { text: 'Le public croit en vous. Bracket favorable.', deltas: { renommee: 8, charisme: 3, trophies: { tournoi: 1 } } },
        { text: 'Petit boost de cote.', deltas: { renommee: 3 } },
        { text: 'Personne n’est convaincu.', deltas: { moral: -4, renommee: -2 } },
      ), { require: { stats: { renommee: 12 } }, check: { charisme: 1, auto: 0.7 } }),
      opt('focus_pvp', 'Rester sur le PvP pur', trio(
        { text: 'Série PvP. Votre nom monte.', deltas: { auto: 3, trophies: { pvp: 1 } } },
        { text: 'Progression correcte.', deltas: { auto: 1 } },
        { text: 'Tilt.', deltas: { moral: -6, forme: -4 } },
      )),
      opt('ignorer', 'Ignorer les rumeurs', trio(
        { text: 'Focus. Paix intérieure.', deltas: { moral: 3 } },
        { text: 'Rien.', deltas: {} },
        { text: 'FOMO.', deltas: { moral: -2 } },
      )),
    ],
    { requiresAnyEvent: ['pvp_defi_ouvert', 'tournoi_samedi'], followsEvent: 'pvp_defi_ouvert' }
  ),
  ev(
    'pvp_arme_interdite',
    'Meta PvP — arme « interdite »',
    'Tout le lobby joue la même lignée. Contre ou suivre ?',
    'uncommon',
    ['pvp', 'arme'],
    [
      opt('suivre', 'Suivre la meta', trio(
        { text: 'Vous gagnez… sans âme.', deltas: { auto: 2, renommee: 1, charisme: -2 } },
        { text: 'Wins moyens.', deltas: { auto: 1 } },
        { text: 'Tout le monde vous lit.', deltas: { forme: -6, moral: -3 } },
      )),
      opt('contre', 'Jouer le contre-meta', trio(
        { text: 'Surprise totale. Clutch après clutch.', deltas: { spd: 3, cap: 2, trophies: { pvp: 1 } } },
        { text: 'Parfois ça marche.', deltas: { spd: 1 } },
        { text: 'Vous vous faites punir.', deltas: { forme: -7, moral: -3 } },
      ), { check: { spd: 1, cap: 0.7 } }),
      opt('upgrade', 'Forcer une upgrade d’arme entre deux games', trio(
        { text: 'Le fer répond. Lobby choqué.', deltas: { forme: -4 }, weaponProgress: 'upgrade' },
        { text: 'Petite amélioration.', deltas: { forme: -2 } },
        { text: 'Vous ratez la file.', deltas: { moral: -3 } },
      )),
    ]
  ),
  ev(
    'pvp_spectateurs',
    'Spectateurs dans le lobby',
    'Des noms connus regardent. La pression monte.',
    'common',
    ['pvp', 'social'],
    [
      opt('briller', 'Jouer pour la galerie', trio(
        { text: 'Clip parfait. Renommée explosive.', deltas: { renommee: 7, charisme: 3, trophies: { pvp: 1 } } },
        { text: 'Match correct sous les yeux.', deltas: { renommee: 2 } },
        { text: 'Vous chokez.', deltas: { moral: -7, renommee: -3 } },
      ), { check: { charisme: 0.9, auto: 0.8 } }),
      opt('ignorer', 'Mettre les notifs en sourdine', trio(
        { text: 'Focus clinique.', deltas: { auto: 2, moral: 2 } },
        { text: 'Concentration moyenne.', deltas: { auto: 1 } },
        { text: 'Vous regardez quand même le chat.', deltas: { moral: -2 } },
      )),
      opt('bluffer', 'Bluffer en emoji avant le fight', trio(
        { text: 'Tilt adverse. Free win.', deltas: { charisme: 4, or: 2 } },
        { text: 'Ils rient. Puis jouent.', deltas: { charisme: 1 } },
        { text: 'Vous passez pour un clown.', deltas: { renommee: -2, moral: -2 } },
      ), { check: { charisme: 1.3 } }),
    ]
  ),
  ev(
    'pvp_serie',
    'Série de duels',
    'Trois adversaires d’affilée. Pas de pause.',
    'rare',
    ['pvp', 'combat'],
    [
      opt('enchaîner', 'Enchaîner sans respirer', trio(
        { text: '3-0. Votre doigt tremble… de joie.', deltas: { auto: 4, spd: 2, forme: -8, trophies: { pvp: 1 } }, unlockFlag: 'pvp_streak' },
        { text: '2-1. Correct.', deltas: { auto: 2, forme: -6 } },
        { text: '0-3. Humiliation.', deltas: { forme: -10, moral: -8, renommee: -3 } },
      ), { check: { auto: 1.2, def: 0.7, spd: 0.7 } }),
      opt('soigner', 'Soigner entre deux matches', trio(
        { text: 'Forme récupérée. Wins plus propres.', deltas: { forme: 6, moral: 2 } },
        { text: 'Petite pause.', deltas: { forme: 3 } },
        { text: 'Vous perdez le momentum.', deltas: { moral: -3, renommee: -1 } },
      )),
      opt('stop', 'Couper après le premier', trio(
        { text: 'Discipliné.', deltas: { moral: 3 } },
        { text: 'Ok.', deltas: {} },
        { text: 'On se moque.', deltas: { renommee: -2 } },
      )),
    ],
    { requiresFlag: 'pvp_won' }
  ),
  ev(
    'pvp_apres_serie',
    'Après la série',
    'Votre série fait le tour de la Taverne. On vous défie… ou on vous courtise.',
    'uncommon',
    ['pvp', 'taverne', 'social'],
    [
      opt('defier', 'Accepter tous les défis', trio(
        { text: 'Vous devenez le boss du soir.', deltas: { renommee: 6, auto: 2, trophies: { pvp: 1 } } },
        { text: 'Quelques wins, quelques pertes.', deltas: { forme: -4, renommee: 2 } },
        { text: 'Trop. Vous cassez.', deltas: { forme: -12, moral: -6 } },
      ), { check: { auto: 1, forme: 0.5 } }),
      opt('comptoir', 'Raconter à la Taverne', trio(
        { text: 'Pots offerts. Légende du comptoir.', deltas: { charisme: 4, or: 6, trophies: { taverne: 1 } } },
        { text: 'Quelques rires.', deltas: { charisme: 2, or: 2 } },
        { text: 'Personne n’écoute.', deltas: { moral: -3 } },
      ), { check: { charisme: 1.2 } }),
      opt('dormir', 'Aller dormir', trio(
        { text: 'Sommeil de champion.', deltas: { forme: 8, moral: 3 } },
        { text: 'Repos correcte.', deltas: { forme: 3 } },
        { text: 'Insomnie de gloire.', deltas: { forme: -2, moral: -1 } },
      )),
    ],
    { requiresFlag: 'pvp_streak', followsFlag: 'pvp_streak' }
  ),
  ev(
    'pvp_mentor_coach',
    'Coach improvisé',
    'Un ancien vainqueur commente votre replay. Douloureux… utile.',
    'common',
    ['pvp', 'social'],
    [
      opt('écouter', 'Encaisser la critique', trio(
        { text: 'Vos angles s’améliorent.', deltas: { auto: 2, def: 2, moral: -1 } },
        { text: 'Deux conseils retenus.', deltas: { auto: 1 } },
        { text: 'Vous vous braquez.', deltas: { moral: -5, charisme: -1 } },
      ), { check: { charisme: 0.6, def: 0.5 } }),
      opt('débattre', 'Débattre du meta', trio(
        { text: 'Échange brillant. Les deux gagnent.', deltas: { cap: 2, charisme: 3 } },
        { text: 'Discussion moyenne.', deltas: { charisme: 1 } },
        { text: 'Dispute stupide.', deltas: { moral: -4, renommee: -1 } },
      )),
      opt('ignorer', 'Skip le VOD review', trio(
        { text: 'Ego intact.', deltas: { moral: 2 } },
        { text: 'Rien.', deltas: {} },
        { text: 'Même erreur plus tard.', deltas: { forme: -3, moral: -2 } },
      )),
    ]
  ),

  // ========== COOP ==========
  ev(
    'coop_ping_red',
    'Ping Red — besoin d’un duo',
    '« Quelqu’un pour Red ? » Le message clignote.',
    'common',
    ['coop', 'donjons'],
    [
      opt('rejoindre', 'Rejoindre le duo', trio(
        { text: 'Synchro parfaite. Pointeau mérité.', deltas: { charisme: 3, def: 2, or: 5, trophies: { coop: 1 } }, unlockFlag: 'coop_cleared' },
        { text: 'Clear correct.', deltas: { or: 2, forme: -4 } },
        { text: 'Wipe. Votre allié ragequit.', deltas: { moral: -6, forme: -7 } },
      ), { check: { def: 0.9, charisme: 0.8, auto: 0.6 } }),
      opt('host', 'Host vous-même', trio(
        { text: 'Bon lobby. Clear propre.', deltas: { charisme: 4, renommee: 2, trophies: { coop: 1 } }, unlockFlag: 'coop_cleared' },
        { text: 'Invité moyen.', deltas: { forme: -3 } },
        { text: 'Personne ne join.', deltas: { moral: -3 } },
      ), { check: { charisme: 1.1 } }),
      opt('passer', 'Passer son tour', trio(
        { text: 'Solo grind ailleurs.', deltas: { or: 2 } },
        { text: 'Ok.', deltas: {} },
        { text: 'FOMO Red.', deltas: { moral: -2 } },
      )),
    ]
  ),
  ev(
    'coop_strategie',
    'Briefing avant Red',
    'Qui tank ? Qui burst ? Qui revive ?',
    'uncommon',
    ['coop'],
    [
      opt('tank', 'Prendre le rôle tank', trio(
        { text: 'Vous tenez. L’équipe respire.', deltas: { def: 4, charisme: 2, forme: -5 } },
        { text: 'Tank correct.', deltas: { def: 2, forme: -3 } },
        { text: 'Vous tombez en premier.', deltas: { forme: -10, moral: -3 } },
      ), { check: { def: 1.4 } }),
      opt('dps', 'Prendre le burst', trio(
        { text: 'Les cibles fondent.', deltas: { auto: 3, cap: 2 } },
        { text: 'Dégâts corrects.', deltas: { auto: 1 } },
        { text: 'Vous pull trop.', deltas: { forme: -7, moral: -2 } },
      ), { check: { auto: 1.1, cap: 0.7 } }),
      opt('soutien', 'Soutenir / appeler les timings', trio(
        { text: 'Calls parfaits.', deltas: { charisme: 4, cap: 2, trophies: { coop: 1 } } },
        { text: 'Calls moyens.', deltas: { charisme: 1 } },
        { text: 'Mauvaise call. Wipe.', deltas: { moral: -5, renommee: -1 } },
      ), { check: { charisme: 1.2, cap: 0.5 } }),
    ],
    { followsEvent: 'coop_ping_red', requiresEvent: 'coop_ping_red' }
  ),
  ev(
    'coop_ronflex',
    'Ronflex bloque le couloir',
    'Encore. Il ronfle. Votre duo soupire.',
    'common',
    ['coop', 'donjons'],
    [
      opt('soulever', 'Le soulever à deux', trio(
        { text: 'Force combinée. Passage libre.', deltas: { def: 2, charisme: 2, or: 3 } },
        { text: 'Vous passez… salement.', deltas: { forme: -4 } },
        { text: 'Il se retourne. Charge.', deltas: { forme: -9, moral: -3 } },
      ), { check: { def: 1, auto: 0.6 } }),
      opt('attendre', 'Attendre qu’il bouge', trio(
        { text: 'Patience. Il roule ailleurs.', deltas: { moral: 2, forme: 2 } },
        { text: 'Long. Ennuyeux.', deltas: { moral: -1 } },
        { text: 'Votre duo s’impatiente.', deltas: { charisme: -2, moral: -2 } },
      )),
      opt('bait', 'Bait le souffle puis esquiver', trio(
        { text: 'Esquive parfaite. Clip duo.', deltas: { spd: 3, renommee: 2 } },
        { text: 'Presque.', deltas: { spd: 1, forme: -3 } },
        { text: 'Grillés.', deltas: { forme: -8 } },
      ), { check: { spd: 1.3 } }),
    ],
    { requiresFlag: 'coop_cleared', followsFlag: 'coop_cleared' }
  ),
  ev(
    'coop_dracaufeu',
    'Dracaufeu au fond',
    'La chaleur augmente. Votre duo serre les dents.',
    'rare',
    ['coop', 'donjons', 'combat'],
    [
      opt('burst', 'Burst coordonné', trio(
        { text: 'Il tombe. Pointeau ADN.', deltas: { auto: 4, cap: 2, or: 8, trophies: { coop: 1 } }, unlockFlag: 'coop_dragon' },
        { text: 'Clear limite.', deltas: { forme: -8, or: 3 } },
        { text: 'Wipe au souffle.', deltas: { forme: -14, moral: -6 } },
      ), { check: { auto: 1.1, cap: 0.8, charisme: 0.5 } }),
      opt('tank_call', 'Tank + calls de dodge', trio(
        { text: 'Aucun souffle pris.', deltas: { def: 4, charisme: 3, forme: -5, trophies: { coop: 1 } } },
        { text: 'Quelques brûlures.', deltas: { def: 2, forme: -6 } },
        { text: 'Mauvaise call.', deltas: { forme: -12, moral: -4 } },
      ), { check: { def: 1.2, charisme: 0.9 } }),
      opt('fuite', 'Fuite stratégique', trio(
        { text: 'Vous revenez plus forts… plus tard.', deltas: { moral: 1, forme: 2 } },
        { text: 'Retreat.', deltas: {} },
        { text: 'Honneur blessé.', deltas: { renommee: -2, moral: -3 } },
      )),
    ],
    { requiresEvent: 'coop_strategie' }
  ),
  ev(
    'coop_apres_dragon',
    'Après Dracaufeu',
    'Le duo veut recommencer. Ou fêter à la Taverne.',
    'uncommon',
    ['coop', 'taverne'],
    [
      opt('encore', 'Encore une run', trio(
        { text: 'Double clear. Machines.', deltas: { def: 2, auto: 2, trophies: { coop: 1 } } },
        { text: 'Deuxième run moyenne.', deltas: { forme: -5 } },
        { text: 'Tilt duo. Fin de soirée.', deltas: { moral: -6, charisme: -2 } },
      )),
      opt('feter', 'Fêter à la Taverne', trio(
        { text: 'Tournée générale. Légende du soir.', deltas: { charisme: 5, or: -4, moral: 5, trophies: { taverne: 1 } } },
        { text: 'Un verre. Correct.', deltas: { moral: 2, or: -1 } },
        { text: 'Trop. Mal de tête.', deltas: { forme: -6, moral: -2, or: -3 } },
      ), { check: { charisme: 1 } }),
      opt('separer', 'Se séparer en bons termes', trio(
        { text: 'Ami pour les prochaines saisons.', deltas: { charisme: 3, moral: 2 } },
        { text: 'Bye.', deltas: {} },
        { text: 'Silence gênant.', deltas: { moral: -1 } },
      )),
    ],
    { requiresFlag: 'coop_dragon', followsFlag: 'coop_dragon' }
  ),
  ev(
    'coop_mauvais_duo',
    'Duo toxique',
    'Il spam « ez »… alors que vous portez.',
    'common',
    ['coop', 'social'],
    [
      opt('porter', 'Porter quand même', trio(
        { text: 'Vous carry. Il se tait.', deltas: { auto: 3, def: 2, forme: -6, trophies: { coop: 1 } } },
        { text: 'Clear amer.', deltas: { forme: -4, moral: -2 } },
        { text: 'Vous laissez tomber. Wipe.', deltas: { moral: -5, renommee: -1 } },
      ), { check: { auto: 1, def: 0.8, charisme: 0.4 } }),
      opt('mute', 'Mute et focus', trio(
        { text: 'Paix. Clear.', deltas: { moral: 3, or: 2 } },
        { text: 'Ok.', deltas: { moral: 1 } },
        { text: 'Il quit.', deltas: { moral: -3 } },
      )),
      opt('kick', 'Kick / quitter', trio(
        { text: 'Standards élevés. Respect.', deltas: { charisme: 2, renommee: 1 } },
        { text: 'Lobby refait.', deltas: {} },
        { text: 'On vous trouve trop strict.', deltas: { renommee: -2 } },
      )),
    ]
  ),
  ev(
    'coop_synergie_race',
    'Synergie de races',
    'Votre duo a la combo parfaite… ou le pire clash.',
    'uncommon',
    ['coop'],
    [
      opt('exploiter', 'Exploiter la synergie', trio(
        { text: 'Combo de rêve. Clear express.', deltas: { auto: 2, cap: 2, charisme: 2, trophies: { coop: 1 } } },
        { text: 'Ça fonctionne.', deltas: { auto: 1, cap: 1 } },
        { text: 'Clash de timings.', deltas: { forme: -6, moral: -3 } },
      ), { check: { charisme: 0.9, cap: 0.6 } }),
      opt('adapter', 'Adapter votre build mental', trio(
        { text: 'Flex parfait.', deltas: { spd: 2, def: 2 } },
        { text: 'Ajustements mineurs.', deltas: { spd: 1 } },
        { text: 'Confusion.', deltas: { moral: -3 } },
      )),
      opt('ignorer', 'Jouer comme d’habitude', trio(
        { text: 'Routine solide.', deltas: { forme: 2 } },
        { text: 'Moyen.', deltas: {} },
        { text: 'Synergie gâchée.', deltas: { moral: -2, renommee: -1 } },
      )),
    ],
    { requiresFlag: 'coop_cleared' }
  ),
  ev(
    'coop_pointeau',
    'Pointeau ADN en jeu',
    'La récompense brille. Votre duo la veut aussi.',
    'rare',
    ['coop', 'loot'],
    [
      opt('partager', 'Partager équitablement', trio(
        { text: 'Confiance. Futurs duos assurés.', deltas: { charisme: 5, or: 4, moral: 3, trophies: { coop: 1 } } },
        { text: 'Split correct.', deltas: { or: 2, charisme: 1 } },
        { text: 'Il triche sur le split.', deltas: { or: -3, moral: -5 } },
      ), { check: { charisme: 1.2 } }),
      opt('négocier', 'Négocier dur', trio(
        { text: 'Vous gardez le meilleur.', deltas: { or: 10, charisme: -1, renommee: 2 } },
        { text: 'Compromise.', deltas: { or: 4 } },
        { text: 'Duo cassé.', deltas: { charisme: -4, moral: -3 } },
      )),
      opt('offrir', 'Tout lui laisser', trio(
        { text: 'Générosité légendaire.', deltas: { charisme: 6, renommee: 3, moral: 2 } },
        { text: 'Gentil.', deltas: { charisme: 2 } },
        { text: 'On vous prend pour un cave.', deltas: { renommee: -2 } },
      )),
    ],
    { requiresAnyEvent: ['coop_dracaufeu', 'coop_ping_red'] }
  ),
  ev(
    'coop_revanche_wipe',
    'Revanche après wipe',
    'Le même étage. Les mêmes erreurs… ou pas.',
    'uncommon',
    ['coop', 'combat'],
    [
      opt('retry', 'Retry immédiat', trio(
        { text: 'Leçons retenues. Clear.', deltas: { def: 3, auto: 2, trophies: { coop: 1 } } },
        { text: 'Presque.', deltas: { forme: -6 } },
        { text: 'Même wipe.', deltas: { forme: -10, moral: -6 } },
      ), { check: { def: 1, auto: 0.8 } }),
      opt('changer', 'Changer de strat', trio(
        { text: 'Nouvelle strat. Succès.', deltas: { cap: 3, charisme: 2 } },
        { text: 'Mieux.', deltas: { cap: 1 } },
        { text: 'Pire.', deltas: { moral: -4, forme: -5 } },
      )),
      opt('abandonner', 'Abandonner la salle', trio(
        { text: 'Parfois il faut savoir partir.', deltas: { moral: 2 } },
        { text: 'Fin.', deltas: {} },
        { text: 'Regret.', deltas: { moral: -3 } },
      )),
    ],
    { followsEvent: 'coop_ping_red' }
  ),
  ev(
    'coop_hall_duo',
    'Votre duo au Hall',
    'On parle de vous deux. Ensemble.',
    'epic',
    ['coop', 'tournoi'],
    [
      opt('signer', 'Assumer le duo légendaire', trio(
        { text: 'Vos noms liés. Histoire écrite.', deltas: { renommee: 10, charisme: 4, trophies: { coop: 1 } } },
        { text: 'Petite mention.', deltas: { renommee: 3 } },
        { text: 'On oublie vite.', deltas: { moral: -2 } },
      ), { require: { minRenommee: 18 }, check: { charisme: 1, renommee: 0.8 } }),
      opt('solo', 'Revendiquer la gloire solo', trio(
        { text: 'Votre ego brille. Votre duo moins.', deltas: { renommee: 6, charisme: -3 } },
        { text: 'Mitigé.', deltas: { renommee: 2 } },
        { text: 'Backlash.', deltas: { renommee: -4, moral: -4 } },
      )),
      opt('discret', 'Rester discret', trio(
        { text: 'Mystère. Aura.', deltas: { moral: 3, charisme: 1 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Occasion manquée.', deltas: { moral: -1 } },
      )),
    ],
    { requiresFlag: 'coop_dragon' }
  ),

  // ========== TAVERNE ==========
  ev(
    'taverne_comptoir',
    'Comptoir de la Taverne',
    'Bruit, mousse, rumeurs. Le vrai hub des Duels.',
    'common',
    ['taverne', 'social'],
    [
      opt('écouter', 'Écouter les rumeurs', trio(
        { text: 'Un tip d’or. Littéralement.', deltas: { or: 8, charisme: 2, trophies: { taverne: 1 } }, unlockFlag: 'taverne_rumor' },
        { text: 'Rumeurs moyennes.', deltas: { charisme: 1, or: 2 } },
        { text: 'Intox. Vous perdez du temps.', deltas: { moral: -2, or: -2 } },
      ), { check: { charisme: 1.1 } }),
      opt('raconter', 'Raconter vos exploits', trio(
        { text: 'La salle écoute. Tournée offerte.', deltas: { renommee: 4, charisme: 3, or: 3 } },
        { text: 'Quelques rires.', deltas: { charisme: 1 } },
        { text: 'On vous coupe.', deltas: { moral: -3, renommee: -1 } },
      ), { check: { charisme: 1.2, renommee: 0.5 } }),
      opt('boire', 'Boire en silence', trio(
        { text: 'Repos étrange. Moral ok.', deltas: { moral: 3, forme: -1 } },
        { text: 'Un verre.', deltas: { moral: 1, or: -1 } },
        { text: 'Trop. La nuit est floue.', deltas: { forme: -6, moral: -2, or: -3 } },
      )),
    ]
  ),
  ev(
    'taverne_pari_secret',
    'Pari secret au fond',
    'Une cote folle sur un outsider du samedi.',
    'uncommon',
    ['taverne', 'tournoi'],
    [
      opt('miser_gros', 'Miser gros', trio(
        { text: 'L’outsider gagne. Jackpot.', deltas: { or: 24, renommee: 3, trophies: { taverne: 1 } }, unlockFlag: 'taverne_whale' },
        { text: 'Petit gain.', deltas: { or: 4 } },
        { text: 'Perte sèche.', deltas: { or: -14, moral: -5 } },
      ), { check: { charisme: 0.8 }, require: { stats: { or: 10 } } }),
      opt('miser_petit', 'Miser prudent', trio(
        { text: 'Gain propre.', deltas: { or: 8, charisme: 1 } },
        { text: 'Équilibré.', deltas: { or: 2 } },
        { text: 'Petite perte.', deltas: { or: -4 } },
      )),
      opt('refuser', 'Refuser le pari', trio(
        { text: 'Discipline.', deltas: { moral: 2 } },
        { text: 'Ok.', deltas: {} },
        { text: 'On vous trouve peureux.', deltas: { charisme: -2 } },
      )),
    ],
    { followsEvent: 'taverne_comptoir', requiresEvent: 'taverne_comptoir' }
  ),
  ev(
    'taverne_dette',
    'Une dette de mousse',
    'Vous devez une tournée… ou on vous en doit une.',
    'common',
    ['taverne'],
    [
      opt('payer', 'Payer la tournée', trio(
        { text: 'Amis pour la vie. Infos exclusives.', deltas: { charisme: 4, or: -5, trophies: { taverne: 1 } } },
        { text: 'Correct.', deltas: { charisme: 1, or: -2 } },
        { text: 'Trop cher pour ce que c’est.', deltas: { or: -6, moral: -2 } },
      )),
      opt('réclamer', 'Réclamer ce qu’on vous doit', trio(
        { text: 'On vous rembourse + intérêts.', deltas: { or: 7, charisme: 1 } },
        { text: 'Remboursement partiel.', deltas: { or: 3 } },
        { text: 'Bagoute. Embarras.', deltas: { charisme: -3, moral: -2 } },
      ), { check: { charisme: 1 } }),
      opt('oublier', 'Oublier la dette', trio(
        { text: 'Généreux. Aura douce.', deltas: { charisme: 3, moral: 2 } },
        { text: 'Ok.', deltas: {} },
        { text: 'On abuse de vous.', deltas: { or: -2, renommee: -1 } },
      )),
    ]
  ),
  ev(
    'taverne_chanson',
    'Chanson de vainqueur',
    'On vous pousse à chanter votre dernière victoire.',
    'uncommon',
    ['taverne', 'social'],
    [
      opt('chanter', 'Chanter fort', trio(
        { text: 'La Taverne reprend en chœur.', deltas: { charisme: 5, renommee: 4, trophies: { taverne: 1 } } },
        { text: 'Juste.', deltas: { charisme: 2 } },
        { text: 'Fausse note légendaire.', deltas: { renommee: -3, moral: -3 } },
      ), { check: { charisme: 1.4 } }),
      opt('réciter', 'Réciter sans chanter', trio(
        { text: 'Élégant.', deltas: { charisme: 3, cap: 1 } },
        { text: 'Correct.', deltas: { charisme: 1 } },
        { text: 'Ennuyeux.', deltas: { moral: -2 } },
      )),
      opt('fuir', 'Fuite aux toilettes', trio(
        { text: 'Survie sociale.', deltas: { moral: 1 } },
        { text: 'Ok.', deltas: {} },
        { text: 'On se moque.', deltas: { renommee: -2 } },
      )),
    ],
    { requiresFlag: 'taverne_rumor' }
  ),
  ev(
    'taverne_info_forge',
    'Rumeur : Ornn est de bonne humeur',
    'Un forgeron ivre jure que la Forge accueille les audacieux ce soir.',
    'uncommon',
    ['taverne', 'forge'],
    [
      opt('y_aller', 'Courir à la Forge', trio(
        { text: 'La rumeur était vraie. Ornn sourit… presque.', deltas: { auto: 2, def: 2, trophies: { forge: 1 } }, unlockFlag: 'forge_tip' },
        { text: 'File moyenne. Petite faveur.', deltas: { forme: -3, or: -2 } },
        { text: 'Intox. Porte close.', deltas: { moral: -4, forme: -2 } },
      )),
      opt('vendre', 'Vendre l’info', trio(
        { text: 'Quelqu’un paie cher.', deltas: { or: 12, charisme: 1, trophies: { taverne: 1 } } },
        { text: 'Petit prix.', deltas: { or: 4 } },
        { text: 'Personne n’achète.', deltas: { moral: -2 } },
      ), { check: { charisme: 1 } }),
      opt('ignorer', 'Une autre bière', trio(
        { text: 'Priorités claires.', deltas: { moral: 2, or: -1 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Occasion ratée.', deltas: { moral: -1 } },
      )),
    ],
    { requiresEvent: 'taverne_comptoir', followsEvent: 'taverne_comptoir' }
  ),
  ev(
    'taverne_apres_forge_tip',
    'Retour au comptoir après la Forge',
    'Vous ramenez la chaleur du marteau dans la mousse.',
    'rare',
    ['taverne', 'forge'],
    [
      opt('raconter', 'Raconter Ornn sans trop mentir', trio(
        { text: 'La Taverne boit vos mots.', deltas: { charisme: 4, renommee: 4, trophies: { taverne: 1 } } },
        { text: 'Histoire correcte.', deltas: { charisme: 2 } },
        { text: 'On vous traite de mytho.', deltas: { renommee: -3, moral: -2 } },
      ), { check: { charisme: 1.1 } }),
      opt('montrer', 'Montrer l’arme améliorée', trio(
        { text: 'Silence. Puis applaudissements.', deltas: { renommee: 5, auto: 1 } },
        { text: 'Quelques regards.', deltas: { renommee: 2 } },
        { text: 'Jaloux. Ambiance froide.', deltas: { moral: -3 } },
      )),
      opt('payer', 'Payer une tournée de forgerons', trio(
        { text: 'Alliés durables.', deltas: { charisme: 3, or: -6, def: 2 } },
        { text: 'Sympa.', deltas: { charisme: 1, or: -3 } },
        { text: 'Trop cher.', deltas: { or: -8, moral: -2 } },
      )),
    ],
    { requiresFlag: 'forge_tip', followsFlag: 'forge_tip' }
  ),
  ev(
    'taverne_bagarre',
    'Bagarre au comptoir',
    'Deux caves s’insultent. Ça va finir en dents cassées.',
    'common',
    ['taverne', 'combat'],
    [
      opt('séparer', 'Les séparer', trio(
        { text: 'Pacifique. Respect du tavernier.', deltas: { charisme: 4, def: 1, trophies: { taverne: 1 } } },
        { text: 'Ça calme.', deltas: { charisme: 1 } },
        { text: 'Vous prenez un coup.', deltas: { forme: -7, moral: -2 } },
      ), { check: { charisme: 1, def: 0.7 } }),
      opt('parier', 'Parier sur le vainqueur', trio(
        { text: 'Bonne cote.', deltas: { or: 9 } },
        { text: 'Petit gain.', deltas: { or: 2 } },
        { text: 'Mauvaise cote.', deltas: { or: -7 } },
      ), { check: { charisme: 0.8 } }),
      opt('rejoindre', 'Rejoindre la bagarre', trio(
        { text: 'Vous gagnez… la honte et un trophée de bar.', deltas: { auto: 2, renommee: -1, forme: -5 } },
        { text: 'Échange de gifles.', deltas: { forme: -4 } },
        { text: 'Viré dehors.', deltas: { forme: -8, renommee: -3, moral: -3 } },
      ), { check: { auto: 1.1 } }),
    ]
  ),
  ev(
    'taverne_whale_suite',
    'Les dettes du jackpot',
    'Votre gros pari a fait des jaloux. Et des créanciers imaginaires.',
    'rare',
    ['taverne'],
    [
      opt('investir', 'Réinvestir dans des lots', trio(
        { text: 'Empire du soir.', deltas: { or: 10, charisme: 2, trophies: { taverne: 1 } } },
        { text: 'Stable.', deltas: { or: 3 } },
        { text: 'Tout repart.', deltas: { or: -12, moral: -4 } },
      ), { require: { stats: { or: 15 } }, check: { charisme: 0.9 } }),
      opt('cacher', 'Cacher les gains', trio(
        { text: 'Discret. Prudent.', deltas: { moral: 2, or: 2 } },
        { text: 'Ok.', deltas: {} },
        { text: 'On fouille quand même.', deltas: { or: -5, moral: -3 } },
      )),
      opt('offrir', 'Offrir une fête', trio(
        { text: 'Légende vivante de la Taverne.', deltas: { charisme: 6, renommee: 4, or: -10, trophies: { taverne: 1 } } },
        { text: 'Bonne soirée.', deltas: { charisme: 2, or: -5 } },
        { text: 'Fête ratée.', deltas: { or: -8, moral: -3 } },
      ), { check: { charisme: 1.2 } }),
    ],
    { requiresFlag: 'taverne_whale', followsFlag: 'taverne_whale' }
  ),
  ev(
    'taverne_recrut_pvp',
    'Recruteurs PvP à la Taverne',
    '« On cherche un fourth pour duels. »',
    'uncommon',
    ['taverne', 'pvp'],
    [
      opt('signer', 'Rejoindre leur stack', trio(
        { text: 'Stack solide. Wins.', deltas: { auto: 2, charisme: 2, trophies: { pvp: 1 } } },
        { text: 'Stack moyen.', deltas: { forme: -3 } },
        { text: 'Stack toxique.', deltas: { moral: -6, charisme: -2 } },
      ), { check: { charisme: 0.8, auto: 0.7 } }),
      opt('négocier', 'Négocier votre place', trio(
        { text: 'Vous dictez les conditions.', deltas: { charisme: 4, or: 4, trophies: { taverne: 1 } } },
        { text: 'Compromise.', deltas: { charisme: 1, or: 1 } },
        { text: 'Ils passent à un autre.', deltas: { moral: -2 } },
      ), { check: { charisme: 1.3 } }),
      opt('refuser', 'Rester solo', trio(
        { text: 'Indépendance.', deltas: { moral: 2 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Occasion manquée.', deltas: { renommee: -1 } },
      )),
    ],
    { requiresAnyEvent: ['taverne_comptoir', 'pvp_defi_ouvert'] }
  ),
  ev(
    'taverne_fermeture',
    'Fermeture de la Taverne',
    'Dernière tournée. Les lumières baissent.',
    'common',
    ['taverne'],
    [
      opt('aider', 'Aider à ranger', trio(
        { text: 'Le tavernier vous doit une faveur.', deltas: { charisme: 3, or: 4, trophies: { taverne: 1 } }, unlockFlag: 'taverne_favor' },
        { text: 'Merci poli.', deltas: { charisme: 1 } },
        { text: 'Vous cassez un verre.', deltas: { or: -2, moral: -1 } },
      )),
      opt('derniere', 'Dernière tournée pour la route', trio(
        { text: 'Chaleur au cœur.', deltas: { moral: 4, forme: -2, or: -2 } },
        { text: 'Un verre.', deltas: { moral: 1, or: -1 } },
        { text: 'Trop.', deltas: { forme: -5, moral: -2 } },
      )),
      opt('partir', 'Partir tôt', trio(
        { text: 'Forme préservée.', deltas: { forme: 3 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Vous ratez une rumeur.', deltas: { moral: -1 } },
      )),
    ]
  ),

  // ========== RUSH / BOSS RUSH ==========
  ev(
    'rush_porte',
    'Porte du Boss Rush',
    'Six bosses. Une seule vie. La porte attend.',
    'uncommon',
    ['rush', 'combat', 'ombres'],
    [
      opt('entrer', 'Entrer dans le Rush', trio(
        { text: 'Vous nettoyez la moitié… puis le reste.', deltas: { auto: 3, def: 3, forme: -10, trophies: { bossRush: 1 } }, unlockFlag: 'rush_cleared' },
        { text: 'Trois bosses. Honneur.', deltas: { auto: 2, forme: -8 } },
        { text: 'Mort au premier.', deltas: { forme: -12, moral: -6 } },
      ), { check: { auto: 1.1, def: 1.0, spd: 0.6 } }),
      opt('préparer', 'Préparer potions et plan', trio(
        { text: 'Plan solide. Confiance.', deltas: { cap: 2, forme: 3, moral: 2 } },
        { text: 'Préparation ok.', deltas: { forme: 1 } },
        { text: 'Vous perdez votre créneau.', deltas: { moral: -3 } },
      )),
      opt('reporter', 'Reporter', trio(
        { text: 'Patience.', deltas: { moral: 1 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Peur visible.', deltas: { renommee: -2 } },
      )),
    ]
  ),
  ev(
    'rush_checkpoint',
    'Entre deux bosses',
    'Vous respirez. Quatre restent.',
    'uncommon',
    ['rush', 'combat'],
    [
      opt('soin', 'Soigner à fond', trio(
        { text: 'Second souffle.', deltas: { forme: 10, moral: 2 } },
        { text: 'Petit soin.', deltas: { forme: 4 } },
        { text: 'Potion avariée.', deltas: { forme: -3, moral: -2 } },
      )),
      opt('burst', 'Garder le rythme burst', trio(
        { text: 'Momentum. Les suivants tombent.', deltas: { auto: 3, spd: 2, forme: -4 } },
        { text: 'Rythme ok.', deltas: { auto: 1 } },
        { text: 'Surmenage.', deltas: { forme: -8, moral: -3 } },
      ), { check: { auto: 1, spd: 0.7 } }),
      opt('étudier', 'Étudier le prochain pattern', trio(
        { text: 'Pattern lu. Avantage.', deltas: { cap: 3, def: 1 } },
        { text: 'Quelques notes.', deltas: { cap: 1 } },
        { text: 'Info fausse.', deltas: { moral: -3, forme: -2 } },
      ), { check: { cap: 1.1 } }),
    ],
    { requiresEvent: 'rush_porte', followsEvent: 'rush_porte' }
  ),
  ev(
    'rush_dernier',
    'Dernier boss du Rush',
    'Le sixième. Vos mains tremblent.',
    'rare',
    ['rush', 'combat'],
    [
      opt('tout', 'Tout donner', trio(
        { text: 'Il tombe. Boss Rush clear.', deltas: { renommee: 10, auto: 3, def: 2, forme: -8, trophies: { bossRush: 1 } }, unlockFlag: 'rush_cleared' },
        { text: 'Presque… puis oui.', deltas: { renommee: 4, forme: -10 } },
        { text: 'Wipe final.', deltas: { forme: -14, moral: -8, renommee: -2 } },
      ), { check: { auto: 1.2, def: 1.0, spd: 0.5 } }),
      opt('prudent', 'Jouer safe', trio(
        { text: 'Lent mais sûr.', deltas: { def: 3, renommee: 5, trophies: { bossRush: 1 } }, unlockFlag: 'rush_cleared' },
        { text: 'Long fight.', deltas: { forme: -7, def: 1 } },
        { text: 'Trop safe. Timeout mental.', deltas: { moral: -5, forme: -6 } },
      ), { check: { def: 1.3 } }),
      opt('fuir', 'Abandonner au seuil', trio(
        { text: 'Vous vivez pour un autre jour.', deltas: { moral: 1, forme: 2 } },
        { text: 'Retreat.', deltas: {} },
        { text: 'Honneur en miettes.', deltas: { renommee: -4, moral: -4 } },
      )),
    ],
    { requiresEvent: 'rush_checkpoint' }
  ),
  ev(
    'rush_apres_clear',
    'Après le Boss Rush',
    'Votre corps est brisé. Votre nom, moins.',
    'uncommon',
    ['rush', 'taverne'],
    [
      opt('taverne', 'Célébrer à la Taverne', trio(
        { text: 'On crie votre clear.', deltas: { charisme: 4, renommee: 4, or: -3, trophies: { taverne: 1 } } },
        { text: 'Quelques toasts.', deltas: { charisme: 2, or: -1 } },
        { text: 'Vous vous endormez sur le bar.', deltas: { forme: -4, moral: 1 } },
      )),
      opt('repos', 'Repos absolu', trio(
        { text: 'Régénération totale.', deltas: { forme: 12, moral: 4 } },
        { text: 'Sommeil ok.', deltas: { forme: 6 } },
        { text: 'Cauchemars de bosses.', deltas: { moral: -3, forme: 2 } },
      )),
      opt('encore', 'Retenter pour un meilleur temps', trio(
        { text: 'PB. Monstre.', deltas: { spd: 3, renommee: 5, trophies: { bossRush: 1 } } },
        { text: 'Temps moyen.', deltas: { forme: -6 } },
        { text: 'Blessure. Fin.', deltas: { forme: -12, moral: -5 } },
      ), { check: { spd: 1, auto: 0.8 } }),
    ],
    { requiresFlag: 'rush_cleared', followsFlag: 'rush_cleared' }
  ),
  ev(
    'rush_entrainement_patterns',
    'Entraînement patterns bosses',
    'Mannequins réglés sur les telegraphs du Rush.',
    'common',
    ['rush', 'combat'],
    [
      opt('répéter', 'Répéter jusqu’à la nausea', trio(
        { text: 'Patterns ancrés.', deltas: { def: 3, spd: 2, forme: -4 } },
        { text: 'Progrès.', deltas: { def: 1 } },
        { text: 'Surmenage.', deltas: { forme: -8, moral: -2 } },
      ), { check: { def: 0.9, spd: 0.7 } }),
      opt('théorie', 'Étudier les guides', trio(
        { text: 'Savoir précieux.', deltas: { cap: 3, moral: 1 } },
        { text: 'Quelques tips.', deltas: { cap: 1 } },
        { text: 'Guide obsolète.', deltas: { moral: -2 } },
      ), { check: { cap: 1 } }),
      opt('sparring', 'Sparring anti-boss', trio(
        { text: 'Réflexes affûtés.', deltas: { auto: 2, forme: -3 } },
        { text: 'Ok.', deltas: { auto: 1 } },
        { text: 'Entorse.', deltas: { forme: -7 } },
      )),
    ]
  ),
  ev(
    'rush_parieur',
    'On parie sur votre Rush',
    'À la Taverne, votre cote de clear est affichée.',
    'rare',
    ['rush', 'taverne'],
    [
      opt('assumer', 'Assumer la cote et clear', trio(
        { text: 'Clear sous les yeux du public.', deltas: { renommee: 8, forme: -9, trophies: { bossRush: 1 } }, unlockFlag: 'rush_cleared' },
        { text: 'Clear discret.', deltas: { renommee: 3, forme: -7 } },
        { text: 'Wipe public.', deltas: { renommee: -5, moral: -7, forme: -10 } },
      ), { check: { auto: 1, def: 1, charisme: 0.5 } }),
      opt('tricher_cote', 'Manipuler la cote', trio(
        { text: 'Vous gagnez sur les paris… pas sur le Rush.', deltas: { or: 16, renommee: -2, trophies: { taverne: 1 } } },
        { text: 'Petit écart.', deltas: { or: 5 } },
        { text: 'On vous grillé.', deltas: { renommee: -6, or: -4, moral: -3 } },
      ), { check: { charisme: 1.2 } }),
      opt('ignorer', 'Ignorer les parieurs', trio(
        { text: 'Focus pur.', deltas: { moral: 3 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Pression quand même.', deltas: { moral: -2 } },
      )),
    ],
    { requiresAnyEvent: ['rush_porte', 'taverne_comptoir'] }
  ),
  ev(
    'rush_blessure',
    'Séquelle du Rush',
    'Une ancienne blessure se réveille avant le prochain enchaînement.',
    'common',
    ['rush'],
    [
      opt('soigner', 'Soigner correctement', trio(
        { text: 'Comme neuf.', deltas: { forme: 8, def: 1 } },
        { text: 'Mieux.', deltas: { forme: 4 } },
        { text: 'Mal soigné.', deltas: { forme: -2, moral: -2 } },
      )),
      opt('forcer', 'Forcer malgré tout', trio(
        { text: 'Rage utile… un temps.', deltas: { auto: 3, forme: -6 } },
        { text: 'Ça tient.', deltas: { forme: -3 } },
        { text: 'Vous cédez.', deltas: { forme: -10, moral: -4 } },
      ), { check: { auto: 0.8, def: 0.6 } }),
      opt('repos', 'Repos forcé', trio(
        { text: 'Long terme gagnant.', deltas: { forme: 6, moral: 2 } },
        { text: 'Ok.', deltas: { forme: 2 } },
        { text: 'Frustration.', deltas: { moral: -3 } },
      )),
    ],
    { followsEvent: 'rush_porte' }
  ),
  ev(
    'rush_lien_ombres',
    'Le Rush ouvre sur les Ombres',
    'Après six bosses, le Miroir semble… moins intimidant.',
    'epic',
    ['rush', 'ombres'],
    [
      opt('miroir', 'Enchaîner sur une épreuve sombre', trio(
        { text: 'Vous brisez quelque chose en vous… en bien.', deltas: { renommee: 6, cap: 3, spd: 2, trophies: { labyrinthe: 1 } } },
        { text: 'Épreuve tenue.', deltas: { cap: 2, forme: -5 } },
        { text: 'Trop tôt. Les ombres gagnent.', deltas: { moral: -8, forme: -8 } },
      ), { check: { spd: 0.9, cap: 0.9, def: 0.6 } }),
      opt('attendre', 'Attendre d’être prêt', trio(
        { text: 'Sagesse.', deltas: { moral: 3, forme: 3 } },
        { text: 'Ok.', deltas: {} },
        { text: 'L’élan se perd.', deltas: { moral: -2 } },
      )),
      opt('raconter', 'Raconter le Rush aux Ombres elles-mêmes', trio(
        { text: 'Les ombres écoutent. Respect étrange.', deltas: { renommee: 5, charisme: 2 } },
        { text: 'Silence.', deltas: { moral: 1 } },
        { text: 'Elles se moquent.', deltas: { moral: -4 } },
      )),
    ],
    { requiresFlag: 'rush_cleared', followsFlag: 'rush_cleared' }
  ),
  ev(
    'rush_arme_usure',
    'Arme fatiguée par le Rush',
    'Votre lame a trop mordu. Elle demande réparation… ou transcendance.',
    'rare',
    ['rush', 'arme', 'forge'],
    [
      opt('forge', 'La porter chez Ornn', trio(
        { text: 'Le Rush forge le fer.', deltas: { forme: -4 }, weaponProgress: 'upgrade', unlockFlag: 'rush_weapon' },
        { text: 'Réparation simple.', deltas: { forme: -2 } },
        { text: 'Ornn refuse les armes « pressées ».', deltas: { moral: -3 } },
      )),
      opt('forcer', 'Continuer quand même', trio(
        { text: 'Elle tient. Vous aussi.', deltas: { auto: 2, forme: -5 } },
        { text: 'Ok.', deltas: { forme: -2 } },
        { text: 'Elle se fêle. Moral aussi.', deltas: { auto: -1, moral: -4, forme: -3 } },
      )),
      opt('repo', 'Pas de Rush tant qu’elle n’est pas prête', trio(
        { text: 'Discipline d’artisan.', deltas: { moral: 3, def: 1 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Impatience.', deltas: { moral: -2 } },
      )),
    ],
    { requiresAnyEvent: ['rush_porte', 'rush_dernier'] }
  ),
  ev(
    'rush_legend_whisper',
    'Murmure légendaire post-Rush',
    'Une arme légendaire ne se révèle qu’aux survivants du sixième.',
    'legendary',
    ['rush', 'arme', 'arme_legendaire'],
    [
      opt('révéler', 'Tenter la révélation', trio(
        {
          text: 'La lame se souvient des six. Forme légendaire.',
          deltas: { renommee: 6, forme: -5 },
          weaponProgress: 'legendary',
        },
        { text: 'Presque. Elle chauffe… puis se tait.', deltas: { forme: -4, moral: 1 } },
        { text: 'Rejet violent.', deltas: { forme: -12, moral: -6 } },
      ), { require: { weaponRarities: ['rare'], stats: { auto: 26, def: 24 } }, check: { auto: 1, def: 0.9 } }),
      opt('attendre', 'Attendre un meilleur présage', trio(
        { text: 'Patience de mythe.', deltas: { moral: 3 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Le moment passe.', deltas: { moral: -2 } },
      )),
      opt('vendre_fragment', 'Vendre le fragment de murmure', trio(
        { text: 'Or sale.', deltas: { or: 18, renommee: -1 } },
        { text: 'Quelques pièces.', deltas: { or: 6 } },
        { text: 'Arnaque.', deltas: { or: -4, moral: -3 } },
      )),
    ],
    { requiresFlag: 'rush_cleared', requiresAllEvents: ['rush_porte'] }
  ),

  // ========== CHAÎNES CROISÉES / LIÉS À L’EXISTANT ==========
  ev(
    'suite_sanglier',
    'La meute du sanglier',
    'Le sanglier de la clairière avait une meute. Elle vous a trouvé.',
    'uncommon',
    ['donjons', 'combat'],
    [
      opt('bloquer', 'Bloquer la charge collective', trio(
        { text: 'Rempart vivant. La meute se brise.', deltas: { def: 4, or: 5, forme: -5 } },
        { text: 'Vous tenez… juste.', deltas: { def: 2, forme: -6 } },
        { text: 'Submergé.', deltas: { forme: -12, moral: -4 } },
      ), { check: { def: 1.5, auto: 0.4 } }),
      opt('disperser', 'Les disperser par la vitesse', trio(
        { text: 'Vous dansez entre les défenses.', deltas: { spd: 4, or: 4 } },
        { text: 'Échappée belle.', deltas: { spd: 2, forme: -3 } },
        { text: 'Crocs partout.', deltas: { forme: -9 } },
      ), { check: { spd: 1.4 } }),
      opt('fuir', 'Fuite vers la Taverne', trio(
        { text: 'Histoire à raconter… vivante.', deltas: { charisme: 2, moral: 1 } },
        { text: 'Fuite.', deltas: {} },
        { text: 'Ils vous suivent jusqu’au village.', deltas: { forme: -5, moral: -2 } },
      )),
    ],
    { requiresEvent: 'sanglier', followsEvent: 'sanglier' }
  ),
  ev(
    'suite_tournoi',
    'Lendemain de tournoi',
    'Les acclamations sont finies. Restent les dettes, les fans, les rivaux.',
    'uncommon',
    ['tournoi', 'taverne', 'social'],
    [
      opt('fans', 'Signer pour les fans', trio(
        { text: 'Renommée douce. Offrandes.', deltas: { renommee: 5, charisme: 3, or: 4 } },
        { text: 'Quelques autographes.', deltas: { renommee: 2 } },
        { text: 'File trop longue. Épuisement.', deltas: { forme: -5, moral: -2 } },
      ), { check: { charisme: 1 } }),
      opt('rival', 'Affronter un rival en PvP', trio(
        { text: 'Vous confirmez la couronne en duel.', deltas: { auto: 3, trophies: { pvp: 1 } } },
        { text: 'Match nul moral.', deltas: { forme: -4 } },
        { text: 'Le rival vous humilie.', deltas: { moral: -6, renommee: -3 } },
      ), { check: { auto: 1.1 } }),
      opt('taverne', 'Disparaître à la Taverne', trio(
        { text: 'Anonymat relatif. Paix.', deltas: { moral: 4, trophies: { taverne: 1 } } },
        { text: 'Un verre.', deltas: { moral: 1 } },
        { text: 'On vous reconnaît quand même.', deltas: { forme: -2 } },
      )),
    ],
    { requiresEvent: 'tournoi_samedi', followsEvent: 'tournoi_samedi' }
  ),
  ev(
    'suite_forge_ornn',
    'Ornn se souvient de vous',
    'Le Dieu de la Forge a noté votre passage. Une deuxième épreuve attend.',
    'rare',
    ['forge'],
    [
      opt('épreuve', 'Accepter la deuxième épreuve', trio(
        { text: 'Le marteau bénit votre bras.', deltas: { auto: 3, def: 3, trophies: { forge: 1 } }, weaponProgress: 'upgrade' },
        { text: 'Épreuve tenue.', deltas: { def: 2, forme: -6 } },
        { text: 'Brûlure. Échec.', deltas: { forme: -11, moral: -4 } },
      ), { check: { def: 1.1, auto: 0.9 } }),
      opt('offrir', 'Offrir de l’or et du respect', trio(
        { text: 'Ornn hoche… presque.', deltas: { renommee: 3, or: -8, moral: 2 } },
        { text: 'Accepté.', deltas: { or: -4 } },
        { text: 'Insuffisant.', deltas: { moral: -3, or: -4 } },
      )),
      opt('partir', 'Partir avant qu’il change d’avis', trio(
        { text: 'Sagesse.', deltas: { moral: 2 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Lâcheté perçue.', deltas: { renommee: -2 } },
      )),
    ],
    { requiresAnyEvent: ['forge_ornn', 'taverne_info_forge'], followsEvent: 'taverne_info_forge' }
  ),
  ev(
    'lien_pvp_coop',
    'Duo qui devient rival',
    'Votre ancien partenaire de Red vous défie en PvP.',
    'rare',
    ['pvp', 'coop', 'social'],
    [
      opt('duel', 'Accepter le duel amical', trio(
        { text: 'Vous gagnez. L’amitié tient.', deltas: { auto: 2, charisme: 3, trophies: { pvp: 1 } } },
        { text: 'Match serré. Respect.', deltas: { forme: -4, charisme: 1 } },
        { text: 'Défaite. Ambiance froide.', deltas: { moral: -5, charisme: -2 } },
      ), { check: { auto: 1, charisme: 0.7 } }),
      opt('duo', 'Proposer une autre run Red plutôt', trio(
        { text: 'Le duo renaît. Clear.', deltas: { charisme: 4, trophies: { coop: 1 } } },
        { text: 'Run ok.', deltas: { or: 2 } },
        { text: 'Il voulait le duel. Frustration.', deltas: { moral: -3 } },
      )),
      opt('éviter', 'Éviter le sujet', trio(
        { text: 'Paix fragile.', deltas: { moral: 1 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Relation cassée.', deltas: { charisme: -3 } },
      )),
    ],
    { requiresAllEvents: ['coop_ping_red', 'pvp_defi_ouvert'] }
  ),
  ev(
    'lien_favor_taverne',
    'Faveur du tavernier',
    'Il se souvient que vous avez rangé les verres. Il ouvre une cave secrète.',
    'epic',
    ['taverne', 'loot'],
    [
      opt('cave', 'Descendre dans la cave', trio(
        { text: 'Lots rares. Et une rumeur d’arme.', deltas: { or: 14, renommee: 3, trophies: { taverne: 1 } }, unlockFlag: 'taverne_cellar' },
        { text: 'Bon butin.', deltas: { or: 6 } },
        { text: 'Piège à rats. Honte.', deltas: { forme: -5, moral: -2 } },
      ), { check: { charisme: 0.8, spd: 0.5 } }),
      opt('info', 'Demander une info plutôt que du butin', trio(
        { text: 'Info en or : un lobby PvP faible ce soir.', deltas: { charisme: 2, renommee: 2 }, unlockFlag: 'pvp_tip' },
        { text: 'Info moyenne.', deltas: { charisme: 1 } },
        { text: 'Info périmée.', deltas: { moral: -2 } },
      )),
      opt('refuser', 'Refuser par principe', trio(
        { text: 'Honneur. Il insiste quand même… plus tard.', deltas: { moral: 3, charisme: 1 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Il est vexé.', deltas: { charisme: -2 } },
      )),
    ],
    { requiresFlag: 'taverne_favor', followsFlag: 'taverne_favor' }
  ),
  ev(
    'lien_pvp_tip',
    'Lobby faible — tip du tavernier',
    'La rumeur était bonne. Des adversaires… généreux.',
    'uncommon',
    ['pvp', 'taverne'],
    [
      opt('farm', 'Farm éthique… presque', trio(
        { text: 'Wins faciles. ELO + or.', deltas: { auto: 2, or: 6, trophies: { pvp: 1 } } },
        { text: 'Quelques wins.', deltas: { or: 2 } },
        { text: 'Trap lobby. Vous êtes le farm.', deltas: { forme: -8, moral: -4 } },
      ), { check: { auto: 0.9 } }),
      opt('prévenir', 'Prévenir les victimes', trio(
        { text: 'Honneur. Ils vous doivent une.', deltas: { charisme: 4, renommee: 2 } },
        { text: 'Poli.', deltas: { charisme: 1 } },
        { text: 'On se moque de votre naïveté.', deltas: { renommee: -2 } },
      )),
      opt('ignorer', 'Ignorer le tip', trio(
        { text: 'Intégrité.', deltas: { moral: 2 } },
        { text: 'Ok.', deltas: {} },
        { text: 'FOMO.', deltas: { moral: -2 } },
      )),
    ],
    { requiresFlag: 'pvp_tip', followsFlag: 'pvp_tip' }
  ),
  ev(
    'lien_college_apres',
    'Devoirs du Collège',
    'Koro Sensei exige un rapport sur vos combats récents.',
    'uncommon',
    ['donjons', 'subclass'],
    [
      opt('rédiger', 'Rédiger un vrai rapport', trio(
        { text: 'Mention bien. Capacité affûtée.', deltas: { cap: 4, charisme: 1 } },
        { text: 'Passable.', deltas: { cap: 1 } },
        { text: 'Rendu en retard.', deltas: { moral: -3, renommee: -1 } },
      ), { check: { cap: 1.1, charisme: 0.4 } }),
      opt('bluff', 'Bluffer avec style', trio(
        { text: 'Il rit. Vous passez.', deltas: { charisme: 3, cap: 1 } },
        { text: 'Limite.', deltas: { charisme: 1 } },
        { text: 'Il voit tout.', deltas: { moral: -5, cap: -1 } },
      ), { check: { charisme: 1.3 } }),
      opt('fuir', 'Sécher le cours', trio(
        { text: 'Liberté.', deltas: { moral: 2, spd: 1 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Sanction.', deltas: { renommee: -2, moral: -2 } },
      )),
    ],
    { requiresEvent: 'college_sous_classe', followsEvent: 'college_sous_classe' }
  ),
  ev(
    'lien_cataclysme_apres',
    'Cendres du Cataclysme',
    'Le monde respire encore. Les cendres collent à votre cape.',
    'rare',
    ['ombres', 'cataclysme', 'taverne'],
    [
      opt('témoigner', 'Témoigner à la Taverne', trio(
        { text: 'On croit aux sauveurs ce soir.', deltas: { renommee: 6, charisme: 3, trophies: { taverne: 1 } } },
        { text: 'Écoute polie.', deltas: { renommee: 2 } },
        { text: 'On vous traite d’exagéré.', deltas: { moral: -3 } },
      ), { check: { charisme: 1 } }),
      opt('entraîner', 'Entraîner d’autres caves', trio(
        { text: 'La relève s’améliore. Vous aussi.', deltas: { charisme: 3, auto: 2, def: 1 } },
        { text: 'Cours moyen.', deltas: { charisme: 1 } },
        { text: 'Ils ne comprennent rien.', deltas: { moral: -3 } },
      )),
      opt('silence', 'Garder le silence', trio(
        { text: 'Mystère. Poids.', deltas: { moral: 2, renommee: 1 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Les cauchemars restent.', deltas: { moral: -4 } },
      )),
    ],
    { requiresAnyEvent: ['cataclysme'], followsEvent: 'cataclysme' }
  ),
  ev(
    'lien_labyrinthe_carte',
    'Carte volée du Labyrinthe',
    'Quelqu’un à la Taverne vend une carte « infaillible ».',
    'uncommon',
    ['ombres', 'taverne', 'labyrinthe'],
    [
      opt('acheter', 'Acheter la carte', trio(
        { text: 'Elle ment moins que d’habitude.', deltas: { spd: 2, or: -6, renommee: 1 }, unlockFlag: 'laby_map' },
        { text: 'Utile à moitié.', deltas: { or: -4, spd: 1 } },
        { text: 'Arnaque totale.', deltas: { or: -8, moral: -3 } },
      )),
      opt('voler', 'Voler la carte', trio(
        { text: 'Silencieux. Efficace.', deltas: { spd: 3, renommee: -2 }, unlockFlag: 'laby_map' },
        { text: 'Presque grillé.', deltas: { spd: 1, forme: -2 } },
        { text: 'Pris la main dans le sac.', deltas: { renommee: -5, moral: -3 } },
      ), { check: { spd: 1.3 } }),
      opt('refuser', 'Refuser', trio(
        { text: 'Intuition > papier.', deltas: { moral: 2 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Vous vous perdez plus tard.', deltas: { moral: -1 } },
      )),
    ],
    { requiresAnyEvent: ['taverne_comptoir', 'labyrinthe'] }
  ),
  ev(
    'lien_laby_map_usage',
    'Dans le Labyrinthe avec la carte',
    'Le papier brûle presque. Les murs bougent quand même.',
    'rare',
    ['ombres', 'labyrinthe'],
    [
      opt('suivre', 'Suivre la carte à la lettre', trio(
        { text: 'Raccourci réel. Record.', deltas: { spd: 4, renommee: 5, or: 6, trophies: { labyrinthe: 1 } } },
        { text: 'Progression.', deltas: { spd: 2, forme: -4 } },
        { text: 'Cul-de-sac maudit.', deltas: { forme: -9, moral: -4 } },
      ), { check: { spd: 1, cap: 0.7 } }),
      opt('contredire', 'Contredire la carte', trio(
        { text: 'Votre instinct bat le papier.', deltas: { cap: 3, spd: 2 } },
        { text: 'Mitigé.', deltas: { cap: 1 } },
        { text: 'Vous auriez dû suivre.', deltas: { forme: -7, moral: -3 } },
      ), { check: { cap: 1.1 } }),
      opt('brûler', 'Brûler la carte', trio(
        { text: 'Liberté. Peur.', deltas: { moral: 2, spd: 1 } },
        { text: 'Cendres.', deltas: {} },
        { text: 'Les murs se vengent.', deltas: { forme: -6 } },
      )),
    ],
    { requiresFlag: 'laby_map', followsFlag: 'laby_map' }
  ),
  ev(
    'lien_encyclopedie_pvp',
    'Fiche PvP dans l’Encyclopédie',
    'Quelqu’un a écrit une page sur votre style. Flatteur… ou dangereux.',
    'uncommon',
    ['pvp', 'ombres'],
    [
      opt('corriger', 'Corriger les erreurs', trio(
        { text: 'Votre mythe reste flou. Bien.', deltas: { charisme: 2, renommee: 2 } },
        { text: 'Quelques edits.', deltas: { charisme: 1 } },
        { text: 'Vous en rajoutez trop. Cringe.', deltas: { renommee: -2, moral: -2 } },
      )),
      opt('laisser', 'Laisser la fiche', trio(
        { text: 'Les adversaires se trompent. Free wins.', deltas: { auto: 2, trophies: { pvp: 1 } } },
        { text: 'Neutre.', deltas: {} },
        { text: 'Ils s’adaptent grâce à la page.', deltas: { forme: -5, moral: -2 } },
      )),
      opt('détruire', 'Détruire la page', trio(
        { text: 'Secret préservé.', deltas: { moral: 2, spd: 1 } },
        { text: 'Ok.', deltas: {} },
        { text: 'Scandale mineur.', deltas: { renommee: -3 } },
      )),
    ],
    { requiresAnyEvent: ['encyclopedie', 'pvp_defi_ouvert'], followsEvent: 'encyclopedie' }
  ),
  ev(
    'lien_favor_rush',
    'Le tavernier parie sur votre Rush',
    'Sa faveur vous ouvre un créneau VIP devant la porte des six.',
    'rare',
    ['taverne', 'rush'],
    [
      opt('entrer', 'Entrer en VIP', trio(
        { text: 'Clear sous contrat moral.', deltas: { renommee: 7, forme: -9, trophies: { bossRush: 1 } }, unlockFlag: 'rush_cleared' },
        { text: 'Clear limite.', deltas: { forme: -8, renommee: 2 } },
        { text: 'Wipe VIP. Honte double.', deltas: { forme: -12, moral: -7, renommee: -3 } },
      ), { check: { auto: 1.1, def: 1.0 } }),
      opt('céder', 'Céder le créneau à un ami', trio(
        { text: 'Générosité. Il vous doit une run coop.', deltas: { charisme: 4, moral: 2 } },
        { text: 'Gentil.', deltas: { charisme: 1 } },
        { text: 'Il fail. On vous blâme.', deltas: { renommee: -2, moral: -2 } },
      )),
      opt('vendre', 'Vendre le créneau', trio(
        { text: 'Or facile.', deltas: { or: 14, trophies: { taverne: 1 } } },
        { text: 'Petit prix.', deltas: { or: 5 } },
        { text: 'Le tavernier le prend mal.', deltas: { charisme: -3, or: 3 } },
      )),
    ],
    { requiresAllEvents: ['taverne_fermeture'], requiresFlag: 'taverne_favor' }
  ),
];
