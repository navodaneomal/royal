/* The declarative builder: every lane, the SDK slot, inlining, and the
   rules that keep CI from ever running story code. */
import { describe, it, expect } from 'vitest'
import { buildPackage, packFiles, validatePackage, STORY_CSP_META } from '@storyframe/publishing'
import { sdkText, storySource, fileMap, text } from '../helpers/index.js'

const ID = '11111111-2222-4333-8444-555555555555'
const manifest = (build, extra = {}) => ({
  storyId: ID, slug: 'fixture', version: '1.0.0', protocolVersion: '1.0', stateSchemaVersion: 1,
  title: 'Fixture', entrypoint: 'index.html', languages: ['en'], defaultLanguage: 'en',
  capabilities: ['progress.write'],
  content: { rating: 'everyone', warnings: [], estimatedMinutes: { firstSession: 1, total: [1, 2] } },
  accessibility: { keyboard: true, screenReader: true, reducedMotion: true, captions: true, untimedMode: true, nonAudioAlternative: true },
  offline: { eligible: true, maxBytes: 1024 * 1024 },
  checkpoints: [{ id: 'start', label: 'Start', order: 10 }],
  build, ...extra,
})
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><!-- c --><rect width="10" height="10" fill="#123"/></svg>'

describe('entry lane', () => {
  const source = fileMap({
    'storyframe.json': JSON.stringify(manifest({ entry: 'src/index.html' })),
    'cover.svg': SVG,
    'src/index.html': `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X"><link rel="stylesheet" href="style.css"></head>
<body><img src="../assets/pic.svg" alt="a picture"><!-- storyframe:sdk --><script src="story.js" defer></script></body></html>`,
    'src/style.css': '@font-face{font-family:F;src:url("../assets/f.woff2")} body{background:url(../assets/pic.svg)}',
    'src/story.js': `const s = '${ID}'; const t = "</script>";`,
    'assets/pic.svg': SVG,
    'assets/f.woff2': 'wOF2fake',
    'build-package.mjs': 'process.exit(1)',
  })
  const r = buildPackage({ source, sdk: sdkText() })
  const html = text(r.files.get('index.html'))

  it('builds a single self-contained file that passes the gate', () => {
    expect(r.log.errors).toEqual([])
    expect([...r.files.keys()].sort()).toEqual(['cover.svg', 'index.html', 'storyframe.json'])
    expect(validatePackage({ manifest: r.manifest, files: r.files }).ok).toBe(true)
  })
  it('inlines scripts (escaping </script), styles, images, and fonts', () => {
    expect(html).not.toMatch(/src="story\.js"/)
    expect(html).toContain('<\\/script>')
    expect(html).toContain('data:image/svg+xml,')
    expect(html).toContain('data:font/woff2;base64,')
    expect(html).not.toContain('href="style.css"')
  })
  it('strips external font links and hints, stamps CSP + release, fills the SDK slot', () => {
    expect(html).not.toContain('fonts.googleapis.com')
    expect(html).toContain(STORY_CSP_META)
    expect(html).toMatch(/<html data-sf-release="__SF_RELEASE_ID__"/)
    expect(html).toContain('StoryframeSDK')
    expect(html).not.toContain('storyframe:sdk')
  })
  it('never runs or ships build scripts, and warns about defer', () => {
    expect(r.log.notes.join()).toContain('never runs story scripts')
    expect(r.log.warnings.join()).toContain('defer ignored')
  })
  it('is deterministic', () => {
    const again = buildPackage({ source, sdk: sdkText() })
    expect(packFiles(again.files).releaseId).toBe(packFiles(r.files).releaseId)
  })
})

describe('guards', () => {
  it('refuses references that escape the story folder', () => {
    const r = buildPackage({
      sdk: sdkText(),
      source: fileMap({
        'storyframe.json': JSON.stringify(manifest({ entry: 'index.html' })),
        'cover.svg': SVG,
        'index.html': `<html><head><meta charset="utf-8"></head><body><!-- storyframe:sdk --><script src="../../.github/secret.js"></script>${ID}</body></html>`,
      }),
    })
    expect(r.log.errors.join()).toMatch(/missing script/)
  })
  it('requires exactly one source mode and an SDK slot', () => {
    expect(buildPackage({ sdk: sdkText(), source: fileMap({ 'storyframe.json': JSON.stringify(manifest({ entry: 'a', concat: ['b'] })) }) }).log.errors.join()).toMatch(/exactly one/)
    const r = buildPackage({ sdk: sdkText(), source: fileMap({ 'storyframe.json': JSON.stringify(manifest({ entry: 'index.html' })), 'cover.svg': SVG, 'index.html': '<html><head></head><body></body></html>' }) })
    expect(r.log.errors.join()).toMatch(/no SDK slot/)
  })
  it('refuses a missing build block with a pointer to the docs', () => {
    const m = manifest(undefined); delete m.build
    expect(buildPackage({ sdk: sdkText(), source: fileMap({ 'storyframe.json': JSON.stringify(m) }) }).log.errors.join()).toMatch(/BOOK-AUTHORING/)
  })
})

describe('concat + prebuilt lanes', () => {
  it('reproduces the Tulip wrap (concat with @sdk)', () => {
    const r = buildPackage({ source: storySource('the-tulip-and-the-jester'), sdk: sdkText() })
    expect(r.log.errors).toEqual([])
    const html = text(r.files.get('index.html'))
    expect(html.indexOf('StoryframeSDK')).toBeLessThan(html.indexOf('Storyframe integration for THE TULIP'))
    expect(html).not.toContain('fonts.googleapis')
  })
  it('copies a prebuilt package and still stamps the CSP', () => {
    const r = buildPackage({
      sdk: sdkText(),
      source: fileMap({
        'storyframe.json': JSON.stringify(manifest({ prebuilt: 'dist' })),
        'cover.svg': SVG,
        'dist/index.html': `<!doctype html><html><head><meta charset="utf-8"></head><body><script>var StoryframeSDK;/*${ID}*/</script></body></html>`,
        'dist/extra.txt': 'kept',
      }),
    })
    expect(r.log.errors).toEqual([])
    expect(text(r.files.get('index.html'))).toContain(STORY_CSP_META)
    expect(r.files.has('extra.txt')).toBe(true)
  })
})
