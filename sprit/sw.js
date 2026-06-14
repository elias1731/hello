const CACHE_NAME = 'spritpreise-lu-v1';
const ASSETS = [
  './index.html',
  './assets/style.css',
  './assets/app.png',
  './assets/favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

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
              return cachedResponse;
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