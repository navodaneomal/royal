/* The composer engine: plain-text import, starter books, and one-call
   compose → the same release gate CI runs. */
import { describe, it, expect } from 'vitest'
import {
  textToQuickBookMarkdown, composeQuickBook, stampComposed, nextVersion, lockChapterIds,
  STARTER_BOOKS, starterBook, renderInline, sha256Hex, toText,
} from '@storyframe/publishing'
import { sdkText } from '../helpers/index.js'

const sdk = sdkText()
const ID = '11111111-2222-4333-8444-555555555555'

describe('plain text → Quick Book', () => {
  it('finds the title, chapters in every common spelling, and scene breaks', () => {
    const r = textToQuickBookMarkdown([
      'THE GLASS ORCHARD', '', 'Prologue', '', 'Before.', '',
      'CHAPTER ONE', '', 'It rained.', '', '* * *', '', 'It stopped.', '',
      'Chapter 2: The Thaw', '', 'Melt.', '', 'Part III', '', 'Later.', '', 'IV', '', 'Last.',
    ].join('\n'))
    expect(r.title).toBe('The Glass Orchard')
    expect(r.chapters).toBe(5)
    expect(r.markdown).toMatch(/^# The Glass Orchard\n/)
    expect(r.markdown).toMatch(/^## Prologue$/m)
    expect(r.markdown).toMatch(/^## Chapter One$/m)
    expect(r.markdown).toMatch(/^## Chapter 2: The Thaw$/m)
    expect(r.markdown).toMatch(/^## Part III$/m)
    expect(r.markdown).toMatch(/^## IV$/m)
    expect(r.markdown).toMatch(/\n---\n/)
  })
  it('calms shouting headings without breaking roman numerals', () => {
    const r = textToQuickBookMarkdown('Book\n\nCHAPTER TWO: Downstream\n\nText.\n\nPART IV\n\nMore.\n\nChapter 3 — The Weir\n\nEnd.')
    expect(r.markdown).toMatch(/^## Chapter Two: Downstream$/m)
    expect(r.markdown).toMatch(/^## Part IV$/m)
    expect(r.markdown).toMatch(/^## Chapter 3 — The Weir$/m)
  })
  it('keeps plain text plain: lines that look like Markdown or directives are escaped', () => {
    const r = textToQuickBookMarkdown('Title\n\nChapter 1\n\n# 1 fan\n- dash line\n:::not a directive\n> not a quote')
    expect(r.markdown).toContain('\\# 1 fan')
    expect(r.markdown).toContain('\\- dash line')
    expect(r.markdown).toContain('\\:::not a directive')
    expect(renderInline('\\# 1 fan')).toBe('# 1 fan')
    expect(renderInline('\\*not em\\*')).toBe('*not em*')
    expect(renderInline('`\\*`')).toBe('<code>\\*</code>')
  })
  it('gives chapterless text one chapter, and leaves real Markdown alone', () => {
    expect(textToQuickBookMarkdown('Just a paragraph of story.').markdown).toMatch(/^## Chapter 1\n\nJust a paragraph/)
    const md = '# Mine\n\n## One {#one}\n\nText.\n'
    expect(textToQuickBookMarkdown(md)).toMatchObject({ markdown: md, converted: false, chapters: 1, title: 'Mine' })
  })
})

describe('composeQuickBook', () => {
  for (const b of STARTER_BOOKS) {
    it(`starter "${b.id}" passes the release gate in the ${b.theme} theme`, () => {
      const r = composeQuickBook({ markdown: b.markdown, theme: b.theme, sdk, storyId: ID })
      expect(r.issues.filter((i) => i.severity === 'error')).toEqual([])
      expect(r.ok).toBe(true)
      expect(r.summary.chapters).toBeGreaterThanOrEqual(2)
      expect(r.summary.releaseId).toMatch(/^r[0-9a-f]{12}$/)
      expect(r.manifest.build.quickbook.theme).toBe(b.theme)
    })
  }
  it('fills the boring parts: slug, version, tagline, cover, accessibility, locked chapter ids', () => {
    const r = composeQuickBook({ markdown: '# The Quiet Pier\n\nWaves, mostly.\n\n## Morning\n\nGulls.\n\n## Night\n\nStars.\n', sdk, storyId: ID })
    expect(r.ok).toBe(true)
    expect(r.summary).toMatchObject({ title: 'The Quiet Pier', slug: 'the-quiet-pier', version: '1.0.0', tagline: 'Waves, mostly.', chapters: 2 })
    expect(r.manifest.accessibility).toMatchObject({ keyboard: true, screenReader: true })
    expect(toText(r.source.get('book.md'))).toMatch(/^## Morning \{#morning\}$/m)
    expect(toText(r.source.get('cover.svg'))).toMatch(/^<svg/)
    expect(r.source.has('CHANGELOG.md')).toBe(true)
  })
  it('updating keeps the identity and bumps the patch version', () => {
    const r = composeQuickBook({ markdown: starterBook('fox').markdown, sdk, existing: { storyId: ID, slug: 'my-fox', version: '1.2.9' } })
    expect(r.summary).toMatchObject({ storyId: ID, slug: 'my-fox', version: '1.2.10' })
    expect(nextVersion('nonsense')).toBe('1.0.0')
  })
  it('is deterministic: same text + same identity → same release id', () => {
    const a = composeQuickBook({ markdown: starterBook('signal').markdown, sdk, storyId: ID })
    const b = composeQuickBook({ markdown: starterBook('signal').markdown, sdk, storyId: ID })
    expect(a.summary.releaseId).toBe(b.summary.releaseId)
  })
  it('reports problems as fixable issues instead of throwing', () => {
    const r = composeQuickBook({ markdown: '# No chapters here\n\nJust words.', sdk, storyId: ID })
    expect(r.ok).toBe(false)
    expect(r.issues.some((g) => g.severity === 'error' && /chapter/i.test(g.items.join(' ')))).toBe(true)
  })
  it('stamps a package whose integrity manifest matches its bytes', () => {
    const st = stampComposed(composeQuickBook({ markdown: starterBook('poems').markdown, sdk, storyId: ID }), '2026-10-04T00:00:00.000Z')
    expect(st.integrity.files[st.entrypoint]).toBe('sha256:' + sha256Hex(st.entry))
    expect(toText(st.entry)).not.toMatch(/__SF_RELEASE_ID__/)
  })
  it('lockChapterIds only touches chapters without an id', () => {
    expect(lockChapterIds('## A\n## B {#b}\n### C', [{ id: 'a' }, { id: 'b' }])).toBe('## A {#a}\n## B {#b}\n### C')
  })
})
