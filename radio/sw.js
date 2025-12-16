const CACHE_NAME = 'fordy-radio-v1';
const ASSETS = [
  './index.html',
  './assets/style.css',
  '../assets/style.css',
  '../assets/icon.png',
  '../assets/Fordy.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  // Try network first, fall back to cache
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});