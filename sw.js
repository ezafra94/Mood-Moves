// Mood Moves Service Worker v20260623
// NUCLEAR CACHE BUST — clears all previous versions

const APP_VERSION = 'v20260637';
const CACHE_NAME = 'mood-moves-v20260634';

// On install — take control immediately, don't wait
self.addEventListener('install', function(e) {
  console.log('[SW] Installing v20260634');
  self.skipWaiting(); // activate immediately without waiting
});

// On activate — delete ALL old caches and claim all clients
self.addEventListener('activate', function(e) {
  console.log('[SW] Activating v20260634 — clearing all old caches');
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.map(function(name) {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(function() {
      console.log('[SW] All old caches cleared. Claiming clients.');
      return self.clients.claim(); // take control of all open tabs immediately
    })
  );
});

// Fetch — network first, no aggressive caching that would lock old versions
self.addEventListener('fetch', function(e) {
  // For the app shell (index.html and sw.js) — always go to network
  var url = e.request.url;
  if (url.includes('sw.js') || url.endsWith('/') || url.includes('index.html')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }
  // For everything else — network first
  e.respondWith(
    fetch(e.request).then(function(response) {
      return response;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});

// ── PUSH NOTIFICATIONS ─────────────────────────────────────
self.addEventListener('push', function(e) {
  console.log('[SW] Push received');
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) { data = {}; }
  
  var title = data.title || 'Mood Moves 💪';
  var body  = data.body  || 'Your morning boost is ready. Open the app.';
  var icon  = data.icon  || '/icon-192.png';
  
  e.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: icon,
      badge: icon,
      data: { url: '/?notify=1' },
      requireInteraction: false,
      vibrate: [200, 100, 200]
    })
  );
});

// ── NOTIFICATION CLICK ─────────────────────────────────────
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var targetUrl = '/?notify=1';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.includes(self.location.origin) && 'focus' in clients[i]) {
          clients[i].postMessage({ type: 'SHOW_STICKY_NOTE' });
          clients[i].navigate(targetUrl);
          return clients[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// ── MESSAGES FROM APP ──────────────────────────────────────
self.addEventListener('message', function(e) {
  if (!e.data) return;
  if (e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (e.data.type === 'CANCEL_TIMER_NOTIF') {
    // handled by app
  }
  // App sends SHOW_NOTIFICATION when it wants to display a local notification
  if (e.data.type === 'SHOW_NOTIFICATION') {
    var title = e.data.title || 'Mood Moves 💫';
    var body  = e.data.body  || 'Your daily message is waiting.';
    var tag   = e.data.tag   || 'mm-notif';
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag,
      data: { url: '/?notify=1' },
      requireInteraction: false,
      vibrate: [200, 100, 200]
    });
  }
  // SW_UPDATED: tell clients to reload for new version
  if (e.data.type === 'SW_UPDATED') {
    self.clients.matchAll({ type: 'window' }).then(function(clients) {
      clients.forEach(function(client) { client.postMessage({ type: 'SW_UPDATED' }); });
    });
  }
});
