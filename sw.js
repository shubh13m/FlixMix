const CACHE_NAME = 'filmyfool-v9'; // Increment this every time you push a change
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// 1. Install: Cache core UI assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching new assets');
      return cache.addAll(ASSETS);
    })
  );
  // REMOVED self.skipWaiting() from here.
  // We want the worker to wait until the user clicks the Update Button.
});

// 2. Activate: Clean up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('SW: Removing old cache', key);
          return caches.delete(key);
        })
      );
    })
  );
  // Take control of the page immediately
  return self.clients.claim(); 
});

// 3. Fetch: Network-First Strategy for UI, Network-Only for API
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // API Calls: Always go to the network
  if (url.includes('omdbapi.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // UI Assets: Network-First
  // This ensures the browser always tries to get the newest app.js/style.css
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Update the cache with the fresh version we just fetched
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return response;
      })
      .catch(() => caches.match(event.request)) // Fallback to cache if offline
  );
});

// 4. Message: This is the listener for your Update Button
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    console.log('SW: skipWaiting signal received. Activating new version...');
    self.skipWaiting();
  }
});
