# Instructions pour les agents IA

Ce fichier est lu par les assistants IA qui modifient le projet. Merci d’en tenir compte.

## Équilibrage du jeu (balance) et Firestore

Les constantes d’équilibrage (races, classes, armes, passifs, bosses) sont aussi stockées dans Firestore. Au démarrage, si la **version du code** est supérieure à celle en Firestore, le code est appliqué et synchronisé vers Firestore.

**Règle importante :** après toute modification des données d’équilibrage dans le code, **incrémenter `BALANCE_CONFIG_VERSION`** dans `src/services/balanceConfigService.js`.

- Fichiers concernés : `src/data/combatMechanics.js`, `src/data/races.js`, `src/data/classes.js`, `src/data/weapons.js`, `src/data/mageTowerPassives.js`, et les données de bosses.
- Exemple : `export const BALANCE_CONFIG_VERSION = 1;` → passer à `2` après une modif d’équilibrage.

Sans cela, les changements dans le code seront ignorés au profit de l’ancienne config Firestore.

## Prose joueur (Cave Destiny / UI)

- **Interdit** : le tiret cadratin `—` (et demi-cadratin `–`) dans les textes visibles (événements, outcomes, récits, UI).
- **Interdit** : phrases de 1–2 mots (« Plans trouvés. », « Miracle. », « Victoire nette. »). Toujours sujet + verbe.
- **Retours à la ligne** : après chaque phrase dans les `text:` / outcomes (`\n` dans la string) ; l’UI utilise `whitespace-pre-line`.
- Préférer points, virgules, ou deux-points. Pas de slogans hachés.

## Préparation combattant (`preparerCombattant`)

- **Affichage** (cartes, PV, état synchronisé avec le moteur) : `preparerCombattant(donnéesBrutes)` depuis `src/utils/tournamentCombat.js`.
- **Simulation** : `simulerMatch(brut1, brut2)` — ne jamais y passer le retour de `preparerCombattant` (double application forêt / arme / passifs).
- **Nouveaux champs** de combat côté moteur : les ajouter dans `preparerCombattant` et, si besoin entre deux salles, dans `resetTransientCombatFieldsBetweenFights` — pas une copie locale dans un composant.
