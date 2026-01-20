# Configuration Firebase pour Duels de Cave

Ce projet utilise Firebase pour l'authentification des utilisateurs. Suis ces étapes pour configurer Firebase.

## 1. Créer un projet Firebase

1. Va sur [Firebase Console](https://console.firebase.google.com/)
2. Clique sur "Ajouter un projet"
3. Nomme ton projet (ex: "duels-de-cave")
4. Désactive Google Analytics si tu ne veux pas de tracking (optionnel)
5. Clique sur "Créer le projet"

## 2. Ajouter une application Web

1. Dans la console Firebase, clique sur l'icône Web `</>` pour ajouter une application
2. Nomme ton application (ex: "Duels de Cave Web")
3. **NE COCHE PAS** "Configurer Firebase Hosting" (on utilise Netlify)
4. Clique sur "Enregistrer l'application"
5. Tu verras un objet de configuration avec tes clés API

## 3. Activer l'authentification par email/mot de passe

1. Dans le menu latéral, va dans "Authentication"
2. Clique sur "Commencer"
3. Onglet "Sign-in method"
4. Clique sur "Email/Password"
5. Active "Email/Password" (la première option)
6. Clique sur "Enregistrer"

## 4. Configurer les variables d'environnement

1. Copie le fichier `.env.example` en `.env`:
   ```bash
   cp .env.example .env
   ```

2. Remplis le fichier `.env` avec tes clés Firebase (obtenues à l'étape 2):
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=ton-projet.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=ton-projet
   VITE_FIREBASE_STORAGE_BUCKET=ton-projet.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcd...
   ```

## 5. Configuration Netlify (si déployé)

Si tu déploies sur Netlify, tu dois ajouter les variables d'environnement:

1. Va dans ton projet Netlify
2. Site settings > Build & deploy > Environment
3. Clique sur "Add variable"
4. Ajoute chaque variable (VITE_FIREBASE_API_KEY, etc.)

## 6. Tester localement

```bash
npm install
npm run dev
```

Visite `http://localhost:5173/auth` pour tester la page de connexion.

## 7. Domaines autorisés (Production)

Quand tu déploies, ajoute ton domaine aux domaines autorisés:

1. Firebase Console > Authentication > Settings > Authorized domains
2. Ajoute ton domaine Netlify (ex: `mon-app.netlify.app`)

## Notes importantes

- ⚠️ **Ne commit JAMAIS le fichier `.env`** dans Git (il est déjà dans .gitignore)
- Les clés Firebase côté client sont publiques, c'est normal
- La sécurité vient des règles Firebase (que tu peux configurer plus tard)
- Les utilisateurs sont stockés dans Firebase Authentication automatiquement
