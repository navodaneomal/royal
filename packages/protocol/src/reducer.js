/**
 * The progress reducer — one mutation in, one whole snapshot out, or an
 * error and NO change. This is where "an atomic puzzle transaction cannot
 * grant only part of its effects" (§P0.4) is enforced: every referenced ID
 * is validated against the manifest registry BEFORE anything is applied.
 */
import { MutationSchema, SnapshotSchema, MAX_SNAPSHOT_BYTES, byteLength } from './schemas.js'

/** Build fast lookup sets from a validated manifest. */
export function buildRegistry(manifest) {
  return {
    checkpoints: new Map(manifest.checkpoints.map((c) => [c.id, c])),
    items: new Set((manifest.items ?? []).map((i) => i.id)),
    achievements: new Set((manifest.achievements ?? []).map((a) => a.id)),
    choices: new Map((manifest.choices ?? []).map((c) => [c.id, new Set(c.options)])),
    endings: new Set((manifest.endings ?? []).map((e) => e.id)),
    stateSchemaVersion: manifest.stateSchemaVersion,
  }
}

class MutationError extends Error {
  constructor(code, detail) { super(detail ?? code); this.code = code }
}

/**
 * Apply one mutation. Pure: never mutates its inputs.
 * @returns {{ok:true, snapshot:object, effects:{items:string[], achievements:string[], ending:string|null}} | {ok:false, code:string, detail?:string}}
 */
export function applyMutation(snapshot, rawMutation, registry, now = new Date().toISOString()) {
  try {
    const parsed = MutationSchema.safeParse(rawMutation)
    if (!parsed.success) throw new MutationError('schema', parsed.error.issues[0]?.message)
    const m = parsed.data

    /* validate every reference first — atomicity by pre-flight */
    let checkpoint = null
    if (m.checkpointId !== undefined) {
      checkpoint = registry.checkpoints.get(m.checkpointId)
      if (!checkpoint) throw new MutationError('unknown_checkpoint', m.checkpointId)
    }
    if (m.type === 'checkpoint' && !checkpoint) throw new MutationError('missing_checkpoint')
    for (const g of m.grantItems) if (!registry.items.has(g.itemId)) throw new MutationError('unknown_item', g.itemId)
    for (const a of m.unlockAchievements) if (!registry.achievements.has(a)) throw new MutationError('unknown_achievement', a)
    if (m.choiceId !== undefined) {
      const options = registry.choices.get(m.choiceId)
      if (!options) throw new MutationError('unknown_choice', m.choiceId)
      if (!m.choiceOption || !options.has(m.choiceOption)) throw new MutationError('unknown_choice_option', m.choiceOption)
      const prior = snapshot.committedChoices[m.choiceId]
      if (prior !== undefined && prior !== m.choiceOption)
        throw new MutationError('choice_already_committed', m.choiceId) // canonical choices never silently flip (§15.5)
    }
    if (m.endingId !== undefined && !registry.endings.has(m.endingId)) throw new MutationError('unknown_ending', m.endingId)
    if (m.type === 'ending' && m.endingId === undefined) throw new MutationError('missing_ending')

    /* apply — build the next snapshot in one go */
    const next = structuredClone(snapshot)
    if (checkpoint) { next.checkpointId = checkpoint.id; next.checkpointOrder = checkpoint.order }
    for (const [k, v] of Object.entries(m.set)) next.storyState[k] = v
    for (const v of m.visit) if (!next.visitedMoments.includes(v)) next.visitedMoments.push(v)

    const grantedItems = []
    for (const g of m.grantItems) {
      const existing = next.inventory[g.itemId]
      if (existing) existing.quantity += g.quantity
      else { next.inventory[g.itemId] = { quantity: g.quantity, discoveredAt: now }; grantedItems.push(g.itemId) }
    }
    const unlocked = []
    for (const a of m.unlockAchievements) {
      if (!next.achievements.includes(a)) { next.achievements.push(a); unlocked.push(a) } // idempotent (§P0.8)
    }
    if (m.choiceId !== undefined) next.committedChoices[m.choiceId] = m.choiceOption
    if (m.hintLevel) {
      const cur = next.hintLevelByPuzzle[m.hintLevel.puzzleId] ?? 0
      next.hintLevelByPuzzle[m.hintLevel.puzzleId] = Math.max(cur, m.hintLevel.level) // hints are never "un-used"
    }
    let ending = null
    if (m.endingId !== undefined && !next.endingIds.includes(m.endingId)) { next.endingIds.push(m.endingId); ending = m.endingId }

    const validated = SnapshotSchema.safeParse(next)
    if (!validated.success) throw new MutationError('snapshot_invalid', validated.error.issues[0]?.message)
    if (byteLength(validated.data) > MAX_SNAPSHOT_BYTES) throw new MutationError('snapshot_too_large')

    return { ok: true, snapshot: validated.data, effects: { items: grantedItems, achievements: unlocked, ending } }
  } catch (err) {
    if (err instanceof MutationError) return { ok: false, code: err.code, detail: err.message }
    return { ok: false, code: 'internal', detail: String(err?.message ?? err) }
  }
}

/**
 * Merge rules for non-conflicting fields when the reader keeps one timeline
 * after a divergence (§15.5). Canonical choices and checkpoints are NOT
 * merged here — divergence there is a timeline decision, never automatic.
 */
export function unionMerge(keep, other) {
  const merged = structuredClone(keep)
  for (const [itemId, entry] of Object.entries(other.inventory)) {
    if (!merged.inventory[itemId]) merged.inventory[itemId] = structuredClone(entry)
  }
  for (const a of other.achievements) if (!merged.achievements.includes(a)) merged.achievements.push(a)
  for (const v of other.visitedMoments) if (!merged.visitedMoments.includes(v)) merged.visitedMoments.push(v)
  for (const e of other.endingIds) if (!merged.endingIds.includes(e)) merged.endingIds.push(e)
  for (const [p, l] of Object.entries(other.hintLevelByPuzzle)) {
    merged.hintLevelByPuzzle[p] = Math.max(merged.hintLevelByPuzzle[p] ?? 0, l)
  }
  return merged
}

/* ── state-schema migrations (v2) ───────────────────────────────────── */

/**
 * Compose the manifest's migration steps into one map from `fromVersion` to
 * `toVersion`. Steps chain (1→2, 2→3); renames compose (a→b, b→c ⇒ a→c) and
 * a retirement anywhere in the chain wins. Returns null when no chain exists.
 */
export function composeMigrations(migrations, fromVersion, toVersion) {
  const kinds = ['checkpoints', 'items', 'achievements', 'choices', 'endings']
  const out = { checkpoints: {}, items: {}, achievements: {}, choices: {}, endings: {}, choiceOptions: {} }
  let v = fromVersion
  const steps = []
  while (v < toVersion) {
    const candidates = (migrations ?? []).filter((m) => m.from === v && m.to <= toVersion)
    if (!candidates.length) return null
    const step = candidates.sort((a, b) => b.to - a.to)[0]
    steps.push(step)
    v = step.to
  }
  const resolve = (map, id) => (Object.prototype.hasOwnProperty.call(map, id) ? map[id] : id)
  for (const step of steps) {
    for (const kind of kinds) {
      const stepMap = step[kind] ?? {}
      // advance every existing mapping through this step
      for (const [from, to] of Object.entries(out[kind])) {
        if (to !== null) out[kind][from] = resolve(stepMap, to)
      }
      // ids first seen in this step
      for (const [from, to] of Object.entries(stepMap)) {
        if (!Object.prototype.hasOwnProperty.call(out[kind], from)) out[kind][from] = to
      }
    }
    for (const [choiceId, options] of Object.entries(step.choiceOptions ?? {})) {
      out.choiceOptions[choiceId] = { ...(out.choiceOptions[choiceId] ?? {}) }
      for (const [prev, next] of Object.entries(out.choiceOptions[choiceId])) out.choiceOptions[choiceId][prev] = resolve(options, next)
      for (const [from, to] of Object.entries(options)) {
        if (!Object.prototype.hasOwnProperty.call(out.choiceOptions[choiceId], from)) out.choiceOptions[choiceId][from] = to
      }
    }
  }
  return out
}

/**
 * Bring a reader's snapshot up to the release's stateSchemaVersion using the
 * manifest's migration map. Pure. Reader data is never deleted: renamed IDs
 * move, retired IDs (null) stay where they are and are simply no longer
 * referenced. A checkpoint must always land on a real checkpoint.
 *
 * @returns {{ok:true, snapshot:object, migrated:boolean, from?:number} | {ok:false, code:string, detail?:string}}
 */
export function migrateSnapshot(snapshot, manifest) {
  const target = manifest.stateSchemaVersion
  const from = snapshot.stateSchemaVersion
  if (from === target) return { ok: true, snapshot, migrated: false }
  if (from > target) return { ok: false, code: 'snapshot_newer_than_release', detail: `snapshot v${from}, release v${target}` }

  const map = composeMigrations(manifest.migrations, from, target)
  if (!map) return { ok: false, code: 'migration_missing', detail: `no migration path ${from} → ${target}` }

  const rename = (kind, id) => {
    const m = map[kind]
    if (!Object.prototype.hasOwnProperty.call(m, id)) return id
    return m[id] === null ? id : m[id]        // retired: keep the reader's record untouched
  }
  const next = structuredClone(snapshot)

  next.checkpointId = rename('checkpoints', next.checkpointId)
  const cp = manifest.checkpoints.find((c) => c.id === next.checkpointId)
  if (!cp) return { ok: false, code: 'migration_incomplete', detail: `checkpoint ${snapshot.checkpointId} has no home in v${target}` }
  next.checkpointOrder = cp.order

  const inventory = {}
  for (const [itemId, entry] of Object.entries(next.inventory)) {
    const to = rename('items', itemId)
    if (inventory[to]) inventory[to].quantity += entry.quantity
    else inventory[to] = entry
  }
  next.inventory = inventory
  next.achievements = [...new Set(next.achievements.map((a) => rename('achievements', a)))]
  next.endingIds = [...new Set(next.endingIds.map((e) => rename('endings', e)))]

  const choices = {}
  for (const [choiceId, option] of Object.entries(next.committedChoices)) {
    const to = rename('choices', choiceId)
    const optionMap = map.choiceOptions[choiceId] ?? map.choiceOptions[to] ?? {}
    // a canonical choice keeps its meaning; only its spelling may change
    choices[to] = optionMap[option] ?? option
  }
  next.committedChoices = choices
  next.stateSchemaVersion = target

  const validated = SnapshotSchema.safeParse(next)
  if (!validated.success) return { ok: false, code: 'snapshot_invalid', detail: validated.error.issues[0]?.message }
  return { ok: true, snapshot: validated.data, migrated: true, from }
}

/* ── cloud sync helpers (v2, used by the app AND the edge function) ─── */

/** IDs in a snapshot that the release does not know. Empty ⇒ importable. */
export function unknownSnapshotIds(snapshot, manifest) {
  const reg = buildRegistry(manifest)
  const out = []
  if (!reg.checkpoints.has(snapshot.checkpointId)) out.push(`checkpoint:${snapshot.checkpointId}`)
  for (const id of Object.keys(snapshot.inventory ?? {})) if (!reg.items.has(id)) out.push(`item:${id}`)
  for (const id of snapshot.achievements ?? []) if (!reg.achievements.has(id)) out.push(`achievement:${id}`)
  for (const [id, opt] of Object.entries(snapshot.committedChoices ?? {})) {
    if (!reg.choices.has(id) || !reg.choices.get(id).has(opt)) out.push(`choice:${id}=${opt}`)
  }
  for (const id of snapshot.endingIds ?? []) if (!reg.endings.has(id)) out.push(`ending:${id}`)
  return out
}

const sameSnapshot = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Guest → account upgrade, and "this device wins" conflict resolution.
 *   mode 'upgrade': the account's timeline stays canonical; the guest's
 *                   discoveries are union-merged in (never checkpoints or
 *                   choices); the guest snapshot is archived as a timeline.
 *   mode 'replace': the reader chose this device's timeline; the server's
 *                   current snapshot is archived, never overwritten.
 */
export function planImport(serverSnapshot, localSnapshot, mode = 'upgrade') {
  if (!serverSnapshot) return { action: 'import', snapshot: localSnapshot, archive: null }
  if (sameSnapshot(serverSnapshot, localSnapshot)) return { action: 'unchanged', snapshot: serverSnapshot, archive: null }
  if (mode === 'replace') return { action: 'replace', snapshot: localSnapshot, archive: serverSnapshot }
  return { action: 'merge', snapshot: unionMerge(serverSnapshot, localSnapshot), archive: localSnapshot }
}
