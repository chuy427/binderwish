// BinderWish service worker — makes the app work offline (card shows have bad
// signal). Generated at build time by vite.config.js: __BUILD__, __BASE__ and
// __PRECACHE__ are filled in.
//
//   app shell (index.html, JS, CSS, fonts, icons)  precached per build, cache-first
//   page navigations                               network first, cached app as fallback
//   bundled TCGPlayer catalog (/tcgplayer/…)       network first, cached copy offline
//   card data APIs (TCGdex, Lorcast)               network first, cached copy offline
//   everything else (images, Supabase, forms)      not touched
const BUILD = '__BUILD__';
const BASE = '__BASE__';
const PRECACHE = __PRECACHE__;
const SHELL = `bw-shell-${BUILD}`;
const DATA = 'bw-data-v1';
const API_HOSTS = ['api.tcgdex.net', 'api.lorcast.com'];
const DATA_LIMIT = 800; // cached catalog / API responses kept

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('bw-shell-') && name !== SHELL) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - DATA_LIMIT))) await cache.delete(k);
}

// Network first — but after `ms` on a weak signal, answer from the cache if we
// can (otherwise keep waiting for the network).
async function networkFirst(request, cacheName, ms) {
  const cache = await caches.open(cacheName);
  const net = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone()).then(() => trim(cache));
    return res;
  });
  try {
    return await Promise.race([net, timeout(ms)]);
  } catch {
    const hit = await cache.match(request) || await cache.match(request, { ignoreSearch: true });
    return hit || net;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(BASE)) return;
    if (url.pathname === `${BASE}version.json` || url.pathname === `${BASE}sw.js`) return;
    // Any page of the app: fresh when online, the cached app when offline.
    if (request.mode === 'navigate') {
      const net = fetch(request);
      event.respondWith(
        Promise.race([net, timeout(4000)])
          .catch(async () => (await caches.match(`${BASE}index.html`, { cacheName: SHELL })) || net),
      );
      return;
    }
    if (url.pathname.startsWith(`${BASE}tcgplayer/`)) {
      event.respondWith(networkFirst(request, DATA, 6000));
      return;
    }
    // Build assets are content-hashed: cache first, filling the cache as they load.
    event.respondWith((async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok && url.pathname.startsWith(`${BASE}assets/`)) (await caches.open(SHELL)).put(request, res.clone());
      return res;
    })());
    return;
  }

  if (API_HOSTS.includes(url.hostname)) {
    event.respondWith(networkFirst(request, DATA, 6000));
  }
});
