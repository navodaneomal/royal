import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { sha256Hex } from '@storyframe/publishing'

const node = (b) => createHash('sha256').update(b).digest('hex')

describe('isomorphic sha256', () => {
  it('matches node:crypto on edge-length inputs', () => {
    for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 65537]) {
      const bytes = new Uint8Array(n).map((_, i) => (i * 31 + 7) & 255)
      expect(sha256Hex(bytes)).toBe(node(bytes))
    }
  })
  it('hashes strings as UTF-8', () => {
    expect(sha256Hex('Storyframe — ✦ 物語')).toBe(node(Buffer.from('Storyframe — ✦ 物語', 'utf8')))
  })
})
