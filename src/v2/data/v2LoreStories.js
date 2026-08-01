/**
 * Quête lore V2 — une seule histoire : Rencontre avec Orc-en-ciel.
 * Arbre 3 étapes × 3 choix avec merges pour limiter les fins.
 */

export const V2_LORE_STORY_ID = 'orc_en_ciel_rencontre';

/**
 * Structure :
 * - nodes[id] = { text, choices: [{ id, label, next }] }
 * - endings[id] = { text, boosts, pathLabel }
 */
export const V2_LORE_STORY = {
  id: V2_LORE_STORY_ID,
  title: 'Rencontre avec Orc-en-ciel',
  startNodeId: 'e1',
  nodes: {
    e1: {
      text: 'Au détour d’un couloir de la Cave, tu croises Orc-en-ciel — arc-en-ciel de muscles et de mauvaise humeur. Il te fixe, impatient.',
      choices: [
        { id: 'ami', label: 'Devenir pote — lui proposer une bière à la Taverne', next: 'e2_ami' },
        { id: 'atk', label: 'L’attaquer — tester sa fureur orc', next: 'e2_atk' },
        { id: 'fou', label: 'S’en foutre — continuer son chemin', next: 'e2_fou' },
      ],
    },
    e2_ami: {
      text: 'Orc-en-ciel éclate de rire. « Enfin quelqu’un de civilisé ! » Il te challenge à un bras de fer amical… ou à une confidence de guerre.',
      choices: [
        { id: 'bras', label: 'Accepter le bras de fer', next: 'end_force' },
        { id: 'conf', label: 'Écouter sa confidence', next: 'end_pacte' },
        { id: 'fuir_gentil', label: 'Filer avant que ça dégénère', next: 'end_neutre' },
      ],
    },
    e2_atk: {
      text: 'Tu charges. Orc-en-ciel pare du pouce et sourit. « Bien. Montre-moi si tu as du sang dans les veines. »',
      choices: [
        { id: 'rage', label: 'Enchaîner dans la fureur', next: 'end_force' },
        { id: 'feinte', label: 'Feinter et viser un point faible', next: 'end_ruse' },
        { id: 'stop', label: 'S’arrêter — c’était pour rire', next: 'end_pacte' },
      ],
    },
    e2_fou: {
      text: 'Tu passes. Derrière toi, Orc-en-ciel grogne : « Hé ! Les lâches meurent seuls dans la Cave… » Puis, plus bas : « …sauf s’ils apprennent à observer. »',
      choices: [
        { id: 'retour', label: 'Revenir lui parler quand même', next: 'end_pacte' },
        { id: 'observer', label: 'Observer de loin sa technique', next: 'end_ruse' },
        { id: 'ignorer', label: 'L’ignorer totalement', next: 'end_neutre' },
      ],
    },
  },
  endings: {
    end_force: {
      text: 'Orc-en-ciel te cogne l’épaule. « T’as du cran. Garde ça pour le tournoi. » Une braise de force s’ancre en toi.',
      pathLabel: 'Voie de la force',
      boosts: { auto: 2 },
    },
    end_pacte: {
      text: 'Il partage un secret de sang orc. Tu repars avec un pacte discret — endurance et magie mêlées.',
      pathLabel: 'Voie du pacte',
      boosts: { def: 1, cap: 1 },
    },
    end_ruse: {
      text: 'Tu as vu comment il bascule son poids. Plus vif, plus rusé — les caves te sembleront moins lentes.',
      pathLabel: 'Voie de la ruse',
      boosts: { spd: 2 },
    },
    end_neutre: {
      text: 'Rien de spectaculaire. Pourtant, marcher dans la Cave sans se faire remarquer, ça compte aussi.',
      pathLabel: 'Voie du détachement',
      boosts: { hp: 6, rescap: 1 },
    },
  },
};

export function getLoreNode(nodeId) {
  return V2_LORE_STORY.nodes[nodeId] || null;
}

export function getLoreEnding(endingId) {
  return V2_LORE_STORY.endings[endingId] || null;
}

export function isLoreEndingId(id) {
  return Boolean(V2_LORE_STORY.endings[id]);
}

/** Date calendaire locale YYYY-MM-DD. */
export function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
