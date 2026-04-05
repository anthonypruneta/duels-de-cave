/**
 * Sous-classes par classe
 * L’encyclopédie et les écrans détaillés utilisent buildSubclassDescription() (constantes live).
 * Les textes ci-dessous sont alignés sur combatMechanics.subclassConstants + merge classe de base.
 */

import { classes } from './classes';

/** Liste des sous-classes par nom de classe (ordre: [0], [1]) */
export const SUBCLASSES_BY_CLASS = {
  'Guerrier': [
    { id: 'maitre_armes', name: "Maître d'armes", bonus: '+10% Auto', abilityLabel: 'Frappe pénétrante (CD: 3 tours)', description: 'Ignore totalement la def/resC et inflige Auto + 10% CAP.' },
    { id: 'duracier', name: 'Duracier', bonus: '+10% DEF', abilityLabel: 'Frappe pénétrante (CD: 3 tours)', description: 'Frappe la résistance la plus faible. Ignore 30% de la résistance ennemie + 1% de votre Cap. Gagne un bouclier de 25% Auto + 0,8% CAP.' },
  ],
  'Paladin': [
    { id: 'croise_lumineux', name: 'Croisé lumineux', bonus: '+10% CAP', abilityLabel: 'Riposte (CD: 2 tours)', description: 'Renvoie 45% des dégâts reçus + 0,6% de votre Cap. Réduit les dégâts de la prochaine attaque ennemie de 30%.' },
    { id: 'juge_implacable', name: 'Juge implacable', bonus: '+7% Auto', abilityLabel: 'Riposte (CD: 2 tours)', description: 'Renvoie 45% des dégâts reçus + 0,6% de votre Cap. Réduit la DEF ennemie de 3,0% (stackable).' },
  ],
  'Archer': [
    { id: 'chasseur_fantome', name: 'Chasseur Fantôme', bonus: '+10% chance de critique', abilityLabel: 'Double tir (CD: 3 tours)', description: 'Après un crit, les prochains dégâts gagnent +40% CAP. Deux tirs : 100% Auto puis 130% Auto + 20% Cap.' },
    { id: 'sniper', name: 'Sniper', bonus: '+8% Auto', abilityLabel: 'Double tir (CD: 3 tours)', description: 'Deux tirs : 100% Auto puis 140% Auto + 20% Cap.' },
  ],
  'Mage': [
    { id: 'arcaniste_instable', name: 'Arcaniste Instable', bonus: '+10% CAP', abilityLabel: 'Explosion arcanique (CD: 3 tours)', description: 'Inflige Auto + 100% Cap. Applique débuff : +6% dégâts subis par l\'ennemi (stackable).' },
    { id: 'sorcier_neant', name: 'Sorcier du Néant', bonus: '+10% CAP', abilityLabel: 'Explosion arcanique (CD: 3 tours)', description: 'Inflige Auto + 93% Cap. Brûlure du Néant : l\'ennemi inflige -8% dégâts Auto et perd 1,5% de ses PV actuels par tour.' },
  ],
  'Demoniste': [
    { id: 'maitre_invocateur', name: 'Maître invocateur', bonus: '+10% Auto', abilityLabel: 'Attaque du familier (Passif)', description: 'Chaque tour, familier inflige 50% Cap et ignore 50% RésCap. Chaque auto augmente ces dégâts de 0,8% Cap (cumulable).' },
    { id: 'pacte_sombre', name: 'Pacte Sombre', bonus: '+10% CAP', abilityLabel: 'Attaque du familier (Passif)', description: 'Chaque tour, familier inflige 50% Cap et ignore 45% RésCap. Chaque auto +0,8% Cap (cumulable) et vole 6% de la CAP ennemi.' },
  ],
  'Briseur de Sort': [
    { id: 'stratege_arcanique', name: 'Stratège Arcanique', bonus: '+10% CAP', abilityLabel: 'Égide fractale (Passif)', description: 'Après une capacité subie : bouclier 50% dégâts + 30% CAP. Réduction des dégâts du prochain sort de 33% (un sort sur deux : pas de cumul tant que la réduction n\'a pas été consommée). Réduit les soins adverses de 20%. Auto + 15% CAP.' },
    { id: 'mentaliste', name: 'Mentaliste', bonus: '+12% ResC', abilityLabel: 'Égide fractale (Passif)', description: 'Après une capacité subie : bouclier 50% dégâts + 30% CAP, augmente votre DEF de 8% (stackable). Réduit les soins adverses de 20%. Auto + 15% CAP.' },
  ],
  'Masochiste': [
    { id: 'flagellant_sanglant', name: 'Flagellant Sanglant', bonus: '+10% Cap', abilityLabel: 'Purge sanglante (CD: 4 tours)', description: 'Renvoie 7% dégâts accumulés + 0,5% Cap. Soigne 12% des dégâts accumulés. Réduit votre DEF de 20% mais augmente votre Auto de 13% pour le reste du combat.' },
    { id: 'ecorche_fer', name: 'Ecorché de Fer', bonus: '+7% HP', abilityLabel: 'Purge sanglante (CD: 4 tours)', description: 'Renvoie 7% dégâts accumulés + 0,5% Cap. Soigne 12% des dégâts accumulés. Chaque Purge augmente votre DEF et ResC de 3,5%.' },
  ],
  'Succube': [
    { id: 'dompteuse_chair', name: 'Dompteuse de Chair', bonus: '+12% CAP', abilityLabel: 'Coup de Fouet (CD: 4 tours)', description: 'Inflige Auto + 48% CAP. La prochaine attaque adverse inflige -50% dégâts et réduit l\'Auto ennemi de 11% (stackable).' },
    { id: 'ame_tentatrice', name: 'Ame Tentatrice', bonus: '+10% chance de critique', abilityLabel: 'Coup de Fouet (CD: 4 tours)', description: 'Inflige Auto + 47% CAP. La prochaine attaque adverse inflige -50% dégâts. Cette capacité crit une fois sur deux (si le précédent n\'a pas crit, le prochain crit obligatoire).' },
  ],
  'Bastion': [
    { id: 'rempart_fer', name: 'Rempart de Fer', bonus: '+12% DEF', abilityLabel: 'Charge du Rempart (CD: 4 tours)', description: 'Passif classe Bastion : +8% DEF. Début du combat : bouclier = 55% DEF. Inflige Auto + 50% CAP + 50% DEF.' },
    { id: 'mur_implacable', name: 'Mur Implacable', bonus: '+8% ResC, +8% DEF', abilityLabel: 'Charge du Rempart (CD: 4 tours)', description: 'Passif classe Bastion : +8% DEF. Début du combat : bouclier = 35% DEF. Vous attaquez en premier le tour de la capacité. Inflige Auto + 55% CAP + 55% DEF.' },
  ],
  'Voleur': [
    { id: 'assassin', name: 'Assassin', bonus: '+10% Auto', abilityLabel: 'Esquive (CD: 4 tours)', description: 'Esquive la prochaine attaque. Gagne +5 VIT et +0,4% Cap en chance de critique. Prochaine attaque critique garantie.' },
    { id: 'roublard', name: 'Roublard', bonus: '+10% Auto', abilityLabel: 'Esquive (CD: 4 tours)', description: 'Esquive la prochaine attaque. Gagne +5 VIT et +0,4% Cap en critique. Vole 6% d\'une stat ennemie aléatoire (jusqu\'au prochain proc, pas stackable).' },
  ],
  'Healer': [
    { id: 'luxum', name: 'Luxum', bonus: '+10% CAP', abilityLabel: 'Soin puissant (CD: 4 tours)', description: 'Soigne 30% des PV manquants + 45% Cap. À chaque lancement : gain d\'un bouclier égal à 28% de votre CAP. Convertit l\'overheal en bouclier.' },
    { id: 'latum', name: 'Latum', bonus: '+8% Auto', abilityLabel: 'Soin puissant (CD: 4 tours)', description: 'Inflige 18% des PV manquants en dégâts à l\'ennemi, puis soigne 30% des PV manquants + 45% Cap.' },
  ],
  'Alchimiste': [
    { id: 'maitre_alchimiste', name: 'Maître Alchimiste', bonus: '+10% CAP', abilityLabel: 'Cycle de flasques (Passif)', description: 'Cycle complet (1 flasque par tour, en boucle) : Feu → Vie → Acide → Feu…\n- Feu : Auto + 30% CAP\n- Vie : soigne 108% de votre Cap\n- Acide : Auto et réduit DEF/ResC de 25%' },
    { id: 'alchimiste_metal', name: 'Alchimiste de Métal', bonus: '+10% Auto', abilityLabel: 'Cycle de flasques (Passif)', description: 'Cycle complet (1 flasque par tour, en boucle) : Feu → Vie → Acide → Métal → Feu…\n- Feu : Auto + 10% CAP\n- Vie : soigne 82% de votre Cap\n- Acide : Auto et réduit DEF/ResC de 10%\n- Métal : Auto et étourdit 1 tour' },
  ],
  'Sorcière': [
    { id: 'hexe_noire', name: 'Hexe Noire', bonus: '+5% VIT, +5% Auto, +5% CAP', abilityLabel: 'Malédiction (CD: 3 tours)', description: 'Début de combat : Malédiction −5% d\'une stat adverse au hasard (permanent). Malédiction (CD 3) : −5% d\'une stat adverse au hasard (cumul sur la valeur courante). Total dégâts : Auto + 70% CAP + points de stats retirés (toutes sources).' },
    { id: 'enchanteresse', name: 'Enchanteresse', bonus: '+10% CAP', abilityLabel: 'Malédiction (CD: 4 tours)', description: 'Malédiction : −15% d\'une stat adverse au hasard (cumul sur la valeur courante). Total dégâts : Auto + 100% CAP + points de stats retirés (toutes sources).' },
  ],
  'Berserk': [
    { id: 'boucher', name: 'Boucher', bonus: '+20% HP', abilityLabel: 'Rage (CD: 4 tours)', description: 'Consomme 10% PV max (ne peut pas mourir). Inflige Auto + 44% des PV manquants (après le coût).' },
    { id: 'brise_caves', name: 'Brise-Caves', bonus: '+10% Auto', abilityLabel: 'Rage (CD: 4 tours)', description: 'Consomme 10% PV max (ne peut pas mourir). Inflige Auto + 35% des PV manquants (après le coût). La prochaine auto inflige +20% de dégâts.' },
  ],
};

/**
 * @param {string} subclassId - ID de la sous-classe
 * @returns {Object<string, number>|null} Bonus par stat (ex. { auto: 0.10 }) ou null
 */
export const SUBCLASS_STAT_BONUSES = {
  maitre_armes: { auto: 0.10 },
  duracier: { def: 0.10 },
  croise_lumineux: { cap: 0.10 },
  juge_implacable: { auto: 0.07 },
  sniper: { auto: 0.08 },
  arcaniste_instable: { cap: 0.10 },
  sorcier_neant: { cap: 0.10 },
  maitre_invocateur: { auto: 0.10 },
  pacte_sombre: { cap: 0.10 },
  stratege_arcanique: { cap: 0.10 },
  mentaliste: { rescap: 0.12 },
  dompteuse_chair: { cap: 0.12 },
  rempart_fer: { def: 0.12 },
  mur_implacable: { rescap: 0.08, def: 0.08 },
  assassin: { auto: 0.10 },
  roublard: { auto: 0.10 },
  luxum: { cap: 0.10 },
  latum: { auto: 0.08 },
  flagellant_sanglant: { cap: 0.10 },
  ecorche_fer: { hp: 0.07 },
  maitre_alchimiste: { cap: 0.10 },
  alchimiste_metal: { auto: 0.05 },
  hexe_noire: { spd: 0.05, auto: 0.05, cap: 0.05 },
  enchanteresse: { cap: 0.10 },
  boucher: { hp: 0.20 },
  brise_caves: { auto: 0.10 },
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
