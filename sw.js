// Mood Moves Service Worker
// Handles: offline caching, background sync, push notifications
//
// ── VERSION LOG ──────────────────────────────────────────
// v20260609 — Force cache clear, sticky fix, calendar, challenge
// v20260601 — SW notification fix, sticky note on login, auto permission
// v20260531 — PWA launch, notifications, sticky note, lotties
// ─────────────────────────────────────────────────────────
// HOW TO FORCE UPDATE FOR ALL USERS:
// Change APP_VERSION below to today's date e.g. 'v20260602'
// Every user's phone will auto-download the fresh version within 24hrs
// ─────────────────────────────────────────────────────────

const APP_VERSION = 'v20260609';
const CACHE_NAME = 'mood-moves-' + APP_VERSION;
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/skate.json'
];

// ── INSTALL: cache core assets ────────────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        OFFLINE_ASSETS.map(function(url) {
          return cache.add(url).catch(function() {});
        })
      );
    }).then(function() {
      return self.skipWaiting(); // activate immediately
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
      return self.clients.claim(); // take control immediately
    })
  );
});

// ── FETCH: network first, fall back to cache ──────────────
// Network-first means users ALWAYS get the latest index.html
// Only falls back to cache if they're offline
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  // For index.html: always try network first so updates reach users instantly
  var isPage = e.request.url === self.location.origin + '/' ||
               e.request.url === self.location.origin + '/index.html';

  if (isPage) {
    e.respondWith(
      fetch(e.request).then(function(response) {
        // Cache the fresh copy
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline — serve cached version
        return caches.match('/index.html');
      })
    );
    return;
  }

  // For other assets: cache first (fast), update in background
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var networkFetch = fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var ct = response.headers.get('content-type') || '';
          if (ct.includes('javascript') || ct.includes('css') || ct.includes('json') || ct.includes('image')) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(e.request, clone);
            });
          }
        }
        return response;
      }).catch(function() { return cached; });

      return cached || networkFetch;
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

// ── NOTIFICATION CLICK ────────────────────────────────────
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var targetUrl = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.includes(self.location.origin) && 'focus' in clients[i]) {
          return clients[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// ── MESSAGES FROM APP ─────────────────────────────────────
self.addEventListener('message', function(e) {
  if (!e.data) return;

  if (e.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(e.data.title || 'Mood Moves', {
      body: e.data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: e.data.tag || 'mm-notif',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: '/' }
    });
    return;
  }

  if (e.data.type === 'SCHEDULE_TIMER_NOTIF') {
    var delay = (e.data.seconds || 60) * 1000;
    var label = e.data.label || 'your exercise';
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
    return;
  }

  if (e.data.type === 'CANCEL_TIMER_NOTIF') {
    self.registration.getNotifications({ tag: 'mm-rest-timer' }).then(function(notifs) {
      notifs.forEach(function(n) { n.close(); });
    });
  }
});
