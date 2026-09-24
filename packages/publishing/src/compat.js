/**
 * Release compatibility — can readers who are mid-story on `current` safely
 * resume on `candidate`? Pure; used by `storyframe promote` (hard gate), CI,
 * and the Admin Studio's release view.
 *
 * Adding IDs is always safe. Removing or renaming a checkpoint, item,
 * achievement, choice (or choice option), or ending strands existing
 * snapshots, so it requires BOTH a stateSchemaVersion bump AND a migration
 * chain that says where every removed ID went (or that it is retired).
 */
import { composeMigrations } from '@storyframe/protocol'

const KINDS = [
  ['checkpoints', 'checkpoint', (m) => m.checkpoints.map((c) => c.id)],
  ['items', 'item', (m) => (m.items ?? []).map((i) => i.id)],
  ['achievements', 'achievement', (m) => (m.achievements ?? []).map((a) => a.id)],
  ['choices', 'choice', (m) => (m.choices ?? []).map((c) => c.id)],
  ['endings', 'ending', (m) => (m.endings ?? []).map((e) => e.id)],
]

/**
 * @param {object} current   manifest of the release readers are on (e.g. production)
 * @param {object} candidate manifest being promoted
 * @returns {{ ok:boolean, blocking:{kind:string,id:string,message:string,fix:string}[], warnings:string[],
 *            removed:Record<string,string[]>, added:Record<string,string[]>, requiresMigration:boolean,
 *            schema:{from:number,to:number} }}
 */
export function checkCompatibility(current, candidate) {
  const blocking = []
  const warnings = []
  const removed = {}
  const added = {}
  const block = (kind, id, message, fix) => blocking.push({ kind, id, message, fix })

  for (const [key, , ids] of KINDS) {
    const before = new Set(ids(current))
    const after = new Set(ids(candidate))
    removed[key] = [...before].filter((id) => !after.has(id))
    added[key] = [...after].filter((id) => !before.has(id))
  }
  const removedOptions = []
  for (const choice of current.choices ?? []) {
    const next = (candidate.choices ?? []).find((c) => c.id === choice.id)
    if (!next) continue
    for (const opt of choice.options) if (!next.options.includes(opt)) removedOptions.push({ choiceId: choice.id, option: opt })
  }
  if (current.storyId !== candidate.storyId)
    block('story', candidate.storyId, 'storyId changed — this is a different story, not a new release', 'Keep the storyId minted at first publish; it identifies the book forever.')

  const from = current.stateSchemaVersion
  const to = candidate.stateSchemaVersion
  const requiresMigration = Object.values(removed).some((l) => l.length) || removedOptions.length > 0

  if (to < from) block('schema', String(to), `stateSchemaVersion went backwards (${from} → ${to})`, 'stateSchemaVersion only ever increases.')

  if (requiresMigration) {
    if (to <= from) {
      block('schema', String(to), `IDs were removed or renamed but stateSchemaVersion is still ${to}`,
        `Bump stateSchemaVersion to ${from + 1} and add a migrations entry { "from": ${from}, "to": ${from + 1}, … }.`)
    } else {
      const map = composeMigrations(candidate.migrations ?? [], from, to)
      if (!map) {
        block('migration', `${from}→${to}`, `no migration chain from stateSchemaVersion ${from} to ${to}`,
          `Add "migrations": [{ "from": ${from}, "to": ${to}, … }] mapping every removed ID.`)
      } else {
        for (const [key, singular] of KINDS) {
          const targets = new Set(KINDS.find(([k]) => k === key)[2](candidate))
          for (const id of removed[key]) {
            if (!Object.prototype.hasOwnProperty.call(map[key], id)) {
              block(singular, id, `${singular} "${id}" was removed but the migration does not say where it went`,
                key === 'checkpoints'
                  ? `Add "checkpoints": { "${id}": "<an existing checkpoint>" } to the migration — readers there must resume somewhere.`
                  : `Add "${key}": { "${id}": "<new id>" } (rename) or { "${id}": null } (retire) to the migration.`)
              continue
            }
            const target = map[key][id]
            if (target === null && key === 'checkpoints')
              block(singular, id, `checkpoint "${id}" is retired (null) — readers there would have nowhere to resume`, 'Map it to the checkpoint that now covers that moment.')
            else if (target !== null && !targets.has(target))
              block(singular, id, `${singular} "${id}" migrates to "${target}", which does not exist in the candidate`, 'Point the mapping at an ID in the new manifest.')
            else if (target === null) warnings.push(`${singular} "${id}" is retired — readers keep it, but it will no longer display`)
          }
        }
        for (const { choiceId, option } of removedOptions) {
          const renamed = map.choiceOptions[choiceId]?.[option]
          const choice = (candidate.choices ?? []).find((c) => c.id === choiceId)
          if (!renamed) block('choice', `${choiceId}:${option}`, `option "${option}" of choice "${choiceId}" was removed`,
            `Add "choiceOptions": { "${choiceId}": { "${option}": "<new option>" } } — a committed choice must keep its meaning.`)
          else if (!choice?.options.includes(renamed)) block('choice', `${choiceId}:${option}`, `option "${option}" migrates to "${renamed}", which is not an option of ${choiceId}`, 'Map to an option that exists.')
        }
      }
    }
  } else if (to > from) {
    const map = composeMigrations(candidate.migrations ?? [], from, to)
    if (!map) block('migration', `${from}→${to}`, `stateSchemaVersion rose ${from} → ${to} but no migration chain exists`, `Add { "from": ${from}, "to": ${to} } to migrations (it may be empty).`)
  }

  // softer signals
  for (const cp of current.checkpoints) {
    const next = candidate.checkpoints.find((c) => c.id === cp.id)
    if (next && next.order !== cp.order) warnings.push(`checkpoint "${cp.id}" moved from order ${cp.order} to ${next.order} — shelf positions shift for readers there`)
  }
  for (const a of current.achievements ?? []) {
    const next = (candidate.achievements ?? []).find((x) => x.id === a.id)
    if (next && a.secret && !next.secret) warnings.push(`achievement "${a.id}" is no longer secret`)
  }
  if (added.checkpoints.length) warnings.push(`new checkpoints: ${added.checkpoints.join(', ')}`)

  return { ok: blocking.length === 0, blocking, warnings, removed, added, requiresMigration, schema: { from, to } }
}

/** A small human-readable diff of two manifests (for the release view). */
export function diffManifests(a, b) {
  const rows = []
  const scalar = (label, x, y) => { if (JSON.stringify(x) !== JSON.stringify(y)) rows.push({ field: label, before: x, after: y }) }
  for (const f of ['title', 'tagline', 'version', 'protocolVersion', 'stateSchemaVersion', 'entrypoint', 'cover']) scalar(f, a?.[f], b?.[f])
  scalar('content.rating', a?.content?.rating, b?.content?.rating)
  scalar('content.warnings', a?.content?.warnings, b?.content?.warnings)
  scalar('estimatedMinutes', a?.content?.estimatedMinutes, b?.content?.estimatedMinutes)
  scalar('capabilities', a?.capabilities, b?.capabilities)
  scalar('accessibility', a?.accessibility, b?.accessibility)
  scalar('offline.maxBytes', a?.offline?.maxBytes, b?.offline?.maxBytes)
  for (const [key] of KINDS) {
    const before = new Map((a?.[key] ?? []).map((x) => [x.id, x]))
    const after = new Map((b?.[key] ?? []).map((x) => [x.id, x]))
    for (const [id, x] of before) {
      if (!after.has(id)) rows.push({ field: `${key}/${id}`, before: x, after: null })
      else if (JSON.stringify(x) !== JSON.stringify(after.get(id))) rows.push({ field: `${key}/${id}`, before: x, after: after.get(id) })
    }
    for (const [id, x] of after) if (!before.has(id)) rows.push({ field: `${key}/${id}`, before: null, after: x })
  }
  return rows
}
