// Define cache name and static assets
const CACHE_NAME = 'spritpreise-lu-v1';
const ASSETS = [
  './index.html',
  './assets/style.css',
  './assets/app.png',
  './assets/favicon.png'
];

// Install service worker and cache assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate service worker and clear old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Intercept fetch requests and apply caching strategies
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('api.heyfordy.dev')) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse.clone().json().then((data) => {
                data._isCached = true;
                return new Response(JSON.stringify(data), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                });
              }).catch(() => {
                return cachedResponse;
              });
            }
            throw new Error('Offline and no cache available');
          });
        })
    );
  } else {
    e.respondWith(
      fetch(e.request)
        .catch(() => {
          return caches.match(e.request);
        })
    );
  }
});