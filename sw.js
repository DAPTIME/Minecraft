const CACHE = 'devcraft-v3';
// Relative paths so the SW works whether served from the domain root
// (e.g. http://localhost/) or a subdirectory (e.g. https://user.github.io/minecraft/).
const FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/main.js',
  './js/world.js',
  './js/textures.js',
  './js/noise.js',
  './js/redstone.js',
  './js/settings.js',
  './js/structures.js',
  './js/villages.js',
  './js/mobile.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/three@0.160.0/build/three.module.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      // Add files individually so one failed asset (e.g. CDN offline) doesn't kill install.
      await Promise.all(FILES.map((url) =>
        c.add(url).catch((err) => console.warn('SW cache miss:', url, err))
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') return response;
        const clone = response.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return response;
      }).catch(() => cached);
    })
  );
});
