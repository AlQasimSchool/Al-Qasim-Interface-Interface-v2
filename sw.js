const CACHE_NAME = 'alqasim-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/auth-indigo.css',
  './js/app.js',
  './js/ui.js',
  './js/auth-unified.js',
  './js/api.js',
  './js/navigation.js',
  './ico.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  
  // Exclude API calls from service worker cache (they are handled in api.js)
  if (event.request.url.includes('supabase.co') || event.request.url.includes('googleapis.com')) {
      return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
