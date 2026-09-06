/**
 * Kleiner Service Worker: laedt die App-Dateien beim ersten Besuch in den Cache,
 * damit der Tracker auch ohne Internet startet. Die Trainingsdaten selbst liegen
 * im localStorage und sind davon unabhaengig.
 */
const CACHE = 'gym-tracker-v1';
// Wird beim Bauen durch die Liste aller App-Dateien ersetzt (vite.config.ts).
// Ohne das kennt der Worker nur die Startseite und laedt Diagramm- und
// Seitenbuendel beim ersten Offline-Aufruf nicht.
const PRECACHE = ['./', './index.html'];
// Uebungsbilder aus der wger-Datenbank liegen getrennt, damit sie beim
// Aktualisieren der App nicht jedes Mal neu geladen werden muessen.
const IMAGE_CACHE = 'gym-tracker-wger-images-v1';
const IMAGE_LIMIT = 150;

self.addEventListener('install', (event) => {
  // Bewusst kein skipWaiting: Die neue Fassung wartet, bis die App Bescheid
  // sagt. Sonst tauschen wir dem Nutzer die Dateien mitten im Training aus.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => undefined));
});

// Die App meldet sich, wenn der Nutzer das Update annehmen will.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((key) => key !== CACHE && key !== IMAGE_CACHE)
        .map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Uebungsbilder von wger: einmal geladen, bleiben sie offline verfuegbar.
  if (url.hostname === 'wger.de' && /\.(png|jpe?g|webp|gif|svg)$/i.test(url.pathname)) {
    event.respondWith(cacheImage(request));
    return;
  }

  if (url.origin !== self.location.origin) return; // sonstige API-Aufrufe nie cachen

  // Navigation: erst Netz, sonst Cache (damit Updates ankommen, offline aber laeuft).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }

  // Statische Dateien: erst Cache, im Hintergrund aktualisieren.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});

/**
 * Bilder zuerst aus dem Zwischenspeicher bedienen und sonst holen.
 * Der Speicher wird bei Bedarf auf IMAGE_LIMIT Eintraege gestutzt, damit er
 * nicht unbegrenzt waechst.
 */
async function cacheImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  try {
    const response = await fetch(request);
    // Auch undurchsichtige Antworten (ohne CORS) sind als Bild brauchbar.
    if (response && (response.ok || response.type === 'opaque')) {
      await cache.put(request, response.clone());
      void trimCache(cache);
    }
    return response;
  } catch (error) {
    // Ohne Netz und ohne Kopie bleibt das Bild eben leer.
    return hit ?? Response.error();
  }
}

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMAGE_LIMIT) return;
  for (const key of keys.slice(0, keys.length - IMAGE_LIMIT)) {
    await cache.delete(key);
  }
}

/* --------------------------------------------------------- Push-Nachrichten */

/*
 * Es kommt bewusst nur ein Anstupser ohne Inhalt an: Beim Push-Dienst von
 * Google oder Apple sollen keine Trainingsdaten liegen. Der Text hier ist
 * deshalb allgemein gehalten; die Einzelheiten holt sich die App beim Oeffnen.
 */
self.addEventListener('push', (event) => {
  let title = 'Gym-Tracker';
  let body = 'Bei deinen Freunden hat sich etwas getan.';

  // Falls doch einmal etwas mitgeschickt wird, nehmen wir es entgegen.
  if (event.data) {
    try {
      const payload = event.data.json();
      title = payload.title || title;
      body = payload.body || body;
    } catch (error) {
      const text = event.data.text();
      if (text) body = text;
    }
  }

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'gym-tracker-friends',
    renotify: false,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const scope = new URL(self.registration.scope);

    for (const client of clientList) {
      if (new URL(client.url).origin === scope.origin && 'focus' in client) {
        await client.focus();
        client.postMessage({ type: 'OPEN_FRIENDS' });
        return;
      }
    }
    await self.clients.openWindow(scope.href);
  })());
});
