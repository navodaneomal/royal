/* Linked books (ADR-0014): smart links, list import, the card-only package,
   registry metadata, the CSP allowlist, and an end-to-end CLI publish. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  smartLink, titleFromUrl, parseLinkList, composeLinkedBook, linkedManifest, linkedFrameOrigins,
  validatePackage, buildPackage, applyPublish, emptyRegistry, toBytes, toText, appCsp,
} from '@storyframe/publishing'
import { ManifestSchema } from '@storyframe/protocol'

const ID = '22222222-3333-4444-8555-666666666666'

describe('smartLink', () => {
  it('fixes the scheme, upgrades http, and refuses anything that is not a web page', () => {
    expect(smartLink('example.com/book').url).toBe('https://example.com/book')
    expect(smartLink('http://example.com/a.pdf')).toMatchObject({ ok: true, url: 'https://example.com/a.pdf', kind: 'pdf', open: 'tab' })
    expect(smartLink('http://localhost:8080/book').url).toBe('http://localhost:8080/book')
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'https://user:pw@example.com/', '']) expect(smartLink(bad).ok).toBe(false)
  })
  it('turns share links into their embeddable form where the host offers one', () => {
    expect(smartLink('https://drive.google.com/file/d/1AbC_d-9/view?usp=sharing')).toMatchObject({ url: 'https://drive.google.com/file/d/1AbC_d-9/preview', open: 'embed', kind: 'pdf' })
    expect(smartLink('https://docs.google.com/document/d/XyZ/edit').url).toBe('https://docs.google.com/document/d/XyZ/preview')
    expect(smartLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ').url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(smartLink('https://youtu.be/dQw4w9WgXcQ').url).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(smartLink('https://vimeo.com/123456').url).toBe('https://player.vimeo.com/video/123456')
    // already-embeddable forms stay recognised (the list importer passes them through twice)
    expect(smartLink('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toMatchObject({ kind: 'video', open: 'embed' })
    expect(smartLink('https://player.vimeo.com/video/123456')).toMatchObject({ kind: 'video', open: 'embed' })
    expect(smartLink(smartLink('https://drive.google.com/file/d/X/view').url)).toMatchObject({ kind: 'pdf', open: 'embed' })
    expect(smartLink('https://heyzine.com/flip-book/abc.html')).toMatchObject({ kind: 'flipbook', open: 'embed' })
    expect(smartLink('https://www.dropbox.com/s/x/book.pdf?dl=0').url).toBe('https://www.dropbox.com/s/x/book.pdf?raw=1')
    expect(smartLink('https://www.gutenberg.org/ebooks/11')).toMatchObject({ open: 'tab', host: 'gutenberg.org' })
  })
  it('names a book from its address when no title is given', () => {
    expect(titleFromUrl('https://example.com/books/the-lantern-fox.pdf')).toBe('The Lantern Fox')
    expect(titleFromUrl('https://drive.google.com/file/d/abc/preview')).toBe('Google Drive file')
    expect(titleFromUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe('YouTube video')
    expect(titleFromUrl('https://example.com/')).toBe('example.com')
  })
})

describe('parseLinkList', () => {
  it('reads pipes, commas, "— author", bare URLs, and comments', () => {
    const r = parseLinkList([
      '# my links', 'The Lantern Fox | https://example.com/fox.pdf', 'Rain on Ninth, https://example.com/rain',
      'Small Hours — Ada Byron | example.org/hours', 'https://example.com/books/glass-orchard', 'no address on this line',
    ].join('\n'))
    expect(r.books.map((b) => [b.title, b.url, b.author ?? ''])).toEqual([
      ['The Lantern Fox', 'https://example.com/fox.pdf', ''], ['Rain on Ninth', 'https://example.com/rain', ''],
      ['Small Hours', 'https://example.org/hours', 'Ada Byron'], ['Glass Orchard', 'https://example.com/books/glass-orchard', ''],
    ])
    expect(r.errors).toEqual(['line 6: no web address found'])
  })
  it('reads a CSV export with quoted cells', () => {
    const r = parseLinkList('title,author,url\n"Fox, The",Mara,https://example.com/fox\nPier,,https://example.com/pier')
    expect(r.books).toEqual([
      { title: 'Fox, The', author: 'Mara', url: 'https://example.com/fox', line: 2 },
      { title: 'Pier', url: 'https://example.com/pier', line: 3 },
    ])
  })
})

describe('composeLinkedBook', () => {
  it('makes a card-only package that passes the release gate', () => {
    const r = composeLinkedBook({ url: 'https://example.com/books/the-quiet-pier.pdf', author: 'Ada Byron', storyId: ID })
    expect(r.ok).toBe(true)
    expect(r.summary).toMatchObject({ title: 'The Quiet Pier', slug: 'the-quiet-pier', kind: 'pdf', open: 'tab', host: 'example.com', version: '1.0.0', tagline: 'By Ada Byron' })
    expect([...r.build.files.keys()].sort()).toEqual(['cover.svg', 'storyframe.json'])
    expect(ManifestSchema.parse(JSON.parse(toText(r.build.files.get('storyframe.json')))).link).toEqual({ url: 'https://example.com/books/the-quiet-pier.pdf', open: 'tab', kind: 'pdf', author: 'Ada Byron' })
    expect(r.manifest.offline.eligible).toBe(false)
    expect(r.summary.releaseId).toMatch(/^r[0-9a-f]{12}$/)
  })
  it('uses an uploaded cover, keeps identity when updating, and reports a bad link as an issue', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    const r = composeLinkedBook({ url: 'https://heyzine.com/flip-book/x.html', title: 'Atlas', coverFile: { name: 'Front.PNG', bytes: png }, existing: { storyId: ID, slug: 'atlas', version: '2.0.4' } })
    expect(r.ok).toBe(true)
    expect(r.manifest.cover).toBe('cover.png')
    expect(r.summary).toMatchObject({ storyId: ID, slug: 'atlas', version: '2.0.5', open: 'embed', kind: 'flipbook' })
    const bad = composeLinkedBook({ url: 'javascript:alert(1)' })
    expect(bad.ok).toBe(false)
    expect(bad.issues[0].items[0]).toMatch(/web addresses/)
  })
  it('the gate refuses extra files and non-https links in a linked package', () => {
    const m = linkedManifest({ storyId: ID, slug: 'x', title: 'X', url: 'https://example.com/x' })
    const files = new Map([['storyframe.json', toBytes(JSON.stringify(m))], ['cover.svg', toBytes('<svg/>')], ['index.html', toBytes('<script>alert(1)</script>')]])
    expect(validatePackage({ manifest: m, files }).errors.join()).toMatch(/only its card/)
    expect(validatePackage({ manifest: { ...m, link: { ...m.link, url: 'http://evil.example/x' } }, files: new Map([...files].slice(0, 2)) }).ok).toBe(false)
    expect(buildPackage({ source: new Map([['storyframe.json', toBytes(JSON.stringify(m))]]) }).log.errors.join()).toMatch(/cover not found/)
  })
  it('the registry carries the link, and only embedded links reach the app CSP', () => {
    const tab = composeLinkedBook({ url: 'https://example.com/a', storyId: ID })
    const emb = composeLinkedBook({ url: 'https://drive.google.com/file/d/abc/view', storyId: '33333333-3333-4444-8555-666666666666' })
    let reg = emptyRegistry()
    for (const c of [tab, emb]) reg = applyPublish(reg, { manifest: c.manifest, releaseId: c.pack.releaseId, packageHash: c.pack.packageHash, totalBytes: c.validation.totalBytes, validation: {}, channel: 'production', now: '2026-10-05T00:00:00Z' }).registry
    const rel = reg.stories[0].releases[0]
    expect(rel.link.url).toBe('https://example.com/a')
    expect(rel.meta.link.open).toBe('tab')
    expect(linkedFrameOrigins(reg)).toEqual(['https://drive.google.com'])
    expect(appCsp({ frameOrigins: linkedFrameOrigins(reg) })).toMatch(/frame-src 'self' blob: https:\/\/drive\.google\.com/)
  })
})

describe('CLI: a linked book end to end', () => {
  let dir, host, prev
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'sf-link-'))
    host = join(dir, 'host')
    prev = process.env.STORYFRAME_HOST_DIR
    process.env.STORYFRAME_HOST_DIR = host
    const c = composeLinkedBook({ url: 'https://www.gutenberg.org/ebooks/11', title: 'Alice', author: 'Lewis Carroll', storyId: ID })
    mkdirSync(join(dir, 'alice'))
    for (const [p, b] of c.source) writeFileSync(join(dir, 'alice', p), b)
  })
  afterAll(() => { if (prev === undefined) delete process.env.STORYFRAME_HOST_DIR; else process.env.STORYFRAME_HOST_DIR = prev; rmSync(dir, { recursive: true, force: true }) })

  it('builds without the SDK, validates, publishes, and promotes like any book', async () => {
    const lib = await import('../../packages/story-cli/src/lib.mjs')
    const story = join(dir, 'alice')
    const b = lib.buildStory(story)
    expect(b).toMatchObject({ ok: true, lane: 'link' })
    expect(lib.validateStory(story).ok).toBe(true)
    const p = lib.publishStory(story, { channel: 'beta' })
    expect(p.ok).toBe(true)
    const reg = JSON.parse(readFileSync(join(host, 'registry.json'), 'utf8'))
    expect(reg.stories[0].releases[0].link).toMatchObject({ url: 'https://www.gutenberg.org/ebooks/11', author: 'Lewis Carroll' })
    expect(lib.promote('alice', p.releaseId).ok).toBe(true)
    expect(JSON.parse(readFileSync(join(host, 'registry.json'), 'utf8')).stories[0].channels.production.releaseId).toBe(p.releaseId)
  })
})
