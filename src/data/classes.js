// Données partagées pour les classes du jeu
// Les valeurs affichées dans l’encyclopédie viennent de buildClassDescription (combatMechanics).
// Ce fichier sert de repli (ability, icône) : les pourcentages ci-dessous sont alignés sur classConstants.

export const classes = {
  'Guerrier': { ability: 'Frappe pénétrante (CD: 3 tours)', description: 'Frappe la résistance la plus faible. Ignore 30% de la résistance ennemie + 1% de votre Cap. Gagne +7 Auto.', icon: '🗡️' },
  'Voleur': { ability: 'Esquive (CD: 4 tours)', description: 'Esquive la prochaine attaque. Gagne +5 VIT et +0,4% de votre Cap en chance de critique.', icon: '🌀' },
  'Paladin': { ability: 'Riposte (CD: 2 tours)', description: 'Renvoie 45% des dégâts reçus + 0,6% de votre Cap.', icon: '🛡️' },
  'Healer': { ability: 'Soin puissant (CD: 4 tours)', description: 'Soigne 28% des PV manquants + 43% de votre Cap.', icon: '✚' },
  'Archer': { ability: 'Double tir (CD: 3 tours)', description: 'Deux tirs : le premier inflige 100% de votre attaque. Le second inflige 130% de votre attaque + 20% de votre Cap.', icon: '🏹' },
  'Mage': { ability: 'Explosion arcanique (CD: 3 tours)', description: 'Inflige votre attaque de base + 90% de votre Cap.', icon: '🔮' },
  'Demoniste': { ability: 'Attaque du familier (Passif)', description: 'Chaque tour, votre familier inflige 45% de votre Cap et ignore 45% de la RésCap ennemie. Chaque auto augmente ces dégâts de 0,8% de Cap (cumulable).', icon: '💠' },
  'Masochiste': { ability: 'Purge sanglante (CD: 4 tours)', description: 'Renvoie 6% des dégâts accumulés + 0,5% de votre Cap. Se soigne de 10% des dégâts accumulés.', icon: '🩸' },
  'Briseur de Sort': { ability: 'Égide fractale (Passif)', description: 'Après avoir subi une capacité, gagne un bouclier égal à 50% des dégâts reçus + 30% de votre CAP. Réduit les soins adverses de 20%. Auto + 15% CAP.', icon: '🧱' },
  'Succube': { ability: 'Coup de Fouet (CD: 4 tours)', description: 'Inflige auto + 45% CAP. La prochaine attaque adverse inflige -50% dégâts.', icon: '💋' },
  'Bastion': { ability: 'Charge du Rempart (CD: 4 tours)', description: 'Début du combat: bouclier = 30% DEF. Passif: +8% DEF. Inflige auto + 50% CAP + 50% DEF.', icon: '🏰' },
  'Alchimiste': { ability: 'Cycle de flasques (Passif)', description: 'Cycle de 3 flasques :\n- Feu : Auto + 10% CAP\n- Vie : soin 82% de votre CAP\n- Acide : Auto + réduit DEF 10% / ResC 10%', icon: '🧪' },
  'Sorcière': { ability: 'Malédiction (CD: 4 tours)', description: 'Malédiction : −10% d\'une stat adverse au hasard (cumul sur la valeur courante). Dégâts : Auto + 80% CAP + points de stats retirés à l\'ennemi (toutes sources).', icon: '🕯️' },
  'Berserk': { ability: 'Rage (CD: 4 tours)', description: 'Consomme 10% de vos PV max (ne peut pas vous tuer). Inflige votre Auto + 35% des PV manquants (après ce coût).', icon: '🪓' }
};
