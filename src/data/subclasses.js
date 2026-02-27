/**
 * Sous-classes par classe
 * Chaque classe a 2 sous-classes débloquées via le donjon Collège Kunugigaoka.
 */

import { classes } from './classes';

/** Liste des sous-classes par nom de classe (ordre: [0], [1]) */
export const SUBCLASSES_BY_CLASS = {
  'Guerrier': [
    { id: 'maitre_armes', name: "Maître d'armes", bonus: '+10% Auto', abilityLabel: 'Frappe pénétrante (CD: 3 tours)', description: 'Ignore totalement la def/resC et inflige Auto + 10% CAP.' },
    { id: 'duracier', name: 'Duracier', bonus: '+8% DEF', abilityLabel: 'Frappe pénétrante (CD: 3 tours)', description: 'Frappe la résistance la plus faible. Ignore 25% de la résistance ennemie + 1% de votre Cap. Gagne un bouclier de 15% de votre Auto.' },
  ],
  'Paladin': [
    { id: 'croise_lumineux', name: 'Croisé lumineux', bonus: '+10% CAP', abilityLabel: 'Riposte (CD: 2 tours)', description: 'Renvoie 50% des dégâts reçus + 0,8% de votre Cap. Réduit les dégâts de la prochaine attaque ennemie de 20%.' },
    { id: 'juge_implacable', name: 'Juge implacable', bonus: '+10% Auto', abilityLabel: 'Riposte (CD: 2 tours)', description: 'Renvoie 50% des dégâts reçus + 0,8% de votre Cap. Réduit de 5% la DEF ennemie (stackable).' },
  ],
  'Archer': [
    { id: 'chasseur_fantome', name: 'Chasseur Fantôme', bonus: '+10% chance de critique', abilityLabel: 'Double tir (CD: 3 tours)', description: 'Après un crit, les prochains dégâts gagnent +20% CAP. Deux tirs : 100% Auto puis 130% Auto + 20% Cap (vs RésCap).' },
    { id: 'sniper', name: 'Sniper', bonus: '+8% Auto', abilityLabel: 'Double tir (CD: 3 tours)', description: 'Deux tirs : 100% Auto puis 150% Auto + 20% Cap (vs RésCap).' },
  ],
  'Mage': [
    { id: 'arcaniste_instable', name: 'Arcaniste Instable', bonus: '+10% CAP', abilityLabel: 'Explosion arcanique (CD: 3 tours)', description: 'Inflige Auto + 80% Cap (vs RésCap). Applique débuff : +5% dégâts subis par l\'ennemi (stackable).' },
    { id: 'sorcier_neant', name: 'Sorcier du Néant', bonus: '+10% CAP', abilityLabel: 'Explosion arcanique (CD: 3 tours)', description: 'Inflige Auto + 80% Cap (vs RésCap). Brûlure du Néant : l\'ennemi inflige -10% dégâts Auto et perd 2% de ses PV actuels par tour.' },
  ],
  'Demoniste': [
    { id: 'maitre_invocateur', name: 'Maître invocateur', bonus: '+10% Auto', abilityLabel: 'Attaque du familier (Passif)', description: 'Chaque tour, familier inflige 55% Cap et ignore 55% RésCap. Chaque auto augmente ces dégâts de 1% Cap (cumulable).' },
    { id: 'pacte_sombre', name: 'Pacte Sombre', bonus: '+8% CAP', abilityLabel: 'Attaque du familier (Passif)', description: 'Chaque tour, familier inflige 45% Cap et ignore 45% RésCap. Chaque auto +0,8% Cap (cumulable) et vole 2% de la CAP ennemi.' },
  ],
  'Briseur de Sort': [
    { id: 'stratege_arcanique', name: 'Stratège Arcanique', bonus: '+8% CAP', abilityLabel: 'Égide fractale (Passif)', description: 'Après une capacité subie : bouclier 40% dégâts + 25% CAP, réduit les dégâts du prochain sort de 20%. Réduit les soins adverses de 20%. Auto + 10% CAP.' },
    { id: 'mentaliste', name: 'Mentaliste', bonus: '+10% ResC', abilityLabel: 'Égide fractale (Passif)', description: 'Après une capacité subie : bouclier 40% dégâts + 25% CAP, augmente votre DEF de 5% (stackable). Réduit les soins adverses de 20%. Auto + 10% CAP.' },
  ],
  'Masochiste': [
    { id: 'flagellant_sanglant', name: 'Flagellant Sanglant', bonus: '+10% Cap', abilityLabel: 'Purge sanglante (CD: 4 tours)', description: 'Renvoie 9% dégâts accumulés + 0,5% Cap. Soigne 15% des dégâts accumulés. Réduit votre DEF de 20% mais augmente votre Auto de 20% pour le reste du combat.' },
    { id: 'ecorche_fer', name: 'Ecorché de Fer', bonus: '+10% HP', abilityLabel: 'Purge sanglante (CD: 4 tours)', description: 'Renvoie 9% dégâts accumulés + 0,5% Cap. Soigne 15% des dégâts accumulés. Chaque Purge augmente votre DEF et ResC de 10%.' },
  ],
  'Succube': [
    { id: 'dompteuse_chair', name: 'Dompteuse de Chair', bonus: '+10% CAP', abilityLabel: 'Coup de Fouet (CD: 4 tours)', description: 'Inflige Auto + 35% CAP. La prochaine attaque adverse inflige -50% dégâts et réduit l\'Auto ennemi de 5% (stackable).' },
    { id: 'ame_tentatrice', name: 'Ame Tentatrice', bonus: '+10% chance de critique', abilityLabel: 'Coup de Fouet (CD: 4 tours)', description: 'Inflige Auto + 35% CAP. La prochaine attaque adverse inflige -50% dégâts. Cette capacité crit une fois sur deux (si le précédent n\'a pas crit, le prochain crit obligatoire).' },
  ],
  'Bastion': [
    { id: 'rempart_fer', name: 'Rempart de Fer', bonus: '+15% DEF', abilityLabel: 'Charge du Rempart (CD: 4 tours)', description: 'Début du combat : bouclier = 50% DEF. Inflige Auto + 50% CAP + 50% DEF.' },
    { id: 'mur_implacable', name: 'Mur Implacable', bonus: '+8% ResC, +8% DEF', abilityLabel: 'Charge du Rempart (CD: 4 tours)', description: 'Début du combat : bouclier = 30% DEF. Vous attaquez en premier le tour de la capacité. Inflige Auto + 50% CAP + 50% DEF.' },
  ],
  'Voleur': [
    { id: 'assassin', name: 'Assassin', bonus: '+10% Auto', abilityLabel: 'Esquive (CD: 4 tours)', description: 'Esquive la prochaine attaque. Gagne +5 VIT et +0,5% Cap en chance de critique. Prochaine attaque critique garantie.' },
    { id: 'roublard', name: 'Roublard', bonus: '+10% Auto', abilityLabel: 'Esquive (CD: 4 tours)', description: 'Esquive la prochaine attaque. Gagne +5 VIT et +0,5% Cap en critique. Vole 10% d\'une stat ennemie aléatoire (jusqu\'au prochain proc, pas stackable).' },
  ],
  'Healer': [
    { id: 'luxum', name: 'Luxum', bonus: '+10% CAP', abilityLabel: 'Soin puissant (CD: 4 tours)', description: 'Soigne 25% des PV manquants + 40% Cap. Convertit l\'overheal en bouclier.' },
    { id: 'latum', name: 'Latum', bonus: '+10% Auto', abilityLabel: 'Soin puissant (CD: 4 tours)', description: 'Inflige 25% des PV manquants en dégâts à l\'ennemi, puis soigne 25% des PV manquants + 40% Cap.' },
  ],
};

/**
 * Bonus de stats en % par sous-classe (ex. { auto: 0.10 } = +10% Auto)
 * Utilisé en combat pour modifier la base du combattant.
 */
export const SUBCLASS_STAT_BONUSES = {
  maitre_armes: { auto: 0.10 },
  duracier: { def: 0.08 },
  croise_lumineux: { cap: 0.10 },
  juge_implacable: { auto: 0.10 },
  sniper: { auto: 0.08 },
  arcaniste_instable: { cap: 0.10 },
  sorcier_neant: { cap: 0.10 },
  maitre_invocateur: { auto: 0.10 },
  pacte_sombre: { cap: 0.08 },
  stratege_arcanique: { cap: 0.08 },
  mentaliste: { rescap: 0.10 },
  dompteuse_chair: { cap: 0.10 },
  rempart_fer: { def: 0.15 },
  mur_implacable: { rescap: 0.08, def: 0.08 },
  assassin: { auto: 0.10 },
  roublard: { auto: 0.10 },
  luxum: { cap: 0.10 },
  latum: { auto: 0.10 },
  flagellant_sanglant: { cap: 0.10 },
  ecorche_fer: { hp: 0.10 },
};

/**
 * @param {string} subclassId - ID de la sous-classe
 * @returns {Object<string, number>|null} Bonus par stat (ex. { auto: 0.10 }) ou null
 */
export function getSubclassStatBonuses(subclassId) {
  return (subclassId && SUBCLASS_STAT_BONUSES[subclassId]) || null;
}

/**
 * @param {string} className - Nom de la classe (ex. 'Guerrier')
 * @returns {Array<{ id: string, name: string, bonus: string|null, abilityLabel: string, description: string }>}
 */
export function getSubclassesForClass(className) {
  return SUBCLASSES_BY_CLASS[className] || [];
}

/**
 * @param {string} subclassId - ID de la sous-classe (ex. 'maitre_armes')
 * @returns {{ id: string, name: string, className: string } | null}
 */
export function getSubclassById(subclassId) {
  if (!subclassId) return null;
  for (const [className, list] of Object.entries(SUBCLASSES_BY_CLASS)) {
    const found = list.find((s) => s.id === subclassId);
    if (found) return { ...found, className };
  }
  return null;
}

/**
 * Texte d'affichage du sort : "Sous-classe — Capacité (CD: X tours)"
 * @param {string} className - Classe du personnage
 * @param {{ id: string, name: string } | null} subclass - Sous-classe si présente
 * @returns {string}
 */
export function getAbilityDisplayLabel(className, subclass) {
  const baseAbility = classes[className]?.ability ?? '';
  if (!subclass?.name) return baseAbility;
  return `${subclass.name} — ${baseAbility}`;
}
