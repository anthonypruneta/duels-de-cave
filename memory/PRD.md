# Duels de Cave - PRD

## Problème Original
Les titres débloqués étaient liés aux personnages qui sont reset chaque week-end, causant la perte des bordures de compte (titane, cosmique, transcendance) qui dépendent du nombre de titres.

## Architecture
- Frontend: React + Vite + Tailwind
- Backend: Firebase/Firestore
- Déploiement: Push GitHub → Prod direct

## Implémentation (Janvier 2026)

### Persistance des titres et bordures de compte
- Titres sauvegardés dans `userPreferences.earnedTitles`
- Bordures de compte sauvegardées dans `userPreferences.unlockedAccountBorders`
- Restauration automatique lors de la création d'un nouveau personnage

### Fichiers modifiés
- `/app/src/data/borders.js` : checkBorderUnlocks, syncUnlockedBorders
- `/app/src/services/characterService.js` : saveCharacter, getAccountBorders

## Bordures de type "account"
- champion (1 tournoi gagné)
- titane (10 titres)
- cosmique (20 titres)
- transcendance (tous les titres)

## Backlog
- [ ] Notification visuelle à la récupération des bordures après reset
- [ ] Migration des données existantes pour les joueurs ayant déjà des titres

## P0/P1/P2
- P0: ✅ Persistance titres/bordures - DONE
- P1: Tests en production
- P2: Amélioration UX notifications
