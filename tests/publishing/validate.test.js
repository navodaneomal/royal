/* The release gate, exercised gate by gate on in-memory packages. */
import { describe, it, expect } from 'vitest'
import { validatePackage, buildPackage, STORY_CSP_META, toBytes } from '@storyframe/publishing'
import { sdkText, storySource } from '../helpers/index.js'

const good = () => buildPackage({ source: storySource('neon-horizon'), sdk: sdkText() })
const withFile = (files, path, content) => { const m = new Map(files); m.set(path, toBytes(content)); return m }
const codes = (v) => v.issues.map((i) => i.code)
const entry = (files) => new TextDecoder().decode(files.get('index.html'))

describe('validatePackage — pure release gate', () => {
  it('accepts a built package and reports sizes', () => {
    const b = good()
    const v = validatePackage({ manifest: b.manifest, files: b.files })
    expect(v.ok).toBe(true)
    expect(v.totalBytes).toBeGreaterThan(20000)
    expect(v.issues.every((i) => typeof i.fix === 'string' && i.fix.length > 10)).toBe(true)
  })

  it('accepts JSON text as the manifest and rejects broken JSON', () => {
    const b = good()
    expect(validatePackage({ manifest: JSON.stringify(b.manifest), files: b.files }).ok).toBe(true)
    expect(codes(validatePackage({ manifest: '{ nope', files: b.files }))).toContain('manifest_json')
  })

  it('refuses external origins in attributes, CSS, and imports — with a fix line', () => {
    const b = good()
    const html = entry(b.files)
    for (const leak of [
      '<img src="https://cdn.example.com/x.png" alt="x">',
      '<div style="background:url(https://evil.example/p.png)"></div>',
      '<style>@import url("https://fonts.example/f.css");</style>',
      '<script src="//cdn.example.org/lib.js"></script>',
    ]) {
      const v = validatePackage({ manifest: b.manifest, files: withFile(b.files, 'index.html', html.replace('</body>', leak + '</body>')) })
      expect(v.ok).toBe(false)
      expect(codes(v)).toContain('external_origin')
    }
  })

  it('refuses absolute network calls', () => {
    const b = good()
    for (const call of ['fetch("https://x.example/")', "new WebSocket('wss://x.example')", 'navigator.sendBeacon(`https://x.example`)']) {
      const v = validatePackage({ manifest: b.manifest, files: withFile(b.files, 'index.html', entry(b.files).replace('</body>', `<script>${call}</script></body>`)) })
      expect(codes(v)).toContain('network_call')
    }
  })

  it('requires the story CSP meta in the entrypoint', () => {
    const b = good()
    const v = validatePackage({ manifest: b.manifest, files: withFile(b.files, 'index.html', entry(b.files).replace(STORY_CSP_META, '')) })
    expect(codes(v)).toContain('csp_meta_missing')
  })

  it('enforces the 25 MiB per-file cap and the declared budget', () => {
    const b = good()
    const big = new Map(b.files)
    big.set('huge.bin', new Uint8Array(25 * 1024 * 1024 + 1))
    const v = validatePackage({ manifest: { ...b.manifest, offline: { ...b.manifest.offline, maxBytes: 64 * 1024 * 1024 } }, files: big })
    expect(codes(v)).toContain('file_cap')
    const tight = validatePackage({ manifest: { ...b.manifest, offline: { ...b.manifest.offline, maxBytes: 1024 } }, files: b.files })
    expect(codes(tight)).toContain('budget')
  })

  it('flags duplicate ids, missing entry, missing cover, img without alt, unsafe paths', () => {
    const b = good()
    const m = structuredClone(b.manifest)
    m.items.push({ ...m.items[0] })
    expect(codes(validatePackage({ manifest: m, files: b.files }))).toContain('duplicate_id')
    const noEntry = new Map(b.files); noEntry.delete('index.html')
    expect(codes(validatePackage({ manifest: b.manifest, files: noEntry }))).toContain('entry_missing')
    const noCover = new Map(b.files); noCover.delete('cover.svg')
    expect(codes(validatePackage({ manifest: b.manifest, files: noCover }))).toContain('cover_missing')
    const img = withFile(b.files, 'index.html', entry(b.files).replace('</body>', '<img src="data:image/png;base64,AA=="></body>'))
    expect(codes(validatePackage({ manifest: b.manifest, files: img }))).toContain('img_alt')
    expect(codes(validatePackage({ manifest: b.manifest, files: withFile(b.files, '../escape.txt', 'x') }))).toContain('bad_path')
  })

  it('ties capabilities to protocol versions (notes.write needs 1.1)', () => {
    const b = good()
    const m = { ...b.manifest, capabilities: [...b.manifest.capabilities, 'notes.write'] }
    expect(codes(validatePackage({ manifest: m, files: b.files }))).toContain('capability_protocol')
    expect(validatePackage({ manifest: { ...m, protocolVersion: '1.1' }, files: b.files }).ok).toBe(true)
  })

  it('requires keyboard + screen reader declarations', () => {
    const b = good()
    const m = { ...b.manifest, accessibility: { ...b.manifest.accessibility, screenReader: false } }
    expect(codes(validatePackage({ manifest: m, files: b.files }))).toContain('a11y_required')
  })

  it('checks that migration targets exist in the release', () => {
    const b = good()
    const m = { ...b.manifest, stateSchemaVersion: 2, migrations: [{ from: 1, to: 2, checkpoints: { old: 'nowhere' } }] }
    expect(codes(validatePackage({ manifest: m, files: b.files }))).toContain('migration_target')
    const ok = { ...b.manifest, stateSchemaVersion: 2, migrations: [{ from: 1, to: 2, checkpoints: { old: 'hall' } }] }
    expect(validatePackage({ manifest: ok, files: b.files }).ok).toBe(true)
  })
})
