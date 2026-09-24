/* i18n-ready shell: every reader-facing string lives in a catalogue keyed by
   id (src/i18n/<locale>.ts). English ships; adding a language is one file
   plus one line in CATALOGUES. The Admin Studio is an operator tool and is
   English-only by design. */
import en from '../i18n/en'

type Catalogue = Record<string, string>
const CATALOGUES: Record<string, Catalogue> = { en }
let locale = 'en'

export const LOCALES = Object.keys(CATALOGUES)
export function setLocale(next: string) {
  locale = CATALOGUES[next] ? next : (CATALOGUES[next.split('-')[0]] ? next.split('-')[0] : 'en')
  document.documentElement.lang = locale
}
export const currentLocale = () => locale

/** t('shelf.position', { label, n, total }) — {name} placeholders. */
export function t(key: string, vars?: Record<string, string | number>) {
  const s = CATALOGUES[locale]?.[key] ?? en[key] ?? key
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : s
}

export const fmtDate = (iso: string | number | Date) => {
  try { return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso) }
}
export const fmtBytes = (n: number) =>
  n >= 1024 * 1024 * 1024 ? `${(n / 1024 / 1024 / 1024).toFixed(1)} GB` : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
