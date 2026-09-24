/* One contract everywhere: the edge function's copy of the protocol must be
   byte-identical to packages/protocol/src (run `npm run protocol:sync`). */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { REPO } from '../helpers/index.js'

describe('supabase/_shared/protocol', () => {
  it('is a verbatim copy of packages/protocol/src', () => {
    const src = resolve(REPO, 'packages/protocol/src')
    const copy = resolve(REPO, 'supabase/functions/_shared/protocol')
    expect(readdirSync(copy).sort()).toEqual(readdirSync(src).sort())
    for (const f of readdirSync(src)) expect(readFileSync(resolve(copy, f), 'utf8'), f).toBe(readFileSync(resolve(src, f), 'utf8'))
  })
})
