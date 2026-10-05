/**
 * One call from "some text" to "a book that passes the release gate" — the
 * engine behind the one-screen composer (#/add, Studio → Publish).
 *
 * Fills in everything an author should not have to think about: a fresh
 * storyId (or the existing book's, when updating), slug from the title, the
 * next patch version, a generated cover matched to the theme, accessibility
 * declarations the Quick Book runtime guarantees, chapter ids locked into
 * book.md so later renames can never strand readers — and then runs the SAME
 * builder, validator, and release-id hash CI runs.
 */
import { toBytes, toText } from './files.js'
import { parseFrontMatter } from './quickbook/frontmatter.js'
import { slugify } from './quickbook/markdown.js'
import { baseManifest } from './scaffold.js'
import { generateCover } from './cover.js'
import { buildPackage } from './build.js'
import { validatePackage, groupIssues } from './validate.js'
import { packFiles, stampReleaseFiles } from './pack.js'
import { smartLink, titleFromUrl, linkedManifest } from './link.js'
import { COVER_EXTENSIONS } from './policy.js'

export const THEME_COVER = {
  manuscript: { palette: 'manuscript', motif: 'lantern' },
  terminal: { palette: 'terminal', motif: 'grid' },
  watercolor: { palette: 'watercolor', motif: 'leaf' },
  noir: { palette: 'noir', motif: 'door' },
  minimal: { palette: 'minimal', motif: 'horizon' },
}
const KEEP_FRONT_MATTER = ['minutes', 'kicker', 'language']

/** "1.4.2" → "1.4.3"; anything unparsable → "1.0.0". */
export function nextVersion(previous) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(previous ?? ''))
  return m ? `${m[1]}.${m[2]}.${Number(m[3]) + 1}` : '1.0.0'
}

/** Write each derived chapter id back into book.md: `## The Storm` → `## The Storm {#the-storm}`. */
export function lockChapterIds(md, checkpoints) {
  let i = 0
  return String(md).split(/\r?\n/).map((line) => {
    const m = /^##\s+(.*?)\s*(\{[^}]*\})?\s*$/.exec(line)
    if (!m || /^###/.test(line)) return line
    const cp = checkpoints[i++]
    return m[2] || !cp ? line : `## ${m[1]} {#${cp.id}}`
  }).join('\n')
}

/**
 * @param {object} o
 * @param {string} o.markdown           the book (front matter optional)
 * @param {string} o.sdk                storyframe-sdk.iife.js text
 * @param {string} [o.title] [o.tagline] [o.theme] [o.rating]   explicit choices beat front matter
 * @param {string[]} [o.warnings]
 * @param {{storyId:string, slug:string, version?:string}} [o.existing]   update this book
 * @param {string} [o.storyId]          identity for a new book (default: random UUID)
 * @param {string} [o.slug]             address for a new book (default: from the title)
 * @param {Map<string,Uint8Array>} [o.assets]   images etc. under assets/
 * @param {{palette?:string, motif?:string}} [o.cover]
 * @param {string} [o.now]              ISO time for the stamped integrity manifest
 */
export function composeQuickBook(o) {
  const fm = parseFrontMatter(String(o.markdown ?? ''))
  const data = fm.data ?? {}
  const body = fm.body.replace(/^\n+/, '')
  const h1 = /^#\s+(.+?)\s*$/m.exec(body)?.[1]
  const title = (o.title || data.title || h1 || 'Untitled book').toString().trim()
  const theme = (o.theme || data.theme || 'manuscript').toString().toLowerCase()
  const rating = (o.rating || data.rating || 'everyone').toString()
  const warnings = o.warnings ?? (data.warnings !== undefined ? [].concat(data.warnings).map(String) : [])
  const storyId = o.existing?.storyId ?? o.storyId ?? globalThis.crypto.randomUUID()
  const slug = o.existing?.slug ?? (o.slug ? slugify(o.slug, 'untitled-book') : slugify(title, 'untitled-book'))
  const version = o.existing ? nextVersion(o.existing.version) : '1.0.0'
  const firstPara = body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^(#|:|!\[|>|[-*+]\s|\d+[.)]\s|---)/.test(p)) ?? ''
  const tagline = (o.tagline || data.tagline || firstPara.replace(/[*_`\\]/g, '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s/)[0] || 'A Quick Book.').toString().trim().slice(0, 140)

  const manifest = baseManifest({ storyId, slug, title, template: 'quick' })
  Object.assign(manifest, { version, tagline, synopsis: (data.synopsis ?? '').toString() })
  if (data.accent) manifest.accent = String(data.accent)
  manifest.build = { quickbook: { source: 'book.md', theme } }
  manifest.content = { ...manifest.content, rating, warnings }

  const keep = Object.fromEntries(Object.entries(data).filter(([k]) => KEEP_FRONT_MATTER.includes(k)))
  const keepFm = Object.keys(keep).length ? `---\n${Object.entries(keep).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`).join('\n')}\n---\n` : ''
  const bookText = keepFm + (h1 ? body : `# ${title}\n\n${body}`)

  const look = { ...(THEME_COVER[theme] ?? THEME_COVER.manuscript), ...(o.cover ?? {}) }
  const cover = generateCover({ title, subtitle: tagline.length <= 60 ? tagline : '', palette: look.palette, motif: look.motif })

  const source = new Map([
    ['storyframe.json', toBytes(JSON.stringify(manifest, null, 2) + '\n')],
    ['book.md', toBytes(bookText)],
    ['cover.svg', toBytes(cover.svg)],
    ...[...(o.assets ?? new Map())].map(([p, b]) => [p.startsWith('assets/') ? p : `assets/${p}`, b]),
  ])

  // first pass derives checkpoint ids; lock them into book.md, then build for real
  let build = buildPackage({ source, sdk: o.sdk })
  if (build.ok && build.manifest?.checkpoints?.length) {
    const locked = lockChapterIds(bookText, build.manifest.checkpoints)
    if (locked !== bookText) { source.set('book.md', toBytes(locked)); build = buildPackage({ source, sdk: o.sdk }) }
  }
  const validation = build.ok ? validatePackage({ manifest: build.manifest, files: build.files }) : null
  const pack = build.ok ? packFiles(build.files) : null
  const buildIssues = (build.log?.errors ?? []).map((m) => ({ severity: 'error', code: 'build', message: m, fix: 'Fix the line named here — everything rebuilds as you type.' }))
  const issues = groupIssues([...buildIssues, ...(validation?.issues ?? [])])
  const m = build.manifest ?? manifest
  const words = (toText(source.get('book.md')).match(/[\p{L}\p{N}’']+/gu) ?? []).length
  if (!source.has('CHANGELOG.md')) source.set('CHANGELOG.md', toBytes(`# Changelog\n\n## ${version}\n\n${o.existing ? 'A new edition.' : 'First edition.'}\n`))

  return {
    ok: !!validation?.ok,
    manifest: m, source, build, validation, pack, issues, cover,
    summary: {
      title, slug, storyId, version, theme, rating, tagline, words,
      chapters: m.checkpoints?.length ?? 0, secrets: m.items?.length ?? 0, choices: m.choices?.length ?? 0,
      endings: m.endings?.length ?? 0, achievements: m.achievements?.length ?? 0,
      minutes: m.content?.estimatedMinutes?.total ?? null,
      releaseId: pack?.releaseId ?? null, totalBytes: validation?.totalBytes ?? 0,
    },
  }
}

/** The stamped single-file package + integrity, ready to keep on a device or preview. */
export function stampComposed(composed, now = new Date().toISOString()) {
  if (!composed.ok) return null
  const { build, pack } = composed
  const entrypoint = build.manifest.entrypoint
  const stamped = stampReleaseFiles(build.files, { entrypoint, releaseId: pack.releaseId, packageHash: pack.packageHash, generatedAt: now })
  return { files: stamped.files, integrity: stamped.integrity, entry: stamped.files.get(entrypoint), entrypoint }
}

/* ── linked books (ADR-0014) ──────────────────────────────────────────── */
export const LINK_COVER = {
  web: { palette: 'sea', motif: 'horizon' }, pdf: { palette: 'dusk', motif: 'door' }, epub: { palette: 'watercolor', motif: 'lantern' },
  flipbook: { palette: 'manuscript', motif: 'leaf' }, audio: { palette: 'forest', motif: 'waves' }, video: { palette: 'noir', motif: 'orbit' },
  other: { palette: 'minimal', motif: 'grid' },
}

/**
 * A book hosted elsewhere → a publishable card: smart link handling, title
 * from the URL when none is given, a generated cover (or the uploaded one),
 * the next version when updating — then the same builder, gate, and hash.
 * @param {object} o  { url, title?, author?, tagline?, synopsis?, kind?, open?, rating?, warnings?, minutes?, language?,
 *                      storyId?, slug?, existing?, coverFile?: { name, bytes }, cover?: { palette, motif } }
 */
export function composeLinkedBook(o) {
  const link = smartLink(o.url)
  const fail = (message) => ({
    ok: false, link, manifest: null, source: new Map(), build: null, validation: null, pack: null, cover: null,
    issues: [{ severity: 'error', code: 'link_url', items: [message], fix: 'Paste the full address of the book (https://…).' }],
    summary: { title: o.title ?? '', slug: '', storyId: '', version: '', kind: o.kind ?? 'web', open: o.open ?? 'tab', host: '', url: '', releaseId: null, totalBytes: 0, embeddable: false, note: '' },
  })
  if (!link.ok) return fail(link.error)
  const title = String(o.title || titleFromUrl(link.url)).trim().slice(0, 120)
  const kind = o.kind ?? link.kind
  const open = o.open ?? link.open
  const storyId = o.existing?.storyId ?? o.storyId ?? globalThis.crypto.randomUUID()
  const slug = o.existing?.slug ?? (o.slug ? slugify(o.slug, 'linked-book') : slugify(title, 'linked-book'))
  const version = o.existing ? nextVersion(o.existing.version) : '1.0.0'
  const author = o.author ? String(o.author).trim().slice(0, 120) : undefined
  const tagline = String(o.tagline || (author ? `By ${author}` : `Hosted on ${link.host}`)).slice(0, 140)

  let coverName = 'cover.svg'
  let coverBytes
  let cover = null
  const ext = o.coverFile ? String(o.coverFile.name).split('.').pop().toLowerCase() : ''
  if (o.coverFile && COVER_EXTENSIONS.includes(ext)) {
    coverName = `cover.${ext === 'jpeg' ? 'jpg' : ext}`
    coverBytes = o.coverFile.bytes
  } else {
    const look = { ...(LINK_COVER[kind] ?? LINK_COVER.web), ...(o.cover ?? {}) }
    cover = generateCover({ title, subtitle: author ? `by ${author}` : link.host, palette: look.palette, motif: look.motif })
    coverBytes = toBytes(cover.svg)
  }

  const manifest = linkedManifest({
    storyId, slug, version, title, tagline, synopsis: o.synopsis ?? '', cover: coverName,
    url: link.url, open, kind, author, rating: o.rating ?? 'everyone', warnings: o.warnings ?? [],
    minutes: o.minutes ?? [20, 60], language: o.language ?? 'en', accessibility: o.accessibility ?? {},
  })
  const source = new Map([
    ['storyframe.json', toBytes(JSON.stringify(manifest, null, 2) + '\n')],
    [coverName, coverBytes],
    ['CHANGELOG.md', toBytes(`# Changelog\n\n## ${version}\n\n${o.existing ? 'Updated link card.' : 'Linked from ' + link.host + '.'}\n`)],
  ])
  const build = buildPackage({ source })
  const validation = build.ok ? validatePackage({ manifest: build.manifest, files: build.files }) : null
  const pack = build.ok ? packFiles(build.files) : null
  const buildIssues = (build.log?.errors ?? []).map((m) => ({ severity: 'error', code: 'build', message: m, fix: 'Fix the field named here.' }))
  return {
    ok: !!validation?.ok, link, manifest: build.manifest ?? manifest, source, build, validation, pack, cover,
    issues: groupIssues([...buildIssues, ...(validation?.issues ?? [])]),
    summary: {
      title, slug, storyId, version, kind, open, host: link.host, url: link.url, author: author ?? '', tagline,
      releaseId: pack?.releaseId ?? null, totalBytes: validation?.totalBytes ?? 0, embeddable: link.embeddable, note: link.note,
    },
  }
}
