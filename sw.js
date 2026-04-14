const CACHE = 'moodmoves-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/6cfa3a26-b56c-43cf-9de8-1f302f7d4b37.jpg',
  '/avatar.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
