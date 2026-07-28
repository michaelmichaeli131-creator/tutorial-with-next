/**
 * Blast Rush Arena service worker.
 *
 * The build id is substituted by the server (see server/static.ts) from a hash of the deployed
 * client bundle. Deriving the cache name from it means a deploy changes this file's own bytes,
 * which is the only thing a browser inspects when deciding whether to install a new worker. The
 * previous hand-bumped CACHE constant only invalidated when somebody remembered to edit it.
 */
const BUILD = '__BUILD_ID__';
/* Unsubstituted means we are not being served by our own server; assume nothing is safe to reuse. */
const PLACEHOLDER = BUILD === '__BUILD' + '_ID__';
const CACHE = 'blast-rush-arena-' + BUILD;
const SHELL = '/index.html';

const ASSETS = [
  '/index.html', '/bundle.css',
  '/net.js', '/game.js', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg'
];

/* Set when a document response reports a build other than ours. Until this worker is replaced it
   stops serving its own cache, so the very first navigation after a deploy still gets fresh code. */
let outdated = false;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    if (PLACEHOLDER) return self.skipWaiting();
    const cache = await caches.open(CACHE);
    /* addAll is atomic: one 404 in the list aborts the whole install and the worker never
       activates, silently leaving the site with no offline support and no error anyone sees.
       These go through the HTTP cache on purpose. The server sends must-revalidate plus a strong
       ETag, so each of these is a ~190 byte conditional request that still cannot return stale
       content; forcing `cache: 'reload'` here would re-download the whole ~112 KB bundle a second
       time on every first visit, immediately after the page just finished fetching it. */
    await Promise.allSettled(ASSETS.map((asset) => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  /* Live data and the worker's own update check must always reach the network. */
  if (url.pathname.startsWith('/api/') || url.pathname === '/ws' || url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request));
    return;
  }
  if (!isPrecached(url.pathname)) return;
  event.respondWith(handleAsset(request));
});

function isPrecached(pathname) {
  return ASSETS.indexOf(pathname) >= 0 || pathname === '/';
}

/**
 * Documents are network-first so a deploy lands on the next navigation rather than whenever the
 * cache happens to turn over. The race against a timer is what keeps that from being the thing
 * that feels stuck: on a stalled mobile connection we fall back to the cached shell quickly
 * instead of sitting on a blank page until the request finally gives up.
 */
async function handleNavigate(request) {
  const cached = caches.match(SHELL);
  try {
    const response = await withTimeout(fetch(request), 2500, cached);
    if (response && response.ok) {
      checkBuild(response);
      if (!PLACEHOLDER) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(SHELL, copy)).catch(() => {});
      }
      return response;
    }
    if (response) return response;
  } catch { /* Offline; fall through to the shell. */ }
  return (await cached) || Response.error();
}

/**
 * Precached assets are served cache-first. That is only safe because the cache name is tied to the
 * build: anything in CACHE was fetched by this deployment's worker, so it cannot be stale. When
 * `outdated` is set we know better and go to the network.
 */
async function handleAsset(request) {
  if (PLACEHOLDER || outdated) return fetch(request);
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.status === 200) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

function checkBuild(response) {
  const served = response.headers.get('x-build');
  if (!served || PLACEHOLDER || served === BUILD || outdated) return;
  outdated = true;
  /* Ask the browser to fetch sw.js again now rather than at its own next checkpoint. */
  self.registration.update().catch(() => {});
}

function withTimeout(promise, ms, fallback) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(async () => {
      const cached = await fallback;
      /* No cached shell to fall back to, so the network attempt is still the best hope. */
      if (cached) resolve(cached);
    }, ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
