import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, enableNetwork, onSnapshot, collection, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Activer le debug logging pour diagnostiquer les problèmes de connexion
setLogLevel('debug');

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDyACCebAZj107gG6iZJgtBjbI89dctfKM",
  authDomain: "duelsdecave.firebaseapp.com",
  projectId: "duelsdecave",
  storageBucket: "duelsdecave.firebasestorage.app",
  messagingSenderId: "866732384684",
  appId: "1:866732384684:web:fdf687dc8c319fc45d9a09",
  measurementId: "G-6LDTJELWGW"
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
export const storage = getStorage(app);

// Initialiser Firestore avec cache MEMOIRE uniquement (pas persistant)
// Le cache persistant peut causer "client is offline" errors
// Solutions: https://github.com/firebase/firebase-js-sdk/issues/3207
export const db = initializeFirestore(app, {
  // Spécifier la base de données Standard (pas Enterprise)
  databaseId: "(default)",

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

// Flag pour indiquer si Firestore est prêt
let firestoreReady = false;

// Export d'une promesse qui se résout quand Firestore est prêt
export const waitForFirestore = () => {
  if (firestoreReady) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (firestoreReady) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    // Timeout après 30 secondes
    setTimeout(() => {
      clearInterval(checkInterval);
      console.warn('⚠️ Timeout en attendant la connexion Firestore');
      resolve(); // Résoudre quand même pour ne pas bloquer l'app
    }, 30000);
  });
};

// Forcer l'activation du réseau Firestore
enableNetwork(db)
  .then(() => {
    console.log('✅ Réseau Firestore activé avec succès');
  })
  .catch((error) => {
    console.error('❌ Erreur activation réseau Firestore:', error);
  });

// Debug: Tester la connexion Firestore avec un snapshot
// Augmentation du délai à 3 secondes pour laisser la connexion s'établir
setTimeout(() => {
  console.log('🔄 Début du test de connexion Firestore...');

  const testRef = collection(db, 'characters');
  const unsubscribe = onSnapshot(
    testRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      const connectionInfo = {
        hasData: !snapshot.empty,
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        isOnline: !snapshot.metadata.fromCache
      };

      console.log('🔍 Test connexion Firestore:', connectionInfo);

      // Marquer comme prêt uniquement si on a réussi à se connecter (pas fromCache)
      if (!snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites === false) {
        firestoreReady = true;
        console.log('✅ Firestore est maintenant PRÊT pour les requêtes');
      } else {
        console.warn('⚠️ Données servies depuis le cache, connexion réseau peut-être pas établie');
        // Considérer comme prêt quand même après le premier snapshot
        firestoreReady = true;
      }

      unsubscribe();
    },
    (error) => {
      console.error('❌ Erreur test connexion Firestore:', error);
      console.error('📋 Détails erreur:', {
        code: error.code,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });

      // Même en cas d'erreur, permettre les requêtes après 5 secondes
      setTimeout(() => {
        console.warn('⚠️ Marquage Firestore comme prêt malgré l\'erreur (fallback)');
        firestoreReady = true;
      }, 5000);
    }
  );
}, 3000);

export default app;
