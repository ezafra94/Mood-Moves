// Mood Moves Service Worker
// Handles: offline caching, background sync, push notifications

const CACHE_NAME = 'mood-moves-v1';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── INSTALL: cache core assets ────────────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cache what we can — don't fail if some assets missing
      return Promise.allSettled(
        OFFLINE_ASSETS.map(function(url) {
          return cache.add(url).catch(function() {});
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: clean old caches ────────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH: serve from cache, fall back to network ─────────
self.addEventListener('fetch', function(e) {
  // Only handle GET requests for same-origin
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;

      return fetch(e.request).then(function(response) {
        // Cache successful HTML/JS/CSS responses
        if (response && response.status === 200) {
          var ct = response.headers.get('content-type') || '';
          if (ct.includes('html') || ct.includes('javascript') || ct.includes('css')) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(e.request, clone);
            });
          }
        }
        return response;
      }).catch(function() {
        // Offline fallback — return cached index.html
        return caches.match('/index.html');
      });
    })
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data.json(); } catch(err) {
    data = { title: 'Mood Moves 💪', body: e.data ? e.data.text() : 'Time to move!' };
  }

  e.waitUntil(
    self.registration.showNotification(data.title || 'Mood Moves 💪', {
      body: data.body || 'Your workout is ready.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'mood-moves',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  );
});

// ── NOTIFICATION CLICK: open or focus app ─────────────────
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var targetUrl = (e.notification.data && e.notification.data.url) || '/';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      // If app is already open, focus it
      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open it
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ── TIMER NOTIFICATION (from main thread via postMessage) ─
self.addEventListener('message', function(e) {
  if (!e.data) return;

  if (e.data.type === 'SCHEDULE_TIMER_NOTIF') {
    var delay = (e.data.seconds || 60) * 1000;
    var label = e.data.label || 'your exercise';

    // Use setTimeout in SW — works even when main page is hidden
    setTimeout(function() {
      self.registration.showNotification('💪 Rest done! Time to go!', {
        body: 'Next set of ' + label + ' is ready. Get after it!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'mm-rest-timer',
        renotify: true,
        vibrate: [300, 100, 300, 100, 300],
        silent: false
      });
    }, delay);
  }

  if (e.data.type === 'CANCEL_TIMER_NOTIF') {
    // Can't cancel a setTimeout in SW easily — but we close any existing notification
    self.registration.getNotifications({ tag: 'mm-rest-timer' }).then(function(notifs) {
      notifs.forEach(function(n) { n.close(); });
    });
  }
});
