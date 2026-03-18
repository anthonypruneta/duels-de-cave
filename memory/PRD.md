# Duels de Cave - PRD

## Problème Original
Application de combat RPG avec problème d'affichage mobile - les layouts multi-colonnes étaient coupées sur petits écrans.

## Architecture
- Frontend: React + Vite + Tailwind
- Backend: Firebase/Firestore  
- Déploiement: Push GitHub → Prod direct

## Implémentation (Mars 2026)

### Refactor Mobile UI Complet
- Création du composant partagé `CombatLayout.jsx` pour standardiser l'affichage combat
- Application aux 9 zones de combat : InfiniteLabyrinth, Dungeon, BossRush, MageTower, SubclassDungeon, ExtensionDungeon, ForgeDungeon, MirrorMode, Training
- Adaptation du header responsive (2 lignes sur mobile)
- Adaptation du lobby Mirror Mode pour mobile
- Adaptation du Cataclysme (World Boss) pour mobile
- **Adaptation du Tournoi (samedi, legacy, simulation) pour mobile**

### Fichiers modifiés
- `/app/src/components/CombatLayout.jsx` : Composant partagé responsive
- `/app/src/components/WorldBoss.jsx` : Layout mobile pour pré-combat et combat
- `/app/src/components/Header.jsx` : Navigation responsive
- `/app/src/components/MirrorMode.jsx` : Lobby + combat mobile
- `/app/src/components/ForestDungeon.jsx` : Boutons radio + layout inline mobile
- `/app/src/components/Tournament.jsx` : Combat UI refactorisé avec CombatLayout
- Tous les composants de combat : Intègrent CombatLayout

## Implémentation Précédente (Janvier 2026)

### Persistance des titres et bordures de compte
- Titres sauvegardés dans `userPreferences.earnedTitles`
- Bordures de compte sauvegardées dans `userPreferences.unlockedAccountBorders`

## Travail Complété - Mars 2026
- [x] Boutons radio pour récompenses Forêt
- [x] Interface combat mobile responsive (9 zones)
- [x] Images personnages/boss sur mobile
- [x] Header responsive 2 lignes
- [x] Lobby Mirror Mode mobile
- [x] Cataclysme (World Boss) mobile - pré-combat + combat via CombatLayout
- [x] Tournoi du Samedi, Legacy et Simulation - combat via CombatLayout

## Backlog (P2)
- [ ] Refactoriser ForestDungeon.jsx pour utiliser CombatLayout (amélioration maintenabilité)
- [ ] Notification visuelle à la récupération des bordures après reset
- [ ] Migration des données existantes pour les joueurs ayant déjà des titres

## Notes Techniques
- Breakpoint mobile : `lg:hidden` (< 1024px)
- Breakpoint desktop : `hidden lg:flex` (>= 1024px)
- MiniCard dans CombatLayout supporte images avec HP bar superposée
- Tournament.jsx gère 3 modes via query params : normal, `?mode=simulation`, `?mode=legacy`
