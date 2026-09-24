/* Quick Book compiler: directive parsing, ID generation, error reporting,
   manifest derivation, and the rule that author text is always escaped. */
import { describe, it, expect } from 'vitest'
import {
  compileQuickBook, parseFrontMatter, parseAttrs, slugify, buildPackage, validatePackage, THEME_NAMES,
} from '@storyframe/publishing'
import { sdkText, storySource, fileMap, text } from '../helpers/index.js'

const ID = '11111111-2222-4333-8444-555555555555'
const base = { storyId: ID, slug: 'qb', version: '1.0.0', cover: 'cover.svg', build: { quickbook: { source: 'book.md' } } }
const compile = (md, extra = {}) => compileQuickBook({ markdown: md, manifest: base, ...extra })

describe('front matter + attributes', () => {
  it('parses scalars, inline lists, and block lists', () => {
    const fm = parseFrontMatter('---\ntitle: "A: B"\nminutes: 12\ndraft: false\nwarnings: [storms, "lost at sea"]\ntags:\n  - one\n  - two\n---\n# Body')
    expect(fm.data).toEqual({ title: 'A: B', minutes: 12, draft: false, warnings: ['storms', 'lost at sea'], tags: ['one', 'two'] })
    expect(fm.body.trim()).toBe('# Body')
    expect(fm.bodyLine).toBe(10)
  })
  it('parses directive attributes', () => {
    expect(parseAttrs('{id="a b" name=\'X\' secret hint=glint #anchor}')).toEqual({ id: 'anchor', name: 'X', secret: true, hint: 'glint' })
  })
  it('slugifies headings deterministically', () => {
    expect(slugify('Chapter One — The Harbour!')).toBe('chapter-one-the-harbour')
    expect(slugify('Élan & Café')).toBe('elan-and-cafe')
  })
})

describe('compiling the reference book', () => {
  const src = storySource('the-keeper-of-wend-light')
  const r = compileQuickBook({ markdown: text(src.get('book.md')), manifest: JSON.parse(text(src.get('storyframe.json'))), theme: 'watercolor' })

  it('compiles with no errors and derives the manifest from the text', () => {
    expect(r.errors).toEqual([])
    expect(r.manifest.checkpoints.map((c) => [c.id, c.order])).toEqual([['almanac', 10], ['storm', 20], ['morning', 30]])
    expect(r.manifest.items.map((i) => i.id)).toEqual(['sea-pink', 'keepers-note', 'last-entry'])
    expect(r.manifest.items[0].spoilerCheckpoint).toBe('almanac')
    expect(r.manifest.achievements.find((a) => a.id === 'between-the-lines').secret).toBe(true)
    expect(r.manifest.choices).toEqual([{ id: 'the-signal', label: expect.any(String), options: ['answer', 'hold'] }])
    expect(r.manifest.endings.map((e) => e.id)).toEqual(['answered', 'steady'])
    expect(r.manifest.protocolVersion).toBe('1.1')
    expect(r.manifest.capabilities).toContain('notes.write')
  })
  it('hides branches, secrets, and achievements until the runtime reveals them', () => {
    expect(r.html).toMatch(/<div class="qb-branch" data-choice="the-signal" data-option="answer" hidden>/)
    expect(r.html).toMatch(/class="qb-secret-body" id="qb-s1" hidden/)
    expect(r.html).toMatch(/data-achievement="first-light" data-name="First Light" hidden/)
  })
  it('builds into a package that passes the release gate in every theme', () => {
    for (const theme of THEME_NAMES) {
      const b = buildPackage({ source: src, sdk: sdkText(), themeOverride: theme })
      expect(b.log.errors).toEqual([])
      const v = validatePackage({ manifest: b.manifest, files: b.files })
      expect(v.errors).toEqual([])
      expect(text(b.files.get('index.html'))).toContain(`data-theme="${theme}"`)
      expect(text(b.files.get('index.html'))).toContain('data:image/svg+xml,')   // assets/wend-light.svg inlined
    }
  })
})

describe('ids, errors, and warnings', () => {
  it('generates ids from headings and warns that they are unstable', () => {
    const r = compile('# T\n\n## The First Night\n\nText.\n\n## The First Night\n\nMore.')
    expect(r.manifest.checkpoints.map((c) => c.id)).toEqual(['the-first-night', 'the-first-night-2'])
    expect(r.errors.join()).toMatch(/used twice/)
    expect(r.warnings.join()).toMatch(/no explicit \{#id\}/)
  })
  it('reports missing alt text, unknown directives, unclosed blocks, bad branches — with line numbers', () => {
    const r = compile([
      '## One {#one}', '', '![](assets/x.png)', '',
      ':::secret{id="s" name="S"}', 'x', ':::', '',
      ':::portal{id="p"}', 'y', ':::', '',
      ':::choice{id="c"}', '- a: A', '- b: B', ':::', '',
      ':::branch{choice="c" option="z"}', 'z', ':::', '',
      ':::ending{id="e"}', 'never closed',
    ].join('\n'))
    const all = r.errors.join('\n')
    expect(all).toMatch(/line 3: image assets\/x\.png needs alt text/)
    expect(all).toMatch(/line 5: :::secret needs alt=/)
    expect(all).toMatch(/line 9: unknown directive :::portal/)
    expect(all).toMatch(/branch option "z" is not an option of c/)
    expect(all).toMatch(/line 22: :::ending is never closed/)
  })
  it('needs at least one chapter and a known theme', () => {
    expect(compile('# Only a title').errors.join()).toMatch(/at least one/)
    expect(compile('## A {#a}\n\nx', { themeOverride: 'vaporwave' }).errors.join()).toMatch(/unknown theme/)
  })
  it('keeps link text but drops external URLs', () => {
    const r = compile('## A {#a}\n\nSee [the site](https://example.com) and [chapter](#a).')
    expect(r.html).not.toContain('example.com')
    expect(r.html).toContain('<a href="#a" class="qb-xref">chapter</a>')
    expect(r.warnings.join()).toMatch(/plain text/)
  })
})

describe('safety', () => {
  it('escapes every character of author text — no raw HTML reaches the package', () => {
    const r = compile('## <img src=x onerror=alert(1)> {#a}\n\n<script>alert(1)</script> **<b>bold</b>**\n\n:::secret{id="s" name="<i>x</i>" alt="\\"><script>"}\nhi\n:::')
    expect(r.html).not.toMatch(/<script>alert/)
    expect(r.html).not.toMatch(/<img src=x/)
    expect(r.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(r.html).not.toContain('<i>x</i>')
  })
  it('an assembled Quick Book package is self-contained', () => {
    const b = buildPackage({
      sdk: sdkText(),
      source: fileMap({
        'storyframe.json': JSON.stringify({ ...base, title: 'Tiny' }),
        'book.md': '## One {#one}\n\nHello.',
        'cover.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
      }),
    })
    expect(b.log.errors).toEqual([])
    expect(validatePackage({ manifest: b.manifest, files: b.files }).ok).toBe(true)
  })
})
