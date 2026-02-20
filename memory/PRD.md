# Duels de Cave - PRD

## Description du projet
**Duels de Cave** est un jeu de combat au tour par tour basé sur React/Vite avec Firebase comme backend. Les joueurs créent des personnages avec différentes races et classes, les font combattre dans des donjons, des tournois et des événements spéciaux comme le "Cataclysme" (World Boss).

## Stack technique
- **Frontend**: React 18, Vite, TailwindCSS
- **Backend**: Firebase (Firestore, Auth)
- **Intégrations**: Discord Webhooks pour les annonces

## Fonctionnalités principales

### 1. Création de personnage
- Choix de race et classe
- Système de reroll basé sur les récompenses (tournoi, cataclysme)
- Éveil racial à haut niveau

### 2. Modes de jeu
- **Donjon cave** : Combats PvE classiques
- **Forêt** : Donjon avec boosts de stats
- **Tour du Mage** : Passifs à débloquer
- **Tournoi** : PvP hebdomadaire
- **Cataclysme** : World Boss coopératif

### 3. Système de Cataclysme (World Boss)
- Boss commun avec 35 000 HP
- 2 tentatives par jour par joueur
- Récompenses (3 rerolls) pour tous les participants
- Auto-launch lundi 18h, auto-end samedi 12h
- **NOUVEAU**: Boss peut être un ancien champion du Hall of Fame avec ses vraies stats

### 4. Hall of Fame
- Archive des champions de tournoi
- Affichage des cartes de personnage complètes
- Champions peuvent apparaître comme boss du Cataclysme

## Fonctionnalité implémentée - Session actuelle

### Champion aléatoire comme Boss du Cataclysme
**Date**: 19 février 2026

**Implémentation**:
1. `worldBossService.js` : Nouvelle fonction exportée `pickWeeklyBossWithChampions(genericBossNames)` qui:
   - Prend la liste des noms de boss génériques en paramètre
   - Récupère la liste des champions du Hall of Fame depuis Firestore
   - Combine les deux pools (génériques + champions)
   - Sélectionne un boss de manière déterministe basée sur la semaine (seed = samedi midi)

2. `worldBossService.js` : Fonction `launchCataclysm()` modifiée pour:
   - Accepter soit un string (ancien format) soit un objet `{name, isChampion, championData}`
   - Si c'est un champion, charger ses vraies stats depuis `archivedCharacters`
   - Appliquer les stats du champion (auto, cap, def, rescap, spd) avec HP fixe à 35k

3. `worldBossService.js` : Fonction `checkAutoLaunch()` modifiée pour:
   - Utiliser `pickWeeklyBossWithChampions()` lors du lancement automatique (lundi 18h)
   - Les champions sont maintenant dans le pool de boss possibles pour l'auto-launch

4. `WorldBoss.jsx` et `WorldBossAdmin.jsx` : 
   - Utilisent la fonction centralisée du service
   - Passent la liste `GENERIC_BOSS_NAMES` extraite des images

**Fichiers modifiés**:
- `/app/src/services/worldBossService.js`
- `/app/src/components/WorldBoss.jsx`
- `/app/src/components/WorldBossAdmin.jsx`

## Schéma de données (Firestore)

### Collections principales
- `characters`: Personnages actifs
- `archivedCharacters`: Personnages archivés après chaque semaine
- `hallOfFame`: Champions de tournoi
- `worldBossEvent`: État du Cataclysme actuel
- `worldBossEvent/current/damages`: Dégâts par participant
- `tournamentRewards`: Récompenses (rerolls) par joueur

### Structure worldBossEvent
```json
{
  "bossId": "champion_xxx" | "cataclysme",
  "bossName": "Nom du boss",
  "bossStats": { "hp": 35000, "auto": X, "cap": X, ... },
  "isChampionBoss": true/false,
  "championName": "Nom du champion" | null,
  "originalChampion": { "odUserId": "...", "race": "...", ... } | null,
  "status": "actif" | "inactif" | "termine",
  "hpMax": 35000,
  "hpRemaining": X,
  "totalDamageDealt": X,
  "totalAttempts": X,
  "startedAt": Timestamp,
  "endedAt": Timestamp | null
}
```

## Backlog

### P0 - Critique
- ✅ Correction erreur lint WorldBossAdmin.jsx
- ✅ Implémentation "Champion aléatoire comme Boss"
- ✅ Auto-launch lundi 18h inclut les champions dans le pool

### P1 - Important
- ✅ Refactoring: `pickWeeklyBossWithChampions` centralisée dans le service
- [ ] Créer composant `UnifiedCharacterCard` réutilisable

### P2 - Nice to have
- [ ] Images personnalisées pour les champions-boss (dossier ChampBoss/) - 1 image déjà présente
- [ ] Afficher visuellement si le boss actuel est un champion ou non dans l'UI joueur
