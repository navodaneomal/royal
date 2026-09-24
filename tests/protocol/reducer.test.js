/* Contract tests for the progress reducer — the rules every plane shares. */
import { describe, it, expect } from 'vitest'
import { applyMutation, buildRegistry, emptySnapshot, unionMerge } from '@storyframe/protocol'
import { ManifestSchema, validateEnvelope, HelloSchema, MAX_MESSAGE_BYTES } from '@storyframe/protocol'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const manifest = ManifestSchema.parse(JSON.parse(readFileSync(
  resolve(import.meta.dirname, '../../stories/neon-horizon/storyframe.json'), 'utf8',
)))
const registry = buildRegistry(manifest)
const base = () => emptySnapshot(manifest)

describe('atomic mutations', () => {
  it('applies checkpoint + items + achievements as one unit', () => {
    const r = applyMutation(base(), {
      type: 'puzzle_completed', puzzleId: 'alignment', checkpointId: 'aligned',
      set: { aligned: true }, grantItems: [{ itemId: 'coil', quantity: 1 }],
      unlockAchievements: ['clean-signal'],
    }, registry)
    expect(r.ok).toBe(true)
    expect(r.snapshot.checkpointId).toBe('aligned')
    expect(r.snapshot.inventory.coil.quantity).toBe(1)
    expect(r.snapshot.achievements).toContain('clean-signal')
    expect(r.effects.items).toEqual(['coil'])
  })

  it('rejects the WHOLE mutation when any reference is unknown', () => {
    const r = applyMutation(base(), {
      type: 'puzzle_completed', checkpointId: 'aligned',
      grantItems: [{ itemId: 'not-a-real-item', quantity: 1 }],
      unlockAchievements: ['clean-signal'],
    }, registry)
    expect(r.ok).toBe(false)
    expect(r.code).toBe('unknown_item')
    // and nothing partial happened — caller keeps the old snapshot untouched
  })

  it('never grants duplicate achievements', () => {
    const first = applyMutation(base(), { type: 'state_patch', unlockAchievements: ['listener'] }, registry)
    const second = applyMutation(first.snapshot, { type: 'state_patch', unlockAchievements: ['listener'] }, registry)
    expect(second.ok).toBe(true)
    expect(second.snapshot.achievements.filter((a) => a === 'listener')).toHaveLength(1)
    expect(second.effects.achievements).toHaveLength(0)   // no re-unlock effect
  })

  it('refuses to silently flip a committed canonical choice (§15.5)', () => {
    const chose = applyMutation(base(), {
      type: 'choice_committed', choiceId: 'final-call', choiceOption: 'stay',
    }, registry)
    expect(chose.ok).toBe(true)
    const flip = applyMutation(chose.snapshot, {
      type: 'choice_committed', choiceId: 'final-call', choiceOption: 'transmit',
    }, registry)
    expect(flip.ok).toBe(false)
    expect(flip.code).toBe('choice_already_committed')
  })

  it('rejects unknown choice options', () => {
    const r = applyMutation(base(), {
      type: 'choice_committed', choiceId: 'final-call', choiceOption: 'run-away',
    }, registry)
    expect(r.ok).toBe(false)
    expect(r.code).toBe('unknown_choice_option')
  })

  it('records endings and marks hint levels monotonically', () => {
    const a = applyMutation(base(), { type: 'ending', endingId: 'kept-company', checkpointId: 'decided', hintLevel: { puzzleId: 'alignment', level: 2 } }, registry)
    expect(a.ok).toBe(true)
    const b = applyMutation(a.snapshot, { type: 'state_patch', hintLevel: { puzzleId: 'alignment', level: 1 } }, registry)
    expect(b.snapshot.hintLevelByPuzzle.alignment).toBe(2)  // hints never regress
  })

  it('strips nothing it should keep and validates the result', () => {
    const r = applyMutation(base(), { type: 'state_patch', set: { listens: 3, node: 'hall' }, visit: ['hall'] }, registry)
    expect(r.ok).toBe(true)
    expect(r.snapshot.visitedMoments).toContain('hall')
  })
})

describe('divergence merge rules', () => {
  it('unions discoveries but never touches checkpoint or choices', () => {
    const a = applyMutation(base(), { type: 'discovery', grantItems: [{ itemId: 'logbook-page', quantity: 1 }] }, registry).snapshot
    const b = applyMutation(base(), { type: 'state_patch', unlockAchievements: ['listener'] }, registry).snapshot
    const merged = unionMerge(a, b)
    expect(merged.inventory['logbook-page']).toBeTruthy()
    expect(merged.achievements).toContain('listener')
    expect(merged.checkpointId).toBe(a.checkpointId)
  })
})

describe('bridge envelope validation', () => {
  const good = () => ({
    protocol: '1.0', type: 'PROGRESS_COMMIT', messageId: crypto.randomUUID(),
    sessionId: 'sess-abcdefgh', storyId: manifest.storyId, releaseId: 'r123456789012',
    sequence: 1, sentAt: new Date().toISOString(), payload: {},
  })
  const expect_ = { storyId: manifest.storyId, releaseId: 'r123456789012', sessionId: 'sess-abcdefgh' }

  it('accepts a well-formed envelope', () => {
    expect(validateEnvelope(good(), { expect: expect_ }).ok).toBe(true)
  })
  it('rejects wrong story / release / session ids', () => {
    expect(validateEnvelope({ ...good(), storyId: crypto.randomUUID() }, { expect: expect_ }).code).toBe('story_mismatch')
    expect(validateEnvelope({ ...good(), releaseId: 'rdeadbeef0000' }, { expect: expect_ }).code).toBe('release_mismatch')
    expect(validateEnvelope({ ...good(), sessionId: 'sess-stolen00' }, { expect: expect_ }).code).toBe('session_mismatch')
  })
  it('rejects malformed and oversized payloads', () => {
    expect(validateEnvelope({ hello: 'world' }, { expect: expect_ }).ok).toBe(false)
    const big = { ...good(), payload: { blob: 'x'.repeat(MAX_MESSAGE_BYTES) } }
    expect(validateEnvelope(big, { expect: expect_ }).code).toBe('oversized')
  })
  it('hello schema refuses short nonces and junk', () => {
    expect(HelloSchema.safeParse({ type: 'STORYFRAME_HELLO', protocol: '1.0', storyId: manifest.storyId, releaseId: 'r1', nonce: 'short' }).success).toBe(false)
  })
})

import { planImport, unknownSnapshotIds } from '@storyframe/protocol'
describe('cloud import planning (shared by app + edge function)', () => {
  it('imports when the account has nothing, merges discoveries otherwise, archives the loser', () => {
    const guest = applyMutation(base(), { type: 'discovery', grantItems: [{ itemId: 'logbook-page', quantity: 1 }] }, registry).snapshot
    expect(planImport(null, guest).action).toBe('import')
    const server = applyMutation(base(), { type: 'checkpoint', checkpointId: 'aligned', unlockAchievements: ['listener'] }, registry).snapshot
    const up = planImport(server, guest, 'upgrade')
    expect(up.action).toBe('merge')
    expect(up.snapshot.checkpointId).toBe('aligned')              // the account's timeline stays canonical
    expect(up.snapshot.inventory['logbook-page']).toBeTruthy()    // guest discoveries union in
    expect(up.archive).toEqual(guest)                             // and the guest snapshot is kept
    const rep = planImport(server, guest, 'replace')
    expect(rep).toMatchObject({ action: 'replace', snapshot: guest, archive: server })
    expect(planImport(server, structuredClone(server)).action).toBe('unchanged')
  })
  it('refuses snapshots that mention IDs the release does not have', () => {
    const snap = { ...base(), inventory: { ghost: { quantity: 1, discoveredAt: 'x' } }, committedChoices: { 'final-call': 'fly' } }
    expect(unknownSnapshotIds(snap, manifest)).toEqual(['item:ghost', 'choice:final-call=fly'])
    expect(unknownSnapshotIds(base(), manifest)).toEqual([])
  })
})
