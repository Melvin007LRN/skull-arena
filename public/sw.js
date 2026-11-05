// Service worker de Skull Arena : rend l'appli installable et accélère le chargement.
// Les images et les fichiers du site sont gardés en cache ; le serveur de jeu (Supabase) n'est jamais mis en cache.
const VERSION = 'skull-arena-v3';

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
  // Cartes, décors, icônes : on affiche le cache tout de suite et on va chercher la nouvelle version en arrière-plan
  // (une carte redessinée apparaît donc au lancement suivant, sans rien vider).
  if (/^\/(cartes|decor|icones)\//.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then((c) => c.match(req).then((deja) => {
      const frais = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => deja);
      if (deja) { e.waitUntil(frais); return deja; }
      return frais;
    })));
    return;
  }
  // Fichiers du site (noms versionnés) : le cache d'abord.
  if (/^\/assets\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((deja) => deja || fetch(req).then((r) => {
      if (r.ok) { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(req, copie)); }
      return r;
    })));
  }
});

// ---------- Notifications sur le téléphone ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { titre: 'SKULL ARENA', corps: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titre || 'SKULL ARENA', {
    body: d.corps || '', icon: d.icone || '/icones/icone-192.png', badge: '/icones/icone-192.png',
    tag: d.tag, renotify: true, data: { url: d.url || '/' }, vibrate: [120, 60, 120],
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const f of fenetres) {
      if (new URL(f.url).origin === self.location.origin) {
        await f.focus();
        f.postMessage({ type: 'notification', url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
