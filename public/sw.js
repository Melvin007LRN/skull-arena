// Service worker de Skull Arena : rend l'appli installable et accélère le chargement.
// Les images et les fichiers du site sont gardés en cache ; le serveur de jeu (Supabase) n'est jamais mis en cache.
const VERSION = 'skull-arena-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(['/', '/manifest.webmanifest', '/decor/logo.webp'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, polices… : réseau direct

  // Pages : le réseau d'abord (pour toujours avoir la dernière version), le cache si hors ligne.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copie = r.clone(); caches.open(VERSION).then((c) => c.put('/', copie)); return r; })
      .catch(() => caches.match('/')));
    return;
  }
  // Cartes, décors, icônes et fichiers du site (noms versionnés) : le cache d'abord.
  if (/^\/(cartes|decor|icones|assets)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((deja) => deja || fetch(req).then((r) => {
      if (r.ok) { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(req, copie)); }
      return r;
    })));
  }
});
