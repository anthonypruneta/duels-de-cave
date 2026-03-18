# Duels de Cave - PRD

## Problème Original
Application de combat RPG avec problème d'affichage mobile - les layouts multi-colonnes étaient coupées sur petits écrans.

## Architecture
- Frontend: React + Vite + Tailwind
- Backend: Firebase/Firestore  
- Déploiement: Push GitHub → Prod direct

## Implémentation (Mars 2026)

### Refactor Mobile UI Complet - HYBRIDE
Tous les composants de combat ont maintenant un layout hybride :
- **Mobile (< 1024px / lg:hidden)** : Mini-cartes compactes côte à côte + journal compact
- **Desktop (1024px+ / hidden lg:flex)** : Layout original avec `detailsPlacement` et panneaux latéraux

### Composants modifiés avec layout hybride
1. `/app/src/components/BossRush.jsx`
2. `/app/src/components/Dungeon.jsx`
3. `/app/src/components/ExtensionDungeon.jsx`
4. `/app/src/components/ForgeDungeon.jsx`
5. `/app/src/components/MageTower.jsx`
6. `/app/src/components/SubclassDungeon.jsx`
7. `/app/src/components/Training.jsx`
8. `/app/src/components/MirrorMode.jsx` (lobby + combat)
9. `/app/src/components/InfiniteLabyrinth.jsx`
10. `/app/src/components/Tournament.jsx` (utilise CombatLayout)
11. `/app/src/components/WorldBoss.jsx` (utilise CombatLayout)

### Composant partagé
- `/app/src/components/CombatLayout.jsx` : Exporte `MiniCard` pour réutilisation

### Autres modifications
- Header responsive (2 lignes sur mobile)
- Boutons radio pour récompenses Forêt
- Qualifié Legacy inclus dans simulation de tournoi

## Travail Complété - Mars 2026
- [x] Layout hybride mobile/desktop pour tous les composants de combat
- [x] Mini-cartes avec images et barres HP sur mobile
- [x] Journal de combat compact sur mobile
- [x] Desktop préservé avec detailsPlacement
- [x] Tournoi : qualifié legacy dans simulation

## Backlog (P2)
- [ ] Notification visuelle à la récupération des bordures après reset
- [ ] Migration des données existantes pour les joueurs ayant déjà des titres

## Notes Techniques
- Breakpoint mobile : `lg:hidden` (< 1024px)
- Breakpoint desktop : `hidden lg:flex` (>= 1024px)
- MiniCard exporté depuis CombatLayout pour réutilisation
- Les composants avec `detailsPlacement` ne peuvent PAS utiliser CombatLayout directement car celui-ci fixe une largeur de 340px incompatible avec les panneaux latéraux de 280px
