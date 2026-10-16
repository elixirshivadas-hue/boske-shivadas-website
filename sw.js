// NIJOK service worker: no caching, so the newest files always load.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const k of await caches.keys())await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch',()=>{});
