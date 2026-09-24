/** WCAG 2.x relative luminance and contrast ratio for #rgb / #rrggbb colours. */
export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
export function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b)
  if (la === null || lb === null) return 0
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}
/** Pick whichever of two inks reads better on `bg`. */
export const bestInk = (bg, a = '#111111', b = '#ffffff') => (contrastRatio(bg, a) >= contrastRatio(bg, b) ? a : b)
