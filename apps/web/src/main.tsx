/* Storyframe reader shell — hash-routed so every screen survives refresh
   on any static host (§25 compatibility). */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './app.css'
import { getPreferences, setPreferences, onPreferencesChange, profile } from './lib/store'
import { Shelf } from './features/Shelf'
import { StoryDetail } from './features/StoryDetail'
import { Player } from './features/Player'
import { Collections } from './features/Collections'
import { SettingsView } from './features/Settings'
import { OperatorView } from './features/Operator'

/* ── app context: preferences + toast ───────────────────────────────── */
const Ctx = createContext<any>(null)
export const useApp = () => useContext(Ctx)

function useHashRoute() {
  const [hash, setHash] = useState(location.hash || '#/')
  useEffect(() => {
    const on = () => setHash(location.hash || '#/')
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  const parts = hash.replace(/^#\//, '').split('/').filter(Boolean)
  return { hash, parts }
}

function applyPrefsToDocument(p: any) {
  const root = document.documentElement
  const scheme = p.colorScheme === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : p.colorScheme
  root.dataset.scheme = scheme
  root.dataset.contrast = p.contrast
  root.dataset.lineheight = p.lineHeight
  root.dataset.fontmode = p.fontMode
  root.style.setProperty('--text-scale', String(p.textScale))
}

function App() {
  const { parts } = useHashRoute()
  const [prefs, setPrefsState] = useState<any>(null)
  const [toast, setToast] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    (async () => {
      await profile()
      const p = await getPreferences()
      setPrefsState(p); applyPrefsToDocument(p); setReady(true)
    })()
    return onPreferencesChange((p: any) => { setPrefsState(p); applyPrefsToDocument(p) }) as any
  }, [])

  useEffect(() =>

    { if (!toast) return; const t = setTimeout(() => setToast(''), 3600); return () => clearTimeout(t) }, [toast])

  const ctx = useMemo(() => ({
    prefs,
    async updatePrefs(patch: any) { const next = await setPreferences({ ...prefs, ...patch }); setPrefsState(next) },
    toast: (m: string) => setToast(m),
  }), [prefs])

  if (!ready) return null

  const inPlayer = parts[0] === 'play'
  const route = parts[0] ?? ''
  const nav = [
    ['', 'Shelf'], ['collections', 'Archive'], ['settings', 'Settings'], ['operator', 'Operator'],
  ] as const

  return (
    <Ctx.Provider value={ctx}>
      <a className="skip" href="#main">Skip to content</a>
      {!inPlayer && (
        <header className="chrome">
          <a className="brand" href="#/"><img src="/icon.svg" alt="" /> Storyframe</a>
          <nav aria-label="Main">
            {nav.map(([r, label]) => (
              <a key={r} href={`#/${r}`} aria-current={route === r ? 'page' : undefined}>{label}</a>
            ))}
          </nav>
        </header>
      )}
      <div id="main">
        {route === '' && <Shelf />}
        {route === 'story' && <StoryDetail slug={parts[1]} />}
        {route === 'play' && <Player slug={parts[1]} mode={parts[2]} />}
        {route === 'collections' && <Collections />}
        {route === 'settings' && <SettingsView />}
        {route === 'operator' && <OperatorView />}
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </Ctx.Provider>
  )
}

if ('serviceWorker' in navigator && !location.port.startsWith('517')) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

createRoot(document.getElementById('root')!).render(<App />)
