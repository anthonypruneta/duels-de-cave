# 🚀 Déploiement automatique sur Firebase Hosting

Votre projet est maintenant configuré pour se déployer **automatiquement** sur Firebase Hosting à chaque push sur GitHub !

## 📋 Ce qui a été configuré

✅ `firebase.json` - Configuration Firebase Hosting
✅ `.firebaserc` - Lien avec votre projet Firebase
✅ `.github/workflows/firebase-hosting-merge.yml` - Déploiement automatique
✅ `.github/workflows/firebase-hosting-pull-request.yml` - Prévisualisation des PR

---

## 🔐 Étape 1 : Créer un compte de service Firebase

1. Allez sur https://console.firebase.google.com/
2. Sélectionnez votre projet **"duelsdecave"**
3. Cliquez sur l'icône ⚙️ (engrenage) → **Paramètres du projet**
4. Allez dans l'onglet **Comptes de service**
5. Cliquez sur **Générer une nouvelle clé privée**
6. Un fichier JSON sera téléchargé - **GARDEZ-LE CONFIDENTIEL !**

---

## 🔑 Étape 2 : Configurer les secrets GitHub

### 2.1 Accéder aux secrets GitHub

1. Allez sur : https://github.com/anthonypruneta/duels-de-cave/settings/secrets/actions
2. Cliquez sur **New repository secret**

### 2.2 Ajouter le compte de service

**Secret : FIREBASE_SERVICE_ACCOUNT_DUELSDECAVE**
- **Name** : `FIREBASE_SERVICE_ACCOUNT_DUELSDECAVE`
- **Value** : Copiez-collez **TOUT LE CONTENU** du fichier JSON téléchargé (étape 1)
- Cliquez sur **Add secret**

### 2.3 Ajouter les variables d'environnement Firebase

Ajoutez **chacune** de ces 6 variables (cliquez sur "New repository secret" pour chacune) :

| Name | Value |
|------|-------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyDyACCebAZj107gG6iZJgtBjbI89dctfKM` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `duelsdecave.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `duelsdecave` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `duelsdecave.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `866732384684` |
| `VITE_FIREBASE_APP_ID` | `1:866732384684:web:fdf687dc8c319fc45d9a09` |

---

## 🔥 Étape 3 : Activer Firebase Hosting

1. Allez sur https://console.firebase.google.com/
2. Sélectionnez **"duelsdecave"**
3. Menu gauche → **Hosting**
4. Cliquez sur **Get started** / **Commencer**
5. Vous pouvez ignorer les commandes CLI et cliquer sur **Suivant** → **Terminer**

---

## 🎯 Étape 4 : Déployer !

Une fois que vous avez configuré :
- ✅ Le compte de service Firebase (étape 1)
- ✅ Les 7 secrets GitHub (étape 2)
- ✅ Firebase Hosting activé (étape 3)

### Merger votre branche et déployer

```bash
# Aller sur la branche principale
git checkout main

# Merger votre branche de développement
git merge claude/web-game-display-azxWN

# Pousser sur GitHub
git push origin main
```

🎉 **GitHub Actions va automatiquement build et déployer votre site !**

---

## 🌐 URLs de votre site

Une fois déployé, votre site sera accessible sur :
- 🔗 **URL principale** : https://duelsdecave.web.app
- 🔗 **URL alternative** : https://duelsdecave.firebaseapp.com

---

## ✨ Avantages de Firebase Hosting

| Avantage | Description |
|----------|-------------|
| ✅ **Gratuit** | 10 GB de bande passante/mois |
| ✅ **Builds illimités** | Pas de limite comme Netlify ! |
| ✅ **CDN mondial** | Ultra-rapide partout dans le monde |
| ✅ **SSL automatique** | HTTPS inclus gratuitement |
| ✅ **Prévisualisations** | URL de prévisualisation sur les Pull Requests |
| ✅ **Intégration Firebase** | Déjà connecté à Auth et Firestore |

---

## 🔍 Suivre les déploiements

### Sur GitHub
Allez dans l'onglet **Actions** de votre dépôt :
https://github.com/anthonypruneta/duels-de-cave/actions

Vous verrez les builds en cours et leur statut.

### Sur Firebase
Console Firebase → **Hosting** → Onglet **Releases**

Vous verrez l'historique de tous vos déploiements.

---

## ❓ FAQ

**Q : Combien de temps prend un déploiement ?**
R : Environ 2-3 minutes (build + déploiement)

**Q : Que se passe-t-il si je push sur une autre branche ?**
R : Seuls les push sur `main` ou `master` déclenchent un déploiement

**Q : Comment déployer manuellement ?**
R : Installez Firebase CLI (`npm install -g firebase-tools`) puis `firebase deploy`

**Q : Les prévisualisations marchent comment ?**
R : Chaque Pull Request génère une URL unique de prévisualisation

---

## 📚 Documentation

- Firebase Hosting : https://firebase.google.com/docs/hosting
- GitHub Actions : https://firebase.google.com/docs/hosting/github-integration
- Support : https://firebase.google.com/support

---

🎮 **Bon déploiement !**
