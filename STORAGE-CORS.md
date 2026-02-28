# CORS pour Firebase Storage (balance.json)

Si la console navigateur affiche des erreurs **CORS** en chargeant `balance.json` depuis Firebase Storage, il faut autoriser ton domaine sur le bucket.

## Étapes (une seule fois)

1. **Installer Google Cloud SDK** (si pas déjà fait)  
   https://cloud.google.com/sdk/docs/install  
   Ou utiliser **Cloud Shell** dans la console GCP (pas d’install locale).

2. **Se connecter au bon projet**  
   ```bash
   gcloud auth login
   gcloud config set project duelsdecave
   ```

3. **Appliquer la config CORS** (depuis la racine du repo, où se trouve `storage-cors.json`)  
   ```bash
   gsutil cors set storage-cors.json gs://duelsdecave.firebasestorage.app
   ```

4. **Vérifier**  
   ```bash
   gsutil cors get gs://duelsdecave.firebasestorage.app
   ```

Après ça, recharger le site : les requêtes vers `balance.json` ne devraient plus être bloquées par CORS.

## Via la console GCP (Cloud Shell)

1. Ouvre https://console.cloud.google.com/ → projet **duelsdecave**.
2. Clique sur l’icône **Cloud Shell** (>_) en haut à droite.
3. Crée le fichier (copie le contenu de `storage-cors.json` du repo) :
   ```bash
   nano cors.json
   ```
4. Puis :
   ```bash
   gsutil cors set cors.json gs://duelsdecave.firebasestorage.app
   ```
