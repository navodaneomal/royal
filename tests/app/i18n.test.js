/* Every t('key') used by the reader shell exists in the English catalogue. */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { REPO } from '../helpers/index.js'

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p] })

describe('string catalogue', () => {
  it('has every key the shell asks for', async () => {
    const en = (await import('../../apps/web/src/i18n/en.ts')).default
    const src = join(REPO, 'apps/web/src')
    const used = new Set()
    for (const file of walk(src).filter((f) => /\.tsx?$/.test(f))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([\w.]+)'/g)) used.add(m[1])
    }
    // `t('rating.' + value)` style prefixes: every value the code can produce must exist
    const dynamic = { 'rating.': ['everyone', 'teen', 'mature'], 'status.': ['unread', 'inProgress', 'finished'] }
    const missing = [...used].flatMap((k) => (k.endsWith('.') ? (dynamic[k] ?? ['?']).map((v) => k + v) : [k])).filter((k) => !(k in en))
    expect(missing).toEqual([])
    expect(used.size).toBeGreaterThan(150)
  })
})
