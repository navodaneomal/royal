/* Storyframe reader shell — hash-routed so every screen survives refresh
   on any static host (§25 compatibility). v2: runtime config at boot, a
   string catalogue, a command palette, onboarding, and the Admin Studio. */
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './app.css'
import { Ctx } from './context'
import { loadConfig, config, configInfo } from './lib/config'
import { getPreferences, setPreferences, onPreferencesChange, profile, getKv, setKv, primaryProgress } from './lib/store'
import { catalog, onCatalog, type CatalogStory } from './lib/catalog'
import { refreshDownloads } from './lib/downloads'
import { useRoute, navigate } from './lib/router'
import { setLocale, t } from './lib/i18n'
import { hasAdminToken, onAdminChange } from './lib/admin'
import { initPwa, onPwaChange, canInstall, promptInstall, updateReady, applyUpdate, isIos, isStandalone } from './lib/pwa'
import { setAmbient } from './lib/ambient'
import { Shelf } from './features/Shelf'
import { StoryDetail } from './features/StoryDetail'
import { Player } from './features/Player'
import { Collections } from './features/Collections'
import { SettingsView } from './features/Settings'
import { OfflineCentre } from './features/Offline'
import { CommandPalette } from './components/CommandPalette'
import { Shortcuts } from './components/Shortcuts'
import { Onboarding } from './components/Onboarding'
import { SearchIcon, DownloadIcon } from './components/Icons'

const AdminStudio = lazy(() => import('./features/admin/AdminStudio'))
export { useApp } from './context'

function applyPrefsToDocument(p: any) {
  const root = document.documentElement
  const scheme = p.colorScheme === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : p.colorScheme
  root.dataset.scheme = scheme
  root.dataset.contrast = p.contrast
  root.dataset.lineheight = p.lineHeight
  root.dataset.fontmode = p.fontMode
  root.dataset.motion = p.motion === 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : p.motion
  root.style.setProperty('--text-scale', String(p.textScale))
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', scheme === 'dark' ? '#191612' : '#F5F1E8'))
  setLocale(p.locale ?? 'en')
}

function App() {
  const { parts, query } = useRoute()
  const [prefs, setPrefsState] = useState<any>(null)
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([])
  const [ready, setReady] = useState(false)
  const [stories, setStories] = useState<CatalogStory[] | null>(null)
  const [catalogOffline, setCatalogOffline] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<null | 'palette' | 'shortcuts' | 'onboarding'>(null)
  const [admin, setAdmin] = useState(hasAdminToken())
  const [pwa, setPwa] = useState({ install: false, update: false })
  const [installDismissed, setInstallDismissed] = useState(true)
  const [cont, setCont] = useState<{ slug: string; title: string } | null>(null)
  const [contReady, setContReady] = useState(false)
  const gPending = useRef(0)

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts.slice(-2), { id, msg }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3800)
  }, [])

  const refreshCatalog = useCallback(async () => {
    const r = await catalog(true)
    setStories(r.stories); setCatalogOffline(r.offline); setCatalogError(r.offline && !r.stories.length ? r.error ?? 'unreachable' : null)
  }, [])

  useEffect(() => {
    (async () => {
      await loadConfig()
      await profile()
      const p = await getPreferences()
      setPrefsState(p); applyPrefsToDocument(p)
      setInstallDismissed(await getKv('installDismissed', false))
      setReady(true)
      if (!(await getKv('onboarded', false)) && (location.hash === '' || location.hash === '#/')) setOverlay('onboarding')
      const r = await catalog()
      setStories(r.stories); setCatalogOffline(r.offline); setCatalogError(r.offline && !r.stories.length ? r.error ?? 'unreachable' : null)
      if (!r.offline) refreshDownloads(r.stories, toast).catch(() => {})
      const latest = (await primaryProgress())[0]
      const s = latest && r.stories.find((x) => x.storyId === latest.progress.storyId)
      if (s) setCont({ slug: s.slug, title: s.title })
      setContReady(true)
    })()
    initPwa()
    const offPrefs = onPreferencesChange((p: any) => { setPrefsState(p); applyPrefsToDocument(p) })
    const offAdmin = onAdminChange(() => setAdmin(hasAdminToken()))
    const offPwa = onPwaChange(() => setPwa({ install: canInstall(), update: updateReady() }))
    const offCat = onCatalog((s) => setStories(s))
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => getPreferences().then(applyPrefsToDocument)
    mq.addEventListener?.('change', onScheme)
    return () => { (offPrefs as any)(); (offAdmin as any)(); (offPwa as any)(); (offCat as any)(); mq.removeEventListener?.('change', onScheme) }
  }, [])

  // ambient room tone: only with sound on, the switch on, and never in a story
  useEffect(() => {
    if (!prefs) return
    getKv('ambient', false).then((on) => setAmbient(!!on && prefs.sound === 'on' && parts[0] !== 'play'))
  }, [prefs?.sound, parts[0]])

  // global keys — never while typing, never inside a story frame (it has focus then)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOverlay((o) => (o === 'palette' ? null : 'palette')); return }
      if (typing || overlay || e.altKey || e.metaKey || e.ctrlKey) return
      if (e.key === '?') { e.preventDefault(); setOverlay('shortcuts'); return }
      if (e.key === '/' && parts[0] === undefined) { e.preventDefault(); document.getElementById('shelf-search')?.focus(); return }
      if (e.key === 'g') { gPending.current = Date.now(); return }
      if (Date.now() - gPending.current < 1200) {
        const to = ({ s: '/', a: '/collections', o: '/offline', t: '/settings' } as Record<string, string>)[e.key]
        gPending.current = 0
        if (to) { e.preventDefault(); navigate(to) }
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [overlay, parts[0]])

  const ctx = useMemo(() => ({
    prefs,
    async updatePrefs(patch: any) { const next = await setPreferences({ ...prefs, ...patch }); setPrefsState(next) },
    toast,
    openPalette: () => setOverlay('palette'),
    openShortcuts: () => setOverlay('shortcuts'),
    openOnboarding: () => setOverlay('onboarding'),
    stories, catalogOffline, catalogError, refreshCatalog, admin,
  }), [prefs, stories, catalogOffline, catalogError, admin])

  if (!ready) return null

  const route = parts[0] ?? ''
  if (route === 'operator') { navigate('/admin'); return null }
  // PWA shortcut target: jump straight back into the most recent story
  if (route === 'continue') { if (contReady) navigate(cont ? `/play/${cont.slug}` : '/'); return null }
  const inPlayer = route === 'play'
  const nav: [string, string][] = [['', t('nav.shelf')], ['collections', t('nav.archive')], ['offline', t('nav.offline')], ['settings', t('nav.settings')]]
  if (admin) nav.push(['admin', t('nav.admin')])
  const showInstall = !inPlayer && !isStandalone() && !installDismissed && (pwa.install || isIos()) && !!cont
  const dismissInstall = () => { setInstallDismissed(true); setKv('installDismissed', true) }

  return (
    <Ctx.Provider value={ctx}>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>{t('skip')}</a>
      {pwa.update && !inPlayer && (
        <div className="banner" role="status">
          {t('banner.update')}
          <button className="btn small" onClick={applyUpdate}>{t('banner.updateNow')}</button>
        </div>
      )}
      {catalogError && !inPlayer && configInfo().config.storyOrigin !== '/stories-host' && (
        <div className="banner warn" role="alert">{t('banner.config', { origin: config().storyOrigin })}</div>
      )}
      {!inPlayer && (
        <header className="chrome">
          <a className="brand" href="#/"><img src="/icon.svg" alt="" /> {t('app.name')}</a>
          <nav aria-label={t('nav.main')}>
            {nav.map(([r, label]) => (
              <a key={r} href={`#/${r}`} aria-current={route === r ? 'page' : undefined}>{label}</a>
            ))}
          </nav>
          <div className="tools">
            {pwa.install && !isStandalone() && (
              <button className="icon-btn" onClick={() => promptInstall()} aria-label={t('chrome.installLabel')}><DownloadIcon /> <span className="label">{t('chrome.install')}</span></button>
            )}
            <button className="icon-btn" onClick={() => setOverlay('palette')} aria-label={t('chrome.searchLabel')}>
              <SearchIcon /> <span className="label">{t('chrome.search')}</span> <kbd className="label">{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</kbd>
            </button>
          </div>
        </header>
      )}
      {showInstall && (
        <div className="banner" role="region" aria-label={t('chrome.install')}>
          {pwa.install ? t('banner.install') : t('banner.installIos')}
          {pwa.install && <button className="btn small" onClick={() => promptInstall().then(dismissInstall)}>{t('chrome.install')}</button>}
          <button className="btn small secondary" onClick={dismissInstall}>{t('banner.dismiss')}</button>
        </div>
      )}
      <div id="main" tabIndex={-1} style={{ outline: 'none' }}>
        {route === '' && <Shelf />}
        {route === 'story' && <StoryDetail slug={parts[1]} />}
        {route === 'play' && <Player slug={parts[1]} mode={parts[2]} channel={query.get('channel') === 'beta' && admin ? 'beta' : 'production'} />}
        {route === 'collections' && <Collections />}
        {route === 'offline' && <OfflineCentre />}
        {route === 'settings' && <SettingsView />}
        {route === 'admin' && (
          <Suspense fallback={<main className="page"><h1>Admin Studio</h1><p className="lede">Loading…</p></main>}>
            <AdminStudio parts={parts.slice(1)} />
          </Suspense>
        )}
      </div>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((x) => <div key={x.id} className="toast">{x.msg}</div>)}
      </div>
      {overlay === 'palette' && <CommandPalette onClose={() => setOverlay(null)} continueSlug={cont} />}
      {overlay === 'shortcuts' && <Shortcuts onClose={() => setOverlay(null)} />}
      {overlay === 'onboarding' && <Onboarding onDone={() => { setOverlay(null); setKv('onboarded', true) }} />}
    </Ctx.Provider>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
