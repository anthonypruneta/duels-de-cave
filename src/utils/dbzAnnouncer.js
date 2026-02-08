/**
 * Annonceur style Dragon Ball Z pour le tournoi
 */

const intros = [
  'MESDAMES ET MESSIEURS, BIENVENUE AU PLUS GRAND TOURNOI DE TOUS LES TEMPS !!!',
  'LE STADE EST EN ÉBULLITION ! LE MOMENT QUE VOUS ATTENDEZ TOUS EST ENFIN ARRIVÉ !!!',
  'QUE TOUS LES GUERRIERS SE PRÉPARENT ! LE TOURNOI LÉGENDAIRE VA COMMENCER !!!'
];

const matchIntros = [
  (p1, p2) => `ET MAINTENANT, LE MATCH QUE TOUT LE MONDE ATTEND ! ${p1} CONTRE ${p2} ! QUI VA DOMINER L'ARÈNE ?!`,
  (p1, p2) => `INCROYABLE ! ${p1} ET ${p2} ENTRENT DANS L'ARÈNE ! LA TENSION EST À SON COMBLE !!!`,
  (p1, p2) => `OH ! ${p1} FAIT FACE À ${p2} ! CE COMBAT S'ANNONCE ABSOLUMENT ÉPIQUE !!!`,
  (p1, p2) => `ATTENTION ! ${p1} DÉFIE ${p2} ! L'AIR TREMBLE SOUS LA PUISSANCE DE CES DEUX GUERRIERS !!!`,
  (p1, p2) => `LE PROCHAIN COMBAT OPPOSE ${p1} À ${p2} ! JE SENS UNE ÉNERGIE COLOSSALE !!!`
];

const victoryLines = [
  (w, l) => `C'EST TERMINÉ !!! ${w} REMPORTE UNE VICTOIRE ÉCRASANTE CONTRE ${l} !!!`,
  (w, l) => `INCROYAAABLE ! ${w} A TERRASSÉ ${l} ! QUELLE PUISSANCE !!!`,
  (w, l) => `ET C'EST FINI ! ${w} TRIOMPHE DE ${l} ! LE PUBLIC EST EN DÉLIRE !!!`,
  (w, l) => `${w} L'EMPORTE !!! ${l} S'EFFONDRE ! UN COMBAT ABSOLUMENT SENSATIONNEL !!!`,
  (w, l) => `VICTOIRE DE ${w} !!! ${l} N'A PAS PU RÉSISTER À CETTE PUISSANCE DÉVASTATRICE !!!`
];

const finaleIntros = [
  (p1, p2) => `NOUS Y VOILÀ !!! LA GRANDE FINALE !!! ${p1} CONTRE ${p2} !!! LE COMBAT ULTIME QUI VA DÉCIDER DU CHAMPION !!!`,
  (p1, p2) => `L'ARÈNE TREMBLE !!! ${p1} ET ${p2} SE FONT FACE POUR LA GRANDE FINALE !!! QUI SERA COURONNÉ CHAMPION ?!`,
  (p1, p2) => `C'EST LE MOMENT DE VÉRITÉ !!! ${p1} AFFRONTE ${p2} DANS LA FINALE LA PLUS ATTENDUE DE L'HISTOIRE !!!`
];

const resetIntros = [
  (p1, p2) => `RETOURNEMENT DE SITUATION !!! LE CHAMPION DU LOSERS BRACKET A GAGNÉ !!! UN MATCH DÉCISIF S'IMPOSE ENTRE ${p1} ET ${p2} !!!`,
  (p1, p2) => `INCROYABLE ! ON REMET ÇA !!! ${p1} ET ${p2} DOIVENT S'AFFRONTER UNE DERNIÈRE FOIS POUR LE TITRE SUPRÊME !!!`
];

const championLines = [
  (name) => `MESDAMES ET MESSIEURS... VOTRE NOUVEAU CHAMPION... ${name} !!! UNE LÉGENDE EST NÉE !!!`,
  (name) => `C'EST OFFICIEL !!! ${name} EST LE GRAND CHAMPION DU TOURNOI !!! GLOIRE ÉTERNELLE !!!`,
  (name) => `TOUT LE STADE SE LÈVE POUR ACCLAMER... ${name} !!! LE CHAMPION INCONTESTÉ !!!`
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function annonceDebutTournoi(nbParticipants) {
  return `${pick(intros)}\n\n${nbParticipants} COMBATTANTS SE SONT INSCRITS ! QUE LE MEILLEUR GAGNE !!!`;
}

export function annonceDebutMatch(p1Nom, p2Nom, bracketType, roundLabel) {
  if (bracketType === 'grand_final') return pick(finaleIntros)(p1Nom.toUpperCase(), p2Nom.toUpperCase());
  if (bracketType === 'grand_final_reset') return pick(resetIntros)(p1Nom.toUpperCase(), p2Nom.toUpperCase());

  const bracketLabel = bracketType === 'winners' ? '🏆 Winners Bracket' : '💀 Losers Bracket';
  const intro = pick(matchIntros)(p1Nom.toUpperCase(), p2Nom.toUpperCase());
  return `${bracketLabel} — ${roundLabel}\n\n${intro}`;
}

export function annonceFinMatch(winnerNom, loserNom) {
  return pick(victoryLines)(winnerNom.toUpperCase(), loserNom.toUpperCase());
}

export function annonceChampion(championNom) {
  return pick(championLines)(championNom.toUpperCase());
}
