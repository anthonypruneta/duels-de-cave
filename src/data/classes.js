// Données partagées pour les classes du jeu
// Les valeurs affichées doivent correspondre à combatMechanics.js

export const classes = {
  'Guerrier': { ability: 'Frappe pénétrante (CD: 3 tours)', description: 'Frappe la résistance la plus faible. Ignore 10% de la résistance ennemie + 1% de votre Cap. Gagne +4 ATK.', icon: '🗡️' },
  'Voleur': { ability: 'Esquive (CD: 4 tours)', description: 'Esquive la prochaine attaque. Gagne +5 VIT et +1,2% de votre Cap en chance de critique.', icon: '🌀' },
  'Paladin': { ability: 'Riposte (CD: 2 tours)', description: 'Renvoie 40% des dégâts reçus + 1% de votre Cap.', icon: '🛡️' },
  'Healer': { ability: 'Soin puissant (CD: 4 tours)', description: 'Soigne 22% des PV manquants + 50% de votre Cap.', icon: '✚' },
  'Archer': { ability: 'Double tir (CD: 3 tours)', description: 'Deux tirs : le premier inflige 100% de votre attaque. Le second inflige 120% de votre attaque + 20% de votre Cap (opposé à la RésCap).', icon: '🏹' },
  'Mage': { ability: 'Explosion arcanique (CD: 3 tours)', description: 'Inflige votre attaque de base + 68% de votre Cap (vs RésCap).', icon: '🔮' },
  'Demoniste': { ability: 'Attaque du familier (Passif)', description: 'Chaque tour, votre familier inflige 45% de votre Cap et ignore 50% de la RésCap ennemie. Chaque auto augmente ces dégâts de 0,8% de Cap (cumulable).', icon: '💠' },
  'Masochiste': { ability: 'Purge sanglante (CD: 4 tours)', description: 'Renvoie 9% des dégâts accumulés + 0,8% de votre Cap. Se soigne de 22% des dégâts accumulés.', icon: '🩸' },
  'Briseur de Sort': { ability: 'Égide fractale (Passif)', description: 'Après avoir subi un spell, gagne un bouclier égal à 75% des dégâts reçus + 50% de votre CAP. Réduit les soins adverses de 30%.', icon: '🧱' },
  'Succube': { ability: 'Coup de Fouet (CD: 4 tours)', description: 'Inflige auto + 20% CAP. La prochaine attaque adverse inflige -40% dégâts.', icon: '💋' },
  'Bastion': { ability: 'Charge du Rempart (CD: 5 tours)', description: 'Passif: +5% DEF. Inflige auto + 20% CAP + 15% DEF.', icon: '🏰' }
};
