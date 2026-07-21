const CACHE_NAME = 'ksas-v2.1';
const ASSET_CACHE = 'ksas-assets-v2.1';
const API_CACHE = 'ksas-api-v2.1';

// Build output files (Vite generates these with hashes)
const BUILD_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/ksas-logo.png',
  'https://res.cloudinary.com/dilrcexxe/image/upload/v1784619847/ksas/logo-main.png',
];

// Runtime caching strategy
const CACHE_STRATEGIES = {
  assets: { mode: 'cache-first', maxAge: 365 * 24 * 60 * 60 },
  html: { mode: 'network-first', maxAge: 0 },
  api: { mode: 'network-first', maxAge: 5 * 60 },
};

// Determine cache strategy based on URL
function getStrategy(url) {
  const path = url.pathname;
  
  if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$/)) {
    return CACHE_STRATEGIES.assets;
  }
  
  if (path.endsWith('.html') || path === '/') {
    return CACHE_STRATEGIES.html;
  }
  
  if (path.includes('/api/') || path.includes('firestore') || path.includes('firebase')) {
    return CACHE_STRATEGIES.api;
  }
  
  return { mode: 'stale-while-revalidate', maxAge: 60 * 60 };
}

// Install: pre-cache critical assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(BUILD_ASSETS).catch(err => {
        console.warn('[SW] Failed to cache build assets:', err);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    caches.keys().then(keys => {
      const validCaches = [CACHE_NAME, ASSET_CACHE, API_CACHE];
      return Promise.all(
        keys.filter(k => !validCaches.includes(k)).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  if (request.method !== 'GET') return;
  
  const url = new URL(request.url);
  const strategy = getStrategy(url);
  
  event.respondWith(handleFetch(request, strategy));
});

async function handleFetch(request, strategy) {
  const cache = await caches.open(CACHE_NAME);
  
  switch (strategy.mode) {
    case 'cache-first': {
      const cached = await cache.match(request);
      if (cached) return cached;
      
      try {
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        return new Response('Offline', { status: 503 });
      }
    }
    
    case 'network-first': {
      try {
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response('Offline', { status: 503 });
      }
    }
    
    case 'stale-while-revalidate': {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then(response => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => cached);
      
      return cached || await fetchPromise;
    }
    
    default:
      return fetch(request);
  }
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    console.log('[SW] Background sync triggered');
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'New notification',
    icon: 'https://res.cloudinary.com/dilrcexxe/image/upload/v1784619847/ksas/logo-main.png',
    badge: 'https://res.cloudinary.com/dilrcexxe/image/upload/v1784619847/ksas/logo-main.png',
    data: data.url || '/',
    actions: data.actions || [],
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'KSAS', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});