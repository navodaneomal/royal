/* Storyframe app-shell service worker.
   Scope: the APPLICATION shell only. Story packages are never served
   through this worker — offline stories run from integrity-verified
   blobs held in IndexedDB (see ADR-0003), because opaque-origin frames
   are not service-worker clients. */
const SHELL = 'sf-shell-v1'
self.addEventListener('install', (e) => { self.skipWaiting() })
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/stories-host/registry')) return   // catalog freshness handled in-app
  e.respondWith((async () => {
    const cache = await caches.open(SHELL)
    const cached = await cache.match(e.request)
    const network = fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone())
      return res
    }).catch(() => null)
    if (cached) { network.catch(() => {}); return cached }
    const fresh = await network
    if (fresh) return fresh
    if (e.request.mode === 'navigate') {
      const home = await cache.match('/')
      if (home) return home
    }
    return new Response('offline', { status: 503 })
  })())
})
