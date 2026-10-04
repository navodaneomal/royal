/* Every text colour the shell can show — inks, status colours, and the five
   reader-selectable accents — holds contrast on every surface, read straight
   from app.css: ≥4.5:1 normally, ≥7:1 in more-contrast. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contrastRatio } from '@storyframe/publishing'
import { ACCENTS, ACCENT_KEYS } from '../../apps/web/src/lib/themes'
import { REPO } from '../helpers/index.js'

const css = readFileSync(join(REPO, 'apps/web/src/app.css'), 'utf8')
const block = (selector: string) => {
  const i = css.indexOf(selector + ' {')
  return css.slice(i, css.indexOf('}', i))
}
const tokens = (b: string) => Object.fromEntries([...b.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]))
const light = tokens(block(':root'))
const dark = { ...light, ...tokens(block('[data-scheme="dark"]')) }
const moreLight = { ...light, ...tokens(block('[data-contrast="more"]')) }
const moreDark = { ...dark, ...tokens(block('[data-scheme="dark"][data-contrast="more"]')) }
const SURFACES = ['paper', 'paper-2', 'card']
const worst = (fg: string, set: Record<string, string>) => Math.min(...SURFACES.map((s) => contrastRatio(fg, set[s])))

describe('shell colours', () => {
  it('reads the surfaces from app.css', () => {
    for (const set of [light, dark]) for (const s of SURFACES) expect(set[s]).toMatch(/^#[0-9A-F]{6}$/i)
    expect(light.paper).not.toBe(dark.paper)
  })
  for (const [name, set, min] of [['light', light, 4.5], ['dark', dark, 4.5], ['more (light)', moreLight, 7], ['more (dark)', moreDark, 7]] as const) {
    it(`inks and status colours hold ${min}:1 on every ${name} surface`, () => {
      for (const k of ['ink', 'ink-2', 'ink-3', 'brass', 'good', 'warn', 'bad', 'info']) {
        expect([k, +worst(set[k], set).toFixed(2)]).toEqual([k, expect.any(Number)])
        expect(worst(set[k], set), `${k} on ${name}`).toBeGreaterThanOrEqual(min)
      }
    })
  }
  for (const key of ACCENT_KEYS) {
    it(`accent "${key}" is text-safe in light, dark, and both more-contrast modes`, () => {
      const a = ACCENTS[key]
      expect(worst(a.light, light)).toBeGreaterThanOrEqual(4.5)
      expect(worst(a.dark, dark)).toBeGreaterThanOrEqual(4.5)
      expect(worst(a.moreLight, moreLight)).toBeGreaterThanOrEqual(7)
      expect(worst(a.moreDark, moreDark)).toBeGreaterThanOrEqual(7)
      // filled accent buttons: on-accent text (white in light, near-black in dark)
      expect(contrastRatio('#FFFFFF', a.light)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(dark.paper, a.dark)).toBeGreaterThanOrEqual(4.5)
    })
  }
  it('brass in themes.ts matches the app.css default (no drift)', () => {
    expect(ACCENTS.brass.light.toLowerCase()).toBe(light.brass.toLowerCase())
    expect(ACCENTS.brass.dark.toLowerCase()).toBe(dark.brass.toLowerCase())
    expect(ACCENTS.brass.moreLight.toLowerCase()).toBe(moreLight.brass.toLowerCase())
    expect(ACCENTS.brass.moreDark.toLowerCase()).toBe(moreDark.brass.toLowerCase())
  })
})
