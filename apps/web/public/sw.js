/* Storyframe app-shell service worker (ADR-0003).
   Scope: the APPLICATION shell only. Story packages are never served
   through this worker — offline stories run from integrity-verified blobs
   held in IndexedDB, because opaque-origin frames are not service-worker
   clients. v2 enforces that for single-origin deployments too (the
   /stories-host/ tree is never cached here), keeps /config.json
   network-first, and waits for the reader to accept an update.
   Paths are matched relative to the worker's scope, so the same file works
   at a domain root and under a sub-path (GitHub Pages: /<repo>/). */
const SHELL = 'sf-shell-v3'
const BASE = new URL(self.registration.scope).pathname          // '/' or '/<repo>/'
const local = (pathname) => '/' + pathname.slice(BASE.length)    // path inside the app
const NEVER = [/^\/stories-host\//, /^\/share\//]

self.addEventListener('install', () => { /* wait: the app shows "update available" */ })
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting() })
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith(BASE)) return
  const path = local(url.pathname)
  if (NEVER.some((re) => re.test(path))) return                     // content plane: never through the SW

  if (path === '/config.json') {                               // runtime config: network first
    e.respondWith(fetch(e.request).then((res) => {
      if (res.ok) caches.open(SHELL).then((c) => c.put(e.request, res.clone()))
      return res
    }).catch(() => caches.match(e.request).then((r) => r || new Response('{}', { headers: { 'content-type': 'application/json' } }))))
    return
  }

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
      const home = await cache.match(BASE)
      if (home) return home
    }
    return new Response('offline', { status: 503 })
  })())
})
