/* Shell accent themes — the reader's own tint for the furniture (stories
   keep their own looks). Every value is a TEXT-safe colour: tests/app/
   themes.test.ts checks each one against every surface in app.css
   (≥4.5:1, and ≥7:1 for the more-contrast variants). Brass is the default
   and leaves app.css in charge (no inline overrides at all). */
export type AccentKey = 'brass' | 'indigo' | 'forest' | 'rose' | 'plum'
type Accent = { label: string; light: string; dark: string; moreLight: string; moreDark: string; deco: string; decoDark: string }

export const ACCENTS: Record<AccentKey, Accent> = {
  brass:  { label: 'Brass',  light: '#85601C', dark: '#D9AE5E', moreLight: '#5C4010', moreDark: '#EECB85', deco: '#C29445', decoDark: '#A87F38' },
  indigo: { label: 'Indigo', light: '#3F51A8', dark: '#9EAEF5', moreLight: '#2A3780', moreDark: '#C3CDFA', deco: '#7F8FD8', decoDark: '#5D6DB8' },
  forest: { label: 'Forest', light: '#2F6B48', dark: '#84C9A0', moreLight: '#1F4F33', moreDark: '#B2E2C4', deco: '#6AA884', decoDark: '#4F8A68' },
  rose:   { label: 'Rose',   light: '#A23A55', dark: '#F09AB0', moreLight: '#7A2640', moreDark: '#F7C3D0', deco: '#D7849A', decoDark: '#B4627A' },
  plum:   { label: 'Plum',   light: '#7341A0', dark: '#C9A4EE', moreLight: '#55297D', moreDark: '#DFC8F6', deco: '#A982D0', decoDark: '#8763AE' },
}
export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[]

export function accentValue(key: AccentKey, scheme: 'light' | 'dark', contrast: 'normal' | 'more') {
  const a = ACCENTS[key] ?? ACCENTS.brass
  if (contrast === 'more') return scheme === 'dark' ? a.moreDark : a.moreLight
  return scheme === 'dark' ? a.dark : a.light
}

let current: AccentKey = 'brass'
export const currentAccent = () => current

/** Apply to <html>. Brass removes every override so app.css stays the source of truth. */
export function applyAccent(key: AccentKey = current) {
  current = ACCENTS[key] ? key : 'brass'
  const root = document.documentElement
  const props = ['--brass', '--brass-2', '--focus']
  if (current === 'brass') { props.forEach((p) => root.style.removeProperty(p)); return }
  const scheme = root.dataset.scheme === 'dark' ? 'dark' : 'light'
  const contrast = root.dataset.contrast === 'more' ? 'more' : 'normal'
  const a = ACCENTS[current]
  root.style.setProperty('--brass', accentValue(current, scheme, contrast))
  root.style.setProperty('--brass-2', scheme === 'dark' ? a.decoDark : a.deco)
  root.style.setProperty('--focus', scheme === 'dark' ? a.dark : a.deco)
}
