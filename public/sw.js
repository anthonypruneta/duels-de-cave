// Service worker minimal pour permettre l'installation PWA
// Pas de cache offline — l'app nécessite Firebase

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
