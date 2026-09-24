/* Accent colour per book — the Continue hero is tinted with it. Prefers the
   manifest's declared `accent`; otherwise samples the cover (CORS-enabled
   story host ⇒ an untainted canvas). Always returns a colour that holds
   ≥ 4.5:1 against the shell's paper, darkening/lightening as needed. */
import { contrastRatio } from '@storyframe/publishing'

const cache = new Map<string, string>()
const FALLBACK = '#8A6420'

const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

/** Nudge a colour until it reads on `bg` (≥ 4.5:1). */
export function readableOn(hex: string, bg: string) {
  let [r, g, b] = hexRgb(hex)
  const dark = contrastRatio('#000000', bg) > contrastRatio('#ffffff', bg)
  for (let i = 0; i < 24 && contrastRatio(toHex(r, g, b), bg) < 4.5; i++) {
    const f = dark ? 0.88 : 1.12
    ;[r, g, b] = dark ? [r * f, g * f, b * f] : [r * f + 12, g * f + 12, b * f + 12]
  }
  return toHex(r, g, b)
}

async function sample(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = 24; c.height = 32
        const ctx = c.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(img, 0, 0, 24, 32)
        const d = ctx.getImageData(0, 0, 24, 32).data
        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < d.length; i += 4) {
          const [pr, pg, pb] = [d[i], d[i + 1], d[i + 2]]
          const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb)
          const sat = max ? (max - min) / max : 0
          if (sat < 0.25 || max < 40) continue          // skip greys and near-black
          const w = sat * sat
          r += pr * w; g += pg * w; b += pb * w; n += w
        }
        resolve(n ? toHex(r / n, g / n, b / n) : null)
      } catch { resolve(null) }                      // tainted canvas etc.
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export async function accentFor(key: string, declared: string | null | undefined, coverUrl: string) {
  if (cache.has(key)) return cache.get(key)!
  const valid = declared && /^#[0-9a-f]{6}$/i.test(declared) ? declared : null
  const found = valid ?? (await sample(coverUrl)) ?? FALLBACK
  cache.set(key, found)
  return found
}
