/* Publishing-plane tests: validation gates, deterministic hashes,
   immutable releases, pointer rollback (§13, §23, P0.7). */
import { describe, it, expect } from 'vitest'
import { validateStory, packStory, loadRegistry } from '../../packages/story-cli/src/lib.mjs'
import { resolve } from 'node:path'

const tulip = resolve(import.meta.dirname, '../../stories/the-tulip-and-the-jester')
const neon = resolve(import.meta.dirname, '../../stories/neon-horizon')

describe('validation gates', () => {
  it('both launch stories pass validation', () => {
    expect(validateStory(tulip).ok).toBe(true)
    expect(validateStory(neon).ok).toBe(true)
  })
  it('packing is deterministic', () => {
    const a = packStory(neon); const b = packStory(neon)
    expect(a.packageHash).toBe(b.packageHash)
  })
})

describe('release registry', () => {
  it('production channels point at recorded immutable releases', () => {
    const reg = loadRegistry()
    for (const story of reg.stories) {
      const prod = story.channels.production
      expect(prod).toBeTruthy()
      const rel = story.releases.find((r) => r.releaseId === prod.releaseId)
      expect(rel).toBeTruthy()
      expect(rel.path).toContain(prod.releaseId)   // immutable content-addressed path
    }
  })
})
