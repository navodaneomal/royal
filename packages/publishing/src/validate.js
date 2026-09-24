/**
 * The release gate — pure. `validatePackage({ manifest, files })` is the one
 * function the CLI (`storyframe validate`), CI, and the Admin Studio's
 * "Validate" step all call; the only difference between them is who filled
 * the file map. Each issue carries a one-line "how to fix".
 */
import {
  ManifestSchema, SUPPORTED_PROTOCOLS, CAPABILITY_MIN_PROTOCOL, protocolAtLeast, composeMigrations,
} from '@storyframe/protocol'
import { toText, isTextPath, extOf, normalizePath, formatBytes } from './files.js'
import { MAX_FILE_BYTES, HEAVY_FILE_BYTES, ENTRY_GUIDANCE_BYTES, COVER_EXTENSIONS } from './policy.js'

/* external-origin detectors: attributes, CSS, and network APIs */
const EXTERNAL_PATTERNS = [
  { re: /(?:\bsrc|\bhref|\bsrcset|\bposter|\bdata|\baction)\s*=\s*["']\s*(?:https?:)?\/\/([^"'/\s>]+)/gi, what: 'attribute' },
  { re: /url\(\s*["']?\s*(?:https?:)?\/\/([^"')/\s]+)/gi, what: 'CSS url()' },
  { re: /@import\s+(?:url\()?\s*["']\s*(?:https?:)?\/\/([^"'/\s)]+)/gi, what: 'CSS @import' },
]
const NETWORK_API_RE = /\b(fetch|EventSource|WebSocket|sendBeacon|importScripts)\s*\(\s*["'`](?:https?|wss?):\/\//i
const XHR_RE = /\.open\(\s*["'][A-Z]+["']\s*,\s*["'`]https?:\/\//i

const issue = (severity, code, message, fix) => ({ severity, code, message, fix })

const FIX = {
  schema: 'Edit storyframe.json (or the Manifest step in the Admin Studio) so this field matches the schema in docs/BOOK-AUTHORING.md.',
  external: 'Inline the asset (the declarative builder does this for relative paths) or remove the link; packages may not reach other origins.',
  network: 'Remove network calls — packages run with connect-src \'none\'. Keep data in the package or in progress state.',
  entry: 'Make sure `entrypoint` names a file inside the package (usually index.html) and rebuild.',
  storyId: 'Pass the manifest storyId to Storyframe.connect({ storyId }) — Quick Books and the builder do this automatically.',
  budget: 'Compress or remove assets, or raise offline.maxBytes honestly (readers download all of it).',
  fileCap: 'Split or compress the file; Cloudflare Pages refuses any single file over 25 MiB.',
  a11y: 'Make the story fully keyboard- and screen-reader-operable, then declare it (see docs/accessibility.md).',
  alt: 'Give every meaningful image alt text (decorative images: alt="" plus aria-hidden).',
  csp: 'Build with `storyframe build` (it stamps the story CSP into <head>); prebuilt packages get it too.',
  cover: 'Add the cover file named by `cover` in the manifest (svg, png, webp, or jpg) — or generate one in the Admin Studio.',
  ids: 'IDs must be unique within their list; rename the duplicate.',
  protocol: 'Set protocolVersion to a version this host supports, or drop the capability that needs a newer one.',
  migration: 'Point every migration target at an ID that exists in this manifest (see "IDs and stateSchemaVersion" in docs/BOOK-AUTHORING.md).',
  path: 'Rename the file: package paths must be relative, without "..", drive letters, or NUL bytes.',
}

/**
 * @param {object} input
 * @param {object|string} input.manifest   raw manifest (object or JSON text)
 * @param {Map<string, Uint8Array>} input.files   package files, keyed by relative path
 * @returns {{ ok:boolean, errors:string[], warnings:string[], issues:object[], manifest?:object, totalBytes:number, entryBytes:number, fileCount:number }}
 */
export function validatePackage({ manifest: rawManifest, files }) {
  const issues = []
  const add = (...args) => issues.push(issue(...args))
  const done = (manifest, totalBytes = 0, entryBytes = 0) => {
    const errors = issues.filter((i) => i.severity === 'error')
    const warnings = issues.filter((i) => i.severity === 'warning')
    return {
      ok: errors.length === 0,
      errors: errors.map((i) => i.message),
      warnings: warnings.map((i) => i.message),
      issues, manifest, totalBytes, entryBytes, fileCount: files?.size ?? 0,
    }
  }

  /* 1. manifest */
  let raw = rawManifest
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch (e) {
      add('error', 'manifest_json', 'storyframe.json is not valid JSON: ' + e.message, FIX.schema)
      return done()
    }
  }
  if (!raw || typeof raw !== 'object') { add('error', 'manifest_missing', 'storyframe.json is missing', FIX.schema); return done() }
  const parsed = ManifestSchema.safeParse(raw)
  if (!parsed.success) {
    for (const i of parsed.error.issues.slice(0, 12)) add('error', 'manifest_schema', `manifest: ${i.path.join('.') || '(root)'} — ${i.message}`, FIX.schema)
    return done()
  }
  const manifest = parsed.data

  if (!SUPPORTED_PROTOCOLS.includes(manifest.protocolVersion))
    add('error', 'protocol', `protocolVersion ${manifest.protocolVersion} unsupported (host supports ${SUPPORTED_PROTOCOLS.join(', ')})`, FIX.protocol)
  for (const cap of manifest.capabilities) {
    const min = CAPABILITY_MIN_PROTOCOL[cap]
    if (min && !protocolAtLeast(manifest.protocolVersion, min))
      add('error', 'capability_protocol', `capability ${cap} needs protocolVersion ${min} (manifest says ${manifest.protocolVersion})`, FIX.protocol)
  }

  /* 2. unique IDs across every registry the reducer trusts */
  for (const [kind, list] of [
    ['checkpoint', manifest.checkpoints.map((c) => c.id)],
    ['item', manifest.items.map((i) => i.id)],
    ['achievement', manifest.achievements.map((a) => a.id)],
    ['choice', manifest.choices.map((c) => c.id)],
    ['ending', manifest.endings.map((e) => e.id)],
  ]) {
    const seen = new Set()
    for (const id of list) {
      if (seen.has(id)) add('error', 'duplicate_id', `duplicate ${kind} id: ${id}`, FIX.ids)
      seen.add(id)
    }
  }
  const orders = manifest.checkpoints.map((c) => c.order)
  if (new Set(orders).size !== orders.length)
    add('warning', 'checkpoint_order', 'two checkpoints share an `order` — resume position between them is ambiguous', 'Give every checkpoint a distinct order (10, 20, 30… leaves room to insert).')
  for (const c of manifest.choices) {
    if (new Set(c.options).size !== c.options.length) add('error', 'duplicate_option', `choice ${c.id} lists an option twice`, FIX.ids)
  }
  for (const item of manifest.items) {
    if (item.spoilerCheckpoint && !manifest.checkpoints.some((c) => c.id === item.spoilerCheckpoint))
      add('error', 'unknown_spoiler_checkpoint', `item ${item.id}: spoilerCheckpoint ${item.spoilerCheckpoint} is not a checkpoint`, FIX.ids)
  }

  /* 3. migrations point at real things, and a chain reaches this version */
  const known = {
    checkpoints: new Set(manifest.checkpoints.map((c) => c.id)),
    items: new Set(manifest.items.map((i) => i.id)),
    achievements: new Set(manifest.achievements.map((a) => a.id)),
    choices: new Set(manifest.choices.map((c) => c.id)),
    endings: new Set(manifest.endings.map((e) => e.id)),
  }
  for (const m of manifest.migrations) {
    if (m.to > manifest.stateSchemaVersion)
      add('error', 'migration_future', `migration ${m.from}→${m.to} goes past stateSchemaVersion ${manifest.stateSchemaVersion}`, FIX.migration)
  }
  const oldest = Math.min(...manifest.migrations.map((m) => m.from), manifest.stateSchemaVersion)
  if (oldest < manifest.stateSchemaVersion) {
    const composed = composeMigrations(manifest.migrations, oldest, manifest.stateSchemaVersion)
    if (!composed) add('error', 'migration_gap', `migrations do not chain from v${oldest} to v${manifest.stateSchemaVersion}`, FIX.migration)
    else {
      for (const kind of Object.keys(known)) {
        for (const [from, to] of Object.entries(composed[kind])) {
          if (to !== null && !known[kind].has(to))
            add('error', 'migration_target', `migration maps ${kind.slice(0, -1)} ${from} → ${to}, which does not exist in this release`, FIX.migration)
        }
      }
      for (const [choiceId, options] of Object.entries(composed.choiceOptions)) {
        const choice = manifest.choices.find((c) => c.id === choiceId || c.id === composed.choices[choiceId])
        for (const to of Object.values(options)) {
          if (choice && !choice.options.includes(to)) add('error', 'migration_target', `migration maps an option of ${choiceId} to ${to}, which is not an option`, FIX.migration)
        }
      }
    }
  }

  /* 4. files: paths, per-file cap, totals */
  let total = 0
  const entryPath = normalizePath(manifest.entrypoint)
  for (const [path, bytes] of files) {
    if (normalizePath(path) !== path) add('error', 'bad_path', `unsafe package path: ${path}`, FIX.path)
    total += bytes.byteLength
    if (bytes.byteLength > MAX_FILE_BYTES) add('error', 'file_cap', `${path} is ${formatBytes(bytes.byteLength)} — over the 25 MiB per-file limit`, FIX.fileCap)
    else if (bytes.byteLength > HEAVY_FILE_BYTES) add('warning', 'heavy_file', `${path} is ${formatBytes(bytes.byteLength)} — heavy for readers on mobile data`, FIX.budget)
  }
  if (files.size > 200) add('warning', 'file_count', `${files.size} files in one package — Cloudflare Pages allows 20,000 per site in total`, 'Prefer inlining; the builder produces one HTML file per book.')
  if (total > manifest.offline.maxBytes)
    add('error', 'budget', `package ${formatBytes(total)} exceeds its declared offline.maxBytes ${formatBytes(manifest.offline.maxBytes)}`, FIX.budget)
  else if (total > 0.9 * manifest.offline.maxBytes)
    add('warning', 'budget_near', 'package is within 10% of its size budget', FIX.budget)

  /* 5. cover */
  if (!COVER_EXTENSIONS.includes(extOf(manifest.cover)))
    add('error', 'cover_type', `cover ${manifest.cover} must be svg, png, webp, or jpg`, FIX.cover)
  else if (!files.has(normalizePath(manifest.cover) ?? ''))
    add('error', 'cover_missing', `cover file missing from package: ${manifest.cover}`, FIX.cover)
  else if (files.get(normalizePath(manifest.cover)).byteLength > 2 * 1024 * 1024)
    add('warning', 'cover_heavy', 'cover is over 2 MB — the shelf loads every cover', 'Export the cover at ~600×800 as webp or svg.')

  /* 6. entrypoint content */
  const entry = entryPath ? files.get(entryPath) : undefined
  let entryBytes = 0
  if (!entry) add('error', 'entry_missing', `entrypoint missing in package: ${manifest.entrypoint}`, FIX.entry)
  else {
    entryBytes = entry.byteLength
    const html = toText(entry)
    if (!html.includes(manifest.storyId))
      add('error', 'entry_story_id', 'entrypoint does not reference the manifest storyId — SDK connect would be rejected', FIX.storyId)
    if (!/<meta[^>]+http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*connect-src 'none'/i.test(html))
      add('error', 'csp_meta_missing', 'entrypoint has no story CSP <meta> (offline copies would run without connect-src \'none\')', FIX.csp)
    if (entryBytes > ENTRY_GUIDANCE_BYTES)
      add('warning', 'entry_heavy', `entry HTML is ${formatBytes(entryBytes)} — over the 500 KB first-interaction guidance`, 'Lazy-reveal heavy art, or compress images before inlining.')
    const imgs = html.match(/<img\b[^>]*>/gi) ?? []
    const noAlt = imgs.filter((tag) => !/\balt\s*=/.test(tag) && !/aria-hidden\s*=\s*["']true/.test(tag)).length
    if (noAlt) add('error', 'img_alt', `${noAlt} <img> element(s) without alt text`, FIX.alt)
    if (!imgs.length && !/alt\s*=|aria-label/i.test(html))
      add('warning', 'no_labels', 'no alt/aria-label attributes found in entry HTML — check imagery', FIX.alt)
  }

  /* 7. self-containment: every text file */
  const hosts = new Map()
  for (const [path, bytes] of files) {
    if (!isTextPath(path)) continue
    const text = toText(bytes)
    for (const { re, what } of EXTERNAL_PATTERNS) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(text))) {
        const host = m[1].toLowerCase()
        if (host === 'www.w3.org') continue                    // XML namespaces are identifiers, not fetches
        if (!hosts.has(host)) hosts.set(host, `${path} (${what})`)
      }
    }
    if (NETWORK_API_RE.test(text) || XHR_RE.test(text))
      add('error', 'network_call', `${path} calls the network with an absolute URL`, FIX.network)
  }
  for (const [host, where] of hosts)
    add('error', 'external_origin', `undeclared external origin in package: ${host} — ${where} (packages must be self-contained)`, FIX.external)

  /* 8. accessibility declarations */
  const a = manifest.accessibility
  if (!a.keyboard || !a.screenReader)
    add('error', 'a11y_required', 'accessibility: keyboard and screenReader support are required for promotion', FIX.a11y)
  if (!a.reducedMotion) add('warning', 'a11y_motion', 'accessibility.reducedMotion is false — readers who need still pages will be warned', FIX.a11y)

  return done(manifest, total, entryBytes)
}

/** Group issues for display: [{ severity, code, items: [...] }] errors first. */
export function groupIssues(issues) {
  const groups = new Map()
  for (const i of issues) {
    const key = `${i.severity}:${i.code}`
    if (!groups.has(key)) groups.set(key, { severity: i.severity, code: i.code, fix: i.fix, items: [] })
    groups.get(key).items.push(i.message)
  }
  return [...groups.values()].sort((x, y) => (x.severity === y.severity ? 0 : x.severity === 'error' ? -1 : 1))
}
