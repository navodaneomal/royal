/* New Book wizard — drag-and-drop first, keyboard-accessible throughout.
   Every check here is the SAME code CI runs (@storyframe/publishing):
   the builder, the release gate, the release-id hash. Publishing is one Git
   commit to stories/<slug>/; CI builds it to beta; the wizard watches the
   run and the registry until the release is really there. */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import sdkText from '@storyframe/sdk/dist/storyframe-sdk.iife.js?raw'
import {
  buildPackage, validatePackage, packFiles, groupIssues, scaffoldStory, htmlToQuickBookMarkdown, checkCompatibility,
  parseFrontMatter, toBytes, toText, formatBytes, MAX_FILE_BYTES, slugify, extOf,
} from '@storyframe/publishing'
import { useApp } from '../../context'
import { catalog, releaseFor, fetchReleaseManifest, type CatalogStory } from '../../lib/catalog'
import { adminSession } from '../../lib/admin'
import { navigate } from '../../lib/router'
import { listDrafts, loadDraft, saveDraft, discardDraft, type Draft, type Lane } from './draft'
import { unzipToMap, mapToZip, downloadBytes } from './zip'
import { gh, watchRun, type OpUpdate } from './ops'
import { ManifestEditor } from './ManifestEditor'
import { CoverStudio } from './CoverStudio'
import { Preview } from './Preview'

const STEPS = ['Lane', 'Upload', 'Manifest', 'Cover', 'Accessibility', 'Validate', 'Preview', 'Publish']
const A11Y: [string, string, string][] = [
  ['keyboard', 'Keyboard', 'Everything can be reached and used with the keyboard alone; focus is always visible; nothing traps focus.'],
  ['screenReader', 'Screen reader', 'Text is real text, images have alt text, controls have names, and changes are announced (live regions).'],
  ['reducedMotion', 'Reduced motion', 'When the reader asks for reduced or no motion, ambient animation, parallax, and auto-play stop.'],
  ['captions', 'Captions', 'Wherever audio speaks, captions or a transcript say the same thing. (No audio at all also counts.)'],
  ['untimedMode', 'Untimed mode', 'No puzzle or scene depends on a timer, or there is a way to play without one.'],
  ['nonAudioAlternative', 'No audio needed', 'The story can be fully enjoyed with sound off.'],
]
const REQUIRED_A11Y = ['keyboard', 'screenReader']
const FRONT_MATTER_KEYS = ['title', 'tagline', 'synopsis', 'accent']

function newDraft(): Draft {
  const now = new Date().toISOString()
  return { id: 'd-' + crypto.randomUUID().slice(0, 8), lane: null, step: 0, files: [], manifest: {}, a11y: {}, theme: 'manuscript',
    cover: { palette: 'dusk', motif: 'lantern', typeface: 'serif', subtitle: '', mode: 'existing' }, createdAt: now, updatedAt: now }
}

/** Write each generated chapter id back into book.md so renaming a heading later cannot break readers. */
export function lockChapterIds(md: string, checkpoints: { id: string }[]) {
  let i = 0
  return md.split(/\r?\n/).map((line) => {
    const m = /^##\s+(.*?)\s*(\{[^}]*\})?\s*$/.exec(line)
    if (!m || /^###/.test(line)) return line
    const cp = checkpoints[i++]
    return m[2] || !cp ? line : `## ${m[1]} {#${cp.id}}`
  }).join('\n')
}

/* ── draft picker (#/admin/new) ──────────────────────────────────── */
export function WizardHome() {
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  useEffect(() => { listDrafts().then(setDrafts) }, [])
  return (
    <div>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button className="btn" onClick={async () => { const d = newDraft(); await saveDraft(d); navigate(`/admin/new/${d.id}`) }}>Start a new book</button>
      </div>
      {drafts && drafts.length > 0 && (
        <>
          <h2>Drafts on this device</h2>
          <p className="small muted">The wizard saves as you go. Drafts stay until you discard them.</p>
          <ul className="list">
            {drafts.map((d) => (
              <li key={d.id}>
                <span className="grow"><strong>{d.manifest.title || 'Untitled book'}</strong> <span className="small muted">· {d.lane ?? 'no lane yet'} · step {d.step + 1} of {STEPS.length} · saved {new Date(d.updatedAt).toLocaleString()}{d.published ? ' · published' : ''}</span></span>
                <span className="btn-row" style={{ margin: 0 }}>
                  <a className="btn small" href={`#/admin/new/${d.id}`}>Resume</a>
                  <button className="btn small danger" onClick={async () => { if (confirm(`Discard the draft “${d.manifest.title || 'Untitled book'}”? This cannot be undone.`)) { await discardDraft(d.id); setDrafts(await listDrafts()) } }}>Discard draft</button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/* ── the wizard (#/admin/new/<draftId>) ──────────────────────────── */
export function Wizard({ draftId }: { draftId: string }) {
  const { toast, refreshCatalog } = useApp()
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined)   // undefined = loading, null = not found
  const [stories, setStories] = useState<CatalogStory[]>([])
  const [saved, setSaved] = useState<string>('')
  const saveTimer = useRef<number>(0)

  useEffect(() => { loadDraft(draftId).then((d) => setDraft(d ?? null)); catalog().then((c) => setStories(c.stories)) }, [draftId])
  const update = (patch: Partial<Draft> | ((d: Draft) => Draft)) => setDraft((d) => {
    const next = typeof patch === 'function' ? patch(d!) : { ...d!, ...patch }
    clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveDraft(next).then(() => setSaved(new Date().toLocaleTimeString())), 600)
    return next
  })

  const files = useMemo(() => new Map(draft?.files ?? []), [draft?.files])
  const source = useMemo(() => {
    const m = new Map(files)
    if (draft?.manifest && Object.keys(draft.manifest).length) m.set('storyframe.json', toBytes(JSON.stringify(draft.manifest, null, 2)))
    return m
  }, [files, draft?.manifest])
  const build = useMemo(() => (draft?.lane && source.has('storyframe.json') ? buildPackage({ source, sdk: sdkText }) : null), [source, draft?.lane])
  const validation = useMemo(() => (build?.ok ? validatePackage({ manifest: build.manifest, files: build.files }) : null), [build])
  const pack = useMemo(() => (build?.ok ? packFiles(build.files) : null), [build])

  const existing = stories.find((s) => s.storyId === draft?.manifest.storyId) ?? stories.find((s) => s.slug === draft?.manifest.slug) ?? null
  const locked = { storyId: !!existing, slug: !!existing, reason: existing ? `“${existing.title}” is on the shelf` : undefined }
  // adopting an existing book's identity keeps releases, progress, and the archive continuous
  useEffect(() => {
    if (draft && existing && (draft.manifest.storyId !== existing.storyId || draft.manifest.slug !== existing.slug)) {
      update((d) => ({ ...d, manifest: { ...d.manifest, storyId: existing.storyId, slug: existing.slug } }))
    }
  }, [existing?.storyId])

  if (draft === null) return <p className="callout">Draft not found. <a href="#/admin/new">Back to drafts</a></p>
  if (!draft) return null

  const step = draft.step
  const go = (n: number) => { update({ step: n }); setTimeout(() => document.getElementById('wizard-step')?.focus(), 0) }
  const a11yOk = REQUIRED_A11Y.every((k) => draft.a11y[k])
  const canGo = (n: number) => n <= 1 ? (n === 0 || !!draft.lane) : !!draft.lane && source.has('storyframe.json') && (n < 5 || a11yOk)

  return (
    <div>
      <ol className="stepper" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}><button type="button" aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : ''} disabled={!canGo(i)} onClick={() => go(i)}>{s}</button></li>
        ))}
      </ol>
      <p className="small muted" aria-live="polite">{saved ? `Draft saved ${saved}` : 'Drafts save automatically on this device.'}</p>

      <section className="panel" aria-labelledby="wizard-step" >
        <h2 id="wizard-step" tabIndex={-1} style={{ marginTop: 0 }}>{step + 1}. {STEPS[step]}</h2>
        {step === 0 && <LaneStep draft={draft} onPick={(lane) => startLane(lane, draft, update)} />}
        {step === 1 && <UploadStep draft={draft} files={files} build={build} update={update} toast={toast} />}
        {step === 2 && (
          <ManifestEditor manifest={draft.manifest} effective={build?.manifest ?? null} lane={draft.lane!} locked={locked}
            latestVersion={existing ? releaseFor(existing, 'beta')?.version ?? releaseFor(existing)?.version ?? null : null}
            onChange={(m) => update({ manifest: m })} />
        )}
        {step === 3 && (
          <CoverStudio title={draft.manifest.title ?? ''} settings={draft.cover} files={files} coverPath={draft.manifest.cover ?? 'cover.svg'}
            onSettings={(cover) => update({ cover })}
            onCover={(path, bytes) => update((d) => {
              const f = new Map(d.files)
              const old = d.manifest.cover ?? 'cover.svg'
              if (old !== path) f.delete(old)
              f.set(path, bytes)
              return { ...d, files: [...f], manifest: { ...d.manifest, cover: path } }
            })} />
        )}
        {step === 4 && <A11yStep draft={draft} update={update} />}
        {step === 5 && <ValidateStep build={build} validation={validation} pack={pack} existing={existing} />}
        {step === 6 && (build?.ok && pack
          ? <Preview files={build.files} manifest={build.manifest} releaseId={pack.releaseId} packageHash={pack.packageHash} />
          : <p className="callout bad">The book does not build yet — see Validate.</p>)}
        {step === 7 && <PublishStep draft={draft} source={source} build={build} validation={validation} pack={pack} existing={existing} update={update} onPublished={refreshCatalog} />}
      </section>

      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <button className="btn secondary" disabled={step === 0} onClick={() => go(step - 1)}>← Back</button>
        {step < STEPS.length - 1 && (
          <button className="btn" disabled={!canGo(step + 1)} onClick={() => go(step + 1)} title={!canGo(step + 1) ? (step === 4 ? 'Keyboard and screen-reader support are required' : 'Choose a lane and add your book first') : undefined}>
            Next: {STEPS[step + 1]} →
          </button>
        )}
      </div>
    </div>
  )
}

function startLane(lane: Lane, draft: Draft, update: (p: any) => void) {
  if (draft.lane === lane) return
  const storyId = draft.manifest.storyId ?? crypto.randomUUID()
  if (lane === 'quick') {
    const files = scaffoldStory({ slug: 'untitled-book', template: 'quick', storyId, title: 'Untitled book' })
    files.delete('README.md')
    const manifest = JSON.parse(toText(files.get('storyframe.json')!))
    files.delete('storyframe.json')
    manifest.build.quickbook.theme = draft.theme ?? 'manuscript'
    // front matter moves into the manifest so there is one source of truth
    const fm = parseFrontMatter(toText(files.get('book.md')!))
    files.set('book.md', toBytes(fm.body.replace(/^\n+/, '')))
    update({ lane, step: 1, files: [...files], manifest, a11y: Object.fromEntries(A11Y.map(([k]) => [k, true])), cover: { ...draft.cover, palette: 'manuscript', motif: 'lantern', mode: 'generated' } })
  } else {
    update({ lane, step: 1, files: [], manifest: { storyId }, a11y: {} })
  }
}

/* ── step 1: lane ─────────────────────────────────────────────────── */
function LaneStep({ draft, onPick }: { draft: Draft; onPick: (l: Lane) => void }) {
  const lanes: [Lane, string, string][] = [
    ['quick', 'Quick Book', 'Write or import text (Markdown or Word), pick one of five themes. No code. Chapters become checkpoints; secrets, choices, and endings are one-line directives.'],
    ['crafted', 'Crafted Book', 'Upload a source folder (.zip) you built against the SDK — your own HTML, CSS, and JS world with a storyframe.json build block.'],
    ['prebuilt', 'Prebuilt package', 'Upload a finished package/ folder (.zip) with index.html. It is copied as-is, stamped with the story CSP, and validated.'],
  ]
  return (
    <div className="lanes" role="group" aria-label="Choose a lane">
      {lanes.map(([k, title, text]) => (
        <button key={k} type="button" className="lane" aria-pressed={draft.lane === k} onClick={() => onPick(k)}>
          <strong>{title}</strong><span>{text}</span>
        </button>
      ))}
      {draft.lane && <p className="small muted">Switching lanes starts the upload over; your manifest ID is kept.</p>}
    </div>
  )
}

/* ── step 2: upload ───────────────────────────────────────────────── */
function UploadStep({ draft, files, build, update, toast }: { draft: Draft; files: Map<string, Uint8Array>; build: any; update: (p: any) => void; toast: (m: string) => void }) {
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const quick = draft.lane === 'quick'
  const accept = quick ? '.md,.markdown,.txt,.docx,.png,.jpg,.jpeg,.webp,.gif,.svg,.woff2,.mp3,.ogg' : '.zip,.png,.jpg,.jpeg,.webp,.gif,.svg,.woff2,.mp3,.ogg'

  async function ingest(list: FileList | File[]) {
    let f = new Map(files)
    let manifest = { ...draft.manifest }
    const notes: string[] = []
    for (const file of Array.from(list)) {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const ext = extOf(file.name)
      if (ext === 'zip') {
        const map = unzipToMap(bytes)
        if (draft.lane === 'prebuilt') {
          const m = map.get('storyframe.json')
          if (m) { try { manifest = { ...JSON.parse(toText(m)), storyId: manifest.storyId ?? JSON.parse(toText(m)).storyId } } catch { notes.push('storyframe.json in the zip is not valid JSON — edit it in the Manifest step') } }
          f = new Map()
          for (const [p, b] of map) {
            if (p === 'storyframe.json' || p === 'integrity.json') continue
            if (/^cover\.(svg|png|webp|jpe?g)$/i.test(p)) { f.set(p, b); manifest.cover = p }
            f.set('prebuilt/' + p, b)
          }
          if (!map.has('index.html')) notes.push('no index.html at the top of the zip — a prebuilt package needs one')
          manifest.build = { prebuilt: 'prebuilt' }
          manifest.entrypoint = 'index.html'
        } else {
          f = new Map()
          for (const [p, b] of map) {
            if (/^package\//.test(p) || /(^|\/)build-package\.m?js$/.test(p)) { notes.push(`left out ${p} — CI builds with the declarative builder and never runs story scripts`); continue }
            f.set(p, b)
          }
          const m = f.get('storyframe.json')
          if (m) { try { manifest = JSON.parse(toText(m)) } catch { notes.push('storyframe.json is not valid JSON') } f.delete('storyframe.json') }
          else notes.push('no storyframe.json at the top of the zip — download a starter below, or build the manifest in the next step')
        }
      } else if (quick && (ext === 'md' || ext === 'markdown' || ext === 'txt')) {
        const fm = parseFrontMatter(toText(bytes))
        for (const k of FRONT_MATTER_KEYS) if (fm.data[k] !== undefined) manifest[k] = String(fm.data[k])
        if (fm.data.theme) manifest.build = { ...manifest.build, quickbook: { ...(manifest.build?.quickbook ?? { source: 'book.md' }), theme: String(fm.data.theme) } }
        if (fm.data.rating || fm.data.warnings) manifest.content = { ...(manifest.content ?? {}), ...(fm.data.rating ? { rating: String(fm.data.rating) } : {}), ...(fm.data.warnings ? { warnings: [].concat(fm.data.warnings as any).map(String) } : {}) }
        const keep = Object.fromEntries(Object.entries(fm.data).filter(([k]) => ['minutes', 'kicker', 'language'].includes(k)))
        const keepFm = Object.keys(keep).length ? `---\n${Object.entries(keep).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`).join('\n')}\n---\n` : ''
        f.set('book.md', toBytes(keepFm + fm.body.replace(/^\n+/, '')))
        if (!manifest.title || manifest.title === 'Untitled book') { const h1 = /^#\s+(.+)$/m.exec(fm.body); if (h1) manifest.title = h1[1].trim() }
      } else if (quick && ext === 'docx') {
        setBusy('Converting the Word document…')
        const mammothMod: any = await import('mammoth/mammoth.browser.js')
        const mammoth = mammothMod.default ?? mammothMod
        const out = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) })
        const r = htmlToQuickBookMarkdown(out.value, { title: manifest.title })
        f.set('book.md', toBytes(r.markdown))
        for (const [p, b] of r.assets) f.set(p, b)
        notes.push(...r.warnings)
        const h1 = /^#\s+(.+)$/m.exec(r.markdown)
        if (h1) manifest.title = h1[1].trim()
      } else {
        f.set(`assets/${file.name.replace(/[^\w.-]+/g, '-')}`, bytes)
      }
    }
    if (manifest.title && (!manifest.slug || manifest.slug === 'untitled-book')) manifest.slug = slugify(manifest.title, 'untitled-book')
    update({ files: [...f], manifest })
    setBusy('')
    for (const n of notes.slice(0, 4)) toast(n)
  }

  const book = quick ? toText(files.get('book.md') ?? new Uint8Array()) : ''
  const total = build?.files ? [...build.files.values()].reduce((n: number, b: Uint8Array) => n + b.byteLength, 0) : 0
  const budget = draft.manifest.offline?.maxBytes ?? 5242880
  const pct = Math.min(100, (total / budget) * 100)

  return (
    <div>
      <div className="dropzone" data-over={over} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); ingest(e.dataTransfer.files) }} onClick={() => inputRef.current?.click()}>
        <p><strong>{quick ? 'Drop a .md or .docx file, and any images' : draft.lane === 'prebuilt' ? 'Drop your package .zip' : 'Drop your source folder as a .zip'}</strong></p>
        <p className="small">or <button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}>choose files</button></p>
        <input ref={inputRef} className="sr" type="file" multiple accept={accept} aria-label="Choose files to upload" data-testid="upload"
          onChange={(e) => { if (e.target.files?.length) ingest(e.target.files); e.target.value = '' }} />
        {busy && <p role="status">{busy}</p>}
      </div>

      {quick && (
        <div className="field" style={{ marginTop: '1rem' }}>
          <label htmlFor="book-md">Your book (Markdown)</label>
          <textarea id="book-md" className="json" style={{ minHeight: '20rem', whiteSpace: 'pre-wrap' }} value={book}
            onChange={(e) => { const f = new Map(files); f.set('book.md', toBytes(e.target.value)); update({ files: [...f] }) }} />
          <details className="notes"><summary>Directive cheat-sheet</summary>
            <pre className="pre">{`## Chapter title {#chapter-id}        ← each chapter is a checkpoint
:::secret{id="key" name="A brass key" alt="A small brass key" hint="Something glints"}
Text only curious readers find.
:::
::achievement{id="night-owl" name="Night Owl" description="…" secret}
:::choice{id="door" label="Open it?"}
- open: Open the door
- wait: Wait for dawn
:::
:::branch{choice="door" option="open"}
Only readers who opened the door see this.
:::
:::ending{id="dawn" name="At Dawn"}
One way the story ends.
:::
![What the image shows](assets/picture.webp "caption")`}</pre>
            <p className="small">Full reference: docs/BOOK-AUTHORING.md.</p>
          </details>
        </div>
      )}
      {draft.lane === 'crafted' && (
        <p className="small">No folder yet? Download a starter:{' '}
          {(['native', 'wrap'] as const).map((t) => (
            <button key={t} type="button" className="btn small secondary" style={{ marginLeft: 6 }} onClick={() => {
              const slug = draft.manifest.slug ?? 'my-book'
              downloadBytes(mapToZip(scaffoldStory({ slug, template: t, storyId: draft.manifest.storyId ?? crypto.randomUUID(), title: draft.manifest.title }), slug), `${slug}-${t}-starter.zip`)
            }}>{t === 'native' ? 'Native SDK story' : 'Wrap an existing page'}</button>
          ))}
        </p>
      )}

      <h3>Files</h3>
      <div className="meter" role="meter" aria-label="Package size against the offline budget" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <i style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      <p className="small">Package {formatBytes(total)} of {formatBytes(budget)} offline budget · each file must stay under 25 MiB (Cloudflare Pages).</p>
      <ul className="filetree" aria-label="Uploaded files">
        {[...files.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([p, b]) => (
          <li key={p} className={b.byteLength > MAX_FILE_BYTES ? 'over' : ''}>
            <span>{p}</span>
            <span>{formatBytes(b.byteLength)} {b.byteLength > MAX_FILE_BYTES ? '— over 25 MiB' : ''}
              {p !== 'book.md' && <button type="button" className="link-btn" style={{ marginLeft: 8 }} aria-label={`Remove ${p}`} onClick={() => { const f = new Map(files); f.delete(p); update({ files: [...f] }) }}>remove</button>}
            </span>
          </li>
        ))}
        {!files.size && <li><span className="muted">Nothing uploaded yet.</span></li>}
      </ul>
    </div>
  )
}

/* ── step 5: accessibility ────────────────────────────────────────── */
function A11yStep({ draft, update }: { draft: Draft; update: (p: any) => void }) {
  const repo = adminSession().repo
  const doc = repo ? `https://github.com/${repo}/blob/main/docs/accessibility.md` : null
  return (
    <div>
      <p>Tick each promise only if it is true. Readers rely on these to choose a book; keyboard and screen-reader support are required to publish.
        {doc ? <> The full bar: <a href={doc} target="_blank" rel="noreferrer">docs/accessibility.md</a>.</> : ' The full bar is in docs/accessibility.md.'}</p>
      {draft.lane === 'quick' && <p className="callout info">The Quick Book runtime provides keyboard access, screen-reader structure, reduced-motion handling, and untimed reading. Your part: meaningful alt text on every image and secret.</p>}
      <ul className="checklist">
        {A11Y.map(([k, label, text]) => (
          <li key={k}>
            <label className="switch"><input type="checkbox" checked={!!draft.a11y[k]} onChange={(e) => {
              const a11y = { ...draft.a11y, [k]: e.target.checked }
              update({ a11y, manifest: { ...draft.manifest, accessibility: { ...Object.fromEntries(A11Y.map(([x]) => [x, !!a11y[x]])) } } })
            }} /> <strong>{label}</strong>{REQUIRED_A11Y.includes(k) && <span className="badge warn" style={{ marginLeft: 6 }}>required</span>}</label>
            <p>{text}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── step 6: validate ─────────────────────────────────────────────── */
function ValidateStep({ build, validation, pack, existing }: { build: any; validation: any; pack: any; existing: CatalogStory | null }) {
  const [compat, setCompat] = useState<any>(null)
  useEffect(() => {
    setCompat(null)
    const prod = existing && releaseFor(existing)
    if (!prod || !build?.ok) return
    fetchReleaseManifest(existing!, prod.releaseId).then((cur) => setCompat({ ...checkCompatibility(cur, validation?.manifest ?? build.manifest), against: prod })).catch(() => {})
  }, [build, existing?.storyId])

  if (!build) return <p className="callout bad">Nothing to build yet — add your book in Upload.</p>
  const buildIssues = build.log.errors.map((m: string) => ({ severity: 'error', code: 'build', message: m, fix: 'Fix the reference or file named here, then come back — the builder reruns instantly.' }))
  const groups = groupIssues([...buildIssues, ...(validation?.issues ?? [])])
  return (
    <div>
      <p className={`callout ${validation?.ok ? 'good' : 'bad'}`} role="status" data-testid="validation-result">
        {validation?.ok ? `✓ Passes the release gate — ${formatBytes(validation.totalBytes)}, predicted release ${pack.releaseId}` : `✗ ${groups.filter((g) => g.severity === 'error').reduce((n, g) => n + g.items.length, 0)} blocking issue(s)`}
      </p>
      <ul className="issues">
        {groups.map((g) => (
          <li key={g.code + g.severity} className={g.severity}>
            <strong>{g.severity === 'error' ? 'Must fix' : 'Worth a look'} · {g.code.replace(/_/g, ' ')}</strong>
            <ul>{g.items.map((m, i) => <li key={i}>{m}</li>)}</ul>
            <p className="fix">How to fix: {g.fix}</p>
          </li>
        ))}
      </ul>
      {build.log.notes.length > 0 && <details className="notes"><summary>Build notes ({build.log.notes.length})</summary><ul className="small">{build.log.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}</ul></details>}
      {compat && (
        <div className={`callout ${compat.ok ? 'good' : 'bad'}`}>
          <strong>Compatibility with production ({compat.against.releaseId}, v{compat.against.version}):</strong>{' '}
          {compat.ok ? 'readers mid-story can resume on this build.' : 'promotion will be blocked until this is fixed:'}
          {!compat.ok && <ul>{compat.blocking.map((b: any, i: number) => <li key={i}>{b.message}<br /><span className="small muted">{b.fix}</span></li>)}</ul>}
          {compat.warnings.length > 0 && <ul className="small">{compat.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>}
        </div>
      )}
    </div>
  )
}

/* ── step 8: publish ──────────────────────────────────────────────── */
function PublishStep({ draft, source, build, validation, pack, existing, update, onPublished }: any) {
  const session = adminSession()
  const client = gh()
  const [log, setLog] = useState<string[]>([])
  const [run, setRun] = useState<OpUpdate | null>(null)
  const [done, setDone] = useState<{ releaseId: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const slug = draft.manifest.slug
  const ok = !!validation?.ok
  const say = (m: string) => setLog((l) => [...l, m])

  const sourceForCommit = () => {
    const f = new Map<string, Uint8Array>(source)
    if (draft.lane === 'quick' && build?.manifest?.checkpoints) {
      f.set('book.md', toBytes(lockChapterIds(toText(f.get('book.md')!), build.manifest.checkpoints)))
    }
    if (!f.has('CHANGELOG.md')) f.set('CHANGELOG.md', toBytes(`# Changelog\n\n## ${draft.manifest.version}\n\nPublished from the Admin Studio.\n`))
    return f
  }

  async function publish() {
    if (!client) return
    setBusy(true); setLog([]); setRun(null); setDone(null)
    try {
      const r = await client.publishStory({ branch: session.branch, slug, version: draft.manifest.version, files: sourceForCommit(), onProgress: say })
      say(`✓ Committed ${r.message} (${r.commitSha.slice(0, 7)}) — ${r.uploaded} file(s), ${r.deleted} removed`)
      update({ published: { commitSha: r.commitSha, at: new Date().toISOString(), releaseId: pack.releaseId } })
      say('Waiting for the publish workflow…')
      const final = await watchRun(client, null, () => client.findRunForCommit(r.commitSha), setRun)
      if (final?.conclusion !== 'success') { say(`✗ The workflow finished: ${final?.conclusion ?? 'unknown'} — open the run for the log.`); return }
      say(`Waiting for ${pack.releaseId} to appear in registry.json…`)
      for (let i = 0; i < 60; i++) {
        const c = await catalog(true)
        const s = c.stories.find((x: CatalogStory) => x.storyId === draft.manifest.storyId)
        if (s?.releases.some((rel) => rel.releaseId === pack.releaseId)) { setDone({ releaseId: pack.releaseId }); say(`✓ ${pack.releaseId} is live on the beta channel.`); onPublished(); return }
        await new Promise((res) => setTimeout(res, 5000))
      }
      say('The workflow succeeded but the registry has not shown the release yet — the stories deploy may still be propagating (or deploy secrets are missing; see DEPLOY.md).')
    } catch (e: any) {
      say('✗ ' + e.message)
    } finally { setBusy(false) }
  }

  return (
    <div>
      <ul className="checklist">
        <li>{ok ? '✓' : '✗'} Release gate {ok ? `passed — ${formatBytes(validation.totalBytes)}` : 'not passed — fix Validate first'}</li>
        <li>{REQUIRED_A11Y.every((k) => draft.a11y[k]) ? '✓' : '✗'} Accessibility promises confirmed</li>
        <li>Predicted release: <code className="mono">{pack?.releaseId ?? '—'}</code> (content-addressed: CI will produce the same id from the same bytes)</li>
        <li>Destination: <code className="mono">stories/{slug}/</code> on <code className="mono">{session.branch}</code> of <code className="mono">{session.repo || '(no repository connected)'}</code> → CI → <strong>beta</strong> channel</li>
      </ul>

      <div className="btn-row">
        {client ? (
          <button className="btn" disabled={!ok || busy || !REQUIRED_A11Y.every((k) => draft.a11y[k])} onClick={publish}>{busy ? 'Publishing…' : `Publish v${draft.manifest.version} to beta`}</button>
        ) : (
          <a className="btn secondary" href="#/admin/connect">Connect GitHub to publish</a>
        )}
        <button className="btn secondary" onClick={() => downloadBytes(mapToZip(sourceForCommit(), slug), `${slug}-source.zip`)}>Download source folder (.zip)</button>
        {build?.ok && <button className="btn secondary" onClick={() => downloadBytes(mapToZip(build.files, 'package'), `${slug}-package.zip`)}>Download built package</button>}
      </div>
      {!client && <p className="small muted">Without GitHub: unzip the source folder into <code className="mono">stories/{slug}/</code>, then run <code className="mono">npm run storyframe -- build {slug}</code> and <code className="mono">npm run storyframe -- publish {slug} --channel beta</code>.</p>}

      {(log.length > 0 || run) && (
        <div className="panel" aria-live="polite">
          <h3 style={{ marginTop: 0 }}>Progress</h3>
          <ol className="small">{log.map((l, i) => <li key={i}>{l}</li>)}</ol>
          {run && <p className="small"><span className={`status-dot ${run.phase === 'completed' ? (run.conclusion === 'success' ? 'good' : 'bad') : 'run'}`} />CI: {run.phase}{run.conclusion ? ` · ${run.conclusion}` : ''} {run.url && <a href={run.url} target="_blank" rel="noreferrer">open run</a>}</p>}
        </div>
      )}
      {done && (
        <div className="callout good">
          <strong>Published to beta.</strong> Try it exactly as readers will, then promote it when you are happy.
          <div className="btn-row">
            <a className="btn" href={`#/play/${slug}?channel=beta`}>Preview beta in the app</a>
            <a className="btn secondary" href={`#/admin/book/${slug}`}>Release management</a>
          </div>
        </div>
      )}
      {existing && <p className="small muted">This updates “{existing.title}”. Production keeps serving {releaseFor(existing)?.releaseId ?? 'nothing'} until you promote.</p>}
    </div>
  )
}
