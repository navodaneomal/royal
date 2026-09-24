/* Hash routing — every screen survives refresh on any static host (§25).
   #/play/neon-horizon?channel=beta → { parts: ['play','neon-horizon'], query } */
import { useEffect, useState } from 'react'

export type Route = { hash: string; parts: string[]; query: URLSearchParams }

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '')
  const [path, qs = ''] = raw.split('?')
  return { hash, parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs) }
}

export function useRoute(): Route {
  const [hash, setHash] = useState(location.hash || '#/')
  useEffect(() => {
    const on = () => setHash(location.hash || '#/')
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return parseHash(hash)
}

export const navigate = (path: string) => { location.hash = path.startsWith('#') ? path : '#' + path }
