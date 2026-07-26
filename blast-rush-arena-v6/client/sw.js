const CACHE = 'blast-rush-arena-v14-reckoning';
const ASSETS = [
  '/', '/index.html', '/styles.css', '/v7-overrides.css', '/mobile-v8.css', '/cinematic-v9.css', '/mobile-cinematic-v10.css', '/cinematic-v11.css', '/mobile-pro-v12.css', '/premium-v13.css', '/v14-campaign.css',
  '/net.js', '/game.js', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg'
];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname === '/ws') return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok || response.type === 'opaque') {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') return (await caches.match('/index.html')) || Response.error();
    return Response.error();
  }));
});