/**
 * The declarative builder — replaces every per-book build-package.mjs.
 *
 * Input:  the story folder as a file map + its storyframe.json (with a
 *         `build` block) + the SDK IIFE text.
 * Output: the package as a file map — one self-contained HTML entry, the
 *         effective manifest, and the cover.
 *
 * Exactly one of four source modes:
 *   entry     "src/index.html"            an HTML file; relative scripts/styles/assets inlined
 *   concat    ["src/00-head.html", "@sdk", "src/app.js", …]   joined in order (the legacy-wrap lane)
 *   quickbook { source: "book.md", theme } compiled by the Quick Book compiler
 *   prebuilt  "prebuilt"                  a finished package folder, copied then stamped
 *
 * The SDK goes wherever the author put `@sdk` (concat), `<!-- storyframe:sdk -->`,
 * or `<script src="./storyframe-sdk.js"></script>`. CI runs only this code —
 * never a script from the story folder.
 */
import { z } from 'zod'
import { toText, toBytes, normalizePath, extOf } from './files.js'
import { createInliner, stampCsp, stampReleaseAttr } from './inline.js'
import { STORY_CSP_META } from './policy.js'
import { compileQuickBook } from './quickbook/compile.js'

export const BuildSchema = z.object({
  entry: z.string().min(1).optional(),
  concat: z.array(z.string().min(1)).min(1).optional(),
  quickbook: z.object({
    source: z.string().min(1).default('book.md'),
    theme: z.string().min(1).optional(),
  }).optional(),
  prebuilt: z.string().min(1).optional(),
  inline: z.object({
    scripts: z.boolean().default(true),
    styles: z.boolean().default(true),
    images: z.boolean().default(true),
    fonts: z.boolean().default(true),
    media: z.boolean().default(true),
  }).default({}),
  stripExternalFonts: z.boolean().default(true),
}).refine((b) => [b.entry, b.concat, b.quickbook, b.prebuilt].filter(Boolean).length === 1, {
  message: 'build needs exactly one of: entry, concat, quickbook, prebuilt',
})

export const sdkTag = (sdk) => `<script>\n${sdk}\nwindow.Storyframe = StoryframeSDK.Storyframe;\n</script>`
const SDK_MARKERS = [
  /<!--\s*storyframe:sdk\s*-->/i,
  /<script\b[^>]*\bsrc\s*=\s*["'][^"']*storyframe-sdk(?:\.iife)?\.js["'][^>]*>\s*<\/script>/i,
]

/** Detect which lane a source folder belongs to — used by the Admin Studio. */
export function detectLane(manifest) {
  const b = manifest?.build ?? {}
  if (b.quickbook) return 'quick'
  if (b.prebuilt) return 'prebuilt'
  if (b.concat) return 'wrap'
  if (b.entry) return 'native'
  return null
}

/**
 * @param {object} input
 * @param {Map<string, Uint8Array>} input.source   story folder (storyframe.json, src/, assets/, book.md, cover…)
 * @param {object} [input.manifest]                raw manifest; defaults to source storyframe.json
 * @param {string} input.sdk                       storyframe-sdk.iife.js text
 * @returns {{ ok:boolean, files:Map<string,Uint8Array>, manifest:object|null, log:{errors:string[],warnings:string[],notes:string[]}, lane:string|null }}
 */
export function buildPackage({ source, manifest: rawManifest, sdk, themeOverride }) {
  const log = { errors: [], warnings: [], notes: [] }
  const fail = (msg) => { if (msg) log.errors.push(msg); return { ok: false, files: new Map(), manifest: null, log, lane: null } }

  let manifest = rawManifest
  if (!manifest) {
    const text = source.get('storyframe.json')
    if (!text) return fail('storyframe.json is missing from the story folder')
    try { manifest = JSON.parse(toText(text)) } catch (e) { return fail('storyframe.json is not valid JSON: ' + e.message) }
  }
  manifest = structuredClone(manifest)
  if (!manifest.build) return fail('storyframe.json has no "build" block — see docs/BOOK-AUTHORING.md §Build')
  const parsedBuild = BuildSchema.safeParse(manifest.build)
  if (!parsedBuild.success) return fail('build: ' + parsedBuild.error.issues.map((i) => `${i.path.join('.')} ${i.message}`.trim()).join('; '))
  const build = parsedBuild.data
  if (typeof sdk !== 'string' || !sdk.includes('StoryframeSDK')) return fail('SDK text not provided — run `npm run sdk:build`')

  for (const path of source.keys()) {
    if (/(^|\/)build-package\.m?js$/.test(path)) log.notes.push(`ignored ${path} — the declarative builder never runs story scripts`)
  }

  const inliner = createInliner(source, log, build.inline)
  const entryName = normalizePath(manifest.entrypoint ?? 'index.html') ?? 'index.html'
  manifest.entrypoint = entryName
  const out = new Map()
  let html = null
  let lane = detectLane(manifest)

  if (build.quickbook) {
    const srcPath = normalizePath(build.quickbook.source)
    const md = srcPath && source.get(srcPath)
    if (!md) return fail(`quickbook source ${build.quickbook.source} not found`)
    const compiled = compileQuickBook({ markdown: toText(md), manifest, theme: build.quickbook.theme, themeOverride })
    log.errors.push(...compiled.errors)
    log.warnings.push(...compiled.warnings)
    if (compiled.errors.length) return { ok: false, files: out, manifest: compiled.manifest, log, lane }
    manifest = compiled.manifest
    html = inliner.html(compiled.html, srcPath.includes('/') ? srcPath.replace(/[^/]+$/, 'index.html') : 'index.html', { stripExternalFonts: build.stripExternalFonts })
  } else if (build.concat) {
    const parts = []
    for (const ref of build.concat) {
      if (ref === '@sdk') { parts.push('<!-- storyframe:sdk -->'); continue }   // filled after inlining
      const path = normalizePath(ref)
      if (!path || !source.has(path)) return fail(`concat part not found: ${ref}`)
      parts.push(toText(source.get(path)).replace(/\s+$/, ''))
    }
    // concatenated parts are resolved relative to the first part's folder
    const base = normalizePath(build.concat.find((r) => r !== '@sdk')) ?? 'index.html'
    html = inliner.html(parts.join('\n'), base, { stripExternalFonts: build.stripExternalFonts })
  } else if (build.entry) {
    const path = normalizePath(build.entry)
    if (!path || !source.has(path)) return fail(`build.entry not found: ${build.entry}`)
    html = inliner.html(toText(source.get(path)), path, { stripExternalFonts: build.stripExternalFonts })
  } else if (build.prebuilt) {
    const dir = normalizePath(build.prebuilt)
    if (!dir) return fail('build.prebuilt must be a relative folder')
    for (const [path, bytes] of source) {
      if (path.startsWith(dir + '/')) out.set(path.slice(dir.length + 1), bytes)
    }
    if (!out.has(entryName)) return fail(`prebuilt folder has no ${entryName}`)
    html = toText(out.get(entryName))
  }

  /* SDK slot: required for every lane except prebuilt (which must carry its own).
     Filled after inlining so the SDK text is never rewritten by the inliner. */
  const marker = SDK_MARKERS.find((re) => re.test(html))
  if (marker) html = html.replace(marker, () => sdkTag(sdk))
  else if (!build.prebuilt && !html.includes('StoryframeSDK')) {
    log.errors.push('no SDK slot found — add <!-- storyframe:sdk --> (or <script src="./storyframe-sdk.js"></script>) before your story script')
  }
  if (build.prebuilt && !html.includes('StoryframeSDK') && !html.includes('Storyframe.connect'))
    log.warnings.push('prebuilt entry does not appear to include the Storyframe SDK')

  const withCsp = stampCsp(html, STORY_CSP_META)
  if (withCsp === null) return fail(`${entryName} has no <head> — cannot stamp the story CSP`)
  html = stampReleaseAttr(withCsp)
  out.set(entryName, toBytes(html))

  /* cover: copied from the source root (manifest.cover, default cover.svg) */
  const coverName = normalizePath(manifest.cover ?? 'cover.svg')
  if (coverName && source.has(coverName)) out.set(coverName, source.get(coverName))
  else if (!out.has(coverName ?? '')) log.errors.push(`cover not found: ${manifest.cover ?? 'cover.svg'} (svg, png, webp, or jpg)`)

  /* effective manifest travels with the package (the release gate validates THIS) */
  out.set('storyframe.json', toBytes(JSON.stringify(manifest, null, 2) + '\n'))

  if (build.concat || build.entry || build.quickbook) {
    const unused = [...source.keys()].filter((p) => /^(assets|src)\//.test(p) && !inliner.used.has(p)
      && !(build.concat ?? []).includes(p) && p !== normalizePath(build.entry ?? '') && !/\.(md|txt)$/.test(p))
    if (unused.length) log.notes.push(`not referenced by the book (left out of the package): ${unused.slice(0, 8).join(', ')}${unused.length > 8 ? '…' : ''}`)
  }
  if (!['html', 'htm'].includes(extOf(entryName))) log.warnings.push(`entrypoint ${entryName} is not an .html file`)

  return { ok: log.errors.length === 0, files: out, manifest, log, lane }
}
