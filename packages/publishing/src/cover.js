/**
 * Deterministic SVG covers from title + palette + motif. Offline-safe (system
 * font stacks, no external refs), 600×800, labelled for screen readers, and
 * contrast-checked: the title must reach 4.5:1 against its backdrop.
 */
import { sha256Hex } from './sha256.js'
import { contrastRatio, bestInk } from './contrast.js'
import { escapeHtml } from './quickbook/markdown.js'

export const COVER_PALETTES = {
  dusk: { bg: '#1b1733', bg2: '#4b2d5e', ink: '#f6e9ff', accent: '#ffb86b' },
  manuscript: { bg: '#2a1d14', bg2: '#5a3a22', ink: '#f3e6c9', accent: '#d8a45a' },
  terminal: { bg: '#0e0a04', bg2: '#2e1c06', ink: '#ffb65c', accent: '#ffd9a0' },
  watercolor: { bg: '#f7f1e8', bg2: '#cfe2ee', ink: '#1f2f3d', accent: '#9a4037' },
  noir: { bg: '#0b0b0c', bg2: '#26262a', ink: '#f2f2f2', accent: '#ff5a4f' },
  minimal: { bg: '#f4f4f1', bg2: '#dfe6f2', ink: '#161616', accent: '#1d58b8' },
  forest: { bg: '#10261d', bg2: '#2b5140', ink: '#eaf4e4', accent: '#e0c96f' },
  sea: { bg: '#0d2436', bg2: '#1f5670', ink: '#e8f6ff', accent: '#8fd3e8' },
}
export const COVER_MOTIFS = ['horizon', 'orbit', 'waves', 'lantern', 'constellation', 'leaf', 'door', 'grid']
const FACES = {
  serif: 'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif',
  sans: '"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace',
}

function rng(seed) {
  let a = parseInt(sha256Hex(String(seed)).slice(0, 8), 16) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const r1 = (n) => Math.round(n * 10) / 10

function wrapTitle(title, max = 15) {
  const words = String(title).trim().split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if (!cur) cur = w
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w
    else { lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 4)
}

function motifSvg(motif, p, rand) {
  const out = []
  switch (motif) {
    case 'orbit': {
      out.push(`<circle cx="300" cy="290" r="${r1(70 + rand() * 20)}" fill="${p.accent}" opacity=".9"/>`)
      for (let i = 0; i < 4; i++) {
        const rx = 130 + i * 38, ry = 40 + i * 16
        out.push(`<ellipse cx="300" cy="290" rx="${rx}" ry="${ry}" fill="none" stroke="${p.ink}" stroke-opacity="${r1(0.5 - i * 0.09)}" stroke-width="1.5" transform="rotate(${r1(-18 + rand() * 8)} 300 290)"/>`)
      }
      for (let i = 0; i < 3; i++) out.push(`<circle cx="${r1(120 + rand() * 360)}" cy="${r1(200 + rand() * 180)}" r="${r1(4 + rand() * 6)}" fill="${p.ink}" opacity=".8"/>`)
      break
    }
    case 'waves': {
      for (let i = 0; i < 8; i++) {
        const y = 170 + i * 36, amp = 10 + rand() * 18, ph = rand() * 6
        let d = `M0 ${r1(y)}`
        for (let x = 0; x <= 600; x += 30) d += ` L${x} ${r1(y + Math.sin(x / 70 + ph) * amp)}`
        out.push(`<path d="${d}" fill="none" stroke="${i % 3 === 0 ? p.accent : p.ink}" stroke-opacity="${r1(0.25 + i * 0.07)}" stroke-width="${r1(1.5 + i * 0.25)}"/>`)
      }
      break
    }
    case 'lantern': {
      out.push(`<circle cx="300" cy="300" r="170" fill="url(#glow)"/>`)
      out.push(`<path d="M300 150v36" stroke="${p.ink}" stroke-width="3"/><path d="M262 196h76l-8 22h-60z" fill="${p.ink}"/>`)
      out.push(`<rect x="258" y="218" width="84" height="120" rx="10" fill="none" stroke="${p.ink}" stroke-width="4"/>`)
      out.push(`<path d="M300 250c16 22 20 34 20 46a20 20 0 0 1-40 0c0-12 4-24 20-46z" fill="${p.accent}"/>`)
      out.push(`<path d="M262 338h76l8 20h-92z" fill="${p.ink}"/>`)
      break
    }
    case 'constellation': {
      const pts = Array.from({ length: 9 }, () => [r1(90 + rand() * 420), r1(110 + rand() * 330)])
      out.push(`<path d="M${pts.map((q) => q.join(' ')).join(' L')}" fill="none" stroke="${p.ink}" stroke-opacity=".4" stroke-width="1.2"/>`)
      for (const [x, y] of pts) out.push(`<circle cx="${x}" cy="${y}" r="${r1(2.5 + rand() * 4)}" fill="${rand() > 0.7 ? p.accent : p.ink}"/>`)
      for (let i = 0; i < 40; i++) out.push(`<circle cx="${r1(rand() * 600)}" cy="${r1(rand() * 470)}" r="${r1(0.6 + rand() * 1.2)}" fill="${p.ink}" opacity="${r1(0.3 + rand() * 0.5)}"/>`)
      break
    }
    case 'leaf': {
      out.push(`<path d="M300 440C170 360 170 200 300 110c130 90 130 250 0 330z" fill="${p.accent}" opacity=".85"/>`)
      out.push(`<path d="M300 440V120" stroke="${p.bg}" stroke-width="4"/>`)
      for (let i = 0; i < 6; i++) {
        const y = 170 + i * 44
        out.push(`<path d="M300 ${y + 26}l${r1(-60 + i * 4)} -${r1(34 - i * 2)}M300 ${y + 26}l${r1(60 - i * 4)} -${r1(34 - i * 2)}" stroke="${p.bg}" stroke-width="3" fill="none"/>`)
      }
      break
    }
    case 'door': {
      out.push(`<path d="M210 460V250a90 90 0 0 1 180 0v210z" fill="${p.bg}" stroke="${p.ink}" stroke-width="4"/>`)
      out.push(`<path d="M232 460V256a68 68 0 0 1 136 0v204z" fill="url(#glow)"/>`)
      out.push(`<path d="M232 460L120 520h360l-112-60z" fill="${p.accent}" opacity=".35"/>`)
      out.push(`<circle cx="350" cy="370" r="6" fill="${p.ink}"/>`)
      break
    }
    case 'grid': {
      out.push(`<circle cx="300" cy="250" r="110" fill="${p.accent}"/>`)
      for (let i = 0; i < 5; i++) out.push(`<rect x="170" y="${260 + i * 18}" width="260" height="${6 + i * 2}" fill="${p.bg}"/>`)
      for (let i = 0; i <= 12; i++) out.push(`<line x1="300" y1="360" x2="${-300 + i * 100}" y2="480" stroke="${p.ink}" stroke-opacity=".45"/>`)
      for (let i = 0; i < 6; i++) { const y = 360 + (i * i + i) * 3.6; out.push(`<line x1="0" y1="${r1(y)}" x2="600" y2="${r1(y)}" stroke="${p.ink}" stroke-opacity=".45"/>`) }
      break
    }
    default: { // horizon
      out.push(`<circle cx="${r1(220 + rand() * 160)}" cy="300" r="${r1(80 + rand() * 30)}" fill="${p.accent}" opacity=".95"/>`)
      for (let layer = 0; layer < 3; layer++) {
        let d = `M0 ${400 + layer * 24}`
        let x = 0
        while (x < 600) { x += 40 + rand() * 60; d += ` L${r1(Math.min(x, 600))} ${r1(330 + layer * 30 + rand() * 50)}` }
        d += ` L600 480 L0 480z`
        out.push(`<path d="${d}" fill="${p.bg}" opacity="${r1(0.55 + layer * 0.2)}"/>`)
      }
      out.push(`<line x1="40" y1="480" x2="560" y2="480" stroke="${p.ink}" stroke-opacity=".5"/>`)
    }
  }
  return out.join('')
}

/**
 * @param {{ title:string, subtitle?:string, author?:string, palette?:string|object, motif?:string, typeface?:'serif'|'sans'|'mono', seed?:string }} o
 * @returns {{ svg:string, contrast:{ title:number, subtitle:number }, ok:boolean, palette:object }}
 */
export function generateCover({ title, subtitle = '', author = '', palette = 'dusk', motif = 'horizon', typeface = 'serif', seed }) {
  const p = { ...(typeof palette === 'string' ? COVER_PALETTES[palette] ?? COVER_PALETTES.dusk : palette) }
  const rand = rng(seed ?? `${title}|${motif}|${JSON.stringify(p)}`)
  const lines = wrapTitle(title || 'Untitled')
  const longest = Math.max(...lines.map((l) => l.length))
  const size = Math.round(Math.min(64, 500 / (longest * 0.56)))
  const face = FACES[typeface] ?? FACES.serif
  const titleY = 600 - ((lines.length - 1) * size * 1.1) / 2
  const text = lines.map((l, i) => `<tspan x="300" y="${r1(titleY + i * size * 1.1)}">${escapeHtml(l)}</tspan>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800" role="img" aria-label="${escapeHtml(`Cover of ${title}${subtitle ? ' — ' + subtitle : ''}`)}">`
    + `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.bg2}"/><stop offset=".62" stop-color="${p.bg}"/></linearGradient>`
    + `<radialGradient id="glow"><stop offset="0" stop-color="${p.accent}" stop-opacity=".75"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient></defs>`
    + `<rect width="600" height="800" fill="url(#sky)"/>`
    + motifSvg(motif, p, rand)
    + `<rect x="0" y="500" width="600" height="300" fill="${p.bg}" opacity=".94"/>`
    + `<line x1="250" y1="520" x2="350" y2="520" stroke="${p.accent}" stroke-width="2"/>`
    + `<text text-anchor="middle" font-family='${face}' font-size="${size}" fill="${p.ink}">${text}</text>`
    + (subtitle ? `<text x="300" y="${r1(titleY + lines.length * size * 1.1 + 18)}" text-anchor="middle" font-family='${face}' font-size="18" letter-spacing="3" fill="${p.accent}">${escapeHtml(subtitle.toUpperCase().slice(0, 48))}</text>` : '')
    + (author ? `<text x="300" y="770" text-anchor="middle" font-family='${face}' font-size="16" letter-spacing="2" fill="${p.ink}" opacity=".85">${escapeHtml(author.slice(0, 48))}</text>` : '')
    + `</svg>`
  const contrast = { title: contrastRatio(p.ink, p.bg), subtitle: subtitle ? contrastRatio(p.accent, p.bg) : 21 }
  return { svg, contrast, ok: contrast.title >= 4.5 && contrast.subtitle >= 4.5, palette: p, suggestion: contrast.title < 4.5 ? bestInk(p.bg) : null }
}
