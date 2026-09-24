/**
 * The release registry as pure functions (registry.json in, registry.json +
 * one audit entry out). The CLI wraps these with file I/O; CI runs the CLI;
 * the Admin Studio uses them only to explain what an action WILL do.
 *
 * v2 change: every release carries its own `meta` (checkpoints, items, …).
 * v1 kept one story-level `meta` that any publish overwrote — publishing to
 * beta silently changed the IDs production playback validated against.
 * Story-level fields now mirror the production release (else beta, else the
 * newest), recomputed after every operation.
 */
import { checkCompatibility } from './compat.js'

export const REGISTRY_SCHEMA = 'storyframe.registry.v2'
export const emptyRegistry = () => ({ schema: REGISTRY_SCHEMA, generatedAt: null, stories: [] })

/** What the app needs to know about a release without downloading it. */
export function releaseMeta(manifest, sizeBytes) {
  return {
    content: manifest.content, accessibility: manifest.accessibility,
    languages: manifest.languages, offlineEligible: manifest.offline.eligible,
    estimatedMinutes: manifest.content.estimatedMinutes, sizeBytes,
    checkpoints: manifest.checkpoints, items: manifest.items,
    achievements: manifest.achievements, choices: manifest.choices, endings: manifest.endings,
    stateSchemaVersion: manifest.stateSchemaVersion, protocolVersion: manifest.protocolVersion,
    capabilities: manifest.capabilities, migrations: manifest.migrations ?? [],
    maxBytes: manifest.offline.maxBytes,
  }
}

/** Re-derive the story-level mirror fields from its most important channel. */
export function syncStory(story) {
  const pick = story.channels?.production?.releaseId ?? story.channels?.beta?.releaseId ?? story.releases.at(-1)?.releaseId
  const rel = story.releases.find((r) => r.releaseId === pick)
  if (!rel) return story
  story.title = rel.title ?? story.title
  story.tagline = rel.tagline ?? ''
  story.synopsis = rel.synopsis ?? ''
  story.accent = rel.accent ?? null
  story.cover = rel.cover ?? story.cover
  story.meta = rel.meta ?? story.meta
  return story
}

const findStory = (reg, slug) => reg.stories.find((s) => s.slug === slug)

/**
 * Record a published release and point `channel` at it.
 * @returns {{ ok:true, registry:object, audit:object, created:boolean }}
 */
export function applyPublish(registry, { manifest, releaseId, packageHash, totalBytes, validation, notes = '', channel = 'beta', now }) {
  const reg = structuredClone(registry)
  let story = reg.stories.find((s) => s.storyId === manifest.storyId)
  if (!story) {
    story = { storyId: manifest.storyId, slug: manifest.slug, channels: {}, releases: [] }
    reg.stories.push(story)
  }
  story.slug = manifest.slug
  const base = `packages/${manifest.slug}/${releaseId}`
  let created = false
  if (!story.releases.find((r) => r.releaseId === releaseId)) {
    created = true
    story.releases.push({
      releaseId, version: manifest.version, packageHash,
      path: `${base}/${manifest.entrypoint}`,
      cover: `${base}/${manifest.cover ?? 'cover.svg'}`,
      manifestPath: `${base}/storyframe.json`,
      publishedAt: now, status: 'approved',
      title: manifest.title, tagline: manifest.tagline ?? '', synopsis: manifest.synopsis ?? '', accent: manifest.accent ?? null,
      notes, validation,
      meta: releaseMeta(manifest, totalBytes),
    })
  }
  story.channels[channel] = { releaseId, disabled: false }
  syncStory(story)
  reg.generatedAt = now
  return { ok: true, registry: reg, created, audit: { at: now, action: 'publish', slug: manifest.slug, releaseId, channel, version: manifest.version } }
}

/**
 * Move a channel pointer. Promotions into production are gated by the
 * compatibility checker against the current production release.
 * @param {{ current?:object, candidate?:object }} manifests  parsed manifests (needed for production)
 */
export function applyPromote(registry, { slug, releaseId, channel = 'production', manifests = {}, now }) {
  const reg = structuredClone(registry)
  const story = findStory(reg, slug)
  if (!story) return { ok: false, errors: [`unknown story: ${slug}`] }
  const rel = story.releases.find((r) => r.releaseId === releaseId)
  if (!rel) return { ok: false, errors: [`unknown release: ${releaseId}`] }
  if (rel.status === 'rejected') return { ok: false, errors: ['release was rejected — cannot promote'] }
  const from = story.channels[channel]?.releaseId ?? null
  let compat = null
  if (channel === 'production' && from && from !== releaseId) {
    if (!manifests.current || !manifests.candidate) return { ok: false, errors: ['compatibility check needs both manifests'] }
    compat = checkCompatibility(manifests.current, manifests.candidate)
    if (!compat.ok) {
      return {
        ok: false, compat,
        errors: compat.blocking.map((b) => `${b.message} — ${b.fix}`)
          .concat(manifests.candidate.stateSchemaVersion < manifests.current.stateSchemaVersion ? ['to go back to an older release, use `storyframe rollback`'] : []),
      }
    }
  }
  story.channels[channel] = { releaseId, disabled: false }
  syncStory(story)
  reg.generatedAt = now
  return { ok: true, registry: reg, compat, releaseId, audit: { at: now, action: 'promote', slug, releaseId, channel, from } }
}

/** Pointer back to the release before the current one in publish order. */
export function applyRollback(registry, { slug, channel = 'production', manifests = {}, now }) {
  const reg = structuredClone(registry)
  const story = findStory(reg, slug)
  if (!story) return { ok: false, errors: [`unknown story: ${slug}`] }
  const current = story.channels[channel]?.releaseId
  const history = story.releases.filter((r) => r.status !== 'rejected').map((r) => r.releaseId)
  const idx = history.indexOf(current)
  const prev = idx > 0 ? history[idx - 1] : null
  if (!prev) return { ok: false, errors: ['no earlier release to roll back to'] }
  const warnings = []
  const cur = story.releases.find((r) => r.releaseId === current)
  const back = story.releases.find((r) => r.releaseId === prev)
  const curV = cur?.meta?.stateSchemaVersion ?? 1
  const backV = back?.meta?.stateSchemaVersion ?? 1
  if (backV < curV) warnings.push(`rolling back across stateSchemaVersion ${curV} → ${backV}: readers who already saved on ${current} keep their saves, but ${prev} may not recognise their newest checkpoint (the app tells them so)`)
  story.channels[channel] = { releaseId: prev, disabled: false }
  syncStory(story)
  reg.generatedAt = now
  return { ok: true, registry: reg, from: current, to: prev, warnings, audit: { at: now, action: 'rollback', slug, channel, from: current, to: prev } }
}

export function applySetDisabled(registry, { slug, disabled, channel = 'production', now }) {
  const reg = structuredClone(registry)
  const story = findStory(reg, slug)
  if (!story || !story.channels[channel]) return { ok: false, errors: ['unknown story/channel'] }
  story.channels[channel].disabled = disabled
  reg.generatedAt = now
  return { ok: true, registry: reg, audit: { at: now, action: disabled ? 'disable' : 'enable', slug, channel } }
}

/** The release a channel points at (with its per-release meta), or null. */
export function channelRelease(story, channel = 'production') {
  const ch = story?.channels?.[channel]
  if (!ch) return null
  const rel = story.releases.find((r) => r.releaseId === ch.releaseId)
  return rel ? { ...rel, meta: rel.meta ?? story.meta, disabled: !!ch.disabled, channel } : null
}
