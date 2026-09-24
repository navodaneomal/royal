/* _headers generation, registry operations, commit planning, docx import,
   release notes, and scaffolding — the pure pieces of the hosting pipeline. */
import { describe, it, expect } from 'vitest'
import {
  storiesHeaders, appHeaders, singleOriginHeaders, STORY_CSP,
  applyPublish, applyPromote, applyRollback, applySetDisabled, emptyRegistry, channelRelease,
  planStoryCommit, publishCommitMessage, htmlToQuickBookMarkdown, extractReleaseNotes,
  scaffoldStory, TEMPLATES, buildPackage, validatePackage, compileQuickBook, packFiles, stampReleaseFiles,
} from '@storyframe/publishing'
import { ManifestSchema } from '@storyframe/protocol'
import { sdkText, fileMap, text, json } from '../helpers/index.js'

/** parse a _headers file into [{ pattern, headers: [[k, v]] }] */
const parseHeaders = (src) => {
  const rules = []
  for (const line of src.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue
    if (!line.startsWith(' ')) rules.push({ pattern: line, headers: [] })
    else rules.at(-1).headers.push(line.trim().split(/:\s(.*)/s).slice(0, 2))
  }
  return rules
}
const matches = (pattern, path) => new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace('*', '.*') + '$').test(path)
const headersFor = (rules, path) => rules.filter((r) => matches(r.pattern, path)).flatMap((r) => r.headers)

describe('_headers', () => {
  const files = {
    stories: storiesHeaders({ appOrigins: ['https://app.example.pages.dev'] }),
    app: appHeaders({ storyOrigins: ['https://stories.example.pages.dev'], connectOrigins: ['https://abc.supabase.co'] }),
    single: singleOriginHeaders(),
  }
  it('stays inside Cloudflare limits (≤100 rules, ≤2000 chars/line, one splat)', () => {
    for (const src of Object.values(files)) {
      const rules = parseHeaders(src)
      expect(rules.length).toBeLessThanOrEqual(100)
      expect(src.split('\n').every((l) => l.length <= 2000)).toBe(true)
      expect(rules.every((r) => (r.pattern.match(/\*/g) ?? []).length <= 1)).toBe(true)
    }
  })
  it('never lets two rules set the same header on one path (Cloudflare comma-joins them)', () => {
    const paths = {
      stories: ['/registry.json', '/audit-log.json', '/packages/x/r1/index.html', '/share/x.html'],
      app: ['/', '/index.html', '/assets/a.js', '/config.json', '/sw.js'],
      single: ['/', '/stories-host/packages/x/r1/index.html', '/stories-host/registry.json'],
    }
    for (const [name, list] of Object.entries(paths)) {
      const rules = parseHeaders(files[name])
      for (const path of list) {
        const names = headersFor(rules, path).map(([k]) => k.toLowerCase())
        expect(new Set(names).size, `${name} ${path}: ${names}`).toBe(names.length)
      }
    }
  })
  it('stories: immutable packages with the story CSP; fresh pointers; exact CORS origin', () => {
    const rules = parseHeaders(files.stories)
    const pkg = Object.fromEntries(headersFor(rules, '/packages/neon/r123/index.html'))
    expect(pkg['Cache-Control']).toContain('immutable')
    expect(pkg['Content-Security-Policy']).toContain(STORY_CSP)
    expect(pkg['Content-Security-Policy']).toContain('frame-ancestors https://app.example.pages.dev')
    expect(pkg['Access-Control-Allow-Origin']).toBe('https://app.example.pages.dev')
    expect(Object.fromEntries(headersFor(rules, '/registry.json'))['Cache-Control']).toBe('no-cache')
  })
  it('app: frames only the stories origin + blob:, and the CSP never lands on story HTML in starter mode', () => {
    const app = Object.fromEntries(headersFor(parseHeaders(files.app), '/'))
    expect(app['Content-Security-Policy']).toMatch(/frame-src 'self' blob: https:\/\/stories\.example\.pages\.dev/)
    expect(app['Content-Security-Policy']).toContain('connect-src')
    expect(app['Content-Security-Policy']).toContain('https://api.github.com')
    const story = Object.fromEntries(headersFor(parseHeaders(files.single), '/stories-host/packages/x/r1/index.html'))
    expect(story['Content-Security-Policy']).toContain("script-src 'unsafe-inline'")
    expect(story['Content-Security-Policy']).not.toContain("script-src 'self'")
  })
})

const M = (over = {}) => ManifestSchema.parse({
  storyId: '11111111-2222-4333-8444-555555555555', slug: 'book', version: '1.0.0', protocolVersion: '1.0', stateSchemaVersion: 1,
  title: 'Book', entrypoint: 'index.html', languages: ['en'], defaultLanguage: 'en',
  content: { rating: 'everyone', estimatedMinutes: { firstSession: 1, total: [1, 2] } },
  accessibility: { keyboard: true, screenReader: true, reducedMotion: true, captions: true, untimedMode: true, nonAudioAlternative: true },
  offline: { eligible: true }, checkpoints: [{ id: 'a', label: 'A', order: 10 }, { id: 'b', label: 'B', order: 20 }], ...over,
})
const publish = (reg, manifest, releaseId, channel) =>
  applyPublish(reg, { manifest, releaseId, packageHash: releaseId.slice(1).padEnd(64, '0'), totalBytes: 100, channel, now: '2026-09-24T00:00:00Z', validation: {} }).registry

describe('registry operations', () => {
  it('a beta publish never changes what production plays (per-release meta)', () => {
    let reg = publish(emptyRegistry(), M(), 'r000000000001', 'production')
    reg = publish(reg, M({ version: '1.1.0', title: 'Book (beta)', checkpoints: [{ id: 'a', label: 'A', order: 10 }] }), 'r000000000002', 'beta')
    const story = reg.stories[0]
    expect(channelRelease(story, 'production').meta.checkpoints).toHaveLength(2)
    expect(channelRelease(story, 'beta').meta.checkpoints).toHaveLength(1)
    expect(story.title).toBe('Book')                    // mirrors production, not the newest publish
  })
  it('promotion into production is compat-gated; rollback warns across schema versions', () => {
    let reg = publish(emptyRegistry(), M(), 'r000000000001', 'production')
    const breaking = M({ version: '2.0.0', checkpoints: [{ id: 'a', label: 'A', order: 10 }] })
    reg = publish(reg, breaking, 'r000000000002', 'beta')
    const blocked = applyPromote(reg, { slug: 'book', releaseId: 'r000000000002', manifests: { current: M(), candidate: breaking }, now: 'x' })
    expect(blocked.ok).toBe(false)
    expect(blocked.errors.join()).toMatch(/stateSchemaVersion/)
    const fixed = M({ version: '2.0.0', stateSchemaVersion: 2, checkpoints: [{ id: 'a', label: 'A', order: 10 }], migrations: [{ from: 1, to: 2, checkpoints: { b: 'a' } }] })
    reg = publish(reg, fixed, 'r000000000003', 'beta')
    const ok = applyPromote(reg, { slug: 'book', releaseId: 'r000000000003', manifests: { current: M(), candidate: fixed }, now: 'x' })
    expect(ok.ok).toBe(true)
    expect(ok.audit).toMatchObject({ action: 'promote', from: 'r000000000001' })
    const back = applyRollback(ok.registry, { slug: 'book', now: 'y' })
    expect(back.ok).toBe(true)
    expect(back.to).toBe('r000000000002')
    expect(applySetDisabled(back.registry, { slug: 'book', disabled: true, now: 'z' }).registry.stories[0].channels.production.disabled).toBe(true)
  })
})

describe('publishing plumbing', () => {
  it('plans a one-commit publish: upserts, deletions, and never package/ or build scripts', () => {
    const plan = planStoryCommit({
      slug: 'book',
      files: fileMap({ 'storyframe.json': '{}', 'book.md': '# x', 'package/index.html': 'x', 'build-package.mjs': 'x', 'assets/a.png': 'x' }),
      existing: [{ path: 'stories/book/old.md' }, { path: 'stories/book/book.md' }, { path: 'stories/other/x' }],
    })
    expect(plan.upserts.map((u) => u.path).sort()).toEqual(['stories/book/assets/a.png', 'stories/book/book.md', 'stories/book/storyframe.json'])
    expect(plan.deletes).toEqual(['stories/book/old.md'])
    expect(plan.skipped.sort()).toEqual(['build-package.mjs', 'package/index.html'])
    expect(publishCommitMessage('book', '1.2.0')).toBe('publish(book): v1.2.0')
    expect(() => planStoryCommit({ slug: '../evil', files: new Map() })).toThrow()
  })
  it('stamps the release id and records integrity of the stamped bytes', () => {
    const files = fileMap({ 'index.html': '<html data-sf-release="__SF_RELEASE_ID__">', 'cover.svg': '<svg/>' })
    const { releaseId, packageHash } = packFiles(files)
    const out = stampReleaseFiles(files, { entrypoint: 'index.html', releaseId, packageHash, generatedAt: 'now' })
    expect(text(out.files.get('index.html'))).toContain(releaseId)
    expect(json(out.files.get('integrity.json')).files['index.html']).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
  it('turns mammoth HTML into a Quick Book (headings, emphasis, images → assets)', () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    const r = htmlToQuickBookMarkdown(`<h1>My Book</h1><h2>Start</h2><p>It <strong>was</strong> a <em>dark</em> night&hellip;</p><p><img src="data:image/png;base64,${png}" alt="a dot" /></p><ul><li>one</li><li>two</li></ul><h2>End</h2><p>Fin.</p>`)
    expect(r.markdown).toContain('# My Book')
    expect(r.markdown).toContain('## Start')
    expect(r.markdown).toContain('It **was** a *dark* night…')
    expect(r.markdown).toContain('![a dot](assets/image-1.png)')
    expect(r.markdown).toContain('- one')
    expect(r.assets.get('assets/image-1.png').byteLength).toBeGreaterThan(20)
    const compiled = compileQuickBook({ markdown: r.markdown, manifest: { storyId: '11111111-2222-4333-8444-555555555555' } })
    expect(compiled.errors).toEqual([])
    expect(compiled.manifest.checkpoints.map((c) => c.id)).toEqual(['start', 'end'])
  })
  it('extracts the release notes for a version', () => {
    const md = '# Changelog\n\n## 1.1.0 — 2026-09-01\n\nNew chapter.\n\n## 1.0.0\n\nFirst.'
    expect(extractReleaseNotes(md, '1.0.0')).toBe('First.')
    expect(extractReleaseNotes(md, '9.9.9')).toBe('New chapter.')
  })
  it('every scaffold template builds and passes the release gate', () => {
    for (const template of TEMPLATES) {
      const source = scaffoldStory({ slug: 'starter', template, storyId: crypto.randomUUID() })
      const b = buildPackage({ source, sdk: sdkText() })
      expect(b.log.errors, template).toEqual([])
      const v = validatePackage({ manifest: b.manifest, files: b.files })
      expect(v.errors, template).toEqual([])
    }
  })
})
