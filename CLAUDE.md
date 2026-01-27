# Notes pour Claude

## Workflow de développement

- **NE JAMAIS mentionner localhost** - On ne teste pas en local
- Travailler directement sur GitHub : commit et push, puis l'utilisateur vérifie sur GitHub/production
- Pas besoin de démarrer le serveur de dev (`npm run dev`)
- Toutes les modifications sont validées en production via Firebase Hosting

---

## Vue d'ensemble du projet

**Duels de Cave** est un jeu de combat RPG tour par tour construit avec React et Firebase. Les joueurs créent des personnages avec des races et classes aléatoires, puis s'affrontent dans des combats simulés.

### Stack technique

| Catégorie | Technologies |
|-----------|--------------|
| Frontend | React 18.2.0, Vite 5.0.8, React Router 6.20.0 |
| Styling | Tailwind CSS 3.3.6, PostCSS |
| Backend | Firebase 12.8.0 (Firestore, Auth, Storage) |
| Langue | Français (UI et code) |

---

## Structure du codebase

```
src/
├── Application.jsx          # Routeur principal de l'app
├── main.jsx                 # Point d'entrée React
├── index.css                # Styles globaux Tailwind
├── components/
│   ├── Auth.jsx             # Formulaires login/signup
│   ├── CharacterCreation.jsx # Création de personnage (2 étapes)
│   ├── Combat.jsx           # Arène de combat et simulation
│   ├── Admin.jsx            # Panel admin (images, gestion)
│   ├── Header.jsx           # Navigation
│   └── ProtectedRoute.jsx   # Guard d'authentification
├── contexts/
│   └── AuthContext.jsx      # État global d'authentification
├── services/
│   └── characterService.js  # Opérations Firestore/Storage
├── firebase/
│   └── config.js            # Configuration Firebase
├── data/
│   └── gameData.js          # Constantes (races, classes, stats)
├── utils/
│   └── combatSimulation.js  # Tests d'équilibrage combat
└── assets/
    ├── characters/          # Images personnages
    ├── backgrounds/         # Fonds de combat
    └── music/               # Musiques de combat
```

---

## Base de données (Firestore)

### Collection: `characters`

Chaque document est identifié par `userId`:

```javascript
{
  name: string,              // Nom (3-20 caractères)
  gender: 'male' | 'female',
  keyword: string,           // Mot-clé pour génération Midjourney
  race: string,              // Une des 8 races
  class: string,             // Une des 8 classes
  userId: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  characterImage: string,    // URL Firebase Storage
  base: {                    // Stats de base
    hp: number,              // 120-200 points de vie
    auto: number,            // 15-35 attaque
    def: number,             // 15-35 défense
    cap: number,             // 15-35 capacité magique
    rescap: number,          // 15-35 résistance magique
    spd: number              // 15-35 vitesse
  },
  bonuses: {
    race: { hp, auto, def, cap, rescap, spd },
    class: { hp, auto, def, cap, rescap, spd }
  }
}
```

### Règles Firestore (`firestore.rules`)

- **Lecture**: Utilisateur (son personnage) + Admin
- **Écriture**: Utilisateur (son propre document uniquement)
- **Suppression**: Admin seulement
- **Email admin**: `antho.pruneta@gmail.com`

---

## Authentification

- Firebase Auth avec email/mot de passe
- `AuthContext.jsx` fournit l'état global via React Context
- Routes protégées redirigent vers `/auth`
- Mot de passe minimum: 6 caractères

### Méthodes disponibles via `useAuth()`

```javascript
{
  currentUser,              // Objet utilisateur Firebase
  signup(email, password),  // Créer un compte
  login(email, password),   // Connexion
  logout(),                 // Déconnexion
  loading                   // État de chargement
}
```

---

## Mécanique de jeu

### Création de personnage (2 étapes)

1. **Roll**: Race, classe et stats générés aléatoirement
2. **Personnalisation**: Nom, genre, mot-clé Midjourney

**Limite**: 1 personnage par semaine (reset lundi minuit)

### Génération des stats

- Stats de base: 120 PV, 15 pour les autres
- 35 points distribués aléatoirement
- 30% de chance de "spike" (+5 à +10 sur une stat)

### Les 8 races

| Race | Icône | Bonus |
|------|-------|-------|
| Humain | 👥 | +10 PV, +1 toutes stats |
| Elfe | 🧝 | +1 Auto, +1 Cap, +5 Vitesse, +20% crit |
| Orc | 🪓 | +20% dégâts sous 50% PV |
| Nain | ⛏️ | +10 PV, +4 Défense |
| Dragonkin | 🐲 | +10 PV, +15 Résistance Cap |
| Mort-vivant | ☠️ | Résurrection à 20% PV (1x/combat) |
| Lycan | 🐺 | Saignement cumulatif (+1/tour) |
| Sylvari | 🌿 | Régénère 2% PV max/tour |

### Les 8 classes

| Classe | Icône | Capacité | Cooldown |
|--------|-------|----------|----------|
| Guerrier | 🗡️ | Frappe pénétrante | 3 tours |
| Voleur | 🌀 | Esquive | 4 tours |
| Paladin | 🛡️ | Riposte | 2 tours |
| Healer | ✚ | Soin puissant | 5 tours |
| Archer | 🏹 | Tir multiple | 3 tours |
| Mage | 🔮 | Sort magique | 3 tours |
| Demoniste | 💠 | Familier (passif) | - |
| Masochiste | 🩸 | Retour de dégâts | 4 tours |

### Système de combat

- Tours basés sur la vitesse (plus rapide attaque en premier)
- Crit de base: 10% (+ bonus Elfe/Voleur)
- Dégâts physiques: `Auto - 0.5 × Défense`
- Dégâts magiques: `Cap - 0.5 × ResC`
- Multiplicateur crit: 1.5x
- Maximum 30 tours par combat

---

## Fonctionnalités Admin

**Route**: `/admin` (accès restreint par email)

### Capacités

1. **Gestion des personnages**
   - Voir tous les personnages créés
   - Supprimer des personnages
   - Afficher stats et infos

2. **Upload d'images**
   - Upload fichier image
   - Application automatique bordure décorative
   - Compression JPEG (qualité 0.85)
   - Sauvegarde vers Firebase Storage

3. **Génération prompts Midjourney**
   - Prompts détaillés style HD-2D Octopath Traveler
   - Descriptions par race et classe
   - Intégration du mot-clé thématique
   - Copier-coller facile

---

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `Application.jsx` | Configuration des routes |
| `AuthContext.jsx` | État et méthodes d'auth |
| `CharacterCreation.jsx` | UI création personnage |
| `Combat.jsx` | Arène et simulation combat |
| `Admin.jsx` | Panel admin complet |
| `characterService.js` | CRUD Firestore + Storage |
| `firebase/config.js` | Init Firebase + networking |
| `gameData.js` | Constantes races/classes |

---

## Conventions de code

### Nommage

- **Variables/fonctions**: camelCase, noms français
- **Composants**: PascalCase
- **Handlers**: préfixe `handle` (ex: `handleSubmit`)

### Patterns utilisés

- Composants fonctionnels avec hooks
- Context API pour l'état global (auth)
- Service layer pour Firebase (`characterService.js`)
- Try-catch avec messages d'erreur user-friendly
- Classes Tailwind pour le styling (thème sombre: stone, amber)

### Gestion des erreurs

- Retry avec backoff exponentiel pour Firestore
- Messages d'erreur en français
- Console logging pour debug
- Vérification codes erreur Firestore

---

## Routes de l'application

| Route | Composant | Protection | Description |
|-------|-----------|------------|-------------|
| `/` | CharacterCreation | Oui | Création/affichage personnage |
| `/auth` | Auth | Non | Login/Signup |
| `/combat` | Combat | Oui | Arène de combat |
| `/admin` | Admin | Oui + Email | Panel administration |

---

## Configuration Firebase

- **Project ID**: `duelsdecave`
- **Storage bucket**: `duelsdecave.firebasestorage.app`
- Long-polling activé (résilience réseau)
- Cache mémoire uniquement (pas de persistence offline)
- Timeout Firestore: 30 secondes

---

## Scripts NPM

```bash
npm run build    # Build production Vite
npm run preview  # Preview production locale
npm run dev      # Serveur dev (pas utilisé)
```

---

## Notes importantes

1. **Langue**: Tout est en français (UI, variables, commentaires)
2. **Thème**: Dark mode avec palette stone/amber
3. **Icônes**: Emojis utilisés comme icônes
4. **Images**: Bordure appliquée via Canvas API dans Admin
5. **1 personnage/user**: Chaque utilisateur ne peut avoir qu'un seul personnage actif
