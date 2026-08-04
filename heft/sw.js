// define cache namespace
const CACHE_NAME = 'berichtsheft-pwa-v1';
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// handle installation phase
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// handle fetch events for offline fallback
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});