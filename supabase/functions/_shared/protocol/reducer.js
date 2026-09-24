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
