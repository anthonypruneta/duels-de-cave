import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, enableNetwork, onSnapshot, collection } from 'firebase/firestore';

// Configuration Firebase
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

// Vérifier la connectivité réseau du navigateur
console.log('🌐 État réseau navigateur:', navigator.onLine ? 'ONLINE' : 'OFFLINE');

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Initialiser les services
export const auth = getAuth(app);

// Initialiser Firestore avec cache MEMOIRE uniquement (pas persistant)
// Le cache persistant peut causer "client is offline" errors
// Solutions: https://github.com/firebase/firebase-js-sdk/issues/3207
export const db = initializeFirestore(app, {
  // Force long polling pour une meilleure compatibilité réseau
  experimentalForceLongPolling: true,

  // Désactive fetch streams qui peuvent causer des problèmes de connexion
  useFetchStreams: false,

  // Cache MEMOIRE uniquement (résout les problèmes "client is offline")
  localCache: {
    kind: 'memory'
  }
});

console.log('✅ Firestore initialisé avec configuration optimisée');
console.log('🔧 Long polling: activé | Cache: MEMOIRE uniquement');
console.log('📍 Base de données:', firebaseConfig.projectId);

// Forcer l'activation du réseau Firestore
enableNetwork(db)
  .then(() => {
    console.log('✅ Réseau Firestore activé avec succès');
  })
  .catch((error) => {
    console.error('❌ Erreur activation réseau Firestore:', error);
  });

// Debug: Tester la connexion Firestore avec un snapshot
setTimeout(() => {
  const testRef = collection(db, 'characters');
  const unsubscribe = onSnapshot(
    testRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      console.log('🔍 Test connexion Firestore:', {
        hasData: !snapshot.empty,
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        isOnline: !snapshot.metadata.fromCache
      });
      unsubscribe();
    },
    (error) => {
      console.error('❌ Erreur test connexion Firestore:', error);
    }
  );
}, 1000);

export default app;
