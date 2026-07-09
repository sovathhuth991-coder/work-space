// Service Worker for Workspace Hub PWA
const CACHE_NAME = 'workspace-hub-v5';
const STATIC_ASSETS = [
  'Workspace.html',
  'TUTORIAL.md',

  // CSS - core
  'WorkspaceCore/reset.css',
  'WorkspaceCore/variables.css',
  'WorkspaceCore/layout.css',
  'WorkspaceCore/mobile.css',

  // CSS - features
  'WorkspaceFeatures/schedule/schedule.css',
  'WorkspaceFeatures/schedule/schedule-modal.css',
  'WorkspaceShared/drag-drop.css',
  'WorkspaceFeatures/dashboard/dashboard.css',
  'WorkspaceFeatures/weather/weather.css',
  'WorkspaceFeatures/lessons/lessons.css',
  'WorkspaceFeatures/tasks/tasks.css',
  'WorkspaceFeatures/library/library.css',
  'WorkspaceFeatures/dashboard/widgets.css',
  'WorkspaceShared/modals.css',
  'WorkspaceShared/animations.css',
  'WorkspaceFeatures/analytics/analytics.css',
  'WorkspaceFeatures/dev-tools/dev-tools.css',
  'WorkspaceFeatures/timer/timer-enhancements.css',
  'WorkspaceFeatures/timer/pomodoro.css',
  'WorkspaceFeatures/journal/journal.css',
  'WorkspaceFeatures/date-countdown/date-countdown.css',
  'WorkspaceFeatures/reading/reading.css',
  'WorkspaceShared/fab-buttons.css',

  // JS - core
  'WorkspaceCore/init-globals.js',
  'WorkspaceCore/config.js',
  'WorkspaceCore/helpers.js',

  // JS - ui
  'WorkspaceShared/theme.js',
  'WorkspaceShared/notifications.js',
  'WorkspaceFeatures/analytics/analytics.js',
  'WorkspaceShared/undo-redo.js',
  'WorkspaceShared/drag-drop.js',
  'WorkspaceShared/context-menu.js',
  'WorkspaceFeatures/dashboard/dashboard.js',
  'WorkspaceFeatures/weather/weather.js',
  'WorkspaceFeatures/tasks/tasks.js',
  'WorkspaceFeatures/library/library.js',
  'WorkspaceFeatures/dashboard/widgets.js',
  'WorkspaceFeatures/date-countdown/date-countdown.js',
  'WorkspaceFeatures/dev-tools/dev-tools.js',
  'WorkspaceShared/sparkles.js',
  'WorkspaceFeatures/schedule/templates.js',
  'WorkspaceFeatures/schedule/ical-export.js',
  'WorkspaceShared/tour.js',
  'WorkspaceShared/interactive-tutorial.js',
  'WorkspaceShared/ux-enhancements.js',
  'WorkspaceFeatures/journal/journal-ui.js',
  'WorkspaceCore/app.js',

  // JS - engines
  'WorkspaceFeatures/schedule/schedule-core.js',
  'WorkspaceFeatures/schedule/schedule-planner.js',
  'WorkspaceFeatures/lessons/lessons.js',
  'WorkspaceFeatures/timer/simple-timer.js',
  'WorkspaceFeatures/timer/pomodoro.js',
  'WorkspaceFeatures/timer/session-tracker.js',
  'WorkspaceFeatures/graph/graph.js',
  'WorkspaceFeatures/schedule/calendar.js',
  'WorkspaceFeatures/habits/habits.js',
  'WorkspaceFeatures/journal/journal.js',
  'WorkspaceFeatures/reading/reading.js',

  // Manifest & icons
  'manifest.json',
  'site.webmanifest',
  'favicon.ico',
  'favicon.svg',
  'favicon-96x96.png',
  'apple-touch-icon.png',
  'web-app-manifest-192x192.png',
  'web-app-manifest-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response to cache
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('Workspace.html');
            }
          });
      })
  );
});

// Handle background sync (for future use)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  console.log('[SW] Performing background sync...');
  return Promise.resolve();
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: 'web-app-manifest-192x192.png',
    badge: 'web-app-manifest-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Workspace Hub', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  event.waitUntil(
    clients.openWindow('Workspace.html')
  );
});
