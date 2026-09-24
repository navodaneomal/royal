/**
 * story-cli library — the Node wrapper around @storyframe/publishing.
 *
 * Every decision (validation, building, hashing, registry changes,
 * compatibility) is made by the pure publishing core; this file only reads
 * and writes files. Release model (§13.1, §23): immutable content-addressed
 * release folders, channel pointers in registry.json, an append-only audit
 * log. Nothing here ever overwrites a release.
 */
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, lstatSync, rmSync,
} from 'node:fs'
import { join, resolve, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ManifestSchema } from '@storyframe/protocol'
import {
  validatePackage, buildPackage, packFiles, stampReleaseFiles, extractReleaseNotes,
  applyPublish, applyPromote, applyRollback, applySetDisabled, emptyRegistry, channelRelease,
  checkCompatibility, scaffoldStory, toText,
} from '@storyframe/publishing'

// fileURLToPath, not URL.pathname: on Windows the latter yields "/C:/…" and "%20"
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const DEFAULT_HOST_DIR = join(REPO, 'infra', 'story-host', 'stories-host')
/** The content-plane directory (overridable for tests and CI worktrees). */
export const hostDir = () => resolve(process.env.STORYFRAME_HOST_DIR || DEFAULT_HOST_DIR)
/** @deprecated kept for v1 importers — use hostDir() */
export const HOST_DIR = DEFAULT_HOST_DIR
export const SDK_PATH = join(REPO, 'packages', 'story-sdk', 'dist', 'storyframe-sdk.iife.js')

const registryPath = () => join(hostDir(), 'registry.json')
const auditPath = () => join(hostDir(), 'audit-log.json')
const now = () => new Date().toISOString()

export const actor = () =>
  process.env.STORYFRAME_ACTOR || process.env.GITHUB_ACTOR || process.env.USER || process.env.USERNAME || 'local-operator'

/* ── files ──────────────────────────────────────────────────────────── */
const SKIP_DIRS = new Set(['node_modules', '.git', 'package'])
/**
 * Read a directory into a file map. Symlinks are never followed (an uploaded
 * story must not be able to pull /etc/passwd or repo secrets into a package).
 */
export function readTree(dir, { skipDirs = SKIP_DIRS } = {}) {
  const files = new Map()
  const walk = (abs) => {
    for (const name of readdirSync(abs).sort()) {
      const p = join(abs, name)
      const st = lstatSync(p)
      if (st.isSymbolicLink()) continue
      if (st.isDirectory()) { if (!skipDirs.has(name)) walk(p) }
      else if (st.isFile()) files.set(relative(dir, p).split(sep).join('/'), new Uint8Array(readFileSync(p)))
    }
  }
  walk(dir)
  return files
}
export function writeTree(dir, files) {
  for (const [path, bytes] of files) {
    const abs = join(dir, ...path.split('/'))
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, bytes)
  }
}
export function readSdk() {
  if (!existsSync(SDK_PATH)) return null
  return readFileSync(SDK_PATH, 'utf8')
}

/* ── registry + audit ───────────────────────────────────────────────── */
export function loadRegistry() {
  if (!existsSync(registryPath())) return emptyRegistry()
  const reg = JSON.parse(readFileSync(registryPath(), 'utf8'))
  return { ...emptyRegistry(), ...reg }
}
export function saveRegistry(reg) {
  mkdirSync(hostDir(), { recursive: true })
  writeFileSync(registryPath(), JSON.stringify(reg, null, 2) + '\n')
}
export function loadAudit() {
  return existsSync(auditPath()) ? JSON.parse(readFileSync(auditPath(), 'utf8')) : []
}
export function audit(entry) {
  mkdirSync(hostDir(), { recursive: true })
  const log = loadAudit()
  log.push({ actor: actor(), ...entry })            // append-only: never rewritten, never trimmed
  writeFileSync(auditPath(), JSON.stringify(log, null, 2) + '\n')
}

/* ── build ──────────────────────────────────────────────────────────── */
/** Declarative build: story folder → package/ (never runs story code). */
export function buildStory(storyDir) {
  const sdk = readSdk()
  if (!sdk) return { ok: false, errors: ['SDK not built — run `npm run sdk:build`'], warnings: [], notes: [] }
  const source = readTree(storyDir)
  const r = buildPackage({ source, sdk })
  const pkgDir = join(storyDir, 'package')
  if (r.ok) {
    rmSync(pkgDir, { recursive: true, force: true })
    mkdirSync(pkgDir, { recursive: true })
    writeTree(pkgDir, r.files)
  }
  const bytes = [...r.files.values()].reduce((n, b) => n + b.byteLength, 0)
  return { ok: r.ok, errors: r.log.errors, warnings: r.log.warnings, notes: r.log.notes, manifest: r.manifest, pkgDir, bytes, lane: r.lane }
}

/* ── validation (§23.2) ─────────────────────────────────────────────── */
export function validateStory(storyDir) {
  const pkgDir = join(storyDir, 'package')
  const srcManifest = join(storyDir, 'storyframe.json')
  if (!existsSync(srcManifest)) return { ok: false, errors: ['storyframe.json is missing'], warnings: [], issues: [] }
  if (!existsSync(pkgDir)) return { ok: false, errors: ['package/ not built — run `storyframe build` first'], warnings: [], issues: [] }
  const files = readTree(pkgDir, { skipDirs: new Set() })
  const manifestBytes = files.get('storyframe.json')
  const manifest = manifestBytes ? toText(manifestBytes) : readFileSync(srcManifest, 'utf8')
  const v = validatePackage({ manifest, files })
  return { ...v, pkgDir, files }
}

/* ── pack: deterministic hash ───────────────────────────────────────── */
export function packStory(storyDir) {
  const v = validateStory(storyDir)
  if (!v.ok) return v
  const p = packFiles(v.files)
  return { ...v, ...p }
}

/* ── publish: immutable release + channel pointer ───────────────────── */
export function publishStory(storyDir, { channel = 'beta' } = {}) {
  const p = packStory(storyDir)
  if (!p.ok) return p
  const { manifest, packageHash, releaseId, files, totalBytes } = p
  // publishing straight to a live channel must clear the same gate as promote
  if (channel === 'production') {
    const story = loadRegistry().stories.find((s) => s.storyId === manifest.storyId)
    const live = story ? channelRelease(story, 'production') : null
    const liveManifest = live && live.releaseId !== releaseId ? releaseManifest(story.slug, live.releaseId) : null
    if (liveManifest) {
      const compat = checkCompatibility(liveManifest, manifest)
      if (!compat.ok) return { ok: false, errors: compat.blocking.map((b) => `${b.message} — ${b.fix}`), warnings: compat.warnings }
    }
  }
  const relDir = join(hostDir(), 'packages', manifest.slug, releaseId)
  const at = now()
  if (!existsSync(relDir)) {
    const stamped = stampReleaseFiles(files, { entrypoint: manifest.entrypoint, releaseId, packageHash, generatedAt: at })
    mkdirSync(relDir, { recursive: true })
    writeTree(relDir, stamped.files)
  }
  const changelog = join(storyDir, 'CHANGELOG.md')
  const notes = existsSync(changelog) ? extractReleaseNotes(readFileSync(changelog, 'utf8'), manifest.version) : ''
  const r = applyPublish(loadRegistry(), {
    manifest, releaseId, packageHash, totalBytes, notes, channel, now: at,
    validation: { errors: p.errors, warnings: p.warnings },
  })
  saveRegistry(r.registry)
  audit(r.audit)
  return { ok: true, releaseId, packageHash, warnings: p.warnings, slug: manifest.slug, created: r.created }
}

/* ── channel operations ─────────────────────────────────────────────── */
export function releaseManifest(slug, releaseId) {
  const path = join(hostDir(), 'packages', slug, releaseId, 'storyframe.json')
  if (!existsSync(path)) return null
  return ManifestSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
}

export function promote(slug, releaseId, channel = 'production') {
  const reg = loadRegistry()
  const story = reg.stories.find((s) => s.slug === slug)
  const current = story ? channelRelease(story, channel) : null
  const manifests = current && releaseId
    ? { current: releaseManifest(slug, current.releaseId), candidate: releaseManifest(slug, releaseId) }
    : {}
  const r = applyPromote(reg, { slug, releaseId, channel, manifests, now: now() })
  if (!r.ok) return r
  saveRegistry(r.registry)
  audit(r.audit)
  return { ok: true, releaseId, warnings: r.compat?.warnings ?? [] }
}

export function rollback(slug, channel = 'production') {
  const r = applyRollback(loadRegistry(), { slug, channel, now: now() })
  if (!r.ok) return r
  saveRegistry(r.registry)
  audit(r.audit)
  return { ok: true, from: r.from, to: r.to, warnings: r.warnings }
}

export function setDisabled(slug, disabled, channel = 'production') {
  const r = applySetDisabled(loadRegistry(), { slug, disabled, channel, now: now() })
  if (!r.ok) return r
  saveRegistry(r.registry)
  audit(r.audit)
  return { ok: true }
}

/** Compare a built story folder with what a channel currently serves. */
export function checkStoryCompat(storyDir, channel = 'production') {
  const v = validateStory(storyDir)
  if (!v.manifest) return { ok: false, errors: v.errors }
  const story = loadRegistry().stories.find((s) => s.storyId === v.manifest.storyId)
  const current = story ? channelRelease(story, channel) : null
  if (!current) return { ok: true, blocking: [], warnings: [`no ${channel} release yet — nothing to be compatible with`], first: true }
  const currentManifest = releaseManifest(story.slug, current.releaseId)
  if (!currentManifest) return { ok: false, errors: [`release files for ${current.releaseId} not found in ${hostDir()}`] }
  return { ...checkCompatibility(currentManifest, v.manifest), against: current.releaseId }
}

/* ── scaffolding ────────────────────────────────────────────────────── */
export function newStory(slug, { template = 'quick', title } = {}) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, errors: ['slug must be lowercase letters, digits, and dashes'] }
  const dir = join(REPO, 'stories', slug)
  if (existsSync(dir)) return { ok: false, errors: [`stories/${slug} already exists`] }
  const files = scaffoldStory({ slug, template, title, storyId: crypto.randomUUID() })
  writeTree(dir, files)
  return { ok: true, dir, files: [...files.keys()] }
}

/** Story folders under stories/ (those with a storyframe.json). */
export function listStories() {
  const root = join(REPO, 'stories')
  if (!existsSync(root)) return []
  return readdirSync(root).filter((n) => existsSync(join(root, n, 'storyframe.json'))).sort()
}
