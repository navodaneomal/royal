/**
 * story-cli library — validate, pack, publish, promote, rollback.
 *
 * Release model (§13.1, §23): every publish produces an immutable release
 * directory keyed by content hash. Channels are pointers in registry.json.
 * Rollback moves a pointer; nothing is ever overwritten. Every operator
 * action appends to an audit log.
 */
import { createHash } from 'node:crypto'
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, cpSync, rmSync,
} from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { ManifestSchema, SUPPORTED_PROTOCOLS } from '@storyframe/protocol'

export const REPO = resolve(new URL('../../..', import.meta.url).pathname)
export const HOST_DIR = join(REPO, 'infra/story-host/stories-host')
const REGISTRY = join(HOST_DIR, 'registry.json')
const AUDIT = join(HOST_DIR, 'audit-log.json')

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

/* ── registry + audit ───────────────────────────────────────────────── */
export function loadRegistry() {
  if (!existsSync(REGISTRY)) return { generatedAt: null, stories: [] }
  return JSON.parse(readFileSync(REGISTRY, 'utf8'))
}
export function saveRegistry(reg) {
  reg.generatedAt = new Date().toISOString()
  mkdirSync(HOST_DIR, { recursive: true })
  writeFileSync(REGISTRY, JSON.stringify(reg, null, 2))
}
export function audit(action, detail) {
  mkdirSync(HOST_DIR, { recursive: true })
  const log = existsSync(AUDIT) ? JSON.parse(readFileSync(AUDIT, 'utf8')) : []
  log.push({ at: new Date().toISOString(), actor: process.env.USER || 'local-operator', action, ...detail })
  writeFileSync(AUDIT, JSON.stringify(log, null, 2))
}

/* ── validation (§23.2) ─────────────────────────────────────────────── */
const EXTERNAL_RE = /(?:src|href)\s*=\s*["']https?:\/\/([^"'/]+)/gi
const FETCH_RE = /fetch\(\s*["']https?:\/\//i

export function validateStory(storyDir) {
  const errors = []
  const warnings = []
  const pkgDir = join(storyDir, 'package')
  const manifestPath = join(storyDir, 'storyframe.json')

  if (!existsSync(manifestPath)) return { ok: false, errors: ['storyframe.json is missing'], warnings }
  if (!existsSync(pkgDir)) return { ok: false, errors: ['package/ not built — run the story build first'], warnings }

  let manifest
  try {
    const parsed = ManifestSchema.safeParse(JSON.parse(readFileSync(manifestPath, 'utf8')))
    if (!parsed.success) {
      for (const issue of parsed.error.issues.slice(0, 8))
        errors.push(`manifest: ${issue.path.join('.')} — ${issue.message}`)
      return { ok: false, errors, warnings }
    }
    manifest = parsed.data
  } catch (e) { return { ok: false, errors: ['storyframe.json is not valid JSON: ' + e.message], warnings } }

  if (!SUPPORTED_PROTOCOLS.includes(manifest.protocolVersion))
    errors.push(`protocolVersion ${manifest.protocolVersion} unsupported (host supports ${SUPPORTED_PROTOCOLS.join(', ')})`)

  const entry = join(pkgDir, manifest.entrypoint)
  if (!existsSync(entry)) errors.push(`entrypoint missing in package: ${manifest.entrypoint}`)

  // unique IDs across every registry the reducer trusts
  for (const [kind, list] of [
    ['checkpoint', manifest.checkpoints.map((c) => c.id)],
    ['item', manifest.items.map((i) => i.id)],
    ['achievement', manifest.achievements.map((a) => a.id)],
    ['choice', manifest.choices.map((c) => c.id)],
    ['ending', manifest.endings.map((e) => e.id)],
  ]) {
    const seen = new Set()
    for (const id of list) {
      if (seen.has(id)) errors.push(`duplicate ${kind} id: ${id}`)
      seen.add(id)
    }
  }

  if (existsSync(entry)) {
    const html = readFileSync(entry, 'utf8')
    if (!html.includes(manifest.storyId))
      errors.push('entrypoint does not reference the manifest storyId — SDK connect would be rejected')
    let m
    EXTERNAL_RE.lastIndex = 0
    const hosts = new Set()
    while ((m = EXTERNAL_RE.exec(html))) hosts.add(m[1])
    for (const h of hosts) errors.push(`undeclared external origin in package: ${h} (packages must be self-contained)`)
    if (FETCH_RE.test(html)) errors.push('package fetches an absolute external URL')
    if (!/alt\s*=|aria-label/i.test(html)) warnings.push('no alt/aria-label attributes found in entry HTML — check imagery')
  }

  // budgets (§13.4)
  const files = walk(pkgDir)
  let total = 0
  for (const f of files) {
    const size = statSync(f).size
    total += size
    if (size > 10 * 1024 * 1024) errors.push(`asset over 10 MB: ${relative(pkgDir, f)}`)
  }
  if (total > manifest.offline.maxBytes)
    errors.push(`package ${(total / 1024).toFixed(0)} KB exceeds its declared offline.maxBytes ${(manifest.offline.maxBytes / 1024).toFixed(0)} KB`)
  if (existsSync(entry) && statSync(entry).size > 500 * 1024)
    warnings.push(`entry HTML is ${(statSync(entry).size / 1024).toFixed(0)} KB — over the 500 KB first-interaction guidance`)
  if (total > 0.9 * manifest.offline.maxBytes && total <= manifest.offline.maxBytes)
    warnings.push('package is within 10% of its size budget')

  const a = manifest.accessibility
  if (!a.keyboard || !a.screenReader) errors.push('accessibility: keyboard and screenReader support are required for P0 promotion')

  return { ok: errors.length === 0, errors, warnings, manifest, pkgDir, totalBytes: total }
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

/* ── pack: deterministic hash + integrity manifest ──────────────────── */
export function packStory(storyDir) {
  const v = validateStory(storyDir)
  if (!v.ok) return v
  const files = walk(v.pkgDir).filter((f) => !f.endsWith('integrity.json'))
  const entries = files
    .map((f) => ({ path: relative(v.pkgDir, f).split('\\').join('/'), hash: sha256(readFileSync(f)) }))
    .sort((x, y) => x.path.localeCompare(y.path))
  const packageHash = sha256(entries.map((e) => `${e.path}:${e.hash}`).join('\n'))
  return { ...v, entries, packageHash }
}

/* ── publish: immutable release + channel pointer ───────────────────── */
export function publishStory(storyDir, { channel = 'beta' } = {}) {
  const p = packStory(storyDir)
  if (!p.ok) return p
  const { manifest, pkgDir, packageHash } = p
  const releaseId = 'r' + packageHash.slice(0, 12)
  const relDir = join(HOST_DIR, 'packages', manifest.slug, releaseId)

  if (!existsSync(relDir)) {
    mkdirSync(relDir, { recursive: true })
    cpSync(pkgDir, relDir, { recursive: true })
    // stamp the release id into the served entrypoint, then record the
    // integrity of the STAMPED files — that is what downloads verify against
    const entry = join(relDir, manifest.entrypoint)
    writeFileSync(entry, readFileSync(entry, 'utf8').replaceAll('__SF_RELEASE_ID__', releaseId))
    const stamped = walk(relDir).filter((f) => !f.endsWith('integrity.json'))
      .map((f) => ({ path: relative(relDir, f).split('\\').join('/'), hash: sha256(readFileSync(f)) }))
      .sort((x, y) => x.path.localeCompare(y.path))
    writeFileSync(join(relDir, 'integrity.json'), JSON.stringify({
      generatedAt: new Date().toISOString(), releaseId, packageHash,
      files: Object.fromEntries(stamped.map((e) => [e.path, 'sha256:' + e.hash])),
    }, null, 2))
  }

  const reg = loadRegistry()
  let story = reg.stories.find((s) => s.storyId === manifest.storyId)
  if (!story) {
    story = { storyId: manifest.storyId, slug: manifest.slug, channels: {}, releases: [] }
    reg.stories.push(story)
  }
  story.slug = manifest.slug
  story.title = manifest.title
  story.tagline = manifest.tagline ?? ''
  story.cover = `packages/${manifest.slug}/${releaseId}/cover.svg`
  story.meta = {
    content: manifest.content, accessibility: manifest.accessibility,
    languages: manifest.languages, offlineEligible: manifest.offline.eligible,
    estimatedMinutes: manifest.content.estimatedMinutes, sizeBytes: p.totalBytes,
    checkpoints: manifest.checkpoints, items: manifest.items,
    achievements: manifest.achievements, choices: manifest.choices, endings: manifest.endings,
    stateSchemaVersion: manifest.stateSchemaVersion, protocolVersion: manifest.protocolVersion,
    capabilities: manifest.capabilities,
  }
  if (!story.releases.find((r) => r.releaseId === releaseId)) {
    story.releases.push({
      releaseId, version: manifest.version, packageHash,
      path: `packages/${manifest.slug}/${releaseId}/${manifest.entrypoint}`,
      publishedAt: new Date().toISOString(), status: 'approved',
      validation: { errors: p.errors, warnings: p.warnings },
    })
  }
  story.channels[channel] = { releaseId, disabled: false }
  saveRegistry(reg)
  audit('publish', { slug: manifest.slug, releaseId, channel, version: manifest.version })
  return { ok: true, releaseId, packageHash, warnings: p.warnings, slug: manifest.slug }
}

/* ── channel operations ─────────────────────────────────────────────── */
export function promote(slug, releaseId, channel = 'production') {
  const reg = loadRegistry()
  const story = reg.stories.find((s) => s.slug === slug)
  if (!story) return { ok: false, errors: [`unknown story: ${slug}`] }
  const rel = story.releases.find((r) => r.releaseId === releaseId)
  if (!rel) return { ok: false, errors: [`unknown release: ${releaseId}`] }
  if (rel.status === 'rejected') return { ok: false, errors: ['release was rejected — cannot promote'] }
  story.channels[channel] = { releaseId, disabled: false }
  saveRegistry(reg)
  audit('promote', { slug, releaseId, channel })
  return { ok: true, releaseId }
}

export function rollback(slug, channel = 'production') {
  const reg = loadRegistry()
  const story = reg.stories.find((s) => s.slug === slug)
  if (!story) return { ok: false, errors: [`unknown story: ${slug}`] }
  const current = story.channels[channel]?.releaseId
  const history = story.releases.filter((r) => r.status !== 'rejected').map((r) => r.releaseId)
  const idx = history.indexOf(current)
  const prev = idx > 0 ? history[idx - 1] : null
  if (!prev) return { ok: false, errors: ['no earlier release to roll back to'] }
  story.channels[channel] = { releaseId: prev, disabled: false }
  saveRegistry(reg)
  audit('rollback', { slug, channel, from: current, to: prev })
  return { ok: true, from: current, to: prev }
}

export function setDisabled(slug, disabled, channel = 'production') {
  const reg = loadRegistry()
  const story = reg.stories.find((s) => s.slug === slug)
  if (!story || !story.channels[channel]) return { ok: false, errors: ['unknown story/channel'] }
  story.channels[channel].disabled = disabled
  saveRegistry(reg)
  audit(disabled ? 'disable' : 'enable', { slug, channel })
  return { ok: true }
}
