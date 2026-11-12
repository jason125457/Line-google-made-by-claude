// Service Worker for Personal Finance Dashboard PWA
const CACHE_NAME = 'finance-pwa-v6';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Vite emits content-hashed files under /assets/. Each deploy adds new names and the old ones
// are never requested again, so keep only the newest few builds' worth.
const HASHED_ASSET_PREFIX = '/assets/';
const MAX_HASHED_ASSETS = 30;

async function putHashedAsset(request, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
  // cache.keys() is in insertion order, so the first entries are the oldest.
  const hashed = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith(HASHED_ASSET_PREFIX));
  await Promise.all(hashed.slice(0, Math.max(0, hashed.length - MAX_HASHED_ASSETS)).map((r) => cache.delete(r)));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not cache external API calls (e.g. Google Apps Script)
  if (url.origin !== self.location.origin || event.request.method !== 'GET') {
    return;
  }

  // 1. For HTML / Navigation requests: NETWORK FIRST!
  // Always fetch the freshest HTML from the server so user never gets stuck on old versions.
  if (
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Content-hashed build files never change: serve from cache, hit the network only on a miss.
  if (url.pathname.startsWith(HASHED_ASSET_PREFIX)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            event.waitUntil(putHashedAsset(event.request, networkResponse.clone()));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Other static files (icons, manifest): cached copy first, refreshed in the background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
