/* NIJOK service worker v2
   - App files (html/js/css/json): network first, but falls back to cache after 4s,
     so a slow network never leaves a blank screen. New versions still show up.
   - Images and fonts: cache first, refreshed quietly in the background (fast).
   - Firebase, fonts CDN and other sites are never touched.
   Change V on every release to force every phone to refresh. */
const V = 'nijok-shell-v6';
const RT = 'nijok-media-v2';
const RT_MAX = 80;            // max cached images/fonts
const NET_WAIT = 4000;        // ms to wait for network before using cache
const SHELL = ['./', 'index.html', 'shop.html', 'manifest.json', 'nk2-180.png', 'nk2-192.png', 'nk2-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== V && x !== RT).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

const isMedia = u => /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf)$/i.test(u.pathname);
const okToCache = res => res && res.status === 200 && res.type === 'basic';

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > RT_MAX) await Promise.all(keys.slice(0, keys.length - RT_MAX).map(k => cache.delete(k)));
}

// images / fonts: show cached copy instantly, update in background
async function media(r) {
  const cache = await caches.open(RT);
  const hit = await cache.match(r);
  const net = fetch(r).then(res => {
    if (okToCache(res)) cache.put(r, res.clone()).then(() => trim(cache));
    return res;
  }).catch(() => null);
  return hit || (await net) || Response.error();
}

// app files: network first with timeout, cache as fallback
async function shell(r) {
  const cache = await caches.open(V);
  const net = fetch(r).then(res => {
    if (okToCache(res)) cache.put(r, res.clone());
    return res;
  });
  const fallback = async () =>
    (await cache.match(r, { ignoreSearch: true })) ||
    (r.mode === 'navigate' ? await cache.match('index.html') : undefined) ||
    Response.error();
  try {
    return await Promise.race([
      net,
      new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), NET_WAIT))
    ]);
  } catch (err) {
    net.catch(() => {});          // let the slow request finish and refresh the cache quietly
    return fallback();
  }
}

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;   // Firebase etc. go straight to network
  if (r.headers.has('range')) return;                               // video / audio streaming
  e.respondWith(isMedia(u) ? media(r) : shell(r));
});
