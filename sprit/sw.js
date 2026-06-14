const CACHE_NAME = 'spritpreise-lu-v1';
const ASSETS = [
  'index.html',
  'style.css',
  'manifest.json'
];

// Install Service Worker
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate & Cleanup Old Caches
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

// Network First fallback to Cache strategy
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('api-gate.rtl.lu')) {
    // Let API calls pass without full asset caching, handeled via JS custom fallback
    return;
  }
  e.respondWith(
    fetch(e.request)
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
