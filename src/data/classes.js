// Données partagées pour les classes du jeu
// Les valeurs affichées doivent correspondre à combatMechanics.js

export const classes = {
  'Guerrier': { ability: 'Frappe pénétrante (CD: 3 tours)', description: 'Frappe la résistance la plus faible. Ignore 25% de la résistance ennemie + 1% de votre Cap. Gagne +5 ATK.', icon: '🗡️' },
  'Voleur': { ability: 'Esquive (CD: 4 tours)', description: 'Esquive la prochaine attaque. Gagne +5 VIT et +1,0% de votre Cap en chance de critique.', icon: '🌀' },
  'Paladin': { ability: 'Riposte (CD: 2 tours)', description: 'Renvoie 50% des dégâts reçus + 0,8% de votre Cap.', icon: '🛡️' },
  'Healer': { ability: 'Soin puissant (CD: 4 tours)', description: 'Soigne 25% des PV manquants + 40% de votre Cap.', icon: '✚' },
  'Archer': { ability: 'Double tir (CD: 3 tours)', description: 'Deux tirs : le premier inflige 100% de votre attaque. Le second inflige 130% de votre attaque + 20% de votre Cap (opposé à la RésCap).', icon: '🏹' },
  'Mage': { ability: 'Explosion arcanique (CD: 3 tours)', description: 'Inflige votre attaque de base + 80% de votre Cap (vs RésCap).', icon: '🔮' },
  'Demoniste': { ability: 'Attaque du familier (Passif)', description: 'Chaque tour, votre familier inflige 45% de votre Cap et ignore 45% de la RésCap ennemie. Chaque auto augmente ces dégâts de 0,8% de Cap (cumulable).', icon: '💠' },
  'Masochiste': { ability: 'Purge sanglante (CD: 4 tours)', description: 'Renvoie 9% des dégâts accumulés + 0,5% de votre Cap. Se soigne de 15% des dégâts accumulés.', icon: '🩸' },
  'Briseur de Sort': { ability: 'Égide fractale (Passif)', description: 'Après avoir subi un spell, gagne un bouclier égal à 40% des dégâts reçus + 25% de votre CAP. Réduit les soins adverses de 20%. Auto + 10% CAP.', icon: '🧱' },
  'Succube': { ability: 'Coup de Fouet (CD: 4 tours)', description: 'Inflige auto + 35% CAP. La prochaine attaque adverse inflige -50% dégâts.', icon: '💋' },
  'Bastion': { ability: 'Charge du Rempart (CD: 4 tours)', description: 'Début du combat: bouclier = 30% DEF. Passif: +8% DEF. Inflige auto + 50% CAP + 50% DEF.', icon: '🏰' }
};
