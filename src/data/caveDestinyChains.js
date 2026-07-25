/**
 * Suites d’événements Cave Destiny.
 * L’ambition ne « s’allume » (gains renforcés) qu’à la finale d’une suite
 * dont l’ambition correspond à celle du joueur.
 *
 * Ex. donjons / Forêt : sanglier → ours → sanctuaire (foret).
 */

/** @typedef {{ id: string, ambition: string, label: string, steps: string[] }} DestinyChain */

/** @type {Record<string, DestinyChain>} */
export const CAVE_DESTINY_CHAINS = {
  // ——— Donjons ———
  foret: {
    id: 'foret',
    ambition: 'donjons',
    label: 'Forêt enchantée',
    steps: ['sanglier', 'ours_bosquet', 'foret'],
  },
  tour_mage: {
    id: 'tour_mage',
    ambition: 'donjons',
    label: 'Tour du Mage',
    steps: ['rat_grimoires', 'golem_os', 'tour_mage'],
  },
  arene_red: {
    id: 'arene_red',
    ambition: 'donjons',
    label: 'Arène de Red',
    steps: ['salameche_red', 'ronflex_red', 'coop_red'],
  },
  grotte: {
    id: 'grotte',
    ambition: 'donjons',
    label: 'Grotte aux merveilles',
    steps: ['arme_commune', 'grotte_merveilles'],
  },
  extension: {
    id: 'extension',
    ambition: 'donjons',
    label: 'Extension du Territoire',
    steps: ['double_passif', 'extension'],
  },

  // ——— Tournoi ———
  couronne: {
    id: 'couronne',
    ambition: 'tournoi',
    label: 'Voie de la couronne',
    // Qualif → Anciens → porte de la finale → couronne du samedi
    steps: [
      'tournoi_qualification',
      'tournoi_anciens',
      'tournoi_qualif_finale',
      'tournoi_samedi',
    ],
  },

  // ——— Forge ———
  forge_ornn: {
    id: 'forge_ornn',
    ambition: 'forge',
    label: 'Chemin de la Forge',
    // Upgrade → Forge des Légendes → Jugement → révélation légendaire (via Ornn)
    steps: [
      'arme_upgrade_chemin',
      'forge_ornn',
      'ornn_jugement',
      'arme_legendaire_revelation',
    ],
  },

  // ——— Ombres ———
  labyrinthe: {
    id: 'labyrinthe',
    ambition: 'ombres',
    label: 'Descente du Labyrinthe',
    steps: ['encyclopedie', 'labyrinthe', 'etage_120'],
  },
  epreuves_sombres: {
    id: 'epreuves_sombres',
    ambition: 'ombres',
    label: 'Épreuves sombres',
    steps: ['miroir', 'boss_rush', 'cataclysme'],
  },
};

/** Index eventId → { chain, stepIndex, isFinale, nextEventId } */
const STEP_INDEX = (() => {
  /** @type {Record<string, { chainId: string, chain: DestinyChain, stepIndex: number, isFinale: boolean, nextEventId: string|null }>} */
  const map = {};
  for (const chain of Object.values(CAVE_DESTINY_CHAINS)) {
    chain.steps.forEach((eventId, stepIndex) => {
      // Si un event est dans plusieurs chaînes, on garde la première définition
      if (map[eventId]) return;
      map[eventId] = {
        chainId: chain.id,
        chain,
        stepIndex,
        isFinale: stepIndex === chain.steps.length - 1,
        nextEventId: stepIndex < chain.steps.length - 1 ? chain.steps[stepIndex + 1] : null,
      };
    });
  }
  return map;
})();

export function getChainStep(eventId) {
  if (!eventId) return null;
  return STEP_INDEX[eventId] || null;
}

/** L’event est-il une étape intermédiaire / finale verrouillée sans progression ? */
export function isChainLockedStep(eventId, career) {
  const info = getChainStep(eventId);
  if (!info) return false;
  if (info.stepIndex === 0) return false; // ouverture toujours dispo
  const progress = career?.chainProgress?.[info.chainId];
  // progress = index de la prochaine étape attendue
  return progress !== info.stepIndex;
}

/** Prochaine étape attendue pour une chaîne (ou null). */
export function getExpectedChainEventId(career, chainId) {
  const chain = CAVE_DESTINY_CHAINS[chainId];
  if (!chain) return null;
  const progress = career?.chainProgress?.[chainId];
  if (typeof progress !== 'number') return chain.steps[0];
  if (progress < 0 || progress >= chain.steps.length) return null;
  return chain.steps[progress];
}

/**
 * Ambition « allumée » uniquement sur une finale de suite
 * dont l’ambition correspond au choix du joueur.
 */
export function isAmbitionChainFinale(eventId, ambitionId) {
  if (!eventId || !ambitionId) return false;
  const info = getChainStep(eventId);
  if (!info || !info.isFinale) return false;
  return info.chain.ambition === ambitionId;
}

export function buildChainUiMeta(eventId) {
  const info = getChainStep(eventId);
  if (!info) return null;
  return {
    chainId: info.chainId,
    label: info.chain.label,
    step: info.stepIndex + 1,
    total: info.chain.steps.length,
    isFinale: info.isFinale,
    ambition: info.chain.ambition,
  };
}
