// Données partagées pour les races et classes du jeu

export const races = {
  'Humain': { bonus: '+10 PV & +1 toutes stats', icon: '👥' },
  'Elfe': { bonus: '+1 AUTO, +1 CAP, +5 VIT, +20% crit', icon: '🧝' },
  'Orc': { bonus: 'Sous 50% PV: +20% dégâts', icon: '🪓' },
  'Nain': { bonus: '+10 PV & +4 Déf', icon: '⛏️' },
  'Dragonkin': { bonus: '+10 PV & +15 ResC', icon: '🐲' },
  'Mort-vivant': { bonus: 'Revient à 20% PV (1x)', icon: '☠️' },
  'Lycan': { bonus: 'Attaque inflige saignement +1/tour', icon: '🐺' },
  'Sylvari': { bonus: 'Regen 2% PV max/tour', icon: '🌿' }
};

export const classes = {
  'Guerrier': { ability: 'Frappe pénétrante (CD: 3 tours)', description: '+3 Auto | Frappe résistance faible & ignore 8% +2%/15Cap', icon: '🗡️' },
  'Voleur': { ability: 'Esquive (CD: 2 tours)', description: '+5 VIT | Esquive 1 coup | +15% crit/palier 15Cap | Crit x2', icon: '🌀' },
  'Paladin': { ability: 'Riposte (Chaque tour)', description: 'Renvoie 70% +12%/15Cap des dégâts reçus', icon: '🛡️' },
  'Healer': { ability: 'Soin puissant (CD: 2 tours)', description: 'Heal 15% PV manquants + (25% +5%/15Cap) × Capacité', icon: '✚' },
  'Archer': { ability: 'Tir multiple (CD: 3 tours)', description: '2 tirs à Cap15, +1 tir par palier 15Cap', icon: '🏹' },
  'Mage': { ability: 'Sort magique (CD: 3 tours)', description: 'Dégâts = Auto + (40% +5%/15Cap) × Capacité (vs ResC)', icon: '🔮' },
  'Demoniste': { ability: 'Familier (Passif)', description: 'Chaque tour: (20% +4%/15Cap) × Cap, ignore 60% ResC', icon: '💠' },
  'Masochiste': { ability: 'Renvoi dégâts (CD: 4 tours)', description: 'Renvoie (15% +3%/15Cap) des dégâts accumulés & heal 10%', icon: '🩸' }
};
