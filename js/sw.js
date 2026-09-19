const ICONS_DIR = 'icons';
const FILES = [
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'js/data-layer.js',
  'js/integration.js',
  'js/sw.js',
];

const STATIC_CACHE = 'trafy-static-v1';
const DYNAMIC_CACHE = 'trafy-dynamic-v1';

const STATIC_URLS = [
  '/',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/js/data-layer.js',
  '/js/integration.js',
  '/js/sw.js',
  `/icons/icon-192.png`,
  `/icons/icon-512.png`,
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_URLS).catch((err) => {
        console.warn('[SW] Не удалось закэшировать часть ресурсов:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API-запросы и внешние CDN — сеть-first
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('unpkg.com')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const clone = resp.clone();
          if (clone.ok) {
            caches.open(DYNAMIC_CACHE).then((c) => c.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // Статика — cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        const clone = resp.clone();
        if (clone.ok) {
          caches.open(STATIC_CACHE).then((c) => c.put(event.request, clone));
        }
        return resp;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
