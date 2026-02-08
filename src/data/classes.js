// Données partagées pour les classes du jeu
// Les valeurs affichées doivent correspondre à combatMechanics.js

export const classes = {
  'Guerrier': { ability: 'Frappe pénétrante (CD: 3 tours)', description: 'Frappe la résistance la plus faible. Ignore 10% de la résistance ennemie + 1% de votre Cap.', icon: '🗡️' },
  'Voleur': { ability: 'Esquive (CD: 4 tours)', description: 'Esquive la prochaine attaque. Gagne +5 VIT et +1% de votre Cap en chance de critique.', icon: '🌀' },
  'Paladin': { ability: 'Riposte (CD: 2 tours)', description: 'Renvoie 40% des dégâts reçus + 1% de votre Cap.', icon: '🛡️' },
  'Healer': { ability: 'Soin puissant (CD: 4 tours)', description: 'Soigne 15% des PV manquants + 35% de votre Cap.', icon: '✚' },
  'Archer': { ability: 'Double tir (CD: 3 tours)', description: 'Deux tirs : le premier inflige 100% de votre attaque. Le second inflige 130% de votre attaque + 25% de votre Cap (opposé à la RésCap).', icon: '🏹' },
  'Mage': { ability: 'Explosion arcanique (CD: 3 tours)', description: 'Inflige votre attaque de base + 43% de votre Cap (vs RésCap).', icon: '🔮' },
  'Demoniste': { ability: 'Attaque du familier (Passif)', description: 'Chaque tour, votre familier inflige 60% de votre Cap et ignore totalement la RésCap ennemie. Chaque auto augmente ces dégâts de 3% de Cap (cumulable).', icon: '💠' },
  'Masochiste': { ability: 'Purge sanglante (CD: 4 tours)', description: 'Renvoie 15% des dégâts accumulés + 2% de votre Cap. Se soigne de 40% des dégâts accumulés.', icon: '🩸' }
};
