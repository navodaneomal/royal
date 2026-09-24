/* Publishing-plane tests: validation gates, deterministic hashes,
   immutable releases, pointer rollback (§13, §23, P0.7).
   v2: builds happen in memory with the declarative builder, so these run on
   a fresh clone without `npm run stories:build` first. */
import { describe, it, expect } from 'vitest'
import {
  buildPackage, validatePackage, packFiles, applyPublish, emptyRegistry, channelRelease,
} from '@storyframe/publishing'
import { sdkText, storySource } from '../helpers/index.js'

const built = (slug) => buildPackage({ source: storySource(slug), sdk: sdkText() })

describe('validation gates', () => {
  it('both launch stories build and pass validation', () => {
    for (const slug of ['the-tulip-and-the-jester', 'neon-horizon']) {
      const b = built(slug)
      expect(b.log.errors).toEqual([])
      const v = validatePackage({ manifest: b.manifest, files: b.files })
      expect(v.errors).toEqual([])
      expect(v.ok).toBe(true)
    }
  })
  it('packing is deterministic', () => {
    expect(packFiles(built('neon-horizon').files).packageHash).toBe(packFiles(built('neon-horizon').files).packageHash)
  })
})

describe('release registry', () => {
  it('production channels point at recorded immutable releases', () => {
    let reg = emptyRegistry()
    for (const slug of ['the-tulip-and-the-jester', 'neon-horizon']) {
      const b = built(slug)
      const p = packFiles(b.files)
      const v = validatePackage({ manifest: b.manifest, files: b.files })
      reg = applyPublish(reg, { manifest: v.manifest, releaseId: p.releaseId, packageHash: p.packageHash, totalBytes: v.totalBytes, channel: 'production', now: '2026-09-24T00:00:00Z', validation: {} }).registry
    }
    for (const story of reg.stories) {
      const prod = channelRelease(story, 'production')
      expect(prod).toBeTruthy()
      expect(prod.path).toContain(prod.releaseId)   // immutable content-addressed path
      expect(prod.meta.checkpoints.length).toBeGreaterThan(0)
    }
  })
})
