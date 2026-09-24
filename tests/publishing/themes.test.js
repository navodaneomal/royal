/* Every theme token pair a reader actually reads must clear WCAG AA —
   body ink ≥ 7:1 (AAA for long-form prose), muted + accent ≥ 4.5:1 —
   in the normal, dark (minimal), and more-contrast variants. */
import { describe, it, expect } from 'vitest'
import { THEMES, contrastRatio, generateCover, COVER_PALETTES } from '@storyframe/publishing'

const variants = (t) => {
  const out = [['normal', t.tokens]]
  if (t.dark) out.push(['dark', { ...t.tokens, ...t.dark }])
  out.push(['more', { ...t.tokens, ...t.more }])
  if (t.moreDark) out.push(['more+dark', { ...t.tokens, ...t.dark, ...t.moreDark }])
  return out
}

describe('Quick Book theme contrast', () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    for (const [variant, tk] of variants(theme)) {
      it(`${name} (${variant})`, () => {
        for (const bg of [tk.bg, tk.surface]) {
          expect(contrastRatio(tk.ink, bg)).toBeGreaterThanOrEqual(7)
          expect(contrastRatio(tk.muted, bg)).toBeGreaterThanOrEqual(4.5)
          expect(contrastRatio(tk.accent, bg)).toBeGreaterThanOrEqual(4.5)
        }
        expect(contrastRatio(tk.accentInk ?? theme.tokens.accentInk, tk.accent)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe('generated covers', () => {
  it('every preset palette gives the title ≥ 4.5:1', () => {
    for (const palette of Object.keys(COVER_PALETTES)) {
      const c = generateCover({ title: 'A Long Enough Title To Wrap', subtitle: 'sub', palette, motif: 'waves' })
      expect(c.ok, palette).toBe(true)
      expect(c.svg).toMatch(/^<svg[^>]+role="img"[^>]+aria-label="Cover of A Long Enough Title To Wrap/)
      expect(c.svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/)
    }
  })
  it('is deterministic and flags a low-contrast custom palette', () => {
    expect(generateCover({ title: 'X', motif: 'constellation' }).svg).toBe(generateCover({ title: 'X', motif: 'constellation' }).svg)
    const bad = generateCover({ title: 'X', palette: { bg: '#777777', bg2: '#888888', ink: '#8a8a8a', accent: '#999999' } })
    expect(bad.ok).toBe(false)
    expect(bad.suggestion).toMatch(/^#/)
  })
})
