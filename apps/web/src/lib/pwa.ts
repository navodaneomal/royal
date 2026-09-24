/* PWA plumbing: a tasteful install prompt and an honest update banner.
   The service worker caches the APP SHELL only (ADR-0003) and waits for the
   reader's go-ahead before swapping versions. */
type Listener = () => void
let deferred: any = null
let waiting: ServiceWorker | null = null
const listeners = new Set<Listener>()
const emit = () => listeners.forEach((fn) => fn())
export const onPwaChange = (fn: Listener) => { listeners.add(fn); return () => listeners.delete(fn) }

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
export const canInstall = () => !!deferred
export const updateReady = () => !!waiting

export async function promptInstall() {
  if (!deferred) return 'unavailable'
  deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  emit()
  return outcome as 'accepted' | 'dismissed'
}

export function applyUpdate() {
  if (!waiting) return
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
  waiting.postMessage({ type: 'SKIP_WAITING' })
}

export function initPwa() {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit() })
  addEventListener('appinstalled', () => { deferred = null; emit() })
  if (!('serviceWorker' in navigator) || /^517/.test(location.port) || (import.meta as any).env?.DEV) return
  addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const track = (w: ServiceWorker | null) => {
        if (!w) return
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) { waiting = w; emit() }
        })
      }
      if (reg.waiting && navigator.serviceWorker.controller) { waiting = reg.waiting; emit() }
      reg.addEventListener('updatefound', () => track(reg.installing))
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000)
    } catch { /* no SW — the app still works online */ }
  })
}
