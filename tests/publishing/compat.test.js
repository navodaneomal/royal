/* Compatibility checker + migration map: renaming IDs must never strand a
   reader, and the reducer must carry their snapshot across. */
import { describe, it, expect } from 'vitest'
import { checkCompatibility, diffManifests } from '@storyframe/publishing'
import { ManifestSchema, emptySnapshot, applyMutation, buildRegistry, migrateSnapshot, composeMigrations } from '@storyframe/protocol'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { REPO } from '../helpers/index.js'

const v1 = ManifestSchema.parse(JSON.parse(readFileSync(resolve(REPO, 'stories/neon-horizon/storyframe.json'), 'utf8')))
const clone = () => structuredClone(v1)

/** v2 renames checkpoint hall→relay-hall, item coil→copper-coil, option stay→keep-company */
function renamed({ bump = true, migrate = true } = {}) {
  const m = clone()
  m.version = '2.0.0'
  m.checkpoints = m.checkpoints.map((c) => (c.id === 'hall' ? { ...c, id: 'relay-hall' } : c))
  m.items = m.items.map((i) => (i.id === 'coil' ? { ...i, id: 'copper-coil' } : i.spoilerCheckpoint === 'hall' ? { ...i, spoilerCheckpoint: 'relay-hall' } : i))
  m.choices = [{ ...m.choices[0], options: ['transmit', 'keep-company'] }]
  if (bump) m.stateSchemaVersion = 2
  if (migrate) m.migrations = [{ from: 1, to: 2, checkpoints: { hall: 'relay-hall' }, items: { coil: 'copper-coil' }, achievements: {}, choices: {}, choiceOptions: { 'final-call': { stay: 'keep-company' } }, endings: {} }]
  return ManifestSchema.parse(m)
}

describe('checkCompatibility', () => {
  it('additions are always compatible', () => {
    const m = clone(); m.items.push({ id: 'new-thing', name: 'New', alt: 'new' })
    const r = checkCompatibility(v1, ManifestSchema.parse(m))
    expect(r.ok).toBe(true)
    expect(r.added.items).toEqual(['new-thing'])
  })
  it('blocks removed IDs without a stateSchemaVersion bump', () => {
    const r = checkCompatibility(v1, renamed({ bump: false, migrate: false }))
    expect(r.ok).toBe(false)
    expect(r.blocking.map((b) => b.kind)).toContain('schema')
    expect(r.blocking[0].fix).toMatch(/Bump stateSchemaVersion to 2/)
  })
  it('blocks a bump without a migration that covers every removed ID', () => {
    expect(checkCompatibility(v1, renamed({ migrate: false })).blocking.map((b) => b.kind)).toContain('migration')
    const partial = renamed()
    partial.migrations[0].items = {}
    const r = checkCompatibility(v1, partial)
    expect(r.ok).toBe(false)
    expect(r.blocking.map((b) => b.id)).toContain('coil')
  })
  it('passes with a bump and a complete migration map', () => {
    const r = checkCompatibility(v1, renamed())
    expect(r.blocking).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.requiresMigration).toBe(true)
  })
  it('refuses to retire a checkpoint (readers need somewhere to resume)', () => {
    const m = renamed()
    m.migrations[0].checkpoints = { hall: null }
    expect(checkCompatibility(v1, m).blocking.map((b) => b.id)).toContain('hall')
  })
  it('refuses a different storyId outright', () => {
    const m = clone(); m.storyId = crypto.randomUUID()
    expect(checkCompatibility(v1, ManifestSchema.parse(m)).blocking[0].kind).toBe('story')
  })
  it('diffs manifests field by field', () => {
    const rows = diffManifests(v1, renamed())
    expect(rows.map((r) => r.field)).toEqual(expect.arrayContaining(['version', 'stateSchemaVersion', 'checkpoints/hall', 'checkpoints/relay-hall', 'items/coil']))
  })
})

describe('migrateSnapshot (the reducer path on resume)', () => {
  const reg1 = buildRegistry(v1)
  let snap = emptySnapshot(v1)
  for (const m of [
    { type: 'checkpoint', checkpointId: 'hall', set: { node: 'hall' } },
    { type: 'puzzle_completed', checkpointId: 'aligned', grantItems: [{ itemId: 'coil', quantity: 1 }] },
    { type: 'checkpoint', checkpointId: 'hall' },
    { type: 'choice_committed', choiceId: 'final-call', choiceOption: 'stay' },
  ]) snap = applyMutation(snap, m, reg1).snapshot

  it('renames checkpoint, items, and choice options; keeps everything else', () => {
    const v2 = renamed()
    const r = migrateSnapshot(snap, v2)
    expect(r.ok).toBe(true)
    expect(r.migrated).toBe(true)
    expect(r.snapshot.stateSchemaVersion).toBe(2)
    expect(r.snapshot.checkpointId).toBe('relay-hall')
    expect(r.snapshot.checkpointOrder).toBe(20)
    expect(r.snapshot.inventory['copper-coil'].quantity).toBe(1)
    expect(r.snapshot.inventory.coil).toBeUndefined()
    expect(r.snapshot.committedChoices['final-call']).toBe('keep-company')   // same meaning, new spelling
    expect(r.snapshot.storyState.node).toBe('hall')                         // story-owned state untouched
    // and the migrated snapshot keeps working with the new release
    const next = applyMutation(r.snapshot, { type: 'checkpoint', checkpointId: 'decided' }, buildRegistry(v2))
    expect(next.ok).toBe(true)
  })
  it('does not flip a canonical choice through migration', () => {
    const v2 = renamed()
    const r = migrateSnapshot(snap, v2)
    const flip = applyMutation(r.snapshot, { type: 'choice_committed', choiceId: 'final-call', choiceOption: 'transmit' }, buildRegistry(v2))
    expect(flip.code).toBe('choice_already_committed')
  })
  it('is a no-op on the same version and refuses gaps or downgrades', () => {
    expect(migrateSnapshot(snap, v1)).toEqual({ ok: true, snapshot: snap, migrated: false })
    const gap = renamed(); gap.migrations = []
    expect(migrateSnapshot(snap, gap).code).toBe('migration_missing')
    expect(migrateSnapshot({ ...snap, stateSchemaVersion: 3 }, v1).code).toBe('snapshot_newer_than_release')
  })
  it('composes chained migrations (a→b, b→c ⇒ a→c)', () => {
    const map = composeMigrations([
      { from: 1, to: 2, checkpoints: { a: 'b' }, items: {}, achievements: {}, choices: {}, choiceOptions: {}, endings: {} },
      { from: 2, to: 3, checkpoints: { b: 'c' }, items: { x: null }, achievements: {}, choices: {}, choiceOptions: {}, endings: {} },
    ], 1, 3)
    expect(map.checkpoints).toEqual({ a: 'c', b: 'c' })
    expect(map.items).toEqual({ x: null })
    expect(composeMigrations([], 1, 2)).toBeNull()
  })
})
