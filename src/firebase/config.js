import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

// Configuration Firebase
// IMPORTANT: Remplace ces valeurs par tes propres clés Firebase
// Pour obtenir ces clés:
// 1. Va sur https://console.firebase.google.com/
// 2. Crée un nouveau projet ou utilise un projet existant
// 3. Ajoute une application web
// 4. Copie les valeurs de configuration ici

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Debug: Vérifier que les variables d'environnement sont chargées
console.log('🔥 Firebase Config:', {
  hasApiKey: !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY",
  hasAuthDomain: !!firebaseConfig.authDomain && !firebaseConfig.authDomain.includes("YOUR_PROJECT_ID"),
  projectId: firebaseConfig.projectId,
  hasValidConfig: firebaseConfig.projectId !== "YOUR_PROJECT_ID"
});

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Initialiser les services
export const auth = getAuth(app);

// Initialiser Firestore avec persistence désactivée
// Cela force une connexion réseau directe sans cache offline
let db;
try {
  db = initializeFirestore(app, {
    localCache: {
      kind: 'memory'  // Utilise seulement la mémoire, pas IndexedDB
    },
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false
  });
  console.log('✅ Firestore initialisé (cache mémoire + long polling)');

  // Test de connexion Firestore
  import('firebase/firestore').then(({ doc, getDoc }) => {
    const testRef = doc(db, 'test', 'test123');
    getDoc(testRef)
      .then(snap => {
        if (snap.exists()) {
          console.log('✅ TEST FIRESTORE RÉUSSI - Document lu:', snap.data());
        } else {
          console.log('ℹ️ TEST FIRESTORE - Document test n\'existe pas (créez-le manuellement)');
        }
      })
      .catch(err => {
        console.error('❌ TEST FIRESTORE ÉCHOUÉ:', err.code, err.message);
      });
  });

} catch (error) {
  // Si déjà initialisé, utiliser l'instance existante
  db = getFirestore(app);
  console.log('ℹ️ Firestore déjà initialisé, utilisation de l\'instance existante');
}

export { db };

export default app;
